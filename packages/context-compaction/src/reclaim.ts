// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 旧工具结果回收(reclaim)—— 零模型请求的上下文瘦身。
 *
 * 与摘要压缩的分工:摘要压缩要花一次 LLM 调用;回收完全不请求模型,
 * 只把"最近若干轮之外"的白名单工具结果体就地替换为定长占位串。
 * 因此它可以在"还没到摘要阈值但窗口已经偏挤"时先把体积大头(命令输出、
 * 文件读取、搜索结果)拿回来,既省钱又不损失推理链。
 *
 * 设计约束(逐条对应判据):
 *   1. 零 LLM 调用 —— 本模块不 import 任何 provider/client,纯函数。
 *   2. 最小收益门槛 —— 改写后节省不足 RECLAIM_MIN_SAVED_TOKENS 就原样返回,
 *      因为每次改写都会打破 provider 的前缀缓存,无收益的改写是纯成本。
 *   3. 双触发 —— 占窗口比例达阈值 **或** 会话空闲超过设定时长(空闲时改写
 *      不打断在途对话,可以更早动手)。
 *   4. 保护面 —— 多模态块(图片/文件 data URI)、编辑类工具结果、
 *      最近 RECLAIM_KEEP_RECENT_ROUNDS 轮、历史摘要消息、system 段一律不回收。
 *   5. 白名单是显式清单 —— "所有工具一视同仁"会把有长期价值的结果
 *      (如 todo、记忆写入)一起抹掉。
 *
 * 两种工具结果形态都要处理(CLI 与 API 各用一种):
 *   - OpenAI 兼容形态:role='tool' + tool_call_id,工具名从配对 assistant 的
 *     tool_calls[].function.name 解析;
 *   - IHUI 内嵌形态:role='user' 消息里以 "[工具结果 ✓] 工具名\n输出" 分段拼接
 *     (见 apps/cli/src/tools/index.ts formatToolResult),只替换分段正文,
 *     同一条消息里的提醒段/文件变更段原样保留。
 *
 * 跨语言:阈值常量属"两侧必须同值"项 —— Python 真源
 * apps/ai-service/app/core/tunables.py,TS 只读镜像
 * packages/shared/src/constants.ts,对账 fixture
 * packages/context-compaction/test/consistency-fixtures.json 的 strategy_constants,
 * 由 test/consistency.test.ts 与 tests/test_consistency_fixtures.py 双向断言。
 * 工具名白名单与占位文案属"仅 CLI/TS 侧"(工具名来自 CLI 注册表,Python 端无同名面),
 * 不入对账 fixture。
 */

import { estimateMessagesTokens, estimateTokens } from './token-estimate.js'
import { isSummaryMessage } from './markers.js'
import type { ChatMessage } from './types.js'

// ==================== 跨端同值阈值(真源 tunables.py) ====================

/** 最近 N 轮(assistant round)之内的工具结果一律不回收:刚产出的结果模型还要用 */
export const RECLAIM_KEEP_RECENT_ROUNDS = 3
/** 最小收益门槛:整轮改写节省 < 此 token 数就不执行(避免无谓打破前缀缓存) */
export const RECLAIM_MIN_SAVED_TOKENS = 600
/** 触发一:上下文占窗口比例达到该值即回收(远低于摘要阈值 0.88,先做免费的) */
export const RECLAIM_WINDOW_RATIO_TRIGGER = 0.6
/** 触发二:会话空闲超过该时长(毫秒)即回收 —— 与比例触发是"或"关系 */
export const RECLAIM_IDLE_TRIGGER_MS = 120_000
/** 单条结果正文的回收下限:低于此 token 数的结果不值得改写(收益太小) */
export const RECLAIM_MIN_RESULT_TOKENS = 120

// ==================== 仅 CLI/TS 侧(不镜像到 Python,不入对账 fixture) ====================

/**
 * 可回收工具白名单 —— **显式清单**,特征是"结果体积大且后续无引用价值":
 * 命令执行 / 文件读取 / 目录列举 / 搜索 / 快照 / 诊断 / 只读 git 查询。
 * 仅 TS 侧:工具名来自 apps/cli 工具注册表,Python 端不存在这批名字,
 * 因此不参与跨端对账(新增/删除工具名不需要同步 ai-service)。
 */
