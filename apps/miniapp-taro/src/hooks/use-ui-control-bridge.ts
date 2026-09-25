// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 Taro 运行时(前后台生命周期 / connectSocket / eventCenter),不适合共享
import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { createNotificationClient, fetchApi } from '@ihui/api-client'
import {
  createAssignmentTokenLedger,
  isAgentActionAssignedToInstance,
  unassignedAgentActionLogMessage,
  withRespondedIdentity,
  type AgentActionSelfIdentity,
} from '@ihui/shared/utils/agent-action-addressing'
import type {
  AgentActionAssignment,
  AgentActionRequest,
  AgentActionResponse,
  AgentControlCapability,
  TaroUiActionType,
  WSNotification,
} from '@ihui/types'

import {
  configureTaroUiBridge,
  executeTaroUiAction,
  resetTaroUiBridge,
  type TaroUiActionResult,
} from '@/lib/ui-action-registry'
import { BASE_URL } from '@/utils/api-config'
import { getToken } from '@/utils/auth'
import { logger } from '@/utils/logger'
import { taroWebSocketFactory } from '@/utils/taro-websocket-adapter'

/**
 * AI 对话操控小程序端的桥接层(2026-09-21 立)。
 *
 * 与 web 端 use-ui-control-bridge.ts / RN 端同一条 agent-control 链路,只换
 * category='miniapp_ui' + endpoint='miniapp':
 *   能力上报(POST /api/agent-control/capability,60s 保活)
 *   → 通知 WS 收 {type:'notification', data:{type:'agent.action', request}}
 *   → ui-action-registry 执行
 *   → POST /api/agent-control/result 回传(executedBy:'miniapp',data 必带 instanceId)。
 *
 * 小程序特有的降级事实(决定了本文件的生命周期设计):
 * 切后台 5s 后 JS 线程被挂起,连接必断、timer 必停转,api 侧 ENDPOINT_TTL_MS=5min 后
 * 判该端离线 —— 所以 `TARGET_NOT_CONNECTED` 是**常态**而非故障。故:
 *  - onAppShow 才建连 + 起保活 timer;
 *  - onAppHide 立即停 timer + 主动断连(绝不在后台空转制造注定失败的请求);
 *  - 所有失败只走 logger.warn(默认级别 error,真机零噪音),不弹 toast。
 *
 * 外部前置(代码做不到,必须人工配置):微信公众平台 → 开发管理 → 服务器域名 →
 * **socket 合法域名**须包含 `wss://<api host>`(如 wss://aizhs.top),否则真机
 * `Taro.connectSocket` 直接 fail(链路安静降级为"AI 拿不到小程序端",不崩不刷屏)。
 */

/** api 侧 ENDPOINT_TTL_MS=5min,保活周期必须显著短于它 */
const CAPABILITY_INTERVAL_MS = 60_000
/** 启动时静默登录是异步的,冷启后再各补一次(避免最长等 60s 才上报能力) */
const AUTH_CATCHUP_DELAYS_MS: readonly number[] = [5_000, 20_000]
const PROCESSED_IDS_MAX = 100
const VERSION = '1.0.0'

const TARO_UI_ACTIONS: readonly TaroUiActionType[] = [
  'describe',
  'navigate',
  'read',
  'invoke',
  'click',
  'fill',
  'submit',
]

/**
 * 实例 ID:每次冷启一个新值,故意不做 storage 持久化 ——
 * 小程序每次冷启都是全新的 JS 运行时与全新的 WS 连接,沿用旧 ID 只会让 api
 * 侧把上一条已死连接的注册记录当成活跃端。
 */
