// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { type GoalWireStatus, type ReasoningEffort, type SandboxModeId } from '@ihui/types'

/**
 * SSE 流式对话的解析与事件形状(原 `client.ts` 内联实现,门 103 C1 收口时下沉)。
 * `client.ts` 以 `export * from './stream.js'` 转出口,对外公开面逐名等值。
 * 与 `client.ts` 之间只借三个纯判据(`isAbortError` / `isStepUpRejection` /
 * `isVerificationCodeFailure`),不存在模块初始化期取值。
 */

import type {
  PlanUpdateEvent,
  TerminalStartEvent,
  TerminalEndEvent,
  CitationsEvent,
  ApprovalPolicyId,
} from '@ihui/types'
import type { FrameWatermarkFacts } from './frame-watermark-producer.js'
import type { RecoveryGateLedger } from './recovery-gate.js'
import { type OpenAiToolCallDelta } from './openai-tool-stream.js'
import { isAbortError, isStepUpRejection, isVerificationCodeFailure } from './client.js'

// ==================== SSE 流式对话 ====================

/** P1 #27(2026-09-16 立):记忆更新事件(已记住提示条数据源)。 */
export interface MemoryUpdatesEvent {
  /** 本轮新增写入长期记忆(LTM)的条目摘要文本;空数组表示本轮无新记忆 */
  items: string[]
  /** 关联的 assistant messageId;缺省时前端回退到本流 assistantId */
  messageId?: string
}

/** 终端命令执行期间的实时输出增量事件(2026-09-18 立,消息级 terminal inline 实时回显)。
 *  后端在命令执行期间逐块下发 `event: terminal_delta` + `data: {"type":"terminal_delta",...}`,
 *  前端按 terminalId 累加到 store.terminalOutputs,供 TerminalSection 实时回显 stdout/stderr。 */
/** 文件写类工具流中 diff 预览事件(D113,2026-09-27 立,G-227;G-816035 于 2026-10-08 改增量口径)。
 *  后端在工具执行前从纯参数推导"将要写入的内容",逐帧下发**增量**正文(仅本批新增行);
 *  消费端按 `seq` 收敛**追加**;tool-result 到达即被前端清除(最终 diff 以 tool-result 为准,本帧不入库)。 */
export interface ToolDeltaEvent {
  /** 与 tool-call-start 的 toolCallId 一致 */
  toolCallId: string
  /** 同一 toolCallId 内的递增序号(从 1 起),参与收敛/排序:消费端按它判新旧 */
  seq: number
  /** 增量正文(仅本批新增):消费端按 seq 收敛追加,不得整帧覆盖 */
  partialText: string
  /** 预览超预算被截断(总 400 行 / 32KB / 10 帧封顶) */
  truncated?: boolean
}

export interface TerminalDeltaEvent {
  /** 与 terminal_start 的 terminalId 一致,用于关联同一终端任务 */
  terminalId: string
  /** 原命令(与 terminal_start 的 command 一致,便于无 start 事件时兜底关联) */
  command: string
  /** 输出流类型:stdout / stderr */
  stream: 'stdout' | 'stderr'
  /** 增量文本 */
  text: string
  /** 当前迭代轮次 */
  iteration: number
  /** 关联 assistant 消息 ID(可选) */
  messageId?: string
}
/** D151(2026-09-29 立,用户批「默认开 + 单次等待 300s」):命令停在"等键盘输入"的一帧。
 *  与 TerminalDeltaEvent 的区别就一句话 —— delta 是"它在输出",本帧是"它停住了、在等你敲一行"。
 *  线格式 camelCase(生产点 mcp_server._await_terminal_input);键入送回是**上行** POST
 *  `/llm/complete/stream/{session_id}/terminal-input`,形状 snake_case(`terminal_id`/`text`),
 *  与 form_response 同族 —— 两条通道形状不同不是疏漏。 */
export interface TerminalInteractionEvent {
  /** 与 terminal_start 的 terminalId 一致;代答必须带这个 id,服务端只认登记过的那一条 */
  terminalId: string
  /** 本帧所属会话 —— 上行出口的路径就是 `/llm/complete/stream/{sessionId}/terminal-input`,
   *  所以**帧必须自带它**。前端只知道自己那条流的上下文,不带上就只能猜,而猜错的形态是
   *  "点了发送什么都没发生、还不报错"(2026-09-29 web 消费端实测到的这一格)。 */
  sessionId: string
  /** 那句提示原文(来自命令输出,已按凭据形态脱敏但**不保证**不含敏感内容:不得持久化) */
  promptTail: string
  /** 从判定"在等人"到发帧的毫秒数 */
  waitingSinceMs: number
  /** 输入模式:目前恒 'line'(整行送回,回车即提交) */
  inputMode: 'line'
  /** 单次键入长度封顶(超出由服务端截断) */
  maxInputChars: number
  /** 关联 assistant 消息 ID(可选) */
  messageId?: string
}

/** D152(2026-09-29 立,用户拍板「服务化但存会话元数据、不建新表」):会话目标状态帧。
 *  与 web `stores/goal.ts` 的关系是「服务端主副本 → 本地缓存」:本帧到达即覆盖本地那份,
 *  换浏览器/换端不再丢。生产点 ai-service `POST /llm/sessions/{session_id}/goal`
 *  (写入主副本后推进该会话当前活跃流)+ **流首**带出当前目标。
 *  ⚠️ **单帧承载清除**:`status:'cleared'` 就是"目标已清除",不存在 goal_cleared 第二帧。
 *  sessionId 必需 —— 上行出口的路径就是 `/llm/sessions/{sessionId}/goal`,不带前端只能猜,
 *  而猜错的表现是"点了什么都没发生且不报错"(D151 同一课)。 */
export interface GoalUpdateEvent {
  /** 会话 id(= 上行出口路径里的 {session_id});空串 = 服务端当轮没有会话 id */
  sessionId: string
  /** 六档之一,或 cleared(线格式第七值,代表"已清除"而非第七种落库状态) */
  status: GoalWireStatus
  /** 目标原文;cleared 时缺省 */
  objective?: string
  /** 累计耗时 ms(GoalCard 的 D89 耗时条取它) */
  elapsedMs?: number
  /** 累计 token 用量(服务端计量,不是本地估算) */
  tokenUsage?: number
  /** 服务端写入时刻(epoch 秒);多端据此判"谁的更新更新" */
  updatedAt?: number
}

/** 消息级 token 用量计量事件(D1,2026-09-19 立)。
 *
 * 后端在每条回复流收尾处发出命名帧 `event: usage` / `type:'usage'`,
 * 携带本条消息的 token 用量、首 token 与总耗时、模型与(可选)成本。
 * 同时向后兼容 OpenAI 协议:`json.usage` 字段(prompt_tokens/completion_tokens/total_tokens)。
 * reasoningTokens / timing / model / messageId / costUsd 为新增字段,可选以兼容旧链路。 */
export interface UsageEvent {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** 推理 token 数(部分模型/思考模式,缺失为 null) */
  reasoningTokens?: number | null
  /** 关联 assistant 消息 ID(取不到为 null) */
  messageId?: string | null
  /** 耗时:{ firstTokenMs: 首个正文增量耗时(ms,缺失为 null); durationMs: 总耗时(ms) } */
  timing?: { firstTokenMs: number | null; durationMs: number } | null
  /** 实际模型 id */
  model?: string | null
  /** 本次调用估算成本(USD,暂未计费为 null) */
  costUsd?: number | null
  /** prompt 缓存**命中读取** token 数(G-1058632,2026-10-05 立)。
   *  三态必须分开,不得合并:
   *  - `number`(含 **0**)＝ 上游真回报了,0 就是"一次都没命中"这个结论本身;
   *  - `null` / 缺字段 ＝ 上游这条链路**没采到**,消费端必须呈现"未知/—",
   *    不得在本包造默认值 —— 把"没量到"显示成 0 会把两个不同的结论压成同一个,
   *    与 G-394(把未量到渲染成 0)是同一条禁令。 */
  cacheReadTokens?: number | null
  /** prompt 缓存**写入** token 数;三态同上(Anthropic 系才有原生字段,
   *  其余厂商上游不回报时应保持 null,而不是写 0 冒充"该厂商不写缓存")。 */
  cacheWriteTokens?: number | null
  /**
   * 批次 3(2026-11-06):本轮七类上下文账本(命名帧可选字段)。缺席 = 旧帧代际差
   * 或该链路未采集,读作"本轮无账本",不是七类全 0。权威定义在
   * `@ihui/shared` 的 sse/contract.ts ContextLedger(本包零依赖,故本地镜像)。
   */
  contextLedger?: ContextLedgerSnapshot
}

/** 上下文占用七类(固定顺序,与 @ihui/shared CONTEXT_LEDGER_CATEGORIES 同值)。 */
export type ContextLedgerCategorySnapshot =
  'system_prompt' | 'system_tools' | 'skills' | 'messages' | 'other' | 'free_space' | 'auto_compact'

/** 单类占用(相对 contextLimit 的百分比)。 */
export interface ContextLedgerCategoryUsageSnapshot {
  category: ContextLedgerCategorySnapshot
  tokens: number
  percent: number
}

/** 单轮上下文账本快照(线格式 camelCase)。 */
export interface ContextLedgerSnapshot {
  model: string | null
  contextLimit: number
  usedTokens: number
  percentage: number
  /** 必须七类齐全;长度≠7 或含未知类别 ⇒ 整帧账本丢弃(不猜档) */
  categories: ContextLedgerCategoryUsageSnapshot[]
  tokenizer: 'provider_usage' | 'heuristic'
  compacted: boolean
  capturedAt: string
}

/** 压缩保留段锚点快照(回看压缩前关键片段用)。 */
export interface PreservedSegmentAnchorSnapshot {
  index: number
  role: string
  messageId?: string | null
  excerpt: string
  digest?: string
}

/** 压缩边界快照(compaction 帧可选字段 boundary 的本地镜像)。 */
export interface CompactBoundarySnapshot {
  trigger: string
  tokensBefore: number
  tokensAfter: number
  messagesSummarized: number
  durationMs: number | null
  preservedSegment: {
    head: PreservedSegmentAnchorSnapshot | null
    anchor: PreservedSegmentAnchorSnapshot | null
    tail: PreservedSegmentAnchorSnapshot | null
  }
  removedRange: { startIndex: number; endIndex: number } | null
}

/** 七类账本类别闭集(与 @ihui/shared CONTEXT_LEDGER_CATEGORIES 同值、同序)。 */
const CONTEXT_LEDGER_CATEGORY_SET: ReadonlySet<string> = new Set([
  'system_prompt',
  'system_tools',
  'skills',
  'messages',
  'other',
  'free_space',
  'auto_compact',
])

const isNonNegativeFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

/**
 * 批次 3(2026-11-06):解析 usage 帧的 contextLedger。
 * 形状判据(strict):contextLimit>0、categories 恰 7 条、类别在闭集且不重复、
 * tokens/percent 为有限非负数。任一不满足 ⇒ undefined(整帧丢弃,不猜档),
 * 与"没量到不造 0"的既有纪律同口径。
 */
export function parseContextLedgerSnapshot(raw: unknown): ContextLedgerSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>
  if (!isNonNegativeFinite(record.contextLimit) || record.contextLimit <= 0) return undefined
  if (!Array.isArray(record.categories) || record.categories.length !== 7) return undefined
  const seen = new Set<string>()
  const categories: ContextLedgerCategoryUsageSnapshot[] = []
  for (const item of record.categories) {
    if (!item || typeof item !== 'object') return undefined
    const entry = item as Record<string, unknown>
    if (typeof entry.category !== 'string' || !CONTEXT_LEDGER_CATEGORY_SET.has(entry.category)) {
      return undefined
    }
    if (seen.has(entry.category)) return undefined
    if (!isNonNegativeFinite(entry.tokens) || !isNonNegativeFinite(entry.percent)) return undefined
    seen.add(entry.category)
    categories.push({
      category: entry.category as ContextLedgerCategorySnapshot,
      tokens: entry.tokens,
      percent: entry.percent,
    })
  }
  // 长度=7 + 无重复 + 全在闭集 ⇒ seen.size 必为 7;这条显式判据只防未来闭集扩容后漏改。
  if (seen.size !== CONTEXT_LEDGER_CATEGORY_SET.size) return undefined
  if (!isNonNegativeFinite(record.usedTokens) || !isNonNegativeFinite(record.percentage)) {
    return undefined
  }
  if (record.tokenizer !== 'provider_usage' && record.tokenizer !== 'heuristic') return undefined
  if (typeof record.capturedAt !== 'string' || record.capturedAt === '') return undefined
  return {
    model: typeof record.model === 'string' ? record.model : null,
    contextLimit: record.contextLimit,
    usedTokens: record.usedTokens,
    percentage: record.percentage,
    categories,
    tokenizer: record.tokenizer,
    compacted: record.compacted === true,
    capturedAt: record.capturedAt,
  }
}

/** 保留段锚点解析;字段缺失按 null(锚点可以不存在),存在则必须形状完整。 */
function parsePreservedAnchor(raw: unknown): PreservedSegmentAnchorSnapshot | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (!isNonNegativeFinite(record.index) || typeof record.role !== 'string') return null
  if (typeof record.excerpt !== 'string') return null
  return {
    index: record.index,
    role: record.role,
    messageId: typeof record.messageId === 'string' ? record.messageId : null,
    excerpt: record.excerpt,
    ...(typeof record.digest === 'string' ? { digest: record.digest } : {}),
  }
}

/**
 * 批次 3(2026-11-06):解析 compaction 帧的 boundary(压缩边界 + 保留段)。
 * 形状不认 ⇒ undefined;不回填 0/空锚点 —— "无边界"与"压缩了但边界未知"必须可分。
 */
