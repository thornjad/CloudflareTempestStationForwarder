// PWSWeather forwarder
// https://gitlab.com/acuparse/acuparse/-/blob/dev/src/fcn/cron/uploaders/pwsweather.php
// https://github.com/OurColonial/WeatherLink-to-PWSweather

import { formatDateUTC } from '../util.js';

const SOFTWARE_TYPE = 'cfworkerforwarder1.0.0';

/**
 * Forward conditions to PWSWeather.
 * @param {object} conditions - normalized conditions object from tempest.js
 * @param {object} env - Worker env bindings
 */
export async function updatePWSWeather(conditions, env) {
  const { pwsFormat } = formatDateUTC(conditions.time);

  let url = 'https://pwsupdate.pwsweather.com/api/v1/submitwx';
  url += `?ID=${env.PWSWEATHER_STATION_ID}`;
  url += `&PASSWORD=${env.PWSWEATHER_API_KEY}`;
  url += `&dateutc=${pwsFormat}`;
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
  url += `&softwaretype=${SOFTWARE_TYPE}&action=updateraw`;

  const resp = await fetch(url);
  const text = await resp.text();
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text}`);
  console.log('PWSWeather:', text);
  return text;
}