const INSTANCE_ID = `taro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export function getTaroInstanceId(): string {
  return INSTANCE_ID
}

/**
 * 定址投递(2026-09-26,五桥共用 `@ihui/shared/utils/agent-action-addressing` 那一份判据):
 * api 的 WS 按 userId 广播,`assignment` 由服务端派发时写入载荷 —— 非指派到本端的指令不得
 * 执行,且留可诊断日志(不静默 return);回执原样回显服务端 token + 自报本实例。
 * 载荷缺 assignment = 旧服务端形态,逐字走改前路径(含回执不带 responded)。
 */
const assignmentTokens = createAssignmentTokenLedger(PROCESSED_IDS_MAX)

function selfIdentity(): AgentActionSelfIdentity {
  return { endpoint: 'miniapp', instanceId: INSTANCE_ID }
}

/* ────────────────────────── WS URL(绕开 new URL 坑) ────────────────────────── */

const ABSOLUTE_HTTP_RE = /^(https?):\/\/([^/?#]+)/i

/**
 * 由 HTTP(S) 基址拼通知 WS 地址。
 *
 * 为什么不用 @ihui/api-client 的 buildNotificationWsUrl:它内部 `new URL(baseUrl)`,
 * 微信真机 JSCore 不保证有 WHATWG URL 构造器,一抛错就整条 WS 静默不建(这正是
 * 本端通知链路从未被真机验证过的原因)。这里只用正则取 scheme + authority(host:port),
 * 并剥离 BASE_URL 的 /api 路径前缀 —— 与 `new URL(base).host` 的取值完全等价。
 *
 * 返回 '' 表示无法推导(如 H5 dev 的相对基址 '/api'),调用方据此跳过建连。
 */
export function buildTaroNotificationWsUrl(baseUrl: string, token: string): string {
  const match = ABSOLUTE_HTTP_RE.exec(baseUrl.trim())
  const scheme = match?.[1]?.toLowerCase()
  const authority = match?.[2]
  if (!scheme || !authority) return ''
  return `${scheme === 'https' ? 'wss' : 'ws'}://${authority}/ws/notifications?token=${encodeURIComponent(token)}`
}

/* ────────────────────────── 消息解析与去重 ────────────────────────── */

/** requestId 去重:WS 重连后服务端可能重推同一指令,重复执行会重复导航 */
const processedIds = new Set<string>()

function rememberRequestId(requestId: string): void {
  processedIds.add(requestId)
  if (processedIds.size <= PROCESSED_IDS_MAX) return
  // 只保留最近一半,避免长跑内存增长
  for (const id of Array.from(processedIds).slice(0, Math.floor(PROCESSED_IDS_MAX / 2))) {
    processedIds.delete(id)
  }
}

function extractAgentEnvelope(payload: unknown): {
  request: AgentActionRequest
  assignment?: AgentActionAssignment
} | null {
  if (!payload || typeof payload !== 'object') return null
  const outer = payload as Record<string, unknown>
  const data =
    outer.type === 'notification' && outer.data && typeof outer.data === 'object'
      ? (outer.data as Record<string, unknown>)
      : undefined
  if (!data || data.type !== 'agent.action') return null
  const request = data.request
  if (!request || typeof request !== 'object') return null
  const assignment = data.assignment as AgentActionAssignment | undefined
  return { request: request as AgentActionRequest, ...(assignment ? { assignment } : {}) }
}

function isTaroUiAction(action: unknown): action is TaroUiActionType {
  return typeof action === 'string' && (TARO_UI_ACTIONS as readonly string[]).includes(action)
}

/* ────────────────────────── HTTP 上报 ────────────────────────── */

/**
 * 走 @ihui/api-client 的 fetchApi(小程序侧已由 app.tsx 注入 Taro transport),
 * 刻意不复用 utils/api-bridge 的 post():那个封装会 toast + 401 跳登录页,
 * 而后台保活请求失败绝不能打扰用户(AGENTS.md §3 要求 HTTP 一律走 api-client)。
 */
async function postQuiet<TBody, TRes>(url: string, body: TBody, action: string): Promise<void> {
  try {
    const res = await fetchApi<TRes>(url, { method: 'POST', body: JSON.stringify(body) })
    if (!res.success) logger.warn('ui-bridge', action, res.error ?? '接口返回失败')
  } catch (err) {
    logger.warn('ui-bridge', action, err instanceof Error ? err.message : '请求异常')
  }
}

