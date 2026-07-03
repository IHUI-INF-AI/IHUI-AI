/**
 * 守门脚本：AI 能力下拉「+ 选择」弹窗结构完整性
 *
 * 检测规则 (对应 2026-07-03 重构: 合并分组 + v3 inline 面板架构):
 *   - AIChat.vue 主视图 .menu-grid 内必须恰好 7 个 .menu-item (5 能力 + 提示词模板 + AI工具箱)
 *   - 不允许出现 .menu-section-divider / .menu-section-header / .menu-grid-tools (旧独立工具区)
 *   - 主视图容器类名必须含 .ai-capability-quick-menu + .capability-view-pane
 *   - 必须存在 .ai-capability-inline-panel 类 (v3: 不再 el-dropdown teleport, 改为 inline absolute 面板)
 *   - 必须导入 onClickOutside (v3: inline 面板点击外部关闭机制)
 *
 * 设计意图:
 *   防止未来误改回"5 能力 + 独立工具区"分组结构, 导致 E2E ai-capability-dropdown.spec.ts
 *   (12 用例 × 2 浏览器 = 24 测试) 全部回归失败. 源码级守门比 E2E 快 (<50ms), pre-commit 友好.
 *
 * 用法:
 *   - 检查 AIChat.vue (默认):  node scripts/check-capability-dropdown-structure.mjs
 *   - 检查指定文件:            node scripts/check-capability-dropdown-structure.mjs path/to/AIChat.vue
 *   - 仅当 AIChat.vue 在 staged 时才检查 (pre-commit 模式):  node scripts/check-capability-dropdown-structure.mjs --staged
 *
 * 退出码: 0 通过, 1 结构违规
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

// 目标文件: AI 对话输入框「+ 选择」能力下拉的唯一定义位置
const TARGET_FILE = path.join(rootDir, 'src', 'components', 'ai', 'AIChat.vue');

// 旧独立工具区类名 (2026-07-03 重构后必须消失)
const FORBIDDEN_CLASSES = ['menu-section-divider', 'menu-section-header', 'menu-grid-tools'];

// 主视图 .menu-grid 内预期的 .menu-item 数量 (5 能力 + 提示词模板 + AI工具箱 = 7)
const EXPECTED_ITEM_COUNT = 7;

// inline 面板架构标志 (2026-07-03 v3 重构: 不再 teleport 到 body, 改为 inline absolute 面板)
const INLINE_PANEL_CLASS = 'ai-capability-inline-panel';
const ON_CLICK_OUTSIDE_IMPORT_RE = /import\s+\{[^}]*\bonClickOutside\b[^}]*\}\s+from\s+['"]@vueuse\/core['"]/;

/**
 * 从模板中提取主视图 .menu-grid 块的内容
 * 主视图结构: <div class="openclaw-quick-menu ai-capability-quick-menu capability-view-pane" role="menu">
 *               <div class="menu-header">...</div>
 *               <div class="menu-grid"> ... 7 个 .menu-item ... </div>
 *             </div>
 */
function extractMainViewMenuGrid(text) {
  // 定位主视图容器起始 (class 含 ai-capability-quick-menu + capability-view-pane, 但不含 ai-capability-subview)
  // 注意: 子视图也含 ai-capability-quick-menu + capability-view-pane, 但含 ai-capability-subview
  const mainViewStartRe = /<div\s+v-if="capabilityDropdownView === 'main'"\s+key="main"\s+class="openclaw-quick-menu ai-capability-quick-menu capability-view-pane"/;
  const startMatch = text.match(mainViewStartRe);
  if (!startMatch) return null;
  const startIdx = startMatch.index + startMatch[0].length;

  // 从主视图起始位置找 .menu-grid 的开标签
  const menuGridRe = /<div\s+class="menu-grid">/;
  const gridMatch = text.slice(startIdx).match(menuGridRe);
  if (!gridMatch) return null;
  const gridStart = startIdx + gridMatch.index + gridMatch[0].length;

  // 找 .menu-grid 的闭合 </div> (需平衡嵌套 div)
  let depth = 1;
  let i = gridStart;
  while (i < text.length && depth > 0) {
    const open = text.indexOf('<div', i);
    const close = text.indexOf('</div>', i);
    if (close === -1) return null;
    if (open !== -1 && open < close) {
      depth++;
      i = open + 4;
    } else {
      depth--;
      i = close + 6;
    }
  }
  return text.slice(gridStart, i - 6);
}

/**
 * 统计 .menu-grid 块内的 .menu-item 数量
 * 匹配 <div class="menu-item ... 或 <div class="menu-item menu-item-tool ...
 */
function countMenuItems(menuGridContent) {
  const matches = menuGridContent.match(/<div\s+class="menu-item[^"]*"/g);
  return matches ? matches.length : 0;
}

/**
 * 检查 inline 面板架构 (2026-07-03 v3 重构: 不再 el-dropdown teleport 到 body)
 *   1. 模板/样式中必须出现 .ai-capability-inline-panel 类
 *   2. 必须导入 @vueuse/core 的 onClickOutside (点击外部关闭 inline 面板)
 */
