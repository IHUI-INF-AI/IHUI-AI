import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state, fns } = vi.hoisted(() => ({
  state: { env: 'weapp' as string },
  fns: {
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    showToast: vi.fn(),
    showModal: vi.fn(),
    requestPayment: vi.fn(),
  },
}))

vi.mock('@tarojs/taro', () => {
  const mockTaro = {
    ENV_TYPE: { WEAPP: 'weapp', ALIPAY: 'alipay', RN: 'rn', WEB: 'web' },
    getEnv: () => state.env,
    showLoading: fns.showLoading,
    hideLoading: fns.hideLoading,
    showToast: fns.showToast,
    showModal: fns.showModal,
    requestPayment: fns.requestPayment,
  }
  return { ...mockTaro, default: mockTaro }
})

import { requestWxPayment, requestAliPayment, unifiedPay } from '../src/utils/pay'

function mockPaymentSuccess(res: unknown = { errMsg: 'requestPayment:ok' }) {
  fns.requestPayment.mockImplementation((opts: Record<string, unknown>) => {
    ;(opts.success as (r: unknown) => void)?.(res)
  })
}

function mockPaymentFail(err: unknown) {
  fns.requestPayment.mockImplementation((opts: Record<string, unknown>) => {
    ;(opts.fail as (e: unknown) => void)?.(err)
  })
}

const validWxParams = {
  timeStamp: '1234567890',
  nonceStr: 'abc',
  package: 'prepay_id=123',
  paySign: 'sign',
}

