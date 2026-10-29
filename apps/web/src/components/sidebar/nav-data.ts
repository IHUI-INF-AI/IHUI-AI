// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Brain,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Cable,
  CircleIcon,
  ClipboardCheck,
  ClipboardList,
  Cloud,
  Code,
  Cpu,
  CreditCard,
  Database,
  Download,
  FileCheck,
  FileEdit,
  FileText,
  FlaskConical,
  FolderOpen,
  Gift,
  Globe,
  Gauge,
  GraduationCap,
  Heart,
  HelpCircle,
  History,
  Home,
  ImageIcon,
  Key,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  MapIcon,
  MapPin,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Mic,
  MonitorSmartphone,
  Moon,
  Network,
  Newspaper,
  NotebookPen,
  Package,
  Paintbrush,
  Palette,
  PenTool,
  PhoneCall,
  PieChart,
  PlayCircle,
  Plus,
  RefreshCw,
  Receipt,
  Rocket,
  RotateCcw,
  Rss,
  ScrollText,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Terminal,
  Ticket,
  TrendingUp,
  Type,
  User,
  UserCircle,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  Webhook,
  Workflow,
  Zap,
  GitBranch,
  UtensilsCrossed,
  Clapperboard,
  LineChart,
  Crown,
  Briefcase,
  Send,
} from 'lucide-react'
import { ADMIN_NAV_GROUPS, type AdminNavGroup } from '@/components/layout/AdminNav'
import type { Language } from '@/stores/language'
import type { NavItem } from './types'

/**
 * 将 AdminNavGroup(11 个运营域分组)转换为 NavItem(二级可展开项)。
 * 每个 group 的 items 作为三级子菜单。
 */
function adminGroupToNavItem(group: AdminNavGroup): NavItem {
  const GroupIcon = group.icon
  return {
    href: group.items[0]?.href ?? '/admin',
    labelKey: `adminGroup.${group.groupKey}`,
    icon: GroupIcon,
    adminOnly: true,
    // 2026-10-19 修复:labelKey 原先被硬编码成 'adminDynamic'(= "动态路由"),
    // 把 item.labelKey 整个盖掉了。渲染侧取名规则是 `dynamicLabel ?? t(labelKey)`,
    // 于是**任何缺 dynamicLabel 的分组项都 fallback 到同一句"动态路由"** —— 现读 76 项里 22 项中招
    // (aiAgent 组 20 个 relay/backup/im 项 + saas 组 2 项),表现为一排同名按钮。
    // 那 22 项的 i18n 键本就存在(中转概览/中转模型/Key 池/…)或仅 2 个真缺词条,
    // 现在透传 item.labelKey 作 fallback:有 dynamicLabel 仍优先用它,否则走各自 i18n。
    children: group.items.map((item) => ({
      href: item.href,
      labelKey: item.labelKey,
      icon: item.icon,
      adminOnly: true,
      dynamicLabel: item.dynamicLabel,
    })),
  }
}

/** /admin/theme 9 项作为可展开子菜单(消除 /admin/theme/layout.tsx 双 aside 嵌套) */
const ADMIN_THEME_CHILDREN: NavItem[] = [
  { href: '/admin/theme', labelKey: 'adminThemeList', icon: Palette, adminOnly: true },
  { href: '/admin/theme/create', labelKey: 'adminThemeCreate', icon: Plus, adminOnly: true },
  { href: '/admin/theme/colors', labelKey: 'adminThemeColors', icon: Paintbrush, adminOnly: true },
  { href: '/admin/theme/fonts', labelKey: 'adminThemeFonts', icon: Type, adminOnly: true },
  { href: '/admin/theme/dark-mode', labelKey: 'adminThemeDarkMode', icon: Moon, adminOnly: true },
  { href: '/admin/theme/assets', labelKey: 'adminThemeAssets', icon: ImageIcon, adminOnly: true },
  {
    href: '/admin/theme/presets',
    labelKey: 'adminThemePresets',
    icon: LayoutTemplate,
    adminOnly: true,
  },
  { href: '/admin/theme/export', labelKey: 'adminThemeExport', icon: Download, adminOnly: true },
]

/**
 * /models 15 项作为 /models 的三级子菜单
 *
 * 2026-10-20 简洁模式:18 项里 16 项标 `relayOps`(中转站运营后台 —— 渠道/密钥/日志/计费/
 * 流派 group 等是**全站运营数据**,普通用户点开既看不懂又可能误以为自己数据泄露)。
 * 只留 overview(模型总览)+ usage(自己的用量)两项给普通用户,父项 /models 本身保留。
 * 父项也因此**不能**标 relayOps —— 标了会把 overview/usage 一起带走。
 */
const MODELS_CHILDREN: NavItem[] = [
  { href: '/models/overview', labelKey: 'modelsOverview', icon: LayoutDashboard },
  { href: '/models/channels', labelKey: 'modelsChannels', icon: Cable, advancedOnly: 'relayOps' },
  {
    href: '/available-channels',
    labelKey: 'availableChannels',
    icon: Cable,
    advancedOnly: 'relayOps',
  },
  { href: '/models/keys', labelKey: 'modelsKeys', icon: Key, advancedOnly: 'relayOps' },
  { href: '/models/logs', labelKey: 'modelsLogs', icon: FileText, advancedOnly: 'relayOps' },
  {
    href: '/models/chats',
    labelKey: 'modelsChats',
    icon: MessagesSquare,
    advancedOnly: 'relayOps',
  },
  { href: '/models/users', labelKey: 'modelsUsers', icon: Users, advancedOnly: 'relayOps' },
  { href: '/models/groups', labelKey: 'modelsGroups', icon: UsersRound, advancedOnly: 'relayOps' },
  { href: '/models/usage', labelKey: 'modelsUsage', icon: BarChart3 },
  {
    href: '/models/trajectory',
    labelKey: 'modelsTrajectory',
    icon: Activity,
    advancedOnly: 'relayOps',
  },
  { href: '/models/prompts', labelKey: 'modelsPrompts', icon: FileText, advancedOnly: 'relayOps' },
  { href: '/models/eval', labelKey: 'modelsEval', icon: FlaskConical, advancedOnly: 'relayOps' },
  { href: '/models/billing', labelKey: 'modelsBilling', icon: Wallet, advancedOnly: 'relayOps' },
  { href: '/models/redeem', labelKey: 'modelsRedeem', icon: Ticket, advancedOnly: 'relayOps' },
  { href: '/models/referral', labelKey: 'modelsReferral', icon: Gift, advancedOnly: 'relayOps' },
  { href: '/models/openclaw', labelKey: 'modelsOpenclaw', icon: Rocket, advancedOnly: 'relayOps' },
  { href: '/models/api-docs', labelKey: 'modelsApiDocs', icon: BookOpen, advancedOnly: 'relayOps' },
  { href: '/models/skills', labelKey: 'modelsSkills', icon: Sparkles, advancedOnly: 'relayOps' },
]

