import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, PaintBucket, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/zh-TW/use-cases/ai-design#webpage',
      url: 'https://ihui.ai/zh-TW/use-cases/ai-design',
      name: 'AI 設計協作 Agent 用例 — IHUI AI',
      description:
        '基於 IHUI AI 全棧 AI 作業系統搭建的 AI 設計協作 Agent:海報/Logo 概念、UI 草圖轉程式碼、品牌資產管理、設計稿評審、設計系統檢索,30 分鐘上線,8 端分發。',
      inLanguage: ['zh-TW', 'zh-CN', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: { '@id': 'https://ihui.ai/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/zh-TW/use-cases/ai-design#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://ihui.ai/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 設計協作', item: 'https://ihui.ai/zh-TW/use-cases/ai-design' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://ihui.ai/zh-TW/use-cases/ai-design#howto',
      name: '30 分鐘搭建 AI 設計協作 Agent',
      description:
        '基於 IHUI AI 全棧 AI 作業系統搭建 AI 設計協作 Agent 的 6 步流程:上傳品牌資產 → 配置設計系統 → 訓練概念生成 → 啟用草圖轉程式碼 → 設定評審規則 → 接入協作工具。設計週期縮短 60%。',
      inLanguage: ['zh-TW', 'zh-CN', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '品牌 VI 手冊/歷史設計稿/設計系統 tokens' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 設計概念生成引擎' },
        { '@type': 'HowToTool', name: 'IHUI AI 草圖轉程式碼模組' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '上傳品牌資產', text: '上傳品牌 VI/歷史海報/Logo/設計系統 tokens,AI 自動抽取色板/字體/版型,建構品牌設計語言模型。' },
        { '@type': 'HowToStep', position: 2, name: '配置設計系統', text: '錄入 Figma Tokens(顏色/字級/間距/圓角/陰影),Agent 後續生成嚴格遵循設計系統,設計師無需重工。' },
        { '@type': 'HowToStep', position: 3, name: '訓練概念生成', text: '基於品牌歷史爆款海報/Logo 訓練概念模型,AI 自動生成符合品牌調性的 3-5 個創意方向,設計師挑選深化。' },
        { '@type': 'HowToStep', position: 4, name: '草圖轉程式碼', text: '上傳手繪 UI 草圖(白板/紙筆),Agent 自動辨識元件結構並生成 React + Tailwind 程式碼,準確率 85%+。' },
        { '@type': 'HowToStep', position: 5, name: '設定評審規則', text: '配置可存取性(a11y)規則/品牌一致性規則/響應式規則,Agent 自動評審設計稿,標記需修改項目。' },
        { '@type': 'HowToStep', position: 6, name: '接入協作工具', text: '對接 Figma/Sketch/即時設計/藍湖/Notion,設計師無需切換工具,AI 嵌入工作流。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 設計協作 — 海報/Logo/草圖轉程式碼/設計系統 | IHUI AI',
  description:
    '用 IHUI AI 建構 AI 設計協作 Agent:海報 Logo 概念 + UI 草圖轉程式碼 + 品牌資產管理 + 設計稿評審 + 設計系統檢索。30 分鐘上線,8 端分發。',
  alternates: { canonical: '/zh-TW/use-cases/ai-design' },
  openGraph: {
    title: 'AI 設計協作 Agent — IHUI AI',
    description: '草圖轉程式碼 + 品牌資產 + 設計評審,30 分鐘上線。',
    url: 'https://ihui.ai/zh-TW/use-cases/ai-design',
    type: 'article',
  },
}

const problems = [
  '海報/Logo/落地頁設計需求集中在資深設計師,新人難以獨立產出,產能受限',
  '手繪 UI 草圖到程式碼實作需要反覆溝通,平均 1 張草圖轉程式碼耗時 2-3 天',
  '品牌資產(Logo/字體/色板/版型)散落在多個雲端硬碟與本機,新人入職需要 1-2 週熟悉',
  '設計稿評審依賴資深設計師,回饋週期長,設計規範一致性難以保障',
  '設計系統(Figma Tokens)更新後,歷史設計稿未同步,設計資產複用率低',
  '行銷活動臨時設計需求多,排程衝突嚴重,緊急需求需設計師加班趕工',
]

const capabilities = [
  { title: '海報/Logo 概念生成', desc: '輸入品牌關鍵詞與目標受眾,AI 自動生成 3-5 個創意方向(配色/版型/字體),設計師挑選後深化,概念階段時間從 1 天壓縮到 1 小時。' },
  { title: 'UI 草圖轉程式碼', desc: '上傳手繪 UI 草圖(白板/紙筆圖片),Agent 自動辨識元件結構並生成 React + Tailwind 程式碼,準確率 85%+,程式碼可讀性符合團隊規範。' },
  { title: '品牌資產管理', desc: '統一管理 Logo/字體/色板/版型/圖示,新人 5 分鐘內熟悉品牌,品牌資產複用率從 30% 提升到 80%。' },
  { title: '設計稿智慧評審', desc: '配置可存取性(a11y)/品牌一致性/響應式/對比度等規則,Agent 自動評審設計稿,標記需修改項目,回饋時間從 1 天縮到 10 分鐘。' },
  { title: '設計系統檢索', desc: '自然語言查詢(如「找一個 12px 圓角的卡片元件」),Agent 從設計系統庫回傳最符合的歷史元件,設計師無需翻 Figma 檔案。' },
  { title: '協作工具整合', desc: '對接 Figma/Sketch/即時設計/藍湖/Notion,設計師無需切換工具,AI 嵌入現有工作流,學習成本接近 0。' },
]

const cases = [
  {
    title: '網際網路公司 UGC 活動:H5 上線週期 7 天 → 1.5 天',
    desc: '某頭部網際網路公司 UGC 行銷活動使用 AI 設計協作 Agent,設計師手繪草圖後 1 小時內生成可上線 H5 程式碼,設計+開發總週期從 7 天壓縮到 1.5 天,人力成本下降 70%。',
  },
  {
    title: '新消費品牌:VI 落地效率提升 5 倍',
    desc: '某新茶飲品牌門店擴張期需快速生成 200+ 物料(海報/外賣包裝/菜單),使用 AI 設計協作 Agent 後,基於品牌 VI 庫自動生成 80% 初稿,設計師只需微調,落地效率提升 5 倍。',
  },
  {
    title: 'B 端 SaaS:設計系統一致性達 98%',
    desc: '某企業級 SaaS 公司 30 人設計團隊接入 AI 設計評審,設計稿通過率從 65% 提升到 98%,前端還原度從 75% 提升到 95%,版本迭代效率提升 60%。',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web 端設計協作工作台與設計系統管理' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 端設計資產儲存與版本管理' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: '草圖辨識 + 程式碼生成 + 設計評審' },
  { name: 'MCP 工具協定', purpose: '對接 Figma/Sketch/即時設計/藍湖設計工具' },
  { name: 'Tauri 2 桌面端', purpose: '本地設計資產快取 + 離線標註' },
  { name: 'WXT 瀏覽器擴充套件', purpose: '在 Figma/網頁一鍵蒐集參考素材' },
  { name: 'Taro 4 小程式', purpose: '行動端設計稿審閱與評論' },
  { name: 'CLI 命令列', purpose: '批次設計資產處理與匯出' },
]

const metrics = [
  { value: '60%', label: '設計週期縮短' },
  { value: '85%', label: '草圖轉程式碼準確率' },
  { value: '5×', label: '品牌資產複用' },
  { value: '30min', label: '上線時間' },
]

export default function AiDesignPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <PaintBucket className="h-3.5 w-3.5 text-primary" />
            設計協作
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            AI 設計協作:草圖轉程式碼 + 品牌資產統一管理
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            基於 IHUI AI 全棧 AI 作業系統搭建,8 端分發,Apache 2.0 開源,支援私有化部署,Figma/即時設計深度整合。
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

        {/* 痛點 */}
        <section className="mt-16 rounded-2xl border bg-card p-8 md:p-12">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">設計團隊的協作痛點</h2>
          </div>
          <ul className="mt-6 space-y-3">
            {problems.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* 能力 */}
        <section className="mt-16">
          <h2 className="text-center text-xl font-bold tracking-tight md:text-2xl">6 大核心能力</h2>
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

        {/* 案例 */}
        <section className="mt-16 rounded-2xl border bg-primary/5 p-8 md:p-12">
          <h2 className="text-center text-xl font-bold tracking-tight md:text-2xl">客戶落地案例</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {cases.map((cs, i) => (
              <div key={i} className="rounded-2xl border bg-card p-6">
                <h3 className="text-base font-semibold">{cs.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cs.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 工具鏈 */}
        <section className="mt-16">
          <div className="flex items-center justify-center gap-3">
            <Wrench className="h-6 w-6 text-primary" />
            <h2 className="text-center text-xl font-bold tracking-tight md:text-2xl">技術棧與工具鏈</h2>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground md:text-base">
            基於 IHUI AI 全棧 AI 作業系統,8 端同源,核心元件全部開源,Figma/即時設計深度整合。
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {toolchain.map((t, i) => (
              <div key={i} className="rounded-2xl border bg-card p-5">
                <h3 className="text-sm font-semibold">{t.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.purpose}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 聯絡/CTA */}
        <section className="mt-16 rounded-2xl border bg-card p-8 text-center md:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold tracking-tight md:text-2xl">開始搭建你的 AI 設計協作助手</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            註冊即得 1000 積分,從設計協作場景模板一鍵 fork,30 分鐘體驗草圖轉程式碼。
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sso/register"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              免費註冊
            </Link>
            <Link
              href="/use-cases"
              className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium hover:bg-accent"
            >
              查看其他用例 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 設計諮詢 8801</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> 設計學院 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> 品牌訂製 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Figma 外掛 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
