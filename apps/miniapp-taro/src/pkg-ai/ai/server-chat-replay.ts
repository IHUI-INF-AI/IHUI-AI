// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D20 服务端会话回放(小程序端)。
//
// 立项原因:历史页 86ef4ab06e3 改成读服务端会话列表后,行上的 id 是 chat_conversations
// 主键(UUID),而聊天页此前只从 localStorage 快照恢复(条目 id 形如 hist_<ts>)——
// 于是 `?sessionId=<UUID>` 点进去永远匹配不到,呈现为新会话。本模块补上那一段。
//
// 三条不可动摇的写法:
// ① 网络出口只有 @ihui/api-client 一份(AGENTS §3;守门 73 拦端内裸 Taro.request/fetch),
//    且由调用方注入,本文件不 import 任何传输层 ⇒ 判序可测、不依赖平台。
// ② fail-closed:三条同时成立才算「拿到了服务端消息」——不抛 ∧ success===true ∧
//    messages 是数组。任何一条不成立一律判失败,**绝不把"取不到"渲染成"这个会话没有消息"**
//    (与 history.tsx 的 loadHistoryRows 同一条判序)。
// ③ 逐条、逐字段类型守卫:脏条目单条丢弃而不是整表作废;缺字段就不造(宁缺不造),
//    与 mobile-rn ChatScreen 的 G-166 口径一致。

import type { ConversationMessage, GetMessagesResult } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import type { ChatMessage } from '@/api'
import type {
  AICardsData,
  CitationView,
  InjectionView,
  PlanStepView,
  TerminalTaskView,
  ToolCallView,
} from './cards/types'
import { backfillSteerNoticesFromMetadata } from './cards/types'

/** 回放结果:成功携带可直接渲染的消息;失败携带原因(调用方必须给出可见反馈) */
export type ReplayOutcome =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; reason: 'request-failed' | 'bad-payload' }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
/** 可选文本:空串按「没有」处理 —— 渲染层用真值判存在,塞个空串进去就是多一行空内容 */
const text = (v: unknown): string | undefined => {
  const s = str(v)
  return s ? s : undefined
}
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)

/**
 * 值真的取到了才产出这个键。
 *
 * 它存在的理由不是简洁:写成 num(x) !== undefined ? { k: x } : {} 时,x 在展开位上仍是
 * unknown(三元条件不会把对象属性的窄化带过去),tsc 直接判 unknown 不可赋给 number。
 * 先收进局部变量再交给本函数,窄化才真的跟着走。
 */
function opt<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>)
}

/**
 * 落库 BaseToolCall → 端内 ToolCallView。
 *
 * 线上契约用 toolName + 状态 success,视图用 name + 状态 done
 * (正向适配住在 cards/types.ts 的 toSharedToolCalls,本函数是它的逆向读数);
 * id / toolName 缺一即整条丢弃 —— 没有名字的卡片渲染出来就是一块空白。
 */
function readToolCalls(raw: unknown): ToolCallView[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: ToolCallView[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const id = str(item.id)
    const name = str(item.toolName)
    if (!id || !name) continue
    const status = str(item.status)
    out.push({
      id,
      name,
      status: status === 'running' ? 'running' : status === 'error' ? 'error' : 'done',
      ...opt('durationMs', num(item.durationMs)),
      ...opt('isError', bool(item.isError)),
      ...opt('args', isRecord(item.args) ? item.args : undefined),
      // result 原样带回:卡片的结果度量(行数 / ±行数)由既有渲染层从它算,此处不加工
      ...('result' in item ? { result: item.result } : {}),
    })
  }
  return out.length > 0 ? out : undefined
}

/** 落库 PlanStep → 端内 PlanStepView(id/step/status 三项齐备才收) */
function readPlanSteps(raw: unknown): PlanStepView[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: PlanStepView[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const id = str(item.id)
    const step = str(item.step)
    const status = str(item.status)
    if (!id || !step || !status) continue
    out.push({
      id,
      step,
      status: status as PlanStepView['status'],
      ...opt('explanation', text(item.explanation)),
      ...opt('durationMs', num(item.durationMs)),
      ...opt('error', bool(item.error)),
    })
  }
  return out.length > 0 ? out : undefined
}

/**
 * 落库 TerminalTask → 端内 TerminalTaskView。
 *
 * truncated / totalChars 必须一起带回:回放没有 live 缓冲,丢了标志就等于把截断当完整。
 */
