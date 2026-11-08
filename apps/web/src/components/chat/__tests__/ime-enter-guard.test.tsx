// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { QuestionDialog } from '../question-dialog'
import { ConversationOrgDialog } from '../conversation-org-dialog'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/chat/conversation-folder-admin', () => ({
  ConversationFolderAdmin: () => null,
}))

describe('输入法组合态 Enter 守卫(W-04/W-05)', () => {
  it('提问弹窗:组合态 Enter 不提交,上屏后的 Enter 才提交', () => {
    const onSubmit = vi.fn()
    render(
      <QuestionDialog
        question={{
          questionId: 'q1',
          prompt: '请输入',
          options: [],
          allowCustom: true,
          allowMultiple: false,
        }}
        onSubmit={onSubmit}
        onSkip={() => {}}
      />,
    )

    const input = screen.getByLabelText('customPlaceholder')
    fireEvent.change(input, { target: { value: '你好' } })

    // 输入法选词上屏:keyCode 229 / isComposing
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: true })
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 })
    expect(onSubmit).toHaveBeenCalledWith('你好')
  })

  it('会话组织弹窗:组合态 Enter/逗号不会把半截标签加进去', () => {
    render(
      <ConversationOrgDialog
        open
        onOpenChange={() => {}}
        conversationTitle="会话"
        meta={{ folder: null, tags: [] }}
        folders={[]}
        onSubmit={() => {}}
      />,
    )

    const input = screen.getByTestId('org-tag-input')
    fireEvent.change(input, { target: { value: '标' } })

    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: true })
    fireEvent.keyDown(input, { key: ',', keyCode: 229, isComposing: true })
    expect(screen.queryAllByTestId('org-tag-chip')).toHaveLength(0)

    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 })
    expect(screen.getAllByTestId('org-tag-chip')).toHaveLength(1)
  })
})
