// https://weathercloud.net
// API reference: https://gitlab.com/acuparse/acuparse/-/blob/dev/src/fcn/cron/uploaders/weathercloud.php
// Numeric values use tenths-of-a-unit (value × 10, rounded to integer).
// The HTTP status is always 200; the actual result code is in the response body.
// Known body codes: 200 = accepted, 400 = bad request, 401 = bad credentials,
// 429 = rate-limited, 500 = server error.
// Basic plan allows 1 update per 10 min. This worker runs every 5 min, so we
// gate submissions to 10-minute boundaries using the cron's scheduled time.

const SOFTWARE_TYPE = 'cfworkerforwarder1.0.0';

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

  const resp = await fetch(url);
  const text = await resp.text();
  if (!resp.ok) {
    const hint = resp.status === 429 ? ' (rate-limited)' : '';
    throw new Error(`HTTP ${resp.status}: ${text}${hint}`);
  }
  const bodyStatus = text.trim();
  if (bodyStatus === '200') {
    console.log('WeatherCloud: [ok]', resp.status, text);
  } else {
    throw new Error(`WeatherCloud body error ${bodyStatus}`);
  }
  return text;
}
