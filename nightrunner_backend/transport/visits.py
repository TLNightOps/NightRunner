import falcon
from nightrunner_backend.app_context import get_driver
from nightrunner_backend.drivers.store.station_visits import StationVisitsStore
from nightrunner_backend.models.user_roles import SCORING_ROLES, STATION_CHECKIN_ROLES
from nightrunner_backend.transport import visit_actions
from nightrunner_backend.transport.permissions import require_event_role


def _require_station_staff(req: falcon.Request, event_id):
    """Station check-in and check-out: station staff at any station, plus the scoring team."""
    require_event_role(
        req, event_id, STATION_CHECKIN_ROLES,
        title="Station Role Required",
        description="Only station leads, station volunteers, the scoring team and admins can check patrols in or out.",
    )


class VisitsResource:
    """GET /v1/visits?eventId={eventId} — List visits for an event."""

    async def on_get(self, req: falcon.Request, resp: falcon.Response):
        event_id = req.get_param("eventId")
        if not event_id:
            raise falcon.HTTPBadRequest(description="eventId query parameter is required.")
        
        store = StationVisitsStore(get_driver())
        visits = await store.list_for_event(event_id)
        resp.media = {"eventId": event_id, "visits": [v.to_api_dict() for v in visits]}
        resp.status = falcon.HTTP_200


class VisitCheckInResource:
    """POST /v1/visits/check-in — Record a patrol check-in at a station."""

    async def on_post(self, req: falcon.Request, resp: falcon.Response):
        payload = await req.get_media()
        if not isinstance(payload, dict):
            raise falcon.HTTPBadRequest(description="Request body must be a JSON object.")

        event_id = payload.get("eventId")
        station_id = payload.get("stationId")
        patrol_id = payload.get("patrolId")

        if not event_id:
            raise falcon.HTTPBadRequest(description="'eventId' is required.")
        if not station_id:
            raise falcon.HTTPBadRequest(description="'stationId' is required.")
        if not patrol_id:
            raise falcon.HTTPBadRequest(description="'patrolId' is required.")

        _require_station_staff(req, event_id)

        store = StationVisitsStore(get_driver())
        visit, status = await visit_actions.check_in(
            store,
            event_id=event_id,
            station_id=station_id,
            patrol_id=patrol_id,
            timestamp=payload.get("timestamp"),
            entry_mode=payload.get("entryMode", "live"),
        )
        resp.media = visit.to_api_dict()
        resp.status = status


class VisitCheckOutResource:
    """POST /v1/visits/check-out — Record a patrol check-out from a station."""

    async def on_post(self, req: falcon.Request, resp: falcon.Response):
        payload = await req.get_media()
        if not isinstance(payload, dict):
            raise falcon.HTTPBadRequest(description="Request body must be a JSON object.")

        event_id = payload.get("eventId")
        station_id = payload.get("stationId")
        patrol_id = payload.get("patrolId")

        if not event_id:
            raise falcon.HTTPBadRequest(description="'eventId' is required.")
        if not station_id:
            raise falcon.HTTPBadRequest(description="'stationId' is required.")
        if not patrol_id:
            raise falcon.HTTPBadRequest(description="'patrolId' is required.")

        _require_station_staff(req, event_id)

        store = StationVisitsStore(get_driver())
        visit, status = await visit_actions.check_out(
            store,
            event_id=event_id,
            station_id=station_id,
            patrol_id=patrol_id,
            timestamp=payload.get("timestamp"),
            entry_mode=payload.get("entryMode", "live"),
        )
        resp.media = visit.to_api_dict()
        resp.status = status


class VisitResetResource:
    """POST /v1/visits/reset — Reopen/reset a completed station attempt."""

    async def on_post(self, req: falcon.Request, resp: falcon.Response):
        payload = await req.get_media()
        if not isinstance(payload, dict):
            raise falcon.HTTPBadRequest(description="Request body must be a JSON object.")

        event_id = payload.get("eventId")
        station_id = payload.get("stationId")
        patrol_id = payload.get("patrolId")

        if not event_id:
            raise falcon.HTTPBadRequest(description="'eventId' is required.")
        if not station_id:
            raise falcon.HTTPBadRequest(description="'stationId' is required.")
        if not patrol_id:
            raise falcon.HTTPBadRequest(description="'patrolId' is required.")

        # Reopening belongs to the scoring team at any time. There used to be a
        # 5-minute self-reset window for station staff, but the role plan
        # (#236) takes scoring out of the field, so the window no longer
        # distinguishes anyone. The old after-the-window check also never
        # passed in production: it tested "<event_id>:<role>" strings with `in`
        # and read `isAdmin` where the middleware sets `is_admin`.
        user = require_event_role(
            req, event_id, SCORING_ROLES,
            title="Scoring Team Required",
            description="Only the scoring team, event admins and system admins can reopen a station attempt.",
        )

        store = StationVisitsStore(get_driver())
        latest = await store.get_latest_visit(event_id, station_id, patrol_id)

        if not latest:
            raise falcon.HTTPNotFound(description="No visit record found for this patrol and station.")

        # Reopen attempt
        latest.status = "checked_in"
        latest.checked_out_at = None
        latest.unlocked_by = user.get("id") or user.get("username") or "volunteer"
        updated = await store.update(latest)

        resp.media = updated.to_api_dict()
        resp.status = falcon.HTTP_200

