// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { ssrStorage } from './persist-helpers'
import { createChatPersistStorage } from '@/lib/chat-persist-crypto'
import type { SubAgentActivity, InlineDiffInfo } from '@/components/ai/types'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'
import type {
  SubagentSpawnEvent,
  SubagentEndEvent,
  SubagentProgressEvent,
  FallbackEvent,
} from '@ihui/api-client'
import type { ChatMessage as BaseChatMessage, ToolCall as BaseToolCall } from '@ihui/shared'
import { markStreamError } from '@ihui/shared/chat'
import type { FollowUpMode } from '@ihui/shared/chat/queue-interactions'
import type { ToolCallSummary, PlanStep, TerminalTask, CitationEntry } from '@ihui/types/ai'

export type { ChatRole } from '@ihui/shared'

/** Inline Diff Apply 状态:pending=待确认 / applying=应用中 / applied=已应用 / rejected=已拒绝 / error=应用失败 */
export type DiffApplyStatus = 'pending' | 'applying' | 'applied' | 'rejected' | 'error'

/** 终端实时输出缓冲的键数上限(2026-09-18):超出按插入序淘汰最旧 terminalId,防长会话累积 */
const TERMINAL_OUTPUT_MAX_KEYS = 20

/** Steer(中途引导)单消息注入确认上限(2026-09-19):对齐 ai-service llm.py 的
 * _STEER_QUEUE_LIMIT(8 条/流),后端队列拒绝在前,此为前端展示侧双保险。 */
const STEER_NOTICE_MAX_PER_MESSAGE = 8

/**
 * Diff 评审意见(P3 #30 diff 评论驱动返工,2026-09-16 立,对标 Codex diff 评论)。
 *
 * 用户在 InlineDiffCard 上对某文件/某行留下的评审意见,暂存于 store,
 * 下一轮用户发消息时由 lib/diff-comments.ts 格式化为 `<diff_review>` 块
 * 定向注入 agent 上下文(仅影响发给 LLM 的内容,不污染用户消息气泡)。
 * 注入成功后清空(消费即清),避免重复注入同一批意见。
 */
export interface DiffComment {
  id: string
  /** 被评论文件路径(diff 卡片的 file_path) */
  filePath: string
  /** 关联的 diff 新文件侧行号;undefined = 文件级评论 */
  line?: number
  /** 被评论行的代码内容(截断后注入,给 agent 更精确的定位上下文) */
  lineText?: string
  /** 评审意见正文 */
  comment: string
  /** 来源工具调用 id(便于回溯是哪次改动) */
  toolCallId?: string
  createdAt: number
}

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
  /** L5-8 工具瞬时失败自动重试次数(>0 时 ToolCallCard 渲染"重试N次"徽章)。
   * 数据源:后端 tool-call-start/result 事件携带则透传;暂未下发时恒 undefined,徽章不显示。 */
  retryCount?: number
}

/** 消息级 Token 用量与计时/计费(D1 消息级计量徽章,2026-09-19 立)。
 * 由 SSE usage 帧经 onUsage 回调写入(后端 streamChat 流末尾下发,或并发会话落地的
 * event:usage 帧)。独立于 message.meta.usage(旧 hover 徽章),承载更丰富的
 * 首 token 计时 / 总耗时 / 推理 token / 成本字段,驱动消息底部徽章行渲染。 */
export interface MessageUsage {
  totalTokens: number
  promptTokens: number
  completionTokens: number
  /** 推理 token( reasoning 模型才有;非推理模型后端给 null) */
  reasoningTokens: number | null
  /** 首 token 延迟(ms):从请求发出到首个内容 token 到达 */
  firstTokenMs: number
  /** 总生成耗时(ms):从请求发出到流结束 */
  durationMs: number
  /** 实际计费模型标识(可能区别于前端选的 'auto') */
  model: string
  /** 本次消息成本(USD);后端未计费给 null */
  costUsd: number | null
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

/** 消息级上下文压缩信息(2026-09-19 立,协议清理/孤儿组件接线)。
 * 上下文压缩发生时(AgentLoopV2 hook 总线 → 网关 compaction 命名帧 →
 * client.ts onCompaction 回调),send-message 把压缩统计挂到当前 assistant 消息,
 * MessageItem 渲染 CompressionDivider("上方历史已被压缩"分隔线)。 */
export interface MessageCompaction {
  /** 压缩前上下文 token 数 */
  originalTokens: number
  /** 压缩后上下文 token 数 */
  compressedTokens: number
  /** 被压缩(折叠为摘要)的历史消息条数 */
  removedCount?: number
  /** 压缩触发方式(ratio/absolute/truncated/incompressible) */
  trigger?: string
}

/** Steer(中途引导)注入确认记录(2026-09-19 立)。
 * 流式期间用户点闪电按钮 → steerChatStream 端点入队 → ai-service tool loop
 * 每轮 LLM 调用前 drain 注入 messages 时经 SSE steer 事件回传确认,
 * 由 onSteer 回调写入 store,MessageItem 渲染「⚡ 引导已生效」badge。 */
export interface SteerNotice {
  /** 用户引导文本(注入 messages 的原文,≤4000 字符) */
  text: string
  /** 入队时间(ISO,来自 steer 端点) */
  timestamp?: string
}

/**
 * D28 快速侧问队列条目(2026-09-20 立,对标 Claude Code /btw 侧聊的「可排队」升级)。
 * 流式期间输入的 /side 问题先入队暂存,流结束后由 message-input.tsx 逐条出队
 * 调 answerSideQuestion 补答(直调 REST,回答不入主线历史,同 W24 /btw)。
 */
export interface SideQueueItem {
  id: string
  /** 用户侧问正文(已 trim) */
  text: string
  /** 入队时间戳(Date.now()) */
  createdAt: number
}

/**
 * D60 发送可靠性状态族(2026-09-23 立):
 * persistMessageSafe 把持久化失败归一化为这四态,调用方(输入框/重试按钮)据此渲染。
 * - failed_retryable:网络/5xx 等可重试失败,草稿保留 + 可重发
 * - idempotent_conflict:幂等键已存在但内容与当前输入不一致,请作为新消息发送
 * - archived:会话已归档,无法继续发送(草稿保留,取消归档后可重发)
 * - deleted:会话/任务已删除(404),无法继续发送(草稿保留,需新建会话)
 */
export type SendReliabilityStatus =
  'failed_retryable' | 'idempotent_conflict' | 'archived' | 'deleted'

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
  /** P1-6 断点续传(2026-09-13 立):该助手消息的流是否已完整结束。
   *  false = 中断未完成(刷新页面后可自动续接);true/undefined = 已完成,不续接。 */
  streamCompleted?: boolean
  /** 2026-09-19 立:该消息生成前发生的上下文压缩统计(结构见 MessageCompaction)。
   *  compaction 命名帧 → onCompaction 回调写入;MessageItem 在消息内容区顶部
   *  渲染 CompressionDivider,提示"本消息之前的上下文已压缩为摘要"。 */
  compaction?: MessageCompaction
  /** D33(2026-09-23 立):该回答实际**换过模型**的交代(主模型失败→备用模型)。
   *  live:顶部 FallbackBanner(瞬态);历史:metadata.fallback(snake)经水合换算挂到消息,
   *  MessageItem 按既有 chat.fallbackNotice / fallbackNoticeQuota 词渲染消息级交代行。
   *  缺失 = 本轮未降级或老消息 —— 不渲染。 */
  fallback?: FallbackEvent
}

