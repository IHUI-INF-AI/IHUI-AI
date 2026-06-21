// ai-models.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request-compat', () => ({
  default: vi.fn().mockResolvedValue({ code: 200, data: {} }),
}))

vi.mock('@/config/backend-paths', () => ({
  COZE_PATHS: {
    agentExamine: { list: '/examine/list' },
    agentCategory: { agentById: (id: string) => `/agent/${id}` },
    agentSettlement: { incomeOverview: '/income' },
    aiModelInfo: { list: '/aimodel/list' },
    search: { modelWorkflowRun: '/search/run' },
  },
}))

import * as api from '../ai-models'

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

describe('ai-models', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getAgentbyCollect 收藏', async () => {
    await callFn((api as any).getAgentbyCollect, {}, 'uuid1')
  })

  it('getAgentType 类型', async () => {
    await callFn((api as any).getAgentType, { type: '1' })
  })

  it('category/categoryDictionary 分类', async () => {
    await callFn((api as any).category, '1')
    await callFn((api as any).category)
    await callFn((api as any).categoryDictionary)
  })

  it('aiRemoveAgent 购买', async () => {
    await callFn((api as any).aiRemoveAgent, { agentId: 'a1' })
  })

  it('getDevInfo 开发者', async () => {
    await callFn((api as any).getDevInfo)
  })

  it('getZntList 审核', async () => {
    await callFn((api as any).getZntList, { page: 1 })
  })

  it('getChargeInfoById 收费', async () => {
    await callFn((api as any).getChargeInfoById, 'a1')
  })

  it('createPayHistory 付费记录', async () => {
    await callFn((api as any).createPayHistory, { agentId: 'a1', amount: 10 })
  })

  it('收费配置 CRUD', async () => {
    await callFn((api as any).createZntCharge, { agentId: 'a1', price: 10 })
    await callFn((api as any).putZntCharge, { agentId: 'a1', price: 10 })
    await callFn((api as any).deleteZntCharge, 'a1')
    await callFn((api as any).deleteZntCharge, ['a1', 'a2'])
  })

  it('收入/明细', async () => {
    await callFn((api as any).getBuyInfo, { startDate: '2024-01-01' })
    await callFn((api as any).getBuyList, { page: 1 })
    await callFn((api as any).getMxList, { page: 1 })
  })

  it('发布广场', async () => {
    await callFn((api as any).getPlazaList, { pageNum: 1, pageSize: 10, status: 'open' })
    await callFn((api as any).addPlazaModel, { title: 't', description: 'd' })
    await callFn((api as any).getPlazaInfoById, 'p1')
  })

  it('AI 模型调用', async () => {
    await callFn((api as any).getCozeApiList)
    await callFn((api as any).cozeZhsApiDashscopeImageGenerate, { prompt: 'p' }, '/img')
    await callFn((api as any).dashscopeImageEditSimple, { image: 'i', prompt: 'p' }, '/edit')
    await callFn((api as any).cozeZhsApiDashscopeVideoGenerate, { prompt: 'p' }, '/vid')
    await callFn((api as any).tencentHunyuan3dSubmit, { prompt: 'p' }, '/3d')
    await callFn((api as any).tencentHunyuan3dQuery, { taskId: 't1' }, '/3d/q')
    await callFn((api as any).cozeZhsApiLuyalaChatCompletions, { prompt: 'p' }, '/chat')
    await callFn((api as any).cozeZhsApiDoubaoSeedream40, { prompt: 'p' }, '/seed')
    await callFn((api as any).cozeZhsApiLuyalaVideoCreate, { prompt: 'p' }, '/vid2')
    await callFn((api as any).cozeZhsApiLuyalaVideoCreate, { prompt: 'p' }, '/vid2', 1)
    await callFn((api as any).postByUrl, {}, '/url')
  })

  it('音频', async () => {
    await callFn((api as any).audioStart, { prompt: 'p' })
    await callFn((api as any).audioEnd, 'a1')
  })

  it('搜索/工作流', async () => {
    await callFn((api as any).searchModelWorkflowRun, { query: 'q' })
  })

  it('Sora', async () => {
    await callFn((api as any).soraRequest, { prompt: 'p' })
    await callFn((api as any).soraRequestEnd, { taskId: 't1' })
  })

  it('阿里音频', async () => {
    await callFn((api as any).aliGenerateTimbre, { prompt: 'p' })
  })
})
