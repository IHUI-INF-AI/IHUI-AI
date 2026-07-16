import { eq, ne, and, or, isNull, desc, asc, ilike, sql, inArray } from 'drizzle-orm'
import { db } from './index.js'
import {
  sysMenus,
  sysRoleMenu,
  sysLogininfor,
  sysNotices,
  sysJobs,
  sysJobLogs,
  sysDepts,
  sysPosts,
  sysConfigs,
  sysDictTypes,
  sysDictData,
  sysOperlog,
  adminRole,
  adminRoleDept,
  users,
  type SysMenu,
  type SysLogininfor,
  type SysNotice,
  type SysJob,
  type SysJobLog,
  type SysDept,
  type SysPost,
  type SysConfig,
  type SysDictType,
  type SysDictData,
  type SysOperlog,
} from '@ihui/database'

type AdminRole = typeof adminRole.$inferSelect

// =============================================================================
// 通用分页查询参数
// =============================================================================

export interface ListQuery {
  page?: number
  pageSize?: number
  search?: string
}

function paginate(query: ListQuery): { page: number; pageSize: number; offset: number } {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 10
  return { page, pageSize, offset: (page - 1) * pageSize }
}

// =============================================================================
// sysMenus（uuid 主键）
// =============================================================================

export async function findMenuList(): Promise<SysMenu[]> {
  return db.select().from(sysMenus).orderBy(asc(sysMenus.orderNum), asc(sysMenus.createdAt))
}

export async function findMenuIdsByRole(roleId: number): Promise<string[]> {
  const rows = await db
    .select({ menuId: sysRoleMenu.menuId })
    .from(sysRoleMenu)
    .where(eq(sysRoleMenu.roleId, roleId))
  return rows.map((r) => r.menuId)
}

export async function assignRoleMenus(roleId: number, menuIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(sysRoleMenu).where(eq(sysRoleMenu.roleId, roleId))
    if (menuIds.length > 0) {
      await tx
        .insert(sysRoleMenu)
        .values(menuIds.map((menuId) => ({ roleId, menuId })))
        .onConflictDoNothing()
    }
  })
}

export async function findMenuById(id: string): Promise<SysMenu | undefined> {
  const rows = await db.select().from(sysMenus).where(eq(sysMenus.id, id)).limit(1)
  return rows[0]
}

export interface CreateMenuInput {
  parentId?: string
  menuName: string
  orderNum?: number
  path?: string
  component?: string
  query?: string
  isFrame?: boolean
  isCache?: boolean
  menuType?: string
  visible?: string
  status?: string
  perms?: string
  icon?: string
  createBy?: string
  remark?: string
}

export async function createMenu(data: CreateMenuInput): Promise<SysMenu | undefined> {
  const rows = await db.insert(sysMenus).values(data).returning()
  return rows[0]
}

export interface UpdateMenuInput {
  parentId?: string
  menuName?: string
  orderNum?: number
  path?: string
  component?: string
  query?: string
  isFrame?: boolean
  isCache?: boolean
  menuType?: string
  visible?: string
  status?: string
  perms?: string
  icon?: string
  updateBy?: string
  remark?: string
}

export async function updateMenu(id: string, data: UpdateMenuInput): Promise<SysMenu | undefined> {
  const rows = await db
    .update(sysMenus)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sysMenus.id, id))
    .returning()
  return rows[0]
}

export async function deleteMenu(id: string): Promise<SysMenu | undefined> {
  const rows = await db.delete(sysMenus).where(eq(sysMenus.id, id)).returning()
  return rows[0]
}

export async function deleteRoleMenuByMenu(menuId: string): Promise<void> {
  await db.delete(sysRoleMenu).where(eq(sysRoleMenu.menuId, menuId))
}

export async function deleteRoleMenuByRole(roleId: number): Promise<void> {
  await db.delete(sysRoleMenu).where(eq(sysRoleMenu.roleId, roleId))
}

export async function deleteMenuWithCascade(id: string): Promise<SysMenu | undefined> {
  return db.transaction(async (tx) => {
    await tx.delete(sysRoleMenu).where(eq(sysRoleMenu.menuId, id))
    const rows = await tx.delete(sysMenus).where(eq(sysMenus.id, id)).returning()
    return rows[0]
  })
}

