import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, Megaphone, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/zh-TW/use-cases/ai-marketing#webpage',
      url: 'https://aizhs.top/zh-TW/use-cases/ai-marketing',
      name: 'AI 行銷內容生成 Agent 用例 — IHUI AI',
      description:
        '基於 IHUI AI 全棧 AI 作業系統搭建的 AI 行銷內容生成 Agent:多平台文案(小紅書/抖音/微博/公眾號/LinkedIn)、SEO 部落格、品牌語調統一、A/B 測試、使用者畫像驅動,30 分鐘上線,8 端分發。',
      inLanguage: ['zh-TW', 'zh-CN', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/zh-TW/use-cases/ai-marketing#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 行銷內容', item: 'https://aizhs.top/zh-TW/use-cases/ai-marketing' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/zh-TW/use-cases/ai-marketing#howto',
      name: '30 分鐘搭建 AI 行銷內容生成 Agent',
      description:
        '基於 IHUI AI 全棧 AI 作業系統搭建 AI 行銷內容生成 Agent 的 6 步流程:上傳品牌指南 → 訓練語調模型 → 接入多平台 API → 配置 A/B 測試 → 匯入使用者畫像 → 啟用資料回饋閉環。產能提升 10 倍。',
      inLanguage: ['zh-TW', 'zh-CN', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '品牌指南/歷史爆款文章/產品手冊/目標使用者畫像' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 多平台文案改寫引擎' },
        { '@type': 'HowToTool', name: 'IHUI AI 品牌語調學習模組' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '上傳品牌指南', text: '上傳品牌故事/語調文件/歷史爆款文章,AI 學習品牌語氣與禁忌表達,所有產出符合調性。' },
        { '@type': 'HowToStep', position: 2, name: '訓練語調模型', text: '基於品牌歷史內容微調 LLM,確保所有 AI 產出與品牌人設一致,人工審校工作量減少 80%。' },
        { '@type': 'HowToStep', position: 3, name: '接入多平台 API', text: '一鍵對接小紅書/抖音/微博/公眾號/LinkedIn/Twitter 平台 Open API,內容直發,無需切換工具。' },
        { '@type': 'HowToStep', position: 4, name: '配置 A/B 測試', text: '同一選題自動生成 3-5 個標題與封面變體,Agent 自動跑 A/B 測試,72 小時內識別高 CTR 版本。' },
        { '@type': 'HowToStep', position: 5, name: '匯入使用者畫像', text: '匯入 CRM 使用者畫像(年齡/地域/消費力/興趣),Agent 自動匹配調性與內容角度,轉換率提升 35%。' },
        { '@type': 'HowToStep', position: 6, name: '啟用資料回饋', text: '接入平台資料(閱讀/點讚/轉換),AI 自動覆盤高表現內容模式,反哺下一輪內容生成。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 行銷內容生成 — 多平台文案/SEO/品牌語調 | IHUI AI',
  description:
    '用 IHUI AI 建構 AI 行銷內容生成 Agent:多平台文案 + SEO 部落格 + 品牌語調統一 + A/B 測試 + 使用者畫像驅動。30 分鐘上線,8 端分發。',
  alternates: { canonical: '/zh-TW/use-cases/ai-marketing' },
  openGraph: {
    title: 'AI 行銷內容生成 Agent — IHUI AI',
    description: '多平台一鍵改寫 + 品牌語調統一 + A/B 測試,30 分鐘上線。',
    url: 'https://aizhs.top/zh-TW/use-cases/ai-marketing',
    type: 'article',
  },
}

const problems = [
  '公眾號/知乎/小紅書/抖音/LinkedIn 多平台經營,每個平台調性不同,人工重複改寫產能低下',
  '行銷文案需同時滿足 SEO 關鍵詞 + 品牌調性 + 平台演算法偏好,人工寫效率低且不一致',
  '選題企劃依賴少數資深編輯,新人產出不穩定,品牌調性容易跑偏',
  'A/B 測試需要大量素材,人工生產跟不上,優化決策延遲',
  '多語言版本(中/英/日/韓/繁體)需不同語種編輯,翻譯外包成本高且週期長',
  '行銷效果資料分散在各平台後台,人工彙整週報/月報耗時,無法及時反哺內容策略',
]

const capabilities = [
  { title: '一鍵多平台改寫', desc: '一篇 3000 字深度文章,AI 自動改寫為小紅書短文/抖音腳本/知乎回答/LinkedIn 長文/微博推文,各平台調性匹配,人工微調即可發布。' },
  { title: 'SEO 智慧優化', desc: '輸入目標關鍵詞,AI 自動生成 SEO 友善的標題/Meta/正文結構,內建 Google/Bing/百度主流 SEO 規則,自然排名提升。' },
  { title: '品牌語調統一', desc: '上傳品牌指南 + 歷史爆款,AI 學習調性後所有產出 100% 符合品牌,避免不同編輯產出風格不一。' },
  { title: 'A/B 測試文案', desc: '同一選題自動生成 3-5 個標題與封面變體,Agent 自動跑 A/B 測試,72 小時內識別高 CTR 版本,轉換率提升 35%。' },
  { title: '使用者畫像驅動', desc: '匯入 CRM 使用者畫像(年齡/地域/消費力/興趣),Agent 自動匹配調性/內容角度/CTA 措辭,千人千面內容生成。' },
  { title: '資料回饋閉環', desc: '接入各平台資料(閱讀/點讚/轉換),AI 自動覆盤高表現內容模式,反哺下一輪創作,持續優化。' },
]

const cases = [
  {
    title: 'DTC 新消費品牌:內容產能 ×10',
    desc: '某新茶飲品牌接入 AI 行銷 Agent 後,1 名運營可同時維護 5 個平台帳號(小紅書/抖音/微博/公眾號/B 站),月均產出內容從 80 篇提升到 850 篇,粉絲成長 3.2 倍,獲客成本下降 40%。',
  },
  {
    title: 'B2B SaaS:SEO 自然流量 +220%',
    desc: '某企業級 SaaS 公司用 AI 行銷 Agent 自動生成 SEO 部落格,6 個月內發布 240 篇高品質英文部落格,Google 自然流量成長 220%,MQL(行銷合格線索)成長 85%。',
  },
  {
    title: '跨境電商:多語言本地化成本 -80%',
    desc: '某跨境電商品牌使用 AI 多語言改寫功能,5 個語種(日/韓/英/德/法語)版本內容本地化外包成本降低 80%,上新週期從 14 天壓縮到 3 天。',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web 端行銷工作台與品牌指南管理' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 端多平台帳號授權與發布佇列' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: '多平台文案改寫 + SEO 優化 + 品牌語調微調' },
  { name: 'MCP 工具協定', purpose: '對接小紅書/抖音/微博/公眾號/LinkedIn 平台適配器' },
  { name: 'Tauri 2 桌面端', purpose: '本地品牌素材庫與離線文案工作台' },
  { name: 'WXT 瀏覽器擴充套件', purpose: '在任意網頁一鍵蒐集素材/抓取競品文案' },
  { name: 'Taro 4 小程式', purpose: '行動端行銷資料看板與即時審稿' },
  { name: 'CLI 命令列', purpose: '批次內容生成與發布流水線自動化' },
]

const metrics = [
  { value: '×10', label: '內容產能' },
  { value: '80%', label: '多語言成本降低' },
  { value: '35%', label: '轉換率提升' },
  { value: '30min', label: '上線時間' },
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
            行銷內容
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 行銷內容生成:多平台一鍵產出,產能提升 10 倍
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            基於 IHUI AI 全棧 AI 作業系統搭建,8 端分發,Apache 2.0 開源,支援私有化部署,品牌語調統一保障。
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
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">行銷團隊的產能瓶頸</h2>
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
            基於 IHUI AI 全棧 AI 作業系統,8 端同源,核心元件全部開源,無縫對接 5 大主流社群平台。
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
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">開始搭建你的 AI 行銷內容助手</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            註冊即得 1000 積分,從行銷內容場景模板一鍵 fork,30 分鐘體驗多平台一鍵產出。
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 商務諮詢 8804</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> 行銷學院 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> 品牌訂製 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> 平台鏡像 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
