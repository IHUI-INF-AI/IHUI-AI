/**
 * 守门脚本：禁止 var(--el-bg-color) / var(--el-bg-color-page) 用作文字色
 *
 * 检测规则 (对应 project_memory.md 硬约束 "背景 token 禁作文字色 2026-07-04 立"):
 *   - Pattern A (直接文字色): `color: var(--el-bg-color)` 或 `color: var(--el-bg-color-page)` 但非 `background-color:` / `border-color:` 等
 *   - Pattern B (自定义 *-color 属性): `--xxx-color: var(--el-bg-color)` 或 `--xxx-color: var(--el-bg-color-page)` (如 --question-color, --fcd-send-btn-color)
 *     —— 排除 `--el-bg-color:` / `--el-bg-color-page:` 自身的 token 重定义 (如 `--el-bg-color: var(--el-bg-color-page);` 是合法别名)
 *
 * 根因: var(--el-bg-color) 是背景 token (浅色=#f7f8fa / 暗色=#0d0d0d),
 *       var(--el-bg-color-page) 是页面背景 token (浅色=#fff / 暗色=#1a1a1a/#0d0d0d).
 *       误用作文字色时, 浅色模式下文字显示浅色 (在浅色背景下不可见),
 *       暗色模式下文字显示深色 (在暗色背景下不可见).
 *
 * 正确替换 token (按上下文背景):
 *   - 彩色/深色背景 (primary/success/danger/warning/black-80 等): var(--app-button-text-on-primary)  永定白字 #ffffff
 *   - amber/yellow 背景 (warning):                                #1a1a1a                              深字 (白字对比度失败)
 *   - 浅色/同 token 背景 (bg-color-page/fill-color/transparent):  var(--el-text-color-primary)        主题感知
 *   - 父级已设文字色:                                              inherit / currentColor / 删除 color 行
 *   - 反相配对 (bg=el-text-color-primary + color=el-bg-color):   重构为显式双模式 #1a1a1a/#ffffff + html.dark 反转
 *
 * 用法:
 *   - 检查暂存文件:  node scripts/check-no-bg-token-as-text-color.mjs
 *   - 检查整个 src:  node scripts/check-no-bg-token-as-text-color.mjs --all
 *   - 检查指定文件:  node scripts/check-no-bg-token-as-text-color.mjs file1.scss file2.vue
 *   - 严格阈值控制:  NO_BG_TOKEN_AS_TEXT_COLOR_THRESHOLD=0 node scripts/check-no-bg-token-as-text-color.mjs
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

const EXTENSIONS = new Set(['.vue', '.scss', '.sass', '.css', '.ts', '.js']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '.vite', 'storybook-static', 'unpackage']);
const THRESHOLD = Number(process.env.NO_BG_TOKEN_AS_TEXT_COLOR_THRESHOLD ?? 0);

// Pattern A: 直接文字色. `(^|[^-])` 排除 background-color:/border-color:/border-top-color: 等
//   匹配: `color: var(--el-bg-color)`, `color: var(--el-bg-color-page)`, `color:var(--el-bg-color) ;`
//   不匹配: `background-color: var(--el-bg-color)`, `--el-bg-color: var(...)`
//   2026-07-04 v2 扩展: 同时检测 var(--el-bg-color-page) (页面背景 token, 同类反主题 bug)
const TEXT_COLOR_RE = /(^|[^-])color\s*:\s*var\(--el-bg-color(?:-page)?\)\s*[;}]?/g;

// Pattern B: 自定义 *-color 属性引用 var(--el-bg-color) / var(--el-bg-color-page). 排除自身重定义.
//   匹配: `--question-color: var(--el-bg-color)`, `--fcd-send-btn-color: var(--el-bg-color-page)`
//   不匹配: `--el-bg-color: var(--el-bg-color-page)` (合法 token 别名)
//   假阳性排除 (在 isTextColorProperty 中过滤): 属性名含 bg/border/shadow/outline/background
//     —— 如 --ai-panel-bg-color, --pricing-card-border-hover-color, --el-tooltip-bg-color 是背景/边框色, 非文字色
const CUSTOM_PROP_COLOR_RE = /--(?!el-bg-color(?:-page)?\b)[\w-]*color\s*:\s*var\(--el-bg-color(?:-page)?\)\s*[;}]?/g;

/**
 * 判断自定义属性名是否为"文字色"属性 (而非背景/边框/阴影/轮廓色)
 * 文字色属性: --xxx-color, --xxx-text-color, --xxx-btn-color, --xxx-trigger-color 等
 * 非文字色 (排除): --xxx-bg-color, --xxx-border-color, --xxx-shadow-color, --xxx-outline-color, --xxx-background-color
 */
function isTextColorProperty(propName) {
  // propName 形如 "--question-color" 或 "--ai-panel-bg-color"
  const name = propName.toLowerCase();
  // 排除背景/边框/阴影/轮廓色属性
  if (/\b(bg|background)-?color\b/.test(name)) return false;
  if (/\bborder[\w-]*color\b/.test(name)) return false;
  if (/\bshadow[\w-]*color\b/.test(name)) return false;
  if (/\boutline[\w-]*color\b/.test(name)) return false;
  // 其余 *-color 属性视为文字色 (可能用作 color: var(--xxx-color))
  return true;
}

