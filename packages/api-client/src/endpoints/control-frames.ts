// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 控制帧端点出口(2026-10-28 立)—— D141 正本 §1.6/§1.7 三帧的客户端出口。
 *
 * 竞品的控制帧是宿主显式调用的一层线(`request({type:"<frame>"})`),判据是
 * 「宿主显式调用 + **必须回报结果**」。这三个出口对应我方三帧:
 *
 *   - `reload_plugins`  → reloadPlugins()   插件面重扫 + **回灌最新命令列表**
 *     (竞品原句 `replaceLatestCommands(e.commands)`;我方插件面 = 技能贡献的命令集)
 *   - `refresh_memory`  → refreshMemory()   强制重扫持久化记忆源 + 回报差额
 *     (读失败 ≠ 空:失败必须带 error 载荷,不许把「读不到」报成「没有记忆」)
 *   - `mcp_clear_auth`  → clearMcpAuth()    撤回**用户自授权**给某台 MCP Server 的
 *     OAuth 凭据(逐台点名,没有「全清」出口)
 *
 * 第四帧 `resume_goal` 的出口在 `client.ts`(与同族的 `postSessionGoal` 放在一起),
 * 不在本文件 —— 入口分散会让「帧 ↔ 出口」的对照表读不出来。
 *
 * 2026-11-06 补齐(本分支主交付):
 *   - `get_context_usage` → getContextUsage()     走引擎 JSON-RPC thread.contextUsage,
 *     回执按**账本口径**严格解析(七类不全/窗口未知 ⇒ 显式抛错,不猜档)
 *   - `stop_task`         → stopTask()            走 thread.interrupt(真中断,不新造机制)
 *   - `seed_read_state`   → seedReadState()       走 thread.seedReadState,逐路径回报
 *   - `mcp_reconnect`     → reconnectMcpServer()  复用上游 /connect 的(重)连接语义
 *   - `mcp_toggle`        → setMcpServerEnabled() 复用上游 store 的 enable/disable
 *
 * `rewind_files` **不在本文件**:它的数据面(每轮变更集)属于批次 4,本分支不前置合入,
 * 也不做空壳(见交付说明)。
 *
 * 传输统一走 fetchApi(令牌 / CSRF / 超时 / 重试 / 包络校验由本包统一托管);
 * 本文件只负责契约形状与防御性解包。失败一律显式抛错,不静默吞。
 */

import {
  fetchApi,
  parseContextLedgerSnapshot,
  type ContextLedgerSnapshot,
} from '../client.js'

// ===================== reload_plugins =====================

/** 重载后的插件面状态(控制帧 `reload_plugins` 的回执)。 */
export interface ReloadPluginsResult {
  /** 是否真的重扫成功;false 时 `error` 载明原因(失败必须给可见原因) */
  reloaded: boolean
  /** **重载后的最新命令列表** —— 竞品 `replaceLatestCommands(e.commands)` 的等价物 */
  commands: Array<{ name: string; description: string }>
  /** 命令条数(= commands.length,冗余一份便于端内直接展示) */
  commandCount: number
  /** 当前技能总数 */
  skills: number
  /** 当前技能名清单 */
  skillNames: string[]
  /** 技能差额:新增 / 移除 / 内容有变 */
  added: string[]
  removed: string[]
  changed: string[]
  /** 本次重载时刻;null = 尚未成功重载过 */
  lastReload: string | null
  /** 是否走了全量重扫(force=true) */
  forced: boolean
  /** 失败原因(仅失败时出现) */
  error?: string
}

/**
 * 控制帧 `reload_plugins`:重扫插件面并把最新命令列表回灌给宿主。
 *
 * 与「列表刷新」不是一回事:列表刷新只重取元数据,本调用会让服务端**重读磁盘上的
 * SKILL.md**并回报差额。前端必须把这个差额显示出来 —— 只说「已重载」而不给
 * 新增/移除/更新,用户无从判断改动到底有没有生效。
 *
 * `force` 默认 true:用户手改 SKILL.md 后 mtime 可能不变(同秒连写 / 编辑器保留
 * mtime),只走增量会把「改了没生效」报成「没有变化」。
 */
export function reloadPlugins(options?: { force?: boolean }) {
  return fetchApi<ReloadPluginsResult>('/api/mcp/slash-commands/reload', {
    method: 'POST',
    body: JSON.stringify({ force: options?.force ?? true }),
  })
}

// ===================== refresh_memory =====================

