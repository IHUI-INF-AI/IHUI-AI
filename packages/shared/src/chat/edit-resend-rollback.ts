// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D66「编辑重发 = 回退本轮文件改动 + 重新发送」组合动作 · 共享层判定(G-89)。
 *
 * **不新建回退通道(台账明文)**:回退执行体一律回调注入 —— `onRollback` /
 * `onConfirm` 由宿主接既有 checkpoint 通道(D4 `getCheckpointImpact` /
 * `restoreCheckpoint` + `CheckpointRollbackConfirm` 弹层),本模块**只做编排与判态**,
 * 不取数、不触碰 DOM / 网络。
 *
 * 组合动作顺序(任何一步失败即停,且报告停在哪一步,绝不静默继续):
 *   编辑 → 预览 → 确认 → 文件与消息同时回退(回退 → 本地同步 → 替换重发)。
 *
 * 四组失败态逐一落名(每态独立 i18n 键 + 显式渲染位):
 *   editFailed(编辑失败) / rollbackPartial(部分回退) /
 *   syncFailed(本地同步失败) / replaceFailed(替换失败);
 *   另有 rollbackFailed(整体回退失败)作兜底,不与"部分回退"混为一谈。
 *
 * **部分回退警示(本票灵魂)**:`needsPartialRollbackWarning(impact)` ——
 * 当本轮文件改动**未全部被检查点记录**时必须出警示
 * (「部分修改未被检查点完整记录,回退结果可能不完整」同族语义),
 * 全记录 → 不警示;部分记录 → 警示;无改动 → 不警示。
 */

/** 组合动作全相位(取值即 i18n 键片段 `phase.<key>`) */
export const EDIT_RESEND_PHASES = [
  'idle',
  'previewing',
  'confirmed',
  'executing',
  'completed',
  'editFailed',
  'rollbackFailed',
  'rollbackPartial',
  'syncFailed',
  'replaceFailed',
] as const
export type EditResendPhase = (typeof EDIT_RESEND_PHASES)[number]

/** 四组失败态 + 回退失败兜底(独立键 `failure.<key>`,显式渲染位) */
export const EDIT_RESEND_FAILURE_PHASES = [
  'editFailed',
  'rollbackFailed',
  'rollbackPartial',
  'syncFailed',
  'replaceFailed',
] as const
export type EditResendFailurePhase = (typeof EDIT_RESEND_FAILURE_PHASES)[number]

/** 编排步骤(取值即 i18n 键无关,仅用于"停在哪一步"的报告) */
export const EDIT_RESEND_STEPS = ['edit', 'preview', 'confirm', 'rollback', 'sync', 'replace'] as const
export type EditResendStep = (typeof EDIT_RESEND_STEPS)[number]

/** 可落失败态的步骤(preview / confirm 是门,不落失败态) */
export const EDIT_RESEND_FAIL_STEPS = ['edit', 'rollback', 'sync', 'replace'] as const
export type EditResendFailStep = (typeof EDIT_RESEND_FAIL_STEPS)[number]

/** 固定文案键(非层级键,直接取词;与词包 `ai.pane.editResend.<key>` 对齐) */
export const EDIT_RESEND_FIXED_KEYS = [
  'title',
  'ariaLabel',
  'desc',
  'confirm',
  'cancel',
  'previewFilesTitle',
  'previewEditTitle',
  'fileRecorded',
  'fileUnrecorded',
  'previewFilesMore',
  'detailAction',
  'detailLabel',
] as const
export type EditResendFixedKey = (typeof EDIT_RESEND_FIXED_KEYS)[number]

/** 部分回退警示键(`ai.pane.editResend.warning.partialRollback`) */
export const EDIT_RESEND_WARNING_KEY = 'warning.partialRollback'

/** 编辑内容为空哨兵:`error` 取值 —— 编辑文本纯空白时判 `editFailed`,不进入预览 */
export const EDIT_RESEND_EMPTY_DRAFT = 'emptyDraft'

