import {
    useEffect,
    useMemo,
    useState
} from "react";

import { useNavigate } from "react-router-dom";

import ApiService from "../../../api/ApiService.js";
import { useEventContext } from "@/api/helpers/event/EventContext.jsx";

import QRCodeModal from "./QRCodeModal.jsx";

import "./Patrols.css";

export default function Patrols() {
    const navigate = useNavigate();

    const {
        eventId,
        event,
        loading: eventLoading,
        error: eventError
    } = useEventContext();

    const [patrols, setPatrols] = useState([]);
    const [search, setSearch] = useState("");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [qrPatrol, setQrPatrol] = useState(null);

    useEffect(() => {
        if (eventLoading) {
            return;
        }

        if (eventError) {
            setPatrols([]);
            setError(eventError);
            setLoading(false);
            return;
        }

        if (!eventId) {
            setPatrols([]);
            setError("No event is currently selected.");
            setLoading(false);
            return;
        }

        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setError(null);

                const data =
                    await ApiService.patrolData.getPatrols(
                        eventId
                    );

                if (cancelled) {
                    return;
                }

                setPatrols(data ?? []);
            } catch (error) {
                if (cancelled) {
                    return;
                }

                console.error(
                    "Failed to load patrols:",
                    error
                );

                setError(
                    error?.message ??
                    "Failed to load patrols."
                );
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [eventId, eventLoading, eventError]);

    async function deletePatrol(id) {
        const patrol = patrols.find(
            patrol => patrol.id === id
        );

        if (!patrol) {
            return;
        }

        const confirmed = window.confirm(
            `Delete "${patrol.name}"?\n\n` +
            "This action cannot be undone."
        );

        if (!confirmed) {
            return;
        }

        try {
            setError(null);

            await ApiService.patrolData.deletePatrol(id);

            setPatrols(current =>
                current.filter(
                    patrol => patrol.id !== id
                )
            );
        } catch (error) {
            console.error(
                "Failed to delete patrol:",
                error
            );

            setError(
                error?.message ??
                "Failed to delete patrol."
            );
        }
    }

    const filteredPatrols = useMemo(() => {
        const query =
            search.trim().toLowerCase();

        if (!query) {
            return patrols;
        }

        return patrols.filter(patrol =>
            patrol.name
                ?.toLowerCase()
                .includes(query)
        );
    }, [patrols, search]);

    if (eventLoading) {
        return (
            <div className="patrols-page">
                <div className="loading-panel">
                    Loading event...
                </div>
            </div>
        );
    }

    if (eventError) {
        return (
            <div className="patrols-page">
                <div className="error-banner">
                    {eventError}
                </div>
            </div>
        );
    }

    return (
        <div className="patrols-page">
            <header className="page-header">
                <div>
                    <span className="page-eyebrow">
                        Administration
                    </span>

                    <h1>Patrol Manager</h1>

                    <p>
                        Manage patrols participating in{" "}
                        {event?.name ?? "the current event"}.
                    </p>
                </div>

                <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                        navigate("/admin/patrols/create")
                    }
                    disabled={!eventId}
                >
                    + Create Patrol
                </button>
            </header>

            {error && (
                <div className="error-banner">
                    {error}
                </div>
            )}

            <div className="patrol-toolbar">
                <div className="search-wrapper">
                    <svg
                        className="search-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                    >
                        <circle
                            cx="11"
                            cy="11"
                            r="7"
                        />

                        <path d="m20 20-4-4" />
                    </svg>

                    <input
                        className="search-box"
                        type="search"
                        placeholder="Search patrols..."
                        value={search}
                        onChange={event =>
                            setSearch(event.target.value)
                        }
                    />
                </div>

                <span className="patrol-count">
                    {filteredPatrols.length}{" "}
                    {filteredPatrols.length === 1
                        ? "patrol"
                        : "patrols"}
                </span>
            </div>

            <section className="patrol-panel">
                <div className="panel-header">
                    <div>
                        <h2>Patrols</h2>

                        <p>
                            Select a patrol to edit its
                            information and members.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-panel">
                        <span className="loading-spinner" />
                        Loading patrols...
                    </div>
                ) : filteredPatrols.length === 0 ? (
                    <div className="empty-panel">
                        <div className="empty-icon">
                            +
                        </div>

                        <h3>
                            {search
                                ? "No patrols found"
                                : "No patrols yet"}
                        </h3>

                        <p>
                            {search
                                ? "Try a different search."
                                : "Create a patrol to get started."}
                        </p>

                        {!search && (
                            <button
                                type="button"
                                className="primary-button"
                                onClick={() =>
                                    navigate(
                                        "/admin/patrols/create"
                                    )
                                }
                            >
                                Create Patrol
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="patrol-table-wrapper">
                        <table className="patrol-table">
                            <thead>
                            <tr>
                                <th>Patrol</th>
                                <th>Communication Info</th>
                                <th>Members</th>
                                <th>Event</th>
                                <th className="actions-column">
                                    Actions
                                </th>
                            </tr>
                            </thead>

                            <tbody>
                            {filteredPatrols.map(patrol => (
                                <tr key={patrol.id}>
                                    <td>
                                        <div className="patrol-name">
                                            <strong>
                                                {patrol.name}
                                            </strong>
                                        </div>
                                    </td>

                                    <td>
                                        <div style={{ fontSize: "0.85em", lineHeight: "1.3" }}>
                                            {patrol.phoneNumber && (
                                                <div>📱 {patrol.phoneNumber}</div>
                                            )}
                                            {patrol.radioFrequency && (
                                                <div>📻 {patrol.radioFrequency}</div>
                                            )}
                                            {patrol.radioChannel && (
                                                <div>📻 {patrol.radioChannel}</div>
                                            )}
                                            {patrol.hasRadio && (
                                                <div style={{ color: "#2b8a3e" }}>
                                                    Radio Issued: {patrol.radioIdentifier || "Yes"}
                                                </div>
                                            )}
                                            {!patrol.phoneNumber && !patrol.radioFrequency && !patrol.radioChannel && !patrol.hasRadio && (
                                                <span style={{ display: "inline-block", padding: "0.15rem 0.4rem", backgroundColor: "#fff3cd", color: "#856404", border: "1px solid #ffeeba", borderRadius: "4px", fontSize: "0.8em", fontWeight: 600 }}>
                                                    ⚠️ No Comms Set
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    <td>
                                        <span className="member-count">
                                            {patrol.members?.length ?? 0}
                                        </span>{" "}
                                        {patrol.members?.length === 1
                                            ? "member"
                                            : "members"}
                                    </td>

                                    <td>
                                        {patrol.eventName ??
                                            patrol.event ??
                                            event?.name ??
                                            "—"}
                                    </td>

                                    <td>
                                        <div className="row-actions">
                                            <button
                                                type="button"
                                                className="secondary-button small"
                                                onClick={() =>
                                                    setQrPatrol(patrol)
                                                }
                                            >
                                                QR Code
                                            </button>

                                            <button
                                                type="button"
                                                className="secondary-button small"
                                                onClick={() =>
                                                    navigate(
                                                        `/admin/patrols/edit?patrolId=${encodeURIComponent(
                                                            patrol.id
                                                        )}`
                                                    )
                                                }
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                className="danger small"
                                                onClick={() =>
                                                    deletePatrol(
                                                        patrol.id
                                                    )
                                                }
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {qrPatrol && (
                <QRCodeModal
                    patrol={qrPatrol}
                    onClose={() =>
                        setQrPatrol(null)
                    }
                />
            )}
        </div>
    );
}