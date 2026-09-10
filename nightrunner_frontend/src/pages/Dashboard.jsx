import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ApiService from "../api/ApiService.js";
import {
    useEventContext
} from "../api/helpers/event/EventContext.jsx";

import "./Dashboard.css";

export default function Dashboard() {

    const navigate = useNavigate();

    const {
        event,
        eventId,
        loading: eventLoading,
        error: eventError
    } = useEventContext();

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState(null);


    useEffect(() => {

        /*
         * The EventContext is responsible for resolving
         * the currently selected event.
         *
         * Once an event is available, the dashboard can
         * use it directly.
         */
        if (eventLoading) {
            return;
        }

        if (eventError) {

            setError(eventError);
            setLoading(false);

            return;

        }

        if (!eventId || !event) {

            setError(
                "No event is currently selected."
            );

            setLoading(false);

            return;

        }

        setError(null);
        setLoading(false);

    }, [
        event,
        eventId,
        eventLoading,
        eventError
    ]);


    if (
        loading ||
        eventLoading
    ) {

        return (

            <div className="dashboard">

                <div className="dashboard-top">

                    <div>

                        <h1>Dashboard</h1>

                        <p>
                            Loading event information...
                        </p>

                    </div>

                </div>

            </div>

        );

    }


    return (

        <div className="dashboard">

            <div className="dashboard-top">

                <div>

                    <h1>Dashboard</h1>

                    <p>
                        Your Night Runner event information.
                    </p>

                </div>

            </div>


            {error && (

                <div className="error-banner">

                    {error}

                </div>

            )}


            {!error && event && (

                <>

                    {/* Current Event */}

                    <section className="dashboard-section">

                        <div className="card">

                            <div className="section-header">

                                <div>

                                    <h2>Current Event</h2>

                                    <p>
                                        The event you are currently
                                        participating in.
                                    </p>

                                </div>

                            </div>


                            <div className="event-information">

                                <div className="information-item">

                                    <span className="information-label">
                                        Event
                                    </span>

                                    <strong>
                                        {event.name}
                                    </strong>

                                </div>


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

                    </section>


                    {/* Event Access */}

                    <section className="dashboard-section">

                        <div className="card">

                            <div className="section-header">

                                <div>

                                    <h2>Event Information</h2>

                                    <p>
                                        View information about events,
                                        patrols, and scoring.
                                    </p>

                                </div>

                            </div>


                            <div className="dashboard-action-grid">

                                <button
                                    className="dashboard-action-card"
                                    onClick={() =>
                                        navigate("/events")
                                    }
                                >

                                    <div>

                                        <h3>
                                            Events
                                        </h3>

                                        <p>
                                            View known events and
                                            information about the
                                            current event.
                                        </p>

                                    </div>

                                    <span>
                                        →
                                    </span>

                                </button>


                                <button
                                    className="dashboard-action-card"
                                    onClick={() =>
                                        navigate("/live")
                                    }
                                >

                                    <div>

                                        <h3>
                                            Live Scoring
                                        </h3>

                                        <p>
                                            View patrol progress
                                            during the event.
                                        </p>

                                    </div>

                                    <span>
                                        →
                                    </span>

                                </button>


                                <button
                                    className="dashboard-action-card"
                                    onClick={() =>
                                        navigate("/patrols")
                                    }
                                >

                                    <div>

                                        <h3>
                                            Patrols
                                        </h3>

                                        <p>
                                            View the patrols
                                            participating in this event.
                                        </p>

                                    </div>

                                    <span>
                                        →
                                    </span>

                                </button>


                                <button
                                    className="dashboard-action-card"
                                    onClick={() =>
                                        navigate("/stations")
                                    }
                                >

                                    <div>

                                        <h3>
                                            Stations
                                        </h3>

                                        <p>
                                            View scoring stations
                                            and requirements.
                                        </p>

                                    </div>

                                    <span>
                                        →
                                    </span>

                                </button>


                                <button
                                    className="dashboard-action-card"
                                    onClick={() =>
                                        navigate("/scoring")
                                    }
                                >

                                    <div>

                                        <h3>
                                            Scoring
                                        </h3>

                                        <p>
                                            Check in, score, and
                                            check out of stations.
                                        </p>

                                    </div>

                                    <span>
                                        →
                                    </span>

                                </button>

                            </div>

                        </div>

                    </section>

                </>

            )}

        </div>

    );

}