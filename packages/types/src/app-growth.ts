// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * packages/types/src/app.ts 的业务域拆分产物之一 —— 本文件承载「growth」域。
 *
 * 拆分原因:原 app.ts 单文件行数已超架构契约表对受管模块的单文件上限(config/architecture-policy.yaml
 * 的 contract-file-lines / C1),按业务域拆多入口是既定出路(EX-C2-1 的理由原文即此)。
 * 公开导出面由 ./app.ts 这个 barrel 用 export * 原样递出,与拆分前逐名等值 —— 消费端不得因此改动。
 * 要加类型请加到对应域文件;不要让类型回到 app.ts(app.ts 只允许再导出)。
 */

import type { ReactNode } from 'react'
import type { AppIcon, TFunction } from './app-shared.js'
import type { PromotionCoupon } from './app-commerce.js'


// ============================================================
// 第三批共享屏类型(2026-07-29):PointHistory/NoteList/ArticleList/
// Announcement/LivePlaybackList/RefundHistory/CourseQAList
// ============================================================

/** 积分历史列表项(平台注入,字段对齐 mobile-rn PointHistoryScreen Item) */
export interface PointHistoryItem {
  id: string
  /** 操作描述(如"签到"/"消费") */
  action: string
  /** 积分变动(正数获得,负数消耗) */
  points: number
  /** 变动后余额 */
  balance: number
  /** ISO 时间字符串或格式化后的时间文本 */
  createdAt: string
}

