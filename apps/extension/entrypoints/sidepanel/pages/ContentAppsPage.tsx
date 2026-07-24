/**
 * ContentAppsPage — 内容中心首页,列出所有内容类功能入口。
 */
import { AppListPage, type AppItem } from '../components/AppListPage'

const WEB_BASE = 'https://ihui.ai'

const items: AppItem[] = [
  { to: '/content/articles', icon: '📝', titleKey: 'apps.articles', descKey: 'apps.articlesDesc' },
  { to: '/content/news', icon: '📰', titleKey: 'apps.news', descKey: 'apps.newsDesc' },
  {
    to: '/content/announcements',
    icon: '📢',
    titleKey: 'apps.announcements',
    descKey: 'apps.announcementsDesc',
  },
  { to: '/content/search', icon: '🔎', titleKey: 'apps.search', descKey: 'apps.searchDesc' },
  { to: '/content/plaza', icon: '🏙️', titleKey: 'apps.plaza', descKey: 'apps.plazaDesc' },
  { to: '/content/circles', icon: '⭕', titleKey: 'apps.circles', descKey: 'apps.circlesDesc' },
  { to: '/content/topics', icon: '#️⃣', titleKey: 'apps.topics', descKey: 'apps.topicsDesc' },
  { to: '/content/asks', icon: '❓', titleKey: 'apps.asks', descKey: 'apps.asksDesc' },
  { externalUrl: `${WEB_BASE}/tags`, icon: '🏷️', titleKey: 'apps.tags', descKey: 'apps.tagsDesc' },
]

export default function ContentAppsPage() {
  return <AppListPage titleKey="apps.contentTitle" items={items} />
}