/**
 * 移除注释后检测 (避免误报注释中的 token 引用)
 * - SCSS/JS 单行注释 // ...
 * - SCSS/CSS/JS 多行注释 /* ... *\/
 */
function stripComments(text) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|\s)\/\/[^\n]*/g, '$1');
  return out;
}

/**
 * 提取违规行 (保留原行号用于报错)
 * 在原文本上逐行扫描, 但跳过注释行
 */
function extractViolations(text) {
  const results = [];
  const lines = text.split(/\r?\n/);

  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    let line = raw;

    // 处理多行注释: 把当前行的注释部分剔除
    let processed = '';
    let j = 0;
    while (j < line.length) {
      if (inBlockComment) {
        const endIdx = line.indexOf('*/', j);
        if (endIdx === -1) {
          j = line.length;
        } else {
          inBlockComment = false;
          j = endIdx + 2;
        }
      } else {
        const blockStart = line.indexOf('/*', j);
        const lineStart = line.indexOf('//', j);
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
            break;
          } else {
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

    // 在剔除注释后的行内容上检测两个 pattern
    const matches = [];
    let m;
    TEXT_COLOR_RE.lastIndex = 0;
    while ((m = TEXT_COLOR_RE.exec(processed)) !== null) {
      matches.push({ matched: m[0].trim(), type: 'text-color' });
    }
    CUSTOM_PROP_COLOR_RE.lastIndex = 0;
    while ((m = CUSTOM_PROP_COLOR_RE.exec(processed)) !== null) {
      // 提取属性名 (--xxx-color), 过滤掉背景/边框/阴影/轮廓色属性 (假阳性)
      const propNameMatch = m[0].match(/^--[\w-]*color/);
      const propName = propNameMatch ? propNameMatch[0] : '';
      if (propName && isTextColorProperty(propName)) {
        matches.push({ matched: m[0].trim(), type: 'custom-prop' });
      }
    }

    if (matches.length > 0) {
      for (const match of matches) {
        results.push({
          line: i + 1,
          snippet: raw.trim(),
          ...match,
        });
      }
    }
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
    files = [...walkDir(srcDir), ...walkDir(miniappSrcDir)];
  } else if (process.argv.length > 2 && !process.argv[2].startsWith('-')) {
    files = process.argv.slice(2).map(f => path.resolve(f));
  } else {
    files = getStagedFiles();
  }

  if (files.length === 0) {
    console.log('✓ 无样式/脚本文件需要检查');
    process.exit(0);
  }

  let totalViolations = 0;
  const fileViolations = [];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf-8');
    const violations = extractViolations(text);
    if (violations.length > 0) {
      const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
      fileViolations.push({ file: relPath, violations });
      totalViolations += violations.length;
    }
  }

  if (totalViolations === 0) {
    console.log(`✓ 已检查 ${files.length} 个文件, 无 var(--el-bg-color) / var(--el-bg-color-page) 文字色误用`);
    process.exit(0);
  }

  console.log(`✗ 发现 ${totalViolations} 处 var(--el-bg-color) / var(--el-bg-color-page) 用作文字色 (背景 token 误用)\n`);
  console.log('  硬约束: 背景token --el-bg-color / --el-bg-color-page 禁作文字色 (见 project_memory.md "背景 token 禁作文字色 2026-07-04 立")\n');
  console.log('  根因: var(--el-bg-color) 浅色=#f7f8fa/暗色=#0d0d0d, var(--el-bg-color-page) 浅色=#fff/暗色=#1a1a1a, 误作文字色 → 浅色背景不可见/暗色背景不可见\n');
  for (const { file, violations } of fileViolations) {
    console.log(`  ${file}:`);
    for (const v of violations) {
      console.log(`    L${v.line}  [${v.type}]  ${v.matched}`);
      console.log(`      ${v.snippet}`);
    }
    console.log();
  }
  console.log('  修复建议 (按上下文背景判断):');
  console.log('    - 彩色/深色背景 (primary/success/danger/warning/black-80): color: var(--app-button-text-on-primary);  /* 永定白字 #ffffff */');
  console.log('    - amber/yellow 背景 (warning 类):                          color: #1a1a1a;                                    /* 深字 (白字对比度失败) */');
  console.log('    - 浅色/同 token 背景 (bg-color-page/fill/transparent):    color: var(--el-text-color-primary);               /* 主题感知 */');
  console.log('    - 父级已设文字色:                                         color: inherit;  或删除 color 行');
  console.log('    - 反相配对 (bg=el-text-color-primary + color=el-bg-color): 重构为 #1a1a1a/#ffffff + html.dark 反转');
  console.log('');

  if (totalViolations > THRESHOLD) {
    process.exit(1);
  }
}

main();