export function parseCompactBoundarySnapshot(raw: unknown): CompactBoundarySnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>
  if (typeof record.trigger !== 'string' || record.trigger === '') return undefined
  if (!isNonNegativeFinite(record.tokensBefore) || !isNonNegativeFinite(record.tokensAfter)) {
    return undefined
  }
  if (!isNonNegativeFinite(record.messagesSummarized)) return undefined
  if (!record.preservedSegment || typeof record.preservedSegment !== 'object') return undefined
  const segment = record.preservedSegment as Record<string, unknown>
  const removedRaw = record.removedRange
  let removedRange: { startIndex: number; endIndex: number } | null = null
  if (removedRaw !== undefined && removedRaw !== null) {
    if (typeof removedRaw !== 'object') return undefined
    const range = removedRaw as Record<string, unknown>
    if (!isNonNegativeFinite(range.startIndex) || !isNonNegativeFinite(range.endIndex)) {
      return undefined
    }
    removedRange = { startIndex: range.startIndex, endIndex: range.endIndex }
  }
  return {
    trigger: record.trigger,
    tokensBefore: record.tokensBefore,
    tokensAfter: record.tokensAfter,
    messagesSummarized: record.messagesSummarized,
    durationMs: isNonNegativeFinite(record.durationMs) ? record.durationMs : null,
    preservedSegment: {
      head: parsePreservedAnchor(segment.head),
      anchor: parsePreservedAnchor(segment.anchor),
      tail: parsePreservedAnchor(segment.tail),
    },
    removedRange,
  }
}

/** G-1058632(2026-10-05 立):从上游 usage 对象接住 prompt 缓存读/写两维。
 *
 * 存在的理由:此前解析面只取 prompt/completion/total,缓存两维在**读侧**从未被接住,
 * 于是三个消费端只能恒传 null —— 那显示的是"这个模型没有缓存",而事实是"我们没采到"。
 *
 * 键名一律取自现读出处,不发明:
 * - `cached_tokens` / `cache_creation_tokens` = ai-service 跨厂商归一契约
 *   (`apps/ai-service/app/core/usage_cache.py` 的 `normalize_usage()` 五个统一键);
 * - `prompt_tokens_details.cached_tokens` = OpenAI 原生嵌套形态;
 * - `cache_read_input_tokens` / `cache_creation_input_tokens` = Anthropic 原生;
 * - `prompt_cache_hit_tokens` = DeepSeek 原生;
 * - camelCase `cacheReadTokens` / `cacheWriteTokens` = 我方命名帧线格式(G-403 后
 *   llm.py `_usage_frame` 补发这两键,与 `UsageEvent` 类型名对齐);
 *   camelCase `cacheCreationTokens` = 本包早期 dual-spelling 兼容候选,保留不删。
 *
 * **两态绝不并桶**:回报的数字(含 0)是读数;缺字段/非数字是 `null` = 未采到。
 * 本函数刻意不返回默认值 —— 造 0 就是把"没量到"写成"一次都没命中"。 */
export function parseUsageCacheTokens(usage: Record<string, unknown>): {
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
} {
  const toNumber = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null

  const details = usage['prompt_tokens_details']
  const nested = details && typeof details === 'object' ? (details as Record<string, unknown>) : {}

  /** 按序取首个"真回报"的数字;全部缺位 ⇒ null(而不是 0)。 */
  const firstReported = (candidates: unknown[]): number | null => {
    for (const c of candidates) {
      const n = toNumber(c)
      if (n !== null) return n
    }
    return null
  }

  return {
    cacheReadTokens: firstReported([
      usage['cacheReadTokens'],
      usage['cached_tokens'],
      nested['cached_tokens'],
      usage['cache_read_input_tokens'],
      usage['prompt_cache_hit_tokens'],
    ]),
    cacheWriteTokens: firstReported([
      // G-403(2026-10-07):命名帧(llm.py _usage_frame)的线格式键,与 UsageEvent
      // 类型名对齐 —— 排在最前;snake_case 候选(relay verbatim 透传)在后,不变。
      usage['cacheWriteTokens'],
      usage['cacheCreationTokens'],
      usage['cache_creation_tokens'],
      usage['cache_creation_input_tokens'],
    ]),
  }
}

/**
 * 推理强度档位回落通知(D130,2026-09-30 立)。
 *
 * 后端(reasoning_effort_pin)可能把用户选定的档位**钉回**另一个值(override 未启用 /
 * 模型不在白名单 / 与既有钉扎冲突)。票第 8 栏点名的正是这一型静默失效:前端显示"深思",
 * 实际发出去的是默认档,而账面一片绿。
 *
 * 载体是**已有的 `done` 帧新增一个可选字段** `reasoningEffort`,不是新增 SSE 事件 ——
 * 新增事件名要动 SSE 契约两侧 + sse-parse + dispatch 台账,而本票的文件清单刻意把它们
 * 划给并行代理(sse/**、sse-parse.ts、services/**),半截接入就是给下游留断链。
 * `memoryUpdates` / `citations` 走的是同一条"done 帧加可选字段"的先例。
 */
export interface ReasoningEffortNotice {
  /** 用户本次选定的档位(undefined = 客户端根本没选) */
  requested?: ReasoningEffort | null
  /** 上游实际生效的档位 */
  effective?: ReasoningEffort | null
  /** true = 生效值与选定值不同,或被钉扎丢弃 ⇒ 必须上屏,不得静默 */
  fallback: boolean
  /** 回落原因(服务端给出,前端只做展示) */
  reason?: string
}

/** D09(2026-10-24 立):专家包自动路由档位 —— 封闭集,端内不得再写字面量数组。
 *  - `hint`(默认):只回一帧"命中了哪个专家包",不改工具与系统提示;
 *  - `auto`:命中时把专家包工具白名单与系统提示并入本次请求;
 *  - `off`:不分类、不提示。
 *  undefined = 不发该字段,由部署方 env(IHUI_EXPERT_AUTO_ROUTE)或后端默认档裁定。 */
export type ExpertAutoRouteMode = 'off' | 'hint' | 'auto'

