// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 中文全角括号 autolink 收尾修正的成对用例(2026-10-29 立)。
 *
 * 病根实测(不是推断):GFM literal autolink 只把 ASCII 标点当 URL 边界,全角右括号被
 * 吞进 href —— `（见 https://example.com/a）` 的 href 实测是 `https://example.com/a）`,
 * 点开即 404。六种全角括号族(（）【】「」『』《》〈〉)全部同型。
 *
 * 本文件钉四件事:
 *   ① 六种全角闭括号(）】」』》〉)在 URL 尾部 ⇒ 从 href 里剥掉,且还原成链接之后的普通文本;
 *   ② **反向**:URL 内部合法含全角括号(维基百科消歧义 `中文（消歧义）`)⇒ 一个字符都不剥;
 *   ③ **反向**:半角括号 `(https://x.com)` ⇒ 行为不变(GFM 自己已处理);
 *   ④ **反向**:尾部无全角字符 ⇒ href 与正文一字不动。
 *
 * 断言形态:href 用**精确等值**(`toBe`),不用 `toContain` —— 判据是"URL 有没有被切坏",
 * 包含式断言对"多留一个全角括号"和"切掉了半个路径"都无感。
 *
 * 关于 decode:hast 会把 href 里的非 ASCII 做百分号编码(`mdast-util-to-hast` 的
 * normalizeUri),取值侧统一 `decodeURI` 回原字符再比。这不是放宽判据 —— 插件没剥时
 * `…%EF%BC%89` 解码后仍然带着 `）`,仍会被精确等值判红(见文末变异对照说明)。
 */
import { render, cleanup } from '@testing-library/react'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import {
  CJK_TRAILING_CLOSERS,
  trimCjkTrailingHref,
  remarkTrimCjkAutolink,
} from '../markdown-autolink-cjk'

/** 与 markdown-stream.tsx 的注册顺序保持一致(插件必须在 GFM 之后、remark-rehype 之前) */
const REMARK_PLUGINS = [[remarkGfm, { singleTilde: false }], remarkTrimCjkAutolink]

function renderMarkdown(md: string): HTMLElement {
  const { container } = render(
    React.createElement(ReactMarkdown, { remarkPlugins: REMARK_PLUGINS as unknown as never }, md),
  )
  return container
}

/** 取容器内唯一一条链接的 href(解码回原字符,见文件头注) */
function hrefOf(container: HTMLElement): string {
  const a = container.querySelector('a')
  if (!a) throw new Error('用例失去断言对象:渲染结果里没有 <a>')
  return decodeURI(a.getAttribute('href') ?? '')
}

/** 取容器内链接的文字 */
function linkTextOf(container: HTMLElement): string {
  const a = container.querySelector('a')
  if (!a) throw new Error('用例失去断言对象:渲染结果里没有 <a>')
  return a.textContent ?? ''
}

afterEach(() => {
  cleanup()
})

describe('六种全角闭括号(URL 尾部)⇒ 从 href 剥掉并还原成正文', () => {
  // 每例的 md 与 url 都写死。变异对照:把 remarkTrimCjkAutolink 从 REMARK_PLUGINS 摘掉,
  // 下列六例全部翻红(href 会带上 `%EF%BC%89` 解码后的闭括号)。
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
    it(`${c.label}:href 精确等于去掉 ${c.closer} 的 URL,闭括号回到正文`, () => {
      const container = renderMarkdown(c.md)
      expect(hrefOf(container)).toBe(c.url)
      // 链接文本也同步截短(否则 href 干净了,蓝色下划线仍画在括号上)
      expect(linkTextOf(container)).toBe(c.url)
      // 剥下来的闭括号必须是正文的一部分,且落在段落末尾
      expect(container.textContent?.endsWith(c.closer)).toBe(true)
    })
  }
})

describe('反向:URL 内部合法含全角括号 ⇒ 不剥', () => {
  it('维基百科消歧义后缀(成对 (）)完整保留,一个字符都不切', () => {
    const md = 'https://zh.wikipedia.org/wiki/中文（消歧义）'
    const container = renderMarkdown(md)
    expect(hrefOf(container)).toBe('https://zh.wikipedia.org/wiki/中文（消歧义）')
    expect(linkTextOf(container)).toBe(md)
    // 没有产生"剥回来的尾巴"节点:整段 textContent 就是这条 URL
    expect(container.textContent).toBe(md)
  })

  it('半角括号包住的 ASCII URL(GFM 自己已处理)⇒ 行为不变', () => {
    const container = renderMarkdown('(https://x.com)')
    expect(hrefOf(container)).toBe('https://x.com')
    expect(linkTextOf(container)).toBe('https://x.com')
    expect(container.textContent).toBe('(https://x.com)')
  })

  it('URL 尾部无全角字符 ⇒ href 与正文一字不动', () => {
    const md = '见 https://example.com/plain/path?q=1#frag 结束'
    const container = renderMarkdown(md)
    expect(hrefOf(container)).toBe('https://example.com/plain/path?q=1#frag')
    expect(container.textContent).toBe(md)
  })

  it('URL 内部成对全角括号 + 尾部多余闭括号 ⇒ 只剥多余那个,内部保留', () => {
    // 剥前实测 href = https://x.com/a（b））:
    //   末个 ） 在剩下那段里无配对(（=1,）=1)⇒ 剥;
    //   再往前那个 ） 在剩下那段里有配对(（=1 > ）=0)⇒ 停。
    const container = renderMarkdown('见（https://x.com/a（b））')
    expect(hrefOf(container)).toBe('https://x.com/a（b）')
    expect(container.textContent?.endsWith('）')).toBe(true)
  })
})

