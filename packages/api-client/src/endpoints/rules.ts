// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Rules 规则引擎端点封装(补 RN 承载用,2026-10-27 后端契约现读)
 *
 *  - GET   /api/rules            → 信封 success({ rules, total })
 *    (apps/api/src/routes/rules.ts:142-148,requireAuth ≥147;data 形状 =
 *     apps/api/src/services/rules-service.ts:444-451 降级返回 { rules: [], total: 0 },
 *     web 消费方 apps/web/src/hooks/use-rules.ts:34-39 取 res.rules)
 *    rules 挂载:server.register(rulesRoutes) 走 /api 前缀(apps/api/src/routes/index.ts:1108 同类注册)
 *    元素形状 = packages/types/src/rules.ts:23-54(Rule:id/name/description/content/scope/
 *    agentId/priority/enabled/matchType/matchPattern/createdAt/updatedAt)。
 *  - PATCH /api/rules/:id        → success(Rule)(rules.ts:303-333 区间内 handler,
 *    body 走 ruleUpdateSchema,仅传 { enabled } 即启用/禁用,web 同路径见
 *    apps/web/src/hooks/use-rules.ts:79-101)
 *  - DELETE /api/rules/:id       → success({ id, deleted })(rules.ts:333)—— 本封装给出但 RN 屏未接
 *    (见 manifest ledger note)。
 *  - 同端点的 conflicts/templates/stats/audit-log/ab-test/auto-generate 等子面本次未承载,
 *    与既有 endpoints 无重叠(此前 @ihui/api-client 无 rules 封装)。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 规则行(GET /api/rules → data.rules,形状对齐 packages/types/src/rules.ts:23-54) */
export interface RuleRecord {
  id: string
  name: string
  description?: string
  content: string
  scope: 'global' | 'workspace' | 'agent'
  agentId?: string
  priority: number
  enabled: boolean
  matchType: 'always' | 'keyword' | 'regex' | 'semantic'
  matchPattern?: string
  createdAt: string
  updatedAt: string
}

/** GET /api/rules 响应体(rules-service.ts:444-451) */
export interface RuleListResult {
  rules: RuleRecord[]
  total: number
}

/** GET /api/rules */
export async function listRules(): Promise<ApiResult<RuleListResult>> {
  return fetchApi<RuleListResult>('/api/rules')
}

/** PATCH /api/rules/:id —— 仅切换启用态(rules.ts:303-333) */
export async function patchRuleEnabled(
  id: string,
  enabled: boolean,
): Promise<ApiResult<RuleRecord>> {
  return fetchApi<RuleRecord>(`/api/rules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
