import "./TaskEditor.css";

const DEFAULT_TASK_TYPES = [
    "Timed Challenge",
    "Stopwatch",
    "Score Challenge",
    "Pass / Fail",
    "Multiple Choice",
    "Text Answer",
    "Checkpoint",
    "Custom"
];

export default function TaskEditor({
                                       task,
                                       onChange,
                                       taskTypes = DEFAULT_TASK_TYPES
                                   }) {

    function update(field, value) {

        onChange({
            ...task,
            [field]: value
        });

    }

    const TASK_GUIDANCE = {
        "Score Challenge": {
            title: "Score Challenge Guidance",
            text: "Used for direct numeric scoring (e.g. 0 to 100 points). The raw score is multiplied by the Task Weight for total points."
        },
        "Timed Challenge": {
            title: "Timed Challenge Guidance",
            text: "Combines time limit tracking with a maximum score. Scorers can use the built-in stopwatch or enter manual timing."
        },
        "Stopwatch": {
            title: "Stopwatch Guidance",
            text: "Provides live Start/Stop timer buttons and manual adjustment fields (HH:MM:SS.MS) for paper record transfers."
        },
        "Pass / Fail": {
            title: "Pass / Fail Guidance",
            text: "Presents a simple checkbox for binary evaluation. Checking 'Pass' awards 100% of points."
        },
        "Multiple Choice": {
            title: "Multiple Choice Guidance",
            text: "Allows configuring multiple choice options, each with a specific point value. On the scoring page, radio buttons are rendered for selection."
        },
        "Text Answer": {
            title: "Text Answer Guidance",
            text: "Provides a text entry field alongside an expected answer reference and maximum point limit."
        },
        "Checkpoint": {
            title: "Checkpoint Guidance",
            text: "Marks arrival or safety milestone completion. Checking the checkpoint awards full credit."
        },
        "Custom": {
            title: "Custom Task Guidance",
            text: "Flexible task with configurable max score limit for custom station activities."
        }
    };

    const currentGuidance =
        TASK_GUIDANCE[task.type] ||
        TASK_GUIDANCE["Score Challenge"];

    const currentOptions = task.options || [
        {
            label: "Option A (Full Points)",
            value: task.maxScore || 10
        },
        {
            label: "Option B (Partial Points)",
            value: Math.floor((task.maxScore || 10) / 2)
        },
        {
            label: "Option C (No Points)",
            value: 0
        }
    ];

    return (
        <div className="task-editor-layout">

            <div className="task-editor">

                <div className="task-editor-heading">

                    <div>

                        <h3>
                            Task Configuration
                        </h3>

                        <p>
                            Configure how this task is scored.
                        </p>

                    </div>

                </div>

                <div className="task-form-grid">

                    <label className="form-field">

                        <span>
                            Task Name
                        </span>

                        <input
                            value={task.name}
                            onChange={event =>
                                update(
                                    "name",
                                    event.target.value
                                )
                            }
                            placeholder="Enter task name"
                        />

                    </label>

                    <label className="form-field">

                        <span>
                            Task Type
                        </span>

                        <select
                            value={task.type}
                            onChange={event =>
                                update(
                                    "type",
                                    event.target.value
                                )
                            }
                        >

                            {taskTypes.map(type => (

                                <option
                                    key={type}
                                    value={type}
                                >
                                    {type}
                                </option>

                            ))}

                        </select>

                    </label>

                </div>

                <label className="form-field">

                    <span>
                        Instructions
                    </span>

                    <textarea
                        rows={3}
                        value={task.instructions}
                        onChange={event =>
                            update(
                                "instructions",
                                event.target.value
                            )
                        }
                        placeholder="Explain what the patrol needs to do..."
                    />

                </label>

                <label className="form-field task-notes">

                    <span>
                        Scorer Notes / Ambiguity Resolver (Optional)
                    </span>

                    <textarea
                        rows={3}
                        value={task.notes || ""}
                        onChange={event =>
                            update(
                                "notes",
                                event.target.value
                            )
                        }
                        placeholder="Notes or hints for scorers to resolve ambiguity (shown in a speech bubble on scoring page)..."
                    />

                </label>

                <label className="form-field task-score-weight">

                    <span>
                        Task Score Weight (Multiplier)
                    </span>

                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={task.scoreWeight ?? 1.0}
                        onChange={event =>
                            update(
                                "scoreWeight",
                                Number(event.target.value)
                            )
                        }
                    />

                </label>

                <label className="form-field checkbox-field">

                    <input
                        type="checkbox"
                        checked={task.active !== false}
                        onChange={event =>
                            update(
                                "active",
                                event.target.checked
                            )
                        }
                    />

                    <span>
                        Include this task in scoring calculations
                    </span>

                </label>

                {(task.type === "Score Challenge" ||
                    task.type === "Timed Challenge" ||
                    task.type === "Text Answer" ||
                    task.type === "Checkpoint" ||
                    task.type === "Custom") && (

                    <label className="form-field">

                        <span>
                            Maximum Score
                        </span>

                        <input
                            type="number"
                            min="0"
                            value={task.maxScore ?? ""}
                            onChange={event =>
                                update(
                                    "maxScore",
                                    Number(event.target.value)
                                )
                            }
                            placeholder="e.g. 10"
                        />

                    </label>

                )}

                {task.type === "Timed Challenge" && (

                    <label className="form-field">

                        <span>
                            Time Limit
                        </span>

                        <div className="input-with-suffix">

                            <input
                                type="number"
                                min="0"
                                value={task.timeLimit}
                                onChange={event =>
                                    update(
                                        "timeLimit",
                                        Number(event.target.value)
                                    )
                                }
                            />

                            <span>
                                seconds
                            </span>

                        </div>

                    </label>

                )}

                {task.type === "Multiple Choice" && (

                    <div className="form-field multiple-choice-field">

                        <span>
                            Multiple Choice Options & Point Values
                        </span>

                        <div className="options-editor-list">

                            {currentOptions.map((opt, idx) => (

                                <div
                                    key={idx}
                                    className="option-editor-row"
                                >

                                    <input
                                        type="text"
                                        placeholder={`Option ${idx + 1} Label`}
                                        value={opt.label || ""}
                                        className="option-label-input"
                                        onChange={event => {
                                            const newOpts = [...currentOptions];

                                            newOpts[idx] = {
                                                ...newOpts[idx],
                                                label: event.target.value
                                            };

                                            update(
                                                "options",
                                                newOpts
                                            );
                                        }}
                                    />

                                    <input
                                        type="number"
                                        placeholder="Points"
                                        value={opt.value ?? ""}
                                        className="option-points-input"
                                        onChange={event => {
                                            const newOpts = [...currentOptions];

                                            newOpts[idx] = {
                                                ...newOpts[idx],
                                                value: Number(event.target.value)
                                            };

                                            update(
                                                "options",
                                                newOpts
                                            );
                                        }}
                                    />

                                    <button
                                        type="button"
                                        className="remove-option-button"
                                        onClick={() => {
                                            if (currentOptions.length <= 1) {
                                                return;
                                            }

                                            const newOpts =
                                                currentOptions.filter(
                                                    (_, i) => i !== idx
                                                );

                                            update(
                                                "options",
                                                newOpts
                                            );
                                        }}
                                    >
                                        ✕
                                    </button>

                                </div>

                            ))}

                            <button
                                type="button"
                                className="add-option-button"
                                onClick={() => {
                                    const newOpts = [
                                        ...currentOptions,
                                        {
                                            label:
                                                `Option ${currentOptions.length + 1}`,
                                            value: 0
                                        }
                                    ];

                                    update(
                                        "options",
                                        newOpts
                                    );
                                }}
                            >
                                ➕ Add Choice Option
                            </button>

                        </div>

                    </div>

                )}

                {task.type === "Text Answer" && (

                    <label className="form-field">

                        <span>
                            Expected Answer
                        </span>

                        <input
                            value={task.expectedAnswer}
                            onChange={event =>
                                update(
                                    "expectedAnswer",
                                    event.target.value
                                )
                            }
                            placeholder="Enter the expected answer / grading reference"
                        />

                    </label>

                )}

                {task.type === "Checkpoint" && (

                    <div className="task-note">

                        <strong>
                            Checkpoint
                        </strong>

                        <p>
                            This task records that a patrol successfully
                            checked in at the station.
                        </p>

                    </div>

                )}

                {task.type === "Pass / Fail" && (

                    <div className="task-note">

                        <strong>
                            Pass / Fail
                        </strong>

                        <p>
                            Judges will mark the patrol as either
                            Pass or Fail.
                        </p>

                    </div>

                )}

                {task.type === "Custom" && (

                    <div className="task-note">

                        <strong>
                            Custom Task
                        </strong>

                        <p>
                            This task uses custom scoring behavior.
                        </p>

                    </div>

                )}

                <div className="scoring-preview-box">
                    <strong>
                        📊 Task Scoring Calculation Preview (Example Data)
                    </strong>
                    {task.active === false ? (
                        <span className="scoring-preview-disabled">
                            🚫 Task disabled for scoring: Contributes{" "}
                            <strong>0 points</strong> to station total.
                        </span>
                    ) : (
                        <div className="scoring-preview-content">
                            {task.maxScore ? (
                                <span>
                                    Example Task Raw Score:{" "}
                                    <strong>
                                        {Math.round(task.maxScore * 0.85)}
                                    </strong>{" "}
                                    / {task.maxScore}
                                    {" "} (85%)
                                    <br />
                                    Weighted Task Contribution = Raw (
                                    {Math.round(task.maxScore * 0.85)}
                                    ) × Task Weight (
                                    {task.scoreWeight ?? 1.0}
                                    ) ={" "}
                                    <strong>
                                        {(
                                            Math.round(
                                                task.maxScore * 0.85
                                            ) *
                                            (task.scoreWeight ?? 1.0)
                                        ).toFixed(1)}
                                        {" "}points
                                    </strong>
                                </span>
                            ) : (
                                <span>
                                    Example Task Raw Score:{" "}
                                    <strong>85</strong>{" "}
                                    points
                                    <br />
                                    Weighted Task Contribution = Raw (85)
                                    × Task Weight (
                                    {task.scoreWeight ?? 1.0}
                                    ) ={" "}
                                    <strong>
                                        {(
                                            85 *
                                            (task.scoreWeight ?? 1.0)
                                        ).toFixed(1)}
                                        {" "}points
                                    </strong>
                                </span>

                            )}

                        </div>

                    )}

                </div>

            </div>

            <aside className="task-guidance-sidebar">
                <h4>
                    💡 {currentGuidance.title}
                </h4>

                <p>
                    {currentGuidance.text}
                </p>

                <div className="task-guidance-tip">
                    <strong>
                        💡 Scorer Note Tip:
                    </strong>

                    <p>
                        Fill out the <em>Scorer Notes</em> field above
                        to clarify rules or instructions for station
                        judges. If provided, notes are displayed in a
                        callout bubble on the scoring page.
                    </p>
                </div>
            </aside>
        </div>
    );
}