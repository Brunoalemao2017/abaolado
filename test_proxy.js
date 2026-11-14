const https = require('https');

let sessionCookie = '';

async function login() {
  return new Promise((resolve, reject) => {
    const postData = 'username=brunoalemao2025%40gmail.com&password=Bruno2017%40';
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
      const setCookies = res.headers['set-cookie'] || [];
      sessionCookie = setCookies.map(c => c.split(';')[0]).join('; ');
      console.log('Login status:', res.statusCode);
      console.log('Session Cookie:', sessionCookie);
      resolve(sessionCookie);
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function fetchMontado3D(cookie) {
  return new Promise((resolve, reject) => {
    const postData = 'tipo_curvo=simples&largura=280&profundidade=350&altura=400&raio=80&espessura_mdf=18&gerar_reforco=1';
    const req = https.request('https://centraldxf.com/api/curvos/montado3d', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://centraldxf.com',
        'Referer': 'https://centraldxf.com/',
        'Cookie': cookie
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Montado3D status:', res.statusCode);
        console.log('Body length:', data.length);
        resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

(async () => {
  try {
    const cookie = await login();
    const data = await fetchMontado3D(cookie);
    console.log('Keys in data:', Object.keys(data));
    console.log('Test successful!');
  } catch (e) {
    console.error('Error:', e);
  }
})();
