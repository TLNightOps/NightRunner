import BackendTransport from "./BackendTransport.js";

import AuthService from "./auth/AuthService.js";
import UserService from "./UserService.js";
import EventService from "./EventService.js";
import PatrolService from "./PatrolService.js";
import ReportService from "./ReportService.js";
import StationService from "./StationService.js";
import ConfigurationService from "@/api/ConfigurationService.js";


class ApiService {

    //
    // Services
    //

    /**
     * Authentication operations.
     *
     * @type {AuthService}
     */
    auth;

    /**
     * User operations.
     *
     * @type {UserService}
     */
    userData;

    /**
     * Event operations.
     *
     * @type {EventService}
     */
    eventData;

    /**
     * Patrol operations.
     *
     * @type {PatrolService}
     */
    patrolData;

    /**
     * Station operations.
     *
     * @type {StationService}
     */
    stationData;

    /**
     * Configuration operations.
     *
     * @type {ConfigurationService}
     */
    configurationData;

    /**
     * Report operations
     *
     * @type {ReportService}
     */
    reportData;

    /**
     * Direct backend transport.
     *
     * @type {BackendTransport}
     */
    backendTransport;


    constructor() {

        this.backendTransport =
            BackendTransport;

        this.auth =
            AuthService;

        this.userData =
            new UserService();

        this.eventData =
            new EventService(
                this.backendTransport,
            );

        this.patrolData =
            new PatrolService(
                this.backendTransport,
                this.userData
            );

        this.stationData =
            new StationService(
                this.backendTransport,
                this.userData
            );

        this.configurationData =
            new ConfigurationService();

        this.reportData =
            new ReportService();

    }


    //
    // Authentication
    //

    /**
     * Registers a new user.
     *
     * @param {Object} user
     * @returns {Promise<User>}
     */
    async register(user) {

        return this.userData.createUser(user);

    }

}


export default new ApiService();