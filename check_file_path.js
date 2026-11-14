const path = require('path');
const fs = require('fs');

const p = path.join(__dirname, 'public', 'pecas-personalizadas.html');
console.log('Path:', p);
console.log('Exists:', fs.existsSync(p));
