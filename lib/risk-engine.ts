/**
 * Risk Engine — pure functions, no I/O, fully unit-testable.
 *
 * IMPORTANT HONEST CAVEAT: wbgtApprox() is a decision-support approximation
 * (Australian Bureau of Meteorology simplified outdoor WBGT formula), not a
 * reading from a physical globe thermometer. It's good enough to drive
 * scheduling decisions and is a reasonable stand-in until FortyGuard's real
 * environmental parameters (or an on-site sensor) are available to calibrate
 * against. Don't present it as a certified safety-compliance instrument.
 */

import jurisdictions from "@/config/jurisdictions.json";

export type RiskTier = "Safe" | "Caution" | "Warning" | "Danger" | "Extreme";

export interface Conditions {
  tempC: number;
  rhPct: number; // relative humidity 0-100
  windKph?: number;
  solarWm2?: number;
  sunExposed?: boolean; // true if site surface is unshaded asphalt/concrete etc.
}

/** Celsius -> Fahrenheit */
export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

/**
 * NWS Rothfusz regression heat index, in °F.
 * Matches the metric OSHA's proposed 80°F / 90°F thresholds use.
 * Falls back to plain air temp below 80°F where the regression isn't valid.
 */
export function heatIndexF(tempF: number, rhPct: number): number {
  if (tempF < 80) return tempF;
  const T = tempF;
  const R = rhPct;
  let hi =
    -42.379 +
    2.04901523 * T +
    10.14333127 * R -
    0.22475541 * T * R -
    0.00683783 * T * T -
    0.05481717 * R * R +
    0.00122874 * T * T * R +
    0.00085282 * T * R * R -
    0.00000199 * T * T * R * R;

  // Standard low-humidity / high-humidity adjustments from the NWS spec
  if (R < 13 && T >= 80 && T <= 112) {
    hi -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  } else if (R > 85 && T >= 80 && T <= 87) {
    hi += ((R - 85) / 10) * ((87 - T) / 5);
  }
  return hi;
}

/**
 * Simplified outdoor WBGT (°C) — Australian Bureau of Meteorology approximation.
 * WBGT ~= 0.567*Ta + 0.393*e + 3.94, where e is water vapor pressure (hPa) from
 * relative humidity via Tetens' formula. A heuristic bump is added for
 * unshaded/high-solar-load sites (a stand-in for full solar-radiation input
 * until FortyGuard's satellite/street-view surface segmentation is wired in).
 *
 * KNOWN PROPERTY, not a bug: this approximation runs a few degrees warmer
 * than a "textbook" ISO 7243 WBGT reading at high heat + high humidity,
 * especially with the sunExposed bump added on top. That's fine for a
 * hackathon decision-support tool as long as the tier thresholds in
 * config/jurisdictions.json are tuned against THIS formula's real output
 * (e.g. by feeding it known hot days for your demo sites and checking the
 * tier lands where you'd expect), not copied verbatim from a published WBGT
 * action-limit table that assumes a physically measured reading.
 */
export function wbgtApprox(tempC: number, rhPct: number, opts: { sunExposed?: boolean } = {}): number {
  const e = (rhPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  let wbgt = 0.567 * tempC + 0.393 * e + 3.94;
  if (opts.sunExposed) wbgt += 2.5;
  return wbgt;
}

interface TierRule {
  min: number;
  tier: RiskTier;
}

interface JurisdictionConfig {
  label: string;
  metric: "heat_index_f" | "wbgt_c";
  tiers: TierRule[];
  fixedWindow?: {
    startMonthDay: string;
    endMonthDay: string;
    startTime: string;
    endTime: string;
    note: string;
  };
}

const RULES = jurisdictions as unknown as Record<string, JurisdictionConfig>;

/** Given a value and a tier ladder (ascending by `min`), find the highest tier crossed. */
function tierFromLadder(value: number, tiers: TierRule[]): RiskTier {
  let result: RiskTier = "Safe";
  for (const rule of [...tiers].sort((a, b) => a.min - b.min)) {
    if (value >= rule.min) result = rule.tier;
  }
  return result;
}

export interface RiskResult {
  jurisdiction: string;
  metric: string;
  value: number;
  tier: RiskTier;
  inFixedBanWindow: boolean;
}

/**
 * Classify current conditions against a named jurisdiction ruleset.
 * `at` defaults to now; pass a specific Date for forecast points.
 */
export function classifyRisk(
  conditions: Conditions,
  jurisdictionKey: string,
  at: Date = new Date()
): RiskResult {
  const config = RULES[jurisdictionKey] ?? RULES.CUSTOM_WBGT;

  let value: number;
  if (config.metric === "heat_index_f") {
    value = heatIndexF(cToF(conditions.tempC), conditions.rhPct);
  } else {
    value = wbgtApprox(conditions.tempC, conditions.rhPct, { sunExposed: conditions.sunExposed });
  }

  const tier = tierFromLadder(value, config.tiers);
  const inFixedBanWindow = config.fixedWindow ? isWithinFixedWindow(at, config.fixedWindow) : false;

  return {
    jurisdiction: jurisdictionKey,
    metric: config.metric,
    value: Math.round(value * 10) / 10,
    tier: inFixedBanWindow && tier !== "Extreme" ? "Danger" : tier,
    inFixedBanWindow,
  };
}

function isWithinFixedWindow(
  at: Date,
  window: { startMonthDay: string; endMonthDay: string; startTime: string; endTime: string }
): boolean {
  const md = `${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
  const inSeason = md >= window.startMonthDay && md <= window.endMonthDay;
  if (!inSeason) return false;
  const hm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  return hm >= window.startTime && hm <= window.endTime;
}

export const TIER_COLORS: Record<RiskTier, string> = {
  Safe: "#2E7D32",
  Caution: "#F4C430",
  Warning: "#F2994A",
  Danger: "#E2492D",
  Extreme: "#8B1E1E",
};
