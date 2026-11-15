/**
 * CENTRAL DXF PRO - MOTOR MATEMÁTICO E PARAMÉTRICO CNC COMPLETO
 * Implementação 100% fiel à arquitetura do Central DXF PRO.
 */

const AlgoritmosCNC = {

  // =========================================================================
  // 1. CANTO CURVO SIMPLES (MODELO EXATO CENTRAL DXF COM VALIDAÇÃO PARAMÉTRICA)
  // =========================================================================
      calcularCurvoSimples(params) {
    const W = Math.max(100, parseFloat(params.largura) || 400);
    const D = Math.max(100, parseFloat(params.profundidade) || 300);
    const H = Math.max(50, parseFloat(params.altura) || 400);
    const T = Math.max(6, parseFloat(params.espessura_mdf || params.espessura) || 18);
    const gerarReforco = params.gerar_reforco !== false && params.gerar_reforco !== '0';

    const raioEntrada = parseFloat(params.raio) || 80;
    const raioMaxPermitido = Math.max(10, Math.min(W - 20, D - 20));
    const R = Math.max(10, Math.min(raioEntrada, raioMaxPermitido));

    const num_arc = 28;

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

    // Posições das ripas laterais na parede direita
    const y_ripa1_top = Math.min(D, D * 0.8);
    const y_ripa1_bot = Math.max(0, D * 0.6);
    const y_ripa2_top = Math.min(D, D * 0.4);
    const y_ripa2_bot = Math.max(0, D * 0.2);

    // 2. TOP_OUTLINE (Tampo e Base oficiais com entalhes de encaixe para ripas)
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

    // 3. RIPAS ESTRUTURAIS VERTICAIS (Montantes do esqueleto)
    const ripas = [
      { x0: W - T, x1: W, y0: y_ripa1_bot, y1: y_ripa1_top, face_amadeirada: 'direita' },
      { x0: W - T, x1: W, y0: y_ripa2_bot, y1: y_ripa2_top, face_amadeirada: 'direita' },
      { x0: 0.0, x1: 70.0, y0: D - T, y1: D, face_amadeirada: 'frente' }
    ];

    // 4. REFORÇO CURVO (Costela oca oficial Central DXF)
    const R_int = Math.max(10.0, R - 40.5);
    const reforco_outline = [];
    reforco_outline.push([T + 0.55, 122.0]);
    reforco_outline.push([T + 0.55, 62.0]);
    reforco_outline.push([2.05, 62.0]);
    for (let s = 1; s < num_arc; s++) {
      const px = R + R * Math.cos(1.5 * Math.PI - (0.5 * Math.PI) * ((num_arc - s) / num_arc));
      const py = R + R * Math.sin(1.5 * Math.PI - (0.5 * Math.PI) * ((num_arc - s) / num_arc));
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

    const reforco_z_arr = gerarReforco
      ? [
          parseFloat(((H - T) * 0.25).toFixed(1)),
          parseFloat(((H - T) * 0.45).toFixed(1)),
          parseFloat(((H - T) * 0.65).toFixed(1)),
          parseFloat(((H - T) * 0.85).toFixed(1))
        ]
      : [];

    const curvoSimplesData = {
      kind: 'curvo_simples',
      altura: H,
      espessura_mdf: T,
      espessura_flex: 1.0,
      largura: W,
      profundidade: D,
      raio_nominal: R,
      raio_max_permitido: raioMaxPermitido,
      estrutura_z: [0.0, H - T],
      estrutura_kind: ['bottom', 'top'],
      reforco_z: reforco_z_arr,
      reforco_ativo: gerarReforco,
      reforco_auto_desativado: false,
      top_outline,
      front_path,
      front_flex_start_idx,
      front_flex_end_idx,
      reforco_outline: gerarReforco ? reforco_outline : [],
      reforco_outlines: gerarReforco ? [reforco_outline] : [],
      ripas
    };

    // 5. CAMADAS 2D CAD & DXF (TODAS AS PEÇAS PARA CORTE CNC)
    const camadas = [];
    const gap = 30.0;

    const compReto1 = W - R;
    const compArco = (Math.PI * R) / 2;
    const compReto2 = D - R;
    const L_dev = parseFloat((compReto1 + compArco + compReto2).toFixed(2));

    // A) Peça 1: Casca Desenvolvida (em X=0, Y=0)
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

    // Encaixes usinados na casca
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

    // B) Peças 2 e 3: Tampo Superior e Base Inferior
    const y0_tampo = H + gap + 10;
    const y0_base = y0_tampo + D + gap;

    [y0_tampo, y0_base].forEach((yOff) => {
      camadas.push({
        layer: 'CORTE',
        tipo: 'polyline',
        fechada: true,
        pontos: top_outline.map(p => ({ x: p[0], y: p[1] + yOff }))
      });
    });

    // C) Peças 4, 5, 6, 7: As 4 Costelas Curvas de Reforço (Cyan no 3D)
    if (gerarReforco && reforco_outline.length) {
      for (let k = 0; k < 4; k++) {
        const x_ref = W + gap + k * (R + gap + 20);
        const y_ref = y0_tampo;
        camadas.push({
          layer: 'CORTE',
          tipo: 'polyline',
          fechada: true,
          pontos: reforco_outline.map(p => ({ x: p[0] + x_ref, y: p[1] + y_ref }))
        });
      }
    }

    // D) Peças 8, 9, 10: As 3 Ripas Verticais do Esqueleto (Magenta no 3D)
    const x_ripas_base = L_dev + gap;
    const altRipa = H;
    const ripasCoords = [
      { larg: y_ripa1_top - y_ripa1_bot, rotulo: 'RIPA_DIR_1' },
      { larg: y_ripa2_top - y_ripa2_bot, rotulo: 'RIPA_DIR_2' },
      { larg: 70.0, rotulo: 'RIPA_ESQ_FUNDO' }
    ];
    let curX_ripa = x_ripas_base;
    ripasCoords.forEach(r => {
      camadas.push({
        layer: 'CORTE',
        tipo: 'polyline',
        fechada: true,
        pontos: [
          { x: curX_ripa, y: 0 },
          { x: curX_ripa + r.larg, y: 0 },
          { x: curX_ripa + r.larg, y: altRipa },
          { x: curX_ripa, y: altRipa }
        ]
      });
      curX_ripa += r.larg + gap;
    });

    // E) Cotas Dimensionais
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
      larguraTotal: Math.max(curX_ripa, W + 4 * (R + gap + 20)) + 50,
      alturaTotal: y0_base + D + 50
    };
  },

  calcularCurvoParafusado(params) {
    const res = this.calcularCurvoSimples(params);
    res.produto = 'curvo_simples_parafusado';

    // Adicionar furações escareadas de fixação rápida (Camada FURACAO do DXF)
    const { largura: W, profundidade: D, altura: H, espessura: T, abaEncaixe, raioCurva: R } = res;
    const furacoes = [];

    // Furos verticais para parafusos nas abas e ripas
    const numFurosAlt = Math.max(2, Math.floor(H / 120));
    for (let f = 1; f <= numFurosAlt; f++) {
      const zFuro = (H / (numFurosAlt + 1)) * f;
      furacoes.push({ layer: 'FURACAO', tipo: 'circulo', cx: abaEncaixe / 2, cy: zFuro, r: 2.25 });
      furacoes.push({ layer: 'FURACAO', tipo: 'circulo', cx: abaEncaixe + (Math.PI * R) / 2 + Math.max(10, (D - R) / 2), cy: zFuro, r: 2.25 });
    }

    // Furos nos tampos para fixação das ripas verticais
    (res.curvoSimplesData.ripas || []).forEach(r => {
      const cx = (r.x0 + r.x1) / 2;
      const cy = (r.y0 + r.y1) / 2;
      furacoes.push({ layer: 'FURACAO', tipo: 'circulo', cx, cy, r: 2.25 });
    });

    res.camadas.push(...furacoes);
    res.curvoSimplesData.kind = 'curvo_duplo_parafusado';
    return res;
  },

      calcularCurvoDuplo(params) {
    const W = Math.max(100, parseFloat(params.largura) || 400);
    const D = Math.max(100, parseFloat(params.profundidade) || 300);
    const H = Math.max(50, parseFloat(params.altura) || 400);
    const T = Math.max(6, parseFloat(params.espessura_mdf || params.espessura) || 18);
    const gerarReforco = params.gerar_reforco !== false && params.gerar_reforco !== '0';

    const is180 = params.produto === 'curvo_duplo_180' || params.subtipo === 'curvo_duplo_180' || params.tipo_curvo === 'curvo_duplo_180';
    const raioEntrada = parseFloat(params.raio) || 80;
    const raioMaxPermitido = Math.max(10, Math.min(W - 20, Math.floor(D / 2)));
    const R = is180 ? Math.floor(D / 2) : Math.max(10, Math.min(raioEntrada, raioMaxPermitido));

    const num_arc = 28;

    // 1. FRONT_PATH (Caminho oficial Central DXF: de [W, 0] contornando as duas curvas até [W, D])
    const front_path = [[W, 0.0], [R, 0.0]];
    // Curva 1: de [R, 0] até [0, R]
    for (let s = 1; s < num_arc; s++) {
      const ang = 1.5 * Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      front_path.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    front_path.push([0.0, R]);
    // Trecho reto intermediário (se não for 180°)
    if (!is180 && D > 2 * R) {
      front_path.push([0.0, D - R]);
    }
    // Curva 2: de [0, D - R] até [R, D]
    for (let s = 1; s < num_arc; s++) {
      const ang = Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = (D - R) + R * Math.sin(ang);
      front_path.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    front_path.push([R, D]);
    front_path.push([W, D]);

    const front_flex_ranges = is180
      ? [[1, front_path.length - 2]]
      : [
          [1, num_arc],
          [front_path.length - 1 - num_arc, front_path.length - 2]
        ];

    // Posições das ripas traseiras na parede de fundo (X = W)
    const y_r1_bot = Math.max(10, Math.min(70.0, D * 0.2));
    const y_r1_top = y_r1_bot + 70.0;
    const y_r2_top = Math.min(D - 10, Math.max(D - 70.0, D * 0.8));
    const y_r2_bot = y_r2_top - 70.0;

    // 2. TOP_OUTLINE (Tampo e Base oficiais com 2 cantos curvos e encaixes de ripas)
    const top_outline = [];
    // Curva 1
    for (let s = 0; s <= num_arc; s++) {
      const ang = 1.5 * Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = R + R * Math.sin(ang);
      top_outline.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    // Lateral esquerda
    if (!is180 && D > 2 * R) {
      top_outline.push([0.0, D - R]);
    }
    // Curva 2
    for (let s = 1; s <= num_arc; s++) {
      const ang = Math.PI - (0.5 * Math.PI) * (s / num_arc);
      const px = R + R * Math.cos(ang);
      const py = (D - R) + R * Math.sin(ang);
      top_outline.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
    }
    // Parede superior até o fundo
    top_outline.push([W, D]);

    // Encaixes usinados para as 2 ripas na parede X = W
    top_outline.push([W, y_r2_top]);
    top_outline.push([W - T, y_r2_top]);
    top_outline.push([W - T, y_r2_bot]);
    top_outline.push([W, y_r2_bot]);

    top_outline.push([W, y_r1_top]);
    top_outline.push([W - T, y_r1_top]);
    top_outline.push([W - T, y_r1_bot]);
    top_outline.push([W, y_r1_bot]);

    // Fecha na parede inferior
    top_outline.push([W, 0.0]);
    top_outline.push([R, 0.0]);

    // 3. RIPAS ESTRUTURAIS TRASEIRAS (No fundo do móvel X = W)
    const ripas = [
      { x0: W - T, x1: W, y0: y_r1_bot, y1: y_r1_top, face_amadeirada: 'direita' },
      { x0: W - T, x1: W, y0: y_r2_bot, y1: y_r2_top, face_amadeirada: 'direita' }
    ];

    // 4. REFORÇO CURVO DUPLO & CURVO DUPLO 180° (Paramétrico sem saliências externas)
    let ro0 = [];
    let ro1 = [];
    let ro180 = [];
    let reforco_outlines = [];

    if (gerarReforco) {
      if (is180) {
        // CURVO DUPLO 180°: Arco contínuo de 180 graus seguindo a face interna da parede frontal
        const larguraReforco = Math.max(10.0, Math.min(R - 10.0, parseFloat(params.largura_reforco_180 || params.largura_reforco) || 30.0));
        const R_ext = R - 0.5;
        const R_int = Math.max(10.0, R_ext - larguraReforco);
        for (let s = 0; s <= 2 * num_arc; s++) {
          const ang = 1.5 * Math.PI - Math.PI * (s / (2 * num_arc));
          const px = R + R_ext * Math.cos(ang);
          const py = R + R_ext * Math.sin(ang);
          ro180.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
        }
        for (let s = 2 * num_arc; s >= 0; s--) {
          const ang = 1.5 * Math.PI - Math.PI * (s / (2 * num_arc));
          const px = R + R_int * Math.cos(ang);
          const py = R + R_int * Math.sin(ang);
          ro180.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
        }
        ro180.push([ro180[0][0], ro180[0][1]]);
        reforco_outlines = [ro180];
      } else {
        // CURVO DUPLO PADRÃO (com parede reta intermediária entre as duas curvas)
        const R_ext = R - 0.5;
        const R_int = Math.max(10.0, R_ext - 35.0);
        const y_flange_end = Math.min(D / 2 - 10.0, R + 40.0);
        const x_wall_inner = Math.max(0.5, parseFloat((R - R_ext).toFixed(4)));

        for (let s = 0; s <= num_arc; s++) {
          const ang = 1.5 * Math.PI - (0.5 * Math.PI) * (s / num_arc);
          const px = R + R_ext * Math.cos(ang);
          const py = R + R_ext * Math.sin(ang);
          ro0.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
        }
        ro0.push([parseFloat(x_wall_inner.toFixed(4)), parseFloat(y_flange_end.toFixed(4))]);
        ro0.push([parseFloat((x_wall_inner + T).toFixed(4)), parseFloat(y_flange_end.toFixed(4))]);
        ro0.push([parseFloat((x_wall_inner + T).toFixed(4)), parseFloat(R.toFixed(4))]);
        for (let s = num_arc; s >= 0; s--) {
          const ang = 1.5 * Math.PI - (0.5 * Math.PI) * (s / num_arc);
          const px = R + R_int * Math.cos(ang);
          const py = R + R_int * Math.sin(ang);
          ro0.push([parseFloat(px.toFixed(4)), parseFloat(py.toFixed(4))]);
        }
        ro0.push([ro0[0][0], ro0[0][1]]);

        ro1 = ro0.map(p => [parseFloat(p[0].toFixed(4)), parseFloat((D - p[1]).toFixed(4))]);
        reforco_outlines = [ro0, ro1];
      }
    }

    const reforco_z_arr = gerarReforco
      ? [
          parseFloat(((H - T) * 0.25).toFixed(1)),
          parseFloat(((H - T) * 0.45).toFixed(1)),
          parseFloat(((H - T) * 0.65).toFixed(1)),
          parseFloat(((H - T) * 0.85).toFixed(1))
        ]
      : [];

    const curvoSimplesData = {
      kind: 'curvo_duplo',
      altura: H,
      espessura_mdf: T,
      espessura_flex: 1.0,
      largura: W,
      profundidade: D,
      raio_nominal: R,
      raio_max_permitido: raioMaxPermitido,
      estrutura_z: [0.0, H - T],
      estrutura_kind: ['bottom', 'top'],
      reforco_z: reforco_z_arr,
      reforco_ativo: gerarReforco,
      reforco_auto_desativado: false,
      top_outline,
      front_path,
      front_flex_ranges,
      front_flex_start_idx: front_flex_ranges[0][0],
      front_flex_end_idx: (front_flex_ranges.length > 1 ? front_flex_ranges[1][1] : front_flex_ranges[0][1]),
      reforco_outline: is180 ? ro180 : ro0,
      reforco_outlines,
      ripas
    };

    // 5. CAMADAS 2D CAD & DXF (Todas as peças Duplas para corte CNC)
    const camadas = [];
    const gap = 30.0;

    const compRetoInf = W - R;
    const compRetoSup = W - R;
    const compArco = (Math.PI * R) / 2;
    const compRetoLat = (!is180 && D > 2 * R) ? (D - 2 * R) : 0;
    const L_dev = parseFloat((compRetoInf + compArco + compRetoLat + compArco + compRetoSup).toFixed(2));

    // A) Peça 1: Casca Desenvolvida Dupla
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

    // Encaixes usinados para os montantes
    camadas.push({
      layer: 'USINAGEM',
      tipo: 'polyline',
      fechada: true,
      pontos: [
        { x: compRetoInf - T, y: 0 },
        { x: compRetoInf, y: 0 },
        { x: compRetoInf, y: H },
        { x: compRetoInf - T, y: H }
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

    // Dobras kerfing Curva 1
    const passoDobra = 8.0;
    const numRasgos = Math.max(4, Math.floor(compArco / passoDobra));
    const passoReal = compArco / numRasgos;
    for (let i = 1; i < numRasgos; i++) {
      const xK = parseFloat((compRetoInf + i * passoReal).toFixed(2));
      camadas.push({ layer: 'FRESAGEM_DOBRA', tipo: 'line', x1: xK, y1: 0, x2: xK, y2: H });
    }

    // Dobras kerfing Curva 2
    const xInicioC2 = compRetoInf + compArco + compRetoLat;
    for (let i = 1; i < numRasgos; i++) {
      const xK = parseFloat((xInicioC2 + i * passoReal).toFixed(2));
      camadas.push({ layer: 'FRESAGEM_DOBRA', tipo: 'line', x1: xK, y1: 0, x2: xK, y2: H });
    }

    // B) Peças 2 e 3: Tampo e Base Duplos
    const y0_tampo = H + gap + 10;
    const y0_base = y0_tampo + D + gap;

    [y0_tampo, y0_base].forEach((yOff) => {
      camadas.push({
        layer: 'CORTE',
        tipo: 'polyline',
        fechada: true,
        pontos: top_outline.map(p => ({ x: p[0], y: p[1] + yOff }))
      });
    });

    // C) Peças 4..11: Costelas Curvas de Reforço (4 para Corner 1 e 4 para Corner 2)
    if (gerarReforco) {
      if (is180) {
        for (let k = 0; k < 4; k++) {
          const x_ref = W + gap + k * (R + gap + 20);
          camadas.push({
            layer: 'CORTE',
            tipo: 'polyline',
            fechada: true,
            pontos: ro180.map(p => ({ x: p[0] + x_ref, y: p[1] + y0_tampo }))
          });
        }
      } else {
        for (let k = 0; k < 4; k++) {
          const x_ref = W + gap + k * (R + gap + 20);
          camadas.push({
            layer: 'CORTE',
            tipo: 'polyline',
            fechada: true,
            pontos: ro0.map(p => ({ x: p[0] + x_ref, y: p[1] + y0_tampo }))
          });
          camadas.push({
            layer: 'CORTE',
            tipo: 'polyline',
            fechada: true,
            pontos: ro1.map(p => ({ x: p[0] + x_ref, y: p[1] + y0_base }))
          });
        }
      }
    }

    // D) Peças 12 e 13: As 2 Ripas Verticais
    const x_ripas_base = L_dev + gap;
    for (let k = 0; k < 2; k++) {
      const xRipa = x_ripas_base + k * (70 + gap);
      camadas.push({
        layer: 'CORTE',
        tipo: 'polyline',
        fechada: true,
        pontos: [
          { x: xRipa, y: 0 },
          { x: xRipa + 70, y: 0 },
          { x: xRipa + 70, y: H },
          { x: xRipa, y: H }
        ]
      });
    }

    // E) Cotas Dimensionais
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
      larguraTotal: Math.max(L_dev + 200, W + 4 * (R + gap + 20)) + 50,
      alturaTotal: y0_base + D + 50
    };
  },

  calcularPortaCava(params) {
    const W = parseFloat(params.largura) || 400;
    const H = parseFloat(params.altura) || 700;

    // Detectar tipo de cava a partir de produto, subtipo ou tipoCava
    const prod = (params.produto || params.subtipo || params.tipoCava || '').toLowerCase();
    let tipoCava = 'quadrada';
    if (prod.includes('longa')) tipoCava = 'longa';
    else if (prod.includes('redonda')) tipoCava = 'redonda';
    else if (prod.includes('sem_puxador') || prod.includes('sem-puxador')) tipoCava = 'sem_puxador';
    else if (prod.includes('quadrad')) tipoCava = 'quadrada';

    const larguraCava = parseFloat(params.puxador_largura || params.larguraCava) || 80;
    const alturaCava = parseFloat(params.puxador_altura || params.alturaCava) || 80;
    const posX = parseFloat(params.puxador_pos_x) || 40;
    const posY = parseFloat(params.puxador_pos_y) || 40;
    const ladoPuxador = (params.puxador_lado || 'direita').toLowerCase();

    const profCava = parseFloat(params.cnc_prof_puxador || params.profCava) || 12;
    const espessura = parseFloat(params.cnc_esp_material || params.espessura_material || params.espessura) || 18;
    const dobradicas = parseInt(params.dob_qtd || params.dobradicas) || 2;
    const diamCaneco = parseFloat(params.dob_diam_caneco) || 35;
    const recuoDobradica = parseFloat(params.dob_fix_inset || params.dob_recuo) || 21.5;
    const distBorda = parseFloat(params.dob_dist_borda) || 100;

    const camadas = [];

    // 1. Folha da porta (Camada CORTE)
    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]
    });

    let kindPorta = 'porta_cava_quadrada';
    let cavaObj = null;

    if (tipoCava === 'redonda') {
      kindPorta = 'porta_cava_redonda';
      const r_outer = Math.max(25, larguraCava / 2);
      const r_inner = Math.max(15, r_outer - 15);
      const cx = ladoPuxador.includes('esquerda') ? posX : (W - posX);
      const cy = ladoPuxador.includes('centralizado') ? (H / 2) : (H - posY);

      cavaObj = {
        centro: { x: cx, y: cy },
        raio_inner: r_inner,
        raio_outer: r_outer,
        profundidade_rebaixo: profCava,
        vbit: { profundidade: profCava, largura_chanfro: 5 }
      };

      camadas.push({ layer: 'USINAGEM', tipo: 'circle', cx, cy, r: r_outer });
      camadas.push({ layer: 'USINAGEM', tipo: 'circle', cx, cy, r: r_inner });

    } else if (tipoCava === 'longa') {
      kindPorta = 'porta_cava_longa';
      const y0 = H - alturaCava;
      cavaObj = {
        outer: { x0: 0, y0: Math.max(0, y0), x1: W, y1: H },
        inner: { x0: 0, y0: Math.max(0, y0 + 10), x1: W, y1: H },
        profundidade_rebaixo: profCava,
        vbit: { profundidade: profCava, largura_chanfro: 5 }
      };

      camadas.push({
        layer: 'USINAGEM',
        tipo: 'polyline',
        fechada: true,
        pontos: [{ x: 0, y: y0 }, { x: W, y: y0 }, { x: W, y: H }, { x: 0, y: H }]
      });

    } else if (tipoCava === 'sem_puxador') {
      kindPorta = 'porta_sem_puxador';
      cavaObj = null;

    } else {
      // Quadrada
      kindPorta = 'porta_cava_quadrada';
      const x0 = ladoPuxador.includes('esquerda') ? posX : (W - larguraCava - posX);
      const y0 = ladoPuxador.includes('centralizado') ? (H / 2 - alturaCava / 2) : (H - posY - alturaCava);
      const x1 = x0 + larguraCava;
      const y1 = y0 + alturaCava;

      cavaObj = {
        outer: { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(W, x1), y1: Math.min(H, y1) },
        inner: { x0: Math.max(0, x0 + 10), y0: Math.max(0, y0 + 10), x1: Math.min(W, x1 - 10), y1: Math.min(H, y1) },
        profundidade_rebaixo: profCava,
        vbit: { profundidade: profCava, largura_chanfro: 5 }
      };

      camadas.push({
        layer: 'USINAGEM',
        tipo: 'polyline',
        fechada: true,
        pontos: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
      });
    }

    // 2. Furos de Dobradiça Caneco 35mm e Furos de Parafusos
    const posicoesDobradicas = [distBorda, H - distBorda];
    if (dobradicas >= 3) posicoesDobradicas.push(H / 2);
    if (dobradicas >= 4) {
      posicoesDobradicas.push(distBorda + (H - 2 * distBorda) * 0.33);
      posicoesDobradicas.push(distBorda + (H - 2 * distBorda) * 0.66);
    }

    const furos_dobradica = [];
    const xDob = ladoPuxador.includes('esquerda') ? (W - recuoDobradica) : recuoDobradica;

    for (const yDob of posicoesDobradicas) {
      furos_dobradica.push({ x: xDob, y: yDob, diametro: diamCaneco });

      // Caneco 35mm
      camadas.push({ layer: 'USINAGEM', tipo: 'circle', cx: xDob, cy: yDob, r: diamCaneco / 2 });
      // Parafusos laterais 3mm (distância padrão de 48mm entre furos = 24mm de cada lado)
      camadas.push({ layer: 'FURACAO', tipo: 'circle', cx: xDob + 9.5, cy: yDob - 24, r: 1.5 });
      camadas.push({ layer: 'FURACAO', tipo: 'circle', cx: xDob + 9.5, cy: yDob + 24, r: 1.5 });
    }

    // 3. Cotas Dimensionais
    camadas.push({
      layer: 'COTAS',
      tipo: 'dimension',
      x1: 0, y1: H + 25,
      x2: W, y2: H + 25,
      texto: `${W} mm`
    });
    camadas.push({
      layer: 'COTAS',
      tipo: 'dimension',
      x1: -25, y1: 0,
      x2: -25, y2: H,
      texto: `${H} mm`
    });

    const portaData = {
      kind: kindPorta,
      largura: W,
      altura: H,
      espessura_material: espessura,
      cava: cavaObj,
      furos_dobradica
    };

    return {
      portaData,
      camadas,
      larguraTotal: W + 60,
      alturaTotal: H + 60
    };
  },

  // =========================================================================
  // 3. PRATELEIRAS DUPLAS
  // =========================================================================
  calcularPrateleiraDupla(params) {
    const W = parseFloat(params.largura) || 800;
    const H = parseFloat(params.altura) || 250;
    const espessura = parseFloat(params.espessura) || 18;
    const margemInterna = parseFloat(params.margemInterna) || 20;
    const diamCavilha = parseFloat(params.diamCavilha) || 8;
    const raioCavilha = diamCavilha / 2;

    const camadas = [];
    const rebaixos3D = [];
    const espacamento = 30;
    const W_total = W;
    const H_total = H * 2 + espacamento;

    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]
    });

    const yP2 = H + espacamento;
    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: [{ x: 0, y: yP2 }, { x: W, y: yP2 }, { x: W, y: yP2 + H }, { x: 0, y: yP2 + H }]
    });

    const passoX = 150;
    const numFuros = Math.floor((W - 2 * margemInterna) / passoX);
    for (let i = 0; i <= numFuros; i++) {
      const cx = margemInterna + i * ((W - 2 * margemInterna) / numFuros);
      camadas.push({ layer: 'FURACAO', tipo: 'circle', cx, cy: H / 2, r: raioCavilha });
      camadas.push({ layer: 'FURACAO', tipo: 'circle', cx, cy: yP2 + H / 2, r: raioCavilha });
    }

    camadas.push({
      layer: 'USINAGEM',
      tipo: 'polyline',
      fechada: true,
      pontos: [{ x: 30, y: 20 }, { x: W - 30, y: 20 }, { x: W - 30, y: H - 20 }, { x: 30, y: H - 20 }]
    });
    rebaixos3D.push({ tipo: 'rebaixo_retangular', x0: 30, y0: 20, x1: W - 30, y1: H - 20, prof: 9.5 });

    const furosPrateleira = [];
    for (let i = 0; i <= numFuros; i++) {
      const cx = margemInterna + i * ((W - 2 * margemInterna) / numFuros);
      furosPrateleira.push({ x: cx, y: H / 2, diametro: diamCavilha });
    }

    const prateleiraData = {
      kind: 'prateleira_dupla',
      largura: W,
      profundidade: H,
      espessura,
      outline: [
        [0, 0],
        [W, 0],
        [W, H],
        [0, H]
      ],
      furos: furosPrateleira,
      rebaixos: [{ x0: 30, y0: 20, x1: W - 30, y1: H - 20, profundidade: 9.5 }],
      segunda_peca_espelhada: true,
      quantidade_pecas: 2
    };

    return {
      produto: 'prateleira_dupla',
      prateleiraData,
      largura: W_total,
      altura: H_total,
      espessura,
      camadas,
      buracos3D: [],
      rebaixos3D,
      relatorio: {
        areaTotalM2: ((W_total * H_total) / 1000000).toFixed(3),
        perimetroCorteMetros: (4 * (W + H) / 1000).toFixed(2),
        totalFuros: (numFuros + 1) * 2,
        tempoEstimadoMinutos: 4
      }
    };
  },

  // =========================================================================
  // 4. MUXARABI ENCAIXADO COM MEIA-MADEIRA E DOG-BONES
  // =========================================================================
  calcularMuxarabiEncaixado(params) {
    const W = parseFloat(params.comprimento_total || params.largura) || 1000;
    const H = parseFloat(params.altura_total || params.altura) || 800;
    const larguraRipaH = parseFloat(params.largura_ripa_h || params.larguraRipaH) || 40;
    const larguraRipaV = parseFloat(params.largura_ripa_v || params.larguraRipaV) || 40;
    const espessura = parseFloat(params.espessura_material || params.espessura) || 18;
    const folga = parseFloat(params.folga_encaixe || params.folga) || 0.3;
    const diamFresa = parseFloat(params.diametro_fresa || params.diamFresa) || 6;
    const vaoX = parseFloat(params.vao_desejado_largura || params.vaoX) || 150;
    const vaoY = parseFloat(params.vao_desejado_altura || params.vaoY) || 150;

    const numH = Math.max(2, Math.floor(H / (larguraRipaH + vaoY)));
    const numV = Math.max(2, Math.floor(W / (larguraRipaV + vaoX)));

    const camadas = [];
    const ripas3D = [];
    const espacoNesting = 20;
    let yNesting = 0;
    const larguraEncaixe = espessura + folga;
    const profEncaixeH = larguraRipaH / 2;

    for (let i = 0; i < numH; i++) {
      const y0 = yNesting;
      const y1 = y0 + larguraRipaH;

      camadas.push({
        layer: 'CORTE',
        tipo: 'polyline',
        fechada: true,
        pontos: [{ x: 0, y: y0 }, { x: W, y: y0 }, { x: W, y: y1 }, { x: 0, y: y1 }]
      });

      for (let j = 0; j < numV; j++) {
        const xRasgo = (W / (numV + 1)) * (j + 1) - larguraEncaixe / 2;
        camadas.push({
          layer: 'CORTE',
          tipo: 'polyline',
          fechada: true,
          pontos: [
            { x: xRasgo, y: y0 },
            { x: xRasgo + larguraEncaixe, y: y0 },
            { x: xRasgo + larguraEncaixe, y: y0 + profEncaixeH },
            { x: xRasgo, y: y0 + profEncaixeH }
          ]
        });
        const rBone = diamFresa / 2;
        camadas.push({ layer: 'CORTE', tipo: 'circle', cx: xRasgo, cy: y0 + profEncaixeH, r: rBone });
        camadas.push({ layer: 'CORTE', tipo: 'circle', cx: xRasgo + larguraEncaixe, cy: y0 + profEncaixeH, r: rBone });
      }
      yNesting += larguraRipaH + espacoNesting;
    }

    for (let i = 0; i < numH; i++) {
      const yPos = (H / (numH + 1)) * (i + 1);
      ripas3D.push({
        tipo: 'ripa_h',
        x0: 0,
        x1: W,
        y0: yPos - espessura / 2,
        y1: yPos + espessura / 2,
        prof: larguraRipaH,
        esp: espessura
      });
    }
    for (let j = 0; j < numV; j++) {
      const xPos = (W / (numV + 1)) * (j + 1);
      ripas3D.push({
        tipo: 'ripa_v',
        x0: xPos - espessura / 2,
        x1: xPos + espessura / 2,
        y0: 0,
        y1: H,
        prof: larguraRipaV,
        esp: espessura
      });
    }

    const verticais = [];
    const horizontais = [];
    const rasgos_verticais = [];
    const rasgos_horizontais = [];

    for (let j = 0; j < numV; j++) {
      const xPos = (W / (numV + 1)) * (j + 1);
      verticais.push({ width: espessura, height: H, x0: xPos - espessura / 2 });
      rasgos_horizontais.push({ x0: xPos - espessura / 2, x1: xPos + espessura / 2 });
    }
    for (let i = 0; i < numH; i++) {
      const yPos = (H / (numH + 1)) * (i + 1);
      horizontais.push({ width: W, height: espessura, y0: yPos - espessura / 2 });
      rasgos_verticais.push({ y0: yPos - espessura / 2, y1: yPos + espessura / 2 });
    }

    const muxarabiData = {
      kind: 'muxarabi_encaixado',
      largura: W,
      altura: H,
      largura_ripa_v: larguraRipaV,
      largura_ripa_h: larguraRipaH,
      profundidade_rasgo_v: profEncaixeH,
      profundidade_rasgo_h: profEncaixeH,
      deslocamento_ripas_h: 0,
      rasgos_verticais,
      rasgos_horizontais,
      verticais,
      horizontais
    };

    return {
      produto: 'muxarabi_encaixado',
      largura: W,
      altura: H,
      espessura,
      larguraRipaH,
      larguraRipaV,
      numRipasH: numH,
      numRipasV: numV,
      muxarabiData,
      camadas,
      buracos3D: [],
      ripas3D,
      relatorio: {
        areaTotalM2: ((W * H) / 1000000).toFixed(3),
        perimetroCorteMetros: (numH * (2 * (W + larguraRipaH)) / 1000).toFixed(2),
        totalEncaixes: numH * numV,
        tempoEstimadoMinutos: 15
      }
    };
  },

  // =========================================================================
  // 5. MUXARABI USINADO (RETANGULAR & REDONDO)
  // =========================================================================
  calcularMuxarabi(params) {
    const W = parseFloat(params.painelMuxLargura || params.largura) || 800;
    const H = parseFloat(params.painelMuxAltura || params.altura) || 1200;
    const vaoDesejadoX = parseFloat(params.painelMuxVaoLargura || params.vaoX) || 60;
    const vaoDesejadoY = parseFloat(params.painelMuxVaoAltura || params.vaoY) || 60;
    const entreVaos = parseFloat(params.painelMuxEntreVaos || params.entreVaos) || 10;
    const margemBorda = parseFloat(params.painelMuxMargemBordas || params.margem) || 0;
    const modo = params.painelMuxDistribuicao || params.modo || 'dividido_igualmente';
    const numVaosXFixo = parseInt(params.painelMuxNumVaosX || params.numVaosX) || null;
    const numVaosYFixo = parseInt(params.painelMuxNumVaosY || params.numVaosY) || null;
    const espessura = parseFloat(params.espessura) || 15;

    let vaoRealX = vaoDesejadoX;
    let vaoRealY = vaoDesejadoY;
    let margemRealX = margemBorda;
    let margemRealY = margemBorda;
    let numX = 1;
    let numY = 1;
    const sugestoesX = [];
    const sugestoesY = [];

    if (modo === 'dividido_igualmente') {
      const W_util = Math.max(10, W - 2 * margemBorda);
      const Nx_ideal = Math.max(1, Math.round((W_util + entreVaos) / (vaoDesejadoX + entreVaos)));
      numX = numVaosXFixo ? numVaosXFixo : Nx_ideal;
      vaoRealX = (W_util - (numX - 1) * entreVaos) / numX;

      for (let n = Math.max(1, Nx_ideal - 2); n <= Nx_ideal + 3; n++) {
        const v = (W_util - (n - 1) * entreVaos) / n;
        if (v > 5) sugestoesX.push({ num: n, vao: parseFloat(v.toFixed(1)) });
      }
    } else {
      vaoRealX = vaoDesejadoX;
      const Nx_max = Math.max(1, Math.floor((W + entreVaos) / (vaoRealX + entreVaos)));
      numX = numVaosXFixo ? numVaosXFixo : Nx_max;
      const W_grade = numX * vaoRealX + (numX - 1) * entreVaos;
      margemRealX = Math.max(0, (W - W_grade) / 2);
      for (let n = Nx_max; n >= Math.max(1, Nx_max - 4); n--) {
        sugestoesX.push({ num: n, vao: vaoRealX, margem: parseFloat(((W - (n * vaoRealX + (n - 1) * entreVaos)) / 2).toFixed(1)) });
      }
    }

    if (modo === 'dividido_igualmente') {
      const H_util = Math.max(10, H - 2 * margemBorda);
      const Ny_ideal = Math.max(1, Math.round((H_util + entreVaos) / (vaoDesejadoY + entreVaos)));
      numY = numVaosYFixo ? numVaosYFixo : Ny_ideal;
      vaoRealY = (H_util - (numY - 1) * entreVaos) / numY;

      for (let n = Math.max(1, Ny_ideal - 2); n <= Ny_ideal + 3; n++) {
        const v = (H_util - (n - 1) * entreVaos) / n;
        if (v > 5) sugestoesY.push({ num: n, vao: parseFloat(v.toFixed(1)) });
      }
    } else {
      vaoRealY = vaoDesejadoY;
      const Ny_max = Math.max(1, Math.floor((H + entreVaos) / (vaoRealY + entreVaos)));
      numY = numVaosYFixo ? numVaosYFixo : Ny_max;
      const H_grade = numY * vaoRealY + (numY - 1) * entreVaos;
      margemRealY = Math.max(0, (H - H_grade) / 2);
      for (let n = Ny_max; n >= Math.max(1, Ny_max - 4); n--) {
        sugestoesY.push({ num: n, vao: vaoRealY, margem: parseFloat(((H - (n * vaoRealY + (n - 1) * entreVaos)) / 2).toFixed(1)) });
      }
    }

    const camadas = [];
    const buracos3D = [];

    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]
    });

    for (let ix = 0; ix < numX; ix++) {
      const x0 = margemRealX + ix * (vaoRealX + entreVaos);
      const x1 = x0 + vaoRealX;
      for (let iy = 0; iy < numY; iy++) {
        const y0 = margemRealY + iy * (vaoRealY + entreVaos);
        const y1 = y0 + vaoRealY;
        camadas.push({
          layer: 'CORTE',
          tipo: 'polyline',
          fechada: true,
          pontos: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
        });
        buracos3D.push({ tipo: 'retangulo', x0, y0, x1, y1 });
      }
    }

    const totalVãos = numX * numY;
    const perimetroCorteTotal = (2 * (W + H) + totalVãos * 2 * (vaoRealX + vaoRealY)) / 1000;
    const areaTotal = (W * H) / 1000000;
    const areaVazada = (totalVãos * vaoRealX * vaoRealY) / 1000000;

    const holesMux = buracos3D.map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }));
    const painelMuxarabiData = {
      kind: 'painel_muxarabi',
      largura: W,
      altura: H,
      espessura,
      holes: holesMux
    };

    return {
      produto: 'painel_muxarabi',
      painelMuxarabiData,
      largura: W,
      altura: H,
      espessura,
      numX,
      numY,
      totalVãos,
      vaoRealX: parseFloat(vaoRealX.toFixed(2)),
      vaoRealY: parseFloat(vaoRealY.toFixed(2)),
      margemRealX: parseFloat(margemRealX.toFixed(2)),
      margemRealY: parseFloat(margemRealY.toFixed(2)),
      sugestoesX,
      sugestoesY,
      camadas,
      buracos3D,
      relatorio: {
        areaTotalM2: areaTotal.toFixed(3),
        areaVazadaM2: areaVazada.toFixed(3),
        aproveitamentoPorcento: (((areaTotal - areaVazada) / areaTotal) * 100).toFixed(1),
        perimetroCorteMetros: perimetroCorteTotal.toFixed(2),
        totalFuros: totalVãos,
        tempoEstimadoMinutos: Math.ceil(perimetroCorteTotal / 4 + (totalVãos * 2) / 60)
      }
    };
  },

  calcularMuxarabiRedondo(params) {
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
  },

  // =========================================================================
  // 6. PAINÉIS (RIPADO CAVILHADO & PARAMÉTRICO WAVE)
  // =========================================================================
  calcularPainelRipado(params) {
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
  },

  calcularPainelParametrico(params) {
    const W = parseFloat(params.largura) || 1600;
    const H = parseFloat(params.altura) || 900;
    const profundidade = parseFloat(params.profundidade) || 200;
    const espLamina = parseFloat(params.espLamina) || 18;
    const espacamento = parseFloat(params.espacamento) || 30;
    const numLaminas = Math.floor(W / (espLamina + espacamento));

    const camadas = [];
    const laminas3D = [];

    for (let i = 0; i < numLaminas; i++) {
      const xPos = i * (espLamina + espacamento);
      const pontosLamina = [];
      const numSegmentos = 40;

      for (let s = 0; s <= numSegmentos; s++) {
        const y = (H / numSegmentos) * s;
        const zOnda = Math.sin((y / H) * Math.PI * 2 + (i / numLaminas) * Math.PI) * (profundidade / 2) + profundidade / 2;
        pontosLamina.push({ y, z: zOnda });
      }

      laminas3D.push({ idx: i, x: xPos, pontos: pontosLamina, esp: espLamina });

      const yNesting = i * (H + 40);
      camadas.push({
        layer: 'CORTE',
        tipo: 'polyline',
        fechada: true,
        pontos: [
          { x: 0, y: yNesting },
          { x: profundidade, y: yNesting },
          { x: profundidade, y: yNesting + H },
          { x: 0, y: yNesting + H }
        ]
      });

      camadas.push({ layer: 'FURACAO', tipo: 'circle', cx: profundidade / 2, cy: yNesting + 80, r: 6 });
      camadas.push({ layer: 'FURACAO', tipo: 'circle', cx: profundidade / 2, cy: yNesting + H - 80, r: 6 });
    }

    return {
      produto: 'painel_parametrico',
      largura: W,
      altura: H,
      profundidade,
      espessura: espLamina,
      numLaminas,
      camadas,
      buracos3D: [],
      laminas3D,
      relatorio: {
        areaTotalM2: ((W * H) / 1000000).toFixed(3),
        perimetroCorteMetros: (numLaminas * (2 * (H + profundidade)) / 1000).toFixed(2),
        totalLaminas: numLaminas,
        tempoEstimadoMinutos: 35
      }
    };
  },

  // =========================================================================
  // 7. PÉS ESPECIAIS (CÔNICO & OVAL)
  // =========================================================================
    calcularPeConico(params) {
    const subtype = params.produto || params.subtype || 'pe_conico';
    let diamBase = 550, diamTopo = 350, alt = 700, esp = 18;
    let larguraBase = 550, profundBase = 550, larguraTopo = 350, profundTopo = 350;
    let raioCanto = 40;

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
    } else if (subtype === 'pe_conico_quadrado') {
      larguraBase = parseFloat(params.pcq_larg_base) || parseFloat(params.largura) || 550;
      profundBase = parseFloat(params.pcq_prof_base) || parseFloat(params.profundidade) || 550;
      larguraTopo = parseFloat(params.pcq_larg_topo) || parseFloat(params.largura_topo) || 300;
      profundTopo = parseFloat(params.pcq_prof_topo) || parseFloat(params.profund_topo) || 300;
      raioCanto = parseFloat(params.pcq_raio_canto) || 150;
      alt = parseFloat(params.pcq_altura) || parseFloat(params.altura) || 700;
      esp = parseFloat(params.pcq_espessura_mdf) || parseFloat(params.espessura) || 18;
    } else if (subtype === 'pe_portico_u') {
      larguraBase = parseFloat(params.ppu_largura) || parseFloat(params.largura) || 700;
      profundBase = parseFloat(params.ppu_profundidade) || parseFloat(params.profundidade) || 300;
      alt = parseFloat(params.ppu_altura) || parseFloat(params.altura) || 730;
      esp = parseFloat(params.ppu_espessura_mdf) || parseFloat(params.espessura) || 18;
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

    // Para pe_oblongo: garantir que comprimento > profundidade
    let compOblongo = Math.max(larguraBase, profundBase);
    let profOblongo = Math.min(larguraBase, profundBase);
    if (compOblongo <= profOblongo) compOblongo = profOblongo + 50;
    const trechoRetoObl = compOblongo - profOblongo;
    const arcHalfObl = (Math.PI * (profOblongo / 2)) / 2;
    const perimOblongo = 2 * trechoRetoObl + Math.PI * profOblongo;

    // Para pe_conico_quadrado
    const rBaseSafe = Math.max(10, Math.min(raioCanto, larguraBase / 2 - 5, profundBase / 2 - 5));
    const rTopoSafe = Math.max(5, Math.min(raioCanto * (larguraTopo / larguraBase), larguraTopo / 2 - 5, profundTopo / 2 - 5));
    const ladoX_q = Math.max(1, larguraBase - 2 * rBaseSafe);
    const ladoY_q = Math.max(1, profundBase - 2 * rBaseSafe);
    const arco_q = (Math.PI / 2) * rBaseSafe;
    const seg_lens_q = [ladoX_q, arco_q, ladoY_q, arco_q, ladoX_q, arco_q, ladoY_q, arco_q];
    const perimQuadrado = 2 * ladoX_q + 2 * ladoY_q + 4 * arco_q;

    // Perímetro ativo para a casca
    let perimetroTotal = perimOblongo;
    if (subtype === 'pe_conico_quadrado') perimetroTotal = perimQuadrado;
    else if (subtype === 'pe_conico' || subtype === 'pe_redondo') perimetroTotal = Math.PI * larguraBase;

    // Setores com suporte a s_start/s_end (oblongo/quadrado) E theta_start/theta_end (cone)
    const sectors = [
      {
        theta_start: 0,
        theta_end: Math.PI,
        s_start: 0,
        s_end: perimetroTotal / 2,
        groove_thetas: [],
        vbit_thetas: [],
        groove_s: []
      },
      {
        theta_start: Math.PI,
        theta_end: Math.PI * 2,
        s_start: perimetroTotal / 2,
        s_end: perimetroTotal,
        groove_thetas: [],
        vbit_thetas: [],
        groove_s: []
      }
    ];

    const baseA = larguraBase / 2;
    const baseB = profundBase / 2;
    const topA = larguraTopo / 2;
    const topB = profundTopo / 2;
    const midA = (baseA + topA) / 2;
    const midB = (baseB + topB) / 2;

    // Aneis internos compatíveis com todos os renderizadores 3D
    function criarAnel(zPos, lBase, pBase, rB, label) {
      // Oblongo: outer_C > inner_C && outer_L > inner_L && inner_C > inner_L && inner_L > 0
      const oC = Math.max(30, compOblongo - 2 * esp);
      const oL = Math.max(15, profOblongo - 2 * esp);
      const iL = Math.max(5, oL * 0.6);
      const iC = iL + (oC - oL);

      return {
        z: zPos,
        // addRevestimentoCone
        outer_a: Math.max(10, lBase / 2 - esp),
        outer_b: Math.max(10, pBase / 2 - esp),
        inner_a: Math.max(5, lBase / 2 - esp - 45),
        inner_b: Math.max(5, pBase / 2 - esp - 45),
        // addPeOblongo
        outer_C: oC,
        outer_L: oL,
        inner_C: iC,
        inner_L: iL,
        // addPeConicoQuadrado
        outer_larg: Math.max(20, lBase - 2 * esp),
        outer_prof: Math.max(20, pBase - 2 * esp),
        inner_larg: Math.max(10, (lBase - 2 * esp) * 0.65),
        inner_prof: Math.max(10, (pBase - 2 * esp) * 0.65),
        outer_rx: Math.max(5, rB - esp),
        outer_ry: Math.max(5, rB - esp),
        inner_rx: Math.max(2, (rB - esp) * 0.65),
        inner_ry: Math.max(2, (rB - esp) * 0.65),
        label
      };
    }

    const rings = [
      criarAnel(0, larguraBase, profundBase, rBaseSafe, 'BASE INT.'),
      criarAnel(alt / 2, (larguraBase + larguraTopo) / 2, (profundBase + profundTopo) / 2, (rBaseSafe + rTopoSafe) / 2, 'MEIO INT.'),
      criarAnel(alt - esp, larguraTopo, profundTopo, rTopoSafe, 'TOPO INT.')
    ];

    const peData = {
      kind: subtype || 'pe_conico',
      largura: larguraBase,
      profundidade: profundBase,
      altura: alt,
      espessura_mdf: esp,
      largura_base: larguraBase,
      profund_base: profundBase,
      largura_topo: larguraTopo,
      profund_topo: profundTopo,
      a: larguraBase / 2,
      b: profundBase / 2,
      comprimento: compOblongo,
      trecho_reto: trechoRetoObl,
      arc_half: arcHalfObl,
      perimetro: perimetroTotal,
      seg_lens: seg_lens_q,
      nucleo_x: Math.max(10, larguraBase / 2 - rBaseSafe),
      nucleo_y: Math.max(10, profundBase / 2 - rBaseSafe),
      nucleo_topo_x: Math.max(5, larguraTopo / 2 - rTopoSafe),
      nucleo_topo_y: Math.max(5, profundTopo / 2 - rTopoSafe),
      raio_base: rBaseSafe,
      raio_topo_x: rTopoSafe,
      raio_topo_y: rTopoSafe,
      diametro_fresa_preview: 6,
      profundidade_fresagem_preview: 12,
      resolucao: 120,
      pecas_3d: [
        {
          contorno: [
            [0, 0], [larguraBase, 0], [larguraBase, alt],
            [larguraBase - 80, alt], [larguraBase - 80, 80],
            [80, 80], [80, alt], [0, alt], [0, 0]
          ],
          buracos: []
        }
      ],
      sectors,
      rings
    };

    const camadas = [];
    const gap = 30.0;

    // Anéis 2D para corte DXF
    const cx1 = baseA, cy1 = baseB;
    camadas.push({ layer: 'CORTE', tipo: 'circle', cx: cx1, cy: cy1, r: baseA });
    camadas.push({ layer: 'CORTE', tipo: 'circle', cx: cx1, cy: cy1, r: Math.max(10, baseA - 45) });

    const cx2 = cx1 + baseA + midA + gap, cy2 = baseB;
    camadas.push({ layer: 'CORTE', tipo: 'circle', cx: cx2, cy: cy2, r: midA });
    camadas.push({ layer: 'CORTE', tipo: 'circle', cx: cx2, cy: cy2, r: Math.max(10, midA - 45) });

    const cx3 = cx2 + midA + topA + gap, cy3 = baseB;
    camadas.push({ layer: 'CORTE', tipo: 'circle', cx: cx3, cy: cy3, r: topA });
    camadas.push({ layer: 'CORTE', tipo: 'circle', cx: cx3, cy: cy3, r: Math.max(10, topA - 45) });

    // Casca desenvolvida 2D
    const cascaY = baseB * 2 + gap * 2;
    const largDev = (Math.PI * (larguraBase + larguraTopo)) / 4.0;
    for (let k = 0; k < 2; k++) {
      const kx = k * (largDev + gap);
      camadas.push({
        layer: 'CORTE',
        tipo: 'polyline',
        fechada: true,
        pontos: [
          { x: kx, y: cascaY },
          { x: kx + largDev, y: cascaY },
          { x: kx + (largDev * 0.7), y: cascaY + alt },
          { x: kx + (largDev * 0.3), y: cascaY + alt }
        ]
      });
      const numCanais = 12;
      for (let c = 1; c < numCanais; c++) {
        const t = c / numCanais;
        camadas.push({
          layer: 'FRESAGEM_DOBRA',
          tipo: 'line',
          x1: kx + largDev * t,
          y1: cascaY,
          x2: kx + (largDev * 0.3) + (largDev * 0.4) * t,
          y2: cascaY + alt
        });
      }
    }

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
  },

  calcularPeOval(params) {
    const compBase = parseFloat(params.compBase) || 700;
    const largBase = parseFloat(params.largBase) || 450;
    const alturaPe = parseFloat(params.altura) || 720;
    const numRipas = parseInt(params.numRipas) || 24;
    const espessura = parseFloat(params.espessura) || 18;

    const camadas = [];
    const ripas3D = [];

    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: [{ x: 0, y: 0 }, { x: compBase, y: 0 }, { x: compBase, y: largBase }, { x: 0, y: largBase }]
    });

    for (let i = 0; i < numRipas; i++) {
      const ang = (i / numRipas) * Math.PI * 2;
      ripas3D.push({
        angulo: ang,
        a: compBase / 2,
        b: largBase / 2,
        alt: alturaPe,
        esp: espessura
      });
    }

    return {
      produto: 'pe_oval',
      largura: compBase,
      largBase,
      altura: alturaPe,
      espessura,
      camadas,
      buracos3D: [],
      pes3D: ripas3D,
      relatorio: {
        areaTotalM2: 1.45,
        perimetroCorteMetros: (numRipas * 2.4).toFixed(2),
        totalPecas: numRipas + 2,
        tempoEstimadoMinutos: 28
      }
    };
  },

  // =========================================================================
  // 8. PEÇAS PERSONALIZADAS (TAMPOS ORGÂNICOS)
  // =========================================================================
  calcularTampoOrganico(params) {
    const W = parseFloat(params.largura) || 1200;
    const H = parseFloat(params.altura) || 800;
    const espessura = parseFloat(params.espessura) || 25;

    const pontosOrganicos = [];
    const numPontos = 64;
    const cx = W / 2;
    const cy = H / 2;

    for (let i = 0; i < numPontos; i++) {
      const theta = (i / numPontos) * Math.PI * 2;
      const rVar = (Math.min(W, H) / 2) * (0.8 + 0.2 * Math.sin(theta * 2) + 0.1 * Math.cos(theta * 3));
      pontosOrganicos.push({
        x: cx + Math.cos(theta) * rVar * (W / H),
        y: cy + Math.sin(theta) * rVar
      });
    }

    const camadas = [
      { layer: 'CORTE', tipo: 'polyline', fechada: true, pontos: pontosOrganicos }
    ];

    return {
      produto: 'tampo_organico',
      largura: W,
      altura: H,
      espessura,
      camadas,
      buracos3D: [],
      pontosOrganicos,
      relatorio: {
        areaTotalM2: ((W * H * 0.75) / 1000000).toFixed(3),
        perimetroCorteMetros: ((Math.PI * (W + H) / 2) / 1000).toFixed(2),
        tempoEstimadoMinutos: 8
      }
    };
  },
  calcularRipado(params) {
    return this.calcularPainelRipado(params);
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AlgoritmosCNC };
}
if (typeof window !== 'undefined') {
  window.AlgoritmosCNC = AlgoritmosCNC;
}
