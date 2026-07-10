#!/usr/bin/env node
/**
 * 小程序预览脚本。
 * 启动 miniapp H5 开发服务器并输出预览 URL。
 */
import { spawn } from 'node:child_process'

console.log('[miniapp-preview] 启动小程序 H5 预览服务器...')

const child = spawn('pnpm', ['--filter', '@ihui/miniapp', 'dev:h5'], {
  stdio: 'inherit',
  shell: true,
})

child.on('error', (err) => {
  console.error('[miniapp-preview] ❌ 启动失败:', err.message)
  process.exit(1)
})

// 5秒后输出预览 URL
setTimeout(() => {
  console.log('\n[miniapp-preview] 📱 预览 URL: http://localhost:5173')
  console.log('[miniapp-preview] 按 Ctrl+C 停止\n')
}, 5000)
