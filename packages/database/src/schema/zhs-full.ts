/**
 * ZHS 智慧树域完整 schema（迁移自旧架构 course_models / education_ext_models /
 * activity_models / agent_rule_models / app_content_models / resource_models /
 * payment_models / user_models）。
 * 涵盖：课程 / 审核 / 支付 / 活动 / Agent / 内容 / 资源 / 用户 等模块。
 */
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  real,
  bigint,
  index,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// 活动与 Agent 模块
// ---------------------------------------------------------------------------

/** 促销活动表 */
export const zhsActivity = pgTable(
  'zhs_activity',
  {
    id: serial('id').primaryKey(),
    activityName: varchar('activity_name', { length: 255 }),
    activityRule: text('activity_rule'),
    activityRecharge: text('activity_recharge'),
    multiple: integer('multiple'),
    computing: bigint('computing', { mode: 'number' }),
    beginTime: timestamp('begin_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    status: integer('status'),
    beginAmount: integer('begin_amount'),
    creator: varchar('creator', { length: 255 }),
    updator: varchar('updator', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_activity_status_idx').on(t.status) }),
)

/** Agent 定价/配置表 */
export const zhsAgentCategory = pgTable('zhs_agent_category', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 64 }),
  group: integer('group').default(2).notNull(),
  type: varchar('type', { length: 10 }).default('1').notNull(),
  typeChild: varchar('type_child', { length: 10 }).default('1').notNull(),
  limitFree: varchar('limit_free', { length: 10 }),
  account: integer('account').default(0).notNull(),
  createTime: timestamp('create_time', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** Agent 开发者关系表 */
export const zhsAgentDeveloper = pgTable(
  'zhs_agent_developer',
  {
    id: serial('id').primaryKey(),
    agentId: varchar('agent_id', { length: 64 }).notNull(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    orderNo: varchar('order_no', { length: 64 }),
    status: integer('status').default(1).notNull(),
    price: real('price'),
    type: varchar('type', { length: 20 }),
    count: integer('count'),
    expirationDate: timestamp('expiration_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('zhs_agent_developer_user_idx').on(t.userId),
    statusIdx: index('zhs_agent_developer_status_idx').on(t.status),
  }),
)

/** Agent 需求任务表 */
export const zhsAgentNeedTask = pgTable(
  'zhs_agent_need_task',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    agentId: varchar('agent_id', { length: 64 }).default('').notNull(),
    taskName: varchar('task_name', { length: 128 }).notNull(),
    taskDesc: text('task_desc'),
    rewardTokens: integer('reward_tokens').default(0).notNull(),
    status: integer('status').default(0).notNull(),
    acceptUserId: varchar('accept_user_id', { length: 64 }).default('').notNull(),
    deadline: timestamp('deadline', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('zhs_agent_need_task_user_idx').on(t.userId),
    agentIdx: index('zhs_agent_need_task_agent_idx').on(t.agentId),
    statusIdx: index('zhs_agent_need_task_status_idx').on(t.status),
  }),
)

/** AI 模型信息表 */
export const zhsAiModelInfo = pgTable(
  'zhs_ai_model_info',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    source: varchar('source', { length: 100 }),
    icon: varchar('icon', { length: 500 }),
    description: text('description'),
    status: integer('status').default(1).notNull(),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_ai_model_info_status_idx').on(t.status) }),
)

/** 开发者-Coze 账号关联表 */
export const zhsDeveloperLink = pgTable(
  'zhs_developer_link',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    cozeAccountId: varchar('coze_account_id', { length: 64 }),
    cozeAccountName: varchar('coze_account_name', { length: 200 }),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('zhs_developer_link_user_idx').on(t.userId),
    statusIdx: index('zhs_developer_link_status_idx').on(t.status),
  }),
)

/** 用户模型聊天记录表 */
export const zhsUserModelChat = pgTable('zhs_user_model_chat', {
  id: serial('id').primaryKey(),
  userUuid: varchar('user_uuid', { length: 64 }).notNull(),
  modelName: varchar('model_name', { length: 100 }).notNull(),
  mark: varchar('mark', { length: 500 }),
  createTime: timestamp('create_time', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// 内容模块
// ---------------------------------------------------------------------------

/** 轮播图表 */
export const zhsBannerCarousel = pgTable(
  'zhs_banner_carousel',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }),
    imageUrl: varchar('image_url', { length: 500 }),
    linkUrl: varchar('link_url', { length: 500 }),
    position: varchar('position', { length: 50 }),
    status: integer('status').default(1).notNull(),
    sort: integer('sort').default(0).notNull(),
    isActive: integer('is_active').default(1).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_banner_carousel_status_idx').on(t.status) }),
)

/** 分类字典表 */
export const zhsCategoryDictionary = pgTable(
  'zhs_category_dictionary',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }),
    code: varchar('code', { length: 50 }),
    parentId: integer('parent_id').default(0).notNull(),
    type: varchar('type', { length: 50 }),
    status: integer('status').default(1).notNull(),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    parentIdx: index('zhs_category_dictionary_parent_idx').on(t.parentId),
    statusIdx: index('zhs_category_dictionary_status_idx').on(t.status),
  }),
)

