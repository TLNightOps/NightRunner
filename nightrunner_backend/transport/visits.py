from datetime import datetime, timezone
import falcon
import uuid6
from nightrunner_backend.app_context import get_driver
from nightrunner_backend.drivers.store.station_visits import StationVisitsStore
from nightrunner_backend.models.station_visit import StationVisit


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

        timestamp = payload.get("timestamp") or datetime.now(timezone.utc).isoformat()
        store = StationVisitsStore(get_driver())

        # Check if an active visit already exists
        existing = await store.get_active_visit(event_id, station_id, patrol_id)
        if existing:
            existing.checked_in_at = timestamp
            updated = await store.update(existing)
            resp.media = updated.to_api_dict()
            resp.status = falcon.HTTP_200
            return

        visit = StationVisit(
            id=str(uuid6.uuid7()),
            event_id=event_id,
            station_id=station_id,
            patrol_id=patrol_id,
            checked_in_at=timestamp,
            entry_mode=payload.get("entryMode", "live"),
        )
        created = await store.create(visit)
        resp.media = created.to_api_dict()
        resp.status = falcon.HTTP_201


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

        timestamp = payload.get("timestamp") or datetime.now(timezone.utc).isoformat()
        store = StationVisitsStore(get_driver())

        existing = await store.get_active_visit(event_id, station_id, patrol_id)
        if existing:
            existing.checked_out_at = timestamp
            updated = await store.update(existing)
            resp.media = updated.to_api_dict()
            resp.status = falcon.HTTP_200
            return

        visit = StationVisit(
            id=str(uuid6.uuid7()),
            event_id=event_id,
            station_id=station_id,
            patrol_id=patrol_id,
            checked_out_at=timestamp,
            entry_mode=payload.get("entryMode", "live"),
        )
        created = await store.create(visit)
        resp.media = created.to_api_dict()
        resp.status = falcon.HTTP_201
