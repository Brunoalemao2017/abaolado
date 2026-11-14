const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams(body).toString();
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data), headers: res.headers });
        } catch(e) {
          resolve({ status: res.statusCode, text: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('--- 1. Testing /api/curvos/montado3d (duplo_vertical) ---');
  const curvoDuplo = await post('/api/curvos/montado3d', {
    tipo_curvo: 'duplo_vertical',
    largura: 400,
    profundidade: 300,
    altura: 400,
    raio: 80,
    espessura: 18,
    gerar_reforco: 1
  });
  console.log('Status:', curvoDuplo.status);
  console.log('Keys:', Object.keys(curvoDuplo.json || {}));
  console.log('estrutura_z:', curvoDuplo.json && curvoDuplo.json.estrutura_z);
  console.log('reforco_z:', curvoDuplo.json && curvoDuplo.json.reforco_z);
  console.log('reforco_outlines count:', curvoDuplo.json && (curvoDuplo.json.reforco_outlines || []).length);
  console.log('ripas count:', curvoDuplo.json && (curvoDuplo.json.ripas || []).length);

  console.log('\n--- 2. Testing /api/curvos/montado3d (simples) ---');
  const curvoSimples = await post('/api/curvos/montado3d', {
    tipo_curvo: 'simples',
    largura: 280,
    profundidade: 350,
    altura: 400,
    raio: 80,
    espessura: 18,
    gerar_reforco: 1
  });
  console.log('Status:', curvoSimples.status);
  console.log('Keys:', Object.keys(curvoSimples.json || {}));
  console.log('reforco_outline points:', curvoSimples.json && (curvoSimples.json.reforco_outline || []).length);

  console.log('\n--- 3. Testing /api/portas/montado3d (Cava Redonda) ---');
  const portaRedonda = await post('/api/portas/montado3d', {
    produto: 'porta_puxador_cava_redonda',
    largura: 400,
    altura: 700,
    espessura: 18,
    puxador_lado: 'direita'
  });
  console.log('Status:', portaRedonda.status);
  console.log('Porta kind:', portaRedonda.json && portaRedonda.json.kind);
  console.log('Porta cava:', portaRedonda.json && portaRedonda.json.cava);

  console.log('\n--- 4. Testing /api/portas/montado3d (Cava Longa) ---');
  const portaLonga = await post('/api/portas/montado3d', {
    produto: 'porta_puxador_cava_longa',
    largura: 400,
    altura: 700,
    espessura: 18
  });
  console.log('Status:', portaLonga.status);
  console.log('Porta kind:', portaLonga.json && portaLonga.json.kind);

  console.log('\n--- 5. Testing /api/muxarabi-encaixado/montado3d ---');
  const mux = await post('/api/muxarabi-encaixado/montado3d', {
    largura: 600,
    altura: 800,
    espessura: 18,
    larguraRipaV: 20,
    larguraRipaH: 20
  });
  console.log('Status:', mux.status);
  console.log('Mux kind:', mux.json && mux.json.kind);
  console.log('Verticais count:', mux.json && (mux.json.verticais || []).length);
  console.log('Horizontais count:', mux.json && (mux.json.horizontais || []).length);

  console.log('\n--- 6. Testing /preview (DXF generation) ---');
  const dxfRes = await post('/preview', {
    tipo_curvo: 'duplo_vertical',
    largura: 400,
    profundidade: 300,
    altura: 400,
    raio: 80,
    espessura: 18
  });
  console.log('Status:', dxfRes.status);
  console.log('Content-Type:', dxfRes.headers['content-type']);
  console.log('Content-Disposition:', dxfRes.headers['content-disposition']);
  console.log('DXF starts with:', (dxfRes.text || '').substring(0, 50));
  console.log('DXF length:', (dxfRes.text || '').length);
}

run();
