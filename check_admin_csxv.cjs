const fs = require('fs');
const js = fs.readFileSync('frontend/dist/assets/index-CsxvH5k1.js', 'utf8');

console.log('Contains Nova Categoria select in Admin:', js.includes('Selecione uma Categoria'));
console.log('Contains parseFloat fix in Admin:', js.includes('parseFloat(String('));
