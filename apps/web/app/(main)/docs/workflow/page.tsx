import type { Metadata } from 'next'

const SITE_URL = 'https://aizhs.top'

const workflowJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'TechArticle',
      '@id': 'https://aizhs.top/docs/workflow#article',
      headline: '智汇 AI 工作流编排完整指南',
      description:
        '智汇 AI 工作流编排:n8n 风格节点画布,触发器 + 条件分支 + 循环 + 并行 + 子流程,Agent 编排可视化。',
      author: { '@id': 'https://aizhs.top/#organization' },
      publisher: { '@id': 'https://aizhs.top/#organization' },
      datePublished: '2024-01-01',
      dateModified: '2026-08-01',
      proficiencyLevel: 'Intermediate',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/docs/workflow#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '文档', item: 'https://aizhs.top/docs' },
        { '@type': 'ListItem', position: 3, name: '工作流编排', item: 'https://aizhs.top/docs/workflow' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: '工作流编排 — 智汇 AI 文档',
  description:
    '智汇 AI 工作流编排完整指南:n8n 风格节点画布,触发器(定时/Webhook/消息),条件分支,循环,并行,子流程,Agent 编排可视化。',
  alternates: {
    canonical: '/docs/workflow',
    languages: {
      'zh-CN': '/zh-cn/docs/workflow',
      'zh-TW': '/zh-tw/docs/workflow',
      en: '/en/docs/workflow',
      ko: '/ko/docs/workflow',
      ja: '/ja/docs/workflow',
      'x-default': '/docs/workflow',
    },
  },
  openGraph: {
    title: '工作流编排 — 智汇 AI',
    description: 'n8n 风格节点画布,可视化编排复杂 AI 流程。',
    url: `${SITE_URL}/docs/workflow`,
    type: 'article',
    images: [{ url: '/images/logo.png?v=20260719-unify', width: 1200, height: 630, alt: '智汇 AI 工作流' }],
  },
}

