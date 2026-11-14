const https = require('https');

function getCookieMap(setCookieHeaders) {
  const map = {};
  (setCookieHeaders || []).forEach(header => {
    const parts = header.split(';')[0].split('=');
    if (parts.length >= 2) {
      map[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
  return map;
}

function stringifyCookies(cookieMap) {
  return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
}

function loginCentral() {
  return new Promise((resolve, reject) => {
    // 1. GET /login
    const req1 = https.request('https://centraldxf.com/login', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res1) => {
      const cookies = getCookieMap(res1.headers['set-cookie']);
      console.log('GET /login cookies:', cookies);

      // 2. POST /login
      const postData = 'username=brunoalemao2025%40gmail.com&password=Bruno2017%40';
      const req2 = https.request('https://centraldxf.com/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://centraldxf.com',
          'Referer': 'https://centraldxf.com/login',
          'Cookie': stringifyCookies(cookies)
        }
      }, (res2) => {
        console.log('POST /login status:', res2.statusCode);
        const postCookies = getCookieMap(res2.headers['set-cookie']);
        Object.assign(cookies, postCookies);
        const finalCookieHeader = stringifyCookies(cookies);
        console.log('Final cookie header:', finalCookieHeader);
        resolve(finalCookieHeader);
      });
      req2.on('error', reject);
      req2.write(postData);
      req2.end();
    });
    req1.on('error', reject);
    req1.end();
  });
}

loginCentral().then(cookieStr => {
  // Test /api/curvos/montado3d
  const bodyData = 'tipo_curvo=duplo_vertical&largura=400&profundidade=300&altura=400&raio=80&espessura_mdf=18&gerar_reforco=1';
  const req3 = https.request('https://centraldxf.com/api/curvos/montado3d', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(bodyData),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'https://centraldxf.com',
      'Referer': 'https://centraldxf.com/',
      'Cookie': cookieStr
    }
  }, (res3) => {
    console.log('/api/curvos/montado3d status:', res3.statusCode);
    let data = '';
    res3.on('data', c => data += c);
    res3.on('end', () => {
      console.log('API response length:', data.length);
      const json = JSON.parse(data);
      console.log('API keys:', Object.keys(json));
      console.log('reforco_z:', json.reforco_z);
      console.log('ripas count:', (json.ripas || []).length);
    });
  });
  req3.write(bodyData);
  req3.end();
}).catch(console.error);
