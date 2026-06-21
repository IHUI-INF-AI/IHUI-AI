import { describe, expect, it } from 'vitest'
import { getAgentDetailByCategory, getAgentList } from '../agent-service'
import type { SharedRequestAdapter, SharedRequestConfig } from '../request-adapter'

function createAdapter(handler: (config: SharedRequestConfig) => unknown | Promise<unknown>): SharedRequestAdapter {
  return {
    async request<TResponse = unknown>(config: SharedRequestConfig): Promise<TResponse> {
      return handler(config) as Promise<TResponse>
    },
  }
}

describe('shared-services/agent-service', () => {
  it('normalizes agent list envelopes', async () => {
    let capturedConfig: SharedRequestConfig | undefined
    const adapter = createAdapter(
      async (config) => {
        capturedConfig = config
        return {
          code: 200,
          data: {
            agents: [{ agentId: 'agent-1', agentName: 'Agent One' }],
            total: 1,
            pageNum: 2,
            pageSize: 10,
          },
        }
      },
    )

    const response = await getAgentList(adapter, { agentName: 'text', pageNum: 2, pageSize: 10 })

    expect(capturedConfig).toMatchObject({
      url: '/remote/agent/by/type',
      method: 'GET',
      base: 2,
      params: { agentName: 'text', pageNum: 2, pageSize: 10 },
    })
    expect(response.data).toEqual({
      list: [{ agentId: 'agent-1', agentName: 'Agent One' }],
      total: 1,
      page: 2,
      pageSize: 10,
      totalPages: 1,
    })
  })

  it('requests agent category detail through the shared endpoint', async () => {
    let capturedConfig: SharedRequestConfig | undefined
    const adapter = createAdapter(
      async (config) => {
        capturedConfig = config
        return {
          code: 200,
          data: [{ agent_id: 'agent-1', account: 100 }],
        }
      },
    )

    const response = await getAgentDetailByCategory(adapter, 'agent-1')

    expect(capturedConfig).toMatchObject({
      url: '/cozeZhsApi/agent-category/agent/agent-1',
      method: 'GET',
      base: 3,
    })
    expect(response.data).toEqual([{ agent_id: 'agent-1', account: 100 }])
  })
})
