// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { RootStackParamList } from '../navigation/RootNavigator'
import type { AppIcon } from '@ihui/types'
import {
  Receipt,
  Undo2,
  CreditCard,
  ClipboardList,
  Package,
  RefreshCw,
  Wallet,
  BarChart3,
  Banknote,
  Landmark,
  Crown,
  Gift,
  Scale,
  Ticket,
  Tag,
  ShoppingBag,
  TrendingUp,
  BookOpen,
  Files,
  CheckCircle2,
  Calendar,
  Trophy,
  Megaphone,
  Handshake,
  Users,
  User,
  Mail,
  QrCode,
  PartyPopper,
  FileText,
  CalendarCheck,
  Palette,
  Search,
  Wrench,
  Brain,
  Globe,
  Image,
  Send,
  GraduationCap,
  PlayCircle,
  Pencil,
  ScrollText,
  PenLine,
  BadgeCheck,
  Star,
  Eye,
  Heart,
  MessageCircle,
  Bell,
  MailOpen,
  Speaker,
  Settings,
  IdCard,
  Bot,
  Puzzle,
  Store,
  Plus,
  Network,
  Newspaper,
  Circle,
  HelpCircle,
  Repeat,
  Earth,
  Compass,
} from 'lucide-react-native'

type ProfileRoute = keyof RootStackParamList
type RootRoute = keyof RootStackParamList

/** 特殊菜单 key:M4 WebView 承载入口(非路由名,onNavigate 内单独处理) */
export type MenuSpecialKey = 'WebViewPortal'

export type MenuItem =
  | { key: ProfileRoute; labelKey: string; icon: AppIcon | string; viaParent?: false }
  | { key: RootRoute | MenuSpecialKey; labelKey: string; icon: AppIcon | string; viaParent: true }

export interface MenuSection {
  titleKey: string
  items: MenuItem[]
}

