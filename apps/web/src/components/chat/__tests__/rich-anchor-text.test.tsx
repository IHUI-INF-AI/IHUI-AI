// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RICH_ANCHOR_TAGS } from '@ihui/shared/chat'

import {
  MISSING_ANCHOR_RENDERERS,
  RICH_ANCHOR_COMPONENTS,
  RichAnchorText,
  renderRichAnchorNodes,
  richAnchorRenderer,
} from '../rich-anchor-text'

describe('D99② 渲染表与共享层白名单同源', () => {
  it('白名单每个标签都配了渲染函数(无缺失)', () => {
    expect(MISSING_ANCHOR_RENDERERS).toEqual([])
    for (const tag of RICH_ANCHOR_TAGS) {
      expect(typeof RICH_ANCHOR_COMPONENTS[tag]).toBe('function')
    }
  })

  it('richAnchorRenderer 返回的就是同一张表里的那一个函数(供 t.rich 取用)', () => {
    expect(richAnchorRenderer('code')).toBe(RICH_ANCHOR_COMPONENTS.code)
    expect(richAnchorRenderer('action')).toBe(RICH_ANCHOR_COMPONENTS.action)
  })

  it('渲染表键集合 === 共享层白名单(不多不少)', () => {
    expect(Object.keys(RICH_ANCHOR_COMPONENTS).sort()).toEqual([...RICH_ANCHOR_TAGS].sort())
  })
})

describe('D99② 白名单标签渲染出真实元素', () => {
  it('action/detail 渲染为可辨识的语义容器并保留文本', () => {
    const { container } = render(
      <RichAnchorText text="<action>正在读取</action><detail>src/a.ts</detail>" />,
    )
    expect(container.textContent).toBe('正在读取src/a.ts')
    // detail 走 muted 色、action 走前景加粗 —— 两者都是 span,按 class 断言语义分层
    expect(container.querySelectorAll('span').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('.text-muted-foreground')?.textContent).toBe('src/a.ts')
  })

  it('code / branch 渲染为 <code>,strong 渲染为 <strong>', () => {
    const { container } = render(
      <RichAnchorText text="<code>pnpm test</code><branch>main</branch><strong>重要</strong>" />,
    )
    const codes = container.querySelectorAll('code')
    expect(codes.length).toBe(2)
    expect(container.querySelector('strong')?.textContent).toBe('重要')
  })

  it('a / link / learnMore 渲染为可辨识链接样式(带下划线语义类)', () => {
    const { container } = render(<RichAnchorText text="<a>看这里</a>" />)
    expect(container.querySelector('.text-primary.underline')?.textContent).toBe('看这里')
  })

  it('嵌套锚点保持层级', () => {
    const { container } = render(
      <RichAnchorText text="<action>跑<detail>a.ts</detail>完</action>" />,
    )
    expect(container.textContent).toBe('跑a.ts完')
    expect(container.querySelector('.text-muted-foreground')?.textContent).toBe('a.ts')
  })
})

describe('D99② 安全反例:非白名单标签不得成为标记', () => {
  const XSS = '<script>window.__xss=1</script><img src=x onerror="window.__xss=2">'

  it('<script> / <img onerror> 不产生元素,且被转义成可见文本', () => {
    const { container } = render(<RichAnchorText text={XSS} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    // 关键:进入 DOM 的是转义后的文本,而不是可执行标记
    expect(container.innerHTML).not.toContain('<script')
    expect(container.innerHTML).not.toContain('<img')
    expect(container.innerHTML).toContain('&lt;script')
  })

  it('副作用未被触发(window 未被污染)', () => {
    render(<RichAnchorText text={XSS} />)
    const w = window as unknown as Record<string, unknown>
    expect(w.__xss).toBeUndefined()
  })

  it('危险串中夹带的白名单标签仍然正常渲染(只解释白名单)', () => {
    const { container } = render(<RichAnchorText text={'<script>x</script><action>跑</action>'} />)
    expect(container.querySelector('.font-medium')?.textContent).toBe('跑')
    expect(container.innerHTML).toContain('&lt;script')
  })

  it('带属性 / 自闭合形态不进白名单语义(按文本转义)', () => {
    const { container } = render(
      <RichAnchorText text={'<link href="javascript:alert(1)">x</link>'} />,
    )
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toBe('<link href="javascript:alert(1)">x</link>')
  })
})

describe('D99② 降级与自定义', () => {
  it('无锚点的纯文本走零额外层级路径', () => {
    const { container } = render(<RichAnchorText text="就是一句普通文案" />)
    expect(container.querySelector('span')).toBeNull()
    expect(container.textContent).toBe('就是一句普通文案')
  })

  it('空值渲染为 null', () => {
    const { container } = render(<RichAnchorText text="" />)
    expect(container.textContent).toBe('')
    const { container: c2 } = render(<RichAnchorText text={null} />)
    expect(c2.textContent).toBe('')
  })

  it('自定义渲染表可覆盖默认表', () => {
    const nodes = renderRichAnchorNodes(
      [{ kind: 'anchor', tag: 'code', children: [{ kind: 'text', value: 'x' }] }],
      { ...RICH_ANCHOR_COMPONENTS, code: (chunks) => <em>{chunks}</em> },
    )
    const { container } = render(<span>{nodes}</span>)
    expect(container.querySelector('em')?.textContent).toBe('x')
    expect(container.querySelector('code')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
