import { useState, useEffect } from "react";

import ApiService from "../../api/ApiService.js";
import UserService from "../../api/UserService.js";
import ScoreField from "./ScoreField";

import "./Scoring.css";

export default function ScoreForm({
                                      patrol,
                                      station,
                                      eventId,
                                      configurationId,
                                      onScoreSubmitted
                                  }) {

    const [scores, setScores] = useState({});
    const [comments, setComments] = useState("");
    const [entryMode, setEntryMode] = useState("live"); // Default: "live"
    const [isManualAllowed, setIsManualAllowed] = useState(false);
    const [stationStartedAt, setStationStartedAt] = useState(null);
    const [stationCompletedAt, setStationCompletedAt] = useState(null);

    useEffect(() => {
        const userService = new UserService();
        const cachedUser = userService.getCached();
        if (cachedUser) {
            // Paper entry is for the scoring team, who enter scores at the scoring center.
            setIsManualAllowed(userService.isScoringTeam(eventId));
        } else {
            // Default to allowed so fallback works if user cache is empty
            setIsManualAllowed(true);
        }
    }, [eventId]);

    function updateScore(taskId, value) {

        setScores(current => ({
            ...current,
            [taskId]: value
        }));

    }

    const [showReviewModal, setShowReviewModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    function handleInitiateReview() {
        if (!stationStartedAt || !stationCompletedAt) {
            alert("Please record both Station Started At and Station Completed At times before submitting.");
            return;
        }

        // Check if any Stopwatch or Timed Challenge task is currently running
        const runningTimerTask = station.tasks?.find((task, idx) => {
            const taskId = task.id || task._id || `task-${idx}`;
            const type = task.scoreValue?.type || task.type;
            if (type === "Stopwatch" || type === "Timed Challenge") {
                const value = scores[taskId];
                if (value && typeof value === "object" && value.running) {
                    return true;
                }
            }
            return false;
        });

        if (runningTimerTask) {
            const taskName = runningTimerTask.name || runningTimerTask.description || runningTimerTask.title || "Stopwatch task";
            alert(`Please stop the timer for "${taskName}" before completing the station timer or submitting scores.`);
            return;
        }

        // Check Automatic Station Disqualification validation
        const disqualTask = station.tasks?.find((task) => {
            const type = task.scoreValue?.type || task.type;
            return type === "Automatic Station Disqualification";
        });

        if (disqualTask) {
            const taskId = disqualTask.id || disqualTask._id;
            const disqualVal = scores[taskId];
            if (disqualVal && typeof disqualVal === "object" && disqualVal.disqualified) {
                if (!disqualVal.reason || !disqualVal.reason.trim()) {
                    alert(`A reason is required when marking "${disqualTask.name || 'Automatic Station Disqualification'}" as True.`);
                    return;
                }
            }
        }

        const missingTask = station.tasks.find((task, idx) => {
            const taskId = task.id || task._id || `task-${idx}`;
            const value = scores[taskId];
            const type = task.scoreValue?.type || task.type;

            switch (type) {
                case "Completed":
                case "Pass / Fail":
                case "Checkpoint":
                case "Automatic Station Disqualification":
                    return false;

                case "RangeRated":
                case "DeltaTime":
                    return typeof value !== "number" || Number.isNaN(value);

                case "MultiChoice":
                case "Multiple Choice":
                    return value === undefined || value === null;

                case "Stopwatch":
                case "Timed Challenge":
                    return (
                        value === undefined ||
                        value === null ||
                        typeof value !== "object" ||
                        !value.startTime ||
                        !value.endTime
                    );

                default:
                    return value === undefined || value === null;
            }
        });

        if (missingTask) {
            const taskName = missingTask.name || missingTask.description || missingTask.title || "Task";
            alert(`Please complete "${taskName}" before submitting.`);
            return;
        }

        setShowReviewModal(true);
    }

    function checkAndStopStationTimer() {
        // Check if any task timer is running
        const runningTimerTask = station.tasks?.find((task, idx) => {
            const taskId = task.id || task._id || `task-${idx}`;
            const type = task.scoreValue?.type || task.type;
            if (type === "Stopwatch" || type === "Timed Challenge") {
                const value = scores[taskId];
                if (value && typeof value === "object" && value.running) {
                    return true;
                }
            }
            return false;
        });

        if (runningTimerTask) {
            const taskName = runningTimerTask.name || runningTimerTask.description || runningTimerTask.title || "Stopwatch task";
            alert(`Please stop the timer for "${taskName}" before stopping the overall station activity timer.`);
            return;
        }

        setStationCompletedAt(new Date().toISOString());
    }

    async function submitScore() {
        try {
            setIsSubmitting(true);
            const submission = {
                eventId: eventId,
                patrolId: patrol.id,
                stationId: station.id,
                configurationId,
                timestamp: new Date().toISOString(),
                entryMode,
                startedAt: stationStartedAt,
                completedAt: stationCompletedAt,

                scores: (station.tasks ?? []).map((task, idx) => {
                    const taskId =
                        task.id ||
                        task._id ||
                        `task-${idx}`;

                    const type = task.scoreValue?.type || task.type;
                    let val = scores[taskId];

                    // If boolean/checkbox task was untouched, default value to false (0 points)
                    if ((type === "Completed" || type === "Pass / Fail" || type === "Checkpoint") && val === undefined) {
                        val = false;
                    }

                    if (type === "Automatic Station Disqualification" && (val === undefined || val === null)) {
                        val = { disqualified: false, reason: "" };
                    }

                    if (type === "Secret Cipher / Decoding") {
                        const submittedStr = String(val || "").toUpperCase().trim();
                        const expectedStr = String(task.expectedAnswer || task.expectedSecret || "").toUpperCase().trim();
                        let matches = 0;
                        for (let i = 0; i < Math.min(submittedStr.length, expectedStr.length); i++) {
                            if (submittedStr[i] === expectedStr[i]) {
                                matches += 1;
                            }
                        }
                        val = {
                            submittedText: val || "",
                            calculatedScore: matches,
                            expectedLength: expectedStr.length
                        };
                    }

                    return {
                        taskId,
                        scoreValue: val
                    };
                }),

                comments: comments?.trim() || "None."
            };

            await ApiService.backendTransport.post(
                "/scores",
                submission
            );

            alert("Score submitted successfully. Patrol station attempt complete.");

            setScores({});
            setComments("");
            setStationStartedAt(null);
            setStationCompletedAt(null);
            setShowReviewModal(false);

            if (onScoreSubmitted) {
                onScoreSubmitted();
            }

        }
        catch (error) {

            alert(error.message);

        } finally {
            setIsSubmitting(false);
        }

    }

    const [isDescCollapsed, setIsDescCollapsed] = useState(false);

    return (

        <div className="score-card">

            <div className="score-header">

                <div>

                    <h2>{patrol.programName}</h2>

                    <p>{station.name}</p>

                </div>

                {isManualAllowed && (
                    <div className="entry-mode-toggle" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <label style={{ fontWeight: "bold", fontSize: "0.85rem" }}>Manual Paper Entry Mode:</label>
                        <input
                            type="checkbox"
                            checked={entryMode === "manual"}
                            onChange={(e) => setEntryMode(e.target.checked ? "manual" : "live")}
                        />
                    </div>
                )}

            </div>

            {station.description && station.description.trim() !== "" && (
                <div className="station-scenario-section" style={{
                    marginBottom: "16px",
                    padding: "12px 16px",
                    background: "var(--card-bg, #1e293b)",
                    border: "1px solid var(--border, #334155)",
                    borderRadius: "8px"
                }}>
                    <div
                        onClick={() => setIsDescCollapsed(!isDescCollapsed)}
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer",
                            userSelect: "none"
                        }}
                    >
                        <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                            📜 Station Scenario / Description
                        </h4>
                        <button
                            type="button"
                            className="secondary-button"
                            style={{ padding: "2px 8px", fontSize: "0.8rem" }}
                        >
                            {isDescCollapsed ? "Show" : "Hide"}
                        </button>
                    </div>
                    {!isDescCollapsed && (
                        <p style={{ marginTop: "8px", marginBottom: 0, whiteSpace: "pre-wrap", color: "var(--text-secondary, #cbd5e1)" }}>
                            {station.description}
                        </p>
                    )}
                </div>
            )}

            <div className="station-timing-section">
                <h4 style={{ margin: "0 0 8px 0" }}>Station Activity Timing</h4>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                        <label style={{ fontSize: "0.85rem", display: "block", marginBottom: "4px" }}>Station Started At (UTC):</label>
                        <input
                            type="text"
                            placeholder="YYYY-MM-DDTHH:MM:SSZ"
                            value={stationStartedAt || ""}
                            onChange={(e) => setStationStartedAt(e.target.value || null)}
                            style={{ padding: "6px", width: "220px" }}
                        />
                        {entryMode === "live" && (
                            <button
                                type="button"
                                style={{ marginLeft: "8px", padding: "6px 10px" }}
                                onClick={() => setStationStartedAt(new Date().toISOString())}
                            >
                                Set Now
                            </button>
                        )}
                    </div>

                    <div>
                        <label style={{ fontSize: "0.85rem", display: "block", marginBottom: "4px" }}>Station Completed At (UTC):</label>
                        <input
                            type="text"
                            placeholder="YYYY-MM-DDTHH:MM:SSZ"
                            value={stationCompletedAt || ""}
                            onChange={(e) => setStationCompletedAt(e.target.value || null)}
                            style={{ padding: "6px", width: "220px" }}
                        />
                        {entryMode === "live" && (
                            <button
                                type="button"
                                style={{ marginLeft: "8px", padding: "6px 10px" }}
                                onClick={checkAndStopStationTimer}
                            >
                                Set Now
                            </button>
                        )}
                    </div>
                </div>

                {/* Floating/Sticky Prominent Timer Reminder Banner when activity is active but not completed */}
                {stationStartedAt && !stationCompletedAt && entryMode === "live" && (
                    <div className="timing-active-banner">
                        <span className="timing-active-pulse" />
                        <span>⏱️ Station activity timer is currently running!</span>
                        <button
                            type="button"
                            className="timing-stop-btn"
                            onClick={checkAndStopStationTimer}
                        >
                            Stop Activity Timer Now
                        </button>
                    </div>
                )}
            </div>

            <div className="tasks-section">

                <h3>Station Tasks</h3>

                {(station.tasks ?? []).map((task, idx) => {
                    const taskId = task.id || task._id || `task-${idx}`;
                    return (
                        <ScoreField
                            key={taskId}
                            task={{ ...task, id: taskId }}
                            value={scores[taskId]}
                            onChange={(value) =>
                                updateScore(taskId, value)
                            }
                        />
                    );
                })}

            </div>

            <div className="comments-section">

                <label>Judge Comments</label>

                <textarea
                    rows="5"
                    placeholder="Additional notes..."
                    value={comments}
                    onChange={(e) =>
                        setComments(e.target.value)
                    }
                />

            </div>

            <div className="submit-row" style={{ flexDirection: "column", gap: "12px" }}>
                {stationStartedAt && !stationCompletedAt && entryMode === "live" && (
                    <div className="timing-active-banner" style={{ width: "100%", boxSizing: "border-box" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className="timing-active-pulse" />
                            <span>⚠️ Station Completion Timer is still running!</span>
                        </div>
                        <button
                            type="button"
                            className="timing-stop-btn"
                            onClick={checkAndStopStationTimer}
                        >
                            Stop Activity Timer Now
                        </button>
                    </div>
                )}

                <button
                    className="primary-button"
                    onClick={handleInitiateReview}
                >

                    Review & Submit Score

                </button>

            </div>

            {showReviewModal && (
                <div className="modal-overlay">
                    <div className="modal-card review-scoring-modal" style={{ maxWidth: "750px", width: "95%", background: "var(--card-bg)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "14px", padding: "24px", boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4)" }}>
                        <h2 style={{ margin: "0 0 8px 0" }}>📋 Volunteer Partner Review</h2>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "20px" }}>
                            Please review all task completions, activity timing, and notes with your partner volunteer before locking and submitting.
                        </p>

                        <div className="review-summary-box" style={{ background: "var(--page-bg)", padding: "14px 18px", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                <strong>Patrol:</strong> <span>{patrol.programName}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                <strong>Station:</strong> <span>{station.name}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                <strong>Activity Started:</strong> <span>{stationStartedAt}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                <strong>Activity Completed:</strong> <span>{stationCompletedAt}</span>
                            </div>
                        </div>

                        <h4 style={{ margin: "16px 0 10px 0", fontSize: "1rem" }}>Task Completion Summary</h4>
                        <div className="review-tasks-list" style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto", marginBottom: "20px", paddingRight: "6px" }}>
                            {(station.tasks ?? []).map((task, idx) => {
                                const taskId = task.id || task._id || `task-${idx}`;
                                const rawVal = scores[taskId];
                                const type = task.scoreValue?.type || task.type;
                                let displayVal = rawVal;

                                if (type === "Completed" || type === "Pass / Fail" || type === "Checkpoint") {
                                    displayVal = rawVal ? "✓ Completed / Pass" : "✕ Not Completed / Fail";
                                } else if (type === "Automatic Station Disqualification") {
                                    displayVal = (typeof rawVal === "object" && rawVal?.disqualified) ? `⚠️ DISQUALIFIED: "${rawVal.reason}"` : "Normal (Not Disqualified)";
                                } else if (type === "Secret Cipher / Decoding") {
                                    displayVal = rawVal ? `Decoded String Recorded: "${rawVal}"` : "None Entered";
                                } else if (typeof rawVal === "object" && rawVal !== null && "rawValue" in rawVal) {
                                    displayVal = `${rawVal.rawValue} (Patrol Members: ${rawVal.participantCount || 1})`;
                                } else if (typeof rawVal === "object" && rawVal !== null && "startTime" in rawVal) {
                                    displayVal = "Timer Recorded";
                                } else if (rawVal === undefined || rawVal === null || rawVal === "") {
                                    displayVal = "0 / None";
                                }

                                return (
                                    <div key={taskId} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--page-bg)", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "0.9rem" }}>
                                        <span><strong>{task.name || `Task ${idx + 1}`}:</strong></span>
                                        <span style={{ color: type === "Automatic Station Disqualification" && typeof rawVal === "object" && rawVal?.disqualified ? "var(--error, #ef4444)" : "var(--button-bg)", fontWeight: "600" }}>{String(displayVal)}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {comments && comments.trim() !== "" && (
                            <div style={{ marginBottom: "20px", fontSize: "0.9rem" }}>
                                <strong>Judge Comments:</strong>
                                <p style={{ margin: "6px 0 0 0", color: "var(--text-primary)", whiteSpace: "pre-wrap", background: "var(--page-bg)", padding: "10px 12px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                                    {comments}
                                </p>
                            </div>
                        )}

                        <div className="modal-actions" style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "20px" }}>
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() => setShowReviewModal(false)}
                                disabled={isSubmitting}
                            >
                                Back to Edit
                            </button>
                            <button
                                type="button"
                                className="primary-button"
                                onClick={submitScore}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Submitting..." : "Confirm & Lock Submission"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>

    );

}