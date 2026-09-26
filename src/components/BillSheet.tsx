"use client";
// BillSheet — the Assembly-style bill (main bill + counterfoil), shared by
// the single-bill page (/bill/[id]) and the batch print page (/bill/print).
// BOP stays "—" until zonal councils receive the BOP collection mandate.
export type BillData = {
  councilId: string;
  councilName: string;
  customer: {
    id: string; name: string; businessName: string;
    telephone: string; electoralArea: string; streetName: string;
  };
  bill: {
    structureRate: number; bop: null; basicRate: number; rent: number;
    arrears: number; payment: number; totalDue: number; status: string;
    description: string;
  };
  printedOn: string;
};

const GHS = (n: number) => n.toFixed(2);

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? "ST" : day % 10 === 2 && day !== 12 ? "ND" : day % 10 === 3 && day !== 13 ? "RD" : "TH";
  const month = d.toLocaleString("en-GB", { month: "long" }).toUpperCase();
  return `${day}${suffix} ${month}, ${d.getFullYear()}`;
}

export default function BillSheet({ data, directorName }: { data: BillData; directorName?: string }) {
  const { customer, bill } = data;
  const printed = formatDate(data.printedOn);
  return (
    <div className="bill-sheet">
      <style>{`
        .bill-sheet { display: flex; gap: 10px; max-width: 820px; margin: 0 auto 14px; background: #fff; padding: 10px; border: 1px solid #333; font-family: Arial, Helvetica, sans-serif; color: #000; }
        .bill-main { flex: 1 1 68%; border: 1px solid #444; padding: 10px 12px; position: relative; overflow: hidden; }
        .bill-watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 0; }
        .bill-watermark img { width: 72%; max-width: 330px; opacity: 0.07; }
        .bill-main > div:not(.bill-watermark), .bill-main > table { position: relative; z-index: 1; }
        .bill-stub { flex: 1 1 30%; border: 1px solid #444; padding: 10px; display: flex; flex-direction: column; }
        .bill-head { display: flex; align-items: center; gap: 8px; }
        .bill-head .logo { width: 44px; height: 44px; object-fit: contain; }
        .bill-head .htxt { flex: 1; text-align: center; font-weight: bold; font-size: 11px; line-height: 1.5; }
        .bill-head .htxt .sub { font-weight: normal; font-size: 8.5px; }
        .bill-cust { border-top: 1px solid #444; border-bottom: 1px solid #444; margin-top: 8px; padding: 6px 0; font-size: 10.5px; font-weight: bold; }
        .bill-cust small { font-weight: normal; }
        .bill-arealine { border-bottom: 1px solid #444; padding: 5px 0; font-size: 11px; font-weight: bold; }
        .bill-desc { display: flex; justify-content: space-between; padding: 5px 0; font-size: 11px; border-bottom: 1px solid #444; }
        table.bill-rates { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 2px; }
        table.bill-rates th, table.bill-rates td { padding: 6px 4px; }
        table.bill-rates th { font-weight: bold; text-align: left; border-bottom: 1px solid #444; }
        table.bill-rates td { border-bottom: 1px solid #ddd; }
        .bill-legal { margin-top: 10px; font-size: 10.5px; line-height: 1.55; }
        .bill-legal p { margin: 0 0 8px; }
        .bill-printed { text-align: right; font-style: italic; font-size: 10px; margin-top: 8px; }
        .bill-signature { display: flex; justify-content: space-between; gap: 40px; margin-top: 22px; padding: 0 6px; }
        .sig-line { flex: 1 1 55%; text-align: center; }
        .sig-stamp { flex: 1 1 40%; text-align: center; }
        .sig-name { font-family: "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive; font-size: 16px; display: block; min-height: 22px; margin-bottom: 2px; }
        .sig-rule { border-top: 1px solid #444; }
        .sig-cap { font-size: 9.5px; font-weight: bold; margin-top: 3px; letter-spacing: 0.3px; }
        .stub-rate { border: 1px solid #444; padding: 4px 6px; font-size: 10px; font-weight: bold; margin-top: 5px; }
        .stub-box { border: 1px solid #444; padding: 4px 6px; font-size: 10px; min-height: 30px; margin-top: 5px; }
        .stub-contact { text-align: center; font-size: 9px; font-weight: bold; margin-top: 5px; line-height: 1.5; }
        .stub-sign { text-align: center; font-size: 22px; margin-top: 18px; }
        .stub-logos { text-align: center; font-size: 9px; color: #555; }
        @media print {
          @page { size: A5 portrait; margin: 8mm; }
          .bill-sheet { max-width: none; border: none; }
          .bill-watermark img { opacity: 0.07; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* ============ MAIN BILL ============ */}
      <div className="bill-main">
        {/* WATERMARK: assembly logo behind all content */}
        <div className="bill-watermark" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assembly-logo.jpg" alt="" />
        </div>
        <div className="bill-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assembly-logo.jpg" alt="Assembly logo" className="logo" />
          <div className="htxt">
            {data.councilName.toUpperCase()}
            <br />
            <span className="sub">TEMPORAL STRUCTURES BILL</span>
            <br />
            <span className="sub">PAY BEFORE 31ST MARCH, 2027 TO AVOID PENALTY</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/coat-of-arms.jpg" alt="Ghana coat of arms" className="logo" />
        </div>

        <div className="bill-cust">
          {customer.name.toUpperCase()} — {customer.businessName.toUpperCase()}
          {"  "}<small>Tel No:</small> {customer.telephone}
          {"  "}<small>Customer ID:</small> {customer.id}
        </div>

        <div className="bill-arealine">{customer.electoralArea.toUpperCase()} -&nbsp;</div>

        <div className="bill-desc">
          <span>{customer.electoralArea} — {customer.businessName || customer.name}</span>
          <span>{bill.description}</span>
        </div>

        <table className="bill-rates">
          <thead>
            <tr>
              <th>Structure<br />Rate</th>
              <th>BOP</th>
              <th>Rent</th>
              <th>Basic Rate</th>
              <th>Arrears</th>
              <th>Payment</th>
              <th>Amount<br />Due</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{GHS(bill.structureRate)} GHS</td>
              <td>—</td>
              <td>{bill.rent} GHS</td>
              <td>{GHS(bill.basicRate)} GHS</td>
              <td>{GHS(bill.arrears)} GHS</td>
              <td>{GHS(bill.payment)} GHS</td>
              <td>{GHS(bill.totalDue)}<br />GHS</td>
            </tr>
          </tbody>
        </table>

        <div className="bill-legal">
          <p>
            PAY YOUR BILLS PROMPTLY FOR ACCELERATED DEVELOPMENT OF THE {data.councilName.toUpperCase().replace(" ZONAL COUNCIL", "")} ZONE.
            The Zonal Council is vested with power to collect temporal structure fees within its electoral
            areas by the provisions of the Local Governance Act 2016 (ACT 936) and other relevant Bye-laws.
            In the event of failure to comply with this Bill, the PROPERTY or BUSINESS OWNER SHALL BE
            LIABLE TO CIVIL PROSECUTION for the recovery of the outstanding amount plus interest.
          </p>
          <p>
            NB: Unless otherwise stated, penalty for defaulting any rate is 3x the amount due. Penalty for all
            defaulting rate payers take effect from the date stated above. Payment can be done at the Zonal
            Council office, through revenue collectors, or at the Assembly pay point. Obtain an official
            General Counterfoil Receipt (GCR) for any amount paid and do not make any payment without this BILL.
          </p>
        </div>

        <div className="bill-printed">Printed on: {printed}</div>

        {/* DIRECTOR SIGNATURE BLOCK */}
        <div className="bill-signature">
          <div className="sig-line">
            <span className="sig-name">{directorName?.trim() ? directorName : "\u00A0"}</span>
            <div className="sig-rule" />
            <div className="sig-cap">DIRECTOR (Name &amp; Signature)</div>
          </div>
          <div className="sig-stamp">
            <div className="sig-rule" />
            <div className="sig-cap">ZONAL COUNCIL STAMP</div>
          </div>
        </div>
      </div>

      {/* ============ COUNTERFOIL ============ */}
      <div className="bill-stub">
        <div className="stub-logos" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assembly-logo.jpg" alt="Assembly logo" style={{ width: 40, height: 40, objectFit: "contain" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/coat-of-arms.jpg" alt="Ghana coat of arms" style={{ width: 48, height: 36, objectFit: "contain" }} />
        </div>
        <div className="stub-contact">
          {data.councilName.toUpperCase()}<br />
          TEMPORAL STRUCTURES BILL<br /><br />
          <b>{customer.name.toUpperCase()} — {customer.businessName.toUpperCase()}</b><br />
          TEL NO: {customer.telephone}<br />
          CUSTOMER ID: {customer.id}
        </div>
        <div className="stub-rate">STRUCTURE RATE: {GHS(bill.structureRate)} GHS</div>
        <div className="stub-rate">BOP: — (NOT COLLECTED)</div>
        <div className="stub-rate">BASIC RATE: {GHS(bill.basicRate)} GHS</div>
        <div className="stub-rate">ARREARS: {GHS(bill.arrears)} GHS</div>
        <div className="stub-rate">RENT: {bill.rent} GHS</div>
        <div className="stub-rate">PAYMENT: {GHS(bill.payment)} GHS</div>
        <div className="stub-rate">TOTAL DUE: {GHS(bill.totalDue)} GHS</div>
        <div className="stub-box">Received by:</div>
        <div className="stub-box">Date:</div>
        <div className="stub-box">Delivered by:</div>
        <div className="stub-box">Date:</div>
        <div className="stub-sign">✗</div>
        <div style={{ textAlign: "right", fontStyle: "italic", fontSize: 10, marginTop: "auto" }}>
          Printed on: {printed}
        </div>
      </div>
    </div>
  );
}