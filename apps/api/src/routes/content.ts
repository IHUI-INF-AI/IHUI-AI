import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  findAnnouncements,
  findAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  findHelpCategories,
  findHelpCategoryById,
  findHelpCategoryBySlug,
  createHelpCategory,
  updateHelpCategory,
  deleteHelpCategory,
  findHelpArticles,
  findHelpArticleBySlug,
  findHelpArticleById,
  createHelpArticle,
  updateHelpArticle,
  deleteHelpArticle,
  incrementHelpArticleView,
  findHelpArticleNeighbors,
  findHelpCategoryNameBySlug,
  findDocs,
  findAllDocs,
  findDocBySlug,
  findDocById,
  createDoc,
  updateDoc,
  deleteDoc,
  incrementDocView,
  findDocNeighbors,
  markAnnouncementRead,
  findReadAnnouncementIds,
  countUnreadAnnouncements,
} from '../db/content-queries.js';
import { success, error } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

const ANNOUNCEMENT_TYPES = ['info', 'warning', 'maintenance', 'update'] as const;
const HELP_CATEGORIES = ['account', 'payment', 'project', 'ai', 'tech', 'other'] as const;
const DOC_CATEGORIES = ['api', 'guide', 'development', 'faq'] as const;
const DOC_STATUS = ['draft', 'published'] as const;

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') });
const slugParamSchema = z.object({ slug: z.string().min(1).max(128) });

const helpArticlesQuerySchema = z.object({
  category: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.enum(HELP_CATEGORIES).optional(),
  ),
});

const docsQuerySchema = z.object({
  category: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.enum(DOC_CATEGORIES).optional(),
  ),
});

const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  type: z.enum(ANNOUNCEMENT_TYPES).optional(),
  isPinned: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(ANNOUNCEMENT_TYPES).optional(),
  isPinned: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