/** /messages 6 项作为 /messages 的三级子菜单(带未读数 badge) */
const MESSAGES_CHILDREN: NavItem[] = [
  { href: '/messages/notice', labelKey: 'messagesNotice', icon: Bell, badge: 'notification' },
  { href: '/messages/like', labelKey: 'messagesLike', icon: Heart },
  { href: '/messages/favorite', labelKey: 'messagesFavorite', icon: Star },
  { href: '/messages/comment', labelKey: 'messagesComment', icon: MessageSquare },
  { href: '/messages/fans', labelKey: 'messagesFans', icon: Users },
  {
    href: '/messages/private-letter',
    labelKey: 'messagesPrivateLetter',
    icon: Mail,
    badge: 'messages',
  },
]

/** /user 14 项作为 /user/profile 的三级子菜单 */
const USER_CHILDREN: NavItem[] = [
  { href: '/user/profile', labelKey: 'userProfile', icon: User },
  { href: '/user/security', labelKey: 'userSecurity', icon: Shield },
  { href: '/notifications', labelKey: 'userNotifications', icon: Bell },
  { href: '/user/realname', labelKey: 'userRealname', icon: ShieldCheck },
  { href: '/user/subscription', labelKey: 'userSubscription', icon: CreditCard },
  // 2026-08-30 注:学习记录明细列表(API /api/learn/records,逐条课程记录),与 /edu/progress 不同(后者为聚合统计仪表盘),两者均保留
  { href: '/user/learn-record', labelKey: 'userLearnRecord', icon: BookOpen },
  { href: '/user/comment', labelKey: 'userComment', icon: MessageSquare },
  { href: '/user/fans', labelKey: 'userFans', icon: Users },
  { href: '/user/follow', labelKey: 'userFollow', icon: UserPlus },
  { href: '/user/ask', labelKey: 'userAsk', icon: HelpCircle },
  { href: '/user/circle', labelKey: 'userCircle', icon: CircleIcon },
  { href: '/user/resource', labelKey: 'userResource', icon: FolderOpen },
  { href: '/user/exam', labelKey: 'userExam', icon: FileCheck },
  { href: '/user/sign-up', labelKey: 'userSignUp', icon: ClipboardList },
]

/** /edu 8 项整合到 AI教育 组下 */
// 2026-10-19 P2 导出:域入口页(apps/web/app/(main)/domains/edu)复用本清单,
// 不另抄一份 —— 同一件事两个来源必然漂移(§0.6 单一真相源)。
const EDU_ITEMS: NavItem[] = [
  // 学习模块
  { href: '/edu/dashboard', labelKey: 'eduDashboard', icon: LayoutDashboard },
  // /learn 课程入口不再单列:eduGroup 主体已有 /learn(React key=href,重复项触发 duplicate key 警告且菜单双条目)
  { href: '/edu/exam', labelKey: 'eduExam', icon: FileCheck },
  { href: '/certificate', labelKey: 'eduCertificates', icon: Award },
  // 课程表
  { href: '/edu/schedule', labelKey: 'eduSchedule', icon: CalendarDays },
  // 管理功能(2026-08-30 教师角色 RBAC 接入):后端 edu-ai-management 守卫已从 requireAdmin
  // 换成 requirePermission('edu:manage'),admin 自动豁免、教师凭 RBAC 权限点放行。
  // 菜单同步用 permission 替代 adminOnly,教师可见,普通用户隐藏(避免点开只见 403)。
  {
    href: '/edu/edu-management/schedule',
    labelKey: 'eduScheduleMgr',
    icon: CalendarCheck,
    permission: 'edu:manage',
  },
  {
    href: '/edu/edu-management/attendance',
    labelKey: 'eduAttendanceMgr',
    icon: ClipboardCheck,
    permission: 'edu:manage',
  },
  {
    href: '/edu/edu-management/grades',
    labelKey: 'eduGradeMgr',
    icon: Award,
    permission: 'edu:manage',
  },
  {
    href: '/edu/edu-management/homework',
    labelKey: 'eduHomeworkMgr',
    icon: FileEdit,
    permission: 'edu:manage',
  },
  {
    href: '/edu/edu-management/scheduling',
    labelKey: 'eduSchedulingMgr',
    icon: CalendarRange,
    permission: 'edu:manage',
  },
  {
    href: '/edu/edu-management/enrollment',
    labelKey: 'eduEnrollmentMgr',
    icon: UserPlus,
    permission: 'edu:manage',
  },
  {
    href: '/edu/edu-management/finance',
    labelKey: 'eduFinanceMgr',
    icon: Landmark,
    permission: 'edu:manage',
  },
  {
    href: '/edu/edu-management/meal',
    labelKey: 'eduMealMgr',
    icon: UtensilsCrossed,
    permission: 'edu:manage',
  },
  {
    href: '/edu/edu-management/study-plan',
    labelKey: 'eduStudyPlanMgr',
    icon: ClipboardList,
    permission: 'edu:manage',
  },
  // 2026-09-19 食堂采购记账(AI 拍照识别小票→三轮核对→台账/供应商/统计)
  {
    href: '/edu/edu-management/procurement',
    labelKey: 'eduCanteenProcurement',
    icon: Receipt,
    permission: 'edu:manage',
  },
  // 学习工具
  { href: '/edu/notes', labelKey: 'eduNotes', icon: NotebookPen },
  { href: '/edu/qa', labelKey: 'eduQa', icon: HelpCircle },
  // 2026-08-30 注:学习进度聚合统计仪表盘(API /api/edu/progress,总学时/周时长/分类进度),与 /user/learn-record 不同(后者为逐条学习记录明细),两者均保留
  { href: '/edu/progress', labelKey: 'eduProgress', icon: BarChart3 },
  // 2026-08-11 家长端入口(家长-学生绑定管理 + 孩子数据查看)
  { href: '/edu/parent', labelKey: 'eduParentPortal', icon: UsersRound },
  // 2026-08-07 AI 教育特色板块 4 入口(政策库/教师认证/AIGC工具/AI课程)
  { href: '/edu-ai/policy', labelKey: 'eduAiPolicy', icon: FileText },
  { href: '/edu-ai/certification', labelKey: 'eduAiCert', icon: GraduationCap },
  { href: '/edu-ai/aigc-tools', labelKey: 'eduAiAigc', icon: Sparkles },
  { href: '/edu-ai/courses', labelKey: 'eduAiCourses', icon: Landmark },
  // 2026-08-07 P1/P2 4 入口(学习地图/课程商城/AI 批改)
  // 注:直播课堂 /live 已存在于 eduGroup 组,此处不再重复(避免 React key 冲突)
  { href: '/edu-ai/map', labelKey: 'eduAiMap', icon: MapIcon },
  { href: '/edu/shop', labelKey: 'eduAiShop', icon: ShoppingCart },
  { href: '/edu-ai/marking', labelKey: 'eduAiMarking', icon: PenTool },
  // 2026-08-07 feature-connect:AI 视频编排(脚本→素材→合成→字幕 一键编排)
  { href: '/edu-ai/video-compose', labelKey: 'eduAiVideo', icon: Clapperboard },
  // 2026-08-08 feature-final2:WebRTC 实时语音通话
  { href: '/edu-ai/voice', labelKey: 'eduAiVoice', icon: PhoneCall },
]