/** 自动压缩上下文状态(2026-08-16 立)
 *  null = 无压缩
 *  { phase: 'compacting' } = 压缩中
 *  { phase: 'done', tokensBefore, tokensAfter, removedCount, trigger? } = 压缩完成
 *  trigger: 压缩触发方式(2026-09-01 立,ratio/absolute/truncated/incompressible),
 *           truncated = 超长单条消息截断降级,前端据此展示专属提示 */
export type CompactionStatus =
  | { phase: 'compacting' }
  | {
      phase: 'done'
      tokensBefore: number
      tokensAfter: number
      removedCount: number
      trigger?: string
    }
  | null

interface ChatState {
  messages: ChatMessage[]
  currentModel: string
  isStreaming: boolean
  error: string | null
  /** 当前绑定的会话 ID；为 null 表示新会话尚未持久化 */
  conversationId: string | null
  /** 用户是否已手动向上滚动(暂停自动滚动到底部) */
  userScrolledUp: boolean
  /** 模板选择等外部输入填充值；MessageInput 消费后置 null */
  draftInput: string | null
  /** 外部触发(如首页「立即体验」CTA)预填后是否自动发送;MessageInput 消费后置 false。
   * 不持久化:仅作为本次交互的瞬时指令,刷新后不重放发送。 */
  draftAutoSend: boolean
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
  /** 自动压缩上下文状态(2026-08-16 立):
   *  null = 无压缩
   *  { phase: 'compacting' } = 压缩中
   *  { phase: 'done', tokensBefore, tokensAfter, removedCount } = 压缩完成 */
  compactionStatus: CompactionStatus
  /** P1 #27 记忆更新可视化(2026-09-16 立):本轮对话各助手消息的「已记住」提示条数据,
   *  键 messageId 对应 assistant 消息,items 为该消息触发的新增长期记忆条目摘要。
   *  done 事件携带 memoryUpdates 时由 appendMemoryNotice 写入;MessageItem 按 message.id 查找渲染。 */
  memoryUpdateNotices: { messageId: string; items: string[] }[]
  /** P3 #30 diff 评论驱动返工(2026-09-16 立):用户在 diff 卡片上留下的待发送评审意见队列。
   *  下一轮 sendMessage 时格式化为 `<diff_review>` 块定向注入 agent 上下文,注入后清空。
   *  持久化:评论可能跨刷新保留(用户评论后切走再回来仍可发送),故纳入 partialize。 */
  pendingDiffComments: DiffComment[]
  /** 终端命令实时输出缓冲(2026-09-18 立,对标 Codex 实时 stdout 行流):
   *  键 = terminalId(与 terminal_start/terminal_end 一致),值 = 命令执行期间累积的增量文本。
   *  由 send-message.ts 的 onTerminalDelta 回调写入,ToolCallCard/TerminalSection 实时回显。
   *  terminal_end 后**保留**该键:live 缓冲通常比 terminal_end.output(后端截 8000 字符)更完整,
   *  终态渲染取更长者;内存以「单键 2 万字符 + 最多 20 个终端键(插入序淘汰最旧)」双重封顶,
   *  新建对话时随 clearMessages 清空。不持久化(执行期瞬时态,刷新即失效)。 */
  terminalOutputs: Record<string, string>

  /** D1 消息级计量(2026-09-19 立):按 messageId 索引的 Token 用量/计时/成本。
   * 由 onUsage 回调写入,驱动消息底部徽章行(1.2k tok · 3.4s · 首 0.8s · model · ¥0.01)。
   * 不持久化(每轮流式重新计算,刷新后失效)。 */
  usageByMessageId: Record<string, MessageUsage>

  /** Steer(中途引导,2026-09-19 立):按 messageId 索引的引导注入确认记录。
   * SSE steer 事件(injected)由 onSteer 回调经 appendSteerNotice 累积写入,
   * MessageItem 按 message.id 订阅渲染「⚡ 引导已生效」badge。
   * 单消息上限对齐后端 _STEER_QUEUE_LIMIT(8 条);不持久化(执行期瞬时态)。 */
  steerNoticesByMessageId: Record<string, SteerNotice[]>
  /** Steer(中途引导):当前流式 assistant 消息 ID(steer 端点凭 conversationId+messageId
   *  在网关定位 upstream 会话)。流开始由 send-message/send-answer 写入,收尾清空。 */
  streamingAssistantId: string | null

  /** D22 引用回复(2026-09-19 立,对标 Qoder 0.2.x):待引用回复的消息快照。
   *  MessageItem Reply 按钮 → ihui:reply-message → MessageList 监听写入;
   *  MessageInput 渲染引用 chip,doSend 发送时把引用摘要注入正文,成功后 clearQuotedMessage。
   *  不持久化(执行期瞬时态,刷新后需重新点 Reply)。 */
  quotedMessage: { id: string; role: ChatMessage['role']; content: string } | null

  /** D22 网页搜索 UI 开关(2026-09-19 立):开启后普通问答(未选插件工具)也携带
   *  web_search 最小工具集,mergeAgentTools() 消费;与 selectedTools 互不替代。
   *  持久化(用户偏好,跨刷新保留)。 */
  webSearchEnabled: boolean

