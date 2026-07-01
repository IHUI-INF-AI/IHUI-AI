#!/usr/bin/env node
/**
 * 主题色 token 单一来源强制检查器
 *
 * 目的：防止"改色不生效"问题复发。
 * 严禁在任何非 token 源文件中硬编码主题色十六进制值。
 *
 * 唯一允许定义主题色值的位置：
 *   - src/styles/_theme-tokens.ts (TS 源)
 *   - src/styles/_theme-tokens.scss (SCSS 桥接镜像)
 *
 * 其它所有 .ts/.js/.vue/.scss/.css/.html/.cjs/.mjs 文件中
 * 出现以下硬编码值都将被报告：
 *   - #b0b6c3 (亮色 surface)
 *   - #6a6d77 (暗色 surface)
 *   - #5a5d67 (暗色 page)
 *   - #a4aab7 (亮色 hover)
 *   - #7a7d87 (暗色 hover)
 *
 * 注意：其它中性灰（如 #303133 文字、#ffffff 文字）不在本检查范围，
 * 因为这些是 Element Plus 默认变量，改色不影响主色板一致性。
 *
 * 用法：
 *   node scripts/check-theme-tokens.mjs             # 检查 src/ + index.html
 *   node scripts/check-theme-tokens.mjs --staged     # 只检查 git staged 变更
 *   node scripts/check-theme-tokens.mjs --all        # 检查全项目
 *
 * 退出码：0 通过，1 存在违规
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ====== 配置 ======
// 2026-07-02 扩展: 对齐 AGENTS.md 主题色改动硬约束
// 严禁在任何非 token 源文件中硬编码主题色十六进制值。
// 唯一允许定义主题色值的位置：
//   - src/styles/_theme-tokens.ts (TS 源)
//   - src/styles/_theme-tokens.scss (SCSS 桥接镜像)
const FORBIDDEN_HEX = [
  // 表面色 (surface)
  '#b0b6c3', // lightSurface
  '#6a6d77', // darkSurface
  '#5a5d67', // darkPage
  // hover 色
  '#a4aab7', // lightHover
  '#7a7d87', // darkHover
  // 文字色 (THEME_INVARIANTS.ghostTextDark)
  '#e5eaf3',
  // CTA 主色 (THEME_INVARIANTS.ctaBgDark + hover + active)
  // 2026-07-02 扩: 全套 CTA 蓝色严禁硬编码, 必须走 var(--color-cta-blue) 等桥接
  '#2563eb', // ctaBgDark
  '#1d4ed8', // ctaBgDarkHover / ai-send-btn-active
  '#1e40af', // ctaBgDarkActive
  // miniapp 品牌色 (2026-07-02 决策 2 已改为极简黑, 历史绿色 #07c160 严禁再使用)
  '#07c160',
  // 微信分享品牌色 (桥接层 _global-tokens.scss 之外严禁硬编码)
  '#06ad56',
];

// 不区分大小写匹配
const FORBIDDEN_REGEX = new RegExp(
  FORBIDDEN_HEX.map((h) => h.replace('#', '#?')).join('|'),
  'gi'
);

// 唯一允许定义主题色值的位置
// 2026-07-02 扩展: 增加 BRIDGE_FILES 白名单, 允许"主题色桥接"文件
// 这些文件作为 _theme-tokens.ts 主题色源 与 业务代码 之间的桥接层,
// 用 fallback / var() 包裹传播色值, 严禁在 BRIDGE_FILES 之外硬编码主题色
const TOKEN_FILES = new Set([
  // === 唯一权威来源 (改色只能改这两个) ===
  'src/styles/_theme-tokens.ts',
  'src/styles/_theme-tokens.scss',
]);

// 桥接层文件 - 把 token 映射到 Element Plus / 全局 CSS 变量
// 这些文件允许出现主题色字面量 (用于 var(--theme-X, #fallback) fallback 或 SCSS 桥接),
// 但严禁再硬编码"业务"主题色 (如 #2563eb/#07c160)
const BRIDGE_FILES = new Set([
  // 主题色 token 的 CSS 桥接 (--theme-* 在 :root 和 html.dark 声明)
  'src/styles/dark-mode-override.scss',
  // 运行时 CSS 变量注入 (main.ts 启动时通过 <style> 注入)
  'src/main.ts',
  // Element Plus 主题色 CSS 变量桥接
  'src/styles/element-plus-vars.scss',
  // SCSS 级别 design tokens (Element Plus 变量映射)
  'src/styles/_global-tokens.scss',
  'src/styles/_design-tokens.scss',
  // 暗色模式全局 CSS 变量覆盖
  'src/styles/_dark-mode-global.scss',
  // 后台管理暗色模式
  'src/styles/_admin-dark-mode.scss',
  // Element Plus 全局组件样式覆盖 (ElMessage / ElNotification 等, 用 var(--color-cta-blue-hover, #fallback) 桥接)
  'src/styles/_el-message-global.scss',
  // 登录模块 SCSS 桥接 (2026-07-02 扩): $login-primary / $login-input-* 等模块内部设计 token
  // 集中定义登录模块的 hover/focus border / button 颜色, 与 _login-tokens.scss 的设计意图一致
  'src/components/login/_login-tokens.scss',
]);

// 允许出现的辅助文件（脚本本身的检测逻辑、正则等不算违规）
const SELF_FILE = 'scripts/check-theme-tokens.mjs';

// 跳过的目录
const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  'coverage',
  'release',
  '.vite',
  'storybook-static',
  'playwright-report',
  'test-results',
  'logs',
]);

// 检查的扩展名
const EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.vue', '.scss', '.sass', '.css',
  '.html', '.htm',
]);

// ====== 主流程 ======
function walkDir(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, files);
    } else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: rootDir,
      encoding: 'utf-8',
    });
    return out
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
      .filter((f) => EXTENSIONS.has(path.extname(f).toLowerCase()))
      .map((f) => path.resolve(rootDir, f));
  } catch (_e) {
    return [];
  }
}

function scanFile(filePath) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  if (TOKEN_FILES.has(relPath)) return [];
  if (BRIDGE_FILES.has(relPath)) return []; // 2026-07-02 新增: 桥接层文件放行
  if (relPath === SELF_FILE) return [];

  const violations = [];
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 跳过纯注释行（// 或 /* 或 * 或 <!--）
    const trimmed = line.trim();
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('<!--')
    ) {
      continue;
    }
    // 跳过 SCSS 注释
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    FORBIDDEN_REGEX.lastIndex = 0;
    let match;
    while ((match = FORBIDDEN_REGEX.exec(line)) !== null) {
      violations.push({
        file: relPath,
        line: i + 1,
        column: match.index + 1,
        match: match[0],
        context: line.trim().slice(0, 200),
      });
    }
  }
  return violations;
}

function main() {
  const args = process.argv.slice(2);
  const staged = args.includes('--staged');
  const all = args.includes('--all');

  let files;
  if (staged) {
    files = getStagedFiles();
  } else if (all) {
    files = walkDir(rootDir);
  } else {
    // 默认：只检查 src/ + index.html + 根目录配置文件
    const targets = [
      path.join(rootDir, 'src'),
      path.join(rootDir, 'index.html'),
    ];
    files = [];
    for (const t of targets) {
      if (fs.existsSync(t)) {
        if (fs.statSync(t).isDirectory()) {
          files.push(...walkDir(t));
        } else {
          files.push(t);
        }
      }
    }
  }

  // 过滤掉白名单文件 + 自身
  files = files.filter((f) => {
    const rel = path.relative(rootDir, f).replace(/\\/g, '/');
    return !TOKEN_FILES.has(rel) && !BRIDGE_FILES.has(rel) && rel !== SELF_FILE;
  });

  console.log(`[check-theme-tokens] 扫描 ${files.length} 个文件...`);
  console.log(`[check-theme-tokens] 禁止的硬编码色值: ${FORBIDDEN_HEX.join(', ')}`);
  console.log(`[check-theme-tokens] 唯一允许定义的文件: ${[...TOKEN_FILES].join(', ')}`);
  console.log(`[check-theme-tokens] 桥接层文件 (允许 var(--theme-X, #fallback)): ${[...BRIDGE_FILES].join(', ')}\n`);

  let allViolations = [];
  for (const f of files) {
    const v = scanFile(f);
    allViolations = allViolations.concat(v);
  }

  if (allViolations.length === 0) {
    console.log(`✅ [check-theme-tokens] 通过！未发现硬编码主题色值。`);
    process.exit(0);
  }

  console.error(`❌ [check-theme-tokens] 发现 ${allViolations.length} 处硬编码主题色值违规：\n`);
  // 按文件分组
  const byFile = new Map();
  for (const v of allViolations) {
    if (!byFile.has(v.file)) byFile.set(v.file, []);
    byFile.get(v.file).push(v);
  }
  for (const [file, list] of byFile) {
    console.error(`  📄 ${file}`);
    for (const v of list) {
      console.error(`     L${v.line}:${v.column}  匹配 "${v.match}"  →  ${v.context}`);
    }
    console.error('');
  }

  console.error(`💡 修复方法：`);
  console.error(`   1. 删除此处的硬编码值`);
  console.error(`   2. 改用 CSS 变量: var(--theme-light-surface) / var(--theme-dark-surface) 等`);
  console.error(`   3. SCSS 中用: @use '@/styles/theme-tokens' as tt; color: tt.$theme-light-surface;`);
  console.error(`   4. 改色只改 src/styles/_theme-tokens.ts（唯一权威来源）`);
  console.error(`   5. 重新执行 npm run check:theme-tokens 验证\n`);

  process.exit(1);
}

main();
