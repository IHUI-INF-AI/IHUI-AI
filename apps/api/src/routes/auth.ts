import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import {
  verifyRefreshToken,
  createFamilyId,
  type JWTPayload,
} from '@ihui/auth';
import { authenticate } from '../plugins/auth.js';
import { issueTokenPair } from '../services/token-service.js';
import {
  findUserByPhone,
  findUserByAccount,
  findUserById,
  createUser,
  updateUser,
  findRefreshToken,
  revokeRefreshToken,
} from '../db/queries.js';
import { findInvitationByCode, markInvitationUsed } from '../db/promotion-queries.js';
import { earnPoints } from '../services/points-service.js';
import { success, error } from '../utils/response.js';
import {
  codeStore,
  CODE_TTL_MS,
  CODE_RESEND_INTERVAL_MS,
  generateCode,
  cleanupExpiredCodes,
} from '../utils/code-store.js';

// =============================================================================
// Zod schemas
// =============================================================================

const registerSchema = z.object({
  phone: z.string().length(11, '手机号必须为 11 位'),
  password: z.string().min(6, '密码至少 6 位').max(72, '密码最多 72 位'),
  code: z.string().optional(),
  invitationCode: z.string().optional(),
});

const loginSchema = z.object({
  account: z.string().min(1, '账号不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken 不能为空'),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken 不能为空'),
});

const sendCodeSchema = z.object({
  phone: z.string().length(11, '手机号必须为 11 位').regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  scene: z.enum(['register', 'login', 'reset', 'phone-binding']).optional().default('register'),
});

const resetPasswordSchema = z.object({
  phone: z.string().length(11, '手机号必须为 11 位').regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  code: z.string().length(6, '验证码必须为 6 位'),
  newPassword: z.string().min(8, '密码至少 8 位').max(72, '密码最多 72 位'),
});

// =============================================================================
// Token 签发辅助
// =============================================================================

const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30d

