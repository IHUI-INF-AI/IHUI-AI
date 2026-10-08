// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { PermissionModeId } from './permission-mode.js'

/** 唯一真源见 ./permission-mode(G-161);此处保留旧名以不破坏既有 import。 */
export type PermissionMode = PermissionModeId

export type PermissionDecision = 'allow' | 'deny' | 'ask'

export type DangerLevel = 'read' | 'write' | 'dangerous'

export interface PermissionRules {
  allow?: string[]
  deny?: string[]
  ask?: string[]
  mode?: PermissionMode
}

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}

export type PlanState = 'initialized' | 'gathering' | 'executing' | 'done' | 'cancelled'

export type PlanEvent = 'start' | 'gather_complete' | 'execute_complete' | 'cancel' | 'reset'

export interface PlanContext {
  currentState?: PlanState
  messages?: unknown[]
  planSteps?: string[]
  currentStepIndex?: number
}

export type HookEvent =
  | 'preToolCall'
  | 'postToolCall'
  | 'userPromptSubmit'
  | 'preCompact'
  | 'postCompact'
  | 'notification'
  | 'stop'
  | 'stopFailure'
  | 'postToolUseFailure'
  | 'permissionDenied'
  | 'subagentStart'
  | 'subagentStop'
  | 'sessionStart'
  | 'sessionEnd'

export interface HookContext {
  workspacePath?: string
  sessionId?: string
  toolName?: string
  toolArgs?: unknown
  toolResult?: unknown
  prompt?: string
  error?: string
  reason?: string
  subagentId?: string
  subagentType?: string
  compactedTokensBefore?: number
  compactedTokensAfter?: number
  notificationText?: string
}

export interface HookEntry {
  name: string
  command?: string
  webhook?: string
  method?: 'POST' | 'PUT' | 'GET'
  headers?: Record<string, string>
  body?: string
  matchTool?: string
  blockOnError?: boolean
  timeout?: number
}

export interface HooksConfig {
  preToolCall?: HookEntry[]
  postToolCall?: HookEntry[]
  sessionStart?: HookEntry[]
  sessionEnd?: HookEntry[]
  userPromptSubmit?: HookEntry[]
  preCompact?: HookEntry[]
  postCompact?: HookEntry[]
  notification?: HookEntry[]
  stop?: HookEntry[]
  stopFailure?: HookEntry[]
  postToolUseFailure?: HookEntry[]
  permissionDenied?: HookEntry[]
  subagentStart?: HookEntry[]
  subagentStop?: HookEntry[]
}

export interface HookResult {
  proceed: boolean
  reason?: string
}

export type JSONSchemaType =
  'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'null'

export interface JSONSchema {
  type?: JSONSchemaType | JSONSchemaType[]
  description?: string
  properties?: Record<string, JSONSchema>
  required?: string[]
  items?: JSONSchema
  enum?: (string | number | boolean | null)[]
  additionalProperties?: boolean | JSONSchema
  [key: string]: unknown
}

export interface PersonaContract {
  input_schema: JSONSchema
  output_schema: JSONSchema
}

export type PersonaContracts = Record<string, PersonaContract>

export type SessionStatus = 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * D103 子智能体实例七态(P 协议层;对标 Codex `localConversation.multiAgentAction.agentState`)。
 *
 * **与 `SessionStatus` 的分工(不另建第二套枚举)**:
 *   · `SessionStatus` 是**会话级**四态(粗粒度,用于会话列表/生命周期);
 *   · 本枚举是**实例级**七态(细粒度),含会话级**完全没有**的三个终态 ——
 *     `pendingInit`(已受理、尚未就绪)、`shutdown`(已关闭)、`notFound`(找不到;竞品有而我方此前无处表达)。
 *   · 两者经 `sessionStatusFromInstance()` **单向下映射**;禁止两套各自演化后再互相比较。
 *
 * 现状取证(2026-09-23):运行时只产出 `subagentStart` / `subagentStop` 两个事件,故本枚举是**新增能力**,
 * 消费方在事件落到七态之前不得假装已有细粒度状态。
 */
export const AGENT_INSTANCE_STATES = [
  'running',
  'completed',
  'errored',
  'interrupted',
  'pendingInit',
  'shutdown',
  'notFound',
] as const

/** 子智能体实例态 */
export type AgentInstanceState = (typeof AGENT_INSTANCE_STATES)[number]

/**
 * 实例七态 → 会话级四态(**唯一映射**;新增实例态时本函数会因 switch 不穷尽而编译失败,防漏改)。
 * `pendingInit` 归 `running`(已受理未就绪仍处活动期);`shutdown` / `notFound` 归 `cancelled`。
 */
export function sessionStatusFromInstance(state: AgentInstanceState): SessionStatus {
  switch (state) {
    case 'running':
    case 'pendingInit':
      return 'running'
    case 'completed':
      return 'completed'
    case 'errored':
      return 'failed'
    case 'interrupted':
    case 'shutdown':
    case 'notFound':
      return 'cancelled'
  }
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp?: string
  toolCallId?: string
  toolName?: string
}

export interface SessionState {
  id: string
  sessionId: string
  createdAt: string
  updatedAt: string
  model?: string
  messages: SessionMessage[]
  toolState?: Record<string, unknown>
  cwd?: string
  status: SessionStatus
  error?: string
}

export interface SessionSummary {
  id: string
  createdAt: string
  updatedAt: string
  status: SessionStatus
}

export type SubagentPersona = 'researcher' | 'coder' | 'reviewer' | 'planner' | 'general'

// ─────────────────────────────────────────────────────────────────────────────
// 2026-10-08 C2 收口:以下业务域自本文件拆出(拆分前本文件 2164 行 > C2 上限 2000),
// 经 export * 再导出,公开导出面逐名等值;守门静态锚定的词汇域仍实体留在本文件
// (PermissionMode=门68;AGENT_INSTANCE_STATES=实例状态导出契约;AGENT_TASK_STATUSES/
// AGENT_TURN_STOP_REASONS=守门151;AgentSSEEvent=事件对账门;CONNECTION_CAPABILITY_FIELDS=能力位门)。
// ─────────────────────────────────────────────────────────────────────────────
import type { CapabilityMode, IsolationMode } from './agent-runtime-skills.js'
import type { GitOperation } from './agent-runtime-integrations.js'

export * from './agent-runtime-skills.js'
export * from './agent-runtime-memory.js'
export * from './agent-runtime-integrations.js'
export * from './agent-runtime-orchestration.js'

// ============================================================================
// 多 Agent 并行执行契约(2026-07-22 立,对标 Hermes Kanban + Claude Agent Teams)
// 跨端共享:ai-service(DAG worker pool)+ cli(子进程并行)+ api(Kanban API)+ web(工作台 UI)
// ============================================================================