export async function deleteRoleMenuCascade(roleId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(sysRoleMenu).where(eq(sysRoleMenu.roleId, roleId))
  })
}

// =============================================================================
// sysLogininfor（bigserial 主键）
// =============================================================================

export interface LogininforListQuery extends ListQuery {
  loginName?: string
  ipaddr?: string
  status?: string
}

export async function findLogininforList(
  query: LogininforListQuery = {},
): Promise<{ list: SysLogininfor[]; total: number }> {
  const { pageSize, offset } = paginate(query)
  const conds = []
  if (query.loginName) conds.push(ilike(sysLogininfor.loginName, `%${query.loginName}%`))
  if (query.ipaddr) conds.push(ilike(sysLogininfor.ipaddr, `%${query.ipaddr}%`))
  if (query.status) conds.push(eq(sysLogininfor.status, query.status))
  const where = conds.length > 0 ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(sysLogininfor)
      .where(where)
      .orderBy(desc(sysLogininfor.loginTime))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sysLogininfor)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findLogininforById(id: number): Promise<SysLogininfor | undefined> {
  const rows = await db.select().from(sysLogininfor).where(eq(sysLogininfor.infoId, id)).limit(1)
  return rows[0]
}

export interface CreateLogininforInput {
  loginName?: string
  ipaddr?: string
  loginLocation?: string
  browser?: string
  os?: string
  status?: string
  msg?: string
  loginTime?: Date
}

export async function createLogininfor(
  data: CreateLogininforInput,
): Promise<SysLogininfor | undefined> {
  const rows = await db.insert(sysLogininfor).values(data).returning()
  return rows[0]
}

export async function deleteLogininfor(id: number): Promise<SysLogininfor | undefined> {
  const rows = await db.delete(sysLogininfor).where(eq(sysLogininfor.infoId, id)).returning()
  return rows[0]
}

/** 清空全部登录日志。 */
export async function cleanLogininfor(): Promise<void> {
  await db.delete(sysLogininfor)
}

// =============================================================================
// sysNotices（serial 主键）
// =============================================================================

export interface NoticeListQuery extends ListQuery {
  noticeTitle?: string
  noticeType?: string
  createBy?: string
}

export async function findNoticeList(
  query: NoticeListQuery = {},
): Promise<{ list: SysNotice[]; total: number }> {
  const { pageSize, offset } = paginate(query)
  const conds = []
  if (query.noticeTitle) conds.push(ilike(sysNotices.noticeTitle, `%${query.noticeTitle}%`))
  if (query.noticeType) conds.push(eq(sysNotices.noticeType, query.noticeType))
  if (query.createBy) conds.push(eq(sysNotices.createBy, query.createBy))
  const where = conds.length > 0 ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(sysNotices)
      .where(where)
      .orderBy(desc(sysNotices.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sysNotices)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findNoticeById(id: number): Promise<SysNotice | undefined> {
  const rows = await db.select().from(sysNotices).where(eq(sysNotices.noticeId, id)).limit(1)
  return rows[0]
}

export interface CreateNoticeInput {
  noticeTitle: string
  noticeType: string
  noticeContent?: string
  status?: string
  createBy?: string
  remark?: string
}

export async function createNotice(data: CreateNoticeInput): Promise<SysNotice | undefined> {
  const rows = await db.insert(sysNotices).values(data).returning()
  return rows[0]
}

export interface UpdateNoticeInput {
  noticeTitle?: string
  noticeType?: string
  noticeContent?: string
  status?: string
  updateBy?: string
  remark?: string
}

export async function updateNotice(
  id: number,
  data: UpdateNoticeInput,
): Promise<SysNotice | undefined> {
  const rows = await db
    .update(sysNotices)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sysNotices.noticeId, id))
    .returning()
  return rows[0]
}

export async function deleteNotice(id: number): Promise<SysNotice | undefined> {
  const rows = await db.delete(sysNotices).where(eq(sysNotices.noticeId, id)).returning()
  return rows[0]
}

export async function deleteNoticesBatch(ids: number[]): Promise<number> {
  const rows = await db.delete(sysNotices).where(inArray(sysNotices.noticeId, ids)).returning()
  return rows.length
}

// =============================================================================
// sysJobs（serial 主键）
// =============================================================================

export interface JobListQuery extends ListQuery {
  jobName?: string
  jobGroup?: string
  status?: string
}

