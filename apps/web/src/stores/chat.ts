import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { ssrStorage } from './persist-helpers'
import type { SubAgentActivity, InlineDiffInfo } from '@/components/ai/types'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'
import type {
  SubagentSpawnEvent,
  SubagentEndEvent,
  SubagentProgressEvent,
} from '@ihui/api-client'
import type { ChatMessage as BaseChatMessage, ToolCall as BaseToolCall } from '@ihui/shared'

export type { ChatRole } from '@ihui/shared'

/** Inline Diff Apply 状态:pending=待确认 / applying=应用中 / applied=已应用 / rejected=已拒绝 / error=应用失败 */
export type DiffApplyStatus = 'pending' | 'applying' | 'applied' | 'rejected' | 'error'

export interface ToolCall extends BaseToolCall {
  /** edit_file/write_file 工具调用关联的 Inline Diff 信息(供 InlineDiffCard 渲染) */
  diffInfo?: InlineDiffInfo
  /** Inline Diff Apply 工作流状态(Accept/Reject 按钮交互) */
  applyStatus?: DiffApplyStatus
  /** Apply 失败时的错误信息(applyStatus === 'error' 时填充) */
  applyError?: string
  /** summarize_artifacts 工具返回的结构化摘要数据 */
  summary_data?: {
    plans?: Array<{ id: string; title: string; status: string; steps?: string[] }>
    sources?: Array<{ type: string; ref: string; accessed_at?: string }>
    artifacts?: Array<{ type: string; path: string; created_at?: string }>
    tool_calls_summary?: { total: number; by_tool: Record<string, number> }
  }
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
 * Web 前端 chat store UI 状态消息类型。
 *
 * 继承 @ihui/shared 的 ChatMessage 通用基类(id/role/content/createdAt?/model?/error?/reasoning?/toolCalls?/meta?),
 * 扩展 web 端独占字段:createdAt 必填 + toolCalls 用 web 本地类型(含 InlineDiff/ApplyStatus)+ question + permissionMode。
 *
 * 命名保留 ChatMessage 是因为 web chat store 内仅此一种 chat 消息类型,文件内无命名冲突
 * (web 端在其他位置如 lib/video-tools/chat-image-drawer.ts 也有同名 ChatMessage,但属于不同业务上下文,
 *  各自文件内独立,无 import 交叉)。
 */
export interface ChatMessage extends Omit<BaseChatMessage, 'createdAt' | 'toolCalls'> {
  /** Web 端 createdAt 必填(写入时 Date.now()) */
  createdAt: number
  /** Web 端 toolCalls 用本地 ToolCall 类型(含 InlineDiff/ApplyStatus) */
  toolCalls?: ToolCall[]
  /** 该消息触发的提问(若有,渲染时显示提问卡片) */
  question?: PendingQuestion
  /** 2026-07-25 立(深度对标 Codex 透明性):该消息生成时所使用的工作区权限模式
   * - undefined:旧消息或用户消息(不显示徽章)
   * - 'default' | 'accept-edits' | 'bypass-permissions':AI 响应生成时的模式
   * - 用于消息气泡的徽章展示,让用户事后能识别"这条回答是基于哪种权限模式生成的"
   * - 前端 addMessage 写入,后端 streamChat 事件不携带(纯前端元数据) */
  permissionMode?: WorkspacePermissionMode
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
  /** 最近一条会话的 messages 快照(2026-07-25 立,#12 store messages 持久化)。
   * 不在 set 中主动更新,每次 partialize 调用时从 messages + conversationId 派生。
   * 持久化目的:刷新页面后 messages 数组清空,从 recentMessages 预填充避免空状态闪烁。
   * 真实数据以服务端 getMessages 拉取为准,预填充仅作为首屏过渡,不作为真实数据源。
   * 限制最近 50 条(slice(-50))避免 localStorage 超 5MB 配额。 */
  recentMessages: { conversationId: string; messages: ChatMessage[] } | null

