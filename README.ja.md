# IHUI-AI - 8端オープンソースAIオペレーティングシステム

<p align="center">
  <img src="apps/web/public/images/logo.png" width="140" alt="IHUI-AI Logo" />
</p>

<p align="center">
  <strong>誰もが自分のAIプログラムを所有できる世界へ</strong><br/>
  <sub>オープンソースAI商用級統合基盤 · 5分でフォークから本番へ · 1リポジトリで6つのSaaSカテゴリを置換</sub>
</p>

<p align="center">
  <strong>ライブデモ</strong> · <a href="https://ihui.ai">https://ihui.ai</a> &nbsp;|&nbsp; <strong>GitHub</strong> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star ⭐ で応援</a><br/>
  <sub>8端同一ソースコードベース · 176個のLLMモデル · LangGraph + MCP + A2Aのトリプルスタック · Apache 2.0 — 商用利用可能</sub>
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <a href="README.ko.md">한국어</a> | <strong>日本語</strong>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/build.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/build.yml/badge.svg" alt="Build" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/e2e.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/e2e.yml/badge.svg" alt="E2E" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/knip.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/knip.yml/badge.svg" alt="Knip" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License: Apache-2.0" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI"><img src="https://img.shields.io/github/stars/IHUI-INF-AI/IHUI-AI?style=social" alt="Stars" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues"><img src="https://img.shields.io/github/issues/IHUI-INF-AI/IHUI-AI.svg" alt="Issues" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI"><img src="https://img.shields.io/github/last-commit/IHUI-INF-AI/IHUI-AI.svg" alt="Last Commit" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/graphs/contributors"><img src="https://img.shields.io/github/contributors/IHUI-INF-AI/IHUI-AI.svg" alt="Contributors" /></a>
</p>

<p align="center">
  <strong>8端カバレッジ</strong> · <strong>176個のLLM</strong> · <strong>LangGraph + MCP + A2A トリプルスタック</strong> · <strong>14プラットフォーム自動公開</strong> · <strong>フルスタックAI教育</strong> · <strong>完全な商用ループ</strong> · <strong>5言語i18n</strong>
</p>

<p align="center">
  <strong>340テーブル · 144マイグレーション · 1300以上のAPIエンドポイント · 21のGrafanaダッシュボード · 33以上のガードレール · 5346のAPIテスト · 63のe2eスペック</strong><br/>
  <sub>スライドでも、約束でも、プレースホルダーでもありません — すべての数値はコードベースでgrep可能です</sub>
</p>

<p align="center">
  <strong>中国ミラー</strong> ·
  <a href="https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI">Gitee</a> ·
  <a href="https://gitcode.com/IHUI-AI/IHUI-AI">GitCode</a>
  <br/>
  <sub>中国国内ユーザー向けの高速クローン・ダウンロード、GitHubと自動同期</sub>
</p>

---

## 目次

