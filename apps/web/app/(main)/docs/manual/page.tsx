import type { Metadata } from 'next'

const SITE_URL = 'https://aizhs.top'

const manualJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'ItemList',
      '@id': 'https://aizhs.top/docs/manual#list',
      name: '智汇 AI 使用说明手册目录',
      description:
        '面向终端用户的智汇 AI 使用说明手册,从注册登录到 AI 对话、Agent 使用、知识库、积分订阅、账户设置、常见问题全流程图文教程。',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '开始使用', url: 'https://aizhs.top/docs/manual/getting-started' },
        { '@type': 'ListItem', position: 2, name: 'AI 对话', url: 'https://aizhs.top/docs/manual/ai-chat' },
        { '@type': 'ListItem', position: 3, name: '使用 Agent', url: 'https://aizhs.top/docs/manual/agent' },
        { '@type': 'ListItem', position: 4, name: '知识库', url: 'https://aizhs.top/docs/manual/knowledge-base' },
        { '@type': 'ListItem', position: 5, name: '积分与订阅', url: 'https://aizhs.top/docs/manual/billing' },
        { '@type': 'ListItem', position: 6, name: '账户设置', url: 'https://aizhs.top/docs/manual/account' },
        { '@type': 'ListItem', position: 7, name: '常见问题', url: 'https://aizhs.top/docs/manual/faq' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/docs/manual#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '文档', item: 'https://aizhs.top/docs' },
        { '@type': 'ListItem', position: 3, name: '使用说明手册', item: 'https://aizhs.top/docs/manual' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: '使用说明手册 — 智汇 AI 文档',
  description:
    '智汇 AI 使用说明手册(面向终端用户):注册登录、界面导览、AI 对话、Agent 使用、知识库、积分订阅、账户设置、常见问题图文教程。',
  alternates: {
    canonical: '/docs/manual',
    languages: {
      'zh-CN': '/zh-cn/docs/manual',
      'zh-TW': '/zh-tw/docs/manual',
      en: '/en/docs/manual',
      ko: '/ko/docs/manual',
      ja: '/ja/docs/manual',
      'x-default': '/docs/manual',
    },
  },
  openGraph: {
    title: '使用说明手册 — 智汇 AI',
    description: '面向终端用户的图文教程,7 章覆盖全部常用功能。',
    url: `${SITE_URL}/docs/manual`,
    type: 'article',
    images: [{ url: '/images/logo.png?v=20260719-unify', width: 1200, height: 630, alt: '智汇 AI 使用说明手册' }],
  },
}

const chapters = [
  {
    num: '01',
    href: '/docs/manual/getting-started',
    title: '开始使用',
    desc: '注册账号、登录、界面导览、首次对话,3 分钟上手。',
    icon: '🚀',
  },
  {
    num: '02',
    href: '/docs/manual/ai-chat',
    title: 'AI 对话',
    desc: '如何与 AI 对话、上传文件、切换模型、查看历史、分享对话。',
    icon: '💬',
  },
  {
    num: '03',
    href: '/docs/manual/agent',
    title: '使用 Agent',
    desc: '从市场选用 Agent、收藏、定制提示词、发布到自己的工作台。',
    icon: '🤖',
  },
  {
    num: '04',
    href: '/docs/manual/knowledge-base',
    title: '知识库',
    desc: '上传文档、检索测试、把知识库挂载到 Agent,让 AI 懂你的业务。',
    icon: '📚',
  },
  {
    num: '05',
    href: '/docs/manual/billing',
    title: '积分与订阅',
    desc: '积分消耗规则、套餐对比、充值、发票、共享积分池。',
    icon: '💰',
  },
  {
    num: '06',
    href: '/docs/manual/account',
    title: '账户设置',
    desc: '个人资料、安全设置、API Key、通知偏好、注销账号。',
    icon: '⚙️',
  },
  {
    num: '07',
    href: '/docs/manual/faq',
    title: '常见问题',
    desc: '登录失败、积分异常、模型不可用、数据导出等高频问答。',
    icon: '❓',
  },
]

export default function ManualIndexPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(manualJsonLd) }}
      />

      {/* Hero */}
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span>📖</span>
          使用说明手册
        </div>
        <h1 className="text-2xl min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
          智汇 AI 使用说明手册
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          面向终端用户的图文教程,7 章覆盖注册、对话、Agent、知识库、积分、账户、FAQ。
          无需技术背景,跟着步骤操作即可。
        </p>
      </header>

      {/* 章节列表 */}
      <ol className="mt-12 space-y-3">
        {chapters.map((ch) => (
          <li key={ch.href}>
            <a
              href={ch.href}
              className="group flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent min-[768px]:p-6"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl min-[768px]:h-14 min-[768px]:w-14">
                {ch.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">第 {ch.num} 章</span>
                </div>
                <h2 className="text-base font-semibold min-[768px]:text-lg">{ch.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground min-[768px]:text-sm">{ch.desc}</p>
              </div>
              <span className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1">→</span>
            </a>
          </li>
        ))}
      </ol>

      {/* 底部导航 */}
      <div className="mt-12 flex flex-wrap items-center justify-between gap-3">
        <a
          href="/docs"
          className="rounded-lg border bg-card px-4 py-2 text-sm hover:bg-accent"
        >
          ← 返回文档中心
        </a>
        <a
          href="/docs/manual/getting-started"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          开始阅读 →
        </a>
      </div>
    </main>
  )
}
