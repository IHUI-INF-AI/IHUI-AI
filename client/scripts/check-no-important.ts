/**
 * 检查项目中是否新增了 !important 或高特异性选择器
 * 规范（强制）：不允许使用 !important，不允许使用高特异性选择器。
 * 本脚本检测：1) !important  2) 同名单类重复（.foo.foo）
 * 其余高特异性（如长链、未用 :where() 的 html.dark body）请遵守 .cursorrules 与 docs/IMPORTANT_AND_SPECIFICITY_AUDIT.md
 *
 * 用法：npm run check:no-important
 * 退出码：0 通过，1 存在违规
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

const EXTENSIONS = ['.vue', '.scss', '.sass', '.css'];
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage']);

interface Violation {
  file: string;
  line: number;
  content: string;
  type: '!important' | 'double-class';
}

function walkDir(dir: string, extensions: Set<string>): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORE_DIRS.has(e.name)) files.push(...walkDir(full, extensions));
    } else if (e.isFile() && extensions.has(path.extname(e.name))) {
      files.push(full);
    }
  }
  return files;
}

function scanFile(filePath: string): Violation[] {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/);
  const violations: Violation[] = [];
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const isVue = filePath.endsWith('.vue');
  let inStyle = !isVue; // 非 .vue 则整文件都算「样式」；.vue 需在 <style> 内才检查
  let inBlockComment = false; // 跟踪多行注释状态

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isVue) {
      if (trimmed.startsWith('<style')) inStyle = true;
      else if (trimmed.startsWith('</style>')) inStyle = false;
      if (!inStyle) continue;
    }

    // 跟踪多行注释状态：/* ... */ 可跨行
    // 先处理当前行的注释状态
    let lineForCheck = line;
    if (inBlockComment) {
      // 仍在多行注释中，找到 */ 结束位置
      const endIdx = lineForCheck.indexOf('*/');
      if (endIdx === -1) {
        // 整行都在注释中，跳过
        continue;
      } else {
        // 注释在本行结束，移除注释部分
        lineForCheck = lineForCheck.slice(endIdx + 2);
        inBlockComment = false;
      }
    }

    // 检查本行是否开启新的多行注释
    // 需要处理一行内多个 /* ... */ 以及未闭合的 /*
    let processedLine = '';
    let idx = 0;
    while (idx < lineForCheck.length) {
      const ch = lineForCheck[idx];
      if (ch === '/' && lineForCheck[idx + 1] === '*') {
        // 找到 /* 开始
        const endIdx2 = lineForCheck.indexOf('*/', idx + 2);
        if (endIdx2 === -1) {
          // 多行注释开始，后续内容都是注释
          inBlockComment = true;
          break;
        } else {
          // 单行内的 /* ... */ 注释，跳过
          idx = endIdx2 + 2;
          continue;
        }
      }
      if (ch === '/' && lineForCheck[idx + 1] === '/') {
        // // 行内注释，后续都是注释
        break;
      }
      processedLine += ch;
      idx++;
    }

    // 跳过纯注释行（处理后为空）
    if (processedLine.trim() === '') continue;

    // codeOnly 是移除所有注释后的纯代码
    const codeOnly = processedLine;

    // 跳过显式豁免的代码块：行内包含 /* no-important-exempt: 原因 */ 的 !important 视为合法
    // 合法场景：覆盖 Vue scoped 属性选择器 [data-v-xxx]、覆盖第三方组件库等
    if (/!\s*important/.test(codeOnly) && /\/\*\s*no-important-exempt\s*:/.test(line)) continue;

    if (/!\s*important/.test(codeOnly)) {
      violations.push({
        file: relPath,
        line: i + 1,
        content: trimmed.slice(0, 100),
        type: '!important',
      });
    }

    // 高特异性：仅「完整同名单类」重复（.foo.foo 或 .foo .foo），排除 .sl .sl-plan 等前缀误报
    const doubleClassRe = /\.([a-zA-Z_-][\w-]*)\s*\.\1(?![-_])/;
    if (doubleClassRe.test(codeOnly) && !trimmed.startsWith('//') && !/\/\*\s*no-important-exempt\s*:/.test(line)) {
      violations.push({
        file: relPath,
        line: i + 1,
        content: trimmed.slice(0, 100),
        type: 'double-class',
      });
    }
  }

  return violations;
}

function main(): void {
  const extSet = new Set(EXTENSIONS);
  const files = walkDir(srcDir, extSet);
  const allViolations: Violation[] = [];

  for (const f of files) {
    allViolations.push(...scanFile(f));
  }

  if (allViolations.length === 0) {
    console.log('check:no-important — 通过，未发现 !important 或 .class.class 高特异性选择器。');
    process.exit(0);
    return;
  }

  const byType = { '!important': 0, 'double-class': 0 };
  for (const v of allViolations) byType[v.type]++;

  // 加载历史 baseline（若存在），仅把"新增违规"视为 fail
  // 用法：CHECK_NO_IMPORTANT_BASELINE=1 npm run check:no-important
  const useBaseline = process.env.CHECK_NO_IMPORTANT_BASELINE === '1';
  const baselinePath = path.join(__dirname, 'no-important-baseline.json');

  if (useBaseline && fs.existsSync(baselinePath)) {
    const baseline: { violations?: { file: string; line: number; type: string }[] } = JSON.parse(
      fs.readFileSync(baselinePath, 'utf-8')
    );
    const baselineKeys = new Set(
      (baseline.violations || []).map((v) => `${v.file}:${v.line}:${v.type}`)
    );
    const currentKeys = new Set(
      allViolations.map((v) => `${v.file}:${v.line}:${v.type}`)
    );
    const newViolations = allViolations.filter(
      (v) => !baselineKeys.has(`${v.file}:${v.line}:${v.type}`)
    );
    const removed = [...baselineKeys].filter((k) => !currentKeys.has(k));

    console.log(
      `\ncheck:no-important（baseline 模式）\n  当前: ${allViolations.length} 处（!important: ${byType['!important']}, 双类: ${byType['double-class']}）`
    );
    console.log(`  baseline: ${baselineKeys.size} 处`);
    console.log(`  新增: ${newViolations.length} 处，清理: ${removed.length} 处\n`);

    if (newViolations.length > 0) {
      console.error('❌ 新增违规（不允许）：');
      for (const v of newViolations) {
        console.error(`  ${v.file}:${v.line}  [${v.type}]`);
        console.error(`    ${v.content}`);
      }
      process.exit(1);
    } else {
      console.log('✅ 无新增违规（baseline 模式）');
      process.exit(0);
    }
  }

  console.error('\n❌ 发现违反「禁止 !important / 高特异性」规范的用法：\n');
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  [${v.type}]`);
    console.error(`    ${v.content}\n`);
  }
  console.error(
    `合计: ${allViolations.length} 处（!important: ${byType['!important']}, 双类: ${byType['double-class']}）`
  );
  console.error(
    '\n规范说明见 .cursorrules「CSS 优先级规范」与 docs/IMPORTANT_AND_SPECIFICITY_AUDIT.md'
  );
  console.error(
    '\n提示：使用 CHECK_NO_IMPORTANT_BASELINE=1 启动 baseline 模式（仅检查新增违规）'
  );
  process.exit(1);
}

main();
