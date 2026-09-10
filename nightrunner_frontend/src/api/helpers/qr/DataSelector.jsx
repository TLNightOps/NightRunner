import {
    useState
} from "react";

import QRScanner from "./QRScanner.jsx";

import "./DataSelector.css";

export default function DataSelector({
                                         title,
                                         description,
                                         label,
                                         items,
                                         selected,
                                         onSelect,
                                         displayField = "name",
                                         allowScan = false
                                     }) {

    const [showScanner, setShowScanner] =
        useState(false);

    const [scanError, setScanError] =
        useState(null);

    function handleManualSelection(event) {

        const selectedItem =
            items.find(
                item =>
                    String(item.id) ===
                    String(event.target.value)
            );

        onSelect(
            selectedItem ?? null
        );

    }

    function handleScan(scannedData) {

        setScanError(null);

        const scannedId =
            scannedData?.id?.trim();

        if (!scannedId) {

            setScanError(
                "The scanned QR code does not contain a patrol ID."
            );

            return;
        }

        const selectedItem =
            items.find(
                item =>
                    String(item.id) ===
                    String(scannedId)
            );

        if (!selectedItem) {

            setScanError(
                "The scanned patrol could not be found in this event."
            );

            return;
        }

        /*
         * Return the complete item to the parent.
         *
         * The parent therefore receives:
         *
         * {
         *     id,
         *     name,
         *     members,
         *     ...
         * }
         */
        onSelect(
            selectedItem
        );

        setShowScanner(false);

    }

    function openScanner() {

        setScanError(null);
        setShowScanner(true);

    }

    function closeScanner() {

        setScanError(null);
        setShowScanner(false);

    }

    return (
        <>
            <div className="score-selection-card">

                <div className="data-selector-header">

                    <h2>
                        {title}
                    </h2>

                    {description && (
                        <p>
                            {description}
                        </p>
                    )}

                </div>

                {allowScan ? (

                    <div className="data-selector-options">

                        <button
                            type="button"
                            className="scan-card"
                            onClick={
                                openScanner
                            }
                        >
                            <span className="scan-icon">
                                📷
                            </span>

                            <span>
                                Scan QR Code
                            </span>
                        </button>

                        <div className="selection-divider">
                            OR
                        </div>

                        <div className="manual-selection">

                            <label>
                                {label}
                            </label>

                            <select
                                value={
                                    selected?.id ?? ""
                                }
                                onChange={
                                    handleManualSelection
                                }
                            >
                                <option value="">
                                    Select {label}...
                                </option>

                                {items.map(item => (

                                    <option
                                        key={item.id}
                                        value={item.id}
                                    >
                                        {item[displayField]}
                                    </option>

                                ))}

                            </select>

                        </div>

                    </div>

                ) : (

                    <div className="manual-selection">

                        <label>
                            {label}
                        </label>

                        <select
                            value={
                                selected?.id ?? ""
                            }
                            onChange={
                                handleManualSelection
                            }
                        >
                            <option value="">
                                Select {label}...
                            </option>

                            {items.map(item => (

                                <option
                                    key={item.id}
                                    value={item.id}
                                >
                                    {item[displayField]}
                                </option>

                            ))}

                        </select>

                    </div>

                )}

                {scanError && (

                    <div className="qr-scanner-error">
                        {scanError}
                    </div>

                )}

                {selected && (

                    <div className="selected-data">

                        <span>
                            ✓
                        </span>

                        <div>

                            <small>
                                Selected {label}
                            </small>

                            <div>
                                {selected[displayField]}
                            </div>

                        </div>

                    </div>

                )}

            </div>

            {showScanner && (

                <QRScanner
                    onScan={handleScan}
                    onCancel={closeScanner}
                />

            )}

        </>
    );
}