export interface StreamChatOptions {
  model: string
  // role 含 'tool':与 @ihui/context-compaction 的 ChatMessage 及 OpenAI 兼容协议对齐
  messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }>
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onError?: (error: string, info?: SSEErrorInfo) => void
  onDone?: () => void
  onReasoning?: (delta: string) => void
  /** 后端自动压缩上下文(88% 阈值触发)时回调,前端可 toast 提示用户 */
  onCompaction?: (info: {
    tokensBefore: number
    tokensAfter: number
    removedCount: number
    /** A10B-8(2026-09-26):本轮被**内容级截断**的消息条数(与 removedCount 不同维:
     *  后者是被折进摘要移出上下文的整条消息数)。可选 ⇒ 旧帧缺席读作"未知",不读作 0。 */
    truncatedCount?: number
    usageRatio: number
    /** 压缩触发方式:ratio/absolute(常规摘要压缩)/truncated(超长单条消息截断降级)/incompressible */
    trigger?: string
    compressedMessages?: Array<{ role: string; content: string }>
    /**
     * 批次 3(2026-11-06):压缩边界与保留段(head/anchor/tail)。缺席 = 旧帧代际差,
     * 读作"无边界可回看",不是"没有压缩"。用于刷新后回看压缩前关键片段。
     */
    boundary?: CompactBoundarySnapshot
  }) => void
  /** AI 主动提问回调:LLM 在流中输出 [[ASK_USER:JSON]] 标记时触发,前端弹窗让用户回答 */
  onQuestion?: (question: {
    questionId: string
    prompt: string
    options: Array<{ id: string; label: string; description?: string }>
    allowCustom: boolean
    allowMultiple: boolean
    /** 卡片小标题(新帧可选;旧帧没有) */
    header?: string
    /** 答复截止时间(ISO 字符串或毫秒时间戳,新帧可选) */
    expiresAt?: string | number
    /** 2026-11-08 立:阻塞式提问所属的 ai-service 流会话 ID(旧帧没有)。
     *  前端据此把答复投到 `/llm/complete/stream/:sessionId/question-response`。 */
    sessionId?: string
  }) => void
  /** 2026-11-08 立:提问结算帧 —— 一个 questionId 只结算一次。
   *  answered / timeout / withdrawn / interrupted 四种结局都从这里回到流里;
   *  未注册回调时不解析(旧端零行为变化)。 */
  onQuestionResolved?: (event: {
    type: 'question-resolved'
    questionId: string
    status: 'answered' | 'timeout' | 'withdrawn' | 'interrupted'
    selectedOptionIds: string[]
    customText?: string
  }) => void
  /** P4-2: 后端 fallback 触发回调(主模型失败 + 切换到备用模型时触发,前端展示横幅提示) */
  onFallback?: (event: FallbackEvent) => void
  metadata?: {
    conversationId?: string
    userId?: string
    messageId?: string
    /** 票59(消息级版本切换 3/3,2026-10-22):regenerate 新回复的版本族坐标。
     *  网关 schema 声明后透传上游,ai-callback 回显落 chat_messages 两列;
     *  缺省 = 普通回复,请求体零变化(L3273 整包写入,undefined 键被 JSON 省略)。 */
    parentMessageId?: string
    siblingIndex?: number
  }
  /** 差距①(2026-10-30 立):客户端生成的稳定输入标识,随 POST body 上行(字段名 `inputId`)。
   *  服务端在 admission 帧里逐字回显它,上层 `SendAdmissionTracker` 据此把回执配到本条发送。
   *  undefined = 不发该字段 ⇒ 旧服务端/旧客户端互不破坏(字段可选是这条接线的安全垫)。
   *  ⚠️ 网关 schema 需声明 inputId 透传(否则 zod strip 静默丢弃,链路掐断 —— 属并行工作流面)。 */
  inputId?: string
  temperature?: number
  topP?: number
  topK?: number
  maxTokens?: number
  stop?: string[]
  /** 当前绑定的本地工作区路径(从 useAiPanelStore.activeWorkspace.path 取)。
   * 透传到后端用于注入 CLAUDE.md/AGENTS.md 项目记忆作为 system prompt。
   * 无绑定时为 undefined,后端使用默认 system prompt。 */
  workspacePath?: string
  /** P1 #26(2026-09-16 立):知识库默认注入开关(对标 Qoder Knowledge Engine)。
   *  默认 true(后端默认 top-3 知识检索注入 system_prompt,命中下发 citations 事件);
   *  仅显式 false 时写入 body(关闭知识检索,降级纯对话),undefined 不传走后端默认开。 */
  knowledgeContext?: boolean
  /** 浏览器端预加载的工作区文件内容(2026-08-02 立,阶段 1)。
   * web 非 Tauri 环境下,前端用 FileSystemDirectoryHandle 遍历读取工作区关键文件,
   * 把内容通过此字段传给后端,后端直接注入 system prompt(跳过从文件系统读取)。
   * Tauri 桌面端为 undefined,走 workspacePath 逻辑。 */
  workspaceContext?: string
  /** 阶段 2:工具委托执行回调(浏览器端收到 tool-delegate SSE 事件时触发)
   * 前端用 FileSystemDirectoryHandle 执行 fs 类工具,通过 postToolResult 回传结果 */
  onToolDelegate?: (event: ToolDelegateEvent) => void | Promise<void>
  /** V3 #58(2026-09-26 立):主对话流工具审批回调 —— ai-service tool loop 在
   *  高危工具执行前发 tool-approval 帧,前端弹窗请求用户批准/拒绝,决策经
   *  postToolApprovalResponse 回传。未注册回调时不解析;等待方按 120s 超时兜底
   *  (工具不执行,回填 TOOL_APPROVAL_TIMEOUT)。 */
  onToolApproval?: (event: ToolApprovalEvent) => void | Promise<void>
  /** V3 #58(2026-09-26 立):工作区权限模式档位,经网关透传为 ai-service 的
   *  permission_mode,工具审批门据此决定高危工具是否弹审批
   *  (bypass-permissions 不拦截;accept-edits 放行文件编辑类)。 */
  permissionMode?: string
  /** 79 号票(2026-10-18 立):权限双轴的两轴档位,经网关透传为 ai-service 的
   *  sandbox_mode / approval_policy(与 permissionMode / reasoningEffort 同区同形,
   *  camel 入 / snake 出),双轴裁决门据此判定工具调用的审批与放行。
   *  值域 = @ihui/types 的封闭联合,端内不得再写字面量数组。
   *  undefined = 不发该字段 ⇒ 后端按"未携带双轴"处理 —— 裁决门整段跳过,
   *  旧客户端零行为变化(这条是接线能安全落地的前置,不是保守偏好)。 */
  sandboxMode?: SandboxModeId
  approvalPolicy?: ApprovalPolicyId
  /** D130(2026-09-30 立):推理强度档位(输入区第三轴)。camel 入网关,网关转 snake 出到 ai-service
   *  (与 temperature/topP 同区、与 ai-chat-stream.ts 的 camel-in/snake-out 先例同形)。
   *  值域 = @ihui/types 的封闭联合,端内不得再写字面量数组。undefined = 不发该字段,
   *  后端按既有默认档处理 ⇒ 旧客户端零行为变化。 */
  reasoningEffort?: ReasoningEffort
  /** D09(2026-10-24 立):专家包自动路由档位(web 设置项)。camel 入网关,网关转 snake
   *  `expert_auto_route` 出到 ai-service(与 reasoningEffort 同区同形)。
   *  undefined = 不发该字段 ⇒ 部署方 env(IHUI_EXPERT_AUTO_ROUTE)或后端默认档生效。 */
  expertAutoRoute?: ExpertAutoRouteMode
  /** 模型上下文窗口大小(tokens),达 88% 阈值自动压缩(跨端统一)。
   * 由 use-chat.ts 调 getModelContextCapacity(model) 取得,后端不传则不压缩。 */
  contextLimit?: number
  /** SSE 端点路径(默认 /ai/chat/stream)。
   * 用户回答 AI 主动提问后续流走 /ai/chat/answer,需配合 extraBody 传 questionId + answer。 */
  path?: string
  /** 透传到请求 body 的额外字段(如 /chat/answer 的 questionId / answer)。 */
  extraBody?: Record<string, unknown>
  /** 绑定的 agent ID:透传到后端,后端在 SSE chunk 顶层注入 agentId。
   * 前端 onAgentDelta 据此分流到 subagent 卡片;缺失时降级为单 agent 模式。 */
  agentId?: string
  /** D01(2026-10-25 立):对话内选中的 persona(专家)id。
   *  传输层复用既有的 `agentId` 请求槽(网关 schema 只声明了这一个标识字段,
   *  且在网关侧它同时承担"给每条 data 行贴 agentId"的职责 —— 见下条)。
   *  与 `agentId` 的区别:persona 不是子代理,它的回包正文属于**主对话**,
   *  不能被当成 subagent delta 分流,故传 personaId 时本函数把"回包 agentId
   *  恰等于所选 persona"的 chunk 降级为普通 onDelta(不影响真正的 subagent 帧:
   *  其 id 形如 subagent_*,不会与 persona 名相同)。 */
  personaId?: string
  /** 多 agent 多路复用回调:chunk 带 agentId 时触发,与 onDelta 互斥(有 agentId 走此回调,无则走 onDelta)。 */
  onAgentDelta?: (agentId: string, delta: string) => void
  /** Agent 工具名列表(2026-07-22 立,AI 浏览器/电脑控制):
   *  传入工具名列表后,后端走 tool loop(complete→tool_calls→execute→astream)。
   *  如 ["browser_screenshot", "computer_mouse_click"] */
  agentTools?: string[]
  /** AI 工具调用回调(2026-07-22 立,P2 联动 WorkPanel):
   *  - toolCallStart:Vercel AI SDK 协议 type 9(tool-call-streaming-start)或 type 8(tool-call)
   *  - toolCallResult:type 7(tool-result)或自定义 tool_result 事件
   *  触发 WorkPanel.openPanel({ url, source: 'ai-tool' }) */
  onToolCall?: (event: ToolCallEvent) => void
  /** 工具调用汇总回调(2026-07-31 立,AI 对话可视化深度接入):
   *  后端在 SSE 流末尾发出 `type: 'tool-summary'` 聚合事件时触发,前端写入 message.toolCallSummary。
   *  缺失时前端可降级从 onToolCall 累加的 toolCalls 数组本地聚合。
   *  注意:本回调仅扩展类型签名,streamChat 实现解析逻辑由 A2/A3 任务补齐。 */
  onToolSummary?: (summary: ToolSummaryEvent) => void
  /** OpenAI 兼容流式模式(2026-11-05 立,逆向-复现-超越 Qoder/Trae 的 tool-call args 流式修复):
   *  上游按 OpenAI chat completion 流式协议下发(`choices[].delta.tool_calls[].function.arguments`
   *  为字符串分片)。开启后 streamChat 逐行经 parseOpenAiStreamLine 解析,tool_calls 增量喂给
   *  OpenAiToolCallAccumulator(内部用 ToolCallArgsStreamer 渐进修复/累积 args),每个分片即回调
   *  onOpenAiToolCall(带 partial/complete 态);文本增量回调 onOpenAiContent。
   *  默认 false ⇒ 走既有 Vercel AI SDK 协议解析,零行为变化。开启后 Vercel 解析照常跑(对 OpenAI
   *  行返回 null 不发重复 delta),两条解析互不干扰。 */
  openAiCompat?: boolean
  /** OpenAI 兼容模式下,每片 tool_calls 增量回调(含 partial/complete 态)。 */
  onOpenAiToolCall?: (delta: OpenAiToolCallDelta) => void
  /** OpenAI 兼容模式下,正文增量回调(`choices[].delta.content`)。 */
  onOpenAiContent?: (text: string) => void
  /** Subagent 自动派发回调(2026-07-28 立, Work):
   *  主 agent 在对话流中调用 dispatch_subagent 工具时,后端发 subagent_spawn/end SSE 事件,
   *  前端进度面板自动展示 subagent 生命周期(spawned → running → done/failed)。 */
  onSubagentSpawn?: (event: SubagentSpawnEvent) => void
  onSubagentEnd?: (event: SubagentEndEvent) => void
  /** Subagent 执行进度回调(2026-07-28 立):
   *  subagent 执行期间后端实时发 subagent_progress SSE 事件(thinking/tool_call/tool_result/output_ready),
   *  前端进度面板据此实时更新 subagent 状态,消除 spawn→end 之间的"黑盒等待"。 */
  onSubagentProgress?: (event: SubagentProgressEvent) => void
  /** Plan 更新回调(2026-08-01 Phase 4a:消息级 plan steps inline 展示) */
  onPlanUpdate?: (event: PlanUpdateEvent) => void
  /** 终端任务开始回调(2026-08-01 Phase 4a:消息级 terminal tasks inline 展示) */
  onTerminalStart?: (event: TerminalStartEvent) => void
  /** 终端任务结束回调(2026-08-01 Phase 4a:消息级 terminal tasks inline 展示) */
  onTerminalEnd?: (event: TerminalEndEvent) => void
  /** 终端实时输出增量回调(2026-09-18 立,消息级 terminal inline 实时回显)。
   *  命令执行期间后端逐块下发 terminal_delta SSE 事件,前端按 terminalId 累加到 store.terminalOutputs,
   *  与 onTerminalStart/End(任务级生命周期)互补:本回调负责命令执行中的流式文本。 */
  onTerminalDelta?: (event: TerminalDeltaEvent) => void
  /** D151(2026-09-29):命令在等键盘输入。默认无回调时**不解析**(与 tool-delta/injection 同口径),
   *  这样没接这条腿的端不会平白多一份解析开销,也不会出现"监听了但没人生产"的反向失真。 */
  onTerminalInteraction?: (event: TerminalInteractionEvent) => void
  /** D152(2026-09-29):会话目标状态变化(goal_updated)。默认无回调时**不解析**(与
   *  onTerminalInteraction/onToolDelta 同口径)。接了它的端即"服务端主副本 → 本地缓存"。 */
  onGoalUpdate?: (event: GoalUpdateEvent) => void
  /** D113:文件写类工具流中 diff 预览帧(默认无回调时不解析,与 injection 同口径) */
  onToolDelta?: (event: ToolDeltaEvent) => void
  /** 自动重连最大次数(默认 3)。网络错误指数退避重连,业务错误(401/403/429)不重连 */
  maxRetries?: number
  /** 自动重连前回调(前端可显示"网络波动,正在重连…") */
  onReconnect?: (attempt: number, delayMs: number) => void
  /** 2026-07-27 立:fetch 成功(response.ok)后立即触发,早于 onDelta/onReasoning。
   *  用途:前端收到 response 即清除"完全冷启动"超时(timeout15s),
   *  避免"response 已到达但首个 token 未到达"时误 abort。 */
  onResponse?: () => void
  /** D174(2026-09-29 立):帧级 trace 关联键(小写 32 hex)首次出现时回调一次。
   *  服务端每条帧都带 `traceId`(响应头只有整条响应的一个值,帧内这一份才是"这一轮"的锚),
   *  端上没有出口可取 ⇒ 用户报问题时无法把界面现象与 `llm_call_logs` 里的对账键连起来。
   *  只回调一次(后续帧同值,重复回调只会让消费侧自己去做去重);值非法(非 32 hex / 全 0)不回调。
   *  G-916415 R1(2026-10-07):内部记录与本回调解耦、逐行求值不以此为前提 ——
   *  帧级 traceId 无论是否注册本回调都会进错误上报体(SSEErrorInfo.traceId);本回调只是可选旁路。 */
  onTraceId?: (traceId: string) => void
  /** G-816031(2026-10-20):权威信封三轴账目。生产端下发 deliveryKind/reasonCode 时,
   *  streamChat 逐帧解门 / 判重订阅 / 处置迟到片;本回调在流结束时交出账目
   *  (含未判定逐条报名)。旧生产端从未下发权威信封 ⇒ 账目恒空、零行为变化。 */
  onRecoveryGateLedger?: (ledger: RecoveryGateLedger) => void
  /**
   * b76-15(2026-10-29 立):帧水位事实的**唯一读取出口**。
   *
   * 为什么必须有:水位判据此前只有写入侧 —— `_frameGapDropped` 带 `_` 前缀登记
   * "故意未读",而载荷级四字段(`subscriptionId/logEpoch/fromSeq/toSeq`)在生产端
   * 至今没有下发点,于是 `readFrameWatermark` 在真机上恒 `undetermined`、丢帧恒 0。
   * 账面"判过",实际"一次都没判"(AGENTS §0.3)。
   *
   * 现在:① 每次丢弃立刻报一次(`kind` 点名是哪条腿判的);② 流终态兜底再报一次
   * (`kind: 'stream-end'`),把"全程零丢弃"也变成**可读事实** —— 上层不该靠
   * 回调缺席去猜"没丢",那是把未判定读成绿。`payloadWatermarkSeen` 明确回答
   * 载荷级三维腿到底有没有机会跑过。
   *
   * 未注册 ⇒ 零成本(本仓 web 端已接线,见 `use-chat/stream-error-report.ts`)。
   */
  onFrameWatermarkFacts?: (facts: FrameWatermarkFacts) => void
  /** 2026-09-13 立,#11 Citations 全链路:knowledge_lookup 工具执行后,
   *  后端在 done 前下发 `event: citations` SSE 事件,前端据此写入 message.citations,
   *  MessageItem 渲染 CitationBar(来源标签 + 可点击 URL)。 */
  onCitations?: (event: CitationsEvent) => void
  /** P1 #27(2026-09-16 立):记忆更新可视化「已记住」提示条数据源。
   *  ai-service 在 done 事件 payload 携带 memoryUpdates: string[](本轮 LTM 新增条目摘要),
   *  前端据此在对应助手消息下方渲染「已记住:N 条」提示条。空数组表示本轮无新记忆。 */
  onMemoryUpdates?: (event: MemoryUpdatesEvent) => void
  /** D130(2026-09-30 立):后端把选定档位钉回时的通知(见 ReasoningEffortNotice)。
   *  不注册则不解析(与本包其余 per-field 解析器同形),注册了就必须上屏 —— 静默丢档是本票点名的那一型。 */
  onReasoningEffortNotice?: (info: ReasoningEffortNotice) => void
  /** Token 用量回调:后端在 SSE 流末尾发送 usage 事件时触发,
   *  前端据此更新消息 meta.usage(UI 展示 token 数 / 耗时 / 模型)。
   *
   *  D1(2026-09-19 立)升级:事件契约从「OpenAI 协议 usage chunk」扩展为
   *  「命名帧 event: usage / type:'usage'」,新增 reasoningTokens / 耗时 / 模型 /
   *  消息 id / 成本字段。旧 OpenAI 协议(json.usage 字段)仍兼容(见 tryParseUsage)。 */
  onUsage?: (usage: UsageEvent) => void
  /** Steer(中途引导,2026-09-19 立):流式对话期间用户提交的引导文本被 tool loop
   *  注入 messages 时触发(每条引导一次)。前端据此把消息 badge 从「排队中」换成
   *  「引导已生效」,用户确认引导已被 AI 下一轮看到。 */
  onSteer?: (event: SteerEvent) => void
  /** 差距①(2026-10-30 立):发送准入回执帧(admission)。服务端在流开始、完成准入判定后、
   *  首个内容帧之前回显本条发送时上行的 `inputId` 与 disposition(四档
   *  accepted/queued/rejected/duplicate)。形状不认(缺 inputId / 未知 disposition)
   *  ⇒ 整帧丢弃并计数,不猜档、不抛错;未注册回调时不解析(与其余 per-field 同口径)。 */
  onSendAdmissionReceipt?: (receipt: SendAdmissionReceipt) => void
  /** Budget 用量分档提醒(2026-09-19 立,网关发):流首网关按用户当日 AI 用量分档
   *  下发 warning(80%~95%)/critical(95%~100%)提醒帧,前端 toast 提示用量进度;
   *  ≥100% 为 HTTP 429 硬中断(errorCode 'BUDGET_EXHAUSTED'),走 onError 路径。 */
  onBudget?: (event: BudgetEvent) => void
  /** G-815976(2026-10-04 收口入契约):流式中断标记 —— llm_gateway 在 astream 异常
   *  中断且已发出过 chunk 时发出本帧(此后流终止,不会有 done)。此前它被解析层
   *  静默丢弃 ⇒ 半截回答与完整回答在端上完全同形。收到本帧时已到达正文**有效**,
   *  但必须如实告知用户"回答被截断",不得当作完整回答收束。 */
  onPartialDone?: (event: PartialDoneEvent) => void
  /** D115(2026-10-23):review 模式的结构化 finding 帧(review-finding)。一 finding 一帧,
   *  端上按严重度分组渲染并定位到 文件:行;未注册回调时**不解析**(与其余 per-field 同口径)。 */
  onReviewFinding?: (event: ReviewFindingEvent) => void
  /**
   * G-425(2026-10-07 立,默认档"只提示"):done 帧携带的上游 finish/stop reason
   * (OpenAI 系 `length`/`stop`;Gemini 原生 `STOP`/`MAX_TOKENS`)。与 onMemoryUpdates
   * 同型:读的是既有 done 帧上新增的可选字段,不新增事件名;未注册回调不解析。
   * 端上截断提示按 event.finishReason 小写 ∈ {length, max_tokens} 判。
   */
  onFinishReason?: (event: FinishReasonEvent) => void
  /** D155 配置告警(2026-09-29 立):生效配置有问题(如 base URL 被覆盖)时下发。
   *  表外 severity 值在解析层回退 'warning',不丢帧。 */
  onConfigWarning?: (event: ConfigWarningEvent) => void
  /** D155 弃用预告(2026-09-29 立):某能力/模型/端点即将弃用时下发。 */
  onDeprecationNotice?: (event: DeprecationNoticeEvent) => void
  /** D155 守护告警(2026-09-29 立):自动审查(guardian)发现风险时下发。 */
  onGuardianWarning?: (event: GuardianWarningEvent) => void
  /** D34 运行环境交代(2026-09-22 立):后端在**真正生效**的上下文注入之后、任何增量之前
   *  下发本帧,前端据此显示"本轮回答带了哪些注入"(自定义指令 / 工作区记忆 / Repo Wiki /
   *  检索上下文)。此前该帧只被"不喷进正文"地丢弃,等于生产了却没人看。 */
  onInjectionApplied?: (event: InjectionAppliedEvent) => void
  /** G-87 补链(2026-10-29 立):hook 执行失败帧(hook-failed)。与 onError 的分工见
   *  HookFailureEvent 头注:这个是"某个 hook 动作没跑成",回答本身通常完好;
   *  onError 是"这条回答失败"。不注册则不解析(与其余 per-field 同形)。 */
  onHookFailure?: (event: HookFailureEvent) => void
  /** D39 重试交代(2026-09-22 立):网关要换 key / 退避重试时下发,前端显示"第 N/M 次重试,
   *  Xs 后继续"。没有它,用户在流上看到的只是"卡住"。 */
  onRetryScheduled?: (event: RetryScheduledEvent) => void
  /** D77 对话流业务表单(2026-09-25 立,G-106):后端请在消息流内让用户填一张业务表单
   *  (邮件撰写 / 日历创建·更新)时下发本帧。前端把请求挂到对应 assistant 消息并渲染
   *  BusinessFormCard,用户的批准/拒绝经 `postFormResponse` 走**同一条会话通道**回传
   *  (形态与 tool-delegate → postToolResult 完全同族)。
   *  成对动作是协议要求:`actions` 必同时含 approve 与 reject,缺一条的帧在解析层即被丢弃。 */
  onFormRequest?: (event: FormRequestEvent) => void
  /** 2026-08-15 立:显式声明流式模式,默认 true。
   *  后端 detectStreamUsage 依赖 request.stream===true 才启用 usage chunk 注入,
   *  不传或传 false 会导致 usage 缺失,token 显示为 0。 */
  stream?: boolean
}

