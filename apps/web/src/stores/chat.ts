import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { ssrStorage } from './persist-helpers'
import type { SubAgentActivity, InlineDiffInfo } from '@/components/ai/types'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'
import type { SubagentSpawnEvent, SubagentEndEvent, SubagentProgressEvent } from '@ihui/api-client'
import type { ChatMessage as BaseChatMessage, ToolCall as BaseToolCall } from '@ihui/shared'
import type { ToolCallSummary, PlanStep, TerminalTask } from '@ihui/types/ai'

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
  /** 写入工具调用汇总到指定消息(2026-07-31 立,AI 对话可视化深度接入)
   *  - SSE 流末尾发出 type='tool-summary' 事件时触发
   *  - 收到后直接写入 message.toolCallSummary,无需前端本地聚合
   *  - 同步写入 message.totalDurationMs(若 summary.totalDurationMs 存在) */
  setMessageToolSummary: (messageId: string, summary: ToolCallSummary) => void
  /** 2026-08-01 Phase 4a:写入消息级 plan steps(SSE plan/plan_updated 事件)
   *  - 后端 plan 事件携带 messageId + plan[] 权威快照,前端整体替换 message.planSteps
   *  - 用于消息气泡内 inline PlanStepsCard */
  setMessagePlanSteps: (messageId: string, steps: PlanStep[]) => void
  /** 2026-08-01 Phase 4a:追加消息级 terminal task(SSE terminal_start 事件)
   *  - 后端 terminal_start 携带 messageId + terminalId + command,前端 append 到 message.terminalTasks
   *  - 用于消息气泡内 inline TerminalSection */
  appendMessageTerminalTask: (messageId: string, task: TerminalTask) => void
  /** 2026-08-01 Phase 4a:更新消息级 terminal task(SSE terminal_end 事件)
   *  - 后端 terminal_end 携带 terminalId + status/output/exitCode,前端按 terminalId 更新 */
  updateMessageTerminalTask: (
    messageId: string,
    terminalId: string,
    updates: Partial<TerminalTask>,
  ) => void
}

