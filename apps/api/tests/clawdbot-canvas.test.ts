import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }))

vi.mock('../src/services/clawdbot/nodes.js', () => ({
  getNodeExecutor: () => ({ register: vi.fn(), execute: executeMock }),
}))

import { CanvasService, getCanvasService } from '../src/services/clawdbot/canvas.js'
import type { Canvas } from '../src/services/clawdbot/canvas.js'

const mockCanvas = (
  id: string,
  overrides: Partial<Canvas> = {},
): Omit<Canvas, 'createdAt' | 'updatedAt' | 'version'> => ({
  id,
  name: `Canvas ${id}`,
  description: 'desc',
  nodes: [],
  edges: [],
  ...overrides,
})

describe('clawdbot CanvasService 画布服务', () => {
  let svc: CanvasService

  beforeEach(() => {
    svc = new CanvasService()
    executeMock.mockReset()
  })

  describe('create 创建画布', () => {
    it('创建画布并自动设置 version/createdAt/updatedAt', () => {
      const c = svc.create(mockCanvas('c1'))
      expect(c.version).toBe(1)
      expect(c.createdAt).toBeGreaterThan(0)
      expect(c.updatedAt).toBeGreaterThan(0)
      expect(svc.get('c1')).toBeDefined()
    })

    it('触发 created 事件', () => {
      const handler = vi.fn()
      svc.on('created', handler)
      svc.create(mockCanvas('c1'))
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('get / list', () => {
    it('get 返回指定画布', () => {
      svc.create(mockCanvas('c1'))
      expect(svc.get('c1')?.name).toBe('Canvas c1')
    })

    it('get 不存在返回 undefined', () => {
      expect(svc.get('not_exist')).toBeUndefined()
    })

    it('list 返回全部画布', () => {
      svc.create(mockCanvas('c1'))
      svc.create(mockCanvas('c2'))
      expect(svc.list()).toHaveLength(2)
    })
  })

  describe('update 更新', () => {
    it('更新存在画布返回新版本', () => {
      svc.create(mockCanvas('c1'))
      const r = svc.update('c1', { name: 'Updated' })
      expect(r?.name).toBe('Updated')
      expect(r?.version).toBe(2)
      expect(r?.updatedAt).toBeGreaterThanOrEqual(r!.createdAt)
    })

    it('更新不存在返回 null', () => {
      expect(svc.update('not_exist', {})).toBeNull()
    })

    it('触发 updated 事件', () => {
      const handler = vi.fn()
      svc.on('updated', handler)
      svc.create(mockCanvas('c1'))
      svc.update('c1', { name: 'x' })
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('delete 删除', () => {
    it('删除存在画布返回 true', () => {
      svc.create(mockCanvas('c1'))
      expect(svc.delete('c1')).toBe(true)
      expect(svc.get('c1')).toBeUndefined()
    })

    it('删除不存在返回 false', () => {
      expect(svc.delete('not_exist')).toBe(false)
    })

    it('触发 deleted 事件', () => {
      const handler = vi.fn()
      svc.on('deleted', handler)
      svc.create(mockCanvas('c1'))
      svc.delete('c1')
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('execute 执行', () => {
    it('画布不存在返回失败', async () => {
      const r = await svc.execute('not_exist', {})
      expect(r.success).toBe(false)
      expect(r.error).toBe('Canvas not found')
    })

    it('无 start 节点且无任何节点时返回失败', async () => {
      const c = svc.create(mockCanvas('c1', { nodes: [] }))
      const r = await svc.execute(c.id, {})
      expect(r.success).toBe(false)
      expect(r.error).toBe('No start node')
    })

    it('execute 成功路径返回 outputs', async () => {
      executeMock.mockResolvedValueOnce({ success: true, nextNodes: [], output: 'done' })
      const c = svc.create(
        mockCanvas('c1', {
          nodes: [{ id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        }),
      )
      const r = await svc.execute(c.id, { input: 'x' })
      expect(r.success).toBe(true)
      expect(r.error).toBeUndefined()
    })

    it('execute 节点失败时画布失败', async () => {
      executeMock.mockResolvedValueOnce({ success: false, nextNodes: [], error: 'fail' })
      const c = svc.create(
        mockCanvas('c1', {
          nodes: [{ id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        }),
      )
      const r = await svc.execute(c.id, {})
      expect(r.success).toBe(false)
      expect(r.error).toBe('fail')
    })

    it('execute nextNodes 跨多个节点执行', async () => {
      executeMock
        .mockResolvedValueOnce({ success: true, nextNodes: ['n2'], output: 's1' })
        .mockResolvedValueOnce({ success: true, nextNodes: [], output: 's2' })
      const c = svc.create(
        mockCanvas('c1', {
          nodes: [
            { id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: {} },
            { id: 'n2', type: 'action', position: { x: 0, y: 0 }, data: {} },
          ],
          edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
        }),
      )
      const r = await svc.execute(c.id, {})
      expect(r.success).toBe(true)
      expect(executeMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('getStats', () => {
    it('返回 total 数', () => {
      svc.create(mockCanvas('c1'))
      svc.create(mockCanvas('c2'))
      expect(svc.getStats().total).toBe(2)
    })
  })

  describe('单例', () => {
    it('getCanvasService 返回同一实例', () => {
      expect(getCanvasService()).toBe(getCanvasService())
    })
  })
})
