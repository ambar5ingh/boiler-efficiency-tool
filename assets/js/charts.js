// Plotly charts styled after ggplot2's theme_grey() and default hue palette.
/* global Plotly */

// scales::hue_pal()(n) — the ggplot2 default discrete palette.
const HUE = {
  1: ['#F8766D'],
  2: ['#F8766D', '#00BFC4'],
  3: ['#F8766D', '#00BA38', '#619CFF'],
  4: ['#F8766D', '#7CAE00', '#00BFC4', '#C77CFF'],
  5: ['#F8766D', '#A3A500', '#00BF7D', '#00B0F6', '#E76BF3'],
  6: ['#F8766D', '#B79F00', '#00BA38', '#00BFC4', '#619CFF', '#F564E3'],
  7: ['#F8766D', '#C49A00', '#53B400', '#00C094', '#00B6EB', '#A58AFF', '#FB61D7'],
  8: ['#F8766D', '#CD9600', '#7CAE00', '#00BE67', '#00BFC4', '#00A9FF', '#C77CFF', '#FF61CC'],
  9: ['#F8766D', '#D39200', '#93AA00', '#00BA38', '#00C19F', '#00B9E3', '#619CFF', '#DB72FB', '#FF61C3'],
};
export const USEFUL = '#2B6E3F'; // useful heat, kept apart from the loss hues
export const huePal = (n) => HUE[Math.min(Math.max(n, 1), 9)];

const PANEL = '#EBEBEB';
const GRID = '#FFFFFF';
const STRIP = '#D9D9D9';
const TEXT = '#4D4D4D';
const FONT = { family: '"Helvetica Neue", Helvetica, Arial, sans-serif', size: 12, color: TEXT };

const axis = (extra = {}) => ({
  gridcolor: GRID, gridwidth: 1.1, zeroline: false, showline: false,
  ticks: 'outside', ticklen: 4, tickcolor: '#333', tickfont: { color: TEXT, size: 11 },
  title: { font: { size: 12, color: '#222' } }, automargin: true, ...extra,
});

const base = (extra = {}) => ({
  font: FONT, paper_bgcolor: '#FFFFFF', plot_bgcolor: PANEL,
  margin: { l: 56, r: 16, t: 16, b: 48 }, showlegend: false,
  hoverlabel: { font: { family: FONT.family } },
  xaxis: axis(), yaxis: axis(), ...extra,
});

const CONFIG = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ['lasso2d', 'select2d'] };

function draw(id, data, layout) {
  const el = document.getElementById(id);
  if (!el || !window.Plotly) return;
  Plotly.react(el, data, layout, CONFIG);
}

export const fmt = (v, d = 1) => (v == null || !isFinite(v) ? '–'
  : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }));

// --- Efficiency gauge with benchmark bands --------------------------------
export function gauge(id, value, [lo, hi], direct) {
  const data = [{
    type: 'indicator', mode: 'gauge+number' + (direct != null ? '+delta' : ''), value,
    number: { suffix: '%', valueformat: '.1f', font: { size: 44, color: '#222' } },
    delta: direct != null ? { reference: direct, valueformat: '.1f', suffix: ' pts vs direct',
      increasing: { color: TEXT }, decreasing: { color: TEXT }, font: { size: 13 } } : undefined,
    gauge: {
      shape: 'angular',
      axis: { range: [40, 100], ticksuffix: '%', tickcolor: '#333', tickfont: { size: 11 } },
      bar: { color: '#333333', thickness: 0.28 },
      bgcolor: PANEL, borderwidth: 0,
      steps: [
        { range: [40, lo], color: '#F8C9C4' },
        { range: [lo, hi], color: '#FBE3A6' },
        { range: [hi, 100], color: '#A8E0BD' },
      ],
      threshold: { line: { color: '#00A9FF', width: 3 }, thickness: 0.85, value: hi },
    },
  }];
  draw(id, data, { ...base({ margin: { l: 30, r: 30, t: 20, b: 10 } }), plot_bgcolor: '#fff' });
}

