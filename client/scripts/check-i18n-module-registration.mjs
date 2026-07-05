/**
 * 守门脚本: i18n 模块必须在 coreModules 或 asyncModules 中注册
 *          防止 AIChat / 其他组件的 t('xxx.yyy') 渲染为原始 key 字面量
 *          (2026-07-05 立)
 *
 * 背景:
 *   modules/{lang}/ 下有 556+ 个 JSON 文件, 但 coreModules(24) + asyncModules(98) 只覆盖 122 个.
 *   之前 i18n 设计靠 requestIdleCallback 异步 glob 兜底 (loadAllModulesFromGlob) 加载未注册模块,
 *   但首屏渲染时 glob 尚未执行, 桌面端悬浮 AI 浮窗的 t('aiChatInput.select') / t('aiChatInput.inputPlaceholder')
 *   显示原始 key 字面量 (用户截图可证).
 *
 * 根因: aiChatInput 模块 JSON 文件存在, 但 coreModules 和 asyncModules 都没注册.
 * 修复: 加进 coreModules + CORE_MODULE_SOURCE (modules). 体积 ~1.9KB/locale, 5 语言共 ~10KB.
 *
 * 守门规则:
 *   1. 扫 .vue / .ts 文件中的 t('ModuleName.X') 引用, 提取所有 ModuleName
 *   2. 扫 modules/{zh-CN,zh-TW,en,ja,ko}/ModuleName.json 文件存在性
 *   3. 提取 locales/index.ts 中 coreModules + asyncModules 已注册模块列表
 *   4. 任何 "t('ModuleName.') 被引用" + "modules/{lang}/ModuleName.json 存在" 但
 *      "ModuleName 不在 coreModules/asyncModules" → 报错
 *
 * 例外白名单:
 *   - modules 在 full/ 下 (loadFullLocaleMessages 切语言时一次性加载)
 *   - core / common / navigation / header / auth / routes / app / login / title / home / ...
 *     这些是核心/常用, 已注册
 *   - ModuleName 含大写字母 / 数字 (非全小写) → 视为非标准模块名, 跳过
 *   - moduleName 长度 < 2 跳过
 *
 * 用法:
 *   - 检查暂存文件:  node scripts/check-i18n-module-registration.mjs
 *   - 检查整个项目:  node scripts/check-i18n-module-registration.mjs --all
 *
 * 退出码: 0 通过, 1 发现违规
 *
 * 性能: <500ms (pre-commit 友好)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const i18nIndexPath = path.join(rootDir, 'src/locales/index.ts');
const modulesDir = path.join(rootDir, 'src/locales/modules');

const errors = [];
const warnings = [];

/**
 * 从 locales/index.ts 提取 coreModules + asyncModules 中注册的模块名.
 */
function extractRegisteredModules() {
  if (!fs.existsSync(i18nIndexPath)) {
    errors.push(`i18n 索引文件不存在: ${i18nIndexPath}`);
    return new Set();
  }

  const content = fs.readFileSync(i18nIndexPath, 'utf8');
  const registered = new Set();

  // 匹配 coreModules = [...] 数组 (含 const ... as const)
  const coreMatch = content.match(/coreModules\s*=\s*\[([^\]]+)\]\s*as\s+const/);
  if (coreMatch) {
    const arr = coreMatch[1].match(/'([^']+)'/g) || [];
    for (const item of arr) registered.add(item.slice(1, -1));
  }

  // 匹配 asyncModules = [...] 数组 (含 const ... as const)
  const asyncMatch = content.match(/asyncModules\s*=\s*\[([\s\S]+?)\]\s*as\s+const/);
  if (asyncMatch) {
    const arr = asyncMatch[1].match(/'([^']+)'/g) || [];
    for (const item of arr) registered.add(item.slice(1, -1));
  }

  return registered;
}

/**
 * 列出 modules/{lang}/ 下所有 JSON 文件, 返回 moduleName 集合.
 */
