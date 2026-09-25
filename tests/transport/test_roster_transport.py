"""
Tests for transport/roster.py endpoints, verifying auth role checks, compliance
validation, and attendee creation endpoints.
"""

import falcon
import pytest
from falcon.testing import ASGITestClient

from nightrunner_backend.app_context import get_driver
from nightrunner_backend.main import app, register_routes


@pytest.fixture
async def test_client():
    register_routes(app)
    async with ASGITestClient(app) as client:
        yield client


async def seed_user(user_id="test-user-id", ext_id="test-user-id", is_admin=False, role=None, event_id="event-1"):
    driver = get_driver()
    await driver.execute(
        """
        INSERT INTO users (id, external_id, username, email, display_name, is_admin, status)
        VALUES (:id, :ext_id, 'testuser', 'test@example.com', 'Test User', :is_admin, 'active')
        """,
        {"id": user_id, "ext_id": ext_id, "is_admin": is_admin},
    )
    if role:
        await driver.execute(
            """
            INSERT INTO user_roles (user_id, role)
            VALUES (:user_id, :role)
            """,
            # Stored the way production stores event roles: "<event_id>:<role>".
            {"user_id": user_id, "role": "{}:{}".format(event_id, role)},
        )


class TestRosterAuthAndCompliance:

    async def test_non_admin_forbidden_from_creating_troop(self, test_client, token_factory):
        await seed_user(role="user")
        headers = token_factory(roles={"event-1": "user"}, is_admin=False)
        resp = await test_client.simulate_post(
            "/v1/troops",
            headers=headers,
            json={"number": "GA-0594", "name": "Troop 594"},
        )
        assert resp.status == falcon.HTTP_403

    async def test_event_admin_can_create_troop(self, test_client, token_factory):
        await seed_user(role="event-admin")
        headers = token_factory(roles={"event-1": "event-admin"}, is_admin=False)
        resp = await test_client.simulate_post(
            "/v1/troops",
            headers=headers,
            json={"number": "GA-0594", "name": "Troop 594"},
        )
        assert resp.status == falcon.HTTP_201
        assert resp.json["number"] == "GA-0594"

    async def test_system_admin_can_create_troop(self, test_client, token_factory):
        await seed_user(is_admin=True)
        headers = token_factory(roles={}, is_admin=True)
        resp = await test_client.simulate_post(
            "/v1/troops",
            headers=headers,
            json={"number": "GA-0122", "name": "Troop 122"},
        )
        assert resp.status == falcon.HTTP_201

    async def test_non_admin_forbidden_from_adding_attendee(self, test_client, token_factory):
        await seed_user(role="gate-checkin")
        headers = token_factory(roles={"event-1": "gate-checkin"}, is_admin=False)
        resp = await test_client.simulate_post(
            "/v1/events/event-1/attendees",
            headers=headers,
            json={
                "troopNumber": "GA-0594",
                "firstName": "John",
                "lastName": "Doe",
                "category": "Youth",
            },
        )
        assert resp.status == falcon.HTTP_403

    async def test_adult_attendee_requires_member_id_unless_waived(self, test_client, token_factory):
        await seed_user(role="event-admin")
        headers = token_factory(roles={"event-1": "event-admin"}, is_admin=False)
        resp = await test_client.simulate_post(
            "/v1/events/event-1/attendees",
            headers=headers,
            json={
                "troopNumber": "GA-0594",
                "firstName": "Adult",
                "lastName": "Leader",
                "category": "Adult",
                "youthProtectionCompleted": True,
            },
        )
        assert resp.status == falcon.HTTP_400
        assert "Member ID is required" in resp.json["description"]

    async def test_adult_attendee_requires_youth_protection_training(self, test_client, token_factory):
        await seed_user(role="event-admin")
        headers = token_factory(roles={"event-1": "event-admin"}, is_admin=False)
        resp = await test_client.simulate_post(
            "/v1/events/event-1/attendees",
            headers=headers,
            json={
                "troopNumber": "GA-0594",
                "firstName": "Adult",
                "lastName": "Leader",
                "category": "Adult",
                "memberId": "12345",
                "youthProtectionCompleted": False,
            },
        )
        assert resp.status == falcon.HTTP_400
        assert "Youth Protection Training" in resp.json["description"]

    async def test_adult_attendee_created_with_waiver_and_youth_protection(self, test_client, token_factory):
        await seed_user(role="event-admin")
        headers = token_factory(roles={"event-1": "event-admin"}, is_admin=False)
        resp = await test_client.simulate_post(
            "/v1/events/event-1/attendees",
            headers=headers,
            json={
                "troopNumber": "GA-0594",
                "firstName": "Adult",
                "lastName": "Leader",
                "category": "Adult",
                "organizerApprovedMemberIdWaiver": True,
                "youthProtectionCompleted": True,
            },
        )
        assert resp.status == falcon.HTTP_201
        assert resp.json["firstName"] == "Adult"
        assert resp.json["category"] == "Adult"
        assert resp.json["youthProtectionCompleted"] is True


