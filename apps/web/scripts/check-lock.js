#!/usr/bin/env node
/**
 * 防止 next dev 与 next build 并行运行导致 .next 缓存冲突（dev server 500 根因）。
 * 用法：
 *   node scripts/check-lock.js dev   — 启动 dev 前检查无 build lock
 *   node scripts/check-lock.js build — 启动 build 前检查无 dev lock
 * 退出码 0 = 可继续；1 = 检测到冲突，终止。
 */
import fs from 'fs'
import path from 'path'

const mode = process.argv[2]
if (mode !== 'dev' && mode !== 'build') {
  console.error('[lock] 用法: node scripts/check-lock.js <dev|build>')
  process.exit(1)
}

const lockDir = path.resolve(process.cwd(), '.next')
const devLock = path.join(lockDir, 'dev.lock')
const buildLock = path.join(lockDir, 'build.lock')
const myLock = mode === 'dev' ? devLock : buildLock
const otherLock = mode === 'dev' ? buildLock : devLock
const otherName = mode === 'dev' ? 'build' : 'dev'

if (fs.existsSync(otherLock)) {
  let pid = '未知'
  try {
    pid = fs.readFileSync(otherLock, 'utf8').trim()
  } catch {
    // 读取失败忽略
  }
  console.error(
    `\x1b[31m[lock] 检测到 ${otherName} 锁文件存在（PID: ${pid}）。\x1b[0m\n` +
      `[lock] 请先停止 ${otherName} 进程再运行 ${mode}，否则会互相破坏 .next 缓存导致 500。\n` +
      `[lock] 如确认无 ${otherName} 进程在运行，可删除 ${path.relative(process.cwd(), otherLock)} 后重试。`,
  )
  process.exit(1)
}

fs.mkdirSync(lockDir, { recursive: true })
fs.writeFileSync(myLock, String(process.pid))
console.log(`[lock] ${mode} 锁已创建（PID: ${process.pid}）`)

const cleanup = () => {
  try {
    if (fs.existsSync(myLock)) fs.unlinkSync(myLock)
  } catch {
    // 清理失败忽略
  }
}
process.on('exit', cleanup)
process.on('SIGINT', () => {
  cleanup()
  process.exit(0)
})
process.on('SIGTERM', () => {
  cleanup()
  process.exit(0)
})
