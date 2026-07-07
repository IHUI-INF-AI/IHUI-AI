#!/usr/bin/env node
/**
 * 守门脚本：确保 .el-popper.is-dark tooltip 样式单一来源
 *
 * 历史问题 (2026-07-06):
 *  - tooltip 文字色与背景色撞色不可见反复发生
 *  - 根因: .el-popper.is-dark 样式散落在 3+ 文件, 意图各异, 层级不同
 *  - _element-plus-overrides.scss 的 html.dark 块内 unlayered 规则压制了
 *    _global-ui.scss @layer base 和 dark-mode-override.scss @layer utilities
 *    内的正确规则 (CSS Cascade Layers 优先级反转: unlayered > layered)
 *
 * 修复方案:
 *  - _global-ui.scss: tooltip 单一来源 (浅底深字 / 深底浅字)
 *  - _element-plus-overrides.scss: 纳入 @layer components, 删除暗色错误规则
 *  - dark-mode-override.scss: @layer utilities 内的 background-color 统一深色
 *
 * 本脚本扫描所有 .scss 文件, 检测非白名单文件定义 .el-popper.is-dark 的
 * background/color/border-color 样式, 防止回归.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const STYLES_DIR = resolve(ROOT, 'src/styles')

// 白名单: 允许定义 .el-popper.is-dark 颜色样式的文件
const WHITELIST = new Set([
  '_global-ui.scss',           // tooltip 单一来源 (@layer base)
  '_element-plus-overrides.scss', // 浅色模式覆盖 (@layer components)
  'dark-mode-override.scss',   // 暗色模式背景 (@layer utilities)
  '_element-plus.scss',        // 未被导入但保留以防未来导入
])

// 检测 .el-popper.is-dark 附近是否有颜色样式定义
// 匹配模式: .el-popper.is-dark { ... color/background/border-color: ... }
// 或 :where(.el-popper.is-dark) { ... color/background/border-color: ... }
const COLOR_STYLE_PATTERN = /\.el-popper\.is-dark[\s\S]{0,500}?\b(background|background-color|color|border-color)\s*:/i

// 收集所有 .scss 文件 (递归, 排除 .bak)
function collectScssFiles(dir, files = []) {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      collectScssFiles(fullPath, files)
    } else if (entry.endsWith('.scss') && !entry.endsWith('.bak')) {
      files.push(fullPath)
    }
  }
  return files
}

const files = collectScssFiles(STYLES_DIR)
let failed = 0
let checked = 0

for (const file of files) {
  const relPath = relative(STYLES_DIR, file)
  const content = readFileSync(file, 'utf8')

  // 跳过: fixes.scss 的 .el-popper.is-dark 用于 display:none (非颜色样式)
  // 但仍需检测是否有颜色样式, 所以不能直接跳过
  if (COLOR_STYLE_PATTERN.test(content)) {
    checked++
    if (!WHITELIST.has(relPath)) {
      console.error(`[FAIL] ${relPath} 定义了 .el-popper.is-dark 的颜色样式, 但不在白名单中`)
      console.error(`       白名单: ${Array.from(WHITELIST).join(', ')}`)
      console.error(`       修复: 把该规则迁移到 _global-ui.scss (tooltip 单一来源)`)
      failed++
    } else {
      console.log(`[ OK ] ${relPath} (白名单内)`)
    }
  }
}

if (failed > 0) {
  console.error(`\n❌ 失败 ${failed} 项: 非白名单文件定义了 .el-popper.is-dark 颜色样式`)
  console.error('   这会导致 tooltip 样式冲突, 可能引发文字/背景撞色不可见问题')
  console.error('   根因: CSS Cascade Layers 优先级反转 (unlayered > layered)')
  console.error('   修复: 删除该规则, 改由 _global-ui.scss 单一来源定义')
  process.exit(1)
}

console.log(`\n✅ 检查通过 (${checked} 个文件定义了 .el-popper.is-dark 样式, 全部在白名单内)`)
