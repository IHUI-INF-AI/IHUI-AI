/**
 * Audit helper — 为 insert/update 操作附加 `createdBy` / `updatedBy`(操作者 userId)审计字段。
 *
 * 用途:
 * - G10 段为 orders / commissionFlows / withdrawalFlows / agentTasks 添加了 `updatedBy` 字段
 * - G13 段补齐 `createdBy` 字段(与 updatedBy 区分:创建者 vs 最近修改者)
 *
 * 本模块提供 2 个 helper:
 * - `withAudit(values, operatorId)`: 纯 update 场景,只附加 updatedBy
 * - `withAuditBoth(values, operatorId)`: insert 场景,同时附加 createdBy + updatedBy(通常相同)
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

/**
 * 纯 update 场景:仅附加 `updatedBy`(不动 createdBy)。
 * 用于 approveWithdrawal / rejectWithdrawal / updateOrderStatus 等"仅改状态/审批"操作。
 */
export function withAudit<T extends Record<string, unknown>>(
  values: T,
  operatorId: string | null,
): T & { updatedBy: string | null } {
  return { ...values, updatedBy: operatorId }
}

/**
 * insert 场景:同时附加 `createdBy` + `updatedBy`(两者通常相同 operatorId)。
 * 用于 createOrder / createCommissionFlow / applyWithdrawal / agentTasks insert 等"新建记录"操作。
 * 不修改原对象,幂等(若已含 createdBy/updatedBy 则覆盖)。
 */
export function withAuditBoth<T extends Record<string, unknown>>(
  values: T,
  operatorId: string | null,
): T & { createdBy: string | null; updatedBy: string | null } {
  return { ...values, createdBy: operatorId, updatedBy: operatorId }
}
