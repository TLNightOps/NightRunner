import {
    Routes,
    Route,
    Navigate, useLocation
} from "react-router-dom";

import {
    useAuth
} from "react-oidc-context";

import Layout from "./components/Layout.jsx";
import NotFound from "./pages/NotFound.jsx";

import {
    ACCESS,
    AppRoutes
} from "./AppRoutes.jsx";


import AuthService from "@/api/auth/AuthService.js";
import ApiService from "@/api/ApiService.js";

function ProtectedRoute({ children }) {

    const auth =
        useAuth();

    const location =
        useLocation();

    const isAuthenticated = AuthService.isAuthenticated();

    if (auth.isLoading && !isAuthenticated) {

        return (
            <div>
                Loading authentication...
            </div>
        );

    }


    if (auth.error && !isAuthenticated) {

        return (
            <div>
                Authentication error:
                {" "}
                {auth.error.message}
            </div>
        );

    }


    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                state={{
                    from: location
                }}
                replace
            />
        );
    }

    const cachedUser = AuthService.isAuthenticated() ? ApiService.userData.getCached() : null;
    const isPending = cachedUser?.status === "pending";

    if (isPending && location.pathname !== "/pending") {
        return (
            <Navigate
                to="/pending"
                replace
            />
        );
    }

    if (!isPending && location.pathname === "/pending") {
        return (
            <Navigate
                to="/dashboard"
                replace
            />
        );
    }

    return children;
}


function AnonymousRoute({ children }) {

    const auth = useAuth();

    const isAuthenticated = AuthService.isAuthenticated();

    if (auth.isLoading && !isAuthenticated) {
        return (
            <div>
                Loading authentication...
            </div>
        );
    }


    if (isAuthenticated) {
        return (
            <Navigate
                to="/dashboard"
                replace
            />
        );
    }

    return children;

}


function RouteElement({ route }) {

    const Element =
        route.element;


    if (route.redirect) {

        return (
            <Navigate
                to={route.redirect}
                replace
            />
        );

    }


    const element =
        <Element />;


    if (route.anonymous) {

        return (
            <AnonymousRoute>
                {element}
            </AnonymousRoute>
        );

    }


    if (
        route.access === ACCESS.PUBLIC
    ) {
        return element;
    }


    return (
        <ProtectedRoute>
            {element}
        </ProtectedRoute>
    );

}


function renderRoute(route) {

    return (
        <Route
            key={route.path}
            path={route.path}
            element={
                <RouteElement
                    route={route}
                />
            }
        />
    );

}


export default function App() {

    const layoutRoutes =
        AppRoutes.filter(
            route =>
                route.layout !== false
        );


    const standaloneRoutes =
        AppRoutes.filter(
            route =>
                route.layout === false
        );


    return (

        <Routes>

            <Route element={<Layout />}>

                {layoutRoutes.map(
                    renderRoute
                )}

            </Route>


            {standaloneRoutes.map(
                renderRoute
            )}


            <Route
                path="*"
                element={<NotFound />}
            />

        </Routes>

    );

}