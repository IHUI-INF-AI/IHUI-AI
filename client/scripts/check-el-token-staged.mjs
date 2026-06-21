#!/usr/bin/env node
/**
 * 检查暂存的 .vue/.scss 文件中新增的 --el-* token 使用
 * 规则: 新增代码应优先使用 --app-* 语义化 token,而非直接引用 --el-* token
 *
 * 用法: node scripts/check-el-token-staged.mjs
 *
 * 检查范围: 仅检查 git diff 中新增的行(+ 开头),不影响历史代码
 * 白名单目录: src/styles/ 和 src/components/design-system/ 允许使用 --el-* token
 * 例外 token: --el-color-primary/success/warning/danger 等无 --app-* 替代的 token
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// 1. 获取暂存的 .vue/.scss 文件列表
let staged = ''
try {
  staged = execSync('git diff --cached --name-only --diff-filter=ACM', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
} catch (_err) {
  console.log('✓ --el-* token 检查跳过（非 git 仓库或无暂存文件）')
  process.exit(0)
}

if (!staged) {
  console.log('✓ --el-* token 检查跳过（无暂存文件）')
  process.exit(0)
}

// 2. 筛选 .vue/.scss 文件
const files = staged
  .split('\n')
  .map((f) => f.trim())
  .filter((f) => {
    if (!/\.(vue|scss)$/.test(f)) return false
    if (!existsSync(f)) return false
    return f.startsWith('src/')
  })

if (files.length === 0) {
  console.log('✓ --el-* token 检查跳过（无暂存的 .vue/.scss 文件）')
  process.exit(0)
}

// 3. 白名单目录:这些目录允许使用 --el-* token
const WHITELIST_DIRS = [
  'src/styles/',
  'src/components/design-system/',
]

// 4. 例外 token:这些 --el-* token 允许在任意组件使用(无对应 --app-* 替代)
const EXCEPTION_TOKENS = new Set([
  '--el-color-primary',
  '--el-color-success',
  '--el-color-warning',
  '--el-color-danger',
  '--el-color-error',
  '--el-color-info',
  '--el-fill-color',
  '--el-fill-color-light',
  '--el-fill-color-lighter',
  '--el-fill-color-blank',
  '--el-fill-color-dark',
  '--el-fill-color-darker',
  '--el-transition',
  '--el-transition-duration',
  '--el-transition-function',
  '--el-overlay',
])

function isWhitelisted(filePath) {
  return WHITELIST_DIRS.some((dir) => filePath.startsWith(dir))
}

function isException(token) {
  if (EXCEPTION_TOKENS.has(token)) return true
  for (const ex of EXCEPTION_TOKENS) {
    if (token.startsWith(ex + '-') || token === ex) return true
  }
  return false
}

// 5. 获取文件的新增行(diff 中 + 开头的行)
function getAddedLines(file) {
  try {
    const diff = execSync(`git diff --cached --unified=0 -- "${file}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return diff
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => line.slice(1))
  } catch {
    return []
  }
}

// 6. 从行中提取 --el-* token
function extractElTokensFromLines(lines) {
  const tokens = new Set()
  const regex = /var\((--el-[\w-]+)/g
  for (const line of lines) {
    let match
    while ((match = regex.exec(line)) !== null) {
      tokens.add(match[1])
    }
  }
  return tokens
}

// 7. 检查每个文件
console.log(`▶ Checking --el-* token usage on ${files.length} staged file(s)...`)

let hasViolation = false
let totalViolations = 0

for (const file of files) {
  if (isWhitelisted(file)) continue

  const addedLines = getAddedLines(file)
  if (addedLines.length === 0) continue

  const elTokens = extractElTokensFromLines(addedLines)
  const violations = [...elTokens].filter((t) => !isException(t))

  if (violations.length > 0) {
    hasViolation = true
    totalViolations += violations.length
    console.error(`\n✗ ${file}`)
    violations.forEach((token) => {
      console.error(`    - ${token} (应使用 --app-* 语义化 token 替代)`)
    })
  }
}

if (hasViolation) {
  console.error(`\n::error::--el-* token 检查失败: ${totalViolations} 个违规`)
  console.error('::error::新增代码应优先使用 --app-* 语义化 token,而非直接引用 --el-* token')
  console.error('::error::可用 --app-* token: --app-surface-1/2, --app-text-primary/secondary/muted, --app-divider, --app-overlay')
  console.error('::error::如需使用 --el-* token,请将组件放在 src/components/design-system/ 目录下')
  process.exit(1)
}

console.log('✓ --el-* token 检查通过')