/** 本轮单个文件改动( recorded = 是否被检查点记录,部分回退警示的判据) */
export interface EditResendImpactFile {
  readonly path: string
  readonly recorded: boolean
  readonly added?: number
  readonly deleted?: number
}

/** 组合动作的影响面(宿主经既有 getCheckpointImpact 通道映射而来,判定层不取数) */
export interface EditResendImpact {
  readonly checkpointId: string | null
  readonly files: readonly EditResendImpactFile[]
  /** 要重发的编辑文本 */
  readonly editDraft: string
}

/** 预览视图:要回退的文件清单 + 要重发的编辑文本 */
export interface EditResendPreview {
  readonly files: readonly EditResendImpactFile[]
  readonly fileCount: number
  readonly unrecordedCount: number
  readonly editDraft: string
  readonly partialRollbackWarning: boolean
}

/** 回退执行体的结果(宿主接既有 checkpoint 回退通道后上报) */
export type EditResendRollbackResult =
  | { readonly kind: 'ok'; readonly rolledBackFiles: number }
  | { readonly kind: 'partial'; readonly rolledBackFiles: number; readonly unrecordedFiles: number }
  | { readonly kind: 'failed'; readonly error?: string | null }

/** 判定层动作上下文(宿主持有的输入;判定层只读,不取数) */
export interface EditResendActionContext {
  /** 既有 checkpoint 影响通道取回的影响面;未取到(加载中 / 失败)为 null */
  readonly impact: EditResendImpact | null
}

/** 组合动作状态 */
export interface EditResendState {
  readonly phase: EditResendPhase
  readonly preview: EditResendPreview | null
  readonly impact: EditResendImpact | null
  readonly rolledBackFiles: number
  readonly stoppedAt: EditResendStep | null
  readonly error: string | null
}

const PHASE_SET: ReadonlySet<string> = new Set<string>(EDIT_RESEND_PHASES)
const FAILURE_SET: ReadonlySet<EditResendPhase> = new Set<EditResendPhase>(EDIT_RESEND_FAILURE_PHASES)

/** 是否为合法相位之一(相位会经宿主往返,调用方需可校验) */
export function isEditResendPhase(value: string): value is EditResendPhase {
  return PHASE_SET.has(value)
}

/** 相位 → i18n 键名(`ai.pane.editResend.phase.<key>`) */
export function editResendPhaseKey(phase: EditResendPhase): string {
  return `phase.${phase}`
}

/** 失败态 → i18n 键名(`ai.pane.editResend.failure.<key>`);非失败态在编译期即被拒绝 */
export function editResendFailureKey(phase: EditResendFailurePhase): string {
  return `failure.${phase}`
}

/** 固定文案键 → 键名(`ai.pane.editResend.<key>`,键名即取值) */
export function editResendFixedKey(key: EditResendFixedKey): string {
  return key
}

/** 是否为失败态(四组失败态 + 回退失败兜底) */
export function isEditResendFailurePhase(phase: EditResendPhase): phase is EditResendFailurePhase {
  return FAILURE_SET.has(phase)
}

/** 步骤 → 失败态相位(switch 穷尽零 default;preview / confirm 是门,不在名单) */
export function failStepToPhase(step: EditResendFailStep): EditResendFailurePhase {
  switch (step) {
    case 'edit':
      return 'editFailed'
    case 'rollback':
      return 'rollbackFailed'
    case 'sync':
      return 'syncFailed'
    case 'replace':
      return 'replaceFailed'
  }
  return assertNeverFailStep(step)
}

function assertNeverFailStep(step: never): never {
  throw new Error(`unhandled edit-resend fail step: ${String(step)}`)
}

/**
 * 部分回退警示(本票灵魂):本轮文件改动**未全部被检查点记录**时必须警示。
 *   · 全记录(recorded 全 true)→ false,不警示;
 *   · 部分记录(存在 recorded === false)→ true,警示;
 *   · 无改动(空清单)/ 未取到影响面(null)→ false,无可回退之物不虚警。
 */
