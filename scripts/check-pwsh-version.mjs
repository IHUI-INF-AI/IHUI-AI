#!/usr/bin/env node
// scripts/check-pwsh-version.mjs
// 守门:所有项目内 .ps1 文件必须以 `#requires -Version 7` 开头
// 强制只用 PowerShell 7 (pwsh.exe),禁止用 Windows PowerShell 5.1 (powershell.exe)
//
// 退出码: 0 = 全部通过, 1 = 有违规
// 用法: node scripts/check-pwsh-version.mjs [--staged] [--root <path>]

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const stagedOnly = args.includes('--staged');
const rootIdx = args.indexOf('--root');
const ROOT = rootIdx >= 0 ? resolve(args[rootIdx + 1]) : resolve('g:/IHUI-AI');

if (!existsSync(ROOT)) {
  console.error(`[FAIL] root path does not exist: ${ROOT}`);
  process.exit(1);
}

// 跳过的目录(整棵树,gitignore 等价)
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.venv', 'venv', '__pycache__',
  'dist', '.next', 'build', '.turbo', 'target', 'bin', 'obj',
  // 项目内临时目录(.gitignore 第 5 行)
  'tmp',
  // 部署打包产物(.gitignore 第 314 行,不在项目维护范围)
  'deploy',
  // TRAE IDE 工具目录(.gitignore 第 97 行,非项目代码)
  '.trae-cn',
]);

// 跳过的路径模式(子目录白名单)
const SKIP_PATH_PATTERNS = [
  /[\\/]\.venv[\\/]/,
  /[\\/]venv[\\/]/,
  /[\\/]node_modules[\\/]/,
  /[\\/]\.git[\\/]/,
  /[\\/]\.trae-cn[\\/]tmp[\\/]/,
  /[\\/]site-packages[\\/]/,  // playwright 驱动
  /[\\/]driver[\\/]package[\\/]bin[\\/]/,  // playwright
  // 部署打包产物 + 临时目录(防漏网)
  /[\\/]tmp[\\/]/,
  /[\\/]deploy[\\/]prod-bundle[\\/]/,
  /[\\/]\.trae-cn[\\/]/,
];

const violations = [];

function scan(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      scan(full);
    } else if (e.name.endsWith('.ps1')) {
      if (SKIP_PATH_PATTERNS.some(p => p.test(full))) continue;
      checkFile(full);
    }
  }
}

function checkFile(filePath) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return; // 读不到的跳过
  }
  // 只检查前 5 行
  const lines = content.split(/\r?\n/).slice(0, 5);
  const hasRequires7 = lines.some(l => /^\s*#requires\s+-Version\s+7\b/.test(l));
  if (!hasRequires7) {
    violations.push(relative(ROOT, filePath));
  }
}

scan(ROOT);

if (violations.length === 0) {
  console.log('[OK] all project .ps1 files declare `#requires -Version 7`');
  process.exit(0);
}

console.error(`[FAIL] ${violations.length} .ps1 file(s) missing \`#requires -Version 7\`:`);
for (const v of violations) {
  console.error(`  - ${v}`);
}
console.error('');
console.error('Fix: add the following as the FIRST line of each file:');
console.error('  #requires -Version 7');
console.error('');
console.error('Reason: PowerShell 5.1 (powershell.exe) is EOL and has known');
console.error('encoding/parsing bugs. Use PowerShell 7+ (pwsh.exe) only.');
process.exit(1);
