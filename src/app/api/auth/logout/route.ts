import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { destroySession, getSessionUser } from "@/lib/auth";

export async function POST() {
  const user = await getSessionUser();
  await destroySession();
  if (user) await audit(user, { action: "LOGOUT", entityType: "user", entityId: user.id, summary: "Signed out" });
  return NextResponse.json({ ok: true });
}
