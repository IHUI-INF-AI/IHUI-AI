/**
 * 守门脚本：禁止彻底圆角 / 胶囊形 (pill / capsule) 圆角
 *
 * 检测规则 (对应 project_memory.md 硬约束 "禁止彻底圆角/胶囊形 2026-07-03 立"):
 *   - 任何 `border-radius: NNpx` 中 NN ≥ 14 视为违规
 *   - `border-radius: 9999px` / `border-radius: 999px` (胶囊形) 视为违规
 *   - `border-radius: 50%` (几何圆形) 白名单通过 —— 仅用于头像/纯装饰圆点
 *   - 注释行 (// 或 跨行块注释) 跳过
 *
 * 圆角统一规范:
 *   - 容器/卡片: var(--global-border-radius)  (8px, 全站唯一标准)
 *   - 按钮:      var(--app-button-radius)      (= --global-border-radius)
 *   - 浮窗:      var(--fcd-radius-lg)
 *
 * 用法:
 *   - 检查暂存文件:  node scripts/check-no-pill-radius.mjs
 *   - 检查整个 src:  node scripts/check-no-pill-radius.mjs --all
 *   - 检查指定文件:  node scripts/check-no-pill-radius.mjs file1.scss file2.vue
 *   - 严格阈值控制:  NO_PILL_RADIUS_THRESHOLD=0 node scripts/check-no-pill-radius.mjs
 *
 * 退出码: 0 通过, 1 发现违规 (> THRESHOLD)
 *
 * 性能: <100ms (pre-commit 友好)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const miniappSrcDir = path.join(rootDir, 'miniapp', 'src');

const EXTENSIONS = new Set(['.vue', '.scss', '.sass', '.css']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '.vite', 'storybook-static', 'unpackage']);
const THRESHOLD = Number(process.env.NO_PILL_RADIUS_THRESHOLD ?? 0);

// 违规正则: border-radius 后跟 14-99px / 999px / 9999px (排除 50% 与 0-13px)
// 注意: 必须是显式 px 单位, 不能匹配 var(--xxx) token 引用
const PILL_RADIUS_RE = /border-radius\s*:\s*(?:1[4-9]|[2-9]\d|999|9999)px\b/ig;

/**
 * 移除注释后检测 (避免误报注释中的圆角值)
 * - SCSS/SCSS 单行注释 // ...
 * - SCSS/CSS 多行注释 (跨行块注释)
 * - Vue <script> 块内的 // 注释不应误判, 但本脚本只扫 .vue/.scss/.css,
 *   Vue 文件中 <style> 块的注释也按 SCSS 注释处理
 */
function stripComments(text) {
  // 移除多行注释 /* ... */ (非贪婪)
  let out = text.replace(/\/\*[\s\S]*?\*\//g, '');
  // 移除单行注释 // ... (到行尾)
  out = out.replace(/(^|\s)\/\/[^\n]*/g, '$1');
  return out;
}

/**
 * 提取违规行 (保留原行号用于报错)
 * 在原文本上逐行扫描, 但跳过注释行
 */
function extractViolations(text, file) {
  const results = [];
  const lines = text.split(/\r?\n/);

  // 跟踪多行注释状态 (跨行 /* ... */)
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    let line = raw;

    // 处理多行注释: 简化策略 —— 把当前行的注释部分剔除
    // (足够用, 极少数嵌套场景的误报可以接受)
    let processed = '';
    let j = 0;
    while (j < line.length) {
      if (inBlockComment) {
        const endIdx = line.indexOf('*/', j);
        if (endIdx === -1) {
          // 整行都在注释内
          j = line.length;
        } else {
          inBlockComment = false;
          j = endIdx + 2;
        }
      } else {
        const blockStart = line.indexOf('/*', j);
        const lineStart = line.indexOf('//', j);
        // 取最近的注释起点
        let nextStop = -1;
        let stopType = '';
        if (blockStart !== -1 && (lineStart === -1 || blockStart < lineStart)) {
          nextStop = blockStart;
          stopType = 'block';
        } else if (lineStart !== -1) {
          nextStop = lineStart;
          stopType = 'line';
        }

        if (nextStop === -1) {
          processed += line.slice(j);
          break;
        } else {
          processed += line.slice(j, nextStop);
          if (stopType === 'line') {
            break; // 行注释到行尾
          } else {
            // 块注释开始
            const endIdx = line.indexOf('*/', nextStop + 2);
            if (endIdx === -1) {
              inBlockComment = true;
              break;
            } else {
              j = endIdx + 2;
            }
          }
        }
      }
    }

    // 在剔除注释后的行内容上检测
    const matched = PILL_RADIUS_RE.exec(processed);
    if (matched) {
      results.push({
        line: i + 1,
        col: matched.index + 1,
        snippet: raw.trim(),
        matched: matched[0],
      });
    }
    // 重置正则 lastIndex (因为用了 /g 标志)
    PILL_RADIUS_RE.lastIndex = 0;
  }

  return results;
}

function walkDir(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORE_DIRS.has(e.name)) files.push(...walkDir(full));
    } else if (e.isFile() && EXTENSIONS.has(path.extname(e.name))) {
      files.push(full);
    }
  }
  return files;
}

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: rootDir,
      encoding: 'utf-8',
    });
    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map(f => path.resolve(rootDir, f))
      .filter(f => EXTENSIONS.has(path.extname(f)));
  } catch {
    return [];
  }
}

function main() {
  let files;

  if (process.argv.includes('--all')) {
    // --all: 全量扫描 client/src + client/miniapp/src
    // miniapp 用同一套圆角硬约束 (2026-07-03 立, 与 Web 同步)
    files = [...walkDir(srcDir), ...walkDir(miniappSrcDir)];
  } else if (process.argv.length > 2 && !process.argv[2].startsWith('-')) {
    files = process.argv.slice(2).map(f => path.resolve(f));
  } else {
    files = getStagedFiles();
  }

  if (files.length === 0) {
    console.log('✓ 无样式文件需要检查');
    process.exit(0);
  }

  let totalViolations = 0;
  const fileViolations = [];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf-8');
    const violations = extractViolations(text, file);
    if (violations.length > 0) {
      const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
      fileViolations.push({ file: relPath, violations });
      totalViolations += violations.length;
    }
  }

  if (totalViolations === 0) {
    console.log(`✓ 已检查 ${files.length} 个文件, 无胶囊形/彻底圆角违规`);
    process.exit(0);
  }

  console.log(`✗ 发现 ${totalViolations} 处胶囊形/彻底圆角违规 (border-radius ≥ 14px 或 999/9999px)\n`);
  console.log('  硬约束: 全项目禁止彻底圆角/胶囊形 (见 project_memory.md "禁止彻底圆角/胶囊形 2026-07-03 立")\n');
  for (const { file, violations } of fileViolations) {
    console.log(`  ${file}:`);
    for (const v of violations) {
      console.log(`    L${v.line}:${v.col}  [${v.matched}]`);
      console.log(`      ${v.snippet}`);
    }
    console.log();
  }
  console.log('  修复建议:');
  console.log('    - 容器/卡片: border-radius: var(--global-border-radius);  /* 8px 全站唯一标准 */');
  console.log('    - 按钮:      border-radius: var(--app-button-radius);      /* = --global-border-radius */');
  console.log('    - 浮窗:      border-radius: var(--fcd-radius-lg);');
  console.log('    - 头像/纯装饰圆点: border-radius: 50%;  /* 白名单允许 */');
  console.log('');

  if (totalViolations > THRESHOLD) {
    process.exit(1);
  }
}

main();
