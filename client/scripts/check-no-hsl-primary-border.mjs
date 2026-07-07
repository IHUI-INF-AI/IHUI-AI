// 守门: 全项目禁止 border* 用 hsl(var(--primary)) 当颜色
// 防回归: 用户规则 2026-07-07 立 "彻彻底底整个项目全部杜绝纯黑描边"
//   根因: --primary: 0 0% 0% (亮色 HSL hue 0, sat 0, light 0% = #000 纯黑),
//         用 hsl(var(--primary)) 解析为纯黑, 在亮色主题下 border 描边突兀.
//
// 允许的等价写法 (在白名单内):
//   - color / background / background-color 用 hsl(var(--primary)) (设计意图)
//   - border / border-color / border-top / ... 用 hsl(var(--primary) / 0.X) (带透明度)
//   - dark-mode-override.scss 暗色块内的强制覆盖
//   - .btn-apply / .btn-submit / .btn-primary-custom CTA 按钮 background (黑底白字一等公民)
//
// 禁止: border / border-color / border-top / border-right / border-bottom / border-left
//   / border-top-color / border-right-color / border-bottom-color / border-left-color
//   / border-width: ... 用 hsl(var(--primary)) 不带透明度.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

const stagedOnly = process.argv.includes('--staged');
const allMode = process.argv.includes('--all');

// 扩展名白名单
const EXTS = new Set(['.vue', '.scss', '.css']);

// 白名单文件 (暗色模式强制覆盖, 已知设计意图)
const WHITELIST_FILES = new Set([
  'src/styles/dark-mode-override.scss',
]);

// 允许的"安全"用法 (在白名单行内): border*-color 用 hsl(var(--primary) / 0.X) 带透明度
const HSL_TRANSPARENT_RE = /hsl\(\s*var\(\s*--primary\s*\)\s*\/\s*[\d.]+\s*\)/;

// 违规正则: border*-color 用 hsl(var(--primary)) 不带透明度
// 匹配: border-color: hsl(var(--primary));  border-top: 1px solid hsl(var(--primary));
//       border: 2px solid hsl(var(--primary));  border-color: hsl( var(--primary) ) 等
const VIOLATION_RE = /border(?:-(?:top|right|bottom|left))?(?:-color)?\s*:\s*[^;]*?hsl\(\s*var\(\s*--primary\s*\)\s*\)/g;

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.vite') continue;
      walk(p, files);
    } else {
      const ext = name.slice(name.lastIndexOf('.'));
      if (EXTS.has(ext)) files.push(p);
    }
  }
  return files;
}

function getTargetFiles() {
  if (stagedOnly) {
    try {
      const staged = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf8' });
      return staged.split('\n').filter(Boolean).filter(f => {
        const ext = f.slice(f.lastIndexOf('.'));
        return EXTS.has(ext) && f.startsWith('src/');
      });
    } catch {
      return [];
    }
  }
  return walk(SRC).map(f => relative(ROOT, f));
}

function check() {
  const targets = getTargetFiles();
  if (targets.length === 0) {
    console.log(`[no-hsl-primary-border] skip: 无目标文件`);
    return;
  }

  const issues = [];
  let checked = 0;

  for (const rel of targets) {
    if (WHITELIST_FILES.has(rel.replace(/\\/g, '/'))) continue;
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;

    const src = readFileSync(abs, 'utf8');
    const lines = src.split('\n');
    checked++;

    lines.forEach((line, i) => {
      // 跳过注释行
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

      // 跳过带透明度的合法写法
      if (HSL_TRANSPARENT_RE.test(line)) {
        HSL_TRANSPARENT_RE.lastIndex = 0;
        return;
      }

      // 跳过 CTA 按钮 background (一等公民设计)
      if (/\.btn-(apply|submit|primary-custom)/.test(line) && /background\s*:/.test(line)) return;

      // 检查违规
      const matches = line.match(VIOLATION_RE);
      if (matches) {
        issues.push({
          file: rel.replace(/\\/g, '/'),
          line: i + 1,
          code: line.trim(),
          match: matches[0],
        });
      }
    });
  }

  if (issues.length > 0) {
    console.error(
      `\n[no-hsl-primary-border] FAIL: ${issues.length} 处违规.\n` +
      `用户规则 (2026-07-07 立): "彻彻底底整个项目全部杜绝纯黑描边"\n` +
      `根因: --primary: 0 0% 0% (亮色 = #000 纯黑), hsl(var(--primary)) 解析为纯黑描边突兀.\n` +
      `修复: 用 var(--el-color-primary-light-3) (亮色 #303133) 或 var(--border-unified-color-hover).\n\n` +
      issues.map(i => `  ${i.file}:${i.line}\n    ${i.code}\n    命中: ${i.match}\n`).join('\n')
    );
    process.exit(1);
  }

  console.log(`[no-hsl-primary-border] OK: 扫描 ${checked} 个文件, 0 违规 (用户规则 2026-07-07: 禁止 border 用 hsl(var(--primary)) 纯黑描边)`);
}

check();
