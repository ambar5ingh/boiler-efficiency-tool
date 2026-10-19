# Boiler Efficiency & Emissions Tool (India, MSME)

A browser-based questionnaire that calculates **boiler efficiency** and **daily, monthly and yearly
energy use and emissions** for steam boilers, thermic fluid heaters and hot water generators in any
MSME sector or sub-sector in India. Results come with ggplot2-style charts.

It is a static website (HTML + JavaScript, no server, no build step), so it deploys free on
**GitHub Pages** using the included GitHub Actions workflow. All data stays in the user's browser.

## What it calculates

| Area | Method |
|---|---|
| Efficiency, indirect (heat loss) | IS 8753 / BEE Guide Book 2, Ch. 2, GCV basis. Losses: dry flue gas, H₂ in fuel, moisture in fuel, moisture in air, CO (partial combustion), radiation & convection, unburnt carbon in fly ash and bottom ash |
| Efficiency, direct | Heat in steam (built-in steam tables, saturated or superheated) or hot water / thermic fluid, divided by fuel heat input |
| CO₂ | Carbon mass balance from the fuel's ultimate analysis, net of unburnt carbon |
| CH₄, N₂O | IPCC 2006 default stationary-combustion factors (kg/TJ, NCV basis), GWP from IPCC AR5 (28, 265) |
| Electricity (Scope 2) | Auxiliary kW × CEA grid emission factor (editable, default 0.727 t CO₂/MWh; update to the latest CEA CO₂ Baseline Database) |
| SO₂, CO | Sulphur mass balance; measured CO ppm |
| Biomass | CO₂ reported as **biogenic** (memo item) and excluded from the CO₂e total, per IPCC; CH₄ and N₂O are counted |
| Improvement potential | Re-runs the heat loss method at best-practice targets (excess air, stack temperature, unburnt carbon, CO, insulation, fuel drying), giving fuel, ₹ and t CO₂e saved per year |

Built-in fuels with typical Indian properties: Indian coal, imported (Indonesian) coal, lignite, pet coke,
rice husk, bagasse, fuel wood, biomass briquettes, furnace oil, LDO, HSD, natural gas (PNG), LPG, and a
custom fuel. Every property is editable, so replace them with your lab report for best accuracy.

### Charts

Efficiency gauge with benchmark bands, heat balance donut, Sankey energy flow, ranked heat-loss bars,
100%-to-efficiency waterfall, faceted (facet_wrap-style) energy and GHG bars for day / month / year,
GHG composition donut, and a current-vs-achievable dumbbell chart for improvement measures.
Charts use Plotly with ggplot2's grey theme and default hue palette.

### Other features

- Six-step questionnaire with sector / sub-sector lists (and "Other" for anything not listed)
- Day / Month / Year toggle for the headline numbers
- Data checks (analysis must total 100%, direct vs indirect gap, out-of-range readings)
- Save / open inputs as JSON, export results to CSV, print or save as PDF
- Inputs auto-saved in the browser between visits
- Works on phones

## Project layout

```
index.html                    page and result layout
assets/css/style.css          styles (light and dark, print)
assets/js/app.js              questionnaire, results, export
assets/js/calc.js             efficiency and emissions engine
assets/js/steam.js            steam tables
assets/js/fuels.js            fuel defaults, emission factors, benchmarks
assets/js/sectors.js          sectors, sub-sectors, boiler types
assets/js/charts.js           ggplot-style Plotly charts
assets/vendor/plotly.min.js   Plotly 2.35.2 (MIT), bundled so no CDN is needed
tests/calc.test.mjs           checks against the BEE worked example
.github/workflows/deploy.yml  test, then publish to GitHub Pages
```

## Push to GitHub and launch with GitHub Actions

1. **Create a repository** on GitHub (for example `boiler-efficiency-tool`). Leave it empty: no README,
   licence or .gitignore.
2. **Unzip** this folder and push it (replace `YOUR-USERNAME`):
   ```bash
   cd boiler-efficiency-tool
   git init
   git add .
   git commit -m "Boiler efficiency tool"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/boiler-efficiency-tool.git
   git push -u origin main
   ```
   No command line? On the empty repository page choose **uploading an existing file**, drag in all the
   unzipped files and folders (including the hidden `.github` folder), and commit to `main`.
3. **Turn on Pages**: repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Run it**: open the **Actions** tab. The "Test and deploy to GitHub Pages" workflow runs on every push
   to `main` (or click **Run workflow**). When it is green, the site is live at
   `https://YOUR-USERNAME.github.io/boiler-efficiency-tool/`. The link is also shown on the workflow run.

On a free GitHub account, Pages needs the repository to be **public**.

## Run locally

Browsers block ES modules from `file://`, so serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
npm test                        # runs the calculation tests (Node 18+)
```

## How to fill in the questionnaire

| Reading | How to get it |
|---|---|
| Fuel consumption | Weigh-bridge / day tank dip / gas meter over a fixed period (at least 1 h, ideally a full shift) |
| Steam flow | Steam flow meter, or feed water meter minus blowdown, over the **same** period |
| O₂, CO, flue gas temperature | Portable flue gas analyser at the boiler exit after economiser / APH |
| Fuel analysis, GCV | Lab report (ultimate analysis, as-fired) for the fuel lot used during the test |
| Unburnt carbon | LOI test of fly ash and bottom ash samples |

If direct and indirect results differ by more than 5 points, the tool says so. The usual causes are fuel
and steam measured over different periods, wrong GCV, or blowdown not accounted for.

## Changing defaults

- Fuel properties, prices, targets and benchmarks: `assets/js/fuels.js`
- Grid emission factor and GWPs: `assets/js/fuels.js`
- Sectors and boiler types: `assets/js/sectors.js`

## Limitations

Results are an energy-audit estimate, not a certified measurement. The steam table is interpolated and
superheat uses a fitted mean specific heat (about ±1% for MSME ranges); enter a measured steam enthalpy to
override. Blowdown loss is not part of the IS 8753 indirect method used here.

## References

- IS 8753:1977, Thermal evaluation of boilers (and BS 845)
- Bureau of Energy Efficiency, Guide Book 2 (Energy Efficiency in Thermal Utilities), Ch. 2 Boilers, and
  Guide Book 4, Ch. 1 Energy performance assessment of boilers
- IPCC 2006 Guidelines for National GHG Inventories, Vol. 2, Ch. 2 (Stationary combustion)
- Central Electricity Authority, CO₂ Baseline Database for the Indian Power Sector

## Licence

MIT. Plotly.js is MIT-licensed (see `assets/vendor/plotly.LICENSE`).
