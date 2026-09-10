import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";

import AuthService from "@/api/auth/AuthService.js";
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
        import("@/api/auth/firebaseAuth.js").then(({ subscribeToFirebaseToken, isFirebaseMode }) => {
            if (isFirebaseMode) {
                unsubscribe = subscribeToFirebaseToken((token, user) => {
                    if (token) {
                        localStorage.setItem("firebase_id_token", token);
                        setFirebaseUser(user);
                        // Eagerly fetch backend user profile & roles so cached user and admin rights update reactively
                        ApiService.userData.get().catch(() => {});
                    } else {
                        localStorage.removeItem("firebase_id_token");
                        setFirebaseUser(null);
                        ApiService.userData.clear();
                    }
                });
            }
        });
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    // Combine oidc-context auth with firebase state
    const effectiveIsAuthenticated = auth.isAuthenticated || Boolean(localStorage.getItem("firebase_id_token")) || Boolean(firebaseUser);

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