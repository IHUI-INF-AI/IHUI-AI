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
    fetchApi: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: apiMocks.fetchApi,
  getOrders: (...args: unknown[]) => apiMocks.fetchApi(...args),
}))

vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t }) }
})

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), goBack: vi.fn() }),
}))

vi.mock('react-native', async () => {
  const { createElement } = await import('react')
  const mk = (tag: string) =>
    function MockComp(props: { children?: ReactNode; [k: string]: unknown }) {
      const { style, onPress, ...rest } = props
      const mergedStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style
      return createElement(tag, { ...rest, onClick: onPress, style: mergedStyle }, props.children)
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
        createElement(
          'div',
          { key: props.keyExtractor?.(item) || i },
          props.renderItem?.({ item }),
        ),
      ),
    )
  }
  return {
    View: mk('div'),
    Text: mk('span'),
    TouchableOpacity: mk('button'),
    ScrollView: mk('div'),
    FlatList,
    RefreshControl: () => null,
    useColorScheme: () => 'light',
    StyleSheet: { create: (s: Record<string, unknown>) => s },
  }
})

vi.mock('@ihui/ui-native', () => ({
  Card: (props: { children?: ReactNode }) => createElement('div', null, props.children),
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
      apiMocks.fetchApi.mockResolvedValue({
        success: true,
        data: { list: [mockOrder({ status })] },
      })
      const { getByText } = render(<OrderScreen />)

      await waitFor(() => expect(getByText('测试课程')).toBeTruthy())
      expect(getByText(expectedKey)).toBeTruthy()
    })
  })

  it('多订单列表渲染', async () => {
    apiMocks.fetchApi.mockResolvedValue({
      success: true,
      data: {
        list: [
          mockOrder({ id: 'o1', orderNo: 'ORD-1', targetTitle: '课程A' }),
          mockOrder({ id: 'o2', orderNo: 'ORD-2', targetTitle: '课程B' }),
          mockOrder({ id: 'o3', orderNo: 'ORD-3', targetTitle: '课程C' }),
        ],
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
    apiMocks.fetchApi.mockResolvedValue({
      success: true,
      data: { list: [mockOrder({ payAmount: 1234.5 })] },
    })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText(/1234\.50/)).toBeTruthy())
  })

  it('金额为 null 时显示 — 占位符', async () => {
    apiMocks.fetchApi.mockResolvedValue({
      success: true,
      data: { list: [mockOrder({ payAmount: null })] },
    })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText('测试课程')).toBeTruthy())
    expect(getByText(/—/)).toBeTruthy()
  })

  it('加载失败:显示错误信息', async () => {
    apiMocks.fetchApi.mockResolvedValue({
      success: false,
      error: '服务器错误',
    })
    const { getByText } = render(<OrderScreen />)

    // wrapper 层 catch 分支总是显示 order.loadFailed
    await waitFor(() => expect(getByText('order.loadFailed')).toBeTruthy())
  })

  it('加载失败无 error 字段:使用默认消息', async () => {
    apiMocks.fetchApi.mockResolvedValue({ success: false })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText('order.loadFailed')).toBeTruthy())
  })

  it('空列表:显示空状态', async () => {
    apiMocks.fetchApi.mockResolvedValue({
      success: true,
      data: { list: [] },
    })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText('order.empty')).toBeTruthy())
  })

  it('refunded 状态金额显示正确', async () => {
    apiMocks.fetchApi.mockResolvedValue({
      success: true,
      data: { list: [mockOrder({ status: 'refunded', payAmount: 100 })] },
    })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText('测试课程')).toBeTruthy())
    expect(getByText(/100\.00/)).toBeTruthy()
  })

  it('非 refunded 状态金额显示正确', async () => {
    apiMocks.fetchApi.mockResolvedValue({
      success: true,
      data: { list: [mockOrder({ status: 'pending', payAmount: 100 })] },
    })
    const { getByText } = render(<OrderScreen />)

    await waitFor(() => expect(getByText('测试课程')).toBeTruthy())
    expect(getByText(/100\.00/)).toBeTruthy()
  })
})
