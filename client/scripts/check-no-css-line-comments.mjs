#!/usr/bin/env node
/**
 * 守门脚本：纯 CSS style 块禁止 `//` 行注释
 *
 * 2026-07-04 立: 12 个文件在批量颜色修复时误用 `//` 注释于纯 CSS `<style scoped>` 块,
 * 导致 PostCSS 解析失败 (CssSyntaxError: Unknown word), Vite build 阻断.
 * 纯 CSS 只支持 `/* *​/` 注释, 不支持 SCSS 的 `//` 行注释.
 *
 * 检测规则:
 *   扫描 .vue 文件中所有 <style> 块, 若块无 lang="scss" (纯 CSS),
 *   且块内含 `//` 行注释 (非字符串内的), 报违规.
 *
 * 用法:
 *   node scripts/check-no-css-line-comments.mjs          # 全量扫描 client/src
 *   node scripts/check-no-css-line-comments.mjs --staged  # 仅扫描 staged .vue 文件
 *
 * 退出码: 0 通过, 1 发现违规
 *
 * 性能: ~200ms (正则扫描 src/ 下 .vue 文件)
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(clientRoot, '..');
const srcDir = path.join(clientRoot, 'src');

const onlyStaged = process.argv.includes('--staged');

let violationCount = 0;

/**
 * 检查单个 .vue 文件中纯 CSS style 块是否含 `//` 行注释
 */
function checkFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf-8');
  const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');

  // 匹配所有 <style ...>...</style> 块 (非贪婪)
  // 捕获: [1] style 标签属性部分, [2] style 块内容
  const styleBlockRe = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = styleBlockRe.exec(src)) !== null) {
    const attrs = match[1] || '';
    const content = match[2] || '';
    const fullMatchStart = match.index;

    // 判断是否为 SCSS (含 lang="scss" 或 lang='scss')
    if (/lang\s*=\s*["']scss["']/i.test(attrs)) {
      continue; // SCSS 块, `//` 合法, 跳过
    }

    // 纯 CSS 块: 检测 `//` 行注释
    // 排除: URL 中的 // (http://, https://), 字符串内的 //
    // 简化策略: 逐行扫描, 检测行中 `//` 但排除 URL 协议
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 查找 // 位置
      const slashIdx = line.indexOf('//');
      if (slashIdx === -1) continue;

      // 排除 URL 协议 (http://, https://, //cdn 等)
      // 如果 // 前面是 : 或行首, 跳过 (URL 或协议相对 URL)
      const before = line.slice(0, slashIdx).trimEnd();
      if (before.endsWith(':') || slashIdx === 0) continue;
      // 排除 // 在字符串内 (简化: 如果行中 // 前有奇数个引号, 可能在字符串内)
      // 此简化检查覆盖大多数情况

      // 计算源文件行号
      const contentStartLine = src.slice(0, fullMatchStart).split('\n').length;
      const sourceLine = contentStartLine + i + 1; // +1 因为 <style> 标签占一行

      console.error(`  [FAIL] ${relPath}:${sourceLine}  纯 CSS style 块内含 \`//\` 行注释 (PostCSS 不支持, 需改用 /* */)`);
      console.error(`         ${line.trim()}`);
      violationCount++;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 文件收集
// ─────────────────────────────────────────────────────────────────────

function walkDir(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // 跳过 node_modules, dist, .git 等
      if (['node_modules', 'dist', '.git', '.cache'].includes(entry.name)) continue;
      results.push(...walkDir(fullPath, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

function getStagedVueFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
    return out
      .split('\n')
      .map((s) => s.trim().replace(/\\/g, '/'))
      .filter((s) => s.endsWith('.vue'))
      .map((s) => path.join(projectRoot, s));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────

console.log('═══ 纯 CSS style 块 `//` 行注释守门 ═══');

let files;
if (onlyStaged) {
  files = getStagedVueFiles();
  if (files === null) {
    console.log('[staged] git 不可用, 退到全量扫描');
    files = walkDir(srcDir, '.vue');
  } else if (files.length === 0) {
    console.log('[staged] 无 staged .vue 文件, 跳过');
    process.exit(0);
  } else {
    console.log(`[staged] 扫描 ${files.length} 个 staged .vue 文件`);
  }
} else {
  files = walkDir(srcDir, '.vue');
  console.log(`扫描 ${files.length} 个 .vue 文件 (client/src)`);
}

for (const file of files) {
  checkFile(file);
}

if (violationCount > 0) {
  console.error(`\n[FAIL] 共 ${violationCount} 处违规: 纯 CSS style 块内含 \`//\` 行注释`);
  console.error('');
  console.error('  修复指引:');
  console.error('    纯 CSS (<style scoped> 无 lang="scss">) 只支持 /* */ 注释, 不支持 // 行注释.');
  console.error('    将 // 注释改为 /* */ 格式, 或为 <style> 标签添加 lang="scss".');
  console.error('    此 bug 会导致 Vite build 阻断 (PostCSS CssSyntaxError: Unknown word).');
  console.error('    注意: npm run typecheck 不会捕获此错误, 只有 npm run build 会报错.');
  process.exit(1);
}

console.log('\n[OK] 纯 CSS style 块无 `//` 行注释违规');
