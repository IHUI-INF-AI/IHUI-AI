import type { Metadata } from 'next'

const SITE_URL = 'https://aizhs.top'

const mcpJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'TechArticle',
      '@id': 'https://aizhs.top/docs/mcp#article',
      headline: '智汇 AI MCP 工具集成指南',
      description: 'Model Context Protocol 原生支持,100+ 预置 MCP Server,自定义 Server 开发,企业内部系统集成。',
      author: { '@id': 'https://aizhs.top/#organization' },
      publisher: { '@id': 'https://aizhs.top/#organization' },
      datePublished: '2024-01-01',
      dateModified: '2026-08-01',
      proficiencyLevel: 'Expert',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/docs/mcp#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '文档', item: 'https://aizhs.top/docs' },
        { '@type': 'ListItem', position: 3, name: 'MCP 工具集成', item: 'https://aizhs.top/docs/mcp' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'MCP 工具集成 — 智汇 AI 全栈 AI 操作系统',
  description:
    'Model Context Protocol 原生支持。100+ 预置 MCP Server(GitHub/Slack/Notion/数据库/文件系统),自定义 Server 开发 SDK(TypeScript/Python),企业内部系统集成最佳实践。',
  alternates: {
    canonical: '/docs/mcp',
    languages: {
      'zh-CN': '/zh-cn/docs/mcp',
      'zh-TW': '/zh-tw/docs/mcp',
      en: '/en/docs/mcp',
      ko: '/ko/docs/mcp',
      ja: '/ja/docs/mcp',
      'x-default': '/docs/mcp',
    },
  },
  openGraph: {
    title: 'MCP 工具集成 — 智汇 AI',
    description: 'Anthropic MCP 协议原生支持,100+ 预置 Server + 自定义开发。',
    url: `${SITE_URL}/docs/mcp`,
    type: 'article',
  },
}

