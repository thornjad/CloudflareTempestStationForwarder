import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { updateWindy } from '../../src/destinations/windy.js';

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
  uv: 3,
};

const env = {
  WINDY_STATION_ID: 'WS001',
  WINDY_STATION_PASSWORD: 'secret123',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'success' })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('updateWindy', () => {
  it('calls the Windy stations endpoint', async () => {
    await updateWindy(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('stations.windy.com/api/v2/observation/update');
  });

  it('includes stationId, PASSWORD, softwaretype, and time', async () => {
    await updateWindy(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('stationId=WS001');
    expect(url).toContain('PASSWORD=secret123');
    expect(url).toContain('softwaretype=cfworkerforwarder');
    expect(url).toContain('time=');
  });

  it('sends time as ISO 8601, not a raw epoch number', async () => {
    await updateWindy(conditions, env);
    const url = fetch.mock.calls[0][0];
    // should contain a Z-terminated ISO string, not a plain integer
    expect(url).toMatch(/time=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(url).not.toMatch(/time=\d{13}/);
  });

  it('includes all optional weather fields when present', async () => {
    await updateWindy(conditions, env);
    const url = fetch.mock.calls[0][0];
    expect(url).toContain('tempf=77');
    expect(url).toContain('dewptf=60');
    expect(url).toContain('windspeedmph=10');
    expect(url).toContain('windgustmph=20');
    expect(url).toContain('winddir=270');
    expect(url).toContain('baromin=29.91');
    expect(url).toContain('humidity=55');
    expect(url).toContain('rainin=0.039');
    expect(url).toContain('uv=3');
  });

  it('omits optional fields when null', async () => {
    const sparse = { time: conditions.time, temp: conditions.temp };
    await updateWindy(sparse, env);
    const url = fetch.mock.calls[0][0];
    expect(url).not.toContain('dewptf=');
    expect(url).not.toContain('windspeedmph=');
    expect(url).not.toContain('humidity=');
    expect(url).not.toContain('rainin=');
    expect(url).not.toContain('uv=');
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, text: async () => 'Unauthorized' })));
    await expect(updateWindy(conditions, env)).rejects.toThrow('HTTP 401: Unauthorized');
  });
});
