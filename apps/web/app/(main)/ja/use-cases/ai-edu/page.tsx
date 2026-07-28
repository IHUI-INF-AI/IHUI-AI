import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, GraduationCap, AlertTriangle, Wrench, MessageSquare, Palette, Globe, Lightbulb } from 'lucide-react'

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://aizhs.top/ja/use-cases/ai-edu#webpage',
      url: 'https://aizhs.top/ja/use-cases/ai-edu',
      name: 'AI スマート教育 Agent ユースケース — IHUI AI',
      description:
        'IHUI AI フルスタック AI OS を基盤に構築する AI スマート教育 Agent:パーソナライズ学習パス、知能答疑、テスト自動生成・採点、学習データ分析、教研協業、家庭・学校連絡。30 分で導入、8 エンドポイント配信。',
      inLanguage: ['ja', 'zh-CN', 'zh-TW', 'en', 'ko'],
      isPartOf: { '@id': 'https://aizhs.top/#website' },
      about: { '@id': 'https://aizhs.top/#organization' },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://aizhs.top/ja/use-cases/ai-edu#breadcrumb',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://aizhs.top' },
        { '@type': 'ListItem', position: 2, name: 'ユースケース', item: 'https://aizhs.top/use-cases' },
        { '@type': 'ListItem', position: 3, name: 'AI 教育', item: 'https://aizhs.top/ja/use-cases/ai-edu' },
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://aizhs.top/ja/use-cases/ai-edu#howto',
      name: '30 分で AI スマート教育 Agent を構築',
      description:
        'IHUI AI フルスタック AI OS を基盤に AI スマート教育 Agent を構築する 6 ステップ:生徒データ設定 → 学習パスト レーニング → 問題集連携 → 採点ルール設定 → データ分析有効化 → 家庭・学校連絡接続。100% パーソナライズ対応。',
      inLanguage: ['ja', 'zh-CN', 'zh-TW', 'en', 'ko'],
      totalTime: 'PT30M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'CNY', value: '0' },
      supply: [{ '@type': 'HowToSupply', name: '生徒データ / 問題集 / 教科書 / 教研資料' }],
      tool: [
        { '@type': 'HowToTool', name: 'IHUI AI パーソナライズ学習エンジン' },
        { '@type': 'HowToTool', name: 'IHUI AI スマート問題集モジュール' },
      ],
      step: [
        { '@type': 'HowToStep', position: 1, name: '生徒データ設定', text: '過去の成績・宿題・学習行動をインポート、AI が生徒プロファイルと弱点強みを特定します。' },
        { '@type': 'HowToStep', position: 2, name: '学習パストレーニング', text: 'ナレッジグラフと過去データでパーソナライズパスを学習、生徒ごとの日次・週次プランを自動生成。' },
        { '@type': 'HowToStep', position: 3, name: '問題集連携', text: '学校・地区・第三者問題集 (K12・語学・職業訓練) を連携、AI がレベル適合テストを自動生成。' },
        { '@type': 'HowToStep', position: 4, name: '採点ルール設定', text: '客観式・主観式 (作文・自由記述) のルール設定、Agent が 24 時間採点、主観式 85% 以上の精度。' },
        { '@type': 'HowToStep', position: 5, name: 'データ分析', text: 'クラス・学年・科目データを統合、学習レポート自動生成、共通弱点を発見し教研を支援。' },
        { '@type': 'HowToStep', position: 6, name: '家庭・学校連絡', text: 'WeChat / DingTalk / WeCom の保護者アプリを連携、週次レポート / 宿題 / 進捗ハイライトを自動配信。' },
      ],
    },
  ],
}

export const metadata: Metadata = {
  title: 'AI スマート教育 — パーソナライズ / 答疑 / 採点 / 家庭連絡 | IHUI AI',
  description:
    'IHUI AI で AI スマート教育 Agent を構築:パーソナライズ学習パス + 24 時間答疑 + テスト自動生成採点 + 学習分析 + 教研協業 + 家庭連絡。30 分導入、8 エンドポイント配信。',
  alternates: { canonical: '/ja/use-cases/ai-edu' },
  openGraph: {
    title: 'AI スマート教育 Agent — IHUI AI',
    description: 'パーソナライズ学習 + 答疑 + 採点、30 分導入。',
    url: 'https://aizhs.top/ja/use-cases/ai-edu',
    type: 'article',
  },
}