  setModel: (model: string) => void
  /** 添加单个工具到已选;已存在则忽略 */
  addSelectedTool: (pluginId: string) => void
  /** 从已选移除单个工具 */
  removeSelectedTool: (pluginId: string) => void
  /** 清空已选工具 */
  clearSelectedTools: () => void
  addMessage: (msg: Pick<ChatMessage, 'role' | 'content' | 'model' | 'permissionMode'>) => string
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
  /** Subagent 自动派发生成(2026-07-28 立,对标 Trae Work):
   *  主 agent 在对话流中调用 dispatch_subagent 工具时,后端发 subagent_spawn SSE 事件,
   *  前端通过 onSubagentSpawn 回调写入 store,UI 自动展示 subagent 生命周期。 */
  addSubagentSpawn: (event: SubagentSpawnEvent) => void
  /** Subagent 自动派发结束(2026-07-28 立):
   *  dispatch_subagent 工具执行完成后,后端发 subagent_end SSE 事件,
   *  前端通过 onSubagentEnd 回调更新 store 中对应条目状态为 completed/failed。 */
  markSubagentEnd: (event: SubagentEndEvent) => void
  /** Subagent 执行进度更新(2026-07-28 立):
   *  subagent 执行期间后端实时发 subagent_progress SSE 事件,
   *  前端通过 onSubagentProgress 回调更新 store 中对应条目的 phase/iteration/tool 等字段,
   *  UI 进度面板据此实时显示"思考中.../调用工具: xxx/输出就绪"等状态。 */
  updateSubagentProgress: (event: SubagentProgressEvent) => void
  /** 添加工具调用到指定消息(SSE tool-call-start 事件触发)
   * 2026-07-22 立,P2 联动 WorkPanel */
  addToolCall: (
    messageId: string,
    toolCall: Omit<ToolCall, 'status'> & { status?: ToolCall['status'] },
  ) => void
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
      recentMessages: null,

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
          // 透传权限模式(2026-07-25 深化,深度对标 Codex 透明性):
          // 用户消息不传(无模式),AI 消息由调用方传入当前工作区模式
          permissionMode: msg.permissionMode,
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
            currentStep: a.status === 'running' || a.status === 'thinking' ? '' : a.currentStep,
          })),
        })),

      resetSubAgentActivities: () => set({ subAgentActivities: [] }),

      // Subagent 自动派发(2026-07-28 立,对标 Trae Work):
      // - addSubagentSpawn: 后端 subagent_spawn SSE 事件触发,追加新 SubAgentActivity(status='running')
      // - markSubagentEnd: 后端 subagent_end SSE 事件触发,更新现有条目状态为 completed/failed
      // 与 appendToAgentStream 的区别:appendToAgentStream 用于多 agent 多路复用的 token 流分流,
      // 而 addSubagentSpawn/markSubagentEnd 用于 dispatch_subagent 工具调用的生命周期展示。
      // 两者写入同一 subAgentActivities 数组,UI 统一通过 SubAgentActivityFeed 渲染。
      addSubagentSpawn: (event) =>
        set((s) => {
          // 同一 id 已存在则跳过(防止后端重复发 spawn 事件)
          if (s.subAgentActivities.some((a) => a.agentId === event.id)) return s
          const newActivity: SubAgentActivity = {
            agentId: event.id,
            name: event.role || `Subagent ${event.id.slice(-6)}`,
            type: 'worker',
            status: 'running',
            currentStep: event.task || '执行中…',
            completedSteps: [],
          }
          return { subAgentActivities: [...s.subAgentActivities, newActivity] }
        }),

      markSubagentEnd: (event) =>
        set((s) => ({
          subAgentActivities: s.subAgentActivities.map((a) => {
            if (a.agentId !== event.id) return a
            const nextStatus: SubAgentActivity['status'] =
              event.status === 'failed' ? 'failed' : 'completed'
            return {
              ...a,
              status: nextStatus,
              // 完成时把 currentStep 推入 completedSteps,再清空 currentStep;
              // 失败时 currentStep 改为错误摘要,保留 step 上下文供用户排查
              ...(event.status === 'failed'
                ? {
                    currentStep: event.failureReason
                      ? `失败:${event.failureReason.slice(0, 200)}`
                      : '执行失败',
                  }
                : {
                    completedSteps: [
                      ...a.completedSteps,
                      ...(a.currentStep
                        ? [
                            {
                              stepAction: a.currentStep,
                              createdAt: event.timestamp,
                              status: 'completed' as const,
                            },
                          ]
                        : []),
                    ],
                    currentStep: '',
                  }),
              streamingDone: true,
            }
          }),
        })),

      updateSubagentProgress: (event) =>
        set((s) => ({
          subAgentActivities: s.subAgentActivities.map((a) => {
            if (a.agentId !== event.id) return a
            // 根据 phase 构造人类可读的 currentStep 文本
            let stepText = a.currentStep
            const iter = event.iteration ? ` (轮次 ${event.iteration})` : ''
            switch (event.phase) {
              case 'thinking':
                stepText = `思考中…${iter}`
                break
              case 'tool_call':
                stepText = `调用工具: ${event.tool ?? 'unknown'}${iter}`
                break
              case 'tool_result':
                stepText = `${event.tool ?? 'unknown'} ${event.ok ? '✓' : '✗'}${iter}`
                break
              case 'output_ready':
                stepText = '输出就绪'
                break
            }
            // tool_result 时把 tool_call 的 stepText 推入 completedSteps
            let completedSteps = a.completedSteps
            let toolCallsCount = a.toolCallsCount ?? 0
            if (event.phase === 'tool_result') {
              toolCallsCount += 1
              completedSteps = [
                ...completedSteps,
                {
                  stepAction: `${event.tool ?? 'unknown'} ${event.ok ? '✓' : '✗'}`,
                  createdAt: event.timestamp,
                  status: (event.ok ? 'completed' : 'failed') as 'completed' | 'failed',
                },
              ]
            }
            return {
              ...a,
              currentStep: stepText,
              progressPhase: event.phase,
              progressIteration: event.iteration ?? a.progressIteration,
              progressTool: event.tool ?? a.progressTool,
              toolCallsCount,
              outputPreview: event.outputPreview ?? a.outputPreview,
            }
          }),
        })),

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
              toolCalls: exists ? m.toolCalls : [...(m.toolCalls ?? []), fullCall],
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
        // 2026-07-28 移除独立 PlanActToggle 后,plan_mode 字段已从持久化中删除
        // ChatMode 由 useModeStore 独立管理,持久化不重复存储
        // #12 store messages 持久化(2026-07-25 立):
        // 仅持久化当前 conversationId 对应的 messages 最近 50 条,
        // 用于刷新页面后预填充(避免空状态闪烁),真实数据以服务端 getMessages 为准。
        recentMessages: s.conversationId
          ? {
              conversationId: s.conversationId,
              messages: s.messages.slice(-50),
            }
          : null,
      }),
      // #12 store messages 持久化(2026-07-25 立):
      // 状态从 localStorage 恢复时,若 recentMessages.conversationId 与当前 conversationId 匹配,
      // 预填充 messages 数组,避免首屏空状态闪烁。
      // 后台 getMessages 拉取完整历史后会覆盖预填充数据(由 ai-side-panel loadHistory 处理)。
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (
          state.recentMessages &&
          state.recentMessages.conversationId === state.conversationId &&
          Array.isArray(state.recentMessages.messages)
        ) {
          state.messages = state.recentMessages.messages
        }
      },
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
