import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index.js';

const mockTempestResponse = {
  latitude: 41.8781,
  longitude: -87.6298,
  obs: [{
    timestamp: 1718460000,
    air_temperature: 25.0,
    dew_point: 15.0,
    wind_avg: 4.47,
    wind_gust: 8.94,
    wind_direction: 270,
    sea_level_pressure: 1013.0,
    relative_humidity: 55,
    wind_chill: null,
    heat_index: null,
    uv: 6,
    solar_radiation: 650,
    precip: 0.0,
    precip_accum_local_day: 2.5,
    precip_accum_last_1hr: 1.0,
  }],
};

function makeEnv(overrides = {}) {
  return {
    TEMPEST_STATION_ID: '12345',
    TEMPEST_TOKEN: 'test-token',
    PWSWEATHER_STATION_ID: 'TEST001',
    PWSWEATHER_API_KEY: 'testkey',
    CWOP_STATION_ID: 'CW0001',
    CWOP_VALIDATION_CODE: '',
    // Wunderground and Windy disabled by default — omit their secrets
    CACHE: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
    },
    ...overrides,
  };
}

function makeFetch(responses = {}) {
  return vi.fn(async (url) => {
    if (url.includes('swd.weatherflow.com')) {
      return { ok: true, json: async () => mockTempestResponse };
    }
    if (url.includes('pwsupdate.pwsweather.com')) {
      return { ok: true, text: async () => responses.pws ?? 'success' };
    }
    if (url.includes('send.cwop.rest')) {
      return { ok: true, text: async () => responses.cwop ?? 'success' };
    }
    if (url.includes('rtupdate.wunderground.com')) {
      return { ok: true, text: async () => responses.wu ?? 'success' };
    }
    throw new Error(`Unexpected fetch to ${url}`);
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', makeFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('scheduled handler', () => {
  it('fetches from Tempest API', async () => {
    await worker.scheduled({}, makeEnv(), {});
    const urls = fetch.mock.calls.map((c) => c[0]);
    expect(urls.some((u) => u.includes('swd.weatherflow.com'))).toBe(true);
  });

  it('forwards to PWSWeather when enabled', async () => {
    await worker.scheduled({}, makeEnv(), {});
    const urls = fetch.mock.calls.map((c) => c[0]);
    expect(urls.some((u) => u.includes('pwsupdate.pwsweather.com'))).toBe(true);
  });

  it('forwards to CWOP when enabled', async () => {
    await worker.scheduled({}, makeEnv(), {});
    const urls = fetch.mock.calls.map((c) => c[0]);
    expect(urls.some((u) => u.includes('send.cwop.rest'))).toBe(true);
  });

  it('does not forward to Wunderground when secrets are absent', async () => {
    await worker.scheduled({}, makeEnv(), {});
    const urls = fetch.mock.calls.map((c) => c[0]);
    expect(urls.some((u) => u.includes('wunderground.com'))).toBe(false);
  });

  it('forwards to Wunderground when secrets are present', async () => {
    await worker.scheduled({}, makeEnv({ WUNDERGROUND_STATION_ID: 'KTEST001', WUNDERGROUND_STATION_KEY: 'wukey' }), {});
    const urls = fetch.mock.calls.map((c) => c[0]);
    expect(urls.some((u) => u.includes('rtupdate.wunderground.com'))).toBe(true);
  });

  it('continues to other destinations when one fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.includes('swd.weatherflow.com')) {
        return { ok: true, json: async () => mockTempestResponse };
      }
      if (url.includes('pwsupdate.pwsweather.com')) {
        throw new Error('PWSWeather is down');
      }
      if (url.includes('send.cwop.rest')) {
        return { ok: true, text: async () => 'success' };
      }
      throw new Error(`Unexpected fetch to ${url}`);
    }));

    // should not throw even though PWSWeather fails
    await expect(worker.scheduled({}, makeEnv(), {})).resolves.not.toThrow();

    const urls = fetch.mock.calls.map((c) => c[0]);
    expect(urls.some((u) => u.includes('send.cwop.rest'))).toBe(true);
  });

  it('aborts gracefully when Tempest API fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.includes('swd.weatherflow.com')) {
        return { ok: true, json: async () => ({ obs: [] }) };
      }
      throw new Error(`Should not reach ${url}`);
    }));

    await expect(worker.scheduled({}, makeEnv(), {})).resolves.not.toThrow();
    // only the Tempest call should have happened
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('fetch handler', () => {
  it('returns 200 with status message', async () => {
    const resp = await worker.fetch(new Request('https://worker.example.com/'), makeEnv(), {});
    expect(resp.status).toBe(200);
    const text = await resp.text();
    expect(text).toContain('Weather Station Forwarder');
  });
});
