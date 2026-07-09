import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  findCircles,
  findCircleByIdOrSlug,
  findCirclePosts,
  findPostById,
  createPost,
  updatePost,
  deletePost,
  findAsks,
  findAskById,
  createAsk,
  updateAsk,
  deleteAsk,
  findAskAnswers,
  createAnswer,
  acceptAnswer,
} from '../db/community-queries.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

// =============================================================================
// Zod schemas
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

const listCirclesQuery = z.object({
  ...paginationQuery,
  search: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
});

const listCirclePostsQuery = z.object(paginationQuery);

const listAsksQuery = z.object({
  ...paginationQuery,
  search: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  resolved: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
});

const listAskAnswersQuery = z.object(paginationQuery);

// 圈子 id 支持 UUID 或 slug
const circleIdParamSchema = z.object({
  id: z.string().min(1).max(120, '无效的 ID'),
});

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') });

const createPostSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长'),
  content: z.string().min(1, '内容不能为空').max(50000, '内容过长'),
  images: z.array(z.string().max(512)).max(20).optional().nullable(),
});

const updatePostSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长').optional(),
  content: z.string().min(1, '内容不能为空').max(50000, '内容过长').optional(),
  images: z.array(z.string().max(512)).max(20).optional().nullable(),
});

const createAskSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长'),
  content: z.string().min(1, '内容不能为空').max(50000, '内容过长'),
  tags: z.array(z.string().max(64)).max(20).optional().nullable(),
});

const updateAskSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题过长').optional(),
  content: z.string().min(1, '内容不能为空').max(50000, '内容过长').optional(),
  tags: z.array(z.string().max(64)).max(20).optional().nullable(),
});

const createAnswerSchema = z.object({
  content: z.string().min(1, '内容不能为空').max(20000, '内容过长'),
});

// =============================================================================
// 路由
// =============================================================================