describe('边界:半角/全角混排与无配对标点', () => {
  it('全角括号 + 全角逗号连排 ⇒ 两个字符一起剥、一起回到正文', () => {
    const container = renderMarkdown('（见 https://example.com/g），')
    expect(hrefOf(container)).toBe('https://example.com/g')
    expect(container.textContent?.endsWith('），')).toBe(true)
  })

  it('尾部全角句号 ⇒ 剥掉(无配对概念)', () => {
    const container = renderMarkdown('详见 https://example.com/a。')
    expect(hrefOf(container)).toBe('https://example.com/a')
    expect(container.textContent?.endsWith('。')).toBe(true)
  })

  it('尾部全角冒号 ⇒ 剥掉', () => {
    const container = renderMarkdown('入口 https://example.com/a：')
    expect(hrefOf(container)).toBe('https://example.com/a')
    expect(container.textContent?.endsWith('：')).toBe(true)
  })

  it('显式 markdown 链接的文字不含 URL ⇒ href 剥尾但链接文字不动', () => {
    const container = renderMarkdown('[文档](https://example.com/a）)')
    expect(hrefOf(container)).toBe('https://example.com/a')
    expect(linkTextOf(container)).toBe('文档')
    expect(container.textContent?.endsWith('）')).toBe(true)
  })

  it('半角全角混排的括号包住 URL ⇒ 全角侧被剥、半角侧由 GFM 处理', () => {
    const container = renderMarkdown('「链接 (https://example.com/h)」')
    expect(hrefOf(container)).toBe('https://example.com/h')
    expect(container.textContent).toBe('「链接 (https://example.com/h)」')
  })
})

describe('纯函数判据(不经渲染,直接钉边界)', () => {
  it('六个全角闭括号都在配对表里,且各自配对到对应开括号', () => {
    expect(Object.keys(CJK_TRAILING_CLOSERS).sort()).toEqual(
      ['）', '】', '」', '』', '》', '〉'].sort(),
    )
    expect(CJK_TRAILING_CLOSERS['）']).toBe('（')
    expect(CJK_TRAILING_CLOSERS['】']).toBe('【')
    expect(CJK_TRAILING_CLOSERS['」']).toBe('「')
    expect(CJK_TRAILING_CLOSERS['』']).toBe('『')
    expect(CJK_TRAILING_CLOSERS['》']).toBe('《')
    expect(CJK_TRAILING_CLOSERS['〉']).toBe('〈')
  })

  it('空串与纯 ASCII 路径原样返回(rest 为空串)', () => {
    expect(trimCjkTrailingHref('')).toEqual({ href: '', rest: '' })
    expect(trimCjkTrailingHref('https://example.com/ok')).toEqual({
      href: 'https://example.com/ok',
      rest: '',
    })
  })

  it('失效方向:剥完剩余不足以构成 URL ⇒ 整体回退,不剥', () => {
    // 'https://）' 剥掉后只剩 'https://'(8 字符)< MIN_HREF_LENGTH ⇒ 保留原样
    expect(trimCjkTrailingHref('https://）')).toEqual({ href: 'https://）', rest: '' })
  })

  it('剥掉的字符原样交回调用方(顺序与原文逐字节一致)', () => {
    expect(trimCjkTrailingHref('https://example.com/a）】，')).toEqual({
      href: 'https://example.com/a',
      rest: '）】，',
    })
  })
})

describe('接线形状:插件不改动非链接内容', () => {
  it('没有链接的段落原样渲染(插件不产生额外节点)', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ReactMarkdown,
        { remarkPlugins: REMARK_PLUGINS as unknown as never },
        '这是一段没有链接的中文正文（括号在中间）。',
      ),
    )
    expect(html).toBe('<p>这是一段没有链接的中文正文（括号在中间）。</p>')
  })
})

/**
 * 接线锁:插件必须真接在 markdown-stream.tsx 的三处 ReactMarkdown 上。
 *
 * 病根是"造好没装车"——本仓高频失效型(§0.9)。这里量的是源码字面量:
 * 三处 remarkPlugins 都带 remarkTrimCjkAutolink、且 import 在位。
 * 变异对照:从任一处摘掉插件 ⇒ 本条翻红(渲染对用例也会一起红,但本条点得出是"没接线")。
 */
describe('接线锁:markdown-stream.tsx 三处 remarkPlugins 都装了本插件', () => {
  const streamSrc = readFileSync(
    resolve(__dirname, '../../components/ai/markdown-stream.tsx'),
    'utf8',
  )

  it('import 在位', () => {
    expect(streamSrc).toContain(
      "import { remarkTrimCjkAutolink } from '@/lib/markdown-autolink-cjk'",
    )
  })

  it('三处 remarkPlugins(StableBlock + 稳定前缀块外 + 无稳定前缀分支)全部注册', () => {
    const hits = streamSrc.match(
      /remarkPlugins=\{\[\[remarkGfm, \{ singleTilde: false \}\], remarkMath, remarkTrimCjkAutolink\]\}/g,
    )
    expect(hits?.length).toBe(3)
    // 反向:原三参形态一个都不许留(留了就是漏接一处)
    expect(streamSrc).not.toContain(
      'remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath]}',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
