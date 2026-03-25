import puppeteer from "puppeteer";

const NEXON_MARKET_URL = "https://tfd.nexon.com/en/market";
const PRODUCTS_URL_PATTERN = "tfd-api.nexon.com/api/trademarket/en/products";

export interface MarketListing {
  moduleId: string;
  moduleName: string;
  moduleImage: string;
  descendantName: string;
  socketType: string;
  tier: string;
  sellerName: string;
  sellerMasteryRank: number;
  requiredMasteryRank: number;
  rerollCount: number;
  price: number;
  priceUnit: string;
  platform: string;
  listedAt: string;
  options: MarketOption[];
  tabType: "ancestor" | "trigger";
}

export interface MarketOption {
  name: string;
  value: string;
  isPenalty: boolean;
  minMax?: string;
}

interface NexonProductItem {
  module_id?: string;
  module_name?: string;
  module_img?: string;
  descendant_name?: string;
  socket_type?: string;
  tier?: string;
  seller_name?: string;
  seller_mastery_rank?: number;
  required_mastery_rank?: number;
  reroll_count?: number;
  price?: number;
  price_unit?: string;
  platform?: string;
  listed_at?: string;
  options?: Array<{
    option_name?: string;
    option_value?: string;
    is_penalty?: boolean;
    min_max?: string;
  }>;
  [key: string]: unknown;
}

function parseListingsFromResponse(
  data: unknown,
  tabType: "ancestor" | "trigger",
): MarketListing[] {
  if (!data || typeof data !== "object") return [];

  const items: NexonProductItem[] = [];

  if (Array.isArray(data)) {
    items.push(...data);
  } else {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.list)) items.push(...obj.list);
    else if (Array.isArray(obj.products)) items.push(...obj.products);
    else if (Array.isArray(obj.data)) items.push(...obj.data);
    else if (Array.isArray(obj.items)) items.push(...obj.items);
    else {
      for (const key of Object.keys(obj)) {
        if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
          items.push(...(obj[key] as NexonProductItem[]));
          break;
        }
      }
    }
  }

  return items.map((item) => ({
    moduleId: String(item.module_id ?? item.moduleId ?? ""),
    moduleName: String(
      item.module_name ?? item.moduleName ?? item.name ?? "",
    ),
    moduleImage: String(
      item.module_img ?? item.moduleImage ?? item.image ?? "",
    ),
    descendantName: String(
      item.descendant_name ?? item.descendantName ?? "",
    ),
    socketType: String(item.socket_type ?? item.socketType ?? ""),
    tier: String(item.tier ?? ""),
    sellerName: String(item.seller_name ?? item.sellerName ?? ""),
    sellerMasteryRank: Number(
      item.seller_mastery_rank ?? item.sellerMasteryRank ?? 0,
    ),
    requiredMasteryRank: Number(
      item.required_mastery_rank ?? item.requiredMasteryRank ?? 0,
    ),
    rerollCount: Number(item.reroll_count ?? item.rerollCount ?? 0),
    price: Number(item.price ?? 0),
    priceUnit: String(item.price_unit ?? item.priceUnit ?? "Caliber"),
    platform: String(item.platform ?? ""),
    listedAt: String(item.listed_at ?? item.listedAt ?? ""),
    options: (item.options ?? []).map((o) => ({
      name: String(o.option_name ?? ""),
      value: String(o.option_value ?? ""),
      isPenalty: Boolean(o.is_penalty ?? false),
      minMax: o.min_max ?? undefined,
    })),
    tabType,
  }));
}

export async function scrapeMarketListings(
  tab: "ancestor" | "trigger" = "ancestor",
): Promise<MarketListing[]> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    );

    let capturedData: unknown = null;

    await page.setRequestInterception(true);
    page.on("request", (req) => req.continue());
    page.on("response", async (res) => {
      if (res.url().includes(PRODUCTS_URL_PATTERN) && res.status() === 200) {
        try {
          capturedData = await res.json();
        } catch {
          /* not JSON */
        }
      }
    });

    await page.goto(NEXON_MARKET_URL, { waitUntil: "networkidle2", timeout: 30000 });

    if (tab === "trigger") {
      const triggerBtn = await page.$('li:has-text("Trigger"), [data-tab="trigger"]');
      if (triggerBtn) {
        capturedData = null;
        await triggerBtn.click();
        await page.waitForNetworkIdle({ timeout: 10000 }).catch(() => {});
      }
    }

    await new Promise((r) => setTimeout(r, 3000));

    if (capturedData) {
      return parseListingsFromResponse(capturedData, tab);
    }

    return [];
  } catch (err) {
    console.error("[market-scraper] Error:", err);
    return [];
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
