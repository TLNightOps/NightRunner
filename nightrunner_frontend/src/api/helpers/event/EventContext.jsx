import {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";

import { useAuth } from "react-oidc-context";

import EventSelector from "./EventSelector.jsx";
import AuthService from "../../auth/AuthService.js";
import ApiService from "../../ApiService.js";
import useBranding from "@/branding/UseBranding.js";

const EventContext = createContext(null);

export function EventProvider({ children }) {

    const auth = useAuth();
    const { changeBranding } = useBranding();

    const [event, setEvent] = useState(null);
    const [eventId, setEventId] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [showEventSelector, setShowEventSelector] = useState(false);
    const [selectableEvents, setSelectableEvents] = useState([]);

    const isAuthenticated =
        AuthService.isAuthenticated();


    //
    // Initialize event context when authentication changes.
    //

    useEffect(() => {

        if (auth.isLoading && !isAuthenticated) {
            return;
        }

        if (!isAuthenticated) {

            setEvent(null);
            setEventId(null);
            setSelectableEvents([]);
            setShowEventSelector(false);
            setError(null);
            setLoading(false);

            changeBranding("night-ops");

            return;
        }

        initializeEvent();

    }, [
        auth.isLoading,
        isAuthenticated
    ]);


    //
    // Determine initial event state.
    //

    async function initializeEvent() {

        try {

            setLoading(true);
            setError(null);

            const user =
                await ApiService.userData.get();

            if (!user) {
                throw new Error(
                    "Unable to determine the current user."
                );
            }

            const isSystemAdmin = ApiService.userData.isSystemAdmin();

            const roles =
                user.roles ?? {};

            const eventIds =
                Object.keys(roles);


            //
            // SYSTEM ADMIN
            //
            // System admins do not need an event assignment.
            //

            if (isSystemAdmin) {

                const events =
                    await loadSelectableEvents();

                /*
                 * System admins start without an event selected.
                 */
                setEvent(null);
                setEventId(null);

                /*
                 * Allow them to select any event.
                 */
                setShowEventSelector(
                    events.length > 0
                );

                return;
            }


            //
            // NORMAL USER
            //

            if (eventIds.length === 0) {

                throw new Error(
                    "No event is currently assigned to your account."
                );

            }


            //
            // Exactly one event.
            //

            if (eventIds.length === 1) {

                await selectEvent(
                    eventIds[0]
                );

                return;
            }


            //
            // Multiple events.
            //

            const events =
                await loadSelectableEvents(
                    eventIds
                );

            setShowEventSelector(
                events.length > 0
            );

        }
        catch (error) {

            console.error(
                "Failed to initialize event context:",
                error
            );

            setError(
                error?.message ??
                "Unable to determine the current event."
            );

            setShowEventSelector(false);

        }
        finally {

            setLoading(false);

        }

    }


    //
    // Load selectable events.
    //

    async function loadSelectableEvents(
        allowedEventIds = null
    ) {

        const response =
            await ApiService.eventData.getEvents();

        const events =
            Array.isArray(response)
                ? response
                : response?.events ?? [];


        //
        // No event restrictions.
        //
        // Used by system administrators.
        //

        if (!allowedEventIds) {

            setSelectableEvents(
                events
            );

            return events;

        }


        //
        // Restricted event list.
        //
        // Used by normal users.
        //

        const allowedIds =
            new Set(
                allowedEventIds.map(
                    id => String(id)
                )
            );

        const filteredEvents =
            events.filter(
                currentEvent =>
                    allowedIds.has(
                        String(currentEvent.id)
                    )
            );

        setSelectableEvents(
            filteredEvents
        );

        return filteredEvents;

    }


    //
    // Get the currently selected event.
    //

    function getCurrentEvent() {

        if (event) {
            return event;
        }

        /*
         * This is particularly useful for system admins.
         *
         * They can be authenticated without an event selected.
         */
        openEventSelector();

        return null;

    }


    //
    // Select an event.
    //

    async function selectEvent(
        selectedEvent
    ) {

        const selectedEventId =
            typeof selectedEvent === "object"
                ? selectedEvent?.id
                : selectedEvent;

        if (!selectedEventId) {
            return null;
        }


        //
        // Determine current permissions.
        //
        // System admins have access to every event.
        //

        const isSystemAdmin = ApiService.userData.isSystemAdmin();


        //
        // Normal users must have access to the event.
        //

        if (
            !isSystemAdmin &&
            !ApiService.userData.hasEventAccess(
                selectedEventId
            )
        ) {

            const accessError =
                new Error(
                    "You do not have access to the selected event."
                );

            setError(
                accessError.message
            );

            throw accessError;

        }


        try {

            setLoading(true);
            setError(null);

            const selectedEventData =
                await ApiService.eventData.getEvent(
                    selectedEventId
                );

            if (!selectedEventData) {

                throw new Error(
                    "The selected event could not be found."
                );

            }

            setEvent(
                selectedEventData
            );

            setEventId(
                selectedEventData.id
            );

            changeBranding(
                selectedEventData.theme || "night-ops"
            );

            setShowEventSelector(false);

            return selectedEventData;

        }
        catch (error) {

            console.error(
                "Failed to select event:",
                error
            );

            setError(
                error?.message ??
                "Unable to load the selected event."
            );

            throw error;

        }
        finally {

            setLoading(false);

        }

    }


    //
    // Open event selector.
    //

    async function openEventSelector() {

        try {

            setError(null);

            /*
             * Refresh the user first.
             *
             * This is important for administrators because
             * the cached user may contain stale permissions.
             */
            const user =
                await ApiService.userData.get();

            if (!user) {

                throw new Error(
                    "Unable to determine the current user."
                );

            }

            const isSystemAdmin =
                user.isAdmin === true;

            const eventIds =
                Object.keys(
                    user.roles ?? {}
                );


            //
            // SYSTEM ADMIN
            //
            // System admins can ALWAYS open the selector.
            // They are not restricted by event assignments.
            //

            if (isSystemAdmin) {

                const events =
                    await loadSelectableEvents();

                if (events.length === 0) {

                    setShowEventSelector(false);

                    setError(
                        "No events are currently available."
                    );

                    return;

                }

                setShowEventSelector(true);

                return;

            }


            //
            // NORMAL USER
            //
            // A user with zero or one event cannot change events.
            //

            if (eventIds.length <= 1) {

                return;

            }


            //
            // Load only the user's assigned events.
            //

            const events =
                await loadSelectableEvents(
                    eventIds
                );

            if (events.length === 0) {

                setShowEventSelector(false);

                setError(
                    "No available events were found."
                );
                return;

            }

            setShowEventSelector(true);

        }
        catch (error) {

            console.error(
                "Failed to open event selector:",
                error
            );

            setShowEventSelector(false);

            setError(
                error?.message ??
                "Unable to load available events."
            );

        }

    }


    //
    // Change event.
    //

    async function changeEvent() {
        return openEventSelector();
    }

    async function clearEvent() {
        setEvent(null);
        setEventId(null);
        setShowEventSelector(false);
        setError(null);
    }


    //
    // Close selector.
    //

    function closeEventSelector() {

        setShowEventSelector(false);

    }


    //
    // Current user permissions.
    //
    // These are derived from the cached user so that
    // consumers can immediately determine what controls
    // should be visible.
    //

    const user =
        ApiService.userData.getCached();

    const isSystemAdmin =
        user?.isAdmin === true;

    const eventCount =
        Object.keys(
            user?.roles ?? {}
        ).length;

    /*
     * System admins can change events regardless of
     * event assignments.
     *
     * Normal users need at least two events.
     */
    const canChangeEvent =
        isSystemAdmin ||
        eventCount > 1;


    //
    // Context value.
    //

    const value = {

        //
        // Current event
        //

        event,
        eventId,

        //
        // State
        //

        loading,
        error,

        isSelected:
            eventId !== null,

        //
        // Operations
        //

        getCurrentEvent,
        selectEvent,
        changeEvent,
        clearEvent,

        //
        // Selector
        //

        openEventSelector,
        closeEventSelector,

        //
        // Permissions
        //

        canChangeEvent,
        isSystemAdmin

    };

    return (
        <EventContext.Provider value={value}>

            {children}

            {showEventSelector && (
                <EventSelector
                    events={selectableEvents}
                    selectedEventId={eventId}
                    onSelect={selectEvent}
                    onClose={closeEventSelector}
                />
            )}

        </EventContext.Provider>
    );

}

export function useEventContext() {

    const context =
        useContext(EventContext);

    if (!context) {

        throw new Error(
            "useEventContext must be used inside an EventProvider."
        );

    }

    return context;

}