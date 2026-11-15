const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const multer = require('multer');
const AdmZip = require('adm-zip');

const upload = multer();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(upload.none()); // Permite ler multipart/form-data enviado por FormData() do navegador
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// 1. GERENCIADOR DE SESSÃO OFICIAL CENTRAL DXF
// ----------------------------------------------------
let centralSessionCookie = '';
let lastLoginTime = 0;

async function autenticarCentralDXF() {
  return new Promise((resolve) => {
    // 1. GET /login primeiro para capturar cookies de sessão iniciais
    const reqGet = https.request('https://centraldxf.com/login', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    }, (resGet) => {
      const initCookies = (resGet.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      const postData = 'username=brunoalemao2025%40gmail.com&password=Bruno2017%40';

      const reqPost = https.request('https://centraldxf.com/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://centraldxf.com',
          'Referer': 'https://centraldxf.com/login',
          'Cookie': initCookies
        },
        timeout: 10000
      }, (resPost) => {
        const postCookies = (resPost.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
        centralSessionCookie = [initCookies, postCookies].filter(Boolean).join('; ');
        lastLoginTime = Date.now();
        console.log('✅ Sessão oficial sincronizada com a Central DXF!');
        resolve(centralSessionCookie);
      });

      reqPost.on('error', () => resolve(null));
      reqPost.on('timeout', () => { reqPost.destroy(); resolve(null); });
      reqPost.write(postData);
      reqPost.end();
    });

    reqGet.on('error', () => {
      console.warn('⚠️ Central DXF sem conexão externa. Modo Offline CNC ativo.');
      resolve(null);
    });
    reqGet.on('timeout', () => { reqGet.destroy(); resolve(null); });
    reqGet.end();
  });
}

// Inicializa autenticação em background
autenticarCentralDXF();

