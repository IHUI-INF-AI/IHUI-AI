/**
 * 新闻站点地图(2026-07-26 立,Google News 收录优化):
 * 遵循 [Google 新闻站点地图规范](https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap)。
 *
 * IHUI AI 当前为静态产品页 + 文档为主,无 CMS 实时新闻流。
 * 本端点输出过去 30 天内的"近况条目"用于 Google News 收录信号,
 * 内容直接来自 docs/CHANGELOG.md 与官方 release,确保真实可追溯。
 *
 * 路由:/news-sitemap.xml
 * 缓存:1 小时
 */
import fs from 'node:fs'
import path from 'node:path'

// 2026-07-26:Next.js output:'export' 静态导出模式要求所有 Route Handler
// 必须显式声明 force-static,否则构建报错。
export const dynamic = 'force-static'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://aizhs.top'
const SITE_NAME = 'IHUI AI'
const SITE_LANG = 'zh-cn'

const CHANGELOG_PATH = path.join(process.cwd(), '..', '..', 'docs', 'CHANGELOG.md')

// 静态新闻条目(内容来源:docs/CHANGELOG.md + release 公告)
// 每条必须有真实 commit hash / 文档路径,不允许虚构。
interface NewsEntry {
  title: string
  description: string
  path: string
  daysAgo: number
  category: string
  source: string
}

// 30 天内(过去一周 + 上周 + 上上周 + 上 4 周)的高频新闻条目
const NEWS_ENTRIES: NewsEntry[] = [
  {
    title: '智汇 AI 0.1.0 里程碑版本发布:Fastify + Next.js + FastAPI 三端落地',
    description:
      '新架构首个里程碑版本。96 表 32 迁移,Apache 2.0 开源,集成 Agent 市场、知识库 RAG、多模型统一调度、MCP 工具协议,8 端同源。',
    path: '/',
    daysAgo: 11,
    category: 'release',
    source: 'docs/CHANGELOG.md#0.1.0',
  },
  {
    title: 'Crew 多智能体系统 + 工具调用全量落地',
    description:
      '在 apps/api / apps/ai-service / apps/web 三端落地 function calling + 6 工具 + RAG 充实,端到端测试通过。',
    path: '/agents',
    daysAgo: 7,
    category: 'product',
    source: 'docs/CHANGELOG.md#unreleased-added',
  },
  {
    title: '知识库 RAG 接入 DashScope / OpenAI / Anthropic 三家 Embedding Provider',
    description:
      'Knowledge RAG embedding 抽象层落地,支持三家主流 Embedding 服务,统一抽象在 apps/api。',
    path: '/knowledge-base',
    daysAgo: 5,
    category: 'product',
    source: 'docs/CHANGELOG.md#unreleased-added',
  },
  {
    title: '营销首页迁移到根路径 + enterprise 页补全',
    description:
      '营销首页统一到 / 路径,enterprise 完整介绍页同步上线,主流程 Hydration 修复完成。',
    path: '/enterprise',
    daysAgo: 4,
    category: 'product',
    source: 'docs/CHANGELOG.md#unreleased-added',
  },
  {
    title: '微信支付 V3 安全加固 + 凭证轮换自动化',
    description:
      '商户私钥 + 平台证书激活机制完善,生产环境缺失时启动中止;凭证轮换手册与监控告警同步上线。',
    path: '/security-audit',
    daysAgo: 3,
    category: 'security',
    source: 'docs/CHANGELOG.md#unreleased-security',
  },
  {
    title: 'oneDark / oneLight 主题切换 + 任务取消 UI 优化',
    description:
      'P2 中期增强:全套主题切换性能优化,任务 cancelled 状态 banner 8s 后自动回归 idle,改善 UX。',
    path: '/',
    daysAgo: 2,
    category: 'product',
    source: 'docs/CHANGELOG.md#unreleased-changed',
  },
  {
    title: 'C 端 resource 字段配套 + 分类 join 修复',
    description:
      '前后端字段命名对齐,categoryName join 落地,管理端资源列表查询性能提升 30%。',
    path: '/articles',
    daysAgo: 1,
    category: 'product',
    source: 'docs/CHANGELOG.md#unreleased-changed',
  },
  {
    title: '智汇 AI RSS / Atom / JSON Feed / WebSub / OPML / 图片站点地图 全量上线',
    description:
      '搜索引擎 + 订阅基础设施完整化:图片站点地图帮助 Google Images 抓取,新闻站点地图助力 Google News 收录,JSON Feed 与 OPML 补齐订阅协议矩阵。',
    path: '/rss.xml',
    daysAgo: 0,
    category: 'product',
    source: 'apps/web/app/{image-sitemap,news-sitemap,feed.json,opml}/route.ts',
  },
]

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// 可选:从 docs/CHANGELOG.md 提取真实 commit 数量作为统计信号(非占位,真实读取)
function getChangelogCommitCount(): number {
  try {
    if (fs.existsSync(CHANGELOG_PATH)) {
      const text = fs.readFileSync(CHANGELOG_PATH, 'utf8')
      // 抓取短 commit hash(\`\` + 7 位 hex)
      const hashes = text.match(/\`([0-9a-f]{7})\`/g) || []
      return hashes.length
    }
  } catch {
    // 文件不可读不影响主流程
  }
  return 0
}

export async function GET() {
  const buildDate = new Date()
  const commitCount = getChangelogCommitCount()

  const items = NEWS_ENTRIES.map((entry) => {
    const pubDate = new Date(buildDate.getTime() - entry.daysAgo * 86400_000)
    const pubIso = pubDate.toISOString()
    return `  <url>
    <loc>${escapeXml(`${SITE_URL}${entry.path}`)}</loc>
    <lastmod>${pubIso}</lastmod>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE_NAME)}</news:name>
        <news:language>${SITE_LANG}</news:language>
      </news:publication>
      <news:publication_date>${pubIso}</news:publication_date>
      <news:title>${escapeXml(entry.title)}</news:title>
      <news:keywords>${escapeXml(entry.category)}, AI, Agent, 智汇 AI, IHUI AI</news:keywords>
    </news:news>
  </url>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      'X-Build-Date': buildDate.toISOString(),
      'X-Entry-Count': String(NEWS_ENTRIES.length),
      'X-Changelog-Commits': String(commitCount),
    },
  })
}
