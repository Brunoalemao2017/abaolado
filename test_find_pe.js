const fs = require('fs');

let algoCode = fs.readFileSync('public/js/algorithms.js', 'utf8');

// Replace calcularPeConico with complete version
const oldPe = algoCode.match(/calcularPeConico\s*\([^)]*\)\s*\{[\s\S]*?return\s*\{[\s\S]*?\};\s*\}/);

if (oldPe) {
  console.log('Found old calcularPeConico');
} else {
  console.log('oldPe not found by regex');
}