export const RECLAIMABLE_TOOL_NAMES = [
  'read_file',
  'list_dir',
  'glob',
  'grep',
  'run_command',
  'run_tests',
  'terminal_read',
  'get_command_output',
  'wait_command',
  'fetch_url',
  'web_search',
  'browser_snapshot',
  'codegraph',
  'find_references',
  'goto_definition',
  'get_diagnostics',
  'lsp_diagnostics',
  'lsp_hover',
  'lsp_find_references',
  'lsp_goto_definition',
  'lsp_workspace_symbol',
  'git_status',
  'git_diff',
  'git_log',
  'memory_recall',
  'gh_pr_view',
  'gh_issue_list',
] as const

/**
 * 编辑/写入类工具 —— **永不回收**(即使被误加进白名单也拦)。
 * 它们的"刚产出的结果"是后续推理的事实依据(改了什么、成没成功),
 * 回收等于让模型对自己的写入失去记忆。仅 TS 侧。
 */
export const NON_RECLAIMABLE_EDIT_TOOLS = [
  'edit_file',
  'write_file',
  'batch_edit',
  'delete_file',
  'git_add',
  'git_commit',
  'git_stash_push',
  'todo_write',
  'memory_save',
  'memory_forget',
  'memory_dream',
  'spawn_parallel',
  'dispatch_subagent',
] as const

/** 定长占位串:长度固定,不掺入原始体积数字,保证多次回收产物字节一致 */
export const RECLAIM_PLACEHOLDER =
  '[工具结果已回收·正文因上下文回收策略移除,需要时请重新执行该工具]'

// ==================== 形态识别 ====================

/** IHUI 内嵌工具结果分段: `[工具结果 ✓] 工具名\n正文` (标记与 compaction-v2 一致)
 *  第 1 组是成功/失败标记,改写时必须原样保留(失败结果的状态也是模型要用的事实) */
const EMBEDDED_RESULT_RE = /^\[工具结果\s*([✓✗])\]\s*(\S+)\r?\n([\s\S]*)$/
/** 多模态块:图片/音频/视频/任意 base64 data URI(回收后模型再也看不到它,禁止回收) */
const MULTIMODAL_RE = /data:(image|audio|video|application)\/[a-zA-Z0-9+.-]+;base64,/

/** 该文本是否含多模态块 */
export function hasMultimodalBlock(text: string): boolean {
  return typeof text === 'string' && text.length > 0 && MULTIMODAL_RE.test(text)
}

/** 该文本是否已是回收占位(幂等保护:已回收的不重复改写,也不重复计收益) */
export function isReclaimedPlaceholder(text: string): boolean {
  return typeof text === 'string' && text.includes(RECLAIM_PLACEHOLDER)
}

/** 该 user 消息是否承载内嵌工具结果(用于轮次边界判定) */
function carriesEmbeddedResults(msg: ChatMessage): boolean {
  if (msg.role !== 'user' || typeof msg.content !== 'string') return false
  return /^\[工具结果\s*[✓✗]\]/m.test(msg.content)
}

/**
 * 把 non-system 消息切成"轮次"(round):一个 round 以 assistant 消息或
 * 非工具结果的 user 消息起头,后续消息(含其 tool 结果 / 内嵌结果 user 消息)
 * 归属同一轮。
 *
 * 之所以按"轮"而不是按"条"保护最近 N:配对组(tool_calls ↔ tool 结果)与
 * 内嵌结果分段都落在同一轮内,整轮保护天然不会把配对切一半。
 */
export function splitAssistantRounds(nonSystem: ChatMessage[]): ChatMessage[][] {
  const rounds: ChatMessage[][] = []
  for (const msg of nonSystem) {
    const startsRound =
      rounds.length === 0 ||
      msg.role === 'assistant' ||
      (msg.role === 'user' && !carriesEmbeddedResults(msg))
    if (startsRound) rounds.push([msg])
    else rounds[rounds.length - 1]!.push(msg)
  }
  return rounds
}

/** 建立 tool_call_id → 工具名 映射(OpenAI 形态解析工具名用) */
function buildToolNameIndex(messages: ChatMessage[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const m of messages) {
    if (!Array.isArray(m.tool_calls)) continue
    for (const tc of m.tool_calls) {
      if (tc && typeof tc.id === 'string' && tc.function && typeof tc.function.name === 'string') {
        index.set(tc.id, tc.function.name)
      }
    }
  }
  return index
}

/** 白名单判定:在名单内 且 不属编辑类(编辑类一票否决) */
function isReclaimableToolName(name: string | undefined, whitelist: Set<string>): boolean {
  if (!name) return false
  if ((NON_RECLAIMABLE_EDIT_TOOLS as readonly string[]).includes(name)) return false
  return whitelist.has(name)
}

