#!/usr/bin/env node
// scripts/dev-web.mjs
//
// 启动 @ihui/web dev server 并管理进程树生命周期,杜绝僵尸 next-server 进程。
//
// 关键问题:Start-Process powershell -Command "pnpm dev" 启动方式下,PowerShell 进程
// 退出时不会把 next-server 的子进程(workers)带走,反复重启会积累 35+ 僵尸 node 进程。
//
// 本脚本:
// 1. 启动前 taskkill /F /T 杀掉端口 3000 上残留进程树(避免 EADDRINUSE)
// 2. 用 child_process.spawn 跟踪 pnpm 进程,而不是 Start-Process detached
// 3. 注册 SIGINT / SIGTERM / exit handler,退出时用 taskkill /F /T 杀整棵进程树
// 4. 启动后实时 stdout 显示,失败立即抛错
//
// 用法:
//   node scripts/dev-web.mjs                          # 启动 web
//   node scripts/dev-web.mjs --clean                  # 启动前清 .next 缓存
//   node scripts/dev-web.mjs --port 3001              # 指定端口
//   Ctrl+C 退出时自动清理进程树
//
// 不要在 dev server 假死时裸用 Start-Process pnpm dev 启动下一轮,永远用本脚本!

import { spawn, execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const PORT = (process.argv.find((a) => a.startsWith('--port='))?.split('=')[1]) ||
             (process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : '3000')
const CLEAN = process.argv.includes('--clean')

console.log(`[dev-web] target port: ${PORT}`)
console.log(`[dev-web] clean .next cache: ${CLEAN}`)

// 1. 杀端口残留进程树
function killPort(port) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $p=$_.OwningProcess; if ($p -gt 0) { taskkill /F /T /PID $p 2>&1 | Out-Null } }"`,
      { stdio: 'pipe' }
    ).toString()
    if (out.trim()) console.log(`[dev-web] killed port ${port} tree:\n${out.trim()}`)
    else console.log(`[dev-web] port ${port} already free`)
  } catch (e) {
    // powershell 偶尔返回非 0 退出码但实际杀成功,不阻断
    console.log(`[dev-web] port ${port} cleanup warning: ${e.message.split('\n')[0]}`)
  }
}

killPort(PORT)

// 2. 可选清 .next
if (CLEAN) {
  const nextDir = join(ROOT, 'apps', 'web', '.next')
  if (existsSync(nextDir)) {
    rmSync(nextDir, { recursive: true, force: true })
    console.log('[dev-web] cleared apps/web/.next')
  }
}

// 3. spawn pnpm(不是 detached,父进程能跟踪)
// pnpm --filter 不能用 -- 分隔,参数直接跟在子命令后
const child = spawn(
  'pnpm',
  ['--filter', '@ihui/web', 'dev', '-p', PORT],
  {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32', // Windows 必须 shell:true 才能跑 pnpm.cmd
    windowsHide: true,
  }
)

let killing = false
function killTree(signal) {
  if (killing) return
  killing = true
  console.log(`\n[dev-web] received ${signal}, killing process tree (PID ${child.pid})...`)
  try {
    execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: 'inherit' })
    console.log('[dev-web] process tree killed')
  } catch (e) {
    console.log(`[dev-web] taskkill warning: ${e.message.split('\n')[0]}`)
  }
  process.exit(0)
}

process.on('SIGINT', () => killTree('SIGINT'))
process.on('SIGTERM', () => killTree('SIGTERM'))
process.on('SIGHUP', () => killTree('SIGHUP'))
process.on('exit', () => {
  if (!killing) killTree('exit')
})

child.on('exit', (code, signal) => {
  console.log(`[dev-web] child exited code=${code} signal=${signal}`)
  if (!killing) process.exit(code ?? 0)
})
child.on('error', (err) => {
  console.error('[dev-web] child error:', err)
  process.exit(1)
})
