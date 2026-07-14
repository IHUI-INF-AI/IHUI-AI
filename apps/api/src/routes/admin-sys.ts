import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin, requireAuth } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import {
  findMenuList,
  findMenuIdsByRole,
  assignRoleMenus,
  updateMenu,
  deleteMenuWithCascade,
  deleteRoleMenuCascade,
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
  updateDept,
  findPostList,
  findPostById,
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
  updateDictType,
  deleteDictTypesBatch,
  findDictDataList,
  findDictDataById,
  findDictDataByType,
  createDictData,
  updateDictData,
  deleteDictDataBatch,
} from '../db/admin-sys-queries.js'

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

// =============================================================================
// 主插件:系统管理后端(迁移自 admin_panel.py)
// =============================================================================

export const adminSysRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

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
  // ===========================================================================
  server.register(
    async (s) => {
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
  // online_router (prefix=/online) - 在线用户(基于会话,无独立数据表)
  // ===========================================================================
  server.register(
    async (s) => {
      // GET /online/list - 在线用户列表
      s.get('/list', async (_request, reply) => {
        return reply.send(success({ list: [], total: 0 }))
      })

      // DELETE /online/:tokenId - 强制下线
      s.delete('/:tokenId', async (request, reply) => {
        const { tokenId } = z.object({ tokenId: z.string() }).parse(request.params)
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
