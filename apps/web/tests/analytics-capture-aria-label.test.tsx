// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AnalyticsCapture 图标按钮 aria-label 兜底取证(2026-10-27 覆盖缺口收口)
 *
 * 立因:全站 `data-analytics` 标记此前零使用,click 面只靠 BUTTON/A 的**文本**兜底 ——
 * 纯图标按钮(主题切换/AI 面板/侧栏折叠等,守门 18 要求它们一律带 aria-label 而无文本)
 * 的点击结构性不可见,大屏「热门点击」对这类关键交互恒盲。
 *
 * 钉三件:无文本但有 aria-label 的按钮要被采集(label=aria-label)、
 * 文本优先于 aria-label、超长 aria-label(把整份清单塞进可读名的那种)不采信。
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
  useAuthStore: (sel: (s: { user?: { id: string }; isAuthenticated?: boolean }) => unknown) =>
    sel({ user: { id: 'u-1' }, isAuthenticated: true }),
}))
vi.mock('@/hooks/use-analytics', () => ({
  refreshAnalyticsConsent: refreshSpy,
  isAnalyticsEnabled: () => true,
}))

const { AnalyticsCapture } = await import('@/components/common/AnalyticsCapture')

function reportCalls() {
  return fetchMock.mock.calls.filter((c) => String(c[0]).includes('/analytics/track'))
}

/** 取上一条上报体里的 click 事件 label(未 flush 时事件在缓冲里,这里直接等 flush) */
async function clickLabels(): Promise<string[]> {
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const labels: string[] = []
  for (const c of reportCalls()) {
    const body = JSON.parse((c[1] as RequestInit).body as string)
    for (const e of body.events) if (e.name === 'click') labels.push(e.label)
  }
  return labels
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchApiMock.mockReset()
  refreshSpy.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200 })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AnalyticsCapture 图标按钮的 aria-label 兜底', () => {
  it('无文本但有 aria-label 的图标按钮:click 事件以 aria-label 为 label', async () => {
    const { container } = render((<AnalyticsCapture />) as never)
    const btn = document.createElement('button')
    btn.setAttribute('aria-label', '切换主题')
    container.appendChild(btn)
    await act(async () => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(await clickLabels()).toContain('切换主题')
  })

  it('有文本的按钮:文本优先,不落 aria-label', async () => {
    const { container } = render((<AnalyticsCapture />) as never)
    const btn = document.createElement('button')
    btn.textContent = '保存'
    btn.setAttribute('aria-label', '保存当前草稿')
    container.appendChild(btn)
    await act(async () => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(await clickLabels()).toContain('保存')
  })

  it('超长 aria-label 不采信(把整份清单塞进可读名的那类,宁缺毋滥)', async () => {
    const { container } = render((<AnalyticsCapture />) as never)
    const btn = document.createElement('button')
    btn.setAttribute('aria-label', '直达:' + '入口甲、入口乙、'.repeat(20))
    container.appendChild(btn)
    await act(async () => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(await clickLabels()).not.toContain(btn.getAttribute('aria-label'))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
