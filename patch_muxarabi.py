# Patch script for Muxarabi
import sys

# 1. Update public/js/algorithms.js
with open('public/js/algorithms.js', 'r', encoding='utf-8') as f:
    algo_content = f.read()

# In calcularMuxarabiEncaixado: accept form fields
target_enc_params = '''    const W = parseFloat(params.largura) || 1000;
    const H = parseFloat(params.altura) || 800;
    const larguraRipaH = parseFloat(params.larguraRipaH) || 40;
    const larguraRipaV = parseFloat(params.larguraRipaV) || 40;
    const espessura = parseFloat(params.espessura) || 18;
    const folga = parseFloat(params.folga) || 0.3;
    const diamFresa = parseFloat(params.diamFresa) || 6;
    const vaoX = parseFloat(params.vaoX) || 150;
    const vaoY = parseFloat(params.vaoY) || 150;'''

new_enc_params = '''    const W = parseFloat(params.comprimento_total || params.largura) || 1000;
    const H = parseFloat(params.altura_total || params.altura) || 800;
    const larguraRipaH = parseFloat(params.largura_ripa_h || params.larguraRipaH) || 40;
    const larguraRipaV = parseFloat(params.largura_ripa_v || params.larguraRipaV) || 40;
    const espessura = parseFloat(params.espessura_material || params.espessura) || 18;
    const folga = parseFloat(params.folga_encaixe || params.folga) || 0.3;
    const diamFresa = parseFloat(params.diametro_fresa || params.diamFresa) || 6;
    const vaoX = parseFloat(params.vao_desejado_largura || params.vaoX) || 150;
    const vaoY = parseFloat(params.vao_desejado_altura || params.vaoY) || 150;'''

assert target_enc_params in algo_content, 'target_enc_params not found'
algo_content = algo_content.replace(target_enc_params, new_enc_params, 1)

# In calcularMuxarabi: accept form fields & add painelMuxarabiData
target_mux_params = '''    const W = parseFloat(params.largura) || 800;
    const H = parseFloat(params.altura) || 1200;
    const vaoDesejadoX = parseFloat(params.vaoX) || 60;
    const vaoDesejadoY = parseFloat(params.vaoY) || 60;
    const entreVaos = parseFloat(params.entreVaos) || 10;
    const margemBorda = parseFloat(params.margem) || 0;
    const modo = params.modo || 'dividido_igualmente';
    const numVaosXFixo = parseInt(params.numVaosX) || null;
    const numVaosYFixo = parseInt(params.numVaosY) || null;
    const espessura = parseFloat(params.espessura) || 15;'''

new_mux_params = '''    const W = parseFloat(params.painelMuxLargura || params.largura) || 800;
    const H = parseFloat(params.painelMuxAltura || params.altura) || 1200;
    const vaoDesejadoX = parseFloat(params.painelMuxVaoLargura || params.vaoX) || 60;
    const vaoDesejadoY = parseFloat(params.painelMuxVaoAltura || params.vaoY) || 60;
    const entreVaos = parseFloat(params.painelMuxEntreVaos || params.entreVaos) || 10;
    const margemBorda = parseFloat(params.painelMuxMargemBordas || params.margem) || 0;
    const modo = params.painelMuxDistribuicao || params.modo || 'dividido_igualmente';
    const numVaosXFixo = parseInt(params.painelMuxNumVaosX || params.numVaosX) || null;
    const numVaosYFixo = parseInt(params.painelMuxNumVaosY || params.numVaosY) || null;
    const espessura = parseFloat(params.espessura) || 15;'''

assert target_mux_params in algo_content, 'target_mux_params not found'
algo_content = algo_content.replace(target_mux_params, new_mux_params, 1)

# In calcularMuxarabi return: add painelMuxarabiData
target_mux_ret = '''    return {
      produto: 'painel_muxarabi',
      largura: W,
      altura: H,'''

new_mux_ret = '''    const holesMux = buracos3D.map(b => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }));
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
      altura: H,'''

assert target_mux_ret in algo_content, 'target_mux_ret not found'
algo_content = algo_content.replace(target_mux_ret, new_mux_ret, 1)

# In calcularMuxarabiRedondo: accept form fields & add painelMuxarabiData
target_red_params = '''    const W = parseFloat(params.largura) || 800;
    const H = parseFloat(params.altura) || 1200;
    const diametro = parseFloat(params.diametro) || 50;
    const raio = diametro / 2;
    const entreFuros = parseFloat(params.entreVaos) || 15;
    const margem = parseFloat(params.margem) || 40;
    const espessura = parseFloat(params.espessura) || 15;
    const padrao = params.padrao || 'grade';'''

new_red_params = '''    const W = parseFloat(params.muxRedLargura || params.largura) || 800;
    const H = parseFloat(params.muxRedAltura || params.altura) || 1200;
    const diametro = parseFloat(params.muxRedDiametro || params.diametro) || 50;
    const raio = diametro / 2;
    const entreFuros = parseFloat(params.muxRedEntreFuros || params.entreFuros || params.entreVaos) || 15;
    const margem = parseFloat(params.muxRedMargemBordas || params.margem) || 40;
    const espessura = parseFloat(params.espessura) || 15;
    const padrao = params.muxRedDistribuicao || params.padrao || 'grade';'''

