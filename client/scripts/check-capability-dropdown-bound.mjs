/**
 * 守门脚本：AI 能力下拉弹窗"不超出 AI 对话框容器"硬约束
 *
 * 检测规则 (2026-07-06 立, 用户规则: 弹窗菜单弹出的位置太偏右了, 我不希望他超出整个AI对话框容器):
 *   - toggleCapabilityDropdown 函数中, 计算 left 位置时, 右边界必须用
 *     dialogRef.value.getBoundingClientRect().right (即 AI 对话框容器的右边)
 *   - 禁止继续使用 viewportW (window.innerWidth) 作为右边界
 *   - 必须存在 containerRight 变量 + dialogRef / dialogEl 引用
 *   - 必须用 min/max 做左/右双向夹紧
 *
 * 设计意图:
 *   弹窗宽度 320px + AI 浮窗 / 嵌入面板宽度 400px 较窄, 当 trigger (✨ 能力 / 中间模型)
 *   在对话框右内侧时, 以视口右边界 = window.innerWidth 限制会允许弹窗超出对话框
 *   右侧 50-100px, 用户多次报告"弹窗偏右 + 超出 AI 对话框容器".
 *   修复后用 dialogRef.value.getBoundingClientRect().right 替代, 保证弹窗永远在容器内.
 *
 * 用法:
 *   - 检查 AIChat.vue (默认):  node scripts/check-capability-dropdown-bound.mjs
 *   - 仅当 AIChat.vue 在 staged 时才检查 (pre-commit 模式):  node scripts/check-capability-dropdown-bound.mjs --staged
 *
 * 退出码: 0 通过, 1 边界违规
 *
 * 性能: <50ms (单文件正则扫描, pre-commit 友好)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TARGET_FILE = path.join(rootDir, 'src', 'components', 'ai', 'AIChat.vue');

function isStaged(file) {
  try {
    const output = execSync('git diff --cached --name-only', {
      cwd: rootDir,
      encoding: 'utf-8',
    });
    const staged = output.split(/\r?\n/).filter(Boolean).map(f => path.resolve(rootDir, f));
    return staged.includes(file);
  } catch {
    return false;
  }
}

/**
 * 提取 toggleCapabilityDropdown 函数体 (从 const toggleCapabilityDropdown 行 到对应闭合大括号)
 */
function extractToggleCapabilityDropdownBody(text) {
  // 匹配: const toggleCapabilityDropdown = (event?: MouseEvent) => {
  const startRe = /const\s+toggleCapabilityDropdown\s*=\s*\([^)]*\)\s*=>\s*\{/;
  const startMatch = text.match(startRe);
  if (!startMatch) return null;
  const startIdx = startMatch.index + startMatch[0].length;

  // 找配对的闭合大括号
  let depth = 1;
  let i = startIdx;
  while (i < text.length && depth > 0) {
    const open = text.indexOf('{', i);
    const close = text.indexOf('}', i);
    if (close === -1) return null;
    if (open !== -1 && open < close) {
      depth++;
      i = open + 1;
    } else {
      depth--;
      i = close + 1;
    }
  }
  return text.slice(startIdx, i - 1);
}