/** 记忆面刷新回执(控制帧 `refresh_memory`)。 */
export interface RefreshMemoryResult {
  /** 是否真的重扫成功;false 时 `error` 载明原因 */
  refreshed: boolean
  /** 新增 lesson id */
  added: string[]
  /** 消失的 lesson id */
  removed: string[]
  /** 内容有变的 lesson id */
  changed: string[]
  /** 内容未变的条数 */
  unchanged: number
  /** 刷新前总数 */
  before: number
  /** 刷新后总数 */
  totalLessons: number
  /** 读状态四态(loaded / never_tried / retry_backoff / gave_up) */
  loadState: string
  /** 失败原因(仅失败时出现) */
  error?: string
}

/**
 * 控制帧 `refresh_memory`:强制重扫持久化记忆源,回报刷新前后的差额。
 *
 * 与 `memory_status`(只读聚合)的差别不是措辞,是「用户在外面改了记忆文件,
 * agent 什么时候才看得到」。**读失败 ≠ 空**:失败时 `refreshed:false` 且
 * `error` 有值,端内必须把原因显示出来,不许把「读不到」报成「没有记忆」。
 */
export function refreshMemory() {
  return fetchApi<RefreshMemoryResult>('/api/admin/meta-learner/refresh', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

// ===================== mcp_clear_auth =====================

/** 凭据撤回回执(控制帧 `mcp_clear_auth`)。 */
export interface ClearMcpAuthResult {
  /** 是否真的清掉了 */
  cleared: boolean
  /** 撤回前是否持有 token */
  hadToken: boolean
  /** 持久化凭据文件是否已删除 */
  persistFileRemoved: boolean
  /** 未清除时的原因码(`no_oauth` = 这台压根没走 OAuth 通道) */
  reason?: string
  /** 失败原因(仅失败时出现) */
  error?: string
}

/**
 * 控制帧 `mcp_clear_auth`:撤回**用户自授权**给某台 MCP Server 的 OAuth 凭据。
 *
 * 逐台点名(serverName),没有「全清」出口;只清用户自授权的 token,不碰
 * client_secret / 系统令牌 / 其它 server 的凭据 —— 那是 OAuth 服务端持有的东西。
 * 这正是 OAuth 规范里 RFC 7009 revocation 的同族语义:用户有权让某个第三方
 * 不再持有自己的授权。
 *
 * 失败必抛(与本包其它出口同纪律):静默吞掉 = 用户点了「撤回授权」而凭据还在。
 */
export async function clearMcpAuth(serverName: string): Promise<ClearMcpAuthResult> {
  const res = await fetchApi<ClearMcpAuthResult>(
    `/api/mcp/external/servers/${encodeURIComponent(serverName)}/clear-auth`,
    { method: 'POST', body: JSON.stringify({}) },
  )
  if (!res.success) {
    throw new Error(res.error || '清除 MCP 凭据失败')
  }
  const data = res.data
  if (!data || typeof data !== 'object') {
    throw new Error('clearMcpAuth 回执不可解析')
  }
  return data
}

// ===================== 引擎 JSON-RPC 统一传输 =====================

/** 引擎 JSON-RPC 回执(只声明本文件消费到的字段)。 */
interface EngineRpcEnvelope<T> {
  jsonrpc?: string
  id?: string | number
  result?: T
  error?: { code: number; message: string; data?: unknown }
}

/**
 * 控制帧的引擎侧统一出口:POST /api/engine/rpc。
 *
 * 失败必抛且带三种可区分形态(传输层 / JSON-RPC 错误码 / 结果缺字段)——
 * 控制帧"处理失败"必须给调用方明确错误,不许把 `result` 缺失当成空对象继续走。
 */
async function callEngineRpc<T>(
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const res = await fetchApi<EngineRpcEnvelope<T>>('/api/engine/rpc', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `${method}-${Date.now()}`,
      method,
      params,
    }),
  })
  if (!res.success) {
    throw new Error(res.error || `引擎调用失败: ${method}`)
  }
  const envelope = res.data
  if (!envelope || typeof envelope !== 'object') {
    throw new Error(`${method} 回执不可解析`)
  }
  if (envelope.error) {
    throw new Error(`引擎拒绝 ${method}: [${envelope.error.code}] ${envelope.error.message}`)
  }
  if (envelope.result === undefined) {
    throw new Error(`${method} 回执缺少 result`)
  }
  return envelope.result
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

// ===================== get_context_usage =====================

