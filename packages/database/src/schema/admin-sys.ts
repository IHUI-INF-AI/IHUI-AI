import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  serial,
  bigint,
  bigserial,
} from 'drizzle-orm/pg-core';

/**
 * 菜单权限表（sys_menu）。
 * menu_type: M=目录, C=菜单, F=按钮。
 * 存储系统菜单/权限树，parent_id 为空表示根节点。
 */
export const sysMenus = pgTable('sys_menu', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id'),
  menuName: varchar('menu_name', { length: 128 }).notNull(),
  orderNum: integer('order_num').default(0).notNull(),
  path: varchar('path', { length: 200 }),
  component: varchar('component', { length: 255 }),
  query: varchar('query', { length: 255 }),
  isFrame: boolean('is_frame').default(false).notNull(),
  isCache: boolean('is_cache').default(false).notNull(),
  menuType: varchar('menu_type', { length: 1 }).default('C').notNull(),
  visible: varchar('visible', { length: 1 }).default('0').notNull(),
  status: varchar('status', { length: 1 }).default('0').notNull(),
  perms: varchar('perms', { length: 100 }),
  icon: varchar('icon', { length: 100 }),
  createBy: varchar('create_by', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updateBy: varchar('update_by', { length: 64 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  remark: varchar('remark', { length: 500 }),
});

/**
 * 登录日志表（sys_logininfor）。
 * 记录用户登录/登出行为，info_id 为 bigserial 自增主键。
 */
export const sysLogininfor = pgTable('sys_logininfor', {
  infoId: bigserial('info_id', { mode: 'number' }).primaryKey(),
  loginName: varchar('login_name', { length: 50 }),
  ipaddr: varchar('ipaddr', { length: 50 }),
  loginLocation: varchar('login_location', { length: 255 }),
  browser: varchar('browser', { length: 50 }),
  os: varchar('os', { length: 50 }),
  status: varchar('status', { length: 1 }).default('0').notNull(),
  msg: varchar('msg', { length: 255 }),
  loginTime: timestamp('login_time', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 通知公告表（sys_notice）。
 * notice_type: 1=通知, 2=公告。
 */
export const sysNotices = pgTable('sys_notice', {
  noticeId: serial('notice_id').primaryKey(),
  noticeTitle: varchar('notice_title', { length: 50 }).notNull(),
  noticeType: varchar('notice_type', { length: 1 }).notNull(),
  noticeContent: text('notice_content'),
  status: varchar('status', { length: 1 }).default('0').notNull(),
  createBy: varchar('create_by', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updateBy: varchar('update_by', { length: 64 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  remark: varchar('remark', { length: 255 }),
});

/**
 * 定时任务表（sys_job）。
 * misfire_policy: 1=立即执行, 2=执行一次, 3=放弃执行。
 * concurrent: 0=允许, 1=禁止。
 */
export const sysJobs = pgTable('sys_job', {
  jobId: serial('job_id').primaryKey(),
  jobName: varchar('job_name', { length: 64 }).notNull(),
  jobGroup: varchar('job_group', { length: 64 }).default('DEFAULT').notNull(),
  invokeTarget: varchar('invoke_target', { length: 500 }).notNull(),
  cronExpression: varchar('cron_expression', { length: 255 }).notNull(),
  misfirePolicy: varchar('misfire_policy', { length: 20 }).default('3').notNull(),
  concurrent: varchar('concurrent', { length: 1 }).default('1').notNull(),
  status: varchar('status', { length: 1 }).default('0').notNull(),
  createBy: varchar('create_by', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updateBy: varchar('update_by', { length: 64 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  remark: varchar('remark', { length: 500 }),
});

/**
 * 定时任务日志表（sys_job_log）。
 * 记录每次任务执行的结果与异常信息。
 */
export const sysJobLogs = pgTable('sys_job_log', {
  jobLogId: serial('job_log_id').primaryKey(),
  jobName: varchar('job_name', { length: 64 }).notNull(),
  jobGroup: varchar('job_group', { length: 64 }).notNull(),
  invokeTarget: varchar('invoke_target', { length: 500 }).notNull(),
  jobMessage: varchar('job_message', { length: 500 }),
  status: varchar('status', { length: 1 }).default('0').notNull(),
  exceptionInfo: varchar('exception_info', { length: 2000 }),
  createTime: timestamp('create_time', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 部门表（sys_dept）。
 * parent_id/ancestors 构建部门树形结构，del_flag 标记逻辑删除。
 */
export const sysDepts = pgTable('sys_dept', {
  deptId: serial('dept_id').primaryKey(),
  parentId: bigint('parent_id', { mode: 'number' }).default(0).notNull(),
  ancestors: varchar('ancestors', { length: 50 }).default('0').notNull(),
  deptName: varchar('dept_name', { length: 30 }).notNull(),
  orderNum: integer('order_num').default(0).notNull(),
  leader: varchar('leader', { length: 20 }),
  phone: varchar('phone', { length: 11 }),
  email: varchar('email', { length: 50 }),
  status: varchar('status', { length: 1 }).default('0').notNull(),
  delFlag: varchar('del_flag', { length: 1 }).default('0').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 岗位表（sys_post）。
 */
export const sysPosts = pgTable('sys_post', {
  postId: serial('post_id').primaryKey(),
  postCode: varchar('post_code', { length: 64 }).notNull(),
  postName: varchar('post_name', { length: 50 }).notNull(),
  postSort: integer('post_sort').default(0).notNull(),
  status: varchar('status', { length: 1 }).default('0').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  remark: varchar('remark', { length: 500 }),
});

/**
 * 系统参数配置表（sys_config）。
 * config_type: Y=系统内置, N=非内置。
 */
export const sysConfigs = pgTable('sys_config', {
  configId: serial('config_id').primaryKey(),
  configName: varchar('config_name', { length: 100 }).notNull(),
  configKey: varchar('config_key', { length: 100 }).notNull(),
  configValue: varchar('config_value', { length: 500 }),
  configType: varchar('config_type', { length: 1 }).default('N').notNull(),
  createBy: varchar('create_by', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updateBy: varchar('update_by', { length: 64 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  remark: varchar('remark', { length: 500 }),
});

/**
 * 字典类型表（sys_dict_type）。
 */
export const sysDictTypes = pgTable('sys_dict_type', {
  dictId: serial('dict_id').primaryKey(),
  dictName: varchar('dict_name', { length: 100 }).notNull(),
  dictType: varchar('dict_type', { length: 100 }).notNull(),
  status: varchar('status', { length: 1 }).default('0').notNull(),
  createBy: varchar('create_by', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updateBy: varchar('update_by', { length: 64 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  remark: varchar('remark', { length: 500 }),
});

/**
 * 字典数据表（sys_dict_data）。
 * 通过 dict_type 关联字典类型，is_default: Y=是, N=否。
 */
export const sysDictData = pgTable('sys_dict_data', {
  dictCode: serial('dict_code').primaryKey(),
  dictSort: integer('dict_sort').default(0).notNull(),
  dictLabel: varchar('dict_label', { length: 100 }).notNull(),
  dictValue: varchar('dict_value', { length: 100 }).notNull(),
  dictType: varchar('dict_type', { length: 100 }).notNull(),
  cssClass: varchar('css_class', { length: 100 }),
  listClass: varchar('list_class', { length: 100 }),
  isDefault: varchar('is_default', { length: 1 }).default('N').notNull(),
  status: varchar('status', { length: 1 }).default('0').notNull(),
  createBy: varchar('create_by', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updateBy: varchar('update_by', { length: 64 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  remark: varchar('remark', { length: 500 }),
});

export type SysMenu = typeof sysMenus.$inferSelect;
export type NewSysMenu = typeof sysMenus.$inferInsert;
export type SysLogininfor = typeof sysLogininfor.$inferSelect;
export type NewSysLogininfor = typeof sysLogininfor.$inferInsert;
export type SysNotice = typeof sysNotices.$inferSelect;
export type NewSysNotice = typeof sysNotices.$inferInsert;
export type SysJob = typeof sysJobs.$inferSelect;
export type NewSysJob = typeof sysJobs.$inferInsert;
export type SysJobLog = typeof sysJobLogs.$inferSelect;
export type NewSysJobLog = typeof sysJobLogs.$inferInsert;
export type SysDept = typeof sysDepts.$inferSelect;
export type NewSysDept = typeof sysDepts.$inferInsert;
export type SysPost = typeof sysPosts.$inferSelect;
export type NewSysPost = typeof sysPosts.$inferInsert;
export type SysConfig = typeof sysConfigs.$inferSelect;
export type NewSysConfig = typeof sysConfigs.$inferInsert;
export type SysDictType = typeof sysDictTypes.$inferSelect;
export type NewSysDictType = typeof sysDictTypes.$inferInsert;
export type SysDictData = typeof sysDictData.$inferSelect;
export type NewSysDictData = typeof sysDictData.$inferInsert;
