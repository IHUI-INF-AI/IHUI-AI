// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useRef } from 'react'
import { createNotificationClient, fetchApi, type WSNotification } from '@ihui/api-client'
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
  AppUiActionType,
} from '@ihui/types'

import { API_BASE_URL } from '../lib/config'
import {
  configureRnUiBridge,
  executeRnUiAction,
  resetRnUiBridge,
  type RnUiActionResult,
} from '../lib/ui-action-registry'

/**
 * AI 对话操控 RN 端的桥接层(2026-09-21 立)。
 *
 * 与 web 端 use-ui-control-bridge.ts / 小程序端同一 agent-control 链路,只换
 * category='app_ui' + endpoint='rn'(api 侧 CATEGORY_ENDPOINT 一对一择端,
 * 同一用户 web 与 RN 同时在线时各投各的):
 *   能力上报(POST /api/agent-control/capability,60s 保活)
 *   → 通知 WS 收 {type:'notification', data:{type:'agent.action', request}}
 *   → ui-action-registry 执行
 *   → POST /api/agent-control/result 回传(executedBy:'rn',data 必带 instanceId)。
 *
 * 平台特有的降级事实决定了本文件的失败面:App 切后台后系统会挂起 JS 线程并回收 socket,
 * 而 api 侧 ENDPOINT_TTL_MS=5min 内仍认为该端在线 —— 于是 TARGET_NOT_CONNECTED 是**常态**
 * 而非故障。所有连接类失败只 console.warn(真机不弹任何 UI):一次刷屏的 toast 会把"AI
 * 在替我操作手机"变成"手机在跟我报错",而用户此刻多半根本不在前台。
 *
 * 桥层自带一条通知 WS(web 端同构做法),不复用 use-websocket.ts 那条:共享 hook 只暴露
 * lastMessage(单一 state),同批到达的两条指令会被 React 合并掉一条,丢的那条只能等 api
 * 侧 30s 超时 —— 对"describe 紧接着 navigate"这种成对指令是必踩的坑。
 */

/** api 侧 ENDPOINT_TTL_MS=5min,保活周期必须显著短于它 */
const CAPABILITY_INTERVAL_MS = 60_000
const PROCESSED_IDS_MAX = 100
const VERSION = '1.0.0'
const LOG_TAG = '[rn-ui]'

const APP_UI_ACTIONS: readonly AppUiActionType[] = [
  'describe',
  'navigate',
  'read',
  'invoke',
  'click',
  'fill',
  'submit',
]

/**
 * 实例 ID:每次冷启一个新值,故意不做持久化 ——
 * RN 每次冷启都是全新 JS 运行时与全新 WS 连接,沿用旧 ID 只会让 api 侧把上一条已死连接
 * 的注册记录当成活跃端(与小程序端同一取舍)。
 */