  /** D28 快速侧问(2026-09-20 立):按会话分桶的侧问 FIFO 队列。
   *  流式期间输入的 /side 问题入队当前会话桶,流结束后由 message-input.tsx
   *  逐条出队补答;非流式时 /side 直接即答不入队。
   *  按会话分桶:切换会话后其他会话的队列仍保留,切回可继续补答。
   *  持久化:排队问题跨刷新保留(用户排队后刷新再回来仍可补答),故纳入 partialize。 */
  sideQueueByConversation: Record<string, SideQueueItem[]>

  /** D60 发送可靠性草稿保全(2026-09-23 立):最近一次持久化失败时保留的用户输入正文。
   *  只增字段:不参与既有消息/草稿(draftInput)语义;输入框读取后由 clearFailedDraft 消费。
   *  null = 无待恢复草稿。持久化(跨刷新不丢,见 partialize)。 */
  failedDraft: string | null
  /** D60:failedDraft 对应的失败状态(见 SendReliabilityStatus);null = 无失败态 */
  failedDraftStatus: SendReliabilityStatus | null

  /** 设置引用回复目标(null=清除,输入区引用 chip 随之消失) */
  setQuotedMessage: (q: { id: string; role: ChatMessage['role']; content: string } | null) => void
  /** 设置网页搜索开关(同步 localStorage 'ihui_web_search_enabled' 供 SSR 前恢复) */
  setWebSearchEnabled: (v: boolean) => void

