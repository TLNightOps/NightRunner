import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";

import AuthService, {
    clearStoredFirebaseToken,
    readStoredFirebaseToken,
    writeStoredFirebaseToken
} from "@/api/auth/AuthService.js";
import ApiService from "@/api/ApiService.js";

export default function AuthServiceProvider({
                                                children
                                            }) {

    const auth = useAuth();
    const [firebaseUser, setFirebaseUser] = useState(null);

    useEffect(() => {

        AuthService.initialize(auth);

        if (auth.isAuthenticated) {
            // Eagerly fetch backend user profile & roles so cached user and admin rights update reactively
            ApiService.userData.get().catch(() => {});
        }

    }, [auth, auth.isAuthenticated]);

    useEffect(() => {
        let unsubscribe;
        let tokenInterval;
        let cancelled = false;

        import("@/api/auth/firebaseAuth.js").then(({ subscribeToFirebaseToken, isFirebaseMode, auth }) => {
            // The effect may have been torn down while this dynamic import
            // was in flight; do not start anything we can no longer clean up.
            if (!isFirebaseMode || cancelled) {
                return;
            }

            unsubscribe = subscribeToFirebaseToken(async (token, user) => {
                if (token) {
                    writeStoredFirebaseToken(token);
                    setFirebaseUser(user);
                    // Eagerly fetch backend user profile & roles so cached user and admin rights update reactively
                    ApiService.userData.get().catch(() => {});
                } else {
                    clearStoredFirebaseToken();
                    setFirebaseUser(null);
                    ApiService.userData.clear();
                }
            });

            // Belt and braces alongside onIdTokenChanged: top the stored token
            // up every 10 minutes. This only runs while the tab is awake, so
            // BackendTransport still resolves a live token per request rather
            // than relying on this.
            tokenInterval = setInterval(async () => {
                if (auth?.currentUser) {
                    try {
                        const freshToken = await auth.currentUser.getIdToken(/* forceRefresh */ false);
                        if (freshToken) {
                            writeStoredFirebaseToken(freshToken);
                        }
                    } catch (err) {
                        console.warn("Failed periodic background token refresh:", err);
                    }
                }
            }, 10 * 60 * 1000);

            if (cancelled) {
                clearInterval(tokenInterval);
            }
        });

        // 12-Hour Inactivity Session Expiry Manager
        const MAX_INACTIVE_MS = 12 * 60 * 60 * 1000; // 12 hours
        const updateActivity = () => {
            localStorage.setItem("last_user_activity", Date.now().toString());
        };

        // Initialize activity timestamp on first load if not set
        if (!localStorage.getItem("last_user_activity")) {
            updateActivity();
        }

        // Attach event listeners for user interaction
        const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];
        activityEvents.forEach((evt) => window.addEventListener(evt, updateActivity, { passive: true }));

        // Interval timer to check for 12h inactivity timeout
        const inactivityCheckInterval = setInterval(() => {
            const lastActivity = parseInt(localStorage.getItem("last_user_activity") || "0", 10);
            if (lastActivity && Date.now() - lastActivity > MAX_INACTIVE_MS) {
                console.warn("User inactive for over 12 hours. Session expired.");
                localStorage.removeItem("last_user_activity");
                AuthService.logout().catch(() => {
                    window.location.href = "/login?loggedOut=true";
                });
            }
        }, 60 * 1000); // Check every minute

        return () => {
            cancelled = true;
            if (unsubscribe) unsubscribe();
            if (tokenInterval) clearInterval(tokenInterval);
            activityEvents.forEach((evt) => window.removeEventListener(evt, updateActivity));
            clearInterval(inactivityCheckInterval);
        };
    }, []);

    // Combine oidc-context auth with firebase state
    const effectiveIsAuthenticated = auth.isAuthenticated || Boolean(readStoredFirebaseToken()) || Boolean(firebaseUser);

    const mergedAuth = {
        ...auth,
        isAuthenticated: effectiveIsAuthenticated,
        user: auth.user || (firebaseUser ? {
            profile: {
                name: firebaseUser.displayName || firebaseUser.email,
                email: firebaseUser.email,
                sub: firebaseUser.uid
            }
        } : null)
    };

    AuthService.initialize(mergedAuth);

    return children;

}