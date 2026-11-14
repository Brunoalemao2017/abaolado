# Script to update public/js/algorithms.js with complete Canto Curvo, Portas Cava, and Pés Especiais
import re

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace calcularCurvoSimples
new_simples = '''  calcularCurvoSimples(params) {
    const W = Math.max(100, parseFloat(params.largura) || 400);
    const D = Math.max(100, parseFloat(params.profundidade) || 300);
    const H = Math.max(50, parseFloat(params.altura) || 400);
    const T = Math.max(6, parseFloat(params.espessura_mdf || params.espessura) || 18);
    const metodo = params.metodo || 'kerfing';
    const gerarReforco = params.gerar_reforco !== false && params.gerar_reforco !== '0';

    const raioEntrada = parseFloat(params.raio) || 80;
    const raioMaxPermitido = Math.max(10, Math.min(W - 20, D - 20));
    const R = Math.max(10, Math.min(raioEntrada, raioMaxPermitido));

    const num_arc = 32;

    // 1. FRONT_PATH (Caminho da casca curva: de [W, 0] até [0, D])
    const front_path = [[W, 0.0], [R, 0.0]];
    for (let s = 1; s < num_arc; s++) {
      const ang = 1.5 * Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      front_path.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    front_path.push([0.0, R]);
    front_path.push([0.0, D]);

    const front_flex_start_idx = 1;
    const front_flex_end_idx = front_path.length - 2;

    // 2. TOP_OUTLINE (Tampo, Prateleira e Base limpos com canto curvo, idêntico ao Central DXF PRO original)
    // Percurso fechado: arco de (R,0) até (0,R), segue até (0,D), depois (W,D), depois (W,0) e fecha em (R,0)
    const top_outline = [];
    for (let s = 0; s <= num_arc; s++) {
      const ang = 1.5 * Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      top_outline.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    top_outline.push([0.0, D]);
    top_outline.push([W, D]);
    top_outline.push([W, 0.0]);
    top_outline.push([R, 0.0]);

    // 3. RIPAS ESTRUTURAIS TRASEIRAS (Montantes verticais no fundo do móvel)
    const ripas = [
      { x0: W - T, x1: W, y0: D - 70.0, y1: D, face_amadeirada: 'direita' },
      { x0: 0.0, x1: 70.0, y0: D - T, y1: D, face_amadeirada: 'frente' }
    ];

    // 4. REFORÇO CURVO (Costela opcional)
    const R_int = Math.max(10.0, R - 40.5);
    const reforco_outline = [];
    for (let s = 0; s <= num_arc; s++) {
      const ang = 1.5 * Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      reforco_outline.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    reforco_outline.push([0.0, R_int + 20]);
    reforco_outline.push([R_int + 20, R_int + 20]);
    reforco_outline.push([R_int + 20, 0.0]);
    reforco_outline.push([R, 0.0]);

    const zMeio = Math.round((H - T) / 2);
    const curvoSimplesData = {
      kind: metodo === 'kerfing' ? 'curvo_simples_fresagens' : 'curvo_simples',
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
      front_flex_start_idx,
      front_flex_end_idx,
      reforco_outline,
      reforco_outlines: [reforco_outline],
      ripas
    };

    // 5. CAMADAS 2D CAD & DXF (Layout idêntico à imagem oficial da Central DXF PRO)
    // - No topo: Painel desenvolvido com rasgos verdes de usinagem e linhas amarelas de dobra
    // - Abaixo: 3 tampos/prateleiras curvas empilhadas com cotas dimensionais
    const camadas = [];
    const gap = 25.0;

    const compReto1 = W - R;
    const compArco = (Math.PI * R) / 2;
    const compReto2 = D - R;
    const L_dev = parseFloat((compReto1 + compArco + compReto2).toFixed(2));

    // A) Casca Desenvolvida (em X=0, Y=0)
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

    // Encaixes usinados (em verde / USINAGEM) na casca para os montantes verticais
    camadas.push({
      layer: 'USINAGEM',
      tipo: 'polyline',
      fechada: true,
      pontos: [
        { x: compReto1 - T, y: 0 },
        { x: compReto1, y: 0 },
        { x: compReto1, y: H },
        { x: compReto1 - T, y: H }
      ]
    });
    camadas.push({
      layer: 'USINAGEM',
      tipo: 'polyline',
      fechada: true,
      pontos: [
        { x: L_dev - 70.0, y: 0 },
        { x: L_dev - 70.0 + T, y: 0 },
        { x: L_dev - 70.0 + T, y: H },
        { x: L_dev - 70.0, y: H }
      ]
    });

    // Linhas de fresagem de dobra kerfing no arco
    const passoDobra = 8.0;
    const numRasgos = Math.max(4, Math.floor(compArco / passoDobra));
    const passoReal = compArco / numRasgos;
    for (let i = 1; i < numRasgos; i++) {
      const xDobra = parseFloat((compReto1 + i * passoReal).toFixed(2));
      camadas.push({
        layer: 'FRESAGEM_DOBRA',
        tipo: 'line',
        x1: xDobra, y1: 0,
        x2: xDobra, y2: H
      });
    }

    // B) Três Peças Curvas Empilhadas: 1. Tampo, 2. Prateleira, 3. Base
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

    // C) Cotas Dimensionais (em azul / COTAS)
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

# Replace calcularCurvoSimples in code
pos_start = code.find('calcularCurvoSimples(params) {')
# find matching closing bracket for calcularCurvoSimples
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

print(f'Replacing calcularCurvoSimples from {pos_start} to {pos_end}')
code = code[:pos_start] + new_simples + code[pos_end:]

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated calcularCurvoSimples successfully!')
