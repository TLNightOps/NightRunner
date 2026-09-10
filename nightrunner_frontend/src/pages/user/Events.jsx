import { useEffect, useState } from "react";

import ApiService from "../../api/ApiService.js";
import { useEventContext } from "../../api/helpers/event/EventContext.jsx";

import "./Events.css";

export default function Events() {
    const {
        event: currentEvent,
        eventId,
        loading: eventLoading,
        error: eventError
    } = useEventContext();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [events, setEvents] = useState([]);

    useEffect(() => {
        if (eventLoading) {
            return;
        }

        if (eventError) {
            setError(eventError);
            setLoading(false);
            return;
        }

        loadEvents();
    }, [eventLoading, eventError]);

    async function loadEvents() {
        try {
            setLoading(true);
            setError(null);

            const eventsResponse =
                await ApiService.eventData.getEvents();

            const knownEvents =
                Array.isArray(eventsResponse)
                    ? eventsResponse
                    : eventsResponse?.events ?? [];

            setEvents(knownEvents);
        } catch (error) {
            console.error(
                "Failed to load events:",
                error
            );

            setError(
                error?.message ??
                "Failed to load events."
            );
        } finally {
            setLoading(false);
        }
    }

    if (eventLoading || loading) {
        return (
            <div className="events">
                <div className="events-top">
                    <div>
                        <h1>Events</h1>
                        <p>
                            View known Night Runner events.
                        </p>
                    </div>
                </div>

                <div className="card">
                    <p className="events-loading">
                        Loading events...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="events">
            <div className="events-top">
                <div>
                    <h1>Events</h1>
                    <p>
                        View known Night Runner events.
                    </p>
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    {error}
                </div>
            )}

            {!error && (
                <>
                    {/* Current Event */}

                    {currentEvent && (
                        <section className="events-section">
                            <div className="card current-event-card">
                                <div className="section-header">
                                    <div>
                                        <span className="current-event-label">
                                            Current Event
                                        </span>

                                        <h2>
                                            {currentEvent.name}
                                        </h2>

                                        <p>
                                            This is the event currently
                                            selected for your account.
                                        </p>
                                    </div>
                                </div>

                                <div className="event-information">
                                    <div className="information-item">
                                        <span className="information-label">
                                            Date
                                        </span>

                                        <strong>
                                            {currentEvent.date}
                                        </strong>
                                    </div>

                                    {currentEvent.location && (
                                        <div className="information-item">
                                            <span className="information-label">
                                                Location
                                            </span>

                                            <strong>
                                                {currentEvent.location}
                                            </strong>
                                        </div>
                                    )}

                                    {currentEvent.description && (
                                        <div className="information-item information-item-full">
                                            <span className="information-label">
                                                About
                                            </span>

                                            <p>
                                                {currentEvent.description}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Known Events */}

                    <section className="events-section">
                        <div className="section-heading">
                            <div>
                                <h2>
                                    Known Events
                                </h2>

                                <p>
                                    Events currently known to Night Runner.
                                </p>
                            </div>
                        </div>

                        {events.length === 0 ? (
                            <div className="card">
                                <p className="empty-state">
                                    No events are currently available.
                                </p>
                            </div>
                        ) : (
                            <div className="events-list">
                                {events.map(event => {
                                    const isCurrent =
                                        String(currentEvent?.id) ===
                                        String(event.id);

                                    return (
                                        <div
                                            key={event.id}
                                            className={
                                                `card event-card ${
                                                    isCurrent
                                                        ? "event-card-current"
                                                        : ""
                                                }`
                                            }
                                        >
                                            <div className="event-card-header">
                                                <div>
                                                    <h3>
                                                        {event.name}
                                                    </h3>

                                                    {isCurrent && (
                                                        <span className="event-badge">
                                                            Current Event
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="event-card-information">
                                                <div className="information-item">
                                                    <span className="information-label">
                                                        Date
                                                    </span>

                                                    <strong>
                                                        {event.date}
                                                    </strong>
                                                </div>

                                                {event.location && (
                                                    <div className="information-item">
                                                        <span className="information-label">
                                                            Location
                                                        </span>

                                                        <strong>
                                                            {event.location}
                                                        </strong>
                                                    </div>
                                                )}

                                                {event.description && (
                                                    <div className="information-item information-item-full">
                                                        <span className="information-label">
                                                            About
                                                        </span>

                                                        <p>
                                                            {event.description}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}