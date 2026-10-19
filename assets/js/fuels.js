// Default fuel properties for Indian MSME boilers.
// Ultimate analysis is on an as-fired basis (% by mass) and must sum to ~100.
// GCV in kcal/kg. Density used only when consumption is entered in litres or SCM.
// CH4 / N2O factors: IPCC 2006 Guidelines, Vol. 2, Table 2.3 (manufacturing industries
// and construction, stationary combustion), kg per TJ of net energy.
// Benchmarks: typical achievable efficiency (GCV basis) from BEE Guide Book 2, Ch. 2
// and BEE / SAMEEEKSHA MSME cluster studies.

export const FUELS = {
  indian_coal: {
    name: 'Indian coal (non-coking, G-grade)', group: 'coal', state: 'solid', biogenic: false,
    C: 41.11, H: 2.76, N: 1.22, O: 9.89, S: 0.41, M: 5.98, A: 38.63, GCV: 4000,
    ch4: 10, n2o: 1.5, price: 8, targetO2: 5, targetTf: 160, benchmark: [76, 82],
  },
  imported_coal: {
    name: 'Imported coal (Indonesian)', group: 'coal', state: 'solid', biogenic: false,
    C: 58.96, H: 4.16, N: 1.02, O: 11.88, S: 0.56, M: 14.0, A: 9.42, GCV: 5500,
    ch4: 10, n2o: 1.5, price: 11, targetO2: 5, targetTf: 160, benchmark: [80, 85],
  },
  lignite: {
    name: 'Lignite', group: 'coal', state: 'solid', biogenic: false,
    C: 33.0, H: 2.5, N: 0.5, O: 10.0, S: 1.0, M: 40.0, A: 13.0, GCV: 2800,
    ch4: 10, n2o: 1.5, price: 5, targetO2: 5, targetTf: 160, benchmark: [72, 78],
  },
  pet_coke: {
    name: 'Petroleum coke', group: 'coal', state: 'solid', biogenic: false,
    C: 85.0, H: 3.5, N: 1.5, O: 1.0, S: 6.0, M: 2.5, A: 0.5, GCV: 8000,
    ch4: 3, n2o: 0.6, price: 14, targetO2: 4, targetTf: 170, benchmark: [80, 86],
  },
  rice_husk: {
    name: 'Rice husk', group: 'biomass', state: 'solid', biogenic: true,
    C: 33.95, H: 5.01, N: 0.17, O: 31.04, S: 0.04, M: 10.79, A: 19.0, GCV: 3100,
    ch4: 30, n2o: 4, price: 5, targetO2: 6, targetTf: 170, benchmark: [70, 78],
  },
  bagasse: {
    name: 'Bagasse (50% moisture)', group: 'biomass', state: 'solid', biogenic: true,
    C: 23.4, H: 2.8, N: 0.1, O: 21.3, S: 0.0, M: 50.0, A: 2.4, GCV: 2270,
    ch4: 30, n2o: 4, price: 2.5, targetO2: 6, targetTf: 170, benchmark: [65, 72],
  },
  fuel_wood: {
    name: 'Fuel wood', group: 'biomass', state: 'solid', biogenic: true,
    C: 40.0, H: 4.8, N: 0.2, O: 34.0, S: 0.02, M: 20.0, A: 0.98, GCV: 3500,
    ch4: 30, n2o: 4, price: 6, targetO2: 6, targetTf: 170, benchmark: [70, 78],
  },
  briquettes: {
    name: 'Biomass briquettes (agro-residue)', group: 'biomass', state: 'solid', biogenic: true,
    C: 42.0, H: 5.2, N: 0.6, O: 35.2, S: 0.1, M: 8.0, A: 8.9, GCV: 3800,
    ch4: 30, n2o: 4, price: 7, targetO2: 6, targetTf: 170, benchmark: [72, 80],
  },
  furnace_oil: {
    name: 'Furnace oil (FO)', group: 'oil', state: 'liquid', biogenic: false, density: 0.93,
    C: 84.0, H: 12.0, N: 0.3, O: 0.6, S: 2.8, M: 0.25, A: 0.05, GCV: 10050,
    ch4: 3, n2o: 0.6, price: 55, targetO2: 3, targetTf: 180, benchmark: [84, 89],
  },
  ldo: {
    name: 'Light diesel oil (LDO)', group: 'oil', state: 'liquid', biogenic: false, density: 0.85,
    C: 85.9, H: 12.0, N: 0.1, O: 0.18, S: 1.8, M: 0.01, A: 0.01, GCV: 10700,
    ch4: 3, n2o: 0.6, price: 75, targetO2: 3, targetTf: 170, benchmark: [84, 89],
  },
  diesel: {
    name: 'High speed diesel (HSD)', group: 'oil', state: 'liquid', biogenic: false, density: 0.832,
    C: 86.0, H: 13.4, N: 0.1, O: 0.44, S: 0.001, M: 0.05, A: 0.009, GCV: 10800,
    ch4: 3, n2o: 0.6, price: 90, targetO2: 3, targetTf: 160, benchmark: [85, 90],
  },
  natural_gas: {
    name: 'Natural gas (PNG)', group: 'gas', state: 'gas', biogenic: false, density: 0.78,
    C: 73.0, H: 23.5, N: 2.5, O: 1.0, S: 0.0, M: 0.0, A: 0.0, GCV: 12500,
    ch4: 1, n2o: 0.1, price: 60, targetO2: 2, targetTf: 130, benchmark: [85, 90],
  },
  lpg: {
    name: 'LPG', group: 'gas', state: 'gas', biogenic: false, density: 2.0,
    C: 82.5, H: 17.5, N: 0.0, O: 0.0, S: 0.0, M: 0.0, A: 0.0, GCV: 11900,
    ch4: 1, n2o: 0.1, price: 85, targetO2: 2, targetTf: 130, benchmark: [85, 90],
  },
  custom: {
    name: 'Custom / other fuel (enter lab analysis)', group: 'coal', state: 'solid', biogenic: false,
    C: 45.0, H: 3.5, N: 1.0, O: 10.0, S: 0.5, M: 10.0, A: 30.0, GCV: 4200,
    ch4: 10, n2o: 1.5, price: 8, targetO2: 5, targetTf: 160, benchmark: [75, 82],
  },
};

// Global warming potentials, IPCC AR5 100-year (as used in India's BUR / CCTS).
export const GWP = { CH4: 28, N2O: 265 };

// Grid electricity emission factor, tCO2/MWh. CEA CO2 Baseline Database (weighted
// average). Editable in the form; update to the latest CEA release.
export const CEA_GRID_EF = 0.727;
