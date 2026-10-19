import { FUELS, CEA_GRID_EF } from './fuels.js';
import { SECTORS, BOILER_TYPES } from './sectors.js';
import { evaluate, LOSS_LABELS } from './calc.js';
import * as C from './charts.js';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman & Nicobar', 'Chandigarh', 'Dadra & Nagar Haveli and Daman & Diu', 'Lakshadweep'];

const FUEL_UNITS = ['kg/h', 't/h', 'kg/day', 't/day', 'L/h', 'L/day', 'SCM/h', 'SCM/day'];
const STORE_KEY = 'boiler-tool-inputs-v1';

const isSolid = (v) => FUELS[v.fuelType]?.state === 'solid' || (v.fuelType === 'custom' && Number(v.A) > 0);
const isSteam = (v) => v.outputType === 'steam';
const usesVolume = (v) => /^(L|SCM)\//.test(v.fuelUnit);

// --- Questionnaire schema ------------------------------------------------
const SECTIONS = [
  { id: 'unit', title: 'Unit & boiler', intro: 'Who and what is being assessed. Used for the report header.', fields: [
    { id: 'unitName', label: 'Unit / company name', type: 'text', def: '' },
    { id: 'state', label: 'State', type: 'select', options: () => STATES, def: 'Gujarat' },
    { id: 'cluster', label: 'City / MSME cluster', type: 'text', def: '' },
    { id: 'sector', label: 'Sector', type: 'select', options: () => Object.keys(SECTORS), def: 'Textiles' },
    { id: 'subSector', label: 'Sub-sector', type: 'select', options: (v) => SECTORS[v.sector] || ['Other'], def: 'Dyeing & processing' },
    { id: 'sectorOther', label: 'Describe sector / product', type: 'text', def: '', show: (v) => v.sector === 'Other' || v.subSector === 'Other' },
    { id: 'boilerType', label: 'Boiler type', type: 'select', options: () => BOILER_TYPES, def: BOILER_TYPES[0] },
    { id: 'capacity', label: 'Rated capacity', unit: 'TPH or lakh kcal/h', type: 'number', def: 3, step: 0.1 },
    { id: 'makeYear', label: 'Make / year of installation', type: 'text', def: '' },
    { id: 'date', label: 'Assessment date', type: 'date', def: () => new Date().toISOString().slice(0, 10) },
  ] },
  { id: 'ops', title: 'Operating pattern', intro: 'Converts hourly results into daily, monthly and yearly totals.', fields: [
    { id: 'hoursPerDay', label: 'Operating hours per day', unit: 'h', type: 'number', def: 24, step: 0.5, min: 0.5, max: 24 },
    { id: 'daysPerMonth', label: 'Operating days per month', unit: 'days', type: 'number', def: 26, step: 1, min: 1, max: 31 },
    { id: 'monthsPerYear', label: 'Operating months per year', unit: 'months', type: 'number', def: 12, step: 0.5, min: 0.5, max: 12, help: 'Use less than 12 for seasonal units (e.g. rice mills, sugar).' },
  ] },
  { id: 'fuel', title: 'Fuel', intro: 'Pick the fuel; typical Indian properties fill in automatically. Replace them with your lab report (ultimate analysis, as-fired) for best accuracy.', fields: [
    { id: 'fuelType', label: 'Fuel', type: 'select', options: () => Object.entries(FUELS).map(([k, f]) => [k, f.name]), def: 'indian_coal' },
    { id: 'fuelRate', label: 'Fuel consumption', type: 'number', def: 1000, step: 'any', help: 'Average while the boiler is running, measured over the same period as steam flow.' },
    { id: 'fuelUnit', label: 'Consumption unit', type: 'select', options: () => FUEL_UNITS, def: 'kg/h' },
    { id: 'density', label: 'Fuel density', unit: 'kg/L or kg/SCM', type: 'number', def: 0.93, step: 'any', show: usesVolume },
    { id: 'fuelPrice', label: 'Fuel price', unit: (v) => `₹ per ${usesVolume(v) ? v.fuelUnit.split('/')[0] : 'kg'}`, type: 'number', def: 8, step: 'any' },
    { sub: 'Fuel analysis (as fired, % by mass)' },
    { id: 'C', label: 'Carbon', unit: '%', type: 'number', step: 'any' },
    { id: 'H', label: 'Hydrogen', unit: '%', type: 'number', step: 'any' },
    { id: 'N', label: 'Nitrogen', unit: '%', type: 'number', step: 'any' },
    { id: 'O', label: 'Oxygen', unit: '%', type: 'number', step: 'any' },
    { id: 'S', label: 'Sulphur', unit: '%', type: 'number', step: 'any' },
    { id: 'M', label: 'Moisture', unit: '%', type: 'number', step: 'any' },
    { id: 'A', label: 'Ash', unit: '%', type: 'number', step: 'any' },
    { id: 'GCV', label: 'Gross calorific value (GCV)', unit: 'kcal/kg', type: 'number', step: 'any' },
    { sum: true },
  ] },
  { id: 'output', title: 'Steam / heat output', intro: 'Needed for the direct method and steam-based indicators. Leave flow at 0 to skip the direct method.', fields: [
    { id: 'outputType', label: 'Output', type: 'select', options: () => [['steam', 'Steam'], ['hotwater', 'Hot water'], ['thermic', 'Thermic fluid']], def: 'steam' },
    { id: 'steamFlow', label: 'Steam generation', unit: 'kg/h', type: 'number', def: 4800, step: 'any', show: isSteam, help: 'From steam flow meter, or feed water meter minus blowdown.' },
    { id: 'steamPressure', label: 'Steam pressure', unit: 'kg/cm² (g)', type: 'number', def: 10, step: 'any', show: isSteam },
    { id: 'steamCondition', label: 'Steam condition', type: 'select', options: () => [['sat', 'Saturated'], ['sup', 'Superheated']], def: 'sat', show: isSteam },
    { id: 'steamTemp', label: 'Steam temperature', unit: '°C', type: 'number', def: 250, step: 'any', show: (v) => isSteam(v) && v.steamCondition === 'sup' },
    { id: 'dryness', label: 'Dryness fraction', type: 'number', def: 0.98, step: 0.01, min: 0.8, max: 1, show: (v) => isSteam(v) && v.steamCondition === 'sat' },
    { id: 'feedTemp', label: 'Feed water temperature', unit: '°C', type: 'number', def: 60, step: 'any', show: isSteam },
    { id: 'enthalpyOverride', label: 'Steam enthalpy override', unit: 'kJ/kg (optional)', type: 'number', def: '', step: 'any', show: isSteam, help: 'Leave blank to use built-in steam tables.' },
    { id: 'fluidFlow', label: 'Fluid flow', unit: 'kg/h', type: 'number', def: 20000, step: 'any', show: (v) => !isSteam(v), help: 'For thermic fluid: m³/h × density (≈ 850 kg/m³ hot).' },
    { id: 'fluidIn', label: 'Inlet (return) temperature', unit: '°C', type: 'number', def: 230, step: 'any', show: (v) => !isSteam(v) },
    { id: 'fluidOut', label: 'Outlet (supply) temperature', unit: '°C', type: 'number', def: 260, step: 'any', show: (v) => !isSteam(v) },
    { id: 'fluidCp', label: 'Specific heat of fluid', unit: 'kcal/kg °C', type: 'number', def: 0.55, step: 'any', show: (v) => !isSteam(v), help: 'Water 1.0; mineral thermic oil 0.5–0.6 at operating temperature.' },
  ] },
  { id: 'flue', title: 'Flue gas & ash', intro: 'Measure with a flue gas analyser at the boiler outlet (after economiser / APH, before any dilution).', fields: [
    { id: 'O2', label: 'Oxygen (O₂) in flue gas', unit: '% dry', type: 'number', def: 7, step: 'any' },
    { id: 'CO2', label: 'CO₂ in flue gas', unit: '% dry (optional)', type: 'number', def: '', step: 'any', help: 'Blank = estimated from O₂ and fuel analysis.' },
    { id: 'COppm', label: 'Carbon monoxide (CO)', unit: 'ppm', type: 'number', def: 100, step: 'any' },
    { id: 'Tf', label: 'Flue gas temperature at stack', unit: '°C', type: 'number', def: 190, step: 'any' },
    { id: 'Ta', label: 'Ambient (combustion air) temperature', unit: '°C', type: 'number', def: 30, step: 'any' },
    { id: 'RH', label: 'Relative humidity', unit: '%', type: 'number', def: 60, step: 'any', min: 0, max: 100 },
    { sub: 'Ash (solid fuels)', show: isSolid },
    { id: 'flyShare', label: 'Fly ash share of total ash', unit: '%', type: 'number', def: 20, step: 'any', show: isSolid, help: 'Typical: FBC 60–80%, stoker 20–30%, fixed grate 10–15%.' },
    { id: 'ucFly', label: 'Unburnt carbon in fly ash', unit: '% (LOI)', type: 'number', def: 3, step: 'any', show: isSolid },
    { id: 'ucBottom', label: 'Unburnt carbon in bottom ash', unit: '% (LOI)', type: 'number', def: 8, step: 'any', show: isSolid },
    { sub: 'Radiation & convection (surface) loss' },
    { id: 'surfaceMode', label: 'How to estimate', type: 'select', options: () => [['percent', 'Typical value (%)'], ['measured', 'From surface temperature survey']], def: 'percent' },
    { id: 'radPercent', label: 'Radiation & convection loss', unit: '%', type: 'number', def: 1.0, step: 'any', show: (v) => v.surfaceMode === 'percent', help: 'Typical 0.5–1% well insulated, 1.5–3% small or poorly insulated boilers.' },
    { id: 'Ts', label: 'Average surface temperature', unit: '°C', type: 'number', def: 60, step: 'any', show: (v) => v.surfaceMode === 'measured' },
    { id: 'area', label: 'Hot surface area', unit: 'm²', type: 'number', def: 60, step: 'any', show: (v) => v.surfaceMode === 'measured' },
    { id: 'wind', label: 'Air velocity near surface', unit: 'm/s', type: 'number', def: 1, step: 'any', show: (v) => v.surfaceMode === 'measured' },
  ] },
  { id: 'more', title: 'Electricity & targets', intro: 'Auxiliary electricity adds Scope 2 emissions. Targets drive the improvement suggestions.', fields: [
    { id: 'auxKw', label: 'Auxiliary power (FD/ID fans, feed pump, fuel handling)', unit: 'kW average', type: 'number', def: 30, step: 'any' },
    { id: 'gridEF', label: 'Grid emission factor', unit: 't CO₂/MWh', type: 'number', def: CEA_GRID_EF, step: 'any', help: 'CEA CO₂ Baseline Database. Use 0 if powered by on-site renewables.' },
    { id: 'basis', label: 'Headline efficiency', type: 'select', options: () => [['indirect', 'Indirect (heat loss) method'], ['direct', 'Direct method']], def: 'indirect' },
    { sub: 'Best-practice targets' },
    { id: 'tO2', label: 'Target O₂', unit: '%', type: 'number', step: 'any' },
    { id: 'tTf', label: 'Target stack temperature', unit: '°C', type: 'number', step: 'any', help: 'Keep above acid dew point for sulphur-bearing fuels.' },
    { id: 'tUcFly', label: 'Target unburnt in fly ash', unit: '%', type: 'number', def: 2, step: 'any', show: isSolid },
    { id: 'tUcBottom', label: 'Target unburnt in bottom ash', unit: '%', type: 'number', def: 5, step: 'any', show: isSolid },
  ] },
];

