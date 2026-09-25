import { useEffect, useMemo, useState } from "react";
import ApiService from "@/api/ApiService.js";
import { useEventContext } from "@/api/helpers/event/EventContext.jsx";
import "./Finalizer.css";

export default function Finalizer() {
    const { event, eventId, loading: eventLoading, error: eventError } = useEventContext();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [saveMessage, setSaveMessage] = useState(null);

    const [stations, setStations] = useState([]);
    const [patrols, setPatrols] = useState([]);
    const [, setConfigurations] = useState([]);
    const [stationReports, setStationReports] = useState({});

    const [stationStates, setStationStates] = useState({});
    const [summaryCollapsed, setSummaryCollapsed] = useState(false);

    useEffect(() => {
        if (eventLoading) return;
        if (eventError) {
            setError(eventError);
            setLoading(false);
            return;
        }
        if (!eventId) {
            setError("No event is currently selected.");
            setLoading(false);
            return;
        }

        const user = ApiService.userData.getCached();
        if (user) {
            if (!ApiService.userData.isScoringTeam(eventId)) {
                setIsAuthorized(false);
                setError("Access Denied: The Event Score Finalizer is restricted to the Scoring Team, Event Admins and System Admins.");
                setLoading(false);
                return;
            }
        }

        loadData();
    }, [eventId, eventLoading, eventError]);

    const [mismatchWarnings, setMismatchWarnings] = useState([]);
    const [storedResultsMap, setStoredResultsMap] = useState(null);

    async function loadData() {
        try {
            setLoading(true);
            setError(null);
            setSaveMessage(null);

            const [fetchedStations, fetchedPatrols, fetchedConfigs, fetchedStoredResults] = await Promise.all([
                ApiService.stationData.getStations(eventId),
                ApiService.patrolData.getPatrols(eventId),
                ApiService.configurationData.getConfigurations(),
                ApiService.backendTransport.get(`/scores/finalized?eventId=${encodeURIComponent(eventId)}`).catch(() => [])
            ]);

            const loadedStations = Array.isArray(fetchedStations)
                ? [...fetchedStations].sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                : [];
            const loadedPatrols = Array.isArray(fetchedPatrols) ? fetchedPatrols : [];
            const loadedConfigs = Array.isArray(fetchedConfigs) ? fetchedConfigs : [];
            const storedList = Array.isArray(fetchedStoredResults) ? fetchedStoredResults : [];

            setStations(loadedStations);
            setPatrols(loadedPatrols);
            setConfigurations(loadedConfigs);

            // Map stored results: { [`${patrolId}_${stationId || 'final'}`]: { scoreValue, scoringMode } }
            const resultMap = {};
            storedList.forEach((r) => {
                const key = r.stationId ? `${r.patrolId}_${r.stationId}` : `${r.patrolId}_final`;
                resultMap[key] = r;
            });
            setStoredResultsMap(resultMap);

            // Restore the scoring mode this event was last finalized under. Without
            // this the dropdown silently resets to Absolute on every visit, and the
            // next Save overwrites relative scores with absolute ones.
            const storedMode = storedList.find(
                (r) => r.stationId && (r.scoringMode === "absolute" || r.scoringMode === "relative")
            )?.scoringMode;
            if (storedMode) {
                setGlobalScoringMode(storedMode);
            } else if (event?.scoringMode) {
                setGlobalScoringMode(event.scoringMode);
            }

            const reports = {};
            await Promise.all(
                loadedStations.map(async (st) => {
                    try {
                        const rep = await ApiService.reportData.getStationReport(st.id, eventId);
                        reports[st.id] = rep;
                    } catch (e) {
                        console.error(`Failed to load report for station ${st.id}`, e);
                        reports[st.id] = { stationId: st.id, patrols: [] };
                    }
                })
            );
            setStationReports(reports);

            const initialStates = {};
            loadedStations.forEach((st) => {
                const configTasks = st.tasks || [];
                const enabledTasks = {};
                const taskWeights = {};

                configTasks.forEach((t) => {
                    const taskId = t.id || t._id;
                    enabledTasks[taskId] = t.active !== false;
                    taskWeights[taskId] = t.scoreWeight !== undefined ? Number(t.scoreWeight) : 1.0;
                });

                initialStates[st.id] = {
                    mode: "absolute",
                    enabledTasks,
                    taskWeights,
                    stationWeight: st.station_weight !== undefined ? Number(st.station_weight) : (st.stationWeight !== undefined ? Number(st.stationWeight) : 1.0),
                    durationScoreActive: st.duration_score_active ?? st.durationScoreActive ?? false,
                    durationScoreWeight: st.duration_score_weight !== undefined ? Number(st.duration_score_weight) : (st.durationScoreWeight !== undefined ? Number(st.durationScoreWeight) : 1.0),
                    durationCalculationMode: st.duration_calculation_mode ?? st.durationCalculationMode ?? "fixed_minus_time",
                    durationFixedValue: st.duration_fixed_value !== undefined ? Number(st.duration_fixed_value) : (st.durationFixedValue !== undefined ? Number(st.durationFixedValue) : 30.0),
                    collapsed: false
                };
            });
            setStationStates(initialStates);

        } catch (err) {
            console.error("Failed to load finalizer data:", err);
            setError(err?.message || "Failed to load event score finalizer data.");
        } finally {
            setLoading(false);
        }
    }

    function handleTaskEnabledChange(stationId, taskId, checked) {
        setStationStates((prev) => ({
            ...prev,
            [stationId]: {
                ...prev[stationId],
                enabledTasks: {
                    ...prev[stationId].enabledTasks,
                    [taskId]: checked
                }
            }
        }));
    }

    const [globalScoringMode, setGlobalScoringMode] = useState("absolute");

    // Handlers for modifying task enabled status, task weight, and station weight
    function handleTaskEnabledChange(stationId, taskId, checked) {
        setStationStates((prev) => ({
            ...prev,
            [stationId]: {
                ...prev[stationId],
                enabledTasks: {
                    ...prev[stationId].enabledTasks,
                    [taskId]: checked
                }
            }
        }));
    }

    function handleTaskWeightChange(stationId, taskId, val) {
        const numVal = parseFloat(val);
        const weight = Number.isNaN(numVal) ? 0 : numVal;
        setStationStates((prev) => ({
            ...prev,
            [stationId]: {
                ...prev[stationId],
                taskWeights: {
                    ...prev[stationId].taskWeights,
                    [taskId]: weight
                }
            }
        }));
    }

    function handleStationWeightChange(stationId, val) {
        const numVal = parseFloat(val);
        const weight = Number.isNaN(numVal) ? 0 : numVal;
        setStationStates((prev) => ({
            ...prev,
            [stationId]: {
                ...prev[stationId],
                stationWeight: weight
            }
        }));
    }

    function handleStationDurationChange(stationId, field, val) {
        setStationStates((prev) => ({
            ...prev,
            [stationId]: {
                ...prev[stationId],
                [field]: val
            }
        }));
    }

    function toggleCollapse(stationId) {
        setStationStates((prev) => ({
            ...prev,
            [stationId]: {
                ...prev[stationId],
                collapsed: !prev[stationId]?.collapsed
            }
        }));
    }

    async function saveStationConfiguration(stationId) {
        const stationObj = stations.find((s) => String(s.id) === String(stationId));
        if (!stationObj) return;

        const stState = stationStates[stationId];
        if (!stState) return;

        try {
            setSaving(true);
            setSaveMessage(null);
            setError(null);

            const updatedTasks = (stationObj.tasks || []).map((t) => {
                const taskId = t.id || t._id;
                return {
                    ...t,
                    active: stState.enabledTasks[taskId] !== false,
                    scoreWeight: stState.taskWeights[taskId] !== undefined ? stState.taskWeights[taskId] : 1.0
                };
            });

            const updatePayload = {
                ...stationObj,
                station_weight: stState.stationWeight,
                stationWeight: stState.stationWeight,
                durationScoreActive: stState.durationScoreActive,
                duration_score_active: stState.durationScoreActive,
                durationScoreWeight: stState.durationScoreWeight,
                duration_score_weight: stState.durationScoreWeight,
                durationCalculationMode: stState.durationCalculationMode,
                duration_calculation_mode: stState.durationCalculationMode,
                durationFixedValue: stState.durationFixedValue,
                duration_fixed_value: stState.durationFixedValue,
                tasks: updatedTasks
            };

            await ApiService.stationData.updateStation(stationId, updatePayload);

            setSaveMessage(`Successfully saved weights and configuration for "${stationObj.name}".`);

            setStations((prev) =>
                prev.map((s) => (String(s.id) === String(stationId) ? { ...s, ...updatePayload } : s))
            );
        } catch (err) {
            console.error("Failed to save station configuration:", err);
            setError(err?.message || "Failed to save station configuration.");
        } finally {
            setSaving(false);
        }
    }

    const [customOverrides, setCustomOverrides] = useState({});
    const [customParticipantCounts, setCustomParticipantCounts] = useState({});

    function handleTaskScoreOverride(stationId, patrolId, taskId, val) {
        const numVal = parseFloat(val);
        setCustomOverrides((prev) => ({
            ...prev,
            [`${stationId}_${patrolId}_${taskId}`]: Number.isNaN(numVal) ? 0 : numVal
        }));
    }

    function handleParticipantCountChange(stationId, patrolId, taskId, val) {
        const parsed = parseInt(val, 10);
        const cnt = Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
        setCustomParticipantCounts((prev) => ({
            ...prev,
            [`${stationId}_${patrolId}_${taskId}`]: cnt
        }));
    }

    // How many members a patrol has on its roster.
    const patrolMemberCount = (patrol) => (Array.isArray(patrol?.members) ? patrol.members.length : 0);

    // Divisor for a divide-by-patrol-size task. Preference order:
    //   1. an explicit override typed on this screen
    //   2. the count captured when the score was taken
    //   3. the patrol's roster size
    // Step 3 matters because scores.participant_count is NOT NULL and defaults to
    // 1, and the stopwatch did not capture a count at all until recently -- so a
    // stored 1 almost always means "never captured" rather than "one member took
    // part". Falling back to the roster divides by something real instead of by 1,
    // and the override is still there for a patrol that genuinely ran short.
    const resolveParticipantCount = (overrideKey, storedRaw, patrol) => {

        if (customParticipantCounts[overrideKey] !== undefined) {
            return customParticipantCounts[overrideKey];
        }

        const stored = (storedRaw && typeof storedRaw === "object" && storedRaw.participantCount)
            ? Number(storedRaw.participantCount)
            : 1;

        if (stored > 1) {
            return stored;
        }

        const roster = patrolMemberCount(patrol);
        return roster > 0 ? roster : 1;

    };

    const stationCalculations = useMemo(() => {
        const calcs = {};

        stations.forEach((st) => {
            const stState = stationStates[st.id] || { enabledTasks: {}, taskWeights: {} };
            const tasks = st.tasks || [];
            const stReport = stationReports[st.id] || { patrols: [] };

            const patrolBreakdownMap = {};
            (stReport.patrols || []).forEach((p) => {
                const taskMap = {};
                (p.breakdown || []).forEach((b) => {
                    taskMap[b.taskId] = { rawScore: b.rawScore, submittedText: b.submittedText, participantCount: b.participantCount };
                });
                patrolBreakdownMap[p.patrolId] = taskMap;
            });

            let maxAbsoluteAchieved = 0;
            const patrolTotals = {};

            patrols.forEach((p) => {
                const pTaskMap = patrolBreakdownMap[p.id] || {};
                let sum = 0;
                let isDisqualified = false;

                tasks.forEach((t) => {
                    const taskId = t.id || t._id;
                    const isEnabled = stState.enabledTasks[taskId] !== false;
                    const type = t.scoreValue?.type || t.type;
                    const divideByPatrolSize = t.divideByPatrolSize ?? t.scoreValue?.divideByPatrolSize ?? false;
                    const rawVal = pTaskMap[taskId];

                    if (type === "Automatic Station Disqualification") {
                        if (typeof rawVal === "object" && rawVal !== null && rawVal.disqualified) {
                            isDisqualified = true;
                        } else if (rawVal === 0.0 && typeof rawVal !== "boolean") {
                            isDisqualified = true;
                        }
                    }

                    if (isEnabled) {
                        const weight = stState.taskWeights[taskId] !== undefined ? stState.taskWeights[taskId] : 1.0;
                        const overrideKey = `${st.id}_${p.id}_${taskId}`;
                        let rawScore = rawVal !== undefined ? (typeof rawVal === "object" && rawVal !== null ? (rawVal.disqualified ? 0 : (rawVal.rawScore !== undefined ? Number(rawVal.rawScore) : (rawVal.rawValue || 0))) : Number(rawVal)) : 0;
                        if (customOverrides[overrideKey] !== undefined) {
                            rawScore = customOverrides[overrideKey];
                        }
                        let effectiveScore = rawScore;
                        if (divideByPatrolSize) {
                            const pCount = resolveParticipantCount(overrideKey, rawVal, p);
                            if (pCount > 0) {
                                effectiveScore = rawScore / pCount;
                            }
                        }
                        sum += effectiveScore * weight;
                    }
                });

                // Calculate duration contribution if duration scoring is active
                if (stState.durationScoreActive) {
                    const pReport = (stReport.patrols || []).find((pr) => String(pr.patrolId) === String(p.id));
                    const startIso = pReport?.tasksStartedAt || pReport?.checkedInAt;
                    const endIso = pReport?.tasksCompletedAt || pReport?.checkedOutAt;

                    if (startIso && endIso) {
                        try {
                            const sDate = new Date(startIso);
                            const eDate = new Date(endIso);
                            if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
                                const durSecs = Math.max(0, (eDate.getTime() - sDate.getTime()) / 1000);
                                const durWeight = stState.durationScoreWeight === undefined
                                    ? 1.0
                                    : (Number(stState.durationScoreWeight) || 0);
                                const mode = stState.durationCalculationMode || "fixed_minus_time";
                                const fixedVal = stState.durationFixedValue !== undefined ? stState.durationFixedValue : 30.0;

                                let durationScore = 0;
                                if (mode === "fixed_minus_time") {
                                    durationScore = (fixedVal - durSecs) * durWeight;
                                } else {
                                    durationScore = durSecs * durWeight;
                                }
                                sum += durationScore;
                            }
                        } catch {}
                    }
                }

                if (isDisqualified) {
                    sum = 0;
                }

                // A station total must never be negative. Several stations subtract
                // time or penalties from a fixed base, so a patrol that uses the full
                // time allowance and picks up penalties can finish below zero. Relative
                // mode divides by the best raw total at the station, which turns that
                // into a negative station score -- ranking a patrol that attempted and
                // did badly BELOW one that skipped the station entirely, since a no-show
                // has no score rows and totals 0. Clamping here also keeps
                // maxAbsoluteAchieved non-negative.
                sum = Math.max(0, sum);

                patrolTotals[p.id] = { total: sum, isDisqualified };
                if (sum > maxAbsoluteAchieved) {
                    maxAbsoluteAchieved = sum;
                }
            });

            patrols.forEach((p) => {
                const rawTotal = patrolTotals[p.id].total;
                let relScore = 0;
                if (globalScoringMode === "relative") {
                    relScore = maxAbsoluteAchieved > 0 ? (rawTotal / maxAbsoluteAchieved) * 10 : 0;
                } else {
                    relScore = rawTotal;
                }
                patrolTotals[p.id].relativeScore = relScore;
            });

            calcs[st.id] = {
                patrolTotals,
                maxAbsoluteAchieved
            };
        });

        return calcs;
    }, [stations, patrols, stationReports, stationStates, globalScoringMode, customOverrides, customParticipantCounts]);

    const summaryCalculations = useMemo(() => {
        const summary = {};

        patrols.forEach((p) => {
            let grandTotal = 0;
            const stationBreakdown = {};

            stations.forEach((st) => {
                const stState = stationStates[st.id] || { stationWeight: 1.0 };
                const stCalc = stationCalculations[st.id]?.patrolTotals?.[p.id];
                const baseScore = stCalc ? stCalc.relativeScore : 0;
                const stationWeight = stState.stationWeight !== undefined ? stState.stationWeight : 1.0;

                const weightedStationScore = baseScore * stationWeight;
                stationBreakdown[st.id] = weightedStationScore;
                grandTotal += weightedStationScore;
            });

            summary[p.id] = {
                stationBreakdown,
                finalScore: grandTotal
            };
        });

        return summary;
    }, [stations, patrols, stationCalculations, stationStates]);

    // Validate calculated results against stored database results
    useEffect(() => {
        if (!storedResultsMap || Object.keys(storedResultsMap).length === 0) {
            setMismatchWarnings([]);
            return;
        }

        const warnings = [];

        patrols.forEach((p) => {
            const pName = p.name || p.programName || `Patrol ${p.id}`;

            // Check overall final score
            const calcFinal = summaryCalculations[p.id]?.finalScore;
            const storedFinalRecord = storedResultsMap[`${p.id}_final`];
            if (storedFinalRecord && calcFinal !== undefined) {
                const diff = Math.abs(calcFinal - Number(storedFinalRecord.scoreValue));
                if (diff > 0.01) {
                    warnings.push(`Final score mismatch for "${pName}": Stored=${Number(storedFinalRecord.scoreValue).toFixed(2)}, Calculated=${calcFinal.toFixed(2)}.`);
                }
            }

            // Check station scores
            stations.forEach((st) => {
                const stName = st.name || `Station ${st.id}`;
                const calcStation = stationCalculations[st.id]?.patrolTotals?.[p.id]?.relativeScore;
                const storedStationRecord = storedResultsMap[`${p.id}_${st.id}`];
                if (storedStationRecord && calcStation !== undefined) {
                    const diff = Math.abs(calcStation - Number(storedStationRecord.scoreValue));
                    if (diff > 0.01) {
                        warnings.push(`Station "${stName}" score mismatch for "${pName}": Stored=${Number(storedStationRecord.scoreValue).toFixed(2)}, Calculated=${calcStation.toFixed(2)}.`);
                    }
                }
            });
        });

        setMismatchWarnings(warnings);
    }, [storedResultsMap, summaryCalculations, stationCalculations, patrols, stations]);

    const [latestFinalReport, setLatestFinalReport] = useState(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    async function checkLatestFinalReport() {
        if (!eventId) return;
        try {
            const res = await ApiService.reportData.listCompiledReports(eventId);
            const reports = res?.reports ?? [];
            const scoringReport = reports.find(r => r.report_type === "event-scoring" && r.status === "ready");
            setLatestFinalReport(scoringReport || null);
        } catch (_) {}
    }

    async function handleGenerateReport(reportType = "event-scoring-draft") {
        if (!eventId) return;

        if (mismatchWarnings.length > 0 && reportType !== "event-scoring-draft") {
            const confirmSave = window.confirm(
                "You have unsaved weight or scoring changes that differ from stored results in the database.\n\n" +
                "Generating a report now will build it from the stored database results, NOT your unsaved on-screen changes.\n\n" +
                "Would you like to save and finalize scores now before generating the report?"
            );
            if (confirmSave) {
                await saveFinalizedResults();
            } else {
                return;
            }
        }

        try {
            setIsGeneratingPdf(true);
            setError(null);
            setSaveMessage(null);
            
            const job = await ApiService.reportData.generateReportJob(eventId, reportType);
            if (reportType === "event-scoring-draft") {
                setSaveMessage("Draft Scoring Report generation queued. Redirecting to reports registry...");
            } else if (reportType === "event-scoring-ods") {
                setSaveMessage("Scoring ODS Spreadsheet generation queued. Redirecting to reports registry...");
            } else {
                setSaveMessage("Final Official Scoring Report generation queued. Redirecting to reports registry...");
            }
            setTimeout(() => {
                window.location.href = `/admin/reports`;
            }, 1200);
        } catch (err) {
            console.error("Failed generating scoring report:", err);
            setError(err?.message || "Failed generating report.");
        } finally {
            setIsGeneratingPdf(false);
        }
    }

    async function saveFinalizedResults() {
        if (!eventId) return;

        try {
            setSaving(true);
            setSaveMessage(null);
            setError(null);

            const payloadResults = [];

            // Add station scores for each patrol
            stations.forEach((st) => {
                const stMode = globalScoringMode;
                patrols.forEach((p) => {
                    const val = stationCalculations[st.id]?.patrolTotals?.[p.id]?.relativeScore || 0;
                    payloadResults.push({
                        patrolId: p.id,
                        stationId: st.id,
                        scoreType: "station",
                        scoreValue: val,
                        scoringMode: stMode
                    });
                });
            });

            // Add final overall score for each patrol
            patrols.forEach((p) => {
                const val = summaryCalculations[p.id]?.finalScore || 0;
                payloadResults.push({
                    patrolId: p.id,
                    stationId: null,
                    scoreType: "final",
                    scoreValue: val,
                    scoringMode: "overall"
                });
            });

            await ApiService.backendTransport.post("/scores/finalized", {
                eventId,
                results: payloadResults
            });

            setSaveMessage("Successfully finalized and stored event scores into database. Auto-generating official final PDF report...");
            setMismatchWarnings([]);

            // Refresh stored results map
            const newMap = {};
            payloadResults.forEach((r) => {
                const key = r.stationId ? `${r.patrolId}_${r.stationId}` : `${r.patrolId}_final`;
                newMap[key] = r;
            });
            setStoredResultsMap(newMap);

            // Auto-generate official Final PDF report artifact
            await ApiService.reportData.generateReportJob(eventId, "event-scoring");
            await checkLatestFinalReport();

        } catch (err) {
            console.error("Failed to save finalized results:", err);
            setError(err?.message || "Failed to store finalized scores.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="finalizer-page">
            <div className="finalizer-header">
                <div>
                    <h1>Event Score Finalizer</h1>
                    <p>Adjust task inclusion, task weights, global scoring mode (Absolute vs Relative), and calculate final standings.</p>
                </div>
                <div className="finalizer-header-actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                    <div className="mode-selector">
                        <label style={{ fontWeight: "bold" }}>Scoring Mode:</label>
                        <select
                            value={globalScoringMode}
                            onChange={(e) => setGlobalScoringMode(e.target.value)}
                            className="finalizer-select"
                        >
                            <option value="absolute">Absolute Score (Weighted Sum)</option>
                            <option value="relative">Relative to Max Patrol (10pt Scale)</option>
                        </select>
                    </div>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleGenerateReport("event-scoring-draft")}
                        disabled={saving || loading || isGeneratingPdf}
                        title="Generate a preview report with DRAFT watermark"
                    >
                        👁️ Preview PDF (Draft)
                    </button>

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleGenerateReport("event-scoring-ods")}
                        disabled={saving || loading || isGeneratingPdf}
                        title="Download OpenDocument Spreadsheet (.ods) workbook with cross-referenced formulas"
                    >
                        📊 Download ODS Spreadsheet
                    </button>

                    <button type="button" className="primary-button" onClick={saveFinalizedResults} disabled={saving || loading}>
                        {saving ? "Finalizing..." : "💾 Save & Finalize Scores"}
                    </button>

                    {storedResultsMap && Object.keys(storedResultsMap).length > 0 && (
                        <button
                            type="button"
                            className="secondary-button"
                            style={{ background: "#2b6cb0", color: "#fff", borderColor: "#2b6cb0" }}
                            onClick={() => handleGenerateReport("event-scoring")}
                            disabled={saving || loading || isGeneratingPdf}
                        >
                            📄 Download Final PDF Report
                        </button>
                    )}

                    <button type="button" className="secondary-button" onClick={loadData} disabled={loading}>
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="finalizer-alert finalizer-alert--error">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {mismatchWarnings.length > 0 && (
                <div className="finalizer-alert finalizer-alert--warning" style={{
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid rgba(245, 158, 11, 0.5)",
                    color: "#fcd34d",
                    borderRadius: "8px",
                    padding: "1rem"
                }}>
                    <strong style={{ fontSize: "1.05rem" }}>⚠️ Stored Calculation Mismatch Warning:</strong>
                    <p style={{ margin: "0.25rem 0 0.5rem 0", fontSize: "0.9rem" }}>
                        The calculated scores based on current station settings do not match the finalized scores currently stored in the database.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem" }}>
                        {mismatchWarnings.map((warn, i) => (
                            <li key={i}>{warn}</li>
                        ))}
                    </ul>
                </div>
            )}

            {saveMessage && (
                <div className="finalizer-alert finalizer-alert--success">
                    <strong>Success:</strong> {saveMessage}
                </div>
            )}

            {stations.map((st) => {
                const stState = stationStates[st.id] || {
                    mode: "absolute",
                    enabledTasks: {},
                    taskWeights: {},
                    stationWeight: 1.0,
                    collapsed: false
                };
                const tasks = st.tasks || [];
                const stCalc = stationCalculations[st.id] || { patrolTotals: {}, maxAbsoluteAchieved: 0 };
                const stReport = stationReports[st.id] || { patrols: [] };

                const patrolBreakdownMap = {};
                (stReport.patrols || []).forEach((p) => {
                    const taskMap = {};
                    (p.breakdown || []).forEach((b) => {
                        taskMap[b.taskId] = { rawScore: b.rawScore, submittedText: b.submittedText };
                    });
                    patrolBreakdownMap[p.patrolId] = taskMap;
                });

                return (
                    <div key={st.id} className="station-bubble-card">
                        <div className="station-bubble-header">
                            <div className="station-bubble-title">
                                <h2>{st.name}</h2>
                                <span className="station-task-count">({tasks.length} tasks)</span>
                            </div>

                            <div className="station-bubble-controls">
                                <button
                                    type="button"
                                    className="secondary-button save-station-btn"
                                    onClick={() => saveStationConfiguration(st.id)}
                                    disabled={saving}
                                    title="Save task active flags and weights to station configuration"
                                >
                                    💾 Save Weights
                                </button>

                                <button
                                    type="button"
                                    className="collapse-toggle-btn"
                                    onClick={() => toggleCollapse(st.id)}
                                >
                                    {stState.collapsed ? "Show Table" : "Hide Table"}
                                </button>
                            </div>
                        </div>

                        {!stState.collapsed && (
                            <>
                                <div className="formula-display-box">
                                    <div className="formula-box-title">🧮 Resulting Station Total Score Formula</div>
                                    <div className="formula-expression">
                                        <code>
                                            {(() => {
                                                const taskTerms = tasks.map((t, idx) => {
                                                    const taskId = t.id || t._id;
                                                    const isEnabled = stState.enabledTasks[taskId] !== false;
                                                    const weight = stState.taskWeights[taskId] !== undefined ? stState.taskWeights[taskId] : 1.0;
                                                    if (!isEnabled) return null;
                                                    const name = t.name || `Task ${idx + 1}`;
                                                    return `[${name} × ${weight}]`;
                                                }).filter(Boolean);

                                                if (stState.durationScoreActive) {
                                                    const durW = stState.durationScoreWeight !== undefined ? stState.durationScoreWeight : 1.0;
                                                    const mode = stState.durationCalculationMode || "fixed_minus_time";
                                                    const fixedV = stState.durationFixedValue !== undefined ? stState.durationFixedValue : 30.0;
                                                    if (mode === "fixed_minus_time") {
                                                        taskTerms.push(`[(${fixedV}s - Duration) × ${durW}]`);
                                                    } else {
                                                        taskTerms.push(`[Duration × ${durW}]`);
                                                    }
                                                }

                                                const innerExpr = taskTerms.join(" + ") || "0";
                                                if (globalScoringMode === "relative") {
                                                    return `Station Score = ( (${innerExpr}) / Max Patrol Raw Score ${stCalc.maxAbsoluteAchieved > 0 ? `(${stCalc.maxAbsoluteAchieved.toFixed(1)})` : ""} ) × 10`;
                                                } else {
                                                    return `Station Score = Weighted Sum = ${innerExpr}`;
                                                }
                                            })()}
                                        </code>
                                    </div>
                                </div>

                                <div className="table-responsive">
                                <table className="finalizer-table">
                                    <thead>
                                        <tr className="header-row-names">
                                            <th className="col-patrol">Patrol</th>
                                            {tasks.map((t) => (
                                                <th key={t.id || t._id} className="col-task">
                                                    {t.name || t.description || "Task"}
                                                </th>
                                            ))}
                                            <th className="col-total" style={{ minWidth: "160px" }}>⏱️ Station Duration</th>
                                            <th className="col-total">
                                                {globalScoringMode === "relative" ? "Total Score (10pt Relative)" : "Total Score (Weighted Sum)"}
                                            </th>
                                        </tr>

                                        <tr className="header-row-checkboxes">
                                            <th className="col-patrol-label">Used for Scoring?</th>
                                            {tasks.map((t) => {
                                                const taskId = t.id || t._id;
                                                const checked = stState.enabledTasks[taskId] !== false;
                                                return (
                                                    <th key={taskId} className="col-task-center">
                                                        <label className="checkbox-label">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={(e) =>
                                                                    handleTaskEnabledChange(st.id, taskId, e.target.checked)
                                                                }
                                                            />
                                                            Include
                                                        </label>
                                                    </th>
                                                );
                                            })}
                                            <th className="col-task-center font-sm" style={{ padding: "4px" }}>
                                                <label className="checkbox-label" style={{ fontSize: "0.8rem" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={stState.durationScoreActive ?? false}
                                                        onChange={(e) =>
                                                            handleStationDurationChange(st.id, "durationScoreActive", e.target.checked)
                                                        }
                                                    />
                                                    Include
                                                </label>
                                            </th>
                                            <th className="col-total-label">
                                                {globalScoringMode === "relative" ? `Max Patrol Raw: ${stCalc.maxAbsoluteAchieved.toFixed(1)}` : "Sum"}
                                            </th>
                                        </tr>

                                        <tr className="header-row-weights">
                                            <th className="col-patrol-label">Task Weight Multiplier</th>
                                            {tasks.map((t) => {
                                                const taskId = t.id || t._id;
                                                const weight = stState.taskWeights[taskId] !== undefined ? stState.taskWeights[taskId] : 1.0;
                                                return (
                                                    <th key={taskId} className="col-task-center">
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            min="0"
                                                            className="weight-input"
                                                            value={weight}
                                                            onChange={(e) =>
                                                                handleTaskWeightChange(st.id, taskId, e.target.value)
                                                            }
                                                        />
                                                    </th>
                                                );
                                            })}
                                            <th className="col-task-center font-sm" style={{ padding: "4px" }}>
                                                {stState.durationScoreActive ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            className="weight-input"
                                                            value={stState.durationScoreWeight ?? 1.0}
                                                            onChange={(e) =>
                                                                handleStationDurationChange(st.id, "durationScoreWeight", e.target.value === "" ? "" : parseFloat(e.target.value))
                                                            }
                                                            title="Duration Score Weight Multiplier"
                                                        />
                                                        <select
                                                            value={stState.durationCalculationMode || "fixed_minus_time"}
                                                            onChange={(e) =>
                                                                handleStationDurationChange(st.id, "durationCalculationMode", e.target.value)
                                                            }
                                                            style={{ fontSize: "0.7rem", padding: "1px 2px", maxWidth: "120px" }}
                                                            title="Duration Calculation Mode"
                                                        >
                                                            <option value="fixed_minus_time">Fixed - Seconds</option>
                                                            <option value="direct">Direct Seconds</option>
                                                        </select>
                                                        {(stState.durationCalculationMode || "fixed_minus_time") === "fixed_minus_time" && (
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                value={stState.durationFixedValue ?? 30.0}
                                                                onChange={(e) =>
                                                                    handleStationDurationChange(st.id, "durationFixedValue", parseFloat(e.target.value) || 0)
                                                                }
                                                                placeholder="Fixed Secs"
                                                                style={{ width: "55px", fontSize: "0.75rem", textAlign: "center", padding: "1px 2px" }}
                                                                title="Fixed Baseline Value in Seconds"
                                                            />
                                                        )}
                                                    </div>
                                                ) : (
                                                    "—"
                                                )}
                                            </th>
                                            <th className="col-total-label">Subtotal</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {patrols.map((p) => {
                                            const pTaskMap = patrolBreakdownMap[p.id] || {};
                                            const pCalc = stCalc.patrolTotals[p.id] || { total: 0, relativeScore: 0, isDisqualified: false };
                                            const displayTotal = pCalc.isDisqualified ? 0 : (globalScoringMode === "relative" ? pCalc.relativeScore : pCalc.total);

                                            return (
                                                <tr key={p.id} style={{ background: pCalc.isDisqualified ? "rgba(239, 68, 68, 0.08)" : undefined }}>
                                                    <td className="col-patrol-name">
                                                        <strong>{p.name || p.programName || "Patrol"}</strong>
                                                        {p.patrolNumber && (
                                                            <span className="patrol-subtext"> (#{p.patrolNumber})</span>
                                                        )}
                                                        {pCalc.isDisqualified && (
                                                            <span style={{ color: "var(--error, #ef4444)", fontWeight: "bold", fontSize: "0.8rem", marginLeft: "6px" }}>
                                                                🚫 DISQUALIFIED (0.00)
                                                            </span>
                                                        )}
                                                    </td>

                                                    {tasks.map((t) => {
                                                        const taskId = t.id || t._id;
                                                        const isEnabled = stState.enabledTasks[taskId] !== false;
                                                        const type = t.scoreValue?.type || t.type;
                                                        const rawEntry = pTaskMap[taskId];
                                                        const rawScoreNum = typeof rawEntry === "object" && rawEntry !== null ? rawEntry.rawScore : rawEntry;
                                                        const submittedTextStr = typeof rawEntry === "object" && rawEntry !== null ? rawEntry.submittedText : null;

                                                        const weight = stState.taskWeights[taskId] !== undefined ? stState.taskWeights[taskId] : 1.0;
                                                        const overrideKey = `${st.id}_${p.id}_${taskId}`;
                                                        const currentScore = customOverrides[overrideKey] !== undefined ? customOverrides[overrideKey] : (rawScoreNum !== undefined ? Number(rawScoreNum) : 0);

                                                        if (type === "Secret Cipher / Decoding") {
                                                            const expectedStr = String(t.expectedAnswer || t.expectedSecret || "").toUpperCase().trim();
                                                            const submittedStr = String(submittedTextStr || (typeof rawScoreNum === "object" ? rawScoreNum?.submittedText : rawScoreNum) || "").toUpperCase().trim();

                                                            // Build character alignment comparison
                                                            const maxLen = Math.max(expectedStr.length, submittedStr.length);
                                                            const charMatches = [];
                                                            let autoMatchCount = 0;
                                                            for (let i = 0; i < maxLen; i++) {
                                                                const expChar = expectedStr[i] || "—";
                                                                const subChar = submittedStr[i] || "—";
                                                                const isMatch = expChar !== "—" && subChar !== "—" && expChar === subChar;
                                                                if (isMatch) autoMatchCount += 1;
                                                                charMatches.push({ index: i, expChar, subChar, isMatch });
                                                            }

                                                            return (
                                                                <td
                                                                    key={taskId}
                                                                    className={`col-task-score cipher-task-cell ${!isEnabled ? "task-disabled" : ""}`}
                                                                    style={{ position: "relative" }}
                                                                >
                                                                    <div className="cipher-cell-container" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                                                        <div className="cipher-hover-trigger" style={{ cursor: "help", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                                                            <span style={{ fontSize: "0.85rem" }}>🔒</span>
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                max={t.maxScore || expectedStr.length || 100}
                                                                                className="cipher-override-input"
                                                                                value={currentScore}
                                                                                onChange={(e) => handleTaskScoreOverride(st.id, p.id, taskId, e.target.value)}
                                                                                title="Editable character match count score override"
                                                                                style={{ width: "55px", padding: "2px 4px", fontSize: "0.85rem", fontWeight: "bold", textAlign: "center", borderRadius: "4px", border: customOverrides[overrideKey] !== undefined ? "2px solid #3b82f6" : "1px solid var(--border)" }}
                                                                            />
                                                                            <small style={{ color: "var(--text-secondary)" }}>/ {expectedStr.length || t.maxScore || 0}</small>
                                                                        </div>

                                                                        {/* Rich Character Alignment Hover Popover */}
                                                                        <div className="cipher-hover-popover" style={{
                                                                            display: "none",
                                                                            position: "absolute",
                                                                            bottom: "100%",
                                                                            left: "50%",
                                                                            transform: "translateX(-50%)",
                                                                            marginBottom: "8px",
                                                                            padding: "10px 14px",
                                                                            background: "var(--card-bg, #0f172a)",
                                                                            border: "1px solid var(--border, #334155)",
                                                                            borderRadius: "8px",
                                                                            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
                                                                            zIndex: 100,
                                                                            whiteSpace: "nowrap",
                                                                            fontSize: "0.82rem"
                                                                        }}>
                                                                            <div style={{ fontWeight: "bold", marginBottom: "6px", color: "var(--button-bg, #3b82f6)" }}>
                                                                                🔐 Secret Cipher Character Alignment
                                                                            </div>
                                                                            <div style={{ fontFamily: "monospace", display: "flex", flexDirection: "column", gap: "2px", background: "var(--page-bg)", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border)" }}>
                                                                                <div><strong style={{ color: "var(--text-secondary)" }}>Secret Target: </strong>{expectedStr || "(None Set)"}</div>
                                                                                <div><strong style={{ color: "var(--text-secondary)" }}>Patrol Input:  </strong>{submittedStr || "(Empty)"}</div>
                                                                            </div>
                                                                            <div style={{ marginTop: "6px", display: "flex", gap: "3px", flexWrap: "wrap", maxWidth: "260px" }}>
                                                                                {charMatches.map((c, i) => (
                                                                                    <span
                                                                                        key={i}
                                                                                        style={{
                                                                                            padding: "1px 4px",
                                                                                            borderRadius: "3px",
                                                                                            fontWeight: "bold",
                                                                                            fontSize: "0.75rem",
                                                                                            background: c.isMatch ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)",
                                                                                            color: c.isMatch ? "#4ade80" : "#fca5a5",
                                                                                            border: c.isMatch ? "1px solid #22c55e" : "1px solid #ef4444"
                                                                                        }}
                                                                                        title={`Pos ${i + 1}: Expected '${c.expChar}' vs Submitted '${c.subChar}'`}
                                                                                    >
                                                                                        {c.subChar}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                            <div style={{ marginTop: "6px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                                                                Auto Match: <strong>{autoMatchCount}</strong> | Current Override: <strong>{currentScore}</strong>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            );
                                                        }

                                                        const rawScore = currentScore;
                                                        const isDisqualTask = type === "Automatic Station Disqualification";
                                                        const isTextTask = type === "Text Answer";
                                                        const divideByPatrolSize = t.divideByPatrolSize ?? t.scoreValue?.divideByPatrolSize ?? false;

                                                        const currentPCount = resolveParticipantCount(overrideKey, rawEntry, p);
                                                        const effectiveScore = divideByPatrolSize && currentPCount > 0 ? (rawScore / currentPCount) : rawScore;

                                                        return (
                                                            <td
                                                                key={taskId}
                                                                className={`col-task-score cipher-task-cell ${!isEnabled ? "task-disabled" : ""}`}
                                                                style={{ position: "relative" }}
                                                            >
                                                                {rawScoreNum !== undefined || customOverrides[overrideKey] !== undefined ? (
                                                                    <div className="cipher-cell-container" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                                                        <div className="cipher-hover-trigger" style={{ cursor: (submittedTextStr || divideByPatrolSize) ? "help" : "default", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                                                                            {isDisqualTask && (
                                                                                <span style={{ fontSize: "0.85rem", color: "#ef4444" }}>
                                                                                    {rawScore > 0 || (submittedTextStr && submittedTextStr.includes("disqualified: true")) ? "🚫" : "✅"}
                                                                                </span>
                                                                            )}
                                                                            {isTextTask && <span style={{ fontSize: "0.85rem" }}>📝</span>}
                                                                            <span>
                                                                                {Number(effectiveScore).toFixed(1)}
                                                                                {weight !== 1.0 && isEnabled && (
                                                                                    <small className="score-weighted-hint">
                                                                                        {" "}
                                                                                        ({(Number(effectiveScore) * weight).toFixed(1)})
                                                                                    </small>
                                                                                )}
                                                                            </span>
                                                                        </div>

                                                                        {divideByPatrolSize && (
                                                                            <div style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "0.75rem", marginTop: "2px" }}>
                                                                                <span style={{ color: "var(--text-secondary)", fontSize: "0.7rem" }}>👥 ÷</span>
                                                                                <input
                                                                                    type="number"
                                                                                    min="1"
                                                                                    value={currentPCount}
                                                                                    onChange={(e) => handleParticipantCountChange(st.id, p.id, taskId, e.target.value)}
                                                                                    title={`Participating patrol member count used as the divisor. Patrol roster: ${patrolMemberCount(p) || "unknown"}. Edit to match how many members actually took part.`}
                                                                                    style={{ width: "42px", padding: "1px 2px", fontSize: "0.75rem", textAlign: "center", borderRadius: "3px", border: customParticipantCounts[overrideKey] !== undefined ? "2px solid #3b82f6" : "1px solid var(--border)" }}
                                                                                />
                                                                            </div>
                                                                        )}

                                                                        {/* Rich Detail Hover Popover for Text / Disqualification / Custom tasks */}
                                                                        {submittedTextStr && (
                                                                            <div className="cipher-hover-popover" style={{
                                                                                display: "none",
                                                                                position: "absolute",
                                                                                bottom: "100%",
                                                                                left: "50%",
                                                                                transform: "translateX(-50%)",
                                                                                marginBottom: "8px",
                                                                                padding: "10px 14px",
                                                                                background: "var(--card-bg, #0f172a)",
                                                                                border: "1px solid var(--border, #334155)",
                                                                                borderRadius: "8px",
                                                                                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
                                                                                zIndex: 100,
                                                                                whiteSpace: "nowrap",
                                                                                fontSize: "0.82rem"
                                                                            }}>
                                                                                <div style={{ fontWeight: "bold", marginBottom: "6px", color: "var(--button-bg, #3b82f6)" }}>
                                                                                    {isTextTask ? "📝 Text Answer Response" : (isDisqualTask ? "🚫 Disqualification Record" : "ℹ️ Submitted Response")}
                                                                                </div>
                                                                                <div style={{ fontFamily: "monospace", display: "flex", flexDirection: "column", gap: "2px", background: "var(--page-bg)", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border)" }}>
                                                                                    {t.expectedAnswer && (
                                                                                        <div><strong style={{ color: "var(--text-secondary)" }}>Expected:  </strong>{t.expectedAnswer}</div>
                                                                                    )}
                                                                                    <div><strong style={{ color: "var(--text-secondary)" }}>Submitted: </strong>{submittedTextStr}</div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="score-missing">—</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}

                                                     {/* Station Duration Cell with Hover Popover */}
                                                     {(() => {
                                                         const pReport = (stReport.patrols || []).find((pr) => String(pr.patrolId) === String(p.id));
                                                         const startIso = pReport?.tasksStartedAt || pReport?.checkedInAt;
                                                         const endIso = pReport?.tasksCompletedAt || pReport?.checkedOutAt;

                                                         let seconds = null;
                                                         let startDateStr = "—";
                                                         let endDateStr = "—";

                                                         if (startIso && endIso) {
                                                             try {
                                                                 const sDate = new Date(startIso);
                                                                 const eDate = new Date(endIso);
                                                                 if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
                                                                     seconds = Math.max(0, (eDate.getTime() - sDate.getTime()) / 1000);
                                                                     startDateStr = sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                                                     endDateStr = eDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                                                 }
                                                             } catch {}
                                                         }

                                                         const mins = seconds !== null ? Math.floor(seconds / 60) : 0;
                                                         const remSecs = seconds !== null ? (seconds % 60).toFixed(2) : "0.00";

                                                         return (
                                                             <td className="col-task-score cipher-task-cell" style={{ position: "relative" }}>
                                                                 {seconds !== null ? (
                                                                     <div className="cipher-cell-container" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                                                         <div className="cipher-hover-trigger" style={{ cursor: "help", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                                                             <span>⏱️</span>
                                                                             <strong>{seconds.toFixed(2)}s</strong>
                                                                         </div>

                                                                         {/* Duration Detail Hover Popover */}
                                                                         <div className="cipher-hover-popover" style={{
                                                                             display: "none",
                                                                             position: "absolute",
                                                                             bottom: "100%",
                                                                             left: "50%",
                                                                             transform: "translateX(-50%)",
                                                                             marginBottom: "8px",
                                                                             padding: "10px 14px",
                                                                             background: "var(--card-bg, #0f172a)",
                                                                             border: "1px solid var(--border, #334155)",
                                                                             borderRadius: "8px",
                                                                             boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
                                                                             zIndex: 100,
                                                                             whiteSpace: "nowrap",
                                                                             fontSize: "0.82rem"
                                                                         }}>
                                                                             <div style={{ fontWeight: "bold", marginBottom: "6px", color: "var(--button-bg, #3b82f6)" }}>
                                                                                 ⏱️ Station Visit & Timing Details
                                                                             </div>
                                                                             <div style={{ fontFamily: "monospace", display: "flex", flexDirection: "column", gap: "3px", background: "var(--page-bg)", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border)" }}>
                                                                                 <div><strong style={{ color: "var(--text-secondary)" }}>Start Time:  </strong>{startDateStr}</div>
                                                                                 <div><strong style={{ color: "var(--text-secondary)" }}>End Time:    </strong>{endDateStr}</div>
                                                                                 <div><strong style={{ color: "var(--text-secondary)" }}>Duration:    </strong>{mins}m {remSecs}s ({seconds.toFixed(2)}s total)</div>
                                                                             </div>
                                                                         </div>
                                                                     </div>
                                                                 ) : (
                                                                     <span className="score-missing">—</span>
                                                                 )}
                                                             </td>
                                                         );
                                                     })()}

                                                     <td className="col-total-val">
                                                         <strong>{displayTotal.toFixed(2)}</strong>
                                                     </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                    </div>
                );
            })}

            <div className="finalizer-break-bar">
                <hr />
                <span>🏆 Overall Event Final Standings & Station Weights</span>
                <hr />
            </div>

            <div className="station-bubble-card summary-bubble-card">
                <div className="station-bubble-header">
                    <div className="station-bubble-title">
                        <h2>Event Overall Score Summary</h2>
                        <span className="station-task-count">({stations.length} stations combined)</span>
                    </div>

                    <button
                        type="button"
                        className="collapse-toggle-btn"
                        onClick={() => setSummaryCollapsed(!summaryCollapsed)}
                    >
                        {summaryCollapsed ? "Show Table" : "Hide Table"}
                    </button>
                </div>

                {!summaryCollapsed && (
                    <>
                        <div className="formula-display-box summary-formula-box">
                            <div className="formula-box-title">🏆 Resulting Event Grand Total Score Formula</div>
                            <div className="formula-expression">
                                <code>
                                    Grand Total Score = {stations.map((st, idx) => {
                                        const stState = stationStates[st.id] || { stationWeight: 1.0 };
                                        const weight = stState.stationWeight !== undefined ? stState.stationWeight : 1.0;
                                        const name = st.name || `Station ${idx + 1}`;
                                        return `[${name} ${globalScoringMode === "relative" ? "(10pt)" : "(Sum)"} × ${weight}]`;
                                    }).join(" + ") || "0"}
                                </code>
                            </div>
                        </div>

                        <div className="table-responsive">
                        <table className="finalizer-table summary-table">
                            <thead>
                                <tr className="header-row-names">
                                    <th className="col-patrol">Patrol</th>
                                    {stations.map((st) => (
                                        <th key={st.id} className="col-task">
                                            {st.name}
                                        </th>
                                    ))}
                                    <th className="col-total col-final-score">Final Score</th>
                                </tr>

                                <tr className="header-row-checkboxes">
                                    <th className="col-patrol-label">Scoring Mode</th>
                                    {stations.map((st) => (
                                        <th key={st.id} className="col-task-center font-sm">
                                            {globalScoringMode === "relative" ? "Relative (10pt)" : "Absolute Sum"}
                                        </th>
                                    ))}
                                    <th className="col-total-label">Final Weighted Sum</th>
                                </tr>

                                <tr className="header-row-weights">
                                    <th className="col-patrol-label">Station Weight Multiplier</th>
                                    {stations.map((st) => {
                                        const stState = stationStates[st.id] || { stationWeight: 1.0 };
                                        const weight = stState.stationWeight !== undefined ? stState.stationWeight : 1.0;
                                        return (
                                            <th key={st.id} className="col-task-center">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    className="weight-input"
                                                    value={weight}
                                                    onChange={(e) => handleStationWeightChange(st.id, e.target.value)}
                                                />
                                            </th>
                                        );
                                    })}
                                    <th className="col-total-label">Grand Total</th>
                                </tr>
                            </thead>

                            <tbody>
                                {[...patrols]
                                    .sort((a, b) => {
                                        const scoreA = summaryCalculations[a.id]?.finalScore || 0;
                                        const scoreB = summaryCalculations[b.id]?.finalScore || 0;
                                        return scoreB - scoreA;
                                    })
                                    .map((p, idx) => {
                                        const pSummary = summaryCalculations[p.id] || { stationBreakdown: {}, finalScore: 0 };
                                        const rank = idx + 1;

                                        return (
                                            <tr key={p.id} className={rank === 1 ? "row-winner" : ""}>
                                                <td className="col-patrol-name">
                                                    <span className="rank-badge">#{rank}</span>
                                                    <strong>{p.name || p.programName || "Patrol"}</strong>
                                                </td>

                                                {stations.map((st) => {
                                                    const stationScore = pSummary.stationBreakdown[st.id] || 0;
                                                    return (
                                                        <td key={st.id} className="col-task-score">
                                                            {stationScore.toFixed(2)}
                                                        </td>
                                                    );
                                                })}

                                                <td className="col-total-val col-final-score-val">
                                                    <strong>{pSummary.finalScore.toFixed(2)}</strong>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
            </div>
        </div>
    );
}