/** Subagent 派发生成事件(2026-07-28 立,ai-service tool loop 中 dispatch_subagent 工具执行前发出) */
export interface SubagentSpawnEvent {
  id: string
  role: string
  task: string
  timestamp: string
  /** 关联到触发该 subagent 的 assistant 消息 ID(2026-07-31 Phase 2) */
  messageId?: string
}

/** Subagent 派发结束事件(dispatch_subagent 工具执行后发出) */
export interface SubagentEndEvent {
  id: string
  status: 'done' | 'failed' | 'stub'
  failureReason?: string
  timestamp: string
  /** 关联到触发该 subagent 的 assistant 消息 ID(2026-07-31 Phase 2) */
  messageId?: string
}

/** Subagent 执行进度事件(2026-07-28 立,subagent 执行期间实时发出):
 *  - phase='thinking': subagent 开始 LLM 调用(含 iteration)
 *  - phase='tool_call': subagent 开始调用工具(含 tool name + iteration)
 *  - phase='tool_result': subagent 工具返回(含 tool name + ok + iteration)
 *  - phase='output_ready': subagent 最终输出就绪(含 output_preview)
 *  前端进度面板据此实时更新 subagent 状态,消除 spawn→end 之间的"黑盒等待"。 */
export interface SubagentProgressEvent {
  id: string
  phase: 'thinking' | 'tool_call' | 'tool_result' | 'output_ready'
  timestamp: string
  /** 当前迭代轮次(phase=thinking/tool_call/tool_result 时存在) */
  iteration?: number
  /** 工具名(phase=tool_call/tool_result 时存在) */
  tool?: string
  /** 工具是否成功(phase=tool_result 时存在) */
  ok?: boolean
  /** 输出预览(phase=output_ready 时存在,截断 200 字符) */
  outputPreview?: string
  /** agent 名称(并行模式下标识哪个 agent) */
  agentName?: string
  /** 关联到触发该 subagent 的 assistant 消息 ID(2026-07-31 Phase 2) */
  messageId?: string
}

/** AI 工具调用 SSE 事件(跨端共享) */
export type ToolCallEvent =
  | {
      type: 'tool-call-start'
      toolCallId: string
      toolName: string
      args?: Record<string, unknown>
      /** 工具来源(2026-07-31 立,ToolCallCard 区分原生/MCP 工具):builtin=内置 / plugin=插件市场 / mcp=MCP server */
      serverSource?: 'builtin' | 'plugin' | 'mcp'
      /** MCP server ID(serverSource='mcp' 时由后端透传,如 'context7' / 'filesystem' / 'github') */
      serverId?: string
      /** MCP server 显示名(serverSource='mcp' 时由后端透传,如 'Context7 MCP' / 'Filesystem MCP') */
      serverName?: string
    }
  | {
      type: 'tool-result'
      toolCallId: string
      toolName: string
      args?: Record<string, unknown>
      result?: unknown
      isError?: boolean
      /** 工具来源(2026-07-31 立,与 tool-call-start 一致;tool-result 事件可复用同一标识) */
      serverSource?: 'builtin' | 'plugin' | 'mcp'
      serverId?: string
      serverName?: string
      /**
       * 媒体产物顶层扁平化(2026-09-09 立,与后端 llm.py tool-result 事件对齐):
       * 媒体工具(图/视频/音乐/改图/TTS)产物 URL 与异步任务 ID 提到事件顶层,
       * 前端无需深挖 result 嵌套即可渲染;超长 data URI 后端已过滤不推送。
       */
      image_url?: string
      audio_url?: string
      video_url?: string
      task_id?: string
    }

/**
 * 工具调用汇总 SSE 事件(2026-07-31 立,AI 对话可视化深度接入)。
 * 在 SSE 流末尾由后端聚合发出(`type: 'tool-summary'`),前端收到后直接写入 message.toolCallSummary。
 * 字段与 @ihui/types/ai 的 ToolCallSummary 对齐,但此处作为 SSE 线上传输契约独立定义。
 * 未收到时前端可降级从 toolCalls 数组本地聚合。
 */
export interface ToolSummaryEvent {
  filesSearched: number
  webSearched: number
  filesModified: number
  linesAdded: number
  linesDeleted: number
  toolsByCategory: Record<string, number>
  totalCalls: number
  totalDurationMs?: number
  /** 涉及目录数(唯一目录集合;可选 —— 旧后端 / 历史回放帧不带,渲染层隐藏该 chip,
   *  绝不以 0 冒充"没碰目录")。 */
  directories?: number
  /** 编辑/写入类工具调用**次数**(区别于 filesModified 的唯一文件数)。 */
  edits?: number
  /** 终端命令类工具调用次数。 */
  terminalCommands?: number
}

/**
 * 非法 JSON `data:` 帧的丢弃计数(留痕,与 `_sseFrameSchemaFaults`/`watermarkDroppedFrames`
 * 同口径:丢帧必须留痕,不冒充解析成功)。
 *
 * 判据(F5,2026-11-13):仅当 `data` **以 `{` 或 `[` 开头**(即本应是一个 JSON 帧)却
 * `JSON.parse` 抛 SyntaxError 时才计——那是上游截断/畸形帧,丢弃绝不喷进正文。
 * 不以 `{`/`[` 开头的纯文本 token 行(Vercel AI SDK 风格裸 token)**保留既有正文
 * delta 兼容**,不计入此故障(见 tests/stream-chat-admission.test.ts "纯文本 delta
 * 兼容是既有行为,本票不改变")。
 */
let _sseParseFaults = 0
/** 读取非法 JSON 帧丢弃计数(供测试/诊断观测,只增不重置)。 */
export function getStreamParseFaultCount(): number {
  return _sseParseFaults
}

export function parseStreamLine(line: string): string | null {
  if (!line || line.startsWith(':')) return null
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }
  if (data === '[DONE]') return null
  // Vercel AI SDK data-stream protocol: `TYPE:JSON`（type 0 = 文本 token，其他类型目前忽略）
  const proto = data.match(/^(\d+):(.*)$/s)
  if (proto?.[1] !== undefined) {
    if (proto[1] === '0') {
      try {
        const parsed = JSON.parse(proto[2]!)
        if (typeof parsed === 'string') return parsed
      } catch {
        /* fallthrough */
      }
    }
    return null
  }
  try {
    const json = JSON.parse(data)
    // G-87 补链(2026-10-29,实测踩过):`hook-failed` 帧自带 `error` 字符串字段,
    // 而下面第一条就是 `json.error && typeof === 'string' ⇒ throw`(OpenAI 错误格式)。
    // 分流必须排在**错误判据之前** —— 否则一个"lint hook 挂了"的帧会被当成本轮回答失败:
    // 抛 SSEError → runner 重连 → 前端气泡变红,而界面文案与真实原因毫无关系。
    // (实测症状:带 error 的 hook-failed 帧 100% 触发重连,去掉该字段就正常。)
    if (json?.type === 'hook-failed') return null
    if (json?.type === 'error' && typeof json?.message === 'string') {
      throw attachErrorMeta(new Error(json.message), json)
    }
    if (json?.error === true && typeof json?.error_message === 'string') {
      throw attachErrorMeta(new Error(json.error_message), json)
    }
    if (json?.error && typeof json?.error === 'string') {
      // OpenAI 错误格式:{ "error": { "message": "...", "code": "..." } } / { "error": "rate limit", "code": 429 }
      const e = new Error(
        typeof json.error === 'string' ? json.error : (json.error.message ?? 'AI 服务异常'),
      )
      throw attachErrorMeta(e, json)
    }
    // P3-4: 识别 {code:"RATE_LIMIT", retryAfter:N, message:"..."} 格式(无 type/error 字段)
    // 该格式由后端限流中间件发出,无 type/error 字段时上方 3 个分支均不命中,retryAfter 会被丢弃
    if (typeof json?.code === 'string' && typeof json?.message === 'string') {
      const e = new Error(json.message)
      throw attachErrorMeta(e, json)
    }
    if (json?.type === 'reasoning') return null
    // 2026-09-18 立:thinking / terminal_delta / compaction 走专用通道,
    // 绝不能回落成正文增量(parseStreamLine 对每行都会调用,必须在兜底抽取前拦截)。
    if (json?.type === 'thinking') return null
    if (json?.type === 'terminal_delta') return null
    // D151:terminal_interaction 同样走专用通道 —— 它没有 content/text 字段,但兜底抽取
    // 会把它当"未知帧"处理,显式分流是不依赖兜底行为的写法(与 terminal_delta 同一条禁令)。
    if (json?.type === 'terminal_interaction') return null
    if (json?.type === 'compaction') return null
    // D1(2026-09-19 立):usage 命名帧走专用通道(tryParseUsage),
    // 同样不可回落成正文增量(历史坑:带 content 的未知帧曾喷进正文;
    // 本帧不含 content,但仍显式分流,绝不落入 onDelta)。
    if (json?.type === 'usage') return null
    // Steer(2026-09-19 立):中途引导注入确认帧走专用通道(tryParseSteer)。
    // 本帧带 text 字段,不拦截会被下方兜底抽取链(json?.text)喷进正文增量
    // (与上方 usage 帧同一坑位,必须在兜底抽取前拦截)。
    if (json?.type === 'steer') return null
    // 差距①(2026-10-30 立):admission 帧走专用通道(tryParseSendAdmission)。
    // 本帧不带 content/text/delta,兜底抽取链本会对它静默返回 null —— 但显式分流是
    // 不依赖兜底行为的写法(与 usage/steer/budget 同一坑位纪律)。
    if (json?.type === 'admission') return null
    // Budget(2026-09-19 立):网关用量分档提醒帧走专用通道(tryParseBudget)。
    // 不拦截同样会被下方兜底抽取链喷进正文增量(与 steer 同一坑位,必须在兜底前拦截)
    if (json?.type === 'budget') return null
    // G-815976(2026-10-04 收口入契约):流式中断标记帧走专用通道(onPartialDone)。
    // 本帧不带 content/text 字段,兜底抽取链本会对它静默返回 null —— 但它存在的
    // 意义恰是"半截回答 ≠ 完整回答",静默丢弃 = 该帧要防的混淆继续发生。
    // 显式分流是不依赖兜底行为的写法(与 usage/steer/budget 同一姿势)。
    if (json?.type === 'partial_done') return null
    // D34(2026-09-22 立):运行环境交代帧必须显式分流。injection_applied 带 collapsed/fullText、
    // retry_scheduled 带 message —— 不拦截会被下方兜底抽取链喷进正文增量,
    // 历史坑位与 usage/steer/budget 同一处。
    // (settings_applied 与 terminal_output 两帧已于第 36 轮从契约收回,见 sse_contract.py)
    if (json?.type === 'injection_applied') return null
    if (json?.type === 'retry_scheduled') return null
    const choice = json?.choices?.[0]
    const delta =
      // 2026-11-04(sse-event-parity):chunk 契约声明 content;显式读取(行为等价,
      // 原实现走通用兜底 json?.content,读点对 chunk 不可见)
      json?.type === 'chunk' && typeof json.content === 'string'
        ? json.content
        : (choice?.delta?.content ??
          choice?.message?.content ??
          json?.content ??
          json?.delta ??
          json?.text)
    return typeof delta === 'string' ? delta : null
  } catch (e) {
    if (e instanceof SyntaxError) {
      // F5 修复(2026-11-13):本应是 JSON 帧(以 { 或 [ 开头)却解析失败 ⇒ 上游截断/畸形帧。
      // 丢弃(return null)、不计入正文,避免把原始非法字符串当 delta 喷进回答气泡;留痕计数。
      // 纯文本 token 行(不以 {/[ 开头)仍原样返回,保持既有正文 delta 兼容。
      if (/^[\[{]/.test(data)) {
        _sseParseFaults++
        return null
      }
      return data
    }
    throw e
  }
}

function attachErrorMeta(err: Error, json: Record<string, unknown>): Error {
  err.name = 'SSEError'
  const code =
    typeof json.code === 'number'
      ? json.code
      : typeof json.statusCode === 'number'
        ? json.statusCode
        : typeof json.status === 'number'
          ? json.status
          : undefined
  if (code !== undefined) (err as Error & { code: number }).code = code
  if (typeof json.errorCode === 'string') {
    ;(err as Error & { errorCode: string }).errorCode = json.errorCode
  }
  if (typeof json.retryAfter === 'number') {
    ;(err as Error & { retryAfter: number }).retryAfter = json.retryAfter
  }
  // F3 修复(2026-11-13):此函数只被 parseStreamLine 的**流内 error 帧**四分支调用,
  // 区别于 HTTP 层错误(后者由 fetchApi/状态码路径产生,不经过这里)。这类帧是
  // 确定性业务失败(如 402 配额耗尽),不是网络抖动,默认不可重连——除非帧显式带
  // retryAfter(保留既有可重试语义)。标记挂在 err 上,由 runResumableSSEStream 识别。
  ;(err as Error & { isStreamBusinessError?: boolean }).isStreamBusinessError = true
  return err
}

/**
 * 从 SSE data: 行提取顶层 agentId 字段。
 * 仅 JSON 对象格式支持(`data: {"choices":[...],"agentId":"..."}`);
 * Vercel AI SDK `0:"token"` / 纯文本 / 非 JSON → undefined。
 */
export function extractAgentId(line: string): string | undefined {
  if (!line || line.startsWith(':')) return undefined
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return undefined
  }
  if (!data || data === '[DONE]') return undefined
  // Vercel AI SDK 协议 `0:"..."` → 无 agentId
  if (/^\d+:/.test(data)) return undefined
  if (!data.startsWith('{')) return undefined
  try {
    const json = JSON.parse(data) as Record<string, unknown>
    if (typeof json?.agentId === 'string') return json.agentId
  } catch {
    /* 非 JSON */
  }
  return undefined
}

