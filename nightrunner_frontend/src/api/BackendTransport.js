import AuthService, { clearStoredFirebaseToken } from "./auth/AuthService.js";

const API_BASE =
    import.meta.env.VITE_API_BACKEND_URL ||
    "http://localhost:8000/v1";

class BackendTransport {

    //
    // Headers
    //

    buildHeaders(token) {

        const headers = {
            "Content-Type": "application/json"
        };

        if (token) {

            headers.Authorization =
                `Bearer ${token}`;

        }

        return headers;

    }


    async authHeaders() {

        return this.buildHeaders(
            await AuthService.getToken()
        );

    }


    //
    // Session Expiry
    //

    /**
     * Sends the user back to the login page after the backend has refused a
     * freshly minted token.
     *
     * Skipped on the login and register pages so an unauthenticated visitor
     * is not bounced around in a loop.
     */
    redirectToLogin() {

        const currentPath = window.location.pathname;

        if (
            currentPath !== "/login" &&
            currentPath !== "/register"
        ) {
            window.location.replace("/login?expired=true");
        }

    }


    //
    // Generic Request
    //

    async request(
        method,
        url,
        body = null,
        { allowRetry = true } = {}
    ) {

        const token =
            await AuthService.getToken();

        const response = await fetch(
            `${API_BASE}${url}`,
            {
                method,

                headers: this.buildHeaders(token),

                body:
                    body !== null
                        ? JSON.stringify(body)
                        : undefined
            }
        );

        if (response.status === 401) {

            // The token we sent was refused. Firebase ID tokens are only
            // valid for an hour and expire silently while the tab is
            // backgrounded or the device is asleep, so a 401 here is far more
            // likely to be a stale token than a genuinely ended session.
            // Mint a brand new one and replay the request once before
            // treating the session as over.
            if (allowRetry) {

                const refreshedToken =
                    await AuthService.refreshToken();

                if (
                    refreshedToken &&
                    refreshedToken !== token
                ) {

                    return await this.request(
                        method,
                        url,
                        body,
                        { allowRetry: false }
                    );

                }

            }

            // A token minted seconds ago was still refused: the session is
            // genuinely over. Drop the stale credential so the app stops
            // reporting the user as signed in.
            // Deliberately not gated on AuthService.isLoading(): that returns
            // true whenever the service has not been initialised, which used
            // to suppress the redirect and strand the user on a page where
            // every action failed.
            clearStoredFirebaseToken();
            this.redirectToLogin();

            throw new Error("Authentication expired.");
        }

        if (response.status === 204) {

            return null;

        }

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data?.error?.message ??
                response.statusText
            );

        }

        return data;

    }


    //
    // HTTP Methods
    //

    get(url) {

        return this.request(
            "GET",
            url
        );

    }


    post(url, body) {

        return this.request(
            "POST",
            url,
            body
        );

    }


    put(url, body) {

        return this.request(
            "PUT",
            url,
            body
        );

    }


    patch(url, body) {

        return this.request(
            "PATCH",
            url,
            body
        );

    }


    delete(url) {

        return this.request(
            "DELETE",
            url
        );

    }

}

export default new BackendTransport();