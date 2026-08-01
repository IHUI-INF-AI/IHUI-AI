import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, GraduationCap, AlertTriangle, Wrench, MessageSquare, Palette, Globe, Lightbulb } from 'lucide-react'
import { BackButton } from '@/components/common'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/zh-TW/use-cases/ai-edu#webpage',
      url: 'https://aizhs.top/zh-TW/use-cases/ai-edu',
      name: 'AI 智慧教育 Agent 用例 — IHUI AI',
      description:
        '基於 IHUI AI 全棧 AI 作業系統搭建的 AI 智慧教育 Agent:個性化學習路徑、智慧答疑、出題與作業批改、學習資料分析、教研協作、家校溝通,30 分鐘上線,8 端分發。',
      inLanguage: ['zh-TW', 'zh-CN', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/zh-TW/use-cases/ai-edu#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 智慧教育', item: 'https://aizhs.top/zh-TW/use-cases/ai-edu' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/zh-TW/use-cases/ai-edu#howto',
      name: '30 分鐘搭建 AI 智慧教育 Agent',
      description:
        '基於 IHUI AI 全棧 AI 作業系統搭建 AI 智慧教育 Agent 的 6 步流程:配置學情資料 → 訓練學習路徑模型 → 接入題庫 → 設定作業批改規則 → 啟用資料分析 → 對接家校溝通。個性化教學覆蓋 100% 學生。',
      inLanguage: ['zh-TW', 'zh-CN', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '學情資料/題庫/教材/教研文件' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 個性化學習路徑引擎' },
        { '@type': 'HowToTool', name: 'IHUI AI 智慧題庫模組' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '配置學情資料', text: '匯入學生歷史成績/作業資料/學習行為日誌,AI 自動建構學情畫像,識別每個學生的強項與薄弱點。' },
        { '@type': 'HowToStep', position: 2, name: '訓練學習路徑', text: '基於知識圖譜與歷史資料訓練個性化學習路徑模型,為每個學生產生動態學習計畫(每日/每週)。' },
        { '@type': 'HowToStep', position: 3, name: '接入題庫', text: '對接學校自有題庫/區域共用題庫/第三方題庫(K12/語言/職業資格),AI 自動組卷,難度匹配學生程度。' },
        { '@type': 'HowToStep', position: 4, name: '設定批改規則', text: '配置客觀題(單選/多選/填空)與主觀題(作文/解答)批改規則,Agent 24/7 自動批改,主觀題準確率 85%+。' },
        { '@type': 'HowToStep', position: 5, name: '啟用資料分析', text: '聚合班級/年级/學科多維資料,自動產生學情報告,識別共性薄弱點,輔助教研決策。' },
        { '@type': 'HowToStep', position: 6, name: '家校溝通', text: '對接微信/釘釘/企微家長端,自動推送學情週報/作業完成情況/進步亮點,家校共育零延遲。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 智慧教育 — 個性化學習/智慧答疑/家校溝通 | IHUI AI',
  description:
    '用 IHUI AI 建構 AI 智慧教育 Agent:個性化學習路徑 + 智慧答疑 + 出題批改 + 學情分析 + 教研協作 + 家校溝通。30 分鐘上線,8 端分發。',
  alternates: { canonical: '/zh-TW/use-cases/ai-edu' },
  openGraph: {
    title: 'AI 智慧教育 Agent — IHUI AI',
    description: '個性化學習路徑 + 智慧答疑 + 作業批改,30 分鐘上線。',
    url: 'https://aizhs.top/zh-TW/use-cases/ai-edu',
    type: 'article',
  },
}

const problems = [
  '大班教學(40-60 人)教師難以為每個學生定制學習路徑,優等生吃不飽/後進生跟不上',
  '課後答疑依賴教師在線時間,晚間/週末學生疑問累積,影響學習連續性',
  '作業批改(尤其作文/主觀題)消耗教師大量時間,回饋延遲影響糾錯效果',
  '學情資料(成績/作業/課堂表現)分散在不同系統,教師難以綜合分析,教研效率低',
  '教研協作(教案/課件/試題)缺乏統一平台,優質資源難以跨校/跨區共用',
  '家校溝通主要靠家長會/微信群,資訊不對稱,家長難以及時掌握孩子學情',
]

const capabilities = [
  { title: '個性化學習路徑', desc: '基於知識圖譜與學情畫像,為每個學生產生動態學習計畫(每日/每週),精準匹配難度,優等生拓展/後進生補強,因材施教規模化。' },
  { title: '7×24 智慧答疑', desc: 'AI 答疑 Agent 7×24 在線,基於學科知識圖譜 + 歷史答疑庫回答學生疑問,30 秒內回應,準確率 92%,覆蓋 K12 全學科。' },
  { title: '智慧出題與批改', desc: '對接題庫自動組卷,難度匹配學生程度,客觀題秒級批改,主觀題(作文/解答) AI 批改準確率 85%+,教師工作量減少 70%。' },
  { title: '學習資料分析', desc: '聚合班級/年级/學科多維資料,自動產生學情報告,識別共性薄弱點,輔助教研決策,精準教學從經驗驅動轉向資料驅動。' },
  { title: '教研協作', desc: '統一管理教案/課件/試題/教學反思,支援跨校/跨區共用,優質資源複用率從 30% 提升到 75%,教研效率顯著提升。' },
  { title: '家校溝通', desc: '對接微信/釘釘/企微家長端,自動推送學情週報/作業完成情況/進步亮點,家校共育零延遲,家長滿意度提升 60%。' },
]

const cases = [
  {
    title: '區域教育局:3 萬學生個性化學習覆蓋',
    desc: '某直轄市下轄區教育局接入 AI 智慧教育 Agent,覆蓋 32 所學校 3 萬學生,AI 答疑月均處理 280 萬次,作業批改效率提升 8 倍,教師用於個性化輔導的時間增加 35%。',
  },
  {
    title: 'K12 培訓機構:續班率 +25%',
    desc: '某頭部 K12 培訓機構使用 AI 智慧教育 Agent,學情週報讓家長清晰看到孩子進步,續班率從 62% 提升到 87%,家長投訴率下降 70%。',
  },
  {
    title: '高校:通識課答疑 7×24 覆蓋',
    desc: '某 985 高校通識課(高數/英語/計算機基礎)使用 AI 答疑 Agent 後,學生疑問 30 秒內回應,教師從重複答疑中解放,轉而專注教學設計,學生課程通過率提升 18%。',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web 端教學管理後台與學情看板' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 端學情資料儲存與權限隔離' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: '個性化路徑 + 智慧答疑 + 主觀題批改' },
  { name: 'MCP 工具協定', purpose: '對接題庫/教材/學情系統/家校平台' },
  { name: 'Tauri 2 桌面端', purpose: '教師端離線備課 + 本地題庫管理' },
  { name: 'WXT 瀏覽器擴充套件', purpose: '在教研網站/題庫平台一鍵蒐集資源' },
  { name: 'Taro 4 小程式', purpose: '學生端拍照搜題 + 家長端學情報告' },
  { name: 'CLI 命令列', purpose: '批次題庫匯入與學情資料匯出' },
]

const metrics = [
  { value: '100%', label: '學生個性化覆蓋' },
  { value: '70%', label: '教師工作量降低' },
  { value: '92%', label: '答疑準確率' },
  { value: '30min', label: '上線時間' },
]

export default function AiEduPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        <BackButton />
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
            智慧教育
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 智慧教育:讓每個學生都擁有個性化學習路徑
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            基於 IHUI AI 全棧 AI 作業系統搭建,8 端分發,Apache 2.0 開源,支援私有化部署,覆蓋 K12/高校/職業訓練全場景。
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

        {/* 痛點 */}
        <section className="mt-16 rounded-2xl border bg-card p-8 min-[768px]:p-12">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">教育工作者面臨的真實挑戰</h2>
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
          <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">客戶落地案例</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 min-[768px]:grid-cols-3">
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
            <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">技術棧與工具鏈</h2>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground min-[768px]:text-base">
            基於 IHUI AI 全棧 AI 作業系統,8 端同源,核心元件全部開源,K12/高校/職業訓練全場景覆蓋。
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

        {/* 聯絡/CTA */}
        <section className="mt-16 rounded-2xl border bg-card p-8 text-center min-[768px]:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">開始搭建你的 AI 智慧教育助手</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            註冊即得 1000 積分,從智慧教育場景模板一鍵 fork,30 分鐘體驗個性化學習。
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 教育諮詢 8801</span>
            <span className="flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> 教研培訓 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> 校園部署 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> 區域教育局方案 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
