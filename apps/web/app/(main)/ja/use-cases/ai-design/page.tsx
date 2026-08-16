import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  PaintBucket,
  AlertTriangle,
  Wrench,
  MessageSquare,
  GraduationCap,
  Palette,
  Globe,
} from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/ja/use-cases/ai-design#webpage',
      url: 'https://aizhs.top/ja/use-cases/ai-design',
      name: 'AI デザイン協業 Agent ユースケース — IHUI AI',
      description:
        'IHUI AI フルスタック AI OS を基盤に構築する AI デザイン協業 Agent:ポスター / Logo コンセプト、UI スケッチ → コード、ブランド資産管理、デザインレビュー、デザインシステム検索。30 分で導入、8 エンドポイント配信。',
      inLanguage: ['ja', 'zh-CN', 'zh-TW', 'en', 'ko'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/ja/use-cases/ai-design#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://aizhs.top' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'ユースケース',
          item: 'https://aizhs.top/use-cases',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'AI デザイン協業',
          item: 'https://aizhs.top/ja/use-cases/ai-design',
        },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/ja/use-cases/ai-design#howto',
      name: '30 分で AI デザイン協業 Agent を構築',
      description:
        'IHUI AI フルスタック AI OS を基盤に AI デザイン協業 Agent を構築する 6 ステップ:ブランド資産アップロード → デザインシステム設定 → コンセプト生成学習 → スケッチ → コード有効化 → レビュールール設定 → 協業ツール接続。デザインサイクル 60% 短縮。',
      inLanguage: ['ja', 'zh-CN', 'zh-TW', 'en', 'ko'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [
        {
          '@type': 'HowToSupply',
          name: 'ブランド VI マニュアル / 過去デザイン稿 / デザインシステム tokens',
        },
      ],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI デザインコンセプト生成エンジン' },
        { '@type': 'HowToTool', name: 'IHUI AI スケッチ → コードモジュール' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'ブランド資産アップロード',
          text: 'ブランド VI / 過去ポスター / Logo / デザインシステム tokens をアップロード、AI がパレット・フォント・レイアウトを抽出。',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'デザインシステム設定',
          text: 'Figma Tokens (色・字サイズ・間隔・角丸・影) を入力、生成はデザインシステムに厳密準拠し再作業を不要に。',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'コンセプト生成学習',
          text: 'ブランドの過去ヒットポスター / Logo でコンセプトモデルを学習、AI が 3-5 のクリエイティブ方向を自動生成。',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: 'スケッチ → コード',
          text: '手描き UI スケッチをアップロード、Agent がコンポーネント構造を認識して React + Tailwind コードを生成 (精度 85%+)。',
        },
        {
          '@type': 'HowToStep',
          position: 5,
          name: 'レビュールール設定',
          text: 'アクセシビリティ (a11y) / ブランド一貫性 / レスポンシブのルールを設定、Agent が自動でデザイン稿をレビューし修正項目をフラグ。',
        },
        {
          '@type': 'HowToStep',
          position: 6,
          name: '協業ツール接続',
          text: 'Figma / Sketch / 即時設計 / 藍湖 / Notion と連携、デザイナーはツール切替不要、AI がワークフローに組み込まれます。',
        },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI デザイン協業 — ポスター / Logo / スケッチ → コード / デザインシステム | IHUI AI',
  description:
    'IHUI AI で AI デザイン協業 Agent を構築:ポスター・Logo コンセプト + UI スケッチ → コード + ブランド資産管理 + デザインレビュー + デザインシステム検索。30 分導入、8 エンドポイント配信。',
  alternates: { canonical: '/ja/use-cases/ai-design' },
  openGraph: {
    title: 'AI デザイン協業 Agent — IHUI AI',
    description: 'スケッチ → コード + ブランド資産 + デザインレビュー、30 分導入。',
    url: 'https://aizhs.top/ja/use-cases/ai-design',
    type: 'article',
  },
}

const problems = [
  'ポスター / Logo / ランディングページ案件がシニアデザイナーに集中し、新人は単独制作が難しく生産性が制限される',
  '手描き UI スケッチからコード実装まで複数回のコミュニケーションが必要で、1 件のスケッチ → コードに平均 2-3 日',
  'ブランド資産 (Logo / フォント / パレット / レイアウト) が複数のクラウドドライブとローカルに散在、新人は 1-2 週間かけて習熟',
  'デザインレビューがシニアデザイナーに依存し、フィードバックサイクルが長く、デザイン仕様の一貫性が保ちにくい',
  'デザインシステム (Figma Tokens) 更新後、過去のデザイン稿が同期されず、デザイン資産の再利用率が低下',
  'マーケティング案件の臨時デザイン需要が多く、スケジュール衝突が深刻、緊急案件は残業対応になる',
]

