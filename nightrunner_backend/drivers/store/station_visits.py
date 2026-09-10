from typing import List, Optional
from nightrunner_backend.drivers.base import DatabaseDriver
from nightrunner_backend.models.station_visit import StationVisit

LIST_VISITS_FOR_EVENT = "SELECT * FROM station_visits WHERE event_id = :event_id ORDER BY created_at ASC"
GET_VISIT = "SELECT * FROM station_visits WHERE id = :id"
GET_ACTIVE_VISIT = "SELECT * FROM station_visits WHERE event_id = :event_id AND station_id = :station_id AND patrol_id = :patrol_id AND checked_out_at IS NULL ORDER BY created_at DESC LIMIT 1"
CREATE_VISIT = """
    INSERT INTO station_visits (
        id, event_id, station_id, patrol_id,
        checked_in_at, checked_out_at, tasks_started_at, tasks_completed_at, entry_mode
    ) VALUES (
        :id, :event_id, :station_id, :patrol_id,
        :checked_in_at, :checked_out_at, :tasks_started_at, :tasks_completed_at, :entry_mode
    )
"""
UPDATE_VISIT = """
    UPDATE station_visits
    SET checked_in_at = :checked_in_at,
        checked_out_at = :checked_out_at,
        tasks_started_at = :tasks_started_at,
        tasks_completed_at = :tasks_completed_at,
        entry_mode = :entry_mode
    WHERE id = :id
"""


class StationVisitsStore:
    def __init__(self, driver: DatabaseDriver):
        self.driver = driver

    def _row_to_visit(self, row: dict) -> StationVisit:
        return StationVisit(
            id=row["id"],
            event_id=row["event_id"],
            station_id=row["station_id"],
            patrol_id=row["patrol_id"],
            checked_in_at=row.get("checked_in_at"),
            checked_out_at=row.get("checked_out_at"),
            tasks_started_at=row.get("tasks_started_at"),
            tasks_completed_at=row.get("tasks_completed_at"),
            entry_mode=row.get("entry_mode") or "live",
            created_at=row.get("created_at"),
        )

    async def list_for_event(self, event_id: str) -> List[StationVisit]:
        rows = await self.driver.execute(LIST_VISITS_FOR_EVENT, {"event_id": event_id})
        return [self._row_to_visit(row) for row in rows]

    async def get(self, visit_id: str) -> Optional[StationVisit]:
        row = await self.driver.fetch_one(GET_VISIT, {"id": visit_id})
        return self._row_to_visit(row) if row else None

    async def get_active_visit(self, event_id: str, station_id: str, patrol_id: str) -> Optional[StationVisit]:
        row = await self.driver.fetch_one(GET_ACTIVE_VISIT, {
            "event_id": event_id,
            "station_id": station_id,
            "patrol_id": patrol_id
        })
        return self._row_to_visit(row) if row else None

    async def create(self, visit: StationVisit) -> StationVisit:
        await self.driver.execute(CREATE_VISIT, {
            "id": visit.id,
            "event_id": visit.event_id,
            "station_id": visit.station_id,
            "patrol_id": visit.patrol_id,
            "checked_in_at": visit.checked_in_at,
            "checked_out_at": visit.checked_out_at,
            "tasks_started_at": visit.tasks_started_at,
            "tasks_completed_at": visit.tasks_completed_at,
            "entry_mode": visit.entry_mode or "live",
        })
        return visit

    async def update(self, visit: StationVisit) -> StationVisit:
        await self.driver.execute(UPDATE_VISIT, {
            "id": visit.id,
            "checked_in_at": visit.checked_in_at,
            "checked_out_at": visit.checked_out_at,
            "tasks_started_at": visit.tasks_started_at,
            "tasks_completed_at": visit.tasks_completed_at,
            "entry_mode": visit.entry_mode or "live",
        })
        return visit
