import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, BarChart3 } from 'lucide-react'
import { BackButton } from '@/components/common'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/use-cases/market-analysis#webpage',
      url: 'https://aizhs.top/use-cases/market-analysis',
      name: 'AI 市场分析 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的 AI 市场分析 Agent:竞品监控、舆情分析、趋势预测、受众画像、SEO 建议,30 分钟上线,6 端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/use-cases/market-analysis#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'AI 市场分析',
          item: 'https://aizhs.top/use-cases/market-analysis',
        },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/use-cases/market-analysis#howto',
      name: '30 分钟搭建 AI 市场分析 Agent',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建 AI 市场分析 Agent 的 6 步流程:接入数据源 → 配置竞品监控 → 设置舆情关键词 → 训练趋势模型 → 生成受众画像 → 输出 SEO 建议。趋势预测准确率 90%+。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '竞品清单/行业关键词/历史市场数据' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 数据采集引擎' },
        { '@type': 'HowToTool', name: 'IHUI AI 趋势预测模型' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: '接入数据源',
          text: '对接新闻 API/社媒(微博/小红书/抖音)/竞品官网/搜索引擎,全量采集市场信号。',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: '配置竞品监控',
          text: '录入竞品清单,Agent 监控产品发布/定价/营销活动/招聘动态,日报自动推送。',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: '设置舆情关键词',
          text: '配置品牌/产品/行业关键词,Agent 实时抓取舆情,负面情绪 5 分钟内预警。',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: '训练趋势模型',
          text: '基于历史数据训练趋势预测模型,提前 90 天预测品类热度走势,准确率 90%+。',
        },
        {
          '@type': 'HowToStep',
          position: 5,
          name: '生成受众画像',
          text: '聚合社媒/搜索/电商数据,AI 自动生成受众画像(兴趣/消费力/决策路径),指导精准投放。',
        },
        {
          '@type': 'HowToStep',
          position: 6,
          name: '输出 SEO 建议',
          text: '基于关键词趋势与竞品内容差距,Agent 每周输出选题与 SEO 优化建议,流量提升 40%。',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 市场分析 Agent — 竞品监控/舆情/趋势预测 | IHUI AI',
  description:
    '用 IHUI AI 构建 AI 市场分析 Agent:竞品监控 + 舆情分析 + 趋势预测 + 受众画像 + SEO 建议。30 分钟上线,6 端分发。',
  alternates: { canonical: '/use-cases/market-analysis' },
  openGraph: {
    title: 'AI 市场分析 Agent — IHUI AI',
    description: '竞品监控 + 舆情预警 + 趋势预测,30 分钟上线。',
    url: 'https://aizhs.top/use-cases/market-analysis',
    type: 'article',
  },
}

const capabilities = [
  {
    title: '360° 竞品监控',
    desc: '监控竞品产品/定价/营销/招聘动态,日报自动推送,新动作 1 小时内预警。',
  },
  {
    title: '实时舆情预警',
    desc: '全网抓取品牌/产品/行业关键词,负面情绪 5 分钟内预警,危机公关抢占黄金窗口。',
  },
  {
    title: '趋势预测',
    desc: '基于历史数据训练模型,提前 90 天预测品类热度走势,准确率 90%+,产能规划不再拍脑袋。',
  },
  {
    title: '受众画像',
    desc: '聚合社媒/搜索/电商数据,AI 自动生成受众画像(兴趣/消费力/决策路径),指导精准投放。',
  },
  {
    title: 'SEO 建议',
    desc: '基于关键词趋势与竞品内容差距,每周输出选题与 SEO 优化建议,自然流量提升 40%。',
  },
  {
    title: '市场复盘',
    desc: '每月自动生成市场复盘报告,品牌声量/份额变化/机会威胁一览,数据驱动决策。',
  },
]

const steps = [
  { step: 1, title: '接入数据源', desc: '对接新闻/社媒/竞品官网/搜索引擎,全量采集。' },
  { step: 2, title: '配置竞品监控', desc: '录入竞品清单,日报自动推送产品/定价/营销动态。' },
  { step: 3, title: '设置舆情关键词', desc: '配置品牌/产品关键词,负面 5 分钟预警。' },
  { step: 4, title: '训练趋势模型', desc: '基于历史数据,提前 90 天预测品类热度。' },
  { step: 5, title: '生成受众画像', desc: '聚合多源数据,输出兴趣/消费力/决策路径画像。' },
  { step: 6, title: '输出 SEO 建议', desc: '每周选题与优化建议,自然流量提升 40%。' },
]

const metrics = [
  { value: '360°', label: '竞品视角' },
  { value: '5min', label: '舆情预警' },
  { value: '90%', label: '趋势预测准确率' },
  { value: '40%', label: '自然流量提升' },
]

export default function MarketAnalysisPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        <BackButton />
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            市场分析
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 市场分析 Agent:竞品监控 + 舆情预警 + 趋势预测
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            基于 IHUI AI 全栈 AI 操作系统搭建,30 分钟上线,6 端分发,Apache 2.0 开源,支持私有化。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
            {metrics.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-2xl font-bold text-primary min-[768px]:text-3xl">
                  {m.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground min-[768px]:text-sm">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">
            6 大核心能力
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {capabilities.map((c, i) => (
              <div key={c.title} className="rounded-2xl border bg-card p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">
            6 步落地
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {steps.map((s) => (
              <div key={s.step} className="rounded-2xl border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground">
                  {s.step}
                </div>
                <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-2xl border bg-card p-8 text-center min-[768px]:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">
            开始构建你的 AI 市场分析助手
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            注册即得 1000 积分,从市场分析场景模板一键 fork,30 分钟体验。
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sso/register"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              免费注册
            </Link>
            <Link
              href="/use-cases"
              className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium hover:bg-accent"
            >
              查看其他用例 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
