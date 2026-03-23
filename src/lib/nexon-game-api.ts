/**
 * Nexon **game** Open API (authenticated) — not the public static meta JSON.
 * Base: https://open.api.nexon.com/tfd/v1/...
 * Header: x-nxopen-api-key (see https://openapi.nexon.com/guide/request-api)
 *
 * **Never** import this from client components — API key is server-only.
 */

export const NEXON_GAME_API_BASE = "https://open.api.nexon.com";

export function getNexonOpenApiKey(): string | null {
  const k = process.env.NEXON_OPEN_API_KEY?.trim();
  return k || null;
}

/** Nexon NOTICE: refresh data pulled from Open API at least every 30 days. */
export const NEXON_COMPLIANCE_REFRESH_DAYS = 30;

export async function nexonTfdGet(
  path: string,
  params: Record<string, string>,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const key = getNexonOpenApiKey();
  if (!key) {
    return { ok: false, status: 503, json: { error: { message: "NEXON_OPEN_API_KEY not configured" } } };
  }
  const url = new URL(`${NEXON_GAME_API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-nxopen-api-key": key,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({ error: { message: "Invalid JSON from Nexon" } }))) as unknown;
  return { ok: res.ok, status: res.status, json };
}

/** Resolve in-game account name → OUID (`GET /tfd/v1/id`). */
export async function nexonGetOuidByUserName(userName: string) {
  return nexonTfdGet("/tfd/v1/id", { user_name: userName.trim() });
}

export async function nexonGetUserBasic(ouid: string) {
  return nexonTfdGet("/tfd/v1/user/basic", { ouid: ouid.trim() });
}

export async function nexonGetUserDescendant(ouid: string) {
  return nexonTfdGet("/tfd/v1/user/descendant", { ouid: ouid.trim() });
}

export async function nexonGetUserWeapon(ouid: string, languageCode = "en") {
  return nexonTfdGet("/tfd/v1/user/weapon", { ouid: ouid.trim(), language_code: languageCode });
}

export async function nexonGetUserReactor(ouid: string, languageCode = "en") {
  return nexonTfdGet("/tfd/v1/user/reactor", { ouid: ouid.trim(), language_code: languageCode });
}

export async function nexonGetUserExternalComponent(ouid: string, languageCode = "en") {
  return nexonTfdGet("/tfd/v1/user/external-component", { ouid: ouid.trim(), language_code: languageCode });
}

/** Best-effort OUID extraction from /tfd/v1/id response (Nexon shape may vary). */
export function extractOuidFromIdResponse(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.ouid === "string" && o.ouid.length > 0) return o.ouid;
  const id = o.id;
  if (id && typeof id === "object") {
    const ido = id as Record<string, unknown>;
    if (typeof ido.ouid === "string" && ido.ouid.length > 0) return ido.ouid;
  }
  return null;
}