// P1-1 修复(2026-07-28):长会话 messages 数组无上限会导致内存爆炸,
// 保留最近 MAX_MESSAGES 条(滑动窗口),超出时丢弃最旧消息。
// 500 条足够覆盖大部分长对话场景,且内存占用可控。
const MAX_MESSAGES = 500

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
      // 2026-08-06 立:默认值改为 'auto',与 model-selector.tsx 的 AUTO_OPTION 一致,
      // 体现"零配置即可用"理念,后端 llm_gateway 会自动选最优模型。
      // 历史:step-router-v1 是 Step 厂家路由(仅 Step 内部),违背"自动切换所有可用模型"语义。
      currentModel: 'auto',
      isStreaming: false,
      error: null,
      conversationId: null,
      draftInput: null,
      pendingQuestion: null,
      subAgentActivities: [],
      selectedTools: [],
      recentMessages: null,

      // 2026-08-06 立:Auto 模式真正跨厂商路由(用户反馈"应该是自动切换所有可使用的模型")
      // 历史:之前静默转 'auto' → 'stepfun/step-router-v1',导致 Auto 永远绑死 Step 厂家路由。
      // 修复:把 'auto' 原样透传到 ai-service,由后端 /llm/complete 解析为
      //       model_availability 返回的「全厂商最优模型」(见 apps/ai-service/llm_gateway.py)。
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
        set((s) => {
          const messages = s.messages.concat(message)
          // P1-1 修复:超过上限时丢弃最旧消息(滑动窗口),防止长会话内存爆炸
          if (messages.length > MAX_MESSAGES) {
            messages.splice(0, messages.length - MAX_MESSAGES)
          }
          return { messages }
        })
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
      // 2026-08-01 Phase 4a:若 event.messageId 存在,同步写入 message.subagentActivities,
      // 供消息气泡内 inline SubagentSection 实时刷新(对标 Trae Work/Codex 消息级透明性)。
      addSubagentSpawn: (event) =>
        set((s) => {
          const globalExists = s.subAgentActivities.some((a) => a.agentId === event.id)
          const newActivity: SubAgentActivity = {
            agentId: event.id,
            name: event.role || `Subagent ${event.id.slice(-6)}`,
            type: 'worker',
            status: 'running',
            currentStep: event.task || '执行中…',
            completedSteps: [],
          }
          // 消息级同步:按 event.messageId upsert 到对应 message.subagentActivities
          let messages = s.messages
          if (event.messageId) {
            const mIdx = s.messages.findIndex((m) => m.id === event.messageId)
            if (mIdx !== -1) {
              const target = s.messages[mIdx]
              if (target && !(target.subagentActivities ?? []).some((a) => a.agentId === event.id)) {
                messages = s.messages.slice()
                messages[mIdx] = {
                  ...target,
                  subagentActivities: [...(target.subagentActivities ?? []), newActivity],
                }
              }
            }
          }
          if (globalExists) return messages === s.messages ? s : { messages }
          return { subAgentActivities: [...s.subAgentActivities, newActivity], messages }
        }),

      markSubagentEnd: (event) =>
        set((s) => {
          const applyEnd = (a: SubAgentActivity): SubAgentActivity => {
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
          }
          const subAgentActivities = s.subAgentActivities.map(applyEnd)
          // 2026-08-01 Phase 4a:同步更新消息级
          let messages = s.messages
          if (event.messageId) {
            const mIdx = s.messages.findIndex((m) => m.id === event.messageId)
            if (mIdx !== -1) {
              const target = s.messages[mIdx]
              if (target?.subagentActivities?.some((a) => a.agentId === event.id)) {
                messages = s.messages.slice()
                messages[mIdx] = {
                  ...target,
                  subagentActivities: target.subagentActivities.map(applyEnd),
                }
              }
            }
          }
          return { subAgentActivities, messages }
        }),

      updateSubagentProgress: (event) =>
        set((s) => {
          const applyProgress = (a: SubAgentActivity): SubAgentActivity => {
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
            const completedSteps =
              event.phase === 'tool_result'
                ? [
                    ...a.completedSteps,
                    {
                      stepAction: `${event.tool ?? 'unknown'} ${event.ok ? '✓' : '✗'}`,
                      createdAt: event.timestamp,
                      status: (event.ok ? 'completed' : 'failed') as 'completed' | 'failed',
                    },
                  ]
                : a.completedSteps
            const toolCallsCount =
              event.phase === 'tool_result' ? (a.toolCallsCount ?? 0) + 1 : (a.toolCallsCount ?? 0)
            return {
              ...a,
              currentStep: stepText,
              progressPhase: event.phase,
              progressIteration: event.iteration ?? a.progressIteration,
              progressTool: event.tool ?? a.progressTool,
              toolCallsCount,
              completedSteps,
              outputPreview: event.outputPreview ?? a.outputPreview,
            }
          }
          const subAgentActivities = s.subAgentActivities.map(applyProgress)
          // 2026-08-01 Phase 4a:同步更新消息级
          let messages = s.messages
          if (event.messageId) {
            const mIdx = s.messages.findIndex((m) => m.id === event.messageId)
            if (mIdx !== -1) {
              const target = s.messages[mIdx]
              if (target?.subagentActivities?.some((a) => a.agentId === event.id)) {
                messages = s.messages.slice()
                messages[mIdx] = {
                  ...target,
                  subagentActivities: target.subagentActivities.map(applyProgress),
                }
              }
            }
          }
          return { subAgentActivities, messages }
        }),

      addToolCall: (messageId, toolCall) =>
        set((s) => {
          // P1-1 修复:用 findIndex + 局部替换替代 map 全量遍历,
          // 只更新目标消息引用,其他消息引用不变 → 配合 React.memo 避免全量重渲染
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          const fullCall: ToolCall = {
            ...toolCall,
            status: toolCall.status ?? 'running',
          }
          // 已存在同 id 的 toolCall 不重复添加(与原 map 实现语义一致)
          const exists = target.toolCalls?.some((tc) => tc.id === fullCall.id)
          if (exists) return s
          const next = s.messages.slice()
          next[idx] = {
            ...target,
            toolCalls: [...(target.toolCalls ?? []), fullCall],
          }
          return { messages: next }
        }),

      updateToolCall: (messageId, toolCallId, updates) =>
        set((s) => {
          // P1-1 修复:用 findIndex + 局部替换替代 map 全量遍历
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target || !target.toolCalls) return s
          const tcIdx = target.toolCalls.findIndex((tc) => tc.id === toolCallId)
          if (tcIdx === -1) return s
          const oldTc = target.toolCalls[tcIdx]
          if (!oldTc) return s // 类型收窄:确保 oldTc 是 ToolCall(noUncheckedIndexedAccess)
          const next = s.messages.slice()
          const newToolCalls = target.toolCalls.slice()
          newToolCalls[tcIdx] = { ...oldTc, ...updates }
          next[idx] = { ...target, toolCalls: newToolCalls }
          return { messages: next }
        }),

      setToolCallApplyStatus: (messageId, toolCallId, status, errorMessage) =>
        set((s) => {
          // P1-1 修复:用 findIndex + 局部替换替代 map 全量遍历
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target || !target.toolCalls) return s
          const tcIdx = target.toolCalls.findIndex((tc) => tc.id === toolCallId)
          if (tcIdx === -1) return s
          const oldTc = target.toolCalls[tcIdx]
          if (!oldTc) return s // 类型收窄:确保 oldTc 是 ToolCall(noUncheckedIndexedAccess)
          const next = s.messages.slice()
          const newToolCalls = target.toolCalls.slice()
          newToolCalls[tcIdx] = {
            ...oldTc,
            applyStatus: status,
            applyError: status === 'error' ? errorMessage : undefined,
          }
          next[idx] = { ...target, toolCalls: newToolCalls }
          return { messages: next }
        }),

      // 2026-07-31 立,AI 对话可视化深度接入:SSE tool-summary 事件落地
      setMessageToolSummary: (messageId, summary) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          const next = s.messages.slice()
          next[idx] = {
            ...target,
            toolCallSummary: summary,
            totalDurationMs: summary.totalDurationMs ?? target.totalDurationMs,
          }
          return { messages: next }
        }),

      // 2026-08-01 Phase 4a:消息级 plan steps(整体替换,plan 事件为权威快照)
      setMessagePlanSteps: (messageId, steps) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          const next = s.messages.slice()
          next[idx] = { ...target, planSteps: steps }
          return { messages: next }
        }),

      // 2026-08-01 Phase 4a:消息级 terminal task append(terminal_start 事件)
      appendMessageTerminalTask: (messageId, task) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          // 同 id 已存在则跳过(防止重复)
          if ((target.terminalTasks ?? []).some((t) => t.id === task.id)) return s
          const next = s.messages.slice()
          next[idx] = {
            ...target,
            terminalTasks: [...(target.terminalTasks ?? []), task],
          }
          return { messages: next }
        }),

      // 2026-08-01 Phase 4a:消息级 terminal task 更新(terminal_end 事件)
      updateMessageTerminalTask: (messageId, terminalId, updates) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target || !target.terminalTasks) return s
          const tIdx = target.terminalTasks.findIndex((t) => t.id === terminalId)
          if (tIdx === -1) return s
          const oldTask = target.terminalTasks[tIdx]
          if (!oldTask) return s
          const next = s.messages.slice()
          const newTasks = target.terminalTasks.slice()
          newTasks[tIdx] = { ...oldTask, ...updates }
          next[idx] = { ...target, terminalTasks: newTasks }
          return { messages: next }
        }),
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
      // 2026-07-27 修复 React Hydration 失败导致 AI 回复未渲染:
      // 原先 onRehydrateStorage 在 persist 初始化时同步把 recentMessages.messages 赋给 state.messages,
      // 因 localStorage 是同步 API,此赋值发生在 React hydration 之前,导致:
      //   SSR 渲染 messages=[] (noopStorage 返回 null)
      //   客户端 hydration 时 messages=recentMessages.messages (50 条)
      // React 18 检测到 hydration mismatch → 丢弃服务端 DOM 重建 → 重建过程中 store 状态错乱,
      // onDelta 更新旧引用,最终 AI 回复不渲染。
      // 修复:移除 onRehydrateStorage 对 messages 的同步赋值,改为在 ai-side-panel.tsx 的
      // useEffect(hydration 后执行)中从 recentMessages 预填充,保证 SSR 与客户端首次渲染一致。
      // recentMessages 仍被持久化(partialize 中),仅恢复时机推迟到 mount 后。
      // 2026-07-24 立:旧版本无 version,localStorage 中 currentModel='stepfun/step-3.7-flash'
      // 是历史默认值(非显式选择)。version=2 migrate 把旧默认值升级到 step-router-v1。
      // 用户若显式选了其他模型(gpt-4o / claude 等),migrate 不动,保留原值。
      // 2026-07-31 立:version=3 migrate 把 'auto' 迁移到 stepfun/step-3.7-flash。
      // 原因:后端不支持 'auto' 模型,返回 MODEL_NOT_CONFIGURED 错误,导致 AI 对话无回复。
      // 'auto' 来源:早期 UI 允许选择 'auto' 或用户手动选择后被持久化。
      // 2026-08-06 立:version=4 migrate 恢复 'auto' 合法值。
      // 原因:ai-service llm_gateway.py 已实现真正的跨厂商自动路由(model=='auto' →
      //       model_availability 选最优模型,跨 stepfun/agnes/cloudflare/nvidia_nim/gemini 等)。
      // 旧 migrate (version<3) 把 'auto' 改成 'stepfun/step-3.7-flash' 会让用户每次重启
      // 浏览器都丢失「自动模式」选择,需要再点一次 Auto 才能恢复。新版保留 'auto'。
      version: 4,
      migrate: (persisted: unknown, version: number) => {
        if (persisted && typeof persisted === 'object') {
          const s = persisted as { currentModel?: string }
          // 2026-08-06 立:version=4 migrate,旧默认值 stepfun/step-router-v1 升级为 'auto'。
          // 原因:Auto 模式已实现真正跨厂商路由(ai-service llm_gateway._resolve_auto_model),
          //       比硬绑 stepfun/step-router-v1 覆盖更广。旧用户重启浏览器即升级到 Auto。
          // 注:显式选择 gpt-4o / claude / deepseek 等其他模型的用户不动,保留原值。
          if (version < 2 && s.currentModel === 'stepfun/step-3.7-flash') {
            s.currentModel = 'auto'
          }
          // version < 3:'auto' 模型后端不支持,迁移到已验证连通的 stepfun/step-3.7-flash
          // 2026-08-06 升级:v4 之后已支持 'auto',此分支仅对 v1 → v3 用户生效一次
          if (
            version < 3 &&
            (s.currentModel === 'auto' || s.currentModel === '' || !s.currentModel)
          ) {
            s.currentModel = 'stepfun/step-3.7-flash'
          }
        }
        return persisted
      },
    },
  ),
)
