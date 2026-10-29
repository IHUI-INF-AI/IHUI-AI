// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import type { StateCreator } from 'zustand'
import { persist } from 'zustand/middleware'

import { ssrStorage } from './persist-helpers'
import { createChatPersistStorage } from '@/lib/chat-persist-crypto'
import type { SubAgentActivity, InlineDiffInfo } from '@/components/ai/types'
// D130(2026-09-30 立):推理强度档位回落通知的呈现形状。类型只从**消费者那一份**取
// (reasoning-effort-axis 是本通知在 web 的唯一读者);不引 @ihui/api-client 的那个同名接口 ——
// 本包入口是显式命名清单,ReasoningEffortNotice 尚未递出(两侧结构逐字同形,赋值安全),
// 引一个入口里没有的名字就是守门 149 记过的那一型运行时 undefined。
import type { ReasoningEffortFallbackNotice as ReasoningEffortNotice } from '@/components/chat/reasoning-effort-axis'
// D115(2026-10-24):review 结论帧的端内投影,store 只持引用不复制 schema。
import type { ReviewFinding } from '@/components/chat/message-list/review-findings-card'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'
import type { ExpertAutoRouteMode } from '@ihui/api-client'
import type {
  SubagentSpawnEvent,
  SubagentEndEvent,
  SubagentProgressEvent,
  FallbackEvent,
} from '@ihui/api-client'
import type { ChatMessage as BaseChatMessage, ToolCall as BaseToolCall } from '@ihui/shared'
import { markStreamError } from '@ihui/shared/chat'
// G-704(2026-09-29 立):值等价比较器只能有共享层那一份实现(端内不得再抄一份近似品)
import { areRecordValuesEqual } from '@ihui/shared/utils/deep-equal-records'
import type { FollowUpMode } from '@ihui/shared/chat/queue-interactions'
import type { QueueSendOutcome } from '@ihui/shared/chat/input-notices'
import type { InterjectionDeclaration } from '@/hooks/use-chat/runtime-capabilities'
import type { ToolCallSummary, PlanStep, TerminalTask, CitationEntry } from '@ihui/types/ai'
// 票71(V2 #23)第二切片(2026-10-24):chat 多端同步 —— 裁定的唯一实现是契约内核,
// 端内不得再抄一份去重(AGENTS §0.6:第二份必然漂移)。
import {
  CHAT_SYNC_PROTOCOL_VERSION,
  EMPTY_CHAT_SYNC_STATE,
  applyChatSyncEvent,
  isChatSyncTerminalReason,
  type ChatSyncApplyResult,
  type ChatSyncMessageSnapshot,
  type ChatSyncState,
  type ChatSyncTerminalState,
  type MessageCreatedEvent,
  type MessagePatchedEvent,
  type MessageTerminalEvent,
} from '@ihui/types'

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
  /** D113(2026-09-27):文件写类工具流中 diff 预览文本(tool-delta 帧按 seq 收敛追加,
   * 重传/乱序幂等;tool-result 到达即清 undefined)。仅 running 态渲染。 */
  partialDiff?: string
  /** D113:已收敛消费的最大 tool-delta `seq`(缺省视为 0;收敛判据 `evt.seq>partialSeq`)。 */
  partialSeq?: number
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
  /** prompt 缓存命中读 token。G-403(2026-10-07 接线):三态收敛到两值落盘 ——
   *  数字(含 0)= 上游真回报;null = 没采到(上游不报/帧代际差都归此),
   *  消费端据此显示"不可得"而非 0(与 G-394 同令)。 */
  cacheReadTokens: number | null
  /** prompt 缓存写入 token(Anthropic 系才有);三态收敛同上 */
  cacheWriteTokens: number | null
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
export interface ChatMessage extends Omit<
  BaseChatMessage,
  'createdAt' | 'toolCalls' | 'parentMessageId' | 'siblingIndex'
> {
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
  /** 票71 terminal 切片(2026-10-26):消息流终态投影(chat-sync v2 独立帧)。
   *  缺省 = 尚未收到终态(或该端未接终态投影);rev = 宣告终结时的链头,不新增修订号。 */
  terminal?: ChatSyncTerminalState
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
  /** D33(G-39,2026-09-26 立):该回答生成时刻**仍排队中**的侧问快照(队首窗口,≤8 条)。
   *  live:sideQueueByConversation 本地桶;历史:metadata.queueItems 经水合挂到消息。
   *  复用 SideQueueItem 形状(id/text/createdAt 毫秒)——与 Python 侧 QueueItemPayload
   *  逐字段同形同单位。缺失/空 = 本轮无排队或老消息,不造空态。
   *  会话级桶灌回(消费 api 侧"空数组=确实没有"语义)属后续挂载格,本字段只做消息级回放。 */
  queueItems?: SideQueueItem[]
  /** G-1104168(2026-10-10 立):该回答被中断的痕迹(仅历史回放;live 通道无此帧)。
   *  数据侧 ai-service conversation.py 只在 arrived_text 非空的取消路径落
   *  metadata.interrupted —— 零字符取消不落泡 ⇒ 展示侧不会渲染出空泡。 */
  interrupted?: boolean
  /** 中断原因码(ai-service interrupt_reason,如 user_cancelled);缺省不渲染副文案 */
  interruptReason?: string
  /** 票64(2026-10-18 立):版本族坐标(仅历史水合行携带,见 history-message.ts)。
   *  parentMessageId 非空 = 本行是 regenerate/edit 版本族的成员,族根 = 该值;
   *  siblingIndex 非 null = 参与族投影。**与 W16 live 本地链同字段不同义**:
   *  addMessage 写的 parentMessageId(=前一条)没有 siblingIndex 伴随,投影判据只认
   *  siblingIndex 非 null 的行,live 链不受影响。null = 服务端确认非族成员。 */
  parentMessageId?: string | null
  siblingIndex?: number | null
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
      /** A10B-8(2026-09-26):本轮被内容级截断的消息条数,与 removedCount 不同维
       *  (后者 = 被折进摘要移出上下文的整条消息数)。undefined = 生产者未告知(旧帧),
       *  与 0(告知过、确实没有截断)是两态,判据不得合并。 */
      truncatedCount?: number
      trigger?: string
    }
  | null

/** D151(2026-09-29 立):一条终端命令"正在等键盘输入"的渲染态。
 *  字段取自 SSE `terminal_interaction` 帧(@ihui/api-client 的 TerminalInteractionEvent),
 *  再加两个纯前端态(submitting / failed)与一个寻址凭据(sessionId)。
 *  刻意不存 inputMode —— 目前服务端恒 'line',多一维就多一处要同步的真相;
 *  也刻意不镜像 promptTail 之外的原文:等待态越薄,能被误持久化的东西越少。 */
