import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/require-user";
import {
  extractOuidFromIdResponse,
  getNexonOpenApiKey,
  nexonGetOuidByUserName,
  nexonGetUserBasic,
  nexonGetUserDescendant,
  nexonGetUserExternalComponent,
  nexonGetUserReactor,
  nexonGetUserWeapon,
} from "@/lib/nexon-game-api";

/**
 * Authenticated proxy to Nexon TFD game API (player profile).
 * GET /api/nexon/player?user_name=... OR ?ouid=...
 * &include=basic,descendant,weapon,reactor,external (comma-separated; default basic)
 * &language_code=en
 *
 * Requires NEXON_OPEN_API_KEY server-side. Key is never returned to the client.
 */
export async function GET(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!getNexonOpenApiKey()) {
    return NextResponse.json(
      {
        error: "nexon_key_missing",
        message:
          "Add NEXON_OPEN_API_KEY to your server .env (from https://openapi.nexon.com). Never commit the key.",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const userName = searchParams.get("user_name")?.trim();
  const ouidParam = searchParams.get("ouid")?.trim();
  const includeRaw = searchParams.get("include")?.trim() ?? "basic";
  const include = includeRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const lang = searchParams.get("language_code")?.trim() || "en";

  if (!userName && !ouidParam) {
    return NextResponse.json({ error: "Provide user_name or ouid query parameter." }, { status: 400 });
  }

  let ouid = ouidParam ?? "";

  if (!ouid && userName) {
    const idRes = await nexonGetOuidByUserName(userName);
    if (!idRes.ok) {
      return NextResponse.json(idRes.json, { status: idRes.status === 503 ? 503 : idRes.status });
    }
    const resolved = extractOuidFromIdResponse(idRes.json);
    if (!resolved) {
      return NextResponse.json(
        {
          error: "ouid_not_found",
          message: "Nexon did not return an OUID for this name (check spelling / privacy).",
          nexon: idRes.json,
        },
        { status: 422 },
      );
    }
    ouid = resolved;
  }

  const out: Record<string, unknown> = {
    ouid,
    query: userName ? { user_name: userName } : { ouid: ouidParam },
  };

  const parts = include.includes("all")
    ? ["basic", "descendant", "weapon", "reactor", "external-component"]
    : include;

  if (parts.includes("basic")) {
    const r = await nexonGetUserBasic(ouid);
    out.basic = r.json;
    out._basicStatus = r.status;
  }
  if (parts.includes("descendant")) {
    const r = await nexonGetUserDescendant(ouid);
    out.descendant = r.json;
    out._descendantStatus = r.status;
  }
  if (parts.includes("weapon")) {
    const r = await nexonGetUserWeapon(ouid, lang);
    out.weapon = r.json;
    out._weaponStatus = r.status;
  }
  if (parts.includes("reactor")) {
    const r = await nexonGetUserReactor(ouid, lang);
    out.reactor = r.json;
    out._reactorStatus = r.status;
  }
  if (parts.includes("external-component") || parts.includes("external")) {
    const r = await nexonGetUserExternalComponent(ouid, lang);
    out.externalComponent = r.json;
    out._externalComponentStatus = r.status;
  }

  return NextResponse.json(out);
}
