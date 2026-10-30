// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)
 */

/**
 * 产物中心页(G3 Beyond-Coding 泛化 · 用户面 Web 入口)回归测试(2026-10-30 立)。
 *
 * 覆盖:
 *   1. 列表渲染(名称/kind 徽标/版本/相对时间/下载 href/会话深链 href)
 *   2. 空态文案
 *   3. html_report 预览(换签名 token → window.open;非 html 无预览按钮;video_ref 下载禁用)
 *   4. 预览失败提示(token 端点非 success → Alert)
 *   5. 列表加载失败提示
 *   6. 加载更多(page=2 追加,不重不漏)
 *
 * 翻译 mock 取「命名空间前缀 + 键名恒等」策略(与 settings/devices 页测试同型):
 * 断言直接比对 artifacts.* 键名,词包本身由键位契约测试兜底。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type * as React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// t 函数必须跨渲染稳定:页面把 t 放进 useCallback/useEffect 依赖,
// 每次渲染新建函数会触发「effect→setState→重渲染」死循环(同 devices 页测试注释)。
const { tFor } = vi.hoisted(() => {
  const cache = new Map<string, (key: string) => string>()
  return {
    tFor: (ns: string) => {
      let fn = cache.get(ns)
      if (!fn) {
        fn = (key: string) => `${ns}.${key}`
        cache.set(ns, fn)
      }
      return fn
    },
  }
})
vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => tFor(ns),
}))

const api = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  fetchAiServiceJson: vi.fn(),
}))
vi.mock('@ihui/api-client', () => api)

vi.mock('@/hooks/use-auth-gate', () => ({
  useAuthGate: () => ({ ready: true, allow: true }),
}))

vi.mock('@/components/feedback', () => ({
  Alert: ({ title }: { title?: string }) => <div data-testid="alert">{title}</div>,
}))

vi.mock('@/components/common', () => ({
  BackButton: () => <div />,
  AuthGatePrompt: ({ message }: { message: string }) => <div>{message}</div>,
}))

// next/link 替身:直出 <a>,断言 href 免依赖 next 运行时上下文
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    'data-testid': testId,
    className,
  }: {
    href: string
    children?: React.ReactNode
    'data-testid'?: string
    className?: string
  }) => (
    <a href={href} data-testid={testId} className={className}>
      {children}
    </a>
  ),
}))

// UI 基元替身:保持 DOM 形状足够断言(Button 忽略 asChild,<a> 子节点原样渲染)
vi.mock('@ihui/ui-react', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onClick,
    disabled,
    'data-testid': testId,
  }: {
    children?: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    'data-testid'?: string
  }) => (
    <button type="button" data-testid={testId} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Table: ({ children }: { children?: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children?: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({
    children,
    'data-testid': testId,
  }: {
    children?: React.ReactNode
    'data-testid'?: string
  }) => <tr data-testid={testId}>{children}</tr>,
  TableHead: ({ children }: { children?: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children?: React.ReactNode }) => <td>{children}</td>,
}))

vi.mock('lucide-react', () => ({
  Download: () => <svg />,
  Eye: () => <svg />,
  Loader2: () => <svg />,
  MessageSquare: () => <svg />,
  PackageOpen: () => <svg />,
  RefreshCw: () => <svg />,
}))

import ArtifactsPage from '../page'

const ART_HTML = {
  id: 'art-html-1',
  kind: 'html_report' as const,
  name: '市场分析报告',
  version: 2,
  created_at: new Date(Date.now() - 120_000).toISOString(),
  session_id: 'conv-9',
  payload_ref: 'tmp/artifacts/art-html-1/v2.html',
}
const ART_SHEET = {
  id: 'art-sheet-1',
  kind: 'sheet' as const,
  name: '销售数据表',
  version: 1,
  created_at: new Date(Date.now() - 3_600_000 * 5).toISOString(),
  session_id: 'conv-8',
  payload_ref: 'tmp/artifacts/art-sheet-1/v1.csv',
}
const ART_VIDEO = {
  id: 'art-video-1',
  kind: 'video_ref' as const,
  name: '宣传视频',
  version: 3,
  created_at: new Date(Date.now() - 86_400_000 * 2).toISOString(),
  session_id: 'conv-7',
  payload_ref: 'tmp/artifacts/art-video-1/v3.json',
}

function ok<T>(data: T) {
  return { success: true as const, data, status: 200 }
}

let openSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchApi.mockResolvedValue(
    ok({ list: [ART_HTML, ART_SHEET, ART_VIDEO], total: 3, page: 1, pageSize: 50 }),
  )
  api.fetchAiServiceJson.mockResolvedValue(
    ok({ token: 'tok-abc', url: '/api/artifacts/f/tok-abc', expires_in: 1800 }),
  )
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
})

afterEach(() => {
  openSpy.mockRestore()
  cleanup()
})

describe('产物中心页', () => {
  it('列表渲染:名称/kind 徽标/版本/相对时间/下载 href/会话深链 href', async () => {
    render(<ArtifactsPage />)
    await waitFor(() =>
      expect(api.fetchApi).toHaveBeenCalledWith('/api/artifacts?page=1&pageSize=50'),
    )

    const rowHtml = await screen.findByTestId('artifact-row-art-html-1')
    expect(rowHtml.textContent).toContain('市场分析报告')
    expect(rowHtml.textContent).toContain('artifacts.kind_html_report')
    expect(rowHtml.textContent).toContain('v2')
    expect(rowHtml.textContent).toContain('artifacts.minutesAgo')
    expect(screen.getByTestId('download-artifact-art-html-1').getAttribute('href')).toBe(
      '/api/artifacts/art-html-1/download',
    )
    expect(screen.getByTestId('session-link-art-html-1').getAttribute('href')).toBe(
      '/chat?conversationId=conv-9',
    )

    const rowSheet = screen.getByTestId('artifact-row-art-sheet-1')
    expect(rowSheet.textContent).toContain('artifacts.kind_sheet')
    expect(rowSheet.textContent).toContain('artifacts.hoursAgo')
    expect(screen.getByTestId('artifact-row-art-video-1').textContent).toContain(
      'artifacts.daysAgo',
    )
  })

  it('空态:零产物显示 empty 文案,不渲染表格行', async () => {
    api.fetchApi.mockResolvedValue(ok({ list: [], total: 0, page: 1, pageSize: 50 }))
    render(<ArtifactsPage />)
    expect(await screen.findByText('artifacts.empty')).toBeTruthy()
    expect(screen.queryByTestId('artifact-row-art-html-1')).toBeNull()
  })

  it('html_report 预览:token 端点带 payload_ref 换签名 URL 并新窗口打开;非 html 无预览按钮;video_ref 下载禁用', async () => {
    render(<ArtifactsPage />)
    fireEvent.click(await screen.findByTestId('preview-artifact-art-html-1'))

    await waitFor(() =>
      expect(api.fetchAiServiceJson).toHaveBeenCalledWith('/api/artifacts/token', {
        params: { file: 'tmp/artifacts/art-html-1/v2.html' },
      }),
    )
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith('/api/artifacts/f/tok-abc', '_blank', 'noopener'),
    )

    // 签名预览链路只服务 .html:sheet/video_ref 不出预览按钮
    expect(screen.queryByTestId('preview-artifact-art-sheet-1')).toBeNull()
    expect(screen.queryByTestId('preview-artifact-art-video-1')).toBeNull()
    // video_ref 无导出形态:下载按钮禁用(内嵌 <a> 仍在,靠 disabled 阻断点击)
    const videoRow = screen.getByTestId('artifact-row-art-video-1')
    expect(videoRow.querySelector('button')?.hasAttribute('disabled')).toBe(true)
  })

  it('预览失败:token 端点非 success 显示 previewFailed Alert', async () => {
    api.fetchAiServiceJson.mockResolvedValue({ success: false, error: 'forbidden', status: 403 })
    render(<ArtifactsPage />)
    fireEvent.click(await screen.findByTestId('preview-artifact-art-html-1'))
    const alerts = await screen.findAllByTestId('alert')
    expect(alerts.some((a) => a.textContent === 'artifacts.previewFailed')).toBe(true)
    expect(openSpy).not.toHaveBeenCalled()
  })

  it('列表加载失败:显示 loadFailed 提示且不出表格', async () => {
    api.fetchApi.mockResolvedValue({ success: false, error: '', status: 500 })
    render(<ArtifactsPage />)
    const alerts = await screen.findAllByTestId('alert')
    expect(alerts.some((a) => a.textContent === 'artifacts.loadFailed')).toBe(true)
    expect(screen.queryByTestId('artifact-row-art-html-1')).toBeNull()
  })

  it('加载更多:page=2 追加行,已加载计数与 total 对齐后按钮消失', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ ...ART_HTML, id: `art-${i}` }))
    api.fetchApi.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('page=2')
          ? ok({ list: [ART_SHEET], total: 51, page: 2, pageSize: 50 })
          : ok({ list: many, total: 51, page: 1, pageSize: 50 }),
      ),
    )
    render(<ArtifactsPage />)
    await screen.findByTestId('artifact-row-art-0')
    expect(screen.queryByTestId('artifact-row-art-sheet-1')).toBeNull()

    fireEvent.click(screen.getByTestId('artifacts-load-more'))
    await waitFor(() =>
      expect(api.fetchApi).toHaveBeenCalledWith('/api/artifacts?page=2&pageSize=50'),
    )
    await screen.findByTestId('artifact-row-art-sheet-1')
    // 51/51 已加载完毕:load-more 收起
    expect(screen.queryByTestId('artifacts-load-more')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
