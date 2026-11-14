const http = require('http');

const postData = 'tipo_curvo=simples&largura=280&profundidade=350&altura=400&raio=80&espessura_mdf=18&gerar_reforco=1';

const req = http.request('http://localhost:3000/preview?reforco_v2=1', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Local /preview status:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Content-Disposition:', res.headers['content-disposition']);
    console.log('DXF length:', data.length);
    console.log('Starts with:', data.slice(0, 40));
    console.log('Ends with:', data.slice(-20));
  });
});

req.write(postData);
req.end();
