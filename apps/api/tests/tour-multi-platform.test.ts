import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDbSelect, mockDbInsert } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
  },
  dbRead: {},
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  tourContent: {
    id: 'id',
    title: 'title',
    summary: 'summary',
    coverImage: 'cover_image',
    content: 'content',
  },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// 拦截 processEvents 与 publish 的内部调用
const { processEventsMock, publishMock } = vi.hoisted(() => ({
  processEventsMock: vi.fn(),
  publishMock: vi.fn(),
}))

vi.mock('../src/services/tour/tour-event-bus.js', () => ({
  processEvents: processEventsMock,
  publish: publishMock,
}))

import {
  registerAdapter,
  listAdapters,
  multiPlatformDispatcher,
  distributeContent,
  consoleAdapter,
} from '../src/services/tour/tour-multi-platform.js'
import type { PlatformAdapter, TourEvent } from '../src/services/tour/tour-event-bus.js'
import type { Platform } from '../src/services/tour/tour-multi-platform.js'

describe('tour-multi-platform — 多平台分发', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // adapters 是模块级 Map 无公开 clear，将所有已注册 adapter enabled=false 屏蔽
    for (const a of listAdapters()) {
      a.enabled = false
    }
  })

  describe('registerAdapter / listAdapters', () => {
    it('registerAdapter 注册适配器', () => {
      const adapter: PlatformAdapter = {
        platform: 'web',
        enabled: true,
        distribute: vi.fn(),
      }
      registerAdapter(adapter)
      const list = listAdapters()
      expect(list.some((a) => a.platform === 'web')).toBe(true)
    })

    it('重复注册同平台覆盖旧适配器', () => {
      const a1: PlatformAdapter = {
        platform: 'wechat_oa' as Platform,
        enabled: true,
        distribute: vi.fn(),
      }
      const a2: PlatformAdapter = {
        platform: 'wechat_oa' as Platform,
        enabled: false,
        distribute: vi.fn(),
      }
      registerAdapter(a1)
      registerAdapter(a2)
      const list = listAdapters()
      const found = list.find((a) => a.platform === 'wechat_oa')
      expect(found?.enabled).toBe(false)
    })
  })

  describe('multiPlatformDispatcher.dispatch', () => {
    it('非 content.published 事件直接返回', async () => {
      await multiPlatformDispatcher.dispatch({
        id: 'e1',
        type: 'other.event',
        payload: { contentId: 'c1' },
        status: 'pending',
        attempts: 0,
      } as TourEvent)
      expect(mockDbSelect).not.toHaveBeenCalled()
    })

    it('无 contentId 时直接返回', async () => {
      await multiPlatformDispatcher.dispatch({
        id: 'e1',
        type: 'content.published',
        payload: {},
        status: 'pending',
        attempts: 0,
      } as TourEvent)
      expect(mockDbSelect).not.toHaveBeenCalled()
    })

    it('内容不存在时不抛错', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })
      await expect(
        multiPlatformDispatcher.dispatch({
          id: 'e1',
          type: 'content.published',
          payload: { contentId: 'not_exist' },
          status: 'pending',
          attempts: 0,
        } as TourEvent),
      ).resolves.toBeUndefined()
    })

    it('所有适配器成功时分发成功', async () => {
      const adapter: PlatformAdapter = {
        platform: 'test_success' as Platform,
        enabled: true,
        distribute: vi.fn().mockResolvedValue({ ok: true, externalId: 'ext-1' }),
      }
      registerAdapter(adapter)
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'c1',
              title: 'T',
              summary: 's',
              coverImage: null,
              content: 'body',
            },
          ]),
        }),
      })
      await expect(
        multiPlatformDispatcher.dispatch({
          id: 'e1',
          type: 'content.published',
          payload: { contentId: 'c1' },
          status: 'pending',
          attempts: 0,
        } as TourEvent),
      ).resolves.toBeUndefined()
      expect(adapter.distribute).toHaveBeenCalledTimes(1)
    })

    it('适配器失败时抛错', async () => {
      const adapter: PlatformAdapter = {
        platform: 'test_fail' as Platform,
        enabled: true,
        distribute: vi.fn().mockResolvedValue({ ok: false, error: 'denied' }),
      }
      registerAdapter(adapter)
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'c1',
              title: 'T',
              summary: 's',
              coverImage: null,
              content: 'body',
            },
          ]),
        }),
      })
      await expect(
        multiPlatformDispatcher.dispatch({
          id: 'e1',
          type: 'content.published',
          payload: { contentId: 'c1' },
          status: 'pending',
          attempts: 0,
        } as TourEvent),
      ).rejects.toThrow('部分平台分发失败')
    })

    it('禁用的适配器不参与分发', async () => {
      const adapter: PlatformAdapter = {
        platform: 'test_disabled' as Platform,
        enabled: false,
        distribute: vi.fn(),
      }
      registerAdapter(adapter)
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'c1',
              title: 'T',
              summary: 's',
              coverImage: null,
              content: 'body',
            },
          ]),
        }),
      })
      await multiPlatformDispatcher.dispatch({
        id: 'e1',
        type: 'content.published',
        payload: { contentId: 'c1' },
        status: 'pending',
        attempts: 0,
      } as TourEvent)
      expect(adapter.distribute).not.toHaveBeenCalled()
    })

    it('适配器抛异常时被收集到 failures', async () => {
      const adapter: PlatformAdapter = {
        platform: 'test_throw' as Platform,
        enabled: true,
        distribute: vi.fn().mockRejectedValue(new Error('network error')),
      }
      registerAdapter(adapter)
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: 'c1',
              title: 'T',
              summary: 's',
              coverImage: null,
              content: 'body',
            },
          ]),
        }),
      })
      await expect(
        multiPlatformDispatcher.dispatch({
          id: 'e1',
          type: 'content.published',
          payload: { contentId: 'c1' },
          status: 'pending',
          attempts: 0,
        } as TourEvent),
      ).rejects.toThrow('network error')
    })
  })

  describe('distributeContent 触发分发', () => {
    it('调用 publish 与 processEvents', async () => {
      processEventsMock.mockResolvedValue({ processed: 0, failed: 0 })
      await distributeContent('c1')
      expect(publishMock).toHaveBeenCalledWith({
        type: 'content.published',
        payload: { contentId: 'c1' },
      })
      expect(processEventsMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('consoleAdapter', () => {
    it('distribute 调用 console.info 返回 ok', async () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const r = await consoleAdapter.distribute({
        id: 'c1',
        title: 'T',
        summary: null,
        coverImage: null,
        content: 'x',
      })
      expect(r.ok).toBe(true)
      expect(r.externalId).toBe('web-c1')
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })

    it('platform=web enabled=true', () => {
      expect(consoleAdapter.platform).toBe('web')
      expect(consoleAdapter.enabled).toBe(true)
    })
  })
})
