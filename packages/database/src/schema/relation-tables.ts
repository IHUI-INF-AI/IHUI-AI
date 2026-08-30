/**
 * 关系表与缺失表补全 schema（等价自旧架构 server/app/models/*_models.py）。
 * 涵盖：考试/学习/圈子/行为/消息/通知/积分/资源 关系表，Admin 域缺失表，以及其他历史遗留表。
 *
 * 表命名与旧架构保持一致（如 exam_exam / circle_circle / resource_resource 等历史命名）。
 * 主键统一使用 serial（对应旧架构 BigInteger id_column）。
 */
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core'

// ===========================================================================
// 1. Exam 考试关系表（等价自 exam_ext_models.py）
// ===========================================================================

/** 考试分类关系（树形结构父子关系） */

/** 考试（历史 exam_exam） */
export const examExam = pgTable(
  'exam_exam',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    code: varchar('code', { length: 100 }).notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    image: varchar('image', { length: 1000 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    phrase: varchar('phrase', { length: 255 }).default('').notNull(),
    introduction: varchar('introduction', { length: 3000 }).default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('idx_exam_exam_status').on(t.status),
  }),
)

/** 考试与分类关系 */

/** 考试章 */

/** 考试章节 */

/** 考试报名（历史 exam_sign_up） */
export const examSignUp = pgTable(
  'exam_sign_up',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    examId: integer('exam_id').notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    completedTime: timestamp('completed_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('idx_esu_member').on(t.memberId),
    examIdx: index('idx_esu_exam').on(t.examId),
    statusIdx: index('idx_esu_status').on(t.status),
  }),
)

/** 试卷分类 */

/** 试卷分类与试卷分类关系（树形结构） */

/** 试卷与试卷分类关系 */

/** 试卷题目 */
export const examPaperQuestion = pgTable(
  'exam_paper_question',
  {
    id: serial('id').primaryKey(),
    questionId: integer('question_id').notNull(),
    paperId: integer('paper_id').notNull(),
    sortOrder: integer('sort_order').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    paperIdx: index('idx_epq_paper').on(t.paperId),
    questionIdx: index('idx_epq_question').on(t.questionId),
  }),
)

/** 试卷题目抽题规则 */
export const examPaperQuestionRule = pgTable(
  'exam_paper_question_rule',
  {
    id: serial('id').primaryKey(),
    paperId: integer('paper_id').notNull(),
    ruleJson: jsonb('rule_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    paperIdx: index('idx_epqr_paper').on(t.paperId),
  }),
)

/** 题目分类 */

/** 题目分类与题目分类关系（树形结构） */

/** 题目与题目分类关系 */

// ===========================================================================
// 2. Learn 学习关系表（等价自 learn_models.py）
// ===========================================================================

/** 课程分类关系（树形结构父子关系） */

/** 课程与分类关系 */

/** 学习模块订单（历史 learn_order） */

/** 课程报名（历史 learn_sign_up） */

// ===========================================================================
// 3. Circle 圈子关系表（等价自 circle_ext_models.py）
// ===========================================================================

/** 圈子分类关系（树形结构父子关系） */
export const circleCategoryRelation = pgTable(
  'circle_category_relation',
  {
    id: serial('id').primaryKey(),
    childCategoryId: integer('child_category_id').notNull(),
    fatherCategoryId: integer('father_category_id').notNull(),
    directFatherCategoryId: integer('direct_father_category_id').notNull(),
    isSub: boolean('is_sub').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    fatherIdx: index('idx_ccr_father').on(t.fatherCategoryId),
    childIdx: index('idx_ccr_child').on(t.childCategoryId),
  }),
)

/** 圈子（历史 circle_circle） */
export const circleCircle = pgTable(
  'circle_circle',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    memberId: integer('member_id').notNull(),
    image: varchar('image', { length: 3000 }),
    status: varchar('status', { length: 100 }).notNull(),
    introduction: varchar('introduction', { length: 200 }).default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('idx_cc_member').on(t.memberId),
  }),
)

/** 圈子类目关系 */
export const circleCircleCategoryRelation = pgTable(
  'circle_circle_category_relation',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id').notNull(),
    circleId: integer('circle_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('idx_cccr_category').on(t.categoryId),
    circleIdx: index('idx_cccr_circle').on(t.circleId),
  }),
)

/** 圈子会员 */

