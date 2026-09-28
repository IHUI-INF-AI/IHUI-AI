// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 对话转录的投影(纯函数层)。
 *
 * 这一层是**视图模型**,不是状态源:它的唯一输入是 `src/server/agent-core.js` 已经在发的
 * `AgentEvent` 流,以及 `src/commands/session.js` 已经存好的历史。
 * 换句话说:agent 说了什么、调了哪个工具、成功与否、用了多少 token —— 真相都在
 * AgentCore / runToolLoop / session 那一侧,本层只做"把它折成可渲染的行",
 * 不得在这里再存一份 history、也不得在这里自己数步骤或算百分比
 * (那由共享层 `deriveTaskStatusBar` 负责,见 task-status-line.ts 头注)。
 *
 * 不可变约定:所有 fold 返回新数组。流式渲染每 token 调一次,若就地改数组,
 * 一次异常重绘就会把已渲染内容重复一遍(那种 bug 在屏幕上表现为"同一段话出现两次",
 * 而单元测试只有在不改入参的契约下才抓得住它)。
 */

import type { AgentEvent } from '../../server/agent-core.js'
import type { FrameLine, Segment, Tone } from './geometry.js'

/** 工具调用在转录里的三种终态。 */
export type ToolState = 'running' | 'ok' | 'fail'

export type TranscriptBlock =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string; closed: boolean }
  | {
      kind: 'tool'
      name: string
      /** args 的单行摘要(过长截断,原文不在这里存着 —— 要看全量走 /tool 回看) */
      argsSummary: string
      state: ToolState
      /** 结果首行摘要(verbose 档才展开多行) */
      resultSummary: string
      /** tool_delta 预览帧(D113 流中 diff),整帧替换语义 */
      preview: string
    }
  | { kind: 'notice'; tone: Tone; text: string }
  | { kind: 'turn'; iterations: number; maxIterations: number; stopReason: string; usageText: string }

export interface Transcript {
  blocks: TranscriptBlock[]
  /** 当前迭代轮次(来自 iteration 事件,不是端内自算) */
  iteration: number
  maxIterations: number
  /** 运行中:最后一条 assistant 未闭合 */
  streaming: boolean
}

export function createTranscript(): Transcript {
  return { blocks: [], iteration: 0, maxIterations: 0, streaming: false }
}

const ARGS_KEEP = 160
const PREVIEW_KEEP = 4_000

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

function firstLine(text: string): string {
  const i = text.indexOf('\n')
  return clip(i === -1 ? text : text.slice(0, i), ARGS_KEEP)
}

/**
 * 非字符串实参的摘要。JSON.stringify 对循环引用 / BigInt 会**抛**,
 * 而这里在事件回调路径上 —— 抛了就等于把一整轮 agent 打断在渲染上,
 * 所以取不到就退化成 String(),绝不让"看参数"这件事把画面弄挂。
 */
function stringifyArgs(v: unknown): string {
  try {
    const s = JSON.stringify(v)
    return s === undefined ? String(v) : s
  } catch {
    return String(v)
  }
}

/** 把已存会话历史折成转录(只读投影,不改 session 对象)。 */
export function seedFromHistory(
  tr: Transcript,
  history: readonly { role: string; content: string }[],
): Transcript {
  const blocks: TranscriptBlock[] = [...tr.blocks]
  for (const m of history) {
    if (m.role === 'user') blocks.push({ kind: 'user', text: m.content })
    else if (m.role === 'assistant') blocks.push({ kind: 'assistant', text: m.content, closed: true })
  }
  return { ...tr, blocks }
}

type AssistantBlock = Extract<TranscriptBlock, { kind: 'assistant' }>
type ToolBlock = Extract<TranscriptBlock, { kind: 'tool' }>

/**
 * 尾部最近一条 assistant(允许中间夹 tool / notice —— 工具行本来就插在正文里)。
 * 命中不到就返回 null,由调用方**新开一条** assistant,而不是把 token 追加进别的块。
 */
function tailAssistant(blocks: readonly TranscriptBlock[]): { index: number; block: AssistantBlock } | null {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    if (!b) continue
    if (b.kind === 'assistant') return { index: i, block: b }
    if (b.kind !== 'tool' && b.kind !== 'notice') break
  }
  return null
}

/** 反向找第一个满足条件的 tool 块(条件同时完成类型收窄,不用 as 骗过编译器)。 */
function findToolBack(
  blocks: readonly TranscriptBlock[],
  pred: (b: ToolBlock) => boolean,
): { index: number; block: ToolBlock } | null {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]
    if (b && b.kind === 'tool' && pred(b)) return { index: i, block: b }
  }
  return null
}

function replaceAt<T>(arr: readonly T[], idx: number, value: T): T[] {
  const out = arr.slice()
  out[idx] = value
  return out
}

/**
 * 折入一个 AgentEvent。返回新 Transcript。
 * 未知事件类型(将来 core 扩了枚举而这里没跟)一律显式留一条 notice ——
 * 不得静默丢弃,否则"没显示"与"没实现"在屏幕上长得一样。
 */
