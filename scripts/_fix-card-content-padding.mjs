/**
 * codemod: 给所有 CardContent className 中的 p-X (X ≠ 0/4) 添加 min-[640px]:p-X 响应式限定。
 * 解决 2026-08-12 引入的 ihui/no-unpaired-card-content-padding warning。
 *
 * 策略:
 * 1. 用 regex 扫描每个 .tsx / .ts 文件
 * 2. 找 <CardContent className="..."> 这种单行 / 多行写法(Literal 形式)
 * 3. 解析 className,若含 p-X (X ∈ {1,2,3,5,6,8,10,12,...}, X≠0/4) 但无 min-[640px]:p-Y,
 *    把所有 p-X 后面追加 min-[640px]:p-X(只在缺响应式限时追加,避免重复)
 *
 * 跳过:动态 className(JSX expression `{...}` / 模板字符串插值 / 字符串变量)
 *
 * 使用: node scripts/_fix-card-content-padding.mjs
 * 测试: --dry-run 显示修改预览;不加 --dry-run 实际写回文件
 *
 * 2026-08-12 立
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');

const P_DIGIT_RE = /\bp-(\d+)\b/g;
const MIN_640_P_RE = /\bmin-\[640px\]:p-(\d+)\b/;

const fileHits = [];
let fileCount = 0;
let editCount = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next' || ent.name === '.turbo' || ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'dist' || ent.name === 'build') continue;
      walk(p);
    } else if (ent.name.endsWith('.tsx') || ent.name.endsWith('.ts')) {
      process(p);
    }
  }
}

function process(file) {
  fileCount++;
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  const orig = content;
  // 匹配 <CardContent className="..."> 或 <CardContent ... className="..." ...>
  // 仅 Literal 形式(双引号或单引号)
  const classNameRegex = /<CardContent\b[^>]*?\bclassName\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/g;
  content = content.replace(classNameRegex, (full, quoted, dq, sq) => {
    const cn = dq !== undefined ? dq : sq;
    if (!cn) return full;
    // 若已含 min-[640px]:p-Y,跳过
    if (MIN_640_P_RE.test(cn)) return full;
    // 找出所有 p-X
    const pxList = [];
    let m;
    P_DIGIT_RE.lastIndex = 0;
    while ((m = P_DIGIT_RE.exec(cn)) !== null) {
      const x = parseInt(m[1], 10);
      if (x !== 0 && x !== 4) pxList.push({ match: m[0], x });
    }
    if (pxList.length === 0) return full;
    // 追加:在末尾加 min-[640px]:p-X for each X(去重)
    const uniqueXs = Array.from(new Set(pxList.map((p) => p.x)));
    const additions = uniqueXs.map((x) => `min-\\[640px\\]:p-${x}`).join(' ');
    const newCn = `${cn} ${additions}`;
    return full.replace(quoted, quoted[0] + newCn + quoted[0]);
  });
  if (content !== orig) {
    fileHits.push(file);
    editCount++;
    if (!DRY_RUN) {
      fs.writeFileSync(file, content, 'utf8');
    }
  }
}

walk(path.join(ROOT, 'apps'));
walk(path.join(ROOT, 'packages'));

console.log(`Scanned ${fileCount} files.`);
if (DRY_RUN) {
  console.log(`--dry-run: would edit ${editCount} files:`);
} else {
  console.log(`Edited ${editCount} files:`);
}
for (const f of fileHits) console.log('  ' + path.relative(ROOT, f));
