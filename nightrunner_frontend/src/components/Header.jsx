import {useRef, useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import "./header.css";

import ApiService from "../api/ApiService.js";
import {useEventContext} from "../api/helpers/event/EventContext.jsx";

function Header({
                    sidebarOpen,
                    setSidebarOpen
                }) {

    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);
    const navigate = useNavigate();


    //
    // Event context
    //

    const {
        event,
        changeEvent,
    } = useEventContext();


    //
    // User profile
    //

    const profile = ApiService.auth.getProfile();
    const username = profile?.name ?? profile?.preferred_username ?? "User";

    const cachedUser = ApiService.userData.getCached();
    const displayName = cachedUser?.displayName ?? username;

    // Close the dropdown when the user clicks outside of it
    useEffect(() => {

        function handleOutsideClick(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpen(false);
            }
        }

        if (open) {
            document.addEventListener("mousedown", handleOutsideClick);
        }

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
        };

    }, [open]);

    function handleProfile() {
        setOpen(false);
        navigate("/me");
    }


    //
    // Change event
    //

    function handleChangeEvent() {

        setOpen(false);

        changeEvent();

    }


    //
    // Sign out
    //

    async function handleSignOut() {
        setOpen(false);
        await ApiService.auth.logout();
    }

    return (

        <header className="header">

            <div className="header-left">

                <button
                    className="sidebar-toggle"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label="Toggle navigation"
                >

                    ☰

                </button>

                <h2>
                    Night Runner
                </h2>

            </div>

            {ApiService.auth.isAuthenticated() && (
                <div
                    className="header-user-menu"
                    ref={menuRef}
                >
                    <button
                        className={`header-user${open ? " active" : ""}`}
                        onClick={() => setOpen(o => !o)}
                        aria-haspopup="true"
                        aria-expanded={open}
                        aria-label="User menu"
                    >

                        <svg
                            className="header-user-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                        >

                            <circle
                                cx="12"
                                cy="8"
                                r="4"
                                stroke="currentColor"
                                strokeWidth="2"
                            />

                            <path
                                d="M4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />

                        </svg>

                        <span className="header-user-name">
                        {username}
                    </span>

                        <svg
                            className={`header-user-caret${open ? " open" : ""}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                        >
                            <path
                                d="M6 9L12 15L18 9"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />

                        </svg>

                    </button>


                    {open && (

                        <div
                            className="header-user-dropdown"
                            role="menu"
                        >

                            <div
                                className="header-dropdown-display-name"
                                role="presentation"
                            >
                                {displayName}
                            </div>


                            {/* If an event is available, display it */}
                            {event && (

                                <div
                                    className="header-dropdown-event"
                                    role="presentation"
                                >
                                    {event.name}
                                </div>

                            )}


                            <hr className="header-dropdown-divider"/>


                            {/* If user is not pending, show Change Event */}
                            {cachedUser?.status !== "pending" && (
                                <button
                                    className="header-dropdown-item"
                                    role="menuitem"
                                    onClick={handleChangeEvent}
                                >
                                    Change Event
                                </button>
                            )}

                            <button
                                className="header-dropdown-item"
                                role="menuitem"
                                onClick={handleProfile}
                            >
                                My Profile
                            </button>

                            <hr className="header-dropdown-divider"/>

                            <button
                                className="header-dropdown-item header-dropdown-item--danger"
                                role="menuitem"
                                onClick={handleSignOut}
                            >
                                Sign Out
                            </button>

                        </div>

                    )}

                </div>
            )}

        </header>

    );

}

export default Header;