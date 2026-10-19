// Boiler efficiency and emissions engine.
//
// Indirect (heat loss) method: IS 8753:1977 / BS 845 as adapted in the
// Bureau of Energy Efficiency (BEE) Guide Book 2, Chapter 2 "Boilers"
// (energy performance assessment), all on GCV basis.
// Direct (input-output) method: heat in steam / hot water / thermic fluid
// divided by heat in fuel.
// Emissions: carbon mass balance for CO2, IPCC 2006 default factors for
// CH4 and N2O, sulphur mass balance for SO2, measured CO, CEA grid factor
// for auxiliary electricity.

import { GWP } from './fuels.js';
import { kscgToBarA, steamEnthalpy, waterEnthalpy, KJ_PER_KCAL } from './steam.js';

const CP_FLUE = 0.23;   // kcal/kg °C, dry flue gas
const CP_STEAM = 0.45;  // kcal/kg °C, superheated vapour in flue gas
const LATENT = 584;     // kcal/kg, latent heat used by BEE / IS 8753
const GCV_CARBON = 8080; // kcal/kg, heat value of unburnt carbon
const CO_HEAT = 5654;   // kcal/kg C, heat lost when carbon burns to CO not CO2

export const LOSS_LABELS = {
  dryFlueGas: 'Dry flue gas',
  hydrogen: 'Hydrogen in fuel (H₂O formed)',
  fuelMoisture: 'Moisture in fuel',
  airMoisture: 'Moisture in air',
  co: 'Partial combustion (CO)',
  radiation: 'Radiation & convection',
  flyAsh: 'Unburnt in fly ash',
  bottomAsh: 'Unburnt in bottom ash',
};

/** Humidity ratio (kg water / kg dry air) from ambient temperature and RH. */
export function humidityRatio(tempC, rhPercent) {
  const psat = 0.61094 * Math.exp((17.625 * tempC) / (tempC + 243.04)); // kPa, Magnus
  const pv = (rhPercent / 100) * psat;
  return (0.622 * pv) / (101.325 - pv);
}

/** Stoichiometry for 1 kg of fuel from its ultimate analysis (% as fired). */
export function stoichiometry(fuel) {
  const c = fuel.C / 100, h = fuel.H / 100, o = fuel.O / 100, s = fuel.S / 100;
  const theoAir = 11.6 * c + 34.8 * (h - o / 8) + 4.35 * s; // kg air / kg fuel
  // Maximum CO2 in dry flue gas at zero excess air (vol %)
  const nC = fuel.C / 12, nS = fuel.S / 32, nN = fuel.N / 28;
  const o2Need = fuel.C / 12 + fuel.H / 4 + fuel.S / 32 - fuel.O / 32;
  const dry = nC + nS + nN + 3.76 * o2Need;
  const co2Max = dry > 0 ? (nC / dry) * 100 : 0;
  return { theoAir, co2Max };
}

/** Net calorific value (kcal/kg) from GCV, hydrogen and moisture. */
export function ncv(fuel) {
  return fuel.GCV - LATENT * (9 * fuel.H / 100 + fuel.M / 100);
}

/** Unburnt carbon in ash, kg per kg of fuel. */
function unburntCarbon(fuel, ash) {
  const a = fuel.A / 100;
  if (a <= 0) return { fly: 0, bottom: 0 };
  const fs = ash.flyShare / 100;
  const ucF = Math.min(ash.ucFly, 99) / 100;
  const ucB = Math.min(ash.ucBottom, 99) / 100;
  // residue mass = ash / (1 - UC); carbon = residue × UC
  return { fly: a * fs * ucF / (1 - ucF), bottom: a * (1 - fs) * ucB / (1 - ucB) };
}

/** BEE surface heat loss, W/m², from surface and ambient temperature (°C) and wind (m/s). */
export function surfaceLossWm2(tsC, taC, wind) {
  const ts = tsC + 273.15, ta = taC + 273.15;
  const dT = Math.max(ts - ta, 0);
  return 0.548 * ((ts / 55.55) ** 4 - (ta / 55.55) ** 4)
    + 1.957 * dT ** 1.25 * Math.sqrt((196.85 * wind + 68.9) / 68.9);
}

