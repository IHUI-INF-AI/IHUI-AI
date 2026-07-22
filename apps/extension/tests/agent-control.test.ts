/**
 * Agent Control 执行器单元测试(2026-07-22 立)
 *
 * 覆盖:
 * - isDomAction / isBackgroundAction 类型守卫(纯函数,无 chrome mock)
 * - executeBackgroundAction 的 screenshot / navigate / switch_tab / close_tab 分支
 *   (mock chrome.tabs API)
 *
 * DOM action 执行器(executeDomAction)依赖 document,在 node 环境无法测试,
 * 由 e2e(wxt dev + browser)覆盖。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isDomAction,
  isBackgroundAction,
  executeBackgroundAction,
} from '../lib/agent-control'

// ===== chrome.tabs mock =====

const captureVisibleTab = vi.fn()
const tabsQuery = vi.fn()
const tabsUpdate = vi.fn()
const tabsRemove = vi.fn()
const onUpdatedListener = vi.fn()

beforeEach(() => {
  captureVisibleTab.mockReset()
  tabsQuery.mockReset()
  tabsUpdate.mockReset()
  tabsRemove.mockReset()
  onUpdatedListener.mockReset()

  ;(globalThis as unknown as { chrome: unknown }).chrome = {
    tabs: {
      captureVisibleTab,
      query: tabsQuery,
      update: tabsUpdate,
      remove: tabsRemove,
      onUpdated: {
        addListener: onUpdatedListener,
        removeListener: vi.fn(),
      },
    },
  }
})

describe('agent-control action type guards', () => {
  describe('isDomAction', () => {
    it('DOM action 返回 true', () => {
      expect(isDomAction('click_element')).toBe(true)
      expect(isDomAction('type_text')).toBe(true)
      expect(isDomAction('scroll')).toBe(true)
      expect(isDomAction('extract_dom')).toBe(true)
      expect(isDomAction('wait_for_element')).toBe(true)
      expect(isDomAction('get_attribute')).toBe(true)
      expect(isDomAction('hover')).toBe(true)
      expect(isDomAction('select_option')).toBe(true)
    })

    it('background action 返回 false', () => {
      expect(isDomAction('screenshot')).toBe(false)
      expect(isDomAction('navigate')).toBe(false)
      expect(isDomAction('switch_tab')).toBe(false)
      expect(isDomAction('close_tab')).toBe(false)
    })

    it('未知 action 返回 false', () => {
      expect(isDomAction('unknown_action' as never)).toBe(false)
      expect(isDomAction('' as never)).toBe(false)
    })
  })

  describe('isBackgroundAction', () => {
    it('background action 返回 true', () => {
      expect(isBackgroundAction('screenshot')).toBe(true)
      expect(isBackgroundAction('navigate')).toBe(true)
      expect(isBackgroundAction('switch_tab')).toBe(true)
      expect(isBackgroundAction('close_tab')).toBe(true)
    })

    it('DOM action 返回 false', () => {
      expect(isBackgroundAction('click_element')).toBe(false)
      expect(isBackgroundAction('type_text')).toBe(false)
      expect(isBackgroundAction('scroll')).toBe(false)
      expect(isBackgroundAction('extract_dom')).toBe(false)
      expect(isBackgroundAction('wait_for_element')).toBe(false)
      expect(isBackgroundAction('get_attribute')).toBe(false)
      expect(isBackgroundAction('hover')).toBe(false)
      expect(isBackgroundAction('select_option')).toBe(false)
    })

    it('未知 action 返回 false', () => {
      expect(isBackgroundAction('unknown' as never)).toBe(false)
      expect(isBackgroundAction('' as never)).toBe(false)
    })
  })
})

describe('executeBackgroundAction', () => {
  it('非 background action 返回 UNSUPPORTED_ACTION', async () => {
    const res = await executeBackgroundAction('click_element' as never, {}, 100)
    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('UNSUPPORTED_ACTION')
    expect(res.error).toMatch(/not a background action/)
  })

  it('screenshot 调用 chrome.tabs.captureVisibleTab 并返回 base64', async () => {
    captureVisibleTab.mockResolvedValue('data:image/png;base64,aGVsbG8=')
    const res = await executeBackgroundAction('screenshot', { area: 'viewport' }, 1000)
    expect(captureVisibleTab).toHaveBeenCalledWith({ format: 'png' })
    expect(res.success).toBe(true)
    expect(res.data?.screenshot).toBe('aGVsbG8=')
    expect(res.data?.area).toBe('viewport')
  })

  it('screenshot 请求 fullpage 时降级为 viewport 并附 warning', async () => {
    captureVisibleTab.mockResolvedValue('data:image/png;base64,YWJjZA==')
    const res = await executeBackgroundAction('screenshot', { area: 'fullpage' }, 1000)
    expect(res.success).toBe(true)
    expect(res.data?.area).toBe('viewport')
    expect(res.data?.warning).toMatch(/fullpage/)
  })

  it('screenshot captureVisibleTab 抛错时 propagate reject(exec 先于 timeout settle)', async () => {
    // executeBackgroundAction 用 Promise.race([exec, timeout]):
    //   - exec reject 时 race 立即 reject(timeout 的 resolve 不影响)
    //   - 源码未 catch exec 的 reject,所以整个函数 reject
    captureVisibleTab.mockRejectedValue(new Error('no active tab'))
    await expect(executeBackgroundAction('screenshot', {}, 200)).rejects.toThrow('no active tab')
  })

  it('navigate 调用 chrome.tabs.update 切换 URL', async () => {
    tabsQuery.mockResolvedValue([{ id: 42, windowId: 1 }])
    tabsUpdate.mockResolvedValue(undefined)
    // 模拟 onUpdated listener 注册后立即触发 complete
    onUpdatedListener.mockImplementation((listener: (id: number, info: { status?: string }, tab: chrome.tabs.Tab) => void) => {
      // 异步触发,模拟 tab 加载完成
      setTimeout(() => listener(42, { status: 'complete' }, { id: 42, url: 'https://example.com', title: 'Example' } as chrome.tabs.Tab), 10)
    })
    const res = await executeBackgroundAction('navigate', { url: 'https://example.com' }, 1000)
    expect(tabsUpdate).toHaveBeenCalledWith(42, { url: 'https://example.com' })
    expect(res.success).toBe(true)
    expect(res.data?.url).toBe('https://example.com')
    expect(res.data?.title).toBe('Example')
  })

  it('navigate 无活动 tab 返回 TARGET_NOT_CONNECTED', async () => {
    tabsQuery.mockResolvedValue([])
    const res = await executeBackgroundAction('navigate', { url: 'https://example.com' }, 1000)
    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('TARGET_NOT_CONNECTED')
  })

  it('switch_tab 切换到指定 index 的 tab', async () => {
    tabsQuery.mockResolvedValue([
      { id: 1, url: 'https://a.com', title: 'A' },
      { id: 2, url: 'https://b.com', title: 'B' },
    ])
    tabsUpdate.mockResolvedValue(undefined)
    const res = await executeBackgroundAction('switch_tab', { index: 1 }, 1000)
    expect(tabsUpdate).toHaveBeenCalledWith(2, { active: true })
    expect(res.success).toBe(true)
    expect(res.data?.url).toBe('https://b.com')
    expect(res.data?.title).toBe('B')
    expect(res.data?.index).toBe(1)
  })

  it('switch_tab index 越界返回 EXECUTION_FAILED', async () => {
    tabsQuery.mockResolvedValue([{ id: 1, url: 'https://a.com', title: 'A' }])
    const res = await executeBackgroundAction('switch_tab', { index: 5 }, 1000)
    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('EXECUTION_FAILED')
    expect(res.error).toMatch(/out of range/)
  })

  it('close_tab 关闭指定 index 的 tab', async () => {
    tabsQuery.mockResolvedValue([
      { id: 1, url: 'https://a.com', title: 'A' },
      { id: 2, url: 'https://b.com', title: 'B' },
    ])
    tabsRemove.mockResolvedValue(undefined)
    const res = await executeBackgroundAction('close_tab', { index: 0 }, 1000)
    expect(tabsRemove).toHaveBeenCalledWith(1)
    expect(res.success).toBe(true)
    expect(res.data?.closed).toBe(true)
    expect(res.data?.index).toBe(0)
  })

  it('close_tab index 越界返回 EXECUTION_FAILED', async () => {
    tabsQuery.mockResolvedValue([{ id: 1, url: 'https://a.com', title: 'A' }])
    const res = await executeBackgroundAction('close_tab', { index: 10 }, 1000)
    expect(res.success).toBe(false)
    expect(res.errorCode).toBe('EXECUTION_FAILED')
  })
})
