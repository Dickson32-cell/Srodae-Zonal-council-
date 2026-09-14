"use client";
// EditsAdmin — before/after review of staff edit requests, approve/reject.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Edit = {
  id: string;
  feePayerId: string;
  serial: string;
  payerName: string;
  businessName: string;
  before: Record<string, string>;
  after: Record<string, string>;
  status: string;
  createdAt: string;
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  businessName: "Business Name",
  telephone: "Telephone",
  streetName: "Street Name",
  electoralArea: "Electoral Area",
};

export default function EditsAdmin() {
  const [edits, setEdits] = useState<Edit[]>([]);
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/edits");
    if (res.ok) {
      const data = await res.json();
      setEdits(data.edits);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(editId: string, decision: "approve" | "reject", label: string) {
    if (decision === "reject" && !confirm("Reject this edit? The record stays unchanged.")) return;
    setBusyId(editId); setMsg(""); setErr("");
    const res = await fetch("/api/admin/edits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editId, decision }),
    });
    const data = await res.json();
    setBusyId("");
    if (!res.ok) { setErr(data.error || "Operation failed"); return; }
    setMsg(label);
    load();
  }

  const pending = edits.filter((e) => e.status === "PENDING");
  const reviewed = edits.filter((e) => e.status !== "PENDING");

  return (
    <>
      <div className="card">
        <h2>Edit Approvals</h2>
        <p className="sub">
          Staff edits are held here until you approve them. Nothing changes on the record until you do.
        </p>

        {msg && <div className="ok-msg">{msg}</div>}
        {err && <div className="err">{err}</div>}

        {pending.length > 0 && (
          <div className="ok-msg" style={{ background: "var(--amber-soft)", borderColor: "#fde68a", color: "var(--amber)" }}>
            <b>{pending.length} edit{pending.length === 1 ? "" : "s"} awaiting approval</b>
          </div>
        )}

        {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}

        {!loading && pending.length === 0 && (
          <p style={{ color: "var(--muted)" }}>No pending edits — staff changes are up to date.</p>
        )}

        {pending.map((e) => (
          <div key={e.id} className="card" style={{ background: "#fbfdff", borderColor: "var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <b className="serial">{e.serial}</b> — {e.payerName} ({e.businessName})
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                requested {new Date(e.createdAt).toLocaleString("en-GB")}
              </div>
            </div>

            <table className="tbl" style={{ marginTop: 12, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: "30%" }}>Field</th>
                  <th>Before</th>
                  <th>After (requested)</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(e.after).map((f) => (
                  <tr key={f}>
                    <td><b>{FIELD_LABELS[f] || f}</b></td>
                    <td style={{ color: "var(--muted)" }}>{e.before[f] || "—"}</td>
                    <td><b style={{ color: "var(--blue)" }}>{e.after[f]}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className="btn btn-green" disabled={busyId === e.id}
                onClick={() => decide(e.id, "approve", `Approved — record ${e.serial} updated`)}>
                Approve
              </button>
              <button className="btn btn-danger" disabled={busyId === e.id}
                onClick={() => decide(e.id, "reject", `Rejected — record ${e.serial} unchanged`)}>
                Reject
              </button>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <Link href="/" className="btn btn-ghost">Back to Register</Link>
        </div>
      </div>

      {reviewed.length > 0 && (
        <div className="card">
          <h2>Review History</h2>
          <p className="sub">Previously reviewed edits (audit record).</p>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>Changes</th>
                  <th>Status</th>
                  <th>Requested</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((e) => (
                  <tr key={e.id}>
                    <td className="serial">{e.serial}</td>
                    <td>
                      {Object.keys(e.after).map((f) => (
                        <div key={f} style={{ fontSize: 12 }}>
                          {FIELD_LABELS[f] || f}: <s style={{ color: "var(--muted)" }}>{e.before[f]}</s> → <b>{e.after[f]}</b>
                        </div>
                      ))}
                    </td>
                    <td>
                      <span className={`badge ${e.status === "APPROVED" ? "paid" : "unpaid"}`}>{e.status}</span>
                    </td>
                    <td>{new Date(e.createdAt).toLocaleString("en-GB")}</td>
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