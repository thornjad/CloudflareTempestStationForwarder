// CWOP (Citizen Weather Observer Program) forwarder
// https://send.cwop.rest/ is used as a TCP intermediary (Workers can't open raw TCP sockets)

const SOFTWARE_TYPE = 'cfworkerforwarder1.0.0';

/**
 * Forward conditions to CWOP via the cwop.rest proxy.
 * Deduplicates submissions using KV — skips if this observation was already sent.
 * @param {object} conditions - normalized conditions object from tempest.js
 * @param {object} env - Worker env bindings
 */
export async function updateCWOP(conditions, env) {
  if (
    conditions.temp == null ||
    conditions.windSpeed == null ||
    conditions.windGust == null ||
    conditions.winddir == null
  ) {
    throw new Error('CWOP requires temp, wind direction, wind speed, and wind gust');
  }

  // skip if we already sent a packet for this observation timestamp
  const lastTime = await env.CACHE.get('lastCwopTime');
  if (lastTime === String(conditions.time)) {
    console.log('CWOP: already sent packet for time', conditions.time);
    return;
  }

  let url = 'https://send.cwop.rest/';
  url += `?id=${env.CWOP_STATION_ID}`;
  if (env.CWOP_VALIDATION_CODE) url += `&validation=${env.CWOP_VALIDATION_CODE}`;
  url += `&lat=${conditions.latitude}`;
  url += `&long=${conditions.longitude}`;
  url += `&time=${conditions.time / 1000}`;
  url += `&tempf=${conditions.temp.f}`;
  url += `&windspeedmph=${conditions.windSpeed.mph}`;
  url += `&windgustmph=${conditions.windGust.mph}`;
  url += `&winddir=${conditions.winddir}`;
  if (conditions.pressure != null) url += `&pressure=${conditions.pressure.hPa}`;
  if (conditions.humidity != null) url += `&humidity=${conditions.humidity}`;
  if (conditions.solarRadiation != null) url += `&solarradiation=${conditions.solarRadiation}`;
  if (conditions.precipLastHour != null) url += `&rainin=${conditions.precipLastHour.in}`;
  if (conditions.precipSinceMidnight != null) url += `&dailyrainin=${conditions.precipSinceMidnight.in}`;
  url += `&software=${SOFTWARE_TYPE}`;

  console.log('CWOP: submitting packet for', new Date(conditions.time).toISOString());

  const resp = await fetch(url);
  const text = await resp.text();
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${text}`);
  console.log('CWOP:', text);

  await env.CACHE.put('lastCwopTime', String(conditions.time), { expirationTtl: 21600 });

  return text;
}
