// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 差距⑥(2026-10-30 立):终态确认后过程文本折叠 —— 折叠策略追加类目的判据与装车锁。
// 判据纪律:
//  - 每条判据成对(终态折 ↔ 进行中不折;过程段折 ↔ 最终答复段不折;档位压类目 ↔ 类目不越档);
//  - D21 既有类目的行为由 `src/lib/__tests__/fold-policy.test.ts` 与
//    `message-item-step-dims-wiring.test.tsx` / `message-item-fold-summary.test.tsx` 守着,
//    本件不重抄阈值判据,只锁"新类目不改它们"这一条(见末段负例)。
//  - 词包走 i18n 键名(mock 回显键名),不在此复制任何中文文案。
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, unknown>): string =>
      typeof values?.n === 'number' ? `[${key}:${values.n}]` : `[${key}]`,
  useLocale: () => 'zh-CN',
}))

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import {
  FOLD_POLICY_EVENT,
  FOLD_POLICY_KEY,
  resolveProcessTextInitialOpen,
} from '@/components/chat/message-list/fold-policy'
import {
  blockIsProcessNarration,
  buildPresentationGroups,
} from '@/components/chat/message-list/presentation-units'
import { buildPresentationRows } from '@/components/chat/message-list/turn-presentation'
import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage } from '@/stores/chat'

// ─── 纯函数:追加类目判定 ──────────────────────────────────────────────────

describe('resolveProcessTextInitialOpen(差距⑥追加类目)', () => {
  it('终态确认 + 过程段(auto)⇒ 折叠', () => {
    expect(
      resolveProcessTextInitialOpen('auto', { isProcessText: true, finalTextConfirmed: true }),
    ).toBe(false)
  })

  it('进行中(未确认)⇒ 不折叠 —— 活动块纪律保持', () => {
    expect(
      resolveProcessTextInitialOpen('auto', { isProcessText: true, finalTextConfirmed: false }),
    ).toBe(true)
  })

  it('成对反例:最终答复段不在类目射程,终态确认也不折', () => {
    expect(
      resolveProcessTextInitialOpen('auto', { isProcessText: false, finalTextConfirmed: true }),
    ).toBe(true)
  })

  it('用户档位压类目(D21 规则②):expanded 下过程段终态仍展开', () => {
    expect(
      resolveProcessTextInitialOpen('expanded', {
        isProcessText: true,
        finalTextConfirmed: true,
      }),
    ).toBe(true)
  })

  it('用户档位压类目(D21 规则②):collapsed 下过程段进行中即折叠', () => {
    expect(
      resolveProcessTextInitialOpen('collapsed', {
        isProcessText: true,
        finalTextConfirmed: false,
      }),
    ).toBe(false)
  })

  it('collapsed 档也不折最终答复段 —— 射程门在档位之前(与 D21 从不折正文同口径)', () => {
    expect(
      resolveProcessTextInitialOpen('collapsed', {
        isProcessText: false,
        finalTextConfirmed: false,
      }),
    ).toBe(true)
  })
})

// ─── 纯函数:过程文本标识(投影既有形状)──────────────────────────────────

function msg(
  id: string,
  role: 'user' | 'assistant',
  content: string,
  toolCalls?: unknown[],
): ChatMessage {
  return {
    id,
    role,
    content,
    createdAt: 1,
    ...(toolCalls ? { toolCalls } : {}),
  } as ChatMessage
}

describe('blockIsProcessNarration(过程段标识)', () => {
  it('容器内非末条 ⇒ true;容器末条 ⇒ false;游离消息 ⇒ false', () => {
    const messages = [
      msg('u1', 'user', '提问'),
      msg('a1', 'assistant', '先读文件再分析', [
        { id: 'tc1', toolName: 'read_file', status: 'success', args: {} },
      ]),
      msg('a2', 'assistant', '最终答复'),
    ]
    const groups = buildPresentationGroups(buildPresentationRows(messages), messages)
    const containerGroup = groups.find((g) => g.container !== null)
    expect(containerGroup).toBeDefined()
    const blocks = containerGroup!.blocks
    expect(blocks).toHaveLength(2)
    expect(blockIsProcessNarration(blocks[0]!)).toBe(true)
    expect(blockIsProcessNarration(blocks[1]!)).toBe(false)
    const stray = groups.find((g) => g.container === null && g.blocks[0]!.message.role === 'user')
    expect(stray).toBeDefined()
    expect(blockIsProcessNarration(stray!.blocks[0]!)).toBe(false)
  })

  it('单条容器(段内一条且带过程)不产过程段 —— 唯一那条就是末条', () => {
    const messages = [
      msg('u1', 'user', '提问'),
      msg('a1', 'assistant', '答复', [
        { id: 'tc1', toolName: 'read_file', status: 'success', args: {} },
      ]),
    ]
    const groups = buildPresentationGroups(buildPresentationRows(messages), messages)
    const containerGroup = groups.find((g) => g.container !== null)
    expect(containerGroup).toBeDefined()
    expect(blockIsProcessNarration(containerGroup!.blocks[0]!)).toBe(false)
  })
})