/**
 * 教育域条目全清单(2026-10-19 P2)
 *
 * P2 把侧边栏 eduGroup 由 49 项收敛为 1 个域入口(/domains/edu),原 22 条顶层
 * + EDU_ITEMS 27 条移到这里,由域入口页消费。**清单一个不少**,只是不再在侧边栏平铺。
 * 页面与 URL 一个不改(A 方案),旧链接仍可直接访问。
 *
 * 位置说明:必须声明在 EDU_ITEMS **之后** —— 模块顶层 const 有 TDZ,
 * 展开 `...EDU_ITEMS` 时若 EDU_ITEMS 尚未初始化会 ReferenceError(2026-10-19 实测)。
 */
export const EDU_HUB_ITEMS: NavItem[] = [
  { href: '/dashboard', labelKey: 'overview', icon: LayoutDashboard },
  { href: '/learn', labelKey: 'learn', icon: GraduationCap },
  { href: '/live', labelKey: 'live', icon: PlayCircle },
  { href: '/exam', labelKey: 'exam', icon: ScrollText },
  // 错题本/今日复习此前实现完整但全站无入口(只能手敲 URL,G-978073)
  // labelKey 用 nav 命名空间的扁平 key(nav.exam 是字符串,点分嵌套 key 解析不到)
  { href: '/exam/wrong-questions', labelKey: 'examWrongQuestions', icon: NotebookPen },
  { href: '/learn/review', labelKey: 'learnDailyReview', icon: RefreshCw },
  { href: '/lecturers', labelKey: 'lecturers', icon: Users },
  // /schedule 实为定时任务管理页(label 已从「课表」改为「任务调度」,学生课表在 /edu/schedule)
  { href: '/schedule', labelKey: 'schedule', icon: Calendar },
  { href: '/topics', labelKey: 'topics', icon: FileText },
  { href: '/asks', labelKey: 'asks', icon: MessageSquare },
  { href: '/circles', labelKey: 'circles', icon: Users },
  { href: '/resources', labelKey: 'resources', icon: Package },
  { href: '/news', labelKey: 'news', icon: Newspaper },
  { href: '/announcements', labelKey: 'announcements', icon: Megaphone },
  // /edu 8 项整合(原 /edu/layout.tsx 页面级菜单栏)
  ...EDU_ITEMS,
]

/**
 * 内容域条目全清单(2026-10-19 P2)
 *
 * P2 把侧边栏 contentGroup 由 21 项收敛为 1 个域入口(/domains/content),
 * 原条目移到这里由域入口页消费。消息 6 项仍以 children 形态保留(带未读 badge)。
 * 声明须在 MESSAGES_CHILDREN 之后(模块顶层 const 的 TDZ)。
 */
export const CONTENT_HUB_ITEMS: NavItem[] = [
  { href: '/plaza', labelKey: 'plaza', icon: LayoutGrid },
  { href: '/enterprise', labelKey: 'enterprise', icon: Briefcase },
  { href: '/distribution', labelKey: 'distribution', icon: Gift },
  { href: '/teams', labelKey: 'teams', icon: Users },
  // /messages 6 项作为可展开子菜单(原 /messages/layout.tsx 页面级菜单栏,带未读数 badge)
  {
    href: '/messages',
    labelKey: 'messages',
    icon: MessageSquare,
    children: MESSAGES_CHILDREN,
  },
  { href: '/feature-center/documents', labelKey: 'docs', icon: FileText },
  { href: '/tags', labelKey: 'tags', icon: Tag },
  { href: '/oauth/platform', labelKey: 'oauthPlatform', icon: KeyRound },
  // 自媒体创作工具(2026-07-20 从独立分组整合到内容分组,内容创作归属内容大类)
  { href: '/self-media/wechat', labelKey: 'selfMediaWechat', icon: Newspaper },
  { href: '/self-media/koubo', labelKey: 'selfMediaKoubo', icon: Mic },
  // 2026-08-07 feature-connect2:AI 语音转写(上传音频转文字)
  { href: '/tools/voice-stt', labelKey: 'eduAiStt', icon: Mic },
  // PDF 工具台(2026-10-29):/tools/pdf 三路由一直只有页面、没有入口 —— 侧栏与 /tools 都到不了
  // (/tools 的数据源 GET /api/tools 目前后端未实现 ⇒ 工具页恒空)。本条是它唯一的可达入口。
  { href: '/tools/pdf', labelKey: 'pdfTools', icon: FileText },
  // 2026-08-07 feature-connect:私信(用户间 1对1 私密聊天)
  { href: '/letters', labelKey: 'eduAiLetters', icon: Mail },
  // 2026-08-07 feature-connect:群组(用户自建群组与成员管理)
  { href: '/groups', labelKey: 'eduAiGroups', icon: UsersRound },
  // 多平台一键发布平台(2026-07-20 新增,支持 md/docx/html/pdf/图片/视频 → 14 平台)
  { href: '/publish/history', labelKey: 'publishPlatform', icon: Send },
  // 技术博客(2026-07-27 新增,docs/blog 10 篇技术文章对外曝光用)
  { href: '/blog', labelKey: 'blog', icon: BookOpen },
]