  setModel: (model: string) => void
  /** 添加单个工具到已选;已存在则忽略 */
  addSelectedTool: (pluginId: string) => void
  /** 从已选移除单个工具 */
  removeSelectedTool: (pluginId: string) => void
  /** 清空已选工具 */
  clearSelectedTools: () => void
  addMessage: (
    msg: Pick<ChatMessage, 'role' | 'content' | 'model' | 'permissionMode' | 'meta'>,
  ) => string
  appendToMessage: (id: string, delta: string) => void
  appendReasoningToMessage: (id: string, delta: string) => void
  setMessageError: (id: string, error: string, errorCode?: string) => void
  clearMessages: () => void
  setStreaming: (v: boolean) => void
  setError: (e: string | null) => void
  setConversationId: (id: string | null) => void
  /** 设置用户是否向上滚动(由 MessageList scroll handler 调用) */
  setUserScrolledUp: (v: boolean) => void
  /** MessageInput 消费 draftInput 后调用,置 null 避免重复填充 */
  clearDraftInput: () => void
  /** MessageInput 消费 draftAutoSend 后调用,置 false 避免重复触发自动发送 */
  clearDraftAutoSend: () => void
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
  /** Subagent 自动派发生成(2026-07-28 立,对标 AI 工作台):
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
  /** #14 Diff 文件级批量状态(2026-09-13 立):消息内所有待决 diff 卡整体置为 status */
  setAllDiffApplyStatus: (messageId: string, status: DiffApplyStatus) => void
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
  /** #11 Citations 全链路(2026-09-13 立):写入消息级引用溯源(SSE citations 事件)
   *  - 后端 knowledge_lookup 工具执行后 done 前下发,前端整体替换 message.citations
   *  - 用于消息气泡内 inline CitationBar(来源标签 + 可点击 URL) */
  setMessageCitations: (messageId: string, citations: CitationEntry[]) => void
  /** D34 上下文注入交代(2026-09-22 立):把 injection_applied 帧追加到消息级 injections。
   *  **追加而非整体替换**:一条流可能下发多帧(自定义指令 / AGENTS.md / Repo Wiki / 检索上下文各一帧),
   *  并按 kind+collapsed 去重(后端重连或补发时不得出现重复行)。 */
  appendMessageInjection: (
    messageId: string,
    injection: { kind: string; collapsed: string; fullText?: string; count?: number },
  ) => void
  /** D39/D108 上游重试交代(retry_scheduled 命名帧):整体替换为**最近一次**重试(第 N 次递增,
   *  旧的"第 1 次"没有继续显示的价值),MessageItem 据此渲染一行提示。 */
  setMessageRetryNotice: (
    messageId: string,
    notice: { attempt: number; maxRetries: number; retryInMs: number; httpStatus?: number },
  ) => void
  /** 2026-09-19 立:写入消息级上下文压缩信息(compaction 命名帧 → onCompaction 回调)。
   *  压缩发生时把统计挂到指定 assistant 消息,MessageItem 渲染 CompressionDivider。 */
  setMessageCompaction: (messageId: string, compaction: ChatMessage['compaction']) => void
  /** P1 #27 记忆更新可视化(2026-09-16 立):后端 done 事件 payload 携带 memoryUpdates,
   *  由 send-message.ts onMemoryUpdates 回调调用,把本轮新增的长期记忆条目摘要挂到对应助手消息。
   *  存储为 store 级数组(键 messageId),MessageItem 按 message.id 过滤渲染「已记住」提示条。 */
  appendMemoryNotice: (messageId: string, items: string[]) => void
  /** P3 #30 diff 评论驱动返工(2026-09-16 立):新增一条 diff 评审意见(入待发送队列)。
   *  同 filePath+line+comment 完全重复时忽略(防重复提交)。 */
  addDiffComment: (comment: Omit<DiffComment, 'id' | 'createdAt'>) => void
  /** 按 id 删除单条 diff 评审意见(用户在评论列表点删除) */
  removeDiffComment: (id: string) => void
  /** 清空全部待发送 diff 评审意见(注入成功后消费即清,或用户手动清空) */
  clearDiffComments: () => void
  /** D28 快速侧问(2026-09-20 立):把 /side 问题入队到指定会话桶(队尾,FIFO)。
   *  conversationId 为空或文本为空时静默忽略;入队前 trim。 */
  enqueueSideQuestion: (conversationId: string, text: string) => void
  /** D28 快速侧问:按 id 从指定会话桶删除单条侧问(队列条目「删除」时调用);
   *  桶删空后移除该键,避免持久化残留空桶。 */
  removeSideQuestion: (conversationId: string, id: string) => void
  /** D28 快速侧问:出队指定会话桶的队首一条(流结束自动补答时调用);桶空返回 null */
  shiftSideQuestion: (conversationId: string) => SideQueueItem | null
  /** D38 队列语义完整交互(2026-09-24 立,对标 Codex followUpQueueMode)四动作。
   *  **W27 纪律**:只作用于尚未消费的队列项(重排/移除/编辑),队首选择逻辑
   *  (shiftSideQuestion + message-input.tsx 流结束 effect + use-message-send.ts 短路)一行不动。 */
  /** D38:重排指定会话桶的队列项(fromIndex → toIndex,先摘后插);越界/同位为 no-op */
  requeue: (conversationId: string, fromIndex: number, toIndex: number) => void
  /** D38:按 id 移除队列项(队列条「撤回」入口;语义同 removeSideQuestion,供交互条独立调用) */
  removeQueued: (conversationId: string, id: string) => void
  /** D38:编辑队列项文本(只改 text,createdAt 元数据不动);找不到/trim 空为 no-op */
  editQueued: (conversationId: string, id: string, text: string) => void
  /** D38:「打断并执行」预备:读取并移除队首项后返回,**不负责停流** ——
   *  调用方先经 W2 abort 通道停止当前流,再以返回项发起发送;桶空返回 null(队列不动) */
  interruptAndRun: (conversationId: string) => SideQueueItem | null
  /** D38:队列模式偏好(对标 Codex followUpQueueMode),默认 'queue'(排队优先)。
   *  steer 请求在 Runtime 不支持插话时由渲染层 `effectiveMode` 降级为 queue 执行,
   *  偏好本身保留用户选择;判定唯一入口 @ihui/shared/chat/queue-interactions。 */
  followUpQueueMode: FollowUpMode
  /** D38:setMode 动词落点(恒可切,无许可门;同值 no-op 不产生新状态) */
  setFollowUpQueueMode: (mode: FollowUpMode) => void
  /** D60 发送可靠性草稿保全(2026-09-23 立):写入失败保留草稿 + 状态;draft 为 null 时清空 */
  setFailedDraft: (draft: string | null, status?: SendReliabilityStatus | null) => void
  /** D60:清空失败保留草稿(输入框消费恢复后调用) */
  clearFailedDraft: () => void
  /** 终端实时输出追加(2026-09-18 立):命令执行期间逐块追加 stdout/stderr 增量。
   *  单键累计上限 20000 字符(超出保留尾部),避免长命令把 localStorage/内存撑爆。 */
  appendTerminalOutput: (terminalId: string, text: string) => void
  /** 清理指定终端任务的实时输出缓冲(terminal_end 到达时调用,终态交给 terminal.output) */
  clearTerminalOutput: (terminalId: string) => void
  /** D1 消息级计量(2026-09-19 立):写入某条助手消息的 usage 数据(onUsage 回调触发)。
   * messageId 为空时调用方已回退到当前流式消息 id。同名 id 直接覆盖(流末只到达一次)。 */
  setMessageUsage: (messageId: string, usage: MessageUsage) => void
  /** Steer(中途引导,2026-09-19 立):追加某条助手消息的引导注入确认(SSE steer 事件触发)。
   * 单消息上限 8 条(对齐后端 _STEER_QUEUE_LIMIT),超出静默丢弃。 */
  appendSteerNotice: (messageId: string, notice: SteerNotice) => void
  /** Steer(中途引导):登记/清空当前流式 assistant 消息 ID(流开始写入,收尾清空) */
  setStreamingAssistantId: (id: string | null) => void
  /** P1 token 用量写入消息 meta(2026-08-15 立):后端 SSE 流末尾发送 usage chunk,
   *  前端 onUsage 回调调用此方法把 usage 写入 assistant 消息 meta.usage,UI 展示 token 计数。 */
  updateMessageMeta: (messageId: string, meta: Record<string, unknown>) => void
  /** 替换整个消息列表(用于自动压缩后同步后端压缩结果) */
  setMessages: (messages: ChatMessage[]) => void
  /** 编辑用户消息内容(2026-09-12 立,四竞品对标 P0-1):只改内容不改时间线,配合 truncateMessagesFrom 使用 */
  editMessageContent: (messageId: string, content: string) => void
  /** 截断消息列表:删除指定消息及其之后的所有消息(重新生成用,保留该消息之前的历史) */
  truncateMessagesFrom: (messageId: string) => void
  /** 截断消息列表:保留指定消息,删除其之后的所有消息(2026-09-12 立,编辑重跑用) */
  truncateMessagesFromAfter: (messageId: string) => void
  /** 设置自动压缩状态(用于在对话框底部显示压缩进度) */
  setCompactionStatus: (status: CompactionStatus) => void
  /**
   * P1-6 断点续传(2026-09-13 立):标记助手消息流是否已完整结束。
   * false = 流被中断(刷新页面/网络抖动),刷新后由 resume-stream 自动续接;
   * true  = 正常收尾(done/error/用户 stop),不再续接。
   * 未定义 = 旧消息(视为已完成)。
   */
  setMessageStreamCompleted: (messageId: string, completed: boolean) => void
  /** #21 中断后追加指令继续(2026-09-13 立):被用户主动 Stop 中断的 assistant 消息 ID。
   *  null = 无中断;非 null = 输入框上方显示「追加指令继续」提示条 + 一键继续按钮。
   *  用户发送新消息或点击继续后由 send-message.ts 清空。 */
  setInterruptedMessage: (id: string | null) => void
  /** #21 中断后追加指令继续(2026-09-13 立):被中断的 assistant 消息 id,null=无 */
  interruptedMessageId: string | null
  /** #23 撤回未执行工具卡(2026-09-13 立,对标 Trae 错误重试撤回):
   *  流收尾(报错/中断/超时)时,把该消息中所有仍处 running 状态的工具卡
   *  置为 cancelled(后端未返回 tool-result,不会再执行)。 */
  revokePendingToolCalls: (messageId: string) => void
  /** W27 输入历史(2026-09-14 立,对标 Codex CLI Esc+Esc 历史导航):
   *  最近发送的消息正文(纯文本,不含附件 markdown),去重、最新在后、上限 50 条。 */
  inputHistory: string[]
  /** W27 写入输入历史(发送成功后由 useMessageSend.doSend 调用);去重 + 上限 50 */
  pushInputHistory: (text: string) => void
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
    (set, get) => ({
      messages: [],
      // 2026-08-06 立:默认值改为 'auto',与 model-selector.tsx 的 AUTO_OPTION 一致,
      // 体现"零配置即可用"理念,后端 llm_gateway 会自动选最优模型。
      // 历史:step-router-v1 是 Step 厂家路由(仅 Step 内部),违背"自动切换所有可用模型"语义。
      currentModel: 'auto',
      isStreaming: false,
      error: null,
      conversationId: null,
      userScrolledUp: false,
      draftInput: null,
      draftAutoSend: false,
      pendingQuestion: null,
      subAgentActivities: [],
      selectedTools: [],
      recentMessages: null,
      compactionStatus: null,
      // P1 #27 记忆更新可视化(2026-09-16 立)
      memoryUpdateNotices: [],
      pendingDiffComments: [],
      // 2026-09-18 终端实时输出缓冲(执行期瞬时态,不持久化)
      terminalOutputs: {},
      // D1 消息级计量(执行期瞬时态,不持久化)
      usageByMessageId: {},
      // Steer(中途引导)注入确认 + 当前流式 assistant 消息 ID(执行期瞬时态,不持久化)
      steerNoticesByMessageId: {},
      streamingAssistantId: null,
      // D22 引用回复(执行期瞬时态,不持久化)
      quotedMessage: null,
      // D22 网页搜索开关:SSR 安全惰性读取(服务端恒 false;客户端 store 创建早于组件 hydration,
      // 首渲染即恢复用户偏好,与 partialize 持久化路径互为双保险)
      webSearchEnabled:
        typeof window !== 'undefined' && localStorage.getItem('ihui_web_search_enabled') === '1',
      // #21 中断后追加指令继续(2026-09-13 立)
      interruptedMessageId: null,
      // W27 输入历史(2026-09-14 立):Esc+Esc 历史导航数据源
      inputHistory: [],
      // D28 快速侧问(2026-09-20 立):按会话分桶的侧问 FIFO 队列(持久化,见 partialize)
      sideQueueByConversation: {},
      // D38 队列交互模式偏好(2026-09-24 立):默认排队优先;steer 在 Runtime 不支持插话时
      // 由渲染层 effectiveMode 降级为 queue 执行,偏好保留(持久化,见 partialize)
      followUpQueueMode: 'queue',
      // D60 发送可靠性草稿保全(2026-09-23 立):失败保留草稿(执行期 + 持久化,见 partialize)
      failedDraft: null,
      failedDraftStatus: null,

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
          // W24(2026-09-14):透传附加元数据(/btw 侧聊标记 meta.sidechat 等)
          meta: msg.meta,
        }
        set((s) => {
          // W16(2026-09-13):消息树地基 —— 新消息自动指向前一条消息(parentMessageId)。
          // 截断重跑(regenerate/edit-rerun)场景下截断后末尾即触发消息,天然形成正确父子链,
          // 为 W17 Fork 与编辑历史追溯提供数据结构支撑。
          const prev = s.messages[s.messages.length - 1]
          const full: ChatMessage = { ...message, parentMessageId: prev?.id }
          const messages = s.messages.concat(full)
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

      setMessageError: (id, error, errorCode) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === id)
          if (idx === -1) return { error }
          const target = s.messages[idx]
          if (!target) return { error }
          const next = s.messages.slice()
          // D92:把后端 errorCode 一并落到消息上,渲染侧才能走统一分类表取词
          next[idx] = markStreamError(target, error, errorCode)
          return { messages: next, error }
        }),