export const MENU_SECTIONS: MenuSection[] = [
  {
    titleKey: 'menu.sectionOrder',
    items: [
      { key: 'Order', labelKey: 'menu.order', icon: Receipt },
      { key: 'OrderRefund', labelKey: 'menu.orderRefund', icon: Undo2, viaParent: true },
      { key: 'Payment', labelKey: 'menu.payment', icon: CreditCard, viaParent: true },
      { key: 'OrderLog', labelKey: 'menu.orderLog', icon: ClipboardList, viaParent: true },
      { key: 'OrderTrack', labelKey: 'menu.orderTrack', icon: Package, viaParent: true },
      { key: 'RefundHistory', labelKey: 'menu.refundHistory', icon: RefreshCw, viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionWallet',
    items: [
      { key: 'Wallet', labelKey: 'menu.wallet', icon: Wallet },
      { key: 'Finance', labelKey: 'menu.finance', icon: BarChart3, viaParent: true },
      { key: 'Withdraw', labelKey: 'menu.withdraw', icon: Banknote, viaParent: true },
      { key: 'BankCard', labelKey: 'menu.bankCard', icon: Landmark, viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionVip',
    items: [
      { key: 'Vip', labelKey: 'menu.vip', icon: Crown, viaParent: true },
      { key: 'VipBenefit', labelKey: 'menu.vipBenefit', icon: Gift, viaParent: true },
      { key: 'VipCompare', labelKey: 'menu.vipCompare', icon: Scale, viaParent: true },
      { key: 'Coupon', labelKey: 'menu.coupon', icon: Ticket, viaParent: true },
      { key: 'Promotion', labelKey: 'menu.promotion', icon: Tag, viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionPoints',
    items: [
      { key: 'PointsMall', labelKey: 'menu.pointsMall', icon: ShoppingBag, viaParent: true },
      { key: 'PointsRecord', labelKey: 'menu.pointsRecord', icon: TrendingUp, viaParent: true },
      { key: 'PointRule', labelKey: 'menu.pointRule', icon: BookOpen, viaParent: true },
      { key: 'PointHistory', labelKey: 'menu.pointHistory', icon: Files, viaParent: true },
      { key: 'TaskCenter', labelKey: 'menu.taskCenter', icon: CheckCircle2, viaParent: true },
      { key: 'CheckIn', labelKey: 'menu.checkIn', icon: Calendar, viaParent: true },
      { key: 'Ranking', labelKey: 'menu.ranking', icon: Trophy, viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionPromote',
    items: [
      { key: 'Promote', labelKey: 'menu.promote', icon: Megaphone, viaParent: true },
      { key: 'Distribution', labelKey: 'menu.distribution', icon: Handshake, viaParent: true },
      { key: 'Team', labelKey: 'menu.team', icon: Users, viaParent: true },
      { key: 'Referrer', labelKey: 'menu.referrer', icon: User, viaParent: true },
      { key: 'Invite', labelKey: 'menu.invite', icon: Mail, viaParent: true },
      { key: 'QrCode', labelKey: 'menu.qrCode', icon: QrCode, viaParent: true },
      { key: 'Activity', labelKey: 'menu.activity', icon: PartyPopper, viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionStudy',
    items: [
      { key: 'Note', labelKey: 'menu.note', icon: FileText, viaParent: true },
      { key: 'StudyRecord', labelKey: 'menu.studyRecord', icon: BookOpen, viaParent: true },
      { key: 'StudyPlan', labelKey: 'menu.studyPlan', icon: CalendarCheck, viaParent: true },
      { key: 'StudyProgress', labelKey: 'menu.studyProgress', icon: TrendingUp, viaParent: true },
      { key: 'AIMultimodal', labelKey: 'menu.aiMultimodal', icon: Palette, viaParent: true },
      { key: 'KnowledgeBase', labelKey: 'menu.knowledgeBase', icon: BookOpen, viaParent: true },
      // M4.1(2026-08-26):RAG 知识库增强(搜索/切片)
      { key: 'KnowledgeRag', labelKey: 'menu.knowledgeRag', icon: Search, viaParent: true },
      { key: 'AiSkill', labelKey: 'menu.aiSkill', icon: Wrench, viaParent: true },
      { key: 'Memory', labelKey: 'menu.memory', icon: Brain, viaParent: true },
      { key: 'AiWorld', labelKey: 'menu.aiWorld', icon: Globe, viaParent: true },
      { key: 'ImageGenHistory', labelKey: 'menu.imageGen', icon: Image, viaParent: true },
      { key: 'Publish', labelKey: 'menu.publish', icon: Send, viaParent: true },
      { key: 'CourseEnroll', labelKey: 'menu.courseEnroll', icon: GraduationCap, viaParent: true },
      { key: 'LivePlayback', labelKey: 'menu.livePlayback', icon: PlayCircle, viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionExam',
    items: [
      { key: 'Exam', labelKey: 'menu.exam', icon: Pencil, viaParent: true },
      { key: 'ExamHistory', labelKey: 'menu.examHistory', icon: Files, viaParent: true },
      { key: 'Certificate', labelKey: 'menu.certificate', icon: ScrollText },
      { key: 'CertList', labelKey: 'menu.certList', icon: ClipboardList, viaParent: true },
      { key: 'CertApply', labelKey: 'menu.certApply', icon: PenLine, viaParent: true },
      { key: 'CertVerify', labelKey: 'menu.certVerify', icon: BadgeCheck, viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionSocial',
    items: [
      { key: 'Favorites', labelKey: 'menu.favorites', icon: Star },
      { key: 'Following', labelKey: 'menu.following', icon: Eye },
      { key: 'Follow', labelKey: 'menu.follow', icon: Handshake },
      { key: 'Favorite', labelKey: 'menu.favorite', icon: Heart },
      { key: 'MessageCenter', labelKey: 'menu.messageCenter', icon: MessageCircle },
      { key: 'MessageSystem', labelKey: 'menu.messageSystem', icon: Bell, viaParent: true },
      { key: 'MessageDirect', labelKey: 'menu.messageDirect', icon: MailOpen, viaParent: true },
      { key: 'MessageGroup', labelKey: 'menu.messageGroup', icon: Users, viaParent: true },
      {
        key: 'NotificationList',
        labelKey: 'menu.notificationList',
        icon: Speaker,
        viaParent: true,
      },
      {
        key: 'NotificationSettings',
        labelKey: 'menu.notificationSettings',
        icon: Settings,
        viaParent: true,
      },
    ],
  },
  {
    titleKey: 'menu.sectionAuth',
    items: [
      { key: 'ProfileEdit', labelKey: 'menu.profileEdit', icon: Pencil },
      { key: 'RealNameAuth', labelKey: 'menu.realNameAuth', icon: IdCard, viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionAgent',
    items: [
      { key: 'Agent', labelKey: 'menu.agent', icon: Bot },
      // 助手管理(对齐原项目 dev_enter pageType=index「我的智能体」:草稿/审核中/已发布管理)
      { key: 'Assistant', labelKey: 'menu.assistant', icon: Puzzle },
      { key: 'AgentMarket', labelKey: 'menu.agentMarket', icon: Store, viaParent: true },
      { key: 'AgentCreate', labelKey: 'menu.agentCreate', icon: Plus, viaParent: true },
      {
        key: 'AgentReviewList',
        labelKey: 'menu.agentReviewList',
        icon: MessageCircle,
        viaParent: true,
      },
      { key: 'AgentStat', labelKey: 'menu.agentStat', icon: BarChart3, viaParent: true },
      { key: 'AgentSetting', labelKey: 'menu.agentSetting', icon: Settings, viaParent: true },
      // M4.1(2026-08-26):子智能体调度(swarm)
      { key: 'Subagents', labelKey: 'menu.subagents', icon: Network, viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionCommunity',
    items: [
      { key: 'ArticleList', labelKey: 'menu.articleList', icon: Newspaper, viaParent: true },
      { key: 'PostCreate', labelKey: 'menu.postCreate', icon: PenLine, viaParent: true },
      { key: 'CircleCreate', labelKey: 'menu.circleCreate', icon: Circle, viaParent: true },
      { key: 'AskList', labelKey: 'menu.askList', icon: HelpCircle, viaParent: true },
      { key: 'AskCreate', labelKey: 'menu.askCreate', icon: Plus, viaParent: true },
      { key: 'NoteList', labelKey: 'menu.noteList', icon: FileText, viaParent: true },
      { key: 'NoteCreate', labelKey: 'menu.noteCreate', icon: Pencil, viaParent: true },
    ],
  },
  {
    titleKey: 'menu.sectionSettings',
    items: [
      { key: 'Subscriptions', labelKey: 'menu.subscriptions', icon: Repeat },
      { key: 'Settings', labelKey: 'menu.settings', icon: Settings },
      // M4(2026-08-26):复杂后台/营销功能 WebView 承载入口
      { key: 'WebViewPortal', labelKey: 'menu.webPortal', icon: Earth, viaParent: true },
      // M4.1(2026-08-26):Web 功能门户(edu-ai/教务家长/开发者/自媒体等 37 条细分入口)
      { key: 'WebPortal', labelKey: 'menu.webPortalCenter', icon: Compass, viaParent: true },
    ],
  },
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
