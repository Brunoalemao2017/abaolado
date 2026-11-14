const http = require('http');

function testPe(route) {
  return new Promise((resolve) => {
    const postBody = new URLSearchParams({
      altura: '750',
      largura_topo: '400',
      profund_topo: '400',
      largura_base: '600',
      profund_base: '600',
      espessura_material: '18',
      espessura_anel: '18'
    }).toString();

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: route,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postBody)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, raw: data.substring(0, 200) });
        }
      });
    });
    req.write(postBody);
    req.end();
  });
}

async function run() {
  const routes = [
    '/api/pe-conico/montado3d',
    '/api/pe-redondo/montado3d',
    '/api/pe-oval/montado3d',
    '/api/pe-oblongo/montado3d',
    '/api/pe-conico-quadrado/montado3d',
    '/api/pe-portico-u/montado3d'
  ];
  for (const r of routes) {
    const res = await testPe(r);
    console.log(`${r}: status=${res.status}, kind=${res.json?.kind}, rings=${res.json?.rings?.length}, sectors=${res.json?.sectors?.length}`);
  }
}
run();
