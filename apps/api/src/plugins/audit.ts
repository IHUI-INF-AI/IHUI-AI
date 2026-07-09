import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { addAuditLog } from '../db/search-queries.js';

const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * 从请求 URL 提取资源类型。
 * 形如 /api/users/123 -> 'users'；/api/admin/audit-logs -> 'audit-logs'。
 */
function parseResourceType(urlPath: string): string | undefined {
  const segs = urlPath.split('/').filter(Boolean);
  if (segs[0] === 'api') segs.shift();
  if (segs[0] === 'admin') segs.shift();
  return segs[0];
}

/**
 * 审计日志中间件：记录所有 POST/PATCH/PUT/DELETE 的 /api 请求到 audit_logs。
 * - 使用 onResponse 钩子，在响应发出后执行，不阻塞主流程。
 * - userId 从 JWT（authenticate 写入）取，未登录写操作记为 null。
 * - 用 setImmediate 异步落库，失败忽略，保证不影响业务请求。
 */
const auditPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase();
    if (!WRITE_METHODS.has(method)) return;

    const url = request.url.split('?')[0] ?? '';
    if (!url.startsWith('/api/')) return;

    const userId = request.userId ?? request.jwtPayload?.userId;
    const resourceType = parseResourceType(url);
    const params = (request.params ?? {}) as { id?: string };
    const resourceId = params.id;
    const statusCode = reply.statusCode;
    const userAgent = request.headers['user-agent'];

    setImmediate(() => {
      addAuditLog({
        userId,
        action: method,
        resourceType,
        resourceId,
        details: { url, statusCode },
        ip: request.ip,
        userAgent: userAgent ? userAgent.slice(0, 512) : undefined,
      }).catch(() => {
        /* 审计写入失败不影响业务 */
      });
    });
  });
};

export default fp(auditPlugin, {
  name: 'audit-plugin',
  fastify: '5.x',
});
