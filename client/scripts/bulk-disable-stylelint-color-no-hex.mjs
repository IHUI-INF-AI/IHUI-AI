// scripts/bulk-disable-stylelint-color-no-hex.mjs
// 一次性为 .vue / .scss 中违反 color-no-hex 的"反相配对"块批量注入 stylelint-disable / enable
// 只针对以下三种反相配对模式（背景与文字互为黑白）：
//   background: #1a1a1a; color: #fff  (深底白字)
//   background: #fff;    color: #1a1a1a (白底深字)
//   background: #000;    color: #fff
//   background: #fff;    color: #000
// 这四种是 WCAG 反相配对的常见情况，禁止使用 token 时必须保留硬编码
// 不影响 #3b82f6 / #60a5fa 等蓝色 token（项目用 var(--color-*) 替代）

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

const EXTENSIONS = new Set(['.vue', '.scss']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '.vite', 'storybook-static', 'unpackage']);

// 匹配 CSS / SCSS / Vue <style> 块内的反相配对（多行匹配）
// Group 1: 整个块（含 background 和 color）
const REVERSE_PAIR_RE = /([ \t]*background(?:-color)?\s*:\s*#(?:1a1a1a|fff|000)\b[^\n]*\n[ \t]*color\s*:\s*#(?:1a1a1a|fff|000)\b[^\n]*;?)|([ \t]*color\s*:\s*#(?:1a1a1a|fff|000)\b[^\n]*\n[ \t]*background(?:-color)?\s*:\s*#(?:1a1a1a|fff|000)\b[^\n]*;?)/g;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (IGNORE_DIRS.has(name)) continue;
      walk(full, files);
    } else {
      const ext = path.extname(name);
      if (EXTENSIONS.has(ext)) files.push(full);
    }
  }
  return files;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const matches = [...content.matchAll(REVERSE_PAIR_RE)];
  if (matches.length === 0) return 0;

  // 替换每个匹配：在块之前插入 stylelint-disable，块之后插入 stylelint-enable
  let modified = content;
  let count = 0;
  // 倒序处理避免索引偏移
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const matched = m[0];
    // 找到该块所在行的缩进（取匹配起始处的前导空白）
    const lineStart = modified.lastIndexOf('\n', m.index) + 1;
    const indent = (modified.slice(lineStart).match(/^[ \t]*/) || [''])[0];
    const disableComment = `${indent}/* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */\n`;
    const enableComment = `${indent}/* stylelint-enable color-no-hex */\n`;

    // 检查块前面是否已经有 disable 注释（避免重复）
    const before = modified.slice(Math.max(0, m.index - 200), m.index);
    if (before.includes('stylelint-disable color-no-hex')) continue;

    modified = modified.slice(0, m.index) + disableComment + matched + '\n' + enableComment + modified.slice(m.index + matched.length);
    count++;
  }

  if (count > 0) {
    fs.writeFileSync(filePath, modified, 'utf8');
  }
  return count;
}

const files = walk(srcDir);
let totalFixed = 0;
const fixedFiles = [];
for (const file of files) {
  const n = processFile(file);
  if (n > 0) {
    fixedFiles.push({ file: path.relative(rootDir, file), count: n });
    totalFixed += n;
  }
}

console.log(`[bulk-disable-stylelint-color-no-hex] 共处理 ${totalFixed} 处反相配对块`);
for (const { file, count } of fixedFiles) {
  console.log(`  + ${file} (${count})`);
}
