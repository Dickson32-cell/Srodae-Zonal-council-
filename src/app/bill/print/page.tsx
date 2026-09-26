"use client";
// /bill/print — batch bill printing. Admin/staff arrive with ?ids=a,b,c
// (selected tickboxes in the register). Each bill renders on its own printed page.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import BillSheet, { type BillData } from "@/components/BillSheet";

function BatchPrintInner() {
  const sp = useSearchParams();
  const ids = (sp.get("ids") || "").split(",").map(s => s.trim()).filter(Boolean);
  const [bills, setBills] = useState<BillData[]>([]);
  const [errors, setErrors] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      let failed = 0;
      const out: BillData[] = [];
      for (const id of ids) {
        const res = await fetch(`/api/records/${id}/bill`);
        if (res.ok) out.push(await res.json());
        else failed++;
      }
      setBills(out);
      setErrors(failed);
      setDone(true);
    })();
  }, [ids.join(",")]);

  if (!done) return <p style={{ padding: 40 }}>Preparing {ids.length} bill(s)…</p>;
  if (!bills.length) return <p style={{ padding: 40 }}>No bills could be loaded. Please log in first.</p>;

  return (
    <div style={{ background: "#eef1f6", minHeight: "100vh", padding: 18 }}>
      <style>{`
        @media print {
          .bill-toolbar { display: none !important; }
          body { background: #fff !important; }
          .bill-page { page-break-after: always; }
          .bill-page:last-child { page-break-after: auto; }
        }
      `}</style>
      <div className="bill-toolbar" style={{ maxWidth: 960, margin: "0 auto 12px", textAlign: "right" }}>
        <button className="btn btn-primary" onClick={() => window.print()}>Print {bills.length} bill(s)</button>
        {" "}
        <button className="btn btn-ghost" onClick={() => history.back()}>Back</button>
        {errors > 0 && <span style={{ color: "#a33", marginLeft: 10 }}>{errors} bill(s) could not be loaded</span>}
      </div>
      {bills.map((b) => (
        <div className="bill-page" key={b.customer.id + b.printedOn}>
          <BillSheet data={b} />
        </div>
      ))}
    </div>
  );
}

export default function BatchPrintPage() {
  return (
    <Suspense fallback={<p style={{ padding: 40 }}>Loading…</p>}>
      <BatchPrintInner />
    </Suspense>
  );
}