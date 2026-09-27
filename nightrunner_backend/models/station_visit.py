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
    status: str = "checked_in"
    unlocked_by: Optional[str] = None
    comments: Optional[str] = None
    created_at: Optional[str] = None

    def to_api_dict(self) -> Dict[str, Any]:
        def fmt_dt(val: Any) -> Optional[str]:
            if val is None:
                return None
            if hasattr(val, "isoformat"):
                val = val.isoformat()
            else:
                val = str(val)
            if val and not val.endswith("Z") and "+" not in val and "-" not in val[10:]:
                val = val.replace(" ", "T") + "Z"
            return val

        return {
            "id": self.id,
            "eventId": self.event_id,
            "stationId": self.station_id,
            "patrolId": self.patrol_id,
            "checkedInAt": fmt_dt(self.checked_in_at),
            "checkedOutAt": fmt_dt(self.checked_out_at),
            "tasksStartedAt": fmt_dt(self.tasks_started_at),
            "tasksCompletedAt": fmt_dt(self.tasks_completed_at),
            "entryMode": self.entry_mode,
            "status": self.status,
            "unlockedBy": self.unlocked_by,
            "comments": self.comments,
            "createdAt": fmt_dt(self.created_at),
        }

