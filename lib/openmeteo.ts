/**
 * Open-Meteo client — 100% free, no API key, no signup, no rate-limit surprises.
 * Used as the live data source until FORTYGUARD_API_KEY is set, and as a
 * permanent fallback for parameters FortyGuard's trial tier might not expose.
 * Docs: https://open-meteo.com/en/docs
 */

export interface RawConditions {
  tempC: number;
  rhPct: number;
  windKph: number;
  solarWm2: number;
  source: "open-meteo";
  ts: string;
}

export async function fetchCurrent(lat: number, lng: number): Promise<RawConditions> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Open-Meteo current fetch failed: ${res.status}`);
  const json = await res.json();
  const c = json.current;
  return {
    tempC: c.temperature_2m,
    rhPct: c.relative_humidity_2m,
    windKph: c.wind_speed_10m,
    solarWm2: c.shortwave_radiation ?? 0,
    source: "open-meteo",
    ts: c.time,
  };
}

export async function fetchForecast(lat: number, lng: number, hours = 48): Promise<RawConditions[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation&forecast_days=3`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Open-Meteo forecast fetch failed: ${res.status}`);
  const json = await res.json();
  const h = json.hourly;
  const points: RawConditions[] = [];
  for (let i = 0; i < Math.min(hours, h.time.length); i++) {
    points.push({
      tempC: h.temperature_2m[i],
      rhPct: h.relative_humidity_2m[i],
      windKph: h.wind_speed_10m[i],
      solarWm2: h.shortwave_radiation?.[i] ?? 0,
      source: "open-meteo",
      ts: h.time[i],
    });
  }
  return points;
}
