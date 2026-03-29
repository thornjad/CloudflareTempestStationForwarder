import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateCWOP } from '../../src/destinations/cwop.js';

const conditions = {
  time: 1718460000000,
  latitude: '41.8781',
  longitude: '-87.6298',
  temp: { f: 77.0, c: 25.0 },
  windSpeed: { mph: 10.0, mps: 4.47, kph: 16.09, knots: 8.7 },
  windGust: { mph: 20.0, mps: 8.94, kph: 32.18, knots: 17.4 },
  winddir: 270,
  pressure: { inHg: 29.91, hPa: 1013.0 },
  humidity: 55,
  solarRadiation: 650,
  precipLastHour: { in: 0.039, mm: 1.0 },
  precipSinceMidnight: { in: 0.098, mm: 2.5 },
};

function makeEnv(lastCwopTime = null) {
  return {
    CWOP_STATION_ID: 'CW0001',
    CWOP_VALIDATION_CODE: '',
    CACHE: {
      get: vi.fn(async () => lastCwopTime),
      put: vi.fn(async () => {}),
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'success' })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('updateCWOP', () => {
  it('calls cwop.rest endpoint', async () => {
    await updateCWOP(conditions, makeEnv());
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('send.cwop.rest');
  });

  it('includes station ID, lat, lon, time, and required weather params', async () => {
    await updateCWOP(conditions, makeEnv());
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('id=CW0001');
    expect(url).toContain('lat=41.8781');
    expect(url).toContain('long=-87.6298');
    expect(url).toContain(`time=${conditions.time}`);
    expect(url).toContain('tempf=77');
    expect(url).toContain('windspeedmph=10');
    expect(url).toContain('windgustmph=20');
    expect(url).toContain('winddir=270');
  });

  it('sends time as epoch milliseconds, not seconds', async () => {
    // send.cwop.rest requires ms; sending seconds produces a timestamp from 1970
    await updateCWOP(conditions, makeEnv());
    const url = fetch.mock.calls[0][0];
    const match = url.match(/[?&]time=(\d+)/);
    expect(match).not.toBeNull();
    const sentTime = Number(match[1]);
    expect(sentTime).toBe(conditions.time);
    // a Unix-seconds value would be ~13 digits shorter and fail the 5-minute window
    expect(sentTime).toBeGreaterThan(1e12);
  });

  it('skips fetch when timestamp already sent (dedup)', async () => {
    await updateCWOP(conditions, makeEnv(String(conditions.time)));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends when timestamp differs from last sent', async () => {
    await updateCWOP(conditions, makeEnv('9999999999000'));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('stores lastCwopTime in KV after success', async () => {
    const env = makeEnv();
    await updateCWOP(conditions, env);
    expect(env.CACHE.put).toHaveBeenCalledWith(
      'lastCwopTime',
      String(conditions.time),
      { expirationTtl: 21600 }
    );
  });

  it('includes validation code when set', async () => {
    const env = { ...makeEnv(), CWOP_VALIDATION_CODE: 'abc123' };
    await updateCWOP(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('validation=abc123');
  });

  it('omits validation code when empty', async () => {
    await updateCWOP(conditions, makeEnv());
    const url = fetch.mock.calls[0][0];
    expect(url).not.toContain('validation=');
  });

  it('throws when required fields are missing', async () => {
    const incomplete = { ...conditions, temp: null };
    await expect(updateCWOP(incomplete, makeEnv())).rejects.toThrow('CWOP requires');
  });
});
