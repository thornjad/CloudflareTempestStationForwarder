// https://weathercloud.net
// API reference: https://gitlab.com/acuparse/acuparse/-/blob/dev/src/fcn/cron/uploaders/weathercloud.php
// Numeric values use tenths-of-a-unit (value × 10, rounded to integer).
// The HTTP status is always 200; the actual result code is in the response body.
// Known body codes: 200 = accepted, 400 = bad request, 401 = bad credentials,
// 429 = rate-limited, 500 = server error.
// Basic plan allows 1 update per 10 min. This worker runs every 5 min, so we
// gate submissions to 10-minute boundaries using the cron's scheduled time.

const SOFTWARE_TYPE = 'cfworkerforwarder1.0.0';

// human-readable meanings for WeatherCloud body status codes
const CODE_MEANINGS = {
  '400': 'bad request (malformed or out-of-range parameters)',
  '401': 'bad credentials (check WEATHERCLOUD_ID / WEATHERCLOUD_KEY)',
  '429': 'rate-limited (max 1 update per 10 min on the basic plan)',
  '500': 'WeatherCloud server error (usually transient)',
};

const RETRY_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Forward conditions to WeatherCloud.
 * @param {object} conditions - normalized conditions object from tempest.js
 * @param {object} env - Worker env bindings
 */
export async function updateWeathercloud(conditions, env, scheduledTime) {
  if (new Date(scheduledTime).getUTCMinutes() % 10 !== 0) {
    console.log('WeatherCloud: [skip] not a 10-minute boundary');
    return;
  }
  const d = new Date(conditions.time);
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;

  let url = 'https://api.weathercloud.net/v01/set';
  url += `?wid=${env.WEATHERCLOUD_ID}`;
  url += `&key=${env.WEATHERCLOUD_KEY}`;
  url += `&date=${date}`;
  url += `&time=${time}`;
  if (conditions.temp != null) url += `&temp=${Math.round(conditions.temp.c * 10)}`;
  if (conditions.dewpoint != null) url += `&dew=${Math.round(conditions.dewpoint.c * 10)}`;
  if (conditions.windSpeed != null) url += `&wspd=${Math.round(conditions.windSpeed.mps * 10)}`;
  if (conditions.windGust != null) url += `&wspdhi=${Math.round(conditions.windGust.mps * 10)}`;
  if (conditions.winddir != null) url += `&wdir=${conditions.winddir}`;
  if (conditions.windChill != null) url += `&chill=${Math.round(conditions.windChill.c * 10)}`;
  if (conditions.heatIndex != null) url += `&heat=${Math.round(conditions.heatIndex.c * 10)}`;
  if (conditions.pressure != null) url += `&bar=${Math.round(conditions.pressure.hPa * 10)}`;
  if (conditions.humidity != null) url += `&hum=${conditions.humidity}`;
  if (conditions.uv != null) url += `&uvi=${Math.round(conditions.uv * 10)}`;
  if (conditions.solarRadiation != null) url += `&solarrad=${Math.round(conditions.solarRadiation * 10)}`;
  if (conditions.precipRate != null) url += `&rainrate=${Math.round(conditions.precipRate.mm * 10)}`;
  if (conditions.precipSinceMidnight != null) url += `&rain=${Math.round(conditions.precipSinceMidnight.mm * 10)}`;
  url += `&software=${SOFTWARE_TYPE}`;

  // wid and key are secrets; redact them before logging the request
  const redacted = url
    .replace(env.WEATHERCLOUD_ID, '<wid>')
    .replace(env.WEATHERCLOUD_KEY, '<key>');

  const MAX_ATTEMPTS = 2; // one retry on transient server errors
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const resp = await fetch(url);
    const text = await resp.text();
    const bodyStatus = text.trim();

    if (resp.ok && bodyStatus === '200') {
      console.log('WeatherCloud: [ok]', resp.status, text);
      return text;
    }

    const detail = resp.ok
      ? `body ${bodyStatus} (${CODE_MEANINGS[bodyStatus] ?? 'unknown code'})`
      : `HTTP ${resp.status}${resp.status === 429 ? ' (rate-limited)' : ''}: ${text}`;
    const transient = resp.status >= 500 || bodyStatus === '500';

    if (transient && attempt < MAX_ATTEMPTS) {
      console.log(`WeatherCloud: [retry] ${detail}; retrying once`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }
    throw new Error(`WeatherCloud ${detail}; sent ${redacted}`);
  }
}
