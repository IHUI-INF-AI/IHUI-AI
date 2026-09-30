// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D176 交接生成流装车证明(2026-09-30 拍板立项,后端三段同枚落地后的 UI 侧判据):
// ① 生成相位 generating → done(摘要上屏,提交挂真回调);② 生成失败落 error 位(服务端原文);
// ③ revealFile 因桌面壳出口缺失仍渲染但禁用(禁而不藏)。
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const { generateRecapHandoff, createConversation, setConversationId } = vi.hoisted(() => ({
  generateRecapHandoff: vi.fn(),
  createConversation: vi.fn(),
  setConversationId: vi.fn(),
}))
vi.mock('@ihui/api-client', () => ({ generateRecapHandoff, createConversation }))
vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ conversationId: 'conv-1', setConversationId }),
}))

import { TaskRecapEntry } from '../d176-task-recap'

afterEach(cleanup)

function openHandoff() {
  render(<TaskRecapEntry />)
  fireEvent.click(screen.getByTestId('ai-panel-recap-entry'))
  fireEvent.click(screen.getByTestId('recap-handoff-menu-item'))
}

describe('D176 交接生成流(出口翻真后)', () => {
  it('生成相位 generating → done,摘要与 next_action 上屏;提交挂真回调', async () => {
    generateRecapHandoff.mockResolvedValue({ summary: '已完成 A 与 B', nextAction: '跑验证' })
    openHandoff()
    expect((screen.getByTestId('recap-purpose-input') as HTMLInputElement).disabled).toBe(false)
    expect(screen.queryByTestId('recap-generation-unavailable')).toBeNull()
    fireEvent.click(screen.getByTestId('recap-generate-submit'))
    await waitFor(() => expect(screen.getByTestId('recap-preview')).toBeTruthy())
    expect(generateRecapHandoff).toHaveBeenCalledWith({ threadId: 'conv-1', purpose: undefined })
    expect(screen.getByTestId('recap-preview').textContent).toContain('已完成 A 与 B')
    expect(screen.getByTestId('recap-preview').textContent).toContain('跑验证')
  })

  it('生成失败落 error 位并展示服务端原文', async () => {
    generateRecapHandoff.mockRejectedValue(new Error('交接内容生成失败: 502'))
    openHandoff()
    fireEvent.click(screen.getByTestId('recap-generate-submit'))
    await waitFor(() => expect(screen.getByTestId('recap-generation-error')).toBeTruthy())
    expect(screen.getByTestId('recap-generation-error').textContent).toContain('502')
  })

  it('revealFile 无桌面壳出口:渲染但禁用(禁而不藏)', () => {
    openHandoff()
    expect((screen.getByTestId('recap-reveal-file') as HTMLButtonElement).disabled).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
