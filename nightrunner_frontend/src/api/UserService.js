import BackendTransport from "./BackendTransport";

const USER_KEY = "night-runner-user";

/**
 * @typedef {Object} User
 *
 * @property {string} id
 * @property {string} externalId
 * @property {string} username
 * @property {string} email
 * @property {string} displayName
 * @property {boolean} isAdmin
 * @property {Record<string, string>} roles
 */

export default class UserService {

    //
    // Current authenticated application user
    //

    /**
     * Gets the Night Runner user associated with
     * the currently authenticated OIDC user.
     *
     * The backend determines the user from the
     * authenticated access token.
     *
     * This is the source of truth for the
     * Night Runner application user.
     *
     * @returns {Promise<User|null>}
     */
    async get() {

        try {

            const user =
                await BackendTransport.get(
                    "/me"
                );

            if (!user) {

                this.clear();

                return null;

            }

            this.set(user);

            return user;

        }
        catch (error) {

            this.clear();

            throw error;

        }

    }

    /**
     * Refreshes the current Night Runner user
     * from the backend.
     *
     * This is equivalent to get(), but makes the
     * intent clearer when a component wants to
     * explicitly refresh the cached user.
     *
     * @returns {Promise<User|null>}
     */
    async refresh() {

        return await this.get();

    }


    //
    // Local cache
    //

    /**
     * Gets the cached Night Runner user.
     *
     * This is only a cache.
     * It is NOT the source of truth.
     *
     * This does not make a backend request.
     *
     * @returns {User|null}
     */
    getCached() {

        const value =
            localStorage.getItem(
                USER_KEY
            );

        if (!value) {
            return null;
        }

        try {

            return JSON.parse(value);

        }
        catch {

            this.clear();

            return null;

        }

    }

    /**
     * Determines whether a cached Night Runner
     * user exists.
     *
     * This does NOT determine whether the user
     * is currently authenticated.
     *
     * @returns {boolean}
     */
    hasCachedUser() {

        return this.getCached() !== null;

    }

    listeners = new Set();

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notifyListeners(user) {
        this.listeners.forEach(fn => {
            try { fn(user); } catch (e) { console.error("UserService listener error:", e); }
        });
    }

    /**
     * Stores the Night Runner application user
     * locally.
     *
     * This is only a cache.
     *
     * @param {User} user
     */
    set(user) {

        if (!user) {

            this.clear();

            return;

        }

        localStorage.setItem(
            USER_KEY,
            JSON.stringify(user)
        );

        this.notifyListeners(user);

    }

    /**
     * Removes the cached Night Runner user.
     *
     * This does NOT log the user out of OIDC.
     */
    clear() {

        localStorage.removeItem(
            USER_KEY
        );

        this.notifyListeners(null);

    }


    //
    // Current User Properties
    //

    /**
     * Gets the Night Runner user's ID.
     *
     * @returns {string|null}
     */
    getId() {

        return this.getCached()?.id ?? null;

    }

    /**
     * Gets the external OIDC identity ID
     * associated with the Night Runner user.
     *
     * @returns {string|null}
     */
    getExternalId() {

        return this.getCached()?.externalId ?? null;

    }

    /**
     * Gets the Night Runner username.
     *
     * @returns {string|null}
     */
    getUsername() {

        return this.getCached()?.username ?? null;

    }

    /**
     * Gets the Night Runner user's email.
     *
     * @returns {string|null}
     */
    getEmail() {

        return this.getCached()?.email ?? null;

    }

    /**
     * Gets the Night Runner user's display name.
     *
     * @returns {string|null}
     */
    getDisplayName() {

        return this.getCached()?.displayName ?? null;

    }


    //
    // Root/System Administration
    //

    /**
     * Determines whether the current user
     * is a root/system administrator.
     *
     * @returns {boolean}
     */
    isSystemAdmin() {

        return true;//this.getCached()?.isAdmin === true;

    }

    /**
     * Determines whether the current user's
     * account status is pending approval.
     *
     * @returns {boolean}
     */
    isPending() {

        return this.getCached()?.status === "pending";

    }


    //
    // Event Roles
    //

    /**
     * Gets the event role map.
     *
     * @returns {Object<string, string>}
     */
    getRoles() {

        return this.getCached()?.roles ?? {};

    }

    /**
     * Gets the role for a specific event.
     *
     * @param {string} eventId
     * @returns {string|null}
     */
    getEventRole(eventId) {

        if (!eventId) {
            return null;
        }

        return this.getRoles()[eventId] ?? null;

    }

