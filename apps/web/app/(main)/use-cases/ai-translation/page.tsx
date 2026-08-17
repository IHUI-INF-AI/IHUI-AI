import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  Languages,
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
      '@id': 'https://aizhs.top/use-cases/ai-translation#webpage',
      url: 'https://aizhs.top/use-cases/ai-translation',
      name: 'AI 多语翻译 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的 AI 多语翻译 Agent:多语种文档翻译、本地化工作流、术语库管理、译文审校、文化适配、字幕翻译,30 分钟上线,8 端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/use-cases/ai-translation#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'AI 多语翻译',
          item: 'https://aizhs.top/use-cases/ai-translation',
        },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/use-cases/ai-translation#howto',
      name: '30 分钟搭建 AI 多语翻译 Agent',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建 AI 多语翻译 Agent 的 6 步流程:建立术语库 → 上传历史译文 → 配置语种 → 训练文化适配 → 设置审校规则 → 接入工作流。翻译效率提升 6 倍,成本降低 70%。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '术语表/历史译文/品牌调性文档/目标语种列表' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 多语翻译引擎' },
        { '@type': 'HowToTool', name: 'IHUI AI 术语库管理模块' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: '建立术语库',
          text: '录入产品/品牌/行业术语(中英日韩繁等 50+ 语种),Agent 严格遵循术语一致性,避免一词多译。',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: '上传历史译文',
          text: '上传既往优质双语对照文档,Agent 学习团队译文风格,确保 AI 产出与人工历史风格一致。',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: '配置目标语种',
          text: '选择目标语种(支持 50+ 主流语种 + 方言变体如繁体/简体的细分地区版本),批量翻译一键启动。',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: '训练文化适配',
          text: '基于目标市场文化习惯微调翻译(如日语敬语/阿拉伯语右起/西语拉美 vs 西班牙变体),避免文化冒犯。',
        },
        {
          '@type': 'HowToStep',
          position: 5,
          name: '设置审校规则',
          text: '配置术语一致性/数字格式/日期格式/单位换算/敏感词检查等审校规则,Agent 自动标记可疑译文。',
        },
        {
          '@type': 'HowToStep',
          position: 6,
          name: '接入工作流',
          text: '对接 Git/CMS/Confluence/Notion/Figma 等内容源,翻译更新自动同步,人工只需终审关键内容。',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 多语翻译 — 文档/本地化/术语库/字幕翻译 | IHUI AI',
  description:
    '用 IHUI AI 构建 AI 多语翻译 Agent:文档翻译 + 本地化工作流 + 术语库管理 + 译文审校 + 文化适配 + 字幕翻译。30 分钟上线,8 端分发。',
  alternates: { canonical: '/use-cases/ai-translation' },
  openGraph: {
    title: 'AI 多语翻译 Agent — IHUI AI',
    description: '多语种翻译 + 术语库 + 文化适配,30 分钟上线。',
    url: 'https://aizhs.top/use-cases/ai-translation',
    type: 'article',
  },
}

const problems = [
  '出海产品需 10+ 语种本地化,人工翻译外包成本高(每千字 0.3-1.5 元 × 10 语种成本激增)',
  '产品术语/品牌名在不同语种版本中翻译不一致,导致用户认知混乱',
  '文档(API 文档/帮助中心/产品手册)更新后翻译版本滞后,用户体验割裂',
  '营销文案翻译缺乏文化适配,直译引发目标市场用户反感(文化冒犯事件频发)',
  '字幕/UI 文案/PDF/Word/Markdown/JSON 多格式翻译,人工切换工具繁琐',
  '翻译质量依赖少数资深译者,产能受限且人员变动风险高',
]

