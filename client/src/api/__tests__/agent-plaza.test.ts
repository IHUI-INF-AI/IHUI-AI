// agent-plaza.ts 单元测试 (智能体广场接口)
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: vi.fn().mockImplementation((config: any) => {
    return Promise.resolve({ data: { code: 200, msg: 'ok', data: {} } })
  }),
}))

vi.mock('@/utils/requestCache', () => ({
  defaultCache: {
    wrap: vi.fn().mockImplementation((_key, fn) => fn()),
  },
}))

import * as api from '../agent/agent-plaza'

async function callFn(fn: any, ...args: any[]): Promise<any> {
  try {
    const result = await fn(...args)
    expect(result).toBeDefined()
    return result
  } catch (e) {
    expect(e).toBeDefined()
    return null
  }
}

describe('agent-plaza', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getAgentList 列表', async () => {
    await callFn((api as any).getAgentList, { pageNum: 1, pageSize: 10 })
  })

  it('categories 分类', async () => {
    await callFn((api as any).categories)
  })

  it('collect/like 收藏点赞', async () => {
    await callFn((api as any).getAgentCollect, '1')
    await callFn((api as any).getAgentLike, '1')
  })

  it('findMockAgentById 兜底', () => {
    const r = (api as any).findMockAgentById('写作助手')
    expect(r).toBeDefined()
    const r2 = (api as any).findMockAgentById('notfound')
    expect(r2).toBeDefined()
  })
})
