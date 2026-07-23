import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { ssrStorage } from './persist-helpers'
import type { SubAgentActivity, InlineDiffInfo } from '@/components/ai/types'

export type ChatRole = 'user' | 'assistant' | 'system'

/** Inline Diff Apply 状态:pending=待确认 / applying=应用中 / applied=已应用 / rejected=已拒绝 / error=应用失败 */
export type DiffApplyStatus = 'pending' | 'applying' | 'applied' | 'rejected' | 'error'

export interface ToolCall {
  id: string
  toolName: string
  args: Record<string, unknown>
  result?: unknown
  status: 'running' | 'success' | 'error'
  duration?: number
  error?: string
  /** 多轮 tool loop 的轮次(1-based,undefined 或 1 表示单轮) */
  iteration?: number
  /** edit_file/write_file 工具调用关联的 Inline Diff 信息(供 InlineDiffCard 渲染) */
  diffInfo?: InlineDiffInfo
  /** Inline Diff Apply 工作流状态(Accept/Reject 按钮交互) */
  applyStatus?: DiffApplyStatus
  /** Apply 失败时的错误信息(applyStatus === 'error' 时填充) */
  applyError?: string
}

/** AI 主动提问的选项 */
export interface QuestionOption {
  id: string
  label: string
}

/** AI 主动提问(挂起对话,等用户回答后继续) */
export interface PendingQuestion {
  questionId: string
  prompt: string
  options: QuestionOption[]
  allowCustom: boolean
  allowMultiple: boolean
  /** 关联的 assistant 消息 ID,用户回答后追加到该消息上下文 */
  assistantMessageId?: string
}

/**
 * Web 前端 chat store UI 状态消息类型(本地保留,不复用 @ihui/types 的 ChatMessage)。
 *
 * 原因:@ihui/types 的 ChatMessage 是 LLM API 调用消息格式(role + content 简版),
 * 此处是 web chat store 的 UI 状态消息(含 id / createdAt / model / error / toolCalls / reasoning / question 等 UI 状态字段)。
 * 两者语义不同:LLM API 消息格式 vs 前端 store 状态类型,强行合并会让 packages/types ChatMessage
 * 变成大杂烩,且 question 字段会引入与 PendingQuestionPayload 的循环依赖风险。
 *
 * 命名保留 ChatMessage 是因为 web chat store 内仅此一种 chat 消息类型,文件内无命名冲突
 * (web 端在其他位置如 lib/video-tools/chat-image-drawer.ts 也有同名 ChatMessage,但属于不同业务上下文,
 *  各自文件内独立,无 import 交叉)。
 */