// --- Donut of heat balance ------------------------------------------------
export function donut(id, labels, values, centre, opts = {}) {
  const cols = opts.colors || huePal(labels.length);
  draw(id, [{
    type: 'pie', hole: 0.58, labels, values, sort: false, direction: 'clockwise',
    marker: { colors: cols, line: { color: '#FFFFFF', width: 2 } },
    textinfo: 'percent', textposition: 'inside', insidetextorientation: 'horizontal',
    texttemplate: '%{percent:.1%}', textfont: { color: '#fff', size: 11 },
    hovertemplate: `%{label}<br>%{value:,.${opts.dec ?? 1}f} ${opts.unit || ''}<br>%{percent:.1%}<extra></extra>`,
  }], {
    ...base({ margin: { l: 8, r: 8, t: 8, b: 8 } }), showlegend: true,
    legend: { orientation: 'v', x: 1.02, y: 0.5, font: { size: 11 }, bgcolor: 'rgba(0,0,0,0)' },
    annotations: [{ text: centre, showarrow: false, font: { size: 15, color: '#222' }, x: 0.5, y: 0.5, xref: 'paper', yref: 'paper' }],
  });
}

// --- Horizontal ranked bar (geom_col + coord_flip) ------------------------
export function rankedBars(id, labels, values, unit = '%') {
  const idx = labels.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const L = idx.map((i) => labels[i]); const V = idx.map((i) => values[i]);
  const cols = huePal(labels.length);
  draw(id, [{
    type: 'bar', orientation: 'h', x: V, y: L,
    marker: { color: idx.map((i) => cols[i]) },
    text: V.map((v) => fmt(v, 2) + unit), textposition: 'outside', cliponaxis: false,
    hovertemplate: '%{y}: %{x:.2f}' + unit + '<extra></extra>',
  }], base({
    margin: { l: 10, r: 50, t: 10, b: 44 },
    xaxis: axis({ title: { text: `Loss (${unit} of heat input)` }, rangemode: 'tozero' }),
    yaxis: axis({ gridcolor: GRID }),
  }));
}

// --- Waterfall 100% → efficiency ------------------------------------------
export function waterfall(id, labels, values, eff) {
  draw(id, [{
    type: 'waterfall', orientation: 'v',
    x: ['Heat input', ...labels, 'Efficiency'],
    y: [100, ...values.map((v) => -v), eff],
    measure: ['absolute', ...values.map(() => 'relative'), 'total'],
    text: ['100%', ...values.map((v) => '−' + fmt(v, 1)), fmt(eff, 1) + '%'],
    textposition: 'outside', cliponaxis: false,
    connector: { line: { color: '#999', width: 1, dash: 'dot' } },
    increasing: { marker: { color: '#00BFC4' } },
    decreasing: { marker: { color: '#F8766D' } },
    totals: { marker: { color: '#00BA38' } },
    hovertemplate: '%{x}: %{y:.2f}%<extra></extra>',
  }], base({
    margin: { l: 50, r: 10, t: 24, b: 90 },
    xaxis: axis({ tickangle: -35, tickfont: { size: 10, color: TEXT } }),
    yaxis: axis({ title: { text: '% of heat input' }, range: [0, 108] }),
  }));
}

// --- Sankey energy flow ---------------------------------------------------
export function sankey(id, inputLabel, usefulLabel, useful, losses) {
  const n = losses.length;
  const lossCols = huePal(Math.max(n, 1));
  const labels = [inputLabel, usefulLabel, 'Losses', ...losses.map((l) => l.label)];
  const nodeCols = ['#7F7F7F', USEFUL, '#F8766D', ...lossCols];
  const total = losses.reduce((a, l) => a + l.value, 0);
  const src = [0, 0, ...losses.map(() => 2)];
  const tgt = [1, 2, ...losses.map((_, i) => 3 + i)];
  const val = [useful, total, ...losses.map((l) => l.value)];
  const hex2rgba = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
  const linkCols = [hex2rgba(USEFUL, 0.35), 'rgba(248,118,109,0.35)', ...lossCols.map((c) => hex2rgba(c, 0.4))];
  draw(id, [{
    type: 'sankey', arrangement: 'snap', valueformat: ',.1f', valuesuffix: ' GJ',
    node: { label: labels, color: nodeCols, pad: 14, thickness: 16, line: { color: '#fff', width: 1 } },
    link: { source: src, target: tgt, value: val, color: linkCols },
  }], { ...base({ margin: { l: 8, r: 8, t: 8, b: 8 } }), plot_bgcolor: '#fff' });
}

