import { Injectable, Logger } from '@nestjs/common';
import { RouteProvider } from '@prisma/client';
import axios, { isAxiosError } from 'axios';
import { estimateLeg, haversineMeters, LatLng } from './geo.util';

export interface RouteStopInput extends LatLng {
  id: string;
}

export interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
}

export interface OptimizedRoute {
  /** Stop ids in visiting order. */
  order: string[];
  /** Leg arriving at each stop (from the previous stop / origin). */
  legs: Map<string, RouteLeg>;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  /** Encoded polylines (one per Google request) — empty when heuristic-only. */
  polylines: string[];
  provider: RouteProvider;
}

const ROUTES_API_URL =
  'https://routes.googleapis.com/directions/v2:computeRoutes';

// Routes API caps waypoint optimisation at 25 intermediates; plus the destination,
// that's 26 stops per request. Longer routes are split into consecutive chunks.
const MAX_STOPS_PER_REQUEST = 26;

/** The subset of the Routes API computeRoutes response requested via FIELD_MASK. */
interface ComputeRoutesResponse {
  routes?: {
    optimizedIntermediateWaypointIndex?: number[];
    distanceMeters?: number;
    duration?: string;
    legs?: { distanceMeters?: number; duration?: string }[];
    polyline?: { encodedPolyline?: string };
  }[];
}

const FIELD_MASK = [
  'routes.optimizedIntermediateWaypointIndex',
  'routes.distanceMeters',
  'routes.duration',
  'routes.legs.distanceMeters',
  'routes.legs.duration',
  'routes.polyline.encodedPolyline',
].join(',');

/**
 * Orders delivery stops into the fastest two-wheeler route from an origin (the mess).
 *
 * 1. A local nearest-neighbour + 2-opt pass on straight-line distance gives a good
 *    global order for any number of stops (and is the full answer when Google is
 *    unavailable).
 * 2. If GOOGLE_MAPS_API_KEY is set, that order is split into ≤26-stop chunks and each
 *    chunk is re-optimised by the Google Routes API (travelMode TWO_WHEELER, traffic
 *    aware, optimizeWaypointOrder), which also supplies real road distances, ETAs
 *    and a polyline for the map. A chunk falls back to DRIVE if TWO_WHEELER is
 *    rejected, and to the heuristic order if the API fails entirely.
 */
@Injectable()
export class RouteOptimizerService {
  private readonly logger = new Logger(RouteOptimizerService.name);

  async optimize(
    origin: LatLng,
    stops: RouteStopInput[],
  ): Promise<OptimizedRoute> {
    const empty: OptimizedRoute = {
      order: [],
      legs: new Map(),
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      polylines: [],
      provider: RouteProvider.HEURISTIC,
    };
    if (stops.length === 0) return empty;

    const heuristicOrder = this.heuristicOrder(origin, stops);
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    const order: RouteStopInput[] = [];
    const legs = new Map<string, RouteLeg>();
    const polylines: string[] = [];
    let googleChunks = 0;
    let heuristicChunks = 0;

    let current: LatLng = origin;
    for (let i = 0; i < heuristicOrder.length; i += MAX_STOPS_PER_REQUEST) {
      const chunk = heuristicOrder.slice(i, i + MAX_STOPS_PER_REQUEST);
      const google = apiKey
        ? await this.optimizeChunkWithGoogle(apiKey, current, chunk)
        : null;

      if (google) {
        googleChunks++;
        google.order.forEach((s, idx) => {
          order.push(s);
          legs.set(s.id, google.legs[idx]);
        });
        if (google.polyline) polylines.push(google.polyline);
      } else {
        heuristicChunks++;
        let prev = current;
        for (const s of chunk) {
          order.push(s);
          legs.set(s.id, estimateLeg(prev, s));
          prev = s;
        }
      }
      current = order[order.length - 1];
    }

    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;
    for (const leg of legs.values()) {
      totalDistanceMeters += leg.distanceMeters;
      totalDurationSeconds += leg.durationSeconds;
    }

    return {
      order: order.map((s) => s.id),
      legs,
      totalDistanceMeters,
      totalDurationSeconds,
      polylines,
      provider:
        heuristicChunks === 0
          ? RouteProvider.GOOGLE
          : googleChunks === 0
            ? RouteProvider.HEURISTIC
            : RouteProvider.MIXED,
    };
  }

  // ─── Google Routes API ────────────────────────────────────────────────────

