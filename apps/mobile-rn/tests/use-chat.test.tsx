/**
 * useChat 跨端共享 hook 集成测试
 *
 * 验证 @ihui/shared/hooks/useChat 在 mobile-rn 端消费的真实可用性,
 * 覆盖消息发送、流式 delta、错误处理、stopStreaming、clearMessages、setMessages 等场景。
 *
 * 覆盖场景(16 个):
 * 1.  sendMessage 成功:user + assistant 占位添加,isStreaming true→false,content 完整
 * 2.  sendMessage 空 text:不触发 streamRunner
 * 3.  sendMessage 在 isStreaming 期间:防抖,不触发第二次 streamRunner
 * 4.  streamRunner onDelta 多次调用:assistant 内容累积
 * 5.  streamRunner onDone:isStreaming 从 true→false
 * 6.  streamRunner onError:error 填充,isStreaming=false
 * 7.  clearAssistantOnError=true:onError 时移除 assistant 占位
 * 8.  clearAssistantOnError=false(默认):保留占位 + 填充 ⚠ 错误信息
 * 9.  stopStreaming:abort signal.aborted=true,isStreaming=false
 * 10. clearMessages:messages 清空 + error 清空 + isStreaming=false + abort 调用
 * 11. setMessages:手动设置消息(供历史加载用)
 * 12. setError:手动设置/清空 error
 * 13. systemPrompt 注入:apiMessages 开头有 system 消息
 * 14. meta 透传:user 消息的 meta 字段正确
 * 15. streamRunner 抛异常(非 SSE 错误):onError 被调用
 * 16. formatError 自定义:用自定义函数格式化错误
 *
 * 测试策略:
 * - 用 vi.fn() mock streamRunner,在 mock 内部调 callbacks.onDelta/onError/onDone 模拟 SSE 流
 * - 用受控 Promise(deferred)冻结 streamRunner,验证 isStreaming 中间态
 * - 用 renderHook + act + waitFor 模拟 React 组件生命周期
 * - 不依赖真实网络 / SSE 解析
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useChat } from '@ihui/shared/hooks'
import type { ApiChatMessage, StreamRunnerParams } from '@ihui/shared/hooks'

// 受控 Promise 工厂(用于冻结 streamRunner,验证 streaming 中间态)
function createDeferred<T = void>() {
  let resolve: (val: T) => void = () => {}
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('useChat 跨端共享 hook — 集成测试', () => {
  let streamRunner: ReturnType<typeof vi.fn>

  beforeEach(() => {
    streamRunner = vi.fn()
  })

  // 场景 1:sendMessage 成功
  it('sendMessage 成功:user + assistant 占位添加,isStreaming true→false,content 完整', async () => {
    streamRunner.mockImplementation(async (params: StreamRunnerParams) => {
      params.callbacks.onDelta('Hello')
      params.callbacks.onDelta(' world')
      params.callbacks.onDone()
    })

    const { result } = renderHook(() => useChat({ streamRunner }))

    expect(result.current.isStreaming).toBe(false)
    expect(result.current.messages).toEqual([])

    await act(async () => {
      await result.current.sendMessage({ model: 'gpt-4', text: 'hi' })
    })

    expect(streamRunner).toHaveBeenCalledTimes(1)
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'hi' })
    expect(result.current.messages[0]?.id).toMatch(/^u-/)
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Hello world',
    })
    expect(result.current.messages[1]?.id).toMatch(/^a-/)
  })

  // 场景 2:sendMessage 空 text
  it('sendMessage 空 text:不触发 streamRunner,不加消息', async () => {
    streamRunner.mockImplementation(async () => {})

    const { result } = renderHook(() => useChat({ streamRunner }))

    await act(async () => {
      await result.current.sendMessage({ model: 'gpt-4', text: '   ' })
    })

    expect(streamRunner).not.toHaveBeenCalled()
    expect(result.current.messages).toEqual([])
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.error).toBeNull()
  })

  // 场景 3:sendMessage 在 isStreaming 期间(防抖)
  it('sendMessage 在 isStreaming 期间:不触发第二次 streamRunner(防抖)', async () => {
    const deferred = createDeferred()
    streamRunner.mockImplementation(async (params: StreamRunnerParams) => {
      params.callbacks.onDelta('partial')
      await deferred.promise
      params.callbacks.onDone()
    })

    const { result } = renderHook(() => useChat({ streamRunner }))

    // 启动第一次发送(不 await,保持 streaming)
    let firstSend: Promise<void> = Promise.resolve()
    act(() => {
      firstSend = result.current.sendMessage({ model: 'gpt-4', text: 'first' })
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(true))
    expect(streamRunner).toHaveBeenCalledTimes(1)

    // 第二次发送(应被防抖,isStreaming=true 时早返回)
    await act(async () => {
      await result.current.sendMessage({ model: 'gpt-4', text: 'second' })
    })

    expect(streamRunner).toHaveBeenCalledTimes(1)
    expect(result.current.isStreaming).toBe(true)

    // 完成第一次流
    await act(async () => {
      deferred.resolve()
      await firstSend
    })

    expect(result.current.isStreaming).toBe(false)
    // 只应有第一次发送的 2 条消息(user + assistant),second 被丢弃
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'first' })
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'partial',
    })
  })

  // 场景 4:onDelta 多次调用累积
  it('streamRunner onDelta 多次调用:assistant 内容累积', async () => {
    streamRunner.mockImplementation(async (params: StreamRunnerParams) => {
      params.callbacks.onDelta('Hello')
      params.callbacks.onDelta(',')
      params.callbacks.onDelta(' world')
      params.callbacks.onDelta('!')
      params.callbacks.onDone()
    })

    const { result } = renderHook(() => useChat({ streamRunner }))

    await act(async () => {
      await result.current.sendMessage({ model: 'gpt-4', text: 'hi' })
    })

    expect(result.current.messages[1]?.content).toBe('Hello, world!')
  })

  // 场景 5:onDone 设置 isStreaming=false
  it('streamRunner onDone:isStreaming 从 true→false', async () => {
    const deferred = createDeferred()
    let capturedOnDone: () => void = () => {}
    streamRunner.mockImplementation(async (params: StreamRunnerParams) => {
      capturedOnDone = params.callbacks.onDone
      await deferred.promise
    })

    const { result } = renderHook(() => useChat({ streamRunner }))

    let sendPromise: Promise<void> = Promise.resolve()
    act(() => {
      sendPromise = result.current.sendMessage({ model: 'gpt-4', text: 'hi' })
    })

    // 流期间 isStreaming=true
    await waitFor(() => expect(result.current.isStreaming).toBe(true))

    // 手动触发 onDone,应使 isStreaming=false
    act(() => {
      capturedOnDone()
    })
    expect(result.current.isStreaming).toBe(false)

    // 释放 streamRunner 让 sendMessage 完成
    await act(async () => {
      deferred.resolve()
      await sendPromise
    })

    expect(result.current.isStreaming).toBe(false)
  })

  // 场景 6:onError 填充 error,isStreaming=false
  it('streamRunner onError:error 填充,isStreaming=false', async () => {
    streamRunner.mockImplementation(async (params: StreamRunnerParams) => {
      params.callbacks.onError(new Error('stream failed'))
    })

    const { result } = renderHook(() => useChat({ streamRunner }))

    await act(async () => {
      await result.current.sendMessage({ model: 'gpt-4', text: 'hi' })
    })

    expect(result.current.error).toBe('Error: stream failed')
    expect(result.current.isStreaming).toBe(false)
  })

  // 场景 7:clearAssistantOnError=true 移除占位
  it('clearAssistantOnError=true:onError 时移除 assistant 占位', async () => {
    streamRunner.mockImplementation(async (params: StreamRunnerParams) => {
      params.callbacks.onError(new Error('boom'))
    })

    const { result } = renderHook(() =>
      useChat({ streamRunner, clearAssistantOnError: true }),
    )

    await act(async () => {
      await result.current.sendMessage({ model: 'gpt-4', text: 'hi' })
    })

    expect(result.current.error).toBe('Error: boom')
    expect(result.current.isStreaming).toBe(false)
    // 仅剩 user 消息,assistant 占位被移除
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'hi' })
  })

  // 场景 8:clearAssistantOnError=false(默认)保留占位 + 填充错误
  it('clearAssistantOnError=false(默认):保留占位 + 填充 ⚠ 错误信息', async () => {
    streamRunner.mockImplementation(async (params: StreamRunnerParams) => {
      params.callbacks.onError(new Error('boom'))
    })

    const { result } = renderHook(() => useChat({ streamRunner }))

    await act(async () => {
      await result.current.sendMessage({ model: 'gpt-4', text: 'hi' })
    })

    expect(result.current.error).toBe('Error: boom')
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: '⚠ Error: boom',
    })
  })

  // 场景 9:stopStreaming abort + isStreaming=false
  it('stopStreaming:abort signal.aborted=true,isStreaming=false', async () => {
    const deferred = createDeferred()
    // 用 holder 对象避免 let + = null 初始化导致的类型窄化(vitest not.toBeNull 会窄化为 never)
    const captured: { signal: AbortSignal | null } = { signal: null }
    streamRunner.mockImplementation(async (params: StreamRunnerParams) => {
      captured.signal = params.signal
      await deferred.promise
    })

    const { result } = renderHook(() => useChat({ streamRunner }))

    let sendPromise: Promise<void> = Promise.resolve()
    act(() => {
      sendPromise = result.current.sendMessage({ model: 'gpt-4', text: 'hi' })
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(true))
    expect(captured.signal).not.toBeNull()
    expect(captured.signal?.aborted).toBe(false)

    act(() => {
      result.current.stopStreaming()
    })

    expect(result.current.isStreaming).toBe(false)
    expect(captured.signal?.aborted).toBe(true)

    // 释放 streamRunner 让 sendMessage 完成,避免悬空 Promise
    await act(async () => {
      deferred.resolve()
      await sendPromise
    })
  })

  // 场景 10:clearMessages 清空 + abort
  it('clearMessages:messages 清空 + error 清空 + isStreaming=false + abort 调用', async () => {
    const deferred = createDeferred()
    // 用 holder 对象避免 let + = null 初始化导致的类型窄化
    const captured: { signal: AbortSignal | null } = { signal: null }
    streamRunner.mockImplementation(async (params: StreamRunnerParams) => {
      captured.signal = params.signal
      await deferred.promise
    })

    const { result } = renderHook(() => useChat({ streamRunner }))

    // 启动流(添加 user + assistant 消息,isStreaming=true)
    let sendPromise: Promise<void> = Promise.resolve()
    act(() => {
      sendPromise = result.current.sendMessage({ model: 'gpt-4', text: 'hi' })
    })

    await waitFor(() => expect(result.current.isStreaming).toBe(true))
    expect(captured.signal).not.toBeNull()
    expect(captured.signal?.aborted).toBe(false)
    expect(result.current.messages).toHaveLength(2)

    // 预设 error(模拟之前的错误残留),验证 clearMessages 能清空
    act(() => result.current.setError('prior error'))
    expect(result.current.error).toBe('prior error')

    act(() => {
      result.current.clearMessages()
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.error).toBeNull()
    expect(result.current.isStreaming).toBe(false)
    expect(captured.signal?.aborted).toBe(true)

    await act(async () => {
      deferred.resolve()
      await sendPromise
    })
  })

  // 场景 11:setMessages 手动设置
  it('setMessages:手动设置消息(供历史加载用)', async () => {
    streamRunner.mockImplementation(async () => {})

    const { result } = renderHook(() => useChat({ streamRunner }))

    expect(result.current.messages).toEqual([])

    const history = [
      { id: 'h-1', role: 'user' as const, content: 'past question' },
      { id: 'h-2', role: 'assistant' as const, content: 'past answer' },
    ]

    act(() => {
      result.current.setMessages(history)
    })

    expect(result.current.messages).toEqual(history)
    expect(result.current.messages).toHaveLength(2)

    // 验证函数式更新也生效
    act(() => {
      result.current.setMessages((prev) => [
        ...prev,
        { id: 'h-3', role: 'user' as const, content: 'follow-up' },
      ])
    })

    expect(result.current.messages).toHaveLength(3)
    expect(result.current.messages[2]?.content).toBe('follow-up')
  })

  // 场景 12:setError 手动设置
  it('setError:手动设置/清空 error', async () => {
    streamRunner.mockImplementation(async () => {})

    const { result } = renderHook(() => useChat({ streamRunner }))

    expect(result.current.error).toBeNull()

    act(() => {
      result.current.setError('manual error')
    })
    expect(result.current.error).toBe('manual error')

    act(() => {
      result.current.setError(null)
    })
    expect(result.current.error).toBeNull()
  })

  // 场景 13:systemPrompt 注入
  it('systemPrompt 注入:apiMessages 开头有 system 消息', async () => {
    let capturedApiMessages: ApiChatMessage[] = []
    streamRunner.mockImplementation(async (params: StreamRunnerParams) => {
      capturedApiMessages = params.apiMessages
      params.callbacks.onDone()
    })

    const { result } = renderHook(() => useChat({ streamRunner }))

    await act(async () => {
      await result.current.sendMessage({
        model: 'gpt-4',
        text: 'hi',
        systemPrompt: 'You are helpful',
      })
    })

    // 第一条应为 system 消息,第二条为 user 消息
    expect(capturedApiMessages[0]).toEqual({ role: 'system', content: 'You are helpful' })
    expect(capturedApiMessages[1]).toEqual({ role: 'user', content: 'hi' })
  })

  // 场景 14:meta 透传
  it('meta 透传:user 消息的 meta 字段正确', async () => {
    streamRunner.mockImplementation(async (params: StreamRunnerParams) => {
      params.callbacks.onDone()
    })

    const { result } = renderHook(() => useChat({ streamRunner }))

    await act(async () => {
      await result.current.sendMessage({
        model: 'gpt-4',
        text: 'hi',
        meta: { agentId: 'a-1', tokens: 100 },
      })
    })

    expect(result.current.messages[0]?.meta).toEqual({ agentId: 'a-1', tokens: 100 })
  })

  // 场景 15:streamRunner 抛异常
  it('streamRunner 抛异常(非 SSE 错误):onError 被调用', async () => {
    streamRunner.mockImplementation(async () => {
      throw new Error('network down')
    })

    const { result } = renderHook(() => useChat({ streamRunner }))

    await act(async () => {
      await result.current.sendMessage({ model: 'gpt-4', text: 'hi' })
    })

    expect(result.current.error).toBe('Error: network down')
    expect(result.current.isStreaming).toBe(false)
  })

  // 场景 16:formatError 自定义
  it('formatError 自定义:用自定义函数格式化错误', async () => {
    const formatError = vi.fn((err: unknown) => {
      const e = err as { code?: number; message?: string }
      return `[ERR ${e.code}] ${e.message}`
    })
    streamRunner.mockImplementation(async (params: StreamRunnerParams) => {
      params.callbacks.onError({ code: 500, message: 'server error' })
    })

    const { result } = renderHook(() => useChat({ streamRunner, formatError }))

    await act(async () => {
      await result.current.sendMessage({ model: 'gpt-4', text: 'hi' })
    })

    expect(formatError).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBe('[ERR 500] server error')
    expect(result.current.isStreaming).toBe(false)
  })
})
