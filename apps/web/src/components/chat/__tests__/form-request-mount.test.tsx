// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// V3 #63(2026-09-27 立)—— form_request 的**对话流装车证明**。
//
// 票面原文的诊断是「BusinessFormCard 只在派发事件未在对话流消费」,也就是
// "卡片有、宿主有、解析通道有,唯独没人把它挂进消息流"。本用例钉的正是那一格:
// 渲染**真实的 MessageList**(不是宿主组件自身),断言一条 form_request 落 store 后
// 在消息流里长出卡片 —— 只测宿主证不出"挂上了",正如守门 70/76/81 反复记的那一型:
// 判据/组件存在 ≠ 有人调用它。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import MessageList from '../message-list/MessageList'
import { TooltipProvider } from '@/components/feedback'
import { useBusinessFormStore } from '@/stores/business-forms'

vi.mock('next-intl', async () => {
  const { formatIcu: renderIcu } = await import('@ihui/i18n')
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../packages/i18n/messages/web/zh-CN.json',
  )
  const root = JSON.parse(readFile(pack, 'utf8')) as Record<string, unknown>
  const resolve = (ns: string): Record<string, unknown> | undefined =>
    ns
      .split('.')
      .reduce<Record<string, unknown> | undefined>(
        (node, part) =>
          node && typeof node === 'object' ? (node[part] as Record<string, unknown>) : undefined,
        root,
      )
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        const raw = resolve(ns)?.[key]
        if (typeof raw !== 'string' || raw === '') return key
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
    useLocale: () => 'zh-CN',
  }
})

const MESSAGE_ID = 'msg-a-1'

function assistantMessage() {
  return {
    id: MESSAGE_ID,
    role: 'assistant' as const,
    content: '需要我帮你把这封邮件发出去吗?',
    createdAt: 1_760_000_000_000,
    model: 'test-model',
  }
}

function renderList() {
  // MessageItem 内的操作按钮走项目自有 Tooltip(要求 TooltipProvider 在场);
  // 生产由 app 布局提供,本用例按同样方式包一层 —— 不为过测试去 mock 掉 Tooltip。
  return render(
    <TooltipProvider>
      <MessageList
        messages={[assistantMessage()] as never}
        isStreaming={false}
        emptyTitle="空"
        emptyHint="空"
        assistantLabel="AI"
      />
    </TooltipProvider>,
  )
}

describe('V3 #63 form_request → 消息流宿主(装车点)', () => {
  beforeEach(() => {
    useBusinessFormStore.setState({ byMessage: {} })
  })

  afterEach(() => {
    cleanup()
    useBusinessFormStore.setState({ byMessage: {} })
  })

  it('store 里有一条待应答请求 ⇒ 真实 MessageList 内长出该消息的业务表单卡', () => {
    useBusinessFormStore.getState().appendFormRequest({
      requestId: 'frm-mount-001',
      sessionId: 'sess-mount',
      kind: 'email',
      messageId: MESSAGE_ID,
      actions: ['approve', 'reject'],
      status: 'pending',
    })

    const { container } = renderList()
    const section = container.querySelector('[data-testid="business-form-section"]')
    expect(section).not.toBeNull()
    // 宿主按消息 id 归属(不是全局浮层):段上必须点名它挂在哪条消息
    expect(section?.getAttribute('data-message-id')).toBe(MESSAGE_ID)
    const card = container.querySelector<HTMLElement>('[data-form-kind]')
    expect(card?.getAttribute('data-form-kind')).toBe('email')
    expect(card?.getAttribute('data-form-request-id')).toBe('frm-mount-001')
  })

  it('没有请求时整段不渲染(不给空框占位、不占文档流)', () => {
    const { container } = renderList()
    expect(container.querySelector('[data-testid="business-form-section"]')).toBeNull()
  })
})
