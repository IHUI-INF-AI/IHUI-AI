// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D82 输入框草稿「一键润色」· 共享层判定(G-95 重定义,2026-09-23 立)
 *
 * 对标竞品的「对草稿**就地改写** + 失败**保稿**」,收敛为跨端唯一的判定层:
 *   · 四相位 —— idle / polishing / succeeded / failed
 *   · 入口动作 —— polish / retry(动作 id 即 i18n 键片段,各端自取词)
 *
 * **不新建提示词栈(台账 D82 明文)**:本模块**只做判定**,不含任何提示词文本。
 * 润色提示词复用既有 `/polish` 命令文案(`chat.cmdPolish`,与
 * `apps/web/src/hooks/use-slash-action.ts` 的 `commandTemplates.polish` 同源),
 * 单次调用复用既有 `POST /api/best-of-n/run`(runBestOfN N=1)通道,
 * **不得**另起一套 prompt / 调用栈。
 *
 * **数据面纪律**:本模块不取数、不触碰 DOM / localStorage,纯函数便于单测与多端复用。
 *
 * 四条逐条可机检的语义(不做"看起来对"的推断):
 *   ① **成功 = 就地改写** —— 用润色结果**替换**草稿(既不插入模板,也不与旧草稿拼接)。
 *   ② **失败 = 保稿** —— `draft` 字段**字节级不变**(展开入参状态,只改相位与诊断),
 *      `polishDraftAfter()` 返回值恒等于入参 `draft`,`original` 亦不被改写。
 *   ③ **空草稿不得发起** —— 空 / 纯空白草稿被 `polishRejection()` 显式拒绝
 *      (`rejection.emptyDraft`),`beginPolish()` 不进入 `polishing`;
 *      且**空结果同样不得覆盖原稿**(成功返回空白时落 `failed` + `emptyResult` 哨兵),
 *      避免"仅剩的原文被空结果抹掉"。
 *   ④ **二次失败仍可重试** —— `canRetry()` 在 `failed` 态恒为 true(其余相位恒 false),
 *      重试走 `beginPolish()`:**不消耗、不改变草稿**(仅刷新相位与快照)。
 */

/** 润色四相位(取值即 i18n 键片段 `phase.<key>`) */
export const POLISH_PHASES = ['idle', 'polishing', 'succeeded', 'failed'] as const
export type PolishPhase = (typeof POLISH_PHASES)[number]

/** 润色入口动作(取值即 i18n 键片段 `action.<key>`) */
export const POLISH_ACTIONS = ['polish', 'retry'] as const
export type PolishAction = (typeof POLISH_ACTIONS)[number]

/** 发起润色被拒的原因(取值即 i18n 键片段 `rejection.<key>`) */
export const POLISH_REJECTIONS = ['emptyDraft'] as const
export type PolishRejection = (typeof POLISH_REJECTIONS)[number]

/** 无参数变化的固定文案键(非层级键,直接取词) */
export const POLISH_FIXED_KEYS = [
  'entryLabel',
  'ariaLabel',
  'failureDraftKept',
  'restartHint',
] as const
export type PolishFixedKey = (typeof POLISH_FIXED_KEYS)[number]

/**
 * 空结果哨兵:`error` 取值 —— 润色"成功"但返回纯空白时,判 `failed` 并**保留原稿**。
 * 单独成常量便于测试与 UI 判定,不与网络错误混为一谈。
 */
export const POLISH_EMPTY_RESULT = 'emptyResult'

/**
 * 「需重启生效」的原因白名单。判定层只认这几种 ⇒ `restartHintNeeded()` 为真,
 * UI 据此展示"重启后生效 + 草稿已保留"提示。**不臆造**:调用方传入的原因不在白名单即不提示。
 */
export const POLISH_RESTART_REASONS = ['featureToggled', 'modelConfigChanged'] as const
export type PolishRestartReason = (typeof POLISH_RESTART_REASONS)[number]

const PHASE_SET: ReadonlySet<string> = new Set<string>(POLISH_PHASES)
const RESTART_SET: ReadonlySet<string> = new Set<string>(POLISH_RESTART_REASONS)

/** 是否为合法四相位之一(相位会经回调往返,调用方需可校验) */
export function isPolishPhase(value: string): value is PolishPhase {
  return PHASE_SET.has(value)
}

/**
 * 润色判定状态。
 * - `draft` 是**当前草稿**:成功后被润色结果**替换**;失败 / 拒绝时**字节级不变**。
 * - `original` 是**发起润色时的草稿快照**(保稿锚点),失败时 `draft === original`。
 * - `error` 仅用于展示 / 诊断,不参与任何判定(判定只看 `phase` 与 `rejection`)。
 */
export interface PromptPolishState {
  readonly phase: PolishPhase
  readonly draft: string
  readonly original: string
  readonly error: string | null
  readonly rejection: PolishRejection | null
  readonly restartHint: boolean
}

/** 一次润色的结果(调用方在异步返回后构造,判定层据此迁移状态) */
export type PromptPolishOutcome =
  | {
      readonly kind: 'succeeded'
      /** 润色后的文本(纯空白视为空结果,不覆盖原稿) */
      readonly text: string
      /** 若后端声明"需重启生效",带上原因;非白名单原因一律不提示 */
      readonly restartReason?: string | null
    }
  | {
      readonly kind: 'failed'
      /** 失败诊断(仅展示,不参与判定) */
      readonly error?: string | null
      readonly restartReason?: string | null
    }

