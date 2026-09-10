import pytest
from nightrunner_backend.drivers.store.station_visits import StationVisitsStore
from nightrunner_backend.models.station_visit import StationVisit
from nightrunner_backend.models.event import Event
from nightrunner_backend.models.station import Station
from nightrunner_backend.models.patrol import Patrol
from nightrunner_backend.drivers.store.events import EventsStore
from nightrunner_backend.drivers.store.stations import StationsStore
from nightrunner_backend.drivers.store.patrols import PatrolsStore


@pytest.fixture
async def store(test_database):
    # Create prerequisite foreign key records
    event_store = EventsStore(test_database)
    station_store = StationsStore(test_database)
    patrol_store = PatrolsStore(test_database)

    await event_store.create(Event(id="e1", name="Test Event"))
    await station_store.create(Station(id="s1", event_id="e1", name="Station 1"))
    await patrol_store.create(Patrol(id="p1", event_id="e1", name="Patrol 1"))

    return StationVisitsStore(test_database)


@pytest.mark.asyncio
async def test_station_visits_crud(store):
    visit = StationVisit(
        event_id="e1",
        station_id="s1",
        patrol_id="p1",
        checked_in_at="2026-09-09T20:00:00Z"
    )
    created = await store.create(visit)
    assert created.id is not None

    fetched = await store.get(created.id)
    assert fetched is not None
    assert fetched.checked_in_at == "2026-09-09T20:00:00Z"
    assert fetched.checked_out_at is None

    # Check active visit
    active = await store.get_active_visit("e1", "s1", "p1")
    assert active is not None
    assert active.id == created.id

    # Check out
    active.checked_out_at = "2026-09-09T20:30:00Z"
    updated = await store.update(active)
    assert updated.checked_out_at == "2026-09-09T20:30:00Z"

    # Active visit should now be None
    no_active = await store.get_active_visit("e1", "s1", "p1")
    assert no_active is None

    # List for event
    visits = await store.list_for_event("e1")
    assert len(visits) == 1
