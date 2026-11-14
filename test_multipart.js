const http = require('http');

// Simular FormData com boundary
const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
let body = '';
body += `--${boundary}\r\nContent-Disposition: form-data; name="tipo_curvo"\r\n\r\nsimples\r\n`;
body += `--${boundary}\r\nContent-Disposition: form-data; name="largura"\r\n\r\n280\r\n`;
body += `--${boundary}\r\nContent-Disposition: form-data; name="profundidade"\r\n\r\n350\r\n`;
body += `--${boundary}\r\nContent-Disposition: form-data; name="altura"\r\n\r\n400\r\n`;
body += `--${boundary}\r\nContent-Disposition: form-data; name="raio"\r\n\r\n80\r\n`;
body += `--${boundary}\r\nContent-Disposition: form-data; name="espessura_mdf"\r\n\r\n18\r\n`;
body += `--${boundary}\r\nContent-Disposition: form-data; name="gerar_reforco"\r\n\r\n1\r\n`;
body += `--${boundary}--\r\n`;

const req = http.request('http://localhost:3000/api/curvos/montado3d', {
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Multipart status:', res.statusCode);
    try {
      const json = JSON.parse(data);
      console.log('Returned keys:', Object.keys(json));
      console.log('top_outline points:', json.top_outline ? json.top_outline.length : 0);
    } catch(e) {
      console.log('Error parsing:', data);
    }
  });
});

req.write(body);
req.end();