/** 四相位 → i18n 键名(`ai.pane.promptPolish.phase.<key>`) */
export function polishPhaseKey(phase: PolishPhase): string {
  return `phase.${phase}`
}

/** 动作 → i18n 键名(`ai.pane.promptPolish.action.<key>`) */
export function polishActionKey(action: PolishAction): string {
  return `action.${action}`
}

/** 拒绝原因 → i18n 键名(`ai.pane.promptPolish.rejection.<key>`) */
export function polishRejectionKey(reason: PolishRejection): string {
  return `rejection.${reason}`
}

/** 固定文案键 → 键名(`ai.pane.promptPolish.<key>`,键名即取值) */
export function polishFixedKey(key: PolishFixedKey): string {
  return key
}

/**
 * 是否需要「重启生效」保稿提示。
 * 仅白名单原因(`POLISH_RESTART_REASONS`)为真;`null` / `undefined` / 空串 / 未知原因一律 false。
 */
export function restartHintNeeded(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && RESTART_SET.has(reason)
}

/** 空 / 纯空白草稿的拒绝原因;`null` 表示可发起润色 */
export function polishRejection(draft: string): PolishRejection | null {
  return draft.trim().length === 0 ? 'emptyDraft' : null
}

/** 当前草稿是否可发起润色(等价于 `polishRejection(draft) === null`) */
export function canStartPolish(draft: string): boolean {
  return polishRejection(draft) === null
}

/** 构造初始状态(idle,快照 = 当前草稿) */
export function createPolishState(draft: string): PromptPolishState {
  return {
    phase: 'idle',
    draft,
    original: draft,
    error: null,
    rejection: null,
    restartHint: false,
  }
}

/**
 * 发起 / 重试润色:刷新快照并进入 `polishing`。
 *
 * **空草稿(含纯空白)直接拒绝** —— 相位留在 `idle` 并写 `rejection.emptyDraft`,
 * 绝不进入 `polishing`(否则空结果会把仅剩的原文覆盖掉)。
 * 非空草稿:仅刷新 `original` 快照,**不动 `draft` 一个字节**(重试不消耗草稿)。
 */
export function beginPolish(state: PromptPolishState): PromptPolishState {
  const rejection = polishRejection(state.draft)
  if (rejection) {
    return { ...state, phase: 'idle', rejection, error: null, restartHint: false }
  }
  return {
    ...state,
    phase: 'polishing',
    original: state.draft,
    rejection: null,
    error: null,
    restartHint: false,
  }
}

/**
 * 唯一状态迁移函数。`switch` **穷尽两种结果且无 default** —— 新增结果类型时编译器直接报错,
 * 不会静默落到"什么都不做"。
 *
 * 保稿语义(本票核心,逐条可机检):
 *   · `succeeded` 且文本非空白 ⇒ 用结果**替换** `draft`(`original` 保留,便于展示"改前/改后");
 *   · `succeeded` 但文本纯空白 ⇒ 落 `failed` + `error = POLISH_EMPTY_RESULT`,**草稿不变**;
 *   · `failed` ⇒ 展开入参状态,只改相位与诊断字段 ⇒ `draft` 字节级不变。
 */
export function applyPolishResult(
  state: PromptPolishState,
  outcome: PromptPolishOutcome,
): PromptPolishState {
  switch (outcome.kind) {
    case 'succeeded': {
      // 空结果守护:不得让仅剩的原稿被空结果覆盖
      if (outcome.text.trim().length === 0) {
        return {
          ...state,
          phase: 'failed',
          error: POLISH_EMPTY_RESULT,
          rejection: null,
          restartHint: restartHintNeeded(outcome.restartReason),
        }
      }
      // 就地改写:替换草稿(不插入模板、不拼接);保稿锚点 original 原样保留
      return {
        phase: 'succeeded',
        draft: outcome.text,
        original: state.original,
        error: null,
        rejection: null,
        restartHint: restartHintNeeded(outcome.restartReason),
      }
    }
    case 'failed': {
      // 保稿:展开入参状态,`draft` / `original` 一个字节都不动
      return {
        ...state,
        phase: 'failed',
        error: outcome.error ?? null,
        rejection: null,
        restartHint: restartHintNeeded(outcome.restartReason),
      }
    }
  }
  return assertNeverOutcome(outcome)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverOutcome(outcome: never): never {
  throw new Error(`unhandled polish outcome: ${String(outcome)}`)
}

/**
 * 是否可重试。**仅在 `failed` 态恒为 true** —— 二次失败仍可重试,
 * 重试走 `beginPolish()` 不消耗 / 不改变草稿。
 */
export function canRetry(state: PromptPolishState): boolean {
  return state.phase === 'failed'
}

/** 本次迁移后的草稿(失败 / 拒绝时 === 入参 `draft`,供调用方与测试直接断言保稿) */
export function polishDraftAfter(state: PromptPolishState): string {
  return state.draft
}
