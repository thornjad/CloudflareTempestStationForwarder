# Cloudflare Tempest Station Forwarder

A Cloudflare Worker that reads weather data from a [Tempest](https://tempest.earth/) weather station and forwards it to weather reporting services on a 5-minute cron schedule.

Currently, only destinations which I personally feed to are included. I'm open to PRs adding other destinations.

This Cloudflare Worker is derived from the Google Apps Script project [WundergroundStationForwarder](https://github.com/leoherzog/WundergroundStationForwarder) by [Leo Herzog](https://leoherzog.com/).

## Destinations

| Service | Status | Notes |
|---|---|---|
| [PWSWeather](https://www.pwsweather.com/) | Active | |
| [CWOP](http://wxqa.com/) | Active | Citizen Weather Observer Program |
| [Weather Underground](https://www.wunderground.com/) | Inactive (code present) | Tempest already feeds WU directly |
| [Windy](https://www.windy.com/) | Not yet implemented | |

To enable an inactive destination, set `ENABLE_<NAME> = "true"` in `wrangler.toml` and add the required secrets. To implement a new one, add a module in `src/destinations/` following the existing pattern.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier should work fine for this project)
- A WeatherFlow Tempest station and [API token](https://tempestwx.com/settings/tokens)
- API keys/IDs for whichever destinations you enable. CWOP involves an application to NOAA.

## Setup

### 1. Install dependencies

```sh
npm install
```

### 2. Create the KV namespace

Cloudflare KV is used to store the latest conditions between runs and to deduplicate CWOP submissions.

```sh
npx wrangler kv namespace create CACHE
```

Copy the `id` from the output and paste it into `wrangler.toml`. If you skip this and try to use the ID currently in the file, it will fail since that's my ID:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "paste-your-id-here"
```

### 3. Configure destination toggles

Edit `wrangler.toml` and set which destinations are active:

```toml
[vars]
CWOP_VALIDATION_CODE = ""   # ham operators only — leave empty otherwise

ENABLE_PWSWEATHER = "true"
ENABLE_CWOP = "true"
ENABLE_WUNDERGROUND = "false"
```

### 4. Set secrets

Station IDs are kept as secrets rather than committed vars because they can be used to look up your station's GPS coordinates on public weather sites, linking your GitHub identity to your home address.

```sh
npx wrangler secret put TEMPEST_TOKEN
npx wrangler secret put TEMPEST_STATION_ID        # from tempestwx.com/settings/stations
npx wrangler secret put PWSWEATHER_API_KEY        # if using PWSWeather
npx wrangler secret put PWSWEATHER_STATION_ID     # if using PWSWeather
npx wrangler secret put CWOP_STATION_ID           # if using CWOP
npx wrangler secret put WUNDERGROUND_STATION_ID   # if using Wunderground
npx wrangler secret put WUNDERGROUND_STATION_KEY  # if using Wunderground
```

Each command will prompt you to paste the value.

### 5. Deploy

```sh
npm run deploy
```

Your worker is now live and will run every 5 minutes.

## Local Development

Start a local dev server that simulates the Workers runtime:

```sh
npm run dev
```

To trigger the cron handler manually (in a separate terminal):

```sh
curl "http://localhost:8787/__scheduled?cron=*/5+*+*+*+*"
```

Watch the console output in the `npm run dev` terminal for the fetch results and destination responses.

## Testing

```sh
npm test
```

Tests cover unit conversions, URL construction for each destination, conditions normalization, and the full scheduled handler flow with mocked HTTP and KV.

## Monitoring

Stream live logs from the deployed worker:

```sh
npm run tail
```

Each 5-minute cron cycle logs the raw conditions object and each destination's response.

## How It Works

Every 5 minutes the Cloudflare cron trigger fires `scheduled()` in `src/index.js`:

1. **Fetch**: `src/tempest.js` calls the Tempest REST API and normalizes the observation into a multi-unit `conditions` object (temp in F and C, wind in mph/m/s/kph/knots, etc.). Wind chill and heat index are derived if the station doesn't report them directly.
2. **Forward**: Each enabled destination function in `src/destinations/` builds an HTTP request from the conditions object and sends it. Destinations run in parallel; a failure in one does not block the others.
3. **Cache**: The conditions object and CWOP dedup state are stored in Cloudflare KV.

## Credits

Based on [WundergroundStationForwarder](https://github.com/leoherzog/WundergroundStationForwarder) by [Leo Herzog](https://leoherzog.com/), licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
