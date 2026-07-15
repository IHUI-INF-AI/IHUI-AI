import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  findUsers,
  deleteUser,
  updateUserPassword,
  updateUserStatus,
  findDepartments,
  findDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  findUserCertificates,
  createUserCertificate,
  deleteUserCertificate,
  getUserStatistics,
} from '../db/usercenter-queries.js'
import { findUserById, findUserByPhone, createUser, updateUser } from '../db/queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const listUsersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  nickname: z.preprocess(emptyToUndefined, z.string().min(1).max(64).optional()),
  phone: z.preprocess(emptyToUndefined, z.string().min(1).max(11).optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(1).optional()),
})

const createUserSchema = z.object({
  phone: z.string().min(1, '手机号不能为空').max(11),
  nickname: z.string().max(64).nullable().optional(),
  password: z.string().min(6, '密码至少 6 位').max(128),
  email: z.string().email().nullable().optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateUserSchema = z.object({
  nickname: z.string().max(64).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(1).max(11).nullable().optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updatePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6, '新密码至少 6 位').max(128),
})

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, '新密码至少 6 位').max(128),
})

const byPhoneQuery = z.object({
  phone: z.string().min(1, '手机号不能为空'),
})

const listDeptQuery = z.object({
  pid: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  companyId: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
})

const createDeptSchema = z.object({
  name: z.string().min(1, '部门名称不能为空').max(100),
  pid: z.string().uuid().nullable().optional(),
  companyId: z.number().int().optional(),
  sort: z.number().int().min(0).optional(),
})

const updateDeptSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pid: z.string().uuid().nullable().optional(),
  companyId: z.number().int().optional(),
  sort: z.number().int().min(0).optional(),
})

const createCertificateSchema = z.object({
  title: z.string().min(1, '证书标题不能为空').max(200),
  certificateNo: z.string().max(100).nullable().optional(),
  issuedAt: z.coerce.date().nullable().optional(),
  expireAt: z.coerce.date().nullable().optional(),
  status: z.number().int().min(0).max(1).optional(),
})

// =============================================================================
// 路由（前缀 /api/admin/usercenter）
// =============================================================================

