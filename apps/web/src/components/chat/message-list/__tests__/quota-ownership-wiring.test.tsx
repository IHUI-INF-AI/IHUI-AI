// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom

// D67 额度归属分型「装车」用例(2026-09-25 立)。
//
// **本文件只测接线,不重测纯函数**:判定层四型/动作族/折扣的语义已由
// `packages/shared/src/chat/__tests__/quota-ownership.test.ts` 与
// `apps/web/src/components/ai/__tests__/quota-ownership-card.test.tsx` 守住。
// 这里断言的是:两个真实渲染宿主(MessageErrorCard / FallbackBanner)在额度型
// 错误下**确实挂载了分型卡**,且分型卡的三个动作出口落到宿主既有接缝上。
// 上一批的失败形态正是"组件在库、生产零消费点",所以断言必须从宿主出发。

import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { MessageErrorCard } from '@/components/chat/message-list/MessageErrorCard'
import { FallbackBanner } from '@/components/chat/message-list/FallbackBanner'
import { FALLBACK_REASON_QUOTA_EQUIVALENT, type FallbackEvent } from '@ihui/api-client'
import type { TFunction } from '@/components/chat/message-list/retry-countdown'

// 分型卡内部走 next-intl 取词;宿主横幅/错误卡则用注入的 t。测试里统一让 useTranslations
// 回显键名,断言只认"键被取到了没",不认文案(真实文案由 card 用例读词包守住)。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// QuotaActionFamily 依赖导航与重登通道:本文件不断言它们的跳转,只断言动作族在位,
// 故把两处端内依赖换成可注入的哑实现(避免 next router 上下文缺失导致的无关失败)。
const navigateMock = vi.fn()
vi.mock('@/stores/navigation', () => ({
  useNavigateWithProgress: () => navigateMock,
}))
vi.mock('@/lib/login-dialog-trigger', () => ({
  openLoginDialogOnce: vi.fn(),
}))

const t: TFunction = (key: string) => key

function renderErrorCard(overrides: Partial<React.ComponentProps<typeof MessageErrorCard>> = {}) {
  return render(
    <MessageErrorCard messageId="m1" content="今日额度已用尽" t={t} quotaError {...overrides} />,
  )
}

