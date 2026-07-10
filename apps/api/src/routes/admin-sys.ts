import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../plugins/auth.js';
import { success, error } from '../utils/response.js';
import {
  findMenuList,
  updateMenu,
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
} from '../db/admin-sys-queries.js';

const ADMIN_ROLE_ID = 1;

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    await authenticate(request);
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401;
    const message = (e as Error).message || 'Authentication required';
    reply.status(statusCode).send(error(statusCode, message));
    return false;
  }
  const roleId = request.jwtPayload?.roleId ?? 0;
  if (roleId < ADMIN_ROLE_ID) {
    reply.status(403).send(error(403, '需要管理员权限'));
    return false;
  }
  return true;
}

// =============================================================================
// 查询参数解析辅助
// =============================================================================

function parseNum(v: unknown, fallback?: number): number | undefined {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

function parseStr(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  return String(v);
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
});

const noticeBodySchema = z.object({
  noticeId: z.number().int().optional(),
  noticeTitle: z.string().min(1),
  noticeType: z.string().min(1),
  noticeContent: z.string().optional(),
  status: z.string().optional(),
  createBy: z.string().optional(),
  remark: z.string().optional(),
});

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
});

const jobChangeStatusBodySchema = z.object({
  jobId: z.number().int(),
  status: z.string(),
});

const jobRunBodySchema = z.object({
  jobId: z.number().int(),
  jobGroup: z.string().optional(),
});

const deptBodySchema = z.object({
  deptId: z.number().int().optional(),
  parentId: z.number().int().optional(),
  deptName: z.string().min(1).optional(),
  orderNum: z.number().int().optional(),
  leader: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  status: z.string().optional(),
});

const postBodySchema = z.object({
  postId: z.number().int().optional(),
  postCode: z.string().min(1).optional(),
  postName: z.string().min(1).optional(),
  postSort: z.number().int().optional(),
  status: z.string().optional(),
  remark: z.string().optional(),
});

const configBodySchema = z.object({
  configId: z.number().int().optional(),
  configName: z.string().min(1).optional(),
  configKey: z.string().min(1).optional(),
  configValue: z.string().optional(),
  configType: z.string().optional(),
  remark: z.string().optional(),
});

const dictTypeBodySchema = z.object({
  dictId: z.number().int().optional(),
  dictName: z.string().min(1).optional(),
  dictType: z.string().min(1).optional(),
  status: z.string().optional(),
  remark: z.string().optional(),
});

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
});

const createConfigBodySchema = z.object({
  configName: z.string().min(1),
  configKey: z.string().min(1),
  configValue: z.string().optional(),
  configType: z.string().optional(),
  remark: z.string().optional(),
});

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
});

// =============================================================================
// 主插件:系统管理后端(迁移自 admin_panel.py)
// =============================================================================

