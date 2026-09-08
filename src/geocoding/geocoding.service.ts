import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface LocationSuggestion {
    name: string;
    latitude: number;
    longitude: number;
}

interface CacheEntry {
    value: LocationSuggestion[];
    expiresAt: number;
}

const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

// Messmeals only operates in India — restrict Mapbox results to it (ISO 3166-1 alpha-2)
// rather than returning global matches for common place-name queries.
const MAPBOX_COUNTRY = 'IN';

// Below this length a query is both the most repeated (e.g. "a", "ko") and the least
// useful to autocomplete, so we skip the Mapbox call entirely rather than cache it.
const MIN_QUERY_LENGTH = 3;

// How long a normalized query's result set stays cached before we'll hit Mapbox again
// for it. Place names/coordinates don't change minute to minute, so this can be long.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// Simple cap so the in-memory cache can't grow unbounded over a long-running process.
const MAX_CACHE_ENTRIES = 500;

/// Wraps Mapbox's classic Geocoding API (v5) for location-autocomplete suggestions — not
/// the separate, session-token-based Search Box API. This call is made in Mapbox's default
/// **temporary geocoding** mode (no `permanent` param is set), which needs no special
/// Mapbox agreement — it just means results may only be cached/stored temporarily, never
/// persisted permanently. The 7-day in-memory cache below respects that: it's an ordinary
/// process-local TTL cache, not a permanent store.
///
/// This is the only place in the codebase that calls a geocoding API, and it is built to
/// call it as little as possible:
///  - queries shorter than MIN_QUERY_LENGTH never hit the network (they're skipped, not cached)
///  - every remaining query is cached (in-memory, TTL'd) by its normalized text, so repeat
///    searches for the same place — very common while a user is still typing — are free
///
/// Callers (e.g. the /open/search-suggestions endpoint) should still debounce keystrokes
/// client-side (~300ms) before calling in, since that's what keeps mid-word calls from
/// happening at all.
///
/// The in-memory Map is per-process; for a multi-instance deployment, swap it for a shared
/// store (e.g. Redis) behind the same suggestLocations() signature.
@Injectable()
export class GeocodingService {
    private readonly logger = new Logger(GeocodingService.name);
    private readonly cache = new Map<string, CacheEntry>();

    async suggestLocations(query: string, limit = 5): Promise<LocationSuggestion[]> {
        const normalized = query.trim().toLowerCase();
        if (normalized.length < MIN_QUERY_LENGTH) {
            return [];
        }

        const cacheKey = `${normalized}::${limit}`;
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }

        const token = process.env.MAPBOX_ACCESS_TOKEN;
        if (!token) {
            this.logger.warn('MAPBOX_ACCESS_TOKEN is not set — skipping location suggestions.');
            return [];
        }

        try {
            const { data } = await axios.get(
                `${MAPBOX_GEOCODING_URL}/${encodeURIComponent(normalized)}.json`,
                {
                    params: {
                        access_token: token,
                        autocomplete: true,
                        country: MAPBOX_COUNTRY,
                        limit,
                    },
                    timeout: 5000,
                },
            );

            const results: LocationSuggestion[] = (data?.features ?? [])
                .map((feature: any) => ({
                    name: feature.place_name as string,
                    longitude: feature.center?.[0] as number,
                    latitude: feature.center?.[1] as number,
                }))
                .filter((r: LocationSuggestion) => r.name && !isNaN(r.latitude) && !isNaN(r.longitude));

            this.setCache(cacheKey, results);
            return results;
        } catch (err) {
            this.logger.error(`Mapbox geocoding request failed for "${normalized}"`, err as Error);
            return [];
        }
    }

    private setCache(key: string, value: LocationSuggestion[]) {
        if (!this.cache.has(key) && this.cache.size >= MAX_CACHE_ENTRIES) {
            // Map preserves insertion order — evict the oldest entry rather than growing forever.
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) this.cache.delete(oldestKey);
        }
        this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    }
}
