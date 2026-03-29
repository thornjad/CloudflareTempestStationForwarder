// fetches and normalizes conditions from the Tempest weather station API
// api docs: https://apidocs.tempestwx.com/reference/derived-metrics

import { convert } from './convert.js';
import { fetchJSON, getCalculatedHourlyPrecipAccum } from './util.js';

/**
 * Fetch the latest observation from Tempest and return a normalized conditions object.
 * Also writes conditions to KV for external reads and debugging.
 * @param {object} env - Worker env bindings
 * @returns {Promise<object|null>}
 */
export async function fetchConditions(env) {
  const url = `https://swd.weatherflow.com/swd/rest/observations/station/${env.TEMPEST_STATION_ID}?token=${env.TEMPEST_TOKEN}`;
  const raw = await fetchJSON(url);

  if (!raw?.obs?.length) return null;

  const obs = raw.obs[0];
  const conditions = {};

  conditions.time = obs.timestamp * 1000;
  conditions.latitude = raw.latitude.toString();
  conditions.longitude = raw.longitude.toString();

  if (obs.air_temperature != null) conditions.temp = {
    f: convert.toFixed(convert.cToF(obs.air_temperature), 2),
    c: convert.toFixed(obs.air_temperature, 2),
  };
  if (obs.dew_point != null) conditions.dewpoint = {
    f: convert.toFixed(convert.cToF(obs.dew_point), 2),
    c: convert.toFixed(obs.dew_point, 2),
  };
  if (obs.wind_avg != null) conditions.windSpeed = {
    mph: convert.toFixed(convert.mpsToMPH(obs.wind_avg), 2),
    mps: convert.toFixed(obs.wind_avg, 2),
    kph: convert.toFixed(convert.mpsToKPH(obs.wind_avg), 2),
    knots: convert.toFixed(convert.mpsToKnots(obs.wind_avg), 2),
  };
  if (obs.wind_gust != null) conditions.windGust = {
    mph: convert.toFixed(convert.mpsToMPH(obs.wind_gust), 2),
    mps: convert.toFixed(obs.wind_gust, 2),
    kph: convert.toFixed(convert.mpsToKPH(obs.wind_gust), 2),
    knots: convert.toFixed(convert.mpsToKnots(obs.wind_gust), 2),
  };
  if (obs.wind_direction != null) conditions.winddir = obs.wind_direction;
  if (obs.sea_level_pressure != null) conditions.pressure = {
    inHg: convert.toFixed(convert.hPaToinHg(obs.sea_level_pressure), 3),
    hPa: convert.toFixed(obs.sea_level_pressure, 1),
  };
  if (obs.relative_humidity != null) conditions.humidity = convert.toFixed(obs.relative_humidity, 0);

  // use station-reported wind chill if available, otherwise derive it
  if (obs.wind_chill != null) {
    conditions.windChill = {
      f: convert.toFixed(convert.cToF(obs.wind_chill), 2),
      c: convert.toFixed(obs.wind_chill, 2),
    };
  } else if (conditions.temp != null && conditions.windSpeed != null) {
    conditions.windChill = {
      f: convert.toFixed(convert.windChill(conditions.temp.f, conditions.windSpeed.mph, 'F'), 2),
      c: convert.toFixed(convert.windChill(conditions.temp.c, conditions.windSpeed.kph, 'C'), 2),
    };
  }

  // use station-reported heat index if available, otherwise derive it
  if (obs.heat_index != null) {
    conditions.heatIndex = {
      f: convert.toFixed(convert.cToF(obs.heat_index), 2),
      c: convert.toFixed(obs.heat_index, 2),
    };
  } else if (conditions.temp != null && conditions.humidity != null) {
    conditions.heatIndex = {
      f: convert.toFixed(convert.heatIndex(conditions.temp.f, conditions.humidity, 'F'), 2),
      c: convert.toFixed(convert.heatIndex(conditions.temp.c, conditions.humidity, 'C'), 2),
    };
  }

  if (obs.uv != null) conditions.uv = obs.uv;
  if (obs.solar_radiation != null) conditions.solarRadiation = obs.solar_radiation;

  // precip rate: API reports mm per minute; convert to in/hr and mm/hr
  if (obs.precip != null) conditions.precipRate = {
    in: convert.toFixed(convert.mmToIn(obs.precip * 60), 3),
    mm: convert.toFixed(obs.precip * 60, 2),
  };

  if (obs.precip_accum_local_day != null) conditions.precipSinceMidnight = {
    in: convert.toFixed(convert.mmToIn(obs.precip_accum_local_day), 3),
    mm: convert.toFixed(obs.precip_accum_local_day, 2),
  };

  // prefer station-reported last-hour accumulation; fall back to calculated
  if (obs.precip_accum_last_1hr != null) {
    conditions.precipLastHour = {
      in: convert.toFixed(convert.mmToIn(obs.precip_accum_last_1hr), 3),
      mm: convert.toFixed(obs.precip_accum_last_1hr, 2),
    };
  } else if (conditions.precipRate != null) {
    const calc = await getCalculatedHourlyPrecipAccum(env.CACHE, conditions.precipRate.in);
    if (calc != null) conditions.precipLastHour = {
      in: convert.toFixed(calc, 3),
      mm: convert.toFixed(convert.inTomm(calc), 2),
    };
  }

  console.log('fetched conditions at', new Date(conditions.time).toISOString());

  await env.CACHE.put('conditions', JSON.stringify(conditions), { expirationTtl: 21600 });

  return conditions;
}