export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  model?: string
  error?: boolean
  toolCalls?: ToolCall[]
  reasoning?: string
  /** 该消息触发的提问(若有,渲染时显示提问卡片) */
  question?: PendingQuestion
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
  /** AI 主动提问挂起态:非 null 表示有未回答的提问,前端弹窗阻塞输入,等待用户回答后调 /chat/answer 续流 */
  pendingQuestion: PendingQuestion | null
  /** Sub-agent 活动列表(多 agent 多路复用:SSE chunk 带 agentId 时按 agent 分流累加)。
   * 不持久化(每次新对话 resetSubAgentActivities 清空)。 */
  subAgentActivities: SubAgentActivity[]
  /** 用户从插件市场"添加到对话"的已选工具列表(2026-07-22 立)
   * 存 pluginId,sendMessage 时合并到 agentTools 传给后端。
   * 不持久化(每次新会话默认空)。 */
  selectedTools: string[]

  setModel: (model: string) => void
  /** 添加单个工具到已选;已存在则忽略 */
  addSelectedTool: (pluginId: string) => void
  /** 从已选移除单个工具 */
  removeSelectedTool: (pluginId: string) => void
  /** 清空已选工具 */
  clearSelectedTools: () => void
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
  /** 设置当前挂起的 AI 提问(收到 SSE question 事件时调用) */
  setPendingQuestion: (q: PendingQuestion | null) => void
  /** 清空挂起的提问(用户回答后或续流开始时调用) */
  clearPendingQuestion: () => void
  /** 追加 token 到指定 sub-agent 的流式内容;agentId 不存在时自动创建新活动条目 */
  appendToAgentStream: (agentId: string, delta: string, name?: string) => void
  /** 标记所有 sub-agent 流式结束(stream 结束时调用,UI 切换为已完成态) */
  markAllAgentStreamsDone: () => void
  /** 清空所有 sub-agent 活动(新对话开始时调用) */
  resetSubAgentActivities: () => void
  /** 添加工具调用到指定消息(SSE tool-call-start 事件触发)
   * 2026-07-22 立,P2 联动 WorkPanel */
  addToolCall: (messageId: string, toolCall: Omit<ToolCall, 'status'> & { status?: ToolCall['status'] }) => void
  /** 更新工具调用结果(SSE tool-result 事件触发)
   * 同步联动 WorkPanel:toolName=browser_navigate 或 args/result 含 url → openPanel */
  updateToolCall: (messageId: string, toolCallId: string, updates: Partial<ToolCall>) => void
  /** 设置工具调用的 Inline Diff Apply 状态(Accept/Reject 按钮交互)
   *  2026-07-22 立,P3 Inline Diff 卡片 Apply 工作流 */
  setToolCallApplyStatus: (
    messageId: string,
    toolCallId: string,
    status: DiffApplyStatus,
    errorMessage?: string,
  ) => void
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // 2026-07-21 安全审计加固:Web Crypto 不可用时改用 crypto.getRandomValues,
  // 严禁降级到 Math.random (CWE-330 可预测随机)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint8Array(16)
    crypto.getRandomValues(buf)
    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${Date.now().toString(36)}-${hex}`
  }
  throw new Error('Web Crypto API 不可用,无法生成密码学安全 ID')
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      // 2026-07-24 升级:与 ai-service default_models.json 首位 + FALLBACK_MODELS 首位对齐
      // 原 step-3.7-flash 降为备选,step-router-v1 智能路由更适合 tool calling 决策
      currentModel: 'stepfun/step-router-v1',
      isStreaming: false,
      error: null,
      conversationId: null,
      draftInput: null,
      pendingQuestion: null,
      subAgentActivities: [],
      selectedTools: [],

      setModel: (model) => set({ currentModel: model }),
      addSelectedTool: (pluginId) =>
        set((s) =>
          s.selectedTools.includes(pluginId)
            ? s
            : { selectedTools: [...s.selectedTools, pluginId] },
        ),
      removeSelectedTool: (pluginId) =>
        set((s) => ({ selectedTools: s.selectedTools.filter((id) => id !== pluginId) })),
      clearSelectedTools: () => set({ selectedTools: [] }),

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

      // P0 流式性能优化(2026-07-23):用 findIndex 替代 map,
      // 只更新目标消息引用,其他消息引用不变 → 配合 React.memo 避免全量重渲染
      appendToMessage: (id, delta) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === id)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          const next = s.messages.slice()
          next[idx] = { ...target, content: target.content + delta }
          return { messages: next }
        }),

      appendReasoningToMessage: (id, delta) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === id)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          const next = s.messages.slice()
          next[idx] = { ...target, reasoning: (target.reasoning || '') + delta }
          return { messages: next }
        }),

      setMessageError: (id, error) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === id)
          if (idx === -1) return { error }
          const target = s.messages[idx]
          if (!target) return { error }
          const next = s.messages.slice()
          next[idx] = { ...target, error: true, content: target.content || error }
          return { messages: next, error }
        }),

      clearMessages: () => set({ messages: [], error: null }),

      setStreaming: (v) => set({ isStreaming: v }),

      setError: (e) => set({ error: e }),

      setConversationId: (id) => set({ conversationId: id }),

      clearDraftInput: () => set({ draftInput: null }),

      setPendingQuestion: (q) => set({ pendingQuestion: q }),

      clearPendingQuestion: () => set({ pendingQuestion: null }),

      appendToAgentStream: (agentId, delta, name) =>
        set((s) => {
          const existing = s.subAgentActivities.find((a) => a.agentId === agentId)
          if (existing) {
            return {
              subAgentActivities: s.subAgentActivities.map((a) =>
                a.agentId === agentId
                  ? {
                      ...a,
                      streamingContent: (a.streamingContent || '') + delta,
                      streamingDone: false,
                    }
                  : a,
              ),
            }
          }
          const newActivity: SubAgentActivity = {
            agentId,
            name: name || `Agent ${agentId.slice(0, 8)}`,
            type: 'worker',
            status: 'running',
            currentStep: 'Generating…',
            completedSteps: [],
            streamingContent: delta,
            streamingDone: false,
          }
          return { subAgentActivities: [...s.subAgentActivities, newActivity] }
        }),

      markAllAgentStreamsDone: () =>
        set((s) => ({
          subAgentActivities: s.subAgentActivities.map((a) => ({
            ...a,
            streamingDone: true,
            status: a.status === 'running' || a.status === 'thinking' ? 'completed' : a.status,
            currentStep:
              a.status === 'running' || a.status === 'thinking' ? '' : a.currentStep,
          })),
        })),

      resetSubAgentActivities: () => set({ subAgentActivities: [] }),

      addToolCall: (messageId, toolCall) =>
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== messageId) return m
            const fullCall: ToolCall = {
              ...toolCall,
              status: toolCall.status ?? 'running',
            }
            const exists = m.toolCalls?.some((tc) => tc.id === fullCall.id)
            return {
              ...m,
              toolCalls: exists
                ? m.toolCalls
                : [...(m.toolCalls ?? []), fullCall],
            }
          }),
        })),

      updateToolCall: (messageId, toolCallId, updates) =>
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== messageId || !m.toolCalls) return m
            return {
              ...m,
              toolCalls: m.toolCalls.map((tc) =>
                tc.id === toolCallId ? { ...tc, ...updates } : tc,
              ),
            }
          }),
        })),

      setToolCallApplyStatus: (messageId, toolCallId, status, errorMessage) =>
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== messageId || !m.toolCalls) return m
            return {
              ...m,
              toolCalls: m.toolCalls.map((tc) =>
                tc.id === toolCallId
                  ? {
                      ...tc,
                      applyStatus: status,
                      applyError: status === 'error' ? errorMessage : undefined,
                    }
                  : tc,
              ),
            }
          }),
        })),
    }),
    {
      name: 'ihui-chat',
      storage: ssrStorage,
      partialize: (s: ChatState) => ({
        currentModel: s.currentModel,
        conversationId: s.conversationId,
        draftInput: s.draftInput,
      }),
      // 2026-07-24 立:旧版本无 version,localStorage 中 currentModel='stepfun/step-3.7-flash'
      // 是历史默认值(非显式选择)。version=2 migrate 把旧默认值升级到 step-router-v1。
      // 用户若显式选了其他模型(gpt-4o / claude 等),migrate 不动,保留原值。
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        if (version < 2 && persisted && typeof persisted === 'object') {
          const s = persisted as { currentModel?: string }
          if (s.currentModel === 'stepfun/step-3.7-flash') {
            s.currentModel = 'stepfun/step-router-v1'
          }
        }
        return persisted
      },
    },
  ),
)
