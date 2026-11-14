const { AlgoritmosCNC } = require('C:/Users/bruno/.gemini/antigravity/scratch/central-dxf-pro/public/js/algorithms.js');

const res = AlgoritmosCNC.calcularPeConico({
  produto: 'pe_conico',
  pc_diam_base: '550',
  pc_diam_topo: '350',
  pc_altura: '700',
  pc_espessura_mdf: '18'
});

console.log('peData:', JSON.stringify(res.peData, null, 2));
