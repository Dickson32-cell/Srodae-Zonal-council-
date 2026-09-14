"use client";
// TopBar — logo + brand + user + Change Password + admin links + logout
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TopBar({ username, role, canReviewPasswords, showMaster }: { username: string; role: string; canReviewPasswords?: boolean; showMaster?: boolean }) {
  const router = useRouter();
  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function submitPwChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(""); setPwErr(""); setPwBusy(true);
    const res = await fetch("/api/auth/password-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
    });
    const data = await res.json();
    setPwBusy(false);
    if (!res.ok) { setPwErr((data.errors && data.errors[0]) || data.error || "Failed"); return; }
    setPwMsg(data.message);
    setCurPw(""); setNewPw("");
  }

  return (
    <header className="topbar" style={{ position: "relative", paddingBottom: pwOpen ? 290 : undefined }}>
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Adweso Zonal Council logo" className="brand-logo" />
        <div>
          <div className="t1">Adweso Zonal Council</div>
          <div className="t2">Temporal Structures Fee Register</div>
        </div>
      </div>
      <div className="who">
        <b>{username}</b> · {role === "ADMIN" ? "Administrator" : "Staff"} &nbsp;{" "}
        {role === "ADMIN" && (
          <>
            {username === "admin" && showMaster && (
              <a href="/master" className="btn btn-ghost btn-sm" style={{ color: "#fff", borderColor: "#2c6e4b" }}>
                Master
              </a>
            )}{" "}
            <a href="/admin/users" className="btn btn-ghost btn-sm" style={{ color: "#fff", borderColor: "#2c6e4b" }}>
              Staff
            </a>{" "}
            <a href="/admin/edits" className="btn btn-ghost btn-sm" style={{ color: "#fff", borderColor: "#2c6e4b" }}>
              Edits
            </a>{" "}
            {canReviewPasswords && (
              <a href="/admin/passwords" className="btn btn-ghost btn-sm" style={{ color: "#fff", borderColor: "#2c6e4b" }}>
                Passwords
              </a>
            )}
          </>
        )}{" "}
        <button className="btn btn-ghost btn-sm" style={{ color: "#fff", borderColor: "#2c6e4b" }} onClick={() => { setPwOpen((s) => !s); setPwMsg(""); setPwErr(""); }}>
          Change Password
        </button>{" "}
        <button className="btn btn-ghost btn-sm" style={{ color: "#fff", borderColor: "#2c6e4b" }} onClick={logout}>
          Log out
        </button>
      </div>

      {/* Change Password panel — flows BELOW the topbar (no overlay, no overlap on any device) */}
      {pwOpen && (
        <form className="card pw-panel" onSubmit={submitPwChange}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 14, margin: 0 }}>Change Password</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPwOpen(false)}>Close</button>
          </div>
          <p className="sub" style={{ fontSize: 12, marginTop: 4 }}>Your new password takes effect after an administrator approves it.</p>
          {pwErr && <div className="err" style={{ fontSize: 12 }}>{pwErr}</div>}
          {pwMsg && <div className="ok-msg" style={{ fontSize: 12 }}>{pwMsg}</div>}
          <label className="fld"><span className="cap">Current Password</span>
            <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} required /></label>
          <label className="fld"><span className="cap">New Password (min 8 chars)</span>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} /></label>
          <button className="btn btn-primary btn-sm" disabled={pwBusy} style={{ width: "100%", justifyContent: "center" }}>
            {pwBusy ? "Submitting..." : "Request Change"}
          </button>
        </form>
      )}
    </header>
  );
}