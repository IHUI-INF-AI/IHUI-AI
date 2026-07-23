import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import * as XLSX from 'xlsx'
import { checkAuth } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  findMembers,
  findUnauditedMembers,
  findMemberById,
  findMembersByIds,
  findAuthMembers,
  createMember,
  updateMember,
  setMemberStatus,
  resetMemberPassword,
  deleteMember,
  registerMember,
  registerMemberByMobile,
  findMemberCompanies,
  findMemberLevels,
  findMemberLevelById,
  createMemberLevel,
  updateMemberLevel,
  deleteMemberLevel,
  getMemberStatistics,
  findCompanies,
  findCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
  findDepartments,
  findDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  findUsersByDepartment,
  findSystemUserById,
  createSystemUser,
  updateSystemUser,
  resetSystemUserPassword,
  deleteSystemUser,
  MemberConflictError,
} from '../db/member-queries.js'
import { isSystemAdminUser } from '../db/queries.js'
import {
  findGroupList,
  findGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  findPostList,
  findPostById,
  createPost,
  updatePost,
  deletePost,
  findTagList,
  findTagById,
  createTag,
  updateTag,
  deleteTag,
  findTypeList,
  findCompanyTypeList,
  findCompanyTypeById,
  createCompanyType,
  updateCompanyType,
  deleteCompanyType,
  enableCompanyType,
  disableCompanyType,
} from '../db/member-extended-queries.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

/** 复用响应 schema：data 字段允许任意附加属性。 */
const R = {
  200: {
    type: 'object',
    properties: {
      code: { type: 'number' },
      message: { type: 'string' },
      data: { type: 'object', additionalProperties: true },
    },
  },
  201: {
    type: 'object',
    properties: {
      code: { type: 'number' },
      message: { type: 'string' },
      data: { type: 'object', additionalProperties: true },
    },
  },
  400: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
  401: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
  403: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
  404: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
  409: { type: 'object', properties: { code: { type: 'number' }, message: { type: 'string' } } },
}

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const listMembersQuery = z.object({
  ...paginationQuery,
  username: z.preprocess(emptyToUndefined, z.string().min(1).max(100).optional()),
  mobile: z.preprocess(emptyToUndefined, z.string().min(1).max(30).optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  levelId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
})

const authListQuery = z.object({
  ...paginationQuery,
  keyword: z.preprocess(emptyToUndefined, z.string().min(1).max(100).optional()),
})

const companyListQuery = z.object({
  ...paginationQuery,
  name: z.preprocess(emptyToUndefined, z.string().min(1).max(100).optional()),
})

const byIdsQuery = z.object({ ids: z.string().min(1, 'ids 不能为空') })

const byIdQuery = z.object({ id: z.string().uuid('无效的会员 ID') })

const registerSchema = z.object({
  username: z.string().min(1, '用户名不能为空').max(100),
  password: z.string().min(6, '密码至少 6 位'),
  nickname: z.string().max(100).nullable().optional(),
  mobile: z.string().max(30).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
})

const registerMobileSchema = z.object({
  mobile: z.string().min(1, '手机号不能为空'),
  password: z.string().min(6, '密码至少 6 位'),
  code: z.string().min(1, '验证码不能为空'),
  nickname: z.string().max(100).nullable().optional(),
})

const createMemberSchema = z.object({
  username: z.string().min(1, '用户名不能为空').max(100),
  password: z.string().min(1, '密码不能为空'),
  mobile: z.string().max(30).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  nickname: z.string().max(100).nullable().optional(),
  avatar: z.string().max(500).nullable().optional(),
  gender: z.number().int().min(0).max(2).optional(),
  levelId: z.string().uuid().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  status: z.number().int().min(0).max(2).optional(),
})

const updateMemberSchema = z.object({
  id: z.string().uuid('无效的会员 ID'),
  mobile: z.string().max(30).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  nickname: z.string().max(100).nullable().optional(),
  avatar: z.string().max(500).nullable().optional(),
  gender: z.number().int().min(0).max(2).optional(),
  levelId: z.string().uuid().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  growthValue: z.number().int().min(0).optional(),
})

const memberIdBodySchema = z.object({ id: z.string().uuid('无效的会员 ID') })

const resetPwdSchema = z.object({
  id: z.string().uuid('无效的会员 ID'),
  password: z.string().min(1, '密码不能为空'),
})

const createLevelSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  growthValue: z.number().int().min(0).optional(),
  discount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '折扣格式错误')
    .optional(),
  sort: z.number().int().min(0).optional(),
})