export interface TerminalInteractionState {
  /** 提示原文(命令输出的尾行;服务端按凭据形态脱敏,但**不保证**干净 ⇒ 不得持久化/打日志) */
  promptTail: string
  /** 从判定"在等人"到发帧的毫秒数(帧原值) */
  waitingSinceMs: number
  /** 单次键入长度封顶(与服务端一致,输入框据此限制) */
  maxInputChars: number
  /** 关联助手消息 ID(帧可选携带) */
  messageId?: string
  /** 上行送回所需的 ai-service 流会话 ID;undefined = 本轮尚未观察到 ⇒ 提交如实报失败 */
  sessionId?: string
  /** 提交在途(防重复提交;一帧只许送一次) */
  submitting: boolean
  /** 上一次提交失败(界面据此显示"发送失败",并把该行留在框里) */
  failed: boolean
}

/**
 * 票71(V2 #23)第二切片:`applyChatSync` 的结果面 = 契约裁定 ∪ 本端房间过滤/终态档位过滤。
 * `room-mismatch` / `unknown-terminal-reason` 刻意**不**塞进 `ChatSyncRejectReason`:
 * 它们不是契约的四态裁定之一(契约管的是"同一会话内的幂等与判序"),
 * 混进去会让内核的裁定表多两档没人能测的形状。
 */
export type ChatSyncStoreOutcome =
  | ChatSyncApplyResult
  | {
      applied: false
      reason: 'room-mismatch' | 'unknown-terminal-reason'
      messageId: string
    }

/**
 * B02 第三切片:gap 坐标表的唯一增口(去重;封顶防无界 —— 同 hook 里 noticeSeen 的 200 档)。
 * 封顶语义:坐标表爆掉说明 gap 风暴(服务端回退/房间错乱),此时坐标已不可信,
 * 丢最旧的坐标 + 旗仍在账 ⇒ 宁可少拉一次快照,不让表吃内存。
 */
const CHAT_SYNC_GAP_IDS_LIMIT = 200
function appendGapMessageId(ids: string[], messageId: string): string[] {
  if (ids.includes(messageId)) return ids
  const next = [...ids, messageId]
  return next.length > CHAT_SYNC_GAP_IDS_LIMIT
    ? next.slice(next.length - CHAT_SYNC_GAP_IDS_LIMIT)
    : next
}

/** 票60 第一切片:状态形状导出,供 chat-panes 注册表与多实例消费面取型 */
export interface ChatState {
  messages: ChatMessage[]
  /** 票59(2026-10-22 立,2/3 切片):版本族的手动切换态 —— rootId → 激活消息 id。
   *  无键 = 显示最新 sibling(读投影的默认判据);有键且命中本族成员 = 显示该版;
   *  指向已不存在的消息时投影层回落默认(失效方向是"回到最新",不是渲染成空)。
   *  刻意**不持久化**:消息 id 是会话局部坐标,刷新后服务端重新水合,旧 id 必悬空;
   *  把它写进 localStorage 只会把上一会话的选择带进下一会话。 */
  activeVersionByRoot: Record<string, string>
  /**
   * 票71(V2 #23)第二切片(2026-10-24):消息面房间同步的**判据面**(chat-sync 契约内核的状态)。
   *
   * 为什么与 `messages` 并存而不是把内核塞进渲染数组:内核的裁定表(duplicate/stale/gap)
   * 要的是"每消息已应用到第几版"这一维,而渲染面是数组 + 大量 web 独占字段。
   * 两面的分工固定为:**判序住这里,内容真值住 messages**;应用顺序永远是
   * 先 kernel 裁、再把结果投影进数组(见 applyChatSync),不许反过来。
   * 不持久化:rev 是会话内的服务端坐标,刷新后由 resync 重建。
   */
  chatSync: ChatSyncState
  /**
   * 缺口标志:内核裁出 gap(缺 rev / created 未达)时置位,表示"需要一次 resync"。
   * B02 第三切片(2026-10-25):resync 传输已接 —— gap 的**精确坐标**记在
   * `chatSyncGapMessageIds`,消费面(hook)按坐标拉权威快照后走 `applyChatSyncSnapshot`
   * 喂内核;全部已知缺口补齐后两键一并复位。旗保留作粗粒度账面("还有没对齐的"),
   * 坐标表才是拉取的输入,两者不可互替。
   */
  chatSyncResyncPending: boolean
  /**
   * B02 第三切片:gap 的精确坐标(messageId 去重表)。
   * 会话局部坐标(与 chatSync 同命),不进 partialize、切会话即清 ——
   * 旧会话的缺口对当前会话没有意义,带过去只会让 hook 对新会话拉旧消息(404 浪费)。
   */
  chatSyncGapMessageIds: string[]
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
  /** D130(2026-09-30 立):后端把用户选定的推理强度档位**钉回**时的回落通知。
   *  载体 = done 帧新增的可选字段(见 @ihui/api-client 的 ReasoningEffortNotice),
   *  由 send-message.ts 的 onReasoningEffortNotice 回调写入,输入区第三轴读出并**上屏**。
   *  null = 本轮没有回落(或用户根本没选档)⇒ 轴上不显示任何东西。
   *  刻意不持久化:它是"这一轮发生了什么"的运行态,刷新后重放一条旧回落反而是假信息。 */
  reasoningEffortNotice: ReasoningEffortNotice | null
  /**
   * Runtime 插话能力声明(`null` = 未声明,即生产者还没说话)。
   *
   * 消费点唯一:输入区 QueueInteractionBar 的 `runtimeSupportsInterjection`(共享层 D69
   * `QueueInteractionContext` 同一语义),经 `resolveInterjectionSupport` 回落成布尔 ——
   * 未声明 ⇒ false,与该文件此前写死 false 同形(零回归)。
   *
   * 写入点两类(都经 `noteRuntimeCapabilities` 这一个入口):① 流帧载荷(流首
   * injection_applied / 流尾 usage 帧,见 send-message.ts);② 会话元数据
   * (见 ai-side-panel.tsx 的 getConversation 成功分支)。
   * 不持久化:属"这一轮 Runtime 说了什么"的运行态,刷新后重放旧声明是对已断开的流下判断。
   */
  runtimeInterjection: InterjectionDeclaration
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

