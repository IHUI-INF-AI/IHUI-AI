// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  Activity,
  BarChart3,
  Bell,
  BellRing,
  BookMarked,
  BookOpen,
  Bot,
  Brain,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  ChartLine,
  ClipboardList,
  Clock,
  Coins,
  Compass,
  Cpu,
  CreditCard,
  Crown,
  FileText,
  Files,
  FolderOpen,
  Gift,
  Globe,
  GraduationCap,
  Handshake,
  HelpCircle,
  Home,
  IdCard,
  Image,
  Info,
  KeyRound,
  Layers,
  Lightbulb,
  ListChecks,
  Lock,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Monitor,
  Network,
  NotebookPen,
  Orbit,
  Palette,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Puzzle,
  Receipt,
  Repeat,
  Rocket,
  ScanLine,
  ScrollText,
  Search,
  Send,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  SquarePen,
  Star,
  Store,
  Tag,
  TrendingUp,
  Trophy,
  User,
  UserCog,
  UserPlus,
  UserRoundX,
  Users,
  UsersRound,
  Video,
  Wallet,
  Workflow,
  Wrench,
  Zap,
} from 'lucide-react-native'
import type { HubGlyph, DomainKey } from './domain-hub'
import type { MainTabKey } from './tab-utils'
// type-only import:编译期擦除,不引入运行时 require cycle(同 tab-utils.ts 既有先例)
import type { DrawerTab } from '../components/Drawer'

/**
 * 抽屉导航单源(2026-10-20 立,RN 侧边栏对齐 web 侧边栏)
 *
 * 立因:RN 抽屉的分组/条目此前写在 `components/Drawer.tsx` 内部,与 web 端
 * `apps/web/src/components/sidebar/nav-data.ts` 的 NAV_GROUPS 各写一份 —— 两份清单
 * 必然漂移(§0.6 单一真相源),实际结果就是用户看到的"两端侧边栏差距太大":
 * web 有而 RN 没有(对话历史 / 工作区 / 内容域 / 我的学习 / 用户中心二级子菜单 /
 * 快捷区自动化任务),RN 有而 web 没有(推广组 / 社区域)。
 *
 * 对齐口径(本次只动 RN 端,web 一行未改):
 *  - 分组**顺序**照抄 web:首页行 → 热门 → AI → 教育域 → 内容域 → 交易域 → 个人 → 开发者;
 *  - 分组**命名/图标**与 web nav-data 同义(热门 hot 变体、AI、教育/内容/交易域、个人);
 *  - web 用 href + children 表达的层级,本端用 route target + children 表达 ——
 *    故本文件引入 `children`,让「知识库 / 我的学习 / 用户中心」像 web 一样可展开;
 *  - web 有而 RN **无原生路由**的项(插件市场 /plugins、媒体任务 /media-tasks、
 *    生态 /ecosystem、学生 /student)一律不渲染 —— 不放假入口(既有纪律,见下方注释);
 *  - RN 独有的分组(社区域、推广组)与新增项(高级工具 / 开发者 / 工作区 / 对话历史)
 *    按用户授权"可以增加移动端独立选项"保留,统一排在 web 骨架之后,不打断 web 顺序。
 *
 * 条目一律是 RootStackParamList 里真实存在且**可无参 navigate** 的路由
 * (必参路由如 `Developer: { id: string }` 不进本清单,否则点击即崩)。
 */
