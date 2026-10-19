// Compact saturated steam table (IAPWS-IF97 values, rounded).
// Columns: absolute pressure (bar), saturation temperature (°C),
// enthalpy of saturated water hf (kJ/kg), enthalpy of saturated steam hg (kJ/kg).
const SAT = [
  [1.01325, 100.0, 419.1, 2676.0],
  [2, 120.2, 504.7, 2706.2],
  [3, 133.5, 561.4, 2724.9],
  [4, 143.6, 604.7, 2738.1],
  [5, 151.8, 640.1, 2748.1],
  [6, 158.8, 670.4, 2756.1],
  [7, 165.0, 697.1, 2762.8],
  [8, 170.4, 720.9, 2768.3],
  [9, 175.4, 742.6, 2773.0],
  [10, 179.9, 762.5, 2777.1],
  [12, 188.0, 798.3, 2783.7],
  [14, 195.0, 830.1, 2788.8],
  [16, 201.4, 858.5, 2792.8],
  [18, 207.1, 884.5, 2795.9],
  [20, 212.4, 908.5, 2798.3],
  [25, 223.9, 961.9, 2801.9],
  [30, 233.8, 1008.3, 2803.2],
  [35, 242.6, 1049.8, 2802.6],
  [40, 250.4, 1087.4, 2800.8],
  [50, 263.9, 1154.5, 2794.2],
  [60, 275.6, 1213.9, 2784.6],
  [70, 285.8, 1267.7, 2772.6],
  [80, 295.0, 1317.5, 2758.7],
  [100, 311.0, 1408.1, 2725.5],
];

export const KJ_PER_KCAL = 4.1868;

/** kg/cm² (gauge) → bar (absolute) */
export function kscgToBarA(pKscg) {
  return pKscg * 0.980665 + 1.01325;
}

/** Saturation properties at an absolute pressure in bar, by linear interpolation. */
export function saturation(pBarA) {
  const p = Math.min(Math.max(pBarA, SAT[0][0]), SAT[SAT.length - 1][0]);
  for (let i = 1; i < SAT.length; i++) {
    if (p <= SAT[i][0]) {
      const [p0, t0, f0, g0] = SAT[i - 1];
      const [p1, t1, f1, g1] = SAT[i];
      const k = (p - p0) / (p1 - p0);
      return { tsat: t0 + k * (t1 - t0), hf: f0 + k * (f1 - f0), hg: g0 + k * (g1 - g0) };
    }
  }
  const last = SAT[SAT.length - 1];
  return { tsat: last[1], hf: last[2], hg: last[3] };
}

/**
 * Steam enthalpy in kJ/kg.
 * Saturated steam (with optional dryness fraction) uses the table above.
 * Superheated steam adds a mean specific heat × degrees of superheat; the mean Cp is
 * fitted to IF97 values and is accurate to about ±1% for MSME boiler ranges
 * (up to ~45 bar and ~450 °C). Users can override with a measured enthalpy.
 */
export function steamEnthalpy(pBarA, tempC, dryness = 1) {
  const s = saturation(pBarA);
  if (tempC && tempC > s.tsat + 0.5) {
    const cp = pBarA <= 10 ? 2.0 + 0.037 * pBarA : 2.37 + 0.013 * (pBarA - 10);
    return { h: s.hg + cp * (tempC - s.tsat), tsat: s.tsat, superheated: true };
  }
  const x = Math.min(Math.max(dryness, 0), 1);
  return { h: s.hf + x * (s.hg - s.hf), tsat: s.tsat, superheated: false };
}

/** Enthalpy of liquid water at temperature (kJ/kg), relative to 0 °C. */
export function waterEnthalpy(tempC) {
  return 4.1868 * tempC;
}
