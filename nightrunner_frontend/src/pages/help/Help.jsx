import "./Help.css";

import {
    GRID_ROLES,
    HELP_UPDATED,
    ROLES,
    ROLE_GRID
} from "./helpContent.js";


function accessFor(row, roleKey) {

    if (row.roles.includes(roleKey)) {
        return "yes";
    }

    if (row.partial?.includes(roleKey)) {
        return "partial";
    }

    return "no";

}


const CELL_LABELS = {
    yes: "Yes",
    partial: "Direct link only",
    no: "No"
};


function AccessCell({ access }) {

    return (
        <td className={`help-cell help-cell-${access}`}>
            <span className="help-cell-mark" aria-hidden="true">
                {access === "yes" ? "✓" : access === "partial" ? "◐" : "–"}
            </span>
            <span className="help-sr-only">
                {CELL_LABELS[access]}
            </span>
        </td>
    );

}


export default function Help() {

    const notes =
        ROLE_GRID
            .flatMap(group => group.rows)
            .filter(row => row.note);

    return (
        <div className="help-container">

            <header className="help-header">
                <h1>Help &amp; Docs</h1>
                <p>
                    How Night Runner works, and who can do what.
                    Last updated {HELP_UPDATED}.
                </p>
            </header>


            <section className="help-section" aria-labelledby="help-roles">

                <h2 id="help-roles">Roles and permissions</h2>

                <p className="help-intro">
                    Every role except System Admin is given per event. If you
                    have a role for one event, you only have it while that
                    event is selected. Ask an Event Admin or System Admin to
                    change your role.
                </p>

                <div className="help-role-list">
                    {ROLES.map(role => (
                        <article key={role.key} className="help-role-card">
                            <h3>{role.name}</h3>
                            <p className="help-role-summary">{role.summary}</p>
                            <ul>
                                {role.details.map(detail => (
                                    <li key={detail}>{detail}</li>
                                ))}
                            </ul>
                        </article>
                    ))}
                </div>

            </section>


            <section className="help-section" aria-labelledby="help-grid">

                <h2 id="help-grid">Quick reference</h2>

                <p className="help-intro">
                    Which screens each role sees in the menu.
                </p>

                <div className="help-legend" aria-hidden="true">
                    <span><span className="help-cell-yes">✓</span> Yes</span>
                    <span><span className="help-cell-partial">◐</span> Direct link only</span>
                    <span><span className="help-cell-no">–</span> No</span>
                </div>

                <div className="help-table-wrap">
                    <table className="help-table">
                        <thead>
                            <tr>
                                <th scope="col">Screen</th>
                                {GRID_ROLES.map(role => (
                                    <th key={role.key} scope="col">
                                        {role.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        {ROLE_GRID.map(group => (
                            <tbody key={group.section}>
                                <tr className="help-table-group">
                                    <th
                                        scope="colgroup"
                                        colSpan={GRID_ROLES.length + 1}
                                    >
                                        {group.section}
                                    </th>
                                </tr>

                                {group.rows.map(row => (
                                    <tr key={row.screen}>
                                        <th scope="row">{row.screen}</th>
                                        {GRID_ROLES.map(role => (
                                            <AccessCell
                                                key={role.key}
                                                access={accessFor(row, role.key)}
                                            />
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        ))}
                    </table>
                </div>

                {notes.length > 0 && (
                    <ul className="help-notes">
                        {notes.map(row => (
                            <li key={row.screen}>
                                <strong>{row.screen}:</strong> {row.note}
                            </li>
                        ))}
                    </ul>
                )}

            </section>

        </div>
    );

}