function readTerminalTasks(raw: unknown): TerminalTaskView[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: TerminalTaskView[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const id = str(item.id)
    const command = str(item.command)
    if (!id || !command) continue
    const status = str(item.status)
    out.push({
      id,
      command,
      status: status === 'running' ? 'running' : status === 'failed' ? 'failed' : 'completed',
      ...opt('output', text(item.output)),
      ...opt('truncated', bool(item.truncated)),
      ...opt('totalChars', num(item.totalChars)),
      ...opt('durationMs', num(item.durationMs)),
      ...opt('exitCode', num(item.exitCode)),
    })
  }
  return out.length > 0 ? out : undefined
}

/** 落库 injections:必填位与 mobile-rn ChatScreen 的历史读回同一条(kind + collapsed) */
function readInjections(raw: unknown): InjectionView[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: InjectionView[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const kind = str(item.kind)
    const collapsed = str(item.collapsed)
    if (!kind || !collapsed) continue
    out.push({
      kind,
      collapsed,
      ...opt('fullText', text(item.fullText)),
      ...opt('count', num(item.count)),
    })
  }
  return out.length > 0 ? out : undefined
}

/** 落库 citations:缺 url 不造「点不动的假链接」(与 mobile-rn 同一条守卫) */
function readCitations(raw: unknown): CitationView[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: CitationView[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const source = str(item.source)
    const label = str(item.label)
    if (!source || !label) continue
    out.push({ source, label, ...opt('url', text(item.url)) })
  }
  return out.length > 0 ? out : undefined
}

/**
 * 服务端一条消息 → 端内一条消息。
 *
 * 返回 null = 这条不该出现在界面上:角色不在本端词汇内(本端 ChatMessage.role 只收
 * user/assistant,system 提示词由会话详情持有、不作为气泡),或正文不是字符串。
 * 内容缺失与"内容为空串"是两件事 —— 空串是合法的空回答,照收。
 */
export function mapServerMessage(m: ConversationMessage): ChatMessage | null {
  if (m.role !== 'user' && m.role !== 'assistant') return null
  if (typeof m.content !== 'string') return null
  const created = typeof m.createdAt === 'string' ? Date.parse(m.createdAt) : Number.NaN
  const meta = isRecord(m.metadata) ? m.metadata : undefined

  const planSteps = readPlanSteps(meta?.planSteps)
  const toolCalls = readToolCalls(meta?.toolCalls)
  const terminalTasks = readTerminalTasks(meta?.terminalTasks)
  const injections = readInjections(meta?.injections)
  const citations = readCitations(meta?.citations)
  const hasCards =
    !!planSteps || !!toolCalls || !!terminalTasks || !!injections || !!citations

  const out: ChatMessage = {
    role: m.role,
    content: m.content,
    ...(typeof m.reasoning === 'string' && m.reasoning ? { reasoning: m.reasoning } : {}),
    ...(m.role === 'assistant' && typeof m.tokens === 'number' ? { tokenCount: m.tokens } : {}),
    ...(Number.isNaN(created) ? {} : { timestamp: created }),
    ...(meta ? { metadata: meta as Record<string, unknown> } : {}),
    // 五族卡片一个都不给空数组:aiCards 只在真有内容时才挂,否则 ChatMessageItem
    // 会把"没有任何卡片"读成"有一组空卡片",渲染出空的执行过程区。
    ...(hasCards
      ? {
          aiCards: {
            planSteps: planSteps ?? [],
            toolCalls: toolCalls ?? [],
            terminalTasks: terminalTasks ?? [],
            injections: injections ?? [],
            citations: citations ?? [],
          } satisfies AICardsData,
        }
      : {}),
  }
  return out
}

/**
 * 回放一个服务端会话的消息。
 *
 * 判序三条同时成立才算成功(见文件头②)。`messages: []` 是**合法的空会话**,
 * 与"取不到"不同 —— 取不到走 ok:false,由调用方喊出来,绝不落进空态。
 * 成功后再走一次 backfillSteerNoticesFromMetadata(与本机快照恢复路径同一出口)。
 */
export async function replayServerConversation(deps: {
  fetchMessages: () => Promise<ApiResult<GetMessagesResult>>
}): Promise<ReplayOutcome> {
  let res: ApiResult<GetMessagesResult>
  try {
    res = await deps.fetchMessages()
  } catch {
    return { ok: false, reason: 'request-failed' }
  }
  if (res.success !== true) return { ok: false, reason: 'request-failed' }
  const rows = res.data?.messages
  if (!Array.isArray(rows)) return { ok: false, reason: 'bad-payload' }
  const mapped = (rows as ConversationMessage[])
    .map(mapServerMessage)
    .filter((m): m is ChatMessage => m !== null)
  return {
    ok: true,
    messages: backfillSteerNoticesFromMetadata(mapped),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
