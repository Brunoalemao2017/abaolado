with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update calcularPortaCava to include portaData
old_porta_return = """    return {
      produto: `porta_cava_${tipoCava}`,
      largura: W,
      altura: H,
      espessura,
      camadas,
      buracos3D: [],
      rebaixos3D,
      relatorio: {
        areaTotalM2: ((W * H) / 1000000).toFixed(3),
        perimetroCorteMetros: (2 * (W + H) / 1000).toFixed(2),
        totalDobradicas: dobradicas,
        tempoEstimadoMinutos: 3
      }
    };"""

new_porta_return = """    const recuoBordo = 21.5;
    const yDob1 = 100;
    const yDob2 = H - 100;
    const furos_dobradica = [
      { x: recuoBordo, y: yDob1, diametro: 35 },
      { x: recuoBordo, y: yDob2, diametro: 35 }
    ];
    if (dobradicas > 2) {
      furos_dobradica.push({ x: recuoBordo, y: H / 2, diametro: 35 });
    }

    let kindPorta = 'porta_puxador_cava_quadrado';
    let cavaObj = null;

    if (tipoCava === 'redonda') {
      kindPorta = 'porta_cava_redonda';
      const cx = (params.puxador_lado && params.puxador_lado.includes('esquerda')) ? 40 : (W - 40);
      const cy = (params.puxador_lado && params.puxador_lado.includes('centralizado')) ? (H / 2) : (H - 60);
      cavaObj = {
        centro: { x: cx, y: cy },
        raio_inner: 20,
        raio_outer: 35,
        profundidade_rebaixo: profCava,
        vbit: { profundidade: profCava, largura_chanfro: 5 }
      };
    } else if (tipoCava === 'longa') {
      kindPorta = 'porta_cava_longa';
      cavaObj = {
        outer: { x0: 0, y0: H - alturaCava, x1: W, y1: H },
        inner: { x0: 0, y0: H - alturaCava + 10, x1: W, y1: H },
        profundidade_rebaixo: profCava,
        vbit: { profundidade: profCava, largura_chanfro: 5 }
      };
    } else if (tipoCava === 'sem_puxador') {
      kindPorta = 'porta_sem_puxador';
    } else {
      kindPorta = 'porta_cava_quadrada';
      const x0 = (params.puxador_lado && params.puxador_lado.includes('esquerda')) ? 20 : (W - larguraCava - 20);
      const y0 = H - alturaCava;
      cavaObj = {
        outer: { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(W, x0 + larguraCava), y1: H },
        inner: { x0: Math.max(0, x0 + 10), y0: Math.max(0, y0 + 10), x1: Math.min(W, x0 + larguraCava - 10), y1: H },
        profundidade_rebaixo: profCava,
        vbit: { profundidade: profCava, largura_chanfro: 5 }
      };
    }

    const portaData = {
      kind: kindPorta,
      largura: W,
      altura: H,
      espessura_material: espessura,
      cava: cavaObj,
      furos_dobradica
    };

    return {
      produto: `porta_cava_${tipoCava}`,
      largura: W,
      altura: H,
      espessura,
      portaData,
      camadas,
      buracos3D: [],
      rebaixos3D,
      relatorio: {
        areaTotalM2: ((W * H) / 1000000).toFixed(3),
        perimetroCorteMetros: (2 * (W + H) / 1000).toFixed(2),
        totalDobradicas: dobradicas,
        tempoEstimadoMinutos: 3
      }
    };"""

if old_porta_return in code:
    code = code.replace(old_porta_return, new_porta_return)
    print("calcularPortaCava successfully updated with portaData!")
else:
    print("Warning: old_porta_return pattern not found exactly")

# 2. Update calcularMuxarabiEncaixado to include muxarabiData
old_mux_return = """    return {
      produto: 'muxarabi_encaixado',
      largura: W,
      altura: H,
      espessura,
      larguraRipaH,
      larguraRipaV,
      numRipasH: numH,
      numRipasV: numV,
      camadas,
      buracos3D: [],
      ripas3D,
      relatorio: {
        areaTotalM2: ((W * H) / 1000000).toFixed(3),
        perimetroCorteMetros: (numH * (2 * (W + larguraRipaH)) / 1000).toFixed(2),
        totalEncaixes: numH * numV,
        tempoEstimadoMinutos: 15
      }
    };"""

new_mux_return = """    const verticais = [];
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
    };"""

if old_mux_return in code:
    code = code.replace(old_mux_return, new_mux_return)
    print("calcularMuxarabiEncaixado successfully updated with muxarabiData!")
else:
    print("Warning: old_mux_return pattern not found exactly")

# 3. Add alias calcularRipado
if 'calcularRipado(' not in code:
    idx = code.rfind('};')
    code = code[:idx] + """  calcularRipado(params) {
    return this.calcularPainelRipado(params);
  },\n""" + code[idx:]
    print("Added calcularRipado alias to AlgoritmosCNC!")

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'w', encoding='utf-8') as f:
    f.write(code)
print("Saved algorithms.js successfully!")
