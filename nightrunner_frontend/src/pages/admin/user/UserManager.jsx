import { useEffect, useMemo, useState } from "react";

import ApiService from "../../../api/ApiService.js";
import { useEventContext } from "@/api/helpers/event/EventContext.jsx";

import "./UserManager.css";

const EVENT_ROLES = [
    "user",
    "event-admin"
];

export default function UserManager() {
    const {
        eventId,
        event,
        loading: eventLoading,
        error: eventError
    } = useEventContext();

    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [search, setSearch] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [stations, setStations] = useState([]);
    const [statusFilter, setStatusFilter] = useState("all");

    const currentUser =
        ApiService.userData.getCached();

    const isSystemAdmin =
        ApiService.userData.isSystemAdmin();

    const isEventAdmin =
        eventId
            ? ApiService.userData.isEventAdmin(eventId)
            : false;

    // Station Leader check: user is staff on one or more stations for the selected event
    const userStationAssignments = useMemo(() => {
        const userStaff = currentUser?.stationStaff ?? [];
        if (!eventId) return userStaff;
        return userStaff.filter(s => s.eventId === eventId);
    }, [currentUser, eventId]);

    const isStationLeader = userStationAssignments.length > 0;

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
            setError("No event is currently selected.");
            setLoading(false);
            return;
        }

        loadUsersAndStations();
    }, [eventId, eventLoading, eventError]);

    async function loadUsersAndStations() {
        try {
            setLoading(true);
            setError(null);

            const [userRes, stationRes] = await Promise.all([
                ApiService.userData.getUsers().catch(() => []),
                ApiService.stationData.getStations(eventId).catch(() => [])
            ]);

            setUsers(userRes ?? []);
            setStations(Array.isArray(stationRes) ? stationRes : []);
        } catch (error) {
            console.error(
                "Failed to load user manager data:",
                error
            );

            setError(
                error?.message ??
                "Failed to load users."
            );
        } finally {
            setLoading(false);
        }
    }

    const visibleUsers = useMemo(() => {
        if (isSystemAdmin) {
            return users;
        }

        if (isEventAdmin) {
            // Event admins see all users assigned to this event + all pending users in holding area
            return users.filter(u => u.roles?.[eventId] != null || u.status === "pending" || (u.roles && typeof u.roles === 'object' && Object.keys(u.roles).includes(eventId)));
        }

        if (isStationLeader) {
            // Station leaders see users assigned to their station(s) + all pending users needing assignment
            const myStationIds = new Set(userStationAssignments.map(s => s.stationId));
            return users.filter(u => {
                if (u.status === "pending") return true;
                return (u.stationStaff ?? []).some(s => myStationIds.has(s.stationId));
            });
        }

        return [];
    }, [
        users,
        isSystemAdmin,
        isEventAdmin,
        isStationLeader,
        userStationAssignments,
        eventId
    ]);

    const filteredUsers = useMemo(() => {
        let result = visibleUsers;

        if (statusFilter !== "all") {
            result = result.filter(u => u.status === statusFilter);
        }

        const query =
            search.trim().toLowerCase();

        if (!query) {
            return result;
        }

        return result.filter(user =>
            user.username
                ?.toLowerCase()
                .includes(query) ||
            user.name
                ?.toLowerCase()
                .includes(query) ||
            user.email
                ?.toLowerCase()
                .includes(query)
        );
    }, [
        visibleUsers,
        statusFilter,
        search
    ]);

    function selectUser(user) {
        setSelectedUser({
            ...user,
            roles: {
                ...(user.roles ?? {})
            }
        });

        setError(null);
        setSuccess(null);
    }

    function updateSelectedUser(field, value) {
        setSelectedUser(current => ({
            ...current,
            [field]: value
        }));
    }

    function getEventRole(user) {
        if (!eventId) {
            return null;
        }

        return user?.roles?.[eventId] ?? null;
    }

    function updateSelectedEventRole(role) {
        if (!eventId) {
            return;
        }

        setSelectedUser(current => ({
            ...current,
            roles: {
                ...(current?.roles ?? {}),
                [eventId]: role
            }
        }));
    }

    async function saveUser() {
        if (!selectedUser || !eventId) {
            return;
        }

        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            const role =
                getEventRole(selectedUser) ?? "user";

            let updatedUser;

            if (isSystemAdmin || isEventAdmin) {
                // Single event role update using incremental PATCH
                updatedUser = await ApiService.userData.patchEventRole(
                    selectedUser.id,
                    eventId,
                    role,
                    "add"
                );

                // Also update system admin flag or user level status if system admin changed isAdmin/status
                if (isSystemAdmin) {
                    if (selectedUser.status) {
                        updatedUser = await ApiService.userData.setUserStatus(selectedUser.id, selectedUser.status);
                    }
                    if (typeof selectedUser.isAdmin === 'boolean') {
                        updatedUser = await ApiService.userData.setSystemAdmin(selectedUser.id, selectedUser.isAdmin);
                    }
                }
            } else if (isStationLeader) {
                // Station leaders can update station staff assignment
                updatedUser = await ApiService.userData.setStationStaff(
                    selectedUser.id,
                    selectedUser.assignedStationId ?? "",
                    "staff"
                );
            }

            setUsers(current =>
                current.map(user =>
                    user.id === (updatedUser?.id || selectedUser.id)
                        ? (updatedUser || selectedUser)
                        : user
                )
            );

            if (updatedUser) {
                setSelectedUser(updatedUser);
            }

            setSuccess(
                "User updated successfully."
            );
        } catch (error) {
            console.error(
                "Failed to update user:",
                error
            );

            setError(
                error?.message ??
                "Failed to update user."
            );
        } finally {
            setSaving(false);
        }
    }

    async function handleStatusChange(newStatus) {
        if (!selectedUser) return;
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            await ApiService.userData.setUserStatus(
                selectedUser.id,
                newStatus
            );

            setUsers(current =>
                current.map(u => u.id === selectedUser.id ? { ...u, status: newStatus } : u)
            );
            setSelectedUser(curr => curr ? { ...curr, status: newStatus } : null);
            setSuccess(`User status changed to ${newStatus}.`);
        } catch (err) {
            console.error("Failed to update status:", err);
            setError(err?.message ?? "Failed to update user status.");
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleStation(stationId, currentlyAssigned) {
        if (!selectedUser) return;
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);

            const action = currentlyAssigned ? "remove" : "add";
            const updatedUser = await ApiService.userData.toggleStationStaff(
                selectedUser.id,
                stationId,
                action
            );

            setUsers(current =>
                current.map(u => u.id === selectedUser.id ? (updatedUser || u) : u)
            );
            setSelectedUser(curr => curr ? (updatedUser || curr) : null);
            setSuccess(currentlyAssigned ? "Station role removed." : "Station role assigned.");
        } catch (err) {
            console.error("Failed to update station assignment:", err);
            setError(err?.message ?? "Failed to update station assignment.");
        } finally {
            setSaving(false);
        }
    }

    async function deleteUser() {
        if (!selectedUser) {
            return;
        }

        if (selectedUser.id === currentUser?.id) {
            setError(
                "You cannot delete your own account."
            );
            return;
        }

        if (!window.confirm(
            `Delete ${selectedUser.username}? This action cannot be undone.`
        )) {
            return;
        }

        try {
            setError(null);
            setSuccess(null);

            await ApiService.userData.deleteUser(
                selectedUser.id
            );

            setUsers(current =>
                current.filter(
                    user =>
                        user.id !== selectedUser.id
                )
            );

            setSelectedUser(null);

            setSuccess(
                "User deleted successfully."
            );
        } catch (error) {
            console.error(
                "Failed to delete user:",
                error
            );

            setError(
                error?.message ??
                "Failed to delete user."
            );
        }
    }

    if (eventLoading) {
        return (
            <div className="user-manager-page">
                <div className="loading-panel">
                    Loading event...
                </div>
            </div>
        );
    }

    if (!isSystemAdmin && !isEventAdmin && !isStationLeader) {
        return (
            <div className="user-manager-page">
                <div className="user-manager-denied">
                    <h1>Access Denied</h1>
                    <p>
                        You do not have permission to manage users.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="user-manager-page">
            <header className="page-header">
                <div>
                    <span className="page-eyebrow">
                        Administration
                    </span>

                    <h1>User Manager</h1>

                    <p>
                        Manage user accounts, roles, and event assignments.
                    </p>
                </div>
            </header>

            {error && (
                <div className="error-banner">
                    {error}
                </div>
            )}

            {success && (
                <div className="success-banner">
                    {success}
                </div>
            )}

            <div className="user-toolbar">
                <div className="search-wrapper">
                    <svg
                        className="search-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
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
                        className="search-box"
                        placeholder="Search users..."
                        value={search}
                        onChange={event =>
                            setSearch(event.target.value)
                        }
                    />
                </div>

                <div className="filter-wrapper">
                    <select
                        className="status-filter-select"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending Approval (Holding Area)</option>
                        <option value="active">Active</option>
                        <option value="blocked">Blocked</option>
                    </select>
                </div>

                <span className="user-count">
                    {filteredUsers.length}{" "}
                    {filteredUsers.length === 1
                        ? "user"
                        : "users"}
                </span>
            </div>

            <div className="user-manager-layout">
                <section className="user-list-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Users</h2>

                            <p>
                                Select a user to manage their account.
                            </p>
                        </div>
                    </div>

                    <div className="user-list">
                        {loading ? (
                            <div className="loading-panel">
                                Loading users...
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="empty-list">
                                <h3>No users found</h3>

                                <p>
                                    Try changing your search or status filter.
                                </p>
                            </div>
                        ) : (
                            filteredUsers.map(user => {
                                const role =
                                    getEventRole(user);
                                const userStatus = user.status || "active";

                                return (
                                    <button
                                        type="button"
                                        key={user.id}
                                        className={
                                            selectedUser?.id === user.id
                                                ? "user-card selected"
                                                : "user-card"
                                        }
                                        onClick={() =>
                                            selectUser(user)
                                        }
                                    >
                                        <span className="user-card-avatar">
                                            {(user.name ||
                                                user.username ||
                                                "?")
                                                .charAt(0)
                                                .toUpperCase()}
                                        </span>

                                        <span className="user-card-content">
                                            <strong>
                                                {user.name ||
                                                    user.username}
                                            </strong>

                                            <span>
                                                @{user.username}
                                            </span>
                                        </span>

                                        <span
                                            className={`status-badge status-${userStatus}`}
                                        >
                                            {userStatus}
                                        </span>

                                        <span
                                            className={`role-badge role-${(
                                                user.isAdmin
                                                    ? "system-admin"
                                                    : role
                                            )?.toLowerCase()}`}
                                        >
                                            {user.isAdmin
                                                ? "System Admin"
                                                : formatRole(role)}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </section>

                <section className="user-details">
                    {selectedUser ? (
                        <>
                            <div className="details-header">
                                <div className="user-profile-heading">
                                    <div className="large-avatar">
                                        {(selectedUser.name ||
                                            selectedUser.username ||
                                            "?")
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>

                                    <div>
                                        <span className="details-eyebrow">
                                            User Account
                                        </span>

                                        <h2>
                                            {selectedUser.name ||
                                                selectedUser.username}
                                        </h2>

                                        <p>
                                            @{selectedUser.username}
                                        </p>
                                    </div>

                                    <div className="status-badge-header">
                                        <span className={`status-badge status-${selectedUser.status || 'active'}`}>
                                            {selectedUser.status || 'active'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="details-divider" />

                            <div className="user-form">
                                <label className="form-field">
                                    <span>Username</span>

                                    <input
                                        value={
                                            selectedUser.username ??
                                            ""
                                        }
                                        onChange={event =>
                                            updateSelectedUser(
                                                "username",
                                                event.target.value
                                            )
                                        }
                                        disabled={!isSystemAdmin}
                                    />
                                </label>

                                <label className="form-field">
                                    <span>Name</span>

                                    <input
                                        value={
                                            selectedUser.name ??
                                            ""
                                        }
                                        onChange={event =>
                                            updateSelectedUser(
                                                "name",
                                                event.target.value
                                            )
                                        }
                                        disabled={!isSystemAdmin && !isEventAdmin}
                                    />
                                </label>

                                <label className="form-field">
                                    <span>Email</span>

                                    <input
                                        type="email"
                                        value={
                                            selectedUser.email ??
                                            ""
                                        }
                                        onChange={event =>
                                            updateSelectedUser(
                                                "email",
                                                event.target.value
                                            )
                                        }
                                        disabled={!isSystemAdmin && !isEventAdmin}
                                    />
                                </label>

                                {(isSystemAdmin || isEventAdmin) && (
                                    <label className="form-field">
                                        <span>
                                            Event Role
                                        </span>

                                        <select
                                            value={
                                                getEventRole(
                                                    selectedUser
                                                ) ?? "user"
                                            }
                                            onChange={event =>
                                                updateSelectedEventRole(
                                                    event.target.value
                                                )
                                            }
                                        >
                                            {EVENT_ROLES.map(role => (
                                                <option
                                                    key={role}
                                                    value={role}
                                                >
                                                    {formatRole(role)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}

                                <div className="form-field">
                                    <span>Station Roles & Assignments</span>
                                    <div className="station-checkbox-grid">
                                        {stations.length === 0 ? (
                                            <small className="no-stations-text">No stations created for this event.</small>
                                        ) : (
                                            stations.map(st => {
                                                const assigned = (selectedUser.stationStaff ?? []).some(s => s.stationId === st.id);
                                                return (
                                                    <label key={st.id} className="station-checkbox-item">
                                                        <input
                                                            type="checkbox"
                                                            checked={assigned}
                                                            onChange={() => handleToggleStation(st.id, assigned)}
                                                        />
                                                        <span>{st.name}</span>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                    <small>Users can be assigned staff roles at multiple stations simultaneously.</small>
                                </div>

                                <div className="user-roles-summary-box">
                                    <strong>Assigned Roles Summary</strong>
                                    <div className="user-roles-list">
                                        {selectedUser.isAdmin && (
                                            <span className="role-badge role-system-admin">System Admin</span>
                                        )}
                                        {selectedUser.roles && typeof selectedUser.roles === 'object' && Object.keys(selectedUser.roles).length > 0 ? (
                                            Object.entries(selectedUser.roles).map(([eId, r]) => (
                                                <span key={eId} className="role-badge role-event-role">
                                                    {r} ({eId === eventId ? (event?.name || 'Current Event') : eId})
                                                </span>
                                            ))
                                        ) : (
                                            !selectedUser.isAdmin && (selectedUser.rolesList?.length === 0 || !selectedUser.rolesList) && (
                                                <span className="role-badge role-none">No Event Roles</span>
                                            )
                                        )}
                                        {selectedUser.stationStaff?.map(st => (
                                            <span key={st.stationId} className="role-badge role-station-staff">
                                                Station Staff: {st.stationName || st.stationId}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="event-restriction">
                                    <strong>Event</strong>

                                    <span>
                                        {event?.name ??
                                            eventId}
                                    </span>

                                    <small>
                                        Event roles are managed for
                                        the currently selected event.
                                    </small>
                                </div>

                                {isSystemAdmin && (
                                    <div className="form-field">
                                        <span>
                                            Access
                                        </span>

                                        <label className="system-admin-toggle">
                                            <span>
                                                System administrator
                                            </span>

                                            <input
                                                type="checkbox"
                                                checked={
                                                    selectedUser.isAdmin === true
                                                }
                                                onChange={event =>
                                                    updateSelectedUser(
                                                        "isAdmin",
                                                        event.target.checked
                                                    )
                                                }
                                            />

                                        </label>
                                    </div>
                                )}

                                {isEventAdmin &&
                                    !isSystemAdmin && (
                                        <div className="event-restriction">
                                            <strong>
                                                Access
                                            </strong>

                                            <small>
                                                Event administrators can
                                                manage users assigned to
                                                this event but cannot
                                                grant system administrator
                                                access.
                                            </small>
                                        </div>
                                    )}
                            </div>

                            <div className="details-divider" />

                            <div className="detail-actions">
                                {(isSystemAdmin || isEventAdmin) && (
                                    <>
                                        {(selectedUser.status === "pending" || !selectedUser.status) && (
                                            <button
                                                type="button"
                                                className="success-button"
                                                onClick={() => handleStatusChange("active")}
                                                disabled={saving}
                                            >
                                                Approve User
                                            </button>
                                        )}

                                        {selectedUser.status === "active" && (
                                            <button
                                                type="button"
                                                className="warning-button"
                                                onClick={() => handleStatusChange("blocked")}
                                                disabled={saving}
                                            >
                                                Block User
                                            </button>
                                        )}

                                        {selectedUser.status === "blocked" && (
                                            <button
                                                type="button"
                                                className="secondary-button"
                                                onClick={() => handleStatusChange("active")}
                                                disabled={saving}
                                            >
                                                Unblock User
                                            </button>
                                        )}
                                    </>
                                )}

                                <button
                                    type="button"
                                    className="danger"
                                    onClick={deleteUser}
                                >
                                    Delete User
                                </button>

                                <button
                                    type="button"
                                    className="primary-button"
                                    onClick={saveUser}
                                    disabled={saving}
                                >
                                    {saving
                                        ? "Saving..."
                                        : "Save Changes"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="empty-panel">
                            <div className="empty-icon">
                                👤
                            </div>

                            <h2>No User Selected</h2>

                            <p>
                                Select a user from the list to view
                                and manage their account.
                            </p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

function formatRole(role) {
    switch (role) {
        case "event-admin":
            return "Event Admin";
        case "user":
            return "User";
        default:
            return role ?? "No Role";
    }
}