/**
 * Agent 任务 Kanban 状态机(6 列,对标 Hermes Agent Kanban)。
 *
 * 状态流转:
 *   triage → todo → ready → in_progress → done
 *                    ↓           ↓
 *                 blocked ←──────┘
 *
 * - triage: 新建未分类(待 librarian/主 agent 评估优先级和分派)
 * - todo: 已分类待执行(优先级已定,等待 worker 空闲)
 * - ready: 已就绪可执行(依赖已满足,等待 worker pick)
 * - in_progress: 执行中(worker 已 pick)
 * - blocked: 阻塞中(依赖未满足 / 工具失败 / 等待人工)
 * - done: 已完成(成功 or 失败,终态)
 *
 * **单一真相源 = 下面的 `AGENT_TASK_STATUSES`**(2026-09-27 D6/G3 收口)。
 * 联合类型由该数组派生,所以"编译期联合"与"运行时清单"不可能分叉 —— 此前它们是两格
 * (数组端内各抄一份、联合住在 types),而守门 `check-background-task-type-parity` 只管
 * executor 接线、`check-agent-event-parity` 只管 SSE 事件名,**这一族成员集合全仓零判据**
 * (取证见 docs/d6-convergence-audit-2026-09-27.md §2.3)。
 *
 * ⚠️ **这批字符串值全部是对外契约,不得改名/删成员/改拼写**(三条独立证据):
 *   ① 落库列:`packages/database/src/schema/agent-tasks.ts:31` `varchar('status', {length:20})`
 *      (默认值 `'pending'` 是 legacy 档,由 `LEGACY_STATUS_MAP` 读取时归一);
 *   ② REST 契约:`apps/api/src/routes/agents-kanban.ts` 的 status 过滤与 transition 请求体
 *      `z.enum`(已改为从本数组派生,端内不再抄第二份成员清单);
 *   ③ SSE 帧载荷:`apps/api/src/routes/agents-kanban.ts` 的
 *      `broadcastSSEEvent({ type: 'task_*' })` 携带 `status` 字段直推前端。
 * 新增一档的正确顺序 = 改本数组 → 补 `ALLOWED_TRANSITIONS` 边 → 补 `STATUS_VARIANTS` →
 * 补 Python 对齐表(`apps/ai-service/app/services/dag_scheduler.py`)→ **同枚提交**补齐
 * `agents.kanban.<status>` 五语言词表(AGENTS §30:状态词汇是一等契约)。
 * 常驻尺子:`scripts/check-agent-status-vocabulary-parity.mjs`。
 *
 * **G-462/G-1038476(2026-10-07 机主拍板,推翻 09-28「维持六档」):六档拆出四个独立终态档**。
 * 此前 `failed/cancelled/quota_exceeded/preempted` 四档(由 subagent-dispatch 写入 agent_tasks
 * 的终态)经 `LEGACY_STATUS_MAP` 同落 `blocked`,「被取消(重跑大概率就好)」与「待解阻塞
 * (要先去解阻塞)」在看板上同形,一条视觉信号指错两个相反的下一步动作;上游
 * dw/src/engine/errors.ts 的分级判据是「能不能被 catch」而非严重程度,`Interrupted` 类
 * (进程被杀/被抢占)必须有独立码,否则与「脚本真失败」只能靠 message 文本区分。
 * 拆分映射(保留 `blocked` 只给真正待解阻塞):
 *   - `cancelled` → `cancelled`(被取消,重跑即可);
 *   - `preempted` → `preempted`(被抢占,上游 Interrupted 类,独立码);
 *   - `quota_exceeded` → `quota_exceeded`(配额超限,上游 ProviderStop 类);
 *   - `failed` → `execution_failed`(脚本真失败,读 errorMessage 查因)。
 *     ⚠️ 新档**不能**叫 `failed`:第二域 `WORKSPACE_AGENT_TASK_STATUSES` 已占用该拼写,
 *     SV2 判「两域成员集合交集必须为空」,故取 `execution_failed`(语义 = 执行失败)。
 *   四个新档都是终态(合法流转出边为空):它们由 dispatch 侧直接写入,不是看板手动流转的目标。
 */
export const AGENT_TASK_STATUSES = [
  'triage',
  'todo',
  'ready',
  'in_progress',
  'blocked',
  'cancelled',
  'execution_failed',
  'quota_exceeded',
  'preempted',
  'done',
] as const

export type AgentTaskStatus = (typeof AGENT_TASK_STATUSES)[number]

/**
 * 第二域:workspace 进程内 agent 任务状态(`/api/workspace/agent/tasks`)。
 *
 * **它与上面的 Kanban 六态不是同一件事的两种写法,而是两个域** —— 值集合起来是
 * `running/completed/failed/canceled` 对 `triage/todo/ready/in_progress/blocked/done`,
 * 交集为空(本门 SV2 机器判这一条)。审计原文:
 * docs/d6-convergence-audit-2026-09-27.md §2.3"第四套 … 与 kanban 六态不同域不同名,无映射"。
 * 所以处置不是"把第四套并进六态"(那会改坏 `/api/workspace/agent/tasks` 的响应值),
 * 而是**把它也登记成一处、端内只引用**,免得第五份 `STATUS_CLASS` 靠 fallback 顶。
 *
 * ⚠️ 这四个值同样是对外契约(生产侧 `apps/api/src/services/workspace-ai-service.ts:335`
 * 的 `export type AgentTaskStatus = 'running' | 'completed' | 'failed' | 'canceled'` 直接
 * 落进响应),拼写不得改。注意同文件 :1483 另有 `BgAgentStatus` 写作 **`cancelled`(双 l)** ——
 * 那是第三个域的第三种拼写,不在本域射程,已按"同词不同义不得并置"登记为已知分叉。
 */
export const WORKSPACE_AGENT_TASK_STATUSES = ['running', 'completed', 'failed', 'canceled'] as const

export type WorkspaceAgentTaskStatus = (typeof WORKSPACE_AGENT_TASK_STATUSES)[number]

/**
 * 第二域(工作空间进程内任务态)的 i18n 键表 —— **键集由上面那张登记表推导**,不再抄一份成员清单:
 * 抄一份就等于多出第二处要同步的地方(守门 151 SV3 判的正是"端内再抄第二份成员清单"那一型)。
 * 词条五语言必须同批齐(AGENTS §30);漏一条的端上表现是徽章把 `agentTasks.statusFailed`
 * 原样回显给用户,看护在 `packages/types/tests/agent-status-vocabulary-labels.test.ts`
 * (它同时钉了"漏一条 ⇒ 判红"的构造面反例,所以这张表不是自证的)。
 */
export const WORKSPACE_AGENT_TASK_STATUS_LABEL_KEYS = Object.fromEntries(
  WORKSPACE_AGENT_TASK_STATUSES.map(
    (s) => [s, `agentTasks.status${s.charAt(0).toUpperCase()}${s.slice(1)}`] as const,
  ),
) as Record<WorkspaceAgentTaskStatus, string>

/**
 * 取第二域某一档的 i18n 键;登记表之外的值一律 null,不替未知值猜一档。
 * 刻意不让 `cancelled`(双 l)通过:那是第三域的拼写,认领它等于把两域在端内并成一张表
 * (拼写分叉的登记见本文件上方 `WORKSPACE_AGENT_TASK_STATUSES` 的注释)。
 */