export const communityRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有 circles / asks 路由均需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      const message = (e as Error).message || 'Authentication required';
      return reply.status(statusCode).send(error(statusCode, message));
    }
  });

  // ===== Circles =====

  // GET /circles - 圈子列表(?page&pageSize&search)
  server.get('/circles', {
    schema: {
      summary: '圈子列表',
      tags: ['community'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: '每页数量(1-100,默认 20)' },
          search: { type: 'string', description: '名称/描述模糊搜索(可选)' },
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
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = listCirclesQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, search } = parsed.data;
    const { list, total } = await findCircles({ page, pageSize, search });
    return reply.send(success({ list, total, page, pageSize }));
  });

  // GET /circles/:id - 圈子详情(支持 UUID 或 slug)
  server.get('/circles/:id', {
    schema: {
      summary: '圈子详情',
      tags: ['community'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', description: '圈子 ID 或 slug' } },
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
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = circleIdParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const circle = await findCircleByIdOrSlug(parsed.data.id);
    if (!circle) {
      return reply.status(404).send(error(404, '圈子不存在'));
    }
    return reply.send(success({ circle }));
  });

  // GET /circles/:id/posts - 圈子帖子列表
  server.get('/circles/:id/posts', {
    schema: {
      summary: '圈子帖子列表',
      tags: ['community'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: '每页数量(1-100,默认 20)' },
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
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsedP = circleIdParamSchema.safeParse(request.params);
    if (!parsedP.success) {
      return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'));
    }
    const parsedQ = listCirclePostsQuery.safeParse(request.query);
    if (!parsedQ.success) {
      return reply.status(400).send(error(400, parsedQ.error.issues[0]?.message ?? '参数错误'));
    }
    const circle = await findCircleByIdOrSlug(parsedP.data.id);
    if (!circle) {
      return reply.status(404).send(error(404, '圈子不存在'));
    }
    const { page, pageSize } = parsedQ.data;
    const { list, total } = await findCirclePosts(circle.id, { page, pageSize });
    return reply.send(success({ list, total, page, pageSize }));
  });

  // POST /circles/:id/posts - 发帖
  server.post('/circles/:id/posts', {
    schema: {
      summary: '在圈子发帖',
      tags: ['community'],
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '帖子标题' },
          content: { type: 'string', description: '帖子内容' },
          images: { type: 'array', items: { type: 'string' }, description: '图片 URL 数组(可选)' },
        },
      },
      response: {
        201: {
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
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsedP = circleIdParamSchema.safeParse(request.params);
    if (!parsedP.success) {
      return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'));
    }
    const body = createPostSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'));
    }
    const circle = await findCircleByIdOrSlug(parsedP.data.id);
    if (!circle) {
      return reply.status(404).send(error(404, '圈子不存在'));
    }
    const post = await createPost(circle.id, request.userId!, body.data);
    return reply.status(201).send(success({ post }));
  });

  // GET /circles/posts/:id - 帖子详情
  server.get('/circles/posts/:id', {
    schema: {
      summary: '帖子详情',
      tags: ['community'],
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
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const post = await findPostById(parsed.data.id);
    if (!post) {
      return reply.status(404).send(error(404, '帖子不存在'));
    }
    return reply.send(success({ post }));
  });

  // PATCH /circles/posts/:id - 编辑帖子(仅本人)
  server.patch('/circles/posts/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const body = updatePostSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findPostById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '帖子不存在'));
    }
    if (existing.userId !== request.userId) {
      return reply.status(403).send(error(403, '只能编辑自己的帖子'));
    }
    const updated = await updatePost(parsed.data.id, request.userId!, body.data);
    return reply.send(success({ post: updated }));
  });

  // DELETE /circles/posts/:id - 删除帖子(仅本人)
  server.delete('/circles/posts/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findPostById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '帖子不存在'));
    }
    if (existing.userId !== request.userId) {
      return reply.status(403).send(error(403, '只能删除自己的帖子'));
    }
    await deletePost(parsed.data.id, request.userId!);
    return reply.send(success({ id: parsed.data.id, deleted: true }));
  });

  // ===== Asks =====

  // GET /asks - 问答列表(?page&pageSize&search&resolved)
  server.get('/asks', {
    schema: {
      summary: '问答列表',
      tags: ['community'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: '每页数量(1-100,默认 20)' },
          search: { type: 'string', description: '标题/内容模糊搜索(可选)' },
          resolved: { type: 'boolean', description: '是否已解决筛选(可选)' },
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
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = listAsksQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, search, resolved } = parsed.data;
    const { list, total } = await findAsks({ page, pageSize, search, resolved });
    return reply.send(success({ list, total, page, pageSize }));
  });

  // GET /asks/:id - 问答详情
  server.get('/asks/:id', {
    schema: {
      summary: '问答详情',
      tags: ['community'],
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
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const ask = await findAskById(parsed.data.id);
    if (!ask) {
      return reply.status(404).send(error(404, '问答不存在'));
    }
    return reply.send(success({ ask }));
  });

  // POST /asks - 提问
  server.post('/asks', {
    schema: {
      summary: '创建问答',
      tags: ['community'],
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '问题标题' },
          content: { type: 'string', description: '问题内容' },
          tags: { type: 'array', items: { type: 'string' }, description: '标签数组(可选)' },
        },
      },
      response: {
        201: {
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
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const body = createAskSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'));
    }
    const ask = await createAsk(request.userId!, body.data);
    return reply.status(201).send(success({ ask }));
  });

  // PATCH /asks/:id - 编辑问题(仅本人)
  server.patch('/asks/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const body = updateAskSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findAskById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '问答不存在'));
    }
    if (existing.userId !== request.userId) {
      return reply.status(403).send(error(403, '只能编辑自己的问题'));
    }
    const updated = await updateAsk(parsed.data.id, request.userId!, body.data);
    return reply.send(success({ ask: updated }));
  });

  // DELETE /asks/:id - 删除问题(仅本人)
  server.delete('/asks/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findAskById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '问答不存在'));
    }
    if (existing.userId !== request.userId) {
      return reply.status(403).send(error(403, '只能删除自己的问题'));
    }
    await deleteAsk(parsed.data.id, request.userId!);
    return reply.send(success({ id: parsed.data.id, deleted: true }));
  });

  // GET /asks/:id/answers - 回答列表
  server.get('/asks/:id/answers', {
    schema: {
      summary: '问答回答列表',
      tags: ['community'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: '每页数量(1-100,默认 20)' },
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
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsedP = uuidParamSchema.safeParse(request.params);
    if (!parsedP.success) {
      return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'));
    }
    const parsedQ = listAskAnswersQuery.safeParse(request.query);
    if (!parsedQ.success) {
      return reply.status(400).send(error(400, parsedQ.error.issues[0]?.message ?? '参数错误'));
    }
    const ask = await findAskById(parsedP.data.id);
    if (!ask) {
      return reply.status(404).send(error(404, '问答不存在'));
    }
    const { page, pageSize } = parsedQ.data;
    const { list, total } = await findAskAnswers(ask.id, { page, pageSize });
    return reply.send(success({ list, total, page, pageSize }));
  });

  // POST /asks/:id/answers - 回答
  server.post('/asks/:id/answers', {
    schema: {
      summary: '创建回答',
      tags: ['community'],
      body: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '回答内容' },
        },
      },
      response: {
        201: {
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
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsedP = uuidParamSchema.safeParse(request.params);
    if (!parsedP.success) {
      return reply.status(400).send(error(400, parsedP.error.issues[0]?.message ?? '参数错误'));
    }
    const body = createAnswerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'));
    }
    const ask = await findAskById(parsedP.data.id);
    if (!ask) {
      return reply.status(404).send(error(404, '问答不存在'));
    }
    const answer = await createAnswer(ask.id, request.userId!, body.data.content);
    return reply.status(201).send(success({ answer }));
  });

  // POST /asks/answers/:id/accept - 采纳答案(仅提问者)
  server.post('/asks/answers/:id/accept', {
    schema: {
      summary: '采纳答案',
      tags: ['community'],
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
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        403: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        404: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const accepted = await acceptAnswer(parsed.data.id, request.userId!);
    if (!accepted) {
      // 答案不存在或当前用户不是提问者，统一返回 404 避免泄露存在性
      return reply.status(404).send(error(404, '答案不存在或无权采纳'));
    }
    return reply.send(success({ answer: accepted }));
  });
};
