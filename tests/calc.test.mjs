// Run with: node --test tests/
// Checks the engine against the BEE Guide Book 2 (Ch. 2) coal-fired worked example
// and basic physical sanity of the direct method and emissions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FUELS } from '../assets/js/fuels.js';
import { indirectMethod, directMethod, evaluate } from '../assets/js/calc.js';
import { steamEnthalpy, kscgToBarA } from '../assets/js/steam.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a.toFixed(3)}, expected ${b} ± ${tol}`);

function sample(overrides = {}) {
  return {
    fuel: { ...FUELS.indian_coal },
    fuelRate: 1000, fuelPrice: 8,
    outputType: 'steam',
    steam: { flow: 4800, pressure: 10, superheated: false, temp: null, dryness: 1, feedTemp: 60 },
    fluid: { flow: 0, tin: 0, tout: 0, cp: 1 },
    flue: { O2: 7, CO2: 0, COppm: 0, Tf: 190, Ta: 30, RH: 60, humidity: 0.0204 },
    ash: { flyShare: 10, ucFly: 0, ucBottom: 0 },
    surface: { mode: 'percent', percent: 1.0 },
    aux: { kWhPerHour: 50, gridEF: 0.727 },
    op: { hoursPerDay: 24, daysPerMonth: 25, monthsPerYear: 12 },
    targets: { O2: 5, Tf: 160, ucFly: 2, ucBottom: 5 },
    basis: 'indirect',
    ...overrides,
  };
}

test('BEE coal example: theoretical air, excess air and heat losses', () => {
  const r = indirectMethod(sample());
  near(r.details.theoAir, 5.32, 0.02, 'theoretical air kg/kg');
  near(r.details.excessAirPct, 50, 0.01, 'excess air %');
  near(r.details.actualAir, 7.97, 0.02, 'actual air kg/kg');
  near(r.losses.dryFlueGas, 7.61, 0.1, 'dry flue gas loss %');
  near(r.losses.hydrogen, 4.07, 0.05, 'hydrogen loss %');
  near(r.losses.fuelMoisture, 0.98, 0.02, 'fuel moisture loss %');
  near(r.losses.airMoisture, 0.29, 0.02, 'air moisture loss %');
});

test('unburnt carbon and CO add losses', () => {
  const a = indirectMethod(sample());
  const b = indirectMethod(sample({ ash: { flyShare: 10, ucFly: 5, ucBottom: 10 }, flue: { ...sample().flue, COppm: 500 } }));
  assert.ok(b.efficiency < a.efficiency - 3);
  assert.ok(b.losses.co > 0 && b.losses.bottomAsh > b.losses.flyAsh);
});

test('steam enthalpy at 10 kg/cm²g saturated and superheated', () => {
  const p = kscgToBarA(10);
  near(steamEnthalpy(p, null).h, 2780, 5, 'saturated hg kJ/kg');
  near(steamEnthalpy(kscgToBarA(39.8), 400).h, 3214, 35, 'superheated 40 bar 400 °C');
});

test('direct method and emissions are consistent', () => {
  const r = evaluate(sample());
  assert.ok(r.direct.efficiency > 60 && r.direct.efficiency < 90);
  // CO2 from carbon: 1000 kg/h × 0.4111 × 44/12 = 1507 kg/h
  near(r.hourly.co2Fossil, 1507.4, 1, 'CO2 kg/h');
  near(r.periods.year.fuel, 1000 * 24 * 25 * 12, 1e-6, 'yearly fuel kg');
  assert.ok(r.scenarios.length > 0);
});

test('biomass CO2 is reported as biogenic, not in CO2e', () => {
  const r = evaluate(sample({ fuel: { ...FUELS.rice_husk } }));
  assert.equal(r.hourly.co2Fossil, 0);
  assert.ok(r.hourly.co2Bio > 0);
  assert.ok(r.hourly.co2e < r.hourly.co2Bio);
});

test('all fuels give sensible efficiency at typical settings', () => {
  for (const [k, f] of Object.entries(FUELS)) {
    const r = evaluate(sample({ fuel: { ...f }, flue: { O2: f.targetO2, CO2: 0, COppm: 50, Tf: f.targetTf + 40, Ta: 30, RH: 60 } }));
    assert.ok(r.indirect.efficiency > 55 && r.indirect.efficiency < 95, `${k}: ${r.indirect.efficiency}`);
  }
});
