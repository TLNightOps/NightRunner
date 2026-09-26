import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

import ProgressGrid, {
    cellState,
    PUBLIC_IDENTITY_COLUMNS,
    sortPatrolsByNumber,
    summarise,
    visitStatus
} from "../pages/scoring/live/ProgressGrid";
import SummaryView from "../pages/scoring/live/SummaryView";

// Rendered through react-dom rather than @testing-library/react, because
// @testing-library/dom is not currently installable alongside the pinned
// Storybook version (same approach as stopwatch-manual-times.test.jsx).

const mockGetLiveScoring = vi.fn();

vi.mock("@/api/helpers/event/EventContext.jsx", () => ({
    useEventContext: () => ({ event: { id: "evt-1", name: "Night Ops" }, eventId: "evt-1", loading: false, error: null })
}));

vi.mock("@/pages/scoring/live/LiveStatusService.js", () => ({
    getLiveScoring: (...a) => mockGetLiveScoring(...a)
}));

const STATIONS = [
    { id: "ropes", name: "Ropes" },
    { id: "fire", name: "Fire" },
    { id: "water", name: "Water" }
];

// Creation order, deliberately not number order.
const PATROLS = [
    { id: "p3", number: 3, name: "Hawks" },
    { id: "p1", number: 1, name: "Eagles" },
    { id: "p2", number: 2, name: "Owls" }
];

