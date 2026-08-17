import type { Metadata } from 'next'

const SITE_URL = 'https://aizhs.top'

/**
 * Quickstart 页面 JSON-LD(2026-07-26 立,SEO 强化):
 * - HowTo schema:Google Rich Results 直接显示"如何开始"步骤卡
 * - SoftwareApplication:与首页一致,产品实体强化
 * - BreadcrumbList:面包屑结构化,提升 SERP 显示
 * - FAQPage:嵌入 quickstart FAQ,长尾搜索覆盖
 */
const quickstartJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/docs/quickstart#howto',
      name: 'How to Get Started with IHUI AI in 5 Minutes',
      description:
        'IHUI AI is an open-source full-stack AI operating system. Sign up, browse the Agent marketplace, configure a model, and publish to 6 clients — all in under 5 minutes.',
      totalTime: 'PT5M',
      estimatedCost: {
        '@type': 'MonetaryAmount',
        currency: 'CNY',
        value: '0',
      },
      tool: [
        { '@type': 'HowToTool', name: 'Web browser' },
        { '@type': 'HowToTool', name: 'Docker (optional, for self-hosting)' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: '注册账号',
          text: '访问 https://aizhs.top/sso/register,使用邮箱或 GitHub 登录,无需信用卡,注册即得 1000 积分。',
          url: 'https://aizhs.top/sso/register',
          image: 'https://aizhs.top/images/logo.png',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: '浏览 Agent 市场',
          text: '打开 Agent 市场(https://aizhs.top/agents),从 200+ 模板中选择一个适合你场景的 Agent(如智能客服、代码审查、内容创作)。',
          url: 'https://aizhs.top/agents',
          image: 'https://aizhs.top/images/logo.png',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: '配置 AI 模型',
          text: '在模型管理页面(https://aizhs.top/models)选择 AI 模型(支持 OpenAI GPT-4o、Claude 4、Gemini 2.5、通义千问、DeepSeek 等 100+ 主流模型),或使用智汇 AI 统一积分。',
          url: 'https://aizhs.top/models',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: '上传知识库(可选)',
          text: '在知识库页面(https://aizhs.top/knowledge-base)上传 PDF/Word/Markdown 文档,系统自动向量化+BM25 混合检索,支持中文友好分词和知识图谱。',
          url: 'https://aizhs.top/knowledge-base',
        },
        {
          '@type': 'HowToStep',
          position: 5,
          name: '一键发布到六端',
          text: '在 Agent 编排页面点击"发布",选择目标客户端(Web / 桌面 / 小程序 / 浏览器插件 / React Native / CLI),系统自动构建并部署,所有端共享同一套代码。',
          url: 'https://aizhs.top/agent-workbench',
        },
      ],
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://aizhs.top/docs/quickstart#software',
      name: 'IHUI AI',
      alternateName: '智汇 AI',
      applicationCategory: 'DeveloperApplication',
      applicationSubCategory: 'AI Platform / Agent Builder',
      operatingSystem: 'Web, Windows, macOS, Linux, iOS, Android',
      url: 'https://aizhs.top/docs/quickstart',
      downloadUrl: 'https://github.com/ihui-ai/ihui-ai',
      softwareVersion: '2026.07',
      datePublished: '2024-01-01',
      dateModified: '2026-07-26',
      author: { '@id': 'https://aizhs.top/#organization' },
      publisher: { '@id': 'https://aizhs.top/#organization' },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'CNY',
        availability: 'https://schema.org/InStock',
      },
      featureList: [
        'Agent Marketplace (200+ templates)',
        'Knowledge-base RAG (vector + BM25 + knowledge graph)',
        'Multi-Model Unified Dispatch (100+ LLMs)',
        'MCP Tool Protocol (native)',
        'Workflow Orchestration (n8n-style)',
        'Six-Client Distribution (Web/Desktop/Mini Program/Extension/RN/CLI)',
        'Team Collaboration (RBAC, SSO, audit)',
        'Apache 2.0 open source',
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/docs/quickstart#breadcrumb',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: '首页',
          item: 'https://aizhs.top',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: '文档',
          item: 'https://aizhs.top/docs',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: '快速开始',
          item: 'https://aizhs.top/docs/quickstart',
        },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://aizhs.top/docs/quickstart#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'IHUI AI 适合什么人使用?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'IHUI AI 适合:AI 应用开发者(搭建/分发/变现 Agent)、企业 IT(私有化 AI 能力中心,数据不出域)、团队负责人(多用户协作,统一知识库,统一计费)、独立开发者/创业者(发布 Agent 到市场,被动收入)、教育培训(课程 Agent,7×24 答疑)、客服团队(AI 客服 + 人工协同)、内容创作者(多模态生成,统一积分池)。',
          },
        },
        {
          '@type': 'Question',
          name: 'IHUI AI 和 Dify、Coze、FastGPT、n8n 有什么区别?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Dify 偏 Web 端 LLM 应用开发;Coze 是字节出品的闭源 Agent 平台;FastGPT 专注知识库 Q&A;n8n 偏工作流自动化。IHUI AI 是六端同源的全栈 AI 操作系统,集成 Agent 市场 + 知识库 RAG + 多模型调度 + MCP + 工作流 + 团队协作 + 积分计费,Apache 2.0 开源,支持私有化部署。',
          },
        },
        {
          '@type': 'Question',
          name: '需要付费吗?有免费版吗?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '有免费版。注册即得 1000 积分,全模型免费试用,无需信用卡。Pro 版 ¥49/月,提供 10000 积分 + 优先队列 + 高级 RAG。Team 版 ¥299/月/人,提供共享积分池 + RBAC + 审计日志。企业版支持私有化部署,定制报价。',
          },
        },
        {
          '@type': 'Question',
          name: '支持私有化部署吗?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '支持。Apache 2.0 开源,提供 Docker Compose 单机版(5 分钟部署)+ Kubernetes Helm Chart 多节点版。最低 2 核 CPU / 4GB RAM / 20GB 磁盘即可运行,GPU 非必需(默认调用云端 API,本地模型可接 Ollama/vLLM)。',
          },
        },
        {
          '@type': 'Question',
          name: '数据安全吗?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '托管版:数据存储于阿里云(中国大陆),TLS 1.3 传输加密 + AES-256 静态加密,符合中国《数据安全法》《个人信息保护法》、欧盟 GDPR、加州 CCPA。自托管版:100% 数据在客户自己的基础设施中,智汇 AI 员工无访问权限。所有客户数据均不用于训练任何模型。',
          },
        },
        {
          '@type': 'Question',
          name: '支持哪些 AI 模型?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '支持 100+ 主流模型:OpenAI(GPT-4o/o1/GPT-4.1/GPT-5)、Anthropic(Claude Opus 4 / Sonnet 4 / Haiku 3.5)、Google(Gemini 2.5 Pro/Flash)、阿里通义千问(Qwen-Max/Plus)、DeepSeek(V3/R1)、智谱(GLM-4-Plus/Flash)、百度文心(ERNIE-4.0)、字节豆包(Doubao-Pro)、月之暗面 Kimi、本地 Ollama/LM Studio/vLLM,以及任何 OpenAI 兼容端点。',
          },
        },
        {
          '@type': 'Question',
          name: '支持哪些客户端?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '六大客户端同源:Web(Next.js 16,主入口)、桌面(Tauri 2,原生应用,离线支持)、小程序(Taro 4,支持微信/支付宝/抖音/百度)、浏览器插件(WXT MV3,工具栏弹窗)、React Native(Expo,iOS + Android)、CLI(Node.js/Bun,脚本/CI-CD 自动化)。一套代码,一次发布,全端触达。',
          },
        },
        {
          '@type': 'Question',
          name: 'MCP 工具协议支持吗?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '原生支持。Model Context Protocol(MCP)是 Anthropic 主导的 AI 工具连接标准,IHUI AI 是首批原生支持的 AI 平台之一。内置 100+ 预置 MCP Server(文件系统、GitHub、Slack、数据库、Notion、Linear、Salesforce 等),任何 MCP Server 可一键接入,企业内部系统也可封装为 MCP Server 给 Agent 使用。',
          },
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: '5 分钟快速开始 — 智汇 AI 全栈 AI 操作系统',
  description:
    '5 分钟上手智汇 AI(IHUI AI):注册 → 浏览 Agent 市场 → 配置模型 → 上传知识库 → 一键发布到 Web/桌面/小程序/插件/移动/CLI 六端。Apache 2.0 开源,支持私有化部署,100+ 模型,200+ Agent 模板。',
  alternates: {
    canonical: '/docs/quickstart',
    languages: {
      'zh-CN': '/zh-cn/docs/quickstart',
      'zh-TW': '/zh-tw/docs/quickstart',
      en: '/en/docs/quickstart',
      ko: '/ko/docs/quickstart',
      ja: '/ja/docs/quickstart',
      'x-default': '/docs/quickstart',
    },
  },
  openGraph: {
    title: '5 分钟快速开始 — 智汇 AI',
    description:
      '5 分钟从注册到发布第一个 AI Agent。Apache 2.0 开源,100+ 模型,六端同源。',
    url: `${SITE_URL}/docs/quickstart`,
    type: 'article',
    images: [
      {
        url: '/images/logo.png?v=20260719-unify',
        width: 1200,
        height: 630,
        alt: 'IHUI AI 快速开始',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '5 分钟快速开始 — 智汇 AI',
    description: '5 分钟从注册到发布第一个 AI Agent。',
    images: ['/images/logo.png?v=20260719-unify'],
  },
}

export default function QuickstartPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(quickstartJsonLd) }}
      />

      {/* Hero */}
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span>📘</span>
          快速开始
        </div>
        <h1 className="text-2xl min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
          5 分钟上手智汇 AI
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          从注册到发布第一个 AI Agent,只需 5 步。
          智汇 AI 是开源的全栈 AI 操作系统,Apache 2.0 协议,支持私有化部署。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-sm">
          <a
            href="#step-1"
            className="rounded-lg border bg-card px-4 py-2 hover:bg-accent"
          >
            🚀 在线版 5 步开始
          </a>
          <a
            href="#self-host"
            className="rounded-lg border bg-card px-4 py-2 hover:bg-accent"
          >
            🐳 自托管 5 分钟部署
          </a>
        </div>
      </header>

      {/* 在线版 5 步 */}
      <section id="step-1" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">
          方式一:在线版(5 分钟上手)
        </h2>

        <ol className="space-y-6">
          <li className="rounded-2xl border bg-card p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold">
                1
              </span>
              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="text-lg font-semibold">注册账号</h3>
                <p className="text-xs text-muted-foreground">
                  访问
                  {' '}
                  <a href="https://aizhs.top/sso/register" className="text-primary underline">
                    https://aizhs.top/sso/register
                  </a>
                  ,使用邮箱或 GitHub/Google/微信 登录,无需信用卡,注册即得 1000 积分。
                </p>
                <p className="text-xs text-muted-foreground">
                  💡 企业用户支持 SSO(SAML 2.0 / OIDC)和私有化部署,联系
                  {' '}
                  <a href="mailto:contact@aizhs.top" className="text-primary underline">contact@aizhs.top</a>
                </p>
              </div>
            </div>
          </li>

          <li className="rounded-2xl border bg-card p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold">
                2
              </span>
              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="text-lg font-semibold">浏览 Agent 市场</h3>
                <p className="text-sm text-muted-foreground">
                  打开
                  {' '}
                  <a href="https://aizhs.top/agents" className="text-primary underline">Agent 市场</a>
                  ,从 200+ 模板中选择一个适合你场景的 Agent:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                  <li>智能客服 Agent — 7×24 在线,统一知识库</li>
                  <li>代码审查 Agent — PR 自动审查,安全漏洞检测</li>
                  <li>内容创作 Agent — 多模态生成(文/图/音/视频)</li>
                  <li>数据分析 Agent — SQL 自动生成 + 可视化</li>
                  <li>企业知识库 Agent — 内部文档问答</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  💡 点击「Use」即可一键 fork 到你的工作区,无需从零搭建。
                </p>
              </div>
            </div>
          </li>

          <li className="rounded-2xl border bg-card p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold">
                3
              </span>
              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="text-lg font-semibold">配置 AI 模型</h3>
                <p className="text-sm text-muted-foreground">
                  在
                  {' '}
                  <a href="https://aizhs.top/models" className="text-primary underline">模型管理</a>
                  页面选择 AI 模型,支持 100+ 主流模型:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                  <li><strong>OpenAI</strong>:GPT-4o、o1、o3-mini、GPT-4.1、GPT-5</li>
                  <li><strong>Anthropic</strong>:Claude Opus 4、Sonnet 4、Haiku 3.5</li>
                  <li><strong>Google</strong>:Gemini 2.5 Pro/Flash</li>
                  <li><strong>国产</strong>:通义千问、DeepSeek、智谱、文心、豆包、Kimi</li>
                  <li><strong>本地</strong>:Ollama、LM Studio、vLLM</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  💡 支持 OpenAI 兼容 API,任何第三方模型都可接入。系统支持自动 fallback 和成本路由。
                </p>
              </div>
            </div>
          </li>

          <li className="rounded-2xl border bg-card p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold">
                4
              </span>
              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="text-lg font-semibold">上传知识库(可选)</h3>
                <p className="text-sm text-muted-foreground">
                  在
                  {' '}
                  <a href="https://aizhs.top/knowledge-base" className="text-primary underline">知识库</a>
                  页面上传文档,系统自动处理:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                  <li>支持格式:PDF、Word、Excel、Markdown、HTML、TXT、CSV</li>
                  <li>混合检索:向量 + BM25 + 知识图谱</li>
                  <li>中文友好分词(jieba、BPE)</li>
                  <li>自动实体识别和关系抽取</li>
                </ul>
              </div>
            </div>
          </li>

          <li className="rounded-2xl border bg-card p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold">
                5
              </span>
              <div className="flex-1 min-w-0 space-y-2">
                <h3 className="text-lg font-semibold">一键发布到六端</h3>
                <p className="text-sm text-muted-foreground">
                  在 Agent 编排页面点击「发布」,选择目标客户端:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                  <li>🌐 <strong>Web</strong> — Next.js 16,主入口</li>
                  <li>🖥️ <strong>桌面</strong> — Tauri 2,原生应用,离线支持</li>
                  <li>📱 <strong>小程序</strong> — Taro 4,支持微信/支付宝/抖音/百度</li>
                  <li>🧩 <strong>浏览器插件</strong> — WXT MV3,工具栏弹窗</li>
                  <li>📲 <strong>移动端</strong> — React Native,iOS + Android</li>
                  <li>⌨️ <strong>CLI</strong> — Node.js/Bun,脚本和 CI/CD</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  💡 一套代码,六端同发。所有客户端共享 React 组件库 + API 契约 + 业务逻辑。
                </p>
              </div>
            </div>
          </li>
        </ol>
      </section>

      {/* 自托管 */}
      <section id="self-host" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">
          方式二:自托管(5 分钟 Docker 部署)
        </h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            适合需要数据私有化、定制化、合规审计的企业用户。
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            <code>{`# 1. 克隆仓库
git clone https://github.com/ihui-ai/ihui-ai.git
cd ihui-ai

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env: DATABASE_URL / REDIS_URL / OPENAI_API_KEY 等

# 3. 一键启动(Docker Compose)
docker compose up -d

# 4. 访问
open http://localhost:8801`}</code>
          </pre>
          <div className="rounded-lg border bg-background p-4 text-sm">
            <p className="font-semibold">最低硬件要求</p>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-muted-foreground">
              <li>CPU:2 核</li>
              <li>内存:4 GB RAM</li>
              <li>磁盘:20 GB</li>
              <li>GPU:不需要(LLM 推理默认走云端 API)</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              💡 推荐配置 4 核 / 8GB / 50GB SSD。Kubernetes 高可用部署见
              {' '}
              <a href="https://aizhs.top/docs/self-host" className="text-primary underline">自托管部署指南</a>
              。
            </p>
          </div>
        </div>
      </section>

      {/* 下一步 */}
      <section className="mt-16 rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-5 text-center min-[768px]:p-8">
        <h2 className="text-2xl font-bold tracking-tight">下一步</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
          上手后,深入探索智汇 AI 的更多能力。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://aizhs.top/agents"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            浏览 Agent 市场
          </a>
          <a
            href="https://aizhs.top/docs/api"
            className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            API 文档
          </a>
          <a
            href="https://aizhs.top/docs/mcp"
            className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            MCP 工具集成
          </a>
          <a
            href="https://aizhs.top/pricing"
            className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            查看定价
          </a>
        </div>
      </section>
    </main>
  )
}