const problems = [
  '大人数クラス (40-60 名) で個別最適化が困難、進度速い生徒が伸び悩み、遅い生徒が取り残される',
  '課後答疑が教師のオンライン時間に依存、夕方や週末に質問が集中し学習継続性が損なわれる',
  '採点 (特に作文・主観式) に教師工数がかかり、フィードバック遅延で誤り修正効果が弱い',
  '生徒データ (成績・宿題・授業態度) がシステムごとに散在、総合分析困難で教研が遅い',
  '教研協業 (教案・スライド・問題) に統一プラットフォームがなく、質の高い資源の共有が進まない',
  '家庭・学校連絡は面談と WeChat グループに依存、情報非対称で保護者が生徒状況をタイムリーに把握できない',
]

const capabilities = [
  { title: 'パーソナライズ学習パス', desc: 'ナレッジグラフと生徒プロファイルで日次・週次計画を動的生成、進度の速い生徒は発展問題、遅い生徒は重点補強、個性別指導をスケール化。' },
  { title: '24 時間スマート答疑', desc: 'AI 答疑 Agent が教科ナレッジグラフと過去問答で常時応答、30 秒以内回答、K12 92% 精度で主要科目をカバー。' },
  { title: 'スマート問題生成・採点', desc: '問題集連携で生徒レベル適合テスト自動生成、客観式は即時採点、主観式 (作文・記述) は 85% 以上の精度で採点、教师工数 70% 削減。' },
  { title: '学習データ分析', desc: 'クラス・学年・科目データを集約、学習レポート自動生成、共通弱点を発見しデータ駆動の教研を支援。' },
  { title: '教研協業', desc: '教案・スライド・問題・振り返りを一元管理、学校・地区間共有で質の高い資源の再利用率を 30% から 75% に向上。' },
  { title: '家庭・学校連絡', desc: 'WeChat / DingTalk / WeCom の保護者アプリを連携、週次レポート / 宿題 / 進捗を自動配信、保護者満足度 60% 向上。' },
]

const cases = [
  {
    title: '地区教育局:3 万名生徒へのパーソナライズ学習',
    desc: '中国某市の地区教育局が 32 校 3 万名生徒に AI スマート教育 Agent を導入、月間 280 万件の答疑に対応、採点効率 8 倍向上、教師の個別添削時間 35% 増加。',
  },
  {
    title: 'K12 研修機関:継続率 +25%',
    desc: '某大手 K12 研修機関が AI スマート教育 Agent を活用、週次学習レポートで保護者が進捗を実感、継続率を 62% から 87% に引き上げ、保護者クレーム 70% 削減。',
  },
  {
    title: '大学:基幹科目の 24 時間答疑カバレッジ',
    desc: '某 985 大学が一般教養科目 (微積分・英語・情報基礎) に AI 答疑 Agent を活用、学生質問は 30 秒以内に回答、教師は反復答疑から解放され授業設計に集中、合格率 18% 向上。',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web エンドの教学管理コンソールと学習ダッシュボード' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API エンドの生徒データ保管と権限隔離' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: 'パーソナライズ + 答疑 + 主観式採点エンジン' },
  { name: 'MCP ツールプロトコル', purpose: '問題集・教科書・学習システム・家校連絡プラットフォームのアダプタ' },
  { name: 'Tauri 2 デスクトップ', purpose: '教師オフライン教案準備とローカル問題集' },
  { name: 'WXT ブラウザ拡張', purpose: '教研サイト・問題集のワンクリック収集' },
  { name: 'Taro 4 ミニプログラム', purpose: '学生写真問題検索と保護者学習レポート' },
  { name: 'CLI コマンドライン', purpose: '問題集一括インポートと生徒データエクスポート' },
]

const metrics = [
  { value: '100%', label: 'パーソナライズ対応' },
  { value: '70%', label: '教師工数削減' },
  { value: '92%', label: '答疑精度' },
  { value: '30min', label: '導入時間' },
]

export default function AiEduPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-8">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
            スマート教育
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            AI スマート教育:全生徒にパーソナライズ学習パスを
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">
            IHUI AI フルスタック AI OS 上で構築、8 エンドポイント配信、Apache 2.0 オープンソース、オンプレ対応。K12・高等教育・職業訓練を網羅。
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
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">教育現場が直面する課題</h2>
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
            IHUI AI フルスタック AI OS 上で構築、8 エンドポイントでソース統一、核心コンポーネントはすべてオープンソース。K12・高等教育・職業訓練のシナリオを網羅。
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
          <h2 className="mt-4 text-xl font-bold tracking-tight md:text-2xl">AI スマート教育アシスタントの構築を始めましょう</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
            登録で 1000 クレジット進呈、スマート教育シナリオテンプレートからワンクリック fork、30 分でパーソナライズ学習を体験。
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
            <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> 教育相談 8801</span>
            <span className="flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> 教研 8805</span>
            <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> 校内導入 8806</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> 地区ソリューション 8809</span>
          </div>
        </section>
      </main>
    </>
  )
}
