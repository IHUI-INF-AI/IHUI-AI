/**
 * 关系表与缺失表补全 schema（迁移自旧架构 server/app/models/*_models.py）。
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
  real,
  numeric,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core'

// ===========================================================================
// 1. Exam 考试关系表（迁移自 exam_ext_models.py）
// ===========================================================================

/** 考试分类关系（树形结构父子关系） */
export const examCategoryRelation = pgTable('exam_category_relation', {
  id: serial('id').primaryKey(),
  childCategoryId: integer('child_category_id').notNull(),
  fatherCategoryId: integer('father_category_id').notNull(),
  directFatherCategoryId: integer('direct_father_category_id').notNull(),
  isSub: boolean('is_sub').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

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
export const examExamCategoryRelation = pgTable(
  'exam_exam_category_relation',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id').notNull(),
    examId: integer('exam_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('idx_eecr_category').on(t.categoryId),
    examIdx: index('idx_eecr_exam').on(t.examId),
  }),
)

/** 考试章 */
export const examExamChapter = pgTable(
  'exam_exam_chapter',
  {
    id: serial('id').primaryKey(),
    examId: integer('exam_id'),
    title: varchar('title', { length: 100 }).notNull(),
    phrase: varchar('phrase', { length: 255 }).default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    examIdx: index('idx_eec_exam').on(t.examId),
  }),
)

