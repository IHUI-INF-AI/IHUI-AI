#!/usr/bin/env node
/**
 * Vite dev server 守护进程 (2026-07-06 立)
 *
 * 目的: 监控 Vite dev server 子进程, 崩溃时自动重启, 彻底解决"Vite 反复崩溃"
 *       导致开发中断的问题.
 *
 * 根因背景:
 *   1. Vite 进程偶尔会因依赖优化失败 / 父进程被强杀 / 端口冲突 / 内存溢出
 *      等原因崩溃.
 *   2. 每次崩溃都需要用户手动 npm run dev 重新启动, 中断开发节奏.
 *   3. 崩溃后没有日志记录, 难以诊断根因.
 *
 * 防护策略:
 *   1. 拉起 vite 作为子进程, 透传 stdout/stderr 到终端 (用户能看到正常日志)
 *   2. 同时写入 dev-guardian.log 便于事后追溯
 *   3. 进程退出码 != 0 视为崩溃, 自动重启
 *   4. 退码 0 (正常退出, 例如用户主动 Ctrl+C) 不重启
 *   5. 最多连续重启 MAX_RESTARTS 次, 防止无限循环
 *   6. 每次重启前 sleep 退避: 1s, 2s, 4s, 8s (避免 OOM 后立即重启再 OOM)
 *   7. 捕获 SIGINT/SIGTERM 优雅退出 (Ctrl+C 时一并杀掉子进程)
 *
 * 用法:
 *   node scripts/dev-guardian.mjs -- vite --port 8888
 *
 * 退出码:
 *   0 - 正常退出 (用户主动 Ctrl+C)
 *   1 - 超过最大重启次数, 守护失败
 */

import { spawn, execSync } from 'child_process'
import { existsSync, mkdirSync, appendFileSync, createWriteStream } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const clientRoot = join(__dirname, '..')
const logDir = join(clientRoot, 'logs')
const logFile = join(logDir, 'dev-guardian.log')

if (!existsSync(logDir)) {
  try {
    mkdirSync(logDir, { recursive: true })
  } catch {}
}

// 解析透传给子进程的参数: -- vite --port 8888
const sepIdx = process.argv.indexOf('--')
if (sepIdx === -1) {
  console.error('[dev-guardian] 缺少子进程参数. 用法: node scripts/dev-guardian.mjs -- vite --port 8888')
  process.exit(1)
}
const childArgs = process.argv.slice(sepIdx + 1)
if (childArgs.length === 0) {
  console.error('[dev-guardian] 子进程参数为空. 用法: node scripts/dev-guardian.mjs -- vite --port 8888')
  process.exit(1)
}

const childCommand = childArgs[0]
const childRestArgs = childArgs.slice(1)
const MAX_RESTARTS = 3
const RESTART_BACKOFF = [1000, 2000, 4000, 8000] // ms, 每次失败后等待时间

// 2026-07-06 立: npm scripts 直接用 "vite" 启动时, npm 会自动把
// node_modules/.bin 加到 PATH. 但 dev-guardian 是 npm 的子进程,
// 它再 spawn 子进程时, env.PATH 不含 node_modules/.bin, 就会
// 报 "spawn vite ENOENT". 这里把 node_modules/.bin 拼到 PATH 头部解决.
const localBinDir = join(clientRoot, 'node_modules', '.bin')
const pathSep = process.platform === 'win32' ? ';' : ':'
process.env.PATH = `${localBinDir}${pathSep}${process.env.PATH || ''}`

let restartCount = 0
let child = null
let exiting = false
let lastExitInfo = { code: null, signal: null, time: 0 }

// 2026-07-07 立: stderr 环形缓冲区, 崩溃时写入日志便于诊断根因.
//   之前只透传 stderr 到终端, 日志文件只有 [exit] code=1, 无法追溯崩溃原因.
//   保留最近 200 行 stderr, 进程退出时刷新到日志文件.
const STDERR_RING_SIZE = 200
const stderrRing = []

function logToFile(line) {
  try {
    const ts = new Date().toISOString()
    appendFileSync(logFile, `[${ts}] ${line}\n`, 'utf-8')
  } catch {}
}

function flushStderrRing() {
  if (stderrRing.length === 0) return
  logToFile('--- stderr (最近输出, 用于诊断崩溃根因) ---')
  for (const line of stderrRing) {
    logToFile(`  [stderr] ${line}`)
  }
  logToFile('--- stderr 结束 ---')
  stderrRing.length = 0
}

function banner() {
  const sep = '═'.repeat(78)
  console.log('')
  console.log(sep)
  console.log('  [dev-guardian] Vite dev server 守护进程已启动')
  console.log(`  [dev-guardian] 子进程: ${childCommand} ${childRestArgs.join(' ')}`)
  console.log(`  [dev-guardian] 最大重启次数: ${MAX_RESTARTS}`)
  console.log(`  [dev-guardian] 日志文件: ${logFile}`)
  console.log(sep)
  console.log('')
}

function resolveCommand(cmd) {
  // 2026-07-06 立: Windows 上 Node.js spawn() 默认不识别 .cmd/.bat 后缀.
  //   Node 17+ 安全策略 (CVE-2024-27980) 进一步禁止直接 spawn .cmd/.bat
  //   不带 shell, 否则报 EINVAL.
  //   必须用 shell: true. 我们用数组形式传 args, 仍然安全 (不会拼接成字符串
  //   注入), 仅让 cmd.exe 解释 .cmd 后缀查找.
  //   macOS/Linux 不需要 .cmd 后缀, 也不需要 shell.
  return cmd
}

