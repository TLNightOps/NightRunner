"""Write access to patrols is limited to the people who own the roster.

The scoring team, station staff and ordinary users read patrols constantly, so
GET stays open to any authenticated user. Creating, editing and deleting are
restricted. These tests pin the deny side down, because the guard is the only
thing between a scorer and the roster: the Patrol Manager's UI gate is trivially
bypassed by calling the API directly.

Auth is driven for real via the `as_role` fixture in conftest.py.
"""

import falcon
import pytest


ALL_EVENT_ROLES = [
    "scoring-team",
    "station-lead",
    "station-volunteer",
    "gate-checkin",
    "user",
]

MANAGER_ROLES = ["event-admin", "patrol-management", "command-center"]


async def _make_event(client, admin_headers, name="Permissions Test Event"):
    resp = await client.simulate_post(
        "/v1/events",
        json={"name": name, "description": "d"},
        headers=admin_headers,
    )
    assert resp.status == falcon.HTTP_201
    return resp.json["id"]


async def _make_patrol(client, admin_headers, event_id, name="Eagle"):
    resp = await client.simulate_post(
        "/v1/patrols",
        json={"eventId": event_id, "name": name},
        headers=admin_headers,
    )
    assert resp.status == falcon.HTTP_201
    return resp.json["id"]


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ALL_EVENT_ROLES)
async def test_non_managers_cannot_create_patrols(test_client, as_role, role):
    admin = await as_role(is_admin=True)
    event_id = await _make_event(test_client, admin)

    headers = await as_role(roles=["{}:{}".format(event_id, role)])
    resp = await test_client.simulate_post(
        "/v1/patrols",
        json={"eventId": event_id, "name": "Sneaky Patrol"},
        headers=headers,
    )

    assert resp.status == falcon.HTTP_403


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ALL_EVENT_ROLES)
async def test_non_managers_cannot_edit_or_delete_patrols(test_client, as_role, role):
    admin = await as_role(is_admin=True)
    event_id = await _make_event(test_client, admin)
    patrol_id = await _make_patrol(test_client, admin, event_id)

    headers = await as_role(roles=["{}:{}".format(event_id, role)])

    resp = await test_client.simulate_put(
        "/v1/patrols/" + patrol_id,
        json={"name": "Renamed"},
        headers=headers,
    )
    assert resp.status == falcon.HTTP_403

    resp = await test_client.simulate_delete(
        "/v1/patrols/" + patrol_id,
        headers=headers,
    )
    assert resp.status == falcon.HTTP_403


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ALL_EVENT_ROLES)
async def test_everyone_can_still_read_patrols(test_client, as_role, role):
    """The whole point of the restriction is that reads stay open."""
    admin = await as_role(is_admin=True)
    event_id = await _make_event(test_client, admin)
    await _make_patrol(test_client, admin, event_id, name="Visible Patrol")

    headers = await as_role(roles=["{}:{}".format(event_id, role)])
    resp = await test_client.simulate_get(
        "/v1/patrols?eventId=" + event_id,
        headers=headers,
    )

    assert resp.status == falcon.HTTP_200
    assert [p["name"] for p in resp.json] == ["Visible Patrol"]


@pytest.mark.asyncio
@pytest.mark.parametrize("role", MANAGER_ROLES)
async def test_managers_can_create_edit_and_delete(test_client, as_role, role):
    admin = await as_role(is_admin=True)
    event_id = await _make_event(test_client, admin)

    headers = await as_role(roles=["{}:{}".format(event_id, role)])

    resp = await test_client.simulate_post(
        "/v1/patrols",
        json={"eventId": event_id, "name": "Managed Patrol"},
        headers=headers,
    )
    assert resp.status == falcon.HTTP_201
    patrol_id = resp.json["id"]

    resp = await test_client.simulate_put(
        "/v1/patrols/" + patrol_id,
        json={"name": "Renamed"},
        headers=headers,
    )
    assert resp.status == falcon.HTTP_200
    assert resp.json["name"] == "Renamed"

    resp = await test_client.simulate_delete(
        "/v1/patrols/" + patrol_id,
        headers=headers,
    )
    assert resp.status == falcon.HTTP_204


@pytest.mark.asyncio
async def test_system_admin_bypasses_event_roles(test_client, as_role):
    admin = await as_role(is_admin=True)
    event_id = await _make_event(test_client, admin)

    resp = await test_client.simulate_post(
        "/v1/patrols",
        json={"eventId": event_id, "name": "Admin Patrol"},
        headers=admin,
    )

    assert resp.status == falcon.HTTP_201


@pytest.mark.asyncio
async def test_rights_do_not_carry_between_events(test_client, as_role):
    """Managing one event's patrols grants nothing over another event's."""
    admin = await as_role(is_admin=True)
    event_a = await _make_event(test_client, admin, name="Event A")
    event_b = await _make_event(test_client, admin, name="Event B")

    headers = await as_role(roles=["{}:patrol-management".format(event_a)])
    resp = await test_client.simulate_post(
        "/v1/patrols",
        json={"eventId": event_b, "name": "Wrong Event"},
        headers=headers,
    )

    assert resp.status == falcon.HTTP_403


@pytest.mark.asyncio
async def test_patrol_cannot_be_moved_into_an_unmanaged_event(test_client, as_role):
    """Rights on the source event must not be enough to push a patrol elsewhere."""
    admin = await as_role(is_admin=True)
    event_a = await _make_event(test_client, admin, name="Event A")
    event_b = await _make_event(test_client, admin, name="Event B")
    patrol_id = await _make_patrol(test_client, admin, event_a)

    headers = await as_role(roles=["{}:patrol-management".format(event_a)])
    resp = await test_client.simulate_put(
        "/v1/patrols/" + patrol_id,
        json={"eventId": event_b},
        headers=headers,
    )

    assert resp.status == falcon.HTTP_403
