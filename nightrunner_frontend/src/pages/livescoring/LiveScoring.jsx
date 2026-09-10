import {
    useEffect,
    useRef,
    useState
} from "react";

import {
    useEventContext
} from "../../api/helpers/event/EventContext.jsx";

import { getLiveScoring } from "./LiveScoringService";

import "./LiveScoring.css";

export default function LiveScoring() {
    const {
        event,
        eventId,
        loading: eventLoading,
        error: eventError
    } = useEventContext();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [displayMode, setDisplayMode] = useState("fit");
    const [refreshInterval, setRefreshInterval] = useState(15000);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const tableWrapperRef = useRef(null);

    const loadData = async (isManual = false) => {
        if (!eventId) return;
        if (isManual) setIsRefreshing(true);

        try {
            const response = await getLiveScoring(eventId);
            setData(response);
            setError(null);
            setLastUpdated(new Date());
        } catch (err) {
            console.error("Failed to load live scoring:", err);
            setError(err?.message ?? "Unable to load live scoring.");
        } finally {
            setLoading(false);
            if (isManual) setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (eventLoading) return;

        if (eventError) {
            setError(eventError);
            setLoading(false);
            return;
        }

        if (!eventId) {
            setError("No event is currently selected.");
            setLoading(false);
            return;
        }

        setLoading(true);
        loadData();

        if (refreshInterval > 0) {
            const timer = setInterval(() => loadData(false), refreshInterval);
            return () => clearInterval(timer);
        }
    }, [eventId, eventLoading, eventError, refreshInterval]);

    useEffect(() => {
        if (displayMode !== "auto") return;

        const wrapper = tableWrapperRef.current;
        if (!wrapper) return;

        let animationId;
        const speed = 30;
        let lastTime = performance.now();

        function animate(time) {
            const delta = (time - lastTime) / 1000;
            lastTime = time;
            wrapper.scrollTop += speed * delta;

            const halfway = wrapper.scrollHeight / 2;
            if (halfway > 0 && wrapper.scrollTop >= halfway) {
                wrapper.scrollTop -= halfway;
            }
            animationId = requestAnimationFrame(animate);
        }

        animationId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationId);
    }, [displayMode, data]);

    if (eventLoading || loading) {
        return <p>Loading live scoring...</p>;
    }

    if (error) {
        return (
            <div className="live-scoring-container">
                <div className="live-scoring-page">
                    <div className="error-banner">{error}</div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="live-scoring-container">
                <div className="live-scoring-page">
                    <div className="error-banner">No live scoring data available.</div>
                </div>
            </div>
        );
    }

    // Build lookup maps for scoring reports and check-in status
    const scoredMap = {};
    if (data.scoresReport?.patrols) {
        for (const p of data.scoresReport.patrols) {
            const pid = p.patrolId || p.id;
            if (p.stationTotals) {
                scoredMap[pid] = {};
                for (const stId of Object.keys(p.stationTotals)) {
                    scoredMap[pid][stId] = true;
                }
            }
        }
    }

    const patrolsToMap =
        data.patrols.length > 10 && displayMode === "auto"
            ? [...data.patrols, ...data.patrols]
            : data.patrols;

    return (
        <div className="live-scoring-container">
            <div className="live-scoring-page">
                <div className="page-header">
                    <div>
                        <h1>Live Patrol Progress</h1>
                        <p>
                            {event?.name ? `${event.name} — ` : ""}
                            Shows patrol progress across stations. Scores are not displayed.
                        </p>
                    </div>

                    <div className="controls-row">
                        <div className="refresh-controls">
                            <label htmlFor="refresh-rate-select" className="refresh-label">
                                Refresh:
                            </label>
                            <select
                                id="refresh-rate-select"
                                className="refresh-select"
                                value={refreshInterval}
                                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                            >
                                <option value={0}>Manual (Off)</option>
                                <option value={5000}>5s</option>
                                <option value={10000}>10s</option>
                                <option value={15000}>15s (Default)</option>
                                <option value={30000}>30s</option>
                                <option value={60000}>60s</option>
                            </select>

                            <button
                                type="button"
                                className="primary-button refresh-button"
                                onClick={() => loadData(true)}
                                disabled={isRefreshing}
                                title="Refresh Now"
                            >
                                {isRefreshing ? "Refreshing..." : "🔄 Refresh Now"}
                            </button>

                            {lastUpdated && (
                                <span className="last-updated-tag">
                                    Updated {lastUpdated.toLocaleTimeString()}
                                </span>
                            )}
                        </div>

                        <div className="view-buttons">
                            <button
                                className={`primary-button ${displayMode === "fit" ? "active" : ""}`}
                                onClick={() => setDisplayMode("fit")}
                            >
                                Fit
                            </button>
                            <button
                                className={`primary-button ${displayMode === "auto" ? "active" : ""}`}
                                onClick={() => setDisplayMode("auto")}
                            >
                                Auto Scroll
                            </button>
                            <button
                                className={`primary-button ${displayMode === "manual" ? "active" : ""}`}
                                onClick={() => setDisplayMode("manual")}
                            >
                                Manual
                            </button>
                        </div>
                    </div>
                </div>

                <div ref={tableWrapperRef} className={`live-table-wrapper ${displayMode}`}>
                    <table className={`live-table ${displayMode}`}>
                        <thead>
                            <tr>
                                <th className="sticky-column">Patrol</th>
                                {data.stations.map((station) => (
                                    <th key={station.id}>{station.name}</th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {patrolsToMap.map((patrol, index) => (
                                <tr key={`${patrol.id}-${index}`}>
                                    <td className="sticky-column patrol-name">
                                        {patrol.programName || patrol.name}
                                    </td>

                                    {data.stations.map((station) => {
                                        const isCheckedIn =
                                            patrol.currentStationId === station.id ||
                                            patrol.status === "checked-in" && patrol.stationId === station.id;

                                        const isInProgress =
                                            patrol.inProgressStationId === station.id ||
                                            (isCheckedIn && patrol.inProgress);

                                        const isCheckedOut =
                                            patrol.completedStations?.includes(station.id) ||
                                            patrol.completed?.[station.id];

                                        const isScored = Boolean(scoredMap[patrol.id]?.[station.id]);

                                        let className = "not-arrived";
                                        let value = "";
                                        let title = "Not Arrived";

                                        if (isScored && !isCheckedOut) {
                                            className = "scored-only";
                                            value = "📝";
                                            title = "Scored (Not Checked Out)";
                                        } else if (isCheckedOut && isScored) {
                                            className = "completed-scored";
                                            value = "✓📝";
                                            title = "Checked Out & Scored";
                                        } else if (isCheckedOut) {
                                            className = "completed";
                                            value = "✓";
                                            title = "Checked Out / Completed";
                                        } else if (isInProgress) {
                                            className = "in-progress";
                                            value = "⚡";
                                            title = "In Progress";
                                        } else if (isCheckedIn) {
                                            className = "checked-in";
                                            value = "⏳";
                                            title = "Checked In";
                                        }

                                        return (
                                            <td key={station.id} className={className} title={title}>
                                                {value}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="legend">
                    <span className="legend-item">
                        <span className="legend-box not-arrived"></span>
                        Not Arrived
                    </span>

                    <span className="legend-item">
                        <span className="legend-box checked-in"></span>
                        Checked In (⏳)
                    </span>

                    <span className="legend-item">
                        <span className="legend-box in-progress"></span>
                        In Progress (⚡)
                    </span>

                    <span className="legend-item">
                        <span className="legend-box completed"></span>
                        Checked Out / Completed (✓)
                    </span>

                    <span className="legend-item">
                        <span className="legend-box scored-only"></span>
                        Scored (📝)
                    </span>

                    <span className="legend-item">
                        <span className="legend-box completed-scored"></span>
                        Checked Out & Scored (✓📝)
                    </span>
                </div>
            </div>
        </div>
    );
}