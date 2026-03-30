import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateOpenWeatherMap } from '../../src/destinations/openweathermap.js';

const conditions = {
  time: 1718460000000,
  temp: { f: 77.0, c: 25.0 },
  dewpoint: { f: 60.0, c: 15.6 },
  windSpeed: { mph: 10.0, mps: 4.47, kph: 16.09, knots: 8.7 },
  windGust: { mph: 20.0, mps: 8.94, kph: 32.18, knots: 17.4 },
  winddir: 270,
  pressure: { inHg: 29.91, hPa: 1013.0 },
  humidity: 55,
  precipLastHour: { in: 0.039, mm: 1.0 },
  precipSinceMidnight: { in: 0.118, mm: 3.0 },
  uv: 3,
};

const env = {
  OWM_API_KEY: 'testapikey123',
  OWM_STATION_ID: 'abc123stationid',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 204, text: async () => '' })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('updateOpenWeatherMap', () => {
  it('calls the OWM measurements endpoint', async () => {
    await updateOpenWeatherMap(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('api.openweathermap.org/data/3.0/measurements');
  });

  it('includes APPID key in URL', async () => {
    await updateOpenWeatherMap(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('APPID=testapikey123');
  });

  it('sends a JSON POST request', async () => {
    await updateOpenWeatherMap(conditions, env);
    const [, options] = fetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('body is an array with one measurement object', async () => {
    await updateOpenWeatherMap(conditions, env);
    const [, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it('includes station_id and dt in every payload', async () => {
    await updateOpenWeatherMap(conditions, env);
    const [, options] = fetch.mock.calls[0];
    const [m] = JSON.parse(options.body);
    expect(m.station_id).toBe('abc123stationid');
    expect(m.dt).toBeDefined();
  });

  it('sends dt as Unix seconds, not milliseconds', async () => {
    await updateOpenWeatherMap(conditions, env);
    const [, options] = fetch.mock.calls[0];
    const [m] = JSON.parse(options.body);
    // 1718460000000 ms → 1718460000 s
    expect(m.dt).toBe(1718460000);
  });

  it('includes all optional metric fields when present', async () => {
    await updateOpenWeatherMap(conditions, env);
    const [, options] = fetch.mock.calls[0];
    const [m] = JSON.parse(options.body);
    expect(m.temperature).toBe(25.0);
    expect(m.dew_point).toBe(15.6);
    expect(m.wind_speed).toBe(4.47);
    expect(m.wind_gust).toBe(8.94);
    expect(m.wind_deg).toBe(270);
    expect(m.pressure).toBe(1013.0);
    expect(m.humidity).toBe(55);
    expect(m.uvi).toBe(3);
    expect(m.rain_1h).toBe(1.0);
    expect(m.rain_24h).toBe(3.0);
  });

  it('omits optional fields when null', async () => {
    const sparse = { time: conditions.time };
    await updateOpenWeatherMap(sparse, env);
    const [, options] = fetch.mock.calls[0];
    const [m] = JSON.parse(options.body);
    expect(m.temperature).toBeUndefined();
    expect(m.dew_point).toBeUndefined();
    expect(m.wind_speed).toBeUndefined();
    expect(m.humidity).toBeUndefined();
    expect(m.uvi).toBeUndefined();
    expect(m.rain_1h).toBeUndefined();
    expect(m.rain_24h).toBeUndefined();
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, text: async () => 'Unauthorized' })));
    await expect(updateOpenWeatherMap(conditions, env)).rejects.toThrow('HTTP 401: Unauthorized');
  });
});