type DrawerNavRouteName =
  // 热门组(发布 / AI 世界 / 模型广场)为 RN 独立高频入口,同列一处
  | 'Publish'
  | 'AiWorld'
  | 'ModelPlaza'
  | 'ApiKeys'
  | 'ModelRecord'
  | 'MessageCenter'
  | 'History'
  | 'Workspace'
  | 'Automations'
  | 'Agent'
  | 'AgentMarket'
  | 'AgentCreate'
  | 'AgentCategories'
  | 'AgentReviewList'
  | 'Assistant'
  | 'AigcList'
  | 'KnowledgeBase'
  | 'KnowledgeRag'
  | 'ChatTools'
  | 'Memory'
  | 'Subagents'
  | 'Context'
  | 'Spec'
  | 'SelfMedia'
  | 'PdfTools'
  | 'AiSkill'
  | 'WebPortal'
  | 'ApiSettings'
  | 'DevEnter'
  | 'ModelIncome'
  | 'AiCareer'
  | 'Favorites'
  | 'Follow'
  | 'Subscriptions'
  | 'ProfileEdit'
  | 'SecuritySettings'
  | 'RealNameAuth'
  | 'NotificationList'
  | 'NotificationSettings'
  | 'AccountCancel'
  | 'Feedback'
  | 'Help'
  | 'About'
  | 'Settings'
  | 'Promote'
  | 'Distribution'
  | 'Team'
  | 'RepoWiki'
  | 'Purchase'
  | 'VipBenefit'
  | 'Addresses'
  | 'UserFans'
  | 'ExamHistory'
  | 'Usage'
  | 'StudyPlan'
  | 'McpStore'
  | 'DeepResearch'
  | 'AgentRuntime'
  // ── 第五批(2026-10-21)web 侧边栏全量对账补齐 ─────────────────────────
  // 口径修正:前几批只对了 web 的 normal 档(70 条)且域内只取 31/89,
  // 漏掉 relayOps/experimental/advancedAi/developer 四档(31 条),也漏掉域
  // 入口页收编的 89 条清单。本批按「web 侧 173 条非 admin 条目」全量双向对账:
  // RN 注册 251 路由、抽屉仅挂 83 ⇒ 168 屏未挂,逐条判读后本批落 68 条。
  // A 组(web 缺口):web 侧边栏有、RN 有原生路由,此前漏挂。
  | 'WrongQuestions'
  | 'LearnReview'
  | 'TeacherList'
  | 'StudyProgress'
  | 'CertApply'
  | 'LearnMap'
  | 'ConnectedAccounts'
  | 'Income'
  | 'VipTrader'
  | 'PointRule'
  | 'OrderRefund'
  | 'UserArticles'
  | 'AgentStat'
  | 'ImageGenTemplates'
  | 'Referrer'
  | 'TeamMemory'
  | 'TeamKnowledge'
  | 'KnowledgeRagManage'
  | 'CheckIn'
  | 'Connectors'
  | 'ModelEdit'
  | 'ChatTemplates'
  | 'MessageSystem'
  | 'MessageDirect'
  | 'MessageGroup'
  // B 组(RN 独有):web 侧边栏没有、但 RN 有原生路由的功能页,
  // 按用户授权「可以增加移动端独立的侧边栏选项」收进 5 个独立组。
  | 'MyPapers'
  | 'ArticleHot'
  | 'PublishAccounts'
  | 'PublishAnalytics'
  | 'PublishCalendar'
  | 'ImageGenGallery'
  | 'Ranking'
  | 'PointsRecord'
  | 'PointHistory'
  | 'Withdraw'
  | 'BankCard'
  | 'VipCompare'
  | 'EarnCommission'
  | 'DistributionCompany'
  | 'AgentSetting'
  | 'N8nModel'
  | 'TokenValue'
  | 'BusinessLicense'
  | 'CustomerService'
  | 'FeedbackHistory'
  | 'SettingsAccount'
  | 'ChangePwd'
  | 'DataRights'
  | 'SecurityCenter'
  | 'QrCode'
  | 'Privacy'
  | 'Agreement'
  | 'Recruitment'
  | 'IcpRecord'
  | 'UsageRules'
  | 'AppPermission'
  | 'CourseResource'
  | 'LivePlaybackList'
  | 'AiGroup'
  | 'ConversationImport'
  | 'LearnDevelop'
  | 'MoreCourse'
  | 'StudyIndex'
  | 'Search'
  | 'SelfHealing'
  | 'Patrol'
  | 'Cart'
  | 'RefundHistory'
  | 'AIMultimodal'
  // ── 第六批(2026-10-21)web 侧边栏对账补挂 + RN 独立入口 ─────────────────────
  // 口径:均有原生路由,且 ui-routes.generated.ts 标 requiresParams=false(无必参),
  // 逐个现读 RootNavigator 注册对后落表。同批清两处存量:LivePlayback 死声明
  // (由 profileMenuData 自承载,与本联合无关)与 AiCareer 重复成员(B 组与热门组各一份)。
  | 'Note'
  | 'CourseEnroll'
  | 'ImageGenHistory'
  | 'CourseAnnex'
  | 'CoursePlanet'
  | 'KnowledgePlanet'
  | 'BusinessCard'
  // Vip 由底部用户行菜单直跳(与抽屉导航项同一出口,故同列一处,避免两处各写一份联合)
  | 'Vip'
  // 扫一扫:左下角快捷入口(2026-10-27 立)。ScanLogin 路由无必参,已在 RootNavigator 注册。
  | 'ScanLogin'

/** 点击目标:drawerTab 走父级 onNavigate 契约;route 直跳根栈;main 跳 Main Tab 容器 */
export type DrawerNavTarget =
  | { type: 'drawerTab'; tab: DrawerTab }
  | { type: 'route'; name: DrawerNavRouteName }
  | { type: 'main'; screen: MainTabKey }

export interface DrawerNavItem {
  labelKey: string
  Icon: HubGlyph
  /** active 匹配用路由名(根栈路由名,或 Main Tab 容器时的 params.screen 值) */
  route?: string
  target: DrawerNavTarget
  /** 二级子菜单(对齐 web NavItem.children;子项同样参与 active 匹配) */
  children?: readonly DrawerNavItem[]
}

interface DrawerNavGroup {
  /** 稳定 key(替代"拿 titleKey 当 key":i18n 键会随文案改名漂移) */
  key: string
  titleKey: string
  /** hot 组:标题强化 + Flame 图标(对齐 web hotGroupLabel 视觉档) */
  variant?: 'hot'
  defaultOpen: boolean
  items: readonly DrawerNavItem[]
}

/** 首页行(web 侧边栏首个 Home 行,无分组标题) */
export const DRAWER_HOME_ITEM: DrawerNavItem = {
  labelKey: 'nav.home',
  Icon: Home,
  route: 'HomeMain',
  target: { type: 'drawerTab', tab: 'home' },
}

