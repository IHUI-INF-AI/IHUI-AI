// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​​‌​‌‍‍​‌​​​​​‌‍‍​‌​​​‌​‌‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  TARGET_ERROR_KEYS,
  THRESHOLD_ERROR_KEYS,
  type AutoTopupImmediateFailure,
} from '@ihui/shared/chat/auto-topup'

import { AutoTopupSettings } from '../auto-topup-settings'

// 只断言**结构与判据**(确认门 / 校验错误 / aria / 失败恢复出路),文案一律走 key,
// 真实文案覆盖由下面「读真实词包」那组用例守住 —— 组件测试不依赖文案措辞变动。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const DEFAULT_SETTINGS = { enabled: false, targetCredits: '200', thresholdCredits: '50' }

function switchOf(container: HTMLElement): HTMLButtonElement {
  const el = container.querySelector('[data-auto-topup-switch="true"]')
  if (!(el instanceof HTMLButtonElement)) throw new Error('switch button not found')
  return el
}

describe('D100 AutoTopupSettings / 确认门(硬判据)', () => {
  it('关→开:只打开确认框,不发请求、不翻转 enabled(跳过确认不得触发 enable)', () => {
    const onAction = vi.fn()
    const { container } = render(
      <AutoTopupSettings settings={DEFAULT_SETTINGS} onAction={onAction} />,
    )
    fireEvent.click(switchOf(container))
    expect(container.querySelector('[data-dialog="enable"]')).not.toBeNull()
    expect(container.querySelector('[data-enabled]')?.getAttribute('data-enabled')).toBe('false')
    expect(onAction).not.toHaveBeenCalled()
  })

  it('取消确认框 → 无任何请求发出,回到非确认态', () => {
    const onAction = vi.fn()
    const { container } = render(
      <AutoTopupSettings settings={DEFAULT_SETTINGS} onAction={onAction} />,
    )
    fireEvent.click(switchOf(container))
    const cancel = container.querySelector('[data-dialog-cancel="true"]') as HTMLButtonElement
    fireEvent.click(cancel)
    expect(container.querySelector('[data-dialog]')).toBeNull()
    expect(onAction).not.toHaveBeenCalled()
    expect(container.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('idle')
  })

  it('确认放行 → 才发 requestEnable(恰好一次),回灌 enableSuccess 后 enabled 翻转', () => {
    const onAction = vi.fn()
    const { container, rerender } = render(
      <AutoTopupSettings settings={DEFAULT_SETTINGS} onAction={onAction} />,
    )
    fireEvent.click(switchOf(container))
    const confirm = container.querySelector('[data-dialog-confirm="true"]') as HTMLButtonElement
    fireEvent.click(confirm)
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith('requestEnable')
    expect(container.querySelector('[data-dialog]')).toBeNull()
    // 同实例回灌宿主结果(nonce 变化驱动)
    rerender(
      <AutoTopupSettings
        settings={DEFAULT_SETTINGS}
        onAction={onAction}
        result={{ action: 'enableSuccess', nonce: 1 }}
      />,
    )
    expect(container.querySelector('[data-enabled]')?.getAttribute('data-enabled')).toBe('true')
    expect(container.querySelector('[data-result="enable.success"]')).not.toBeNull()
    expect(container.querySelector('[data-result="enable.error"]')).toBeNull()
  })

  it('enableError 回灌 → failed 相 + enable.error 结果行,enabled 保持 false', () => {
    const onAction = vi.fn()
    const { container, rerender } = render(
      <AutoTopupSettings settings={DEFAULT_SETTINGS} onAction={onAction} />,
    )
    fireEvent.click(switchOf(container))
    fireEvent.click(container.querySelector('[data-dialog-confirm="true"]') as HTMLButtonElement)
    rerender(
      <AutoTopupSettings
        settings={DEFAULT_SETTINGS}
        onAction={onAction}
        result={{ action: 'enableError', nonce: 1 }}
      />,
    )
    expect(container.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('failed')
    expect(container.querySelector('[data-result="enable.error"]')).not.toBeNull()
    expect(container.querySelector('[data-enabled]')?.getAttribute('data-enabled')).toBe('false')
  })

  it('关闭(true→false)无确认框:requestDisable 立即发出;disableSuccess 回灌后翻回 false', () => {
    const onAction = vi.fn()
    const { container, rerender } = render(
      <AutoTopupSettings
        settings={{ ...DEFAULT_SETTINGS, enabled: true }}
        onAction={onAction}
      />,
    )
    fireEvent.click(switchOf(container))
    expect(container.querySelector('[data-dialog]')).toBeNull()
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith('requestDisable')
    rerender(
      <AutoTopupSettings
        settings={{ ...DEFAULT_SETTINGS, enabled: true }}
        onAction={onAction}
        result={{ action: 'disableSuccess', nonce: 1 }}
      />,
    )
    expect(container.querySelector('[data-enabled]')?.getAttribute('data-enabled')).toBe('false')
    expect(container.querySelector('[data-result="disable.success"]')).not.toBeNull()
  })

  it('已开启改参数(涉及自动扣款)→ save 必过确认门(dialog=update),确认后才发 requestSave', () => {
    const onAction = vi.fn()
    const { container, rerender } = render(
      <AutoTopupSettings
        settings={{ ...DEFAULT_SETTINGS, enabled: true }}
        maximumCredits={1000}
        onAction={onAction}
      />,
    )
    const save = container.querySelector('[data-action="save"]') as HTMLButtonElement
    expect(save).not.toBeNull()
    fireEvent.click(save)
    expect(onAction).not.toHaveBeenCalled()
    expect(container.querySelector('[data-dialog="update"]')).not.toBeNull()
    const confirm = container.querySelector('[data-dialog-confirm="true"]') as HTMLButtonElement
    fireEvent.click(confirm)
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith('requestSave')
    rerender(
      <AutoTopupSettings
        settings={{ ...DEFAULT_SETTINGS, enabled: true }}
        maximumCredits={1000}
        onAction={onAction}
        result={{ action: 'save', nonce: 1 }}
      />,
    )
    expect(container.querySelector('[data-result="save.success"]')).not.toBeNull()
  })

  it('saveError 回灌 → failed 相 + save.error 结果行', () => {
    const onAction = vi.fn()
    const { container, rerender } = render(
      <AutoTopupSettings
        settings={{ ...DEFAULT_SETTINGS, enabled: true }}
        maximumCredits={1000}
        onAction={onAction}
      />,
    )
    fireEvent.click(container.querySelector('[data-action="save"]') as HTMLButtonElement)
    fireEvent.click(container.querySelector('[data-dialog-confirm="true"]') as HTMLButtonElement)
    rerender(
      <AutoTopupSettings
        settings={{ ...DEFAULT_SETTINGS, enabled: true }}
        maximumCredits={1000}
        onAction={onAction}
        result={{ action: 'saveError', nonce: 1 }}
      />,
    )
    expect(container.querySelector('[data-phase]')?.getAttribute('data-phase')).toBe('failed')
    expect(container.querySelector('[data-result="save.error"]')).not.toBeNull()
  })
})

describe('D100 AutoTopupSettings / 逐字段校验渲染', () => {
  function targetError(value: string, maximumCredits = 1000, threshold = '50'): string | null {
    const { container, unmount } = render(
      <AutoTopupSettings
        settings={{ ...DEFAULT_SETTINGS, targetCredits: value, thresholdCredits: threshold }}
        maximumCredits={maximumCredits}
      />,
    )
    const el = container.querySelector('[data-field-error^="target."]')
    const key = el?.getAttribute('data-field-error') ?? null
    unmount()
    return key
  }

  it('target 反例:missing / wholeNumber / maximum / minimumDifference 逐键在位', () => {
    expect(targetError('')).toBe('target.error.missing')
    expect(targetError('12.5')).toBe('target.error.wholeNumber')
    expect(targetError('1001')).toBe('target.error.maximum')
    // minimumDifference:目标余额(50)必须高于阈值(50)→ 反例
    expect(targetError('50')).toBe('target.error.minimumDifference')
    expect(targetError('49')).toBe('target.error.minimumDifference')
    // 正例:目标余额(60)> 阈值(50)且未超上限 → 无错误
    expect(targetError('60')).toBeNull()
  })

  it('maximum 文案带 {maximumCredits} 插值', () => {
    const { container } = render(
      <AutoTopupSettings
        settings={{ ...DEFAULT_SETTINGS, targetCredits: '9999' }}
        maximumCredits={1000}
      />,
    )
    const el = container.querySelector('[data-field-error="target.error.maximum"]')
    expect(el?.textContent).toContain('"maximumCredits":1000')
  })

  it('threshold 反例:missing / wholeNumber / minimum', () => {
    const cases: Array<[string, string | null]> = [
      ['', 'threshold.error.missing'],
      ['0.5', 'threshold.error.wholeNumber'],
      ['0', 'threshold.error.minimum'],
      ['10', null],
    ]
    for (const [value, expected] of cases) {
      const { container, unmount } = render(
        <AutoTopupSettings settings={{ ...DEFAULT_SETTINGS, thresholdCredits: value }} />,
      )
      const el = container.querySelector('[data-field-error^="threshold."]')
      expect(el?.getAttribute('data-field-error') ?? null, value).toBe(expected)
      unmount()
    }
  })

  it('四个 target 错误键 + 三个 threshold 错误键与判定层常量对齐(不漏键)', () => {
    expect(TARGET_ERROR_KEYS).toEqual([
      'target.error.missing',
      'target.error.wholeNumber',
      'target.error.maximum',
      'target.error.minimumDifference',
    ])
    expect(THRESHOLD_ERROR_KEYS).toEqual([
      'threshold.error.missing',
      'threshold.error.wholeNumber',
      'threshold.error.minimum',
    ])
  })
})

describe('D100 AutoTopupSettings / aria 与价格异步三态', () => {
  it('滑块/输入框必须有名:target / threshold ariaLabel 在位,switch aria-checked 反映状态', () => {
    const { container } = render(
      <AutoTopupSettings settings={DEFAULT_SETTINGS} maximumCredits={1000} />,
    )
    const targetInput = container.querySelector('[data-target-input="true"]') as HTMLInputElement
    const thresholdInput = container.querySelector(
      '[data-threshold-input="true"]',
    ) as HTMLInputElement
    expect(targetInput.getAttribute('aria-label')).toBe('target.ariaLabel')
    expect(thresholdInput.getAttribute('aria-label')).toBe('threshold.ariaLabel')
    expect(switchOf(container).getAttribute('aria-checked')).toBe('false')

    const { container: c2 } = render(
      <AutoTopupSettings settings={{ ...DEFAULT_SETTINGS, enabled: true }} />,
    )
    expect(switchOf(c2).getAttribute('aria-checked')).toBe('true')
  })

  it('价格异步三态:loading / loaded(带插值)/ error 逐条渲染', () => {
    const loading = render(<AutoTopupSettings settings={DEFAULT_SETTINGS} />)
    expect(
      loading.container.querySelector('[data-equivalent="target.equivalent.loading"]'),
    ).not.toBeNull()

    const loaded = render(
      <AutoTopupSettings
        settings={DEFAULT_SETTINGS}
        equivalent={{ phase: 'loaded', creditCount: 500, amount: '¥45.00' }}
      />,
    )
    const loadedEl = loaded.container.querySelector(
      '[data-equivalent="target.equivalent.text"]',
    )
    expect(loadedEl).not.toBeNull()
    expect(loadedEl?.textContent).toContain('"creditCount":500')
    expect(loadedEl?.textContent).toContain('"amount":"¥45.00"')

    const errored = render(
      <AutoTopupSettings
        settings={DEFAULT_SETTINGS}
        equivalent={{ phase: 'error' }}
      />,
    )
    expect(
      errored.container.querySelector('[data-equivalent="target.equivalent.error"]'),
    ).not.toBeNull()
  })
})

describe('D100 AutoTopupSettings / 首充失败恢复(两条动作出路)', () => {
  function assertRecovery(failure: AutoTopupImmediateFailure, expectedKey: string) {
    const onAction = vi.fn()
    const { container } = render(
      <AutoTopupSettings settings={DEFAULT_SETTINGS} failure={failure} onAction={onAction} />,
    )
    expect(container.querySelector(`[data-failure="${expectedKey}"]`)).not.toBeNull()
    const update = container.querySelector(
      '[data-action="updatePaymentMethod"]',
    ) as HTMLButtonElement
    const buy = container.querySelector('[data-action="buyCredits"]') as HTMLButtonElement
    expect(update).not.toBeNull()
    expect(buy).not.toBeNull()
    // 键对结构与词包对齐(本仓不用内嵌标签)
    expect(update.getAttribute('data-recovery-key')).toBe(
      'immediateTopUpFailure.updatePaymentMethod',
    )
    expect(buy.getAttribute('data-recovery-key')).toBe('immediateTopUpFailure.buyCredits')
    fireEvent.click(update)
    fireEvent.click(buy)
    expect(onAction).toHaveBeenCalledWith('updatePaymentMethod')
    expect(onAction).toHaveBeenCalledWith('buyCredits')
  }

  it('amount 形状:带预计金额,两条动作出路可见且可点', () => {
    assertRecovery({ kind: 'amount', amount: '¥45.00' }, 'immediateTopUpFailure.amount')
  })

  it('generic 形状:无金额,同样两条动作出路', () => {
    assertRecovery({ kind: 'generic' }, 'immediateTopUpFailure.generic')
  })
})

describe('D100 词包覆盖(读真实词包,不 mock)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    )

  const readAutoTopUp = (locale: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { wallet?: { autoTopUp?: Record<string, unknown> } }
    const node = parsed.wallet?.autoTopUp
    if (!node) throw new Error(`missing wallet.autoTopUp in ${locale}.json`)
    return node
  }

  it('五语言键集完全一致(parity),且为 35 键', () => {
    const base = flat(readAutoTopUp('zh-CN')).sort()
    expect(base.length).toBe(35)
    for (const locale of LOCALES) {
      expect(flat(readAutoTopUp(locale)).sort(), locale).toEqual(base)
    }
  })

  it('任务原文 31 键形状全齐:开关四态 / 保存 / 确认框 / 逐字段错误与 helper / 价格三态 / aria / 首充失败', () => {
    const required = [
      'enable.success',
      'enable.error',
      'disable.success',
      'disable.error',
      'save.success',
      'save.error',
      'save.action',
      'dialog.title',
      'dialog.description',
      'dialog.confirm',
      'dialog.cancel',
      'target.helper',
      'target.ariaLabel',
      ...TARGET_ERROR_KEYS,
      'target.equivalent.loading',
      'target.equivalent.text',
      'target.equivalent.error',
      'threshold.helper',
      'threshold.ariaLabel',
      ...THRESHOLD_ERROR_KEYS,
      'immediateTopUpFailure.title',
      'immediateTopUpFailure.amount',
      'immediateTopUpFailure.generic',
      'immediateTopUpFailure.updatePaymentMethod',
      'immediateTopUpFailure.buyCredits',
    ]
    for (const locale of LOCALES) {
      const keys = flat(readAutoTopUp(locale))
      for (const key of required) {
        expect(keys, `${locale} ${key}`).toContain(key)
      }
    }
  })

  it('所有语言取值非空(不得留空串占位)', () => {
    for (const locale of LOCALES) {
      const walk = (obj: Record<string, unknown>): void => {
        for (const value of Object.values(obj)) {
          if (value && typeof value === 'object') walk(value as Record<string, unknown>)
          else expect(typeof value === 'string' && value.trim().length > 0, `${locale}`).toBe(true)
        }
      }
      walk(readAutoTopUp(locale))
    }
  })

  it('zh-CN 关键文案与任务原文逐字一致(防自创措辞)', () => {
    const node = readAutoTopUp('zh-CN') as {
      enable: Record<string, string>
      disable: Record<string, string>
      dialog: Record<string, string>
      target: { error: Record<string, string> }
      immediateTopUpFailure: Record<string, string>
    }
    expect(node.target.error.maximum).toBe('目标余额不得超过 {maximumCredits} 额度')
    expect(node.enable.success).toBe('已开启自动充值')
    expect(node.enable.error).toBe('开启自动充值失败,请稍后重试')
    expect(node.disable.success).toBe('已关闭自动充值')
    expect(node.disable.error).toBe('关闭自动充值失败,请稍后重试')
    expect(node.dialog.title).toBe('确认开启自动充值')
    expect(node.immediateTopUpFailure.updatePaymentMethod).toBe('更新付款方式')
    expect(node.immediateTopUpFailure.buyCredits).toBe('直接购买额度')
  })

  it('ja 无简体中文残留(自动充值语境用「自動チャージ」等日语词)', () => {
    const raw = JSON.stringify(readAutoTopUp('ja'))
    for (const bad of ['充値', '阈值', '额度', '设置', '协作', '概览', '绑定', '预计']) {
      expect(raw.includes(bad), bad).toBe(false)
    }
    expect(raw).toContain('自動チャージ')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​​‌​‌‍‍​‌​​​​​‌‍‍​‌​​​‌​‌‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
