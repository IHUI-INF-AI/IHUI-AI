import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  AlertTriangle,
  Wrench,
  MessageSquare,
  GraduationCap,
  Palette,
  Globe,
} from 'lucide-react'
import { BackButton } from '@/components/common'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/use-cases/ai-research#webpage',
      url: 'https://aizhs.top/use-cases/ai-research',
      name: 'AI 学术研究助手 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的 AI 学术研究助手:论文检索/综述、PDF 解析、引用管理、研究趋势分析、跨学科知识图谱,30 分钟上线,8 端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/use-cases/ai-research#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'AI 学术研究',
          item: 'https://aizhs.top/use-cases/ai-research',
        },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/use-cases/ai-research#howto',
      name: '30 分钟搭建 AI 学术研究助手',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建 AI 学术研究助手的 6 步流程:接入数据库 → 上传文献 → 配置引用样式 → 训练综述模型 → 构建知识图谱 → 输出趋势报告。文献调研效率提升 8 倍。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [
        { '@type': 'HowToSupply', name: '研究领域关键词/既往文献 PDF/引用样式(APA/MLA/Chicago)' },
      ],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 文献检索引擎' },
        { '@type': 'HowToTool', name: 'IHUI AI PDF 解析模块' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: '接入学术数据库',
          text: '对接 arXiv/PubMed/IEEE/知网/万方/CNKI 等 30+ 数据库,定时抓取新发表论文。',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: '上传文献 PDF',
          text: '批量上传历史 PDF 文献,AI 自动抽取标题/作者/摘要/参考文献,构建本地文献库。',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: '配置引用样式',
          text: '选择 APA/MLA/Chicago/GB/T 7714 等主流引用样式,Agent 自动生成符合规范的参考文献。',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: '训练综述模型',
          text: 'Agent 学习团队既往综述写作风格,基于本地文献库生成符合学术规范的文献综述。',
        },
        {
          '@type': 'HowToStep',
          position: 5,
          name: '构建知识图谱',
          text: '抽取论文中的实体(作者/机构/方法/数据集)与关系,生成跨学科知识图谱,支持探索性查询。',
        },
        {
          '@type': 'HowToStep',
          position: 6,
          name: '输出趋势报告',
          text: '基于时间序列与主题模型,每周输出研究热点/新兴方法/潜在合作者报告。',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 学术研究助手 — 论文检索/综述/引用管理 | IHUI AI',
  description:
    '用 IHUI AI 构建 AI 学术研究助手:论文检索 + PDF 解析 + 引用管理 + 综述生成 + 知识图谱 + 趋势分析。30 分钟上线,8 端分发,Apache 2.0 开源。',
  alternates: { canonical: '/use-cases/ai-research' },
  openGraph: {
    title: 'AI 学术研究助手 — IHUI AI',
    description: '文献检索 + 综述生成 + 知识图谱,30 分钟上线。',
    url: 'https://aizhs.top/use-cases/ai-research',
    type: 'article',
  },
}

const problems = [
  'arXiv/PubMed/知网/万方/Google Scholar 跨库检索耗时,新人需要 2-3 个月才能熟悉本领域核心文献',
  'PDF 文献堆积,人工阅读 100 篇论文平均要 40 小时,信息提取效率极低',
  '参考文献格式(APA/MLA/Chicago/GB/T 7714)人工整理易出错,影响投稿',
  '文献综述写作依赖个人经验,跨学科关联难以发现,创新点挖掘受限',
  '研究热点快速变化,人工追踪周报/月报产出滞后,容易错过合作机会',
  '课题组成员文献库各自维护,知识资产无法在团队内沉淀与复用',
]

const capabilities = [
  {
    title: '30+ 数据库跨库检索',
    desc: '对接 arXiv/PubMed/IEEE/知网/万方/Springer/Elsevier 等学术数据库,统一检索入口,新论文每日自动入库。',
  },
  {
    title: 'PDF 智能解析',
    desc: '批量解析 PDF 提取标题/作者/摘要/图表/公式/参考文献,100 篇文献解析时间从 40 小时缩短到 20 分钟。',
  },
  {
    title: '引用样式自动生成',
    desc: '支持 APA/MLA/Chicago/GB/T 7714/IEEE Vancouver 等 20+ 引用样式,Agent 自动按期刊要求格式化参考文献。',
  },
  {
    title: '文献综述生成',
    desc: 'Agent 学习团队既往综述写作风格,基于本地文献库生成结构化综述,人工只需润色,周期从 2 周缩到 2 天。',
  },
  {
    title: '跨学科知识图谱',
    desc: '抽取论文中的实体(作者/机构/方法/数据集)与关系,生成可视化知识图谱,支持探索性查询与潜在合作者发现。',
  },
  {
    title: '研究趋势分析',
    desc: '基于时间序列与主题模型,追踪研究热点/新兴方法/高被引论文,每周输出趋势报告,辅助选题决策。',
  },
]

