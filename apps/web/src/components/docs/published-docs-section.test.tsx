// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/api', () => ({
  apiOrThrow: vi.fn(),
}))

import { apiOrThrow } from '@/lib/api'
import { PublishedDocsSection } from './published-docs-section'

/**
 * 接线锁(判据 import 源组件,零复算):
 * - ① 空表整块不渲染 ⇒ 首页不长出空板块(票面验收「表为空时页面不出现空板块」);
 * - ② pending 零占位 ⇒ 不是骨架屏常驻;
 * - ③ error 与 ④ 信封形状不对 ⇒ 必须走错误态,**绝不**伪装成「没有文档」;
 * - ⑤ 链接一律 /docs/<slug>,与单篇腿 `/api/docs/:slug` 同源;
 * - ⑥ 摘要走 @/lib/content 的既有 excerptFromContent(端内不重抄剥离算法);
 * - ⑦ UI 纪律形态锁:无 hr / divide-* / 单侧边框分隔线 / emoji。
 */

function makeDoc(slug: string, title = `标题-${slug}`, extra: Record<string, unknown> = {}) {
  return { slug, title, category: 'guide', updatedAt: '2026-11-03T00:00:00.000Z', ...extra }
}

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PublishedDocsSection />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.mocked(apiOrThrow).mockReset()
})

describe('PublishedDocsSection 三态分离', () => {
  it('① list 为空 ⇒ 整块不渲染,不留占位', async () => {
    vi.mocked(apiOrThrow).mockResolvedValue({ list: [] })
    const { container } = renderSection()
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })

  it('② pending ⇒ 整块零占位(不是骨架屏)', () => {
    vi.mocked(apiOrThrow).mockReturnValue(new Promise(() => {}))
    const { container } = renderSection()
    expect(container.innerHTML).toBe('')
  })

  it('③ 请求失败 ⇒ 渲染错误态文案,不渲染成空板块', async () => {
    vi.mocked(apiOrThrow).mockRejectedValue(new Error('boom'))
    const { container } = renderSection()
    await waitFor(() => expect(container.textContent).toContain('errorTitle'))
    expect(container.querySelectorAll('a').length).toBe(0)
  })

  it('④ data.list 非数组(形状不对) ⇒ 同样走错误态', async () => {
    vi.mocked(apiOrThrow).mockResolvedValue({})
    const { container } = renderSection()
    await waitFor(() => expect(container.textContent).toContain('errorTitle'))
  })

  it('⑤ N 条 ⇒ N 个 /docs/<slug> 链接且标题逐条正确', async () => {
    vi.mocked(apiOrThrow).mockResolvedValue({ list: [makeDoc('a-1'), makeDoc('b 2')] })
    const { container } = renderSection()
    await waitFor(() => expect(container.querySelectorAll('ul li').length).toBe(2))
    const links = Array.from(container.querySelectorAll('ul li a'))
    // slug 含空格必须被 encodeURIComponent(b 2 → b%202),否则链接指向不存在的路由
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/docs/a-1', '/docs/b%202'])
    expect(links.map((a) => a.querySelector('div')?.textContent)).toEqual(['标题-a-1', '标题-b 2'])
  })

  it('⑤b 超过 8 条 ⇒ 只渲染首页上限条数', async () => {
    vi.mocked(apiOrThrow).mockResolvedValue({
      list: Array.from({ length: 11 }, (_, i) => makeDoc(`d${i}`)),
    })
    const { container } = renderSection()
    await waitFor(() => expect(container.querySelectorAll('ul li').length).toBe(8))
  })

  it('⑥ summary 缺省 ⇒ 由 content 经既有 excerptFromContent 派生', async () => {
    vi.mocked(apiOrThrow).mockResolvedValue({
      list: [makeDoc('x', '标题-x', { content: '# 部署\n\n先 `docker compose up`。' })],
    })
    const { container } = renderSection()
    await waitFor(() => expect(container.querySelectorAll('ul li').length).toBe(1))
    const text = container.querySelector('ul li a')?.textContent ?? ''
    expect(text).toContain('部署')
    expect(text).not.toContain('#')
    expect(text).not.toContain('`')
  })

  it('⑦ UI 纪律:无 hr / divide-* / 单侧边框 / emoji 字形', async () => {
    vi.mocked(apiOrThrow).mockResolvedValue({ list: [makeDoc('a-1')] })
    const { container } = renderSection()
    await waitFor(() => expect(container.querySelectorAll('ul li').length).toBe(1))
    expect(container.querySelector('hr')).toBeNull()
    const tokens = Array.from(container.querySelectorAll('*')).flatMap((el) =>
      (el.getAttribute('class') ?? '').split(/\s+/),
    )
    expect(tokens.some((cls) => cls.startsWith('divide-'))).toBe(false)
    expect(tokens.some((cls) => /^border-[tblr](?![a-z])/.test(cls))).toBe(false)
    const emoji = /\p{Extended_Pictographic}/u
    expect(container.textContent).not.toMatch(emoji)
    expect(container.innerHTML).not.toMatch(emoji)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
