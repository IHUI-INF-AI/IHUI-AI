import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createPersistConfig } from './persist-helpers'

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ToolCall {
  id: string
  toolName: string
  args: Record<string, unknown>
  result?: unknown
  status: 'running' | 'success' | 'error'
  duration?: number
  error?: string
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  model?: string
  error?: boolean
  toolCalls?: ToolCall[]
  reasoning?: string
}

interface ChatState {
  messages: ChatMessage[]
  currentModel: string
  isStreaming: boolean
  error: string | null
  /** 当前绑定的会话 ID；为 null 表示新会话尚未持久化 */
  conversationId: string | null
  /** 模板选择等外部输入填充值；MessageInput 消费后置 null */
  draftInput: string | null

  setModel: (model: string) => void
  addMessage: (msg: Pick<ChatMessage, 'role' | 'content' | 'model'>) => string
  appendToMessage: (id: string, delta: string) => void
  appendReasoningToMessage: (id: string, delta: string) => void
  setMessageError: (id: string, error: string) => void
  clearMessages: () => void
  setStreaming: (v: boolean) => void
  setError: (e: string | null) => void
  setConversationId: (id: string | null) => void
  /** MessageInput 消费 draftInput 后调用,置 null 避免重复填充 */
  clearDraftInput: () => void
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      currentModel: 'stepfun/step-3.7-flash',
      isStreaming: false,
      error: null,
      conversationId: null,
      draftInput: null,

      setModel: (model) => set({ currentModel: model }),

      addMessage: (msg) => {
        const id = genId()
        const message: ChatMessage = {
          id,
          role: msg.role,
          content: msg.content,
          createdAt: Date.now(),
          model: msg.model,
        }
        set((s) => ({ messages: [...s.messages, message] }))
        return id
      },

      appendToMessage: (id, delta) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
        })),

      appendReasoningToMessage: (id, delta) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, reasoning: (m.reasoning || '') + delta } : m,
          ),
        })),

      setMessageError: (id, error) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === id ? { ...m, error: true, content: m.content || error } : m,
          ),
          error,
        })),

      clearMessages: () => set({ messages: [], error: null }),

      setStreaming: (v) => set({ isStreaming: v }),

      setError: (e) => set({ error: e }),

      setConversationId: (id) => set({ conversationId: id }),

      clearDraftInput: () => set({ draftInput: null }),
    }),
    createPersistConfig<ChatState>('ihui-chat', (s) => ({
      currentModel: s.currentModel,
      conversationId: s.conversationId,
      draftInput: s.draftInput,
    })),
  ),
)
