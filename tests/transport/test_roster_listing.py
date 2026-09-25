"""Listing the roster and previewing an import must not crash.

Both call `_troop_number_map`, which e472bac removed while adding
`_require_admin`. The Gate Check-In search box lists attendees, so it failed
with a 500 on every search. The existing tests only POSTed attendees, which is
why nothing caught it.
"""

import falcon
import falcon.testing
import pytest

from nightrunner_backend.main import app, register_routes
from tests.transport.test_roster_transport import seed_user


@pytest.fixture
async def test_client():
    register_routes(app)
    async with falcon.testing.ASGITestClient(app) as client:
        yield client


@pytest.mark.asyncio
async def test_listing_attendees_does_not_crash(test_client, token_factory):
    await seed_user(is_admin=True)
    headers = token_factory(roles={}, is_admin=True)

    resp = await test_client.simulate_get("/v1/events/event-1/attendees?q=smith", headers=headers)

    assert resp.status == falcon.HTTP_200
    assert resp.json["attendees"] == []


@pytest.mark.asyncio
async def test_previewing_a_roster_import_does_not_crash(test_client, token_factory):
    await seed_user(is_admin=True)
    headers = token_factory(roles={}, is_admin=True)

    resp = await test_client.simulate_post(
        "/v1/events/event-1/roster/preview", json={"rows": []}, headers=headers
    )

    assert resp.status == falcon.HTTP_200
