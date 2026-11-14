import('./public/js/algorithms.js').then(m => {
  const algo = m.AlgoritmosCNC;

  console.log('=== 1. CURVO SIMPLES ===');
  const s = algo.calcularCurvoSimples({ largura: 280, profundidade: 350, altura: 400, raio: 80, espessura: 18 });
  const layersS = {};
  s.camadas.forEach(c => layersS[c.layer] = (layersS[c.layer] || 0) + 1);
  console.log('Total camadas:', s.camadas.length, layersS);

  console.log('\n=== 2. CURVO DUPLO ===');
  const d = algo.calcularCurvoDuplo({ largura: 400, profundidade: 300, altura: 400, raio: 80, espessura: 18 });
  const layersD = {};
  d.camadas.forEach(c => layersD[c.layer] = (layersD[c.layer] || 0) + 1);
  console.log('Total camadas:', d.camadas.length, layersD);

  console.log('\n=== 3. PE CONICO ===');
  const pe = algo.calcularPeConico({ pc_diam_base: 550, pc_diam_topo: 350, pc_altura: 700 });
  const layersPe = {};
  pe.camadas.forEach(c => layersPe[c.layer] = (layersPe[c.layer] || 0) + 1);
  console.log('Total camadas:', pe.camadas.length, layersPe);

  console.log('\n=== 4. PORTA CAVA ===');
  const porta = algo.calcularPortaCava({ largura: 400, altura: 700, espessura: 18, tipoCava: 'redonda' });
  const layersP = {};
  porta.camadas.forEach(c => layersP[c.layer] = (layersP[c.layer] || 0) + 1);
  console.log('Total camadas:', porta.camadas.length, layersP);

  console.log('\n=== 5. MUXARABI ENCAIXADO ===');
  const mux = algo.calcularMuxarabiEncaixado({ largura: 600, altura: 800, espessura: 18 });
  const layersM = {};
  mux.camadas.forEach(c => layersM[c.layer] = (layersM[c.layer] || 0) + 1);
  console.log('Total camadas:', mux.camadas.length, layersM);
}).catch(console.error);
