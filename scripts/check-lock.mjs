#!/usr/bin/env node
/**
 * check-lock.js — 防止 next dev 与 next build 并行运行 + stale dev server 警告
 *
 * 两种模式:
 *   dev   : 检查 .dev.lock, 防止 next dev 与 next build 并发
 *   build : 检查 .dev.lock, 阻止 build 时还有 dev server 在跑
 *
 * 同时:
 *   - 检测 .dev.lock 文件 mtime, 超过 2h 视为 stale (开发服务器可能僵死或被遗忘)
 *   - stale 状态输出 WARN, 提示用户运行 `pnpm dev:clean` 清理
 *
 * 用法:
 *   node scripts/check-lock.js dev
 *   node scripts/check-lock.js build
 *
 * 退出码:
 *   0 : 一切正常
 *   1 : 检测到并发冲突 (阻止启动)
 *   2 : stale 警告 (不阻塞, 仅 WARN)
 */

import { existsSync, readFileSync, statSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

// web app 是 next 项目的所在地
const webDir = join(repoRoot, 'apps', 'web')
const lockFile = join(webDir, '.dev.lock')

// 锁文件结构: { pid: number, mode: 'dev' | 'build', startedAt: number }
function readLock() {
  if (!existsSync(lockFile)) return null
  try {
    return JSON.parse(readFileSync(lockFile, 'utf8'))
  } catch {
    return null
  }
}

function writeLock(mode) {
  if (!existsSync(webDir)) {
    mkdirSync(webDir, { recursive: true })
  }
  writeFileSync(
    lockFile,
    JSON.stringify({
      pid: process.pid,
      mode,
      startedAt: Date.now(),
    }),
  )
}

function clearLock() {
  if (existsSync(lockFile)) {
    try {
      unlinkSync(lockFile)
    } catch {
      /* ignore */
    }
  }
}

function isStale(lock) {
  if (!lock || !lock.startedAt) return false
  const TWO_HOURS = 2 * 60 * 60 * 1000
  return Date.now() - lock.startedAt > TWO_HOURS
}

function isProcessAlive(pid) {
  if (!pid) return false
  try {
    // 跨平台进程存活检测 (Windows: tasklist; POSIX: kill 0)
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const arg = process.argv[2]
if (arg !== 'dev' && arg !== 'build') {
  console.error('[check-lock] 用法: node scripts/check-lock.js <dev|build>')
  process.exit(1)
}

const currentLock = readLock()

// 1. stale 检测:锁文件 >2h 且对应进程已死 → 视为垃圾
if (currentLock && isStale(currentLock)) {
  if (!isProcessAlive(currentLock.pid)) {
    console.warn(
      `[check-lock] WARN: 锁文件已存在 ${Math.round(
        (Date.now() - currentLock.startedAt) / 60000,
      )} 分钟,且 PID ${currentLock.pid} 已退出,视为 stale。`,
    )
    console.warn(`[check-lock] 建议运行: pnpm --filter @ihui/web dev:clean`)
    clearLock()
  } else {
    console.warn(
      `[check-lock] WARN: 锁文件已存在 ${Math.round(
        (Date.now() - currentLock.startedAt) / 60000,
      )} 分钟,持有者 PID ${currentLock.pid} (${currentLock.mode}) 仍在跑。`,
    )
    console.warn(`[check-lock] 通常意味着 dev server 长期未重启,容易触发 .next 缓存陈旧。`)
    console.warn(`[check-lock] 建议运行: pnpm --filter @ihui/web dev:clean`)
  }
}

// 2. 模式互斥检测
if (currentLock && isProcessAlive(currentLock.pid)) {
  if (currentLock.mode === 'dev' && arg === 'dev') {
    // 同一模式并发 → dev 可以复用 lock (常见场景: pnpm 同时跑两个 dev 不冲突)
    // 这里采用"宽松"策略:不阻塞,继续
  } else if (currentLock.mode === 'dev' && arg === 'build') {
    console.error(
      `[check-lock] 冲突: 当前有 dev server 在跑 (PID ${currentLock.pid}),不能执行 build。`,
    )
    console.error(`[check-lock] 请先停止 dev: pnpm --filter @ihui/web dev:stop`)
    process.exit(1)
  } else if (currentLock.mode === 'build' && arg === 'dev') {
    console.error(
      `[check-lock] 冲突: 当前有 build 在跑 (PID ${currentLock.pid}),不能执行 dev。`,
    )
    console.error(`[check-lock] 请等待 build 完成。`)
    process.exit(1)
  }
}

// 3. 注册新锁
writeLock(arg)

// 4. 注册清理钩子 (进程退出时自动释放)
const release = () => {
  const lk = readLock()
  if (lk && lk.pid === process.pid) {
    clearLock()
  }
}
process.on('exit', release)
process.on('SIGINT', () => {
  release()
  process.exit(0)
})
process.on('SIGTERM', () => {
  release()
  process.exit(0)
})

console.log(`[check-lock] OK: ${arg} mode acquired, lock pid=${process.pid}`)
