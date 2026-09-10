import {
    useEffect,
    useRef,
    useState
} from "react";

import {
    Html5Qrcode
} from "html5-qrcode";

import "./QRScanner.css";

export default function QRScanner({
                                      onScan,
                                      onCancel
                                  }) {

    const scannerRef =
        useRef(null);

    const [error, setError] =
        useState(null);

    const [scanning, setScanning] =
        useState(false);

    useEffect(() => {

        const scanner =
            new Html5Qrcode(
                "qr-reader"
            );

        scannerRef.current =
            scanner;

        let mounted = true;
        let started = false;
        let scanned = false;

        async function startScanner() {

            try {

                setError(null);

                /*
                 * Request access to the available cameras.
                 */
                const cameras =
                    await Html5Qrcode.getCameras();

                if (!mounted) {
                    return;
                }

                if (
                    !cameras ||
                    cameras.length === 0
                ) {

                    throw new Error(
                        "NO_CAMERA"
                    );

                }

                /*
                 * Prefer the rear/environment camera.
                 */
                const camera =
                    cameras.find(
                        currentCamera =>
                            /back|rear|environment/i.test(
                                currentCamera.label
                            )
                    ) ?? cameras[0];

                await scanner.start(
                    camera.id,
                    {
                        fps: 10,

                        qrbox: {
                            width: 250,
                            height: 250
                        },

                        aspectRatio: 1
                    },
                    decodedText => {

                        if (
                            !mounted ||
                            scanned
                        ) {
                            return;
                        }

                        /*
                         * The QR code contains a JSON object:
                         *
                         * {
                         *     "id": "patrol-uuid"
                         * }
                         */
                        let payload;

                        try {

                            payload =
                                JSON.parse(
                                    decodedText.trim()
                                );

                        } catch {

                            setError(
                                "This is not a valid patrol QR code."
                            );

                            return;

                        }

                        /*
                         * Validate the decoded payload.
                         */
                        if (
                            !payload ||
                            typeof payload !== "object" ||
                            typeof payload.id !== "string" ||
                            !payload.id.trim()
                        ) {

                            setError(
                                "This is not a valid patrol QR code."
                            );

                            return;

                        }

                        /*
                         * Prevent the same QR code from
                         * triggering multiple callbacks.
                         */
                        scanned = true;

                        const patrolId =
                            payload.id.trim();

                        /*
                         * Pass the patrol UUID to the caller.
                         */
                        onScan?.({
                            id: patrolId
                        });

                    },
                    () => {

                        /*
                         * Normal decode failures are ignored.
                         *
                         * The scanner calls this continuously
                         * while it searches for a QR code.
                         */

                    }
                );

                started = true;

                if (mounted) {
                    setScanning(true);
                }

            } catch (error) {

                console.error(
                    "Failed to start QR scanner:",
                    error
                );

                if (!mounted) {
                    return;
                }

                setScanning(false);

                if (
                    error?.message ===
                    "NO_CAMERA"
                ) {

                    setError(
                        "No camera was found on this device."
                    );

                } else if (
                    error?.name ===
                    "NotAllowedError"
                ) {

                    setError(
                        "Camera permission was denied. Please allow camera access and try again."
                    );

                } else if (
                    error?.name ===
                    "NotFoundError"
                ) {

                    setError(
                        "No camera was found on this device."
                    );

                } else if (
                    error?.name ===
                    "NotReadableError"
                ) {

                    setError(
                        "The camera is already being used by another application."
                    );

                } else if (
                    error?.name ===
                    "SecurityError"
                ) {

                    setError(
                        "Camera access is not available from this page."
                    );

                } else {

                    setError(
                        "Unable to start the QR scanner."
                    );

                }

            }

        }

        startScanner();

        return () => {

            mounted = false;

            if (!started) {
                return;
            }

            scanner
                .stop()
                .catch(error => {

                    /*
                     * The scanner may already have stopped.
                     */
                    console.debug(
                        "QR scanner cleanup:",
                        error
                    );

                });

        };

    }, [onScan]);

    function handleCancel() {

        onCancel?.();

    }

    return (

        <div
            className="qr-scanner-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-scanner-title"
        >

            <div className="qr-scanner-modal">

                <div className="qr-scanner-header">

                    <div>

                        <h2 id="qr-scanner-title">
                            Scan Patrol QR Code
                        </h2>

                        <p>
                            Scan the QR code assigned
                            to the patrol.
                        </p>

                    </div>

                </div>

                <div className="qr-scanner-view">

                    <div
                        id="qr-reader"
                        className="qr-reader"
                    />

                </div>

                {scanning && !error && (

                    <p className="qr-scanner-status">
                        Point your camera at the patrol
                        QR code.
                    </p>

                )}

                {error && (
                    <div>
                        <div className="qr-scanner-error">
                            {error}
                        </div>

                        <p>
                            Make sure the website has access to the camera.
                        </p>
                    </div>

                )}
                <div className="qr-scanner-actions">
                    <button
                        type="button"
                        className="qr-scanner-cancel"
                        onClick={handleCancel}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}