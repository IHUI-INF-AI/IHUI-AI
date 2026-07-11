import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth, requireAdmin } from '../plugins/require-permission.js'
import {
  createRole,
  findRoles,
  findRoleById,
  findRoleByName,
  updateRole,
  deleteRole,
  findPermissions,
  findPermissionById,
  findPermissionByName,
  createPermission,
  updatePermission,
  deletePermission,
  findRolePermissions,
  addRolePermissions,
  removeRolePermission,
  findUserRoles,
  addUserRole,
  removeUserRole,
  checkPermission,
} from '../db/rbac-queries.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const scopeSchema = z.enum(['none', 'self', 'team', 'org', 'all'])

const idParamSchema = z.object({
  id: z.string().uuid('无效的 ID'),
})

const createRoleBodySchema = z.object({
  name: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(128),
  description: z.string().max(1000).optional(),
  scope: scopeSchema.default('self'),
})

const updateRoleBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(128).optional(),
    description: z.string().max(1000).optional(),
    scope: scopeSchema.optional(),
  })
  .refine(
    (d) => d.displayName !== undefined || d.description !== undefined || d.scope !== undefined,
    {
      message: '至少需提供一个字段',
    },
  )

const addRolePermissionsBodySchema = z.object({
  permissionIds: z.array(z.string().uuid()).min(1).max(100),
})

const roleIdParamSchema = z.object({
  id: z.string().uuid('无效的角色 ID'),
  roleId: z.string().uuid('无效的角色 ID'),
})

const rolePermissionParamSchema = z.object({
  id: z.string().uuid('无效的角色 ID'),
  permissionId: z.string().uuid('无效的权限 ID'),
})

const assignUserRoleBodySchema = z.object({
  roleId: z.string().uuid('无效的角色 ID'),
  scopeResourceId: z.string().max(128).optional(),
})

const permissionCheckQuerySchema = z.object({
  userId: z.string().uuid('无效的用户 ID'),
  permission: z.string().trim().min(1).max(128),
  resource: z.string().trim().min(1).max(64).optional(),
})

const createPermissionBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9:_-]+$/, '权限名只能包含小写字母、数字、冒号、下划线和连字符'),
  displayName: z.string().trim().min(1).max(128),
  resource: z.string().trim().min(1).max(64),
  action: z.string().trim().min(1).max(64),
  description: z.string().max(1000).optional(),
})

const updatePermissionBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(128).optional(),
    description: z.string().max(1000).optional(),
  })
  .refine((d) => d.displayName !== undefined || d.description !== undefined, {
    message: '至少需提供一个字段',
  })

// =============================================================================
// 路由
// =============================================================================