/** 考试章节 */
export const examExamChapterSection = pgTable(
  'exam_exam_chapter_section',
  {
    id: serial('id').primaryKey(),
    examChapterId: integer('exam_chapter_id'),
    title: varchar('title', { length: 100 }).notNull(),
    paperId: integer('paper_id').notNull(),
    phrase: varchar('phrase', { length: 255 }).default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    chapterIdx: index('idx_eecs_chapter').on(t.examChapterId),
    paperIdx: index('idx_eecs_paper').on(t.paperId),
  }),
)

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
export const examPaperCategory = pgTable('exam_paper_category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  sortOrder: integer('sort_order').default(1).notNull(),
  isShow: boolean('is_show').default(true).notNull(),
  isShowIndex: boolean('is_show_index').default(true).notNull(),
  level: integer('level').notNull(),
  image: varchar('image', { length: 500 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 试卷分类与试卷分类关系（树形结构） */
export const examPaperCategoryRelation = pgTable('exam_paper_category_relation', {
  id: serial('id').primaryKey(),
  childCategoryId: integer('child_category_id').notNull(),
  fatherCategoryId: integer('father_category_id').notNull(),
  directFatherCategoryId: integer('direct_father_category_id').notNull(),
  isSub: boolean('is_sub').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 试卷与试卷分类关系 */
export const examPaperPaperCategoryRelation = pgTable(
  'exam_paper_paper_category_relation',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id').notNull(),
    paperId: integer('paper_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('idx_eppcr_category').on(t.categoryId),
    paperIdx: index('idx_eppcr_paper').on(t.paperId),
  }),
)

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
export const examQuestionCategory = pgTable('exam_question_category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  sortOrder: integer('sort_order').default(1).notNull(),
  isShow: boolean('is_show').default(true).notNull(),
  isShowIndex: boolean('is_show_index').default(true).notNull(),
  level: integer('level').notNull(),
  image: varchar('image', { length: 500 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 题目分类与题目分类关系（树形结构） */
export const examQuestionCategoryRelation = pgTable('exam_question_category_relation', {
  id: serial('id').primaryKey(),
  childCategoryId: integer('child_category_id').notNull(),
  fatherCategoryId: integer('father_category_id').notNull(),
  directFatherCategoryId: integer('direct_father_category_id').notNull(),
  isSub: boolean('is_sub').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 题目与题目分类关系 */
export const examQuestionAndCategoryRelation = pgTable(
  'exam_question_and_category_relation',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id').notNull(),
    questionId: integer('question_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('idx_eqacr_category').on(t.categoryId),
    questionIdx: index('idx_eqacr_question').on(t.questionId),
  }),
)

// ===========================================================================
// 2. Learn 学习关系表（迁移自 learn_models.py）
// ===========================================================================

/** 课程分类关系（树形结构父子关系） */
export const learnCategoryRelation = pgTable('learn_category_relation', {
  id: serial('id').primaryKey(),
  childCategoryId: integer('child_category_id').notNull(),
  fatherCategoryId: integer('father_category_id').notNull(),
  directFatherCategoryId: integer('direct_father_category_id').notNull(),
  isSub: boolean('is_sub').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 课程与分类关系 */
export const learnLessonCategoryRelation = pgTable(
  'learn_lesson_category_relation',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id').notNull(),
    lessonId: integer('lesson_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('idx_llcr_category').on(t.categoryId),
    lessonIdx: index('idx_llcr_lesson').on(t.lessonId),
  }),
)

/** 学习模块订单（历史 learn_order） */
export const learnOrder = pgTable(
  'learn_order',
  {
    id: serial('id').primaryKey(),
    orderNo: varchar('order_no', { length: 64 }).notNull().unique(),
    memberId: varchar('member_id', { length: 64 }).notNull(),
    lessonId: integer('lesson_id'),
    amount: numeric('amount', { precision: 14, scale: 2 }).default('0').notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    payType: varchar('pay_type', { length: 20 }),
    invoiceTitle: varchar('invoice_title', { length: 255 }),
    invoiceStatus: varchar('invoice_status', { length: 20 }).default('none').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('idx_learn_order_member').on(t.memberId),
    statusIdx: index('idx_learn_order_status').on(t.status),
  }),
)

/** 课程报名（历史 learn_sign_up） */
export const learnSignUp = pgTable(
  'learn_sign_up',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    lessonId: integer('lesson_id').notNull(),
    status: varchar('status', { length: 50 }).default('enrolled').notNull(),
    completedTime: timestamp('completed_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('idx_learn_su_member').on(t.memberId),
    lessonIdx: index('idx_learn_su_lesson').on(t.lessonId),
    statusIdx: index('idx_learn_su_status').on(t.status),
  }),
)

// ===========================================================================
// 3. Circle 圈子关系表（迁移自 circle_ext_models.py）
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
export const circleCircleMember = pgTable(
  'circle_circle_member',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    circleId: integer('circle_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('idx_ccm_member').on(t.memberId),
    circleIdx: index('idx_ccm_circle').on(t.circleId),
  }),
)

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
// 4. Behavior 行为表（迁移自 behavior_models.py）
// ===========================================================================

/** 通用评论表 */
export const behaviorComment = pgTable(
  'behavior_comment',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    userName: varchar('user_name', { length: 100 }),
    userAvatar: varchar('user_avatar', { length: 500 }),
    targetType: varchar('target_type', { length: 50 }).notNull(),
    targetId: integer('target_id').notNull(),
    content: text('content').notNull(),
    pid: integer('pid').default(0),
    replyUserId: varchar('reply_user_id', { length: 64 }),
    replyUserName: varchar('reply_user_name', { length: 100 }),
    likeNum: integer('like_num').default(0),
    status: integer('status').default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    targetIdx: index('idx_bc_target').on(t.targetType, t.targetId),
    userIdx: index('ix_behavior_comment_user_id').on(t.userId),
    statusIdx: index('ix_behavior_comment_status').on(t.status),
  }),
)

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
export const behaviorFollow = pgTable(
  'behavior_follow',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    targetUserId: varchar('target_user_id', { length: 64 }).notNull(),
    isMutual: boolean('is_mutual').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_bf2_user').on(t.userId),
    targetIdx: index('idx_bf2_target').on(t.targetUserId),
  }),
)

/** 通用点赞表 */
export const behaviorLike = pgTable(
  'behavior_like',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    userName: varchar('user_name', { length: 100 }),
    targetType: varchar('target_type', { length: 50 }).notNull(),
    targetId: integer('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_bl_user').on(t.userId),
    targetIdx: index('idx_bl_target').on(t.targetType, t.targetId),
  }),
)

