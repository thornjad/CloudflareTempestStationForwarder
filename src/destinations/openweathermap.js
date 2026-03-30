// OpenWeatherMap personal weather station forwarder
// https://openweathermap.org/stations

/**
 * Forward conditions to OpenWeatherMap.
 * @param {object} conditions - normalized conditions object from tempest.js
 * @param {object} env - Worker env bindings
 */
export async function updateOpenWeatherMap(conditions, env) {
  const url = `https://api.openweathermap.org/data/3.0/measurements?APPID=${env.OWM_API_KEY}`;

  const measurement = { station_id: env.OWM_STATION_ID };
  measurement.dt = Math.round(conditions.time / 1000);
  if (conditions.temp != null) measurement.temperature = conditions.temp.c;
  if (conditions.dewpoint != null) measurement.dew_point = conditions.dewpoint.c;
  if (conditions.windSpeed != null) measurement.wind_speed = conditions.windSpeed.mps;
  if (conditions.windGust != null) measurement.wind_gust = conditions.windGust.mps;
  if (conditions.winddir != null) measurement.wind_deg = conditions.winddir;
  if (conditions.pressure != null) measurement.pressure = conditions.pressure.hPa;
  if (conditions.humidity != null) measurement.humidity = conditions.humidity;
  if (conditions.uv != null) measurement.uvi = conditions.uv;
  if (conditions.precipLastHour != null) measurement.rain_1h = conditions.precipLastHour.mm;
  // precipSinceMidnight is the closest available approximation of rain_24h
  if (conditions.precipSinceMidnight != null) measurement.rain_24h = conditions.precipSinceMidnight.mm;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([measurement]),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text}`);
  console.log('OpenWeatherMap:', text);
  return text;
}
