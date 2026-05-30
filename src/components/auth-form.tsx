"use client";

import { FormEvent, useState } from "react";


type Mode = "login" | "register";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || "")
    };

    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setLoading(false);
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Could not sign in.");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="auth-card">
      <div className="tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
          Login
        </button>
        <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">
          Register
        </button>
      </div>

      <form onSubmit={submit}>
        {mode === "register" ? (
          <label>
            Name
            <input name="name" autoComplete="name" />
          </label>
        ) : null}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required minLength={6} />
        </label>
        {error ? <p className="notice error">{error}</p> : null}
        <button disabled={loading}>{loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}</button>
      </form>
    </div>
  );
}
