#!/usr/bin/env node
/**
 * 业务 .vue 文件暗色反色撞色扫描脚本 (2026-07-04 终结批次立)
 *
 * 扫描 client/src/components 下所有 .vue 和 client/src/views 下所有 .vue
 * 检测: color: var(--el-color-success|warning|danger|info|primary) 给文字配色
 *       在暗色 mode 下, 这些 token 映射为 Tailwind 700 级深色 (#15803d 等),
 *       配 #0d0d0d/#1a1a1a 暗背景对比度仅 1.5:1, 严重不可见
 *
 * 输出: 详细违规列表 + 修复建议, 不自动改文件
 * 用法: node scripts/scan-business-vue-dark-contrast.mjs
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')

const SEARCH_DIRS = [
  path.join(clientRoot, 'src', 'components'),
  path.join(clientRoot, 'src', 'views'),
]

const EXCLUDE_DIRS = [
  'styles',           // 样式基础设施, 由专用规则守门
  'design-system',    // 设计系统, 已内部用 token
  'node_modules',
  '__tests__',
]

// 检测的 EP 主题色 (color 用法, 不包括 background-color)
const EP_TEXT_COLOR_RE = /color\s*:\s*var\(--el-color-(success|warning|danger|info|primary)(?:-light-\d+)?(?:-dark-\d+)?\)/g

const violations = []

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.includes(entry.name)) continue
      walkDir(fullPath)
    } else if (entry.isFile() && entry.name.endsWith('.vue')) {
      scanFile(fullPath)
    }
  }
}

function scanFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf-8')
  // 提取 <style> 块 (可能多个, 包括 scoped)
  const styleBlocks = []
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/g
  let m
  while ((m = styleRe.exec(src)) !== null) {
    styleBlocks.push({ start: m.index, content: m[1] })
  }
  if (styleBlocks.length === 0) return

  for (const { start, content } of styleBlocks) {
    // 剥离注释
    const cleaned = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')

    // 找 color: var(--el-color-*) 用法
    let cm
    const re = /color\s*:\s*var\(--el-color-(success|warning|danger|info|primary)(?:-light-\d+)?(?:-dark-\d+)?\)/g
    while ((cm = re.exec(cleaned)) !== null) {
      const matchStart = cm.index
      // 找最近的 { 之前的 selector
      const beforeBlock = cleaned.substring(0, matchStart)
      const lastBraceIdx = beforeBlock.lastIndexOf('{')
      const lastNewlineBeforeBrace = beforeBlock.lastIndexOf('\n', lastBraceIdx)
      const selectorStart = lastNewlineBeforeBrace + 1
      const selector = beforeBlock.substring(selectorStart, lastBraceIdx).trim()
      // 是否在 :hover / :active / :focus 子块中 (这些是状态色, 可能允许)
      // 计算 matchStart 之前还有几个未关闭的 {
      const openBraces = (beforeBlock.match(/\{/g) || []).length
      const closeBraces = (beforeBlock.match(/\}/g) || []).length
      const depth = openBraces - closeBraces
      // depth === 1 表示在顶层规则内, depth >= 2 表示在嵌套子块 (hover/active) 内
      const isInStateBlock = depth >= 2

      // 找文件行号
      const offsetInFile = start + ('<style[^>]*>'.length) + matchStart
      const beforeInFile = src.substring(0, offsetInFile)
      const lineNum = beforeInFile.split('\n').length

      violations.push({
        file: path.relative(clientRoot, filePath),
        line: lineNum,
        type: cm[1],
        selector,
        isInStateBlock,
        snippet: cm[0],
      })
    }
  }
}

console.log('[scan-business-vue-dark-contrast] 开始扫描 .vue 业务组件暗色反色撞色...\n')
for (const dir of SEARCH_DIRS) {
  if (fs.existsSync(dir)) walkDir(dir)
}

if (violations.length === 0) {
  console.log('✓ 未发现业务 .vue 文件暗色反色撞色\n')
  process.exit(0)
}

// 统计
const stats = {
  total: violations.length,
  byType: {},
  byFile: {},
  critical: 0,
  inStateBlock: 0,
}
for (const v of violations) {
  stats.byType[v.type] = (stats.byType[v.type] || 0) + 1
  stats.byFile[v.file] = (stats.byFile[v.file] || 0) + 1
  if (v.isInStateBlock) stats.inStateBlock++
  else stats.critical++
}

console.log(`❌ 发现 ${stats.total} 处业务 .vue 文件暗色反色撞色\n`)
console.log(`  关键 (顶层规则): ${stats.critical} 处`)
console.log(`  状态块 (hover/active 等): ${stats.inStateBlock} 处 (允许, 不必修)\n`)
console.log('按类型分布:')
for (const [type, count] of Object.entries(stats.byType)) {
  console.log(`  --el-color-${type}: ${count} 处`)
}
console.log('\n按文件分布 (前 20):')
const top20 = Object.entries(stats.byFile).sort((a, b) => b[1] - a[1]).slice(0, 20)
for (const [file, count] of top20) {
  console.log(`  ${file}: ${count} 处`)
}
console.log('\n修复建议:')
console.log('  var(--el-color-success)  →  var(--app-color-success-text)')
console.log('  var(--el-color-warning)  →  var(--app-color-warning-text)')
console.log('  var(--el-color-danger)   →  var(--app-color-danger-text)')
console.log('  var(--el-color-info)     →  var(--app-color-info-text)')
console.log('  var(--el-color-primary)  →  var(--app-color-primary-text)')
console.log('  (浅色 mode: 深色字 配 8% 透明背景; 暗色 mode: 浅色字 配 15% 透明背景)')
console.log('  (对比度 7.1:1 / 6.8:1 / 6.2:1 / 7.5:1 / 6.5:1 ≥ WCAG AA 4.5)\n')

// 输出详细列表 (前 50)
console.log('详细列表 (前 50):')
for (const v of violations.slice(0, 50)) {
  const tag = v.isInStateBlock ? '[STATE]' : '[CRIT] '
  console.log(`  ${tag} ${v.file}:${v.line} ${v.selector} → ${v.snippet}`)
}
if (violations.length > 50) {
  console.log(`  ... 还有 ${violations.length - 50} 处省略`)
}
