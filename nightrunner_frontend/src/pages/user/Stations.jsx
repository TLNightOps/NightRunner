import {
    useEffect,
    useState
} from "react";

import "./Stations.css";

import ApiService from "../../api/ApiService.js";

import {
    useEventContext
} from "../../api/helpers/event/EventContext.jsx";

export default function Stations() {

    const {
        eventId,
        event,
        loading: eventLoading,
        error: eventError
    } = useEventContext();

    const [stations, setStations] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState(null);


    useEffect(() => {

        /*
         * Do not attempt to load stations until the
         * EventContext has resolved the selected event.
         */
        if (eventLoading) {
            return;
        }

        if (eventError) {

            setError(eventError);
            setStations([]);
            setLoading(false);

            return;

        }

        if (!eventId) {

            setError(
                "No event is currently selected."
            );

            setStations([]);
            setLoading(false);

            return;

        }

        loadStations(eventId);

    }, [
        eventId,
        eventLoading,
        eventError
    ]);


    async function loadStations(selectedEventId) {

        try {

            setLoading(true);
            setError(null);

            const response =
                await ApiService.stationData.getStations(
                    selectedEventId
                );

            setStations(
                response ?? []
            );

        }
        catch (error) {

            console.error(
                "Failed to load stations:",
                error
            );

            setError(
                error?.message ??
                "Unable to load stations."
            );

            setStations([]);

        }
        finally {

            setLoading(false);

        }

    }


    if (
        eventLoading ||
        loading
    ) {

        return (

            <div className="stations-page">

                <div className="loading-panel">

                    Loading stations...

                </div>

            </div>

        );

    }


    return (

        <div className="stations-page">

            <div className="page-header">

                <div>

                    <h1>Stations</h1>

                    <p>
                        Stations available during this event.
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

                    <strong>
                        {event.name}
                    </strong>

                </div>

            )}


            {!error && stations.length === 0 && (

                <div className="empty-panel">

                    <h2>No Stations</h2>

                    <p>
                        There are currently no stations configured
                        for this event.
                    </p>

                </div>

            )}


            {!error && stations.length > 0 && (

                <div className="station-grid">

                    {stations.map(station => (

                        <div
                            className="station-card"
                            key={station.id}
                        >

                            <div className="station-card-header">

                                <h2>
                                    {station.name}
                                </h2>

                            </div>


                            <div className="station-card-body">

                                {station.description ? (

                                    <p className="station-description">

                                        {station.description}

                                    </p>

                                ) : (

                                    <p className="station-description muted">

                                        No description available.

                                    </p>

                                )}

                                <div className="station-info">
                                    <div>

                                        <span>
                                            Station Staff
                                        </span>

                                        <strong>
                                            {station.members?.length ?? 0}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}