      /** 标记助手消息的流完成态(P1-6 断点续传,2026-09-13 立):
       *  流开始时置 false(中断/刷新后据此判定可续接),正常收尾或错误收尾时置 true。 */
      setMessageStreamCompleted: (messageId, completed) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          const next = s.messages.slice()
          next[idx] = { ...target, streamCompleted: completed }
          return { messages: next }
        }),

      // #21 中断后追加指令继续(2026-09-13 立)
      setInterruptedMessage: (id) => set({ interruptedMessageId: id }),

      // #23 撤回未执行工具卡(2026-09-13 立)
      revokePendingToolCalls: (messageId) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          const pending = target.toolCalls?.filter((tc) => tc.status === 'running') ?? []
          if (pending.length === 0) return s
          const revokedIds = new Set(pending.map((tc) => tc.id))
          const next = s.messages.slice()
          next[idx] = {
            ...target,
            toolCalls: target.toolCalls?.map((tc) =>
              revokedIds.has(tc.id) ? { ...tc, status: 'cancelled' as const } : tc,
            ),
          }
          return { messages: next }
        }),

      clearMessages: () =>
        set({
          messages: [],
          error: null,
          memoryUpdateNotices: [],
          // P3 #30:新建对话时 diff 卡片随消息消失,待发送评论一并清空避免悬空
          pendingDiffComments: [],
          // 2026-09-18:终端实时输出属消息级瞬时态,新建对话一并清空
          terminalOutputs: {},
          // D1 消息级计量:新建对话一并清空
          usageByMessageId: {},
          // Steer(中途引导):新建对话一并清空,流式目标消息同步失效
          steerNoticesByMessageId: {},
          streamingAssistantId: null,
        }),
      /** 替换整个消息列表(用于自动压缩后同步后端压缩结果) */
      setMessages: (messages: ChatMessage[]) => set({ messages }),
      /** 编辑用户消息内容(2026-09-12 立,四竞品对标 P0-1):
       *  只更新目标消息 content,引用替换配合 React.memo 精准重渲染。 */
      editMessageContent: (messageId, content) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          const next = s.messages.slice()
          next[idx] = { ...target, content }
          return { messages: next }
        }),
      /** 截断消息列表:删除指定消息及其之后的所有消息(重新生成用)
       *  2026-08-30 立,与后端 /regenerate 端点配套:
       *  后端已删除 DB 中该消息及之后的内容,前端同步删除内存中的对应消息,
       *  保留该消息之前的历史,然后复用 sendMessage 重新发送前一条用户问题。 */
      truncateMessagesFrom: (messageId) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          return { messages: s.messages.slice(0, idx) }
        }),
      /** 保留指定消息,删除其之后的所有消息(2026-09-12 立,编辑重跑用):
       *  编辑重跑时后端已更新目标用户消息内容并删除其后消息,
       *  前端保留该用户消息(内容已由 editMessageContent 更新),截掉其后的 AI 回复。 */
      truncateMessagesFromAfter: (messageId) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          return { messages: s.messages.slice(0, idx + 1) }
        }),
      setCompactionStatus: (status) => set({ compactionStatus: status }),
      setStreaming: (v) => set({ isStreaming: v }),

      setError: (e) => set({ error: e }),

      setConversationId: (id) => set({ conversationId: id }),

      setUserScrolledUp: (v) => set({ userScrolledUp: v }),

      clearDraftInput: () => set({ draftInput: null }),

      clearDraftAutoSend: () => set({ draftAutoSend: false }),

      // D22 引用回复:写入/清除引用目标(输入区 chip 由 MessageInput 订阅渲染)
      setQuotedMessage: (q) => set({ quotedMessage: q }),

      // D22 网页搜索开关:同步 localStorage(初始 state 惰性读取的回写路径)
      setWebSearchEnabled: (v) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('ihui_web_search_enabled', v ? '1' : '0')
        }
        set({ webSearchEnabled: v })
      },

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

      // Subagent 自动派发(2026-07-28 立,对标 AI 工作台):
      // - addSubagentSpawn: 后端 subagent_spawn SSE 事件触发,追加新 SubAgentActivity(status='running')
      // - markSubagentEnd: 后端 subagent_end SSE 事件触发,更新现有条目状态为 completed/failed
      // 与 appendToAgentStream 的区别:appendToAgentStream 用于多 agent 多路复用的 token 流分流,
      // 而 addSubagentSpawn/markSubagentEnd 用于 dispatch_subagent 工具调用的生命周期展示。
      // 两者写入同一 subAgentActivities 数组,UI 统一通过 SubAgentActivityFeed 渲染。
      // 2026-08-01 Phase 4a:若 event.messageId 存在,同步写入 message.subagentActivities,
      // 供消息气泡内 inline SubagentSection 实时刷新(对标 AI 工作台/Codex 消息级透明性)。
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
              if (
                target &&
                !(target.subagentActivities ?? []).some((a) => a.agentId === event.id)
              ) {
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

      /** #14 Diff 文件级批量状态(2026-09-13 立,对标 Qoder/WorkBuddy 逐项+文件级):
       *  把消息内所有 diff 工具卡(edit_file/write_file,applyStatus 处于非终态)整体置为 status。
       *  终态(applied/rejected)与 applying 中的卡片跳过,避免覆盖已决结果。 */
      setAllDiffApplyStatus: (messageId, status) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target?.toolCalls) return s
          const hasDiffCard = (tc: ToolCall) =>
            !!tc.diffInfo || (tc.applyStatus !== undefined && tc.applyStatus !== null)
          const next = s.messages.slice()
          next[idx] = {
            ...target,
            toolCalls: target.toolCalls.map((tc) =>
              hasDiffCard(tc) &&
              tc.applyStatus !== 'applied' &&
              tc.applyStatus !== 'rejected' &&
              tc.applyStatus !== 'applying'
                ? { ...tc, applyStatus: status, applyError: undefined }
                : tc,
            ),
          }
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

      // #11 Citations 全链路(2026-09-13 立):写入消息级引用溯源(SSE citations 事件,整体替换)
      setMessageCitations: (messageId, citations) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          const next = s.messages.slice()
          next[idx] = { ...target, citations }
          return { messages: next }
        }),

      appendMessageInjection: (messageId, injection) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          const existing = target.injections ?? []
          // 同 kind + 同标签视为同一条(补发/重连幂等)
          if (
            existing.some((x) => x.kind === injection.kind && x.collapsed === injection.collapsed)
          ) {
            return s
          }
          const next = s.messages.slice()
          next[idx] = { ...target, injections: [...existing, injection] }
          return { messages: next }
        }),

      setMessageRetryNotice: (messageId, notice) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          const next = s.messages.slice()
          next[idx] = { ...target, retryNotice: notice }
          return { messages: next }
        }),

      // 2026-09-19 立:写入消息级上下文压缩统计(compaction 命名帧 → onCompaction
      // 回调 → send-message 映射为 MessageCompaction),整体替换;MessageItem 在
      // 消息内容区顶部渲染 CompressionDivider。
      setMessageCompaction: (messageId, compaction) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          const next = s.messages.slice()
          next[idx] = { ...target, compaction }
          return { messages: next }
        }),

      // P1 #27 记忆更新可视化(2026-09-16 立):done 事件 memoryUpdates 落地。
      // 按 messageId 写入/追加到 memoryUpdateNotices;同 messageId 已存在则合并 items(去重)。
      // 每条助手消息限一条提示条(本轮),故以 messageId 为键整体替换而非堆叠多个。
      appendMemoryNotice: (messageId, items) =>
        set((s) => {
          if (!items?.length) return s
          const notices = s.memoryUpdateNotices.slice()
          const existingIdx = notices.findIndex((n) => n.messageId === messageId)
          if (existingIdx === -1) {
            notices.push({ messageId, items: items.slice() })
          } else {
            const existing = notices[existingIdx]!
            const merged = [...existing.items, ...items]
            notices[existingIdx] = {
              messageId,
              items: Array.from(new Set(merged)).filter((v) => v.length > 0),
            }
          }
          return { memoryUpdateNotices: notices }
        }),

      // P3 #30 diff 评论驱动返工(2026-09-16 立):待发送评审意见队列三 action。
      // 队列由 send-message 在下一轮发送时消费(注入 <diff_review> 块后 clearDiffComments)。
      addDiffComment: (input) =>
        set((s) => {
          const text = input.comment.trim()
          if (!text) return s
          // 完全重复(同文件 + 同行 + 同正文)时忽略,防重复点击提交
          const dup = s.pendingDiffComments.some(
            (c) => c.filePath === input.filePath && c.line === input.line && c.comment === text,
          )
          if (dup) return s
          const entry: DiffComment = {
            ...input,
            comment: text,
            id: `dc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: Date.now(),
          }
          return { pendingDiffComments: [...s.pendingDiffComments, entry] }
        }),

      removeDiffComment: (id) =>
        set((s) => ({
          pendingDiffComments: s.pendingDiffComments.filter((c) => c.id !== id),
        })),

      clearDiffComments: () => set({ pendingDiffComments: [] }),

      // D28 快速侧问(2026-09-20 立):按会话分桶的侧问队列三 action。
      // 流式期间 submit 把 /side 问题入队当前会话桶;流结束后 message-input.tsx
      // effect 出队逐条补答(answerSideQuestion 直调 REST,回答不入主线历史)。
      enqueueSideQuestion: (conversationId, text) =>
        set((s) => {
          const trimmed = text.trim()
          if (!conversationId || !trimmed) return s
          const entry: SideQueueItem = {
            id: genId(),
            text: trimmed,
            createdAt: Date.now(),
          }
          const bucket = s.sideQueueByConversation[conversationId] ?? []
          return {
            sideQueueByConversation: {
              ...s.sideQueueByConversation,
              [conversationId]: [...bucket, entry],
            },
          }
        }),

      removeSideQuestion: (conversationId, id) =>
        set((s) => {
          const bucket = s.sideQueueByConversation[conversationId]
          if (!bucket?.some((q) => q.id === id)) return s
          const next = bucket.filter((q) => q.id !== id)
          const nextMap = { ...s.sideQueueByConversation }
          if (next.length > 0) nextMap[conversationId] = next
          else delete nextMap[conversationId]
          return { sideQueueByConversation: nextMap }
        }),

      shiftSideQuestion: (conversationId) => {
        const head = get().sideQueueByConversation[conversationId]?.[0]
        if (!head) return null
        set((s) => {
          const next = (s.sideQueueByConversation[conversationId] ?? []).slice(1)
          const nextMap = { ...s.sideQueueByConversation }
          if (next.length > 0) nextMap[conversationId] = next
          else delete nextMap[conversationId]
          return { sideQueueByConversation: nextMap }
        })
        return head
      },

      // D38 队列语义完整交互(2026-09-24 立):重排/移除/编辑/打断预备四动作。
      // 许可判定复用 @ihui/shared/chat/queue-interactions 的 interactionAllowed(渲染层调用);
      // 这里只做幂等状态变更 —— 越界/同位/找不到/空文本一律 no-op 返回原状态。
      // **禁改区声明**:上方 enqueue/remove/shift 三 action 与下方消费点均未触碰。
      requeue: (conversationId, fromIndex, toIndex) =>
        set((s) => {
          const bucket = s.sideQueueByConversation[conversationId]
          if (!bucket || fromIndex === toIndex) return s
          if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return s
          if (
            fromIndex < 0 ||
            fromIndex >= bucket.length ||
            toIndex < 0 ||
            toIndex >= bucket.length
          )
            return s
          const next = bucket.slice()
          const [moved] = next.splice(fromIndex, 1)
          if (!moved) return s
          next.splice(toIndex, 0, moved)
          return {
            sideQueueByConversation: { ...s.sideQueueByConversation, [conversationId]: next },
          }
        }),

      removeQueued: (conversationId, id) =>
        set((s) => {
          const bucket = s.sideQueueByConversation[conversationId]
          if (!bucket?.some((q) => q.id === id)) return s
          const next = bucket.filter((q) => q.id !== id)
          const nextMap = { ...s.sideQueueByConversation }
          if (next.length > 0) nextMap[conversationId] = next
          else delete nextMap[conversationId]
          return { sideQueueByConversation: nextMap }
        }),

      editQueued: (conversationId, id, text) =>
        set((s) => {
          const trimmed = text.trim()
          if (!trimmed) return s
          const bucket = s.sideQueueByConversation[conversationId]
          if (!bucket) return s
          const idx = bucket.findIndex((q) => q.id === id)
          if (idx === -1) return s
          const target = bucket[idx]
          if (!target) return s
          const next = bucket.slice()
          next[idx] = { ...target, text: trimmed }
          return {
            sideQueueByConversation: { ...s.sideQueueByConversation, [conversationId]: next },
          }
        }),

      interruptAndRun: (conversationId) => {
        const head = get().sideQueueByConversation[conversationId]?.[0]
        if (!head) return null
        set((s) => {
          const next = (s.sideQueueByConversation[conversationId] ?? []).slice(1)
          const nextMap = { ...s.sideQueueByConversation }
          if (next.length > 0) nextMap[conversationId] = next
          else delete nextMap[conversationId]
          return { sideQueueByConversation: nextMap }
        })
        return head
      },

      // D38 setMode 落点:模式偏好恒可切(许可门只管 interject 能力,不管用户想不想 steer);
      // steer 能否真正生效由渲染层 effectiveMode 判定(Runtime 不支持则降级 queue 并显式提示)。
      // 同值 no-op(不产生新状态引用,渲染层可跳过重渲染)。
      setFollowUpQueueMode: (mode) =>
        set((s) => (s.followUpQueueMode === mode ? s : { followUpQueueMode: mode })),

      // D60 发送可靠性草稿保全(2026-09-23 立):失败时保留正文 + 状态,供输入框回填/重发。
      // 空正文(trim 后为空)不保留(避免把空串当草稿覆盖有效内容);draft null = 显式清空。
      setFailedDraft: (draft, status) =>
        set(() => {
          if (draft === null) return { failedDraft: null, failedDraftStatus: null }
          if (!draft.trim()) return { failedDraft: null, failedDraftStatus: null }
          return { failedDraft: draft, failedDraftStatus: status ?? null }
        }),

      clearFailedDraft: () => set({ failedDraft: null, failedDraftStatus: null }),

      // 2026-09-18 终端实时输出(对标 Codex bash 实时回显):
      // 命令执行期间逐块追加,terminal_end 后保留供终态渲染取更完整文本。
      // 双重封顶防内存膨胀:单键 2 万字符(保留尾部) + 最多 20 个终端键(插入序淘汰最旧)。
      appendTerminalOutput: (terminalId, text) =>
        set((s) => {
          if (!terminalId || !text) return s
          const prev = s.terminalOutputs[terminalId] ?? ''
          const merged = prev + text
          // 单键上限 20000 字符(保留尾部):长命令输出不撑爆内存与渲染
          const capped = merged.length > 20000 ? merged.slice(-20000) : merged
          const next: Record<string, string> = { ...s.terminalOutputs, [terminalId]: capped }
          // 键数上限 20:对象字符串键保持插入序,超出即删最旧键(长会话不累积)
          const keys = Object.keys(next)
          if (keys.length > TERMINAL_OUTPUT_MAX_KEYS) {
            for (const stale of keys.slice(0, keys.length - TERMINAL_OUTPUT_MAX_KEYS)) {
              delete next[stale]
            }
          }
          return { terminalOutputs: next }
        }),

      clearTerminalOutput: (terminalId) =>
        set((s) => {
          if (!(terminalId in s.terminalOutputs)) return s
          const next = { ...s.terminalOutputs }
          delete next[terminalId]
          return { terminalOutputs: next }
        }),

      // D1 消息级计量(2026-09-19 立):onUsage 回调写入,按 messageId 索引(同名覆盖)。
      setMessageUsage: (messageId, usage) =>
        set((s) => ({
          usageByMessageId: { ...s.usageByMessageId, [messageId]: usage },
        })),

      // Steer(中途引导,2026-09-19 立):SSE steer 事件确认注入后按 messageId 累积。
      // 单消息上限 8 条对齐后端 _STEER_QUEUE_LIMIT(超限后端已拒绝入队,双保险),
      // 引导未生效或空文本由调用方(onSteer 回调)过滤,此处只管落库。
      appendSteerNotice: (messageId, notice) =>
        set((s) => {
          if (!messageId || !notice?.text) return s
          const existing = s.steerNoticesByMessageId[messageId] ?? []
          if (existing.length >= STEER_NOTICE_MAX_PER_MESSAGE) return s
          return {
            steerNoticesByMessageId: {
              ...s.steerNoticesByMessageId,
              [messageId]: [...existing, notice],
            },
          }
        }),

      // Steer:登记/清空当前流式 assistant 消息 ID(闪电按钮 steer 端点的定位键)
      setStreamingAssistantId: (id) => set({ streamingAssistantId: id }),

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

      // P1 token 用量写入消息 meta(2026-08-15 立):后端 SSE onUsage 回调写入 meta.usage
      updateMessageMeta: (messageId, meta) =>
        set((s) => {
          const idx = s.messages.findIndex((m) => m.id === messageId)
          if (idx === -1) return s
          const target = s.messages[idx]
          if (!target) return s
          const next = s.messages.slice()
          next[idx] = { ...target, meta: { ...(target.meta ?? {}), ...meta } }
          return { messages: next }
        }),

      // W27 输入历史(2026-09-14 立):去重 + 最新在后 + 上限 50(与 recentMessages 同量级)
      pushInputHistory: (text) =>
        set((s) => {
          const trimmed = text.trim()
          if (!trimmed) return s
          const deduped = s.inputHistory.filter((h) => h !== trimmed)
          deduped.push(trimmed)
          return { inputHistory: deduped.slice(-50) }
        }),
    }),
    {
      name: 'ihui-chat',
      // D48(G-56)A 层加密:桌面端(Tauri WebView)把整条 blob 走 AES-256-GCM 信封,
      // 浏览器路径原样返回 ssrStorage(对象同一、行为同一)。详见 lib/chat-persist-crypto.ts
      storage: createChatPersistStorage(ssrStorage),
      partialize: (s: ChatState) => ({
        currentModel: s.currentModel,
        conversationId: s.conversationId,
        draftInput: s.draftInput,
        // W27(2026-09-14):输入历史持久化 —— Esc+Esc 历史导航跨会话/刷新可用
        inputHistory: s.inputHistory,
        // P3 #30(2026-09-16):diff 待发送评审意见持久化 —— 用户评论后刷新/切走再回来仍可发送。
        // 上限 50 条(与 inputHistory 同量级),避免异常累积撑爆 localStorage 配额。
        pendingDiffComments: s.pendingDiffComments.slice(-50),
        // D28(2026-09-20):侧问队列按会话分桶持久化 —— 流式期间排队的问题刷新后仍保留,
        // 流结束后自动补答;每桶上限 20 条,防异常累积撑爆 localStorage 配额。
        sideQueueByConversation: Object.fromEntries(
          Object.entries(s.sideQueueByConversation).map(([k, v]) => [k, v.slice(-20)]),
        ),
        // D60(2026-09-23):失败保留草稿持久化 —— 发送失败后刷新页面,输入框仍可回填重发。
        failedDraft: s.failedDraft,
        failedDraftStatus: s.failedDraftStatus,
        // D22(2026-09-19):网页搜索开关用户偏好持久化(初始 state 已有 localStorage 双保险)
        webSearchEnabled: s.webSearchEnabled,
        // D38(2026-09-24):队列模式偏好(steer/queue)用户设置持久化
        followUpQueueMode: s.followUpQueueMode,
        // 2026-07-28 移除独立 PlanActToggle 后,plan_mode 字段已从持久化中删除
        // ChatMode 由 useModeStore 独立管理,持久化不重复存储
        // #12 store messages 持久化(2026-07-25 立):
        // 仅持久化当前 conversationId 对应的 messages 最近 50 条,
        // 用于刷新页面后预填充(避免空状态闪烁),真实数据以服务端 getMessages 为准。
        recentMessages: s.conversationId
          ? {
              conversationId: s.conversationId,
              // W24(2026-09-14):/btw 侧聊消息(meta.sidechat)不写入主线历史——持久化预填充同样排除
              messages: s.messages.filter((m) => m.meta?.sidechat !== true).slice(-50),
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
      version: 5,
      migrate: (persisted: unknown, version: number) => {
        if (persisted && typeof persisted === 'object') {
          const s = persisted as { currentModel?: string }
          // 2026-08-31 立:version=5 migrate,将所有旧版默认值升级为 'auto'。
          // 覆盖:version<3 的 stepfun/step-3.7-flash + version<2 的 step-router-v1。
          // 原因:Auto 模式已实现真正的跨厂商自动路由,比硬绑单一模型更好。
          // 注:显式选择 gpt-4o / claude / deepseek 等特定模型的用户不动,保留原值。
          if (
            version < 3 &&
            (s.currentModel === 'stepfun/step-3.7-flash' ||
              s.currentModel === 'stepfun/step-router-v1' ||
              !s.currentModel)
          ) {
            s.currentModel = 'auto'
          }
        }
        return persisted
      },
    },
  ),
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
