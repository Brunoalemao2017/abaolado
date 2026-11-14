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
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function test() {
  console.log('Testing /api/pe-conico/montado3d:');
  const resPe = await post('/api/pe-conico/montado3d', {
    pc_diam_base: 550,
    pc_diam_topo: 350,
    pc_altura: 700,
    pc_espessura_mdf: 18
  });
  console.log('Status:', resPe.status);
  console.log('kind:', resPe.json && resPe.json.kind);
  console.log('largura_base:', resPe.json && resPe.json.largura_base);
  console.log('sectors count:', resPe.json && (resPe.json.sectors || []).length);
  console.log('rings count:', resPe.json && (resPe.json.rings || []).length);

  console.log('\nTesting /api/curvos/montado3d (simples):');
  const resSimples = await post('/api/curvos/montado3d', {
    tipo_curvo: 'simples',
    largura: 280,
    profundidade: 350,
    altura: 400,
    raio: 80,
    espessura_mdf: 18
  });
  console.log('Status:', resSimples.status);
  console.log('front_path count:', resSimples.json && (resSimples.json.front_path || []).length);
  console.log('top_outline count:', resSimples.json && (resSimples.json.top_outline || []).length);
  console.log('ripas count:', resSimples.json && (resSimples.json.ripas || []).length);
}

test();
