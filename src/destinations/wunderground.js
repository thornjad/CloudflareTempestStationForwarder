// Weather Underground forwarder (disabled by default — Tempest already feeds WU directly)
// https://www.wunderground.com/member/api-keys

import { formatDateUTC } from '../util.js';

const SOFTWARE_TYPE = 'cfworkerforwarder1.0.0';

/**
 * Forward conditions to Weather Underground.
 * Disabled by default (ENABLE_WUNDERGROUND = "false" in wrangler.toml).
 * @param {object} conditions - normalized conditions object from tempest.js
 * @param {object} env - Worker env bindings
 */
export async function updateWunderground(conditions, env) {
  const { wuFormat } = formatDateUTC(conditions.time);

  let url = 'https://rtupdate.wunderground.com/weatherstation/updateweatherstation.php';
  url += `?ID=${env.WUNDERGROUND_STATION_ID}`;
  url += `&PASSWORD=${env.WUNDERGROUND_STATION_KEY}`;
  url += `&dateutc=${encodeURIComponent(wuFormat)}`;
  if (conditions.temp != null) url += `&tempf=${conditions.temp.f}`;
  if (conditions.dewpoint != null) url += `&dewptf=${conditions.dewpoint.f}`;
  if (conditions.windSpeed != null) url += `&windspeedmph=${conditions.windSpeed.mph}`;
  if (conditions.windGust != null) url += `&windgustmph=${conditions.windGust.mph}`;
  if (conditions.winddir != null) url += `&winddir=${conditions.winddir}`;
  if (conditions.pressure != null) url += `&baromin=${conditions.pressure.inHg}`;
  if (conditions.humidity != null) url += `&humidity=${conditions.humidity}`;
  if (conditions.uv != null) url += `&uv=${conditions.uv}`;
  if (conditions.solarRadiation != null) url += `&solarradiation=${conditions.solarRadiation}`;
  if (conditions.precipLastHour != null) url += `&rainin=${conditions.precipLastHour.in}`;
  if (conditions.precipSinceMidnight != null) url += `&dailyrainin=${conditions.precipSinceMidnight.in}`;
  url += `&softwaretype=${SOFTWARE_TYPE}&action=updateraw&realtime=1&rtfreq=60`;

  const resp = await fetch(url);
  const text = await resp.text();
  console.log('Wunderground:', text);
  return text;
}