export const DRAWER_NAV_GROUPS: readonly DrawerNavGroup[] = [
  // 1. 热门(对齐 web hotGroupLabel)
  //    web 该项是 /ecosystem(生态聚合页),RN 无对应原生路由 ⇒ 不放假入口;
  //    本组保留 RN 高频三项(多平台发布 / AI 世界 / 模型广场),属移动端独立选项。
  {
    key: 'hot',
    titleKey: 'drawer.groupHot',
    variant: 'hot',
    defaultOpen: true,
    items: [
      {
        labelKey: 'menu.publish',
        Icon: Send,
        route: 'Publish',
        target: { type: 'route', name: 'Publish' },
      },
      {
        labelKey: 'menu.aiWorld',
        Icon: Globe,
        route: 'AiWorld',
        target: { type: 'route', name: 'AiWorld' },
      },
    ],
  },
  // 2. AI(对齐 web aiGroupLabel)
  //    2026-10-21 补:web 本组可见项 /models(/models/* 三级子菜单)与 /agents 此前本端漏挂,
  //    模型广场只作为热门组单项存在 ⇒ 现把「模型」父子项与「智能体」父子项补进本组,
  //    热门组不再登记 ModelPlaza(否则同 route 双条目,同 domain-hub.ts 既有纪律)。
  //    web 该组可见项:对话历史 / 模型 / agents / AI 世界 / 高级AI工具 / 媒体任务 / 知识库 / 工作区。
  //    RN 取有原生路由的那几项;记忆/子智能体等 web 归 advancedAi 档的项下移「高级工具」组。
  {
    key: 'ai',
    titleKey: 'drawer.groupAi',
    defaultOpen: true,
    items: [
      {
        // 对齐 web /chat/history(对话历史); RN 侧 History 路由即历史会话列表。
        // 不复用 history.title —— 那是"浏览历史"(内容浏览记录),语义不是对话历史。
        labelKey: 'drawer.chatHistory',
        Icon: MessageSquare,
        route: 'History',
        target: { type: 'route', name: 'History' },
      },
      // 模型(对齐 web /models + MODELS_CHILDREN):父项点进模型广场,子项取 web
      // /models/keys、/models/logs、/models/billing 三类中 RN 有原生路由可无参导航的三项。
      {
        labelKey: 'modelPlaza.title',
        Icon: Bot,
        route: 'ModelPlaza',
        target: { type: 'route', name: 'ModelPlaza' },
        children: [
          {
            labelKey: 'apiKeys.title',
            Icon: KeyRound,
            route: 'ApiKeys',
            target: { type: 'route', name: 'ApiKeys' },
          },
          {
            labelKey: 'menu.modelRecord',
            Icon: ClipboardList,
            route: 'ModelRecord',
            target: { type: 'route', name: 'ModelRecord' },
          },
          {
            labelKey: 'drawer.modelIncome',
            Icon: Wallet,
            route: 'ModelIncome',
            target: { type: 'route', name: 'ModelIncome' },
          },
          // 对齐 web MODELS_CHILDREN 的 /models/usage(normal 档,所有用户可见)
          {
            labelKey: 'usage.title',
            Icon: BarChart3,
            route: 'Usage',
            target: { type: 'route', name: 'Usage' },
          },
          // 2026-10-21 第五批:web MODELS_CHILDREN 另 4 项(web 归 relayOps 档,
          // web 简洁模式下整档隐藏,本端统一收在「模型」子项下,入口不丢)。
          // /models/trajectory(调用轨迹)→ RN 智能体统计屏
          {
            labelKey: 'agentStat.title',
            Icon: ChartLine,
            route: 'AgentStat',
            target: { type: 'route', name: 'AgentStat' },
          },
          // /models/prompts(提示词库)→ RN 提示词模板屏
          {
            labelKey: 'imageGenTemplates.title',
            Icon: SquarePen,
            route: 'ImageGenTemplates',
            target: { type: 'route', name: 'ImageGenTemplates' },
          },
          // /models/referral(推荐返利)→ RN 推荐人屏
          {
            labelKey: 'referrer.title',
            Icon: Gift,
            route: 'Referrer',
            target: { type: 'route', name: 'Referrer' },
          }
        ],
      },
      // 智能体(对齐 web /agents):父项进我的智能体列表,子项保留原「智能体市场」入口
      // 并补 web 同族的创建/分类/评价三项(RN 均有原生路由且无必参)。
      {
        labelKey: 'nav.agents',
        Icon: Cpu,
        route: 'Agent',
        target: { type: 'route', name: 'Agent' },
        children: [
          {
            labelKey: 'menu.agentMarket',
            Icon: Store,
            route: 'AgentMarket',
            target: { type: 'route', name: 'AgentMarket' },
          },
          {
            labelKey: 'menu.agentCreate',
            Icon: Plus,
            route: 'AgentCreate',
            target: { type: 'route', name: 'AgentCreate' },
          },
          {
            labelKey: 'agentCategories.title',
            Icon: Layers,
            route: 'AgentCategories',
            target: { type: 'route', name: 'AgentCategories' },
          },
          {
            labelKey: 'menu.agentReviewList',
            Icon: Star,
            route: 'AgentReviewList',
            target: { type: 'route', name: 'AgentReviewList' },
          },
        ],
      },
      {
        labelKey: 'chat.navAgent',
        Icon: Puzzle,
        route: 'Assistant',
        target: { type: 'route', name: 'Assistant' },
      },
      {
        labelKey: 'menu.imageGen',
        Icon: Palette,
        route: 'AigcList',
        target: { type: 'route', name: 'AigcList' },
      },
      // 知识库二级(对齐 web /knowledge-base 的 children:知识库 / RAG)
      {
        labelKey: 'menu.knowledgeBase',
        Icon: BookOpen,
        route: 'KnowledgeBase',
        target: { type: 'route', name: 'KnowledgeBase' },
        children: [
          {
            labelKey: 'menu.knowledgeBase',
            Icon: BookOpen,
            route: 'KnowledgeBase',
            target: { type: 'route', name: 'KnowledgeBase' },
          },
          {
            labelKey: 'menu.knowledgeRag',
            Icon: Brain,
            route: 'KnowledgeRag',
            target: { type: 'route', name: 'KnowledgeRag' },
          },
          // 对齐 web KNOWLEDGE_CHILDREN 的 /repo-wiki(2026-10-21 补)
          {
            labelKey: 'repoWiki.title',
            Icon: Files,
            route: 'RepoWiki',
            target: { type: 'route', name: 'RepoWiki' },
          },
          // 2026-10-21 第五批:web KNOWLEDGE_CHILDREN 另两项
          // /team-knowledge(团队知识引擎,web 归 experimental 档)
          {
            labelKey: 'teamKnowledge.title',
            Icon: Users,
            route: 'TeamKnowledge',
            target: { type: 'route', name: 'TeamKnowledge' },
          },
          // /knowledge-cards(知识卡片)→ RN 知识文档管理屏
          {
            labelKey: 'knowledgeRagManage.title',
            Icon: BookMarked,
            route: 'KnowledgeRagManage',
            target: { type: 'route', name: 'KnowledgeRagManage' },
          },
        ],
      },
      // 工作区(对齐 web /workspace)
      {
        labelKey: 'workspace.title',
        Icon: FolderOpen,
        route: 'Workspace',
        target: { type: 'route', name: 'Workspace' },
      },
      {
        labelKey: 'menu.chatTools',
        Icon: MessagesSquare,
        route: 'ChatTools',
        target: { type: 'route', name: 'ChatTools' },
      },
      // 2026-10-21 第五批:web aiGroup 的 /checkin(签到助手,web 归 experimental 档)
      // 与 /agent-workbench(Agent 运行时调试台,web 归 experimental 档)
      {
        labelKey: 'checkIn.title',
        Icon: CalendarCheck,
        route: 'CheckIn',
        target: { type: 'route', name: 'CheckIn' },
      },
    ],
  },
  // 3~5. 三域入口(教育 / 交易 / 社区)由 DOMAIN_HUBS 单源承载,见 DRAWER_NAV_SECTIONS
  // 6. 个人(对齐 web personalGroup:我的学习 / 用户 / 反馈 / 帮助)
  {
    key: 'personal',
    titleKey: 'drawer.groupPersonal',
    defaultOpen: true,
    items: [
      // 我的学习二级(对齐 web /favorites 父项:收藏 / 关注 / 订阅)
      {
        labelKey: 'drawer.myLearning',
        Icon: BookOpen,
        route: 'Favorites',
        target: { type: 'route', name: 'Favorites' },
        children: [
          {
            labelKey: 'menu.favorites',
            Icon: Star,
            route: 'Favorites',
            target: { type: 'route', name: 'Favorites' },
          },
          {
            labelKey: 'menu.follow',
            Icon: UserPlus,
            route: 'Follow',
            target: { type: 'route', name: 'Follow' },
          },
          {
            labelKey: 'menu.subscriptions',
            Icon: Repeat,
            route: 'Subscriptions',
            target: { type: 'route', name: 'Subscriptions' },
          },
        ],
      },
      // 用户中心二级(对齐 web /user/profile 父项:资料 / 安全 / 实名 / 通知 / 注销)
      // web 侧那 14 项里 RN 只有这 5 项有原生路由,其余不放假入口。
      {
        labelKey: 'drawer.userCenter',
        Icon: User,
        route: 'ProfileMain',
        target: { type: 'main', screen: 'ProfileMain' },
        children: [
          {
            labelKey: 'menu.profileEdit',
            Icon: Pencil,
            route: 'ProfileEdit',
            target: { type: 'route', name: 'ProfileEdit' },
          },
          {
            labelKey: 'drawer.securitySettings',
            Icon: Shield,
            route: 'SecuritySettings',
            target: { type: 'route', name: 'SecuritySettings' },
          },
          {
            labelKey: 'menu.realNameAuth',
            Icon: IdCard,
            route: 'RealNameAuth',
            target: { type: 'route', name: 'RealNameAuth' },
          },
          // 对齐 web USER_CHILDREN 的 /notifications(2026-10-21 补):与「通知设置」是两回事
          {
            labelKey: 'menu.notificationList',
            Icon: Bell,
            route: 'NotificationList',
            target: { type: 'route', name: 'NotificationList' },
          },
          {
            labelKey: 'menu.notificationSettings',
            Icon: BellRing,
            route: 'NotificationSettings',
            target: { type: 'route', name: 'NotificationSettings' },
          },
          {
            labelKey: 'menu.accountCancel',
            Icon: UserRoundX,
            route: 'AccountCancel',
            target: { type: 'route', name: 'AccountCancel' },
          },
          // 2026-10-21 对齐 web USER_CHILDREN 的 /user/fans 与 /user/exam
          // (/user/comment、/user/ask、/user/resource 三项 RN 无原生路由,按纪律不放假入口)
          {
            labelKey: 'userFans.title',
            Icon: Users,
            route: 'UserFans',
            target: { type: 'route', name: 'UserFans' },
          },
          {
            labelKey: 'examHistory.title',
            Icon: ClipboardList,
            route: 'ExamHistory',
            target: { type: 'route', name: 'ExamHistory' },
          },
          // 2026-10-21 第五批:web USER_CHILDREN 的 /user/comment(我的文章)
          {
            labelKey: 'userArticles.title',
            Icon: FileText,
            route: 'UserArticles',
            target: { type: 'route', name: 'UserArticles' },
          },
        ],
      },
      {
        labelKey: 'menu.messageCenter',
        Icon: MessageSquare,
        route: 'MessageCenter',
        target: { type: 'route', name: 'MessageCenter' },
      },
      {
        labelKey: 'menu.settings',
        Icon: Settings,
        route: 'Settings',
        target: { type: 'route', name: 'Settings' },
      },
      {
        labelKey: 'menu.feedback',
        Icon: MessageSquare,
        route: 'Feedback',
        target: { type: 'route', name: 'Feedback' },
      },
      {
        labelKey: 'help.title',
        Icon: HelpCircle,
        route: 'Help',
        target: { type: 'route', name: 'Help' },
      },
      {
        labelKey: 'menu.about',
        Icon: Info,
        route: 'About',
        target: { type: 'route', name: 'About' },
      },
      {
        labelKey: 'note.title',
        Icon: NotebookPen,
        route: 'Note',
        target: { type: 'route', name: 'Note' },
      },
    ],
  },
  // 7. 推广(移动端独立组:web 把分销/团队收在内容域、外呼收在交易域,
  //    RN 该三项为独立高频入口,按"允许增加移动端独立选项"整组保留)
  {
    key: 'promote',
    titleKey: 'drawer.groupPromote',
    defaultOpen: false,
    items: [
      {
        labelKey: 'menu.promote',
        Icon: Megaphone,
        route: 'Promote',
        target: { type: 'route', name: 'Promote' },
      },
      {
        labelKey: 'menu.distribution',
        Icon: Handshake,
        route: 'Distribution',
        target: { type: 'route', name: 'Distribution' },
      },
      {
        labelKey: 'menu.team',
        Icon: Users,
        route: 'Team',
        target: { type: 'route', name: 'Team' },
      },
    ],
  },
  // 8. 高级工具(移动端独立组,对应 web 的 advancedAi/experimental 两档:
  //    web 在简洁模式下把它们整组隐藏,本端改为「默认收起的折叠组」—— 入口不丢、不占视觉)
  {
    key: 'advanced',
    titleKey: 'drawer.groupAdvanced',
    defaultOpen: false,
    items: [
      {
        labelKey: 'menu.memory',
        Icon: Brain,
        route: 'Memory',
        target: { type: 'route', name: 'Memory' },
      },
      {
        labelKey: 'menu.subagents',
        Icon: Layers,
        route: 'Subagents',
        target: { type: 'route', name: 'Subagents' },
      },
      {
        labelKey: 'menu.context',
        Icon: Network,
        route: 'Context',
        target: { type: 'route', name: 'Context' },
      },
      {
        labelKey: 'menu.spec',
        Icon: ScrollText,
        route: 'Spec',
        target: { type: 'route', name: 'Spec' },
      },
      // 自媒体(2026-10-21 归位):web 把 /self-media/* 收在 CONTENT_HUB_ITEMS(内容域),
      // 内容域已登记同一 route,本组不再重复(回归锁「全局不重复」实测抓出)。
      {
        labelKey: 'menu.pdfTools',
        Icon: Files,
        route: 'PdfTools',
        target: { type: 'route', name: 'PdfTools' },
      },
      {
        labelKey: 'menu.aiSkill',
        Icon: Wrench,
        route: 'AiSkill',
        target: { type: 'route', name: 'AiSkill' },
      },
      {
        labelKey: 'menu.webPortalCenter',
        Icon: Compass,
        route: 'WebPortal',
        target: { type: 'route', name: 'WebPortal' },
      },
      // 2026-10-21 对齐 web ADVANCED_AI_TOOLS_CHILDREN 剩余四项
      // (/plan /registry /deep-research /computer-use;RN 四路由均可无参导航)
      {
        labelKey: 'studyPlan.title',
        Icon: CalendarDays,
        route: 'StudyPlan',
        target: { type: 'route', name: 'StudyPlan' },
      },
      {
        labelKey: 'mcpStore.title',
        Icon: Store,
        route: 'McpStore',
        target: { type: 'route', name: 'McpStore' },
      },
      {
        labelKey: 'deepResearch.title',
        Icon: Rocket,
        route: 'DeepResearch',
        target: { type: 'route', name: 'DeepResearch' },
      },
      {
        labelKey: 'agentRuntime.title',
        Icon: Activity,
        route: 'AgentRuntime',
        target: { type: 'route', name: 'AgentRuntime' },
      },
      // 2026-10-21 第五批:web ADVANCED_AI_TOOLS_CHILDREN 的 /orchestration(编排中心)
      {
        labelKey: 'teamMemory.title',
        Icon: Workflow,
        route: 'TeamMemory',
        target: { type: 'route', name: 'TeamMemory' },
      },
    ],
  },
  // 9. 开发者(移动端独立组,对应 web developerGroup;web 简洁模式下整组隐藏,
  //    本端同理默认收起。Developer 路由必参 id 故不入列,改用无参的 DevEnter)
  {
    key: 'developer',
    titleKey: 'drawer.groupDeveloper',
    defaultOpen: false,
    items: [
      {
        labelKey: 'menu.apiSettings',
        Icon: KeyRound,
        route: 'ApiSettings',
        target: { type: 'route', name: 'ApiSettings' },
      },
      {
        labelKey: 'drawer.devEnter',
        Icon: Store,
        route: 'DevEnter',
        target: { type: 'route', name: 'DevEnter' },
      },
      // 2026-10-21 第五批:web DEVELOPER_ITEMS 的 /developer/webhooks(连接器)
      {
        labelKey: 'connectors.title',
        Icon: Puzzle,
        route: 'Connectors',
        target: { type: 'route', name: 'Connectors' },
      },
      // web /developer/versions(模型版本)→ RN 模型编辑屏
      {
        labelKey: 'modelEdit.headerTitle',
        Icon: Layers,
        route: 'ModelEdit',
        target: { type: 'route', name: 'ModelEdit' },
      },
      // 模型收益(2026-10-21 归位):已升入 AI 组「模型」子项(对齐 web /models/billing),
      // 此处不再登记,否则同一 route 在抽屉里出现两次。
    ],
  },
  // 10~14. 移动端独立组(2026-10-21 第五批立)
  //
  // 立因:web 侧边栏全量对账后,RN 侧仍有 40 余个「有原生路由但 web 侧边栏没有」的
  // 功能页(发布/提现/银行卡/隐私协议/客服/排名…)。用户明确授权「可以增加移动端
  // 独立的侧边栏选项」,故按语义分 5 组收进来,全部默认收起(不挤占首屏视觉),
  // 且仍排在 web 的九个分组之后 —— web 侧边栏顺序一动不动。
  // 10. 更多内容(创作 / 发布 / 内容管理类)
  {
    key: 'moreContent',
    titleKey: 'drawer.groupMoreContent',
    defaultOpen: false,
    items: [
      {
        labelKey: 'publishAccounts.title',
        Icon: UserCog,
        route: 'PublishAccounts',
        target: { type: 'route', name: 'PublishAccounts' },
      },
      {
        labelKey: 'publishAnalytics.title',
        Icon: ChartLine,
        route: 'PublishAnalytics',
        target: { type: 'route', name: 'PublishAnalytics' },
      },
      {
        labelKey: 'publishCalendar.title',
        Icon: CalendarDays,
        route: 'PublishCalendar',
        target: { type: 'route', name: 'PublishCalendar' },
      },
      {
        labelKey: 'articleHot.title',
        Icon: TrendingUp,
        route: 'ArticleHot',
        target: { type: 'route', name: 'ArticleHot' },
      },
      {
        labelKey: 'imageGenGallery.title',
        Icon: Image,
        route: 'ImageGenGallery',
        target: { type: 'route', name: 'ImageGenGallery' },
      },
      {
        labelKey: 'chatTemplates.title',
        Icon: MessagesSquare,
        route: 'ChatTemplates',
        target: { type: 'route', name: 'ChatTemplates' },
      },
      {
        labelKey: 'myPapers.title',
        Icon: ClipboardList,
        route: 'MyPapers',
        target: { type: 'route', name: 'MyPapers' },
      },
      {
        labelKey: 'courseResource.title',
        Icon: BookMarked,
        route: 'CourseResource',
        target: { type: 'route', name: 'CourseResource' },
      },
      {
        labelKey: 'livePlaybackList.title',
        Icon: Video,
        route: 'LivePlaybackList',
        target: { type: 'route', name: 'LivePlaybackList' },
      },
      {
        labelKey: 'courseScreen.title',
        Icon: GraduationCap,
        route: 'MoreCourse',
        target: { type: 'route', name: 'MoreCourse' },
      },
      {
        labelKey: 'search.title',
        Icon: Search,
        route: 'Search',
        target: { type: 'route', name: 'Search' },
      },
      // 2026-10-21 第六批:web 侧边栏/域入口页对账补挂(均有原生路由、无必参)
      {
        labelKey: 'courseEnroll.title',
        Icon: CalendarCheck,
        route: 'CourseEnroll',
        target: { type: 'route', name: 'CourseEnroll' },
      },
      {
        labelKey: 'studyIndex.title',
        Icon: Monitor,
        route: 'StudyIndex',
        target: { type: 'route', name: 'StudyIndex' },
      },
      {
        labelKey: 'imageGenHistory.title',
        Icon: Clock,
        route: 'ImageGenHistory',
        target: { type: 'route', name: 'ImageGenHistory' },
      },
      {
        labelKey: 'courseAnnex.title',
        Icon: Paperclip,
        route: 'CourseAnnex',
        target: { type: 'route', name: 'CourseAnnex' },
      },
      {
        labelKey: 'coursePlanet.title',
        Icon: Orbit,
        route: 'CoursePlanet',
        target: { type: 'route', name: 'CoursePlanet' },
      },
      {
        labelKey: 'knowledgePlanet.title',
        Icon: Globe,
        route: 'KnowledgePlanet',
        target: { type: 'route', name: 'KnowledgePlanet' },
      },
    ],
  },
  // 11. 账号与安全(个人资料 / 安全 / 授权类)
  {
    key: 'moreAccount',
    titleKey: 'drawer.groupMoreAccount',
    defaultOpen: false,
    items: [
      {
        labelKey: 'settingsAccount.title',
        Icon: UserCog,
        route: 'SettingsAccount',
        target: { type: 'route', name: 'SettingsAccount' },
      },
      {
        labelKey: 'securityCenter.title',
        Icon: Lock,
        route: 'SecurityCenter',
        target: { type: 'route', name: 'SecurityCenter' },
      },
      {
        labelKey: 'dataRights.title',
        Icon: Shield,
        route: 'DataRights',
        target: { type: 'route', name: 'DataRights' },
      },
      {
        labelKey: 'menu.changePwd',
        Icon: KeyRound,
        route: 'ChangePwd',
        target: { type: 'route', name: 'ChangePwd' },
      },
      {
        labelKey: 'qrCode.title',
        Icon: ScanLine,
        route: 'QrCode',
        target: { type: 'route', name: 'QrCode' },
      },
      {
        labelKey: 'menu.businessLicense',
        Icon: BriefcaseBusiness,
        route: 'BusinessLicense',
        target: { type: 'route', name: 'BusinessLicense' },
      },
      {
        labelKey: 'menu.appPermission',
        Icon: Monitor,
        route: 'AppPermission',
        target: { type: 'route', name: 'AppPermission' },
      },
      {
        labelKey: 'aiCareer.title',
        Icon: Lightbulb,
        route: 'AiCareer',
        target: { type: 'route', name: 'AiCareer' },
      },
      {
        labelKey: 'businessCard.title',
        Icon: IdCard,
        route: 'BusinessCard',
        target: { type: 'route', name: 'BusinessCard' },
      },
    ],
  },
  // 12. 交易与资金(收益 / 钱包 / 积分 / 提现类)
  {
    key: 'moreTrade',
    titleKey: 'drawer.groupMoreTrade',
    defaultOpen: false,
    items: [
      {
        labelKey: 'earnCommission.title',
        Icon: Handshake,
        route: 'EarnCommission',
        target: { type: 'route', name: 'EarnCommission' },
      },
      {
        labelKey: 'distributionCompany.title',
        Icon: UsersRound,
        route: 'DistributionCompany',
        target: { type: 'route', name: 'DistributionCompany' },
      },
      {
        labelKey: 'pointsRecord.title',
        Icon: Receipt,
        route: 'PointsRecord',
        target: { type: 'route', name: 'PointsRecord' },
      },
      {
        labelKey: 'pointHistory.title',
        Icon: Coins,
        route: 'PointHistory',
        target: { type: 'route', name: 'PointHistory' },
      },
      {
        labelKey: 'pointRule.title',
        Icon: FileText,
        route: 'PointRule',
        target: { type: 'route', name: 'PointRule' },
      },
      {
        labelKey: 'tokenValue.title',
        Icon: Zap,
        route: 'TokenValue',
        target: { type: 'route', name: 'TokenValue' },
      },
      {
        labelKey: 'withdraw.title',
        Icon: Wallet,
        route: 'Withdraw',
        target: { type: 'route', name: 'Withdraw' },
      },
      {
        labelKey: 'bankCard.title',
        Icon: CreditCard,
        route: 'BankCard',
        target: { type: 'route', name: 'BankCard' },
      },
      {
        labelKey: 'vipCompare.title',
        Icon: Crown,
        route: 'VipCompare',
        target: { type: 'route', name: 'VipCompare' },
      },
      {
        labelKey: 'refundHistory.title',
        Icon: ScrollText,
        route: 'RefundHistory',
        target: { type: 'route', name: 'RefundHistory' },
      },
      {
        labelKey: 'cart.title',
        Icon: ShoppingCart,
        route: 'Cart',
        target: { type: 'route', name: 'Cart' },
      },
    ],
  },
  // 13. 更多 AI 工具(智能体 / 模型 / 对话类)
  {
    key: 'moreAi',
    titleKey: 'drawer.groupMoreAi',
    defaultOpen: false,
    items: [
      {
        labelKey: 'agentSetting.title',
        Icon: Settings,
        route: 'AgentSetting',
        target: { type: 'route', name: 'AgentSetting' },
      },
      {
        labelKey: 'n8nModel.title',
        Icon: Workflow,
        route: 'N8nModel',
        target: { type: 'route', name: 'N8nModel' },
      },
      {
        labelKey: 'aiGroup.title',
        Icon: Users,
        route: 'AiGroup',
        target: { type: 'route', name: 'AiGroup' },
      },
      {
        labelKey: 'messageGroup.title',
        Icon: UsersRound,
        route: 'MessageGroup',
        target: { type: 'route', name: 'MessageGroup' },
      },
      {
        labelKey: 'ranking.title',
        Icon: Trophy,
        route: 'Ranking',
        target: { type: 'route', name: 'Ranking' },
      },
      {
        labelKey: 'learnDevelop.title',
        Icon: Rocket,
        route: 'LearnDevelop',
        target: { type: 'route', name: 'LearnDevelop' },
      },
      {
        labelKey: 'menu.conversationImport',
        Icon: SquarePen,
        route: 'ConversationImport',
        target: { type: 'route', name: 'ConversationImport' },
      },
      {
        labelKey: 'aiMultimodal.title',
        Icon: Sparkles,
        route: 'AIMultimodal',
        target: { type: 'route', name: 'AIMultimodal' },
      },
    ],
  },
  // 14. 服务与支持(协议 / 客服 / 运营类)
  {
    key: 'moreService',
    titleKey: 'drawer.groupMoreService',
    defaultOpen: false,
    items: [
      {
        labelKey: 'customerService.title',
        Icon: Phone,
        route: 'CustomerService',
        target: { type: 'route', name: 'CustomerService' },
      },
      {
        labelKey: 'feedbackHistory.title',
        Icon: MessageSquare,
        route: 'FeedbackHistory',
        target: { type: 'route', name: 'FeedbackHistory' },
      },
      {
        labelKey: 'recruitment.title',
        Icon: Users,
        route: 'Recruitment',
        target: { type: 'route', name: 'Recruitment' },
      },
      {
        labelKey: 'privacy.title',
        Icon: Shield,
        route: 'Privacy',
        target: { type: 'route', name: 'Privacy' },
      },
      {
        labelKey: 'agreement.title',
        Icon: ScrollText,
        route: 'Agreement',
        target: { type: 'route', name: 'Agreement' },
      },
      {
        labelKey: 'menu.usageRules',
        Icon: ListChecks,
        route: 'UsageRules',
        target: { type: 'route', name: 'UsageRules' },
      },
      {
        labelKey: 'menu.icpRecord',
        Icon: Tag,
        route: 'IcpRecord',
        target: { type: 'route', name: 'IcpRecord' },
      },
      {
        labelKey: 'selfHealing.title',
        Icon: Zap,
        route: 'SelfHealing',
        target: { type: 'route', name: 'SelfHealing' },
      },
      {
        labelKey: 'patrol.title',
        Icon: ScanLine,
        route: 'Patrol',
        target: { type: 'route', name: 'Patrol' },
      },
    ],
  },
]

