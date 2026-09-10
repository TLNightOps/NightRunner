import BackendTransport from "./BackendTransport.js";

export default class CheckInService {
    async getVisits(eventId) {
        if (!eventId) {
            throw new Error("An event ID is required.");
        }
        return await BackendTransport.get(
            `/visits?eventId=${encodeURIComponent(eventId)}`
        );
    }

    async checkIn({ eventId, patrolId, stationId, timestamp }) {
        if (!eventId || !patrolId || !stationId) {
            throw new Error("eventId, patrolId, and stationId are required.");
        }
        return await BackendTransport.post("/visits/check-in", {
            eventId,
            patrolId,
            stationId,
            timestamp: timestamp || new Date().toISOString()
        });
    }

    async checkOut({ eventId, patrolId, stationId, timestamp }) {
        if (!eventId || !patrolId || !stationId) {
            throw new Error("eventId, patrolId, and stationId are required.");
        }
        return await BackendTransport.post("/visits/check-out", {
            eventId,
            patrolId,
            stationId,
            timestamp: timestamp || new Date().toISOString()
        });
    }
}
