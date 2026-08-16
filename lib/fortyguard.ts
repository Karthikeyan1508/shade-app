/**
 * FortyGuard client — THE PLACEHOLDER PIECE.
 *
 * Until FORTYGUARD_API_KEY is set in .env.local, every call here transparently
 * falls back to Open-Meteo (free, no key) so the rest of the app is fully
 * functional today. Once hackathon registration gives you a real key + real
 * endpoint docs:
 *   1. Set FORTYGUARD_API_KEY in .env.local
 *   2. Fill in FORTYGUARD_BASE_URL and the two TODOs below with the real
 *      endpoint paths / response shape from FortyGuard's docs
 *   3. Nothing else in the app needs to change — everyone downstream
 *      (risk-engine, agent, API routes) only depends on the Conditions
 *      shape returned here, not on where it came from.
 */

import { fetchCurrent, fetchForecast, RawConditions } from "./openmeteo";

const FORTYGUARD_API_KEY = process.env.FORTYGUARD_API_KEY;
const FORTYGUARD_BASE_URL = process.env.FORTYGUARD_BASE_URL || "https://api.fortyguard.com"; // TODO: confirm real base URL

export interface SiteConditions extends RawConditions {
  sunExposed: boolean; // derived from our own seed data today; FortyGuard surface
  // segmentation (Pro tier) can replace this once available — see TODO below.
}

// Simple in-memory cache so repeated demo runs / page refreshes don't burn
// API credits (real or free-tier) unnecessarily. Keyed to the current hour.
const cache = new Map<string, { expires: number; data: unknown }>();
function cacheKey(kind: string, lat: number, lng: number) {
  const bucket = new Date().toISOString().slice(0, 13); // hour-granularity bucket
  return `${kind}:${lat.toFixed(3)}:${lng.toFixed(3)}:${bucket}`;
}

function hasFortyGuardKey(): boolean {
  return Boolean(FORTYGUARD_API_KEY && FORTYGUARD_API_KEY !== "your_key_here");
}

async function fortyGuardCurrent(lat: number, lng: number): Promise<RawConditions> {
  // TODO(post-registration): replace with FortyGuard's real current-conditions
  // endpoint + response parsing once docs are available, e.g.:
  //   GET `${FORTYGUARD_BASE_URL}/v1/temperature/current?lat=${lat}&lng=${lng}`
  //   headers: { Authorization: `Bearer ${FORTYGUARD_API_KEY}` }
  const res = await fetch(
    `${FORTYGUARD_BASE_URL}/v1/temperature/current?lat=${lat}&lng=${lng}`,
    { headers: { Authorization: `Bearer ${FORTYGUARD_API_KEY}` } }
  );
  if (!res.ok) throw new Error(`FortyGuard current fetch failed: ${res.status}`);
  const json = await res.json();
  // TODO: map FortyGuard's real field names once known — this is a guess.
  return {
    tempC: json.temperature_c,
    rhPct: json.humidity_pct,
    windKph: json.wind_kph,
    solarWm2: json.solar_wm2 ?? 0,
    source: "open-meteo", // placeholder tag until real source constant added
    ts: json.timestamp,
  };
}

/** Get current conditions for a site. Uses FortyGuard if configured, else Open-Meteo. */
export async function getCurrentConditions(
  lat: number,
  lng: number,
  opts: { sunExposed?: boolean } = {}
): Promise<SiteConditions> {
  const key = cacheKey("current", lat, lng);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data as SiteConditions;

  const raw = hasFortyGuardKey() ? await fortyGuardCurrent(lat, lng) : await fetchCurrent(lat, lng);
  const data: SiteConditions = { ...raw, sunExposed: opts.sunExposed ?? true };
  cache.set(key, { expires: Date.now() + 10 * 60 * 1000, data });
  return data;
}

/** Get an hourly forecast for a site. Uses FortyGuard if configured, else Open-Meteo. */
export async function getForecast(
  lat: number,
  lng: number,
  hours = 48,
  opts: { sunExposed?: boolean } = {}
): Promise<SiteConditions[]> {
  const key = cacheKey(`forecast${hours}`, lat, lng);
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data as SiteConditions[];

  // TODO(post-registration): swap in FortyGuard's forecast endpoint the same
  // way getCurrentConditions() does above once docs are available.
  const raw = await fetchForecast(lat, lng, hours);
  const data = raw.map((r) => ({ ...r, sunExposed: opts.sunExposed ?? true }));
  cache.set(key, { expires: Date.now() + 30 * 60 * 1000, data });
  return data;
}

/** Whether we're currently running on real FortyGuard data or the free fallback. */
export function dataSourceLabel(): "FortyGuard" | "Open-Meteo (fallback)" {
  return hasFortyGuardKey() ? "FortyGuard" : "Open-Meteo (fallback)";
}
