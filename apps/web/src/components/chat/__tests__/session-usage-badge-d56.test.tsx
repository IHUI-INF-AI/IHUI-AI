// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D56 额度与权益元素族 · session-usage-badge 渲染位用例(2026-09-23 立,英文过渡):
// 覆盖 ②速通徽章 ③计费口径(token/per_request) ④企业四分账 + 心智边界(免费仍可用,不暗示充值)。
// 取词全部走英文过渡 fallback(mock next-intl 恒返 key),Tooltip mock 为内联渲染以断 hover 明细。
// 词表释放后换中文键时同步改回中文断言(见 D56 键清单)。

import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      key,
  useLocale: () => 'zh-CN',
}))

vi.mock('@ihui/api-client', () => ({
  getAgentTokenUsage: vi.fn(),
  getTokenBalance: vi.fn(),
  getModelPriceCny: vi.fn(),
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({
    content,
    children,
  }: {
    content: React.ReactNode
    children: React.ReactNode
  }): React.ReactElement => (
    <div>
      {children}
      <div data-testid="tooltip-content">{content}</div>
    </div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }): React.ReactElement => (
    <div>{children}</div>
  ),
}))

import { SessionUsageBadge } from '@/components/chat/session-usage-badge'
import { getAgentTokenUsage, getModelPriceCny, getTokenBalance } from '@ihui/api-client'

const mockedUsage = vi.mocked(getAgentTokenUsage)
const mockedBalance = vi.mocked(getTokenBalance)
const mockedPrice = vi.mocked(getModelPriceCny)

function mockBaseline(): void {
  mockedUsage.mockResolvedValue({
    promptTokens: 1000,
    completionTokens: 500,
    totalTokens: 1500,
    requests: 2,
  })
  mockedBalance.mockResolvedValue({ success: false } as unknown as Awaited<
    ReturnType<typeof getTokenBalance>
  >)
  mockedPrice.mockResolvedValue(null)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const FORBIDDEN_RECHARGE_WORDS: string[] = ['充值', '购买', '付费', '升级']

describe('SessionUsageBadge D56 额度与权益元素族', () => {
  it('②速通徽章:isExpressLane → 本体出现速通徽章 + hover 有优先通道明细', async () => {
    mockBaseline()
    render(<SessionUsageBadge conversationId="c1" isStreaming={false} isExpressLane />)
    const badge = await screen.findByTestId('session-usage-express')
    expect(badge.textContent).toContain('Express')
    const tip = screen.getByTestId('tooltip-content')
    expect(tip.textContent).toContain('Express lane active')
    expect(tip.textContent).toContain('no queue')
  })

  it('③计费口径:per_request + 单价 → 本体出现按次与单价,明细透出按次计费', async () => {
    mockBaseline()
    render(
      <SessionUsageBadge
        conversationId="c1"
        isStreaming={false}
        billingMode="per_request"
        perRequestPriceCny={0.08}
      />,
    )
    const mode = await screen.findByTestId('session-usage-billing-mode')
    expect(mode.textContent).toContain('Per request')
    expect(mode.textContent).toContain('0.08')
    const tip = screen.getByTestId('tooltip-content')
    expect(tip.textContent).toContain('Billed per request')
    expect(tip.textContent).toContain('bill is authoritative')
  })

  it('③计费口径:token → 本体出现按 Token,明细透出按 Token 计费', async () => {
    mockBaseline()
    render(<SessionUsageBadge conversationId="c1" isStreaming={false} billingMode="token" />)
    const mode = await screen.findByTestId('session-usage-billing-mode')
    expect(mode.textContent).toContain('Per token')
    const tip = screen.getByTestId('tooltip-content')
    expect(tip.textContent).toContain('Billed per token')
  })

  it('④企业四分账:四账各一行 + 百分比徽章走确定性居中模板', async () => {
    mockBaseline()
    render(
      <SessionUsageBadge
        conversationId="c1"
        isStreaming={false}
        enterpriseUsage={[
          { key: 'personal', used: 500, quota: 1000 },
          { key: 'team', used: 200, quota: 1000 },
          { key: 'free', used: 80, quota: 100 },
          { key: 'billing_group', used: 10, quota: 100 },
        ]}
      />,
    )
    const box = await screen.findByTestId('session-usage-enterprise')
    expect(box).toBeTruthy()
    expect(screen.getByTestId('session-usage-enterprise-summary').textContent).toContain(
      'Enterprise usage',
    )
    for (const key of ['personal', 'team', 'free', 'billing_group']) {
      expect(screen.getByTestId(`session-usage-enterprise-${key}`)).toBeTruthy()
    }
    const percent = screen.getByTestId('session-usage-enterprise-percent-personal')
    expect(percent.textContent).toContain('50%')
    for (const cls of [
      'inline-flex',
      'h-4',
      'min-w-4',
      'items-center',
      'justify-center',
      'leading-none',
      'tabular-nums',
    ]) {
      expect(percent.classList.contains(cls)).toBe(true)
    }
  })

  it('心智边界:有权益元素时明示免费仍可用,且全树不暗示充值', async () => {
    mockBaseline()
    render(
      <SessionUsageBadge
        conversationId="c1"
        isStreaming={false}
        isExpressLane
        billingMode="token"
        enterpriseUsage={[{ key: 'personal', used: 10, quota: 100 }]}
      />,
    )
    const hint = await screen.findByTestId('session-usage-free-hint')
    expect(hint.textContent).toContain('Free quota remains available')
    const all = document.body.textContent ?? ''
    for (const w of FORBIDDEN_RECHARGE_WORDS) {
      expect(all).not.toContain(w)
    }
  })

  it('缺省:不传 D56 props → 旧徽章形态,无新徽章无免费提示(负例防假阳性)', async () => {
    mockBaseline()
    render(<SessionUsageBadge conversationId="c1" isStreaming={false} />)
    await screen.findByTestId('session-usage-badge')
    expect(screen.queryByTestId('session-usage-express')).toBeNull()
    expect(screen.queryByTestId('session-usage-billing-mode')).toBeNull()
    expect(screen.queryByTestId('session-usage-enterprise')).toBeNull()
    expect(screen.queryByTestId('session-usage-free-hint')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
