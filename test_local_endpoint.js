const http = require('http');

const postData = 'tipo_curvo=simples&largura=280&profundidade=350&altura=400&raio=80&espessura_mdf=18&gerar_reforco=1';

const req = http.request('http://localhost:3000/api/curvos/montado3d', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Local /api/curvos/montado3d status:', res.statusCode);
    const json = JSON.parse(data);
    console.log('Returned keys:', Object.keys(json));
    console.log('top_outline points:', json.top_outline ? json.top_outline.length : 0);
  });
});

req.write(postData);
req.end();
