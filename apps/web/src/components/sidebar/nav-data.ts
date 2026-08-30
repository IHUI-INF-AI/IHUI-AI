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
    children: group.items.map((item) => ({
      href: item.href,
      labelKey: 'adminDynamic',
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
  { href: '/configs', labelKey: 'adminConfigs', icon: Settings, adminOnly: true },
]

/** /models 15 项作为 /models 的三级子菜单 */
const MODELS_CHILDREN: NavItem[] = [
  { href: '/models/overview', labelKey: 'modelsOverview', icon: LayoutDashboard },
  { href: '/models/market', labelKey: 'modelsMarket', icon: Bot },
  { href: '/models/channels', labelKey: 'modelsChannels', icon: Cable },
  { href: '/models/keys', labelKey: 'modelsKeys', icon: Key },
  { href: '/models/logs', labelKey: 'modelsLogs', icon: FileText },
  { href: '/models/chats', labelKey: 'modelsChats', icon: MessagesSquare },
  { href: '/models/users', labelKey: 'modelsUsers', icon: Users },
  { href: '/models/groups', labelKey: 'modelsGroups', icon: UsersRound },
  { href: '/models/usage', labelKey: 'modelsUsage', icon: BarChart3 },
  { href: '/models/trajectory', labelKey: 'modelsTrajectory', icon: Activity },
  { href: '/models/prompts', labelKey: 'modelsPrompts', icon: FileText },
  { href: '/models/eval', labelKey: 'modelsEval', icon: FlaskConical },
  { href: '/models/billing', labelKey: 'modelsBilling', icon: Wallet },
  { href: '/models/redeem', labelKey: 'modelsRedeem', icon: Ticket },
  { href: '/models/referral', labelKey: 'modelsReferral', icon: Gift },
  { href: '/models/openclaw', labelKey: 'modelsOpenclaw', icon: Rocket },
  { href: '/models/api-docs', labelKey: 'modelsApiDocs', icon: BookOpen },
  { href: '/models/skills', labelKey: 'modelsSkills', icon: Sparkles },
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
const EDU_ITEMS: NavItem[] = [
  // 学习模块
  { href: '/edu/dashboard', labelKey: 'eduDashboard', icon: LayoutDashboard },
  { href: '/edu/courses', labelKey: 'eduCourses', icon: BookOpen },
  { href: '/edu/exam', labelKey: 'eduExam', icon: FileCheck },
  { href: '/edu/certificates', labelKey: 'eduCertificates', icon: Award },
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

/** /developer 开发者工具子菜单(2026-08-30 瘦身):低频开发者工具收进可折叠子菜单 */
const DEVELOPER_TOOLS_CHILDREN: NavItem[] = [
  // P0 Playground 内置在线测试页(2026-07-31 立):用当前用户 API Key 走 /v1/chat/completions 在线测试
  { href: '/playground', labelKey: 'playground', icon: FlaskConical },
  { href: '/developer/webhooks', labelKey: 'developerWebhooks', icon: Webhook },
  { href: '/developer/sandbox', labelKey: 'developerSandbox', icon: FlaskConical },
  { href: '/developer/limits', labelKey: 'developerLimits', icon: Gauge },
  { href: '/developer/logs', labelKey: 'developerLogs', icon: FileText },
  { href: '/developer/versions', labelKey: 'developerVersions', icon: GitBranch },
  { href: '/developer/subscription', labelKey: 'developerSubscription', icon: CreditCard },
  { href: '/developer/notifications', labelKey: 'developerNotifications', icon: Bell },
  { href: '/developer/team', labelKey: 'developerTeam', icon: Users },
  { href: '/developer/billing', labelKey: 'developerBilling', icon: Receipt },
  { href: '/developer/settings', labelKey: 'developerSettings', icon: Settings },
]

/** /developer 项整合到"开发者"组下(2026-08-30 瘦身:19+ 项平铺对普通用户不可理解,
 * 只保留 5 个核心项平铺,中转站密钥/用量挂为子项,其余低频工具收进"开发者工具"折叠子菜单) */
const DEVELOPER_ITEMS: NavItem[] = [
  { href: '/developer', labelKey: 'developer', icon: Terminal },
  { href: '/developer/api-docs', labelKey: 'developerApiDocs', icon: Code },
  { href: '/developer/keys', labelKey: 'developerKeys', icon: Key },
  // P0-5 模型 API 中转站(2026-07-29 立);2026-08-30 密钥/用量挂为中转站子项
  {
    href: '/developer/relay',
    labelKey: 'developerRelay',
    icon: Zap,
    children: [
      { href: '/developer/relay/keys', labelKey: 'developerRelayKeys', icon: KeyRound },
      { href: '/developer/relay/usage', labelKey: 'developerRelayUsage', icon: Activity },
    ],
  },
  // P0 API 订阅包产品化(2026-07-31 立):3 档 API 订阅方案(Starter/Pro/Enterprise)
  {
    href: '/developer/relay/subscriptions',
    labelKey: 'developerRelaySubscriptions',
    icon: CreditCard,
  },
  // 2026-08-30 瘦身:低频开发者工具收进"开发者工具"可展开子菜单(入口保留,高级用户可展开使用)
  {
    href: '/developer/webhooks',
    labelKey: 'developerTools',
    icon: Terminal,
    children: DEVELOPER_TOOLS_CHILDREN,
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
]

/**
 * 高级 AI 工具(2026-08-30 新增):原 AI 分组平铺的 9 个 TRAE Work 概念入口
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
]

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: '',
    items: [{ href: '/', labelKey: 'home', icon: Home }],
  },
  // 热门分组(2026-08-01 新增):高频常用功能快捷入口,放在首页下方
  {
    label: 'hotGroupLabel',
    items: [
      { href: '/publish/history', labelKey: 'publishPlatform', icon: Send },
      { href: '/ai-world', labelKey: 'aiWorld', icon: Globe },
      { href: '/models', labelKey: 'models', icon: Bot },
      { href: '/settings/import', labelKey: 'hotModelImport', icon: Download },
    ],
  },
  {
    label: 'aiGroupLabel',
    items: [
      // /chat 路由已废弃:AI 任务是全局 docked 面板(挂载于 MainShell,与 Sidebar 同级),
      // 顶部"+"按钮(下方)即 toggle 面板的入口,不再放可点击的 /chat 导航项,
      // 避免点击后右侧工作区被占位空状态"开始新任务"替换。
      { href: '/chat/history', labelKey: 'chatHistory', icon: MessageSquare },
      // /models 整合原 ModelsSidebar 15 项(主功能/业务/财务/资源四组扁平化为三级子菜单)
      { href: '/models', labelKey: 'models', icon: Bot, children: MODELS_CHILDREN },
      { href: '/agents', labelKey: 'agents', icon: Bot },
      { href: '/agent-workbench', labelKey: 'agentWorkbench', icon: Activity },
      {
        href: '/ai-world',
        labelKey: 'aiWorld',
        icon: Globe,
        children: [{ href: '/ai-world/favorites', labelKey: 'favorites', icon: Star }],
      },
      // 2026-07-24 对标 TRAE Work AI 工作台能力(2026-08-30 收进"高级 AI 工具"折叠子菜单,见 ADVANCED_AI_TOOLS_CHILDREN)
      {
        href: '/memory',
        labelKey: 'advancedAiTools',
        icon: Brain,
        children: ADVANCED_AI_TOOLS_CHILDREN,
      },
      { href: '/workspace', labelKey: 'workspace', icon: FolderOpen },
      // 知识库三合一(2026-08-30):原平铺的知识库/RAG/图谱收进可展开子菜单
      {
        href: '/knowledge-base',
        labelKey: 'knowledgeBase',
        icon: BookOpen,
        children: KNOWLEDGE_CHILDREN,
      },
      // 2026-08-07 feature-final:A2A 智能体互联(注册智能体/派发任务)→ 已收进"高级 AI 工具"
      // 2026-08-07 feature-final:Personas 人设中心(查看人设契约)→ 已收进"高级 AI 工具"
      // 2026-08-07 feature-final:编排中心(中枢状态/仪表盘/事件流)→ 已收进"高级 AI 工具"
      // 自动化任务调度器已于 2026-07-22 移至侧边栏快捷区(插件市场按钮下方),不再占用 AI 分组位置。
    ],
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
    label: 'eduGroup',
    items: [
      { href: '/dashboard', labelKey: 'overview', icon: LayoutDashboard },
      { href: '/learn', labelKey: 'learn', icon: GraduationCap },
      { href: '/live', labelKey: 'live', icon: PlayCircle },
      { href: '/exam', labelKey: 'exam', icon: ScrollText },
      { href: '/lecturers', labelKey: 'lecturers', icon: Users },
      { href: '/schedule', labelKey: 'schedule', icon: Calendar },
      { href: '/topics', labelKey: 'topics', icon: FileText },
      { href: '/asks', labelKey: 'asks', icon: MessageSquare },
      { href: '/circles', labelKey: 'circles', icon: Users },
      { href: '/resources', labelKey: 'resources', icon: Package },
      { href: '/news', labelKey: 'news', icon: Newspaper },
      { href: '/announcements', labelKey: 'announcements', icon: Megaphone },
      // /edu 8 项整合(原 /edu/layout.tsx 页面级菜单栏)
      ...EDU_ITEMS,
    ],
  },
  {
    label: 'contentGroup',
    items: [
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
      // 2026-08-07 feature-connect:私信(用户间 1对1 私密聊天)
      { href: '/letters', labelKey: 'eduAiLetters', icon: Mail },
      // 2026-08-07 feature-connect:群组(用户自建群组与成员管理)
      { href: '/groups', labelKey: 'eduAiGroups', icon: UsersRound },
      // 多平台一键发布平台(2026-07-20 新增,支持 md/docx/html/pdf/图片/视频 → 14 平台)
      { href: '/publish/history', labelKey: 'publishPlatform', icon: Send },
      // 技术博客(2026-07-27 新增,docs/blog 10 篇技术文章对外曝光用)
      { href: '/blog', labelKey: 'blog', icon: BookOpen },
    ],
  },
  {
    label: 'tradeGroup',
    items: [
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
      { href: '/activities', labelKey: 'activities', icon: Gift },
      { href: '/points', labelKey: 'points', icon: Star },
      { href: '/edu-points', labelKey: 'eduPoints', icon: Award },
      { href: '/oauth/my-authorized', labelKey: 'oauthMyAuthorized', icon: KeyRound },
      // /member 15 项整合(原 /member/layout.tsx 页面级菜单栏)
      ...MEMBER_ITEMS,
    ],
  },
  {
    label: 'personalGroup',
    items: [
      {
        href: '/favorites',
        labelKey: 'myLearning',
        icon: BookOpen,
        children: [
          { href: '/favorites', labelKey: 'favorites', icon: Star },
          { href: '/following', labelKey: 'following', icon: Users },
          { href: '/subscriptions', labelKey: 'subscriptions', icon: Rss },
          // 2026-08-30 同义入口合并:收藏入口重叠(个人收藏 vs 会员收藏),统一收进本父项
          { href: '/member/favorites', labelKey: 'memberFavorites', icon: Heart },
        ],
      },
      // /user 16 项作为可展开子菜单(原 UserNav.tsx 页面级菜单栏)
      {
        href: '/user/profile',
        labelKey: 'user',
        icon: User,
        children: USER_CHILDREN,
      },
      { href: '/student', labelKey: 'student', icon: GraduationCap },
      { href: '/settings', labelKey: 'settings', icon: Settings },
      // 2026-08-07 feature-connect2:数据权利(GDPR 导出/可携带/擦除)
      { href: '/settings/data-rights', labelKey: 'eduAiDataRights', icon: Download },
      { href: '/feedback', labelKey: 'feedback', icon: MessageSquare },
      { href: '/help', labelKey: 'help', icon: HelpCircle },
    ],
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

export const ALL_NAV_HREFS = flattenNavItems(NAV_GROUPS.flatMap((g) => g.items)).map((i) => i.href)

/** 扁平化主侧边栏导航项,供 TagsView 等复用 path -> labelKey 映射 */
export const FLAT_NAV_ITEMS = flattenNavItems(NAV_GROUPS.flatMap((g) => g.items))

/**
 * 纯函数判断给定 href 是否与当前 pathname 匹配为活跃路由。
 * 与 useCallback 相比:1) 不创建新函数引用,不破坏 React.memo;2) 纯函数,相同输入永远相同输出。
 * 逻辑:pathname 以 href 开头,且没有其他 nav item 的 href 更精确地匹配当前 pathname。
 */
export function isHrefActive(href: string, pathname: string): boolean {
  if (!pathname.startsWith(href)) return false
  return !ALL_NAV_HREFS.some((h) => h !== href && h.startsWith(href) && pathname.startsWith(h))
}

/** 侧边栏语言切换菜单数据(8 端语言)。SidebarActions 使用。 */
export const LANGUAGES: { code: Language; name: string; badge: string }[] = [
  { code: 'zh-CN', name: '简体中文', badge: 'ZH' },
  { code: 'zh-TW', name: '繁體中文', badge: 'TW' },
  { code: 'en', name: 'English', badge: 'EN' },
  { code: 'ja', name: '日本語', badge: 'JA' },
  { code: 'ko', name: '한국어', badge: 'KO' },
]
