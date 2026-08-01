'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Check,
  ArrowRight,
  MessageSquare,
  Code,
  FileText,
  Database,
  Brain,
  Users,
  Zap,
  Shield,
} from 'lucide-react'
import { Button } from '@ihui/ui-react'

export interface UseCase {
  id: 'customer-support' | 'knowledge-base' | 'code-assistant' | 'content-generation'
  slug: string
  titleKey: string
  subtitleKey: string
  icon: React.ComponentType<{ className?: string }>
  heroBadge: string
  problemTitle: string
  problems: string[]
  solutionTitle: string
  solutionPoints: Array<{ title: string; desc: string }>
  howItWorks: Array<{ step: number; title: string; desc: string }>
  benefits: Array<{
    title: string
    desc: string
    icon: React.ComponentType<{ className?: string }>
  }>
  metrics: Array<{ value: string; label: string }>
}

export const USE_CASES: Record<UseCase['id'], UseCase> = {
  'customer-support': {
    id: 'customer-support',
    slug: 'customer-support',
    titleKey: 'useCase.customerSupport.title',
    subtitleKey: 'useCase.customerSupport.subtitle',
    icon: MessageSquare,
    heroBadge: '客户支持',
    problemTitle: '客服团队面临的真实挑战',
    problems: [
      '人工客服 7×24 在线成本高,夜间/节假日响应慢',
      'FAQ 散落在多个系统(邮件/微信/网页),新人培训成本高',
      '知识库更新滞后,客服给出过期或错误答案',
      '客户咨询高峰时段排队严重,满意度下降',
      '多语言客户咨询需要不同语种客服,人力翻倍',
    ],
    solutionTitle: 'IHUI AI 智能客服 Agent 解决方案',
    solutionPoints: [
      {
        title: '7×24 智能接待',
        desc: 'AI Agent 全天候响应,0 秒排队,常见问题自动解答,复杂问题无缝转人工。',
      },
      {
        title: '统一知识库',
        desc: '整合企业所有文档(产品手册/FAQ/工单历史/政策文件),AI 实时检索,答案准确。',
      },
      {
        title: '多模型智能路由',
        desc: '根据问题复杂度自动选择模型:简单 FAQ 用 GPT-4o-mini 节省成本,复杂问题用 GPT-4o 提升质量。',
      },
      {
        title: '多渠道部署',
        desc: '同一 Agent 部署到网页/微信/小程序/邮件/电话,客户从任何渠道进入都获得一致体验。',
      },
      {
        title: '人机协同',
        desc: 'AI 不确定时自动转人工,并把对话上下文、推荐答案一并呈现,人工只需确认或微调。',
      },
    ],
    howItWorks: [
      {
        step: 1,
        title: '上传知识库',
        desc: '导入产品手册/FAQ/历史工单,AI 自动向量化,5 分钟即可上线。',
      },
      {
        step: 2,
        title: '配置 Agent',
        desc: '从客服场景模板 fork,配置欢迎语/转人工规则/品牌话术。',
      },
      {
        step: 3,
        title: '多渠道发布',
        desc: '一键发布到 Web/微信/小程序/邮件,所有渠道共享同一知识库。',
      },
      { step: 4, title: '持续优化', desc: '查看对话日志,标注 AI 错误答案,系统自动迭代知识库。' },
    ],
    benefits: [
      { title: '成本降低 70%', desc: 'AI 解决 80% 常见问题,人工只需处理复杂咨询。', icon: Zap },
      {
        title: '响应时间 0 秒',
        desc: '7×24 即时响应,无排队,客户满意度提升 40%。',
        icon: MessageSquare,
      },
      { title: '答案一致性', desc: '统一知识库,所有客服(AI/人工)给出标准答案。', icon: Shield },
      { title: '数据驱动改进', desc: '所有对话可分析,识别高频问题,反哺产品改进。', icon: Brain },
    ],
    metrics: [
      { value: '70%', label: '成本降低' },
      { value: '0s', label: '平均响应' },
      { value: '80%', label: 'AI 解决率' },
      { value: '5min', label: '上线时间' },
    ],
  },
  'knowledge-base': {
    id: 'knowledge-base',
    slug: 'knowledge-base',
    titleKey: 'useCase.knowledgeBase.title',
    subtitleKey: 'useCase.knowledgeBase.subtitle',
    icon: Database,
    heroBadge: '企业知识库',
    problemTitle: '企业知识管理的痛点',
    problems: [
      '员工每天花 30% 时间找信息,效率严重低下',
      '文档散落在 Confluence/钉钉/微信/邮件,搜索困难',
      '新人入职培训依赖老员工口口相传,知识流失',
      '客户合同/技术文档/合规文件无法快速复用',
      '跨部门协作时找不到对的人和对的文档',
    ],
    solutionTitle: 'IHUI AI 企业知识库 RAG 解决方案',
    solutionPoints: [
      {
        title: '全量文档接入',
        desc: '支持 PDF/Word/Markdown/Notion/Confluence/网页,定时增量更新,知识永不过期。',
      },
      {
        title: '语义检索 + 关键词',
        desc: '向量 + BM25 混合检索,准确率比纯关键词高 60%,召回率比纯向量高 35%。',
      },
      {
        title: '知识图谱',
        desc: '自动抽取实体关系,支持「找出所有和张三相关的产品文档」这类复杂查询。',
      },
      {
        title: '权限精细管控',
        desc: '按部门/角色/文档密级设置可见性,合规审计不担心。',
      },
      {
        title: '多端问答',
        desc: '员工从 Web/Slack/钉钉/微信/CLI 任何入口提问,获得一致的智能答案。',
      },
    ],
    howItWorks: [
      {
        step: 1,
        title: '连接数据源',
        desc: '对接 Confluence/Notion/SharePoint/S3 等 30+ 数据源,自动同步。',
      },
      {
        step: 2,
        title: '智能解析',
        desc: 'PDF 表格、Word 图片、Markdown 链接自动抽取,无信息丢失。',
      },
      {
        step: 3,
        title: '向量化索引',
        desc: '选择嵌入模型(支持中文优化版),构建混合索引,分钟级完成。',
      },
      {
        step: 4,
        title: '智能问答',
        desc: '员工提问,AI 给出答案 + 引用来源,点击可跳转到原文段落。',
      },
    ],
    benefits: [
      {
        title: '找信息时间 -70%',
        desc: '从平均 30 分钟找一份文档到 30 秒获得精准答案。',
        icon: Zap,
      },
      { title: '准确率 95%+', desc: '混合检索 + 引用回溯,每个答案都可追溯到原文。', icon: Check },
      { title: '零培训上手', desc: '自然语言提问,无需学习复杂搜索语法。', icon: Users },
      {
        title: '合规安全',
        desc: '细粒度权限 + 审计日志,满足金融/医疗/政企合规要求。',
        icon: Shield,
      },
    ],
    metrics: [
      { value: '70%', label: '找信息时间降低' },
      { value: '95%', label: '答案准确率' },
      { value: '30+', label: '数据源接入' },
      { value: '60s', label: '平均响应' },
    ],
  },
  'code-assistant': {
    id: 'code-assistant',
    slug: 'code-assistant',
    titleKey: 'useCase.codeAssistant.title',
    subtitleKey: 'useCase.codeAssistant.subtitle',
    icon: Code,
    heroBadge: '代码助手',
    problemTitle: '开发团队的效率瓶颈',
    problems: [
      '资深工程师时间被 code review 和新人答疑挤占',
      '团队代码规范/架构决策散落在 wiki 和老员工脑中',
      '新人 onboarding 周期长(2-3 个月),项目上手慢',
      '重复代码、相似 bug 反复出现,缺乏历史经验沉淀',
      '代码生成工具与团队规范脱节,产出的代码需大量返工',
    ],
    solutionTitle: 'IHUI AI 代码助手 Agent 解决方案',
    solutionPoints: [
      {
        title: '团队代码库 RAG',
        desc: 'Agent 学习整个团队仓库的代码风格/架构决策/常用模式,生成的代码符合团队规范。',
      },
      {
        title: '智能 Code Review',
        desc: '自动识别潜在 bug/性能问题/安全漏洞,引用历史 PR 给出改进建议,资深只需 review AI 标记的关键变更。',
      },
      {
        title: '新人导师',
        desc: '新人遇到问题直接问 Agent,Agent 根据团队代码库给出符合项目实际的推荐做法答案。',
      },
      {
        title: '多 IDE 集成',
        desc: '通过 MCP 协议集成 VSCode/Cursor/JetBrains,编辑器内直接调用,无需切换工具。',
      },
      {
        title: '私有化部署',
        desc: '代码是企业核心资产,自托管保证源代码 100% 不出企业内网。',
      },
    ],
    howItWorks: [
      { step: 1, title: '仓库索引', desc: '连接 GitHub/GitLab,索引代码/Issue/PR/Wiki,自动同步。' },
      {
        step: 2,
        title: 'Agent 训练',
        desc: '从团队历史 PR/Code Review 中学习代码风格,自动生成团队规范文档。',
      },
      {
        step: 3,
        title: 'IDE 集成',
        desc: '通过 MCP Server 接入 VSCode/Cursor/JetBrains,代码补全/解释/重构一键完成。',
      },
      {
        step: 4,
        title: 'PR 智能审查',
        desc: 'PR 提交时自动触发,AI 给出 review 意见,标记需要人类 review 的关键变更。',
      },
    ],
    benefits: [
      { title: '新人上手 1 周', desc: '从 2-3 月缩到 1 周,Agent 7×24 答疑。', icon: Zap },
      { title: '代码规范 100%', desc: 'AI 学习团队规范,生成的代码无需返工。', icon: Check },
      { title: '资深时间释放', desc: 'Code Review 时间 -50%,资深专注架构设计。', icon: Users },
      { title: '代码资产 0 泄露', desc: '私有化部署,源代码不出企业。', icon: Shield },
    ],
    metrics: [
      { value: '50%', label: 'Code Review 时间降低' },
      { value: '1 周', label: '新人上手' },
      { value: '100%', label: '代码规范遵循' },
      { value: '0 泄露', label: '代码资产安全' },
    ],
  },
  'content-generation': {
    id: 'content-generation',
    slug: 'content-generation',
    titleKey: 'useCase.contentGeneration.title',
    subtitleKey: 'useCase.contentGeneration.subtitle',
    icon: FileText,
    heroBadge: '内容创作',
    problemTitle: '内容团队的产能瓶颈',
    problems: [
      '公众号/知乎/小红书/抖音多平台运营,每个平台调性不同,内容重复生产',
      '营销文案需要 SEO 关键词 + 品牌调性 + 平台算法,人工写效率低',
      '选题策划依赖少数资深编辑,产能受限',
      'A/B 测试需大量素材,人工生产速度跟不上',
      '多语言版本(中/英/日/韩)需要不同语种编辑,成本高',
    ],
    solutionTitle: 'IHUI AI 内容创作 Agent 解决方案',
    solutionPoints: [
      {
        title: '一键多平台改写',
        desc: '一篇 3000 字深度文章,AI 自动改写为小红书短文/抖音脚本/知乎回答/Twitter 推文,各平台调性匹配。',
      },
      {
        title: 'SEO 智能优化',
        desc: '输入目标关键词,AI 自动生成 SEO 友好的标题/Meta/正文结构,内置主流 SEO 规则。',
      },
      {
        title: '多语言本地化',
        desc: 'AI 生成中/英/日/韩/繁体多语言版本,自动匹配各地区文化习惯和搜索习惯。',
      },
      {
        title: '品牌调性统一',
        desc: '上传品牌指南 + 历史爆款文章,AI 学习调性后所有产出符合品牌。',
      },
      {
        title: '数据驱动迭代',
        desc: '接入各平台数据(阅读/点赞/转化),AI 自动识别高表现内容模式,反哺下一轮创作。',
      },
    ],
    howItWorks: [
      {
        step: 1,
        title: '上传品牌资料',
        desc: '上传品牌指南/历史爆款文章/产品文档,AI 学习品牌调性。',
      },
      {
        step: 2,
        title: '选题策划',
        desc: '输入关键词或行业趋势,AI 生成 20+ 选题方案 + 预估流量价值。',
      },
      { step: 3, title: '一键生成', desc: '选定选题,AI 生成多平台多语言版本,人工微调后发布。' },
      { step: 4, title: '效果追踪', desc: '接入平台数据,AI 复盘高表现内容,持续优化生成策略。' },
    ],
    benefits: [
      { title: '产能 ×10', desc: '一篇深度文一键产出 5 个平台版本,效率提升 10 倍。', icon: Zap },
      { title: '多语言成本 -80%', desc: 'AI 翻译本地化,无需外包 4 个语种编辑。', icon: Users },
      { title: 'SEO 友好', desc: '内置 SEO 规则,内容自然排名提升。', icon: Check },
      { title: '品牌一致', desc: '所有内容符合品牌调性,无人工遗忘或走偏。', icon: Shield },
    ],
    metrics: [
      { value: '×10', label: '内容产能' },
      { value: '80%', label: '多语言成本降低' },
      { value: '5 平台', label: '一键改写' },
      { value: '5 语言', label: 'AI 翻译' },
    ],
  },
}