function buildCapability(): AgentControlCapability {
  return {
    endpoint: 'miniapp',
    instanceId: INSTANCE_ID,
    taroUiActions: [...TARO_UI_ACTIONS],
    version: VERSION,
    reportedAt: new Date().toISOString(),
  }
}

async function reportCapability(): Promise<void> {
  if (!getToken()) return
  await postQuiet('/api/agent-control/capability', buildCapability(), '上报小程序端能力')
}

async function reportResult(response: AgentActionResponse): Promise<void> {
  // 回执身份回显:只回显服务端派发过的 token + 自报本实例(无 token = 旧服务端形态,原样回传)
  await postQuiet(
    '/api/agent-control/result',
    withRespondedIdentity(response, assignmentTokens, selfIdentity()),
    '回传小程序端执行结果',
  )
}

function toResponse(
  request: AgentActionRequest,
  result: TaroUiActionResult,
  startedAt: number,
): AgentActionResponse {
  return {
    requestId: request.requestId,
    success: result.ok,
    ...(result.error !== undefined ? { error: result.error } : {}),
    ...(result.errorCode !== undefined ? { errorCode: result.errorCode } : {}),
    // 每条应答都带自身 instanceId:api 侧 targetInstanceId 据此把后续动作钉回本实例
    data: { ...(result.data ?? {}), instanceId: INSTANCE_ID },
    durationMs: Math.max(0, Date.now() - startedAt),
    executedBy: 'miniapp',
  }
}

/* ────────────────────────── WS 消息处理 ────────────────────────── */

function handleAgentAction(request: AgentActionRequest, assignment?: AgentActionAssignment): void {
  // 定址过滤(2026-09-26):非指派到本端不得执行,且留可诊断痕迹(不得静默 return)
  if (!isAgentActionAssignedToInstance(assignment, selfIdentity())) {
    logger.warn(
      'ui-bridge',
      'agent.action dropped',
      unassignedAgentActionLogMessage(request.requestId, assignment, selfIdentity()),
    )
    return
  }
  if (processedIds.has(request.requestId)) return
  // api 按 userId 广播,同用户多设备都会收到;被钉定给别的实例时静默让位,
  // 否则两台手机会各自执行一次同一条指令(旧服务端无 assignment 时这是唯一防撞手段)
  if (request.targetInstanceId && request.targetInstanceId !== INSTANCE_ID) return
  rememberRequestId(request.requestId)
  if (assignment) assignmentTokens.remember(request.requestId, assignment.token)

  if (!isTaroUiAction(request.action)) {
    void reportResult({
      requestId: request.requestId,
      success: false,
      error: `小程序端不支持的动作: ${String(request.action)}`,
      errorCode: 'UNSUPPORTED_ACTION',
      data: { instanceId: INSTANCE_ID },
      durationMs: 0,
      executedBy: 'miniapp',
    })
    return
  }

  const startedAt = Date.now()
  const params = (request.params ?? {}) as Record<string, unknown>
  void executeTaroUiAction(request.action, params)
    .then((result) => toResponse(request, result, startedAt))
    .catch((err): AgentActionResponse =>
      toResponse(
        request,
        {
          ok: false,
          error: err instanceof Error ? err.message : '执行异常',
          errorCode: 'EXECUTION_FAILED',
        },
        startedAt,
      ),
    )
    .then(reportResult)
}

function handleWsNotification(msg: WSNotification): void {
  // 保留 app.tsx 既有的广播契约:其他消费者仍可 Taro.eventCenter.on('wsNotification')
  try {
    Taro.eventCenter.trigger('wsNotification', msg)
  } catch {
    // eventCenter 异常不影响本端执行
  }
  const envelope = extractAgentEnvelope(msg)
  if (!envelope) return
  const { request, assignment } = envelope
  if (request.category !== 'miniapp_ui') return
  if (typeof request.requestId !== 'string' || !request.requestId) return
  handleAgentAction(request, assignment)
}

