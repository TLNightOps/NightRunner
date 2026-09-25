// Content for the Help & Docs page. Edit this file to update the page; the
// component only lays it out.
//
// Describe what the app does TODAY, not what is planned. The role → screen
// matrix is being reworked (#236); when that lands, update ROLES and
// ROLE_GRID to match. Grid access is taken from `access` in AppRoutes.jsx
// plus the Sidebar's `adminOnly` groups — note the route guard in App.jsx
// only checks sign-in, so the grid describes what each role sees in the menu.

export const HELP_UPDATED = "September 2026";


export const ROLES = [
    {
        key: "system-admin",
        name: "System Admin",
        summary: "System Admins have full access to all functions of the program, across every event.",
        details: [
            "Sees every event, including new events that have no Event Admin yet.",
            "The only role that can open the Configuration Manager.",
            "Approves new accounts, blocks users, and grants System Admin to others.",
            "Can reopen a finished station attempt at any time."
        ]
    },
    {
        key: "event-admin",
        name: "Event Admin",
        summary: "Event Admins run a single event: its stations, patrols, users, scoring, and reports.",
        details: [
            "Has the Event Admin role only for the events they are assigned to.",
            "Can use every Administration and Reports screen for that event.",
            "Assigns roles to other users for that event.",
            "Cannot change system-wide configurations."
        ]
    },
    {
        key: "event-ops",
        name: "Event Operations",
        summary: "Event Operations staff work the gate, checking people in as they arrive.",
        details: [
            "Gets the Gate Check-In and Arrivals Dashboard screens.",
            "Also has everything a Standard User has."
        ]
    },
    {
        key: "patrol-management",
        name: "Patrol Management",
        summary: "Patrol Management users register patrols and keep their details up to date.",
        details: [
            "Can create and edit patrols on the Patrol Manager screen.",
            "Patrol Manager does not show in their menu yet. Share the direct link: /admin/patrols.",
            "Also has everything a Standard User has."
        ]
    },
    {
        key: "scoring-station",
        name: "Scoring and station roles",
        summary: "Scoring Lead, Scoring Center, Scorer, Station Lead, and Station Volunteer currently have the same access as a Standard User.",
        details: [
            "These roles can be assigned in the User Manager today.",
            "Separate permissions for each one are planned but not built yet."
        ]
    },
    {
        key: "user",
        name: "Standard User",
        summary: "Standard Users check patrols in and out of stations and enter scores.",
        details: [
            "Can view events, patrols, and stations.",
            "Can score, review score entries, and watch Live Status.",
            "Can reopen a station attempt within 5 minutes of finishing it. After that, a System Admin has to reopen it."
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
    { key: "event-ops", label: "Event Ops" },
    { key: "patrol-management", label: "Patrol Mgmt" },
    { key: "scoring-station", label: "Scoring & Station" },
    { key: "user", label: "Standard User" }
];


const ALL = GRID_ROLES.map(role => role.key);
const ADMINS = ["system-admin", "event-admin"];


// `roles` lists who has the screen. `partial` marks roles that can reach it
// with a caveat, explained in `note`.
export const ROLE_GRID = [
    {
        section: "Everyday",
        rows: [
            { screen: "Dashboard, Events, Patrols, Stations", roles: ALL },
            { screen: "Scoring and Review Entries", roles: ALL },
            { screen: "Station Check In / Check Out", roles: ALL },
            { screen: "Live Status", roles: ALL }
        ]
    },
    {
        section: "Event Operations",
        rows: [
            { screen: "Gate Check-In", roles: [...ADMINS, "event-ops"] },
            { screen: "Arrivals Dashboard", roles: [...ADMINS, "event-ops"] }
        ]
    },
    {
        section: "Administration",
        rows: [
            { screen: "Admin Dashboard", roles: ADMINS },
            { screen: "Event Manager", roles: ADMINS },
            { screen: "Station Manager", roles: ADMINS },
            {
                screen: "Patrol Manager",
                roles: ADMINS,
                partial: ["patrol-management"],
                note: "Not in the Patrol Management menu yet. Use the direct link /admin/patrols."
            },
            { screen: "Import Roster", roles: ADMINS },
            { screen: "User Manager", roles: ADMINS },
            { screen: "Configuration Manager", roles: ["system-admin"] }
        ]
    },
    {
        section: "Reports & Finalization",
        rows: [
            { screen: "Event Reports", roles: ADMINS },
            { screen: "Score Finalizer", roles: ADMINS }
        ]
    },
    {
        section: "Station fixes",
        rows: [
            {
                screen: "Reopen a station attempt (within 5 minutes)",
                roles: ALL
            },
            {
                screen: "Reopen a station attempt (after 5 minutes)",
                roles: ["system-admin"]
            }
        ]
    }
];
