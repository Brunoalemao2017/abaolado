with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'r', encoding='utf-8') as f:
    code = f.read()

new_routes = '''// ----------------------------------------------------
// ROTAS 3D WEBGL UNIVERSAIS - RESPOSTA LOCAL INSTANTÂNEA
// ----------------------------------------------------

// Canto Curvo (Simples, Duplo, Parafusado)
app.post('/api/curvos/montado3d', (req, res) => {
  const body = req.body || {};
  if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
  const tipo = body.tipo_curvo || body.produto || 'simples';
  let calculo;
  if (tipo === 'duplo_vertical' || tipo === 'curvo_duplo_180') {
    calculo = AlgoritmosCNC.calcularCurvoDuplo(body);
  } else if (tipo === 'simples_v3' || tipo === 'duplo_parafusado') {
    calculo = AlgoritmosCNC.calcularCurvoParafusado(body);
  } else {
    calculo = AlgoritmosCNC.calcularCurvoSimples(body);
  }
  res.json(calculo.curvoSimplesData);
});

// Portas (Cava Quadrada, Longa, Redonda, Sem Puxador)
app.post('/api/portas/montado3d', (req, res) => {
  const body = req.body || {};
  if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
  const calculo = AlgoritmosCNC.calcularPortaCava(body);
  res.json(calculo.portaData || { kind: 'porta_cava_quadrada', largura: body.largura, altura: body.altura });
});

// Prateleiras Duplas
app.post('/api/prateleiras/montado3d', (req, res) => {
  const body = req.body || {};
  if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
  const calculo = AlgoritmosCNC.calcularPrateleiraDupla(body);
  res.json(calculo.prateleiraData || { kind: 'prateleira_dupla', largura: body.largura, profundidade: body.profundidade });
});

// Muxarabi Encaixado
app.post('/api/muxarabi-encaixado/montado3d', (req, res) => {
  const body = req.body || {};
  if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
  const calculo = AlgoritmosCNC.calcularMuxarabiEncaixado(body);
  res.json(calculo.muxarabiData || { kind: 'muxarabi_encaixado', largura: body.largura, altura: body.altura });
});

// Painel Muxarabi Usinado
app.post('/api/painel-muxarabi/montado3d', (req, res) => {
  const body = req.body || {};
  if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
  const calculo = AlgoritmosCNC.calcularMuxarabi(body);
  res.json(calculo.painelMuxarabiData || { kind: 'painel_muxarabi', largura: body.largura, altura: body.altura });
});

// Painel Ripado Cavilhado
app.post('/api/painel-ripado/montado3d', (req, res) => {
  const body = req.body || {};
  if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
  const calculo = AlgoritmosCNC.calcularRipado(body);
  res.json(calculo.ripadoData || { kind: 'painel_ripado_cavilhado', largura: body.largura, altura: body.altura });
});

// Pés Especiais (Conico, Redondo, Oval, Oblongo, Portico, Revestimento Cone)
const rotasPes = [
  'pe-conico', 'pe-redondo', 'pe-redondo-estruturado', 'pe-oval', 'pe-oblongo',
  'pe-conico-quadrado', 'pe-ripado-arredondado-redondo', 'pe-ripado-arredondado-oval',
  'pe-portico-u', 'revestimento-cone'
];
rotasPes.forEach(nome => {
  app.post(`/api/${nome}/montado3d`, (req, res) => {
    const body = req.body || {};
    if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
    const tipo = nome.replace(/-/g, '_');
    body.produto = tipo;
    const calculo = AlgoritmosCNC.calcularPeConico ? AlgoritmosCNC.calcularPeConico(body) : {};
    res.json(calculo.peData || {
      kind: tipo,
      largura_base: 550, profund_base: 550,
      largura_topo: 350, profund_topo: 350,
      altura: 700, espessura_mdf: 18,
      sectors: [{ theta_start: 0, theta_end: Math.PI }, { theta_start: Math.PI, theta_end: Math.PI * 2 }]
    });
  });
});'''

pos_start = code.find('app.post(\'/api/curvos/montado3d\'')
pos_end = code.find('// Presets Oficiais')

print(f'Replacing server.js routes from {pos_start} to {pos_end}')
code = code[:pos_start] + new_routes + '\n\n' + code[pos_end:]

with open(r'C:\Users\bruno\.gemini\antigravity\scratch\central-dxf-pro\server.js', 'w', encoding='utf-8') as f:
    f.write(code)

print('Updated server.js successfully!')
