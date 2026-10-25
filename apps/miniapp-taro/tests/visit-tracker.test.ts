// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序页面埋点取证(2026-10-26 立)。
 *
 * 钉四件:路径前缀 `/mp/`、3 秒去抖、栈顶取法(空栈不报)、轮询启停幂等。
 * 这几条任一被改坏,微信端要么多算、要么整端静默漏报 —— 而漏报在监控面上表现为
 * 「这个端没人在用」,是最难被发现的一型。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => {
  const state = { stack: [] as Array<{ route: string }>, requests: [] as unknown[] }
  const taro = {
    getCurrentPages: () => state.stack,
    request: (opts: unknown) => {
      state.requests.push(opts)
      return Promise.resolve({ statusCode: 200 })
    },
  }
  return { state, taro }
})

vi.mock('@tarojs/taro', () => ({ default: h.taro }))
vi.mock('../src/utils/api-config', () => ({ BASE_URL: 'http://api.test/api' }))

import {
  __resetPageViewTrackingForTest,
  currentPageRoute,
  pageViewPath,
  reportPageView,
  startPageViewTracking,
  stopPageViewTracking,
  MP_VISIT_DEBOUNCE_MS,
} from '../src/utils/visit-tracker'

const lastRequest = () =>
  h.state.requests[h.state.requests.length - 1] as {
    url: string
    method: string
    data: { url: string; sessionId: string }
  }

beforeEach(() => {
  h.state.stack = []
  h.state.requests = []
  __resetPageViewTrackingForTest()
})

afterEach(() => {
  __resetPageViewTrackingForTest()
  vi.useRealTimers()
})

describe('pageViewPath', () => {
  it('统一加 /mp/ 前缀并去掉前导斜杠', () => {
    expect(pageViewPath('pages/index/index')).toBe('/mp/pages/index/index')
    expect(pageViewPath('/pages/chat/index')).toBe('/mp/pages/chat/index')
  })

  it('空 route ⇒ null', () => {
    expect(pageViewPath(null)).toBeNull()
    expect(pageViewPath(undefined)).toBeNull()
    expect(pageViewPath('  ')).toBeNull()
  })

  it('超长截断到 500', () => {
    expect(pageViewPath('x'.repeat(800))?.length).toBe(500)
  })
})

describe('currentPageRoute', () => {
  it('取栈顶 route', () => {
    h.state.stack = [{ route: 'pages/index/index' }, { route: 'pages/chat/index' }]
    expect(currentPageRoute()).toBe('pages/chat/index')
  })

  it('空栈 ⇒ null', () => {
    expect(currentPageRoute()).toBeNull()
  })
})

describe('reportPageView', () => {
  it('首次上报:POST 到访问端点,带会话 id', () => {
    expect(reportPageView('pages/index/index', 1_000)).toBe(true)
    expect(h.state.requests).toHaveLength(1)
    const req = lastRequest()
    expect(req.url).toBe('http://api.test/api/visit-tracking/visit-log')
    expect(req.method).toBe('POST')
    expect(req.data.url).toBe('/mp/pages/index/index')
    expect(typeof req.data.sessionId).toBe('string')
  })

  it('同页 3 秒内去抖,换页立即放行', () => {
    expect(reportPageView('pages/index/index', 10_000)).toBe(true)
    expect(reportPageView('pages/index/index', 10_000 + MP_VISIT_DEBOUNCE_MS - 1)).toBe(false)
    expect(reportPageView('pages/chat/index', 10_000 + 1)).toBe(true)
    expect(h.state.requests).toHaveLength(2)
  })

  it('空 route 不发请求', () => {
    expect(reportPageView(null, 20_000)).toBe(false)
    expect(h.state.requests).toHaveLength(0)
  })
})

describe('startPageViewTracking', () => {
  it('启动即报当前页,轮询只在新页出现时才再报,stop 后停止', () => {
    vi.useFakeTimers()
    h.state.stack = [{ route: 'pages/index/index' }]
    const stop = startPageViewTracking(2000)
    expect(h.state.requests).toHaveLength(1)

    // 同一页继续轮询:去抖窗口内不重复报
    vi.advanceTimersByTime(2000)
    expect(h.state.requests).toHaveLength(1)

    // 切页后下一次轮询立刻记录
    h.state.stack.push({ route: 'pages/chat/index' })
    vi.advanceTimersByTime(2000)
    expect(h.state.requests).toHaveLength(2)
    expect(lastRequest().data.url).toBe('/mp/pages/chat/index')

    stop()
    h.state.stack.push({ route: 'pages/me/index' })
    vi.advanceTimersByTime(10_000)
    expect(h.state.requests).toHaveLength(2)
  })

  it('重复调用不叠加定时器', () => {
    vi.useFakeTimers()
    h.state.stack = [{ route: 'pages/index/index' }]
    startPageViewTracking(2000)
    startPageViewTracking(2000)
    h.state.stack.push({ route: 'pages/chat/index' })
    vi.advanceTimersByTime(2000)
    expect(h.state.requests).toHaveLength(2)
    stopPageViewTracking()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
