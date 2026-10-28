// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)

/**
 * 回合答案完整性(对标 ZCode `app-turn-complete.ts:17-37` + `app-submit.ts:57-61`,2026-09-28 立)。
 *
 * ## 现读定位(为什么这一格在共享层是空的)
 * - 客户端唯一的流式追加口是 `packages/shared/src/hooks/use-chat.ts`:`:288-297` 造一条
 *   `content: ''` 的 assistant 占位行,`:325-334` 由 `onDelta` 往尾行累加,`:361-364` 的
 *   `onDone()` **只翻标志位**(`setIsStreaming(false)`),`onError` 在内容为空时把错误文案写进
 *   `content`。也就是说:**回合结束时没有任何一条"权威答案"的落点**。
 * - 传输面也不供给:`packages/api-client/src/client.ts:1045-1047` 的流回调只有
 *   `onDelta / onError / onDone`,而 `onDone` 是无参的;`packages/shared/src/sse/contract.ts`
 *   的帧名只有 `DONE / MESSAGE_STOP`,**没有携带全文的终态帧**。服务端
 *   `apps/api/src/plugins/ws-ai.ts:259-260` 只对 AbortError 做了"不重复报错"的去重,
 *   那是**发送侧**的去重,不构成客户端的幂等。
 * - 因此本票要的三个判据在 HEAD 与工作树两侧全部 0 命中(`projectedTranscript` /
 *   `streamProjected` / `turn_complete.*fallback` 在 apps+packages 均无),本模块是**判定与追加的
 *   唯一实现**,端上只调用,不得各写一遍。
 *
 * ## 三条判据与它们的理由
 * 1. **兜底补出唯一答案**:流断了 / 终态事件没到时,回合不能一个字不剩。答案文本由调用方
 *    作为参数传入(本模块不认事件名,也不新增帧 —— 硬边界)。
 * 2. **按内容幂等**:判据是**内容**而不是时序。同一文本已在本轮转写里就绝不追加第二遍 ——
 *    无论它是流式累加留下的、还是另一条路径先补上的。按"最后一条是不是它"这类位置/时序判断
 *    会在答案行不在尾部时漏判(见测试 K1 的第二段),所以只有内容比对站得住。
 * 3. **空响应绝不伪造回复**:上游给出空 content 时**不新增** agent 行,并落一个**明确的非
 *    "完成"终态**。渲染占位等于"显示一条 agent 从未发送的回复";而 AGENTS §30 已把"没有终态
 *    却写成已完成"定为本仓最高频失效型,所以这里既不加气泡,也不记 `completed`。
 *    呈现态复用 D71 `TURN_STATES` 十态词汇(取 `failed`),不新增词汇、不新增 i18n 键
 *    (`ai.pane.turnStatus.state.failed` 五语言已在位)。
 *
 * ## 刻意复用的两份既有实现(禁止第二份)
 * - 失败轮判定引 `./stream-error` 的 `isErrorTurn`。失败轮的 `content` 是错误文案而非回答,
 *   所以它**既不算"答案已在"**(否则错误文案会吞掉真答案),也**不被本模块改写**
 *   (那是 `stream-error` 的归属)——兜底答案作为独立一行给出。
 * - 终态词汇引 `./turn-status` 的 `TurnState`。
 *
 * ## 本轮窗口(为什么不是全量扫)
 * 同一段文本在**上一轮**合法地出现过(用户重复提问)。所以幂等只扫"最后一条 `user` 之后"的
 * 本轮行;没有 `user` 行的回合(通知驱动,对应参照实现那条注释的场景)⇒ 整段即本轮。
 *
 * ## 尚未接线的一格(如实登记,不在本票文件清单内)
 * `hooks/use-chat.ts` 与三端的消息出口此刻都没有终态答案的来源(见上),所以本模块在 HEAD 面
 * **零生产调用方**;把 `onDone` / 非流式提交结果接成答案来源属该 hook 与各端 store 的归属,
 * 且需要后端在终态帧里带上全文(属协议决策)。在此之前不得声称"①③已端到端生效"。
 */

import { isErrorTurn } from './stream-error'
import type { TurnState } from './turn-status'

// ============================================================================
// 类型:转写行的最小结构
// ============================================================================

/**
 * 转写行的最小结构 —— 各端消息类型都满足(`@ihui/types/chat` 的 `ChatMessage`、
 * `./stream-error` 的 `ErrorAwareMessage`),因此端上无需为接线改造自己的消息形状。
 */
export interface TurnAnswerEntry {
  readonly role: string
  readonly content: string
  /** 失败轮标记:沿用 `stream-error` 的 `error` 词汇,本模块不另立字段 */
  readonly error?: boolean
}

/**
 * 判定结果三态(三态绝不并桶:"没补"有两种原因,处置动作不同)。
 * - `append`    本轮还没有这段答案 ⇒ 补出唯一一条
 * - `duplicate` 同一文本已在本轮转写里 ⇒ 一条都不加(幂等)
 * - `empty`     上游没给出内容 ⇒ 一条都不加,并给出非"完成"呈现态
 */
export const TURN_FALLBACK_KINDS = ['append', 'duplicate', 'empty'] as const
export type TurnFallbackKind = (typeof TURN_FALLBACK_KINDS)[number]

export interface TurnFallbackDecision {
  readonly kind: TurnFallbackKind
  /** 需要补写的唯一答案原文(保留上游字节,只在判定时规范化);非 `append` 时恒为 null */
  readonly content: string | null
  /**
   * 呈现落点(D71 十态之一):
   * - `empty` ⇒ 非 `completed` 的终态(现取 `failed`,可重试,与 `turnStatusView` 同判据)
   * - `append` / `duplicate` ⇒ null(本轮有答案,呈现侧不必改判)
   */
  readonly presentationState: TurnState | null
}

