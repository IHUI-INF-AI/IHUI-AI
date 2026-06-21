const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const srcFile = path.join(__dirname, 'tokens.css');
const destFile = path.join(distDir, 'index.css');

// 创建 dist 目录
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 复制 CSS 文件
fs.copyFileSync(srcFile, destFile);

console.log('shared-tokens build complete!');
console.log(`Output: ${destFile}`);
