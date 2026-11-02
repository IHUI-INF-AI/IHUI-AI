// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4 RN 宿主增量渲染测试(只判宿主层):
 *  - delta 追加到流式气泡,`done` 后用最终落库结果替换本地消息;
 *  - 失败显式进入 sendError(撤回乐观消息 / 恢复输入),不许静默;
 *  - abort(卸载)后迟到回调不再产生任何渲染(宿主不得再 setState)。
 *
 * 共享屏渲染本体由 packages/app 负责;本套件按 tests/__mocks__/ihui-rn-app.ts 的
 * AgentChatScreen 替身捕获 props 来判宿主接线。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { agentChatPropsCaptured } from './__mocks__/ihui-rn-app'

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: {
    fetchAgentChatMessages: vi.fn(),
    streamAgentChat: vi.fn(),
    goBack: vi.fn(),
  },
}))

interface StreamCall {
  params: { agentId: string; content: string }
  callbacks: {
    onDelta?: (delta: string, accumulated: string) => void
    onDone?: (done: unknown) => void
  }
  abort: ReturnType<typeof vi.fn>
  resolve: (outcome: unknown) => void
  reject: (err: unknown) => void
}

let streams: StreamCall[] = []

vi.mock('@ihui/api-client', () => ({
  fetchAgentChatMessages: apiMocks.fetchAgentChatMessages,
  streamAgentChat: apiMocks.streamAgentChat,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: apiMocks.goBack }),
  useRoute: () => ({ params: { agentId: 'agent_1', name: 'AI客服' } }),
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

const t = (key: string) => key
vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t }),
}))

vi.mock('../src/components/VoiceInput', () => ({
  VoiceInput: () => null,
}))

import { AgentChatScreen } from '../src/screens/AgentChatScreen'

type CapturedProps = {
  messages: Array<{ id: string; role: string; content: string }>
  loading: boolean
  input: string
  sending: boolean
  streaming?: boolean
  pendingAssistantText?: string
  sendError?: string
  onInputChange: (v: string) => void
  onSend: () => void
  onStopStreaming?: () => void
}

function lastProps(): CapturedProps {
  return agentChatPropsCaptured[agentChatPropsCaptured.length - 1] as unknown as CapturedProps
}

describe('AgentChatScreen 宿主 — B4 流式消费', () => {
  beforeEach(() => {
    streams = []
    agentChatPropsCaptured.length = 0
    apiMocks.streamAgentChat.mockImplementation(
      (params: { agentId: string; content: string }, callbacks: StreamCall['callbacks']) => {
        let resolve!: (outcome: unknown) => void
        let reject!: (err: unknown) => void
        const completion = new Promise<unknown>((res, rej) => {
          resolve = res
          reject = rej
        })
        const abort = vi.fn(() => {
          const err = new Error('Aborted')
          err.name = 'AbortError'
          reject(err)
        })
        streams.push({ params, callbacks, abort, resolve, reject })
        return { abort, completion }
      },
    )
  })

  it('delta 增量渲染,首包前 pending 为空串,done 后用最终落库结果替换本地消息', async () => {
    apiMocks.fetchAgentChatMessages.mockResolvedValue([])
    render(<AgentChatScreen />)
    await waitFor(() => expect(lastProps().loading).toBe(false))

    act(() => lastProps().onInputChange('你好'))
    await waitFor(() => expect(lastProps().input).toBe('你好'))
    act(() => lastProps().onSend())
    await waitFor(() => expect(streams).toHaveLength(1))

    // 首包前:streaming=true、pending='' (共享屏据此显示加载态),发送保持禁用
    expect(lastProps().streaming).toBe(true)
    expect(lastProps().pendingAssistantText).toBe('')
    expect(lastProps().sending).toBe(true)
    expect(lastProps().messages).toEqual([
      { id: expect.any(String), role: 'user', content: '你好' },
    ])

    act(() => streams[0]!.callbacks.onDelta?.('你', '你'))
    await waitFor(() => expect(lastProps().pendingAssistantText).toBe('你'))
    act(() => streams[0]!.callbacks.onDelta?.('好', '你好'))
    await waitFor(() => expect(lastProps().pendingAssistantText).toBe('你好'))

    const finalMessages = [
      { id: 'msg_u', role: 'user', content: '你好' },
      { id: 'msg_a', role: 'assistant', content: '你好呀' },
    ]
    await act(async () => {
      streams[0]!.resolve({
        mode: 'stream',
        messageId: 'msg_a',
        finishReason: 'stop',
        content: '你好呀',
        messages: finalMessages,
      })
    })
    await waitFor(() => {
      expect(lastProps().pendingAssistantText).toBeUndefined()
      expect(lastProps().streaming).toBe(false)
      expect(lastProps().sending).toBe(false)
      expect(lastProps().messages).toEqual(finalMessages)
    })
  })

  it('失败显式报错:撤回乐观消息、恢复输入,并保留历史消息', async () => {
    const history = [{ id: 'msg_old', role: 'user', content: '旧消息' }]
    apiMocks.fetchAgentChatMessages.mockResolvedValue(history)
    render(<AgentChatScreen />)
    await waitFor(() => expect(lastProps().loading).toBe(false))

    act(() => lastProps().onInputChange('新问题'))
    await waitFor(() => expect(lastProps().input).toBe('新问题'))
    act(() => lastProps().onSend())
    await waitFor(() => expect(streams).toHaveLength(1))

    await act(async () => {
      streams[0]!.reject(new Error('模型调用失败'))
    })
    await waitFor(() => {
      expect(lastProps().sendError).toBe('模型调用失败')
      expect(lastProps().messages).toEqual(history)
      expect(lastProps().input).toBe('新问题')
      expect(lastProps().streaming).toBe(false)
      expect(lastProps().pendingAssistantText).toBeUndefined()
    })
  })

  it('卸载即 abort:迟到回调不再触发渲染(不再 setState)', async () => {
    apiMocks.fetchAgentChatMessages.mockResolvedValue([])
    const view = render(<AgentChatScreen />)
    await waitFor(() => expect(lastProps().loading).toBe(false))

    act(() => lastProps().onInputChange('停'))
    await waitFor(() => expect(lastProps().input).toBe('停'))
    act(() => lastProps().onSend())
    await waitFor(() => expect(streams).toHaveLength(1))
    act(() => streams[0]!.callbacks.onDelta?.('A', 'A'))

    view.unmount()
    expect(streams[0]!.abort).toHaveBeenCalledTimes(1)
    const rendersAfterUnmount = agentChatPropsCaptured.length

    act(() => streams[0]!.callbacks.onDelta?.('AB', 'AB'))
    expect(agentChatPropsCaptured.length).toBe(rendersAfterUnmount)
  })
})
