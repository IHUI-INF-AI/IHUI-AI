import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
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
}