/**
 * 抽屉竖排序列:首页行 → 热门 → AI → 三域入口(教育/内容/交易/社区) → 个人 →
 * 推广 → 高级工具 → 开发者。
 *
 * 与 web NAV_GROUPS 同序,域入口行位置对应 web 的 eduGroup / contentGroup / tradeGroup。
 */
type DrawerNavSection =
  | { kind: 'group'; key: string }
  | { kind: 'domain'; domain: DomainKey }

export const DRAWER_NAV_SECTIONS: readonly DrawerNavSection[] = [
  { kind: 'group', key: 'hot' },
  { kind: 'group', key: 'ai' },
  { kind: 'domain', domain: 'edu' },
  { kind: 'domain', domain: 'content' },
  { kind: 'domain', domain: 'trade' },
  { kind: 'domain', domain: 'community' },
  { kind: 'group', key: 'personal' },
  { kind: 'group', key: 'promote' },
  { kind: 'group', key: 'advanced' },
  { kind: 'group', key: 'developer' },
  // 2026-10-21 第五批:5 个移动端独立组排在 web 九组之后(web 顺序不动)
  { kind: 'group', key: 'moreContent' },
  { kind: 'group', key: 'moreAccount' },
  { kind: 'group', key: 'moreTrade' },
  { kind: 'group', key: 'moreAi' },
  { kind: 'group', key: 'moreService' },
]

/** 快捷区第二枚(对齐 web 侧边栏快捷区「自动化任务」/self-media/automation) */
export const DRAWER_AUTOMATION_ITEM: DrawerNavItem = {
  labelKey: 'drawer.automation',
  Icon: Clock,
  route: 'Automations',
  target: { type: 'route', name: 'Automations' },
}
// 扫一扫快捷入口(2026-10-27 立):用户要求左侧栏底部也能一键直达扫码。
// ScanLogin 路由无必参且在 RootNavigator 注册,走与自动化任务同一的「独立快捷项」出口。
export const DRAWER_SCAN_ITEM: DrawerNavItem = {
  labelKey: 'scanLogin.menuTitle',
  Icon: ScanLine,
  route: 'ScanLogin',
  target: { type: 'route', name: 'ScanLogin' },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
