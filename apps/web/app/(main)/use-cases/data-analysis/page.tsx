import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, Database } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/use-cases/data-analysis#webpage',
      url: 'https://aizhs.top/use-cases/data-analysis',
      name: 'AI 数据分析 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的 AI 数据分析 Agent:自然语言取数、报表生成、异常检测、归因分析、数据治理,30 分钟上线,6 端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/use-cases/data-analysis#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 数据分析', item: 'https://aizhs.top/use-cases/data-analysis' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/use-cases/data-analysis#howto',
      name: '30 分钟搭建 AI 数据分析 Agent',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建 AI 数据分析 Agent 的 6 步流程:接入数据库 → 训练 NL2SQL → 配置报表模板 → 设置异常检测 → 启用归因分析 → 输出治理建议。取数效率提升 10 倍。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '数据库/数仓访问权限/历史报表模板/业务指标定义' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI NL2SQL 引擎' },
        { '@type': 'HowToTool', name: 'IHUI AI 异常检测模型' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '接入数据库与数仓', text: '对接 MySQL/PostgreSQL/ClickHouse/Hive/Snowflake,自动读取 schema 与表关系,构建数据字典。' },
        { '@type': 'HowToStep', position: 2, name: '训练 NL2SQL Agent', text: '上传业务术语表与历史 SQL,Agent 学习表结构语义,自然语言提问即可生成正确 SQL,准确率 95%+。' },
        { '@type': 'HowToStep', position: 3, name: '配置报表模板', text: '上传历史报表模板,Agent 自动生成日/周/月报,定时推送到飞书/企微/邮件,80% 报表无需手工。' },
        { '@type': 'HowToStep', position: 4, name: '设置异常检测', text: '基于历史数据训练时序模型,自动检测指标异常波动,5 分钟内预警,召回率 90%+。' },
        { '@type': 'HowToStep', position: 5, name: '启用归因分析', text: '指标异常时,Agent 自动归因(维度下钻 + 相关性分析),定位根因维度,归因准确率 85%+。' },
        { '@type': 'HowToStep', position: 6, name: '输出治理建议', text: 'Agent 扫描数据质量(缺失/重复/不一致),每周输出数据治理建议,数据资产可信度提升。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 数据分析 Agent — 自然语言取数/报表/归因 | IHUI AI',
  description:
    '用 IHUI AI 构建 AI 数据分析 Agent:自然语言取数 + 报表生成 + 异常检测 + 归因分析 + 数据治理。30 分钟上线,6 端分发。',
  alternates: { canonical: '/use-cases/data-analysis' },
  openGraph: {
    title: 'AI 数据分析 Agent — IHUI AI',
    description: '自然语言取数 + 异常检测 + 归因分析,30 分钟上线。',
    url: 'https://aizhs.top/use-cases/data-analysis',
    type: 'article',
  },
}

const capabilities = [
  { title: '自然语言取数', desc: '业务方用自然语言提问,Agent 生成正确 SQL 并返回结果,取数效率提升 10 倍,告别排期等数据。' },
  { title: '报表自动生成', desc: '上传历史报表模板,Agent 自动生成日/周/月报,定时推送飞书/企微/邮件,80% 报表无需手工。' },
  { title: '异常检测', desc: '基于时序模型自动检测指标异常波动,5 分钟内预警,召回率 90%+,业务问题早发现。' },
  { title: '归因分析', desc: '指标异常时自动归因(维度下钻 + 相关性分析),定位根因维度,归因准确率 85%+,告别拍脑袋。' },
  { title: '数据治理', desc: '扫描数据质量(缺失/重复/不一致),每周输出治理建议,数据资产可信度持续提升。' },
  { title: '分析复盘', desc: '每月生成分析复盘报告,高频问题/取数 TOP10/异常事件一览,数据团队价值可见。' },
]

const steps = [
  { step: 1, title: '接入数据源', desc: '对接 MySQL/PG/ClickHouse/Hive,自动构建数据字典。' },
  { step: 2, title: '训练 NL2SQL', desc: '上传术语表与历史 SQL,自然语言取数准确率 95%。' },
  { step: 3, title: '配置报表模板', desc: '上传历史模板,日/周/月报自动推送。' },
  { step: 4, title: '设置异常检测', desc: '时序模型自动检测,5 分钟预警,召回 90%。' },
  { step: 5, title: '启用归因分析', desc: '异常时自动归因,定位根因维度,准确率 85%。' },
  { step: 6, title: '输出治理建议', desc: '扫描数据质量,每周输出治理建议。' },
]

const metrics = [
  { value: '10×', label: '取数效率' },
  { value: '80%', label: '报表自动化' },
  { value: '90%', label: '异常检测召回率' },
  { value: '30min', label: '上线时间' },
]

export default function DataAnalysisPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Database className="h-3.5 w-3.5 text-primary" />
            数据分析
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 数据分析 Agent:自然语言取数 + 报表 + 归因
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
          <div className="mt-8 grid gap-6 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-3">
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
          <div className="mt-8 grid gap-4 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-3">
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
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">开始构建你的 AI 数据分析助手</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            注册即得 1000 积分,从数据分析场景模板一键 fork,30 分钟体验。
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
