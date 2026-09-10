import { useEffect, useState } from "react";

import ApiService from "../../api/ApiService.js";
import { useEventContext } from "../../api/helpers/event/EventContext.jsx";

import "./Patrols.css";

export default function Patrols() {
    const {
        eventId,
        event,
        loading: eventLoading,
        error: eventError
    } = useEventContext();

    const [patrols, setPatrols] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (eventLoading) {
            return;
        }

        if (eventError) {
            setError(eventError);
            setPatrols([]);
            setLoading(false);
            return;
        }

        if (!eventId) {
            setError("No event is currently selected.");
            setPatrols([]);
            setLoading(false);
            return;
        }

        loadPatrols(eventId);
    }, [eventId, eventLoading, eventError]);

    async function loadPatrols(selectedEventId) {
        try {
            setLoading(true);
            setError(null);

            const response =
                await ApiService.patrolData.getPatrols(
                    selectedEventId
                );

            setPatrols(response ?? []);
        } catch (error) {
            console.error(
                "Failed to load patrols:",
                error
            );

            setError(
                error?.message ??
                "Unable to load patrols."
            );

            setPatrols([]);
        } finally {
            setLoading(false);
        }
    }

    if (eventLoading || loading) {
        return (
            <div className="patrols-page">
                <div className="loading-panel">
                    Loading patrols...
                </div>
            </div>
        );
    }

    return (
        <div className="patrols-page">
            <div className="page-header">
                <div>
                    <h1>Patrols</h1>
                    <p>
                        Patrols participating in this event.
                    </p>
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    {error}
                </div>
            )}

            {!error && event && (
                <div className="event-context">
                    <strong>{event.name}</strong>
                </div>
            )}

            {!error && patrols.length === 0 && (
                <div className="empty-panel">
                    <h2>No Patrols</h2>
                    <p>
                        There are currently no patrols registered
                        for this event.
                    </p>
                </div>
            )}

            {!error && patrols.length > 0 && (
                <div className="patrol-grid">
                    {patrols.map(patrol => (
                        <div
                            className="patrol-card"
                            key={patrol.id}
                        >
                            <div className="patrol-card-header">
                                <h2>
                                    {patrol.name}
                                </h2>
                            </div>

                            <div className="patrol-card-body">
                                <h4>
                                    Troop:{" "}
                                    {patrol.members?.[0]?.troop ?? "Unknown"}
                                </h4>

                                <div className="patrol-member-count">
                                    {patrol.members?.length ?? 0}{" "}
                                    {(patrol.members?.length ?? 0) === 1
                                        ? "Member"
                                        : "Members"}
                                </div>

                                {patrol.members?.length > 0 && (
                                    <ul className="patrol-members">
                                        {patrol.members.map(member => (
                                            <li key={member.id}>
                                                <strong>
                                                    {member.name}
                                                </strong>

                                                {member.rank && (
                                                    <span>
                                                        {" "}— {member.rank}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}