/** 测试面(2026-09-26 定址投递票,与 web 端 use-agent-control.ts 同形态):只读驱动,不开写接口 */
export const __test__ = {
  handleWsNotification,
  selfIdentity,
}

/* ────────────────────────── 生命周期(前后台) ────────────────────────── */

type WsClient = ReturnType<typeof createNotificationClient>

let capabilityTimer: ReturnType<typeof setInterval> | null = null
const catchupTimers: ReturnType<typeof setTimeout>[] = []
let wsClient: WsClient | null = null
let foreground = false
let lifecycleRegistered = false

function ensureConnected(): void {
  if (wsClient) return
  if (!getToken()) return
  if (!buildTaroNotificationWsUrl(BASE_URL, 'probe')) return
  wsClient = createNotificationClient(
    { baseUrl: BASE_URL, tokenProvider: () => getToken() || null },
    { onMessage: handleWsNotification },
    {
      webSocketFactory: taroWebSocketFactory,
      urlBuilder: (token) => buildTaroNotificationWsUrl(BASE_URL, token),
    },
  )
  wsClient.connect()
}

function clearTimers(): void {
  if (capabilityTimer) {
    clearInterval(capabilityTimer)
    capabilityTimer = null
  }
  for (const timer of catchupTimers) clearTimeout(timer)
  catchupTimers.length = 0
}

function enterForeground(): void {
  if (foreground) return
  foreground = true
  void reportCapability()
  ensureConnected()
  capabilityTimer = setInterval(() => {
    ensureConnected()
    void reportCapability()
  }, CAPABILITY_INTERVAL_MS)
  // 静默登录在 useLaunch 里是异步的,冷启后补两次(定时器在 onAppHide 一律清掉)
  for (const delay of AUTH_CATCHUP_DELAYS_MS) {
    catchupTimers.push(
      setTimeout(() => {
        if (!foreground) return
        ensureConnected()
        void reportCapability()
      }, delay),
    )
  }
}

function leaveForeground(): void {
  if (!foreground) return
  foreground = false
  clearTimers()
  if (wsClient) {
    try {
      wsClient.disconnect()
    } catch {
      // 断开失败无需处理:本端已不再消费消息
    }
    wsClient = null
  }
}

function registerLifecycle(): void {
  if (lifecycleRegistered) return
  lifecycleRegistered = true
  // onAppShow/onAppHide 仅 weapp/tt/harmony 支持(支付宝、H5 无):缺 API 时退化为
  // "常驻前台",链路仍可用,只是不再有主动停 timer 的时机(平台本身也会挂起 JS 线程)
  try {
    if (typeof Taro.onAppShow === 'function') Taro.onAppShow(() => enterForeground())
  } catch {
    // ignore
  }
  try {
    if (typeof Taro.onAppHide === 'function') Taro.onAppHide(() => leaveForeground())
  } catch {
    // ignore
  }
}

/** 桥接启动:注册前后台监听并立即按"前台"拉起链路(App 挂载即前台) */
export function startUiControlBridge(): void {
  // 登录态由桥层注入:注册表若直接 import utils/auth,会在模块加载期读 storage,
  // 在非小程序环境(vitest node / 预检)下 import 即崩
  configureTaroUiBridge({ isAuthed: () => !!getToken() })
  registerLifecycle()
  enterForeground()
}

/** 桥接停止(App 卸载 / 目标下线):停 timer + 断连 + 清注册表注入 */
export function stopUiControlBridge(): void {
  leaveForeground()
  resetTaroUiBridge()
}

/**
 * App 组件挂载点(app.tsx 的 UiControlBridgeHandler 调用)。
 * 全端**只此一条**通知 WS:本 hook 创建并持有它,同时把收到的消息继续广播给
 * eventCenter 的其他消费者,不再并存第二条连接。
 */
export function useUiControlBridge(): void {
  useEffect(() => {
    startUiControlBridge()
    return () => stopUiControlBridge()
  }, [])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
