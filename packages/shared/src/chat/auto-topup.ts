// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​​‌​‌‍‍​‌​​​​​‌‍‍​‌​​​‌​‌‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D100 计费自助状态机(G-137,2026-09-24 立)—— 自动充值(auto top-up)判定层。
//
// **自证结论(改本文件前先读)**:web 侧此前只有余额展示(`wallet.availableAmount` /
// `useWalletStore`)与充值入口(`wallet.recharge*`),**整条自助链路的开关状态收敛缺失**;
// 全仓(git grep autoTopUp / auto-top-up)无任何既有端点或判定 —— apps/api / ai-service
// 均无 autoTopUp 路由。因此本模块按 D72 worktree-lifecycle 同款「不取数」契约落地:
//   事件由调用方注入(onAction 回调,渲染件自己不 fetch),判定层只做纯收敛。
//
// 三条硬判据(台账 G-137 明文,测试逐条守):
//   1. **确认门**:凡"启用"或"修改后仍涉及自动扣款"必须先出说明性确认对话框 ——
//      `needsConfirm` 为真时跳过确认不得触发 enable/save(负例用例钉死);
//   2. **逐字段校验**:target(threshold 必须 < target 的 minimumDifference 在 target 侧)
//      与 threshold 各自返回 `{ok, errorKey, values}`,错误键与任务原文逐条对齐;
//   3. **价格异步三态** loading/loaded/error 与**首充失败两形状**(amount 带预计金额 /
//      generic),均给两条动作出路(更新付款方式 / 直接购买额度)。
//
// 与 `turn-status.ts` 同范式:常量 + 纯函数 + 穷尽 switch 零 default + `assertNever`。
// 端内不得再建第二套 auto-topup 状态判定(禁止在组件里散写 `phase === 'enabling' ? … : …`)。

/** 计费自助链路七相(取值即 i18n 语义,不直接当文案) */
export const AUTO_TOPUP_PHASES = [
  'idle',
  'confirming',
  'enabling',
  'disabling',
  'saving',
  'succeeded',
  'failed',
] as const
export type AutoTopupPhase = (typeof AUTO_TOPUP_PHASES)[number]

/** 仍在进行中的相(未到终态,UI 应禁用重复提交) */
export const ACTIVE_AUTO_TOPUP_PHASES = ['confirming', 'enabling', 'disabling', 'saving'] as const

/** 终态相 */
export const TERMINAL_AUTO_TOPUP_PHASES = ['succeeded', 'failed'] as const

/** 状态机动作名(穷尽 switch 的判据来源) */
export const AUTO_TOPUP_ACTIONS = [
  'requestEnable',
  'confirm',
  'cancel',
  'enableSuccess',
  'enableError',
  'requestDisable',
  'disableSuccess',
  'disableError',
  'requestSave',
  'save',
  'saveError',
  'dismiss',
] as const
export type AutoTopupActionName = (typeof AUTO_TOPUP_ACTIONS)[number]

/** 动作 → 结果消息键(开关四态 + 保存两态,与任务原文六键逐条对齐;
 *  `save` 在词包按仓内嵌套点路径约定落为 `save.success`) */
export const AUTO_TOPUP_MESSAGE_KEYS = [
  'enable.success',
  'enable.error',
  'disable.success',
  'disable.error',
  'save.success',
  'save.error',
] as const
export type AutoTopupMessageKey = (typeof AUTO_TOPUP_MESSAGE_KEYS)[number]

/** 失败相的错误消息键 */
export const AUTO_TOPUP_ERROR_KEYS = ['enable.error', 'disable.error', 'save.error'] as const
export type AutoTopupErrorKey = (typeof AUTO_TOPUP_ERROR_KEYS)[number]

/** 确认框语义:`enable` = 首次开启;`update` = 已开启改参数(仍涉及自动扣款) */
export const AUTO_TOPUP_DIALOG_CONTEXTS = ['enable', 'update'] as const
export type AutoTopupDialogContext = (typeof AUTO_TOPUP_DIALOG_CONTEXTS)[number]

/** 词包命名空间(web 侧 `useTranslations('wallet.autoTopUp')`) */
export const AUTO_TOPUP_NAMESPACE = 'wallet.autoTopUp' as const

/** 计费自助状态(纯数据,渲染件据此取词) */
export interface AutoTopupState {
  readonly phase: AutoTopupPhase
  /** 已提交(committed)的开关状态;enabling/disabling 途中不变,成功才翻转 */
  readonly enabled: boolean
  readonly dialogOpen: boolean
  readonly dialogContext: AutoTopupDialogContext | null
  readonly errorKey: AutoTopupErrorKey | null
  /** 最近一次终态的结果消息键(判定层所有;新请求发起时清空,dismiss 时清空) */
  readonly messageKey: AutoTopupMessageKey | null
}