assert target_red_params in algo_content, 'target_red_params not found'
algo_content = algo_content.replace(target_red_params, new_red_params, 1)

target_red_ret = '''    return {
      produto: 'muxarabi_usinado_redondo',
      largura: W,
      altura: H,'''

new_red_ret = '''    const holesRed = buracos3D.map(b => ({ tipo: 'circulo', cx: b.cx, cy: b.cy, r: b.r }));
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
      altura: H,'''

assert target_red_ret in algo_content, 'target_red_ret not found'
algo_content = algo_content.replace(target_red_ret, new_red_ret, 1)

with open('public/js/algorithms.js', 'w', encoding='utf-8') as f:
    f.write(algo_content)
print('algorithms.js updated!')

# 2. Update curvo_preview3d.js to recognize painel_muxarabi_redondo in buildModel
with open('public/static/curvo_preview3d.js', 'r', encoding='utf-8') as f:
    prev_content = f.read()

target_prev_kind = '''    if (data.kind === 'painel_muxarabi') {
      addPainelMuxarabi(data);
      frameModel();
      return;
    }'''

new_prev_kind = '''    if (data.kind === 'painel_muxarabi' || data.kind === 'painel_muxarabi_redondo' || data.kind === 'muxarabi_usinado_redondo') {
      addPainelMuxarabi(data);
      frameModel();
      return;
    }'''

assert target_prev_kind in prev_content, 'target_prev_kind not found'
prev_content = prev_content.replace(target_prev_kind, new_prev_kind, 1)

with open('public/static/curvo_preview3d.js', 'w', encoding='utf-8') as f:
    f.write(prev_content)
print('curvo_preview3d.js updated!')

# 3. Update server.js to add /api/painel-muxarabi-redondo/montado3d and preview routing
with open('server.js', 'r', encoding='utf-8') as f:
    server_content = f.read()

target_server_mux = '''// Painel Muxarabi Usinado
app.post('/api/painel-muxarabi/montado3d', (req, res) => {
  const body = req.body || {};
  if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
  const calculo = AlgoritmosCNC.calcularMuxarabi(body);
  res.json(calculo.painelMuxarabiData || { kind: 'painel_muxarabi', largura: body.largura, altura: body.altura });
});'''

new_server_mux = '''// Painel Muxarabi Usinado
app.post('/api/painel-muxarabi/montado3d', (req, res) => {
  const body = req.body || {};
  if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
  const calculo = AlgoritmosCNC.calcularMuxarabi(body);
  res.json(calculo.painelMuxarabiData || { kind: 'painel_muxarabi', largura: body.painelMuxLargura || body.largura || 800, altura: body.painelMuxAltura || body.altura || 1200, holes: [] });
});

// Painel Muxarabi Redondo
app.post('/api/painel-muxarabi-redondo/montado3d', (req, res) => {
  const body = req.body || {};
  if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
  const calculo = AlgoritmosCNC.calcularMuxarabiRedondo(body);
  res.json(calculo.painelMuxarabiData || { kind: 'painel_muxarabi_redondo', largura: body.muxRedLargura || body.largura || 800, altura: body.muxRedAltura || body.altura || 1200, holes: [] });
});'''

assert target_server_mux in server_content, 'target_server_mux not found'
server_content = server_content.replace(target_server_mux, new_server_mux, 1)

# In rotasPreview handler:
target_server_preview = '''      } else if (url.includes('muxarabi-encaixado')) {
        resultadoCNC = AlgoritmosCNC.calcularMuxarabiEncaixado(params);
        nomeBase = `muxarabi_encaixado_${params.largura}x${params.altura}`;
      } else if (url.includes('muxarabi')) {
        resultadoCNC = AlgoritmosCNC.calcularMuxarabi(params);
        nomeBase = `muxarabi_usinado_${params.largura}x${params.altura}`;'''

new_server_preview = '''      } else if (url.includes('muxarabi-encaixado')) {
        resultadoCNC = AlgoritmosCNC.calcularMuxarabiEncaixado(params);
        nomeBase = `muxarabi_encaixado_${params.comprimento_total || params.largura}x${params.altura_total || params.altura}`;
      } else if (url.includes('painel-muxarabi-redondo')) {
        resultadoCNC = AlgoritmosCNC.calcularMuxarabiRedondo(params);
        nomeBase = `muxarabi_redondo_${params.muxRedLargura || params.largura}x${params.muxRedAltura || params.altura}`;
      } else if (url.includes('muxarabi')) {
        resultadoCNC = AlgoritmosCNC.calcularMuxarabi(params);
        nomeBase = `muxarabi_usinado_${params.painelMuxLargura || params.largura}x${params.painelMuxAltura || params.altura}`;'''

assert target_server_preview in server_content, 'target_server_preview not found'
server_content = server_content.replace(target_server_preview, new_server_preview, 1)

with open('server.js', 'w', encoding='utf-8') as f:
    f.write(server_content)
print('server.js updated!')
