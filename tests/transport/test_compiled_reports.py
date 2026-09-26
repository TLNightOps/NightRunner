import asyncio
import pytest
import falcon
from unittest.mock import patch, AsyncMock
import falcon.testing
from nightrunner_backend.main import app, register_routes


@pytest.fixture
async def test_client():
    register_routes(app)
    async with falcon.testing.ASGITestClient(app) as client:
        yield client


@pytest.mark.asyncio
async def test_compiled_reports_workflow(test_client, token_factory):
    headers = token_factory()

    # 1. Trigger first async report job creation
    resp1 = await test_client.simulate_post(
        "/v1/events/evt-123/compiled-reports",
        json={"reportType": "patrols-pdf"},
        headers=headers,
    )
    assert resp1.status == falcon.HTTP_202
    data1 = resp1.json
    report_id1 = data1["id"]
    assert data1["status"] == "generating"

    # 2. Trigger second async report job creation of the SAME type
    await asyncio.sleep(0.01)
    resp2 = await test_client.simulate_post(
        "/v1/events/evt-123/compiled-reports",
        json={"reportType": "patrols-pdf"},
        headers=headers,
    )
    assert resp2.status == falcon.HTTP_202
    data2 = resp2.json
    report_id2 = data2["id"]
    assert report_id1 != report_id2

    # 3. List compiled reports for the event - both versions should coexist, newest first
    list_resp = await test_client.simulate_get(
        "/v1/events/evt-123/compiled-reports",
        headers=headers,
    )
    assert list_resp.status == falcon.HTTP_200
    reports = list_resp.json["reports"]
    assert len(reports) >= 2
    report_ids = [r["id"] for r in reports]
    assert report_id2 in report_ids
    assert report_id1 in report_ids
    # Verify newest report (report_id2) appears BEFORE older report (report_id1)
    assert report_ids.index(report_id2) < report_ids.index(report_id1)

    # 4. Clean up / Delete compiled reports
    await test_client.simulate_delete(f"/v1/compiled-reports/{report_id1}", headers=headers)
    await test_client.simulate_delete(f"/v1/compiled-reports/{report_id2}", headers=headers)


@pytest.mark.asyncio
async def test_compiled_scoring_reports_workflow(test_client, token_factory):
    headers = token_factory()

    # 1. Trigger draft scoring PDF creation
    resp_draft = await test_client.simulate_post(
        "/v1/events/evt-123/compiled-reports",
        json={"reportType": "event-scoring-draft"},
        headers=headers,
    )
    assert resp_draft.status == falcon.HTTP_202
    draft_job = resp_draft.json
    assert draft_job["report_type"] == "event-scoring-draft"

    # 2. Trigger final scoring PDF creation
    resp_final = await test_client.simulate_post(
        "/v1/events/evt-123/compiled-reports",
        json={"reportType": "event-scoring"},
        headers=headers,
    )
    assert resp_final.status == falcon.HTTP_202
    final_job = resp_final.json
    assert final_job["report_type"] == "event-scoring"

    # 3. Trigger ODS spreadsheet creation
    resp_ods = await test_client.simulate_post(
        "/v1/events/evt-123/compiled-reports",
        json={"reportType": "event-scoring-ods"},
        headers=headers,
    )
    assert resp_ods.status == falcon.HTTP_202
    ods_job = resp_ods.json
    assert ods_job["report_type"] == "event-scoring-ods"

    # Wait briefly for background tasks
    await asyncio.sleep(1.5)

    # 4. The background jobs must actually succeed, not just be accepted.
    # A 202 only means the job was queued; generation failures are swallowed
    # into a "failed" status, so assert on the final status of each report.
    list_resp = await test_client.simulate_get(
        "/v1/events/evt-123/compiled-reports",
        headers=headers,
    )
    assert list_resp.status == falcon.HTTP_200
    by_id = {r["id"]: r for r in list_resp.json["reports"]}
    for job in (draft_job, final_job, ods_job):
        report = by_id[job["id"]]
        assert report["status"] == "ready", (
            f"{job['report_type']} generation failed: {report.get('error_message')}"
        )
        assert report["size_bytes"] > 0

    # 5. Clean up
    await test_client.simulate_delete(f"/v1/compiled-reports/{draft_job['id']}", headers=headers)
    await test_client.simulate_delete(f"/v1/compiled-reports/{final_job['id']}", headers=headers)
    await test_client.simulate_delete(f"/v1/compiled-reports/{ods_job['id']}", headers=headers)




@pytest.mark.parametrize("name, event_name, ext, expected", [
    ("Troop Results — GA 0594 (Fall Camporee 2026)", "Fall Camporee 2026", "pdf",
     "Fall-Camporee-2026_Troop-Results_GA-0594.pdf"),
    ("Final Scoring Report (Fall Camporee 2026)", "Fall Camporee 2026", "pdf",
     "Fall-Camporee-2026_Final-Scoring-Report.pdf"),
    ("Scoring Spreadsheet ODS (Fall Camporee 2026)", "Fall Camporee 2026", "ods",
     "Fall-Camporee-2026_Scoring-Spreadsheet-ODS.ods"),
    # Event name containing parentheses is still stripped exactly.
    ("Patrol QR Badges (Night Ops (Spring))", "Night Ops (Spring)", "pdf",
     "Night-Ops-Spring_Patrol-QR-Badges.pdf"),
    # Event renamed after generation: old name dropped, current name leads.
    ("Event Attendance Report (Old Name)", "New Name", "pdf",
     "New-Name_Event-Attendance-Report.pdf"),
    # Accents and quotes are made filename-safe.
    ('Final Scoring Report (Café "Night" Run)', 'Café "Night" Run', "pdf",
     "Cafe-Night-Run_Final-Scoring-Report.pdf"),
    # Nothing usable falls back to the report id.
    ("", "", "pdf", "rep-abc.pdf"),
])
def test_report_download_filename(name, event_name, ext, expected):
    from nightrunner_backend.transport.compiled_reports import report_download_filename
    assert report_download_filename({"id": "rep-abc", "name": name}, event_name, ext) == expected


@pytest.mark.asyncio
async def test_download_uses_readable_filename(test_client, token_factory):
    headers = token_factory()
    report = {
        "id": "rep-abc", "event_id": "evt-123", "status": "ready",
        "name": "Final Scoring Report (Fall Camporee)", "file_key": "k.pdf",
        "content_type": "application/pdf",
    }
    event = type("E", (), {"name": "Fall Camporee"})()
    mod = "nightrunner_backend.transport.compiled_reports"
    with patch(f"{mod}.ReportsStore.get_report", AsyncMock(return_value=report)), \
         patch(f"{mod}.EventsStore.get", AsyncMock(return_value=event)), \
         patch(f"{mod}.download_report_bytes", return_value=b"%PDF-1.4"):
        resp = await test_client.simulate_get("/v1/compiled-reports/rep-abc/download", headers=headers)
    assert resp.status == falcon.HTTP_200
    assert resp.headers["content-disposition"] == 'inline; filename="Fall-Camporee_Final-Scoring-Report.pdf"'
