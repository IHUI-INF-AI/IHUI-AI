// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桥体检：从管理台一眼看出「本机桥到底活没活、用的哪个驱动、是不是在跑本地库」。
 *
 * 以前只能去 PowerShell 里 curl /status，或者看计划任务状态；出了问题先怀疑是库的问题。
 * 这里只做一件事——按账号凭据去请求桥的 /status，3 秒内必须有结果（超时就是不可达），
 * 把驱动、账号、队列长度这些关键字段原样带回来，不做任何推测。
 */

import { assertAccountForUser } from './guards.js'
// 凭据是加密存的，必须走 loadRuntime 解出来；直接读行的 credentials 字段会永远是空。
import { loadRuntime } from './adapter-factory.js'
import { asNumber, asRecord, asString } from './views.js'

/** 探活超时：桥在本机，3 秒还没回就是真有问题，不值得让面板转圈。 */
const PROBE_TIMEOUT_MS = 3_000

export interface BridgeProbeView {
  /** 桥地址，去掉末尾斜杠后的完整 URL。 */
  baseUrl: string
  /** 3 秒内有 HTTP 响应即为 true（哪怕是 401，也说明进程活着）。 */
  reachable: boolean
  httpStatus: number | null
  latencyMs: number
  /** 桥自报的驱动名：db / uia / ocr / mock。 */
  driver: string | null
  online: boolean | null
  /** 驱动内部状态文案，例如 db-sidecar-ready。 */
  status: string | null
  mode: string | null
  /** 桥实际读的是哪个微信账号目录。 */
  account: string | null
  queued: number | null
  momentSeq: number | null
  error: string | null
}

function firstOf(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null
  for (const key of keys) {
    const value = asString(record[key])
    if (value) return value
  }
  return null
}

/** 把桥 /status 的 JSON 摊成本面板认识的字段；读不懂的键一律 null，不猜。 */
export function readBridgeStatusPayload(
  payload: unknown,
): Pick<BridgeProbeView, 'driver' | 'online' | 'status' | 'mode' | 'account' | 'queued' | 'momentSeq'> {
  const record = asRecord(payload)
  return {
    driver: firstOf(record, ['driver']),
    online: record && typeof record.online === 'boolean' ? record.online : null,
    status: firstOf(record, ['status', 'state']),
    mode: firstOf(record, ['mode', 'driverMode']),
    account: firstOf(record, ['account', 'accountDir', 'user']),
    queued: asNumber(record?.queued),
    momentSeq: asNumber(record?.momentSeq),
  }
}

/**
 * 探一次桥。任何异常都折成 reachable=false + error 文案返回，不抛给调用方，
 * 因为「桥没起来」是常见状态，不是接口错误。
 */
export async function probeBridgeForAccount(
  userId: string,
  accountId: string,
): Promise<BridgeProbeView> {
  const account = await assertAccountForUser(userId, accountId)
  const runtime = loadRuntime(account)
  const baseUrl = (asString(runtime.credentials.baseUrl) ?? '').replace(/\/$/, '')
  const token = asString(runtime.credentials.token) ?? ''
  const statusPath = asString(runtime.credentials.statusPath) ?? '/status'
  const empty: BridgeProbeView = {
    baseUrl,
    reachable: false,
    httpStatus: null,
    latencyMs: 0,
    driver: null,
    online: null,
    status: null,
    mode: null,
    account: null,
    queued: null,
    momentSeq: null,
    error: null,
  }
  if (!baseUrl) return { ...empty, error: '账号没配桥地址（credentials.baseUrl）' }

  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
    headers['x-bridge-secret'] = token
  }
  const started = Date.now()
  try {
    const response = await fetch(`${baseUrl}${statusPath}`, {
      headers,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    const latencyMs = Date.now() - started
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
    return {
      ...empty,
      ...readBridgeStatusPayload(payload),
      reachable: true,
      httpStatus: response.status,
      latencyMs,
      error: response.ok ? null : `桥返回 HTTP ${response.status}`,
    }
  } catch (error) {
    const latencyMs = Date.now() - started
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    return {
      ...empty,
      latencyMs,
      error: timedOut ? '3 秒内没有响应（桥可能没启动或端口不通）' : `连不上桥：${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
    }
  }
}
