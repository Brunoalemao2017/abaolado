with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Full nesting for calcularCurvoSimples
old_simples_camadas = """    const camadas = [
      { layer: 'CORTE', tipo: 'polyline', fechada: true, pontos: top_outline.map(p => ({ x: p[0], y: p[1] })) },
      { layer: 'CORTE', tipo: 'polyline', fechada: true, pontos: top_outline.map(p => ({ x: p[0], y: p[1] + D + 25 })) }
    ];"""

new_simples_camadas = """    const camadas = [];
    const gap = 25.0;

    // 1. Tampo Superior (X=0, Y=0)
    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: top_outline.map(p => ({ x: p[0], y: p[1] }))
    });

    // 2. Base Inferior (X=0, Y = D + gap)
    const offset_base_y = D + gap;
    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: top_outline.map(p => ({ x: p[0], y: p[1] + offset_base_y }))
    });

    // 3. 4 Costelas Curvas de Reforço (Coluna X = W + gap)
    const costela_x = W + gap;
    const costela_h = 135.0;
    if (gerarReforco) {
      for (let k = 0; k < 4; k++) {
        const offset_costela_y = k * (costela_h + gap);
        camadas.push({
          layer: 'CORTE',
          tipo: 'polyline',
          fechada: true,
          pontos: reforco_outline.map(p => ({ x: p[0] + costela_x, y: p[1] + offset_costela_y }))
        });
      }
    }

    // 4. As 3 Ripas Verticais Estruturais (Altura H com encaixes usinados)
    const ripa_col_x = costela_x + R + 70.0;
    const ripa_largura = 70.0;
    ripas.forEach((r, idx) => {
      const rx0 = ripa_col_x + idx * (ripa_largura + gap);
      camadas.push({
        layer: 'CORTE',
        tipo: 'polyline',
        fechada: true,
        pontos: [
          { x: rx0, y: 0.0 },
          { x: rx0 + ripa_largura, y: 0.0 },
          { x: rx0 + ripa_largura, y: H },
          { x: rx0, y: H }
        ]
      });
      // Rasgos de encaixe (USINAGEM em verde) onde as 4 costelas e as 2 tampas encaixam
      const z_niveis = [0.0, (H - T) * 0.25, (H - T) * 0.45, (H - T) * 0.65, (H - T) * 0.85, H - T];
      z_niveis.forEach(z => {
        camadas.push({
          layer: 'USINAGEM',
          tipo: 'polyline',
          fechada: true,
          pontos: [
            { x: rx0 + 10.0, y: z },
            { x: rx0 + 10.0 + 35.0, y: z },
            { x: rx0 + 10.0 + 35.0, y: z + T },
            { x: rx0 + 10.0, y: z + T }
          ]
        });
      });
    });

    // 5. Casca Curvada Desenvolvida (Painel Flexível) com canais de fresagem de dobra
    const aba_frontal = W - R;
    const aba_lateral = Math.max(0.0, D - R);
    const arco_desenvolvido = (Math.PI * R) / 2.0;
    const comp_total_casca = aba_frontal + arco_desenvolvido + aba_lateral;

    const casca_x = ripa_col_x + ripas.length * (ripa_largura + gap) + gap;
    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: [
        { x: casca_x, y: 0.0 },
        { x: casca_x + comp_total_casca, y: 0.0 },
        { x: casca_x + comp_total_casca, y: H },
        { x: casca_x, y: H }
      ]
    });

    // Canais de fresagem de dobra (FRESAGEM_DOBRA em amarelo) na zona da curva
    const inicio_curva_x = casca_x + aba_frontal;
    const fim_curva_x = inicio_curva_x + arco_desenvolvido;
    const passo_dobra = 8.0;
    const num_fresagens = Math.floor(arco_desenvolvido / passo_dobra);
    for (let i = 1; i <= num_fresagens; i++) {
      const fx = inicio_curva_x + i * passo_dobra;
      if (fx < fim_curva_x) {
        camadas.push({
          layer: 'FRESAGEM_DOBRA',
          tipo: 'line',
          x1: fx,
          y1: 0.0,
          x2: fx,
          y2: H
        });
      }
    }"""

if old_simples_camadas in code:
    code = code.replace(old_simples_camadas, new_simples_camadas)
    print("Replaced simples camadas with complete nesting!")
else:
    print("old_simples_camadas not found directly")

# 2. Full nesting for calcularCurvoDuplo
old_duplo_camadas = """    const camadas = [
      { layer: 'CORTE', tipo: 'polyline', fechada: true, pontos: top_outline.map(p => ({ x: p[0], y: p[1] })) },
      { layer: 'CORTE', tipo: 'polyline', fechada: true, pontos: top_outline.map(p => ({ x: p[0], y: p[1] + D + 25 })) }
    ];"""

