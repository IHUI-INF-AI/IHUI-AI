// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端聊天消息类型契约(2026-09-12 立)。
 *
 * 来源:自 packages/shared/src/hooks/use-chat.ts 迁移。
 * 背景:该文件的 useChat hook 为死抽象(全仓零生产引用,仅 apps/mobile-rn 单测经 vitest alias
 * 指向本地 stub),W9 已删除该 hook 实现;但其中 ChatMessage / ChatRole / ToolCall 等类型被
 * apps/web、apps/extension、apps/miniapp-taro、apps/mobile-rn 真实引用,故按「跨端类型上移至
 * @ihui/types」约定迁移至本文件。
 *
 * 对外入口:@ihui/types/chat(子路径);@ihui/shared/hooks 侧保留 re-export 以兼容历史导入路径。
 *
 * 依赖类型(BaseToolCall / ToolCallSummary / PlanStep / TerminalTask / SubAgentActivity)
 * 已存在于 ./ai,此处仅 import 复用,不重复定义。
 */
import type * as React from 'react'
import type {
  BaseToolCall as TypesBaseToolCall,
  ToolCallSummary,
  SubAgentActivity,
  PlanStep,
  TerminalTask,
} from './ai'

/**
 * 消息角色
 */
export type ChatRole = 'user' | 'assistant' | 'system'

/**
 * 工具调用基础类型(各端可扩展端独占字段)。
 *
 * 继承 @ihui/types/ai 的 BaseToolCall(2026-07-31 立,AI 对话可视化深度接入),
 * 自动获得 serverSource / serverId / serverName / durationMs / isError 等跨端字段。
 *
 * 各端扩展示例:
 * ```ts
 * import type { ToolCall as BaseToolCall } from '@ihui/types/chat'
 * interface WebToolCall extends BaseToolCall { diffInfo?: ...; applyStatus?: ... }
 * ```
 */
export interface ToolCall extends TypesBaseToolCall {
  /** 工具调用参数(收窄 BaseToolCall.args 为必填,保持原 ToolCall 契约向后兼容) */
  args: Record<string, unknown>
  /** @deprecated 旧字段,新代码用 BaseToolCall.durationMs;向后兼容保留 */
  duration?: number
  /** 工具调用错误信息(端独占,与 BaseToolCall.isError 互补) */
  error?: string
  /** image_generation 工具返回的图片 URL(data URI 或 https URL) */
  image_url?: string
}

/**
 * 跨端共享的 BaseToolCall re-export(2026-07-31 立)。
 * 各端可从 @ihui/types/chat 或 @ihui/types/ai 任一处 import,语义一致。
 */
export type BaseToolCall = TypesBaseToolCall

/**
 * 聊天消息基础类型(各端可扩展)。
 *
 * 各端扩展示例:
 * ```ts
 * import type { ChatMessage as BaseChatMessage } from '@ihui/types/chat'
 * interface WebChatMessage extends Omit<BaseChatMessage, 'createdAt'> {
 *   createdAt: number  // 端独占:必填
 *   question?: PendingQuestion  // 端独占字段
 * }
 * ```
 */
