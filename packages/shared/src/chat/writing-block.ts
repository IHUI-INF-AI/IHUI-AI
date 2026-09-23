// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D96 对话内写作块 · 共享层状态机与判定(G-129,2026-09-23 立)
//
// 对标 Codex 流内「可编辑文本块 + 逐块接受 / 全部接受 / 撤销」的一手交互,收敛为**跨端唯一**的
// 写作块判定层:
//   · 五态 —— idle / editing / accepted / reverted / failed
//   · 三动作 —— accept / acceptAll / revert(动作 id 即 i18n 键片段,各端自取词)
//   · 打开方式 —— OPEN_IN_APPS 应用选择器(文案形态「使用默认电子邮箱应用打开电子邮件」)
//
// **数据面纪律**:本模块**不取数**。它只定义"给定一批写作块,某动作该怎么改状态、该取哪个文案键"。
// 编辑与版本能力**复用既有 canvas 栈**(`apps/web/src/stores/canvas-store.ts` 的
// content / versions,`ArtifactCanvas` 的「应用并刷新预览」走的同一条路),
// **禁止为写作块另建第二套编辑器状态机**(台账 D96 明文)。
//
// 三条逐条可测的语义(不做"看起来对"的推断):
//   ① **撤销可逆** —— `revert` 回到 accepted **之前**的原文(块内 `original` 快照),
//      状态落 `reverted`,此时 `canAccept` 再次为真 ⇒ 可再次接受,accepted ⇄ reverted 可任意往返。
//   ② **acceptAll 只作用于整批可接受态** —— 只要存在 `failed` 块就**拒绝整批**
//      (原样返回入参状态,**不部分接受、不静默跳过**)。静默跳过会让用户以为"全部接受"已成功。
//   ③ **failed 既不可接受也不可撤销** —— 只给文案键 `status.failed`(「无法更新此写作块」),
//      由调用方决定重试还是提示。

/** 写作块五态(取值即 i18n 键片段 `status.<key>`,便于各端取词) */
export const WRITING_BLOCK_STATUSES = ['idle', 'editing', 'accepted', 'reverted', 'failed'] as const
export type WritingBlockStatus = (typeof WRITING_BLOCK_STATUSES)[number]

/** 三动作(取值即 i18n 键片段 `action.<key>`) */
export const WRITING_BLOCK_ACTIONS = ['accept', 'acceptAll', 'revert'] as const
export type WritingBlockAction = (typeof WRITING_BLOCK_ACTIONS)[number]

/** 动作三相位(取值即 i18n 键片段 `phase.<action>.<phase>`) */
export const WRITING_BLOCK_PHASES = ['inProgress', 'completed', 'failed'] as const
export type WritingBlockPhase = (typeof WRITING_BLOCK_PHASES)[number]

/**
 * 「打开方式」可选应用。取值即键名片段 —— 文案形态取自台账原文:
 * `使用默认电子邮箱应用打开电子邮件` ⇒ `openIn.email`。
 */
export const OPEN_IN_APPS = ['email', 'browser'] as const
export type OpenInApp = (typeof OPEN_IN_APPS)[number]

/**
 * 单个写作块。
 * - `original` 是**接受前的流内原文快照**,`revert` 的唯一依据(不因用户编辑而改写);
 * - `draft` 是当前文本(编辑中的草稿 / 接受后的定稿);
 * - `error` 仅用于展示,不参与任何判定(判定只看 `status`)。
 */
export interface WritingBlock {
  readonly id: string
  readonly status: WritingBlockStatus
  readonly original: string
  readonly draft: string
  readonly error?: string
}

/** 对话流内一批写作块(「全部接受」的作用域) */
export interface WritingBlockState {
  readonly blocks: readonly WritingBlock[]
}

/** 动作上下文:`accept` / `revert` 用 `blockId` 指定目标块;`accept` 可用 `draft` 覆盖定稿文本 */
export interface WritingBlockActionContext {
  /** 目标块 id;缺省时取首个块(单块场景免传) */
  readonly blockId?: string
  /** 用户编辑后的定稿文本;缺省时取该块当前 `draft` */
  readonly draft?: string
}

const STATUS_SET: ReadonlySet<string> = new Set<string>(WRITING_BLOCK_STATUSES)
const ACTION_SET: ReadonlySet<string> = new Set<string>(WRITING_BLOCK_ACTIONS)

/** 是否为合法五态之一 */
export function isWritingBlockStatus(value: string): value is WritingBlockStatus {
  return STATUS_SET.has(value)
}

/** 是否为合法三动作之一(动作 id 会经回调往返,调用方需可校验) */
export function isWritingBlockAction(value: string): value is WritingBlockAction {
  return ACTION_SET.has(value)
}

