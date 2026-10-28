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
 * 传输统一走 fetchApi(令牌 / CSRF / 超时 / 重试 / 包络校验由本包统一托管);
 * 本文件只负责契约形状与防御性解包。
 */

import { fetchApi } from '../client.js'

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
