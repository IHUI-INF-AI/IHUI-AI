// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端 API 契约类型 — 单一导入面。
 *
 * 范围:web / api / ai-service / desktop / extension / mobile-rn / miniapp-taro / cli
 *       八端共享 API 契约类型(用户/认证/分页/通知/消息/WebSocket/工作区/智能体/AI 聊天)。
 *
 * 设计原则:
 * 1. **纯类型,无运行时** — 仅 `interface` / `type` 声明 + 类型守卫(无业务数据,无副作用)。
 * 2. **零冗余** — 全部 `export type` / `export` 自 `@ihui/types` 子模块,不重新定义。
 * 3. **稳定入口** — 各端从此处导入共享类型,避免散落在 `endpoints/*` 文件中。
 *
 * 注意:
 * - 端点专属类型(AuthUser / AiModel / CourseItem / ...)继续在 `@ihui/api-client/endpoints/*` 中定义
 *   (与运行时 fetch 函数就近耦合),各端通过 `@ihui/api-client` 导入。
 * - 本文件只承载**跨端共享的、不与特定 fetch 函数耦合的**契约类型。
 * - 命名冲突已显式 `export type`(详见 @ihui/types/index.ts 的 PermissionMode/PermissionDecision 注释)。
 */

// ===================== 用户与认证 =====================
export type { User, UserProfile, AuthToken } from './user.js'

// ===================== 通用 API 响应包装 =====================
export type { ApiResponse, PaginatedResponse, ApiResult } from './api.js'

// ===================== AI 聊天 =====================
export type { ChatMessage, ChatRequest, AgentTask } from './ai.js'

// ===================== 通知 / WebSocket =====================
export type {
  WSNotification,
  AIResponseNotification,
  NotificationItem,
  MessageItem,
  UnreadCount,
  CustomerServiceSession,
  CustomerServiceMessage,
} from './notification.js'
export { isAIResponse } from './notification.js'

export type {
  NotificationChannel,
  ChannelConfig,
  DingtalkMessage,
  FeishuMessage,
  WechatWorkMessage,
} from './notification-channels.js'

// ===================== 消息自愈(CLI/API/ai-service 共用) =====================
export type { RepairableMessage, RepairResult, RepairOptions } from './message-repair.js'
export { repairMessages } from './message-repair.js'

// ===================== 智能体运行时 =====================
export type {
  PermissionMode,
  PermissionDecision,
  DangerLevel,
  PermissionRules,
  PermissionCheckResult,
  PlanState,
  PlanEvent,
  PlanContext,
  HookEvent,
  HookContext,
  HookEntry,
  HooksConfig,
  HookResult,
  JSONSchema,
  JSONSchemaType,
  PersonaContract,
  PersonaContracts,
  SessionStatus,
  SessionMessage,
  SessionState,
  SessionSummary,
  SubagentPersona,
  CapabilityMode,
  IsolationMode,
  SkillFrontmatter,
  SkillDefinition,
} from './agent-runtime.js'

// ===================== 工作区(adjacent tagging wire 协议) =====================
export type {
  SessionId,
  ToolCallId,
  HunkId,
  RewindPoint,
  TaggedRequest,
  WorkspaceRequest,
  BeginPromptData,
  EndPromptData,
  CancelPromptData,
  CreateSessionData,
  LoadSessionData,
  PromptMode,
  Attachment,
  ToolChunk,
  ToolCallStartData,
  ToolCallDeltaData,
  ToolCallEndData,
  ToolCallErrorData,
  WorkspaceEvent,
  SessionCreatedData,
  SessionLoadedData,
  PromptStartedData,
  PromptCompletedData,
  PromptCancelledData,
  ErrorData,
  ConversationItem,
  UserMessage,
  AssistantMessage,
  ToolCallMessage,
  ToolResultMessage,
  SystemMessage,
  PermissionRequest,
  PermissionRequestData,
  PermissionAllowData,
  PermissionDenyData,
  UsageStats,
} from './workspace.js'
export { isWorkspaceRequest, isToolChunk, isWorkspaceEvent } from './workspace.js'

// ===================== 跨边界载荷 strict schema 面(b76-01 票1) =====================
// 本节是有运行时的:所有会跨越进程、存储、插件、模型边界的载荷,解析前一律先过这里的
// strict schema,未知字段判失败;已撤销字段在解析前做 kind 定向的读前 scrub —— 只改在场的
// 键、不给缺席字段补 `undefined`,让历史载荷不至于在 strict 下整块退化成纯文本失败。
// 新增字段一律 optional。这是本文件对"纯类型,无运行时"设计原则的显式豁免:判据必须
// 单点(schema 即唯一真相),类型与校验不允许各自演化。
import { z } from 'zod'