const updateLevelSchema = z.object({
  id: z.string().uuid('无效的等级 ID'),
  name: z.string().min(1).max(100).optional(),
  growthValue: z.number().int().min(0).optional(),
  discount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '折扣格式错误')
    .optional(),
  sort: z.number().int().min(0).optional(),
})

// ----- 企业 / 部门 -----

const companiesListQuery = z.object({
  ...paginationQuery,
  name: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(1).optional()),
})

const createCompanySchema = z.object({
  name: z.string().min(1, '名称不能为空').max(200),
  contactName: z.string().max(100).nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  remark: z.string().max(500).nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateCompanySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contactName: z.string().max(100).nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  remark: z.string().max(500).nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const departmentsListQuery = z.object({
  ...paginationQuery,
  companyId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  name: z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional()),
  status: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(1).optional()),
})

const createDepartmentSchema = z.object({
  companyId: z.string().uuid('无效的企业 ID'),
  name: z.string().min(1, '名称不能为空').max(200),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateDepartmentSchema = z.object({
  companyId: z.string().uuid().optional(),
  name: z.string().min(1).max(200).optional(),
  pid: z.string().uuid().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

// ----- 系统用户管理（users 表） -----

const createSystemUserSchema = z.object({
  phone: z.string().max(20).nullable().optional(),
  email: z.string().max(255).nullable().optional(),
  username: z.string().max(64).nullable().optional(),
  password: z.string().min(6, '密码至少 6 位'),
  nickname: z.string().max(64).nullable().optional(),
  avatar: z.string().max(500).nullable().optional(),
  gender: z.number().int().min(0).max(2).optional(),
  roleId: z.number().int().optional(),
  status: z.number().int().min(0).max(3).optional(),
  isVip: z.number().int().optional(),
})

const updateSystemUserSchema = z.object({
  phone: z.string().max(20).nullable().optional(),
  email: z.string().max(255).nullable().optional(),
  username: z.string().max(64).nullable().optional(),
  nickname: z.string().max(64).nullable().optional(),
  avatar: z.string().max(500).nullable().optional(),
  bio: z.string().nullable().optional(),
  gender: z.number().int().min(0).max(2).optional(),
  roleId: z.number().int().optional(),
  status: z.number().int().min(0).max(3).optional(),
  isVip: z.number().int().optional(),
})

const resetSystemUserPwdSchema = z.object({
  password: z.string().min(6, '密码至少 6 位'),
})

const deptUsersQuery = z.object({
  ...paginationQuery,
})

// ----- 分组 / 岗位 / 标签 / 类型 / 企业类型 -----

const simpleListQuery = z.object({
  ...paginationQuery,
  status: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  keyword: z.preprocess(emptyToUndefined, z.string().min(1).max(100).optional()),
})

const tagListQuery = z.object({
  ...paginationQuery,
  keyword: z.preprocess(emptyToUndefined, z.string().min(1).max(100).optional()),
})

const createGroupSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  description: z.string().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.string().max(20).optional(),
})

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.string().max(20).optional(),
})

const createPostSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  code: z.string().max(50).nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.string().max(20).optional(),
})

const updatePostSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(50).nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.string().max(20).optional(),
})

const createTagSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  color: z.string().max(20).nullable().optional(),
  sort: z.number().int().min(0).optional(),
})

const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(20).nullable().optional(),
  sort: z.number().int().min(0).optional(),
})

const createCompanyTypeSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  code: z.string().max(50).nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.string().max(20).optional(),
})

const updateCompanyTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(50).nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.string().max(20).optional(),
})

const batchUploadSchema = z.object({
  members: z.array(z.record(z.unknown())).min(0).max(1000),
})

// 会员批量导入结果项类型
interface ImportErrorItem {
  serialNum: number
  rowNum: number
  success: boolean
  message: string
  memberName?: string
  memberMobile?: string
}

// Excel 中文表头 -> 英文字段名映射（与 CSV 字段保持一致）
const HEADER_ALIASES: Record<string, string> = {
  用户名: 'username',
  密码: 'password',
  手机号: 'mobile',
  手机: 'mobile',
  电话: 'mobile',
  邮箱: 'email',
  昵称: 'nickname',
  姓名: 'nickname',
  性别: 'gender',
  状态: 'status',
  头像: 'avatar',
  等级ID: 'levelId',
  企业ID: 'companyId',
  部门ID: 'departmentId',
}