/** 举报 */
export const behaviorReport = pgTable(
  'behavior_report',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 50 }).notNull(),
    targetId: integer('target_id').notNull(),
    reason: varchar('reason', { length: 500 }),
    category: varchar('category', { length: 50 }),
    status: integer('status').default(0),
    handleUser: varchar('handle_user', { length: 64 }),
    handleRemark: varchar('handle_remark', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    targetIdx: index('idx_br_target').on(t.targetType, t.targetId),
    userIdx: index('ix_behavior_report_user_id').on(t.userId),
    statusIdx: index('ix_behavior_report_status').on(t.status),
  }),
)

/** 敏感词 */
export const behaviorSensitive = pgTable(
  'behavior_sensitive',
  {
    id: serial('id').primaryKey(),
    word: varchar('word', { length: 100 }).notNull().unique(),
    category: varchar('category', { length: 50 }),
    level: integer('level').default(1),
    action: varchar('action', { length: 20 }).default('replace'),
    replacement: varchar('replacement', { length: 50 }),
    status: integer('status').default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_behavior_sensitive_status').on(t.status),
  }),
)

/** 分享记录 */
export const behaviorShare = pgTable(
  'behavior_share',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 50 }).notNull(),
    targetId: integer('target_id').notNull(),
    platform: varchar('platform', { length: 50 }),
    ip: varchar('ip', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_bs_user').on(t.userId),
    targetIdx: index('idx_bs_target').on(t.targetType, t.targetId),
  }),
)

// ===========================================================================
// 5. Message 消息子类型表（迁移自 message_models.py / message_ext_models.py）
// ===========================================================================

/** 公告/通知 */
export const messageAnnouncement = pgTable(
  'message_announcement',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull(),
    cover: varchar('cover', { length: 500 }),
    type: integer('type').default(1),
    priority: integer('priority').default(1),
    status: integer('status').default(1),
    targetUser: varchar('target_user', { length: 20 }).default('all'),
    targetUrl: varchar('target_url', { length: 500 }),
    publishTime: timestamp('publish_time', { withTimezone: true }),
    expireTime: timestamp('expire_time', { withTimezone: true }),
    viewNum: integer('view_num').default(0),
    isTop: boolean('is_top').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('idx_ann_status').on(t.status),
  }),
)

/** 公告阅读记录 */
export const messageAnnouncementReadRecord = pgTable(
  'message_announcement_read_record',
  {
    id: serial('id').primaryKey(),
    announcementId: integer('announcement_id').notNull(),
    memberId: integer('member_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    annIdx: index('idx_marr_announcement').on(t.announcementId),
    memberIdx: index('idx_marr_member').on(t.memberId),
  }),
)

/** 通知（主题级通知，历史 message_notice） */
export const messageNotice = pgTable(
  'message_notice',
  {
    id: serial('id').primaryKey(),
    topicId: integer('topic_id').notNull(),
    topicType: varchar('topic_type', { length: 100 }).notNull(),
    toMemberId: integer('to_member_id').notNull(),
    status: varchar('status', { length: 100 }),
    type: varchar('type', { length: 100 }).notNull(),
    browsed: boolean('browsed').default(false).notNull(),
    memberId: integer('member_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('idx_mn_member').on(t.memberId),
    toMemberIdx: index('idx_mn_to_member').on(t.toMemberId),
  }),
)

/** 消息阅读日志 */
export const messageReadLog = pgTable(
  'message_read_log',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    messageId: integer('message_id').notNull(),
    messageType: varchar('message_type', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_mrl_user').on(t.userId),
  }),
)

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
// 6. Notification 通知表（迁移自 notification_models.py）
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
export const notificationSubscription = pgTable(
  'notification_subscription',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    enabled: boolean('enabled').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_ns_user').on(t.userId),
  }),
)

// ===========================================================================
// 7. Point 积分商城表（迁移自 point_models.py）
// ===========================================================================