export function needsPartialRollbackWarning(impact: EditResendImpact | null): boolean {
  if (!impact) return false
  if (impact.files.length === 0) return false
  return impact.files.some((f) => !f.recorded)
}

/** 预览视图:要回退的文件清单 + 要重发的编辑文本;无影响面 → null */
export function previewView(impact: EditResendImpact | null): EditResendPreview | null {
  if (!impact) return null
  const unrecordedCount = impact.files.filter((f) => !f.recorded).length
  return {
    files: impact.files,
    fileCount: impact.files.length,
    unrecordedCount,
    editDraft: impact.editDraft,
    partialRollbackWarning: needsPartialRollbackWarning(impact),
  }
}

/** 构造初始状态(idle) */
export function createEditResendState(): EditResendState {
  return {
    phase: 'idle',
    preview: null,
    impact: null,
    rolledBackFiles: 0,
    stoppedAt: null,
    error: null,
  }
}

/** 组合动作输入(动作 id 即语义,各端自取词) */
export type EditResendAction =
  | { readonly type: 'startPreview' }
  | { readonly type: 'confirm' }
  | { readonly type: 'cancel' }
  | { readonly type: 'execute' }
  | { readonly type: 'rollbackDone'; readonly result: EditResendRollbackResult }
  | { readonly type: 'replaceDone' }
  | { readonly type: 'fail'; readonly step: EditResendFailStep; readonly error?: string | null }

/**
 * 唯一状态迁移函数。`switch` **穷尽全部动作且无 default** —— 新增动作类型时编译器直接报错。
 * 非法迁移(如 executing 中途 restartPreview)一律原样返回,不静默改态。
 */
export function applyEditResendAction(
  state: EditResendState,
  action: EditResendAction,
  ctx: EditResendActionContext,
): EditResendState {
  switch (action.type) {
    case 'startPreview': {
      // 执行中 / 已完成不可重开预览(避免半途回退到预览态造成双写)
      if (state.phase === 'executing' || state.phase === 'completed') return state
      const impact = ctx.impact
      // 编辑内容空 / 纯空白 → 编辑失败,不进入预览(不得让空文本吞掉仅剩的原消息)
      if (!impact || impact.editDraft.trim().length === 0) {
        return { ...state, phase: 'editFailed', error: EDIT_RESEND_EMPTY_DRAFT, stoppedAt: 'edit' }
      }
      return {
        phase: 'previewing',
        preview: previewView(impact),
        impact,
        rolledBackFiles: 0,
        stoppedAt: null,
        error: null,
      }
    }
    case 'confirm': {
      if (state.phase !== 'previewing') return state
      return { ...state, phase: 'confirmed' }
    }
    case 'cancel': {
      // 执行中 / 已完成不可取消(执行体宿主持有,中途取消由宿主通道自己保证)
      if (state.phase === 'executing' || state.phase === 'completed') return state
      return createEditResendState()
    }
    case 'execute': {
      if (state.phase !== 'confirmed') return state
      return { ...state, phase: 'executing', stoppedAt: null, error: null }
    }
    case 'rollbackDone': {
      if (state.phase !== 'executing') return state
      switch (action.result.kind) {
        case 'ok':
          return { ...state, rolledBackFiles: action.result.rolledBackFiles }
        case 'partial':
          // 部分回退 = 失败即停:不继续同步 / 替换,警示"回退结果可能不完整"
          return {
            ...state,
            phase: 'rollbackPartial',
            rolledBackFiles: action.result.rolledBackFiles,
            stoppedAt: 'rollback',
            error: null,
          }
        case 'failed':
          return { ...state, phase: 'rollbackFailed', stoppedAt: 'rollback', error: action.result.error ?? null }
      }
      return assertNeverRollbackResult(action.result)
    }
    case 'replaceDone': {
      if (state.phase !== 'executing') return state
      return { ...state, phase: 'completed', stoppedAt: null, error: null }
    }
    case 'fail': {
      return {
        ...state,
        phase: failStepToPhase(action.step),
        stoppedAt: action.step,
        error: action.error ?? null,
      }
    }
  }
  return assertNeverAction(action)
}

