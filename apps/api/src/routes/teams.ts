import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { authenticate } from '../plugins/auth.js';
import type { Team } from '@ihui/database';
import {
  createTeam,
  findTeamsByUser,
  findTeamById,
  findTeamDetailById,
  findTeamBySlug,
  updateTeam,
  deleteTeam,
  findTeamMembers,
  findTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  createInvitation,
  findInvitationsByTeam,
  findInvitationByToken,
  findUserInvitations,
  acceptInvitation,
  rejectInvitation,
} from '../db/team-queries.js';
import { success, error } from '../utils/response.js';

// =============================================================================
// Zod schemas
// =============================================================================

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createTeamSchema = z.object({
  name: z.string().min(1, '团队名称不能为空').max(128, '团队名称最多 128 字符'),
  slug: z
    .string()
    .min(1, 'slug 不能为空')
    .max(128)
    .regex(slugRegex, 'slug 只能包含小写字母、数字和连字符'),
  description: z.string().max(2000).optional(),
  avatar: z.string().max(512).optional(),
});

const updateTeamSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(2000).optional(),
  avatar: z.string().max(512).optional(),
});

const createInvitationSchema = z.object({
  inviteeId: z.string().uuid().optional(),
  email: z.string().email().max(255).optional(),
  expiresAt: z.string().datetime().optional(),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

// =============================================================================
// 序列化辅助
// =============================================================================

function serializeTeam(t: Team & { ownerName?: string | null; memberCount?: number }) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description ?? '',
    ownerId: t.ownerId,
    ownerName: t.ownerName ?? null,
    avatar: t.avatar ?? null,
    memberCount: t.memberCount ?? 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function serializeMember(m: {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  nickname: string | null;
  email: string | null;
  avatar: string | null;
}) {
  return {
    id: m.id,
    teamId: m.teamId,
    userId: m.userId,
    role: m.role,
    joinedAt: m.joinedAt,
    nickname: m.nickname,
    email: m.email,
    avatar: m.avatar,
  };
}

function serializeInvitation(i: {
  id: string;
  teamId: string;
  inviterId: string;
  inviteeId: string | null;
  email: string | null;
  token: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    id: i.id,
    teamId: i.teamId,
    inviterId: i.inviterId,
    inviteeId: i.inviteeId,
    email: i.email,
    invitee: i.email ?? i.inviteeId,
    token: i.token,
    status: i.status,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
  };
}

// =============================================================================
// 路由
// =============================================================================

export const teamRoutes: FastifyPluginAsync = async (server) => {
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request);
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
      const message = (e as Error).message || 'Authentication required';
      return reply.status(statusCode).send(error(statusCode, message));
    }
  };

  // ---------------------------------------------------------------------------
  // 邀请相关（无 :id 前缀）—— 注册在 parametric 路由之前，Fastify 静态优先。
  // ---------------------------------------------------------------------------

  // GET /invitations - 当前用户收到的所有邀请
  server.get('/invitations', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;

    const list = await findUserInvitations(request.userId);
    return reply.send(success({ invitations: list.map(serializeInvitation) }));
  });

  // POST /invitations/:token/accept - 接受邀请
  server.post('/invitations/:token/accept', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const { token } = request.params as { token: string };
    const invitation = await findInvitationByToken(token);
    if (!invitation) {
      return reply.status(404).send(error(404, '邀请不存在'));
    }
    if (invitation.status !== 'pending') {
      return reply.status(400).send(error(400, `邀请已${invitation.status}`));
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      return reply.status(400).send(error(400, '邀请已过期'));
    }

    // 校验当前用户为被邀请人（invitee_id 或 email 匹配）
    const member = await findTeamMember(invitation.teamId, userId);
    if (!member) {
      const isInvitee = invitation.inviteeId === userId;
      const isEmailMatch = invitation.email !== null && invitation.email !== undefined;
      if (!isInvitee && !isEmailMatch) {
        return reply.status(403).send(error(403, '无权接受该邀请'));
      }
    }

    const result = await acceptInvitation(invitation, userId);
    return reply.send(success({ invitation: serializeInvitation(result.invitation) }));
  });

  // POST /invitations/:token/reject - 拒绝邀请
  server.post('/invitations/:token/reject', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const { token } = request.params as { token: string };
    const invitation = await findInvitationByToken(token);
    if (!invitation) {
      return reply.status(404).send(error(404, '邀请不存在'));
    }
    if (invitation.status !== 'pending') {
      return reply.status(400).send(error(400, `邀请已${invitation.status}`));
    }

    // 校验当前用户为被邀请人
    const isInvitee = invitation.inviteeId === userId;
    const isEmailMatch = invitation.email !== null && invitation.email !== undefined;
    if (!isInvitee && !isEmailMatch) {
      return reply.status(403).send(error(403, '无权拒绝该邀请'));
    }

    const updated = await rejectInvitation(invitation);
    return reply.send(success({ invitation: serializeInvitation(updated ?? invitation) }));
  });

  // ---------------------------------------------------------------------------
  // 团队 CRUD
  // ---------------------------------------------------------------------------

  // GET / - 当前用户的团队列表
  server.get('/', {
    schema: {
      summary: '团队列表',
      tags: ['teams'],
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
    await requireAuth(request, reply);
    if (!request.userId) return;

    const list = await findTeamsByUser(request.userId);
    return reply.send(success({ teams: list.map(serializeTeam) }));
  });

  // POST / - 创建团队
  server.post('/', {
    schema: {
      summary: '创建团队',
      tags: ['teams'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '团队名称' },
          slug: { type: 'string', description: '团队 slug(小写字母/数字/连字符)' },
          description: { type: 'string', description: '团队描述(可选)' },
          avatar: { type: 'string', description: '团队头像 URL(可选)' },
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
        409: {
          type: 'object',
          properties: { code: { type: 'number' }, message: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const parsed = createTeamSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const existing = await findTeamBySlug(parsed.data.slug);
    if (existing) {
      return reply.status(409).send(error(409, 'slug 已被占用'));
    }

    const team = await createTeam({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      avatar: parsed.data.avatar,
      ownerId: userId,
    });

    return reply.status(201).send(success({ team: serializeTeam(team) }));
  });

  // GET /:id - 团队详情（仅成员可见）
  server.get('/:id', {
    schema: {
      summary: '团队详情',
      tags: ['teams'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '团队 ID' },
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
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const { id } = request.params as { id: string };
    const team = await findTeamDetailById(id);
    if (!team) {
      return reply.status(404).send(error(404, '团队不存在'));
    }

    const member = await findTeamMember(id, userId);
    if (!member) {
      return reply.status(403).send(error(403, '无权访问该团队'));
    }

    return reply.send(success({ team: serializeTeam(team) }));
  });

  // PATCH /:id - 更新团队（仅 owner/admin）
  server.patch('/:id', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const { id } = request.params as { id: string };
    const parsed = updateTeamSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const team = await findTeamById(id);
    if (!team) {
      return reply.status(404).send(error(404, '团队不存在'));
    }

    const member = await findTeamMember(id, userId);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return reply.status(403).send(error(403, '无权修改该团队'));
    }

    const updated = await updateTeam(id, parsed.data);
    return reply.send(success({ team: serializeTeam(updated) }));
  });

  // DELETE /:id - 删除团队（仅 owner）
  server.delete('/:id', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const { id } = request.params as { id: string };
    const team = await findTeamById(id);
    if (!team) {
      return reply.status(404).send(error(404, '团队不存在'));
    }
    if (team.ownerId !== userId) {
      return reply.status(403).send(error(403, '无权删除该团队'));
    }

    await deleteTeam(id);
    return reply.send(success({ deleted: true }));
  });

  // ---------------------------------------------------------------------------
  // 成员管理
  // ---------------------------------------------------------------------------

  // GET /:id/members - 成员列表
  server.get('/:id/members', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const { id } = request.params as { id: string };
    const team = await findTeamById(id);
    if (!team) {
      return reply.status(404).send(error(404, '团队不存在'));
    }

    const member = await findTeamMember(id, userId);
    if (!member) {
      return reply.status(403).send(error(403, '无权访问该团队'));
    }

    const list = await findTeamMembers(id);
    return reply.send(success({ members: list.map(serializeMember) }));
  });

  // PATCH /:id/members/:userId - 修改成员角色（仅 owner）
  server.patch('/:id/members/:userId', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const { id, userId: targetUserId } = request.params as { id: string; userId: string };
    const parsed = updateMemberRoleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }

    const team = await findTeamById(id);
    if (!team) {
      return reply.status(404).send(error(404, '团队不存在'));
    }
    if (team.ownerId !== userId) {
      return reply.status(403).send(error(403, '仅 owner 可修改成员角色'));
    }

    const target = await findTeamMember(id, targetUserId);
    if (!target) {
      return reply.status(404).send(error(404, '成员不存在'));
    }
    if (target.role === 'owner') {
      return reply.status(400).send(error(400, '不能修改 owner 角色'));
    }

    const updated = await updateTeamMemberRole(id, targetUserId, parsed.data.role);
    if (!updated) {
      return reply.status(404).send(error(404, '成员不存在'));
    }
    return reply.send(success({ member: serializeMember({ ...updated, nickname: null, email: null, avatar: null }) }));
  });

  // DELETE /:id/members/:userId - 移除成员（仅 owner/admin，不能移除 owner）
  server.delete('/:id/members/:userId', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const { id, userId: targetUserId } = request.params as { id: string; userId: string };
    const team = await findTeamById(id);
    if (!team) {
      return reply.status(404).send(error(404, '团队不存在'));
    }

    const member = await findTeamMember(id, userId);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return reply.status(403).send(error(403, '无权移除成员'));
    }

    const target = await findTeamMember(id, targetUserId);
    if (!target) {
      return reply.status(404).send(error(404, '成员不存在'));
    }
    if (target.role === 'owner') {
      return reply.status(400).send(error(400, '不能移除 owner'));
    }

    await removeTeamMember(id, targetUserId);
    return reply.send(success({ deleted: true }));
  });

  // ---------------------------------------------------------------------------
  // 邀请管理
  // ---------------------------------------------------------------------------

  // POST /:id/invitations - 邀请成员
  server.post('/:id/invitations', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const { id } = request.params as { id: string };
    const parsed = createInvitationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
    }
    if (!parsed.data.inviteeId && !parsed.data.email) {
      return reply.status(400).send(error(400, 'inviteeId 或 email 至少提供一个'));
    }

    const team = await findTeamById(id);
    if (!team) {
      return reply.status(404).send(error(404, '团队不存在'));
    }

    const member = await findTeamMember(id, userId);
    if (!member) {
      return reply.status(403).send(error(403, '无权邀请成员'));
    }

    // 若指定 inviteeId 且该用户已是成员，则拒绝
    if (parsed.data.inviteeId) {
      const existing = await findTeamMember(id, parsed.data.inviteeId);
      if (existing) {
        return reply.status(409).send(error(409, '该用户已是团队成员'));
      }
    }

    const token = randomUUID();
    const expiresAt = parsed.data.expiresAt
      ? new Date(parsed.data.expiresAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await createInvitation({
      teamId: id,
      inviterId: userId,
      inviteeId: parsed.data.inviteeId,
      email: parsed.data.email,
      token,
      expiresAt,
    });

    return reply.status(201).send(success({ invitation: serializeInvitation(invitation) }));
  });

  // GET /:id/invitations - 团队邀请列表（仅 owner/admin）
  server.get('/:id/invitations', async (request, reply) => {
    await requireAuth(request, reply);
    if (!request.userId) return;
    const userId = request.userId;

    const { id } = request.params as { id: string };
    const team = await findTeamById(id);
    if (!team) {
      return reply.status(404).send(error(404, '团队不存在'));
    }

    const member = await findTeamMember(id, userId);
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return reply.status(403).send(error(403, '无权查看邀请列表'));
    }

    const list = await findInvitationsByTeam(id);
    return reply.send(success({ invitations: list.map(serializeInvitation) }));
  });
};