/** 积分兑换记录 */
export const pointExchange = pgTable(
  'point_exchange',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    userName: varchar('user_name', { length: 100 }),
    goodsId: integer('goods_id').notNull(),
    goodsName: varchar('goods_name', { length: 200 }),
    pointCost: integer('point_cost').default(0),
    quantity: integer('quantity').default(1),
    totalPoint: integer('total_point').default(0),
    status: integer('status').default(0),
    address: varchar('address', { length: 500 }),
    contact: varchar('contact', { length: 100 }),
    expressNo: varchar('express_no', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_pe_user').on(t.userId),
    statusIdx: index('idx_pe_status').on(t.status),
  }),
)

/** 积分商品（兑换） */
export const pointGoods = pgTable(
  'point_goods',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    image: varchar('image', { length: 500 }),
    pointCost: integer('point_cost').default(0),
    stock: integer('stock').default(0),
    soldNum: integer('sold_num').default(0),
    limitPerUser: integer('limit_per_user').default(1),
    type: varchar('type', { length: 20 }).default('virtual'),
    status: integer('status').default(1),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('idx_pg_status').on(t.status),
  }),
)

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
// 8. Resource 资源关系表（迁移自 resource_ext_models.py）
// ===========================================================================

/** 资源分类关系（树形结构父子关系） */
export const resourceCategoryRelation = pgTable(
  'resource_category_relation',
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
    fatherIdx: index('idx_rescr_father').on(t.fatherCategoryId),
    childIdx: index('idx_rescr_child').on(t.childCategoryId),
  }),
)

/** 资源（历史 resource_resource） */
export const resourceResource = pgTable(
  'resource_resource',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 100 }).notNull(),
    memberId: integer('member_id').notNull(),
    introduction: text('introduction').notNull(),
    image: varchar('image', { length: 3000 }),
    url: varchar('url', { length: 3000 }),
    status: varchar('status', { length: 100 }).notNull(),
    type: varchar('type', { length: 200 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('idx_rr_member').on(t.memberId),
    statusIdx: index('idx_rr_status').on(t.status),
  }),
)

/** 资源类目关系 */
export const resourceResourceCategoryRelation = pgTable(
  'resource_resource_category_relation',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id').notNull(),
    resourceId: integer('resource_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('idx_rrcr_category').on(t.categoryId),
    resourceIdx: index('idx_rrcr_resource').on(t.resourceId),
  }),
)

/** 会员下载记录 */
export const resourceResourceDownload = pgTable(
  'resource_resource_download',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    resourceId: integer('resource_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('idx_rrd_member').on(t.memberId),
    resourceIdx: index('idx_rrd_resource').on(t.resourceId),
  }),
)

/** 会员搜索记录 */
export const resourceResourceSearchRecord = pgTable(
  'resource_resource_search_record',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    searchCondition: text('search_condition').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('idx_rrsr_member').on(t.memberId),
  }),
)

// ===========================================================================
// 9. Admin 域缺失表（迁移自 admin_models.py）
// ===========================================================================

/** 操作日志记录表（历史 admin_oper_log，无 BaseEntity 公共字段） */
export const adminOperLog = pgTable(
  'admin_oper_log',
  {
    operId: serial('oper_id').primaryKey(),
    title: varchar('title', { length: 50 }).default(''),
    businessType: integer('business_type').default(0),
    method: varchar('method', { length: 200 }).default(''),
    requestMethod: integer('request_method').default(0),
    operatorType: integer('operator_type').default(0),
    operName: varchar('oper_name', { length: 50 }).default(''),
    deptName: varchar('dept_name', { length: 50 }).default(''),
    operUrl: varchar('oper_url', { length: 255 }).default(''),
    operIp: varchar('oper_ip', { length: 128 }).default(''),
    operParam: varchar('oper_param', { length: 2000 }).default(''),
    jsonResult: varchar('json_result', { length: 2000 }).default(''),
    status: integer('status').default(0),
    errorMsg: varchar('error_msg', { length: 2000 }).default(''),
    operTime: timestamp('oper_time', { withTimezone: true }).defaultNow(),
    costTime: integer('cost_time').default(0),
  },
  (t) => ({
    statusIdx: index('ix_admin_oper_log_status').on(t.status),
  }),
)

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

