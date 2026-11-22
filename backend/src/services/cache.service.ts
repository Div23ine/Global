/**
 * Meridian read-through cache.
 *
 * KV is the globally distributed, persistent tier. Workers Cache API is the
 * per-datacenter, evictable edge tier. Cache misses always fall through to the
 * authoritative data source; cache failures never block a request.
 *
 * Only explicitly selected, non-sensitive reference data belongs here.
 * Never cache balances, transactions, deposits, payment state, auth tokens,
 * profiles, admin data, or any response scoped to an individual user.
 */
export interface CacheKVBinding {
  get<T = unknown>(key: string, type: 'json'): Promise<T | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;\n  delete?(key: string): Promise<void>;
}

export interface MeridianCacheBindings {
  CACHE_KV?: CacheKVBinding;
}

const CACHE_KEY_PREFIX = 'meridian:reference:v1:';

function edgeCache(): Cache | undefined {
  try {
    return typeof caches !== 'undefined' ? caches.default : undefined;
  } catch {
    return undefined;
  }
}

function edgeRequest(key: string): Request {
  return new Request(
    `https://meridian-cache.internal/reference/${encodeURIComponent(key)}`,
    { method: 'GET' },
  );
}

/**
 * Read-through cache with a short local edge tier and a globally shared KV
 * tier. TTL is bounded to avoid accidental long-lived reference data.
 */
export async function getOrLoadReference<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  kv?: CacheKVBinding,
): Promise<T> {
  const ttl = Math.max(1, Math.min(Math.floor(ttlSeconds), 86_400));
  const cacheKey = CACHE_KEY_PREFIX + key;
  const edge = edgeCache();
  const request = edgeRequest(cacheKey);

  if (edge) {
    try {
      const hit = await edge.match(request);
      if (hit) return (await hit.json()) as T;
    } catch {
      // Cache API is an optimization only.
    }
  }

  if (kv) {
    try {
      const hit = await kv.get<T>(cacheKey, 'json');
      if (hit !== null) {
        if (edge) {
          try {
            await edge.put(request, new Response(JSON.stringify(hit), {
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${ttl}`,
              },
            }));
          } catch {
            // Keep serving the valid KV result if edge population fails.
          }
        }
        return hit;
      }
    } catch {
      // KV failure falls through to the source of truth.
    }
  }

  const value = await loader();
  const serialized = JSON.stringify(value);

  if (kv) {
    try {
      await kv.put(cacheKey, serialized, { expirationTtl: ttl });
    } catch {
      // Cache write failure must not turn a successful DB read into an error.
    }
  }

  if (edge) {
    try {
      await edge.put(request, new Response(serialized, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ttl}`,
        },
      }));
    } catch {
      // Cache write failure must not turn a successful DB read into an error.
    }
  }

  return value;
}

/** Explicitly invalidate one reference-data key after an administrative edit. */
export async function invalidateReference(
  key: string,
  kv?: CacheKVBinding,
): Promise<void> {
  const cacheKey = CACHE_KEY_PREFIX + key;
  if (kv) {
    try {
      await kv.delete?.(cacheKey);
    } catch {
      // Best-effort invalidation; short TTL remains the safety net.
    }
  }
  const edge = edgeCache();
  if (edge) {
    try {
      await edge.delete(edgeRequest(cacheKey));
    } catch {
      // Best-effort invalidation.
    }
  }
}