/** PointHistory 屏 props */
export interface PointHistoryScreenProps {
  t: TFunction
  items: PointHistoryItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 积分规则列表项(平台注入,字段对齐 mobile-rn PointRuleScreen Item) */
export interface PointRuleItem {
  id: string
  action: string
  points: number
  desc: string
}

/** PointRule 屏 props */
export interface PointRuleScreenProps {
  t: TFunction
  items: PointRuleItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** VIP 等级详情(平台注入,字段对齐 mobile-rn VipLevelScreen Detail) */
export interface VipLevelItem {
  id: string
  levelName: string
  price: number
  durationDays: number
  benefits: string
}

/** VipLevel 屏 props */
export interface VipLevelScreenProps {
  t: TFunction
  item: VipLevelItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** VIP 对比行(平台注入,字段对齐 mobile-rn VipCompareScreen CompareRow) */
export interface VipCompareRow {
  feature: string
  basic: string
  premium: string
  enterprise: string
}

/** VipCompareScreen props */
export interface VipCompareScreenProps {
  t: TFunction
  rows: VipCompareRow[]
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 分享生成结果(平台注入,字段对齐 mobile-rn ShareScreen ShareResp) */
export interface ShareResultItem {
  shareUrl: string
  shareCode: string
  expireAt: string
}

/** ShareScreen props */
export interface ShareScreenProps {
  t: TFunction
  targetTitle: string
  remark: string
  result: ShareResultItem | null
  loading: boolean
  error: string
  onRemarkChange: (text: string) => void
  onCreate: () => void
  onShare: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
  /** 自定义头部渲染(wrapper 注入,替代默认返回按钮+标题) */
  renderHeader?: () => ReactNode
  /** 自定义内容渲染(wrapper 注入,替代默认备注输入+创建按钮+结果卡片) */
  renderContent?: () => ReactNode
  /** 自定义底部渲染(wrapper 注入,替代默认分享按钮) */
  renderFooter?: () => ReactNode
  /** 容器样式覆盖(wrapper 注入,用于调整 padding 等) */
  containerStyle?: object
  /** 内容区域样式覆盖 */
  contentStyle?: object
}

/** 关注用户列表项(平台注入,字段对齐 mobile-rn FollowingScreen FollowUser) */
export interface FollowingItem {
  id: string
  username: string
  nickname?: string
  avatar?: string | null
  bio?: string
  followedAt: string
}

/** FollowingScreen props */
export interface FollowingScreenProps {
  t: TFunction
  items: FollowingItem[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  onRefresh: () => void
  onLoadMore: () => void
  onUnfollow: (item: FollowingItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 排行榜范围 */
export type RankingRange = 'weekly' | 'monthly' | 'allTime' | string

/** 排行榜项(平台注入,字段对齐 mobile-rn RankingScreen RankItem) */
export interface RankingItem {
  id: string
  rank: number
  nickname: string
  avatar: string | null
  points: number
  studyHours: number
  isMe: boolean
}

/** RankingScreen props */
export interface RankingScreenProps {
  t: TFunction
  top3: RankingItem[]
  rest: RankingItem[]
  range: RankingRange
  onSelectRange: (range: RankingRange) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 积分商城商品(平台注入,字段对齐 mobile-rn PointsMallScreen Product) */
export interface PointsMallItem {
  id: string
  name: string
  description: string
  pointsCost: number
  stock: number
  cover: string | null
}

/** PointsMallScreen props */
export interface PointsMallScreenProps {
  t: TFunction
  items: PointsMallItem[]
  balance: number
  redeemingId: string | null
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onRedeem: (item: PointsMallItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** VIP 等级(平台注入,字段对齐 mobile-rn VipScreen VipLevel) */
export interface VipLevelItem2 {
  id: string
  levelName: string
  levelValue: number
  price: number
  durationDays: number
  status: number
  benefits?: Record<string, unknown>
}

/** VIP 会员信息(平台注入,字段对齐 mobile-rn VipScreen MembershipInfo) */
export interface VipMembershipInfo {
  isActive: boolean
  level: number
  levelName: string
  expireTime: string
  daysRemaining: number
}

/** VipScreen props */
export interface VipScreenProps {
  t: TFunction
  levels: VipLevelItem2[]
  membership: VipMembershipInfo | null
  loading: boolean
  refreshing: boolean
  error: string
  toast: string
  purchasingId: string | null
  onRefresh: () => void
  onPurchase: (level: VipLevelItem2) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 积分记录项(对齐 mobile-rn PointsRecordScreen PointsRecord) */
export type PointsRecordType = 'all' | 'earn' | 'spend'
export interface PointsRecordItem {
  id: string
  type: 'earn' | 'spend'
  source: string
  amount: number
  balanceAfter: number
  createdAt: string
}
export interface PointsRecordScreenProps {
  t: TFunction
  items: PointsRecordItem[]
  balance: number
  activeTab: PointsRecordType
  onSelectTab: (tab: PointsRecordType) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 邀请信息(对齐 mobile-rn InviteScreen InviteInfo) */
export interface InviteInfo {
  inviteCode: string
  inviteUrl: string
  totalInvited: number
  totalReward: number
}
export interface InviteRecordItem {
  id: string
  nickname: string
  invitedAt: string
  reward: number
  status: 'pending' | 'completed'
}
export interface InviteScreenProps {
  t: TFunction
  info: InviteInfo | null
  records: InviteRecordItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onShare: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 关注/粉丝项(对齐 mobile-rn FollowScreen FollowUser) */
export type FollowTab = 'following' | 'fans'
export interface FollowUserItem {
  id: string
  nickname: string | null
  username: string
  avatar: string | null
  bio: string | null
  followedAt: string
}
export interface FollowScreenProps {
  t: TFunction
  items: FollowUserItem[]
  activeTab: FollowTab
  onSelectTab: (tab: FollowTab) => void
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  onRefresh: () => void
  onLoadMore: () => void
  onUnfollow: (item: FollowUserItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

// ============ 批次 26-28(2026-07-29):分销/考试/财务/首页/实名/推广/招募/推荐/团队/视频/权益(12 屏迁移自 mobile-rn) ============

/** 分销商品(平台注入,字段对齐 mobile-rn DistributionScreen Product) */
export interface DistributionProduct {
  id: string
  title: string
  commission: number
  salePrice: number
  sales: number
}

/**
 * 分销概览 — 对齐后端 GET /distribution/overview 真实返回。
 * 金额单位均为「分」(commission_flows.amount / withdrawalFlows.amount)。
 * 展示层兼容字段(commissionRate/withdrawMin/products)后端无对应数据源,
 * 保留为可选,共享屏缺省不渲染/按 0 处理(不伪造)。
 */
export interface DistributionInfo {
  /** 累计佣金(全部状态流水合计,分) */
  totalCommission: number
  /** 可提现余额(status=1 佣金 − 已提现 − 提现中,分) */
  availableCommission: number
  /** 待结算佣金(commission_flows.status=1,分) */
  pendingCommission: number
  /** 已提现(withdrawal_flows.status=2 累计,分) */
  withdrawnCommission: number
  inviteCode: string | null
  /** 分销等级(users.level 数字) */
  level: number
  /** 总邀请人数(users.parentId = 当前用户计数) */
  invitedCount: number
  /** 活跃邀请人数(邀请用户中 status=1 计数) */
  activeCount: number
  /** 推广订单数(commission_flows 去重非空 orderId;无订单数据时为 null) */
  orderCount: number | null
  /** 佣金率(后端无数据源,可选;共享屏无值时不渲染) */
  commissionRate?: number
  /** 最低提现(后端无数据源,可选;缺省按 0 处理) */
  withdrawMin?: number
  /** 推广商品(后端无数据源,可选;共享屏无值时不渲染列表) */
  products?: DistributionProduct[]
}

/** DistributionScreen props(注入式:wrapper 保留 API 调用 + Alert 弹窗) */
export interface DistributionScreenProps {
  t: TFunction
  info: DistributionInfo | null
  loading: boolean
  refreshing: boolean
  error: string
  withdrawing: boolean
  onRefresh: () => void
  onWithdraw: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 首页推荐课程项(平台注入,字段对齐 mobile-rn HomeScreen Course 子集) */
export interface HomeRecommendItem {
  id: string
  title: string
  instructor: string
  level: string
  studentCount: number
  price: number
  isFree: boolean
  /** 封面图(对齐 Course.cover,轮播/课程卡展示;可空) */
  cover?: string | null
}

/** 首页直播预览项(平台注入,字段对齐 mobile-rn HomeScreen Live 子集) */
export interface HomeLiveItem {
  id: string
  title: string
  lecturerName?: string | null
  isLive: boolean
  startTimeText: string
}

/** 首页学习进度项(平台注入,字段对齐 mobile-rn HomeScreen StudyProgress 子集) */
export interface HomeProgressItem {
  courseId: string
  courseTitle?: string | null
  progress: number
  completedLessons: number
  totalLessons: number
}

/** 首页发现菜单项(平台注入,字段对齐 mobile-rn HomeScreen 菜单配置) */
export interface HomeMenuItem {
  key: string
  labelKey: string
  icon: AppIcon | string
}

/** HomeScreen props(注入式:wrapper 保留 useAuth/useNotificationStore/API 调用) */
export interface HomeScreenProps {
  t: TFunction
  userNickname: string
  connected: boolean
  unreadCount: number
  recommends: HomeRecommendItem[]
  lives: HomeLiveItem[]
  progress: HomeProgressItem[]
  menuItems: HomeMenuItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onOpenNotifications: () => void
  onPressProgress: (courseId: string) => void
  onPressLive: (id: string) => void
  onPressCourse: (id: string) => void
  onPressMenu: (key: string) => void
  onNavigateCourses: () => void
  onNavigateLives: () => void
  colorScheme?: 'light' | 'dark'
}

/** 推广状态(active/inactive) */
export type PromoteStatus = 'active' | 'inactive'

/** 推广信息汇总(平台注入,字段对齐 mobile-rn PromoteScreen Info) */
export interface PromoteInfo {
  referralCode: string
  referralLink: string
  inviteCount: number
  activeCount: number
  totalEarnings: number
  pendingEarnings: number
  rules: string[]
}

/** 推广邀请记录(平台注入,字段对齐 mobile-rn PromoteScreen InviteRecord) */
export interface PromoteInviteRecord {
  id: string
  nickname: string
  joinDate: string
  contribution: number
  status: PromoteStatus
}

/** PromoteScreen props(平台无关,wrapper 注入数据+回调) */
export interface PromoteScreenProps {
  t: TFunction
  info: PromoteInfo | null
  records: PromoteInviteRecord[]
  loading: boolean
  refreshing: boolean
  error: string
  copied: boolean
  onRefresh: () => void
  onCopy: () => void
  onShare: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** PromotionScreen props(平台无关,wrapper 注入数据+回调) */
export interface PromotionScreenProps {
  t: TFunction
  items: PromotionCoupon[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onUse: (item: PromotionCoupon) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 招聘职位分类(all/tech/product/design/ops) */
export type RecruitmentCategory = 'all' | 'tech' | 'product' | 'design' | 'ops'

/** 招聘职位(平台注入,字段对齐 mobile-rn RecruitmentScreen Job) */
export interface RecruitmentJob {
  id: string
  position: string
  company: string
  salary: string
  location: string
  category: Exclude<RecruitmentCategory, 'all'>
  tags: string[]
  experience: string
  education: string
  description: string
  requirements: string[]
}

/** RecruitmentScreen props(平台无关,wrapper 注入数据+回调) */
export interface RecruitmentScreenProps {
  t: TFunction
  jobs: RecruitmentJob[]
  activeTab: RecruitmentCategory
  appliedIds: ReadonlySet<string>
  selected: RecruitmentJob | null
  loading: boolean
  error: string
  onSelectTab: (tab: RecruitmentCategory) => void
  onSelectJob: (job: RecruitmentJob | null) => void
  onApply: (job: RecruitmentJob) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 推荐人信息(平台注入,字段对齐 mobile-rn ReferrerScreen Info) */
export interface ReferrerInfo {
  referrerName: string | null
  referrerCode: string | null
}

/** ReferrerScreen props(平台无关,wrapper 注入数据+回调) */
export interface ReferrerScreenProps {
  t: TFunction
  info: ReferrerInfo | null
  code: string
  loading: boolean
  submitting: boolean
  error: string
  success: string
  onCodeChange: (text: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 团队成员状态 */
export type TeamMemberStatus = 'active' | 'inactive'

/** 成员关系(direct/indirect) */
export type TeamRelation = 'direct' | 'indirect'

/** 团队 tab(all/direct/indirect) */
export type TeamTab = 'all' | 'direct' | 'indirect'

/** 团队统计(平台注入,字段对齐 mobile-rn TeamScreen Stats) */
export interface TeamStats {
  totalMembers: number
  activeMembers: number
  directCount: number
  indirectCount: number
  totalContribution: number
}

/** 团队成员(平台注入,字段对齐 mobile-rn TeamScreen Member) */
export interface TeamMember {
  id: string
  nickname: string
  avatar: string | null
  level: number
  joinDate: string
  contribution: number
  status: TeamMemberStatus
  relation: TeamRelation
}

/** TeamScreen props(平台无关,wrapper 注入数据+回调) */
export interface TeamScreenProps {
  t: TFunction
  stats: TeamStats | null
  members: TeamMember[]
  activeTab: TeamTab
  loading: boolean
  refreshing: boolean
  error: string
  onSelectTab: (tab: TeamTab) => void
  onRefresh: () => void
  onBack: () => void
  /** 点击成员卡片跳转详情(可选,不传则卡片不可点击) */
  onPressMember?: (memberId: string) => void
  /** 搜索关键词(对齐 Uniapp distribution_personnel_list InputArea「搜索我的团友」;不传则隐藏搜索框) */
  keyword?: string
  /** 搜索关键词变更回调(由 wrapper 注入 state) */
  onKeywordChange?: (keyword: string) => void
  colorScheme?: 'light' | 'dark'
}

/** VIP 权益条目(平台注入,字段对齐 mobile-rn VipBenefitScreen Item) */
export interface VipBenefitItem {
  id: string
  name: string
  desc: string
  level: string
}

/** VipBenefitScreen props(平台无关,wrapper 注入数据+回调) */
export interface VipBenefitScreenProps {
  t: TFunction
  items: VipBenefitItem[]
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 团队成员详情 props(批次 34 2026-08-15 建,2026-08-21 扩展 loading/error/onRetry + member 可空) */
export interface TeamDetailScreenProps {
  t: TFunction
  onBack: () => void
  member: {
    id: string
    nickname: string
    phone: string
    avatar: string | null
    joinedAt: string
    transactionVolume: number
    commission: number
    orderNum: number
  } | null
  loading?: boolean
  error?: string
  onRetry?: () => void
  onContact: () => void
  onViewOrders: () => void
  colorScheme?: 'light' | 'dark'
}

/**
 * 排行榜详情 props(批次 34 建,2026-08-21 用户化):
 * 列表页为 users 积分排行(/ranking),详情页对齐原版"列表页透传"模式,
 * detail 改用户维度(积分/学习时长/等级),替代原模型形态(organization/attention/context)。
 */
export interface RankingDetailScreenProps {
  t: TFunction
  onBack: () => void
  detail: {
    avatar: string | null
    title: string
    rank: number
    points: number
    studyHours: number
    level: number
  }
  history: Array<{ id: string; title: string; createdAt: number }>
  drawerVisible: boolean
  onDrawerVisibleChange: (v: boolean) => void
  onNavigate: (tab: string) => void
  onNavigateCompany: () => void
  onClaimFree: () => void
  onCreateNewChat: () => void
  onNavigateExtra: (menu: string) => void
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onOpenSettings: () => void
  onOpenMessages: () => void
  onGoHome: () => void
  colorScheme?: 'light' | 'dark'
}

/** 分销订单列表 Screen Props */
export interface DistributionOrderListScreenProps {
  t: TFunction
  orders: {
    id: string
    orderId: string
    userNickname: string
    orderAmount: number
    commissionAmount: number
    rate: number
    createdAt: string
    status: string
  }[]
  keyword: string
  activeTab: string
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  onSearch: () => void
  onKeywordChange: (keyword: string) => void
  onTabChange: (tab: string) => void
  onEndReached: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
