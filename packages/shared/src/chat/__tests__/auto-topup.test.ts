// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D100 计费自助状态机单元测试(G-137,2026-09-24 立):
 * - 七相十二动作逐条迁移 + 穷尽性(switch 无 default);
 * - **确认门硬判据负例**:跳过确认不得触发 enable / save(`enabled` 不得翻转);
 * - 逐字段校验正反例(target 四错误键 + threshold 三错误键,minimumDifference 有正反例);
 * - 价格异步三态(loading/loaded/error;loaded 缺值退化为 error,不得渲染 undefined);
 * - 首充失败两形状(amount 带 {amount} / generic),均给两条动作出路;
 * - 纯函数证明:冻结输入后调用不抛(⇒ 本判定层不可能篡改钱包/订单数据)。
 */
import { describe, expect, it } from 'vitest'

import {
  AUTO_TOPUP_ACTIONS,
  AUTO_TOPUP_EQUIVALENT_PHASES,
  AUTO_TOPUP_MESSAGE_KEYS,
  AUTO_TOPUP_PHASES,
  AUTO_TOPUP_RECOVERY_ACTIONS,
  INITIAL_AUTO_TOPUP_STATE,
  applyAutoTopupAction,
  autoTopupMessageKey,
  equivalentView,
  failureActionKey,
  failureRecoveryView,
  needsConfirm,
  validateTarget,
  validateThreshold,
  type AutoTopupState,
} from '../auto-topup'

function stateAt(
  phase: AutoTopupState['phase'],
  extra: Partial<AutoTopupState> = {},
): AutoTopupState {
  return { ...INITIAL_AUTO_TOPUP_STATE, phase, ...extra }
}

describe('D100 auto-topup 状态机 / 常量与键生成', () => {
  it('七相 + 十二动作常量齐备', () => {
    expect(AUTO_TOPUP_PHASES).toEqual([
      'idle',
      'confirming',
      'enabling',
      'disabling',
      'saving',
      'succeeded',
      'failed',
    ])
    expect(AUTO_TOPUP_ACTIONS.length).toBe(12)
    expect(AUTO_TOPUP_MESSAGE_KEYS).toEqual([
      'enable.success',
      'enable.error',
      'disable.success',
      'disable.error',
      'save.success',
      'save.error',
    ])
  })

  it('autoTopupMessageKey:开关四态 + 保存两态逐条对齐任务原文,其余动作为 null', () => {
    expect(autoTopupMessageKey('enableSuccess')).toBe('enable.success')
    expect(autoTopupMessageKey('enableError')).toBe('enable.error')
    expect(autoTopupMessageKey('disableSuccess')).toBe('disable.success')
    expect(autoTopupMessageKey('disableError')).toBe('disable.error')
    expect(autoTopupMessageKey('save')).toBe('save.success')
    expect(autoTopupMessageKey('saveError')).toBe('save.error')
    for (const action of [
      'requestEnable',
      'confirm',
      'cancel',
      'requestDisable',
      'requestSave',
      'dismiss',
    ] as const) {
      expect(autoTopupMessageKey(action), action).toBeNull()
    }
  })
})