const cases = [
  {
    title: '高校实验室:博士生调研周期从 2 个月缩到 1 周',
    desc: '某 985 高校计算机系 12 名博士生接入 AI 研究助手,文献阅读效率提升 8 倍,综述写作时间从平均 14 天压缩到 2.5 天,SCI 论文产出量同比提升 35%。',
  },
  {
    title: '研究院:跨学科课题立项周期缩短 60%',
    desc: '中国某新型研究院使用 AI 研究助手的知识图谱,自动发现生物信息学与材料学的交叉点,辅助立项 8 个跨学科课题,平均立项周期从 6 个月压缩到 2.4 个月。',
  },
  {
    title: '企业研发:技术情报周报自动化',
    desc: '某 AI 大模型公司接入 AI 研究助手,自动监控全球 30+ 顶会(NeurIPS/ICML/CVPR/ACL)新论文,每周一自动生成技术情报周报,研发团队对前沿动态的反应速度提升 5 倍。',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web 端文献检索/阅读/写作工作台' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 端文献元数据管理与权限控制' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: 'PDF 解析 + 综述生成 + 知识图谱抽取' },
  { name: 'MCP 工具协议', purpose: '对接 arXiv/PubMed/知网/万方等数据源适配器' },
  { name: 'Tauri 2 桌面端', purpose: '离线文献库 + 本地 PDF 标注' },
  { name: 'WXT 浏览器插件', purpose: '在 Google Scholar/PubMed 网页一键入库文献' },
  { name: 'Taro 4 小程序', purpose: '移动端文献速读 + 速记' },
  { name: 'CLI 命令行', purpose: '批量文献管理与 BibTeX 导出' },
]

const metrics = [
  { value: '30+', label: '学术数据库' },
  { value: '8×', label: '文献调研提速' },
  { value: '20+', label: '引用样式' },
  { value: '30min', label: '上线时间' },
]

export default function AiResearchPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        <BackButton />
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            学术研究
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 学术研究助手:让文献调研效率提升 8 倍
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            基于 IHUI AI 全栈 AI 操作系统搭建,8
            端分发(Web/桌面/小程序/浏览器插件/RN/CLI/API/AI-Service),Apache 2.0
            开源,支持私有化部署。
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

        {/* 痛点 */}
        <section className="mt-16 rounded-2xl border bg-card p-8 min-[768px]:p-12">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">
              研究者的真实痛点
            </h2>
          </div>
          <ul className="mt-6 space-y-3">
            {problems.map((p, i) => (
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

        {/* 能力 */}
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

        {/* 案例 */}
        <section className="mt-16 rounded-2xl border bg-primary/5 p-8 min-[768px]:p-12">
          <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">
            客户落地案例
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 min-[768px]:grid-cols-3">
            {cases.map((cs, i) => (
              <div key={i} className="rounded-2xl border bg-card p-6">
                <h3 className="text-base font-semibold">{cs.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cs.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 工具链 */}
        <section className="mt-16">
          <div className="flex items-center justify-center gap-3">
            <Wrench className="h-6 w-6 text-primary" />
            <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">
              技术栈与工具链
            </h2>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground min-[768px]:text-base">
            基于 IHUI AI 全栈 AI 操作系统,8 端同源,核心组件全部开源。
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-4">
            {toolchain.map((t, i) => (
              <div key={i} className="rounded-2xl border bg-card p-5">
                <h3 className="text-sm font-semibold">{t.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.purpose}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 联系/CTA */}
        <section className="mt-16 rounded-2xl border bg-card p-8 text-center min-[768px]:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">
            开始搭建你的 AI 学术研究助手
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            注册即得 1000 积分,从学术研究场景模板一键 fork,30 分钟体验。
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
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> 咨询入口 8801
            </span>
            <span className="flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" /> 教学版 8802
            </span>
            <span className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" /> 实验室部署 8803
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> 镜像加速 8809
            </span>
          </div>
        </section>
      </main>
    </>
  )
}
