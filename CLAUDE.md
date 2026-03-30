# Cloudflare Tempest Station Forwarder

A Cloudflare Worker that forwards Tempest weather station data to reporting services.

## Runtime

This is a Cloudflare Worker, not a Node.js application.

- Use ES module syntax (`import`/`export`), never `require()`
- Globals available: `fetch`, `crypto`, `Request`, `Response`, `URL`, `URLSearchParams`
- No Node.js built-ins (`fs`, `path`, `http`, etc.)
- KV namespace is available as `env.CACHE`

## Project Layout

```
src/index.js              # entry point — scheduled handler and fetch handler
src/tempest.js            # Tempest API fetch and conditions normalization
src/convert.js            # unit conversion math (pure, no I/O)
src/util.js               # fetchJSON, formatDateUTC, hourly precip accumulator
src/destinations/         # one file per destination service
test/                     # mirrors src/ structure
```

## Development Commands

```sh
npm test              # run vitest
npm run dev           # local dev server (Workers runtime via wrangler)
npm run deploy        # deploy to Cloudflare
npm run tail          # stream live logs from deployed worker
```

To manually trigger the cron handler during local dev:
```sh
curl "http://localhost:8787/__scheduled?cron=*/5+*+*+*+*"
```

## Configuration

- `wrangler.toml` `[vars]` — non-secret config (station IDs, ENABLE_* flags). Safe to commit.
- `wrangler secret put <NAME>` — API keys and tokens. Never committed.
- `ENABLE_*` vars are **strings**, not booleans. Check `=== "true"`, not truthiness.

## Secrets Required

Station IDs are secrets (not vars) because they can be used to look up GPS coordinates on public weather sites.

| Secret | Used by |
|---|---|
| `TEMPEST_TOKEN` | Tempest API auth |
| `TEMPEST_STATION_ID` | Tempest API |
| `PWSWEATHER_API_KEY` | PWSWeather (when enabled) |
| `PWSWEATHER_STATION_ID` | PWSWeather (when enabled) |
| `CWOP_STATION_ID` | CWOP (when enabled) |
| `WUNDERGROUND_STATION_ID` | Wunderground (when enabled) |
| `WUNDERGROUND_STATION_KEY` | Wunderground (when enabled) |
| `WEATHERCLOUD_ID` | WeatherCloud (when enabled) |
| `WEATHERCLOUD_KEY` | WeatherCloud (when enabled) |

## Adding a Destination

1. Create `src/destinations/<name>.js` — export `async function update<Name>(conditions, env)`
2. Add the corresponding `ENABLE_<NAME>` var and any secrets to `wrangler.toml`
3. Import and call the function in `src/index.js`
4. Add tests in `test/destinations/<name>.test.js`

Destination functions are intentionally not abstracted — each builds its own URL directly. This keeps them easy to read, modify, and remove independently.

## Naming Note

The Tempest station API endpoint is at `swd.weatherflow.com` (legacy domain). All user-facing names, file names, and env vars use "Tempest". Code comments may reference the API domain for clarity.

## License

CC BY-SA 4.0 — derivative work of [WundergroundStationForwarder](https://github.com/leoherzog/WundergroundStationForwarder) by Leo Herzog. Any modifications must be shared under the same license.