const INSTANCE_ID = `rn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export function getRnInstanceId(): string {
  return INSTANCE_ID
}

/**
 * 定址投递(2026-09-26,五桥共用 `@ihui/shared/utils/agent-action-addressing` 那一份判据):
 * api 的 WS 按 userId 广播,`assignment` 由服务端派发时写入载荷 —— 非指派到本机的指令不得
 * 执行,且留可诊断日志(不静默 return);回执原样回显服务端 token + 自报本实例。
 * 载荷缺 assignment = 旧服务端形态,逐字走改前路径(含回执不带 responded)。
 */
const assignmentTokens = createAssignmentTokenLedger(PROCESSED_IDS_MAX)

function selfIdentity(): AgentActionSelfIdentity {
  return { endpoint: 'rn', instanceId: INSTANCE_ID }
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

function isAppUiAction(action: unknown): action is AppUiActionType {
  return typeof action === 'string' && (APP_UI_ACTIONS as readonly string[]).includes(action)
}

/* ────────────────────────── HTTP 上报 ────────────────────────── */

export function buildCapability(instanceId = INSTANCE_ID): AgentControlCapability {
  return {
    endpoint: 'rn',
    instanceId,
    appUiActions: [...APP_UI_ACTIONS],
    version: VERSION,
    reportedAt: new Date().toISOString(),
  }
}

export function toResponse(
  request: AgentActionRequest,
  result: RnUiActionResult,
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
    executedBy: 'rn',
  }
}

/**
 * 走 @ihui/api-client 的 fetchApi:Authorization: Bearer 由它内部从已绑定的 tokenStore
 * 注入(见 src/lib/token.ts 的 bindTokenStoreToApiClient),本文件不自己拼 header,
 * 也就永不接触明文 token。失败只 warn —— 保活请求绝不该打扰用户(AGENTS §3 要求 HTTP 走 api-client)。
 */
async function postQuiet<TBody, TRes>(url: string, body: TBody, action: string): Promise<void> {
  try {
    const res = await fetchApi<TRes>(url, { method: 'POST', body: JSON.stringify(body) })
    if (!res.success) console.warn(`${LOG_TAG} ${action}失败:${res.error ?? '接口返回失败'}`)
  } catch (err) {
    console.warn(`${LOG_TAG} ${action}异常:`, err)
  }
}

function reportCapability(): void {
  void postQuiet('/api/agent-control/capability', buildCapability(), '上报移动端能力')
}

function reportResult(response: AgentActionResponse): void {
  // 回执身份回显:只回显服务端派发过的 token + 自报本实例(无 token = 旧服务端形态,原样回传)
  void postQuiet(
    '/api/agent-control/result',
    withRespondedIdentity(response, assignmentTokens, selfIdentity()),
    '回传移动端执行结果',
  )
}

/* ────────────────────────── WS 消息处理 ────────────────────────── */

export function handleAgentAction(
  request: AgentActionRequest,
  assignment?: AgentActionAssignment,
): void {
  // 定址过滤(2026-09-26):非指派到本实例不得执行,且留可诊断痕迹(不得静默 return)
  if (!isAgentActionAssignedToInstance(assignment, selfIdentity())) {
    console.warn(
      `${LOG_TAG} ${unassignedAgentActionLogMessage(request.requestId, assignment, selfIdentity())}`,
    )
    return
  }
  if (processedIds.has(request.requestId)) return
  // api 按 userId 广播,同用户多设备都会收到;被钉定给别的实例时静默让位,
  // 否则两台手机会各自执行一次同一条指令(旧服务端无 assignment 时这是唯一防撞手段)
  if (request.targetInstanceId && request.targetInstanceId !== INSTANCE_ID) return
  rememberRequestId(request.requestId)
  if (assignment) assignmentTokens.remember(request.requestId, assignment.token)

  if (!isAppUiAction(request.action)) {
    reportResult({
      requestId: request.requestId,
      success: false,
      error: `RN 端不支持的动作: ${String(request.action)}`,
      errorCode: 'UNSUPPORTED_ACTION',
      data: { instanceId: INSTANCE_ID },
      durationMs: 0,
      executedBy: 'rn',
    })
    return
  }

  const startedAt = Date.now()
  void executeRnUiAction(request.action, request.params ?? {})
    .then((result) => toResponse(request, result, startedAt))
    .catch((err: unknown): AgentActionResponse =>
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

export function handleWsNotification(msg: WSNotification): void {
  const envelope = extractAgentEnvelope(msg)
  if (!envelope) return
  const { request, assignment } = envelope
  if (request.category !== 'app_ui') return
  if (typeof request.requestId !== 'string' || !request.requestId) return
  handleAgentAction(request, assignment)
}

/* ────────────────────────── 连接生命周期 ────────────────────────── */

type WsClient = ReturnType<typeof createNotificationClient>

let capabilityTimer: ReturnType<typeof setInterval> | null = null
let wsClient: WsClient | null = null

/**
 * 启动桥接(登录态就绪时调用,重复调用只刷新保活节奏,不会并存两条连接)。
 *
 * token 由调用方(RootNavigator 已登录分支)传入而非这里读 store:桥接挂在谁身上,
 * 谁的登录态就是唯一真相,避免"store 已登出但连接还在"的窗口。
 */
export function startUiControlBridge(token: string | null): void {
  if (!token) return
  stopUiControlBridge()

  configureRnUiBridge({ isAuthed: () => !!token })
  reportCapability()
  capabilityTimer = setInterval(reportCapability, CAPABILITY_INTERVAL_MS)

  wsClient = createNotificationClient(
    { baseUrl: API_BASE_URL, tokenProvider: () => token },
    { onMessage: handleWsNotification },
  )
  wsClient.connect()
}

/** 停止桥接(登出 / 卸载):停 timer + 断连 + 清注册表注入 */
export function stopUiControlBridge(): void {
  if (capabilityTimer) {
    clearInterval(capabilityTimer)
    capabilityTimer = null
  }
  if (wsClient) {
    try {
      wsClient.disconnect()
    } catch {
      // 断开失败无需处理:本端已不再消费消息
    }
    wsClient = null
  }
  resetRnUiBridge()
}

export interface UseUiControlBridgeOptions {
  /** 当前访问令牌;为空即不建连、不上报能力 */
  token: string | null
}

/**
 * 桥接 hook:仅供已登录分支挂载一次(见 RootNavigator.tsx 的 UiControlBridgeLayer)。
 * 依赖数组只有 token —— 换 token(重新登录)才重建连接,渲染期任何其它变化都不该打断链路。
 */
export function useUiControlBridge({ token }: UseUiControlBridgeOptions): void {
  const tokenRef = useRef(token)
  tokenRef.current = token

  useEffect(() => {
    startUiControlBridge(tokenRef.current)
    return () => stopUiControlBridge()
  }, [token])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
