import { initializeApp, getApps } from "firebase/app";
import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    GoogleAuthProvider,
    signOut,
    onIdTokenChanged,
    sendPasswordResetEmail,
    updateProfile
} from "firebase/auth";

const authority = import.meta.env.VITE_OIDC_AUTHORITY ?? "http://localhost:4000";
export const isFirebaseMode = authority.includes("securetoken.google.com") || Boolean(import.meta.env.VITE_FIREBASE_API_KEY);

const projectId = authority.split("/").pop();

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForInitializationOnly",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId: projectId,
};

let app;
let auth;

if (isFirebaseMode) {
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApps()[0];
    }
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch((err) => {
        console.warn("Failed to set Firebase Auth local persistence:", err);
    });
}

export { auth };

/**
 * Sign in with Email & Password via Firebase Auth
 */
export async function firebaseLoginWithEmail(email, password) {
    if (!auth) throw new Error("Firebase Auth is not enabled.");
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    if (userCredential?.user) {
        const token = await userCredential.user.getIdToken();
        localStorage.setItem("firebase_id_token", token);
    }
    return userCredential;
}

/**
 * Register/Sign up with Email & Password via Firebase Auth
 */
export async function firebaseRegisterWithEmail(email, password) {
    if (!auth) throw new Error("Firebase Auth is not enabled.");
    return await createUserWithEmailAndPassword(auth, email, password);
}

/**
 * Sign in with Google Social Auth via Firebase Auth
 */
export async function firebaseLoginWithGoogle() {
    if (!auth) throw new Error("Firebase Auth is not enabled.");
    const provider = new GoogleAuthProvider();
    let userCredential;
    try {
        userCredential = await signInWithPopup(auth, provider);
    } catch (err) {
        if (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user" || err.message?.includes("Cross-Origin-Opener-Policy")) {
            userCredential = await signInWithRedirect(auth, provider);
        } else {
            throw err;
        }
    }
    if (userCredential?.user) {
        const token = await userCredential.user.getIdToken();
        localStorage.setItem("firebase_id_token", token);
    }
    return userCredential;
}

/**
 * Sign out of Firebase Auth
 */
export async function firebaseLogout() {
    if (!auth) throw new Error("Firebase Auth is not enabled.");
    return await signOut(auth);
}

/**
 * Subscribe to Firebase ID Token updates
 */
export function subscribeToFirebaseToken(callback) {
    if (!auth) return () => {};
    return onIdTokenChanged(auth, async (user) => {
        if (user) {
            const token = await user.getIdToken();
            callback(token, user);
        } else {
            callback(null, null);
        }
    });
}

/**
 * Send password reset email via Firebase Auth
 */
export async function firebaseSendPasswordResetEmail(email) {
    if (!auth) throw new Error("Firebase Auth is not enabled.");
    return await sendPasswordResetEmail(auth, email);
}

/**
 * Update user profile via Firebase Auth
 */
export async function firebaseUpdateProfile(user, profile) {
    if (!auth) throw new Error("Firebase Auth is not enabled.");
    return await updateProfile(user, profile);
}


