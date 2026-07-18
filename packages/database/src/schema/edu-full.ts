/**
 * Edu 教育域完整 schema（等价自旧架构 edu_platform_models / edu_platform_models_ext）。
 * 涵盖：认证 / 设置 / 内容 / 会员 / 课程 / 考试 / 资源 / 圈子 / 评论 / 问答 / 直播 / 通知 / 访问统计 等模块。
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
  index,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// 认证模块
// ---------------------------------------------------------------------------

/** 角色表 */
export const eduRole = pgTable('edu_role', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 100 }).notNull(),
  description: text('description'),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 权限表 */
export const eduAuthority = pgTable('edu_authority', {
  id: serial('id').primaryKey(),
  pid: integer('pid').default(0).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  alias: varchar('alias', { length: 100 }).notNull(),
  type: integer('type').default(1).notNull(),
  sort: integer('sort').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 角色权限关联表 */
export const eduRoleAuthority = pgTable('edu_role_authority', {
  id: serial('id').primaryKey(),
  roleId: integer('role_id').notNull(),
  authorityId: integer('authority_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// 设置模块
// ---------------------------------------------------------------------------

/** 轮播图表 */
export const eduCarousel = pgTable('edu_carousel', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }),
  image: varchar('image', { length: 500 }).notNull(),
  link: varchar('link', { length: 500 }),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 协议表 */
export const eduAgreement = pgTable('edu_agreement', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content'),
  type: varchar('type', { length: 50 }).default('user').notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// 内容模块
// ---------------------------------------------------------------------------

/** 文章表 */
export const eduArticle = pgTable(
  'edu_article',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content'),
    summary: varchar('summary', { length: 500 }),
    coverImage: varchar('cover_image', { length: 500 }),
    authorId: integer('author_id'),
    authorName: varchar('author_name', { length: 100 }),
    categoryId: integer('category_id'),
    viewCount: integer('view_count').default(0).notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    isTop: boolean('is_top').default(false).notNull(),
    isRecommend: boolean('is_recommend').default(false).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ catIdx: index('edu_article_category_idx').on(t.categoryId) }),
)

/** 资讯表 */
export const eduNews = pgTable('edu_news', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content'),
  summary: varchar('summary', { length: 500 }),
  coverImage: varchar('cover_image', { length: 500 }),
  authorId: integer('author_id'),
  categoryId: integer('category_id'),
  viewCount: integer('view_count').default(0).notNull(),
  isTop: boolean('is_top').default(false).notNull(),
  isRecommend: boolean('is_recommend').default(false).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 分类表 */
export const eduCategory = pgTable('edu_category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  pid: integer('pid').default(0).notNull(),
  type: varchar('type', { length: 50 }).default('article').notNull(),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// 用户模块
// ---------------------------------------------------------------------------

/** 用户表 */
export const eduUser = pgTable('edu_user', {
  id: serial('id').primaryKey(),
  mobile: varchar('mobile', { length: 20 }),
  name: varchar('name', { length: 100 }),
  password: varchar('password', { length: 200 }),
  companyId: integer('company_id'),
  departmentId: integer('department_id'),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// 支付模块
// ---------------------------------------------------------------------------

/** 交易表 */
export const eduTrade = pgTable('edu_trade', {
  id: serial('id').primaryKey(),
  tradeNo: varchar('trade_no', { length: 64 }).notNull(),
  orderNo: varchar('order_no', { length: 64 }),
  userId: integer('user_id').notNull(),
  amount: integer('amount').default(0).notNull(),
  payType: varchar('pay_type', { length: 20 }).default('alipay').notNull(),
  status: integer('status').default(0).notNull(),
  payTime: timestamp('pay_time', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// 学习模块
// ---------------------------------------------------------------------------

/** 课程分类表 */
export const eduLearnCategory = pgTable('edu_learn_category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  pid: integer('pid').default(0).notNull(),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 学习地图表 */
export const eduLearnMap = pgTable('edu_learn_map', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  isPublished: boolean('is_published').default(false).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 课程作业表 */
export const eduLessonHomework = pgTable('edu_lesson_homework', {
  id: serial('id').primaryKey(),
  lessonId: integer('lesson_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content'),
  deadline: timestamp('deadline', { withTimezone: true }),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 学习记录表 */
export const eduLessonStudyRecord = pgTable(
  'edu_lesson_study_record',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    lessonId: integer('lesson_id').notNull(),
    sectionId: integer('section_id'),
    studyDuration: integer('study_duration').default(0).notNull(),
    progress: real('progress').default(0).notNull(),
    lastPosition: integer('last_position').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('edu_lesson_study_record_member_idx').on(t.memberId),
    lessonIdx: index('edu_lesson_study_record_lesson_idx').on(t.lessonId),
  }),
)

/** 课程专题表 */
export const eduLessonTopic = pgTable('edu_lesson_topic', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  coverImage: varchar('cover_image', { length: 500 }),
  description: text('description'),
  lessonIds: text('lesson_ids'),
  isPublished: boolean('is_published').default(false).notNull(),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 报名记录表 */
export const eduSignUp = pgTable(
  'edu_sign_up',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    targetId: integer('target_id').notNull(),
    targetType: varchar('target_type', { length: 50 }).default('lesson').notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ memberIdx: index('edu_sign_up_member_idx').on(t.memberId) }),
)

// ---------------------------------------------------------------------------
// 考试模块
// ---------------------------------------------------------------------------

/** 考试分类表 */
export const eduExamCategory = pgTable('edu_exam_category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  pid: integer('pid').default(0).notNull(),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 考试表 */
export const eduExam = pgTable(
  'edu_exam',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    categoryId: integer('category_id'),
    description: text('description'),
    totalScore: real('total_score').default(100).notNull(),
    passScore: real('pass_score').default(60).notNull(),
    duration: integer('duration').default(60).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    startTime: timestamp('start_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ catIdx: index('edu_exam_category_idx').on(t.categoryId) }),
)

/** 考试章节表 */
export const eduExamChapter = pgTable('edu_exam_chapter', {
  id: serial('id').primaryKey(),
  examId: integer('exam_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 考试小节表 */
export const eduExamChapterSection = pgTable('edu_exam_chapter_section', {
  id: serial('id').primaryKey(),
  chapterId: integer('chapter_id').notNull(),
  examId: integer('exam_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 题库题目表 */
export const eduExamQuestion = pgTable(
  'edu_exam_question',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id'),
    type: varchar('type', { length: 50 }).default('single_choice').notNull(),
    difficulty: integer('difficulty').default(1).notNull(),
    title: text('title').notNull(),
    options: text('options'),
    answer: text('answer'),
    analysis: text('analysis'),
    score: real('score').default(1).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ catIdx: index('edu_exam_question_category_idx').on(t.categoryId) }),
)

/** 试卷表 */
export const eduExamPaper = pgTable(
  'edu_exam_paper',
  {
    id: serial('id').primaryKey(),
    examId: integer('exam_id'),
    title: varchar('title', { length: 200 }).notNull(),
    paperType: varchar('paper_type', { length: 50 }).default('normal').notNull(),
    totalScore: real('total_score').default(100).notNull(),
    passScore: real('pass_score').default(60).notNull(),
    duration: integer('duration').default(60).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    categoryId: integer('category_id'),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ examIdx: index('edu_exam_paper_exam_idx').on(t.examId) }),
)

/** 试卷规则表 */
export const eduExamPaperRule = pgTable('edu_exam_paper_rule', {
  id: serial('id').primaryKey(),
  paperId: integer('paper_id').notNull(),
  questionType: varchar('question_type', { length: 50 }).notNull(),
  categoryId: integer('category_id'),
  difficulty: integer('difficulty').default(1).notNull(),
  questionCount: integer('question_count').default(0).notNull(),
  scorePerQuestion: real('score_per_question').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 试卷题目关联表 */
export const eduExamPaperQuestion = pgTable(
  'edu_exam_paper_question',
  {
    id: serial('id').primaryKey(),
    paperId: integer('paper_id').notNull(),
    questionId: integer('question_id').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    score: real('score').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    paperIdx: index('edu_exam_paper_question_paper_idx').on(t.paperId),
    questionIdx: index('edu_exam_paper_question_question_idx').on(t.questionId),
  }),
)

/** 考试记录表 */
export const eduExamRecord = pgTable(
  'edu_exam_record',
  {
    id: serial('id').primaryKey(),
    examId: integer('exam_id'),
    paperId: integer('paper_id').notNull(),
    memberId: integer('member_id').notNull(),
    score: real('score').default(0).notNull(),
    totalScore: real('total_score').default(100).notNull(),
    isPass: boolean('is_pass').default(false).notNull(),
    isMarked: boolean('is_marked').default(false).notNull(),
    startTime: timestamp('start_time', { withTimezone: true }),
    submitTime: timestamp('submit_time', { withTimezone: true }),
    duration: integer('duration').default(0).notNull(),
    status: integer('status').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('edu_exam_record_member_idx').on(t.memberId),
    examIdx: index('edu_exam_record_exam_idx').on(t.examId),
  }),
)

// ---------------------------------------------------------------------------
// 资源模块
// ---------------------------------------------------------------------------

/** 资源分类表 */
export const eduResourceCategory = pgTable('edu_resource_category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  pid: integer('pid').default(0).notNull(),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 资源表 */
export const eduResource = pgTable(
  'edu_resource',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    coverImage: varchar('cover_image', { length: 500 }),
    intro: text('intro'),
    categoryId: integer('category_id'),
    fileUrl: varchar('file_url', { length: 500 }),
    fileType: varchar('file_type', { length: 50 }),
    fileSize: integer('file_size').default(0).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    downloadCount: integer('download_count').default(0).notNull(),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ catIdx: index('edu_resource_category_idx').on(t.categoryId) }),
)

/** 资源产品表 */
export const eduResourceProduct = pgTable('edu_resource_product', {
  id: serial('id').primaryKey(),
  resourceId: integer('resource_id').notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  price: real('price').default(0).notNull(),
  originalPrice: real('original_price').default(0).notNull(),
  description: text('description'),
  isPublished: boolean('is_published').default(false).notNull(),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// 圈子模块
// ---------------------------------------------------------------------------

/** 圈子分类表 */
export const eduCircleCategory = pgTable('edu_circle_category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  pid: integer('pid').default(0).notNull(),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 圈子表 */
export const eduCircle = pgTable(
  'edu_circle',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    coverImage: varchar('cover_image', { length: 500 }),
    description: text('description'),
    categoryId: integer('category_id'),
    memberCount: integer('member_count').default(0).notNull(),
    postCount: integer('post_count').default(0).notNull(),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ catIdx: index('edu_circle_category_idx').on(t.categoryId) }),
)

/** 圈子动态表 */
export const eduCircleDynamic = pgTable(
  'edu_circle_dynamic',
  {
    id: serial('id').primaryKey(),
    circleId: integer('circle_id'),
    categoryId: integer('category_id'),
    memberId: integer('member_id').notNull(),
    memberName: varchar('member_name', { length: 100 }),
    content: text('content').notNull(),
    images: text('images'),
    likeCount: integer('like_count').default(0).notNull(),
    commentCount: integer('comment_count').default(0).notNull(),
    isTop: boolean('is_top').default(false).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ circleIdx: index('edu_circle_dynamic_circle_idx').on(t.circleId) }),
)

// ---------------------------------------------------------------------------
// 评论 / 收藏 / 点赞模块
// ---------------------------------------------------------------------------

/** 评论表 */
export const eduComment = pgTable(
  'edu_comment',
  {
    id: serial('id').primaryKey(),
    topicId: integer('topic_id').notNull(),
    topicType: varchar('topic_type', { length: 50 }).notNull(),
    memberId: integer('member_id').notNull(),
    memberName: varchar('member_name', { length: 100 }),
    content: text('content').notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    replyCount: integer('reply_count').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    topicIdx: index('edu_comment_topic_idx').on(t.topicId, t.topicType),
    memberIdx: index('edu_comment_member_idx').on(t.memberId),
  }),
)

/** 收藏表 */
export const eduFavorite = pgTable(
  'edu_favorite',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    topicId: integer('topic_id').notNull(),
    topicType: varchar('topic_type', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ memberIdx: index('edu_favorite_member_idx').on(t.memberId) }),
)

/** 点赞表 */
export const eduLike = pgTable(
  'edu_like',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    topicId: integer('topic_id').notNull(),
    topicType: varchar('topic_type', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ memberIdx: index('edu_like_member_idx').on(t.memberId) }),
)

// ---------------------------------------------------------------------------
// 问答模块
// ---------------------------------------------------------------------------

/** 问答分类表 */
export const eduAskCategory = pgTable('edu_ask_category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  pid: integer('pid').default(0).notNull(),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 问答-问题表 */
export const eduQuestion = pgTable(
  'edu_question',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 500 }).notNull(),
    content: text('content'),
    categoryId: integer('category_id'),
    memberId: integer('member_id').notNull(),
    memberName: varchar('member_name', { length: 100 }),
    answerCount: integer('answer_count').default(0).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    isSolved: boolean('is_solved').default(false).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('edu_question_category_idx').on(t.categoryId),
    memberIdx: index('edu_question_member_idx').on(t.memberId),
  }),
)

/** 问答-回答表 */
export const eduAnswer = pgTable(
  'edu_answer',
  {
    id: serial('id').primaryKey(),
    questionId: integer('question_id').notNull(),
    memberId: integer('member_id').notNull(),
    memberName: varchar('member_name', { length: 100 }),
    content: text('content').notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    isAdopted: boolean('is_adopted').default(false).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ questionIdx: index('edu_answer_question_idx').on(t.questionId) }),
)

// ---------------------------------------------------------------------------
// 直播模块 (edu 域内)
// ---------------------------------------------------------------------------

/** 直播分类表（edu 域） */
export const eduLiveCategory = pgTable('edu_live_category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  pid: integer('pid').default(0).notNull(),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 直播频道表（edu 域） */
export const eduLiveChannel = pgTable(
  'edu_live_channel',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    coverImage: varchar('cover_image', { length: 500 }),
    intro: text('intro'),
    categoryId: integer('category_id'),
    lecturerId: integer('lecturer_id'),
    lecturerName: varchar('lecturer_name', { length: 100 }),
    pushUrl: varchar('push_url', { length: 500 }),
    playUrl: varchar('play_url', { length: 500 }),
    startTime: timestamp('start_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    isLive: boolean('is_live').default(false).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('edu_live_channel_category_idx').on(t.categoryId),
    liveIdx: index('edu_live_channel_live_idx').on(t.isLive),
  }),
)

// ---------------------------------------------------------------------------
// 首页配置模块
// ---------------------------------------------------------------------------

/** 首页配置表 */
export const eduIndexConfig = pgTable('edu_index_config', {
  id: serial('id').primaryKey(),
  configKey: varchar('config_key', { length: 100 }).notNull(),
  configValue: text('config_value'),
  description: varchar('description', { length: 500 }),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

/** 首页分类导航表 */
export const eduIndexCategory = pgTable('edu_index_category', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 500 }),
  linkUrl: varchar('link_url', { length: 500 }),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// 通知模块
// ---------------------------------------------------------------------------

/** 通知表 */
export const eduNotification = pgTable(
  'edu_notification',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    senderId: integer('sender_id'),
    title: varchar('title', { length: 200 }),
    content: text('content'),
    notifType: varchar('notif_type', { length: 50 }).default('system').notNull(),
    channel: varchar('channel', { length: 50 }).default('letter').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    refId: integer('ref_id'),
    refType: varchar('ref_type', { length: 50 }),
    readTime: timestamp('read_time', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ memberIdx: index('edu_notification_member_idx').on(t.memberId) }),
)

/** 通知设备表 */
export const eduNotificationDevice = pgTable('edu_notification_device', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').notNull(),
  deviceType: varchar('device_type', { length: 50 }),
  deviceToken: varchar('device_token', { length: 500 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// 访问统计模块
// ---------------------------------------------------------------------------

/** 访问日志表 */
export const eduVisitLog = pgTable(
  'edu_visit_log',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id'),
    ip: varchar('ip', { length: 50 }),
    city: varchar('city', { length: 100 }),
    url: varchar('url', { length: 500 }),
    referer: varchar('referer', { length: 500 }),
    userAgent: varchar('user_agent', { length: 500 }),
    sessionId: varchar('session_id', { length: 100 }),
    visitDate: varchar('visit_date', { length: 10 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('edu_visit_log_member_idx').on(t.memberId),
    dateIdx: index('edu_visit_log_date_idx').on(t.visitDate),
  }),
)

/** 浏览记录表 */
export const eduWatchRecord = pgTable(
  'edu_watch_record',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id').notNull(),
    topicId: integer('topic_id').notNull(),
    topicType: varchar('topic_type', { length: 50 }).notNull(),
    topicTitle: varchar('topic_title', { length: 200 }),
    watchDuration: integer('watch_duration').default(0).notNull(),
    lastPosition: integer('last_position').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    memberIdx: index('edu_watch_record_member_idx').on(t.memberId),
    topicIdx: index('edu_watch_record_topic_idx').on(t.topicId, t.topicType),
  }),
)

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type EduRole = typeof eduRole.$inferSelect
export type NewEduRole = typeof eduRole.$inferInsert
export type EduAuthority = typeof eduAuthority.$inferSelect
export type NewEduAuthority = typeof eduAuthority.$inferInsert
export type EduRoleAuthority = typeof eduRoleAuthority.$inferSelect
export type NewEduRoleAuthority = typeof eduRoleAuthority.$inferInsert
export type EduCarousel = typeof eduCarousel.$inferSelect
export type NewEduCarousel = typeof eduCarousel.$inferInsert
export type EduAgreement = typeof eduAgreement.$inferSelect
export type NewEduAgreement = typeof eduAgreement.$inferInsert
export type EduArticle = typeof eduArticle.$inferSelect
export type NewEduArticle = typeof eduArticle.$inferInsert
export type EduNews = typeof eduNews.$inferSelect
export type NewEduNews = typeof eduNews.$inferInsert
export type EduCategory = typeof eduCategory.$inferSelect
export type NewEduCategory = typeof eduCategory.$inferInsert
export type EduUser = typeof eduUser.$inferSelect
export type NewEduUser = typeof eduUser.$inferInsert
export type EduTrade = typeof eduTrade.$inferSelect
export type NewEduTrade = typeof eduTrade.$inferInsert
export type EduLearnCategory = typeof eduLearnCategory.$inferSelect
export type NewEduLearnCategory = typeof eduLearnCategory.$inferInsert
export type EduLearnMap = typeof eduLearnMap.$inferSelect
export type NewEduLearnMap = typeof eduLearnMap.$inferInsert
export type EduLessonHomework = typeof eduLessonHomework.$inferSelect
export type NewEduLessonHomework = typeof eduLessonHomework.$inferInsert
export type EduLessonStudyRecord = typeof eduLessonStudyRecord.$inferSelect
export type NewEduLessonStudyRecord = typeof eduLessonStudyRecord.$inferInsert
export type EduLessonTopicFull = typeof eduLessonTopic.$inferSelect
export type NewEduLessonTopicFull = typeof eduLessonTopic.$inferInsert
export type EduSignUp = typeof eduSignUp.$inferSelect
export type NewEduSignUp = typeof eduSignUp.$inferInsert
export type EduExamCategory = typeof eduExamCategory.$inferSelect
export type NewEduExamCategory = typeof eduExamCategory.$inferInsert
export type EduExam = typeof eduExam.$inferSelect
export type NewEduExam = typeof eduExam.$inferInsert
export type EduExamChapter = typeof eduExamChapter.$inferSelect
export type NewEduExamChapter = typeof eduExamChapter.$inferInsert
export type EduExamChapterSection = typeof eduExamChapterSection.$inferSelect
export type NewEduExamChapterSection = typeof eduExamChapterSection.$inferInsert
export type EduExamQuestion = typeof eduExamQuestion.$inferSelect
export type NewEduExamQuestion = typeof eduExamQuestion.$inferInsert
export type EduExamPaper = typeof eduExamPaper.$inferSelect
export type NewEduExamPaper = typeof eduExamPaper.$inferInsert
export type EduExamPaperRule = typeof eduExamPaperRule.$inferSelect
export type NewEduExamPaperRule = typeof eduExamPaperRule.$inferInsert
export type EduExamPaperQuestion = typeof eduExamPaperQuestion.$inferSelect
export type NewEduExamPaperQuestion = typeof eduExamPaperQuestion.$inferInsert
export type EduExamRecord = typeof eduExamRecord.$inferSelect
export type NewEduExamRecord = typeof eduExamRecord.$inferInsert
export type EduResourceCategory = typeof eduResourceCategory.$inferSelect
export type NewEduResourceCategory = typeof eduResourceCategory.$inferInsert
export type EduResource = typeof eduResource.$inferSelect
export type NewEduResource = typeof eduResource.$inferInsert
export type EduResourceProduct = typeof eduResourceProduct.$inferSelect
export type NewEduResourceProduct = typeof eduResourceProduct.$inferInsert
export type EduCircleCategory = typeof eduCircleCategory.$inferSelect
export type NewEduCircleCategory = typeof eduCircleCategory.$inferInsert
export type EduCircle = typeof eduCircle.$inferSelect
export type NewEduCircle = typeof eduCircle.$inferInsert
export type EduCircleDynamic = typeof eduCircleDynamic.$inferSelect
export type NewEduCircleDynamic = typeof eduCircleDynamic.$inferInsert
export type EduComment = typeof eduComment.$inferSelect
export type NewEduComment = typeof eduComment.$inferInsert
export type EduFavorite = typeof eduFavorite.$inferSelect
export type NewEduFavorite = typeof eduFavorite.$inferInsert
export type EduLike = typeof eduLike.$inferSelect
export type NewEduLike = typeof eduLike.$inferInsert
export type EduAskCategory = typeof eduAskCategory.$inferSelect
export type NewEduAskCategory = typeof eduAskCategory.$inferInsert
export type EduQuestion = typeof eduQuestion.$inferSelect
export type NewEduQuestion = typeof eduQuestion.$inferInsert
export type EduAnswer = typeof eduAnswer.$inferSelect
export type NewEduAnswer = typeof eduAnswer.$inferInsert
export type EduLiveCategory = typeof eduLiveCategory.$inferSelect
export type NewEduLiveCategory = typeof eduLiveCategory.$inferInsert
export type EduLiveChannel = typeof eduLiveChannel.$inferSelect
export type NewEduLiveChannel = typeof eduLiveChannel.$inferInsert
export type EduIndexConfig = typeof eduIndexConfig.$inferSelect
export type NewEduIndexConfig = typeof eduIndexConfig.$inferInsert
export type EduIndexCategory = typeof eduIndexCategory.$inferSelect
export type NewEduIndexCategory = typeof eduIndexCategory.$inferInsert
export type EduNotification = typeof eduNotification.$inferSelect
export type NewEduNotification = typeof eduNotification.$inferInsert
export type EduNotificationDevice = typeof eduNotificationDevice.$inferSelect
export type NewEduNotificationDevice = typeof eduNotificationDevice.$inferInsert
export type EduVisitLog = typeof eduVisitLog.$inferSelect
export type NewEduVisitLog = typeof eduVisitLog.$inferInsert
export type EduWatchRecord = typeof eduWatchRecord.$inferSelect
export type NewEduWatchRecord = typeof eduWatchRecord.$inferInsert
