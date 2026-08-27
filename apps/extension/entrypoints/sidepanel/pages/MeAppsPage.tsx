/**
 * MeAppsPage — 个人中心首页,列出所有用户类功能入口。
 */
import {
  BarChart3,
  Bookmark,
  Bell,
  Calendar,
  CreditCard,
  Crown,
  FolderOpen,
  Gem,
  GraduationCap,
  Handshake,
  Headphones,
  Heart,
  Lightbulb,
  Mail,
  Medal,
  PenLine,
  Presentation,
  ShoppingCart,
  Star,
  TrendingUp,
  User,
  Undo2,
  Users,
  Video,
  Wallet,
  Wrench,
  Gift,
} from 'lucide-react'
import { AppListPage, type AppItem } from '../components/AppListPage'
import { useNotificationStore } from '../../../lib/notification-store'
import { WEB_BASE } from '../../../lib/open-in-web'

const baseItems: AppItem[] = [
  {
    to: '/me/dashboard',
    icon: BarChart3,
    titleKey: 'apps.dashboard',
    descKey: 'apps.dashboardDesc',
  },
  { to: '/me/profile', icon: User, titleKey: 'apps.profile', descKey: 'apps.profileDesc' },
  { to: '/me/wallet', icon: Wallet, titleKey: 'apps.wallet', descKey: 'apps.walletDesc' },
  { to: '/me/orders', icon: ShoppingCart, titleKey: 'apps.orders', descKey: 'apps.ordersDesc' },
  { to: '/me/points', icon: Star, titleKey: 'apps.points', descKey: 'apps.pointsDesc' },
  { to: '/me/vip', icon: Crown, titleKey: 'apps.vip', descKey: 'apps.vipDesc' },
  {
    to: '/me/favorites',
    icon: Bookmark,
    titleKey: 'apps.favorites',
    descKey: 'apps.favoritesDesc',
  },
  { to: '/me/following', icon: Users, titleKey: 'apps.following', descKey: 'apps.followingDesc' },
  { to: '/me/fans', icon: Heart, titleKey: 'apps.fans', descKey: 'apps.fansDesc' },
  { to: '/me/member', icon: Gem, titleKey: 'apps.member', descKey: 'apps.memberDesc' },
  {
    to: '/me/distribution',
    icon: TrendingUp,
    titleKey: 'apps.distribution',
    descKey: 'apps.distributionDesc',
  },
  {
    to: '/me/invitations',
    icon: Gift,
    titleKey: 'apps.invitations',
    descKey: 'apps.invitationsDesc',
  },
  {
    externalUrl: `${WEB_BASE}/teams`,
    icon: Handshake,
    titleKey: 'apps.teams',
    descKey: 'apps.teamsDesc',
  },
  {
    externalUrl: `${WEB_BASE}/ranking`,
    icon: Medal,
    titleKey: 'apps.ranking',
    descKey: 'apps.rankingDesc',
  },
  {
    externalUrl: `${WEB_BASE}/business-card`,
    icon: CreditCard,
    titleKey: 'apps.businessCard',
    descKey: 'apps.businessCardDesc',
  },
  {
    externalUrl: `${WEB_BASE}/learn`,
    icon: GraduationCap,
    titleKey: 'apps.learn',
    descKey: 'apps.learnDesc',
  },
  {
    externalUrl: `${WEB_BASE}/exam`,
    icon: PenLine,
    titleKey: 'apps.exam',
    descKey: 'apps.examDesc',
  },
  { externalUrl: `${WEB_BASE}/live`, icon: Video, titleKey: 'apps.live', descKey: 'apps.liveDesc' },
  {
    externalUrl: `${WEB_BASE}/lecturers`,
    icon: Presentation,
    titleKey: 'apps.lecturers',
    descKey: 'apps.lecturersDesc',
  },
  {
    externalUrl: `${WEB_BASE}/schedule`,
    icon: Calendar,
    titleKey: 'apps.schedule',
    descKey: 'apps.scheduleDesc',
  },
  {
    externalUrl: `${WEB_BASE}/refund`,
    icon: Undo2,
    titleKey: 'apps.refund',
    descKey: 'apps.refundDesc',
  },
  {
    externalUrl: `${WEB_BASE}/developer`,
    icon: Wrench,
    titleKey: 'apps.developer',
    descKey: 'apps.developerDesc',
  },
  {
    externalUrl: `${WEB_BASE}/workspace`,
    icon: FolderOpen,
    titleKey: 'apps.workspace',
    descKey: 'apps.workspaceDesc',
  },
  {
    externalUrl: `${WEB_BASE}/feedback`,
    icon: Lightbulb,
    titleKey: 'apps.feedback',
    descKey: 'apps.feedbackDesc',
  },
  {
    externalUrl: `${WEB_BASE}/support`,
    icon: Headphones,
    titleKey: 'apps.support',
    descKey: 'apps.supportDesc',
  },
]

export default function MeAppsPage() {
  const { unreadCount } = useNotificationStore()
  const items = baseItems.map((item) =>
    item.to === '/me/dashboard' && unreadCount > 0 ? { ...item, badge: unreadCount } : item,
  )
  // 通知入口单独加 badge
  const notifItem: AppItem = {
    to: '/me/notifications',
    icon: Bell,
    titleKey: 'apps.notifications',
    descKey: 'apps.notificationsDesc',
    badge: unreadCount > 0 ? unreadCount : undefined,
  }
  const msgItem: AppItem = {
    to: '/me/messages',
    icon: Mail,
    titleKey: 'apps.messages',
    descKey: 'apps.messagesDesc',
  }
  // 插入到 dashboard 之后
  // 2026-08-06 修复:noUncheckedIndexedAccess 下 items[0] 可能 undefined,
  // 用 filter 守卫避免把 undefined 传入 AppListPage(原实现仅靠索引访问)。
  const first = items[0]
  const finalItems = first
    ? [first, notifItem, msgItem, ...items.slice(1)]
    : [notifItem, msgItem, ...items]
  return <AppListPage titleKey="apps.meTitle" items={finalItems} />
}
