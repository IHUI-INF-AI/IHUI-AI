/**
 * WebView 门户配置(M4 方案,2026-08-26)
 *
 * 背景:移动端 apps/mobile-rn 已有通用 WebViewScreen(M4 方案 2026-08-26 立),
 * 用法 navigation.navigate('WebView', { url, title })。此前唯一入口是个人中心
 * "网页版"加载整站 https://aizhs.top。本配置将 Web 端"移动端未原生实现"的
 * 复杂功能域按细分 URL 组织成门户,替代整站入口。UI/导航接线与 i18n 翻译由主 agent 完成。
 *
 * 约定:
 * - WEB_BASE_URL 生产默认 https://aizhs.top,可用 EXPO_PUBLIC_WEB_BASE_URL 覆盖
 *   (开发环境可设为 http://<局域网IP>:8801)
 * - path 与 apps/web/app/(main) 下的真实路由一致((main) 为 Next.js 路由组,URL 不含它)
 * - titleKey 为 i18n key 名,统一置于 webViewPortal 命名空间
 * - key 全局唯一,采用 <domain>-<page> 连字符格式
 */

const ENV_WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL

export const WEB_BASE_URL = ENV_WEB_BASE_URL || 'https://aizhs.top'

export interface WebPortalEntry {
  /** 全局唯一标识(domain 前缀 + 页面,连字符分隔) */
  key: string
  /** i18n key 名 */
  titleKey: string
  /** 相对路径,与 web 端 (main) 路由一致,不含 (main) */
  path: string
  /** 功能域名 */
  domain: string
}

export interface WebPortalSection {
  /** 分组标题的 i18n key 名 */
  titleKey: string
  /** 该分组下的门户条目 */
  entries: readonly WebPortalEntry[]
}

/**
 * 门户分组配置:覆盖移动端未原生实现的全部复杂功能域(7 组 47 条)
 */
