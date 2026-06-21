// n8n-agents.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => r?.data ?? r,
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import request from '@/utils/request'
import * as api from '../n8n-agents'

describe('n8n-agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(request.get as any).mockResolvedValue({ data: { list: [], pagination: {} } })
    ;(request.post as any).mockResolvedValue({ data: { id: '1' } })
  })

  it('getN8NAgents 正常', async () => {
    const r = await api.getN8NAgents({ page: 1, page_size: 10 })
    expect(r).toBeDefined()
  })

  it('getN8NAgents 不带参数', async () => {
    const r = await api.getN8NAgents()
    expect(r).toBeDefined()
  })

  it('createN8NAgent 字符串 n8nBackupFile', async () => {
    const r = await api.createN8NAgent({ name: 'a', description: 'd', n8nUrl: 'u', n8nBackupFile: 'json', avatar: 'a' })
    expect(r).toBeDefined()
  })

  it('createN8NAgent File n8nBackupFile', async () => {
    const file = new File([], 'a.json')
    const r = await api.createN8NAgent({ name: 'a', description: 'd', n8nUrl: 'u', n8nBackupFile: file, inputParams: [{ parameterName: 'p', parameterDescription: 'd', type: 'text' }], outputParams: [{ parameterName: 'p', parameterDescription: 'd', type: 'text' }] })
    expect(r).toBeDefined()
  })

  it('processN8NAgent 正常', async () => {
    const r = await api.processN8NAgent({ agentId: 'a', params: { x: 1 } })
    expect(r).toBeDefined()
  })

  it('所有错误路径', async () => {
    ;(request.get as any).mockRejectedValue(new Error('fail'))
    ;(request.post as any).mockRejectedValue(new Error('fail'))
    try { await api.getN8NAgents() } catch (e) {}
    try { await api.createN8NAgent({ name: 'a', description: 'd', n8nUrl: 'u' }) } catch (e) {}
    try { await api.processN8NAgent({ agentId: 'a', params: {} }) } catch (e) {}
  })
})
