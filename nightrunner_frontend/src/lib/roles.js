// Event roles and what each one can do. The role plan (#236) is the matrix in
// docs/USER_ROLES_AND_PERMISSIONS.md. The backend enforces the same groups in
// nightrunner_backend/models/user_roles.py, so change both together.
//
// Everything here is keyed by event: a role only counts while its event is
// selected. System admins pass every check.

export const ROLE = {
    USER: "user",
    EVENT_ADMIN: "event-admin",
    SCORING_TEAM: "scoring-team",
    STATION_LEAD: "station-lead",
    STATION_VOLUNTEER: "station-volunteer",
    COMMAND_CENTER: "command-center",
    GATE_CHECKIN: "gate-checkin",
    PATROL_MANAGEMENT: "patrol-management"
};


// Order shown in the User Manager's role picker.
export const EVENT_ROLES = [
    ROLE.USER,
    ROLE.EVENT_ADMIN,
    ROLE.SCORING_TEAM,
    ROLE.STATION_LEAD,
    ROLE.STATION_VOLUNTEER,
    ROLE.COMMAND_CENTER,
    ROLE.GATE_CHECKIN,
    ROLE.PATROL_MANAGEMENT
];


// Enter, review, reopen and correct scores; Score Finalizer and reports.
export const SCORING_ROLES = [ROLE.EVENT_ADMIN, ROLE.SCORING_TEAM];

// Check a patrol in or out at any station.
export const STATION_CHECKIN_ROLES = [
    ROLE.EVENT_ADMIN,
    ROLE.SCORING_TEAM,
    ROLE.STATION_LEAD,
    ROLE.STATION_VOLUNTEER
];

// Gate Check-In and the Arrivals Dashboard.
export const GATE_ROLES = [ROLE.EVENT_ADMIN, ROLE.GATE_CHECKIN];

// Create, edit or delete patrols.
export const PATROL_WRITE_ROLES = [
    ROLE.EVENT_ADMIN,
    ROLE.PATROL_MANAGEMENT,
    ROLE.COMMAND_CENTER
];


export const ROLE_LABELS = {
    [ROLE.USER]: "Standard User",
    [ROLE.EVENT_ADMIN]: "Event Admin",
    [ROLE.SCORING_TEAM]: "Scoring Team",
    [ROLE.STATION_LEAD]: "Station Lead",
    [ROLE.STATION_VOLUNTEER]: "Station Volunteer",
    [ROLE.COMMAND_CENTER]: "Command Center",
    [ROLE.GATE_CHECKIN]: "Gate Check-In",
    [ROLE.PATROL_MANAGEMENT]: "Patrol Management"
};


// Shown in the User Manager when a role is picked. Describe what the app does,
// not what is planned.
export const ROLE_DESCRIPTIONS = {
    [ROLE.USER]: "Signed in with no event role. Can look up patrols and watch Live Status.",
    [ROLE.EVENT_ADMIN]: "Runs the event: stations, patrols, roster, users, gate, scoring, the Score Finalizer and reports.",
    [ROLE.SCORING_TEAM]: "Works at the scoring center. Enters, reviews, reopens and corrects scores, and uses the Score Finalizer and reports.",
    [ROLE.STATION_LEAD]: "Checks patrols in and out at any station. No access to scoring. Extra station lead permissions are planned.",
    [ROLE.STATION_VOLUNTEER]: "Checks patrols in and out at any station. No access to scoring.",
    [ROLE.COMMAND_CENTER]: "Runs the Command Center and can create and edit patrols.",
    [ROLE.GATE_CHECKIN]: "Works the gate. Uses Gate Check-In and the Arrivals Dashboard.",
    [ROLE.PATROL_MANAGEMENT]: "Registers patrols and keeps their details up to date in the Patrol Manager."
};


export function formatRole(role) {
    return ROLE_LABELS[role] ?? role ?? "No Role";
}


/**
 * Whether a user holds one of `allowed` for an event.
 *
 * @param {{isAdmin?: boolean, roles?: Object<string, string>}|null} user
 *     The cached `/me` user; `roles` is an `{eventId: role}` map.
 * @param {string|null} eventId
 * @param {string[]} allowed
 * @returns {boolean}
 */
export function hasEventRole(user, eventId, allowed) {
    if (!user) {
        return false;
    }

    if (user.isAdmin === true) {
        return true;
    }

    if (!eventId) {
        return false;
    }

    return allowed.includes(user.roles?.[eventId]);
}


// "Who to assign" hints for the User Manager's role guide.
export const ROLE_AUDIENCE = {
    [ROLE.USER]: "Anyone who needs to follow along without a job on the night.",
    [ROLE.EVENT_ADMIN]: "Event directors and head organizers.",
    [ROLE.SCORING_TEAM]: "The adults entering scores at the scoring center, including the lead scorer.",
    [ROLE.STATION_LEAD]: "Station captains and adult station leaders.",
    [ROLE.STATION_VOLUNTEER]: "Station helpers who check patrols in and out.",
    [ROLE.COMMAND_CENTER]: "Command Center volunteers tracking send-out and return.",
    [ROLE.GATE_CHECKIN]: "Gate and registration desk volunteers.",
    [ROLE.PATROL_MANAGEMENT]: "Patrol registrars and unit liaisons."
};
