import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateWunderground } from '../../src/destinations/wunderground.js';

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
  WUNDERGROUND_STATION_ID: 'KILCHICA1',
  WUNDERGROUND_STATION_KEY: 'testkey',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ text: async () => 'success' })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('updateWunderground', () => {
  it('calls Wunderground endpoint', async () => {
    await updateWunderground(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('rtupdate.wunderground.com');
  });

  it('includes station ID and key', async () => {
    await updateWunderground(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('ID=KILCHICA1');
    expect(url).toContain('PASSWORD=testkey');
  });

  it('URL-encodes the date (space becomes %20)', async () => {
    await updateWunderground(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('dateutc=2024-06-15%2014%3A30%3A00');
  });

  it('includes weather params', async () => {
    await updateWunderground(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('tempf=77');
    expect(url).toContain('windspeedmph=10');
    expect(url).toContain('baromin=29.91');
    expect(url).toContain('humidity=55');
    expect(url).toContain('rainin=0.039');
    expect(url).toContain('dailyrainin=0.098');
  });

  it('includes realtime params', async () => {
    await updateWunderground(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('realtime=1');
    expect(url).toContain('rtfreq=60');
  });
});
