import falcon
import pytest
from unittest.mock import patch, AsyncMock
from nightrunner_backend.main import app, register_routes


@pytest.fixture
async def test_client():
    register_routes(app)
    async with falcon.testing.ASGITestClient(app) as client:
        yield client


@patch("nightrunner_backend.transport.middleware.auth.AuthMiddleware.process_request", AsyncMock(return_value=None))
@pytest.mark.asyncio
async def test_visits_endpoints(test_client, dev_mode_enabled):
    # Check-in
    checkin_body = {
        "eventId": "e1",
        "stationId": "s1",
        "patrolId": "p1",
        "timestamp": "2026-09-09T20:00:00Z"
    }
    resp = await test_client.simulate_post("/v1/visits/check-in", json=checkin_body)
    assert resp.status == falcon.HTTP_201 or resp.status == falcon.HTTP_200
    visit = resp.json
    assert visit["eventId"] == "e1"
    assert visit["stationId"] == "s1"
    assert visit["patrolId"] == "p1"
    assert visit["checkedInAt"] == "2026-09-09T20:00:00Z"

    # List visits
    resp = await test_client.simulate_get("/v1/visits?eventId=e1")
    assert resp.status == falcon.HTTP_200
    data = resp.json
    assert len(data["visits"]) >= 1

    # Check-out
    checkout_body = {
        "eventId": "e1",
        "stationId": "s1",
        "patrolId": "p1",
        "timestamp": "2026-09-09T20:30:00Z"
    }
    resp = await test_client.simulate_post("/v1/visits/check-out", json=checkout_body)
    assert resp.status == falcon.HTTP_200 or resp.status == falcon.HTTP_201
    updated_visit = resp.json
    assert updated_visit["checkedOutAt"] == "2026-09-09T20:30:00Z"
