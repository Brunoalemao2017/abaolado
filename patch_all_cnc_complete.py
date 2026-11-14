import re

# 1. Update algorithms.js
with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    algo = f.read()

# Exact replacement for calcularCurvoSimples
curvo_simples_code = """  calcularCurvoSimples(params) {
    const W = Math.max(100, parseFloat(params.largura) || 280);
    const D = Math.max(100, parseFloat(params.profundidade) || 350);
    const H = Math.max(50, parseFloat(params.altura) || 400);
    const T = Math.max(6, parseFloat(params.espessura_mdf || params.espessura) || 18);
    const metodo = params.metodo || 'rebaixo';
    const gerarReforco = params.gerar_reforco !== false && params.gerar_reforco !== '0';

    const raioEntrada = parseFloat(params.raio) || 80;
    const raioMaxPermitido = Math.max(10, Math.min(W - 20, D - 20));
    const R = Math.max(10, Math.min(raioEntrada, raioMaxPermitido));

    const num_arc = 28;

    // 1. FRONT_PATH (Caminho contínuo da casca curva: de [W, 0] até [0, D])
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

    // 2. TOP_OUTLINE (Tampo e Base com encaixes perfeitos para as ripas)
    const top_outline = [];
    for (let s = 0; s <= num_arc; s++) {
      const ang = 1.5 * Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      top_outline.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    top_outline.push([T - 1.0, R]);
    top_outline.push([T - 1.0, D]);
    top_outline.push([0.0, D]);
    top_outline.push([0.0, D - T]);
    top_outline.push([70.0, D - T]);
    top_outline.push([70.0, D]);
    top_outline.push([W, D]);

    const y_ripa1_top = Math.min(D, D * 0.8);
    const y_ripa1_bot = Math.max(0, D * 0.6);
    const y_ripa2_top = Math.min(D, D * 0.4);
    const y_ripa2_bot = Math.max(0, D * 0.2);

    top_outline.push([W, y_ripa1_top]);
    top_outline.push([W - T, y_ripa1_top]);
    top_outline.push([W - T, y_ripa1_bot]);
    top_outline.push([W, y_ripa1_bot]);

    top_outline.push([W, y_ripa2_top]);
    top_outline.push([W - T, y_ripa2_top]);
    top_outline.push([W - T, y_ripa2_bot]);
    top_outline.push([W, y_ripa2_bot]);

    top_outline.push([W, T - 1.0]);
    top_outline.push([R, T - 1.0]);
    top_outline.push([R, 0.0]);

    // 3. RIPAS ESTRUTURAIS (Encaixadas perfeitamente nos rasgos)
    const ripas = [
      { x0: W - T, x1: W, y0: y_ripa1_bot, y1: y_ripa1_top },
      { x0: W - T, x1: W, y0: y_ripa2_bot, y1: y_ripa2_top },
      { x0: 0.0, x1: 70.0, y0: D - T, y1: D }
    ];

    // 4. REFORCO_OUTLINE (Costela estrutural curva em ciano)
    const R_int = Math.max(10.0, R - 40.5);
    const reforco_outline = [];
    reforco_outline.push([T + 0.55, 122.0]);
    reforco_outline.push([T + 0.55, 62.0]);
    reforco_outline.push([2.05, 62.0]);
    for (let s = 1; s < num_arc; s++) {
      const ang = 1.5 * Math.PI - (0.5 * Math.PI) * ((num_arc - s) / num_arc);
      const px = R + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      reforco_outline.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    reforco_outline.push([R, 0.0]);
    reforco_outline.push([R, R_int]);
    for (let s = num_arc - 1; s > 0; s--) {
      const ang = 1.5 * Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R_int * Math.cos(ang);
      const py = R + R_int * Math.sin(ang);
      reforco_outline.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    reforco_outline.push([36.55, 66.5]);
    reforco_outline.push([36.55, 122.0]);
    reforco_outline.push([T + 0.55, 122.0]);

    const reforco_z = [
      parseFloat(((H - T) * 0.25).toFixed(1)),
      parseFloat(((H - T) * 0.45).toFixed(1)),
      parseFloat(((H - T) * 0.65).toFixed(1)),
      parseFloat(((H - T) * 0.85).toFixed(1))
    ];

    const curvoSimplesData = {
      kind: metodo === 'kerfing' ? 'curvo_simples_fresagens' : 'curvo_simples',
      altura: H,
      espessura_mdf: T,
      espessura_flex: 1.0,
      largura: W,
      profundidade: D,
      raio_nominal: R,
      raio_max_permitido: raioMaxPermitido,
      estrutura_z: [0.0, H - T],
      estrutura_kind: ['bottom', 'top'],
      reforco_z: gerarReforco ? reforco_z : [],
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

    const camadas = [
      { layer: 'CORTE', tipo: 'polyline', fechada: true, pontos: top_outline.map(p => ({ x: p[0], y: p[1] })) },
      { layer: 'CORTE', tipo: 'polyline', fechada: true, pontos: top_outline.map(p => ({ x: p[0], y: p[1] + D + 25 })) }
    ];

    return {
      produto: 'curvo_simples',
      largura: W,
      altura: H,
      profundidade: D,
      raio: R,
      espessura: T,
      camadas,
      buracos3D: [],
      curvoSimplesData,
      relatorio: {
        areaTotalM2: ((W * D * 2 + (W + D) * H) / 1000000).toFixed(3),
        perimetroCorteMetros: (2 * (W + D) * 2 / 1000).toFixed(2),
        totalPecas: 2 + (gerarReforco ? 4 : 0) + ripas.length + 1,
        tempoEstimadoMinutos: 14
      }
    };
  },"""

