const fs = require('fs');

import('./public/js/algorithms.js').then(({ AlgoritmosCNC }) => {
  const duploParams = {
    tipo_curvo: 'duplo_vertical',
    largura: 400,
    profundidade: 300,
    altura: 400,
    raio: 80,
    espessura: 18,
    gerarReforco: true
  };

  const resDuplo = AlgoritmosCNC.calcularCurvoDuplo(duploParams);
  const data = resDuplo.curvoSimplesData;
  console.log('Duplo keys:', Object.keys(data));
  console.log('Duplo estrutura_z:', data.estrutura_z);
  console.log('Duplo reforco_z:', data.reforco_z);
  console.log('Duplo reforco_outlines count:', (data.reforco_outlines || []).length);
  console.log('Duplo ripas count:', (data.ripas || []).length);
  console.log('Duplo front_path count:', (data.front_path || []).length);
  console.log('Duplo front_flex_ranges:', data.front_flex_ranges);

  const simplesParams = {
    tipo_curvo: 'simples',
    largura: 280,
    profundidade: 350,
    altura: 400,
    raio: 80,
    espessura: 18,
    gerarReforco: true
  };
  const resSimples = AlgoritmosCNC.calcularCurvoSimples(simplesParams);
  const dataSimples = resSimples.curvoSimplesData;
  console.log('\nSimples keys:', Object.keys(dataSimples));
  console.log('Simples estrutura_z:', dataSimples.estrutura_z);
  console.log('Simples reforco_z:', dataSimples.reforco_z);
  console.log('Simples reforco_outline count:', (dataSimples.reforco_outline || []).length);
  console.log('Simples ripas count:', (dataSimples.ripas || []).length);
  console.log('Simples front_path count:', (dataSimples.front_path || []).length);
  console.log('Simples front_flex_start_idx:', dataSimples.front_flex_start_idx, 'end:', dataSimples.front_flex_end_idx);
});
