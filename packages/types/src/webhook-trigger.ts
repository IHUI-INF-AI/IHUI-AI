/**
 * Webhook 唤醒机制跨端契约类型(2026-07-22 立,深度对标并反超 OpenClaw webhook 触发)。
 *
 * 相比 OpenClaw 只能"接收 webhook 触发 agent",本契约扩展:
 * - HMAC-SHA256 签名验证(防时序攻击)
 * - 路由到指定 agent(agentId)
 * - 触发后异步执行(立即返回 202,后台执行)
 * - 指数退避重试(1s / 2s / 4s,最多 3 次)
 * - 审计日志(每次触发记录签名/条件/状态)
 * - 可配置触发条件(payload 字段匹配规则,支持 eq/neq/contains/regex/exists)
 */

// ================== 触发条件 ==================

/** payload 字段匹配条件 */
export interface WebhookCondition {
  /** payload 字段路径,如 'event' / 'data.type' / 'user.id' */
  field: string
  /** 比较运算符 */
  operator: 'eq' | 'neq' | 'contains' | 'regex' | 'exists'
  /** 比较目标值(exists 运算符忽略此字段) */
  value: unknown
}

// ================== 触发器配置 ==================

/** Webhook 触发器配置(一个触发器 = 一个接收端点 + 一个目标 agent) */
export interface WebhookTriggerConfig {
  id: string
  name: string
  /** 接收 URL 路径标识,如 /api/webhooks/trigger/:id 中的 :id */
  url: string
  /** 触发的 agent ID */
  agentId: string
  /** HMAC-SHA256 签名密钥(外部系统用此密钥签名 payload) */
  secret: string
  /** 可选:payload 匹配条件,不配置则无条件触发 */
  condition?: WebhookCondition
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/** 创建触发器请求体(省略 id / createdAt / updatedAt 由服务端生成) */
export type CreateWebhookTriggerInput = Omit<
  WebhookTriggerConfig,
  'id' | 'createdAt' | 'updatedAt'
>

/** 更新触发器请求体(所有字段可选) */
export type UpdateWebhookTriggerInput = Partial<CreateWebhookTriggerInput>

// ================== 触发事件 ==================

/** 触发事件状态 */
export type WebhookTriggerEventStatus =
  | 'pending'
  | 'executing'
  | 'success'
  | 'failed'
  | 'retrying'

/** 一次 webhook 触发产生的事件记录(含执行状态 + 重试信息) */
export interface WebhookTriggerEvent {
  id: string
  triggerId: string
  agentId: string
  /** 原始 payload(外部系统 POST body) */
  payload: unknown
  /** 签名验证结果 */
  signatureValid: boolean
  /** 条件匹配结果(无条件配置时为 true) */
  conditionMatched: boolean
  status: WebhookTriggerEventStatus
  /** 已尝试次数(含首次) */
  attempts: number
  /** 最大重试次数 */
  maxRetries: number
  /** 最近一次错误信息(null 表示无错误) */
  lastError: string | null
  createdAt: string
  /** 开始执行时间 */
  executedAt: string | null
  /** 完成时间(成功或最终失败) */
  completedAt: string | null
}

// ================== 触发结果 ==================

/** webhook 接收端点立即返回的结果 */
export interface WebhookTriggerResult {
  /** 是否已接受触发(签名验证通过 + 条件匹配 = true) */
  accepted: boolean
  /** 产生的事件 ID(用于后续查询执行状态) */
  eventId: string
  message: string
  /** true = 异步执行,接口立即返回 202;false = 同步执行(当前实现始终异步) */
  asyncExecution: boolean
}

// ================== 审计日志 ==================

/** 审计日志条目(每次 webhook 触发记录一条) */
export interface WebhookTriggerAuditLog {
  id: string
  /** 关联的事件 ID */
  eventId: string
  /** 触发时间 ISO */
  timestamp: string
  /** 触发器 ID */
  triggerId: string
  /** 签名验证结果 */
  signatureValid: boolean
  /** 条件匹配结果 */
  conditionMatched: boolean
  /** 执行状态快照 */
  status: WebhookTriggerEventStatus
  /** 来源 IP */
  sourceIp: string | null
}
