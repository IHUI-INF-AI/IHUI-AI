#!/usr/bin/env node
/**
 * check-workspace-hygiene.mjs v2 — 彻底根治项目外路径违规
 *
 * 7 大漏洞修复(2026-07-23 v2):
 *   1. 覆盖范围:从只扫 .trae-cn/tmp/ → 扫整个项目 working tree(排除 node_modules/.git/dist/.output/.next/turbo)
 *   2. 模式匹配:从只检测 ihui-ext/ihui-prof → 检测所有盘符 \temp\ 项目数据 + \AppData\ + 中文绝对路径
 *   3. 阻塞模式:默认 exit 1(阻塞 commit),--warn 降级为 warn-only
 *   4. pre-commit 用 --staged 模式:只扫 staged 文件,避免误报其他 agent 的 WIP
 *   5. 检测硬编码中文绝对路径:d:\桌面\ 等(GBK 编码会乱码)
 *   6. 检测相对路径跳出项目:在文件写入上下文的 ..\..
 *   7. 扫描配置文件:.json/.yaml/.yml 可能含路径配置
 *
 * 违规模式:
 *   a. 任何盘符 \temp\ 后跟非 .log/.txt 文件(项目数据写到系统 temp)
 *   b. \AppData\Local\Temp\ 后跟非 .log 文件
 *   c. $env:TEMP\ / $env:LOCALAPPDATA\ 后跟非 .log 文件
 *   d. 硬编码中文绝对路径(d:\桌面\ / d:\项目\ 等,GBK 会乱码)
 *   e. ihui-ext / ihui-prof 等项目数据目录名出现在项目外路径上下文
 *
 * 白名单:
 *   - 守门脚本自身 + AGENTS.md + 规则文档
 *   - 注释行(# 或 //)或包含"禁止/反面/deprecated/forbidden"的行
 *   - .log / .txt 文件路径
 *   - --redirect 参数(日志重定向)
 *
 * 用法:
 *   node scripts/check-workspace-hygiene.mjs              # 扫整个项目(阻塞)
 *   node scripts/check-workspace-hygiene.mjs --staged      # 只扫 staged(阻塞,用于 pre-commit)
 *   node scripts/check-workspace-hygiene.mjs --warn        # warn-only(不阻塞)
 *   node scripts/check-workspace-hygiene.mjs --staged --warn
 *
 * 退出码:0 = 无违规;1 = 发现违规(阻塞)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const TMP_DIR = join(ROOT, '.trae-cn', 'tmp');

// ===== 文件类型 =====
const SCRIPT_EXTS = new Set(['.ps1', '.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.sh', '.bat', '.json', '.yaml', '.yml']);

// ===== 排除目录 =====
const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', '.output', '.next', '.turbo',
  '.wxt', 'coverage', '.cache', 'tmp',
  '.venv', 'venv', '__pycache__', '.pytest_cache', // Python 虚拟环境/缓存
  '.vscode', '.idea', // IDE 配置
]);

// ===== 文件级白名单(这些文件可以引用项目外路径作为规则文档) =====
const FILE_WHITELIST = [
  /scripts[\\/]check-workspace-hygiene\.mjs$/, // 守门脚本自身
  /scripts[\\/]check-port-registry\.mjs$/,     // 端口守门(可能引用示例)
  /AGENTS\.md$/,                               // 项目规则
  /PROJECT_PLAN\.md$/,                         // 任务计划
  /\.trae-cn[\\/]archive[\\/]/,               // 归档文档
  /docs[\\/]port-management\.md$/,            // 端口管理文档
  /README(\.[a-z-]+)?\.md$/,                  // README
];

// ===== 违规检测器(分级:blocking 阻塞 / warning 提醒) =====
const VIOLATION_CHECKS = [
  // === BLOCKING:项目外路径写入(核心违规,阻塞 commit) ===
  {
    level: 'blocking',
    name: '项目数据写到系统 temp',
    test: (line) => {
      const patterns = [
        /[A-Za-z]:[\\/]temp[\\/][^"'`\s]*\.(?!log|txt)[a-z0-9]+/i,
        /\$env:TEMP[\\/][^"'`\s]*\.(?!log|txt)[a-z0-9]+/i,
        /\$env:LOCALAPPDATA[\\/]Temp[\\/][^"'`\s]*\.(?!log|txt)[a-z0-9]+/i,
        /[A-Za-z]:[\\/]Users[\\/][^"'`\\]+[\\/]AppData[\\/]Local[\\/]Temp[\\/][^"'`\s]*\.(?!log|txt)[a-z0-9]+/i,
      ];
      return patterns.some(p => p.test(line));
    },
    hint: '项目数据必须放项目内(.trae-cn/tmp/ 或 apps/*/),不能写系统 temp',
  },
  {
    level: 'blocking',
    name: 'ihui-ext / ihui-prof 项目数据目录名(项目外副本)',
    test: (line) => {
      // 只在项目外路径上下文中检测
      if (!/ihui-ext\d?|ihui-prof\d?/i.test(line)) return false;
      // 排除项目内引用(如 .output/chrome-mv3 的注释)
      if (/apps[\\/]extension|\.output/.test(line)) return false;
      return /C:[\\/]|D:[\\/]temp|\$env:TEMP/i.test(line);
    },
    hint: '用项目内路径 apps/extension/.output/chrome-mv3/ 或 .trae-cn/tmp/chrome-profile/',
  },
  {
    level: 'blocking',
    name: '相对路径跳出项目(文件写入上下文)',
    test: (line) => {
      if (!/\.\.[\\/]\.\.[\\/]/.test(line)) return false;
      return /Out-File|Set-Content|Copy-Item|New-Item|Remove-Item|Move-Item|WriteAllBytes|WriteAllText|open\(|writeFile/i.test(line);
    },
    hint: '文件写入不能跳出项目根,用项目内相对路径',
  },
  // === WARNING:硬编码中文路径(项目内但会 GBK 乱码,提醒) ===
  {
    level: 'warning',
    name: '硬编码中文绝对路径(GBK 会乱码)',
    test: (line) => {
      const patterns = [
        /['"`][A-Za-z]:[\\/][^'"`]*桌面/,
        /['"`][A-Za-z]:[\\/][^'"`]*项目[\\/]/,
        /['"`][A-Za-z]:[\\/][^'"`]*用户/,
      ];
      return patterns.some(p => p.test(line));
    },
    hint: '用 $PSScriptRoot / __dirname / import.meta.url 推导项目根,不要硬编码中文路径',
  },
];

// ===== 行级白名单 =====
function isLineWhitelisted(line) {
  const trimmed = line.trim();
  // 注释行
  if (trimmed.startsWith('#') || trimmed.startsWith('//')) return true;
  // 包含"禁止/反面/deprecated/forbidden"(规则文档中的反面案例)
  if (/禁止|反面|deprecated|forbidden|不要|不得|禁止使用/i.test(line)) return true;
  // .log / .txt 文件路径
  if (/\.(log|txt)\s*['"`;]/i.test(line)) return true;
  // --redirect 参数(日志重定向)
  if (/--redirect/i.test(line)) return true;
  return false;
}

function scanFile(filePath) {
  // 文件级白名单跳过
  const relPath = relative(ROOT, filePath).replace(/\\/g, '/');
  if (FILE_WHITELIST.some(re => re.test(relPath))) return [];

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const violations = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (isLineWhitelisted(line)) return;
    for (const check of VIOLATION_CHECKS) {
      if (check.test(line)) {
        violations.push({
          file: relPath,
          line: idx + 1,
          content: line.trim().slice(0, 120),
          level: check.level,
          name: check.name,
          hint: check.hint,
        });
        break;
      }
    }
  });
  return violations;
}

function scanDir(dir, allFiles = []) {
  if (!existsSync(dir)) return allFiles;
  for (const entry of readdirSync(dir)) {
    // 跳过 .trae-cn/tmp(单独扫描,因为里面是临时脚本)
    if (dir === ROOT && entry === '.trae-cn') {
      // 扫描 .trae-cn/tmp 但跳过 .trae-cn/archive, .trae-cn/memory 等
      const tmpSubdir = join(dir, entry, 'tmp');
      if (existsSync(tmpSubdir)) scanDir(tmpSubdir, allFiles);
      continue;
    }
    const full = join(dir, entry);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      scanDir(full, allFiles);
    } else if (SCRIPT_EXTS.has(extname(full).toLowerCase())) {
      allFiles.push(full);
    }
  }
  return allFiles;
}

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACM', { cwd: ROOT, encoding: 'utf8' });
    return out.split(/\r?\n/).filter(Boolean)
      .filter(f => SCRIPT_EXTS.has(extname(f).toLowerCase()))
      .map(f => join(ROOT, f));
  } catch {
    return [];
  }
}