  /** D151(2026-09-29 立)终端"等待键盘输入"态(键 = terminalId,与 terminalOutputs 并列切片):
   *  数据源 = SSE `terminal_interaction` 帧,唯一写入点是 send-message.ts 的 onTerminalInteraction,
   *  唯一消费点是 terminal-section.tsx 在同一张终端卡里渲染的输入行。
   *  刻意**不进 partialize**(上面那份是白名单):promptTail 取自命令输出,服务端按凭据形态脱敏
   *  但不保证干净,而用户键入更是密码候选 —— 任何一个落进 localStorage 都不行(AGENTS §5 认证面同族)。
   *  terminal_end 与新流开始(clearMessages)都会清除,否则上一轮的"等待"会挂在下一轮卡上。 */
  terminalInteractions: Record<string, TerminalInteractionState>
  /** D151:本轮 ai-service 流会话 ID —— 上行 `postTerminalInput(sessionId, …)` 的唯一寻址凭据。
   *  `terminal_interaction` 帧本身**不带** sessionId(见 TerminalInteractionEvent 定义),
   *  而同一轮 tool_delegate / tool-approval / form_request 帧携带的正是 llm.py 里同一个
   *  `session_id` 变量,故由那些帧观察所得;观察不到时输入行如实报失败,不猜一个地址发出去。 */
  aiStreamSessionId: string | null

  /** D1 消息级计量(2026-09-19 立):按 messageId 索引的 Token 用量/计时/成本。
   * 由 onUsage 回调写入,驱动消息底部徽章行(1.2k tok · 3.4s · 首 0.8s · model · ¥0.01)。
   * 不持久化(每轮流式重新计算,刷新后失效)。 */
  usageByMessageId: Record<string, MessageUsage>

  /** Steer(中途引导,2026-09-19 立):按 messageId 索引的引导注入确认记录。
   * SSE steer 事件(injected)由 onSteer 回调经 appendSteerNotice 累积写入,
   * MessageItem 按 message.id 订阅渲染「⚡ 引导已生效」badge。
   * 单消息上限对齐后端 _STEER_QUEUE_LIMIT(8 条);不持久化(执行期瞬时态)。 */
  steerNoticesByMessageId: Record<string, SteerNotice[]>
  /** D115(G-229,2026-10-24 立):按 messageId 索引的 review 结论帧。
   *  `onReviewFinding` 回调经 appendReviewFinding 累积写入,MessageItem 按 message.id
   *  订阅渲染 ReviewFindingsCard(按 P1/P2/Nit 分组)。不持久化(执行期瞬时态);
   *  新一轮审查首帧(index=1)会覆盖旧列表,避免两轮 finding 混在同一张卡上。 */
  reviewFindingsByMessageId: Record<string, ReviewFinding[]>
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

  /** D09(2026-10-24 立)专家包自动路由档位(设置页三档选择项)。
   *  null = 用户未表态:界面显示默认档 hint,请求不带 `expert_auto_route`,
   *  部署方 env(IHUI_EXPERT_AUTO_ROUTE)与后端默认档照常生效 —— 不把"没选过"
   *  写成一个用户覆盖。持久化(用户偏好,跨刷新保留)。 */
  expertAutoRoute: ExpertAutoRouteMode | null

  /** D01(2026-10-25 立)对话内 Agent 选择器选中的 persona id。
   *  null = 未启用专家(默认助手行为);值域由 ai-service 的 PERSONAS_CONTRACTS 决定,
   *  前端不写死名单(胶囊下拉从 /llm/personas 拉取),避免第三份 persona 定义。
   *  发送时随请求上行(api-client streamChat personaId),后端并入 system 提示与工具白名单。
   *  持久化(用户偏好,跨刷新保留)。 */
  selectedAgentId: string | null

  /** D28 快速侧问(2026-09-20 立):按会话分桶的侧问 FIFO 队列。
   *  流式期间输入的 /side 问题入队当前会话桶,流结束后由 message-input.tsx
   *  逐条出队补答;非流式时 /side 直接即答不入队。
   *  按会话分桶:切换会话后其他会话的队列仍保留,切回可继续补答。
   *  持久化:排队问题跨刷新保留(用户排队后刷新再回来仍可补答),故纳入 partialize。 */
  sideQueueByConversation: Record<string, SideQueueItem[]>