export const WEB_PORTAL_SECTIONS = [
  {
    titleKey: 'webViewPortal.sections.eduAi',
    entries: [
      { key: 'edu-ai-policy', titleKey: 'webViewPortal.eduAi.policy', path: '/edu-ai/policy', domain: 'edu-ai' },
      { key: 'edu-ai-certification', titleKey: 'webViewPortal.eduAi.certification', path: '/edu-ai/certification', domain: 'edu-ai' },
      { key: 'edu-ai-courses', titleKey: 'webViewPortal.eduAi.courses', path: '/edu-ai/courses', domain: 'edu-ai' },
      { key: 'edu-ai-aigc-tools', titleKey: 'webViewPortal.eduAi.aigcTools', path: '/edu-ai/aigc-tools', domain: 'edu-ai' },
      { key: 'edu-ai-map', titleKey: 'webViewPortal.eduAi.map', path: '/edu-ai/map', domain: 'edu-ai' },
      { key: 'edu-ai-marking', titleKey: 'webViewPortal.eduAi.marking', path: '/edu-ai/marking', domain: 'edu-ai' },
      { key: 'edu-ai-outbound', titleKey: 'webViewPortal.eduAi.outbound', path: '/edu-ai/outbound', domain: 'edu-ai' },
      { key: 'edu-ai-tbox', titleKey: 'webViewPortal.eduAi.tbox', path: '/edu-ai/tbox', domain: 'edu-ai' },
      { key: 'edu-ai-video-compose', titleKey: 'webViewPortal.eduAi.videoCompose', path: '/edu-ai/video-compose', domain: 'edu-ai' },
      { key: 'edu-ai-voice', titleKey: 'webViewPortal.eduAi.voice', path: '/edu-ai/voice', domain: 'edu-ai' },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.edu',
    entries: [
      { key: 'edu-schedule-management', titleKey: 'webViewPortal.eduManagement.schedule', path: '/edu/edu-management/schedule', domain: 'edu' },
      { key: 'edu-attendance', titleKey: 'webViewPortal.eduManagement.attendance', path: '/edu/edu-management/attendance', domain: 'edu' },
      { key: 'edu-grades', titleKey: 'webViewPortal.eduManagement.grades', path: '/edu/edu-management/grades', domain: 'edu' },
      { key: 'edu-homework', titleKey: 'webViewPortal.eduManagement.homework', path: '/edu/edu-management/homework', domain: 'edu' },
      { key: 'edu-parent', titleKey: 'webViewPortal.eduParent', path: '/edu/parent', domain: 'edu' },
      { key: 'edu-timetable', titleKey: 'webViewPortal.eduSchedule', path: '/edu/schedule', domain: 'edu' },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.developer',
    entries: [
      { key: 'developer-keys', titleKey: 'webViewPortal.developer.keys', path: '/developer/keys', domain: 'developer' },
      { key: 'developer-api-docs', titleKey: 'webViewPortal.developer.apiDocs', path: '/developer/api-docs', domain: 'developer' },
      { key: 'developer-webhooks', titleKey: 'webViewPortal.developer.webhooks', path: '/developer/webhooks', domain: 'developer' },
      { key: 'developer-logs', titleKey: 'webViewPortal.developer.logs', path: '/developer/logs', domain: 'developer' },
      { key: 'developer-billing', titleKey: 'webViewPortal.developer.billing', path: '/developer/billing', domain: 'developer' },
      { key: 'developer-relay', titleKey: 'webViewPortal.developer.relay', path: '/developer/relay', domain: 'developer' },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.selfMedia',
    entries: [
      { key: 'self-media-koubo', titleKey: 'webViewPortal.selfMedia.koubo', path: '/self-media/koubo', domain: 'self-media' },
      { key: 'self-media-wechat', titleKey: 'webViewPortal.selfMedia.wechat', path: '/self-media/wechat', domain: 'self-media' },
      { key: 'self-media-automation', titleKey: 'webViewPortal.selfMedia.automation', path: '/self-media/automation', domain: 'self-media' },
      { key: 'publish-analytics', titleKey: 'webViewPortal.publish.analytics', path: '/publish/analytics', domain: 'self-media' },
      { key: 'publish-calendar', titleKey: 'webViewPortal.publish.calendar', path: '/publish/calendar', domain: 'self-media' },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.knowledgeTools',
    entries: [
      // workspace(IDE 项目空间)依赖本地文件系统,移动端不适配原生,WebView 承载
      { key: 'workspace', titleKey: 'webViewPortal.workspace', path: '/workspace', domain: 'workspace' },
      { key: 'knowledge-graph', titleKey: 'webViewPortal.knowledgeGraph', path: '/knowledge-graph', domain: 'knowledge-graph' },
      { key: 'tools-voice-stt', titleKey: 'webViewPortal.tools.voiceStt', path: '/tools/voice-stt', domain: 'tools' },
      { key: 'resources', titleKey: 'webViewPortal.resources', path: '/resources', domain: 'resources' },
      { key: 'stock', titleKey: 'webViewPortal.stock', path: '/stock', domain: 'stock' },
      { key: 'fund-data', titleKey: 'webViewPortal.fundData', path: '/fund-data', domain: 'fund-data' },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.models',
    entries: [
      { key: 'models-overview', titleKey: 'webViewPortal.models.overview', path: '/models/overview', domain: 'models' },
      { key: 'models-keys', titleKey: 'webViewPortal.models.keys', path: '/models/keys', domain: 'models' },
      { key: 'models-usage', titleKey: 'webViewPortal.models.usage', path: '/models/usage', domain: 'models' },
      { key: 'models-prompts', titleKey: 'webViewPortal.models.prompts', path: '/models/prompts', domain: 'models' },
      { key: 'models-eval', titleKey: 'webViewPortal.models.eval', path: '/models/eval', domain: 'models' },
    ],
  },
  {
    titleKey: 'webViewPortal.sections.more',
    entries: [
      // 2026-08-26 第二轮补充:矩阵剩余 🔴 中的用户功能(社区/工具/授权/企业)
      { key: 'tags', titleKey: 'webViewPortal.tags', path: '/tags', domain: 'community' },
      { key: 'topics', titleKey: 'webViewPortal.topics', path: '/topics', domain: 'community' },
      { key: 'context', titleKey: 'webViewPortal.context', path: '/context', domain: 'ai' },
      { key: 'traders', titleKey: 'webViewPortal.traders', path: '/traders', domain: 'community' },
      { key: 'members', titleKey: 'webViewPortal.members', path: '/members', domain: 'community' },
      { key: 'lecturers', titleKey: 'webViewPortal.lecturers', path: '/lecturers', domain: 'edu' },
      { key: 'tools-pdf', titleKey: 'webViewPortal.tools.pdf', path: '/tools/pdf', domain: 'tools' },
      {
        key: 'oauth-authorized',
        titleKey: 'webViewPortal.oauth.authorized',
        path: '/oauth/my-authorized',
        domain: 'oauth',
      },
      { key: 'enterprise', titleKey: 'webViewPortal.enterprise', path: '/enterprise', domain: 'enterprise' },
      {
        key: 'feature-center',
        titleKey: 'webViewPortal.featureCenter',
        path: '/feature-center',
        domain: 'feature-center',
      },
    ],
  },
] as const satisfies readonly WebPortalSection[]

/**
 * 拼接门户条目的完整 URL
 */
export function buildWebUrl(entry: WebPortalEntry): string {
  return `${WEB_BASE_URL}${entry.path}`
}
