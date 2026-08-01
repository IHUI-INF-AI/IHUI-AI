import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, Megaphone, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/use-cases/ai-marketing#webpage',
      url: 'https://aizhs.top/use-cases/ai-marketing',
      name: 'AI 营销内容生成 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的 AI 营销内容生成 Agent:多平台文案(小红书/抖音/微博/公众号/LinkedIn)、SEO 博客、品牌语调统一、A/B 测试、用户画像驱动,30 分钟上线,8 端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/use-cases/ai-marketing#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 营销内容', item: 'https://aizhs.top/use-cases/ai-marketing' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/use-cases/ai-marketing#howto',
      name: '30 分钟搭建 AI 营销内容生成 Agent',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建 AI 营销内容生成 Agent 的 6 步流程:上传品牌指南 → 训练语调模型 → 接入多平台 API → 配置 A/B 测试 → 导入用户画像 → 启用数据反馈闭环。产能提升 10 倍。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '品牌指南/历史爆款文章/产品手册/目标用户画像' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 多平台文案改写引擎' },
        { '@type': 'HowToTool', name: 'IHUI AI 品牌语调学习模块' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '上传品牌指南', text: '上传品牌故事/调性文档/历史爆款文章,AI 学习品牌语气与禁忌表达,所有产出符合调性。' },
        { '@type': 'HowToStep', position: 2, name: '训练语调模型', text: '基于品牌历史内容微调 LLM,确保所有 AI 产出与品牌人设一致,人工审校工作量减少 80%。' },
        { '@type': 'HowToStep', position: 3, name: '接入多平台 API', text: '一键对接小红书/抖音/微博/公众号/LinkedIn/Twitter 平台 Open API,内容直发,无需切换工具。' },
        { '@type': 'HowToStep', position: 4, name: '配置 A/B 测试', text: '同一选题自动生成 3-5 个标题与封面变体,Agent 自动跑 A/B 测试,72 小时内识别高 CTR 版本。' },
        { '@type': 'HowToStep', position: 5, name: '导入用户画像', text: '导入 CRM 用户画像(年龄/地域/消费力/兴趣),Agent 自动匹配调性与内容角度,转化率提升 35%。' },
        { '@type': 'HowToStep', position: 6, name: '启用数据反馈', text: '接入平台数据(阅读/点赞/转化),AI 自动复盘高表现内容模式,反哺下一轮内容生成。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 营销内容生成 — 多平台文案/SEO/品牌语调 | IHUI AI',
  description:
    '用 IHUI AI 构建 AI 营销内容生成 Agent:多平台文案 + SEO 博客 + 品牌语调统一 + A/B 测试 + 用户画像驱动。30 分钟上线,8 端分发。',
  alternates: { canonical: '/use-cases/ai-marketing' },
  openGraph: {
    title: 'AI 营销内容生成 Agent — IHUI AI',
    description: '多平台一键改写 + 品牌语调统一 + A/B 测试,30 分钟上线。',
    url: 'https://aizhs.top/use-cases/ai-marketing',
    type: 'article',
  },
}

const problems = [
  '公众号/知乎/小红书/抖音/LinkedIn 多平台运营,每个平台调性不同,人工重复改写产能低下',
  '营销文案需同时满足 SEO 关键词 + 品牌调性 + 平台算法偏好,人工写效率低且不一致',
  '选题策划依赖少数资深编辑,新人产出不稳定,品牌调性容易跑偏',
  'A/B 测试需要大量素材,人工生产跟不上,优化决策延迟',
  '多语言版本(中/英/日/韩/繁体)需不同语种编辑,翻译外包成本高且周期长',
  '营销效果数据分散在各平台后台,人工汇总周报/月报耗时,无法及时反哺内容策略',
]

