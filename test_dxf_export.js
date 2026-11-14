const fs = require('fs');
const { AlgoritmosCNC } = require('C:/Users/bruno/.gemini/antigravity/scratch/central-dxf-pro/public/js/algorithms.js');

// Test simples
const simples = AlgoritmosCNC.calcularCurvoSimples({
  largura: '400',
  profundidade: '300',
  altura: '400',
  raio: '80',
  espessura: '18'
});

console.log('Simples camadas count:', simples.camadas.length);
const layersSimples = {};
simples.camadas.forEach(c => {
  layersSimples[c.layer] = (layersSimples[c.layer] || 0) + 1;
});
console.log('Simples layers:', layersSimples);

// Test duplo
const duplo = AlgoritmosCNC.calcularCurvoDuplo({
  largura: '500',
  profundidade: '300',
  altura: '400',
  raio: '80',
  espessura: '18'
});
console.log('Duplo camadas count:', duplo.camadas.length);
const layersDuplo = {};
duplo.camadas.forEach(c => {
  layersDuplo[c.layer] = (layersDuplo[c.layer] || 0) + 1;
});
console.log('Duplo layers:', layersDuplo);

// Test porta
const porta = AlgoritmosCNC.calcularPortaCava({
  subtipo: 'porta_puxador_cava_redonda',
  largura: '400',
  altura: '700',
  puxador_largura: '80',
  puxador_altura: '80'
});
console.log('Porta Redonda kind:', porta.portaData.kind, 'camadas count:', porta.camadas.length);

const portaLonga = AlgoritmosCNC.calcularPortaCava({
  subtipo: 'porta_puxador_cava_longa',
  largura: '450',
  altura: '1800'
});
console.log('Porta Longa kind:', portaLonga.portaData.kind, 'camadas count:', portaLonga.camadas.length);

const portaSemPuxador = AlgoritmosCNC.calcularPortaCava({
  subtipo: 'porta_sem_puxador',
  largura: '400',
  altura: '700'
});
console.log('Porta Sem Puxador kind:', portaSemPuxador.portaData.kind, 'camadas count:', portaSemPuxador.camadas.length);