/** Indirect method. Returns each loss in % of GCV input and the efficiency. */
export function indirectMethod(inp) {
  const { fuel, flue, ash, surface } = inp;
  const gcv = fuel.GCV;
  const h = fuel.H / 100, m = fuel.M / 100, s = fuel.S / 100, n = fuel.N / 100;
  const dT = flue.Tf - flue.Ta;
  const { theoAir, co2Max } = stoichiometry(fuel);
  const o2 = Math.min(Math.max(flue.O2, 0), 20.5);
  const excessAir = o2 / (21 - o2);                 // fraction
  const aas = (1 + excessAir) * theoAir;            // actual air supplied, kg/kg fuel
  const uc = unburntCarbon(fuel, ash);
  const cBurnt = Math.max(fuel.C / 100 - uc.fly - uc.bottom, 0);

  const dryFlueGasMass = cBurnt * 44 / 12 + s * 64 / 32 + n
    + aas * 0.77 + (aas - theoAir) * 0.23;           // kg / kg fuel

  const w = flue.humidity != null && flue.humidity !== ''
    ? Number(flue.humidity) : humidityRatio(flue.Ta, flue.RH);

  const co2Pct = flue.CO2 > 0 ? flue.CO2 : co2Max * (21 - o2) / 21;
  const coPct = (flue.COppm || 0) / 10000;

  const L = {};
  L.dryFlueGas = dryFlueGasMass * CP_FLUE * dT / gcv * 100;
  L.hydrogen = 9 * h * (LATENT + CP_STEAM * dT) / gcv * 100;
  L.fuelMoisture = m * (LATENT + CP_STEAM * dT) / gcv * 100;
  L.airMoisture = aas * w * CP_STEAM * dT / gcv * 100;
  L.co = coPct > 0 ? coPct * cBurnt / (coPct + co2Pct) * CO_HEAT / gcv * 100 : 0;

  if (surface.mode === 'measured' && inp.fuelRate > 0) {
    const watts = surfaceLossWm2(surface.Ts, flue.Ta, surface.wind || 0) * surface.area;
    L.radiation = watts * 0.8598 / (inp.fuelRate * gcv) * 100; // W → kcal/h
  } else {
    L.radiation = Number(surface.percent) || 0;
  }

  L.flyAsh = uc.fly * GCV_CARBON / gcv * 100;
  L.bottomAsh = uc.bottom * GCV_CARBON / gcv * 100;

  for (const k of Object.keys(L)) L[k] = Math.max(L[k], 0);
  const totalLoss = Object.values(L).reduce((a, b) => a + b, 0);

  return {
    losses: L,
    totalLoss,
    efficiency: 100 - totalLoss,
    details: {
      theoAir, excessAirPct: excessAir * 100, actualAir: aas, dryFlueGasMass,
      humidityRatio: w, co2Pct, co2Max, unburntC: uc.fly + uc.bottom, carbonBurnt: cBurnt,
    },
  };
}

/** Direct method. Returns useful heat (kcal/h) and efficiency. */
export function directMethod(inp) {
  const heatIn = inp.fuelRate * inp.fuel.GCV; // kcal/h
  let heatOut = 0, info = {};
  if (inp.outputType === 'steam') {
    const st = inp.steam;
    if (!(st.flow > 0)) return null;
    const pA = kscgToBarA(st.pressure);
    const se = steamEnthalpy(pA, st.superheated ? st.temp : null, st.dryness ?? 1);
    const hs = st.enthalpyOverride > 0 ? st.enthalpyOverride : se.h; // kJ/kg
    const hfw = waterEnthalpy(st.feedTemp);
    heatOut = st.flow * (hs - hfw) / KJ_PER_KCAL;
    info = { steamEnthalpy: hs, feedEnthalpy: hfw, tsat: se.tsat, pressureBarA: pA,
      evaporationRatio: inp.fuelRate > 0 ? st.flow / inp.fuelRate : 0 };
  } else {
    const fl = inp.fluid;
    if (!(fl.flow > 0)) return null;
    heatOut = fl.flow * fl.cp * (fl.tout - fl.tin);
    info = { deltaT: fl.tout - fl.tin };
  }
  if (!(heatIn > 0)) return null;
  return { heatIn, heatOut, efficiency: heatOut / heatIn * 100, ...info };
}

