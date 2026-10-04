// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * packages/types/src/app.ts 的业务域拆分产物之一 —— 本文件承载「content」域。
 *
 * 拆分原因:原 app.ts 单文件行数已超架构契约表对受管模块的单文件上限(config/architecture-policy.yaml
 * 的 contract-file-lines / C1),按业务域拆多入口是既定出路(EX-C2-1 的理由原文即此)。
 * 公开导出面由 ./app.ts 这个 barrel 用 export * 原样递出,与拆分前逐名等值 —— 消费端不得因此改动。
 * 要加类型请加到对应域文件;不要让类型回到 app.ts(app.ts 只允许再导出)。
 */

import type { ReactNode } from 'react'
import type { TFunction } from './app-shared.js'
import type { CategoryItem } from './app-learning.js'


/** 笔记列表项(平台注入,字段对齐 mobile-rn NoteListScreen Note) */
export interface NoteListItem {
  id: string
  title: string
  summary: string
  author: string
  likes: number
  createdAt: string
}

/** NoteList 屏 props */
export interface NoteListScreenProps {
  t: TFunction
  items: NoteListItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击笔记卡片回调,平台注入导航跳转 */
  onPressItem: (item: NoteListItem) => void
  /** 新建笔记回调(可选,平台注入导航跳转) */
  onCreate?: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 文章列表项(平台注入,字段对齐 mobile-rn ArticleListScreen Article) */
export interface ArticleListItem {
  id: string
  title: string
  author: string
  views: number
  publishedAt: string
  /** 封面图 URL(可空) */
  cover?: string
}

/** ArticleList 屏 props */
export interface ArticleListScreenProps {
  t: TFunction
  items: ArticleListItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击文章卡片回调,平台注入导航跳转 */
  onPressItem: (item: ArticleListItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 公告列表项(平台注入,字段对齐 mobile-rn AnnouncementScreen Announcement) */
export interface AnnouncementItem {
  id: string
  title: string
  content: string
  /** 发布时间(ISO 或格式化字符串) */
  publishTime: string
  /** 是否置顶 */
  pinned: boolean
}

/** Announcement 屏 props */
export interface AnnouncementScreenProps {
  t: TFunction
  items: AnnouncementItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击公告卡片回调,平台注入导航跳转 */
  onPressItem: (item: AnnouncementItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

// ============ 详情屏(批次 7,2026-07-29) ============

/** 笔记详情(平台注入,字段对齐 mobile-rn NoteDetailScreen Note) */
export interface NoteDetailItem {
  id: string
  title: string
  content: string
  createdAt: string
  tags: string[]
  views: number
  likes: number
  author: string
}

/** NoteDetail 屏 props */
export interface NoteDetailScreenProps {
  t: TFunction
  item: NoteDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 文章详情(平台注入,字段对齐 mobile-rn ArticleDetailScreen Article) */
export interface ArticleDetailItem {
  id: string
  title: string
  content: string
  author: string
  cover?: string
  views: number
  likes: number
  publishedAt: string
}

/** ArticleDetail 屏 props */
export interface ArticleDetailScreenProps {
  t: TFunction
  item: ArticleDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 动态详情(平台注入,字段对齐 mobile-rn PostDetailScreen Post) */
export interface PostDetailItem {
  id: string
  title: string
  content: string
  author: string
  circleName?: string
  likes: number
  comments: number
  createdAt: string
  status?: string | null
  taskStatus?: string | null
  lowestPrice?: number | string | null
  peakPrice?: number | string | null
  contact?: string | null
  cycle?: string | null
  cycleUnit?: string | null
  closingTime?: string | null
  imgs?: string | string[] | null
  types?: string[] | null
  categories?: string[] | null
}

/** PostDetail 屏 props */
export interface PostDetailScreenProps {
  t: TFunction
  item: PostDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 公告详情(平台注入,字段对齐 mobile-rn AnnouncementDetailScreen Detail) */
export interface AnnouncementDetailItem {
  id: string
  title: string
  content: string
  author: string
  publishTime: string
}

/** AnnouncementDetail 屏 props */
export interface AnnouncementDetailScreenProps {
  t: TFunction
  item: AnnouncementDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 搜索结果项(平台注入,字段对齐 mobile-rn SearchScreen) */
export interface SearchScreenItem {
  id: string
  title: string
  summary: string
  type: 'course' | 'article' | 'post' | 'note' | 'agent'
  cover?: string
}

/** SearchScreen props */
export interface SearchScreenProps {
  t: TFunction
  keyword: string
  results: SearchScreenItem[]
  loading: boolean
  error: string
  searched: boolean
  onKeywordChange: (text: string) => void
  onSearch: () => void
  onPressItem: (item: SearchScreenItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 问答回答 */
export interface AskAnswerItem {
  id: string
  author: string
  content: string
  isAccepted: boolean
  createdAt: string
}

/** 问答详情(平台注入,字段对齐 mobile-rn AskDetailScreen Ask) */
export interface AskDetailItem {
  id: string
  title: string
  content: string
  author: string
  answers: AskAnswerItem[]
  views: number
  createdAt: string
}

/** AskDetailScreen props */
export interface AskDetailScreenProps {
  t: TFunction
  item: AskDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 问答列表项(平台注入,字段对齐 mobile-rn AskListScreen Ask) */
export interface AskListItem {
  id: string
  title: string
  author: string
  answerCount: number
  views: number
  createdAt: string
}

/** AskListScreen props */
export interface AskListScreenProps {
  t: TFunction
  items: AskListItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (id: string) => void
  onCreate: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 11(2026-07-29):表单型(问答创建/笔记创建/证书申请/账号设置) */

/** AskCreateScreen props(表单屏,状态由 wrapper 管理) */
export interface AskCreateScreenProps {
  t: TFunction
  title: string
  content: string
  tags: string
  saving: boolean
  error: string
  onTitleChange: (text: string) => void
  onContentChange: (text: string) => void
  onTagsChange: (text: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** NoteCreateScreen props(表单屏,状态由 wrapper 管理) */
export interface NoteCreateScreenProps {
  t: TFunction
  title: string
  content: string
  tags: string
  isPublic: boolean
  saving: boolean
  error: string
  onTitleChange: (text: string) => void
  onContentChange: (text: string) => void
  onTagsChange: (text: string) => void
  onTogglePublic: () => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 活动状态 */
export type ActivityStatus = 'upcoming' | 'ongoing' | 'ended'

/** 活动项(平台注入,字段对齐 mobile-rn ActivityScreen Activity) */
export interface ActivityItem {
  id: string
  title: string
  description: string
  startTime: string
  endTime: string
  status: ActivityStatus
  participants: number
}

/** ActivityScreen props */
export interface ActivityScreenProps {
  t: TFunction
  items: ActivityItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 16(2026-07-29):简单详情/表单/展示类(活动详情/Agent评价详情/银行卡/名片/课程报名/通知设置/发帖/二维码/实名认证/安全设置) */

/** 活动详情数据 */
export interface ActivityDetailItem {
  id: string
  title: string
  content: string
  startAt: string
  endAt: string
  location: string
}

/** ActivityDetailScreen props */
export interface ActivityDetailScreenProps {
  t: TFunction
  item: ActivityDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 电子名片数据 */
export interface BusinessCardItem {
  id: string
  name: string
  position: string
  company: string
  phone: string
  wechat: string
  email: string
  location: string
  bio: string
}

/** BusinessCardScreen props */
export interface BusinessCardScreenProps {
  t: TFunction
  card: BusinessCardItem | null
  loading: boolean
  error: string
  saved: boolean
  onShare: () => void
  onSave: () => void
  onEdit: () => void
  onBack: () => void
  /** 定制名片入口(对齐原项目 business-card/index.vue 的"社区名片定制入口";暂无对应落地页时 toast 提示) */
  onCustomize: () => void
  /** 分享到微信(走 RN Share.share,对齐原 project business-card-sharing 组件 @wx 事件) */
  onShareWechat: () => void
  /** 分享到朋友圈(走 RN Share.share,对齐原 project business-card-sharing 组件 @pyq 事件) */
  onShareMoments: () => void
  colorScheme?: 'light' | 'dark'
}

/** PostCreateScreen props(表单类,字段直接注入) */
export interface PostCreateScreenProps {
  t: TFunction
  title: string
  content: string
  tags: string
  saving: boolean
  error: string
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  onTagsChange: (tags: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 二维码信息 */
export interface QrCodeItem {
  content: string
  url: string
  inviteCode: string
}

/** QrCodeScreen props */
export interface QrCodeScreenProps {
  t: TFunction
  info: QrCodeItem | null
  loading: boolean
  error: string
  onShare: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 24(2026-07-29):Circle 系(圈子)4 屏 — 成员/详情/创建/聊天 */

/** 圈子成员项 */
export interface CircleMemberItem {
  id: string
  name: string
  avatar?: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
}

/** CircleMemberScreen props */
export interface CircleMemberScreenProps {
  t: TFunction
  items: CircleMemberItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 圈子详情数据 */
export interface CircleDetailItem {
  id: string
  name: string
  description: string
  memberCount: number
  postCount: number
  isJoined: boolean
  createdAt: string
}

/** CircleDetailScreen props */
export interface CircleDetailScreenProps {
  t: TFunction
  item: CircleDetailItem | null
  loading: boolean
  error: string
  onJoin: () => void
  onLeave: () => void
  onPressPost: () => void
  onPressMembers: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** CircleCreateScreen props */
export interface CircleCreateScreenProps {
  t: TFunction
  name: string
  description: string
  saving: boolean
  error: string
  onNameChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 圈子聊天消息 */
export interface CircleChatMessage {
  id: string
  role: 'user' | 'other'
  author: string
  content: string
  createdAt: string
}

/** CircleChatScreen props */
export interface CircleChatScreenProps {
  t: TFunction
  title: string
  messages: CircleChatMessage[]
  loading: boolean
  error: string
  input: string
  sending: boolean
  onInputChange: (v: string) => void
  onSend: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 笔记项(NoteScreen) */
export interface NoteItem {
  id: string
  title: string
  content: string
  updatedAt: string
}

/** NoteScreen props(含编辑 Modal) */
export interface NoteScreenProps {
  t: TFunction
  userLabel: string
  notes: NoteItem[]
  loading: boolean
  refreshing: boolean
  error: string
  toast: string
  modalVisible: boolean
  editing: NoteItem | null
  title: string
  content: string
  saving: boolean
  onRefresh: () => void
  onBack: () => void
  onOpenCreate: () => void
  onOpenEdit: (note: NoteItem) => void
  onTitleChange: (v: string) => void
  onContentChange: (v: string) => void
  onSave: () => void
  onDelete: (note: NoteItem) => void
  onCloseModal: () => void
  colorScheme?: 'light' | 'dark'
}

/** 课程学习进度(平台无关镜像,字段对齐 @ihui/api-client CourseProgress) */
export interface VideoPlayerProgress {
  courseId: string
  totalLessons: number
  completedLessons: number
  progress: number
  lastLearnedAt: string | null
}

/** VideoPlayerScreen props(平台无关,wrapper 注入数据+播放器 slot+回调) */
export interface VideoPlayerScreenProps {
  t: TFunction
  title?: string
  videoUrl?: string
  progress: VideoPlayerProgress | null
  completed: boolean
  completing: boolean
  loading: boolean
  error: string
  onComplete: () => void
  onBack: () => void
  playerContent?: ReactNode
  colorScheme?: 'light' | 'dark'
}

export interface PlazaCoverScreenProps {
  t: TFunction
  onBack: () => void
  onEnter: () => void
  onPublish: () => void
  colorScheme?: 'light' | 'dark'
}

// ============ 批次 35(2026-08-15):账号注销/充值/分类详情/课程星球/开发者入口/分销订单/知识星球/学习中心/更多课程/需求广场(10 屏迁移自 mobile-rn) ============

/** 广场任务项(共享层简化类型,保留 UI 渲染所需字段) */
export interface PlazaItem {
  id: string
  title: string
  description?: string
  creator?: string
  createdAt?: string
  status?: string
  [key: string]: unknown
}

/** 广场状态切换 chip */
export interface StatusChip {
  label: string
  value: string
}

/** AI 需求广场 Screen Props */
export interface PlazaScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  items: PlazaItem[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  status: string
  search: string
  showSearch: boolean
  onRefresh: () => void
  onEndReached: () => void
  onStatusChange: (status: string) => void
  onSearchChange: (search: string) => void
  onSubmitSearch: () => void
  onPressItem: (item: PlazaItem) => void
  onPublish: () => void
  onBack?: () => void
}

/** 需求广场 Screen Props */
export interface SetNeedScreenProps {
  t: TFunction
  form: {
    title: string
    description: string
    lowestPrice: string
    peakPrice: string
    contact: string
    cycle: string
    cycleUnit: string
    types: string
    categories: string
    closingTime: string
    imgs: string[]
  }
  submitting: boolean
  onFieldChange: (field: string, value: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 文章卡片(共享层简化类型,保留 UI 渲染所需字段) */
export interface ArticleItem {
  id: string
  title: string
  summary?: string
  authorName?: string
  createdAt?: string
  viewCount?: number
  category?: string
  sourceName?: string
  [key: string]: unknown
}

/** SquareScreen props(平台无关,wrapper 注入数据+回调) */
export interface SquareScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  items: ArticleItem[]
  loading: boolean
  refreshing: boolean
  error: string
  categories: CategoryItem[]
  selectedCategory: string
  onSelectCategory: (id: string) => void
  onRefresh: () => void
  onEndReached: () => void
  onItemClick: (id: string) => void
  showBackTop: boolean
  onBackToTop: () => void
  /** 暴露内部 FlatList ref(wrapper 用于返回顶部 scrollToOffset,对齐 ChatScreen onListRef 模式) */
  onListRef?: (ref: unknown) => void
  onBack?: () => void
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
