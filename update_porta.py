with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    code = f.read()

new_porta = '''  calcularPortaCava(params) {
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
  }'''

pos_start = code.find('calcularPortaCava(params) {')
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

print(f'Replacing calcularPortaCava from {pos_start} to {pos_end}')
code = code[:pos_start] + new_porta + code[pos_end:]

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated calcularPortaCava successfully!')