export async function findJobList(
  query: JobListQuery = {},
): Promise<{ list: SysJob[]; total: number }> {
  const { pageSize, offset } = paginate(query)
  const conds = []
  if (query.jobName) conds.push(ilike(sysJobs.jobName, `%${query.jobName}%`))
  if (query.jobGroup) conds.push(eq(sysJobs.jobGroup, query.jobGroup))
  if (query.status) conds.push(eq(sysJobs.status, query.status))
  const where = conds.length > 0 ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(sysJobs)
      .where(where)
      .orderBy(desc(sysJobs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sysJobs)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findJobById(id: number): Promise<SysJob | undefined> {
  const rows = await db.select().from(sysJobs).where(eq(sysJobs.jobId, id)).limit(1)
  return rows[0]
}

export interface CreateJobInput {
  jobName: string
  jobGroup?: string
  invokeTarget: string
  cronExpression: string
  misfirePolicy?: string
  concurrent?: string
  status?: string
  createBy?: string
  remark?: string
}

export async function createJob(data: CreateJobInput): Promise<SysJob | undefined> {
  const rows = await db.insert(sysJobs).values(data).returning()
  return rows[0]
}

export interface UpdateJobInput {
  jobName?: string
  jobGroup?: string
  invokeTarget?: string
  cronExpression?: string
  misfirePolicy?: string
  concurrent?: string
  status?: string
  updateBy?: string
  remark?: string
}

export async function updateJob(id: number, data: UpdateJobInput): Promise<SysJob | undefined> {
  const rows = await db
    .update(sysJobs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sysJobs.jobId, id))
    .returning()
  return rows[0]
}

export async function updateJobStatus(id: number, status: string): Promise<SysJob | undefined> {
  const rows = await db
    .update(sysJobs)
    .set({ status, updatedAt: new Date() })
    .where(eq(sysJobs.jobId, id))
    .returning()
  return rows[0]
}

export async function deleteJob(id: number): Promise<SysJob | undefined> {
  const rows = await db.delete(sysJobs).where(eq(sysJobs.jobId, id)).returning()
  return rows[0]
}

export async function deleteJobsBatch(ids: number[]): Promise<number> {
  const rows = await db.delete(sysJobs).where(inArray(sysJobs.jobId, ids)).returning()
  return rows.length
}

// =============================================================================
// sysJobLogs（serial 主键）
// =============================================================================

export interface JobLogListQuery extends ListQuery {
  jobName?: string
  jobGroup?: string
  status?: string
}

export async function findJobLogList(
  query: JobLogListQuery = {},
): Promise<{ list: SysJobLog[]; total: number }> {
  const { pageSize, offset } = paginate(query)
  const conds = []
  if (query.jobName) conds.push(ilike(sysJobLogs.jobName, `%${query.jobName}%`))
  if (query.jobGroup) conds.push(eq(sysJobLogs.jobGroup, query.jobGroup))
  if (query.status) conds.push(eq(sysJobLogs.status, query.status))
  const where = conds.length > 0 ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(sysJobLogs)
      .where(where)
      .orderBy(desc(sysJobLogs.createTime))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sysJobLogs)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findJobLogById(id: number): Promise<SysJobLog | undefined> {
  const rows = await db.select().from(sysJobLogs).where(eq(sysJobLogs.jobLogId, id)).limit(1)
  return rows[0]
}

export interface CreateJobLogInput {
  jobName: string
  jobGroup: string
  invokeTarget: string
  jobMessage?: string
  status?: string
  exceptionInfo?: string
}

export async function createJobLog(data: CreateJobLogInput): Promise<SysJobLog | undefined> {
  const rows = await db.insert(sysJobLogs).values(data).returning()
  return rows[0]
}

export async function deleteJobLog(id: number): Promise<SysJobLog | undefined> {
  const rows = await db.delete(sysJobLogs).where(eq(sysJobLogs.jobLogId, id)).returning()
  return rows[0]
}

/** 清空全部任务日志。 */
export async function cleanJobLogs(): Promise<void> {
  await db.delete(sysJobLogs)
}

// =============================================================================
// sysDepts（serial 主键）
// =============================================================================

export interface DeptListQuery extends ListQuery {
  deptName?: string
  status?: string
}

export async function findDeptList(query: DeptListQuery = {}): Promise<SysDept[]> {
  const conds = []
  if (query.deptName) conds.push(ilike(sysDepts.deptName, `%${query.deptName}%`))
  if (query.status) conds.push(eq(sysDepts.status, query.status))
  conds.push(eq(sysDepts.delFlag, '0'))
  const where = and(...conds)
  return db.select().from(sysDepts).where(where).orderBy(asc(sysDepts.orderNum))
}

export async function findDeptById(id: number): Promise<SysDept | undefined> {
  const rows = await db.select().from(sysDepts).where(eq(sysDepts.deptId, id)).limit(1)
  return rows[0]
}

export interface CreateDeptInput {
  parentId?: number
  ancestors?: string
  deptName: string
  orderNum?: number
  leader?: string
  phone?: string
  email?: string
  status?: string
}

export async function createDept(data: CreateDeptInput): Promise<SysDept | undefined> {
  const rows = await db.insert(sysDepts).values(data).returning()
  return rows[0]
}

export interface UpdateDeptInput {
  parentId?: number
  ancestors?: string
  deptName?: string
  orderNum?: number
  leader?: string
  phone?: string
  email?: string
  status?: string
}

export async function updateDept(id: number, data: UpdateDeptInput): Promise<SysDept | undefined> {
  const rows = await db
    .update(sysDepts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sysDepts.deptId, id))
    .returning()
  return rows[0]
}

