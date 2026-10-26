// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  useNavigation: () => ({ navigate: vi.fn(), goBack: vi.fn() }),
}))

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
  Card: (props: { children?: ReactNode }) => createElement('div', null, props.children),
  Loading: () => createElement('div', null, 'loading'),
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
    // 链:click → await syncPaymentStatus → setToast。成功 toast 是链终点(每步都 await,
    // 终点出现即证明调用发生过)⇒ 只等终点一次,前序降级为同步断言(形态同先例 e4989cbb9e)。
    await waitFor(() => expect(getByText('payment.syncSuccess')).toBeTruthy(), { timeout: 8_000 })
    expect(apiMocks.syncPaymentStatus, '没调同步接口就出成功 toast = 假阳').toHaveBeenCalledWith(
      'ORD-001',
    )
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
    // 链:click → await cancelPaymentOrder → setToast。只等终点 toast 一次,调用断言降级为同步。
    await waitFor(() => expect(getByText('payment.cancelSuccess')).toBeTruthy(), { timeout: 8_000 })
    expect(apiMocks.cancelPaymentOrder, '没调取消接口就出成功 toast = 假阳').toHaveBeenCalledWith(
      'ORD-001',
    )
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

    const { getByText, getAllByText } = render(<PaymentScreen />)
    await waitFor(() => expect(getByText('测试订单')).toBeTruthy())

    fireEvent.click(getByText('payment.payNow'))
    // ConfirmPurchasePopUp 弹窗,"确认支付"同时出现在 title 和 button 上,点击第二个(button)
    await waitFor(() => {
      const confirmBtns = getAllByText('确认支付')
      expect(confirmBtns.length).toBeGreaterThanOrEqual(2)
    })
    fireEvent.click(getAllByText('确认支付')[1]!)
    // 链:confirm → await createWechatAppPayment → await openWeChatPayment → setToast(paySuccess)。
    // paySuccess toast 是整条链的唯一终点:每步都 await,终点出现即证明前两跳都发生过 ⇒ 只等一次。
    // 立因与预算同先例 e4989cbb9e:多段串行 waitFor 各带一份等待预算,在并发跑 200+ 道守门的同机
    // 上会被事件循环饿死打成假红;8s 仍低于 vitest.config 的 testTimeout 10s。断言一条不减,
    // 前序各跳降级为同步断言(终点已保证它们发生过)。
    await waitFor(() => expect(getByText('payment.paySuccess')).toBeTruthy(), { timeout: 8_000 })
    expect(apiMocks.createWechatAppPayment, '没创建订单就出成功 toast = 假阳').toHaveBeenCalledWith(
      {
        amount: 9950,
        description: '测试订单',
      },
    )
    expect(
      wechatPayMock.openWeChatPayment,
      '没调起微信支付就出成功 toast = 假阳',
    ).toHaveBeenCalled()
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

    const { getByText, getAllByText } = render(<PaymentScreen />)
    await waitFor(() => expect(getByText('测试订单')).toBeTruthy())

    fireEvent.click(getByText('payment.payNow'))
    // ConfirmPurchasePopUp 弹窗,点击"确认支付"按钮后用户取消微信支付
    await waitFor(() => {
      const confirmBtns = getAllByText('确认支付')
      expect(confirmBtns.length).toBeGreaterThanOrEqual(2)
    })
    fireEvent.click(getAllByText('确认支付')[1]!)
    // 链:confirm → create 成功 → await openWeChatPayment(返回 false) → setToast(payCancelled)。
    // 取消 toast 是终点,只等一次;openWeChatPayment 降级为同步断言。
    await waitFor(() => expect(getByText('payment.payCancelled')).toBeTruthy(), { timeout: 8_000 })
    expect(wechatPayMock.openWeChatPayment, '没调起支付就出取消 toast = 假阳').toHaveBeenCalled()
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

    const { getByText, getAllByText } = render(<PaymentScreen />)
    await waitFor(() => expect(getByText('测试订单')).toBeTruthy())

    fireEvent.click(getByText('payment.payNow'))
    // 先弹出 ConfirmPurchasePopUp,点击确认按钮后再触发微信支付
    await waitFor(() => {
      const confirmBtns = getAllByText('确认支付')
      expect(confirmBtns.length).toBeGreaterThanOrEqual(2)
    })
    fireEvent.click(getAllByText('确认支付')[1]!)
    await waitFor(() => expect(getByText('payment.wechatNotInstalled')).toBeTruthy())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