// ==================== 主入口 ====================

export interface ReclaimOptions {
  /** 模型上下文窗口大小(tokens) */
  contextLimit: number
  /** 当前占用 token 数(不传则内部用 estimateMessagesTokens 估算) */
  currentTokens?: number
  /** 会话最近一次活动时间戳(ms epoch),用于空闲触发 */
  lastActivityAtMs?: number
  /** 判定时钟(默认 Date.now(),测试可注入) */
  nowMs?: number
  /** 覆盖默认阈值(测试/调优用) */
  keepRecentRounds?: number
  minSavedTokens?: number
  windowRatioTrigger?: number
  idleTriggerMs?: number
  minResultTokens?: number
  /** 覆盖白名单(测试用;默认取 RECLAIMABLE_TOOL_NAMES) */
  reclaimableTools?: readonly string[]
}

export type ReclaimTrigger = 'window-ratio' | 'idle' | null

export type ReclaimSkipReason = 'not-triggered' | 'nothing-reclaimable' | 'below-min-benefit'

export interface ReclaimResult {
  /** 未执行改写时 === 入参数组(同一引用),调用方可据此判定"零改写" */
  messages: ChatMessage[]
  applied: boolean
  /** applied 为 true 时固定是 'applied',否则是跳过原因 */
  reason: 'applied' | ReclaimSkipReason
  trigger: ReclaimTrigger
  /** 被改写的结果体个数 */
  reclaimedCount: number
  beforeTokens: number
  afterTokens: number
  /** before - after(未改写时恒 0) */
  savedTokens: number
  /** 占窗口比例(以改写前 token 计) */
  usageRatio: number
}

/**
 * 执行一次旧工具结果回收。
 *
 * 返回语义(判据三条,互斥):
 *   - reason='not-triggered' —— 双触发都没满足,不改写;
 *   - reason='nothing-reclaimable' —— 触发了但没有可回收的白名单结果体,不改写;
 *   - reason='below-min-benefit' —— 试算后节省不足最小收益门槛,**放弃改写**
 *     (返回原数组引用,缓存前缀不受影响);
 *   - reason='applied' —— 已改写。
 */
export function reclaimStaleToolResults(
  messages: ChatMessage[],
  opts: ReclaimOptions,
): ReclaimResult {
  const contextLimit = opts.contextLimit
  const keepRecentRounds = opts.keepRecentRounds ?? RECLAIM_KEEP_RECENT_ROUNDS
  const minSavedTokens = opts.minSavedTokens ?? RECLAIM_MIN_SAVED_TOKENS
  const windowRatioTrigger = opts.windowRatioTrigger ?? RECLAIM_WINDOW_RATIO_TRIGGER
  const idleTriggerMs = opts.idleTriggerMs ?? RECLAIM_IDLE_TRIGGER_MS
  const minResultTokens = opts.minResultTokens ?? RECLAIM_MIN_RESULT_TOKENS
  const whitelist = new Set<string>(opts.reclaimableTools ?? RECLAIMABLE_TOOL_NAMES)

  const beforeTokens = opts.currentTokens ?? estimateMessagesTokens(messages)
  const usageRatio = contextLimit > 0 ? beforeTokens / contextLimit : 0

  // 触发判定:比例触发 或 空闲触发
  const nowMs = opts.nowMs ?? Date.now()
  const idleMs =
    typeof opts.lastActivityAtMs === 'number' ? Math.max(0, nowMs - opts.lastActivityAtMs) : null
  let trigger: ReclaimTrigger = null
  if (contextLimit > 0 && usageRatio >= windowRatioTrigger) trigger = 'window-ratio'
  else if (idleMs !== null && idleMs >= idleTriggerMs) trigger = 'idle'
  if (trigger === null) {
    return notApplied(messages, 'not-triggered', null, beforeTokens, usageRatio)
  }

  const systemMsgs: ChatMessage[] = []
  const nonSystem: ChatMessage[] = []
  for (const m of messages) {
    if (m.role === 'system') systemMsgs.push(m)
    else nonSystem.push(m)
  }

  const rounds = splitAssistantRounds(nonSystem)
  // 最近 keepRecentRounds 轮整轮保护(含刚产出的编辑结果);至少留 1 轮
  const protectedRounds = Math.max(1, Math.min(keepRecentRounds, rounds.length))
  const reclaimableEnd = rounds.length - protectedRounds
  if (reclaimableEnd <= 0) {
    return notApplied(messages, 'nothing-reclaimable', trigger, beforeTokens, usageRatio)
  }

  const nameIndex = buildToolNameIndex(messages)
  let rewritten = 0
  const nextNonSystem: ChatMessage[] = []
  rounds.forEach((round, roundIdx) => {
    const inScope = roundIdx < reclaimableEnd
    for (const msg of round) {
      if (!inScope) {
        nextNonSystem.push(msg)
        continue
      }
      // 历史摘要消息不回收(它就是压缩产物,再改写等于把摘要也扔了)
      if (isSummaryMessage(msg)) {
        nextNonSystem.push(msg)
        continue
      }
      if (msg.role === 'tool') {
        const name =
          typeof msg.tool_call_id === 'string' ? nameIndex.get(msg.tool_call_id) : undefined
        const replaced = tryReclaimToolMessage(msg, name, whitelist, minResultTokens)
        if (replaced) rewritten++
        nextNonSystem.push(replaced ?? msg)
        continue
      }
      if (msg.role === 'user' && carriesEmbeddedResults(msg)) {
        const { message, changed } = tryReclaimEmbedded(msg, whitelist, minResultTokens)
        if (changed) rewritten += changed
        nextNonSystem.push(message)
        continue
      }
      nextNonSystem.push(msg)
    }
  })

  if (rewritten === 0) {
    return notApplied(messages, 'nothing-reclaimable', trigger, beforeTokens, usageRatio)
  }

  const candidate = [...systemMsgs, ...nextNonSystem]
  const afterTokens = estimateMessagesTokens(candidate)
  const savedTokens = beforeTokens - afterTokens

  // 最小收益门槛:收益不足就放弃改写(反向对照测试锚点)
  if (savedTokens < minSavedTokens) {
    return {
      messages,
      applied: false,
      reason: 'below-min-benefit',
      trigger,
      reclaimedCount: 0,
      beforeTokens,
      afterTokens: beforeTokens,
      savedTokens: 0,
      usageRatio,
    }
  }

  return {
    messages: candidate,
    applied: true,
    reason: 'applied',
    trigger,
    reclaimedCount: rewritten,
    beforeTokens,
    afterTokens,
    savedTokens,
    usageRatio,
  }
}

