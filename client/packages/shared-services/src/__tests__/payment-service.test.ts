import { describe, expect, it } from 'vitest'
import {
  cancelPaymentOrderByTradeNo,
  closePaymentOrderStatus,
  getConsecutivePaymentProduct,
  getTokenCount,
  getTokenReturn,
  initiateWechatPay,
} from '../payment-service'
import type { SharedRequestAdapter, SharedRequestConfig } from '../request-adapter'

function createAdapter(handler: (config: SharedRequestConfig) => unknown | Promise<unknown>): SharedRequestAdapter {
  return {
    async request<TResponse = unknown>(config: SharedRequestConfig): Promise<TResponse> {
      return handler(config) as Promise<TResponse>
    },
  }
}

describe('shared-services/payment-service', () => {
  it('initiates web and miniapp wechat payments through platform endpoints', async () => {
    const requests: SharedRequestConfig[] = []
    const adapter = createAdapter((config) => {
      requests.push(config)
      return { code: 200, data: { orderNo: 'order-1' } }
    })
    const input = {
      uuid: 'uuid-1',
      openId: 'openid-1',
      desc: 'vip',
      amount: 49,
      id: 'sku-1',
      productType: 'vip',
    }

    await initiateWechatPay(adapter, input)
    await initiateWechatPay(adapter, { ...input, payType: 'mini' }, { appEndpoint: true })

    expect(requests[0]).toMatchObject({
      url: '/pay/initiatePay',
      method: 'POST',
      data: input,
    })
    expect(requests[1]).toMatchObject({
      url: '/pay/app/initiatePay',
      method: 'POST',
      data: { ...input, payType: 'mini' },
    })
  })

  it('requests token and order helper endpoints', async () => {
    const requests: SharedRequestConfig[] = []
    const adapter = createAdapter((config) => {
      requests.push(config)
      return { code: 200, data: { ok: true } }
    })

    await getTokenCount(adapter, { id: 'user-1', quantity: 1, remarks: 'chat' })
    await getTokenReturn(adapter, 'ctx-1')
    await closePaymentOrderStatus(adapter, 'openid-1', 'trade-1')
    await cancelPaymentOrderByTradeNo(adapter, 'openid-1', 'trade-2')
    await getConsecutivePaymentProduct(adapter)

    expect(requests.map((request) => request.url)).toEqual([
      '/resource/getTokenCount',
      '/resource/getTokenReturn',
      '/pay/updateStatus',
      '/pay/closeOrder',
      '/pay/consecutively/product',
    ])
  })
})