function checkInlinePanelArchitecture(text) {
  const errors = [];

  // 1. ai-capability-inline-panel 类必须存在 (模板 class 属性 或 SCSS 选择器)
  const inlinePanelRe = new RegExp(`(class="[^"]*\\b${INLINE_PANEL_CLASS}\\b[^"]*"|\\.${INLINE_PANEL_CLASS}\\b)`);
  if (!inlinePanelRe.test(text)) {
    errors.push({
      type: 'inline-panel-class-missing',
      message: `未检测到 ${INLINE_PANEL_CLASS} 类 (v3 重构: 必须用 inline absolute 面板, 不再 el-dropdown teleport 到 body)`,
      line: 0,
      snippet: '',
    });
  }

  // 2. 必须导入 onClickOutside (inline 面板点击外部关闭机制)
  if (!ON_CLICK_OUTSIDE_IMPORT_RE.test(text)) {
    errors.push({
      type: 'onclickoutside-import-missing',
      message: `未检测到 onClickOutside import (inline 面板需要 @vueuse/core 的 onClickOutside 实现点击外部关闭)`,
      line: 0,
      snippet: '',
    });
  }

  return errors;
}

/**
 * 全文检查是否出现旧独立工具区类名
 */
function findForbiddenClasses(text) {
  const found = [];
  for (const cls of FORBIDDEN_CLASSES) {
    // 匹配 class="...cls..." 或 class 属性中含 cls
    // 排除注释行 (// 或 /* */)
    const re = new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"`, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      // 检查是否在注释内 (粗略检查所在行是否以 // 开头或被 /* */ 包裹)
      const lineStart = text.lastIndexOf('\n', m.index) + 1;
      const lineEnd = text.indexOf('\n', m.index);
      const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      // 跳过 SCSS 注释行 (// ...) 或包含 /* ... */ 的行
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
      // 跳过 SCSS 选择器定义 (.cls {) —— 只关心模板中的 class 属性使用
      // class="..." 形式才是模板使用, .cls { 是样式定义, 已在 SCSS 删除
      found.push({ class: cls, line: text.slice(0, m.index).split('\n').length, snippet: trimmed });
    }
  }
  return found;
}

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

function main() {
  const args = process.argv.slice(2);
  const stagedOnly = args.includes('--staged');
  const customFile = args.find(a => !a.startsWith('-'));
  const targetFile = customFile ? path.resolve(customFile) : TARGET_FILE;

  // --staged 模式: 仅当目标文件在 staged 时才检查 (pre-commit 友好, 避免每次提交都扫)
  if (stagedOnly && !isStaged(targetFile)) {
    console.log('✓ AIChat.vue 未暂存, 跳过能力下拉结构检查');
    process.exit(0);
  }

  if (!fs.existsSync(targetFile)) {
    console.log(`✓ ${path.relative(rootDir, targetFile)} 不存在, 跳过`);
    process.exit(0);
  }

  const text = fs.readFileSync(targetFile, 'utf-8');
  const relPath = path.relative(rootDir, targetFile).replace(/\\/g, '/');

  const errors = [];

  // 1. 检查旧独立工具区类名是否复活
  const forbidden = findForbiddenClasses(text);
  for (const f of forbidden) {
    errors.push({
      type: 'forbidden-class',
      message: `检测到旧独立工具区类名 "${f.class}" (2026-07-03 重构已删除, 提示词模板/AI工具箱应合并到主 .menu-grid)`,
      line: f.line,
      snippet: f.snippet,
    });
  }

  // 2. 检查主视图 .menu-grid 内 .menu-item 数量
  const menuGrid = extractMainViewMenuGrid(text);
  if (menuGrid === null) {
    errors.push({
      type: 'main-view-not-found',
      message: `无法定位主视图 .menu-grid (模板结构可能被破坏, 检查 v-if="capabilityDropdownView === 'main'" 与 class="menu-grid")`,
      line: 0,
      snippet: '',
    });
  } else {
    const count = countMenuItems(menuGrid);
    if (count !== EXPECTED_ITEM_COUNT) {
      errors.push({
        type: 'item-count-mismatch',
        message: `主视图 .menu-grid 内 .menu-item 数量为 ${count}, 预期 ${EXPECTED_ITEM_COUNT} (5 能力 + 提示词模板 + AI工具箱, 2026-07-03 合并分组)`,
        line: 0,
        snippet: `实际: ${count} 个 .menu-item`,
      });
    }
  }

  // 3. 检查 inline 面板架构 (2026-07-03 v3 重构: 不再 el-dropdown teleport 到 body)
  const archErrors = checkInlinePanelArchitecture(text);
  errors.push(...archErrors);

  if (errors.length === 0) {
    console.log(`✓ ${relPath} 能力下拉结构完整 (7 项合并分组, 无旧独立工具区, inline 面板架构)`);
    process.exit(0);
  }

  console.log(`✗ ${relPath} 能力下拉结构违规 (${errors.length} 处)\n`);
  console.log('  硬约束: 2026-07-03 重构 —— 提示词模板/AI工具箱合并到主 .menu-grid, 不再单独分组\n');
  for (const e of errors) {
    console.log(`  [${e.type}]${e.line ? ` L${e.line}` : ''}: ${e.message}`);
    if (e.snippet) console.log(`    ${e.snippet}`);
    console.log();
  }
  console.log('  修复建议:');
  console.log('    - 移除 .menu-section-divider / .menu-section-header / .menu-grid-tools 三层包裹');
  console.log('    - 将提示词模板 + AI工具箱的 .menu-item 直接放入主 .menu-grid (与 5 个能力卡片同级)');
  console.log('    - 主视图 .menu-grid 内应恰好 7 个 .menu-item');
  console.log('    - 必须用 .ai-capability-inline-panel (inline absolute 面板), 不得用 <el-dropdown> teleport');
  console.log('    - 必须导入 @vueuse/core 的 onClickOutside (点击外部关闭 inline 面板)');
  console.log('    - 参考 E2E: e2e/ai-capability-dropdown.spec.ts (12 用例 × 2 浏览器 = 24 测试)');
  console.log('');

  process.exit(1);
}

main();
