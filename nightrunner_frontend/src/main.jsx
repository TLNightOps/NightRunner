import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";

import "./index.css";
import "./App.css";

import App from "./App.jsx";
import AuthServiceProvider from "./api/auth/AuthServiceProvider.jsx";
import BrandingProvider from "./branding/BrandingProvider.jsx";
import {EventProvider} from "./api/helpers/event/EventContext.jsx";

const authority =
    import.meta.env.VITE_OIDC_AUTHORITY ??
    "http://localhost:4000";

const isGoogleSecureToken = authority.includes("securetoken.google.com");
const projectId = isGoogleSecureToken ? authority.split("/").pop() : "";

const oidcConfig = {

    authority,

    client_id:
        import.meta.env.VITE_OIDC_CLIENT_ID ??
        "client-id",

    redirect_uri:
        `${window.location.origin}/callback`,

    response_type: "code",

    scope: "openid profile email",

    // GCP Identity Platform / Firebase OIDC public SPA client flow (PKCE authorization code flow)
    ...(isGoogleSecureToken ? {
        response_mode: "query",
        metadata: {
            issuer: authority,
            authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
            token_endpoint: "https://oauth2.googleapis.com/token",
            jwks_uri: "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
            code_challenge_methods_supported: ["S256"],
        }
    } : {}),

    // Store the session in localStorage so all tabs share the same OIDC session.
    // The default (sessionStorage) is tab-isolated, which breaks pages opened
    // in a new tab (e.g. /live) before the React auth context has initialised.
    userStore:
        new WebStorageStateStore({ store: window.localStorage }),

    onSigninCallback: () => {
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );
    }
};


createRoot(
    document.getElementById("root")
).render(
    //<StrictMode>
        <BrowserRouter>

            <AuthProvider {...oidcConfig}>
                <AuthServiceProvider>

                    <BrandingProvider>
                        <EventProvider>
                            <App />
                        </EventProvider>
                    </BrandingProvider>

                </AuthServiceProvider>
            </AuthProvider>

        </BrowserRouter>
    //</StrictMode>
);