// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 全角括号 autolink 收尾修正的**端到端接线**用例(2026-10-29 立)。
 *
 * 与 `src/lib/__tests__/markdown-autolink-cjk.test.ts` 的分工:
 *   · lib 那份钉**判据**(纯函数 + 自建 remark 管线),证明"插件本身做对了";
 *   · 本份钉**装车**(走真实的 `MarkdownStream`),证明"这行插件真挂在生产渲染器上"。
 *
 * 为什么必须两份:本仓高频失效型是"造好没装车"(§0.9)。判据用例自建
 * `[remarkGfm, remarkTrimCjkAutolink]` 管线,把插件从 `markdown-stream.tsx` 摘掉它照样全绿 ——
 * 那是盲绿。本份的六例全角用例**只**经过生产组件,因而满足变异对照:
 *
 *   把 `markdown-stream.tsx` 三处 `remarkPlugins` 里的 `remarkTrimCjkAutolink` 摘掉
 *   ⇒ 下列六例全部翻红(href 会带回 `%EF%BC%89` 解码后的全角闭括号),零例侥幸通过。
 *
 * 断言形态:href 用精确等值,不用 toContain(见 lib 那份文件头注的同一理由)。
 */
import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('react-syntax-highlighter', () => ({
  Prism: () => React.createElement('pre', { 'data-testid': 'syntax-highlighter' }),
}))

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: { __styleKey: 'oneDark' },
  oneLight: { __styleKey: 'oneLight' },
}))

vi.mock('@/components/media/MermaidDiagram', () => ({
  default: () => React.createElement('div', { 'data-testid': 'mermaid' }),
}))

import { MarkdownStream } from '../markdown-stream'

/** 渲染生产组件,取唯一链接的 href(解码回原字符:hast 会把非 ASCII 做百分号编码) */
function renderHref(md: string): { href: string; text: string; full: string } {
  const { container } = render(<MarkdownStream content={md} isStreaming={false} />)
  const a = container.querySelector('a')
  if (!a) throw new Error('用例失去断言对象:生产组件渲染结果里没有 <a>')
  return {
    href: decodeURI(a.getAttribute('href') ?? ''),
    text: a.textContent ?? '',
    full: container.textContent ?? '',
  }
}

afterEach(() => {
  cleanup()
})

describe('生产渲染器(MarkdownStream)上的六种全角闭括号', () => {
  // 变异对照面:摘掉 markdown-stream.tsx 的插件注册 ⇒ 下列六例全红。
  const cases: Array<{ label: string; md: string; url: string; closer: string }> = [
    {
      label: '（）圆括号',
      md: '（见 https://example.com/a）',
      url: 'https://example.com/a',
      closer: '）',
    },
    {
      label: '【】方头括号',
      md: '【文档 https://example.com/b】',
      url: 'https://example.com/b',
      closer: '】',
    },
    {
      label: '「」直角引号',
      md: '「链接 https://example.com/c」',
      url: 'https://example.com/c',
      closer: '」',
    },
    {
      label: '『』双直角引号',
      md: '『引用 https://example.com/d』',
      url: 'https://example.com/d',
      closer: '』',
    },
    {
      label: '《》书名号',
      md: '《规范 https://example.com/e》',
      url: 'https://example.com/e',
      closer: '》',
    },
    {
      label: '〈〉单书名号',
      md: '〈条款 https://example.com/f〉',
      url: 'https://example.com/f',
      closer: '〉',
    },
  ]

  for (const c of cases) {
    it(`${c.label}:href 精确等于 ${c.url},${c.closer} 回到正文`, () => {
      const got = renderHref(c.md)
      expect(got.href).toBe(c.url)
      expect(got.text).toBe(c.url)
      expect(got.full.endsWith(c.closer)).toBe(true)
    })
  }
})

describe('生产渲染器上的反向用例(不得因本插件被改坏)', () => {
  it('URL 内部成对全角括号(维基消歧义)完整保留', () => {
    const md = 'https://zh.wikipedia.org/wiki/中文（消歧义）'
    const got = renderHref(md)
    expect(got.href).toBe(md)
    expect(got.full).toBe(md)
  })

  it('半角括号包住的 ASCII URL 行为不变', () => {
    const got = renderHref('(https://x.com)')
    expect(got.href).toBe('https://x.com')
    expect(got.full).toBe('(https://x.com)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