function spawnChild() {
  const resolvedCmd = resolveCommand(childCommand)
  const useShell = process.platform === 'win32'
  logToFile(`[spawn] ${resolvedCmd} ${childRestArgs.join(' ')} (attempt ${restartCount + 1}, shell=${useShell})`)
  const proc = spawn(resolvedCmd, childRestArgs, {
    cwd: clientRoot,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: useShell,
  })

  // 透传 stdout/stderr 到终端, 同时 stderr 写入环形缓冲区用于崩溃诊断
  proc.stdout.on('data', chunk => {
    process.stdout.write(chunk)
  })
  proc.stderr.on('data', chunk => {
    const text = chunk.toString('utf-8')
    process.stderr.write(chunk)
    // 写入环形缓冲区: 按行分割, 保留最近 STDERR_RING_SIZE 行
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    for (const line of lines) {
      if (stderrRing.length >= STDERR_RING_SIZE) {
        stderrRing.shift()
      }
      stderrRing.push(line)
    }
  })

  proc.on('exit', (code, signal) => {
    lastExitInfo = { code, signal, time: Date.now() }
    logToFile(`[exit] code=${code} signal=${signal}`)
    // 崩溃时 (code != 0) 刷新 stderr 环到日志, 便于事后诊断根因
    if (code !== 0 && code !== null) {
      flushStderrRing()
    }

    if (exiting) {
      // 主动退出, 不重启
      process.exit(code ?? 0)
      return
    }

    if (code === 0) {
      // 正常退出 (用户主动 Ctrl+C 后子进程优雅退出, 或者 vite 自己决定退出)
      console.log('')
      console.log('[dev-guardian] Vite 正常退出, 守护结束')
      logToFile('[guardian] 正常退出')
      process.exit(0)
      return
    }

    // 异常退出, 准备重启
    if (restartCount >= MAX_RESTARTS) {
      console.error('')
      console.error(`[dev-guardian] 已达最大重启次数 (${MAX_RESTARTS}), 守护失败`)
      console.error(`               最后一次退出码: ${code}, signal: ${signal}`)
      console.error(`               请检查 ${logFile} 获取详细日志`)
      logToFile(`[guardian] 重启耗尽, 退出`)
      process.exit(1)
      return
    }

    const backoff = RESTART_BACKOFF[Math.min(restartCount, RESTART_BACKOFF.length - 1)]
    restartCount++
    console.error('')
    console.error(`╔══════════════════════════════════════════════════════════════════════════════╗`)
    console.error(`║  [dev-guardian] Vite 异常退出 (code=${code} signal=${signal})`.padEnd(80) + '║')
    console.error(`║                   ${RESTART_BACKOFF.length - restartCount} 次后放弃, 等待 ${backoff}ms 后第 ${restartCount} 次重启`.padEnd(80) + '║')
    console.error(`╚══════════════════════════════════════════════════════════════════════════════╝`)
    console.error('')
    logToFile(`[restart] 第 ${restartCount} 次, 等待 ${backoff}ms`)

    setTimeout(() => {
      if (!exiting) {
        // 重启前重新执行端口清理, 避免累积僵尸
        // 2026-07-07 优化: 之前用 kill-port-8888.mjs (依赖 wmic 命令行匹配),
        //   但 shell:true spawn 的 cmd.exe 中间进程命令行不含 'vite', 会被跳过.
        //   改用直接 taskkill 杀所有监听 8888 的 PID, 更彻底.
        try {
          const pids = execSync('netstat -ano | findstr ":8888" | findstr "LISTENING"', {
            cwd: clientRoot, encoding: 'utf-8', timeout: 5000,
          }).trim()
          if (pids) {
            const pidSet = new Set()
            for (const line of pids.split(/\r?\n/)) {
              const m = line.match(/LISTENING\s+(\d+)/)
              if (m && m[1] !== '0') pidSet.add(m[1])
            }
            for (const pid of pidSet) {
              try {
                execSync(`taskkill /F /T /PID ${pid} 2>NUL`, { stdio: 'ignore' })
                logToFile(`[kill-port] 已杀 PID ${pid}`)
              } catch {}
            }
          }
        } catch {}
        try {
          child = spawnChild()
        } catch (e) {
          console.error('[dev-guardian] 重启失败:', e.message)
          logToFile(`[restart-fail] ${e.message}`)
          process.exit(1)
        }
      }
    }, backoff)
  })

  proc.on('error', err => {
    logToFile(`[error] ${err.message}`)
    console.error(`[dev-guardian] 子进程启动失败: ${err.message}`)
  })

  return proc
}

// 优雅退出: 收到 Ctrl+C 时先杀子进程再退出
function setupSignalHandlers() {
  const handle = (signal) => {
    if (exiting) return
    exiting = true
    console.log('')
    console.log(`[dev-guardian] 收到 ${signal}, 正在关闭子进程...`)
    logToFile(`[signal] ${signal}`)

    if (child && !child.killed) {
      try {
        if (process.platform === 'win32') {
          // Windows 上要杀子进程树, 用 taskkill /F /T
          execSync(`taskkill /F /T /PID ${child.pid} 2>NUL`, { stdio: 'ignore' })
        } else {
          child.kill('SIGTERM')
        }
      } catch (e) {
        // ignore
      }
    }

    // 给子进程 2s 优雅退出时间
    setTimeout(() => {
      process.exit(0)
    }, 2000)
  }

  process.on('SIGINT', () => handle('SIGINT'))
  process.on('SIGTERM', () => handle('SIGTERM'))
  // Windows 上 Ctrl+C 触发的是 SIGINT, 但 node v18+ 也支持 SIGBREAK
  process.on('SIGBREAK', () => handle('SIGBREAK'))
}

banner()
setupSignalHandlers()
child = spawnChild()
