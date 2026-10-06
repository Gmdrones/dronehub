# DJI full telemetry

Isolated Cloudflare Worker: does not replace the operations Worker or alter user data.

1. `npm ci --ignore-scripts` in this directory.
2. `node build.mjs` extracts the pinned package WASM to a static import required by Workers.
3. Configure `DJI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` via Cloudflare Secrets (never Git).
4. `wrangler deploy --config wrangler.toml`.
5. `POST /flight-log` with Supabase bearer token, `application/octet-stream` and original file bytes.

The server revalidates identity and effective Pro entitlement before parsing. Limits original files to 10 MB. No original log, credentials or keychains are persisted or logged. DJI receives the required keychain request only. Response includes normalized telemetry, recorded messages and GeoJSON route; absent values and estimated cell voltages are not reported as measured values.

Tests: set `DJI_TEST_LOG` to a local original log and run `npm test`. The included metadata test does not contact DJI. A complete integration test additionally requires an active DJI key and real Supabase session.

Library: dji-log-parser-js 0.5.7 (MIT), https://github.com/lvauvillier/dji-log-parser . Supports format versions, but individual aircraft record variants must be checked with real samples. Do not claim a battery fault based on telemetry alone. The library does not supply battery-cycle/firmware information in normalized frames.