class TestTroopsForEvent:

    async def test_event_id_filter_returns_only_that_events_troops(self, test_client, token_factory):
        import uuid6
        from nightrunner_backend.drivers.store.roster import RosterStore
        from nightrunner_backend.models.roster import EventAttendee, build_source_key

        store = RosterStore(get_driver())
        ours = await store.ensure_troop("GA-0594")
        theirs = await store.ensure_troop("GA-0122")
        for event_id, troop in (("event-1", ours), ("event-2", theirs)):
            await store.create_attendee(EventAttendee(
                id=str(uuid6.uuid7()),
                event_id=event_id,
                troop_id=troop.id,
                first_name="Sam",
                last_name="Jones",
                category="Youth",
                source_key=build_source_key(troop.number, "Jones", "Sam"),
                key_ordinal=1,
            ))

        await seed_user(is_admin=True)
        headers = token_factory(roles={}, is_admin=True)

        filtered = await test_client.simulate_get("/v1/troops?eventId=event-1", headers=headers)
        assert filtered.status == falcon.HTTP_200
        assert [t["number"] for t in filtered.json["troops"]] == ["GA-0594"]

        everything = await test_client.simulate_get("/v1/troops", headers=headers)
        assert len(everything.json["troops"]) == 2


class TestAttendeeStatusAndArrivals:

    async def test_update_attendee_status_and_arrivals_summary(self, test_client, token_factory):
        await seed_user(role="event-admin")
        headers = token_factory(roles={"event-1": "event-admin"}, is_admin=False)

        # 1. Create 3 attendees
        r1 = await test_client.simulate_post(
            "/v1/events/event-1/attendees",
            headers=headers,
            json={"troopNumber": "GA-0100", "firstName": "Alice", "lastName": "Smith", "category": "Youth"},
        )
        a1_id = r1.json["id"]

        r2 = await test_client.simulate_post(
            "/v1/events/event-1/attendees",
            headers=headers,
            json={"troopNumber": "GA-0100", "firstName": "Bob", "lastName": "Jones", "category": "Youth"},
        )
        a2_id = r2.json["id"]

        r3 = await test_client.simulate_post(
            "/v1/events/event-1/attendees",
            headers=headers,
            json={"troopNumber": "GA-0100", "firstName": "Charlie", "lastName": "Brown", "category": "Youth"},
        )
        a3_id = r3.json["id"]

        # 2. Check in Alice (a1)
        await test_client.simulate_post(
            "/v1/events/event-1/arrivals",
            headers=headers,
            json={"attendeeId": a1_id},
        )

        # 3. Mark Bob (a2) as not_coming
        patch_resp = await test_client.simulate_patch(
            f"/v1/events/event-1/attendees/{a2_id}/status",
            headers=headers,
            json={"status": "not_coming"},
        )
        assert patch_resp.status == falcon.HTTP_200
        assert patch_resp.json["status"] == "not_coming"

        # 4. GET /v1/events/event-1/arrivals and verify stats
        arr_resp = await test_client.simulate_get("/v1/events/event-1/arrivals", headers=headers)
        assert arr_resp.status == falcon.HTTP_200
        data = arr_resp.json
        assert data["expected"] == 3
        assert data["arrived"] == 1
        assert data["here"] == 1
        assert data["coming"] == 1
        assert data["notComing"] == 1
        assert data["missing"] == 1

        troop = next(t for t in data["troops"] if t["troopNumber"] == "GA-0100")
        assert troop["expected"] == 3
        assert troop["arrived"] == 1
        assert troop["here"] == 1
        assert troop["coming"] == 1
        assert troop["notComing"] == 1
        assert troop["missing"] == 1
