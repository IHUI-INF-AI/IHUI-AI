import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, Languages, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/ja/use-cases/ai-translation#webpage',
      url: 'https://ihui.ai/ja/use-cases/ai-translation',
      name: 'AI 多言語翻訳 Agent ユースケース — IHUI AI',
      description:
        'IHUI AI フルスタック AI OS を基盤に構築する AI 多言語翻訳 Agent:多言語ドキュメント翻訳、ローカライズワークフロー、用語集管理、翻訳レビュー、文化適応、字幕翻訳。30 分で導入、8 エンドポイント配信。',
      inLanguage: ['ja', 'zh-CN', 'zh-TW', 'en', 'ko'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: { '@id': 'https://ihui.ai/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/ja/use-cases/ai-translation#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: 'ユースケース', item: 'https://ihui.ai/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 翻訳', item: 'https://ihui.ai/ja/use-cases/ai-translation' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://ihui.ai/ja/use-cases/ai-translation#howto',
      name: '30 分で AI 多言語翻訳 Agent を構築',
      description:
        'IHUI AI フルスタック AI OS を基盤に AI 多言語翻訳 Agent を構築する 6 ステップ:用語集構築 → 翻訳メモリアップロード → 言語設定 → 文化適応学習 → レビュールール設定 → ワークフロー接続。翻訳効率 6 倍、コスト 70% 削減。',
      inLanguage: ['ja', 'zh-CN', 'zh-TW', 'en', 'ko'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '用語集 / 翻訳メモリ / ブランドトーン文書 / 対象言語リスト' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI 多言語翻訳エンジン' },
        { '@type': 'HowToTool', name: 'IHUI AI 用語集管理モジュール' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '用語集構築', text: '製品・ブランド・業界用語を 50+ 言語で登録、Agent が用語一貫性を厳格に守り、訳語の分散を防止。' },
        { '@type': 'HowToStep', position: 2, name: '翻訳メモリアップロード', text: '過去の高品質対訳ドキュメントをアップロード、Agent がチーム文体を学習し AI 出力と人間の過去訳スタイルを一致させます。' },
        { '@type': 'HowToStep', position: 3, name: '対象言語設定', text: '50+ の主要言語 (繁体字/簡体字の地域変種など) を選択、一括翻訳をワンクリックで開始。' },
        { '@type': 'HowToStep', position: 4, name: '文化適応学習', text: 'ターゲット市場の文化習慣 (日本語の敬語、アラビア語の RTL、スペインのラ米 vs スペイン変種) に応じて翻訳を微調整、文化摩擦を回避。' },
        { '@type': 'HowToStep', position: 5, name: 'レビュールール設定', text: '用語一貫性 / 数値形式 / 日付形式 / 単位換算 / 機微語 のルールを設定、Agent が自動で疑わしい訳文をフラグ。' },
        { '@type': 'HowToStep', position: 6, name: 'ワークフロー接続', text: 'Git / CMS / Confluence / Notion / Figma などのコンテンツソースと連携、翻訳更新を自動同期、人間は重要コンテンツのみ最終レビュー。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI 多言語翻訳 — ドキュメント / ローカライズ / 用語集 / 字幕 | IHUI AI',
  description:
    'IHUI AI で AI 多言語翻訳 Agent を構築:ドキュメント翻訳 + ローカライズワークフロー + 用語集管理 + 翻訳レビュー + 文化適応 + 字幕翻訳。30 分導入、8 エンドポイント配信。',
  alternates: { canonical: '/ja/use-cases/ai-translation' },
  openGraph: {
    title: 'AI 多言語翻訳 Agent — IHUI AI',
    description: '多言語翻訳 + 用語集 + 文化適応、30 分導入。',
    url: 'https://ihui.ai/ja/use-cases/ai-translation',
    type: 'article',
  },
}

const problems = [
  '海外展開には 10+ 言語のローカライズが必要で、人手翻訳の外注コストが高い (1000 字あたり 0.3-1.5 元 × 10 言語で急増)',
  '製品用語・ブランド名が言語バージョンごとに訳出がバラつき、ユーザーの認識が混乱',
  'ドキュメント (API / ヘルプセンター / マニュアル) 更新後の翻訳版が遅延しユーザー体験が分断',
  'マーケティングコピーの翻訳に文化適応が欠け、直訳がターゲット市場の反感を買う (文化摩擦が多発)',
  '字幕 / UI テキスト / PDF / Word / Markdown / JSON などの多形式翻訳にツール手動切替が煩雑',
  '翻訳品質が少数のシニア翻訳者に依存し生産性が制限され、人員変動リスクも高い',
]

const capabilities = [
  { title: '50+ 言語ドキュメント翻訳', desc: '50+ の主要言語 (中・英・日・韓・仏・独・西・露・アラビア・葡・意・繁簡) をサポート、Word / PDF / Markdown / JSON / CSV などを一括翻訳、用語一貫性 99%。' },
  { title: 'ローカライズワークフロー', desc: 'Git / CMS / Confluence / Notion などのコンテンツソースと連携、ソース更新で自動翻訳起動、人間は重要コンテンツのみ最終レビュー。' },
  { title: '用語集管理', desc: '多言語用語集を構築し AI が用語一貫性を厳格に遵守、ブランド名 / 製品名 / 技術用語の誤訳ゼロ、翻訳メモリ (TM) をプロジェクト横断で再利用。' },
  { title: 'スマート翻訳レビュー', desc: '用語一貫性 / 数値形式 / 日付形式 / 単位換算 / 機微語 のルールを設定、Agent が自動で疑わしい訳文をフラグ、人間のレビュー工数を 75% 削減。' },
  { title: '文化適応', desc: 'ターゲット市場の文化習慣 (日本語の敬語階層、アラビア語の RTL、スペインのラ米 vs スペイン変種) に応じて自動的に表現を調整し、文化摩擦を回避、ローカライズ品質を向上。' },
  { title: '字幕翻訳', desc: '映像字幕の SRT / VTT ファイルを解析して翻訳、タイムラインを自動整列し多言語字幕版をエクスポート、字幕翻訳効率 8 倍。' },
]

const cases = [
  {
    title: '海外展開 SaaS:ローカライズコスト -70%',
    desc: '中国発 SaaS が 12 か国 (米・日・韓・独・仏・西・露・アラビアなど) に展開、AI 翻訳 Agent によりローカライズ年コストを 240 万元から 72 万元に削減、翻訳更新サイクルを 2 週間から 2 日に短縮。',
  },
  {
    title: '越境 EC:商品多言語出品 6 倍高速化',
    desc: '某越境 EC プラットフォームが AI 翻訳 Agent を導入、商品情報 (タイトル/詳細/仕様) を 10 言語で一括翻訳、新商品出品時間を 1.5 日から 6 時間に短縮、GMV 38% 向上。',
  },
  {
    title: 'オンライン教育:字幕ローカライズ 1 日で 8 言語カバー',
    desc: '某オンライン教育プラットフォームの 1000+ 講座動画が AI 字幕翻訳を導入、8 言語 (日・韓・英・西・葡・露・ア・仏) の字幕ローカライズ期間を 30 日から 1 日に短縮、海外ユーザーの有料転換率 52% 向上。',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web エンドの翻訳ワークベンチと用語集管理' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API エンドの翻訳メモリ (TM) とプロジェクトバージョン管理' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: '多言語翻訳 + 文化適応 + レビュールールエンジン' },
  { name: 'MCP ツールプロトコル', purpose: 'Git / CMS / Confluence / Notion / Figma などのコンテンツソースアダプタ' },
  { name: 'Tauri 2 デスクトップ', purpose: 'ローカルドキュメント翻訳 + オフライン用語集' },
  { name: 'WXT ブラウザ拡張', purpose: 'ウェブのワンクリック翻訳と用語ハイライト' },
  { name: 'Taro 4 ミニプログラム', purpose: 'モバイルドキュメントの写真翻訳' },
  { name: 'CLI コマンドライン', purpose: 'ドキュメント一括翻訳と CI/CD 連携' },
]

const metrics = [
  { value: '50+', label: '対応言語' },
  { value: '6×', label: '翻訳効率' },
  { value: '70%', label: 'コスト削減' },
  { value: '30min', label: '導入時間' },
]

export default function AiTranslationPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Languages className="h-3.5 w-3.5 text-primary" />
            多言語翻訳
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            AI 多言語翻訳:50+ 言語でローカライズ、コスト 70% 削減
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            IHUI AI フルスタック AI OS 上で構築、8 エンドポイント配信、Apache 2.0 オープンソース、オンプレ対応、用語集 + 文化適応で訳文品質を保証。
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
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">海外展開チームのローカライズ課題</h2>
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
            IHUI AI フルスタック AI OS 上で構築、8 エンドポイントでソース統一、核心コンポーネントはすべてオープンソース、Git / CMS / Confluence / Notion と深く連携。
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
          <h2 className="mt-4 text-xl font-bold tracking-tight md:text-2xl">AI 多言語翻訳アシスタントの構築を始めましょう</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            登録で 1000 クレジット進呈、翻訳シナリオテンプレートからワンクリック fork、30 分で多言語一括翻訳を体験。
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 翻訳相談 8801</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> 用語集研修 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> オンプレ導入 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> 言語拡張 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