function notApplied(
  messages: ChatMessage[],
  reason: ReclaimSkipReason,
  trigger: ReclaimTrigger,
  beforeTokens: number,
  usageRatio: number,
): ReclaimResult {
  return {
    messages,
    applied: false,
    reason,
    trigger,
    reclaimedCount: 0,
    beforeTokens,
    afterTokens: beforeTokens,
    savedTokens: 0,
    usageRatio,
  }
}

/** OpenAI 形态:整条 tool 结果替换为占位串;不满足条件时返回 null(表示未改写) */
function tryReclaimToolMessage(
  msg: ChatMessage,
  name: string | undefined,
  whitelist: Set<string>,
  minResultTokens: number,
): ChatMessage | null {
  if (!isReclaimableToolName(name, whitelist)) return null
  if (isReclaimedPlaceholder(msg.content) || hasMultimodalBlock(msg.content)) return null
  if (estimateTokens(msg.content) < minResultTokens) return null
  return { ...msg, content: RECLAIM_PLACEHOLDER }
}

/**
 * IHUI 内嵌形态:只替换 "[工具结果 ✓] name\n正文" 分段的正文。
 * 同一条 user 消息里的其他分段(提醒 / 文件变更 / 普通追问)原样保留,
 * 分段连接符(\n\n)与顺序不变。
 */
function tryReclaimEmbedded(
  msg: ChatMessage,
  whitelist: Set<string>,
  minResultTokens: number,
): { message: ChatMessage; changed: number } {
  const parts = msg.content.split('\n\n')
  let changed = 0
  const nextParts = parts.map((part) => {
    const m = EMBEDDED_RESULT_RE.exec(part)
    if (!m) return part
    const status = m[1]
    const name = m[2]
    const body = m[3] ?? ''
    if (!isReclaimableToolName(name, whitelist)) return part
    if (isReclaimedPlaceholder(body)) return part
    if (hasMultimodalBlock(body) || hasMultimodalBlock(part)) return part
    if (estimateTokens(body) < minResultTokens) return part
    changed++
    return `[工具结果 ${status}] ${name}\n${RECLAIM_PLACEHOLDER}`
  })
  if (changed === 0) return { message: msg, changed: 0 }
  return { message: { ...msg, content: nextParts.join('\n\n') }, changed }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
