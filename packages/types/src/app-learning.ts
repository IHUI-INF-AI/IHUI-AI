// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * packages/types/src/app.ts 的业务域拆分产物之一 —— 本文件承载「learning」域。
 *
 * 拆分原因:原 app.ts 单文件行数已超架构契约表对受管模块的单文件上限(config/architecture-policy.yaml
 * 的 contract-file-lines / C1),按业务域拆多入口是既定出路(EX-C2-1 的理由原文即此)。
 * 公开导出面由 ./app.ts 这个 barrel 用 export * 原样递出,与拆分前逐名等值 —— 消费端不得因此改动。
 * 要加类型请加到对应域文件;不要让类型回到 app.ts(app.ts 只允许再导出)。
 */

import type { AppIcon, TFunction } from './app-shared.js'


/** 学习计划状态 */
export type PlanStatus = 'active' | 'paused' | 'completed' | 'overdue' | string

/** 学习计划列表项(平台注入,字段对齐 mobile-rn StudyPlanScreen StudyPlan) */
export interface StudyPlanItem {
  id: string
  title: string
  courseName: string
  /** 总课时数 */
  totalLessons: number
  /** 已完成课时数 */
  completedLessons: number
  /** 学习进度(0-100,百分比) */
  progress: number
  status: PlanStatus
  /** 截止日期(ISO 或格式化字符串) */
  deadline: string
}