export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  /** 2026-09-13 立,W16 消息树地基:父消息 id。
   *  线性会话中 = 前一条消息;重新生成/编辑重跑时 = 触发的用户消息。
   *  W17 Fork(消息分叉)与编辑历史追溯将基于此字段扩展为真正的消息树。 */
  parentMessageId?: string
  /** 创建时间戳(ms),用于排序 + 分享 */
  createdAt?: number
  /** 生成该消息所用模型 ID(assistant 消息) */
  model?: string
  /** 该消息是否有错误(错误文本写入 content) */
  error?: boolean
  /**
   * D92/D71②:产生该错误消息的后端 `errorCode`(ai-service / api 的业务错误码)。
   * 只作**分类输入**,渲染侧一律经 `view-failure-taxonomy` 归类后再取词;
   * 缺失时归 unknown 回落态,不得据此猜因。
   */
  errorCode?: string
  /** 推理过程文本(reasoning model 输出) */
  reasoning?: string
  /** 工具调用列表(SSE tool-call 事件累加) */
  toolCalls?: ToolCall[]
  /** 工具调用汇总(2026-07-31 立,SSE tool-summary 事件聚合结果;缺失时前端可从 toolCalls 本地降级聚合) */
  toolCallSummary?: ToolCallSummary
  /** 整条消息耗时 ms(2026-07-31 立,从 streamChat 开始到 done;仅 assistant 流式消息有意义) */
  totalDurationMs?: number
  /** 2026-09-13 立,批次 2 #16:消息级运行时长精确追踪
   * - startedAt:流开始时间戳 ms(epoch)
   * - durationMs:流总耗时 ms(与 totalDurationMs 等价,用于 UI 展示层语义区分)
   * - toolCallCount:工具调用总数(含失败;不含子 agent 内部工具) */
  startedAt?: number
  durationMs?: number
  toolCallCount?: number
  /** 服务端落库的消息元数据(G-165:ai-callback 侧按 workspace_permissions 反查盖章的
   *  permissionMode 等随历史接口原样下发;客户端自报不采信 —— 缺失 = 老消息/未绑定
   *  工作区,安静降级,不得据此编造 default)。结构对齐 api-client ChatMessageMetadata。 */
  metadata?: Record<string, unknown>
  /** 2026-07-31 立,AI 对话可视化深度接入 Phase 2:消息级 subagent 工作内容
   *  - 后端 subagent_spawn/progress/end SSE 事件携带 messageId 时,前端按消息分组写入
   *  - 用于在消息气泡内 inline SubagentSection,实时刷新 subagent 生命周期 */
  subagentActivities?: SubAgentActivity[]
  /** 2026-07-31 立,Phase 2:消息级 plan steps
   *  - 后端 plan_updated SSE 事件携带 messageId 时,前端写入对应消息
   *  - 用于在消息气泡内 inline PlanStepsCard */
  planSteps?: PlanStep[]
  /** 2026-07-31 立,Phase 2:消息级 terminal tasks
   *  - 后端 terminal_start/end SSE 事件携带 messageId 时,前端写入对应消息
   *  - 用于在消息气泡内 inline TerminalTaskSection */
  terminalTasks?: TerminalTask[]
  /** 消息级引用溯源列表(2026-09-13 立,#11 Citations 全链路)。
   *  后端 knowledge_lookup 工具执行后,在 done 前下发 citations SSE 事件,
   *  前端按 messageId 写入本字段,MessageItem 渲染 CitationBar。 */
  citations?: Array<{ source: string; label: string; url?: string }>
  /** 本轮上下文注入交代(D34,2026-09-22 立):后端在注入**真正生效后**、任何增量之前
   *  下发 injection_applied 帧,前端按 messageId 追加到本字段,MessageItem 渲染 InjectionBar。
   *  没有它,用户无法知道回答带了哪些私有上下文(竞品以此为可审计性的基本交代)。 */
  injections?: Array<{ kind: string; collapsed: string; fullText?: string; count?: number }>
  /** D39/D108 上游重试交代:网关换 key 或退避重试时下发 retry_scheduled 帧。
   *  没有它,用户在 web 上看到的只是"停顿"(小程序 / RN / cli 均已交代,旗舰端此前缺席)。 */
  retryNotice?: { attempt: number; maxRetries: number; retryInMs: number; httpStatus?: number }
  /** D106 中途引导交代(2026-09-24 立):steer SSE 帧(phase=injected)按 messageId 累积,
   *  渲染"引导已生效"badge。单消息 8 条封顶(对齐后端 _STEER_QUEUE_LIMIT)。 */
  steerNotices?: Array<{ phase: 'injected'; text: string; timestamp?: string; messageId?: string }>
  /** 附加元数据(各端自定义,如 agentId / tokens 等) */
  meta?: Record<string, unknown>
}

