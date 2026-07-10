/**
 * 快速检测暂存文件中的高特异性 CSS 选择器（不启动浏览器）
 *
 * 检测逻辑：分析 SCSS/Vue/CSS 文件中的嵌套深度
 * - 统计每条选择器的类选择器嵌套层数
 * - :where() 内的选择器不计入特异性
 * - :not() / :is() / :has() 内的选择器计入特异性
 * - 伪元素（::xxx）不计入，伪类（:xxx）不计入
 * - 4 类及以上嵌套属于高特异性，需要优化
 *
 * 用法：
 *   - 检查暂存文件：node scripts/check-high-specificity-staged.mjs
 *   - 检查指定文件：node scripts/check-high-specificity-staged.mjs file1.scss file2.vue
 *   - 检查整个 src 目录：node scripts/check-high-specificity-staged.mjs --all
 *
 * 退出码：0 通过，1 存在高特异性选择器
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

const EXTENSIONS = new Set(['.vue', '.scss', '.sass', '.css']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '.vite']);
const THRESHOLD = Number(process.env.HIGH_SPECIFICITY_THRESHOLD ?? 0);

/**
 * 计算选择器的类选择器嵌套层数
 * - :where() 内的选择器不计入特异性（移除）
 * - :not() / :is() / :has() 内的选择器计入特异性（保留）
 * - 伪元素（::xxx）和伪类（:xxx）不计入（移除）
 * - :deep() 内的选择器单独计算（Vue 编译后会扁平化）
 * - 同一元素的多个类（如 .a.b.c）算作 1 个层级（因为它们作用于同一元素）
 * - 逗号分隔的多选择器，取最大值
 *
 * 返回：后代组合器层级数（即 .a .b .c .d 这种后代选择器的深度）
 */
function classSpec(sel) {
  // 按逗号分隔，逐个计算取最大值
  const parts = sel.split(',');
  let max = 0;
  for (const part of parts) {
    let s = part.trim();
    // 移除 :where() 内容（特异性为 0）
    s = s.replace(/:where\([^)]*\)/g, '');
    // 移除伪元素 ::xxx
    s = s.replace(/::[a-zA-Z-]+/g, '');
    // 展开 :not() / :is() / :has() 内的内容（计入特异性）
    s = s.replace(/:not\(([^)]*)\)/g, '$1');
    s = s.replace(/:is\(([^)]*)\)/g, '$1');
    s = s.replace(/:has\(([^)]*)\)/g, '$1');
    // 处理 :deep() - Vue 编译后 :deep(.xxx) 变成 [data-v-xxx] .xxx
    // :deep() 内的选择器保留，:deep() 本身替换为空格
    s = s.replace(/:deep\(([^)]*)\)/g, ' $1 ');
    // 移除其他伪类 :xxx（但保留属性选择器 [xxx]）
    s = s.replace(/:[a-zA-Z-]+/g, '');

    // 按后代组合器（空格）分隔，统计有类选择器的层级数
    // 注意：> + ~ 等子代组合器也算后代层级
    const tokens = s.split(/[\s>+~]+/).filter(Boolean);
    let depth = 0;
    for (const token of tokens) {
      // 如果这个 token 包含类选择器（.xxx），算作 1 个层级
      // 同一元素的多个类（如 .a.b.c）算作 1 个层级
      if (/\.[a-zA-Z_-][\w-]*/.test(token)) {
        depth++;
      }
    }
    if (depth > max) max = depth;
  }
  return max;
}

/**
 * 从 SCSS 源码中提取所有选择器及其嵌套深度
 * 返回 [{ selector, line, depth }]
 */
function extractSelectors(text, filePath) {
  const lines = text.split(/\r?\n/);
  const results = [];
  const isVue = filePath.endsWith('.vue');

  // 跟踪 SCSS 嵌套栈：[{ selector, indent }]
  const stack = [];
  let inStyle = !isVue;
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Vue 文件：只在 <style> 标签内检查
    if (isVue) {
      if (trimmed.startsWith('<style')) inStyle = true;
      if (trimmed.startsWith('</style>')) { inStyle = false; continue; }
      if (!inStyle) continue;
    }

    // 跳过注释行
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      continue;
    }
    if (trimmed.startsWith('//')) continue;

    // 计算缩进（空格数）
    const indent = line.length - line.trimStart().length;

    // 弹出栈中缩进大于等于当前的项
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    // 检测是否是选择器行（以 { 结尾，或包含选择器）
    // 排除纯属性声明（包含 : 且不以 & 开头，且不包含 {）
    if (trimmed.endsWith('{') && !trimmed.startsWith('@') && !trimmed.startsWith('$')) {
      // 提取选择器部分（去掉末尾的 {）
      let selectorPart = trimmed.slice(0, -1).trim();
      // 处理 & 父选择器引用
      if (selectorPart.startsWith('&')) {
        selectorPart = selectorPart.slice(1).trim();
        // & 后面可能直接跟类名或伪类
      }

      // 构建完整选择器（栈中的选择器 + 当前选择器）
      const parentSelectors = stack.map(s => s.selector).filter(Boolean);
      const fullSelector = [...parentSelectors, selectorPart].join(' ');

      // 计算类选择器嵌套层数
      const depth = classSpec(fullSelector);

      if (depth > 3) {
        results.push({
          selector: fullSelector,
          line: i + 1,
          depth,
        });
      }

      // 压入栈
      stack.push({ selector: selectorPart, indent });
    } else if (trimmed === '}') {
      // 弹出栈
      if (stack.length > 0) stack.pop();
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
    // 检查整个 src 目录
    files = walkDir(srcDir);
  } else if (process.argv.length > 2 && !process.argv[2].startsWith('-')) {
    // 检查指定文件
    files = process.argv.slice(2).map(f => path.resolve(f));
  } else {
    // 检查暂存文件
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
    const violations = extractSelectors(text, file);
    if (violations.length > 0) {
      const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
      fileViolations.push({ file: relPath, violations });
      totalViolations += violations.length;
    }
  }

  if (totalViolations === 0) {
    console.log(`✓ 已检查 ${files.length} 个文件，无高特异性选择器`);
    process.exit(0);
  }

  console.log(`✗ 发现 ${totalViolations} 个高特异性选择器（4 类以上嵌套）\n`);
  for (const { file, violations } of fileViolations) {
    console.log(`  ${file}:`);
    for (const v of violations) {
      console.log(`    第 ${v.line} 行 (嵌套 ${v.depth} 类): ${v.selector}`);
    }
    console.log();
  }
  console.log('提示：用 :where() 包裹选择器前缀，使类选择器嵌套层数不超过 3 层');
  console.log('示例：.parent .child .grandchild .great { }  →  :where(.parent) .child .grandchild .great { }');
  console.log('');

  if (totalViolations > THRESHOLD) {
    process.exit(1);
  }
}

main();