export function workspaceAgentTaskStatusLabelKey(status: string): string | null {
  return Object.prototype.hasOwnProperty.call(WORKSPACE_AGENT_TASK_STATUS_LABEL_KEYS, status)
    ? WORKSPACE_AGENT_TASK_STATUS_LABEL_KEYS[status as WorkspaceAgentTaskStatus]
    : null
}

/**
 * 第四个域(G-816003,2026-10-08):后台任务**终止**的词汇 —— 一次终止同时投影成
 * 每个消费面各自的那一列词,而不是让每个消费面各自拼字符串。
 *
 * **它问的是另一条轴。** `BackgroundTaskStatus`(apps/cli 注册表)答的是"进程怎么没的"
 * (exited/killed/error/lost);本表答的是"**谁让它停的、这一档该不该被再发起**"。
 * 上游同构:`packages/ui/src/v4` 的 `notificationStatus` 把一次终止折成
 * registry / notification / subagent-event / background-event 四列 —— **runStatus 讲真话,
 * 通用词折起来**。本表是那张表在本仓的落点。
 *
 * 与 `AGENT_TASK_STATUSES` / `WORKSPACE_AGENT_TASK_STATUSES` 刻意**不相交**:
 * 那两个是落库列 + REST `z.enum` + SSE 载荷的对外契约(G-816025/G-816026 已定,动它等于改契约);
 * 本表值一律 kebab-case,所以守门 151 的 SV2"两域交集必须为空"照旧成立、SV3 也不会把本表
 * 的成员当成 Kanban 抄本。**本表不进守门 151 的 SV1/SV2 射程**(它判的是 Kanban 那一族四处副本);
 * 它的常驻尺子在 `apps/cli/tests/g-816003-termination-vocab.test.ts`(行集闭合 + 按发起方分支 + 成对反向锁)。
 *
 * ⚠️ 同一词不同义:本表**不得**并置进任何 barrel 去顶掉 `AGENT_TASK_STATUSES`
 * (AGENTS §27 那条"同词不同义的两张名单不得并置"的教训就在这儿)。
 */
export const BACKGROUND_STOP_REASONS = [
  'user',
  'model',
  'superseded',
  'timed-out',
  'unknown',
] as const

export type BackgroundStopReason = (typeof BACKGROUND_STOP_REASONS)[number]

/**
 * 第五个域(G-815977,2026-10-08):ai-service **回合终态**(done 帧 `stop_reason`)
 * 的封闭集。Python 侧单一真相源 = `apps/ai-service/app/core/turn_stop_reason.py` 的
 * `TurnStopReason`(StrEnum);本表是跨语言对齐表(AGENTS §3 共享类型单一源),
 * 等值由守门 151 的 SV5 判 —— 没有门看守的登记表必然腐烂(§4 教训)。
 *
 * 与上面 `BACKGROUND_STOP_REASONS` 是**两条轴**:那边答"谁让后台任务停的",
 * 这边答"回合以哪一档收口"。`cancelled` / `canceled` 两式刻意同档收编
 * (V1 消费端对旧客户端的兼容契约),收口不得清零任何一式。
 */
export const AGENT_TURN_STOP_REASONS = [
  'completed',
  'cancelled',
  'canceled',
  'paused',
  'error',
  'max_iterations',
  'budget_exceeded',
  'budget_limited',
  'verification_not_achieved',
  'verification_undetermined',
  'goal_blocked',
] as const

export type AgentTurnStopReason = (typeof AGENT_TURN_STOP_REASONS)[number]

/**
 * `resumeStance` 是**文案分支的判据**,不是一段中文的缩写:
 *  - `forbid-implication` ⇒ 呈现面**不得**出现任何"可继续/可重跑/resume"的暗示(用户手停);
 *  - `open` ⇒ 呈现面**不得**反过来劝"别重跑"(模型自停/被取代 —— 重发是正当下一步);
 *  - `neutral` ⇒ 两边都不说(发起方未记录,不猜)。
 * 反向锁由测试钉住:只判"含不含某个词"会把两档折成一档。
 */
export type BackgroundResumeStance = 'forbid-implication' | 'open' | 'neutral'

export interface BackgroundTerminationVocabRow {
  /** 主键:停止发起方轴。值域 = `BACKGROUND_STOP_REASON` 封闭集。 */
  stopReason: BackgroundStopReason
  /** 列① registry —— 注册表/台账侧的稳定机器词(落盘、可 diff,不随措辞变)。 */
  registry: string
  /** 列② notification —— 播报里进 `cli.bgNoticeStatus` 的 `{status}` 槽的词。 */
  notification: string
  /** 列③ subagent-event —— 子代理事件帧的 status 词(该面接线见交付报告残余①)。 */
  subagentEvent: string
  /** 列④ background-event —— 后台事件/名册投影的 status 词(同上,残余①)。 */
  backgroundEvent: string
  /** 该档的补充指引 i18n 键(用户可见文案唯一通道);空串 = 这一档今天没有额外句子。 */
  guidanceKey: string
  /** 分支判据(见类型注释)。 */
  resumeStance: BackgroundResumeStance
}

/**
 * 一张表 × 每消费面一列 —— **唯一真相源**。端内(播报、名册、事件帧、面板)
 * **不得**再各自写一份同值字符串清单(守门 121/115 判的"声明无消费者"与本仓"两处算同一件事必漂移"
 * 是同一条禁令的两面)。取值一律经 `backgroundTerminationRowOf()` 查,不许散写。
 *
 * `timed-out` 那行的 `guidanceKey` 是**既有键** `cli.bgNoticeTimedOut`(那句话早就在播报里,
 * 不另立新句、也不许把它复制成第二份文本);`superseded` 那一档今天 CLI 侧**还没有生产者**
 * (`killTask` 的 initiator 值域是 `'user' | 'model' | null`,G-816026 已交付、本票不动它),
 * 行先立在表里是为了第二发起方落地时**只改入参**、不在别处再抄一遍分支。
 */
export const BACKGROUND_TERMINATION_VOCAB: readonly BackgroundTerminationVocabRow[] = [
  {
    stopReason: 'user',
    registry: 'killed-by-user',
    notification: 'stopped-by-user',
    subagentEvent: 'user_cancelled',
    backgroundEvent: 'stopped-by-user',
    guidanceKey: 'cli.bgNoticeStoppedByUser',
    resumeStance: 'forbid-implication',
  },
  {
    stopReason: 'model',
    registry: 'killed-by-model',
    notification: 'stopped-by-model',
    subagentEvent: 'model_cancelled',
    backgroundEvent: 'stopped-by-model',
    guidanceKey: 'cli.bgNoticeStoppedByModel',
    resumeStance: 'open',
  },
  {
    stopReason: 'superseded',
    registry: 'killed-as-superseded',
    notification: 'superseded-by-newer-run',
    subagentEvent: 'superseded',
    backgroundEvent: 'superseded',
    guidanceKey: 'cli.bgNoticeStoppedBySuperseded',
    resumeStance: 'open',
  },
  {
    stopReason: 'timed-out',
    registry: 'killed-by-deadline',
    notification: 'timed-out',
    subagentEvent: 'timeout',
    backgroundEvent: 'timed-out',
    guidanceKey: 'cli.bgNoticeTimedOut',
    resumeStance: 'neutral',
  },
  {
    stopReason: 'unknown',
    registry: 'stop-initiator-unrecorded',
    notification: 'stopped-cause-unknown',
    subagentEvent: 'unknown',
    backgroundEvent: 'stopped-cause-unknown',
    guidanceKey: 'cli.bgNoticeStopInitiatorUnknown',
    resumeStance: 'neutral',
  },
] as const

