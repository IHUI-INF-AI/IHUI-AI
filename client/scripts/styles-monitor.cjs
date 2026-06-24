/**
 * 样式监控脚本
 *
 * 用法：
 *   node scripts/styles-monitor.cjs save   # 保存当前样式快照
 *   node scripts/styles-monitor.cjs check  # 对比快照检查变更
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const snapshotPath = path.join(__dirname, 'styles-monitor-snapshot.json');

const EXTENSIONS = ['.vue', '.scss', '.sass', '.css'];

function walkDir(dir, extensions, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkDir(full, extensions, files);
    } else if (e.isFile() && extensions.has(path.extname(e.name))) {
      files.push(path.relative(rootDir, full).replace(/\\/g, '/'));
    }
  }
  return files;
}

function main() {
  const command = process.argv[2] || 'check';
  const currentFiles = walkDir(srcDir, new Set(EXTENSIONS));

  if (command === 'save') {
    fs.writeFileSync(snapshotPath, JSON.stringify({ files: currentFiles, timestamp: Date.now() }, null, 2));
    console.log(`✓ 样式快照已保存: ${snapshotPath}  (${currentFiles.length} 个文件)`);
    process.exit(0);
  }

  if (command === 'check') {
    if (!fs.existsSync(snapshotPath)) {
      console.log('! 未找到历史快照，请先运行 save');
      process.exit(1);
    }
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    const prev = new Set(snapshot.files || []);
    const curr = new Set(currentFiles);

    const added = [...curr].filter(f => !prev.has(f));
    const removed = [...prev].filter(f => !curr.has(f));

    if (added.length === 0 && removed.length === 0) {
      console.log('✓ 样式文件无变更');
      process.exit(0);
    }

    console.log('\n样式文件变更:');
    for (const f of added) console.log(`  + ${f}`);
    for (const f of removed) console.log(`  - ${f}`);
    process.exit(1);
  }

  console.log('用法: node scripts/styles-monitor.cjs <save|check>');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
