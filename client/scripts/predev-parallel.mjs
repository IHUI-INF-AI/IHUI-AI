#!/usr/bin/env node
/**
 * 并行 predev 脚本 (2026-07-07 立)
 *
 * 目的: 将 predev 链路中的三个独立脚本并行执行, 从串行 ~3.5s 降到 ~2.7s.
 *
 * 旧链路 (串行): kill-port-8888 (2.6s) → clean-vite-cache (0.6s) → check-orphan-stash (0.3s) = 3.5s
 * 新链路 (并行): 三个脚本同时执行, 总耗时 = max(2.6s, 0.6s, 0.3s) ≈ 2.6s
 *
 * 依赖关系: 三个脚本之间无依赖
 *   - kill-port: 只检查端口占用, 与文件系统无关
 *   - clean-vite-cache: 只扫描 node_modules/.vite_clean, 与端口无关
 *   - check-orphan-stash: 只检查 git stash list, 与前两者无关
 *
 * 用法: node scripts/predev-parallel.mjs
 * 退出码: 0=全部成功, 1=任一失败
 */
import { spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const clientRoot = join(__dirname, '..')

const scripts = [
  { name: 'kill-port', file: 'kill-port-8888.mjs' },
  { name: 'clean-cache', file: 'clean-vite-cache.mjs' },
  { name: 'orphan-stash', file: 'check-orphan-stash.mjs' },
]

const results = await Promise.allSettled(
  scripts.map(({ name, file }) => {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', [join(__dirname, file)], {
        cwd: clientRoot,
        stdio: 'inherit',
        env: process.env,
      })
      proc.on('exit', (code) => {
        if (code === 0) resolve({ name, code })
        else reject(new Error(`${name} exited with code ${code}`))
      })
      proc.on('error', (err) => reject(new Error(`${name}: ${err.message}`)))
    })
  })
)

const failed = results.filter(r => r.status === 'rejected')
if (failed.length > 0) {
  for (const f of failed) {
    console.error(f.reason.message)
  }
  process.exit(1)
}
process.exit(0)
