import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, Megaphone, AlertTriangle, Wrench, MessageSquare, GraduationCap, Palette, Globe } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://ihui.ai/ja/use-cases/ai-marketing#webpage',
      url: 'https://ihui.ai/ja/use-cases/ai-marketing',
      name: 'AI マーケティングコンテンツ生成 Agent ユースケース — IHUI AI',
      description:
        'IHUI AI フルスタック AI OS を基盤に構築する AI マーケティングコンテンツ生成 Agent:マルチプラットフォームコピー (XHS / Douyin / Weibo / WeChat / LinkedIn)、SEO ブログ、ブランドトーン統一、A/B テスト、ペルソナ駆動。30 分で導入、8 エンドポイント配信。',
      inLanguage: ['ja', 'zh-CN', 'zh-TW', 'en', 'ko'],
      isPartOf: { '@id': 'https://ihui.ai/#website' },
      about: { '@id': 'https://ihui.ai/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://ihui.ai/ja/use-cases/ai-marketing#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://ihui.ai' },
        { '@type': 'ListItem', position: 2, name: 'ユースケース', item: 'https://ihui.ai/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI マーケティング', item: 'https://ihui.ai/ja/use-cases/ai-marketing' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://ihui.ai/ja/use-cases/ai-marketing#howto',
      name: '30 分で AI マーケティングコンテンツ生成 Agent を構築',
      description:
        'IHUI AI フルスタック AI OS を基盤に AI マーケティングコンテンツ生成 Agent を構築する 6 ステップ:ブランドガイドアップロード → トーン学習 → マルチプラットフォーム API 接続 → A/B テスト設定 → ペルソナインポート → データフィードバックループ有効化。コンテンツ産出 10 倍。',
      inLanguage: ['ja', 'zh-CN', 'zh-TW', 'en', 'ko'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: 'ブランドガイド / 過去ヒット記事 / 製品マニュアル / ターゲットペルソナ' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI マルチプラットフォームコピーエンジン' },
        { '@type': 'HowToTool', name: 'IHUI AI ブランドトーンモジュール' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: 'ブランドガイドアップロード', text: 'ブランドストーリー / トーン文書 / 過去ヒットをアップロード、AI が語調と禁忌表現を学習。' },
        { '@type': 'HowToStep', position: 2, name: 'トーンモデル学習', text: 'LLM をブランド過去コンテンツで微調整、手動レビュー工数を 80% 削減しつつブランドペルソナを保持。' },
        { '@type': 'HowToStep', position: 3, name: 'マルチプラットフォーム API 接続', text: 'XHS / Douyin / Weibo / WeChat / LinkedIn / Twitter の Open API をワンクリック接続、ツール切替不要。' },
        { '@type': 'HowToStep', position: 4, name: 'A/B テスト設定', text: '选题ごとに 3-5 のタイトルとカバー案を自動生成、Agent が A/B テストを実行、72 時間以内に高 CTR 版を特定。' },
        { '@type': 'HowToStep', position: 5, name: 'ペルソナインポート', text: 'CRM のペルソナ (年齢・地域・消費力・興味) をインポート、Agent が自動的に語調・角度・CTA をマッチング、転換率 35% 向上。' },
        { '@type': 'HowToStep', position: 6, name: 'データフィードバック', text: 'プラットフォーム指標 (閲覧・いいね・転換) を取得、AI が高パフォーマンスパターンをレビューし次回生成に反映。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI マーケティングコンテンツ生成 — マルチプラットフォーム / SEO / ブランドトーン | IHUI AI',
  description:
    'IHUI AI で AI マーケティングコンテンツ生成 Agent を構築:マルチプラットフォームコピー + SEO ブログ + ブランドトーン統一 + A/B テスト + ペルソナ駆動。30 分導入、8 エンドポイント配信。',
  alternates: { canonical: '/ja/use-cases/ai-marketing' },
  openGraph: {
    title: 'AI マーケティングコンテンツ生成 Agent — IHUI AI',
    description: 'マルチプラットフォーム一括リライト + ブランドトーン統一 + A/B テスト、30 分導入。',
    url: 'https://ihui.ai/ja/use-cases/ai-marketing',
    type: 'article',
  },
}

const problems = [
  'WeChat / Zhihu / XHS / Douyin / LinkedIn の運用で各プラットフォームのトーンが異なり、手作業のリライトで生産性が低下',
  'マーケティングコピーは SEO キーワード + ブランドトーン + プラットフォームアルゴリズムの嗜好を同時に満たす必要があり、手作業では効率と一貫性が低い',
  '选题企画が少数のシニア編集者に依存し、新人のアウトプットが不安定、ブランドトーンがブレやすい',
  'A/B テストには大量の素材が必要で手作業の生産が追いつかず、最適化判断が遅延',
  '多言語版 (中・英・日・韓・繁体) に別言語の編集者が必要で翻訳外注コストが高くサイクルも長い',
  'マーケティング効果データが各プラットフォーム管理画面に散在、手動週報・月報に時間がかかりコンテンツ戦略へのフィードバックが遅れる',
]

const capabilities = [
  { title: 'ワンクリック マルチプラットフォーム リライト', desc: '3,000 字の深掘り記事を XHS 短文 / Douyin スクリプト / Zhihu 回答 / LinkedIn 長文 / Weibo 投稿へ自動変換、各プラットフォームのトーンに合わせて手動微調整のみで配信可能。' },
  { title: 'スマート SEO 最適化', desc: 'ターゲットキーワードを入力すると AI が SEO フレンドリーなタイトル・メタ・本文を自動生成、Google / Bing / Baidu の主要 SEO ルールを内蔵。' },
  { title: 'ブランドトーン統一', desc: 'ブランドガイドと過去ヒットをアップロード、AI がトーンを学習し 100% ブランド準拠のアウトプットを実現。' },
  { title: 'A/B テストコピー', desc: '选题ごとに 3-5 のタイトルとカバー案を自動生成、Agent が A/B テストを実行し 72 時間以内に高 CTR 版を特定、転換率 35% 向上。' },
  { title: 'ペルソナ駆動コンテンツ', desc: 'CRM のペルソナをインポートし、Agent が語調・コンテンツ角度・CTA 文言をマッチング、千人千面のコンテンツを生成。' },
  { title: 'データフィードバックループ', desc: 'プラットフォーム指標を取り込み、AI が高パフォーマンスパターンをレビュー、次回制作に反映して継続最適化。' },
]

const cases = [
  {
    title: 'DTC 新消費ブランド:コンテンツ産出 ×10',
    desc: '某新茶飲ブランドが AI マーケティング Agent を導入、1 名の運用担当で 5 プラットフォーム (XHS / Douyin / Weibo / WeChat / Bilibili) を同時運営、月間コンテンツ産出が 80 本から 850 本に増加、フォロワー 3.2 倍、CAC 40% 削減。',
  },
  {
    title: 'B2B SaaS:SEO 自然流入 +220%',
    desc: '某 B2B SaaS 企業が AI マーケティング Agent で SEO ブログを自動生成、6 ヶ月で 240 本の高品質英語ブログを公開し Google 自然流入 220% 増、MQL 85% 増。',
  },
  {
    title: '越境 EC:多言語ローカライズコスト -80%',
    desc: '某越境 EC ブランドが AI 多言語リライト機能で 5 言語 (日 / 韓 / 英 / 独 / 仏) ローカライズ外注コストを 80% 削減、商品サイクルを 14 日から 3 日に短縮。',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web エンドのマーケティングワークベンチとブランドガイド管理' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API エンドのマルチプラットフォームアカウント認可と配信キュー' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: 'マルチプラットフォームリライト + SEO 最適化 + ブランドトーン微調整' },
  { name: 'MCP ツールプロトコル', purpose: 'XHS / Douyin / Weibo / WeChat / LinkedIn のプラットフォームアダプタ' },
  { name: 'Tauri 2 デスクトップ', purpose: 'ローカルブランド素材庫 + オフラインコピーワークベンチ' },
  { name: 'WXT ブラウザ拡張', purpose: '任意のページで素材や競合コピーをワンクリック取得' },
  { name: 'Taro 4 ミニプログラム', purpose: 'モバイルのマーケティングデータダッシュボードと即時レビュー' },
  { name: 'CLI コマンドライン', purpose: 'コンテンツ一括生成と配信パイプラインの自動化' },
]

const metrics = [
  { value: '×10', label: 'コンテンツ産出' },
  { value: '80%', label: '多言語コスト削減' },
  { value: '35%', label: '転換率向上' },
  { value: '30min', label: '導入時間' },
]

export default function AiMarketingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Megaphone className="h-3.5 w-3.5 text-primary" />
            マーケティングコンテンツ
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            AI マーケティングコンテンツ生成:マルチプラットフォーム一括産出、10 倍の産出
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            IHUI AI フルスタック AI OS 上で構築、8 エンドポイント配信、Apache 2.0 オープンソース、オンプレ対応、ブランドトーン統一を保証。
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
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">マーケティングチームの生産性ボトルネック</h2>
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
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">6 つのコア能力</h2>
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
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">導入事例</h2>
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
            <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">技術スタックとツールチェーン</h2>
          </div>
          <p className="mx-auto mt-3 max-w-3xl text-center text-sm text-muted-foreground md:text-base">
            IHUI AI フルスタック AI OS 上で構築、8 エンドポイントでソース統一、核心コンポーネントはすべてオープンソース、5 大手 SNS とシームレス連携。
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
          <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">AI マーケティングコンテンツアシスタントの構築を始めましょう</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            登録で 1000 クレジット進呈、マーケティングシナリオテンプレートからワンクリック fork、30 分でマルチプラットフォーム一括産出を体験。
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> ビジネス相談 8804</span>
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> マーケアカデミー 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> ブランドカスタム 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> プラットフォームミラー 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
