import { describe, it, expect, beforeEach } from "vitest";

import UserService from "../api/UserService";
import {
    EVENT_ROLES,
    ROLE,
    ROLE_AUDIENCE,
    ROLE_DESCRIPTIONS,
    ROLE_LABELS,
    formatRole,
    hasEventRole
} from "../lib/roles";

// The role plan agreed 2026-09-24 (#236). The backend enforces the same groups
// in nightrunner_backend/models/user_roles.py.

const EVENT = "evt-1";
const OTHER = "evt-2";

function userWith(role, { isAdmin = false, eventId = EVENT } = {}) {
    return { id: "u", isAdmin, status: "active", roles: role ? { [eventId]: role } : {} };
}

describe("role catalogue", () => {
    it("labels, describes and explains every assignable role", () => {
        for (const role of EVENT_ROLES) {
            expect(ROLE_LABELS[role], role).toBeTruthy();
            expect(ROLE_DESCRIPTIONS[role], role).toBeTruthy();
            expect(ROLE_AUDIENCE[role], role).toBeTruthy();
        }
    });

    it("no longer offers the retired role names", () => {
        for (const retired of ["event-ops", "scoring-lead", "scoring-center", "scorer", "volunteer"]) {
            expect(EVENT_ROLES).not.toContain(retired);
        }
    });

    it("falls back to the raw name for an unknown role", () => {
        expect(formatRole(ROLE.GATE_CHECKIN)).toBe("Gate Check-In");
        expect(formatRole("mystery")).toBe("mystery");
        expect(formatRole(null)).toBe("No Role");
    });
});

describe("hasEventRole", () => {
    it("passes system admins for any event", () => {
        expect(hasEventRole(userWith(null, { isAdmin: true }), OTHER, [ROLE.SCORING_TEAM])).toBe(true);
    });

    it("only counts a role on the selected event", () => {
        const user = userWith(ROLE.SCORING_TEAM);
        expect(hasEventRole(user, EVENT, [ROLE.SCORING_TEAM])).toBe(true);
        expect(hasEventRole(user, OTHER, [ROLE.SCORING_TEAM])).toBe(false);
        expect(hasEventRole(user, null, [ROLE.SCORING_TEAM])).toBe(false);
    });

    it("refuses a missing user", () => {
        expect(hasEventRole(null, EVENT, [ROLE.SCORING_TEAM])).toBe(false);
    });
});

describe("UserService role checks", () => {
    const service = new UserService();

    // [role, scoring, station check-in, gate, patrol edit]
    const MATRIX = [
        [ROLE.EVENT_ADMIN,       true,  true,  true,  true],
        [ROLE.SCORING_TEAM,      true,  true,  false, false],
        [ROLE.STATION_LEAD,      false, true,  false, false],
        [ROLE.STATION_VOLUNTEER, false, true,  false, false],
        [ROLE.COMMAND_CENTER,    false, false, false, true],
        [ROLE.GATE_CHECKIN,      false, false, true,  false],
        [ROLE.PATROL_MANAGEMENT, false, false, false, true],
        [ROLE.USER,              false, false, false, false]
    ];

    beforeEach(() => localStorage.clear());

    it.each(MATRIX)("%s", (role, scoring, station, gate, patrols) => {
        service.set(userWith(role));

        expect(service.isScoringTeam(EVENT)).toBe(scoring);
        expect(service.isStationStaff(EVENT)).toBe(station);
        expect(service.isGateCheckIn(EVENT)).toBe(gate);
        expect(service.isPatrolManager(EVENT)).toBe(patrols);
    });

    it("gives system admins everything", () => {
        service.set(userWith(null, { isAdmin: true }));

        expect(service.isScoringTeam(EVENT)).toBe(true);
        expect(service.isStationStaff(EVENT)).toBe(true);
        expect(service.isGateCheckIn(EVENT)).toBe(true);
        expect(service.isPatrolManager(EVENT)).toBe(true);
    });
});
