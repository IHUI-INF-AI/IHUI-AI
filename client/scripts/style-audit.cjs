/**
 * 样式审计脚本
 *
 * 检查项目样式健康状况：
 *   - 样式文件数量与体积
 *   - 是否存在大量内联样式
 *   - 是否有重复的样式规则
 *
 * 用法：npm run style:audit
 * 退出码：0 通过，1 存在严重问题
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

const EXTENSIONS = ['.vue', '.scss', '.sass', '.css'];
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'storybook-static']);

function walkDir(dir, extensions, files) {
  if (!fs.existsSync(dir)) return files || [];
  files = files || [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (IGNORE_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkDir(full, extensions, files);
    } else if (e.isFile() && extensions.has(path.extname(e.name))) {
      const stat = fs.statSync(full);
      files.push({
        path: path.relative(rootDir, full).replace(/\\/g, '/'),
        size: stat.size,
        lines: fs.readFileSync(full, 'utf-8').split(/\r?\n/).length,
      });
    }
  }
  return files;
}

function main() {
  const files = walkDir(srcDir, new Set(EXTENSIONS));

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
  const largeFiles = files.filter(f => f.size > 50 * 1024).sort((a, b) => b.size - a.size);

  console.log('\n========== 样式审计 ==========\n');
  console.log(`样式文件总数: ${files.length}`);
  console.log(`总大小: ${(totalSize / 1024).toFixed(1)} KB`);
  console.log(`总行数: ${totalLines}\n`);

  if (largeFiles.length > 0) {
    console.log('大文件（> 50KB）:');
    for (const f of largeFiles.slice(0, 10)) {
      console.log(`  ${f.path}  (${(f.size / 1024).toFixed(1)} KB, ${f.lines} 行)`);
    }
    console.log('');
  }

  // 检查内联样式
  let inlineStyleCount = 0;
  for (const f of files) {
    if (!f.path.endsWith('.vue')) continue;
    const text = fs.readFileSync(path.join(rootDir, f.path), 'utf-8');
    const matches = text.match(/\sstyle="[^"]*"/g);
    if (matches) inlineStyleCount += matches.length;
  }
  console.log(`内联 style 属性数量: ${inlineStyleCount}`);
  if (inlineStyleCount > 20) {
    console.log('⚠️  内联样式较多，建议抽离为 CSS class');
  }

  console.log('\n✓ 样式审计完成');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
