from typing import Any, Optional

import falcon
from nightrunner_backend.app_context import get_driver
from nightrunner_backend.drivers.store.scores import ScoresStore
from nightrunner_backend.models.score import Score
from nightrunner_backend.models.user_roles import SCORING_ROLES
from nightrunner_backend.transport.permissions import require_event_role


def _require_scoring_team(req: falcon.Request, event_id):
    """Scores are entered, corrected and finalized by the scoring team."""
    return require_event_role(
        req, event_id, SCORING_ROLES,
        title="Scoring Team Required",
        description="Only the scoring team, event admins and system admins can change scores.",
    )


def _extract_submitted_text(val: Any) -> Optional[str]:
    """Helper to extract raw submitted text response from a scoreValue parameter."""
    if val is None:
        return None
    if isinstance(val, str):
        return val
    if isinstance(val, dict):
        if "submittedText" in val:
            return str(val["submittedText"])
        if "reason" in val:
            return str(val["reason"])
    return None


def _extract_participant_count(val: Any) -> int:
    """Helper to extract participant count from a scoreValue parameter."""
    if isinstance(val, dict):
        if "participantCount" in val:
            try:
                cnt = int(val["participantCount"])
                return cnt if cnt > 0 else 1
            except Exception:
                return 1
    return 1


def _parse_numeric_score_value(val: Any) -> float:
    """Helper to convert complex task score values into a float.
    Handles dicts (stopwatch timestamps / elapsedSeconds / rawValue & participantCount), booleans, numeric strings, and text inputs.
    """
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, bool):
        return 1.0 if val else 0.0
    if isinstance(val, dict):
        if "disqualified" in val:
            if val.get("disqualified"):
                return 0.0
            return 1.0
        if "calculatedScore" in val and isinstance(val["calculatedScore"], (int, float)):
            return float(val["calculatedScore"])
        if "rawValue" in val:
            return _parse_numeric_score_value(val["rawValue"])
        if "elapsedSeconds" in val and isinstance(val["elapsedSeconds"], (int, float)):
            return float(val["elapsedSeconds"])
        if "startTime" in val and "endTime" in val:
            try:
                from datetime import datetime
                st = datetime.fromisoformat(str(val["startTime"]).replace("Z", "+00:00"))
                et = datetime.fromisoformat(str(val["endTime"]).replace("Z", "+00:00"))
                return (et - st).total_seconds()
            except Exception:
                return 0.0
        return 0.0
    if isinstance(val, str):
        try:
            return float(val)
        except ValueError:
            return 1.0 if val.strip() else 0.0
    return 0.0


