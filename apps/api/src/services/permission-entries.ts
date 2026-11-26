// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L01 三入口接线(对标落地,2026-11-26)。
 *
 * 决策对象与判定引擎都已在 `permission-decision.ts` / `packages/shared/src/permission` 里,
 * 缺的一直是**业务调用点**:终端建会话、MCP 网关调工具、内置 Crew 工具执行这三处各判各的,
 * 审计里读不出"凭什么放行"。本模块只做两件事,不新增判定词表:
 *
 *  1) 给三条**已在上游完成身份/资格判定**的入口一条窄 allow 规则。规则 id 是
 *     `allow.entry.*`,命中后进决策的 `evidenceRef`,审计可回查到具体是哪条入口放的行。
 *     没有这条窄 allow,引擎的兜底 `ask.fallback` 会把三个入口全部判成"转人工" ——
 *     接线当天就会把终端与内置工具掐死,那不是加固,是事故。
 *
 *  2) 入口准入只拿"入口身份"去判,**不把动作参数塞进决策**:终端命令仍由
 *     `requireTerminalAccess` + 终端自身 ACL 管,MCP 工具参数仍由 ai-service 侧管,
 *     Crew 工具仍由各自 handler 管。入口层放行 ≠ 动作层放行,两层的边界在代码里分开,
 *     不做成"入口过了就什么都过"。
 *
 * 窄 allow 的优先级是 65:它只压过 `ask.unknown-tool(50)` / `ask.exec-tool(45)` /
 * `allow.read-only(30)` / `ask.fallback(20)` 这类"因为认不出入口而转人工"的规则;
 * 所有 deny 族(88–100)与 `ask.path-outside-workspace(70)` / `ask.tier-ceiling(82)` 仍压过它。
 * 也就是说:入口放行不等于放宽任何一条真正的风险判据。
 */

import {
  APPROVAL_RULES,
  sortRules,
  type ApprovalDecision,
  type ApprovalRule,
} from '@ihui/shared/permission'

import {
  PermissionDeniedError,
  requirePermission,
  type PermissionDecideDeps,
} from './permission-decision.js'

/** 三条入口各自的工具标识。改这里必须同步改 `permission-decision` 单测与路由。 */
export const PERMISSION_ENTRY_TOOLS = {
  terminal: 'terminal.session.create',
  mcp: 'mcp.tool.call',
  crew: 'crew.tool.execute',
} as const

export type PermissionEntryKind = keyof typeof PERMISSION_ENTRY_TOOLS

/**
 * 入口族 → 决策对象的 scope 词表。`crew` 属内置工具族,scope 是 `builtin`
 * (词表只有 builtin/mcp/terminal 三值,不为入口族另造第四种 scope)。
 */
export const PERMISSION_ENTRY_SCOPES = {
  terminal: 'terminal',
  mcp: 'mcp',
  crew: 'builtin',
} as const satisfies Record<PermissionEntryKind, 'builtin' | 'mcp' | 'terminal'>

/**
 * 窄 allow 规则。每条只为"这一条入口"放行,用 `toolExact` **精确相等**
 * (`match.tool` 是前缀语义,`crew.tool.execute` 会把 `crew.tool.execute.unknown` 一起放进来,
 * 那就是给后来者搭车)。
 */
export const PERMISSION_ENTRY_ALLOW_RULES: readonly ApprovalRule[] = [
  {
    id: 'allow.entry.terminal-session',
    reason: '终端会话创建入口:上游已完成管理员/本机开关授权,本层只留痕',
    match: { toolExact: [PERMISSION_ENTRY_TOOLS.terminal] },
    decision: 'allow',
    priority: 65,
  },
  {
    id: 'allow.entry.mcp-tool-call',
    reason: 'MCP 网关调用入口:上游已完成 API Key + 能力闸校验,本层只留痕',
    match: { toolExact: [PERMISSION_ENTRY_TOOLS.mcp] },
    decision: 'allow',
    priority: 65,
  },
  {
    id: 'allow.entry.crew-tool',
    reason: '内置 Crew 工具执行入口:上游已完成工具清单与上下文校验,本层只留痕',
    match: { toolExact: [PERMISSION_ENTRY_TOOLS.crew] },
    decision: 'allow',
    priority: 65,
  },
]

/**
 * 入口族用的整份规则集。**必须整份传**(引擎的 `options.rules` 是替换而不是追加),
 * 少了 `APPROVAL_RULES` 的 deny 族会在入口层被静默取消 —— 这是本模块最容易被改坏的一处。
 */
export const PERMISSION_ENTRY_RULE_SET: readonly ApprovalRule[] = sortRules([
  ...APPROVAL_RULES,
  ...PERMISSION_ENTRY_ALLOW_RULES,
])

export interface PermissionEntryInput {
  /** 入口族。 */
  readonly entry: PermissionEntryKind
  /** 会话归因键:路由用 requestId,后台执行用 `crew-tool:<name>@<taskId>`,不得为空。 */
  readonly sessionId: string
  readonly userId?: string | null
  readonly agentId?: string | null
  readonly workspaceId?: string | null
  /** 已有权限档结论(只采纳 deny/ask)。 */
  readonly tier?: { readonly verdict: ApprovalDecision; readonly reason: string } | null
  readonly now?: number
}

/**
 * 入口准入。放行返回决策(带 `evidenceRef`);不放行抛 `PermissionDeniedError`,
 * 错误里带完整决策对象,路由层直接用 `decision.reason` 回话,不自造说法。
 */
export async function requireEntryPermission(
  input: PermissionEntryInput,
  deps: PermissionDecideDeps = {},
) {
  return requirePermission(
    {
      scope: PERMISSION_ENTRY_SCOPES[input.entry],
      tool: PERMISSION_ENTRY_TOOLS[input.entry],
      // 入口准入不携带动作参数:参数级判据在动作层的既有 ACL 上,不在这里重复判。
      args: {},
      sessionId: input.sessionId,
      userId: input.userId ?? null,
      agentId: input.agentId ?? null,
      workspaceId: input.workspaceId ?? null,
      tier: input.tier ?? null,
      now: input.now,
    },
    { ...deps, rules: deps.rules ?? PERMISSION_ENTRY_RULE_SET },
  )
}

/** 路由层把拒绝决策翻译成 403 的统一出口,避免三处各写一套话术。 */
export function permissionDeniedMessage(err: unknown): string | null {
  if (!(err instanceof PermissionDeniedError)) return null
  const decision = err.decision
  return `权限决策拒绝(${decision.scope}:${decision.tool}):${decision.reason}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
