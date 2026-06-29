// 扫描所有 JSON 文件并剥离 BOM 标记
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales');

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full));
    } else if (entry.name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results;
}

const files = walk(LOCALES_DIR);
let stripped = 0;
let totalBomBytes = 0;

for (const file of files) {
  const buf = fs.readFileSync(file);
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    const content = buf.slice(3).toString('utf8');
    fs.writeFileSync(file, content, 'utf8');
    stripped++;
    totalBomBytes += 3;
    console.log(`[BOM stripped] ${path.relative(LOCALES_DIR, file)}`);
  }
}

console.log(`\nDone. Stripped BOM from ${stripped} files (${totalBomBytes} bytes removed).`);
