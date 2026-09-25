import Dashboard from "./pages/Dashboard.jsx";
import Me from "./pages/Me.jsx";
import Help from "./pages/help/Help.jsx";
import Events from "./pages/user/Events.jsx";
import Patrols from "./pages/user/Patrols.jsx";
import Stations from "./pages/user/Stations.jsx";
import Scoring from "./pages/scoring/Scoring.jsx";
import StationReview from "./pages/scoring/review/StationReview.jsx";

import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import EventManager from "./pages/admin/events/EventManager.jsx";
import EventCreator from "./pages/admin/events/EventCreator.jsx";
import PatrolsAdmin from "./pages/admin/patrols/Patrols.jsx";
import PatrolEditor from "./pages/admin/patrols/PatrolEditor.jsx";
import StationsAdmin from "./pages/admin/stations/Stations.jsx";
import StationEditor from "./pages/admin/stations/StationEditor.jsx";
import UserManager from "./pages/admin/user/UserManager.jsx";
import Finalizer from "./pages/admin/reports/Finalizer.jsx";
import Reports from "./pages/admin/reports/Reports.jsx";
import PrintReport from "./pages/admin/reports/PrintReport.jsx";
import ViewFinalReport from "./pages/admin/reports/ViewFinalReport.jsx";
import Configurations from "./pages/admin/configurations/Configurations.jsx";
import ConfigurationEditor from "./pages/admin/configurations/ConfigurationEditor.jsx";

import Login from "./pages/login/Login.jsx";
import Register from "./pages/login/Register.jsx";
import Callback from "./pages/Callback.jsx";
import PendingApproval from "./pages/PendingApproval.jsx";

import LiveStatus from "./pages/scoring/live/LiveStatus.jsx";
import PublicProgress from "./pages/public/PublicProgress.jsx";
import PublicCheckIn from "./pages/public/PublicCheckIn.jsx";
import CheckInOut from "@/pages/checkin/CheckInOut.jsx";
import RosterImport from "./pages/admin/roster/RosterImport.jsx";
import Arrivals from "./pages/arrivals/Arrivals.jsx";
import ArrivalsPrint from "./pages/arrivals/ArrivalsPrint.jsx";
import ArrivalsDashboard from "./pages/arrivals/ArrivalsDashboard.jsx";


// Who can open each route. The role groups behind these live in lib/roles.js
// (see canAccess in components/Sidebar.jsx); the backend enforces the same
// groups on its write endpoints.
export const ACCESS = {
    PUBLIC: "public",
    USER: "user",
    STATION: "station",
    SCORING: "scoring",
    GATE_CHECKIN: "gate-checkin",
    PATROL_MANAGER: "patrol-manager",
    ADMIN: "admin",
    SYSTEM_ADMIN: "system-admin"
};