const at = (h, m) => `2026-09-25T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;

const VISITS = [
    // Eagles: scored at Ropes, checked out of Fire (not scored), at Water now.
    { patrolId: "p1", stationId: "ropes", checkedInAt: at(20, 0), checkedOutAt: at(20, 20), status: "completed" },
    { patrolId: "p1", stationId: "fire", checkedInAt: at(20, 30), checkedOutAt: at(20, 50), status: "checked_out" },
    { patrolId: "p1", stationId: "water", checkedInAt: at(21, 0), status: "checked_in" },
    // Owls: scored at Ropes, skipped Fire.
    { patrolId: "p2", stationId: "ropes", checkedInAt: at(20, 5), checkedOutAt: at(20, 25), status: "completed" },
    { patrolId: "p2", stationId: "fire", checkedOutAt: at(22, 0), status: "skipped" }
    // Hawks: nothing yet.
];

describe("visitStatus", () => {
    const station = { id: "s" };
    const patrol = { id: "p" };

    it("names every state", () => {
        expect(visitStatus(patrol, station, undefined)).toBe("none");
        expect(visitStatus(patrol, station, { checkedInAt: "x" })).toBe("here");
        expect(visitStatus(patrol, station, { checkedInAt: "x", tasksStartedAt: "y" })).toBe("in-progress");
        expect(visitStatus(patrol, station, { checkedInAt: "x", checkedOutAt: "y" })).toBe("finished");
        expect(visitStatus(patrol, station, { checkedInAt: "x", checkedOutAt: "y", status: "completed" })).toBe("scored");
        expect(visitStatus(patrol, station, { checkedOutAt: "y", status: "skipped" })).toBe("skipped");
    });

    it("gives scored its own cell colour, not the plain check-out green", () => {
        expect(cellState(patrol, station, { checkedInAt: "2026-09-25T20:00:00Z", status: "completed" }).className).toBe("completed-scored");
        expect(cellState(patrol, station, { checkedInAt: "2026-09-25T20:00:00Z", checkedOutAt: "2026-09-25T20:20:00Z" }).className).toBe("completed");
        expect(cellState(patrol, station, { status: "skipped" }).value).toBe("–");
    });

    it("formats titles with localized times", () => {
        const csHere = cellState(patrol, station, { checkedInAt: "2026-09-25T20:00:00Z" });
        expect(csHere.title).toMatch(/Checked In \(\d+:\d+\s+[AP]M\)/);
    });
});

describe("summarise", () => {
    const totals = summarise(STATIONS, PATROLS, VISITS);

    it("counts per station: finished includes scored, waiting is the gap", () => {
        expect(totals.stations.ropes).toMatchObject({ total: 3, finished: 2, scored: 2, waiting: 0, here: 0, skipped: 0, remaining: 1 });
        expect(totals.stations.fire).toMatchObject({ finished: 1, scored: 0, waiting: 1, skipped: 1, remaining: 1 });
        expect(totals.stations.water).toMatchObject({ finished: 0, here: 1, remaining: 2 });
    });

    it("counts per patrol and knows where each patrol is now", () => {
        expect(totals.patrols.p1).toMatchObject({ total: 3, finished: 2, scored: 1, waiting: 1, here: 1, remaining: 0 });
        expect(totals.patrols.p1.hereAt.map((entry) => entry.station.id)).toEqual(["water"]);
        expect(totals.patrols.p2).toMatchObject({ finished: 1, scored: 1, skipped: 1, remaining: 1 });
        expect(totals.patrols.p3).toMatchObject({ finished: 0, remaining: 3 });
    });

    it("never goes negative on remaining", () => {
        expect(summarise([], PATROLS, VISITS).patrols.p1.remaining).toBe(0);
    });
});

describe("sortPatrolsByNumber", () => {
    it("orders by badge number, unnumbered last by name", () => {
        const sorted = sortPatrolsByNumber([
            { id: "x", name: "Zeta" },
            ...PATROLS,
            { id: "y", name: "Alpha" }
        ]);
        expect(sorted.map((p) => p.id)).toEqual(["p1", "p2", "p3", "y", "x"]);
    });
});

// ---------------------------------------------------------------- rendering

let container;
let root;

beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockGetLiveScoring.mockReset();
    try { localStorage.clear(); } catch { /* jsdom always has it */ }
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function text(testId) {
    return container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? null;
}

describe("ProgressGrid", () => {
    it("orders rows by patrol number on every board", () => {
        act(() => {
            root.render(<ProgressGrid stations={STATIONS} patrols={PATROLS} visits={VISITS} />);
        });
        const names = [...container.querySelectorAll("tbody tr td:first-child")].map((td) => td.textContent);
        expect(names).toEqual(["Eagles", "Owls", "Hawks"]);
    });

    it("adds the per-station footer and per-patrol column when asked", () => {
        act(() => {
            root.render(
                <ProgressGrid stations={STATIONS} patrols={PATROLS} visits={VISITS} showStationTotals showPatrolTotals />
            );
        });
        expect(text("station-total-ropes")).toBe("2 / 3");
        expect(text("station-total-water")).toBe("0 / 3");
        expect(text("patrol-total-p1")).toBe("2 / 3");
        expect(text("patrol-total-p3")).toBe("0 / 3");
    });

    it("the public board gets the patrol column but no station footer", () => {
        act(() => {
            root.render(
                <ProgressGrid
                    stations={STATIONS}
                    patrols={PATROLS}
                    visits={VISITS}
                    identityColumns={PUBLIC_IDENTITY_COLUMNS}
                    verboseLegend
                    showPatrolTotals
                />
            );
        });
        expect(container.querySelector("tfoot")).toBeNull();
        expect(text("patrol-total-p2")).toBe("1 / 3");
        expect(container.querySelector(".legend").textContent).toContain("Finished and scored (★)");
    });

    it("shows the skipped legend only once something has been skipped", () => {
        act(() => {
            root.render(<ProgressGrid stations={STATIONS} patrols={PATROLS} visits={VISITS.filter((v) => v.status !== "skipped")} />);
        });
        expect(container.querySelector(".legend-box.skipped")).toBeNull();

        act(() => {
            root.render(<ProgressGrid stations={STATIONS} patrols={PATROLS} visits={VISITS} />);
        });
        expect(container.querySelector(".legend-box.skipped")).not.toBeNull();
    });
});

describe("SummaryView", () => {
    beforeEach(() => {
        act(() => {
            root.render(<SummaryView stations={STATIONS} patrols={PATROLS} visits={VISITS} />);
        });
    });

    it("gives each station a card with its counts", () => {
        const ropes = text("summary-station-ropes");
        expect(ropes).toContain("2 of 3 finished");
        expect(ropes).toContain("2 scored");
        expect(ropes).toContain("1 remaining");
        expect(ropes).not.toContain("waiting");
    });

    it("flags patrols finished but not yet scored", () => {
        expect(text("summary-station-fire")).toContain("1 patrol waiting for a score");
        expect(text("summary-station-fire")).toContain("1 skipped");
    });

    it("lists patrols by number with where they are now including check-in time", () => {
        const rows = [...container.querySelectorAll(".summary-patrol-row")].map((li) => li.dataset.testid);
        expect(rows).toEqual(["summary-patrol-p1", "summary-patrol-p2", "summary-patrol-p3"]);

        const eagles = text("summary-patrol-p1");
        expect(eagles).toContain("Patrol 1 — Eagles");
        expect(eagles).toContain("2 of 3 finished");
        expect(eagles).toMatch(/Now at Water \(since \d+:\d+\s+[AP]M\)/);
    });
});

describe("ProgressGrid time display", () => {
    it("formats hover titles with localized time ranges without rendering sub-text in cells", () => {
        act(() => {
            root.render(<ProgressGrid stations={STATIONS} patrols={PATROLS} visits={VISITS} />);
        });

        expect(container.querySelectorAll(".cell-time").length).toBe(0);

        const cellsWithTitle = [...container.querySelectorAll("td[title]")].map((td) => td.getAttribute("title"));
        const scoredTitle = cellsWithTitle.find((t) => t.includes("Scored (attempt locked)"));
        expect(scoredTitle).toMatch(/Scored \(attempt locked\) \(\d+:\d+\s+[AP]M – \d+:\d+\s+[AP]M\)/);
    });
});

describe("Live Status page", () => {
    async function renderPage() {
        mockGetLiveScoring.mockResolvedValue({ stations: STATIONS, patrols: PATROLS, visits: VISITS });
        const { default: LiveStatus } = await import("../pages/scoring/live/LiveStatus");
        act(() => {
            root.render(<LiveStatus />);
        });
        await flush();
    }

    function toggle() {
        return [...container.querySelectorAll("button")].find((b) => /Switch to/.test(b.textContent));
    }

    it("opens on the summary, with the grid one tap away", async () => {
        await renderPage();
        expect(container.querySelector(".summary-view")).not.toBeNull();
        expect(container.querySelector(".live-table")).toBeNull();
        // Fit / Auto Scroll / Manual only mean something for the grid.
        expect(container.querySelector(".view-buttons")).toBeNull();

        await act(async () => toggle().click());
        expect(container.querySelector(".live-table")).not.toBeNull();
        expect(container.querySelector("tfoot")).not.toBeNull();
        expect(container.querySelector(".view-buttons")).not.toBeNull();
        expect(toggle().textContent).toBe("Switch to summary");
    });

    it("remembers the chosen view on this device", async () => {
        await renderPage();
        await act(async () => toggle().click());
        act(() => root.unmount());

        root = createRoot(container);
        await renderPage();
        expect(container.querySelector(".live-table")).not.toBeNull();
    });
});
