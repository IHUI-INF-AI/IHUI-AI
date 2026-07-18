import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { SQL as DrizzleSQL } from 'drizzle-orm'
import { z } from 'zod'
import { authenticate, requireActiveUser } from '../plugins/auth.js'
import {
  countUsers,
  countProjects,
  countActiveSessions,
  findUsers,
  findUserById,
  updateUserRole,
  updateUserStatus,
  updateUserDept,
  findProjectsWithOwner,
  findProjectByIdWithOwner,
  createProjectAdmin,
  updateProjectAdmin,
  deleteProjectAdmin,
} from '../db/admin-queries.js'
import { createUser, isSystemAdminUser, type CreateUserInput } from '../db/queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import bcrypt from 'bcryptjs'

const ADMIN_ROLE_ID = 1

// =============================================================================
// Zod schemas
// =============================================================================

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  role: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  includeDeleted: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
  deptId: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().optional(),
  ),
})

const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const projectIdParamSchema = z.object({
  id: z.string().uuid('无效的项目 ID'),
})

const createProjectBodySchema = z.object({
  userId: z.string().uuid('请指定项目所有者'),
  name: z.string().min(1, '项目名不能为空').max(128, '项目名最多 128 字符'),
  description: z.string().max(2000).nullable().optional(),
  status: z.number().int().min(0).optional(),
})

const updateProjectBodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.number().int().min(0).optional(),
})

const idParamSchema = z.object({
  id: z.string().uuid('无效的用户 ID'),
})

const updateUserBodySchema = z
  .object({
    role: z.number().int().min(0).optional(),
    status: z.number().int().min(0).optional(),
    deptId: z.number().int().nullable().optional(),
  })
  .refine((d) => d.role !== undefined || d.status !== undefined || d.deptId !== undefined, {
    message: 'role、status 或 deptId 至少需提供一个',
  })

const createUserBodySchema = z.object({
  phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email().optional()),
  password: z.string().min(6, '密码至少 6 位'),
  nickname: z.string().trim().min(1, '昵称不能为空'),
  roleId: z.number().int().min(0).optional(),
  status: z.number().int().min(0).optional(),
})

// =============================================================================
// 路由
// =============================================================================

