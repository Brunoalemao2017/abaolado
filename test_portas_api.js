const http = require('http');

function postData(subtipo, extra = {}) {
  return new Promise((resolve) => {
    const postBody = new URLSearchParams({
      produto: subtipo,
      subtipo: subtipo,
      tipoCava: subtipo,
      largura: '400',
      altura: '700',
      puxador_largura: '80',
      puxador_altura: '80',
      puxador_pos_x: '40',
      puxador_pos_y: '40',
      espessura_material: '18',
      ...extra
    }).toString();

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/portas/montado3d',
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
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.write(postBody);
    req.end();
  });
}

async function run() {
  const subtypes = [
    'porta_puxador_cava_quadrado',
    'porta_puxador_cava_longa',
    'porta_puxador_cava_redonda',
    'porta_sem_puxador'
  ];
  for (const s of subtypes) {
    const res = await postData(s);
    console.log(`Subtype: ${s} => status: ${res.status}, kind: ${res.data?.kind}, cava:`, res.data?.cava ? Object.keys(res.data.cava) : 'no cava');
  }
}
run();
