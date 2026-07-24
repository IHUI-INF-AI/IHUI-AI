/**
 * MeAppsPage — 个人中心首页,列出所有用户类功能入口。
 */
import { AppListPage, type AppItem } from '../components/AppListPage'
import { useNotificationStore } from '../../../lib/notification-store'

const WEB_BASE = 'https://ihui.ai'

const baseItems: AppItem[] = [
  { to: '/me/dashboard', icon: '📊', titleKey: 'apps.dashboard', descKey: 'apps.dashboardDesc' },
  { to: '/me/profile', icon: '👤', titleKey: 'apps.profile', descKey: 'apps.profileDesc' },
  { to: '/me/wallet', icon: '💰', titleKey: 'apps.wallet', descKey: 'apps.walletDesc' },
  { to: '/me/orders', icon: '🛒', titleKey: 'apps.orders', descKey: 'apps.ordersDesc' },
  { to: '/me/points', icon: '⭐', titleKey: 'apps.points', descKey: 'apps.pointsDesc' },
  { to: '/me/vip', icon: '👑', titleKey: 'apps.vip', descKey: 'apps.vipDesc' },
  { to: '/me/favorites', icon: '🔖', titleKey: 'apps.favorites', descKey: 'apps.favoritesDesc' },
  { to: '/me/following', icon: '👥', titleKey: 'apps.following', descKey: 'apps.followingDesc' },
  {
    externalUrl: `${WEB_BASE}/user/fans`,
    icon: '❤️',
    titleKey: 'apps.fans',
    descKey: 'apps.fansDesc',
  },
  {
    externalUrl: `${WEB_BASE}/member`,
    icon: '💎',
    titleKey: 'apps.member',
    descKey: 'apps.memberDesc',
  },
  {
    externalUrl: `${WEB_BASE}/distribution`,
    icon: '📈',
    titleKey: 'apps.distribution',
    descKey: 'apps.distributionDesc',
  },
  {
    externalUrl: `${WEB_BASE}/invitations`,
    icon: '🎁',
    titleKey: 'apps.invitations',
    descKey: 'apps.invitationsDesc',
  },
  { externalUrl: `${WEB_BASE}/teams`, icon: '🤝', titleKey: 'apps.teams', descKey: 'apps.teamsDesc' },
  {
    externalUrl: `${WEB_BASE}/ranking`,
    icon: '🏅',
    titleKey: 'apps.ranking',
    descKey: 'apps.rankingDesc',
  },
  {
    externalUrl: `${WEB_BASE}/business-card`,
    icon: '💳',
    titleKey: 'apps.businessCard',
    descKey: 'apps.businessCardDesc',
  },
  {
    externalUrl: `${WEB_BASE}/learn`,
    icon: '🎓',
    titleKey: 'apps.learn',
    descKey: 'apps.learnDesc',
  },
  { externalUrl: `${WEB_BASE}/exam`, icon: '✍️', titleKey: 'apps.exam', descKey: 'apps.examDesc' },
  { externalUrl: `${WEB_BASE}/live`, icon: '🎥', titleKey: 'apps.live', descKey: 'apps.liveDesc' },
  {
    externalUrl: `${WEB_BASE}/lecturers`,
    icon: '👨‍🏫',
    titleKey: 'apps.lecturers',
    descKey: 'apps.lecturersDesc',
  },
  {
    externalUrl: `${WEB_BASE}/schedule`,
    icon: '📅',
    titleKey: 'apps.schedule',
    descKey: 'apps.scheduleDesc',
  },
  {
    externalUrl: `${WEB_BASE}/refund`,
    icon: '↩️',
    titleKey: 'apps.refund',
    descKey: 'apps.refundDesc',
  },
  {
    externalUrl: `${WEB_BASE}/developer`,
    icon: '🔧',
    titleKey: 'apps.developer',
    descKey: 'apps.developerDesc',
  },
  {
    externalUrl: `${WEB_BASE}/workspace`,
    icon: '🗂️',
    titleKey: 'apps.workspace',
    descKey: 'apps.workspaceDesc',
  },
  {
    externalUrl: `${WEB_BASE}/feedback`,
    icon: '💡',
    titleKey: 'apps.feedback',
    descKey: 'apps.feedbackDesc',
  },
  {
    externalUrl: `${WEB_BASE}/support`,
    icon: '🎧',
    titleKey: 'apps.support',
    descKey: 'apps.supportDesc',
  },
]

export default function MeAppsPage() {
  const { unreadCount } = useNotificationStore()
  const items = baseItems.map((item) =>
    item.to === '/me/dashboard' && unreadCount > 0
      ? { ...item, badge: unreadCount }
      : item,
  )
  // 通知入口单独加 badge
  const notifItem: AppItem = {
    to: '/me/notifications',
    icon: '🔔',
    titleKey: 'apps.notifications',
    descKey: 'apps.notificationsDesc',
    badge: unreadCount > 0 ? unreadCount : undefined,
  }
  const msgItem: AppItem = {
    to: '/me/messages',
    icon: '✉️',
    titleKey: 'apps.messages',
    descKey: 'apps.messagesDesc',
  }
  // 插入到 dashboard 之后
  const finalItems = [items[0], notifItem, msgItem, ...items.slice(1)]
  return <AppListPage titleKey="apps.meTitle" items={finalItems} />
}