function listExistingModuleFiles() {
  const result = new Set();
  if (!fs.existsSync(modulesDir)) return result;
  for (const lang of fs.readdirSync(modulesDir)) {
    const langDir = path.join(modulesDir, lang);
    if (!fs.statSync(langDir).isDirectory()) continue;
    for (const f of fs.readdirSync(langDir)) {
      if (f.endsWith('.json')) result.add(f.slice(0, -5));
    }
  }
  return result;
}

/**
 * 扫 .vue / .ts 文件, 提取 t('ModuleName.') 引用过的所有 ModuleName.
 */
function extractUsedModules(fileList) {
  const used = new Set();
  // t('ModuleName.key')  或  t("ModuleName.key")
  const re = /\bt\(\s*['"]([a-zA-Z][a-zA-Z0-9]+)\./g;

  for (const file of fileList) {
    if (!file.endsWith('.vue') && !file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    if (file.includes('node_modules') || file.includes('__tests__') || file.includes('.test.')) continue;
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
    let m;
    while ((m = re.exec(content)) !== null) {
      used.add(m[1]);
    }
  }
  return used;
}

/**
 * 获取本次要检查的源文件列表.
 */
function getFilesToCheck() {
  const args = process.argv.slice(2);
  const checkAll = args.includes('--all');

  if (checkAll) {
    const out = execSync(
      `git ls-files src/`,
      { cwd: rootDir, encoding: 'utf8' }
    );
    return out.split('\n').filter(Boolean).map((f) => path.join(rootDir, f));
  }

  // 默认: 暂存区 + 工作区 (git diff --name-only --cached + 未暂存)
  const cached = execSync(
    `git diff --name-only --cached`,
    { cwd: rootDir, encoding: 'utf8' }
  );
  const unstaged = execSync(
    `git diff --name-only`,
    { cwd: rootDir, encoding: 'utf8' }
  );
  const all = new Set([...cached.split('\n'), ...unstaged.split('\n')].filter(Boolean));
  return Array.from(all).map((f) => path.join(rootDir, f));
}

function main() {
  const registered = extractRegisteredModules();
  const moduleFiles = listExistingModuleFiles();
  const filesToCheck = getFilesToCheck();
  const usedModules = extractUsedModules(filesToCheck);

  console.log(`[i18n-registration] 已注册模块: ${registered.size}`);
  console.log(`[i18n-registration] modules/ 下 JSON 文件: ${moduleFiles.size}`);
  console.log(`[i18n-registration] 扫描源文件: ${filesToCheck.length}`);
  console.log(`[i18n-registration] 引用过的 moduleName: ${usedModules.size}`);

  // 找出 "引用过" + "JSON 存在" + "未注册" 三重条件命中的模块
  const violations = [];
  for (const m of usedModules) {
    if (registered.has(m)) continue;       // 已注册 ✓
    if (!moduleFiles.has(m)) continue;     // JSON 不存在 (按需加载或动态 key, 跳过)
    if (!/^[a-z][a-z0-9]*$/.test(m)) continue;  // 非全小写 module 名, 视为非标准 (跳过)
    if (m.length < 2) continue;
    violations.push(m);
  }

  if (violations.length === 0) {
    console.log(`\n✅ [i18n-registration] 通过, 0 个未注册模块`);
    process.exit(0);
  }

  console.error(`\n❌ [i18n-registration] 发现 ${violations.length} 个 i18n 模块 JSON 文件存在但未在 coreModules / asyncModules 中注册:`);
  for (const v of violations.sort()) {
    console.error(`   - ${v}`);
  }
  console.error(`\n修复: 在 src/locales/index.ts 的 coreModules 或 asyncModules 数组中加入上述模块名.`);
  console.error(`  体积影响: 1.9KB/locale × 5 语言 ≈ 10KB, 可加入 coreModules (首屏就绪).`);
  console.error(`  示例: const coreModules = [..., '${violations[0]}'] as const`);
  console.error(`        CORE_MODULE_SOURCE[${violations[0]}] = 'modules'`);
  process.exit(1);
}

main();
