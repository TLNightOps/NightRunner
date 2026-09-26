import { sortPatrolsByNumber, summarise } from "./ProgressGrid.jsx";

import "./SummaryView.css";

function patrolTitle(patrol) {
    const name = patrol.programName || patrol.name || "Patrol";
    return patrol.number !== undefined && patrol.number !== null && patrol.number !== ""
        ? `Patrol ${patrol.number} — ${name}`
        : name;
}

function formatLocalTime(val) {
    if (!val) return null;
    const parsed = new Date(val);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// "1 patrol" / "3 patrols"
function count(n, singular, plural = `${singular}s`) {
    return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * The default Live Status view: how far each station and each patrol has got,
 * as counts rather than a grid of symbols.
 *
 * All counts come from summarise() in ProgressGrid.jsx, the same function
 * behind the grid's cells, so switching views never shows different numbers.
 */
export default function SummaryView({ stations = [], patrols = [], visits = [] }) {

    const totals = summarise(stations, patrols, visits);
    const orderedPatrols = sortPatrolsByNumber(patrols);

    return (
        <div className="summary-view">

            <section aria-labelledby="summary-stations-heading">
                <h2 id="summary-stations-heading" className="summary-heading">Stations</h2>

                <div className="summary-station-grid">
                    {stations.map((station) => {
                        const t = totals.stations[station.id];
                        const finishedPct = t.total ? (t.finished / t.total) * 100 : 0;
                        const scoredPct = t.total ? (t.scored / t.total) * 100 : 0;

                        return (
                            <article
                                key={station.id}
                                className="summary-station-card"
                                data-testid={`summary-station-${station.id}`}
                            >
                                <h3>{station.name}</h3>

                                <p className="summary-station-headline">
                                    <strong>{t.finished}</strong> of {t.total} finished
                                </p>

                                {/* Scored is drawn inside finished: the lighter
                                    stretch between the two ends is patrols
                                    waiting for a score. */}
                                <div
                                    className="summary-progress"
                                    role="img"
                                    aria-label={`${t.finished} of ${t.total} finished, ${t.scored} scored`}
                                >
                                    <span className="summary-progress-finished" style={{ width: `${finishedPct}%` }} />
                                    <span className="summary-progress-scored" style={{ width: `${scoredPct}%` }} />
                                </div>

                                <ul className="summary-facts">
                                    <li>{t.scored} scored</li>
                                    {t.waiting > 0 && (
                                        <li className="summary-fact-attention">
                                            {count(t.waiting, "patrol")} waiting for a score
                                        </li>
                                    )}
                                    <li>{t.here} at station now</li>
                                    {t.skipped > 0 && <li>{t.skipped} skipped</li>}
                                    <li>{t.remaining} remaining</li>
                                </ul>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section aria-labelledby="summary-patrols-heading">
                <h2 id="summary-patrols-heading" className="summary-heading">Patrols</h2>

                <ul className="summary-patrol-list">
                    {orderedPatrols.map((patrol) => {
                        const t = totals.patrols[patrol.id];
                        const hereAtStr = t.hereAt.map((entry) => {
                            const timeStr = formatLocalTime(entry.checkedInAt);
                            return timeStr ? `${entry.station.name} (since ${timeStr})` : entry.station.name;
                        }).join(", ");

                        return (
                            <li
                                key={patrol.id}
                                className="summary-patrol-row"
                                data-testid={`summary-patrol-${patrol.id}`}
                            >
                                <span className="summary-patrol-name">{patrolTitle(patrol)}</span>

                                <span className="summary-patrol-counts">
                                    <strong>{t.finished} of {t.total}</strong> finished
                                    {" · "}{t.scored} scored
                                    {t.waiting > 0 && (
                                        <>
                                            {" · "}
                                            <span className="summary-fact-attention">{t.waiting} waiting for a score</span>
                                        </>
                                    )}
                                    {t.skipped > 0 && <>{" · "}{t.skipped} skipped</>}
                                    {" · "}{t.remaining} remaining
                                </span>

                                {hereAtStr && (
                                    <span className="summary-patrol-here">Now at {hereAtStr}</span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </section>

        </div>
    );

}