/**
 * 交易域条目全清单(2026-10-19 P2)—— 声明位置见下方 MEMBER_ITEMS 之后。
 *
 * P2 把侧边栏 tradeGroup 由 28 项收敛为 1 个域入口(/domains/trade),
 * 原条目移到这里由域入口页消费。
 */

/** /member 12 项整合到交易组下 */
const MEMBER_ITEMS: NavItem[] = [
  { href: '/member/dashboard', labelKey: 'memberDashboard', icon: LayoutDashboard },
  { href: '/member/benefits', labelKey: 'memberBenefits', icon: Award },
  { href: '/member/coupons', labelKey: 'memberCoupons', icon: Ticket },
  { href: '/member/subscription', labelKey: 'memberSubscription', icon: CreditCard },
  { href: '/refund', labelKey: 'memberRefunds', icon: RotateCcw },
  { href: '/member/addresses', labelKey: 'memberAddresses', icon: MapPin },
  { href: '/member/favorites', labelKey: 'memberFavorites', icon: Heart },
  { href: '/member/history', labelKey: 'memberHistory', icon: History },
  { href: '/invitations', labelKey: 'memberInvitations', icon: Users },
  { href: '/member/feedback', labelKey: 'memberFeedback', icon: MessageSquare },
  { href: '/member/help', labelKey: 'memberHelp', icon: HelpCircle },
  { href: '/member/settings', labelKey: 'memberSettings', icon: Settings },
]

/**
 * 交易域条目全清单(2026-10-19 P2)
 *
 * P2 把侧边栏 tradeGroup 由 28 项收敛为 1 个域入口(/domains/trade),
 * 原条目移到这里由域入口页消费。页面与 URL 一个不改(A 方案)。
 *
 * 位置说明:**必须声明在 MEMBER_ITEMS 之后** —— 末尾展开 `...MEMBER_ITEMS`,
 * 而模块顶层 const 有 TDZ。首版把本常量放在 MEMBER_ITEMS 之前,
 * import 该模块即 ReferenceError(整页白屏);已由
 * `__tests__/p2-domain-hub-nav.test.ts` 实跑钉住(读代码推断不出这一格)。
 */
export const TRADE_HUB_ITEMS: NavItem[] = [
  { href: '/earnings', labelKey: 'earnings', icon: TrendingUp },
  // 2026-08-07 feature-connect2:AI 股票分析(输入代码+问题,AI 智能分析)
  { href: '/stock', labelKey: 'eduAiStock', icon: LineChart },
  // 2026-08-07 feature-final:交易员入驻(申请认证交易员)
  { href: '/traders', labelKey: 'eduAiTraders', icon: TrendingUp },
  // 2026-08-08 feature-final2:外呼营销(批量外呼任务编排)
  { href: '/edu-ai/outbound', labelKey: 'eduAiOutbound', icon: Megaphone },
  // 2026-08-09 moved from edu-ai/fund-data:基金数据(基金列表/详情/净值)
  { href: '/fund-data', labelKey: 'fundData', icon: PieChart },
  { href: '/vip', labelKey: 'vip', icon: Crown },
  { href: '/wallet', labelKey: 'wallet', icon: Wallet },
  { href: '/payment', labelKey: 'payment', icon: CreditCard },
  { href: '/orders', labelKey: 'orders', icon: ShoppingBag },
  { href: '/invoices', labelKey: 'invoices', icon: Receipt },
  { href: '/activities', labelKey: 'activities', icon: Gift },
  { href: '/points', labelKey: 'points', icon: Star },
  { href: '/edu-points', labelKey: 'eduPoints', icon: Award },
  { href: '/oauth/my-authorized', labelKey: 'oauthMyAuthorized', icon: KeyRound },
  // /member 15 项整合(原 /member/layout.tsx 页面级菜单栏)
  ...MEMBER_ITEMS,
]

/** /developer 开发者工具子菜单(2026-08-30 瘦身):低频开发者工具收进可折叠子菜单
 * 2026-10-23 P2 收敛第一批:本清单不再挂在独立父项下,而是整体摊入开发者域入口
 * (见 DEVELOPER_HUB_CHILDREN 末尾展开)—— ExpandableNavItem 只渲染两级,
 * 三级 children 会在侧边栏静默消失,所以域子清单必须保持扁平(与 MODELS_CHILDREN 同型)。 */
const DEVELOPER_TOOLS_CHILDREN: NavItem[] = [
  // P0 Playground 内置在线测试页(2026-07-31 立):用当前用户 API Key 走 /v1/chat/completions 在线测试
  { href: '/playground', labelKey: 'playground', icon: FlaskConical },
  { href: '/developer/webhooks', labelKey: 'developerWebhooks', icon: Webhook },
  { href: '/developer/sandbox', labelKey: 'developerSandbox', icon: FlaskConical },
  { href: '/developer/limits', labelKey: 'developerLimits', icon: Gauge },
  { href: '/developer/logs', labelKey: 'developerLogs', icon: FileText },
  { href: '/developer/versions', labelKey: 'developerVersions', icon: GitBranch },
  { href: '/developer/subscription', labelKey: 'developerSubscription', icon: CreditCard },
  { href: '/purchase', labelKey: 'purchase', icon: CreditCard },
  { href: '/developer/notifications', labelKey: 'developerNotifications', icon: Bell },
  { href: '/developer/team', labelKey: 'developerTeam', icon: Users },
  { href: '/developer/billing', labelKey: 'developerBilling', icon: Receipt },
  { href: '/developer/error-codes', labelKey: 'developerErrorCodes', icon: FileText },
  { href: '/developer/relay/benefits', labelKey: 'developerBenefits', icon: Gift },
  { href: '/developer/settings', labelKey: 'developerSettings', icon: Settings },
]

