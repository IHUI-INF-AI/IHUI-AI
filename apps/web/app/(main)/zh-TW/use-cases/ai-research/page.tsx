import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, BookOpen, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/zh-TW/use-cases/ai-research#webpage',
      url: 'https://aizhs.top/zh-TW/use-cases/ai-research',
      name: 'AI 學術研究助手 Agent 用例 — IHUI AI',
      description:
        '基於 IHUI AI 全棧 AI 作業系統搭建的 AI 學術研究助手:論文檢索/綜述、PDF 解析、引用管理、研究趨勢分析、跨學科知識圖譜,30 分鐘上線,8 端分發。',
      inLanguage: ['zh-TW', 'zh-CN', 'en', 'ko', 'ja'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/zh-TW/use-cases/ai-research#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: '用例', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 學術研究', item: 'https://aizhs.top/zh-TW/use-cases/ai-research' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/zh-TW/use-cases/ai-research#howto',
      name: '30 分鐘搭建 AI 學術研究助手',
      description:
        '基於 IHUI AI 全棧 AI 作業系統搭建 AI 學術研究助手的 6 步流程:接入資料庫 → 上傳文獻 → 配置引用樣式 → 訓練綜述模型 → 建構知識圖譜 → 輸出趨勢報告。文獻調研效率提升 8 倍。',
      inLanguage: ['zh-TW', 'zh-CN', 'en', 'ko', 'ja'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '研究領域關鍵詞/既往文獻 PDF/引用樣式(APA/MLA/Chicago)' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 文獻檢索引擎' },
        { '@type': 'HowToTool', name: 'IHUI AI PDF 解析模組' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '接入學術資料庫', text: '對接 arXiv/PubMed/IEEE/知網/萬方/CNKI 等 30+ 資料庫,定時抓取新發表論文。' },
        { '@type': 'HowToStep', position: 2, name: '上傳文獻 PDF', text: '批次上傳歷史 PDF 文獻,AI 自動抽取標題/作者/摘要/參考文獻,建構本地文獻庫。' },
        { '@type': 'HowToStep', position: 3, name: '配置引用樣式', text: '選擇 APA/MLA/Chicago/GB/T 7714 等主流引用樣式,Agent 自動生成符合規範的參考文獻。' },
        { '@type': 'HowToStep', position: 4, name: '訓練綜述模型', text: 'Agent 學習團隊既往綜述寫作風格,基於本地文獻庫生成符合學術規範的文獻綜述。' },
        { '@type': 'HowToStep', position: 5, name: '建構知識圖譜', text: '抽取論文中的實體(作者/機構/方法/資料集)與關係,生成跨學科知識圖譜,支援探索性查詢。' },
        { '@type': 'HowToStep', position: 6, name: '輸出趨勢報告', text: '基於時間序列與主題模型,每週輸出研究熱點/新興方法/潛在合作者報告。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 學術研究助手 — 論文檢索/綜述/引用管理 | IHUI AI',
  description:
    '用 IHUI AI 建構 AI 學術研究助手:論文檢索 + PDF 解析 + 引用管理 + 綜述生成 + 知識圖譜 + 趨勢分析。30 分鐘上線,8 端分發,Apache 2.0 開源。',
  alternates: { canonical: '/zh-TW/use-cases/ai-research' },
  openGraph: {
    title: 'AI 學術研究助手 — IHUI AI',
    description: '文獻檢索 + 綜述生成 + 知識圖譜,30 分鐘上線。',
    url: 'https://aizhs.top/zh-TW/use-cases/ai-research',
    type: 'article',
  },
}

const problems = [
  'arXiv/PubMed/知網/萬方/Google Scholar 跨庫檢索耗時,新人需要 2-3 個月才能熟悉本領域核心文獻',
  'PDF 文獻堆積,人工閱讀 100 篇論文平均要 40 小時,資訊萃取效率極低',
  '參考文獻格式(APA/MLA/Chicago/GB/T 7714)人工整理易出錯,影響投稿',
  '文獻綜述寫作依賴個人經驗,跨學科關聯難以發現,創新點挖掘受限',
  '研究熱點快速變化,人工追蹤週報/月報產出滯後,容易錯過合作機會',
  '課題組成員文獻庫各自維護,知識資產無法在團隊內沉澱與複用',
]

const capabilities = [
  { title: '30+ 資料庫跨庫檢索', desc: '對接 arXiv/PubMed/IEEE/知網/萬方/Springer/Elsevier 等學術資料庫,統一檢索入口,新論文每日自動入庫。' },
  { title: 'PDF 智慧解析', desc: '批次解析 PDF 提取標題/作者/摘要/圖表/公式/參考文獻,100 篇文獻解析時間從 40 小時縮短到 20 分鐘。' },
  { title: '引用樣式自動生成', desc: '支援 APA/MLA/Chicago/GB/T 7714/IEEE Vancouver 等 20+ 引用樣式,Agent 自動按期刊要求格式化參考文獻。' },
  { title: '文獻綜述生成', desc: 'Agent 學習團隊既往綜述寫作風格,基於本地文獻庫生成結構化綜述,人工只需潤稿,週期從 2 週縮到 2 天。' },
  { title: '跨學科知識圖譜', desc: '抽取論文中的實體(作者/機構/方法/資料集)與關係,生成可視化知識圖譜,支援探索性查詢與潛在合作者發現。' },
  { title: '研究趨勢分析', desc: '基於時間序列與主題模型,追蹤研究熱點/新興方法/高被引論文,每週輸出趨勢報告,輔助選題決策。' },
]

const cases = [
  {
    title: '高校實驗室:博士生調研週期從 2 個月縮到 1 週',
    desc: '某 985 高校資訊工程系 12 名博士生接入 AI 研究助手,文獻閱讀效率提升 8 倍,綜述寫作時間從平均 14 天壓縮到 2.5 天,SCI 論文產出量同比提升 35%。',
  },
  {
    title: '研究院:跨學科課題立項週期縮短 60%',
    desc: '中國某新型研究院使用 AI 研究助手的知識圖譜,自動發現生物資訊學與材料學的交叉點,輔助立項 8 個跨學科課題,平均立項週期從 6 個月壓縮到 2.4 個月。',
  },
  {
    title: '企業研發:技術情報週報自動化',
    desc: '某 AI 大模型公司接入 AI 研究助手,自動監控全球 30+ 頂會(NeurIPS/ICML/CVPR/ACL)新論文,每週一自動生成技術情報週報,研發團隊對前沿動態的反應速度提升 5 倍。',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web 端文獻檢索/閱讀/寫作工作台' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 端文獻元資料管理與權限控管' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: 'PDF 解析 + 綜述生成 + 知識圖譜抽取' },
  { name: 'MCP 工具協定', purpose: '對接 arXiv/PubMed/知網/萬方等資料源適配器' },
  { name: 'Tauri 2 桌面端', purpose: '離線文獻庫 + 本地 PDF 標註' },
  { name: 'WXT 瀏覽器擴充套件', purpose: '在 Google Scholar/PubMed 網頁一鍵入庫文獻' },
  { name: 'Taro 4 小程式', purpose: '行動端文獻速讀 + 速記' },
  { name: 'CLI 命令列', purpose: '批次文獻管理與 BibTeX 匯出' },
]

const metrics = [
  { value: '30+', label: '學術資料庫' },
  { value: '8×', label: '文獻調研提速' },
  { value: '20+', label: '引用樣式' },
  { value: '30min', label: '上線時間' },
]

export default function AiResearchPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            學術研究
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 學術研究助手:讓文獻調研效率提升 8 倍
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            基於 IHUI AI 全棧 AI 作業系統搭建,8 端分發(Web/桌面/小程式/瀏覽器擴充套件/RN/CLI/API/AI-Service),Apache 2.0 開源,支援私有化部署。
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
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">研究者的真實痛點</h2>
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
            基於 IHUI AI 全棧 AI 作業系統,8 端同源,核心元件全部開源。
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
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">開始搭建你的 AI 學術研究助手</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            註冊即得 1000 積分,從學術研究場景模板一鍵 fork,30 分鐘體驗。
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 諮詢入口 8801</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> 教學版 8802</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> 實驗室部署 8803</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> 鏡像加速 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
