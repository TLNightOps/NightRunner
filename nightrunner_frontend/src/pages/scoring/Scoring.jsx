import { useEffect, useState } from "react";

import ApiService from "../../api/ApiService.js";
import { useEventContext } from "../../api/helpers/event/EventContext.jsx";

import DataSelector from "../../api/helpers/qr/DataSelector.jsx";
import ScoreForm from "./ScoreForm";

import "./Scoring.css";

export default function Scoring() {
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

    const [selectedPatrol, setSelectedPatrol] = useState(null);
    const [selectedStation, setSelectedStation] = useState(null);

    const [scoringStarted, setScoringStarted] = useState(false);

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
        setScoringStarted(false);

        loadData(eventId);
    }, [eventId, eventLoading, eventError]);

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

            setPatrols(patrolResponse ?? []);
            setStations(stationResponse ?? []);
        } catch (error) {
            console.error(
                "Failed to load scoring data:",
                error
            );

            setError(
                error?.message ??
                "Unable to load scoring data."
            );

            setPatrols([]);
            setStations([]);
        } finally {
            setLoading(false);
        }
    }

    function handlePatrolSelection(patrol) {
        setSelectedPatrol(patrol);
        setScoringStarted(false);
    }

    function handleStationSelection(station) {
        setSelectedStation(station);
        setScoringStarted(false);
    }

    async function startScoring() {
        if (!selectedPatrol || !selectedStation) {
            return;
        }

        // TODO:
        // await ApiService.scoreData.start({
        //     patrolId: selectedPatrol.id,
        //     stationId: selectedStation.id,
        //     eventId,
        //     timestamp: new Date().toISOString()
        // });

        setScoringStarted(true);
    }

    return (
        <div className="scoring-page">

            <div className="page-header">

                <div>

                    <h1>
                        Scoring
                    </h1>

                    <p>
                        Record patrol scores for each station.
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
                    {!scoringStarted ? (
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
                        </>
                    ) : (
                        <div className="score-selection-card">

                            <h2>
                                Currently Scoring
                            </h2>

                            <div className="selected-data">

                                <span>
                                    📝
                                </span>

                                <div>

                                    <small>
                                        Patrol
                                    </small>

                                    <div>
                                        {selectedPatrol.name}
                                    </div>

                                </div>

                            </div>

                            <div className="selected-data">

                                <span>
                                    📍
                                </span>

                                <div>

                                    <small>
                                        Station
                                    </small>

                                    <div>
                                        {selectedStation.name}
                                    </div>

                                </div>

                            </div>

                        </div>
                    )}

                    {selectedPatrol && selectedStation ? (
                        scoringStarted ? (
                            <ScoreForm
                                patrol={selectedPatrol}
                                station={selectedStation}
                            />
                        ) : (
                            <div className="ready-panel">

                                <h2>
                                    Ready to Begin
                                </h2>

                                <p>

                                    <strong>
                                        Patrol:
                                    </strong>{" "}
                                    {selectedPatrol.name}

                                    <br />

                                    <strong>
                                        Station:
                                    </strong>{" "}
                                    {selectedStation.name}

                                </p>

                                <button
                                    className="primary-button"
                                    onClick={startScoring}
                                >
                                    Start Scoring
                                </button>

                            </div>
                        )
                    ) : (
                        <div className="empty-panel">

                            <h2>
                                Ready to Score
                            </h2>

                            <p>
                                Select a patrol and station to begin scoring.
                            </p>

                        </div>
                    )}
                </>
            )}

        </div>
    );
}