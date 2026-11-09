// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

// 与 PageClient.test.tsx 同口径：只旁路展示层原子组件与 i18n，绝不 vi.mock('@/lib/api')。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@ihui/ui-react', () => ({
  Button: ({ children, ...rest }: Record<string, unknown>) => (
    <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children as React.ReactNode}
    </button>
  ),
  Input: (props: Record<string, unknown>) => (
    <input {...(props as React.InputHTMLAttributes<HTMLInputElement>)} />
  ),
}))

import Sag2Page, { metadata } from './page'

const STATUS = {
  version: 3,
  documents: 2,
  chunks: 9,
  terms: 128,
  avg_chunk_length: 120.5,
  ready: true,
  backend: 'bm25',
  judge_provider: 'none',
}

function installFetch(replies: Array<{ status: number; body: string }>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  let index = 0
  const fn = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input)
    calls.push({ url, init: init ?? {} })
    const reply = replies[Math.min(index, replies.length - 1)]!
    index += 1
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      headers: { get: () => null },
      text: async () => reply.body,
      json: async () => JSON.parse(reply.body),
    } as unknown as Response
  })
  vi.stubGlobal('fetch', fn)
  return { calls, fn }
}

/** 按 URL 后缀路由：页面被 q 参数带起来时 status 与 search 会并发首发，不能赌顺序。 */
function installRouted(routes: Array<{ suffix: string; body: string }>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const fn = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input)
    calls.push({ url, init: init ?? {} })
    const hit = routes.find((r) => url.endsWith(r.suffix))
    if (!hit) throw new Error(`未预期的请求: ${url}`)
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => hit.body,
      json: async () => JSON.parse(hit.body),
    } as unknown as Response
  })
  vi.stubGlobal('fetch', fn)
  return { calls, fn }
}

/**
 * page.tsx 是 **async server component**：RTL 不能直接 render 返回 Promise 的组件
 * （渲染结果会是空 div，测试变成假绿）。这里按 Next 的调用约定先 await 出元素树再 render，
 * 因此「searchParams → PageClient props」这一段是真的被执行过的。
 */
async function renderPage(params: { q?: string; path?: string } = {}) {
  const tree = await Sag2Page({ searchParams: Promise.resolve(params) })
  return render(tree)
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('SAG2 page.tsx 页面壳', () => {
  it('导出正确的 metadata.title', () => {
    expect(metadata.title).toBe('SAG2 词法多跳检索')
  })

  it('渲染页面壳 → 真实 GET /status → 成功信封 {code:0,data} 解包后索引态上屏', async () => {
    const body = JSON.stringify({ code: 0, message: 'ok', data: STATUS })
    const { calls, fn } = installFetch([{ status: 200, body }])
    await renderPage()

    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy())
    expect(screen.getByText(/version 3/)).toBeTruthy()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(calls[0]!.url).toBe('/api/v1/ai/sag2/status')
    expect((calls[0]!.init.method ?? 'GET').toUpperCase()).toBe('GET')
  })

  it('页面壳在业务错误信封下也把错误态传给 PageClient（不静默）', async () => {
    const body = JSON.stringify({ code: 50001, message: '索引损坏', data: null })
    const { calls, fn } = installFetch([{ status: 200, body }])
    await renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('索引损坏')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(calls[0]!.url).toBe('/api/v1/ai/sag2/status')
  })

  it('searchParams 里的 q/path 真的落到 PageClient：自动检索 + 页内显示来源文件', async () => {
    const search = JSON.stringify({
      code: 0,
      message: 'ok',
      data: {
        query: '预算',
        mode: 'bm25',
        model_calls: 0,
        total_files: 1,
        page: 1,
        per_page: 20,
        items: [],
        duration_ms: 2,
      },
    })
    const status = JSON.stringify({ code: 0, message: 'ok', data: STATUS })
    const { calls } = installRouted([
      { suffix: '/sag2/status', body: status },
      { suffix: '/sag2/search', body: search },
    ])
    await renderPage({ q: '预算', path: 'docs/board.md' })

    // 服务端参数直接变成输入框初值 + 一次自动检索，用户不必重打。
    await waitFor(() =>
      expect((screen.getByPlaceholderText('queryPlaceholder') as HTMLInputElement).value).toBe(
        '预算',
      ),
    )
    const searchCall = calls.find((c) => c.url.endsWith('/sag2/search'))
    expect(searchCall).toBeTruthy()
    expect(JSON.parse(String(searchCall!.init.body)) as unknown).toEqual({
      query: '预算',
      page: 1,
      per_page: 20,
    })
    // 点选的那份文件在页内可见（fromPalette 提示 + 原样路径）。
    expect(screen.getByText(/fromPalette/).textContent).toContain('docs/board.md')
  })
})
