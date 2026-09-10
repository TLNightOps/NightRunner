import ApiService from "@/api/ApiService.js";

export async function getLiveScoring(eventId) {
    if (!eventId) {
        throw new Error(
            "An event ID is required."
        );
    }

    const [
        stations,
        patrols,
        scoresReport,
        visitsResponse
    ] = await Promise.all([
        ApiService.stationData.getStations(eventId),
        ApiService.patrolData.getPatrols(eventId),
        ApiService.reportData.getEventReport(eventId).catch(() => ({ patrols: [] })),
        ApiService.checkInData.getVisits(eventId).catch(() => ({ visits: [] }))
    ]);

    return {
        stations: stations ?? [],
        patrols: patrols ?? [],
        scoresReport: scoresReport ?? { patrols: [] },
        visits: visitsResponse?.visits ?? []
    };
}