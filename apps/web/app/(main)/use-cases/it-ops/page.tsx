import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, Server } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/use-cases/it-ops#webpage',
      url: 'https://ihui.ai/use-cases/it-ops',
      name: 'AI IT 运维 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的 AI IT 运维 Agent:故障诊断、工单分诊、日志分析、变更审核、容量预测,30 分钟上线,6 端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: { '@id': 'https://ihui.ai/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/use-cases/it-ops#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://ihui.ai/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI IT 运维', item: 'https://ihui.ai/use-cases/it-ops' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://ihui.ai/use-cases/it-ops#howto',
      name: '30 分钟搭建 AI IT 运维 Agent',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建 AI IT 运维 Agent 的 6 步流程:接入监控 → 训练诊断 Agent → 配置工单分诊 → 集成日志分析 → 设置变更审核 → 启用容量预测。故障自愈率 70%。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '监控指标/历史工单/日志归档/变更记录' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 故障诊断引擎' },
        { '@type': 'HowToTool', name: 'IHUI AI 日志分析器' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '接入监控系统', text: '对接 Prometheus/Zabbix/Datadog/云监控,统一告警 schema,Agent 接收所有告警事件。' },
        { '@type': 'HowToStep', position: 2, name: '训练诊断 Agent', text: '导入历史故障工单与解决方案,Agent 学习根因分析模式,新故障 30 秒内给出定位建议。' },
        { '@type': 'HowToStep', position: 3, name: '配置工单分诊', text: '基于故障类型/影响范围/紧急度,Agent 自动分诊到对应团队,80% 工单无需人工分流。' },
        { '@type': 'HowToStep', position: 4, name: '集成日志分析', text: '对接 ELK/Loki/Splunk,Agent 自动关联多服务日志,定位异常 span,日志分析准确率 90%+。' },
        { '@type': 'HowToStep', position: 5, name: '设置变更审核', text: 'PR/变更单提交时,Agent 基于历史故障库自动识别高风险变更,阻塞或要求二次 review。' },
        { '@type': 'HowToStep', position: 6, name: '启用容量预测', text: '基于历史资源使用趋势,Agent 预测 30/60/90 天容量瓶颈,提前扩容,避免雪崩。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI IT 运维 Agent — 故障诊断/工单分诊/日志分析 | IHUI AI',
  description:
    '用 IHUI AI 构建 AI IT 运维 Agent:故障诊断 + 工单分诊 + 日志分析 + 变更审核 + 容量预测。30 分钟上线,6 端分发。',
  alternates: { canonical: '/use-cases/it-ops' },
  openGraph: {
    title: 'AI IT 运维 Agent — IHUI AI',
    description: '故障诊断 + 工单分诊 + 日志分析,30 分钟上线。',
    url: 'https://ihui.ai/use-cases/it-ops',
    type: 'article',
  },
}

const capabilities = [
  { title: '故障诊断', desc: 'AI 学习历史故障模式,新告警 30 秒内给出根因定位建议与修复方案,MTTR 降低 60%。' },
  { title: '工单自动分诊', desc: '基于故障类型/影响范围/紧急度自动分诊到对应团队,80% 工单无需人工分流,oncall 减负。' },
  { title: '日志智能分析', desc: '对接 ELK/Loki/Splunk,自动关联多服务日志,定位异常 span,日志分析准确率 90%+。' },
  { title: '变更审核', desc: 'PR/变更单提交时,基于历史故障库自动识别高风险变更,阻塞或要求二次 review,防患于未然。' },
  { title: '容量预测', desc: '基于历史资源使用趋势,预测 30/60/90 天容量瓶颈,提前扩容,避免雪崩与服务降级。' },
  { title: '运维复盘', desc: '每周生成运维复盘报告,故障频次/MTTR/根因 TOP10 一览,持续优化稳定性。' },
]

const steps = [
  { step: 1, title: '接入监控', desc: '对接 Prometheus/Zabbix/Datadog,统一告警 schema。' },
  { step: 2, title: '训练诊断 Agent', desc: '导入历史工单,新故障 30 秒给出定位建议。' },
  { step: 3, title: '配置工单分诊', desc: '基于类型/影响/紧急度自动分诊,80% 自动化。' },
  { step: 4, title: '集成日志分析', desc: '对接 ELK/Loki,多服务日志关联定位异常。' },
  { step: 5, title: '设置变更审核', desc: '高风险变更自动识别,阻塞或要求 review。' },
  { step: 6, title: '启用容量预测', desc: '预测 30/60/90 天瓶颈,提前扩容避免雪崩。' },
]

const metrics = [
  { value: '70%', label: '故障自愈率' },
  { value: '80%', label: '工单自动分诊' },
  { value: '60%', label: 'MTTR 降低' },
  { value: '30min', label: '上线时间' },
]

export default function ItOpsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Server className="h-3.5 w-3.5 text-primary" />
            IT 运维
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            AI IT 运维 Agent:故障诊断 + 工单分诊 + 日志分析
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            基于 IHUI AI 全栈 AI 操作系统搭建,30 分钟上线,6 端分发,Apache 2.0 开源,支持私有化。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
            {metrics.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-2xl font-bold text-primary md:text-3xl">{m.value}</div>
                <div className="mt-1 text-xs text-muted-foreground md:text-sm">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">6 大核心能力</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">6 步落地</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

        <section className="mt-16 rounded-2xl border bg-card p-8 text-center md:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">开始构建你的 AI IT 运维助手</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            注册即得 1000 积分,从 IT 运维场景模板一键 fork,30 分钟体验。
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
