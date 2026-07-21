import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { checkAuth } from '../plugins/auth.js';
import {
  followUser,
  unfollowUser,
  findFollowing,
  findFollowers,
  isFollowing,
  isMutualFollowing,
  countFollowing,
  countFollowers,
  countFavorites,
  addFavorite,
  removeFavorite,
  findFavorites,
  isFavorited,
  subscribe,
  unsubscribe,
  findSubscriptions,
  createTag,
  findTags,
  findTagBySlug,
  findTagById,
  updateTag,
  deleteTag,
  attachTag,
  detachTag,
  findTagResources,
} from '../db/social-queries.js';
import { createNotification } from '../db/notification-queries.js';
import { findUserById } from '../db/queries.js';
import { queueNotificationEmail } from '../services/email-service.js';
import { success, error, emptyToUndefined } from '../utils/response.js';

const FAVORITE_RESOURCE_TYPES = ['project', 'file', 'doc', 'post', 'comment'] as const;
const TAG_RESOURCE_TYPES = ['project', 'file', 'doc', 'post', 'comment'] as const;
const TARGET_TYPES = ['user', 'project', 'tag', 'category'] as const;

// =============================================================================
// Zod schemas
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

const paginationOnlyQuery = z.object(paginationQuery);

const userIdParam = z.object({ userId: z.string().uuid('无效的用户 ID') });
const tagIdParam = z.object({ id: z.string().uuid('无效的标签 ID') });
const slugParam = z.object({ slug: z.string().min(1).max(96) });

const favoriteBody = z.object({
  resourceType: z.enum(FAVORITE_RESOURCE_TYPES),
  resourceId: z.string().min(1).max(128),
});

const favoriteResourceParam = z.object({
  resourceType: z.enum(FAVORITE_RESOURCE_TYPES),
  resourceId: z.string().min(1).max(128),
});

const subscriptionBody = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().min(1).max(128),
});

const subscriptionTargetParam = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().min(1).max(128),
});

const favoritesListQuery = z.object({
  ...paginationQuery,
  resourceType: z.preprocess(emptyToUndefined, z.enum(FAVORITE_RESOURCE_TYPES).optional()),
});

const subscriptionsListQuery = z.object({
  ...paginationQuery,
  targetType: z.preprocess(emptyToUndefined, z.enum(TARGET_TYPES).optional()),
});

const createTagBody = z.object({
  name: z.string().min(1, '标签名不能为空').max(64, '标签名最多 64 字符'),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, '无效的 hex 颜色')
    .optional(),
});

const updateTagBody = z.object({
  name: z.string().min(1, '标签名不能为空').max(64, '标签名最多 64 字符').optional(),
  description: z.string().max(500).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, '无效的 hex 颜色')
    .nullable()
    .optional(),
});

const attachBody = z.object({
  resourceType: z.enum(TAG_RESOURCE_TYPES),
  resourceId: z.string().min(1).max(128),
});

const attachResourceParam = z.object({
  id: z.string().uuid('无效的标签 ID'),
  resourceType: z.enum(TAG_RESOURCE_TYPES),
  resourceId: z.string().min(1).max(128),
});

// =============================================================================
// 路由
// =============================================================================