export const usercenterRoutes: FastifyPluginAsync = async (server) => {
  // 用户中心响应含 phone/email(admin 上下文),需跳过响应脱敏
  // 防止 response-sanitizer 把敏感字段误伤为 '***'
  server.addHook('onRequest', async (request) => {
    request.skipResponseSanitization = true
  })

  // 统一 admin 鉴权
  server.addHook('preHandler', requireAdmin)

  // ----- 用户管理 -----

  // GET /usercenter/users - 用户列表
  server.get(
    '/usercenter/users',
    {
      schema: {
        summary: '用户列表',
        tags: ['usercenter'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            nickname: { type: 'string', description: '昵称模糊搜索' },
            phone: { type: 'string', description: '手机号模糊搜索' },
            status: { type: 'integer', minimum: 0, maximum: 1, description: '状态筛选' },
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
      const parsed = listUsersQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findUsers(parsed.data)
      // 剥离密码哈希，避免泄漏到客户端
      const list = result.list.map(({ passwordHash: _ph, ...rest }) => rest)
      return reply.send(success({ ...result, list }))
    },
  )

  // GET /usercenter/users/by-phone - 按手机号查
  server.get(
    '/usercenter/users/by-phone',
    {
      schema: {
        summary: '按手机号查用户',
        tags: ['usercenter'],
        querystring: {
          type: 'object',
          properties: { phone: { type: 'string', description: '手机号' } },
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
    },
    async (request, reply) => {
      const parsed = byPhoneQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const user = await findUserByPhone(parsed.data.phone)
      if (!user) {
        return reply.status(404).send(error(404, '用户不存在'))
      }
      const { passwordHash: _ph, ...userPublic } = user
      return reply.send(success({ user: userPublic }))
    },
  )

  // GET /usercenter/users/:id - 按ID查
  server.get(
    '/usercenter/users/:id',
    {
      schema: {
        summary: '按ID查用户',
        tags: ['usercenter'],
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
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const user = await findUserById(parsed.data.id)
      if (!user) {
        return reply.status(404).send(error(404, '用户不存在'))
      }
      const { passwordHash: _ph2, ...userPublic } = user
      return reply.send(success({ user: userPublic }))
    },
  )

  // POST /usercenter/users - 创建用户
  server.post(
    '/usercenter/users',
    {
      schema: {
        summary: '创建用户',
        tags: ['usercenter'],
        body: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: '手机号' },
            nickname: { type: 'string', description: '昵称' },
            password: { type: 'string', description: '密码(至少6位)' },
            email: { type: 'string', description: '邮箱' },
            status: { type: 'integer', description: '状态: 1=启用 0=禁用' },
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
          409: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = createUserSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findUserByPhone(parsed.data.phone)
      if (existing) {
        return reply.status(409).send(error(409, '手机号已存在'))
      }
      const passwordHash = await bcrypt.hash(parsed.data.password, 10)
      const user = await createUser({
        phone: parsed.data.phone,
        nickname: parsed.data.nickname ?? undefined,
        passwordHash,
        email: parsed.data.email ?? undefined,
        status: parsed.data.status,
      })
      const { passwordHash: _ph3, ...userPublic } = user
      return reply.status(201).send(success({ user: userPublic }))
    },
  )

  // PUT /usercenter/users/:id - 更新用户
  server.put(
    '/usercenter/users/:id',
    {
      schema: {
        summary: '更新用户',
        tags: ['usercenter'],
        body: {
          type: 'object',
          properties: {
            nickname: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            status: { type: 'integer' },
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
    },
    async (request, reply) => {
      const idParsed = uuidParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updateUserSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findUserById(idParsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '用户不存在'))
      }
      // 状态单独走 updateUserStatus；其余走 updateUser
      if (parsed.data.status !== undefined) {
        await updateUserStatus(idParsed.data.id, parsed.data.status)
      }
      const user = await updateUser(idParsed.data.id, {
        nickname: parsed.data.nickname ?? undefined,
        email: parsed.data.email ?? undefined,
      })
      const { passwordHash: _ph4, ...userPublic } = user
      return reply.send(success({ user: userPublic }))
    },
  )

  // PUT /usercenter/users/:id/password - 修改密码(校验原密码)
  server.put(
    '/usercenter/users/:id/password',
    {
      schema: {
        summary: '修改密码',
        tags: ['usercenter'],
        body: {
          type: 'object',
          properties: {
            oldPassword: { type: 'string', description: '原密码' },
            newPassword: { type: 'string', description: '新密码(至少6位)' },
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
      const idParsed = uuidParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updatePasswordSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const user = await findUserById(idParsed.data.id)
      if (!user) {
        return reply.status(404).send(error(404, '用户不存在'))
      }
      const ok = await bcrypt.compare(parsed.data.oldPassword, user.passwordHash ?? '')
      if (!ok) {
        return reply.status(401).send(error(401, '原密码错误'))
      }
      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10)
      await updateUserPassword(idParsed.data.id, passwordHash)
      return reply.send(success({ id: user.id }))
    },
  )

  // PUT /usercenter/users/:id/reset-password - 重置密码(管理员)
  server.put(
    '/usercenter/users/:id/reset-password',
    {
      schema: {
        summary: '重置密码',
        tags: ['usercenter'],
        body: {
          type: 'object',
          properties: { newPassword: { type: 'string', description: '新密码(至少6位)' } },
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
    },
    async (request, reply) => {
      const idParsed = uuidParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = resetPasswordSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const user = await findUserById(idParsed.data.id)
      if (!user) {
        return reply.status(404).send(error(404, '用户不存在'))
      }
      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10)
      await updateUserPassword(idParsed.data.id, passwordHash)
      return reply.send(success({ id: user.id }))
    },
  )

  // DELETE /usercenter/users/:id - 删除用户
  server.delete(
    '/usercenter/users/:id',
    {
      schema: {
        summary: '删除用户',
        tags: ['usercenter'],
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
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findUserById(parsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '用户不存在'))
      }
      await deleteUser(parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    },
  )

  // ----- 用户证书 -----

  // GET /usercenter/users/:id/certificates - 用户证书列表
  server.get(
    '/usercenter/users/:id/certificates',
    {
      schema: {
        summary: '用户证书列表',
        tags: ['usercenter'],
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
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const user = await findUserById(parsed.data.id)
      if (!user) {
        return reply.status(404).send(error(404, '用户不存在'))
      }
      const list = await findUserCertificates(parsed.data.id)
      return reply.send(success({ list }))
    },
  )

  // POST /usercenter/users/:id/certificates - 创建证书
  server.post(
    '/usercenter/users/:id/certificates',
    {
      schema: {
        summary: '创建用户证书',
        tags: ['usercenter'],
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '证书标题' },
            certificateNo: { type: 'string', description: '证书编号' },
            issuedAt: { type: 'string', format: 'date-time', description: '颁发时间' },
            expireAt: { type: 'string', format: 'date-time', description: '过期时间' },
            status: { type: 'integer', description: '状态: 1=有效 0=失效' },
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
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const idParsed = uuidParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = createCertificateSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const user = await findUserById(idParsed.data.id)
      if (!user) {
        return reply.status(404).send(error(404, '用户不存在'))
      }
      const certificate = await createUserCertificate({
        userId: idParsed.data.id,
        title: parsed.data.title,
        certificateNo: parsed.data.certificateNo ?? undefined,
        issuedAt: parsed.data.issuedAt ?? undefined,
        expireAt: parsed.data.expireAt ?? undefined,
        status: parsed.data.status,
      })
      return reply.status(201).send(success({ certificate }))
    },
  )

  // DELETE /usercenter/certificates/:id - 删除证书
  server.delete(
    '/usercenter/certificates/:id',
    {
      schema: {
        summary: '删除证书',
        tags: ['usercenter'],
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
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      await deleteUserCertificate(parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    },
  )

  // ----- 部门管理 -----

  // GET /usercenter/departments - 部门列表
  server.get(
    '/usercenter/departments',
    {
      schema: {
        summary: '部门列表',
        tags: ['usercenter'],
        querystring: {
          type: 'object',
          properties: {
            pid: { type: 'string', format: 'uuid', description: '父部门ID筛选' },
            companyId: { type: 'integer', description: '公司ID筛选' },
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
      const parsed = listDeptQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const list = await findDepartments({
        pid: parsed.data.pid,
        companyId: parsed.data.companyId,
      })
      return reply.send(success({ list }))
    },
  )

  // GET /usercenter/departments/:id - 部门详情
  server.get(
    '/usercenter/departments/:id',
    {
      schema: {
        summary: '部门详情',
        tags: ['usercenter'],
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
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const department = await findDepartmentById(parsed.data.id)
      if (!department) {
        return reply.status(404).send(error(404, '部门不存在'))
      }
      return reply.send(success({ department }))
    },
  )

  // POST /usercenter/departments - 创建部门
  server.post(
    '/usercenter/departments',
    {
      schema: {
        summary: '创建部门',
        tags: ['usercenter'],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '部门名称' },
            pid: { type: 'string', format: 'uuid', description: '父部门ID' },
            companyId: { type: 'integer', description: '公司ID' },
            sort: { type: 'integer', description: '排序' },
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
      const parsed = createDeptSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const department = await createDepartment(parsed.data)
      return reply.status(201).send(success({ department }))
    },
  )

  // PUT /usercenter/departments/:id - 更新部门
  server.put(
    '/usercenter/departments/:id',
    {
      schema: {
        summary: '更新部门',
        tags: ['usercenter'],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            pid: { type: 'string', format: 'uuid' },
            companyId: { type: 'integer' },
            sort: { type: 'integer' },
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
    },
    async (request, reply) => {
      const idParsed = uuidParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updateDeptSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findDepartmentById(idParsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '部门不存在'))
      }
      const department = await updateDepartment(idParsed.data.id, parsed.data)
      return reply.send(success({ department }))
    },
  )

  // DELETE /usercenter/departments/:id - 删除部门
  server.delete(
    '/usercenter/departments/:id',
    {
      schema: {
        summary: '删除部门',
        tags: ['usercenter'],
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
    },
    async (request, reply) => {
      const parsed = uuidParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findDepartmentById(parsed.data.id)
      if (!existing) {
        return reply.status(404).send(error(404, '部门不存在'))
      }
      await deleteDepartment(parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    },
  )

  // ----- 统计 -----

  // GET /usercenter/statistics - 用户统计
  server.get(
    '/usercenter/statistics',
    {
      schema: {
        summary: '用户统计',
        tags: ['usercenter'],
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
    async (_request, reply) => {
      const statistics = await getUserStatistics()
      return reply.send(success({ statistics }))
    },
  )
}
