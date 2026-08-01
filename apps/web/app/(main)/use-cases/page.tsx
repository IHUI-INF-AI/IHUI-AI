import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, MessageSquare, Database, Code, FileText, ArrowRight } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/use-cases#webpage',
      url: 'https://aizhs.top/use-cases',
      name: 'IHUI AI 用例中心 — 4 大核心场景',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的 4 大核心用例:智能客服、企业知识库、代码助手、内容创作。每个用例都附带完整方案、落地步骤、核心收益。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'IHUI AI 用例中心 — 4 大核心 AI 应用场景 | 2026',
  description:
    '基于 IHUI AI 全栈 AI 操作系统搭建的 4 大核心用例:智能客服(成本 -70%)、企业知识库(找信息 -70%)、代码助手(效率 +50%)、内容创作(产能 ×10)。',
  alternates: { canonical: '/use-cases' },
  openGraph: {
    title: 'IHUI AI 用例中心 — 4 大核心 AI 应用场景',
    description: '智能客服 / 知识库 / 代码助手 / 内容创作 完整方案',
    url: 'https://aizhs.top/use-cases',
    type: 'website',
  },
}

const USE_CASES = [
  {
    slug: 'customer-support',
    title: 'AI 智能客服 Agent',
    desc: '7×24 智能接待,统一知识库,多模型路由,人机协同',
    icon: MessageSquare,
    metrics: '成本 -70% | 0s 响应 | 80% AI 解决',
  },
  {
    slug: 'knowledge-base',
    title: '企业知识库 RAG',
    desc: '全量文档接入,混合检索,知识图谱,细粒度权限',
    icon: Database,
    metrics: '找信息 -70% | 95% 准确率 | 30+ 数据源',
  },
  {
    slug: 'code-assistant',
    title: 'AI 代码助手 Agent',
    desc: '团队代码库 RAG,智能 Code Review,多 IDE 集成',
    icon: Code,
    metrics: '效率 +50% | 1 周上手 | 0 泄露',
  },
  {
    slug: 'content-generation',
    title: 'AI 内容创作 Agent',
    desc: '一键多平台改写,多语言本地化,品牌调性统一',
    icon: FileText,
    metrics: '产能 ×10 | 多语言 -80% | 5 平台',
  },
]

export default function UseCasesIndexPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            用例中心
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            4 大核心 AI 用例
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground min-[768px]:text-lg">
            基于 IHUI AI 全栈 AI 操作系统搭建,Apache 2.0 开源,5 分钟上线。
          </p>
        </section>

        <section className="mt-12 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2">
          {USE_CASES.map((uc) => {
            const Icon = uc.icon
            return (
              <Link
                key={uc.slug}
                href={`/use-cases/${uc.slug}`}
                className="group rounded-2xl border bg-card p-4 min-[768px]:p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-lg font-semibold">{uc.title}</h2>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{uc.desc}</p>
                <div className="mt-4 text-xs font-medium text-primary">{uc.metrics}</div>
              </Link>
            )
          })}
        </section>
      </main>
    </>
  )
}
