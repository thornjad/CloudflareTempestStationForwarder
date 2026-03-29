// shared utilities

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch a URL and parse the response as JSON, with up to 3 retries on failure.
 * @param {string} url
 * @param {Record<string, string>} headers
 * @returns {Promise<unknown>}
 */
export async function fetchJSON(url, headers = {}) {
  let lastErr;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);
    try {
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastErr?.message}`);
}

/**
 * Format a UTC timestamp into strings used by destination APIs.
 * @param {number} dateMs - epoch milliseconds
 * @returns {{ wuFormat: string, pwsFormat: string }}
 */
export function formatDateUTC(dateMs) {
  const d = new Date(dateMs);
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hours = pad(d.getUTCHours());
  const mins = pad(d.getUTCMinutes());
  const secs = pad(d.getUTCSeconds());
  // Wunderground: "yyyy-MM-dd HH:mm:ss" (caller uses encodeURIComponent)
  const wuFormat = `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
  // PWSWeather: literal '+' separator in query string
  const pwsFormat = `${year}-${month}-${day}+${hours}:${mins}:${secs}`;
  return { wuFormat, pwsFormat };
}

const ONE_HOUR_MS = 3600000;

/**
 * Accumulate hourly precipitation from a running rate history stored in KV.
 * The Tempest station provides precip_accum_last_1hr directly, so this is only
 * used as a fallback when that field is null.
 *
 * @param {KVNamespace} cache - Cloudflare KV binding
 * @param {number} currentPrecipRate - precipitation rate in inches/hour
 * @returns {Promise<number|null>} accumulated inches over the past hour, or null if insufficient data
 */
export async function getCalculatedHourlyPrecipAccum(cache, currentPrecipRate) {
  let history = JSON.parse((await cache.get('hourlyPrecipHistory')) ?? '[]');
  const now = Date.now();

  history.push({ rate: currentPrecipRate, timestamp: now });
  history = history.filter((entry) => entry.timestamp >= now - ONE_HOUR_MS);

  await cache.put('hourlyPrecipHistory', JSON.stringify(history), { expirationTtl: 21600 });

  // need at least two readings spanning close to a full hour
  if (history.length > 1 && now - history[0].timestamp >= ONE_HOUR_MS * 0.95) {
    const total = history.reduce((acc, entry, i, arr) => {
      if (i === 0) return acc;
      const prev = arr[i - 1];
      const timeFraction = (entry.timestamp - prev.timestamp) / ONE_HOUR_MS;
      return acc + prev.rate * timeFraction;
    }, 0);
    return total;
  }

  return null;
}
