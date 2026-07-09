import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  findPublishedNewsCategories,
  findAllNewsCategories,
  findNewsCategoryById,
  createNewsCategory,
  updateNewsCategory,
  deleteNewsCategory,
  findPublishedArticles,
  findAllArticles,
  findArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  incrementArticleViewCount,
} from '../db/news-queries.js';
import { success, error } from '../utils/response.js';

const ADMIN_ROLE_ID = 1;

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

const articlesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : v),
      z.string().uuid('无效的分类 ID'),
    )
    .optional(),
  search: z.string().max(200).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
});

const createArticleSchema = z.object({
  title: z.string().min(1).max(200),
  categoryId: z.string().uuid().nullable().optional(),
  summary: z.string().max(500).nullable().optional(),
  content: z.string().min(1),
  coverImage: z.string().max(512).nullable().optional(),
  authorName: z.string().max(100).nullable().optional(),
  isPublished: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
});

const updateArticleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  summary: z.string().max(500).nullable().optional(),
  content: z.string().min(1).optional(),
  coverImage: z.string().max(512).nullable().optional(),
  authorName: z.string().max(100).nullable().optional(),
  isPublished: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
});

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
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

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
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
// 公共路由（前缀 /api，需登录）
// =============================================================================

export const newsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return;
  });

  // GET /news/categories - 启用的分类列表
  server.get('/news/categories', async (_request, reply) => {
    const list = await findPublishedNewsCategories();
    return reply.send(success({ list }));
  });

  // GET /news/articles - 已发布资讯列表
  server.get('/news/articles', async (request, reply) => {
    const parsed = articlesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findPublishedArticles(parsed.data);
    return reply.send(success(result));
  });

  // GET /news/articles/:id - 资讯详情
  server.get('/news/articles/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const article = await findArticleById(parsed.data.id);
    if (!article || !article.isPublished) {
      return reply.status(404).send(error(404, '资讯不存在'));
    }
    await incrementArticleViewCount(parsed.data.id);
    return reply.send(success({ article }));
  });
};

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminNewsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return;
  });

  // ----- Categories Admin -----

  server.get('/news/categories', async (_request, reply) => {
    const list = await findAllNewsCategories();
    return reply.send(success({ list }));
  });

  server.post('/news/categories', async (request, reply) => {
    const parsed = createCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const category = await createNewsCategory(parsed.data);
    return reply.status(201).send(success({ category }));
  });

  server.put('/news/categories/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findNewsCategoryById(idParsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '分类不存在'));
    const category = await updateNewsCategory(idParsed.data.id, parsed.data);
    return reply.send(success({ category }));
  });

  server.delete('/news/categories/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findNewsCategoryById(parsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '分类不存在'));
    await deleteNewsCategory(parsed.data.id);
    return reply.send(success({ ok: true }));
  });

  // ----- Articles Admin -----

  server.get('/news/articles', async (request, reply) => {
    const parsed = articlesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const result = await findAllArticles(parsed.data);
    return reply.send(success(result));
  });

  server.get('/news/articles/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const article = await findArticleById(parsed.data.id);
    if (!article) return reply.status(404).send(error(404, '资讯不存在'));
    return reply.send(success({ article }));
  });

  server.post('/news/articles', async (request, reply) => {
    const parsed = createArticleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const article = await createArticle({
      ...parsed.data,
      authorId: request.userId,
    });
    return reply.status(201).send(success({ article }));
  });

  server.put('/news/articles/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params);
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsed = updateArticleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findArticleById(idParsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '资讯不存在'));
    const article = await updateArticle(idParsed.data.id, parsed.data);
    return reply.send(success({ article }));
  });

  server.delete('/news/articles/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findArticleById(parsed.data.id);
    if (!existing) return reply.status(404).send(error(404, '资讯不存在'));
    await deleteArticle(parsed.data.id);
    return reply.send(success({ ok: true }));
  });
};
