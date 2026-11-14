const http = require('http');
const fs = require('fs');

const postData = new URLSearchParams({
  tipo_curvo: 'simples',
  largura: '280',
  profundidade: '350',
  altura: '400',
  raio: '80',
  espessura: '18',
  gerar_reforco: '1'
}).toString();

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/preview',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  console.log('HTTP Status:', res.statusCode);
  console.log('Headers:', res.headers['content-disposition']);
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('DXF file length:', data.length, 'bytes');
    fs.writeFileSync('C:/Users/bruno/.gemini/antigravity/scratch/central-dxf-pro/canto_curvo_simples_completo.dxf', data);
    
    // Count occurrences of layers
    const corteCount = (data.match(/8\nCORTE\n/g) || []).length;
    const usinagemCount = (data.match(/8\nUSINAGEM\n/g) || []).length;
    const fresagemDobraCount = (data.match(/8\nFRESAGEM_DOBRA\n/g) || []).length;
    const polylineCount = (data.match(/0\nPOLYLINE\n/g) || []).length;
    const lineCount = (data.match(/0\nLINE\n/g) || []).length;

    console.log('DXF Entities:');
    console.log('  Polylines (peças e rasgos):', polylineCount);
    console.log('  Lines (canais de dobra):', lineCount);
    console.log('  Layer CORTE entities:', corteCount);
    console.log('  Layer USINAGEM entities:', usinagemCount);
    console.log('  Layer FRESAGEM_DOBRA entities:', fresagemDobraCount);
  });
});

req.write(postData);
req.end();