const FIELDS = SECTIONS.flatMap((s) => s.fields.filter((f) => f.id));
const NUMERIC = new Set(FIELDS.filter((f) => f.type === 'number').map((f) => f.id));

// --- State ----------------------------------------------------------------
let v = {};
let step = 0;
let period = 'year';
let lastResult = null;
let lastInputs = null;

function defaults() {
  const o = {};
  for (const f of FIELDS) o[f.id] = typeof f.def === 'function' ? f.def() : (f.def ?? '');
  applyFuel(o, o.fuelType, true);
  return o;
}

function applyFuel(o, key, setUnit) {
  const f = FUELS[key];
  if (!f) return;
  for (const k of ['C', 'H', 'N', 'O', 'S', 'M', 'A', 'GCV']) o[k] = f[k];
  o.fuelPrice = f.price;
  o.tO2 = f.targetO2;
  o.tTf = f.targetTf;
  if (setUnit) {
    o.fuelUnit = f.state === 'gas' && key !== 'lpg' ? 'SCM/h' : f.state === 'liquid' ? 'L/h' : 'kg/h';
  }
  if (f.density) o.density = f.density;
  if (usesVolume(o) && f.density) o.fuelPrice = +(f.price * f.density).toFixed(2);
}

const load = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; } };
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } };

