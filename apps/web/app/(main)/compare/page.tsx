import type { Metadata } from 'next'
import Link from 'next/link'
import { Layers, ArrowRight } from 'lucide-react'

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

export default function CompareIndexPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(compareJsonLd) }}
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
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
      </main>
    </>
  )
}
