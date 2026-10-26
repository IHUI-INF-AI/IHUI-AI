// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder chat 桥进程管理（2026-10-23 立）。
 *
 * 背景：Qoder chat 的真实端点 `/algo/api/v2/service/pro/sse/agent_chat_generation`
 * 要求 **umid 设备签名**（resources/umid/runtime-info.exe + sgsdk.dll 生成，外部不可复刻）；
 * 官方 Agent SDK 的 worker 自己会签名，且鉴权走 `jobToken`（worker 侧
 * applyExternalToken(token,"host-job-token")）——即 IDE 把 device token 交给 worker 的官方通道，
 * **不需要 PAT、不需要浏览器授权**。故 chat 必须经由本机桥进程转发，
 * 不能让 API 进程直连上游。
 *
 * 形态（对标项目内其它 start/stop 型常驻件，不新增 nssm 服务）：
 * - API 进程启动时后台唤起桥（Electron-as-Node 加载 asar 内 SDK），失败按指数退避重试；
 * - 桥只监听 127.0.0.1 随机端口，启动后 stdout 打一行 `QODER_BRIDGE_READY {json}`；
 * - 每次请求带随机 key（X-Qoder-Bridge-Key），防本机其它进程蹭用；
 * - 桥异常退出 → 端点作废，下一次 ensure 重新拉起。
 *
 * 安全：桥的工作目录固定为**空目录**（.runtime/qoder-bridge-cwd）。
 * 实测 worker 会自动读取 cwd 下的 AGENTS.md 等上下文喂给上游
 * （在仓库根跑会触发 AGENTS_MD_SIZE_THRESHOLD_REACHED 96KB），必须隔离。
 */
import { spawn, type ChildProcess } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
/** apps/api/src/services → repo root */
const REPO_ROOT = path.resolve(HERE, '../../../..')

const BRIDGE_SCRIPT =
  process.env.QODER_BRIDGE_SCRIPT?.trim() || path.join(REPO_ROOT, 'scripts/qoder-chat-bridge.mjs')
const BRIDGE_CWD =
  process.env.QODER_BRIDGE_CWD?.trim() || path.join(REPO_ROOT, '.runtime/qoder-bridge-cwd')

/** 冷启动预算（Electron 实际约 7s，给足余量；首次可能因磁盘冷缓存更慢） */
const READY_TIMEOUT_MS = Number(process.env.QODER_BRIDGE_READY_TIMEOUT_MS || 90_000)
const MAX_START_ATTEMPTS = Number(process.env.QODER_BRIDGE_START_ATTEMPTS || 3)

export const QODER_BRIDGE_UNAVAILABLE =
  'QODER_BRIDGE_UNAVAILABLE: 本机 Qoder chat 桥未就绪（需安装 Qoder CN 桌面端，或用 QODER_APP_DIR 指定安装根目录）'

export interface QoderBridgeEndpoint {
  baseUrl: string
  key: string
  pid: number
}

interface BridgeReadyLine {
  port: number
  pid: number
  runtime?: string
  cwd?: string
}

let endpoint: QoderBridgeEndpoint | null = null
let child: ChildProcess | null = null
let starting: Promise<QoderBridgeEndpoint | null> | null = null
let stopped = false
let consecutiveFailures = 0
let lastError = ''

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

/** 定位 Qoder CN 安装（与桥脚本内解析逻辑保持一致） */
export function resolveQoderAppRoot(): { root: string; version: string } | null {
  const candidates = [
    process.env.QODER_APP_DIR,
    'D:/电脑软件/Qoder CN',
    'C:/Program Files/Qoder CN',
    'C:/Program Files (x86)/Qoder CN',
  ].filter((x): x is string => typeof x === 'string' && x.length > 0)

  for (const dir of candidates) {
    if (!isDir(dir)) continue
    const versionsDir = path.join(dir, '.qoder-versions')
    if (isDir(versionsDir)) {
      const vers = fs
        .readdirSync(versionsDir)
        .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
        .sort((a, b) => {
          const pa = a.split('.').map(Number)
          const pb = b.split('.').map(Number)
          for (let i = 0; i < 3; i++) {
            const x = pa[i] ?? 0
            const y = pb[i] ?? 0
            if (x !== y) return y - x
          }
          return 0
        })
      for (const v of vers) {
        const root = path.join(versionsDir, v)
        if (isFile(path.join(root, 'Qoder CN.exe'))) return { root, version: v }
      }
    }
    if (isFile(path.join(dir, 'Qoder CN.exe'))) return { root: dir, version: 'unknown' }
  }
  return null
}

/** 当前可用端点；未就绪返回 null（调用方必须如实报错，不得伪造成功） */
export function getQoderBridgeEndpoint(): QoderBridgeEndpoint | null {
  return endpoint
}

export function describeQoderBridgeFailure(): string {
  return lastError ? `${QODER_BRIDGE_UNAVAILABLE} (${lastError})` : QODER_BRIDGE_UNAVAILABLE
}

