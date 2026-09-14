"use client";
// Staff self-registration page — creates an INACTIVE account;
// the administrator approves it before the staff member can sign in.
import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string[]>([]);
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr([]);
    setDone("");
    if (password !== confirm) {
      setErr(["Passwords do not match"]);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, fullName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.errors || [data.error || "Registration failed"]);
        return;
      }
      setDone(data.message || "Registration received — awaiting administrator approval.");
      setUsername(""); setFullName(""); setPassword(""); setConfirm("");
    } catch {
      setErr(["Network error — try again"]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Srodae Zonal Council logo" className="logo-lg" />
        <h1>Staff Registration</h1>
        <p>Srodae Zonal Council — Temporal Structures Fee Register</p>

        {err.length > 0 && <div className="err">{err.map((x, i) => <div key={i}>{x}</div>)}</div>}
        {done && (
          <div className="ok-msg">
            {done}
            <div style={{ marginTop: 6 }}>
              <Link href="/login" style={{ color: "var(--green)", fontWeight: 600 }}>
                Return to sign in
              </Link>
            </div>
          </div>
        )}

        <label className="fld">
          <span className="cap">Full Name <span className="req">*</span></span>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>

        <label className="fld">
          <span className="cap">Username <span className="req">*</span></span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. k.owusu"
            autoComplete="username"
            required
          />
        </label>

        <label className="fld">
          <span className="cap">Password <span className="req">*</span> <span style={{ fontWeight: 400, color: "var(--muted)" }}>(min 8 characters)</span></span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPw((s) => !s)}>
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label className="fld">
          <span className="cap">Confirm Password <span className="req">*</span></span>
          <input
            type={showPw ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
          {busy ? "Submitting..." : "Register for Approval"}
        </button>

        <div style={{ marginTop: 14, fontSize: 13, color: "var(--muted)" }}>
          Already registered?{" "}
          <Link href="/login" style={{ color: "var(--blue)", fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}