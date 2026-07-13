import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { installMock, storeMock } = vi.hoisted(() => ({
  installMock: vi.fn(),
  storeMock: vi.fn(),
}))

vi.mock('../src/services/clawdbot/skills.js', () => ({
  getSkillManager: () => ({
    install: installMock,
    getStats: () => ({ total: 0 }),
  }),
}))

vi.mock('../src/services/clawdbot/memory.js', () => ({
  getMemoryService: () => ({ store: storeMock }),
}))

import {
  SelfEvolutionEngine,
  getSelfEvolutionEngine,
} from '../src/services/clawdbot/self-evolution.js'

describe('clawdbot SelfEvolutionEngine 自我进化引擎', () => {
  let engine: SelfEvolutionEngine

  beforeEach(() => {
    engine = new SelfEvolutionEngine()
    installMock.mockReset()
    storeMock.mockReset()
  })

  describe('enableAutoEvolution / disableAutoEvolution', () => {
    it('enableAutoEvolution 设置 autoEvolve=true', () => {
      engine.enableAutoEvolution()
      const s = engine.getStatus()
      expect(s.autoEvolve).toBe(true)
    })

    it('enableAutoEvolution 触发 autoEvolveEnabled 事件', () => {
      const handler = vi.fn()
      engine.on('autoEvolveEnabled', handler)
      engine.enableAutoEvolution()
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('disableAutoEvolution 设置 autoEvolve=false', () => {
      engine.enableAutoEvolution()
      engine.disableAutoEvolution()
      expect(engine.getStatus().autoEvolve).toBe(false)
    })

    it('disableAutoEvolution 触发 autoEvolveDisabled 事件', () => {
      const handler = vi.fn()
      engine.on('autoEvolveDisabled', handler)
      engine.disableAutoEvolution()
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('recordBehavior 行为记录', () => {
    it('首次记录创建新 pattern', () => {
      engine.recordBehavior('p1', true)
      const list = engine.listPatterns()
      expect(list).toHaveLength(1)
      expect(list[0]!.pattern).toBe('p1')
      expect(list[0]!.frequency).toBe(1)
      expect(list[0]!.successRate).toBe(1)
    })

    it('重复记录累加 frequency', () => {
      engine.recordBehavior('p1', true)
      engine.recordBehavior('p1', false)
      const list = engine.listPatterns()
      expect(list[0]!.frequency).toBe(2)
      expect(list[0]!.successRate).toBe(0.5)
    })

    it('触发 behaviorRecorded 事件', () => {
      const handler = vi.fn()
      engine.on('behaviorRecorded', handler)
      engine.recordBehavior('p1', true)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('autoEvolve + 低成功率（>10 次）触发 detectGap', () => {
      engine.enableAutoEvolution()
      const gapHandler = vi.fn()
      engine.on('gapDetected', gapHandler)
      // 11 次失败
      for (let i = 0; i < 11; i++) engine.recordBehavior('p1', false)
      expect(gapHandler).toHaveBeenCalled()
    })

    it('listPatterns 按 frequency 降序排序', () => {
      engine.recordBehavior('p1', true)
      engine.recordBehavior('p1', true)
      engine.recordBehavior('p2', true)
      const list = engine.listPatterns()
      expect(list[0]!.pattern).toBe('p1')
    })
  })

  describe('detectGap 缺口检测', () => {
    it('创建新 gap', () => {
      const g = engine.detectGap('desc1', 'medium')
      expect(g.id).toMatch(/^gap_\d+_/)
      expect(g.description).toBe('desc1')
      expect(g.severity).toBe('medium')
      expect(g.resolved).toBe(false)
    })

    it('触发 gapDetected 事件', () => {
      const handler = vi.fn()
      engine.on('gapDetected', handler)
      engine.detectGap('d', 'low')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('listGaps 默认不返回已解决', () => {
      engine.detectGap('d1', 'low')
      expect(engine.listGaps()).toHaveLength(1)
    })

    it('listGaps includeResolved=true 返回全部', () => {
      engine.detectGap('d1', 'low')
      expect(engine.listGaps(true)).toHaveLength(1)
    })
  })

  describe('evolve 进化', () => {
    it('无 gap 时抛错', async () => {
      await expect(engine.evolve()).rejects.toThrow('No gap to evolve')
    })

    it('成功进化创建技能并标记 gap 已解决', async () => {
      const g = engine.detectGap('d1', 'high')
      const task = await engine.evolve(g.id)
      expect(task.status).toBe('completed')
      expect(task.result?.success).toBe(true)
      expect(task.result?.skillName).toMatch(/^auto_skill_/)
      expect(installMock).toHaveBeenCalledTimes(1)
      expect(storeMock).toHaveBeenCalledTimes(1)
      // gap 已解决
      expect(engine.listGaps()).toHaveLength(0)
      expect(engine.listGaps(true)).toHaveLength(1)
    })

    it('触发 taskStarted/taskProgress/taskCompleted 事件', async () => {
      const startedHandler = vi.fn()
      const progressHandler = vi.fn()
      const completedHandler = vi.fn()
      engine.on('taskStarted', startedHandler)
      engine.on('taskProgress', progressHandler)
      engine.on('taskCompleted', completedHandler)
      const g = engine.detectGap('d1', 'high')
      await engine.evolve(g.id)
      expect(startedHandler).toHaveBeenCalledTimes(1)
      expect(progressHandler).toHaveBeenCalledTimes(1)
      expect(completedHandler).toHaveBeenCalledTimes(1)
    })

    it('触发 skillInstalled 事件', async () => {
      const handler = vi.fn()
      engine.on('skillInstalled', handler)
      const g = engine.detectGap('d1', 'high')
      await engine.evolve(g.id)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('install 抛错时 task 标记为 failed', async () => {
      installMock.mockImplementation(() => {
        throw new Error('install failed')
      })
      const g = engine.detectGap('d1', 'high')
      const task = await engine.evolve(g.id)
      expect(task.status).toBe('failed')
      expect(task.result?.success).toBe(false)
      expect(task.result?.error).toBe('install failed')
    })

    it('无 gapId 时自动选取首个未解决 gap', async () => {
      engine.detectGap('d1', 'high')
      const task = await engine.evolve()
      expect(task.status).toBe('completed')
    })
  })

  describe('getEvolutionTask / listEvolutionTasks', () => {
    it('getEvolutionTask 返回指定任务', async () => {
      const g = engine.detectGap('d1', 'high')
      const t = await engine.evolve(g.id)
      expect(engine.getEvolutionTask(t.id)?.id).toBe(t.id)
    })

    it('listEvolutionTasks 返回全部任务', async () => {
      const g1 = engine.detectGap('d1', 'high')
      const g2 = engine.detectGap('d2', 'high')
      await engine.evolve(g1.id)
      await engine.evolve(g2.id)
      expect(engine.listEvolutionTasks()).toHaveLength(2)
    })
  })

  describe('getStatus', () => {
    it('返回 skillsCount/gapsCount/autoEvolve/patternsCount/evolutionTasks', () => {
      engine.recordBehavior('p1', true)
      engine.detectGap('d1', 'low')
      const s = engine.getStatus()
      expect(s.gapsCount).toBe(1)
      expect(s.patternsCount).toBe(1)
      expect(s.autoEvolve).toBe(false)
    })
  })

  describe('单例', () => {
    it('getSelfEvolutionEngine 返回同一实例', () => {
      expect(getSelfEvolutionEngine()).toBe(getSelfEvolutionEngine())
    })
  })
})
