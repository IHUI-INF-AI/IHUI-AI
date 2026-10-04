// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Web Hook 服务跨端契约类型(2026-07-22 立, IDE Hooks)。
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

/** 通知渠道(notify 动作子类型)。
 *  与 apps/api/src/routes/hooks.ts 的 z.enum、apps/ai-service hook_engine._run_notify
 *  的分支集合逐项同值,由 scripts/tests/check-hook-channel-parity.test.mjs 对账。
 *  webhook(notify 渠道,2026-07-22 立,api 注释"HMAC-SHA256 签名密钥(webhook + notify
 *  webhook 渠道)"即此档):执行侧复用 webhook 发送器,本类型早期漏登记故已补齐。 */
export type HookNotifyChannel = 'toast' | 'notification' | 'email' | 'webhook'

/**
 * Hook 动作配置的各族形态(G-675,2026-10-04)。
 *
 * 每一族把自己不适用的键声明为 `?: never`,所以 `{url, command}` 这类跨族矛盾组合
 * 在**构造点**就不可赋值。此前是一个全 optional 的平铺接口,任意组合都能构造出来,
 * 互斥校验只存在于 apps/ai-service 的 Pydantic 分支 —— 即"客户端自报矛盾态、
 * 到服务端才拦"那一型;而 api 侧的 zod `actionConfigSchema` 同样是平铺宽松档。
 * 各族字段仍全部 optional:`config` 允许 `{}`(api 侧 `.default({})` 与 ai-service
 * 的空 `HookActionConfigModel()` 都是既有合法形态,收紧必填字段属另一件事)。
 *
 * ⚠️ 互斥**不是**"四种 type 各一套键"那么理想:`notify` 的 `channel: 'webhook'` 复用
 * webhook 动作同一批发送器与同一批键(`hook_engine._run_notify` 的 webhook 分支就读
 * `url/method/headers`,而 `apps/web/src/stores/hooks.ts` 构造的正是这一形态)。所以那一档
 * 单列成 `NotifyWebhookActionConfig`,并把 `channel` 收成必填字面量 —— 既放行这一形态,
 * 又不放开设错渠道的组合(`{channel:'toast', url:…}` 仍不可构造)。
 */

/** type='webhook':只有 webhook 族字段可用 */
export interface WebhookActionConfig {
  /** webhook URL(type='webhook' 时必填) */
  url?: string
  /** HTTP 方法,默认 POST */
  method?: 'GET' | 'POST' | 'PUT'
  /** 自定义请求头 */
  headers?: Record<string, string>
  /** 请求体模板,支持 {{event}} {{tool}} {{args}} {{result}} 变量替换 */
  body?: string
  command?: never
  channel?: never
  message?: never
}

/** type='script':只有 command 可用 */
export interface ScriptActionConfig {
  /** shell 命令(type='script' 时必填,沙箱内执行,超时 10s) */
  command?: string
  url?: never
  method?: never
  headers?: never
  body?: never
  channel?: never
  message?: never
}

/** type='notify' 且渠道不是 webhook:只有 channel + message 可用 */
export interface NotifyActionConfig {
  /** 通知渠道(webhook 渠道走 `NotifyWebhookActionConfig` —— 它复用 webhook 动作同一批键) */
  channel?: Exclude<HookNotifyChannel, 'webhook'>
  /** 通知消息模板,支持 {{event}} {{tool}} {{args}} 变量替换 */
  message?: string
  url?: never
  method?: never
  headers?: never
  body?: never
  command?: never
}

/**
 * type='notify' 且 `channel === 'webhook'`:除 channel/message 外**还合法携带 webhook 那一族的键**。
 *
 * 这不是我把互斥放宽,而是执行侧本来的契约:`apps/ai-service` 的 `hook_engine._run_notify`
 * 在 webhook 分支上就是按 `url/method/headers` 取值的(与 webhook 动作共用发送器),而
 * `apps/web/src/stores/hooks.ts` 构造的正是这一形态 —— 只按四族纯互斥收类型,会把这份
 * 已入库的正当写法判成 TS2322(本仓反复记过的"门把规矩写出来的形态钉红"那一型)。
 * 因此 channel 在这里是**必填字面量** `'webhook'`:`{channel:'toast', url:…}` 仍然不可构造。
 */
export interface NotifyWebhookActionConfig {
  channel: 'webhook'
  message?: string
  url?: string
  method?: 'GET' | 'POST' | 'PUT'
  headers?: Record<string, string>
  body?: string
  command?: never
}

/** type='log':只有 message 可用 */
export interface LogActionConfig {
  message?: string
  url?: never
  method?: never
  headers?: never
  body?: never
  command?: never
  channel?: never
}

/** Hook 动作配置(与 `HookActionType` 各档一一对应;notify 的 webhook 渠道单列一形态) */
export type HookActionConfig =
  | WebhookActionConfig
  | ScriptActionConfig
  | NotifyActionConfig
  | NotifyWebhookActionConfig
  | LogActionConfig

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
