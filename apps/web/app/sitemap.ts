import type { MetadataRoute } from 'next'

// 动态 sitemap(2026-08-02 修订,GEO 优化):
// - 覆盖 120+ 核心公开页(产品/营销/帮助/法律/资源/文档)
// - hreflang 修正:只声明实际存在的语言路由(zh-CN 主 + zh-TW 5 个 use-cases 子页)
//   移除 en/ko/ja 路由声明(对应路由文件不存在,AI 爬虫访问 /en/agents 会 404,
//   严重损害 GEO 信任度 + Google Search Console 报 hreflang 错误)
// - 补充遗漏公开页:/openclaw、/developers、/products、/services、/docs/* 16 子文档页等
// - 优先级 + 更新频率按页面重要度分级
// - 私有页(admin/user/wallet/orders/sso-callback/auth/dashboard/favorites/
//   notifications/messages/following/search/task-receiver)不进 sitemap,
//   由 robots.txt 配合 Disallow 防止被索引

// 2026-07-26 P3-1 修复:output:'export' 模式下 sitemap.xml 路由需要 force-static,
// 否则 Next.js 抛 "export const dynamic = 'force-static' not configured" 错误。
export const dynamic = 'force-static'

const SITE_URL = 'https://aizhs.top'

// 实际存在 zh-TW 路由的页面(只有 5 个 use-cases 子页有 zh-TW 版本)
// 其他页面只有 zh-CN 版本,不声明 zh-TW hreflang 避免指向 404
const ZH_TW_PAGES = new Set([
  '/use-cases/ai-translation',
  '/use-cases/ai-research',
  '/use-cases/ai-marketing',
  '/use-cases/ai-edu',
  '/use-cases/ai-design',
])

// 英文版本路由(2026-08-02 立,英文 landing pages)
// 每个英文页面声明 x-default + en + zh-CN hreflang:
// - x-default 和 zh-CN 指向中文主版本(zhPath)
// - en 指向英文版本(enPath)
const EN_PAGES: Array<{
  enPath: string
  zhPath: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}> = [
  { enPath: '/en', zhPath: '/', changeFrequency: 'weekly', priority: 0.9 },
  { enPath: '/en/agents', zhPath: '/agents', changeFrequency: 'weekly', priority: 0.9 },
  { enPath: '/en/models', zhPath: '/models', changeFrequency: 'weekly', priority: 0.9 },
  { enPath: '/en/pricing', zhPath: '/pricing', changeFrequency: 'monthly', priority: 0.9 },
  { enPath: '/en/docs', zhPath: '/docs', changeFrequency: 'weekly', priority: 0.9 },
]

