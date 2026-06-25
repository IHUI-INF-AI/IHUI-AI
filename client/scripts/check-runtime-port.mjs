/**
 * 运行时后端端口检测器 (2026-06-25 新增)
 *
 * 作用: 检测运行中的 uvicorn / python 进程监听端口, 若非 8000 则报警.
 *       弥补 check-port-drift.mjs 只检测字面量散落、不检测运行时进程的盲区.
 *
 * 触发场景:
 *   - AI 助手/开发者临时改端口启动后端 (如 8001)
 *   - 旧进程残留监听非标准端口
 *   - 环境变量 BACKEND_PORT 污染导致启动到错误端口
 *
 * 用法:
 *   cd client && node scripts/check-runtime-port.mjs
 *   期望: [OK] 后端运行在 8000 端口 (或后端未运行)
 *   违规: [ERROR] 发现 uvicorn 监听 8001, 违反端口规范, 请改回 8000
 *
 * 退出码:
 *   0 = 通过 (后端在 8000 或未运行)
 *   1 = 违规 (发现后端监听非 8000 端口)
 *
 * 规范文档: client/docs/DEV_PORTS.md "运行时启动规范" 章节
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const EXPECTED_PORT = 8000
// 允许的非 8000 监听端口 (运维侧, 非后端业务)
const ALLOWED_NON_BACKEND_PORTS = [8888, 4173, 9090, 6379]

/**
 * 用 netstat 查询所有 LISTENING 端口, 返回 [{port, pid, protocol}]
 * 跨平台: Windows 用 netstat, Linux/Mac 也可用 netstat
 */
function getListeningPorts() {
  try {
    const output = execSync('netstat -ano', { encoding: 'utf8', timeout: 10000 })
    const ports = []
    for (const line of output.split('\n')) {
      // Windows: TCP 127.0.0.1:8000 0.0.0.0:0 LISTENING 12345
      // Linux:  tcp 0 0 127.0.0.1:8000 0.0.0.0:* LISTEN 12345/python3
      const m = line.match(/(?:TCP|tcp)\s+\S+:(\d+)\s+\S+\s+(?:LISTENING|LISTEN)\s+(\d+)/)
      if (m) {
        ports.push({ port: parseInt(m[1], 10), pid: parseInt(m[2], 10) })
      }
    }
    return ports
  } catch {
    return []
  }
}

/**
 * 用 tasklist (Windows) 或 ps (Linux/Mac) 查 PID 对应进程名
 */
function getProcessName(pid) {
  if (!pid || pid === 0) return ''
  try {
    // Windows: tasklist /FI "PID eq 12345" /FO CSV /NH
    if (process.platform === 'win32') {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
        encoding: 'utf8',
        timeout: 5000,
      }).trim()
      // "python.exe","12345","Console","1","50,000 K"
      const m = out.match(/^"([^"]+)"/)
      return m ? m[1] : ''
    }
    // Linux/Mac: ps -p 12345 -o comm=
    const out = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8', timeout: 5000 }).trim()
    return out
  } catch {
    return ''
  }
}

/**
 * 判断进程是否是后端 (uvicorn / python 运行 app.main)
 * 排除: python -m http.server (临时文件服务器, 非项目后端)
 */
function isBackendProcess(pid) {
  if (!pid || pid === 0) return false
  try {
    let cmdline = ''
    if (process.platform === 'win32') {
      // 用 WMI 获取完整命令行 (tasklist 不返回命令行)
      const out = execSync(
        `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"ProcessId=${pid}\\").CommandLine"`,
        { encoding: 'utf8', timeout: 8000 }
      ).trim()
      cmdline = out
    } else {
      const out = execSync(`cat /proc/${pid}/cmdline 2>/dev/null | tr '\\0' ' '`, {
        encoding: 'utf8',
        timeout: 5000,
      }).trim()
      cmdline = out
    }
    if (!cmdline) return false
    const lower = cmdline.toLowerCase()
    // 必须包含 uvicorn 或 app.main (项目后端特征)
    // 排除 python -m http.server (临时文件服务器)
    if (lower.includes('http.server')) return false
    return lower.includes('uvicorn') || lower.includes('app.main')
  } catch {
    return false
  }
}

function main() {
  console.log('=== 运行时后端端口检测 ===')
  console.log(`期望端口: ${EXPECTED_PORT}`)
  console.log()

  const ports = getListeningPorts()
  if (ports.length === 0) {
    console.log('[WARN] 无法获取端口列表 (netstat 不可用?), 跳过检测')
    process.exit(0)
  }

  // 检查 8000 是否在监听
  const on8000 = ports.filter(p => p.port === EXPECTED_PORT)
  // 检查是否有后端进程监听非 8000 端口
  const violations = []

  for (const { port, pid } of ports) {
    if (port === EXPECTED_PORT) continue
    if (ALLOWED_NON_BACKEND_PORTS.includes(port)) continue
    // 检查这个端口对应的进程是否是后端 (uvicorn/app.main)
    if (isBackendProcess(pid)) {
      const name = getProcessName(pid) || 'unknown'
      violations.push({ port, pid, name })
    }
  }

  // 输出结果
  if (on8000.length > 0) {
    const names = on8000.map(p => getProcessName(p.pid)).filter(Boolean)
    console.log(`[OK] 8000 端口有服务监听${names.length ? ` (${names.join(', ')})` : ''}`)
  } else {
    console.log('[INFO] 8000 端口无服务监听 (后端可能未启动)')
  }

  if (violations.length === 0) {
    console.log('[OK] 未发现后端进程监听非 8000 端口')
    console.log()
    console.log('=== 检测通过 ===')
    process.exit(0)
  } else {
    console.log()
    console.log('[ERROR] 发现后端进程监听非 8000 端口, 违反端口规范:')
    for (const v of violations) {
      console.log(`  - PID ${v.pid} (${v.name}) 监听 ${v.port} 端口`)
    }
    console.log()
    console.log('处理方法:')
    console.log(`  1. 停掉违规进程: Stop-Process -Id <PID> -Force`)
    console.log(`  2. 确认 8000 端口空闲: netstat -ano | findstr ":8000"`)
    console.log(`  3. 用 8000 端口启动后端:`)
    console.log(`     cd server && .venv\\Scripts\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`)
    console.log()
    console.log('规范文档: client/docs/DEV_PORTS.md "运行时启动规范" 章节')
    console.log()
    console.log('=== 检测失败 ===')
    process.exit(1)
  }
}

main()
