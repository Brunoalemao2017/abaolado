with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('calcularCurvoDuplo(')
idx_camadas = text.find('const camadas = [];', idx)
idx_return = text.find('return {', idx_camadas)

new_duplo_camadas = """const camadas = [];
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
    }

    """

text = text[:idx_camadas] + new_duplo_camadas + text[idx_return:]

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("Fixed duplo camadas nesting successfully!")