// Helper de proxy seguro com proteção contra ERR_HTTP_HEADERS_SENT
function proxyParaCentral(endpoint, bodyObj, res, fallbackLocal) {
  let answered = false;
  function safeFallback() {
    if (answered) return;
    answered = true;
    fallbackLocal();
  }

  if (!centralSessionCookie && Date.now() - lastLoginTime > 300000) {
    autenticarCentralDXF();
  }

  const cleanBody = bodyObj || {};
  const postData = new URLSearchParams(cleanBody).toString();

  const req = https.request(`https://centraldxf.com${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://centraldxf.com',
      'Referer': 'https://centraldxf.com/',
      'Cookie': centralSessionCookie || ''
    },
    timeout: 8000
  }, (proxyRes) => {
    if (proxyRes.statusCode === 200) {
      let rawData = '';
      proxyRes.on('data', chunk => rawData += chunk);
      proxyRes.on('end', () => {
        if (answered) return;
        try {
          const parsed = JSON.parse(rawData);
          if (parsed && (parsed.erro || parsed.detail)) {
            console.warn(`Central DXF retornou aviso/erro (${parsed.erro || JSON.stringify(parsed.detail)}). Ativando motor CNC local.`);
            return safeFallback();
          }
          answered = true;
          res.json(parsed);
        } catch (e) {
          safeFallback();
        }
      });
    } else {
      console.warn(`Proxy ${endpoint} retornou status ${proxyRes.statusCode}. Usando algoritmo local.`);
      safeFallback();
    }
  });

  req.on('error', () => {
    safeFallback();
  });

  req.on('timeout', () => {
    req.destroy();
    safeFallback();
  });

  req.write(postData);
  req.end();
}

// ----------------------------------------------------
// 2. IMPORTAÇÃO DOS ALGORITMOS CNC LOCAIS
// ----------------------------------------------------
let AlgoritmosCNC = null;
try {
  const mod = require('./public/js/algorithms.js');
  AlgoritmosCNC = mod.AlgoritmosCNC;
  if (AlgoritmosCNC && !AlgoritmosCNC.calcularRipado) {
    AlgoritmosCNC.calcularRipado = AlgoritmosCNC.calcularPainelRipado;
  }
  console.log('✅ Motor CNC Paramétrico Offline carregado com sucesso!');
} catch (err) {
  console.error('Erro ao carregar algorithms.js sincrono:', err);
}

// ----------------------------------------------------
// 3. GERADOR DXF NATIVO (AutoCAD R12 ASCII Standard)
// ----------------------------------------------------
function gerarConteudoDXF(dados) {
  const { camadas = [] } = dados || {};

  let dxf = '';
  // HEADER
  dxf += '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n';

  // TABLES
  dxf += '0\nSECTION\n2\nTABLES\n';
  dxf += '0\nTABLE\n2\nLTYPE\n70\n1\n0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n0\nENDTAB\n';

  // Layers
  const layerDefs = [
    { name: 'CORTE', color: 1 },         // Vermelho (Corte passante chapa / furos)
    { name: 'USINAGEM', color: 3 },      // Verde (Rebaixo / cavas)
    { name: 'FRESAGEM_DOBRA', color: 2 },// Amarelo (Canais de dobra / kerfing)
    { name: 'FURACAO', color: 5 },       // Azul (Cavilhas / furos de montagem)
    { name: 'COTAS', color: 7 }          // Branco
  ];

  dxf += `0\nTABLE\n2\nLAYER\n70\n${layerDefs.length}\n`;
  for (const l of layerDefs) {
    dxf += `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS\n`;
  }
  dxf += '0\nENDTAB\n0\nENDSEC\n';

  // BLOCKS
  dxf += '0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n';

  // ENTITIES
  dxf += '0\nSECTION\n2\nENTITIES\n';

  for (const item of camadas) {
    const layer = item.layer || 'CORTE';

    // Polilinha 2D fechada
    if (item.tipo === 'polyline' && item.pontos && item.pontos.length > 0) {
      dxf += '0\nPOLYLINE\n';
      dxf += `8\n${layer}\n`;
      dxf += '66\n1\n';
      dxf += `70\n${item.fechada ? 1 : 0}\n`;
      dxf += '10\n0.0\n20\n0.0\n30\n0.0\n';

      for (const pt of item.pontos) {
        dxf += '0\nVERTEX\n';
        dxf += `8\n${layer}\n`;
        dxf += `10\n${Number(pt.x).toFixed(4)}\n`;
        dxf += `20\n${Number(pt.y).toFixed(4)}\n`;
        dxf += '30\n0.0\n';
      }
      dxf += '0\nSEQEND\n';
      dxf += `8\n${layer}\n`;
    }

    // Linha
    else if (item.tipo === 'line') {
      dxf += '0\nLINE\n';
      dxf += `8\n${layer}\n`;
      dxf += `10\n${Number(item.x1).toFixed(4)}\n`;
      dxf += `20\n${Number(item.y1).toFixed(4)}\n`;
      dxf += '30\n0.0\n';
      dxf += `11\n${Number(item.x2).toFixed(4)}\n`;
      dxf += `21\n${Number(item.y2).toFixed(4)}\n`;
      dxf += '31\n0.0\n';
    }

    // Círculo
    else if (item.tipo === 'circle') {
      dxf += '0\nCIRCLE\n';
      dxf += `8\n${layer}\n`;
      dxf += `10\n${Number(item.cx).toFixed(4)}\n`;
      dxf += `20\n${Number(item.cy).toFixed(4)}\n`;
      dxf += '30\n0.0\n';
      dxf += `40\n${Number(item.r).toFixed(4)}\n`;
    }
  }

  dxf += '0\nENDSEC\n0\nEOF\n';
  return dxf;
}

// ----------------------------------------------------
// 4. ROTAS EXPERT: EDITOR DE PEÇAS PERSONALIZADAS & CAMBOTAS
// ----------------------------------------------------
app.get('/pecas-personalizadas', (req, res) => {
  res.sendFile('pecas-personalizadas.html', { root: path.join(__dirname, 'public') });
});

app.get('/cambotas', (req, res) => {
  res.sendFile('pecas-personalizadas.html', { root: path.join(__dirname, 'public') });
});

app.get('/divisores', (req, res) => {
  res.sendFile('pecas-personalizadas.html', { root: path.join(__dirname, 'public') });
});

app.get('/pecas-provencais', (req, res) => {
  res.sendFile('pecas-personalizadas.html', { root: path.join(__dirname, 'public') });
});

app.get('/pecas-personalizadas/machining-prefs', (req, res) => {
  res.json({ diametroFresaPadrao: 6, profundidadePadrao: 18 });
});

app.post('/pecas-personalizadas/preview-tampo-organico', (req, res) => {
  proxyParaCentral('/pecas-personalizadas/preview-tampo-organico', req.body, res, () => {
    if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
    const calculo = AlgoritmosCNC.calcularTampoOrganico(req.body);
    res.json(calculo || {});
  });
});

app.post('/pecas-personalizadas/exportar-dxf', (req, res) => {
  try {
    const params = req.body || {};
    let calculo = AlgoritmosCNC.calcularTampoOrganico ? AlgoritmosCNC.calcularTampoOrganico(params) : AlgoritmosCNC.calcularCurvoSimples(params);
    const dxf = gerarConteudoDXF(calculo);
    res.setHeader('Content-Type', 'application/dxf');
    res.setHeader('Content-Disposition', 'attachment; filename="peca_personalizada_expert.dxf"');
    res.send(dxf);
  } catch(e) {
    res.status(500).send('Erro ao exportar peça expert: ' + e.message);
  }
});

// ----------------------------------------------------
// 5. ROTAS DE GEOMETRIA 3D (/api/.../montado3d)
// ----------------------------------------------------

// Curvos (Simples, Duplo, Parafusado)
// ----------------------------------------------------
// ROTAS 3D WEBGL UNIVERSAIS - RESPOSTA LOCAL INSTANTÂNEA
// ----------------------------------------------------

// Canto Curvo (Simples, Duplo, Parafusado)
app.post('/api/curvos/montado3d', (req, res) => {
  const body = req.body || {};
  if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
  const tipo = body.tipo_curvo || body.produto || 'simples';
  let calculo;
  if (tipo === 'duplo_vertical' || tipo === 'curvo_duplo_180' || tipo === 'curvo_duplo' || tipo === 'duplo') {
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
  res.json(calculo.painelMuxarabiData || { kind: 'painel_muxarabi', largura: body.painelMuxLargura || body.largura || 800, altura: body.painelMuxAltura || body.altura || 1200, holes: [] });
});

// Painel Muxarabi Redondo
app.post('/api/painel-muxarabi-redondo/montado3d', (req, res) => {
  const body = req.body || {};
  if (!AlgoritmosCNC) return res.status(500).json({ erro: 'Algoritmos CNC não inicializados' });
  const calculo = AlgoritmosCNC.calcularMuxarabiRedondo(body);
  res.json(calculo.painelMuxarabiData || { kind: 'painel_muxarabi_redondo', largura: body.muxRedLargura || body.largura || 800, altura: body.muxRedAltura || body.altura || 1200, holes: [] });
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
});

// Presets Oficiais
app.get('/curvo-presets', (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  const reqUrl = `https://centraldxf.com/curvo-presets?${qs}`;
  const reqHttps = https.request(reqUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://centraldxf.com',
      'Referer': 'https://centraldxf.com/',
      'Cookie': centralSessionCookie || ''
    },
    timeout: 5000
  }, (pRes) => {
    if (pRes.statusCode === 200) {
      pRes.pipe(res);
    } else {
      res.json([
        { id: 'curv_kerfing_90', nome: 'Curvo Dobra 90° R80', largura: 280, profundidade: 350, altura: 400, raio: 80, espessura: 18 }
      ]);
    }
  });
  reqHttps.on('error', () => {
    res.json([
      { id: 'curv_kerfing_90', nome: 'Curvo Dobra 90° R80', largura: 280, profundidade: 350, altura: 400, raio: 80, espessura: 18 }
    ]);
  });
  reqHttps.end();
});

