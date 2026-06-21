import { describe, expect, it } from 'vitest'
import { addPlazaTask, getPlazaList, getPlazaTaskInfo } from '../plaza-service'
import type { SharedRequestAdapter, SharedRequestConfig } from '../request-adapter'

function createAdapter(handler: (config: SharedRequestConfig) => unknown | Promise<unknown>): SharedRequestAdapter {
  return {
    async request<TResponse = unknown>(config: SharedRequestConfig): Promise<TResponse> {
      return handler(config) as Promise<TResponse>
    },
  }
}

describe('shared-services/plaza-service', () => {
  it('requests plaza task list through the shared endpoint', async () => {
    let capturedConfig: SharedRequestConfig | undefined
    const adapter = createAdapter((config) => {
      capturedConfig = config
      return {
        code: 200,
        data: {
          list: [{ id: 1, title: 'Task 1' }],
          total: 1,
        },
      }
    })

    const response = await getPlazaList(adapter, {
      pageNum: 1,
      pageSize: 10,
      status: '1',
      search: '',
      creator: '',
      types: [],
      categorys: [],
    })

    expect(capturedConfig?.url).toContain('/remote/agent/task/need/task?')
    expect(capturedConfig?.method).toBe('GET')
    expect(capturedConfig?.base).toBe(2)
    expect(response.data).toEqual({
      list: [{ id: 1, title: 'Task 1' }],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })
  })

  it('adds and gets plaza task info', async () => {
    const requests: SharedRequestConfig[] = []
    const adapter = createAdapter((config) => {
      requests.push(config)
      return { code: 200, data: { id: 1, title: 'New Task' } }
    })

    await addPlazaTask(adapter, { title: 'New Task' })
    await getPlazaTaskInfo(adapter, 1)

    expect(requests[0]).toMatchObject({
      url: '/remote/agent/task/need/task/add',
      method: 'POST',
      base: 2,
    })
    expect(requests[1]).toMatchObject({
      url: '/remote/agent/task/need/task/add/1',
      method: 'GET',
      base: 2,
    })
  })
})
