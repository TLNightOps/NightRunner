import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    isFirebaseMode,
    firebaseRegisterWithEmail,
    firebaseUpdateProfile
} from "@/api/auth/firebaseAuth.js";
import ApiService from "../../api/ApiService.js";
import "./Register.css";

function Register() {

    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);

    const [error, setError] = useState("");

    const [form, setForm] = useState({

        displayName: "",

        username: "",

        email: "",

        password: "",

        confirmPassword: ""

    });

    function updateField(event) {

        setForm({

            ...form,

            [event.target.name]: event.target.value

        });

    }

    async function handleSubmit(event) {

        event.preventDefault();

        setError("");

        if (form.password !== form.confirmPassword) {

            setError("Passwords do not match.");

            return;

        }

        setLoading(true);

        try {

            if (isFirebaseMode) {
                const userCredential = await firebaseRegisterWithEmail(form.email, form.password);
                if (form.displayName && userCredential?.user) {
                    await firebaseUpdateProfile(userCredential.user, {
                        displayName: form.displayName
                    });
                }
            } else {
                await ApiService.register({

                    displayName: form.displayName,

                    username: form.username,

                    email: form.email,

                    password: form.password

                });
            }

            navigate("/");

        }
        catch (err) {

            setError(err.message || "Failed to create account.");

        }
        finally {

            setLoading(false);

        }

    }

    return (

        <div className="login-page">

            <img
                className="login-logo"
                src="/favicon.jpg"
                alt="Night Ops Adventures"
            />

            <div className="login-card">

                <h1>Create Account</h1>

                <p className="login-subtitle">
                    Register for Night Runner.
                </p>

                <form
                    className="login-form"
                    onSubmit={handleSubmit}
                >

                    <input
                        name="displayName"
                        placeholder="Display Name"
                        autoComplete="display-name"
                        value={form.displayName}
                        onChange={updateField}
                        required
                    />

                    <input
                        name="username"
                        placeholder="Username"
                        autoComplete="username"
                        value={form.username}
                        onChange={updateField}
                        required
                    />

                    <input
                        type="email"
                        name="email"
                        placeholder="Email Address"
                        autoComplete="email"
                        value={form.email}
                        onChange={updateField}
                        required
                    />

                    <input
                        type="password"
                        name="password"
                        placeholder="Password"
                        autoComplete="new-password"
                        value={form.password}
                        onChange={updateField}
                        required
                    />

                    <input
                        type="password"
                        name="confirmPassword"
                        placeholder="Confirm Password"
                        autoComplete="new-password"
                        value={form.confirmPassword}
                        onChange={updateField}
                        required
                    />

                    {
                        error &&
                        <div className="login-error">
                            {error}
                        </div>
                    }

                    <button
                        type="submit"
                        disabled={loading}
                    >
                        {
                            loading
                                ? "Creating Account..."
                                : "Create Account"
                        }
                    </button>

                </form>

                <div className="login-divider"></div>

                <div className="register-section">

                    <span>
                        Already have an account?
                    </span>

                    <Link
                        to="/"
                        className="register-link"
                    >
                        Sign In
                    </Link>

                </div>

            </div>

        </div>

    );

}

export default Register;