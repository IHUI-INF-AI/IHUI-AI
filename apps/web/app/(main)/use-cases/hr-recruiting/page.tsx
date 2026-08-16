import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, Users } from 'lucide-react'
import { BackButton } from '@/components/common'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/use-cases/hr-recruiting#webpage',
      url: 'https://aizhs.top/use-cases/hr-recruiting',
      name: 'AI HR 招聘 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的 AI HR 招聘 Agent:简历智能筛选、面试问题生成、入职引导自动化、员工答疑、离职预警,30 分钟上线,6 端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/use-cases/hr-recruiting#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'AI HR 招聘',
          item: 'https://aizhs.top/use-cases/hr-recruiting',
        },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/use-cases/hr-recruiting#howto',
      name: '30 分钟搭建 AI HR 招聘 Agent',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建 AI HR 招聘 Agent 的 6 步流程:接入招聘系统 → 训练筛选 Agent → 配置面试模板 → 集成答疑知识库 → 设置离职预警 → 监控优化。招聘周期缩短 50%。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: 'JD 库/历史简历/员工手册/绩效数据' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI Agent 设计器' },
        { '@type': 'HowToTool', name: 'IHUI AI HR 系统集成器' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: '接入招聘系统',
          text: '对接 BOSS/拉勾/Moka/Greenhouse,导入 JD 库与历史简历,建立人才画像基线。',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: '训练筛选 Agent',
          text: '上传历史录用/淘汰简历,AI 学习岗位匹配规则,自动给新简历打分排序。',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: '配置面试模板',
          text: '按岗位/级别配置面试问题库,Agent 根据简历动态生成定制化面试题与考察重点。',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: '集成答疑知识库',
          text: '上传员工手册/政策文档,Agent 7×24 回答员工关于福利/请假/报销等问题。',
        },
        {
          '@type': 'HowToStep',
          position: 5,
          name: '设置离职预警',
          text: '基于考勤/绩效/IM 活跃度等信号,Agent 提前 30 天预警高离职风险员工。',
        },
        {
          '@type': 'HowToStep',
          position: 6,
          name: '监控与优化',
          text: '每周生成招聘漏斗报告,识别瓶颈环节,自动给出 JD 优化与渠道调整建议。',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI HR 招聘 Agent — 简历筛选/面试生成/入职引导 | IHUI AI',
  description:
    '用 IHUI AI 构建 AI HR 招聘 Agent:简历智能筛选 + 面试问题生成 + 入职引导 + 员工答疑 + 离职预警。30 分钟上线,6 端分发。',
  alternates: { canonical: '/use-cases/hr-recruiting' },
  openGraph: {
    title: 'AI HR 招聘 Agent — IHUI AI',
    description: '简历筛选 + 面试生成 + 员工答疑,30 分钟上线。',
    url: 'https://aizhs.top/use-cases/hr-recruiting',
    type: 'article',
  },
}

const capabilities = [
  {
    title: '简历智能筛选',
    desc: 'AI 解析简历并与 JD 匹配,自动给分排序,HR 只看 Top 20%,筛选时间从 3 天缩到 30 分钟。',
  },
  {
    title: '面试问题生成',
    desc: '基于候选人简历动态生成定制化面试题,涵盖技术/行为/文化匹配,避免千人一面。',
  },
  {
    title: '入职引导自动化',
    desc: '新员工入职 Day 1 即获得 AI 助手,回答关于流程/工具/团队的所有问题,onboarding 周期缩短 60%。',
  },
  {
    title: '员工答疑 7×24',
    desc: '上传员工手册/政策文档,Agent 实时回答福利/请假/报销等问题,HR 事务性工单降低 80%。',
  },
  {
    title: '离职预警',
    desc: '基于考勤/绩效/IM 活跃度多维度信号,Agent 提前 30 天预警高离职风险员工,主管主动介入。',
  },
  {
    title: '招聘复盘',
    desc: '自动生成招聘漏斗报告,识别瓶颈环节(简历通过率/offer 接受率),JD 优化建议。',
  },
]

const steps = [
  { step: 1, title: '接入招聘系统', desc: '对接 BOSS/拉勾/Moka,导入 JD 库与历史简历。' },
  { step: 2, title: '训练筛选 Agent', desc: 'AI 学习录用/淘汰规则,自动给新简历打分。' },
  { step: 3, title: '配置面试模板', desc: '按岗位配置问题库,动态生成定制化面试题。' },
  { step: 4, title: '集成答疑知识库', desc: '上传员工手册,7×24 回答员工问题。' },
  { step: 5, title: '设置离职预警', desc: '多维信号提前 30 天预警高离职风险。' },
  { step: 6, title: '监控优化', desc: '招聘漏斗报告,识别瓶颈并优化 JD。' },
]

const metrics = [
  { value: '80%', label: '简历筛选自动化' },
  { value: '50%', label: '招聘周期缩短' },
  { value: '90%', label: '员工答疑解决率' },
  { value: '30min', label: '上线时间' },
]

export default function HrRecruitingPage() {
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
            <Users className="h-3.5 w-3.5 text-primary" />
            HR 招聘
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI HR 招聘 Agent:简历筛选 + 面试生成 + 入职引导
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
            开始构建你的 AI HR 招聘助手
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            注册即得 1000 积分,从 HR 场景模板一键 fork,30 分钟体验。
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
