// Admin page — review password change requests
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFullUser } from "@/lib/db";
import { permsFor } from "@/lib/perms";
import TopBar from "@/app/TopBar";
import PasswordAdmin from "./PasswordAdmin";

export default async function AdminPasswordsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canReviewPasswords) redirect("/");

  return (
    <div className="shell">
      <TopBar username={me.username} role={me.role} />
      <main className="main">
        <PasswordAdmin />
      </main>
    </div>
  );
}