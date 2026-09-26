import "./LiveStatus.css";

/**
 * The patrol x station progress grid.
 *
 * Shared by the signed-in Live Status board and the public spectator board so
 * the two cannot drift apart. It lives beside LiveStatus rather than in
 * components/ so it keeps using LiveStatus.css — one grid, one stylesheet.
 *
 * Identity columns are configurable because the two boards label rows
 * differently: internally a patrol name is enough, while a spectator needs
 * number, name and troop to find their own patrol.
 */

export const DEFAULT_IDENTITY_COLUMNS = [
    {
        key: "patrol",
        label: "Patrol",
        render: (patrol) => patrol.programName || patrol.name
    }
];

// Internal table view: the number on the patrol's badge, then the name.
export const NUMBERED_IDENTITY_COLUMNS = [
    {
        key: "number",
        label: "#",
        render: (patrol) => (patrol.number ?? "")
    },
    {
        key: "name",
        label: "Patrol",
        render: (patrol) => patrol.programName || patrol.name
    }
];

export const PUBLIC_IDENTITY_COLUMNS = [
    {
        key: "number",
        label: "#",
        render: (patrol) => (patrol.number ?? "")
    },
    {
        key: "name",
        label: "Patrol",
        render: (patrol) => patrol.programName || patrol.name
    },
    {
        key: "troop",
        label: "Troop",
        // Patrols are commonly mixed-troop, so this is a list rather than a
        // single code. An empty list renders as a dash, not a blank cell.
        render: (patrol) =>
            patrol.troops?.length
                ? patrol.troops.join(", ")
                : "—"
    }
];


/**
 * Collapse the visit rows into one entry per patrol/station.
 *
 * Sorted oldest first so a later visit overwrites an earlier one — a patrol
 * that was reset and re-checked-in should read as its current attempt.
 */
export function buildVisitMap(visits) {

    const visitMap = {};

    if (!visits) {
        return visitMap;
    }

    const sorted = [...visits].sort(
        (a, b) =>
            new Date(a.createdAt || a.created_at || a.checkedInAt || a.checked_in_at || 0) -
            new Date(b.createdAt || b.created_at || b.checkedInAt || b.checked_in_at || 0)
    );

    for (const v of sorted) {

        const pid = v.patrolId || v.patrol_id;
        const sid = v.stationId || v.station_id;

        if (pid && sid) {
            visitMap[`${pid}_${sid}`] = {
                checkedInAt: v.checkedInAt || v.checked_in_at || null,
                checkedOutAt: v.checkedOutAt || v.checked_out_at || null,
                tasksStartedAt: v.tasksStartedAt || v.tasks_started_at || null,
                tasksCompletedAt: v.tasksCompletedAt || v.tasks_completed_at || null,
                status: v.status || null
            };
        }

    }

    return visitMap;

}


/**
 * Where one patrol stands at one station. The single source for both the
 * grid's cell symbols and the summary view's counts, so the two can never
 * disagree.
 *
 *   "skipped"      declared not attempted (visit status "skipped", #245)
 *   "scored"       scoring submitted and locked (visit status "completed")
 *   "finished"     checked out, no score yet
 *   "in-progress"  at the station, tasks started
 *   "here"         checked in at the station
 *   "none"         not arrived
 *
 * "scored" implies finished: submitting a score checks the patrol out.
 */
export function visitStatus(patrol, station, visit) {

    if (visit?.status === "skipped") {
        return "skipped";
    }

    const isCompletedScoring = visit?.status === "completed";

    const isCheckedIn = Boolean(
        visit?.checkedInAt ||
        patrol.currentStationId === station.id ||
        (patrol.status === "checked-in" && patrol.stationId === station.id)
    );

    const isInProgress = Boolean(
        visit?.tasksStartedAt ||
        patrol.inProgressStationId === station.id ||
        (isCheckedIn && patrol.inProgress)
    );

    const isCheckedOut = Boolean(
        visit?.checkedOutAt ||
        patrol.completedStations?.includes(station.id) ||
        patrol.completed?.[station.id]
    );

    if (isCompletedScoring) return "scored";
    if (isCheckedOut) return "finished";
    if (isInProgress) return "in-progress";
    if (isCheckedIn) return "here";
    return "none";

}


