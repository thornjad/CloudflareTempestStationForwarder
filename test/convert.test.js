import { describe, it, expect } from 'vitest';
import { convert } from '../src/convert.js';

describe('temperature', () => {
  it('converts 32°F to 0°C', () => {
    expect(convert.fToC(32)).toBeCloseTo(0, 5);
  });
  it('converts 212°F to 100°C', () => {
    expect(convert.fToC(212)).toBeCloseTo(100, 5);
  });
  it('converts 0°C to 32°F', () => {
    expect(convert.cToF(0)).toBeCloseTo(32, 5);
  });
  it('converts 100°C to 212°F', () => {
    expect(convert.cToF(100)).toBeCloseTo(212, 5);
  });
  it('round-trips F→C→F', () => {
    expect(convert.cToF(convert.fToC(98.6))).toBeCloseTo(98.6, 5);
  });
});

describe('speed', () => {
  it('converts 1 m/s to ~2.237 mph', () => {
    expect(convert.mpsToMPH(1)).toBeCloseTo(2.23694, 4);
  });
  it('converts 1 mph to ~1.609 kph', () => {
    expect(convert.mphToKPH(1)).toBeCloseTo(1.609344, 4);
  });
  it('converts 1 m/s to 3.6 kph', () => {
    expect(convert.mpsToKPH(1)).toBeCloseTo(3.6, 5);
  });
  it('round-trips mph→mps→mph', () => {
    expect(convert.mpsToMPH(convert.mphToMPS(60))).toBeCloseTo(60, 3);
  });
});

describe('pressure', () => {
  it('converts 1 inHg to ~33.864 hPa', () => {
    expect(convert.inHgTohPa(1)).toBeCloseTo(33.86389, 4);
  });
  it('round-trips inHg→hPa→inHg', () => {
    expect(convert.hPaToinHg(convert.inHgTohPa(29.92))).toBeCloseTo(29.92, 3);
  });
});

describe('precipitation', () => {
  it('converts 1 inch to 25.4 mm', () => {
    expect(convert.inTomm(1)).toBeCloseTo(25.4, 5);
  });
  it('round-trips in→mm→in', () => {
    expect(convert.mmToIn(convert.inTomm(0.5))).toBeCloseTo(0.5, 5);
  });
});

describe('windChill', () => {
  it('returns raw temp when T > 50°F', () => {
    expect(convert.windChill(55, 20, 'F')).toBe(55);
  });
  it('returns raw temp when wind < 3 mph', () => {
    expect(convert.windChill(32, 2, 'F')).toBe(32);
  });
  it('calculates wind chill at 30°F and 10 mph', () => {
    // expected: ~21.6°F from NWS formula
    expect(convert.windChill(30, 10, 'F')).toBeCloseTo(21.6, 0);
  });
  it('works in Celsius units', () => {
    const fResult = convert.windChill(30, 10, 'F');
    // C mode takes temp in C and wind speed in kph
    const cResult = convert.windChill(convert.fToC(30), convert.mphToKPH(10), 'C');
    expect(convert.cToF(cResult)).toBeCloseTo(fResult, 1);
  });
});

describe('heatIndex', () => {
  it('uses simple formula when average < 80°F (cool conditions)', () => {
    // at 75°F and 50% RH, simple formula applies
    const hi = convert.heatIndex(75, 50, 'F');
    // simple formula: 0.5 * (75 + 61 + (7*1.2) + (50*0.094)) = 0.5 * (75+61+8.4+4.7) = 74.55
    expect(hi).toBeCloseTo(74.55, 0);
  });
  it('uses Rothfusz regression at high temp and humidity', () => {
    // at 100°F and 70% RH, full regression applies
    const hi = convert.heatIndex(100, 70, 'F');
    // NWS tables show ~132°F range
    expect(hi).toBeGreaterThan(120);
  });
  it('applies low humidity adjustment (RH < 13, 80 <= T <= 112)', () => {
    const hiWithAdj = convert.heatIndex(90, 10, 'F');
    const hiNoAdj = convert.heatIndex(90, 14, 'F');
    // low humidity should lower the heat index
    expect(hiWithAdj).toBeLessThan(hiNoAdj);
  });
  it('applies high humidity adjustment (RH > 85, 80 <= T <= 87)', () => {
    const hiWithAdj = convert.heatIndex(85, 90, 'F');
    const hiNoAdj = convert.heatIndex(85, 84, 'F');
    // high humidity adjustment increases the heat index
    expect(hiWithAdj).toBeGreaterThan(hiNoAdj);
  });
  it('works in Celsius units', () => {
    const fResult = convert.heatIndex(100, 70, 'F');
    const cResult = convert.heatIndex(convert.fToC(100), 70, 'C');
    expect(convert.cToF(cResult)).toBeCloseTo(fResult, 1);
  });
});

describe('toFixed', () => {
  it('rounds to specified decimal places', () => {
    expect(convert.toFixed(1.23456, 2)).toBe(1.23);
  });
  it('returns a number not a string', () => {
    expect(typeof convert.toFixed(1.5, 0)).toBe('number');
  });
});
