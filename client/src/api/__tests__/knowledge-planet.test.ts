// knowledge-planet.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request-compat', () => ({
  default: vi.fn(() => Promise.resolve({ data: {} })),
}))

import request from '@/utils/request-compat'
import * as api from '../knowledge/knowledge-planet'

describe('knowledge-planet API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(request as any).mockResolvedValue({ data: {} })
  })

  it('getKnowledgePlanetInfo', async () => {
    const r = await api.getKnowledgePlanetInfo('1')
    expect(r).toBeDefined()
    expect(request).toHaveBeenCalled()
  })

  it('information', async () => {
    const r = await api.information()
    expect(r).toBeDefined()
  })

  it('getinformationListnews', async () => {
    const r = await api.getinformationListnews()
    expect(r).toBeDefined()
  })

  it('getinformationList', async () => {
    const r = await api.getinformationList('1')
    expect(r).toBeDefined()
  })

  it('错误路径', async () => {
    ;(request as any).mockRejectedValue(new Error('fail'))
    try { await api.getKnowledgePlanetInfo('1') } catch { /* noop */ }
    try { await api.information() } catch { /* noop */ }
    try { await api.getinformationListnews() } catch { /* noop */ }
    try { await api.getinformationList('1') } catch { /* noop */ }
  })
})
