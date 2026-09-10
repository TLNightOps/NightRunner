from dataclasses import dataclass, field
from typing import Any, Dict, Optional
import uuid6


@dataclass
class StationVisit:
    """Represents a patrol's check-in/out visit at a station."""
    id: str = field(default_factory=lambda: str(uuid6.uuid7()))
    event_id: str = ""
    station_id: str = ""
    patrol_id: str = ""
    checked_in_at: Optional[str] = None
    checked_out_at: Optional[str] = None
    tasks_started_at: Optional[str] = None
    tasks_completed_at: Optional[str] = None
    entry_mode: str = "live"
    created_at: Optional[str] = None

    def to_api_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "eventId": self.event_id,
            "stationId": self.station_id,
            "patrolId": self.patrol_id,
            "checkedInAt": self.checked_in_at,
            "checkedOutAt": self.checked_out_at,
            "tasksStartedAt": self.tasks_started_at,
            "tasksCompletedAt": self.tasks_completed_at,
            "entryMode": self.entry_mode,
            "createdAt": self.created_at,
        }
