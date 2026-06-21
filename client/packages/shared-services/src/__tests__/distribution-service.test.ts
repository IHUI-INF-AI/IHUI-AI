import { describe, expect, it } from 'vitest'
import {
  getCommissionDetail,
  getFlowList,
  getSubordinates,
  getTraderStatistics,
  submitWithdrawal,
} from '../distribution-service'
import type { SharedRequestAdapter, SharedRequestConfig } from '../request-adapter'

function createAdapter(handler: (config: SharedRequestConfig) => unknown | Promise<unknown>): SharedRequestAdapter {
  return {
    async request<TResponse = unknown>(config: SharedRequestConfig): Promise<TResponse> {
      return handler(config) as Promise<TResponse>
    },
  }
}

describe('shared-services/distribution-service', () => {
  it('requests trader statistics and subordinates', async () => {
    const requests: SharedRequestConfig[] = []
    const adapter = createAdapter((config) => {
      requests.push(config)
      return { code: 200, data: {} }
    })

    await getTraderStatistics(adapter, 'token-1')
    await getSubordinates(adapter, { open_id: 'user-1', page: 1, quantity: 10 })

    expect(requests[0]).toMatchObject({
      url: '/flow/getStatistics',
      method: 'GET',
      data: { token: 'token-1' },
    })
    expect(requests[1]).toMatchObject({
      url: '/distribution/getSubordinates',
      method: 'POST',
      data: { open_id: 'user-1', page: 1, quantity: 10 },
    })
  })

  it('requests commission detail and flow list', async () => {
    const requests: SharedRequestConfig[] = []
    const adapter = createAdapter((config) => {
      requests.push(config)
      return { code: 200, data: [] }
    })

    await getCommissionDetail(adapter, 'user-1')
    await getFlowList(adapter, 'uuid-1')

    expect(requests[0]).toMatchObject({
      url: '/distribution/getUserCommissionDetail',
      method: 'GET',
      data: { user_id: 'user-1' },
    })
    expect(requests[1]).toMatchObject({
      url: '/flow/list',
      method: 'GET',
      data: { tokenUuid: 'uuid-1' },
    })
  })

  it('submits withdrawal request', async () => {
    let capturedConfig: SharedRequestConfig | undefined
    const adapter = createAdapter((config) => {
      capturedConfig = config
      return { code: 200, data: { status: 'pending' } }
    })

    await submitWithdrawal(adapter, {
      token: 'token-1',
      amount: 100,
      nickname: 'test',
      openId: 'openid-1',
    })

    expect(capturedConfig).toMatchObject({
      url: '/zhsWithdrawal/withdrawal',
      method: 'POST',
      data: { token: 'token-1', amount: 100, nickname: 'test', openId: 'openid-1' },
    })
  })
})
