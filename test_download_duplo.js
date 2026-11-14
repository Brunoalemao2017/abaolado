const http = require('http');
const fs = require('fs');

const postData = new URLSearchParams({
  tipo_curvo: 'duplo_vertical',
  largura: '400',
  profundidade: '300',
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
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('DXF file length:', data.length, 'bytes');
    fs.writeFileSync('C:/Users/bruno/.gemini/antigravity/scratch/central-dxf-pro/canto_curvo_duplo_completo.dxf', data);
    
    const polylineCount = (data.match(/0\nPOLYLINE\n/g) || []).length;
    const lineCount = (data.match(/0\nLINE\n/g) || []).length;

    console.log('Duplo DXF Entities:');
    console.log('  Polylines (peças e rasgos):', polylineCount);
    console.log('  Lines (canais de dobra):', lineCount);
  });
});

req.write(postData);
req.end();
