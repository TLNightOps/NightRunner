import { useEffect, useState } from "react";

import ApiService from "../../api/ApiService.js";
import { useEventContext } from "../../api/helpers/event/EventContext.jsx";

import DataSelector from "../../api/helpers/qr/DataSelector.jsx";

import "./CheckInOut.css";

const ACTIONS = {
    CHECK_IN: "check-in",
    CHECK_OUT: "check-out"
};

export default function CheckInOut() {
    const {
        event,
        eventId,
        loading: eventLoading,
        error: eventError
    } = useEventContext();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [patrols, setPatrols] = useState([]);
    const [stations, setStations] = useState([]);

    const [action, setAction] = useState(
        ACTIONS.CHECK_IN
    );

    const [selectedPatrol, setSelectedPatrol] =
        useState(null);

    const [selectedStation, setSelectedStation] =
        useState(null);

    const [completed, setCompleted] =
        useState(false);

    useEffect(() => {
        if (eventLoading) {
            return;
        }

        if (eventError) {
            setError(eventError);
            setPatrols([]);
            setStations([]);
            setLoading(false);
            return;
        }

        if (!eventId) {
            setError("No event is currently selected.");
            setPatrols([]);
            setStations([]);
            setLoading(false);
            return;
        }

        /*
         * The selected event changed.
         *
         * Anything selected from the previous event is
         * no longer valid.
         */
        setSelectedPatrol(null);
        setSelectedStation(null);
        setCompleted(false);

        loadData(eventId);
    }, [
        eventId,
        eventLoading,
        eventError
    ]);

    async function loadData(selectedEventId) {
        try {
            setLoading(true);
            setError(null);

            const [
                patrolResponse,
                stationResponse
            ] = await Promise.all([
                ApiService.patrolData.getPatrols(
                    selectedEventId
                ),
                ApiService.stationData.getStations(
                    selectedEventId
                )
            ]);

            setPatrols(
                patrolResponse ?? []
            );

            setStations(
                stationResponse ?? []
            );
        } catch (error) {
            console.error(
                "Failed to load check-in/out data:",
                error
            );

            setError(
                error?.message ??
                "Unable to load check-in/out data."
            );

            setPatrols([]);
            setStations([]);
        } finally {
            setLoading(false);
        }
    }

    function handleActionChange(nextAction) {
        setAction(nextAction);
        setCompleted(false);
    }

    function handlePatrolSelection(patrol) {
        setSelectedPatrol(patrol);
        setCompleted(false);
    }

    function handleStationSelection(station) {
        setSelectedStation(station);
        setCompleted(false);
    }

    async function handleSubmit() {
        if (
            !selectedPatrol ||
            !selectedStation
        ) {
            return;
        }

        /*
         * Backend integration will go here.
         *
         * Example:
         *
         * if (action === ACTIONS.CHECK_IN) {
         *
         *     await ApiService.checkInData.checkIn({
         *         eventId,
         *         patrolId: selectedPatrol.id,
         *         stationId: selectedStation.id,
         *         timestamp: new Date().toISOString()
         *     });
         *
         * } else {
         *
         *     await ApiService.checkInData.checkOut({
         *         eventId,
         *         patrolId: selectedPatrol.id,
         *         stationId: selectedStation.id,
         *         timestamp: new Date().toISOString()
         *     });
         *
         * }
         */

        setCompleted(true);
    }

    function reset() {
        setSelectedPatrol(null);
        setSelectedStation(null);
        setCompleted(false);
    }

    const actionName =
        action === ACTIONS.CHECK_IN
            ? "Check In"
            : "Check Out";

    const canSubmit =
        selectedPatrol !== null &&
        selectedStation !== null;

    return (
        <div className="checkin-page">

            <div className="page-header">

                <div>

                    <h1>
                        Check In / Check Out
                    </h1>

                    <p>
                        Record when a patrol arrives at or leaves a station.
                    </p>

                </div>

            </div>

            {error && (
                <div className="error-banner">
                    {error}
                </div>
            )}

            {event && !error && (
                <div className="event-context">
                    <strong>
                        {event.name}
                    </strong>
                </div>
            )}

            {eventLoading || loading ? (
                <div className="loading-panel">
                    Loading...
                </div>
            ) : (
                <>
                    <div className="checkin-action-card">

                        <h2>
                            Action
                        </h2>

                        <div className="action-selector">

                            <button
                                type="button"
                                className={
                                    action === ACTIONS.CHECK_IN
                                        ? "action-button active"
                                        : "action-button"
                                }
                                onClick={() =>
                                    handleActionChange(
                                        ACTIONS.CHECK_IN
                                    )
                                }
                            >
                                <span className="action-icon">
                                    ↓
                                </span>

                                <span>
                                    Check In
                                </span>

                                <small>
                                    Patrol arrives
                                </small>
                            </button>

                            <button
                                type="button"
                                className={
                                    action === ACTIONS.CHECK_OUT
                                        ? "action-button active"
                                        : "action-button"
                                }
                                onClick={() =>
                                    handleActionChange(
                                        ACTIONS.CHECK_OUT
                                    )
                                }
                            >
                                <span className="action-icon">
                                    ↑
                                </span>

                                <span>
                                    Check Out
                                </span>

                                <small>
                                    Patrol leaves
                                </small>
                            </button>

                        </div>

                    </div>

                    {!completed ? (
                        <>
                            <DataSelector
                                title="Select Patrol"
                                description="Scan the patrol QR code or select one manually."
                                label="Patrol"
                                items={patrols}
                                selected={selectedPatrol}
                                onSelect={
                                    handlePatrolSelection
                                }
                                displayField="name"
                                allowScan
                            />

                            <DataSelector
                                title="Select Station"
                                label="Station"
                                items={stations}
                                selected={selectedStation}
                                onSelect={
                                    handleStationSelection
                                }
                                displayField="name"
                            />

                            <div className="checkin-submit-panel">

                                <h2>
                                    {actionName}
                                </h2>

                                {canSubmit ? (
                                    <p>
                                        <strong>
                                            {selectedPatrol.name}
                                        </strong>
                                        {" "}
                                        will be marked as{" "}
                                        <strong>
                                            {action === ACTIONS.CHECK_IN
                                                ? "checked in"
                                                : "checked out"}
                                        </strong>
                                        {" "}
                                        at{" "}
                                        <strong>
                                            {selectedStation.name}
                                        </strong>.
                                    </p>
                                ) : (
                                    <p>
                                        Select a patrol and station to continue.
                                    </p>
                                )}

                                <button
                                    type="button"
                                    className="primary-button"
                                    disabled={!canSubmit}
                                    onClick={handleSubmit}
                                >
                                    {actionName}
                                </button>

                            </div>
                        </>
                    ) : (
                        <div className="checkin-complete-panel">

                            <div className="checkin-complete-icon">
                                ✓
                            </div>

                            <h2>
                                {actionName} Complete
                            </h2>

                            <p>
                                <strong>
                                    {selectedPatrol.name}
                                </strong>
                                {" "}
                                has been{" "}
                                {action === ACTIONS.CHECK_IN
                                    ? "checked in"
                                    : "checked out"}
                                {" "}
                                at{" "}
                                <strong>
                                    {selectedStation.name}
                                </strong>.
                            </p>

                            <button
                                type="button"
                                className="primary-button"
                                onClick={reset}
                            >
                                Check Another Patrol
                            </button>

                        </div>
                    )}
                </>
            )}

        </div>
    );
}