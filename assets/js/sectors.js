// MSME sectors and sub-sectors that commonly run boilers / thermic fluid heaters.
// "Other" lets the user type any sector not listed, so the tool works for every sector.
export const SECTORS = {
  'Textiles': ['Dyeing & processing', 'Printing', 'Spinning', 'Weaving / powerloom', 'Knitting & hosiery', 'Garment washing', 'Other'],
  'Food processing': ['Rice mill / parboiling', 'Dairy', 'Edible oil / solvent extraction', 'Sugar & jaggery', 'Bakery & confectionery', 'Fruit & vegetable processing', 'Spices', 'Distillery & brewery', 'Other'],
  'Chemicals': ['Dyes & intermediates', 'Specialty chemicals', 'Paints & resins', 'Fertiliser & agro-chemicals', 'Soap & detergents', 'Other'],
  'Pharmaceuticals': ['Bulk drugs (API)', 'Formulations', 'Ayurvedic & herbal', 'Other'],
  'Paper & pulp': ['Kraft paper', 'Writing & printing paper', 'Paperboard & corrugation', 'Other'],
  'Rubber & plastics': ['Tyre retreading', 'Rubber products', 'Plastic processing', 'Other'],
  'Leather': ['Tanning', 'Footwear', 'Other'],
  'Engineering & metals': ['Electroplating', 'Galvanising', 'Forging', 'Foundry', 'Other'],
  'Ceramics & building material': ['Ceramic tiles', 'Refractories', 'AAC blocks / autoclaving', 'Other'],
  'Hospitality & services': ['Hotels', 'Hospitals', 'Laundry', 'Other'],
  'Other': ['Other'],
};

export const BOILER_TYPES = [
  'Fire tube (smoke tube) package boiler',
  'Water tube boiler',
  'Fluidised bed (FBC / AFBC)',
  'Travelling grate / chain grate stoker',
  'Fixed grate / manual fired',
  'Thermic fluid heater',
  'Hot water generator',
  'Waste heat recovery boiler (with supplementary firing)',
];
