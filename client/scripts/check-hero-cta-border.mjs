// 守门: Home.vue.styles.scss 中所有 .hero-cta-btn 边界必须跟全局描边 / 实底色体系统一
// 防回归: 用户规则 "button 描边应该跟全局样式的描边统一" (2026-07-06 立)
//
// 允许的边界模式 (二选一):
//   模式 A (描边式): border: 1px solid var(--app-sidebar-border)
//                    适用: primary 按钮 (深底 + 同 token 描边), miniapp 按钮 (绿底 + 同 token 描边)
//   模式 B (实底色式): border: var(--app-button-border-transparent) (= 1px solid transparent)
//                    + background: var(--app-button-bg-ghost-surface) (浅/暗 模式专用实底色)
//                    适用: ghost 按钮 (避免 #e9e9e9 描边在 page bg 上几乎不可见)
//
// 禁止: border: 1px solid #xxx 硬编码色值, border: var(--unified-border) 间接链, border: none
//   (none 会破坏 layout 尺寸稳定性, 必须 1px 透明描边占位)
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const TARGET_REL = 'src/views/Home.vue.styles.scss';
const TARGET = join(ROOT, TARGET_REL);

const stagedOnly = process.argv.includes('--staged');

function getTargetFiles() {
  if (!stagedOnly) {
    return existsSync(TARGET) ? [TARGET_REL] : [];
  }
  try {
    const staged = execSync('git diff --cached --name-only -- src/views/Home.vue.styles.scss', { cwd: ROOT, encoding: 'utf8' });
    return staged.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function classifyBlock(content) {
  // 提取 border 声明
  const borderMatch = content.match(/(?:^|\n)\s*border\s*:\s*([^;]+);/);
  const bgMatch = content.match(/(?:^|\n)\s*background\s*:\s*([^;]+);/);

  return {
    border: borderMatch ? borderMatch[1].trim() : null,
    bg: bgMatch ? bgMatch[1].trim() : null,
  };
}

function isValidPattern({ border, bg }) {
  if (!border) return { ok: false, reason: '缺少 border 声明' };

  // 模式 A: border 用 --app-sidebar-border (描边式)
  if (border.includes('var(--app-sidebar-border)')) return { ok: true, mode: 'A:sidebar-border' };

  // 模式 B: border 透明 + background 用 ghost 实底色 (实底色式)
  if (
    border.includes('var(--app-button-border-transparent)') ||
    (border.includes('transparent') && !border.includes('var(--app-sidebar-border)'))
  ) {
    if (bg && bg.includes('var(--app-button-bg-ghost-surface)')) {
      return { ok: true, mode: 'B:ghost-surface' };
    }
    return { ok: false, reason: 'border 是 transparent 但 background 未用 var(--app-button-bg-ghost-surface) (实底色式必须配实底色背景)' };
  }

  return { ok: false, reason: `border 不符合模式 A (--app-sidebar-border) 或模式 B (--app-button-border-transparent + --app-button-bg-ghost-surface), 当前: ${border}` };
}

function check() {
  const targets = getTargetFiles();
  if (targets.length === 0) {
    console.log(`[hero-cta-border] skip: ${stagedOnly ? 'Home.vue.styles.scss 未暂存' : '文件不存在'}`);
    return;
  }

  let totalIssues = 0;
  let totalButtons = 0;
  let totalChecked = 0;

  for (const rel of targets) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;
    const src = readFileSync(abs, 'utf8');

    // 提取所有 .hero-cta-btn 块
    const buttonBlocks = [];
    const blockRegex = /\.hero-cta-btn[^{]*\{([\s\S]*?)\n\}/g;
    let m;
    while ((m = blockRegex.exec(src)) !== null) {
      buttonBlocks.push({ start: m.index, content: m[1] });
    }

    if (buttonBlocks.length === 0) continue;
    totalButtons += buttonBlocks.length;

    const issues = [];
    let fileChecked = 0;
    for (const { start, content } of buttonBlocks) {
      const { border, bg } = classifyBlock(content);
      // 跳过没有 border 声明的 block: 这些是 layout / focus-visible / 嵌套包装块,
      // 不需要 border (例如 .hero-cta .hero-cta-btn 基础布局, :focus-visible 焦点环)
      if (!border) continue;
      fileChecked++;
      totalChecked++;
      const v = isValidPattern({ border, bg });
      if (!v.ok) {
        const lineNo = src.substring(0, start).split('\n').length;
        issues.push({ line: lineNo, reason: v.reason, border, bg });
      }
    }

    if (issues.length > 0) {
      totalIssues += issues.length;
      console.error(
        `\n[hero-cta-border] FAIL: ${rel} 中 ${issues.length} 个 .hero-cta-btn 块边界未统一.\n` +
        `用户规则 (2026-07-06 立): "button 描边应该跟全局样式的描边统一" / 改用实底色背景代替描边.\n\n` +
        `允许的边界模式 (二选一):\n` +
        `  模式 A (描边式): border: 1px solid var(--app-sidebar-border)\n` +
        `  模式 B (实底色式): border: var(--app-button-border-transparent) + background: var(--app-button-bg-ghost-surface)\n\n` +
        issues.map(i => `  L${i.line}: ${i.reason}\n    border: ${i.border}\n    bg: ${i.bg || '(无)'}\n`).join('\n')
      );
    }
  }

  if (totalIssues > 0) {
    process.exit(1);
  }

  console.log(`[hero-cta-border] OK: ${totalChecked} 个含 border 声明的 .hero-cta-btn 块全部符合模式 A 或模式 B (共 ${totalButtons} 个 .hero-cta-btn 块, 另 ${totalButtons - totalChecked} 个 layout/focus-visible 块无 border 跳过)`);
}

check();