- [なぜIHUI AIなのか](#なぜihui-aiなのか)
- [機能概要(15モジュール)](#機能概要15モジュール)
- [Dify / Coze / FastGPT / ChatGPT / Claude / Notion AIとの比較](#dify--coze--fastgpt--chatgpt--claude--notion-aiとの比較)
- [クイックスタート](#クイックスタート)
- [技術スタック](#技術スタック)
- [8端アーキテクチャ](#8端アーキテクチャ)
- [マネタイズと料金](#マネタイズと料金)
- [ロードマップ](#ロードマップ)
- [ライセンス](#ライセンス)
- [FAQ](#faq)
- [コントリビュート](#コントリビュート)
- [お問い合わせ](#お問い合わせ)

---

## なぜIHUI AIなのか

> **一文ポジショニング**: IHUI-AIは**オープンソースAI商用級統合基盤**です — 単一のAIツールではなく、完全な商用AI製品を構築するために必要なインフラ全体(8端フレームワーク + 176モデルゲートウェイ + LangGraph/MCP/A2Aトリプルスタック + 商用ループ + エンタープライズセキュリティ + エンジニアリングガードレール + オブザーバビリティ)をApache 2.0で提供し、個人、企業、学校、クリエイター誰もがフォークして5分で自分のAI製品をリリースできます。

今日、商用AI製品を構築するには、認証、課金、モデルルーティング、RAG、ワークフロー、マルチ端末公開、オブザーバビリティなど6〜10のSaaSカテゴリを縫合する必要があります。ビジネスロジックを1行書く前に3〜6ヶ月の統合作業が必要です。**IHUI-AIはそれを5分に圧縮します。**

### オープンソースAIではめったに揃わない5つの差別化要素

| # | 能力 | 他社の対応 | IHUI-AIの対応 |
|---|------------|----------------|-------------------|
| 1 | **8端同一ソースコードベース** | Dify/FastGPTは2端(Web + API)を提供。Cursor/Claude Codeは1端(CLI)を提供。 | 8つの独立コードベース: Web、API、AI Service、CLI、Desktop(Tauri)、ブラウザ拡張(WXT)、モバイル(RN)、ミニアプリ(Taro) — 12パッケージを共有し型安全なクロス端末契約を実現。 |
| 2 | **176個のLLMモデル、単一ゲートウェイ** | ChatGPTはOpenAIのみ。CozeはByteDanceのみ。 | LiteLLMゲートウェイがOpenAI、Anthropic Claude、Google Gemini、Qwen、DeepSeek、GLM、Ernie、Doubao、Kimi、Ollamaなど20以上のプロバイダー176モデルを統一 — スマートルーティングと60%のキャッシュヒット率。 |
| 3 | **LangGraph + MCP + A2A トリプルスタック** | LangflowはLangChain DAGのみ。Difyは独自ワークフローエンジン。 | 3つのプロトコルが連携: LangGraphはステートフルエージェントワークフロー、MCP(Model Context Protocol)はツール呼び出し標準化、A2A(Agent-to-Agent)はエージェント間連携。 |
| 4 | **Apache 2.0、商用利用可能** | 多くの「オープンソース」AIツールはAGPLやBSLを使用(ソース公開だがオープンソースではない)。 | 真のApache 2.0 — コピーレフトなし、バイラル条項なし、商用制限なし。フォークして、ブランド化して、販売して、出荷してください。データもサーバーもあなたのもの。 |
| 5 | **完全な商用ループを構築済み** | Stripeだけでも月$84、Auth0は月$35、Mailgunは月$35。 | VIP / サブスクリプション / ウォレット / クレジット / 返金 / 請求書 / 8つの決済ゲートウェイ / コミッション / 紹介 — 金融グレードの商用ループを同梱。 |

### ターゲットユーザー

| ロール | ユースケース |
|------|----------|
| **個人開発者** | プライベートAIアシスタント + ナレッジベース — ChatGPT Team + Claude Code + Notion AIのサブスクリプションを置換 |
| **中小企業** | RBAC、部門別隔離、課金、BIダッシュボード付きAI中核プラットフォーム |
| **AIサービスプロバイダー** | マルチモデルプロキシ + 課金 + サブスクリプション + エージェントマーケット — 1年ではなく1週間で商用製品をリリース |
| **学校・大学** | 完全なAI教育スタック: コース、問題バンク、試験、ライブ配信(SRS)、証明書 |
| **コンテンツクリエイター** | 14プラットフォームへワンクリック公開(WeChat Official Account、Zhihu、CSDN、Xiaohongshu、Bilibili、YouTube、Douyinなど) |
| **エンタープライズ意思決定者** | RBAC、RLS、SSO、AES-256-GCM、GDPR、2FA搭載のセルフホストエンタープライズAIプラットフォーム |

### コスト現実確認

同じ機能スタックは9つのSaaSサブスクリプション(Stripe + Auth0 + Mailgun + Mixpanel + ChatGPT Team + Claude Code + Dify + Coursera for Business + 蚁客)で**月約$1,013**かかります。IHUI-AIセルフホスト: **月$0** + 自前サーバー(月約$30のVPS)。3年間の節約: **$35,000以上**、100%のデータ主権付き。

---

## 機能概要(15モジュール)

ユーザーロール別グループ。以下の各モジュールはコード、テスト、少なくとも1つの稼働エンドポイント付きで提供 — ロードマップの約束ではありません。

### A. AI機能レイヤー(エンドユーザー向け)

#### A1. 176モデル統一ゲートウェイ

単一のLiteLLMゲートウェイ、176モデル、60%のキャッシュヒット率付きスマートルーティング、SSE + WebSocket経由ストリーミング。

| カテゴリ | モデル |
|----------|--------|
| **国際** | OpenAI GPT · Anthropic Claude · Google Gemini · xAI Grok · Groq · OpenRouter · Mistral · StepFun |
| **中国系** | Zhipu GLM · Qwen · Doubao · DeepSeek · Kimi (Moonshot) · Baichuan · Yi · MiniMax |
| **クラウドプロバイダー** | Alibaba Cloud · Tencent Cloud · Huawei Cloud · Volcengine · Baidu AI Cloud · AWS Bedrock · Azure OpenAI |
| **ローカル** | Ollama · vLLM · LM Studio (OpenAI互換エンドポイント) |
| **モダリティ** | テキスト · 画像 · 音声(STT + TTS) · 動画 · 埋め込み · 3Dデジタルヒューマン(Tencent Hunyuan) |

#### A2. LangGraph + MCP + A2A トリプルスタック

プラットフォームの心臓部 — 3つのオーケストレーションプロトコルが一体で動作:

| スタック | 能力 | 実装 |
|-------|------------|----------------|
| **LangGraph** | ステートフルエージェントワークフロー(計画 → 実行 → 要約)、APIキー不要開発向けスタブモード | `services/langgraph_service.py` · `agent_graph.py` · `agent_loop.py` · `agent_orchestrator.py` |
| **MCP** (Model Context Protocol) | 22個の組み込みツール(ブラウザ制御、コンピュータ制御、ファイル操作、コード検索、Web検索、git、DBクエリ)+ プロジェクトレベルMCP + mcp-extended | `routers/mcp.py` · `services/mcp_server.py` |
| **A2A** (Agent-to-Agent) | エージェント間連携プロトコル、Redis永続化 + インメモリフォールバック | `routers/a2a.py` · `services/a2a_service.py` |
| **ベクトルメモリ** | 埋め込み + コサイン類似度セマンティック検索、pgvector経由セッション横断長期メモリ(独立ベクトルDB不要) | `services/vector_memory.py` · `memory.py` |
| **RAGナレッジベース** | ドキュメントベクトル化 · セマンティック検索 · 引用追跡(ネイティブpgvector) | `services/rag.py` · `api/v1/rag.py` |
| **ナレッジグラフ** | ノード + リレーション、ドキュメント横断エンティティリンク — オープンソースAIでは珍しい | schema `knowledge-graph.ts` |
| **ペルソナレジストリ** | ロール定義付きカスタムエージェントペルソナ | `routers/personas.py` |
| **エージェントランタイム** | SSEストリーミング + WebSocket、計画/実行/要約 + 中断/継続/キャンセル | `routers/agent_runtime.py` |
| **オーケストレーションハブ** | 6つのクロスピラープレイブック(Rules/Hook/Spec/Context/Subagent/Terminal)、イベントバス(26イベントタイプ)、LLM予算ガバナンス(段階的劣化)、統合テレメトリ(37 Prometheusメトリクス) | `services/orchestration_hub.py` |

#### A3. マルチモーダルAI生成

| 能力 | 説明 |
|------------|-------------|
| **テキストから画像** | Stable Diffusion / DALL-E / Tongyi Wanxiang — マルチ解像度、バッチ生成、お気に入り |
| **画像編集** | インペイント、スタイル転送、背景除去、HDアップスケーリング |
| **TTSストリーミング** | 12以上の音声、多言語、WebSocketストリーミング + 中断制御 |
| **ASR** | リアルタイム文字起こし、ファイル文字起こし、多言語 |
| **ボイスクローニング** | 短い音声サンプル → カスタム音声音色 |
| **双方向リアルタイム音声** | WebRTC PCM16 16kHz、ASR + LLM + TTSクローズドループ |
| **テキストから動画** | マルチモデル合成、動画編集、トランスコーディング |
| **AIデジタルヒューマン** | Tencent Hunyuan 3D、インタラクティブデジタルアバター |
| **AIキャリアツール** | 履歴書最適化、モック面接、キャリアアドバイス |
| **AIニュースフィード** | 集約 + スマート要約 + モデルリーダーボード(OpenCompass / SuperCLUE実データ)+ API中継ディレクトリ(29事業者)+ 47事業者ワンクリックキーインポート |

### B. AIワークフロー & 開発者ツール

#### B1. 自社製CLI(Claude Codeをベンチマーク)

`apps/cli/`はACP(Agentic Coding Protocol)Server + 21コマンド + 36個の組み込みツールを提供、Zed / VSCode / Cursorに組み込み可能。

**コマンドハイライト:** `ihui`(インタラクティブREPL) · `ihui chat`(マルチターン) · `ihui agent [task]`(自律マルチステップ、`--json`ヘッドレス) · `ihui acp`(エディタ組み込み向けACPサーバー起動) · `ihui mcp list/add/remove` · `ihui import`(24ソース構成インポート: cc-switch / codex++ / Claude / Codex / Gemini / Hermes) · `ihui skills list/show` · `ihui audit query/stats`。

**36個の組み込みツール:** ask-user · clipboard · codegraph · fetch-url · file-edit · git · hub/adapter · mcp-oauth · run-tests · subagent · todo-write · web-search · その他。

**スキルシステム:** 4ディレクトリ(`.ihui` / `.agents` / `.claude` / `.cursor`)からフラットロード。

#### B2. エンタープライズワークスペース権限

3つの権限モード + 7エンドポイントランタイム傍受 + 60秒監査タイムアウト:

| モード | 挙動 |
|------|----------|
| `default` | 全FS呼び出しが人間監査ポップアップをトリガー |
| `accept-edits` | ホワイトリスト一致呼び出しはパス、その他はポップアップトリガー |
| `bypass-permissions` | 全パス(信頼環境のみ) |

AI入力ボックスにOpenAI Codex CLIスタイルの承認モード切替機(シールドアイコン + ポップオーバー + `1/2/3`キーボードショートカット + `/permission ask\|auto\|full`スラッシュコマンド + 高リスクモード1時間自動失効 + 初回使用確認ダイアログ)を含みます。

### C. コンテンツ作成 & 教育

#### C1. 14プラットフォーム自動公開

AES-256-GCM認証暗号化 + 14アダプターで14プラットフォームへワンクリック公開:

- **記事プラットフォーム(7):** WeChat Official Account · Zhihu · CSDN · Juejin · Xiaohongshu · Weibo · Bilibili
- **画像プラットフォーム(2):** 画像ギャラリー
- **動画プラットフォーム(5):** YouTube · Douyin · Kuaishou · Bilibili動画 · Xiaohongshu動画

記事 + ナレーションスクリプトデュアルパイプライン付きセルフメディアワークベンチ、公開完了時にWebSocketリアルタイム通知。

#### C2. フルスタックAI教育

オープンソースAI教育スタック(生態系で珍しい — Khan AcademyやCourseraはクローズドSaaS):

- コース · 問題バンク · 試験 · ライブ配信(SRS) · 学習レポート · 証明書
- 講師 + 学生ポータル(12サブページ)
- 45テーブルの`edu-full`スキーマ
- ライブ + チェックイン + インタラクション + 再生
- 学習行動分析 + パーソナライズド推奨

#### C3. AIニュース & モデルリーダーボード

- 27ネイティブRSSソース + ローカルDailyHotApiからのAIニュース集約(96.3%収集成功率)
- LLM分類プロダクションパイプライン(988 NULL → 0 NULL)
- 実データ付き5モデルリーダーボード(OpenCompass Playwrightレンダリング + SuperCLUE Gradio)
- API中継ディレクトリ(29事業者、レイテンシーテスト済み、色分けバッジ)
- 47事業者ワンクリックキーインポート、`?prefill=` base64リダイレクト付き
- 4言語ニュースタイトル切替(zh / en / ja / ko)

### D. エンタープライズ & 運用

#### D1. 完全な商用ループ

金融グレード課金 — オープンソースAIでは珍しい(Dify / FastGPT / Langflowにはなし):

- VIP会員(マルチティア) · 定期サブスクリプション · ウォレット · クレジット · 監査トレール付き返金 · 請求書 · 多通貨為替レート
- 8決済ゲートウェイ(WeChat Pay · Alipay · Stripe · PayPal · など)
- 配布コミッション + 紹介報酬
- 通貨偽造防止: 冪等キー + トランザクションロック + 金額再検証 + 注文ステータスJOINチェック(G2/G3/G7/G8セキュリティシリーズ)

#### D2. エンタープライズセキュリティスタック

| レイヤー | 実装 |
|-------|----------------|
| **認証** | JWT HS256 + トークンファミリーローテーション + リフレッシュブラックリスト(アクセス7d、リフレッシュローテーション) |
| **認可** | RBAC(5レベル) + データスコープ(5レベル) + ワークスペース3モード権限 |
| **マルチテナンシー** | PostgreSQL Row-Level Security (RLS)、`set_config($1, $2, true)`パラメータ化経由 |
| **SSO** | OAuth2(Google · Apple · GitHub · PKCE) |
| **暗号化** | AES-256-GCM、保存時認証情報暗号化 |
| **コンプライアンス** | GDPR · 2FA · IDOR保護 · 7エンドポイントランタイム傍受 |
| **監査** | 60秒タイムアウト、全アクションロギング |

#### D3. エージェントマーケット & 開発者センター

- マルチエージェントマーケット + 開発者センター(13サブページ)
- Coze SDKプロキシ · OpenClaw · Crew統合 · N8Nプロキシ
- APIキー + SDK、顧客統合向け
- マーケット開発者向け30%コミッションモデル

#### D4. 運用 & グロース

- ポイント · チェックイン(タイムゾーン補正UTC+8) · リーダーボード · 抽選 · 配布 · 招待 · ゲーミフィケーション(レベル / 実績 / バッジ)
- カスタマーサービス: チケット · ライブチャット · フィードバック · ヘルプセンター
- BIダッシュボード · エラーダッシュボード · グレーリリース(フィーチャーフラグ) · i18nダッシュボード

### E. エンジニアリングインフラ

#### E1. 3本柱オブザーバビリティ

SREグレードのオブザーバビリティスタック — オープンソースAIでは珍しい(他は基本ログのみ):

| 柱 | スタック | エンドポイント |
|--------|-------|-----------|
| **メトリクス** | Prometheus + Node Exporter | `:8815` |
| **ダッシュボード** | Grafana(21プレプロビジョニングダッシュボード) | `:8816` |
| **ログ** | Loki + Promtail | `:8818` |
| **トレース** | OpenTelemetry + Jaeger | `:8814` |
| **アラート** | Alertmanager | `:9093` |

#### E2. エンジニアリングガードレール(33以上のフック)

協調事故防止のメカニズムレベルガードレール — オープンソースプロジェクトで珍しい:

- **30以上のpre-commitフック** + 1 commit-msgフック: i18nパリティ(4つブロッキング) · スキーマドリフト検出 · APIキー漏洩検出 · rounded-full CSSガード · アイコンテキスト垂直整列 · 翻訳品質(opencc / 文字範囲 / 破壊機翻検出) · コミット損失防止(reflog reset検出 + ダングリングコミット検出 + lost-commitタグバックアップ)
- **11マイグレーション監査** · post-commit自動プッシュ · pre-push typecheck
- **9 PowerShell開発スクリプト** for Windows one-click startup

#### E3. 5言語i18n with パリティ

`zh-CN` / `zh-TW` / `en` / `ko` / `ja` — 99.7%キーセットパリティ、8スクリプト(4 web + 4 extension)でガード:
- opencc字形検出(zh-TWブロッキング)
- 文字範囲検出(koブロッキング)
- 破壊機翻検出(enブロッキング)
- キーパリティ検証(ブロッキング)
- AI翻訳パイプライン(i18n-diff → AIエージェント翻訳 → i18n-apply、LLM API呼び出しゼロ、70%以上コスト削減)

#### E4. データベース & テスト

- **PostgreSQL 15**: 340テーブル · 144マイグレーション · 100以上のスキーマファイル · pgvector · FTS5フルテキスト検索 · RLSマルチテナント隔離
- **APIテスト**: 5346ケース(Vitest)
- **E2E**: 63スペック(Playwright)
- **AIサービス**: pytest + Locust負荷テスト + Lighthouseパフォーマンス

---

## Dify / Coze / FastGPT / ChatGPT / Claude / Notion AIとの比較

> 機能カバレッジ比較(精度/パフォーマンスベンチマークではありません)。モバイルユーザー: IHUI-AI列と下記「要点」に注目。

| 次元 | IHUI-AI | OpenAI ChatGPT | Dify | FastGPT | Coze (扣子) | Claude Code | Notion AI |
|-----------|---------|----------------|------|---------|------------|-------------|-----------|
| **カテゴリ** | 6カテゴリ統合基盤 | 一般AIチャット | AIアプリ開発プラットフォーム | RAG + ナレッジベース | AIエージェントSaaS | AIコーディングCLI | AIライティングアシスタント |
| **ライセンス** | **Apache 2.0** | クローズドソース | Apache 2.0 | Apache 2.0 | **クローズドソース** | **クローズドソース** | **クローズドソース** |
| **セルフホスト** | **完全セルフホスト** | 非対応 | Docker | Docker | 非対応 | N/A | N/A |
| **端末カバレッジ** | **8端** | 2端(Web/App) | 2端 | 2端 | 2端 | 1端(CLI) | 1端(Web) |
| **モデルアクセス** | **176モデル + LiteLLM** | OpenAIのみ | 50以上モデル | 30以上モデル | ByteDanceのみ | Anthropic | OpenAI |
| **ワークフローエンジン** | **LangGraph + MCP + A2A** | なし | カスタムワークフロー | なし | カスタムワークフロー | なし | なし |
| **自社製CLI** | **21コマンド + 36ツール + ACP** | なし | なし | なし | なし | ネイティブCLI | なし |
| **マルチテナント + RBAC** | **完全(5レベル + RLS)** | シングルユーザー | 基本 | 基本 | SaaS内部 | なし | なし |
| **課金 & サブスクリプション** | **完全(VIP/ウォレット/クレジット/8ゲートウェイ)** | サブスクリプション($20-200) | なし | なし | SaaS内部 | なし | サブスクリプション($10-20) |
| **AI教育** | **フルスタック(コース/試験/ライブSRS/45テーブル)** | なし | なし | なし | なし | なし | なし |
| **コンテンツ公開** | **14プラットフォーム + 14アダプター** | なし | なし | なし | なし | なし | なし |
| **オブザーバビリティ** | **3本柱 + 21ダッシュボード** | - | 基本 | 基本 | - | なし | - |
| **エンジニアリングガードレール** | **33以上フック + 11監査 + 自動プッシュ** | - | 基本 | 基本 | - | なし | - |
| **i18n** | **5言語パリティ + 8ガードレール** | 多言語 | zh/en | zh/en | 多言語 | 英語のみ | 多言語 |
| **データベース** | **340テーブル + 144マイグレーション + RLS + pgvector** | SaaS内部 | 基本 | 基本 | SaaS内部 | なし | SaaS内部 |
| **月額(5ユーザー)** | **$0**(セルフホスト、サーバーのみ) | $125+ | $59+ | $0(自己統合) | SaaS内部 | $100 | $50+ |

### 要点

**IHUI-AIは単一プロジェクトを置換することが目的ではありません — 完全なAI製品を構築するために必要な6カテゴリのインフラをオープンソース化します。**

- vs. **ChatGPT**: IHUI-AIは完全セルフホスト、100%データ主権、課金/教育/公開付き。ChatGPTはクローズドSaaS。
- vs. **Dify / FastGPT**: IHUI-AIは6つの端末、自社製CLI、完全な商用ループ、AI教育、14プラットフォーム公開、エンタープライズセキュリティ、SREオブザーバビリティを追加。
- vs. **Coze (扣子)**: IHUI-AIは完全セルフホスト、100%データ主権、Apache 2.0。CozeはクローズドSaaS — データはByteDanceへ。
- vs. **Claude Code**: IHUI-AIのCLIはコーディング*および*完全なAIアプリケーションプラットフォーム(チャット / RAG / エージェント / 課金)を統合、すべてApache 2.0。
- vs. **Notion AI**: IHUI-AIはノートアプリに組み込まれたライティングアシスタントではなく、AIアプリケーション基盤全体。Notion AIはクローズド機能。

**一行サマリー**: IHUI-AIはChatGPT(チャット) + Dify(オーケストレーション) + Claude Code(CLI) + Khan Academy(教育) + Stripe(課金) + 蚁客(公開)のオープンソース統合スタックです。

> **核心的洞察**: グローバルオープンソースAI生態系では、IHUI-AIより**より専門的**なプロジェクトは見つかります(RAGFlowはRAGにより深く、Claude CodeはCLIにより成熟、LangChainはフレームワークとしてより柔軟)。しかしIHUI-AIより**より完全な**オープンソース基盤は見つかりません — 1つのApache 2.0リポジトリで6つの機能カテゴリを統合することがコアの差別化要素です。

---

## クイックスタート

### 前提条件

| ツール | バージョン | 備考 |
|------|---------|-------|
| Node.js | `>=20.10.0` | LTS 20.x推奨、`nvm use` |
| pnpm | `>=9.0.0` | `pnpm@9.15.0`に固定、`corepack enable`で自動有効化 |
| Python | `3.12+` | `apps/ai-service`のみ |
| PostgreSQL | `15+` | Composeは`postgres:15-alpine`使用 |
| Redis | `7+` | Composeは`redis:7-alpine`使用 |
| Docker | `24+` + Compose v2 | オプションだがワンクリック起動に推奨 |
| Git | `2.40+` | `core.autocrlf=false`(プロジェクトはLF強制) |

### オプション1: Docker Compose ワンクリック(推奨)

```bash
# 1. クローン
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git IHUI-AI && cd IHUI-AI

# 2. 環境構成
cp .env.example .env
# .envを編集: JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEYを設定

# 3. ワンクリック起動(7ビジネス + 7監視 = 14サービス)
docker compose up -d
```

**サービスエンドポイント:**

| サービス | URL | 備考 |
|---------|-----|-------|
| Web | http://localhost:3000 | Next.jsフロントエンド |
| API | http://localhost:8802/api/health | Fastifyバックエンドヘルスチェック |
| Worker | http://localhost:8830 | BullMQ非同期タスクプロセス |
| AI Service | http://localhost:8803/health | FastAPI AIサービスヘルスチェック |
| Grafana | http://localhost:8816 | デフォルトadmin / パスワード変更(21ダッシュボード自動プロビジョニング) |
| Prometheus | http://localhost:9091 | メトリクス収集 |
| Jaeger UI | http://localhost:8814 | 分散トレース |
| Loki | http://localhost:8818 | ログ集約 |
| Alertmanager | http://localhost:9093 | アラートルーティング |

### オプション2: ローカル開発モード

```bash
# 1. 依存関係インストール
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install

# 2. データベース + Redis起動
docker compose up -d db redis

# 3. マイグレーション + 検証 + シード
pnpm --filter @ihui/database db:migrate
pnpm --filter @ihui/database db:check
pnpm --filter @ihui/database seed          # 7ステップ冪等シード

# 4. 全アプリ起動(turbo並列)
pnpm dev
# 個別起動:
# pnpm --filter @ihui/api run dev          # バックエンド :3002
# pnpm --filter @ihui/web run dev          # フロントエンド :3001
# cd apps/ai-service && uv sync && uvicorn app.main:app --reload --port 3003

# 5. フル検証(typecheck + lint + test)
pnpm turbo build typecheck lint test
```

### Windows ワンクリック(9 PowerShellスクリプト)

```powershell
.\scripts\dev-up.ps1                    # web + api + ai-service + DB + Redis起動
.\scripts\dev-all.ps1                   # 開発サーバーのみ(DB稼働中)
.\scripts\dev-web.mjs                   # Webのみ
.\scripts\kill-dev-servers.ps1          # 全開発サーバー停止
.\scripts\restart-dev-server.ps1        # 開発サーバー再起動
.\scripts\test-admin-e2e.ps1            # 管理者E2Eテスト
.\scripts\setup-token-refresh-task.ps1  # トークンリフレッシュスケジュールタスク構成
.\scripts\cleanup-external-junk.ps1     # 外部ジャンクファイルクリーンアップ
.\scripts\cleanup-memory-topics.ps1     # メモリトピッククリーンアップ
```

### 5つの典型的シナリオ

1. **個人開発者 — プライベートAIアシスタント**: クローン → `docker compose up -d` → 5分後に176モデルチャットUI、プライベートRAGナレッジベース、クロス端末同期(Web + Desktop + Mobile + Miniapp)、自社製コーディングCLIを利用可能。ChatGPT Team + Claude Code + Notion AIサブスクリプションを置換、月$60以上節約。

2. **中小企業 — AI中核プラットフォーム**: 200従業員アカウントにRBAC、部門別ワークスペース隔離、スマートルーティング付き7 LLMプロバイダー(最安モデルが勝利)、請求書付き部門課金、使用量BIダッシュボード、コンプライアンス監査ログ。

3. **AIサービスプロバイダー — 商用製品**: マルチモデルプロキシ + 課金 + サブスクリプション + VIP + ウォレット + クレジットを再利用。エージェントマーケットを立ち上げ、30%コミッション取得。顧客統合向けAPIキー + SDK発行。コンテンツマーケティングに14プラットフォーム公開を使用。1年ではなく1週間で出荷。

4. **学校 — 教学変革**: コース + 問題バンクをAI教育スタックにインポート。学生はライブ(SRS)再生で復習。教師はAIで採点 + 学習レポート。ライブ + チェックイン + インタラクション + 再生。行動分析 + パーソナライズド推奨。自動発行証明書。

5. **コンテンツクリエイター — 生産性解放**: セルフメディアワークベンチでWeChat Official Account記事 + ナレーションスクリプト作成。14プラットフォームへワンクリック公開。認証情報はAES-256-GCM暗号化 — プラットフォーム漏洩なし。公開完了時にWebSocketリアルタイム通知。

---

## 技術スタック

| レイヤー | 技術 | バージョン |
|-------|------------|---------|
| **モノレポ** | pnpm workspace + Turborepo | pnpm 9.15 / turbo 2.3 |
| **バックエンドAPI** | Fastify + @fastify/jwt + @fastify/websocket + Drizzle ORM + PostgreSQL | Fastify 5.1 / Drizzle 0.38 / PG 15 |
| **キャッシュ & キュー** | Redis 7 + BullMQ | 独立ワーカープロセス(`:8081`) |
| **フロントエンドWeb** | Next.js + React + Tailwind CSS + shadcn/ui | Next 15.1 / React 19 / Tailwind 4 |
| **フロントエンド状態** | @tanstack/react-query 5 + Zustand | サーバー + クライアント状態分離 |
| **i18n** | next-intl | zh-CN / zh-TW / en / ko / ja (5言語) |
| **AI Service** | FastAPI + LangGraph + LiteLLM + MCP + A2A + Socket.IO | FastAPI 0.115 / LangGraph 0.2 |
| **AIプロトコル** | SSE(エージェントストリーミング) + WebSocket(チャットルーム / マルチモデルストリーミング) + REST | 3プロトコルレイヤリング |
| **デスクトップ** | Tauri 2 + Rust(WebViewはWeb `output: 'export'`スタティックエクスポートをロード) | シェルアーキテクチャ、ネイティブクロスプラットフォーム |
| **ブラウザ拡張** | WXT + React | Chrome / Edge / Firefox |
| **モバイル** | React Native + Expo EAS | iOS / Android |
| **ミニアプリ** | Taro 4 + React | WeChat Mini Program |
| **CLI** | Node.js + Commander + Inquirer | Claude Codeをベンチマーク |
| **認証** | @ihui/auth共有パッケージ(JWT HS256 + トークンファミリー + OAuth2 + RBAC + データスコープ5レベル) | クロス端末統一発行 |
| **バリデーション** | Zod 3.24(バックエンド) + React Hook Form(フロントエンド) | エンドツーエンド型安全性 |
| **ログ** | Pino 9.5(バックエンド) + Python logging(AIサービス) + Loki + Promtail | 構造化 + 集約 |
| **トレース** | OpenTelemetry + Jaeger | 分散フルリンク |
| **監視** | Prometheus + Grafana(21ダッシュボード) + Node Exporter + Alertmanager | ホスト + アプリ + アラート |
| **テスト** | Vitest(バックエンド) + Playwright(E2E) + pytest(AIサービス) + Locust(負荷) + Lighthouse(パフォーマンス) | 5346 + 400以上ケース |
| **デッドコード検出** | Knip | CIガードレール |
| **Node** | `>=20.10.0` | - |
| **Python** | `3.12+`(AIサービスのみ) | - |

---

## 8端アーキテクチャ

> ポート規約: 全dev/ホストマップポートは`88xx`範囲を使用([docs/port-management.md](docs/port-management.md)参照)、`strictPort: true`でドリフト防止、コンテナ内部ポートは変更なし。

```
                ┌──────────────────────────────────────────────────────────────┐
                │      User / Enterprise / Developer / School / Creator        │
                └────────────┬─────────────────────────────────┬───────────────┘
                             │                                 │
    ┌────────────────────────┼─────────────────────────────────┼────────────────────────┐
    │                        │                                 │                        │
┌───▼────┐  ┌──────────┐  ┌──▼───────┐  ┌──────────────▼┐  ┌──────────┐  ┌──▼────────┐
│  Web   │  │ Desktop  │  │Extension │  │  Mobile RN    │  │ Miniapp  │  │   CLI    │
│ Next 15│  │ Tauri 2  │  │  WXT     │  │  Expo EAS     │  │ Taro 4   │  │ Node.js  │
│ :8801  │  │ web/out  │  │          │  │  :8805        │  │ :8804    │  │ ACP+Skl  │
│ strict │  │ + Rust   │  │          │  │  iOS/Android  │  │ WeChat MP│  │ 21 cmds  │
└───┬────┘  └────┬─────┘  └────┬─────┘  └──────┬────────┘  └────┬─────┘  └────┬─────┘
    │            │             │                │                │             │
    └────────────┴─────────────┴────────┬───────┴────────────────┴─────────────┘
                                        │  HTTPS / WebSocket / SSE / ACP
                               ┌────────▼─────────┐
                               │   apps/api       │  Fastify 5 + Drizzle ORM
                               │   :8802 strict   │  1300+ endpoints + 12 WS + 95 routes
                               │                  │  + Developer API Key /v1/* 105 endpoints
                               └────┬───────┬─────┘
                                    │       │
         ┌──────────────────────────▼─┐   ┌─▼──────────────────────────┐
         │  PostgreSQL 15             │   │  apps/ai-service            │  FastAPI + Socket.IO
         │  ├─ 340 tables / 144 mig  │   │  :8803 strict               │  LangGraph + LiteLLM + MCP + A2A
         │  ├─ pgvector vector index  │   │                             │  + triple stack + P3 deep layer
         │  ├─ FTS5 full-text search  │   │  ├─ 31+ providers + 16 IM   │  + 14 publish adapters
         │  └─ RLS multi-tenant iso   │   │  ├─ 6 sandbox backends      │  + 22 MCP tools
         └────────────────────────────┘   │  ├─ Skill self-evolution    │
                                            │  ├─ Memory (pgvector+FTS5) │
                                            │  └─ 30+ providers + MoA    │
                                            └────┬────────────────────────┘
                                                 │
                               ┌────────────────┼────────────────┐
                               │                │                │
                         ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
                         │  Redis 7  │    │  Worker   │    │ OTel +    │  Jaeger :8814
                         │ Pub/Sub   │    │  BullMQ   │    │ Prometheus│  Grafana :8816
                         │ :8811     │    │  :8830    │    │ :8815     │  Loki :8818
                         └───────────┘    └───────────┘    └───────────┘
```

### 8端の責務

| 端末 | ディレクトリ | スタック | 責務 |
|-----|-----------|-------|----------------|
| **Web** | `apps/web/` | Next.js 15 + React 19 | メインフロントエンド、200以上ページ、5言語i18n、PWA、SEO、`output: 'export'`スタティックエクスポートをDesktop WebViewがロード(シェルアーキテクチャ) |
| **API** | `apps/api/` | Fastify 5 + Drizzle | ビジネス管理 + マルチベンダープロキシ + 認証 + WebSocket、約1300エンドポイント / 95以上ルートファイル |
| **AI Service** | `apps/ai-service/` | FastAPI + LangGraph + Socket.IO | LLMゲートウェイ + エージェント実行 + MCPツール + A2Aプロトコル + 14公開アダプター、約55エンドポイント |
| **Desktop** | `apps/desktop/` | Tauri 2 + Rust | シェルアーキテクチャ: Tauri WebViewがWebスタティックエクスポートをロード。25以上の`#[tauri::command]`ネイティブ機能(トレイ + シングルインスタンス + 自動起動 + グローバルホットキー + ディープリンク + ネイティブ通知 + ファイルアクセス + クリップボード + コンピュータ制御スクリーンショット/マウス/キーボード) |
| **CLI** | `apps/cli/` | Node.js + Commander | 自社製CLIコーディングアシスタント、21コマンド + 36ツール + ACP Server + 24ソース構成インポート |
| **拡張** | `apps/extension/` | WXT + React | ブラウザ拡張: コンテキストメニュー + サイドバー + Chrome/Edge/Firefox |
| **モバイル** | `apps/mobile-rn/` | React Native + Expo EAS | iOS / Androidネイティブアプリ + SSO |
| **ミニアプリ** | `apps/miniapp-taro/` | Taro 4 + React | WeChat Mini Program、ネイティブWeChat Pay統合 + 3言語i18n |

### 共有パッケージ(12)

| パッケージ | 目的 |
|---------|---------|
| `@ihui/auth` | クロス端末JWT + OAuth2 + RBAC統一発行 |
| `@ihui/database` | Drizzle ORMスキーマ + 340テーブル + 144マイグレーション |
| `@ihui/types` | クロス端末TypeScript契約(WorkPanelTab / ToolCallEvent / P3タイプ / SharedUser) |
| `@ihui/ui-react` | Web + 拡張共有UI(Card / Button / Resizable / WorkPanel) |
| `@ihui/ui-native` | React Native共有UIプリミティブ |
| `@ihui/design-tokens` | クロス端末デザイントークン(色 / 半径 / フォント / アニメーション / 10ブレークポイント)— 単一ソースオブトゥルース |
| `@ihui/app` | Solito + StyleSheet経由RN ↔ Webクロス端末共有画面(About / Profile / Settings) |
| `@ihui/config` | 共有ESLint / TSConfig / Tailwindプリセット |
| `@ihui/i18n` | クロス端末i18nユーティリティ |
| `@ihui/api-client` | onToolCallコールバック付き型安全APIクライアント |
| `@ihui/eslint-config` | 共有ESLintルール |
| `@ihui/tsconfig` | 共有TSConfig |

### プロジェクトステータスマトリクス

各端末は実コード、テスト、稼働中devサーバー付きで提供 — プレースホルダーではありません。

| 端末 | 成熟度 | ページ / エンドポイント | 主要機能稼働中 |
|-----|----------|-------------------|-------------------|
| **Web** (`apps/web`) | 🟢 本番 | 200以上ページ · 5言語i18n · PWA · SEO | フル管理コンソール · AIチャット · RAG · エージェントマーケット · 課金 · 教育 · 公開 · BIダッシュボード |
| **API** (`apps/api`) | 🟢 本番 | 1300以上エンドポイント · 95ルートファイル · 12 WS | 認証 · RBAC · 課金 · 8決済ゲートウェイ · マルチテナントRLS · 開発者APIキー |
| **AI Service** (`apps/ai-service`) | 🟢 本番 | 約55エンドポイント · 12ルーター | LangGraph · MCP(22ツール) · A2A · 31以上プロバイダー · 6サンドバックエンド · 14公開アダプター · 16 IMチャネル |
| **CLI** (`apps/cli`) | 🟢 本番 | 21コマンド · 36ツール · ACP Server | インタラクティブREPL · エージェントモード · MCP管理 · 24ソース構成インポート · スキル · 監査 |
| **Desktop** (`apps/desktop`) | 🟢 本番 | Tauri 2 + Rustシェル · 25以上ネイティブコマンド | トレイ · シングルインスタンス · 自動起動 · グローバルホットキー · ディープリンク · ネイティブ通知 · コンピュータ制御 |
| **拡張** (`apps/extension`) | 🟢 本番 | Chrome/Edge/Firefox · サイドバー + コンテキストメニュー | 5言語i18n · エージェントアクションブリッジ · コンテンツスクリプト実行者 · スクリーンショット回傳 |
| **モバイル** (`apps/mobile-rn`) | 🟡 ベータ | iOS/Android · 3共有画面 | SSO · AboutScreen · ProfileScreen · SettingsScreen(`@ihui/app`経由クロス端末共有) |
| **ミニアプリ** (`apps/miniapp-taro`) | 🟡 ベータ | WeChat Mini Program · 3言語i18n | WeChat Payネイティブ統合 · 認証 · コア閲覧 |

凡例: 🟢 本番(商用プラットフォームで稼働中) · 🟡 ベータ(コアフロー稼働、機能パリティ進行中)

### クロス端末共有レイヤー

8端間のドリフトを防ぐため、3つの単一ソースオブトゥルースレイヤーを強制:

- **デザイントークン**: `packages/design-tokens/src/styles/tokens.css` — 単一`@theme`ブロック(色 / 半径 / フォント / アニメーション / 10ブレークポイント)をWebと拡張の両方が`@import`で消費。1箇所変更で両端更新。
- **i18n**: Webは`next-intl`使用(587名前空間 / 28,800行JSON)、拡張は自社製Contextランタイム使用(5言語 × 17名前空間)。両方とも8パリティスクリプト(4 web + 4 extension)でガード、opencc / 文字範囲 / 破壊機翻検出付き。
- **RN ↔ Web共有画面**: `packages/app/`が`AboutScreen` / `ProfileScreen` / `SettingsScreen`をSolito + StyleSheet + RNプリミティブ経由でプラットフォーム非依存コンポーネントとして提供、5デザイントークン(brand / surface / text / border / error)付き。

---

## マネタイズと料金

IHUI-AIは**Apache 2.0オープンソース** — セルフホストは永遠に無料です。マネージド/ホステッド提供を希望するチーム向けに、4ティアを提供:

| ティア | 価格 | ターゲット | ハイライト |
|------|-------|--------|------------|
| **Free** | $0(セルフホスト) | 個人開発者、学生、趣味家 | 完全な8端コードベース、176モデル、全15モジュール — 機能ゲーティングなし |
| **Pro** | ¥49/月(約$7/月) | パワーユーザー、フリーランサー | ホステッドweb + API + AIサービス · 5GBベクトルストレージ · 月100Kトークン · 優先コミュニティサポート |
| **Team** | ¥199/ユーザー/月(約$28/ユーザー/月) | 中小企業、小規模チーム(5-50ユーザー) | Proの全機能 · マルチテナントRBAC · 部門別課金 · 100GBベクトルストレージ · 月5Mトークン · SLA 99.5% · email + WeChatサポート |
| **Enterprise** | ¥2999/月+(約$420/月+) | エンタープライズ、学校、AIサービスプロバイダー | Teamの全機能 · 無制限ユーザー · オンプレミス配置 · カスタムモデルファインチューニング · 専用Grafana · SLA 99.9% · 24/7サポート · 専任アカウントマネージャー · カスタム統合 |

### 収益モデル

- **セルフホストオープンソース**: 永遠に100%無料 — Apache 2.0、ベンダーロックインなし
- **マネージドクラウド**: Pro/Team/Enterpriseサブスクリプション(上記)
- **マーケットコミッション**: エージェントマーケット開発者売上の30%
- **エンタープライズサービス**: カスタム配置、ファインチューニング、統合コンサルティング
- **教育パートナーシップ**: 学校・研修機関向けAI教育スタックライセンス

> **注**: セルフホストは常に無料です。有料ティアはインフラを運用してほしいチーム向けであり、機能アクセス向けではありません。オープンソースコードベースとマネージド提供は同一コードで稼働します。

---

## ロードマップ

### 出荷済み(2026-07-20時点)

- 8端フルカバレッジ(Web / API / AI Service / CLI / Desktop / Extension / Mobile RN / Miniapp Taro)
- 統一LiteLLMゲートウェイ経由176 LLMモデル + 31以上プロバイダーアダプター
- LangGraph + MCP + A2A トリプルスタック + Persona + エージェントランタイム + ベクトルメモリ
- 自社製CLI: 21コマンド + 36ツール + ACP Server + 24ソース構成インポート
- ワークスペース権限3モード + 7エンドポイントランタイム傍受 + 60秒監査タイムアウト
- セルフメディアワークベンチ(記事 + ナレーションスクリプトデュアルパイプライン)+ スキルシステム
- 14プラットフォームワンクリック自動公開 + 14アダプター + AES-256-GCM認証暗号化
- フルスタックAI教育(コース / 問題バンク / 試験 / ライブ配信SRS / レポート / 証明書 / 45テーブルスキーマ)
- マルチエージェントマーケット + 開発者センター(13サブページ)+ Coze SDKプロキシ + OpenClaw + Crew + N8N
- コミュニティ機能(サークル / プラザ / DM / フォロー / シェア)
- グロースループ(ポイント / チェックイン / リーダーボード / 抽選 / 配布 / 紹介 / ゲーミフィケーション)
- 完全な商用課金ループ(VIP / サブスクリプション / ウォレット / クレジット / 返金 / 請求書 / 為替レート / 8決済ゲートウェイ)
- カスタマーサポート(チケット / ライブチャット / フィードバック / ヘルプセンター)
- BIダッシュボード + エラーダッシュボード + グレーリリース + i18nダッシュボード
- 5言語i18nパリティ + 19ツールi18nツールチェーン + 4ガードレール
- 完全オブザーバビリティスタック(Prometheus + Grafana 21ダッシュボード + Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager)
- 30以上のpre-commitガードレール + post-commit自動プッシュ + 11マイグレーション監査 + 9 PowerShell起動スクリプト
- エンタープライズセキュリティ(RBAC + マルチテナント + RLS + SSO + AES-256-GCM + JWTトークンファミリー + CSRF + XSS + GDPR + 2FA)
- 340データベーステーブル + 144マイグレーション + 12共有パッケージ + pgvector + ナレッジグラフ + Knip + Lighthouse + Locust

### 最近のハイライト(2026-07-22)

1. **チャット内組み込みブラウザワークパネル**(8端同期、P0→P3++ 4フェーズ): リサイズ可能パネル + マルチタブ + お気に入り + 履歴 + ドラッグソート + iframeスマートフォールバック + Playwrightスクリーンショットエンジン + イテレーションバッジ付きマルチラウンドツールループ
2. **ネイティブブラウザ制御 + コンピュータ制御MCPツール**(5端同期): 22新MCPツール(12 `browser_control.*` + 10 `computer_control.*`)+ クロス端末実行者(拡張コンテンツスクリプト + デスクトップTauriコマンド)+ ハルシネーションガード付きマルチラウンドツールループ
3. **P3深層レイヤー(Hermes Agentを11次元で超越)**: エージェントループ修正 + スキル自己進化クローズドループ + 統合3端メモリ + IMプラットフォームゲートウェイ(16プラットフォーム)+ マルチエージェントディベート + MCPサンプリング逆呼び + 6サンドバックエンド(Local/Docker/SSH/Modal/Daytona/Singularity)+ MoAプリセット + マルチモーダル入力 + メモリ深層レイヤー(pgvector + FTS5 + 減衰 + ベクトル永続化)+ 自己進化深層レイヤー(自動テスト + フィードバック追跡 + 品質ゲート)+ スケジューリング深層レイヤー(DAG + 4戦略 + ウォッチドッグ + ワークツリー隔離 + ResourceMonitor + NetworkEgressPolicy)
4. **深い堅牢性強化**(5ラウンド85項目): 認証セキュリティコア(7)+ MCPセキュリティ(6)+ APIバックエンドセキュリティ(8)+ Webフロントエンドセキュリティ(3)+ デスクトップ/拡張/モバイル/ミニアプリ強化(6)
5. **CLI Wave 1 + Wave 2**: LSP統合 + Client/Serverアーキテクチャ + TUIターミナルUI + 4層メモリ + ドリームモード + Plan-Build-Review三モード + アンドゥ-リドゥ-シェア + Subagentピア協調
6. **課金資金セキュリティ**(G2→G8シリーズ): 通貨偽造防止 + 冪等性 + トランザクションロック + CrewAIバイパス修正 + rechargeToken注文ステータス検証
7. **AIニュースフィード精製**: 27ネイティブRSSソース + 96.3%収集成功率 + LLM分類(988 NULL → 0 NULL)

### 次の予定

- **モバイルRN機能パリティ** with Web(現在管理コンソール + エージェントマーケットで遅れ)
- **デスクトップオフラインモード** with ローカルLLM(Ollama)フォールバック
- **拡張サイドバーエージェント** with 完全MCPツール表面
- **ミニアプリTaro WeChat Pay** 本番堅牢化
- **追加IMチャネル**: Slack、Discord、Telegramボット(現在16チャネル、25以上を目標)
- **追加サンドバックエンド**: E2B、Fly Machines(現在6、8を目標)
- **ファインチューニングUI**: WebコンソールでLoRA/QLoRAファインチューニングパイプライン
- **A2Aプロトコルv2**: 標準化エージェント発見 + 能力ネゴシエーション
- **多リージョン配置**: エンタープライズティア向けアクティブ-アクティブクラスタモード

> 完全なタスク計画と進捗追跡は[PROJECT_PLAN.md](PROJECT_PLAN.md)(中国語)にあります。

---

## ライセンス

[Apache License 2.0](LICENSE) — 自由に使用、修正、配布、商用化可能、コピーレフト制限なし。

### これが意味すること

- ✅ **商用利用**: 販売、ブランド化、製品として出荷 — 制限なし
- ✅ **クローズドソース派生物**: 修正はクローズドソースのまま可能
- ✅ **コピーレフトなし**: バイラルライセンス条項なし、変更のオープンソース化要件なし
- ✅ **特許許諾**: 貢献者からの明示的特許許諾
- ✅ **セルフホスト**: 100%データ主権、ベンダーロックインなし

> 商用利用を制限する「ソース公開」やBSLライセンスプロジェクトとは異なり、IHUI-AIはOSI承認のApache 2.0ライセンス下の真のオープンソースです。

---

## FAQ

### 本当にオープンソースですか? 商用利用できますか?

はい。IHUI-AIは**Apache 2.0**でライセンス — Kubernetes、Android、主要オープンソースプロジェクトが使用するものと同じライセンス。フォーク、ブランド化、販売、独自の商用製品として出荷可能。修正はクローズドソースのまま可能。コピーレフト、バイラル条項、「ソース公開」制限はありません。唯一の要件: ライセンス通知を保持、ソースファイルへの重要な変更を明記。

### Dify / FastGPT / Langflowとの違いは?

Dify、FastGPT、Langflowは優れた**AIアプリケーションオーケストレーションプラットフォーム** — チャットボットやワークフロー構築を支援。IHUI-AIは**統合AI商用基盤**: これらプロジェクトが提供する全て(チャット、RAG、ワークフロー、エージェント)に加え、6つの追加端末(CLI、デスクトップ、拡張、モバイル、ミニアプリ)、完全な商用課金ループ、AI教育、14プラットフォームコンテンツ公開、エンタープライズセキュリティ、SREグレードオブザーバビリティを含む。AIチャットオーケストレーションのみが必要ならDifyがより集中。完全な商用AI製品を出荷したいならIHUI-AIがそのために設計。

### LangChain / LangGraph / LlamaIndexとの違いは?

LangChain、LangGraph、LlamaIndexは**開発者フレームワーク** — AIアプリケーション構築の部品(チェーン、エージェント、レトリバー)を提供。IHUI-AIは3つのオーケストレーションスタックの1つとしてLangGraphを使用、完全な製品にラップ: 8端、課金、認証、RBAC、UI、データベーススキーマ、マイグレーション、オブザーバビリティ、15ビジネスモジュール。フレームワークは「車の部品」、IHUI-AIは「組み立てラインから出る走る車」 — 非技術チームが直接使用可能。

### OpenAI / Anthropic APIキーに支払いが必要ですか?

はい — LLM APIキー(OpenAI、Anthropic、Google、Qwen、DeepSeekなど)は各自ご用意。IHUI-AIはLiteLLM経由で30以上プロバイダー176モデルにルーティング。プラットフォーム自体は無料、消費するLLMトークンのみモデルプロバイダーに直接支払い。ローカルのみのセットアップ向けにOllamaとvLLMをサポート — クラウドAPIコストゼロ。

### 自前サーバーでセルフホストできますか?

はい — それが主要配置モデル。`docker compose up -d`で全14サービス(7ビジネス + 7監視)を起動。データはサーバー上に留まり、AES-256-GCMで暗号化。電話_home、当方へのテレメトリ、当方インフラへの外部依存はなし。マネージドクラウドティア(Pro/Team/Enterprise)はオプション — インフラを運用してほしいチーム向け。

### 本番稼働に何人必要ですか?

小規模配置(< 100ユーザー): Docker + PostgreSQL + Redisに慣れたDevOpsエンジニア1人。中規模配置(100-1000ユーザー): DevOps 1人 + バックエンド開発者1人。プラットフォームは開発だけでなく運用されるように設計 — Grafanaダッシュボード、Alertmanagerルール、構造化ロギングが事前構成済み。

### データベース事情は?

単一PostgreSQL 15データベース(`ihui`)、30以上ビジネスドメインにまたがる340テーブル、Drizzle ORM管理144マイグレーション。パラメータ化`set_config($1, $2, true)`経由Row-Level Security (RLS)でマルチテナント隔離。ネイティブpgvector拡張経由ベクトル検索(独立ベクトルDB不要)。FTS5経由フルテキスト検索。専用スキーマ経由ナレッジグラフ。

### マネージド / ホステッド版はありますか?

はい — [マネタイズと料金](#マネタイズと料金)セクション参照。個人向けPro(¥49/月)、中小企業向けTeam(¥199/ユーザー/月)、大組織向けEnterprise(¥2999/月+)。セルフホストは完全機能セットで永遠に無料 — 有料ティアはインフラを運用してほしいチーム向け。

### コントリビュート方法は?

PR大歓迎! ガイドラインは[CONTRIBUTING.md](CONTRIBUTING.md)参照。プロジェクトは30以上のpre-commitフックでコード品質を維持 — エンジニアリングルールは[AGENTS.md](AGENTS.md)参照(中国語、英訳進行中)。コントリビュートが必要な主要分野: モバイルRN機能パリティ、追加IMチャネルアダプター、追加サンドバックエンド、英語ドキュメント改善。

### データプライバシーとGDPRは?

セルフホスト時、全データはサーバー上に留まります。認証情報(パスワード、OAuthシークレット、APIキー、決済認証情報)はAES-256-GCMで暗号化。プラットフォームはGDPRデータエクスポート・削除リクエストをサポート。監査ログは60秒タイムアウトで全機密アクションを捕捉。2FAサポート。IDOR保護は全エンドポイントに組み込み。データが当方サーバーに送信されることは一切ありません — オープンソースコードベースには電話_homeテレメトリなし。

### ドキュメントナビゲーション

| ドキュメント | 目的 |
|----------|---------|
| [README.md](README.md) | 中国語README(主要、最も最新) |
| [PROJECT_PLAN.md](PROJECT_PLAN.md) | タスク計画 & 進捗追跡(中国語) |
| [AGENTS.md](AGENTS.md) | エンジニアリングルール & エージェントガイドライン(中国語) |
| [docs/architecture.md](docs/architecture.md) | システムアーキテクチャ深掘り |
| [docs/port-management.md](docs/port-management.md) | ポートレジストリ(88xx範囲) |
| [docs/lost-commit-archive.md](docs/lost-commit-archive.md) | コミット損失防止アーカイブ |
| [LICENSE](LICENSE) | Apache 2.0全文 |

---

## コントリビュート

PR大歓迎 — コミュニティによるコミュニティのためのオープンソースプロジェクトです。

### 開発ワークフロー

```bash
# 1. フォーク & クローン
git clone https://github.com/<your-username>/IHUI-AI.git
cd IHUI-AI

# 2. 依存関係インストール
corepack enable && pnpm install

# 3. フィーチャーブランチ作成
git checkout -b feat/your-feature

# 4. 開発(30以上のpre-commitフックがガイド)
pnpm dev                                      # 全サービス起動
pnpm turbo build typecheck lint test          # コミット前に検証

# 5. コミット(Conventional Commitsに従う: feat / fix / docs / chore / test / refactor)
git add <your-files>                          # 自分のファイルのみステージ(`git add .`禁止)
git commit -m "feat(web): add your feature"

# 6. プッシュ & PRオープン
git push origin feat/your-feature
```

### コード品質バー

- **TypeScript strict** 全8端 — 正当な理由なしの`any`禁止
- **Zodバリデーション** 全APIリクエストパラメータ — 実行時安全性、コンパイル時のみでなく
- **i18nパリティ** — 新規i18nキーは全5言語(zh-CN / zh-TW / en / ko / ja)に追加必須
- **rounded-full禁止** — プロジェクトは特定半径グラデーションを強制([AGENTS.md](AGENTS.md) §4参照)
- **テスト必須** 新規APIエンドポイント(Vitest)、重要UIフロー(Playwright E2E)
- **マイグレーション必須** スキーマ変更時 — `pnpm --filter @ihui/database db:generate`

### コントリビュートが必要な分野

- 🌍 **英語ドキュメント** — 多くのドキュメントが中国語のみ、翻訳協力求む
- 📱 **モバイルRN機能パリティ** — モバイルで管理コンソール + エージェントマーケット
- 🔌 **追加IMチャネルアダプター** — Slack、Discord、Telegramボット(25以上チャネルを目標)
- 🐳 **追加サンドバックエンド** — E2B、Fly Machines(8バックエンドを目標)
- 🎨 **テーマコントリビュート** — ダークモード磨き、アクセシビリティ改善
- 📝 **チュートリアル & 例** — 一般ユースケース向けクックブックスタイルガイド

---

## お問い合わせ

<p align="center">
  <strong>IHUI-AIコミュニティに参加して、AIの未来を共に構築しましょう</strong>
</p>

<table align="center">
  <tr>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/footer-icon-2.png" width="180" alt="公式App QR" />
      <br/>
      <strong>公式App</strong>
      <br/>
      <sub>スキャンしてIHUI-AI Appを試用</sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/wechat-vx.png" width="180" alt="公式WeChat QR" />
      <br/>
      <strong>公式WeChat</strong>
      <br/>
      <sub>WeChat ID: <code>ok502319984</code></sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/community-group.jpg" width="180" alt="コミュニティグループQR" />
      <br/>
      <strong>コミュニティグループ</strong>
      <br/>
      <sub>スキャンして開発者コミュニティに参加</sub>
    </td>
  </tr>
</table>

### 会社情報

| 項目 | 詳細 |
|-------|---------|
| **会社** | Jilin Aizhihui Artificial Intelligence Technology Co., Ltd. (吉林省爱智汇人工智能科技有限公司) |
| **ブランド** | Zhihui AI Group (智汇 AI 集团) |
| **所在地** | 中国吉林省長春市ハイテクゾーン越達路107号 · AI人材孵化基地 |
| **電話** | +86 186-4338-9808 |
| **Email** | 502319984@qq.com |
| **WeChat** | ok502319984 (WeChatで検索して追加) |
| **ICP登録** | 吉ICP备2025027274号 |
| **著作権** | © 2025 Zhihui AI Group · China |

### コミュニティ & 外部プラットフォーム

| プラットフォーム | リンク |
|----------|------|
| GitHub Org | https://github.com/AIZHS2025 |
| X (Twitter) | https://x.com/ok502319984 |
| Facebook | https://www.facebook.com/share/17kQMPNhQb/ |
| Issueトラッカー | https://github.com/IHUI-INF-AI/IHUI-AI/issues |
| プルリクエスト | https://github.com/IHUI-INF-AI/IHUI-AI/pulls |

> パートナーシップ照会、エンタープライズオンボーディング、技術交流は、上記WeChat QRコードをスキャン、または502319984@qq.comへメール — 24時間以内に返信します。

### 謝辞

これらのオープンソースプロジェクトなしではIHUI-AIは存在しません:

- [Next.js](https://nextjs.org/) · [React](https://react.dev/) · [Tailwind CSS](https://tailwindcss.com/) · [shadcn/ui](https://ui.shadcn.com/)
- [Fastify](https://fastify.dev/) · [Drizzle ORM](https://orm.drizzle.team/) · [FastAPI](https://fastapi.tiangolo.com/)
- [LangGraph](https://langchain-ai.github.io/langgraph/) · [LiteLLM](https://litellm.vercel.app/) · [MCP](https://modelcontextprotocol.io/)
- [Turborepo](https://turbo.build/) · [pnpm](https://pnpm.io/) · [Vitest](https://vitest.dev/) · [Playwright](https://playwright.dev/) · [Locust](https://locust.io/)
- [Tauri](https://tauri.app/) · [Taro](https://taro-docs.jd.com/) · [WXT](https://wxt.dev/) · [Expo](https://expo.dev/)
- [Prometheus](https://prometheus.io/) · [Grafana](https://grafana.com/) · [Loki](https://grafana.com/loki) · [Jaeger](https://www.jaegertracing.io/) · [OpenTelemetry](https://opentelemetry.io/) · [Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Knip](https://knip.dev/) · [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

本プロジェクトを進化させ続ける全コントリビューターに感謝します。

---

<p align="center">
  <sub>Built by <strong>Jilin Aizhihui AI Technology Co., Ltd.</strong> · オープンソース、共に構築</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI">⭐ GitHubでStar</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/fork">🍴 フォークして自作</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues">💬 機能リクエスト</a>
</p>

---

## SEOキーワード

<sub>
AIエージェントプラットフォーム · LLMオーケストレーション · RAG · 検索拡張生成 · MCP · Model Context Protocol · A2A · Agent-to-Agent · LangGraph · LiteLLM · オープンソースChatGPT代替 · セルフホストAIプラットフォーム · Apache 2.0 AI · AI商用基盤 · マルチモデルゲートウェイ · 176 LLM · OpenAI · Anthropic Claude · Google Gemini · Qwen · DeepSeek · GLM · Ernie · Doubao · Kimi · Ollama · AI教育プラットフォーム · 14プラットフォーム公開 · Tauri · WXT · Taro · React Native · Next.js 15 · Fastify 5 · FastAPI · 8端アーキテクチャ · AIエージェントマーケット · RBACマルチテナント · pgvector · ナレッジグラフ · ベクトルメモリ · 自己進化エージェント · サンドバックエンド · Modal · Daytona · オブザーバビリティスタック · Prometheus · Grafana · Jaeger · OpenTelemetry · i18nパリティ · 5言語国際化
</sub>
