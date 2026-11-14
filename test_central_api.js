const https = require('https');

// Test login and session
const postData = 'email=brunoalemao2025%40gmail.com&password=Bruno2017%40';

const req = https.request('https://centraldxf.com/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData),
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://centraldxf.com',
    'Referer': 'https://centraldxf.com/login'
  }
}, (res) => {
  console.log('Login status:', res.statusCode);
  const setCookie = res.headers['set-cookie'];
  console.log('Set-Cookie:', setCookie);

  const cookie = (setCookie || []).map(c => c.split(';')[0]).join('; ');

  // Now test /api/curvos/montado3d with this cookie
  const bodyData = 'tipo_curvo=duplo_vertical&largura=400&profundidade=300&altura=400&espessura=18&raio=80&gerar_reforco=1';
  const req2 = https.request('https://centraldxf.com/api/curvos/montado3d', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(bodyData),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://centraldxf.com',
      'Referer': 'https://centraldxf.com/',
      'Cookie': cookie
    }
  }, (res2) => {
    console.log('/api/curvos/montado3d status:', res2.statusCode);
    let data = '';
    res2.on('data', c => data += c);
    res2.on('end', () => {
      console.log('Response length:', data.length);
      try {
        const json = JSON.parse(data);
        console.log('Response keys:', Object.keys(json));
      } catch (e) {
        console.log('Response (first 200 chars):', data.substring(0, 200));
      }
    });
  });
  req2.write(bodyData);
  req2.end();
});

req.write(postData);
req.end();