/** 资讯信息表 */
export const zhsInformation = pgTable(
  'zhs_information',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 300 }),
    content: text('content'),
    type: integer('type'),
    status: integer('status').default(1).notNull(),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_information_status_idx').on(t.status) }),
)

/** 产品表 */
export const zhsProduct = pgTable(
  'zhs_product',
  {
    id: serial('id').primaryKey(),
    productUuid: varchar('product_uuid', { length: 64 }),
    name: varchar('name', { length: 200 }),
    price: bigint('price', { mode: 'number' }),
    tokenAmount: bigint('token_amount', { mode: 'number' }),
    type: varchar('type', { length: 50 }),
    status: integer('status').default(1).notNull(),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_product_status_idx').on(t.status) }),
)

/** 知识星球表 */
export const zhsKnowledgePlanet = pgTable(
  'zhs_knowledge_planet',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 200 }),
    description: text('description'),
    cover: varchar('cover', { length: 500 }),
    price: bigint('price', { mode: 'number' }),
    type: varchar('type', { length: 50 }),
    status: integer('status').default(1).notNull(),
    sort: integer('sort').default(0).notNull(),
    creator: varchar('creator', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_knowledge_planet_status_idx').on(t.status) }),
)

// ---------------------------------------------------------------------------
// 课程模块
// ---------------------------------------------------------------------------