/** 控制帧 `get_context_usage` 的回执。 */
export interface GetContextUsageResult {
  threadId: string
  /** 七类账本(严格解析;窗口未知/七类不全时本调用直接抛错,不给"半份账本") */
  usage: ContextLedgerSnapshot
  /** 数据来源:引擎只保存已落定的历史消息,故恒为 thread_history */
  source: 'thread_history'
  /** 线程状态(idle / running / closed),便于调用方判断账本是否落后于在飞轮次 */
  status: string
  capturedAt: string
}

/**
 * 控制帧 `get_context_usage`:取线程上下文的**账本口径**占用。
 *
 * 数字来自 `build_context_ledger`(七类固定、provider 口径可校正),不是本地估算法。
 * 引擎侧拿不到的类别(system 文本 / 工具 schema 不在线程快照里)按账本契约计 0,
 * 并把 `source` 明确标成 `thread_history` —— 不把"读历史"说成"读实时"。
 */
export async function getContextUsage(options: { threadId: string }): Promise<GetContextUsageResult> {
  const raw = await callEngineRpc<Record<string, unknown>>('thread.contextUsage', {
    threadId: options.threadId,
  })
  const usage = parseContextLedgerSnapshot(raw.usage)
  if (!usage) {
    throw new Error('上下文账本回执不可解析(七类不全或窗口未知,拒绝猜档)')
  }
  const source = raw.source
  if (source !== 'thread_history') {
    throw new Error(`上下文账本来源不可识别: ${String(source)}`)
  }
  if (typeof raw.threadId !== 'string' || typeof raw.status !== 'string') {
    throw new Error('上下文账本回执缺少 threadId/status')
  }
  const capturedAt = typeof raw.capturedAt === 'string' ? raw.capturedAt : usage.capturedAt
  return {
    threadId: raw.threadId,
    usage,
    source,
    status: raw.status,
    capturedAt,
  }
}

// ===================== stop_task =====================

/** 控制帧 `stop_task` 的回执(中断是否真的落地)。 */
export interface StopTaskResult {
  threadId: string
  /** true = 已中断;false 时必须看 `reason`(典型 `no_active_run`:本来就空闲) */
  interrupted: boolean
  mode: 'cancel' | 'pause'
  status: string
  /** 中断落到的 checkpoint(pause 档用于后续 resume;cancel 档可为 null) */
  checkpointId: string | null
  /** interrupted=false 的原因码 */
  reason?: string
}

/**
 * 控制帧 `stop_task`:中断正在执行的轮次。
 *
 * 复用引擎既有的 `thread.interrupt`(主循环在 LLM 调用与工具执行期间也响应中断标志,
 * 0.25s 粒度 ⇒ 中断后不再产生新副作用),不另造一套中断机制。
 * 空闲线程返回 interrupted:false + reason,不把它报成"已停止"。
 */
export async function stopTask(options: {
  threadId: string
  mode?: 'cancel' | 'pause'
}): Promise<StopTaskResult> {
  const raw = await callEngineRpc<Record<string, unknown>>('thread.interrupt', {
    threadId: options.threadId,
    mode: options.mode ?? 'cancel',
  })
  if (typeof raw.threadId !== 'string' || typeof raw.mode !== 'string' || typeof raw.status !== 'string') {
    throw new Error('stopTask 回执缺少 threadId/mode/status')
  }
  if (raw.mode !== 'cancel' && raw.mode !== 'pause') {
    throw new Error(`stopTask 回执 mode 不可识别: ${raw.mode}`)
  }
  if (typeof raw.interrupted !== 'boolean') {
    throw new Error('stopTask 回执缺少 interrupted 布尔位')
  }
  return {
    threadId: raw.threadId,
    interrupted: raw.interrupted,
    mode: raw.mode,
    status: raw.status,
    checkpointId: typeof raw.checkpointId === 'string' ? raw.checkpointId : null,
    ...(raw.interrupted ? {} : { reason: typeof raw.reason === 'string' ? raw.reason : 'unknown' }),
  }
}

// ===================== seed_read_state =====================

/** 单路径种子化结果(失败必须带 reason,不并桶) */
export interface SeedReadStatePathResult {
  path: string
  ok: boolean
  /** 失败原因码:outside_workspace / not_found / register_failed:* / no_session_identity */
  reason?: string
}

/** 控制帧 `seed_read_state` 的回执。 */
export interface SeedReadStateResult {
  threadId: string
  /** 成功登记条数(= results 中 ok 的条数) */
  seededCount: number
  /** 逐路径结果(成功与失败都在表内,调用方必须逐条消费) */
  results: SeedReadStatePathResult[]
}