// --- facet_wrap(~period, scales = "free_y") bar chart ----------------------
// panels: [{ title, bars: [{label, value}] }]
export function facetBars(id, panels, yTitle, opts = {}) {
  const n = panels.length;
  const gap = 0.06;
  const w = (1 - gap * (n - 1)) / n;
  const labelsAll = panels[0].bars.map((b) => b.label);
  const cols = opts.colors || huePal(labelsAll.length);
  const data = []; const layout = base({
    margin: { l: 56, r: 10, t: 34, b: opts.bottom ?? 80 }, showlegend: false,
    shapes: [], annotations: [],
  });
  delete layout.xaxis; delete layout.yaxis;
  panels.forEach((p, i) => {
    const sfx = i === 0 ? '' : String(i + 1);
    const x0 = i * (w + gap);
    layout['xaxis' + sfx] = axis({ domain: [x0, x0 + w], anchor: 'y' + sfx, tickangle: -30, tickfont: { size: 10, color: TEXT } });
    layout['yaxis' + sfx] = axis({ anchor: 'x' + sfx, rangemode: 'tozero', title: i === 0 ? { text: yTitle } : undefined });
    data.push({
      type: 'bar', x: p.bars.map((b) => b.label), y: p.bars.map((b) => b.value),
      xaxis: 'x' + sfx, yaxis: 'y' + sfx,
      marker: { color: p.bars.map((b, j) => b.color || cols[j]), pattern: { shape: p.bars.map((b) => (b.memo ? '/' : '')) } },
      text: p.bars.map((b) => fmt(b.value, b.value < 10 ? 2 : 0)), textposition: 'outside', cliponaxis: false,
      textfont: { size: 10 },
      hovertemplate: `${p.title}<br>%{x}: %{y:,.2f} ${opts.unit || ''}<extra></extra>`,
    });
    // strip (the grey facet label box)
    layout.shapes.push({ type: 'rect', xref: 'paper', yref: 'paper', x0, x1: x0 + w, y0: 1.0, y1: 1.1, fillcolor: STRIP, line: { width: 0 } });
    layout.annotations.push({ text: p.title, xref: 'paper', yref: 'paper', x: x0 + w / 2, y: 1.05, showarrow: false, font: { size: 12, color: '#1A1A1A' } });
  });
  draw(id, data, layout);
}

// --- Dumbbell (geom_segment + geom_point) --------------------------------
export function dumbbell(id, scen, current) {
  if (!scen.length) { draw(id, [], { ...base(), annotations: [{ text: 'Already at best-practice targets for the measures checked.', showarrow: false, xref: 'paper', yref: 'paper', x: 0.5, y: 0.5 }] }); return; }
  const rows = [...scen].reverse();
  const y = rows.map((s) => s.label);
  const segs = rows.map((s) => ({
    type: 'scatter', mode: 'lines', x: [current, s.newEfficiency], y: [s.label, s.label],
    line: { color: '#7F7F7F', width: 3 }, hoverinfo: 'skip', showlegend: false,
  }));
  draw(id, [
    ...segs,
    { type: 'scatter', mode: 'markers', name: 'Current', x: rows.map(() => current), y,
      marker: { size: 13, color: '#F8766D', line: { color: '#fff', width: 1 } },
      hovertemplate: 'Current: %{x:.1f}%<extra></extra>' },
    { type: 'scatter', mode: 'markers+text', name: 'Achievable', x: rows.map((s) => s.newEfficiency), y,
      marker: { size: 13, color: '#00BFC4', line: { color: '#fff', width: 1 } },
      text: rows.map((s) => '+' + fmt(s.gain, 1) + ' pts'), textposition: 'middle right', cliponaxis: false,
      hovertemplate: 'Achievable: %{x:.1f}%<extra></extra>' },
  ], base({
    margin: { l: 10, r: 70, t: 30, b: 44 }, showlegend: true,
    legend: { orientation: 'h', x: 0, y: 1.12, font: { size: 11 } },
    xaxis: axis({ title: { text: 'Efficiency (%)' }, ticksuffix: '%' }),
    yaxis: axis(),
  }));
}

export function resizeAll() {
  if (!window.Plotly) return;
  document.querySelectorAll('.chart').forEach((el) => { if (el.data) Plotly.Plots.resize(el); });
}
