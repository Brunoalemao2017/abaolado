import re

path = 'C:/Users/bruno/.gemini/antigravity/scratch/central-dxf-pro/public/js/algorithms.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_ripado = '''  calcularPainelRipado(params) {
    const W = parseFloat(params.largura) || 900;
    const H = parseFloat(params.altura) || 1800;
    const larguraRipa = parseFloat(params.larguraRipa) || 30;
    const espacamento = parseFloat(params.espacamento) || 15;
    const espessura = parseFloat(params.espessura) || 15;

    const passo = larguraRipa + espacamento;
    const numRipas = Math.floor((W + espacamento) / passo);
    const sobra = W - (numRipas * larguraRipa + (numRipas - 1) * espacamento);
    const margemX = sobra / 2;

    const camadas = [];
    const ripas3D = [];

    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]
    });

    for (let i = 0; i < numRipas; i++) {
      const rx0 = margemX + i * passo;
      const rx1 = rx0 + larguraRipa;
      ripas3D.push({ x0: rx0, x1: rx1, y0: 0, y1: H, alt: 18 });

      const cx = rx0 + larguraRipa / 2;
      camadas.push({ layer: 'FURACAO', tipo: 'circle', cx, cy: 100, r: 4 });
      camadas.push({ layer: 'FURACAO', tipo: 'circle', cx, cy: H / 2, r: 4 });
      camadas.push({ layer: 'FURACAO', tipo: 'circle', cx, cy: H - 100, r: 4 });
    }

    return {
      produto: 'painel_ripado_cavilhado',
      largura: W,
      altura: H,
      espessura,
      camadas,
      buracos3D: [],
      ripas3D,
      relatorio: {
        areaTotalM2: ((W * H) / 1000000).toFixed(3),
        perimetroCorteMetros: (2 * (W + H) / 1000).toFixed(2),
        totalRipas: numRipas,
        tempoEstimadoMinutos: Math.ceil(numRipas * 0.8 + 2)
      }
    };
  },'''

new_ripado = '''  calcularPainelRipado(params) {
    const W = parseFloat(params.rip_comprimento || params.largura) || 1200;
    const H = parseFloat(params.rip_altura || params.altura) || 600;
    const espessura = parseFloat(params.rip_espessura || params.espessura) || 15;
    const larguraRipa = parseFloat(params.rip_largura || params.larguraRipa) || 40;
    const afEsq = parseFloat(params.rip_af_esq || params.afEsq) || 0;
    const afDir = parseFloat(params.rip_af_dir || params.afDir) || 0;
    const numCavilhas = Math.max(1, parseInt(params.rip_cavilhas || params.cavilhas) || 2);
    const diamCavilha = parseFloat(params.rip_diametro || params.diametro) || 8;
    const raioCavilha = diamCavilha / 2;

    const numDivisoesH = Math.max(1, parseInt(params.rip_num_divisoes) || 1);
    const numDivisoesV = Math.max(1, parseInt(params.rip_num_divisoes_vert) || 1);

    const W_util = Math.max(10, W - afEsq - afDir);

    let numRipas;
    let espacamento;

    if (params.rip_quantidade !== undefined && params.rip_quantidade !== '') {
      numRipas = Math.max(1, parseInt(params.rip_quantidade));
      espacamento = numRipas > 1 ? (W_util - numRipas * larguraRipa) / (numRipas - 1) : 0;
    } else if (params.rip_vao_desejado !== undefined && params.rip_vao_desejado !== '') {
      const vao = Math.max(1, parseFloat(params.rip_vao_desejado));
      numRipas = Math.max(1, Math.floor((W_util + vao) / (larguraRipa + vao)));
      espacamento = numRipas > 1 ? (W_util - numRipas * larguraRipa) / (numRipas - 1) : 0;
    } else {
      const vao = parseFloat(params.espacamento) || 15;
      numRipas = Math.max(1, Math.floor((W_util + vao) / (larguraRipa + vao)));
      espacamento = numRipas > 1 ? (W_util - numRipas * larguraRipa) / (numRipas - 1) : 0;
    }

    // 1. Paineis de fundo (com divisões opcionais)
    const paineis = [];
    const divW = W / numDivisoesH;
    const divH = H / numDivisoesV;
    for (let dx = 0; dx < numDivisoesH; dx++) {
      for (let dy = 0; dy < numDivisoesV; dy++) {
        paineis.push({
          x0: parseFloat((dx * divW).toFixed(2)),
          x1: parseFloat(((dx + 1) * divW).toFixed(2)),
          y0: parseFloat((dy * divH).toFixed(2)),
          y1: parseFloat(((dy + 1) * divH).toFixed(2))
        });
      }
    }

    // 2. Ripas e cavilhas
    const ripas = [];
    const cavilhas = [];
    const marginDowel = Math.min(60.0, Math.max(20.0, H * 0.15));

    for (let i = 0; i < numRipas; i++) {
      const rx0 = parseFloat((afEsq + i * (larguraRipa + espacamento)).toFixed(2));
      const rx1 = parseFloat((rx0 + larguraRipa).toFixed(2));
      ripas.push({ x0: rx0, x1: rx1, y0: 0, y1: H });

      const cx = parseFloat(((rx0 + rx1) / 2).toFixed(2));
      for (let k = 0; k < numCavilhas; k++) {
        const cy = numCavilhas > 1
          ? parseFloat((marginDowel + k * ((H - 2 * marginDowel) / (numCavilhas - 1))).toFixed(2))
          : parseFloat((H / 2).toFixed(2));
        cavilhas.push({ x: cx, y: cy, diametro: diamCavilha });
      }
    }

    // 3. Camadas CAM para corte CNC
    const camadas = [];

    // Fundo
    paineis.forEach(p => {
      camadas.push({
        layer: 'CORTE',
        tipo: 'polyline',
        fechada: true,
        pontos: [{ x: p.x0, y: p.y0 }, { x: p.x1, y: p.y0 }, { x: p.x1, y: p.y1 }, { x: p.x0, y: p.y1 }]
      });
    });

    // Furações de cavilhas no fundo
    cavilhas.forEach(c => {
      camadas.push({ layer: 'FURACAO', tipo: 'circle', cx: c.x, cy: c.y, r: raioCavilha });
    });

    // Ripas individuais no ninho
    const gap = 20;
    const y0_ripas = H + 30;
    ripas.forEach((r, idx) => {
      const x_offset = idx * (larguraRipa + gap);
      camadas.push({
        layer: 'CORTE',
        tipo: 'polyline',
        fechada: true,
        pontos: [
          { x: x_offset, y: y0_ripas },
          { x: x_offset + larguraRipa, y: y0_ripas },
          { x: x_offset + larguraRipa, y: y0_ripas + H },
          { x: x_offset, y: y0_ripas + H }
        ]
      });
    });

    const ripadoData = {
      kind: 'painel_ripado_cavilhado',
      largura: W,
      altura: H,
      espessura,
      paineis,
      ripas,
      cavilhas
    };

    return {
      produto: 'painel_ripado_cavilhado',
      ripadoData,
      largura: W,
      altura: H,
      espessura,
      numRipas,
      espacamento: parseFloat(espacamento.toFixed(2)),
      camadas,
      buracos3D: [],
      ripas3D: ripas,
      relatorio: {
        areaTotalM2: ((W * H) / 1000000).toFixed(3),
        perimetroCorteMetros: (2 * (W + H) / 1000).toFixed(2),
        totalRipas: numRipas,
        totalCavilhas: cavilhas.length,
        tempoEstimadoMinutos: Math.ceil(numRipas * 0.8 + 2)
      }
    };
  },'''

assert old_ripado in content, 'old_ripado not found'
content = content.replace(old_ripado, new_ripado, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated calcularPainelRipado successfully!')
