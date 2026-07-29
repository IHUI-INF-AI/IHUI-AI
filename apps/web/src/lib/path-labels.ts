/**
 * 集中式 path → 标签规格映射单一事实来源。
 *
 * 用途:TagsView 渲染时根据 tag.path + 当前 locale 实时派生标签标题,
 * 取代"store 中存 title 字符串"的旧设计 — 语言切换后已存在标签自动重译。
 *
 * 复用现有导航定义,不重复维护:
 * - FLAT_NAV_ITEMS(主侧边栏) → ns='nav'
 * - ADMIN_NAV(AdminNav)     → ns='admin'
 * - EXTRA_PATH_LABELS       → 未在侧边栏的 17 条独立页面路由 + 86 条 2026-07-28 自动扩展
 *
 * 匹配策略:精确匹配优先,未命中则按最长前缀匹配回退。
 * 兜底:TagsView 走 deriveTitle 把 kebab-case 转 Title Case(单语言英文标题)。
 */

import { FLAT_NAV_ITEMS } from '@/components/sidebar'
import { ADMIN_NAV } from '@/components/layout/AdminNav'

export interface PathLabelSpec {
  /** 翻译命名空间(对应 messages/*.json 的顶层 key,如 'nav'/'admin'/'about') */
  ns: string
  /** 该命名空间下的翻译键 */
  key: string
}

interface PathLabelEntry {
  href: string
  spec: PathLabelSpec
}

/** 主侧边栏路由 → ns='nav',key=labelKey */
const NAV_ENTRIES: PathLabelEntry[] = FLAT_NAV_ITEMS.map((item) => ({
  href: item.href,
  spec: { ns: 'nav', key: item.labelKey },
}))

/** AdminNav 路由 → ns='admin',key=labelKey */
const ADMIN_ENTRIES: PathLabelEntry[] = ADMIN_NAV.map((item) => ({
  href: item.href,
  spec: { ns: 'admin', key: item.labelKey },
}))

/**
 * 未在侧边栏中暴露但用户可能通过 URL 直接访问的独立页面路由。
 * 这些路由的标签规格走对应独立页面命名空间,确保标题正确翻译。
 *
 * 2026-07-28 自动扩展 86 条:基于 Next.js 路由扫描 + zh-CN.json 已有 key 匹配。
 * 用户反馈"标签栏卡片文本没做好 i18n",补全直接 URL 访问页面的翻译规格。
 */