function main() {
  const args = process.argv.slice(2);
  const stagedOnly = args.includes('--staged');
  const targetFile = TARGET_FILE;

  if (stagedOnly && !isStaged(targetFile)) {
    console.log('✓ AIChat.vue 未暂存, 跳过能力下拉边界检查');
    process.exit(0);
  }

  if (!fs.existsSync(targetFile)) {
    console.log(`✓ ${path.relative(rootDir, targetFile)} 不存在, 跳过`);
    process.exit(0);
  }

  const text = fs.readFileSync(targetFile, 'utf-8');
  const relPath = path.relative(rootDir, targetFile).replace(/\\/g, '/');

  const errors = [];

  // 1. 提取 toggleCapabilityDropdown 函数体
  const body = extractToggleCapabilityDropdownBody(text);
  if (body === null) {
    errors.push({
      type: 'function-not-found',
      message: '无法定位 toggleCapabilityDropdown 函数 (可能被改名或重构)',
    });
  } else {
    // 2. 必须存在 dialogRef 引用
    const dialogRefRe = /dialogRef\.value/;
    if (!dialogRefRe.test(body)) {
      errors.push({
        type: 'dialog-ref-missing',
        message: 'toggleCapabilityDropdown 内未使用 dialogRef.value 读取 AI 对话框容器边界 (应使用 dialogRef.value.getBoundingClientRect())',
      });
    }

    // 3. 必须存在 containerRight 变量 (标识使用了对话框右边界)
    const containerRightRe = /\bcontainerRight\b/;
    if (!containerRightRe.test(body)) {
      errors.push({
        type: 'container-right-missing',
        message: '未检测到 containerRight 变量 (应从 dialogRef.value.getBoundingClientRect().right 提取, 替代 viewportW)',
      });
    }

    // 4. 禁止用 viewportW 作为右边界 (因为视口右边界 ≠ AI 对话框右边界)
    //    允许 viewportW 作为兜底 (dialogRef 不可用时), 但必须有 dialogRef 检测
    const viewportWAsBoundaryRe = /viewportW\s*-\s*PANEL_W\s*-\s*EDGE/;
    if (viewportWAsBoundaryRe.test(body)) {
      errors.push({
        type: 'viewport-as-boundary',
        message: '检测到 maxLeft = viewportW - PANEL_W - EDGE (用视口宽度做右边界). 应改用 containerRight (AI 对话框容器右边), 兜底才用 viewportW',
      });
    }

    // 5. 必须有 maxLeft / minLeft 双向夹紧逻辑
    const maxLeftRe = /\bmaxLeft\b/;
    const minLeftRe = /\bminLeft\b/;
    if (!maxLeftRe.test(body)) {
      errors.push({
        type: 'max-clamp-missing',
        message: '未检测到 maxLeft 变量 (应有右边界夹紧: maxLeft = containerRight - PANEL_W - EDGE)',
      });
    }
    if (!minLeftRe.test(body)) {
      errors.push({
        type: 'min-clamp-missing',
        message: '未检测到 minLeft 变量 (应有左边界夹紧: minLeft = containerLeft + EDGE, 避免极端情况下超出左边界)',
      });
    }
  }

  if (errors.length === 0) {
    console.log(`✓ ${relPath} 能力下拉边界硬约束已应用 (dialogRef 右边界 + 左/右双向夹紧)`);
    process.exit(0);
  }

  console.log(`✗ ${relPath} 能力下拉边界违规 (${errors.length} 处)\n`);
  console.log('  硬约束 (2026-07-06): 弹窗不允许超出 AI 对话框容器右边界\n');
  for (const e of errors) {
    console.log(`  [${e.type}]: ${e.message}`);
    console.log();
  }
  console.log('  修复建议:');
  console.log('    在 toggleCapabilityDropdown 内:');
  console.log('      const dialogEl = dialogRef.value');
  console.log('      const dialogRect = dialogEl ? dialogEl.getBoundingClientRect() : null');
  console.log('      const containerRight = dialogRect ? dialogRect.right : viewportW');
  console.log('      const containerLeft = dialogRect ? dialogRect.left : 0');
  console.log('      const EDGE = 8');
  console.log('      const maxLeft = containerRight - PANEL_W - EDGE');
  console.log('      const minLeft = containerLeft + EDGE');
  console.log('      let left = desiredLeft');
  console.log('      if (left > maxLeft) left = maxLeft');
  console.log('      if (left < minLeft) left = minLeft');
  console.log('    验证脚本: scripts/verify-capability-popup-bound.mjs + scripts/verify-capability-popup-regression.mjs');
  console.log('');

  process.exit(1);
}

main();