/**
 * 开发者域子清单 —— P2 六大域收敛第一批(2026-10-23,票 L7241)
 *
 * developerGroup 顶层由 7 项收敛为 1 个域入口父项「开发者工具」(/developer):
 * 工作台顶 / api-docs / 中转站(+keys/usage)/ 订阅包 / 原「开发者工具」子菜单 14 项
 * 全部摊平为二级子项 —— ExpandableNavItem 只渲染两级(父+子),带 children 的
 * 三级项不会被渲染(中转站原来挂的 keys/usage 会静默消失),故本清单必须扁平
 * (与 MODELS_CHILDREN「四组扁平化为三级子菜单」同型)。入口与 URL 一个不删(A 方案);
 * /developer 页本身就是开发者工作台顶,无需新增 /domains/developer 页。
 *
 * labelKey 去向:父项沿用原折叠子菜单的 'developerTools' 档 —— 该键全仓只有这一处
 * 发射点,子菜单父项被摊平后若不接住,nav.developerTools 即成死键(门 70b
 * scan-dead-i18n-keys 为 blocking)。首个子项用 'developer' 承接原顶层入口
 * (父项与子项同 href 是 /knowledge-base、/admin/theme 既有的"父项+子菜单"设计,
 * 两者 labelKey 各不相同)。
 */
const DEVELOPER_HUB_CHILDREN: NavItem[] = [
  { href: '/developer', labelKey: 'developer', icon: Terminal },
  { href: '/developer/api-docs', labelKey: 'developerApiDocs', icon: Code },
  // 2026-09-13:原 /developer/keys 独立入口与「中转站 → API 密钥」重复且旧页 API 不存在,
  // 统一收敛到 /developer/relay/keys(旧路由保留重定向,见 developer/keys/page.tsx);
  // 原"中转站父项 + 2 子项"随本批收敛摊平为 3 个直接子项。
  { href: '/developer/relay', labelKey: 'developerRelay', icon: Zap },
  { href: '/developer/relay/keys', labelKey: 'developerRelayKeys', icon: KeyRound },
  { href: '/developer/relay/usage', labelKey: 'developerRelayUsage', icon: Activity },
  // P0 API 订阅包产品化(2026-07-31 立):3 档 API 订阅方案(Starter/Pro/Enterprise)
  {
    href: '/developer/relay/subscriptions',
    labelKey: 'developerRelaySubscriptions',
    icon: CreditCard,
  },
  // 低频开发者工具(原「开发者工具」折叠子菜单 14 项,收敛后摊平进本清单)
  ...DEVELOPER_TOOLS_CHILDREN,
]

/**
 * /developer 域项(2026-08-30 瘦身 → 2026-10-23 P2 收敛第一批)
 *
 * 2026-10-20 简洁模式:本域除末尾 2 项 adminOnly 外全部落 `developer` 档 ——
 * 整个域面向"来接 API 的外部开发者",与本站普通创作者/学习者毫无交集。
 * 收敛后**只标域入口父项一项**:20 个子项由继承规则(filterNavItemsByTier)
 * 自动带上同一档,不逐个重复标注;档位与 adminOnly/permission 是三层独立判据,
 * 禁止合并成一个字段(AGENTS §4「侧边栏可见性三层分治」)。
 * 末尾两项 adminOnly(IoT TBox 设备后台 / Meta-Learner 自进化管理)原位保留:
 * 它们归 admin 组还是开发者组属管理域收敛批次的裁决,不在本批范围。
 */
const DEVELOPER_ITEMS: NavItem[] = [
  {
    href: '/developer',
    labelKey: 'developerTools',
    icon: Terminal,
    advancedOnly: 'developer',
    children: DEVELOPER_HUB_CHILDREN,
  },
  // 2026-08-08 feature-final2:IoT 设备管理(TBox 车载设备)——设备后台管理,仅 admin 可见
  { href: '/edu-ai/tbox', labelKey: 'eduAiTbox', icon: Cpu, adminOnly: true },
  // 2026-08-08 feature-final2:自进化系统管理(Meta-Learner)——/admin/* 后端 admin 权限,仅 admin 可见
  { href: '/admin/meta-learner', labelKey: 'eduAiMetaLearner', icon: Brain, adminOnly: true },
]

/** 知识库三合一(2026-08-30):知识库/RAG/图谱 三个入口概念重叠,收进"知识库"可展开子菜单 */
const KNOWLEDGE_CHILDREN: NavItem[] = [
  { href: '/knowledge-base', labelKey: 'knowledgeBase', icon: BookOpen },
  { href: '/knowledge-rag', labelKey: 'knowledgeRag', icon: Database },
  { href: '/knowledge-graph', labelKey: 'knowledgeGraph', icon: Network },
  // 2026-09-10 2-1a:Repo Wiki 页(2026-09-07 MVP)补挂侧边栏入口
  // 2026-10-20 简洁模式:`experimental` —— 代码仓库 Wiki,是研发资产不是用户内容
  { href: '/repo-wiki', labelKey: 'repoWiki', icon: FileText, advancedOnly: 'experimental' },
  // 2026-09-10 2-1b-fe:Knowledge Card 页(仓库级任务经验卡)
  // 2026-10-20 简洁模式:`experimental` —— 仓库级任务经验卡是研发内部沉淀工具,不是用户功能
  {
    href: '/knowledge-cards',
    labelKey: 'knowledgeCards',
    icon: NotebookPen,
    advancedOnly: 'experimental',
  },
  // D29 团队级知识引擎(G-35,2026-09-26 追加):空间/成员/条目/修订审计
  // 2026-10-20 简洁模式:`experimental` —— 同上,团队知识工程侧工具
  {
    href: '/team-knowledge',
    labelKey: 'teamKnowledge',
    icon: Users,
    advancedOnly: 'experimental',
  },
]

/**
 * 高级 AI 工具(2026-08-30 新增):原 AI 分组平铺的 9 个 AI 工作台 概念入口
 * (记忆/子智能体/上下文/规格/计划/注册中心/A2A/Personas/编排)对普通用户不可理解,
 * 收进单个可折叠子菜单降噪;入口保留,高级用户仍可展开使用。
 */
