import type { GeoPoint } from "./types";

/**
 * Geo is a FILTER, not a ranking signal — every column runs the same
 * geo_distance filter over the same candidate pool, so the retrieval
 * comparison stays apples-to-apples. Coordinates are synthetic (region
 * centroids + deterministic per-doc jitter), injected at seed time so the
 * 130 hand-authored docs never needed real lat/lon added by hand.
 */

export const REGION_COORDS: Record<string, GeoPoint> = {
  Amoy: { lat: 1.2797, lon: 103.846 },
  "Ang Mo Kio": { lat: 1.3691, lon: 103.8454 },
  "Beach Road": { lat: 1.2975, lon: 103.857 },
  Bedok: { lat: 1.3236, lon: 103.9273 },
  "Bukit Merah": { lat: 1.2819, lon: 103.8239 },
  "Bukit Timah": { lat: 1.3294, lon: 103.8021 },
  Chinatown: { lat: 1.2838, lon: 103.8433 },
  Clementi: { lat: 1.3151, lon: 103.7649 },
  "East Coast": { lat: 1.3006, lon: 103.9124 },
  Geylang: { lat: 1.3181, lon: 103.883 },
  "Geylang Serai": { lat: 1.3167, lon: 103.8987 },
  "Ghim Moh": { lat: 1.311, lon: 103.7857 },
  Hougang: { lat: 1.3612, lon: 103.8863 },
  "Joo Chiat": { lat: 1.3115, lon: 103.9037 },
  Jurong: { lat: 1.3329, lon: 103.7436 },
  Kallang: { lat: 1.31, lon: 103.8714 },
  Katong: { lat: 1.3037, lon: 103.9002 },
  "Lau Pa Sat": { lat: 1.2807, lon: 103.8503 },
  "Little India": { lat: 1.3067, lon: 103.8517 },
  Maxwell: { lat: 1.2802, lon: 103.8447 },
  Newton: { lat: 1.3138, lon: 103.838 },
  "Old Airport Road": { lat: 1.3086, lon: 103.8853 },
  Outram: { lat: 1.2803, lon: 103.838 },
  Queenstown: { lat: 1.2942, lon: 103.806 },
  "Raffles Place": { lat: 1.284, lon: 103.8515 },
  Serangoon: { lat: 1.3554, lon: 103.8737 },
  Tekka: { lat: 1.3061, lon: 103.8517 },
  "Tiong Bahru": { lat: 1.2857, lon: 103.8267 },
  "Toa Payoh": { lat: 1.3343, lon: 103.8563 },
  Whampoa: { lat: 1.3223, lon: 103.8544 },
};

/** Small deterministic per-doc offset (~0-400m) so dishes sharing a region don't stack on one point. */
export function jitter(base: GeoPoint, id: string): GeoPoint {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const dLat = ((h % 1000) / 1000 - 0.5) * 0.007;
  const dLon = (((h >> 10) % 1000) / 1000 - 0.5) * 0.007;
  return { lat: Math.round((base.lat + dLat) * 1e6) / 1e6, lon: Math.round((base.lon + dLon) * 1e6) / 1e6 };
}

/** Look up a dish's synthetic coordinate straight from its region. */
export function coordForRegion(region: string, id: string): GeoPoint {
  const base = REGION_COORDS[region] ?? REGION_COORDS["Chinatown"];
  return jitter(base, id);
}

export interface AreaPreset {
  key: string;
  label: string;
  lat: number;
  lon: number;
  radiusKm: number;
}

/**
 * Reproducible demo-safe area pills — each center/radius was checked against
 * every region's centroid so the four presets partition cleanly (no region
 * falls inside two presets at once). "Newton" sits in the gap between all
 * four and is only reachable via "Anywhere SG" — a known, acceptable gap.
 */
export const AREA_PRESETS: AreaPreset[] = [
  { key: "east", label: "East (Katong/Bedok)", lat: 1.31, lon: 103.905, radiusKm: 5 },
  { key: "central", label: "Central (Chinatown/Maxwell)", lat: 1.283, lon: 103.843, radiusKm: 3.2 },
  { key: "north", label: "North (Toa Payoh/AMK)", lat: 1.35, lon: 103.865, radiusKm: 3.8 },
  { key: "west", label: "West (Clementi/Jurong)", lat: 1.317, lon: 103.775, radiusKm: 4.5 },
];

export function findAreaPreset(key: string | null | undefined): AreaPreset | null {
  if (!key) return null;
  return AREA_PRESETS.find((a) => a.key === key) ?? null;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)) * 10) / 10;
}