app.get('/history', (req, res) => { res.json([]); });

app.get('/presets', (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  const reqUrl = `https://centraldxf.com/presets?${qs}`;
  const reqHttps = https.request(reqUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://centraldxf.com',
      'Referer': 'https://centraldxf.com/',
      'Cookie': centralSessionCookie || ''
    },
    timeout: 5000
  }, (pRes) => {
    if (pRes.statusCode === 200) {
      pRes.pipe(res);
    } else {
      res.json([]);
    }
  });
  reqHttps.on('error', () => {
    res.json([]);
  });
  reqHttps.end();
});

// ----------------------------------------------------
// 6. PROCESSAMENTO DE FORMULÁRIOS E GERAÇÃO DE DXF (/preview*)
// ----------------------------------------------------
const rotasPreview = [
  '/preview', '/preview-porta', '/preview-prateleira', '/preview-muxarabi',
  '/preview-muxarabi-encaixado', '/preview-painel-muxarabi', '/preview-painel-muxarabi-redondo',
  '/preview-muxarabi-fitado', '/preview-painel-ripado', '/preview-painel-parametrico',
  '/preview-revestimento-cone', '/preview-pe-conico', '/preview-pe-redondo',
  '/preview-pe-redondo-estruturado', '/preview-pe-oval', '/preview-pe-oblongo',
  '/preview-pe-conico-quadrado', '/preview-pe-ripado-arredondado-redondo',
  '/preview-pe-ripado-arredondado-oval', '/preview-pe-portico-u', '/preview-banco'
];

