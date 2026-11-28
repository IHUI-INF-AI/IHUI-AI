// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  applyChatSyncEvent,
  CHAT_SYNC_PROTOCOL_VERSION,
  EMPTY_CHAT_SYNC_STATE,
  type ChatMessageCreatedEvent,
  type ChatMessagePatchedEvent,
  type ToolCall,
  type PlanStep,
  type TerminalTask,
} from '../src/index.js'

const ROOM = { kind: 'conversation' as const, conversationId: 'conv-exec' }

const TOOL: ToolCall = {
  id: 'call-1',
  toolName: 'read_file',
  args: { path: 'a.ts' },
  status: 'running',
}
const PLAN: PlanStep = { id: 'p1', step: '读取文件', status: 'in_progress' }
const TERMINAL: TerminalTask = { id: 't1', command: 'ls', status: 'running' }

function created(): ChatMessageCreatedEvent {
  return {
    type: 'message:created',
    protocolVersion: CHAT_SYNC_PROTOCOL_VERSION,
    channel: 'ws',
    room: ROOM,
    messageId: 'm1',
    role: 'assistant',
    content: '',
    toolCalls: [TOOL],
    planSteps: [PLAN],
    terminalTasks: [TERMINAL],
  }
}

function snapshot(
  rev: number,
  overrides: Partial<ChatMessagePatchedEvent> = {},
): ChatMessagePatchedEvent {
  return {
    type: 'message:patched',
    protocolVersion: CHAT_SYNC_PROTOCOL_VERSION,
    channel: 'ws',
    room: ROOM,
    messageId: 'm1',
    rev,
    kind: 'snapshot',
    content: '正文',
    ...overrides,
  }
}

describe('chat-sync 执行面(工具卡/计划/终端)', () => {
  it('created 带上执行面三数组,内核面完整保留', () => {
    const { state } = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, created())
    const surface = state.messages.get('m1')
    expect(surface?.toolCalls).toEqual([TOOL])
    expect(surface?.planSteps).toEqual([PLAN])
    expect(surface?.terminalTasks).toEqual([TERMINAL])
  })

  it('snapshot 带执行面 = 全量替换;后续快照缺省 = 保持原值', () => {
    const first = applyChatSyncEvent(EMPTY_CHAT_SYNC_STATE, created())
    const running: ToolCall = { ...TOOL, status: 'success', result: 'ok' }
    const patched = applyChatSyncEvent(
      first.state,
      snapshot(1, { toolCalls: [running], planSteps: [{ ...PLAN, status: 'completed' }] }),
    )
    expect(patched.state.messages.get('m1')?.toolCalls).toEqual([running])
    expect(patched.state.messages.get('m1')?.planSteps?.[0]?.status).toBe('completed')

    const noExecution = applyChatSyncEvent(patched.state, snapshot(2, { content: '续写' }))
    expect(noExecution.state.messages.get('m1')?.toolCalls).toEqual([running])
    expect(noExecution.state.messages.get('m1')?.content).toBe('续写')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