class ScoresResource:
    """POST /v1/scores — submit scores for a patrol at a station.

    Expected payload::

        {
            "eventId":   "<str>",
            "stationId": "<str>",
            "patrolId":  "<str>",
            "scores": [
                {"taskId": "<str>", "scoreValue": <float|dict|bool|str>, "scoreWeight": <float>, "active": <bool>},
                ...
            ]
        }
    """

    async def on_get(self, req: falcon.Request, resp: falcon.Response):
        store = ScoresStore(get_driver())
        event_id = req.get_param("eventId")
        station_id = req.get_param("stationId")
        patrol_id = req.get_param("patrolId")

        if event_id and station_id and patrol_id:
            scores = await store.get_active_scores_for_patrol_station(event_id, station_id, patrol_id)
            resp.status = falcon.HTTP_200
            last_scored_at = scores[0].submitted_at if scores else None
            if hasattr(last_scored_at, "isoformat"):
                last_scored_at = last_scored_at.isoformat()
            resp.media = {
                "scores": [s.to_dict() for s in scores],
                "isAlreadyScored": len(scores) > 0,
                "lastScoredAt": last_scored_at
            }
            return

        if event_id:
            scores = await store.list_for_event(event_id)
            resp.status = falcon.HTTP_200
            resp.media = [s.to_dict() for s in scores]
            return

        raise falcon.HTTPBadRequest(description="'eventId' query parameter is required.")

    async def on_post(self, req: falcon.Request, resp: falcon.Response):
        store = ScoresStore(get_driver())
        payload = await req.get_media()

        if not isinstance(payload, dict):
            raise falcon.HTTPBadRequest(description="Request body must be a JSON object.")

        _require_scoring_team(req, payload.get("eventId"))

        if payload.get("action") == "deactivate":
            event_id = payload.get("eventId")
            station_id = payload.get("stationId")
            patrol_id = payload.get("patrolId")
            if not event_id or not station_id or not patrol_id:
                raise falcon.HTTPBadRequest(description="'eventId', 'stationId', and 'patrolId' are required to deactivate scores.")
            await store.deactivate_all_active_scores_for_patrol_station(event_id, station_id, patrol_id)
            resp.status = falcon.HTTP_200
            resp.media = {"status": "deactivated"}
            return

        event_id = payload.get("eventId")
        station_id = payload.get("stationId")
        patrol_id = payload.get("patrolId")

        if not event_id:
            raise falcon.HTTPBadRequest(description="'eventId' is required.")
        if not station_id:
            raise falcon.HTTPBadRequest(description="'stationId' is required.")
        if not patrol_id:
            raise falcon.HTTPBadRequest(description="'patrolId' is required.")

        scores_data = payload.get("scores", [])
        if not isinstance(scores_data, list):
            raise falcon.HTTPBadRequest(description="'scores' must be a list.")

        created = []
        for s in scores_data:
            task_id = s.get("taskId")
            raw_score_value = s.get("scoreValue")
            if task_id is None or raw_score_value is None:
                raise falcon.HTTPBadRequest(
                    description="Each score entry must include 'taskId' and 'scoreValue'."
                )
            score = Score(
                event_id=event_id,
                station_id=station_id,
                patrol_id=patrol_id,
                task_id=task_id,
                score_value=_parse_numeric_score_value(raw_score_value),
                score_weight=float(s.get("scoreWeight", 1.0)),
                active=bool(s.get("active", True)),
                started_at=s.get("startedAt") or payload.get("startedAt"),
                completed_at=s.get("completedAt") or payload.get("completedAt"),
                entry_mode=payload.get("entryMode", "live"),
                submitted_text=_extract_submitted_text(raw_score_value),
                participant_count=_extract_participant_count(raw_score_value),
            )
            # Deactivate previous active score for this same task to avoid double counting while preserving history
            await store.deactivate_previous_scores(event_id, station_id, patrol_id, task_id)
            await store.create(score)
            created.append({"id": score.id})

        # Mark station visit as completed & automatically check out patrol
        from nightrunner_backend.drivers.store.station_visits import StationVisitsStore
        from nightrunner_backend.models.station_visit import StationVisit
        import uuid6
        visit_store = StationVisitsStore(get_driver())
        active_visit = await visit_store.get_active_visit(event_id, station_id, patrol_id)
        if not active_visit:
            active_visit = await visit_store.get_latest_visit(event_id, station_id, patrol_id)
        
        comp_at = payload.get("completedAt") or payload.get("timestamp")
        start_at = payload.get("startedAt") or comp_at
        submission_comments = payload.get("comments")

        if active_visit:
            active_visit.status = "completed"
            active_visit.tasks_completed_at = comp_at or active_visit.tasks_completed_at
            if submission_comments:
                active_visit.comments = submission_comments
            if not active_visit.checked_in_at:
                active_visit.checked_in_at = start_at or comp_at
            if not active_visit.checked_out_at:
                active_visit.checked_out_at = comp_at or active_visit.checked_out_at
            await visit_store.update(active_visit)
        else:
            # Create a synthetic visit for direct/offline paper scoring submissions
            new_visit = StationVisit(
                id=str(uuid6.uuid7()),
                event_id=event_id,
                station_id=station_id,
                patrol_id=patrol_id,
                checked_in_at=start_at or comp_at,
                checked_out_at=comp_at,
                tasks_started_at=start_at,
                tasks_completed_at=comp_at,
                entry_mode=payload.get("entryMode", "live"),
                status="completed",
                comments=submission_comments
            )
            await visit_store.create(new_visit)

        resp.status = falcon.HTTP_201
        resp.media = {"created": created}



class ScoreResource:
    """PATCH /v1/scores/{scoreId} — adjust active status or scoreWeight for tie-breaking."""

    async def on_patch(self, req: falcon.Request, resp: falcon.Response, scoreId: str):
        store = ScoresStore(get_driver())
        existing = await store.get(scoreId)
        if not existing:
            raise falcon.HTTPNotFound()
        _require_scoring_team(req, existing.event_id)

        payload = await req.get_media()
        if not isinstance(payload, dict):
            raise falcon.HTTPBadRequest(description="Request body must be a JSON object.")

        fields = {}
        if "active" in payload:
            fields["active"] = 1 if payload["active"] else 0
        if "scoreWeight" in payload:
            fields["score_weight"] = float(payload["scoreWeight"])
        if "scoreValue" in payload:
            fields["score_value"] = float(payload["scoreValue"])

        if fields:
            updated = await store.update(scoreId, **fields)
            resp.media = updated.to_dict()
        else:
            resp.media = existing.to_dict()

        resp.status = falcon.HTTP_200


class FinalizedResultsResource:
    """GET/POST /v1/scores/finalized?eventId={eventId}
    Get or save finalized calculation results for an event.
    """

    async def on_get(self, req: falcon.Request, resp: falcon.Response):
        event_id = req.get_param("eventId")
        if not event_id:
            raise falcon.HTTPBadRequest(description="eventId query parameter is required.")
        store = ScoresStore(get_driver())
        results = await store.list_finalized_results(event_id)
        resp.status = falcon.HTTP_200
        resp.media = results

    async def on_post(self, req: falcon.Request, resp: falcon.Response):
        store = ScoresStore(get_driver())
        payload = await req.get_media()
        if not isinstance(payload, dict):
            raise falcon.HTTPBadRequest(description="Request body must be a JSON object.")
        event_id = payload.get("eventId")
        _require_scoring_team(req, event_id)
        results = payload.get("results")
        if not event_id or not isinstance(results, list):
            raise falcon.HTTPBadRequest(description="eventId string and results list are required.")
        await store.save_finalized_results(event_id, results)
        resp.status = falcon.HTTP_200
        resp.media = {"status": "saved", "count": len(results)}

