"use client";
// UserAdmin — admin's staff management: approve, reject, deactivate, promote, delete.
// Responsive: card layout on phones, table on larger screens.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type U = {
  id: string; username: string; fullName: string;
  role: string; adminLevel: string | null; active: boolean; createdAt: string;
  recordsCreated: number;
};

function RoleLabel({ u }: { u: U }) {
  if (u.role !== "ADMIN") return <>Staff</>;
  if (u.username === "admin") return <>Admin (Primary)</>;
  const lv = u.adminLevel || "EDITOR";
  return <>{lv === "VIEWER" ? "Viewer Admin" : lv === "EDITOR" ? "Editor Admin" : "Full Admin"}</>;
}

export default function UserAdmin() {
  const [users, setUsers] = useState<U[]>([]);
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(u: U, action: string, label: string, extra?: Record<string, unknown>) {
    const needsConfirm: Record<string, string> = {
      reject: `Reject and disable ${u.username}'s registration?`,
      deactivate: `Deactivate ${u.username}? They will not be able to sign in.`,
      delete: `Permanently DELETE the account "${u.username}" (${u.fullName})?\n\nThey will lose all access and cannot be recovered. Their past records and audit history remain in the register.`,
    };
    if (needsConfirm[action] && !confirm(needsConfirm[action])) return;
    setBusyId(u.id); setMsg(""); setErr("");
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.id, action, ...extra }),
    });
    const data = await res.json();
    setBusyId("");
    if (!res.ok) { setErr(data.error || "Operation failed"); return; }
    setMsg(data.deleted ? `Account "${data.deleted}" deleted permanently` : label);
    load();
  }

  async function makeAdminFlow(u: U) {
    // Dickson's requirement: primary admin SELECTS the level when promoting
    const level = prompt(
      `Promote ${u.username} (${u.fullName}) to administrator.\n\n` +
      `Choose the access level — type one of:\n` +
      `VIEWER — can only view records and export reports (read-only)\n` +
      `EDITOR — full register powers: create, edit, pay, delete records\n` +
      `FULL — everything including staff management\n\n` +
      `Enter VIEWER, EDITOR or FULL:`
    );
    if (!level) return;
    const normalized = level.trim().toUpperCase();
    if (!["VIEWER", "EDITOR", "FULL"].includes(normalized)) {
      setErr("Invalid level — enter VIEWER, EDITOR or FULL");
      return;
    }
    await act(u, "makeAdmin", `${u.username} promoted to ${normalized} administrator`, { adminLevel: normalized });
  }

  async function changeLevelFlow(u: U) {
    const level = prompt(
      `Change admin level for ${u.username}.\n\nEnter VIEWER, EDITOR or FULL:`
    );
    if (!level) return;
    const normalized = level.trim().toUpperCase();
    if (!["VIEWER", "EDITOR", "FULL"].includes(normalized)) {
      setErr("Invalid level — enter VIEWER, EDITOR or FULL");
      return;
    }
    await act(u, "setAdminLevel", `${u.username} is now a ${normalized} administrator`, { adminLevel: normalized });
  }

  const pending = users.filter((u) => !u.active);
  const active = users.filter((u) => u.active);

  function StatusBadge({ u }: { u: U }) {
    return u.active
      ? <span className="badge paid">ACTIVE</span>
      : <span className="badge unpaid">AWAITING APPROVAL</span>;
  }

  function Buttons({ u }: { u: U }) {
    if (u.username === "admin")
      return <span style={{ color: "var(--muted)", fontSize: 12 }}>(primary admin — full access)</span>;
    return (
      <div className="row-actions">
        {!u.active && (
          <>
            <button className="btn btn-green btn-sm" disabled={busyId === u.id}
              onClick={() => act(u, "approve", `${u.username} approved — they can now sign in`)}>
              Approve
            </button>
            <button className="btn btn-ghost btn-sm" disabled={busyId === u.id}
              onClick={() => act(u, "reject", `${u.username} rejected and disabled`)}>
              Reject
            </button>
          </>
        )}
        {u.active && u.role === "STAFF" && (
          <button className="btn btn-ghost btn-sm" disabled={busyId === u.id}
            onClick={() => makeAdminFlow(u)}>
            Make Admin
          </button>
        )}
        {u.active && u.role === "ADMIN" && (
          <button className="btn btn-ghost btn-sm" disabled={busyId === u.id}
            onClick={() => changeLevelFlow(u)}>
            Change Level
          </button>
        )}
        {u.active && u.role === "ADMIN" && (
          <button className="btn btn-ghost btn-sm" disabled={busyId === u.id}
            onClick={() => act(u, "demoteToStaff", `${u.username} returned to staff`)}>
            Demote to Staff
          </button>
        )}
        {u.active && u.role !== "ADMIN" && (
          <button className="btn btn-ghost btn-sm" disabled={busyId === u.id}
            onClick={() => act(u, "deactivate", `${u.username} deactivated`)}>
            Deactivate
          </button>
        )}
        {!u.active && u.role === "STAFF" && users.length > 1 && (
          <button className="btn btn-ghost btn-sm" disabled={busyId === u.id}
            onClick={() => act(u, "reactivate", `${u.username} reactivated`)}>
            Reactivate
          </button>
        )}
        <button className="btn btn-danger btn-sm" disabled={busyId === u.id}
          onClick={() => act(u, "delete", `${u.username} deleted`)}>
          Delete
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <h2>Staff Accounts</h2>
        <p className="sub">
          Staff register themselves at <code>/register</code>; you approve them here before they can sign in and enter data.
          All accounts: {users.length} · Pending: {pending.length}
        </p>

        {msg && <div className="ok-msg">{msg}</div>}
        {err && <div className="err">{err}</div>}

        {pending.length > 0 && (
          <div className="ok-msg" style={{ background: "var(--amber-soft)", borderColor: "#fde68a", color: "var(--amber)" }}>
            <b>{pending.length} registration{pending.length === 1 ? "" : "s"} awaiting approval</b>
          </div>
        )}

        {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}

        {/* Desktop/tablet: table view */}
        <div className="tbl-wrap only-desktop">
          <table className="tbl">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Records</th>
                <th>Registered</th>
                <th className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...pending, ...active].map((u) => (
                <tr key={u.id} style={!u.active ? { background: "#fffbeb" } : undefined}>
                  <td className="serial">{u.username}</td>
                  <td>{u.fullName}</td>
                  <td><RoleLabel u={u} /></td>
                  <td><StatusBadge u={u} /></td>
                  <td className="num">{u.recordsCreated}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString("en-GB")}</td>
                  <td className="no-print"><Buttons u={u} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phones: stacked cards */}
        <div className="only-mobile">
          {[...pending, ...active].map((u) => (
            <div key={u.id} className="user-card" style={!u.active ? { background: "#fffbeb" } : undefined}>
              <div className="user-card-head">
                <div>
                  <div className="serial" style={{ fontSize: 14 }}>{u.username}</div>
                  <div style={{ fontWeight: 600 }}>{u.fullName}</div>
                </div>
                <StatusBadge u={u} />
              </div>
              <div className="user-card-meta">
                {u.role === "ADMIN" ? (u.adminLevel === "VIEWER" ? "Viewer Admin" : u.adminLevel === "EDITOR" ? "Editor Admin" : "Full Admin") : "Staff"} · {u.recordsCreated} record{u.recordsCreated === 1 ? "" : "s"} created · joined {new Date(u.createdAt).toLocaleDateString("en-GB")}
              </div>
              <Buttons u={u} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <Link href="/" className="btn btn-ghost">Back to Register</Link>
        </div>
      </div>
    </>
  );
}