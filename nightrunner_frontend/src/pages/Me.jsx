import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";

import "./Me.css";

import AuthService from "../api/auth/AuthService.js";
import ApiService from "../api/ApiService";

import useBranding from "../branding/UseBranding";
import brandings from "../branding";

export default function Me() {

    const auth = useAuth();

    const {brandingId, changeBranding} = useBranding();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const isAuthenticated = AuthService.isAuthenticated();


    //
    // Load Night Runner application user
    //

    useEffect(() => {

        async function loadUser() {

            try {

                /*
                 * AuthService tells us whether the
                 * identity provider session exists.
                 *
                 * UserService tells us which Night Runner
                 * application account belongs to that identity.
                 */
                if (!isAuthenticated) {

                    throw new Error(
                        "You are not authenticated."
                    );

                }

                const backendUser = await ApiService.userData.get();

                if (!backendUser) {

                    throw new Error(
                        "No Night Runner user account found."
                    );

                }

                setUser(backendUser);

            }
            catch (err) {

                console.error(
                    "Failed to load user profile:",
                    err
                );

                setError(
                    err?.message ??
                    "Failed to load user profile."
                );

            }
            finally {

                setLoading(false);

            }

        }

        /*
         * Authentication state may still be resolving when this component mounts.
         */
        if (!auth.isLoading || isAuthenticated) {

            loadUser();

        }

    }, [
        auth.isLoading,
        isAuthenticated
    ]);

    //
    // Loading
    //

    if (
        auth.isLoading ||
        loading
    ) {

        return (
            <div className="profile-container">

                <div className="profile-card">

                    <h2>
                        Loading profile...
                    </h2>

                </div>

            </div>
        );

    }

    //
    // Authentication error
    //

    if (auth.error) {

        return (
            <div className="profile-container">

                <div className="profile-card error">

                    <h2>
                        Authentication Error
                    </h2>

                    <p>
                        {auth.error.message}
                    </p>

                </div>

            </div>
        );

    }

    //
    // Backend user error
    //

    if (error) {

        return (
            <div className="profile-container">

                <div className="profile-card error">

                    <h2>
                        Error
                    </h2>

                    <p>
                        {error}
                    </p>

                </div>

            </div>
        );

    }

    //
    // Safety check
    //

    if (!user) {

        return (
            <div className="profile-container">
                <div className="profile-card error">
                    <h2>
                        Error
                    </h2>

                    <p>
                        No Night Runner user account found.
                    </p>
                </div>
            </div>
        );

    }

    //
    // Profile information
    //

    const displayName =
        user.displayName ||
        user.username ||
        "User";

    const initial =
        displayName
            .charAt(0)
            .toUpperCase();

    const roles =
        user.roles ?? {};

    const eventEntries =
        Object.entries(roles);

    return (
        <div className="profile-container">
            <div className="profile-card">
                <div className="profile-header">
                    <div className="profile-avatar">
                        {initial}
                    </div>

                    <div className="profile-header-info">
                        <h1>
                            {displayName}
                        </h1>

                        <p>
                            @{user.username}
                        </p>
                    </div>
                </div>

                <div className="profile-details">
                    <div className="profile-field">
                        <span>
                            Email
                        </span>

                        <strong>
                            {user.email}
                        </strong>
                    </div>

                    <div className="profile-field">
                        <span>
                            User ID
                        </span>

                        <strong className="small-text">
                            {user.id}
                        </strong>
                    </div>

                    <div className="profile-field">
                        <span>
                            External ID
                        </span>

                        <strong className="small-text">
                            {user.externalId}
                        </strong>
                    </div>


                    <div className="profile-field">
                        <span>
                            Account
                        </span>

                        <div className="roles">
                            {user.isAdmin === true ? (

                                <span className="role">
                                    System Administrator
                                </span>

                            ) : (

                                <span className="role">
                                    Standard Account
                                </span>

                            )}
                        </div>
                    </div>


                    <div className="profile-field">
                        <span>
                            Event Roles
                        </span>

                        <div className="roles">
                            {eventEntries.length > 0 ? (
                                eventEntries.map(
                                    ([eventId, role]) => (
                                        <span
                                            key={eventId}
                                            className="role"
                                        >
                                            {eventId}: {role}
                                        </span>
                                    )
                                )
                            ) : (
                                <span className="role">
                                    No event roles
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/*
                 * Settings
                 */}

                <div className="profile-settings">
                    <div className="profile-section-header">
                        <h2>
                            Settings
                        </h2>
                    </div>


                    <div className="profile-setting">
                        <div className="profile-setting-info">
                            <strong>
                                Theme
                            </strong>

                            <span>
                                Choose the visual theme used by Night Runner.
                            </span>
                        </div>

                        <select
                            className="theme-select"
                            value={brandingId}
                            onChange={event =>
                                changeBranding(event.target.value)
                            }
                        >
                            {Object.entries(brandings).map(
                                ([id, theme]) => (
                                    <option
                                        key={id}
                                        value={id}
                                    >
                                        {theme.organizationName}
                                    </option>
                                )
                            )}
                         </select>
                    </div>
                </div>
            </div>
        </div>
    );
}