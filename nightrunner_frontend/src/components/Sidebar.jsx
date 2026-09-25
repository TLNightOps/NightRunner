import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "react-oidc-context";

import "./Sidebar.css";
import AuthService from "../api/auth/AuthService.js";
import ApiService from "../api/ApiService.js";
import { useEventContext } from "../api/helpers/event/EventContext.jsx";
import {
    ACCESS,
    AppRoutes
} from "../AppRoutes.jsx";


function canAccess(route, eventId = null) {
    if (route.access === ACCESS.PUBLIC) {
        return true;
    }

    const cachedUser = ApiService.userData.getCached();

    if (!cachedUser) {
        return false;
    }

    if (cachedUser.status === "pending") {
        return false;
    }

    if (route.access === ACCESS.SYSTEM_ADMIN) {
        return ApiService.userData.isSystemAdmin();
    }

    if (route.path === "/admin/finalizer") {
        if (ApiService.userData.isSystemAdmin() || ApiService.userData.isAdmin(eventId)) {
            return true;
        }

        const eventRole = ApiService.userData.getEventRole(eventId);
        const rolesList = Array.isArray(eventRole) ? eventRole : [eventRole, ...(cachedUser.roles ? Object.values(cachedUser.roles) : [])];
        return rolesList.some(r => r === "station_leader" || r === "station_member" || r === "scorer" || r === "scoring-center" || r === "event-admin" || r === "admin");
    }

    if (route.access === ACCESS.EVENT_OPS) {
        return ApiService.userData.isEventOps(eventId);
    }

    if (route.access === ACCESS.PATROL_MANAGER) {
        return ApiService.userData.isPatrolManager(eventId);
    }

    if (route.access === ACCESS.ADMIN) {
        return ApiService.userData
            .isAdmin(eventId);
    }

    if (route.access === ACCESS.USER) {
        return true;
    }

    return false;

}


function Sidebar({ open, close }) {

    const auth =
        useAuth();

    const { eventId } = useEventContext();

    const [user, setUser] = useState(() => ApiService.userData.getCached());

    const loggedIn = AuthService.isAuthenticated();

    useEffect(() => {
        const unsubscribe = ApiService.userData.subscribe((u) => setUser(u));

        if (loggedIn) {
            ApiService.userData.get().then(u => setUser(u)).catch(() => {});
        } else {
            setUser(null);
        }

        return () => unsubscribe();
    }, [loggedIn, auth.isAuthenticated]);

    const isAdmin =
        user &&
        ApiService.userData.isAdmin(eventId);

    const links =
        AppRoutes.filter(
            route =>
                route.name &&
                canAccess(route, eventId) &&
                (
                    loggedIn ||
                    route.access === ACCESS.PUBLIC
                )
        );

    const dashboardLink =
        links.find(route => route.path === "/dashboard");

    const helpLink =
        links.find(route => route.path === "/help");

    // Group definitions
    const groupsConfig = [
        {
            key: "operations",
            title: "Event Operations",
            paths: ["/arrivals/dashboard", "/arrivals"]
        },
        {
            key: "scoring",
            title: "Scoring",
            paths: ["/scoring", "/scoring/review", "/live", "/checkin"]
        },
        {
            key: "administration",
            title: "Administration",
            paths: [
                "/admin",
                "/admin/events",
                "/admin/stations",
                "/admin/patrols",
                "/admin/roster",
                "/admin/users",
                "/admin/configurations"
            ],
            adminOnly: true
        },
        {
            key: "reports",
            title: "Reports & Finalization",
            paths: ["/admin/reports", "/admin/finalizer"],
            adminOnly: true
        }
    ];

    // Determine initial collapsed state: auto-expand group if current pathname matches any item in it
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

    const [collapsedGroups, setCollapsedGroups] = useState(() => {
        const initialState = {};
        groupsConfig.forEach(group => {
            const hasActiveRoute = group.paths.some(p => p === currentPath);
            initialState[group.key] = !hasActiveRoute;
        });
        return initialState;
    });

    const toggleGroup = (groupKey) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [groupKey]: !prev[groupKey]
        }));
    };

    function renderLink(route) {

        if (route.external) {

            return (
                <a
                    key={route.path}
                    href={route.path}
                    target={
                        route.newTab
                            ? "_blank"
                            : undefined
                    }
                    rel={
                        route.newTab
                            ? "noopener noreferrer"
                            : undefined
                    }
                    onClick={close}
                    className="sidebar-link"
                >

                    <span>
                        {route.name}
                    </span>

                    {route.newTab && (
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line
                                x1="10"
                                y1="14"
                                x2="21"
                                y2="3"
                            />
                        </svg>
                    )}

                </a>
            );

        }


        return (
            <NavLink
                key={route.path}
                to={route.path}
                end={route.exact}
                onClick={close}
                className={({ isActive }) =>
                    isActive
                        ? "sidebar-link active"
                        : "sidebar-link"
                }
            >
                {route.name}
            </NavLink>
        );

    }


    return (
        <>
            {open && (
                <div
                    className="sidebar-backdrop"
                    onClick={close}
                />
            )}


            <aside
                className={`sidebar ${open ? "open" : ""}`}
            >

                <div className="sidebar-header">

                    <img
                        src="/favicon.jpg"
                        alt="Night Runner"
                        className="sidebar-logo"
                    />

                    <h2>
                        Night Runner
                    </h2>

                </div>


                <nav className="sidebar-nav">

                    {dashboardLink && (
                        <section className="sidebar-section sidebar-section-dashboard">
                            {renderLink(dashboardLink)}
                        </section>
                    )}

                    {groupsConfig.map(group => {
                        if (group.adminOnly && !isAdmin) {
                            return null;
                        }

                        const groupRoutes = group.paths
                            .map(path => links.find(l => l.path === path))
                            .filter(Boolean);

                        if (groupRoutes.length === 0) {
                            return null;
                        }

                        const isCollapsed = !!collapsedGroups[group.key];

                        return (
                            <section key={group.key} className="sidebar-section">
                                <button
                                    type="button"
                                    className="sidebar-section-title sidebar-section-toggle"
                                    onClick={() => toggleGroup(group.key)}
                                    aria-expanded={!isCollapsed}
                                >
                                    <span>{group.title}</span>
                                    <svg
                                        className={`sidebar-chevron ${isCollapsed ? "collapsed" : ""}`}
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>

                                {!isCollapsed && (
                                    <div className="sidebar-group-links">
                                        {groupRoutes.map(renderLink)}
                                    </div>
                                )}
                            </section>
                        );
                    })}

                    {helpLink && (
                        <section className="sidebar-section sidebar-section-dashboard">
                            {renderLink(helpLink)}
                        </section>
                    )}

                </nav>


                <div className="sidebar-footer">

                    <span>
                        Night Runner
                    </span>

                    <small>
                        NightOps Tracking System
                    </small>

                </div>

            </aside>
        </>
    );

}


export default Sidebar;