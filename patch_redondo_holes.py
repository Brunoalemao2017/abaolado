# Patch algorithms.js for exact Muxarabi Redondo and Muxarabi calculation

with open('public/js/algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace calcularMuxarabiRedondo implementation
old_calc_redondo = '''  calcularMuxarabiRedondo(params) {
    const W = parseFloat(params.muxRedLargura || params.largura) || 800;
    const H = parseFloat(params.muxRedAltura || params.altura) || 1200;
    const diametro = parseFloat(params.muxRedDiametro || params.diametro) || 50;
    const raio = diametro / 2;
    const entreFuros = parseFloat(params.muxRedEntreFuros || params.entreFuros || params.entreVaos) || 15;
    const margem = parseFloat(params.muxRedMargemBordas || params.margem) || 40;
    const espessura = parseFloat(params.espessura) || 15;
    const padrao = params.muxRedDistribuicao || params.padrao || 'grade';

    const W_util = Math.max(10, W - 2 * margem);
    const H_util = Math.max(10, H - 2 * margem);
    const passoX = diametro + entreFuros;
    const passoY = padrao === 'colmeia' ? (diametro + entreFuros) * 0.866 : (diametro + entreFuros);

    const numX = Math.max(1, Math.floor((W_util - diametro) / passoX) + 1);
    const numY = Math.max(1, Math.floor((H_util - diametro) / passoY) + 1);

    const sobraX = W_util - ((numX - 1) * passoX + diametro);
    const sobraY = H_util - ((numY - 1) * passoY + diametro);
    const margemX = margem + sobraX / 2;
    const margemY = margem + sobraY / 2;

    const camadas = [];
    const buracos3D = [];

    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]
    });

    let countFuros = 0;
    for (let iy = 0; iy < numY; iy++) {
      const cy = margemY + raio + iy * passoY;
      const offsetX = (padrao === 'colmeia' && iy % 2 === 1) ? passoX / 2 : 0;
      for (let ix = 0; ix < numX; ix++) {
        const cx = margemX + raio + ix * passoX + offsetX;
        if (cx + raio <= W - margem + 5) {
          camadas.push({ layer: 'CORTE', tipo: 'circle', cx, cy, r: raio });
          buracos3D.push({ tipo: 'circulo', cx, cy, r: raio });
          countFuros++;
        }
      }
    }

    const perimetroCorteTotal = (2 * (W + H) + countFuros * Math.PI * diametro) / 1000;
    const areaTotal = (W * H) / 1000000;
    const areaVazada = (countFuros * Math.PI * Math.pow(raio, 2)) / 1000000;

    const holesRed = buracos3D.map(b => ({ tipo: 'circulo', cx: b.cx, cy: b.cy, r: b.r }));
    const painelMuxarabiData = {
      kind: 'painel_muxarabi_redondo',
      largura: W,
      altura: H,
      espessura,
      holes: holesRed
    };

    return {
      produto: 'muxarabi_usinado_redondo',
      painelMuxarabiData,
      largura: W,
      altura: H,
      espessura,
      totalVãos: countFuros,
      camadas,
      buracos3D,
      relatorio: {
        areaTotalM2: areaTotal.toFixed(3),
        areaVazadaM2: areaVazada.toFixed(3),
        aproveitamentoPorcento: (((areaTotal - areaVazada) / areaTotal) * 100).toFixed(1),
        perimetroCorteMetros: perimetroCorteTotal.toFixed(2),
        totalFuros: countFuros,
        tempoEstimadoMinutos: Math.ceil(perimetroCorteTotal / 4 + (countFuros * 1.5) / 60)
      }
    };
  }'''

new_calc_redondo = '''  calcularMuxarabiRedondo(params) {
    const W = parseFloat(params.muxRedLargura || params.largura) || 800;
    const H = parseFloat(params.muxRedAltura || params.altura) || 1200;
    const diametro = parseFloat(params.muxRedDiametro || params.diametro) || 50;
    const raio = diametro / 2;
    const rawEntre = params.muxRedEntreFuros !== undefined ? params.muxRedEntreFuros : (params.entreFuros !== undefined ? params.entreFuros : params.entreVaos);
    const entreFuros = rawEntre !== undefined && rawEntre !== '' ? parseFloat(rawEntre) : 10;
    const rawMargem = params.muxRedMargemBordas !== undefined ? params.muxRedMargemBordas : params.margem;
    const margemBorda = rawMargem !== undefined && rawMargem !== '' ? parseFloat(rawMargem) : 0;
    const espessura = parseFloat(params.espessura) || 15;
    const modo = params.muxRedDistribuicao || params.padrao || 'dividido_igualmente';
    const dividido = modo !== 'sobra_nos_cantos';

    const numFurosXFixo = parseInt(params.muxRedNumFurosX || params.numFurosX) || null;
    const numFurosYFixo = parseInt(params.muxRedNumFurosY || params.numFurosY) || null;

    const mX = dividido ? margemBorda : 0;
    const mY = dividido ? margemBorda : 0;
    const utilX = Math.max(diametro, dividido ? W - 2 * mX : W);
    const utilY = Math.max(diametro, dividido ? H - 2 * mY : H);

    // EIXO X: Quantidade e passo
    let numX = numFurosXFixo;
    if (!numX || numX < 1) {
      numX = Math.max(1, Math.floor((utilX + entreFuros) / (diametro + entreFuros) + 1e-9));
    }
    let passoX = 0;
    let margemRealX = mX;
    if (numX > 1) {
      if (dividido) {
        const espacoX = (utilX - numX * diametro) / (numX - 1);
        passoX = diametro + espacoX;
        margemRealX = mX;
      } else {
        const L_gradeX = numX * diametro + (numX - 1) * entreFuros;
        margemRealX = (W - L_gradeX) / 2;
        passoX = diametro + entreFuros;
      }
    } else {
      margemRealX = (W - diametro) / 2;
      passoX = 0;
    }

    // EIXO Y: Quantidade e passo
    let numY = numFurosYFixo;
    if (!numY || numY < 1) {
      numY = Math.max(1, Math.floor((utilY + entreFuros) / (diametro + entreFuros) + 1e-9));
    }
    let passoY = 0;
    let margemRealY = mY;
    if (numY > 1) {
      if (dividido) {
        const espacoY = (utilY - numY * diametro) / (numY - 1);
        passoY = diametro + espacoY;
        margemRealY = mY;
      } else {
        const L_gradeY = numY * diametro + (numY - 1) * entreFuros;
        margemRealY = (H - L_gradeY) / 2;
        passoY = diametro + entreFuros;
      }
    } else {
      margemRealY = (H - diametro) / 2;
      passoY = 0;
    }

    const camadas = [];
    const buracos3D = [];

    // Chapa externa
    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]
    });

    let countFuros = 0;
    for (let iy = 0; iy < numY; iy++) {
      const cy = parseFloat((margemRealY + raio + (numY > 1 ? iy * passoY : 0)).toFixed(4));
      for (let ix = 0; ix < numX; ix++) {
        const cx = parseFloat((margemRealX + raio + (numX > 1 ? ix * passoX : 0)).toFixed(4));
        camadas.push({ layer: 'CORTE', tipo: 'circle', cx, cy, r: raio });
        buracos3D.push({ tipo: 'circulo', cx, cy, r: raio });
        countFuros++;
      }
    }

    const totalVãos = countFuros;
    const perimetroCorteTotal = (2 * (W + H) + totalVãos * Math.PI * diametro) / 1000;
    const areaTotal = (W * H) / 1000000;
    const areaVazada = (totalVãos * Math.PI * Math.pow(raio, 2)) / 1000000;

    const holesRed = buracos3D.map(b => ({ tipo: 'circulo', cx: b.cx, cy: b.cy, r: b.r }));
    const painelMuxarabiData = {
      kind: 'painel_muxarabi_redondo',
      largura: W,
      altura: H,
      espessura,
      holes: holesRed
    };

    return {
      produto: 'muxarabi_usinado_redondo',
      painelMuxarabiData,
      largura: W,
      altura: H,
      espessura,
      numX,
      numY,
      totalVãos,
      camadas,
      buracos3D,
      relatorio: {
        areaTotalM2: areaTotal.toFixed(3),
        areaVazadaM2: areaVazada.toFixed(3),
        aproveitamentoPorcento: (((areaTotal - areaVazada) / areaTotal) * 100).toFixed(1),
        perimetroCorteMetros: perimetroCorteTotal.toFixed(2),
        totalFuros: countFuros,
        tempoEstimadoMinutos: Math.ceil(perimetroCorteTotal / 4 + (countFuros * 1.5) / 60)
      }
    };
  }'''

assert old_calc_redondo in text, 'old_calc_redondo not found'
text = text.replace(old_calc_redondo, new_calc_redondo, 1)

with open('public/js/algorithms.js', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated calcularMuxarabiRedondo in algorithms.js!')
