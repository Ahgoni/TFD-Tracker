import { NextResponse } from "next/server";
import {
  NEXON_DESCENDANT_JSON,
  NEXON_MODULE_JSON,
  NEXON_WEAPON_JSON,
  transformDescendantsFromNexon,
  transformModulesFromNexon,
  transformWeaponsFromNexon,
} from "@/lib/nexon-catalog-transform";

/**
 * Live Nexon Open API → same JSON shapes as /data/{descendants,weapons,modules}.json
 * (matches https://tfd.nexon.com/en/library/*). Cached server-side; client falls back to static files if unavailable.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;

  const config = {
    descendants: {
      url: NEXON_DESCENDANT_JSON,
      transform: transformDescendantsFromNexon,
    },
    weapons: {
      url: NEXON_WEAPON_JSON,
      transform: transformWeaponsFromNexon,
    },
    modules: {
      url: NEXON_MODULE_JSON,
      transform: transformModulesFromNexon,
    },
  } as const;

  const entry = config[kind as keyof typeof config];
  if (!entry) {
    return NextResponse.json({ error: "unknown_kind", allowed: ["descendants", "weapons", "modules"] }, { status: 400 });
  }

  try {
    const res = await fetch(entry.url, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "nexon_http", status: res.status },
        { status: 502 },
      );
    }
    const raw = await res.json();
    const data = entry.transform(raw);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch_failed";
    return NextResponse.json({ error: "nexon_unreachable", message }, { status: 502 });
  }
}