// --- Form rendering -------------------------------------------------------
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function optionsHtml(f) {
  return f.options(v).map((o) => {
    const [val, lab] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(val)}"${String(v[f.id]) === String(val) ? ' selected' : ''}>${esc(lab)}</option>`;
  }).join('');
}

function fieldHtml(f) {
  if (f.sub) return `<div class="subhead" data-show="${f.show ? 1 : ''}">${esc(f.sub)}</div>`;
  if (f.sum) return '<div class="sumline" id="sumline"></div>';
  const unit = typeof f.unit === 'function' ? f.unit(v) : f.unit;
  const lab = `<label for="f-${f.id}">${esc(f.label)}${unit ? ` <span class="unit" id="u-${f.id}">(${esc(unit)})</span>` : ''}</label>`;
  let input;
  if (f.type === 'select') input = `<select id="f-${f.id}" name="${f.id}">${optionsHtml(f)}</select>`;
  else {
    const attrs = [f.step != null ? `step="${f.step}"` : '', f.min != null ? `min="${f.min}"` : '', f.max != null ? `max="${f.max}"` : ''].join(' ');
    input = `<input id="f-${f.id}" name="${f.id}" type="${f.type}" ${f.type === 'number' ? 'inputmode="decimal"' : ''} ${attrs} value="${esc(v[f.id] ?? '')}">`;
  }
  return `<div class="field" data-id="${f.id}">${lab}${input}${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}</div>`;
}

function renderForm() {
  $('#steps').innerHTML = SECTIONS.map((s, i) => `<button type="button" data-i="${i}" class="${i === step ? 'on' : ''}"><span class="n">${i + 1}</span>${esc(s.title)}</button>`).join('');
  $('#sections').innerHTML = SECTIONS.map((s, i) => `
    <fieldset class="section" data-i="${i}" ${i === step ? '' : 'hidden'} style="border:1px solid var(--line)">
      <h2>${i + 1}. ${esc(s.title)}</h2><p class="intro">${esc(s.intro)}</p>
      <div class="fields">${s.fields.map(fieldHtml).join('')}</div>
    </fieldset>`).join('');
  refresh();
}