/** 主键 → 行。按主键建表时顺手生成,不在第二处重列成员。 */
const BACKGROUND_TERMINATION_ROW_BY_KEY: ReadonlyMap<string, BackgroundTerminationVocabRow> =
  new Map(BACKGROUND_TERMINATION_VOCAB.map((row) => [row.stopReason as string, row]))

/** 发起方未记录时的兜底行 —— 中性档,**绝不**默认成 `user`。 */
export const BACKGROUND_TERMINATION_UNKNOWN_ROW: BackgroundTerminationVocabRow =
  BACKGROUND_TERMINATION_ROW_BY_KEY.get('unknown')!

/**
 * 取某一档的行。**只认已落盘的发起方值**,未知/缺席 ⇒ 落 `unknown` 行并原样把传入值回传
 * (`resolved:false`),让调用方能把它登记成"未判定"而不是悄悄折成 user/model
 * (AGENTS §5c「按 signal 猜」那一型就是靠这种静默折叠活下来的)。
 */
export function backgroundTerminationRowOf(stopReason: string | null | undefined): {
  row: BackgroundTerminationVocabRow
  resolved: boolean
} {
  const row =
    stopReason === null || stopReason === undefined
      ? undefined
      : BACKGROUND_TERMINATION_ROW_BY_KEY.get(stopReason)
  return row
    ? { row, resolved: true }
    : { row: BACKGROUND_TERMINATION_UNKNOWN_ROW, resolved: false }
}

/**
 * D152(2026-09-29 立,用户拍板「六态」):会话内「目标(goal)」状态机的封闭集 ——
 * **第三个域**,与上面两个刻意不相交、也不得并集:
 *  · `AGENT_TASK_STATUSES` 是 Kanban 任务卡的六列(triage/todo/ready/in_progress/blocked/done),
 *    `blocked`/`done` 在此处**同词不同义**(那两列讲"这张卡卡住了/做完了",这里讲
 *    "这一会话的目标被阻塞/达成"),把两个域并起来等于改两套对外契约;
 *  · `WORKSPACE_AGENT_TASK_STATUSES` 是 workspace 进程内任务态(running/completed/…)。
 * 判据:`scripts/check-agent-status-vocabulary-parity.mjs` 的 SV2 要求登记域两两不相交,
 * 而 goal 域**不进**那张表(它没有跨语言第二副本 —— 服务端同一份值在
 * `apps/ai-service/app/services/session_store.py::GOAL_STATUSES`,两处同名常量由
 * `packages/shared/src/sse/__tests__/contract.test.ts` 的在位断言看护)。
 * 与 CLI 的 `budget_limited` / 预算帧 critical 档语义对齐(AGENTS §8)。
 * ⚠️ 新增一档必须同枚提交补齐 `chat.goal.status.*` 五语言词表(AGENTS §19/§30),
 *    不得端内硬编码中文。
 */
export const GOAL_STATUSES = [
  'active',
  'paused',
  'blocked',
  'done',
  'usageLimited',
  'budgetLimited',
] as const

/** 下行帧 `goal_updated` 额外允许的目标态:cleared(单帧承载清除,不建第二帧)。 */
export const GOAL_WIRE_STATUSES = [...GOAL_STATUSES, 'cleared'] as const

export type GoalStatus = (typeof GOAL_STATUSES)[number]
export type GoalWireStatus = (typeof GOAL_WIRE_STATUSES)[number]

// ---------------------------------------------------------------------------
// 状态机运行时常量(2026-09-11 2-2 P1:跨端单一来源)
// api(transition/admin PUT 校验)与 web(流转按钮禁用)共用,避免两处表漂移。
// ---------------------------------------------------------------------------

/** Kanban 列合法流转图(单一来源)。四个终态档(G-462 拆分)出边为空:由 dispatch 侧写入,非手动流转目标 */
export const ALLOWED_TRANSITIONS: Record<AgentTaskStatus, AgentTaskStatus[]> = {
  triage: ['todo', 'blocked', 'done'],
  todo: ['ready', 'blocked', 'done'],
  ready: ['in_progress', 'blocked'],
  in_progress: ['done', 'blocked'],
  blocked: ['todo', 'ready'],
  cancelled: [],
  execution_failed: [],
  quota_exceeded: [],
  preempted: [],
  done: [],
}

/**
 * 旧表 status 兼容映射(读取时转换 legacy → Kanban)。
 *
 * G-462/G-1038476(2026-10-07 机主拍板):四个 dispatch 终态不再同落 `blocked`,各自映射
 * 独立新档(`cancelled/preempted/quota_exceeded` 逐字同名晋升为在册档;`failed` 因第二域
 * 占用该拼写而映射到 `execution_failed`)。`blocked` 从此只收真正待解阻塞 ——
 * 「重跑就好」「读日志查因」「先解阻塞」三种下一步动作在列头上可分。
 */
export const LEGACY_STATUS_MAP: Record<string, AgentTaskStatus> = {
  pending: 'triage',
  running: 'in_progress',
  completed: 'done',
  failed: 'execution_failed',
  cancelled: 'cancelled',
  quota_exceeded: 'quota_exceeded',
  preempted: 'preempted',
}

/** 过滤时 Kanban status → DB status 变体(含 legacy)。`execution_failed` 吸收旧写法 `failed` */
export const STATUS_VARIANTS: Record<AgentTaskStatus, string[]> = {
  triage: ['triage', 'pending'],
  todo: ['todo'],
  ready: ['ready'],
  in_progress: ['in_progress', 'running'],
  blocked: ['blocked'],
  cancelled: ['cancelled'],
  execution_failed: ['execution_failed', 'failed'],
  quota_exceeded: ['quota_exceeded'],
  preempted: ['preempted'],
  done: ['done', 'completed'],
}

/**
 * DB status(含 legacy 终态)→ Kanban status。
 *
 * G-463(2026-10-04 补注,行为**未变**):本函数的返回类型标注是 `AgentTaskStatus`,
 * 但实现对未登记值是**原样透传**并带 `as AgentTaskStatus` 断言 —— 编译期完全静默,
 * 运行时那个值不是任何一档。**刻意不在这里改签名**:本函数是既有对外契约的一环
 * (kanban 载荷逐字断言 + admin 广播 + 五端渲染),改签名会把"读侧"与"写侧"一起掀翻,
 * 远超本票射程。真正的收口是**所有需要判合法性的地方都改走已存在的
 * `statusOrUnrecognized` / `isAgentTaskStatus` / `isTransitionAllowedFromRaw`**,
 * 本函数只保留"归一"职责。
 *
 * ⚠️ 因此**禁止**把本函数的返回值直接当下标去查 `ALLOWED_TRANSITIONS` —— 那样会求值成
 * `undefined` 再 `.includes()` ⇒ `TypeError`。要判流转合法性请用 `isTransitionAllowedFromRaw`。
 */
