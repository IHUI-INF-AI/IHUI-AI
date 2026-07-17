import { describe, expect, it } from 'vitest'
import { generateReminders, type ReminderContext } from '../src/reminders.js'

function makeCtx(overrides: Partial<ReminderContext> = {}): ReminderContext {
  return {
    iterations: 1,
    maxIterations: 20,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    contextLimit: 8000,
    injected: new Set<string>(),
    ...overrides,
  }
}

describe('P1-2 generateReminders 系统提醒自动注入', () => {
  describe('context budget reminder(70% 阈值)', () => {
    it('tokens 未达 70% 阈值不注入', () => {
      const ctx = makeCtx({
        totalPromptTokens: 3000,
        totalCompletionTokens: 1000,
        contextLimit: 8000,
      })
      // 总 4000,阈值 5600(70%),未达
      const reminders = generateReminders(ctx)
      expect(reminders).toHaveLength(0)
      expect(ctx.injected.has('context_budget')).toBe(false)
    })

    it('tokens 刚达 70% 阈值注入', () => {
      const ctx = makeCtx({
        totalPromptTokens: 4500,
        totalCompletionTokens: 1100,
        contextLimit: 8000,
      })
      // 总 5600 = 70%,刚达
      const reminders = generateReminders(ctx)
      expect(reminders).toHaveLength(1)
      expect(reminders[0]).toContain('上下文窗口已用')
      expect(reminders[0]).toContain('70%')
      expect(ctx.injected.has('context_budget')).toBe(true)
    })

    it('tokens 超过 70% 阈值注入', () => {
      const ctx = makeCtx({
        totalPromptTokens: 6000,
        totalCompletionTokens: 1000,
        contextLimit: 8000,
      })
      // 总 7000 / 8000 = 87.5%,Math.round(87.5) = 88
      const reminders = generateReminders(ctx)
      expect(reminders).toHaveLength(1)
      expect(reminders[0]).toContain('88%')
      expect(ctx.injected.has('context_budget')).toBe(true)
    })

    it('已注入过 context_budget 不重复注入', () => {
      const ctx = makeCtx({
        totalPromptTokens: 6000,
        totalCompletionTokens: 1000,
        contextLimit: 8000,
        injected: new Set(['context_budget']),
      })
      const reminders = generateReminders(ctx)
      // 只可能注入 iteration progress(取决于 iterations)
      // iterations=1 不是 5 的倍数,所以无 iteration progress
      expect(reminders.filter((r) => r.includes('上下文窗口'))).toHaveLength(0)
    })

    it('contextLimit=0 不注入(禁用)', () => {
      const ctx = makeCtx({
        totalPromptTokens: 99999,
        totalCompletionTokens: 99999,
        contextLimit: 0,
      })
      const reminders = generateReminders(ctx)
      expect(reminders.filter((r) => r.includes('上下文窗口'))).toHaveLength(0)
    })

    it('提醒文本包含 token 数和上下文窗口大小', () => {
      const ctx = makeCtx({
        totalPromptTokens: 4000,
        totalCompletionTokens: 2000,
        contextLimit: 8000,
        iterations: 1,
      })
      // iterations=1 不是 5 的倍数,只可能有 context_budget
      const reminders = generateReminders(ctx)
      expect(reminders).toHaveLength(1)
      expect(reminders[0]).toContain('6000')
      expect(reminders[0]).toContain('8000')
    })
  })

  describe('iteration progress reminder(每 5 轮)', () => {
    it('第 5 轮注入进度提醒', () => {
      const ctx = makeCtx({
        iterations: 5,
        maxIterations: 20,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
      })
      const reminders = generateReminders(ctx)
      expect(reminders).toHaveLength(1)
      expect(reminders[0]).toContain('5/20')
      expect(reminders[0]).toContain('15')  // remaining 15
    })

    it('第 10 轮注入进度提醒', () => {
      const ctx = makeCtx({
        iterations: 10,
        maxIterations: 20,
      })
      const reminders = generateReminders(ctx)
      expect(reminders.some((r) => r.includes('10/20'))).toBe(true)
    })

    it('第 4 轮不注入进度提醒', () => {
      const ctx = makeCtx({
        iterations: 4,
        maxIterations: 20,
      })
      const reminders = generateReminders(ctx)
      expect(reminders).toHaveLength(0)
    })

    it('最后一轮(iterations === maxIterations)不注入进度提醒', () => {
      const ctx = makeCtx({
        iterations: 20,
        maxIterations: 20,
      })
      const reminders = generateReminders(ctx)
      // 第 20 轮 = 最后一轮,不注入进度提醒
      expect(reminders.some((r) => r.includes('20/20'))).toBe(false)
    })

    it('iterations=0 不注入进度提醒', () => {
      const ctx = makeCtx({
        iterations: 0,
        maxIterations: 20,
      })
      const reminders = generateReminders(ctx)
      expect(reminders).toHaveLength(0)
    })

    it('第 15 轮 + 70% token 同时触发两条提醒', () => {
      const ctx = makeCtx({
        iterations: 15,
        maxIterations: 20,
        totalPromptTokens: 5000,
        totalCompletionTokens: 1000,
        contextLimit: 8000,
      })
      const reminders = generateReminders(ctx)
      expect(reminders).toHaveLength(2)
      expect(reminders.some((r) => r.includes('上下文窗口'))).toBe(true)
      expect(reminders.some((r) => r.includes('15/20'))).toBe(true)
    })
  })

  describe('副作用与跨迭代持久化', () => {
    it('generateReminders 把 context_budget 加入 injected Set', () => {
      const injected = new Set<string>()
      const ctx = makeCtx({
        totalPromptTokens: 6000,
        totalCompletionTokens: 1000,
        contextLimit: 8000,
        injected,
      })
      generateReminders(ctx)
      expect(injected.has('context_budget')).toBe(true)
    })

    it('跨迭代持久化:第二轮调用不再注入 context_budget', () => {
      const injected = new Set<string>()
      // 第一轮:tokens 达 70%,注入 context_budget
      const ctx1 = makeCtx({
        totalPromptTokens: 6000,
        totalCompletionTokens: 1000,
        contextLimit: 8000,
        iterations: 1,
        injected,
      })
      const reminders1 = generateReminders(ctx1)
      expect(reminders1).toHaveLength(1)
      expect(reminders1[0]).toContain('上下文窗口')

      // 第二轮:tokens 继续增加,但 injected 已有 context_budget → 不重复注入
      const ctx2 = makeCtx({
        totalPromptTokens: 7000,
        totalCompletionTokens: 1200,
        contextLimit: 8000,
        iterations: 2,  // 不是 5 的倍数,无 iteration progress
        injected,  // 复用同一个 Set
      })
      const reminders2 = generateReminders(ctx2)
      expect(reminders2).toHaveLength(0)
    })

    it('iteration progress 每轮都注入(不依赖 injected Set)', () => {
      const injected = new Set<string>()
      const ctx = makeCtx({
        iterations: 5,
        maxIterations: 20,
        injected,
      })
      const reminders1 = generateReminders(ctx)
      expect(reminders1.some((r) => r.includes('5/20'))).toBe(true)
      // 同一轮再调用一次(假设场景)
      const reminders2 = generateReminders(ctx)
      expect(reminders2.some((r) => r.includes('5/20'))).toBe(true)
      // iteration progress 不进 injected Set,每轮都注入(符合"每 5 轮提醒"语义)
      expect(injected.has('iteration_progress')).toBe(false)
    })
  })

  describe('边界场景', () => {
    it('maxIterations=0 时无 iteration progress', () => {
      const ctx = makeCtx({
        iterations: 0,
        maxIterations: 0,
      })
      const reminders = generateReminders(ctx)
      expect(reminders).toHaveLength(0)
    })

    it('contextLimit 为负数不注入 context_budget', () => {
      const ctx = makeCtx({
        totalPromptTokens: 99999,
        totalCompletionTokens: 99999,
        contextLimit: -1,
        iterations: 1,
      })
      const reminders = generateReminders(ctx)
      expect(reminders).toHaveLength(0)
    })

    it('iterations 超过 maxIterations 不注入 iteration progress', () => {
      const ctx = makeCtx({
        iterations: 25,
        maxIterations: 20,
      })
      const reminders = generateReminders(ctx)
      // 25 % 5 === 0 但 iterations > maxIterations(不应发生,但防御性处理)
      // 当前实现:iterations > 0 && iterations < maxIterations 才注入
      expect(reminders.some((r) => r.includes('25/20'))).toBe(false)
    })
  })
})