/**
 * 批量导入会员共用逻辑：逐条校验 + 调用 createMember。
 * members 每条记录可携带 serialNum/rowNum（缺省按 idx+1/idx+2 计算）。
 */
async function importMembers(
  members: Array<Record<string, unknown>>,
): Promise<{ imported: number; failed: number; errors: ImportErrorItem[] }> {
  let imported = 0
  const errors: ImportErrorItem[] = []
  for (const [idx, item] of members.entries()) {
    const serialNum = typeof item.serialNum === 'number' ? item.serialNum : idx + 1
    const rowNum = typeof item.rowNum === 'number' ? item.rowNum : idx + 2
    const memberName =
      item.nickname !== undefined && item.nickname !== null ? String(item.nickname) : undefined
    const memberMobile =
      item.mobile !== undefined && item.mobile !== null ? String(item.mobile) : undefined

    const username = String(item.username ?? '').trim()
    const password = String(item.password ?? '').trim()
    if (!username || !password) {
      errors.push({
        serialNum,
        rowNum,
        success: false,
        message: !username ? '用户名不能为空' : '密码不能为空',
        memberName,
        memberMobile,
      })
      continue
    }
    try {
      await createMember({
        username,
        password,
        mobile: item.mobile !== undefined && item.mobile !== null ? String(item.mobile) : null,
        email: item.email !== undefined && item.email !== null ? String(item.email) : null,
        nickname:
          item.nickname !== undefined && item.nickname !== null ? String(item.nickname) : null,
        avatar: item.avatar !== undefined && item.avatar !== null ? String(item.avatar) : null,
        gender: typeof item.gender === 'number' ? item.gender : undefined,
        levelId: item.levelId !== undefined && item.levelId !== null ? String(item.levelId) : null,
        companyId:
          item.companyId !== undefined && item.companyId !== null ? String(item.companyId) : null,
        departmentId:
          item.departmentId !== undefined && item.departmentId !== null
            ? String(item.departmentId)
            : null,
        status: typeof item.status === 'number' ? item.status : undefined,
      })
      imported += 1
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '创建失败'
      errors.push({ serialNum, rowNum, success: false, message: msg, memberName, memberMobile })
    }
  }
  return { imported, failed: errors.length, errors }
}

// =============================================================================
// 路由（前缀 /api）
// =============================================================================