function refresh() {
  for (const s of SECTIONS) {
    for (const f of s.fields) {
      if (f.id) {
        const el = document.querySelector(`.field[data-id="${f.id}"]`);
        if (el) el.hidden = f.show ? !f.show(v) : false;
        if (typeof f.unit === 'function') { const u = $(`#u-${f.id}`); if (u) u.textContent = `(${f.unit(v)})`; }
      }
    }
  }
  document.querySelectorAll('.subhead').forEach((el, i) => {
    const subs = SECTIONS.flatMap((s) => s.fields.filter((f) => f.sub));
    const f = subs[i]; el.hidden = f && f.show ? !f.show(v) : false;
  });
  const sum = ['C', 'H', 'N', 'O', 'S', 'M', 'A'].reduce((a, k) => a + (Number(v[k]) || 0), 0);
  const sl = $('#sumline');
  if (sl) {
    sl.textContent = `Total of analysis: ${sum.toFixed(2)}%${Math.abs(sum - 100) > 1 ? ' (should be 100%)' : ''}`;
    sl.className = 'sumline' + (Math.abs(sum - 100) > 1 ? ' bad' : '');
  }
  $('#btn-prev').disabled = step === 0;
  $('#btn-next').hidden = step === SECTIONS.length - 1;
}

function setStep(i) {
  step = Math.max(0, Math.min(SECTIONS.length - 1, i));
  document.querySelectorAll('#sections .section').forEach((el) => { el.hidden = Number(el.dataset.i) !== step; });
  document.querySelectorAll('#steps button').forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === step));
  refresh();
}

function onChange(e) {
  const id = e.target.name;
  if (!id) return;
  v[id] = e.target.value;
  let rerender = false;
  if (id === 'fuelType') { applyFuel(v, v.fuelType, true); rerender = true; }
  if (id === 'fuelUnit') {
    const f = FUELS[v.fuelType];
    if (f) v.fuelPrice = usesVolume(v) && v.density ? +(f.price * v.density).toFixed(2) : f.price;
    rerender = true;
  }
  if (id === 'sector') { v.subSector = SECTORS[v.sector][0]; rerender = true; }
  if (id === 'boilerType') {
    const t = v.boilerType;
    if (/Fluidised/.test(t)) v.flyShare = 70;
    else if (/stoker/.test(t)) v.flyShare = 25;
    else if (/Fixed grate/.test(t)) v.flyShare = 15;
    if (/Thermic/.test(t)) { v.outputType = 'thermic'; v.fluidCp = 0.55; }
    else if (/Hot water/.test(t)) { v.outputType = 'hotwater'; v.fluidCp = 1.0; v.fluidIn = 60; v.fluidOut = 85; }
    else v.outputType = 'steam';
    rerender = true;
  }
  if (id === 'outputType') {
    if (v.outputType === 'hotwater') { v.fluidCp = 1.0; v.fluidIn = 60; v.fluidOut = 85; }
    if (v.outputType === 'thermic') { v.fluidCp = 0.55; v.fluidIn = 230; v.fluidOut = 260; }
    rerender = true;
  }
  save();
  if (rerender) {
    const active = document.activeElement?.id;
    renderForm();
    if (active) document.getElementById(active)?.focus();
  } else refresh();
}

// --- Build engine inputs -------------------------------------------------
const num = (x, d = 0) => { const n = parseFloat(x); return Number.isFinite(n) ? n : d; };

function buildInputs() {
  const fuelBase = FUELS[v.fuelType] || FUELS.custom;
  const fuel = { ...fuelBase };
  for (const k of ['C', 'H', 'N', 'O', 'S', 'M', 'A', 'GCV']) fuel[k] = num(v[k]);
  const hpd = num(v.hoursPerDay, 24);
  const [qty, per] = v.fuelUnit.split('/');
  let rate = num(v.fuelRate);
  if (qty === 't') rate *= 1000;
  if (qty === 'L' || qty === 'SCM') rate *= num(v.density, 1);
  if (per === 'day') rate /= hpd;
  let price = num(v.fuelPrice);
  if (qty === 'L' || qty === 'SCM') price /= num(v.density, 1);
  return {
    fuel, fuelRate: rate, fuelPrice: price,
    outputType: v.outputType,
    steam: {
      flow: num(v.steamFlow), pressure: num(v.steamPressure), superheated: v.steamCondition === 'sup',
      temp: num(v.steamTemp), dryness: num(v.dryness, 1), feedTemp: num(v.feedTemp), enthalpyOverride: num(v.enthalpyOverride),
    },
    fluid: { flow: num(v.fluidFlow), tin: num(v.fluidIn), tout: num(v.fluidOut), cp: num(v.fluidCp, 1) },
    flue: { O2: num(v.O2), CO2: num(v.CO2), COppm: num(v.COppm), Tf: num(v.Tf), Ta: num(v.Ta), RH: num(v.RH, 60) },
    ash: fuel.A > 0 ? { flyShare: num(v.flyShare, 20), ucFly: num(v.ucFly), ucBottom: num(v.ucBottom) } : { flyShare: 0, ucFly: 0, ucBottom: 0 },
    surface: { mode: v.surfaceMode, percent: num(v.radPercent), Ts: num(v.Ts), area: num(v.area), wind: num(v.wind) },
    aux: { kWhPerHour: num(v.auxKw), gridEF: num(v.gridEF) },
    op: { hoursPerDay: hpd, daysPerMonth: num(v.daysPerMonth, 26), monthsPerYear: num(v.monthsPerYear, 12) },
    targets: { O2: num(v.tO2, fuelBase.targetO2), Tf: num(v.tTf, fuelBase.targetTf), ucFly: num(v.tUcFly, 2), ucBottom: num(v.tUcBottom, 5) },
    basis: v.basis,
  };
}