/** 包络/事件入站契约校验失败。issues 为逐条可读判据,供日志与测试断言。 */
export class ContractValidationError extends Error {
  readonly issues: readonly string[]
  constructor(issues: readonly string[]) {
    super(`契约校验失败(${issues.length} 条): ${issues.join(' | ')}`)
    this.name = 'ContractValidationError'
    this.issues = issues
  }
}

/** kind → 该 kind 下已撤销(历史载荷可能还带着)的字段名列表。 */
export type RevokedKeysByKind = Readonly<Record<string, readonly string[]>>

/**
 * kind 定向读前 scrub(判据对齐上游 tool-result-metadata 的 stripper 语义):
 *   ① 只删在场的键 —— 缺席的键绝不补 `undefined`;
 *   ② 未列出的兄弟 kind 原样通过,一个字节都不动;
 *   ③ scrub 之后才进 strict,两步成对。
 */
export function scrubRevokedKeys<T extends Record<string, unknown>>(
  input: T,
  kindField: string,
  revokedByKind: RevokedKeysByKind,
): T {
  const kind = input[kindField]
  if (typeof kind !== 'string') return input
  const revoked = revokedByKind[kind]
  if (!revoked) return input
  for (const key of revoked) {
    if (key in input) delete input[key]
  }
  return input
}

// —— 跨端事件面(kinded) ——

/** 跨端事件的已撤销字段注册表:tool-result 的布尔成功位 `ok` 已撤销(判别式 outcome 接手)。 */
export const CROSS_END_EVENT_REVOKED_KEYS: RevokedKeysByKind = {
  'tool-result': ['ok'],
}

/** 跨端事件 strict schema:未知字段判失败;新增字段一律 optional。 */
export const CrossEndEventSchema = z.strictObject({
  kind: z.string().min(1),
  traceId: z.string().optional(),
  at: z.number().optional(),
})

export type CrossEndEvent = z.infer<typeof CrossEndEventSchema>

/** 跨端事件解析唯一入口:先 scrub 再 strict,失败抛 ContractValidationError。 */
export function parseCrossEndEvent(input: unknown): CrossEndEvent {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ContractValidationError([`载荷不是对象: ${typeof input}`])
  }
  const scrubbed = scrubRevokedKeys(
    input as Record<string, unknown>,
    'kind',
    CROSS_END_EVENT_REVOKED_KEYS,
  )
  const result = CrossEndEventSchema.safeParse(scrubbed)
  if (!result.success) {
    throw new ContractValidationError(
      result.error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`),
    )
  }
  return result.data
}

// —— 响应包络面(api-client fetchOnce 的 2xx 入站载荷) ——

/** 包络的已撤销字段注册表:历史载荷曾以布尔 `ok` 表达成功位,已撤销。 */
export const API_ENVELOPE_REVOKED_KEYS: RevokedKeysByKind = {
  envelope: ['ok'],
}

/** 响应包络 strict schema:与 ApiResponse 逐字段对齐;errorCode 等新增字段一律 optional。 */
export const ApiResponseEnvelopeSchema = z.strictObject({
  kind: z.string().optional(),
  code: z.number(),
  message: z.string(),
  data: z.unknown(),
  errorCode: z.string().optional(),
})

export type ApiResponseEnvelope = z.infer<typeof ApiResponseEnvelopeSchema>

export type ApiResponseEnvelopeParseResult =
  | { success: true; data: ApiResponseEnvelope }
  | { success: false; issues: readonly string[] }

/** 包络 safeParse:先 scrub 再 strict;不抛错,把逐条判据交回调用方裁决。 */
export function safeParseApiResponseEnvelope(input: unknown): ApiResponseEnvelopeParseResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, issues: [`载荷不是对象: ${typeof input}`] }
  }
  const scrubbed = scrubRevokedKeys(
    input as Record<string, unknown>,
    'kind',
    API_ENVELOPE_REVOKED_KEYS,
  )
  const result = ApiResponseEnvelopeSchema.safeParse(scrubbed)
  if (result.success) return { success: true, data: result.data }
  return {
    success: false,
    issues: result.error.issues.map(
      (issue) => `${issue.path.map(String).join('.')}: ${issue.message}`,
    ),
  }
}

/** 包络解析唯一入口:失败抛 ContractValidationError。 */
export function parseApiResponseEnvelope(input: unknown): ApiResponseEnvelope {
  const result = safeParseApiResponseEnvelope(input)
  if (!result.success) throw new ContractValidationError(result.issues)
  return result.data
}

// ===================== 契约定义与运行时校验同源(b76-01 票2) =====================
// 导出类型直接从同一份 zod schema 派生,类型面与校验面不可能各自演化;
// 调用方只拿 parseXxx(input: unknown),拿不到裸 schema。下方每个 schema 都与
// 既有 hand-written interface(./api.js)双向赋值对账,任一侧改字段即编译红
// (对账用例见 tests/contract-schema-parity.test.ts)。

/** 列表响应 strict schema:与 PaginatedResponse 逐字段对齐。 */
export const PaginatedResponseSchema = z.strictObject({
  list: z.array(z.unknown()),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})

export type PaginatedResponseEnvelope = z.infer<typeof PaginatedResponseSchema>

/** 列表响应解析唯一入口。 */
export function parsePaginatedResponse(input: unknown): PaginatedResponseEnvelope {
  const result = PaginatedResponseSchema.safeParse(input)
  if (!result.success) {
    throw new ContractValidationError(
      result.error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`),
    )
  }
  return result.data
}