const ADVANCED_AI_TOOLS_CHILDREN: NavItem[] = [
  { href: '/memory', labelKey: 'memory', icon: Brain },
  { href: '/subagents', labelKey: 'subagents', icon: Bot },
  { href: '/context', labelKey: 'context', icon: Layers },
  { href: '/spec', labelKey: 'spec', icon: FileCheck },
  { href: '/plan', labelKey: 'plan', icon: ClipboardList },
  { href: '/registry', labelKey: 'registry', icon: RefreshCw },
  { href: '/a2a', labelKey: 'eduAiA2a', icon: Network },
  { href: '/personas', labelKey: 'eduAiPersonas', icon: UsersRound },
  { href: '/orchestration', labelKey: 'eduAiOrch', icon: Server },
  { href: '/deep-research', labelKey: 'deepResearch', icon: Rocket },
  // 智能体团队管理 v1(读侧:团队运行列表 + 运行详情回看,2026-09-07 工作线 B)
  { href: '/agent-teams', labelKey: 'agentTeams', icon: UsersRound },
  { href: '/cloud-agent', labelKey: 'cloudAgent', icon: Cloud },
  { href: '/context-compaction', labelKey: 'contextCompaction', icon: Layers },
  { href: '/computer-use', labelKey: 'computerUse', icon: MonitorSmartphone },
]

/**
 * AI 域条目全清单 —— P2 六大域收敛第二批(2026-10-23,票 L7241)
 *
 * aiGroupLabel 分组顶层由 14 项收敛为 1 个域入口(/domains/ai),原 14 项(连同
 * /models 18 子项、/memory 14 子项、/knowledge-base 6 子项、/ai-world 1 子项,
 * flatten 共 53 条)整体移入本清单,由域入口页以卡片网格承载。
 * 页面一个不删、URL 一个不改(A 方案)—— 全部旧链接仍可直接访问。
 *
 * 档位归属原样带走:`advancedAi` 仍只标在 /memory 父项(14 子项由 filterNavItemsByTier
 * 的继承规则自动带档),`experimental` 仍逐子项标注,/models 父项**不得**标 relayOps
 * (标了会把 overview/usage 一起带走)—— 三层判据彼此独立,不随收敛合并(AGENTS §4)。
 *
 * 位置说明:必须声明在 MODELS_CHILDREN / ADVANCED_AI_TOOLS_CHILDREN / KNOWLEDGE_CHILDREN
 * 之后 —— 模块顶层 const 有 TDZ,展开时若尚未初始化会 ReferenceError(整页白屏,
 * 同 EDU_HUB_ITEMS / TRADE_HUB_ITEMS 首版的事故)。
 */
export const AI_HUB_ITEMS: NavItem[] = [
  // /chat 路由已废弃:AI 任务是全局 docked 面板(挂载于 MainShell,与 Sidebar 同级),
  // 顶部"+"按钮即 toggle 面板的入口,不再放可点击的 /chat 导航项。
  { href: '/chat/history', labelKey: 'chatHistory', icon: MessageSquare },
  // /models 整合原 ModelsSidebar 15 项(主功能/业务/财务/资源四组扁平化为三级子菜单)
  { href: '/models', labelKey: 'models', icon: Bot, children: MODELS_CHILDREN },
  { href: '/agents', labelKey: 'agents', icon: Bot },
  // 2026-10-20 简洁模式:`experimental` —— Agent 运行时调试台,是开发期产物,不是用户功能
  {
    href: '/agent-workbench',
    labelKey: 'agentWorkbench',
    icon: Activity,
    advancedOnly: 'experimental',
  },
  {
    href: '/agent-canvas',
    labelKey: 'agentCanvas',
    icon: Network,
    advancedOnly: 'experimental',
  },
  {
    href: '/ai-world',
    labelKey: 'aiWorld',
    icon: Globe,
    children: [{ href: '/ai-world/favorites', labelKey: 'favorites', icon: Star }],
  },
  // 2026-07-24 对标 AI 工作台的能力入口(2026-08-30 收进"高级 AI 工具"折叠子菜单)
  // 2026-10-20 简洁模式:整组标 `advancedAi` —— Agent 框架内部概念,普通用户看名词不知道是什么。
  // 只标父项:14 个子项由 filterNavItemsByTier 的继承规则自动带上同一档,不逐个重复标注。
  {
    href: '/memory',
    labelKey: 'advancedAiTools',
    icon: Brain,
    advancedOnly: 'advancedAi',
    children: ADVANCED_AI_TOOLS_CHILDREN,
  },
  // 对话内媒体任务统一中心(2026-09-09 立):视频/音乐/语音/图片任务查看/播放/取消
  { href: '/media-tasks', labelKey: 'mediaTasks', icon: Clapperboard },
  // 网页工具中心(2026-09-09 立):Firecrawl 四件套融合的只读网页抓取
  // 2026-10-20 简洁模式:`experimental` —— 面向抓取/采集场景的技术工具,普通用户无此诉求
  { href: '/web-tools', labelKey: 'webTools', icon: Globe, advancedOnly: 'experimental' },
  // D31 设计稿转码(2026-09-26 立):Figma Frame/组件 → 可运行前端代码(lucide 无 Figma 图标,用 Palette)
  // 2026-10-20 简洁模式:`experimental` —— 前端/设计师专用
  {
    href: '/figma-import',
    labelKey: 'figmaImport',
    icon: Palette,
    advancedOnly: 'experimental',
  },
  // 声纹库管理(2026-09-09 F4):token6688 克隆音色列表/详情/删除/上传
  // 2026-10-20 简洁模式:`experimental` —— 服务端音色账号管理界面,普通用户点开是空列表或他人音色
  { href: '/voices', labelKey: 'voices', icon: Mic, advancedOnly: 'experimental' },
  // 签到助手(2026-10-03 立):账号服务端化管理(ai-service /api/checkin)
  // 2026-10-20 简洁模式:`experimental` —— 服务端账号签到运维面板,与自己无关的账号状态
  { href: '/checkin', labelKey: 'checkin', icon: CalendarCheck, advancedOnly: 'experimental' },
  // 个人号池(2026-10-23 立):与签到助手同一批第三方账号,归属当前用户,可启停/立即签到/看同步态
  { href: '/account-pool', labelKey: 'accountPool', icon: Wallet, advancedOnly: 'experimental' },
  { href: '/workspace', labelKey: 'workspace', icon: FolderOpen },
  // 知识库三合一(2026-08-30):知识库/RAG/图谱 三个入口概念重叠,收进"知识库"子清单
  {
    href: '/knowledge-base',
    labelKey: 'knowledgeBase',
    icon: BookOpen,
    children: KNOWLEDGE_CHILDREN,
  },
]