export const adminRoutes: FastifyPluginAsync = async (server) => {
  // admin 用户列表/详情/创建响应含 phone/email,需跳过响应脱敏
  // 防止 response-sanitizer 把敏感字段误伤为 '***'
  server.addHook('onRequest', async (request) => {
    request.skipResponseSanitization = true
  })

  // 统一 admin 鉴权：authenticate + requireActiveUser + requireAdmin，一次注册应用于全部 admin 路由
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
    try {
      await requireActiveUser(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || '账号已注销'
      return reply.status(statusCode).send(error(statusCode, message))
    }
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'))
    }
  })

  // GET /stats - Dashboard 统计卡片
  server.get(
    '/stats',
    {
      schema: {
        summary: 'Dashboard 统计卡片',
        description: '返回用户数、项目数、活跃会话数等概览统计',
        tags: ['admin'],
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
        },
      },
    },
    async (_request, reply) => {
      const [totalUsers, totalProjects, activeSessions] = await Promise.all([
        countUsers(),
        countProjects(),
        countActiveSessions(),
      ])

      return reply.send(
        success({
          totalUsers,
          totalProjects,
          todayRevenue: 0,
          activeSessions,
          totalUsersChange: 0,
          totalProjectsChange: 0,
          todayRevenueChange: 0,
          activeSessionsChange: 0,
        }),
      )
    },
  )

  // GET /users - 分页查询用户（支持 search/role/status 筛选）
  server.get(
    '/users',
    {
      schema: {
        summary: '获取用户列表',
        description: '分页查询用户,支持 search/role/status 筛选',
        tags: ['admin'],
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
            search: { type: 'string', description: '搜索关键词(可选)' },
            role: { type: 'integer', description: '角色 ID 筛选(可选)' },
            status: { type: 'integer', description: '状态筛选(可选)' },
            deptId: { type: 'integer', description: '部门 ID 筛选(可选)' },
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
    },
    async (request, reply) => {
      const parsed = listUsersQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { page, pageSize, search, role, status, includeDeleted, deptId } = parsed.data
      const { list, total } = await findUsers(
        page,
        pageSize,
        search,
        role,
        status,
        includeDeleted === true,
        deptId,
      )
      return reply.send(success({ list, total, page, pageSize }))
    },
  )

  // GET /users/:id - 单个用户详情
  server.get(
    '/users/:id',
    {
      schema: {
        summary: '获取用户详情',
        description: '获取单个用户详细信息',
        tags: ['admin'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: '用户 ID' },
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
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const user = await findUserById(parsed.data.id)
      if (!user) {
        return reply.status(404).send(error(404, '用户不存在'))
      }
      return reply.send(success({ user }))
    },
  )

  // PATCH /users/:id - 更新用户角色/状态/部门
  server.patch(
    '/users/:id',
    {
      schema: {
        summary: '更新用户角色/状态/部门',
        description: '更新用户角色(role)、状态(status)或部门(deptId),至少需提供一个',
        tags: ['admin'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: '用户 ID' },
          },
        },
        body: {
          type: 'object',
          properties: {
            role: { type: 'integer', minimum: 0, description: '角色 ID' },
            status: { type: 'integer', minimum: 0, description: '用户状态' },
            deptId: { type: 'integer', nullable: true, description: '部门 ID' },
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
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsedParams = idParamSchema.safeParse(request.params)
      if (!parsedParams.success) {
        return reply
          .status(400)
          .send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
      }

      const parsedBody = updateUserBodySchema.safeParse(request.body)
      if (!parsedBody.success) {
        return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'))
      }

      if (await isSystemAdminUser(parsedParams.data.id)) {
        return reply.status(403).send(error(403, '系统内置管理员不可修改'))
      }

      const existing = await findUserById(parsedParams.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '用户不存在'))
      }

      let updated = existing
      if (parsedBody.data.role !== undefined) {
        const r = await updateUserRole(parsedParams.data.id, parsedBody.data.role)
        if (r) updated = r
      }
      if (parsedBody.data.status !== undefined) {
        const r = await updateUserStatus(parsedParams.data.id, parsedBody.data.status)
        if (r) updated = r
      }
      if (parsedBody.data.deptId !== undefined) {
        const r = await updateUserDept(parsedParams.data.id, parsedBody.data.deptId)
        if (r) updated = r
      }

      return reply.send(success({ user: updated }))
    },
  )

  // POST /users - 管理员创建用户(需 nickname + passwordHash)
  server.post(
    '/users',
    {
      schema: {
        summary: '管理员创建用户',
        description: '由管理员创建用户账号,需提供 nickname + passwordHash;phone/email 可选',
        tags: ['admin'],
        body: {
          type: 'object',
          required: ['passwordHash', 'nickname'],
          properties: {
            phone: { type: 'string', description: '手机号(可选,唯一)' },
            email: { type: 'string', format: 'email', description: '邮箱(可选,唯一)' },
            passwordHash: { type: 'string', minLength: 1, description: '密码哈希(bcrypt)' },
            nickname: { type: 'string', minLength: 1, description: '昵称' },
            roleId: { type: 'integer', minimum: 0, description: '角色 ID(可选,默认 0)' },
            status: { type: 'integer', minimum: 0, description: '状态(可选,默认 1)' },
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
        },
      },
    },
    async (request, reply) => {
      const parsed = createUserBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      if (!parsed.data.phone && !parsed.data.email) {
        return reply.status(400).send(error(400, 'phone 与 email 至少需提供一个'))
      }
      const user = await createUser({
        phone: parsed.data.phone,
        email: parsed.data.email,
        passwordHash: bcrypt.hashSync(parsed.data.password, 10),
        nickname: parsed.data.nickname,
        roleId: parsed.data.roleId,
        status: parsed.data.status,
      } as CreateUserInput)
      return reply.status(201).send(success({ user }))
    },
  )

  // DELETE /users/:id - 软删除用户(status=3 注销,保留审计追溯)
  server.delete(
    '/users/:id',
    {
      schema: {
        summary: '软删除用户',
        description: '将用户 status 置为 3(注销),保留记录用于审计,可由管理员恢复',
        tags: ['admin'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: '用户 ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  user: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
          400: {
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
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      if (await isSystemAdminUser(parsed.data.id)) {
        return reply.status(403).send(error(403, '系统内置管理员不可删除'))
      }
      const user = await updateUserStatus(parsed.data.id, 3)
      if (!user) {
        return reply.status(404).send(error(404, '用户不存在'))
      }
      return reply.send(success({ user }))
    },
  )

  // GET /projects - 分页查询所有项目（含 owner 信息）
  server.get(
    '/projects',
    {
      schema: {
        summary: '获取项目列表',
        description: '分页查询所有项目(含 owner 信息)',
        tags: ['admin'],
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
    },
    async (request, reply) => {
      const parsed = listProjectsQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { page, pageSize } = parsed.data
      const { list, total } = await findProjectsWithOwner(page, pageSize)
      return reply.send(success({ list, total, page, pageSize }))
    },
  )

  // GET /projects/:id - 项目详情(含 owner 信息)
  server.get('/projects/:id', async (request, reply) => {
    const parsed = projectIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const project = await findProjectByIdWithOwner(parsed.data.id)
    if (!project) return reply.status(404).send(error(404, '项目不存在'))
    return reply.send(success({ project }))
  })

  // POST /projects - 管理员创建项目(需指定 userId)
  server.post('/projects', async (request, reply) => {
    const parsed = createProjectBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const project = await createProjectAdmin(parsed.data)
    return reply.status(201).send(success({ project }))
  })

  // PATCH /projects/:id - 更新项目(name/description/status)
  server.patch('/projects/:id', async (request, reply) => {
    const paramParsed = projectIdParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = updateProjectBodySchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findProjectByIdWithOwner(paramParsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '项目不存在'))
    const project = await updateProjectAdmin(paramParsed.data.id, bodyParsed.data)
    return reply.send(success({ project }))
  })

  // DELETE /projects/:id - 删除项目(级联删除项目下文件)
  server.delete('/projects/:id', async (request, reply) => {
    const paramParsed = projectIdParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findProjectByIdWithOwner(paramParsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '项目不存在'))
    await deleteProjectAdmin(paramParsed.data.id)
    return reply.send(success({ id: paramParsed.data.id, deleted: true }))
  })

  // ============================================================================
  // R77 真实补建:Top 5 最高 ROI 缺失端点(admin-audit-report.md)
  // ============================================================================

  // POST /users/:id/resetPwd - 管理员重置用户密码(前端 ResetPasswordDialog 使用)
  // R78 修复: 此前引用未定义的 userIdParamSchema, 改用已定义的 idParamSchema (L64)
  server.post('/users/:id/resetPwd', async (request, reply) => {
    const paramParsed = idParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send(error(400, paramParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const bodyParsed = z
      .object({ newPassword: z.string().min(6, '新密码至少 6 位') })
      .safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const user = await findUserById(paramParsed.data.id)
    if (!user) return reply.status(404).send(error(404, '用户不存在'))
    const passwordHash = bcrypt.hashSync(bodyParsed.data.newPassword, 10)
    const { db } = await import('../db/index.js')
    const { users } = await import('@ihui/database')
    const { eq } = await import('drizzle-orm')
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, paramParsed.data.id))
    return reply.send(success({ id: paramParsed.data.id, reset: true }))
  })

  // GET /dept/list - 部门列表(前端 users/DeptTree 使用)
  server.get('/dept/list', async (_request, reply) => {
    try {
      const { findDepartments } = await import('../db/usercenter-queries.js')
      const depts = await findDepartments({})
      return reply.send(success({ list: depts, total: depts.length }))
    } catch (e) {
      return reply.status(500).send(error(500, `部门列表查询失败: ${(e as Error).message}`))
    }
  })

  // GET /agreements - 协议列表(前端 agreements 页面使用)
  server.get('/agreements', async (_request, reply) => {
    try {
      const { findAllAgreements } = await import('../db/admin-queries.js')
      const list = await findAllAgreements()
      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      return reply.status(500).send(error(500, `协议列表查询失败: ${(e as Error).message}`))
    }
  })

  // GET /advertise - 广告列表(前端 advertise 页面使用)
  server.get('/advertise', async (request, reply) => {
    try {
      const { findAdvertisements } = await import('../db/admin-queries.js')
      const q = (request.query ?? {}) as { page?: string; pageSize?: string }
      const page = Math.max(1, Math.floor(Number(q.page) || 1))
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
      const { list, total } = await findAdvertisements({ page, pageSize })
      return reply.send(success({ list, total, page, pageSize }))
    } catch (e) {
      return reply.status(500).send(error(500, `广告列表查询失败: ${(e as Error).message}`))
    }
  })

  // GET /article - 文章分页列表(前端 articles 页面使用)
  server.get('/article', async (request, reply) => {
    try {
      const { findArticles } = await import('../db/admin-queries.js')
      const q = (request.query ?? {}) as { page?: string; pageSize?: string; status?: string }
      const page = Math.max(1, Math.floor(Number(q.page) || 1))
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
      const { list, total } = await findArticles({
        page,
        pageSize,
        ...(q.status ? { status: Number(q.status) } : {}),
      })
      return reply.send(success({ list, total, page, pageSize }))
    } catch (e) {
      return reply.status(500).send(error(500, `文章列表查询失败: ${(e as Error).message}`))
    }
  })

  // ============================================================================
  // R78 真实补建:Top 6-15 缺失端点(admin-audit-report.md)
  // ============================================================================

  // GET /agent-rule - 智能体规则列表(前端 admin/agent-rule/ 使用,原后端仅有 POST/PUT/DELETE)
  server.get('/agent-rule', async (request, reply) => {
    try {
      const q = (request.query ?? {}) as {
        page?: string
        pageSize?: string
        agentId?: string
        status?: string
      }
      const page = Math.max(1, Math.floor(Number(q.page) || 1))
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
      const { db } = await import('../db/index.js')
      const { agentRule } = await import('@ihui/database')
      const { and, eq, desc, sql } = await import('drizzle-orm')
      const conds: DrizzleSQL[] = []
      if (q.agentId) conds.push(eq(agentRule.agentId, q.agentId))
      if (q.status !== undefined && q.status !== '')
        conds.push(eq(agentRule.status, Number(q.status)))
      const where = conds.length ? and(...conds) : undefined
      const [list, totalRows] = await Promise.all([
        db
          .select()
          .from(agentRule)
          .where(where)
          .orderBy(desc(agentRule.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(agentRule)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    } catch (e) {
      return reply.status(500).send(error(500, `智能体规则列表查询失败: ${(e as Error).message}`))
    }
  })

  // GET /agent-task - 智能体任务列表(前端 admin/agent-task/ 使用)
  server.get('/agent-task', async (request, reply) => {
    try {
      const q = (request.query ?? {}) as {
        page?: string
        pageSize?: string
        agentId?: string
        status?: string
      }
      const page = Math.max(1, Math.floor(Number(q.page) || 1))
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
      const { db } = await import('../db/index.js')
      const { agentTasks } = await import('@ihui/database')
      const { and, eq, desc, sql } = await import('drizzle-orm')
      const conds: DrizzleSQL[] = []
      if (q.agentId) conds.push(eq(agentTasks.agentId, q.agentId))
      if (q.status) conds.push(eq(agentTasks.status, q.status))
      const where = conds.length ? and(...conds) : undefined
      const [list, totalRows] = await Promise.all([
        db
          .select()
          .from(agentTasks)
          .where(where)
          .orderBy(desc(agentTasks.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(agentTasks)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    } catch (e) {
      return reply.status(500).send(error(500, `智能体任务列表查询失败: ${(e as Error).message}`))
    }
  })

  // GET /edu/classes/schedules - 班级课程表(前端 admin/edu/ 使用,schema 暂无)
  // TODO: 待补 schema `edu_classes_schedules`(当前 edu-extended.ts 仅有 notes/offline_records/uploaded_certs/uploaded_papers)
  server.get('/edu/classes/schedules', async (request, reply) => {
    try {
      const q = (request.query ?? {}) as { page?: string; pageSize?: string; classId?: string }
      const page = Math.max(1, Math.floor(Number(q.page) || 1))
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
      return reply.send(success({ list: [], total: 0, page, pageSize, _stub: true }))
    } catch (e) {
      return reply.status(500).send(error(500, `班级课程表查询失败: ${(e as Error).message}`))
    }
  })

  // GET /certificates - 证书列表(前端 admin/certificate/ 使用,带 user/template 联表)
  server.get('/certificates', async (request, reply) => {
    try {
      const q = (request.query ?? {}) as {
        page?: string
        pageSize?: string
        userId?: string
        templateId?: string
        status?: string
        search?: string
      }
      const page = Math.max(1, Math.floor(Number(q.page) || 1))
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
      const { findCertificates } = await import('../db/certificate-queries.js')
      const { list, total } = await findCertificates({
        page,
        pageSize,
        ...(q.userId ? { userId: q.userId } : {}),
        ...(q.templateId ? { templateId: q.templateId } : {}),
        ...(q.status ? { status: Number(q.status) } : {}),
        ...(q.search ? { search: q.search } : {}),
      })
      return reply.send(success({ list, total, page, pageSize }))
    } catch (e) {
      return reply.status(500).send(error(500, `证书列表查询失败: ${(e as Error).message}`))
    }
  })

  // GET /certificates/templates - 证书模板列表(前端 admin/certificate/ 使用)
  server.get('/certificates/templates', async (request, reply) => {
    try {
      const q = (request.query ?? {}) as {
        page?: string
        pageSize?: string
        search?: string
        status?: string
      }
      const page = Math.max(1, Math.floor(Number(q.page) || 1))
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
      const { findTemplates } = await import('../db/certificate-queries.js')
      const { list, total } = await findTemplates({
        page,
        pageSize,
        ...(q.search ? { search: q.search } : {}),
        ...(q.status ? { status: Number(q.status) } : {}),
      })
      return reply.send(success({ list, total, page, pageSize }))
    } catch (e) {
      return reply.status(500).send(error(500, `证书模板列表查询失败: ${(e as Error).message}`))
    }
  })

  // GET /edu/classes/:id/members - 班级成员列表(前端 admin/edu/ 使用,schema 暂无)
  // TODO: 待补 schema `edu_classes_members`(当前 edu-extended.ts 仅有 notes/offline_records/uploaded_certs/uploaded_papers)
  server.get('/edu/classes/:id/members', async (request, reply) => {
    try {
      const idParsed = z
        .object({ id: z.string().min(1, '班级 ID 不能为空') })
        .safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      return reply.send(success({ list: [], total: 0, classId: idParsed.data.id, _stub: true }))
    } catch (e) {
      return reply.status(500).send(error(500, `班级成员查询失败: ${(e as Error).message}`))
    }
  })

  // GET /learn/signups - 课程报名列表(前端 admin/learn/signups/ 使用)
  server.get('/learn/signups', async (request, reply) => {
    try {
      const q = (request.query ?? {}) as {
        page?: string
        pageSize?: string
        lessonId?: string
        status?: string
        search?: string
      }
      const page = Math.max(1, Math.floor(Number(q.page) || 1))
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
      const { findAdminSignups } = await import('../db/learn-queries.js')
      const { list, total } = await findAdminSignups({
        page,
        pageSize,
        ...(q.lessonId ? { lessonId: q.lessonId } : {}),
        ...(q.status ? { status: Number(q.status) } : {}),
        ...(q.search ? { search: q.search } : {}),
      })
      return reply.send(success({ list, total, page, pageSize }))
    } catch (e) {
      return reply.status(500).send(error(500, `课程报名列表查询失败: ${(e as Error).message}`))
    }
  })

  // GET /learn/invoices - 发票申请列表(前端 admin/learn/invoices/ 使用)
  server.get('/learn/invoices', async (request, reply) => {
    try {
      const q = (request.query ?? {}) as {
        page?: string
        pageSize?: string
        status?: string
        search?: string
      }
      const page = Math.max(1, Math.floor(Number(q.page) || 1))
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
      const { findInvoiceApplicationList } = await import('../db/learn-extended-queries.js')
      const { list, total } = await findInvoiceApplicationList({
        page,
        pageSize,
        ...(q.status ? { status: q.status } : {}),
        ...(q.search ? { search: q.search } : {}),
      })
      return reply.send(success({ list, total, page, pageSize }))
    } catch (e) {
      return reply.status(500).send(error(500, `发票申请列表查询失败: ${(e as Error).message}`))
    }
  })

  // GET /course/pay-logs - 课程支付日志列表(前端 admin/course/ 使用,基于 zhs_course_pay_log)
  server.get('/course/pay-logs', async (request, reply) => {
    try {
      const q = (request.query ?? {}) as {
        page?: string
        pageSize?: string
        payId?: string
        action?: string
      }
      const page = Math.max(1, Math.floor(Number(q.page) || 1))
      const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
      const { db } = await import('../db/index.js')
      const { zhsCoursePayLog } = await import('@ihui/database')
      const { and, eq, desc, sql } = await import('drizzle-orm')
      const conds: DrizzleSQL[] = []
      if (q.payId) conds.push(eq(zhsCoursePayLog.payId, Number(q.payId)))
      if (q.action) conds.push(eq(zhsCoursePayLog.action, q.action))
      const where = conds.length ? and(...conds) : undefined
      const [list, totalRows] = await Promise.all([
        db
          .select()
          .from(zhsCoursePayLog)
          .where(where)
          .orderBy(desc(zhsCoursePayLog.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(zhsCoursePayLog)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    } catch (e) {
      return reply.status(500).send(error(500, `课程支付日志查询失败: ${(e as Error).message}`))
    }
  })

  // GET /reports/signup - 报名统计报表(前端 admin/reports/ 使用,基于 lessonSignUps 聚合)
  server.get('/reports/signup', async (request, reply) => {
    try {
      const q = (request.query ?? {}) as { startDate?: string; endDate?: string }
      const { findSignupReport } = await import('../db/learn-queries.js')
      const data = await findSignupReport({
        ...(q.startDate ? { startDate: q.startDate } : {}),
        ...(q.endDate ? { endDate: q.endDate } : {}),
      })
      return reply.send(success({ report: data }))
    } catch (e) {
      return reply.status(500).send(error(500, `报名报表查询失败: ${(e as Error).message}`))
    }
  })
}