// 核心公开页面清单
// changeFrequency: 页面更新频率
// priority: 相对优先级(0.0-1.0,首页=1.0)
const PAGES: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}> = [
  // 营销/首页
  { path: '', changeFrequency: 'daily', priority: 1.0 },

  // 产品核心页
  { path: '/agents', changeFrequency: 'daily', priority: 0.9 },
  { path: '/models', changeFrequency: 'daily', priority: 0.9 },
  { path: '/knowledge-base', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/knowledge-rag', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/workflows', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/mcp-projects', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/ai-generation', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/ai-skills', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/agent-kanban', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/agent-runtime', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/agent-workbench', changeFrequency: 'weekly', priority: 0.7 },

  // 内容/社区
  { path: '/articles', changeFrequency: 'daily', priority: 0.8 },
  { path: '/article', changeFrequency: 'daily', priority: 0.7 },
  { path: '/news', changeFrequency: 'daily', priority: 0.8 },
  { path: '/ai-news', changeFrequency: 'daily', priority: 0.7 },
  { path: '/ai-world', changeFrequency: 'daily', priority: 0.7 },
  { path: '/ai-career', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/announcements', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/plaza', changeFrequency: 'daily', priority: 0.7 },
  { path: '/asks', changeFrequency: 'daily', priority: 0.6 },
  { path: '/circles', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/members', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/topics', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/tags', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/blog', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/ranking', changeFrequency: 'daily', priority: 0.6 },
  { path: '/token-value', changeFrequency: 'weekly', priority: 0.6 },

  // 资源/工具
  { path: '/plugins', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/tools', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/n8n-agents', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/subagents', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/hooks', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/registry', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/openclaw', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/spec', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/context', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/memory', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/playground', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/products', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/services', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/sponsor', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/distribution', changeFrequency: 'weekly', priority: 0.5 },

  // 公司/服务
  { path: '/about', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/enterprise', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/recruitment', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/feedback', changeFrequency: 'weekly', priority: 0.5 },

  // SEO 长尾 — 产品对比(2026-07-26 极端曝光度优化)
  // 这些是高频搜索词:ihui vs dify / ihui vs coze 等,直接进 SEO 第一页
  { path: '/compare', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/compare/ihui-vs-dify', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-coze', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-fastgpt', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-n8n', changeFrequency: 'monthly', priority: 0.85 },
  // 2026-07-26 阶段 4 新增 3 个高频对比
  { path: '/compare/ihui-vs-openai-agent', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-langchain', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-copilot-studio', changeFrequency: 'monthly', priority: 0.85 },
  // 2026-07-26 阶段 5 新增 2 个现象级 AI Agent 对比
  { path: '/compare/ihui-vs-manus', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-devin', changeFrequency: 'monthly', priority: 0.85 },
  // 2026-07-26 阶段 7 新增 5 个开源生态长尾对比
  { path: '/compare/ihui-vs-autogen', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-crewai', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-llamaindex', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-flowise', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-typebot', changeFrequency: 'monthly', priority: 0.85 },
  // 2026-07-26 阶段 8 新增:国内 AI 平台 8 个(高频搜索长尾)
  { path: '/compare/ihui-vs-ernie', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-qwen-platform', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-kimi-platform', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-doubao', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-deepseek-platform', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-zhipu', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-spark', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-minimax', changeFrequency: 'monthly', priority: 0.85 },
  // 2026-07-26 阶段 8 新增:国际 SaaS 6 个(海外 AI 检索长尾)
  { path: '/compare/ihui-vs-zapier-ai', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-make', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-relevance-ai', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-stack-ai', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-wordware', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-voiceflow', changeFrequency: 'monthly', priority: 0.85 },
  // 2026-07-26 阶段 9 新增:AI 编程助手 8 个(2025-2026 现象级,搜索量极高)
  { path: '/compare/ihui-vs-claude-code', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-cursor', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-github-copilot', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-windsurf', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-bolt-new', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-replit-agent', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-lovable', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/compare/ihui-vs-v0-dev', changeFrequency: 'monthly', priority: 0.85 },

  // SEO 长尾 — 行业用例(2026-07-26 极端曝光度优化)
  // 高频场景搜索:AI 客服 / 企业知识库 / AI 代码助手 / AI 内容创作
  { path: '/use-cases', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/use-cases/customer-support', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/knowledge-base', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/code-assistant', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/content-generation', changeFrequency: 'monthly', priority: 0.8 },
  // 2026-07-26 阶段 8 新增 6 个用例页(场景化长尾覆盖)
  { path: '/use-cases/sales', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/hr-recruiting', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/market-analysis', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/product-analysis', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/it-ops', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/data-analysis', changeFrequency: 'monthly', priority: 0.8 },
  // 2026-08-02 新增 5 个 AI 场景用例页(同时是 zh-TW 路由存在的页面)
  { path: '/use-cases/ai-translation', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/ai-research', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/ai-marketing', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/ai-edu', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/use-cases/ai-design', changeFrequency: 'monthly', priority: 0.8 },

  // 文档中心(2026-07-26 立,HowTo rich results):
  // 文档中心聚合所有文档入口,提升整站文档页索引
  { path: '/docs', changeFrequency: 'weekly', priority: 0.9 },
  // 快速开始页(HowTo schema,Google Rich Results 优先)
  { path: '/docs/quickstart', changeFrequency: 'weekly', priority: 0.9 },
  // 2026-08-02 补充 16 个文档子页(原 sitemap 只列 /docs + /docs/quickstart)
  { path: '/docs/self-host', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/docs/rag', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/docs/mcp', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/docs/api', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/docs/agent', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/docs/models', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/docs/workflow', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/docs/team', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/docs/manual', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/docs/manual/getting-started', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/docs/manual/account', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/docs/manual/billing', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/docs/manual/knowledge-base', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/docs/manual/agent', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/docs/manual/ai-chat', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/docs/manual/faq', changeFrequency: 'monthly', priority: 0.7 },

  // 帮助/支持
  { path: '/help', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/developer', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/developers', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/support', changeFrequency: 'weekly', priority: 0.5 },

  // 法律
  { path: '/agreement', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/rules', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/refund', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/security-audit', changeFrequency: 'monthly', priority: 0.5 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  const zhRoutes = PAGES.map(({ path, changeFrequency, priority }) => {
    // hreflang 策略(2026-08-02 修正):
    // - 所有页面都声明 x-default(指向 zh-CN 主版本)
    // - 只有实际存在 zh-TW 路由的 5 个 use-cases 子页才声明 zh-CN + zh-TW hreflang
    // - 不再声明 en/ko/ja(对应路由文件不存在,声明会导致 AI 爬虫 404)
    const languages: Record<string, string> = {
      'x-default': `${SITE_URL}${path}`,
    }

    if (ZH_TW_PAGES.has(path)) {
      languages['zh-CN'] = `${SITE_URL}${path}`
      languages['zh-TW'] = `${SITE_URL}/zh-TW${path}`
    }

    return {
      url: `${SITE_URL}${path}`,
      lastModified,
      changeFrequency,
      priority,
      alternates: {
        languages,
      },
    }
  })

  // 英文路由追加(2026-08-02 立)
  // 5 个英文 landing page(/en、/en/agents、/en/models、/en/pricing、/en/docs)
  // 每个声明 x-default + en + zh-CN hreflang,x-default 与 zh-CN 指向中文主版本
  const enRoutes: MetadataRoute.Sitemap = EN_PAGES.map(
    ({ enPath, zhPath, changeFrequency, priority }) => ({
      url: `${SITE_URL}${enPath}`,
      lastModified,
      changeFrequency,
      priority,
      alternates: {
        languages: {
          'x-default': `${SITE_URL}${zhPath}`,
          en: `${SITE_URL}${enPath}`,
          'zh-CN': `${SITE_URL}${zhPath}`,
        },
      },
    }),
  )

  return [...zhRoutes, ...enRoutes]
}
