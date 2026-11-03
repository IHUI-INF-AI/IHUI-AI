// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: { count?: number }) => {
    switch (key) {
      case 'diffComment.pendingBanner':
        return `有 ${params?.count} 条代码改动意见待发送`
      case 'diffComment.remove':
        return '删除这条意见'
      default:
        return key
    }
  },
}))

import { DiffCommentsBar } from '../diff-comments-bar'
import { useChatStore } from '@/stores/chat'

/**
 * DiffCommentsBar 测试(P3 #30,2026-09-16 立)
 *
 * 覆盖:空队列不渲染(零占位) / 计数文案 / 一键清空。
 */
describe('DiffCommentsBar', () => {
  beforeEach(() => {
    useChatStore.setState({ pendingDiffComments: [] })
  })
  afterEach(() => cleanup())

  it('队列为空时不渲染(零占位)', () => {
    const { container } = render(<DiffCommentsBar />)
    expect(container.firstChild).toBeNull()
  })

  it('有意见时渲染计数文案', () => {
    useChatStore.setState({
      pendingDiffComments: [
        { id: 'c1', filePath: 'a.ts', comment: 'A', createdAt: Date.now() },
        { id: 'c2', filePath: 'b.ts', comment: 'B', createdAt: Date.now() },
      ],
    })
    render(<DiffCommentsBar />)
    const bar = screen.getByTestId('diff-comments-bar')
    expect(bar.textContent).toContain('有 2 条代码改动意见待发送')
  })

  it('点清空按钮清空队列', () => {
    useChatStore.setState({
      pendingDiffComments: [{ id: 'c1', filePath: 'a.ts', comment: 'A', createdAt: Date.now() }],
    })
    render(<DiffCommentsBar />)
    fireEvent.click(screen.getByTestId('diff-comments-bar-clear'))
    expect(useChatStore.getState().pendingDiffComments).toHaveLength(0)
  })
})
