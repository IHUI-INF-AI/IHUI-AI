import { describe, expect, it } from 'vitest'
import { getUserVipInfo, getVipPrice, purchaseVip } from '../vip-service'
import type { SharedRequestAdapter, SharedRequestConfig } from '../request-adapter'

function createAdapter(handler: (config: SharedRequestConfig) => unknown | Promise<unknown>): SharedRequestAdapter {
  return {
    async request<TResponse = unknown>(config: SharedRequestConfig): Promise<TResponse> {
      return handler(config) as Promise<TResponse>
    },
  }
}

describe('shared-services/vip-service', () => {
  it('requests vip price through the shared endpoint', async () => {
    let capturedConfig: SharedRequestConfig | undefined
    const adapter = createAdapter((config) => {
      capturedConfig = config
      return { code: 200, data: [{ id: 1, price: 49 }] }
    })

    const response = await getVipPrice(adapter, 'token-1')

    expect(capturedConfig).toMatchObject({
      url: '/fund/getInfo',
      method: 'GET',
      base: 2,
      data: { token: 'token-1' },
    })
    expect(response.data).toEqual([{ id: 1, price: 49 }])
  })

  it('requests vip purchase and user vip info', async () => {
    const requests: SharedRequestConfig[] = []
    const adapter = createAdapter((config) => {
      requests.push(config)
      return { code: 200, data: { ok: true } }
    })

    await purchaseVip(adapter, { packageId: 'vip-1', paymentMethod: 'wechat' })
    await getUserVipInfo(adapter, 'token-2')

    expect(requests[0]).toMatchObject({
      url: '/zhs-user-vip/purchase',
      method: 'POST',
      data: { packageId: 'vip-1', paymentMethod: 'wechat' },
    })
    expect(requests[1]).toMatchObject({
      url: '/zhs-user-vip/info',
      method: 'GET',
      data: { token: 'token-2' },
    })
  })
})