export function mapStatus(raw: string): AgentTaskStatus {
  return LEGACY_STATUS_MAP[raw] ?? (raw as AgentTaskStatus)
}

/**
 * 四种 dispatch 终态的**成因**点名层(2026-09-28 立:当时不动枚举,只加次级标记)。
 *
 * ⚠️ **2026-10-07(G-462/G-1038476 机主拍板)本层的前提已被推翻、出口保留**:
 * 上面写的「不动六档枚举」「否掉六档变七档」两条拍板当轮成立,但 G-462 的等拍板票最终
 * 裁定**采纳拆分** —— 四档经 `LEGACY_STATUS_MAP` 各自映射独立新档(见该表头注),
 * 不再折叠进 `blocked`。因此本层从"被折叠终态的唯一点名手段"降级为**次级成因标记**:
 * `terminationOf` 判据(值集 = `COLLAPSED_TERMINATIONS`)、键表、五语言词条与既有用例
 * 全部原样保留 —— 卡片落在自己的终态列后,标记仍为扁平列表/无障碍读屏点名成因,
 * 且 `failed` 不得复用 `terminatedCancelled` 文案的那条禁令继续有效。
 * (成员集与 `LEGACY_STATUS_MAP` 的四个新目标档同名,是刻意的历史连续性,不是第二份真相。)
 *
 * 历史立层理由(为什么必须有这一层):这四档与"真的在等解阻塞"在折叠后完全同形,而它们的
 * 下一步动作相反 ——「已取消 / 配额超限 / 被抢占」重跑大概率就好,「待解阻塞」要先去解阻塞,
 * **而「执行失败」要去读 errorMessage 查因**。用户按同一张脸决定重跑、去解阻塞、还是去查日志,
 * 是被状态显示指错了方向。
 *
 * ⚠️ **2026-10-05(G-1018245,用户拍板路 B)`failed` 由"不在册"改为"在册"**:
 * 09-28 首版只收了三种,`failed` 被有意排除,理由写在原 `terminationOf` 注释里 ——
 * 「把真失败说成被取消,比不标更糟」。该理由**本身仍然成立**(所以
 * `failed` 必须有自己的文案键 `terminatedFailed`,不许复用 `terminatedCancelled`),
 * 但它成立的方式是"给 failed 一个**独立的**键",而不是"让 failed 落回裸 blocked":
 * 排除出册的实测后果是 **`failed` 是四档里唯一在看板上完全不可点名的** —— 它与
 * 真的·阻塞同形、与三档终态也同形,用户在四张同形的脸里读不到任何成因。
 * (09-28 当轮同时否掉的「六档变七档」已由 2026-10-07 拍板采纳,见本注释顶部。)
 */
export const COLLAPSED_TERMINATIONS = [
  'failed',
  'cancelled',
  'quota_exceeded',
  'preempted',
] as const
export type AgentTaskTermination = (typeof COLLAPSED_TERMINATIONS)[number]

/** 次级标记的 i18n 键(单一来源;`agents.kanban.*` 五语言必须同批齐,守门 151 同一条口径) */
export const TERMINATION_LABEL_KEYS: Record<AgentTaskTermination, string> = {
  // 四档各有自己的键,逐字不同:复用 `terminatedCancelled` 就会把"执行失败"说成"被取消",
  // 正是 09-28 排除 failed 时写下的那句「把真失败说成被取消,比不标更糟」。
  failed: 'agents.kanban.terminatedFailed',
  cancelled: 'agents.kanban.terminatedCancelled',
  quota_exceeded: 'agents.kanban.terminatedQuotaExceeded',
  preempted: 'agents.kanban.terminatedPreempted',
}

/**
 * 取原始状态里的终态成因;非终态(含 `blocked` 本身)一律返回 null。
 *
 * 仍然不为未知值猜测一档:库里出现四档之外的串,归`statusOrUnrecognized` 的"未识别"档
 * (见下方),不归这里 —— 两个出口的职责是正交的,不是同一判断的两个名字。
 */
export function terminationOf(raw: string | null | undefined): AgentTaskTermination | null {
  if (typeof raw !== 'string') return null
  return (COLLAPSED_TERMINATIONS as readonly string[]).includes(raw)
    ? (raw as AgentTaskTermination)
    : null
}

// ---------------------------------------------------------------------------
// "未识别"档(2026-09-28 立):落在六档之外的状态值的唯一归一出口
// ---------------------------------------------------------------------------

/**
 * **刻意不并进 `AGENT_TASK_STATUSES`,也刻意不进 `COLLAPSED_TERMINATIONS`**:
 *   · 六档值是落库列 + REST `z.enum` + SSE 载荷三重对外契约(见上方 AGENT_TASK_STATUSES 头注),
 *     加一档等于改对外契约;
 *   · `COLLAPSED_TERMINATIONS` 的语义是"被折叠进 blocked 的**已知**终态成因",
 *     把一个没人认得的值写成终态就是替它猜一个结论 —— 那正是 AGENTS §30
 *     「钩子无终态不得渲染成"完成"」点名的失效型。
 * 所以本档只做两件事:让外部写进来的未知状态**独立呈现**,并让它**只以一个计数**存在 ——
 * 既不被塞进任何已知列,也不被静默读成成功或失败。
 */
export const UNRECOGNIZED_STATUS = 'unrecognized' as const

export type UnrecognizedStatus = typeof UNRECOGNIZED_STATUS

/** 六档 ∪ 未识别档:只有"取呈现档位"这一维需要同时容纳两者 */
export type KanbanStatusBucket = AgentTaskStatus | UnrecognizedStatus

/** 未识别档的徽章文案键(与 TERMINATION_LABEL_KEYS 同一条规矩:键只在 types 有一份) */
export const UNRECOGNIZED_STATUS_LABEL_KEY = 'agents.kanban.unrecognizedStatus'

/**
 * 取 i18n 全键的点号末段(端内 `useTranslations('agents.kanban')` 已绑命名空间时用)。
 * 卡片与看板都要"未识别"这一枚标签,所以这段切片只许有这一份实现 ——
 * 两处各写一遍 `slice(lastIndexOf('.'))` 就是第二份真相,任一处改形态另一端只显示键名。
 */
export function i18nLeafKey(fullKey: string): string {
  return fullKey.slice(fullKey.lastIndexOf('.') + 1)
}

/** 原始值是否**逐字**落在六档内(不含 legacy 别名 —— 先过 mapStatus 再问这一句)。 */
export function isAgentTaskStatus(raw: string): raw is AgentTaskStatus {
  return (AGENT_TASK_STATUSES as readonly string[]).includes(raw)
}