describe('miniapp-taro 微信支付调起', () => {
  beforeEach(() => {
    state.env = 'weapp'
    vi.clearAllMocks()
  })

  describe('requestWxPayment - mp-weixin', () => {
    it('正常支付成功', async () => {
      mockPaymentSuccess({ errMsg: 'requestPayment:ok' })
      const result = await requestWxPayment(validWxParams)
      expect(result).toEqual({ errMsg: 'requestPayment:ok' })
      expect(fns.showLoading).toHaveBeenCalledWith({ title: '支付中...', mask: true })
      expect(fns.hideLoading).toHaveBeenCalled()
    })

    it('signType 默认 RSA', async () => {
      mockPaymentSuccess()
      await requestWxPayment(validWxParams)
      expect(fns.requestPayment).toHaveBeenCalledWith(
        expect.objectContaining({ signType: 'RSA' }),
      )
    })

    it('signType 传 MD5 时透传', async () => {
      mockPaymentSuccess()
      await requestWxPayment({ ...validWxParams, signType: 'MD5' })
      expect(fns.requestPayment).toHaveBeenCalledWith(
        expect.objectContaining({ signType: 'MD5' }),
      )
    })

    it('缺少必填参数拒绝', async () => {
      await expect(
        requestWxPayment({ timeStamp: '123', nonceStr: 'n' }),
      ).rejects.toThrow('missing')
      expect(fns.hideLoading).toHaveBeenCalled()
      expect(fns.showToast).toHaveBeenCalledWith({ title: '支付参数不完整', icon: 'none' })
    })

    it('缺少 paySign 拒绝', async () => {
      await expect(
        requestWxPayment({ timeStamp: '123', nonceStr: 'n', package: 'pkg' }),
      ).rejects.toThrow('missing: paySign')
    })

    it('用户取消支付', async () => {
      mockPaymentFail({ errMsg: 'requestPayment:fail cancel' })
      await expect(requestWxPayment(validWxParams)).rejects.toMatchObject({
        errMsg: 'requestPayment:fail cancel',
      })
      expect(fns.showToast).toHaveBeenCalledWith({ title: '您已取消支付', icon: 'none' })
    })

    it('微信未安装 (code -100)', async () => {
      mockPaymentFail({ code: -100 })
      await expect(requestWxPayment(validWxParams)).rejects.toMatchObject({ code: -100 })
      expect(fns.showModal).toHaveBeenCalledWith(
        expect.objectContaining({ content: '未检测到微信应用,请先安装微信' }),
      )
    })

    it('微信未安装 (errMsg 62000)', async () => {
      mockPaymentFail({ errMsg: 'requestPayment:fail 62000' })
      await expect(requestWxPayment(validWxParams)).rejects.toMatchObject({
        errMsg: 'requestPayment:fail 62000',
      })
      expect(fns.showModal).toHaveBeenCalled()
    })

    it('参数错误', async () => {
      mockPaymentFail({ errMsg: 'requestPayment:fail parameter error' })
      await expect(requestWxPayment(validWxParams)).rejects.toMatchObject({
        errMsg: 'requestPayment:fail parameter error',
      })
      expect(fns.showToast).toHaveBeenCalledWith({
        title: '支付参数错误,请重试', icon: 'none', duration: 2000,
      })
    })

    it('通用支付失败', async () => {
      mockPaymentFail({ errMsg: 'requestPayment:fail unknown' })
      await expect(requestWxPayment(validWxParams)).rejects.toMatchObject({
        errMsg: 'requestPayment:fail unknown',
      })
      expect(fns.showToast).toHaveBeenCalledWith({
        title: '支付失败,请重试', icon: 'none', duration: 2000,
      })
    })
  })

  describe('requestWxPayment - app 平台', () => {
    beforeEach(() => {
      state.env = 'rn'
    })

    it('使用 orderInfo 字符串直传', async () => {
      mockPaymentSuccess()
      await requestWxPayment({ orderInfo: 'raw-order-info' })
      expect(fns.requestPayment).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'wxpay', orderInfo: 'raw-order-info' }),
      )
    })

    it('使用 orderInfo 对象时 JSON 序列化', async () => {
      mockPaymentSuccess()
      await requestWxPayment({ orderInfo: { foo: 'bar' } })
      const call = fns.requestPayment.mock.calls[0][0] as Record<string, unknown>
      expect(call.orderInfo).toBe(JSON.stringify({ foo: 'bar' }))
    })

    it('从字段构建 orderInfo', async () => {
      mockPaymentSuccess()
      await requestWxPayment({
        appid: 'wx123', partnerid: 'p1', prepayid: 'pre1', nonceStr: 'n', sign: 's',
      })
      const call = fns.requestPayment.mock.calls[0][0] as Record<string, unknown>
      const orderInfo = JSON.parse(call.orderInfo as string)
      expect(orderInfo.appid).toBe('wx123')
      expect(orderInfo.partnerid).toBe('p1')
      expect(orderInfo.prepayid).toBe('pre1')
      expect(orderInfo.package).toBe('Sign=WXPay')
      expect(orderInfo.sign).toBe('s')
    })

    it('app 平台支付成功', async () => {
      mockPaymentSuccess({ errMsg: 'ok' })
      const result = await requestWxPayment({ orderInfo: 'test' })
      expect(result).toEqual({ errMsg: 'ok' })
      expect(fns.hideLoading).toHaveBeenCalled()
    })

    it('app 平台支付失败也走错误处理', async () => {
      mockPaymentFail({ errMsg: 'cancel' })
      await expect(requestWxPayment({ orderInfo: 'test' })).rejects.toMatchObject({
        errMsg: 'cancel',
      })
      expect(fns.showToast).toHaveBeenCalledWith({ title: '您已取消支付', icon: 'none' })
    })
  })

  describe('requestWxPayment - 不支持的平台', () => {
    it('web 平台不支持', async () => {
      state.env = 'web'
      await expect(requestWxPayment({})).rejects.toThrow('unsupported platform')
      expect(fns.showToast).toHaveBeenCalledWith({ title: '当前环境不支持微信支付', icon: 'none' })
    })

    it('unknown 平台不支持', async () => {
      state.env = 'unknown'
      await expect(requestWxPayment({})).rejects.toThrow('unsupported platform')
    })
  })

  describe('requestAliPayment', () => {
    it('正常支付宝支付成功', async () => {
      state.env = 'rn'
      mockPaymentSuccess({})
      await requestAliPayment({ orderInfo: 'alipay-order-info' })
      expect(fns.requestPayment).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'alipay', orderInfo: 'alipay-order-info' }),
      )
    })

    it('mp-weixin 不支持支付宝', async () => {
      state.env = 'weapp'
      await expect(requestAliPayment({ orderInfo: 'test' })).rejects.toThrow(
        'mp-weixin unsupported alipay',
      )
      expect(fns.showToast).toHaveBeenCalledWith({
        title: '微信小程序暂不支持支付宝支付', icon: 'none',
      })
    })

    it('缺少 orderInfo 和 orderStr 拒绝', async () => {
      state.env = 'rn'
      await expect(requestAliPayment({})).rejects.toThrow('missing alipay orderInfo')
      expect(fns.showToast).toHaveBeenCalledWith({ title: '支付宝订单信息缺失', icon: 'none' })
    })

    it('使用 orderStr 替代 orderInfo', async () => {
      state.env = 'rn'
      mockPaymentSuccess({})
      await requestAliPayment({ orderStr: 'order-str' })
      expect(fns.requestPayment).toHaveBeenCalledWith(
        expect.objectContaining({ orderInfo: 'order-str' }),
      )
    })

    it('用户取消支付宝支付', async () => {
      state.env = 'rn'
      mockPaymentFail({ errMsg: 'cancel' })
      await expect(requestAliPayment({ orderInfo: 'test' })).rejects.toMatchObject({
        errMsg: 'cancel',
      })
      expect(fns.showToast).toHaveBeenCalledWith({ title: '您已取消支付', icon: 'none' })
    })

    it('支付宝未安装 (code -100)', async () => {
      state.env = 'rn'
      mockPaymentFail({ code: -100 })
      await expect(requestAliPayment({ orderInfo: 'test' })).rejects.toMatchObject({
        code: -100,
      })
      expect(fns.showModal).toHaveBeenCalledWith(
        expect.objectContaining({ content: '未检测到支付宝应用,请先安装支付宝' }),
      )
    })

    it('支付宝未安装 (errMsg 62009)', async () => {
      state.env = 'rn'
      mockPaymentFail({ errMsg: '62009 not installed' })
      await expect(requestAliPayment({ orderInfo: 'test' })).rejects.toMatchObject({
        errMsg: '62009 not installed',
      })
      expect(fns.showModal).toHaveBeenCalled()
    })

    it('支付宝通用错误 showToast', async () => {
      state.env = 'rn'
      mockPaymentFail({ errMsg: 'short msg' })
      await expect(requestAliPayment({ orderInfo: 'test' })).rejects.toMatchObject({
        errMsg: 'short msg',
      })
      expect(fns.showToast).toHaveBeenCalledWith({ title: 'short msg', icon: 'none', duration: 2000 })
    })

    it('支付宝长错误消息降级为通用提示', async () => {
      state.env = 'rn'
      const longMsg = 'this is a very long error message exceeding twenty chars'
      mockPaymentFail({ errMsg: longMsg })
      await expect(requestAliPayment({ orderInfo: 'test' })).rejects.toMatchObject({
        errMsg: longMsg,
      })
      expect(fns.showToast).toHaveBeenCalledWith({
        title: '支付失败,请重试', icon: 'none', duration: 2000,
      })
    })
  })

  describe('unifiedPay', () => {
    it('wechat 走 requestWxPayment', async () => {
      state.env = 'weapp'
      mockPaymentSuccess({})
      await unifiedPay('wechat', validWxParams)
      expect(fns.requestPayment).toHaveBeenCalled()
    })

    it('alipay 走 requestAliPayment', async () => {
      state.env = 'rn'
      mockPaymentSuccess({})
      await unifiedPay('alipay', { orderInfo: 'test' })
      const call = fns.requestPayment.mock.calls[0][0] as Record<string, unknown>
      expect(call.provider).toBe('alipay')
    })
  })
})