const capabilities = [
  {
    title: '50+ 语种文档翻译',
    desc: '支持 50+ 主流语种(中/英/日/韩/法/德/西/俄/阿拉伯/葡/意/繁简等),批量翻译 Word/PDF/Markdown/JSON/CSV 等格式,术语一致性 99%。',
  },
  {
    title: '本地化工作流',
    desc: '对接 Git/CMS/Confluence/Notion 等内容源,源文档更新后自动触发翻译,译文同步推送,人工只需终审关键内容。',
  },
  {
    title: '术语库管理',
    desc: '建立多语种术语库,AI 严格遵循术语一致性,品牌名/产品名/技术术语 0 误译,翻译记忆(TM)跨项目复用。',
  },
  {
    title: '译文智能审校',
    desc: '配置术语一致性/数字格式/日期格式/单位换算/敏感词等审校规则,Agent 自动标记可疑译文,人工审校工作量减少 75%。',
  },
  {
    title: '文化适配',
    desc: '基于目标市场文化习惯自动调整表达(日语敬语分级/阿拉伯语 RTL/西语拉美 vs 西班牙变体),避免文化冒犯,提升本地化质量。',
  },
  {
    title: '字幕翻译',
    desc: '支持视频字幕 SRT/VTT 文件解析与翻译,自动对齐时间轴,导出多语种字幕版本,字幕翻译效率提升 8 倍。',
  },
]

const cases = [
  {
    title: '出海 SaaS:本地化成本 -70%',
    desc: '某中国 SaaS 出海至 12 国(美/日/韩/德/法/西/俄/阿拉伯等),使用 AI 翻译 Agent 后,本地化年度成本从 240 万元降至 72 万元,翻译更新周期从 2 周压缩到 2 天。',
  },
  {
    title: '跨境电商:商品多语上架提速 6 倍',
    desc: '某跨境电商平台接入 AI 翻译 Agent,商品信息(标题/详情/规格) 10 语种批量翻译,新商品上架时间从 1.5 天缩到 6 小时,GMV 提升 38%。',
  },
  {
    title: '在线教育:字幕本地化 1 天覆盖 8 语种',
    desc: '某在线教育平台 1000+ 课程视频接入 AI 字幕翻译,8 语种(日/韩/英/西/葡/俄/阿/法)字幕本地化周期从 30 天压缩到 1 天,海外用户付费转化率提升 52%。',
  },
]

const toolchain = [
  { name: 'Next.js 16 + React 19', purpose: 'Web 端翻译工作台与术语库管理' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 端翻译记忆(TM)与项目版本管理' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: '多语种翻译 + 文化适配 + 审校规则引擎' },
  { name: 'MCP 工具协议', purpose: '对接 Git/CMS/Confluence/Notion/Figma 等内容源' },
  { name: 'Tauri 2 桌面端', purpose: '本地文档翻译 + 离线术语库' },
  { name: 'WXT 浏览器插件', purpose: '网页一键翻译 + 术语标注' },
  { name: 'Taro 4 小程序', purpose: '移动端文档拍照翻译' },
  { name: 'CLI 命令行', purpose: '批量文档翻译 + CI/CD 集成' },
]

const metrics = [
  { value: '50+', label: '支持语种' },
  { value: '6×', label: '翻译效率' },
  { value: '70%', label: '成本降低' },
  { value: '30min', label: '上线时间' },
]

export default function AiTranslationPage() {
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
            <Languages className="h-3.5 w-3.5 text-primary" />
            多语翻译
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 多语翻译:50+ 语种本地化,成本降低 70%
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            基于 IHUI AI 全栈 AI 操作系统搭建,8 端分发,Apache 2.0 开源,支持私有化部署,术语库 +
            文化适配双引擎保障译文质量。
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
              出海团队的本地化困境
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
            基于 IHUI AI 全栈 AI 操作系统,8 端同源,核心组件全部开源,深度对接
            Git/CMS/Confluence/Notion。
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
            开始搭建你的 AI 多语翻译助手
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            注册即得 1000 积分,从翻译场景模板一键 fork,30 分钟体验多语种批量翻译。
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
              <MessageSquare className="h-3.5 w-3.5" /> 翻译咨询 8801
            </span>
            <span className="flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" /> 术语库培训 8805
            </span>
            <span className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" /> 私有化部署 8806
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> 语种扩展 8809
            </span>
          </div>
        </section>
      </main>
    </>
  )
}
