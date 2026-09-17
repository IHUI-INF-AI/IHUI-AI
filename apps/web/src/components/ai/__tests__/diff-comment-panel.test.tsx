// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: { line?: number; count?: number }) => {
    switch (key) {
      case 'diffComment.placeholderLine':
        return `对第 ${params?.line} 行提意见`
      case 'diffComment.placeholderFile':
        return '对本次改动提意见'
      case 'diffComment.submit':
        return '添加'
      case 'diffComment.hint':
        return 'Enter 发送'
      case 'diffComment.remove':
        return '删除这条意见'
      case 'diffComment.lineLabel':
        return `第 ${params?.line} 行`
      case 'diffComment.fileLevel':
        return '整个文件'
      default:
        return key
    }
  },
}))

import { DiffCommentPanel } from '../diff-comment-panel'
import { useChatStore } from '@/stores/chat'

/**
 * DiffCommentPanel 交互测试(P3 #30 diff 评论驱动返工,2026-09-16 立)
 *
 * 覆盖:空文本禁用提交 / 提交入队并清空输入 / onSubmitted 回调 /
 * Enter 提交与 Shift+Enter 换行 / 本文件意见列表渲染与删除 / 跨文件隔离。
 */
describe('DiffCommentPanel', () => {
  beforeEach(() => {
    useChatStore.setState({ pendingDiffComments: [] })
  })
  afterEach(() => cleanup())

  function fill(text: string) {
    const input = screen.getByTestId('diff-comment-input') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: text } })
    return input
  }

  it('空文本时提交按钮禁用(防误提交空意见)', () => {
    render(<DiffCommentPanel filePath="src/a.ts" />)
    const submit = screen.getByTestId('diff-comment-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
  })

  it('输入文本后提交按钮可用;点击提交入队并清空输入框', () => {
    render(<DiffCommentPanel filePath="src/a.ts" line={7} lineText="const x = 1" />)
    const input = fill('改用 let')
    const submit = screen.getByTestId('diff-comment-submit') as HTMLButtonElement
    expect(submit.disabled).toBe(false)

    fireEvent.click(submit)

    const list = useChatStore.getState().pendingDiffComments
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      filePath: 'src/a.ts',
      line: 7,
      lineText: 'const x = 1',
      comment: '改用 let',
    })
    // 提交后输入框清空
    expect(input.value).toBe('')
  })

  it('提交后触发 onSubmitted 回调(父组件据此收起面板)', () => {
    const onSubmitted = vi.fn()
    render(<DiffCommentPanel filePath="src/a.ts" onSubmitted={onSubmitted} />)
    fill('意见')
    fireEvent.click(screen.getByTestId('diff-comment-submit'))
    expect(onSubmitted).toHaveBeenCalledTimes(1)
  })

  it('Enter 提交,Shift+Enter 不提交(留作换行)', () => {
    render(<DiffCommentPanel filePath="src/a.ts" />)
    const input = fill('意见正文')

    // Shift+Enter 不触发提交
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(useChatStore.getState().pendingDiffComments).toHaveLength(0)

    // Enter 触发提交
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useChatStore.getState().pendingDiffComments).toHaveLength(1)
  })

  it('行级与文件级的 placeholder 文案不同', () => {
    const { unmount } = render(<DiffCommentPanel filePath="src/a.ts" line={12} />)
    expect((screen.getByTestId('diff-comment-input') as HTMLTextAreaElement).placeholder).toContain(
      '第 12 行',
    )
    unmount()
    render(<DiffCommentPanel filePath="src/a.ts" />)
    expect((screen.getByTestId('diff-comment-input') as HTMLTextAreaElement).placeholder).toContain(
      '本次改动',
    )
  })

  it('已暂存的本文件意见渲染在列表中(标注行号)', () => {
    useChatStore.setState({
      pendingDiffComments: [
        {
          id: 'dc-1',
          filePath: 'src/a.ts',
          line: 3,
          comment: '已有意见',
          createdAt: Date.now(),
        },
      ],
    })
    render(<DiffCommentPanel filePath="src/a.ts" />)
    const list = screen.getByTestId('diff-comment-list')
    expect(list.textContent).toContain('已有意见')
    expect(list.textContent).toContain('第 3 行')
  })

  it('点删除按钮移除该条意见', () => {
    useChatStore.setState({
      pendingDiffComments: [
        { id: 'dc-1', filePath: 'src/a.ts', comment: '待删除', createdAt: Date.now() },
      ],
    })
    render(<DiffCommentPanel filePath="src/a.ts" />)
    fireEvent.click(screen.getByTestId('diff-comment-remove-dc-1'))
    expect(useChatStore.getState().pendingDiffComments).toHaveLength(0)
  })

  it('本面板只展示当前文件的意见(跨文件隔离)', () => {
    useChatStore.setState({
      pendingDiffComments: [
        { id: 'dc-a', filePath: 'src/a.ts', comment: 'A 文件意见', createdAt: Date.now() },
        { id: 'dc-b', filePath: 'src/b.ts', comment: 'B 文件意见', createdAt: Date.now() },
      ],
    })
    render(<DiffCommentPanel filePath="src/a.ts" />)
    const list = screen.getByTestId('diff-comment-list')
    expect(list.textContent).toContain('A 文件意见')
    expect(list.textContent).not.toContain('B 文件意见')
  })
})