export const adminSysRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAdmin(request, reply))) return;
  });

  // ===========================================================================
  // menu_router (prefix=/menu)
  // ===========================================================================
  server.register(async (s) => {
    // GET /menu/list - 菜单列表
    s.get('/list', async (_request, reply) => {
      const list = await findMenuList();
      return reply.send(success({ list, total: list.length }));
    });

    // GET /menu/treeselect - 菜单树(下拉)
    s.get('/treeselect', async (_request, reply) => {
      const list = await findMenuList();
      return reply.send(success({ list }));
    });

    // GET /menu/roleMenuTreeselect/:roleId - 角色分配菜单树
    s.get('/roleMenuTreeselect/:roleId', async (request, reply) => {
      const { roleId } = request.params as { roleId: string };
      const list = await findMenuList();
      return reply.send(success({ roleId, menus: list, checkedKeys: [] }));
    });

    // GET /menu/getRouters - 登录用户路由表
    s.get('/getRouters', async (_request, reply) => {
      const list = await findMenuList();
      return reply.send(success({ list }));
    });

    // PUT /menu - 修改菜单
    s.put('', async (request, reply) => {
      const parsed = menuBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { menuId, ...data } = parsed.data;
      if (!menuId) {
        return reply.status(400).send(error(400, 'menuId 不能为空'));
      }
      const menu = await updateMenu(menuId, { ...data, updateBy: request.userId });
      if (!menu) {
        return reply.status(404).send(error(404, '菜单不存在'));
      }
      return reply.send(success({ menu }));
    });
  }, { prefix: '/menu' });

  // ===========================================================================
  // logininfo_router (prefix=/logininfor)
  // ===========================================================================
  server.register(async (s) => {
    // GET /logininfor/list - 登录日志
    s.get('/list', async (request, reply) => {
      const q = request.query as Record<string, string>;
      const { list, total } = await findLogininforList({
        page: parseNum(q.page, 1),
        pageSize: parseNum(q.pageSize, 10),
        loginName: parseStr(q.loginName),
        ipaddr: parseStr(q.ipaddr),
        status: parseStr(q.status),
      });
      return reply.send(success({ list, total }));
    });

    // DELETE /logininfor/clean - 清空登录日志
    s.delete('/clean', async (_request, reply) => {
      await cleanLogininfor();
      return reply.send(success({}));
    });

    // PUT /logininfor/unlock/:userName - 解锁用户
    s.put('/unlock/:userName', async (request, reply) => {
      const { userName } = request.params as { userName: string };
      return reply.send(success({ userName, unlocked: true }));
    });
  }, { prefix: '/logininfor' });

  // ===========================================================================
  // notice_router (prefix=/notice)
  // ===========================================================================
  server.register(async (s) => {
    // GET /notice/list - 通知公告列表
    s.get('/list', async (request, reply) => {
      const q = request.query as Record<string, string>;
      const { list, total } = await findNoticeList({
        page: parseNum(q.page, 1),
        pageSize: parseNum(q.pageSize, 10),
        noticeTitle: parseStr(q.noticeTitle),
        noticeType: parseStr(q.noticeType),
        createBy: parseStr(q.createBy),
      });
      return reply.send(success({ list, total }));
    });

    // GET /notice/:noticeId - 公告详情
    s.get('/:noticeId', async (request, reply) => {
      const { noticeId } = request.params as { noticeId: string };
      const id = Number(noticeId);
      if (Number.isNaN(id)) {
        return reply.status(400).send(error(400, '无效的 ID'));
      }
      const data = await findNoticeById(id);
      if (!data) {
        return reply.status(404).send(error(404, '公告不存在'));
      }
      return reply.send(success({ data }));
    });

    // POST /notice - 新增公告
    s.post('', async (request, reply) => {
      const parsed = noticeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { noticeId: _noticeId, createBy: _createBy, ...data } = parsed.data;
      const notice = await createNotice({ ...data, createBy: request.userId });
      return reply.send(success({ notice }));
    });

    // PUT /notice - 修改公告
    s.put('', async (request, reply) => {
      const parsed = noticeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { noticeId, createBy: _createBy2, ...data } = parsed.data;
      if (!noticeId) {
        return reply.status(400).send(error(400, 'noticeId 不能为空'));
      }
      const notice = await updateNotice(noticeId, { ...data, updateBy: request.userId });
      if (!notice) {
        return reply.status(404).send(error(404, '公告不存在'));
      }
      return reply.send(success({ notice }));
    });

    // DELETE /notice/:noticeIds - 删除公告(逗号分隔)
    s.delete('/:noticeIds', async (request, reply) => {
      const { noticeIds } = request.params as { noticeIds: string };
      const ids = noticeIds.split(',').filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
      const deleted = await deleteNoticesBatch(ids);
      return reply.send(success({ deleted }));
    });
  }, { prefix: '/notice' });

  // ===========================================================================
  // job_router (prefix=/job)
  // ===========================================================================
  server.register(async (s) => {
    // GET /job/list - 定时任务列表
    s.get('/list', async (request, reply) => {
      const q = request.query as Record<string, string>;
      const { list, total } = await findJobList({
        page: parseNum(q.page, 1),
        pageSize: parseNum(q.pageSize, 10),
        jobName: parseStr(q.jobName),
        jobGroup: parseStr(q.jobGroup),
        status: parseStr(q.status),
      });
      return reply.send(success({ list, total }));
    });

    // GET /job/:jobId - 任务详情
    s.get('/:jobId', async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const id = Number(jobId);
      if (Number.isNaN(id)) {
        return reply.status(400).send(error(400, '无效的 ID'));
      }
      const data = await findJobById(id);
      if (!data) {
        return reply.status(404).send(error(404, '任务不存在'));
      }
      return reply.send(success({ data }));
    });

    // POST /job - 新增定时任务
    s.post('', async (request, reply) => {
      const parsed = jobBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { jobId: _jobId, ...data } = parsed.data;
      const job = await createJob({ ...data, createBy: request.userId });
      return reply.send(success({ job }));
    });

    // PUT /job - 修改定时任务
    s.put('', async (request, reply) => {
      const parsed = jobBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { jobId, ...data } = parsed.data;
      if (!jobId) {
        return reply.status(400).send(error(400, 'jobId 不能为空'));
      }
      const job = await updateJob(jobId, { ...data, updateBy: request.userId });
      if (!job) {
        return reply.status(404).send(error(404, '任务不存在'));
      }
      return reply.send(success({ job }));
    });

    // PUT /job/changeStatus - 暂停/恢复任务
    s.put('/changeStatus', async (request, reply) => {
      const parsed = jobChangeStatusBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const job = await updateJobStatus(parsed.data.jobId, parsed.data.status);
      if (!job) {
        return reply.status(404).send(error(404, '任务不存在'));
      }
      return reply.send(success({ job }));
    });

    // PUT /job/run - 立即执行
    s.put('/run', async (request, reply) => {
      const parsed = jobRunBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const job = await findJobById(parsed.data.jobId);
      if (!job) {
        return reply.status(404).send(error(404, '任务不存在'));
      }
      return reply.send(success({ jobId: parsed.data.jobId, message: '任务已触发执行' }));
    });

    // DELETE /job/:jobIds - 删除(逗号分隔)
    s.delete('/:jobIds', async (request, reply) => {
      const { jobIds } = request.params as { jobIds: string };
      const ids = jobIds.split(',').filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
      const deleted = await deleteJobsBatch(ids);
      return reply.send(success({ deleted }));
    });
  }, { prefix: '/job' });

  // ===========================================================================
  // job_log_router (prefix=/job/log)
  // ===========================================================================
  server.register(async (s) => {
    // GET /job/log/list - 任务执行日志
    s.get('/list', async (request, reply) => {
      const q = request.query as Record<string, string>;
      const { list, total } = await findJobLogList({
        page: parseNum(q.page, 1),
        pageSize: parseNum(q.pageSize, 10),
        jobName: parseStr(q.jobName),
        jobGroup: parseStr(q.jobGroup),
        status: parseStr(q.status),
      });
      return reply.send(success({ list, total }));
    });

    // DELETE /job/log/clean - 清空任务日志
    s.delete('/clean', async (_request, reply) => {
      await cleanJobLogs();
      return reply.send(success({}));
    });
  }, { prefix: '/job/log' });

  // ===========================================================================
  // online_router (prefix=/online) - 在线用户(基于会话,无独立数据表)
  // ===========================================================================
  server.register(async (s) => {
    // GET /online/list - 在线用户列表
    s.get('/list', async (_request, reply) => {
      return reply.send(success({ list: [], total: 0 }));
    });

    // DELETE /online/:tokenId - 强制下线
    s.delete('/:tokenId', async (request, reply) => {
      const { tokenId } = request.params as { tokenId: string };
      return reply.send(success({ tokenId, forced: true }));
    });
  }, { prefix: '/online' });

  // ===========================================================================
  // dept_router (prefix=/dept)
  // ===========================================================================
  server.register(async (s) => {
    // GET /dept/list - 部门列表
    s.get('/list', async (request, reply) => {
      const q = request.query as Record<string, string>;
      const list = await findDeptList({
        deptName: parseStr(q.deptName),
        status: parseStr(q.status),
      });
      return reply.send(success({ list, total: list.length }));
    });

    // GET /dept/list/exclude/:deptId - 排除某部门的树
    s.get('/list/exclude/:deptId', async (request, reply) => {
      const { deptId } = request.params as { deptId: string };
      const excludeId = Number(deptId);
      const list = await findDeptList();
      return reply.send(success({ list: list.filter((d) => d.deptId !== excludeId), exclude: deptId }));
    });

    // GET /dept/:deptId - 部门详情
    s.get('/:deptId', async (request, reply) => {
      const { deptId } = request.params as { deptId: string };
      const id = Number(deptId);
      if (Number.isNaN(id)) {
        return reply.status(400).send(error(400, '无效的 ID'));
      }
      const data = await findDeptById(id);
      if (!data) {
        return reply.status(404).send(error(404, '部门不存在'));
      }
      return reply.send(success({ data }));
    });

    // PUT /dept - 修改部门
    s.put('', async (request, reply) => {
      const parsed = deptBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { deptId, ...data } = parsed.data;
      if (!deptId) {
        return reply.status(400).send(error(400, 'deptId 不能为空'));
      }
      const dept = await updateDept(deptId, data);
      if (!dept) {
        return reply.status(404).send(error(404, '部门不存在'));
      }
      return reply.send(success({ dept }));
    });
  }, { prefix: '/dept' });

  // ===========================================================================
  // post_router (prefix=/post)
  // ===========================================================================
  server.register(async (s) => {
    // GET /post/list - 岗位列表
    s.get('/list', async (request, reply) => {
      const q = request.query as Record<string, string>;
      const { list, total } = await findPostList({
        page: parseNum(q.page, 1),
        pageSize: parseNum(q.pageSize, 10),
        postCode: parseStr(q.postCode),
        postName: parseStr(q.postName),
        status: parseStr(q.status),
      });
      return reply.send(success({ list, total }));
    });

    // GET /post/:postId - 岗位详情
    s.get('/:postId', async (request, reply) => {
      const { postId } = request.params as { postId: string };
      const id = Number(postId);
      if (Number.isNaN(id)) {
        return reply.status(400).send(error(400, '无效的 ID'));
      }
      const data = await findPostById(id);
      if (!data) {
        return reply.status(404).send(error(404, '岗位不存在'));
      }
      return reply.send(success({ data }));
    });

    // PUT /post - 修改岗位
    s.put('', async (request, reply) => {
      const parsed = postBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { postId, ...data } = parsed.data;
      if (!postId) {
        return reply.status(400).send(error(400, 'postId 不能为空'));
      }
      const post = await updatePost(postId, data);
      if (!post) {
        return reply.status(404).send(error(404, '岗位不存在'));
      }
      return reply.send(success({ post }));
    });

    // DELETE /post/:postIds - 删除岗位(逗号分隔)
    s.delete('/:postIds', async (request, reply) => {
      const { postIds } = request.params as { postIds: string };
      const ids = postIds.split(',').filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
      const deleted = await deletePostsBatch(ids);
      return reply.send(success({ deleted }));
    });
  }, { prefix: '/post' });

  // ===========================================================================
  // config_router (prefix=/config)
  // ===========================================================================
  server.register(async (s) => {
    // GET /config/list - 参数列表
    s.get('/list', async (request, reply) => {
      const q = request.query as Record<string, string>;
      const { list, total } = await findConfigList({
        page: parseNum(q.page, 1),
        pageSize: parseNum(q.pageSize, 10),
        configName: parseStr(q.configName),
        configKey: parseStr(q.configKey),
        configType: parseStr(q.configType),
      });
      return reply.send(success({ list, total }));
    });

    // GET /config/configKey/:configKey - 按 key 取参数
    s.get('/configKey/:configKey', async (request, reply) => {
      const { configKey } = request.params as { configKey: string };
      const data = await findConfigByKey(configKey);
      if (!data) {
        return reply.status(404).send(error(404, '参数配置不存在'));
      }
      return reply.send(success({ data }));
    });

    // GET /config/:configId - 配置详情
    s.get('/:configId', async (request, reply) => {
      const { configId } = request.params as { configId: string };
      const id = Number(configId);
      if (Number.isNaN(id)) {
        return reply.status(400).send(error(400, '无效的 ID'));
      }
      const data = await findConfigById(id);
      if (!data) {
        return reply.status(404).send(error(404, '参数配置不存在'));
      }
      return reply.send(success({ data }));
    });

    // POST /config - 新增配置
    s.post('', async (request, reply) => {
      const parsed = createConfigBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const config = await createConfig({ ...parsed.data, createBy: request.userId });
      return reply.send(success({ config }));
    });

    // PUT /config - 修改配置
    s.put('', async (request, reply) => {
      const parsed = configBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { configId, ...data } = parsed.data;
      if (!configId) {
        return reply.status(400).send(error(400, 'configId 不能为空'));
      }
      const config = await updateConfig(configId, { ...data, updateBy: request.userId });
      if (!config) {
        return reply.status(404).send(error(404, '参数配置不存在'));
      }
      return reply.send(success({ config }));
    });

    // DELETE /config/:configIds - 删除配置(逗号分隔)
    s.delete('/:configIds', async (request, reply) => {
      const { configIds } = request.params as { configIds: string };
      const ids = configIds.split(',').filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
      const deleted = await deleteConfigsBatch(ids);
      return reply.send(success({ deleted }));
    });
  }, { prefix: '/config' });

  // ===========================================================================
  // dict_type_router (prefix=/dict/type)
  // ===========================================================================
  server.register(async (s) => {
    // GET /dict/type/list - 字典类型列表
    s.get('/list', async (request, reply) => {
      const q = request.query as Record<string, string>;
      const { list, total } = await findDictTypeList({
        page: parseNum(q.page, 1),
        pageSize: parseNum(q.pageSize, 10),
        dictName: parseStr(q.dictName),
        dictType: parseStr(q.dictType),
        status: parseStr(q.status),
      });
      return reply.send(success({ list, total }));
    });

    // GET /dict/type/optionselect - 字典类型下拉
    s.get('/optionselect', async (_request, reply) => {
      const { list } = await findDictTypeList({ pageSize: 1000 });
      return reply.send(success({ list }));
    });

    // GET /dict/type/:dictId - 字典类型详情
    s.get('/:dictId', async (request, reply) => {
      const { dictId } = request.params as { dictId: string };
      const id = Number(dictId);
      if (Number.isNaN(id)) {
        return reply.status(400).send(error(400, '无效的 ID'));
      }
      const data = await findDictTypeById(id);
      if (!data) {
        return reply.status(404).send(error(404, '字典类型不存在'));
      }
      return reply.send(success({ data }));
    });

    // PUT /dict/type - 修改字典类型
    s.put('', async (request, reply) => {
      const parsed = dictTypeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { dictId, ...data } = parsed.data;
      if (!dictId) {
        return reply.status(400).send(error(400, 'dictId 不能为空'));
      }
      const dictType = await updateDictType(dictId, { ...data, updateBy: request.userId });
      if (!dictType) {
        return reply.status(404).send(error(404, '字典类型不存在'));
      }
      return reply.send(success({ dictType }));
    });

    // DELETE /dict/type/:dictIds - 删除字典类型(逗号分隔)
    s.delete('/:dictIds', async (request, reply) => {
      const { dictIds } = request.params as { dictIds: string };
      const ids = dictIds.split(',').filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
      const deleted = await deleteDictTypesBatch(ids);
      return reply.send(success({ deleted }));
    });
  }, { prefix: '/dict/type' });

  // ===========================================================================
  // dict_data_router (prefix=/dict/data)
  // ===========================================================================
  server.register(async (s) => {
    // GET /dict/data/list - 字典数据列表
    s.get('/list', async (request, reply) => {
      const q = request.query as Record<string, string>;
      const { list, total } = await findDictDataList({
        page: parseNum(q.page, 1),
        pageSize: parseNum(q.pageSize, 10),
        dictType: parseStr(q.dictType),
        dictLabel: parseStr(q.dictLabel),
        status: parseStr(q.status),
      });
      return reply.send(success({ list, total }));
    });

    // GET /dict/data/type/:dictType - 按 type 取字典数据
    s.get('/type/:dictType', async (request, reply) => {
      const { dictType } = request.params as { dictType: string };
      const list = await findDictDataByType(dictType);
      return reply.send(success({ dictType, list }));
    });

    // POST /dict/data - 新增字典数据
    s.post('', async (request, reply) => {
      const parsed = createDictDataBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const dictData = await createDictData({ ...parsed.data, createBy: request.userId });
      return reply.send(success({ dictData }));
    });

    // GET /dict/data/:dictCode - 字典数据详情
    s.get('/:dictCode', async (request, reply) => {
      const { dictCode } = request.params as { dictCode: string };
      const id = Number(dictCode);
      if (Number.isNaN(id)) {
        return reply.status(400).send(error(400, '无效的 ID'));
      }
      const data = await findDictDataById(id);
      if (!data) {
        return reply.status(404).send(error(404, '字典数据不存在'));
      }
      return reply.send(success({ data }));
    });

    // PUT /dict/data - 修改字典数据
    s.put('', async (request, reply) => {
      const parsed = dictDataBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'));
      }
      const { dictCode, ...data } = parsed.data;
      if (!dictCode) {
        return reply.status(400).send(error(400, 'dictCode 不能为空'));
      }
      const dictData = await updateDictData(dictCode, { ...data, updateBy: request.userId });
      if (!dictData) {
        return reply.status(404).send(error(404, '字典数据不存在'));
      }
      return reply.send(success({ dictData }));
    });

    // DELETE /dict/data/:dictCodes - 删除字典数据(逗号分隔)
    s.delete('/:dictCodes', async (request, reply) => {
      const { dictCodes } = request.params as { dictCodes: string };
      const ids = dictCodes.split(',').filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
      const deleted = await deleteDictDataBatch(ids);
      return reply.send(success({ deleted }));
    });
  }, { prefix: '/dict/data' });
};