export async function deleteDept(id: number): Promise<SysDept | undefined> {
  const rows = await db.delete(sysDepts).where(eq(sysDepts.deptId, id)).returning()
  return rows[0]
}

// =============================================================================
// sysPosts（serial 主键）
// =============================================================================

export interface PostListQuery extends ListQuery {
  postCode?: string
  postName?: string
  status?: string
}

export async function findPostList(
  query: PostListQuery = {},
): Promise<{ list: SysPost[]; total: number }> {
  const { pageSize, offset } = paginate(query)
  const conds = []
  if (query.postCode) conds.push(ilike(sysPosts.postCode, `%${query.postCode}%`))
  if (query.postName) conds.push(ilike(sysPosts.postName, `%${query.postName}%`))
  if (query.status) conds.push(eq(sysPosts.status, query.status))
  const where = conds.length > 0 ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(sysPosts)
      .where(where)
      .orderBy(asc(sysPosts.postSort))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sysPosts)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findPostById(id: number): Promise<SysPost | undefined> {
  const rows = await db.select().from(sysPosts).where(eq(sysPosts.postId, id)).limit(1)
  return rows[0]
}

export interface CreatePostInput {
  postCode: string
  postName: string
  postSort?: number
  status?: string
  remark?: string
}

export async function createPost(data: CreatePostInput): Promise<SysPost | undefined> {
  const rows = await db.insert(sysPosts).values(data).returning()
  return rows[0]
}

export interface UpdatePostInput {
  postCode?: string
  postName?: string
  postSort?: number
  status?: string
  remark?: string
}

export async function updatePost(id: number, data: UpdatePostInput): Promise<SysPost | undefined> {
  const rows = await db
    .update(sysPosts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sysPosts.postId, id))
    .returning()
  return rows[0]
}

export async function deletePost(id: number): Promise<SysPost | undefined> {
  const rows = await db.delete(sysPosts).where(eq(sysPosts.postId, id)).returning()
  return rows[0]
}

export async function deletePostsBatch(ids: number[]): Promise<number> {
  const rows = await db.delete(sysPosts).where(inArray(sysPosts.postId, ids)).returning()
  return rows.length
}

// =============================================================================
// sysConfigs（serial 主键）
// =============================================================================

export interface ConfigListQuery extends ListQuery {
  configName?: string
  configKey?: string
  configType?: string
}

