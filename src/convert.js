// unit conversions and derived weather calculations
// ported from https://github.com/leoherzog/WundergroundStationForwarder

export const convert = {
  // temperature
  fToC: (f) => (f - 32) * (5 / 9),
  cToF: (c) => (9 / 5) * c + 32,
  // speed
  mphToMPS: (mph) => mph * 0.44704,
  mphToKPH: (mph) => mph * 1.609344,
  mphToKnots: (mph) => mph * 0.868976,
  mpsToMPH: (mps) => mps * 2.23694,
  mpsToKPH: (mps) => mps * 3.6,
  mpsToKnots: (mps) => mps * 1.943844,
  kphToMPS: (kph) => kph * 0.27778,
  kphToMPH: (kph) => kph * 0.62137,
  kphToKnots: (kph) => kph * 0.539957,
  knotsToMPH: (knots) => knots * 1.15078,
  knotsToMPS: (knots) => knots * 0.514444,
  knotsToKPH: (knots) => knots * 1.852,
  // pressure
  inHgTohPa: (inHg) => inHg * 33.86389,
  hPaToinHg: (hPa) => hPa * 0.02953,
  psiToHPa: (psi) => psi * 68.9476,
  hPaToPSI: (hPa) => hPa * 0.0145038,
  psiToinHg: (psi) => psi * 2.03602,
  inHgToPSI: (inHg) => inHg * 0.491154,
  // precipitation
  inTomm: (inches) => inches * 25.4,
  mmToIn: (mm) => mm * 0.03937,
  // light
  luxToWm2: (lux) => lux / 126.7,
  wm2ToLux: (wm2) => wm2 * 126.7,
  // https://www.weather.gov/media/epz/wxcalc/windChill.pdf
  windChill: (temp, windSpeed, units = 'F') => {
    let T = units === 'F' ? temp : convert.cToF(temp);
    let W = units === 'F' ? windSpeed : convert.kphToMPH(windSpeed);
    if (T > 50 || W < 3) return units === 'F' ? T : temp;
    let windChillF = 35.74 + 0.6215 * T - 35.75 * Math.pow(W, 0.16) + 0.4275 * T * Math.pow(W, 0.16);
    return units === 'F' ? windChillF : convert.fToC(windChillF);
  },
  // https://www.weather.gov/media/epz/wxcalc/heatIndex.pdf
  // https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
  heatIndex: (temp, humidity, units = 'F') => {
    let T = units === 'F' ? temp : convert.cToF(temp);
    let RH = humidity;
    // 1: try simple formula first
    let simpleHI = 0.5 * (T + 61.0 + ((T - 68.0) * 1.2) + (RH * 0.094));
    // 2: average with temperature; if < 80°F, use simple formula
    if ((simpleHI + T) / 2 < 80) {
      return units === 'F' ? simpleHI : convert.fToC(simpleHI);
    }
    // 3: use full Rothfusz regression
    let HI = -42.379 + 2.04901523 * T + 10.14333127 * RH - 0.22475541 * T * RH
      - 6.83783e-3 * Math.pow(T, 2) - 5.481717e-2 * Math.pow(RH, 2)
      + 1.22874e-3 * Math.pow(T, 2) * RH + 8.5282e-4 * T * Math.pow(RH, 2)
      - 1.99e-6 * Math.pow(T, 2) * Math.pow(RH, 2);
    // 4: low humidity adjustment (RH < 13% and 80 <= T <= 112)
    if (RH < 13 && T >= 80 && T <= 112) {
      HI -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    }
    // 5: high humidity adjustment (RH > 85% and 80 <= T <= 87)
    if (RH > 85 && T >= 80 && T <= 87) {
      HI += ((RH - 85) / 10) * ((87 - T) / 5);
    }
    return units === 'F' ? HI : convert.fToC(HI);
  },
  toFixed: (num, digits) => +Number(num).toFixed(digits),
};
