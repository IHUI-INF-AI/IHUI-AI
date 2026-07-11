#!/usr/bin/env node
/**
 * 依赖版本碎片化检查脚本
 *
 * 用途：检测 pnpm-lock.yaml 是否存在可去重的依赖版本（同一包的多个不必要版本）。
 *       防止依赖版本碎片化再次发生（项目曾因 @types/react 18/19 混存导致类型错误）。
 *
 * 触发场景：
 *   - pre-commit 钩子（在依赖变更时检查）
 *   - CI 检查
 *   - 手动怀疑依赖碎片化时运行
 *
 * 用法：pnpm check:dedupe
 *       pnpm check:dedupe --staged  (pre-commit 模式，仅当 pnpm-lock.yaml 变更时检查)
 */
import { spawnSync, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const LOCKFILE = resolve(ROOT, 'pnpm-lock.yaml')

const isStaged = process.argv.includes('--staged')

// pre-commit 模式：仅当 pnpm-lock.yaml 在暂存区时才检查
if (isStaged) {
  let staged = ''
  try {
    staged = execSync('git diff --cached --name-only', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
  } catch {
    // 非 git 环境或无暂存文件，跳过
    process.exit(0)
  }
  if (!staged.split('\n').some((f) => f.trim() === 'pnpm-lock.yaml')) {
    console.log('[check:dedupe] pnpm-lock.yaml 未变更，跳过碎片化检查。')
    process.exit(0)
  }
}

if (!existsSync(LOCKFILE)) {
  console.log('[check:dedupe] 未找到 pnpm-lock.yaml，跳过检查。')
  process.exit(0)
}

console.log('[check:dedupe] 检查依赖版本碎片化（pnpm dedupe --check）...')

const result = spawnSync('pnpm dedupe --check', {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
})

if (result.status === 0) {
  console.log('[check:dedupe] 通过：无碎片化依赖版本。')
  process.exit(0)
}

console.error('[check:dedupe] 失败：检测到可去重的依赖版本。')
console.error('[check:dedupe] 请运行 `pnpm dedupe` 然后提交更新后的 pnpm-lock.yaml。')
process.exit(result.status ?? 1)