/** StudyPlan 屏 props */
export interface StudyPlanScreenProps {
  t: TFunction
  items: StudyPlanItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击计划卡片回调,平台注入导航跳转 */
  onPressItem: (item: StudyPlanItem) => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 课程目录项(平台注入,字段对齐 mobile-rn CourseCatalogScreen CatalogItem) */
export interface CourseCatalogItem {
  id: string
  title: string
  type: string
  /** 时长(分钟) */
  duration: number
  /** 子章节(可选,用于树形目录) */
  children?: CourseCatalogItem[]
}

/** CourseCatalog 屏 props */
export interface CourseCatalogScreenProps {
  t: TFunction
  items: CourseCatalogItem[]
  loading: boolean
  error: string
  /** 点击章节回调,平台注入导航跳转(如 navigate('CourseChapter', { id })) */
  onPressItem: (item: CourseCatalogItem) => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 课程问答列表项(平台注入,字段对齐 mobile-rn CourseQAListScreen Item) */
export interface CourseQAListItem {
  id: string
  question: string
  asker: string
  answerCount: number
  createdAt: string
}

/** CourseQAList 屏 props */
export interface CourseQAListScreenProps {
  t: TFunction
  items: CourseQAListItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击问答卡片回调,平台注入导航跳转 */
  onPressItem: (item: CourseQAListItem) => void
  /** 提问回调(可选,平台注入导航跳转) */
  onAsk?: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 课程章节项(平台注入,字段对齐 mobile-rn CourseChapterScreen Chapter) */
export interface CourseChapterItem {
  id: string
  title: string
  duration: number
  lessonCount: number
}

/** CourseChapterScreen props */
export interface CourseChapterScreenProps {
  t: TFunction
  items: CourseChapterItem[]
  loading: boolean
  error: string
  onPressItem: (item: CourseChapterItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 学习进度课程项 */
export interface StudyProgressCourse {
  id: string
  title: string
  progress: number
}

/** 学习进度数据(平台注入,字段对齐 mobile-rn StudyProgressScreen Progress) */
export interface StudyProgressData {
  totalCourses: number
  completedCourses: number
  totalMinutes: number
  weekMinutes: number
  streakDays: number
  courses: StudyProgressCourse[]
}

/** StudyProgressScreen props */
export interface StudyProgressScreenProps {
  t: TFunction
  progress: StudyProgressData | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 考试状态 */
export type ExamStatus = 'notStarted' | 'inProgress' | 'ended' | string

/** 考试项(平台注入,字段对齐 mobile-rn ExamScreen Exam) */
export interface ExamItem {
  id: string
  title: string
  description?: string
  startTime?: string
  endTime?: string
  duration: number
  totalScore: number
  passScore: number
  questionCount: number
  attemptCount: number
  maxAttempts: number
}

/** ExamScreen props */
export interface ExamScreenProps {
  t: TFunction
  items: ExamItem[]
  /** 计算考试状态(平台注入) */
  getStatus: (exam: ExamItem) => ExamStatus
  loading: boolean
  refreshing: boolean
  error: string
  toast: string
  onRefresh: () => void
  onStart: (exam: ExamItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 学习记录统计(对齐 mobile-rn StudyRecordScreen StudyStats) */
export interface StudyRecordStats {
  totalDuration: number
  totalCourses: number
  completedCourses: number
  totalLessons: number
  completedLessons: number
  continuousDays: number
}
export type StudyRecordStatus = 'in_progress' | 'paused' | 'completed'
export interface StudyRecordItem {
  id: string
  courseTitle: string | null
  lessonTitle: string | null
  status: StudyRecordStatus
  duration?: number
  progress?: number
  lastStudyAt: string
}
export interface StudyRecordScreenProps {
  t: TFunction
  records: StudyRecordItem[]
  stats: StudyRecordStats | null
  userNickname: string
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 16(2026-07-29):考试历史/考试结果/模型收益/Token 价值 */

/** 考试历史列表项(平台注入,字段对齐 mobile-rn ExamHistoryScreen ExamHistory) */
export interface ExamHistoryItem {
  id: string
  examTitle: string
  score: number
  totalScore: number
  passed: boolean
  /** 提交时间(ISO 或格式化字符串) */
  submittedAt: string
}

/** ExamHistoryScreen props */
export interface ExamHistoryScreenProps {
  t: TFunction
  items: ExamHistoryItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击历史记录回调,平台注入导航跳转(如 navigate('ExamResult', { id })) */
  onPressItem: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 考试错题项(平台注入,字段对齐 mobile-rn ExamResultScreen wrongQuestions) */
export interface ExamResultWrongQuestion {
  /** 题目序号(0-based) */
  index: number
  question: string
  yourAnswer: string
  correctAnswer: string
}

/** 考试结果详情(平台注入,字段对齐 mobile-rn ExamResultScreen ExamResult) */
export interface ExamResultItem {
  id: string
  examTitle: string
  score: number
  totalScore: number
  passed: boolean
  correctCount: number
  totalCount: number
  /** 答题时长(分钟) */
  duration: number
  submittedAt: string
  wrongQuestions: ExamResultWrongQuestion[]
}

/** ExamResultScreen props */
export interface ExamResultScreenProps {
  t: TFunction
  item: ExamResultItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 课程报名列表项 */
export interface CourseEnrollItem {
  id: string
  title: string
  instructor: string
  level: string
  lessonCount: number
  studentCount: number
  price: number
  isFree: boolean
  isEnrolled: boolean
}

/** CourseEnrollScreen props */
export interface CourseEnrollScreenProps {
  t: TFunction
  items: CourseEnrollItem[]
  loading: boolean
  refreshing: boolean
  error: string
  keyword: string
  enrollingId: string | null
  toast: string
  userNickname: string
  onKeywordChange: (keyword: string) => void
  onSearch: () => void
  onRefresh: () => void
  onEnroll: (item: CourseEnrollItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 课程列表项 */
export interface CourseScreenItem {
  id: string
  title: string
  description?: string
  instructor: string
  studentCount: number
  price: number
  isFree: boolean
  level: 'beginner' | 'intermediate' | 'advanced'
  cover?: string
}

/** CourseScreen props */
export interface CourseScreenProps {
  t: TFunction
  items: CourseScreenItem[]
  keyword: string
  loading: boolean
  error: string
  page: number
  totalPages: number
  onKeywordChange: (v: string) => void
  onPageChange: (page: number) => void
  onPressItem: (id: string) => void
  colorScheme?: 'light' | 'dark'
}

/** 课程详情数据 */
export interface CourseDetailItem {
  id: string
  title: string
  description: string
  categoryName: string
  level: string
  instructor: string
  studentCount: number
  rating: number
  price: number
  isFree: boolean
  isEnrolled: boolean
}

/** 课程章节 */
export interface CourseDetailLesson {
  lessonId: string
  title: string
  isCompleted: boolean
}

/** CourseDetailScreen props */
export interface CourseDetailScreenProps {
  t: TFunction
  item: CourseDetailItem | null
  lessons: CourseDetailLesson[]
  loading: boolean
  error: string
  enrolling: boolean
  onEnroll: () => void
  onPlayLesson: (lessonId: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * 课程难度取值域。与 `packages/database/src/schema/learn.ts` 的 `LESSON_DIFFICULTIES`
 * 同形(服务端写入校验用的就是那份常量),`lessons.difficulty` 列于
 * 迁移 20260928050000_lessons_difficulty 落地后可空 —— 未标注的行在本类型上是 null。
 */
export type LessonDifficulty = 'beginner' | 'intermediate' | 'advanced'

/** 课程列表价格轴的**服务端**档位(公开端点 price= 只认这两个值;'全部' 由"不下传该参数"表达)。 */
export type LessonPriceAxis = 'free' | 'paid'

/** 价格筛选轴档位('all' = 不下传该参数)。 */
export type CoursePriceFilter = 'all' | LessonPriceAxis

/** 难度筛选轴档位。 */
export type CourseDifficultyFilter = 'all' | LessonDifficulty

/** 分类轴选项:直接来自 GET /api/learn/categories 的真实行(中文 name + UUID id)。 */
export interface CourseFilterCategoryOption {
  id: string
  name: string
}

/**
 * 课程筛选项。
 * 2026-09-28 前这里"刻意没有 level",理由写在原注释里:lessons 表不存在难度列。
 * 列已加、查询轴已开(迁移 20260928050000 + findPublishedLessons),所以那句话的前提
 * 不再成立,现按实际字段补上;但**nullable 保真** —— 服务端回 null 就渲染 null,
 * 不得用任何默认档位把"未标注"洗成"入门"。
 */
export interface CourseFilterItem {
  id: string
  title: string
  instructor: string
  price: number
  difficulty: LessonDifficulty | null
  categoryName: string | null
}

/** CourseFilterScreen props */
export interface CourseFilterScreenProps {
  t: TFunction
  items: CourseFilterItem[]
  loading: boolean
  refreshing: boolean
  /** 取下一页中(列表底部提示用);与 loading 分开 —— 首屏与翻页的观感不是一回事 */
  loadingMore: boolean
  error: string
  priceTab: CoursePriceFilter
  onPriceTabChange: (p: CoursePriceFilter) => void
  difficultyTab: CourseDifficultyFilter
  onDifficultyTabChange: (d: CourseDifficultyFilter) => void
  /** 分类轴选项;空数组 = 服务端当前没有可用分类(渲染如实提示,不造选项) */
  categories: CourseFilterCategoryOption[]
  /** 'all'(未选)或 learn_categories.id(UUID) */
  categoryId: string
  onCategoryChange: (id: string) => void
  /** 列表触底 —— 分页由服务端取下一页,不得再对已取回的一页做二次过滤 */
  onLoadMore: () => void
  onApply: () => void
  onReset: () => void
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 课程评论项 */
export interface CourseCommentItem {
  id: string
  user: string
  content: string
  rating: number
  createdAt: string
}

/** CourseCommentScreen props */
export interface CourseCommentScreenProps {
  t: TFunction
  items: CourseCommentItem[]
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 课程附件项(CourseAnnexScreen) */
export interface CourseAnnexItem {
  id: string
  name: string
  size: number
  url: string
}

/** CourseAnnexScreen props */
export interface CourseAnnexScreenProps {
  t: TFunction
  items: CourseAnnexItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** CourseQAAskScreen props */
export interface CourseQAAskScreenProps {
  t: TFunction
  question: string
  submitting: boolean
  error: string
  success: boolean
  onQuestionChange: (v: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 课程资源项(CourseResourceScreen) */
export interface CourseResourceItem {
  id: string
  name: string
  size: number
  type: string
}

/** CourseResourceScreen props */
export interface CourseResourceScreenProps {
  t: TFunction
  items: CourseResourceItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * 讲师详情信息(LecturerDetailScreen)
 *
 * 2026-09-14 重塑:迁移 mobile-rn TeacherDetailScreen(P0 补页 7585d0493,
 * 对齐 miniapp pages/teacher/detail)到共享层,替换原批次 17 的简版死代码契约。
 * 字段映射自 @ihui/api-client Teacher(name→nickname,fans/rating 随 /teacher/:id 返回)。
 */
export interface LecturerDetailInfo {
  id: string
  /** 姓名 */
  nickname: string
  avatar: string | null
  /** 头衔(如「高级讲师」) */
  title?: string
  /** 简介(超过 60 字共享层提供展开/收起,阈值对齐 miniapp) */
  intro?: string
  /** 粉丝数 */
  fans?: number
  /** 评分 */
  rating?: number
  /** 课程数(金牌讲师判定输入之一:courseCount>=10) */
  courseCount: number
  /** 学员数(金牌讲师判定输入之二:studentCount>=1000) */
  studentCount: number
  /** 是否已关注(wrapper 乐观更新驱动) */
  isFollowing: boolean
  /** 金牌徽章(wrapper 按课程数/学员数阈值计算后传入) */
  isGold?: boolean
}

/** 讲师主讲课程(price 单位:分,0/undefined = 免费;对齐 miniapp TeacherCourse) */
export interface LecturerDetailCourse {
  id: string
  title: string
  coverUrl?: string | null
  price?: number
  students?: number
}

/** 学员评价(对齐 miniapp review 渲染字段) */
export interface LecturerDetailReview {
  id?: string
  nickname?: string
  avatar?: string
  rating?: number
  content?: string
  time?: string
}

/**
 * LecturerDetailScreen props(props 注入式:API/导航/Alert 留 wrapper)
 *
 * 共享层负责:头部(头像/姓名/金牌徽章/关注)→ 统计行 → 简介展开收起
 * → 主讲课程卡 → 学员评价(星级) → 底部联系条;关注态由 info.isFollowing 驱动。
 */
export interface LecturerDetailScreenProps {
  t: TFunction
  info: LecturerDetailInfo | null
  courses: LecturerDetailCourse[]
  reviews: LecturerDetailReview[]
  loading: boolean
  error: string
  onToggleFollow: () => void
  onContact: () => void
  onOpenCourse: (courseId: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 任务中心任务项(TaskCenterScreen) */
export interface TaskCenterItem {
  id: string
  title: string
  description: string
  type: 'daily' | 'weekly' | 'newbie'
  reward: number
  progress: number
  target: number
  completed: boolean
  claimed: boolean
  actionUrl: string | null
}

/** 任务中心 tab */
export type TaskCenterTab = 'daily' | 'weekly' | 'newbie'

/** TaskCenterScreen props */
export interface TaskCenterScreenProps {
  t: TFunction
  tasks: TaskCenterItem[]
  activeTab: TaskCenterTab
  loading: boolean
  refreshing: boolean
  error: string
  claimingId: string | null
  onTabChange: (tab: TaskCenterTab) => void
  onRefresh: () => void
  onRetry: () => void
  onClaim: (task: TaskCenterItem) => void
  onAction: (task: TaskCenterItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 考试题目(平台注入,字段对齐 mobile-rn ExamQuestionScreen Question) */
export interface ExamQuestionItem {
  id: string
  type: 'single' | 'multi'
  content: string
  options: string[]
}

/** 考试试卷(平台注入,字段对齐 mobile-rn ExamQuestionScreen Exam) */
export interface ExamQuestionPaper {
  id: string
  title: string
  questions: ExamQuestionItem[]
  duration: number
}

/** ExamQuestionScreen props(注入式:wrapper 保留 API 调用 + 状态管理) */
export interface ExamQuestionScreenProps {
  t: TFunction
  exam: ExamQuestionPaper | null
  loading: boolean
  error: string
  current: number
  answers: Record<string, number[]>
  onToggleOption: (questionId: string, optionIndex: number, multi: boolean) => void
  onPrev: () => void
  onNext: () => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 开发者套餐类型 */
export type DeveloperPlanType = 'month' | 'year'

/** 开发者套餐条目(平台注入,字段对齐 mobile-rn DeveloperScreen PayPlan) */
export interface DeveloperPlan {
  type: DeveloperPlanType
  label: string
  price: number
  unit: string
  perks: string[]
}

/** 开发者特性条目 */
export interface DeveloperFeature {
  title: string
  desc: string
}

/** DeveloperScreen props(平台无关,wrapper 注入数据+回调) */
export interface DeveloperScreenProps {
  t: TFunction
  features: DeveloperFeature[]
  plans: DeveloperPlan[]
  selected: DeveloperPlanType
  loading: boolean
  refreshing: boolean
  error: string
  submitting: boolean
  onSelectChange: (type: DeveloperPlanType) => void
  onRefresh: () => void
  onSubmit: () => void
  colorScheme?: 'light' | 'dark'
}

export interface IcpRecordScreenProps {
  t: TFunction
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export interface LearnDevelopEntry {
  icon: AppIcon | string
  title: string
  desc: string
  onPress: () => void
}

export interface LearnDevelopScreenProps {
  t: TFunction
  onBack: () => void
  onContact?: () => void
  /** 学习功能导航卡片;由端侧 wrapper 注入真实跳转 */
  entries?: LearnDevelopEntry[]
  colorScheme?: 'light' | 'dark'
}

export interface SubPackageEntry {
  icon: AppIcon | string
  title: string
  desc: string
  onPress: () => void
}

export interface SubPackageIndexScreenProps {
  t: TFunction
  onBack: () => void
  entries: SubPackageEntry[]
  colorScheme?: 'light' | 'dark'
}

/** 分类详情 Screen Props */
export interface CategoryDetailScreenProps {
  t: TFunction
  items: { id: string; name: string; description?: string; cover?: string }[]
  activeTab: string
  loading: boolean
  hasMore: boolean
  error: string
  onTabChange: (tab: string) => void
  onLoadMore: () => void
  onAgentPress: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 课程星球 Screen Props */
export interface CoursePlanetScreenProps {
  t: TFunction
  data: {
    hot: { id: string; title: string; coverImage?: string; price: number; isFree: boolean }[]
    beginner: { id: string; title: string; coverImage?: string; price: number; isFree: boolean }[]
    selected: { id: string; title: string; coverImage?: string; price: number; isFree: boolean }[]
  }
  loading: boolean
  refreshing: boolean
  error: string
  selectedType: 'all' | 'free' | 'paid'
  onTypeChange: (type: 'all' | 'free' | 'paid') => void
  onCoursePress: (id: string) => void
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 开发者入驻 Screen Props */
export interface DevEnterCoverScreenProps {
  t: TFunction
  planType: 'month' | 'year'
  loading: boolean
  onSelectPlan: (plan: 'month' | 'year') => void
  onNavigate: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 知识星球 Screen Props */
export interface KnowledgePlanetScreenProps {
  t: TFunction
  items: { id: string; title: string; cover?: string; summary?: string; createdAt: number }[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onItemClick: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 学习分类 */
export interface LearnCategory {
  id: string
  name: string
  icon: AppIcon | string
}

/** 学习中心 Screen Props */
export interface LearnScreenProps {
  t: TFunction
  progress: { totalCourses: number; completedCourses: number; learningHours: number } | null
  paths: { id: string; title: string; coverImage?: string }[]
  recommended: {
    id: string
    title: string
    description?: string
    coverImage?: string
    difficulty?: string
    duration?: number
  }[]
  loading: boolean
  error: string
  onOpenCourse: (id: string) => void
  onOpenBrowse: () => void
  onOpenCategory: (cat: LearnCategory) => void
  categories: LearnCategory[]
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 更多课程 Screen Props */
export interface MoreCourseScreenProps {
  t: TFunction
  items: {
    id: string | number
    title: string
    cover?: string
    instructor?: string
    lessonCount?: number
    price: number
    isFree: boolean
    studentCount?: number
  }[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  total: number
  onRefresh: () => void
  onEndReached: () => void
  onPressItem: (item: { id: string | number; title: string }) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

// ============ 批次 37(2026-08-15):课程发布 + 广场文章列表(props 类型单一来源 @ihui/types) ============

/** 课程分类(共享层简化类型,对齐 CourseCategory) */
export interface StudyCategory {
  id: string
  name: string
}

/** 课程阶段选项 */
export interface StageOption {
  id: number
  name: string
}

/** StudyPublishScreen props(平台无关,wrapper 注入数据+回调) */
export interface StudyPublishScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  mode: 'group' | 'video'
  onModeChange: (mode: 'group' | 'video') => void
  onBack?: () => void
  // Group form
  groupTitle: string
  groupContent: string
  groupCategory: string
  groupStage: number
  groupCoverUri: string
  groupCategories: readonly StudyCategory[]
  groupLoadingCategories: boolean
  onGroupTitleChange: (v: string) => void
  onGroupContentChange: (v: string) => void
  onGroupCategoryChange: (v: string) => void
  onGroupStageChange: (v: number) => void
  onGroupCoverPick: () => void
  onGroupCoverClear: () => void
  onGroupSubmit: () => void
  // Video form
  videoTitle: string
  videoContent: string
  videoAgent: string
  videoRemark: string
  videoCoverUri: string
  videoUri: string
  onVideoTitleChange: (v: string) => void
  onVideoContentChange: (v: string) => void
  onVideoAgentChange: (v: string) => void
  onVideoRemarkChange: (v: string) => void
  onVideoCoverPick: () => void
  onVideoCoverClear: () => void
  onVideoPick: () => void
  onVideoClear: () => void
  onVideoSubmit: () => void
  // Common
  submitting: boolean
}

/** 分类项 */
export interface CategoryItem {
  id: string
  label: string
}

// ============ 批次 38(2026-08-15):StudyIndex 学习视频(1 屏迁移自 mobile-rn) ============

/** 赛道分类 */
export interface StudyTrackCategory {
  id: string
  name: string
}

/** 学习视频项 */
export interface StudyVideoItem {
  id: string | number
  courseId?: string | number
  title: string
  name?: string
  cover?: string
  teacherName?: string
  avatar?: string
  createdAt?: string
}

/** 模型预览项(简化,对齐 ModelListItem 子集) */
export interface StudyModelPreview {
  id: string
  name: string
  description: string
  icon?: string
  isFree?: boolean
}

/** StudyIndexScreen props(wrapper 注入数据+回调) */
export interface StudyIndexScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  items: StudyVideoItem[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  page: number
  total: number
  search: string
  searchInput: string
  showSearch: boolean
  pageType: 'index' | 'model' | 'study'
  activeCategory: string
  models: StudyModelPreview[]
  previewModels: StudyModelPreview[]
  previewItems: StudyVideoItem[]
  initialLoading: boolean
  trackCategories: readonly StudyTrackCategory[]
  onRefresh: () => void
  onEndReached: () => void
  onSubmitSearch: () => void
  onSearchInputChange: (v: string) => void
  onCategoryChange: (id: string) => void
  onPageTypeChange: (t: 'index' | 'model' | 'study') => void
  onVideoClick: (item: StudyVideoItem) => void
  onBack: () => void
  onViewMoreModels: () => void
  onViewMoreCourses: () => void
  retryText: string
  emptyText: string
  noMoreText: string
  loadingText: string
  loadingMoreText: string
}

// ============ 批次 23(补,2026-08-15):课程系深屏(CourseTab 课程学习 tab,props 类型单一来源 @ihui/types) ============

/** 课程分类(对齐 Uniapp learn.vue) */
export interface CourseCategory {
  id: string
  name: string
  icon: string
}

/** 学习路径卡片数据 */
export interface CoursePath {
  id: string
  title: string
  coverImage?: string
}

/** 热门课程卡片数据 */
export interface PopularCourseItem {
  id: string
  title: string
  instructor: string
  lessons: number
  price: number
  isFree: boolean
  isVip: boolean
  studentCount: number
}

/** 课程列表项数据 */
export interface CourseListItem {
  id: string
  title: string
  cover?: string
  description?: string
  level?: string
  instructor: string
  studentCount: number
  isFree: boolean
  price: number
}

/** 学习进度概览 */
export interface ProgressOverview {
  totalCourses: number
  completedCourses: number
  learningHours: number
}

export interface CourseTabScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  progress: ProgressOverview | null
  paths: CoursePath[]
  popularItems: PopularCourseItem[]
  courses: CourseListItem[]
  loading: boolean
  error: string
  keyword: string
  page: number
  totalPages: number
  onKeywordChange: (v: string) => void
  onPageChange: (page: number) => void
  onPressCourse: (id: string) => void
  onPressCategory: (cat: CourseCategory) => void
  onPressPath: (id: string) => void
  onPressMoreCourses: () => void
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
