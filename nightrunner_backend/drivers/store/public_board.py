"""Narrow reads for the public (token-authenticated) pages.

Deliberately separate from PatrolsStore and StationsStore. Those return the full
record, and `patrols` carries `phone_number`, `radio_frequency`, `radio_channel`
and `radio_identifier` while `patrol_members` carries youth names. Rather than
fetch all that and trust a serializer to drop it, every query here names its
columns, so the sensitive ones are never read in the first place.

If you add a column to one of these SELECTs, check tests/transport/test_public_
progress.py — it asserts on the absence of those fields specifically so that a
widening shows up as a failure rather than as a quiet leak.
"""

from typing import Any, Dict, List, Optional

from nightrunner_backend.drivers.base import DatabaseDriver


def _fmt_dt(val: Any) -> Optional[str]:
    """Render a timestamp column as a string for JSON.

    `station_visits.checked_in_at` and friends are TIMESTAMP columns. SQLite
    hands them back as strings, PostgreSQL as `datetime` objects, and a
    `datetime` is not JSON serialisable — so on PostgreSQL, serialising one of
    these rows raw fails the whole request. The public pages read visits, so
    this took both of them down as soon as an event had its first check-in
    while an empty visit list had looked fine.

    Mirrors `StationVisit.to_api_dict`, which formats the same columns for the
    authenticated routes.
    """
    if val is None:
        return None
    if hasattr(val, "isoformat"):
        val = val.isoformat()
    else:
        val = str(val)
    if val and not val.endswith("Z") and "+" not in val and "-" not in val[10:]:
        val = val.replace(" ", "T") + "Z"
    return val

# `theme` drives the public pages' colours, so a spectator sees the same
# palette as the event rather than whatever their browser last stored.
GET_EVENT_PUBLIC = (
    "SELECT id, name, date, COALESCE(theme, 'night-ops') AS theme "
    "FROM events WHERE id = :event_id"
)

# No description: station descriptions are written for volunteers and can carry
# answers or staging notes.
LIST_STATIONS_PUBLIC = """
    SELECT id, name
    FROM stations
    WHERE event_id = :event_id
    ORDER BY name ASC
"""

LIST_PATROLS_PUBLIC = """
    SELECT id, number, name
    FROM patrols
    WHERE event_id = :event_id
    ORDER BY number ASC, name ASC
"""

# Troop is recorded per member, not per patrol, so a patrol's troops have to be
# derived. Patrols are commonly mixed, so this returns every distinct code.
# Selecting only patrol_id and troop keeps member names out of the result set
# entirely.
LIST_PATROL_TROOPS_PUBLIC = """
    SELECT pm.patrol_id AS patrol_id, pm.troop AS troop
    FROM patrol_members pm
    JOIN patrols p ON p.id = pm.patrol_id
    WHERE p.event_id = :event_id
      AND pm.troop IS NOT NULL
      AND pm.troop <> ''
    GROUP BY pm.patrol_id, pm.troop
    ORDER BY pm.troop ASC
"""

LIST_VISITS_PUBLIC = """
    SELECT station_id, patrol_id, status, checked_in_at, checked_out_at, tasks_completed_at
    FROM station_visits
    WHERE event_id = :event_id
    ORDER BY created_at ASC
"""


class PublicBoardStore:
    def __init__(self, driver: DatabaseDriver):
        self.driver = driver

    async def get_event(self, event_id: str) -> Dict[str, Any]:
        row = await self.driver.fetch_one(GET_EVENT_PUBLIC, {"event_id": event_id})
        if not row:
            return {}
        return {
            "id": row["id"],
            "name": row["name"],
            "date": row.get("date"),
            "theme": row.get("theme") or "night-ops",
        }

    async def list_stations(self, event_id: str) -> List[Dict[str, Any]]:
        rows = await self.driver.execute(LIST_STATIONS_PUBLIC, {"event_id": event_id})
        return [{"id": r["id"], "name": r["name"]} for r in rows]

    async def list_patrols(self, event_id: str) -> List[Dict[str, Any]]:
        """Patrols with their troop codes attached.

        Two queries rather than a join with string aggregation, because the
        aggregation functions differ between SQLite and PostgreSQL and this runs
        on both.
        """
        rows = await self.driver.execute(LIST_PATROLS_PUBLIC, {"event_id": event_id})
        troop_rows = await self.driver.execute(LIST_PATROL_TROOPS_PUBLIC, {"event_id": event_id})

        troops_by_patrol: Dict[str, List[str]] = {}
        for row in troop_rows:
            troops_by_patrol.setdefault(row["patrol_id"], []).append(row["troop"])

        return [
            {
                "id": r["id"],
                "number": r.get("number"),
                "name": r["name"],
                "troops": troops_by_patrol.get(r["id"], []),
            }
            for r in rows
        ]

    async def list_visits(self, event_id: str) -> List[Dict[str, Any]]:
        rows = await self.driver.execute(LIST_VISITS_PUBLIC, {"event_id": event_id})
        return [
            {
                "stationId": r["station_id"],
                "patrolId": r["patrol_id"],
                "status": r.get("status") or "checked_in",
                "checkedInAt": _fmt_dt(r.get("checked_in_at")),
                "checkedOutAt": _fmt_dt(r.get("checked_out_at")),
                "tasksCompletedAt": _fmt_dt(r.get("tasks_completed_at")),
            }
            for r in rows
        ]

    async def station_belongs_to_event(self, station_id: str, event_id: str) -> bool:
        row = await self.driver.fetch_one(
            "SELECT id FROM stations WHERE id = :id AND event_id = :event_id",
            {"id": station_id, "event_id": event_id},
        )
        return bool(row)

    async def patrol_belongs_to_event(self, patrol_id: str, event_id: str) -> bool:
        row = await self.driver.fetch_one(
            "SELECT id FROM patrols WHERE id = :id AND event_id = :event_id",
            {"id": patrol_id, "event_id": event_id},
        )
        return bool(row)
