// ai-world.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: (r: any) => {
    // 模拟真实逻辑：解包 axios response
    if (r && typeof r === 'object' && 'data' in r) {
      const d = r.data
      if (d && typeof d === 'object' && 'code' in d && 'data' in d) {
        return {
          code: d.code,
          message: d.msg || d.message || 'success',
          data: d.data,
          success: d.success !== undefined ? d.success : (d.code === 200 || d.code === 0),
          timestamp: d.timestamp || Date.now(),
        }
      }
      return { code: r.status || 200, message: 'success', data: d, success: true, timestamp: Date.now() }
    }
    return r
  },
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import request from '@/utils/request'
import * as api from '../ai/ai-world'

describe('ai-world API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(request.get as any).mockResolvedValue({
      data: {
        code: 200,
        data: [
          { section: 'A', subSection: 'a1', subSections: [], aiBotSites: [{ id: 1, name: 'x', shortDesc: 'd', section: 'A', subSection: 'a1', iconUrl: 'i', detailUrl: 'd', officialUrl: 'o', createdAt: '', updatedAt: '' }] },
          { section: 'A', subSection: 'a2', subSections: [], aiBotSites: [{ id: 2, name: 'y', shortDesc: 'd', section: 'A', subSection: 'a2', iconUrl: 'i', detailUrl: 'd', officialUrl: 'o', createdAt: '', updatedAt: '' }] },
        ],
      },
    })
  })

  it('getAiWorldList 默认参数', async () => {
    const r = await api.getAiWorldList()
    expect(r.success).toBe(true)
  })

  it('getAiWorldList 带 section 和 subSection', async () => {
    const r = await api.getAiWorldList({ section: 'A', subSection: 'a1' })
    expect(r.success).toBe(true)
  })

  it('getAiWorldList 同名 section 合并', async () => {
    const r = await api.getAiWorldList()
    expect(r.data?.length).toBe(1)
  })

  it('getAiWorldList 失败返回空数组', async () => {
    ;(request.get as any).mockResolvedValue({ data: { success: false, data: null } })
    const r = await api.getAiWorldList()
    expect(r.data).toEqual([])
  })

  it('getAiWorldList 非数组数据', async () => {
    ;(request.get as any).mockResolvedValue({ data: { code: 200, data: 'string' } })
    const r = await api.getAiWorldList()
    expect(r.data).toEqual([])
  })

  it('buildSectionWithSubs 正常', () => {
    const section = {
      section: 'A',
      subSection: null,
      subSections: null,
      aiBotSites: [
        { id: 1, name: 'x', shortDesc: 'd', section: 'A', subSection: 'a1', iconUrl: 'i', detailUrl: 'd', officialUrl: 'o', createdAt: '', updatedAt: '' },
        { id: 2, name: 'y', shortDesc: 'd', section: 'A', subSection: 'a2', iconUrl: 'i', detailUrl: 'd', officialUrl: 'o', createdAt: '', updatedAt: '' },
      ],
    }
    const r = api.buildSectionWithSubs(section, api.siteToItem)
    expect(r.children.length).toBe(2)
  })

  it('buildSectionWithSubs 空 aiBotSites', () => {
    const section = { section: 'A', subSection: null, subSections: null, aiBotSites: [] }
    const r = api.buildSectionWithSubs(section, api.siteToItem)
    expect(r.children.length).toBe(0)
  })

  it('isSubTitleRedundant', () => {
    expect(api.isSubTitleRedundant('A', '')).toBe(true)
    expect(api.isSubTitleRedundant('A', 'A')).toBe(true)
    expect(api.isSubTitleRedundant('A', 'Aa')).toBe(true)
    expect(api.isSubTitleRedundant('A', 'B')).toBe(false)
  })

  it('formatSubTitleForDisplay', () => {
    expect(api.formatSubTitleForDisplay('a|b|c')).toBe('a / b / c')
    expect(api.formatSubTitleForDisplay('')).toBe('')
  })

  it('getAiWorldSiteById 正常', async () => {
    const r = await api.getAiWorldSiteById('1')
    expect(r?.id).toBe(1)
  })

  it('getAiWorldSiteById 无效 id', async () => {
    const r = await api.getAiWorldSiteById('abc')
    expect(r).toBeNull()
  })

  it('getAiWorldSiteById 负数 id', async () => {
    const r = await api.getAiWorldSiteById('-1')
    expect(r).toBeNull()
  })

  it('getAiWorldSiteById 找不到', async () => {
    const r = await api.getAiWorldSiteById('999')
    expect(r).toBeNull()
  })

  it('siteToItem 完整', () => {
    const item = api.siteToItem({
      id: 1,
      name: 'n',
      shortDesc: 'd',
      section: 'A',
      subSection: 'a',
      iconUrl: 'i',
      detailUrl: '/d',
      officialUrl: 'o',
      createdAt: '',
      updatedAt: '',
    })
    expect(item.id).toBe('1')
    expect(item.coverUrl).toBe('i')
  })

  it('siteToItem 缺省值', () => {
    const item = api.siteToItem({
      id: 1,
      name: 'n',
      shortDesc: null,
      section: null,
      subSection: null,
      iconUrl: '',
      detailUrl: '',
      officialUrl: '',
      createdAt: '',
      updatedAt: '',
    })
    expect(item.coverUrl).toBe('/images/common/empty.svg')
  })
})
