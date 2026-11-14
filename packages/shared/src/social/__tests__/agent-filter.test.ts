// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'
import {
  AGENT_CATEGORY_IDS,
  AGENT_QUICK_TABS,
  AGENT_SORT_KEYS,
  detectAgentCategory,
  filterAgents,
  pickHotBanner,
  type AgentCategoryKeywords,
  type AgentFilterable,
} from '../agent-filter'

interface Row extends AgentFilterable {
  uses: number
  category: string
}

const KEYWORDS: AgentCategoryKeywords = {
  office: ['办公', 'excel', 'ppt'],
  writing: ['写', '文案'],
  coding: ['python', 'code', 'bug'],
  education: ['学', '教'],
  life: ['生活', '美食'],
}

const LIST: Row[] = [
  { id: '1', name: 'Excel 助手', desc: '处理表格', category: 'office', uses: 10 },
  { id: '2', name: '文案专家', desc: '写营销文案', category: 'writing', uses: 50 },
  { id: '3', name: 'Python 老师', desc: '教你写代码', category: 'coding', uses: 30 },
  { id: '4', name: '美食推荐', desc: '找餐厅', category: 'life', uses: 5 },
]

describe('agent-filter 契约', () => {
  it('枚举稳定', () => {
    expect([...AGENT_CATEGORY_IDS]).toEqual([
      'recommend',
      'office',
      'writing',
      'coding',
      'education',
      'life',
      'other',
    ])
    expect([...AGENT_QUICK_TABS]).toEqual(['all', 'favorites', 'recent'])
    expect([...AGENT_SORT_KEYS]).toEqual(['hot', 'newest', 'uses'])
  })

  describe('detectAgentCategory', () => {
    it('按名称+描述匹配关键词', () => {
      expect(detectAgentCategory('Excel 助手', null, KEYWORDS)).toBe('office')
      // 「写」在 writing 表里且 writing 在前 ⇒ 先命中 writing(顺序即优先级,这是刻意语义)
      expect(detectAgentCategory('Python 老师', '教你写代码', KEYWORDS)).toBe('writing')
      // 只给 coding 才认得出的词
      expect(detectAgentCategory('Python 老师', 'debug', KEYWORDS)).toBe('coding')
    })

    it('大小写不敏感', () => {
      expect(detectAgentCategory('EXCEL', null, KEYWORDS)).toBe('office')
      expect(detectAgentCategory('PYTHON', null, KEYWORDS)).toBe('coding')
    })

    it('都不命中 ⇒ other(唯一兜底值)', () => {
      expect(detectAgentCategory('神秘助手', '什么都没说', KEYWORDS)).toBe('other')
      expect(detectAgentCategory(null, null, KEYWORDS)).toBe('other')
    })

    it('空关键词不参与匹配(否则空串会命中一切)', () => {
      const withEmpty: AgentCategoryKeywords = {
        office: ['', '  '],
        writing: [],
        coding: [],
        education: [],
        life: [],
      }
      expect(detectAgentCategory('任意名称', null, withEmpty)).toBe('other')
    })

    it('顺序敏感:先命中的分类胜出', () => {
      const both: Row = { id: 'x', name: 'Excel 写文案', desc: null, category: '', uses: 0 }
      // office 在 writing 之前,两侧都命中时取 office
      expect(detectAgentCategory(both.name, both.desc, KEYWORDS)).toBe('office')
    })
  })

  describe('filterAgents', () => {
    it('recommend 不过滤,按 uses 降序(hot 档)', () => {
      const out = filterAgents({ list: LIST, activeCategory: 'recommend' })
      expect(out.map((r) => r.id)).toEqual(['2', '3', '1', '4'])
    })

    it('不改入参', () => {
      const snapshot = LIST.map((r) => r.id)
      filterAgents({ list: LIST, activeCategory: 'recommend' })
      expect(LIST.map((r) => r.id)).toEqual(snapshot)
    })

    it('分类筛选', () => {
      const out = filterAgents({ list: LIST, activeCategory: 'coding' })
      expect(out.map((r) => r.id)).toEqual(['3'])
    })

    it('关键词同时匹配名称与描述', () => {
      expect(filterAgents({ list: LIST, keyword: 'Excel' }).map((r) => r.id)).toEqual(['1'])
      expect(filterAgents({ list: LIST, keyword: '营销' }).map((r) => r.id)).toEqual(['2'])
      expect(filterAgents({ list: LIST, keyword: '  文案  ' }).map((r) => r.id)).toEqual(['2'])
    })

    it('模型类型按 category 子串匹配', () => {
      const out = filterAgents({ list: LIST, activeType: 'COD' })
      expect(out.map((r) => r.id)).toEqual(['3'])
    })

    it('favorites 只留收藏项', () => {
      const out = filterAgents({ list: LIST, quickTab: 'favorites', favoriteIds: ['1', '4'] })
      expect(out.map((r) => r.id)).toEqual(['1', '4'])
    })

    it('recent 按最近使用顺序,且不再被 uses 排序打乱', () => {
      const out = filterAgents({ list: LIST, quickTab: 'recent', recentIds: ['4', '2', '1'] })
      expect(out.map((r) => r.id)).toEqual(['4', '2', '1'])
    })

    it('newest 是「原列表顺序倒序」(后端未下发 createdAt 的近似口径,不是 hot 再倒序)', () => {
      const newest = filterAgents({ list: LIST, sortKey: 'newest' }).map((r) => r.id)
      expect(newest).toEqual(['4', '3', '2', '1'])
    })

    it('uses 与 hot 同义', () => {
      const a = filterAgents({ list: LIST, sortKey: 'uses' }).map((r) => r.id)
      const b = filterAgents({ list: LIST, sortKey: 'hot' }).map((r) => r.id)
      expect(a).toEqual(b)
    })

    it('空列表不抛错', () => {
      expect(filterAgents({ list: [] })).toEqual([])
    })

    it('缺失 uses 按 0 参与排序', () => {
      const rows: Row[] = [
        { id: 'a', name: 'A', desc: null, category: '', uses: 0 },
        { id: 'b', name: 'B', desc: null, category: '', uses: 5 },
      ]
      expect(filterAgents({ list: rows }).map((r) => r.id)).toEqual(['b', 'a'])
    })
  })

  describe('pickHotBanner', () => {
    it('全部 Tab 且无筛选时取前 N', () => {
      const out = pickHotBanner({ list: LIST })
      expect(out.map((r) => r.id)).toEqual(['2', '3', '1', '4'])
      expect(pickHotBanner({ list: LIST }, 2).map((r) => r.id)).toEqual(['2', '3'])
    })

    it('任一筛选生效 ⇒ 空(推荐区不参与筛选)', () => {
      expect(pickHotBanner({ list: LIST, keyword: 'x' })).toEqual([])
      expect(pickHotBanner({ list: LIST, activeType: 'office' })).toEqual([])
      expect(pickHotBanner({ list: LIST, activeCategory: 'office' })).toEqual([])
      expect(pickHotBanner({ list: LIST, quickTab: 'favorites' })).toEqual([])
    })

    it('limit 为 0 或负数 ⇒ 空,不为负', () => {
      expect(pickHotBanner({ list: LIST }, 0)).toEqual([])
      expect(pickHotBanner({ list: LIST }, -3)).toEqual([])
    })
  })
})