export const memberRoutes: FastifyPluginAsync = async (server) => {
  // 公开注册端点（无需登录）
  server.post('/members/register', { schema: { response: R } }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const member = await registerMember(parsed.data)
      return reply.status(201).send(success({ id: member.id, username: member.username }))
    } catch (e) {
      if (e instanceof MemberConflictError) {
        return reply.status(409).send(error(409, e.message))
      }
      throw e
    }
  })

  server.post('/members/register/mobile', { schema: { response: R } }, async (request, reply) => {
    const parsed = registerMobileSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const member = await registerMemberByMobile({
        mobile: parsed.data.mobile,
        password: parsed.data.password,
        nickname: parsed.data.nickname,
      })
      return reply.status(201).send(success({ id: member.id, mobile: member.mobile }))
    } catch (e) {
      if (e instanceof MemberConflictError) {
        return reply.status(409).send(error(409, e.message))
      }
      throw e
    }
  })

  // 需登录端点
  server.register(async (authed) => {
    authed.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!(await checkAuth(request, reply))) return
    })

    // GET /members/by-id - 按 ID 查询会员
    authed.get('/members/by-id', { schema: { response: R } }, async (request, reply) => {
      const parsed = byIdQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const member = await findMemberById(parsed.data.id)
      if (!member) {
        return reply.status(404).send(error(404, '会员不存在'))
      }
      const { password: _pw, ...memberPublic } = member
      return reply.send(success({ member: memberPublic }))
    })

    // GET /members/by-ids - 批量按 ID 查询
    authed.get('/members/by-ids', { schema: { response: R } }, async (request, reply) => {
      const parsed = byIdsQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const ids = parsed.data.ids
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      const list = await findMembersByIds(ids)
      const publicList = list.map(({ password: _p, ...rest }) => rest)
      return reply.send(success({ list: publicList }))
    })

    // GET /members/auth-list - 登录用户列表（status=1）
    authed.get('/members/auth-list', { schema: { response: R } }, async (request, reply) => {
      const parsed = authListQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findAuthMembers(parsed.data)
      const list = result.list.map(({ password: _pw, ...rest }) => rest)
      return reply.send(success({ ...result, list }))
    })
  })
}

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminMemberRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ----- 会员管理 -----

  // GET /members - 会员列表
  server.get('/members', { schema: { response: R } }, async (request, reply) => {
    const parsed = listMembersQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findMembers(parsed.data)
    // 剥离密码字段，避免哈希泄漏到客户端
    const list = result.list.map(({ password: _pw, ...rest }) => rest)
    return reply.send(success({ ...result, list }))
  })

  // GET /members/unaudited - 待审核列表
  server.get('/members/unaudited', { schema: { response: R } }, async (request, reply) => {
    const parsed = z.object(paginationQuery).safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findUnauditedMembers(parsed.data)
    const list = result.list.map(({ password: _pw, ...rest }) => rest)
    return reply.send(success({ ...result, list }))
  })

  // GET /members/statistics - 会员统计
  server.get('/members/statistics', { schema: { response: R } }, async (_request, reply) => {
    const statistics = await getMemberStatistics()
    return reply.send(success({ statistics }))
  })

  // GET /members/companies - 会员企业列表
  server.get('/members/companies', { schema: { response: R } }, async (request, reply) => {
    const parsed = companyListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findMemberCompanies(parsed.data)
    return reply.send(success(result))
  })

  // POST /members - 创建会员
  server.post('/members', { schema: { response: R } }, async (request, reply) => {
    const parsed = createMemberSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const member = await createMember(parsed.data)
      return reply.status(201).send(success({ id: member.id }))
    } catch (e) {
      if (e instanceof MemberConflictError) {
        return reply.status(409).send(error(409, e.message))
      }
      throw e
    }
  })

  // PUT /members - 更新会员
  server.put('/members', { schema: { response: R } }, async (request, reply) => {
    const parsed = updateMemberSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findMemberById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '会员不存在'))
    }
    await updateMember(parsed.data.id, parsed.data)
    return reply.send(success({ id: parsed.data.id }))
  })

  // PUT /members/seal - 封禁
  server.put('/members/seal', { schema: { response: R } }, async (request, reply) => {
    const parsed = memberIdBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const member = await setMemberStatus(parsed.data.id, 2)
    if (!member) {
      return reply.status(404).send(error(404, '会员不存在'))
    }
    return reply.send(success({ id: member.id, status: member.status }))
  })

  // PUT /members/unseal - 解封
  server.put('/members/unseal', { schema: { response: R } }, async (request, reply) => {
    const parsed = memberIdBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const member = await setMemberStatus(parsed.data.id, 1)
    if (!member) {
      return reply.status(404).send(error(404, '会员不存在'))
    }
    return reply.send(success({ id: member.id, status: member.status }))
  })

  // PUT /members/approved - 审核通过
  server.put('/members/approved', { schema: { response: R } }, async (request, reply) => {
    const parsed = memberIdBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const member = await setMemberStatus(parsed.data.id, 1)
    if (!member) {
      return reply.status(404).send(error(404, '会员不存在'))
    }
    return reply.send(success({ id: member.id, status: member.status }))
  })

  // PUT /members/reject - 审核拒绝
  server.put('/members/reject', { schema: { response: R } }, async (request, reply) => {
    const parsed = memberIdBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const member = await setMemberStatus(parsed.data.id, 0)
    if (!member) {
      return reply.status(404).send(error(404, '会员不存在'))
    }
    return reply.send(success({ id: member.id, status: member.status }))
  })

  // PUT /members/pwd/reset - 重置密码
  server.put('/members/pwd/reset', { schema: { response: R } }, async (request, reply) => {
    const parsed = resetPwdSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findMemberById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '会员不存在'))
    }
    await resetMemberPassword(parsed.data.id, parsed.data.password)
    return reply.send(success({ id: parsed.data.id }))
  })

  // DELETE /members - 删除会员
  server.delete('/members', { schema: { response: R } }, async (request, reply) => {
    const parsed = byIdQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findMemberById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '会员不存在'))
    }
    await deleteMember(parsed.data.id)
    return reply.send(success({ id: parsed.data.id }))
  })

  // ----- 会员等级 -----

  // GET /members/levels - 等级列表
  server.get('/members/levels', { schema: { response: R } }, async (_request, reply) => {
    const list = await findMemberLevels()
    return reply.send(success({ list }))
  })

  // GET /members/levels/:id - 等级详情
  server.get('/members/levels/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const level = await findMemberLevelById(parsed.data.id)
    if (!level) {
      return reply.status(404).send(error(404, '等级不存在'))
    }
    return reply.send(success({ level }))
  })

  // POST /members/levels - 创建等级
  server.post('/members/levels', { schema: { response: R } }, async (request, reply) => {
    const parsed = createLevelSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const level = await createMemberLevel(parsed.data)
    return reply.status(201).send(success({ id: level.id }))
  })

  // PUT /members/levels - 更新等级
  server.put('/members/levels', { schema: { response: R } }, async (request, reply) => {
    const parsed = updateLevelSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findMemberLevelById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '等级不存在'))
    }
    await updateMemberLevel(parsed.data.id, parsed.data)
    return reply.send(success({ id: parsed.data.id }))
  })

  // DELETE /members/levels - 删除等级
  server.delete('/members/levels', { schema: { response: R } }, async (request, reply) => {
    const parsed = byIdQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findMemberLevelById(parsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '等级不存在'))
    }
    await deleteMemberLevel(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- 企业管理 -----

  // GET /members/companies/list - 企业列表(分页,支持名称搜索 + 状态筛选)
  server.get('/members/companies/list', { schema: { response: R } }, async (request, reply) => {
    const parsed = companiesListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findCompanies(parsed.data)
    return reply.send(success(result))
  })

  // GET /members/companies/:id - 企业详情
  server.get('/members/companies/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const company = await findCompanyById(parsed.data.id)
    if (!company) return reply.status(404).send(error(404, '企业不存在'))
    return reply.send(success({ company }))
  })

  // POST /members/companies - 创建企业
  server.post('/members/companies', { schema: { response: R } }, async (request, reply) => {
    const parsed = createCompanySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const company = await createCompany(parsed.data)
    return reply.status(201).send(success({ id: company.id }))
  })

  // PUT /members/companies/:id - 更新企业
  server.put('/members/companies/:id', { schema: { response: R } }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateCompanySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findCompanyById(idParsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '企业不存在'))
    await updateCompany(idParsed.data.id, parsed.data)
    return reply.send(success({ id: idParsed.data.id }))
  })

  // DELETE /members/companies/:id - 删除企业
  server.delete('/members/companies/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findCompanyById(parsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '企业不存在'))
    await deleteCompany(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- 部门管理 -----

  // GET /members/departments - 部门列表(分页,支持企业/名称/状态筛选)
  server.get('/members/departments', { schema: { response: R } }, async (request, reply) => {
    const parsed = departmentsListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findDepartments(parsed.data)
    return reply.send(success(result))
  })

  // GET /members/departments/:id - 部门详情
  server.get('/members/departments/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const department = await findDepartmentById(parsed.data.id)
    if (!department) return reply.status(404).send(error(404, '部门不存在'))
    return reply.send(success({ department }))
  })

  // POST /members/departments - 创建部门
  server.post('/members/departments', { schema: { response: R } }, async (request, reply) => {
    const parsed = createDepartmentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const company = await findCompanyById(parsed.data.companyId)
    if (!company) return reply.status(404).send(error(404, '企业不存在'))
    const department = await createDepartment(parsed.data)
    return reply.status(201).send(success({ id: department.id }))
  })

  // PUT /members/departments/:id - 更新部门
  server.put('/members/departments/:id', { schema: { response: R } }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateDepartmentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findDepartmentById(idParsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '部门不存在'))
    await updateDepartment(idParsed.data.id, parsed.data)
    return reply.send(success({ id: idParsed.data.id }))
  })

  // DELETE /members/departments/:id - 删除部门
  server.delete('/members/departments/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findDepartmentById(parsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '部门不存在'))
    await deleteDepartment(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- 会员分组 -----

  // GET /members/groups - 分组列表
  server.get('/members/groups', { schema: { response: R } }, async (request, reply) => {
    const parsed = simpleListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findGroupList(parsed.data)
    return reply.send(success(result))
  })

  // POST /members/groups - 创建分组
  server.post('/members/groups', { schema: { response: R } }, async (request, reply) => {
    const parsed = createGroupSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const group = await createGroup(parsed.data)
    return reply.status(201).send(success({ id: group?.id }))
  })

  // PUT /members/groups/:id - 更新分组
  server.put('/members/groups/:id', { schema: { response: R } }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateGroupSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findGroupById(idParsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '分组不存在'))
    await updateGroup(idParsed.data.id, parsed.data)
    return reply.send(success({ id: idParsed.data.id }))
  })

  // DELETE /members/groups/:id - 删除分组
  server.delete('/members/groups/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findGroupById(parsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '分组不存在'))
    await deleteGroup(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- 会员岗位 -----

  // GET /members/posts - 岗位列表
  server.get('/members/posts', { schema: { response: R } }, async (request, reply) => {
    const parsed = simpleListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findPostList(parsed.data)
    return reply.send(success(result))
  })

  // POST /members/posts - 创建岗位
  server.post('/members/posts', { schema: { response: R } }, async (request, reply) => {
    const parsed = createPostSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const post = await createPost(parsed.data)
    return reply.status(201).send(success({ id: post?.id }))
  })

  // PUT /members/posts/:id - 更新岗位
  server.put('/members/posts/:id', { schema: { response: R } }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updatePostSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findPostById(idParsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '岗位不存在'))
    await updatePost(idParsed.data.id, parsed.data)
    return reply.send(success({ id: idParsed.data.id }))
  })

  // DELETE /members/posts/:id - 删除岗位
  server.delete('/members/posts/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findPostById(parsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '岗位不存在'))
    await deletePost(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- 会员标签 -----

  // GET /members/tags - 标签列表
  server.get('/members/tags', { schema: { response: R } }, async (request, reply) => {
    const parsed = tagListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findTagList(parsed.data)
    return reply.send(success(result))
  })

  // POST /members/tags - 创建标签
  server.post('/members/tags', { schema: { response: R } }, async (request, reply) => {
    const parsed = createTagSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const tag = await createTag(parsed.data)
    return reply.status(201).send(success({ id: tag?.id }))
  })

  // PUT /members/tags/:id - 更新标签
  server.put('/members/tags/:id', { schema: { response: R } }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateTagSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findTagById(idParsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '标签不存在'))
    await updateTag(idParsed.data.id, parsed.data)
    return reply.send(success({ id: idParsed.data.id }))
  })

  // DELETE /members/tags/:id - 删除标签
  server.delete('/members/tags/:id', { schema: { response: R } }, async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findTagById(parsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '标签不存在'))
    await deleteTag(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- 会员类型 -----

  // GET /members/types - 类型列表
  server.get('/members/types', { schema: { response: R } }, async (request, reply) => {
    const parsed = simpleListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findTypeList(parsed.data)
    return reply.send(success(result))
  })

  // ----- 企业类型 -----

  // GET /members/company-types - 企业类型列表
  server.get('/members/company-types', { schema: { response: R } }, async (request, reply) => {
    const parsed = simpleListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findCompanyTypeList(parsed.data)
    return reply.send(success(result))
  })

  // POST /members/company-types - 创建企业类型
  server.post('/members/company-types', { schema: { response: R } }, async (request, reply) => {
    const parsed = createCompanyTypeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const companyType = await createCompanyType(parsed.data)
    return reply.status(201).send(success({ id: companyType?.id }))
  })

  // PUT /members/company-types/:id - 更新企业类型
  server.put('/members/company-types/:id', { schema: { response: R } }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateCompanyTypeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findCompanyTypeById(idParsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '企业类型不存在'))
    await updateCompanyType(idParsed.data.id, parsed.data)
    return reply.send(success({ id: idParsed.data.id }))
  })

  // DELETE /members/company-types/:id - 删除企业类型
  server.delete(
    '/members/company-types/:id',
    { schema: { response: R } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findCompanyTypeById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '企业类型不存在'))
      await deleteCompanyType(parsed.data.id)
      return reply.send(success({ ok: true }))
    },
  )

  // PUT /members/company-types/:id/enable - 启用企业类型
  server.put(
    '/members/company-types/:id/enable',
    { schema: { response: R } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findCompanyTypeById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '企业类型不存在'))
      const updated = await enableCompanyType(parsed.data.id)
      return reply.send(success({ id: updated?.id, status: updated?.status }))
    },
  )

  // PUT /members/company-types/:id/disable - 禁用企业类型
  server.put(
    '/members/company-types/:id/disable',
    { schema: { response: R } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findCompanyTypeById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '企业类型不存在'))
      const updated = await disableCompanyType(parsed.data.id)
      return reply.send(success({ id: updated?.id, status: updated?.status }))
    },
  )

  // ----- 企业启用/禁用 -----

  // PUT /members/companies/:id/enable - 启用企业
  server.put(
    '/members/companies/:id/enable',
    { schema: { response: R } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findCompanyById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '企业不存在'))
      const updated = await updateCompany(parsed.data.id, { status: 1 })
      return reply.send(success({ id: updated?.id, status: updated?.status }))
    },
  )

  // PUT /members/companies/:id/disable - 禁用企业
  server.put(
    '/members/companies/:id/disable',
    { schema: { response: R } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await findCompanyById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '企业不存在'))
      const updated = await updateCompany(parsed.data.id, { status: 0 })
      return reply.send(success({ id: updated?.id, status: updated?.status }))
    },
  )

  // ----- 批量上传 -----

  // POST /members/batch-upload - 批量上传会员（JSON 数组）
  // 返回 ImportResult { imported, failed, errors: ImportResultItem[] }
  server.post('/members/batch-upload', { schema: { response: R } }, async (request, reply) => {
    const parsed = batchUploadSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await importMembers(parsed.data.members)
    return reply.send(success(result))
  })

  // POST /members/import/excel - 通过 Excel (.xlsx/.xls) 文件批量导入会员
  // multipart/form-data 字段：file（必填，Excel 二进制）
  // 表头支持英文键名（与 CSV 一致）或中文别名（详见 HEADER_ALIASES）
  // 返回 { imported, failed, errors: ImportResultItem[] }
  server.post('/members/import/excel', { schema: { response: R } }, async (request, reply) => {
    if (!request.isMultipart()) {
      return reply.status(400).send(error(400, '请求必须是 multipart/form-data'))
    }
    const data = await request.file()
    if (!data) {
      return reply.status(400).send(error(400, '未找到上传文件'))
    }
    const buffer = await data.toBuffer()
    if (buffer.length === 0) {
      return reply.status(400).send(error(400, '文件内容为空'))
    }

    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    } catch {
      return reply.status(400).send(error(400, 'Excel 文件解析失败'))
    }
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      return reply.status(400).send(error(400, 'Excel 文件无有效工作表'))
    }
    const firstSheet = workbook.Sheets[firstSheetName]
    if (!firstSheet) {
      return reply.status(400).send(error(400, 'Excel 文件无有效工作表'))
    }

    // 以第一行作为表头解析为对象数组，空单元格填充空字符串
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
      defval: '',
      raw: false,
    })

    // 表头映射 + 数值字段转换 + 注入 serialNum/rowNum
    const members: Array<Record<string, unknown>> = rows.map((row, idx) => {
      const mapped: Record<string, unknown> = { serialNum: idx + 1, rowNum: idx + 2 }
      for (const [k, v] of Object.entries(row)) {
        const key = HEADER_ALIASES[k] ?? k
        if (key === 'gender' || key === 'status') {
          const n = Number(v)
          mapped[key] = Number.isFinite(n) && v !== '' ? n : undefined
        } else {
          mapped[key] = v
        }
      }
      return mapped
    })

    const result = await importMembers(members)
    return reply.send(success(result))
  })

  // POST /members/batch-import - 统一批量导入会员（CSV 或 Excel,multipart/form-data,字段 file）
  // 根据文件扩展名自动选择解析方式：.csv → 文本解析;.xlsx/.xls → XLSX 解析
  // 表头支持英文键名（与 CSV 一致）或中文别名（详见 HEADER_ALIASES）
  // 返回 { imported, failed, errors: ImportResultItem[] }
  server.post('/members/batch-import', { schema: { response: R } }, async (request, reply) => {
    if (!request.isMultipart()) {
      return reply.status(400).send(error(400, '请求必须是 multipart/form-data'))
    }
    const data = await request.file()
    if (!data) {
      return reply.status(400).send(error(400, '未找到上传文件'))
    }
    const buffer = await data.toBuffer()
    if (buffer.length === 0) {
      return reply.status(400).send(error(400, '文件内容为空'))
    }
    const filename = (data.filename || '').toLowerCase()

    let members: Array<Record<string, unknown>> = []

    if (filename.endsWith('.csv')) {
      const text = buffer.toString('utf-8')
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
      const headerLine = lines[0]
      if (!headerLine || lines.length < 2) {
        return reply.send(success({ imported: 0, failed: 0, errors: [] }))
      }
      const headers = headerLine.split(',').map((h) => h.trim())
      members = lines.slice(1).map((line, idx) => {
        const values = line.split(',')
        const row: Record<string, unknown> = { serialNum: idx + 1, rowNum: idx + 2 }
        headers.forEach((h, i) => {
          const key = HEADER_ALIASES[h] ?? h
          const v = values[i]?.trim() ?? ''
          if (key === 'gender' || key === 'status') {
            const n = Number(v)
            row[key] = v !== '' && Number.isFinite(n) ? n : undefined
          } else {
            row[key] = v
          }
        })
        return row
      })
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      let workbook: XLSX.WorkBook
      try {
        workbook = XLSX.read(buffer, { type: 'buffer' })
      } catch {
        return reply.status(400).send(error(400, 'Excel 文件解析失败'))
      }
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        return reply.status(400).send(error(400, 'Excel 文件无有效工作表'))
      }
      const firstSheet = workbook.Sheets[firstSheetName]
      if (!firstSheet) {
        return reply.status(400).send(error(400, 'Excel 文件无有效工作表'))
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
        defval: '',
        raw: false,
      })
      members = rows.map((row, idx) => {
        const mapped: Record<string, unknown> = { serialNum: idx + 1, rowNum: idx + 2 }
        for (const [k, v] of Object.entries(row)) {
          const key = HEADER_ALIASES[k] ?? k
          if (key === 'gender' || key === 'status') {
            const n = Number(v)
            mapped[key] = Number.isFinite(n) && v !== '' ? n : undefined
          } else {
            mapped[key] = v
          }
        }
        return mapped
      })
    } else {
      return reply.status(400).send(error(400, '不支持的文件类型,仅接受 .csv / .xlsx / .xls'))
    }

    const result = await importMembers(members)
    return reply.send(success(result))
  })

  // ----- 系统用户管理（users 表） -----

  // GET /members/departments/:id/users - 部门下用户列表
  server.get(
    '/members/departments/:id/users',
    { schema: { response: R } },
    async (request, reply) => {
      const idParsed = idParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = deptUsersQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const result = await findUsersByDepartment(idParsed.data.id, parsed.data)
      // 剥离密码哈希
      const list = result.list.map(({ passwordHash: _pw, ...rest }) => rest)
      return reply.send(success({ ...result, list }))
    },
  )

  // POST /members/users - 创建用户
  server.post('/members/users', { schema: { response: R } }, async (request, reply) => {
    const parsed = createSystemUserSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 10)
    const user = await createSystemUser({
      phone: parsed.data.phone ?? undefined,
      email: parsed.data.email ?? undefined,
      username: parsed.data.username ?? undefined,
      passwordHash,
      nickname: parsed.data.nickname ?? undefined,
      avatar: parsed.data.avatar ?? undefined,
      gender: parsed.data.gender,
      roleId: parsed.data.roleId,
      status: parsed.data.status,
      isVip: parsed.data.isVip,
    })
    return reply.status(201).send(success({ id: user.id }))
  })

  // PUT /members/users/:id - 更新用户
  server.put('/members/users/:id', { schema: { response: R } }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (await isSystemAdminUser(idParsed.data.id)) {
      return reply.status(403).send(error(403, '系统内置管理员不可修改'))
    }
    const parsed = updateSystemUserSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findSystemUserById(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '用户不存在'))
    }
    await updateSystemUser(idParsed.data.id, parsed.data)
    return reply.send(success({ id: idParsed.data.id }))
  })

  // PUT /members/users/:id/pwd - 重置密码
  server.put('/members/users/:id/pwd', { schema: { response: R } }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (await isSystemAdminUser(idParsed.data.id)) {
      return reply.status(403).send(error(403, '系统内置管理员不可修改密码'))
    }
    const parsed = resetSystemUserPwdSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findSystemUserById(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '用户不存在'))
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 10)
    await resetSystemUserPassword(idParsed.data.id, passwordHash)
    return reply.send(success({ id: idParsed.data.id }))
  })

  // DELETE /members/users/:id - 删除用户
  server.delete('/members/users/:id', { schema: { response: R } }, async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    if (await isSystemAdminUser(idParsed.data.id)) {
      return reply.status(403).send(error(403, '系统内置管理员不可删除'))
    }
    const existing = await findSystemUserById(idParsed.data.id)
    if (!existing) {
      return reply.status(404).send(error(404, '用户不存在'))
    }
    await deleteSystemUser(idParsed.data.id)
    return reply.send(success({ id: idParsed.data.id }))
  })
}
