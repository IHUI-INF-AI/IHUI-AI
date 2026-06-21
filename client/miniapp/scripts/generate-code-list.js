const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_MD = path.join(ROOT, 'docs', '源代码清单.md');
const OUTPUT_CSV = path.join(ROOT, 'docs', 'source-code-list.csv');

const EXCLUDE_DIRS = [
  'node_modules',
  'uni_modules',
  path.join('src', 'uni_modules'),
  path.join('src', 'uniCloud-aliyun', 'cloudfunctions', 'uni-id-co')
];

const INCLUDE_ROOTS = [
  'src',
  path.join('cloudfunctions', 'coze_chatv3_request'),
  'public'
];

const CODE_EXTS = new Set([
  '.js', '.ts', '.vue', '.scss', '.css', '.json', '.md', '.html'
]);

function isExcluded(p) {
  const rel = path.relative(ROOT, p).replace(/\\/g, '/');
  return EXCLUDE_DIRS.some(d => rel.startsWith(d.replace(/\\/g, '/')));
}

function walk(dir, collector) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (isExcluded(full)) continue;
    if (e.isDirectory()) walk(full, collector);
    else {
      const ext = path.extname(e.name).toLowerCase();
      if (!CODE_EXTS.has(ext)) continue;
      const stat = fs.statSync(full);
      collector.push({
        path: path.relative(ROOT, full).replace(/\\/g, '/'),
        size: stat.size,
        mtime: stat.mtime
      });
    }
  }
}

function gather() {
  const files = [];
  for (const r of INCLUDE_ROOTS) {
    const abs = path.join(ROOT, r);
    if (fs.existsSync(abs)) walk(abs, files);
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

function toCsv(rows) {
  const header = 'file,size,last_modified';
  const lines = rows.map(r => `${r.path},${r.size},${r.mtime.toISOString()}`);
  return [header, ...lines].join('\n');
}

function toMd(rows) {
  const lines = [
    '# 源代码清单',
    '',
    '| 文件 | 大小(bytes) | 最后修改时间 |',
    '|---|---:|---|'
  ];
  for (const r of rows) {
    lines.push(`| ${r.path} | ${r.size} | ${r.mtime.toISOString()} |`);
  }
  return lines.join('\n');
}

function main() {
  const rows = gather();
  fs.writeFileSync(OUTPUT_CSV, toCsv(rows), 'utf8');
  fs.writeFileSync(OUTPUT_MD, toMd(rows), 'utf8');
}

main();