const EXTRA_PATH_LABELS: PathLabelEntry[] = [
  // ===== 原有 21 条独立页面路由 =====
  { href: '/about', spec: { ns: 'about', key: 'aboutUs' } },
  { href: '/articles', spec: { ns: 'articles', key: 'title' } },
  { href: '/business-card', spec: { ns: 'businessCard', key: 'title' } },
  { href: '/pricing', spec: { ns: 'nav', key: 'pricing' } },
  { href: '/support', spec: { ns: 'nav', key: 'support' } },
  { href: '/ai-generation', spec: { ns: 'nav', key: 'aiGeneration' } },
  { href: '/ask', spec: { ns: 'nav', key: 'ask' } },
  { href: '/comments', spec: { ns: 'nav', key: 'comments' } },
  { href: '/developer', spec: { ns: 'nav', key: 'developer' } },
  { href: '/drama', spec: { ns: 'nav', key: 'drama' } },
  { href: '/edu', spec: { ns: 'nav', key: 'edu' } },
  { href: '/image-gen', spec: { ns: 'nav', key: 'imageGen' } },
  { href: '/member', spec: { ns: 'nav', key: 'member' } },
  { href: '/mobile-dashboard', spec: { ns: 'nav', key: 'mobileDashboard' } },
  { href: '/notifications', spec: { ns: 'nav', key: 'notifications' } },
  { href: '/commission', spec: { ns: 'nav', key: 'commission' } },
  { href: '/contact', spec: { ns: 'nav', key: 'contact' } },
  { href: '/mcp-projects', spec: { ns: 'nav', key: 'mcpProjects' } },
  { href: '/openclaw', spec: { ns: 'nav', key: 'openclaw' } },
  { href: '/recruitment', spec: { ns: 'nav', key: 'recruitment' } },
  { href: '/blog', spec: { ns: 'blog', key: 'title' } },

  // ===== 2026-07-29 补:/chat 系列路由(用户反馈"中文界面还显示 chat")=====
  // /chat 路由未注册 i18n 规格 → TagsView 走 deriveTitle 兜底返回英文 "Chat"
  // 复用 aiChat 命名空间(zh-CN="AI任务" / en="AIChat" / ja="aiチャット" / ko="ai채팅" / zh-TW="AI對話")
  // /chat/history 已通过 NAV_ENTRIES(nav.chatHistory="对话历史")注册,此处不重复
  // /chat/favorites 复用 chatHistory.favoritesTitle(5 语言均有)
  { href: '/chat', spec: { ns: 'aiChat', key: 'title' } },
  { href: '/chat/templates', spec: { ns: 'aiChat', key: 'templates' } },
  { href: '/chat/settings', spec: { ns: 'aiChat', key: 'settings' } },
  { href: '/chat/favorites', spec: { ns: 'chatHistory', key: 'favoritesTitle' } },
  { href: '/chat/share/[id]', spec: { ns: 'aiChat', key: 'share' } },

  // ===== 2026-07-28 自动扩展(用户反馈"标签栏卡片文本没做好 i18n")=====
  // admin 子路由 - 走 admin 命名空间已有 key
  { href: '/admin/agreements', spec: { ns: 'admin', key: 'agreements' } },
  { href: '/admin/ai-metrics', spec: { ns: 'admin', key: 'aiMetrics' } },
  { href: '/admin/asks', spec: { ns: 'admin', key: 'asks' } },
  { href: '/admin/behavior', spec: { ns: 'admin', key: 'behavior' } },
  { href: '/admin/circles', spec: { ns: 'admin', key: 'circles' } },
  { href: '/admin/clawdbot/permissions', spec: { ns: 'admin', key: 'permissions' } },
  { href: '/admin/comment-logs', spec: { ns: 'admin', key: 'commentLogs' } },
  { href: '/admin/comments', spec: { ns: 'admin', key: 'comments' } },
  { href: '/admin/customer-service', spec: { ns: 'admin', key: 'customerService' } },
  { href: '/admin/demand-audit', spec: { ns: 'admin', key: 'demandAudit' } },
  { href: '/admin/demand-audit/[id]', spec: { ns: 'admin', key: 'demandAudit' } },
  { href: '/admin/demand-square/[id]', spec: { ns: 'admin', key: 'demandSquare' } },
  { href: '/admin/distribution/orders', spec: { ns: 'admin', key: 'orders' } },
  { href: '/admin/edu', spec: { ns: 'admin', key: 'edu' } },
  { href: '/admin/edu-settings', spec: { ns: 'admin', key: 'eduSettings' } },
  { href: '/admin/edu/class/members', spec: { ns: 'admin', key: 'members' } },
  { href: '/admin/edu/learn/live', spec: { ns: 'admin', key: 'live' } },
  { href: '/admin/exchange-rates', spec: { ns: 'admin', key: 'exchangeRates' } },
  { href: '/admin/learn', spec: { ns: 'admin', key: 'learn' } },
  { href: '/admin/menu', spec: { ns: 'admin', key: 'menu' } },
  { href: '/admin/menu-permission', spec: { ns: 'admin', key: 'menuPermission' } },
  { href: '/admin/message-templates', spec: { ns: 'admin', key: 'messageTemplates' } },
  { href: '/admin/oss', spec: { ns: 'admin', key: 'oss' } },
  { href: '/admin/private-letters', spec: { ns: 'admin', key: 'privateLetters' } },
  { href: '/admin/refund/[id]', spec: { ns: 'admin', key: 'refund' } },
  { href: '/admin/resources/tags', spec: { ns: 'admin', key: 'tags' } },
  { href: '/admin/saas/[slug]', spec: { ns: 'admin', key: 'saas' } },
  { href: '/admin/schedule/logs', spec: { ns: 'admin', key: 'logs' } },
  { href: '/admin/search-hot-words', spec: { ns: 'admin', key: 'searchHotWords' } },
  { href: '/admin/security/anomalies', spec: { ns: 'admin', key: 'anomalies' } },
  { href: '/admin/security/ip-reputation', spec: { ns: 'admin', key: 'ipReputation' } },
  { href: '/admin/security/threat-dashboard', spec: { ns: 'admin', key: 'threatDashboard' } },
  { href: '/admin/sensitive-word', spec: { ns: 'admin', key: 'sensitiveWord' } },
  { href: '/admin/sensitive-words', spec: { ns: 'admin', key: 'sensitiveWords' } },
  { href: '/admin/signin-rule', spec: { ns: 'admin', key: 'signinRule' } },
  { href: '/admin/video-logs', spec: { ns: 'admin', key: 'videoLogs' } },
  // 其他独立页面
  { href: '/ai-world/[id]', spec: { ns: 'nav', key: 'aiWorld' } },
  { href: '/ai-world/favorites', spec: { ns: 'nav', key: 'favorites' } },
  { href: '/article', spec: { ns: 'articles', key: 'title' } },
  { href: '/articles/[id]', spec: { ns: 'articles', key: 'title' } },
  { href: '/articles/edit', spec: { ns: 'articles', key: 'title' } },
  { href: '/articles/hot', spec: { ns: 'articles', key: 'title' } },
  { href: '/blog/[slug]', spec: { ns: 'blog', key: 'title' } },
  { href: '/business-card/favorites', spec: { ns: 'nav', key: 'favorites' } },
  { href: '/certificate/download', spec: { ns: 'certificate', key: 'download' } },
  { href: '/circles/post', spec: { ns: 'circles', key: 'post' } },
  { href: '/commission/plan', spec: { ns: 'nav', key: 'plan' } },
  { href: '/distribution/commission', spec: { ns: 'distribution', key: 'commissionTitle' } },
  { href: '/distribution/team', spec: { ns: 'distribution', key: 'teamTitle' } },
  { href: '/distribution/team/[id]', spec: { ns: 'distribution', key: 'teamTitle' } },
  { href: '/distribution/token', spec: { ns: 'distribution', key: 'tokenTitle' } },
  { href: '/distribution/withdraw', spec: { ns: 'distribution', key: 'withdrawTitle' } },
  { href: '/docs', spec: { ns: 'nav', key: 'docs' } },
  { href: '/exam/wrong-questions', spec: { ns: 'exam', key: 'wrongQuestions' } },
  { href: '/feature-center/agents', spec: { ns: 'nav', key: 'agents' } },
  { href: '/feature-center/models', spec: { ns: 'nav', key: 'models' } },
  { href: '/image-gen/favorites', spec: { ns: 'nav', key: 'favorites' } },
  { href: '/knowledge-rag/[id]/chunks', spec: { ns: 'knowledgeRag', key: 'chunks' } },
  { href: '/knowledge-rag/manage', spec: { ns: 'knowledgeRag', key: 'manage' } },
  { href: '/learn/topic', spec: { ns: 'learn', key: 'topic' } },
  { href: '/learn/topic/[id]', spec: { ns: 'learn', key: 'topic' } },
  { href: '/models/contact', spec: { ns: 'models', key: 'contact' } },
  { href: '/oauth/authorize', spec: { ns: 'oauth', key: 'authorizeTitle' } },
  { href: '/payment/checkout', spec: { ns: 'payment', key: 'checkout' } },
  { href: '/plugins', spec: { ns: 'plugins', key: 'title' } },
  { href: '/points/sign-in', spec: { ns: 'points', key: 'signIn' } },
  { href: '/publish/accounts', spec: { ns: 'publish', key: 'accounts' } },
  { href: '/publish/history', spec: { ns: 'publish', key: 'history' } },
  { href: '/publish/new', spec: { ns: 'publish', key: 'new' } },
  { href: '/search/history', spec: { ns: 'search', key: 'history' } },
  { href: '/settings/authorizations', spec: { ns: 'settings', key: 'authorizationsTitle' } },
  { href: '/settings/icp-record', spec: { ns: 'settings', key: 'icpRecordTitle' } },
  { href: '/settings/login-security', spec: { ns: 'settings', key: 'loginSecurity' } },
  { href: '/settings/model-record', spec: { ns: 'settings', key: 'modelRecordTitle' } },
  { href: '/settings/security-log', spec: { ns: 'settings', key: 'securityLogTitle' } },
  { href: '/skills/market', spec: { ns: 'skills', key: 'market' } },
  { href: '/sso/redirect', spec: { ns: 'sso', key: 'redirect' } },
  { href: '/sso/register', spec: { ns: 'sso', key: 'registerTitle' } },
  { href: '/student/certificates', spec: { ns: 'student', key: 'certificates' } },
  { href: '/student/my-lessons', spec: { ns: 'student', key: 'myLessonsTitle' } },
  { href: '/student/wrong-book', spec: { ns: 'student', key: 'wrongBookTitle' } },
  { href: '/user/articles', spec: { ns: 'user', key: 'articles' } },
  { href: '/vip/details', spec: { ns: 'vip', key: 'details' } },
  { href: '/wallet/recharge', spec: { ns: 'wallet', key: 'recharge' } },
  { href: '/wallet/withdraw', spec: { ns: 'wallet', key: 'withdraw' } },
  { href: '/workspace/permissions', spec: { ns: 'workspace', key: 'permissionsPage' } },
]