function quotaNotice(): FallbackEvent {
  return { primaryModel: 'gpt-a', backupModel: 'gpt-b', reason: FALLBACK_REASON_QUOTA_EQUIVALENT }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('D67 装车:MessageErrorCard 额度型错误挂分型卡', () => {
  it('errorCode=BUDGET_EXHAUSTED → 宿主内出现分型卡,归属为 personalDaily', () => {
    renderErrorCard({ errorCode: 'BUDGET_EXHAUSTED' })
    const card = screen.getByTestId('message-quota-ownership-m1')
    expect(card.getAttribute('data-quota-kind')).toBe('personalDaily')
    // 分型标题由卡自己取词渲染(证明走到了卡,不是宿主拼的字符串)
    expect(card.querySelector('[data-quota-title="personalDaily"]')?.textContent).toBe(
      'title.personalDaily',
    )
  })

  it('型别由 shared 映射决定,不是端内硬编码:三种码各自分型', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['BUDGET_EXHAUSTED', 'personalDaily'],
      ['TRIAL_QUOTA_EXCEEDED', 'personalDaily'],
      ['PROVIDER_QUOTA_EXHAUSTED', 'freeModelDaily'],
    ]
    for (const [errorCode, kind] of cases) {
      const { unmount } = renderErrorCard({ errorCode })
      expect(
        screen.getByTestId('message-quota-ownership-m1').getAttribute('data-quota-kind'),
        errorCode,
      ).toBe(kind)
      unmount()
    }
  })

  it('分型动作族的三个出口分别接到宿主既有接缝(onViewUsage/onSwitchTier/onUpgradePlan)', () => {
    const onViewUsage = vi.fn()
    const onSwitchTier = vi.fn()
    const onUpgradePlan = vi.fn()
    renderErrorCard({
      errorCode: 'BUDGET_EXHAUSTED',
      onViewUsage,
      onSwitchTier,
      onUpgradePlan,
    })
    const card = screen.getByTestId('message-quota-ownership-m1')
    for (const action of ['viewUsage', 'switchFreeModel', 'upgradeOrAdmin'] as const) {
      fireEvent.click(card.querySelector(`[data-action="${action}"]`) as HTMLButtonElement)
    }
    expect(onViewUsage).toHaveBeenCalledTimes(1)
    expect(onSwitchTier).toHaveBeenCalledTimes(1)
    expect(onUpgradePlan).toHaveBeenCalledTimes(1)
  })

  it('一枚动作接缝都没注入 → 分型标题照常上屏,但不摆无响应的按钮', () => {
    renderErrorCard({ errorCode: 'BUDGET_EXHAUSTED' })
    const card = screen.getByTestId('message-quota-ownership-m1')
    expect(card.querySelector('[data-quota-title="personalDaily"]')).not.toBeNull()
    expect(card.querySelector('[data-action]')).toBeNull()
  })

  it('心智边界不回退:免费档可用时剔除付费出路,但查看用量/切档仍在,且给降级建议', () => {
    renderErrorCard({
      errorCode: 'BUDGET_EXHAUSTED',
      freeTierAvailable: true,
      onViewUsage: vi.fn(),
      onSwitchTier: vi.fn(),
      onUpgradePlan: vi.fn(),
    })
    const card = screen.getByTestId('message-quota-ownership-m1')
    expect(card.querySelector('[data-action="upgradeOrAdmin"]')).toBeNull()
    expect(card.querySelector('[data-action="viewUsage"]')).not.toBeNull()
    expect(card.querySelector('[data-action="switchFreeModel"]')).not.toBeNull()
    expect(card.querySelector('[data-quota-degrade-hint="personalDaily"]')).not.toBeNull()
    // 下方 D39 动作族的免费提示同样在位(两条链共用同一判据,不得一条松一条紧)
    expect(screen.getByTestId('quota-action-free-hint')).not.toBeNull()
  })

  it('分型卡不顶掉 D39 六动作:补积分/升级套餐/切档/查看用量/重登/重试同屏可达', () => {
    renderErrorCard({
      errorCode: 'BUDGET_EXHAUSTED',
      freeTierAvailable: false,
      onRetry: vi.fn(),
      onSwitchTier: vi.fn(),
    })
    expect(screen.getByTestId('message-quota-ownership-m1')).not.toBeNull()
    for (const testId of [
      'quota-action-add-points',
      'quota-action-upgrade-plan',
      'quota-action-switch-tier',
      'quota-action-view-usage',
      'quota-action-relogin',
      'message-retry-m1',
    ] as const) {
      expect(screen.queryByTestId(testId), testId).not.toBeNull()
    }
  })

  it('非额度型 errorCode(限流)与 quotaError=false 都不上分型卡,动作族/重试不受影响', () => {
    const { unmount } = renderErrorCard({ errorCode: 'RATE_LIMITED' })
    expect(screen.queryByTestId('message-quota-ownership-m1')).toBeNull()
    expect(screen.getByTestId('quota-action-family')).not.toBeNull()
    unmount()

    render(
      <MessageErrorCard
        messageId="m2"
        content="上游 500"
        t={t}
        errorCode="BUDGET_EXHAUSTED"
        quotaError={false}
      />,
    )
    expect(screen.queryByTestId('message-quota-ownership-m2')).toBeNull()
    expect(screen.getByTestId('message-error-card-m2')).not.toBeNull()
  })

  it('无 errorCode 的旧调用形态完全不变(向后兼容:无分型卡,仍有动作族)', () => {
    renderErrorCard()
    expect(screen.queryByTestId('message-quota-ownership-m1')).toBeNull()
    expect(screen.getByTestId('quota-action-family')).not.toBeNull()
  })
})

describe('D67 装车:FallbackBanner(生产已挂载宿主)挂分型卡', () => {
  it('reason=quota_equivalent → 分型卡在横幅内上屏,归属 freeModelDaily(经 shared 映射)', () => {
    render(<FallbackBanner fallbackNotice={quotaNotice()} t={t} freeTierAvailable={false} />)
    const card = screen.getByTestId('fallback-quota-ownership')
    expect(card.getAttribute('data-quota-kind')).toBe('freeModelDaily')
    expect(card.getAttribute('data-quota-escalate')).toBe('false')
    // 动作族仍在分型卡下方:横幅的四个出口(补积分/升级/查看用量/重登)不因此次接线减少
    expect(screen.getByTestId('quota-action-family')).not.toBeNull()
    expect(screen.getByTestId('quota-action-view-usage')).not.toBeNull()
    expect(screen.getByTestId('quota-action-relogin')).not.toBeNull()
  })

  it('免费档可用:分型卡不给付费出路,横幅同样不给补积分/升级(两条链同判据)', () => {
    render(<FallbackBanner fallbackNotice={quotaNotice()} t={t} freeTierAvailable />)
    const card = screen.getByTestId('fallback-quota-ownership')
    expect(card.querySelector('[data-action]')).toBeNull()
    expect(screen.queryByTestId('quota-action-add-points')).toBeNull()
    expect(screen.queryByTestId('quota-action-upgrade-plan')).toBeNull()
    expect(screen.getByTestId('quota-action-view-usage')).not.toBeNull()
  })

  it('普通降级(reason=timeout)不挂分型卡也不挂额度动作族(旧横幅形态不变)', () => {
    render(
      <FallbackBanner
        fallbackNotice={{ primaryModel: 'gpt-a', backupModel: 'gpt-b', reason: 'timeout' }}
        t={t}
      />,
    )
    expect(screen.queryByTestId('fallback-quota-ownership')).toBeNull()
    expect(screen.queryByTestId('quota-action-family')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
