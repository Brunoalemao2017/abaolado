const { AlgoritmosCNC } = require('C:/Users/bruno/.gemini/antigravity/scratch/central-dxf-pro/public/js/algorithms.js');

const types = [
  'pe_conico',
  'pe_redondo',
  'pe_oval',
  'pe_oblongo',
  'pe_conico_quadrado',
  'pe_portico_u',
  'revestimento_cone_eliptico'
];

for (const t of types) {
  const res = AlgoritmosCNC.calcularPeConico({ produto: t });
  console.log(t, 'kind:', res.peData?.kind, 'rings:', res.peData?.rings?.length);
}
