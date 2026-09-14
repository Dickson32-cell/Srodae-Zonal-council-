// Admin page — manage staff accounts: approve registrations, deactivate, promote, delete.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFullUser } from "@/lib/db";
import { permsFor } from "@/lib/perms";
import TopBar from "@/app/TopBar";
import UserAdmin from "./UserAdmin";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canManageUsers) redirect("/");

  return (
    <div className="shell">
      <TopBar username={me.username} role={me.role} canReviewPasswords={permsFor(me.role, me.adminLevel).canReviewPasswords} />
      <main className="main">
        <UserAdmin />
      </main>
    </div>
  );
}