new_duplo_camadas = """    const camadas = [];
    const gap = 25.0;

    // 1. Tampo Superior (X=0, Y=0)
    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: top_outline.map(p => ({ x: p[0], y: p[1] }))
    });

    // 2. Base Inferior (X=0, Y = D + gap)
    const offset_base_y = D + gap;
    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: top_outline.map(p => ({ x: p[0], y: p[1] + offset_base_y }))
    });

    // 3. 8 Costelas Curvas de Reforço (4 para cada canto curvo)
    const costela_x = W + gap;
    const costela_h = 135.0;
    if (gerarReforco) {
      for (let k = 0; k < 4; k++) {
        const offset_k_y = k * (costela_h + gap);
        // Costela Canto 1
        camadas.push({
          layer: 'CORTE',
          tipo: 'polyline',
          fechada: true,
          pontos: costela1.map(p => ({ x: p[0] + costela_x, y: p[1] + offset_k_y }))
        });
        // Costela Canto 2
        camadas.push({
          layer: 'CORTE',
          tipo: 'polyline',
          fechada: true,
          pontos: costela2.map(p => ({ x: p[0] + costela_x + R + 35.0, y: p[1] + offset_k_y }))
        });
      }
    }

    // 4. As 2 Ripas Verticais Traseiras (Altura H com encaixes usinados)
    const ripa_col_x = costela_x + (R + 35.0) * 2 + gap;
    const ripa_largura = 70.0;
    ripas.forEach((r, idx) => {
      const rx0 = ripa_col_x + idx * (ripa_largura + gap);
      camadas.push({
        layer: 'CORTE',
        tipo: 'polyline',
        fechada: true,
        pontos: [
          { x: rx0, y: 0.0 },
          { x: rx0 + ripa_largura, y: 0.0 },
          { x: rx0 + ripa_largura, y: H },
          { x: rx0, y: H }
        ]
      });
      const z_niveis = [0.0, (H - T) * 0.25, (H - T) * 0.45, (H - T) * 0.65, (H - T) * 0.85, H - T];
      z_niveis.forEach(z => {
        camadas.push({
          layer: 'USINAGEM',
          tipo: 'polyline',
          fechada: true,
          pontos: [
            { x: rx0 + 10.0, y: z },
            { x: rx0 + 10.0 + 35.0, y: z },
            { x: rx0 + 10.0 + 35.0, y: z + T },
            { x: rx0 + 10.0, y: z + T }
          ]
        });
      });
    });

    // 5. Casca Curvada Desenvolvida Dupla com 2 zonas de fresagem de dobra
    const aba_reto1 = W - R;
    const trecho_lat = Math.max(0.0, D - 2 * R);
    const arco_curva = (Math.PI * R) / 2.0;
    const aba_reto2 = W - R;
    const comp_total_casca_duplo = aba_reto1 + arco_curva + trecho_lat + arco_curva + aba_reto2;

    const casca_x = ripa_col_x + ripas.length * (ripa_largura + gap) + gap;
    camadas.push({
      layer: 'CORTE',
      tipo: 'polyline',
      fechada: true,
      pontos: [
        { x: casca_x, y: 0.0 },
        { x: casca_x + comp_total_casca_duplo, y: 0.0 },
        { x: casca_x + comp_total_casca_duplo, y: H },
        { x: casca_x, y: H }
      ]
    });

    // Zona 1 de Dobra
    const z1_inicio = casca_x + aba_reto1;
    const z1_fim = z1_inicio + arco_curva;
    const passo = 8.0;
    for (let fx = z1_inicio + passo; fx < z1_fim; fx += passo) {
      camadas.push({ layer: 'FRESAGEM_DOBRA', tipo: 'line', x1: fx, y1: 0.0, x2: fx, y2: H });
    }
    // Zona 2 de Dobra
    const z2_inicio = z1_fim + trecho_lat;
    const z2_fim = z2_inicio + arco_curva;
    for (let fx = z2_inicio + passo; fx < z2_fim; fx += passo) {
      camadas.push({ layer: 'FRESAGEM_DOBRA', tipo: 'line', x1: fx, y1: 0.0, x2: fx, y2: H });
    }"""

if old_duplo_camadas in code:
    code = code.replace(old_duplo_camadas, new_duplo_camadas)
    print("Replaced duplo camadas with complete nesting!")
else:
    print("old_duplo_camadas not found directly")

# 3. Full nesting for calcularPeConico
old_pe_camadas = """    const camadas = [
      { layer: 'CORTE', tipo: 'circle', cx: baseA, cy: baseB, r: topA },
      { layer: 'CORTE', tipo: 'circle', cx: baseA, cy: baseB, r: baseA }
    ];"""

new_pe_camadas = """    const camadas = [];
    const gap = 30.0;

    // 1. Anel da Base (MDF estrutural)
    const cx1 = baseA, cy1 = baseB;
    camadas.push({ layer: 'CORTE', tipo: 'circle', cx: cx1, cy: cy1, r: baseA });
    camadas.push({ layer: 'CORTE', tipo: 'circle', cx: cx1, cy: cy1, r: Math.max(10, baseA - 45) });

    // 2. Anel Intermediário
    const cx2 = cx1 + baseA + midA + gap, cy2 = baseB;
    camadas.push({ layer: 'CORTE', tipo: 'circle', cx: cx2, cy: cy2, r: midA });
    camadas.push({ layer: 'CORTE', tipo: 'circle', cx: cx2, cy: cy2, r: Math.max(10, midA - 45) });

    // 3. Anel do Topo
    const cx3 = cx2 + midA + topA + gap, cy3 = baseB;
    camadas.push({ layer: 'CORTE', tipo: 'circle', cx: cx3, cy: cy3, r: topA });
    camadas.push({ layer: 'CORTE', tipo: 'circle', cx: cx3, cy: cy3, r: Math.max(10, topA - 45) });

    // 4. Casca desenvolvida do cone (2 metades com linhas de dobra FRESAGEM_DOBRA)
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
      // Linhas de fresagem de dobra verticais/radiais
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
    }"""

if old_pe_camadas in code:
    code = code.replace(old_pe_camadas, new_pe_camadas)
    print("Replaced pe camadas with complete nesting!")
else:
    print("old_pe_camadas not found directly")

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("algorithms.js updated with complete CNC nesting!")
