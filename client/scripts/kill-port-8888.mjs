#!/usr/bin/env node
/**
 * 端口清理脚本 (2026-07-06 立)
 *
 * 目的: 彻底终结占用 8888 端口的 zombie Vite 进程, 防止 "Vite 反复崩溃" 问题.
 *
 * 根因背景:
 *   1. 用户/agent 多次启动 dev 但没彻底杀掉旧进程 (TaskStop/StopCommand 只停止
 *      监听, 不杀子进程树), 导致 vite 进程长期占用 8888 端口 (实测 PID 28908
 *      占用 296.5MB, 6 个 ESTABLISHED 连接).
 *   2. 新的 vite 启动时端口冲突, npm 脚本被系统 SIGTERM 杀掉, 表现为
 *      "Vite 启动几秒后 exit code -1".
 *   3. 形成 "启动 → 端口冲突 → npm 杀掉 → 用户再启动 → 又冲突" 的死循环.
 *
 * 防护策略:
 *   1. 启动前先检查 8888 端口占用
 *   2. 找到占用进程 PID, 用 taskkill /F /T 强制终结 (含子进程树)
 *   3. 等待端口释放 (最多 5s, 间隔 200ms 探测)
 *   4. 不抛错, 任何异常都降级为 warn 继续执行 (不能让端口清理阻塞 dev 启动)
 *
 * 用法:
 *   node scripts/kill-port-8888.mjs           # 清理 8888 端口
 *   node scripts/kill-port-8888.mjs --port 9000  # 清理自定义端口
 *
 * 退出码:
 *   0 - 端口已释放 (无论是否原本被占用)
 *   1 - 端口释放失败 (但脚本继续, 不阻塞 dev)
 */

import { execSync } from 'child_process'
import { platform } from 'os'

const targetPort = (() => {
  const idx = process.argv.indexOf('--port')
  if (idx !== -1 && process.argv[idx + 1]) {
    return parseInt(process.argv[idx + 1], 10)
  }
  return 8888
})()

const isWindows = platform() === 'win32'
const currentPid = process.pid

function exec(cmd, options = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options,
    })
  } catch (e) {
    // 命令返回非 0 退出码也吞掉, 我们自己处理
    return e.stdout?.toString() || ''
  }
}

function findPidsByPort(port) {
  if (!isWindows) {
    // macOS/Linux: lsof -ti :PORT
    const out = exec(`lsof -ti :${port}`)
    return out
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n))
  }

  // Windows: 2026-07-07 优化 — 旧代码 exec('netstat -ano') 输出全部连接 (数千行),
  //   然后逐行正则匹配, 耗时 2-3 秒. 改用 netstat -ano | findstr 过滤,
  //   只返回匹配端口的行, 耗时降至 100ms 以内.
  const out = exec(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`)
  const pids = new Set()
  for (const line of out.split('\n')) {
    const m = line.match(new RegExp(`[:.]${port}\\s.*LISTENING\\s+(\\d+)\\s*$`))
    if (m) {
      const pid = parseInt(m[1], 10)
      if (!isNaN(pid) && pid !== 0 && pid !== currentPid) {
        pids.add(pid)
      }
    }
  }
  return Array.from(pids)
}

function isNodeViteProcess(pid) {
  // 验证这个进程是否真的是 Vite, 避免误杀
  if (isWindows) {
    // 2026-07-07 优化: wmic 已在 Windows 11 中废弃, 且启动慢 (~500ms-1s).
    //   改用 PowerShell Get-CimInstance, 更快且兼容新版 Windows.
    //   同时收紧匹配条件: 之前 cmd.includes('node') 会匹配所有 node 进程,
    //   现在只匹配包含 'vite' 或 '8888' 的命令行.
    const out = exec(
      `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"ProcessId=${pid}\\").CommandLine" 2>NUL`
    )
    const cmd = out.toLowerCase()
    return cmd.includes('vite') || cmd.includes('8888')
  }
  // macOS/Linux
  const out = exec(`ps -p ${pid} -o command= 2>/dev/null`)
  return out.toLowerCase().includes('vite')
}

function killPid(pid) {
  if (isWindows) {
    // /F 强制 /T 终结子进程树, 2>NUL 抑制错误输出
    exec(`taskkill /F /T /PID ${pid} 2>NUL`)
  } else {
    exec(`kill -9 ${pid} 2>/dev/null`)
  }
}

function waitForPortRelease(port, maxMs = 5000) {
  // 2026-07-07 优化: 旧实现用 while(Date.now() < waitUntil) {} busy wait,
  //   导致 CPU 100% 占用. 改用 execSync 调用 PowerShell Start-Sleep 做同步等待,
  //   让出 CPU 给其他进程.
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const pids = findPidsByPort(port)
    if (pids.length === 0) return true
    // 同步等待 200ms, 使用 PowerShell 而非 busy wait
    try {
      execSync('powershell -NoProfile -Command "Start-Sleep -Milliseconds 200"', { timeout: 1000 })
    } catch {
      // PowerShell 不可用时降级为 busy wait (最后手段)
      const waitUntil = Date.now() + 200
      while (Date.now() < waitUntil) {}
    }
  }
  return findPidsByPort(port).length === 0
}

const t0 = Date.now()
const pids = findPidsByPort(targetPort)

if (pids.length === 0) {
  // 端口空闲, 不输出, 保持 dev 启动日志干净
  process.exit(0)
}

console.log('')
console.log('╔══════════════════════════════════════════════════════════════════════════════╗')
console.log(`║  [端口清理] 检测到 ${targetPort} 端口被 ${pids.length} 个进程占用, 强制终结`.padEnd(80) + '║')
console.log('╚══════════════════════════════════════════════════════════════════════════════╝')

let killedCount = 0
for (const pid of pids) {
  if (pid === currentPid) {
    console.log(`  [跳过] PID ${pid} (当前进程)`)
    continue
  }

  const isVite = isNodeViteProcess(pid)
  if (!isVite && !isWindows) {
    // macOS/Linux 下非 Vite 进程要更谨慎, 避免误杀
    console.log(`  [跳过] PID ${pid} (非 Vite 进程, 跳过保护)`)
    continue
  }

  console.log(`  [kill] PID ${pid} (${isVite ? 'Vite/Node' : '待终结'}) ...`)
  killPid(pid)
  killedCount++
}

// 等待端口释放
const released = waitForPortRelease(targetPort, 5000)
const remainingPids = findPidsByPort(targetPort)
const elapsed = ((Date.now() - t0) / 1000).toFixed(2)

if (released) {
  console.log(`  [OK] 端口 ${targetPort} 已释放, 耗时 ${elapsed}s, 终结 ${killedCount} 个进程`)
  console.log('')
  process.exit(0)
} else {
  console.warn(`  [WARN] 端口 ${targetPort} 仍被占用, 剩余 PID: ${remainingPids.join(', ')}`)
  console.warn('          (dev 启动后可能仍会冲突, 但不阻塞当前流程)')
  console.log('')
  // 不阻塞 dev 启动, 让 Vite 自己处理 EADDRINUSE
  process.exit(0)
}
