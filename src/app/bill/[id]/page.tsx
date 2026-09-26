"use client";
// Printable bill for ONE client - Assembly-style layout (main bill + counterfoil).
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import BillSheet, { type BillData } from "@/components/BillSheet";

export default function BillPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<BillData | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/records/${params.id}/bill`);
      if (res.ok) setData(await res.json());
      else setErr(res.status === 401 ? "Please log in first." : "Bill not found.");
    })();
  }, [params.id]);

  if (err) return <p style={{ padding: 40 }}>{err}</p>;
  if (!data) return <p style={{ padding: 40 }}>Loading…</p>;

  return (
    <div style={{ background: "#eef1f6", minHeight: "100vh", padding: 18 }}>
      <style>{`
        @media print { .bill-no-print { display: none !important; } body { background: #fff !important; } }
      `}</style>
      <div className="bill-no-print" style={{ maxWidth: 960, margin: "0 auto 12px", textAlign: "right" }}>
        <button className="btn btn-primary" onClick={() => window.print()}>Print bill</button>
        {" "}
        <button className="btn btn-ghost" onClick={() => history.back()}>Back</button>
      </div>
      <BillSheet data={data} />
    </div>
  );
}