export async function findConfigList(
  query: ConfigListQuery = {},
): Promise<{ list: SysConfig[]; total: number }> {
  const { pageSize, offset } = paginate(query)
  const conds = []
  if (query.configName) conds.push(ilike(sysConfigs.configName, `%${query.configName}%`))
  if (query.configKey) conds.push(ilike(sysConfigs.configKey, `%${query.configKey}%`))
  if (query.configType) conds.push(eq(sysConfigs.configType, query.configType))
  const where = conds.length > 0 ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(sysConfigs)
      .where(where)
      .orderBy(desc(sysConfigs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sysConfigs)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findConfigById(id: number): Promise<SysConfig | undefined> {
  const rows = await db.select().from(sysConfigs).where(eq(sysConfigs.configId, id)).limit(1)
  return rows[0]
}

export async function findConfigByKey(key: string): Promise<SysConfig | undefined> {
  const rows = await db.select().from(sysConfigs).where(eq(sysConfigs.configKey, key)).limit(1)
  return rows[0]
}

export interface CreateConfigInput {
  configName: string
  configKey: string
  configValue?: string
  configType?: string
  createBy?: string
  remark?: string
}

export async function createConfig(data: CreateConfigInput): Promise<SysConfig | undefined> {
  const rows = await db.insert(sysConfigs).values(data).returning()
  return rows[0]
}

export interface UpdateConfigInput {
  configName?: string
  configKey?: string
  configValue?: string
  configType?: string
  updateBy?: string
  remark?: string
}

export async function updateConfig(
  id: number,
  data: UpdateConfigInput,
): Promise<SysConfig | undefined> {
  const rows = await db
    .update(sysConfigs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sysConfigs.configId, id))
    .returning()
  return rows[0]
}

export async function deleteConfig(id: number): Promise<SysConfig | undefined> {
  const rows = await db.delete(sysConfigs).where(eq(sysConfigs.configId, id)).returning()
  return rows[0]
}

export async function deleteConfigsBatch(ids: number[]): Promise<number> {
  const rows = await db.delete(sysConfigs).where(inArray(sysConfigs.configId, ids)).returning()
  return rows.length
}

// =============================================================================
// sysDictTypes（serial 主键）
// =============================================================================

export interface DictTypeListQuery extends ListQuery {
  dictName?: string
  dictType?: string
  status?: string
}

export async function findDictTypeList(
  query: DictTypeListQuery = {},
): Promise<{ list: SysDictType[]; total: number }> {
  const { pageSize, offset } = paginate(query)
  const conds = []
  if (query.dictName) conds.push(ilike(sysDictTypes.dictName, `%${query.dictName}%`))
  if (query.dictType) conds.push(ilike(sysDictTypes.dictType, `%${query.dictType}%`))
  if (query.status) conds.push(eq(sysDictTypes.status, query.status))
  const where = conds.length > 0 ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(sysDictTypes)
      .where(where)
      .orderBy(desc(sysDictTypes.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sysDictTypes)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findDictTypeById(id: number): Promise<SysDictType | undefined> {
  const rows = await db.select().from(sysDictTypes).where(eq(sysDictTypes.dictId, id)).limit(1)
  return rows[0]
}

export interface CreateDictTypeInput {
  dictName: string
  dictType: string
  status?: string
  createBy?: string
  remark?: string
}

export async function createDictType(data: CreateDictTypeInput): Promise<SysDictType | undefined> {
  const rows = await db.insert(sysDictTypes).values(data).returning()
  return rows[0]
}

export interface UpdateDictTypeInput {
  dictName?: string
  dictType?: string
  status?: string
  updateBy?: string
  remark?: string
}

export async function updateDictType(
  id: number,
  data: UpdateDictTypeInput,
): Promise<SysDictType | undefined> {
  const rows = await db
    .update(sysDictTypes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sysDictTypes.dictId, id))
    .returning()
  return rows[0]
}

export async function deleteDictType(id: number): Promise<SysDictType | undefined> {
  const rows = await db.delete(sysDictTypes).where(eq(sysDictTypes.dictId, id)).returning()
  return rows[0]
}

export async function deleteDictTypesBatch(ids: number[]): Promise<number> {
  const rows = await db.delete(sysDictTypes).where(inArray(sysDictTypes.dictId, ids)).returning()
  return rows.length
}

// =============================================================================
// sysDictData（serial 主键）
// =============================================================================

export interface DictDataListQuery extends ListQuery {
  dictType?: string
  dictLabel?: string
  status?: string
}

export async function findDictDataList(
  query: DictDataListQuery = {},
): Promise<{ list: SysDictData[]; total: number }> {
  const { pageSize, offset } = paginate(query)
  const conds = []
  if (query.dictType) conds.push(eq(sysDictData.dictType, query.dictType))
  if (query.dictLabel) conds.push(ilike(sysDictData.dictLabel, `%${query.dictLabel}%`))
  if (query.status) conds.push(eq(sysDictData.status, query.status))
  const where = conds.length > 0 ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(sysDictData)
      .where(where)
      .orderBy(asc(sysDictData.dictSort))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sysDictData)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findDictDataById(id: number): Promise<SysDictData | undefined> {
  const rows = await db.select().from(sysDictData).where(eq(sysDictData.dictCode, id)).limit(1)
  return rows[0]
}

export async function findDictDataByType(dictType: string): Promise<SysDictData[]> {
  return db
    .select()
    .from(sysDictData)
    .where(and(eq(sysDictData.dictType, dictType), eq(sysDictData.status, '0')))
    .orderBy(asc(sysDictData.dictSort))
}

export interface CreateDictDataInput {
  dictSort?: number
  dictLabel: string
  dictValue: string
  dictType: string
  cssClass?: string
  listClass?: string
  isDefault?: string
  status?: string
  createBy?: string
  remark?: string
}

export async function createDictData(data: CreateDictDataInput): Promise<SysDictData | undefined> {
  const rows = await db.insert(sysDictData).values(data).returning()
  return rows[0]
}

export interface UpdateDictDataInput {
  dictSort?: number
  dictLabel?: string
  dictValue?: string
  dictType?: string
  cssClass?: string
  listClass?: string
  isDefault?: string
  status?: string
  updateBy?: string
  remark?: string
}

export async function updateDictData(
  id: number,
  data: UpdateDictDataInput,
): Promise<SysDictData | undefined> {
  const rows = await db
    .update(sysDictData)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(sysDictData.dictCode, id))
    .returning()
  return rows[0]
}

export async function deleteDictData(id: number): Promise<SysDictData | undefined> {
  const rows = await db.delete(sysDictData).where(eq(sysDictData.dictCode, id)).returning()
  return rows[0]
}

export async function deleteDictDataBatch(ids: number[]): Promise<number> {
  const rows = await db.delete(sysDictData).where(inArray(sysDictData.dictCode, ids)).returning()
  return rows.length
}

// =============================================================================
// sysOperlog（bigserial 主键）
// =============================================================================

export interface OperlogListQuery extends ListQuery {
  title?: string
  businessType?: number
  operName?: string
  status?: number
}

export async function findOperlogList(
  query: OperlogListQuery = {},
): Promise<{ list: SysOperlog[]; total: number }> {
  const { pageSize, offset } = paginate(query)
  const conds = []
  if (query.title) conds.push(ilike(sysOperlog.title, `%${query.title}%`))
  if (query.businessType !== undefined) conds.push(eq(sysOperlog.businessType, query.businessType))
  if (query.operName) conds.push(ilike(sysOperlog.operName, `%${query.operName}%`))
  if (query.status !== undefined) conds.push(eq(sysOperlog.status, query.status))
  const where = conds.length > 0 ? and(...conds) : undefined

  const [list, totalRows] = await Promise.all([
    db
      .select()
      .from(sysOperlog)
      .where(where)
      .orderBy(desc(sysOperlog.operTime))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sysOperlog)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function deleteOperlogsBatch(ids: number[]): Promise<number> {
  const rows = await db.delete(sysOperlog).where(inArray(sysOperlog.operId, ids)).returning()
  return rows.length
}

/** 清空全部操作日志。 */
export async function cleanOperlogs(): Promise<void> {
  await db.delete(sysOperlog)
}

export interface CreateOperlogInput {
  title: string
  businessType: number
  method: string
  requestMethod: string
  operatorType?: number
  operName?: string
  deptName?: string
  operUrl?: string
  operIp?: string
  operParam?: string
  jsonResult?: string
  status?: number
  errorMsg?: string
  costTime?: number
}

export async function createOperlog(data: CreateOperlogInput): Promise<SysOperlog | undefined> {
  const rows = await db.insert(sysOperlog).values(data).returning()
  return rows[0]
}

// =============================================================================
// adminRole（serial 主键，历史 admin_role 表，含 dataScope/status）
// 供 role/changeStatus、role/dataScope、role/deptTree 路由使用。
// 注：rbac.ts 的 userRoles 表用 uuid roleId，与前端数值 roleId 不兼容，
//   故 5 个 authUser 路由（allocatedList/unallocatedList/cancel/cancelAll/selectAll）跳过。
// =============================================================================

export async function updateAdminRoleStatus(
  roleId: number,
  status: string,
): Promise<AdminRole | undefined> {
  const rows = await db
    .update(adminRole)
    .set({ status, updateTime: new Date() })
    .where(eq(adminRole.roleId, roleId))
    .returning()
  return rows[0]
}

export async function updateAdminRoleDataScope(
  roleId: number,
  dataScope: string,
  deptIds: number[] = [],
): Promise<AdminRole | undefined> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(adminRole)
      .set({ dataScope, updateTime: new Date() })
      .where(eq(adminRole.roleId, roleId))
      .returning()
    await tx.delete(adminRoleDept).where(eq(adminRoleDept.roleId, roleId))
    if (deptIds.length > 0) {
      await tx
        .insert(adminRoleDept)
        .values(deptIds.map((deptId) => ({ roleId, deptId })))
        .onConflictDoNothing()
    }
    return rows[0]
  })
}

