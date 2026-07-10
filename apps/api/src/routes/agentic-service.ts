import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../plugins/auth.js';
import { success, error } from '../utils/response.js';
import { findAgentsList, findAgentById } from '../db/agents-queries.js';
import { findCategoryList } from '../db/agents-queries.js';

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

export const agenticServiceRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // GET /zhsAgent/list - 智能体列表
  server.get('/zhsAgent/list', async (request, reply) => {
    const query = request.query as { page?: string; pageSize?: string; search?: string };
    const { list, total } = await findAgentsList({
      page: Number(query.page ?? 1),
      pageSize: Number(query.pageSize ?? 20),
      keyword: query.search,
    });
    return reply.send(success({ list, total }));
  });

  // GET /zhsAgent/:agentId - 智能体详情
  server.get('/zhsAgent/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const agent = await findAgentById(agentId);
    if (!agent) return reply.status(404).send(error(404, 'Agent not found'));
    return reply.send(success(agent));
  });

  // GET /categories - 智能体分类
  server.get('/categories', async (_request, reply) => {
    const { list, total } = await findCategoryList({});
    return reply.send(success({ list, total }));
  });
};
