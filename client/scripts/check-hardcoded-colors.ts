/**
 * 检查项目中是否存在硬编码颜色值（未使用 CSS 变量 / design token）
 *
 * 规范：优先使用 _global-tokens.scss 中定义的 --app-* token，
 * 禁止在业务代码中硬编码 #fff / rgb() / hsl() 等颜色值。
 *
 * 用法：npm run check:colors
 * 退出码：0 通过，1 存在违规
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

const EXTENSIONS = ['.vue', '.scss', '.sass', '.css', '.ts', '.js'];
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'storybook-static']);
// 颜色定义源文件不算"硬编码"，它们是 token 的源头
const TOKEN_DEFINITION_FILES = new Set([
  '_global-tokens.scss',
  '_admin-dark-mode.scss',
  '_theme-presets.scss',
  '_header-actions.scss',
  '_table-responsive.scss',
]);
// 测试文件中的硬编码颜色通常是故意的，单独报告
const TEST_FILES = new Set([
  '__tests__',
  '.test.',
  '.spec.',
]);
// 内联 SVG 字符串中的颜色不算硬编码（它们是静态 SVG 内容）
const INLINE_SVG_FILES = new Set([
  'BigRectangle.vue',
  'Rectangle.vue',
]);

interface Violation {
  file: string;
  line: number;
  content: string;
  type: 'hex' | 'rgb' | 'hsl';
}

function walkDir(dir: string, extensions: Set<string>): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
    if (e.isDirectory()) {
      files.push(...walkDir(full, extensions));
    } else if (e.isFile() && extensions.has(path.extname(e.name))) {
      // 跳过 token 定义源文件
      if (TOKEN_DEFINITION_FILES.has(e.name)) continue;
      // 跳过内联 SVG 文件
      if (INLINE_SVG_FILES.has(e.name)) continue;
      files.push(full);
    }
  }
  return files;
}

/**
 * 判断是否为 CSS 选择器中的 #id（非颜色值）
 * CSS ID 选择器特征：后面跟 [ .#:=-等，而不是颜色格式结束
 */
function isCssSelectorHash(hash: string): boolean {
  // 纯 3 位或 6 位十六进制才可能是颜色
  if (/^[0-9a-fA-F]{3}$/.test(hash) || /^[0-9a-fA-F]{6}$/.test(hash)) {
    return false;
  }
  // 包含非十六进制字符，是选择器
  return true;
}

function scanFile(filePath: string): Violation[] {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/);
  const violations: Violation[] = [];
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 跳过注释行
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

    // 跳过已使用 CSS 变量的行
    if (/var\s*\(--/.test(trimmed)) continue;

    // 跳过 getComputedStyle/getPropertyValue 调用（运行时读取 CSS 变量，不是硬编码）
    if (/getComputedStyle|getPropertyValue/.test(trimmed)) continue;

    // 跳过内联 SVG 字符串（如 '<rect ... fill="#f0f2f5"/>'）
    if (/<svg|<\/svg>|<rect |<circle |<path |<line |<polygon |<text /.test(trimmed)) continue;

    // 跳过使用 SCSS 变量的颜色函数（如 rgba($brand-primary, 0.5)）
    if (/\brgba?\s*\(\s*\$[a-zA-Z_-]/.test(trimmed)) continue;
    if (/\bhsl(a)?\s*\(\s*\$[a-zA-Z_-]/.test(trimmed)) continue;

    // 检测十六进制颜色
    // 匹配规则：#fff、#ffffff 等，排除 CSS 选择器 #id
    const hexRe = /(^|[^a-zA-Z0-9-_\\])(#([0-9a-fA-F]{3}){1,2})([^0-9a-fA-F-_\w]|$)/g;
    let hexMatch;
    while ((hexMatch = hexRe.exec(trimmed)) !== null) {
      const hash = hexMatch[3];
      if (!isCssSelectorHash(hash)) {
        violations.push({
          file: relPath,
          line: i + 1,
          content: trimmed.slice(0, 120),
          type: 'hex',
        });
        break; // 每行只报一次
      }
    }

    // 检测 rgb() / rgba()
    if (/\brgba?\s*\(/.test(trimmed)) {
      violations.push({
        file: relPath,
        line: i + 1,
        content: trimmed.slice(0, 120),
        type: 'rgb',
      });
    }

    // 检测 hsl() / hsla()
    if (/\bhsl(a)?\s*\(/.test(trimmed)) {
      violations.push({
        file: relPath,
        line: i + 1,
        content: trimmed.slice(0, 120),
        type: 'hsl',
      });
    }
  }

  return violations;
}

function main(): void {
  const args = process.argv.slice(2);
  const failOnViolations = args.includes('--fail');
  const extSet = new Set(EXTENSIONS);
  const files = walkDir(srcDir, extSet);
  const allViolations: Violation[] = [];
  const testViolations: Violation[] = [];

  for (const f of files) {
    const fileViolations = scanFile(f);
    const isTestFile = /__tests__|\.test\.|\.spec\./.test(f);
    if (isTestFile) {
      testViolations.push(...fileViolations);
    } else {
      allViolations.push(...fileViolations);
    }
  }

  // 按文件分组统计
  const byFile = new Map<string, Violation[]>();
  for (const v of allViolations) {
    if (!byFile.has(v.file)) byFile.set(v.file, []);
    byFile.get(v.file)!.push(v);
  }

  const byType: Record<string, number> = { hex: 0, rgb: 0, hsl: 0 };
  for (const v of allViolations) byType[v.type]++;

  console.log('\n========== 硬编码颜色检查报告 ==========\n');
  console.log(`扫描文件数: ${files.length}`);
  console.log(`硬编码颜色总计: ${allViolations.length + testViolations.length} 处`);
  console.log(`  业务代码: ${allViolations.length} 处（hex: ${byType.hex}, rgb: ${byType.rgb}, hsl: ${byType.hsl}）`);
  console.log(`  测试文件: ${testViolations.length} 处（通常为故意设置）\n`);

  if (allViolations.length > 0) {
    console.log('--- 业务代码硬编码颜色（按文件分布）---\n');
    const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [file, violations] of sorted) {
      console.log(`  ${file}  (${violations.length} 处)`);
      for (const v of violations.slice(0, 5)) {
        console.log(`    L${v.line} [${v.type}] ${v.content.slice(0, 100)}`);
      }
      if (violations.length > 5) {
        console.log(`    ... 还有 ${violations.length - 5} 处`);
      }
    }
    console.log('\n规范：使用 src/styles/_global-tokens.scss 中的 --app-* 变量替代硬编码颜色');
    console.log('提示：使用 --fail 参数可在 CI 中将违规视为失败');
  } else {
    console.log('✅ 业务代码中未发现硬编码颜色值。');
  }

  if (testViolations.length > 0) {
    console.log(`\n--- 测试文件硬编码颜色（${testViolations.length} 处，通常为故意设置）---\n`);
    const testByFile = new Map<string, Violation[]>();
    for (const v of testViolations) {
      if (!testByFile.has(v.file)) testByFile.set(v.file, []);
      testByFile.get(v.file)!.push(v);
    }
    for (const [file, violations] of [...testByFile.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 10)) {
      console.log(`  ${file}  (${violations.length} 处)`);
    }
  }

  process.exit(failOnViolations && allViolations.length > 0 ? 1 : 0);
}

main();
