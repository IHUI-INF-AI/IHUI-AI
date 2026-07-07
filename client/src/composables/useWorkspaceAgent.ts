/**
 * useWorkspaceAgent — 工作区 Agent 集成 Composable
 *
 * 当用户选择了本地工作区文件夹后, 将消息发送到 Agent WebSocket (工具循环),
 * 而非普通 LLM WebSocket。Agent 可以读写文件、执行命令、搜索代码。
 *
 * 对标 Claude Code / Cursor 的 Agent 模式:
 * - 流式推送文本回复 (agent.text.delta)
 * - 工具调用可视化 (agent.tool.call / agent.tool.result)
 * - 上下文加载反馈 (agent.context)
 * - 错误处理 (agent.error)
 * - 完成通知 (agent.done)
 *
 * 使用方式:
 *   const { sendToAgent, isAgentRunning, toolCalls, stopAgent } = useWorkspaceAgent()
 *   sendToAgent({ prompt, modelId, workspacePath, onTextDelta, onToolCall, onToolResult, onDone })
 */

import { ref, type Ref } from 'vue'
import { createAgentWebSocket, type AgentEvent, type AgentChatParams } from '@/api/services/workspace.service'

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface ToolCallInfo {
  id: string
  name: string
  input: Record<string, unknown>
  output?: string
  error?: string
  success?: boolean
  iteration?: number
  blockedByHook?: boolean
  status: 'running' | 'completed' | 'failed' | 'blocked'
  /** inline diff 预览信息 (write_file/edit_file/multi_edit 携带), 供 InlineDiffViewer 渲染 */
  diffInfo?: {
    file_path: string
    old_content: string
    new_content: string
    is_new_file?: boolean
  } | null
}

/** 任务清单条目 — 与后端 tools.py / agent_loop.py todo_write 协议保持一致 */
export interface AgentTodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority?: 'high' | 'medium' | 'low'
}

/**
 * 待确认的工具调用 (default 权限模式下, 后端推送 agent.tool.confirm 事件)
 * 前端弹出 PermissionConfirmDialog 让用户选择 允许 / 拒绝 / 本次会话全部允许
 */
export interface PendingToolConfirmation {
  id: string
  name: string
  input: Record<string, unknown>
  reason?: string
  iteration?: number
}

/** Slash 命令结果 (来自 /help / /init / /clear 等纯命令) */
export interface SlashCommandResult {
  command: string
  message?: string
  commands?: Array<{ name: string; description: string; category: string }>
  path?: string
  preview?: string
  skipped?: boolean
  error?: string
}

/** Plan 步骤 (Stage B: Plan Mode 两阶段分离) */
export interface AgentPlanStep {
  id?: string
  title: string
  description?: string
  files?: string[]
  tool_hint?: string
}

/** Plan 数据 — 与后端 agent_loop.py submit_plan 协议保持一致 */
export interface AgentPlan {
  title?: string
  summary?: string
  steps?: AgentPlanStep[]
  risks?: string[]
}

export interface SendAgentParams {
  prompt: string
  modelId: string
  workspacePath: string
  userUuid?: string
  chatId?: string
  systemPrompt?: string
  maxIterations?: number
  allowedTools?: string[]
  onTextDelta?: (text: string) => void
  onToolCall?: (tool: ToolCallInfo) => void
  onToolResult?: (tool: ToolCallInfo) => void
  onContext?: (info: { workspace: string; model: string; tools: string[] }) => void
  /** agent.todo.update 事件: 任务清单变更 (供 TaskListPanel 实时刷新) */
  onTodoUpdate?: (todos: AgentTodoItem[]) => void
  /** agent.plan.proposed 事件: Plan 模式阶段1结束, 提交完整计划等待用户确认 (供 PlanReviewPanel 渲染) */
  onPlanProposed?: (plan: AgentPlan) => void
  /** agent.command.result 事件: Slash 纯命令结果 (help/init/clear) */
  onCommandResult?: (result: SlashCommandResult) => void
  /** agent.command.handled 事件: 状态修改命令 (plan/goal/compact) 已应用, 继续进入 agent loop */
  onCommandHandled?: (info: { command: string; message?: string; modify?: Record<string, unknown> }) => void
  /** agent.usage 事件: 单轮 token 用量更新 (对标 Codex/Gemini 用量追踪) */
  onUsage?: (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }, total: { prompt_tokens: number; completion_tokens: number; total_tokens: number; iterations: number }) => void
  onDone?: (info: { iterations: number; finishReason: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number; iterations: number } }) => void
  onError?: (message: string) => void
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

