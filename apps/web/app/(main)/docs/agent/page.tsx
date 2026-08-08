import type { Metadata } from 'next'

const SITE_URL = 'https://aizhs.top'

const agentJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'TechArticle',
      '@id': 'https://aizhs.top/docs/agent#article',
      headline: '智汇 AI Agent 开发指南',
      description: '可视化编排 + 模板开发 + 最佳实践。从 0 搭建企业级 AI Agent,含提示词工程、工具集成、知识库挂载、六端发布。',
      author: { '@id': 'https://aizhs.top/#organization' },
      publisher: { '@id': 'https://aizhs.top/#organization' },
      datePublished: '2024-01-01',
      dateModified: '2026-08-01',
      proficiencyLevel: 'Intermediate',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/docs/agent#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '文档', item: 'https://aizhs.top/docs' },
        { '@type': 'ListItem', position: 3, name: 'Agent 开发', item: 'https://aizhs.top/docs/agent' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'Agent 开发 — 智汇 AI 全栈 AI 操作系统',
  description:
    '可视化编排 + 模板开发 + 最佳实践。从 0 搭建企业级 AI Agent:提示词工程、工具集成、知识库挂载、工作流、六端发布、变现。',
  alternates: {
    canonical: '/docs/agent',
    languages: {
      'zh-CN': '/zh-cn/docs/agent',
      'zh-TW': '/zh-tw/docs/agent',
      en: '/en/docs/agent',
      ko: '/ko/docs/agent',
      ja: '/ja/docs/agent',
      'x-default': '/docs/agent',
    },
  },
  openGraph: {
    title: 'Agent 开发 — 智汇 AI',
    description: '可视化编排 + 模板 + 最佳实践,六端发布。',
    url: `${SITE_URL}/docs/agent`,
    type: 'article',
  },
}

