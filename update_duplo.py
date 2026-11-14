with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    code = f.read()

new_duplo = '''  calcularCurvoDuplo(params) {
    const W = Math.max(100, parseFloat(params.largura) || 500);
    const D = Math.max(100, parseFloat(params.profundidade) || 300);
    const H = Math.max(50, parseFloat(params.altura) || 400);
    const T = Math.max(6, parseFloat(params.espessura_mdf || params.espessura) || 18);
    const gerarReforco = params.gerar_reforco !== false && params.gerar_reforco !== '0';

    const raioEntrada = parseFloat(params.raio) || 80;
    const raioMaxPermitido = Math.max(10, Math.min(Math.floor((W - 20) / 2), D - 20));
    const R = Math.max(10, Math.min(raioEntrada, raioMaxPermitido));

    const num_arc = 24;

    // 1. FRONT_PATH (Caminho contínuo da casca com 2 curvas: de [0, D] até [W, D])
    const front_path = [];
    front_path.push([0.0, D]);
    front_path.push([0.0, R]);
    // Curva 1 (esquerda)
    for (let s = 1; s < num_arc; s++) {
      const ang = Math.PI + (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      front_path.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    front_path.push([R, 0.0]);
    front_path.push([W - R, 0.0]);
    // Curva 2 (direita)
    for (let s = 1; s < num_arc; s++) {
      const ang = 1.5 * Math.PI + (0.5 * Math.PI) * (s / num_arc);
      const px = (W - R) + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      front_path.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    front_path.push([W, R]);
    front_path.push([W, D]);

    // 2. TOP_OUTLINE (Tampo Duplo elegante e limpo: 2 cantos arredondados)
    const top_outline = [];
    top_outline.push([0.0, D]);
    top_outline.push([0.0, R]);
    for (let s = 1; s < num_arc; s++) {
      const ang = Math.PI + (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      top_outline.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    top_outline.push([R, 0.0]);
    top_outline.push([W - R, 0.0]);
    for (let s = 1; s < num_arc; s++) {
      const ang = 1.5 * Math.PI + (0.5 * Math.PI) * (s / num_arc);
      const px = (W - R) + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      top_outline.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    top_outline.push([W, R]);
    top_outline.push([W, D]);
    top_outline.push([0.0, D]);

    // 3. RIPAS ESTRUTURAIS TRASEIRAS
    const ripas = [
      { x0: 0.0, x1: 70.0, y0: D - T, y1: D, face_amadeirada: 'frente' },
      { x0: W - 70.0, x1: W, y0: D - T, y1: D, face_amadeirada: 'frente' }
    ];

    const zMeio = Math.round((H - T) / 2);
    const curvoSimplesData = {
      kind: 'curvo_duplo_fresagens',
      altura: H,
      espessura_mdf: T,
      espessura_flex: 1.0,
      largura: W,
      profundidade: D,
      raio_nominal: R,
      raio_max_permitido: raioMaxPermitido,
      estrutura_z: [0.0, zMeio, H - T],
      estrutura_kind: ['bottom', 'shelf', 'top'],
      reforco_z: gerarReforco ? [zMeio] : [],
      reforco_ativo: gerarReforco,
      reforco_auto_desativado: false,
      top_outline,
      front_path,
      front_flex_start_idx: 1,
      front_flex_end_idx: front_path.length - 2,
      reforco_outline: top_outline,
      reforco_outlines: [top_outline],
      ripas
    };

    // 4. CAMADAS 2D CAD & DXF (Layout Duplo Completo)
    const camadas = [];
    const gap = 25.0;

    const compRetoLat = D - R;
    const compArco = (Math.PI * R) / 2;
    const compRetoFrente = W - 2 * R;
    const L_dev = parseFloat((2 * compRetoLat + 2 * compArco + compRetoFrente).toFixed(2));

    // A) Casca Dupla Desenvolvida
    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: [
        { x: 0, y: 0 },
        { x: L_dev, y: 0 },
        { x: L_dev, y: H },
        { x: 0, y: H }
      ]
    });

    // Encaixes usinados em verde
    camadas.push({
      layer: 'USINAGEM',
      tipo: 'polyline',
      fechada: true,
      pontos: [
        { x: 0, y: 0 },
        { x: T, y: 0 },
        { x: T, y: H },
        { x: 0, y: H }
      ]
    });
    camadas.push({
      layer: 'USINAGEM',
      tipo: 'polyline',
      fechada: true,
      pontos: [
        { x: L_dev - T, y: 0 },
        { x: L_dev, y: 0 },
        { x: L_dev, y: H },
        { x: L_dev - T, y: H }
      ]
    });

    // Linhas de dobra kerfing na Curva 1 e Curva 2
    const passoDobra = 8.0;
    const numRasgos = Math.max(4, Math.floor(compArco / passoDobra));
    const passoReal = compArco / numRasgos;
    
    // Curva 1
    const xInicioC1 = compRetoLat;
    for (let i = 1; i < numRasgos; i++) {
      const xK = parseFloat((xInicioC1 + i * passoReal).toFixed(2));
      camadas.push({ layer: 'FRESAGEM_DOBRA', tipo: 'line', x1: xK, y1: 0, x2: xK, y2: H });
    }
    // Curva 2
    const xInicioC2 = compRetoLat + compArco + compRetoFrente;
    for (let i = 1; i < numRasgos; i++) {
      const xK = parseFloat((xInicioC2 + i * passoReal).toFixed(2));
      camadas.push({ layer: 'FRESAGEM_DOBRA', tipo: 'line', x1: xK, y1: 0, x2: xK, y2: H });
    }

    // B) Três Peças Curvas Duplas Empilhadas: 1. Tampo, 2. Prateleira, 3. Base
    const y0_tampo = H + gap + 10;
    const y0_prat = y0_tampo + D + gap;
    const y0_base = y0_prat + D + gap;

    [y0_tampo, y0_prat, y0_base].forEach((yOff) => {
      camadas.push({
        layer: 'CORTE',
        tipo: 'polyline',
        fechada: true,
        pontos: top_outline.map(p => ({ x: p[0], y: p[1] + yOff }))
      });
    });

    // C) Cotas Dimensionais
    camadas.push({
      layer: 'COTAS',
      tipo: 'dimension',
      x1: 0, y1: y0_base + D + 15,
      x2: W, y2: y0_base + D + 15,
      texto: `${W} mm`
    });
    camadas.push({
      layer: 'COTAS',
      tipo: 'dimension',
      x1: -15, y1: y0_base,
      x2: -15, y2: y0_base + D,
      texto: `${D} mm`
    });

    return {
      curvoSimplesData,
      camadas,
      larguraTotal: Math.max(L_dev, W) + 50,
      alturaTotal: y0_base + D + 50
    };
  }'''

pos_start = code.find('calcularCurvoDuplo(params) {')
# find matching closing bracket
bracket_count = 0
pos_end = -1
for i in range(pos_start, len(code)):
    if code[i] == '{':
        bracket_count += 1
    elif code[i] == '}':
        bracket_count -= 1
        if bracket_count == 0:
            pos_end = i + 1
            break

print(f'Replacing calcularCurvoDuplo from {pos_start} to {pos_end}')
code = code[:pos_start] + new_duplo + code[pos_end:]

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated calcularCurvoDuplo successfully!')
