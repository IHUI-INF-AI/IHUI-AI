// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 逐轮轨迹统计(2026-11-13 立)
 *
 * 补的是 `AgentTraceViewer` 之外的另一个视角:那边看**一次回答内部**的 Agent 迭代,
 * 这边看**整个会话每一轮**的资源账 —— 每轮用了哪个模型、花了多久、多少 token、
 * 调了几次工具、成没成。两者不重叠也不互相替代。
 *
 * 纯函数,不依赖 React / 端能力:输入是"消息数组",输出是行 + 合计。
 * 归组优先级:
 *  1) 消息自带 `turnOrdinal`(历史水合行)—— 直接用它,序号稳定、可与深链对齐;
 *  2) 缺省时按 **user 消息开新轮** 的顺序推导(live 本地行常见形态)。
 * 两条路径都保证"轮序号严格递增",不因缺失字段把两轮并成一轮。
 */

export interface TurnTraceMessageLike {
  role: string
  content?: unknown
  model?: string
  error?: boolean
  errorCode?: string
  reasoning?: string
  durationMs?: number
  totalDurationMs?: number
  toolCallCount?: number
  toolCalls?: readonly unknown[]
  meta?: Record<string, unknown>
  createdAt?: number
  turnOrdinal?: number | null
}

export interface TurnTraceUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface TurnTraceRow {
  /** 轮序号(从 1 起,严格递增) */
  ordinal: number
  /** 该轮用户提问摘要;无用户消息时为空串 */
  label: string
  model: string | null
  durationMs: number
  usage: TurnTraceUsage
  toolCalls: number
  reasoningChars: number
  status: 'ok' | 'error'
}

export interface TurnTraceSummary {
  rows: TurnTraceRow[]
  totals: {
    turns: number
    durationMs: number
    usage: TurnTraceUsage
    toolCalls: number
  }
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * 读一条消息的 token 用量。
 *
 * 两种历史形态都要兼容:`meta.usage`(live SSE 聚合)与
 * `metadata.usage`(服务端落库回放)。字段名缺失时按 0 计 —— 宁可显示 0,
 * 也不要用字符数"估算"出一个看起来精确的假数。
 */
export function readTurnUsage(meta: Record<string, unknown> | undefined): TurnTraceUsage {
  const raw = (meta?.['usage'] ?? meta?.['usageDetail']) as Record<string, unknown> | undefined
  if (!raw || typeof raw !== 'object')
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  const promptTokens = toNumber(raw['promptTokens'] ?? raw['prompt_tokens'])
  const completionTokens = toNumber(raw['completionTokens'] ?? raw['completion_tokens'])
  const totalTokens =
    toNumber(raw['totalTokens'] ?? raw['total_tokens']) || promptTokens + completionTokens
  return { promptTokens, completionTokens, totalTokens }
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function summarize(text: string, max = 48): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

function emptyRow(ordinal: number): TurnTraceRow {
  return {
    ordinal,
    label: '',
    model: null,
    durationMs: 0,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    toolCalls: 0,
    reasoningChars: 0,
    status: 'ok',
  }
}

export function buildTurnTraceRows(messages: readonly TurnTraceMessageLike[]): TurnTraceSummary {
  const rows: TurnTraceRow[] = []
  let current: TurnTraceRow | null = null
  /** 当前轮实际生效的显式序号(null = 该轮靠 user 消息推导) */
  let lastExplicit: number | null = null

  for (const message of messages) {
    if (!message || typeof message.role !== 'string') continue
    // system / tool 等非对话行不参与分轮:它们既不是"一问"也不是"一答"的开头
    if (message.role !== 'user' && message.role !== 'assistant') continue
    const explicit = typeof message.turnOrdinal === 'number' ? message.turnOrdinal : null

    // 开新一轮的判据:
    //  - user 消息永远开启新一轮(它天然是"这一问"的起点);
    //  - assistant/system 只有在显式序号发生变化时才另起一轮。
    // 这样即使历史里 user 行缺 turnOrdinal、assistant 行有,也不会把两轮并进一行。
    const startsNew =
      current === null ||
      message.role === 'user' ||
      (explicit !== null && lastExplicit !== null && explicit !== lastExplicit)

    if (startsNew) {
      current = emptyRow(explicit !== null && explicit > 0 ? explicit : rows.length + 1)
      rows.push(current)
      lastExplicit = explicit !== null && explicit > 0 ? explicit : null
    } else if (explicit !== null && explicit > 0 && lastExplicit === null) {
      // 本轮由 user 行开启、当时没有显式序号;assistant 行补齐时采纳之,而不是另起一行
      current!.ordinal = explicit
      lastExplicit = explicit
    }

    if (message.role === 'user') {
      if (!current!.label) current!.label = summarize(textOf(message.content))
      continue
    }
    if (message.role !== 'assistant') continue

    const usage = readTurnUsage(message.meta)
    current!.usage = {
      promptTokens: current!.usage.promptTokens + usage.promptTokens,
      completionTokens: current!.usage.completionTokens + usage.completionTokens,
      totalTokens: current!.usage.totalTokens + usage.totalTokens,
    }
    current!.durationMs += toNumber(message.durationMs ?? message.totalDurationMs)
    const tools = toNumber(message.toolCallCount) || (message.toolCalls?.length ?? 0)
    current!.toolCalls += tools
    current!.reasoningChars += textOf(message.reasoning).length
    if (message.model) current!.model = message.model
    if (message.error || message.errorCode) current!.status = 'error'
  }

  // 轮序号兜底重排:显式序号有空洞/重复时仍保证严格递增,便于"第 N 轮"读数
  rows.forEach((row, index) => {
    if (!Number.isFinite(row.ordinal) || row.ordinal < 1) row.ordinal = index + 1
  })

  const totals = rows.reduce(
    (acc, row) => ({
      turns: acc.turns + 1,
      durationMs: acc.durationMs + row.durationMs,
      usage: {
        promptTokens: acc.usage.promptTokens + row.usage.promptTokens,
        completionTokens: acc.usage.completionTokens + row.usage.completionTokens,
        totalTokens: acc.usage.totalTokens + row.usage.totalTokens,
      },
      toolCalls: acc.toolCalls + row.toolCalls,
    }),
    {
      turns: 0,
      durationMs: 0,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      toolCalls: 0,
    },
  )

  return { rows, totals }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
