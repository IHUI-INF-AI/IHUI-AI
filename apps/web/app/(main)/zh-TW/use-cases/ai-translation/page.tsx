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
      '@id': 'https://aizhs.top/zh-TW/use-cases/ai-translation#webpage',
      url: 'https://aizhs.top/zh-TW/use-cases/ai-translation',
      name: 'AI 多語翻譯 Agent 用例 — IHUI AI',
      description:
        '基於 IHUI AI 全棧 AI 作業系統搭建的 AI 多語翻譯 Agent:多語種文件翻譯、本地化工作流、術語庫管理、譯文審校、文化適配、字幕翻譯,30 分鐘上線,8 端分發。',
      inLanguage: ['zh-TW', 'zh-CN', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/zh-TW/use-cases/ai-translation#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'AI 多語翻譯',
          item: 'https://aizhs.top/zh-TW/use-cases/ai-translation',
        },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/zh-TW/use-cases/ai-translation#howto',
      name: '30 分鐘搭建 AI 多語翻譯 Agent',
      description:
        '基於 IHUI AI 全棧 AI 作業系統搭建 AI 多語翻譯 Agent 的 6 步流程:建立術語庫 → 上傳歷史譯文 → 配置語種 → 訓練文化適配 → 設定審校規則 → 接入工作流。翻譯效率提升 6 倍,成本降低 70%。',
      inLanguage: ['zh-TW', 'zh-CN', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '術語表/歷史譯文/品牌調性文件/目標語種列表' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 多語翻譯引擎' },
        { '@type': 'HowToTool', name: 'IHUI AI 術語庫管理模組' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: '建立術語庫',
          text: '錄入產品/品牌/行業術語(中英日韓繁等 50+ 語種),Agent 嚴格遵循術語一致性,避免一詞多譯。',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: '上傳歷史譯文',
          text: '上傳既往優質雙語對照文件,Agent 學習團隊譯文風格,確保 AI 產出與人工歷史風格一致。',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: '配置目標語種',
          text: '選擇目標語種(支援 50+ 主流語種 + 方言變體如繁體/簡體的細分地區版本),批次翻譯一鍵啟動。',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: '訓練文化適配',
          text: '基於目標市場文化習慣微調翻譯(如日語敬語/阿拉伯語右起/西語拉美 vs 西班牙變體),避免文化冒犯。',
        },
        {
          '@type': 'HowToStep',
          position: 5,
          name: '設定審校規則',
          text: '配置術語一致性/數字格式/日期格式/單位換算/敏感詞檢查等審校規則,Agent 自動標記可疑譯文。',
        },
        {
          '@type': 'HowToStep',
          position: 6,
          name: '接入工作流',
          text: '對接 Git/CMS/Confluence/Notion/Figma 等內容源,翻譯更新自動同步,人工只需終審關鍵內容。',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 多語翻譯 — 文件/本地化/術語庫/字幕翻譯 | IHUI AI',
  description:
    '用 IHUI AI 建構 AI 多語翻譯 Agent:文件翻譯 + 本地化工作流 + 術語庫管理 + 譯文審校 + 文化適配 + 字幕翻譯。30 分鐘上線,8 端分發。',
  alternates: { canonical: '/zh-TW/use-cases/ai-translation' },
  openGraph: {
    title: 'AI 多語翻譯 Agent — IHUI AI',
    description: '多語種翻譯 + 術語庫 + 文化適配,30 分鐘上線。',
    url: 'https://aizhs.top/zh-TW/use-cases/ai-translation',
    type: 'article',
  },
}

const problems = [
  '出海產品需 10+ 語種本地化,人工翻譯外包成本高(每千字 0.3-1.5 元 × 10 語種成本激增)',
  '產品術語/品牌名在不同語種版本中翻譯不一致,導致使用者認知混亂',
  '文件(API 文件/說明中心/產品手冊)更新後翻譯版本滯後,使用者體驗割裂',
  '行銷文案翻譯缺乏文化適配,直譯引發目標市場使用者反感(文化冒犯事件頻發)',
  '字幕/UI 文案/PDF/Word/Markdown/JSON 多格式翻譯,人工切換工具繁瑣',
  '翻譯品質依賴少數資深譯者,產能受限且人員變動風險高',
]

const capabilities = [
  {
    title: '50+ 語種文件翻譯',
    desc: '支援 50+ 主流語種(中/英/日/韓/法/德/西/俄/阿拉伯/葡/意/繁簡等),批次翻譯 Word/PDF/Markdown/JSON/CSV 等格式,術語一致性 99%。',
  },
  {
    title: '本地化工作流',
    desc: '對接 Git/CMS/Confluence/Notion 等內容源,源文件更新後自動觸發翻譯,譯文同步推送,人工只需終審關鍵內容。',
  },
  {
    title: '術語庫管理',
    desc: '建立多語種術語庫,AI 嚴格遵循術語一致性,品牌名/產品名/技術術語 0 誤譯,翻譯記憶(TM)跨專案複用。',
  },
  {
    title: '譯文智慧審校',
    desc: '配置術語一致性/數字格式/日期格式/單位換算/敏感詞等審校規則,Agent 自動標記可疑譯文,人工審校工作量減少 75%。',
  },
  {
    title: '文化適配',
    desc: '基於目標市場文化習慣自動調整表達(日語敬語分級/阿拉伯語 RTL/西語拉美 vs 西班牙變體),避免文化冒犯,提升本地化品質。',
  },
  {
    title: '字幕翻譯',
    desc: '支援影片字幕 SRT/VTT 檔案解析與翻譯,自動對齊時間軸,匯出多語種字幕版本,字幕翻譯效率提升 8 倍。',
  },
]

const cases = [
  {
    title: '出海 SaaS:本地化成本 -70%',
    desc: '某中國 SaaS 出海至 12 國(美/日/韓/德/法/西/俄/阿拉伯等),使用 AI 翻譯 Agent 後,本地化年度成本從 240 萬元降至 72 萬元,翻譯更新週期從 2 週壓縮到 2 天。',
  },
  {
    title: '跨境電商:商品多語上架提速 6 倍',
    desc: '某跨境電商平台接入 AI 翻譯 Agent,商品資訊(標題/詳情/規格) 10 語種批次翻譯,新商品上架時間從 1.5 天縮到 6 小時,GMV 提升 38%。',
  },
  {
    title: '線上教育:字幕本地化 1 天覆蓋 8 語種',
    desc: '某線上教育平台 1000+ 課程影片接入 AI 字幕翻譯,8 語種(日/韓/英/西/葡/俄/阿/法)字幕本地化週期從 30 天壓縮到 1 天,海外使用者付費轉換率提升 52%。',
  },
]

const toolchain = [
  { name: 'Next.js 16 + React 19', purpose: 'Web 端翻譯工作台與術語庫管理' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 端翻譯記憶(TM)與專案版本管理' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: '多語種翻譯 + 文化適配 + 審校規則引擎' },
  { name: 'MCP 工具協定', purpose: '對接 Git/CMS/Confluence/Notion/Figma 等內容源' },
  { name: 'Tauri 2 桌面端', purpose: '本地文件翻譯 + 離線術語庫' },
  { name: 'WXT 瀏覽器擴充套件', purpose: '網頁一鍵翻譯 + 術語標註' },
  { name: 'Taro 4 小程式', purpose: '行動端文件拍照翻譯' },
  { name: 'CLI 命令列', purpose: '批次文件翻譯 + CI/CD 整合' },
]

const metrics = [
  { value: '50+', label: '支援語種' },
  { value: '6×', label: '翻譯效率' },
  { value: '70%', label: '成本降低' },
  { value: '30min', label: '上線時間' },
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
            多語翻譯
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 多語翻譯:50+ 語種本地化,成本降低 70%
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            基於 IHUI AI 全棧 AI 作業系統搭建,8 端分發,Apache 2.0 開源,支援私有化部署,術語庫 +
            文化適配雙引擎保障譯文品質。
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

        {/* 痛點 */}
        <section className="mt-16 rounded-2xl border bg-card p-8 min-[768px]:p-12">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">
              出海團隊的本地化困境
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
            客戶落地案例
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

        {/* 工具鏈 */}
        <section className="mt-16">
          <div className="flex items-center justify-center gap-3">
            <Wrench className="h-6 w-6 text-primary" />
            <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">
              技術棧與工具鏈
            </h2>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground min-[768px]:text-base">
            基於 IHUI AI 全棧 AI 作業系統,8 端同源,核心元件全部開源,深度對接
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

        {/* 聯絡/CTA */}
        <section className="mt-16 rounded-2xl border bg-card p-8 text-center min-[768px]:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">
            開始搭建你的 AI 多語翻譯助手
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            註冊即得 1000 積分,從翻譯場景模板一鍵 fork,30 分鐘體驗多語種批次翻譯。
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
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> 翻譯諮詢 8801
            </span>
            <span className="flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" /> 術語庫培訓 8805
            </span>
            <span className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" /> 私有化部署 8806
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> 語種擴充 8809
            </span>
          </div>
        </section>
      </main>
    </>
  )
}
