#!/usr/bin/env node
/**
 * 小程序预览脚本。
 * 启动 miniapp H5 开发服务器并输出预览 URL。
 */
import { spawn, execSync } from 'node:child_process'

console.log('[miniapp-preview] 启动小程序 H5 预览服务器...')

const child = spawn('pnpm', ['--filter', '@ihui/miniapp', 'dev:h5'], {
  stdio: 'inherit',
  shell: true,
})

child.on('error', (err) => {
  console.error('[miniapp-preview] ❌ 启动失败:', err.message)
  process.exit(1)
})

// P2 修复(2026-07-31):进程树清理,避免 Ctrl+C 后 pnpm spawn 的 vite/taro 子进程成为孤儿。
// 与 scripts/dev-web.mjs 同模式,使用 taskkill /F /T 杀整棵进程树(Windows)。
let killing = false
function killTree(signal) {
  if (killing) return
  killing = true
  if (child.pid) {
    try {
      execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'ignore' })
    } catch {
      /* ignore — 子进程可能已退出 */
    }
  }
  if (signal !== 'exit') process.exit(0)
}
process.on('SIGINT', () => killTree('SIGINT'))
process.on('SIGTERM', () => killTree('SIGTERM'))
process.on('SIGHUP', () => killTree('SIGHUP'))
process.on('exit', () => killTree('exit'))

// 5秒后输出预览 URL
setTimeout(() => {
  console.log('\n[miniapp-preview] 📱 预览 URL: http://localhost:5173')
  console.log('[miniapp-preview] 按 Ctrl+C 停止\n')
}, 5000)