const capabilities = [
  {
    title: 'ポスター / Logo コンセプト生成',
    desc: 'ブランドキーワードとターゲットオーディエンスを入力、AI が 3-5 のクリエイティブ方向 (配色・レイアウト・フォント) を生成し、デザイナーが深化作業を担当することでコンセプト時間を 1 日から 1 時間に短縮。',
  },
  {
    title: 'UI スケッチ → コード',
    desc: '手描き UI スケッチ (ホワイトボード・紙) をアップロード、Agent がコンポーネント構造を認識し React + Tailwind コードを生成 (精度 85%+)、可読性はチーム規範に準拠。',
  },
  {
    title: 'ブランド資産管理',
    desc: 'Logo / フォント / パレット / レイアウト / アイコンを統合管理、新人が 5 分でブランドを習熟、資産再利用率は 30% から 80% に向上。',
  },
  {
    title: 'スマートデザインレビュー',
    desc: 'a11y / ブランド一貫性 / レスポンシブ / コントラストのルールを設定、Agent が自動でデザイン稿をレビューし、修正項目をフラグ、フィードバック時間を 1 日から 10 分に短縮。',
  },
  {
    title: 'デザインシステム検索',
    desc: '自然言語クエリ (例:「12px 角丸のカードコンポーネントを探して」) で、Agent がデザインシステムライブラリから最適な過去コンポーネントを返却。',
  },
  {
    title: '協業ツール統合',
    desc: 'Figma / Sketch / 即時設計 / 藍湖 / Notion と連携、デザイナーはツール切替不要、学習コストはほぼゼロ。',
  },
]

const cases = [
  {
    title: 'インターネット企業 UGC:H5 サイクル 7 日 → 1.5 日',
    desc: '某大手インターネット企業の UGC マーケティング活動に AI デザイン協業 Agent を活用、デザイナーが手描きスケッチ後 1 時間以内に公開可能な H5 コードを生成、デザイン + 開発合計サイクルを 7 日から 1.5 日に短縮、人件費 70% 削減。',
  },
  {
    title: '新消費ブランド:VI 展開効率 5 倍',
    desc: '某新茶飲ブランドの店舗拡大期に 200 以上の素材 (ポスター / デリバリー包装 / メニュー) を迅速生成する必要があり、AI デザイン協業 Agent でブランド VI ライブラリから初稿を 80% 自動生成、デザイナーは微調整のみ、展開効率 5 倍。',
  },
  {
    title: 'B 端 SaaS:デザインシステム一貫性 98%',
    desc: '某企業向け SaaS 企業の 30 名デザインチームが AI デザインレビューを導入、デザイン稿通過率は 65% から 98%、フロントエンド再現度は 75% から 95% に向上、バージョン反復効率 60% 向上。',
  },
]

const toolchain = [
  {
    name: 'Next.js 15 + React 19',
    purpose: 'Web エンドのデザイン協業ワークベンチとデザインシステム管理',
  },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API エンドのデザイン資産保存とバージョン管理' },
  {
    name: 'FastAPI + LangGraph + LiteLLM',
    purpose: 'スケッチ認識 + コード生成 + デザインレビュー',
  },
  { name: 'MCP ツールプロトコル', purpose: 'Figma / Sketch / 即時設計 / 藍湖 のデザインアダプタ' },
  { name: 'Tauri 2 デスクトップ', purpose: 'ローカルデザイン資産キャッシュ + オフライン注釈' },
  { name: 'WXT ブラウザ拡張', purpose: 'Figma / ウェブで参考素材をワンクリック取得' },
  { name: 'Taro 4 ミニプログラム', purpose: 'モバイルでのデザイン稿レビューとコメント' },
  { name: 'CLI コマンドライン', purpose: 'デザイン資産の一括処理とエクスポート' },
]

const metrics = [
  { value: '60%', label: 'デザインサイクル短縮' },
  { value: '85%', label: 'スケッチ → コード精度' },
  { value: '5×', label: 'ブランド資産再利用' },
  { value: '30min', label: '導入時間' },
]

export default function AiDesignPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <PaintBucket className="h-3.5 w-3.5 text-primary" />
            デザイン協業
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI デザイン協業:スケッチ → コードとブランド資産の一元管理
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            IHUI AI フルスタック AI OS 上で構築、8 エンドポイント配信、Apache 2.0
            オープンソース、オンプレ対応、Figma / 即時設計 と深く連携。
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

        {/* 課題 */}
        <section className="mt-16 rounded-2xl border bg-card p-8 min-[768px]:p-12">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">
              デザインチームの協業課題
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
            6 つのコア能力
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

        {/* 事例 */}
        <section className="mt-16 rounded-2xl border bg-primary/5 p-8 min-[768px]:p-12">
          <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">
            導入事例
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

        {/* ツールチェーン */}
        <section className="mt-16">
          <div className="flex items-center justify-center gap-3">
            <Wrench className="h-6 w-6 text-primary" />
            <h2 className="text-center text-xl font-bold tracking-tight min-[768px]:text-2xl">
              技術スタックとツールチェーン
            </h2>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground min-[768px]:text-base">
            IHUI AI フルスタック AI OS 上で構築、8
            エンドポイントでソース統一、核心コンポーネントはすべてオープンソース、Figma / 即時設計
            と深く連携。
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

        {/* お問い合わせ / CTA */}
        <section className="mt-16 rounded-2xl border bg-card p-8 text-center min-[768px]:p-12">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold tracking-tight min-[768px]:text-2xl">
            AI デザイン協業アシスタントの構築を始めましょう
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground min-[768px]:text-base">
            登録で 1000 クレジット進呈、デザイン協業シナリオテンプレートからワンクリック fork、30
            分でスケッチ → コードを体験。
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
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> デザイン相談 8801
            </span>
            <span className="flex items-center gap-1.5">
              <GraduationCap className="h-3.5 w-3.5" /> デザインアカデミー 8805
            </span>
            <span className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" /> ブランドカスタム 8806
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Figma プラグイン 8809
            </span>
          </div>
        </section>
      </main>
    </>
  )
}