/** 圈子动态 */
export const circleDynamic = pgTable(
  'circle_dynamic',
  {
    id: serial('id').primaryKey(),
    content: text('content').notNull(),
    memberId: integer('member_id').notNull(),
    image: varchar('image', { length: 3000 }).default(''),
    status: varchar('status', { length: 100 }).notNull(),
    circleId: integer('circle_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    circleIdx: index('idx_cd_circle').on(t.circleId),
    memberIdx: index('idx_cd_member').on(t.memberId),
  }),
)

// ===========================================================================
// 4. Behavior 行为表（等价自 behavior_models.py）
// ===========================================================================

/** 通用评论表 */

/** 通用收藏表 */
export const behaviorFavorite = pgTable(
  'behavior_favorite',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    userName: varchar('user_name', { length: 100 }),
    targetType: varchar('target_type', { length: 50 }).notNull(),
    targetId: integer('target_id').notNull(),
    folder: varchar('folder', { length: 50 }).default('default'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_bf_user').on(t.userId),
    targetIdx: index('idx_bf_target').on(t.targetType, t.targetId),
  }),
)

/** 关注关系 */

/** 通用点赞表 */

/** 举报 */

/** 敏感词 */

/** 分享记录 */

// ===========================================================================
// 5. Message 消息子类型表（等价自 message_models.py / message_ext_models.py）
// ===========================================================================

/** 系统通知（历史 message_system_notice） */
export const messageSystemNotice = pgTable('message_system_notice', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 私信（历史 message_private_letter） */
export const messagePrivateLetter = pgTable(
  'message_private_letter',
  {
    id: serial('id').primaryKey(),
    senderId: varchar('sender_id', { length: 100 }).notNull(),
    receiverId: varchar('receiver_id', { length: 100 }).notNull(),
    content: text('content').notNull(),
    readTime: timestamp('read_time', { withTimezone: true }),
    isRead: boolean('is_read').default(false).notNull(),
    status: varchar('status', { length: 30 }).default('normal').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    senderIdx: index('idx_mpl_sender').on(t.senderId),
    receiverIdx: index('idx_mpl_receiver').on(t.receiverId),
  }),
)

// ===========================================================================
// 6. Notification 通知表（等价自 notification_models.py）
// ===========================================================================

/** 通知渠道配置 */
export const notificationChannel = pgTable(
  'notification_channel',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 50 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    config: text('config'),
    isDefault: boolean('is_default').default(false),
    status: integer('status').default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_notification_channel_status').on(t.status),
  }),
)

/** 通知发送日志 */
export const notificationLog = pgTable(
  'notification_log',
  {
    id: serial('id').primaryKey(),
    notificationId: integer('notification_id').notNull(),
    userId: varchar('user_id', { length: 64 }),
    channel: varchar('channel', { length: 50 }),
    type: varchar('type', { length: 20 }),
    success: boolean('success').default(false),
    response: text('response'),
    error: varchar('error', { length: 500 }),
    sendTime: timestamp('send_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    notifIdx: index('idx_nl_notif').on(t.notificationId),
    timeIdx: index('idx_nl_time').on(t.sendTime),
    userIdx: index('ix_notification_log_user_id').on(t.userId),
  }),
)

/** 用户通知订阅偏好 */

// ===========================================================================
// 7. Point 积分商城表（等价自 point_models.py）
// ===========================================================================

/** 积分兑换记录 */

/** 积分商品（兑换） */

/** 积分规则 */
export const pointRule = pgTable(
  'point_rule',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    type: varchar('type', { length: 20 }).default('add'),
    action: varchar('action', { length: 50 }).notNull(),
    point: integer('point').default(0),
    maxPerDay: integer('max_per_day').default(0),
    description: varchar('description', { length: 500 }),
    status: integer('status').default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_point_rule_status').on(t.status),
  }),
)

// ===========================================================================
// 8. Resource 资源关系表（等价自 resource_ext_models.py）
// ===========================================================================

/** 资源分类关系（树形结构父子关系） */

/** 资源（历史 resource_resource） */

/** 资源类目关系 */

/** 会员下载记录 */

/** 会员搜索记录 */

// ===========================================================================
// 9. Admin 域缺失表（等价自 admin_models.py）
// ===========================================================================

