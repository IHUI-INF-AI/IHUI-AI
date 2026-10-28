// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { LucideIcon } from 'lucide-react-native'
import {
  Award,
  BadgeCheck,
  BookOpen,
  CircleAlert,
  CircleDollarSign,
  CircleQuestionMark,
  ClipboardList,
  Coins,
  CreditCard,
  Crown,
  FileText,
  GraduationCap,
  Hash,
  Inbox,
  LayoutGrid,
  Link,
  ListChecks,
  Mail,
  Map,
  MapPin,
  Megaphone,
  MessageCircle,
  Mic,
  NotebookPen,
  Package,
  PenLine,
  PlayCircle,
  Presentation,
  Receipt,
  RefreshCcw,
  RotateCcw,
  ScrollText,
  ShoppingBag,
  ShoppingCart,
  Star,
  Ticket,
  TrendingUp,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react-native'
import type { MainTabKey } from './tab-utils'

/**
 * 域入口清单(P3 侧边栏收敛 RN 腿,2026-10-19)。
 *
 * web 端把教育/内容/交易三域的平铺子项收进 /domains/* 卡片入口页;RN 抽屉原本把这
 * 三域作为可折叠分组直接铺开,本文件把三组条目抽成单源:抽屉只渲染一个域入口行,
 * 点击进 DomainHubScreen 二级屏列出子项(与 web 域入口同构,条目一条不丢)。
 *
 * 本清单只含 route / main 两类目标;drawerTab 目标(个人组 profile→mine)不在三域内,
 * 仍由抽屉原生处理,不进本单源。
 */

/** lucide 图标组件类型(与抽屉 LucideGlyph 同源 lucide-react-native) */
export type HubGlyph = LucideIcon

export type DomainKey = 'edu' | 'content' | 'trade' | 'community'

type HubTarget = { type: 'route'; name: string } | { type: 'main'; screen: MainTabKey }

interface HubItem {
  /** i18n 键(既有无键,本批零新增五语言文案) */
  labelKey: string
  Icon: HubGlyph
  /** active 高亮匹配用路由名(main 目标填 MainTabKey,与抽屉 active 判据同口径) */
  route?: string
  target: HubTarget
}

export interface HubDomain {
  /** 域标题 i18n 键(复用抽屉既有 drawer.group* 键) */
  titleKey: string
  Icon: HubGlyph
  items: readonly HubItem[]
}

export const DOMAIN_HUBS: Record<DomainKey, HubDomain> = {
  edu: {
    titleKey: 'drawer.groupEdu',
    Icon: GraduationCap,
    items: [
      {
        labelKey: 'nav.courses',
        Icon: GraduationCap,
        route: 'CourseMain',
        target: { type: 'main', screen: 'CourseMain' },
      },
      {
        // 旧键 nav.live 五语言包均缺失(既有小缺口),改用真实存在的 live.title
        labelKey: 'live.title',
        Icon: PlayCircle,
        route: 'LiveList',
        target: { type: 'route', name: 'LiveList' },
      },
      {
        labelKey: 'menu.sectionStudy',
        Icon: BookOpen,
        route: 'Learn',
        target: { type: 'route', name: 'Learn' },
      },
      {
        labelKey: 'menu.exam',
        Icon: ScrollText,
        route: 'Exam',
        target: { type: 'route', name: 'Exam' },
      },
      {
        labelKey: 'menu.studyRecord',
        Icon: ClipboardList,
        route: 'StudyRecord',
        target: { type: 'route', name: 'StudyRecord' },
      },
      {
        labelKey: 'menu.noteList',
        Icon: NotebookPen,
        route: 'NoteList',
        target: { type: 'route', name: 'NoteList' },
      },
      {
        labelKey: 'menu.certificate',
        Icon: Award,
        route: 'Certificate',
        target: { type: 'route', name: 'Certificate' },
      },
      // 2026-10-21 对齐 web EDU_HUB_ITEMS:/topics /resources /announcements 三项
      // 此前本域只取了 7 项,话题/资源中心/公告三项 web 有而本域漏挂 ⇒ 补。
      {
        labelKey: 'menu.topicList',
        Icon: Hash,
        route: 'TopicList',
        target: { type: 'route', name: 'TopicList' },
      },
      {
        labelKey: 'resources.title',
        Icon: Package,
        route: 'Resources',
        target: { type: 'route', name: 'Resources' },
      },
      {
        labelKey: 'announcement.title',
        Icon: Megaphone,
        route: 'Announcement',
        target: { type: 'route', name: 'Announcement' },
      },
      // 2026-10-21 第五批:web EDU_HUB_ITEMS 另有 6 项此前漏挂(本域原只取 10 条,
      // web 该清单 41 条)。RN 六路由均可无参导航(已核 RootStackParamList)。
      {
        // web /exam/wrong-questions(错题本)
        labelKey: 'wrongQuestions.title',
        Icon: CircleAlert,
        route: 'WrongQuestions',
        target: { type: 'route', name: 'WrongQuestions' },
      },
      {
        // web /learn/review(每日复习)
        labelKey: 'learnReview.title',
        Icon: RefreshCcw,
        route: 'LearnReview',
        target: { type: 'route', name: 'LearnReview' },
      },
      {
        // web /lecturers(讲师)
        labelKey: 'teacher.list.title',
        Icon: Presentation,
        route: 'TeacherList',
        target: { type: 'route', name: 'TeacherList' },
      },
      {
        // web /edu/progress(学习进度)
        labelKey: 'studyProgress.title',
        Icon: TrendingUp,
        route: 'StudyProgress',
        target: { type: 'route', name: 'StudyProgress' },
      },
      {
        // web /edu-ai/map(学习地图)
        labelKey: 'learnMap.title',
        Icon: Map,
        route: 'LearnMap',
        target: { type: 'route', name: 'LearnMap' },
      },
      {
        // web /edu-ai/certification(讲师认证)
        labelKey: 'certApply.title',
        Icon: BadgeCheck,
        route: 'CertApply',
        target: { type: 'route', name: 'CertApply' },
      },
      {
        // web /edu/qa(课程问答)
        labelKey: 'courseQAList.title',
        Icon: CircleQuestionMark,
        route: 'CourseQAList',
        target: { type: 'route', name: 'CourseQAList' },
      },
    ],
  },
  /**
   * 内容域(2026-10-20 立):对齐 web 侧边栏 contentGroup(/domains/content)。
   *
   * web 把广场/企业/分销/团队/消息/文档/标签/OAuth/自媒体/发布/博客 21 项收敛进一个域入口,
   * RN 侧此前**完全没有这一域**(教育/交易/社群三域之外内容类入口全散落在抽屉里),
   * 这是"两端侧边栏差距"最直观的一处。本域取 RN 有原生路由的 6 项,
   * 圈子/问答留在 community 域(避免 href/route 重复登记导致双条目)。
   */
  content: {
    titleKey: 'drawer.groupContent',
    Icon: LayoutGrid,
    items: [
      {
        labelKey: 'drawer.plaza',
        Icon: LayoutGrid,
        route: 'Plaza',
        target: { type: 'route', name: 'Plaza' },
      },
      {
        labelKey: 'menu.articleList',
        Icon: FileText,
        route: 'ArticleList',
        target: { type: 'route', name: 'ArticleList' },
      },
      // 话题 / 笔记(2026-10-21 归位):web 把 /topics 与 /edu/notes 都收在 EDU_HUB_ITEMS
      // (教育域),edu 域已登记,本域不再重复(同本文件既有"避免 route 重复登记"纪律)。
      // 多平台发布(2026-10-21 归位):抽屉热门组已登记同一 route,此处不再重复。
      {
        labelKey: 'menu.selfMedia',
        Icon: PenLine,
        route: 'SelfMedia',
        target: { type: 'route', name: 'SelfMedia' },
      },
      // 2026-10-21 对齐 web CONTENT_HUB_ITEMS:/tools/voice-stt /groups 两项(此前漏挂)
      {
        labelKey: 'voiceStt.title',
        Icon: Mic,
        route: 'VoiceStt',
        target: { type: 'route', name: 'VoiceStt' },
      },
      {
        labelKey: 'groups.title',
        Icon: Users,
        route: 'Groups',
        target: { type: 'route', name: 'Groups' },
      },
      // 2026-10-21 第五批:web CONTENT_HUB_ITEMS 另有 3 项此前漏挂
      {
        // web /oauth/platform(已连接账号)
        labelKey: 'connectedAccounts.title',
        Icon: Link,
        route: 'ConnectedAccounts',
        target: { type: 'route', name: 'ConnectedAccounts' },
      },
      {
        // web /messages 的系统消息子项
        labelKey: 'messageSystem.title',
        Icon: Inbox,
        route: 'MessageSystem',
        target: { type: 'route', name: 'MessageSystem' },
      },
      {
        // web /messages 的私信子项
        labelKey: 'messageDirect.title',
        Icon: Mail,
        route: 'MessageDirect',
        target: { type: 'route', name: 'MessageDirect' },
      },
    ],
  },
  trade: {
    titleKey: 'drawer.groupTrade',
    Icon: Crown,
    items: [
      {
        labelKey: 'menu.vip',
        Icon: Crown,
        route: 'Vip',
        target: { type: 'route', name: 'Vip' },
      },
      {
        labelKey: 'menu.wallet',
        Icon: Wallet,
        route: 'Wallet',
        target: { type: 'route', name: 'Wallet' },
      },
      {
        labelKey: 'menu.order',
        Icon: ShoppingBag,
        route: 'Order',
        target: { type: 'route', name: 'Order' },
      },
      {
        labelKey: 'menu.coupon',
        Icon: Ticket,
        route: 'Coupon',
        target: { type: 'route', name: 'Coupon' },
      },
      {
        labelKey: 'menu.pointsMall',
        Icon: Star,
        route: 'PointsMall',
        target: { type: 'route', name: 'PointsMall' },
      },
      {
        labelKey: 'menu.taskCenter',
        Icon: ListChecks,
        route: 'TaskCenter',
        target: { type: 'route', name: 'TaskCenter' },
      },
      // 2026-10-21 对齐 web TRADE_HUB_ITEMS + MEMBER_ITEMS:/payment /invoices /activities
      // /points /invitations 五项此前漏挂(RN 五路由均可无参导航,已核 RootStackParamList)。
      {
        labelKey: 'payment.title',
        Icon: CreditCard,
        route: 'Payment',
        target: { type: 'route', name: 'Payment' },
      },
      {
        labelKey: 'invoices.title',
        Icon: Receipt,
        route: 'Invoices',
        target: { type: 'route', name: 'Invoices' },
      },
      {
        labelKey: 'menu.activity',
        Icon: Megaphone,
        route: 'Activity',
        target: { type: 'route', name: 'Activity' },
      },
      {
        labelKey: 'menu.sectionPoints',
        Icon: Coins,
        route: 'Points',
        target: { type: 'route', name: 'Points' },
      },
      {
        labelKey: 'menu.invite',
        Icon: Users,
        route: 'Invite',
        target: { type: 'route', name: 'Invite' },
      },
      // 2026-10-21 第四批对齐(web TRADE_HUB_ITEMS + MEMBER_ITEMS):购买 / 会员权益 / 收货地址
      // 三项此前漏挂,RN 三路由均可无参导航(已核 RootStackParamList)。
      {
        labelKey: 'purchase.title',
        Icon: ShoppingCart,
        route: 'Purchase',
        target: { type: 'route', name: 'Purchase' },
      },
      {
        labelKey: 'vipBenefit.title',
        Icon: Award,
        route: 'VipBenefit',
        target: { type: 'route', name: 'VipBenefit' },
      },
      {
        labelKey: 'addresses.title',
        Icon: MapPin,
        route: 'Addresses',
        target: { type: 'route', name: 'Addresses' },
      },
      // 2026-10-21 第五批:web TRADE_HUB_ITEMS 另有 3 项此前漏挂
      {
        // web /earnings(收益)
        labelKey: 'income.title',
        Icon: CircleDollarSign,
        route: 'Income',
        target: { type: 'route', name: 'Income' },
      },
      {
        // web /traders(VIP 操盘手)
        labelKey: 'vipTrader.title',
        Icon: TrendingUp,
        route: 'VipTrader',
        target: { type: 'route', name: 'VipTrader' },
      },
      {
        // web /refund(申请退款)
        labelKey: 'orderRefund.title',
        Icon: RotateCcw,
        route: 'OrderRefund',
        target: { type: 'route', name: 'OrderRefund' },
      },
    ],
  },
  community: {
    titleKey: 'drawer.groupCommunity',
    Icon: UsersRound,
    items: [
      // 文章(2026-10-21 归位):content 域已登记同一 route,社群域只留圈子 / 问答。
      {
        labelKey: 'menu.circleIndex',
        Icon: UsersRound,
        route: 'CircleIndex',
        target: { type: 'route', name: 'CircleIndex' },
      },
      {
        labelKey: 'menu.askList',
        Icon: MessageCircle,
        route: 'AskList',
        target: { type: 'route', name: 'AskList' },
      },
    ],
  },
} as const
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
