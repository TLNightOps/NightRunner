import {
    useEffect,
    useState
} from "react";

import {
    useNavigate,
    useSearchParams
} from "react-router-dom";

import ApiService from "../../../api/ApiService.js";
import { useEventContext } from "@/api/helpers/event/EventContext.jsx";

import QRCodeModal from "./QRCodeModal.jsx";

import "./PatrolEditor.css";

const RANKS = [
    "Navigator",
    "Adventurer"
];

const EMPTY_MEMBER = {
    name: "",
    rank: RANKS[0],
    troop: ""
};

const EMPTY_PATROL = {
    name: "",
    phoneNumber: "",
    radioFrequency: "",
    radioChannel: "",
    hasRadio: false,
    radioIdentifier: "",
    members: []
};

const TROOP_PATTERN = /^[A-Z]{2}-\d{4}$/;

export default function PatrolEditor({
                                         mode
                                     }) {

    const navigate = useNavigate();

    const [searchParams] =
        useSearchParams();

    const {
        eventId,
        event,
        loading: eventLoading,
        error: eventError
    } = useEventContext();

    const patrolId =
        searchParams.get("patrolId");

    const isEdit =
        mode === "edit";

    const [patrol, setPatrol] =
        useState(EMPTY_PATROL);

    const [member, setMember] =
        useState(EMPTY_MEMBER);

    const [editingMemberId, setEditingMemberId] =
        useState(null);

    const [loading, setLoading] =
        useState(
            isEdit ||
            eventLoading
        );

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState(null);

    const [memberError, setMemberError] =
        useState(null);

    const [showQRCode, setShowQRCode] =
        useState(false);


    //
    // Load the patrol when editing.
    //

    useEffect(() => {

        if (eventLoading) {
            return;
        }

        if (eventError) {

            setError(eventError);
            setLoading(false);

            return;

        }

        if (!eventId) {

            setError(
                "No event is currently selected."
            );

            setLoading(false);

            return;

        }

        if (!isEdit) {

            setLoading(false);

            return;

        }

        if (!patrolId) {

            setError(
                "No patrol ID was provided."
            );

            setLoading(false);

            return;

        }

        loadPatrol();

    }, [
        eventId,
        eventLoading,
        eventError,
        isEdit,
        patrolId
    ]);


    //
    // Load existing patrol.
    //

    async function loadPatrol() {

        try {

            setLoading(true);
            setError(null);

            const data =
                await ApiService.patrolData.getPatrol(
                    eventId,
                    patrolId
                );

            setPatrol({
                ...EMPTY_PATROL,
                ...data,
                members:
                    data.members ?? []
            });

        } catch (error) {

            console.error(
                "Failed to load patrol:",
                error
            );

            setError(
                error?.message ??
                "Failed to load patrol."
            );

        } finally {

            setLoading(false);

        }

    }


    //
    // Update patrol information.
    //

    function updatePatrol(
        field,
        value
    ) {

        setPatrol(current => ({
            ...current,
            [field]: value
        }));

    }


    //
    // Update member editor.
    //

    function updateMember(
        field,
        value
    ) {

        setMember(current => ({
            ...current,

            [field]:
                field === "troop"
                    ? value.toUpperCase()
                    : value
        }));

    }


    //
    // Reset member editor.
    //

    function resetMemberEditor() {

        setMember({
            ...EMPTY_MEMBER
        });

        setEditingMemberId(null);
        setMemberError(null);

    }


    //
    // Validate troop number.
    //

    function validateTroop(
        troop
    ) {

        return TROOP_PATTERN.test(
            troop
                .trim()
                .toUpperCase()
        );

    }


    //
    // Add or update member.
    //

    function addMember() {

        setMemberError(null);

        const name =
            member.name.trim();

        const troop =
            member.troop
                .trim()
                .toUpperCase();

        if (!name) {

            setMemberError(
                "Member name is required."
            );

            return;

        }

        if (!validateTroop(troop)) {

            setMemberError(
                "Troop must use the format AB-0123."
            );

            return;

        }

        const newMember = {

            id:
                editingMemberId ??
                crypto.randomUUID(),

            name,

            rank:
            member.rank,

            troop

        };

        setPatrol(current => ({

            ...current,

            members:
                editingMemberId

                    ? current.members.map(
                        existing =>
                            existing.id ===
                            editingMemberId
                                ? newMember
                                : existing
                    )

                    : [
                        ...current.members,
                        newMember
                    ]

        }));

        resetMemberEditor();

    }


    //
    // Edit existing member.
    //

    function editMember(
        memberToEdit
    ) {

        setEditingMemberId(
            memberToEdit.id
        );

        setMember({

            name:
                memberToEdit.name ?? "",

            rank:
                memberToEdit.rank ??
                RANKS[0],

            troop:
                memberToEdit.troop ?? ""

        });

        setMemberError(null);

        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: "smooth"
        });

    }


    //
    // Remove member.
    //

    function removeMember(
        id
    ) {

        setPatrol(current => ({

            ...current,

            members:
                current.members.filter(
                    member =>
                        member.id !== id
                )

        }));

        if (
            editingMemberId === id
        ) {
            resetMemberEditor();
        }

    }


    //
    // Save patrol.
    //

    async function savePatrol() {

        setError(null);

        if (!eventId) {

            setError(
                "No event is currently selected."
            );

            return;

        }

        const name =
            patrol.name.trim();

        if (!name) {

            setError(
                "Patrol name is required."
            );

            return;

        }

        try {

            setSaving(true);

            const payload = {

                ...patrol,

                name,

                phoneNumber: patrol.phoneNumber?.trim() || null,

                radioFrequency: patrol.radioFrequency?.trim() || null,

                radioChannel: patrol.radioChannel?.trim() || null,

                hasRadio: Boolean(patrol.hasRadio),

                radioIdentifier: patrol.hasRadio && patrol.radioIdentifier ? patrol.radioIdentifier.trim() : null,

                members:
                    patrol.members.map(
                        member => ({
                            ...member,

                            name:
                                member.name.trim(),

                            troop:
                                member.troop
                                    ?.trim()
                                    .toUpperCase() ??
                                ""
                        })
                    )

            };

            if (isEdit) {

                await ApiService.patrolData.updatePatrol(
                    eventId,
                    patrolId,
                    payload
                );

            } else {

                await ApiService.patrolData.createPatrol(
                    eventId,
                    payload
                );

            }

            navigate(
                "/admin/patrols"
            );

        } catch (error) {

            console.error(
                "Failed to save patrol:",
                error
            );

            setError(
                error?.message ??
                "Failed to save patrol."
            );

        } finally {

            setSaving(false);

        }

    }


    //
    // Event loading.
    //

    if (eventLoading) {

        return (

            <div className="patrol-editor-page">

                <div className="editor-loading">

                    <span className="loading-spinner" />

                    Loading event...

                </div>

            </div>

        );

    }


    //
    // Event error.
    //

    if (eventError) {

        return (

            <div className="patrol-editor-page">

                <div className="error-banner">

                    {eventError}

                </div>

            </div>

        );

    }


    //
    // Patrol loading.
    //

    if (loading) {

        return (

            <div className="patrol-editor-page">

                <div className="editor-loading">

                    <span className="loading-spinner" />

                    Loading patrol...

                </div>

            </div>

        );

    }


    return (

        <div className="patrol-editor-page">

            <header className="editor-header">

                <button
                    type="button"
                    className="back-button"
                    onClick={() =>
                        navigate(
                            "/admin/patrols"
                        )
                    }
                >
                    ← Back to Patrols
                </button>

                <div>

                    <span className="page-eyebrow">
                        Administration
                    </span>

                    <h1>
                        {isEdit
                            ? "Edit Patrol"
                            : "Create Patrol"
                        }
                    </h1>

                    <p>
                        {isEdit
                            ? `Update the patrol and its members for ${event?.name ?? "the current event"}.`
                            : `Create a patrol for ${event?.name ?? "the current event"} and add its members.`
                        }
                    </p>

                </div>

            </header>


            {error && (

                <div className="error-banner">

                    {error}

                </div>

            )}


            <div className="editor-layout">

                {/* Patrol Information */}

                <section className="editor-card">

                    <div className="editor-card-header">

                        <div>

                            <h2>
                                Patrol Information
                            </h2>

                            <p>
                                Basic information about this patrol.
                            </p>

                        </div>

                        {isEdit &&
                            patrol.id && (

                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() =>
                                        setShowQRCode(true)
                                    }
                                >
                                    QR Code
                                </button>

                            )}

                    </div>


                    <div className="editor-card-body">

                        <label className="form-field">

                            <span>
                                Patrol Name
                            </span>

                            <input
                                value={
                                    patrol.name
                                }
                                onChange={event =>
                                    updatePatrol(
                                        "name",
                                        event.target.value
                                    )
                                }
                                placeholder="Enter patrol name"
                                autoFocus
                            />

                        </label>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
                            <label className="form-field">
                                <span>
                                    Cell Phone Number
                                </span>
                                <input
                                    type="tel"
                                    value={patrol.phoneNumber ?? ""}
                                    onChange={event =>
                                        updatePatrol(
                                            "phoneNumber",
                                            event.target.value
                                        )
                                    }
                                    placeholder="e.g. 555-123-4567"
                                />
                            </label>

                            <label className="form-field">
                                <span>
                                    Radio Frequency
                                </span>
                                <input
                                    type="text"
                                    value={patrol.radioFrequency ?? ""}
                                    onChange={event =>
                                        updatePatrol(
                                            "radioFrequency",
                                            event.target.value
                                        )
                                    }
                                    placeholder="e.g. 462.5625 MHz"
                                />
                            </label>

                            <label className="form-field">
                                <span>
                                    Radio Channel
                                </span>
                                <input
                                    type="text"
                                    value={patrol.radioChannel ?? ""}
                                    onChange={event =>
                                        updatePatrol(
                                            "radioChannel",
                                            event.target.value
                                        )
                                    }
                                    placeholder="e.g. Channel 1 / TAC-2"
                                />
                            </label>
                        </div>

                        {!patrol.phoneNumber?.trim() && !patrol.radioFrequency?.trim() && !patrol.radioChannel?.trim() && !patrol.hasRadio && (
                            <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", backgroundColor: "#fff3cd", color: "#856404", border: "1px solid #ffeeba", borderRadius: "6px", fontSize: "0.9em" }}>
                                ⚠️ <strong>No communication info set:</strong> Base camp has no cell phone number, radio frequency, or radio channel registered for this patrol.
                            </div>
                        )}

                        <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #e9ecef" }}>
                            <label className="form-field checkbox-field" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <input
                                    type="checkbox"
                                    checked={Boolean(patrol.hasRadio)}
                                    onChange={event =>
                                        updatePatrol(
                                            "hasRadio",
                                            event.target.checked
                                        )
                                    }
                                />
                                <span>
                                    Patrol was issued a radio
                                </span>
                            </label>

                            {patrol.hasRadio && (
                                <label className="form-field" style={{ marginTop: "0.75rem" }}>
                                    <span>
                                        Radio Identifier / Asset Tag
                                    </span>
                                    <input
                                        type="text"
                                        value={patrol.radioIdentifier ?? ""}
                                        onChange={event =>
                                            updatePatrol(
                                                "radioIdentifier",
                                                event.target.value
                                            )
                                        }
                                        placeholder="e.g. Radio-04, TAC-2"
                                    />
                                </label>
                            )}
                        </div>

                    </div>

                </section>


                {/* Members */}

                <section className="editor-card">

                    <div className="editor-card-header">

                        <div>

                            <h2>
                                Members
                            </h2>

                            <p>
                                Manage the members assigned
                                to this patrol.
                            </p>

                        </div>

                        <span className="member-badge">

                            {patrol.members.length}

                        </span>

                    </div>


                    <div className="editor-card-body">

                        {patrol.members.length > 0 ? (

                            <div className="member-table-wrapper">

                                <table className="member-table">

                                    <thead>

                                    <tr>

                                        <th>
                                            Name
                                        </th>

                                        <th>
                                            Rank
                                        </th>

                                        <th>
                                            Troop
                                        </th>

                                        <th />

                                    </tr>

                                    </thead>


                                    <tbody>

                                    {patrol.members.map(
                                        currentMember => (

                                            <tr
                                                key={
                                                    currentMember.id
                                                }
                                            >

                                                <td>

                                                    <strong>
                                                        {
                                                            currentMember.name
                                                        }
                                                    </strong>

                                                </td>

                                                <td>

                                                    {
                                                        currentMember.rank
                                                    }

                                                </td>

                                                <td>

                                                    <code>
                                                        {
                                                            currentMember.troop
                                                        }
                                                    </code>

                                                </td>

                                                <td>

                                                    <div className="member-actions">

                                                        <button
                                                            type="button"
                                                            className="secondary-button small"
                                                            onClick={() =>
                                                                editMember(
                                                                    currentMember
                                                                )
                                                            }
                                                        >
                                                            Edit
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="danger small"
                                                            onClick={() =>
                                                                removeMember(
                                                                    currentMember.id
                                                                )
                                                            }
                                                        >
                                                            Remove
                                                        </button>

                                                    </div>

                                                </td>

                                            </tr>

                                        )
                                    )}

                                    </tbody>

                                </table>

                            </div>

                        ) : (

                            <div className="no-members">

                                <strong>
                                    No members added
                                </strong>

                                <span>
                                    Use the form below to add
                                    the first member.
                                </span>

                            </div>

                        )}


                        <div className="member-editor">

                            <div className="member-editor-header">

                                <div>

                                    <h3>
                                        {editingMemberId
                                            ? "Edit Member"
                                            : "Add Member"
                                        }
                                    </h3>

                                    <p>
                                        {editingMemberId
                                            ? "Update this member's information."
                                            : "Add a member to this patrol."
                                        }
                                    </p>

                                </div>

                            </div>


                            {memberError && (

                                <div className="member-error">

                                    {memberError}

                                </div>

                            )}


                            <div className="member-form">

                                <label className="form-field">

                                    <span>
                                        Name
                                    </span>

                                    <input
                                        value={
                                            member.name
                                        }
                                        onChange={event =>
                                            updateMember(
                                                "name",
                                                event.target.value
                                            )
                                        }
                                        placeholder="Member name"
                                    />

                                    <small className="field-help">
                                        Trailman name
                                    </small>

                                </label>


                                <label className="form-field">

                                    <span>
                                        Rank
                                    </span>

                                    <select
                                        value={
                                            member.rank
                                        }
                                        onChange={event =>
                                            updateMember(
                                                "rank",
                                                event.target.value
                                            )
                                        }
                                    >

                                        {RANKS.map(
                                            rank => (

                                                <option
                                                    key={rank}
                                                    value={rank}
                                                >
                                                    {rank}
                                                </option>

                                            )
                                        )}

                                    </select>

                                    <small className="field-help">
                                        Trailman rank
                                    </small>

                                </label>


                                <label className="form-field troop-field">

                                    <span>
                                        Troop
                                    </span>

                                    <input
                                        value={
                                            member.troop
                                        }
                                        onChange={event =>
                                            updateMember(
                                                "troop",
                                                event.target.value
                                            )
                                        }
                                        placeholder="AB-0123"
                                        maxLength={7}
                                        pattern="[A-Za-z]{2}-[0-9]{4}"
                                        inputMode="text"
                                    />

                                    <small className="field-help">
                                        Format: AB-0123
                                    </small>

                                </label>


                                <div className="member-form-actions">

                                    <button
                                        type="button"
                                        className="primary-button"
                                        onClick={
                                            addMember
                                        }
                                    >
                                        {editingMemberId
                                            ? "Update Member"
                                            : "Add Member"
                                        }
                                    </button>

                                    {editingMemberId && (

                                        <button
                                            type="button"
                                            className="secondary-button"
                                            onClick={
                                                resetMemberEditor
                                            }
                                        >
                                            Cancel
                                        </button>

                                    )}

                                </div>

                            </div>

                        </div>

                    </div>

                </section>

            </div>


            <footer className="editor-footer">

                <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                        navigate(
                            "/admin/patrols"
                        )
                    }
                    disabled={saving}
                >
                    Cancel
                </button>


                <button
                    type="button"
                    className="primary-button"
                    onClick={savePatrol}
                    disabled={
                        saving ||
                        !patrol.name.trim()
                    }
                >
                    {saving
                        ? "Saving..."
                        : isEdit
                            ? "Save Patrol"
                            : "Create Patrol"
                    }
                </button>

            </footer>


            {showQRCode && (

                <QRCodeModal
                    patrol={patrol}
                    onClose={() =>
                        setShowQRCode(false)
                    }
                />

            )}

        </div>

    );

}