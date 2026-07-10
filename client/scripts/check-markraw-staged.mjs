#!/usr/bin/env node
/**
 * 检查暂存的 .vue/.ts 文件是否违反 ihui/markraw-icon 规则
 * 响应式对象（ref/reactive/computed）中的组件 icon 必须用 markRaw 包装
 *
 * 用法：node scripts/check-markraw-staged.mjs
 *
 * 跨平台实现（Windows 无 bash/WSL 也可运行）
 * 仅检查 src/ 和 e2e/ 目录下的文件，避免检查依赖和构建产物
 * 分批处理避免命令行过长（Windows CMD 限制 8191 字符）
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// 1. 获取暂存的 .vue/.ts/.tsx 文件列表
let staged = ''
try {
  staged = execSync('git diff --cached --name-only --diff-filter=ACM', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
} catch (_err) {
  console.log('✓ markraw-icon 检查跳过（非 git 仓库或无暂存文件）')
  process.exit(0)
}

if (!staged) {
  console.log('✓ markraw-icon 检查跳过（无暂存文件）')
  process.exit(0)
}

// 2. 筛选 src/ 和 e2e/ 目录下的 .vue/.ts/.tsx 文件（且文件存在）
const files = staged
  .split('\n')
  .map((f) => f.trim())
  .filter((f) => {
    if (!/\.(vue|ts|tsx)$/.test(f)) return false
    if (!existsSync(f)) return false
    return f.startsWith('src/') || f.startsWith('e2e/') || f.startsWith('composables/')
  })

if (files.length === 0) {
  console.log('✓ markraw-icon 检查跳过（无暂存的源码 .vue/.ts 文件）')
  process.exit(0)
}

// 3. 分批运行 eslint 检查 ihui/markraw-icon 规则
//    Windows CMD 命令行长度限制 8191 字符，每批最多 50 个文件
//    直接用 node 调用 eslint CLI，避免 shell:true 触发 DEP0190 弃用警告
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

// eslint CLI 入口文件
const eslintEntry = resolve('node_modules/eslint/bin/eslint.js')

const BATCH_SIZE = 50
const batches = []
for (let i = 0; i < files.length; i += BATCH_SIZE) {
  batches.push(files.slice(i, i + BATCH_SIZE))
}

console.log(`▶ Checking markraw-icon rule on ${files.length} staged source file(s) in ${batches.length} batch(es)...`)

for (let i = 0; i < batches.length; i++) {
  const batch = batches[i]
  // 用 node 直接调用 eslint.js，避免 shell 引号解析和 DEP0190 警告
  const result = spawnSync(process.execPath, [
    eslintEntry,
    '--rule',
    JSON.stringify({ 'ihui/markraw-icon': 'error' }),
    '--no-ignore',
    ...batch,
  ], { stdio: 'inherit' })

  if (result.status !== 0) {
    console.error(`::error::markraw-icon 检查失败（第 ${i + 1} 批）：响应式对象中的组件 icon 必须用 markRaw() 包装`)
    console.error('::error::可运行 npx eslint <file> --fix 自动修复')
    process.exit(1)
  }
}
console.log('✓ markraw-icon 检查通过')