// ---------------------------------------------------------------------------
// G-998168 票5(2026-10-05 立):首帧耗时分段归因 —— **回传不落库(机主拍板⑥)**。
// 服务端(apps/api 网关)把 prepare/upstreamConnect/firstByte/storage 四段计时挂在
// **首帧**数据载荷的顶层可选字段 `openTiming` 上随流回传(additive optional 字段,
// 非新增命名事件:契约文件/事件名集合零变化,老客户端按未知字段忽略)。
// 不建表、不做迁移、不加指标家族 —— "重启即无历史、画不了长期趋势"是拍板的预期代价。
// ---------------------------------------------------------------------------
/**
 * 首帧耗时分段归因(线格式,与网关侧 apps/api StreamOpenTiming 同形)。
 * 字段集固定且 versioned;各 ms 为整数;**不可信样本(时钟回退/双钟分歧)⇒ null
 * 而不是夹成 0**(缺席语义,消费端按"未知"渲染)。
 */
export interface StreamOpenTiming {
  /** 分段字段集版本(字段集变更时 +1) */
  version: 1
  /** host 前置:网关入口 → 发起上游连接前(含存储读归因子段,非互斥切分) */
  prepareMs: number | null
  /** 上游连接:发起上游请求 → 拿到响应头 */
  upstreamConnectMs: number | null
  /** 首个上游字节:响应头 → 首次 read 返回 */
  firstByteMs: number | null
  /** 存储/索引读耗时;该路径无此类读 ⇒ null */
  storageReadMs: number | null
  /** 上游连接是否冷启(无复用即冷) */
  coldStart: boolean
}

/**
 * G-998168 票5:从 SSE data: 行提取顶层 openTiming 分段归因对象(与 extractAgentId 同构;
 * chunk 帧带该字段时正文仍由 parseStreamLine 照常产出 —— 字段级增量,不做帧级分流)。
 * 仅 JSON 对象格式支持;字段集/取值校验失败(version 非 1 / ms 非整数且非 null /
 * coldStart 非 boolean / 缺字段)⇒ 整体返回 null —— 半个分段对象比没有更误导,
 * 不做部分放行。Vercel AI SDK `0:"..."` / 纯文本 / event:/id: 行 / [DONE] ⇒ null。
 */
export function extractOpenTiming(line: string): StreamOpenTiming | null {
  if (!line || line.startsWith(':')) return null
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }
  if (!data || data === '[DONE]') return null
  // Vercel AI SDK 协议 `0:"..."` → 无 openTiming
  if (/^\d+:/.test(data)) return null
  if (!data.startsWith('{')) return null
  try {
    const json = JSON.parse(data) as Record<string, unknown>
    const raw = json?.openTiming
    if (typeof raw !== 'object' || raw === null) return null
    const o = raw as Record<string, unknown>
    // version 之外的多余 key 静默忽略(向前兼容);六个固定字段逐一严校
    if (o.version !== 1) return null
    const msOrNull = (v: unknown): v is number | null =>
      v === null || (typeof v === 'number' && Number.isInteger(v))
    if (
      !msOrNull(o.prepareMs) ||
      !msOrNull(o.upstreamConnectMs) ||
      !msOrNull(o.firstByteMs) ||
      !msOrNull(o.storageReadMs)
    ) {
      return null
    }
    if (typeof o.coldStart !== 'boolean') return null
    return {
      version: 1,
      prepareMs: o.prepareMs,
      upstreamConnectMs: o.upstreamConnectMs,
      firstByteMs: o.firstByteMs,
      storageReadMs: o.storageReadMs,
      coldStart: o.coldStart,
    }
  } catch {
    /* 非 JSON */
  }
  return null
}

/** P4-2: 后端 fallback 事件 — 主模型失败切换到备用模型时,后端在 chunk 产出前发送此事件 */
export interface FallbackEvent {
  /** 原模型(失败的主模型) */
  primaryModel: string
  /** 备用模型(切换到的) */
  backupModel: string
  /** 切换原因(timeout/rate_limit/api_error/unknown) */
  reason: string
}

/**
 * Steer(中途引导,2026-09-19 立):流式对话期间用户经 steer 端点提交引导文本,
 * ai-service tool loop 每轮 LLM 调用前 drain 注入 messages 时下发注入确认事件。
 *
 * SSE 事件格式(契约见 packages/shared/src/sse/contract.ts):
 *   event: steer
 *   data: {"type":"steer","phase":"injected","text":"用户引导文本",
 *          "timestamp":"ISO(入队时间)","messageId":"assistant 消息 ID"}
 *
 * 前端 onSteer 据此把消息从「排队中」换成「引导已生效」badge。
 */
export interface SteerEvent {
  /** 当前仅 "injected"(已注入 messages);预留扩展 */
  phase: 'injected'
  /** 2026-11-04(sse-event-parity):契约 steer 的条目类型轴(guide/control,缺省不带) */
  kind?: string
  /** 用户引导文本(注入 messages 的原文,≤4000 字符) */
  text: string
  /** 入队时间(ISO,来自 steer 端点) */
  timestamp?: string
  /** 所属 assistant 消息 ID(流启动即确定,便于前端挂 badge) */
  messageId?: string
}

/**
 * 发送准入回执(差距①,2026-10-30 立):服务端在流开始、完成准入判定后、首个内容帧之前
 * 回显客户端上行的 inputId 与 disposition。
 *
 * SSE 事件格式(契约见 packages/shared/src/sse/contract.ts,形状真相源见
 * packages/shared/src/chat/send-admission.ts 的 SendAdmissionReceipt):
 *   event: admission
 *   data: {"type":"admission","inputId":"...","disposition":"accepted",
 *          "messageId":"...","queuedTurnId":"...","reason":"..."}
 *
 * ⚠️ 本包运行时依赖面为零(不 import @ihui/shared,与 GetConversationHistoryParams.direction
 * 同一处置),下方三件(四档闭集 / 接口 / 严格解析)是那份真相源的**镜像**:
 * 规则漂移由 packages/shared/src/chat/__tests__/send-admission.test.ts 与本包
 * tests/stream-chat-admission.test.ts 各自的判例表拦下,两侧喂的是同一批形状。
 */
export const ADMISSION_DISPOSITIONS = ['accepted', 'queued', 'rejected', 'duplicate'] as const
export type AdmissionDisposition = (typeof ADMISSION_DISPOSITIONS)[number]

export interface SendAdmissionReceipt {
  /** 客户端生成的稳定输入标识,必须与本条发送时带的那个逐字相等 */
  readonly inputId: string
  readonly disposition: AdmissionDisposition
  /** 服务端为这一轮分配的助手消息 id */
  readonly messageId?: string
  /** queued 档专用:排队项标识 */
  readonly queuedTurnId?: string
  /** queued 档专用:本条之前还有几轮在排队(服务端给出的位次,非负整数) */
  readonly ahead?: number
  /** 拒收原因码(命名错误码) */
  readonly reason?: string
}

/**
 * 严格读准入回执(与 @ihui/shared chat/send-admission.ts 的 readSendAdmissionReceipt 同规则):
 * 形状不认 ⇒ null(**不猜、不补默认档**)。只有 inputId(非空串)与 disposition(四档内)
 * 是必需的;可选字段缺席读作"服务端没说明",类型错则整键不带上(不折成空串/0)。
 */
export function readSendAdmissionReceipt(
  raw: Record<string, unknown>,
): SendAdmissionReceipt | null {
  const inputId = raw['inputId']
  const disposition = raw['disposition']
  if (typeof inputId !== 'string' || inputId.length === 0) return null
  if (
    typeof disposition !== 'string' ||
    !(ADMISSION_DISPOSITIONS as readonly string[]).includes(disposition)
  ) {
    return null
  }
  const receipt: {
    inputId: string
    disposition: AdmissionDisposition
    messageId?: string
    queuedTurnId?: string
    ahead?: number
    reason?: string
  } = { inputId, disposition: disposition as AdmissionDisposition }
  const messageId = raw['messageId']
  if (typeof messageId === 'string' && messageId.length > 0) receipt.messageId = messageId
  const queuedTurnId = raw['queuedTurnId']
  if (typeof queuedTurnId === 'string' && queuedTurnId.length > 0)
    receipt.queuedTurnId = queuedTurnId
  const ahead = raw['ahead']
  // ahead 是 queued 档的专属字段("前面还有几位");非 queued 档即使服务端误带也必须缺席,
  // 否则调用方在 accepted/rejected/duplicate 上读到一条无意义的排队位次(2026-11-18 主干 rn-tests 红)。
  if (
    disposition === 'queued' &&
    typeof ahead === 'number' &&
    Number.isInteger(ahead) &&
    ahead >= 0
  )
    receipt.ahead = ahead
  const reason = raw['reason']
  if (typeof reason === 'string' && reason.length > 0) receipt.reason = reason
  return receipt
}

/**
 * Budget 用量分档提醒事件(2026-09-19 立,网关发):流开始前网关按用户当日 AI 用量
 * 三态分档,80%~95% 发 level:'warning'(软提醒)、95%~100% 发 level:'critical'(硬预警),
 * 均为流首命名帧不中断流(≥100% 为 HTTP 429 硬中断,不走本事件,走 onError +
 * errorCode 'BUDGET_EXHAUSTED')。前端 onBudget 据此 toast 提示用量进度。
 *
 * wire 格式(命名帧):
 *   event: budget
 *   data: {"type":"budget","level":"warning","percent":85.3,"usedTokens":85300,
 *          "limitTokens":100000,"tier":"个人版","resetAt":"2026-09-20T16:00:00.000Z"}
 */
export interface BudgetEvent {
  /**
   * 档位:warning(80%~95%)| critical(95%~100%)| stopped(硬停止)。
   * 批次 3(2026-11-06)新增 stopped:预算护栏主动停流时下发终态帧,
   * 与请求级 429(BUDGET_EXHAUSTED)区分 —— 前者流已经开始,后者流未开始。
   */
  level: 'warning' | 'critical' | 'stopped'
  /** 当日已用占限额百分比(0~100) */
  percent?: number
  /** 当日已用 tokens */
  usedTokens?: number
  /** 当日限额 tokens */
  limitTokens?: number
  /** 用户预算档位名(如 VIP 等级名,可选) */
  tier?: string
  /** 限额重置时间(ISO,东八区次日 0 点,可选) */
  resetAt?: string
  /** 硬停止原因码(仅 stopped 必填;闭集见 @ihui/shared BUDGET_STOP_REASON_CODES) */
  reasonCode?: string
  /** 停止作用域(daily/hourly/pillar/request/provider) */
  scope?: string
  /** 触发停止的支柱(scope='pillar' 时下发) */
  pillar?: string
  /** 停止时用量百分比(0~100,可 >100) */
  usagePercent?: number
  /** 停止时该作用域剩余 token */
  remainingTokens?: number
  /** 停止发生在第几轮迭代(agent 循环) */
  stoppedAtIteration?: number
}

// ---------------------------------------------------------------------------
// G-815976(2026-10-04 收口入契约):流式中断标记帧。生产点 llm_gateway.py 的
// astream 异常中断分支(已发过 chunk、不可撤回、不可中途换 provider);契约声明见
// packages/shared/src/sse/contract.ts(SSE_EVENTS.PARTIAL_DONE)与
// apps/ai-service/app/core/sse_contract.py 的 SSEEventContract("partial_done", …)。
export interface PartialDoneEvent {
  /** 恒 false:本帧只在"未走 fallback、已发过 chunk"那一格发出 */
  fallback_applied: boolean
  /** 中断原因,现值 'stream_interrupted' */
  reason: string
  /** 本轮实际使用的模型(可缺省) */
  model?: string
}

/**
 * G-425(2026-10-07 立,默认档"只提示"):done 帧的 finish/stop reason 透传事件。
 * 生产点:ai-service provider 层(gemini/openai 原生适配器)+ llm_gateway LiteLLM 路径,
 * 经 llm.py /llm/complete/stream 的 done 重建点透传;契约声明见
 * packages/shared/src/sse/contract.ts 的 done 帧 `finishReason` 字段。
 */
