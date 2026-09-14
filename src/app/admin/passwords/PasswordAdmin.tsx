"use client";
// PasswordAdmin — approve/reject password change requests.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type P = {
  id: string; username: string; fullName: string;
  accountActive: boolean; status: string; requestedAt: string;
};

export default function PasswordAdmin() {
  const [requests, setRequests] = useState<P[]>([]);
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/passwords");
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(requestId: string, decision: "approve" | "reject") {
    if (decision === "approve" && !confirm("Approve this password change? It takes effect immediately.")) return;
    if (decision === "reject" && !confirm("Reject this password change? The user keeps their current password.")) return;
    setBusyId(requestId); setMsg(""); setErr("");
    const res = await fetch("/api/admin/passwords", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, decision }),
    });
    const data = await res.json();
    setBusyId("");
    if (!res.ok) { setErr(data.error || "Operation failed"); return; }
    setMsg(data.message);
    load();
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const reviewed = requests.filter((r) => r.status !== "PENDING");

  return (
    <>
      <div className="card">
        <h2>Password Change Approvals</h2>
        <p className="sub">
          Users cannot change their own password until you approve the request here.
        </p>

        {msg && <div className="ok-msg">{msg}</div>}
        {err && <div className="err">{err}</div>}

        {pending.length > 0 && (
          <div className="ok-msg" style={{ background: "var(--amber-soft)", borderColor: "#fde68a", color: "var(--amber)" }}>
            <b>{pending.length} password change{pending.length === 1 ? "" : "s"} awaiting approval</b>
          </div>
        )}

        {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}
        {!loading && pending.length === 0 && (
          <p style={{ color: "var(--muted)" }}>No pending password requests.</p>
        )}

        <div className="only-desktop">
          <table className="tbl">
            <thead>
              <tr><th>Username</th><th>Full Name</th><th>Account</th><th>Requested</th><th className="no-print">Actions</th></tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id} style={{ background: "#fffbeb" }}>
                  <td className="serial">{r.username}</td>
                  <td>{r.fullName}</td>
                  <td>{r.accountActive ? "Active" : "Disabled"}</td>
                  <td>{new Date(r.requestedAt).toLocaleString("en-GB")}</td>
                  <td className="no-print" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-green btn-sm" disabled={busyId === r.id} onClick={() => decide(r.id, "approve")}>Approve</button>{" "}
                    <button className="btn btn-danger btn-sm" disabled={busyId === r.id} onClick={() => decide(r.id, "reject")}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="only-mobile">
          {pending.map((r) => (
            <div key={r.id} className="user-card" style={{ background: "#fffbeb" }}>
              <div className="user-card-head">
                <div>
                  <div className="serial" style={{ fontSize: 14 }}>{r.username}</div>
                  <div style={{ fontWeight: 600 }}>{r.fullName}</div>
                </div>
              </div>
              <div className="user-card-meta">Requested {new Date(r.requestedAt).toLocaleString("en-GB")}</div>
              <div className="row-actions">
                <button className="btn btn-green btn-sm" disabled={busyId === r.id} onClick={() => decide(r.id, "approve")}>Approve</button>
                <button className="btn btn-danger btn-sm" disabled={busyId === r.id} onClick={() => decide(r.id, "reject")}>Reject</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <Link href="/" className="btn btn-ghost">Back to Register</Link>
        </div>
      </div>

      {reviewed.length > 0 && (
        <div className="card">
          <h2>Review History</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Username</th><th>Status</th><th>Requested</th></tr></thead>
              <tbody>
                {reviewed.map((r) => (
                  <tr key={r.id}>
                    <td className="serial">{r.username}</td>
                    <td><span className={`badge ${r.status === "APPROVED" ? "paid" : "unpaid"}`}>{r.status}</span></td>
                    <td>{new Date(r.requestedAt).toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}