export const rbacRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // Roles
  // -------------------------------------------------------------------------

  // GET /roles - 角色列表（需登录）
  server.get(
    '/roles',
    {
      preHandler: requireAuth,
      schema: {
        summary: '角色列表',
        description: '获取所有角色列表(需登录)',
        tags: ['rbac'],
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
    },
    async (_request, reply) => {
      const list = await findRoles()
      return reply.send(success({ list }))
    },
  )

  // POST /roles - 创建角色（需 admin）
  server.post(
    '/roles',
    {
      preHandler: requireAdmin,
      schema: {
        summary: '创建角色',
        description: '创建新角色(需 admin)',
        tags: ['rbac'],
        body: {
          type: 'object',
          required: ['name', 'displayName'],
          properties: {
            name: { type: 'string', maxLength: 64, description: '角色名(唯一)' },
            displayName: { type: 'string', maxLength: 128, description: '显示名称' },
            description: { type: 'string', maxLength: 1000, description: '描述(可选)' },
            scope: {
              type: 'string',
              enum: ['none', 'self', 'team', 'org', 'all'],
              default: 'self',
              description: '作用域(默认 self)',
            },
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
          403: {
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
      const parsed = createRoleBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { name, displayName, description, scope } = parsed.data
      const exists = await findRoleByName(name)
      if (exists) {
        return reply.status(409).send(error(409, '角色名已存在'))
      }
      const role = await createRole({ name, displayName, description, scope })
      return reply.status(201).send(success({ role }))
    },
  )

  // GET /roles/:id - 角色详情（含权限列表）
  server.get('/roles/:id', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const role = await findRoleById(parsed.data.id)
    if (!role) {
      return reply.status(404).send(error(404, '角色不存在'))
    }
    const permissions = await findRolePermissions(parsed.data.id)
    return reply.send(success({ role, permissions }))
  })

  // PATCH /roles/:id - 更新角色（需 admin，非 system 才能改）
  server.patch('/roles/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsedBody = updateRoleBodySchema.safeParse(request.body)
    if (!parsedBody.success) {
      return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findRoleById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '角色不存在'))
    }
    if (existing.isSystem) {
      return reply.status(403).send(error(403, '系统内置角色不可修改'))
    }
    const role = await updateRole(parsed.data.id, parsedBody.data)
    return reply.send(success({ role }))
  })

  // DELETE /roles/:id - 删除角色（需 admin，非 system 才能删）
  server.delete('/roles/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findRoleById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '角色不存在'))
    }
    if (existing.isSystem) {
      return reply.status(403).send(error(403, '系统内置角色不可删除'))
    }
    await deleteRole(parsed.data.id)
    return reply.send(success({ id: parsed.data.id }))
  })

  // POST /roles/:id/permissions - 给角色赋权限（需 admin）
  server.post(
    '/roles/:id/permissions',
    {
      preHandler: requireAdmin,
      schema: {
        summary: '给角色赋权限',
        description: '为指定角色批量赋予权限点(需 admin)',
        tags: ['rbac'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: '角色 ID' },
          },
        },
        body: {
          type: 'object',
          required: ['permissionIds'],
          properties: {
            permissionIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              minItems: 1,
              maxItems: 100,
              description: '权限 ID 列表',
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
      const parsedBody = addRolePermissionsBodySchema.safeParse(request.body)
      if (!parsedBody.success) {
        return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'))
      }
      const role = await findRoleById(parsedParams.data.id)
      if (!role) {
        return reply.status(404).send(error(404, '角色不存在'))
      }
      // 校验权限点存在性
      const validPerms = await Promise.all(
        parsedBody.data.permissionIds.map((pid) => findPermissionById(pid)),
      )
      if (validPerms.some((p) => !p)) {
        return reply.status(404).send(error(404, '存在未知的权限 ID'))
      }
      await addRolePermissions(parsedParams.data.id, parsedBody.data.permissionIds)
      const permissions = await findRolePermissions(parsedParams.data.id)
      return reply.send(success({ permissions }))
    },
  )

  // DELETE /roles/:id/permissions/:permissionId - 移除角色权限（需 admin）
  server.delete(
    '/roles/:id/permissions/:permissionId',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsed = rolePermissionParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const role = await findRoleById(parsed.data.id)
      if (!role) {
        return reply.status(404).send(error(404, '角色不存在'))
      }
      const perm = await findPermissionById(parsed.data.permissionId)
      if (!perm) {
        return reply.status(404).send(error(404, '权限点不存在'))
      }
      await removeRolePermission(parsed.data.id, parsed.data.permissionId)
      return reply.send(success({ roleId: parsed.data.id, permissionId: parsed.data.permissionId }))
    },
  )

  // -------------------------------------------------------------------------
  // Permissions
  // -------------------------------------------------------------------------

  // GET /permissions - 所有权限点列表（需登录）
  server.get(
    '/permissions',
    {
      preHandler: requireAuth,
      schema: {
        summary: '权限点列表',
        description: '获取所有权限点列表(需登录)',
        tags: ['rbac'],
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
    },
    async (_request, reply) => {
      const list = await findPermissions()
      return reply.send(success({ list }))
    },
  )

  // POST /permissions - 创建权限点（需 admin）
  server.post(
    '/permissions',
    {
      preHandler: requireAdmin,
      schema: {
        summary: '创建权限点',
        description: '创建新的权限点(需 admin)',
        tags: ['rbac'],
        body: {
          type: 'object',
          required: ['name', 'displayName', 'resource', 'action'],
          properties: {
            name: {
              type: 'string',
              maxLength: 128,
              description: '权限名(唯一,格式 resource:action)',
            },
            displayName: { type: 'string', maxLength: 128, description: '显示名称' },
            resource: { type: 'string', maxLength: 64, description: '资源类型' },
            action: { type: 'string', maxLength: 64, description: '操作类型' },
            description: { type: 'string', maxLength: 1000, description: '描述(可选)' },
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
          403: {
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
      const parsed = createPermissionBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { name, displayName, resource, action, description } = parsed.data
      const exists = await findPermissionByName(name)
      if (exists) {
        return reply.status(409).send(error(409, '权限名已存在'))
      }
      const permission = await createPermission({
        name,
        displayName,
        resource,
        action,
        description,
      })
      return reply.status(201).send(success({ permission }))
    },
  )

  // GET /permissions/:id - 权限点详情（需登录）
  server.get('/permissions/:id', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const permission = await findPermissionById(parsed.data.id)
    if (!permission) {
      return reply.status(404).send(error(404, '权限点不存在'))
    }
    return reply.send(success({ permission }))
  })

  // PATCH /permissions/:id - 更新权限点（需 admin）
  server.patch('/permissions/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsedBody = updatePermissionBodySchema.safeParse(request.body)
    if (!parsedBody.success) {
      return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findPermissionById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '权限点不存在'))
    }
    const permission = await updatePermission(parsed.data.id, parsedBody.data)
    return reply.send(success({ permission }))
  })

  // DELETE /permissions/:id - 删除权限点（需 admin）
  server.delete('/permissions/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findPermissionById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '权限点不存在'))
    }
    await deletePermission(parsed.data.id)
    return reply.send(success({ id: parsed.data.id }))
  })

  // -------------------------------------------------------------------------
  // User <-> Roles
  // -------------------------------------------------------------------------

  // GET /users/:id/roles - 用户角色列表（需登录，仅本人或 admin）
  server.get('/users/:id/roles', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 仅本人或 admin 可查
    const isSelf = request.userId === parsed.data.id
    const isAdmin = (request.jwtPayload?.roleId ?? 0) >= 1
    if (!isSelf && !isAdmin) {
      return reply.status(403).send(error(403, '无权查看他人角色'))
    }
    const list = await findUserRoles(parsed.data.id)
    return reply.send(success({ list }))
  })

  // POST /users/:id/roles - 给用户赋角色（需 admin）
  server.post('/users/:id/roles', { preHandler: requireAdmin }, async (request, reply) => {
    const parsedParams = idParamSchema.safeParse(request.params)
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
    }
    const parsedBody = assignUserRoleBodySchema.safeParse(request.body)
    if (!parsedBody.success) {
      return reply.status(400).send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'))
    }
    const role = await findRoleById(parsedBody.data.roleId)
    if (!role) {
      return reply.status(404).send(error(404, '角色不存在'))
    }
    const userRole = await addUserRole(
      parsedParams.data.id,
      parsedBody.data.roleId,
      parsedBody.data.scopeResourceId,
    )
    if (!userRole) {
      return reply.status(409).send(error(409, '用户已拥有该角色'))
    }
    return reply.status(201).send(success({ userRole }))
  })

  // DELETE /users/:id/roles/:roleId - 移除用户角色（需 admin）
  server.delete(
    '/users/:id/roles/:roleId',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsed = roleIdParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      await removeUserRole(parsed.data.id, parsed.data.roleId)
      return reply.send(success({ userId: parsed.data.id, roleId: parsed.data.roleId }))
    },
  )

  // -------------------------------------------------------------------------
  // Admin RBAC check
  // -------------------------------------------------------------------------

  // GET /admin/rbac/check - 检查用户对某资源的权限（需 admin）
  // 通过 user_roles → role_permissions → permissions JOIN 判定。
  server.get('/admin/rbac/check', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = permissionCheckQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { userId, permission, resource } = parsed.data
    // permission 名约定为 'resource:action'，已隐含资源；resource 仅用于审计上下文。
    const hasPermission = await checkPermission(userId, permission)
    return reply.send(success({ userId, permission, resource, hasPermission }))
  })
}