function launchOnce(): Promise<QoderBridgeEndpoint> {
  const app = resolveQoderAppRoot()
  if (!app) {
    throw new Error('未找到 Qoder CN 安装（可用 QODER_APP_DIR 指定）')
  }
  if (!isFile(BRIDGE_SCRIPT)) {
    throw new Error(`桥脚本缺失: ${BRIDGE_SCRIPT}`)
  }
  fs.mkdirSync(BRIDGE_CWD, { recursive: true })

  const exe = path.join(app.root, 'Qoder CN.exe')
  const key = crypto.randomBytes(16).toString('hex')

  return new Promise<QoderBridgeEndpoint>((resolve, reject) => {
    const proc = spawn(exe, [BRIDGE_SCRIPT, '--port', '0', '--key', key, '--cwd', BRIDGE_CWD], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    child = proc

    let settled = false
    let buffer = ''
    const errTail: string[] = []

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }

    const timer = setTimeout(() => {
      finish(() => {
        try {
          proc.kill()
        } catch {
          /* ignore */
        }
        reject(new Error(`桥启动超时（${READY_TIMEOUT_MS}ms 内未就绪）`))
      })
    }, READY_TIMEOUT_MS)

    proc.stdout?.on('data', (buf: Buffer) => {
      buffer += buf.toString('utf8')
      let idx = buffer.indexOf('QODER_BRIDGE_READY ')
      while (idx >= 0) {
        const nl = buffer.indexOf('\n', idx)
        if (nl < 0) return // 等这一行收完
        const line = buffer.slice(idx + 'QODER_BRIDGE_READY '.length, nl).trim()
        buffer = buffer.slice(nl + 1)
        try {
          const info = JSON.parse(line) as BridgeReadyLine
          if (Number.isInteger(info.port) && info.port > 0) {
            finish(() =>
              resolve({
                baseUrl: `http://127.0.0.1:${info.port}`,
                key,
                pid: info.pid ?? proc.pid ?? 0,
              }),
            )
            return
          }
        } catch {
          /* 继续找下一行 */
        }
        idx = buffer.indexOf('QODER_BRIDGE_READY ')
      }
    })

    proc.stderr?.on('data', (buf: Buffer) => {
      const s = buf.toString('utf8').trim()
      if (!s) return
      errTail.push(s)
      if (errTail.length > 12) errTail.shift()
    })

    proc.on('error', (e) => {
      finish(() => reject(new Error(`桥进程启动失败: ${e.message}`)))
    })

    proc.on('exit', (code, signal) => {
      // 端点作废：下一次 ensure 会重新拉起
      endpoint = null
      if (child === proc) child = null
      const tail = errTail.join(' | ').slice(-400)
      finish(() =>
        reject(
          new Error(`桥进程提前退出 code=${code} signal=${signal}${tail ? ` :: ${tail}` : ''}`),
        ),
      )
    })
  })
}

/**
 * 确保桥可用（幂等，可并发调用）。
 * 已就绪直接返回；启动中就复用同一个 Promise；失败按次数上限重试。
 */
export async function ensureQoderBridge(): Promise<QoderBridgeEndpoint | null> {
  if (stopped) return null
  if (endpoint) return endpoint
  if (starting) return starting

  starting = (async () => {
    for (let attempt = 1; attempt <= MAX_START_ATTEMPTS; attempt++) {
      try {
        const ep = await launchOnce()
        endpoint = ep
        consecutiveFailures = 0
        lastError = ''
        console.info(`[qoder-bridge] ready pid=${ep.pid} ${ep.baseUrl}`)
        return ep
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e)
        consecutiveFailures++
        console.warn(`[qoder-bridge] 启动失败(${attempt}/${MAX_START_ATTEMPTS}): ${lastError}`)
        if (attempt < MAX_START_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, Math.min(2000 * attempt, 6000)))
        }
      }
    }
    return null
  })()

  try {
    return await starting
  } finally {
    starting = null
  }
}

/** API 启动时后台预热；不抛、不阻塞主流程 */
export function startQoderBridge(): void {
  stopped = false
  // 没装 Qoder CN 的机器不必拉起 Electron(否则要白等 3 轮退避才报错)
  if (!resolveQoderAppRoot()) {
    lastError = '未找到 Qoder CN 安装（可用 QODER_APP_DIR 指定）'
    return
  }
  void ensureQoderBridge().then((ep) => {
    if (!ep) console.warn('[qoder-bridge] 未就绪，qoder chat 将如实报错（不影响签到/配额/refresh）')
  })
}

/** 关停桥进程（进程退出钩子调用） */
export function stopQoderBridge(): void {
  stopped = true
  endpoint = null
  const p = child
  child = null
  if (!p) return
  try {
    p.kill('SIGTERM')
  } catch {
    /* ignore */
  }
  setTimeout(() => {
    try {
      p.kill('SIGKILL')
    } catch {
      /* ignore */
    }
  }, 3000).unref?.()
}

/** 观测面用：桥的当前状态（不进健康检查轮询，管理面按需读） */
export function qoderBridgeStatus(): {
  ready: boolean
  baseUrl: string | null
  pid: number | null
  consecutiveFailures: number
  lastError: string
} {
  return {
    ready: endpoint !== null,
    baseUrl: endpoint?.baseUrl ?? null,
    pid: endpoint?.pid ?? null,
    consecutiveFailures,
    lastError,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
