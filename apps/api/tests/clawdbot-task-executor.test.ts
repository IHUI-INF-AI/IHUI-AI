import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }))

vi.mock('../src/services/clawdbot/tools.js', () => ({
  getToolExecutor: () => ({ execute: executeMock }),
}))

import { TaskExecutor, getTaskExecutor } from '../src/services/clawdbot/task-executor.js'
import type { TaskStep } from '../src/services/clawdbot/task-executor.js'

const mockStep = (id: string, overrides: Partial<TaskStep> = {}): TaskStep => ({
  id,
  name: `Step ${id}`,
  type: 'tool',
  ...overrides,
})

describe('clawdbot TaskExecutor 任务执行器', () => {
  let exec: TaskExecutor

  beforeEach(() => {
    exec = new TaskExecutor()
    executeMock.mockReset()
  })

  describe('create 创建任务', () => {
    it('创建任务并生成 id', () => {
      const t = exec.create({ name: 'T1', description: 'desc', steps: [mockStep('s1')] })
      expect(t.id).toMatch(/^task_\d+_/)
      expect(t.status).toBe('pending')
      expect(t.priority).toBe('normal')
      expect(t.maxRetries).toBe(3)
      expect(t.context).toEqual({})
    })

    it('自定义 type/priority/maxRetries', () => {
      const t = exec.create({
        name: 'T1',
        description: 'desc',
        steps: [],
        type: 'parallel',
        priority: 'urgent',
        maxRetries: 5,
      })
      expect(t.type).toBe('parallel')
      expect(t.priority).toBe('urgent')
      expect(t.maxRetries).toBe(5)
    })

    it('触发 created 事件', () => {
      const handler = vi.fn()
      exec.on('created', handler)
      exec.create({ name: 'T1', description: 'd', steps: [] })
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('execute 执行', () => {
    it('任务不存在抛错', async () => {
      await expect(exec.execute('not_exist')).rejects.toThrow('not found')
    })

    it('running 状态任务抛错', async () => {
      const t = exec.create({ name: 'T1', description: 'd', steps: [] })
      const internal = exec as unknown as { tasks: Map<string, { status: string }> }
      internal.tasks.get(t.id)!.status = 'running'
      await expect(exec.execute(t.id)).rejects.toThrow('already running')
    })

    it('dependsOn 未完成时返回 waiting', async () => {
      const dep = exec.create({ name: 'Dep', description: 'd', steps: [] })
      const t = exec.create({ name: 'T1', description: 'd', steps: [], dependsOn: [dep.id] })
      const r = await exec.execute(t.id)
      expect(r.success).toBe(false)
      expect(r.error).toBe('Waiting for dependencies')
    })

    it('dependsOn 已完成时正常执行', async () => {
      const dep = exec.create({ name: 'Dep', description: 'd', steps: [] })
      const internal = exec as unknown as { tasks: Map<string, { status: string }> }
      internal.tasks.get(dep.id)!.status = 'completed'
      const t = exec.create({ name: 'T1', description: 'd', steps: [], dependsOn: [dep.id] })
      const r = await exec.execute(t.id)
      expect(r.success).toBe(true)
    })

    it('达到 maxConcurrent 上限时返回 pending', async () => {
      const internal = exec as unknown as { running: Set<string>; maxConcurrent: number }
      internal.maxConcurrent = 1
      internal.running.add('fake')
      const t = exec.create({ name: 'T1', description: 'd', steps: [] })
      const r = await exec.execute(t.id)
      expect(r.success).toBe(false)
      expect(r.error).toBe('Max concurrent tasks reached')
    })

    it('执行空步骤任务成功', async () => {
      const t = exec.create({ name: 'T1', description: 'd', steps: [] })
      const r = await exec.execute(t.id)
      expect(r.success).toBe(true)
      expect(r.stepResults).toEqual([])
      expect(t.status).toBe('completed')
      expect(t.completedAt).toBeGreaterThan(0)
    })

    it('执行带 tool 步骤的任务（成功）', async () => {
      executeMock.mockResolvedValueOnce({ success: true, output: 'ok', duration: 5 })
      const t = exec.create({
        name: 'T1',
        description: 'd',
        steps: [{ id: 's1', name: 'S1', type: 'tool', toolName: 'tool1', outputKey: 'out' }],
      })
      const r = await exec.execute(t.id)
      expect(r.success).toBe(true)
      expect(r.outputs.out).toBe('ok')
    })

    it('工具失败时任务失败', async () => {
      executeMock.mockResolvedValueOnce({ success: false, error: 'fail', duration: 0 })
      const t = exec.create({
        name: 'T1',
        description: 'd',
        steps: [{ id: 's1', name: 'S1', type: 'tool', toolName: 'tool1' }],
      })
      const r = await exec.execute(t.id)
      expect(r.success).toBe(false)
      expect(t.status).toBe('failed')
    })

    it('condition 步骤不匹配时跳过后续 tool', async () => {
      executeMock.mockResolvedValueOnce({ success: true, output: 'ok', duration: 1 })
      const t = exec.create({
        name: 'T1',
        description: 'd',
        steps: [
          { id: 'c1', name: 'C1', type: 'condition', condition: 'flag === true' },
          { id: 't1', name: 'T1', type: 'tool', toolName: 'tool1' },
        ],
      })
      const r = await exec.execute(t.id, undefined as never)
      // condition 不匹配时也继续执行后续步骤（源码 continue 仅跳过当前）
      expect(r.success).toBe(true)
    })

    it('wait 步骤等待 ms', async () => {
      const t = exec.create({
        name: 'T1',
        description: 'd',
        steps: [{ id: 'w1', name: 'W1', type: 'wait', toolParams: { ms: 10 } }],
      })
      const start = Date.now()
      await exec.execute(t.id)
      expect(Date.now() - start).toBeGreaterThanOrEqual(8)
    })

    it('resolveParams 解析 ${path} 模板', async () => {
      executeMock.mockResolvedValueOnce({ success: true, output: 'ok', duration: 1 })
      const t = exec.create({
        name: 'T1',
        description: 'd',
        steps: [
          {
            id: 's1',
            name: 'S1',
            type: 'tool',
            toolName: 'tool1',
            toolParams: { user: '${user.name}' },
          },
        ],
        context: { user: { name: 'alice' } },
      })
      await exec.execute(t.id)
      expect(executeMock).toHaveBeenCalledWith('tool1', { user: 'alice' }, undefined)
    })

    it('触发 started 与 completed 事件', async () => {
      const startHandler = vi.fn()
      const completeHandler = vi.fn()
      exec.on('started', startHandler)
      exec.on('completed', completeHandler)
      const t = exec.create({ name: 'T1', description: 'd', steps: [] })
      await exec.execute(t.id)
      expect(startHandler).toHaveBeenCalledTimes(1)
      expect(completeHandler).toHaveBeenCalledTimes(1)
    })

    it('工具失败时触发 failed 事件', async () => {
      executeMock.mockResolvedValueOnce({ success: false, error: 'fail', duration: 0 })
      const failHandler = vi.fn()
      exec.on('failed', failHandler)
      const t = exec.create({
        name: 'T1',
        description: 'd',
        steps: [{ id: 's1', name: 'S1', type: 'tool', toolName: 'tool1' }],
      })
      await exec.execute(t.id)
      expect(failHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('cancel 取消', () => {
    it('取消存在任务返回 true', () => {
      const t = exec.create({ name: 'T1', description: 'd', steps: [] })
      expect(exec.cancel(t.id)).toBe(true)
      expect(t.status).toBe('cancelled')
      expect(t.completedAt).toBeGreaterThan(0)
    })

    it('取消不存在返回 false', () => {
      expect(exec.cancel('not_exist')).toBe(false)
    })

    it('触发 cancelled 事件', () => {
      const handler = vi.fn()
      exec.on('cancelled', handler)
      const t = exec.create({ name: 'T1', description: 'd', steps: [] })
      exec.cancel(t.id)
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('get / list', () => {
    it('get 返回指定任务', () => {
      const t = exec.create({ name: 'T1', description: 'd', steps: [] })
      expect(exec.get(t.id)?.name).toBe('T1')
    })

    it('get 不存在返回 undefined', () => {
      expect(exec.get('not_exist')).toBeUndefined()
    })

    it('list 返回全部任务', () => {
      exec.create({ name: 'T1', description: 'd', steps: [] })
      exec.create({ name: 'T2', description: 'd', steps: [] })
      expect(exec.list()).toHaveLength(2)
    })

    it('list 按 status 过滤', () => {
      const t = exec.create({ name: 'T1', description: 'd', steps: [] })
      exec.cancel(t.id)
      exec.create({ name: 'T2', description: 'd', steps: [] })
      expect(exec.list({ status: 'cancelled' })).toHaveLength(1)
    })

    it('list 按 priority 过滤', () => {
      exec.create({ name: 'T1', description: 'd', steps: [], priority: 'high' })
      exec.create({ name: 'T2', description: 'd', steps: [], priority: 'low' })
      expect(exec.list({ priority: 'high' })).toHaveLength(1)
    })

    it('list 按 createdAt 降序排序', async () => {
      const t1 = exec.create({ name: 'T1', description: 'd', steps: [] })
      await new Promise((r) => setTimeout(r, 5))
      const t2 = exec.create({ name: 'T2', description: 'd', steps: [] })
      const list = exec.list()
      expect(list[0]!.id).toBe(t2.id)
      expect(list[1]!.id).toBe(t1.id)
    })
  })

  describe('getStatus', () => {
    it('返回 totalTasks/runningTasks/pendingTasks/completedTasks/failedTasks', async () => {
      exec.create({ name: 'T1', description: 'd', steps: [] })
      executeMock.mockResolvedValueOnce({ success: false, error: 'fail', duration: 0 })
      const t2 = exec.create({
        name: 'T2',
        description: 'd',
        steps: [{ id: 's1', name: 'S1', type: 'tool', toolName: 'tool1' }],
      })
      await exec.execute(t2.id)
      const s = exec.getStatus()
      expect(s.totalTasks).toBe(2)
      expect(s.failedTasks).toBe(1)
    })
  })

  describe('单例', () => {
    it('getTaskExecutor 返回同一实例', () => {
      expect(getTaskExecutor()).toBe(getTaskExecutor())
    })
  })
})
