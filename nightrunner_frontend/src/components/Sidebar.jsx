import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "react-oidc-context";

import "./Sidebar.css";
import AuthService from "../api/auth/AuthService.js";
import ApiService from "../api/ApiService.js";
import {
    ACCESS,
    AppRoutes
} from "../AppRoutes.jsx";


function canAccess(route) {

    if (
        route.access === ACCESS.PUBLIC
    ) {
        return true;
    }

    const cachedUser = ApiService.userData.getCached();

    if (
        !cachedUser
    ) {
        return false;
    }

    if (cachedUser.status === "pending") {
        return false;
    }

    if (
        route.access === ACCESS.SYSTEM_ADMIN
    ) {
        return ApiService.userData
            .isSystemAdmin();
    }

    if (
        route.access === ACCESS.ADMIN
    ) {
        return ApiService.userData
            .isAdmin();
    }

    if (
        route.access === ACCESS.USER
    ) {
        return true;
    }

    return false;

}


function Sidebar({ open, close }) {

    const auth =
        useAuth();

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
        ApiService.userData.isAdmin();


    const links =
        AppRoutes.filter(
            route =>
                route.name &&
                canAccess(route) &&
                (
                    loggedIn ||
                    route.access === ACCESS.PUBLIC
                )
        );

    const dashboardLink =
        links.find(route => route.path === "/dashboard");

    const mainLinks =
        links.filter(
            route =>
                !route.path.startsWith("/admin") &&
                route.path !== "/scoring" &&
                route.path !== "/live" &&
                route.path !== "/login" &&
                route.path !== "/checkin"
        );


    const scoringLinks =
        links.filter(
            route =>
                route.path === "/scoring" ||
                route.path === "/live" ||
                route.path === "/checkin"
        );


    const adminLinks =
        links.filter(
            route =>
                route.path.startsWith("/admin")
        );


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

                    {isAdmin && dashboardLink && (
                        <section className="sidebar-section">
                            <div className="sidebar-section-title">
                                Main
                            </div>
                            {renderLink(dashboardLink)}
                        </section>
                    )}

                    {!isAdmin && mainLinks.length > 0 && (
                        <section className="sidebar-section">

                            <div className="sidebar-section-title">
                                Main
                            </div>

                            {mainLinks.map(renderLink)}

                        </section>
                    )}


                    {scoringLinks.length > 0 && (
                        <section className="sidebar-section">

                            <div className="sidebar-section-title">
                                Scoring
                            </div>

                            {scoringLinks.map(renderLink)}

                        </section>
                    )}


                    {isAdmin && adminLinks.length > 0 && (
                        <section className="sidebar-section sidebar-section-admin">

                            <div className="sidebar-section-title">
                                Administration
                            </div>

                            {adminLinks.map(renderLink)}

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