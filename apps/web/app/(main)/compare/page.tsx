import type { Metadata } from 'next'
import Link from 'next/link'
import { Layers, ArrowRight, Check, X, Sparkles, Github } from 'lucide-react'
import { Button } from '@ihui/ui-react'

const compareJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/compare#webpage',
      url: 'https://ihui.ai/compare',
      name: 'IHUI AI 产品对比 — 主流 AI 平台深度对比',
      description:
        'IHUI AI 与主流 AI 平台的深度对比:Dify、Coze、FastGPT、n8n。从客户端、Agent、RAG、模型、MCP、私有化、定价等 11 个维度逐一分析。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: { '@id': 'https://ihui.ai/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/compare#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '产品对比', item: 'https://ihui.ai/compare' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI 产品对比 — Dify / Coze / FastGPT / n8n 深度对比 | 2026',
  description:
    'IHUI AI 与主流 AI 平台的深度对比。从客户端、Agent、RAG、模型、MCP、私有化、定价等 11 个维度分析,帮你选择最适合的 AI 平台。',
  alternates: { canonical: '/compare' },
  openGraph: {
    title: 'IHUI AI 产品对比 — 主流 AI 平台深度分析',
    description: 'IHUI AI vs Dify / Coze / FastGPT / n8n 11 维度对比',
    url: 'https://ihui.ai/compare',
    type: 'website',
  },
}

const COMPARISONS = [
  {
    slug: 'ihui-vs-dify',
    competitor: 'Dify',
    tagline: 'IHUI AI 六端同源全栈 AI 操作系统 vs Dify Web 端 LLM 应用开发框架',
    keyPoints: ['六端 vs Web only', 'Agent 市场 vs 无', 'MCP 原生支持 vs 不支持', 'Apache 2.0 vs BSL'],
  },
  {
    slug: 'ihui-vs-coze',
    competitor: 'Coze',
    tagline: 'IHUI AI 开源 + 私有化 vs Coze 字节闭源 Agent 平台',
    keyPoints: ['开源 Apache 2.0 vs 闭源', '自托管 vs 字节云', '数据主权 vs 字节掌控', '10+ 模型 vs 豆包为主'],
  },
  {
    slug: 'ihui-vs-fastgpt',
    competitor: 'FastGPT',
    tagline: 'IHUI AI 全栈 AI 操作系统 vs FastGPT 知识库 Q&A 工具',
    keyPoints: ['Agent 市场 vs 无', '六端 vs Web only', 'MCP vs 不支持', '团队协作 vs 基础多用户'],
  },
  {
    slug: 'ihui-vs-n8n',
    competitor: 'n8n',
    tagline: 'IHUI AI AI 优先全栈 vs n8n 通用工作流自动化',
    keyPoints: ['AI 一等公民 vs 节点', '内置 RAG vs 外部集成', 'Agent 编排 vs 无 Agent', 'Apache 2.0 vs SUL'],
  },
]

const TABLE_COLS = ['IHUI-AI', 'ChatGPT Plus', 'Dify', 'LangChain', 'Coze', 'FastGPT'] as const
const TABLE_ROWS: [string, string, boolean, string, boolean, string, boolean, string, boolean, string, boolean, string, boolean][] = [
  ['开源协议', 'Apache 2.0', true, '闭源', false, 'Apache 2.0', true, 'MIT', true, '闭源', false, 'Apache 2.0', true],
  ['私有化部署', '免费', true, '不支持', false, '付费', true, '支持', true, '不支持', false, '付费', true],
  ['8 端同源', 'Web/API/CLI/Desktop/Ext/Mobile/Miniapp', true, '仅 Web', false, '仅 Web', false, '库', false, '仅 Web', false, '仅 Web', false],
  ['LLM 模型数', '176', true, '1 (GPT)', false, '50+', true, '100+', true, '10+', true, '50+', true],
  ['MCP 协议', '支持', true, '不支持', false, '不支持', false, '不支持', false, '不支持', false, '不支持', false],
  ['A2A 协议', '支持', true, '不支持', false, '不支持', false, '不支持', false, '不支持', false, '不支持', false],
  ['RAG 知识库', '引用追溯', true, '支持', true, '支持', true, '库', false, '支持', true, '支持', true],
  ['Agent 市场', '支持', true, 'GPT Store', true, '不支持', false, '不支持', false, '支持', true, '不支持', false],
  ['SaaS 计费', '内置', true, '不支持', false, '支持', true, '不支持', false, '不支持', false, '支持', true],
  ['数据库表', '340', true, '?', false, '?', false, '无', false, '?', false, '?', false],
  ['测试覆盖', '5346', true, '?', false, '?', false, '?', false, '?', false, '?', false],
  ['价格', '免费/¥99月起', true, '$20/月起', false, '免费/付费', true, '免费', true, '免费/付费', true, '免费/付费', true],
]