export const socialRoutes: FastifyPluginAsync = async (server) => {
  // ===== Follows =====

  // POST /follows/:userId - 关注用户（幂等）
  server.post(
    '/follows/:userId',
    {
      schema: {
        summary: '关注用户',
        description: '关注指定用户(幂等),关注成功后检查互关并发送通知',
        tags: ['social'],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid', description: '目标用户 ID' },
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
          409: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = userIdParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    try {
      await followUser(request.userId!, parsed.data.userId);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 400;
      return reply.status(statusCode as 201 | 400 | 401 | 404 | 409).send(error(statusCode, (e as Error).message ?? '关注失败'));
    }
    // 关注成功后，检查互关并发送通知
    const isMutual = await isMutualFollowing(request.userId!, parsed.data.userId);
    try {
      const notification = await createNotification({
        userId: parsed.data.userId,
        type: 'follow',
        title: '新的关注者',
        content: '用户关注了你',
        data: { followerId: request.userId!, isMutual },
      });
      // WebSocket 实时推送（若用户在线）
      server.pushNotification(parsed.data.userId, notification);
    } catch (e) {
      request.log.warn({ err: e }, '关注通知创建失败');
      // 通知创建失败不阻塞关注
    }
    // 可选：发送邮件通知（通过 BullMQ 异步队列，不阻塞请求）
    // 队列不可用时自动降级为同步发送（queueNotificationEmail 内部处理）
    setImmediate(async () => {
      try {
        const followedUser = await findUserById(parsed.data.userId);
        if (followedUser?.email) {
          const followerUser = await findUserById(request.userId!);
          await queueNotificationEmail(
            server,
            followedUser.email,
            followedUser.nickname ?? followedUser.email,
            'follow',
            { followerName: followerUser?.nickname, isMutual },
          );
        }
      } catch (e) {
        request.log.warn({ err: e }, '关注邮件入队失败');
        // 邮件入队失败不阻塞
      }
    });
    return reply.status(201).send(success({ followed: true, isMutual }));
    },
  );

  // DELETE /follows/:userId - 取消关注
  server.delete(
    '/follows/:userId',
    {
      schema: {
        summary: '取消关注用户',
        description: '取消关注指定用户',
        tags: ['social'],
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', format: 'uuid', description: '目标用户 ID' },
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
    },
    async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = userIdParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    await unfollowUser(request.userId!, parsed.data.userId);
    return reply.send(success({ followed: false }));
    },
  );

  // GET /follows/following - 我关注的用户列表（分页）
  server.get('/follows/following', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = paginationOnlyQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { list, total } = await findFollowing({
      userId: request.userId!,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
    return reply.send(success({ list, total, page: parsed.data.page, pageSize: parsed.data.pageSize }));
  });

  // GET /follows/followers - 关注我的用户列表（分页）
  server.get('/follows/followers', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = paginationOnlyQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { list, total } = await findFollowers({
      userId: request.userId!,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });
    return reply.send(success({ list, total, page: parsed.data.page, pageSize: parsed.data.pageSize }));
  });

  // GET /follows/:userId/status - 关注状态
  server.get('/follows/:userId/status', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = userIdParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const following = await isFollowing(request.userId!, parsed.data.userId);
    return reply.send(success({ following }));
  });

  // GET /follows/mutual/:userId - 检测当前用户与指定用户是否互关
  server.get('/follows/mutual/:userId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = userIdParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const isMutual = await isMutualFollowing(request.userId!, parsed.data.userId);
    return reply.send(success({ isMutual }));
  });

  // GET /follows/:userId/stats - 指定用户的关注/粉丝/收藏计数(公开,登录可查任意用户)
  server.get('/follows/:userId/stats', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = userIdParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const targetId = parsed.data.userId;
    const [followingCount, followersCount, favoritesCount] = await Promise.all([
      countFollowing(targetId),
      countFollowers(targetId),
      countFavorites(targetId),
    ]);
    return reply.send(success({ followingCount, followersCount, favoritesCount }));
  });

  // ===== Favorites =====

  // POST /favorites - 收藏资源（幂等）
  server.post(
    '/favorites',
    {
      schema: {
        summary: '收藏资源',
        description: '收藏指定资源(幂等)',
        tags: ['social'],
        body: {
          type: 'object',
          required: ['resourceType', 'resourceId'],
          properties: {
            resourceType: {
              type: 'string',
              enum: ['project', 'file', 'doc', 'post', 'comment'],
              description: '资源类型',
            },
            resourceId: { type: 'string', maxLength: 128, description: '资源 ID' },
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
    },
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return;
      const parsed = favoriteBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      await addFavorite({
        userId: request.userId!,
        resourceType: parsed.data.resourceType,
        resourceId: parsed.data.resourceId,
      });
      return reply.status(201).send(success({ favorited: true }));
    },
  );

  // DELETE /favorites/:resourceType/:resourceId - 取消收藏
  server.delete('/favorites/:resourceType/:resourceId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = favoriteResourceParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    await removeFavorite({
      userId: request.userId!,
      resourceType: parsed.data.resourceType,
      resourceId: parsed.data.resourceId,
    });
    return reply.send(success({ favorited: false }));
  });

  // GET /favorites - 我的收藏列表（分页，支持 resourceType 筛选）
  server.get(
    '/favorites',
    {
      schema: {
        summary: '我的收藏列表',
        description: '分页查询当前用户收藏列表,支持 resourceType 筛选',
        tags: ['social'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1, description: '页码(默认 1)' },
            pageSize: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: '每页数量(1-100,默认 20)',
            },
            resourceType: {
              type: 'string',
              enum: ['project', 'file', 'doc', 'post', 'comment'],
              description: '资源类型筛选(可选)',
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
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      if (!(await checkAuth(request, reply))) return;
      const parsed = favoritesListQuery.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { list, total } = await findFavorites({
        userId: request.userId!,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        resourceType: parsed.data.resourceType,
      });
      return reply.send(success({ list, total, page: parsed.data.page, pageSize: parsed.data.pageSize }));
    },
  );

  // GET /favorites/check/:resourceType/:resourceId - 检查是否已收藏
  server.get('/favorites/check/:resourceType/:resourceId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = favoriteResourceParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const favorited = await isFavorited({
      userId: request.userId!,
      resourceType: parsed.data.resourceType,
      resourceId: parsed.data.resourceId,
    });
    return reply.send(success({ favorited }));
  });

  // ===== Subscriptions =====

  // POST /subscriptions - 订阅（幂等）
  server.post('/subscriptions', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = subscriptionBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    await subscribe({
      userId: request.userId!,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
    });
    return reply.status(201).send(success({ subscribed: true }));
  });

  // DELETE /subscriptions/:targetType/:targetId - 取消订阅
  server.delete('/subscriptions/:targetType/:targetId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = subscriptionTargetParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    await unsubscribe({
      userId: request.userId!,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
    });
    return reply.send(success({ subscribed: false }));
  });

  // GET /subscriptions - 我的订阅列表（分页，支持 targetType 筛选）
  server.get('/subscriptions', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = subscriptionsListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { list, total } = await findSubscriptions({
      userId: request.userId!,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      targetType: parsed.data.targetType,
    });
    return reply.send(success({ list, total, page: parsed.data.page, pageSize: parsed.data.pageSize }));
  });

  // ===== Tags =====

  // GET /tags - 标签列表（公开，按 usage_count 倒序）
  server.get('/tags', async (_request, reply) => {
    const list = await findTags();
    return reply.send(success({ tags: list }));
  });

  // GET /tags/:slug - 标签详情（公开）
  server.get('/tags/:slug', async (request, reply) => {
    const parsed = slugParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const tag = await findTagBySlug(parsed.data.slug);
    if (!tag) {
      return reply.status(404).send(error(404, '标签不存在'));
    }
    return reply.send(success({ tag }));
  });

  // POST /tags - 创建标签（需登录）
  server.post('/tags', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = createTagBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    let tag;
    try {
      tag = await createTag({
        name: parsed.data.name,
        description: parsed.data.description,
        color: parsed.data.color,
        createdBy: request.userId!,
      });
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
        return reply.status(409).send(error(409, '标签名或 slug 已存在'));
      }
      request.log.error({ err: e }, '创建标签失败');
      return reply.status(500).send(error(500, '创建标签失败'));
    }
    return reply.status(201).send(success({ tag }));
  });

  // PATCH /tags/:id - 更新标签（需登录）
  server.patch('/tags/:id', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = tagIdParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const body = updateTagBody.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'));
    }
    const existing = await findTagById(parsed.data.id);
    if (!existing) {
      return reply.status(404).send(error(404, '标签不存在'));
    }
    let tag;
    try {
      tag = await updateTag(parsed.data.id, body.data);
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
        return reply.status(409).send(error(409, '标签名或 slug 已存在'));
      }
      request.log.error({ err: e }, '更新标签失败');
      return reply.status(500).send(error(500, '更新标签失败'));
    }
    return reply.send(success({ tag }));
  });

  // DELETE /tags/:id - 删除标签（需登录,级联删除关联）
  server.delete('/tags/:id', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = tagIdParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const tag = await deleteTag(parsed.data.id);
    if (!tag) {
      return reply.status(404).send(error(404, '标签不存在'));
    }
    return reply.send(success({ tag }));
  });

  // POST /tags/:id/attach - 关联标签到资源（幂等）
  server.post('/tags/:id/attach', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = tagIdParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const body = attachBody.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'));
    }
    const tag = await findTagById(parsed.data.id);
    if (!tag) {
      return reply.status(404).send(error(404, '标签不存在'));
    }
    const attached = await attachTag({
      tagId: parsed.data.id,
      resourceType: body.data.resourceType,
      resourceId: body.data.resourceId,
      createdBy: request.userId!,
    });
    return reply.send(success({ attached }));
  });

  // DELETE /tags/:id/attach/:resourceType/:resourceId - 移除标签关联
  server.delete('/tags/:id/attach/:resourceType/:resourceId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return;
    const parsed = attachResourceParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const detached = await detachTag({
      tagId: parsed.data.id,
      resourceType: parsed.data.resourceType,
      resourceId: parsed.data.resourceId,
    });
    return reply.send(success({ detached }));
  });

  // GET /tags/:id/resources - 标签下的资源列表（公开，分页）
  server.get('/tags/:id/resources', async (request, reply) => {
    const parsed = tagIdParam.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const parsedQ = paginationOnlyQuery.safeParse(request.query);
    if (!parsedQ.success) {
      return reply.status(400).send(error(400, parsedQ.error.issues[0]?.message ?? '参数错误'));
    }
    const tag = await findTagById(parsed.data.id);
    if (!tag) {
      return reply.status(404).send(error(404, '标签不存在'));
    }
    const { list, total } = await findTagResources({
      tagId: parsed.data.id,
      page: parsedQ.data.page,
      pageSize: parsedQ.data.pageSize,
    });
    return reply.send(success({ list, total, page: parsedQ.data.page, pageSize: parsedQ.data.pageSize }));
  });
};
