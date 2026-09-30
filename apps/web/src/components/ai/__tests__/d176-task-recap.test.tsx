// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D176 交接生成流装车证明(2026-09-30 拍板立项,后端三段同枚落地后的 UI 侧判据):
// ① 生成相位 generating → done(摘要上屏,提交挂真回调);② 生成失败落 error 位(服务端原文);
// ③ revealFile 因桌面壳出口缺失仍渲染但禁用(禁而不藏);
// ④ 残余②收口(2026-09-30):创建会话成功后,交接正文经 chat store 待发草稿队列
//    draftInput + draftAutoSend 注入(MessageInput 消费后成为新会话首条用户消息),
//    正文必须含摘要与下一步(可选交接目的);⑤ 创建失败时不注入(误发进旧会话比不发更糟)。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import React from 'react'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const {
  generateRecapHandoff,
  createConversation,
  setConversationId,
  chatStoreSetState,
} = vi.hoisted(() => ({
  generateRecapHandoff: vi.fn(),
  createConversation: vi.fn(),
  setConversationId: vi.fn(),
  chatStoreSetState: vi.fn(),
}))
vi.mock('@ihui/api-client', () => ({ generateRecapHandoff, createConversation }))
vi.mock('@/stores/chat', () => ({
  // zustand store 既是 hook 又带静态 setState(草稿待发通道经 useChatStore.setState 写入,
  // 同 goal-card / next-steps-card 的既有生产者写法)—— 用 Object.assign 补静态面。
  useChatStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ conversationId: 'conv-1', setConversationId }),
    { setState: chatStoreSetState },
  ),
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
    // 组件收窄 ApiResult(成功分支 = { success: true, data }),mock 返回值须同形
    generateRecapHandoff.mockResolvedValue({
      success: true,
      data: { summary: '已完成 A 与 B', nextAction: '跑验证' },
    })
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

  it('创建会话成功后,交接正文经 draftInput+draftAutoSend 待发通道注入(含摘要/下一步/交接目的)', async () => {
    generateRecapHandoff.mockResolvedValue({
      success: true,
      data: { summary: '已完成 A 与 B', nextAction: '跑验证' },
    })
    createConversation.mockResolvedValue({
      success: true,
      data: { conversation: { id: 'conv-new' } },
    })
    openHandoff()
    fireEvent.change(screen.getByTestId('recap-purpose-input'), {
      target: { value: '带上下文继续' },
    })
    fireEvent.click(screen.getByTestId('recap-generate-submit'))
    await waitFor(() => expect(screen.getByTestId('recap-preview')).toBeTruthy())
    fireEvent.click(screen.getByTestId('recap-create-session'))
    await waitFor(() => expect(setConversationId).toHaveBeenCalledWith('conv-new'))
    expect(chatStoreSetState).toHaveBeenCalledTimes(1)
    // noUncheckedIndexedAccess:calls[0] 为 T|undefined,上一行已断言调用次数为 1,非空断言安全
    const payload = chatStoreSetState.mock.calls[0]![0] as {
      draftInput: string
      draftAutoSend: boolean
    }
    // MessageInput 消费该草稿后直接 submit —— 这三个内容段缺一不可,否则新会话首条丢了交接关键信息
    expect(payload.draftAutoSend).toBe(true)
    expect(payload.draftInput).toContain('【任务交接】已完成 A 与 B')
    expect(payload.draftInput).toContain('下一步:跑验证')
    expect(payload.draftInput).toContain('交接目的:带上下文继续')
  })

  it('创建会话失败时不注入草稿(误把交接正文发进旧会话比不发更糟)', async () => {
    generateRecapHandoff.mockResolvedValue({
      success: true,
      data: { summary: '已完成 A 与 B', nextAction: '跑验证' },
    })
    createConversation.mockRejectedValue(new Error('创建会话失败: 500'))
    openHandoff()
    fireEvent.click(screen.getByTestId('recap-generate-submit'))
    await waitFor(() => expect(screen.getByTestId('recap-preview')).toBeTruthy())
    // hoisted mock 跨用例共享调用账:先清掉前一用例的 setConversationId 记录,
    // 否则负断言会把上例的 'conv-new' 调用记到本例头上
    setConversationId.mockClear()
    chatStoreSetState.mockClear()
    fireEvent.click(screen.getByTestId('recap-create-session'))
    await waitFor(() => expect(screen.getByTestId('recap-create-failed')).toBeTruthy())
    expect(setConversationId).not.toHaveBeenCalled()
    expect(chatStoreSetState).not.toHaveBeenCalled()
  })

  it('装车层:入口确实挂在 AI 面板头部按钮组(dynamic import,不进主 chunk)', () => {
    // 与 D175 装车断言同一模式:读宿主源码验挂载,不重复渲染整个面板
    const host = readFileSync(
      join(__dirname, '..', 'ai-side-panel.tsx'),
      'utf8',
    )
    expect(host).toContain("import('@/components/ai/d176-task-recap').then((m) => m.TaskRecapEntry)")
    expect(host).toContain('<TaskRecapEntry />')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