/** App 内容管理（历史 app_content） */
export const appContent = pgTable(
  'app_content',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }),
    imageUrl: varchar('image_url', { length: 500 }),
    linkUrl: varchar('link_url', { length: 500 }),
    type: varchar('type', { length: 50 }),
    status: integer('status').default(1),
    sort: integer('sort').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_app_content_status').on(t.status),
  }),
)

/** 汇率表（历史 exchange_rate） */
export const exchangeRate = pgTable(
  'exchange_rate',
  {
    id: serial('id').primaryKey(),
    currencyCode: varchar('currency_code', { length: 20 }),
    currencyName: varchar('currency_name', { length: 50 }),
    rate: real('rate'),
    status: integer('status').default(1),
    sort: integer('sort').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_exchange_rate_status').on(t.status),
  }),
)

/** 搜索日志（历史 search_log） */
export const searchLog = pgTable(
  'search_log',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }),
    keyword: varchar('keyword', { length: 200 }).notNull(),
    targetType: varchar('target_type', { length: 50 }),
    resultCount: integer('result_count').default(0),
    ip: varchar('ip', { length: 50 }),
    userAgent: varchar('user_agent', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('idx_sl_user').on(t.userId),
    keywordIdx: index('idx_sl_keyword').on(t.keyword),
  }),
)

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
export const tMemberCompany = pgTable(
  't_member_company',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).default('').notNull(),
    image: varchar('image', { length: 1000 }).default(''),
    mobile: varchar('mobile', { length: 20 }).default('').notNull(),
    email: varchar('email', { length: 100 }).default('').notNull(),
    status: varchar('status', { length: 30 }).default('normal').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    companyTypeId: integer('company_type_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    typeIdx: index('idx_member_company_type_id').on(t.companyTypeId),
    statusIdx: index('idx_member_company_status').on(t.status),
    sortIdx: index('idx_member_company_sort_order').on(t.sortOrder),
    createTimeIdx: index('idx_member_company_create_time').on(t.createdAt),
  }),
)

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
export const tOrderPayment = pgTable(
  't_order_payment',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id').notNull(),
    status: varchar('status', { length: 100 }).notNull(),
    channel: varchar('channel', { length: 100 }).notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orderIdx: index('idx_order_payment_order').on(t.orderId),
  }),
)

/** 页面统计（历史 visit_page） */
export const visitPage = pgTable(
  'visit_page',
  {
    id: serial('id').primaryKey(),
    statDate: varchar('stat_date', { length: 20 }).notNull(),
    path: varchar('path', { length: 500 }).notNull(),
    visitCount: integer('visit_count').default(0),
    uv: integer('uv').default(0),
    avgDuration: integer('avg_duration').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dateIdx: index('idx_vp_date').on(t.statDate),
  }),
)

/** 访问来源（历史 visit_source） */
export const visitSource = pgTable(
  'visit_source',
  {
    id: serial('id').primaryKey(),
    statDate: varchar('stat_date', { length: 20 }).notNull(),
    source: varchar('source', { length: 50 }).notNull(),
    visitCount: integer('visit_count').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dateIdx: index('idx_vs2_date').on(t.statDate),
  }),
)

/** 访问统计-汇总（历史 visit_stats） */
export const visitStats = pgTable(
  'visit_stats',
  {
    id: serial('id').primaryKey(),
    statDate: varchar('stat_date', { length: 20 }).notNull(),
    statType: varchar('stat_type', { length: 20 }).notNull(),
    targetType: varchar('target_type', { length: 50 }),
    targetId: varchar('target_id', { length: 64 }),
    pv: integer('pv').default(0),
    uv: integer('uv').default(0),
    ipCount: integer('ip_count').default(0),
    newUser: integer('new_user').default(0),
    avgDuration: integer('avg_duration').default(0),
    bounceRate: real('bounce_rate').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dateIdx: index('idx_vs_date').on(t.statDate),
    targetIdx: index('idx_vs_target').on(t.targetType, t.targetId),
  }),
)