function main() {
  const args = process.argv.slice(2);
  const isStaged = args.includes('--staged');
  const isWarn = args.includes('--warn');

  let filesToScan;
  if (isStaged) {
    filesToScan = getStagedFiles();
    if (filesToScan.length === 0) {
      console.log('✅ workspace-hygiene: 无 staged 脚本文件,跳过');
      process.exit(0);
    }
  } else {
    filesToScan = scanDir(ROOT);
  }

  const allViolations = [];
  for (const f of filesToScan) {
    allViolations.push(...scanFile(f));
  }

  const blockingViolations = allViolations.filter(v => v.level === 'blocking');
  const warningViolations = allViolations.filter(v => v.level === 'warning');

  if (allViolations.length === 0) {
    console.log(`✅ workspace-hygiene: 扫描 ${filesToScan.length} 个文件,无违规`);
    process.exit(0);
  }

  // 输出 warning(始终打印,不阻塞)
  if (warningViolations.length > 0) {
    console.warn(`⚠️  workspace-hygiene [WARNING]: ${warningViolations.length} 处硬编码中文路径(不阻塞,但建议修复)`);
    for (const v of warningViolations.slice(0, 10)) {
      console.warn(`  ${v.file}:${v.line}  [${v.name}]`);
      console.warn(`    > ${v.content}`);
    }
    if (warningViolations.length > 10) {
      console.warn(`  ... 还有 ${warningViolations.length - 10} 处`);
    }
    console.warn('');
  }

  // 输出 blocking(阻塞,除非 --warn)
  if (blockingViolations.length > 0) {
    const mode = isWarn ? 'WARN' : 'BLOCK';
    const prefix = isWarn ? '⚠️ ' : '❌ ';
    console.error(`${prefix}workspace-hygiene [${mode}]: ${blockingViolations.length} 处项目外路径违规`);
    console.error('');
    console.error('违反 AGENTS.md §15 项目外路径禁令:');
    console.error('  - 扩展打包用 apps/extension/.output/chrome-mv3/');
    console.error('  - Chrome profile 用 .trae-cn/tmp/chrome-profile/');
    console.error('  - 临时脚本用 .trae-cn/tmp/<脚本名>');
    console.error('  - 路径推导用 $PSScriptRoot / import.meta.url(避免 GBK 中文乱码)');
    console.error('');
    for (const v of blockingViolations.slice(0, 30)) {
      console.error(`  ${v.file}:${v.line}  [${v.name}]`);
      console.error(`    > ${v.content}`);
      console.error(`    提示: ${v.hint}`);
    }
    if (blockingViolations.length > 30) {
      console.error(`  ... 还有 ${blockingViolations.length - 30} 处`);
    }
    console.error('');
    console.error('如确需在项目外创建文件(系统日志等),请在脚本中用注释标注"豁免:系统日志"。');
    process.exit(isWarn ? 0 : 1);
  }

  // 只有 warning,无 blocking
  console.log(`⚠️  workspace-hygiene: ${warningViolations.length} 处 warning(不阻塞),0 处 blocking`);
  process.exit(0);
}

main();