/** Hourly emissions and energy, kg/h unless noted. */
export function hourlyFlows(inp, ind) {
  const f = inp.fuel;
  const rate = inp.fuelRate;
  const ncvKcal = ncv(f);
  const tjPerHour = rate * ncvKcal * KJ_PER_KCAL * 1e-9;
  const carbonBurnt = ind ? ind.details.carbonBurnt : f.C / 100;
  const co2 = rate * carbonBurnt * 44 / 12;
  const ch4 = tjPerHour * f.ch4;
  const n2o = tjPerHour * f.n2o;
  const so2 = rate * (f.S / 100) * 2;
  const dfg = ind ? ind.details.dryFlueGasMass : 0;
  const co = (inp.flue.COppm || 0) * 1e-6 * (dfg / 30) * 28 * rate;
  const auxCo2 = (inp.aux.kWhPerHour || 0) * (inp.aux.gridEF || 0); // kWh × t/MWh = kg
  const co2Fossil = f.biogenic ? 0 : co2;
  const co2Bio = f.biogenic ? co2 : 0;
  const co2e = co2Fossil + ch4 * GWP.CH4 + n2o * GWP.N2O + auxCo2;
  return {
    fuel: rate,
    energyGJ: rate * f.GCV * KJ_PER_KCAL * 1e-6,
    co2Fossil, co2Bio, ch4, n2o, so2, co, auxCo2,
    ch4e: ch4 * GWP.CH4, n2oe: n2o * GWP.N2O,
    co2e,
    cost: rate * (inp.fuelPrice || 0),
    electricity: inp.aux.kWhPerHour || 0,
  };
}

/** Scale hourly values to day / month / year from operating pattern. */
export function periods(hourly, op, usefulHeatKcalH, steamKgH) {
  const hDay = op.hoursPerDay;
  const hMonth = hDay * op.daysPerMonth;
  const hYear = hMonth * op.monthsPerYear;
  const scale = (hrs) => {
    const o = {};
    for (const [k, v] of Object.entries(hourly)) o[k] = v * hrs;
    o.usefulGJ = (usefulHeatKcalH || 0) * KJ_PER_KCAL * 1e-6 * hrs;
    o.steam = (steamKgH || 0) * hrs;
    o.hours = hrs;
    return o;
  };
  return { day: scale(hDay), month: scale(hMonth), year: scale(hYear) };
}

/** Fuel composition after drying to a target moisture (other constituents and GCV rescale). */
export function dryFuel(fuel, targetM) {
  const k = (100 - targetM) / (100 - fuel.M);
  const out = { ...fuel, M: targetM, GCV: fuel.GCV * k };
  for (const e of ['C', 'H', 'N', 'O', 'S', 'A']) out[e] = fuel[e] * k;
  return out;
}

/** What-if scenarios: recompute indirect efficiency with best-practice targets. */
export function improvements(inp, base, yearly) {
  const t = inp.targets;
  const scen = [];
  const run = (label, tweak, note) => {
    const copy = structuredClone(inp);
    tweak(copy);
    const r = indirectMethod(copy);
    const gain = r.efficiency - base.efficiency;
    if (gain > 0.05) {
      const fuelSave = 1 - base.efficiency / r.efficiency; // fraction of fuel saved
      const combustion = yearly.co2e - yearly.auxCo2;
      scen.push({
        label, note, newEfficiency: r.efficiency, gain,
        fuelSavedPct: fuelSave * 100,
        fuelSavedT: yearly.fuel * fuelSave / 1000,
        costSaved: yearly.cost * fuelSave,
        co2eSavedT: combustion * fuelSave / 1000,
      });
    }
  };
  run('Optimise excess air', (c) => { c.flue.O2 = Math.min(c.flue.O2, t.O2); },
    `Trim O₂ to ${t.O2}% with O₂ analyser / VFD on FD-ID fans`);
  run('Recover flue gas heat', (c) => { c.flue.Tf = Math.min(c.flue.Tf, t.Tf); },
    `Economiser or air pre-heater to bring stack to ${t.Tf} °C`);
  if (inp.fuel.A > 0) {
    run('Reduce unburnt carbon', (c) => {
      c.ash.ucFly = Math.min(c.ash.ucFly, t.ucFly);
      c.ash.ucBottom = Math.min(c.ash.ucBottom, t.ucBottom);
    }, `Fuel sizing, grate speed, bed temperature (target ${t.ucFly}% fly / ${t.ucBottom}% bottom)`);
  }
  run('Combustion tuning (CO)', (c) => { c.flue.COppm = Math.min(c.flue.COppm || 0, 100); },
    'Burner maintenance and air-fuel ratio tuning to keep CO below 100 ppm');
  run('Repair insulation', (c) => {
    if (c.surface.mode === 'measured') c.surface.Ts = Math.min(c.surface.Ts, c.flue.Ta + 25);
    else c.surface.percent = Math.min(c.surface.percent, 0.8);
  }, 'Insulate hot surfaces, valves and flanges (surface < ambient + 25 °C)');
  if (inp.fuel.state === 'solid' && inp.fuel.M > 15) {
    run('Dry the fuel', (c) => { c.fuel = dryFuel(c.fuel, 15); },
      'Covered storage or flue-gas drying of wet solid fuel (to 15% moisture)');
  }
  // Combined
  if (scen.length > 1) {
    const copy = structuredClone(inp);
    copy.flue.O2 = Math.min(copy.flue.O2, t.O2);
    copy.flue.Tf = Math.min(copy.flue.Tf, t.Tf);
    copy.flue.COppm = Math.min(copy.flue.COppm || 0, 100);
    copy.ash.ucFly = Math.min(copy.ash.ucFly, t.ucFly);
    copy.ash.ucBottom = Math.min(copy.ash.ucBottom, t.ucBottom);
    if (copy.surface.mode === 'measured') copy.surface.Ts = Math.min(copy.surface.Ts, copy.flue.Ta + 25);
    else copy.surface.percent = Math.min(copy.surface.percent, 0.8);
    if (copy.fuel.state === 'solid' && copy.fuel.M > 15) copy.fuel = dryFuel(copy.fuel, 15);
    const r = indirectMethod(copy);
    const fuelSave = 1 - base.efficiency / r.efficiency;
    const combustion = yearly.co2e - yearly.auxCo2;
    scen.push({
      label: 'All measures combined', note: 'Savings do not simply add up; this is recalculated together.',
      newEfficiency: r.efficiency, gain: r.efficiency - base.efficiency, combined: true,
      fuelSavedPct: fuelSave * 100, fuelSavedT: yearly.fuel * fuelSave / 1000,
      costSaved: yearly.cost * fuelSave, co2eSavedT: combustion * fuelSave / 1000,
    });
  }
  return scen;
}

