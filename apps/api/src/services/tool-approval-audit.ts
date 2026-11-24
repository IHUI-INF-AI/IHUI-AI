// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86H:agent 审批的权限决策 → 审计链摄入(#86 维度③的清偿)。
 *
 * 缺口(86 勘察原文维度③):`appendAuditLog` 只覆盖 FS 工作区一条链,agent 审批
 * 决策不进链 —— CLI danger-gate 的 flag/approved/denied 三路判定此前只在进程内
 * onDecision 可观测,进程一退就无痕迹;ai-service 侧 `approval_grants` 只记结果档、
 * 无 granted_by。本层把决策事实经 `recordAuditLog` 唯一写入器落 `audit_logs_chain`
 * (HMAC 链 + advisory lock),**零新表零新列**。
 *
 * 为什么服务函数住这个新文件而不是 `audit-log-service.ts`:该文件此刻在他人索引
 * 在飞区(暂存面有 span/subset 链验证改动),往里加导出等于替别人暂存内容背书或
 * 回写它(§12 红线)。本文件只 **import** 它的既有出口。
 *
 * 隐私口径(与 86B/`tool-args-digest.ts` 同一条禁令):摄入事实**不含任何入参
 * 原值** —— 只有 {sessionId, toolName, route, cause?}。审批上下文里最敏感的恰是
 * 被批准执行的那条命令/参数本身,它属于 `tool.invoke` 行(86A 指纹档),不属于
 * 决策行;决策行回答的是"谁在什么时候让不让",不是"具体跑了什么"。
 */
import { z } from 'zod'

import { recordAuditLog } from './audit-log-service.js'

/** danger-gate 三路判定(与 `apps/cli/src/tools/danger-gate.ts` 的 DangerGateRoute 同集)。 */
export const TOOL_APPROVAL_ROUTES = ['flag', 'approved', 'denied'] as const
export type ToolApprovalRoute = (typeof TOOL_APPROVAL_ROUTES)[number]

/** fail-closed 拒绝成因(与 DangerGateDenyCause 同集;仅 route='denied' 有意义)。 */
export const TOOL_APPROVAL_DENY_CAUSES = [
  'no-prompt',
  'prompt-declined',
  'prompt-empty',
  'prompt-error',
] as const

/**
 * route → 链上 result 档:判据要求"三路各成行且 result 可分辨"。
 * 名字刻意与 route 不同形(`flag/approval/denial`),因为 result 列在链上是
 * 全局词汇(success/failure/…),这里用独立的审批词汇避免与执行结果混淆。
 */
const RESULT_BY_ROUTE: Record<ToolApprovalRoute, string> = {
  flag: 'flag',
  approved: 'approval',
  denied: 'denial',
}

export const toolApprovalAuditFactSchema = z
  .object({
    sessionId: z.string().min(1).max(128),
    toolName: z.string().min(1).max(128),
    route: z.enum(TOOL_APPROVAL_ROUTES),
    cause: z.enum(TOOL_APPROVAL_DENY_CAUSES).optional(),
  })
  .strict()
export type ToolApprovalAuditFact = z.infer<typeof toolApprovalAuditFactSchema>

export const toolApprovalAuditIngestSchema = z
  .object({
    facts: z.array(toolApprovalAuditFactSchema).min(1).max(50),
  })
  .strict()
export type ToolApprovalAuditIngest = z.infer<typeof toolApprovalAuditIngestSchema>

export interface RecordToolApprovalAuditOptions {
  ip?: string
  userAgent?: string
}

export interface ToolApprovalAuditOutcome {
  requested: number
  recorded: number
  failed: number
}

/**
 * 逐条经 `recordAuditLog` 唯一出口落链(action='tool.approval')。
 * 单条失败不中断整批(与 86A 摄入同形),计数如实:requested = recorded + failed。
 */
export async function recordToolApprovalAuditIngest(
  userId: string,
  ingest: ToolApprovalAuditIngest,
  opts: RecordToolApprovalAuditOptions = {},
): Promise<ToolApprovalAuditOutcome> {
  let recorded = 0
  let failed = 0
  for (const fact of ingest.facts) {
    try {
      const id = await recordAuditLog({
        userId,
        action: 'tool.approval',
        resourceType: 'agent_tool_call',
        resourceId: fact.toolName,
        result: RESULT_BY_ROUTE[fact.route],
        ip: opts.ip,
        userAgent: opts.userAgent,
        metadata: {
          sessionId: fact.sessionId,
          route: fact.route,
          ...(fact.cause ? { cause: fact.cause } : {}),
        },
      })
      if (id) recorded += 1
      else failed += 1
    } catch {
      failed += 1
    }
  }
  return { requested: ingest.facts.length, recorded, failed }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