export interface NormalizedKanbanStatus {
  /** 六档之一;不在六档内时恒为 UNRECOGNIZED_STATUS(绝不返回某个已知档顶替) */
  bucket: KanbanStatusBucket
  /** true = 原始值在六档之外(含空值与非字符串) */
  unrecognized: boolean
  /**
   * 仅未识别时出现:数据库里的原始状态串。用途只有两个 —— 报数与无障碍名称,
   * **不得**当可信文案直接渲染(它是外部可写的值,渲染进界面就是注入面)。
   */
  rawStatus?: string
}

/**
 * 任意状态值的唯一归一出口:先经 `LEGACY_STATUS_MAP` 归一(legacy 别名仍算已知档),
 * 落在六档内 ⇒ 返回该档;否则 ⇒ 返回未识别档并带上原值。
 *
 * 为什么必须由这里兜:`mapStatus` 对未知值是**原样透传**并带 `as AgentTaskStatus` 断言,
 * 编译期完全静默,而运行时那个值不是任何一档 —— 拿它去查 `STATUS_BADGE_CLASS` 得到
 * undefined、去 `t(status)` 会把原值当文案打出来。判不出时不猜,也不假装判得出。
 */
export function statusOrUnrecognized(raw: string | null | undefined): NormalizedKanbanStatus {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { bucket: UNRECOGNIZED_STATUS, unrecognized: true }
  }
  const mapped = mapStatus(raw)
  if (isAgentTaskStatus(mapped)) return { bucket: mapped, unrecognized: false }
  return { bucket: UNRECOGNIZED_STATUS, unrecognized: true, rawStatus: raw }
}

/** 序列化面上的"未识别"判据:只看 `KanbanTask.rawStatus` 这一个可选字段(定义见该接口)。 */
export function isUnrecognizedKanbanTask(task: Pick<KanbanTask, 'rawStatus'>): boolean {
  return typeof task.rawStatus === 'string'
}

/** 未识别档计数(唯一出口):纯数组函数,所以不必挂载组件也能被用例钉住。 */
export function countUnrecognizedTasks(tasks: readonly Pick<KanbanTask, 'rawStatus'>[]): number {
  return tasks.reduce((n, t) => (isUnrecognizedKanbanTask(t) ? n + 1 : n), 0)
}

/**
 * 取某个原始状态值可流转到的目标档位;未知状态一律返回**空表**(而不是让调用方去查一个不存在的键)。
 *
 * G-463(2026-10-04):这一层是**为 `ALLOWED_TRANSITIONS` 的直接下标查表兜底**而存在的。
 * `mapStatus` 对未登记值是原样透传(见其头注),所以 `ALLOWED_TRANSITIONS[mapStatus(raw)]`
 * 在库里出现六档之外的值时求值为 `undefined`,再 `.includes()` 就是 `TypeError` ⇒
 * kanban transition 接口 500。本函数把"查不到 ⇒ 无合法流转"这个判断收到types 里,
 * 与 `isTransitionAllowed` 同一个口径(它本就带 `?.`),使全仓不再有第二处裸下标。
 */
export function allowedTransitionsFrom(raw: string): readonly AgentTaskStatus[] {
  const mapped = mapStatus(raw)
  if (!isAgentTaskStatus(mapped)) return []
  return ALLOWED_TRANSITIONS[mapped] ?? []
}

