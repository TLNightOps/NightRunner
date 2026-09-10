import {
    useEffect,
    useMemo,
    useState
} from "react";

import ApiService from "@/api/ApiService.js";
import { useEventContext } from "@/api/helpers/event/EventContext.jsx";

import "./reports.css";

export default function Reports() {

    const {
        event,
        eventId,
        loading: eventLoading,
        error: eventError,
        isSystemAdmin
    } = useEventContext();

    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {

        if (!eventId) {
            setReport(null);
            return;
        }

        loadReport();

    }, [eventId]);


    async function loadReport() {

        if (!eventId) {
            return;
        }

        try {

            setLoading(true);
            setError(null);

            const response =
                await ApiService.reportData
                    .getEventReport(eventId);

            const loadedReport =
                response?.report ??
                response;

            setReport(
                loadedReport
            );

        }
        catch (error) {

            console.error(
                "Failed to load event report:",
                error
            );

            setReport(null);

            setError(
                error?.message ??
                "Unable to load the event report."
            );

        }
        finally {

            setLoading(false);

        }

    }


    function handlePrint() {

        if (!eventId || !report) {
            return;
        }

        const url =
            `/reports/print?eventId=${encodeURIComponent(
                eventId
            )}`;

        window.open(
            url,
            "_blank",
            "noopener,noreferrer"
        );

    }


    function formatDate(date) {

        if (!date) {
            return "—";
        }

        const parsed =
            new Date(date);

        if (Number.isNaN(
            parsed.getTime()
        )) {
            return "—";
        }

        return parsed.toLocaleDateString(
            undefined,
            {
                year: "numeric",
                month: "long",
                day: "numeric"
            }
        );

    }


    function formatDateTime(date) {

        if (!date) {
            return "—";
        }

        const parsed =
            new Date(date);

        if (Number.isNaN(
            parsed.getTime()
        )) {
            return "—";
        }

        return parsed.toLocaleString(
            undefined,
            {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
            }
        );

    }


    const stations = useMemo(() => {

        const stationMap =
            new Map();

        for (
            const patrol
            of report?.patrolScores ?? []
            ) {

            for (
                const station
                of patrol.stationBreakdown ?? []
                ) {

                if (!station?.stationId) {
                    continue;
                }

                if (!stationMap.has(
                    station.stationId
                )) {

                    stationMap.set(
                        station.stationId,
                        {
                            stationId:
                            station.stationId,
                            stationName:
                                station.stationName ??
                                "Unnamed Station"
                        }
                    );

                }

            }

        }

        return Array.from(
            stationMap.values()
        );

    }, [report]);


    const patrols = useMemo(() => {

        return [
            ...(report?.patrolScores ?? [])
        ].sort(
            (a, b) => {

                const rankA =
                    Number.isFinite(
                        Number(a.rank)
                    )
                        ? Number(a.rank)
                        : Number.MAX_SAFE_INTEGER;

                const rankB =
                    Number.isFinite(
                        Number(b.rank)
                    )
                        ? Number(b.rank)
                        : Number.MAX_SAFE_INTEGER;

                if (rankA !== rankB) {
                    return rankA - rankB;
                }

                return String(
                    a.patrolName ?? ""
                ).localeCompare(
                    String(
                        b.patrolName ?? ""
                    )
                );

            }
        );

    }, [report]);


    const winner =
        patrols[0] ?? null;


    if (eventLoading) {

        return (
            <div className="reports-page">

                <div className="reports-state">

                    <div className="reports-state-title">
                        Loading event
                    </div>

                    <div className="reports-state-text">
                        Preparing the report...
                    </div>

                </div>

            </div>
        );

    }


    if (eventError) {

        return (
            <div className="reports-page">

                <div className="reports-state reports-state--error">

                    <div className="reports-state-title">
                        Unable to load event
                    </div>

                    <div className="reports-state-text">
                        {eventError}
                    </div>

                </div>

            </div>
        );

    }


    if (!eventId) {

        return (
            <div className="reports-page">

                <div className="reports-state">

                    <div className="reports-state-title">
                        No Event Selected
                    </div>

                    <div className="reports-state-text">
                        {isSystemAdmin
                            ? "Select an event to view its report."
                            : "There is no event currently selected."
                        }
                    </div>

                </div>

            </div>
        );

    }


    return (
        <div className="reports-page">

            <div className="reports-page-header">

                <div>

                    <div className="reports-page-eyebrow">
                        Administration
                    </div>

                    <h1>
                        Reports
                    </h1>

                    <p>
                        View final event results and
                        print the complete scoring sheet.
                    </p>

                </div>


                <div className="reports-page-actions">

                    <button
                        type="button"
                        className="reports-button"
                        onClick={loadReport}
                        disabled={loading}
                    >
                        {loading
                            ? "Refreshing..."
                            : "Refresh"
                        }
                    </button>


                    <button
                        type="button"
                        className="reports-button reports-button--primary"
                        onClick={handlePrint}
                        disabled={
                            loading ||
                            !report
                        }
                    >
                        Print Report
                    </button>

                </div>

            </div>


            {error && (

                <div className="reports-alert">

                    <strong>
                        Unable to load report
                    </strong>

                    <span>
                        {error}
                    </span>

                </div>

            )}


            {loading && !report && (

                <div className="reports-state">

                    <div className="reports-state-title">
                        Loading report
                    </div>

                    <div className="reports-state-text">
                        Calculating final results...
                    </div>

                </div>

            )}


            {!loading &&
                !error &&
                !report && (

                    <div className="reports-state">

                        <div className="reports-state-title">
                            No Report Available
                        </div>

                        <div className="reports-state-text">
                            There are currently no report
                            results for this event.
                        </div>

                    </div>

                )
            }


            {report && (

                <main className="report-document">

                    <header className="report-document-header">

                        <div className="report-document-heading">

                            <div className="report-document-brand">
                                Night Runner
                            </div>

                            <h1>
                                {report.eventName ??
                                    event?.name ??
                                    "Event Report"
                                }
                            </h1>

                            <div className="report-document-title">
                                Final Scoring Report
                            </div>

                        </div>


                        <div className="report-document-meta">

                            <div className="report-meta-item">

                                <span>
                                    Event Date
                                </span>

                                <strong>
                                    {formatDate(
                                        event?.date
                                    )}
                                </strong>

                            </div>


                            <div className="report-meta-item">

                                <span>
                                    Generated
                                </span>

                                <strong>
                                    {formatDateTime(
                                        report.generatedAt
                                    )}
                                </strong>

                            </div>

                        </div>

                    </header>


                    <section className="report-summary">

                        <div className="report-summary-card">

                            <span>
                                Patrols
                            </span>

                            <strong>
                                {report.summary
                                        ?.totalPatrols ??
                                    patrols.length
                                }
                            </strong>

                        </div>


                        <div className="report-summary-card">

                            <span>
                                Stations
                            </span>

                            <strong>
                                {report.summary
                                        ?.totalStations ??
                                    stations.length
                                }
                            </strong>

                        </div>


                        <div className="report-summary-card">

                            <span>
                                Winning Patrol
                            </span>

                            <strong className="report-summary-card-name">
                                {winner?.patrolName ??
                                    "—"
                                }
                            </strong>

                        </div>


                        <div className="report-summary-card">

                            <span>
                                Highest Score
                            </span>

                            <strong>
                                {winner?.totalScore ??
                                    0
                                }
                            </strong>

                        </div>

                    </section>


                    <section className="report-results-section">

                        <div className="report-section-heading">

                            <div>

                                <div className="report-section-eyebrow">
                                    Final Results
                                </div>

                                <h2>
                                    Patrol Standings
                                </h2>

                                <p>
                                    Patrols are listed by final
                                    placement. Each station column
                                    shows the patrol's score at that
                                    station.
                                </p>

                            </div>

                        </div>


                        {patrols.length === 0 ? (

                            <div className="report-empty-section">
                                No patrol scores are available.
                            </div>

                        ) : (

                            <div className="report-table-wrapper">

                                <table className="report-matrix">

                                    <thead>

                                    <tr>

                                        <th className="report-place">
                                            Place
                                        </th>

                                        <th className="report-patrol">
                                            Patrol
                                        </th>

                                        {stations.map(
                                            station => (

                                                <th
                                                    key={
                                                        station.stationId
                                                    }
                                                    className="report-station"
                                                >
                                                    <span>
                                                        {station.stationName}
                                                    </span>
                                                </th>

                                            )
                                        )}

                                        <th className="report-final">
                                            Final Score
                                        </th>

                                    </tr>

                                    </thead>


                                    <tbody>

                                    {patrols.map(
                                        patrol => {

                                            const scores =
                                                new Map(
                                                    (
                                                        patrol.stationBreakdown ??
                                                        []
                                                    ).map(
                                                        station => [
                                                            station.stationId,
                                                            station.score
                                                        ]
                                                    )
                                                );

                                            const isFirst =
                                                Number(
                                                    patrol.rank
                                                ) === 1;

                                            return (

                                                <tr
                                                    key={
                                                        patrol.patrolId
                                                    }
                                                    className={
                                                        isFirst
                                                            ? "report-row--winner"
                                                            : ""
                                                    }
                                                >

                                                    <td className="report-place">

                                                        <span className="report-place-number">
                                                            {patrol.rank ??
                                                                "—"
                                                            }
                                                        </span>

                                                    </td>


                                                    <td className="report-patrol">

                                                        <strong>
                                                            {patrol.patrolName ??
                                                                "Unnamed Patrol"
                                                            }
                                                        </strong>

                                                    </td>


                                                    {stations.map(
                                                        station => {

                                                            const score =
                                                                scores.get(
                                                                    station.stationId
                                                                );

                                                            return (

                                                                <td
                                                                    key={
                                                                        station.stationId
                                                                    }
                                                                    className="report-score-cell"
                                                                >
                                                                    {score ??
                                                                        0
                                                                    }
                                                                </td>

                                                            );

                                                        }
                                                    )}


                                                    <td className="report-final">

                                                        <strong>
                                                            {patrol.totalScore ??
                                                                0
                                                            }
                                                        </strong>

                                                    </td>

                                                </tr>

                                            );

                                        }
                                    )}

                                    </tbody>

                                </table>

                            </div>

                        )}

                    </section>


                    <section className="report-results-section">

                        <div className="report-section-heading">

                            <div>

                                <div className="report-section-eyebrow">
                                    Tie-Breaking & Adjustments
                                </div>

                                <h2>
                                    Scoring Adjustments
                                </h2>

                                <p>
                                    Adjust task active status or task weights on recorded scores to resolve ties or fine-tune event scoring.
                                </p>

                            </div>

                        </div>

                        <div className="report-empty-section" style={{ textAlign: "left" }}>
                            <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>
                                In the event of a tie, the scoring team can modify task weights or toggle task inclusion (active flag) per station.
                            </p>
                            <small>Use Station Reports to inspect detailed task score breakdowns per patrol and apply targeted score adjustment patches (`PATCH /v1/scores/:id`).</small>
                        </div>

                    </section>


                    <footer className="report-document-footer">

                        <span>
                            Night Runner
                        </span>

                        <span>
                            {report.eventName ??
                                event?.name ??
                                "Event Report"
                            }
                        </span>

                        <span>
                            Generated{" "}
                            {formatDateTime(
                                report.generatedAt
                            )}
                        </span>

                    </footer>

                </main>

            )}

        </div>
    );

}