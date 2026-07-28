import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, BookOpen, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/ja/use-cases/ai-research#webpage',
      url: 'https://aizhs.top/ja/use-cases/ai-research',
      name: 'AI 学術研究アシスタント Agent ユースケース — IHUI AI',
      description:
        'IHUI AI フルスタック AI OS を基盤に構築する AI 学術研究アシスタント:論文検索・綜述、PDF 解析、引用管理、研究トレンド分析、分野横断ナレッジグラフ。30 分で導入、8 エンドポイント配信。',
      inLanguage: ['ja', 'zh-CN', 'zh-TW', 'en', 'ko'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/ja/use-cases/ai-research#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: 'ユースケース', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 学術研究', item: 'https://aizhs.top/ja/use-cases/ai-research' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/ja/use-cases/ai-research#howto',
      name: '30 分で AI 学術研究アシスタントを構築',
      description:
        'IHUI AI フルスタック AI OS を基盤に AI 学術研究アシスタントを構築する 6 ステップ:データベース接続 → 文献アップロード → 引用スタイル設定 → 綜述モデル学習 → ナレッジグラフ構築 → トレンドレポート出力。文献調査効率 8 倍。',
      inLanguage: ['ja', 'zh-CN', 'zh-TW', 'en', 'ko'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '研究分野キーワード / 既存文献 PDF / 引用スタイル (APA/MLA/Chicago)' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 文献検索エンジン' },
        { '@type': 'HowToTool', name: 'IHUI AI PDF 解析モジュール' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '学術 DB 接続', text: 'arXiv / PubMed / IEEE / CNKI / Wanfang など 30 以上の DB を接続し、新規論文を毎日自動取得。' },
        { '@type': 'HowToStep', position: 2, name: '文献 PDF アップロード', text: '過去 PDF を一括アップロード、タイトル・著者・要旨・参考文献を AI が自動抽出しローカル文献庫を構築。' },
        { '@type': 'HowToStep', position: 3, name: '引用スタイル設定', text: 'APA / MLA / Chicago / GB/T 7714 など主要引用スタイルから選択、Agent が雑誌規定の参考文献を自動生成。' },
        { '@type': 'HowToStep', position: 4, name: '綜述モデル学習', text: 'チーム過去の綜述文体を Agent が学習、ローカル文献庫に基づき構造化綜述を生成。' },
        { '@type': 'HowToStep', position: 5, name: 'ナレッジグラフ構築', text: '論文のエンティティ (著者・機関・手法・データセット) と関係を抽出、分野横断ナレッジグラフを可視化。' },
        { '@type': 'HowToStep', position: 6, name: 'トレンドレポート出力', text: '時系列とトピックモデルに基づき、研究热点・新興手法・潜在協力者レポートを毎週出力。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 学術研究アシスタント — 論文検索 / 綜述 / 引用管理 | IHUI AI',
  description:
    'IHUI AI で AI 学術研究アシスタントを構築:論文検索 + PDF 解析 + 引用管理 + 綜述生成 + ナレッジグラフ + トレンド分析。30 分導入、8 エンドポイント配信、Apache 2.0 オープンソース。',
  alternates: { canonical: '/ja/use-cases/ai-research' },
  openGraph: {
    title: 'AI 学術研究アシスタント — IHUI AI',
    description: '文献検索 + 綜述生成 + ナレッジグラフ、30 分導入。',
    url: 'https://aizhs.top/ja/use-cases/ai-research',
    type: 'article',
  },
}

const problems = [
  'arXiv / PubMed / CNKI / Wanfang / Google Scholar の横断検索に時間がかかり、新人は当該分野の中核文献把握に 2〜3 ヶ月必要',
  'PDF 文献が積み上がり、100 論文の精読に平均 40 時間、情報抽出効率が極めて低い',
  '参考文献の体裁 (APA / MLA / Chicago / GB/T 7714) を手作業で整える際のミスが投稿品質に影響',
  '文献綜述の作成が個人の経験に依存し、分野横断の関連発見が難しくイノベーション掘り起こしが制限される',
  '研究热点が急速に変化し、手動の週報・月報は遅延しがちで協力機会を逃しやすい',
  '研究グループメンバー各自の文献庫で管理され、ナレッジ資産がチーム内で蓄積・再利用されない',
]

const capabilities = [
  { title: '30+ DB 横断検索', desc: 'arXiv / PubMed / IEEE / CNKI / Wanfang / Springer / Elsevier などの学術 DB を統合検索、新論文を毎日自動入库。' },
  { title: 'PDF スマート解析', desc: 'PDF を一括解析しタイトル・著者・要旨・図表・式・参考文献を抽出、100 論文の解析時間が 40 時間から 20 分に短縮。' },
  { title: '引用スタイル自動生成', desc: 'APA / MLA / Chicago / GB/T 7714 / IEEE Vancouver など 20+ の引用スタイルをサポート、Agent が雑誌規定に合わせて参考文献を自動整形。' },
  { title: '文献綜述生成', desc: 'チーム過去の綜述文体を Agent が学習し構造化綜述を生成、手作業は推敲のみで済み、サイクルを 2 週間から 2 日に短縮。' },
  { title: '分野横断ナレッジグラフ', desc: '論文のエンティティ (著者・機関・手法・データセット) と関係を抽出、可視化ナレッジグラフで探索的クエリと潜在協力者発見を支援。' },
  { title: '研究トレンド分析', desc: '時系列とトピックモデルに基づき研究热点・新興手法・高被引論文を追跡、週次トレンドレポートで选题判断を支援。' },
]

const cases = [
  {
    title: '大学ラボ:博士課程の調査サイクルを 2 ヶ月から 1 週間に',
    desc: '某 985 大学计算机学科の博士課程 12 名が AI 研究アシスタントを導入。文献精読効率が 8 倍向上、綜述作成期間が平均 14 日から 2.5 日に短縮、SCI 論文発表数が前年同期比 35% 増加。',
  },
  {
    title: '研究院:分野横断プロジェクトの立上げ期間を 60% 短縮',
    desc: '中国某新型研究院がナレッジグラフを活用し生物情報学と材料学の交差点を自動発見、分野横断プロジェクト 8 件の立上げを支援、立上げ平均期間を 6 ヶ月から 2.4 ヶ月に短縮。',
  },
  {
    title: '企業 R&D:技術情報週報の自動化',
    desc: '某 AI 大手モデル企業が AI 研究アシスタントを導入し、世界 30+ のトップ会議 (NeurIPS / ICML / CVPR / ACL) の新論文を自動監視、毎週月曜に技術情報週報を自動生成、最前線動態への反応速度が 5 倍向上。',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web エンドの文献検索・閲覧・執筆ワークベンチ' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API エンドの文献メタデータ管理とアクセス制御' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: 'PDF 解析 + 綜述生成 + ナレッジグラフ抽出' },
  { name: 'MCP ツールプロトコル', purpose: 'arXiv / PubMed / CNKI / Wanfang などのデータソースアダプタ' },
  { name: 'Tauri 2 デスクトップ', purpose: 'オフライン文献庫 + ローカル PDF 注釈' },
  { name: 'WXT ブラウザ拡張', purpose: 'Google Scholar / PubMed 上でワンクリック入库' },
  { name: 'Taro 4 ミニプログラム', purpose: 'モバイル文献速読 + メモ' },
  { name: 'CLI コマンドライン', purpose: '文献の一括管理と BibTeX エクスポート' },
]

const metrics = [
  { value: '30+', label: '学術 DB' },
  { value: '8×', label: '文献調査高速化' },
  { value: '20+', label: '引用スタイル' },
  { value: '30min', label: '導入時間' },
]

export default function AiResearchPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            学術研究
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            AI 学術研究アシスタント:文献調査効率 8 倍向上
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            IHUI AI フルスタック AI OS 上で構築、8 エンドポイント配信 (Web / デスクトップ / ミニプログラム / ブラウザ拡張 / RN / CLI / API / AI-Service)、Apache 2.0 オープンソース、オンプレ対応。
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

        {/* 課題 */}
        <section className="mt-16 rounded-2xl border bg-card p-8 md:p-12">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">研究者が直面するリアルな課題</h2>
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
          <h2 className="text-center text-xl font-bold tracking-tight md:text-2xl">6 つのコア能力</h2>
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

        {/* 事例 */}
        <section className="mt-16 rounded-2xl border bg-primary/5 p-8 md:p-12">
          <h2 className="text-center text-xl font-bold tracking-tight md:text-2xl">導入事例</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {cases.map((cs, i) => (
              <div key={i} className="rounded-2xl border bg-card p-6">
                <h3 className="text-base font-semibold">{cs.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cs.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ツールチェーン */}
        <section className="mt-16">
          <div className="flex items-center justify-center gap-3">
            <Wrench className="h-6 w-6 text-primary" />
            <h2 className="text-center text-xl font-bold tracking-tight md:text-2xl">技術スタックとツールチェーン</h2>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground md:text-base">
            IHUI AI フルスタック AI OS 上で構築、8 エンドポイントでソース統一、核心コンポーネントはすべてオープンソース。
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

        {/* お問い合わせ / CTA */}
        <section className="mt-16 rounded-2xl border bg-card p-8 text-center md:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold tracking-tight md:text-2xl">AI 学術研究アシスタントの構築を始めましょう</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            登録で 1000 クレジット進呈、学術研究シナリオテンプレートからワンクリック fork、30 分で体験。
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sso/register"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              無料登録
            </Link>
            <Link
              href="/use-cases"
              className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium hover:bg-accent"
            >
              他のユースケースを見る <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> ご相談窓口 8801</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> 教育版 8802</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> ラボ導入 8803</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> ミラー高速化 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
