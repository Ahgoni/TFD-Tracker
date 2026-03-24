import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/require-user";
import { isTierListMod } from "@/lib/tier-list-mod";

/** Confirms the signed-in user may use mod tier-list tools. Others never see the panel. */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isTierListMod(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