/**
 * 个人域条目全清单 —— P2 六大域收敛第二批(2026-10-23,票 L7241)
 *
 * personalGroup 顶层由 5 项收敛为 1 个域入口(/domains/personal),原 5 项连同
 * 「我的学习」3 子项与 USER_CHILDREN 14 子项(flatten 共 22 条)整体移入本清单。
 * 本域一项 adminOnly / permission / advancedOnly 都没有 —— 三层判据在本域均不涉及,
 * 收敛不得顺手补标(补了就是给普通用户加门)。
 *
 * 位置说明:必须声明在 USER_CHILDREN 之后(TDZ,同上)。
 */
export const PERSONAL_HUB_ITEMS: NavItem[] = [
  {
    href: '/favorites',
    labelKey: 'myLearning',
    icon: BookOpen,
    children: [
      { href: '/favorites', labelKey: 'favorites', icon: Star },
      { href: '/following', labelKey: 'following', icon: Users },
      { href: '/subscriptions', labelKey: 'subscriptions', icon: Rss },
      // 2026-08-30 曾把「会员收藏」收进本父项,但该 href 同期仍在 MEMBER_ITEMS(交易组)登记,
      // 两份逐字相同 ⇒ React key=href 双条目(2026-10-19 P1 复查时实测仍并存)。
      // 现保留 TRADE_HUB_ITEMS 里那一份(会员功能与交易同域),此处不重复登记。
    ],
  },
  // /user 16 项作为可展开子清单(原 UserNav.tsx 页面级菜单栏)
  {
    href: '/user/profile',
    labelKey: 'user',
    icon: User,
    children: USER_CHILDREN,
  },
  { href: '/student', labelKey: 'student', icon: GraduationCap },
  // 2026-10-19 P1 归位:/settings 与 /settings/data-rights 两项移出主侧边栏,归设置页统一管理
  // (逐条核实过不丢入口,见该批提交信息)。
  { href: '/feedback', labelKey: 'feedback', icon: MessageSquare },
  { href: '/help', labelKey: 'help', icon: HelpCircle },
]

/**
 * 五个域入口页消费的全部条目(2026-10-23 P2 收敛第二批登记)。
 *
 * 为什么要有这份常量:条目搬进 *_HUB_ITEMS 后就**不在 NAV_GROUPS 里**了,而
 * FLAT_NAV_ITEMS / ALL_NAV_HREFS 两个派生面原先只从 NAV_GROUPS 取源,于是
 * 这些 href 会同时从三处消费者眼里消失 —— ① path-labels 的 TagsView 取名退化成
 * 英文 Title Case 兜底;② use-custom-nav 的收藏允许集把它们当"已删除路由"剔除
 * (用户收藏的 /models 会在刷新后无声蒸发);③ isHrefActive 的精确匹配面变小。
 * 2026-10-19 那三域(教育/内容/交易)就漏了这一格且无人发现(现读 FLAT_NAV_ITEMS
 * 不含 /learn 即证)。本批把两域带进来时一并补齐,单一真相源仍是这份清单本身。
 */