  /** G-171b(D162 终态回传,2026-10-23 立):队列项发送终态台账,按会话分桶、按 itemId 记。
   *  生产者 = message-input.tsx 发送 promise 的 settle 点(成功→sent / 失败→failed)
   *  与撤回入口(被撤回→deferred);枚举唯一本体 @ihui/shared/chat/input-notices
   *  `QUEUE_SEND_OUTCOMES`。会话级不持久化(队列本体已是会话态,终态台账随会话作废)。 */
  queueSendOutcomes: Record<
    string,
    Array<{ itemId: string; outcome: QueueSendOutcome; at: number }>
  >

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
  /** 设置专家包自动路由档位(写 localStorage 'ihui_expert_auto_route' 供 SSR 前恢复) */
  setExpertAutoRoute: (v: ExpertAutoRouteMode) => void
  /** D01:设置对话内选中的专家(null = 切回默认;写 localStorage 'ihui_selected_agent_id') */
  setSelectedAgentId: (id: string | null) => void

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
  /** G-703(2026-09-29 立):运行域寻址凭据的**唯一**回收出口。
   *  `isStreaming` / `streamingAssistantId` / `aiStreamSessionId` 三键在同一事务里清掉 ——
   *  回合进入终态后,上一轮的上行寻址凭据必须一起失效(留着的表现是假"还在跑" + 把新输入
   *  送到一条已经死掉的流上,而界面看不出来)。`setStreaming(false)` 与 `clearMessages` 都走它,
   *  调用点不得再各自补一句 `setStreamingAssistantId(null)`(那正是"靠调用点自觉"的旧形态)。
   *  清单见 RUN_SCOPED_RESET 注释;非运行域的键(terminalOutputs / interruptedMessageId 等)
   *  刻意**不**在这里回收。 */
  clearRunScopedState: () => void
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
  /** D130(2026-09-30 立):写入/清空推理强度档位的回落通知。
   *  写入点 = send-message.ts 的 onReasoningEffortNotice(done 帧带回落才发);
   *  清空点 = 每一轮发起前(sendMessage 体),否则上一轮的钉档会挂在下一轮的轴上读成"本轮被回落"。 */
  setReasoningEffortNotice: (notice: ReasoningEffortNotice | null) => void
  /**
   * 写入 Runtime 插话能力声明(唯一调用方 = `noteRuntimeCapabilities`)。
   * 值等价即不写(与 setReasoningEffortNotice 同取向):同一条流里同值声明会被重复递到
   * 多个帧上,无条件重建会让订阅侧白刷一轮输入区。
   */
  setRuntimeInterjection: (declared: InterjectionDeclaration) => void
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
  /** G-171b:登记一条队列项发送终态(sent/failed/deferred),按会话追加、每桶上限 20(旧条目淘汰)。
   *  终态取值必须来自 shared `QUEUE_SEND_OUTCOMES`;本 action 不判语义,只落账。 */
  recordQueueSendOutcome: (
    conversationId: string,
    itemId: string,
    outcome: QueueSendOutcome,
  ) => void
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
  /** D151(2026-09-29 立):写入/合并某条终端命令的"等待输入"态(patch 逐字段覆盖;
   *  新键自动补 submitting:false / failed:false)。唯一生产点 = send-message.ts onTerminalInteraction,
   *  以及 terminal-section 提交前后的 submitting/failed 两维(不改帧带来的原文)。 */
  setTerminalInteraction: (terminalId: string, patch: Partial<TerminalInteractionState>) => void
  /** D151:清除某条终端命令的等待态(terminal_end / 提交成功后调用;不留可寻址的空把手) */
  clearTerminalInteraction: (terminalId: string) => void
  /** D151:登记本轮 ai-service 流会话 ID(与 tool_delegate/tool-approval/form_request 帧同源观察);
   *  null = 显式清空。后到者覆盖(同一轮内只有一个活动会话 ID)。 */
  noteStreamSessionId: (sessionId: string | null) => void
  /** D1 消息级计量(2026-09-19 立):写入某条助手消息的 usage 数据(onUsage 回调触发)。
   * messageId 为空时调用方已回退到当前流式消息 id。同名 id 直接覆盖(流末只到达一次)。 */
  setMessageUsage: (messageId: string, usage: MessageUsage) => void
  /** Steer(中途引导,2026-09-19 立):追加某条助手消息的引导注入确认(SSE steer 事件触发)。
   * 单消息上限 8 条(对齐后端 _STEER_QUEUE_LIMIT),超出静默丢弃。 */
  appendSteerNotice: (messageId: string, notice: SteerNotice) => void
  /** D115:追加某条助手消息的审查结论(SSE review-finding 事件触发)。
   *  index=1 是新一轮审查的首帧 ⇒ 先清旧列表;同 findingId 重放幂等丢弃。 */
  appendReviewFinding: (messageId: string, finding: ReviewFinding) => void
  /** Steer(中途引导):登记/清空当前流式 assistant 消息 ID(流开始写入,收尾清空) */
  /** D115:追加某条助手消息的审查结论(SSE review-finding 事件触发)。
   *  index=1 是新一轮审查的首帧 ⇒ 先清旧列表;同 findingId 重放幂等丢弃。 */
  appendReviewFinding: (messageId: string, finding: ReviewFinding) => void
  setStreamingAssistantId: (id: string | null) => void
  /** P1 token 用量写入消息 meta(2026-08-15 立):后端 SSE 流末尾发送 usage chunk,
   *  前端 onUsage 回调调用此方法把 usage 写入 assistant 消息 meta.usage,UI 展示 token 计数。 */
  updateMessageMeta: (messageId: string, meta: Record<string, unknown>) => void
  /** 替换整个消息列表(用于自动压缩后同步后端压缩结果) */
  setMessages: (messages: ChatMessage[]) => void
  /**
   * 票71(V2 #23)第二切片:应用一条 chat 同步帧(WS 房间广播)。
   *
   * 去重与判序**只走契约内核**(`applyChatSyncEvent`),本动作只做三件事:
   * ① 房间过滤(帧的 `room.conversationId` 必须等于当前会话);
   * ② 把内核裁出的结果投影进渲染数组(created 增行 / patched 就地改 content /
   *    terminal 只打终态标记,不新增 rev);
   * ③ gap 置 resync 旗。
   * 被拒(duplicate/stale/gap)时**不写 messages** —— 内核返回原 state 引用,
   * 本动作据此不 set,避免"拒绝也触发重渲染"。
   */
  applyChatSync: (
    evt: MessageCreatedEvent | MessagePatchedEvent | MessageTerminalEvent,
  ) => ChatSyncStoreOutcome
  /** resync 拉取成功(或确认无缺口)后清旗;消费面 = use-conversation-broadcast-sync 的 gap 拉取 effect */
  markChatSyncResynced: () => void
  /**
   * B02 第三切片(2026-10-25):把 resync 拉回的权威快照(`ChatSyncMessageSnapshot`)
   * 应用进状态面。**两步全走契约内核,零旁路**(契约 §4:created 补达 → 链恢复,用例⑧):
   * ① 判据面缺行 ⇒ 先喂 created(已有时内核判 duplicate,不覆盖已收面 —— 用例①);
   * ② 再喂 patched(kind='snapshot', rev=N):自包含全量,N > lastAppliedRev 应用、
   *    否则 duplicate/stale 零变化。rev=0(链上无 patch)时 ② 恒被拒,面 = created 初面。
   * 投影纪律与 applyChatSync 同款:内核面有行而渲染面缺行 ⇒ 按内核面增行(修 m-ghost 型
   * 两面不一致),不凭快照字段另造;两步全拒且渲染面已有行 ⇒ 零变化。
   * 无论内核裁了什么,服务端已给出权威回答 ⇒ 本消息的 gap 坐标摘除;全部补齐 ⇒ 清旗。
   */
  applyChatSyncSnapshot: (snap: ChatSyncMessageSnapshot) => ChatSyncStoreOutcome
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
  /** 票64(2026-10-18 立):写入消息级钉选/收藏时刻。
   *  存的是服务端盖章的时间戳而不是布尔 —— 布尔会把"我不知道"和"没标记"压成同一个值。
   *  调用方只应在 PATCH 成功后拿服务端回写的整行调本出口,不做乐观翻转。 */
  patchMessageFlags: (
    messageId: string,
    flags: { pinnedAt: string | null; bookmarkedAt: string | null },
  ) => void
  /** 票64(2026-10-18 立):并入一条版本族 sibling 行(AI 消息编辑后服务端落库的新版本)。
   *  服务端同时把族根补成 siblingIndex=0,所以这里也要给内存里的族根补坐标 ——
   *  只塞新行不补根,读投影判不出族,原版本与新版本会同时渲染成两个气泡。
   *  新行按族尾插入而不是追加到数组末尾:读投影保持原数组顺序,追加会让新版本
   *  跑到整段对话最下面(位置跳走),而它本该出现在原回复的位置。 */
  mergeVersionMessage: (message: ChatMessage, rootId: string, siblingIndex: number) => void
  /** 票59(2026-10-22 立,2/3 切片):切换某版本族的激活版本。
   *  rootId / messageId 由 `versionFamilyPosition` 给出 —— 判族口径只许有一份
   *  (lib/message-version-family.ts),这里不做二次判族、不校验成员关系;
   *  坏指针在投影层被当"没选过"回落,不会被静默渲染成空。 */
  setActiveMessageVersion: (rootId: string, messageId: string) => void
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

/** G-703(2026-09-29 立)运行域状态的一次性回收清单 —— 本文件里这三键的复位值**只有这一份**。
 *
 *  为什么是这三键:它们同属"本轮在跑"这一件事的凭据 ——
 *   - `isStreaming`:运行标志(输入区禁用、按钮态、续接判定都读它);
 *   - `streamingAssistantId`:steer 端点的定位键(conversationId + messageId 找 upstream 会话);
 *   - `aiStreamSessionId`:见 :310-314 的原注释 —— `postTerminalInput` 的**唯一**上行寻址凭据。
 *  旧形态是 `setStreaming` 裸写一个键、流收尾时调用点再各补一句 `setStreamingAssistantId(null)`,
 *  而 `aiStreamSessionId` 除初值与 clearMessages 外**没有任何清除点**(现读
 *  `git grep -n 'aiStreamSessionId' HEAD -- apps/web/src | grep -v __tests__` 可复核):
 *  于是回合进终态后,上一轮的 sessionId 仍被下一轮的消费点拿去用。
 *
 *  刻意不在清单里的键(不得"顺手一起清",它们的归属另有语义):
 *   - `terminalOutputs` / `terminalInteractions`:终态渲染要取更完整的 live 缓冲(见 :295-308),
 *     清除点是 terminal_end 与 clearMessages,不是"流结束";
 *   - `interruptedMessageId`:#21「中断后追加指令继续」正是要在流结束之后仍可用;
 *   - `messages` / `conversationId` / 草稿队列:会话域,不是运行域。 */
const RUN_SCOPED_RESET: Pick<
  ChatState,
  'isStreaming' | 'streamingAssistantId' | 'aiStreamSessionId'
> = {
  isStreaming: false,
  streamingAssistantId: null,
  aiStreamSessionId: null,
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

// 票60(2026-10-18 立,第一切片):store 工厂化 —— 会话承载从 `conversationId` 单例
// 走向"每窗格一份状态"(真并行多窗格)。实现体抽成 buildChatState(纯状态+动作,
// 无模块级可变量),createChatStore(persistName?) 产出互相独立的状态实例;
// useChatStore 保持默认单例,既有全部消费面(hooks/组件)零改动、零回归。
// persist name 按实例隔离:两个实例共用一个 key 会互相覆盖持久化快照。
// 下一步(本切片不含):chat-panes.ts 按 paneId 注册多实例 + send-message 等运行域
// hooks 按窗格寻址 + 独立 SSE/abort(见 PROJECT_PLAN 票 60 实施方案)。
type ChatStateCreator = StateCreator<ChatState, [['zustand/persist', unknown]], []>

const buildChatState: ChatStateCreator = (set, get) => ({
  messages: [],
  // 票59 2/3:手动切换态默认空 = 各族显示最新 sibling(投影默认判据)
  activeVersionByRoot: {},
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
  // D130(2026-09-30 立):本轮没有钉档回落 = null(运行态,不持久化)
  reasoningEffortNotice: null,
  // Runtime 插话能力:null = 未声明(运行态,不持久化)—— 生产者缺席时回落 false
  runtimeInterjection: null,
  pendingDiffComments: [],
  // 2026-09-18 终端实时输出缓冲(执行期瞬时态,不持久化)
  terminalOutputs: {},
  // D151 终端"等待输入"态 + 本轮上行寻址凭据(执行期瞬时态,不持久化)
  terminalInteractions: {},
  aiStreamSessionId: null,
  // D1 消息级计量(执行期瞬时态,不持久化)
  usageByMessageId: {},
  // Steer(中途引导)注入确认 + 当前流式 assistant 消息 ID(执行期瞬时态,不持久化)
  steerNoticesByMessageId: {},
  // D115(2026-10-24):review 结论帧(执行期瞬时态,不持久化)
  reviewFindingsByMessageId: {},
  streamingAssistantId: null,
  // D22 引用回复(执行期瞬时态,不持久化)
  quotedMessage: null,
  // D22 网页搜索开关:SSR 安全惰性读取(服务端恒 false;客户端 store 创建早于组件 hydration,
  // 首渲染即恢复用户偏好,与 partialize 持久化路径互为双保险)
  webSearchEnabled:
    typeof window !== 'undefined' && localStorage.getItem('ihui_web_search_enabled') === '1',
  // D09 专家包自动路由:SSR 安全惰性读取(服务端恒 null = 未表态),只接受三档字面量,
  // 历史脏值一律按"未表态"处理(宁可回到后端默认档,也不发一个后端不认的档位)。
  expertAutoRoute: (() => {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem('ihui_expert_auto_route')
    return raw === 'off' || raw === 'hint' || raw === 'auto' ? raw : null
  })(),
  // D01 对话内 Agent 选择器:SSR 安全惰性读取(服务端恒 null = 未启用专家),
  // 与 expertAutoRoute 同一双保险姿势(localStorage 首渲染恢复 + partialize 持久化)。
  selectedAgentId:
    typeof window !== 'undefined' ? localStorage.getItem('ihui_selected_agent_id') : null,
  // #21 中断后追加指令继续(2026-09-13 立)
  interruptedMessageId: null,
  // W27 输入历史(2026-09-14 立):Esc+Esc 历史导航数据源
  inputHistory: [],
  // D28 快速侧问(2026-09-20 立):按会话分桶的侧问 FIFO 队列(持久化,见 partialize)
  sideQueueByConversation: {},
  queueSendOutcomes: {},
  // 票71(V2 #23)第二切片:消息面同步的判据面 + 缺口旗。
  // 两者都是**会话局部坐标**(rev 由服务端按会话分配),故刻意不进 partialize ——
  // 刷新后由服务端快照重建;把旧 rev 带进新会话只会让内核把新事件误判成 stale。
  chatSync: EMPTY_CHAT_SYNC_STATE,
  chatSyncResyncPending: false,
  // B02 第三切片:gap 坐标表(会话局部,不进 partialize,理由见 ChatState 头注)
  chatSyncGapMessageIds: [],
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
      s.selectedTools.includes(pluginId) ? s : { selectedTools: [...s.selectedTools, pluginId] },
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

  /** 票64(2026-10-18 立):写入消息级钉选/收藏时刻(服务端盖章值)。
   *  找不到那条消息就整轮原样返回 —— 把"消息不在这屏"写成一次清空标记是反向失真。 */
  patchMessageFlags: (messageId, flags) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === messageId)
      if (idx === -1) return s
      const target = s.messages[idx]
      if (!target) return s
      const next = s.messages.slice()
      next[idx] = {
        ...target,
        pinnedAt: flags.pinnedAt,
        bookmarkedAt: flags.bookmarkedAt,
      }
      return { messages: next }
    }),