const ALL_COMPARISONS = [
  { group: 'AI 应用平台', items: ['dify', 'coze', 'fastgpt', 'flowise', 'typebot', 'stack-ai'] },
  { group: 'AI 编排框架', items: ['langchain', 'llamaindex', 'crewai', 'autogen', 'openai-agent'] },
  { group: '自动化工具', items: ['n8n', 'make', 'zapier-ai', 'wordware', 'spark', 'relevance-ai'] },
  { group: 'AI 编程助手', items: ['cursor', 'github-copilot', 'claude-code', 'bolt-new', 'v0-dev', 'lovable', 'replit-agent', 'windsurf', 'devin', 'manus'] },
  { group: '国内大模型平台', items: ['qwen-platform', 'deepseek-platform', 'doubao', 'kimi-platform', 'minimax', 'zhipu', 'ernie'] },
  { group: '企业级', items: ['copilot-studio', 'voiceflow'] },
]

const LABELS: Record<string, string> = {
  'dify': 'Dify', 'coze': 'Coze', 'fastgpt': 'FastGPT', 'flowise': 'Flowise', 'typebot': 'Typebot',
  'stack-ai': 'Stack AI', 'langchain': 'LangChain', 'llamaindex': 'LlamaIndex', 'crewai': 'CrewAI',
  'autogen': 'AutoGen', 'openai-agent': 'OpenAI Agent', 'n8n': 'n8n', 'make': 'Make',
  'zapier-ai': 'Zapier AI', 'wordware': 'Wordware', 'spark': 'Spark', 'relevance-ai': 'Relevance AI',
  'cursor': 'Cursor', 'github-copilot': 'GitHub Copilot', 'claude-code': 'Claude Code',
  'bolt-new': 'Bolt.new', 'v0-dev': 'v0.dev', 'lovable': 'Lovable', 'replit-agent': 'Replit Agent',
  'windsurf': 'Windsurf', 'devin': 'Devin', 'manus': 'Manus', 'qwen-platform': '通义千问平台',
  'deepseek-platform': 'DeepSeek 平台', 'doubao': '豆包', 'kimi-platform': 'Kimi 平台',
  'minimax': 'MiniMax', 'zhipu': '智谱', 'ernie': '文心一言', 'copilot-studio': 'Copilot Studio',
  'voiceflow': 'Voiceflow',
}

export default function CompareIndexPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-8">
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-primary" />
            产品对比
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            IHUI AI vs 主流 AI 平台
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
            从 11 个核心维度深度对比,帮你选择最适合的 AI 平台。
          </p>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-2">
          {COMPARISONS.map(({ slug, competitor, tagline, keyPoints }) => (
            <Link
              key={slug}
              href={`/compare/${slug}`}
              className="group rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">IHUI AI vs {competitor}</h2>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{tagline}</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {keyPoints.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {point}
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </section>

        {/* 综合对比表格 */}
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight md:text-2xl">综合对比表</h2>
          <p className="mt-1 text-sm text-muted-foreground">7 大平台 12 项指标一目了然</p>
          <div className="mt-6 overflow-x-auto rounded-lg border bg-card shadow-sm">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-3 text-left text-sm font-semibold md:px-4">特性</th>
                  {TABLE_COLS.map((col, i) => (
                    <th key={col} className={`px-3 py-3 text-center text-sm font-semibold md:px-4 ${i === 0 ? 'text-primary' : ''}`}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row, idx) => (
                  <tr key={row[0]} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                    <td className="px-3 py-3 text-sm font-medium md:px-4">{row[0]}</td>
                    {TABLE_COLS.map((_, ci) => {
                      const text = row[ci * 2 + 1]
                      const ok = row[ci * 2 + 2]
                      return (
                        <td key={ci} className={`px-3 py-3 text-center text-sm md:px-4 ${ci === 0 ? 'bg-primary/5 font-medium' : ''}`}>
                          <span className="inline-flex items-center gap-1.5">
                            {ok === true && <Check className="h-4 w-4 shrink-0 text-green-600" aria-hidden />}
                            {ok === false && <X className="h-4 w-4 shrink-0 text-red-600" aria-hidden />}
                            <span className={ok === false ? 'text-red-600' : ''}>{text}</span>
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 全部 36 个深度对比 */}
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight md:text-2xl">全部深度对比</h2>
          <p className="mt-1 text-sm text-muted-foreground">IHUI-AI 与 36 个竞品的逐一深度对比</p>
          <div className="mt-6 space-y-4">
            {ALL_COMPARISONS.map(({ group, items }) => (
              <div key={group}>
                <h3 className="text-sm font-semibold text-muted-foreground">{group}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {items.map((slug) => (
                    <Link key={slug} href={`/compare/ihui-vs-${slug}`} className="inline-flex items-center rounded-md border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary/40 hover:bg-primary/5">
                      {LABELS[slug] ?? slug}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-12 rounded-lg border bg-primary/5 p-8 text-center md:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold tracking-tight md:text-2xl">立即开始使用 IHUI-AI</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">开源、免费、8 端同源,176 模型 + LangGraph + MCP + A2A 三栈合一。</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild><Link href="/pricing">立即开始</Link></Button>
            <Button size="lg" variant="outline" asChild>
              <a href="https://github.com/IHUI-INF-AI/IHUI-AI" target="_blank" rel="noopener noreferrer">
                <Github className="mr-2 h-4 w-4" />
                查看 GitHub
              </a>
            </Button>
          </div>
        </section>
      </main>
    </>
  )
}