export function foldEvent(tr: Transcript, ev: AgentEvent): Transcript {
  switch (ev.type) {
    case 'token': {
      const tail = tailAssistant(tr.blocks)
      if (tail && !tail.block.closed) {
        return {
          ...tr,
          blocks: replaceAt(tr.blocks, tail.index, { ...tail.block, text: tail.block.text + ev.text }),
          streaming: true,
        }
      }
      return {
        ...tr,
        blocks: [...tr.blocks, { kind: 'assistant', text: ev.text, closed: false }],
        streaming: true,
      }
    }
    case 'tool_call': {
      const summary = clip(
        Object.entries(ev.args ?? {})
          .map(([k, v]) => `${k}=${firstLine(typeof v === 'string' ? v : stringifyArgs(v))}`)
          .join(' '),
        ARGS_KEEP,
      )
      return {
        ...tr,
        blocks: [
          ...tr.blocks,
          { kind: 'tool', name: ev.name, argsSummary: summary, state: 'running', resultSummary: '', preview: '' },
        ],
      }
    }
    case 'tool_result': {
      // core 的 tool_result 不带 toolCallId(其契约注释已如实登记),所以按"同名最近一次
      // running"归并 —— 这是既有契约的限制,不是本层的偷懒;要精确归并得先给事件补 id。
      const found = findToolBack(tr.blocks, (b) => b.state === 'running' && b.name === ev.name)
      if (!found) {
        return {
          ...tr,
          blocks: [
            ...tr.blocks,
            { kind: 'notice', tone: 'warn', text: `unmatched tool_result from ${ev.name}` },
          ],
        }
      }
      return {
        ...tr,
        blocks: replaceAt(tr.blocks, found.index, {
          ...found.block,
          state: ev.success ? 'ok' : 'fail',
          resultSummary: firstLine(ev.output ?? ''),
          preview: '',
        }),
      }
    }
    case 'tool_delta': {
      const found = findToolBack(tr.blocks, (b) => b.state === 'running')
      if (!found) return tr
      const body = (ev.partialText ?? '').slice(0, PREVIEW_KEEP)
      return {
        ...tr,
        blocks: replaceAt(tr.blocks, found.index, {
          ...found.block,
          preview: body === '' ? '' : `${body}${ev.truncated ? '\n[truncated]' : ''}`,
        }),
      }
    }
    case 'tool_delta_clear': {
      const found = findToolBack(tr.blocks, (b) => b.preview !== '')
      if (!found) return tr
      return { ...tr, blocks: replaceAt(tr.blocks, found.index, { ...found.block, preview: '' }) }
    }
    case 'iteration':
      return { ...tr, iteration: ev.count, maxIterations: ev.max }
    case 'error':
      return { ...tr, blocks: [...tr.blocks, { kind: 'notice', tone: 'bad', text: ev.message }], streaming: false }
    case 'done': {
      const tail = tailAssistant(tr.blocks)
      const blocks = tail ? replaceAt(tr.blocks, tail.index, { ...tail.block, closed: true }) : tr.blocks
      const usageText = `in ${num(ev.usage.promptTokens)} / out ${num(ev.usage.completionTokens)} tok`
      return {
        ...tr,
        blocks: [
          ...blocks,
          {
            kind: 'turn',
            iterations: ev.iterations,
            maxIterations: ev.iterations,
            stopReason: ev.stopReason,
            usageText,
          },
        ],
        streaming: false,
      }
    }
    default: {
      const unknown = (ev as { type?: string }).type ?? '(unknown)'
      return { ...tr, blocks: [...tr.blocks, { kind: 'notice', tone: 'warn', text: `unhandled event: ${unknown}` }] }
    }
  }
}

function num(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

const TOOL_GLYPH: Record<ToolState, { mark: string; tone: Tone }> = {
  running: { mark: '…', tone: 'accent' },
  ok: { mark: '✓', tone: 'good' },
  fail: { mark: '✗', tone: 'bad' },
}

/**
 * 折成"未折行的逻辑行"列表。渲染层再按列宽软折。
 * verbose=false 时工具只占 1 行 + 预览 1 行;true 时展开结果多行。
 */
export function blocksToLines(tr: Transcript, opts: { verbose: boolean }): FrameLine[] {
  const out: FrameLine[] = []
  for (const b of tr.blocks) {
    switch (b.kind) {
      case 'user':
        out.push({ segs: [{ text: '❯ ', tone: 'accent' }, { text: b.text, tone: 'plain' }] })
        break
      case 'assistant':
        // 前缀同字形、不同色:闭合=灰(定稿),未闭合=亮(正在流式)——
        // 光标块 ▍ 只在 streaming 尾巴上出现,所以这里不能用两个不同字符冒充两态。
        out.push({ segs: [{ text: '· ', tone: b.closed ? 'dim' : 'accent' }, { text: b.text, tone: 'plain' }] })
        break
      case 'tool': {
        const g = TOOL_GLYPH[b.state]
        const line: Segment[] = [
          { text: `  ${g.mark} `, tone: g.tone },
          { text: b.name, tone: g.tone },
        ]
        if (b.argsSummary !== '') line.push({ text: ` ${b.argsSummary}`, tone: 'dim' })
        if (b.state === 'fail' && b.resultSummary !== '') line.push({ text: ` — ${b.resultSummary}`, tone: 'bad' })
        out.push({ segs: line })
        if (b.preview !== '') {
          const body = opts.verbose ? b.preview : clip(b.preview.replace(/\n/g, ' ⏎ '), 120)
          for (const one of body.split('\n')) out.push({ segs: [{ text: `      ${one}`, tone: 'dim' }] })
        }
        break
      }
      case 'notice':
        out.push({ segs: [{ text: `! ${b.text}`, tone: b.tone }] })
        break
      case 'turn': {
        const bits = [`turn done`, `iters ${b.iterations}`, `stop ${b.stopReason}`]
        if (b.usageText !== '') bits.push(b.usageText)
        out.push({ segs: [{ text: `  ${bits.join(' · ')}`, tone: 'dim' }] })
        break
      }
      default:
        break
    }
  }
  if (tr.streaming) out.push({ segs: [{ text: '  ▍', tone: 'accent' }] })
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