// ─── 装车:MessageItem 消费位 ──────────────────────────────────────────────

const MESSAGE_ID = 'm-process-fold'
const GROUP_ID = `message-process-text-group-${MESSAGE_ID}`
const CONTENT_TEXT = '这是过程叙述正文'

function renderProcessMessage(
  overrides: { isProcessText?: boolean; turnFinalTextConfirmed?: boolean } = {},
) {
  const message: ChatMessage = {
    id: MESSAGE_ID,
    role: 'assistant',
    content: CONTENT_TEXT,
    createdAt: 1,
  }
  return render(
    <TooltipProvider>
      <MessageItem
        message={message}
        isLast={false}
        isStreaming={false}
        assistantLabel="AI"
        isProcessText={overrides.isProcessText ?? false}
        turnFinalTextConfirmed={overrides.turnFinalTextConfirmed ?? false}
      />
    </TooltipProvider>,
  )
}

function groupTrigger(): HTMLElement | null {
  const group = document.querySelector(`[data-testid="${GROUP_ID}"]`)
  if (!group) return null
  return group.querySelector('[data-stream-group-trigger="true"]')
}

beforeEach(() => {
  // auto 档(缺省)—— 类目按"终态位"决定默认开合,不借用户档位干预
  window.localStorage.removeItem(FOLD_POLICY_KEY)
})

afterEach(() => {
  cleanup()
  window.localStorage.removeItem(FOLD_POLICY_KEY)
  useChatStore.setState({ messages: [] })
})

describe('过程文本折叠装车(差距⑥)', () => {
  it('终态确认:过程段折进 StreamGroup,正文不在 DOM(收起态),组头走 i18n 键', () => {
    renderProcessMessage({ isProcessText: true, turnFinalTextConfirmed: true })
    const trigger = groupTrigger()
    expect(trigger).not.toBeNull()
    expect(trigger!.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.textContent).not.toContain(CONTENT_TEXT)
    expect(trigger!.textContent).toContain('[processNarrationGroup]')
  })

  it('进行中(未确认):过程段展开,正文在 DOM —— 活动块纪律', () => {
    renderProcessMessage({ isProcessText: true, turnFinalTextConfirmed: false })
    const trigger = groupTrigger()
    expect(trigger).not.toBeNull()
    expect(trigger!.getAttribute('aria-expanded')).toBe('true')
    expect(document.body.textContent).toContain(CONTENT_TEXT)
  })

  it('终态翻转(流收口瞬间):无手动操作 ⇒ 自动折叠', () => {
    const { rerender } = renderProcessMessage({
      isProcessText: true,
      turnFinalTextConfirmed: false,
    })
    expect(groupTrigger()!.getAttribute('aria-expanded')).toBe('true')
    rerender(
      <TooltipProvider>
        <MessageItem
          message={{ id: MESSAGE_ID, role: 'assistant', content: CONTENT_TEXT, createdAt: 1 }}
          isLast={false}
          isStreaming={false}
          assistantLabel="AI"
          isProcessText
          turnFinalTextConfirmed
        />
      </TooltipProvider>,
    )
    expect(groupTrigger()!.getAttribute('aria-expanded')).toBe('false')
  })

  it('手动展开态在回合生命周期内保持:策略广播(换档)不覆盖用户选择', () => {
    renderProcessMessage({ isProcessText: true, turnFinalTextConfirmed: true })
    fireEvent.click(groupTrigger()!)
    expect(groupTrigger()!.getAttribute('aria-expanded')).toBe('true')
    // 用户换档并广播(FoldPolicyButton 同款链路)⇒ 过程段 override 保持展开
    window.localStorage.setItem(FOLD_POLICY_KEY, 'collapsed')
    window.dispatchEvent(new Event(FOLD_POLICY_EVENT))
    expect(groupTrigger()!.getAttribute('aria-expanded')).toBe('true')
    // 再点收起 ⇒ override 同样生效(两态都是用户显式操作)
    fireEvent.click(groupTrigger()!)
    expect(groupTrigger()!.getAttribute('aria-expanded')).toBe('false')
  })

  it('负例(零回归面):非过程段不套折叠壳,正文直出', () => {
    renderProcessMessage({ isProcessText: false, turnFinalTextConfirmed: true })
    expect(document.querySelector(`[data-testid="${GROUP_ID}"]`)).toBeNull()
    expect(document.body.textContent).toContain(CONTENT_TEXT)
  })

  it('负例:过程段但正文为空 ⇒ 不套空壳', () => {
    const message: ChatMessage = { id: MESSAGE_ID, role: 'assistant', content: '', createdAt: 1 }
    render(
      <TooltipProvider>
        <MessageItem
          message={message}
          isLast={false}
          isStreaming={false}
          assistantLabel="AI"
          isProcessText
          turnFinalTextConfirmed
        />
      </TooltipProvider>,
    )
    expect(document.querySelector(`[data-testid="${GROUP_ID}"]`)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
