import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJSON, formatDateUTC, getCalculatedHourlyPrecipAccum } from '../src/util.js';

describe('formatDateUTC', () => {
  it('formats wuFormat correctly', () => {
    // 2024-06-15 14:30:00 UTC
    const ms = Date.UTC(2024, 5, 15, 14, 30, 0);
    expect(formatDateUTC(ms).wuFormat).toBe('2024-06-15 14:30:00');
  });

  it('formats pwsFormat with literal + separator', () => {
    const ms = Date.UTC(2024, 5, 15, 14, 30, 0);
    expect(formatDateUTC(ms).pwsFormat).toBe('2024-06-15+14:30:00');
  });

  it('pads single-digit month and day', () => {
    const ms = Date.UTC(2024, 0, 5, 9, 5, 3);
    expect(formatDateUTC(ms).wuFormat).toBe('2024-01-05 09:05:03');
  });
});

describe('fetchJSON', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 42 }),
    });
    const result = await fetchJSON('https://example.com');
    expect(result).toEqual({ data: 42 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds on second attempt', async () => {
    fetch
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    const promise = fetchJSON('https://example.com');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after all retries exhausted', async () => {
    fetch.mockRejectedValue(new Error('network error'));
    const promise = fetchJSON('https://example.com');
    // suppress unhandled rejection warning while timers are running
    promise.catch(() => {});
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow('Failed to fetch');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('retries on non-ok HTTP status', async () => {
    fetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ recovered: true }) });

    const promise = fetchJSON('https://example.com');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toEqual({ recovered: true });
  });
});

describe('getCalculatedHourlyPrecipAccum', () => {
  const FIXED_NOW = Date.UTC(2024, 5, 15, 14, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeCache(initial = null) {
    let stored = initial;
    return {
      get: vi.fn(async () => stored),
      put: vi.fn(async (_key, value) => { stored = value; }),
    };
  }

  it('returns null with empty history (not enough data)', async () => {
    const cache = makeCache();
    const result = await getCalculatedHourlyPrecipAccum(cache, 0.1);
    expect(result).toBeNull();
  });

  it('returns null when history spans less than 95% of an hour', async () => {
    // entries spanning 30 minutes — not enough
    const history = [
      { rate: 0.1, timestamp: FIXED_NOW - 30 * 60 * 1000 },
      { rate: 0.1, timestamp: FIXED_NOW - 15 * 60 * 1000 },
    ];
    const cache = makeCache(JSON.stringify(history));
    const result = await getCalculatedHourlyPrecipAccum(cache, 0.1);
    expect(result).toBeNull();
  });

  it('calculates accumulation when history spans a full hour', async () => {
    // constant rate of 0.5 in/hr for 1 hour → should accumulate ~0.5 inches
    const history = [
      { rate: 0.5, timestamp: FIXED_NOW - 3600000 },
      { rate: 0.5, timestamp: FIXED_NOW - 1800000 },
    ];
    const cache = makeCache(JSON.stringify(history));
    const result = await getCalculatedHourlyPrecipAccum(cache, 0.5);
    // 0.5 in/hr * (30min / 60min) + 0.5 * (30min / 60min) = 0.5
    expect(result).toBeCloseTo(0.5, 2);
  });

  it('prunes entries older than one hour', async () => {
    const history = [
      { rate: 1.0, timestamp: FIXED_NOW - 7200000 }, // 2 hours ago — should be pruned
      { rate: 0.5, timestamp: FIXED_NOW - 3600000 },
    ];
    const cache = makeCache(JSON.stringify(history));
    await getCalculatedHourlyPrecipAccum(cache, 0.5);
    const saved = JSON.parse(cache.put.mock.calls[0][1]);
    expect(saved.some((e) => e.timestamp < FIXED_NOW - 3600000)).toBe(false);
  });
});
