// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D100 计费自助设置卡(G-137)—— 自动充值(auto top-up)渲染件。
//
// **数据面纪律(与 D72 WorktreeCard 同款,台账 G-137 明文「不取数」契约)**:
// 本卡**不 fetch**。web 侧当前**没有**自动充值数据面(apps/api / ai-service 无任何
// autoTopUp 端点,git grep 自证):开关/保存的真实请求由调用方注入
// (`onAction` 回调),执行结果经 `result` prop 回灌(带 nonce 防重复消费);
// 价格换算三态与首充失败也由调用方以 prop 注入。
//
// **确认门硬判据**:凡"启用"或"修改后仍涉及自动扣款"必须先出说明性确认对话框
// —— 开关拨向"开"只打开确认框;`onAction('requestEnable' | 'requestSave')`
// **只在确认门放行之后**才会发出(跳过确认不得触发 enable,由判定层
// `applyAutoTopupAction` 的 confirm 分支与本卡双重保证)。
// 关闭(true→false)不涉及扣款,无确认框,直接发 `requestDisable`。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  applyAutoTopupAction,
  equivalentView,
  failureActionKey,
  failureRecoveryView,
  validateTarget,
  validateThreshold,
  type AutoTopupActionContext,
  type AutoTopupActionName,
  type AutoTopupEquivalentState,
  type AutoTopupImmediateFailure,
  type AutoTopupRecoveryAction,
  type AutoTopupState,
  type TargetErrorKey,
  type ThresholdErrorKey,
} from '@ihui/shared/chat/auto-topup'

/** 组件 → 宿主动作(数据面请求 + 首充失败两条出路) */
export type AutoTopupUiAction =
  | Extract<AutoTopupActionName, 'requestEnable' | 'requestDisable' | 'requestSave'>
  | AutoTopupRecoveryAction

export interface AutoTopupSettingsProps {
  /** 当前已提交设置(调用方持有;本卡不 fetch) */
  settings?: { enabled: boolean; targetCredits: string; thresholdCredits: string }
  /** 目标余额上限(额度数),校验 maximum 用 */
  maximumCredits?: number
  /** 价格换算异步三态(调用方注入;缺省 = loading) */
  equivalent?: AutoTopupEquivalentState
  /** 首充失败(调用方注入;缺省 = 未发生) */
  failure?: AutoTopupImmediateFailure
  /** 宿主执行结果回灌(带 nonce;本卡消费一次,判定层拒绝错位迁移,双重安全) */
  result?: { action: AutoTopupActionName; nonce: number }
  /** 数据面动作回调。**数据面在调用方**,本卡只负责触发 */
  onAction?: (action: AutoTopupUiAction) => void
  className?: string
  'data-testid'?: string
}

/** 语义色档 → 样式(判定层只给语义,端内只做这一处样式映射) */
const TONE_CLASS: Record<string, string> = {
  neutral: 'text-muted-foreground',
  success: 'text-emerald-600 dark:text-emerald-500',
  danger: 'text-destructive',
}

type DispatchPayload = { action: AutoTopupActionName; ctx?: AutoTopupActionContext }

