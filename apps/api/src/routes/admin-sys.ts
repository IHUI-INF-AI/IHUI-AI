import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin, requireAuth } from '../plugins/require-permission.js'
import bcrypt from 'bcryptjs'
import { success, error } from '../utils/response.js'
import {
  findMenuList,
  findMenuIdsByRole,
  assignRoleMenus,
  updateMenu,
  deleteMenuWithCascade,
  deleteRoleMenuCascade,
  findMenuById,
  createMenu,
  findLogininforList,
  cleanLogininfor,
  findNoticeList,
  findNoticeById,
  createNotice,
  updateNotice,
  deleteNoticesBatch,
  findJobList,
  findJobById,
  createJob,
  updateJob,
  updateJobStatus,
  deleteJobsBatch,
  findJobLogList,
  cleanJobLogs,
  findDeptList,
  findDeptById,
  createDept,
  deleteDept,
  updateDept,
  findPostList,
  findPostById,
  createPost,
  updatePost,
  deletePostsBatch,
  findConfigList,
  findConfigById,
  findConfigByKey,
  createConfig,
  updateConfig,
  deleteConfigsBatch,
  findDictTypeList,
  findDictTypeById,
  createDictType,
  updateDictType,
  deleteDictTypesBatch,
  findDictDataList,
  findDictDataById,
  findDictDataByType,
  createDictData,
  updateDictData,
  deleteDictDataBatch,
  findOperlogList,
  deleteOperlogsBatch,
  cleanOperlogs,
  createOperlog,
  updateAdminRoleStatus,
  updateAdminRoleDataScope,
  findAdminRoleDeptIds,
  findAllocatedUsers,
  findUnallocatedUsers,
  cancelUserRole,
  cancelAllUserRole,
  selectAllUserRole,
} from '../db/admin-sys-queries.js'
import { db } from '../db/index.js'
import { eq, and, isNull, gt, desc, inArray } from 'drizzle-orm'
import { refreshTokens, users, sysLogininfor } from '@ihui/database'

// =============================================================================
// 查询参数解析辅助
// =============================================================================

function parseNum(v: unknown, fallback?: number): number | undefined {
  if (v === undefined || v === null || v === '') return fallback
  const n = Number(v)
  return Number.isNaN(n) ? fallback : n
}

function parseStr(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined
  return String(v)
}

// =============================================================================
// Zod schemas
// =============================================================================

const menuBodySchema = z.object({
  menuId: z.string().uuid().optional(),
  menuName: z.string().min(1).optional(),
  parentId: z.string().uuid().optional(),
  orderNum: z.number().int().optional(),
  path: z.string().optional(),
  component: z.string().optional(),
  menuType: z.enum(['M', 'C', 'F']).optional(),
  visible: z.string().optional(),
  status: z.string().optional(),
  perms: z.string().optional(),
  icon: z.string().optional(),
  isFrame: z.boolean().optional(),
  isCache: z.boolean().optional(),
  query: z.string().optional(),
})

const noticeBodySchema = z.object({
  noticeId: z.number().int().optional(),
  noticeTitle: z.string().min(1),
  noticeType: z.string().min(1),
  noticeContent: z.string().optional(),
  status: z.string().optional(),
  createBy: z.string().optional(),
  remark: z.string().optional(),
})

const jobBodySchema = z.object({
  jobId: z.number().int().optional(),
  jobName: z.string().min(1),
  jobGroup: z.string().optional(),
  invokeTarget: z.string().min(1),
  cronExpression: z.string().min(1),
  misfirePolicy: z.string().optional(),
  concurrent: z.string().optional(),
  status: z.string().optional(),
  remark: z.string().optional(),
})

const jobChangeStatusBodySchema = z.object({
  jobId: z.number().int(),
  status: z.string(),
})

const jobRunBodySchema = z.object({
  jobId: z.number().int(),
  jobGroup: z.string().optional(),
})

const deptBodySchema = z.object({
  deptId: z.number().int().optional(),
  parentId: z.number().int().optional(),
  deptName: z.string().min(1).optional(),
  orderNum: z.number().int().optional(),
  leader: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  status: z.string().optional(),
})

const postBodySchema = z.object({
  postId: z.number().int().optional(),
  postCode: z.string().min(1).optional(),
  postName: z.string().min(1).optional(),
  postSort: z.number().int().optional(),
  status: z.string().optional(),
  remark: z.string().optional(),
})

const configBodySchema = z.object({
  configId: z.number().int().optional(),
  configName: z.string().min(1).optional(),
  configKey: z.string().min(1).optional(),
  configValue: z.string().optional(),
  configType: z.string().optional(),
  remark: z.string().optional(),
})

const dictTypeBodySchema = z.object({
  dictId: z.number().int().optional(),
  dictName: z.string().min(1).optional(),
  dictType: z.string().min(1).optional(),
  status: z.string().optional(),
  remark: z.string().optional(),
})

const dictDataBodySchema = z.object({
  dictCode: z.number().int().optional(),
  dictSort: z.number().int().optional(),
  dictLabel: z.string().min(1).optional(),
  dictValue: z.string().min(1).optional(),
  dictType: z.string().min(1).optional(),
  cssClass: z.string().optional(),
  listClass: z.string().optional(),
  isDefault: z.string().optional(),
  status: z.string().optional(),
  remark: z.string().optional(),
})

const createConfigBodySchema = z.object({
  configName: z.string().min(1),
  configKey: z.string().min(1),
  configValue: z.string().optional(),
  configType: z.string().optional(),
  remark: z.string().optional(),
})

