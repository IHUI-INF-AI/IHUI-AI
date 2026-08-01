import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, TrendingUp } from 'lucide-react'
import { BackButton } from '@/components/common'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/use-cases/sales#webpage',
      url: 'https://aizhs.top/use-cases/sales',
      name: 'AI 销售助手 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的 AI 销售助手 Agent:线索自动分级、话术实时教练、CRM 自动化、合同生成、回款预测,30 分钟上线,6 端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/use-cases/sales#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 销售助手', item: 'https://aizhs.top/use-cases/sales' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/use-cases/sales#howto',
      name: '30 分钟搭建 AI 销售助手 Agent',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建 AI 销售助手 Agent 的 6 步流程:接入 CRM → 训练话术 → 配置分级 → 集成渠道 → 自动化合同回款 → 监控优化。线索转化率提升 3 倍。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: 'CRM 历史线索/成交记录/产品话术库' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI Agent 设计器' },
        { '@type': 'HowToTool', name: 'IHUI AI CRM 集成连接器' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '接入 CRM 数据', text: '对接 Salesforce/HubSpot/纷享销客等 CRM,导入历史线索、成交记录、客户画像。' },
        { '@type': 'HowToStep', position: 2, name: '训练话术 Agent', text: '上传销冠通话录音与 IM 记录,AI 学习 Top Sales 话术模式,生成教练 Agent。' },
        { '@type': 'HowToStep', position: 3, name: '配置线索分级', text: '基于 BANT/MEDDIC 模型自动给线索打分,A/B/C/D 级自动路由给对应销售。' },
        { '@type': 'HowToStep', position: 4, name: '集成通话与 IM 渠道', text: '接入电话/企微/钉钉/邮件,Agent 实时监听对话,推送话术建议与异议处理。' },
        { '@type': 'HowToStep', position: 5, name: '自动化合同与回款', text: 'AI 生成合同初稿(模板 + 谈判记录),自动跟踪回款节点,逾期预警。' },
        { '@type': 'HowToStep', position: 6, name: '监控与优化', text: '分析转化漏斗,识别话术短板,每周自动生成销售复盘报告与改进建议。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 销售助手 Agent — 线索分级/话术教练/CRM 自动化 | IHUI AI',
  description:
    '用 IHUI AI 构建 AI 销售助手:线索自动分级 + 话术实时教练 + CRM 自动化 + 合同生成 + 回款预测。30 分钟上线,6 端分发。',
  alternates: { canonical: '/use-cases/sales' },
  openGraph: {
    title: 'AI 销售助手 Agent — IHUI AI',
    description: '线索分级 + 话术教练 + CRM 自动化,30 分钟上线。',
    url: 'https://aizhs.top/use-cases/sales',
    type: 'article',
  },
}

const capabilities = [
  { title: '线索自动分级', desc: '基于 BANT/MEDDIC 模型,AI 给每条线索打分,A/B/C/D 自动路由,销售专注高价值客户。' },
  { title: '话术实时教练', desc: '学习销冠通话模式,实时推送话术建议、异议处理、下一步动作,新人 1 周达到老销售 70% 水平。' },
  { title: 'CRM 自动化', desc: '通话/邮件/IM 自动归档到 CRM,客户画像、跟进记录、商机阶段自动更新,告别手工录入。' },
  { title: '合同一键生成', desc: '基于模板 + 谈判记录,AI 生成合同初稿,法务只需 review 关键条款,合同周期从 7 天缩到 1 天。' },
  { title: '回款预测', desc: '基于历史数据 + 当前商机阶段,预测本月/季度回款金额,准确率 90%+,财务规划不再拍脑袋。' },
  { title: '销售复盘', desc: '每周自动生成团队/个人复盘报告,识别话术短板、转化漏斗瓶颈,数据驱动改进。' },
]

const steps = [
  { step: 1, title: '接入 CRM', desc: '对接 Salesforce/HubSpot/纷享销客,导入历史线索与成交记录。' },
  { step: 2, title: '训练话术', desc: '上传销冠通话录音,AI 学习 Top Sales 话术模式。' },
  { step: 3, title: '配置分级', desc: 'BANT/MEDDIC 模型自动打分,A/B/C/D 自动路由。' },
  { step: 4, title: '集成渠道', desc: '接入电话/企微/钉钉/邮件,实时话术推送。' },
  { step: 5, title: '自动化合同', desc: 'AI 生成合同初稿,自动跟踪回款节点。' },
  { step: 6, title: '监控优化', desc: '每周自动复盘,识别话术短板与漏斗瓶颈。' },
]

const metrics = [
  { value: '3×', label: '线索转化率' },
  { value: '70%', label: '话术水平提升' },
  { value: '90%', label: '回款预测准确率' },
  { value: '30min', label: '上线时间' },
]

export default function SalesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        <BackButton />
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            销售助手
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 销售助手 Agent:线索分级 + 话术教练 + CRM 自动化
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
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">开始构建你的 AI 销售助手</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            注册即得 1000 积分,从销售场景模板一键 fork,30 分钟体验。
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