// --- Formatting helpers --------------------------------------------------
const f1 = (x) => C.fmt(x, 1);
const f2 = (x) => C.fmt(x, 2);
const f0 = (x) => C.fmt(x, 0);
function rupees(x) {
  if (!isFinite(x)) return '–';
  if (x >= 1e7) return `₹${C.fmt(x / 1e7, 2)} Cr`;
  if (x >= 1e5) return `₹${C.fmt(x / 1e5, 2)} L`;
  return `₹${f0(x)}`;
}
function mass(kg) {
  if (kg >= 1000) return `${C.fmt(kg / 1000, kg >= 1e5 ? 0 : 1)} <small>t</small>`;
  return `${C.fmt(kg, kg < 10 ? 2 : 0)} <small>kg</small>`;
}
const PERIOD_LABEL = { day: 'per day', month: 'per month', year: 'per year' };

// --- Results --------------------------------------------------------------
function calculate() {
  lastInputs = buildInputs();
  const errs = [];
  if (!(lastInputs.fuelRate > 0)) errs.push('Enter fuel consumption.');
  if (!(lastInputs.fuel.GCV > 0)) errs.push('Enter the fuel GCV.');
  if (errs.length) { alert(errs.join('\n')); return; }
  lastResult = evaluate(lastInputs);
  $('#results').hidden = false;
  renderResults();
  $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function lossList(r) {
  return Object.entries(r.indirect.losses).filter(([, x]) => x > 0.005).map(([k, x]) => ({ key: k, label: LOSS_LABELS[k], value: x }));
}

function renderResults() {
  const r = lastResult, inp = lastInputs;
  const P = r.periods[period];
  const fuelName = FUELS[v.fuelType]?.name || 'Fuel';
  const sector = [v.sector, v.subSector, v.sectorOther].filter((x) => x && x !== 'Other').join(' · ');
  $('#res-meta').textContent = [v.unitName || 'Unnamed unit', v.cluster, v.state, sector, v.boilerType, fuelName, v.date].filter(Boolean).join(' | ');

  $('#warnings').innerHTML = r.warnings.map((w) => `<div class="warn">${esc(w)}</div>`).join('');

  const other = inp.basis === 'direct' ? r.indirect.efficiency : r.direct?.efficiency;
  const otherName = inp.basis === 'direct' ? 'Indirect method' : 'Direct method';
  const kpis = [
    { k: `Efficiency (${inp.basis === 'direct' && r.direct ? 'direct' : 'indirect'})`, v: `${f1(r.efficiency)}<small>%</small>`,
      d: `<span class="badge ${r.rating.split(' ')[0]}">${r.rating}</span> typical ${r.benchmark[0]}–${r.benchmark[1]}%` },
    { k: otherName, v: other != null ? `${f1(other)}<small>%</small>` : '–', d: other != null ? 'cross-check' : 'enter output flow to compute' },
    { k: `Fuel ${PERIOD_LABEL[period]}`, v: mass(P.fuel), d: `${f0(inp.fuelRate)} kg/h while running` },
    { k: `Energy input ${PERIOD_LABEL[period]}`, v: `${C.fmt(P.energyGJ, P.energyGJ < 100 ? 1 : 0)} <small>GJ</small>`, d: `${f0(P.usefulGJ)} GJ useful heat` },
    { k: `GHG ${PERIOD_LABEL[period]}`, v: `${C.fmt(P.co2e / 1000, P.co2e < 1e5 ? 2 : 0)} <small>t CO₂e</small>`, d: P.co2Bio > 0 ? `+ ${f1(P.co2Bio / 1000)} t biogenic CO₂` : 'Scope 1 + Scope 2' },
    { k: `Fuel cost ${PERIOD_LABEL[period]}`, v: rupees(P.cost), d: `₹${f2(inp.fuelPrice)} per kg` },
  ];
  if (r.kpi.evaporationRatio) kpis.push({ k: 'Evaporation ratio', v: `${f2(r.kpi.evaporationRatio)}`, d: 'kg steam per kg fuel' });
  if (r.kpi.co2ePerTonneSteam != null) kpis.push({ k: 'Carbon intensity', v: `${f0(r.kpi.co2ePerTonneSteam)} <small>kg/t</small>`, d: 'kg CO₂e per tonne of steam' });
  else if (r.kpi.co2ePerGJUseful != null) kpis.push({ k: 'Carbon intensity', v: `${f1(r.kpi.co2ePerGJUseful)} <small>kg/GJ</small>`, d: 'kg CO₂e per GJ useful heat' });
  const best = r.scenarios.find((s) => s.combined) || r.scenarios[0];
  if (best) kpis.push({ k: 'Saving potential', v: rupees(best.costSaved), d: `per year, ${f1(best.co2eSavedT)} t CO₂e avoided` });
  $('#kpis').innerHTML = kpis.map((x) => `<div class="kpi"><div class="k">${x.k}</div><div class="v">${x.v}</div><div class="d">${x.d}</div></div>`).join('');

  // Charts
  const losses = lossList(r);
  $('#cap-gauge').textContent = `Red below ${r.benchmark[0]}%, amber typical, green above ${r.benchmark[1]}% for ${fuelName.toLowerCase()}. Blue line marks good practice.`;
  C.gauge('ch-gauge', r.efficiency, r.benchmark, other);
  C.donut('ch-donut', ['Useful heat', ...losses.map((l) => l.label)], [r.indirect.efficiency, ...losses.map((l) => l.value)],
    `<b>${f1(r.indirect.efficiency)}%</b><br>useful`, { unit: '%', colors: [C.USEFUL, ...C.huePal(losses.length)] });

  const day = r.periods.day;
  const effFrac = r.indirect.efficiency / 100;
  $('#cap-sankey').textContent = `GJ per operating day, indirect method. Fuel heat in ${f0(day.energyGJ)} GJ/day.`;
  C.sankey('ch-sankey', `Fuel (${fuelName})`, 'Useful heat to process', day.energyGJ * effFrac,
    losses.map((l) => ({ label: l.label, value: day.energyGJ * l.value / 100 })));
  C.rankedBars('ch-losses', losses.map((l) => l.label), losses.map((l) => l.value));
  C.waterfall('ch-waterfall', losses.map((l) => shortLoss(l.key)), losses.map((l) => l.value), r.indirect.efficiency);

  const per = r.periods;
  const pnames = [['day', 'Per day'], ['month', 'Per month'], ['year', 'Per year']];
  C.facetBars('ch-energy', pnames.map(([k, t]) => ({ title: t, bars: [
    { label: 'Fuel heat in', value: per[k].energyGJ },
    { label: 'Useful heat', value: per[k].usefulGJ },
    { label: 'Losses', value: per[k].energyGJ - per[k].usefulGJ },
  ] })), 'GJ', { unit: 'GJ', colors: ['#7F7F7F', C.USEFUL, '#F8766D'], bottom: 60 });

  const ghgBars = (p) => [
    { label: 'CO₂ (fuel)', value: p.co2Fossil / 1000 },
    { label: 'CH₄ as CO₂e', value: p.ch4e / 1000 },
    { label: 'N₂O as CO₂e', value: p.n2oe / 1000 },
    { label: 'Electricity', value: p.auxCo2 / 1000 },
    { label: 'Biogenic CO₂', value: p.co2Bio / 1000, color: '#B3B3B3', memo: true },
  ];
  C.facetBars('ch-ghg', pnames.map(([k, t]) => ({ title: t, bars: ghgBars(per[k]) })), 't CO₂e', { unit: 't', colors: ['#F8766D', '#7CAE00', '#00BFC4', '#C77CFF', '#B3B3B3'] });

  const comp = [['CO₂ (fuel)', P.co2Fossil], ['CH₄', P.ch4e], ['N₂O', P.n2oe], ['Electricity', P.auxCo2]].filter(([, x]) => x > 0);
  $('#cap-ghgdonut').textContent = `Share of total CO₂e ${PERIOD_LABEL[period]} (Scope 1 + 2)`;
  C.donut('ch-ghgdonut', comp.map((c) => c[0]), comp.map((c) => c[1] / 1000), `<b>${C.fmt(P.co2e / 1000, P.co2e < 1e5 ? 1 : 0)}</b><br>t CO₂e`,
    { unit: 't CO₂e', dec: 2, colors: comp.map((c) => ({ 'CO₂ (fuel)': '#F8766D', 'CH₄': '#7CAE00', 'N₂O': '#00BFC4', 'Electricity': '#C77CFF' }[c[0]])) });

  C.dumbbell('ch-dumbbell', r.scenarios, r.indirect.efficiency);

  renderTables(r, inp);
}

function shortLoss(k) {
  return { dryFlueGas: 'Dry flue gas', hydrogen: 'H₂ in fuel', fuelMoisture: 'Fuel moisture', airMoisture: 'Air moisture',
    co: 'CO', radiation: 'Radiation', flyAsh: 'Fly ash', bottomAsh: 'Bottom ash' }[k];
}

function periodRows(r, inp) {
  const p = r.periods;
  const rows = [
    ['Operating hours', 'h', (x) => x.hours, 0],
    ['Fuel consumed', 't', (x) => x.fuel / 1000, 2],
    ['Fuel cost', '₹', (x) => x.cost, 0],
    ['Fuel heat input', 'GJ', (x) => x.energyGJ, 1],
    ['Useful heat', 'GJ', (x) => x.usefulGJ, 1],
  ];
  if (inp.outputType === 'steam' && inp.steam.flow > 0) rows.push(['Steam generated', 't', (x) => x.steam / 1000, 1]);
  rows.push(
    ['Auxiliary electricity', 'kWh', (x) => x.electricity, 0],
    ['CO₂ from fuel (fossil)', 't', (x) => x.co2Fossil / 1000, 2],
    ['CH₄', 'kg', (x) => x.ch4, 2],
    ['N₂O', 'kg', (x) => x.n2o, 2],
    ['CO₂ from electricity', 't', (x) => x.auxCo2 / 1000, 2],
    ['Total GHG', 't CO₂e', (x) => x.co2e / 1000, 2, true],
    ['Biogenic CO₂ (memo)', 't', (x) => x.co2Bio / 1000, 2],
    ['SO₂', 'kg', (x) => x.so2, 1],
    ['CO', 'kg', (x) => x.co, 1],
  );
  return rows.map(([name, unit, fn, d, total]) => ({ name, unit, d, total, day: fn(p.day), month: fn(p.month), year: fn(p.year) }));
}

function renderTables(r, inp) {
  const rows = periodRows(r, inp);
  $('#cap-period').textContent = `Based on ${inp.op.hoursPerDay} h/day, ${inp.op.daysPerMonth} days/month, ${inp.op.monthsPerYear} months/year`;
  $('#tbl-period').innerHTML = `<table><thead><tr><th>Item</th><th>Unit</th><th>Day</th><th>Month</th><th>Year</th></tr></thead><tbody>${
    rows.map((x) => `<tr class="${x.total ? 'total' : ''}"><td>${x.name}</td><td>${x.unit}</td><td>${C.fmt(x.day, x.d)}</td><td>${C.fmt(x.month, x.d)}</td><td>${C.fmt(x.year, x.d)}</td></tr>`).join('')
  }</tbody></table>`;

  $('#tbl-scen').innerHTML = r.scenarios.length ? `<table><thead><tr><th>Measure</th><th>New efficiency</th><th>Gain</th><th>Fuel saved</th><th>Fuel saved / yr</th><th>Saving / yr</th><th>CO₂e avoided / yr</th></tr></thead><tbody>${
    r.scenarios.map((s) => `<tr class="${s.combined ? 'total' : ''}"><td>${esc(s.label)}<div class="muted small">${esc(s.note)}</div></td><td>${f1(s.newEfficiency)}%</td><td>+${f1(s.gain)} pts</td><td>${f1(s.fuelSavedPct)}%</td><td>${f1(s.fuelSavedT)} t</td><td>${rupees(s.costSaved)}</td><td>${f1(s.co2eSavedT)} t</td></tr>`).join('')
  }</tbody></table>` : '';

  const d = r.indirect.details;
  const det = [
    ['Theoretical air', `${f2(d.theoAir)} kg/kg fuel`],
    ['Excess air', `${f1(d.excessAirPct)} %`],
    ['Actual air supplied', `${f2(d.actualAir)} kg/kg fuel`],
    ['Dry flue gas', `${f2(d.dryFlueGasMass)} kg/kg fuel`],
    ['Humidity of air', `${C.fmt(d.humidityRatio, 4)} kg/kg dry air`],
    [`CO₂ in flue gas (${inp.flue.CO2 > 0 ? 'measured' : 'estimated'})`, `${f1(d.co2Pct)} % (max ${f1(d.co2Max)} %)`],
    ['Unburnt carbon', `${C.fmt(d.unburntC * 1000, 1)} g/kg fuel`],
    ['Net calorific value (NCV)', `${f0(r.kpi.ncv)} kcal/kg`],
    ...Object.entries(r.indirect.losses).map(([k, x]) => [`Loss: ${LOSS_LABELS[k]}`, `${f2(x)} %`]),
    ['Total losses', `${f2(r.indirect.totalLoss)} %`],
    ['Efficiency, indirect method', `${f2(r.indirect.efficiency)} %`],
  ];
  if (r.direct) {
    if (inp.outputType === 'steam') {
      det.push(['Steam pressure (absolute)', `${f2(r.direct.pressureBarA)} bar, Tsat ${f1(r.direct.tsat)} °C`]);
      det.push(['Steam enthalpy', `${f1(r.direct.steamEnthalpy)} kJ/kg (${f1(r.direct.steamEnthalpy / 4.1868)} kcal/kg)`]);
      det.push(['Feed water enthalpy', `${f1(r.direct.feedEnthalpy)} kJ/kg`]);
    }
    det.push(['Heat output', `${f0(r.direct.heatOut)} kcal/h`]);
    det.push(['Heat input', `${f0(r.direct.heatIn)} kcal/h`]);
    det.push(['Efficiency, direct method', `${f2(r.direct.efficiency)} %`]);
  }
  $('#tbl-details').innerHTML = `<table><tbody>${det.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table>`;
}

// --- Export ---------------------------------------------------------------
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exportCsv() {
  if (!lastResult) return;
  const r = lastResult, inp = lastInputs;
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = [['Section', 'Item', 'Unit', 'Day', 'Month', 'Year'].join(',')];
  for (const f of FIELDS) lines.push(['Input', q(f.label), q(typeof f.unit === 'function' ? f.unit(v) : f.unit || ''), q(v[f.id] ?? ''), '', ''].join(','));
  lines.push(['Result', 'Efficiency (headline)', '%', r.efficiency.toFixed(2), '', ''].join(','));
  lines.push(['Result', 'Efficiency indirect', '%', r.indirect.efficiency.toFixed(2), '', ''].join(','));
  if (r.direct) lines.push(['Result', 'Efficiency direct', '%', r.direct.efficiency.toFixed(2), '', ''].join(','));
  for (const [k, x] of Object.entries(r.indirect.losses)) lines.push(['Loss', q(LOSS_LABELS[k]), '%', x.toFixed(3), '', ''].join(','));
  for (const x of periodRows(r, inp)) lines.push(['Period', q(x.name), q(x.unit), x.day.toFixed(3), x.month.toFixed(3), x.year.toFixed(3)].join(','));
  for (const s of r.scenarios) lines.push(['Improvement', q(s.label), 'pts / t / INR / tCO2e per yr', s.gain.toFixed(2), s.fuelSavedT.toFixed(2), `${s.costSaved.toFixed(0)} | ${s.co2eSavedT.toFixed(2)}`].join(','));
  const name = (v.unitName || 'boiler').replace(/[^\w-]+/g, '_');
  download(`${name}_efficiency_${v.date || ''}.csv`, '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
}

// --- Sample ---------------------------------------------------------------
function sample() {
  v = defaults();
  Object.assign(v, {
    unitName: 'Shree Ganesh Dyeing & Printing Mills', state: 'Gujarat', cluster: 'Surat (Pandesara)', sector: 'Textiles',
    subSector: 'Dyeing & processing', boilerType: 'Travelling grate / chain grate stoker', capacity: 4, makeYear: '2014',
    hoursPerDay: 22, daysPerMonth: 26, monthsPerYear: 12,
    fuelType: 'imported_coal',
  });
  applyFuel(v, 'imported_coal', true);
  Object.assign(v, {
    fuelRate: 520, fuelPrice: 11, steamFlow: 3750, steamPressure: 10.5, steamCondition: 'sat', dryness: 0.97, feedTemp: 70,
    O2: 8.5, COppm: 280, Tf: 215, Ta: 32, RH: 65, flyShare: 25, ucFly: 6, ucBottom: 12,
    surfaceMode: 'percent', radPercent: 1.5, auxKw: 38, basis: 'indirect',
  });
}

// --- Wire up --------------------------------------------------------------
function init() {
  v = { ...defaults(), ...(load() || {}) };
  renderForm();
  const form = $('#form');
  form.addEventListener('change', onChange);
  form.addEventListener('input', (e) => { if (e.target.tagName === 'INPUT') { v[e.target.name] = e.target.value; save(); refresh(); } });
  form.addEventListener('submit', (e) => { e.preventDefault(); calculate(); });
  $('#steps').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setStep(Number(b.dataset.i)); });
  $('#btn-next').addEventListener('click', () => setStep(step + 1));
  $('#btn-prev').addEventListener('click', () => setStep(step - 1));
  $('#btn-sample').addEventListener('click', () => { sample(); save(); renderForm(); calculate(); });
  $('#btn-reset').addEventListener('click', () => { if (confirm('Clear all inputs?')) { v = defaults(); save(); step = 0; renderForm(); $('#results').hidden = true; } });
  $('#btn-save').addEventListener('click', () => download(`${(v.unitName || 'boiler').replace(/[^\w-]+/g, '_')}_inputs.json`, JSON.stringify(v, null, 2), 'application/json'));
  $('#file-load').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { v = { ...defaults(), ...JSON.parse(await file.text()) }; save(); renderForm(); calculate(); }
    catch { alert('That file is not a saved inputs file.'); }
    e.target.value = '';
  });
  $('#btn-csv').addEventListener('click', exportCsv);
  $('#btn-print').addEventListener('click', () => window.print());
  $('#btn-edit').addEventListener('click', () => $('#form').scrollIntoView({ behavior: 'smooth' }));
  $('#period-toggle').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    period = b.dataset.p;
    document.querySelectorAll('#period-toggle button').forEach((x) => x.classList.toggle('on', x === b));
    if (lastResult) renderResults();
  });
  window.addEventListener('beforeprint', C.resizeAll);
  let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(C.resizeAll, 150); });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
