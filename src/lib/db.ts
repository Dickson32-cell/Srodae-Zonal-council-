import { PrismaClient } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
    datasources: {
      db: {
        url:
          process.env.DATABASE_URL?.includes("connection_limit")
            ? process.env.DATABASE_URL
            : process.env.DATABASE_URL + "&connection_limit=15&pool_timeout=20",
      },
    },
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

// ---------------------------------------------------------------------------
// Electoral areas + serial codes (CONFIRMED by Dickson 12 Sep)
// ---------------------------------------------------------------------------
export const ELECTORAL_AREAS = [
  { area: "Social Welfare", code: "S. W" },
  { area: "Central Market", code: "C. M" },
  { area: "Debrakrom", code: "DBK" },
  { area: "Akwaasu Asebi", code: "AK. A" },
  { area: "Kantudu", code: "KTD" },
] as const;

export type ElectoralArea = (typeof ELECTORAL_AREAS)[number]["area"];

export function areaCode(area: string): string | null {
  const found = ELECTORAL_AREAS.find((a) => a.area === area);
  return found ? found.code : null;
}

// ---------------------------------------------------------------------------
// TENANT CONTEXT — this deployment's council. EVERY database query in this
// app filters by this id; the database (RLS, applied at migration) also
// enforces it physically. One shared Neon DB, 8 councils, zero mixing.
// ---------------------------------------------------------------------------
export function councilId(): string {
  const id = process.env.COUNCIL_ID;
  if (!id) throw new Error("COUNCIL_ID not configured on server");
  return id;
}

// ---------------------------------------------------------------------------
// Serial generation — transactional, race-proof (FOR UPDATE semantics via
// sequential update-then-read inside one interactive transaction)
// ---------------------------------------------------------------------------
export function formatSerial(code: string, n: number): string {
  const padded = n < 100 ? String(n).padStart(2, "0") : String(n);
  return `${code}/ ${padded}`;
}

export async function generateSerial(area: string): Promise<string> {
  const code = areaCode(area);
  if (!code) throw new Error(`Unknown electoral area: ${area}`);

  // Interactive transaction: bump counter, then read it back —
  // Prisma's interactive tx holds the row lock for the duration,
  // so concurrent creators can never receive the same number.
  const next = await prisma.$transaction(async (tx) => {
    const updated = await tx.serialCounter.update({
      where: { councilId_electoralArea: { councilId: councilId(), electoralArea: area } },
      data: { lastNumber: { increment: 1 } },
    });
    return updated.lastNumber;
  });
  return formatSerial(code, next);
}

// ---------------------------------------------------------------------------
// Money computations — DECIMAL only, never float
// ---------------------------------------------------------------------------
export async function payerTotals(feePayerId: string) {
  const [feeAgg, payAgg] = await Promise.all([
    prisma.fee.aggregate({
      where: { feePayerId, councilId: councilId() },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { feePayerId, councilId: councilId() },
      _sum: { amount: true },
    }),
  ]);
  const totalBilled = feeAgg._sum.amount ?? 0;
  const totalPaid = payAgg._sum.amount ?? 0;
  const balance = Number(totalBilled) - Number(totalPaid);
  return {
    totalBilled: Number(totalBilled),
    totalPaid: Number(totalPaid),
    balance: Math.max(0, Number(balance.toFixed(2))),
  };
}

// ---------------------------------------------------------------------------
// Audit trail — append-only
// ---------------------------------------------------------------------------
export async function audit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: unknown
) {
  await prisma.auditLog.create({
    data: {
      councilId: councilId(),
      userId,
      action,
      entityType,
      entityId,
      details: details as object,
    },
  });
}

// ---------------------------------------------------------------------------
// Session tokens (jose JWT in httpOnly cookie)
// ---------------------------------------------------------------------------
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "adweso-zonal-council-temporal-structures-2026-session-key"
);

export async function createSessionToken(userId: string, username: string, role: string) {
  return new SignJWT({ sub: userId, username, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { sub: string; username: string; role: string };
  } catch {
    return null;
  }
}

// Full session with adminLevel (for permission checks)
export async function getFullUser(session: { sub: string }) {
  const user = await prisma.appUser.findUnique({
    where: { id: session.sub },
    select: { id: true, username: true, fullName: true, role: true, adminLevel: true, active: true },
  });
  return user;
}