const capabilities = [
  { title: '一键多平台改写', desc: '一篇 3000 字深度文章,AI 自动改写为小红书短文/抖音脚本/知乎回答/LinkedIn 长文/微博推文,各平台调性匹配,人工微调即可发布。' },
  { title: 'SEO 智能优化', desc: '输入目标关键词,AI 自动生成 SEO 友好的标题/Meta/正文结构,内置 Google/Bing/百度主流 SEO 规则,自然排名提升。' },
  { title: '品牌语调统一', desc: '上传品牌指南 + 历史爆款,AI 学习调性后所有产出 100% 符合品牌,避免不同编辑产出风格不一。' },
  { title: 'A/B 测试文案', desc: '同一选题自动生成 3-5 个标题与封面变体,Agent 自动跑 A/B 测试,72 小时内识别高 CTR 版本,转化率提升 35%。' },
  { title: '用户画像驱动', desc: '导入 CRM 用户画像(年龄/地域/消费力/兴趣),Agent 自动匹配调性/内容角度/CTA 措辞,千人千面内容生成。' },
  { title: '数据反馈闭环', desc: '接入各平台数据(阅读/点赞/转化),AI 自动复盘高表现内容模式,反哺下一轮创作,持续优化。' },
]

const cases = [
  {
    title: 'DTC 新消费品牌:内容产能 ×10',
    desc: '某新茶饮品牌接入 AI 营销 Agent 后,1 名运营可同时维护 5 个平台账号(小红书/抖音/微博/公众号/B 站),月均产出内容从 80 篇提升到 850 篇,粉丝增长 3.2 倍,获客成本下降 40%。',
  },
  {
    title: 'B2B SaaS:SEO 自然流量 +220%',
    desc: '某企业级 SaaS 公司用 AI 营销 Agent 自动生成 SEO 博客,6 个月内发布 240 篇高质量英文博客,Google 自然流量增长 220%,MQL(营销合格线索)增长 85%。',
  },
  {
    title: '跨境电商:多语言本地化成本 -80%',
    desc: '某跨境电商品牌使用 AI 多语言改写功能,5 个语种(日/韩/英/德/法语)版本内容本地化外包成本降低 80%,上新周期从 14 天压缩到 3 天。',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web 端营销工作台与品牌指南管理' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 端多平台账号授权与发布队列' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: '多平台文案改写 + SEO 优化 + 品牌语调微调' },
  { name: 'MCP 工具协议', purpose: '对接小红书/抖音/微博/公众号/LinkedIn 平台适配器' },
  { name: 'Tauri 2 桌面端', purpose: '本地品牌素材库与离线文案工作台' },
  { name: 'WXT 浏览器插件', purpose: '在任意网页一键采集素材/抓取竞品文案' },
  { name: 'Taro 4 小程序', purpose: '移动端营销数据看板与即时审稿' },
  { name: 'CLI 命令行', purpose: '批量内容生成与发布流水线自动化' },
]

const metrics = [
  { value: '×10', label: '内容产能' },
  { value: '80%', label: '多语言成本降低' },
  { value: '35%', label: '转化率提升' },
  { value: '30min', label: '上线时间' },
]

export default function AiMarketingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Megaphone className="h-3.5 w-3.5 text-primary" />
            营销内容
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 营销内容生成:多平台一键产出,产能提升 10 倍
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            基于 IHUI AI 全栈 AI 操作系统搭建,8 端分发,Apache 2.0 开源,支持私有化部署,品牌语调统一保障。
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

        {/* 痛点 */}
        <section className="mt-16 rounded-2xl border bg-card p-8 min-[768px]:p-12">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">营销团队的产能瓶颈</h2>
          </div>
          <ul className="mt-6 space-y-3">
            {problems.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground min-[768px]:text-base">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* 能力 */}
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

        {/* 案例 */}
        <section className="mt-16 rounded-2xl border bg-primary/5 p-8 min-[768px]:p-12">
          <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">客户落地案例</h2>
          <div className="mt-8 grid gap-6 min-[768px]:grid-cols-3">
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
            <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">技术栈与工具链</h2>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground min-[768px]:text-base">
            基于 IHUI AI 全栈 AI 操作系统,8 端同源,核心组件全部开源,无缝对接 5 大主流社媒平台。
          </p>
          <div className="mt-8 grid gap-4 min-[768px]:grid-cols-2 min-[1024px]:grid-cols-4">
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
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">开始搭建你的 AI 营销内容助手</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            注册即得 1000 积分,从营销内容场景模板一键 fork,30 分钟体验多平台一键产出。
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 商务咨询 8804</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> 营销学院 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> 品牌定制 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> 平台镜像 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
