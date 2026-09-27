"use client";
// RegisterTable — the register: filters, Dickson's exact column order,
// per-area summary, GRAND TOTAL row, New Record form, payment modal.
import { useCallback, useEffect, useState } from "react";

const AREAS = [
  "Social Welfare",
  "Central Market",
  "Debrakrom",
  "Akwaasu Asebi",
  "Kantudu",
];

const GHS = (n: number) =>
  "GH₵ " + (Number.isFinite(n) ? n : 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Row = {
  id: string; serialNumber: string; name: string; businessName: string;
  telephone: string; electoralArea: string; streetName: string;
  latitude: number | null; longitude: number | null; hasGps: boolean;
  mapsUrl: string | null;
  fee: number; total: number; paid: number; balance: number; status: string;
};
type Grand = { records: number; billed: number; collected: number; outstanding: number };
type AreaSum = { count: number; billed: number; collected: number; outstanding: number };

export default function RegisterTable({
  isAdmin = false,
  canDelete = true,
  canEditDirect = true,
  canCreate = true,
  canPay = true,
}: {
  isAdmin?: boolean;
  canDelete?: boolean;
  canEditDirect?: boolean;
  canCreate?: boolean;
  canPay?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [byArea, setByArea] = useState<Record<string, AreaSum>>({});
  const [grand, setGrand] = useState<Grand>({ records: 0, billed: 0, collected: 0, outstanding: 0 });
  const [area, setArea] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  // New-record form state
  const [showForm, setShowForm] = useState(false);
  const [serialPreview, setSerialPreview] = useState("");
  const [form, setForm] = useState({ name: "", businessName: "", telephone: "", electoralArea: "", streetName: "", fee: "" });
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsErr, setGpsErr] = useState("");
  const [formErr, setFormErr] = useState<string[]>([]);
  const [formOk, setFormOk] = useState("");
  const [busy, setBusy] = useState(false);

  // Pick GPS location — uses the phone/browser geolocation while standing
  // at the structure. Requires HTTPS (Vercel) or localhost; user permission
  // is requested by the browser on first use.
  function pickGps() {
    setGpsErr("");
    if (!("geolocation" in navigator)) {
      setGpsErr("This device does not support GPS");
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: Number(pos.coords.latitude.toFixed(7)), lng: Number(pos.coords.longitude.toFixed(7)) });
        setGpsBusy(false);
      },
      (err) => {
        setGpsBusy(false);
        setGpsErr(
          err.code === 1
            ? "GPS permission denied — allow location access in your browser"
            : err.code === 3
              ? "GPS timed out — step outside and try again"
              : "GPS unavailable right now — try again"
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // Payment modal state
  const [payFor, setPayFor] = useState<Row | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) => setSel((prev) => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  const printSelected = () => { if (sel.size) window.open(`/bill/print?ids=${[...sel].join(",")}`, "_blank"); };
  const printAllFiltered = () => { if (rows.length) window.open(`/bill/print?ids=${rows.map((r) => r.id).join(",")}`, "_blank"); };
  const [payAmt, setPayAmt] = useState("");
  const [payErr, setPayErr] = useState("");

  // Record detail view (staff + admin can both open)
  type Detail = {
    record: {
      serialNumber: string; name: string; businessName: string; telephone: string;
      electoralArea: string; streetName: string; recordStatus: string;
      latitude: number | null; longitude: number | null;
      createdAt: string;
      fees: { amount: number; createdAt: string }[];
      payments: { amount: number; kind: string; createdAt: string; recordedBy?: { username?: string } | null }[];
    };
    totals: { totalBilled: number; totalPaid: number; balance: number };
  };
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  async function openDetail(r: Row) {
    setDetailBusy(true);
    try {
      const res = await fetch(`/api/records/${r.id}/detail`);
      if (res.ok) setDetail(await res.json());
      else setDetail(null);
    } finally {
      setDetailBusy(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (area) p.set("area", area);
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    const res = await fetch(`/api/records/list?${p}`);
    if (res.ok) {
      const data = await res.json();
      setRows(data.records);
      setByArea(data.byArea);
      setGrand(data.grand);
    }
    setLoading(false);
  }, [area, q, status]);

  useEffect(() => { load(); }, [load]);

  // AUTO-REFRESH: re-fetch the register every 30 seconds so staff see each
  // other's new records and payments without pressing anything. The
  // interval is cleared when the tab is hidden and resumes when visible
  // again (no wasted data, no battery drain on phones in pockets).
  useEffect(() => {
    const tick = () => { if (!document.hidden) load(); };
    const id = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [load]);

  // Live serial preview when the Electoral Area is picked
  async function onAreaPick(a: string) {
    setForm((f) => ({ ...f, electoralArea: a }));
    setFormErr([]);
    if (!a) { setSerialPreview(""); return; }
    const res = await fetch(`/api/serial-preview?area=${encodeURIComponent(a)}`);
    if (res.ok) {
      const d = await res.json();
      setSerialPreview(d.serial);
    }
  }

  async function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    setFormErr([]); setFormOk(""); setBusy(true);
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ...(gps ? { latitude: gps.lat, longitude: gps.lng } : {}),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setFormErr(data.errors || [data.error]); return; }
    setFormOk(`Saved — ${data.record.serialNumber} (${data.record.name})` + (gps ? " with GPS location" : ""));
    setForm({ name: "", businessName: "", telephone: "", electoralArea: "", streetName: "", fee: "" });
    setSerialPreview("");
    setGps(null);
    load();
  }

  async function markPaid(row: Row) {
    if (!confirm(`Mark ${row.name} (${row.serialNumber}) as PAID?\nBalance GH₵ ${row.balance.toFixed(2)} will be recorded as fully settled.`)) return;
    const res = await fetch(`/api/records/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    });
    if (res.ok) load();
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payFor) return;
    setPayErr("");
    const res = await fetch(`/api/records/${payFor.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(payAmt) }),
    });
    const data = await res.json();
    if (!res.ok) { setPayErr((data.errors && data.errors[0]) || data.error || "Failed"); return; }
    setPayFor(null); setPayAmt("");
    load();
  }

  // Edit modal state
  const [editFor, setEditFor] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ name: "", businessName: "", telephone: "", streetName: "", electoralArea: "" });
  const [editErr, setEditErr] = useState<string[]>([]);
  const [editMsg, setEditMsg] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  function openEdit(row: Row) {
    setEditFor(row);
    setEditForm({
      name: row.name, businessName: row.businessName, telephone: row.telephone,
      streetName: row.streetName, electoralArea: row.electoralArea,
    });
    setEditErr([]); setEditMsg("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editFor) return;
    setEditErr([]); setEditMsg(""); setEditBusy(true);

    if (canEditDirect) {
      // Admin (FULL/EDITOR) edits apply immediately (audit-logged)
      const res = await fetch(`/api/records/${editFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      setEditBusy(false);
      if (!res.ok) { setEditErr(data.errors || [data.error]); return; }
      setEditFor(null);
      setFormOk(`Record ${editFor.serialNumber} updated`);
      load();
    } else {
      // Staff edits go to the approval queue
      const res = await fetch(`/api/records/${editFor.id}/edit-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      setEditBusy(false);
      if (!res.ok) { setEditErr(data.errors || [data.error]); return; }
      setEditMsg(data.message || "Edit submitted for administrator approval.");
      setEditFor(null);
      setFormOk("Edit submitted for administrator approval — the record changes after the administrator approves it.");
    }
  }
  function exportExcel() {
    // Download the filtered view as a real .xlsx (3 sheets incl. grand totals)
    const p = new URLSearchParams();
    if (area) p.set("area", area);
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    window.location.href = `/api/export?${p.toString()}`;
  }

  async function deleteRecord(row: Row) {
    if (
      !confirm(
        `Delete ${row.name} (${row.serialNumber})?\n\n` +
          `This removes the record from the register. The serial number is retired ` +
          `and will NOT be reused. This action is audit-logged.`
      )
    )
      return;
    const res = await fetch(`/api/records/${row.id}/delete`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Delete failed");
      return;
    }
    setFormOk(`Deleted ${row.serialNumber} (${row.name})`);
    load();
  }

  return (
    <>
      <div className="card">
        <h2>Temporal Structures Register</h2>
        <p className="sub">Official fee register — Srodae Zonal Council, New Juaben South Municipal Assembly</p>

        <div className="filters only-desktop">
          <div className="f">
            <label className="fld" style={{ marginBottom: 0 }}>
              <span className="cap">Electoral Area</span>
              <select value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">All areas</option>
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>
          <div className="f">
            <label className="fld" style={{ marginBottom: 0 }}>
              <span className="cap">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PAID">Paid</option>
              </select>
            </label>
          </div>
          <div className="f grow">
            <label className="fld" style={{ marginBottom: 0 }}>
              <span className="cap">Search</span>
              <input type="text" placeholder="Name, business, serial or street..." value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          {canCreate && <button className="btn btn-primary" onClick={() => { setShowForm((s) => !s); setFormOk(""); }}>New Record</button>}
          <button className="btn btn-ghost" onClick={exportExcel}>Export Excel</button>
          <button className="btn btn-ghost" onClick={() => window.print()}>Print</button>
          <button className="btn btn-ghost" onClick={printSelected} disabled={sel.size === 0} title="Print bills for ticked clients">
            Print Bills ({sel.size})
          </button>
          <button className="btn btn-ghost" onClick={printAllFiltered} title="Print a bill for every client in the current filter">
            Bills for All ({rows.length})
          </button>
        </div>

        {/* Phones: sticky compact filter bar */}
        <div className="m-filters only-mobile">
          <div className="m-row1">
            <input
              type="text"
              placeholder="Search name, serial, street…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search records"
            />
            <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Electoral area">
              <option value="">Area</option>
              {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="m-chips" role="group" aria-label="Status filter">
            <button type="button" className={"m-chip" + (status === "" ? " on" : "")} onClick={() => setStatus("")}>All</button>
            <button type="button" className={"m-chip chip-unpaid" + (status === "UNPAID" ? " on" : "")} onClick={() => setStatus("UNPAID")}>Unpaid</button>
            <button type="button" className={"m-chip chip-paid" + (status === "PAID" ? " on" : "")} onClick={() => setStatus("PAID")}>Paid</button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={saveRecord} className="card" style={{ background: "#fbfdff" }}>
            <h2>New Record</h2>
            <p className="sub">Serial number is generated automatically when you select the Electoral Area.</p>

            {formErr.length > 0 && <div className="err">{formErr.map((x, i) => <div key={i}>{x}</div>)}</div>}
            {formOk && <div className="ok-msg">{formOk}</div>}

            <div style={{ marginBottom: 14 }}>
              <span className="cap" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--navy)", marginBottom: 5 }}>
                Serial Number <span style={{ color: "var(--muted)", fontWeight: 400 }}>(automatic)</span>
              </span>
              {serialPreview
                ? <span className="serial-preview"><span className="lbl">Will receive:</span> {serialPreview}</span>
                : <span className="serial-preview" style={{ opacity: 0.55 }}><span className="lbl">Select an Electoral Area to generate</span></span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0 16px" }}>
              <label className="fld"><span className="cap">Name <span className="req">*</span></span>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
              <label className="fld"><span className="cap">Business Name <span className="req">*</span></span>
                <input type="text" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required /></label>
              <label className="fld"><span className="cap">Telephone <span className="req">*</span></span>
                <input type="tel" placeholder="0241234567" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} required /></label>
              <label className="fld"><span className="cap">Electoral Area <span className="req">*</span></span>
                <select value={form.electoralArea} onChange={(e) => onAreaPick(e.target.value)} required>
                  <option value="">Select area...</option>
                  {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select></label>
              <label className="fld"><span className="cap">Street Name <span className="req">*</span></span>
                <input type="text" value={form.streetName} onChange={(e) => setForm({ ...form, streetName: e.target.value })} required /></label>

              <label className="fld">
                <span className="cap">GPS Location <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional — stand at the structure and pick)</span></span>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {gps ? (
                    <>
                      <span className="serial-preview" style={{ fontSize: 13 }}>
                        {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
                      </span>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGps(null)}>Clear</button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={pickGps} disabled={gpsBusy}>
                      {gpsBusy ? "Locating..." : "Pick GPS Location"}
                    </button>
                  )}
                </div>
                {gpsErr && <span className="err" style={{ marginTop: 6, display: "block", fontSize: 12 }}>{gpsErr}</span>}
              </label>
              <label className="fld"><span className="cap">Fee (GH₵) <span className="req">*</span></span>
                <input type="number" step="0.01" min="0.01" placeholder="e.g. 50" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} required /></label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : "Save Record"}</button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setSerialPreview(""); }}>Cancel</button>
            </div>
          </form>
        )}

        <div className="tbl-wrap only-desktop">
          <table className="tbl">
            <thead>
              <tr>
                <th className="no-print" style={{ width: 30 }} title="Tick to select clients for bill printing"></th>
                <th>Serial No</th>
                <th>Name</th>
                <th>Business Name</th>
                <th>Telephone</th>
                <th>Electoral Area</th>
                <th>Street Name</th>
                <th>GPS</th>
                <th style={{ textAlign: "right" }}>Fee (GH₵)</th>
                <th style={{ textAlign: "right" }}>Balance (GH₵)</th>
                <th style={{ textAlign: "right" }}>Total (GH₵)</th>
                <th>Status</th>
                <th className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11} style={{ textAlign: "center", color: "var(--muted)" }}>Loading...</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: "center", color: "var(--muted)" }}>No records match the current filters.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="no-print" style={{ textAlign: "center" }}>
                    <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} aria-label={`Select bill for ${r.name}`} />
                  </td>
                  <td className="serial">{r.serialNumber}</td>
                  <td><button className="linklike" title="View details" onClick={() => openDetail(r)}>{r.name}</button></td>
                  <td>{r.businessName}</td>
                  <td>{r.telephone}</td>
                  <td>{r.electoralArea}</td>
                  <td>{r.streetName}</td>
                  <td>
                    {r.hasGps ? (
                      <a href={r.mapsUrl || "#"} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ padding: "3px 8px", fontSize: 12 }}>
                        Map
                      </a>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 11 }}>-</span>
                    )}
                  </td>
                  <td className="num">{r.fee.toFixed(2)}</td>
                  <td className="num"><b>{r.status === "PAID" ? "0.00" : r.balance.toFixed(2)}</b></td>
                  <td className="num">{r.status === "PAID" ? "0.00" : r.total.toFixed(2)}</td>
                  <td><span className={`badge ${r.status === "PAID" ? "paid" : "unpaid"}`}>{r.status === "PAID" ? "PAID" : "UNPAID"}</span></td>
                  <td className="no-print" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                    {" "}
                    <a className="btn btn-ghost btn-sm" href={`/bill/${r.id}`} target="_blank" rel="noopener noreferrer">Bill</a>
                    {r.status !== "PAID" && canPay && (
                      <>
                        {" "}
                        <button className="btn btn-ghost btn-sm" onClick={() => { setPayFor(r); setPayAmt(""); setPayErr(""); }}>Pay</button>
                        {" "}
                        <button className="btn btn-green btn-sm" onClick={() => markPaid(r)}>Mark Paid</button>
                      </>
                    )}
                    {" "}
                    {isAdmin && canDelete && (
                      <button className="btn btn-danger btn-sm" onClick={() => deleteRecord(r)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phones: stacked record cards */}
        <div className="only-mobile">
          {loading && <p style={{ color: "var(--muted)", textAlign: "center" }}>Loading…</p>}
          {!loading && rows.length === 0 && (
            <p style={{ color: "var(--muted)", textAlign: "center" }}>No records match the current filters.</p>
          )}
          {rows.map((r) => (
            <div key={r.id} className="user-card user-card-tap" onClick={() => openDetail(r)}>
              <div className="user-card-head">
                <div>
                  <div className="serial" style={{ fontSize: 14 }}>{r.serialNumber}</div>
                  <div style={{ fontWeight: 700 }}><button className="linklike" onClick={(e) => { e.stopPropagation(); openDetail(r); }}>{r.name}</button></div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{r.businessName}</div>
                </div>
                <span className={`badge ${r.status === "PAID" ? "paid" : "unpaid"}`}>{r.status === "PAID" ? "PAID" : "UNPAID"}</span>
              </div>
              <div className={"user-card-balance" + (r.status === "PAID" ? " is-paid" : "")}>
                <span className="b-label">BALANCE</span>
                <span className="b-value">GH₵ {r.status === "PAID" ? "0.00" : r.balance.toFixed(2)}</span>
                <span className="b-note">fee {r.fee.toFixed(2)} · total {r.status === "PAID" ? "0.00" : r.total.toFixed(2)}</span>
              </div>
              <div className="user-card-meta">
                <label className="bill-tick" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} />
                  Bill
                </label>
                <span>{r.telephone} · {r.electoralArea} · {r.streetName}</span>
              </div>
              <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                {r.hasGps && (
                  <a href={r.mapsUrl || "#"} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    Map
                  </a>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                {r.status !== "PAID" && canPay && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setPayFor(r); setPayAmt(""); setPayErr(""); }}>Pay</button>
                    <button className="btn btn-green btn-sm" onClick={() => markPaid(r)}>Mark Paid</button>
                  </>
                )}
                {isAdmin && canDelete && (
                  <button className="btn btn-danger btn-sm" onClick={() => deleteRecord(r)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Grand totals — system-computed */}
        <div className="grand">
          <div className="tag">GRAND TOTALS</div>
          <div className="g"><div className="k">RECORDS</div><div className="v">{grand.records}</div></div>
          <div className="g"><div className="k">TOTAL BILLED</div><div className="v">{GHS(grand.billed)}</div></div>
          <div className="g"><div className="k">TOTAL COLLECTED</div><div className="v">{GHS(grand.collected)}</div></div>
          <div className="g"><div className="k">OUTSTANDING</div><div className="v">{GHS(grand.outstanding)}</div></div>
        </div>
      </div>

      {/* Per-area summary */}
      <div className="card">
        <h2>Per-Area Summary</h2>
        <p className="sub">Counts and totals computed by the system for the current filter view.</p>
        <div className="summary-grid">
          {Object.entries(byArea).map(([a, s]) => (
            <div className="sum-card" key={a}>
              <div className="k">{a}</div>
              <div className="v">{s.count} record{s.count === 1 ? "" : "s"}</div>
              <div className="k" style={{ marginTop: 6 }}>Billed {GHS(s.billed)} · Collected {GHS(s.collected)}</div>
              <div className="k">Outstanding {GHS(s.outstanding)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(3,70,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 12, overflowY: "auto" }} onClick={() => setEditFor(null)}>
          <form className="card modal-card" style={{ width: 460, margin: "20px 0" }} onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <h2>Edit Record — {editFor.serialNumber}</h2>
            <p className="sub">
              {canEditDirect
                ? "Your changes apply immediately (audit-logged)."
                : "Your changes will be submitted for administrator approval. The record stays unchanged until approved."}
            </p>
            {editErr.length > 0 && <div className="err">{editErr.map((x, i) => <div key={i}>{x}</div>)}</div>}

            <label className="fld"><span className="cap">Name</span>
              <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label>
            <label className="fld"><span className="cap">Business Name</span>
              <input type="text" value={editForm.businessName} onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })} /></label>
            <label className="fld"><span className="cap">Telephone</span>
              <input type="tel" value={editForm.telephone} onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })} /></label>
            <label className="fld"><span className="cap">Electoral Area</span>
              <select value={editForm.electoralArea} onChange={(e) => setEditForm({ ...editForm, electoralArea: e.target.value })}>
                {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select></label>
            <label className="fld"><span className="cap">Street Name</span>
              <input type="text" value={editForm.streetName} onChange={(e) => setEditForm({ ...editForm, streetName: e.target.value })} /></label>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={editBusy}>
                {editBusy ? "Submitting..." : canEditDirect ? "Save Changes" : "Submit for Approval"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditFor(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Record detail modal — staff and admin both use this */}
      {detailBusy && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(3,70,39,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="card modal-card" style={{ margin: 0, padding: "18px 22px" }}>Loading details…</div>
        </div>
      )}
      {detail && !detailBusy && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(3,70,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 12 }} onClick={() => setDetail(null)}>
          <div className="card modal-card" style={{ width: 440, maxWidth: "100%", margin: 0, maxHeight: "86vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span>Record Details</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>Close</button>
            </h2>
            <p className="sub" style={{ marginBottom: 10 }}><b style={{ fontSize: 16 }}>{detail.record.serialNumber}</b> — {detail.record.name}</p>
            <table className="kv" style={{ width: "100%", fontSize: 13.5, borderCollapse: "collapse" }}>
              <tbody>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Business Name</td><td style={{ padding: "4px 0", fontWeight: 600 }}>{detail.record.businessName || "—"}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Telephone</td><td style={{ padding: "4px 0" }}>{detail.record.telephone || "—"}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Electoral Area</td><td style={{ padding: "4px 0" }}>{detail.record.electoralArea}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Street</td><td style={{ padding: "4px 0" }}>{detail.record.streetName || "—"}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Registered</td><td style={{ padding: "4px 0" }}>{new Date(detail.record.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Location</td><td style={{ padding: "4px 0" }}>
                  {detail.record.latitude != null && detail.record.longitude != null ? (
                    <a href={`https://www.google.com/maps?q=${detail.record.latitude},${detail.record.longitude}`} target="_blank" rel="noopener noreferrer">View on map ({detail.record.latitude.toFixed(5)}, {detail.record.longitude.toFixed(5)})</a>
                  ) : "—"}
                </td></tr>
                <tr><td className="k" style={{ color: "var(--muted)", padding: "4px 10px 4px 0" }}>Status</td><td style={{ padding: "4px 0" }}><span className={`badge ${detail.totals.balance <= 0 ? "paid" : "unpaid"}`}>{detail.totals.balance <= 0 ? "PAID" : "UNPAID"}</span></td></tr>
              </tbody>
            </table>

            <h3 style={{ margin: "16px 0 6px", fontSize: 14.5 }}>Money</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div className="g" style={{ flex: 1, minWidth: 110, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>
                <div className="k" style={{ fontSize: 11, color: "var(--muted)" }}>TOTAL BILLED</div>
                <div className="v" style={{ fontWeight: 700 }}>{GHS(detail.totals.totalBilled)}</div>
              </div>
              <div className="g" style={{ flex: 1, minWidth: 110, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px" }}>
                <div className="k" style={{ fontSize: 11, color: "var(--muted)" }}>PAID SO FAR</div>
                <div className="v" style={{ fontWeight: 700 }}>{GHS(detail.totals.totalPaid)}</div>
              </div>
              <div className="g" style={{ flex: 1, minWidth: 110, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", background: "var(--paper)" }}>
                <div className="k" style={{ fontSize: 11, color: "var(--muted)" }}>BALANCE</div>
                <div className="v" style={{ fontWeight: 800, color: detail.totals.balance > 0 ? "var(--danger, #b91c1c)" : "var(--ok, #065c37)" }}>{GHS(detail.totals.balance)}</div>
              </div>
            </div>

            <h3 style={{ margin: "16px 0 6px", fontSize: 14.5 }}>Payment history</h3>
            {detail.record.payments.length === 0 ? (
              <p className="sub">No payments recorded yet.</p>
            ) : (
              <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                    <th style={{ padding: "3px 8px 3px 0" }}>Date</th>
                    <th style={{ padding: "3px 8px 3px 0" }}>Type</th>
                    <th style={{ padding: "3px 8px 3px 0" }}>Recorded by</th>
                    <th style={{ padding: "3px 0", textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.record.payments.map((p, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "5px 8px 5px 0" }}>{new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td style={{ padding: "5px 8px 5px 0" }}>{p.kind === "SETTLEMENT" ? "Full settlement" : "Part payment"}</td>
                      <td style={{ padding: "5px 8px 5px 0" }}>{p.recordedBy?.username || "—"}</td>
                      <td style={{ padding: "5px 0", textAlign: "right", fontWeight: 600 }}>{GHS(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(3,70,39,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setPayFor(null)}>
          <form className="card modal-card" style={{ width: 380, margin: 0 }} onClick={(e) => e.stopPropagation()} onSubmit={savePayment}>
            <h2>Record Cash Payment</h2>
            <p className="sub">{payFor.serialNumber} — {payFor.name} ({payFor.businessName})<br />Outstanding balance: <b>{GHS(payFor.balance)}</b></p>
            {payErr && <div className="err">{payErr}</div>}
            <label className="fld"><span className="cap">Amount paid now (GH₵)</span>
              <input type="number" step="0.01" min="0.01" max={payFor.balance} value={payAmt} onChange={(e) => setPayAmt(e.target.value)} autoFocus required /></label>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>Save Payment</button>
              <button type="button" className="btn btn-ghost" onClick={() => setPayFor(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}