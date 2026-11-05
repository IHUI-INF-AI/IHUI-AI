// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OpenAI 兼容流式工具调用解析（逆向-复现-超越，AGENTS §0.12）
 *
 * 对标：Qoder / Trae 把 `jsonrepair` 用在工具调用 `arguments` 上——但 `jsonrepair` 只能吃
 *       **完整字符串**，无法在分片到达过程中渐进渲染。OpenAI 流式协议把 `arguments` 拆成
 *       `choices[].delta.tool_calls[].function.arguments` 的**字符串分片**逐片下发，
 *       每一片都可能是被截断的残缺 JSON。
 * 复现：本模块解析 OpenAI 流式行（`data: {...}` 或裸 JSON，含 `[DONE]` 终结），抽出逐片
 *       `function.arguments` 片段。
 * 超越：`OpenAiToolCallAccumulator` 按 call `index` 维护一个 `ToolCallArgsStreamer`（来自
 *       `./tool-call-args.js`，其能力源自 `./json-repair.js` 的流式感知修复），每片到达即
 *       给出当前最好部分 args（partial）+ 闭合即 complete——ToolCallCard 在流未结束就能渐进
 *       渲染入参；且即使某片残缺（截断/裸键/单引号）也能被修复后解析，不会把卡片打崩。
 *
 * 红线：自研；不粘贴对照程序专有源码；不引入第三方 jsonrepair 包。
 */

import {
  createToolCallArgsStreamer,
  type ToolCallArgsStreamer,
} from './tool-call-args.js'

/** 单条 OpenAI 流式 tool_call 增量片段（已抽出可消费的字段）。 */
export interface OpenAiToolCallFragment {
  /** tool_calls 数组下标（OpenAI 用它关联同一次调用的多片） */
  index: number
  /** 首次出现时随带的工具调用 id */
  id?: string
  /** 首次出现时随带的函数名（OpenAI 把 name 拆在 index 那一片，后续片 name 为空） */
  name?: string
  /** 本片携带的 `function.arguments` 字符串片段（可能为空串、可能残缺） */
  argsFragment: string
}

/** 累积器对每个 call index 当前产出的态。 */
export interface OpenAiToolCallDelta {
  index: number
  id?: string
  name?: string
  /** 当前可用 args（complete 或 partial 时存在；残缺且无部分值则为 undefined） */
  args: Record<string, unknown> | undefined
  /** 原始分片已能解析为完整 JSON 对象（无需修复即通过） */
  argsComplete: boolean
  /** 流未闭合但已尽力抽到可用部分对象 */
  argsPartial: boolean
}

/** 一条 OpenAI 流式行解析出的帧。 */
export interface OpenAiStreamFrame {
  /** 正文增量（OpenAI 把文本放在 `choices[].delta.content`） */
  content?: string
  /** 工具调用增量片段（可能为空数组，仅当本片带 tool_calls 时存在） */
  toolCalls?: OpenAiToolCallFragment[]
  /** 终止原因（出现 `finish_reason` 字段时；`null` 表示显式 null） */
  finishReason?: string | null
  /** 原始解析对象（调试/透传用，未做形态约束） */
  raw?: unknown
}

/** OpenAI chat completion 流式块的最小形态（仅声明本模块会读取的字段）。 */
interface RawOpenAiChunk {
  choices?: Array<{
    delta?: {
      content?: unknown
      tool_calls?: Array<{
        index?: unknown
        id?: unknown
        function?: { name?: unknown; arguments?: unknown }
      }>
    }
    finish_reason?: unknown
  }>
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function asOptString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asIndex(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
}

/**
 * 解析一行 OpenAI 风格 SSE（`data: {...}` 或裸 JSON；`[DONE]` 返回 null）。
 * 只抽取本模块关心的 `content` / `tool_calls` / `finish_reason`；其它字段经 `raw` 透出。
 * 行不是合法 JSON / 不是 chat completion 形态时返回 null（不抛）。
 */
export function parseOpenAiStreamLine(line: string): OpenAiStreamFrame | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  let payload = trimmed
  if (payload.startsWith('data:')) {
    payload = payload.slice(5).trim()
  }
  if (payload === '[DONE]') return null
  let obj: unknown
  try {
    obj = JSON.parse(payload)
  } catch {
    return null
  }
  const chunk = obj as RawOpenAiChunk
  const choices = chunk?.choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const choice = choices[0]
  if (typeof choice !== 'object' || choice === null) return null

  const frame: OpenAiStreamFrame = { raw: obj }
  const delta = choice.delta ?? {}

  const content = asString(delta.content)
  if (content) frame.content = content

  const tcs = delta.tool_calls
  if (Array.isArray(tcs)) {
    const out: OpenAiToolCallFragment[] = []
    for (const tc of tcs) {
      if (typeof tc !== 'object' || tc === null) continue
      const fn = tc.function
      out.push({
        index: asIndex(tc.index),
        id: asOptString(tc.id),
        name: fn ? asOptString(fn.name) : undefined,
        argsFragment: fn ? (typeof fn.arguments === 'string' ? fn.arguments : '') : '',
      })
    }
    if (out.length > 0) frame.toolCalls = out
  }

