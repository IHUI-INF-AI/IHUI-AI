import { describe, it, expect, beforeEach } from 'vitest'
import {
  createStory,
  getStory,
  addCharacter,
  addPlotPoint,
  checkConsistency,
  analyzePacing,
  suggestChapterOutline,
} from '../src/services/ai/plot-advisor-service.js'
import type { Character, PlotPoint } from '../src/services/ai/plot-advisor-service.js'

describe('plot-advisor-service 剧情顾问', () => {
  const SID = 'test-story-plot'

  beforeEach(() => {
    createStory(SID, '测试故事')
  })

  describe('createStory / getStory', () => {
    it('创建故事返回初始状态', () => {
      const story = getStory(SID)!
      expect(story.storyId).toBe(SID)
      expect(story.title).toBe('测试故事')
      expect(story.characters.size).toBe(0)
      expect(story.plotPoints).toEqual([])
      expect(story.unresolvedForeshadows.size).toBe(0)
    })

    it('查询不存在的故事返回 null', () => {
      expect(getStory('nonexistent')).toBeNull()
    })
  })

  describe('addCharacter', () => {
    it('添加角色到故事', () => {
      const char: Character = { id: 'c1', name: 'Alice', traits: ['brave'], relations: [] }
      addCharacter(SID, char)
      expect(getStory(SID)!.characters.get('c1')).toEqual(char)
    })

    it('故事不存在时抛错', () => {
      expect(() =>
        addCharacter('no-story', { id: 'c1', name: 'X', traits: [], relations: [] }),
      ).toThrow()
    })
  })

  describe('addPlotPoint', () => {
    it('添加情节节点', () => {
      const point: PlotPoint = {
        id: 'p1',
        chapter: 1,
        type: 'setup',
        description: '开场',
      }
      addPlotPoint(SID, point)
      expect(getStory(SID)!.plotPoints.length).toBe(1)
    })

    it('foreshadow 类型加入未回收集合', () => {
      const point: PlotPoint = {
        id: 'f1',
        chapter: 1,
        type: 'foreshadow',
        description: '神秘线索',
      }
      addPlotPoint(SID, point)
      expect(getStory(SID)!.unresolvedForeshadows.has('f1')).toBe(true)
    })

    it('resolvedForeshadowIds 回收伏笔', () => {
      addPlotPoint(SID, { id: 'f1', chapter: 1, type: 'foreshadow', description: '伏笔' })
      expect(getStory(SID)!.unresolvedForeshadows.has('f1')).toBe(true)
      addPlotPoint(SID, {
        id: 'p2',
        chapter: 3,
        type: 'resolution',
        description: '回收',
        resolvedForeshadowIds: ['f1'],
      })
      expect(getStory(SID)!.unresolvedForeshadows.has('f1')).toBe(false)
    })

    it('故事不存在时抛错', () => {
      expect(() =>
        addPlotPoint('no-story', { id: 'p1', chapter: 1, type: 'setup', description: 'x' }),
      ).toThrow()
    })
  })

  describe('checkConsistency 一致性检查', () => {
    it('无问题时返回空数组', () => {
      expect(checkConsistency(SID)).toEqual([])
    })

    it('未回收伏笔产生 warning', () => {
      addPlotPoint(SID, { id: 'f1', chapter: 1, type: 'foreshadow', description: '伏笔1' })
      const issues = checkConsistency(SID)
      expect(issues.length).toBe(1)
      expect(issues[0].type).toBe('unresolved_foreshadow')
      expect(issues[0].severity).toBe('warning')
      expect(issues[0].message).toContain('伏笔1')
    })

    it('关系目标不存在产生 critical', () => {
      addCharacter(SID, {
        id: 'c1',
        name: 'Alice',
        traits: [],
        relations: [{ targetId: 'c2', relation: 'friend' }],
      })
      const issues = checkConsistency(SID)
      expect(issues.length).toBe(1)
      expect(issues[0].type).toBe('relation_conflict')
      expect(issues[0].severity).toBe('critical')
    })

    it('关系对称检查（father vs son 合法）', () => {
      addCharacter(SID, {
        id: 'father',
        name: '父亲',
        traits: [],
        relations: [{ targetId: 'son', relation: 'father' }],
      })
      addCharacter(SID, {
        id: 'son',
        name: '儿子',
        traits: [],
        relations: [{ targetId: 'father', relation: 'son' }],
      })
      const issues = checkConsistency(SID)
      const relationIssues = issues.filter((i) => i.type === 'relation_conflict')
      expect(relationIssues.length).toBe(0)
    })

    it('关系不对称检查（father vs spouse 不合法）', () => {
      addCharacter(SID, {
        id: 'a',
        name: 'A',
        traits: [],
        relations: [{ targetId: 'b', relation: 'father' }],
      })
      addCharacter(SID, {
        id: 'b',
        name: 'B',
        traits: [],
        relations: [{ targetId: 'a', relation: 'spouse' }],
      })
      const issues = checkConsistency(SID)
      expect(issues.some((i) => i.type === 'relation_conflict' && i.severity === 'warning')).toBe(
        true,
      )
    })

    it('故事不存在返回空数组', () => {
      expect(checkConsistency('no-story')).toEqual([])
    })
  })

  describe('analyzePacing 节奏分析', () => {
    it('故事不存在返回 0 分', () => {
      const r = analyzePacing('no-story')
      expect(r.score).toBe(0)
      expect(r.totalPoints).toBe(0)
      expect(r.suggestions).toContain('故事不存在')
    })

    it('空故事给出缺失建议', () => {
      const r = analyzePacing(SID)
      expect(r.byType.setup).toBe(0)
      expect(r.suggestions).toContain('缺少开场设定（setup），读者难以进入')
      expect(r.suggestions).toContain('缺少高潮节点（climax），节奏平淡')
      expect(r.suggestions).toContain('缺少结尾收束（resolution）')
    })

    it('伏笔过多给出警告', () => {
      for (let i = 0; i < 5; i++) {
        addPlotPoint(SID, { id: `f${i}`, chapter: 1, type: 'foreshadow', description: `f${i}` })
      }
      addPlotPoint(SID, { id: 's1', chapter: 1, type: 'setup', description: 's' })
      addPlotPoint(SID, { id: 's2', chapter: 1, type: 'setup', description: 's' })
      addPlotPoint(SID, { id: 's3', chapter: 1, type: 'setup', description: 's' })
      addPlotPoint(SID, { id: 's4', chapter: 1, type: 'setup', description: 's' })
      addPlotPoint(SID, { id: 's5', chapter: 1, type: 'setup', description: 's' })
      addPlotPoint(SID, { id: 's6', chapter: 1, type: 'setup', description: 's' })
      const r = analyzePacing(SID)
      expect(r.suggestions.some((s) => s.includes('伏笔过多'))).toBe(true)
    })

    it('四幕均衡分布得高分', () => {
      addPlotPoint(SID, { id: 's1', chapter: 1, type: 'setup', description: 's' })
      addPlotPoint(SID, { id: 'c1', chapter: 2, type: 'conflict', description: 'c' })
      addPlotPoint(SID, { id: 'cl1', chapter: 3, type: 'climax', description: 'cl' })
      addPlotPoint(SID, { id: 'r1', chapter: 4, type: 'resolution', description: 'r' })
      const r = analyzePacing(SID)
      expect(r.score).toBeGreaterThanOrEqual(90)
    })

    it('byType 统计正确', () => {
      addPlotPoint(SID, { id: 's1', chapter: 1, type: 'setup', description: 's' })
      addPlotPoint(SID, { id: 's2', chapter: 1, type: 'setup', description: 's' })
      addPlotPoint(SID, { id: 'c1', chapter: 2, type: 'conflict', description: 'c' })
      const r = analyzePacing(SID)
      expect(r.byType.setup).toBe(2)
      expect(r.byType.conflict).toBe(1)
      expect(r.byType.climax).toBe(0)
      expect(r.totalPoints).toBe(3)
    })
  })

  describe('suggestChapterOutline 章节大纲', () => {
    it('故事不存在返回空数组', () => {
      expect(suggestChapterOutline('no-story', 1)).toEqual([])
    })

    it('返回章节建议列表', () => {
      const outline = suggestChapterOutline(SID, 1)
      expect(outline.length).toBeGreaterThan(0)
      expect(outline[0]).toContain('第 1 章建议聚焦')
    })

    it('第 5 章后无高潮时建议进入高潮', () => {
      addPlotPoint(SID, { id: 's1', chapter: 1, type: 'setup', description: 's' })
      addPlotPoint(SID, { id: 's2', chapter: 1, type: 'setup', description: 's' })
      addPlotPoint(SID, { id: 's3', chapter: 1, type: 'setup', description: 's' })
      const outline = suggestChapterOutline(SID, 6)
      expect(outline.some((s) => s.includes('高潮'))).toBe(true)
    })

    it('无特殊建议时给出默认推进主线建议', () => {
      addPlotPoint(SID, { id: 's1', chapter: 1, type: 'setup', description: 's' })
      addPlotPoint(SID, { id: 's2', chapter: 1, type: 'setup', description: 's' })
      addPlotPoint(SID, { id: 'c1', chapter: 2, type: 'conflict', description: 'c' })
      addPlotPoint(SID, { id: 'c2', chapter: 2, type: 'conflict', description: 'c' })
      addPlotPoint(SID, { id: 'c3', chapter: 2, type: 'conflict', description: 'c' })
      addPlotPoint(SID, { id: 'c4', chapter: 2, type: 'conflict', description: 'c' })
      addPlotPoint(SID, { id: 'f1', chapter: 1, type: 'foreshadow', description: 'f' })
      addPlotPoint(SID, { id: 'f2', chapter: 1, type: 'foreshadow', description: 'f' })
      addPlotPoint(SID, { id: 'cl1', chapter: 3, type: 'climax', description: 'cl' })
      addPlotPoint(SID, { id: 'r1', chapter: 4, type: 'resolution', description: 'r' })
      const outline = suggestChapterOutline(SID, 3)
      expect(outline[outline.length - 1]).toContain('推进主线')
    })
  })
})