export const AppRoutes = [

    {
        path: "/",
        element: Dashboard,
        access: ACCESS.USER,
        redirect: "/dashboard"
    },


    // Authentication

    {
        path: "/login",
        element: Login,
        name: "Login",
        access: ACCESS.PUBLIC,
        anonymous: true
    },
    {
        path: "/register",
        element: Register,
        access: ACCESS.PUBLIC,
        anonymous: true
    },
    {
        path: "/callback",
        element: Callback,
        access: ACCESS.PUBLIC
    },
    {
        path: "/pending",
        element: PendingApproval,
        access: ACCESS.USER
    },

    // Application

    {
        path: "/dashboard",
        element: Dashboard,
        name: "Dashboard",
        access: ACCESS.USER,
        exact: true
    },
    {
        path: "/events",
        element: Events,
        name: "Events",
        access: ACCESS.USER
    },
    {
        path: "/patrols",
        element: Patrols,
        name: "Patrols",
        access: ACCESS.USER
    },
    {
        path: "/stations",
        element: Stations,
        name: "Stations",
        access: ACCESS.USER
    },
    {
        path: "/scoring",
        element: Scoring,
        name: "Scoring",
        access: ACCESS.SCORING,
        // Otherwise the sidebar marks Scoring active on /scoring/review too.
        exact: true
    },
    {
        path: "/scoring/review",
        element: StationReview,
        name: "Review Entries",
        access: ACCESS.SCORING
    },
    {
        path: "/checkin",
        element: CheckInOut,
        name: "Check In / Check Out",
        access: ACCESS.STATION
    },
    {
        path: "/me",
        element: Me,
        access: ACCESS.USER
    },
    {
        path: "/help",
        element: Help,
        name: "Help & Docs",
        access: ACCESS.USER
    },

    // Live Scoring

    {
        path: "/live",
        element: LiveStatus,
        name: "Live Status",
        access: ACCESS.USER,
        layout: false,
        newTab: true
    },

    // Public links. No login: the token in the URL is the credential, resolved
    // by the backend against event_access_tokens. `layout: false` matters —
    // Layout renders the sidebar and user chrome, which assume a signed-in user.
    // Neither route appears in the sidebar, since neither has a `name`.
    {
        path: "/progress/:token",
        element: PublicProgress,
        access: ACCESS.PUBLIC,
        layout: false
    },
    {
        path: "/checkin/:token",
        element: PublicCheckIn,
        access: ACCESS.PUBLIC,
        layout: false
    },

    // Administration

    {
        path: "/admin",
        element: AdminDashboard,
        name: "Admin Dashboard",
        access: ACCESS.ADMIN,
        exact: true
    },
    {
        path: "/admin/events",
        element: EventManager,
        name: "Event Manager",
        access: ACCESS.ADMIN
    },
    {
        path: "/admin/events/create",
        element: EventCreator,
        access: ACCESS.ADMIN
    },
    {
        path: "/admin/patrols",
        element: PatrolsAdmin,
        name: "Patrol Manager",
        access: ACCESS.PATROL_MANAGER
    },
    {
        path: "/admin/roster",
        element: RosterImport,
        name: "Import Roster",
        access: ACCESS.ADMIN
    },
    {
        path: "/arrivals",
        element: Arrivals,
        name: "Gate Check-In",
        access: ACCESS.GATE_CHECKIN
    },
    {
        path: "/arrivals/print",
        element: ArrivalsPrint,
        access: ACCESS.GATE_CHECKIN,
        layout: false
    },
    {
        path: "/arrivals/dashboard",
        element: ArrivalsDashboard,
        name: "Arrivals Dashboard",
        access: ACCESS.GATE_CHECKIN
    },
    {
        path: "/admin/patrols/create",
        element: () => (
            <PatrolEditor
                mode="create"
            />
        ),
        access: ACCESS.PATROL_MANAGER
    },
    {
        path: "/admin/patrols/edit",
        element: () => (
            <PatrolEditor
                mode="edit"
            />
        ),
        access: ACCESS.PATROL_MANAGER
    },
    {
        path: "/admin/stations",
        element: StationsAdmin,
        name: "Station Manager",
        access: ACCESS.ADMIN
    },
    {
        path: "/admin/stations/create",
        element: StationEditor,
        access: ACCESS.ADMIN
    },
    {
        path: "/admin/stations/edit",
        element: StationEditor,
        access: ACCESS.ADMIN
    },
    {
        path: "/admin/users",
        element: UserManager,
        name: "User Manager",
        access: ACCESS.ADMIN
    },
    {
        path: "/admin/reports",
        element: Reports,
        name: "Event Reports",
        access: ACCESS.SCORING
    },
    {
        path: "/admin/reports/view",
        element: ViewFinalReport,
        access: ACCESS.SCORING
    },
    {
        path: "/admin/finalizer",
        element: Finalizer,
        name: "Score Finalizer",
        access: ACCESS.SCORING
    },
    {
        path: "/reports/print",
        element: PrintReport,
        access: ACCESS.SCORING,
        layout: false
    },
    {
        path: "/admin/configurations",
        element: Configurations,
        name: "Configuration Manager",
        access: ACCESS.SYSTEM_ADMIN
    },
    {
        path: "/admin/configurations/create",
        element: () => (
            <ConfigurationEditor
                mode="create"
            />
        ),
        access: ACCESS.SYSTEM_ADMIN
    },
    {
        path: "/admin/configurations/edit",
        element: () => (
            <ConfigurationEditor
                mode="edit"
            />
        ),
        access: ACCESS.SYSTEM_ADMIN
    }
];