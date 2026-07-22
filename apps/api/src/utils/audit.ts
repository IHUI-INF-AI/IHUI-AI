/**
 * Audit helper — 为 insert/update 操作附加 `updatedBy`(操作者 userId)审计字段。
 *
 * 用途:G10 段为 orders / commissionFlows / withdrawalFlows / agentTasks 添加了 `updatedBy` 字段,
 * 本模块提供 helper 让 query 函数显式附加 updatedBy,避免每个调用方都重复写。
 *
 * 调用规则:
 * - route handler 调 query 函数时,传 `request.userId ?? null`(操作者 = 当前登录用户)
 * - service 层异步任务调 query 函数时,传 `null`(系统操作无操作者)
 *
 * 为什么不自动注入(ALS/AsyncLocalStorage):
 * Fastify 5 全局 preHandler hook 在 route 级 preHandler 之前执行,而 authenticate 在 route 级
 * requireAuth 中才运行,全局 hook 拿不到 request.userId,ALS 方案会要求每个受保护 route 改
 * preHandler 数组,改动面比 helper 方案更大。Helper 方案虽然调用方需显式传 userId,但
 * 改动局限于 4 个 query 文件 + 调用方,边界明确,易测,易回滚。
 */
export function withAudit<T extends Record<string, unknown>>(
  values: T,
  operatorId: string | null,
): T & { updatedBy: string | null } {
  return { ...values, updatedBy: operatorId }
}
