// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'

// mock next-themes,避免 ThemeProvider 上下文缺失
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

// mock next-intl:MermaidDiagram 现走 useTranslations('a11y') 取词,按 zh-CN 词表回值(断言查中文值)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) =>
    (
      ({ diagramRendering: '渲染中…', mermaidRenderFailed: 'Mermaid 渲染失败' }) as Record<
        string,
        string
      >
    )[key] ?? key,
}))

// mock mermaid 模块,避免依赖真实渲染(测试不依赖真实 mermaid)
const mockMermaidRender = vi.fn()
const mockMermaidInitialize = vi.fn()
vi.mock('mermaid', () => ({
  default: {
    initialize: mockMermaidInitialize.mockResolvedValue(undefined),
    render: mockMermaidRender,
  },
}))

import { MermaidDiagram, __test__ as mermaidTest } from '../MermaidDiagram'
import { isMermaidLanguage } from '@/lib/markdown-mermaid-code'

describe('isMermaidLanguage', () => {
  it('识别 language-mermaid', () => {
    expect(isMermaidLanguage('language-mermaid')).toBe(true)
  })

  it('大小写不敏感识别', () => {
    expect(isMermaidLanguage('language-Mermaid')).toBe(true)
    expect(isMermaidLanguage('LANGUAGE-MERMAID')).toBe(true)
  })

  it('不识别 javascript 等其他语言', () => {
    expect(isMermaidLanguage('language-javascript')).toBe(false)
    expect(isMermaidLanguage('language-typescript')).toBe(false)
    expect(isMermaidLanguage('language-python')).toBe(false)
  })

  it('undefined / 空字符串安全返回 false', () => {
    expect(isMermaidLanguage(undefined)).toBe(false)
    expect(isMermaidLanguage('')).toBe(false)
  })
})

describe('MermaidDiagram', () => {
  beforeEach(() => {
    mockMermaidRender.mockReset()
    mockMermaidInitialize.mockReset()
    mockMermaidInitialize.mockResolvedValue(undefined)
    // 档⑨:模块台账跨用例存活;不清则同 code 的后例首帧命中、绕开 render 调用断言
    mermaidTest.clearMermaidRenderCache()
  })

  it('渲染成功时输出 SVG', async () => {
    mockMermaidRender.mockResolvedValue({ svg: '<svg><text>mocked</text></svg>' })
    const { container } = render(<MermaidDiagram code="graph TD;A-->B" />)
    await waitFor(() => {
      expect(container.innerHTML).toContain('<svg')
    })
    // 应该调用了 mermaid.render
    expect(mockMermaidRender).toHaveBeenCalledTimes(1)
  })

  it('渲染失败时显示错误块(包含 border-destructive)', async () => {
    mockMermaidRender.mockRejectedValue(new Error('parse error: invalid syntax'))
    const { container } = render(<MermaidDiagram code="invalid code" />)
    await waitFor(() => {
      expect(container.innerHTML).toContain('border-destructive')
    })
    // 错误消息也应展示
    expect(container.innerHTML).toContain('parse error: invalid syntax')
    // 错误块内应包含源码
    expect(container.innerHTML).toContain('invalid code')
  })

  it('渲染中显示占位(loading)', () => {
    // render 永不 resolve,保持 loading 状态
    mockMermaidRender.mockReturnValue(new Promise(() => {}))
    const { container } = render(<MermaidDiagram code="graph TD;A-->B" />)
    expect(container.innerHTML).toContain('渲染中')
  })

  it('⑨ 重挂(晋升场景)同主题同内容:新实例首帧同步取图,一次 render 都不再发起', async () => {
    mockMermaidRender.mockResolvedValue({ svg: '<svg><text>r1</text></svg>' })
    const first = render(<MermaidDiagram code="graph TD;R-->S" />)
    await waitFor(() => expect(first.container.querySelector('svg')).not.toBeNull())
    expect(mockMermaidRender).toHaveBeenCalledTimes(1)
    first.unmount()
    mockMermaidRender.mockClear()

    const second = render(<MermaidDiagram code="graph TD;R-->S" />)
    // **同步断言**(不套 waitFor):立刻出图 = 首帧即有;若走了 async render,这里必先见"渲染中"
    expect(second.container.querySelector('svg')).not.toBeNull()
    expect(second.container.innerHTML).not.toContain('渲染中')
    expect(mockMermaidRender).not.toHaveBeenCalled()
  })

  it('⑨ 并发合流:同键第二个实例不付第二次主线程布局,两实例同得消毒后结果', async () => {
    type RenderResult = { svg: string }
    let release: ((value: RenderResult) => void) | null = null
    mockMermaidRender.mockImplementation(
      () =>
        new Promise<RenderResult>((resolve) => {
          release = resolve
        }),
    )
    const viewA = render(<MermaidDiagram code="graph TD;P-->Q" />)
    await waitFor(() => expect(mockMermaidRender).toHaveBeenCalledTimes(1))

    const viewB = render(<MermaidDiagram code="graph TD;P-->Q" />)
    // B 挂上同一支在飞任务:render/initialize 都没被付第二次
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockMermaidRender).toHaveBeenCalledTimes(1)
    expect(mockMermaidInitialize).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(viewB.container.innerHTML).toContain('渲染中'))

    await act(async () => {
      release?.({ svg: '<svg><text>shared</text></svg>' })
      await Promise.resolve()
    })
    await waitFor(() => expect(viewA.container.innerHTML).toContain('shared'))
    await waitFor(() => expect(viewB.container.innerHTML).toContain('shared'))
    expect(mockMermaidRender).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
