// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D45 ambient suggestions 环境建议条测试(2026-09-24 立)。
// 形态参照 components/ai/__tests__/injection-bar.test.tsx(vi.mock next-intl + 真实 zh-CN 词包)。
// 覆盖:① 纯函数派生(2-4 条、判据、去重);② 三态(采纳填输入框/忽略单条/整体可关且持久化);
//      ③ 不侵入正文:常规文档流、无 absolute/fixed/渐变遮罩、无原生 title。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', async () => {
  // 工厂内自取依赖:vi.mock 会被提到 import 之前执行,引用模块作用域绑定会踩 TDZ
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu: renderIcu } = await import('@ihui/i18n')
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
        const node = resolve(ns)
        const raw = node?.[key]
        if (typeof raw !== 'string' || raw === '') return key
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
  }
})

import { AmbientSuggestions, deriveAmbientSuggestions } from '../ambient-suggestions'
import { useConversationDetailModeStore } from '@/stores/conversation-detail-mode'

// 隔离 @/stores/chat(真实 store 会级联拉入 @ihui/shared 全量类型链,
// 会被其他 in-flight 改动干扰):组件只消费 setState({draftInput}) 契约,用桩承接
const chatState = vi.hoisted(() => ({ draftInput: null as string | null }))
vi.mock('@/stores/chat', () => ({
  useChatStore: {
    setState: (patch: Partial<{ draftInput: string | null }>) => {
      Object.assign(chatState, patch)
    },
    getState: () => chatState,
  },
}))
import { useChatStore } from '@/stores/chat'
import type { ChatMessage, ToolCall } from '@/stores/chat'

const here = dirname(fileURLToPath(import.meta.url))
const zhCN = JSON.parse(
  readFileSync(join(here, '../../../../../../packages/i18n/messages/web/zh-CN.json'), 'utf8'),
) as { ambientSuggestions: Record<string, string> }

function toolCall(toolName: string, id: string): ToolCall {
  return { id, toolName, args: {}, status: 'success' }
}

function msg(partial: Partial<ChatMessage> & { id: string; role: ChatMessage['role'] }): ChatMessage {
  return { content: '', createdAt: 1, ...partial }
}

afterEach(() => {
  cleanup()
  useConversationDetailModeStore.setState({ mode: 'steps', suggestionsEnabled: true })
  useChatStore.setState({ draftInput: null })
  window.localStorage.clear()
})

describe('D45 deriveAmbientSuggestions 纯函数派生', () => {
  it('空会话/仅用户消息 → 零建议', () => {
    expect(deriveAmbientSuggestions([])).toEqual([])
    expect(deriveAmbientSuggestions([msg({ id: 'u1', role: 'user', content: 'hi' })])).toEqual([])
  })

  it('有未完成 plan step → resume-task;有文件写入 → review-files', () => {
    const out = deriveAmbientSuggestions([
      msg({
        id: 'a1',
        role: 'assistant',
        content: '进展汇报',
        planSteps: [
          { id: 's1', step: 'a', status: 'completed' },
          { id: 's2', step: 'b', status: 'pending' },
        ],
        toolCalls: [toolCall('write_file', 't1')],
      }),
    ])
    expect(out.map((s) => s.id)).toEqual(['resume-task', 'review-files', 'continue-topic'])
  })

  it('挂起提问 → answer-question 且不再叠加 continue-topic(互斥)', () => {
    const out = deriveAmbientSuggestions([
      msg({
        id: 'a1',
        role: 'assistant',
        content: '请选择',
        question: { questionId: 'q', prompt: '请选择', options: [], allowCustom: true, allowMultiple: false },
      }),
    ])
    expect(out.map((s) => s.id)).toEqual(['answer-question'])
  })

  it('建议数恒 ≤ 4', () => {
    const out = deriveAmbientSuggestions([
      msg({
        id: 'a1',
        role: 'assistant',
        content: 'x'.repeat(10),
        planSteps: [{ id: 's1', step: 'a', status: 'in_progress' }],
        toolCalls: [toolCall('edit_file', 't1'), toolCall('delete_file', 't2')],
      }),
    ])
    expect(out.length).toBeLessThanOrEqual(4)
  })
})