  /** 票64(2026-10-18 立):并入 AI 消息编辑产生的新 sibling 行(详见接口注释)。 */
  mergeVersionMessage: (message, rootId, siblingIndex) =>
    set((s) => {
      // 同一条新版本被重复并入(双击保存/重放)时不产生第二行
      if (s.messages.some((m) => m.id === message.id)) return s
      // 族根坐标补全:服务端已把库里那行补成 siblingIndex=0,内存里这条还没有
      const next = s.messages.map((m) =>
        m.id === rootId && (m.siblingIndex === null || m.siblingIndex === undefined)
          ? { ...m, parentMessageId: null, siblingIndex: 0 }
          : m,
      )
      const row: ChatMessage = { ...message, parentMessageId: rootId, siblingIndex }
      // 按族尾插入(族根 + 已有 sibling),让激活版本落在原回复的位置
      let lastFamilyIdx = -1
      for (let i = 0; i < next.length; i++) {
        const m = next[i]!
        const inFamily =
          m.id === rootId ||
          (m.parentMessageId === rootId && m.siblingIndex !== null && m.siblingIndex !== undefined)
        if (inFamily) lastFamilyIdx = i
      }
      next.splice(lastFamilyIdx === -1 ? next.length : lastFamilyIdx + 1, 0, row)
      if (next.length > MAX_MESSAGES) next.splice(0, next.length - MAX_MESSAGES)
      // 票59 2/3:新 sibling 入族 ⇒ 该族回默认(显示最新)。否则用户停在第 1 版时
      // 点一次「重新生成」看不到新回复,表现成"点了没反应"。
      const versionState =
        rootId in s.activeVersionByRoot
          ? Object.fromEntries(Object.entries(s.activeVersionByRoot).filter(([k]) => k !== rootId))
          : s.activeVersionByRoot
      return { messages: next, activeVersionByRoot: versionState }
    }),