/** D115(2026-10-23):review 模式的结构化 finding 帧(review-finding)。
 *  定义放本包是为了守住零依赖包边界:不 import @ihui/shared,与 PartialDoneEvent 同姿势。 */
export interface ReviewFindingEvent {
  /** 本次审查内的稳定标识(`rf-<序号>`,重连重放时同序) */
  findingId: string
  /** 1-based 序号与总数(端上据此显示"第 i/n 条",total=0 的帧不存在) */
  index: number
  total: number
  /** 严重度三档封闭集(与 shared 契约同值:P1 阻塞 / P2 建议 / Nit 细节) */
  severity: ReviewFindingSeverity
  /** 仓库相对路径 */
  file: string
  /** 新文件里的 1-based 行号;0 = 整文件级 finding(端上只显示文件) */
  line: number
  /** 一句话结论 */
  title: string
  /** 为什么是问题(可为空串) */
  detail: string
  /** 一行修复建议(可为空串) */
  suggestion: string
  /** 审查对象描述(如 `uncommitted` / `branch:main` / `commit:abc1234`),可缺省 */
  target?: string
}

/** review-finding 的严重度域(与 shared 契约的 `'P1' | 'P2' | 'Nit'` 同值)。 */
export type ReviewFindingSeverity = 'P1' | 'P2' | 'Nit'

export interface FinishReasonEvent {
  /** 上游原样值(不归一):`length`/`stop`/`tool_calls`/`STOP`/`MAX_TOKENS`/… */
  finishReason: string
  /** done 帧同载体元数据(契约 done:usage/model/stub/capabilities;缺省不带键) */
  model?: string
  usage?: Record<string, unknown>
  stub?: boolean
  capabilities?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// D155(2026-09-29 立):下行告警族另外三档(契约声明见
// packages/shared/src/sse/contract.ts 的 SSE_ALERT_EVENTS 段;生产判定点在
// ai-service,现场释放前本包先把解析通道备好 —— 与 budget 同一装车姿势)。
// 三档共用 severity 域 info|warning|critical;**解析层对表外 severity 回退
// 'warning' 而不是丢帧**(至少 message/severity 要到消费端,D34/D40 教训)。
// 契约类型本包不 import @ihui/shared(零依赖包边界),severity 字面量在此自持,
// 与 shared 的 SSEAlertSeverity 由 shared 契约测试钉住同值。
// ---------------------------------------------------------------------------

/** 三档告警共用的强度域(与 shared SSE_ALERT_SEVERITIES 同值)。 */
export type AlertSeverity = 'info' | 'warning' | 'critical'

/** config-warning 帧:生效配置有问题(如 base URL 被覆盖到非预期端点)。 */
export interface ConfigWarningEvent {
  severity: AlertSeverity
  /** 人可读的问题描述(生产端措辞) */
  message: string
  /** 出问题的配置项(如 'baseUrl');缺省表示未定位到单项 */
  field?: string
  /** 关联的供应商标识;缺省表示全局配置问题 */
  provider?: string
  /** 当前生效值;可能敏感时生产端整字段省略 */
  effectiveValue?: string
}

/** deprecation-notice 帧:某能力/模型/端点即将弃用(sunsetAt 之前仍可用)。 */
export interface DeprecationNoticeEvent {
  severity: AlertSeverity
  /** 人可读的弃用说明 */
  message: string
  /** 即将弃用的能力标识(模型名/端点名/参数名) */
  capability?: string
  /** 建议的替代品;缺省表示暂无替代 */
  alternative?: string
  /** 彻底停用时间(ISO) */
  sunsetAt?: string
}

/** guardian-warning 帧:自动审查(guardian)发现风险。 */
export interface GuardianWarningEvent {
  severity: AlertSeverity
  /** 人可读的风险描述 */
  message: string
  /** 风险类别(值域由生产端定义,端上只透传) */
  category?: string
  /** 触发本次审查的审查器 id */
  reviewId?: string
}

/**
 * D34 上下文注入交代帧(2026-09-22 立)。
 *
 * SSE 事件格式:
 *   event: injection_applied
 *   data: {"type":"injection_applied","kind":"workspace_memory","collapsed":"AGENTS.md · 3 条",
 *          "fullText":"…","messageId":"m-1"}
 *
 * kind 由后端定义(与 sse_contract.py 的 terminal_end/injection_applied 同一族);
 * collapsed 是行内展示用的短标签,fullText 是展开后的全文(可缺省)。
 */
export interface InjectionAppliedEvent {
  kind: string
  /** 行内短标签(必填:没有它界面就无处可显示) */
  collapsed: string
  /** 展开全文;后端超出可携带上限时整字段省略(不给假的"展开"入口) */
  fullText?: string
  /** auto_context 场景的上下文段数(界面按 ICU plural 出措辞) */
  count?: number
  messageId?: string
}

/**
 * D39 重试交代帧(2026-09-22 立)。attempt 从 1 起;retryInMs=0 表示立即重试
 * (如号池换 key),>0 表示退避等待。
 */
export interface RetryScheduledEvent {
  attempt: number
  maxRetries: number
  retryInMs: number
  httpStatus?: number
  messageId?: string
}

/**
 * G-87 补链(2026-10-29 立):hook 执行失败帧(`event: hook-failed`)的解析后形态。
 *
 * **为什么必须有这一格,而不是走既有的 `error` 帧**:`error` 是「这一轮回答失败了」,
 * 消费面是 `onError` → `setMessageError`(气泡变红、正文不可用);hook 失败是
 * 「某个用户配置的 hook 动作没跑成」,回答本身通常完好 —— 混到 `error` 里就是让前端
 * 把"我的 lint hook 挂了"读成"这条回答失败了"。两件事必须两个帧。
 *
 * 字段来源 = ai-service `hook_engine._broadcast_hook_failed` 的 wire 载荷(snake_case,
 * 与 hook 透传帧同族);本类型是 camelCase 视图形态,与其余 per-frame 回调同构。
 *
 * ⚠️ **三字段的可取性(如实登记,勿当恒有)**:
 *   · `command`  —— 只有 `script` 动作才有;其它动作类型整键缺席(webhook 的 url 不外泄);
 *   · `stderr`   —— 只有脚本**真跑完且非零退出**才有;超时/未配置/被敏感模式拒/
 *                   子进程起不来这几档都**没有输出可给**,整键缺席;
 *   · `exitCode` —— 同上;被超时杀掉的进程**没有退出码**(不补 0)。
 * 缺席 ≠ 空串 ≠ 0:渲染层据此跳过该字段(不画空标签),而 `0` 是"确实以 0 退出"
 * 这个肯定结论(与"没取到"不可合并)。
 */
export interface HookFailureEvent {
  /** hook 实体 id(`hk-…`) */
  hookId: string
  /** hook 名字(用户创建时的 name) */
  hookName: string
  /** 触发这次执行的 hook 事件名(如 `tool.before`) */
  hookEvent: string
  /** 终态两档:失败 / 超时。取值域与 ai-service 发射面一致(服务端只发这两档) */
  state: 'failed' | 'timedOut'
  /** 失败原因(已脱敏,截断) */
  error: string
  /** 墙钟耗时(ms,含重试与退避等待) */
  durationMs: number
  /** 失败时刻(ISO 字符串,服务端时钟) */
  failedAt: string
  /** 动作类型(webhook/script/log/notify);缺席 = 旧帧没报 */
  actionType?: string
  /** 命令行(**仅 script 动作**,已脱敏) */
  command?: string
  /** 脚本 stderr(**仅真跑完且非零退出**,已脱敏) */
  stderr?: string
  /** 脚本退出码(**仅真跑完且非零**) */
  exitCode?: number
  /** 挂载到哪条 assistant 消息;缺省时调用方回退当前流式消息 */
  messageId?: string
}

/**
 * D77 对话流业务表单请求帧(2026-09-25 立,G-106)。
 *
 * ⚠️ V3 #63 现读结论(2026-09-27):本帧**当前无任何后端生产点** ——
 *   `apps/api/src` 与 `apps/ai-service/app` 全量 grep `form_request` 均 0 命中,
 *   `packages/shared/src/sse/contract.ts` 也未登记 form_request 成员(旧注释声称
 *   "与 contract.ts 逐字段同形"不实,已就地更正)。本解析分支保留的唯一理由是
 *   D77 在飞的对话流宿主(business-form-section / stores/business-forms)以
 *   `onFormRequest` 为装车落点;契约登记 + 生产者 + form_response 接收端补齐归
 *   D77/#63 后续票,**在生产点落地前,不得让任何端把业务逻辑挂在这条恒不命中的帧上**。
 *
 * SSE 事件格式(目标形态,尚未生产):
 *   event: form_request
 *   data: {"type":"form_request","requestId":"frm-1","sessionId":"s-1",
 *          "kind":"email","fields":[{"key":"to","type":"email","required":true}],
 *          "actions":["approve","reject"],"messageId":"m-1"}
 *
 * fields / actions 的形状**不在本文件重定义**:判定层
 * packages/shared/src/chat/business-forms.ts 的 BUSINESS_FORM_FIELDS 是唯一字段表,
 * 本端只做"字段名照抄、类型收窄"的 wire 镜像;校验/状态机全在那一侧。
 * 缺 requestId 或 actions 不成对(必须 approve+reject 两条)即视为畸形帧,不发回调。
 */
export interface FormRequestEvent {
  /** 应答锚点:提交 form_response 时原样带回 */
  requestId: string
  /** 上行回传通道会话 ID(与 tool-delegate 的 session_id 同族);缺省时端内不得自造 */
  sessionId?: string
  /** 'email' | 'calendarEvent'(判定层 BUSINESS_FORM_KINDS) */
  kind: string
  /** 表单形态:'create'(缺省)/'update'/'save';D77 残余①,端内默认按创建处理 */
  mode?: string
  /** 字段集(key/type/required;type 取值见 FORM_FIELD_TYPES) */
  fields: Array<{ key: string; type: string; required: boolean; placeholderKey?: string }>
  /** 成对动作,恒为 ['approve','reject'] */
  actions: string[]
  messageId?: string
}

/**
 * D77 业务表单应答帧(**上行**)。
 *
 * 由 `buildFormResponseEvent()` 产出、`postFormResponse()` 发出,与 contract.ts 的
 * form_response 成员逐字段同形。成对判据:
 *   · action='approve' → 必带 values,不带 rejectReason
 *   · action='reject'  → 必带 rejectReason,**整字段省略 values**(拒绝零副作用:
 *     空对象会诱导后端建一条空记录)
 */
export interface FormResponseEvent {
  requestId: string
  kind: string
  action: 'approve' | 'reject'
  /** 仅 approve 携带 */
  values?: Record<string, string | readonly string[]>
  /** 仅 reject 携带 */
  rejectReason?: string
  messageId?: string
}

/** 业务表单成对动作(与判定层 FORM_ACTIONS 同取值;本包不依赖 @ihui/shared,故本地收窄) */
export const FORM_RESPONSE_ACTIONS = ['approve', 'reject'] as const

/** V3 #58(2026-09-26 立):主对话流工具审批请求事件。
 *  ai-service tool loop 在高危工具执行前发 `event: tool-approval` 命名帧,
 *  payload 与 agent 任务流 tool-approval 事件同形(snake_case wire 形态),
 *  本接口为 streamChat 回调消费形态(camelCase)。决策经 postToolApprovalResponse
 *  回传 ai-service 流级审批端点(与 postToolResult 同族,不经网关)。 */
export interface ToolApprovalEvent {
  type: 'tool-approval'
  /** 审批请求唯一 id(决策回传时随响应带回) */
  approvalId: string
  /** 目标工具名(如 run_command / write_file) */
  toolName: string
  /** 工具调用 id */
  toolCallId: string
  /** 参数预览(后端截断 200 字符) */
  argsPreview: string
  /** 危险等级 */
  dangerLevel: 'high' | 'medium' | 'low'
  /** 发起审批的流会话 id(回传端点寻址用) */
  sessionId?: string
  /**
   * D159(2026-09-30 立):逐请求的执行环境事实。三字段都是**可选新增**,不是新帧。
   * 权威字段清单在 `packages/shared/src/sse/contract.ts`
   * (`ToolApprovalExecEnvironmentWire` / `ToolApprovalNetworkTargetWire`),本包不依赖
   * @ihui/shared,所以这里逐字收窄一份同形结构 —— 与本包既有形态(ToolApprovalEvent 本身、
   * FormRequestEvent)同一姿势,不是第二份"真相",而是线格式的投影。
   *
   * `available === false` 与"整字段缺席"是两件事:前者 = 服务端上报了但读不到(弹窗必须
   * 喊"未上报"),后者 = 回退开关 `IHUI_APPROVAL_ENV_REPORT=0` 整块不发(弹窗整块不渲染)。
   * 把两态在本层折叠成一个,就等于把"没判"写成"判过了"。
   */
  execEnvironment?: ToolApprovalExecEnvironment
  /** 本次要连的网络目标(`display` 恒 host:port,不显示归一键/哈希) */
  networkTarget?: ToolApprovalNetworkTarget
  /** 已被静态策略判死的目标清单("还没有规则覆盖它"不算被拦) */
  blockedNetworkTargets?: ToolApprovalNetworkTarget[]
  /**
   * D-07(2026-10-26):断线失效留痕标记。带本字段的事件**不是**新的审批请求 ——
   * 消费方不得弹窗/入待决队列,只给用户一条"该审批已随连接中断失效"的可读提示;
   * 该 approvalId 已无活等待者,回传决策只会被服务端具名拒绝。
   */
  expired?: true
  /** D-07:失效原因(stream_closed / cancelled / timeout),只读展示用 */
  expiredReason?: string
  // 批次 2(2026-11-06):结构化审批决策信息(camelCase 消费形态)。
  // 全部可选:缺席 = 老生产者/描述失败,端上退回 argsPreview;不是"没有风险"。
  reasonCode?: ToolApprovalReasonCode
  riskLevel?: 'low' | 'medium' | 'high'
  argv?: string[] | null
  cwd?: string | null
  affectedPaths?: string[]
  scope?: ToolApprovalOperationScope
  summary?: string
}

/** 批次 2:审批原因码封闭集(与后端 tool_approval_descriptor.REASON_CODES 同集)。 */
export const TOOL_APPROVAL_REASON_CODES = [
  'dangerous_command',
  'destructive_operation',
  'writes_files',
  'deletes_files',
  'executes_command',
  'network_access',
  'database_write',
  'high_risk_tool',
  'requires_confirmation',
] as const

export type ToolApprovalReasonCode = (typeof TOOL_APPROVAL_REASON_CODES)[number]

/** 批次 2:操作作用域封闭集(与后端 OPERATION_SCOPES 同集)。 */
export const TOOL_APPROVAL_OPERATION_SCOPES = [
  'fs_read',
  'fs_write',
  'fs_delete',
  'exec',
  'network',
  'db',
  'other',
] as const

export type ToolApprovalOperationScope = (typeof TOOL_APPROVAL_OPERATION_SCOPES)[number]

/**
 * 批次 2:结构化审批决策信息的投影(两条审批通道共用,与 D159 env 投影同一条纪律)。
 * 封闭集外/型不符的字段一律缺席,不折叠成邻近档 —— 前端据此退回 argsPreview,
 * 而不是把未知原因渲染成已知原因。
 */
export function projectToolApprovalDecisionInfo(json: {
  reason_code?: unknown
  risk_level?: unknown
  argv?: unknown
  cwd?: unknown
  affected_paths?: unknown
  scope?: unknown
  summary?: unknown
}): Pick<
  ToolApprovalEvent,
  'reasonCode' | 'riskLevel' | 'argv' | 'cwd' | 'affectedPaths' | 'scope' | 'summary'
> {
  const out: Pick<
    ToolApprovalEvent,
    'reasonCode' | 'riskLevel' | 'argv' | 'cwd' | 'affectedPaths' | 'scope' | 'summary'
  > = {}
  if (
    typeof json.reason_code === 'string' &&
    (TOOL_APPROVAL_REASON_CODES as readonly string[]).includes(json.reason_code)
  ) {
    out.reasonCode = json.reason_code as ToolApprovalReasonCode
  }
  if (json.risk_level === 'low' || json.risk_level === 'medium' || json.risk_level === 'high') {
    out.riskLevel = json.risk_level
  }
  if (Array.isArray(json.argv) && json.argv.every((item) => typeof item === 'string')) {
    out.argv = json.argv as string[]
  } else if (json.argv === null) {
    out.argv = null
  }
  if (typeof json.cwd === 'string') out.cwd = json.cwd
  else if (json.cwd === null) out.cwd = null
  if (Array.isArray(json.affected_paths)) {
    out.affectedPaths = json.affected_paths.filter(
      (item): item is string => typeof item === 'string',
    )
  }
  if (
    typeof json.scope === 'string' &&
    (TOOL_APPROVAL_OPERATION_SCOPES as readonly string[]).includes(json.scope)
  ) {
    out.scope = json.scope as ToolApprovalOperationScope
  }
  if (typeof json.summary === 'string') out.summary = json.summary
  return out
}

/**
 * D-07(2026-10-26):失效留痕标记的投影(与 D159 的 env 投影同族、同一条纪律)。
 *
 * `expired === true` 才带键 —— "正常审批帧"和"失效留痕帧"在消费形态上必须可区分;
 * 缺省不折叠成 false(消费方按 truthy 判,造默认值会把"没丢"写成"丢了")。
 * 原因只在服务端给了非空 string 时透传,不猜、不补默认档。
 */
export function projectToolApprovalExpiredFact(json: {
  expired?: unknown
  expired_reason?: unknown
}): Pick<ToolApprovalEvent, 'expired' | 'expiredReason'> {
  if (json.expired !== true) return {}
  return {
    expired: true,
    ...(typeof json.expired_reason === 'string' ? { expiredReason: json.expired_reason } : {}),
  }
}

/** D159 执行环境(camelCase 消费形态;内层键与线格式逐字同,故只是投影) */
export interface ToolApprovalExecEnvironment {
  available: boolean
  inSandbox?: boolean
  backend?: string
  networkIsolated?: boolean
  degraded?: boolean
  degradeNote?: string
}

/** D159 网络目标(在位才给"允许该目标"三档) */
export interface ToolApprovalNetworkTarget {
  host: string
  port: number
  protocol: string
  display: string
  reason?: string
}

/**
 * D159:把线格式(snake_case 外层 + camelCase 内层)的三个可选字段投影成消费形态。
 *
 * 判序刻意是"取不到就整块不发",而不是补默认值:
 * - 非对象(畸形/被中间层改成字符串)⇒ undefined ⇒ 弹窗整块不渲染;
 * - `exec_environment` 在位但 `available` 不是布尔 ⇒ 同样不发(宁缺勿造);
 * - `network_target` 缺 host/port ⇒ 不发 ⇒ 三档不落任何规则(不退化成"按工具名放行")。
 * 这份判据只住在一处,两个解析出口(本包 tryParseToolApproval 与
 * @ihui/shared 的 parseToolApprovalEvent)都调它,免得两份各漂一半。
 */
export function projectToolApprovalEnvFacts(json: {
  exec_environment?: unknown
  network_target?: unknown
  blocked_network_targets?: unknown
}): Pick<ToolApprovalEvent, 'execEnvironment' | 'networkTarget' | 'blockedNetworkTargets'> {
  const out: Pick<
    ToolApprovalEvent,
    'execEnvironment' | 'networkTarget' | 'blockedNetworkTargets'
  > = {}
  const env = json.exec_environment
  if (
    env &&
    typeof env === 'object' &&
    typeof (env as Record<string, unknown>).available === 'boolean'
  ) {
    const e = env as Record<string, unknown>
    out.execEnvironment = {
      available: e.available as boolean,
      ...(typeof e.inSandbox === 'boolean' ? { inSandbox: e.inSandbox } : {}),
      ...(typeof e.backend === 'string' ? { backend: e.backend } : {}),
      ...(typeof e.networkIsolated === 'boolean' ? { networkIsolated: e.networkIsolated } : {}),
      ...(typeof e.degraded === 'boolean' ? { degraded: e.degraded } : {}),
      ...(typeof e.degradeNote === 'string' ? { degradeNote: e.degradeNote } : {}),
    }
  }
  const target = asNetworkTarget(json.network_target)
  if (target) out.networkTarget = target
  const blocked = Array.isArray(json.blocked_network_targets)
    ? (json.blocked_network_targets as unknown[])
        .map(asNetworkTarget)
        .filter((t): t is ToolApprovalNetworkTarget => t !== null)
    : []
  if (blocked.length > 0) out.blockedNetworkTargets = blocked
  return out
}

function asNetworkTarget(value: unknown): ToolApprovalNetworkTarget | null {
  if (!value || typeof value !== 'object') return null
  const t = value as Record<string, unknown>
  if (typeof t.host !== 'string' || t.host === '') return null
  if (typeof t.port !== 'number') return null
  return {
    host: t.host,
    port: t.port,
    ...(typeof t.protocol === 'string' ? { protocol: t.protocol } : { protocol: '' }),
    ...(typeof t.display === 'string' && t.display !== ''
      ? { display: t.display }
      : { display: `${t.host}:${t.port}` }),
    ...(typeof t.reason === 'string' ? { reason: t.reason } : {}),
  }
}

/**
 * 阶段 2:工具委托执行事件(2026-08-02 立,浏览器端工具执行代理)。
 *
 * ai-service 在远程服务器无法访问用户本地文件,当 LLM 调用 fs 类工具
 * (read_file/search_codebase/file_edit 等)时,ai-service 通过 SSE
 * `tool-delegate` 事件委托前端执行,前端用 FileSystemDirectoryHandle 读取/写入文件,
 * 通过 postToolResult POST API 回传结果,唤醒 tool loop 中等待的 asyncio.Event。
 *
 * SSE 事件格式:
 *   event: tool-delegate
 *   data: {"session_id":"<uuid>","tool_call_id":"<tc_id>","tool_name":"read_file","args":{"path":"src/index.ts"},"iteration":1,"type":"tool-delegate"}
 */
export interface ToolDelegateEvent {
  session_id: string
  tool_call_id: string
  tool_name: string
  args: Record<string, unknown>
  iteration: number
  type: string
}

/**
 * P4-2: 从 SSE data: 行解析 fallback 事件。
 *
 * 后端 llm_gateway.py astream fallback 分支在 chunk 产出前 yield:
 *   {type:"fallback", primary_model, backup_model, reason}
 * api 端 streamToClient 自动透传为 SSE `data: {...}` 行。
 *
 * 与 parseStreamLine 并列:use-chat.ts 在调 parseStreamLine 之前先调本函数,
 * 命中即触发 onFallback 回调展示"已切换到备用模型"横幅,不再走 parseStreamLine。
 *
 * @returns 解析成功返回 FallbackEvent,非 fallback 事件或解析失败返回 null
 */
export function parseFallbackEvent(line: string): FallbackEvent | null {
  if (!line || line.startsWith(':')) return null
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }
  if (!data || data === '[DONE]') return null
  // Vercel AI SDK 协议 `0:"..."` → 非 fallback 事件
  if (/^\d+:/.test(data)) return null
  if (!data.startsWith('{')) return null
  try {
    const json = JSON.parse(data) as Record<string, unknown>
    if (json?.type === 'fallback' && typeof json?.primary_model === 'string') {
      return {
        primaryModel: json.primary_model,
        backupModel: typeof json.backup_model === 'string' ? json.backup_model : 'unknown',
        reason: typeof json.reason === 'string' ? json.reason : 'unknown',
      }
    }
  } catch {
    /* 非 JSON 或格式不符,返回 null */
  }
  return null
}