/** Input sanity checks; returns a list of warning strings. */
export function validate(inp, ind, dir) {
  const w = [];
  const f = inp.fuel;
  const sum = f.C + f.H + f.N + f.O + f.S + f.M + f.A;
  if (Math.abs(sum - 100) > 1) w.push(`Fuel ultimate analysis adds up to ${sum.toFixed(1)}%, not 100%. Check the lab report.`);
  if (inp.flue.Tf <= inp.flue.Ta) w.push('Flue gas temperature must be higher than ambient temperature.');
  if (inp.flue.O2 >= 15) w.push(`Flue gas O₂ of ${inp.flue.O2}% means very high excess air (or air ingress before the sampling point).`);
  if (inp.flue.COppm > 1000) w.push('CO above 1000 ppm indicates incomplete combustion. Check burner / grate and air supply.');
  if (inp.flue.Tf > 300) w.push('Stack temperature above 300 °C: large heat recovery potential (economiser / APH), or check the thermocouple.');
  if (ind && (ind.efficiency < 40 || ind.efficiency > 95)) w.push(`Indirect efficiency of ${ind.efficiency.toFixed(1)}% is outside the expected range. Re-check inputs.`);
  if (dir && (dir.efficiency < 40 || dir.efficiency > 100)) w.push(`Direct efficiency of ${dir.efficiency.toFixed(1)}% is outside the expected range. Re-check steam flow and fuel consumption (meters, units).`);
  if (ind && dir && Math.abs(ind.efficiency - dir.efficiency) > 5) {
    w.push(`Direct (${dir.efficiency.toFixed(1)}%) and indirect (${ind.efficiency.toFixed(1)}%) results differ by more than 5 points. Usually this means fuel or steam flow was not measured over the same period, the fuel GCV is off, or there is unaccounted blowdown.`);
  }
  return w;
}

/** Run everything. */
export function evaluate(inp) {
  const ind = indirectMethod(inp);
  const dir = directMethod(inp);
  const hourly = hourlyFlows(inp, ind);
  const reported = inp.basis === 'direct' && dir ? dir.efficiency : ind.efficiency;
  const useful = inp.fuelRate * inp.fuel.GCV * reported / 100; // kcal/h
  const steamKgH = inp.outputType === 'steam' ? inp.steam.flow : 0;
  const per = periods(hourly, inp.op, useful, steamKgH);
  const base = { efficiency: ind.efficiency };
  const scen = improvements(inp, base, per.year);
  const [lo, hi] = inp.fuel.benchmark || [75, 82];
  const rating = reported >= hi ? 'Good' : reported >= lo ? 'Average' : 'Needs attention';
  return {
    indirect: ind, direct: dir, hourly, periods: per, scenarios: scen,
    efficiency: reported, rating, benchmark: [lo, hi],
    warnings: validate(inp, ind, dir),
    kpi: {
      evaporationRatio: dir && dir.evaporationRatio,
      co2ePerTonneSteam: steamKgH > 0 ? hourly.co2e / (steamKgH / 1000) : null,
      co2ePerGJUseful: useful > 0 ? hourly.co2e / (useful * KJ_PER_KCAL * 1e-6) : null,
      ncv: ncv(inp.fuel),
    },
  };
}
