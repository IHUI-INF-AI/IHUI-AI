// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-30 资金安全回归锁：useWechatPayment 绝不在「未确认」时当成功
 *
 * 缺陷本体（修前 HEAD 实况）：
 *   if (statusRes.success && statusRes.data?.paid) { … onSuccess(orderNo) }
 *   else { appAlert('支付成功'); onSuccess(orderNo) }   // ← 后端明确 paid=false 也照给额度
 *   else { appAlert('支付成功'); onSuccess('') }        // ← 连 orderNo 都没有也当成功
 *
 * 危害不是文案：`onSuccess` 的消费方会 `loadBalance()` 并跳到成功页（AppTopupScreen）、
 * 置 opened 并刷新 VIP 态（VipTraderScreen）、goBack 刷新开通态（DevEnterCoverScreen）。
 * 也就是说「后端说没付钱」这一事实被翻成「已到账」，用户白拿充值/VIP。
 *
 * 判据纪律：
 * - 只认运行时行为，不认注释。五条用例把「成功 / 未确认 / 查询失败 / 缺单号 / 抛错」五条
 *   出口各钉一遍，红臂已实测（把 else 分支改回 `onSuccess` ⇒ 3 条立刻翻红）。
 * - 另加一条**形状锁**：`onSuccess` 的调用点数恒为 2（DEV mock 分支 + paid 分支），
 *   且 paid 之后那段里不能再冒出第三个。行为锁防「改坏」，形状锁防「在别处又加一条乐观路」。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { apiMocks, payMocks, alertMock } = vi.hoisted(() => ({
  apiMocks: {
    createWechatAppPayment: vi.fn(),
    checkPaymentStatus: vi.fn(),
  },
  payMocks: {
    isWeChatInstalled: vi.fn(),
    openWeChatPayment: vi.fn(),
  },
  alertMock: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({
  createWechatAppPayment: apiMocks.createWechatAppPayment,
  checkPaymentStatus: apiMocks.checkPaymentStatus,
}))

vi.mock('../src/lib/wechat-pay', () => payMocks)

vi.mock('../src/components/BottomPops', () => ({ appAlert: alertMock }))

import { useWechatPayment } from '../src/hooks/useWechatPayment'

const CONFIRMING_TEXT = '支付结果确认中,请稍后在订单中查看'
const SUCCESS_TEXT = '支付成功'
const FAILED_TEXT = '支付失败,请重试'

/** 走到「微信 SDK 已返回成功、待查服务端状态」这一步的公共前置 */
function primeSdkSuccess(overrides?: { outTradeNo?: string }) {
  payMocks.isWeChatInstalled.mockResolvedValue(true)
  apiMocks.createWechatAppPayment.mockResolvedValue({
    success: true,
    data: {
      outTradeNo: 'outTradeNo' in (overrides ?? {}) ? overrides?.outTradeNo : 'OT-1',
      prepayData: { partnerId: 'p', prepayId: 'pp' },
      mock: false,
    },
  })
  payMocks.openWeChatPayment.mockResolvedValue(true)
}

describe('DBG-30 useWechatPayment 未确认不得当成功', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('后端明确 paid=false ⇒ 不调 onSuccess，提示「确认中」，onFail=PAYMENT_NOT_CONFIRMED', async () => {
    primeSdkSuccess()
    apiMocks.checkPaymentStatus.mockResolvedValue({ success: true, data: { paid: false } })
    const onSuccess = vi.fn()
    const onFail = vi.fn()

    const { result } = renderHook(() => useWechatPayment({ orderType: 2, onSuccess, onFail }))
    await act(async () => {
      await result.current.pay(1000, '充值 10 元')
    })

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFail).toHaveBeenCalledWith('PAYMENT_NOT_CONFIRMED')
    // 文案不能是「支付成功」——那是把未确认说成已到账
    expect(alertMock).toHaveBeenCalledWith('提示', CONFIRMING_TEXT)
    expect(alertMock).not.toHaveBeenCalledWith('提示', SUCCESS_TEXT)
  })

  it('状态查询本身失败（success=false）⇒ 同样不调 onSuccess', async () => {
    primeSdkSuccess()
    apiMocks.checkPaymentStatus.mockResolvedValue({ success: false, error: 'boom' })
    const onSuccess = vi.fn()
    const onFail = vi.fn()

    const { result } = renderHook(() => useWechatPayment({ orderType: 2, onSuccess, onFail }))
    await act(async () => {
      await result.current.pay(1000, '充值 10 元')
    })

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFail).toHaveBeenCalledWith('PAYMENT_NOT_CONFIRMED')
    expect(alertMock).toHaveBeenCalledWith('提示', CONFIRMING_TEXT)
  })

  it('创建订单返回体缺 outTradeNo ⇒ 不当成功，onFail=MISSING_OUT_TRADE_NO', async () => {
    primeSdkSuccess({ outTradeNo: undefined })
    const onSuccess = vi.fn()
    const onFail = vi.fn()

    const { result } = renderHook(() => useWechatPayment({ orderType: 2, onSuccess, onFail }))
    await act(async () => {
      await result.current.pay(1000, '充值 10 元')
    })

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFail).toHaveBeenCalledWith('MISSING_OUT_TRADE_NO')
    expect(apiMocks.checkPaymentStatus).not.toHaveBeenCalled()
    expect(alertMock).toHaveBeenCalledWith('提示', CONFIRMING_TEXT)
  })

  it('状态查询抛异常 ⇒ 落 catch，onSuccess 仍不得被调', async () => {
    primeSdkSuccess()
    apiMocks.checkPaymentStatus.mockRejectedValue(new Error('NETWORK_DOWN'))
    const onSuccess = vi.fn()
    const onFail = vi.fn()

    const { result } = renderHook(() => useWechatPayment({ orderType: 2, onSuccess, onFail }))
    await act(async () => {
      await result.current.pay(1000, '充值 10 元')
    })

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFail).toHaveBeenCalledWith('NETWORK_DOWN')
    expect(alertMock).toHaveBeenCalledWith('提示', FAILED_TEXT)
  })

  it('绿臂：paid=true ⇒ onSuccess 收到 outTradeNo，onFail 不调（防过度收紧）', async () => {
    primeSdkSuccess()
    apiMocks.checkPaymentStatus.mockResolvedValue({ success: true, data: { paid: true } })
    const onSuccess = vi.fn()
    const onFail = vi.fn()

    const { result } = renderHook(() => useWechatPayment({ orderType: 2, onSuccess, onFail }))
    await act(async () => {
      await result.current.pay(1000, '充值 10 元')
    })

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledWith('OT-1')
    expect(onFail).not.toHaveBeenCalled()
    expect(alertMock).toHaveBeenCalledWith('提示', SUCCESS_TEXT)
  })

  it('XUI-008：DEV mock 订单（无微信配置）也必须回查服务端，查不到 paid 不得成功', async () => {
    payMocks.isWeChatInstalled.mockResolvedValue(true)
    apiMocks.createWechatAppPayment.mockResolvedValue({
      success: true,
      data: { outTradeNo: 'MOCK-1', mock: true },
    })
    apiMocks.checkPaymentStatus.mockResolvedValue({ success: true, data: { paid: false } })
    const onSuccess = vi.fn()
    const onFail = vi.fn()

    const { result } = renderHook(() => useWechatPayment({ orderType: 2, onSuccess, onFail }))
    await act(async () => {
      await result.current.pay(1000, '充值 10 元')
    })

    expect(apiMocks.checkPaymentStatus).toHaveBeenCalledWith('MOCK-1')
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFail).toHaveBeenCalledWith('PAYMENT_NOT_CONFIRMED')
    expect(alertMock).toHaveBeenCalledWith('提示', CONFIRMING_TEXT)
    expect(alertMock).not.toHaveBeenCalledWith('提示', SUCCESS_TEXT)
  })

  it('绿臂：DEV mock 订单且服务端确已 paid ⇒ 才允许成功', async () => {
    payMocks.isWeChatInstalled.mockResolvedValue(true)
    apiMocks.createWechatAppPayment.mockResolvedValue({
      success: true,
      data: { outTradeNo: 'MOCK-1', mock: true },
    })
    apiMocks.checkPaymentStatus.mockResolvedValue({ success: true, data: { paid: true } })
    const onSuccess = vi.fn()
    const onFail = vi.fn()

    const { result } = renderHook(() => useWechatPayment({ orderType: 2, onSuccess, onFail }))
    await act(async () => {
      await result.current.pay(1000, '充值 10 元')
    })

    expect(onSuccess).toHaveBeenCalledWith('MOCK-1')
    expect(onFail).not.toHaveBeenCalled()
  })

  it('形状锁：onSuccess 调用点恒为 1 处（mock 与真实支付共用同一确认出口）', () => {
    const src = readFileSync(resolve(__dirname, '../src/hooks/useWechatPayment.ts'), 'utf8')
    const callSites = src.match(/await onSuccess\?\.\(/g) ?? []
    expect(callSites).toHaveLength(1)

    // 状态回查那一段（从 checkPaymentStatus 到 catch）里只允许 paid 分支那一次**调用**
    // 注意只数调用点 `await onSuccess?.(`：本段注释里说明缺陷成因时会提到 onSuccess，
    // 把注释也算进来锁就成了「锁注释」——那是假判据（实测首次就误红）。
    const fromStatus = src.slice(src.indexOf('await checkPaymentStatus('))
    const statusRegion = fromStatus.slice(0, fromStatus.indexOf('} catch'))
    const inRegion = statusRegion.match(/await onSuccess\?\.\(/g) ?? []
    expect(inRegion).toHaveLength(1)
    // 且那一次必须在 paid 判据之后（顺序反了 = 又变回无条件成功）
    expect(statusRegion.indexOf('await onSuccess?.(')).toBeGreaterThan(
      statusRegion.indexOf('statusRes.data?.paid'),
    )

    // 两条非成功出口必须在场（防止有人只改文案、不改回调）
    expect(statusRegion).toContain("onFail?.('PAYMENT_NOT_CONFIRMED')")
    expect(src).toContain("onFail?.('MISSING_OUT_TRADE_NO')")
    // 「支付成功」文案只允许出现在 paid 判据之后（现为 1 次）。
    // XUI-008 前 DEV mock 分支自带一次无条件成功文案（共 2 次）；数量本身就是
    // 「有没有把未确认说成成功」的可数信号 —— 比逐字比注释可靠。
    // （不去断言注释文字：锁注释是假判据，改坏实现的人照样能改注释。）
    expect(src.match(/messages\?\.paySuccess/g) ?? []).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
