// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AnalyticsCapture opt-out 测试(2026-10-03 数据出域合规整改)
 *
 * AnalyticsCapture 走的是**自己的** fetch(REPORT_URL + keepalive),不经过
 * @/lib/api 的 fetchApi —— 所以 use-analytics 的那套断言覆盖不到它,
 * 必须单独验一遍,否则「五类行为事件绕过 opt-out」会是个静默的洞。
 *
 * 覆盖:click / search / download / link_out / form_submit 五类,
 * 在 DNT=1 与偏好关闭两种情况下都必须不发出上报请求;
 * 偏好缺省时必须照常上报(保持现状口径)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'

const { fetchMock, fetchApiMock, refreshSpy } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  fetchApiMock: vi.fn(),
  refreshSpy: vi.fn(),
}))

vi.stubGlobal('fetch', fetchMock)
vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))
vi.mock('next/navigation', () => ({ usePathname: () => '/chat' }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: { user?: { id: string } }) => unknown) => sel({ user: { id: 'u-1' } }),
}))

// AnalyticsCapture 复用 use-analytics 的判定链,这里只桩掉「拉偏好」这一个副作用,
// 让用例专注于「五类事件是否被闸门拦住」。
vi.mock('@/hooks/use-analytics', () => ({
  refreshAnalyticsConsent: refreshSpy,
  isAnalyticsEnabled: () => gateEnabled,
}))

let gateEnabled = true

const { AnalyticsCapture } = await import('@/components/common/AnalyticsCapture')

/** 取出上报请求 */
function reportCalls() {
  return fetchMock.mock.calls.filter((c) => String(c[0]).includes('/analytics/track'))
}

/** 渲染并把五类事件依次触发一遍 */
async function fireAllFiveEvents(container: HTMLElement) {
  // click:带 data-analytics 的按钮
  const btn = document.createElement('button')
  btn.setAttribute('data-analytics', 'save-btn')
  container.appendChild(btn)
  await act(async () => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })

  // form_submit(带 data-analytics-form)
  const form = document.createElement('form')
  form.setAttribute('data-analytics-form', 'contact')
  const input = document.createElement('input')
  input.type = 'search'
  input.value = '用户输入的搜索词'
  form.appendChild(input)
  container.appendChild(form)
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })

  // search:落在 form[role="search"] 下的搜索框
  const searchForm = document.createElement('form')
  searchForm.setAttribute('role', 'search')
  const sInput = document.createElement('input')
  sInput.type = 'search'
  sInput.value = '关键词'
  searchForm.appendChild(sInput)
  container.appendChild(searchForm)
  await act(async () => {
    searchForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })

  // download:<a download>
  const dl = document.createElement('a')
  dl.setAttribute('href', '/files/manual.pdf')
  dl.setAttribute('download', 'manual.pdf')
  container.appendChild(dl)
  await act(async () => {
    dl.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })

  // link_out:target=_blank 的站外链接
  const lo = document.createElement('a')
  lo.setAttribute('href', 'https://example.com/docs')
  lo.setAttribute('target', '_blank')
  container.appendChild(lo)
  await act(async () => {
    lo.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchApiMock.mockReset()
  refreshSpy.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200 })
  gateEnabled = true
  // 默认无 DNT
  Object.defineProperty(globalThis.navigator, 'doNotTrack', {
    value: undefined,
    configurable: true,
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AnalyticsCapture 的 opt-out 闸门', () => {
  it('闸门开启时,五类事件都能上报(确认用例本身有效,不是空转)', async () => {
    vi.useFakeTimers()
    try {
      gateEnabled = true
      const { container } = render(<AnalyticsCapture /> as never)
      await fireAllFiveEvents(container as HTMLElement)

      // 组件的批量定时器是 8s,快进到点让 queue 真正 flush
      await act(async () => {
        vi.advanceTimersByTime(8000)
      })

      const calls = reportCalls()
      expect(calls.length).toBeGreaterThan(0)
      const body = JSON.parse((calls[0][1] as RequestInit).body as string)
      const names = body.events.map((e: { name: string }) => e.name)
      // 五类事件都真的进了上报体
      expect(names).toEqual(
        expect.arrayContaining(['click', 'form_submit', 'search', 'download', 'link_out']),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('闸门关闭(偏好关闭 / DNT)时,五类事件都不产生上报请求', async () => {
    vi.useFakeTimers()
    try {
      gateEnabled = false
      const { container } = render(<AnalyticsCapture /> as never)
      await fireAllFiveEvents(container as HTMLElement)
      await act(async () => {
        vi.advanceTimersByTime(8000)
      })

      expect(reportCalls()).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('闸门关闭时,连已缓冲的事件在 flush 阶段也不发送', async () => {
    gateEnabled = true
    const { container } = render(<AnalyticsCapture /> as never)
    await fireAllFiveEvents(container as HTMLElement)

    // 用户随后关闭埋点,再触发 visibilitychange(组件的 flush 入口)
    gateEnabled = false
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(reportCalls()).toHaveLength(0)
  })

  it('挂载时拉取一次用户偏好', async () => {
    render(<AnalyticsCapture /> as never)
    expect(refreshSpy).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
