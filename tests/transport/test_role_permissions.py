"""Server-side enforcement of the role plan agreed 2026-09-24 (#236).

- Scores are entered, corrected, reopened and finalized by the scoring team
  (plus event and system admins), at the scoring center, not in the field.
- Station leads and station volunteers check patrols in and out at any station.
- Everyone else is refused, whatever the frontend's menus show.

Roles are seeded the way production stores them, as "<event_id>:<role>". The
old inline checks tested those strings with `in`, which never matched, and
tests seeded bare role names, which hid it.
"""

import falcon
import pytest


SCORING = ["event-admin", "scoring-team"]
NOT_SCORING = [
    "station-lead",
    "station-volunteer",
    "command-center",
    "gate-checkin",
    "patrol-management",
    "user",
]

CHECKIN = ["event-admin", "scoring-team", "station-lead", "station-volunteer"]
NOT_CHECKIN = ["command-center", "gate-checkin", "patrol-management", "user"]


async def _make_event(client, admin_headers):
    resp = await client.simulate_post(
        "/v1/events",
        json={"name": "Role Permissions Event", "description": "d"},
        headers=admin_headers,
    )
    assert resp.status == falcon.HTTP_201
    return resp.json["id"]


async def _make_patrol(client, admin_headers, event_id):
    resp = await client.simulate_post(
        "/v1/patrols",
        json={"eventId": event_id, "name": "Eagle"},
        headers=admin_headers,
    )
    assert resp.status == falcon.HTTP_201
    return resp.json["id"]


async def _setup(client, as_role):
    admin = await as_role(is_admin=True)
    event_id = await _make_event(client, admin)
    patrol_id = await _make_patrol(client, admin, event_id)
    return admin, event_id, patrol_id


def _visit(event_id, patrol_id):
    return {"eventId": event_id, "stationId": "station-1", "patrolId": patrol_id}


def _score(event_id, patrol_id):
    return {
        **_visit(event_id, patrol_id),
        "scores": [{"taskId": "task-1", "scoreValue": 5}],
    }


async def _finished_visit(client, admin, event_id, patrol_id):
    body = _visit(event_id, patrol_id)
    resp = await client.simulate_post("/v1/visits/check-in", json=body, headers=admin)
    assert resp.status in (falcon.HTTP_200, falcon.HTTP_201)
    resp = await client.simulate_post("/v1/visits/check-out", json=body, headers=admin)
    assert resp.status in (falcon.HTTP_200, falcon.HTTP_201)


# --- Scores ------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("role", NOT_SCORING)
async def test_only_scoring_team_can_submit_scores(test_client, as_role, role):
    _, event_id, patrol_id = await _setup(test_client, as_role)

    headers = await as_role(roles=["{}:{}".format(event_id, role)])
    resp = await test_client.simulate_post(
        "/v1/scores", json=_score(event_id, patrol_id), headers=headers
    )

    assert resp.status == falcon.HTTP_403


@pytest.mark.asyncio
@pytest.mark.parametrize("role", SCORING)
async def test_scoring_team_can_submit_scores(test_client, as_role, role):
    _, event_id, patrol_id = await _setup(test_client, as_role)

    headers = await as_role(roles=["{}:{}".format(event_id, role)])
    resp = await test_client.simulate_post(
        "/v1/scores", json=_score(event_id, patrol_id), headers=headers
    )

    assert resp.status == falcon.HTTP_201


@pytest.mark.asyncio
async def test_scoring_role_on_another_event_does_not_count(test_client, as_role):
    admin, event_id, patrol_id = await _setup(test_client, as_role)
    other_event = await _make_event(test_client, admin)

    headers = await as_role(roles=["{}:scoring-team".format(other_event)])
    resp = await test_client.simulate_post(
        "/v1/scores", json=_score(event_id, patrol_id), headers=headers
    )

    assert resp.status == falcon.HTTP_403


@pytest.mark.asyncio
@pytest.mark.parametrize("role", NOT_SCORING)
async def test_only_scoring_team_can_save_finalized_results(test_client, as_role, role):
    _, event_id, _ = await _setup(test_client, as_role)

    headers = await as_role(roles=["{}:{}".format(event_id, role)])
    resp = await test_client.simulate_post(
        "/v1/scores/finalized",
        json={"eventId": event_id, "results": []},
        headers=headers,
    )

    assert resp.status == falcon.HTTP_403


# --- Station check-in / check-out --------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("role", NOT_CHECKIN)
async def test_non_station_roles_cannot_check_in(test_client, as_role, role):
    _, event_id, patrol_id = await _setup(test_client, as_role)

    headers = await as_role(roles=["{}:{}".format(event_id, role)])
    for path in ("/v1/visits/check-in", "/v1/visits/check-out"):
        resp = await test_client.simulate_post(
            path, json=_visit(event_id, patrol_id), headers=headers
        )
        assert resp.status == falcon.HTTP_403, path


@pytest.mark.asyncio
@pytest.mark.parametrize("role", CHECKIN)
async def test_station_roles_can_check_in_at_any_station(test_client, as_role, role):
    _, event_id, patrol_id = await _setup(test_client, as_role)

    headers = await as_role(roles=["{}:{}".format(event_id, role)])
    resp = await test_client.simulate_post(
        "/v1/visits/check-in", json=_visit(event_id, patrol_id), headers=headers
    )

    assert resp.status in (falcon.HTTP_200, falcon.HTTP_201)


# --- Reopening a station attempt ---------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("role", NOT_SCORING)
async def test_only_scoring_team_can_reopen_an_attempt(test_client, as_role, role):
    admin, event_id, patrol_id = await _setup(test_client, as_role)
    await _finished_visit(test_client, admin, event_id, patrol_id)

    headers = await as_role(roles=["{}:{}".format(event_id, role)])
    resp = await test_client.simulate_post(
        "/v1/visits/reset", json=_visit(event_id, patrol_id), headers=headers
    )

    assert resp.status == falcon.HTTP_403


@pytest.mark.asyncio
@pytest.mark.parametrize("role", SCORING)
async def test_scoring_team_can_reopen_an_attempt(test_client, as_role, role):
    # Regression: before #236 this check never passed for an event role in
    # production, and read `isAdmin` so system admins failed it too.
    admin, event_id, patrol_id = await _setup(test_client, as_role)
    await _finished_visit(test_client, admin, event_id, patrol_id)

    headers = await as_role(roles=["{}:{}".format(event_id, role)])
    resp = await test_client.simulate_post(
        "/v1/visits/reset", json=_visit(event_id, patrol_id), headers=headers
    )

    assert resp.status == falcon.HTTP_200
    assert resp.json["status"] == "checked_in"


@pytest.mark.asyncio
async def test_system_admin_can_reopen_an_attempt(test_client, as_role):
    admin, event_id, patrol_id = await _setup(test_client, as_role)
    await _finished_visit(test_client, admin, event_id, patrol_id)

    resp = await test_client.simulate_post(
        "/v1/visits/reset", json=_visit(event_id, patrol_id), headers=admin
    )

    assert resp.status == falcon.HTTP_200


# --- Gate and public links: event admins, stored with an event prefix ---------


@pytest.mark.asyncio
async def test_event_admin_can_manage_public_links(test_client, as_role):
    _, event_id, _ = await _setup(test_client, as_role)

    headers = await as_role(roles=["{}:event-admin".format(event_id)])
    resp = await test_client.simulate_get(
        "/v1/events/{}/access-tokens".format(event_id), headers=headers
    )

    assert resp.status == falcon.HTTP_200
