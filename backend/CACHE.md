# Cloudflare caching for Meridian

## Implemented

The API has a read-through cache for the **currency reference catalogue** used by
`GET /api/v1/currencies`:

1. Cloudflare Workers Cache API (local, ephemeral edge cache).
2. Cloudflare Workers KV (global, persistent TTL cache).
3. Supabase PostgreSQL (authoritative source on a miss).

The catalogue has a 5-minute TTL. The authenticated user's active-account flags
are queried from Supabase on every request and merged after the shared catalogue
is loaded. The combined per-user response is never cached.

Cache failures are fail-open: the request falls through to Supabase. No cache is
allowed to make a financial operation succeed or fail.

## Security boundary

Never put any of the following in either cache: account balances, transactions,
deposits, payment attempts/status, statements, profiles, notifications, support
messages, admin records, access tokens, or other user-specific/private data.

Supabase remains the source of truth for all financial and identity data. Redis
is not required; this implementation uses Cloudflare-native services.

## Create and bind the KV namespace

The code expects an optional Worker binding named **`CACHE_KV`**. The Workers
Cache API works without this binding; KV adds the globally shared tier.

1. In Cloudflare Dashboard, open **Workers & Pages → KV**.
2. Create a namespace named `meridian-reference-cache`.
3. Open **Workers & Pages → Workers → global → Settings → Bindings**.
4. Add a **KV namespace** binding:
   - Variable name: `CACHE_KV`
   - KV namespace: `meridian-reference-cache`
5. Save the binding.

If you deploy the Worker from Wrangler configuration rather than Dashboard
settings, add this to `backend/wrangler.toml` using the real namespace ID
shown by Cloudflare:

```toml
[[kv_namespaces]]
binding = "CACHE_KV"
id = "YOUR_REAL_KV_NAMESPACE_ID"
```

Do not commit a placeholder ID. The binding is optional at runtime, so the API
continues to use the Cache API and Supabase if KV has not yet been attached.

## Operational notes

- Cache TTL: 300 seconds for the currency catalogue.
- A catalogue change may take up to 5 minutes to appear unless the cache key is
  explicitly invalidated.
- Cache API entries are local to a Cloudflare data centre and may be evicted.
- KV is eventually consistent; it is for read-heavy reference data, not locks,
  transactions, balances, or write-after-write correctness.
- Do not use either cache for authentication or authorization decisions.
