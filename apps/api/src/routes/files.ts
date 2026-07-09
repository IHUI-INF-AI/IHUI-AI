import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import { findFileById } from '../db/workspace-queries.js';
import {
  searchFiles,
  canAccessFile,
  createShare,
  findShareByToken,
  deleteShare,
  findRecentFiles,
} from '../db/file-queries.js';
import {
  findTagsByTarget,
  attachTag,
  detachTag,
} from '../db/social-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

// =============================================================================
// 序列化辅助
// =============================================================================

function serializeFile(f: {
  id: string;
  projectId: string;
  name: string;
  path: string;
  size: number | bigint;
  mimeType: string;
  uploadedBy: string | null;
  createdAt: Date;
}) {
  return {
    id: f.id,
    projectId: f.projectId,
    name: f.name,
    size: Number(f.size),
    mimeType: f.mimeType,
    uploadedBy: f.uploadedBy,
    createdAt: f.createdAt,
  };
}

function serializeTag(t: {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  createdBy: string | null;
  createdAt: Date;
}) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    color: t.color,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
  };
}

// =============================================================================
// Zod schemas
// =============================================================================

const searchQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().max(255).optional()),
  projectId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  mimeType: z.preprocess(emptyToUndefined, z.string().max(128).optional()),
  tag: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const idParamSchema = z.object({ id: z.string().uuid('无效的文件 ID') });
const tagIdParamSchema = z.object({
  id: z.string().uuid('无效的文件 ID'),
  tagId: z.string().uuid('无效的标签 ID'),
});
const tokenParamSchema = z.object({ token: z.string().min(1, 'token 不能为空') });
const shareIdParamSchema = z.object({ id: z.string().uuid('无效的分享 ID') });

const addTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()).min(1, '至少选择一个标签').max(50, '一次最多 50 个标签'),
});

const createShareSchema = z.object({
  sharedWith: z.string().uuid().optional(),
  permissions: z.enum(['view', 'edit']).default('view'),
  expiresAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v))
    .optional(),
});

// =============================================================================
// 路由
// =============================================================================

export const fileRoutes: FastifyPluginAsync = async (server) => {
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      const message = (e as Error).message || 'Authentication required';
      return reply.status(statusCode).send(error(statusCode, message));
    }
  };

  // 判断当前用户是否为管理员
  const isAdmin = (request: FastifyRequest): boolean =>
    (request.jwtPayload?.roleId ?? 0) >= ADMIN_ROLE_ID;

  // GET /files/search - 搜索文件（query: q / projectId / mimeType / tag）
  server.get('/files/search', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;

    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const list = await searchFiles({
      userId: request.userId,
      q: parsed.data.q,
      projectId: parsed.data.projectId,
      mimeType: parsed.data.mimeType,
      tag: parsed.data.tag,
    });
    return reply.send(success({ files: list.map(serializeFile) }));
  });

  // GET /files/recent - 最近文件（按 createdAt 倒序）
  server.get('/files/recent', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;

    const parsed = recentQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const list = await findRecentFiles(request.userId, parsed.data.limit);
    return reply.send(success({ files: list.map(serializeFile) }));
  });

  // GET /files/shared/:token - 公开访问分享的文件信息（无需登录）
  server.get('/files/shared/:token', async (request, reply) => {
    const parsed = tokenParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const share = await findShareByToken(parsed.data.token);
    if (!share) {
      return reply.status(404).send(error(404, '分享不存在或已过期'));
    }

    const file = await findFileById(share.fileId);
    if (!file) {
      return reply.status(404).send(error(404, '文件不存在'));
    }

    return reply.send(
      success({
        share: {
          id: share.id,
          permissions: share.permissions,
          expiresAt: share.expiresAt,
          createdAt: share.createdAt,
        },
        file: {
          id: file.id,
          name: file.name,
          size: Number(file.size),
          mimeType: file.mimeType,
          createdAt: file.createdAt,
        },
      }),
    );
  });

  // GET /files/:id/tags - 获取文件标签
  server.get('/files/:id/tags', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const file = await findFileById(parsed.data.id);
    if (!file) {
      return reply.status(404).send(error(404, '文件不存在'));
    }
    if (!isAdmin(request) && !(await canAccessFile(userId, file))) {
      return reply.status(403).send(error(403, '无权访问该文件'));
    }

    const tags = await findTagsByTarget('file', file.id);
    return reply.send(success({ tags: tags.map(serializeTag) }));
  });

  // POST /files/:id/tags - 给文件打标签（覆盖式追加）
  server.post('/files/:id/tags', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const bodyParsed = addTagsSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'));
    }

    const file = await findFileById(parsed.data.id);
    if (!file) {
      return reply.status(404).send(error(404, '文件不存在'));
    }
    if (!isAdmin(request) && !(await canAccessFile(userId, file))) {
      return reply.status(403).send(error(403, '无权操作该文件'));
    }

    for (const tagId of bodyParsed.data.tagIds) {
      await attachTag({
        tagId,
        resourceType: 'file',
        resourceId: file.id,
        createdBy: userId,
      });
    }
    const tags = await findTagsByTarget('file', file.id);
    return reply.send(success({ tags: tags.map(serializeTag) }));
  });

  // DELETE /files/:id/tags/:tagId - 移除文件上的标签
  server.delete('/files/:id/tags/:tagId', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const parsed = tagIdParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const file = await findFileById(parsed.data.id);
    if (!file) {
      return reply.status(404).send(error(404, '文件不存在'));
    }
    if (!isAdmin(request) && !(await canAccessFile(userId, file))) {
      return reply.status(403).send(error(403, '无权操作该文件'));
    }

    const removed = await detachTag({
      tagId: parsed.data.tagId,
      resourceType: 'file',
      resourceId: file.id,
    });
    if (!removed) {
      return reply.status(404).send(error(404, '该标签未绑定到此文件'));
    }
    return reply.send(success({ removed: true }));
  });

  // POST /files/:id/share - 创建分享
  server.post('/files/:id/share', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const bodyParsed = createShareSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'));
    }

    const file = await findFileById(parsed.data.id);
    if (!file) {
      return reply.status(404).send(error(404, '文件不存在'));
    }
    if (!isAdmin(request) && !(await canAccessFile(userId, file))) {
      return reply.status(403).send(error(403, '无权分享该文件'));
    }

    let share;
    try {
      share = await createShare({
        fileId: file.id,
        sharedBy: userId,
        sharedWith: bodyParsed.data.sharedWith,
        permissions: bodyParsed.data.permissions,
        expiresAt: bodyParsed.data.expiresAt,
      });
    } catch (e) {
      request.log.error({ err: e }, '创建分享失败');
      return reply.status(500).send(error(500, '创建分享失败'));
    }

    return reply.status(201).send(
      success({
        share: {
          id: share.id,
          shareToken: share.shareToken,
          permissions: share.permissions,
          sharedWith: share.sharedWith,
          expiresAt: share.expiresAt,
          createdAt: share.createdAt,
        },
      }),
    );
  });

  // DELETE /files/shares/:id - 撤销分享（仅创建者本人）
  server.delete('/files/shares/:id', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;

    const parsed = shareIdParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const deleted = await deleteShare(parsed.data.id, request.userId);
    if (!deleted) {
      return reply.status(404).send(error(404, '分享不存在或无权撤销'));
    }
    return reply.send(success({ deleted: true }));
  });

};
