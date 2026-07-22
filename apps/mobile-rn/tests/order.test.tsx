/**
 * OrderScreen 订单状态流转测试
 *
 * 覆盖:
 * - 7 种订单状态渲染(pending/paid/cancelled/refunding/refunded/completed/failed)
 * - 多订单列表渲染
 * - 金额格式化
 * - 错误状态 + 空列表
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: {
    getOrders: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => ({
  getOrders: apiMocks.getOrders,
}))

vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t }) }
})

vi.mock('react-native', () => {
  const { createElement } = require('react')
  const mk = (tag: string) =>
    function MockComp(props: { children?: ReactNode; [k: string]: unknown }) {
      return createElement(tag, props, props.children)
    }
  const FlatList = (props: {
    data?: Array<Record<string, unknown>>
    renderItem?: (info: { item: Record<string, unknown> }) => ReactNode
    ListEmptyComponent?: ReactNode
    keyExtractor?: (item: Record<string, unknown>) => string
    [k: string]: unknown
  }) => {
    if (!props.data || props.data.length === 0) return props.ListEmptyComponent || null
    return createElement(
      'div',
      null,
      props.data.map((item, i) =>
        createElement('div', { key: props.keyExtractor?.(item) || i }, props.renderItem?.({ item })),
      ),
    )
  }
  return {
    View: mk('div'),
    Text: mk('span'),
    FlatList,
    StyleSheet: { create: (s: Record<string, unknown>) => s },
  }
})

vi.mock('@ihui/ui-native', () => ({
  Card: (props: { children?: ReactNode }) =>
    createElement('div', null, props.children),
}))

import { OrderScreen } from '../src/screens/OrderScreen'

const mockOrder = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'ord-001',
  orderNo: 'ORD-001',
  targetTitle: '测试课程',
  payAmount: 199.0,
  status: 'pending',
  createdAt: '2025-01-01T10:00:00Z',
  ...overrides,
})

const statuses: Array<[string, string]> = [
  ['pending', 'order.status.pending'],
  ['paid', 'order.status.paid'],
  ['cancelled', 'order.status.cancelled'],
  ['refunding', 'order.status.refunding'],
  ['refunded', 'order.status.refunded'],
  ['completed', 'order.status.completed'],
  ['failed', 'order.status.failed'],
]

describe('OrderScreen 订单状态流转', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  statuses.forEach(([status, expectedKey]) => {
    it(`状态 ${status} 渲染正确状态标签`, async () => {
      apiMocks.getOrders.mockResolvedValue({
        success: true,
        data: { list: [mockOrder({ status })], total: 1 },
      })
      const { getByText } = render(<OrderScreen />)

      await waitFor(() => expect(getByText('测试课程')).toBeTruthy())
      expect(getByText(expectedKey)).toBeTruthy()
    })
  })

  it('多订单列表渲染', async () => {
    apiMocks.getOrders.mockResolvedValue({
      success: true,
      data: {
        list: [
          mockOrder({ id: 'o1', orderNo: 'ORD-1', targetTitle: '课程A' }),
          mockOrder({ id: 'o2', orderNo: 'ORD-2', targetTitle: '课程B' }),
          mockOrder({ id: 'o3', orderNo: 'ORD-3', targetTitle: '课程C' }),
        ],
        total: 3,
      },
    })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText('课程A')).toBeTruthy())
    expect(getByText('课程B')).toBeTruthy()
    expect(getByText('课程C')).toBeTruthy()
    expect(getByText(/ORD-1/)).toBeTruthy()
    expect(getByText(/ORD-2/)).toBeTruthy()
    expect(getByText(/ORD-3/)).toBeTruthy()
  })

  it('金额格式化:两位小数', async () => {
    apiMocks.getOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder({ payAmount: 1234.5 })], total: 1 },
    })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText(/1,234\.50/)).toBeTruthy())
  })

  it('金额为 null 时显示 — 占位符', async () => {
    apiMocks.getOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder({ payAmount: null })], total: 1 },
    })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText('测试课程')).toBeTruthy())
    expect(getByText(/—/)).toBeTruthy()
  })

  it('加载失败:显示错误信息', async () => {
    apiMocks.getOrders.mockResolvedValue({
      success: false,
      error: '服务器错误',
    })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText('服务器错误')).toBeTruthy())
  })

  it('加载失败无 error 字段:使用默认消息', async () => {
    apiMocks.getOrders.mockResolvedValue({ success: false })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText('order.loadFailed')).toBeTruthy())
  })

  it('空列表:显示空状态', async () => {
    apiMocks.getOrders.mockResolvedValue({
      success: true,
      data: { list: [], total: 0 },
    })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText('order.empty')).toBeTruthy())
  })

  it('refunded 状态金额为绿色', async () => {
    apiMocks.getOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder({ status: 'refunded', payAmount: 100 })], total: 1 },
    })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText('测试课程')).toBeTruthy())
    const amount = getByText(/100\.00/)
    expect(amount.className).toContain('text-emerald-600')
  })

  it('非 refunded 状态金额为红色', async () => {
    apiMocks.getOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder({ status: 'pending', payAmount: 100 })], total: 1 },
    })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText('测试课程')).toBeTruthy())
    const amount = getByText(/100\.00/)
    expect(amount.className).toContain('text-red-600')
  })
})
