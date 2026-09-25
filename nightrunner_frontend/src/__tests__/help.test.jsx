import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

import Help from "../pages/help/Help";
import { GRID_ROLES, ROLES, ROLE_GRID } from "../pages/help/helpContent";

// Rendered through react-dom rather than @testing-library/react, same as
// station-review.test.jsx.

describe("help content", () => {
    it("only uses grid role keys that exist", () => {
        const known = new Set(GRID_ROLES.map(role => role.key));
        const used = ROLE_GRID
            .flatMap(group => group.rows)
            .flatMap(row => [...row.roles, ...(row.partial ?? [])]);

        expect(used.filter(key => !known.has(key))).toEqual([]);
    });

    it("describes every role shown in the grid", () => {
        const described = new Set(ROLES.map(role => role.key));

        expect(GRID_ROLES.filter(role => !described.has(role.key))).toEqual([]);
    });
});

describe("Help page", () => {
    let container;
    let root;

    beforeEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    it("renders a card per role and a grid row per screen", () => {
        act(() => root.render(<Help />));

        expect(container.querySelectorAll(".help-role-card")).toHaveLength(ROLES.length);

        const screenCount = ROLE_GRID.reduce((sum, group) => sum + group.rows.length, 0);
        expect(container.querySelectorAll("tbody th[scope='row']")).toHaveLength(screenCount);
    });

    it("marks Configuration Manager as System Admin only", () => {
        act(() => root.render(<Help />));

        const row = [...container.querySelectorAll("tbody tr")]
            .find(tr => tr.textContent.includes("Configuration Manager"));
        const cells = [...row.querySelectorAll("td")].map(td => td.textContent.trim());

        expect(cells[0]).toContain("Yes");
        expect(cells.slice(1).every(text => text.includes("No"))).toBe(true);
    });
});