/**
 * 控制帧 `seed_read_state`:把一批已读文件登记为线程会话的读状态。
 *
 * 逐路径返回结果(越界 / 不存在 / 登记失败各有 reason),不做"整批静默成功"。
 * 路径越界与不存在的判定在引擎侧(以线程工作区为根),本层只做形状校验。
 */
export async function seedReadState(options: {
  threadId: string
  paths: string[]
}): Promise<SeedReadStateResult> {
  const raw = await callEngineRpc<Record<string, unknown>>('thread.seedReadState', {
    threadId: options.threadId,
    paths: options.paths,
  })
  if (typeof raw.threadId !== 'string' || typeof raw.seededCount !== 'number') {
    throw new Error('seedReadState 回执缺少 threadId/seededCount')
  }
  if (!Array.isArray(raw.results)) {
    throw new Error('seedReadState 回执缺少 results')
  }
  const results: SeedReadStatePathResult[] = []
  for (const item of raw.results) {
    const entry = asRecord(item)
    if (!entry || typeof entry.path !== 'string' || typeof entry.ok !== 'boolean') {
      throw new Error('seedReadState 回执含不可解析的逐路径结果')
    }
    results.push({
      path: entry.path,
      ok: entry.ok,
      ...(typeof entry.reason === 'string' ? { reason: entry.reason } : {}),
    })
  }
  return { threadId: raw.threadId, seededCount: raw.seededCount, results }
}

// ===================== mcp_reconnect =====================

/** 控制帧 `mcp_reconnect` 的回执(上游 /connect 的 server 摘要)。 */
export interface ReconnectMcpServerResult {
  connected: boolean
  /** 上游摘要(name/transport/negotiatedProtocol/serverInfo/capabilities 等) */
  server: Record<string, unknown>
}

/**
 * 控制帧 `mcp_reconnect`:对指定 MCP Server 走一次(重)连接。
 *
 * 复用上游 `POST /api/mcp/external/servers/{name}/connect` 的既有语义
 * (docstring 自述"(重)连接"),不新造连接器。未连上即显式抛错。
 */
export async function reconnectMcpServer(serverName: string): Promise<ReconnectMcpServerResult> {
  const res = await fetchApi<Record<string, unknown>>(
    `/api/mcp/external/servers/${encodeURIComponent(serverName)}/reconnect`,
    { method: 'POST', body: JSON.stringify({}) },
  )
  if (!res.success) {
    throw new Error(res.error || `重连 MCP Server 失败: ${serverName}`)
  }
  const server = asRecord(res.data)
  if (!server) {
    throw new Error('reconnectMcpServer 回执不可解析')
  }
  if (server.connected !== true) {
    throw new Error(
      (typeof server.error === 'string' && server.error) || `MCP Server 未连接: ${serverName}`,
    )
  }
  return { connected: true, server }
}

// ===================== mcp_toggle =====================

/** 控制帧 `mcp_toggle` 的回执(上游 store enable/disable 的结果)。 */
export interface SetMcpServerEnabledResult {
  name: string
  enabled: boolean
  /** 是否真的在工具池里运行(enable 后可能仍有子进程未起的情况) */
  running: boolean
  toolCount: number
}

/**
 * 控制帧 `mcp_toggle`:启用 / 停用已安装的 MCP Server。
 *
 * 复用上游 store 的 `enable` / `disable` 两个既有端点(本层代理按 `enabled` 分支),
 * 不新造启停逻辑;回执里的 enabled/running 与上游一致,失败显式抛错。
 */
export async function setMcpServerEnabled(
  serverName: string,
  enabled: boolean,
): Promise<SetMcpServerEnabledResult> {
  const res = await fetchApi<Record<string, unknown>>(
    `/api/mcp/store/${encodeURIComponent(serverName)}/toggle`,
    { method: 'POST', body: JSON.stringify({ enabled }) },
  )
  if (!res.success) {
    throw new Error(res.error || `切换 MCP Server 开关失败: ${serverName}`)
  }
  const data = asRecord(res.data)
  if (!data || typeof data.enabled !== 'boolean') {
    throw new Error('setMcpServerEnabled 回执不可解析')
  }
  return {
    name: typeof data.name === 'string' ? data.name : serverName,
    enabled: data.enabled,
    running: data.running === true,
    toolCount: typeof data.tool_count === 'number' ? data.tool_count : 0,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
