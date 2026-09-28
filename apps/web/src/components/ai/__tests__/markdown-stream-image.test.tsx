// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// G-737/G-738(2026-09-28,ZCode ui 层吸收第 24 批)的落地用例:
// · G-738 —— 流式内联图三态(加载中 role="status" / 成功 img 可见 / 失败 role="img"+aria-label),
//   并成对钉住两条写法纪律:状态↔src 配对(换资源旧状态不得续用)、key 按资源重建。
// · G-737 —— 解析模式(isStreaming)不得进入渲染器身份:翻转 isStreaming 而内容逐字相同时,
//   StableBlock 收到的 components 引用必须不变(旧 deps [collapseLines, isStreaming] 下该引用必变,
//   稳定前缀 memo 失效整段重 parse —— 这里正是它的留痕处)。
// 判据键名走 next-intl mock 回显(断言不查文案,与 image-preview-pack.test.tsx 同一取向)。
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react'

// react-markdown 渲染日志:每次渲染记录 (children, components)。
// G-737 的"身份"是 React 引用等值问题,只能从渲染器实际收到的 props 上量,不得靠源码正则。
const { mdRenderLog } = vi.hoisted(() => ({
  mdRenderLog: [] as Array<{ children: unknown; components: unknown }>,
}))

vi.mock('react-markdown', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-markdown')
  const Real = actual.default as React.ComponentType<Record<string, unknown>>
  const MarkdownSpy = (props: Record<string, unknown>) => {
    mdRenderLog.push({ children: props.children, components: props.components })
    return React.createElement(Real, props)
  }
  return { ...actual, default: MarkdownSpy }
})

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
import { splitMarkdownStable } from '@/lib/markdown-stable-split'

function imgIn(container: HTMLElement): HTMLImageElement | null {
  return container.querySelector('img')
}

afterEach(() => {
  cleanup()
  mdRenderLog.length = 0
})

describe('G-738 流式内联图三态', () => {
  it('② 加载中:role="status" 占位在位且 img 暂不可见;加载成功后占位消失、img 转可见(正反成对)', async () => {
    const { container } = render(<MarkdownStream content={'![图](https://img.test/c.png)'} />)
    await waitFor(() => expect(imgIn(container)).toBeTruthy())
    // 加载中正例
    expect(container.querySelector('[role="status"]')).toBeTruthy()
    expect(imgIn(container)?.className).toContain('invisible')
    // 成功反例:占位不得在 loaded 后仍挂 role="status"
    fireEvent.load(imgIn(container) as HTMLImageElement)
    await waitFor(() => expect(container.querySelector('[role="status"]')).toBeNull())
    expect(imgIn(container)?.className).not.toContain('invisible')
    // 成功态也不是失败占位
    expect(container.querySelector('[data-markdown-image-state="error"]')).toBeNull()
  })

  it('① 喂 A 失败、切到 B:B 不继承 A 的失败态(状态↔src 配对),从加载中抵达成功;key 重建 ⇒ 非复用节点', async () => {
    const { container, rerender } = render(
      <MarkdownStream content={'![图一](https://img.test/a.png)'} isStreaming />,
    )
    await waitFor(() => expect(imgIn(container)).toBeTruthy())
    const nodeA = imgIn(container) as HTMLImageElement
    fireEvent.error(nodeA)
    await waitFor(() =>
      expect(container.querySelector('[data-markdown-image-state="error"]')).toBeTruthy(),
    )

    // 同位置改写图片(流式中 src 变化,MarkdownImage 组件实例被 React 复用)
    rerender(<MarkdownStream content={'![图二](https://img.test/b.png)'} isStreaming />)
    await waitFor(() =>
      expect(container.querySelector('img[src="https://img.test/b.png"]')).toBeTruthy(),
    )
    // 配对判据:state.source(a) !== 当前 src(b) ⇒ 旧 error 作废
    expect(container.querySelector('[data-markdown-image-state="error"]')).toBeNull()
    expect(container.querySelector('[role="status"]')).toBeTruthy()
    // key 按资源重建:B 是全新节点,不是 A 的复用(否则 A 的迟到异步事件会命中 B 的处理器)
    const nodeB = imgIn(container) as HTMLImageElement
    expect(nodeB).not.toBe(nodeA)
    // B 抵达成功态(而非停在失败占位)
    fireEvent.load(nodeB)
    await waitFor(() => expect(container.querySelector('[role="status"]')).toBeNull())
    expect(nodeB.className).not.toContain('invisible')
    expect(container.querySelector('[data-markdown-image-state="error"]')).toBeNull()
  })

  it('③ 失败态:role="img" + aria-label(复用 ai.toolCall.imageLoadFailed 既有键),含矢量图标非空白;与 role="status" 分离', async () => {
    const { container } = render(<MarkdownStream content={'![图](https://img.test/d.png)'} />)
    await waitFor(() => expect(imgIn(container)).toBeTruthy())
    fireEvent.error(imgIn(container) as HTMLImageElement)
    await waitFor(() =>
      expect(container.querySelector('[data-markdown-image-state="error"]')).toBeTruthy(),
    )
    const block = container.querySelector('[data-markdown-image-state="error"]') as Element
    expect(block.getAttribute('role')).toBe('img')
    expect(block.getAttribute('aria-label')).toBe('imageLoadFailed')
    // 非空白区域:内有 lucide ImageOff 的 <svg>(禁止 emoji/纯文字占位)
    expect(block.querySelector('svg')).toBeTruthy()
    // 两种 aria 语义各自独立容器:失败时不得同时有 role="status"
    expect(container.querySelector('[role="status"]')).toBeNull()
    // 失败时不再渲染破图本体
    expect(imgIn(container)).toBeNull()
  })
})

