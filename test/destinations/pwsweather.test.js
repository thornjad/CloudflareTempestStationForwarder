import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updatePWSWeather } from '../../src/destinations/pwsweather.js';

const conditions = {
  time: Date.UTC(2024, 5, 15, 14, 30, 0),
  latitude: '41.8781',
  longitude: '-87.6298',
  temp: { f: 77.0, c: 25.0 },
  dewpoint: { f: 59.0, c: 15.0 },
  windSpeed: { mph: 10.0, mps: 4.47, kph: 16.09, knots: 8.7 },
  windGust: { mph: 20.0, mps: 8.94, kph: 32.18, knots: 17.4 },
  winddir: 270,
  pressure: { inHg: 29.91, hPa: 1013.0 },
  humidity: 55,
  uv: 6,
  solarRadiation: 650,
  precipLastHour: { in: 0.039, mm: 1.0 },
  precipSinceMidnight: { in: 0.098, mm: 2.5 },
};

const env = {
  PWSWEATHER_STATION_ID: 'TEST001',
  PWSWEATHER_API_KEY: 'testapikey',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ text: async () => 'success' })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('updatePWSWeather', () => {
  it('calls PWSWeather endpoint', async () => {
    await updatePWSWeather(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('pwsupdate.pwsweather.com');
  });

  it('includes station ID and API key', async () => {
    await updatePWSWeather(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('ID=TEST001');
    expect(url).toContain('PASSWORD=testapikey');
  });

  it('uses + as date separator (PWSWeather format)', async () => {
    await updatePWSWeather(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('dateutc=2024-06-15+14:30:00');
  });

  it('includes weather params', async () => {
    await updatePWSWeather(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('tempf=77');
    expect(url).toContain('dewptf=59');
    expect(url).toContain('windspeedmph=10');
    expect(url).toContain('windgustmph=20');
    expect(url).toContain('winddir=270');
    expect(url).toContain('baromin=29.91');
    expect(url).toContain('humidity=55');
    expect(url).toContain('uv=6');
    expect(url).toContain('solarradiation=650');
    expect(url).toContain('rainin=0.039');
    expect(url).toContain('dailyrainin=0.098');
  });

  it('omits fields that are null', async () => {
    const sparse = { ...conditions, uv: null, solarRadiation: null, precipLastHour: null };
    await updatePWSWeather(sparse, env);
    const url = fetch.mock.calls[0][0];
    expect(url).not.toContain('uv=');
    expect(url).not.toContain('solarradiation=');
    expect(url).not.toContain('&rainin=');
  });

  it('includes softwaretype', async () => {
    await updatePWSWeather(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('softwaretype=cfworkerforwarder');
  });
});
