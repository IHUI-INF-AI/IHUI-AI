// @vitest-environment jsdom
import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

// mock next-themes,避免 ThemeProvider 上下文缺失
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
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

import { MermaidDiagram } from '../MermaidDiagram'
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
})
