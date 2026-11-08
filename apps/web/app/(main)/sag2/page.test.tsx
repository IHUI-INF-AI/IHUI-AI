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
    <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children as React.ReactNode}</button>
  ),
  Input: (props: Record<string, unknown>) => <input {...(props as React.InputHTMLAttributes<HTMLInputElement>)} />,
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
    render(<Sag2Page />)

    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy())
    expect(screen.getByText(/version 3/)).toBeTruthy()
    expect(fn).toHaveBeenCalledTimes(1)
    expect(calls[0]!.url).toBe('/api/v1/ai/sag2/status')
    expect((calls[0]!.init.method ?? 'GET').toUpperCase()).toBe('GET')
  })

  it('页面壳在业务错误信封下也把错误态传给 PageClient（不静默）', async () => {
    const body = JSON.stringify({ code: 50001, message: '索引损坏', data: null })
    const { calls, fn } = installFetch([{ status: 200, body }])
    render(<Sag2Page />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('索引损坏')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(calls[0]!.url).toBe('/api/v1/ai/sag2/status')
  })
})
