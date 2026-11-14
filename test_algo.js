async function test() {
  const { AlgoritmosCNC } = await import('./public/js/algorithms.js');
  const resSimples = AlgoritmosCNC.calcularCurvoSimples({
    largura: 280,
    profundidade: 350,
    altura: 400,
    raio: 80,
    espessura: 18,
    gerarReforco: true
  });
  console.log("resSimples keys:", Object.keys(resSimples));
  console.log("curvoSimplesData keys:", Object.keys(resSimples.curvoSimplesData));
  console.log("top_outline length:", resSimples.curvoSimplesData.top_outline.length);
  console.log("front_path length:", resSimples.curvoSimplesData.front_path.length);
  console.log("reforco_z:", resSimples.curvoSimplesData.reforco_z);
  console.log("ripas count:", resSimples.curvoSimplesData.ripas.length);

  const resDuplo = AlgoritmosCNC.calcularCurvoDuplo({
    largura: 400,
    profundidade: 300,
    altura: 400,
    raio: 80,
    espessura: 18,
    gerarReforco: true
  });
  console.log("\nresDuplo keys:", Object.keys(resDuplo));
  console.log("curvoSimplesData keys:", Object.keys(resDuplo.curvoSimplesData));
  console.log("reforco_outlines length:", resDuplo.curvoSimplesData.reforco_outlines.length);
  console.log("reforco_z:", resDuplo.curvoSimplesData.reforco_z);
}
test();