export function AutoTopupSettings({
  settings,
  maximumCredits = 0,
  equivalent,
  failure,
  result,
  onAction,
  className,
  'data-testid': testId,
}: AutoTopupSettingsProps) {
  const t = useTranslations('wallet.autoTopUp')

  const [state, dispatch] = React.useReducer(
    (state: AutoTopupState, payload: DispatchPayload) =>
      applyAutoTopupAction(state, payload.action, payload.ctx),
    undefined,
    (): AutoTopupState => ({
      phase: 'idle',
      enabled: settings?.enabled ?? false,
      dialogOpen: false,
      dialogContext: null,
      errorKey: null,
      messageKey: null,
    }),
  )
  const [target, setTarget] = React.useState(settings?.targetCredits ?? '')
  const [threshold, setThreshold] = React.useState(settings?.thresholdCredits ?? '')

  // 宿主结果回灌(nonce 变化即消费一次;判定层会拒绝错位迁移,双重安全)
  React.useEffect(() => {
    if (!result) return
    dispatch({ action: result.action })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.nonce])

  const busy =
    state.phase === 'confirming' ||
    state.phase === 'enabling' ||
    state.phase === 'disabling' ||
    state.phase === 'saving'

  const thresholdNumber = Number(threshold.trim())
  const targetValidation = validateTarget(target, {
    maximumCredits,
    currentThreshold: Number.isFinite(thresholdNumber) ? thresholdNumber : 0,
  })
  const thresholdValidation = validateThreshold(threshold)

  const equivalentState = equivalent ?? { phase: 'loading' as const }
  const equivalentInfo = equivalentView(equivalentState)
  const failureInfo = failure ? failureRecoveryView(failure) : null

  function toggleSwitch(): void {
    if (busy) return
    if (state.enabled) {
      // 关闭不涉及扣款:直接发请求,无确认框
      dispatch({ action: 'requestDisable' })
      onAction?.('requestDisable')
      return
    }
    // 开启:只打开确认框;requestEnable 由确认按钮发出(确认门硬判据)
    dispatch({ action: 'requestEnable' })
  }

  function onConfirm(): void {
    // 确认门放行后才向宿主发数据面请求
    if (state.dialogContext === 'enable') onAction?.('requestEnable')
    if (state.dialogContext === 'update') onAction?.('requestSave')
    dispatch({ action: 'confirm', ctx: { confirmed: true } })
  }

  function onSave(): void {
    if (busy || !targetValidation.ok || !thresholdValidation.ok) return
    dispatch({ action: 'requestSave' })
    // 未开启时不涉及自动扣款、无确认门,直接发保存请求;已开启的由确认按钮发出
    if (!state.enabled) onAction?.('requestSave')
  }

  return (
    <div
      role="group"
      aria-label={t('title')}
      className={cn('flex flex-col gap-3 rounded-md bg-muted/30 p-3', className)}
      data-testid={testId}
      data-phase={state.phase}
      data-enabled={String(state.enabled)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-medium">{t('title')}</span>
          <span className="text-[11px] text-muted-foreground">{t('description')}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.enabled}
          aria-label={t('enabled')}
          onClick={toggleSwitch}
          disabled={busy}
          data-auto-topup-switch="true"
        >
          {t('enabled')}
        </button>
      </div>

      {state.messageKey ? (
        <p
          className={cn('text-[11px]', TONE_CLASS[state.phase === 'failed' ? 'danger' : 'success'])}
          data-result={state.messageKey}
        >
          {renderMessageKey(t, state.messageKey)}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium" htmlFor="auto-topup-target">
          {t('target.label')}
        </label>
        <input
          id="auto-topup-target"
          type="text"
          inputMode="numeric"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          aria-label={t('target.ariaLabel')}
          aria-invalid={targetValidation.errorKey !== null}
          data-target-input="true"
          className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
        />
        <p className="text-[11px] text-muted-foreground" data-target-helper="true">
          {t('target.helper')}
        </p>
        {targetValidation.errorKey ? (
          <span
            className="text-[11px] text-destructive"
            data-field-error={targetValidation.errorKey}
            role="alert"
          >
            {renderTargetError(t, targetValidation.errorKey, targetValidation.values)}
          </span>
        ) : null}
        <p className="text-[11px] text-muted-foreground" data-equivalent={equivalentInfo.key}>
          {renderEquivalent(t, equivalentInfo)}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium" htmlFor="auto-topup-threshold">
          {t('threshold.label')}
        </label>
        <input
          id="auto-topup-threshold"
          type="text"
          inputMode="numeric"
          value={threshold}
          onChange={(event) => setThreshold(event.target.value)}
          aria-label={t('threshold.ariaLabel')}
          aria-invalid={thresholdValidation.errorKey !== null}
          data-threshold-input="true"
          className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
        />
        <p className="text-[11px] text-muted-foreground" data-threshold-helper="true">
          {t('threshold.helper')}
        </p>
        {thresholdValidation.errorKey ? (
          <span
            className="text-[11px] text-destructive"
            data-field-error={thresholdValidation.errorKey}
            role="alert"
          >
            {renderThresholdError(t, thresholdValidation.errorKey)}
          </span>
        ) : null}
      </div>

      {state.enabled ? (
        <div>
          <button
            type="button"
            onClick={onSave}
            disabled={busy || !targetValidation.ok || !thresholdValidation.ok}
            data-action="save"
            className="rounded-sm bg-muted/50 px-2 py-1 text-[11px] transition-colors hover:bg-muted"
          >
            {t('save.action')}
          </button>
        </div>
      ) : null}

      {failureInfo ? (
        <div
          role="alert"
          data-failure={failureInfo.messageKey}
          className="flex flex-col gap-1 rounded-sm border border-destructive/30 p-2"
        >
          <span className="text-[11px] font-medium text-destructive">
            {t('immediateTopUpFailure.title')}
          </span>
          <span className="text-[11px] text-destructive">
            {renderFailureMessage(t, failureInfo)}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {failureInfo.actions.map((action) => (
              <button
                key={action}
                type="button"
                data-action={action}
                data-recovery-key={failureActionKey(action)}
                onClick={() => onAction?.(action)}
                className="rounded-sm bg-muted/50 px-1.5 py-0.5 text-[11px] transition-colors hover:bg-muted"
              >
                {action === 'updatePaymentMethod'
                  ? t('immediateTopUpFailure.updatePaymentMethod')
                  : t('immediateTopUpFailure.buyCredits')}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {state.dialogOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('dialog.title')}
          data-dialog={state.dialogContext ?? 'enable'}
          className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-background p-3"
        >
          <span className="text-xs font-medium">{t('dialog.title')}</span>
          <p className="text-[11px] text-muted-foreground">{t('dialog.description')}</p>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              data-dialog-confirm="true"
              onClick={onConfirm}
              className="rounded-sm bg-amber-600/90 px-2 py-1 text-[11px] text-white transition-colors hover:bg-amber-600"
            >
              {t('dialog.confirm')}
            </button>
            <button
              type="button"
              data-dialog-cancel="true"
              onClick={() => dispatch({ action: 'cancel' })}
              className="rounded-sm bg-muted/50 px-2 py-1 text-[11px] transition-colors hover:bg-muted"
            >
              {t('dialog.cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

type Translate = ReturnType<typeof useTranslations>
interface FailureInfo {
  readonly messageKey: 'immediateTopUpFailure.amount' | 'immediateTopUpFailure.generic'
  readonly values: Readonly<Record<string, unknown>>
}
interface EquivalentInfo {
  readonly key: 'target.equivalent.loading' | 'target.equivalent.text' | 'target.equivalent.error'
  readonly values: Readonly<Record<string, unknown>>
}

/** 结果消息键 → 文案(穷尽 switch,静态键,不做动态拼接) */
function renderMessageKey(t: Translate, messageKey: AutoTopupState['messageKey']): string {
  switch (messageKey) {
    case 'enable.success':
      return t('enable.success')
    case 'enable.error':
      return t('enable.error')
    case 'disable.success':
      return t('disable.success')
    case 'disable.error':
      return t('disable.error')
    case 'save.success':
      return t('save.success')
    case 'save.error':
      return t('save.error')
    default:
      return ''
  }
}

/** 目标余额错误键 → 文案(maximum 带 {maximumCredits} 插值) */
function renderTargetError(
  t: Translate,
  errorKey: TargetErrorKey,
  values: Readonly<Record<string, unknown>>,
): string {
  switch (errorKey) {
    case 'target.error.missing':
      return t('target.error.missing')
    case 'target.error.wholeNumber':
      return t('target.error.wholeNumber')
    case 'target.error.maximum':
      return t('target.error.maximum', {
        maximumCredits: values.maximumCredits as string | number,
      })
    case 'target.error.minimumDifference':
      return t('target.error.minimumDifference')
  }
}

/** 阈值错误键 → 文案 */
function renderThresholdError(t: Translate, errorKey: ThresholdErrorKey): string {
  switch (errorKey) {
    case 'threshold.error.missing':
      return t('threshold.error.missing')
    case 'threshold.error.wholeNumber':
      return t('threshold.error.wholeNumber')
    case 'threshold.error.minimum':
      return t('threshold.error.minimum')
  }
}

/** 价格换算三态 → 文案(text 带 {creditCount} 与 {amount} 富文本插值) */
function renderEquivalent(t: Translate, info: EquivalentInfo): string {
  switch (info.key) {
    case 'target.equivalent.loading':
      return t('target.equivalent.loading')
    case 'target.equivalent.error':
      return t('target.equivalent.error')
    case 'target.equivalent.text':
      return t('target.equivalent.text', {
        creditCount: info.values.creditCount as string | number,
        amount: info.values.amount as string | number,
      })
  }
}

/** 首充失败消息(amount 形状带 {amount} 插值) */
function renderFailureMessage(t: Translate, info: FailureInfo): string {
  switch (info.messageKey) {
    case 'immediateTopUpFailure.amount':
      return t('immediateTopUpFailure.amount', { amount: info.values.amount as string | number })
    case 'immediateTopUpFailure.generic':
      return t('immediateTopUpFailure.generic')
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