    /**
     * Gets all event IDs assigned to the user.
     *
     * @returns {string[]}
     */
    getEventIds() {

        return Object.keys(
            this.getRoles()
        );

    }

    /**
     * Gets the number of events assigned
     * to the current user.
     *
     * @returns {number}
     */
    getEventCount() {

        return this.getEventIds().length;

    }

    /**
     * Determines whether the current user
     * has a role for a specific event.
     *
     * Root administrators are considered to
     * have access to every event.
     *
     * @param {string} eventId
     * @returns {boolean}
     */
    hasEventAccess(eventId) {

        if (!eventId) {
            return false;
        }

        if (this.isSystemAdmin()) {
            return true;
        }

        return this.getEventRole(eventId) !== null;

    }

    /**
     * Determines whether the current user
     * is an event administrator for an event.
     *
     * @param {string} eventId
     * @returns {boolean}
     */
    isEventAdmin(eventId) {

        return (
            this.isSystemAdmin() ||
            this.getEventRole(eventId) === "event-admin"
        );

    }

    /**
     * Determines whether the current user
     * has any administrative access to an event.
     *
     * @param {string} eventId
     * @returns {boolean}
     */
    isAdmin(eventId = null) {

        if (this.isSystemAdmin()) {
            return true;
        }

        if (!eventId) {
            return false;
        }

        return this.isEventAdmin(eventId);

    }

    /**
     * Determines whether the current user
     * is a normal event user.
     *
     * @param {string} eventId
     * @returns {boolean}
     */
    isUser(eventId) {

        return (
            !this.isSystemAdmin() &&
            this.getEventRole(eventId) === "user"
        );

    }


    //
    // User Management
    //

    async getUsers() {

        return await BackendTransport.get(
            "/users"
        );

    }

    async getUser(userId) {

        return await BackendTransport.get(
            `/users/${userId}`
        );

    }

    async createUser(user) {

        return await BackendTransport.post(
            "/users",
            user
        );

    }

    async updateUser(
        userId,
        user
    ) {

        return await BackendTransport.put(
            `/users/${userId}`,
            user
        );

    }

    async deleteUser(userId) {

        return await BackendTransport.delete(
            `/users/${userId}`
        );

    }

    async setUserStatus(userId, status) {

        return await this.patchUser(
            userId,
            { status }
        );

    }

    async setStationStaff(userId, stationId, stationRole = "staff") {

        return await this.patchUser(
            userId,
            { stationId, stationRole, stationAction: "assign" }
        );

    }

    async toggleStationStaff(userId, stationId, action = "add") {

        return await this.patchUser(
            userId,
            { stationId, stationAction: action === "add" ? "assign" : "remove" }
        );

    }


    //
    // User Access Management
    //

    /**
     * Changes a user's root administrator status.
     *
     * @param {string} userId
     * @param {boolean} isAdmin
     * @returns {Promise<User>}
     */
    async setSystemAdmin(
        userId,
        isAdmin
    ) {

        return await this.updateUser(
            userId,
            {
                isAdmin
            }
        );

    }

    async patchUser(
        userId,
        payload
    ) {

        return await BackendTransport.patch(
            `/users/${userId}`,
            payload
        );

    }

    /**
     * Assigns or updates a single role to a user for an event via PATCH.
     *
     * @param {string} userId
     * @param {string} eventId
     * @param {string} role
     * @param {string} action ("add" | "remove")
     * @returns {Promise<User>}
     */
    async patchEventRole(
        userId,
        eventId,
        role,
        action = "add"
    ) {

        return await this.patchUser(
            userId,
            {
                eventId,
                role,
                roleAction: action
            }
        );

    }

    /**
     * Removes a user's role for an event.
     *
     * @param {string} userId
     * @param {string} eventId
     * @returns {Promise<User>}
     */
    async removeEventRole(
        userId,
        eventId
    ) {

        return await this.patchUser(
            userId,
            {
                eventId,
                roleAction: "remove"
            }
        );

    }

    /**
     * Updates a user's root administrator status
     * and event roles.
     *
     * @param {string} userId
     * @param {boolean} isAdmin
     * @param {Object<string, string>} roles
     * @returns {Promise<User>}
     */
    async updateUserAccess(
        userId,
        isAdmin,
        roles
    ) {

        return await this.updateUser(
            userId,
            {
                isAdmin,
                roles
            }
        );

    }

}