/** 课程主表 */
export const zhsCourse = pgTable('zhs_course', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  subtitle: text('subtitle'),
  content: text('content'),
  remark: text('remark'),
  remarkFile: varchar('remark_file', { length: 500 }),
  binding: varchar('binding', { length: 500 }),
  stage: varchar('stage', { length: 50 }),
  isHidden: integer('is_hidden').default(0).notNull(),
  isDel: integer('is_del').default(0).notNull(),
  sort: integer('sort').default(0).notNull(),
  creator: varchar('creator', { length: 100 }),
  label: varchar('label', { length: 100 }),
  auditStatus: integer('audit_status').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 课程主表（新架构，UUID 主键） */
export const zhsCourseNew = pgTable('zhs_course_new', {
  id: serial('id').primaryKey(),
  courseUuid: varchar('course_uuid', { length: 64 }),
  title: varchar('title', { length: 200 }),
  subtitle: text('subtitle'),
  content: text('content'),
  remarkFile: varchar('remark_file', { length: 500 }),
  binding: varchar('binding', { length: 500 }),
  stage: integer('stage'),
  isHidden: integer('is_hidden').default(0).notNull(),
  isDel: integer('is_del').default(0).notNull(),
  sort: integer('sort').default(0).notNull(),
  creator: varchar('creator', { length: 64 }),
  updator: varchar('updator', { length: 64 }),
  remark: text('remark'),
  label: varchar('label', { length: 100 }),
  types: varchar('types', { length: 500 }),
  categorys: varchar('categorys', { length: 500 }),
  platform: varchar('platform', { length: 64 }),
  auditStatus: integer('audit_status').default(0).notNull(),
  nickname: varchar('nickname', { length: 100 }),
  avatar: varchar('avatar', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 课程视频表 */
export const zhsCourseVideo = pgTable(
  'zhs_course_video',
  {
    id: serial('id').primaryKey(),
    courseId: integer('course_id').notNull(),
    binding: varchar('binding', { length: 500 }),
    videoPath: varchar('video_path', { length: 500 }).notNull(),
    title: varchar('title', { length: 200 }),
    subtitle: text('subtitle'),
    content: text('content'),
    remark: text('remark'),
    duration: integer('duration'),
    adjunctUrl: varchar('adjunct_url', { length: 500 }),
    isPay: integer('is_pay').default(0).notNull(),
    amount: real('amount'),
    status: integer('status').default(1).notNull(),
    sort: integer('sort').default(0).notNull(),
    creator: varchar('creator', { length: 100 }),
    lecturer: varchar('lecturer', { length: 100 }),
    label: varchar('label', { length: 100 }),
    auditStatus: integer('audit_status').default(0).notNull(),
    stage: varchar('stage', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_course_video_status_idx').on(t.status) }),
)

/** 教育课程表 */
export const zhsEducationalCourse = pgTable(
  'zhs_educational_course',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    subtitle: text('subtitle'),
    cover: varchar('cover', { length: 500 }),
    content: text('content'),
    price: real('price'),
    category: varchar('category', { length: 100 }),
    stage: varchar('stage', { length: 50 }),
    status: integer('status').default(1).notNull(),
    isHidden: integer('is_hidden').default(0).notNull(),
    isDel: integer('is_del').default(0).notNull(),
    sort: integer('sort').default(0).notNull(),
    creator: varchar('creator', { length: 64 }),
    label: varchar('label', { length: 100 }),
    auditStatus: integer('audit_status').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_educational_course_status_idx').on(t.status) }),
)

/** 教育平台表 */
export const zhsEducationPlatform = pgTable(
  'zhs_education_platform',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    domain: varchar('domain', { length: 200 }),
    remark: text('remark'),
    binding: varchar('binding', { length: 500 }),
    filePath: varchar('file_path', { length: 500 }),
    type: integer('type'),
    status: integer('status').default(1).notNull(),
    sort: integer('sort').default(0).notNull(),
    isHidden: integer('is_hidden').default(0).notNull(),
    isDel: integer('is_del').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_education_platform_status_idx').on(t.status) }),
)

// ---------------------------------------------------------------------------
// 课程审核 / 支付 / 临时模块
// ---------------------------------------------------------------------------

/** 课程审核记录表 */
export const zhsCourseAudit = pgTable('zhs_course_audit', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull(),
  auditStatus: integer('audit_status').default(0).notNull(),
  auditor: varchar('auditor', { length: 64 }),
  auditTime: timestamp('audit_time', { withTimezone: true }),
  remark: text('remark'),
  createTime: timestamp('create_time', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 课程支付记录表 */
export const zhsCoursePay = pgTable(
  'zhs_course_pay',
  {
    id: serial('id').primaryKey(),
    courseId: integer('course_id').notNull(),
    userUuid: varchar('user_uuid', { length: 64 }).notNull(),
    orderNo: varchar('order_no', { length: 64 }),
    amount: bigint('amount', { mode: 'number' }).default(0).notNull(),
    status: integer('status').default(0).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_course_pay_status_idx').on(t.status) }),
)

/** 课程支付日志表 */
export const zhsCoursePayLog = pgTable('zhs_course_pay_log', {
  id: serial('id').primaryKey(),
  payId: integer('pay_id').notNull(),
  action: varchar('action', { length: 32 }).notNull(),
  detail: text('detail'),
  createTime: timestamp('create_time', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 课程平台操作日志表 */
export const zhsCoursePlatformLog = pgTable('zhs_course_platform_log', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id').notNull(),
  platformId: integer('platform_id').notNull(),
  action: varchar('action', { length: 32 }).notNull(),
  createTime: timestamp('create_time', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 课程临时/暂存表 */
export const zhsCourseTemp = pgTable(
  'zhs_course_temp',
  {
    id: serial('id').primaryKey(),
    courseName: varchar('course_name', { length: 200 }),
    status: integer('status').default(0).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_course_temp_status_idx').on(t.status) }),
)

/** 课程视频临时/暂存表 */
export const zhsCourseVideoTemp = pgTable(
  'zhs_course_video_temp',
  {
    id: serial('id').primaryKey(),
    videoName: varchar('video_name', { length: 200 }),
    status: integer('status').default(0).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_course_video_temp_status_idx').on(t.status) }),
)

// ---------------------------------------------------------------------------
// 身份 / 机构模块
// ---------------------------------------------------------------------------

/** 平台身份扩展表 */
export const zhsIdentityExt = pgTable('zhs_identity_ext', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 64 }),
  name: varchar('name', { length: 100 }),
  platformId: varchar('platform_id', { length: 64 }),
  organizationId: varchar('organization_id', { length: 64 }),
  parentId: varchar('parent_id', { length: 64 }),
  binding: varchar('binding', { length: 500 }),
  isHidden: integer('is_hidden').default(0).notNull(),
  isDel: integer('is_del').default(0).notNull(),
  isCross: integer('is_cross').default(0).notNull(),
  creator: varchar('creator', { length: 64 }),
  updator: varchar('updator', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 平台机构扩展表 */
export const zhsOrganizationExt = pgTable('zhs_organization_ext', {
  id: serial('id').primaryKey(),
  uuid: varchar('uuid', { length: 64 }),
  platformId: varchar('platform_id', { length: 64 }),
  name: varchar('name', { length: 200 }),
  filePath: text('file_path'),
  binding: varchar('binding', { length: 500 }),
  isHidden: integer('is_hidden').default(0).notNull(),
  isDel: integer('is_del').default(0).notNull(),
  creator: varchar('creator', { length: 64 }),
  updator: varchar('updator', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// 资源模块
// ---------------------------------------------------------------------------

/** 热门课程推荐表 */
export const zhsPopularCourses = pgTable(
  'zhs_popular_courses',
  {
    id: serial('id').primaryKey(),
    courseId: integer('course_id').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_popular_courses_status_idx').on(t.status) }),
)

/** 汇率表 */
export const zhsExchangeRate = pgTable(
  'zhs_exchange_rate',
  {
    id: serial('id').primaryKey(),
    fromCurrency: varchar('from_currency', { length: 20 }).notNull(),
    toCurrency: varchar('to_currency', { length: 20 }).notNull(),
    rate: real('rate').notNull(),
    status: integer('status').default(1).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_exchange_rate_status_idx').on(t.status) }),
)

/** 官方资讯/公告表 */
export const zhsOfficialInformation = pgTable(
  'zhs_official_information',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 300 }),
    content: text('content'),
    type: varchar('type', { length: 50 }),
    status: integer('status').default(1).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_official_information_status_idx').on(t.status) }),
)

/** 平台资源表 */
export const zhsResources = pgTable(
  'zhs_resources',
  {
    id: serial('id').primaryKey(),
    resourceName: varchar('resource_name', { length: 200 }),
    resourceType: varchar('resource_type', { length: 50 }),
    resourceUrl: varchar('resource_url', { length: 500 }),
    status: integer('status').default(1).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_resources_status_idx').on(t.status) }),
)

// ---------------------------------------------------------------------------
// 支付模块
// ---------------------------------------------------------------------------

/** 订单表 */
export const zhsOrder = pgTable(
  'zhs_order',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }),
    outTradeNo: varchar('out_trade_no', { length: 64 }),
    openId: varchar('open_id', { length: 100 }),
    amount: bigint('amount', { mode: 'number' }),
    status: integer('status').default(0).notNull(),
    paymentStatus: integer('payment_status').default(0).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    productId: varchar('product_id', { length: 64 }),
    orderType: integer('order_type').default(0).notNull(),
    activityId: varchar('activity_id', { length: 64 }),
    productIdentityId: varchar('product_identity_id', { length: 64 }),
    payType: varchar('pay_type', { length: 20 }),
    refundTime: timestamp('refund_time', { withTimezone: true }),
    refundReason: varchar('refund_reason', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('zhs_order_user_idx').on(t.userId),
    statusIdx: index('zhs_order_status_idx').on(t.status),
  }),
)

/** Token 操作审计日志表 */
export const zhsOperateTokenFlow = pgTable(
  'zhs_operate_token_flow',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    tokenQuantity: bigint('token_quantity', { mode: 'number' }).default(0).notNull(),
    type: integer('type'),
    operateDesc: varchar('operate_desc', { length: 255 }),
    tokenFree: bigint('token_free', { mode: 'number' }).default(0).notNull(),
    userUuid: varchar('user_uuid', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ userIdx: index('zhs_operate_token_flow_user_idx').on(t.userId) }),
)

// ---------------------------------------------------------------------------
// 用户模块
// ---------------------------------------------------------------------------

/** 用户 Agent 免费次数表 */
export const zhsUserAgentFreeTime = pgTable('zhs_user_agent_free_time', {
  id: serial('id').primaryKey(),
  userUuid: varchar('user_uuid', { length: 64 }).notNull(),
  agentId: varchar('agent_id', { length: 64 }),
  freeCount: integer('free_count').default(0).notNull(),
  usedCount: integer('used_count').default(0).notNull(),
  expireTime: timestamp('expire_time', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 用户评论操作日志表 */
export const zhsUserCommentLog = pgTable('zhs_user_comment_log', {
  id: serial('id').primaryKey(),
  userUuid: varchar('user_uuid', { length: 64 }).notNull(),
  commentId: integer('comment_id').notNull(),
  action: varchar('action', { length: 32 }).notNull(),
  createTime: timestamp('create_time', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 用户平台关系表 */
export const zhsUserPlatform = pgTable(
  'zhs_user_platform',
  {
    id: serial('id').primaryKey(),
    userUuid: varchar('user_uuid', { length: 64 }).notNull(),
    platformId: integer('platform_id').notNull(),
    status: integer('status').default(1).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ statusIdx: index('zhs_user_platform_status_idx').on(t.status) }),
)

/** 用户视频评论表 */
export const zhsUserVideoComment = pgTable(
  'zhs_user_video_comment',
  {
    id: serial('id').primaryKey(),
    videoId: integer('video_id').notNull(),
    userUuid: varchar('user_uuid', { length: 64 }).notNull(),
    content: text('content'),
    parentId: integer('parent_id').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    parentIdx: index('zhs_user_video_comment_parent_idx').on(t.parentId),
    statusIdx: index('zhs_user_video_comment_status_idx').on(t.status),
  }),
)

/** 用户视频操作日志表 */
export const zhsUserVideoLog = pgTable('zhs_user_video_log', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id').notNull(),
  userUuid: varchar('user_uuid', { length: 64 }).notNull(),
  action: varchar('action', { length: 32 }).notNull(),
  createTime: timestamp('create_time', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type ZhsActivity = typeof zhsActivity.$inferSelect
export type NewZhsActivity = typeof zhsActivity.$inferInsert
export type ZhsAgentCategory = typeof zhsAgentCategory.$inferSelect
export type NewZhsAgentCategory = typeof zhsAgentCategory.$inferInsert
export type ZhsAgentDeveloper = typeof zhsAgentDeveloper.$inferSelect
export type NewZhsAgentDeveloper = typeof zhsAgentDeveloper.$inferInsert
export type ZhsAgentNeedTask = typeof zhsAgentNeedTask.$inferSelect
export type NewZhsAgentNeedTask = typeof zhsAgentNeedTask.$inferInsert
export type ZhsAiModelInfo = typeof zhsAiModelInfo.$inferSelect
export type NewZhsAiModelInfo = typeof zhsAiModelInfo.$inferInsert
export type ZhsDeveloperLink = typeof zhsDeveloperLink.$inferSelect
export type NewZhsDeveloperLink = typeof zhsDeveloperLink.$inferInsert
export type ZhsUserModelChat = typeof zhsUserModelChat.$inferSelect
export type NewZhsUserModelChat = typeof zhsUserModelChat.$inferInsert
export type ZhsBannerCarousel = typeof zhsBannerCarousel.$inferSelect
export type NewZhsBannerCarousel = typeof zhsBannerCarousel.$inferInsert
export type ZhsCategoryDictionary = typeof zhsCategoryDictionary.$inferSelect
export type NewZhsCategoryDictionary = typeof zhsCategoryDictionary.$inferInsert
export type ZhsInformation = typeof zhsInformation.$inferSelect
export type NewZhsInformation = typeof zhsInformation.$inferInsert
export type ZhsProduct = typeof zhsProduct.$inferSelect
export type NewZhsProduct = typeof zhsProduct.$inferInsert
export type ZhsKnowledgePlanet = typeof zhsKnowledgePlanet.$inferSelect
export type NewZhsKnowledgePlanet = typeof zhsKnowledgePlanet.$inferInsert
export type ZhsCourse = typeof zhsCourse.$inferSelect
export type NewZhsCourse = typeof zhsCourse.$inferInsert
export type ZhsCourseNew = typeof zhsCourseNew.$inferSelect
export type NewZhsCourseNew = typeof zhsCourseNew.$inferInsert
export type ZhsCourseVideo = typeof zhsCourseVideo.$inferSelect
export type NewZhsCourseVideo = typeof zhsCourseVideo.$inferInsert
export type ZhsEducationalCourse = typeof zhsEducationalCourse.$inferSelect
export type NewZhsEducationalCourse = typeof zhsEducationalCourse.$inferInsert
export type ZhsEducationPlatform = typeof zhsEducationPlatform.$inferSelect
export type NewZhsEducationPlatform = typeof zhsEducationPlatform.$inferInsert
export type ZhsCourseAudit = typeof zhsCourseAudit.$inferSelect
export type NewZhsCourseAudit = typeof zhsCourseAudit.$inferInsert
export type ZhsCoursePay = typeof zhsCoursePay.$inferSelect
export type NewZhsCoursePay = typeof zhsCoursePay.$inferInsert
export type ZhsCoursePayLog = typeof zhsCoursePayLog.$inferSelect
export type NewZhsCoursePayLog = typeof zhsCoursePayLog.$inferInsert
export type ZhsCoursePlatformLog = typeof zhsCoursePlatformLog.$inferSelect
export type NewZhsCoursePlatformLog = typeof zhsCoursePlatformLog.$inferInsert
export type ZhsCourseTemp = typeof zhsCourseTemp.$inferSelect
export type NewZhsCourseTemp = typeof zhsCourseTemp.$inferInsert
export type ZhsCourseVideoTemp = typeof zhsCourseVideoTemp.$inferSelect
export type NewZhsCourseVideoTemp = typeof zhsCourseVideoTemp.$inferInsert
export type ZhsIdentityExt = typeof zhsIdentityExt.$inferSelect
export type NewZhsIdentityExt = typeof zhsIdentityExt.$inferInsert
export type ZhsOrganizationExt = typeof zhsOrganizationExt.$inferSelect
export type NewZhsOrganizationExt = typeof zhsOrganizationExt.$inferInsert
export type ZhsPopularCourses = typeof zhsPopularCourses.$inferSelect
export type NewZhsPopularCourses = typeof zhsPopularCourses.$inferInsert
export type ZhsExchangeRate = typeof zhsExchangeRate.$inferSelect
export type NewZhsExchangeRate = typeof zhsExchangeRate.$inferInsert
export type ZhsOfficialInformation = typeof zhsOfficialInformation.$inferSelect
export type NewZhsOfficialInformation = typeof zhsOfficialInformation.$inferInsert
export type ZhsResources = typeof zhsResources.$inferSelect
export type NewZhsResources = typeof zhsResources.$inferInsert
export type ZhsOrder = typeof zhsOrder.$inferSelect
export type NewZhsOrder = typeof zhsOrder.$inferInsert
export type ZhsOperateTokenFlow = typeof zhsOperateTokenFlow.$inferSelect
export type NewZhsOperateTokenFlow = typeof zhsOperateTokenFlow.$inferInsert
export type ZhsUserAgentFreeTime = typeof zhsUserAgentFreeTime.$inferSelect
export type NewZhsUserAgentFreeTime = typeof zhsUserAgentFreeTime.$inferInsert
export type ZhsUserCommentLog = typeof zhsUserCommentLog.$inferSelect
export type NewZhsUserCommentLog = typeof zhsUserCommentLog.$inferInsert
export type ZhsUserPlatform = typeof zhsUserPlatform.$inferSelect
export type NewZhsUserPlatform = typeof zhsUserPlatform.$inferInsert
export type ZhsUserVideoComment = typeof zhsUserVideoComment.$inferSelect
export type NewZhsUserVideoComment = typeof zhsUserVideoComment.$inferInsert
export type ZhsUserVideoLog = typeof zhsUserVideoLog.$inferSelect
export type NewZhsUserVideoLog = typeof zhsUserVideoLog.$inferInsert
