import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, PaintBucket, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/use-cases/ai-design#webpage',
      url: 'https://aizhs.top/use-cases/ai-design',
      name: 'AI 设计协作 Agent 用例 — IHUI AI',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建的 AI 设计协作 Agent:海报/Logo 概念、UI 草图转代码、品牌资产管理、设计稿评审、设计系统检索,30 分钟上线,8 端分发。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/use-cases/ai-design#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 设计协作', item: 'https://aizhs.top/use-cases/ai-design' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/use-cases/ai-design#howto',
      name: '30 分钟搭建 AI 设计协作 Agent',
      description:
        '基于 IHUI AI 全栈 AI 操作系统搭建 AI 设计协作 Agent 的 6 步流程:上传品牌资产 → 配置设计系统 → 训练概念生成 → 启用草图转代码 → 设置评审规则 → 接入协作工具。设计周期缩短 60%。',
      inLanguage: ['zh-CN', 'zh-TW', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '品牌 VI 手册/历史设计稿/设计系统 tokens' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 设计概念生成引擎' },
        { '@type': 'HowToTool', name: 'IHUI AI 草图转代码模块' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '上传品牌资产', text: '上传品牌 VI/历史海报/Logo/设计系统 tokens,AI 自动抽取色板/字体/版式,构建品牌设计语言模型。' },
        { '@type': 'HowToStep', position: 2, name: '配置设计系统', text: '录入 Figma Tokens(颜色/字号/间距/圆角/阴影),Agent 后续生成严格遵循设计系统,设计师无需返工。' },
        { '@type': 'HowToStep', position: 3, name: '训练概念生成', text: '基于品牌历史爆款海报/Logo 训练概念模型,AI 自动生成符合品牌调性的 3-5 个创意方向,设计师挑选深化。' },
        { '@type': 'HowToStep', position: 4, name: '草图转代码', text: '上传手绘 UI 草图(白板/纸笔),Agent 自动识别组件结构并生成 React + Tailwind 代码,准确率 85%+。' },
        { '@type': 'HowToStep', position: 5, name: '设置评审规则', text: '配置可访问性(a11y)规则/品牌一致性规则/响应式规则,Agent 自动评审设计稿,标记需修改项。' },
        { '@type': 'HowToStep', position: 6, name: '接入协作工具', text: '对接 Figma/Sketch/即时设计/蓝湖/Notion,设计师无需切换工具,AI 嵌入工作流。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 设计协作 — 海报/Logo/草图转代码/设计系统 | IHUI AI',
  description:
    '用 IHUI AI 构建 AI 设计协作 Agent:海报 Logo 概念 + UI 草图转代码 + 品牌资产管理 + 设计稿评审 + 设计系统检索。30 分钟上线,8 端分发。',
  alternates: { canonical: '/use-cases/ai-design' },
  openGraph: {
    title: 'AI 设计协作 Agent — IHUI AI',
    description: '草图转代码 + 品牌资产 + 设计评审,30 分钟上线。',
    url: 'https://aizhs.top/use-cases/ai-design',
    type: 'article',
  },
}

const problems = [
  '海报/Logo/落地页设计需求集中在资深设计师,新人难以独立产出,产能受限',
  '手绘 UI 草图到代码实现需要反复沟通,平均 1 张草图转代码耗时 2-3 天',
  '品牌资产(Logo/字体/色板/版式)散落在多个云盘与本地,新人入职需要 1-2 周熟悉',
  '设计稿评审依赖资深设计师,反馈周期长,设计规范一致性难以保障',
  '设计系统(Figma Tokens)更新后,历史设计稿未同步,设计资产复用率低',
  '营销活动临时设计需求多,排期冲突严重,紧急需求需设计师加班赶工',
]

const capabilities = [
  { title: '海报/Logo 概念生成', desc: '输入品牌关键词与目标受众,AI 自动生成 3-5 个创意方向(配色/版式/字体),设计师挑选后深化,概念阶段时间从 1 天压缩到 1 小时。' },
  { title: 'UI 草图转代码', desc: '上传手绘 UI 草图(白板/纸笔图片),Agent 自动识别组件结构并生成 React + Tailwind 代码,准确率 85%+,代码可读性符合团队规范。' },
  { title: '品牌资产管理', desc: '统一管理 Logo/字体/色板/版式/图标,新人 5 分钟内熟悉品牌,品牌资产复用率从 30% 提升到 80%。' },
  { title: '设计稿智能评审', desc: '配置可访问性(a11y)/品牌一致性/响应式/对比度等规则,Agent 自动评审设计稿,标记需修改项,反馈时间从 1 天缩到 10 分钟。' },
  { title: '设计系统检索', desc: '自然语言查询(如"找一个 12px 圆角的卡片组件"),Agent 从设计系统库返回最匹配的历史组件,设计师无需翻 Figma 文件。' },
  { title: '协作工具集成', desc: '对接 Figma/Sketch/即时设计/蓝湖/Notion,设计师无需切换工具,AI 嵌入现有工作流,学习成本接近 0。' },
]

const cases = [
  {
    title: '互联网公司 UGC 活动:H5 上线周期 7 天 → 1.5 天',
    desc: '某头部互联网公司 UGC 营销活动使用 AI 设计协作 Agent,设计师手绘草图后 1 小时内生成可上线 H5 代码,设计+开发总周期从 7 天压缩到 1.5 天,人力成本下降 70%。',
  },
  {
    title: '新消费品牌:VI 落地效率提升 5 倍',
    desc: '某新茶饮品牌门店扩张期需快速生成 200+ 物料(海报/外卖包装/菜单),使用 AI 设计协作 Agent 后,基于品牌 VI 库自动生成 80% 初稿,设计师只需微调,落地效率提升 5 倍。',
  },
  {
    title: 'B 端 SaaS:设计系统一致性达 98%',
    desc: '某企业级 SaaS 公司 30 人设计团队接入 AI 设计评审,设计稿通过率从 65% 提升到 98%,前端还原度从 75% 提升到 95%,版本迭代效率提升 60%。',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web 端设计协作工作台与设计系统管理' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 端设计资产存储与版本管理' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: '草图识别 + 代码生成 + 设计评审' },
  { name: 'MCP 工具协议', purpose: '对接 Figma/Sketch/即时设计/蓝湖设计工具' },
  { name: 'Tauri 2 桌面端', purpose: '本地设计资产缓存 + 离线标注' },
  { name: 'WXT 浏览器插件', purpose: '在 Figma/网页一键采集参考素材' },
  { name: 'Taro 4 小程序', purpose: '移动端设计稿审阅与评论' },
  { name: 'CLI 命令行', purpose: '批量设计资产处理与导出' },
]

const metrics = [
  { value: '60%', label: '设计周期缩短' },
  { value: '85%', label: '草图转代码准确率' },
  { value: '5×', label: '品牌资产复用' },
  { value: '30min', label: '上线时间' },
]

export default function AiDesignPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <PaintBucket className="h-3.5 w-3.5 text-primary" />
            设计协作
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 设计协作:草图转代码 + 品牌资产统一管理
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            基于 IHUI AI 全栈 AI 操作系统搭建,8 端分发,Apache 2.0 开源,支持私有化部署,Figma/即时设计深度集成。
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
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">设计团队的协作痛点</h2>
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
            基于 IHUI AI 全栈 AI 操作系统,8 端同源,核心组件全部开源,Figma/即时设计深度集成。
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
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">开始搭建你的 AI 设计协作助手</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            注册即得 1000 积分,从设计协作场景模板一键 fork,30 分钟体验草图转代码。
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 设计咨询 8801</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> 设计学院 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> 品牌定制 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Figma 插件 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