describe('D45 建议条三态交互', () => {
  const messages: ChatMessage[] = [
    msg({
      id: 'a1',
      role: 'assistant',
      content: '已完成修改。',
      toolCalls: [toolCall('write_file', 't1')],
    }),
  ]

  it('渲染建议条(有建议才出现),文案来自 zh-CN 词包', () => {
    const { container } = render(<AmbientSuggestions messages={messages} />)
    const bar = container.querySelector('[data-testid="ambient-suggestions"]')
    expect(bar).not.toBeNull()
    expect(bar?.textContent).toContain(zhCN.ambientSuggestions.suggestionReviewFiles)
  })

  it('采纳:建议文本填入输入框 draftInput,且该条不再出现', () => {
    const { container } = render(<AmbientSuggestions messages={messages} />)
    fireEvent.click(
      container.querySelector('[data-testid="ambient-suggestion-adopt-review-files"]') as HTMLElement,
    )
    expect(useChatStore.getState().draftInput).toBe(
      zhCN.ambientSuggestions.suggestionReviewFiles,
    )
    expect(
      container.querySelector('[data-testid="ambient-suggestion-review-files"]'),
    ).toBeNull()
  })

  it('忽略:仅该条消失,建议条仍在', () => {
    const { container } = render(<AmbientSuggestions messages={messages} />)
    fireEvent.click(
      container.querySelector('[data-testid="ambient-suggestion-dismiss-review-files"]') as HTMLElement,
    )
    expect(
      container.querySelector('[data-testid="ambient-suggestion-review-files"]'),
    ).toBeNull()
    expect(container.querySelector('[data-testid="ambient-suggestions"]')).not.toBeNull()
  })

  it('可关:整体关闭 + 持久化;restore 恢复', () => {
    const { container } = render(<AmbientSuggestions messages={messages} />)
    fireEvent.click(container.querySelector('[data-testid="ambient-suggestions-close"]') as HTMLElement)
    expect(container.querySelector('[data-testid="ambient-suggestions"]')).toBeNull()
    expect(useConversationDetailModeStore.getState().suggestionsEnabled).toBe(false)
    const parsed = JSON.parse(
      window.localStorage.getItem('ihui-conversation-detail-mode') as string,
    ) as { state: { suggestionsEnabled: boolean } }
    expect(parsed.state.suggestionsEnabled).toBe(false)
    // 关闭后仍有 ghost 恢复入口,点击恢复
    fireEvent.click(container.querySelector('[data-testid="ambient-suggestions-restore"]') as HTMLElement)
    expect(useConversationDetailModeStore.getState().suggestionsEnabled).toBe(true)
    expect(container.querySelector('[data-testid="ambient-suggestions"]')).not.toBeNull()
  })

  it('无建议(空会话)不渲染任何建议条 DOM', () => {
    const { container } = render(<AmbientSuggestions messages={[]} />)
    expect(container.querySelector('[data-testid="ambient-suggestions"]')).toBeNull()
  })
})

describe('D45 建议条不侵入正文', () => {
  const messages: ChatMessage[] = [
    msg({ id: 'a1', role: 'assistant', content: '正文', toolCalls: [toolCall('write_file', 't1')] }),
  ]

  it('常规文档流容器:无 absolute/fixed 悬浮、无渐变遮罩、无原生 title', () => {
    const { container } = render(<AmbientSuggestions messages={messages} />)
    const bar = container.querySelector('[data-testid="ambient-suggestions"]') as HTMLElement
    expect(bar).not.toBeNull()
    expect(bar.className).not.toMatch(/absolute|fixed|bg-gradient|backdrop-blur/)
    // 组件树内不允许任何原生 title 提示(规范禁用,无障碍用 aria-label 替代)
    expect(container.querySelector('[title]')).toBeNull()
    // 常规文档流:position 非悬浮
    const position = bar.style.position || window.getComputedStyle(bar).position
    expect(['static', 'relative', '']).toContain(position)
  })
})