function assertNeverRollbackResult(result: never): never {
  throw new Error(`unhandled rollback result: ${String(result)}`)
}

function assertNeverAction(action: never): never {
  throw new Error(`unhandled edit-resend action: ${String(action)}`)
}

/** 组合编排上下文:回退执行体一律回调注入(宿主接既有 checkpoint 通道),判定层只管编排 */
export interface EditResendComposeContext extends EditResendActionContext {
  /** 编辑落稿(宿主接既有编辑通道);失败 ⇒ editFailed */
  readonly onEditResend: () => Promise<unknown> | unknown
  /** 确认门(宿主接既有 checkpoint-rollback-confirm 弹层);缺省视为直接确认;false ⇒ 干净中止 */
  readonly onConfirm?: () => Promise<boolean> | boolean
  /** 回退执行体(既有 checkpoint 回退通道,不新建通道) */
  readonly onRollback: () => Promise<EditResendRollbackResult> | EditResendRollbackResult
  /** 本地同步(本地消息列表对齐服务端回退结果) */
  readonly onSyncLocal: () => Promise<unknown> | unknown
  /** 替换消息文本并重发 */
  readonly onReplaceMessage: () => Promise<unknown> | unknown
}

/** 组合编排结果:终态 + 停在哪一步(null = 全程走完)+ 是否确认门干净中止 */
export interface EditResendComposeResult {
  readonly state: EditResendState
  readonly stoppedAt: EditResendStep | null
  readonly aborted: boolean
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * 组合执行编排:编辑 → 预览 → 确认 → 文件与消息同时回退(回退 → 本地同步 → 替换重发)。
 * **任何一步失败即停且报告到哪一步**(stoppedAt),绝不静默继续。
 */
export async function composeEditResend(ctx: EditResendComposeContext): Promise<EditResendComposeResult> {
  let state = createEditResendState()
  const run = (action: EditResendAction) => {
    state = applyEditResendAction(state, action, ctx)
  }
  const finish = (stoppedAt: EditResendStep | null, aborted: boolean): EditResendComposeResult => ({
    state,
    stoppedAt,
    aborted,
  })

  // ① 编辑:落稿失败 ⇒ editFailed
  try {
    await ctx.onEditResend()
  } catch (e) {
    run({ type: 'fail', step: 'edit', error: errorMessage(e) })
    return finish('edit', false)
  }

  // ② 预览:编辑内容空(或影响面未取到)在状态机内判 editFailed,同样算编辑步失败
  run({ type: 'startPreview' })
  if (state.phase === 'editFailed') return finish('edit', false)

  // ③ 确认:确认门拒绝 ⇒ 干净中止(不是失败)
  if (ctx.onConfirm) {
    const ok = await ctx.onConfirm()
    if (!ok) {
      run({ type: 'cancel' })
      return finish('confirm', true)
    }
  }
  run({ type: 'confirm' })
  run({ type: 'execute' })

  // ④ 回退(文件与消息同时):整体失败 / 部分回退都即停
  let rollbackResult: EditResendRollbackResult
  try {
    rollbackResult = await ctx.onRollback()
  } catch (e) {
    rollbackResult = { kind: 'failed', error: errorMessage(e) }
  }
  run({ type: 'rollbackDone', result: rollbackResult })
  if (state.phase !== 'executing') return finish('rollback', false)

  // ⑤ 本地同步
  try {
    await ctx.onSyncLocal()
  } catch (e) {
    run({ type: 'fail', step: 'sync', error: errorMessage(e) })
    return finish('sync', false)
  }

  // ⑥ 替换消息并重发
  try {
    await ctx.onReplaceMessage()
  } catch (e) {
    run({ type: 'fail', step: 'replace', error: errorMessage(e) })
    return finish('replace', false)
  }
  run({ type: 'replaceDone' })
  return finish(null, false)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