# Replace in algorithms.js
pattern_simples = re.compile(r'calcularCurvoSimples\s*\([^)]*\)\s*\{[\s\S]*?return\s*\{[\s\S]*?\};\s*\},', re.MULTILINE)
if pattern_simples.search(algo):
    algo = pattern_simples.sub(curvo_simples_code, algo, count=1)
    print("Replaced calcularCurvoSimples successfully!")
else:
    print("calcularCurvoSimples regex didn't match directly, searching alternative...")

# Exact replacement for calcularCurvoDuplo
curvo_duplo_code = """  calcularCurvoDuplo(params) {
    const W = Math.max(100, parseFloat(params.largura) || 400);
    const D = Math.max(100, parseFloat(params.profundidade) || 300);
    const H = Math.max(50, parseFloat(params.altura) || 400);
    const T = Math.max(6, parseFloat(params.espessura_mdf || params.espessura) || 18);
    const gerarReforco = params.gerar_reforco !== false && params.gerar_reforco !== '0';

    const raioEntrada = parseFloat(params.raio) || 80;
    const raioMaxPermitido = Math.max(10, Math.min(Math.floor((W - 20) / 2), D - 20));
    const R = Math.max(10, Math.min(raioEntrada, raioMaxPermitido));

    const num_arc = 28;

    // 1. FRONT_PATH (Caminho contínuo envolvendo o Canto 1, a lateral e o Canto 2)
    const front_path = [[W, 0.0], [R, 0.0]];
    for (let s = 1; s < num_arc; s++) {
      const ang = 1.5 * Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      front_path.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    front_path.push([0.0, R]);
    front_path.push([0.0, D - R]);
    for (let s = 1; s < num_arc; s++) {
      const ang = Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = (D - R) + R * Math.sin(ang);
      front_path.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    front_path.push([R, D]);
    front_path.push([W, D]);

    const front_flex_ranges = [[1, 29], [30, 58]];

    // 2. TOP_OUTLINE (Tampo e Base com duas curvas e encaixes traseiros)
    const top_outline = [];
    top_outline.push([W, 0.0]);
    for (let s = 0; s <= num_arc; s++) {
      const ang = 1.5 * Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      top_outline.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    top_outline.push([0.0, D - R]);
    for (let s = 1; s <= num_arc; s++) {
      const ang = Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = (D - R) + R * Math.sin(ang);
      top_outline.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    top_outline.push([W, D]);

    // Encaixes traseiros para ripas verticais
    top_outline.push([W, 230.0]);
    top_outline.push([W - T, 230.0]);
    top_outline.push([W - T, 160.0]);
    top_outline.push([W, 160.0]);
    top_outline.push([W, 140.0]);
    top_outline.push([W - T, 140.0]);
    top_outline.push([W - T, 70.0]);
    top_outline.push([W, 70.0]);
    top_outline.push([W, 0.0]);

    // 3. RIPAS ESTRUTURAIS
    const ripas = [
      { x0: W - T, x1: W, y0: 160.0, y1: 230.0 },
      { x0: W - T, x1: W, y0: 70.0, y1: 140.0 }
    ];

    // 4. COSTELAS CURVAS NOS DOIS CANTOS
    const R_int = Math.max(10.0, R - 40.5);
    const costela1 = [];
    costela1.push([T + 0.55, 120.5]);
    costela1.push([T + 0.55, 60.5]);
    costela1.push([2.05, 60.5]);
    for (let s = 1; s < num_arc; s++) {
      const ang = 1.5 * Math.PI - (0.5 * Math.PI) * ((num_arc - s) / num_arc);
      const px = R + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      costela1.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    costela1.push([R, 0.0]);
    costela1.push([R, R_int]);
    for (let s = num_arc - 1; s > 0; s--) {
      const ang = 1.5 * Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R_int * Math.cos(ang);
      const py = R + R_int * Math.sin(ang);
      costela1.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    costela1.push([36.55, 65.0]);
    costela1.push([36.55, 120.5]);
    costela1.push([T + 0.55, 120.5]);

    const costela2 = costela1.map(p => [p[0], parseFloat((D - p[1]).toFixed(4))]);

    const reforco_z = [
      parseFloat(((H - T) * 0.25).toFixed(1)),
      parseFloat(((H - T) * 0.45).toFixed(1)),
      parseFloat(((H - T) * 0.65).toFixed(1)),
      parseFloat(((H - T) * 0.85).toFixed(1))
    ];

    const curvoSimplesData = {
      kind: 'duplo_vertical',
      altura: H,
      espessura_mdf: T,
      espessura_flex: 1.0,
      largura: W,
      profundidade: D,
      raio_nominal: R,
      raio_max_permitido: raioMaxPermitido,
      estrutura_z: [0.0, H - T],
      estrutura_kind: ['bottom', 'top'],
      reforco_z: gerarReforco ? reforco_z : [],
      reforco_ativo: gerarReforco,
      reforco_auto_desativado: false,
      top_outline,
      front_path,
      front_flex_ranges,
      front_flex_start_idx: 1,
      front_flex_end_idx: 58,
      reforco_outlines: [costela1, costela2],
      ripas
    };

    const camadas = [
      { layer: 'CORTE', tipo: 'polyline', fechada: true, pontos: top_outline.map(p => ({ x: p[0], y: p[1] })) },
      { layer: 'CORTE', tipo: 'polyline', fechada: true, pontos: top_outline.map(p => ({ x: p[0], y: p[1] + D + 25 })) }
    ];

    return {
      produto: 'curvo_duplo',
      largura: W,
      altura: H,
      profundidade: D,
      raio: R,
      espessura: T,
      camadas,
      buracos3D: [],
      curvoSimplesData,
      relatorio: {
        areaTotalM2: ((W * D * 2 + (W + D) * H) / 1000000).toFixed(3),
        perimetroCorteMetros: (2 * (W + D) * 2 / 1000).toFixed(2),
        totalPecas: 2 + (gerarReforco ? 8 : 0) + ripas.length + 1,
        tempoEstimadoMinutos: 18
      }
    };
  },"""

