import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import { success, error } from '../utils/response.js';
import { findPlazaItemList } from '../db/misc-queries.js';

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

// =============================================================================
// 查询参数
// =============================================================================

const plazaListQuerySchema = z.object({
  status: z.string().max(20).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// =============================================================================
// 需求广场路由（挂载于 /api/plaza）
// =============================================================================

export const plazaRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // GET /list - 广场智能体列表
  server.get('/list', async (request, reply) => {
    const parsed = plazaListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { status, search, page, pageSize } = parsed.data;
    const result = await findPlazaItemList({ status, search, page, pageSize });
    return reply.send(success(result));
  });
};