export function UseCaseContent({ useCaseId }: { useCaseId: UseCase['id'] }): React.JSX.Element {
  const uc = USE_CASES[useCaseId]
  const Icon = uc.icon

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
      {/* Hero */}
      <section className="space-y-5 text-center">
        <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {uc.heroBadge}
        </div>
        <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
          {uc.id === 'customer-support' && 'AI 智能客服 Agent:7×24 高质量服务体验'}
          {uc.id === 'knowledge-base' && '企业知识库 RAG:让每个员工都拥有 AI 助手'}
          {uc.id === 'code-assistant' && 'AI 代码助手:让团队开发效率提升 50%'}
          {uc.id === 'content-generation' && 'AI 内容创作:多平台多语言一键产出'}
        </h1>
        <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
          基于 IHUI AI 全栈 AI 操作系统搭建,Apache 2.0 开源,支持私有化。
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
          {uc.metrics.map((m) => (
            <div key={m.label} className="text-center">
              <div className="text-2xl font-bold text-primary min-[768px]:text-3xl">{m.value}</div>
              <div className="mt-1 text-xs text-muted-foreground min-[768px]:text-sm">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 痛点 */}
      <section className="mt-16 rounded-2xl border bg-card p-5 min-[768px]:p-8 min-[1024px]:p-12">
        <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">{uc.problemTitle}</h2>
        <ul className="mt-6 space-y-3">
          {uc.problems.map((p, i) => (
            <li
              key={i}
              className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground min-[768px]:text-base"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
              {p}
            </li>
          ))}
        </ul>
      </section>

      {/* 解决方案 */}
      <section className="mt-16">
        <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">
          {uc.solutionTitle}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-6 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {uc.solutionPoints.map((sp, i) => (
            <div key={i} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                {i + 1}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{sp.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{sp.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 工作流程 */}
      <section className="mt-16">
        <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">4 步落地</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 min-[768px]:grid-cols-4">
          {uc.howItWorks.map((hw) => (
            <div key={hw.step} className="rounded-2xl border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground">
                {hw.step}
              </div>
              <h3 className="mt-4 text-base font-semibold">{hw.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{hw.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 核心收益 */}
      <section className="mt-16 rounded-2xl border bg-primary/5 p-5 min-[768px]:p-8 min-[1024px]:p-12">
        <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">核心收益</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-4">
          {uc.benefits.map((b, i) => {
            const BIcon = b.icon
            return (
              <div key={i} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <BIcon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-3 text-base font-semibold">{b.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-16 rounded-2xl border bg-card p-8 text-center min-[768px]:p-12">
        <Sparkles className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">开始你的 AI 用例</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
          注册即得 1000 积分,从用例模板一键 fork,5 分钟体验。
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/sso/register">免费注册</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/use-cases">
              查看其他用例 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