/**
 * sendMessage 参数
 */
export interface SendMessageParams {
  /** 模型 ID */
  model: string
  /** 用户输入文本 */
  text: string
  /** 可选 systemPrompt(智能体场景) */
  systemPrompt?: string
  /** 可选上下文 limit(各端调 getModelContextCapacity 注入) */
  contextLimit?: number
  /** 可选附加 meta(写入 user 消息的 meta 字段) */
  meta?: Record<string, unknown>
}

/**
 * streamRunner 的 API 消息格式(传给后端)
 */
export interface ApiChatMessage {
  role: ChatRole
  content: string
}

/**
 * streamRunner 回调集合
 */
export interface StreamRunnerCallbacks {
  /** 收到 delta 时追加到 assistant 消息 */
  onDelta: (delta: string) => void
  /** 流错误 */
  onError: (err: unknown) => void
  /** 流完成 */
  onDone: () => void
  /** 上下文压缩通知(各端按需实现,如 miniapp-taro 用 Taro.showToast) */
  onCompaction?: (info: { tokensBefore: number; tokensAfter: number; removedCount: number }) => void
  /** 中途引导注入确认(2026-09-19 立,Steer 全链路):
   *  用户经 steer 端点中途注入引导文本,ai-service 在 tool loop 边界将其注入
   *  messages 后下发 steer SSE 事件,api-client streamChat 解析为 onSteer 回调。
   *  载荷形状与 @ihui/api-client 的 SteerEvent 严格对齐(此处内联定义,
   *  避免 @ihui/types → @ihui/api-client 反向依赖)。 */
  onSteer?: (event: {
    /** 当前仅 "injected"(已注入 messages);预留扩展 */
    phase: 'injected'
    /** 用户引导文本(注入 messages 的原文) */
    text: string
    /** 入队时间(ISO,来自 steer 端点) */
    timestamp?: string
    /** 所属 assistant 消息 ID(便于前端挂 badge) */
    messageId?: string
  }) => void
}

/**
 * streamRunner 参数
 */
export interface StreamRunnerParams {
  model: string
  /** API 消息(含历史 + 当前用户消息,不含 assistant 占位) */
  apiMessages: ApiChatMessage[]
  /** AbortSignal(用于 stopStreaming) */
  signal: AbortSignal
  /** 上下文 limit(可选) */
  contextLimit?: number
  /** 回调集合 */
  callbacks: StreamRunnerCallbacks
}

/**
 * useChat 配置项(仅类型契约保留,useChat hook 实现已随 W9 删除;各端可据此实现本端 hook)
 */
export interface UseChatOptions {
  /** 流式发送函数(各端注入 streamChat 桥接) */
  streamRunner: (params: StreamRunnerParams) => Promise<void>
  /** 错误格式化(可选,默认 String(err)) */
  formatError?: (err: unknown) => string
  /** 是否在 onError 时自动清空 assistant 占位消息(默认 false,保留占位 + 填充错误信息) */
  clearAssistantOnError?: boolean
}

/**
 * useChat 返回值(仅类型契约保留)
 */
export interface UseChatReturn<TMessage extends ChatMessage = ChatMessage> {
  /** 消息列表 */
  messages: TMessage[]
  /** 是否正在流式响应 */
  isStreaming: boolean
  /** 错误信息(流错误时设置) */
  error: string | null
  /** 发送消息(自动添加 user + assistant 占位,启动流) */
  sendMessage: (params: SendMessageParams) => Promise<void>
  /** 停止流式(abort) */
  stopStreaming: () => void
  /** 清空所有消息 */
  clearMessages: () => void
  /** 手动设置 messages(各端持久化恢复 / 历史加载用) */
  setMessages: React.Dispatch<React.SetStateAction<TMessage[]>>
  /** 手动设置 error */
  setError: (err: string | null) => void
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
