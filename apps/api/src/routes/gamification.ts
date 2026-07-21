import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import {
  ensureUserPoints,
  findPointTransactions,
  findLeaderboard,
  findTodaySignIn,
  findSignInRecord,
  findSignInHistory,
  findRecentSignInRecords,
  calculateConsecutiveDays,
  createSignInRecord,
  findLevels,
  findCurrentLevel,
} from '../db/gamification-queries.js';
import { earnPoints, spendPoints } from '../services/points-service.js';
import { success, error, emptyToUndefined } from '../utils/response.js';
import { calcSignInReward, todayString, shiftDate } from '../utils/checkin-helpers.js';

const ADMIN_ROLE_ID = 1;
const TX_TYPE = ['earn', 'spend'] as const;

// =============================================================================
// Zod schemas
// =============================================================================

const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.preprocess(emptyToUndefined, z.enum(TX_TYPE).optional()),
  source: z.preprocess(emptyToUndefined, z.string().max(32).optional()),
});

const adjustPointsSchema = z.object({
  userId: z.string().uuid('无效的用户 ID'),
  amount: z.number().int().refine((v) => v !== 0, '调整积分数不能为 0'),
  description: z.string().max(255).optional(),
});

const signInHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  yearMonth: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^\d{4}-\d{2}$/, 'yearMonth 格式应为 YYYY-MM').optional(),
  ),
});

// =============================================================================
// 路由（前缀 /api，所有端点需登录）
// =============================================================================

export const gamificationRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有端点需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      const message = (e as Error).message || 'Authentication required';
      return reply.status(statusCode).send(error(statusCode, message));
    }
  });

  // GET /points - 当前用户积分信息
  server.get('/points', {
    schema: {
      summary: '获取积分余额',
      tags: ['gamification'],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.userId!;
    const points = await ensureUserPoints(userId);
    return reply.send(success({ points }));
  });

  // GET /points/transactions - 积分流水（分页 + type/source 筛选）
  server.get('/points/transactions', {
    schema: {
      summary: '获取积分流水',
      tags: ['gamification'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          type: { type: 'string', enum: ['earn', 'spend'] },
          source: { type: 'string', maxLength: 32 },
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
    const userId = request.userId!;
    const parsed = listTransactionsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, type, source } = parsed.data;
    const { list, total } = await findPointTransactions({ userId, page, pageSize, type, source });
    return reply.send(success({ list, total, page, pageSize }));
  });

  // POST /points/admin/adjust - 管理员调整用户积分（正数 earn / 负数 spend）
  server.post('/points/admin/adjust', async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0;
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'));
    }
    const parsed = adjustPointsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { userId, amount, description } = parsed.data;
    try {
      const result =
        amount > 0
          ? await earnPoints(userId, amount, 'admin', description)
          : await spendPoints(userId, Math.abs(amount), 'admin', description);
      return reply.send(success(result));
    } catch (e) {
      const msg = (e as Error).message;
      const code = msg.includes('余额不足') ? 400 : 500;
      return reply.status(code).send(error(code, msg));
    }
  });

  // GET /leaderboard - 积分排行榜（前 100，含用户信息）
  server.get('/leaderboard', async (_request, reply) => {
    const list = await findLeaderboard(100);
    return reply.send(success({ list }));
  });

  // POST /sign-in - 签到（检查今日是否已签到、计算连续天数、发放奖励、记录流水）
  server.post('/sign-in', {
    schema: {
      summary: '每日签到',
      tags: ['gamification'],
      response: {
        201: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
        409: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.userId!;
    const today = todayString();
    const existing = await findTodaySignIn(userId, today);
    if (existing) {
      return reply.status(409).send(error(409, '今日已签到'));
    }
    const consecutiveDays = await calculateConsecutiveDays(userId, today);
    const rewardPoints = calcSignInReward(consecutiveDays);
    const record = await createSignInRecord({
      userId,
      signInDate: today,
      consecutiveDays,
      rewardPoints,
    });
    const earned = await earnPoints(userId, rewardPoints, 'signin', '每日签到奖励', record.id);
    return reply.status(201).send(success({ record, points: earned.points }));
  });

  // GET /sign-in/today - 今日签到状态
  server.get('/sign-in/today', {
    schema: {
      summary: '今日签到状态',
      tags: ['gamification'],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.userId!;
    const today = todayString();
    const record = await findTodaySignIn(userId, today);
    const signedIn = !!record;

    // 连续天数：已签到取 record，否则查昨日记录判断当前连续
    let consecutiveDays = 0;
    if (record) {
      consecutiveDays = record.consecutiveDays;
    } else {
      const yesterday = shiftDate(today, -1);
      const yesterdayRecord = await findSignInRecord(userId, yesterday);
      consecutiveDays = yesterdayRecord?.consecutiveDays ?? 0;
    }

    // 今日奖励：已签到取 record.rewardPoints，否则按签到后连续天数预计算
    const todayReward = signedIn
      ? record!.rewardPoints
      : calcSignInReward(consecutiveDays + 1);

    // 周历：最近 7 天（今天往前 6 天 ~ 今天）
    const weekStart = shiftDate(today, -6);
    const weekEnd = shiftDate(today, 1); // 不含明天
    const recentRecords = await findRecentSignInRecords(userId, weekStart, weekEnd);
    const recordMap = new Map(recentRecords.map((r) => [r.signInDate, r]));
    const week = Array.from({ length: 7 }, (_, i) => {
      const date = shiftDate(weekStart, i);
      const r = recordMap.get(date);
      const d = new Date(date + 'T00:00:00Z');
      return {
        date,
        day: d.getUTCDay(),
        reward: r?.rewardPoints ?? calcSignInReward((consecutiveDays - (6 - i)) > 0 ? (consecutiveDays - (6 - i)) : 1),
        signed: !!r,
      };
    });

    return reply.send(success({ signedIn, consecutiveDays, todayReward, week, record }));
  });

  // GET /sign-in/history - 签到历史（分页，按月查询）
  server.get('/sign-in/history', async (request, reply) => {
    const userId = request.userId!;
    const parsed = signInHistoryQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { page, pageSize, yearMonth } = parsed.data;
    const { list, total } = await findSignInHistory({ userId, page, pageSize, yearMonth });
    return reply.send(success({ list, total, page, pageSize }));
  });

  // GET /levels - 所有等级定义
  server.get('/levels', {
    schema: {
      summary: '获取所有等级定义',
      tags: ['gamification'],
      response: {
        200: {
          type: 'object',
          properties: {
            code: { type: 'number' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        401: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (_request, reply) => {
    const list = await findLevels();
    return reply.send(success({ list }));
  });

  // GET /levels/current - 当前用户等级信息 + 下一等级进度
  server.get('/levels/current', async (request, reply) => {
    const userId = request.userId!;
    const points = await ensureUserPoints(userId);
    const info = await findCurrentLevel(points.experience);
    return reply.send(success({ ...info, points }));
  });
};
