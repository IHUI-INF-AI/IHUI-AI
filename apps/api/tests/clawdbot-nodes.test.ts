import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { NodeExecutor, getNodeExecutor } from '../src/services/clawdbot/nodes.js'
import type { NodeExecutionContext } from '../src/services/clawdbot/nodes.js'

const ctx = (overrides: Partial<NodeExecutionContext> = {}): NodeExecutionContext => ({
  workflowId: 'wf1',
  inputs: {},
  outputs: {},
  visited: new Set<string>(),
  currentNodeId: null,
  ...overrides,
})

describe('clawdbot NodeExecutor 节点系统', () => {
  let exec: NodeExecutor

  beforeEach(() => {
    exec = new NodeExecutor()
  })

  describe('register / get / list', () => {
    it('register 注册节点', () => {
      exec.register({ id: 'n1', type: 'start', name: 'N1', config: {} })
      expect(exec.get('n1')).toBeDefined()
    })

    it('register 触发 registered 事件', () => {
      const handler = vi.fn()
      exec.on('registered', handler)
      exec.register({ id: 'n1', type: 'start', name: 'N1', config: {} })
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('get 不存在返回 undefined', () => {
      expect(exec.get('not_exist')).toBeUndefined()
    })

    it('list 返回全部', () => {
      exec.register({ id: 'n1', type: 'start', name: 'N1', config: {} })
      exec.register({ id: 'n2', type: 'end', name: 'N2', config: {} })
      expect(exec.list()).toHaveLength(2)
    })
  })

  describe('execute 执行', () => {
    it('节点不存在返回失败', async () => {
      const r = await exec.execute('not_exist', ctx())
      expect(r.success).toBe(false)
      expect(r.error).toBe('Node not found')
    })

    it('循环引用检测返回失败', async () => {
      exec.register({ id: 'n1', type: 'start', name: 'N1', config: {} })
      const c = ctx({ visited: new Set(['n1']) })
      const r = await exec.execute('n1', c)
      expect(r.success).toBe(false)
      expect(r.error).toBe('Circular reference detected')
    })

    it('start 节点返回 next 节点列表', async () => {
      exec.register({ id: 'n1', type: 'start', name: 'N1', config: {}, next: ['n2'] })
      const r = await exec.execute('n1', ctx())
      expect(r.success).toBe(true)
      expect(r.nextNodes).toEqual(['n2'])
    })

    it('end 节点返回空 nextNodes', async () => {
      exec.register({ id: 'n1', type: 'end', name: 'N1', config: {} })
      const r = await exec.execute('n1', ctx())
      expect(r.success).toBe(true)
      expect(r.nextNodes).toEqual([])
    })

    it('condition 节点匹配分支', async () => {
      exec.register({
        id: 'n1',
        type: 'condition',
        name: 'N1',
        config: {},
        branches: [
          { condition: 'outputs.x > 5', next: 'n_high' },
          { condition: 'outputs.x <= 5', next: 'n_low' },
        ],
      })
      const r = await exec.execute('n1', ctx({ outputs: { x: 10 } as never }))
      expect(r.nextNodes).toEqual(['n_high'])
    })

    it('condition 无匹配回退到 next', async () => {
      exec.register({
        id: 'n1',
        type: 'condition',
        name: 'N1',
        config: {},
        branches: [],
        next: ['n_default'],
      })
      const r = await exec.execute('n1', ctx())
      expect(r.nextNodes).toEqual(['n_default'])
    })

    it('loop 节点执行后返回 next（visited 限制仅能执行 1 次 body）', async () => {
      exec.register({ id: 'body', type: 'action', name: 'Body', config: { step: 1 } })
      exec.register({
        id: 'loop1',
        type: 'loop',
        name: 'L1',
        config: { count: 3, body: 'body' },
        next: ['n2'],
      })
      const r = await exec.execute('loop1', ctx())
      expect(r.success).toBe(true)
      expect(r.nextNodes).toEqual(['n2'])
    })

    it('parallel 节点并行执行所有 next', async () => {
      exec.register({ id: 'p1', type: 'parallel', name: 'P1', config: {}, next: ['a', 'b'] })
      exec.register({ id: 'a', type: 'action', name: 'A', config: {} })
      exec.register({ id: 'b', type: 'action', name: 'B', config: {} })
      const r = await exec.execute('p1', ctx())
      expect(r.success).toBe(true)
      expect(r.nextNodes).toEqual([])
    })

    it('delay 节点等待 ms 后返回 next', async () => {
      exec.register({ id: 'd1', type: 'delay', name: 'D1', config: { ms: 10 }, next: ['n2'] })
      const r = await exec.execute('d1', ctx())
      expect(r.success).toBe(true)
      expect(r.nextNodes).toEqual(['n2'])
    })

    it('default (action) 节点输出 config 并返回 next', async () => {
      exec.register({ id: 'a1', type: 'action', name: 'A1', config: { foo: 'bar' }, next: ['n2'] })
      const c = ctx()
      const r = await exec.execute('a1', c)
      expect(r.success).toBe(true)
      expect(r.output).toEqual({ foo: 'bar' })
      expect(c.outputs['a1']).toEqual({ foo: 'bar' })
    })

    it('执行后 visited 包含该节点', async () => {
      exec.register({ id: 'n1', type: 'start', name: 'N1', config: {} })
      const c = ctx()
      await exec.execute('n1', c)
      expect(c.visited.has('n1')).toBe(true)
    })

    it('执行后 currentNodeId 设为该节点', async () => {
      exec.register({ id: 'n1', type: 'start', name: 'N1', config: {} })
      const c = ctx()
      await exec.execute('n1', c)
      expect(c.currentNodeId).toBe('n1')
    })

    it('触发 executing 与 executed 事件', async () => {
      const execHandler = vi.fn()
      const executedHandler = vi.fn()
      exec.on('executing', execHandler)
      exec.on('executed', executedHandler)
      exec.register({ id: 'n1', type: 'start', name: 'N1', config: {} })
      await exec.execute('n1', ctx())
      expect(execHandler).toHaveBeenCalledTimes(1)
      expect(executedHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('getStats 统计', () => {
    it('返回 total 与 byType 分类', () => {
      exec.register({ id: 'n1', type: 'start', name: 'N1', config: {} })
      exec.register({ id: 'n2', type: 'end', name: 'N2', config: {} })
      exec.register({ id: 'n3', type: 'action', name: 'N3', config: {} })
      const s = exec.getStats()
      expect(s.total).toBe(3)
      expect(s.byType.start).toBe(1)
      expect(s.byType.end).toBe(1)
      expect(s.byType.action).toBe(1)
    })
  })

  describe('单例', () => {
    it('getNodeExecutor 返回同一实例', () => {
      expect(getNodeExecutor()).toBe(getNodeExecutor())
    })
  })
})
