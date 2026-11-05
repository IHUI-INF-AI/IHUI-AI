// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../chat'

/**
 * task #7 断流兜底:revokePendingToolCalls 收敛逻辑。
 *
 * 流中途崩溃(网络断流 / 服务端 5xx / 前端路由卸载)时,send-message.ts 与
 * send-answer.ts 的 finally 都会调用 revokePendingToolCalls(messageId),把仍处于
 * running 的工具卡置 cancelled,并把"已发到 wire 的 partialArgs 帧"收敛为正式 args
 * (而非留空 {}),同时清掉 partialArgs / argsStreaming 预览态 —— 避免卡片卡在
 * running 预览且让 cancelled 卡仍展示"构建到一半的入参"。
 */
describe('revokePendingToolCalls 断流兜底收敛', () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      currentModel: 'gpt-4o-mini',
      isStreaming: false,
      error: null,
      conversationId: null,
    })
  })

  it('把 running 卡的 partialArgs 收敛为正式 args 并清掉流式预览态', () => {
    const msgId = useChatStore.getState().addMessage({
      role: 'assistant',
      content: '',
      model: 'gpt-4o-mini',
    })
    useChatStore.getState().addToolCall(msgId, {
      id: 'c1',
      toolName: 'web_search',
      // args 缺省约定填 {};revoke 时走 tc.partialArgs ?? tc.args,partialArgs 优先收敛为正式 args
      args: {},
      status: 'running',
      partialArgs: { query: 'abc', limit: 5 },
      argsStreaming: true,
    })

    useChatStore.getState().revokePendingToolCalls(msgId)

    const msg = useChatStore.getState().messages.find((m) => m.id === msgId)
    const tc = msg?.toolCalls?.[0]
    expect(tc).toBeDefined()
    expect(tc!.status).toBe('cancelled')
    // partialArgs 已收敛为正式 args
    expect(tc!.args).toEqual({ query: 'abc', limit: 5 })
    // 预览态必须清掉:否则 ToolCallCard 仍渲染 partial 块
    expect(tc!.partialArgs).toBeUndefined()
    expect(tc!.argsStreaming).toBeUndefined()
  })

  it('partialArgs 缺失时回退到已有正式 args', () => {
    const msgId = useChatStore.getState().addMessage({
      role: 'assistant',
      content: '',
      model: 'gpt-4o-mini',
    })
    useChatStore.getState().addToolCall(msgId, {
      id: 'c2',
      toolName: 'read_file',
      status: 'running',
      args: { path: '/etc/hosts' },
      argsStreaming: true,
    })

    useChatStore.getState().revokePendingToolCalls(msgId)

    const tc = useChatStore.getState().messages.find((m) => m.id === msgId)?.toolCalls?.[0]
    expect(tc!.status).toBe('cancelled')
    expect(tc!.args).toEqual({ path: '/etc/hosts' })
    expect(tc!.partialArgs).toBeUndefined()
  })

  it('无 running 卡时不改变任何已终态工具卡', () => {
    const msgId = useChatStore.getState().addMessage({
      role: 'assistant',
      content: '',
      model: 'gpt-4o-mini',
    })
    useChatStore.getState().addToolCall(msgId, {
      id: 'c3',
      toolName: 'web_search',
      status: 'success',
      args: { query: 'done' },
    })

    useChatStore.getState().revokePendingToolCalls(msgId)

    const tc = useChatStore.getState().messages.find((m) => m.id === msgId)?.toolCalls?.[0]
    expect(tc!.status).toBe('success')
    expect(tc!.args).toEqual({ query: 'done' })
  })

  it('消息不存在时是 no-op 且不抛异常', () => {
    expect(() => useChatStore.getState().revokePendingToolCalls('nope')).not.toThrow()
    expect(useChatStore.getState().messages).toHaveLength(0)
  })
})