export function parseStreamLineReasoning(line: string): string | null {
  if (!line || line.startsWith(':')) return null
  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }
  if (data === '[DONE]') return null
  try {
    const json = JSON.parse(data)
    // G-87 补链(2026-10-29,实测踩过):`hook-failed` 帧自带 `error` 字符串字段,
    // 而下面第一条就是 `json.error && typeof === 'string' ⇒ throw`(OpenAI 错误格式)。
    // 分流必须排在**错误判据之前** —— 否则一个"lint hook 挂了"的帧会被当成本轮回答失败:
    // 抛 SSEError → runner 重连 → 前端气泡变红,而界面文案与真实原因毫无关系。
    // (实测症状:带 error 的 hook-failed 帧 100% 触发重连,去掉该字段就正常。)
    if (json?.type === 'hook-failed') return null
    if (json?.type === 'error' && typeof json?.message === 'string') {
      const e = new Error(json.message)
      e.name = 'SSEError'
      // 2026-11-04(sse-event-parity):契约 error 声明 errorCode;读取并挂到错误对象
      if (typeof json.errorCode === 'string') {
        ;(e as Error & { errorCode?: string }).errorCode = json.errorCode
      }
      throw e
    }
    if (json?.error === true && typeof json?.error_message === 'string') {
      const e = new Error(json.error_message)
      e.name = 'SSEError'
      throw e
    }
    if (json?.type === 'reasoning' && typeof json?.content === 'string') return json.content
    const choice = json?.choices?.[0]
    const reasoning =
      choice?.delta?.reasoning_content ?? choice?.message?.reasoning_content ?? json?.reasoning
    return typeof reasoning === 'string' ? reasoning : null
  } catch (e) {
    if (e instanceof SyntaxError) return null
    throw e
  }
}

/**
 * 厂商账号额度耗尽(2026-09-22 批次 60 立,与 ai-service `llm_gateway.PROVIDER_QUOTA_EXHAUSTED` 同名)。
 * 仅在"判定为账号额度/欠费且全部候选通道都失败"时出现;ai-service 未登记该码的 HTTP 状态,
 * 实际仍是默认 502,因此**只能靠 errorCode 判定,不能靠 HTTP 码**。
 */
export const PROVIDER_QUOTA_EXHAUSTED = 'PROVIDER_QUOTA_EXHAUSTED' as const

/** 同族等效替换的 fallback 事件 reason(与 ai-service `FALLBACK_REASON_QUOTA_EQUIVALENT` 对齐)。 */
export const FALLBACK_REASON_QUOTA_EQUIVALENT = 'quota_equivalent' as const

/**
 * 非 i18n 端(extension / mobile-rn / cli / miniapp-taro)的兜底文案。
 * web 端不使用此处常量,而走 i18n key `chat.quotaExhaustedTitle` / `chat.quotaExhaustedNotice`,
 * 避免在共享层维护第二套错误表 —— 共享层只负责"分类 + 默认可读文案"。
 */
const QUOTA_EXHAUSTED_ZH = {
  title: '厂商账号额度已用尽',
  message:
    '该模型所属厂商的账号额度已用完(不是你的账户问题),平台已自动尝试改道其他通道仍未成功。请稍后再试,或改选带「免费」标识的模型。',
}

/**
 * 错误码元信息 — 从 Error 对象 / 错误 JSON / 状态码中提取的结构化字段。
 *
 * 跨端使用:`web` / `mobile-rn` / `desktop` / `extension` / `CLI` / `miniapp-taro`
 * 都通过 `getSSEErrorInfo` 统一提取,再用 `formatSSEError` 渲染为用户可见文本。
 */
