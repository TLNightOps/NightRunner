import AuthService from "./auth/AuthService.js";

const API_BASE =
    import.meta.env.VITE_API_BACKEND_URL ||
    "http://localhost:8000/v1";

class BackendTransport {

    //
    // Headers
    //

    async authHeaders() {

        const headers = {
            "Content-Type": "application/json"
        };

        const token =
            await AuthService.getToken();

        if (token) {

            headers.Authorization =
                `Bearer ${token}`;

        }

        return headers;

    }


    //
    // Generic Request
    //

    async request(
        method,
        url,
        body = null
    ) {

        const headers =
            await this.authHeaders();

        const response = await fetch(
            `${API_BASE}${url}`,
            {
                method,

                headers,

                body:
                    body !== null
                        ? JSON.stringify(body)
                        : undefined
            }
        );

        // 2. Only redirect if the user is NOT already on the login or register pages
        if (response.status === 401) {
            // 1. Get the current URL path
            const currentPath = window.location.pathname;

            // 2. Only redirect if the user is NOT already on the login or register pages
            if (
                currentPath !== "/login" &&
                currentPath !== "/register" &&
                !AuthService.isLoading() &&
                !AuthService.isAuthenticated()
            ) {
                window.location.replace("/login?expired=true");
            }

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