/** 角色表（历史 admin_role） */
export const adminRole = pgTable('admin_role', {
  roleId: serial('role_id').primaryKey(),
  roleName: varchar('role_name', { length: 30 }).notNull(),
  roleKey: varchar('role_key', { length: 100 }).notNull(),
  roleSort: integer('role_sort').notNull(),
  dataScope: varchar('data_scope', { length: 1 }).default('1'),
  menuCheckStrictly: integer('menu_check_strictly').default(1),
  deptCheckStrictly: integer('dept_check_strictly').default(1),
  status: varchar('status', { length: 1 }).default('0'),
  delFlag: varchar('del_flag', { length: 1 }).default('0'),
  createBy: varchar('create_by', { length: 64 }),
  createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
  updateBy: varchar('update_by', { length: 64 }),
  updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
  remark: varchar('remark', { length: 500 }),
})

/** 角色-部门关联表（历史 admin_role_dept，复合主键） */
export const adminRoleDept = pgTable(
  'admin_role_dept',
  {
    roleId: integer('role_id').notNull(),
    deptId: integer('dept_id').notNull(),
  },
  (t) => ({
    pk: unique('admin_role_dept_pk').on(t.roleId, t.deptId),
  }),
)

/** 角色-菜单关联表（历史 admin_role_menu，复合主键） */
export const adminRoleMenu = pgTable(
  'admin_role_menu',
  {
    roleId: integer('role_id').notNull(),
    menuId: integer('menu_id').notNull(),
  },
  (t) => ({
    pk: unique('admin_role_menu_pk').on(t.roleId, t.menuId),
  }),
)

/** 用户表（历史 admin_user） */
export const adminUser = pgTable(
  'admin_user',
  {
    userId: serial('user_id').primaryKey(),
    userUuid: varchar('user_uuid', { length: 36 }).unique(),
    deptId: integer('dept_id'),
    userName: varchar('user_name', { length: 30 }).notNull(),
    nickName: varchar('nick_name', { length: 30 }).notNull(),
    email: varchar('email', { length: 50 }),
    phonenumber: varchar('phone', { length: 11 }),
    sex: varchar('sex', { length: 1 }).default('0'),
    avatar: varchar('avatar', { length: 100 }),
    password: varchar('password', { length: 100 }),
    status: varchar('status', { length: 1 }).default('0'),
    delFlag: varchar('del_flag', { length: 1 }).default('0'),
    loginIp: varchar('login_ip', { length: 128 }),
    loginDate: timestamp('login_date', { withTimezone: true }),
    createBy: varchar('create_by', { length: 64 }),
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow(),
    updateBy: varchar('update_by', { length: 64 }),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow(),
    remark: varchar('remark', { length: 500 }),
  },
  (t) => ({
    createByIdx: index('ix_admin_user_create_by').on(t.createBy),
    updateByIdx: index('ix_admin_user_update_by').on(t.updateBy),
  }),
)

/** 用户-角色关联表（历史 admin_user_role，复合主键） */
export const adminUserRole = pgTable(
  'admin_user_role',
  {
    userId: integer('user_id').notNull(),
    roleId: integer('role_id').notNull(),
  },
  (t) => ({
    pk: unique('admin_user_role_pk').on(t.userId, t.roleId),
  }),
)

// ===========================================================================
// 10. 其他缺失表
// ===========================================================================

/** 搜索日志（历史 search_log） */

/** 文章（历史 t_article） */
export const tArticle = pgTable(
  't_article',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 100 }).notNull(),
    memberId: integer('member_id').notNull(),
    content: text('content').notNull(),
    image: varchar('image', { length: 3000 }),
    tags: varchar('tags', { length: 3000 }),
    keywords: varchar('keywords', { length: 3000 }),
    status: varchar('status', { length: 100 }).notNull(),
    introduction: varchar('introduction', { length: 200 }).default('').notNull(),
    recommend: boolean('recommend').default(false).notNull(),
    top: boolean('top').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('idx_article_status').on(t.status),
    memberIdx: index('idx_article_member_id').on(t.memberId),
  }),
)

/** 会员公司表（历史 t_member_company） */

/** 订单商品（历史 t_order_item） */
export const tOrderItem = pgTable(
  't_order_item',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id').notNull(),
    itemId: varchar('item_id', { length: 100 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    image: varchar('image', { length: 2000 }).notNull(),
    originalPrice: numeric('original_price', { precision: 14, scale: 2 }).notNull(),
    price: numeric('price', { precision: 14, scale: 2 }).notNull(),
    quantity: integer('quantity').notNull(),
    paymentAmount: numeric('payment_amount', { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orderIdx: index('idx_order_item_order').on(t.orderId),
  }),
)

/** 订单支付（历史 t_order_payment） */

/** 页面统计（历史 visit_page） */

/** 访问来源（历史 visit_source） */

/** 访问统计-汇总（历史 visit_stats） */

