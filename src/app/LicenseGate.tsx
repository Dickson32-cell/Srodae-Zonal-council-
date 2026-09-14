"use client";
// LicenseGate — watches the register's license state. When the register
// locks (100 registrations reached, payment not yet made), a modal popup
// tells the council a US$5 fee is due and where to enter the unlock key
// the owner issues after payment. While locked: no new records, no Excel export.
import { useCallback, useEffect, useState } from "react";

type License = {
  registered: number;
  paidThrough: number;
  remainingFree: number;
  locked: boolean;
  nextUnlockAt: number;
  feeUSD: number;
  payee: string;
  momoNumber: string;
};

export default function LicenseGate({ onChanged }: { onChanged?: () => void }) {
  const [license, setLicense] = useState<License | null>(null);
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/license");
      if (res.ok) setLicense(await res.json());
    } catch { /* offline: keep last known state */ }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [check]);

  async function submitKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("Register unlocked — thank you. You can now record 100 more.");
        setLicense(data.status); setKey("");
        onChanged?.();
        setTimeout(() => setMsg(""), 4000);
      } else {
        setMsg(data.error || "Key not accepted. Check with the system provider after payment.");
      }
    } finally { setBusy(false); }
  }

  if (!license || !license.locked || dismissed) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(3,70,39,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 14 }}>
      <div className="card modal-card" style={{ width: 430, maxWidth: "100%", margin: 0, maxHeight: "88vh", overflowY: "auto" }}>
        <h2 style={{ fontSize: 19 }}>Register Limit Reached</h2>
        <p className="sub" style={{ marginTop: 4 }}>
          The council has registered <b style={{ color: "#065c37" }}>{license.registered} structures</b>,
          reaching the free limit of this system.
        </p>
        <div style={{ background: "var(--paper, #f6fbf7)", border: "1px solid var(--line, #cde3d5)", borderRadius: 8, padding: "12px 16px", margin: "10px 0", textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#065c37" }}>Pay a US${license.feeUSD} fee to continue</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Contact the system provider to make the payment and receive your unlock key.</div>
        </div>
        <p className="sub" style={{ fontSize: 12.5 }}>
          After payment, you will receive an unlock key. Enter it below to
          unlock the next 100 registrations. Until then, new entries and Excel
          export are paused — your existing records remain safe and viewable.
        </p>
        <form onSubmit={submitKey}>
          <label className="fld">
            <span className="cap">Unlock key</span>
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoFocus required />
          </label>
          {msg && <div className={msg.startsWith("Register unlocked") ? "ok" : "err"} style={{ margin: "6px 0", fontSize: 13 }}>{msg}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} disabled={busy}>
              {busy ? "Checking…" : "Unlock Register"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setDismissed(true)}>Later</button>
          </div>
        </form>
      </div>
    </div>
  );
}