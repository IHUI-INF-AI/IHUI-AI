// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  DISCOUNT_PHASES,
  QUOTA_OWNERSHIP_ACTIONS,
  QUOTA_OWNERSHIP_KINDS,
} from '@ihui/shared/chat/quota-ownership'

import { QuotaOwnershipCard } from '../quota-ownership-card'

// 只断言**结构与判据**(四型标题 / escalate 差异 / 付费动作剔除 / 折扣两态),
// 文案一律走 key;真实文案覆盖由「读真实词包」那组用例守住。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

describe('D67 QuotaOwnershipCard / 四型标题渲染', () => {
  it('四型逐个渲染出 data-quota-kind + 对应标题键', () => {
    for (const kind of QUOTA_OWNERSHIP_KINDS) {
      const { container, unmount } = render(<QuotaOwnershipCard kind={kind} />)
      const title = container.querySelector(`[data-quota-title="${kind}"]`)
      expect(title, kind).not.toBeNull()
      expect(title?.textContent, kind).toBe(`title.${kind}`)
      unmount()
    }
  })

  it('kind=null(归属未知)不渲染 —— 映射不到不硬塞', () => {
    const { container } = render(<QuotaOwnershipCard kind={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('预防性展示(rejectedByQuota=false)不渲染 —— 不充值可用心智:还没拒绝不得推销', () => {
    const { container } = render(<QuotaOwnershipCard kind="personalDaily" rejectedByQuota={false} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('D67 QuotaOwnershipCard / escalate 两类动作差异', () => {
  it('personalDaily:escalate=false,给全三动作(含付费出路 upgradeOrAdmin)', () => {
    const { container } = render(<QuotaOwnershipCard kind="personalDaily" onAction={() => {}} />)
    expect(container.querySelector('[data-quota-kind="personalDaily"]')?.getAttribute('data-quota-escalate')).toBe('false')
    for (const action of QUOTA_OWNERSHIP_ACTIONS) {
      expect(container.querySelector(`[data-action="${action}"]`), action).not.toBeNull()
    }
  })

  it('teamAdmin / billingGroupCredits:escalate=true,不给切档(团队模型由管理员配置)', () => {
    for (const kind of ['teamAdmin', 'billingGroupCredits'] as const) {
      const { container, unmount } = render(<QuotaOwnershipCard kind={kind} onAction={() => {}} />)
      expect(container.querySelector(`[data-quota-kind="${kind}"]`)?.getAttribute('data-quota-escalate'), kind).toBe('true')
      expect(container.querySelector('[data-action="viewUsage"]'), kind).not.toBeNull()
      expect(container.querySelector('[data-action="upgradeOrAdmin"]'), kind).not.toBeNull()
      expect(container.querySelector('[data-action="switchFreeModel"]'), kind).toBeNull()
      unmount()
    }
  })

  it('动作点击回调带上动作 id', () => {
    const onAction = vi.fn()
    const { container } = render(<QuotaOwnershipCard kind="personalDaily" onAction={onAction} />)
    ;(container.querySelector('[data-action="viewUsage"]') as HTMLButtonElement).click()
    ;(container.querySelector('[data-action="switchFreeModel"]') as HTMLButtonElement).click()
    ;(container.querySelector('[data-action="upgradeOrAdmin"]') as HTMLButtonElement).click()
    expect(onAction).toHaveBeenCalledWith('viewUsage')
    expect(onAction).toHaveBeenCalledWith('switchFreeModel')
    expect(onAction).toHaveBeenCalledWith('upgradeOrAdmin')
  })
})

describe('D67 QuotaOwnershipCard / 不充值可用心智(渲染层承接判定层)', () => {
  it('免费档可用:付费动作被判定层剔除 + 渲染降级建议', () => {
    const { container } = render(
      <QuotaOwnershipCard kind="personalDaily" freeTierAvailable onAction={() => {}} />,
    )
    expect(container.querySelector('[data-action="upgradeOrAdmin"]')).toBeNull()
    expect(container.querySelector('[data-action="switchFreeModel"]')).not.toBeNull()
    expect(container.querySelector('[data-quota-degrade-hint="personalDaily"]')).not.toBeNull()
  })

  it('免费档不可用:付费出路保留,不给降级建议(真没得用了,给付费出路不叫诱导)', () => {
    const { container } = render(
      <QuotaOwnershipCard kind="personalDaily" freeTierAvailable={false} onAction={() => {}} />,
    )
    expect(container.querySelector('[data-action="upgradeOrAdmin"]')).not.toBeNull()
    expect(container.querySelector('[data-quota-degrade-hint]')).toBeNull()
  })

  it('escalate 两型免费档可用时联系管理员动作保留,不误伤管理员路径', () => {
    for (const kind of ['teamAdmin', 'billingGroupCredits'] as const) {
      const { container, unmount } = render(
        <QuotaOwnershipCard kind={kind} freeTierAvailable onAction={() => {}} />,
      )
      expect(container.querySelector('[data-action="upgradeOrAdmin"]'), kind).not.toBeNull()
      expect(container.querySelector('[data-quota-degrade-hint]'), kind).toBeNull()
      unmount()
    }
  })
})

describe('D67 QuotaOwnershipCard / 折扣两态', () => {
  const START = Date.UTC(2026, 8, 24, 23, 0, 0)
  const END = START + 2 * 60 * 60 * 1000

  it('active 相位:低峰折扣进行中(data-discount-phase=active)', () => {
    const { container } = render(
      <QuotaOwnershipCard kind="personalDaily" discountWindow={{ windowStart: START, windowEnd: END, now: START }} />,
    )
    const el = container.querySelector('[data-discount-phase="active"]')
    expect(el).not.toBeNull()
    expect(el?.textContent).toBe('discount.active')
  })

  it('upcoming 相位:文案走 discount.upcoming 且注入人类可读时长', () => {
    const { container } = render(
      <QuotaOwnershipCard
        kind="personalDaily"
        discountWindow={{ windowStart: START, windowEnd: END, now: START - 9_000_000 }}
      />,
    )
    const el = container.querySelector('[data-discount-phase="upcoming"]')
    expect(el).not.toBeNull()
    // 剩余 9_000_000ms = 2小时30分;时长由 formatDurationHuman 组装进 {{time}}
    expect(el?.textContent).toBe('discount.upcoming({"time":"2duration.hour30duration.minute"})')
  })

  it('none 相位(窗口外/非法区间)不渲染折扣行', () => {
    const { container } = render(
      <QuotaOwnershipCard
        kind="personalDaily"
        discountWindow={{ windowStart: START, windowEnd: START - 1, now: START }}
      />,
    )
    for (const phase of DISCOUNT_PHASES) {
      expect(container.querySelector(`[data-discount-phase="${phase}"]`), phase).toBeNull()
    }
  })

  it('不传 discountWindow 不渲染折扣行', () => {
    const { container } = render(<QuotaOwnershipCard kind="personalDaily" />)
    expect(container.querySelector('[data-discount-phase]')).toBeNull()
  })
})

describe('D67 词包覆盖(读真实词包,不 mock)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    )

  const readNode = (locale: string, path: 'quotaOwnership' | 'quotaOwnership.voiceSubtitles'): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as { ai?: { pane?: Record<string, unknown> } }
    let node: unknown = parsed.ai?.pane?.quotaOwnership
    if (path === 'quotaOwnership.voiceSubtitles') node = parsed.ai?.pane?.voiceSubtitles
    if (!node) throw new Error(`missing ai.pane.${path} in ${locale}.json`)
    return node as Record<string, unknown>
  }

  it('五语言键集完全一致(parity)', () => {
    const base = flat(readNode('zh-CN', 'quotaOwnership')).sort()
    expect(base.length).toBeGreaterThan(0)
    for (const locale of LOCALES) {
      expect(flat(readNode(locale, 'quotaOwnership')).sort(), locale).toEqual(base)
    }
  })

  it('四型标题 + 三动作 + 折扣两态 + 时长单位 + ariaLabel + 降级建议,键全齐', () => {
    for (const locale of LOCALES) {
      const keys = flat(readNode(locale, 'quotaOwnership'))
      for (const kind of QUOTA_OWNERSHIP_KINDS) expect(keys, `${locale} title.${kind}`).toContain(`title.${kind}`)
      for (const action of QUOTA_OWNERSHIP_ACTIONS) expect(keys, `${locale} action.${action}`).toContain(`action.${action}`)
      expect(keys, `${locale} discount.active`).toContain('discount.active')
      expect(keys, `${locale} discount.upcoming`).toContain('discount.upcoming')
      expect(keys, `${locale} duration.hour`).toContain('duration.hour')
      expect(keys, `${locale} duration.minute`).toContain('duration.minute')
      expect(keys, `${locale} ariaLabel`).toContain('ariaLabel')
      expect(keys, `${locale} degradeHint`).toContain('degradeHint')
    }
  })

  it('所有语言取值非空(不得留空串占位)', () => {
    for (const locale of LOCALES) {
      const walk = (obj: Record<string, unknown>): void => {
        for (const value of Object.values(obj)) {
          if (value && typeof value === 'object') walk(value as Record<string, unknown>)
          else expect(typeof value === 'string' && (value as string).trim().length > 0, `${locale}`).toBe(true)
        }
      }
      walk(readNode(locale, 'quotaOwnership'))
    }
  })

  it('zh-CN 关键文案与台账原文逐字一致(防自创措辞)', () => {
    const node = readNode('zh-CN', 'quotaOwnership') as {
      title: Record<string, string>
      action: Record<string, string>
      discount: Record<string, string>
      degradeHint: string
    }
    expect(node.title.personalDaily).toBe('个人今日额度')
    expect(node.title.freeModelDaily).toBe('免费模型今日额度')
    expect(node.title.teamAdmin).toBe('团队·需管理员')
    expect(node.title.billingGroupCredits).toBe('计费组·Credits 上限')
    expect(node.action.viewUsage).toBe('查看用量明细')
    expect(node.action.switchFreeModel).toBe('切换免费模型')
    expect(node.action.upgradeOrAdmin).toBe('升级或联系管理员')
    expect(node.discount.active).toBe('低峰折扣进行中')
    expect(node.discount.upcoming).toBe('{{time}}后进入低峰折扣')
    expect(node.degradeHint).toContain('无需充值')
  })

  it('防踩踏验证:同批 ai.pane.voiceSubtitles 与 ai.pane.annotationAnchors 键在五语言全部存活', () => {
    for (const locale of LOCALES) {
      const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
      const parsed = JSON.parse(raw) as { ai?: { pane?: Record<string, unknown> } }
      const voice = parsed.ai?.pane?.voiceSubtitles
      const anchors = parsed.ai?.pane?.annotationAnchors
      expect(voice, `${locale} voiceSubtitles`).toBeTruthy()
      expect(anchors, `${locale} annotationAnchors`).toBeTruthy()
      expect(flat(voice as Record<string, unknown>).length, `${locale} voiceSubtitles keys`).toBeGreaterThan(0)
      expect(flat(anchors as Record<string, unknown>).length, `${locale} annotationAnchors keys`).toBeGreaterThan(0)
    }
  })
})
// [tail-watermark-placeholder]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
