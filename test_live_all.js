const http = require('http');

function postForm(url, body) {
  return new Promise((resolve) => {
    const postData = new URLSearchParams(body).toString();
    const req = http.request(`http://localhost:3000${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, raw: data.substring(0, 100) });
        }
      });
    });
    req.on('error', err => resolve({ status: 500, error: err.message }));
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('Testing Curvo Simples:');
  const r1 = await postForm('/api/curvos/montado3d', { tipo_curvo: 'simples', largura: '400', profundidade: '300', altura: '400' });
  console.log('r1 status:', r1.status, 'kind:', r1.data?.kind, 'estrutura_z:', r1.data?.estrutura_z, 'top_outline pts:', r1.data?.top_outline?.length);

  console.log('\nTesting Portas:');
  for (const s of ['porta_puxador_cava_quadrado', 'porta_puxador_cava_longa', 'porta_puxador_cava_redonda', 'porta_sem_puxador']) {
    const rp = await postForm('/api/portas/montado3d', { produto: s, largura: '400', altura: '700' });
    console.log(s, '=> status:', rp.status, 'kind:', rp.data?.kind, 'cava:', rp.data?.cava ? Object.keys(rp.data.cava) : 'none');
  }

  console.log('\nTesting Pés:');
  for (const p of ['pe-conico', 'pe-redondo', 'pe-oval', 'pe-oblongo', 'pe-conico-quadrado', 'pe-portico-u']) {
    const rpe = await postForm(`/api/${p}/montado3d`, { altura: '700', largura_base: '550', largura_topo: '350' });
    console.log(p, '=> status:', rpe.status, 'kind:', rpe.data?.kind, 'rings:', rpe.data?.rings?.length);
  }
}

runTests();
