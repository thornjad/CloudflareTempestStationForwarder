// Windy Stations forwarder
// https://stations.windy.com/

const SOFTWARE_TYPE = 'cfworkerforwarder1.0.0';

/**
 * Forward conditions to Windy Stations.
 * @param {object} conditions - normalized conditions object from tempest.js
 * @param {object} env - Worker env bindings
 */
export async function updateWindy(conditions, env) {
  let url = 'https://stations.windy.com/api/v2/observation/update';
  url += `?stationId=${env.WINDY_STATION_ID}`;
  url += `&PASSWORD=${env.WINDY_STATION_PASSWORD}`;
  url += `&softwaretype=${SOFTWARE_TYPE}`;
  // Windy requires ISO 8601 format
  url += `&time=${new Date(conditions.time).toISOString()}`;
  if (conditions.temp != null) url += `&tempf=${conditions.temp.f}`;
  if (conditions.dewpoint != null) url += `&dewptf=${conditions.dewpoint.f}`;
  if (conditions.windSpeed != null) url += `&windspeedmph=${conditions.windSpeed.mph}`;
  if (conditions.windGust != null) url += `&windgustmph=${conditions.windGust.mph}`;
  if (conditions.winddir != null) url += `&winddir=${conditions.winddir}`;
  if (conditions.pressure != null) url += `&baromin=${conditions.pressure.inHg}`;
  if (conditions.humidity != null) url += `&humidity=${conditions.humidity}`;
  if (conditions.precipLastHour != null) url += `&rainin=${conditions.precipLastHour.in}`;
  if (conditions.uv != null) url += `&uv=${conditions.uv}`;

  const resp = await fetch(url);
  const text = await resp.text();
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text}`);
  console.log('Windy: [ok]', resp.status, text);
  return text;
}
