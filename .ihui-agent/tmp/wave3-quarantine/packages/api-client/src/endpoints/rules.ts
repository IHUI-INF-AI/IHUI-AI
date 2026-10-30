/**
 * 智能体运行规则(Rules)端点 —— 承载 Web 端 /rules 页(RulesManager)的取数面。
 *
 * 后端契约现读(2026-10-26,apps/api = Fastify 转发层,真正的存储/引擎在 ai-service):
 *  - GET    /api/rules          → data { rules: Rule[], total: number }   apps/api/src/routes/rules.ts:143(信封 success(data) 于 :147)
 *  - POST   /api/rules          → 201 data Rule                            apps/api/src/routes/rules.ts:151(成功分支 :160)
 *  - PATCH  /api/rules/:id      → data Rule                                apps/api/src/routes/rules.ts:307(成功分支 :319)
 *  - DELETE /api/rules/:id      → data { id, deleted }                      apps/api/src/routes/rules.ts:326(成功分支 :333)
 *  - POST   /api/rules/:id/test → data { matched, reason }                  apps/api/src/routes/rules.ts:337(成功分支 :346)
 *  注册面:apps/api/src/routes/index.ts:1217 `server.register(rulesRoutes, { prefix: '/api' })`
 *  鉴权:五枚端点全部 requireAuth(rules.ts:144/152/308/327/338),无 admin 门槛。
 *  入参口径:创建走 ruleCreateSchema(rules.ts:73-83,name/content 必填、scope/priority/enabled/matchType 带默认值),
 *           更新走 ruleUpdateSchema(rules.ts:85-95,全字段可选 ⇒ 启停只需 PATCH { enabled })。
 *
 * 降级事实(必须如实登记,不能当成"后端坏了"):
 *  读侧(listRules / getRule / updateRule / deleteRule)在 rules-service 层 catch 后**降级返回空**
 *  (apps/api/src/services/rules-service.ts:444-449 listRules catch ⇒ `{rules:[],total:0}`),
 *  所以 ai-service 不可达时 api 仍回 200 + 空列表 ⇒ 屏上表现为「空态」而不是「错误态」。
 *  写侧(createRule / testRule)不降级:异常原样上抛 ⇒ api 回 502 + message(rules.ts:161-163)。
 */
import type { ApiResult, Rule, RuleInput, RuleListResponse, RuleTestResult, RuleUpdate } from '@ihui/types'
import { fetchApi } from '../client.js'

/** 删除回执(apps/api/src/routes/rules.ts:333 `success({ id, deleted: Boolean(deleted) })`) */
export interface RuleDeleteResult {
  id: string
  deleted: boolean
}

/** 列出全部规则 —— GET /api/rules */
export async function getRuleList(): Promise<ApiResult<RuleListResponse>> {
  return fetchApi<RuleListResponse>('/api/rules')
}

/** 创建规则 —— POST /api/rules(成功 201) */
export async function createRule(input: RuleInput): Promise<ApiResult<Rule>> {
  return fetchApi<Rule>('/api/rules', { method: 'POST', body: JSON.stringify(input) })
}

/** 更新规则(部分字段)—— PATCH /api/rules/:id */
export async function updateRule(id: string, patch: RuleUpdate): Promise<ApiResult<Rule>> {
  return fetchApi<Rule>(`/api/rules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/** 删除规则 —— DELETE /api/rules/:id */
export async function deleteRule(id: string): Promise<ApiResult<RuleDeleteResult>> {
  return fetchApi<RuleDeleteResult>(`/api/rules/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** 测试规则对一条消息是否命中 —— POST /api/rules/:id/test */
export async function testRule(id: string, message: string): Promise<ApiResult<RuleTestResult>> {
  return fetchApi<RuleTestResult>(`/api/rules/${encodeURIComponent(id)}/test`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}