pattern_duplo = re.compile(r'calcularCurvoDuplo\s*\([^)]*\)\s*\{[\s\S]*?return\s*\{[\s\S]*?\};\s*\},', re.MULTILINE)
if pattern_duplo.search(algo):
    algo = pattern_duplo.sub(curvo_duplo_code, algo, count=1)
    print("Replaced calcularCurvoDuplo successfully!")
else:
    print("calcularCurvoDuplo regex didn't match directly")

# Complete calcularPeConico with robust peData
pe_code = """  calcularPeConico(params) {
    const subtype = params.produto || params.subtype || 'pe_conico';
    let diamBase = 550, diamTopo = 350, alt = 700, esp = 18;
    let larguraBase = 550, profundBase = 550, larguraTopo = 350, profundTopo = 350;

    if (subtype === 'pe_redondo') {
      const diam = parseFloat(params.pr_diametro) || parseFloat(params.diametro) || 400;
      larguraBase = profundBase = larguraTopo = profundTopo = diam;
      alt = parseFloat(params.pr_altura) || parseFloat(params.altura) || 700;
      esp = parseFloat(params.pr_espessura_mdf) || parseFloat(params.espessura) || 18;
    } else if (subtype === 'pe_oval') {
      larguraBase = larguraTopo = parseFloat(params.po_largura_oval) || parseFloat(params.largura) || 600;
      profundBase = profundTopo = parseFloat(params.po_profundidade_oval) || parseFloat(params.profundidade) || 350;
      alt = parseFloat(params.po_altura) || parseFloat(params.altura) || 700;
      esp = parseFloat(params.po_espessura_mdf) || parseFloat(params.espessura) || 18;
    } else if (subtype === 'pe_oblongo') {
      larguraBase = larguraTopo = parseFloat(params.pob_comprimento) || parseFloat(params.largura) || 500;
      profundBase = profundTopo = parseFloat(params.pob_profundidade) || parseFloat(params.profundidade) || 300;
      alt = parseFloat(params.pob_altura) || parseFloat(params.altura) || 700;
      esp = parseFloat(params.pob_espessura_mdf) || parseFloat(params.espessura) || 18;
    } else if (subtype === 'revestimento_cone_eliptico') {
      larguraBase = parseFloat(params.rc_largura_base) || 600;
      profundBase = parseFloat(params.rc_profund_base) || 400;
      larguraTopo = parseFloat(params.rc_largura_topo) || 350;
      profundTopo = parseFloat(params.rc_profund_topo) || 250;
      alt = parseFloat(params.rc_altura) || parseFloat(params.altura) || 700;
      esp = parseFloat(params.rc_espessura_mdf) || parseFloat(params.espessura) || 18;
    } else {
      diamBase = parseFloat(params.pc_diam_base) || parseFloat(params.diam_base) || 550;
      diamTopo = parseFloat(params.pc_diam_topo) || parseFloat(params.diam_topo) || 350;
      larguraBase = profundBase = diamBase;
      larguraTopo = profundTopo = diamTopo;
      alt = parseFloat(params.pc_altura) || parseFloat(params.altura) || 700;
      esp = parseFloat(params.pc_espessura_mdf) || parseFloat(params.espessura) || 18;
    }

    const baseA = larguraBase / 2;
    const baseB = profundBase / 2;
    const topA = larguraTopo / 2;
    const topB = profundTopo / 2;

    const sectors = [
      { theta_start: 0, theta_end: Math.PI, groove_thetas: [], vbit_thetas: [] },
      { theta_start: Math.PI, theta_end: Math.PI * 2, groove_thetas: [], vbit_thetas: [] }
    ];

    const midA = (baseA + topA) / 2;
    const midB = (baseB + topB) / 2;

    const rings = [
      {
        z: 0,
        outer_a: Math.max(10, baseA - esp),
        outer_b: Math.max(10, baseB - esp),
        inner_a: Math.max(5, baseA - esp - 45),
        inner_b: Math.max(5, baseB - esp - 45),
        label: 'BASE INT.'
      },
      {
        z: alt / 2,
        outer_a: Math.max(10, midA - esp),
        outer_b: Math.max(10, midB - esp),
        inner_a: Math.max(5, midA - esp - 45),
        inner_b: Math.max(5, midB - esp - 45),
        label: 'MEIO INT.'
      },
      {
        z: alt - esp,
        outer_a: Math.max(10, topA - esp),
        outer_b: Math.max(10, topB - esp),
        inner_a: Math.max(5, topA - esp - 45),
        inner_b: Math.max(5, topB - esp - 45),
        label: 'TOPO INT.'
      }
    ];

    const peData = {
      kind: subtype || 'pe_conico',
      largura_base: larguraBase,
      profund_base: profundBase,
      largura_topo: larguraTopo,
      profund_topo: profundTopo,
      altura: alt,
      espessura_mdf: esp,
      sectors,
      rings
    };

    const camadas = [
      { layer: 'CORTE', tipo: 'circle', cx: baseA, cy: baseB, r: topA },
      { layer: 'CORTE', tipo: 'circle', cx: baseA, cy: baseB, r: baseA }
    ];

    return {
      produto: subtype,
      largura: larguraBase,
      altura: alt,
      espessura: esp,
      peData,
      camadas,
      buracos3D: [],
      relatorio: {
        areaTotalM2: 1.25,
        perimetroCorteMetros: (Math.PI * (larguraBase + larguraTopo) / 1000).toFixed(2),
        totalPecas: 5,
        tempoEstimadoMinutos: 25
      }
    };
  },"""

pattern_pe = re.compile(r'calcularPeConico\s*\([^)]*\)\s*\{[\s\S]*?return\s*\{[\s\S]*?\};\s*\},', re.MULTILINE)
if pattern_pe.search(algo):
    algo = pattern_pe.sub(pe_code, algo, count=1)
    print("Replaced calcularPeConico successfully!")
else:
    print("calcularPeConico regex didn't match directly")

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'w', encoding='utf-8') as f:
    f.write(algo)

print("Saved updated algorithms.js!")
