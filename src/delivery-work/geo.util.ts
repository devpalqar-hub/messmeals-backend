export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Straight-line ("as the crow flies") distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Rough road-network estimates for when no Google response is available: city roads are
// ~35% longer than the straight line, and a two-wheeler averages ~22 km/h in city traffic.
const ROAD_DETOUR_FACTOR = 1.35;
const TWO_WHEELER_AVG_SPEED_MPS = 22_000 / 3600;

export function estimateLeg(a: LatLng, b: LatLng) {
  const distanceMeters = Math.round(haversineMeters(a, b) * ROAD_DETOUR_FACTOR);
  return {
    distanceMeters,
    durationSeconds: Math.round(distanceMeters / TWO_WHEELER_AVG_SPEED_MPS),
  };
}

const LAT_LNG_PAIR = /(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/;

/**
 * Parses coordinates out of the free-form strings stored on addresses: plain
 * "lat,lng" (UserAddress.latitudeLogitude / CustomerProfile.latitude_logitude) or a
 * Google Maps link containing "@lat,lng", "q=lat,lng", "ll=lat,lng" etc.
 * Returns null for anything missing, unparsable, or out of range (incl. 0,0).
 */
export function parseLatLng(value?: string | null): LatLng | null {
  if (!value) return null;
  const decoded = safeDecode(value);
  const match = decoded.match(LAT_LNG_PAIR);
  if (!match) return null;
  return toLatLng(match[1], match[2]);
}

export function toLatLng(
  lat?: string | number | null,
  lng?: string | number | null,
): LatLng | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined)
    return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  if (la === 0 && ln === 0) return null;
  return { lat: la, lng: ln };
}

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** 'YYYY-MM-DD' → UTC midnight Date (same convention as Deliveries.date filters). */
export function parseDay(day?: string): Date {
  const str = day && day.trim() ? day.trim() : todayInTimezone('Asia/Kolkata');
  const d = new Date(`${str.slice(0, 10)}T00:00:00.000Z`);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date "${day}" — expected YYYY-MM-DD`);
  }
  return d;
}

export function nextDay(d: Date): Date {
  return new Date(d.getTime() + 24 * 60 * 60 * 1000);
}

export function formatDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayInTimezone(timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
