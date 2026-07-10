import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../plugins/auth.js';
import { success, error } from '../utils/response.js';
import {
  findAgentsList,
  findAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  findCategoryList,
  findCategoryById,
  findCategoriesByIds,
  findCategoryByAgentId,
  createCategory,
  updateCategory,
  deleteCategory,
  findSettlementList,
  findSettlementSummary,
  findSettlementByOrder,
  createSettlement,
  settleSettlement,
  deleteSettlements,
  findExamineList,
  findExamineStats,
  findExamineById,
  createExamine,
  updateExamine,
  deleteExamine,
  approveExamine,
  rejectExamine,
  type UpdateAgentInput,
  type UpdateCategoryInput,
  type CreateSettlementInput,
  type UpdateExamineInput,
} from '../db/agents-queries.js';
import { listOAuthApps, findAuditLogList, findAuditLogStats } from '../db/oauth-queries.js';

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    await authenticate(request);
    return true;
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
    const message = (e as Error).message || 'Authentication required';
    reply.status(statusCode).send(error(statusCode, message));
    return false;
  }
}

function toInt(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

// =============================================================================
// 代理管理路由（挂载于 /api）
// 包含：agents CRUD / categories 分类 / settlement 结算 / examine 审核 / oauth-apps
// =============================================================================

export const agentsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // -------------------------------------------------------------------------
  // agents CRUD
  // -------------------------------------------------------------------------

  // GET /agents/list - 代理列表
  server.get('/agents/list', async (request, reply) => {
    const q = request.query as {
      page?: string;
      pageSize?: string;
      status?: string;
      categoryId?: string;
      userId?: string;
      keyword?: string;
    };
    const result = await findAgentsList({
      page: toInt(q.page),
      pageSize: toInt(q.pageSize),
      status: q.status,
      categoryId: q.categoryId,
      userId: q.userId,
      keyword: q.keyword,
    });
    return reply.send(success(result));
  });

  // GET /agents/:agentId - 代理详情
  server.get('/agents/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const agent = await findAgentById(agentId);
    if (!agent) return reply.status(404).send(error(404, '智能体不存在'));
    return reply.send(success(agent));
  });

  // POST /agents/create - 创建代理
  server.post('/agents/create', async (request, reply) => {
    const body = request.body as {
      name?: string;
      description?: string | null;
      avatar?: string | null;
      cover?: string | null;
      categoryId?: string | null;
      workspaceId?: string | null;
      status?: string;
      price?: number;
      isFree?: boolean;
      sort?: number;
      remark?: string | null;
    };
    if (!body?.name) return reply.status(400).send(error(400, 'name 为必填项'));
    const agent = await createAgent({
      name: body.name,
      description: body.description,
      avatar: body.avatar,
      cover: body.cover,
      categoryId: body.categoryId,
      userId: request.userId,
      workspaceId: body.workspaceId,
      status: body.status,
      price: body.price,
      isFree: body.isFree,
      sort: body.sort,
      remark: body.remark,
    });
    return reply.send(success(agent));
  });

  // PUT /agents/:agentId - 更新代理
  server.put('/agents/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as UpdateAgentInput;
    const agent = await updateAgent(agentId, body);
    if (!agent) return reply.status(404).send(error(404, '智能体不存在'));
    return reply.send(success(agent));
  });

  // DELETE /agents/:agentId - 删除代理
  server.delete('/agents/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const agent = await deleteAgent(agentId);
    if (!agent) return reply.status(404).send(error(404, '智能体不存在'));
    return reply.send(success({ deleted: true }));
  });

  // -------------------------------------------------------------------------
  // categories 代理分类
  // -------------------------------------------------------------------------

  // GET /categories/list - 分类列表
  server.get('/categories/list', async (request, reply) => {
    const q = request.query as {
      page?: string;
      pageSize?: string;
      status?: string;
      isPaid?: string;
      keyword?: string;
    };
    const result = await findCategoryList({
      page: toInt(q.page),
      pageSize: toInt(q.pageSize),
      status: q.status,
      isPaid: q.isPaid !== undefined ? q.isPaid === 'true' : undefined,
      keyword: q.keyword,
    });
    return reply.send(success(result));
  });

  // POST /categories/create - 创建分类
  server.post('/categories/create', async (request, reply) => {
    const body = request.body as {
      name?: string;
      description?: string | null;
      icon?: string | null;
      sort?: number;
      status?: string;
      isPaid?: boolean;
    };
    if (!body?.name) return reply.status(400).send(error(400, 'name 为必填项'));
    const category = await createCategory({
      name: body.name,
      description: body.description,
      icon: body.icon,
      sort: body.sort,
      status: body.status,
      isPaid: body.isPaid,
    });
    return reply.send(success(category));
  });

  // POST /categories/batch-query - 批量查询
  server.post('/categories/batch-query', async (request, reply) => {
    const body = request.body as { ids?: string[] };
    const ids = body?.ids ?? [];
    const list = await findCategoriesByIds(ids);
    return reply.send(success({ list, total: list.length }));
  });

  // GET /categories/ids/:idList - 按 ID 列表查询
  server.get('/categories/ids/:idList', async (request, reply) => {
    const { idList } = request.params as { idList: string };
    const ids = idList
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const list = await findCategoriesByIds(ids);
    return reply.send(success({ list, total: list.length }));
  });

  // GET /categories/stats/summary - 分类统计
  server.get('/categories/stats/summary', async (_request, reply) => {
    const { list } = await findCategoryList({ page: 1, pageSize: 1000 });
    const summary = {
      total: list.length,
      enabled: list.filter((c) => c.status === '1').length,
      paid: list.filter((c) => c.isPaid).length,
    };
    return reply.send(success(summary));
  });

  // GET /categories/agent/:agentId - 按智能体 ID 查分类
  server.get('/categories/agent/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const category = await findCategoryByAgentId(agentId);
    const list = category ? [category] : [];
    return reply.send(success({ list, total: list.length }));
  });

  // GET /categories/:categoryId - 分类详情
  server.get('/categories/:categoryId', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string };
    const category = await findCategoryById(categoryId);
    if (!category) return reply.status(404).send(error(404, '分类不存在'));
    return reply.send(success(category));
  });

  // PUT /categories/:categoryId - 更新分类
  server.put('/categories/:categoryId', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string };
    const body = request.body as UpdateCategoryInput;
    const category = await updateCategory(categoryId, body);
    if (!category) return reply.status(404).send(error(404, '分类不存在'));
    return reply.send(success(category));
  });

  // DELETE /categories/:categoryId - 删除分类
  server.delete('/categories/:categoryId', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string };
    const category = await deleteCategory(categoryId);
    if (!category) return reply.status(404).send(error(404, '分类不存在'));
    return reply.send(success({ deleted: true }));
  });

  // POST /categories/:categoryId/enable - 启用付费
  server.post('/categories/:categoryId/enable', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string };
    const category = await updateCategory(categoryId, { isPaid: true });
    if (!category) return reply.status(404).send(error(404, '分类不存在'));
    return reply.send(success(category));
  });

  // POST /categories/:categoryId/disable - 禁用付费
  server.post('/categories/:categoryId/disable', async (request, reply) => {
    const { categoryId } = request.params as { categoryId: string };
    const category = await updateCategory(categoryId, { isPaid: false });
    if (!category) return reply.status(404).send(error(404, '分类不存在'));
    return reply.send(success(category));
  });

  // -------------------------------------------------------------------------
  // settlement 结算
  // -------------------------------------------------------------------------

  // GET /settlement/list - 结算列表
  server.get('/settlement/list', async (request, reply) => {
    const q = request.query as {
      page?: string;
      pageSize?: string;
      agentId?: string;
      status?: string;
      orderNo?: string;
    };
    const result = await findSettlementList({
      page: toInt(q.page),
      pageSize: toInt(q.pageSize),
      agentId: q.agentId,
      status: q.status,
      orderNo: q.orderNo,
    });
    return reply.send(success(result));
  });

  // GET /settlement/summary - 结算汇总
  server.get('/settlement/summary', async (_request, reply) => {
    const summary = await findSettlementSummary();
    return reply.send(success(summary));
  });

  // POST /settlement/settle - 触发结算
  server.post('/settlement/settle', async (request, reply) => {
    const body = request.body as { id?: string };
    if (!body?.id) return reply.status(400).send(error(400, 'id 为必填项'));
    const record = await settleSettlement(body.id);
    if (!record) return reply.status(404).send(error(404, '结算记录不存在'));
    return reply.send(success(record));
  });

  // GET /settlement/unsettled - 未结算记录
  server.get('/settlement/unsettled', async (request, reply) => {
    const q = request.query as {
      page?: string;
      pageSize?: string;
      agentId?: string;
    };
    const result = await findSettlementList({
      page: toInt(q.page),
      pageSize: toInt(q.pageSize),
      agentId: q.agentId,
      status: 'unsettled',
    });
    return reply.send(success(result));
  });

  // GET /settlement/cache/info - 缓存信息
  server.get('/settlement/cache/info', async (request, reply) => {
    const redis = (request.server as any).redis;
    const key = 'settlement:summary';
    const exists = await redis.exists(key);
    const ttl = exists ? await redis.ttl(key) : -2;
    return reply.send(success({
      cached: exists === 1,
      ttlSeconds: ttl,
      key,
    }));
  });

  // POST /settlement/cache/force-check - 强制检查缓存
  server.post('/settlement/cache/force-check', async (request, reply) => {
    const redis = (request.server as any).redis;
    const key = 'settlement:summary';
    const exists = await redis.exists(key);
    return reply.send(success({ cached: exists === 1, checked: true }));
  });

  // POST /settlement/cache/force-refresh - 强制刷新缓存
  server.post('/settlement/cache/force-refresh', async (request, reply) => {
    const redis = (request.server as any).redis;
    const summary = await findSettlementSummary();
    const key = 'settlement:summary';
    await redis.set(key, JSON.stringify(summary), 'EX', 300);
    return reply.send(success({ refreshed: true, summary }));
  });

  // POST /settlement/create - 创建结算记录
  server.post('/settlement/create', async (request, reply) => {
    const body = request.body as CreateSettlementInput;
    const record = await createSettlement(body);
    return reply.send(success(record));
  });

  // POST /settlement/sync-existing - 批量同步（依赖外部购买记录，保持 stub）
  server.post('/settlement/sync-existing', async (_request, reply) => {
    return reply.send(success({ synced: 0, message: '同步逻辑依赖外部购买记录表' }));
  });

  // POST /settlement/sync-single/:buyRecordId - 同步单条（依赖外部购买记录，保持 stub）
  server.post('/settlement/sync-single/:buyRecordId', async (_request, reply) => {
    return reply.send(success({ synced: false, message: '同步逻辑依赖外部购买记录表' }));
  });

  // POST /settlement/batch-delete - 批量删除
  server.post('/settlement/batch-delete', async (request, reply) => {
    const body = request.body as { ids?: string[] };
    const ids = body?.ids ?? [];
    const deleted = await deleteSettlements(ids);
    return reply.send(success({ deleted }));
  });

  // GET /settlement/order/:orderNo/summary - 订单结算汇总
  server.get('/settlement/order/:orderNo/summary', async (request, reply) => {
    const { orderNo } = request.params as { orderNo: string };
    const summary = await findSettlementByOrder(orderNo);
    return reply.send(success(summary));
  });

  // GET /settlement/stats/income-overview - 收入概览
  server.get('/settlement/stats/income-overview', async (_request, reply) => {
    const summary = await findSettlementSummary();
    return reply.send(success(summary));
  });

  // -------------------------------------------------------------------------
  // examine 审核
  // -------------------------------------------------------------------------

  // GET /examine/list - 审核列表
  server.get('/examine/list', async (request, reply) => {
    const q = request.query as {
      page?: string;
      pageSize?: string;
      agentId?: string;
      userId?: string;
      status?: string;
    };
    const result = await findExamineList({
      page: toInt(q.page),
      pageSize: toInt(q.pageSize),
      agentId: q.agentId,
      userId: q.userId,
      status: q.status,
    });
    return reply.send(success(result));
  });

  // GET /examine/stats/summary - 审核统计
  server.get('/examine/stats/summary', async (_request, reply) => {
    const stats = await findExamineStats();
    return reply.send(success(stats));
  });

  // POST /examine/submit - 提交审核
  server.post('/examine/submit', async (request, reply) => {
    const body = request.body as {
      agentId?: string;
      reason?: string | null;
      status?: string;
    };
    if (!body?.agentId) return reply.status(400).send(error(400, 'agentId 为必填项'));
    const record = await createExamine({
      agentId: body.agentId,
      userId: request.userId,
      status: body.status ?? 'pending',
      reason: body.reason,
    });
    return reply.send(success(record));
  });

  // POST /examine/batch-sync-avatar - 批量同步头像（依赖外部存储，保持 stub）
  server.post('/examine/batch-sync-avatar', async (_request, reply) => {
    return reply.send(success({ synced: 0, message: '头像同步依赖外部存储服务' }));
  });

  // POST /examine/sync-avatar/:agentId - 同步单个头像（依赖外部存储，保持 stub）
  server.post('/examine/sync-avatar/:agentId', async (_request, reply) => {
    return reply.send(success({ synced: false, message: '头像同步依赖外部存储服务' }));
  });

  // GET /examine/:recordId - 审核详情
  server.get('/examine/:recordId', async (request, reply) => {
    const { recordId } = request.params as { recordId: string };
    const record = await findExamineById(recordId);
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'));
    return reply.send(success(record));
  });

  // PUT /examine/:recordId - 更新审核记录
  server.put('/examine/:recordId', async (request, reply) => {
    const { recordId } = request.params as { recordId: string };
    const body = request.body as UpdateExamineInput;
    const record = await updateExamine(recordId, body);
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'));
    return reply.send(success(record));
  });

  // DELETE /examine/:recordId - 删除审核记录
  server.delete('/examine/:recordId', async (request, reply) => {
    const { recordId } = request.params as { recordId: string };
    const record = await deleteExamine(recordId);
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'));
    return reply.send(success({ deleted: true }));
  });

  // PUT /examine/:recordId/approve - 批准
  server.put('/examine/:recordId/approve', async (request, reply) => {
    const { recordId } = request.params as { recordId: string };
    const record = await approveExamine(recordId, request.userId!);
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'));
    return reply.send(success(record));
  });

  // PUT /examine/:recordId/reject - 拒绝
  server.put('/examine/:recordId/reject', async (request, reply) => {
    const { recordId } = request.params as { recordId: string };
    const body = request.body as { reason?: string };
    if (!body?.reason) return reply.status(400).send(error(400, 'reason 为必填项'));
    const record = await rejectExamine(recordId, request.userId!, body.reason);
    if (!record) return reply.status(404).send(error(404, '审核记录不存在'));
    return reply.send(success(record));
  });

  // -------------------------------------------------------------------------
  // oauth-apps OAuth 应用
  // -------------------------------------------------------------------------

  // POST /oauth-apps/create - 创建 OAuth 应用
  // （依赖 clientId/clientSecret 生成与哈希逻辑，保持 stub，详见 /auth/oauth/apps/create）
  server.post('/oauth-apps/create', async (_request, reply) => {
    return reply.send(
      success({ message: '请使用 POST /auth/oauth/apps/create 创建 OAuth 应用' }),
    );
  });

  // GET /oauth-apps/list - OAuth 应用列表
  server.get('/oauth-apps/list', async (request, reply) => {
    const q = request.query as { page?: string; limit?: string };
    const page = toInt(q.page) ?? 1;
    const limit = toInt(q.limit) ?? 20;
    const result = await listOAuthApps(request.userId!, page, limit);
    return reply.send(success({ list: result.items, total: result.total }));
  });

  // GET /oauth-apps/audit-logs/stats - 聚合统计
  server.get('/oauth-apps/audit-logs/stats', async (_request, reply) => {
    const stats = await findAuditLogStats();
    return reply.send(success(stats));
  });

  // GET /oauth-apps/audit-logs/export - CSV 导出（保持 stub，依赖文件生成管线）
  server.get('/oauth-apps/audit-logs/export', async (_request, reply) => {
    return reply.send(success({ url: null, message: '导出功能暂未实现' }));
  });

  // GET /oauth-apps/audit-logs - 审计日志查询
  server.get('/oauth-apps/audit-logs', async (request, reply) => {
    const q = request.query as { page?: string; limit?: string; clientId?: string; event?: string; status?: string };
    const { items, total } = await findAuditLogList({
      page: toInt(q.page) ?? 1,
      limit: toInt(q.limit) ?? 20,
      clientId: q.clientId,
      event: q.event,
      status: q.status,
    });
    return reply.send(success({ list: items, total }));
  });
};