export async function findAdminRoleDeptIds(roleId: number): Promise<number[]> {
  const rows = await db
    .select({ deptId: adminRoleDept.deptId })
    .from(adminRoleDept)
    .where(eq(adminRoleDept.roleId, roleId))
  return rows.map((r) => r.deptId)
}

// =============================================================================
// 角色-用户管理 (基于 users.roleId,不新建 sys_user_role 表避免数据冗余)
// 5 端点:allocatedList / unallocatedList / cancel / cancelAll / selectAll
// 设计:users.roleId (integer) 与 adminRole.roleId (serial) 类型兼容,
//       "分配角色"= UPDATE users SET roleId = ?, "取消角色"= UPDATE users SET roleId = 0
// =============================================================================

export interface RoleUserListQuery extends ListQuery {
  roleId: number
  userName?: string
  phonenumber?: string
}

export type RoleUserRow = {
  id: string
  username: string | null
  nickname: string | null
  avatar: string | null
  email: string | null
  phone: string | null
  status: number
  roleId: number | null
  deptId: number | null
  createdAt: Date | null
}

function buildRoleUserConds(query: RoleUserListQuery, allocated: boolean) {
  const conds = []
  if (allocated) {
    conds.push(eq(users.roleId, query.roleId))
  } else {
    conds.push(or(ne(users.roleId, query.roleId), isNull(users.roleId)))
  }
  if (query.userName) {
    conds.push(
      or(
        ilike(users.username, `%${query.userName}%`),
        ilike(users.nickname, `%${query.userName}%`),
      ),
    )
  }
  if (query.phonenumber) {
    conds.push(ilike(users.phone, `%${query.phonenumber}%`))
  }
  return and(...conds)
}