/** 动作上下文:`confirm` 动作必须带 `confirmed: true`,否则视为跳过确认而被拒绝 */
export interface AutoTopupActionContext {
  readonly confirmed?: boolean
}

export const INITIAL_AUTO_TOPUP_STATE: AutoTopupState = {
  phase: 'idle',
  enabled: false,
  dialogOpen: false,
  dialogContext: null,
  errorKey: null,
  messageKey: null,
}

const ACTIVE_PHASE_SET: ReadonlySet<string> = new Set<string>(ACTIVE_AUTO_TOPUP_PHASES)

function isBusy(phase: AutoTopupPhase): boolean {
  return ACTIVE_PHASE_SET.has(phase)
}

/** 动作 → 结果消息键(供 UI 在 succeeded/failed 相取词) */
export function autoTopupMessageKey(action: AutoTopupActionName): AutoTopupMessageKey | null {
  switch (action) {
    case 'enableSuccess':
      return 'enable.success'
    case 'enableError':
      return 'enable.error'
    case 'disableSuccess':
      return 'disable.success'
    case 'disableError':
      return 'disable.error'
    case 'save':
      return 'save.success'
    case 'saveError':
      return 'save.error'
    default:
      return null
  }
}

/**
 * 确认门硬判据:凡"启用"(关→开)或"修改后仍涉及自动扣款"(开着改参数)必须先出
 * 说明性确认对话框;只有"关闭"(开→关)不涉及扣款、无需确认。
 * **跳过确认不得触发 enable** —— 由 `applyAutoTopupAction` 的 confirm 分支强制。
 */
export function needsConfirm(settings: {
  readonly currentEnabled: boolean
  readonly nextEnabled: boolean
}): boolean {
  return settings.nextEnabled === true
}

/**
 * 七相状态机唯一派发点。switch 穷尽十二动作、**无 default**:
 * 漏改任一动作 ⇒ 收窄失败,`assertNeverAction` 处编译拦截。
 *
 * 非法迁移(相不符 / 确认门被跳过)一律**原样返回**(状态不得被污染,
 * `enabled` 只能在 confirm 门放行后的 enableSuccess 里翻转)。
 */