const currentWs: Ref<WebSocket | null> = ref(null)
const isAgentRunning = ref(false)
const currentToolCalls: Ref<ToolCallInfo[]> = ref([])
const agentContext = ref<{ workspace: string; model: string; tools: string[] } | null>(null)
/** 当前等待用户确认的工具调用 (null 时表示无需确认) */
const pendingConfirmation = ref<PendingToolConfirmation | null>(null)
/** 当前 Agent 任务清单 (来自 agent.todo.update 事件, 供 TaskListPanel 实时渲染) */
const currentTodos: Ref<AgentTodoItem[]> = ref([])
/** 当前待用户确认的 Plan (来自 agent.plan.proposed 事件, 供 PlanReviewPanel 渲染) */
const currentPendingPlan: Ref<AgentPlan | null> = ref(null)
/** 当前累计 token 用量 (来自 agent.usage 事件, 供用量面板展示) */
const currentUsage = ref<{ prompt_tokens: number; completion_tokens: number; total_tokens: number; iterations: number }>({
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0,
  iterations: 0,
})

export function useWorkspaceAgent() {
  /**
   * 发送消息到 Agent WebSocket (工具循环)
   */
  function sendToAgent(params: SendAgentParams): void {
    // 如果已有运行中的 Agent, 先停止
    if (currentWs.value) {
      stopAgent()
    }

    // 重置状态
    isAgentRunning.value = true
    currentToolCalls.value = []
    agentContext.value = null
    pendingConfirmation.value = null
    currentTodos.value = []
    currentPendingPlan.value = null
    currentUsage.value = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, iterations: 0 }

    const wsParams: AgentChatParams = {
      prompt: params.prompt,
      modelId: params.modelId,
      workspacePath: params.workspacePath,
      userUuid: params.userUuid,
      chatId: params.chatId,
      systemPrompt: params.systemPrompt,
      maxIterations: params.maxIterations,
      allowedTools: params.allowedTools,
      onEvent: (event: AgentEvent) => handleAgentEvent(event, params),
      onError: (error: string) => {
        isAgentRunning.value = false
        params.onError?.(error)
      },
      onClose: () => {
        isAgentRunning.value = false
        currentWs.value = null
      },
    }

    currentWs.value = createAgentWebSocket(wsParams)
  }

  /**
   * 停止当前 Agent 运行
   */
  function stopAgent(): void {
    if (currentWs.value) {
      currentWs.value.close()
      currentWs.value = null
    }
    isAgentRunning.value = false
    pendingConfirmation.value = null
  }

  /**
   * 处理 Agent 事件
   */
  function handleAgentEvent(event: AgentEvent, params: SendAgentParams): void {
    switch (event.type) {
      case 'agent.context': {
        agentContext.value = {
          workspace: event.workspace || '',
          model: event.model || '',
          tools: event.tools || [],
        }
        params.onContext?.(agentContext.value)
        break
      }

      case 'agent.text.delta': {
        params.onTextDelta?.(event.content || '')
        break
      }

      case 'agent.tool.call': {
        const toolInfo: ToolCallInfo = {
          id: event.id || '',
          name: event.name || '',
          input: event.input || {},
          iteration: event.iteration,
          status: 'running',
        }
        currentToolCalls.value.push(toolInfo)
        params.onToolCall?.(toolInfo)
        break
      }

      case 'agent.tool.result': {
        const toolId = event.id || ''
        const toolInfo = currentToolCalls.value.find(t => t.id === toolId)
        if (toolInfo) {
          toolInfo.output = event.output
          toolInfo.error = event.error || undefined
          toolInfo.success = event.success
          toolInfo.blockedByHook = (event as unknown as Record<string, unknown>).blocked_by_hook === true
          // 透传 inline diff 预览信息 (对标 Cursor/Trae — write_file/edit_file/multi_edit)
          toolInfo.diffInfo = event.diff_info ?? null
          toolInfo.status = toolInfo.blockedByHook
            ? 'blocked'
            : event.success
              ? 'completed'
              : 'failed'
        }
        params.onToolResult?.(
          toolInfo || {
            id: toolId,
            name: event.name || '',
            input: {},
            output: event.output,
            error: event.error || undefined,
            success: event.success,
            iteration: event.iteration,
            diffInfo: event.diff_info ?? null,
            status: event.success ? 'completed' : 'failed',
          },
        )
        break
      }

      case 'agent.tool.confirm': {
        // default 权限模式: 后端请求用户确认是否执行该工具调用
        pendingConfirmation.value = {
          id: event.id || '',
          name: event.name || '',
          input: event.input || {},
          reason: event.reason,
          iteration: event.iteration,
        }
        break
      }

      case 'agent.error': {
        isAgentRunning.value = false
        params.onError?.(event.message || '未知错误')
        break
      }

      case 'agent.usage': {
        // Token 用量追踪 (对标 Codex/Gemini)
        const usage = event.usage || {}
        const total = event.total || {}
        currentUsage.value = {
          prompt_tokens: total.prompt_tokens || 0,
          completion_tokens: total.completion_tokens || 0,
          total_tokens: total.total_tokens || 0,
          iterations: total.iterations || 0,
        }
        params.onUsage?.(
          {
            prompt_tokens: usage.prompt_tokens || 0,
            completion_tokens: usage.completion_tokens || 0,
            total_tokens: usage.total_tokens || 0,
          },
          currentUsage.value,
        )
        break
      }

      case 'agent.done': {
        isAgentRunning.value = false
        const doneUsage = event.usage
        params.onDone?.({
          iterations: event.iterations || 0,
          finishReason: event.finish_reason || 'completed',
          usage: doneUsage ? {
            prompt_tokens: doneUsage.prompt_tokens || 0,
            completion_tokens: doneUsage.completion_tokens || 0,
            total_tokens: doneUsage.total_tokens || 0,
            iterations: doneUsage.iterations || 0,
          } : undefined,
        })
        break
      }

      case 'agent.plan.update': {
        // 上下文压缩等计划更新, 暂时不特殊处理
        break
      }

      case 'agent.plan.proposed': {
        // Plan 模式阶段1结束: Agent 提交了完整计划, 等待用户确认
        currentPendingPlan.value = (event.plan as AgentPlan) || null
        params.onPlanProposed?.(currentPendingPlan.value as AgentPlan)
        break
      }

      case 'agent.todo.update': {
        // Stage A: 任务清单更新 (供 TaskListPanel 实时渲染)
        currentTodos.value = (event.todos as AgentTodoItem[]) || []
        params.onTodoUpdate?.(currentTodos.value)
        break
      }

      case 'agent.command.result': {
        // Stage A: Slash 纯命令结果 (/help /init /clear 等)
        params.onCommandResult?.({
          command: event.command || '',
          message: event.message,
          commands: event.commands as SlashCommandResult['commands'],
        })
        break
      }

      case 'agent.command.handled': {
        // Stage A: 状态修改命令已应用 (plan/goal/compact), 继续进入 agent loop
        params.onCommandHandled?.({
          command: event.command || '',
          message: event.message,
          modify: event.modify as Record<string, unknown> | undefined,
        })
        break
      }
    }
  }

  /**
   * 清理工具调用列表
   */
  function clearToolCalls(): void {
    currentToolCalls.value = []
  }

  /**
   * 清理任务清单 (通常在新会话开始 / 用户主动清空时调用)
   */
  function clearTodos(): void {
    currentTodos.value = []
  }

  /**
   * 清理待确认的 Plan (通常在用户接受/拒绝后调用, 避免重复展示)
   */
  function clearPendingPlan(): void {
    currentPendingPlan.value = null
  }

  /**
   * 接受 Agent 提交的计划 (Stage B: Plan Mode 两阶段分离)
   * 向 WebSocket 发送 /plan-accept 消息, 后端会读取 session.pending_plan 并构造新 prompt 继续执行
   */
  function acceptPlan(extraInstructions = ''): void {
    if (!currentPendingPlan.value) {
      return
    }
    sendWsMessage({ type: 'user.message', prompt: `/plan-accept ${extraInstructions}`.trim() })
    currentPendingPlan.value = null
  }

  /**
   * 拒绝 Agent 提交的计划 (Stage B: Plan Mode 两阶段分离)
   * 向 WebSocket 发送 /plan-reject 消息, 后端清空 session.pending_plan
   */
  function rejectPlan(): void {
    if (!currentPendingPlan.value) {
      return
    }
    sendWsMessage({ type: 'user.message', prompt: '/plan-reject' })
    currentPendingPlan.value = null
  }

  /**
   * 通过 Agent WebSocket 发送消息 (仅当连接已打开时)
   */
  function sendWsMessage(message: Record<string, unknown>): void {
    if (currentWs.value && currentWs.value.readyState === WebSocket.OPEN) {
      currentWs.value.send(JSON.stringify(message))
    }
  }

  /**
   * 允许执行指定的工具调用
   * 向后端发送 tool.confirm 消息: { type: "tool.confirm", id, action: "allow" }
   */
  function confirmToolCall(id: string): void {
    sendWsMessage({ type: 'tool.confirm', id, action: 'allow' })
    pendingConfirmation.value = null
  }

  /**
   * 拒绝执行指定的工具调用
   * 向后端发送 tool.confirm 消息: { type: "tool.confirm", id, action: "deny" }
   */
  function denyToolCall(id: string): void {
    sendWsMessage({ type: 'tool.confirm', id, action: 'deny' })
    pendingConfirmation.value = null
  }

  /**
   * 本次会话全部允许: 切换到 acceptEdits 权限模式, 后续工具调用不再弹窗确认
   * 向后端发送 permission.mode 消息: { type: "permission.mode", mode: "acceptEdits" }
   */
  function allowAllInSession(): void {
    sendWsMessage({ type: 'permission.mode', mode: 'acceptEdits' })
    pendingConfirmation.value = null
  }

  return {
    isAgentRunning,
    currentToolCalls,
    agentContext,
    pendingConfirmation,
    currentTodos,
    currentPendingPlan,
    currentUsage,
    sendToAgent,
    stopAgent,
    clearToolCalls,
    clearTodos,
    clearPendingPlan,
    confirmToolCall,
    denyToolCall,
    allowAllInSession,
    acceptPlan,
    rejectPlan,
  }
}

export default useWorkspaceAgent