export async function findAllocatedUsers(
  query: RoleUserListQuery,
): Promise<{ list: RoleUserRow[]; total: number }> {
  const { pageSize, offset } = paginate(query)
  const where = buildRoleUserConds(query, true)
  const [list, totalRows] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        avatar: users.avatar,
        email: users.email,
        phone: users.phone,
        status: users.status,
        roleId: users.roleId,
        deptId: users.deptId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function findUnallocatedUsers(
  query: RoleUserListQuery,
): Promise<{ list: RoleUserRow[]; total: number }> {
  const { pageSize, offset } = paginate(query)
  const where = buildRoleUserConds(query, false)
  const [list, totalRows] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        avatar: users.avatar,
        email: users.email,
        phone: users.phone,
        status: users.status,
        roleId: users.roleId,
        deptId: users.deptId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(where),
  ])
  return { list, total: Number(totalRows[0]?.count ?? 0) }
}

export async function cancelUserRole(userId: string, roleId: number): Promise<number> {
  const rows = await db
    .update(users)
    .set({ roleId: 0, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.roleId, roleId)))
    .returning({ id: users.id })
  return rows.length
}

export async function cancelAllUserRole(userIds: string[], roleId: number): Promise<number> {
  if (userIds.length === 0) return 0
  const rows = await db
    .update(users)
    .set({ roleId: 0, updatedAt: new Date() })
    .where(and(inArray(users.id, userIds), eq(users.roleId, roleId)))
    .returning({ id: users.id })
  return rows.length
}

export async function selectAllUserRole(userIds: string[], roleId: number): Promise<number> {
  if (userIds.length === 0) return 0
  const rows = await db
    .update(users)
    .set({ roleId, updatedAt: new Date() })
    .where(inArray(users.id, userIds))
    .returning({ id: users.id })
  return rows.length
}
