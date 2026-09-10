import { User } from "oidc-client-ts";

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

        return Boolean(localStorage.getItem("firebase_id_token"));

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
     * Gets the current OIDC access token.
     *
     * This token is sent to the Night Runner backend
     * using the Authorization Bearer header.
     *
     * @returns {string|null}
     */
    getToken() {

        // Fast path: React context is initialised (normal in-app navigation).
        const inMemoryToken = this.auth?.user?.access_token;
        if (inMemoryToken) {
            return inMemoryToken;
        }

        // Fallback: check Firebase token if initialized in Firebase mode
        const firebaseToken = localStorage.getItem("firebase_id_token");
        if (firebaseToken) {
            return firebaseToken;
        }

        // Fallback: read the token oidc-client-ts persisted to sessionStorage/localStorage.
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

        localStorage.removeItem("firebase_id_token");

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