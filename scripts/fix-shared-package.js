const fs = require('fs');
const f = 'g:/IHUI-AI/packages/shared/package.json';
let s = fs.readFileSync(f, 'utf8');
// Replace main/module/types root
s = s.replace(/"main": "\.\/src\/index\.ts"/g, '"main": "./dist/index.js"');
s = s.replace(/"module": "\.\/src\/index\.ts"/g, '"module": "./dist/index.js"');
s = s.replace(/"types": "\.\/src\/index\.ts"/g, '"types": "./dist/index.d.ts"');
// Replace all exports: .ts and .tsx
s = s.replace(/("types": )"\.\/src\/([^"]+?)\.tsx?"/g, '$1"./dist/$2.d.ts"');
s = s.replace(/("import": )"\.\/src\/([^"]+?)\.tsx?"/g, '$1"./dist/$2.js"');
const hasSrc = s.includes('./src/');
console.log(hasSrc ? 'STILL HAS SRC' : 'ALL CLEAN');
if (hasSrc) {
  s.split('\n').filter(l => l.includes('./src/')).slice(0,5).forEach(l => console.log(l.trim()));
} else {
  console.log('Success! Verified no ./src/ references remain.');
}
fs.writeFileSync(f, s);