export default function McpDocsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mcpJsonLd) }}
      />

      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span>🔌</span>
          MCP 工具集成
        </div>
        <h1 className="text-2xl min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
          Model Context Protocol 集成
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          智汇 AI 是首批原生支持 MCP 的 AI 平台之一。100+ 预置 Server 即插即用,
          企业内部系统可封装为 MCP Server 给 Agent 使用。
        </p>
      </header>

      {/* 什么是 MCP */}
      <section id="what-is-mcp" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">什么是 MCP?</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            <strong>Model Context Protocol(MCP)</strong>是 Anthropic 主导的 AI 工具连接开放标准,
            让 AI 模型能够安全地调用外部工具、读取外部数据、执行外部操作。
          </p>
          <p className="text-sm text-muted-foreground">
            类比:USB-C 让硬件设备即插即用,MCP 让 AI 工具即插即用。
          </p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li><strong>标准化</strong>:统一协议,任何 MCP Server 可接入任何 MCP Client</li>
            <li><strong>安全</strong>:权限粒度可控,用户显式授权</li>
            <li><strong>可组合</strong>:多个 Server 可同时挂载,Agent 按需调用</li>
            <li><strong>跨模型</strong>:不绑定特定 LLM,GPT/Claude/Gemini/Qwen 通用</li>
          </ul>
        </div>
      </section>

      {/* 预置 Server */}
      <section id="preset-servers" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">100+ 预置 MCP Server</h2>
        <div className="grid gap-4 min-[768px]:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">📁 文件与存储</h3>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-sm text-muted-foreground">
              <li>本地文件系统(读/写/搜索)</li>
              <li>S3 / OSS / MinIO 对象存储</li>
              <li>Google Drive / OneDrive / Dropbox</li>
              <li>Notion / Obsidian / Logseq</li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">💻 开发工具</h3>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-sm text-muted-foreground">
              <li>GitHub(GitLab/Bitbucket)— PR/Issue/代码搜索</li>
              <li>GitLab CI / GitHub Actions</li>
              <li>Linear / Jira / Asana — 项目管理</li>
              <li>Sentry / Datadog — 监控告警</li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">💬 通讯协作</h3>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-sm text-muted-foreground">
              <li>Slack / Discord / Telegram</li>
              <li>飞书 / 钉钉 / 企业微信</li>
              <li>Email(IMAP/SMTP)</li>
              <li>Zoom / Google Meet</li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">🗄️ 数据库</h3>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-sm text-muted-foreground">
              <li>PostgreSQL / MySQL / SQLite</li>
              <li>MongoDB / Redis / Elasticsearch</li>
              <li>ClickHouse / DuckDB(分析型)</li>
              <li>Salesforce / HubSpot(CRM)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 接入预置 Server */}
      <section id="use-preset" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">接入预置 Server</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            在 Agent 编排页面 → 工具 → 添加 MCP Server,选择预置项,填入凭据即可。
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            <code>{`# 以 GitHub MCP Server 为例
# 1. 在 GitHub 创建 Personal Access Token
#    Settings → Developer settings → PAT (classic) → 勾选 repo, read:org

# 2. 在智汇 AI 后台填入
Server: GitHub MCP
Token: ghp_xxxxxxxxxxxx

# 3. Agent 自动获得能力:
# - 搜索代码 / 读取文件 / 创建 PR
# - 列出 Issue / 创建 Issue / 评论
# - 查看仓库统计 / 提交历史

# 4. 在对话中直接调用
用户: "帮我看一下 facebook/react 最近的 Issue 有哪些是 bug"
Agent: [调用 GitHub MCP] 找到 23 个 bug 标签的 Issue...`}</code>
          </pre>
        </div>
      </section>

      {/* 自定义 Server */}
      <section id="custom-server" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">开发自定义 MCP Server</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            企业内部系统(ERP/OA/CRM)可封装为 MCP Server,让 Agent 安全调用。
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            <code>{`# TypeScript SDK
npm create mcp-server@latest my-server

# Python SDK
pip install mcp
mcp create my-server`}</code>
          </pre>

          <p className="text-sm font-semibold pt-2">示例:查询订单的 MCP Server(TypeScript)</p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            <code>{`import { McpServer } from '@modelcontextprotocol/sdk'
import { z } from 'zod'

const server = new McpServer({ name: 'order-query', version: '1.0.0' })

server.tool(
  'get_order',
  { orderId: z.string() },
  async ({ orderId }) => {
    const order = await db.orders.findById(orderId)
    return {
      content: [
        { type: 'text', text: JSON.stringify(order, null, 2) }
      ]
    }
  }
)

server.tool(
  'list_orders',
  { status: z.enum(['pending', 'paid', 'shipped']).optional() },
  async ({ status }) => {
    const orders = await db.orders.findMany({ where: { status } })
    return { content: [{ type: 'text', text: JSON.stringify(orders) }] }
  }
)

await server.connect()`}</code>
          </pre>

          <div className="rounded-lg border bg-background p-4 text-sm">
            <p className="font-semibold">部署方式</p>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-muted-foreground">
              <li><strong>stdio</strong>:本地运行,Agent 通过子进程调用(开发期)</li>
              <li><strong>SSE</strong>:HTTP Server,Agent 远程调用(生产)</li>
              <li><strong>WebSocket</strong>:长连接,适合实时推送</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 安全 */}
      <section id="security" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">安全与权限</h2>
        <div className="rounded-2xl border bg-card p-6">
          <ul className="ml-4 list-disc space-y-2 text-sm text-muted-foreground">
            <li><strong>用户显式授权</strong>:Agent 调用工具前,用户必须在 UI 点击允许(除非标记为 trusted)</li>
            <li><strong>权限粒度</strong>:可限制 Server 只读 / 只写 / 特定资源</li>
            <li><strong>审计日志</strong>:所有工具调用记录到 audit_logs,可追溯</li>
            <li><strong>凭据加密</strong>:API Key / Token 用 AES-256-GCM 加密存储</li>
            <li><strong>沙箱隔离</strong>:文件系统 / Shell 类工具有沙箱限制路径</li>
          </ul>
        </div>
      </section>

      <section className="mt-16 rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-5 text-center min-[768px]:p-8">
        <h2 className="text-2xl font-bold tracking-tight">下一步</h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href="/docs/agent" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Agent 开发</a>
          <a href="/docs/workflow" className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent">工作流编排</a>
          <a href="/docs/api" className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent">API 参考</a>
        </div>
      </section>
    </main>
  )
}
