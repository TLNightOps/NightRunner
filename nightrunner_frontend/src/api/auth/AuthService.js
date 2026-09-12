import { User } from "oidc-client-ts";

export const FIREBASE_TOKEN_STORAGE_KEY = "firebase_id_token";


/**
 * Reads the cached Firebase ID token.
 *
 * localStorage access throws rather than returning null in some privacy
 * modes, so every access is guarded.
 *
 * @returns {string|null}
 */
export function readStoredFirebaseToken() {

    try {
        return localStorage.getItem(FIREBASE_TOKEN_STORAGE_KEY);
    } catch {
        return null;
    }

}


/**
 * Caches the Firebase ID token.
 *
 * @param {string} token
 */
export function writeStoredFirebaseToken(token) {

    try {
        localStorage.setItem(FIREBASE_TOKEN_STORAGE_KEY, token);
    } catch {
        // Storage unavailable — the SDK remains the source of truth.
    }

}


/**
 * Removes the cached Firebase ID token.
 */
export function clearStoredFirebaseToken() {

    try {
        localStorage.removeItem(FIREBASE_TOKEN_STORAGE_KEY);
    } catch {
        // Storage unavailable — nothing to clear.
    }

}


/**
 * Provides access to the application's OIDC authentication
 * state and operations.
 *
 * This class intentionally contains no React hooks.
 *
 * React authentication state is supplied through
 * AuthServiceProvider.
 */
class AuthService {

    constructor() {

        this.auth = null;

    }


    //
    // Initialization
    //

    /**
     * Connects the service to the react-oidc-context
     * authentication object.
     *
     * This is called by AuthServiceProvider.
     *
     * @param {import('react-oidc-context').AuthContextProps} auth
     * Authentication context returned by useAuth().
     */
    initialize(auth) {

        this.auth = auth;

    }


    /**
     * Determines whether AuthService has been connected
     * to the OIDC authentication context.
     *
     * @returns {boolean}
     */
    isInitialized() {

        return this.auth !== null;

    }


    //
    // Authentication State
    //

    /**
     * Determines whether the current user is authenticated.
     *
     * @returns {boolean}
     */
    isAuthenticated() {

        if (this.auth?.isAuthenticated) {
            return true;
        }

        if (readStoredFirebaseToken()) {
            return true;
        }

        return Boolean(this.getCachedToken());

    }


    /**
     * Determines whether authentication is currently loading.
     *
     * @returns {boolean}
     */
    isLoading() {

        return this.auth?.isLoading ?? true;

    }


    /**
     * Gets the current authentication error.
     *
     * @returns {Error|null}
     */
    getError() {

        return this.auth?.error ?? null;

    }


    //
    // OIDC User
    //

    /**
     * Gets the current OIDC user session.
     *
     * @returns {import('react-oidc-context').User|null}
     */
    getUser() {

        return this.auth?.user ?? null;

    }


    /**
     * Gets the current OIDC user profile.
     *
     * @returns {import('react-oidc-context').User['profile']|null}
     */
    getProfile() {

        return this.auth?.user?.profile ?? null;

    }


    //
    // Access Token
    //

    /**
     * Gets the token to send to the Night Runner backend using the
     * Authorization Bearer header.
     *
     * In Firebase mode this asks the Firebase SDK for a live token rather
     * than trusting the copy in localStorage. Firebase ID tokens are only
     * valid for one hour, and the background refresh timers that keep that
     * copy current are frozen whenever the tab is hidden or the device is
     * asleep — so the stored copy is routinely expired by the time the user
     * comes back. Firebase caches the token internally and only performs a
     * network round trip when it is close to expiring, so calling this on
     * every request is cheap.
     *
     * @returns {Promise<string|null>}
     */
    async getToken() {

        // Fast path: React context is initialised (normal in-app navigation).
        const inMemoryToken = this.auth?.user?.access_token;
        if (inMemoryToken) {
            return inMemoryToken;
        }

        // Firebase mode: resolve a live token, falling back to the stored
        // copy if the SDK is unavailable.
        const firebaseToken = await this.getFirebaseToken();
        if (firebaseToken) {
            return firebaseToken;
        }

        return this.getOidcStorageToken();

    }