const CELL_STATES = {
    // A darker green than a plain check-out, so "scored" reads as a
    // different state from "finished", not just a different symbol.
    "scored": { className: "completed-scored", value: "★", title: "Scored (attempt locked)" },
    "finished": { className: "completed", value: "✓", title: "Checked out, not scored yet" },
    "in-progress": { className: "in-progress", value: "⚡", title: "In Progress" },
    "here": { className: "checked-in", value: "⏳", title: "Checked In" },
    "skipped": { className: "skipped", value: "–", title: "Skipped" },
    "none": { className: "not-arrived", value: "", title: "Not Arrived" }
};


function formatLocalTime(val) {
    if (!val) return null;
    const parsed = new Date(val);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function cellState(patrol, station, visit) {
    const status = visitStatus(patrol, station, visit);
    const base = CELL_STATES[status];
    if (status === "none") return base;

    const inTime = formatLocalTime(visit?.checkedInAt);
    const outTime = formatLocalTime(visit?.checkedOutAt);
    const startTime = formatLocalTime(visit?.tasksStartedAt);

    let title = base.title;
    let timeLabel = null;

    if (status === "here" && inTime) {
        title = `Checked In (${inTime})`;
    } else if (status === "in-progress") {
        const t = startTime || inTime;
        if (t) {
            title = `In Progress (${t})`;
        }
    } else if (status === "finished") {
        const times = [inTime, outTime].filter(Boolean);
        if (times.length) {
            title = `Checked out, not scored yet (${times.join(" – ")})`;
        }
    } else if (status === "scored") {
        const times = [inTime, outTime].filter(Boolean);
        if (times.length) {
            title = `Scored (attempt locked) (${times.join(" – ")})`;
        }
    } else if (status === "skipped" && outTime) {
        title = `Skipped (${outTime})`;
    }

    return { ...base, title };
}


/**
 * Patrols in badge-number order, with unnumbered patrols after numbered ones
 * and then by name. The API returns them in creation order.
 */
export function sortPatrolsByNumber(patrols) {

    return [...(patrols || [])].sort((a, b) => {
        const an = a.number ?? null;
        const bn = b.number ?? null;
        if (an !== null && bn !== null && Number(an) !== Number(bn)) {
            return Number(an) - Number(bn);
        }
        if (an === null && bn !== null) return 1;
        if (an !== null && bn === null) return -1;
        return (a.programName || a.name || "").localeCompare(b.programName || b.name || "");
    });

}


/**
 * Per-station and per-patrol counts for the summary view and the grid's
 * totals. "finished" includes "scored". "waiting" is finished but not yet
 * scored: patrols through the door whose scores have not been entered.
 */
export function summarise(stations = [], patrols = [], visits = []) {

    const visitMap = buildVisitMap(visits);
    const blank = () => ({ finished: 0, scored: 0, here: 0, skipped: 0 });

    const byStation = {};
    const byPatrol = {};
    stations.forEach((s) => { byStation[s.id] = blank(); });
    patrols.forEach((p) => { byPatrol[p.id] = { ...blank(), hereAt: [] }; });

    patrols.forEach((patrol) => {
        stations.forEach((station) => {
            const visit = visitMap[`${patrol.id}_${station.id}`];
            const status = visitStatus(patrol, station, visit);
            const st = byStation[station.id];
            const pt = byPatrol[patrol.id];

            if (status === "scored" || status === "finished") {
                st.finished += 1;
                pt.finished += 1;
            }
            if (status === "scored") {
                st.scored += 1;
                pt.scored += 1;
            }
            if (status === "here" || status === "in-progress") {
                st.here += 1;
                pt.here += 1;
                pt.hereAt.push({ station, checkedInAt: visit?.checkedInAt || visit?.tasksStartedAt });
            }
            if (status === "skipped") {
                st.skipped += 1;
                pt.skipped += 1;
            }
        });
    });

    const finish = (counts, total) => ({
        ...counts,
        total,
        waiting: counts.finished - counts.scored,
        remaining: Math.max(0, total - counts.finished - counts.here - counts.skipped)
    });

    Object.keys(byStation).forEach((id) => { byStation[id] = finish(byStation[id], patrols.length); });
    Object.keys(byPatrol).forEach((id) => { byPatrol[id] = finish(byPatrol[id], stations.length); });

    return { stations: byStation, patrols: byPatrol };

}


export default function ProgressGrid({
    stations = [],
    patrols = [],
    visits = [],
    displayMode = "fit",
    identityColumns = DEFAULT_IDENTITY_COLUMNS,
    tableWrapperRef = null,
    verboseLegend = false,
    // Footer row with "X / Y finished" under each station.
    showStationTotals = false,
    // Final column with "X / Y" stations finished per patrol.
    showPatrolTotals = false
}) {

    const visitMap = buildVisitMap(visits);
    const totals = summarise(stations, patrols, visits);
    const orderedPatrols = sortPatrolsByNumber(patrols);
    const anySkipped = Object.values(totals.stations).some((s) => s.skipped > 0);

    // Auto-scroll needs the rows duplicated so the loop has something to run
    // into; below that many patrols there is nothing to scroll.
    const patrolsToMap =
        orderedPatrols.length > 10 && displayMode === "auto"
            ? [...orderedPatrols, ...orderedPatrols]
            : orderedPatrols;

    return (
        <>
            <div ref={tableWrapperRef} className={`live-table-wrapper ${displayMode}`}>
                <table className={`live-table ${displayMode}`}>
                    <thead>
                        <tr>
                            {identityColumns.map((column) => (
                                <th
                                    key={column.key}
                                    className={`sticky-column identity-col identity-col--${column.key}`}
                                >
                                    {column.label}
                                </th>
                            ))}
                            {stations.map((station) => (
                                <th key={station.id}>{station.name}</th>
                            ))}
                            {showPatrolTotals && (
                                <th className="totals-col" title="Stations finished out of all stations">
                                    Stations
                                </th>
                            )}
                        </tr>
                    </thead>

                    <tbody>
                        {patrolsToMap.map((patrol, index) => (
                            <tr key={`${patrol.id}-${index}`}>
                                {identityColumns.map((column) => (
                                    <td
                                        key={column.key}
                                        className={`sticky-column patrol-name identity-col identity-col--${column.key}`}
                                    >
                                        {column.render(patrol)}
                                    </td>
                                ))}

                                {stations.map((station) => {

                                    const state = cellState(
                                        patrol,
                                        station,
                                        visitMap[`${patrol.id}_${station.id}`]
                                    );

                                    return (
                                        <td
                                            key={station.id}
                                            className={state.className}
                                            title={state.title}
                                        >
                                            {state.value}
                                        </td>
                                    );

                                })}

                                {showPatrolTotals && (
                                    <td className="totals-col" data-testid={`patrol-total-${patrol.id}`}>
                                        {totals.patrols[patrol.id].finished} / {stations.length}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>

                    {showStationTotals && (
                        <tfoot>
                            <tr className="totals-row">
                                <th
                                    colSpan={identityColumns.length}
                                    className="sticky-column totals-label"
                                    scope="row"
                                >
                                    Finished
                                </th>
                                {stations.map((station) => (
                                    <td key={station.id} data-testid={`station-total-${station.id}`}>
                                        {totals.stations[station.id].finished} / {patrols.length}
                                    </td>
                                ))}
                                {showPatrolTotals && <td className="totals-col" aria-hidden="true" />}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            <div className="legend">
                <span className="legend-item">
                    <span className="legend-box not-arrived"></span>
                    {verboseLegend ? "Not arrived yet" : "Not Arrived"}
                </span>

                <span className="legend-item">
                    <span className="legend-box checked-in"></span>
                    {verboseLegend ? "At the station now (⏳)" : "Checked In (⏳)"}
                </span>

                <span className="legend-item">
                    <span className="legend-box in-progress"></span>
                    {verboseLegend ? "Taking part (⚡)" : "In Progress (⚡)"}
                </span>

                <span className="legend-item">
                    <span className="legend-box completed"></span>
                    {verboseLegend ? "Finished this station (✓)" : "Checked Out, not scored yet (✓)"}
                </span>

                <span className="legend-item">
                    <span className="legend-box completed-scored"></span>
                    {verboseLegend ? "Finished and scored (★)" : "Scored (★)"}
                </span>

                {anySkipped && (
                    <span className="legend-item">
                        <span className="legend-box skipped"></span>
                        Skipped (–)
                    </span>
                )}
            </div>
        </>
    );

}