export interface SSEErrorInfo {
  code?: number
  errorCode?: string
  retryAfter?: number
  /** 可恢复标记:true 表示网络错误但已耗尽自动重连次数,前端可显示"网络不稳定,可手动重试" */
  recoverable?: boolean
  /**
   * G-916415 R1(2026-10-07 立):帧级 trace 关联键进错误上报体。
   * 失败前**本轮 attempt** 的流内任一帧带过合法 traceId(readStreamTraceId 判过)⇒
   * 该值随 onError 的 info 透出,端上错误上报据此把客户端这一轮与 ai-service 日志
   * 的 trace 串起来(票面"四段串一"的第四段)。只在真见过时携带 —— 缺席 = 无键,
   * 不得写 `traceId: undefined` 污染上报体;per-attempt 复位见 streamChat 的
   * onAttemptStart(seenTraceId = null),上一轮的 trace 不记到这一轮头上。
   * **本接口的字段集就是上报体允许携带的字段白名单**(防把原始 Error 的
   * stack/用户路径等敏感面整包带出去),镜像锁见 tests/stream-error-report-trace-id.test.ts。
   */
  traceId?: string
}

/**
 * 错误严重等级 — 用于决定不同 UI 交互:
 * - `auth`     → 跳登录弹窗
 * - `forbidden`→ Toast 提示权限不足
 * - `ratelimit`→ Toast 提示稍后重试(可能附带 retryAfter)
 * - `safety`   → Toast 提示内容被 AI 厂商安全策略拦截(非项目违规判定)
 * - `server`   → Toast 提示服务异常,可重试
 * - `network`  → Toast 提示网络问题
 * - `unknown`  → 兜底 Toast
 */
export type SSEErrorSeverity =
  'auth' | 'forbidden' | 'ratelimit' | 'safety' | 'server' | 'network' | 'unknown'

export interface FormattedSSEError {
  code?: number
  errorCode?: string
  retryAfter?: number
  severity: SSEErrorSeverity
  title: string
  message: string
  rawMessage: string
  requireReauth: boolean
  /**
   * 重试是否可能改变结果。`false` = 重试必然再撞同一堵墙(如厂商账号额度耗尽),
   * 各端据此隐藏"立即重试"按钮 / 跳过自动退避重试。`undefined` 按可重试处理(向后兼容)。
   */
  retryable?: boolean
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v
  return undefined
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

/**
 * 从错误对象 / 字符串 / 任意异常中提取 SSE 错误元信息。
 *
 * 兼容多种数据源:
 * 1. `Error` 对象挂载的 `code` / `errorCode` / `retryAfter` 字段(由各端 SSE 解析器填充)
 * 2. 错误消息文本中的"请求失败(401)"格式回退
 * 3. 字符串中嵌入的 `code=XXX` / `errorCode=XXX` 模式
 */
export function getSSEErrorInfo(err: unknown): SSEErrorInfo | undefined {
  if (!err) return undefined
  const out: SSEErrorInfo = {}
  const sources: unknown[] = []
  if (err instanceof Error) {
    sources.push(err)
    if (err.message) sources.push(err.message)
    const anyErr = err as Error & Record<string, unknown>
    if (anyErr.code !== undefined) sources.push({ code: anyErr.code })
    if (anyErr.statusCode !== undefined) sources.push({ statusCode: anyErr.statusCode })
    if (anyErr.errorCode !== undefined) sources.push({ errorCode: anyErr.errorCode })
    if (anyErr.retryAfter !== undefined) sources.push({ retryAfter: anyErr.retryAfter })
  } else if (typeof err === 'string') {
    sources.push(err)
  } else {
    sources.push(err)
  }

  for (const src of sources) {
    if (typeof src === 'string') {
      const m = src.match(/[（(](\d{3})[)）]/)
      if (m && out.code === undefined) {
        const n = Number(m[1])
        if (Number.isFinite(n)) out.code = n
      }
      const codeMatch = src.match(/code=([0-9]{3})/)
      if (codeMatch && out.code === undefined) {
        const n = Number(codeMatch[1])
        if (Number.isFinite(n)) out.code = n
      }
      const errCodeMatch = src.match(/errorCode=([A-Z0-9_]+)/)
      if (errCodeMatch && out.errorCode === undefined) {
        out.errorCode = errCodeMatch[1]
      }
      continue
    }
    if (typeof src !== 'object' || src === null) continue
    const obj = src as Record<string, unknown>
    if (out.code === undefined) {
      const c = asNumber(obj.code) ?? asNumber(obj.statusCode) ?? asNumber(obj.status)
      if (c !== undefined) out.code = c
    }
    if (out.errorCode === undefined) {
      const ec = asString(obj.errorCode) ?? asString(obj.error_code)
      if (ec) out.errorCode = ec
    }
    if (out.retryAfter === undefined) {
      const r = asNumber(obj.retryAfter) ?? asNumber(obj.retry_after)
      if (r !== undefined) out.retryAfter = r
    }
  }

  if (out.code === undefined && out.errorCode === undefined && out.retryAfter === undefined) {
    return undefined
  }
  return out
}

/**
 * 把任意异常/错误消息规范化为用户可见的格式化错误。
 *
 * 用法:
 * ```ts
 * try {
 *   await streamChat(...)
 * } catch (err) {
 *   const f = formatSSEError(err)
 *   if (f.severity === 'auth') openLoginDialog()
 *   toast.error(f.title, { description: f.message })
 * }
 * ```
 */
export function formatSSEError(
  err: unknown,
  fallbackMessageOrInfo: string | SSEErrorInfo = 'AI 服务异常',
): FormattedSSEError {
  // P3-4: 第二参数兼容两种形态 — 字符串(fallbackMessage,旧调用方)或 SSEErrorInfo(onError 透传 info)
  // onError 回调只拿到 errMsg 字符串 + info 对象,字符串本身不带 retryAfter,需通过 info 注入
  let fallbackMessage = 'AI 服务异常'
  let extraInfo: SSEErrorInfo | undefined
  if (typeof fallbackMessageOrInfo === 'string') {
    fallbackMessage = fallbackMessageOrInfo
  } else {
    extraInfo = fallbackMessageOrInfo
  }

  let rawMessage: string
  if (err instanceof Error) {
    rawMessage = err.message || fallbackMessage
  } else if (typeof err === 'string' && err.length > 0) {
    rawMessage = err
  } else if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    rawMessage = typeof m === 'string' && m.length > 0 ? m : fallbackMessage
  } else {
    rawMessage = fallbackMessage
  }

  // P3-4: extraInfo(onError 路径透传)优先于 getSSEErrorInfo(err)(catch 路径从 Error 对象提取)
  // onError 路径 err 是纯字符串,不含 retryAfter,必须靠 extraInfo 补全
  const extractedInfo = getSSEErrorInfo(err)
  const code = extraInfo?.code ?? extractedInfo?.code
  const errorCode = extraInfo?.errorCode ?? extractedInfo?.errorCode
  const retryAfter = extraInfo?.retryAfter ?? extractedInfo?.retryAfter

  // 厂商账号额度耗尽:必须在 detectSafetyViolation / HTTP 状态码分支之前判定。
  // ai-service 的 status_map 未登记该码,实际仍回落默认 502 → 若先走 code>=500 分支会被误判成
  // "AI 服务暂时不可用,请稍后重试",而重试必然再撞同一堵墙(所有候选通道都已因欠费失败)。
  // rawMessage 保留后端点名归因("所有通道均因账号额度耗尽失败: qwen-plus[qwen]=..."),
  // 各端 toast 继续以 [PROVIDER_QUOTA_EXHAUSTED] 前缀透出以便排障。
  if (errorCode === PROVIDER_QUOTA_EXHAUSTED) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'server',
      title: QUOTA_EXHAUSTED_ZH.title,
      message: QUOTA_EXHAUSTED_ZH.message,
      rawMessage,
      requireReauth: false,
      retryable: false,
    }
  }

  // 优先识别 LLM 厂商内容安全策略拦截关键词
  // 这些错误来自上游 LLM(Gemini/OpenAI/Anthropic),不是项目本身的违规判定
  // 识别后给出清晰提示,避免用户误以为是项目违规判定导致对话被自动结束
  const safetyHit = detectSafetyViolation(rawMessage, errorCode)
  if (safetyHit) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'safety',
      title: '内容被 AI 厂商安全策略拦截',
      message: safetyHit,
      rawMessage,
      requireReauth: false,
    }
  }

  // 登录 / 换验证码端点的 401 独立出口(G-1121553):验证码错 / 过期同样回 401,不得复用
  // 下面的通用会话过期出口 —— 真机误导实录与判据见 isVerificationCodeFailure 注释。
  // severity 刻意不取 'auth'(那是"会话死亡,该弹重新登录"的档,消费方按它开登录框:
  // 在登录页上弹登录框是二重误导),requireReauth 同理为 false —— 重登救不了打错的码。
  if (code === 401 && isVerificationCodeFailure(errorCode, rawMessage)) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'unknown',
      title: '验证码错误',
      message: '验证码错误或已过期,请重新获取验证码',
      rawMessage,
      requireReauth: false,
    }
  }
  // 2FA step-up 拒绝(2026-10-29):与验证码那一型同理 —— 它不是"会话死亡",
  // 消费方若按 severity='auth' 开登录框,2FA 用户每次提现都会被要求重新登录。
  // requireReauth 同为 false:重登救不了"这一次操作缺一次窗内二次验证"。
  if (code === 401 && isStepUpRejection(errorCode)) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'unknown',
      title: '需要二次验证',
      message: rawMessage,
      rawMessage,
      requireReauth: false,
    }
  }
  if (code === 401) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'auth',
      title: '登录已过期',
      message: '登录已过期,请重新登录',
      rawMessage,
      requireReauth: true,
    }
  }
  if (code === 403) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'forbidden',
      title: '访问被拒绝',
      message: '当前账户没有使用该 AI 模型的权限',
      rawMessage,
      requireReauth: false,
    }
  }
  if (code === 429) {
    const waitHint = retryAfter ? `${retryAfter} 秒后重试` : '请稍候再试'
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'ratelimit',
      title: '请求过于频繁',
      message: `AI 服务请求频率超限,${waitHint}`,
      rawMessage,
      requireReauth: false,
    }
  }
  if (code !== undefined && code >= 500) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'server',
      title: 'AI 服务异常',
      message: 'AI 服务暂时不可用,请稍后重试',
      rawMessage,
      requireReauth: false,
    }
  }
  if (code !== undefined && code >= 400) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'server',
      title: '请求失败',
      message: rawMessage,
      rawMessage,
      requireReauth: false,
    }
  }
  if (isAbortError(err)) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'network',
      title: '请求已取消',
      message: '请求已取消',
      rawMessage,
      requireReauth: false,
    }
  }
  // P3-4: 非 4xx/5xx 但带 retryAfter(如 SSE error {code:"RATE_LIMIT", retryAfter:N} 或
  // {type:"error", message:"...", retryAfter:N} 无 code 字段)→ 视为限流,追加倒计时到 message,
  // severity = ratelimit(触发 warning toast,非致命,与 429 一致不加 retry 按钮)
  // 429 已在上方分支处理(含 "N 秒后重试"),此处不重复,仅覆盖 code 缺失的限流场景
  if (retryAfter !== undefined && retryAfter >= 1) {
    return {
      code,
      errorCode,
      retryAfter,
      severity: 'ratelimit',
      title: '请求过于频繁',
      message: `${rawMessage}(${retryAfter} 秒后重试)`,
      rawMessage,
      requireReauth: false,
    }
  }
  const isNetwork = /network|fetch|timeout|abort|failed to fetch|err_network/i.test(rawMessage)
  return {
    code,
    errorCode,
    retryAfter,
    severity: isNetwork ? 'network' : 'unknown',
    title: isNetwork ? '网络异常' : 'AI 服务异常',
    message: isNetwork ? '网络连接失败,请检查网络后重试' : rawMessage,
    rawMessage,
    requireReauth: false,
  }
}

/**
 * 识别 LLM 厂商内容安全策略拦截关键词。
 *
 * 主流 LLM 厂商在内容被判定违规时会返回特定错误码/消息:
 * - OpenAI:    `content_policy_violation` / `content_policy` / 400 + "Your request was rejected as a result of our safety system"
 * - Anthropic: `output_length_stop` + "content filter" / 400 + "content that is unsafe"
 * - Gemini:    `SAFETY` / `RECITATION` / `BLOCKLIST` finishReason
 * - 通用:      "safety" / "policy" / "filtered" / "blocked" / "审查" / "违规"
 *
 * 命中返回清晰提示文案,未命中返回 null。
 * 该识别只针对上游 LLM 厂商的安全策略拦截,不是项目本身的违规判定。
 */
function detectSafetyViolation(message: string, errorCode?: string): string | null {
  const text = message.toLowerCase()
  const ec = (errorCode ?? '').toLowerCase()

  // Gemini finishReason
  if (/finishreason\s*=\s*safety/i.test(message)) {
    return '内容被 Gemini 安全策略拦截(SAFETY),请调整提问方式后重试'
  }
  if (/finishreason\s*=\s*recitation/i.test(message)) {
    return '内容被 Gemini 引用安全策略拦截(RECITATION),请减少大段引用后重试'
  }
  // OpenAI content_policy_violation
  if (ec === 'content_policy_violation' || text.includes('content_policy_violation')) {
    return '内容被 OpenAI 内容策略拦截,请调整提问方式后重试'
  }
  // Anthropic safety
  if (ec === 'safety_block' || (text.includes('"type":"error"') && text.includes('"safety"'))) {
    return '内容被 Anthropic 安全策略拦截,请调整提问方式后重试'
  }
  // 通用关键词兜底(需组合出现,避免误判普通错误)
  const safetyKeywords = [
    'safety',
    'content policy',
    'content filter',
    'safety system',
    'safety filter',
  ]
  const blockedKeywords = ['blocked', 'rejected', 'filtered']
  for (const sk of safetyKeywords) {
    if (text.includes(sk)) {
      for (const bk of blockedKeywords) {
        if (text.includes(bk)) {
          return '内容被 AI 厂商安全策略拦截,请调整提问方式后重试'
        }
      }
    }
  }
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
