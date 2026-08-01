import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, Package } from 'lucide-react'
import { BackButton } from '@/components/common'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/use-cases/product-analysis#webpage',
      url: 'https://aizhs.top/use-cases/product-analysis',
      name: 'AI 产品分析 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的 AI 产品分析 Agent:用户行为分析、功能优先级、A/B 测试设计、路线图建议、反馈聚合,30 分钟上线,6 端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/use-cases/product-analysis#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 产品分析', item: 'https://aizhs.top/use-cases/product-analysis' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/use-cases/product-analysis#howto',
      name: '30 分钟搭建 AI 产品分析 Agent',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建 AI 产品分析 Agent 的 6 步流程:接入埋点 → 配置行为分析 → 设置优先级模型 → 生成 A/B 方案 → 聚合反馈 → 输出路线图。决策速度提升 5 倍。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '埋点数据/用户反馈/历史迭代记录' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 行为分析引擎' },
        { '@type': 'HowToTool', name: 'IHUI AI 反馈聚合器' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '接入埋点数据', text: '对接 Sensors/Amplitude/Mixpanel/自建埋点,统一数据 schema,Agent 自动发现行为模式。' },
        { '@type': 'HowToStep', position: 2, name: '配置行为分析', text: '设定关键漏斗与留存指标,Agent 自动识别异常波动,定位流失环节与用户分群。' },
        { '@type': 'HowToStep', position: 3, name: '设置优先级模型', text: '基于 RICE/KANO 模型,Agent 给需求池打分排序,产品经理专注高 ROI 项。' },
        { '@type': 'HowToStep', position: 4, name: '生成 A/B 方案', text: '输入实验假设,Agent 自动设计实验分组、样本量、指标体系,显著性达 90%+。' },
        { '@type': 'HowToStep', position: 5, name: '聚合用户反馈', text: '聚合 App Store/客服/社媒/问卷反馈,Agent 自动分类(BUG/需求/赞美/吐槽),80% 自动归档。' },
        { '@type': 'HowToStep', position: 6, name: '输出路线图建议', text: '基于数据 + 反馈 + 优先级,Agent 每月生成下季度路线图建议,数据驱动而非拍脑袋。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 产品分析 Agent — 用户行为/A-B 测试/路线图 | IHUI AI',
  description:
    '用 IHUI AI 构建 AI 产品分析 Agent:用户行为分析 + 功能优先级 + A/B 测试设计 + 路线图建议 + 反馈聚合。30 分钟上线。',
  alternates: { canonical: '/use-cases/product-analysis' },
  openGraph: {
    title: 'AI 产品分析 Agent — IHUI AI',
    description: '行为分析 + A/B 测试 + 路线图建议,30 分钟上线。',
    url: 'https://aizhs.top/use-cases/product-analysis',
    type: 'article',
  },
}

const capabilities = [
  { title: '用户行为分析', desc: '统一埋点数据 schema,自动发现行为模式,识别异常波动与流失环节,定位高价值用户分群。' },
  { title: '功能优先级', desc: '基于 RICE/KANO 模型给需求池打分排序,产品经理专注高 ROI 项,告别拍脑袋决策。' },
  { title: 'A/B 测试设计', desc: '输入实验假设,Agent 自动设计分组、样本量、指标体系,显著性达 90%+,避免假阳性。' },
  { title: '路线图建议', desc: '基于数据 + 反馈 + 优先级,每月生成下季度路线图建议,数据驱动而非拍脑袋。' },
  { title: '反馈聚合', desc: '聚合 App Store/客服/社媒/问卷反馈,自动分类(BUG/需求/赞美/吐槽),80% 自动归档。' },
  { title: '产品复盘', desc: '每周生成产品复盘报告,功能使用率/留存/满意度一览,迭代节奏数据可见。' },
]

const steps = [
  { step: 1, title: '接入埋点', desc: '对接 Sensors/Amplitude/Mixpanel,统一 schema。' },
  { step: 2, title: '配置行为分析', desc: '设定漏斗与留存,自动识别异常与流失环节。' },
  { step: 3, title: '设置优先级', desc: 'RICE/KANO 模型给需求池打分排序。' },
  { step: 4, title: '生成 A/B 方案', desc: '自动设计分组、样本量、指标体系。' },
  { step: 5, title: '聚合反馈', desc: '多源反馈自动分类归档,80% 自动化。' },
  { step: 6, title: '输出路线图', desc: '每月生成下季度路线图建议。' },
]

const metrics = [
  { value: '5×', label: '决策速度' },
  { value: '80%', label: '反馈聚合自动化' },
  { value: '90%', label: 'A/B 测试显著率' },
  { value: '30min', label: '上线时间' },
]

export default function ProductAnalysisPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        <BackButton />
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Package className="h-3.5 w-3.5 text-primary" />
            产品分析
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 产品分析 Agent:行为分析 + A/B 测试 + 路线图
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            基于 IHUI AI 全栈 AI 操作系统搭建,30 分钟上线,6 端分发,Apache 2.0 开源,支持私有化。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
            {metrics.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-2xl font-bold text-primary min-[768px]:text-3xl">{m.value}</div>
                <div className="mt-1 text-xs text-muted-foreground min-[768px]:text-sm">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">6 大核心能力</h2>
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
          <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">6 步落地</h2>
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
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">开始构建你的 AI 产品分析助手</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            注册即得 1000 积分,从产品分析场景模板一键 fork,30 分钟体验。
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
