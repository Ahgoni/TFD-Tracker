import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import type { MarketListing } from "@/lib/market-scraper";

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE_ANCESTOR = path.join(CACHE_DIR, "market-ancestor.json");
const CACHE_FILE_TRIGGER = path.join(CACHE_DIR, "market-trigger.json");
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

interface CachedData {
  ts: number;
  listings: MarketListing[];
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function readCache(tab: "ancestor" | "trigger"): CachedData | null {
  const file = tab === "ancestor" ? CACHE_FILE_ANCESTOR : CACHE_FILE_TRIGGER;
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf-8");
    const data = JSON.parse(raw) as CachedData;
    if (Date.now() - data.ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(tab: "ancestor" | "trigger", listings: MarketListing[]) {
  ensureCacheDir();
  const file = tab === "ancestor" ? CACHE_FILE_ANCESTOR : CACHE_FILE_TRIGGER;
  fs.writeFileSync(file, JSON.stringify({ ts: Date.now(), listings }), "utf-8");
}

let scraping = false;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tab = (url.searchParams.get("tab") === "trigger" ? "trigger" : "ancestor") as "ancestor" | "trigger";

  const cached = readCache(tab);
  if (cached) {
    return NextResponse.json({
      listings: cached.listings,
      cached: true,
      age: Math.round((Date.now() - cached.ts) / 1000),
    });
  }

  if (scraping) {
    return NextResponse.json({ listings: [], cached: false, scraping: true, message: "Scrape in progress, try again in a few seconds." });
  }

  scraping = true;
  try {
    const { scrapeMarketListings } = await import("@/lib/market-scraper");
    const listings = await scrapeMarketListings(tab);
    if (listings.length > 0) {
      writeCache(tab, listings);
    }
    return NextResponse.json({ listings, cached: false, age: 0 });
  } catch (err) {
    console.error("[/api/market] scrape error:", err);
    return NextResponse.json({ listings: [], error: "Scrape failed" }, { status: 500 });
  } finally {
    scraping = false;
  }
}