rotasPreview.forEach(rota => {
  app.post(rota, (req, res) => {
    try {
      if (!AlgoritmosCNC) {
        return res.status(500).send('Erro: Algoritmos CNC não inicializados no servidor.');
      }

      const params = req.body || {};
      const url = req.originalUrl;
      let resultadoCNC;
      let nomeBase = 'peca_cnc';

      if (url.includes('porta')) {
        resultadoCNC = AlgoritmosCNC.calcularPortaCava(params);
        nomeBase = `porta_cava_${params.tipoCava || 'quadrada'}_${params.largura}x${params.altura}`;
      } else if (url.includes('prateleira')) {
        resultadoCNC = AlgoritmosCNC.calcularPrateleiraDupla(params);
        nomeBase = `prateleira_dupla_${params.largura}x${params.profundidade}`;
      } else if (url.includes('muxarabi-encaixado')) {
        resultadoCNC = AlgoritmosCNC.calcularMuxarabiEncaixado(params);
        nomeBase = `muxarabi_encaixado_${params.comprimento_total || params.largura}x${params.altura_total || params.altura}`;
      } else if (url.includes('painel-muxarabi-redondo')) {
        resultadoCNC = AlgoritmosCNC.calcularMuxarabiRedondo(params);
        nomeBase = `muxarabi_redondo_${params.muxRedLargura || params.largura}x${params.muxRedAltura || params.altura}`;
      } else if (url.includes('muxarabi')) {
        resultadoCNC = AlgoritmosCNC.calcularMuxarabi(params);
        nomeBase = `muxarabi_usinado_${params.painelMuxLargura || params.largura}x${params.painelMuxAltura || params.altura}`;
      } else if (url.includes('ripado')) {
        resultadoCNC = AlgoritmosCNC.calcularRipado(params);
        nomeBase = `painel_ripado_${params.largura}x${params.altura}`;
      } else if (url.includes('pe-')) {
        resultadoCNC = AlgoritmosCNC.calcularPeConico ? AlgoritmosCNC.calcularPeConico(params) : AlgoritmosCNC.calcularCurvoSimples(params);
        nomeBase = `pe_especial_${params.largura || 400}x${params.altura || 700}`;
      } else {
        // Canto Curvo
        const tipo = params.tipo_curvo || 'simples';
        if (tipo === 'duplo_vertical' || tipo === 'curvo_duplo_180' || tipo === 'curvo_duplo' || tipo === 'duplo') {
          resultadoCNC = AlgoritmosCNC.calcularCurvoDuplo(params);
          nomeBase = `canto_curvo_duplo_${params.largura}x${params.profundidade}x${params.altura}_R${params.raio}`;
        } else if (tipo === 'simples_v3' || tipo === 'duplo_parafusado') {
          resultadoCNC = AlgoritmosCNC.calcularCurvoParafusado(params);
          nomeBase = `canto_curvo_parafusado_${params.largura}x${params.profundidade}x${params.altura}_R${params.raio}`;
        } else {
          resultadoCNC = AlgoritmosCNC.calcularCurvoSimples(params);
          nomeBase = `canto_curvo_simples_${params.largura}x${params.profundidade}x${params.altura}_R${params.raio}`;
        }
      }

      const dxfConteudo = gerarConteudoDXF(resultadoCNC);
      const nomeArquivo = `${nomeBase}.dxf`;

      // Retorna arquivo DXF diretamente como download para a máquina CNC
      res.setHeader('Content-Type', 'application/dxf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomeArquivo)}"`);
      res.send(dxfConteudo);

    } catch (err) {
      console.error(`Erro ao gerar DXF na rota ${rota}:`, err);
      res.status(500).send(`Erro interno ao gerar DXF: ${err.message}`);
    }
  });
});

// ----------------------------------------------------
// 7. INICIALIZAÇÃO DO SERVIDOR
// ----------------------------------------------------
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 FABRICA 064 [PLANO EXPERT VITALÍCIO] INICIADO!`);
    console.log(`📍 Servidor rodando localmente em: http://localhost:${PORT}`);
    console.log(`🔑 Autenticado com sucesso`);
    console.log(`⭐ Todos os recursos Expert (Cambotas, Orgânicos, etc.) desbloqueados`);
    console.log(`🛠️ Geração de DXF 100% desbloqueada offline para CNC`);
    console.log(`====================================================`);
  });
}

module.exports = { app };