  /** 票59 2/3:切换版本族激活版本(判族与成员校验在 lib/message-version-family.ts)。 */
  setActiveMessageVersion: (rootId, messageId) =>
    set((s) =>
      s.activeVersionByRoot[rootId] === messageId
        ? s
        : { activeVersionByRoot: { ...s.activeVersionByRoot, [rootId]: messageId } },
    ),

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
      // G-703(2026-09-29 立):运行域三键(isStreaming / streamingAssistantId /
      // aiStreamSessionId)走**同一份**清单复位,不在这里各抄一行 —— 抄第二份就是第二个真相。
      ...RUN_SCOPED_RESET,
      messages: [],
      error: null,
      memoryUpdateNotices: [],
      // D130:上一轮的钉档回落属那一轮的运行态,新建对话必须一起清 ——
      // 留着的表现是"新会话第一件事就告诉用户档位被改了",而本轮根本没选过档。
      reasoningEffortNotice: null,
      // Runtime 插话能力同属那一轮的运行态:上一轮声明的"支持插话"挂到新会话上,
      // 而新会话根本还没跟 Runtime 说过话 ⇒ 回落到"未声明"(消费侧读 false)。
      runtimeInterjection: null,
      // P3 #30:新建对话时 diff 卡片随消息消失,待发送评论一并清空避免悬空
      pendingDiffComments: [],
      // 2026-09-18:终端实时输出属消息级瞬时态,新建对话一并清空
      terminalOutputs: {},
      // D151:同理必须**并列**清空 —— 上一轮残留的"等待输入"挂到下一轮的卡上,
      // 用户会把一行字送进一个已经结束的命令(而界面看不出来)。
      terminalInteractions: {},
      // D1 消息级计量:新建对话一并清空
      usageByMessageId: {},
      // Steer(中途引导):提示条一并清空;流式目标消息 ID 已随上面 RUN_SCOPED_RESET 失效
      steerNoticesByMessageId: {},
      // D115:审查结论卡随消息消失,新建对话一并清空
      reviewFindingsByMessageId: {},
      // 票59 2/3:版本切换态是会话局部坐标(消息 id),新建对话必须一起清
      activeVersionByRoot: {},
    }),
  /** 替换整个消息列表(用于自动压缩后同步后端压缩结果) */
  setMessages: (messages: ChatMessage[]) => set({ messages }),
  /**
   * 票71(V2 #23)第二切片实现体:房间过滤 → 契约内核裁定 → 投影进渲染数组。
   * 三条顺序不可换:先滤房间(别会话的帧连判据面都不该碰)、再裁序(判序早于判体)、
   * 最后才写 messages(内容真值只从内核裁过的结果来,不从帧里二次读字段)。
   */
  applyChatSync: (evt) => {
    const event = evt.data
    const { conversationId, chatSync, messages } = get()
    if (event.room.conversationId !== conversationId) {
      return { applied: false, reason: 'room-mismatch', messageId: event.messageId }
    }
    // 终态 reason 是封闭集:未知档位在渲染面没有可呈现的语义(用户最需要看懂的一格),
    // 按「未判定」拒收 —— 不交给内核当合法值落面,也不自造一句话补齐。
    if (event.type === 'message:terminal' && !isChatSyncTerminalReason(event.reason)) {
      return { applied: false, reason: 'unknown-terminal-reason', messageId: event.messageId }
    }
    const { state, result } = applyChatSyncEvent(chatSync, event)
    if (!result.applied) {
      // 被拒一律不写 messages(内核返回原 state 引用);只有 gap 需要一次 resync ——
      // duplicate/stale 是正常的幂等与乱序,置旗会让每帧都去拉快照。
      // B02 第三切片:gap 同时记下精确坐标(hook 按坐标拉权威快照),旗保留作粗账面。
      if (result.reason === 'gap') {
        set({
          chatSyncResyncPending: true,
          chatSyncGapMessageIds: appendGapMessageId(get().chatSyncGapMessageIds, result.messageId),
        })
      }
      return result
    }
    const surface = state.messages.get(result.messageId)
    if (!surface) return result
    if (event.type === 'message:created') {
      set({
        chatSync: state,
        messages: [
          ...messages,
          {
            id: surface.id,
            role: surface.role,
            content: surface.content,
            ...(surface.reasoning !== undefined ? { reasoning: surface.reasoning } : {}),
            createdAt: Date.now(),
          },
        ],
      })
      return result
    }
    const idx = messages.findIndex((m) => m.id === surface.id)
    if (idx === -1) {
      // 内核裁"应用"而渲染面没有这一行 ⇒ 两面判据面已经不一致,置旗交给 resync,
      // 绝不在这里凭帧字段造一行(那等于绕开内核另立一份真相)。
      // B02 第三切片:同样记下坐标 —— 快照拉回后 applyChatSyncSnapshot 按内核面补行。
      set({
        chatSync: state,
        chatSyncResyncPending: true,
        chatSyncGapMessageIds: appendGapMessageId(get().chatSyncGapMessageIds, surface.id),
      })
      return result
    }
    const next = messages.slice()
    if (event.type === 'message:terminal') {
      // 终态是状态位、只落在已应用的链头上:内容面零变化,只把 terminal 投影进该行。
      next[idx] = {
        ...messages[idx]!,
        ...(surface.terminal !== undefined ? { terminal: surface.terminal } : {}),
      }
      set({ chatSync: state, messages: next })
      return result
    }
    next[idx] = {
      ...messages[idx]!,
      content: surface.content,
      ...(surface.reasoning !== undefined ? { reasoning: surface.reasoning } : {}),
      // snapshot 可推进内容但不清除既有终态(契约 §4 终态粘性),投影面一并对齐。
      ...(surface.terminal !== undefined ? { terminal: surface.terminal } : {}),
    }
    set({ chatSync: state, messages: next })
    return result
  },
  markChatSyncResynced: () => set({ chatSyncResyncPending: false }),
  applyChatSyncSnapshot: (snap) => {
    const { conversationId, chatSync, messages } = get()
    if (snap.conversationId !== conversationId) {
      // 与 applyChatSync 同一款房间过滤:别的会话的快照连判据面都不该碰。
      return { applied: false, reason: 'room-mismatch', messageId: snap.messageId }
    }
    // 两步全走内核(见动作声明处的逐条理由)。channel 是投递元数据、内核刻意不读
    // (契约 §3);REST resync 借 'ws' 标 —— 换通道重投必须判 duplicate 本就是契约的一部分。
    const envelope = {
      protocolVersion: CHAT_SYNC_PROTOCOL_VERSION,
      channel: 'ws' as const,
      room: { kind: 'conversation' as const, conversationId: snap.conversationId },
    }
    let state = chatSync
    let createdApplied = false
    if (!state.messages.has(snap.messageId)) {
      const created = applyChatSyncEvent(state, {
        ...envelope,
        type: 'message:created',
        messageId: snap.messageId,
        role: snap.role,
        content: snap.content,
        ...(snap.reasoning !== undefined ? { reasoning: snap.reasoning } : {}),
      })
      createdApplied = created.result.applied
      state = created.state
    }
    const patched = applyChatSyncEvent(state, {
      ...envelope,
      type: 'message:patched',
      messageId: snap.messageId,
      rev: snap.rev,
      kind: 'snapshot',
      content: snap.content,
      ...(snap.reasoning !== undefined ? { reasoning: snap.reasoning } : {}),
    })
    state = patched.state

    const surface = state.messages.get(snap.messageId)
    const idx = messages.findIndex((m) => m.id === snap.messageId)
    let nextMessages = messages
    if (surface && idx === -1) {
      // 渲染面缺行而内核面有行(created 补达 / m-ghost 型两面不一致)⇒ 按内核面增行。
      nextMessages = [
        ...messages,
        {
          id: surface.id,
          role: surface.role,
          content: surface.content,
          ...(surface.reasoning !== undefined ? { reasoning: surface.reasoning } : {}),
          createdAt: Date.now(),
        },
      ]
    } else if (surface && idx !== -1 && (createdApplied || patched.result.applied)) {
      // 内核真改了面(created 不可能,created 只在缺行时喂;这里实际是 snapshot 应用)⇒ 就地替换。
      const next = messages.slice()
      next[idx] = {
        ...messages[idx]!,
        content: surface.content,
        ...(surface.reasoning !== undefined ? { reasoning: surface.reasoning } : {}),
      }
      nextMessages = next
    }
    // 服务端已给出权威回答 ⇒ 本消息的 gap 摘除(即使内核判 duplicate/stale ——
    // duplicate 说明端侧已在链头,stale 说明服务端权威比端侧旧,都没有"再拉一次"可做);
    // 全部已知缺口补齐 ⇒ 清旗(与 markChatSyncResynced 同一语义,此处是坐标驱动的自动清)。
    const remainingGaps = get().chatSyncGapMessageIds.filter((id) => id !== snap.messageId)
    set({
      chatSync: state,
      messages: nextMessages,
      chatSyncGapMessageIds: remainingGaps,
      ...(remainingGaps.length === 0 ? { chatSyncResyncPending: false } : {}),
    })
    return patched.result
  },
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
  /** D130(2026-09-30 立):推理强度回落通知的唯一写入口。
   *  值等价即不写(与 G-704 同一取向):done 帧重放/续接时同一份回落会被再送一次,
   *  无条件重建会让订阅侧收到"变了"并白刷一轮轴。 */
  setReasoningEffortNotice: (notice) =>
    set((s) => {
      const same =
        (s.reasoningEffortNotice === null && notice === null) ||
        (s.reasoningEffortNotice !== null &&
          notice !== null &&
          s.reasoningEffortNotice.fallback === notice.fallback &&
          s.reasoningEffortNotice.requested === notice.requested &&
          s.reasoningEffortNotice.effective === notice.effective &&
          s.reasoningEffortNotice.reason === notice.reason)
      if (same) return s
      return { reasoningEffortNotice: notice }
    }),
  setRuntimeInterjection: (declared) =>
    set((s) => (s.runtimeInterjection === declared ? s : { runtimeInterjection: declared })),
  /** G-703:false 侧不再裸写单键 —— "本轮不再在跑"这一件事必然同时意味着"上一轮的寻址凭据
   *  作废",所以它只能是一次 RUN_SCOPED_RESET 写入。true 侧保持只置运行标志,
   *  不得顺手清凭据(本轮的 sessionId 是在 setStreaming(true) **之后**由同源帧观察登记的)。 */
  setStreaming: (v) => set(v ? { isStreaming: true } : RUN_SCOPED_RESET),
  /** G-703:运行域凭据的唯一回收出口(清单与"为什么是这三键"见 RUN_SCOPED_RESET 注释)。 */
  clearRunScopedState: () => set(RUN_SCOPED_RESET),

  setError: (e) => set({ error: e }),

  // B02 第三切片:gap 坐标随会话切换清空 —— 旧会话的缺口坐标对当前会话没有意义,
  // 带过去只会让 hook 对新会话拉旧消息(归属校验 404,纯浪费)。旗(resyncPending)
  // 与 chatSync 判据面的会话切换语义属既有切片,不在本片射程,保持原样。
  setConversationId: (id) =>
    set(
      id === get().conversationId
        ? { conversationId: id }
        : { conversationId: id, chatSyncGapMessageIds: [] },
    ),

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

  // D09 专家包自动路由:同步 localStorage(初始 state 惰性读取的回写路径)
  setExpertAutoRoute: (v) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ihui_expert_auto_route', v)
    }
    set({ expertAutoRoute: v })
  },

  // D01 对话内 Agent 选择器:同步 localStorage(初始 state 惰性读取的回写路径)。
  // null = 切回默认专家,显式删除键而不是写 "null" 字符串。
  setSelectedAgentId: (id) => {
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem('ihui_selected_agent_id', id)
      else localStorage.removeItem('ihui_selected_agent_id')
    }
    set({ selectedAgentId: id })
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
      if (existing.some((x) => x.kind === injection.kind && x.collapsed === injection.collapsed)) {
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
        const mergedItems = Array.from(new Set([...existing.items, ...items])).filter(
          (v) => v.length > 0,
        )
        const merged = { messageId, items: mergedItems }
        // G-704(2026-09-29 立)值等价即不写:done 事件重放 / 历史加载与 done 先后到齐时,
        // 同一批 items 会被再送一次。原先无条件重建 notices[existingIdx] 与整个数组引用
        // ⇒ 订阅侧收到"变了"。等价时**原样返回 s**(一个对象都不重建)。
        if (areRecordValuesEqual(existing, merged)) return s
        notices[existingIdx] = merged
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
      if (fromIndex < 0 || fromIndex >= bucket.length || toIndex < 0 || toIndex >= bucket.length)
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

  // G-171b 终态落账:只追加不判语义(枚举本体在 shared input-notices);每桶上限 20,
  // 与 sideQueue 桶的 slice(-20) 持久化淘汰同纪律。未知会话直接建桶。
  recordQueueSendOutcome: (conversationId, itemId, outcome) =>
    set((s) => {
      const bucket = s.queueSendOutcomes[conversationId] ?? []
      const next = [
        ...bucket.filter((e) => e.itemId !== itemId),
        { itemId, outcome, at: Date.now() },
      ]
      return {
        queueSendOutcomes: { ...s.queueSendOutcomes, [conversationId]: next.slice(-20) },
      }
    }),

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

  // D151(2026-09-29 立)终端"等待输入"态。与 terminalOutputs 并列而不复用那份:
  // 后者是"它在输出",本切片是"它停住了、在等你敲一行",两态可以同时为真。
  // patch 语义 = 逐字段覆盖合并(提交前后只动 submitting/failed,不必回带原文)。
  setTerminalInteraction: (terminalId, patch) =>
    set((s) => {
      if (!terminalId) return s
      const prev = s.terminalInteractions[terminalId]
      const merged: TerminalInteractionState = {
        promptTail: '',
        waitingSinceMs: 0,
        maxInputChars: 0,
        submitting: false,
        failed: false,
        ...prev,
        ...patch,
      }
      const next: Record<string, TerminalInteractionState> = {
        ...s.terminalInteractions,
        [terminalId]: merged,
      }
      // 键数封顶复用 terminalOutputs 那一档(同一轮终端数同一量级):
      // 对象字符串键保持插入序,超出淘汰最旧,长会话不累积空把手。
      const keys = Object.keys(next)
      if (keys.length > TERMINAL_OUTPUT_MAX_KEYS) {
        for (const stale of keys.slice(0, keys.length - TERMINAL_OUTPUT_MAX_KEYS)) {
          delete next[stale]
        }
      }
      return { terminalInteractions: next }
    }),

  clearTerminalInteraction: (terminalId) =>
    set((s) => {
      if (!(terminalId in s.terminalInteractions)) return s
      const next = { ...s.terminalInteractions }
      delete next[terminalId]
      return { terminalInteractions: next }
    }),

  noteStreamSessionId: (sessionId) => set({ aiStreamSessionId: sessionId }),

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

  // D115:审查结论累积。index=1 是生产端(1-based)新一轮审查的首帧 ——
  // 重连重放与"再审查一次"都从这里重来,先清旧表再落首条;同 findingId 幂等丢弃。
  appendReviewFinding: (messageId, finding) =>
    set((s) => {
      if (!messageId || !finding?.findingId) return s
      const existing = finding.index === 1 ? [] : (s.reviewFindingsByMessageId[messageId] ?? [])
      if (existing.some((f) => f.findingId === finding.findingId)) return s
      return {
        reviewFindingsByMessageId: {
          ...s.reviewFindingsByMessageId,
          [messageId]: [...existing, finding],
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

  // P1 token 用量写入消息级 meta(2026-08-15 立):后端 SSE onUsage 回调写入 meta.usage
  updateMessageMeta: (messageId, meta) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === messageId)
      if (idx === -1) return s
      const target = s.messages[idx]
      if (!target) return s
      const mergedMeta: Record<string, unknown> = { ...(target.meta ?? {}), ...meta }
      // G-704(2026-09-29 立)值等价即不写:高频 SSE 写入位(send-message 每 800ms 的
      // meta.usage 估算)每帧都新造一个对象,而值常常一个字节都没变。原先无条件
      // 重建消息对象 + 整个 messages 数组 ⇒ 订阅方每次拿到新引用 ⇒ store→effect→set 自环
      // 与整列表重渲染。比较必须**等深**(usage 是嵌在 meta 下的对象,只比顶层键等于没比)。
      // 等价时原样返回 s:连对象都不重建,这样引用相等断言才判得出"确实没写"。
      if (areRecordValuesEqual(target.meta ?? {}, mergedMeta)) return s
      const next = s.messages.slice()
      next[idx] = { ...target, meta: mergedMeta }
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
})

/**
 * 票60 第一切片:按 persistName 产出一份全新的 chat store 实例。
 * 默认名 'ihui-chat' 即既有单例的持久化键 —— useChatStore(下方)就是
 * `createChatStore()` 的返回值,既有消费面行为分毫不变。
 * 多窗格实例各自传不同 persistName(见 stores/chat-panes.ts),否则两条实例
 * 会在同一个 localStorage key 上互相覆盖快照。
 */
export function createChatStore(persistName: string = 'ihui-chat') {
  return create<ChatState>()(
    persist(buildChatState, {
      name: persistName,
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
        // D09(2026-10-24):专家包自动路由档位(同上,初始 state 已有 localStorage 双保险)
        expertAutoRoute: s.expertAutoRoute,
        // D01(2026-10-25):对话内选中的专家(同上,初始 state 已有 localStorage 双保险)
        selectedAgentId: s.selectedAgentId,
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
    }),
  )
}

/** 默认单例:既有全部消费面的入口,行为与工厂化前分毫不变 */
export const useChatStore = createChatStore()

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
