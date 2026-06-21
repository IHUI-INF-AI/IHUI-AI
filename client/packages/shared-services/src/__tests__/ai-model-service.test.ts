import { describe, expect, it } from 'vitest'
import {
  checkFirstShareStatus,
  createModelChat,
  deleteModelChat,
  getAigcList,
  getGroupList,
  getModelChatList,
} from '../ai-model-service'
import type { SharedRequestAdapter, SharedRequestConfig } from '../request-adapter'

function createAdapter(handler: (config: SharedRequestConfig) => unknown | Promise<unknown>): SharedRequestAdapter {
  return {
    async request<TResponse = unknown>(config: SharedRequestConfig): Promise<TResponse> {
      return handler(config) as Promise<TResponse>
    },
  }
}

describe('shared-services/ai-model-service', () => {
  it('requests model chat list and create through shared endpoints', async () => {
    const requests: SharedRequestConfig[] = []
    const adapter = createAdapter((config) => {
      requests.push(config)
      return { code: 200, data: { ok: true } }
    })

    await getModelChatList(adapter, { userId: 'user-1' })
    await createModelChat(adapter, { userId: 'user-1', modelId: 'model-1' })

    expect(requests[0]).toMatchObject({
      url: '/cozeZhsApi/user-model-chat/query',
      method: 'POST',
      base: 3,
    })
    expect(requests[1]).toMatchObject({
      url: '/cozeZhsApi/user-model-chat/create',
      method: 'POST',
      base: 3,
    })
  })

  it('requests aigc list and group list', async () => {
    const requests: SharedRequestConfig[] = []
    const adapter = createAdapter((config) => {
      requests.push(config)
      return { code: 200, data: [] }
    })

    await getAigcList(adapter, { pageNum: 1, pageSize: 10 })
    await getGroupList(adapter)

    expect(requests[0]).toMatchObject({
      url: '/general/ai_gc/list',
      method: 'GET',
      base: 4,
    })
    expect(requests[1]).toMatchObject({
      url: '/general/remote/third/group/list',
      method: 'GET',
      base: 4,
    })
  })

  it('deletes model chat and checks share status', async () => {
    const requests: SharedRequestConfig[] = []
    const adapter = createAdapter((config) => {
      requests.push(config)
      return { code: 200, data: null }
    })

    await deleteModelChat(adapter, 'chat-1')
    await checkFirstShareStatus(adapter)

    expect(requests[0]).toMatchObject({
      url: '/cozeZhsApi/user-model-chat/chat-1',
      method: 'DELETE',
      base: 3,
    })
    expect(requests[1]).toMatchObject({
      url: '/resource/first/share/show',
      method: 'GET',
      base: 1,
    })
  })
})