describe('D100 auto-topup 状态机 / 确认门与迁移', () => {
  it('needsConfirm:启用(false→true)与改参数(true→true)必须确认;关闭(true→false)不需要', () => {
    expect(needsConfirm({ currentEnabled: false, nextEnabled: true })).toBe(true)
    expect(needsConfirm({ currentEnabled: true, nextEnabled: true })).toBe(true)
    expect(needsConfirm({ currentEnabled: true, nextEnabled: false })).toBe(false)
    expect(needsConfirm({ currentEnabled: false, nextEnabled: false })).toBe(false)
  })

  it('requestEnable → confirming(弹层开,context=enable),不直接翻转 enabled', () => {
    const next = applyAutoTopupAction(INITIAL_AUTO_TOPUP_STATE, 'requestEnable')
    expect(next.phase).toBe('confirming')
    expect(next.dialogOpen).toBe(true)
    expect(next.dialogContext).toBe('enable')
    expect(next.enabled).toBe(false)
  })

  it('**确认门负例**:confirm 未带 confirmed:true(跳过确认)→ 原样拒绝,不得进入 enabling', () => {
    const opened = applyAutoTopupAction(INITIAL_AUTO_TOPUP_STATE, 'requestEnable')
    const skipped = applyAutoTopupAction(opened, 'confirm') // 无 ctx
    expect(skipped).toBe(opened)
    const skippedFalse = applyAutoTopupAction(opened, 'confirm', { confirmed: false })
    expect(skippedFalse).toBe(opened)
  })

  it('**确认门负例**:非 confirming 相直接 confirm → 拒绝;idle 直发 enableSuccess → enabled 不得翻转', () => {
    expect(applyAutoTopupAction(INITIAL_AUTO_TOPUP_STATE, 'confirm', { confirmed: true })).toBe(
      INITIAL_AUTO_TOPUP_STATE,
    )
    const hacked = applyAutoTopupAction(INITIAL_AUTO_TOPUP_STATE, 'enableSuccess')
    expect(hacked).toBe(INITIAL_AUTO_TOPUP_STATE)
    expect(hacked.enabled).toBe(false)
    expect(hacked.phase).not.toBe('succeeded')
  })

  it('确认放行 → enabling → enableSuccess 才翻转 enabled(完整正路)', () => {
    const opened = applyAutoTopupAction(INITIAL_AUTO_TOPUP_STATE, 'requestEnable')
    const enabling = applyAutoTopupAction(opened, 'confirm', { confirmed: true })
    expect(enabling.phase).toBe('enabling')
    expect(enabling.dialogOpen).toBe(false)
    const done = applyAutoTopupAction(enabling, 'enableSuccess')
    expect(done.phase).toBe('succeeded')
    expect(done.enabled).toBe(true)
    expect(done.messageKey).toBe('enable.success')
  })

  it('enableError → failed 且 enabled 保持 false,errorKey=enable.error;失败相 dismiss 回 idle', () => {
    const opened = applyAutoTopupAction(INITIAL_AUTO_TOPUP_STATE, 'requestEnable')
    const enabling = applyAutoTopupAction(opened, 'confirm', { confirmed: true })
    const failed = applyAutoTopupAction(enabling, 'enableError')
    expect(failed.phase).toBe('failed')
    expect(failed.enabled).toBe(false)
    expect(failed.errorKey).toBe('enable.error')
    expect(failed.messageKey).toBe('enable.error')
    expect(applyAutoTopupAction(failed, 'dismiss').phase).toBe('idle')
  })

  it('关闭链:无需确认,requestDisable → disabling → disableSuccess 翻回 false', () => {
    const enabled = stateAt('idle', { enabled: true })
    const disabling = applyAutoTopupAction(enabled, 'requestDisable')
    expect(disabling.phase).toBe('disabling')
    expect(disabling.dialogOpen).toBe(false)
    const done = applyAutoTopupAction(disabling, 'disableSuccess')
    expect(done.phase).toBe('succeeded')
    expect(done.enabled).toBe(false)
    expect(done.messageKey).toBe('disable.success')
  })

  it('disableError → failed 且 enabled 保持 true,errorKey=disable.error', () => {
    const enabled = stateAt('idle', { enabled: true })
    const failed = applyAutoTopupAction(
      applyAutoTopupAction(enabled, 'requestDisable'),
      'disableError',
    )
    expect(failed.phase).toBe('failed')
    expect(failed.enabled).toBe(true)
    expect(failed.errorKey).toBe('disable.error')
    expect(failed.messageKey).toBe('disable.error')
  })

  it('改参数链(requestSave):已开启 → 必过确认门(context=update),确认后进 saving', () => {
    const enabled = stateAt('idle', { enabled: true })
    const confirming = applyAutoTopupAction(enabled, 'requestSave')
    expect(confirming.phase).toBe('confirming')
    expect(confirming.dialogContext).toBe('update')
    const saving = applyAutoTopupAction(confirming, 'confirm', { confirmed: true })
    expect(saving.phase).toBe('saving')
    const done = applyAutoTopupAction(saving, 'save')
    expect(done.phase).toBe('succeeded')
    expect(done.messageKey).toBe('save.success')
    const savedError = applyAutoTopupAction(
      applyAutoTopupAction(enabled, 'requestSave'),
      'confirm',
      { confirmed: true },
    )
    const saveFailed = applyAutoTopupAction(savedError, 'saveError')
    expect(saveFailed.errorKey).toBe('save.error')
    expect(saveFailed.messageKey).toBe('save.error')
  })

  it('未开启时 requestSave 不涉及自动扣款 → 直接 saving(仍无确认框)', () => {
    const saving = applyAutoTopupAction(INITIAL_AUTO_TOPUP_STATE, 'requestSave')
    expect(saving.phase).toBe('saving')
    expect(saving.dialogOpen).toBe(false)
  })

  it('cancel 只在弹层开着时生效,且不改 enabled / 不产生副作用', () => {
    const opened = applyAutoTopupAction(INITIAL_AUTO_TOPUP_STATE, 'requestEnable')
    const cancelled = applyAutoTopupAction(opened, 'cancel')
    expect(cancelled.phase).toBe('idle')
    expect(cancelled.dialogOpen).toBe(false)
    expect(cancelled.enabled).toBe(false)
    expect(applyAutoTopupAction(INITIAL_AUTO_TOPUP_STATE, 'cancel')).toBe(INITIAL_AUTO_TOPUP_STATE)
  })

  it('忙相防重入:enabling/disabling/saving/confirming 中 requestEnable/requestDisable 一律忽略', () => {
    for (const phase of ['confirming', 'enabling', 'disabling', 'saving'] as const) {
      const busy = stateAt(phase, { enabled: true })
      expect(applyAutoTopupAction(busy, 'requestEnable'), phase).toBe(busy)
      expect(applyAutoTopupAction(busy, 'requestDisable'), phase).toBe(busy)
    }
  })

  it('终态错位迁移一律拒绝(enableSuccess 不得在 disabling 相生效)', () => {
    const disabling = stateAt('disabling', { enabled: true })
    expect(applyAutoTopupAction(disabling, 'enableSuccess')).toBe(disabling)
    const enabling = stateAt('enabling')
    expect(applyAutoTopupAction(enabling, 'disableSuccess')).toBe(enabling)
    expect(applyAutoTopupAction(enabling, 'save')).toBe(enabling)
  })

  it('纯函数:冻结输入后调用不抛', () => {
    const frozen = Object.freeze({ ...INITIAL_AUTO_TOPUP_STATE })
    for (const action of AUTO_TOPUP_ACTIONS) {
      expect(() => applyAutoTopupAction(frozen, action, { confirmed: true })).not.toThrow()
    }
  })
})