/** 五态 → i18n 键名(`ai.pane.writingBlock.status.<key>`) */
export function writingBlockStatusKey(status: WritingBlockStatus): string {
  return `status.${status}`
}

/** 动作 → i18n 键名(`ai.pane.writingBlock.action.<key>`) */
export function writingBlockActionKey(action: WritingBlockAction): string {
  return `action.${action}`
}

/** 动作 + 相位 → i18n 键名(`ai.pane.writingBlock.phase.<action>.<phase>`) */
export function writingBlockPhaseKey(action: WritingBlockAction, phase: WritingBlockPhase): string {
  return `phase.${action}.${phase}`
}

/** 打开方式应用 → i18n 键名(`ai.pane.writingBlock.openIn.<app>`) */
export function openInLabel(appId: OpenInApp): string {
  return `openIn.${appId}`
}

/** 五态 → 相位;`idle` / `reverted` 未发生更新动作,无相位(null) */
export function writingBlockPhaseOf(status: WritingBlockStatus): WritingBlockPhase | null {
  switch (status) {
    case 'idle':
      return null
    case 'editing':
      return 'inProgress'
    case 'accepted':
      return 'completed'
    case 'reverted':
      return null
    case 'failed':
      return 'failed'
  }
}

/** 该块当前是否可接受 —— 已 `accepted` 的块必须先 `revert` 才能再接受(故不在可接受态) */
export function canAccept(block: WritingBlock): boolean {
  return block.status === 'idle' || block.status === 'editing' || block.status === 'reverted'
}

/** 该块当前是否可撤销 —— 只有已接受的块有"可回到的接受前原文" */
export function canRevert(block: WritingBlock): boolean {
  return block.status === 'accepted'
}

/** 全部接受被拒的原因;`null` 表示允许整批接受 */
export type AcceptAllRejection = 'empty' | 'failed' | 'notAcceptable'

/**
 * 「全部接受」的整批前置判定。
 * 逐条可测:空批 → `empty`;存在 `failed` 块 → `failed`(**不得静默跳过**);
 * 存在已 `accepted` 等非可接受态的块 → `notAcceptable`(它们不会因"全部接受"而改变,
 * 静默忽略等于对用户撒谎)。仅当**每一个块都可接受**时返回 `null`。
 */
export function acceptAllRejection(state: WritingBlockState): AcceptAllRejection | null {
  if (state.blocks.length === 0) return 'empty'
  if (state.blocks.some((block) => block.status === 'failed')) return 'failed'
  if (!state.blocks.every(canAccept)) return 'notAcceptable'
  return null
}

/** 是否允许整批接受(等价于 `acceptAllRejection(state) === null`) */
export function canAcceptAll(state: WritingBlockState): boolean {
  return acceptAllRejection(state) === null
}

/** 取目标块:给了 id 就精确匹配,否则退首个块(单块场景) */
function selectBlock(
  state: WritingBlockState,
  blockId: string | undefined,
): WritingBlock | undefined {
  if (blockId !== undefined) return state.blocks.find((block) => block.id === blockId)
  return state.blocks[0]
}

/** 以不可变方式替换指定块(其余块原引用保留,便于 React 比较) */
function replaceBlock(
  state: WritingBlockState,
  blockId: string,
  next: WritingBlock,
): WritingBlockState {
  return { blocks: state.blocks.map((block) => (block.id === blockId ? next : block)) }
}

/**
 * 唯一状态迁移函数。`switch` **穷尽三动作且无 default** —— 新增动作时编译器直接报错,
 * 不会静默落到"什么都不做"。
 *
 * 不满足前置条件时**原样返回入参状态**(引用相等,调用方可据此判定"本次未生效")。
 */
export function applyWritingBlockAction(
  state: WritingBlockState,
  action: WritingBlockAction,
  ctx: WritingBlockActionContext = {},
): WritingBlockState {
  switch (action) {
    case 'accept': {
      const target = selectBlock(state, ctx.blockId)
      if (!target || !canAccept(target)) return state
      const draft = ctx.draft ?? target.draft
      return replaceBlock(state, target.id, { ...target, status: 'accepted', draft })
    }
    case 'acceptAll': {
      // 拒绝整批(含 failed 块):不部分接受、不静默跳过
      if (!canAcceptAll(state)) return state
      return { blocks: state.blocks.map((block) => ({ ...block, status: 'accepted' as const })) }
    }
    case 'revert': {
      const target = selectBlock(state, ctx.blockId)
      if (!target || !canRevert(target)) return state
      // 撤销可逆:draft 回到 accepted 前的原文,status 落 reverted ⇒ canAccept 再次为真
      return replaceBlock(state, target.id, {
        ...target,
        status: 'reverted',
        draft: target.original,
      })
    }
  }
}
