// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 工具注册三段式(approval / decorate / publish)—— 对标 WorkBuddy 的
// `task_tool_approval_service` + `computer_use_tool_decorate` 符号,净室复现:
// 工具不再只是 {name, schema, handler},而是把“谁批准、执行前怎么补参数、能给谁用”
// 三段声明挂在同一个 Tool 上;缺省(不写 registration)= 既有行为逐字节不变。
//
// 边界:本模块定义声明、决策、审计与两个纯函数,审批/装饰的实际应用点在
// tools/index.ts 的 executeToolCall;发布面应用点在 tools/subagent.ts 的工具过滤。
import type { Tool, ToolContext } from './index.js'
import { auditLog } from '../audit.js'

/** 工具能被哪一类调用方看见。缺省 = 两类都可见(与引入前一致)。 */
export const TOOL_AUDIENCES = ['main', 'subagent'] as const
export type ToolAudience = (typeof TOOL_AUDIENCES)[number]

/** 静态审批语义:auto = 沿用 dangerLevel/权限规则;ask = 强制进确认窗;deny = 直接拒。 */
export type ToolApprovalMode = 'auto' | 'ask' | 'deny'

/** 三段式审批决策的落账形状（与 PROJECT_PLAN RP-1 对齐，不用散文代替）。 */
export type ToolPermissionScope = 'tool' | 'subagent' | 'session'
export type ToolPermissionKind = 'allow' | 'deny' | 'ask' | 'auto'

export interface PermissionDecision {
  readonly scope: ToolPermissionScope
  readonly kind: ToolPermissionKind
  readonly sessionId: string
  readonly expiresAt?: string
  readonly evidenceRef?: string
  /** 拒绝/要求确认的结构化原因；不得用中文散文让审计侧反解。 */
  readonly reasonCode?: string
}

export interface ToolRegistration {
  /** 静态审批档。ask 不会把 dangerous 降级,只是额外要求一次确认。 */
  readonly approval?: ToolApprovalMode
  /**
   * 执行前装饰参数(补默认值/补元数据)。必须是纯函数式改写:不改原对象,
   * 返回新对象;抛错 ⇒ 本次调用失败,不落回未装饰参数继续跑。
   */
  readonly decorate?: (
    args: Record<string, unknown>,
    ctx: ToolContext,
  ) => Record<string, unknown>
  /**
   * 发布面:对子代理等**非主**调用方的可见性。主代理是宿主,始终可见(缺席与空数组同义)。
   * 当前消费点 = 子代理工具清单;写成 `['main']` 即“只给主代理,不进子代理”。
   */
  readonly publish?: readonly ToolAudience[]
}

/** 把缺省写成显式的三段式形状；注册表消费方不用到处判 undefined。 */
export function normalizeToolRegistration(registration: ToolRegistration | undefined): Required<Pick<ToolRegistration, 'approval' | 'publish'>> & ToolRegistration {
  return {
    ...(registration ?? {}),
    approval: registration?.approval ?? 'auto',
    publish: registration?.publish ?? [...TOOL_AUDIENCES],
  }
}

/** 新工具的唯一声明入口：把三段式挂在 Tool 上，而不是散在调用点。 */
export function defineTool(tool: Tool, registration: ToolRegistration = {}): Tool {
  return { ...tool, registration }
}

/** 由静态审批档生成可审计决策；ask 的真实批复由调用点替换 kind。 */
export function permissionDecisionForRegistration(input: {
  readonly registration: ToolRegistration | undefined
  readonly ctx: ToolContext
  readonly toolName: string
}): PermissionDecision {
  const registration = normalizeToolRegistration(input.registration)
  const sessionId = input.ctx.sessionId?.trim() || 'unbound'
  const evidenceRef = [
    input.ctx.turnId !== undefined && input.ctx.turnId !== '' ? `turn:${input.ctx.turnId}` : '',
    input.ctx.toolCallId !== undefined && input.ctx.toolCallId !== '' ? `call:${input.ctx.toolCallId}` : '',
  ].filter((part) => part !== '').join('|')
  const kind: ToolPermissionKind =
    registration.approval === 'deny'
      ? 'deny'
      : registration.approval === 'ask'
        ? 'ask'
        : 'auto'
  return {
    scope: 'tool',
    kind,
    sessionId,
    ...(evidenceRef === '' ? {} : { evidenceRef }),
    ...(kind === 'deny' ? { reasonCode: 'tool-registration-deny' } : {}),
  }
}

/** 审批/装饰的审计落点；入参由 auditLog 统一脱敏，不在这里自造第二套。 */
export function auditToolRegistrationDecision(input: {
  readonly toolName: string
  readonly decision: PermissionDecision
  readonly args: Record<string, unknown>
  readonly phase: 'approval' | 'decorate'
  readonly before?: Record<string, unknown>
  readonly after?: Record<string, unknown>
}): void {
  auditLog({
    timestamp: new Date().toISOString(),
    tool: 'tool.registration',
    input: {
      tool: input.toolName,
      phase: input.phase,
      decision: input.decision,
      args: input.args,
      ...(input.before === undefined ? {} : { before: input.before }),
      ...(input.after === undefined ? {} : { after: input.after }),
    },
    success: input.decision.kind !== 'deny',
  })
}

/**
 * 该工具是否对指定调用方发布。
 * 主代理恒可见:它是宿主,不存在“主代理被自己下架”的场景;缺省(不写 registration/publish)
 * = 子代理也可见,与引入前一致。
 */
export function isToolPublishedFor(tool: Tool, audience: ToolAudience): boolean {
  if (audience === 'main') return true
  const scopes = normalizeToolRegistration(tool.registration).publish
  return scopes.includes(audience)
}

/** 按调用方过滤工具清单;只读,不改入参数组。 */
export function filterToolsForAudience(
  tools: readonly Tool[],
  audience: ToolAudience,
): Tool[] {
  return tools.filter((tool) => isToolPublishedFor(tool, audience))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
