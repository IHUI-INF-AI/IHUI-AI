#!/usr/bin/env node
/**
 * check-workspace-hygiene.mjs
 *
 * 守门:检测 .trae-cn/tmp/ 下的脚本(.ps1/.py/.js/.mjs/.cjs/.ts)
 * 是否引用"项目外路径"作为项目数据存储位置。
 *
 * 触发场景:
 *   - AI 写诊断/验证脚本时硬编码 C:\temp\ihui-ext 等
 *   - 把构建产物复制到项目外
 *   - Chrome profile / 扩展打包路径放在项目外
 *
 * 设计哲学(2026-07-23 立):
 *   §15 工作区卫生规则原版只说"临时文件放 .trae-cn/tmp/",
 *   但没明确禁止项目数据(扩展打包/Chrome profile/构建副本)写到项目外,
 *   导致 AI 习惯性硬编码 C:\temp\ihui-ext2 等路径。
 *   本脚本从机制上根治:扫描 + 报告所有违规引用。
 *
 * 用法:
 *   node scripts/check-workspace-hygiene.mjs          # 扫描 .trae-cn/tmp/
 *   node scripts/check-workspace-hygiene.mjs --staged  # 扫描 staged 文件
 *
 * 退出码:
 *   0 = 无违规
 *   1 = 发现违规(阻塞,用于 pre-commit)
 *
 * 集成:.husky/pre-commit 第 24 项(warn-only,不阻塞 commit,只提醒)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const TMP_DIR = join(ROOT, '.trae-cn', 'tmp');

// 允许的项目外路径模式(系统级临时日志,不是项目数据)
const ALLOWED_EXTERNAL_PATTERNS = [
  /(?:^|["'`\s])(?:\$env:)?TEMP[\\/]debug\.log$/i, // 纯系统日志
  /(?:^|["'`\s])(?:\$env:)?TEMP[\\/]next-server.*\.log$/i,
];

// 违规模式:项目数据(扩展/profile/构建副本)被写到项目外
// 用字符串包含检测,避免反斜杠转义混乱
const VIOLATION_PATTERNS = [
  {
    test: s => /C:\\temp\\ihui/i.test(s) || /C:\\\\temp\\\\ihui/i.test(s),
    desc: 'C:\\temp\\ihui-* (扩展/profile 复制到项目外)',
  },
  {
    test: s => /ihui-ext\d?/i.test(s) || /ihui-prof\d?/i.test(s),
    desc: 'ihui-ext / ihui-prof 等项目数据目录名',
  },
  {
    test: s => /(?:LOCALAPPDATA|APPDATA)[\\/]Temp[\\/]ihui/i.test(s),
    desc: '$env:LOCALAPPDATA\\Temp\\ihui-* (项目数据写到用户 temp)',
  },
];

const SCRIPT_EXTS = new Set(['.ps1', '.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.sh', '.bat']);

function scanFile(filePath) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  const violations = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    // 跳过允许的日志模式
    if (ALLOWED_EXTERNAL_PATTERNS.some(p => p.test(line))) return;
    // 跳过注释行中提到的"反面案例"
    if (/反面案例|禁止|forbidden|deprecated/i.test(line)) return;
    for (const { test, desc } of VIOLATION_PATTERNS) {
      if (test(line)) {
        violations.push({
          file: relative(ROOT, filePath),
          line: idx + 1,
          content: line.trim().slice(0, 120),
          desc,
        });
        break;
      }
    }
  });
  return violations;
}

function scanDir(dir) {
  if (!existsSync(dir)) return [];
  const all = [];
  function walk(d) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const s = statSync(full);
      if (s.isDirectory()) {
        if (entry === 'node_modules' || entry === '.git') continue;
        walk(full);
      } else if (SCRIPT_EXTS.has(extname(full).toLowerCase())) {
        all.push(full);
      }
    }
  }
  walk(dir);
  return all;
}

function main() {
  const args = process.argv.slice(2);
  const isStaged = args.includes('--staged');

  let filesToScan = [];
  if (isStaged) {
    try {
      const out = execSync('git diff --cached --name-only --diff-filter=ACM', { cwd: ROOT, encoding: 'utf8' });
      filesToScan = out.split(/\r?\n/).filter(Boolean).filter(f => SCRIPT_EXTS.has(extname(f))).map(f => join(ROOT, f));
    } catch {
      console.warn('[workspace-hygiene] 无法获取 staged 文件,跳过');
      process.exit(0);
    }
  } else {
    filesToScan = scanDir(TMP_DIR);
  }

  const allViolations = [];
  for (const f of filesToScan) {
    allViolations.push(...scanFile(f));
  }

  if (allViolations.length === 0) {
    console.log('✅ workspace-hygiene: 无项目外路径违规');
    process.exit(0);
  }

  console.warn(`⚠️  workspace-hygiene: 检测到 ${allViolations.length} 处项目外路径引用`);
  console.warn('');
  console.warn('违反 AGENTS.md §15: 所有项目数据(扩展打包/Chrome profile/构建副本)必须在项目内:');
  console.warn('  - 扩展打包用 apps/extension/.output/chrome-mv3/');
  console.warn('  - 临时脚本用 .trae-cn/tmp/');
  console.warn('  - Chrome profile 用 .trae-cn/tmp/chrome-profile/');
  console.warn('');
  for (const v of allViolations.slice(0, 20)) {
    console.warn(`  ${v.file}:${v.line}  ${v.desc}`);
    console.warn(`    > ${v.content}`);
  }
  if (allViolations.length > 20) {
    console.warn(`  ... 还有 ${allViolations.length - 20} 处`);
  }
  console.warn('');
  console.warn('请改用项目内路径(用 $PSScriptRoot / __dirname / import.meta.url 推导项目根),不要硬编码 C:\\temp\\ 等。');

  // warn-only:不阻塞 commit,只提醒
  process.exit(0);
}

main();
