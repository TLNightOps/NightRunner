import falcon
import uuid6
from nightrunner_backend.app_context import get_driver
from nightrunner_backend.drivers.store.patrols import PatrolsStore
from nightrunner_backend.models.patrol import Patrol, PatrolMember
from nightrunner_backend.models.user_roles import can_manage_patrols


def _require_patrol_manager(req: falcon.Request, event_id):
    """Rejects the request unless the caller may change this event's patrols.

    Reading patrols stays open to any authenticated user; the scoring team and
    station staff need the roster to do their jobs. Creating, editing and
    deleting are the event's own business, so they stay with system admins,
    event admins and patrol management.
    """
    user = getattr(req.context, "user", None) or {}
    roles = getattr(req.context, "roles", None) or []

    if can_manage_patrols(roles, bool(user.get("is_admin")), event_id):
        return

    raise falcon.HTTPForbidden(
        title="Patrol Management Required",
        description=(
            "Only system admins, event admins and patrol management can "
            "create, edit or delete patrols."
        ),
    )


class PatrolsResource:
    """Handles /v1/patrols"""

    async def on_get(self, req: falcon.Request, resp: falcon.Response):
        store = PatrolsStore(get_driver())
        event_id = req.params.get("event") or req.params.get("eventId")
        if not event_id:
            raise falcon.HTTPBadRequest(description="An 'event' or 'eventId' query parameter is required.")
        patrols = await store.list(event_id=event_id)
        resp.media = [p.to_api_dict() for p in patrols]

    async def on_post(self, req: falcon.Request, resp: falcon.Response):
        store = PatrolsStore(get_driver())
        data = await req.get_media()
        if not isinstance(data, dict):
            raise falcon.HTTPBadRequest(description="Request body must be a JSON object.")
        event_id = data.get("eventId")
        if not event_id:
            raise falcon.HTTPBadRequest(description="'eventId' is required when creating a patrol.")
        _require_patrol_manager(req, event_id)
        members_data = data.get("members", [])
        if not isinstance(members_data, list):
            raise falcon.HTTPBadRequest(description="'members' must be a list.")
        members = []
        for m in members_data:
            if not isinstance(m, dict):
                continue
            name_val = m.get("name")
            if not name_val:
                continue
            rank_val = m.get("rank")
            troop_val = m.get("troop")
            members.append(
                PatrolMember(
                    id=str(uuid6.uuid7()),
                    name=str(name_val),
                    rank=str(rank_val) if rank_val is not None and not isinstance(rank_val, str) else rank_val,
                    troop=str(troop_val) if troop_val is not None and not isinstance(troop_val, str) else troop_val,
                    attendee_id=m.get("attendeeId") or m.get("attendee_id"),
                )
            )
        patrol_name = data.get("name") or "Trail Life"
        event_id = data.get("eventId")
        phone_number = data.get("phoneNumber")
        radio_frequency = data.get("radioFrequency")
        radio_channel = data.get("radioChannel")
        has_radio = bool(data.get("hasRadio", False))
        radio_identifier = data.get("radioIdentifier")
        patrol = Patrol(
            id=str(uuid6.uuid7()),
            event_id=str(event_id) if event_id is not None and not isinstance(event_id, str) else event_id,
            name=str(patrol_name),
            members=members,
            phone_number=str(phone_number) if phone_number is not None and not isinstance(phone_number, str) else phone_number,
            radio_frequency=str(radio_frequency) if radio_frequency is not None and not isinstance(radio_frequency, str) else radio_frequency,
            radio_channel=str(radio_channel) if radio_channel is not None and not isinstance(radio_channel, str) else radio_channel,
            has_radio=has_radio,
            radio_identifier=str(radio_identifier) if radio_identifier is not None and not isinstance(radio_identifier, str) else radio_identifier,
        )

        # Number the patrol automatically so organisers do not have to track
        # what is taken. An explicitly supplied number wins.
        requested_number = data.get("number")
        patrol.number = (
            int(requested_number)
            if requested_number is not None
            else await store.next_number(patrol.event_id)
        )

        await store.create(patrol)
        resp.status = falcon.HTTP_201
        resp.media = patrol.to_api_dict()


class PatrolResource:
    """Handles /v1/patrols/{patrol_id}"""

    async def on_get(self, req: falcon.Request, resp: falcon.Response, patrol_id: str):
        store = PatrolsStore(get_driver())
        patrol = await store.get(patrol_id)
        if not patrol:
            raise falcon.HTTPNotFound()
        resp.media = patrol.to_api_dict()

    async def on_put(self, req: falcon.Request, resp: falcon.Response, patrol_id: str):
        store = PatrolsStore(get_driver())
        patrol = await store.get(patrol_id)
        if not patrol:
            raise falcon.HTTPNotFound()
        _require_patrol_manager(req, patrol.event_id)
        data = await req.get_media()
        patrol.name = data.get("name", patrol.name)
        if "eventId" in data:
            # Moving a patrol between events needs rights on the destination
            # too, or rights on one event would let it be pushed into another.
            _require_patrol_manager(req, data.get("eventId"))
            patrol.event_id = data.get("eventId")
        if "phoneNumber" in data:
            patrol.phone_number = data.get("phoneNumber")
        if "radioFrequency" in data:
            patrol.radio_frequency = data.get("radioFrequency")
        if "radioChannel" in data:
            patrol.radio_channel = data.get("radioChannel")
        if "number" in data:
            patrol.number = int(data["number"]) if data.get("number") is not None else None
        if "hasRadio" in data:
            patrol.has_radio = bool(data.get("hasRadio"))
        if "radioIdentifier" in data:
            patrol.radio_identifier = data.get("radioIdentifier")
        if "members" in data:
            patrol.members = [
                PatrolMember(
                    id=m.get("id") or str(uuid6.uuid7()),
                    name=m["name"],
                    rank=m.get("rank"),
                    troop=m.get("troop"),
                    attendee_id=m.get("attendeeId") or m.get("attendee_id"),
                )
                for m in data["members"]
            ]
        await store.update(patrol)
        resp.media = patrol.to_api_dict()

    async def on_delete(self, req: falcon.Request, resp: falcon.Response, patrol_id: str):
        store = PatrolsStore(get_driver())
        patrol = await store.get(patrol_id)
        if not patrol:
            raise falcon.HTTPNotFound()
        _require_patrol_manager(req, patrol.event_id)
        await store.delete(patrol_id)
        resp.status = falcon.HTTP_204
