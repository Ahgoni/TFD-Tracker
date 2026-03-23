import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { NEXON_COMPLIANCE_REFRESH_DAYS } from "@/lib/nexon-game-api";

/** Public: Nexon 30-day notice + local last-pull timestamps (no secrets). */
export async function GET() {
  try {
    const p = join(process.cwd(), "public", "data", "nexon-compliance.json");
    const raw = await readFile(p, "utf-8");
    const data = JSON.parse(raw) as {
      lastStaticMetadataPullAt?: string | null;
      lastStatsPullAt?: string | null;
      notice?: string;
      canonicalLibraryBase?: string;
    };
    const now = Date.now();
    const msPerDay = 864e5;
    const daysSince = (iso: string | null | undefined): number | null => {
      if (!iso) return null;
      const t = new Date(iso).getTime();
      if (Number.isNaN(t)) return null;
      return Math.floor((now - t) / msPerDay);
    };
    const metaDays = daysSince(data.lastStaticMetadataPullAt ?? null);
    const statsDays = daysSince(data.lastStatsPullAt ?? null);
    const overdue = (d: number | null) => d !== null && d > NEXON_COMPLIANCE_REFRESH_DAYS;

    return NextResponse.json({
      ...data,
      daysSinceStaticMetadataPull: metaDays,
      daysSinceStatsPull: statsDays,
      metadataOverdue: overdue(metaDays),
      statsOverdue: overdue(statsDays),
      refreshWithinDays: NEXON_COMPLIANCE_REFRESH_DAYS,
      libraryUrls: {
        descendants: "https://tfd.nexon.com/en/library/descendants",
        weapons: "https://tfd.nexon.com/en/library/weapons",
        modules: "https://tfd.nexon.com/en/library/modules",
        components: "https://tfd.nexon.com/en/library/components",
        enhancements: "https://tfd.nexon.com/en/library/enhancements",
        consumable: "https://tfd.nexon.com/en/library/consumable",
      },
    });
  } catch {
    return NextResponse.json({ error: "compliance_file_unreadable" }, { status: 500 });
  }
}