/** ApiResult 失败分支(即跨端 ErrorCode 载荷面)strict schema:与 ./api.js 的 ApiResult 对账。 */
export const ApiResultFailureSchema = z.strictObject({
  success: z.literal(false),
  error: z.string(),
  status: z.number().optional(),
  errorCode: z.string().optional(),
  retryAfter: z.number().optional(),
})

export type ApiResultFailureWire = z.infer<typeof ApiResultFailureSchema>

/** ErrorCode 载荷解析唯一入口。 */
export function parseApiResultFailure(input: unknown): ApiResultFailureWire {
  const result = ApiResultFailureSchema.safeParse(input)
  if (!result.success) {
    throw new ContractValidationError(
      result.error.issues.map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`),
    )
  }
  return result.data
}

// ===================== 有界投影与"缺席 vs 零"(b76-01 票4) =====================
// 给模型/给渲染端的列表投影逐字段有界并带 truncated / appliedLimit 读数;
// 越界的请求页容量被钳制进界而不是抛错。"不知道"用字段缺席表达、"确实为零"
// 用 0/空数组表达,二者不得互换 —— optional 计数为 undefined 时键整个不出现,
// 绝不写 `total: undefined`、更不写 `total: 0` 冒充。
// (界值在本文件单点定义;各端工具面的具体上限常量接线到此复用同一把尺。)

/** 列表投影的页容量上限(单点界值;越界请求钳进界,不抛错)。 */
export const MAX_LIST_LIMIT = 100

/** 只读钳制:把任意请求页容量钳进 [1, max](默认 MAX_LIST_LIMIT)。越界不是错误。 */
export function clampProjectionLimit(limit: number, max: number = MAX_LIST_LIMIT): number {
  if (!Number.isFinite(limit)) return max
  return Math.min(Math.max(1, Math.floor(limit)), max)
}

/**
 * 有界列表投影信封 strict schema:
 *   - appliedLimit:实际应用的页容量(与 MAX_LIST_LIMIT 同尺);
 *   - truncated 为真 ⇒ 必须同时给出 total(refine 强制)—— 没有总量就不许声称截断;
 *   - total 缺席表示"不知道",不是"零";确数(含 0)才写数值。
 */
export const BoundedListProjectionSchema = z
  .strictObject({
    list: z.array(z.unknown()),
    truncated: z.boolean(),
    appliedLimit: z.number().int().positive(),
    total: z.number().int().nonnegative().optional(),
  })
  .refine((v) => v.truncated !== true || typeof v.total === 'number', {
    message: 'truncated 为真时必须同时给出 total(缺席 ≠ 零,不许声称截断又不给读数)',
  })

export type BoundedListProjection = z.infer<typeof BoundedListProjectionSchema>

/**
 * 纯函数投影:把"服务端返回的列表 + 可选总量 + 请求页容量"投影成有界信封。
 *   - limit 越界(如 99999)⇒ appliedLimit === MAX_LIST_LIMIT,不抛错;
 *   - total 为 undefined(服务端没给)⇒ 输出对象**不含 total 键**、truncated 为 false
 *     ('total' in out === false —— 不是 false、不是 0、不是 undefined 值);
 *   - total 为 0 是"确实为零",键必须在、值为 0,与缺席不可互换。
 */
export function projectBoundedList(input: {
  list: readonly unknown[]
  /** 请求的页容量(可能越界,如 99999)。 */
  limit: number
  /** 服务端的可选总量计数;undefined = 不知道(缺席)。 */
  total?: number | undefined
  /** 覆盖界值(默认 MAX_LIST_LIMIT);与调用方工具面常量同值复用时传入。 */
  max?: number
}): BoundedListProjection {
  const appliedLimit = clampProjectionLimit(input.limit, input.max ?? MAX_LIST_LIMIT)
  const list = input.list.slice(0, appliedLimit)
  const knownTotal = input.total
  // 没有总量就不许声称截断:truncated 只在确数比本页长时为真
  const truncated = knownTotal !== undefined && knownTotal > list.length
  const out: BoundedListProjection = { list, truncated, appliedLimit }
  if (knownTotal !== undefined) out.total = knownTotal
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
