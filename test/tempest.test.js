import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchConditions } from '../src/tempest.js';

// realistic Tempest API response
const mockApiResponse = {
  latitude: 41.8781,
  longitude: -87.6298,
  obs: [{
    timestamp: 1718460000, // 2024-06-15 14:00:00 UTC
    air_temperature: 25.0, // 77°F
    dew_point: 15.0,
    wind_avg: 4.47, // ~10 mph
    wind_gust: 8.94, // ~20 mph
    wind_direction: 270,
    sea_level_pressure: 1013.0, // ~29.91 inHg
    relative_humidity: 55,
    wind_chill: null, // force derived calculation
    heat_index: null, // force derived calculation
    uv: 6,
    solar_radiation: 650,
    precip: 0.0,
    precip_accum_local_day: 2.5, // mm
    precip_accum_last_1hr: 1.0, // mm
  }],
};

function makeEnv(apiResponse = mockApiResponse) {
  return {
    TEMPEST_STATION_ID: '12345',
    TEMPEST_TOKEN: 'test-token',
    CACHE: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
    },
    _apiResponse: apiResponse,
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url.includes('swd.weatherflow.com')) {
      // return appropriate response based on what env is being used
      return {
        ok: true,
        json: async () => mockApiResponse,
      };
    }
    throw new Error(`Unexpected fetch to ${url}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('fetchConditions', () => {
  it('returns a conditions object with expected fields', async () => {
    const env = makeEnv();
    const conditions = await fetchConditions(env);

    expect(conditions).toBeTruthy();
    expect(conditions.time).toBe(1718460000 * 1000);
    expect(conditions.latitude).toBe('41.8781');
    expect(conditions.longitude).toBe('-87.6298');
  });

  it('converts temperature from Celsius to both units', async () => {
    const conditions = await fetchConditions(makeEnv());
    expect(conditions.temp.c).toBe(25);
    expect(conditions.temp.f).toBeCloseTo(77, 1);
  });

  it('converts wind speed from m/s to all units', async () => {
    const conditions = await fetchConditions(makeEnv());
    expect(conditions.windSpeed.mps).toBe(4.47);
    expect(conditions.windSpeed.mph).toBeCloseTo(10, 0);
    expect(conditions.windSpeed.kph).toBeCloseTo(16.09, 1);
    expect(conditions.windSpeed.knots).toBeCloseTo(8.7, 1);
  });

  it('converts pressure from hPa to both units', async () => {
    const conditions = await fetchConditions(makeEnv());
    expect(conditions.pressure.hPa).toBe(1013);
    expect(conditions.pressure.inHg).toBeCloseTo(29.93, 1);
  });

  it('uses station-reported precip_accum_last_1hr when available', async () => {
    const conditions = await fetchConditions(makeEnv());
    // 1.0 mm = 0.03937 inches
    expect(conditions.precipLastHour.mm).toBe(1);
    expect(conditions.precipLastHour.in).toBeCloseTo(0.039, 2);
  });

  it('derives wind chill when station does not report it', async () => {
    const conditions = await fetchConditions(makeEnv());
    // at 77°F and 10 mph, wind chill formula returns raw temp (T > 50°F)
    expect(conditions.windChill).toBeTruthy();
    expect(conditions.windChill.f).toBeCloseTo(77, 0);
  });

  it('derives heat index when station does not report it', async () => {
    const conditions = await fetchConditions(makeEnv());
    expect(conditions.heatIndex).toBeTruthy();
    expect(conditions.heatIndex.f).toBeDefined();
  });

  it('includes UV and solar radiation', async () => {
    const conditions = await fetchConditions(makeEnv());
    expect(conditions.uv).toBe(6);
    expect(conditions.solarRadiation).toBe(650);
  });

  it('stores conditions in KV', async () => {
    const env = makeEnv();
    await fetchConditions(env);
    expect(env.CACHE.put).toHaveBeenCalledWith(
      'conditions',
      expect.stringContaining('"temp"'),
      { expirationTtl: 21600 }
    );
  });

  it('returns null when API response has no obs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ obs: [] }),
    })));
    const conditions = await fetchConditions(makeEnv());
    expect(conditions).toBeNull();
  });

  it('returns null when API response is missing obs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })));
    const conditions = await fetchConditions(makeEnv());
    expect(conditions).toBeNull();
  });
});
