import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateWeathercloud } from '../../src/destinations/weathercloud.js';

const conditions = {
  time: Date.UTC(2024, 5, 15, 14, 30, 0),
  latitude: '41.8781',
  longitude: '-87.6298',
  temp: { f: 77.0, c: 25.0 },
  dewpoint: { f: 59.0, c: 15.0 },
  windSpeed: { mph: 10.0, mps: 4.47, kph: 16.09, knots: 8.7 },
  windGust: { mph: 20.0, mps: 8.94, kph: 32.18, knots: 17.4 },
  winddir: 270,
  windChill: { f: 73.0, c: 22.8 },
  heatIndex: { f: 79.0, c: 26.1 },
  pressure: { inHg: 29.91, hPa: 1013.0 },
  humidity: 55,
  uv: 6,
  solarRadiation: 650,
  precipRate: { in: 0.039, mm: 1.0 },
  precipSinceMidnight: { in: 0.098, mm: 2.5 },
};

const env = {
  WEATHERCLOUD_ID: 'abc123station',
  WEATHERCLOUD_KEY: 'secretkey',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '200' })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('updateWeathercloud', () => {
  it('calls WeatherCloud endpoint', async () => {
    await updateWeathercloud(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('api.weathercloud.net/v01/set');
  });

  it('includes station ID and key', async () => {
    await updateWeathercloud(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('wid=abc123station');
    expect(url).toContain('key=secretkey');
  });

  it('formats date as YYYYMMDD and time as HHmm (UTC)', async () => {
    await updateWeathercloud(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('date=20240615');
    expect(url).toContain('time=1430');
  });

  it('scales numeric params by ×10', async () => {
    await updateWeathercloud(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('temp=250');       // 25.0 × 10
    expect(url).toContain('dew=150');        // 15.0 × 10
    expect(url).toContain('wspd=45');        // round(4.47 × 10)
    expect(url).toContain('wspdhi=89');      // round(8.94 × 10)
    expect(url).toContain('bar=10130');      // 1013.0 × 10
    expect(url).toContain('uvi=60');         // 6 × 10
    expect(url).toContain('solarrad=6500'); // 650 × 10
    expect(url).toContain('rainrate=10');   // 1.0 × 10
    expect(url).toContain('rain=25');        // 2.5 × 10
  });

  it('does not scale wdir or hum', async () => {
    await updateWeathercloud(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('wdir=270');
    expect(url).toContain('hum=55');
  });

  it('includes wind chill and heat index', async () => {
    await updateWeathercloud(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('chill=228');  // round(22.8 × 10)
    expect(url).toContain('heat=261');   // round(26.1 × 10)
  });

  it('omits optional fields when null', async () => {
    const sparse = { ...conditions, windChill: null, heatIndex: null, uv: null, solarRadiation: null };
    await updateWeathercloud(sparse, env);
    const url = fetch.mock.calls[0][0];
    expect(url).not.toContain('chill=');
    expect(url).not.toContain('heat=');
    expect(url).not.toContain('uvi=');
    expect(url).not.toContain('solarrad=');
  });

  it('includes software identifier', async () => {
    await updateWeathercloud(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('software=cfworkerforwarder1.0.0');
  });

  it('throws with rate-limit hint on HTTP 429', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, text: async () => 'Too Many Requests' })));
    await expect(updateWeathercloud(conditions, env)).rejects.toThrow('rate-limited');
  });

  it('throws without rate-limit hint on other HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, text: async () => 'Unauthorized' })));
    const err = await updateWeathercloud(conditions, env).catch((e) => e);
    expect(err.message).toContain('401');
    expect(err.message).not.toContain('rate-limited');
  });

  it('warns but does not throw on body-level 429', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '429' })));
    await expect(updateWeathercloud(conditions, env)).resolves.not.toThrow();
  });

  it('throws on body-level 500', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '500' })));
    await expect(updateWeathercloud(conditions, env)).rejects.toThrow('body error 500');
  });
});