    /**
     * Synchronous best-effort token read, for callers that cannot await.
     *
     * This may return an expired token; use getToken() anywhere the token is
     * actually going to be sent to the backend.
     *
     * @returns {string|null}
     */
    getCachedToken() {

        const inMemoryToken = this.auth?.user?.access_token;
        if (inMemoryToken) {
            return inMemoryToken;
        }

        const firebaseToken = readStoredFirebaseToken();
        if (firebaseToken) {
            return firebaseToken;
        }

        return this.getOidcStorageToken();

    }


    /**
     * Resolves the current Firebase ID token from the SDK, refreshing it if
     * it has expired or is about to.
     *
     * @param {boolean} forceRefresh Bypass Firebase's cache and mint a new
     * token. Used after the backend has rejected a token as expired.
     * @returns {Promise<string|null>}
     */
    async getFirebaseToken(forceRefresh = false) {

        const storedToken = readStoredFirebaseToken();

        try {

            const { isFirebaseMode, auth } =
                await import("@/api/auth/firebaseAuth.js");

            if (!isFirebaseMode || !auth?.currentUser) {
                return storedToken;
            }

            const token =
                await auth.currentUser.getIdToken(forceRefresh);

            if (token) {
                writeStoredFirebaseToken(token);
                return token;
            }

        } catch (err) {

            // Offline, or the refresh token has been revoked. Fall back to
            // the stored copy and let the backend be the judge.
            console.warn(
                "Failed to resolve a fresh Firebase ID token:",
                err
            );

        }

        return storedToken;

    }


    /**
     * Forces a new token to be minted, bypassing Firebase's cache.
     *
     * @returns {Promise<string|null>}
     */
    async refreshToken() {

        return await this.getFirebaseToken(true);

    }


    /**
     * Reads the token oidc-client-ts persisted to storage.
     *
     * @returns {string|null}
     */
    getOidcStorageToken() {
        try {

            const authority =
                import.meta.env.VITE_OIDC_AUTHORITY ?? "http://localhost:4000";

            const clientId =
                import.meta.env.VITE_OIDC_CLIENT_ID ?? "client-id";

            const storageKey = `oidc.user:${authority}:${clientId}`;

            const raw = localStorage.getItem(storageKey);

            if (raw) {

                const user = User.fromStorageString(raw);

                if (user && !user.expired) {
                    return user.access_token;
                }

            }

        } catch {

            // Malformed storage entry — fall through and return null.

        }

        return null;

    }


    //
    // Login
    //

    /**
     * Begins the OIDC login flow.
     *
     * The username and password are entered at the
     * identity provider, not inside Night Runner.
     *
     * @returns {Promise<void>}
     */
    async login() {

        if (!this.auth) {

            throw new Error(
                "Authentication service has not been initialized."
            );

        }

        await this.auth.signinRedirect();

    }


    //
    // Logout
    //

    /**
     * Removes the current OIDC session.
     *
     * @returns {Promise<void>}
     */
    async logout() {

        clearStoredFirebaseToken();

        try {
            const { isFirebaseMode, firebaseLogout } = await import("@/api/auth/firebaseAuth.js");
            if (isFirebaseMode) {
                await firebaseLogout();
                window.location.href = "/login?loggedOut=true";
                return;
            }
        } catch {
            // Ignore error if firebase module fail
        }

        if (!this.auth) {

            throw new Error(
                "Authentication service has not been initialized."
            );

        }

        await this.auth.signoutRedirect({
            post_logout_redirect_uri:
                `${window.location.origin}/login?loggedOut=true`
        });

    }

}


export default new AuthService();