const DOMAIN_HUB_ITEM_GROUPS: NavItem[][] = [
  EDU_HUB_ITEMS,
  CONTENT_HUB_ITEMS,
  TRADE_HUB_ITEMS,
  AI_HUB_ITEMS,
  PERSONAL_HUB_ITEMS,
]

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: '',
    items: [{ href: '/', labelKey: 'home', icon: Home }],
  },
  // 热门分组(2026-08-01 新增):高频常用功能快捷入口,放在首页下方
  // 2026-10-19 P1 收敛:本组由 5 项降为 1 项。逐项去向(纯减法,页面一个不删):
  //  - /publish/history、/ai-world、/models —— 与各自业务分组重复登记(React key=href 会双条目,
  //    同 nav-data 旧注记记载的 /learn 同型病),保留业务分组那一份(那三份还带 children 子菜单)。
  //  - /settings/import —— 配置项,归设置页;设置页自有导航 helpers.ts NAV_GROUPS.navDeveloper 已登记,
  //    且 /settings/llm 页有按钮直达,删此处不丢入口。
  {
    label: 'hotGroupLabel',
    items: [
      // D17 生态入口收敛:顶栏并列的 5 个市场入口在 /ecosystem 统一聚合(老 URL 直达仍可用)
      { href: '/ecosystem', labelKey: 'ecosystemHub', icon: LayoutGrid },
    ],
  },
  {
    // 2026-10-23 P2 收敛第二批:本组由 14 项收敛为 1 个域入口(/domains/ai)。
    // 原 14 条顶层(连同 /models 18、/memory 14、/knowledge-base 6、/ai-world 1 子项,
    // flatten 53 条)全部移入 AI_HUB_ITEMS,由域入口页以卡片网格承载;侧边栏不再平铺。
    // 页面一个不删、URL 一个不改(A 方案)—— 全部旧链接仍可直接访问。
    // labelKey 复用分组同名的 nav.aiGroupLabel:本仓消息文件在 packages/i18n(本批写权
    // 不在射程),不得新增键,也不得在端内硬编码中文(AGENTS §4/§19)—— 复用既有五语言键
    // 是唯一同时满足两条的形态。档位不标在入口上:域内 /models 总览、/agents、
    // 知识库、媒体任务都是普通用户要用的功能,入口一旦被隐藏就把它们一起锁死。
    label: 'aiGroupLabel',
    items: [{ href: '/domains/ai', labelKey: 'aiGroupLabel', icon: Sparkles }],
  },
  // 管理 分组(2026-07-20 重构):
  // 整合原 AdminNav.tsx 的 11 个运营域分组(作为二级可展开项)+ /admin/theme 9 项(作为二级可展开项)。
  // admin 扁平 80 项通过 useAdminRouters() 动态加载,在 Sidebar 组件中合并到本组 items 前部。
  // 仅 admin 用户可见(items 全部 adminOnly),默认展开(见 NavGroupSection.defaultOpen)。
  {
    label: 'adminGroupLabel',
    items: [
      { href: '/admin', labelKey: 'admin', icon: Shield, adminOnly: true },
      { href: '/admin/statistics', labelKey: 'adminStatistics', icon: BarChart3, adminOnly: true },
      { href: '/admin/user-center', labelKey: 'userCenter', icon: UserCircle, adminOnly: true },
      { href: '/members', labelKey: 'members', icon: Users, adminOnly: true },
      { href: '/admin/workflows', labelKey: 'adminWorkflows', icon: Workflow, adminOnly: true },
      { href: '/admin/tags', labelKey: 'adminTags', icon: Tag, adminOnly: true },
      { href: '/admin/logs', labelKey: 'adminLogs', icon: ScrollText, adminOnly: true },
      // /admin/theme 9 项作为可展开子菜单(消除 /admin/theme/layout.tsx 双 aside 嵌套)
      {
        href: '/admin/theme',
        labelKey: 'adminTheme',
        icon: Palette,
        adminOnly: true,
        children: ADMIN_THEME_CHILDREN,
      },
      // 11 个 admin 运营域分组(运营/内容审核/财务/AI智能体/营销直播/课程考试/监控BI/客服工单/社区圈子/资源中心/开发者中心)
      ...ADMIN_NAV_GROUPS.map(adminGroupToNavItem),
    ],
  },
  {
    // 2026-10-19 P2:本组由 49 项收敛为 1 个域入口。
    // 原 49 条(仪表盘/课程/直播/考试/错题本/讲师/课表/话题/问答/圈子/资源/新闻/
    // 公告 + EDU_ITEMS 27 条含 11 项 edu:manage 教师入口)全部移入域入口页
    // /domains/edu,以卡片网格承载;侧边栏不再平铺。
    // 页面一个不删、URL 一个不改(A 方案)—— 全部旧链接仍可直接访问。
    label: 'eduGroup',
    items: [{ href: '/domains/edu', labelKey: 'eduHubTitle', icon: GraduationCap }],
  },
  {
    // 2026-10-19 P2:本组由 21 项收敛为 1 个域入口(/domains/content)。
    // 原条目(广场/企业/分销/团队/消息 6 子项/文档/标签/OAuth/自媒体 2 工具/
    // 语音转写/私信/群组/多平台发布/技术博客)全部移入 CONTENT_HUB_ITEMS,
    // 由域入口页以卡片网格承载;页面与 URL 一个不改。
    label: 'contentGroup',
    items: [{ href: '/domains/content', labelKey: 'contentHubTitle', icon: LayoutGrid }],
  },
  {
    // 2026-10-19 P2:本组由 28 项收敛为 1 个域入口(/domains/trade)。
    // 原条目(收益/股票/交易员/外呼/基金/VIP/钱包/支付/订单/发票/活动/积分/
    // 教育积分/OAuth + MEMBER_ITEMS 12 条)全部移入 TRADE_HUB_ITEMS。
    label: 'tradeGroup',
    items: [{ href: '/domains/trade', labelKey: 'tradeHubTitle', icon: Wallet }],
  },
  {
    // 2026-10-23 P2 收敛第二批:本组由 5 项收敛为 1 个域入口(/domains/personal)。
    // 原 5 条顶层(我的学习 + 3 子项 / /user/profile + USER_CHILDREN 14 / 学员中心 /
    // 反馈 / 帮助,flatten 22 条)全部移入 PERSONAL_HUB_ITEMS,由域入口页承载。
    // labelKey 复用既有的 nav.user(「个人中心」/Account):消息文件在 packages/i18n,
    // 本批无写权 ⇒ 不新增键、不硬编码中文(见 aiGroupLabel 那一条的同款说明)。
    label: 'personalGroup',
    items: [{ href: '/domains/personal', labelKey: 'user', icon: User }],
  },
  // 开发者分组(2026-07-20 新增):整合原 /developer/layout.tsx 14 项页面级菜单栏
  {
    label: 'developerGroup',
    items: DEVELOPER_ITEMS,
  },
]

export function flattenNavItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flattenNavItems(item.children) : [])])
}

/** 主侧边栏分组项 + 五个域入口页消费的条目(见 DOMAIN_HUB_ITEM_GROUPS 头注的三个消费者) */
const ALL_NAV_SOURCE_ITEMS: NavItem[] = (() => {
  const seen = new Set<string>()
  const out: NavItem[] = []
  for (const item of flattenNavItems([
    ...NAV_GROUPS.flatMap((g) => g.items),
    ...DOMAIN_HUB_ITEM_GROUPS.flat(),
  ])) {
    if (seen.has(item.href)) continue
    seen.add(item.href)
    out.push(item)
  }
  return out
})()

export const ALL_NAV_HREFS = ALL_NAV_SOURCE_ITEMS.map((i) => i.href)

/** 扁平化全部导航项(含域清单),供 TagsView 等复用 path -> labelKey 映射 */
export const FLAT_NAV_ITEMS = ALL_NAV_SOURCE_ITEMS

/**
 * 纯函数判断给定 href 是否与当前 pathname 匹配为活跃路由。
 * 与 useCallback 相比:1) 不创建新函数引用,不破坏 React.memo;2) 纯函数,相同输入永远相同输出。
 * 逻辑:pathname 以 href 开头,且没有其他 nav item 的 href 更精确地匹配当前 pathname。
 */
export function isHrefActive(href: string, pathname: string): boolean {
  if (!pathname.startsWith(href)) return false
  return !ALL_NAV_HREFS.some((h) => h !== href && h.startsWith(href) && pathname.startsWith(h))
}

/** 侧边栏语言切换菜单数据(8 端语言)。SidebarUserRow 用户菜单"语言"子菜单使用。 */
export const LANGUAGES: { code: Language; name: string; badge: string }[] = [
  { code: 'zh-CN', name: '简体中文', badge: 'ZH' },
  { code: 'zh-TW', name: '繁體中文', badge: 'TW' },
  { code: 'en', name: 'English', badge: 'EN' },
  { code: 'ja', name: '日本語', badge: 'JA' },
  { code: 'ko', name: '한국어', badge: 'KO' },
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