export function applyAutoTopupAction(
  state: AutoTopupState,
  action: AutoTopupActionName,
  ctx?: AutoTopupActionContext,
): AutoTopupState {
  switch (action) {
    case 'requestEnable':
      // 开关拨向"开":必须先进确认框,不得直接 enabling。忙时忽略重复触发。
      if (state.enabled || isBusy(state.phase)) return state
      return {
        ...state,
        phase: 'confirming',
        dialogOpen: true,
        dialogContext: 'enable',
        errorKey: null,
        messageKey: null,
      }
    case 'confirm': {
      // **确认门硬闸**:不在 confirming 相、或未带 confirmed:true(跳过确认)→ 拒绝。
      if (state.phase !== 'confirming' || ctx?.confirmed !== true) return state
      if (state.dialogContext === 'enable') {
        return { ...state, phase: 'enabling', dialogOpen: false, dialogContext: null }
      }
      return { ...state, phase: 'saving', dialogOpen: false, dialogContext: null }
    }
    case 'cancel':
      // 关掉确认框,回到空闲,不产生任何副作用(开关状态不变)。
      if (!state.dialogOpen) return state
      return { ...state, phase: 'idle', dialogOpen: false, dialogContext: null }
    case 'enableSuccess':
      // 只有经过确认门放行后的 enabling 相才允许翻转 enabled。
      if (state.phase !== 'enabling') return state
      return { ...state, phase: 'succeeded', enabled: true, messageKey: 'enable.success' }
    case 'enableError':
      if (state.phase !== 'enabling') return state
      return {
        ...state,
        phase: 'failed',
        enabled: false,
        errorKey: 'enable.error',
        messageKey: 'enable.error',
      }
    case 'requestDisable':
      // 关闭不涉及扣款,无需确认;已关闭或忙时忽略。
      if (!state.enabled || isBusy(state.phase)) return state
      return { ...state, phase: 'disabling', errorKey: null, messageKey: null }
    case 'disableSuccess':
      if (state.phase !== 'disabling') return state
      return { ...state, phase: 'succeeded', enabled: false, messageKey: 'disable.success' }
    case 'disableError':
      if (state.phase !== 'disabling') return state
      return {
        ...state,
        phase: 'failed',
        enabled: true,
        errorKey: 'disable.error',
        messageKey: 'disable.error',
      }
    case 'requestSave': {
      // 已开启时修改参数:仍涉及自动扣款 ⇒ 过确认门(dialogContext 'update')。
      if (isBusy(state.phase)) return state
      const next = { currentEnabled: state.enabled, nextEnabled: state.enabled }
      if (state.enabled && needsConfirm(next)) {
        return {
          ...state,
          phase: 'confirming',
          dialogOpen: true,
          dialogContext: 'update',
          errorKey: null,
          messageKey: null,
        }
      }
      return { ...state, phase: 'saving', errorKey: null, messageKey: null }
    }
    case 'save':
      if (state.phase !== 'saving') return state
      return { ...state, phase: 'succeeded', messageKey: 'save.success' }
    case 'saveError':
      if (state.phase !== 'saving') return state
      return {
        ...state,
        phase: 'failed',
        errorKey: 'save.error',
        messageKey: 'save.error',
      }
    case 'dismiss':
      // 终态回执收起,回到空闲并清错误。
      if (state.phase !== 'succeeded' && state.phase !== 'failed') return state
      return { ...state, phase: 'idle', errorKey: null, messageKey: null }
  }
  return assertNeverAction(action)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverAction(action: never): never {
  throw new Error(`unhandled auto top-up action: ${String(action)}`)
}

// ---------------------------------------------------------------------------
// 逐字段校验(与任务原文错误键逐条对齐)
// ---------------------------------------------------------------------------

export const TARGET_ERROR_KEYS = [
  'target.error.missing',
  'target.error.wholeNumber',
  'target.error.maximum',
  'target.error.minimumDifference',
] as const
export type TargetErrorKey = (typeof TARGET_ERROR_KEYS)[number]

export const THRESHOLD_ERROR_KEYS = [
  'threshold.error.missing',
  'threshold.error.wholeNumber',
  'threshold.error.minimum',
] as const
export type ThresholdErrorKey = (typeof THRESHOLD_ERROR_KEYS)[number]

export interface FieldValidation<TErrorKey extends string> {
  readonly ok: boolean
  /** null = 通过 */
  readonly errorKey: TErrorKey | null
  /** 插值(values 键供词包 `{xx}` 占位) */
  readonly values: Readonly<Record<string, unknown>>
}

const WHOLE_NUMBER_PATTERN = /^\d+$/

function parseWholeNumber(raw: string | number): number | null {
  const text = String(raw).trim()
  if (text.length === 0) return null
  if (!WHOLE_NUMBER_PATTERN.test(text)) return null
  return Number(text)
}

export interface TargetValidationContext {
  /** 目标余额上限(额度数) */
  readonly maximumCredits: number
  /** 当前阈值;> 0 时要求 阈值 < 目标(minimumDifference) */
  readonly currentThreshold: number
}

/**
 * 目标余额逐字段校验。检查顺序:missing → wholeNumber → maximum → minimumDifference。
 * **minimumDifference = 阈值必须 < 目标余额**(threshold < target),正反例钉死在测试里。
 */
export function validateTarget(
  value: string | number,
  ctx: TargetValidationContext,
): FieldValidation<TargetErrorKey> {
  const text = String(value).trim()
  if (text.length === 0) {
    return { ok: false, errorKey: 'target.error.missing', values: {} }
  }
  const parsed = parseWholeNumber(text)
  if (parsed === null) {
    return { ok: false, errorKey: 'target.error.wholeNumber', values: {} }
  }
  if (parsed > ctx.maximumCredits) {
    return { ok: false, errorKey: 'target.error.maximum', values: { maximumCredits: ctx.maximumCredits } }
  }
  if (ctx.currentThreshold > 0 && parsed <= ctx.currentThreshold) {
    return { ok: false, errorKey: 'target.error.minimumDifference', values: {} }
  }
  return { ok: true, errorKey: null, values: { targetCredits: parsed } }
}

export interface ThresholdValidationContext {
  /** 目标余额(仅用于文档语义;cross-check 由 target 侧 minimumDifference 承担) */
  readonly target?: number
}

/**
 * 充值阈值逐字段校验。检查顺序:missing → wholeNumber → minimum(至少 1)。
 * "阈值必须 < 目标余额"由 target 侧 minimumDifference 键承担,不在此重复报错。
 */
export function validateThreshold(
  value: string | number,
  _ctx?: ThresholdValidationContext,
): FieldValidation<ThresholdErrorKey> {
  const text = String(value).trim()
  if (text.length === 0) {
    return { ok: false, errorKey: 'threshold.error.missing', values: {} }
  }
  const parsed = parseWholeNumber(text)
  if (parsed === null) {
    return { ok: false, errorKey: 'threshold.error.wholeNumber', values: {} }
  }
  if (parsed < 1) {
    return { ok: false, errorKey: 'threshold.error.minimum', values: {} }
  }
  return { ok: true, errorKey: null, values: { thresholdCredits: parsed } }
}

// ---------------------------------------------------------------------------
// 价格异步三态
// ---------------------------------------------------------------------------

export const AUTO_TOPUP_EQUIVALENT_PHASES = ['loading', 'loaded', 'error'] as const
export type AutoTopupEquivalentPhase = (typeof AUTO_TOPUP_EQUIVALENT_PHASES)[number]

export interface AutoTopupEquivalentState {
  readonly phase: AutoTopupEquivalentPhase
  /** loaded 相必带:换算出的额度数 */
  readonly creditCount?: number
  /** loaded 相必带:换算出的金额(已格式化的币种串) */
  readonly amount?: string
}

export interface EquivalentView {
  readonly phase: AutoTopupEquivalentPhase
  /** `wallet.autoTopUp` 内的键(`text` = 加载完成的价格换算句) */
  readonly key: 'target.equivalent.loading' | 'target.equivalent.text' | 'target.equivalent.error'
  readonly values: Readonly<Record<string, unknown>>
}

/**
 * 价格换算异步三态 → 取词判据。loaded 相缺 creditCount/amount ⇒ 视为 error
 * (宁可报"获取失败",不得渲染 `undefined`)。
 */
export function equivalentView(state: AutoTopupEquivalentState): EquivalentView {
  switch (state.phase) {
    case 'loading':
      return { phase: state.phase, key: 'target.equivalent.loading', values: {} }
    case 'error':
      return { phase: state.phase, key: 'target.equivalent.error', values: {} }
    case 'loaded':
      if (
        typeof state.creditCount !== 'number' ||
        typeof state.amount !== 'string' ||
        state.amount.length === 0
      ) {
        return { phase: 'error', key: 'target.equivalent.error', values: {} }
      }
      return {
        phase: state.phase,
        key: 'target.equivalent.text',
        values: { creditCount: state.creditCount, amount: state.amount },
      }
  }
  return assertNeverEquivalent(state.phase)
}

function assertNeverEquivalent(state: never): never {
  throw new Error(`unhandled equivalent phase: ${String(state)}`)
}

// ---------------------------------------------------------------------------
// 首充失败恢复(两条动作出路)
// ---------------------------------------------------------------------------

export const AUTO_TOPUP_RECOVERY_ACTIONS = ['updatePaymentMethod', 'buyCredits'] as const
export type AutoTopupRecoveryAction = (typeof AUTO_TOPUP_RECOVERY_ACTIONS)[number]

/** 首充失败两形状:amount(带预计金额)/ generic(无金额) */
export type AutoTopupImmediateFailure =
  | { readonly kind: 'amount'; readonly amount: string }
  | { readonly kind: 'generic' }

export interface FailureRecoveryView {
  readonly kind: 'amount' | 'generic'
  /** `wallet.autoTopUp` 内的消息键 */
  readonly messageKey: 'immediateTopUpFailure.amount' | 'immediateTopUpFailure.generic'
  readonly values: Readonly<Record<string, unknown>>
  /** 两条动作出路(顺序固定:先付款方式,后直接购买) */
  readonly actions: readonly AutoTopupRecoveryAction[]
}

/** 动作出路 → 按钮取词键 */
export function failureActionKey(action: AutoTopupRecoveryAction): string {
  return `immediateTopUpFailure.${action}`
}

/** 首充失败 → 恢复判据;两形状都必须给两条动作出路(不给 = 把用户困死在失败页) */
export function failureRecoveryView(failure: AutoTopupImmediateFailure): FailureRecoveryView {
  switch (failure.kind) {
    case 'amount': {
      const amount = failure.amount
      if (typeof amount !== 'string' || amount.length === 0) {
        // 退化为 generic 形状(不得渲染 `undefined`)。
        return {
          kind: 'generic',
          messageKey: 'immediateTopUpFailure.generic',
          values: {},
          actions: AUTO_TOPUP_RECOVERY_ACTIONS,
        }
      }
      return {
        kind: 'amount',
        messageKey: 'immediateTopUpFailure.amount',
        values: { amount },
        actions: AUTO_TOPUP_RECOVERY_ACTIONS,
      }
    }
    case 'generic':
      return {
        kind: 'generic',
        messageKey: 'immediateTopUpFailure.generic',
        values: {},
        actions: AUTO_TOPUP_RECOVERY_ACTIONS,
      }
  }
  return assertNeverFailure(failure)
}

function assertNeverFailure(failure: never): never {
  throw new Error(`unhandled immediate failure kind: ${String(failure)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​​‌​‌‍‍​‌​​​​​‌‍‍​‌​​​‌​‌‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