/** 合并所有路由 → 标签规格映射 */
const ALL_PATH_LABEL_MAP: PathLabelEntry[] = [
  ...NAV_ENTRIES,
  ...ADMIN_ENTRIES,
  ...EXTRA_PATH_LABELS,
]

/** 按 href 长度降序排列,用于最长前缀匹配(长的优先) */
const SORTED_PATH_LABELS = [...ALL_PATH_LABEL_MAP].sort((a, b) => b.href.length - a.href.length)

/**
 * 解析 pathname → 标签规格。
 *
 * 1. '/' → {ns:'nav', key:'home'}
 * 2. 精确匹配 ALL_PATH_LABEL_MAP
 * 3. 最长前缀匹配(SORTED_PATH_LABELS 中按 href 长度降序的第一条 startsWith 命中)
 * 4. 未命中返回 null(TagsView 会回退到 deriveTitle,kebab-case → Title Case)
 */
export function resolvePathLabelSpec(pathname: string): PathLabelSpec | null {
  if (!pathname || pathname === '/') return { ns: 'nav', key: 'home' }

  // 精确匹配
  const exact = ALL_PATH_LABEL_MAP.find((e) => e.href === pathname)
  if (exact) return exact.spec

  // 最长前缀匹配(已按 href 长度降序)
  for (const entry of SORTED_PATH_LABELS) {
    if (pathname.startsWith(`${entry.href}/`)) return entry.spec
  }

  return null
}