export default function WorkflowDocsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(workflowJsonLd) }}
      />

      {/* Hero */}
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span>⚡</span>
          工作流编排
        </div>
        <h1 className="text-2xl min-[768px]:text-4xl min-[1024px]:text-5xl font-bold tracking-tight">
          工作流编排完整指南
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          n8n 风格节点画布,可视化编排复杂 AI 流程。
          触发器 + 条件分支 + 循环 + 并行 + 子流程,无需写代码也能搭出企业级 AI Pipeline。
        </p>
      </header>

      {/* 什么是工作流 */}
      <section id="what-is-workflow" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">什么是工作流?</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            <strong>工作流(Workflow)</strong>是把多个 AI 能力(对话 / 检索 / 工具调用 / 模型调用)
            按特定逻辑串联起来,完成单次对话无法完成的复杂任务。
          </p>
          <p className="text-sm text-muted-foreground">适用场景:</p>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li><strong>多步骤任务</strong>:客服分流 → 工单创建 → 知识库检索 → 回复 → 满意度回访</li>
            <li><strong>定时任务</strong>:每天 9 点抓取行业新闻 → AI 摘要 → 推送企业微信</li>
            <li><strong>事件驱动</strong>:GitHub PR 创建 → 代码审查 Agent → 评论结果 → 通知 Slack</li>
            <li><strong>批处理</strong>:批量翻译 100 篇文章 → 校对 → 生成摘要 → 归档</li>
            <li><strong>人工协同</strong>:AI 起草 → 等待人工审核 → 修改 → 发布</li>
          </ul>
        </div>
      </section>

      {/* 节点类型 */}
      <section id="nodes" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">节点类型</h2>
        <div className="grid grid-cols-1 gap-4 min-[768px]:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">⚡ 触发器(Trigger)</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li><strong>Manual</strong>:手动点击"运行"触发</li>
              <li><strong>Schedule</strong>:Cron 定时(如每天 9 点)</li>
              <li><strong>Webhook</strong>:HTTP POST 触发(外部系统调用)</li>
              <li><strong>Message</strong>:IM 消息触发(飞书/钉钉/Slack)</li>
              <li><strong>File Watch</strong>:文件变更触发(S3/OSS/本地)</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">🤖 AI 节点</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li><strong>Chat</strong>:LLM 对话(单轮 / 多轮)</li>
              <li><strong>RAG</strong>:知识库检索 + 生成</li>
              <li><strong>Agent</strong>:调用已有 Agent</li>
              <li><strong>Embedding</strong>:向量化</li>
              <li><strong>Vision</strong>:图像理解</li>
              <li><strong>TTS / STT</strong>:语音合成 / 识别</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">🔧 工具节点</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li><strong>HTTP Request</strong>:调用任意 API</li>
              <li><strong>MCP Tool</strong>:调用 MCP Server 工具</li>
              <li><strong>Code</strong>:执行 JS / Python 代码</li>
              <li><strong>Database</strong>:SQL 查询</li>
              <li><strong>File</strong>:读写文件(S3/OSS/本地)</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">🔀 控制流节点</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-muted-foreground">
              <li><strong>If</strong>:条件分支(if / else if / else)</li>
              <li><strong>Switch</strong>:多分支选择</li>
              <li><strong>Loop</strong>:循环(foreach / while)</li>
              <li><strong>Parallel</strong>:并行执行多分支</li>
              <li><strong>Wait</strong>:等待(定时 / 事件 / 人工)</li>
              <li><strong>Sub-workflow</strong>:调用子工作流</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 创建工作流 */}
      <section id="create-workflow" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">创建第一个工作流</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            示例:<strong>每日行业新闻 AI 摘要推送</strong>
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            <code>{`┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ ⏰ Schedule │ →  │ 🔧 HTTP      │ →  │ 🤖 AI 摘要  │ →  │ 📨 推送      │
│ 每天 9:00   │    │ 抓取新闻 API │    │ GPT-4o 总结 │    │ 飞书/微信    │
└─────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                          ↓
                    ┌──────────────┐
                    │ 🔀 If        │
                    │ 新闻 > 10 条 │ → 是 → 跑批
                    │              │ → 否 → 跳过
                    └──────────────┘`}</code>
          </pre>
          <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
            <li>访问 <a href="https://aizhs.top/workflows" className="text-primary underline">工作流页面</a>,点击"新建工作流"</li>
            <li>拖入 <strong>Schedule</strong> 节点,设置 Cron: <code className="rounded bg-muted px-1">0 9 * * *</code></li>
            <li>拖入 <strong>HTTP Request</strong> 节点,配置新闻 API URL</li>
            <li>拖入 <strong>If</strong> 节点,条件:<code className="rounded bg-muted px-1">data.length &gt; 10</code></li>
            <li>拖入 <strong>AI</strong> 节点,选模型 GPT-4o,Prompt: "总结以下新闻为 3 条要点"</li>
            <li>拖入 <strong>HTTP Request</strong> 节点,POST 到飞书 Webhook</li>
            <li>连接节点,点击"测试运行"验证</li>
            <li>保存 + 启用</li>
          </ol>
        </div>
      </section>

      {/* 高级特性 */}
      <section id="advanced" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">高级特性</h2>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">🔀 并行执行</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              多个独立分支同时执行,等所有分支完成后再汇聚 — 显著降低延迟。
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
              <code>{`Parallel:
  ├─ AI 翻译(英文)  ─┐
  ├─ AI 翻译(日文)  ─┤→ 汇总 → 发布
  ├─ AI 翻译(韩文)  ─┤
  └─ AI 翻译(法文)  ─┘
# 4 个翻译并行,总耗时 = max(单次)而非 sum`}</code>
            </pre>
          </div>

          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">🔄 循环 + 批处理</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Foreach 循环处理数组,自动限流避免触发 API Rate Limit。
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
              <code>{`Loop (foreach articles):
  ├─ AI 摘要
  ├─ AI 分类
  └─ 写入数据库
# concurrency: 5  # 并发 5 个,避免限流`}</code>
            </pre>
          </div>

          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">🧩 子工作流</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              把常用流程封装为子工作流,主工作流调用 — 复用 + 维护性强。
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
              <code>{`主工作流:
  ├─ 子工作流: "通用翻译"(输入文本,输出译文)
  ├─ 子工作流: "通用摘要"(输入文本,输出摘要)
  └─ 子工作流: "通用分类"(输入文本,输出标签)

# 修改"通用翻译"一处,所有引用它的主工作流自动生效`}</code>
            </pre>
          </div>

          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">⏸️ 人工审批</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              AI 起草后暂停,等待人工审批通过后继续执行 — 关键场景必备。
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
              <code>{`Wait (human approval):
  - 通知: 飞书审批消息
  - 超时: 24h 未审批自动拒绝
  - 通过: 继续发布
  - 拒绝: 进入"拒绝"分支`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* 监控 */}
      <section id="monitoring" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">监控与调试</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <ul className="ml-4 list-disc space-y-2 text-sm text-muted-foreground">
            <li><strong>实时执行日志</strong>:每个节点的输入 / 输出 / 耗时 / 状态实时显示</li>
            <li><strong>断点调试</strong>:在任意节点设置断点,单步执行查看中间结果</li>
            <li><strong>历史记录</strong>:每次执行完整快照,可回放复现问题</li>
            <li><strong>错误重试</strong>:节点失败自动重试 3 次(可配),仍失败则告警</li>
            <li><strong>性能分析</strong>:瓶颈节点自动标红,提示优化</li>
            <li><strong>告警</strong>:失败 / 超时 / 死循环自动通知 Admin</li>
          </ul>
        </div>
      </section>

      {/* 下一步 */}
      <section className="mt-16 rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-6">
        <h2 className="text-lg font-semibold">下一步</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 min-[768px]:grid-cols-3">
          <a href="/docs/agent" className="rounded-lg border bg-card p-3 text-sm hover:bg-accent">
            🤖 Agent 开发 →<br />
            <span className="text-xs text-muted-foreground">工作流内嵌 Agent 节点</span>
          </a>
          <a href="/docs/mcp" className="rounded-lg border bg-card p-3 text-sm hover:bg-accent">
            🔌 MCP 工具集成 →<br />
            <span className="text-xs text-muted-foreground">工作流调用 MCP 工具</span>
          </a>
          <a href="/docs/api" className="rounded-lg border bg-card p-3 text-sm hover:bg-accent">
            🛠️ API 参考 →<br />
            <span className="text-xs text-muted-foreground">通过 API 触发工作流</span>
          </a>
        </div>
      </section>
    </main>
  )
}
