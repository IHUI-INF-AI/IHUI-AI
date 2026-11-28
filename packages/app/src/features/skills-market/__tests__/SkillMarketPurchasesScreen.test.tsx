// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TFunction } from '@ihui/types'
import type { SkillMyPurchaseView } from '@ihui/types'
import { SkillMarketPurchasesScreen } from '../SkillMarketPurchasesScreen'

const t = ((key: string) => key) as unknown as TFunction
const colorScheme: 'light' | 'dark' = 'light'

function purchase(overrides: Partial<SkillMyPurchaseView> = {}): SkillMyPurchaseView {
  return {
    id: 'p1',
    skillName: '写作助手',
    priceCents: 100,
    currency: 'CNY',
    status: 'paid',
    createdAt: '2026-11-20T10:00:00.000Z',
    refundedAt: null,
    refundAmountCents: 0,
    refundRequest: null,
    canRequestRefund: true,
    ...overrides,
  }
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    t,
    items: [] as SkillMyPurchaseView[],
    loading: false,
    error: '',
    notice: '',
    submittingId: null,
    onBack: vi.fn(),
    onRetry: vi.fn(),
    onRequestRefund: vi.fn(),
    colorScheme,
    ...overrides,
  }
}

afterEach(cleanup)

describe('SkillMarketPurchasesScreen', () => {
  it('空列表给出“我的购买”空态', () => {
    render(<SkillMarketPurchasesScreen {...baseProps()} />)
    expect(screen.getByText('skillsMarket.myPurchasesEmpty')).toBeTruthy()
  })

  it('展开退款表单后，满 5 字才能提交并回调购买 id 与原因', () => {
    const onRequestRefund = vi.fn()
    render(<SkillMarketPurchasesScreen {...baseProps({ items: [purchase()], onRequestRefund })} />)
    expect(screen.getByText('写作助手')).toBeTruthy()
    fireEvent.click(screen.getByText('skillsMarket.requestRefund'))
    const input = screen.getByPlaceholderText('skillsMarket.refundReasonPlaceholder')
    fireEvent.input(input, { target: { value: '不想用了啊' } })
    fireEvent.click(screen.getByText('skillsMarket.submitRefund'))
    expect(onRequestRefund).toHaveBeenCalledWith('p1', '不想用了啊')
  })

  it('不足 5 字时按钮禁用，不触发回调', () => {
    const onRequestRefund = vi.fn()
    render(<SkillMarketPurchasesScreen {...baseProps({ items: [purchase()], onRequestRefund })} />)
    fireEvent.click(screen.getByText('skillsMarket.requestRefund'))
    fireEvent.input(screen.getByPlaceholderText('skillsMarket.refundReasonPlaceholder'), {
      target: { value: '不退' },
    })
    fireEvent.click(screen.getByText('skillsMarket.submitRefund'))
    expect(onRequestRefund).not.toHaveBeenCalled()
  })

  it('已有待审申请时不出现新的申请按钮', () => {
    render(
      <SkillMarketPurchasesScreen
        {...baseProps({
          items: [
            purchase({
              canRequestRefund: false,
              refundRequest: {
                id: 'r1',
                status: 'pending',
                reason: '买错了',
                reviewNote: null,
                createdAt: '2026-11-21T10:00:00.000Z',
                reviewedAt: null,
              },
            }),
          ],
        })}
      />,
    )
    expect(screen.queryByText('skillsMarket.requestRefund')).toBeNull()
    expect(screen.getByText('skillsMarket.refundPending')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
