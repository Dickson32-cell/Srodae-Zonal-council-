"use client";
// Login page — the only public page; everything else requires a session.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Login failed");
        return;
      }
      router.replace("/");
    } catch {
      setErr("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Srodae Zonal Council logo" className="logo-lg" />
        <h1>Srodae Zonal Council</h1>
        <p>Temporal Structures Fee Register — staff sign in</p>

        {err && <div className="err">{err}</div>}

        <label className="fld">
          <span className="cap">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="fld">
          <span className="cap">Password</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowPw((s) => !s)}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <div style={{ marginTop: 14, fontSize: 13, color: "var(--muted)" }}>
          New staff member?{" "}
          <a
            href="/register"
            style={{ color: "var(--blue)", fontWeight: 600 }}
          >
            Register for approval
          </a>
        </div>

        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}