const createHelpCategorySchema = z.object({
  name: z.string().min(1).max(64),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/i, 'slug 只能包含字母、数字和连字符'),
  description: z.string().optional(),
  icon: z.string().max(64).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateHelpCategorySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/i, 'slug 只能包含字母、数字和连字符').optional(),
  description: z.string().nullable().optional(),
  icon: z.string().max(64).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const createHelpArticleSchema = z.object({
  category: z.enum(HELP_CATEGORIES).optional(),
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(128).regex(/^[a-z0-9-]+$/i, 'slug 只能包含字母、数字和连字符'),
  content: z.string().min(1),
  sortOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

const updateHelpArticleSchema = z.object({
  category: z.enum(HELP_CATEGORIES).optional(),
  title: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9-]+$/i, 'slug 只能包含字母、数字和连字符')
    .optional(),
  content: z.string().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

const createDocSchema = z.object({
  category: z.enum(DOC_CATEGORIES).optional(),
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(128).regex(/^[a-z0-9-]+$/i, 'slug 只能包含字母、数字和连字符'),
  content: z.string().min(1),
  status: z.enum(DOC_STATUS).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateDocSchema = z.object({
  category: z.enum(DOC_CATEGORIES).optional(),
  title: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9-]+$/i, 'slug 只能包含字母、数字和连字符')
    .optional(),
  content: z.string().min(1).optional(),
  status: z.enum(DOC_STATUS).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    await authenticate(request);
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
    const message = (e as Error).message || 'Authentication required';
    reply.status(statusCode).send(error(statusCode, message));
    return false;
  }
  const roleId = request.jwtPayload?.roleId ?? 0;
  if (roleId < ADMIN_ROLE_ID) {
    reply.status(403).send(error(403, '需要管理员权限'));
    return false;
  }
  return true;
}

// =============================================================================
// 公开路由（前缀 /api）
// =============================================================================

export const contentRoutes: FastifyPluginAsync = async (server) => {
  // ----- Announcements -----

  // GET /announcements - 公开：已发布公告列表（登录用户可看到 isRead 标记）
  server.get(
    '/announcements',
    {
      schema: {
        summary: '公告列表',
        description: '公开接口:已发布公告列表(登录用户可看到 isRead 标记)',
        tags: ['content'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    async (request, reply) => {
    const list = await findAnnouncements();
    // 可选鉴权：已登录则附加 isRead 标记
    let readSet = new Set<string>();
    try {
      await authenticate(request);
      const userId = request.userId!;
      const readIds = await findReadAnnouncementIds(userId);
      readSet = new Set(readIds);
    } catch {
      // 未登录，全部视为未读
    }
    const listWithReadFlag = list.map((a) => ({
      ...a,
      isRead: readSet.has(a.id),
    }));
    return reply.send(success({ list: listWithReadFlag }));
    },
  );

  // GET /announcements/unread/count - 当前用户未读公告数（需登录）
  server.get('/announcements/unread/count', async (request, reply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return reply.status(statusCode).send(error(statusCode, (e as Error).message || 'Authentication required'));
    }
    const userId = request.userId!;
    const result = await countUnreadAnnouncements(userId);
    return reply.send(success(result));
  });

  // GET /announcements/:id - 公开：公告详情（仅已发布）
  server.get('/announcements/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const announcement = await findAnnouncementById(parsed.data.id);
    if (!announcement || !announcement.isPublished) {
      return reply.status(404).send(error(404, '公告不存在'));
    }
    return reply.send(success({ announcement }));
  });

  // POST /announcements/:id/read - 标记公告为已读（需登录）
  server.post('/announcements/:id/read', async (request, reply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return reply.status(statusCode).send(error(statusCode, (e as Error).message || 'Authentication required'));
    }
    const userId = request.userId!;
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    // 校验公告存在且已发布
    const announcement = await findAnnouncementById(parsed.data.id);
    if (!announcement || !announcement.isPublished) {
      return reply.status(404).send(error(404, '公告不存在'));
    }
    await markAnnouncementRead(userId, parsed.data.id);
    return reply.send(success({ ok: true }));
  });

  // ----- Help -----

  // GET /help/categories - 公开：帮助分类列表
  server.get('/help/categories', async (_request, reply) => {
    const list = await findHelpCategories();
    return reply.send(success({ list }));
  });

  // GET /help/articles - 公开：帮助文章列表（支持 category 筛选，仅已发布）
  server.get(
    '/help/articles',
    {
      schema: {
        summary: '帮助文章列表',
        description: '公开接口:帮助文章列表(支持 category 筛选,仅已发布)',
        tags: ['content'],
        querystring: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['account', 'payment', 'project', 'ai', 'tech', 'other'],
              description: '分类筛选(可选)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
    const parsed = helpArticlesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const list = await findHelpArticles(parsed.data.category);
    return reply.send(success({ list }));
    },
  );

  // GET /help/articles/:slug - 公开：文章详情（增加 view_count，附 prev/next/categoryName）
  server.get('/help/articles/:slug', async (request, reply) => {
    const parsed = slugParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const article = await findHelpArticleBySlug(parsed.data.slug);
    if (!article || !article.isPublished) {
      return reply.status(404).send(error(404, '文章不存在'));
    }
    await incrementHelpArticleView(article.id);
    const [neighbors, categoryName] = await Promise.all([
      findHelpArticleNeighbors(article),
      article.category ? findHelpCategoryNameBySlug(article.category) : null,
    ]);
    return reply.send(success({ article, categoryName: categoryName ?? undefined, ...neighbors }));
  });

  // ----- Docs -----

  // GET /docs - 公开：文档列表（支持 category 筛选，仅 published）
  server.get(
    '/docs',
    {
      schema: {
        summary: '文档列表',
        description: '公开接口:文档列表(支持 category 筛选,仅 published)',
        tags: ['content'],
        querystring: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['api', 'guide', 'development', 'faq'],
              description: '分类筛选(可选)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
    const parsed = docsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const list = await findDocs(parsed.data.category);
    return reply.send(success({ list }));
    },
  );

  // GET /docs/:slug - 公开：文档详情（增加 view_count，仅 published，附 prev/next）
  server.get('/docs/:slug', async (request, reply) => {
    const parsed = slugParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const doc = await findDocBySlug(parsed.data.slug);
    if (!doc || doc.status !== 'published') {
      return reply.status(404).send(error(404, '文档不存在'));
    }
    await incrementDocView(doc.id);
    const neighbors = await findDocNeighbors(doc);
    return reply.send(success({ doc, ...neighbors }));
  });
};

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminContentRoutes: FastifyPluginAsync = async (server) => {
  // 统一 admin 鉴权
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return;
  });

  // ----- Announcements Admin -----

  // POST /announcements - 创建公告
  server.post('/announcements', async (request, reply) => {
    const parsed = createAnnouncementSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const announcement = await createAnnouncement({
      ...parsed.data,
      createdBy: request.userId,
    });
    return reply.status(201).send(success({ announcement }));
  });

  // PATCH /announcements/:id - 更新公告
  server.patch('/announcements/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateAnnouncementSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findAnnouncementById(idParsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '公告不存在'));
    }
    const announcement = await updateAnnouncement(idParsed.data.id, parsed.data);
    return reply.send(success({ announcement }));
  });

  // DELETE /announcements/:id - 删除公告
  server.delete('/announcements/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findAnnouncementById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '公告不存在'));
    }
    await deleteAnnouncement(parsed.data.id);
    return reply.send(success({ ok: true }));
  });

  // ----- Help Categories Admin -----

  // GET /help/categories - 列出所有分类（admin 可见全部）
  server.get('/help/categories', async (_request, reply) => {
    const list = await findHelpCategories();
    return reply.send(success({ list }));
  });

  // POST /help/categories - 创建分类
  server.post('/help/categories', async (request, reply) => {
    const parsed = createHelpCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findHelpCategoryBySlug(parsed.data.slug);
    if (existing) {
      return reply.status(409).send(error(409, 'slug 已存在'));
    }
    try {
      const category = await createHelpCategory(parsed.data);
      return reply.status(201).send(success({ category }));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return reply.status(409).send(error(409, 'name 或 slug 已存在'));
      }
      throw e;
    }
  });

  // PATCH /help/categories/:id - 更新分类
  server.patch('/help/categories/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateHelpCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findHelpCategoryById(idParsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '分类不存在'));
    }
    try {
      const category = await updateHelpCategory(idParsed.data.id, parsed.data);
      return reply.send(success({ category }));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return reply.status(409).send(error(409, 'name 或 slug 已存在'));
      }
      throw e;
    }
  });

  // DELETE /help/categories/:id - 删除分类
  server.delete('/help/categories/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findHelpCategoryById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '分类不存在'));
    }
    await deleteHelpCategory(parsed.data.id);
    return reply.send(success({ ok: true }));
  });

  // ----- Help Articles Admin -----

  // GET /help/articles - 列出全部帮助文章(含未发布)
  server.get('/help/articles', async (request, reply) => {
    const category = (request.query as { category?: string })?.category;
    const list = await findHelpArticles(category);
    return reply.send(success({ list }));
  });

  // POST /help/articles - 创建帮助文章
  server.post('/help/articles', async (request, reply) => {
    const parsed = createHelpArticleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    try {
      const article = await createHelpArticle(parsed.data);
      return reply.status(201).send(success({ article }));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return reply.status(409).send(error(409, 'slug 已存在'));
      }
      throw e;
    }
  });

  // PATCH /help/articles/:id - 更新帮助文章
  server.patch('/help/articles/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateHelpArticleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findHelpArticleById(idParsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '文章不存在'));
    }
    try {
      const article = await updateHelpArticle(idParsed.data.id, parsed.data);
      return reply.send(success({ article }));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return reply.status(409).send(error(409, 'slug 已存在'));
      }
      throw e;
    }
  });

  // DELETE /help/articles/:id - 删除帮助文章
  server.delete('/help/articles/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findHelpArticleById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '文章不存在'));
    }
    await deleteHelpArticle(parsed.data.id);
    return reply.send(success({ ok: true }));
  });

  // ----- Docs Admin -----

  // GET /docs - 列出全部文档(含未发布)
  server.get('/docs', async (request, reply) => {
    const category = (request.query as { category?: string })?.category;
    const list = await findAllDocs(category);
    return reply.send(success({ list }));
  });

  // POST /docs - 创建文档
  server.post('/docs', async (request, reply) => {
    const parsed = createDocSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    try {
      const doc = await createDoc({
        ...parsed.data,
        authorId: request.userId,
      });
      return reply.status(201).send(success({ doc }));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return reply.status(409).send(error(409, 'slug 已存在'));
      }
      throw e;
    }
  });

  // PATCH /docs/:id - 更新文档
  server.patch('/docs/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateDocSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findDocById(idParsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '文档不存在'));
    }
    try {
      const doc = await updateDoc(idParsed.data.id, parsed.data);
      return reply.send(success({ doc }));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return reply.status(409).send(error(409, 'slug 已存在'));
      }
      throw e;
    }
  });

  // DELETE /docs/:id - 删除文档
  server.delete('/docs/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findDocById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '文档不存在'));
    }
    await deleteDoc(parsed.data.id);
    return reply.send(success({ ok: true }));
  });
};