/** 空内容回合的呈现态:上游没产出答案 = 本轮失败,绝不是"已完成"(AGENTS §30) */
const EMPTY_ANSWER_PRESENTATION_STATE: TurnState = 'failed'

/** 角色字面量的唯一出处(取值与各端 / `@ihui/types/chat` 的 `ChatRole` 同集,不新增) */
const ASSISTANT_ROLE = 'assistant'
const USER_ROLE = 'user'

// ============================================================================
// 判据(唯一实现)
// ============================================================================

/** 内容的运行时规范化:类型要求 content 是 string,但共享入口不信任调用方的空值 */
function textOf(row: TurnAnswerEntry): string {
  return typeof row.content === 'string' ? row.content : ''
}

/**
 * 本轮转写窗口:最后一条 `user` 之后的所有行。
 *
 * 没有 `user` 行时整段即本轮 —— 参照实现记过的同一种回合(通知驱动:没有提交动作,
 * 也就没有随提交回来的结果),按"最后一条 user 之后"会退化成空窗口而漏补答案。
 */
export function currentTurnAnswerRows(entries: readonly TurnAnswerEntry[]): TurnAnswerEntry[] {
  let lastUserIndex = -1
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const row = entries[i]
    if (row && row.role === USER_ROLE) {
      lastUserIndex = i
      break
    }
  }
  return entries.slice(lastUserIndex + 1)
}

/** 本轮里"已经是答案"的行:assistant ∧ 非失败轮(失败轮的行不由本模块当作答案) */
function answerRowsOf(entries: readonly TurnAnswerEntry[]): TurnAnswerEntry[] {
  return currentTurnAnswerRows(entries).filter(
    (row) => row.role === ASSISTANT_ROLE && !isErrorTurn(row),
  )
}

/**
 * 内容幂等判据(唯一实现):同一文本是否已在本轮转写里。
 *
 * 只在判定时 `trim()` 做规范化,写入时用原文 —— 答案的换行/缩进属于内容,不能被判据顺手改掉。
 */
export function hasTurnAnswerText(
  entries: readonly TurnAnswerEntry[],
  answer: string | null | undefined,
): boolean {
  const normalized = (answer ?? '').trim()
  if (normalized.length === 0) return false
  return answerRowsOf(entries).some((row) => textOf(row).trim() === normalized)
}

/**
 * 回合结束时该不该补兜底答案(端上唯一的判定入口)。
 *
 * 判序是设计的一部分:先判空(空内容不得进入幂等比较,否则会与"本轮已有空占位行"混成同一态),
 * 再判内容(不判位置、不判时序)。
 */
export function shouldAppendTurnFallback(
  entries: readonly TurnAnswerEntry[],
  answer: string | null | undefined,
): TurnFallbackDecision {
  const raw = typeof answer === 'string' ? answer : ''
  if (raw.trim().length === 0) {
    return { kind: 'empty', content: null, presentationState: EMPTY_ANSWER_PRESENTATION_STATE }
  }
  if (hasTurnAnswerText(entries, raw)) {
    return { kind: 'duplicate', content: null, presentationState: null }
  }
  return { kind: 'append', content: raw, presentationState: null }
}

// ============================================================================
// 追加口(端上只调用;id / createdAt 等平台字段由 host 注入)
// ============================================================================

/**
 * 新建答案行所需的平台字段由调用方注入 —— 共享层不生成消息 id
 * (`use-chat.ts` 的 `nextId()` 是各端自增序列,共享层若另造一套会产出两种 id 形态)。
 */
export interface TurnAnswerRowHost<T extends TurnAnswerEntry> {
  readonly createAnswerRow: (content: string) => T
}

export interface TurnFallbackApplyResult<T extends TurnAnswerEntry> {
  /** 不追加时**原样返回入参数组引用**(调用方可直接与旧 state 同形,不触发无谓重渲染) */
  readonly entries: readonly T[]
  readonly decision: TurnFallbackDecision
}

/**
 * 把兜底答案落到转写里,保证"最多补一条、且只在缺答案时补"。
 *
 * 两条写入形态(都只产出一条答案):
 * - 尾行是**空白非失败轮**的 assistant 行 ⇒ 就地补字(`use-chat.ts` 每轮都先造空占位行,
 *   典型即"只有工具调用、无文本"那一型)。再新建一条会让同一轮出现两个 agent 气泡。
 *   除 `content` 外的字段(id / toolCalls / createdAt)逐字保留。
 * - 否则 ⇒ 经 host 工厂追加一条。
 */
export function applyTurnFallbackAnswer<T extends TurnAnswerEntry>(
  entries: readonly T[],
  answer: string | null | undefined,
  host: TurnAnswerRowHost<T>,
): TurnFallbackApplyResult<T> {
  const decision = shouldAppendTurnFallback(entries, answer)
  if (decision.kind !== 'append') {
    return { entries, decision }
  }
  const content = decision.content ?? ''
  const tailIndex = entries.length - 1
  const tail = entries[tailIndex]
  const patchable =
    !!tail && tail.role === ASSISTANT_ROLE && !isErrorTurn(tail) && textOf(tail).trim().length === 0

  if (patchable && tail) {
    // 与 stream-error 的 markStreamError 同一形态:在基接口上组装再收窄回 T
    const patched: TurnAnswerEntry = { ...tail, content }
    return { entries: [...entries.slice(0, tailIndex), patched as T], decision }
  }
  return { entries: [...entries, host.createAnswerRow(content)], decision }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
