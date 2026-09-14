// Admin page — review pending edits with before/after comparison
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFullUser } from "@/lib/db";
import { permsFor } from "@/lib/perms";
import TopBar from "@/app/TopBar";
import EditsAdmin from "./EditsAdmin";

export default async function AdminEditsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const me = await getFullUser(session);
  if (!me || !permsFor(me.role, me.adminLevel).canReviewEdits) redirect("/");

  return (
    <div className="shell">
      <TopBar username={me.username} role={me.role} canReviewPasswords={permsFor(me.role, me.adminLevel).canReviewPasswords} />
      <main className="main">
        <EditsAdmin />
      </main>
    </div>
  );
}