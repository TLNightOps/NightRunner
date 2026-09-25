"""Admin endpoints for minting, listing and revoking public event links.

Authenticated and admin-only, via `transport/permissions.py` — minting a credential that bypasses login is not something a signed-in volunteer
should be able to do.
"""

import falcon

from nightrunner_backend.app_context import get_driver
from nightrunner_backend.drivers.store.event_access_tokens import EventAccessTokensStore
from nightrunner_backend.drivers.store.public_board import PublicBoardStore
from nightrunner_backend.models.user_roles import EVENT_ADMIN
from nightrunner_backend.transport.permissions import require_event_role
from nightrunner_backend.models.event_access_token import (
    VALID_SCOPES,
    EventAccessToken,
    default_expiry,
    generate_token,
    hash_token,
)


def _require_admin(req: falcon.Request, event_id: str) -> dict:
    return require_event_role(
        req, event_id, (EVENT_ADMIN,),
        title="Admin required",
        description="Only an event admin can manage public links.",
    )


class EventAccessTokensResource:
    """GET/POST /v1/events/{event_id}/access-tokens"""

    async def on_get(self, req: falcon.Request, resp: falcon.Response, event_id: str):
        _require_admin(req, event_id)

        scope = req.get_param("scope")
        if scope and scope not in VALID_SCOPES:
            raise falcon.HTTPBadRequest(description=f"scope must be one of {', '.join(VALID_SCOPES)}.")

        store = EventAccessTokensStore(get_driver())
        tokens = await store.list_for_event(event_id, scope)
        # Metadata only. Neither the plaintext nor the hash is ever returned.
        resp.media = {"eventId": event_id, "tokens": [t.to_api_dict() for t in tokens]}
        resp.status = falcon.HTTP_200

    async def on_post(self, req: falcon.Request, resp: falcon.Response, event_id: str):
        user = _require_admin(req, event_id)

        payload = await req.get_media()
        if not isinstance(payload, dict):
            raise falcon.HTTPBadRequest(description="Request body must be a JSON object.")

        scope = payload.get("scope")
        if scope not in VALID_SCOPES:
            raise falcon.HTTPBadRequest(description=f"scope must be one of {', '.join(VALID_SCOPES)}.")

        board = PublicBoardStore(get_driver())
        event = await board.get_event(event_id)
        if not event:
            raise falcon.HTTPNotFound(description="Event not found.")

        station_id = payload.get("stationId")
        if station_id and not await board.station_belongs_to_event(station_id, event_id):
            raise falcon.HTTPBadRequest(description="Unknown station for this event.")

        plaintext = generate_token()
        token = EventAccessToken(
            event_id=event_id,
            token_hash=hash_token(plaintext),
            scope=scope,
            station_id=station_id,
            label=payload.get("label"),
            created_by=user.get("id"),
            expires_at=payload.get("expiresAt") or default_expiry(event.get("date")),
        )

        store = EventAccessTokensStore(get_driver())
        created = await store.create(token)

        body = created.to_api_dict()
        # The one and only time the plaintext exists in a response. It is not
        # recoverable afterwards — a lost link has to be revoked and reissued.
        body["token"] = plaintext
        resp.media = body
        resp.status = falcon.HTTP_201


class EventAccessTokenResource:
    """DELETE /v1/events/{event_id}/access-tokens/{token_id} — revoke."""

    async def on_delete(self, req: falcon.Request, resp: falcon.Response, event_id: str, token_id: str):
        _require_admin(req, event_id)

        store = EventAccessTokensStore(get_driver())
        existing = await store.get(token_id)
        if not existing or existing.event_id != event_id:
            raise falcon.HTTPNotFound(description="Link not found.")

        await store.revoke(token_id)
        # The row survives revocation so the audit trail does.
        refreshed = await store.get(token_id)
        resp.media = refreshed.to_api_dict() if refreshed else {"id": token_id, "revoked": True}
        resp.status = falcon.HTTP_200
