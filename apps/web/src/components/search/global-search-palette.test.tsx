// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * 全局快捷检索 UI 真测试。
 *
 * 同样不 mock `@/lib/api`：请求走真实的信封解包链，fetch 由 vi.stubGlobal 注入
 * 真实响应字节。这里额外旁路 next/navigation 的 router（只断言跳转目标）。
 */

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('next-intl', () => {
  const dict: Record<string, string> = {
    globalSearchTitle: '全局检索',
    globalSearchPlaceholder: '搜索本地知识库（Ctrl/Cmd + K）',
    globalSearchEmpty: '没有命中：索引里没有包含这些词的文件',
    globalSearchHint: '↑↓ 选择 · Enter 打开 · Esc 关闭',
    filter_all: '全部',
    filter_text: '文本',
    filter_office: '文档',
    loading: '处理中…',
    modelCalls: '模型调用 0 次',
  }
  return { useTranslations: () => (key: string) => dict[key] ?? key }
})

import { GlobalSearchPalette } from './global-search-palette'

interface Call {
  url: string
  init: RequestInit | undefined
}

function installFetch(payloads: unknown[]): { calls: Call[]; fn: ReturnType<typeof vi.fn> } {
  const calls: Call[] = []
  let index = 0
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    const body = payloads[Math.min(index, payloads.length - 1)]
    index += 1
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }) as unknown as Response
  })
  vi.stubGlobal('fetch', fn)
  return { calls, fn }
}

const ok = (data: unknown) => ({ code: 0, message: 'ok', data })

const HIT = {
  path: 'docs/board.md',
  title: '董事会决议',
  snippet: '2025 年研发预算 800 万，责任人王工。',
  bm25: 1.2345,
  citation: {
    path: 'docs/board.md',
    title: '董事会决议',
    heading: '',
    doc_hash: 'abc',
    byte_range: [0, 20],
    start_line: 1,
    end_line: 1,
    passage: '2025 年研发预算 800 万，责任人王工。',
    score: 0,
    bm25: 1.2345,
    hop: 0,
  },
  // 「预算」在 "2025 年研发预算 800 万…" 里的字符区间：8..10（左闭右开）。
  highlights: [[8, 10]] as Array<[number, number]>,
}

const RESULT = {
  query: '预算',
  mode: 'lexical-bm25',
  model_calls: 0,
  total_files: 1,
  page: 1,
  per_page: 20,
  items: [HIT],
  duration_ms: 1.2,
}

const EMPTY = { ...RESULT, total_files: 0, items: [] }

afterEach(() => {
  cleanup()
  push.mockReset()
  vi.unstubAllGlobals()
})

describe('全局快捷检索', () => {
  it('默认不渲染；Ctrl+K 唤起、Esc 关闭', async () => {
    installFetch([ok(RESULT)])
    render(<GlobalSearchPalette />)
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('输入后防抖请求 search，命中区间渲染成 mark', async () => {
    const { calls } = installFetch([ok(RESULT)])
    render(<GlobalSearchPalette />)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('搜索本地知识库（Ctrl/Cmd + K）'), {
      target: { value: '预算' },
    })

    await waitFor(() => expect(screen.getByText('董事会决议')).toBeTruthy())
    expect(calls.length).toBe(1)
    expect(calls[0]!.url).toContain('/api/v1/ai/sag2/search')
    const body = JSON.parse(String(calls[0]!.init?.body))
    expect(body).toMatchObject({ query: '预算', page: 1, per_page: 20, highlight: true })
    // 后端下发 [8,10] ⇒ 片段里正好是查询词「预算」，被包成 mark。
    const marks = document.querySelectorAll('mark')
    expect(marks.length).toBe(1)
    expect(marks[0]!.textContent).toBe('预算')
  })

  it('切换扩展名筛选会把 filters 带进请求体', async () => {
    const { calls } = installFetch([ok(RESULT)])
    render(<GlobalSearchPalette />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('搜索本地知识库（Ctrl/Cmd + K）'), {
      target: { value: '预算' },
    })
    await waitFor(() => expect(calls.length).toBe(1))

    fireEvent.click(screen.getByRole('button', { name: '文档' }))
    await waitFor(() => expect(calls.length).toBe(2))
    const body = JSON.parse(String(calls[1]!.init?.body))
    expect(body.filters).toEqual({ ext: ['.pdf', '.docx', '.xlsx', '.epub', '.html'] })
  })

  it('无命中时显示的是真实原因，不是「暂无数据」', async () => {
    installFetch([ok(EMPTY)])
    render(<GlobalSearchPalette />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('搜索本地知识库（Ctrl/Cmd + K）'), {
      target: { value: '不存在的词' },
    })
    await waitFor(() =>
      expect(screen.getByText('没有命中：索引里没有包含这些词的文件')).toBeTruthy(),
    )
  })

  it('Enter 打开聚焦到该文件的 /sag2 页面', async () => {
    installFetch([ok(RESULT)])
    render(<GlobalSearchPalette />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('搜索本地知识库（Ctrl/Cmd + K）'), {
      target: { value: '预算' },
    })
    await waitFor(() => expect(screen.getByText('董事会决议')).toBeTruthy())

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1))
    const target = String(push.mock.calls[0]![0])
    expect(target.startsWith('/sag2?')).toBe(true)
    expect(target).toContain('q=%E9%A2%84%E7%AE%97')
    expect(target).toContain('path=docs%2Fboard.md')
  })

  it('关闭后重开不残留上一次的输入与结果', async () => {
    installFetch([ok(RESULT)])
    render(<GlobalSearchPalette />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('搜索本地知识库（Ctrl/Cmd + K）'), {
      target: { value: '预算' },
    })
    await waitFor(() => expect(screen.getByText('董事会决议')).toBeTruthy())

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    const input = screen.getByLabelText('搜索本地知识库（Ctrl/Cmd + K）') as HTMLInputElement
    expect(input.value).toBe('')
    expect(screen.queryByText('董事会决议')).toBeNull()
  })

  it('后端业务错误上屏，且不把空列表伪装成「没有命中」', async () => {
    installFetch([{ code: 5001, message: '索引服务未就绪', data: null }])
    render(<GlobalSearchPalette />)
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('搜索本地知识库（Ctrl/Cmd + K）'), {
      target: { value: '预算' },
    })
    await waitFor(() => expect(screen.getByText(/索引服务未就绪/)).toBeTruthy())
    expect(screen.queryByText('没有命中：索引里没有包含这些词的文件')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
