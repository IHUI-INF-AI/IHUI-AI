import type { Metadata } from 'next'

const SITE_URL = 'https://aizhs.top'

const apiJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'TechArticle',
      '@id': 'https://aizhs.top/docs/api#article',
      headline: '智汇 AI REST API 参考',
      description: 'REST API + Webhook + OpenAPI 3.1 规范完整参考,含认证、速率限制、错误码、SDK。',
      author: { '@id': 'https://aizhs.top/#organization' },
      publisher: { '@id': 'https://aizhs.top/#organization' },
      datePublished: '2024-01-01',
      dateModified: '2026-08-01',
      proficiencyLevel: 'Expert',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/docs/api#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '文档', item: 'https://aizhs.top/docs' },
        { '@type': 'ListItem', position: 3, name: 'API 参考', item: 'https://aizhs.top/docs/api' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'API 参考 — 智汇 AI 全栈 AI 操作系统',
  description:
    'REST API + Webhook + OpenAPI 3.1 规范。含认证(JWT + API Key)、速率限制、错误码、分页、流式响应、SDK(JavaScript/Python/Go)。',
  alternates: {
    canonical: '/docs/api',
    languages: {
      'zh-CN': '/zh-cn/docs/api',
      'zh-TW': '/zh-tw/docs/api',
      en: '/en/docs/api',
      ko: '/ko/docs/api',
      ja: '/ja/docs/api',
      'x-default': '/docs/api',
    },
  },
  openGraph: {
    title: 'API 参考 — 智汇 AI',
    description: 'REST API + Webhook + OpenAPI 3.1,SDK 全语言覆盖。',
    url: `${SITE_URL}/docs/api`,
    type: 'article',
  },
}

