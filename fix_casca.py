with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace curvoSimplesData definition in calcularCurvoSimples
old_part = """    const curvoSimplesData = {
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
    };"""

new_part = """    const curvoSimplesData = {
      kind: 'curvo_simples',
      altura: H,
      espessura_mdf: T,
      espessura_flex: T,
      largura: W,
      profundidade: D,
      raio_nominal: R,
      raio_max_permitido: raioMaxPermitido,
      estrutura_z: [0.0, zMeio, H - T],
      estrutura_kind: ['bottom', 'shelf', 'top'],
      reforco_z: [],
      reforco_ativo: false,
      reforco_auto_desativado: false,
      top_outline,
      front_path,
      front_flex_start_idx,
      front_flex_end_idx,
      reforco_outline: [],
      reforco_outlines: [],
      ripas
    };"""

if old_part in code:
    code = code.replace(old_part, new_part, 1)
    print("Replaced curvoSimplesData in calcularCurvoSimples successfully!")
else:
    print("Could not find exact old_part in code!")

# Also check calcularCurvoDuplo
old_duplo_part = """    const curvoSimplesData = {
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
    };"""

new_duplo_part = """    const curvoSimplesData = {
      kind: 'curvo_duplo',
      altura: H,
      espessura_mdf: T,
      espessura_flex: T,
      largura: W,
      profundidade: D,
      raio_nominal: R,
      raio_max_permitido: raioMaxPermitido,
      estrutura_z: [0.0, zMeio, H - T],
      estrutura_kind: ['bottom', 'shelf', 'top'],
      reforco_z: [],
      reforco_ativo: false,
      reforco_auto_desativado: false,
      top_outline,
      front_path,
      front_flex_start_idx: 1,
      front_flex_end_idx: front_path.length - 2,
      reforco_outline: [],
      reforco_outlines: [],
      ripas
    };"""

if old_duplo_part in code:
    code = code.replace(old_duplo_part, new_duplo_part, 1)
    print("Replaced curvoSimplesData in calcularCurvoDuplo successfully!")
else:
    print("Could not find exact old_duplo_part in code!")

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\public\js\algorithms.js', 'w', encoding='utf-8') as f:
    f.write(code)
