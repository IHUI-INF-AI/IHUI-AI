/**
 * Web Hook 服务跨端契约类型(2026-07-22 立,对标 Trae IDE Hooks)。
 *
 * 设计:
 *  - Hook 引擎位于 ai-service,提供事件总线 emit(event, context) 接口
 *  - Hook 配置:事件 + 条件(JSONLogic) + 动作(webhook/script/log/notify)
 *  - apps/api 仅做 JWT 鉴权 + Zod 校验后转发到 ai-service,自身不存储状态
 *  - 前端 web 通过 /api/hooks/* 管理配置 + 查看日志 + 触发测试
 *
 * 命名说明:
 *  - 类型用 `HookTrigger*` 前缀(而非 `HookEvent`),避免与 agent-runtime.ts
 *    已有的 `HookEvent`(`preToolCall/postToolCall` 等)在 `@ihui/types` 主入口冲突
 *  - 与既有 webhook-trigger.ts 的区别:
 *    - webhook-trigger 是"接收外部 webhook 触发 agent"(被动接收)
 *    - 本 hooks 是"agent 行为事件触发外部动作"(主动发出,事件总线模式)
 */

// ================== Hook 触发事件 ==================

/** Hook 触发事件类型(agent 行为事件) */
export type HookTriggerEvent =
  | 'tool.before' // 工具调用前(可拦截/修改 args)
  | 'tool.after' // 工具调用后(可记录结果)
  | 'message.send' // 用户发消息
  | 'message.receive' // AI 回复消息
  | 'session.start' // 会话开始
  | 'session.end' // 会话结束
  | 'error' // 错误事件

/** Hook 事件分组(用于 UI badge 颜色映射) */
export type HookEventGroup = 'tool' | 'message' | 'session' | 'error'

/** 把 HookTriggerEvent 映射到分组(供前端 badge 颜色用) */
export function hookEventGroup(event: HookTriggerEvent): HookEventGroup {
  if (event === 'tool.before' || event === 'tool.after') return 'tool'
  if (event === 'message.send' || event === 'message.receive') return 'message'
  if (event === 'session.start' || event === 'session.end') return 'session'
  return 'error'
}

/** 全部合法 Hook 触发事件(用于 Zod enum + 前端下拉) */
export const HOOK_TRIGGER_EVENTS: readonly HookTriggerEvent[] = [
  'tool.before',
  'tool.after',
  'message.send',
  'message.receive',
  'session.start',
  'session.end',
  'error',
] as const

// ================== Hook 动作 ==================

/** Hook 动作类型 */
export type HookActionType = 'webhook' | 'script' | 'log' | 'notify'

/** 通知渠道(notify 动作子类型) */
export type HookNotifyChannel = 'toast' | 'notification' | 'email'

/** Hook 动作配置(各类型字段互斥,根据 type 取对应字段) */
export interface HookActionConfig {
  // === webhook 字段 ===
  /** webhook URL(type='webhook' 时必填) */
  url?: string
  /** HTTP 方法,默认 POST */
  method?: 'GET' | 'POST' | 'PUT'
  /** 自定义请求头 */
  headers?: Record<string, string>
  /** 请求体模板,支持 {{event}} {{tool}} {{args}} {{result}} 变量替换 */
  body?: string
  // === script 字段 ===
  /** shell 命令(type='script' 时必填,沙箱内执行,超时 10s) */
  command?: string
  // === notify 字段 ===
  /** 通知渠道 */
  channel?: HookNotifyChannel
  /** 通知消息模板,支持 {{event}} {{tool}} {{args}} 变量替换 */
  message?: string
}

/** Hook 动作 */
export interface HookAction {
  type: HookActionType
  config: HookActionConfig
}

/** 全部合法动作类型(用于 Zod enum + 前端下拉) */
export const HOOK_ACTION_TYPES: readonly HookActionType[] = [
  'webhook',
  'script',
  'log',
  'notify',
] as const

// ================== Hook 主体 ==================

/** Hook 配置(完整记录) */
export interface Hook {
  id: string
  name: string
  description?: string
  /** 触发事件 */
  event: HookTriggerEvent
  /**
   * 可选条件表达式(JSONLogic 风格)。
   * 不填(null)时无条件触发。
   * 示例:{"and":[{"==":["tool","write_file"]},{"contains":["args.path",".env"]}]}
   */
  condition?: string | null
  /** 触发动作 */
  action: HookAction
  /** 是否启用 */
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/** 创建 Hook 请求体(省略 id / createdAt / updatedAt) */
export interface CreateHookInput {
  name: string
  description?: string
  event: HookTriggerEvent
  condition?: string | null
  action: HookAction
  enabled?: boolean
}

/** 更新 Hook 请求体(所有字段可选,但至少传一个) */
export type UpdateHookInput = Partial<CreateHookInput>

/** 启用/禁用切换请求体 */
export interface ToggleHookInput {
  enabled: boolean
}

// ================== Hook 日志 ==================

/** Hook 触发日志(每次执行记录一条) */
export interface HookLog {
  id: string
  hookId: string
  /** 触发的事件名 */
  event: HookTriggerEvent
  /** 触发时间 ISO */
  triggeredAt: string
  /** 是否执行成功 */
  success: boolean
  /** 执行耗时(ms) */
  duration: number
  /** 执行结果摘要(webhook HTTP status / script stdout 头部 / log 写入字节数 等) */
  result?: string
  /** 错误信息(失败时填) */
  error?: string
}

// ================== 测试接口 ==================

/** Hook 测试请求体 */
export interface TestHookInput {
  /** 模拟触发的事件 */
  event: HookTriggerEvent
  /** 模拟的上下文(tool/args/result/sessionId 等) */
  context: Record<string, unknown>
}

/** Hook 测试响应 */
export interface TestHookResult {
  /** 是否触发了(条件匹配 = true) */
  triggered: boolean
  /** 本次测试产生的日志(条件不匹配时为空数组) */
  logs: HookLog[]
}
