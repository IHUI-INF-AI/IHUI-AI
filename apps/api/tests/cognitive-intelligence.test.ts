import { describe, it, expect, beforeEach } from 'vitest'
import {
  getContext,
  clearContext,
  understand,
  reason,
  learnPreference,
  getPreferences,
  rememberFact,
  recallFact,
  listFacts,
} from '../src/services/ai/cognitive-intelligence.js'

describe('cognitive-intelligence 服务', () => {
  const SID = 'test-session-cog'

  beforeEach(() => {
    clearContext(SID)
  })

  describe('getContext / clearContext', () => {
    it('首次获取创建新上下文', () => {
      const ctx = getContext(SID)
      expect(ctx.sessionId).toBe(SID)
      expect(ctx.shortTermMemory).toEqual([])
      expect(ctx.longTermMemoryFacts).toBeInstanceOf(Map)
      expect(ctx.preferences).toBeInstanceOf(Map)
    })

    it('再次获取返回同一实例', () => {
      const ctx1 = getContext(SID)
      const ctx2 = getContext(SID)
      expect(ctx1).toBe(ctx2)
    })

    it('clearContext 后获取是新实例', () => {
      const ctx1 = getContext(SID)
      ctx1.shortTermMemory.push('hello')
      clearContext(SID)
      const ctx2 = getContext(SID)
      expect(ctx2).not.toBe(ctx1)
      expect(ctx2.shortTermMemory).toEqual([])
    })
  })

  describe('understand 意图识别', () => {
    it('问句识别为 question', () => {
      const r = understand('什么是 AI？')
      expect(r.intent).toBe('question')
    })

    it('英文问句识别为 question', () => {
      const r = understand('what is AI?')
      expect(r.intent).toBe('question')
    })

    it('命令识别为 command', () => {
      const r = understand('请帮我创建一个文件')
      expect(r.intent).toBe('command')
    })

    it('感叹/情绪识别为 emotion', () => {
      const r = understand('今天很开心！')
      expect(r.intent).toBe('emotion')
    })

    it('长陈述识别为 statement', () => {
      const r = understand('这是一段足够长的陈述句子内容')
      expect(r.intent).toBe('statement')
    })

    it('数字实体识别', () => {
      const r = understand('买了 3 个苹果花了 50 元')
      const numbers = r.entities.filter((e) => e.type === 'number')
      expect(numbers.length).toBe(2)
      expect(numbers.map((e) => e.value)).toEqual(['3', '50'])
    })

    it('时间实体识别', () => {
      const r = understand('2024年7月15日今天开会')
      const times = r.entities.filter((e) => e.type === 'time')
      expect(times.length).toBeGreaterThanOrEqual(2)
    })

    it('正面情感分析', () => {
      const r = understand('这个东西真好，我喜欢')
      expect(r.sentiment).toBe('positive')
    })

    it('负面情感分析', () => {
      const r = understand('太差了，讨厌')
      expect(r.sentiment).toBe('negative')
    })

    it('中性情感分析', () => {
      const r = understand('今天天气晴朗')
      expect(r.sentiment).toBe('neutral')
    })

    it('带 sessionId 时写入短时记忆', () => {
      understand('第一句话', SID)
      understand('第二句话', SID)
      const ctx = getContext(SID)
      expect(ctx.shortTermMemory).toEqual(['第一句话', '第二句话'])
    })

    it('短时记忆超过 10 条时移除最旧的', () => {
      for (let i = 0; i < 12; i++) {
        understand(`消息${i}`, SID)
      }
      const ctx = getContext(SID)
      expect(ctx.shortTermMemory.length).toBe(10)
      expect(ctx.shortTermMemory[0]).toBe('消息2')
      expect(ctx.shortTermMemory[9]).toBe('消息11')
    })

    it('主题识别基于长时记忆', () => {
      rememberFact(SID, 'AI', '人工智能')
      const r = understand('AI 是什么？', SID)
      expect(r.topics).toContain('AI')
    })
  })

  describe('reason 推理', () => {
    it('多前提有共性词时归纳推理', () => {
      const r = reason(['mammal cat', 'mammal dog', 'mammal human'])
      expect(r.type).toBe('induction')
      expect(r.confidence).toBeGreaterThan(0.5)
      expect(r.conclusion).toContain('归纳')
    })

    it('单前提无共性时溯因推理', () => {
      const r = reason(['只有一句话'])
      expect(r.type).toBe('abduction')
      expect(r.confidence).toBe(0.3)
    })

    it('基于已知事实演绎推理', () => {
      rememberFact(SID, '地球', '行星')
      const r = reason(['地球是圆的'], SID)
      expect(r.type).toBe('deduction')
      expect(r.confidence).toBe(0.8)
      expect(r.conclusion).toContain('演绎')
    })

    it('归纳推理置信度有上限 0.9', () => {
      const r = reason(['common a', 'common b', 'common c', 'common d', 'common e'])
      expect(r.confidence).toBeLessThanOrEqual(0.9)
    })
  })

  describe('learnPreference / getPreferences', () => {
    it('正面反馈增加权重', () => {
      learnPreference(SID, 'dark-mode', true)
      const prefs = getPreferences(SID)
      expect(prefs[0].weight).toBe(0.1)
    })

    it('负面反馈减少权重', () => {
      learnPreference(SID, 'light-mode', false)
      const prefs = getPreferences(SID)
      expect(prefs[0].weight).toBe(-0.1)
    })

    it('多次反馈累积', () => {
      learnPreference(SID, 'lang', true)
      learnPreference(SID, 'lang', true)
      learnPreference(SID, 'lang', true)
      const prefs = getPreferences(SID)
      expect(prefs[0].weight).toBeCloseTo(0.3, 5)
    })

    it('权重限制在 [-1, 1]', () => {
      for (let i = 0; i < 20; i++) learnPreference(SID, 'limit', true)
      const prefs = getPreferences(SID)
      expect(prefs[0].weight).toBe(1)
    })

    it('getPreferences topK 截断', () => {
      for (let i = 0; i < 5; i++) {
        learnPreference(SID, `key${i}`, true)
      }
      const prefs = getPreferences(SID, 3)
      expect(prefs.length).toBe(3)
    })

    it('偏好按绝对值排序', () => {
      learnPreference(SID, 'small', true) // 0.1
      learnPreference(SID, 'big', true)
      learnPreference(SID, 'big', true)
      learnPreference(SID, 'big', true) // 0.3
      const prefs = getPreferences(SID)
      expect(prefs[0].key).toBe('big')
    })
  })

  describe('rememberFact / recallFact / listFacts', () => {
    it('写入并查询事实', () => {
      rememberFact(SID, 'name', 'Alice')
      expect(recallFact(SID, 'name')).toBe('Alice')
    })

    it('查询不存在的事实返回 undefined', () => {
      expect(recallFact(SID, 'nonexistent')).toBeUndefined()
    })

    it('listFacts 返回所有事实', () => {
      rememberFact(SID, 'a', '1')
      rememberFact(SID, 'b', '2')
      const facts = listFacts(SID)
      expect(facts.length).toBe(2)
      expect(facts.map((f) => f.key)).toContain('a')
      expect(facts.map((f) => f.key)).toContain('b')
    })

    it('覆盖写入更新值', () => {
      rememberFact(SID, 'k', 'v1')
      rememberFact(SID, 'k', 'v2')
      expect(recallFact(SID, 'k')).toBe('v2')
    })
  })
})
