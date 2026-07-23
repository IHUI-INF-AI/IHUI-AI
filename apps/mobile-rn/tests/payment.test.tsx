/**
 * PaymentScreen 支付流程测试
 *
 * 覆盖:
 * - 正常加载订单列表
 * - 同步支付状态(成功/失败)
 * - 取消订单(成功/失败)
 * - 错误状态 + 空列表
 * - actioningId 防重复点击
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'

const { apiMocks, wechatPayMock } = vi.hoisted(() => ({
  apiMocks: {
    getPaymentOrders: vi.fn(),
    syncPaymentStatus: vi.fn(),
    cancelPaymentOrder: vi.fn(),
    createWechatAppPayment: vi.fn(),
  },
  wechatPayMock: {
    openWeChatPayment: vi.fn(),
    registerWeChat: vi.fn(),
    isWeChatInstalled: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => ({
  getPaymentOrders: apiMocks.getPaymentOrders,
  syncPaymentStatus: apiMocks.syncPaymentStatus,
  cancelPaymentOrder: apiMocks.cancelPaymentOrder,
  createWechatAppPayment: apiMocks.createWechatAppPayment,
}))

vi.mock('../src/lib/wechat-pay', () => wechatPayMock)

vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t }) }
})

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: vi.fn() }),
}))

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
    TouchableOpacity: mk('button'),
    FlatList,
    ActivityIndicator: () => createElement('div', null, 'loading'),
    RefreshControl: () => null,
    StyleSheet: { create: (s: Record<string, unknown>) => s },
  }
})

vi.mock('@ihui/ui-native', () => ({
  Button: (props: {
    children?: ReactNode
    onPress?: () => void
    loading?: boolean
    disabled?: boolean
  }) =>
    createElement(
      'button',
      { onClick: props.onPress, disabled: props.disabled || props.loading },
      props.children,
    ),
  Card: (props: { children?: ReactNode }) =>
    createElement('div', null, props.children),
}))

import { PaymentScreen } from '../src/screens/PaymentScreen'

const mockOrder = (overrides: Partial<Record<string, unknown>> = {}) => ({
  orderNo: 'ORD-001',
  subject: '测试订单',
  amount: 99.5,
  status: 'pending',
  createdAt: '2025-01-01T10:00:00Z',
  paymentMethod: 'wechat',
  paidAt: undefined,
  ...overrides,
})

describe('PaymentScreen 支付流程', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常加载:显示订单列表', async () => {
    apiMocks.getPaymentOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder()], total: 1 },
    })
    const { getByText } = render(<PaymentScreen />)

    await waitFor(() => expect(getByText('测试订单')).toBeTruthy())
    expect(getByText(/ORD-001/)).toBeTruthy()
    expect(getByText('¥ 99.50')).toBeTruthy()
  })

  it('加载失败:显示错误信息', async () => {
    apiMocks.getPaymentOrders.mockResolvedValue({
      success: false,
      error: '网络错误',
    })
    const { getByText } = render(<PaymentScreen />)

    await waitFor(() => expect(getByText('网络错误')).toBeTruthy())
  })

  it('空列表:显示空状态', async () => {
    apiMocks.getPaymentOrders.mockResolvedValue({
      success: true,
      data: { list: [], total: 0 },
    })
    const { getByText } = render(<PaymentScreen />)

    await waitFor(() => expect(getByText('payment.empty')).toBeTruthy())
  })

  it('同步支付状态成功:显示成功 toast 并刷新', async () => {
    apiMocks.getPaymentOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder()], total: 1 },
    })
    apiMocks.syncPaymentStatus.mockResolvedValue({ success: true })

    const { getByText } = render(<PaymentScreen />)
    await waitFor(() => expect(getByText('测试订单')).toBeTruthy())

    fireEvent.click(getByText('payment.syncStatus'))
    await waitFor(() => expect(apiMocks.syncPaymentStatus).toHaveBeenCalledWith('ORD-001'))
    await waitFor(() => expect(getByText('payment.syncSuccess')).toBeTruthy())
  })

  it('同步支付状态失败:显示失败 toast', async () => {
    apiMocks.getPaymentOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder()], total: 1 },
    })
    apiMocks.syncPaymentStatus.mockResolvedValue({ success: false, error: '同步失败' })

    const { getByText } = render(<PaymentScreen />)
    await waitFor(() => expect(getByText('测试订单')).toBeTruthy())

    fireEvent.click(getByText('payment.syncStatus'))
    await waitFor(() => expect(getByText('同步失败')).toBeTruthy())
  })

  it('取消订单成功:显示成功 toast', async () => {
    apiMocks.getPaymentOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder()], total: 1 },
    })
    apiMocks.cancelPaymentOrder.mockResolvedValue({ success: true })

    const { getByText } = render(<PaymentScreen />)
    await waitFor(() => expect(getByText('测试订单')).toBeTruthy())

    fireEvent.click(getByText('payment.cancelOrder'))
    await waitFor(() => expect(apiMocks.cancelPaymentOrder).toHaveBeenCalledWith('ORD-001'))
    await waitFor(() => expect(getByText('payment.cancelSuccess')).toBeTruthy())
  })

  it('取消订单失败:显示失败 toast', async () => {
    apiMocks.getPaymentOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder()], total: 1 },
    })
    apiMocks.cancelPaymentOrder.mockResolvedValue({ success: false, error: '取消失败' })

    const { getByText } = render(<PaymentScreen />)
    await waitFor(() => expect(getByText('测试订单')).toBeTruthy())

    fireEvent.click(getByText('payment.cancelOrder'))
    await waitFor(() => expect(getByText('取消失败')).toBeTruthy())
  })

  it('actioningId 期间禁用按钮防止重复点击', async () => {
    let resolveSync: (v: unknown) => void
    apiMocks.getPaymentOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder()], total: 1 },
    })
    apiMocks.syncPaymentStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveSync = resolve
      }),
    )

    const { getByText } = render(<PaymentScreen />)
    await waitFor(() => expect(getByText('测试订单')).toBeTruthy())

    fireEvent.click(getByText('payment.syncStatus'))
    expect(apiMocks.syncPaymentStatus).toHaveBeenCalledTimes(1)

    // 在请求完成前再次点击应该被禁用
    const syncBtn = getByText('payment.syncStatus').closest('button') as HTMLButtonElement
    expect(syncBtn.disabled).toBe(true)

    resolveSync!({ success: true })
    await waitFor(() => expect(syncBtn.disabled).toBe(false))
  })

  it('非 pending 状态的订单不显示操作按钮', async () => {
    apiMocks.getPaymentOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder({ status: 'paid' })], total: 1 },
    })

    const { queryByText } = render(<PaymentScreen />)

    await waitFor(() => expect(apiMocks.getPaymentOrders).toHaveBeenCalled())
    expect(queryByText('payment.syncStatus')).toBeNull()
    expect(queryByText('payment.cancelOrder')).toBeNull()
  })

  it('去支付:创建订单+调起微信支付成功,显示成功 toast 并刷新', async () => {
    apiMocks.getPaymentOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder()], total: 1 },
    })
    apiMocks.createWechatAppPayment.mockResolvedValue({
      success: true,
      data: {
        outTradeNo: 'ORD-NEW',
        prepayData: {
          appid: 'wx85fa429a9331b5c8',
          partnerid: '1714645682',
          prepayid: 'wxprepayid',
          package: 'Sign=WXPay',
          noncestr: 'abc',
          timestamp: '123',
          sign: 'sig',
        },
      },
    })
    wechatPayMock.openWeChatPayment.mockResolvedValue(true)

    const { getByText } = render(<PaymentScreen />)
    await waitFor(() => expect(getByText('测试订单')).toBeTruthy())

    fireEvent.click(getByText('payment.payNow'))
    await waitFor(() =>
      expect(apiMocks.createWechatAppPayment).toHaveBeenCalledWith({
        amount: 9950,
        description: '测试订单',
      }),
    )
    await waitFor(() => expect(wechatPayMock.openWeChatPayment).toHaveBeenCalled())
    await waitFor(() => expect(getByText('payment.paySuccess')).toBeTruthy())
  })

  it('去支付:用户取消支付,显示取消 toast', async () => {
    apiMocks.getPaymentOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder()], total: 1 },
    })
    apiMocks.createWechatAppPayment.mockResolvedValue({
      success: true,
      data: {
        outTradeNo: 'ORD-NEW',
        prepayData: {
          appid: 'wx85fa429a9331b5c8',
          partnerid: '1714645682',
          prepayid: 'wxprepayid',
          package: 'Sign=WXPay',
          noncestr: 'abc',
          timestamp: '123',
          sign: 'sig',
        },
      },
    })
    wechatPayMock.openWeChatPayment.mockResolvedValue(false)

    const { getByText } = render(<PaymentScreen />)
    await waitFor(() => expect(getByText('测试订单')).toBeTruthy())

    fireEvent.click(getByText('payment.payNow'))
    await waitFor(() => expect(getByText('payment.payCancelled')).toBeTruthy())
  })

  it('去支付:微信未安装,显示未安装 toast', async () => {
    apiMocks.getPaymentOrders.mockResolvedValue({
      success: true,
      data: { list: [mockOrder()], total: 1 },
    })
    apiMocks.createWechatAppPayment.mockResolvedValue({
      success: true,
      data: {
        outTradeNo: 'ORD-NEW',
        prepayData: {
          appid: 'wx85fa429a9331b5c8',
          partnerid: '1714645682',
          prepayid: 'wxprepayid',
          package: 'Sign=WXPay',
          noncestr: 'abc',
          timestamp: '123',
          sign: 'sig',
        },
      },
    })
    wechatPayMock.openWeChatPayment.mockRejectedValue(new Error('WECHAT_NOT_INSTALLED'))

    const { getByText } = render(<PaymentScreen />)
    await waitFor(() => expect(getByText('测试订单')).toBeTruthy())

    fireEvent.click(getByText('payment.payNow'))
    await waitFor(() => expect(getByText('payment.wechatNotInstalled')).toBeTruthy())
  })
})