describe('D100 auto-topup / 逐字段校验', () => {
  const ctx = { maximumCredits: 1000, currentThreshold: 50 }

  it('target 正例:合法整数 → ok + values.targetCredits', () => {
    const ok = validateTarget(' 200 ', ctx)
    expect(ok.ok).toBe(true)
    expect(ok.errorKey).toBeNull()
    expect(ok.values.targetCredits).toBe(200)
  })

  it('target 反例:missing / wholeNumber(小数、负数、非数字)/ maximum(带 {maximumCredits})', () => {
    expect(validateTarget('', ctx).errorKey).toBe('target.error.missing')
    expect(validateTarget('   ', ctx).errorKey).toBe('target.error.missing')
    expect(validateTarget('12.5', ctx).errorKey).toBe('target.error.wholeNumber')
    expect(validateTarget('-3', ctx).errorKey).toBe('target.error.wholeNumber')
    expect(validateTarget('abc', ctx).errorKey).toBe('target.error.wholeNumber')
    const over = validateTarget('1001', ctx)
    expect(over.errorKey).toBe('target.error.maximum')
    expect(over.values.maximumCredits).toBe(1000)
  })

  it('target **minimumDifference 正反例**:阈值必须 < 目标余额', () => {
    // 正例:目标 > 阈值 → 通过
    expect(validateTarget('51', { maximumCredits: 1000, currentThreshold: 50 }).ok).toBe(true)
    // 反例:目标 == 阈值 / 目标 < 阈值 → 报 minimumDifference
    expect(validateTarget('50', { maximumCredits: 1000, currentThreshold: 50 }).errorKey).toBe(
      'target.error.minimumDifference',
    )
    expect(validateTarget('49', { maximumCredits: 1000, currentThreshold: 50 }).errorKey).toBe(
      'target.error.minimumDifference',
    )
    // 阈值未设(0)时不做该约束
    expect(validateTarget('1', { maximumCredits: 1000, currentThreshold: 0 }).ok).toBe(true)
  })

  it('threshold 正反例:missing / wholeNumber / minimum(至少 1)', () => {
    expect(validateThreshold('').errorKey).toBe('threshold.error.missing')
    expect(validateThreshold('0.5').errorKey).toBe('threshold.error.wholeNumber')
    expect(validateThreshold('x').errorKey).toBe('threshold.error.wholeNumber')
    expect(validateThreshold('0').errorKey).toBe('threshold.error.minimum')
    const ok = validateThreshold('10', { target: 200 })
    expect(ok.ok).toBe(true)
    expect(ok.values.thresholdCredits).toBe(10)
  })
})

