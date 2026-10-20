// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { LucideIcon } from 'lucide-react-native'
import {
  Award,
  BookOpen,
  ClipboardList,
  Crown,
  FileText,
  GraduationCap,
  Hash,
  LayoutGrid,
  ListChecks,
  MessageCircle,
  NotebookPen,
  PenLine,
  PlayCircle,
  ScrollText,
  Send,
  ShoppingBag,
  Star,
  Ticket,
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

export type HubTarget = { type: 'route'; name: string } | { type: 'main'; screen: MainTabKey }

export interface HubItem {
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
      {
        labelKey: 'menu.topicList',
        Icon: Hash,
        route: 'TopicList',
        target: { type: 'route', name: 'TopicList' },
      },
      {
        labelKey: 'menu.noteList',
        Icon: NotebookPen,
        route: 'NoteList',
        target: { type: 'route', name: 'NoteList' },
      },
      {
        labelKey: 'menu.publish',
        Icon: Send,
        route: 'Publish',
        target: { type: 'route', name: 'Publish' },
      },
      {
        labelKey: 'menu.selfMedia',
        Icon: PenLine,
        route: 'SelfMedia',
        target: { type: 'route', name: 'SelfMedia' },
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
    ],
  },
  community: {
    titleKey: 'drawer.groupCommunity',
    Icon: UsersRound,
    items: [
      {
        labelKey: 'menu.articleList',
        Icon: FileText,
        route: 'ArticleList',
        target: { type: 'route', name: 'ArticleList' },
      },
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