  if ('finish_reason' in choice) {
    const fr = choice.finish_reason
    frame.finishReason = fr === null ? null : asOptString(fr) ?? String(fr)
  }

  return frame
}

/**
 * 按 OpenAI `tool_calls[].index` 累积多片 `function.arguments`，逐片产出当前最好可用 args。
 * 内部每个 call index 持有一个 `ToolCallArgsStreamer`（流式感知修复 + 增量解析），
 * 因此：① 分片到达即可渐进渲染；② 某片残缺也能被修复后解析，不会打崩卡片。
 * 流结束（`finishReason` 到达或 `[DONE]`）调用 `finish()` 锁定，并用 `snapshot()` 再发一次
 * 终态，确保消费端一定收到 `argsComplete=true`。
 */
export class OpenAiToolCallAccumulator {
  private readonly entries = new Map<
    number,
    { id?: string; name?: string; streamer: ToolCallArgsStreamer }
  >()
  private finished = false

  /** 喂入一帧解析出的 tool_calls 增量，返回每个 call index 的当前累积态。 */
  pushToolCalls(fragments: OpenAiToolCallFragment[]): OpenAiToolCallDelta[] {
    const out: OpenAiToolCallDelta[] = []
    for (const f of fragments) {
      let entry = this.entries.get(f.index)
      if (!entry) {
        entry = { id: f.id, name: f.name, streamer: createToolCallArgsStreamer() }
        this.entries.set(f.index, entry)
      }
      if (f.id !== undefined) entry.id = f.id
      if (f.name !== undefined) entry.name = f.name
      const st = entry.streamer.push(f.argsFragment)
      out.push({
        index: f.index,
        id: entry.id,
        name: entry.name,
        args: st.args,
        argsComplete: st.complete,
        argsPartial: st.partial,
      })
    }
    return out
  }

  /** 流结束：锁定每个 call 的最终态（之后不再变化）。 */
  finish(): void {
    this.finished = true
  }

  /** 终态快照：把每个 call 的当前态再发一次，确保消费端收到 `complete`。 */
  snapshot(): OpenAiToolCallDelta[] {
    const out: OpenAiToolCallDelta[] = []
    for (const [index, entry] of this.entries) {
      const st = entry.streamer.push('') // 不喂新数据，只取当前态
      out.push({
        index,
        id: entry.id,
        name: entry.name,
        args: st.args,
        argsComplete: st.complete,
        argsPartial: st.partial,
      })
    }
    return out
  }

  /** 流是否已结束（之后喂入的片段不会改变「已完成」这一事实）。 */
  get isFinished(): boolean {
    return this.finished
  }

  /** 重置（重连/新会话复用同一实例时调用）。 */
  reset(): void {
    this.entries.clear()
    this.finished = false
  }
}

/** 工厂：创建一个 OpenAI 工具调用累积器。 */
export function createOpenAiToolCallAccumulator(): OpenAiToolCallAccumulator {
  return new OpenAiToolCallAccumulator()
}

/**
 * ai-service 逐分片直推帧的事件名。
 * 与 apps/ai-service/app/core/sse_contract.py、packages/shared/src/sse/contract.ts
 * 的 SSE_EVENTS 同一字面值(由 scripts/check-agent-event-parity.mjs 看护)。
 */
export const TOOL_CALL_ARGS_DELTA_EVENT = 'tool-call-args-delta'

/**
 * 解析 ai-service 自定义 SSE 帧 `tool-call-args-delta`,归一到 `OpenAiToolCallDelta`。
 *
 * 两条来源(OpenAI 原生 `choices[].delta.tool_calls` 行 / 本仓 ai-service 逐分片帧)
 * 形状不同但消费态相同 —— 前端只需订阅一份 `onOpenAiToolCall` 就能同时接住,
 * 不必为后端通道再写第二套 handler(§0.6 单一真相源)。
 *
 * 入参可以是 `data: {...}` 行或裸 JSON;`event: xxx` 行/非本帧/非法 JSON 一律返回
 * null(不抛、不吞正文)。载荷不含 content/delta/text,故 parseStreamLine 不会把它
 * 当文本二次累加。
 */
export function parseToolCallArgsDeltaFrame(line: string): OpenAiToolCallDelta | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  let payload = trimmed
  if (payload.startsWith('data:')) payload = payload.slice(5).trim()
  let obj: unknown
  try {
    obj = JSON.parse(payload)
  } catch {
    return null
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null
  const frame = obj as Record<string, unknown>
  if (frame.type !== TOOL_CALL_ARGS_DELTA_EVENT) return null

  const rawIndex = frame.index
  const index =
    typeof rawIndex === 'number' && Number.isFinite(rawIndex) && rawIndex >= 0
      ? Math.floor(rawIndex)
      : 0
  const rawArgs = frame.args
  const args =
    typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : undefined

  return {
    index,
    id: typeof frame.id === 'string' && frame.id.length > 0 ? frame.id : undefined,
    name: typeof frame.name === 'string' && frame.name.length > 0 ? frame.name : undefined,
    args,
    argsComplete: frame.argsComplete === true,
    argsPartial: frame.argsPartial === true,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