describe('D100 auto-topup / 价格异步三态', () => {
  it('三相位逐条派发键与插值', () => {
    expect(AUTO_TOPUP_EQUIVALENT_PHASES).toEqual(['loading', 'loaded', 'error'])
    expect(equivalentView({ phase: 'loading' })).toEqual({
      phase: 'loading',
      key: 'target.equivalent.loading',
      values: {},
    })
    const loaded = equivalentView({ phase: 'loaded', creditCount: 500, amount: '¥45.00' })
    expect(loaded.key).toBe('target.equivalent.text')
    expect(loaded.values).toEqual({ creditCount: 500, amount: '¥45.00' })
    expect(equivalentView({ phase: 'error' })).toEqual({
      phase: 'error',
      key: 'target.equivalent.error',
      values: {},
    })
  })

  it('负例:loaded 缺 creditCount / amount → 退化为 error,不得渲染 undefined', () => {
    expect(equivalentView({ phase: 'loaded' }).key).toBe('target.equivalent.error')
    expect(equivalentView({ phase: 'loaded', creditCount: 500, amount: '' }).key).toBe(
      'target.equivalent.error',
    )
  })
})

describe('D100 auto-topup / 首充失败恢复两形状', () => {
  it('amount 形状:带 {amount} 插值 + 两条动作出路', () => {
    const view = failureRecoveryView({ kind: 'amount', amount: '¥45.00' })
    expect(view.messageKey).toBe('immediateTopUpFailure.amount')
    expect(view.values).toEqual({ amount: '¥45.00' })
    expect(view.actions).toEqual(['updatePaymentMethod', 'buyCredits'])
  })

  it('generic 形状:无插值,同样给两条动作出路', () => {
    const view = failureRecoveryView({ kind: 'generic' })
    expect(view.messageKey).toBe('immediateTopUpFailure.generic')
    expect(view.values).toEqual({})
    expect(view.actions).toEqual(AUTO_TOPUP_RECOVERY_ACTIONS)
  })

  it('负例:amount 形状金额为空串 → 退化为 generic(不得渲染 undefined)', () => {
    expect(failureRecoveryView({ kind: 'amount', amount: '' }).messageKey).toBe(
      'immediateTopUpFailure.generic',
    )
  })

  it('动作出路键生成器与词包键对齐', () => {
    expect(failureActionKey('updatePaymentMethod')).toBe(
      'immediateTopUpFailure.updatePaymentMethod',
    )
    expect(failureActionKey('buyCredits')).toBe('immediateTopUpFailure.buyCredits')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
