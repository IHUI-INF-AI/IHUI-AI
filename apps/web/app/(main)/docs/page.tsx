import type { Metadata } from 'next'

const SITE_URL = 'https://aizhs.top'

const docsJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/docs#webpage',
      url: 'https://aizhs.top/docs',
      name: '智汇 AI 文档中心 — 全栈 AI 操作系统指南',
      description:
        '智汇 AI(IHUI AI)官方文档中心:快速开始、自托管部署、API 参考、MCP 工具集成、Agent 开发、知识库 RAG、多模型调度等完整指南。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/docs#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '文档', item: 'https://aizhs.top/docs' },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': 'https://aizhs.top/docs#docs-list',
      name: '智汇 AI 文档列表',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: '快速开始(5 分钟)',
          url: 'https://aizhs.top/docs/quickstart',
          description: '5 分钟从注册到发布第一个 AI Agent',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: '自托管部署',
          url: 'https://aizhs.top/docs/self-host',
          description: 'Docker Compose / Kubernetes Helm Chart 部署指南',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'API 参考',
          url: 'https://aizhs.top/docs/api',
          description: 'REST API + Webhook + OpenAPI 3.1 规范',
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: 'MCP 工具集成',
          url: 'https://aizhs.top/docs/mcp',
          description: 'Model Context Protocol 接入指南',
        },
        {
          '@type': 'ListItem',
          position: 5,
          name: 'Agent 开发',
          url: 'https://aizhs.top/docs/agent',
          description: '可视化编排 + 模板开发 + 最佳实践',
        },
        {
          '@type': 'ListItem',
          position: 6,
          name: '知识库 RAG',
          url: 'https://aizhs.top/docs/rag',
          description: '文档解析、向量检索、BM25、知识图谱',
        },
        {
          '@type': 'ListItem',
          position: 7,
          name: '多模型调度',
          url: 'https://aizhs.top/docs/models',
          description: '统一 API 接入 100+ 模型,自动 fallback',
        },
        {
          '@type': 'ListItem',
          position: 8,
          name: '工作流编排',
          url: 'https://aizhs.top/docs/workflow',
          description: 'n8n 风格节点画布使用指南',
        },
        {
          '@type': 'ListItem',
          position: 9,
          name: '团队协作',
          url: 'https://aizhs.top/docs/team',
          description: 'RBAC、SSO、审计、积分共享',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: '文档中心 — 智汇 AI 全栈 AI 操作系统',
  description:
    '智汇 AI(IHUI AI)官方文档中心:快速开始、自托管部署、API 参考、MCP 工具集成、Agent 开发、知识库 RAG、多模型调度等完整指南。',
  alternates: {
    canonical: '/docs',
    languages: {
      'zh-CN': '/zh-cn/docs',
      'zh-TW': '/zh-tw/docs',
      en: '/en/docs',
      ko: '/ko/docs',
      ja: '/ja/docs',
      'x-default': '/docs',
    },
  },
  openGraph: {
    title: '智汇 AI 文档中心',
    description: '从快速开始到深度开发,完整覆盖智汇 AI 全部能力',
    url: `${SITE_URL}/docs`,
    type: 'website',
    images: [
      {
        url: '/images/logo.png?v=20260719-unify',
        width: 1200,
        height: 630,
        alt: '智汇 AI 文档中心',
      },
    ],
  },
}

const docSections = [
  {
    title: '快速开始',
    description: '5 分钟从注册到发布',
    icon: '🚀',
    items: [
      { name: '快速开始', href: '/docs/quickstart', desc: '5 分钟上手,在线版 + 自托管' },
    ],
  },
  {
    title: '部署与运维',
    description: '生产环境部署、监控、扩展',
    icon: '🐳',
    items: [
      { name: '自托管部署', href: '/docs/self-host', desc: 'Docker Compose + K8s Helm' },
    ],
  },
  {
    title: '核心能力',
    description: '深入理解每个模块',
    icon: '🧠',
    items: [
      { name: 'Agent 开发', href: '/docs/agent', desc: '可视化编排 + 模板开发' },
      { name: '知识库 RAG', href: '/docs/rag', desc: '向量 + BM25 + 知识图谱' },
      { name: '多模型调度', href: '/docs/models', desc: '100+ 模型统一调度' },
      { name: 'MCP 工具集成', href: '/docs/mcp', desc: '原生 MCP 协议' },
      { name: '工作流编排', href: '/docs/workflow', desc: 'n8n 风格节点画布' },
    ],
  },
  {
    title: '开发者',
    description: 'API、SDK、Webhook',
    icon: '🛠️',
    items: [
      { name: 'API 参考', href: '/docs/api', desc: 'REST API + OpenAPI 3.1' },
      { name: '团队协作', href: '/docs/team', desc: 'RBAC + SSO + 审计' },
    ],
  },
]

export default function DocsIndexPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(docsJsonLd) }}
      />

      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          📚 文档中心
        </div>
        <h1 className="text-2xl min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
          智汇 AI 文档
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          从快速开始到深度开发,完整覆盖智汇 AI 全部能力。
        </p>
      </header>

      <div className="mt-12 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2">
        {docSections.map((section) => (
          <section key={section.title} className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{section.icon}</span>
              <h2 className="text-lg font-semibold">{section.title}</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {section.description}
            </p>
            <ul className="mt-4 space-y-3">
              {section.items.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="block rounded-lg border bg-background p-3 transition-colors hover:bg-accent"
                  >
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          文档未覆盖到的问题?
          {' '}
          <a href="https://aizhs.top/faq" className="text-primary underline">查看 FAQ</a>
          {' 或 '}
          <a href="mailto:support@aizhs.top" className="text-primary underline">联系技术支持</a>
        </p>
      </div>
    </main>
  )
}