  private async optimizeChunkWithGoogle(
    apiKey: string,
    origin: LatLng,
    chunk: RouteStopInput[],
  ): Promise<{
    order: RouteStopInput[];
    legs: RouteLeg[];
    polyline?: string;
  } | null> {
    for (const travelMode of ['TWO_WHEELER', 'DRIVE'] as const) {
      try {
        return await this.callRoutesApi(apiKey, origin, chunk, travelMode);
      } catch (err: unknown) {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        const apiMessage = isAxiosError<{ error?: { message?: string } }>(err)
          ? err.response?.data?.error?.message
          : undefined;
        const message =
          apiMessage ?? (err instanceof Error ? err.message : String(err));
        this.logger.warn(
          `Google Routes (${travelMode}) failed for ${chunk.length} stops: ${status ?? ''} ${message}`,
        );
        // Only a request-shape rejection (e.g. TWO_WHEELER unsupported in the region)
        // is worth retrying with DRIVE; auth/quota/network errors won't change.
        if (status !== 400) return null;
      }
    }
    return null;
  }

  private async callRoutesApi(
    apiKey: string,
    origin: LatLng,
    chunk: RouteStopInput[],
    travelMode: 'TWO_WHEELER' | 'DRIVE',
  ) {
    const destination = chunk[chunk.length - 1];
    const intermediates = chunk.slice(0, -1);
    const waypoint = (p: LatLng) => ({
      location: { latLng: { latitude: p.lat, longitude: p.lng } },
    });

    const { data } = await axios.post<ComputeRoutesResponse>(
      ROUTES_API_URL,
      {
        origin: waypoint(origin),
        destination: waypoint(destination),
        intermediates: intermediates.map(waypoint),
        travelMode,
        routingPreference: 'TRAFFIC_AWARE',
        optimizeWaypointOrder: intermediates.length >= 2,
        units: 'METRIC',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        timeout: 15_000,
      },
    );

    const route = data?.routes?.[0];
    if (!route) throw new Error('No route returned');

    const idx = route.optimizedIntermediateWaypointIndex;
    const optimizedIntermediates =
      Array.isArray(idx) &&
      idx.length === intermediates.length &&
      idx.every((i) => i >= 0 && i < intermediates.length)
        ? idx.map((i) => intermediates[i])
        : intermediates;

    const order = [...optimizedIntermediates, destination];
    const rawLegs = route.legs ?? [];
    let prev: LatLng = origin;
    const legs = order.map((stop, i) => {
      const leg = rawLegs[i];
      const fallback = estimateLeg(prev, stop);
      prev = stop;
      return leg
        ? {
            distanceMeters: Number(
              leg.distanceMeters ?? fallback.distanceMeters,
            ),
            durationSeconds:
              parseDuration(leg.duration) ?? fallback.durationSeconds,
          }
        : fallback;
    });

    return {
      order,
      legs,
      polyline: route.polyline?.encodedPolyline,
    };
  }

  // ─── Local heuristic: nearest neighbour + 2-opt (open path, fixed start) ──

  heuristicOrder(origin: LatLng, stops: RouteStopInput[]): RouteStopInput[] {
    // Nearest neighbour from the origin.
    const remaining = [...stops];
    const path: RouteStopInput[] = [];
    let current: LatLng = origin;
    while (remaining.length) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineMeters(current, remaining[i]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      current = remaining[bestIdx];
      path.push(remaining.splice(bestIdx, 1)[0]);
    }

    // 2-opt improvement. nodes[0] is the fixed origin; the end of the path is open.
    const nodes: LatLng[] = [origin, ...path];
    const n = nodes.length;
    const d = (a: number, b: number) =>
      b >= n ? 0 : haversineMeters(nodes[a], nodes[b]);

    let improved = true;
    let passes = 0;
    while (improved && passes < 50) {
      improved = false;
      passes++;
      for (let i = 0; i < n - 2; i++) {
        for (let k = i + 2; k < n; k++) {
          const delta = d(i, k) + d(i + 1, k + 1) - d(i, i + 1) - d(k, k + 1);
          if (delta < -0.5) {
            // Reverse nodes[i+1..k].
            let a = i + 1;
            let b = k;
            while (a < b) {
              [nodes[a], nodes[b]] = [nodes[b], nodes[a]];
              a++;
              b--;
            }
            improved = true;
          }
        }
      }
    }

    return nodes.slice(1) as RouteStopInput[];
  }
}

function parseDuration(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined;
  const n = parseFloat(v.replace(/s$/, ''));
  return Number.isFinite(n) ? Math.round(n) : undefined;
}
