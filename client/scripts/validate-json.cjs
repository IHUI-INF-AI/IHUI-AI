// 验证所有编辑过的 JSON 文件语法正确性
const fs = require('fs');
const path = require('path');

const editedFiles = [
  // drama.json - 移除 aiCreation/videoProcessing 字符串键
  'src/locales/full/zh-CN/drama.json',
  'src/locales/full/zh-TW/drama.json',
  'src/locales/full/ja/drama.json',
  'src/locales/full/ko/drama.json',
  'src/locales/full/en/drama.json',
  // error.json - 添加 登录状态保存失败 键
  'src/locales/modules/zh-CN/error.json',
  'src/locales/modules/zh-TW/error.json',
  'src/locales/modules/en/error.json',
  'src/locales/modules/ja/error.json',
  'src/locales/modules/ko/error.json',
  // BOM 清理后的文件
  'src/locales/full/zh-CN/adminClassicindex.json',
  'src/locales/full/zh-TW/adminClassicindex.json',
  'src/locales/full/en/adminClassicindex.json',
  'src/locales/full/ja/adminClassicindex.json',
  'src/locales/full/ko/adminClassicindex.json',
];

const root = path.join(__dirname, '..');
let errors = 0;

for (const rel of editedFiles) {
  const full = path.join(root, rel);
  try {
    const raw = fs.readFileSync(full, 'utf8');
    // 检查 BOM
    if (raw.charCodeAt(0) === 0xFEFF) {
      console.log(`[BOM STILL PRESENT] ${rel}`);
      errors++;
      continue;
    }
    JSON.parse(raw);
    console.log(`[OK] ${rel}`);
  } catch (e) {
    console.log(`[PARSE ERROR] ${rel}: ${e.message}`);
    errors++;
  }
}

console.log(`\n${errors === 0 ? '✅ All files valid.' : `❌ ${errors} file(s) with errors.`}`);
process.exit(errors === 0 ? 0 : 1);
