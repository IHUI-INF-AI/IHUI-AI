import { eq } from 'drizzle-orm';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { users, refreshTokens } from '@ihui/database';
import { authenticate } from '../plugins/auth.js';
import { findUserById } from '../db/queries.js';
import {
  findSearchHistory,
  findAuditLogs,
  addAuditLog,
  clearSearchHistory,
} from '../db/search-queries.js';
import { success, error } from '../utils/response.js';

/**
 * GDPR 数据擦除路由。
 *
 * - POST /api/gdpr/export        导出当前用户所有数据（用户档案 + 搜索历史 + 审计日志）
 * - POST /api/gdpr/erase         擦除用户数据（软删除 status=3 + PII 匿名化 + 吊销 refresh token）
 * - POST /api/gdpr/portability   数据可携带性导出（结构化 JSON，机器可读）
 *
 * 所有端点均需登录（authenticate）。
 */
export const gdprRoutes: FastifyPluginAsync = async (server) => {
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
    try {
      await authenticate(request);
      return true;
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      const message = (e as Error).message || 'Authentication required';
      reply.status(statusCode).send(error(statusCode, message));
      return false;
    }
  };

  // POST /export - 导出用户所有数据
  server.post('/export', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const userId = request.userId!;
    // 数据主体访问自身完整 PII，跳过响应脱敏
    request.skipResponseSanitization = true;

    const [user, searchHistory, auditLogs] = await Promise.all([
      findUserById(userId),
      findSearchHistory(userId, 500),
      findAuditLogs(1, 500, { userId }),
    ]);

    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'));
    }

    await addAuditLog({
      userId,
      action: 'GDPR_EXPORT',
      resourceType: 'gdpr',
      resourceId: userId,
      details: { searchHistoryCount: searchHistory.length, auditLogCount: auditLogs.total },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.send(
      success({
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
          bio: user.bio,
          gender: user.gender,
          birthday: user.birthday,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        searchHistory: searchHistory.map((h) => ({
          id: h.id,
          query: h.query,
          resultsCount: h.resultsCount,
          createdAt: h.createdAt,
        })),
        auditLogs: auditLogs.list.map((a) => ({
          id: a.id,
          action: a.action,
          resourceType: a.resourceType,
          resourceId: a.resourceId,
          createdAt: a.createdAt,
        })),
      }),
    );
  });

  // POST /erase - 擦除用户数据（软删除 + 匿名化）
  server.post('/erase', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const userId = request.userId!;

    const user = await findUserById(userId);
    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'));
    }
    if (user.status === 3) {
      return reply.status(400).send(error(400, '账户已注销'));
    }

    // 1. 匿名化用户 PII 字段 + 软删除（status=3）
    await db
      .update(users)
      .set({
        phone: null,
        email: null,
        username: `erased_${userId.slice(0, 8)}`,
        passwordHash: null,
        nickname: '已注销用户',
        avatar: null,
        bio: null,
        inviteCode: null,
        status: 3,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 2. 吊销该用户所有未过期的 refresh token
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.userId, userId));

    // 3. 清理搜索历史
    await clearSearchHistory(userId).catch(() => {
      /* 搜索历史清理失败不阻断擦除主流程 */
    });

    await addAuditLog({
      userId,
      action: 'GDPR_ERASE',
      resourceType: 'gdpr',
      resourceId: userId,
      details: { anonymized: true, status: 3 },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.send(success({ erased: true, userId }));
  });

  // POST /portability - 数据可携带性导出（结构化 JSON）
  server.post('/portability', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return;
    const userId = request.userId!;
    // 数据主体访问自身完整 PII，跳过响应脱敏
    request.skipResponseSanitization = true;

    const [user, searchHistory, auditLogs] = await Promise.all([
      findUserById(userId),
      findSearchHistory(userId, 1000),
      findAuditLogs(1, 1000, { userId }),
    ]);

    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'));
    }

    // 机器可读的结构化导出（符合 GDPR 可携带性要求）
    const portable = {
      schema: 'ihui-gdpr-portability/v1',
      exportedAt: new Date().toISOString(),
      subject: {
        id: user.id,
        identifier: user.phone ?? user.email ?? user.username,
      },
      data: {
        profile: {
          username: user.username,
          nickname: user.nickname,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          bio: user.bio,
          gender: user.gender,
          birthday: user.birthday,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        searchHistory: searchHistory.map((h) => ({
          query: h.query,
          resultsCount: h.resultsCount,
          createdAt: h.createdAt,
        })),
        auditTrail: auditLogs.list.map((a) => ({
          action: a.action,
          resourceType: a.resourceType,
          resourceId: a.resourceId,
          createdAt: a.createdAt,
        })),
      },
    };

    reply.header('content-type', 'application/json; charset=utf-8');
    reply.header(
      'content-disposition',
      `attachment; filename="gdpr-portability-${userId}.json"`,
    );

    return reply.send(success(portable));
  });
};
