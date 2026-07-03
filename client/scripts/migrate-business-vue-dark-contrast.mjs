#!/usr/bin/env node
/**
 * 业务 .vue 文件暗色反色自动迁移脚本 (2026-07-04 终结批次立)
 *
 * 自动替换 color: var(--el-color-{success|warning|danger|info|primary}) →
 *         color: var(--app-color-{type}-text)
 *
 * 策略:
 * - 只处理 color: 字段 (不碰 background-color) - 用负向 lookbehind 排除 background-/border-/outline-color
 * - 替换所有变体 (含 -light-X / -dark-X) → 都用 -text 后缀
 * - 不区分 :hover / :active / :focus 等状态块 (因为这些 token 在暗色下都撞色)
 * - 输出 diff 让用户确认
 *
 * 用法: node scripts/migrate-business-vue-dark-contrast.mjs [--apply]
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')

const APPLY = process.argv.includes('--apply')

const SEARCH_DIRS = [
  path.join(clientRoot, 'src', 'components'),
  path.join(clientRoot, 'src', 'views'),
]

const EXCLUDE_DIRS = ['styles', 'design-system', 'node_modules', '__tests__']

const COLOR_TYPE_MAP = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  primary: 'primary',
}

// 匹配 color: var(--el-color-{type}[可选 -light-X / -dark-X])
// 关键: (?<![-a-zA-Z]) 负向 lookbehind 排除 background-color / border-color / outline-color
const COLOR_RE = /(?<![-a-zA-Z])color\s*:\s*var\(--el-color-(success|warning|danger|info|primary)(?:-light-\d+)?(?:-dark-\d+)?\)/g

let totalFilesScanned = 0
let totalFilesChanged = 0
let totalReplacements = 0
const changedFiles = []

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.includes(entry.name)) continue
      walkDir(fullPath)
    } else if (entry.isFile() && entry.name.endsWith('.vue')) {
      processFile(fullPath)
    }
  }
}

function processFile(filePath) {
  totalFilesScanned++
  const src = fs.readFileSync(filePath, 'utf-8')
  let count = 0
  const newSrc = src.replace(COLOR_RE, (m, type) => {
    const newType = COLOR_TYPE_MAP[type] || type
    count++
    return `color: var(--app-color-${newType}-text)`
  })
  if (count > 0) {
    totalFilesChanged++
    totalReplacements += count
    changedFiles.push({ file: filePath, count })
    if (APPLY) {
      fs.writeFileSync(filePath, newSrc, 'utf-8')
    }
  }
}

console.log(`[migrate-business-vue-dark-contrast] ${APPLY ? '应用模式' : '预览模式 (--apply 实际修改)'}`)
console.log(`扫描目录: ${SEARCH_DIRS.map(d => path.relative(clientRoot, d)).join(', ')}\n`)

for (const dir of SEARCH_DIRS) {
  if (fs.existsSync(dir)) walkDir(dir)
}

console.log(`扫描 ${totalFilesScanned} 个 .vue 文件`)
console.log(`匹配需改: ${totalFilesChanged} 个文件, ${totalReplacements} 处替换\n`)

if (changedFiles.length > 0) {
  console.log('受影响文件 (前 30):')
  for (const { file, count } of changedFiles.slice(0, 30)) {
    console.log(`  ${path.relative(clientRoot, file)}: ${count} 处`)
  }
  if (changedFiles.length > 30) {
    console.log(`  ... 还有 ${changedFiles.length - 30} 个文件省略`)
  }
  console.log('')
}

if (!APPLY) {
  console.log('⚠️  这是预览模式, 实际修改需加 --apply 参数:')
  console.log('   node scripts/migrate-business-vue-dark-contrast.mjs --apply')
} else {
  console.log('✓ 已实际修改所有匹配文件')
  console.log('  建议: git diff 检查改动, 然后跑 e2e + 全量 lint 验证')
}