async function buildTokenPair(user: {
  id: string;
  phone: string | null;
  roleId: number | null;
  familyId: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}> {
  const payload: JWTPayload = {
    userId: user.id,
    phone: user.phone ?? '',
    familyId: user.familyId,
    roleId: user.roleId ?? 0,
  };

  const tokens = await issueTokenPair(payload);

  return {
    ...tokens,
    refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
  };
}

function publicUser(user: {
  id: string;
  phone: string | null;
  email: string | null;
  nickname: string | null;
  avatar: string | null;
  bio: string | null;
  roleId: number | null;
  status: number | null;
}) {
  return {
    id: user.id,
    phone: user.phone ?? '',
    email: user.email ?? '',
    nickname: user.nickname ?? '',
    avatar: user.avatar ?? '',
    bio: user.bio ?? '',
    roleId: user.roleId ?? 0,
    status: user.status ?? 1,
  };
}

// =============================================================================
// 路由
// =============================================================================

export const authRoutes: FastifyPluginAsync = async (server) => {
  // POST /api/auth/send-code - 发送手机验证码
  server.post(
    '/send-code',
    {
      schema: {
        summary: '发送手机验证码',
        description: '向指定手机号发送 6 位数字验证码(5 分钟有效,60 秒内不可重发)',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone: { type: 'string', description: '手机号(11 位)' },
            scene: { type: 'string', enum: ['register', 'login', 'reset', 'phone-binding'], description: '场景' },
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
          400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
          429: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
        },
      },
      config: {
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const parsed = sendCodeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { phone } = parsed.data;

      cleanupExpiredCodes();
      const existing = codeStore.get(phone);
      const now = Date.now();
      if (existing && now - existing.sentAt < CODE_RESEND_INTERVAL_MS) {
        return reply.status(429).send(error(429, '验证码已发送,请 60 秒后重试'));
      }

      const code = generateCode();
      codeStore.set(phone, { code, expiresAt: now + CODE_TTL_MS, sentAt: now });

      // 生产环境应接入短信服务商;当前开发模式记录日志
      request.log.info({ phone, scene: parsed.data.scene }, '验证码已生成');

      // 开发模式(NODE_ENV !== production)返回验证码便于测试
      const isDev = process.env.NODE_ENV !== 'production';
      return reply.send(success(isDev ? { sent: true, code, expiresIn: CODE_TTL_MS / 1000 } : { sent: true, expiresIn: CODE_TTL_MS / 1000 }));
    },
  );

  // POST /api/auth/reset-password - 通过手机验证码重置密码
  server.post(
    '/reset-password',
    {
      schema: {
        summary: '重置密码',
        description: '通过手机号 + 验证码重置登录密码',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['phone', 'code', 'newPassword'],
          properties: {
            phone: { type: 'string', description: '手机号(11 位)' },
            code: { type: 'string', description: '验证码(6 位)' },
            newPassword: { type: 'string', description: '新密码(>=8 位,<=72 位)' },
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
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const parsed = resetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { phone, code, newPassword } = parsed.data;

      // 校验验证码
      cleanupExpiredCodes();
      const entry = codeStore.get(phone);
      if (!entry || entry.code !== code || entry.expiresAt < Date.now()) {
        return reply.status(400).send(error(400, '验证码错误或已过期'));
      }

      // 查找用户
      const user = await findUserByPhone(phone);
      if (!user) {
        return reply.status(404).send(error(404, '用户不存在'));
      }

      // 更新密码
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await updateUser(user.id, { passwordHash });

      // 删除已使用的验证码
      codeStore.delete(phone);

      return reply.send(success({ reset: true }));
    },
  );

  // POST /api/auth/register
  server.post(
    '/register',
    {
      schema: {
        summary: '用户注册',
        description: '手机号 + 密码注册,可选邀请码',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['phone', 'password'],
          properties: {
            phone: { type: 'string', description: '手机号(11 位)' },
            password: { type: 'string', description: '密码(>=6 位,<=72 位)' },
            code: { type: 'string', description: '验证码(可选)' },
            invitationCode: { type: 'string', description: '邀请码(可选)' },
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
          409: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { phone, password } = parsed.data;

    // 检查手机号是否已注册
    const existing = await findUserByPhone(phone);
    if (existing) {
      return reply.status(409).send(error(409, '该手机号已注册'));
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const familyId = createFamilyId();
    const nickname = `用户${phone.slice(-4)}`;
    const user = await createUser({
      phone,
      passwordHash,
      nickname,
      familyId,
      roleId: 0,
      status: 1,
    });

    // 处理邀请码奖励（失败不阻塞注册）
    if (parsed.data.invitationCode) {
      try {
        const invitation = await findInvitationByCode(parsed.data.invitationCode);
        const now = new Date();
        if (
          invitation &&
          invitation.status === 'unused' &&
          (!invitation.expiresAt || invitation.expiresAt > now)
        ) {
          await markInvitationUsed({ id: invitation.id, inviteeId: user.id });

          if (invitation.rewardInvitee > 0) {
            try {
              await earnPoints(
                user.id,
                invitation.rewardInvitee,
                'invitation_reward',
                '邀请注册奖励',
                invitation.id,
              );
            } catch (e) {
              request.log.warn({ err: e }, '邀请注册奖励(被邀请人)失败');
              // 被邀请人奖励失败不阻塞注册
            }
          }

          if (invitation.rewardInviter > 0) {
            try {
              await earnPoints(
                invitation.inviterId,
                invitation.rewardInviter,
                'invitation_reward',
                '邀请用户注册奖励',
                invitation.id,
              );
            } catch (e) {
              request.log.warn({ err: e }, '邀请注册奖励(邀请人)失败');
              // 邀请人奖励失败不阻塞注册
            }
          }
        }
      } catch (e) {
        request.log.warn({ err: e }, '邀请码处理失败');
        // 邀请码无效或处理失败不阻塞注册
      }
    }

    const tokens = await buildTokenPair({
      id: user.id,
      phone: user.phone,
      roleId: user.roleId,
      familyId,
    });

    return reply.send(
      success({
        ...tokens,
        user: publicUser(user),
      }),
    );
    },
  );

  // POST /api/auth/login
  server.post(
    '/login',
    {
      schema: {
        summary: '用户登录',
        description: '账号(手机号/邮箱) + 密码登录',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['account', 'password'],
          properties: {
            account: { type: 'string', description: '账号(手机号或邮箱)' },
            password: { type: 'string', description: '密码' },
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
          403: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      config: {
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { account, password } = parsed.data;

    const user = await findUserByAccount(account);
    if (!user || !user.passwordHash) {
      return reply.status(401).send(error(401, '用户不存在或密码错误'));
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return reply.status(401).send(error(401, '用户不存在或密码错误'));
    }

    if (user.status !== 1) {
      return reply.status(403).send(error(403, '账号已被禁用'));
    }

    const familyId = createFamilyId();
    const tokens = await buildTokenPair({
      id: user.id,
      phone: user.phone,
      roleId: user.roleId,
      familyId,
    });

    return reply.send(
      success({
        ...tokens,
        user: publicUser(user),
      }),
    );
    },
  );

  // POST /api/auth/refresh
  server.post(
    '/refresh',
    {
      schema: {
        summary: '刷新访问令牌',
        description: '使用 refreshToken 轮换签发新的 accessToken / refreshToken',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', description: '刷新令牌' },
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
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { refreshToken: token } = parsed.data;

    // 1. 验证 refresh token 签名 + 过期
    let payload: JWTPayload;
    try {
      payload = await verifyRefreshToken(token);
    } catch {
      return reply.status(401).send(error(401, 'Invalid refresh token'));
    }

    // 2. 查库确认未被吊销
    const record = await findRefreshToken(token);
    if (!record || record.revokedAt) {
      return reply.status(401).send(error(401, 'Invalid refresh token'));
    }

    // 3. 确认用户仍然存在且启用
    const user = await findUserById(payload.userId);
    if (!user || user.status !== 1) {
      return reply.status(401).send(error(401, '用户不存在或已被禁用'));
    }

    // 4. 吊销旧 refresh token（轮转）
    await revokeRefreshToken(token);

    // 5. 用同一 familyId 签发新 token 对
    const tokens = await buildTokenPair({
      id: user.id,
      phone: user.phone,
      roleId: user.roleId,
      familyId: payload.familyId,
    });

    return reply.send(success(tokens));
    },
  );

  // GET /api/auth/me
  server.get('/me', async (request, reply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      const message = (e as Error).message || 'Authentication required';
      return reply.status(statusCode).send(error(statusCode, message));
    }

    const userId = request.userId!;
    const user = await findUserById(userId);
    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'));
    }

    return reply.send(success({ user: publicUser(user) }));
  });

  // POST /api/auth/logout
  server.post(
    '/logout',
    {
      schema: {
        summary: '退出登录',
        description: '吊销当前 refreshToken,完成退出登录',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', description: '刷新令牌' },
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
    const parsed = logoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    const { refreshToken: token } = parsed.data;

    const record = await findRefreshToken(token);
    if (record && !record.revokedAt) {
      await revokeRefreshToken(token);
    }

    return reply.send(success({ revoked: true }));
    },
  );
};
