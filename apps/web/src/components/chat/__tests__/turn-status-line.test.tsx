// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-09-28 V3 #71 装载 —— TurnStatusBadge 的挂载与投影用例。
//
// 两条各自守一件事:
//   ① `deriveTurnState` 的优先级与"空闲不画徽章"(把"没在流里留痕"写成"已完成"是假事实);
//   ② **渲染级**:真的挂到 MessageList 用的那条链上时,徽章必须出现在 DOM 里
//      —— 本票立项原因就是"组件在、词包在、零渲染点",所以只测纯函数等于没测这一票。

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deriveTurnState, TurnStatusLine, type TurnFacts } from '../message-list/turn-status-line'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const approvalState = { pending: false }
vi.mock('@/components/ai/tool-approval-dialog', () => ({
  useToolApprovalPending: () => approvalState.pending,
}))

/** store 的假状态:每个选择器都是 (s)=>基元,所以按函数应用即可,不需要真 zustand。 */
const storeState = {
  isStreaming: false,
  conversationId: 'c1',
  messages: [] as Array<{ role: string; error?: string; toolCalls?: Array<{ status: string }> }>,
  sideQueueByConversation: {} as Record<string, unknown[]>,
}
vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}))

const idle: TurnFacts = {
  streaming: false,
  runningTool: false,
  awaitingApproval: false,
  queuedSideQuestions: 0,
  lastAssistantErrored: false,
}

beforeEach(() => {
  approvalState.pending = false
  storeState.isStreaming = false
  storeState.messages = []
  storeState.sideQueueByConversation = {}
})

describe('V3 #71 / deriveTurnState 投影优先级', () => {
  it('空闲 ⇒ null(不得画"已完成")', () => {
    expect(deriveTurnState(idle)).toBeNull()
  })

  it('等待审批优先于"正在流式" —— 审批弹窗开着时不能说成"思考中"', () => {
    expect(
      deriveTurnState({ ...idle, streaming: true, runningTool: true, awaitingApproval: true }),
    ).toBe('waitingConfirm')
  })

  it('工具在跑 > 纯生成 > 排队 > 上一轮失败', () => {
    expect(deriveTurnState({ ...idle, streaming: true, runningTool: true })).toBe('usingTool')
    expect(deriveTurnState({ ...idle, streaming: true })).toBe('thinking')
    expect(deriveTurnState({ ...idle, queuedSideQuestions: 2 })).toBe('queued')
    expect(deriveTurnState({ ...idle, lastAssistantErrored: true })).toBe('failed')
  })

  it('工具 running 但流已断 ⇒ 不判 usingTool(缺"本轮仍在跑"这一半事实)', () => {
    expect(deriveTurnState({ ...idle, runningTool: true })).toBeNull()
  })
})

describe('V3 #71 / TurnStatusLine 渲染级装载', () => {
  it('store 显示正在流式 ⇒ 徽章真的出现在 DOM 里,且带投影出的那一格', () => {
    storeState.isStreaming = true
    const { container } = render(<TurnStatusLine />)
    const badge = container.querySelector('[data-turn-state]')
    expect(badge).not.toBeNull()
    expect(badge?.getAttribute('data-turn-state')).toBe('thinking')
    expect(container.querySelector('[data-testid="turn-status-line"]')).not.toBeNull()
  })

  it('最后一条 assistant 有 running 工具 ⇒ usingTool', () => {
    storeState.isStreaming = true
    storeState.messages = [{ role: 'assistant', toolCalls: [{ status: 'running' }] }]
    const { container } = render(<TurnStatusLine />)
    expect(container.querySelector('[data-turn-state]')?.getAttribute('data-turn-state')).toBe(
      'usingTool',
    )
  })

  it('审批在等 ⇒ waitingConfirm(这一格正是 D71 立项时"无处可见"的那一格)', () => {
    approvalState.pending = true
    const { container } = render(<TurnStatusLine />)
    expect(container.querySelector('[data-turn-state]')?.getAttribute('data-turn-state')).toBe(
      'waitingConfirm',
    )
  })

  it('空闲 ⇒ 整段不渲染(不占位、不画状态)', () => {
    const { container } = render(<TurnStatusLine />)
    expect(container.querySelector('[data-testid="turn-status-line"]')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
