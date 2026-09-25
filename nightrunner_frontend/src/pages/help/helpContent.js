// Content for the Help & Docs page. Edit this file to update the page; the
// component only lays it out.
//
// Describe what the app does today, not what is planned. The role groups the
// grid describes live in lib/roles.js (frontend) and models/user_roles.py
// (backend); when those change, update ROLES and ROLE_GRID to match.

export const HELP_UPDATED = "September 2026";


export const ROLES = [
    {
        key: "system-admin",
        name: "System Admin",
        summary: "System Admins have full access to all functions of the program, across every event.",
        details: [
            "Sees every event, including new events that have no Event Admin yet.",
            "The only role that can open the Configuration Manager or make someone a System Admin.",
            "Approves new accounts and blocks users."
        ]
    },
    {
        key: "event-admin",
        name: "Event Admin",
        summary: "Event Admins run a single event: its stations, patrols, roster, users, gate, scoring and reports.",
        details: [
            "Has the Event Admin role only for the events they are assigned to.",
            "Can do everything the other event roles can, for that event.",
            "Gives other people their roles for that event.",
            "The only event role that can add someone at the gate who isn't on the roster."
        ]
    },
    {
        key: "scoring-team",
        name: "Scoring Team",
        summary: "The Scoring Team enters scores at the scoring center. Nobody enters scores in the field.",
        details: [
            "Enters, reviews, reopens and corrects scores for every station.",
            "Uses the Score Finalizer and Event Reports.",
            "Can also check patrols in and out at any station."
        ]
    },
    {
        key: "station",
        name: "Station Lead and Station Volunteer",
        summary: "Station staff check patrols in and out at any station.",
        details: [
            "No access to scoring. Scores go to the Scoring Team.",
            "The two roles have the same access for now. Station Leads will get extra permissions later."
        ]
    },
    {
        key: "command-center",
        name: "Command Center",
        summary: "Command Center volunteers track patrols on the night and can create and edit patrols.",
        details: [
            "Uses the Patrol Manager.",
            "The Command Center page itself (send-out, return, skipped stations) is still being built."
        ]
    },
    {
        key: "gate-checkin",
        name: "Gate Check-In",
        summary: "Gate Check-In volunteers check people in as they arrive. This role used to be called Event Operations.",
        details: [
            "Uses Gate Check-In and the Arrivals Dashboard."
        ]
    },
    {
        key: "patrol-management",
        name: "Patrol Management",
        summary: "Patrol Management users register patrols and keep their details up to date.",
        details: [
            "Creates and edits patrols in the Patrol Manager."
        ]
    },
    {
        key: "user",
        name: "Standard User",
        summary: "Signed in, with no role for the selected event.",
        details: [
            "Can see events, stations and patrols, including patrol phone and radio details.",
            "Can watch Live Status."
        ]
    },
    {
        key: "pending",
        name: "Pending approval",
        summary: "New accounts wait here until an admin approves them.",
        details: [
            "Sees only the pending approval screen until approved."
        ]
    }
];


// Columns of the quick reference grid, in display order.
export const GRID_ROLES = [
    { key: "system-admin", label: "System Admin" },
    { key: "event-admin", label: "Event Admin" },
    { key: "scoring-team", label: "Scoring Team" },
    { key: "station", label: "Station Lead / Volunteer" },
    { key: "command-center", label: "Command Center" },
    { key: "gate-checkin", label: "Gate Check-In" },
    { key: "patrol-management", label: "Patrol Mgmt" },
    { key: "user", label: "Standard User" }
];


const ALL = GRID_ROLES.map(role => role.key);
const ADMINS = ["system-admin", "event-admin"];
const SCORING = [...ADMINS, "scoring-team"];


// `roles` lists who has the screen. `partial` marks roles that can reach it
// with a caveat, explained in `note`.
export const ROLE_GRID = [
    {
        section: "Everyday",
        rows: [
            { screen: "Dashboard, Events, Patrols, Stations", roles: ALL },
            { screen: "Patrol phone and radio details", roles: ALL },
            { screen: "Live Status", roles: ALL }
        ]
    },
    {
        section: "Stations",
        rows: [
            { screen: "Station Check In / Check Out", roles: [...SCORING, "station"] }
        ]
    },
    {
        section: "Scoring",
        rows: [
            { screen: "Scoring (enter scores)", roles: SCORING },
            { screen: "Review Entries", roles: SCORING },
            { screen: "Reopen a finished station attempt", roles: SCORING }
        ]
    },
    {
        section: "Gate",
        rows: [
            { screen: "Gate Check-In", roles: [...ADMINS, "gate-checkin"] },
            { screen: "Arrivals Dashboard", roles: [...ADMINS, "gate-checkin"] },
            { screen: "Add someone at the gate who isn't on the roster", roles: ADMINS }
        ]
    },
    {
        section: "Administration",
        rows: [
            { screen: "Admin Dashboard", roles: ADMINS },
            { screen: "Event Manager", roles: ADMINS },
            { screen: "Station Manager", roles: ADMINS },
            { screen: "Patrol Manager (create and edit patrols)", roles: [...ADMINS, "command-center", "patrol-management"] },
            { screen: "Import Roster", roles: ADMINS },
            { screen: "User Manager", roles: ADMINS },
            { screen: "Configuration Manager", roles: ["system-admin"] }
        ]
    },
    {
        section: "Reports & Finalization",
        rows: [
            { screen: "Event Reports", roles: SCORING },
            { screen: "Score Finalizer", roles: SCORING }
        ]
    }
];