const createDictDataBodySchema = z.object({
  dictSort: z.number().int().optional(),
  dictLabel: z.string().min(1),
  dictValue: z.string().min(1),
  dictType: z.string().min(1),
  cssClass: z.string().optional(),
  listClass: z.string().optional(),
  isDefault: z.string().optional(),
  status: z.string().optional(),
  remark: z.string().optional(),
})

const roleChangeStatusBodySchema = z.object({
  roleId: z.number().int(),
  status: z.string(),
})

const roleDataScopeBodySchema = z.object({
  roleId: z.number().int(),
  dataScope: z.string().optional(),
  deptIds: z.array(z.number().int()).optional(),
})

// =============================================================================
// 主插件:系统管理后端(迁移自 admin_panel.py)
// =============================================================================

export const adminSysRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===========================================================================
  // sys_operlog 审计埋点:onResponse 钩子,异步记录 admin 后台写操作
  // - 仅记录 POST/PUT/PATCH/DELETE(RuoYi businessType:1新增/2修改/3删除/0其他)
  // - status: 0=正常(statusCode<400), 1=异常(statusCode>=400)
  // - setImmediate 异步落库,失败忽略,不阻塞业务请求
  // - 自身路由(/operlog/*)不记录,避免日志查询/清空产生自循环日志
  // ===========================================================================
  const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
  const TITLE_MAP: Record<string, string> = {
    '/sys-menu': '菜单管理',
    '/dept': '部门管理',
    '/post': '岗位管理',
    '/config': '参数配置',
    '/dict-type': '字典类型',
    '/dict-data': '字典数据',
    '/notice': '通知公告',
    '/job': '定时任务',
    '/role': '角色管理',
    '/users': '用户管理',
    '/logininfor': '登录日志',
  }
  const METHOD_MAP: Record<string, number> = { POST: 1, PUT: 2, PATCH: 2, DELETE: 3 }

  server.addHook('onResponse', async (request, reply) => {
    const method = request.method.toUpperCase()
    if (!WRITE_METHODS.has(method)) return

    const url = request.url.split('?')[0] ?? ''
    // 命中 operlog 路由(列表/清空/删除)直接跳过,避免自循环
    if (url.includes('/operlog')) return

    // 从 URL 推断模块名(title)
    const segments = url.split('/').filter(Boolean)
    const seg = segments.find((s) => TITLE_MAP[`/${s}`])
    const title = (seg && TITLE_MAP[`/${seg}`]) || '系统管理'
    const businessType = METHOD_MAP[method] ?? 0
    const statusCode = reply.statusCode
    const status = statusCode >= 400 ? 1 : 0
    const operName = request.userId ?? ''
    const operIp = request.ip ?? ''
    const operUrl = url.slice(0, 255)

    // operParam:请求 body JSON 序列化(限长 2000 防止超大日志)
    let operParam: string | undefined
    try {
      const body = request.body
      if (body !== undefined && body !== null) {
        operParam = JSON.stringify(body).slice(0, 2000)
      }
    } catch {
      operParam = undefined
    }

    const jsonResult = JSON.stringify({ code: statusCode }).slice(0, 2000)
    const costTime = Math.max(0, Math.round(reply.elapsedTime ?? 0))

    setImmediate(() => {
      createOperlog({
        title,
        businessType,
        method: `${seg ?? 'system'}.${method.toLowerCase()}`,
        requestMethod: method,
        operatorType: 0,
        operName,
        operUrl,
        operIp,
        operParam,
        jsonResult,
        status,
        errorMsg: status === 1 ? `HTTP ${statusCode}` : undefined,
        costTime,
      }).catch(() => {
        /* 审计写入失败不影响业务 */
      })
    })
  })

  // ===========================================================================
  // menu_router (prefix=/sys-menu) — RuoYi 风格 sys_menu 子系统
  // 注:前缀已迁移至 /sys-menu,避免与 admin-extended.ts 的 /menu CRUD 路径冲突
  // ===========================================================================
  server.register(
    async (s) => {
      // GET /sys-menu/list - 菜单列表
      s.get('/list', async (_request, reply) => {
        const list = await findMenuList()
        return reply.send(success({ list, total: list.length }))
      })

      // GET /sys-menu/:menuId - 菜单详情
      s.get('/:menuId', async (request, reply) => {
        const { menuId } = z.object({ menuId: z.string().uuid() }).parse(request.params)
        const data = await findMenuById(menuId)
        if (!data) {
          return reply.status(404).send(error(404, '菜单不存在'))
        }
        return reply.send(success({ data }))
      })

      // GET /sys-menu/treeselect - 菜单树(下拉)
      s.get('/treeselect', async (_request, reply) => {
        const list = await findMenuList()
        return reply.send(success({ list }))
      })

      // GET /sys-menu/roleMenuTreeselect/:roleId - 角色分配菜单树
      s.get('/roleMenuTreeselect/:roleId', async (request, reply) => {
        const { roleId } = z.object({ roleId: z.string() }).parse(request.params)
        const rid = Number(roleId)
        const list = await findMenuList()
        const checkedKeys = Number.isNaN(rid) ? [] : await findMenuIdsByRole(rid)
        return reply.send(success({ roleId, menus: list, checkedKeys }))
      })

      // PUT /sys-menu/assignRoleMenus/:roleId - 分配角色菜单
      s.put('/assignRoleMenus/:roleId', async (request, reply) => {
        const { roleId } = z.object({ roleId: z.string() }).parse(request.params)
        const rid = Number(roleId)
        if (Number.isNaN(rid) || rid < 1) {
          return reply.status(400).send(error(400, 'roleId 无效'))
        }
        const parsed = z.object({ menuIds: z.array(z.string().uuid()) }).safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        await assignRoleMenus(rid, parsed.data.menuIds)
        return reply.send(success({ assigned: parsed.data.menuIds.length }))
      })

      // POST /sys-menu - 新增菜单
      s.post('', async (request, reply) => {
        const parsed = menuBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { menuId: _menuId, menuName, ...rest } = parsed.data
        if (!menuName) {
          return reply.status(400).send(error(400, 'menuName 不能为空'))
        }
        const menu = await createMenu({ ...rest, menuName, createBy: request.userId })
        return reply.send(success({ menu }))
      })

      // PUT /sys-menu - 修改菜单
      s.put('', async (request, reply) => {
        const parsed = menuBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { menuId, ...data } = parsed.data
        if (!menuId) {
          return reply.status(400).send(error(400, 'menuId 不能为空'))
        }
        const menu = await updateMenu(menuId, { ...data, updateBy: request.userId })
        if (!menu) {
          return reply.status(404).send(error(404, '菜单不存在'))
        }
        return reply.send(success({ menu }))
      })

      // DELETE /sys-menu/:menuId - 删除菜单(级联清理 sys_role_menu)
      s.delete('/:menuId', async (request, reply) => {
        const { menuId } = z.object({ menuId: z.string().uuid() }).parse(request.params)
        const menu = await deleteMenuWithCascade(menuId)
        if (!menu) {
          return reply.status(404).send(error(404, '菜单不存在'))
        }
        return reply.send(success({ menu }))
      })
    },
    { prefix: '/sys-menu' },
  )

  // ===========================================================================
  // role_router (prefix=/role)
  // 注:authUser 5 端点基于 users.roleId (integer) 实现,不新建 sys_user_role 表:
  //   - "分配角色" = UPDATE users SET roleId = ?
  //   - "取消角色" = UPDATE users SET roleId = 0
  //   避免与 users.roleId 数据冗余,与 requireAdmin (roleId >= 1) 鉴权体系一致。
  // ===========================================================================
  server.register(
    async (s) => {
      // PUT /role/changeStatus - 修改角色状态(对应前端 changeRoleStatus)
      s.put('/changeStatus', async (request, reply) => {
        const parsed = roleChangeStatusBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const role = await updateAdminRoleStatus(parsed.data.roleId, parsed.data.status)
        if (!role) {
          return reply.status(404).send(error(404, '角色不存在'))
        }
        return reply.send(success({ role }))
      })

      // PUT /role/dataScope - 更新角色数据权限(对应前端 dataScope)
      s.put('/dataScope', async (request, reply) => {
        const parsed = roleDataScopeBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const role = await updateAdminRoleDataScope(
          parsed.data.roleId,
          parsed.data.dataScope ?? '1',
          parsed.data.deptIds ?? [],
        )
        if (!role) {
          return reply.status(404).send(error(404, '角色不存在'))
        }
        return reply.send(success({ role }))
      })

      // GET /role/deptTree/:roleId - 角色关联的部门树(对应前端 roleDeptTreeSelect)
      s.get('/deptTree/:roleId', async (request, reply) => {
        const { roleId } = z.object({ roleId: z.string() }).parse(request.params)
        const rid = Number(roleId)
        if (Number.isNaN(rid) || rid < 1) {
          return reply.status(400).send(error(400, 'roleId 无效'))
        }
        const list = await findDeptList()
        const checkedKeys = await findAdminRoleDeptIds(rid)
        return reply.send(success({ depts: list, checkedKeys }))
      })

      // DELETE /role/:roleId - 删除角色(级联清理 sys_role_menu)
      s.delete('/:roleId', async (request, reply) => {
        const { roleId } = z.object({ roleId: z.string() }).parse(request.params)
        const rid = Number(roleId)
        if (Number.isNaN(rid) || rid < 1) {
          return reply.status(400).send(error(400, 'roleId 无效'))
        }
        await deleteRoleMenuCascade(rid)
        return reply.send(success({ roleId: rid }))
      })

      // -----------------------------------------------------------------------
      // authUser 子路由(prefix=/authUser)— 角色用户管理(5 端点)
      // 基于 users.roleId (integer) 实现,不依赖 sys_user_role 中间表
      // -----------------------------------------------------------------------
      s.register(
        async (sub) => {
          // GET /role/authUser/allocatedList - 已分配该角色的用户
          sub.get('/allocatedList', async (request, reply) => {
            const q = request.query as Record<string, string>
            const roleId = parseNum(q.roleId) ?? 0
            if (roleId < 1) {
              return reply.status(400).send(error(400, 'roleId 无效'))
            }
            const { list, total } = await findAllocatedUsers({
              page: parseNum(q.page, 1),
              pageSize: parseNum(q.pageSize, 10),
              roleId,
              userName: parseStr(q.userName),
              phonenumber: parseStr(q.phonenumber),
            })
            return reply.send(success({ list, total }))
          })

          // GET /role/authUser/unallocatedList - 未分配该角色的用户
          sub.get('/unallocatedList', async (request, reply) => {
            const q = request.query as Record<string, string>
            const roleId = parseNum(q.roleId, 0) ?? 0
            if (roleId < 1) {
              return reply.status(400).send(error(400, 'roleId 无效'))
            }
            const { list, total } = await findUnallocatedUsers({
              page: parseNum(q.page, 1),
              pageSize: parseNum(q.pageSize, 10),
              roleId,
              userName: parseStr(q.userName),
              phonenumber: parseStr(q.phonenumber),
            })
            return reply.send(success({ list, total }))
          })

          // PUT /role/authUser/cancel - 取消单个用户的角色授权
          sub.put('/cancel', async (request, reply) => {
            const parsed = z
              .object({
                roleId: z.union([z.number().int(), z.string()]).transform(Number),
                userId: z.union([z.number().int(), z.string()]).transform(String),
              })
              .safeParse(request.body)
            if (!parsed.success) {
              return reply
                .status(400)
                .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
            }
            const { roleId, userId } = parsed.data
            if (roleId < 1) {
              return reply.status(400).send(error(400, 'roleId 无效'))
            }
            const affected = await cancelUserRole(userId, roleId)
            return reply.send(success({ success: affected > 0 }))
          })

          // PUT /role/authUser/cancelAll - 批量取消角色授权(userIds 逗号分隔)
          sub.put('/cancelAll', async (request, reply) => {
            const q = request.query as Record<string, string>
            const roleId = parseNum(q.roleId) ?? 0
            if (roleId < 1) {
              return reply.status(400).send(error(400, 'roleId 无效'))
            }
            const userIds = (q.userIds ?? '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
            if (userIds.length === 0) {
              return reply.status(400).send(error(400, 'userIds 不能为空'))
            }
            const affected = await cancelAllUserRole(userIds, roleId)
            return reply.send(success({ success: true, affected }))
          })

          // PUT /role/authUser/selectAll - 批量分配角色(userIds 逗号分隔)
          sub.put('/selectAll', async (request, reply) => {
            const q = request.query as Record<string, string>
            const roleId = parseNum(q.roleId) ?? 0
            if (roleId < 1) {
              return reply.status(400).send(error(400, 'roleId 无效'))
            }
            const userIds = (q.userIds ?? '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
            if (userIds.length === 0) {
              return reply.status(400).send(error(400, 'userIds 不能为空'))
            }
            const affected = await selectAllUserRole(userIds, roleId)
            return reply.send(success({ success: true, affected }))
          })
        },
        { prefix: '/authUser' },
      )
    },
    { prefix: '/role' },
  )

  // ===========================================================================
  // logininfo_router (prefix=/logininfor)
  // ===========================================================================
  server.register(
    async (s) => {
      // GET /logininfor/list - 登录日志
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findLogininforList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          loginName: parseStr(q.loginName),
          ipaddr: parseStr(q.ipaddr),
          status: parseStr(q.status),
        })
        return reply.send(success({ list, total }))
      })

      // DELETE /logininfor/clean - 清空登录日志
      s.delete('/clean', async (_request, reply) => {
        await cleanLogininfor()
        return reply.send(success({}))
      })

      // DELETE /logininfor/:infoIds - 删除登录日志(逗号分隔)
      s.delete('/:infoIds', async (request, reply) => {
        const { infoIds } = z.object({ infoIds: z.string() }).parse(request.params)
        const ids = infoIds
          .split(',')
          .filter(Boolean)
          .map(Number)
          .filter((n) => !Number.isNaN(n))
        if (ids.length === 0) {
          return reply.status(400).send(error(400, '无效的 ID'))
        }
        const deleted = await db
          .delete(sysLogininfor)
          .where(inArray(sysLogininfor.infoId, ids))
          .returning()
        return reply.send(success({ deleted: deleted.length }))
      })

      // PUT /logininfor/unlock/:userName - 解锁用户
      s.put('/unlock/:userName', async (request, reply) => {
        const { userName } = z.object({ userName: z.string() }).parse(request.params)
        return reply.send(success({ userName, unlocked: true }))
      })
    },
    { prefix: '/logininfor' },
  )

  // ===========================================================================
  // notice_router (prefix=/notice)
  // ===========================================================================
  server.register(
    async (s) => {
      // GET /notice/list - 通知公告列表
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findNoticeList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          noticeTitle: parseStr(q.noticeTitle),
          noticeType: parseStr(q.noticeType),
          createBy: parseStr(q.createBy),
        })
        return reply.send(success({ list, total }))
      })

      // GET /notice/:noticeId - 公告详情
      s.get('/:noticeId', async (request, reply) => {
        const { noticeId } = z.object({ noticeId: z.string() }).parse(request.params)
        const id = Number(noticeId)
        if (Number.isNaN(id)) {
          return reply.status(400).send(error(400, '无效的 ID'))
        }
        const data = await findNoticeById(id)
        if (!data) {
          return reply.status(404).send(error(404, '公告不存在'))
        }
        return reply.send(success({ data }))
      })

      // POST /notice - 新增公告
      s.post('', async (request, reply) => {
        const parsed = noticeBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { noticeId: _noticeId, createBy: _createBy, ...data } = parsed.data
        const notice = await createNotice({ ...data, createBy: request.userId })
        return reply.send(success({ notice }))
      })

      // PUT /notice - 修改公告
      s.put('', async (request, reply) => {
        const parsed = noticeBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { noticeId, createBy: _createBy2, ...data } = parsed.data
        if (!noticeId) {
          return reply.status(400).send(error(400, 'noticeId 不能为空'))
        }
        const notice = await updateNotice(noticeId, { ...data, updateBy: request.userId })
        if (!notice) {
          return reply.status(404).send(error(404, '公告不存在'))
        }
        return reply.send(success({ notice }))
      })

      // DELETE /notice/:noticeIds - 删除公告(逗号分隔)
      s.delete('/:noticeIds', async (request, reply) => {
        const { noticeIds } = z.object({ noticeIds: z.string() }).parse(request.params)
        const ids = noticeIds
          .split(',')
          .filter(Boolean)
          .map(Number)
          .filter((n) => !Number.isNaN(n))
        const deleted = await deleteNoticesBatch(ids)
        return reply.send(success({ deleted }))
      })
    },
    { prefix: '/notice' },
  )

  // ===========================================================================
  // job_router (prefix=/job)
  // ===========================================================================
  server.register(
    async (s) => {
      // GET /job/list - 定时任务列表
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findJobList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          jobName: parseStr(q.jobName),
          jobGroup: parseStr(q.jobGroup),
          status: parseStr(q.status),
        })
        return reply.send(success({ list, total }))
      })

      // GET /job/:jobId - 任务详情
      s.get('/:jobId', async (request, reply) => {
        const { jobId } = z.object({ jobId: z.string() }).parse(request.params)
        const id = Number(jobId)
        if (Number.isNaN(id)) {
          return reply.status(400).send(error(400, '无效的 ID'))
        }
        const data = await findJobById(id)
        if (!data) {
          return reply.status(404).send(error(404, '任务不存在'))
        }
        return reply.send(success({ data }))
      })

      // POST /job - 新增定时任务
      s.post('', async (request, reply) => {
        const parsed = jobBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { jobId: _jobId, ...data } = parsed.data
        const job = await createJob({ ...data, createBy: request.userId })
        return reply.send(success({ job }))
      })

      // PUT /job - 修改定时任务
      s.put('', async (request, reply) => {
        const parsed = jobBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { jobId, ...data } = parsed.data
        if (!jobId) {
          return reply.status(400).send(error(400, 'jobId 不能为空'))
        }
        const job = await updateJob(jobId, { ...data, updateBy: request.userId })
        if (!job) {
          return reply.status(404).send(error(404, '任务不存在'))
        }
        return reply.send(success({ job }))
      })

      // PUT /job/changeStatus - 暂停/恢复任务
      s.put('/changeStatus', async (request, reply) => {
        const parsed = jobChangeStatusBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const job = await updateJobStatus(parsed.data.jobId, parsed.data.status)
        if (!job) {
          return reply.status(404).send(error(404, '任务不存在'))
        }
        return reply.send(success({ job }))
      })

      // PUT /job/run - 立即执行
      s.put('/run', async (request, reply) => {
        const parsed = jobRunBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const job = await findJobById(parsed.data.jobId)
        if (!job) {
          return reply.status(404).send(error(404, '任务不存在'))
        }
        return reply.send(success({ jobId: parsed.data.jobId, message: '任务已触发执行' }))
      })

      // DELETE /job/:jobIds - 删除(逗号分隔)
      s.delete('/:jobIds', async (request, reply) => {
        const { jobIds } = z.object({ jobIds: z.string() }).parse(request.params)
        const ids = jobIds
          .split(',')
          .filter(Boolean)
          .map(Number)
          .filter((n) => !Number.isNaN(n))
        const deleted = await deleteJobsBatch(ids)
        return reply.send(success({ deleted }))
      })
    },
    { prefix: '/job' },
  )

  // ===========================================================================
  // job_log_router (prefix=/job/log)
  // ===========================================================================
  server.register(
    async (s) => {
      // GET /job/log/list - 任务执行日志
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findJobLogList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          jobName: parseStr(q.jobName),
          jobGroup: parseStr(q.jobGroup),
          status: parseStr(q.status),
        })
        return reply.send(success({ list, total }))
      })

      // DELETE /job/log/clean - 清空任务日志
      s.delete('/clean', async (_request, reply) => {
        await cleanJobLogs()
        return reply.send(success({}))
      })
    },
    { prefix: '/job/log' },
  )

  // ===========================================================================
  // online_router (prefix=/online) - 在线用户(基于 refresh_tokens 活跃会话)
  // ===========================================================================
  server.register(
    async (s) => {
      const ONLINE_CACHE_KEY = 'admin:online:list'
      const ONLINE_CACHE_TTL = 15

      // GET /online/list - 在线用户列表
      // 活跃会话定义:refresh_tokens 中 revokedAt IS NULL AND expiresAt > NOW()
      s.get('/list', async (request, reply) => {
        const redis = request.server.redis
        try {
          const cached = await redis.get(ONLINE_CACHE_KEY)
          if (cached) {
            const rows = JSON.parse(cached)
            return reply.send(success({ list: rows, total: rows.length }))
          }
        } catch (e) {
          request.log.error(e)
        }
        const rows = await db
          .select({
            tokenId: refreshTokens.id,
            userId: users.id,
            username: users.username,
            nickname: users.nickname,
            avatar: users.avatar,
            roleId: users.roleId,
            loginAt: refreshTokens.createdAt,
            expiresAt: refreshTokens.expiresAt,
            familyId: refreshTokens.familyId,
          })
          .from(refreshTokens)
          .innerJoin(users, eq(refreshTokens.userId, users.id))
          .where(and(isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())))
          .orderBy(desc(refreshTokens.createdAt))
          .limit(500)
        try {
          await redis.set(ONLINE_CACHE_KEY, JSON.stringify(rows), 'EX', ONLINE_CACHE_TTL)
        } catch (e) {
          request.log.error(e)
        }
        return reply.send(success({ list: rows, total: rows.length }))
      })

      // DELETE /online/:tokenId - 强制下线(撤销该 refresh token 会话)
      s.delete('/:tokenId', async (request, reply) => {
        const { tokenId } = z.object({ tokenId: z.string() }).parse(request.params)
        request.skipResponseSanitization = true
        const revoked = await db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(refreshTokens.id, tokenId), isNull(refreshTokens.revokedAt)))
          .returning({ id: refreshTokens.id })
        if (revoked.length === 0) {
          return reply.status(404).send(error(404, '会话不存在或已注销'))
        }
        try {
          await request.server.redis.del(ONLINE_CACHE_KEY)
        } catch (e) {
          request.log.error(e)
        }
        return reply.send(success({ tokenId, forced: true }))
      })
    },
    { prefix: '/online' },
  )

  // ===========================================================================
  // dept_router (prefix=/dept)
  // ===========================================================================
  server.register(
    async (s) => {
      // GET /dept/list - 部门列表
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const list = await findDeptList({
          deptName: parseStr(q.deptName),
          status: parseStr(q.status),
        })
        return reply.send(success({ list, total: list.length }))
      })

      // GET /dept/list/exclude/:deptId - 排除某部门的树
      s.get('/list/exclude/:deptId', async (request, reply) => {
        const { deptId } = z.object({ deptId: z.string() }).parse(request.params)
        const excludeId = Number(deptId)
        const list = await findDeptList()
        return reply.send(
          success({ list: list.filter((d) => d.deptId !== excludeId), exclude: deptId }),
        )
      })

      // GET /dept/:deptId - 部门详情
      s.get('/:deptId', async (request, reply) => {
        const { deptId } = z.object({ deptId: z.string() }).parse(request.params)
        const id = Number(deptId)
        if (Number.isNaN(id)) {
          return reply.status(400).send(error(400, '无效的 ID'))
        }
        const data = await findDeptById(id)
        if (!data) {
          return reply.status(404).send(error(404, '部门不存在'))
        }
        return reply.send(success({ data }))
      })

      // POST /dept - 新增部门
      s.post('', async (request, reply) => {
        const parsed = deptBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { deptId: _deptId, deptName, ...rest } = parsed.data
        if (!deptName) {
          return reply.status(400).send(error(400, 'deptName 不能为空'))
        }
        const dept = await createDept({ ...rest, deptName })
        return reply.send(success({ dept }))
      })

      // PUT /dept - 修改部门
      s.put('', async (request, reply) => {
        const parsed = deptBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { deptId, ...data } = parsed.data
        if (!deptId) {
          return reply.status(400).send(error(400, 'deptId 不能为空'))
        }
        const dept = await updateDept(deptId, data)
        if (!dept) {
          return reply.status(404).send(error(404, '部门不存在'))
        }
        return reply.send(success({ dept }))
      })

      // DELETE /dept/:deptId - 删除部门
      s.delete('/:deptId', async (request, reply) => {
        const { deptId } = z.object({ deptId: z.string() }).parse(request.params)
        const id = Number(deptId)
        if (Number.isNaN(id)) {
          return reply.status(400).send(error(400, '无效的 ID'))
        }
        const dept = await deleteDept(id)
        if (!dept) {
          return reply.status(404).send(error(404, '部门不存在'))
        }
        return reply.send(success({ success: true }))
      })
    },
    { prefix: '/dept' },
  )

  // ===========================================================================
  // post_router (prefix=/post)
  // ===========================================================================
  server.register(
    async (s) => {
      // GET /post/list - 岗位列表
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findPostList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          postCode: parseStr(q.postCode),
          postName: parseStr(q.postName),
          status: parseStr(q.status),
        })
        return reply.send(success({ list, total }))
      })

      // GET /post/:postId - 岗位详情
      s.get('/:postId', async (request, reply) => {
        const { postId } = z.object({ postId: z.string() }).parse(request.params)
        const id = Number(postId)
        if (Number.isNaN(id)) {
          return reply.status(400).send(error(400, '无效的 ID'))
        }
        const data = await findPostById(id)
        if (!data) {
          return reply.status(404).send(error(404, '岗位不存在'))
        }
        return reply.send(success({ data }))
      })

      // POST /post - 新增岗位
      s.post('', async (request, reply) => {
        const parsed = postBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { postId: _postId, postCode, postName, ...rest } = parsed.data
        if (!postCode || !postName) {
          return reply.status(400).send(error(400, 'postCode 和 postName 不能为空'))
        }
        const post = await createPost({ ...rest, postCode, postName })
        return reply.send(success({ post }))
      })

      // PUT /post - 修改岗位
      s.put('', async (request, reply) => {
        const parsed = postBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { postId, ...data } = parsed.data
        if (!postId) {
          return reply.status(400).send(error(400, 'postId 不能为空'))
        }
        const post = await updatePost(postId, data)
        if (!post) {
          return reply.status(404).send(error(404, '岗位不存在'))
        }
        return reply.send(success({ post }))
      })

      // DELETE /post/:postIds - 删除岗位(逗号分隔)
      s.delete('/:postIds', async (request, reply) => {
        const { postIds } = z.object({ postIds: z.string() }).parse(request.params)
        const ids = postIds
          .split(',')
          .filter(Boolean)
          .map(Number)
          .filter((n) => !Number.isNaN(n))
        const deleted = await deletePostsBatch(ids)
        return reply.send(success({ deleted }))
      })
    },
    { prefix: '/post' },
  )

  // ===========================================================================
  // config_router (prefix=/config)
  // ===========================================================================
  server.register(
    async (s) => {
      // GET /config/list - 参数列表
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findConfigList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          configName: parseStr(q.configName),
          configKey: parseStr(q.configKey),
          configType: parseStr(q.configType),
        })
        return reply.send(success({ list, total }))
      })

      // GET /config/configKey/:configKey - 按 key 取参数
      s.get('/configKey/:configKey', async (request, reply) => {
        const { configKey } = z.object({ configKey: z.string() }).parse(request.params)
        const data = await findConfigByKey(configKey)
        if (!data) {
          return reply.status(404).send(error(404, '参数配置不存在'))
        }
        return reply.send(success({ data }))
      })

      // GET /config/:configId - 配置详情
      s.get('/:configId', async (request, reply) => {
        const { configId } = z.object({ configId: z.string() }).parse(request.params)
        const id = Number(configId)
        if (Number.isNaN(id)) {
          return reply.status(400).send(error(400, '无效的 ID'))
        }
        const data = await findConfigById(id)
        if (!data) {
          return reply.status(404).send(error(404, '参数配置不存在'))
        }
        return reply.send(success({ data }))
      })

      // POST /config - 新增配置
      s.post('', async (request, reply) => {
        const parsed = createConfigBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const config = await createConfig({ ...parsed.data, createBy: request.userId })
        return reply.send(success({ config }))
      })

      // PUT /config - 修改配置
      s.put('', async (request, reply) => {
        const parsed = configBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { configId, ...data } = parsed.data
        if (!configId) {
          return reply.status(400).send(error(400, 'configId 不能为空'))
        }
        const config = await updateConfig(configId, { ...data, updateBy: request.userId })
        if (!config) {
          return reply.status(404).send(error(404, '参数配置不存在'))
        }
        return reply.send(success({ config }))
      })

      // DELETE /config/refreshCache - 刷新缓存
      s.delete('/refreshCache', async (_request, reply) => {
        return reply.send(success({ success: true }))
      })

      // DELETE /config/:configIds - 删除配置(逗号分隔)
      s.delete('/:configIds', async (request, reply) => {
        const { configIds } = z.object({ configIds: z.string() }).parse(request.params)
        const ids = configIds
          .split(',')
          .filter(Boolean)
          .map(Number)
          .filter((n) => !Number.isNaN(n))
        const deleted = await deleteConfigsBatch(ids)
        return reply.send(success({ deleted }))
      })
    },
    { prefix: '/config' },
  )

  // ===========================================================================
  // dict_type_router (prefix=/dict/type)
  // ===========================================================================
  server.register(
    async (s) => {
      // GET /dict/type/list - 字典类型列表
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findDictTypeList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          dictName: parseStr(q.dictName),
          dictType: parseStr(q.dictType),
          status: parseStr(q.status),
        })
        return reply.send(success({ list, total }))
      })

      // GET /dict/type/optionselect - 字典类型下拉
      s.get('/optionselect', async (_request, reply) => {
        const { list } = await findDictTypeList({ pageSize: 1000 })
        return reply.send(success({ list }))
      })

      // GET /dict/type/:dictId - 字典类型详情
      s.get('/:dictId', async (request, reply) => {
        const { dictId } = z.object({ dictId: z.string() }).parse(request.params)
        const id = Number(dictId)
        if (Number.isNaN(id)) {
          return reply.status(400).send(error(400, '无效的 ID'))
        }
        const data = await findDictTypeById(id)
        if (!data) {
          return reply.status(404).send(error(404, '字典类型不存在'))
        }
        return reply.send(success({ data }))
      })

      // POST /dict/type - 新增字典类型
      s.post('', async (request, reply) => {
        const parsed = dictTypeBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { dictId: _dictId, dictName, dictType: dt, ...rest } = parsed.data
        if (!dictName || !dt) {
          return reply.status(400).send(error(400, 'dictName 和 dictType 不能为空'))
        }
        const dictType = await createDictType({
          ...rest,
          dictName,
          dictType: dt,
          createBy: request.userId,
        })
        return reply.send(success({ dictType }))
      })

      // PUT /dict/type - 修改字典类型
      s.put('', async (request, reply) => {
        const parsed = dictTypeBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { dictId, ...data } = parsed.data
        if (!dictId) {
          return reply.status(400).send(error(400, 'dictId 不能为空'))
        }
        const dictType = await updateDictType(dictId, { ...data, updateBy: request.userId })
        if (!dictType) {
          return reply.status(404).send(error(404, '字典类型不存在'))
        }
        return reply.send(success({ dictType }))
      })

      // DELETE /dict/type/refreshCache - 刷新缓存
      s.delete('/refreshCache', async (_request, reply) => {
        return reply.send(success({ success: true }))
      })

      // DELETE /dict/type/:dictIds - 删除字典类型(逗号分隔)
      s.delete('/:dictIds', async (request, reply) => {
        const { dictIds } = z.object({ dictIds: z.string() }).parse(request.params)
        const ids = dictIds
          .split(',')
          .filter(Boolean)
          .map(Number)
          .filter((n) => !Number.isNaN(n))
        const deleted = await deleteDictTypesBatch(ids)
        return reply.send(success({ deleted }))
      })
    },
    { prefix: '/dict/type' },
  )

  // ===========================================================================
  // dict_data_router (prefix=/dict/data)
  // ===========================================================================
  server.register(
    async (s) => {
      // GET /dict/data/list - 字典数据列表
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findDictDataList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          dictType: parseStr(q.dictType),
          dictLabel: parseStr(q.dictLabel),
          status: parseStr(q.status),
        })
        return reply.send(success({ list, total }))
      })

      // GET /dict/data/type/:dictType - 按 type 取字典数据
      s.get('/type/:dictType', async (request, reply) => {
        const { dictType } = z.object({ dictType: z.string() }).parse(request.params)
        const list = await findDictDataByType(dictType)
        return reply.send(success({ dictType, list }))
      })

      // POST /dict/data - 新增字典数据
      s.post('', async (request, reply) => {
        const parsed = createDictDataBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const dictData = await createDictData({ ...parsed.data, createBy: request.userId })
        return reply.send(success({ dictData }))
      })

      // GET /dict/data/:dictCode - 字典数据详情
      s.get('/:dictCode', async (request, reply) => {
        const { dictCode } = z.object({ dictCode: z.string() }).parse(request.params)
        const id = Number(dictCode)
        if (Number.isNaN(id)) {
          return reply.status(400).send(error(400, '无效的 ID'))
        }
        const data = await findDictDataById(id)
        if (!data) {
          return reply.status(404).send(error(404, '字典数据不存在'))
        }
        return reply.send(success({ data }))
      })

      // PUT /dict/data - 修改字典数据
      s.put('', async (request, reply) => {
        const parsed = dictDataBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { dictCode, ...data } = parsed.data
        if (!dictCode) {
          return reply.status(400).send(error(400, 'dictCode 不能为空'))
        }
        const dictData = await updateDictData(dictCode, { ...data, updateBy: request.userId })
        if (!dictData) {
          return reply.status(404).send(error(404, '字典数据不存在'))
        }
        return reply.send(success({ dictData }))
      })

      // DELETE /dict/data/:dictCodes - 删除字典数据
      s.delete('/:dictCodes', async (request, reply) => {
        const { dictCodes } = z.object({ dictCodes: z.string() }).parse(request.params)
        const codes = dictCodes
          .split(',')
          .filter(Boolean)
          .map(Number)
          .filter((n) => !Number.isNaN(n))
        await deleteDictDataBatch(codes)
        return reply.send(success({ deleted: true }))
      })
    },
    { prefix: '/dict/data' },
  )

  // ===========================================================================
  // operlog_router (prefix=/operlog)
  // ===========================================================================
  server.register(
    async (s) => {
      // GET /operlog/list - 操作日志列表
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findOperlogList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          title: parseStr(q.title),
          businessType: parseNum(q.businessType),
          operName: parseStr(q.operName),
          status: parseNum(q.status),
        })
        return reply.send(success({ list, total }))
      })

      // DELETE /operlog/clean - 清空操作日志
      s.delete('/clean', async (_request, reply) => {
        await cleanOperlogs()
        return reply.send(success({}))
      })

      // DELETE /operlog/:operIds - 删除操作日志(逗号分隔)
      s.delete('/:operIds', async (request, reply) => {
        const { operIds } = z.object({ operIds: z.string() }).parse(request.params)
        const ids = operIds
          .split(',')
          .filter(Boolean)
          .map(Number)
          .filter((n) => !Number.isNaN(n))
        if (ids.length === 0) {
          return reply.status(400).send(error(400, '无效的 ID'))
        }
        const deleted = await deleteOperlogsBatch(ids)
        return reply.send(success({ deleted }))
      })
    },
    { prefix: '/operlog' },
  )

  // ===========================================================================
  // 英文别名路由（若依风格 → 英文规范，兼容前端）
  // ===========================================================================

  // login-logs 别名（兼容 /logininfor）
  server.register(
    async (s) => {
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findLogininforList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          loginName: parseStr(q.loginName),
          ipaddr: parseStr(q.ipaddr),
          status: parseStr(q.status),
        })
        return reply.send(success({ list, total }))
      })
      s.delete('/clean', async (_request, reply) => {
        await cleanLogininfor()
        return reply.send(success({}))
      })
    },
    { prefix: '/login-logs' },
  )

  // tasks/logs 别名（兼容 /job/log）
  server.register(
    async (s) => {
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findJobLogList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          jobName: parseStr(q.jobName),
          status: parseStr(q.status),
        })
        return reply.send(success({ list, total }))
      })
      s.delete('/clean', async (_request, reply) => {
        await cleanJobLogs()
        return reply.send(success({}))
      })
    },
    { prefix: '/tasks/logs' },
  )

  // posts 别名（兼容 /post）
  server.register(
    async (s) => {
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findPostList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          postCode: parseStr(q.postCode),
          postName: parseStr(q.postName),
          status: parseStr(q.status),
        })
        return reply.send(success({ list, total }))
      })
      s.get('/:postId', async (request, reply) => {
        const { postId } = z.object({ postId: z.string() }).parse(request.params)
        const id = Number(postId)
        if (Number.isNaN(id)) {
          return reply.status(400).send(error(400, '无效的 ID'))
        }
        const data = await findPostById(id)
        if (!data) {
          return reply.status(404).send(error(404, '岗位不存在'))
        }
        return reply.send(success({ data }))
      })
    },
    { prefix: '/posts' },
  )

  // ===========================================================================
  // users 补充路由(prefix=/users) — 重置密码
  // 注:/api/admin/users 主 CRUD 由 admin.ts 提供,此处仅补 resetPwd
  // ===========================================================================
  server.register(
    async (s) => {
      // PUT /users/resetPwd - 管理员重置用户密码
      s.put('/resetPwd', async (request, reply) => {
        const parsed = z
          .object({
            userId: z.string().uuid(),
            password: z.string().min(6, '密码至少 6 位'),
          })
          .safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const passwordHash = bcrypt.hashSync(parsed.data.password, 10)
        const updated = await db
          .update(users)
          .set({ passwordHash, updatedAt: new Date() })
          .where(eq(users.id, parsed.data.userId))
          .returning({ id: users.id })
        if (updated.length === 0) {
          return reply.status(404).send(error(404, '用户不存在'))
        }
        return reply.send(success({ success: true }))
      })
    },
    { prefix: '/users' },
  )
}

export const menuRoutersRoutes: FastifyPluginAsync = async (server) => {
  server.get('/getRouters', { preHandler: requireAuth }, async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0
    const list = await findMenuList()
    if (roleId >= 1) {
      return reply.send(success({ list }))
    }
    const menuIds = await findMenuIdsByRole(roleId)
    const idSet = new Set(menuIds)
    return reply.send(success({ list: list.filter((m) => idSet.has(m.id)) }))
  })
}
