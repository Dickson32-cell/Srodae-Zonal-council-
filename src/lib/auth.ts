// Auth helper — reads the session from the httpOnly cookie on every request
import { cookies } from "next/headers";
import { verifySessionToken } from "./db";

export const SESSION_COOKIE = "adweso_session";

export async function getSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}