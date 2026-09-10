import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import ApiService from "../../../api/ApiService.js";
import { useEventContext } from "../../../api/helpers/event/EventContext.jsx";

import StationDetails from "./StationDetails.jsx";

import "./Stations.css";

export default function Stations() {
    const navigate = useNavigate();

    const {
        eventId,
        event,
        loading: eventLoading,
        error: eventError
    } = useEventContext();

    const [stations, setStations] = useState([]);
    const [selectedStation, setSelectedStation] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [search, setSearch] = useState("");

    const [configurations, setConfigurations] = useState([]);

    useEffect(() => {
        if (eventLoading) {
            return;
        }

        if (eventError) {
            setStations([]);
            setSelectedStation(null);
            setError(eventError);
            setLoading(false);
            return;
        }

        if (!eventId) {
            setStations([]);
            setSelectedStation(null);
            setLoading(false);
            setError("No event is currently selected.");
            return;
        }

        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setError(null);

                const [stationResponse, configResponse] =
                    await Promise.all([
                        ApiService.stationData.getStations(eventId),
                        ApiService.configurationData.getConfigurations()
                    ]);

                if (cancelled) {
                    return;
                }

                const loadedStations = stationResponse ?? [];
                const loadedConfigs = Array.isArray(configResponse)
                    ? configResponse
                    : configResponse?.configurations ?? [];

                setStations(loadedStations);
                setConfigurations(loadedConfigs);

                setSelectedStation(current => {
                    if (!current) {
                        return null;
                    }

                    return (
                        loadedStations.find(
                            station =>
                                station.id === current.id
                        ) ?? null
                    );
                });
            } catch (error) {
                if (cancelled) {
                    return;
                }

                console.error(
                    "Failed to load stations:",
                    error
                );

                setError(
                    error?.message ??
                    "Failed to load stations."
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

    async function deleteStation(id) {
        if (!window.confirm(
            "Delete this station? This action cannot be undone."
        )) {
            return;
        }

        try {
            setError(null);

            await ApiService.stationData.deleteStation(id);

            if (selectedStation?.id === id) {
                setSelectedStation(null);
            }

            await reloadStations();
        } catch (error) {
            console.error(
                "Failed to delete station:",
                error
            );

            setError(
                error?.message ??
                "Failed to delete station."
            );
        }
    }

    async function reloadStations() {
        if (!eventId) {
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const stationResponse =
                await ApiService.stationData.getStations(
                    eventId
                );

            const loadedStations =
                stationResponse ?? [];

            setStations(loadedStations);

            setSelectedStation(current => {
                if (!current) {
                    return null;
                }

                return (
                    loadedStations.find(
                        station =>
                            station.id === current.id
                    ) ?? null
                );
            });
        } catch (error) {
            console.error(
                "Failed to reload stations:",
                error
            );

            setError(
                error?.message ??
                "Failed to load stations."
            );
        } finally {
            setLoading(false);
        }
    }

    const filteredStations = useMemo(() => {
        const query =
            search.trim().toLowerCase();

        if (!query) {
            return stations;
        }

        return stations.filter(station =>
            station.name
                ?.toLowerCase()
                .includes(query)
        );
    }, [stations, search]);

    if (eventLoading) {
        return (
            <div className="stations-page">
                <div className="loading-panel">
                    Loading event...
                </div>
            </div>
        );
    }

    if (eventError) {
        return (
            <div className="stations-page">
                <div className="error-banner">
                    {eventError}
                </div>
            </div>
        );
    }

    return (
        <div className="stations-page">
            <header className="page-header">
                <div>
                    <span className="page-eyebrow">
                        Administration
                    </span>

                    <h1>Station Manager</h1>

                    <p>
                        Configure scoring stations and their tasks
                        for {event?.name ?? "the current event"}.
                    </p>
                </div>

                <button
                    type="button"
                    className="primary-button"
                    onClick={() =>
                        navigate("/admin/stations/create")
                    }
                    disabled={!eventId}
                >
                    + Create Station
                </button>
            </header>

            {error && (
                <div className="error-banner">
                    {error}
                </div>
            )}

            <div className="station-toolbar">
                <div className="search-wrapper">
                    <svg
                        className="search-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
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
                        className="station-search-box"
                        placeholder="Search stations..."
                        value={search}
                        onChange={event =>
                            setSearch(event.target.value)
                        }
                    />
                </div>

                <span className="station-count">
                    {filteredStations.length}{" "}
                    {filteredStations.length === 1
                        ? "station"
                        : "stations"}
                </span>
            </div>

            <div className="station-layout">
                <section className="station-list-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Stations</h2>

                            <p>
                                Select a station to view its configuration.
                            </p>
                        </div>
                    </div>

                    <div className="station-list">
                        {loading ? (
                            <div className="loading-panel">
                                <span className="loading-spinner" />
                                Loading stations...
                            </div>
                        ) : filteredStations.length === 0 ? (
                            <div className="empty-list">
                                <h3>No stations found</h3>

                                <p>
                                    {search
                                        ? "Try a different search."
                                        : "Create a station to get started."}
                                </p>
                            </div>
                        ) : (
                            filteredStations.map(station => {
                                const config =
                                    station.activeConfiguration ??
                                    configurations.find(
                                        c => String(c.id) === String(station.activeConfigurationId)
                                    );

                                return (
                                    <button
                                        type="button"
                                        key={station.id}
                                        className={
                                            selectedStation?.id === station.id
                                                ? "station-card selected"
                                                : "station-card"
                                        }
                                        onClick={() =>
                                            setSelectedStation(station)
                                        }
                                    >
                                        <span className="station-card-content">
                                            <strong>
                                                {station.name}
                                            </strong>

                                            <span>
                                                {config?.name ??
                                                    station.type ??
                                                    "No configuration"}
                                            </span>
                                        </span>

                                        <span className="station-card-arrow">
                                            →
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </section>

                <StationDetails
                    station={selectedStation}
                    configurations={configurations}
                    onDelete={deleteStation}
                    onEdit={() => {
                        if (!selectedStation) {
                            return;
                        }

                        navigate(
                            `/admin/stations/edit?stationId=${encodeURIComponent(
                                selectedStation.id
                            )}`
                        );
                    }}
                    onCopyToTemplate={(stationToCopy) => {
                        // Pass station details to configuration creation page
                        navigate("/admin/configurations/create", {
                            state: {
                                copyFromStation: stationToCopy
                            }
                        });
                    }}
                />
            </div>
        </div>
    );
}