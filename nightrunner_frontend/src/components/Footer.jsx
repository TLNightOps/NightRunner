import "./Footer.css";

export default function Footer() {

    return (

        <footer className="app-footer">

            <div className="app-footer-content">

                <span>
                    Created by GA-0594
                </span>

                <span className="app-footer-separator">
                    •
                </span>

                <a
                    href="https://github.com/TLNightOps"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    TLNightOps on GitHub
                </a>

                <span className="app-footer-separator">
                    •
                </span>

                <span>
                    Night Runner {import.meta.env.VITE_APP_VERSION || "0.1.0-dev"}
                </span>

                <span className="app-footer-separator">
                    •
                </span>

                <a
                    href="https://nightopsadventures.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Night Ops Adventures
                </a>

            </div>

        </footer>

    );

}