export default function ApiDocsPage() {
  return (
    <div className="space-y-4 px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(apiJsonLd) }}
      />

      {/* Base URL + 认证 */}
      <section id="auth" className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">基础信息</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div>
            <p className="text-sm font-semibold">Base URL</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              <code>{`https://api.aizhs.top/v1          # 生产
https://api-staging.aizhs.top/v1  # 预发
http://localhost:3001/v1          # 自托管`}</code>
            </pre>
          </div>
          <div>
            <p className="text-sm font-semibold">认证方式</p>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-sm text-muted-foreground">
              <li><strong>JWT</strong>:用户登录态,<code className="rounded bg-muted px-1">Authorization: Bearer &lt;jwt&gt;</code></li>
              <li><strong>API Key</strong>:服务端调用,<code className="rounded bg-muted px-1">X-API-Key: &lt;key&gt;</code>,在 /settings/api-keys 生成</li>
              <li><strong>Webhook 签名</strong>:HMAC-SHA256,<code className="rounded bg-muted px-1">X-Webhook-Signature: &lt;hmac&gt;</code></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">速率限制</p>
            <p className="text-sm text-muted-foreground">
              默认 60 req/min,Pro 200/min,Team 500/min。超限返回 <code className="rounded bg-muted px-1">429</code>,响应头含:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              <code>{`X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1699900000`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* 对话 API */}
      <section id="chat" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">AI 对话 API</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <h3 className="text-lg font-semibold">POST /v1/chat/completions</h3>
          <p className="text-sm text-muted-foreground">
            OpenAI 兼容接口,支持流式(SSE)和非流式。
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            <code>{`curl -X POST https://api.aizhs.top/v1/chat/completions \\
  -H "Authorization: Bearer <jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "你好"}
    ],
    "stream": true,
    "temperature": 0.7
  }'

# 流式响应(SSE)
data: {"id":"...","choices":[{"delta":{"content":"你"},"index":0}]}
data: {"id":"...","choices":[{"delta":{"content":"好"},"index":0}]}
data: [DONE]`}</code>
          </pre>

          <h3 className="text-lg font-semibold pt-4">POST /v1/chat/agents/:agentId</h3>
          <p className="text-sm text-muted-foreground">
            调用指定 Agent(带知识库 + MCP 工具 + 工作流)。
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            <code>{`curl -X POST https://api.aizhs.top/v1/chat/agents/agent_abc123 \\
  -H "X-API-Key: <key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "帮我分析这份简历",
    "files": ["file_xyz"],
    "context": { "userId": "u_123" }
  }'`}</code>
          </pre>
        </div>
      </section>

      {/* Agent API */}
      <section id="agent-api" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Agent 管理 API</h2>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 rounded bg-muted/60 p-3 text-xs font-semibold min-[768px]:grid-cols-3">
            <div>方法</div>
            <div>路径</div>
            <div className="col-span-2 min-[768px]:col-span-1">说明</div>
          </div>
          {[
            ['GET', '/v1/agents', '列表(分页 + 筛选)'],
            ['POST', '/v1/agents', '创建 Agent'],
            ['GET', '/v1/agents/:id', '详情'],
            ['PATCH', '/v1/agents/:id', '更新'],
            ['POST', '/v1/agents/:id/publish', '发布到市场'],
            ['DELETE', '/v1/agents/:id', '删除'],
          ].map(([method, path, desc], i) => (
            <div
              key={`${method}-${path}`}
              className={`grid grid-cols-2 gap-2 rounded p-3 text-sm min-[768px]:grid-cols-3 ${i % 2 === 0 ? 'bg-card' : 'bg-muted/40'}`}
            >
              <div className="font-mono text-xs">{method}</div>
              <div className="font-mono text-xs">{path}</div>
              <div className="col-span-2 text-muted-foreground min-[768px]:col-span-1">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 错误码 */}
      <section id="errors" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">错误码</h2>
        <div className="rounded-2xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">统一响应格式:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
            <code>{`{
  "code": 0,          // 0=成功, 非 0=失败
  "message": "ok",
  "data": { ... }     // 成功时的数据
}`}</code>
          </pre>
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 rounded bg-muted/60 p-3 text-xs font-semibold min-[768px]:grid-cols-3">
              <div>HTTP</div>
              <div>code</div>
              <div className="col-span-2 min-[768px]:col-span-1">说明</div>
            </div>
            {[
              ['200', '0', '成功'],
              ['400', '1001', '参数错误'],
              ['401', '1002', '未认证'],
              ['403', '1003', '无权限'],
              ['404', '1004', '资源不存在'],
              ['429', '1005', '速率超限'],
              ['500', '5000', '服务器错误'],
            ].map(([http, code, desc], i) => (
              <div
                key={`${http}-${code}`}
                className={`grid grid-cols-2 gap-2 rounded p-3 text-sm min-[768px]:grid-cols-3 ${i % 2 === 0 ? 'bg-card' : 'bg-muted/40'}`}
              >
                <div>{http}</div>
                <div className="text-muted-foreground">{code}</div>
                <div className="col-span-2 text-muted-foreground min-[768px]:col-span-1">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SDK */}
      <section id="sdk" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">SDK</h2>
        <div className="grid gap-4 min-[768px]:grid-cols-3">
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">JavaScript</h3>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              <code>{`npm i @ihui/api-client`}</code>
            </pre>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              <code>{`import { chat } from '@ihui/api-client'
await chat({ message: '你好' })`}</code>
            </pre>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">Python</h3>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              <code>{`pip install ihui-ai`}</code>
            </pre>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              <code>{`from ihui import IHUI
client = IHUI(api_key='...')
client.chat(message='你好')`}</code>
            </pre>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">Go</h3>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              <code>{`go get github.com/ihui/ihui-go`}</code>
            </pre>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              <code>{`client := ihui.New("key")
client.Chat(ctx, "你好")`}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="mt-16 rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-5 text-center min-[768px]:p-8">
        <h2 className="text-2xl font-bold tracking-tight">下一步</h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href="/docs/mcp" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">MCP 工具集成</a>
          <a href="/docs/agent" className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent">Agent 开发</a>
          <a href="/docs/quickstart" className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent">返回快速开始</a>
        </div>
      </section>
    </div>
  )
}