describe('G-737 解析模式不进入渲染器身份', () => {
  const PARAGRAPH = '这是第一段很长的中文正文内容,用来把消息推过切分阈值。'.repeat(60)
  const LONG = `${PARAGRAPH}\n\n第二段落仍在活跃段内。`
  const { stable } = splitMarkdownStable(LONG)

  it('④ isStreaming 翻转(内容逐字相同)⇒ StableBlock 的 components 引用不变;流式追加而前缀不变 ⇒ parse 计数不增', async () => {
    if (!stable) throw new Error('setup failed: 内容未达切分阈值,不存在稳定前缀,判据无从验证')
    const stableCount = () => mdRenderLog.filter((e) => e.children === stable).length

    const { rerender } = render(<MarkdownStream content={LONG} isStreaming />)
    // 稳定前缀首次 parse 恰好一次
    await waitFor(() => expect(stableCount()).toBe(1))
    const comps1 = mdRenderLog.find((e) => e.children === stable)?.components
    expect(comps1).toBeTruthy()

    // 翻 false:走全量单路径(P3 #35 切分门按设计整段呈现),全文 parse 一次
    rerender(<MarkdownStream content={LONG} isStreaming={false} />)
    await waitFor(() => expect(mdRenderLog.some((e) => e.children === LONG)).toBe(true))

    // 翻回 true,内容未变:StableBlock 重新挂载并 parse 第二次 —— 但它拿到的
    // components 必须仍是同一引用(G-737 修复点;旧 deps [collapseLines, isStreaming]
    // 下这里必为新对象,断言翻红)。
    rerender(<MarkdownStream content={LONG} isStreaming />)
    await waitFor(() => expect(stableCount()).toBe(2))
    const second = mdRenderLog.filter((e) => e.children === stable)[1]
    expect(second?.components).toBe(comps1)

    // 流式继续:活跃段追加、稳定前缀逐字不变 ⇒ memo 命中,稳定段 parse 计数不增
    rerender(<MarkdownStream content={`${LONG}活跃段继续追加。`} isStreaming />)
    await waitFor(() =>
      expect(
        mdRenderLog.some(
          (e) => typeof e.children === 'string' && e.children.includes('活跃段继续追加'),
        ),
      ).toBe(true),
    )
    expect(stableCount()).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
