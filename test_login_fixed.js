const https = require('https');

function testLogin() {
  const postData = 'email=brunoalemao2025%40gmail.com&senha=Bruno2017%40';
  const req = https.request('https://centraldxf.com/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'https://centraldxf.com',
      'Referer': 'https://centraldxf.com/login'
    }
  }, (res) => {
    console.log('Login statusCode:', res.statusCode);
    const cookies = res.headers['set-cookie'] || [];
    console.log('Cookies returned:', cookies);
    const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');

    // Test /api/curvos/montado3d with duplo_vertical
    const testBody = 'tipo_curvo=duplo_vertical&largura=400&profundidade=300&altura=400&raio=80&espessura_mdf=18&gerar_reforco=1';
    const req2 = https.request('https://centraldxf.com/api/curvos/montado3d', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(testBody),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://centraldxf.com',
        'Referer': 'https://centraldxf.com/',
        'Cookie': cookieStr
      }
    }, (res2) => {
      console.log('API curvos status:', res2.statusCode);
      let data = '';
      res2.on('data', c => data += c);
      res2.on('end', () => {
        console.log('API response length:', data.length);
        if (data.length > 0 && res2.statusCode === 200) {
          const json = JSON.parse(data);
          console.log('API response keys:', Object.keys(json));
          console.log('Estrutura Z:', json.estrutura_z);
          console.log('Reforço Z:', json.reforco_z);
          console.log('Ripas count:', (json.ripas || []).length);
        } else {
          console.log('Response body:', data);
        }
      });
    });
    req2.write(testBody);
    req2.end();
  });
  req.write(postData);
  req.end();
}

testLogin();