export default function AgentDocsPage() {
  return (
    <div className="space-y-4 px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(agentJsonLd) }}
      />

      {/* Agent 结构 */}
      <section id="structure" className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Agent 的核心结构</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">一个完整的 Agent 由 6 部分组成:</p>
          <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
            <li><strong>System Prompt(系统提示词)</strong>:定义 Agent 的人格、能力边界、输出格式</li>
            <li><strong>Model(模型)</strong>:选择 LLM(GPT-4o / Claude / Qwen 等),可配置 fallback</li>
            <li><strong>Knowledge(知识库)</strong>:挂载 RAG 知识库,Agent 自动检索</li>
            <li><strong>Tools(工具)</strong>:MCP Server + 内置工具(搜索/代码执行/文件读写)</li>
            <li><strong>Workflow(工作流)</strong>:n8n 风格节点编排(可选,复杂场景)</li>
            <li><strong>Memory(记忆)</strong>:短期(会话内)+ 长期(跨会话用户画像)</li>
          </ol>
        </div>
      </section>

      {/* 可视化编排 */}
      <section id="visual" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">可视化编排(零代码)</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            适合非开发者:产品经理、运营、客服、教师都能搭建 Agent。
          </p>
          <ol className="ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
            <li>进入 <a href="https://aizhs.top/agent-workbench" className="text-primary underline">Agent 工作台</a>,点击「新建 Agent」</li>
            <li>填写基本信息:名称、头像、描述、分类</li>
            <li>编写 System Prompt(可从 200+ 模板选择)</li>
            <li>选择模型(默认 GPT-4o,可切换 Claude/Gemini/Qwen)</li>
            <li>挂载知识库(可选,支持多个)</li>
            <li>添加工具(MCP Server,可选多个)</li>
            <li>测试对话,调整 Prompt</li>
            <li>点击「发布」,选择目标端(Web/桌面/小程序/插件/移动/CLI)</li>
          </ol>
        </div>
      </section>

      {/* 提示词工程 */}
      <section id="prompt" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">提示词工程最佳实践</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <h3 className="text-lg font-semibold">CRISPE 框架</h3>
          <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
            <li><strong>C</strong>apacity(能力):明确 Agent 能做什么、不能做什么</li>
            <li><strong>R</strong>ole(角色):设定身份("你是一位资深数据分析师")</li>
            <li><strong>I</strong>nstruction(指令):具体任务步骤</li>
            <li><strong>S</strong>uggestion(建议):输出风格、格式约束</li>
            <li><strong>P</strong>ersonality(个性):语气、口吻</li>
            <li><strong>E</strong>xperiment(实验):Few-shot 示例</li>
          </ul>

          <h3 className="text-lg font-semibold pt-4">示例:客服 Agent</h3>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            <code>{`# System Prompt
你是一位专业的客服 Agent,服务于智汇 AI 平台。

## 能力边界
- 回答平台功能、定价、使用问题
- 协助用户排查常见错误
- 收集用户反馈并记录
- 无法处理:退款、账户封禁、法律纠纷(转人工)

## 输出格式
- 简洁清晰,不超过 200 字
- 步骤类问题用有序列表
- 附带相关文档链接(如有)

## 语气
专业、友好、有耐心,不卑不亢。

## 知识库
自动检索 /docs/* 和 /faq/* 内容,优先引用。

## 工具
- search_docs: 搜索内部文档
- create_ticket: 创建工单转人工
- get_user_info: 查询用户账户状态(需用户授权)`}</code>
          </pre>
        </div>
      </section>

      {/* 模板开发 */}
      <section id="templates" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">模板开发(高级)</h2>
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            模板 = 可复用的 Agent 配置(Prompt + 工具 + 知识库 + 工作流),用户一键 fork 后自定义。
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
            <code>{`// templates/my-agent.template.ts
import { defineAgentTemplate } from '@ihui/agent-sdk'

export default defineAgentTemplate({
  name: '简历优化助手',
  category: 'hr',
  description: '分析简历,给出优化建议,生成优化版本',
  icon: '📄',

  prompt: \`你是一位资深 HR,擅长简历优化...\`,

  model: 'gpt-4o',
  fallbackModels: ['claude-sonnet-4', 'qwen-max'],

  knowledge: ['kb_resume_best_practices'],
  tools: ['file_read', 'file_write', 'web_search'],

  variables: [
    { name: 'targetRole', type: 'string', required: true, label: '目标岗位' },
    { name: 'experience', type: 'number', label: '工作年限' }
  ],

  // 工作流(可选)
  workflow: {
    nodes: [
      { id: 'parse', type: 'file-parse' },
      { id: 'analyze', type: 'llm', prompt: '分析简历...' },
      { id: 'optimize', type: 'llm', prompt: '生成优化版本...' },
      { id: 'export', type: 'file-export', format: 'pdf' }
    ],
    edges: [
      { from: 'parse', to: 'analyze' },
      { from: 'analyze', to: 'optimize' },
      { from: 'optimize', to: 'export' }
    ]
  }
})`}</code>
          </pre>
        </div>
      </section>

      {/* 发布与变现 */}
      <section id="publish" className="mt-16 space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">发布与变现</h2>
        <div className="grid gap-4 min-[768px]:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">📱 六端发布</h3>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-sm text-muted-foreground">
              <li>Web(主入口,PWA 离线)</li>
              <li>桌面(Windows/macOS/Linux)</li>
              <li>小程序(微信/支付宝/抖音)</li>
              <li>浏览器插件</li>
              <li>移动 App(iOS/Android)</li>
              <li>CLI(脚本/CI-CD)</li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-lg font-semibold">💰 变现模式</h3>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-sm text-muted-foreground">
              <li><strong>免费</strong>:引流,积累用户</li>
              <li><strong>按次付费</strong>:¥0.1-1/次,用户买积分</li>
              <li><strong>订阅制</strong>:¥29/月,无限使用</li>
              <li><strong>企业私有化</strong>:定制报价,数据私有</li>
              <li><strong>分成</strong>:平台抽 10%,作者得 90%</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-16 rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-5 text-center min-[768px]:p-8">
        <h2 className="text-2xl font-bold tracking-tight">下一步</h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href="/docs/rag" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">知识库 RAG</a>
          <a href="/docs/workflow" className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent">工作流编排</a>
          <a href="/docs/mcp" className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-accent">MCP 工具</a>
        </div>
      </section>
    </div>
  )
}