/** 流转合法性校验(transition / admin PUT 共用) */
export function isTransitionAllowed(from: AgentTaskStatus, to: AgentTaskStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * 任意原始值 ⇒ 流转合法性(transition / admin PUT 的**唯一**判定出口)。
 *
 * 与 `isTransitionAllowed` 的差别只有一处:入参是**原始状态串**而非已归一的档位,
 * 因此库里出现六档之外的值时,这里同样返回 false 而不是崩在 `.includes()` 上。
 * 内部复用 `isTransitionAllowed` 而非自己查表 ⇒ 两个出口永远同判,不会漂移。
 */
export function isTransitionAllowedFromRaw(fromRaw: string, to: AgentTaskStatus): boolean {
  const from = mapStatus(fromRaw)
  if (!isAgentTaskStatus(from)) return false
  return isTransitionAllowed(from, to)
}

/** Kanban 列定义(Web 工作台渲染用) */
export interface KanbanColumn {
  /** 列状态 */
  status: AgentTaskStatus
  /** 列标题(i18n key,如 'agents.kanban.triage') */
  titleKey: string
  /** 列内任务(按 priority 降序) */
  tasks: KanbanTask[]
}

/** Kanban 任务(跨端统一,对齐 packages/database agent_tasks 表;与 ai.ts AgentTask 区分,本类型面向 Kanban 工作台) */
export interface KanbanTask {
  /** 任务 ID(uuid) */
  id: string
  /** 关联 Agent ID */
  agentId: string
  /** 任务名(≤200 字符) */
  name: string
  /** 任务描述 */
  description?: string
  /** Kanban 状态(默认 triage) */
  status: AgentTaskStatus
  /**
   * 被折叠进 `blocked` 的终态成因(2026-09-28 拍板:六档枚举不动,加次级标记)。
   * 缺省 = 原始状态本身就是 blocked/failed 等,没有可点名的终态 —— 前端**不得**为消白标而猜一个。
   */
  termination?: AgentTaskTermination
  /**
   * 仅当原始 status 落在六档之外时出现("未识别"档的只报数载体;值 = 库里原始串)。
   * 刻意是**新增可选字段**:既有字段名与状态码一字未动(有用例当契约钉),而未知状态
   * 既不能不进账(静默消失),也不能被猜成某个已知档 —— 见 UNRECOGNIZED_STATUS 头注。
   * 前端取用只走 `isUnrecognizedKanbanTask` / `countUnrecognizedTasks`,不得直接当文案渲染。
   */
  rawStatus?: string
  /** 优先级(数值越大越优先,默认 0) */
  priority: number
  /** 任务负载(输入参数,JSON) */
  payload: Record<string, unknown>
  /** 任务结果(终态有值) */
  result?: Record<string, unknown>
  /** 计划执行时间(ISO,定时任务) */
  scheduledAt?: string
  /** 实际开始时间(ISO) */
  startedAt?: string
  /** 完成时间(ISO) */
  completedAt?: string
  /** 错误信息(status=blocked/done 且失败时有值) */
  errorMessage?: string
  /** 依赖任务 ID 列表(DAG 调度用,空=无依赖) */
  dependencies?: string[]
  /** 分配的 worker ID(in_progress 时有值) */
  workerId?: string
  /** 创建者 ID */
  createdBy?: string
  /** 创建时间(ISO) */
  createdAt: string
  /** 更新时间(ISO) */
  updatedAt: string
  /** 单任务超时秒数(覆盖 WorkerPoolConfig.taskTimeoutSeconds,不设用全局默认) */
  timeoutSeconds?: number
  /** 独立工作区路径(git worktree,空=用主仓库;P1-2 隔离;2-2 兼作工作区锁粒度) */
  workspacePath?: string
  /** worktree 分支名(如 subagent/<taskId>) */
  workspaceBranch?: string
  /** 所属团队 ID(2-2 团队任务板过滤维度) */
  teamId?: string
  /** 最近一次获取工作区锁的持有者(2-2,Redis 锁为执行权威,此字段仅展示/审计) */
  lockedBy?: string
  /** 最近一次获取工作区锁的时间(ISO,2-2) */
  lockedAt?: string
}

/** 资源限制配置(P1-3,CLI V8 heap + ai-service psutil/Job Object 共享) */
export interface WorkerResourceLimits {
  /** V8 old gen heap 上限 MB(CLI 专属,跨平台) */
  maxOldGenerationSizeMb?: number
  /** V8 young gen 上限 MB(CLI 专属) */
  maxYoungGenerationSizeMb?: number
  /** 进程内存上限 MB(ai-service psutil 监控 + POSIX setrlimit + Windows Job Object) */
  memoryMb?: number
  /** CPU 核心数上限(ai-service 软监控,Windows Job Object CPU rate) */
  cpuCores?: number
  /** CPU 累计时间上限秒(POSIX RLIMIT_CPU,Windows 不支持) */
  cpuSeconds?: number
}

/** 网络出站策略(P1-5,executor 入口白名单检查;完整隔离需 OS 沙箱) */
export interface NetworkEgressPolicy {
  /** 模式:'allowlist'=只允许白名单域名;'blocklist'=黑名单;'open'=不限制(默认) */
  mode: 'allowlist' | 'blocklist' | 'open'
  /** 域名列表(支持通配符 *.example.com) */
  domains?: string[]
  /** 是否允许访问 localhost/127.0.0.1(默认 true,开发环境需要) */
  allowLocalhost?: boolean
}

/** Worker Pool 配置(ai-service DAG 调度器 + cli 子进程池共享) */
export interface WorkerPoolConfig {
  /** 最大并发 worker 数(默认 4) */
  maxWorkers: number
  /** 单任务超时秒数(默认 300) */
  taskTimeoutSeconds: number
  /** 任务队列最大长度(默认 100,超限拒绝入队) */
  maxQueueSize: number
  /** 空闲 worker 存活秒数(cli 子进程用,默认 60) */
  idleWorkerTtlSeconds?: number
  /** 优先级抢占(true=高优先级任务可抢占低优先级 worker) */
  preemptive?: boolean
  /** 失败时是否保留 worktree 供调试(cli 专属,默认 false=失败也清理防磁盘泄漏) */
  keepWorktreeOnFailure?: boolean
  /** 资源限制(P1-3,不设=不限) */
  resourceLimits?: WorkerResourceLimits
  /** 网络出站策略(P1-5,不设=open 不限制) */
  networkEgressPolicy?: NetworkEgressPolicy
  /** worktree 源仓库路径(P1-2,空=不启用 worktree 隔离) */
  workspaceSourcePath?: string
  /** watchdog 心跳超时秒数(P1-1,默认 60,executor 超过此时长无心跳判定卡死) */
  heartbeatTimeoutSeconds?: number
}

/** Worker 状态(调度器内部跟踪) */
export interface WorkerState {
  /** Worker ID */
  workerId: string
  /** Worker 类型(ai-service-worker / cli-subprocess / api-dispatcher) */
  type: 'ai-service-worker' | 'cli-subprocess' | 'api-dispatcher'
  /** 当前状态(idle/busy/dead) */
  status: 'idle' | 'busy' | 'dead'
  /** 当前执行任务 ID(busy 时有值) */
  currentTaskId?: string
  /** 已完成任务数 */
  completedCount: number
  /** 失败任务数 */
  failedCount: number
  /** 启动时间(ISO) */
  startedAt: string
  /** 最后心跳时间(ISO) */
  lastHeartbeatAt: string
}

/** SSE 实时流事件(web 工作台订阅) */
export interface AgentSSEEvent {
  /** 事件类型 */
  type:
    | 'task_created' // 新任务入队
    | 'task_status_changed' // 状态流转
    | 'task_completed' // 完成
    | 'task_failed' // 失败
    | 'workspace_lock_acquired' // 工作区锁被获取(2-2)
    | 'workspace_lock_released' // 工作区锁被释放(2-2)
  // D44(2026-09-23 收口):task_progress / worker_status / dag_level_advanced / log
  // 为从未有生产点的死声明(WorkerPool._emit 只发 task_created/status_changed/
  // completed/failed;apps/api 无 broadcastSSEEvent 写出),已从本联合类型回收,parity 不再登记。
  /** 关联任务 ID */
  taskId?: string
  /** 关联 worker ID */
  workerId?: string
  /** 事件负载(类型相关) */
  payload: Record<string, unknown>
  /** 时间戳(ISO) */
  timestamp: string
}

/** 并行执行结果(DAG 调度器返回) */
export interface ParallelExecutionResult {
  /** 执行 ID(uuid) */
  executionId: string
  /** 总状态(success/partial/failed) */
  status: 'success' | 'partial' | 'failed'
  /** 所有任务结果(taskId -> result) */
  taskResults: Record<string, KanbanTask>
  /** 总耗时(ms) */
  totalDurationMs: number
  /** 并发 worker 数 */
  workerCount: number
  /** DAG 层级轨迹 */
  trace: Array<{
    level: number
    nodeIds: string[]
    status: 'success' | 'failed' | 'skipped'
    durationMs: number
  }>
}

/** CLI 子进程 spawn 请求(cli 端 SubagentSpawnRequest) */
export interface SubagentSpawnRequest {
  /** 子 agent 角色(researcher/coder/reviewer/planner/general) */
  persona: SubagentPersona
  /** 任务描述 */
  task: string
  /** 工作区路径(默认主 agent 工作区) */
  workspacePath?: string
  /** 模型覆盖 */
  model?: string
  /** 能力模式(默认 read-write) */
  capability?: CapabilityMode
  /** 隔离模式(默认 none,可选 worktree) */
  isolation?: IsolationMode
  /** 最大迭代次数(默认 25) */
  maxIterations?: number
  /** 超时秒数(默认 300) */
  timeoutSeconds?: number
}

/** CLI 子进程 spawn 响应 */
export interface SubagentSpawnResponse {
  /** 子 agent ID */
  subagentId: string
  /** 子进程 PID */
  pid: number
  /** 状态(spawned/running/completed/failed) */
  status: 'spawned' | 'running' | 'completed' | 'failed'
  /** 输出内容(completed 时有值) */
  output?: string
  /** 错误信息(failed 时有值) */
  error?: string
  /** 耗时(ms) */
  durationMs?: number
}

/** Kanban 任务流转请求(api 端) */
export interface KanbanTransitionRequest {
  /** 任务 ID */
  taskId: string
  /** 目标状态 */
  toStatus: AgentTaskStatus
  /** 操作者 ID(审计用) */
  operatedBy?: string
  /** 流转理由(可选,blocked 时必填) */
  reason?: string
}

/** Kanban 任务流转响应 */
export interface KanbanTransitionResponse {
  /** 任务 ID */
  taskId: string
  /** 流转前状态 */
  fromStatus: AgentTaskStatus
  /** 流转后状态 */
  toStatus: AgentTaskStatus
  /** 流转时间(ISO) */
  transitionedAt: string
  /** 是否合法流转(非法流转拒绝) */
  allowed: boolean
  /** 拒绝原因(allowed=false 时有值) */
  reason?: string
}

/** Git 工具参数(各操作特定参数用索引签名兜底) */
export interface GitToolArgs {
  operation: GitOperation
  cwd?: string
  [key: string]: unknown
}

/** Git 工具权限级别(对应 Tool.dangerLevel) */
export type GitToolPermission = 'read' | 'write' | 'dangerous'

// ============================================================================
// 多文件原子编辑契约(Wave 9,2026-07-22 立)
// 对标 OpenClaw multi-file atomic edit:atomic batch + checkpoint + rollback
// ============================================================================

/** 多文件原子编辑操作类型 */
export interface BatchEditOperation {
  type: 'create' | 'update' | 'delete'
  filePath: string
  /** create/update 时必填,delete 时忽略 */
  content?: string
  /** 编码(默认 utf-8) */
  encoding?: 'utf-8' | 'base64'
}

/** 多文件原子编辑请求 */
export interface BatchEditRequest {
  operations: BatchEditOperation[]
  /** true = 全部成功才提交,任一失败回滚(默认 true) */
  atomic?: boolean
  /** true = 只返回预览,不实际写入(默认 false) */
  dryRun?: boolean
  /** atomic=false 时需 confirm=true 才允许部分成功;delete 操作也需 confirm=true */
  confirm?: boolean
}

/** 多文件原子编辑结果 */
export interface BatchEditResult {
  success: boolean
  appliedCount: number
  totalCount: number
  operations: Array<{
    filePath: string
    type: string
    status: 'success' | 'failed' | 'rolled-back' | 'skipped'
    error?: string
    /** unified diff 预览 */
    diff?: string
  }>
  /** 是否执行了回滚 */
  rollbackPerformed?: boolean
  /** checkpoint ID(用于 batch_undo) */
  checkpointId?: string
}

// ============================================================================
// LSP workspace 级工具类型(2026-07-22 立,Wave 9 多语言 LSP 深化)
// 对标 OpenCode:workspace/symbol 全局符号搜索 + textDocument/rename + textDocument/codeAction
// ============================================================================

/** workspace/symbol 请求(全局符号搜索) */
export interface WorkspaceSymbolRequest {
  query: string
  limit?: number
  /** 限定语言,默认全部 */
  language?: string
}

/** workspace/symbol 结果项 */
export interface WorkspaceSymbolResult {
  name: string
  /** LSP SymbolKind 枚举值(1-26) */
  kind: number
  /** SymbolKind 可读名('Class' | 'Function' | 'Method' | 'Interface' | etc.) */
  kindName: string
  location: {
    uri: string
    range: {
      start: { line: number; character: number }
      end: { line: number; character: number }
    }
  }
  containerName?: string
}

/** textDocument/rename 请求(符号重命名) */
export interface SymbolRenameRequest {
  filePath: string
  /** 0-based 行号 */
  line: number
  /** 0-based 列号 */
  character: number
  newName: string
  /** true = 自动应用 edits,false = 只返回预览 */
  apply?: boolean
  /** apply=true 时必须 confirm=true 才执行 */
  confirm?: boolean
}

/** textDocument/rename 结果 */
export interface SymbolRenameResult {
  changes: Array<{
    filePath: string
    edits: Array<{
      range: {
        start: { line: number; character: number }
        end: { line: number; character: number }
      }
      newText: string
    }>
  }>
  applied: boolean
}

/** textDocument/codeAction 请求(快速修复/重构) */
export interface CodeActionRequest {
  filePath: string
  /** 0-based 行号 */
  line: number
  /** 0-based 列号 */
  character: number
  /** 'quickfix' | 'refactor' | 'refactor.extract' | 'refactor.inline' | 'refactor.rewrite' | 'source' | 'source.organizeImports' */
  kind?: string
}

/** textDocument/codeAction 结果项 */
export interface CodeActionResult {
  title: string
  kind: string
  /** WorkspaceEdit(LSP 标准,结构因 server 而异) */
  edit?: unknown
  command?: { title: string; command: string; arguments?: unknown[] }
  isPreferred?: boolean
}

// ============================================================================
// b76-08a(2026-09-30 立):连接级能力位 —— 宿主注入,客户端不得自报
// ============================================================================

/**
 * 五个**连接级能力位**字段名(对照上游 zcode zcodeAgentConnectionScope 的清单,逐字):
 * `connectionId` / `clientMode` / `deliveryProfile` / `subscriberScope` / `workflowRunDeltas`。
 *
 * 为什么它们不得出现在客户端自报的入参里:"认不认得键级增量""订阅可见性档位"
 * "投递档"是**连接**的事实,只可能来自连接握手(clientHello)与宿主的会话状态;
 * 订阅入参自选这些档,等于让调用方自己给自己授权(AGENTS §5 同型:身份/档位只能
 * 从承载层显式入参进来)。所以**转发前**一律先 delete 这五个键,再由宿主写真值;
 * 宿主暂无等值生产点的档(我方现无 clientMode 等的生产点),"摘除即终局"——
 * 客户端自报值消失,且没有第二来源把它补回来。
 *
 * 唯一注入口(两侧各一份是跨语言的必然,漂移由守门对账):
 *  - TS:`stripClientCapabilityFields`(本文件下方;api-client 的 fetchApi /
 *    fetchAiServiceJson 转发面调用);
 *  - Python:`apps/ai-service/app/routers/engine.py::_bind_principal`
 *    (JSON-RPC 四入口 HTTP 单发/批量/SSE/WS 共用的身份注入点)。
 * 守门:`node scripts/check-capability-field-not-client-supplied.mjs --self-test`。
 */
export const CONNECTION_CAPABILITY_FIELDS = [
  'connectionId',
  'clientMode',
  'deliveryProfile',
  'subscriberScope',
  'workflowRunDeltas',
] as const

export type ConnectionCapabilityField = (typeof CONNECTION_CAPABILITY_FIELDS)[number]

/**
 * 宿主注入口(TS 侧唯一出口):从客户端自报的参数对象里**摘除**全部连接级能力位。
 *
 * 返回浅拷贝而不改入参(调用方可能还持着原对象做展示);键被摘除后**不会**留下
 * `key: undefined` 残影 —— "字段不存在"与"字段为空"必须可分(与 D174 traceId
 * 的"缺席 ≠ 空值"同一条纪律)。
 */
export function stripClientCapabilityFields<T extends Record<string, unknown>>(params: T): T {
  const out: Record<string, unknown> = { ...params }
  for (const field of CONNECTION_CAPABILITY_FIELDS) {
    delete out[field]
  }
  return out as T
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
