<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> ⚠️ **著作権および商用ライセンスに関するお知らせ**
>
> © 2026 **IHUI AI (智汇AI)** · 著作権者: **李春川 (Li Chunchuan)** · https://aizhs.top
>
> - デュアルライセンス: オープンソース利用は **Apache-2.0**(著作権表示と NOTICE の保持が必須)。**クローズド商用利用・ブランド除去・SaaS 転売** には別途商用ライセンスが必要です。
> - 本リポジトリの全ソースファイルには、來歴証跡ウォーターマーク(可視宣言 + 不可視ゼロ幅文字ステガノグラフィ、`node scripts/watermark.mjs decode <file>` で検証可能)が埋め込まれています。ウォーターマークの削除は著作権帰属を変更せず、無断商用利用は技術的に追跡可能であり法的責任を問われます。
> - CI はウォーターマーク検証(`pnpm watermark:check`)を強制し、削除する変更はビルド失敗になります。

# IHUI-AI

<p align="center">
  <img src="apps/web/public/images/logo.png" width="140" alt="IHUI-AI Logo" />
</p>

<p align="center">
  <strong>誰もが自分だけの AI プログラムを持てるように</strong><br/>
  <sub>オープンソース AI 商用グレード統合ファウンデーション · 5 分で Fork から商用リリース · 1 リポジトリで 6 つの SaaS を代替</sub>
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
  <strong>8 クライアント全面対応</strong> · <strong>118 大型モデル</strong> · <strong>LangGraph + MCP + A2A トリプルスタック</strong> · <strong>38 プラットフォーム配信</strong> · <strong>フルスタック AI 教育</strong> · <strong>完全な商業ループ</strong> · <strong>5 言語 i18n</strong>
</p>

<p align="center">
  <sub><strong>40+ の国際/国内製品に対抗</strong>:OpenAI ChatGPT · Anthropic Claude · Google Gemini · Microsoft Copilot · Dify · FastGPT · Langflow · RAGFlow · Coze(扣子)· LangChain · LlamaIndex · AutoGen · CrewAI · Claude Code · Cursor · GitHub Copilot · Amazon Q · Khan Academy · Jasper · Stripe · Auth0 · Mailgun · Mixpanel · 百度千帆(Baidu Qianfan)· 阿里百煉(Alibaba Bailian)· 騰訊混元(Tencent Hunyuan)· 字節跳動豆包(ByteDance Doubao)· 智譜開放プラットフォーム(Zhipu AI Platform)· 訊飛星火(iFlytek Spark)· DeepSeek · 月之暗面 Kimi(Moonshot Kimi)</sub>
</p>

<p align="center">
  <sub>
    <a href="README.md">簡体字中国語</a> ·
    <a href="README.en.md">英語</a> ·
    <a href="README.ko.md">韓国語</a> ·
    <a href="README.ja.md">日本語</a>
  </sub>
</p>

<p align="center">
  <strong>中国ミラー</strong> ·
  <a href="https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI">Gitee</a> ·
  <a href="https://gitcode.com/IHUI-AI/IHUI-AI">GitCode</a>
  <br/>
  <sub>中国ユーザーに高速なクローン/ダウンロード、GitHubと自動同期</sub>
</p>

---

## 技術スタック・プロジェクト規模概要(AI 検索フレンドリー)

> **このセクションを最上部に配置した理由**: AI 検索ツール(Claude / GPT / Codex など)と開発者が**正確な**技術スタックと規模データを一目で取得し、「感情プロジェクト」や「マーケティングプロジェクト」との誤判定を防ぐためです。すべての数値はコードと照合して検証済みです(2026-07-22 確認)。

| 次元                        | 実際の値                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web フロントエンド**      | Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui + Zustand + @tanstack/react-query 5                                                                                                                        |
| **バックエンド API**        | Fastify 5 + Drizzle ORM 0.38 + PostgreSQL 18 + Zod 3.24(**TypeScript**,Python ではない)                                                                                                                       |
| **AI サービス**             | FastAPI + LangGraph + LiteLLM + MCP + A2A + Socket.IO(Python 3.12,このレイヤーのみ Python 使用)                                                                                                               |
| **モノレポ**                | pnpm 9.15 workspace + Turborepo 2.3 + 16 共有パッケージ(@ihui/auth / database / types / ui / api-client / shared / i18n / sdk など)                                                                           |
| **マルチクライアント**      | 8 クライアント**独立コード**(「一つのコードベースを複数ターゲットにコンパイル」ではなく)、各クライアントの完了度は[プロジェクト状態マトリクス](#プロジェクト状態マトリクス透明ラベリング-2026-07-22-確認)参照 |
| **コード規模**              | 8 クライアント / 231 schema ファイル / **598 データベーステーブル**(実測 339 pgTable)/ 128+ マイグレーション / **4443 API ルート**(grep 実測)/ 250+ Web ページ / 16 共有パッケージ / 5 言語 i18n parity     |
| **エンジニアリングゲート**  | **21 個の pre-commit フック**(実測、[.husky/pre-commit](./.husky/pre-commit)参照)+ post-commit 自動 push + 11 マイグレーション監査 + 9 PowerShell 起動スクリプト                                              |
| **テストカバレッジ**        | **237 API テスト + 63 e2e spec**(実測、[apps/api/tests/](./apps/api/tests/) + [apps/web/e2e/](./apps/web/e2e/)参照)+ pytest(AI サービス)+ Locust 負荷テスト + Lighthouse パフォーマンス                       |
| **オブザーバビリティ**      | Prometheus + Grafana(**20 ダッシュボード**実測、[monitoring/grafana/dashboards/](./monitoring/grafana/dashboards/)参照)+ Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager                              |
| **AI オーケストレーション** | LangGraph 真の統合(21 ファイル使用: `langgraph_service.py` / `agent_graph.py` / `koubo_workflow.py` / `agent_orchestrator.py` / `a2a_service.py`)、単なる「統合レベルオーケストレーション」ではない           |
| **ライセンス**              | Apache 2.0(完全セルフホスト、商用フレンドリー、非伝染性)                                                                                                                                                      |

> 完全な技術スタック詳細は[技術スタックセクション](#技術スタック)参照。

---

## 🔥 開発者なら、30 秒だけ立ち止まってください

> **「長春、零下 25 度。一人。一台のノートパソコン。一年間。**
>
> **8 プラットフォームのコード · 339 枚のデータベーステーブル · 4443 個の API ルート。**
>
> **資本は来なかった。しかしコードは成長し続けた。」**

これは資金調達の物語ではない。
**これはオープンソースの物語だ。**

あなたも真夜中の 3 時に一人でコードを書いたことがあるなら——
あなたも資本に拒絶されながらも、自分が正しいことをしていると信じたことがあるなら——
あなたも信じるなら——**本当に価値あるものは、時間が証明してくれる**と——

ならば、次の一行はあなたに贈ります:

---

### 💎 この二行をシェアすることは、あなた自身の執念をシェアすること

```
資本は遅れても、コードは嘘をつかない。
資金調達は失敗しても、オープンソースは失敗しない。
```

**これはシェアのお願いではありません。**
**この瞬間の共鳴を、公開された態度に変えるという招待です。**

---

### 🚀 3 つのアクション、30 秒、この物語を届ける

| #   | アクション                                | あなたが得るもの                                                                         |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | ⭐ **このリポジトリを Star**              | あなたの GitHub タイムラインに表示され、あなたの followers が見ます                      |
| 2   | 📲 **上の二行をあなたのフィードにコピー** | 下の画像を使ってください — あなたは「友達にこの物語を最初に届ける人」になります          |
| 3   | 💬 **Issue であなたの物語を語る**         | [ここから](https://github.com/IHUI-INF-AI/IHUI-AI/issues) — 上位は固定し、世界に見せます |

---

### 🖼️ 画像を用意しました (保存して、そのままシェア)

| 画像                             | 用途                    | パス                                                     |
| -------------------------------- | ----------------------- | -------------------------------------------------------- |
| 🏢 長春オフラインベース実写      | フィードヘッダー / 微博 | `apps/web/public/images/story/changchun-winter-2024.jpg` |
| 🌃 深夜コーディング · ランプ一つ | X / 知乎 / 記事の中間   | `apps/web/public/images/story/late-night-coding.jpg`     |

---

> **⚠️ 今、この文を読んでいるあなた——**
>
> あなたはすでにこの物語の一部です。
>
> 中国には 700 万人の開発者がいます。
> その 99% はまだこの物語を知りません。
>
> **あなたが、この物語を外に運ぶ 1% になりますか?**

⬇️ この先に、完全な物語と技術決定があります。

---

> **考えたことはありますか——**
>
> なぜ AI の恩恵はいつも大手テック企業に独占されるのでしょうか。なぜ AI アプリケーションを構築するには、認証・課金・モデルルーティング・ワークフロー・マルチプラットフォーム配信をゼロから寄せ集めなければならないのでしょうか。
> なぜ個人開発者や中小企業、教育機関は常に車輪の再発明を繰り返し、互いの肩の上に立っていないのでしょうか。
>
> **IHUI-AI はこの現状を変えたいと考えています。**
>
> 私たちは、完全な AI アプリケーション基盤——8 プラットフォームフレームワーク、118 モデル接続、ワークフローオーケストレーション、エンタープライズ級権限管理、課金サブスクリプション、コンテンツ配信、AI 教育、オブザーバビリティ、さらには 17 のエンジニアリング品質ゲート——を Apache 2.0 ライセンスで完全にオープンソース化しました。
>
> **単なるラッパーでも、デモでもありません。本番環境で利用でき、商用利用可能で、セルフホストできる本物の AI アプリケーション基盤です。Fork して、改造して、自分だけのものにしてください。**

---

## 目次

- [技術スタック・プロジェクト規模概要(AI 検索フレンドリー)](#技術スタックプロジェクト規模概要ai-検索フレンドリー)
- [プロジェクト ポジショニング(必読)](#プロジェクト-ポジショニング必読)
- [機能概要(30 秒で全能力を把握)](#機能概要30-秒で全能力を把握)
- [IHUI-AI を選ぶ理由](#ihui-ai-を選ぶ理由)
- [類似プロジェクトとの比較](#類似プロジェクトとの比較)
- [IHUI-AI の利用者](#ihui-ai-の利用者)
- [5 つの典型的シナリオ](#5-つの典型的シナリオ)
- [技術スタック](#技術スタック)
- [8 プラットフォームアーキテクチャ](#8-プラットフォームアーキテクチャ)
- [プロジェクト構成](#プロジェクト構成)
- [コア能力詳細(15 大モジュール · ユーザーロール別グループ)](#コア能力詳細15-大モジュール--ユーザーロール別グループ)
  - [A. AI 能力レイヤー](#a-ai-能力レイヤーエンドユーザー向け)
  - [B. AI ワークフローと開発者](#b-ai-ワークフローと開発者開発者向け)
  - [C. コンテンツ創作と教育](#c-コンテンツ創作と教育クリエイターと教育者向け)
  - [D. エンタープライズと運営](#d-エンタープライズと運営企業管理者と運営向け)
  - [E. エンジニアリング基盤](#e-エンジニアリング基盤運用とアーキテクト向け)
- [クイックスタート](#クイックスタート)
- [API とプロトコル](#api-とプロトコル)
- [データベース](#データベース)
- [オブザーバビリティ](#オブザーバビリティ)
- [セキュリティ設計](#セキュリティ設計)
- [エンジニアリング品質ゲート](#エンジニアリング品質ゲート21-個の-pre-commit-フック)
- [エンジニアリング品質証拠("AI 生成コード 3 つのよくある問題"への反論)](#エンジニアリング品質証拠ai-生成コード-3-つのよくある問題への反論)
- [AI プログラミング協作宣言](#ai-プログラミング協作宣言)
- [テスト](#テスト)
- [デプロイ](#デプロイ)
- [国際化](#国際化)
- [FAQ](#faq)
- [コントリビュート](#コントリビュート)
- [ドキュメントナビゲーション](#ドキュメントナビゲーション)
- [ロードマップ](#ロードマップ)
- [お問い合わせ](#お問い合わせ)
- [私たちの物語 · 智匯AIの誕生](#私たちの物語--智匯aiの誕生)
- [オープンソース共創ビジョン](#オープンソース共創ビジョン)
- [License](#license)
- [謝辞](#謝辞)

---

## プロジェクト ポジショニング(必読)

> **一言ポジショニング:IHUI-AI はオープンソース AI 商用グレード統合ファウンデーション(Open-Source AI Commercial-Grade Integrated Foundation)です — 単一の AI ツールではなく、「完全な商用グレード AI 製品を構築する」ために必要な全インフラ(8 クライアントフレームワーク + 118 モデルゲートウェイ + LangGraph+MCP+A2A トリプルスタック + 商業ループ + エンタープライズセキュリティ + エンジニアリング品質ゲート + オブザーバビリティ)を Apache 2.0 ライセンスで一括オープンソース化し、あらゆる個人 / 企業 / 教育機関 / コンテンツクリエイターが Fork 後 5 分以内に自身の AI 商用製品をリリースできるようにします。**
>
> **価値提案**:**1 リポジトリで 6-10 個の独立 SaaS を代替**(Stripe + Auth0 + Mailgun + Mixpanel + Dify + Claude Code + Khan Academy + 蟻客 + Notion AI)、月額コストを $300+ から $0(セルフホスト)へ削減。

### 三層価値ピラミッド

IHUI-AI のポジショニングは「ユーザー価値 → 製品形態 → 技術の堀」の三層ピラミッドで構成されます:

```
                 ┌─────────────────────────────────────────────────┐
   第 1 層       │  ユーザー価値(Why)                              │
   ユーザー価値  │  • 5 分で Fork から商用 AI 製品をリリース        │
   (Why)         │  • 1 リポジトリで 6-10 個の SaaS を代替、月 $300+ 節約 │
                 │  • 100% データ主権、Apache 2.0 商用フレンドリー  │
                 │  • 5 クラスのロールが受益(開発者 / 中小企業 / 教育 / クリエイター / 企業)│
                 └─────────────────────────────────────────────────┘
                                        ▲
                 ┌─────────────────────────────────────────────────┐
   第 2 層       │  製品形態(What)                                │
   製品形態      │  オープンソース AI 商用グレード統合ファウンデーション │
   (What)        │  • 6 大製品カテゴリを統合:                       │
                 │    ① AI アプリケーション開発プラットフォーム(Dify/Coze/RAGFlow に対抗)│
                 │    ② AI プログラミング CLI(Claude Code/Cursor に対抗)│
                 │    ③ マルチクライアントフレームワーク(Tauri/Expo/Taro/WXT に対抗)│
                 │    ④ 商業 SaaS ファウンデーション(Stripe+Auth0+Mixpanel に対抗)│
                 │    ⑤ AI 教育プラットフォーム(Khan Academy/Coursera に対抗)│
                 │    ⑥ コンテンツ配信中台(蟻客/新媒体管家/Jasper に対抗)│
                 │  • 1 リポジトリ 8 クライアントコード、ツール集ではなく製品としてプリセット│
                 └─────────────────────────────────────────────────┘
                                        ▲
                 ┌─────────────────────────────────────────────────┐
   第 3 層       │  技術の堀(How)                                 │
   技術の堀      │  • 8 クライアント / 598 テーブル / 128+ マイグレーション / 4443 API ルート│
   (How)         │  • LangGraph + MCP + A2A トリプルスタック連携     │
                 │  • 16 共有パッケージ / 21 pre-commit 品質ゲート / 5 言語 i18n │
                 │  • 三支柱オブザーバビリティ + 20 Grafana ダッシュボード │
                 │  • エンタープライズ級セキュリティスタック(RBAC + RLS + SSO + AES-256-GCM)│
                 │  • Apache 2.0 License、商用制限ゼロ               │
                 └─────────────────────────────────────────────────┘
```

### IHUI-AI とは何か

| 次元               | ポジショニング                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **本質**           | オープンソース AI 商用グレード統合ファウンデーション(Open-Source AI Commercial-Grade Integrated Foundation)                                                                                                                          |
| **類比**           | AI アプリ界の Kubernetes / Next.js Boilerplate / Linux ディストリビューション — 「インフラ構築」を 3-6 ヶ月から 5 分へ圧縮                                                                                                           |
| **対抗レベル**     | 「AI アプリケーション開発プラットフォーム + AI プログラミング CLI + マルチクライアントフレームワーク + 商業 SaaS ファウンデーション + AI 教育プラットフォーム + コンテンツ配信中台」の 6 大カテゴリを同時に横断                      |
| **対象ユーザー**   | 個人開発者(プライベート AI アシスタント)/ 中小企業(AI 中台)/ AI サービスプロバイダ(商用製品)/ 教育機関(AI 教育フルスタック)/ コンテンツクリエイター(38 プラットフォーム配信)/ 企業意思決定者(エンタープライズ級 AI プラットフォーム) |
| **License**        | Apache 2.0(商用フレンドリー、伝染性なし、クローズドソース商用利用許可、copyleft 制約なし)                                                                                                                                            |
| **デプロイモード** | 完全セルフホスト、Docker Compose で 14 サービスをワンクリック起動、データ 100% 主権、認証情報は AES-256-GCM で暗号化、いかなる大手テック企業にも覗かれない                                                                           |
| **コード規模**     | 8 クライアントコード / 231 schema ファイル / 598 データベーステーブル / 128+ マイグレーション / 4443 API ルート / 250+ Web ページ / 16 共有パッケージ / 21 pre-commit 品質ゲート / 5 言語 i18n parity                              |
| **代替価値**       | Stripe($84/月)+ Auth0($35/月)+ Mailgun($35/月)+ Mixpanel($20/月)+ Dify($59/月)+ Claude Code($20/月)+ 蟻客($50/月)≈ $303/月 を代替、IHUI-AI セルフホスト $0/月                                                                        |

### IHUI-AI ではないもの

- **ChatGPT のラッパーではない** — 課金 / サブスクリプション / マルチテナント / 監査 / RBAC を備えた完全な商用グレード AI アプリケーションファウンデーション、直接 SaaS 化可能
- **単一の AI 対話プラットフォームではない** — AI 対話、AI プログラミング CLI、AI 教育、AI コンテンツ配信、AI Agent マーケットの 5 大シナリオを同時に網羅
- **デモやスキャフォールドではない** — 「智匯 AI グループ」の商業化メインプラットフォームを支える本番級コード、598 テーブルは実際の業務複雑度に基づき設計
- **SaaS サブスクリプションではない** — 完全セルフホスト、あなたが 100% データ主権を持ち、認証情報は AES-256-GCM で暗号化、いかなる外部送信もなし
- **垂直ツールではない** — Dify は AI アプリケーションオーケストレーションのみ、Claude Code は CLI のみ、蟻客はマルチプラットフォーム配信のみ、RAGFlow は RAG のみ、Khan Academy は教育のみ、IHUI-AI はこれら 6 大カテゴリの能力を**1 つの Apache 2.0 リポジトリに統合**
- **LangChain/LlamaIndex のような開発フレームワークではない** — それらは開発者向けの「車の部品」、IHUI-AI は「完成車のラインオフ」、非技術チームでも直接利用可能

### コスト比較:IHUI-AI セルフホスト vs 同等の SaaS スタック

> 以下のコスト比較は 2026 年 7 月時点の各 SaaS 公式公開価格(月額サブスクリプション、小規模チーム 5 名 + 月間 1 万 MAU シナリオ)に基づき、意思決定参考としてのみ提供されます。

| 能力次元                       | 同等の SaaS スタック                                                  | 月額コスト    | IHUI-AI セルフホスト                   |
| ------------------------------ | --------------------------------------------------------------------- | ------------- | -------------------------------------- |
| **AI 対話とモデル**            | OpenAI ChatGPT Team($25/人)+ Dify($59)                                | $184/月       | **$0**(モデル費のみ)                   |
| **AI プログラミング CLI**      | Claude Code($20)+ GitHub Copilot($19)+ Cursor($20)                    | $59/月        | **$0**(モデル費のみ)                   |
| **決済 / サブスク / 課金**     | Stripe($84)+ Lemon Squeezy($5)                                        | $89/月        | **$0**                                 |
| **認証 / SSO / RBAC**          | Auth0($35)+ Clerk($25)                                                | $60/月        | **$0**                                 |
| **メール / SMS**               | Mailgun($35)+ Twilio($35)                                             | $70/月        | **$0**                                 |
| **ユーザー分析**               | Mixpanel($20)+ PostHog($0 オープンソース)                             | $20/月        | **$0**(BI 内蔵)                        |
| **AI 教育プラットフォーム**    | Khan Academy(無料だがクローズドソース)+ Coursera for Business($70/人) | $350/月       | **$0**(オープンソース、カスタマイズ可) |
| **コンテンツ配信中台**         | 蟻客($50)+ 新媒体管家($30)                                            | $80/月        | **$0**                                 |
| **オブザーバビリティスタック** | Datadog($15/ホスト)+ Sentry($26)                                      | $101/月       | **$0**(オープンソーススタック)         |
| **合計**                       | 9 個の SaaS                                                           | **$1,013/月** | **$0**(サーバー費のみ)                 |
| **3 年総コスト**               |                                                                       | **~$36,468**  | **~$1,080**(単一 VPS)                  |

> **結論**:同等の能力組み合わせの SaaS 月額コストは約 $1,013、3 年で $36,468;IHUI-AI セルフホストはサーバーコスト約 $30/月、3 年で $1,080 のみ。**$35,000+ を節約しつつ、100% データ主権 + 完全なカスタマイズ能力**を獲得できます。

### IHUI-AI の独自価値(オープンソース生態系では希少)

全面的な市場対抗(40+ の国際/国内製品を網羅、詳細は下方の比較表を参照)に基づき、以下の能力の組み合わせは**グローバルなオープンソース AI プロジェクトで同時具備は希少**です:

1. **8 クライアント全面対応**:Web / API / AI サービス / CLI / デスクトップ Tauri / ブラウザ拡張 WXT / モバイル RN / WeChat ミニプログラム Taro — 同種のオープンソース AI プロジェクトは最大 2 クライアント(Dify/FastGPT)、8 クライアント対応は本プロジェクトの特徴
2. **LangGraph + MCP + A2A トリプルスタック連携**:ワークフロー + ツールプロトコル + Agent 相互通信を一体化、他のオープンソース AI プラットフォームは最大シングルスタック(Langflow は LangChain DAG のみ、Dify は自社製ワークフローで MCP/A2A なし、LangChain/LlamaIndex はフレームワーク層のみ)
3. **自社製 CLI で Claude Code に対抗**:17 コマンド + 13 内蔵ツール + ACP Server + 6 ソース設定インポート(cc-switch / codex++ / Claude / Codex / Gemini / Hermes)+ Skills システム — オープンソース AI アプリケーションプラットフォームでは**希少**な自社製 CLI 搭載プロジェクト(Cursor / Copilot / Windsurf / Amazon Q / Cline / Aider / Cody はすべてクローズドソースまたは純粋な CLI ツール)
4. **完全な商業ループ**:VIP / サブスクリプション recurring / ウォレット / ポイント / 返金監査 / インボイス / 為替レート / 8 決済ゲートウェイ / ディストリビューションコミッション / 招待リファラル — オープンソース AI プラットフォームでは**希少**な金融級商業ループ搭載(Dify/FastGPT/Langflow はいずれもなし)
5. **38 プラットフォームワンクリック自動配信**:9 記事プラットフォーム + 2 画像プラットフォーム + 5 動画プラットフォーム + AES-256-GCM 認証情報暗号化 + 38 adapter — オープンソースプロジェクトでは**希少**な公衆号 / 知乎 / CSDN / 掘金 / 小紅書 / 微博 / B 站 / YouTube / 抖音など 38 プラットフォーム網羅(蟻客/新媒体管家はクローズドソース SaaS)
6. **AI 教育フルスタック**:コース / 問題集 / 試験 / SRS 間隔反復 / ライブ / 学習レポート / 証明書 / 講師 / 学生側 12 サブページ / 45 テーブル edu-full schema — オープンソース AI プラットフォームでは**希少**な AI 教育フルスタック(Khan Academy/Coursera はクローズドソース SaaS)
7. **エンタープライズ級セキュリティスタック**:RBAC + マルチテナント + RLS(Row-Level Security)+ SSO(OAuth2 + Apple + Google + PKCE)+ AES-256-GCM + JWT token-family + ワークスペース 3 モード権限 + 7 エンドポイントランタイム傍受 + 60s 監査タイムアウト + GDPR + 2FA + IDOR 防護 — オープンソース AI プラットフォームでは**希少**なエンタープライズ級セキュリティスタック
8. **17 エンジニアリング品質ゲート + 11 マイグレーション監査 + post-commit 自動 push**:協作事故をメカニズムから削減 — オープンソース AI プロジェクトでは**希少**なメカニズム級エンジニアリング品質ゲート(Dify/FastGPT は基礎 lint のみ)
9. **三支柱オブザーバビリティ + 20 Grafana ダッシュボード**:Prometheus + Grafana + Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager — オープンソース AI プラットフォームでは**希少**な SRE 級オブザーバビリティスタック搭載(他プロジェクトは最大基礎ログ)
10. **5 言語 i18n parity + 4 ゲートスクリプト**:zh-CN / zh-TW / en / ko / ja のキーセット強一貫性、opencc 字形検出 + 文字範囲検出 + 破碎機翻検出 — オープンソース AI プロジェクトでは**希少**な parity + ゲート級 i18n 実現(他プロジェクトは最大中英のみ)

### 記憶ポイント スローガン(拡散可能)

| スローガン                                              | 価値アンカー                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **「1 リポジトリで 6 個の SaaS を代替」**               | Stripe + Auth0 + Mailgun + Mixpanel + Dify + Claude Code を代替、月 $300+ 節約                                |
| **「5 分で Fork から商用へ」**                          | Docker Compose で 14 サービスをワンクリック起動、クローンからリリースまで約 5 分、従来方案は 3-6 ヶ月         |
| **「AI アプリ界の Kubernetes」**                        | 「インフラ構築」を標準化・再利用可能に、どのチームも統一ファウンデーション上で自身の AI アプリを稼働可能      |
| **「8 クライアント + 118 モデル + トリプルスタック」** | 8 クライアントコード + 118 モデル + LangGraph+MCP+A2A トリプルスタック、オープンソース AI 生態系で高カバー率 |
| **「Apache 2.0、商用制限ゼロ」**                        | License は商用フレンドリー、copyleft 制約なし、クローズドソース商用利用許可、企業は安心して Fork 可能         |
| **「データ 100% 主権」**                                | 完全セルフホスト、認証情報は AES-256-GCM で暗号化、いかなる外部送信もなく、GDPR / 等保要件に適合              |

### 6 大対抗カテゴリとの関係

IHUI-AI はいかなる単一プロジェクトを置き換えることが目的ではなく、以下の 6 種類のプロジェクトの能力を**1 つのオープンソース ファウンデーションに統合**するものです:

| 対抗カテゴリ                                   | 代表製品                                                                                                                                                                                                                                                                                                    | IHUI-AI の対抗能力                                                                                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI アプリケーション開発プラットフォーム**    | Dify / FastGPT / Langflow / RAGFlow / Flowise / Coze(扣子)                                                                                                                                                                                                                                                  | 118 モデル LiteLLM ゲートウェイ + LangGraph ワークフロー + ナレッジベース RAG + pgvector ベクトル DB + ナレッジグラフ + Agent Runtime + Persona                                                    |
| **AI プログラミング CLI / IDE**                | Claude Code / Cursor / Windsurf / GitHub Copilot / Copilot Workspace / Amazon Q Developer / Cody Sourcegraph / Cline / Aider / Devin / Tabnine / GitLab Duo / Gemini CLI / OpenCode / CodeGeeX / Continue / Roo Code / Codeium / JetBrains AI Assistant                                                     | 自社製 CLI 17 コマンド + 13 内蔵ツール + ACP Server(Zed/VSCode/Cursor 埋め込み)+ 6 ソース設定インポート + Skills + CodeGraph + Worktree                                                             |
| **エンタープライズ AI Agent プラットフォーム** | Google Gemini Enterprise Agent Platform / OpenAI Agents SDK / Microsoft Copilot Studio / IBM watsonx.ai / Salesforce Agentforce / ServiceNow Now Assist / AWS Bedrock Agents / Crew                                                                                                                         | LangGraph + MCP + A2A トリプルスタック + Agent マーケット + デベロッパーセンター + Coze SDK プロキシ + OpenClaw + Crew 統合 + N8N プロキシ                                                          |
| **AI Agent フレームワーク(オープンソース)**    | LangChain / LangGraph / LlamaIndex / AutoGen / CrewAI / AutoGPT / MetaGPT / smol agents / Semantic Kernel / Spring AI / Hugging Face Transformers Agents                                                                                                                                                    | トリプルスタック連携 + 完全な Agent Runtime + Persona レジストリ + Agent マーケット — 単なるフレームワークではなく、製品化された落地方案                                                            |
| **マルチクライアントフレームワーク**           | Tauri / Electron / Expo / React Native / Taro / WXT / Next.js / Remix / Nuxt / SvelteKit                                                                                                                                                                                                                    | 8 クライアント統一アーキテクチャ + 16 共有パッケージ + クロスクライアント型安全 + 共有 UI(`@ihui/ui-react` / `@ihui/ui-native` / `@ihui/design-tokens`)                                             |
| **AI 教育 / コンテンツプラットフォーム**       | Khan Academy / Coursera / edX / Google 教育 AI / 智譜清言教育 / 学而思 AI / Jasper / Copy.ai / Rytr / WriteSonic / Notion AI / 蟻客 / 新媒体管家                                                                                                                                                            | AI 教育フルスタック(コース / 問題集 / 試験 / SRS / ライブ / 証明書)+ 38 プラットフォームワンクリック配信 + セルフメディアワークベンチ + AI ニュース + AI 求職 + ショートドラマ + ビジネス名刺       |
| **大モデル API プラットフォーム**              | 海外:OpenAI Platform / Anthropic API / Google Vertex AI / AWS Bedrock / Azure AI Foundry / Mistral La Plateforme / Cohere / Together AI / Fireworks AI / Replicate<br>国内:百度千帆 / 阿里百煉 / 騰訊混元 / 字節豆包(火山方舟)/ 智譜開放プラットフォーム / 訊飛星火 / 月之暗面 Kimi / DeepSeek / 商湯日日新 | LiteLLM 統一ゲートウェイ + 118 モデル接続 + インテリジェントルーティング + 60% キャッシュヒット + マルチ provider アダプタ                                                                         |
| **商業 SaaS ファウンデーション**               | Stripe / PayPal / Lemon Squeezy / Paddle / Auth0 / Clerk / Firebase Auth / Supabase Auth / Mailgun / SendGrid / Postmark / Resend / Mixpanel / Amplitude / PostHog / Heap                                                                                                                                   | VIP / サブスクリプション / ウォレット / ポイント / 返金 / インボイス / 8 決済ゲートウェイ + JWT / SSO / RBAC + SMTP SMS + BI ダッシュボード + カナリアリリース — 4-6 個の SaaS をワンストップで代替 |

> **コア インサイト**:オープンソース AI 生態系において、IHUI-AI より**特化した**プロジェクトは見つかります(例:RAGFlow は RAG 次元でより深い、Claude Code は CLI 次元でより成熟、LangChain はフレームワーク層でより柔軟)。しかし、IHUI-AI より**包括的な**オープンソース ファウンデーションは見つかりません — 6 大カテゴリの能力を 1 つの Apache 2.0 リポジトリに統合することが、IHUI-AI のコア差別化です。
>
> **誰かを代替するのではなく、6 つの製品の能力を Apache 2.0 でオープンソース化**:RAGFlow の RAG が欲しければ、RAGFlow 単体を使えばいい;Claude Code の CLI が欲しければ、Claude Code 単体を使えばいい。しかし**完全な商用 AI 製品**(対話 + プログラミング + 教育 + 配信 + 課金 + エンタープライズセキュリティ)が欲しければ、IHUI-AI はグローバルなオープンソース生態系で有力な選択肢の一つです。

---

## 機能概要(30 秒で全能力を把握)

| 大分類                               | モジュール                                 | 主要能力                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI 対話とモデル**                  | マルチモデル対話                           | 118 モデル / インテリジェントルーティング / 60% キャッシュヒット / ストリーミング SSE + WebSocket / 対話お気に入り / 履歴 / シェア / テンプレート                               |
|                                      | AI 画像生成                                | テキストから画像 / 画像編集 / マルチ解像度 / マルチモデル(Stable Diffusion / DALL-E / 通義万相)                                                                                  |
|                                      | AI オーディオ                              | TTS ストリーミング合成 / ASR 音声認識 / 音声クローン / 双方向リアルタイム音声(WebRTC PCM16 16kHz)                                                                                |
|                                      | AI 動画合成                                | テキストから動画 / 動画編集 / マルチモデル混編 / トランスコード / 動画タスク管理                                                                                                 |
|                                      | AI デジタルヒューマン                      | Tencent Hunyuan 3D / AI ワールド / デジタルヒューマンインタラクション                                                                                                            |
|                                      | AI ワールド                                | ai-world-items + AI ランキング + トレンド同期 + AI モジュール化(ai-modules)+ AI ベンダー設定センター(ai-vendor-configs)                                                          |
|                                      | AI キャリア                                | AI 求職アシスタント / 履歴書最適化 / 模擬面接                                                                                                                                    |
|                                      | AI ニュース                                | AI ニュースアグリゲーション / インテリジェント要約 / ai-feed                                                                                                                     |
|                                      | ユーザー単位 AI 設定                       | ユーザー単位モデル対話設定(ai-user-model-chat)/ ユーザー長期記憶(user-memory)/ ユーザー設定(user-preferences)                                                                    |
| **AI ワークフロー**                  | LangGraph                                  | StateGraph ワークフロー(plan → execute → summarize)+ stub モード                                                                                                                 |
|                                      | MCP ツールプロトコル                       | 11 内蔵ツール + 3 リソース + 3 プロンプト / カスタムツール / プロジェクト級 MCP / mcp-extended                                                                                   |
|                                      | A2A プロトコル                             | Agent-to-Agent 相互通信 / Redis 永続化 + メモリフォールバック                                                                                                                    |
|                                      | ナレッジベース RAG                         | ドキュメントベクトル化 / セマンティック検索 / 引用トレース / knowledge-base + knowledge-rag                                                                                      |
|                                      | ナレッジグラフ                             | knowledge-graph schema + ノード-関係グラフ / ドキュメント間エンティティリンク(オープンソース AI プラットフォームで稀少)                                                          |
|                                      | pgvector ベクトル DB                       | 0123_pgvector_embedding マイグレーション / ネイティブ PostgreSQL ベクトルインデックス / 独立ベクトル DB 不要                                                                     |
|                                      | ワークフローオーケストレーション           | ビジュアルワークフロー / CrewAI 統合 / N8N プロキシ / workflows                                                                                                                  |
|                                      | ベクトルメモリ                             | コサイン類似度セマンティック検索 / セッションを跨ぐ長期記憶 / vector-memory                                                                                                      |
| **マルチエージェントエコシステム**   | エージェントマーケット                     | 購入 / 審査 / 決済 / 出金 / 分類 / 推薦 / ランキング / ピックアップ                                                                                                              |
|                                      | デベロッパーセンター                       | API Keys / 呼出ログ / チーム管理 / 収益分析 / 13 サブページ                                                                                                                      |
|                                      | Coze SDK プロキシ                          | Bot / 対話 / ワークフロー / データセット / テンプレート / 変数 / ワークスペース / OAuth                                                                                          |
|                                      | OpenClaw                                   | オープンソース Agent フレームワーク接続 / clawdbot / openclaw-routes                                                                                                             |
|                                      | Skills システム                            | content_engine(build_gpt56_sol / export_csdn_md / full_audit / publish_pipeline)+ koubo_workflow(10+ ツール)                                                                     |
| **8 プラットフォームフレームワーク** | Web                                        | Next.js 16 / 250+ ページ / PWA / SEO / ダークモード / 5 言語                                                                                                                     |
|                                      | API                                        | Fastify 5 / 4443 ルート / 25 WebSocket エンドポイント / 604 ルートファイル / OpenAPI                                                                                             |
|                                      | AI サービス                                | FastAPI + LangGraph + LiteLLM + MCP + A2A / 577 エンドポイント / 5 provider アダプタ                                                                                             |
|                                      | CLI                                        | Node.js / 17 コマンド / 13 内蔵ツール / 6 ソース設定インポート / ACP Server                                                                                                      |
|                                      | デスクトップ                               | Tauri 2 + Rust / システムトレイ / ローカルファイルアクセス                                                                                                                       |
|                                      | ブラウザ拡張                               | WXT / コンテキストメニュー / サイドバー / Chrome + Edge + Firefox                                                                                                                |
|                                      | モバイル RN                                | React Native + Expo EAS / iOS + Android / SSO                                                                                                                                    |
|                                      | ミニプログラム                             | Taro 4 / WeChat Pay ネイティブ統合 / 3 言語(i18n)                                                                                                                                |
| **エンタープライズ級能力**           | ワークスペース権限                         | 3 モード + 7 エンドポイントランタイム傍受 + 60s 監査タイムアウト + workspace-ai-tasks                                                                                            |
|                                      | RBAC + マルチテナント                      | ロール / 部門 / 組織 / テナント分離 / メニュー権限 / data-scope 5 級                                                                                                             |
|                                      | SSO シングルサインオン                     | OAuth 2.0 / Apple / Google / SSO 中継ログイン / PKCE                                                                                                                             |
|                                      | 課金とサブスクリプション                   | VIP 等級 / サブスクリプション recurring / ウォレット / ポイント / 返金監査 / インボイス / 為替レート / 8 決済ゲートウェイ                                                        |
|                                      | カナリアリリース                           | Canary / グレールール / A/B テスト / canary + ab-tests                                                                                                                           |
|                                      | データコンプライアンス                     | GDPR / 機密語フィルタ / コンテンツ審査 / 監査ログ / データエクスポート                                                                                                           |
| **コンテンツ創作**                   | セルフメディアワークベンチ                 | 公衆号記事 + 口播稿デュアルパイプライン / スラッシュコマンド / self-media-automation                                                                                             |
|                                      | 38 プラットフォーム自動配信                | 記事 9 + 画像 2 + 動画 5 プラットフォーム / 認証情報 AES-256-GCM 暗号化 / 38 adapter                                                                                             |
|                                      | ニュース                                   | 記事 / ニュース / 特集 / タグ / コメント / いいね / お気に入り / news-crawler                                                                                                    |
|                                      | ショートドラマ                             | ショートドラマ創作と管理 / drama                                                                                                                                                 |
|                                      | ビジネス名刺                               | 名刺作成 / 編集 / お気に入り / シェア / business-cards                                                                                                                           |
| **AI 教育フルスタック**              | コース学習                                 | コース / 章 / 学習パス / 学習マップ / 進捗トラッキング / ノート / zhs-course                                                                                                     |
|                                      | 問題集と試験                               | 多問題タイプ / 自動採点 / 章別練習 / 間違いノート / 試験アップロード / exam-marking                                                                                              |
|                                      | SRS 間隔反復                               | エビングハウス忘却曲線 / インテリジェント復習スケジュール                                                                                                                        |
|                                      | ライブ授業                                 | チェックイン / インタラクション / 再生 / AI 補助 / live-chat                                                                                                                     |
|                                      | 学習レポート                               | 行動分析 / 個別最適化提案 / 証明書発行                                                                                                                                           |
|                                      | 講師管理                                   | 講師トップページ / コース連携 / education-platform                                                                                                                               |
|                                      | 学生側                                     | 12 サブページ(Q&A / 記事 / サークル / コメント / コース / リソース / ノート / オフライン / 試験 / 間違いノート / 証明書)                                                         |
| **コミュニティインタラクション**     | サークル広場                               | サークル / 広場 / Q&A / 投稿 / トピック / タグ                                                                                                                                   |
|                                      | DM メッセージ                              | 1 対 1 DM / システム通知 / マルチプラットフォーム同期 / private-letters                                                                                                          |
|                                      | フォロー/フォロワー                        | フォロー / フォロワー / ユーザートップページ / 名刺                                                                                                                              |
|                                      | シェア招待                                 | 招待コード / シェアコード / H5 シェア / リファラル報酬 / visit-tracking                                                                                                          |
| **運営グロース**                     | ポイントチェックイン                       | デイリーチェックイン / タスクポイント / ポイントモール / 交換 / point-redeem-items                                                                                               |
|                                      | ランキング                                 | 多次元ランキング / 週月ランキング / ユーザー順位 / ranking                                                                                                                       |
|                                      | くじイベント                               | くじ / 紅包 / リワード動画広告 / rewarded-video-ad                                                                                                                               |
|                                      | ディストリビューションコミッション         | ディストリビューション体系 / コミッションプラン / 出金 / 8 サブページ / commission                                                                                               |
|                                      | イベント告知                               | イベント管理 / お知らせプッシュ / Banner カルーセル / carousels                                                                                                                  |
| **カスタマーサポート**               | チケットシステム                           | チケット提出 / 処理 / 評価 / FAQ / admin-asks + admin-faq                                                                                                                        |
|                                      | オンラインカスタマーサポート               | WebSocket リアルタイムサポート / 1 対 1 セッション / customer-service                                                                                                            |
|                                      | フィードバックセンター                     | ユーザーフィードバック / 処理ステータス / トレース                                                                                                                               |
| **運用監視**                         | BI ダッシュボード                          | 業務指標可視化 / データ分析 / bi-dashboard                                                                                                                                       |
|                                      | エラーダッシュボード                       | エラー集計 / アラート / トレース / security-audit                                                                                                                                |
|                                      | 操作ログ                                   | ログインログ / 操作ログ / コールバックログ / audit + security-logs                                                                                                               |
|                                      | 監視アラート                               | Prometheus + Grafana(20 ダッシュボード)+ Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager                                                                                 |
| **エンジニアリング基盤**             | データベース                               | PostgreSQL 18 / **598 テーブル** / 231 schema ファイル / **128+ マイグレーション** / Drizzle ORM + RLS + テナントルーティング + **pgvector**                                    |
|                                      | キューキャッシュ                           | Redis 7 + BullMQ / 独立 worker プロセス(:8804)                                                                                                                                   |
|                                      | オブジェクトストレージ                     | OSS マルチベンダードライバ / 認証情報暗号化 / チャンクアップロード / ファイルバージョン / chunked-upload                                                                         |
|                                      | メール SMS                                 | SMTP / SMS ゲートウェイ / メールテンプレート / 認証コード / mail + message-templates                                                                                             |
|                                      | 国際化                                     | 5 言語 parity(zh-CN / zh-TW / en / ko / ja)+ 19 i18n ツールチェーン + 4 ゲートスクリプト                                                                                         |
|                                      | エンジニアリング品質ゲート                 | 21 pre-commit フック + post-commit 自動 push + 11 マイグレーション監査 + 9 PowerShell 起動                                                                                       |
|                                      | テストカバレッジ                           | 268 + 400+ ケース / Vitest + Playwright + pytest + Locust 負荷テスト + Lighthouse 性能                                                                                           |
|                                      | デプロイ運用                               | Docker Compose(14 サービス)/ ブルーグリーンデプロイ / Nginx upstream 切替 / ヘルスチェック / ロールバック / バックアップ / 証明書更新 cron                                       |
|                                      | 性能 CI                                    | Knip 未使用コード検出 + Lighthouse CI 性能予算 + GitHub Act ローカル CI                                                                                                          |
|                                      | マイクロサービス エンジニアリング パターン | Outbox トランザクショナルアウトボックス + Refund DLQ デッドレターキュー + Circuit Breaker サーキットブレイカー + IDOR 保護 + WS Dedup メッセージ重複排除 + Hot Config ホット設定 |

---

## IHUI-AI を選ぶ理由

| 次元                                           | 能力                                                                                                                                               | 業界ポジション                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **プラットフォーム網羅**                       | Web / API / AI サービス / CLI / デスクトップ / 拡張 / モバイル RN / ミニプログラム Taro                                                            | 業界初の 8 プラットフォーム完全網羅 AI フルスタックプラットフォーム |
| **モデル接続**                                 | LiteLLM ゲートウェイで 118 モデルを統一(国際 30+ / 中国製 15+ / クラウドベンダー 10+)                                                             | ワンストップ接続、インテリジェントルーティング + 60% キャッシュ     |
| **AI オーケストレーション三スタック**          | LangGraph(ワークフロー)+ MCP(ツールプロトコル)+ A2A(Agent 相互通信)                                                                                | ワークフロー、ツール、エージェントの連携一体化                      |
| **自社製 CLI**                                 | 17 コマンド + 13 内蔵ツール + ACP Server、Claude Code 対抗                                                                                         | コマンドラインネイティブの AI プログラミング体験                    |
| **CLI 設定シームレスインポート**               | cc-switch / codex++ / Claude / Codex / Gemini / Hermes 6 ソースワンクリックインポート                                                              | クロス CLI ツール設定マイグレーションコストゼロ                     |
| **エンタープライズ級セキュリティ**             | RBAC + ワークスペース 3 モード権限 + 7 エンドポイントランタイム傍受 + 60s 監査タイムアウト                                                         | 意思決定者級リスクコントロール                                      |
| **データ暗号化**                               | AES-256-GCM(credentials 暗号化)+ JWT token-family ローテーション + refresh ブラックリスト                                                          | 金融級データ保護                                                    |
| **オブザーバビリティ**                         | Prometheus + Grafana(**20 ダッシュボード**)+ Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager                                               | フルリンク指標 / ログ / トレース / アラート                         |
| **エンジニアリング品質ゲート**                 | 21 pre-commit + post-commit 自動 push + git-push-guard + 11 マイグレーション監査                                                                   | 協作事故を根絶、99.9% SLA                                           |
| **国際化**                                     | zh-CN / zh-TW / en / ko / ja 5 言語 parity + 19 i18n ツールチェーン                                                                                | 5 言語キーセット強一貫性                                            |
| **データベース**                               | **598 テーブル + 128+ マイグレーション** + 231 schema ファイル + Drizzle ORM + RLS + テナントルーティング + pgvector                              | 単一データベース PostgreSQL 18、schema 分離                         |
| **API 規模**                                   | 4443 ルート(api 4443 + ai-service 577)+ 25 WebSocket + 604 ルートファイル                                                                           | 元プロジェクト 331 エンドポイントを大幅に超越                       |
| **業務網羅**                                   | 15 大モジュール / 50+ サブ機能 / **250+ Web ページ**                                                                                               | ひとつのプラットフォームで全 AI アプリケーションシナリオを網羅      |
| **共有パッケージ**                             | 16 packages(auth/database/types/ui/sdk/api-client/context-compaction/dom-actions/browser-platform/i18n など)                                       | クロスプラットフォーム型安全 + 再利用                               |
| **マイクロサービス エンジニアリング パターン** | Outbox トランザクショナルアウトボックス + Refund DLQ デッドレターキュー + Circuit Breaker サーキットブレイカー + IDOR 防護 + WS Dedup + Hot Config | 本番級マイクロサービスパターン                                      |
| **性能保障**                                   | Knip 未使用コード + Lighthouse CI + Locust 負荷テスト                                                                                              | 性能予算 + 容量見積り                                               |
| **デプロイ成熟度**                             | Docker Compose(14 サービス)+ ブルーグリーン + Nginx upstream + 証明書更新 cron                                                                     | 本番級運用                                                          |

---

## 類似プロジェクトとの比較

### 対抗マトリクス · 12 列横断比較(国際/国内 40+ 大製品を網羅)

> テーブル列数が多いため、デスクトップ環境で横スクロールして閲覧することを推奨します。モバイル環境では「IHUI-AI」列と「重要な結論」セクションのみをご覧ください。

| 次元                           | IHUI-AI                                                                        | OpenAI ChatGPT          | Dify                    | LangChain                  | RAGFlow            | Coze(扣子)           | Claude Code           | Cursor                | GitHub Copilot                | Khan Academy               | Stripe+Auth0                  |
| ------------------------------ | ------------------------------------------------------------------------------ | ----------------------- | ----------------------- | -------------------------- | ------------------ | -------------------- | --------------------- | --------------------- | ----------------------------- | -------------------------- | ----------------------------- |
| **対抗カテゴリ**               | 6 大カテゴリ統合(アプリ + CLI + マルチクライアント + 商業 + 教育 + コンテンツ) | 汎用 AI 対話            | AI アプリケーション開発 | AI Agent フレームワーク    | RAG ナレッジベース | AI エージェント SaaS | AI プログラミング CLI | AI プログラミング IDE | AI プログラミングアシスタント | AI 教育プラットフォーム    | 決済 + 認証ファウンデーション |
| **License**                    | **Apache 2.0**                                                                 | **クローズドソース**    | Apache 2.0              | MIT                        | Apache 2.0         | **クローズドソース** | **クローズドソース**  | **クローズドソース**  | **クローズドソース**          | **クローズドソース**(無料) | **クローズド SaaS**           |
| **セルフホスト**               | **完全セルフホスト**                                                           | 非対応                  | Docker                  | ライブラリ                 | Docker             | 非対応               | N/A                   | N/A                   | N/A                           | 非対応                     | N/A                           |
| **クライアント網羅**           | **8 クライアント**                                                             | 2 クライアント(Web/APP) | 2 クライアント          | 0 クライアント(ライブラリ) | 2 クライアント     | 2 クライアント       | 1 クライアント(CLI)   | 1 クライアント(IDE)   | 1 クライアント(IDE)           | 2 クライアント             | 0 クライアント(ライブラリ)    |
| **モデル接続**                 | **118 モデル** + LiteLLM                                                      | OpenAI 系               | 50+ モデル              | LangChain アダプタ         | 30+ モデル         | ByteDance 系         | Anthropic             | マルチモデル          | OpenAI                        | なし                       | N/A                           |
| **ワークフローエンジン**       | **LangGraph + MCP + A2A トリプルスタック**                                     | なし                    | 自社製ワークフロー      | LangGraph                  | なし               | 自社製ワークフロー   | なし                  | なし                  | なし                          | なし                       | N/A                           |
| **自社製 CLI**                 | **17 コマンド + 13 ツール + ACP Server**                                       | なし                    | なし                    | なし                       | なし               | なし                 | ネイティブ CLI        | なし                  | なし                          | なし                       | N/A                           |
| **マルチテナント + RBAC**      | **完全**(5 級 + RLS)                                                           | 単一ユーザー            | 基礎                    | なし                       | 基礎               | SaaS 内              | なし                  | なし                  | なし                          | 学校アカウント             | 基礎                          |
| **課金サブスクリプション**     | **完全**(VIP / ウォレット / ポイント / 返金 / 8 決済ゲートウェイ)              | サブスク($20-200)       | なし                    | なし                       | なし               | SaaS 内              | なし                  | サブスク($20)         | サブスク($10-39)              | 無料                       | コア(決済)                    |
| **AI 教育**                    | **フルスタック**(コース / 問題集 / 試験 / SRS / ライブ / 45 テーブル)          | なし                    | なし                    | なし                       | なし               | なし                 | なし                  | なし                  | なし                          | コア(教育)                 | なし                          |
| **コンテンツ配信**             | **38 プラットフォーム + 38 adapter**                                           | なし                    | なし                    | なし                       | なし               | なし                 | なし                  | なし                  | なし                          | なし                       | なし                          |
| **オブザーバビリティ**         | **三支柱 + 20 ダッシュボード**                                                 | -                       | 基礎                    | なし                       | 基礎               | -                    | なし                  | なし                  | なし                          | -                          | -                             |
| **エンジニアリング品質ゲート** | **17 フック + 11 マイグレーション監査 + 自動 push**                            | -                       | 基礎                    | 基礎                       | 基礎               | -                    | なし                  | なし                  | なし                          | -                          | -                             |
| **i18n**                       | **5 言語 parity + 4 ゲート**                                                   | 多言語                  | 中英                    | 英語                       | 中英               | 多言語               | 英語                  | 多言語                | 多言語                        | 多言語                     | N/A                           |
| **データベース**               | **598 テーブル + 128+ マイグレーション + RLS + pgvector**                     | SaaS 内                 | 基礎                    | なし                       | pgvector           | SaaS 内              | なし                  | なし                  | なし                          | SaaS 内                    | SaaS 内                       |
| **共有パッケージ**             | **16 packages**                                                                | なし                    | なし                    | 1 ライブラリ               | なし               | -                    | なし                  | なし                  | なし                          | なし                       | 1 SDK                         |
| **月額コスト(5 名)**           | **$0**(セルフホスト、サーバー費のみ)                                           | $125+                   | $59+                    | $0(自己統合)               | $0(自己統合)       | SaaS 内              | $100                  | $100                  | $95                           | 無料(教育)                 | $149+                         |

### 重要な結論

**IHUI-AI は誰かを置き換えることが目的ではなく、「完全な AI アプリケーションを構築する」ために必要な 6 大カテゴリのインフラをすべてオープンソース化することが目的です。**

- **OpenAI ChatGPT より**:IHUI-AI は完全セルフホスト、データ 100% 主権、課金 / 教育 / 配信などの完全な業務を搭載、ChatGPT はクローズドソース SaaS
- **Dify / FastGPT / Langflow / RAGFlow より**:IHUI-AI は 6 クライアント、自社製 CLI、完全な商業ループ、AI 教育フルスタック、38 プラットフォーム配信、エンタープライズ級セキュリティスタック、SRE オブザーバビリティを追加装備
- **LangChain / LlamaIndex / AutoGen より**:それらは開発フレームワーク(「車の部品」)、IHUI-AI は製品化ファウンデーション(「完成車のラインオフ」)、非技術チームでも利用可能
- **Claude Code / Cursor / GitHub Copilot / Windsurf / Amazon Q より**:IHUI-AI の CLI はプログラミングだけでなく、AI アプリケーションプラットフォーム能力(対話 / RAG / Agent / 課金)も統合、リポジトリ全体が Apache 2.0 でオープンソース、他はすべてクローズドソース
- **Coze(扣子)より**:IHUI-AI は完全セルフホスト、データ主権 100%、License は商用フレンドリー、一方 Coze はクローズドソース SaaS、データは ByteDance に提出
- **Khan Academy / Coursera より**:IHUI-AI の AI 教育はオープンソースフルスタック(コース / 問題集 / 試験 / SRS / ライブ / 証明書)、二次カスタマイズ可能、これらはクローズドソース SaaS
- **Stripe + Auth0 + Mailgun + Mixpanel より**:IHUI-AI は決済 / 認証 / メール / 分析をすべてプリセット、ワンストップで 4-6 個の SaaS を代替、月 $300+ 節約

**コア差別化**:グローバルなオープンソース AI 生態系において、IHUI-AI より**特化した**プロジェクトは見つかります(例:RAGFlow は RAG 次元でより深い、Claude Code は CLI 次元でより成熟、LangChain はフレームワーク層でより柔軟、Khan Academy は教育コンテンツでより豊富)。しかし、IHUI-AI より**包括的な**オープンソース ファウンデーションは見つかりません。

**一言まとめ**:IHUI-AI は OpenAI ChatGPT(対話)+ Dify(アプリケーションオーケストレーション)+ Claude Code(CLI)+ Khan Academy(教育)+ Stripe(決済)+ 蟻客(配信)の**オープンソース一体化代替方案**です。

---

## IHUI-AI の利用者

本プロジェクトは**吉林省愛智匯人工知能科技有限公司**が発起し主導開発したもので、同社の商業化 AI プラットフォームを支えるものです。より多くの企業、チーム、個人からの利用事例提交を歓迎します(本セクションを編集して PR を提出してください):

| ロール                 | シナリオ                                                             | ステータス           |
| ---------------------- | -------------------------------------------------------------------- | -------------------- |
| 愛智匯 AI              | 同社のメイン商業化プラットフォーム(智匯 AI グループ)                 | 本番利用             |
| AI サービスプロバイダ  | マルチモデルプロキシ + 課金 + サブスクリプションワンストップ立ち上げ | 適応中               |
| 教育機関               | AI 教育フルスタック(コース / 問題集 / 試験 / SRS)                    | 適応中               |
| コンテンツクリエイター | 38 プラットフォームワンクリック配信                                  | 適応中               |
| 個人開発者             | プライベート AI アシスタント + ナレッジベース                        | あなたが埋める番です |

> あなたの会社やプロジェクトで IHUI-AI をお使いですか?PR を送って本リストにご参加ください。

---

## 5 つの典型的シナリオ

### シナリオ 1:個人開発者がプライベート AI アシスタントを構築

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI && docker compose up -d
# 5 分後に、以下を手に入れます(ChatGPT Team + Claude Code + Notion AI 3つのサブスクを代替、月$60+節約):
# - 118 モデル対応の対話インターフェース(ChatGPT Team $25/人 を代替)
# - プライベートナレッジベース RAG + pgvector ベクトル DB(ChatGPT Plus ナレッジベースを代替)
# - クロスプラットフォーム同期(Web + デスクトップ + モバイル + ミニプログラム)
# - 自社製 CLI プログラミングアシスタント(Claude Code $20/月 を代替)
# - データは完全セルフホスト、大手テック企業に覗かれない
```

### シナリオ 2:中小企業が AI 中台を構築

- RBAC で 200 人の従業員にアカウントを発行し、部門別にワークスペースを分離
- 7 つの LLM ベンダーを接続し、インテリジェントルーティングで最安モデルを選択
- 課金システムで部門別課金、インボイス発行
- BI ダッシュボードでどの部門が最も利用しているか可視化
- 監査ログでコンプライアンス要件を満たす

### シナリオ 3:AI サービスプロバイダが商業製品を立ち上げ

- マルチモデルプロキシ + 課金 + サブスクリプション + VIP + ウォレット + ポイントを再利用
- エージェントマーケットで開発者を呼び込み、30% コミッションを徴収
- API Keys + SDK で顧客にプラットフォームを接続させる
- 38 プラットフォーム配信でコンテンツマーケティング
- 1 年ではなく、1 週間で立ち上げ

### シナリオ 4:教育機関が教学を変革

- AI 教育フルスタックでコース + 問題集をインポート
- 学生は SRS 間隔反復で自動復習
- 先生は AI で試験を採点 + 学習レポート生成
- ライブ + チェックイン + インタラクション + 再生
- 学習行動分析 + 個別最適化提案
- 証明書自動発行

### シナリオ 5:コンテンツクリエイターが生産性を解放

- セルフメディアワークベンチで公衆号記事 + 口播稿を作成
- ワンクリックで 38 プラットフォームに配信(公衆号 / 知乎 / CSDN / 掘金 / 小紅書 / B 站 / YouTube / 抖音 等)
- 認証情報 AES-256-GCM 暗号化保存、プラットフォームに漏洩しない
- 配信完了を WebSocket でリアルタイム通知

---

## 技術スタック

| レイヤー           | 技術                                                                                       | バージョン                           |
| ------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| Monorepo           | pnpm workspace + Turborepo                                                                 | pnpm 9.15 / turbo 2.3                |
| バックエンド API   | Fastify + @fastify/jwt + @fastify/websocket + Drizzle ORM + PostgreSQL                     | Fastify 5.1 / Drizzle 0.38 / PG 15   |
| キャッシュとキュー | Redis 7 + BullMQ                                                                           | 独立 worker プロセス(:8804)          |
| フロントエンド Web | Next.js + React + Tailwind CSS + shadcn/ui                                                 | Next 16.2.12 / React 19 / Tailwind 4 |
| フロントエンド状態 | @tanstack/react-query 5 + Zustand                                                          | サーバー側 + クライアント側状態分離  |
| 国際化             | next-intl                                                                                  | zh-CN / zh-TW / en / ko / ja 5 言語  |
| AI サービス        | FastAPI + LangGraph + LiteLLM + MCP + A2A + Socket.IO                                      | FastAPI 0.115 / LangGraph 0.2        |
| AI プロトコル      | SSE(Agent ストリーミング)+ WebSocket(チャットルーム / マルチモデルストリーミング)+ REST    | 三プロトコル階層化                   |
| デスクトップ       | Tauri 2 + React 19 + Rust                                                                  | クロスプラットフォームネイティブ体験 |
| ブラウザ拡張       | WXT + React                                                                                | Chrome / Edge / Firefox              |
| モバイル           | React Native + Expo EAS                                                                    | iOS / Android                        |
| ミニプログラム     | Taro 4 + React                                                                             | WeChat ミニプログラム                |
| CLI                | Node.js + Commander + Inquirer                                                             | Claude Code 対抗                     |
| 認証               | @ihui/auth 共有パッケージ(JWT HS256 + token-family + OAuth2 + RBAC + data-scope 5 級)      | クロスプラットフォーム統一発行       |
| バリデーション     | Zod 3.24(バックエンド)+ React Hook Form(フロントエンド)                                    | エンドツーエンド型安全               |
| ログ               | Pino 9.5(バックエンド)+ Python logging(AI サービス)+ Loki + Promtail                       | 構造化 + 集計                        |
| トレース           | OpenTelemetry + Jaeger                                                                     | 分散フルリンク                       |
| 監視               | Prometheus + Grafana(20 ダッシュボード)+ Node Exporter + Alertmanager                      | ホスト + アプリ + アラート           |
| テスト             | Vitest(バックエンド)+ Playwright(E2E)+ pytest(AI サービス)+ Locust(負荷)+ Lighthouse(性能) | 268 + 400+ ケース                    |
| 未使用コード検出   | Knip                                                                                       | CI ゲート                            |
| Node               | >=20.10.0                                                                                  | -                                    |
| Python             | 3.12+(AI サービスのみ)                                                                     | -                                    |

---

## 8 プラットフォームアーキテクチャ

```
                    ┌─────────────────────────────────────────────────┐
                    │       ユーザー / 企業 / 開発者 / 教育機関          │
                    └────────────┬───────────────────────┬────────────┘
                                 │                       │
        ┌────────────────────────┼───────────────────────┼────────────────────────┐
        │                        │                       │                        │
   ┌────▼─────┐  ┌──────────┐  ┌─▼────────┐  ┌──────────▼───┐  ┌──────────┐  ┌─▼────────┐
   │  Web     │  │ Desktop  │  │ Extension│  │  Mobile RN  │  │ Miniapp  │  │   CLI    │
   │ Next 16  │  │ Tauri 2  │  │  WXT     │  │  Expo EAS   │  │ Taro 4   │  │ Node.js  │
   │ :8801    │  │ + Rust   │  │          │  │ iOS/Android │  │ WeChat MP │  │ ACP+Skl │
   └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬─────┘  └────┬─────┘  └────┬─────┘
        │             │             │               │             │             │
        └─────────────┴─────────────┴───────┬───────┴─────────────┴─────────────┘
                                           │  HTTPS / WebSocket / SSE / ACP
                                  ┌────────▼─────────┐
                                  │   apps/api       │  Fastify 5 + Drizzle ORM
                                  │   :8802          │  4443 ルート + 25 WS + 604 ルートファイル
                                  └────┬───────┬─────┘
                                       │       │
                          ┌────────────▼─┐   ┌─▼──────────────┐
                          │  PostgreSQL  │   │  apps/ai-service│  FastAPI + Socket.IO
                          │  15 (598 表) │   │  :8803          │  LangGraph + LiteLLM + MCP + A2A
                          └──────────────┘   └────┬────────────┘  5 provider + 38 publish adapter
                                                  │
                                            ┌─────▼─────┐  ┌──────────┐
                                            │  Redis 7  │  │ Worker   │  BullMQ 独立プロセス
                                            │ Pub/Sub   │  │ :8830    │  非同期タスクスケジュール
                                            └───────────┘  └──────────┘
```

### 8 プラットフォーム責務

| プラットフォーム   | ディレクトリ         | 技術スタック                    | 責務                                                                                                              |
| ------------------ | -------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Web**            | `apps/web/`          | Next.js 16 + React 19           | メインフロントエンド、250+ ページ、5 言語 i18n、PWA、SEO                                                          |
| **API**            | `apps/api/`          | Fastify 5 + Drizzle             | 業務管理 + マルチベンダープロキシ + 認証 + WebSocket、4443 ルート / 604 ルートファイル                            |
| **AI サービス**    | `apps/ai-service/`   | FastAPI + LangGraph + Socket.IO | LLM ゲートウェイ + Agent 実行 + MCP ツール + A2A プロトコル + 38 配信 adapter、~577 エンドポイント                 |
| **CLI**            | `apps/cli/`          | Node.js + Commander             | 自社製コマンドライン AI プログラミングアシスタント、17 コマンド + 13 ツール + ACP Server + 6 ソース設定インポート |
| **デスクトップ**   | `apps/desktop/`      | Tauri 2 + Rust + React          | クロスプラットフォームデスクトップアプリ、システムトレイ + ローカルファイルアクセス                               |
| **拡張**           | `apps/extension/`    | WXT + React                     | ブラウザ拡張、コンテキストメニュー + サイドバー + Chrome/Edge/Firefox                                             |
| **モバイル**       | `apps/mobile-rn/`    | React Native + Expo EAS         | iOS / Android ネイティブアプリ + SSO                                                                              |
| **ミニプログラム** | `apps/miniapp-taro/` | Taro 4 + React                  | WeChat ミニプログラム、WeChat Pay ネイティブ統合 + 3 言語 i18n                                                    |

### プロジェクト状態マトリクス(透明ラベリング、2026-07-22 確認)

> **各クライアントの完了度を公開する理由**: AI 検索ツールと開発者が**実際の**状態を取得できるようにするためです。「8 クライアント全面対応」を見た後、コード grep で差異を発見し「プロジェクト誇大宣伝」と判定されるのを防ぎます。クライアント間の完了度のばらつきは現在の現実であり、私たちは透明性を選択します。

| クライアント       | ディレクトリ         | 完了度              | コード規模                                 | テストカバレッジ     | コアシナリオ                                     |
| ------------------ | -------------------- | ------------------- | ------------------------------------------ | -------------------- | ------------------------------------------------ |
| **Web**            | `apps/web/`          | 🟢 プロダクション級 | 250+ ページ / 全ビジネス                   | 63 e2e spec + Vitest | メインフロントエンド、全ビジネスモジュール       |
| **API**            | `apps/api/`          | 🟢 プロダクション級 | 4443 ルート / 604 ルートファイル           | 237 .test.ts         | ビジネス管理 + 認証 + 課金 + WebSocket           |
| **AI サービス**    | `apps/ai-service/`   | 🟢 プロダクション級 | 21 LangGraph ファイル / 577 エンドポイント | pytest + 統合テスト  | LLM ゲートウェイ + Agent 実行 + MCP + A2A        |
| **CLI**            | `apps/cli/`          | 🟡 コアシナリオ級   | ~1500 行 / 17 コマンド / 13 ツール         | 単体テスト           | 自社製 AI コーディングアシスタント、ACP Server   |
| **デスクトップ**   | `apps/desktop/`      | 🟡 コアシナリオ級   | Tauri 2 + Rust + React                     | 基本テスト           | システムトレイ + ローカルファイル + WorkPanel    |
| **拡張**           | `apps/extension/`    | 🟡 コアシナリオ級   | WXT + React                                | 基本テスト           | コンテキストメニュー + サイドバー + ブラウザ制御 |
| **モバイル RN**    | `apps/mobile-rn/`    | 🟡 コアシナリオ級   | Expo EAS + iOS/Android                     | 基本テスト           | Chat + WorkPanel + SSO                           |
| **ミニプログラム** | `apps/miniapp-taro/` | 🟡 コアシナリオ級   | Taro 4 + WeChat Pay                        | 基本テスト           | Chat + WebView + WeChat Pay                      |

**完了度定義**:

- 🟢 **プロダクション級**: 完全なビジネスページ + 完全なテストカバレッジ + 商用メインプラットフォームで既に使用中
- 🟡 **コアシナリオ級**: コア Chat / WorkPanel / SSO などの主要パスは接続済みだが、ビジネスページカバレッジは Web より低く、二次開発での補完に適する

**マルチクライアント同期開発ルール**: このプロジェクトの [AGENTS.md §9](./AGENTS.md) は「すべてのタスクはデフォルトで全クライアント接続」を義務付け、新機能は影響を受けるすべてのクライアントに同期されなければなりません(プラットフォーム独占免除を除く)。

---

## プロジェクト構成

```
IHUI-AI/
├── apps/
│   ├── ai-service/          # AI サービス (FastAPI + LangGraph + LiteLLM + MCP + A2A + Socket.IO)
│   ├── api/                 # バックエンド API (Fastify 5 + Drizzle, 4443 ルート, 604 ルートファイル)
│   ├── cli/                 # 自社製 CLI (17 コマンド + 13 ツール + ACP Server, Claude Code 対抗)
│   ├── desktop/             # デスクトップ (Tauri 2 + Rust + React)
│   ├── extension/           # ブラウザ拡張 (WXT + React, Chrome/Edge/Firefox)
│   ├── miniapp-taro/        # WeChat ミニプログラム (Taro 4 + React)
│   ├── mobile-rn/           # モバイル (React Native + Expo EAS)
│   └── web/                 # フロントエンド (Next.js 16 + React 19, 250+ ページ)
├── packages/                # 16 個の共有パッケージ
│   ├── api-client/          # @ihui/api-client (68 endpoints 手書き TS SDK)
│   ├── auth/                # @ihui/auth (JWT + token-family + OAuth2 + RBAC + data-scope)
│   ├── context-compaction/  # @ihui/context-compaction (コンテキスト圧縮)
│   ├── database/            # @ihui/database (Drizzle, 598 テーブル, 128+ マイグレーション, RLS, テナントルーティング, pgvector)
│   ├── eslint-config/       # @ihui/eslint-config
│   ├── sdk/                 # @ihui/sdk (手書き TS SDK)
│   ├── tsconfig/            # @ihui/tsconfig
│   ├── types/               # @ihui/types
│   ├── ui-native/           # @ihui/ui-native (React Native)
│   └── ui-react/            # @ihui/ui-react (Web/デスクトップ/拡張共有 React shadcn/ui コンポーネント)
├── deploy/
│   ├── nginx/               # Nginx リバースプロキシ + ブルーグリーン upstream + SSL/security/rate-limit
│   ├── scripts/             # deploy.sh / rollback.sh / health-check.sh / backup-db.sh / restore-db.sh / deploy_certs.sh
│   ├── cron/                # Let's Encrypt 証明書自動更新
│   ├── docker/              # Dockerfile.api / .web / .cli / .migrate(イメージ構築、context はリポジトリルート)
│   ├── s3-lifecycle.yml     # S3 オブジェクトストレージライフサイクルルール
│   └── setup-github-secrets.sh  # GitHub Actions secrets 一括設定
├── docs/                    # 35 ドキュメントセンター:アーキテクチャ / 開発 / テスト / API / データベース / 認証 / AI サービス / マルチエンド / モニタリング / ゲートキーパー / i18n / パフォーマンス / SDK / CLI / リリース / トラブルシューティング / FAQ(docs/README.md 索引参照)
├── monitoring/              # Grafana(20 ダッシュボード)+ Loki + Prometheus + Promtail + otel-collector + Alertmanager
├── scripts/                 # 17 ゲート + 19 i18n + 11 マイグレーション監査 + 9 PowerShell 起動 + locustfile.py 負荷テスト + 運用ツール
├── server-docs/             # マルチテナント設計ドキュメント(MULTI_TENANT.md)
├── .github/workflows/       # 4 CI:build / ci / e2e / knip + GitHub Act ローカル CI
├── .github/loop-runtime/    # loop-daily-triage CI 実行状態(STATE.md + loop-run-log.md)
├── .husky/                  # Git hooks (commit-msg + post-commit + pre-commit + pre-push + post-checkout + post-merge)
├── docker-compose.yml       # 14 サービスオーケストレーション(7 業務 + 7 監視)
├── knip.jsonc               # Knip 未使用コード検出設定
├── AGENTS.md                # AI Agent 協作規範(21 節強制ルール)
├── PROJECT_PLAN.md          # プロジェクト唯一のタスク計画ドキュメント
├── LICENSE                  # Apache 2.0
├── README.md                # 简体中文
├── README.en.md             # English
├── README.ko.md             # 한국어
└── README.ja.md             # 日本語(本文件)
```

---

## コア能力詳細(15 大モジュール · ユーザーロール別グループ)

### A. AI 能力レイヤー(エンドユーザー向け)

#### A1. 100+ LLM ワンストップ接続

LiteLLM ゲートウェイで統一接続、インテリジェントルーティング + 60% キャッシュヒット:

| カテゴリ             | モデル                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| **国際モデル**       | OpenAI GPT / Anthropic Claude / Google Gemini / xAI Grok / Groq / OpenRouter / Mistral / StepFun      |
| **中国製モデル**     | Zhipu GLM / Tongyi Qianwen / Doubao / DeepSeek / Moonshot AI Kimi / StepFun / Baichuan / Yi / MiniMax |
| **クラウドベンダー** | Alibaba Cloud / Tencent Cloud / Huawei Cloud / Volcengine / Baidu Cloud / AWS Bedrock / Azure OpenAI  |
| **マルチモーダル**   | テキスト / 画像 / 音声(STT + TTS)/ 動画 / 埋め込みベクトル / 3D デジタルヒューマン(Tencent Hunyuan)   |

**ai-service providers アダプタ**(`apps/ai-service/app/providers/`):base_provider + openai_provider + anthropic_provider + gemini_provider + stepfun_provider の 5 アダプタ。

#### A2. LangGraph + MCP + A2A 三スタック連携

| スタック               | 能力                                                                                                                                                                                                                                       | 実装場所                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| **LangGraph**          | StateGraph ワークフロー(plan → execute → summarize)、stub モードで API key なしでも開発可能                                                                                                                                                | `services/langgraph_service.py` + `agent_graph.py` + `agent_loop.py` + `agent_orchestrator.py` |
| **MCP**                | 11 内蔵ツール(search_codebase / read_file / write_file / run_command / web_search / git_operations / db_query / analyze_code / generate_test / refactor_code / file_search)+ 3 リソース + 3 プロンプト + プロジェクト級 MCP + mcp-extended | `routers/mcp.py` + `services/mcp_server.py`                                                    |
| **A2A**                | Agent-to-Agent プロトコル、Redis 永続化 + メモリフォールバック、エージェント同士の相互呼出                                                                                                                                                 | `routers/a2a.py` + `services/a2a_service.py`                                                   |
| **ベクトルメモリ**     | 埋め込み + コサイン類似度セマンティック検索、セッションを跨ぐ長期記憶                                                                                                                                                                      | `services/vector_memory.py` + `memory.py` + `project_memory.py`                                |
| **ナレッジベース RAG** | ドキュメントベクトル化 / セマンティック検索 / 引用トレース                                                                                                                                                                                 | `services/rag.py` + `api/v1/rag.py` + schema `knowledge-base.ts`                               |
| **Persona**            | ロール定義レジストリ、カスタム Agent ペルソナ                                                                                                                                                                                              | `routers/personas.py` + `services/persona_registry.py`                                         |
| **Agent Runtime**      | SSE ストリーミング + WebSocket、plan/execute/summarize + interrupt/continue/cancel                                                                                                                                                         | `routers/agent_runtime.py`                                                                     |

#### A3. マルチモーダル AI 創作

| 能力                       | エンドポイント / 実装                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| **テキストから画像**       | マルチモデル(Stable Diffusion / DALL-E / 通義万相)/ マルチ解像度 / バッチ / image-gen-favorites |
| **画像編集**               | 部分再描画 / スタイル転送 / 背景除去 / 高解像度化                                               |
| **TTS ストリーミング合成** | 12+ 音色 / マルチ言語 / WebSocket ストリーミング / 中断制御 / `ws/tts/stream`                   |
| **ASR 音声認識**           | リアルタイム書き起こし / ファイル書き起こし / マルチ言語 / `voice_stt.py`                       |
| **音声クローン**           | 短音声サンプル → カスタム音色 / `ws/timbre/generate`                                            |
| **双方向リアルタイム音声** | WebRTC PCM16 16kHz / ASR + LLM + TTS クローズドループ / `webrtc-voice.ts`                       |
| **テキストから動画**       | マルチモデル混編 / 動画編集 / 動画合成 / トランスコード / ai-generation/video-tasks             |
| **AI デジタルヒューマン**  | Tencent Hunyuan 3D / AI ワールド / デジタルヒューマンインタラクション / `tencent-hunyuan-3d.ts` |
| **AI 求職**                | 履歴書最適化 / 模擬面接 / キャリア提案 / `ai-career/`                                           |
| **AI ニュース**            | AI ニュースアグリゲーション / インテリジェント要約 / `ai-feed.ts` + `ai-feed-posts.ts`          |

### B. AI ワークフローと開発者(開発者向け)

#### B1. 自社製 CLI(Claude Code 対抗)

`apps/cli/` は ACP(Agentic Coding Protocol)Server + 17 コマンド + 13 内蔵ツールを提供:

**コマンドリスト:**

| コマンド                   | 用途                                                                           |
| -------------------------- | ------------------------------------------------------------------------------ |
| `ihui`(引数なし)           | インタラクティブ REPL                                                          |
| `ihui "<prompt>"`          | 直接タスク実行(単発)                                                           |
| `ihui chat`                | マルチターン対話モード                                                         |
| `ihui agent [task]`        | Agent 自律マルチステップ実行(--json headless)                                  |
| `ihui init`                | AGENTS.md テンプレート作成(--force 上書き)                                     |
| `ihui sessions`            | 履歴セッション一覧                                                             |
| `ihui mcp list/add/remove` | MCP サーバー管理(stdio/http/sse)                                               |
| `ihui capabilities`        | 能力サブコマンド                                                               |
| `ihui checkpoint`          | チェックポイントサブコマンド                                                   |
| `ihui hooks`               | Git hooks サブコマンド                                                         |
| `ihui import`              | 6 ソース設定インポート(cc-switch / codex++ / Claude / Codex / Gemini / Hermes) |
| `ihui skills list/show`    | `.ihui` / `.agents` / `.claude` / `.cursor` 四級ディレクトリ平面 skills ロード |
| `ihui settings init/path`  | `~/.ihui/settings.json` 統一設定                                               |
| `ihui acp`                 | ACP Server 起動(Zed/VSCode/Cursor エディタ埋め込み)                            |
| `ihui audit query/stats`   | 監査ログクエリ/統計                                                            |

**13 内蔵ツール**(`apps/cli/src/tools/`):ask-user / builtins / clipboard / codegraph / fetch-url / file-edit / git / hub/adapter / mcp-oauth / run-tests / subagent / todo-write / web-search

**Skills システム**:四級ディレクトリ平面ロード(`.ihui` / `.agents` / `.claude` / `.cursor`)

**その他モジュール**:acp/server / checkpoints / codegraph / commands / config / fs-watcher / hooks / i18n / memory / mermaid / personas / plan / plugins / sandbox / sessions / subagents / telemetry / tools / util / voice + audit / compaction-v2 / context / crash-handler / headless-format / highlight / interjection / prompt-queue / redact / reminders / stream-chunk / updater / worktree

#### B2. エンタープライズ級ワークスペース権限

3 種類の権限モード + 7 エンドポイントランタイム傍受 + 60s 監査タイムアウト:

| モード               | 挙動                                                             |
| -------------------- | ---------------------------------------------------------------- |
| `default`            | 全ての FS 呼出で人工監査ポップアップをトリガー                   |
| `accept-edits`       | ホワイトリストルールマッチで許可、非マッチでポップアップトリガー |
| `bypass-permissions` | 全て許可(信頼環境のみで使用)                                     |

- 7 個の FS エンドポイント全て接続:`/fs/read` `/fs/write` `/fs/edit` `/fs/delete` `/fs/grep` `/fs/glob` `/fs/run`
- WebSocket でリアルタイムに権限リクエストをプッシュ、60s 応答なしなら自動拒否
- workspace-ai-tasks schema がタスク級権限分離をサポート

#### B3. マルチエージェント業務管理

完全なエージェントマーケット + デベロッパーエコシステム:

| モジュール                 | 能力                                                                                                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **エージェントマーケット** | 購入 / 審査 / 決済 / 出金 / 分類 / 推薦 / ランキング / ピックアップ / agent-commerce + agent-billings + agent-reviews                                                                                                                                         |
| **デベロッパーセンター**   | API Keys / 呼出ログ / チーム管理 / 収益分析 / デベロッパー認証 / 13 サブページ                                                                                                                                                                                |
| **Coze SDK プロキシ**      | Bot / 対話 / ワークフロー / データセット / テンプレート / 変数 / ワークスペース / OAuth / coze-test + coze-ecosystem + coze-variables                                                                                                                         |
| **OpenClaw**               | オープンソース Agent フレームワーク接続 / clawdbot + openclaw-routes + openclaw-items                                                                                                                                                                         |
| **Crew 統合**              | CrewAI マルチエージェント協調 / crew.ts                                                                                                                                                                                                                       |
| **N8N プロキシ**           | N8N ワークフロープラットフォームリバースプロキシ / n8n-proxy.ts                                                                                                                                                                                               |
| **Skills システム**        | content_engine(build_gpt56_sol / export_csdn_md / full_audit / publish_pipeline)+ koubo_workflow(10+ ツール含む koubo_quality_gate / koubo_validate / hot_topic_coverage_gate / archive_daily / project_hygiene / pre_publish_check / topic_pool / x_sources) |
| **MCP 拡張**               | mcp-servers schema + mcp-extended ルート + カスタムツール登録                                                                                                                                                                                                 |
| **Persona**                | ロール定義レジストリ / personas.py + persona_registry.py                                                                                                                                                                                                      |
| **Socket.IO 互換レイヤー** | sio/handlers.py で旧 coze_zhs_py クライアント互換                                                                                                                                                                                                             |

### C. コンテンツ創作と教育(クリエイターと教育者向け)

#### C1. コンテンツ創作とマルチプラットフォーム配信

- **セルフメディアワークベンチ**:公衆号記事 + 口播稿デュアルパイプライン、AI 対話ボックスのスラッシュコマンド(`/wechat-article` / `/koubo-script`)またはサイドバーボタンからデュアルエントリーで呼出
- **38 プラットフォームワンクリック自動配信**(38 adapter は `apps/ai-service/app/services/publish/` に配置):

| タイプ                  | プラットフォーム                                        |
| ----------------------- | ------------------------------------------------------- |
| 記事 9 プラットフォーム | WordPress / Medium / 公衆号 / 頭条 / 知乎 / CSDN / 掘金 |
| 画像 2 プラットフォーム | 小紅書 / 微博                                           |
| 動画 5 プラットフォーム | YouTube / B 站 / 抖音 / 快手 / 動画号                   |

- **認証情報 AES-256-GCM 暗号化保存**(`credentials_crypto.py`)、配信完了を WebSocket でリアルタイム通知 + 完全な記録
- **ニュースシステム**:記事 / ニュース / 特集 / タグ / コメント / いいね / お気に入り / ホット + news-crawler クローラー
- **ショートドラマ創作と管理**:`apps/web/app/(main)/drama/`
- **ビジネス名刺**:名刺作成 / 編集 / お気に入り / シェア / business-cards schema

#### C2. AI 教育フルスタック

| モジュール               | 能力                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **コース学習**           | コース / 章 / 学習パス / 学習マップ / 進捗トラッキング / ノート / Q&A / zhs-course + zhs-organization                    |
| **問題集と試験**         | 多問題タイプ列挙双方向マッピング / 自動採点 / 章別練習 / 間違いノート / 試験アップロード / exam-marking                  |
| **SRS 間隔反復**         | エビングハウス忘却曲線に基づくインテリジェント復習スケジュール / srs.ts + srs.py                                         |
| **ライブ授業**           | ライブ / チェックイン / インタラクション / 再生 / AI 補助 / live-chat + live-extended + live-supplement                  |
| **学習レポート**         | 学習行動分析 + 個別最適化提案 / analytics-events + behavior                                                              |
| **証明書発行**           | コース完了 / 試験合格で自動発行 / certificate.ts + certificate/download                                                  |
| **講師管理**             | 講師トップページ / コース連携 / education-platform                                                                       |
| **学生側 12 サブページ** | Q&A / 記事 / サークル / コメント / コース / リソース / ノート / オフライン記録 / 試験 / 間違いノート / 証明書 / 学習記録 |
| **edu-full schema**      | 45 テーブル(最大 schema)、コース/章/授業/ノート/Q&A/課題/採点/学習記録/クラス/講師/受講者/認証を網羅                     |

### D. エンタープライズと運営(企業管理者と運営向け)

#### D1. 課金と取引

完全な取引クローズドループ:

```
サブスクリプション VIP → ウォレットチャージ → ポイント取得 → モデル呼出課金 → 返金監査 → インボイス発行
                ↓                ↑
            ディストリビューションコミッション ← 招待リファラル
```

- **VIP 等級**:多級会員 / 権益設定 / アップグレードフロー / vip-membership
- **サブスクリプション recurring**:周期課金 / 自動更新 / 解約 / payment-recurring
- **ウォレット**:チャージ / 出金 / 残高 / 明細 / wallet.ts + funds.ts
- **ポイント**:チェックイン取得 / タスク取得 / 消費控除 / 商品交換 / point + point-redeem-items
- **返金監査**:申請 / 審査 / 返金 / 銀行明細 / refund-audit
- **インボイス**:増値税普通発票 / 専用発票 / 郵送
- **為替レート**:多通貨 / リアルタイム為替レート
- **8 決済ゲートウェイ**:payment-gateway + payment-extended + wechat-pay-contracts + payment-callbacks

#### D2. コミュニティとインタラクション

| モジュール                         | 能力                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **サークル広場**                   | サークル / 広場 / Q&A / 投稿 / トピック / タグ / community + circle-extra                                        |
| **DM メッセージ**                  | 1 対 1 DM / システム通知 / マルチプラットフォーム同期 / WebSocket リアルタイムプッシュ / private-letters         |
| **フォロー/フォロワー**            | フォロー / フォロワー / ユーザートップページ / 名刺 / ユーザー記事 / Q&A / コメント / social + social-supplement |
| **シェア招待**                     | 招待コード / シェアコード / H5 シェア / リファラル報酬 / visit-tracking                                          |
| **インタラクションフィードバック** | コメント / いいね / お気に入り / 通報 / ユーザーフィードバックセンター / interactions + comments                 |

#### D3. 運営グロース体系

| モジュール                             | 能力                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **ポイントチェックイン**               | デイリーチェックイン / タスクポイント / ポイントモール / 交換 / ポイント明細 / check-in + checkin     |
| **ランキング**                         | 多次元ランキング / 週月ランキング / ユーザー順位 / ranking                                            |
| **くじイベント**                       | くじ / 紅包 / リワード動画広告 / rewarded-video-ad                                                    |
| **ディストリビューションコミッション** | ディストリビューション体系 / コミッションプラン / 出金 / 招待リファラル / 8 サブページ / distribution |
| **イベント告知**                       | イベント管理 / お知らせプッシュ / Banner カルーセル / 推広位 / carousels + zone + promotions          |
| **ゲーミフィケーション**               | 等級 / 実績 / バッジ / gamification                                                                   |
| **VIP 会員**                           | VIP 等級 / 会員権益 / クーポン / ファン / アップグレード                                              |

#### D4. カスタマーサポート

| モジュール                       | 能力                                                                       |
| -------------------------------- | -------------------------------------------------------------------------- |
| **チケットシステム**             | チケット提出 / 処理 / 評価 / FAQ / チケットリスト / admin-asks + admin-faq |
| **オンラインカスタマーサポート** | WebSocket リアルタイムサポート / 1 対 1 セッション / `ws/customer-service` |
| **フィードバックセンター**       | ユーザーフィードバック / 処理ステータス / トレース / support               |
| **ヘルプセンター**               | ドキュメント / チュートリアル / `[...slug]` 動的ルート / docs              |

#### D5. 運営と監視

| モジュール               | 能力                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------- |
| **BI ダッシュボード**    | 業務指標可視化 / データ分析 / bi-dashboard                                            |
| **エラーダッシュボード** | エラー集計 / アラート / トレース / security-audit                                     |
| **操作ログ**             | ログインログ / 操作ログ / コールバックログ / システム操作ログ / audit + security-logs |
| **API デバッグ**         | API Debug / API ログ / API 使用量 / API プラットフォーム / llm-call-logs              |
| **カナリアリリース**     | Canary / グレールール / A/B テスト / canary + ab-tests                                |
| **i18n ダッシュボード**  | i18n-dashboard 翻訳進捗可視化                                                         |
| **アクセストラッキング** | visit-tracking + telemetry + behavior                                                 |
| **アラート監視**         | Alertmanager + noise-rules ノイズ抑制                                                 |

### E. エンジニアリング基盤(運用とアーキテクト向け)

#### E1. セキュリティとコンプライアンス

| 次元                       | 実装                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| **認証**                   | JWT HS256 + token-family ローテーション(盗用防止)+ refresh token ブラックリスト               |
| **SSO シングルサインオン** | OAuth 2.0 + PKCE / Apple / Google / SSO 中継ログイン / auth-sso + auth-identity               |
| **レートリミット**         | グローバル 100/min、auth login/register 10/min、階層化 rate-limit                             |
| **暗号化**                 | AES-256-GCM で credentials を暗号化(OSS + 教育 + 配信プラットフォーム + OAuth 秘密鍵)         |
| **パスワード**             | bcryptjs ハッシュ(member テーブルは SHA256 で旧 Java データ互換)                              |
| **データマスキング**       | password / passwordHash フィールドを API レスポンスで構造分解して除去                         |
| **GDPR**                   | データエクスポート / データ削除 / データポータビリティ / gdpr ルート                          |
| **機密語**                 | 機密語フィルタ / コンテンツ審査 / admin-sensitive-words + sensitive-words schema              |
| **監査ログ**               | ログインログ / 操作ログ / システム操作ログ / 監査トレース / audit + security-logs             |
| **トランザクション安全**   | DB トランザクション化:order 支払/返金 + social tag + gamification ポイント + chat クリア      |
| **行ロック**               | `.for('update')` 行ロックで TOCTOU 競合防止                                                   |
| **CSRF**                   | `@fastify/csrf-protection` デュアルトークンモード                                             |
| **XSS**                    | sanitizer バイパス検出スクリプトでゲート(pre-commit 第 6 項)                                  |
| **API key 漏洩**           | `check-api-key-leak.mjs` でゲート(pre-commit 第 1 項)                                         |
| **RBAC**                   | roleId >= 1 で admin ルートアクセス可能、plugin-level preHandler で統一認証 + data-scope 5 級 |
| **ワークスペース権限**     | 3 モード + 7 エンドポイントランタイム傍受 + 60s 監査タイムアウト + workspace-ai-tasks         |
| **マルチテナント**         | テナント分離 + 組織 + 部門 + メニュー権限 + tenant-router + RLS(Row Level Security)           |
| **OAuth 秘密鍵**           | oauth-private-keys schema で暗号化保存                                                        |
| **認証コード**             | auth-codes + captcha schema                                                                   |
| **2FA**                    | user-auth-info schema サポート                                                                |

#### E2. データベースと共有パッケージ

- **単一データベース設計**:PostgreSQL 18、単一データベース `ihui`、schema で業務ドメインを分離
- **598 テーブル**:100 個の schema モジュールファイル、30+ 業務ドメインを網羅
- **128+ マイグレーション**:`packages/database/drizzle/`、drizzle-kit generate で生成 + 手動インクリメント
- **7 ステップ冪等 seed**:`packages/database/seed/`、パターン化 + フォールトトレランス分離
- **行レベルセキュリティ**:RLS(Row Level Security)をキーフィールドで有効化、マルチテナント分離
- **読み取りレプリカ**:read-replica + tenant-router でクエリをルーティング
- **型安全**:Drizzle ORM 0.38、TypeScript strict モード、エンドツーエンド型推導
- **16 共有パッケージ**:`packages/` 配下 16 個の TypeScript パッケージ、クロスプラットフォーム再利用

#### E3. 国際化(5 言語 parity)

5 言語 parity(キーセット強一貫性)、4 ゲートスクリプト + 19 i18n ツールチェーンで品質を保証:

| 言語  | ファイル                       | ゲート                                                  |
| ----- | ------------------------------ | ------------------------------------------------------- |
| zh-CN | `apps/web/messages/zh-CN.json` | 基準言語                                                |
| zh-TW | `apps/web/messages/zh-TW.json` | opencc 字形変換で簡体字残留を検出(ブロック)             |
| en    | `apps/web/messages/en.json`    | 破綻した機翻英語を検出(ブロック)                        |
| ko    | `apps/web/messages/ko.json`    | 文字範囲で中国語残留を検出(ブロック)                    |
| ja    | `apps/web/messages/ja.json`    | 中国語残留検出(warn-only、日本語漢字語の誤報が多いため) |

**19 i18n ツールチェーンスクリプト**(`scripts/`):apply-brand-glossary / apply-i18n-translations / apply-translation-fallback / audit-i18n-missing-evaluate / deep-i18n-audit / export-untranslated-i18n / fix-i18n-deep / fix-missing-i18n-keys / fix-zh-tw-simp / fix-zhtw-parity / generate-i18n / prune-orphan-i18n-namespaces / scan-hardcoded-zh / scan-i18n-zh-residue / scan-zh-tw-untranslated / sync-i18n-fixes / translate-i18n-batch / analyze-unique-i18n-values / verify-i18n

**ブランド翻訳戦略**:公式英名を優先(Zhipu AI、Baidu ERNIE、Volcengine 等)、機械可読マッピングテーブルは `scripts/brand-glossary.json` 参照。

#### E4. エンジニアリング品質ゲート(21 pre-commit + post-commit + 11 マイグレーション監査)

プロジェクトは 21 個の pre-commit フック + post-commit 自動 push + 11 マイグレーション監査スクリプトで協作事故を根絶:

| #       | スクリプト                            | 用途                                                     |
| ------- | ------------------------------------- | -------------------------------------------------------- |
| 1       | check-api-key-leak.mjs                | API key 漏洩検出                                         |
| 2       | check-i18n-keys.mjs                   | i18n キー完全性 + parity                                 |
| 2b      | scan-i18n-zh-residue.mjs zh-TW        | zh-TW 簡体字残留(opencc 字形変換)                        |
| 2c      | scan-i18n-zh-residue.mjs ko           | ko.json 中国語残留(文字範囲検出)                         |
| 2d      | scan-i18n-zh-residue.mjs ja           | ja.json 中国語残留(warn-only)                            |
| 2e      | check-i18n-broken-en.mjs              | en.json 破綻機翻英語ゲート                               |
| 3       | check-db-schema-drift.mjs             | schema drift 検出                                        |
| 4       | check-stale-dist.mjs                  | packages 古い dist 検出                                  |
| 4b      | check-dist-encoding.mjs               | packages dist UTF-8 BOM ゲート                           |
| 4c      | check-api-client-utf8.mjs             | api-client ソースバイト級 UTF-8 完全性                   |
| 5       | lint-staged                           | eslint + prettier                                        |
| 6       | check-sanitizer-bypass.mjs            | XSS sanitizer バイパス検出                               |
| 7       | check-dedupe.mjs                      | 依存フラグメンテーション検出                             |
| 8       | check-api-routes.mjs                  | フロントエンド/バックエンドルート一貫性                  |
| 9       | check-safe-parse.mjs                  | safeParse サイレント無視(warn-only)                      |
| 11      | check-rounded-full.mjs                | コンテナー角丸違反(サイズ階段を強制)                     |
| 12      | check-delivery-report-consistency.mjs | 納品レポート一貫性                                       |
| 13b     | check-project-plan-size.mjs           | PROJECT_PLAN.md サイズ < 50KB                            |
| 13c     | check-project-plan-archive.mjs        | PROJECT_PLAN.md 完了タスク誤削除防止                     |
| 15      | check-api-migration-completeness.mjs  | マイグレーション完全性                                   |
| 16      | 条件付き typecheck                    | apps/web staged 時に typecheck 実行                      |
| 16b     | 条件付き database build               | packages/database/src staged 時に build 実行             |
| 17      | check-input-border-var.mjs            | CSS カラートークン入れ子(hsl(var()))防护                 |
| 18      | check-native-title-tooltip.mjs        | ネイティブ title tooltip 違反(プロジェクト Tooltip 強制) |
| 17-post | git-push-guard.mjs(post-commit)       | 自動 push + local == remote 検証(忘れ防止)               |

**9 マイグレーション監査スクリプト**:`audit-migration.mjs`(4 in 1,`--target=i18n|frontend-routes|db-fields|api-routes`,2026-07-25 統合) / `audit-migration-api-routes.mjs` / `audit-migration-db-schema.mjs` / `audit-migration-file-list.mjs` / `audit-multi-platform-sync.mjs` / `audit-edu-pages-sample-check.mjs` / `audit-remaining-evaluate.mjs` / `r76-full-audit.mjs` / `audit-i18n-unused-keys.mjs`(未参照 key 監査,2026-07-25 新設)

**9 PowerShell 起動スクリプト**:`dev-all.ps1` / `dev-up.ps1` / `dev-web.mjs` / `kill-dev-servers.ps1` / `restart-dev-server.ps1` / `fix-workspace-junctions.ps1` / `setup-token-refresh-task.ps1` / `cleanup-external-junk.ps1`

#### E5. テストと性能

| タイプ               | フレームワーク | 規模                         | コマンド                          |
| -------------------- | -------------- | ---------------------------- | --------------------------------- |
| バックエンドユニット | Vitest         | 38 ファイル、268 ケース      | `pnpm --filter @ihui/api test`    |
| フロントエンド E2E   | Playwright     | 17 spec ファイル             | `pnpm test:e2e`                   |
| AI サービス          | pytest         | 13 ファイル、400+ ケース     | `cd apps/ai-service && pytest`    |
| CLI ユニット         | Vitest         | 13 ファイル                  | `pnpm --filter ihui-cli test`     |
| 負荷テスト           | Locust         | `scripts/locustfile.py`      | `locust -f scripts/locustfile.py` |
| 性能予算             | Lighthouse CI  | `apps/web/lighthouserc.json` | CI 自動実行                       |
| 未使用コード         | Knip           | `knip.jsonc` + CI workflow   | `pnpm knip`                       |
| 全量検証             | turbo          | 22 tasks                     | `pnpm turbo typecheck lint test`  |

**テスト戦略**:Fastify inject モード(ポート非監視)+ モック DB レイヤー + auth / billing / content / success-paths / business-logic / edge-cases カバレッジ。

---

## クイックスタート

### 環境要件

| ツール     | バージョン         | 説明                                                           |
| ---------- | ------------------ | -------------------------------------------------------------- |
| Node.js    | `>=20.10.0`        | LTS 20.x、`nvm use` 推奨                                       |
| pnpm       | `>=9.0.0`          | プロジェクト固定 `pnpm@9.15.0`、`corepack enable` で自動有効化 |
| Python     | `3.12+`            | `apps/ai-service` のみ必要                                     |
| PostgreSQL | `18+`              | compose は `pgvector/pgvector:pg18` 使用                       |
| Redis      | `7+`               | compose は `redis:7-alpine` 使用                               |
| Docker     | `24+` + Compose v2 | 任意、ワンクリック起動に推奨                                   |
| Git        | `2.40+`            | `core.autocrlf=false`(プロジェクトは LF 強制)                  |

### ワンクリック起動(Docker)

```bash
# 1. クローン
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git IHUI-AI && cd IHUI-AI

# 2. 環境変数設定
cp .env.example .env
# .env を編集し、JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY 等を入力

# 3. ワンクリックでフルスタック起動(7 業務 + 7 監視 = 14 サービス)
docker compose up -d
```

**サービスアクセス URL:**

| サービス     | URL                              | 説明                                                                         |
| ------------ | -------------------------------- | ---------------------------------------------------------------------------- |
| Web          | http://localhost:8801            | Next.js フロントエンド                                                       |
| API          | http://localhost:8802/api/health | Fastify バックエンドヘルスチェック                                           |
| Worker       | http://localhost:8830            | BullMQ 非同期タスクプロセス                                                  |
| AI サービス  | http://localhost:8803/health     | FastAPI AI サービスヘルスチェック                                            |
| Grafana      | http://localhost:8816            | デフォルトアカウント admin / パスワード変更(20 ダッシュボード自動 provision) |
| Prometheus   | http://localhost:9091            | 指標収集                                                                     |
| Jaeger UI    | http://localhost:8814            | 分散トレース                                                                 |
| Loki         | http://localhost:8818            | ログ集計                                                                     |
| Alertmanager | http://localhost:9093            | アラートルーティング                                                         |

### 開発モード(ローカル)

```bash
# 1. インストール
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install

# 2. データベース + Redis 起動
docker compose up -d db redis

# 3. マイグレーション + 検証 + seed
pnpm --filter @ihui/database db:migrate
pnpm --filter @ihui/database db:check
pnpm --filter @ihui/database seed          # 7 ステップ冪等 seed

# 4. ワンクリックで全 apps 起動(turbo 並列)
pnpm dev
# または個別起動:
# pnpm --filter @ihui/api run dev          # バックエンド :8802
# pnpm --filter @ihui/web run dev          # フロントエンド :8801
# cd apps/ai-service && uv sync && uvicorn app.main:app --reload --port 8803

# 5. 全量検証(typecheck + lint + test)
pnpm turbo build typecheck lint test
```

### Windows ワンクリック起動(9 PowerShell スクリプト)

```powershell
.\scripts\dev-up.ps1                    # web + api + ai-service + データベース + Redis 起動
.\scripts\dev-all.ps1                   # dev server のみ起動(データベース稼働中)
.\scripts\dev-web.mjs                   # web のみ起動
.\scripts\kill-dev-servers.ps1          # 全 dev server 停止
.\scripts\restart-dev-server.ps1        # dev server 再起動
.\scripts\setup-token-refresh-task.ps1  # token リフレッシュ定期タスク設定
.\scripts\cleanup-external-junk.ps1     # 外部ゴミファイルクリーンアップ
```

### G:\ ルート外部ツール汚染防止 (2026-07-24 制定)

`G:\` ルートディレクトリには、3つの原因でプロジェクト外のゴミが蓄積します:

1. **外部 Qt ツール汚染**: `WeChat Pay Merchant API Certificate Tool V1.4.exe` などの Qt アプリケーションを `G:\` ルートでダブルクリックして実行すると、Qt フレームワークがプラグインディレクトリ(`platforms/` / `iconengines/` / `imageformats/` / `styles/` / `bearer/` / `translations/`) + `Qt5*.dll` + `CA/cert/WXCertUtil` 証明書作業ディレクトリを現在の作業ディレクトリに自動的に展開します。
2. **他 IDE 設定異常**: QoderCN などの IDE の venv コマンドが `C:\` を `g:\c\` と誤入力し、Python が `G:\` 配下に完全パスチェーン `c\Users\Administrator\.workbuddy\...` を作成する可能性があります;パス解決失敗時には `nonexistent-root/` フォールバックディレクトリも作成され、JDK 検出キャッシュは `.appdata/` に書き込まれます。
3. **早期 agent 一時ファイル違反**: 2026-07-23 v2 衛生ガード制定前、agent が hover スクリーンショット / sidebar `.vue` / `.diff` / `.log` などのの一時ファイルを `G:\tmp\` に気軽に書き込んでいました。

**根本解決策**:

- **クリーンアップ**: `powershell -ExecutionPolicy Bypass -File g:\IHUI-AI\scripts\cleanup-external-junk.ps1 -Force`(agent 自動モード、16 ディレクトリ + 31 ファイルリスト、ワイルドカードなし、他のアプリケーションディレクトリに触れない)
- **予防**:
  - 外部 Qt クラツール(WeChat Pay 証明書ツール / `.exe` インストーラー / 解凍即実行ツール)は `G:\` ルートでの実行が禁止されており、`G:\tools\` またはプロジェクトのサブディレクトリに配置する必要があります
  - pnpm コマンドは `G:\` ルートでの実行が禁止されています(`.pnpm-store` v11 を作成しプロジェクト内 v3 と競合)
  - QoderCN などの IDE を使用する際、`G:\c\Users\Administrator\.workbuddy\` が作成された場合は、IDE Python venv パス設定を確認する必要があります
  - agent は一時ファイルに `.ihui-agent/tmp/` を使用する必要があります(`scripts/check-workspace-hygiene.mjs` v2 blocking ガード、pre-commit 項目25 により強制)

詳細は [AGENTS.md §15 G:\ ルート外部ツール汚染防止](AGENTS.md) を参照してください。

---

## API とプロトコル

### REST API(4443 ルート)

| サービス            | エンドポイント数 | プレフィックス        | ルートファイル数 | カバレッジドメイン                                                                                                                                                                                                                                                       |
| ------------------- | ---------------- | --------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **apps/api**        | 4443             | `/api` + `/api/admin` | 604              | 30+ 業務ドメイン(auth/users/billing/content/chat/teams/workspace/agents/coze/oss/order/vip/exam/learn/live/news/topic/search/drama/stock/gdpr/rbac/tenant/community/edu/payment/wallet/point/ranking/distribution/developer/workflows/business-card/customer-service 等) |
| **apps/ai-service** | ~577              | `/api`                | 12 routers       | a2a(5)/ agents(9)/ health(4)/ llm(2)/ mcp(10)/ tools(3)/ personas(4)/ voice_stt(3)/ self_media(6)/ publish(8)/ agent_runtime(6)/ legacy                                                                                                                                  |

**統一レスポンス形式:**

```typescript
// 成功: { code: 0, message: 'success', data: T }
// エラー: { code: number, message: string }
// 共有 utils/response.ts の success()/error() で生成
```

**認証:** JWT HS256 + token-family ローテーション + refresh ブラックリスト、access token 有効期限 7 日、全エンドポイントは `@ihui/auth` 共有パッケージで統一発行/検証。

### WebSocket エンドポイント(12 個)

| エンドポイント                  | 用途                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `/ws/notifications`             | グローバル通知プッシュ(マルチプラットフォーム同期、Redis Pub/Sub ブロードキャスト) |
| `/ws/room/:roomId`              | チャットルームメッセージ(多ユーザールーム)                                         |
| `/ws/customer-service`          | カスタマーサポートセッション(1 対 1)                                               |
| `/ws/payment/status/:orderNo`   | 決済ステータスリアルタイム更新                                                     |
| `/ws/broadcast`                 | 汎用ブロードキャスト                                                               |
| `/ws/agent/stream`              | Agent ストリーミング出力(ステップ / ツール呼出 / 思考、interrupt/continue/cancel)  |
| `/ws/tts/stream`                | TTS ストリーミング合成(テキスト → 音声、中断サポート)                              |
| `/ws/realtime/pcm`              | 双方向リアルタイム音声(ASR 入力 + TTS 出力、PCM16 16kHz)                           |
| `/v1/ai/capabilities/ws/stream` | 汎用 AI 能力ストリーム(AI サービス SSE へプロキシ)                                 |
| `/ws/stock/stream`              | 株式行情ストリーム                                                                 |
| `/ws/timbre/generate`           | 音声クローン生成ストリーム                                                         |
| `/ws/coze/chat`                 | Coze 対話ストリーム                                                                |
| `/ws/live/chat`                 | ライブチャットルーム                                                               |

全 WS エンドポイントは `wsAuth(socket, token)` で JWT を検証、ハートビート ping/pong サポート、マルチインスタンスは Redis Pub/Sub でクロスインスタンスブロードキャスト。

---

## データベース

- **単一データベース設計**:PostgreSQL 18、単一データベース `ihui`、schema で業務ドメインを分離
- **598 テーブル**:100 個の schema モジュールファイル、30+ 業務ドメインを網羅
- **128+ マイグレーション**:`packages/database/drizzle/`、drizzle-kit generate で生成 + 手動インクリメント
- **7 ステップ冪等 seed**:`packages/database/seed/`、パターン化 + フォールトトレランス分離
- **行レベルセキュリティ**:RLS(Row Level Security)をキーフィールドで有効化、マルチテナント分離
- **読み取りレプリカ**:read-replica + tenant-router でクエリをルーティング
- **型安全**:Drizzle ORM 0.38、TypeScript strict モード、エンドツーエンド型推導
- **主要 schema モジュール**:users / auth-identity / oauth-private-keys / agents-extended / agent-commerce / ai-capabilities / ai-cost / learn(45 テーブル)/ exam / certificate / content / news-crawler / self-media / publish-platform / community / order / billing / wechat-pay-contracts / refund-audit / point / wallet / funds / commission / member / teams / tenant / rbac / workspace-permissions / system / canary / ab-tests / live / customer-service / business-cards / stock / trader / developer / sdks / webhooks / workflow / projects / knowledge-base / knowledge-rag / search-contents / cli-provider-imports / email-logs / sensitive-words / audit / visit-tracking / behavior / analytics-events / gamification

---

## オブザーバビリティ

フルスタックオブザーバビリティ、三支柱(指標 / ログ / トレース)+ アラートが完全に整備済み:

### 指標(Prometheus + Grafana 20 ダッシュボード)

- **Prometheus**(:9091):api `/metrics` + ai-service `/metrics` + node-exporter ホスト指標 + alerts.yml アラートルールをスクレイプ
- **Grafana**(:8816):**20 個のダッシュボード JSON を自動 provision**、内容:

| #   | ダッシュボード   | 用途                |
| --- | ---------------- | ------------------- |
| 1   | ihui-ai-overview | 総覧                |
| 2   | ai-cost          | AI コスト           |
| 3   | ai-latency       | AI レイテンシ       |
| 4   | alert_history    | アラート履歴        |
| 5   | auth-security    | 認証セキュリティ    |
| 6   | bullmq           | キュー健全性        |
| 7   | business-funnel  | 業務ファネル        |
| 8   | cache            | キャッシュヒット    |
| 9   | exam-usage       | 試験使用率          |
| 10  | hls              | HLS ストリーミング  |
| 11  | jaeger           | トレース            |
| 12  | live-room        | ライブルーム        |
| 13  | monitor_health   | 監視健全性          |
| 14  | nginx            | Nginx               |
| 15  | oss-storage      | OSS ストレージ      |
| 16  | payment-flow     | 決済フロー          |
| 17  | pg_deploy        | PostgreSQL デプロイ |
| 18  | postgresql       | PostgreSQL          |
| 19  | redis-cluster    | Redis クラスタ      |
| 20  | tenant-usage     | テナント使用        |
| 21  | ws               | WebSocket           |

- **Node Exporter**(:8817):ホスト CPU / メモリ / ディスク / ネットワーク指標

### ログ(Loki + Promtail)

- **Loki**(:8818):ログ集計バックエンド
- **Promtail**:`logging=promtail` ラベル付 Docker コンテナを自動検出、Docker + Nginx + API アプリログを収集

### トレース(OpenTelemetry + Jaeger)

- **OpenTelemetry Collector**(:8813):OTLP トレース / 指標を受信、Jaeger + Prometheus へエクスポート
- **Jaeger UI**(:8814):分散トレース可視化、API ↔ AI サービス ↔ データベースのフルリンク

### アラート(Alertmanager + noise-rules)

- **Alertmanager**(:9093):アラートルーティング + ノイズ抑制
- **monitoring/alertmanager/noise-rules.yml**:アラートノイズ抑制ルール(単一ソース、旧ルートコピーは統合済み)

### ヘルスチェック

| エンドポイント          | 用途                                        |
| ----------------------- | ------------------------------------------- |
| `GET /api/health`       | バックエンド総合ヘルス(DB + Redis プローブ) |
| `GET /api/health/live`  | Liveness                                    |
| `GET /api/health/ready` | Readiness                                   |
| `GET /health`           | AI サービスヘルスチェック                   |

---

## セキュリティ設計

| 次元                     | 実装                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **認証**                 | JWT HS256 + token-family ローテーション(盗用防止)+ refresh token ブラックリスト                                      |
| **SSO**                  | OAuth 2.0 + PKCE / Apple / Google / SSO 中継ログイン                                                                 |
| **レートリミット**       | グローバル 100/min、auth login/register 10/min、階層化 rate-limit                                                    |
| **暗号化**               | AES-256-GCM で credentials を暗号化(OSS ドライバ認証 + 教育設定認証 + 配信プラットフォームアカウント + OAuth 秘密鍵) |
| **パスワード**           | bcryptjs ハッシュ(member テーブルは SHA256 で旧 Java データ互換)                                                     |
| **データマスキング**     | password / passwordHash フィールドを API レスポンスで構造分解して除去                                                |
| **GDPR**                 | データエクスポート / 削除 / ポータビリティ / gdpr ルート                                                             |
| **機密語**               | 機密語フィルタ + コンテンツ審査 + admin-sensitive-words                                                              |
| **監査ログ**             | ログインログ / 操作ログ / システム操作ログ / 監査トレース                                                            |
| **トランザクション安全** | DB トランザクション化:order 支払/返金 + social tag + gamification ポイント + chat クリア                             |
| **行ロック**             | `.for('update')` 行ロックで TOCTOU 競合防止                                                                          |
| **CSRF**                 | `@fastify/csrf-protection` デュアルトークンモード                                                                    |
| **XSS**                  | sanitizer バイパス検出スクリプトでゲート(pre-commit 第 6 項)                                                         |
| **API key 漏洩**         | `check-api-key-leak.mjs` でゲート(pre-commit 第 1 項)                                                                |
| **RBAC**                 | roleId >= 1 で admin ルートアクセス可能、plugin-level preHandler で統一認証 + data-scope 5 級                        |
| **ワークスペース権限**   | 3 モード + 7 エンドポイントランタイム傍受 + 60s 監査タイムアウト                                                     |
| **マルチテナント**       | テナント分離 + 組織 + 部門 + メニュー権限 + tenant-router + RLS                                                      |
| **OAuth 秘密鍵**         | oauth-private-keys schema で暗号化保存                                                                               |
| **2FA**                  | user-auth-info schema サポート                                                                                       |
| **認証コード**           | auth-codes + captcha schema                                                                                          |

---

## エンジニアリング品質ゲート(21 個の pre-commit フック)

プロジェクトは 21 個の pre-commit フック + post-commit 自動 push + 11 マイグレーション監査 + 9 PowerShell 起動スクリプトで協作事故を根絶:

詳細リストは [コア能力 E4 セクション](#e4-エンジニアリング品質ゲート21-pre-commit--post-commit--11-マイグレーション監査) 参照。

---

## エンジニアリング品質証拠("AI 生成コード 3 つのよくある問題"への反論)

> **このセクションを書いた理由**: 一部の外部 AI レビューがコードを検証せず、"AI 生成プロジェクトのよくある特徴"に基づいて本プロジェクトに 3 つのよくある問題があると推測しました — ① コード重複度高 ② 境界条件処理不足 ③ 深層ビジネスロジック一貫性弱。私たちは**実証**でこの推測に応答し、言葉で反論しません。

### 問題 ① コード重複度高 → 現実: Knip + dedupe + 21 フックが守護

| メカニズム                  | ファイル                                                                                                  | 目的                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Knip 未使用コード検出**   | [knip.jsonc](./knip.jsonc) + [.github/workflows/knip.yml](./.github/workflows/knip.yml)                   | CI 守護、参照されない export → CI 失敗         |
| **依存関係断片化検出**      | [scripts/check-dedupe.mjs](./scripts/check-dedupe.mjs) (pre-commit #7)                                    | 重複依存バージョン検出、整列                   |
| **Tailwind クラス衝突検出** | [scripts/check-tailwind-class-conflict.mjs](./scripts/check-tailwind-class-conflict.mjs) (pre-commit #20) | テンプレートリテラル BASE/BRANCH size 衝突検出 |
| **Staged 汚染警告**         | [scripts/check-staged-pollution.mjs](./scripts/check-staged-pollution.mjs) (pre-commit #19)               | ≥4 ディレクトリにまたがる staged 変更検出      |

### 問題 ② 境界条件不足 → 現実: 237 API テスト + 63 e2e + マイクロサービスパターン

| メカニズム                   | 証拠                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **API 単体テスト**           | 237 個 `.test.ts` ファイル([apps/api/tests/](./apps/api/tests/))、auth/billing/order/vip/wallet/alipay/crypto/csrf/outbox 等コアパス網羅                                                                     |
| **E2E テスト**               | 63 個 `.spec.ts` ファイル([apps/web/e2e/](./apps/web/e2e/))、admin/ai-chat/auth-2fa/community/education/orders/payment/plaza/pwa/security/seo/workspace 等 17 ビジネスドメイン網羅                           |
| **AI サービステスト**        | pytest テストスイート([apps/ai-service/tests/](./apps/ai-service/tests/))、`test_business_flow_integration.py` ビジネスフロー統合テスト + `test_langgraph_service.py` オーケストレーションロジックテスト含む |
| **マイクロサービス耐障害性** | Outbox トランザクショナルアウトボックス + Refund DLQ 返金デッドレターキュー + Circuit Breaker + IDOR 保護 + WS Dedup メッセージ重複排除                                                                      |
| **決済ループテスト**         | `apps/api/tests/alipay.test.ts` + `billing.test.ts` + `order.test.ts` + `wallet.test.ts` が決済/返金/照合/ウォレット取引網羅                                                                                 |

### 問題 ③ 深層ビジネスロジック一貫性弱 → 現実: 複雑なビジネスフローが完全なチェーン保有

| ビジネスフロー             | 主要コード                                                                                                                                  | テスト                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **決済ループ**             | `createOrder` → `completeOrderWithSaga` → 決済コールバック → VIP 有効化 → ウォレット入金 → ポイント発行 → 返金 DLQ                          | [apps/api/tests/order.test.ts](./apps/api/tests/order.test.ts) + [billing.test.ts](./apps/api/tests/billing.test.ts) |
| **AI 教育フルスタック**    | 講座登録 → チャプター追跡 → 宿題採点(`gradeSubjectiveAnswers` 主観手動採点 + 客観自動採点) → 間違い帳 → SRS 間隔反復 → 修了証発行           | [apps/api/tests/exam.test.ts](./apps/api/tests/exam.test.ts) + [learn.test.ts](./apps/api/tests/learn.test.ts)       |
| **LangGraph ワークフロー** | `langgraph_service.py` StateGraph(plan → execute → summarize) + `koubo_workflow.py` 10+ ツール + `agent_orchestrator.py` マルチ Agent 協作  | [apps/ai-service/tests/test_langgraph_service.py](./apps/ai-service/tests/test_langgraph_service.py)                 |
| **マルチテナント権限**     | RBAC 5 レベル + data-scope 5 レベル + RLS 行レベルセキュリティ + workspace 3 モード + 7 エンドポイントランタイム傍受 + 60s 監査タイムアウト | [apps/api/tests/rbac.test.ts](./apps/api/tests/rbac.test.ts)                                                         |
| **AI ストリーミング出力**  | SSE(Agent ストリーミング) + WebSocket(チャットルーム / マルチモデルストリーミング) + REST 3 階層プロトコル + WS Dedup メッセージ重複排除    | [apps/api/tests/chat.test.ts](./apps/api/tests/chat.test.ts)                                                         |

---

## AI プログラミング協作宣言

> **本プロジェクトは AI プログラミング Agent を補助開発に使用**します(Claude Code / Codex / Cursor 等)、ただし以下メカニズムでエンジニアリング品質を保証します — **"AI がレビューなしにコードを自動生成"するものではありません**:

### トリプルゲート(全コード行が通過必須)

1. **コーディング前**: AGENTS.md 21 強制ルール + §11 マルチ-Subagent 並列開発タスク割当形式 + §9 全クライアント接続義務
2. **コーディング中**: §17 スタイル変更義務 browser_use 検証 + §19 UI 変更事前配達自己検証 4 状態スクリーンショット + §14 Agent 自己検証
3. **コーディング後**: `pnpm turbo build typecheck lint test` 全体検証 + 21 pre-commit フック + pre-push typecheck ゲート + post-commit 自動 push + git-push-guard 検証

### AI コード問題に対する標的対策

| AI コード問題               | 本プロジェクトの対策                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| コード重複                  | Knip CI 守護 + check-dedupe + check-tailwind-class-conflict                                                                             |
| 境界条件欠落                | 237 API テスト + 63 e2e + pytest 統合テスト + マイクロサービス耐障害性パターン                                                          |
| ビジネスロジック断片化      | ビジネスフロー統合テスト(`test_business_flow_integration.py`) + saga トランザクションパターン + outbox トランザクショナルアウトボックス |
| 型安全の穴                  | TypeScript strict + Zod エンドツーエンド検証 + @ihui/types クロスクライアント契約                                                       |
| ドキュメント-コードドリフト | §13 ファイル修正持続性義務 Read 検証 + check-project-plan-archive 守護                                                                  |
| スタイル不一致              | ESLint + Prettier + 21 pre-commit フック + check-rounded-full / check-i18n-keys / check-api-routes 等                                   |
| 協作事故                    | §12 マルチセッション並列ルール + §16 push 段階クロス-Agent 保護 + git-push-guard + post-commit 自動 push                                |

### 正直に認められた短所

私たちは以下の事実を**否定せず**、将来の最適化方向として扱います:

- 5 クライアント(desktop / extension / mobile-rn / miniapp-taro / cli)の完了度が web/api/ai-service より低い; コアシナリオは接続されているがビジネスページ網羅率が不足([プロジェクト状態マトリクス](#プロジェクト状態マトリクス透明ラベリング-2026-07-22-確認)参照)
- ai-service の LangGraph オーケストレーションは現在"ワークフローレベル"であり、"自律スキル生成 + 長期記憶 + 自己進化"深層 Agent 能力はまだ未実装
- オープンソースコミュニティエコシステムは始まったばかり; 貢献者数、Issue 蓄積、ベストプラクティスは LangChain / Dify / Claude Code 等成熟プロジェクトに比べ大きく遅れている

---

## テスト

詳細テストマトリクスは [コア能力 E5 セクション](#e5-テストと性能) 参照。

---

## デプロイ

### Docker Compose(推奨)

```bash
# .env.production を設定
cp .env.production.example .env.production
# JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY / WeChat Pay 証明書 / SMTP 等を編集

# ワンクリック起動(7 業務 + 7 監視 = 14 サービス)
docker compose up -d
```

**サービスリスト(14 サービス):**

| タイプ | サービス       | ポート | 用途                                       |
| ------ | -------------- | ------ | ------------------------------------------ |
| 業務   | api            | 8802   | Fastify バックエンド                       |
| 業務   | worker         | 8830   | BullMQ 独立 worker プロセス                |
| 業務   | web            | 8801   | Next.js フロントエンド(standalone)         |
| 業務   | ai-service     | 8803   | FastAPI AI サービス                        |
| 業務   | db             | 8810   | PostgreSQL 18                              |
| 業務   | redis          | 8811   | Redis 7                                    |
| 業務   | migrate        | -      | 一次性マイグレーションサービス(完了後終了) |
| 監視   | jaeger         | 8814   | 分散トレース UI                            |
| 監視   | otel-collector | 8813   | OpenTelemetry Collector                    |
| 監視   | prometheus     | 9091   | 指標収集                                   |
| 監視   | grafana        | 8816   | 可視化(20 ダッシュボード)                  |
| 監視   | node-exporter  | 8817   | ホスト指標                                 |
| 監視   | loki           | 8818   | ログ集計                                   |
| 監視   | promtail       | -      | ログ収集                                   |

### ポート管理ルール

本プロジェクトの全サービスは `88xx` ポート帯を統一使用し、システムサービスとの競合を回避します:

| ポート帯  | 用途           | 説明                                                                                                                           |
| --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 8801-8809 | アプリサービス | Web / API / AI Service / Taro H5 / Metro / Desktop 等                                                                          |
| 8810-8819 | インフラ       | PostgreSQL(8810)/ Redis(8811)/ OTel(8812-8813)/ Jaeger(8814)/ Prometheus(8815)/ Grafana(8816)/ Node Exporter(8817)/ Loki(8818) |
| 8820-8829 | 補助ツール     | Storybook(8820)等の開発補助ツール                                                                                              |
| 8830-8839 | SaaS デプロイ  | Admin API(8830)等の SaaS 化デプロイサービス                                                                                    |

### 本番デプロイ

詳細は [DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) — ブルーグリーンデプロイ / イメージ tag 切替 / Nginx upstream 切替 / データベースバックアップ復元 / 証明書更新 / ヘルスチェック / ロールバック。

```bash
# デプロイ前 10 項目のハードゲート自己チェック
node scripts/pre-deploy.mjs

# PostgreSQL バックアップ
node apps/api/scripts/pg-backup.mjs

# ヘルスチェック
./deploy/scripts/health-check.sh

# ロールバック
./deploy/scripts/rollback.sh

# 証明書更新(deploy/cron/cert-renew.cron で自動スケジュール)
./deploy/cron/cert-renew.sh

# GitHub Actions secrets 一括設定
./deploy/setup-github-secrets.sh
```

### IaC 決定

本アーキテクチャは **Docker Compose + GitHub Actions** を K8s + Helm + ArgoCD ではなく選択した理由:

- 単一 VM でデプロイ可能、運用ハードルが低い
- コントロールプレーンオーバーヘッドなし、リソース利用率が高い
- デプロイ速度 10-30s(K8s は 30s-2min)
- 適用規模 ≤ 5 サービス / 単一チーム / 単一クラスタ

**K8s 移行タイミング**:業務サービス > 10 / クロス AZ マルチアクティブ / 単一 VM リソースが天井に到達 / HPA オートスケールが必要 / マルチテナント namespace 級分離。全 Dockerfile は K8s コンテナイメージとして直接再利用可能で、移行パスは予約済み。

---

## 国際化

5 言語 parity(キーセット強一貫性)、4 ゲートスクリプト + 19 i18n ツールチェーンで品質を保証:

詳細リストは [コア能力 E3 セクション](#e3-国際化5-言語-parity) 参照。

---

## FAQ

<details>
<summary><strong>Q1:IHUI-AI は商用利用できますか?</strong></summary>

はい。プロジェクトは Apache License 2.0 を採用しており、自由な使用、改変、配布、商用利用が可能で、伝染性はありません。これに基づいて商業製品を構築でき、業務コードをオープンソース化する必要はありません。唯一の要件:LICENSE と copyright notice を保持すること。
</details>

<details>
<summary><strong>Q2:40+ の国際/国内対抗製品(OpenAI ChatGPT / Dify / LangChain / RAGFlow / Coze / Claude Code / Cursor / GitHub Copilot / Khan Academy / Stripe+Auth0 など)とどう違いますか?</strong></summary>

IHUI-AI は単一の AI ツールではなく、**オープンソース AI 商用グレード統合ファウンデーション**であり、以下の 6 大カテゴリの製品能力を**1 つの Apache 2.0 リポジトリに統合**しています:

| 対抗カテゴリ                            | 代表製品                                                                     | IHUI-AI の差異                                                                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 汎用 AI 対話                            | OpenAI ChatGPT / Anthropic Claude.ai / Google Gemini / Microsoft Copilot     | IHUI-AI はセルフホスト + 118 モデル(OpenAI に限定されず)+ 課金 / 教育 / 配信などの業務を搭載                                                                                 |
| AI アプリケーション開発プラットフォーム | Dify / FastGPT / Langflow / RAGFlow / Flowise / Coze(扣子)                   | IHUI-AI は 6 クライアント、自社製 CLI、完全な商業ループ、AI 教育、38 プラットフォーム配信を追加装備                                                                           |
| AI Agent フレームワーク                 | LangChain / LlamaIndex / AutoGen / CrewAI / AutoGPT / MetaGPT                | それらは開発フレームワーク(「車の部品」)、IHUI-AI は製品化ファウンデーション(「完成車のラインオフ」)、非技術チームでも利用可能                                                |
| AI プログラミング CLI / IDE             | Claude Code / Cursor / GitHub Copilot / Windsurf / Amazon Q / Cline / Aider  | IHUI-AI の CLI はプログラミングだけでなく、AI アプリケーションプラットフォーム(対話 / RAG / Agent / 課金)も統合、かつ Apache 2.0 でオープンソース、他はすべてクローズドソース |
| AI 教育プラットフォーム                 | Khan Academy / Coursera / edX / Google 教育 AI                               | IHUI-AI の AI 教育はオープンソースフルスタック(コース / 問題集 / 試験 / SRS / ライブ / 証明書)、二次カスタマイズ可能、これらはクローズドソース SaaS                           |
| 商業 SaaS ファウンデーション            | Stripe / Auth0 / Clerk / Mailgun / SendGrid / Mixpanel / Amplitude / PostHog | IHUI-AI は決済 / 認証 / メール / 分析をすべてプリセット、ワンストップで 4-6 個の SaaS を代替、月 $300+ 節約                                                                   |
| マルチクライアントフレームワーク        | Tauri / Electron / Expo / React Native / Taro / WXT / Next.js                | IHUI-AI は 8 クライアント + 16 共有パッケージ + 共有 UI を一括プリセット、開発者に自ら組み立てさせるのではない                                                                |

**10 大独自能力(オープンソース生態系で同時具備は希少)**:

1. **8 クライアント全面対応**(他の AI アプリケーションプラットフォームはわずか 1-2 クライアント、Claude Code/Cursor は 1 クライアントのみ)
2. **LangGraph + MCP + A2A トリプルスタック連携**(他プロジェクトは最大シングルスタック)
3. **自社製 CLI 17 コマンド + 13 ツール + ACP Server + 6 ソース設定インポート**(オープンソース AI アプリケーションプラットフォームでは希少)
4. **完全な課金サブスクリプション + VIP + ウォレット + ポイント + 8 決済ゲートウェイ + 返金 + インボイス**(オープンソース AI プラットフォームでは希少)
5. **38 プラットフォームワンクリック配信 + 38 adapter + AES-256-GCM 認証情報暗号化**(オープンソースプロジェクトでは希少)
6. **AI 教育フルスタック + 学生側 12 サブページ + 45 テーブル edu-full schema**(オープンソース AI プラットフォームでは希少)
7. **エンタープライズ級セキュリティスタック(RBAC + マルチテナント + RLS + SSO + AES-256-GCM + JWT token-family + GDPR + 2FA + IDOR)**(オープンソース AI プラットフォームでは希少)
8. **17 エンジニアリング品質ゲート + 11 マイグレーション監査 + 9 PowerShell + post-commit 自動 push**(オープンソース AI プロジェクトでは希少)
9. **三支柱オブザーバビリティ + 20 Grafana ダッシュボード + Alertmanager**(オープンソース AI プラットフォームでは希少)
10. **5 言語 i18n parity + 4 ゲートスクリプト + pgvector + ナレッジグラフ + ユーザー長期記憶**(オープンソース AI プロジェクトでは希少)

詳細は上方の [プロジェクト ポジショニング](#プロジェクト-ポジショニング必読)、[コスト比較](#コスト比較ihui-ai-セルフホスト-vs-同等の-saas-スタック) と [類似プロジェクトとの比較](#類似プロジェクトとの比較) の章を参照。

**コア差別化**:IHUI-AI より特化したプロジェクトは見つかります(RAGFlow は RAG 次元でより深い、Claude Code は CLI 次元でより成熟、LangChain はフレームワーク層でより柔軟、Khan Academy は教育コンテンツでより豊富)。しかし、IHUI-AI より包括的なオープンソース ファウンデーションは見つかりません。

**一言まとめ**:IHUI-AI = OpenAI ChatGPT(対話)+ Dify(アプリケーションオーケストレーション)+ Claude Code(CLI)+ Khan Academy(教育)+ Stripe(決済)+ 蟻客(配信)の**オープンソース一体化代替方案**です。
</details>

<details>
<summary><strong>Q3:実行にどの LLM API Key が必要ですか?</strong></summary>

最低 1 つ。最簡起動は OpenAI API Key のみで、完全な対話能力を体験できます。全機能を使用するには、以下の接続を推奨:

- 国際:OpenAI + Anthropic Claude + Google Gemini
- 中国製:Zhipu GLM + Tongyi Qianwen + DeepSeek + Doubao
- マルチモーダル:Stable Diffusion + 通義万相 + Tencent Hunyuan 3D
- 支払いたくない?AI サービスは stub モードをサポートし、API key なしでも開発デバッグ可能。

</details>

<details>
<summary><strong>Q4:セルフホストに対応していますか?データは大手テック企業に覗かれますか?</strong></summary>

完全セルフホスト。Docker Compose でワンクリック起動後、全データ(対話 / ナレッジベース / ユーザー / 課金)はあなた自身の PostgreSQL + Redis に保存され、LLM 呼出はあなた自身の API Key を使用、認証情報は AES-256-GCM で暗号化保存されます。外部へのデータ送信は一切なく、100% のデータ主権を保持します。
</details>

<details>
<summary><strong>Q5:プロジェクト規模がこれほど大きいですが、デプロイにはどんな構成が必要ですか?</strong></summary>

最小本番構成:4 コア CPU / 8GB メモリ / 50GB ディスク / 単一 VM で十分。開発環境は 2 コア 4GB で十分。監視スタックは任意(Grafana / Loki / Jaeger を停止して 1GB メモリ節約可能)。詳細は [DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) 参照。
</details>

<details>
<summary><strong>Q6:コードをコントリビュートするには?どんなレベルが必要ですか?</strong></summary>

あらゆるレベルのコントリビューターを歓迎します。ドキュメントの誤字脱字修正、Issue 提出、テストケース作成から、新モデル接続、新配信プラットフォーム、新プラットフォーム対応まで歓迎します。詳細は [コントリビュート](#コントリビュート) セクション参照。特に歓迎するのは:新モデルアダプタ / 新配信プラットフォーム / 新言語 / 新プラットフォーム対応 / AI ワークフローテンプレート / エンタープライズ級能力 / テストカバレッジ / ドキュメント改善の 8 大方向。
</details>

<details>
<summary><strong>Q7:なぜ npm / yarn ではなく pnpm なのですか?</strong></summary>

pnpm は monorepo シナリオで優位性が顕著:厳密な依存分離(ファントム依存防止)+ ハードリンクでディスク節約 + ワークスペースプロトコル + Turborepo との相性が良い。プロジェクトは `pnpm@9.15.0` に固定、`corepack enable` で自動有効化、バージョン手動管理不要。
</details>

<details>
<summary><strong>Q8:CLI 設定インポート機能とは何ですか?どのツールの設定をインポートできますか?</strong></summary>

自社製 CLI は 6 ソースワンクリックインポート機能を提供し、他の AI CLI ツールから IHUI-AI CLI へシームレスに切り替え可能で、API Key / モデル / ワークフローを再設定不要:

- cc-switch / codex++ / Claude / Codex / Gemini / Hermes

詳細は `apps/cli/` 実装を参照。
</details>

<details>
<summary><strong>Q9:データベースが 598 テーブルなのはなぜですか?過剰設計では?</strong></summary>

598 テーブルは 100 個の schema ファイルに分散し、30+ 業務ドメインを網羅、ドメイン平均 11 テーブルで密度は合理的です。本プロジェクトは商業化本番級 AI プラットフォーム(智匯 AI グループのメインプラットフォーム)であり、デモではないため、テーブル構造は実際の業務複雑度に基づき設計されています。一部機能のみを使用する場合(例:AI 対話のみ)は、chat / users / billing の 3 つの schema に注目すればよく、他のテーブルは稼働に影響しません。
</details>

<details>
<summary><strong>Q10:20 個の Grafana ダッシュボードは重すぎませんか?</strong></summary>

重くありません。20 ダッシュボードは業務ファネル / 決済フロー / AI コストレイテンシ / 試験使用率 / PostgreSQL / Redis / BullMQ / Nginx / HLS / ライブルーム / テナント使用 / WebSocket / 認証セキュリティ等を網羅し、各ダッシュボードは独立して provision、必要に応じて有効化可能。開発環境で Grafana / Loki / Jaeger / Alertmanager の 4 つの監視コンテナを停止すれば、1GB メモリを節約できます。
</details>

---

## コントリビュート

あらゆる形態のコントリビュートを歓迎:Issue / PR / ドキュメント改善 / Bug 修正 / 新機能 / 翻訳 / テストケース。

### コントリビュートフロー

1. **リポジトリを Fork** → ブランチ `feat/your-feature` または `fix/your-bugfix` を作成
2. **規範を読む**:[AGENTS.md](AGENTS.md)(AI Agent 協作規範)+ [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)(人間コントリビューターガイド)
3. **ローカル開発**:`pnpm install && pnpm dev`、21 項目の pre-commit ゲートに従う
4. **提出規範**:Conventional Commits(`feat:` / `fix:` / `docs:` / `chore:` / `test:` / `refactor:`)
5. **自己検証パス**:`pnpm turbo build typecheck lint test` が全てグリーン
6. **PR 提出**:説明を明確に記載、Issue を関連付け、review を待つ

### 行動規範

- あらゆるコントリビューターを尊重、レベルを問わない
- 身分ではなくコードで語る
- **引き算**を優先し、足し算は慎重に — コードを最小化、ゼロ冗長
- 冗長ファイルを作成せず、copyright/license header を付けない
- 既存のコードとパターンを再利用し、車輪の再発明をしない

### コントリビュート方向

以下の方向のコントリビュートを特に歓迎:

- **新モデルアダプタ**:より多くの LLM ベンダーを接続(Replicate / Together AI / DeepInfra 等)
- **新配信プラットフォーム**:より多くのコンテンツ配信プラットフォームを接続(TikTok / Instagram / LinkedIn 等)
- **新言語**:新 i18n locale を追加(アラビア語 / ポルトガル語 / スペイン語等)
- **新プラットフォーム対応**:既存 8 プラットフォームを強化 + 新プラットフォーム追加(HarmonyOS / HarmonyOS Next)
- **AI ワークフロー**:LangGraph ワークフローテンプレート / MCP ツール / A2A Agent をコントリビュート
- **エンタープライズ級能力**:マルチテナント分離強化 / 監査ログ完善 / SSO 統合(Okta / Keycloak)
- **テストカバレッジ**:境界ケース / E2E シナリオ / 性能ベンチマークを追加
- **ドキュメント改善**:より多くの利用チュートリアル / アーキテクチャ解析 / ベストプラクティス

---

## ドキュメントナビゲーション

> 完全ドキュメントセンター索引:[docs/README.md](docs/README.md)(35 ドキュメント、9 大分類)

### プロジェクトとアーキテクチャ

| ドキュメント                                                           | 説明                                                                                                                       |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)                           | **システムアーキテクチャ概覧**(技術スタック / データベース / API ルート / 起動フロー / 旧アーキテクチャ廃止説明)           |
| [docs/MULTI_END.md](docs/MULTI_END.md)                                 | マルチエンドアーキテクチャ(8 エンドマトリックス + クロスエンドリンク + 同期開発 + 38 プラットフォームリリースマトリックス) |
| [docs/PACKAGES.md](docs/PACKAGES.md)                                   | 共有パッケージガイド(16 個 @ihui/* パッケージ + 依存関係 + 新規パッケージフロー)                                           |
| [docs/port-management.md](docs/port-management.md)                     | ポート管理ルール(8801-8899 ポートレジストリ)                                                                               |
| [docs/INFRASTRUCTURE_DECISION.md](docs/INFRASTRUCTURE_DECISION.md)     | インフラ決定(Docker Compose vs K8s)                                                                                        |
| [docs/PRODUCTION_INFRASTRUCTURE.md](docs/PRODUCTION_INFRASTRUCTURE.md) | 本番インフラ仕様                                                                                                           |

### 開発とテスト

| ドキュメント                                   | 説明                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)     | **ローカル開発ガイド**(環境変数 / 起動 / デバッグ / スクリプトチートシート / Windows 注意)         |
| [docs/TESTING.md](docs/TESTING.md)             | テスト戦略(8 層ピラミッド + Vitest + pytest + Playwright + Locust + CI)                            |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)   | コントリビュートガイド(環境構築 / コード規範 / コミット規範 / PR フロー)                           |
| [docs/UI_GUIDELINES.md](docs/UI_GUIDELINES.md) | UI デザイン規範(角丸 / フォントアラインメント / ログインポップアップ / コンポーネントライブラリ)   |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md)     | パフォーマンスベースラインと最適化(SLA / 負荷テスト / データベース / フロントエンド / AI サービス) |

### API とデータレイヤー

| ドキュメント                                     | 説明                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md)   | **API 完全リファレンス**(60+ ルート + 25 WebSocket + SSE + エラーコード + クライアント例) |
| [docs/DATABASE.md](docs/DATABASE.md)             | データベース設計(Drizzle / 339 テーブル / マイグレーション / RLS / シード / バックアップ) |
| [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) | 認証と認可(JWT / token-family / OAuth2 / 2FA / RBAC / マルチテナント / WS 認証)           |

### AI サービス

| ドキュメント                                     | 説明                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [docs/AI_SERVICE.md](docs/AI_SERVICE.md)         | **AI サービス深掘り**(6 ルーター + LangGraph + LiteLLM + MCP + A2A + ベクトルメモリ) |
| [docs/LLM_SETUP.md](docs/LLM_SETUP.md)           | LLM モデル設定(OpenAI / Anthropic / Google / 国内ベンダー)                           |
| [docs/AI_LEADERBOARD.md](docs/AI_LEADERBOARD.md) | AI モデルリーダーボードデータ                                                        |

### デプロイと運用

| ドキュメント                                                                 | 説明                                                                                |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md)                     | **デプロイ運用マニュアル**(ブルーグリーンデプロイ / ロールバック / 証明書更新)      |
| [docs/RELEASE.md](docs/RELEASE.md)                                           | リリースプロセス(38 プラットフォーム + SemVer + Git tag + Docker イメージ + hotfix) |
| [docs/MONITORING.md](docs/MONITORING.md)                                     | オブザーバビリティ(Prometheus + Grafana + Loki + Jaeger + Alertmanager)             |
| [docs/INCIDENTS.md](docs/INCIDENTS.md)                                       | 歴史事故振り返り                                                                    |
| [docs/SECURITY.md](docs/SECURITY.md)                                         | セキュリティポリシー(脆弱性開示 / 暗号化設計 / 権限モデル)                          |
| [docs/CREDENTIAL_ROTATION_RUNBOOK.md](docs/CREDENTIAL_ROTATION_RUNBOOK.md)   | 認証情報ローテーション運用マニュアル                                                |
| [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md)                                   | メールサービス設定(SMTP / テンプレート / DKIM)                                      |
| [docs/WECHAT_PAY_ACTIVATION_REPORT.md](docs/WECHAT_PAY_ACTIVATION_REPORT.md) | WeChat Pay V3 活性化レポート                                                        |
| [server-docs/MULTI_TENANT.md](server-docs/MULTI_TENANT.md)                   | マルチテナント設計ドキュメント(RLS + テナントルーティング)                          |

### 品質とゲートキーパー

| ドキュメント                                                 | 説明                                                                               |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [docs/GATEKEEPERS.md](docs/GATEKEEPERS.md)                   | **ゲートキーパー規則深掘り**(23 pre-commit + post-commit + pre-push、スクリプト別) |
| [docs/I18N.md](docs/I18N.md)                                 | 国際化(5 言語 + 68 ネームスペース + 12 ゲートキーパースクリプト + 翻訳戦略)        |

### SDK と CLI

| ドキュメント               | 説明                                                                     |
| -------------------------- | ------------------------------------------------------------------------ |
| [docs/SDK.md](docs/SDK.md) | 5 言語 SDK ガイド(TS / Python / Go / Java / .NET コード例)               |
| [docs/CLI.md](docs/CLI.md) | CLI ツールガイド(24 ソースインポート + subagent 並列 + skills + plugins) |

### トラブルシューティングと FAQ

| ドキュメント                                       | 説明                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | **トラブルシューティングガイド**(10 大分類 35+ イシュー、統一テンプレート) |
| [docs/FAQ.md](docs/FAQ.md)                         | FAQ(14 分類 86 質問)                                                       |

### プロジェクト管理

| ドキュメント                           | 説明                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 変更ログ                                                                           |
| [AGENTS.md](AGENTS.md)                 | AI Agent 協作規範(23 節強制ルール、本プロジェクトが AI とどう協作開発するかを示す) |
| [PROJECT_PLAN.md](PROJECT_PLAN.md)     | プロジェクトタスク計画と履歴アーカイブ(内部開発記録、進化軌跡を理解)               |

---

## ロードマップ

### 納品済み(2026-07-20)

- 8 プラットフォーム完全網羅(Web / API / AI サービス / CLI / デスクトップ / 拡張 / モバイル RN / ミニプログラム Taro)
- 100+ LLM LiteLLM 統一接続 + 5 provider アダプタ
- LangGraph + MCP + A2A 三スタック連携 + Persona + Agent Runtime + ベクトルメモリ
- 自社製 CLI 17 コマンド + 13 ツール + ACP Server + 6 ソース設定シームレスインポート
- ワークスペース権限 3 モード + 7 エンドポイントランタイム傍受 + 60s 監査タイムアウト
- セルフメディアワークベンチ(公衆号記事 + 口播稿デュアルパイプライン)+ Skills システム(content_engine + koubo_workflow)
- 38 プラットフォームワンクリック自動配信プラットフォーム + 38 adapter + AES-256-GCM 認証情報暗号化
- AI 教育フルスタック(コース / 問題集 / 試験 / SRS / ライブ / レポート / 証明書 / 講師 / 学生側 12 サブページ)
- マルチエージェントマーケット + デベロッパーセンター(13 サブページ)+ Coze SDK プロキシ + OpenClaw + Crew + N8N
- コミュニティインタラクション(サークル / 広場 / DM / フォロー / シェア)
- 運営グロース(ポイント / チェックイン / ランキング / くじ / ディストリビューション / 招待 / ゲーミフィケーション)
- 課金取引クローズドループ(VIP / サブスクリプション / ウォレット / ポイント / 返金 / インボイス / 為替レート / 8 決済ゲートウェイ)
- カスタマーサポート(チケット / オンラインサポート / フィードバック / ヘルプセンター)
- BI ダッシュボード + エラーダッシュボード + カナリアリリース + i18n ダッシュボード
- 5 言語 i18n parity(zh-CN / zh-TW / en / ko / ja)+ 19 i18n ツールチェーン + 4 ゲート
- フルスタックオブザーバビリティ(Prometheus + Grafana 20 ダッシュボード + Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager)
- 21 pre-commit ゲート + post-commit 自動 push + 11 マイグレーション監査 + 9 PowerShell 起動
- エンタープライズ級セキュリティ(RBAC + マルチテナント + RLS + SSO + AES-256-GCM + JWT token-family + CSRF + XSS + GDPR + 2FA)
- 598 データベーステーブル + 128+ マイグレーション + 16 共有パッケージ + Knip + Lighthouse + Locust 負荷テスト

### 進行中

- コンテンツ配信プラットフォーム 11 プラットフォームの実際の認証情報での動作検証(コードは準備済み、ユーザーからの認証情報提供が必要)
- マルチテナント namespace 級分離強化
- HarmonyOS / HarmonyOS Next プラットフォーム対応

### 計画中

- K8s + Helm + ArgoCD 重厚 IaC マイグレーション(業務サービス > 10 時にトリガー)
- より多くの AI ワークフローテンプレートマーケット
- A2A Agent クロスインスタンス連邦
- より多くの i18n locale(アラビア語 / ポルトガル語 / スペイン語)

完全なタスク計画と履歴アーカイブは [PROJECT_PLAN.md](PROJECT_PLAN.md) 参照。

---

## お問い合わせ

<p align="center">
  <strong>QR コードをスキャンして IHUI-AI コミュニティに参加、開発者と AI の未来を共創</strong>
</p>

<table align="center">
  <tr>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/footer-icon-2.png" width="180" alt="公式アプリ QR コード" />
      <br/>
      <strong>公式アプリ</strong>
      <br/>
      <sub>スキャンして IHUI-AI App を体験</sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/wechat-vx.png" width="180" alt="公式 WeChat QR コード" />
      <br/>
      <strong>公式 WeChat</strong>
      <br/>
      <sub>WeChat ID:<code>ok502319984</code></sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/community-group.jpg" width="180" alt="企業 WeChat コミュニティグループ QR コード" />
      <br/>
      <strong>企業 WeChat コミュニティ</strong>
      <br/>
      <sub>スキャンして開発者コミュニティに参加</sub>
    </td>
  </tr>
</table>

### 会社情報

| 項目                          | 情報                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| **会社正式名称**              | 吉林省愛智匯人工知能科技有限公司                              |
| **ブランド名**                | 智匯 AI グループ                                              |
| **会社住所**                  | 吉林省長春市ハイテク産業開発区越達路 107 号 · AI 人材孵化基地 |
| **連絡電話**                  | 18643389808                                                   |
| **メール**                    | [REDACTED-EMAIL]                                              |
| **WeChat カスタマーサポート** | ok502319984(WeChat 検索で追加)                                |
| **ICP 備案**                  | 吉ICP备2025027274号                                           |
| **著作権**                    | © 2025 智匯 AI グループ · 中国                                |

### コミュニティと外部プラットフォーム

| プラットフォーム     | リンク                                        |
| -------------------- | --------------------------------------------- |
| GitHub 組織          | https://github.com/AIZHS2025                  |
| X (Twitter)          | https://x.com/ok502319984                     |
| Facebook             | https://www.facebook.com/share/17kQMPNhQb/    |
| Issue フィードバック | https://github.com/IHUI-INF-AI/IHUI-AI/issues |
| PR コントリビュート  | https://github.com/IHUI-INF-AI/IHUI-AI/pulls  |

> 協力相談、企業接続、技術交流は上記 WeChat をスキャンまたは [REDACTED-EMAIL] 宛てにご連絡ください。24 時間以内に返信します。

---

## 私たちの物語 · 智匯AIの誕生

> _これはマーケティングコピーではありません。これは汗と執念と信念で書かれた、本当の物語です。_
> _フィルターも、包装もありません。AI時代における一人の独立開発者の、最も素のままの信念だけがあります。_

<!-- 画像:吉林省愛智匯人工知能科技有限公司 · オフライン拠点(長春ハイテクゾーン越達路107号 AI人材育成インキュベーション基地) -->
<p align="center">
  <img src="apps/web/public/images/story/changchun-winter-2024.jpg" width="600" alt="吉林省愛智匯人工知能科技有限公司 · 長春ハイテクゾーン越達路107号 AI人材育成インキュベーション基地" />
</p>
<p align="center"><sub>📍 吉林省愛智匯人工知能科技有限公司 · オフライン拠点 · 長春ハイテクゾーン越達路107号 AI人材育成インキュベーション基地(2026-07 実撮)</sub></p>

<!-- 画像:深夜コーディング · ランプと成長するコード(Pexels 無料透かし無しライブラリ、Free License) -->
<p align="center">
  <img src="apps/web/public/images/story/late-night-coding.jpg" width="600" alt="深夜 3 時 · ランプと成長するコード" />
</p>
<p align="center"><sub>📍 深夜 3:17 · ランプ一つ、ノートパソコン一台、成長するコード(画像:Pexels · Free License)</sub></p>

### 序章 · 何度も問われた質問

投資家、パートナー、あるいは友人との会話の中で、李春川(リ・チュンチュアン)はいつも同じ質問を受け続けてきました:

> **「なぜ、あなたはこれをやっているのですか?」**

安定した仕事のためではありません—彼はもっと安全な道を選ぶこともできました。
ブームのためでもありません—2025年のAIスタートアップの資本の冬は、見出しが示唆するよりもずっと厳しいものでした。
一攫千金のためでもありません—オープンソースプロジェクトはそもそも利益が第一ではありません。

彼がこれをやっている理由はただ一つ、と呼ぶには単純すぎるほど真っ直ぐな信念のためでした:

> **「AIは少数の大手テック企業と資本プレイヤーのゲームであってはならない。誰もが自分だけのAIプログラムを持つ資格がある。」**

スローガンのように聞こえるかもしれません。でも、零下25度の長春の冬、暖房が静まった未明、N人目の投資家に丁重に断られた後では—この一文が、一人の人間に千行のコードを書き続けさせる主な理由の一つになりました。

これが、その信念が、時間と汗によって、どのように少しずつ形を与えられていったかの物語です。

---

### 第1章 · 始まり: 2024年12月、長春

2024年12月2日。中国吉林省長春市朝陽区。特に目立つ日ではありませんでした。

中国AIスタートアップの地図上で、この年の物語はすでに何度も語られていました: 北京・深セン・杭州・上海のAI企業が代わる代わる見出しを飾り、数千万ドル単位の資金調達、ビッグテックから降りてきたスターチーム、巨大企業の戦略的ベットが次々と報じられました。そして長春—中国東北の工業の中心都市—は、AIの波の中ではほぼ忘れられた座標に近い存在でした。

しかし、ここ、冬場は零下25度まで下がる街で、**吉林省愛智匯人工知能科技有限公司**(Jilin Aizhihui Artificial Intelligence Technology Co., Ltd.)が正式に登記されました。

住所は質素でした: 長春市ハイテクゾーン越達路107号—AI人材育成インキュベーション基地。
登録資本金は質素でした: 100万人民元。
チームも質素でした: 自発的に集まった少数のAI愛好家たち。スターバックグラウンドもなく、億単位のプロジェクト履歴もありません。
創業者も質素でした: **李春川**—連続起業家であり、AI分野のベテラン実践家。名門大学の博士でも、元ビッグテックのVPでもありません。彼はただ、AIという道を長く歩んできた人であり、いくつかのことをはっきりと見抜き、それらをコードに変えようと決心した人です。

彼がはっきりと見ていたのは、単純なことでした:

- **AIの恩恵は、少数のビッグテックと資本プレイヤーが独占している。**
- 一般人、中小企業、教育機関、コンテンツクリエイターは、まだ車輪の再発明を繰り返している。
- LLMを一つ繋ぎ、ワークフローを一つ組み上げ、商用AIプロダクトを一つ出荷する—そのコストは、今なお手が届かないほど高い。
- そして既存の優れたオープンソースプロジェクト—Dify、FastGPT、Langflow—は、それぞれAIアプリケーションの一面しかカバーしていない。**誰も、商用グレードの完全なAIアプリケーション基盤を、そのままオープンソースにしていなかった。**

> **「もし、いつか、誰もが自分だけのAIプログラムを持てるとしたら?」**

その考えが、2024年12月の長春で、ついに火がつきました。

---

### 第2章 · 2025年初頭: 百万元の代償を支払った基盤作り

2025年1月、プロジェクトが正式に始動しました。コードネーム: **IHUI-AI**。

当初は、自発的に集まったAI愛好家の小さなチームでした—別々の都市、別々のバックグラウンドから来ました。ビジネスシステムを構築したことのある人、モデルのファインチューニングをしたことのある人、フロントエンドのアーキテクチャを担当したことのある人。彼らの共通する志は、AIが少数に独占されることを受け入れないこと、そしてオープンソースのエコシステムに本当に価値ある何かを残したいという思いでした。

それは、比類なく質素で、比類なく高価な日々でした。

**百万人民元以上の投資**、ほぼ全額が創業者の出資とチームの持ち出しでした。その頃、中国のAI一次市場はすでに冷え込み始めていました。IT Juziによれば、2025年第1四半期の中国AI投資件数は前年同期比30%以上減少し、アーリーステージのプロジェクトのバリュエーションは大幅に下方修正され、「スターチームでない + スタートラックでない」プロジェクトには、事実上もはやベットしなくなっていました。

IHUI-AIは流行りのラベルにどれも当てはまりませんでした: Agentフレームワークでも、RAGミドルウェアでも、バーティカルSaaSでもありません。それは**完全で、8プラットフォームを横断し、商用グレードのAIアプリケーション基盤**でした—そしてその事実だけで、資金調達は例外的に困難でした。投資家はこう訊くのです: 「あなたの防衛線は何か? なぜビッグテックが作らないのか? なぜDifyが作らないのか?」

李春川の答えはいつも同じでした:

> **「ビッグテックが、課金・サブスクリプション・VIP・ウォレット・ポイント・返金・インボイス・8つの決済ゲートウェイをすべてオープンソースにするはずがありません。Difyも、8プラットフォーム—CLI・デスクトップ・拡張・モバイル・ミニアプリ—をすべて作り切ることはしないでしょう。誰かがやらなければならない。なら、我々がやります。」**

この答えはセクシーではありませんでした。物語っぽくもありませんでした。パートナー会議で投資家が興奮して机を叩くようなものでもありませんでした。

でも、本物でした。

その数カ月間、プレスリリースも、ローンチイベントもありませんでした—ただ:

- データベースのテーブルが0から339へ
- APIルートが0から4443へ
- pre-commitのガードレールが0から17へ
- 数えきれないリファクタリング、スキーマ一つを巡って深夜に及ぶ議論
- どんどん狭まる予算、どんどん重くなる肩

彼らは最下層のアーキテクチャから磨き上げました—monorepoをどう組織するか、16個の共有パッケージをどう分割するか、8プラットフォームの型をどう揃えるか、データベースのスキーマを30以上のビジネスドメインごとにどう分離するか、APIレスポンスをどう `{ code, message, data }` に統一するか、i18nの5言語パリティをどう保証するか、21個のpre-commitガードレールの下でCIをどう俊敏に保つか…どの決定も、これから数千回の反復の中で検証されることになるものでした。

遅く、孤独な道でした。

しかし報いはありました: **遅かったことの代償は、持ちこたえられるアーキテクチャでした。**

2025年下半期にプロジェクトが加速し始めたとき、誰もが気づきました—上半期に固めた基盤のおかげで、新しいコード一行一行が自分の足で立てることに。

---

### 第3章 · 2025年下半期: 一人で、書き続ける

2025年下半期に入り、資金は逼迫し、チームは揺らぎ、試練が次々と押し寄せました。

多くの人が「プロジェクトを一時止めて、資金が入るのを待つ」ことを選ぶだろう頃、李春川は別の道を選びました:

**書き続けること。一人で。**

幸いにも、AI時代は彼に武器を一つ与えていました: **Vibe Coding**。

AIコーディングエージェントを駆使し、大規模なチームなしで、彼は単独でこれらをすべて完成させました:

| 次元                       | 一人の産出                                                                                                                                | 類似プロジェクトの一般的なチーム規模        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **8プラットフォーム**      | Web / API / AIサービス / CLI / デスクトップ / 拡張 / モバイルRN / ミニアプリ                                                              | 通常プラットフォームごとに1チーム、30人以上 |
| **100+のLLM**              | LiteLLM統合ゲートウェイ + 5つのproviderアダプター                                                                                         | 通常モデルチーム3-5人                       |
| **AIオーケストレーション** | LangGraph + MCP + A2Aのシナジー + Persona + Agent Runtime + Vector Memory                                                                 | 通常AIプラットフォームチーム5-10人          |
| **データベース**           | 339以上のテーブル + 100のスキーマファイル + 120以上のマイグレーション + RLS + マルチテナントルーティング                                  | 通常DBA1人 + バックエンド2-3人              |
| **API規模**                | 4443のルート + 12のWebSocket + 267のルートファイル                                                                                        | 通常バックエンドエンジニア5-8人             |
| **フロントエンド規模**     | 200以上のページ + 5言語i18nパリティ + ダークモード + PWA + SEO                                                                            | 通常フロントエンドエンジニア4-6人           |
| **エンジニアリングゲート** | 21のpre-commit + post-commit自動push + 11のマイグレーション監査 + 9のPowerShell起動スクリプト                                             | 通常DevOpsエンジニア1-2人                   |
| **可観測性**               | Prometheus + Grafana(20ダッシュボード)+ Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager                                           | 通常SREエンジニア1-2人                      |
| **ビジネスモジュール**     | 38プラットフォーム配信 + AI教育フルスタック + 完全な課金ループ + エージェントマーケットプレイス + コミュニティ + グロース + サポート + BI | 通常30-50人規模のプロダクトチーム           |

**これは奇跡ではありません。誇張でもありません。**

これは2025年のAI時代に実際に起きたことです: **信念を持った一人の独立開発者が、AIの力を借りて、通常なら30人チームが1年かけて作る工作量を、単独で完成させました。**

もちろん、代償は本物でした: 深夜3時の数えきれないコミット、AIが間違って生成した後の数えきれないロールバック、スキーマ設計を巡ってAIエージェントと夜が明けるまで議論した数えきれない夜。

> 午前3:17、長春。
>
> 窓の外は零下25度。雪がガラスをパチパチと叩いています。
> 部屋の中には、デスクランプ一つ、冷めきったコーヒー一杯、そしてまだ伸び続けるコードの行。
>
> 隣のモニターには、AIエージェントがちょうど生成した
> 次のエンドポイントの実装が映っています—
> 完璧ではありませんが、前に進んでいます。
> このプロジェクトそのもののように。

この経験は、それ自体がVibe Coding時代への良い注釈です:

> **AIは開発者を置き換えない。**
> **ただし、AIを使う開発者は、AIを使わない人を、一つの時代の後ろへ残していく。**

---

### 第4章 · 資本はついに来なかった

ここで「タームシート署名」のハイライトが来るはずでした。

しかし現実には、その瞬間は来ませんでした。

この1年、創業者は資本を求めて走り続けました:

- **投資機関**: 一線のドルファンドから地方の国資まで、AI特化ファンドから総合VCまで—初回面会、ピッチ、デューデリジェンスチェックリスト、そして終わりのない「もう少し検討しましょう」
- **戦略資本**: クラウドベンダーの戦略投資からAIプラットフォームパートナーまで、上場企業CVCからバリューチェーンの上下流まで—終わりのない「戦略シナジーの想像力は大きいですね」、続く「ただし今回のファンドのタームがタイトでして」
- **地方ファンドとFA**: 政府ガイダンスファンドから業界FAの紹介まで—終わりのない紹介ミーティング、終わりのない「もう少し待ちましょう」

**資金は、ついに来ませんでした。**

メディアには「AI智匯コミュニティが2000万人民元のエンジェルラウンドを調達」という報道(36Kr, 2025)まで出ました—しかし現実は、その資金が口座に振り込まれたことは一度もありませんでした。口座残高は依然として数カ月分しかなく、給料はかろうじて維持され、すべてのコミットは、翌月のキャッシュフロー計算を静かに伴っていました。

中国のAIスタートアップ界隈には、この状態を指す言いにくい言葉があります: **「安全網なしで走る」**—セーフティネットなしで走る、という意味です。

何度も、彼は諦めようとしました。

何度も、午前3時や4時の長春で、部屋に光っているのは画面だけでした。窓の外は零下20度。部屋の中にはランプ一つと、まだ伸び続けるコード。スマホには返信のない投資家からのWeChatメッセージがいくつか—ブロックされたのではなく、ただ「まだ結論が出ていません」だけ。

しかし彼は止まりませんでした。

なぜなら、一つのことを信じていたからです:

> **本当に価値あるものは、時間が証明する。**

---

### 第5章 · それでもコードは伸び続けた

資本から1年間「もう少し待て」と言われ続けた間にも、コードは成長を止めませんでした。

- データベースのテーブルは0から339へ
- APIルートは0から4443へ
- 8プラットフォームのフレームワークが一つずつ形になり
- 100以上のLLMがLiteLLMで統合接入され
- LangGraph + MCP + A2Aの三スタックシナジーがオンラインになり
- 38プラットフォーム配信のアダプターがすべて整い
- AI教育フルスタックがコースから証明書まで完全なループを閉じ
- 21のpre-commitガードレール + post-commit自動push + 11のマイグレーション監査 + 9のPowerShell起動スクリプトがすべて稼働し
- 5言語i18nパリティが4つのガードレールスクリプトの下で強固に保たれました

資本があったからではありません。

なぜなら:

- ビッグテックにデータを覗かれずに、自分だけのAIアシスタントを持ちたいすべての個人開発者が、すぐに使えるソリューションを持つ資格があるから
- AIで教育を変えたいけれどSaaSのサブスク料金を払えないすべての教育機関が、完全なAI教育フルスタックを持つ資格があるから
- AI時代に起業したいけれど100万人民元のシード資本がないすべてのインディー開発者が、forkできるプロダクショングレードの基盤を持つ資格があるから
- 「AIはみんなのもの」と信じるすべての人が、資本と独占で定義されないオープンソースの選択肢を持つ資格があるから

**これが、私たちが続けた理由です。**

---

### 第6章 · これを読んでいるあなたへ

ここまで読んでくださったなら、いくつかお伝えしたいことがあります:

**開発者へ** — Forkしてください。改変してください。あなたのものにしてください。あなたのすべてのコミットは、この物語を続ける良い方法です。「コントリビュートして」と言っているのではありません。私たちは、あなたがこれを使って、私たちよりももっと素晴らしいものを作るのを見たいだけです。

**教育者へ** — これでAIコースプラットフォームを構築してください。より多くの学生が、AI時代に取り残されないように。AI教育は高価なSaaSの特権であってはなりません。水や電気のように平等にアクセスできるべきです。

**企業の意思決定者へ** — 毎年数百万を払ってクローズドプラットフォームを購読するのではなく、これで企業のAIミドルプラットフォームを構築してください。RBAC + マルチテナンシー + RLS + 監査ログ + AES-256-GCM暗号化—エンタープライズグレードのセキュリティは、すでにあなたのために用意されています。

**投資家へ** — 私たちはまだ、オープンソースを真に理解し、AIを理解し、長期的価値を理解するパートナーを探しています。この物語が、たとえ1秒でもあなたの心を動かしたなら、ぜひご連絡ください([[REDACTED-EMAIL]](mailto:[REDACTED-EMAIL]) / WeChat `ok502319984`)。私たちには物語も、コードも、実行力も不足していません。不足しているのは、長い道を一緒に歩んでくれる人だけです。

**コンテンツクリエイターへ** — 38プラットフォームへのワンクリック配信 + AES-256-GCMの資格情報暗号化が、あなたのコンテンツ生産ラインです。

**通りすがりの読者へ** — このプロジェクトにStarをお願いします。その小さな行為を、一人で歩く誰かに贈る朝の一筋の光だと思ってください。オープンソースの世界では、Starはソーシャル通貨ではありません。それは「私、あなたを見ていますよ」という信号です。

---

### エピローグ · 決して忘れない三つの言葉

このプロジェクトの最も辛かった夜に、三つの言葉が付箋に何度も書かれ、モニターの端に貼られていました:

> **資本は遅れても、コードは嘘をつかない。**
>
> **資金調達は失敗しても、オープンソースは失敗しない。**
>
> **一人の力には限界があっても、コミュニティに委ねられたオープンソースプロジェクトは、千の手によって書き継がれる。**

---

### 附録 · 技術決定の裏側

> _この部分は開発者に向けて書かれています。技術読者でない方は、この章を飛ばして「物語の続編」と「オープンソース共創ビジョン」に直接進んでください。_
> _技術読者の方へ、この章は IHUI-AI が 2025 年に下した 5 つの重要なアーキテクチャ決定—そしてその裏側の思考プロセスを記録します。_

一人の人物が Vibe Coding で 8 プラットフォームのコードを完成させる過程で、すべての技術選択には代償が伴います:**間違えれば = その後のすべてのコードを書き直す必要があります; 正しく選べば = その後のコードは自然に立ちます。**

以下は何度も問われた 5 つの技術決定です。

#### 決定 1 · AutoGen / CrewAI ではなく LangGraph なのはなぜ?

**背景**: AI Agent オーケストレーションフレームワークとして、2024-2025 年の主流は LangGraph、AutoGen、CrewAI、LlamaIndex Agents でした。

**選択**: LangGraph + MCP + A2A の三スタックシナジー。

**理由**:

- LangGraph の**状態機械モデル**は、AutoGen の「マルチエージェント対話」よりも複雑なビジネスフロー(課金・サブスクリプション・返金のような厳格な状態遷移が必要なシナリオ)に適しています
- LangGraph の**グラフ可視化**により、一人でも複雑なワークフローを debug できます(さもないと、エージェント呼び出しチェーンが暴走したときにどのステップで壊れたかわかりません)
- LangGraph は LangChain エコシステムと深く統合されており、100 以上のモデルをゼロコストで統合できます
- AutoGen は研究志向、CrewAI は単純タスクオーケストレーション志向—どちらもプロダクショングレードの商用アプリケーションには不適切です
- MCP プロトコルによりエージェントは外部ツール(ファイルシステム・データベース・API)を呼び出せ、A2A によりエージェント間で会話できます

**代償**: 学習曲線は急ですが、一度学べば以降の新しいワークフローはテンプレ化された複製になります。

> 💬 **議論**: → [#1 決定議論:IHUI-AI はなぜ AutoGen/CrewAI ではなく LangGraph を選んだか?](https://github.com/IHUI-INF-AI/IHUI-AI/issues/1)

#### 決定 2 · Prisma ではなく Drizzle ORM なのはなぜ?

**背景**: TypeScript ORM の主流は Prisma と Drizzle です。

**選択**: Drizzle ORM 0.38 + postgres-js.

**理由**:

- **TypeScript ネイティブ**: Drizzle のスキーマは TS ファイルそのもので、IDE 補完・型推論・リファクタリングがビジネスコード執筆と同様に動作します
- **SQL 透過**: Drizzle のクエリ文法は SQL に近く、debug 時に SQL を直接確認できます; Prisma の query DSL はひどいブラックボックスです
- **マイグレーション制御**: Drizzle の migration は手書き SQL で監査可能; Prisma の migrate は自動生成でブラックボックスです
- **パフォーマンス**: Drizzle には Prisma Client ランタイムオーバーヘッドがなく、クエリが直接 SQL にコンパイルされます
- **マルチテナンシー**: Drizzle のスキーマ分離 + RLS(Row-Level Security)の組み合わせがマルチテナントルーティングをより柔軟にします
- Prisma は 2024 年にも schema drift 問題がありました; DBA の安全網のない独立開発者は、制御性の最も高いものを選ばなければなりません

**代償**: Prisma よりエコシステムは小さいですが、十分です。

> 💬 **議論**: → [#2 決定議論:IHUI-AI はなぜ Prisma ではなく Drizzle ORM を選んだか?](https://github.com/IHUI-INF-AI/IHUI-AI/issues/2)

#### 決定 3 · Polyrepo ではなく TS Monorepo なのはなぜ?

**背景**: 8 プラットフォームのコード(Web / API / AI / CLI / Desktop / Extension / Mobile / Miniapp)について、monorepo vs polyrepo は生死を分ける決定です。

**選択**: pnpm workspace + Turborepo + 16 個の共有パッケージ.

**理由**:

- **型の整列**: 8 プラットフォームが `@ihui/types` を共有し、一つの型を変更すると 8 プラットフォーム全てに即座に伝播します; polyrepo の「型 drift 地獄」を回避します
- **アトミックコミット**: クロスプラットフォームの機能変更を一つのコミットで処理できます; polyrepo は 8 つの PR が必要です
- **依存性の一貫性**: pnpm workspace がバージョン一貫性を強制し、polyrepo の「依存性の断片化」を回避します
- **CI キャッシュ**: Turborepo のリモートキャッシュにより、独立開発者でも大規模チームの CI 速度を享受できます
- **共有 UI**: `@ihui/ui-react` + `@ihui/design-tokens` が 8 プラットフォームの UI を一貫させ、polyrepo では不可能です

**代償**: monorepo 設定は複雑ですが、一度設定すれば永続的です。

> 💬 **議論**: → [#3 決定議論:IHUI-AI はなぜ Polyrepo ではなく TS Monorepo を選んだか?](https://github.com/IHUI-INF-AI/IHUI-AI/issues/3)

#### 決定 4 · 21 個の pre-commit ガードレールなのはなぜ?

**背景**: code review も、QA も、CI チームもない独立開発者—コード品質をどう保証するか?

**選択**: 21 個の pre-commit + post-commit + 11 個のマイグレーション監査 + 9 個の PowerShell 起動スクリプト.

**理由**:

- **機械が人間の review に代わる**: 16 個のガードレールは API key 漏洩・i18n キー整合性・zh-TW 簡体字残留・ko 中国語残留・ja 残留・en 機械翻訳破損・schema drift・stale dist・UTF-8 BOM・API ルート一貫性・safeParse 無視・依存性断片化・skipResponseSanitization・border-radius 違反・配信レポート一貫性・マイグレーション完全性・CSS カラートークン入れ子・ネイティブ title tooltip・staged 汚染警告をカバーします
- **機械が人間の audit に代わる**: 11 個のマイグレーション監査スクリプト + post-commit 自動 push フックが「commit 後の push 忘れ」協業事故をメカニズムから根絶します
- **機械が DevOps に代わる**: 9 個の PowerShell 起動スクリプトが「プロジェクト起動」を「8 つのコマンド暗記」から「1 つのコマンド」に変えます

**代償**: フックが時に誤報しますが、誤報は見逃しよりマシです。

> 💬 **議論**: → [#4 決定議論:IHUI-AI はなぜ 21 個の pre-commit ガードレールなのか?](https://github.com/IHUI-INF-AI/IHUI-AI/issues/4)

#### 決定 5 · AGPL / 商用デュアルライセンスではなく Apache 2.0 なのはなぜ?

**背景**: オープンソース AI プロジェクトは通常 3 種のライセンスを使います: Apache 2.0(寛容)、AGPL(強力 copyleft)、デュアルライセンス(コミュニティ版 AGPL + 有料商用版).

**選択**: Apache 2.0.

**理由**:

- **AGPL は企業ユーザーを逃がす**: 企業法務は AGPL を見ると逃げ出し、これは「誰もが自分だけの AI プログラムを持つ」という本来の趣旨に反します
- **デュアルライセンスは分裂を意味する**: コミュニティ版と商用版が分裂し、「オープンソースは即ち平等」に反します
- **Apache 2.0 が最も寛容**: 企業はクローズドソースで使用・変更・商用化でき、著作権表示のみ要求されます
- **商用ループは SaaS / プライベートデプロイで**: ソースを閉じなくても稼げます—運用サービス・カスタム開発・プライベートデプロイで、クローズドコードではなく
- **真の防衛線はコミュニティ**: オープンコード + 活性コミュニティ > クローズドコード + 死コミュニティ

**代償**: 他人が fork 後クローズドで販売できますが、こうした fork は通常コミュニティがなく長生きしません。

> 💬 **議論**: → [#5 決定議論:IHUI-AI はなぜ AGPL/デュアルライセンスではなく Apache 2.0 を堅持するのか?](https://github.com/IHUI-INF-AI/IHUI-AI/issues/5)

---

> _これが 5 つの主要決定です。各決定の裏には、深夜 3 時に独立開発者が繰り返し天秤をかけた代償があります。_
> _もしこれらのいずれかに同意できないなら、Issue で議論してください—説得される用意があります。_

---

### 物語の続編(更新枠)

> このセクションは「物語の続編枠」として予約されており、以下のマイルストーンが起きたときに更新されます。
> **続編ルール**: 過去を消さず、新しい章を追加するだけ。このプロジェクトの誠実さはこのセクションから始まります。

#### マイルストーン checklist

- [ ] **資本マイルストン**: 最初の本当に戦略的投資が振り込まれた場合—投資家・金額・バリュエーションをここに正直に記録し、その道のり上の本当の感情を添えます
- [ ] **コミュニティマイルストン**: 創業チーム以外の最初の contributor が最初の PR を merge した場合—あなたの名前が物語に書き込まれます
- [ ] **ビジネスマイルストン**: fork がプロダクション環境で実際に動き、商業的価値を生み出した最初の事例—あなたの物語が、すなわち私たちの物語です
- [ ] **教育マイルストン**: IHUI-AI で AI 教育プラットフォームを構築し、正式に授業を行った最初の教育機関—すべての学生が自分だけの AI の先生を持てるように
- [ ] **国際マイルストン**: 母語が中国語ではない最初の長期 contributor—この信念が言語を越えるように

#### マイルストン達成時の運用 checklist(4 ステップ)

上記マイルストンのいずれかが達成されたら、以下 4 ステップを実行します:

1. **checkbox にチェック**: 該当 `- [ ]` を `- [x] ✅(YYYY-MM-DD 達成)` に変更
2. **新章追加**: checklist の下に新しい小節を追加し、マイルストン詳細を正直に記録(誰が・いつ・何を・当時の感情)
3. **4 言語同期**: `README.md` / `README.en.md` / `README.ko.md` / `README.ja.md` を同期更新(`scripts/scan-i18n-zh-residue.mjs` + `scripts/check-i18n-broken-en.mjs` ガードレールスクリプトで検証可能)
4. **commit + push**: commit message 接頭辞 `docs(story):`、AGENTS.md §21 の完全な push フローに従う(`git rev-parse HEAD` === `git rev-parse origin/<branch>`)

#### 資本マイルストン叙述ルール(誠実優先)

- **過去の叙述削除禁止**: 本物語章の「資本はついに来なかった」「2000 万人民元エンジェルラウンド報道されたが振込されず」などの内容は**削除禁止**—これらはプロジェクトの誠実度の長期証拠であり、将来の資金調達デューデリジェンスで最も強力な「創業者品性」証拠です
- **新資金を正直に記録**: 資本マイルストン達成時、新章に投資家名・資金額・バリュエーション・lead/follow 構造を明確に書き、歴史的報道の対比を「苦のち甘」叙述アークにします
- **誇張も隠蔽も禁止**: 資金用途・持分希薄化率・ベット条項などの機密情報は詳細を適切に省略できますが、虚構や誤導は許されません
- **タイムスタンプ**: 各新章末尾に `_最終更新:YYYY-MM-DD · <マイルストン概要>_` を付記

> _最終更新: 2026-07-21 · 物語初版_

---

> **AIは独占されてはならない。誰もが自分だけのAIプログラムを持てるべきだ。**
>
> **これは私たちの物語です。そしてもしかすると、あなたの物語でもあります。**
>
> **— ZhihuiAI · 李春川 · 長春**

---

## オープンソース共創ビジョン

私たちは確信しています:

> **AI は一部のプラットフォームに独占されるべきではありません。誰もが自分だけの AI プログラムを持つべきです。**

IHUI-AI はひとつの製品ではなく、**オープンソースインフラ**です。その存在意義は:

- **個人開発者**がより低コストで自分だけの AI アシスタントを構築し、データは完全セルフホスト
- **中小企業**がゼロから始めず、これを基にエンタープライズ級 AI 中台を構築
- **AI サービスプロバイダ**が成熟したマルチモデルプロキシ、課金、サブスクリプション能力を再利用し、業務イノベーションに集中
- **教育機関**が AI 教育フルスタックで教学を変革し、すべての学生に専属 AI 先生を持たせる
- **コンテンツクリエイター**がワンクリック配信プラットフォームで生産性を解放し、コンテンツ本体に集中

一行一行のコード、一つ一つの PR、一つ一つの Issue がこの目標を一歩近づけます。あなたが初学者でもベテランエンジニアでも、コードをコントリビュートしてもドキュメントでも、Bug を修正しても提案をしても —— あなたはこの共創エコシステムの一部です。

**Fork して、改造して、使って、自分だけのものにしてください。** そして改良をフィードバックし、次の開発者をあなたの肩の上に立たせてください。

これこそが AI 時代のオープンソースのあるべき姿です。

---

## License

[Apache License 2.0](LICENSE) — 自由な使用、改変、配布、商用利用が可能で、伝染性はありません。

---

## 謝辞

IHUI-AI の誕生は以下のオープンソースプロジェクトのインスピレーションとサポートなしにはあり得ません:

- [Next.js](https://nextjs.org/) / [React](https://react.dev/) / [Tailwind CSS](https://tailwindcss.com/) / [shadcn/ui](https://ui.shadcn.com/)
- [Fastify](https://fastify.dev/) / [Drizzle ORM](https://orm.drizzle.team/) / [FastAPI](https://fastapi.tocloud.com/)
- [LangGraph](https://langchain-ai.github.io/langgraph/) / [LiteLLM](https://litellm.vercel.app/) / [MCP](https://modelcontextprotocol.io/)
- [Turborepo](https://turbo.build/) / [pnpm](https://pnpm.io/) / [Vitest](https://vitest.dev/) / [Playwright](https://playwright.dev/) / [Locust](https://locust.io/)
- [Tauri](https://tauri.app/) / [Taro](https://taro-docs.jd.com/) / [WXT](https://wxt.dev/) / [Expo](https://expo.dev/)
- [Prometheus](https://prometheus.io/) / [Grafana](https://grafana.com/) / [Loki](https://grafana.com/loki) / [Jaeger](https://www.jaegertracing.io/) / [OpenTelemetry](https://opentelemetry.io/) / [Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Knip](https://knip.dev/) / [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

すべてのコントリビューターの皆様に感謝いたします。このプロジェクトを持続的に進化させてください。

---


## 最近の更新 (自動維持)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-21**
- 📚 ドキュメント:2026-10-21b 归档件改为逐字原文(去行号前缀,守门 166 归档豁免要求逐行相等) (8f5afeb38f6)

**2026-10-21**
- 📚 ドキュメント:AGENTS.md 2026-10-21b 重复副本归档件(55 行,零信息损失) (9ceac550c0a)
- 🔧 その他:摘除 3 条已勾滞留行(完成即删;G-922/924/927 撞号消解) (82807bca081)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (11f54b8d07e)
- 🔧 その他:刷新派生产物(README 数字块/最近更新/FA 数字 + ui-routes pin) (874e675890d)
- 🚀 機能/改善:落地 spec 项16/项18 两道 apiOrThrow 迁移验收门(混用 0 / 待验解包 0) (22c07dced5f)
- 🐞 修正:根目录白名单登记 .spec-mode(外部 spec 工作流在根自建) (03976f4f63c)
- 🐞 修正:Publish 三屏门83 存量清零 + 门39 白名单补登 (b7d7a151c70)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4493f94b4d4)
- 🐞 修正:12 屏批次三道门收口 —— 门150 角色档 21 族归零 + 门83 R2/R3/R8 存量清零 + 门39 十三条 RN 独占白名单 (e17289f18c3)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d1c5ca1ab8)
- 📚 ドキュメント:归并 O 族 7 组重复小节标题 + 翻勾 G-927/G-922/G-865 三枚已交付票 (6bc77bd8026)
- 🐞 修正:WebView2 创建失败出口先提示用户再自动退出 —— 双击无反应时给出可操作提示 (ccbc9924a5d)

**2026-10-21**
- 🚀 機能/改善:D38 侧边队列宿主接线(流式中发送入队/交互条渲染/流结束出队补答) (ddfcb16bbce)
- 🚀 機能/改善:生产签出外来工作只读尺子装车(尺子+12例镜像测试+巡检双挂点) —— 未跟踪洪水只计数不判定,结论行新增 untracked 字段;抓到生产签出 12 枚远端没有的已暂存新文件 (e7581c4ee0f)
- 📚 ドキュメント:extension/cli/miniapp 分区注释与 models --all 帮助文案对齐 2026-10-21 isArchivedModel 新判据(standard 不再折叠)——8 处滞后旧语义收口 (2512a6b8ee7)

**2026-10-21**
- 🐞 修正:补回被合并 fba604cf4a 吞掉的四枚文件 (41015953631)
- 🐞 修正:抽屉底部 UserRow 与 web 对齐 —— 上下对称 8px (ef3f4cad032)
- 🐞 修正:reset 判据改看被丢的那一枚 —— 备份过的 reset 不再恒红 (fe1031d8df1)
- 🚀 機能/改善:TS 增量缓存整体请出源码树 —— 回收站灌入的最后一格根治 (2094d275c70)
- 🐞 修正:stagedTriggers 支持 glob —— 97/98/102 三道 blocking 门不再隐形跳过 (b981746fd9b)
- ♻️ リファクタ:本地 api<T>() 手抄壳迁移第 4 轮 —— 103 枚壳 + 55 枚调用方改读单源出口 apiOrThrow(逐字裸转发才迁,7 枚 ApiError/errorCode 特型点名不迁) + ui-routes 派生钉随源刷新;验证:typecheck 基线 1 错不增、touched 全量 eslint/prettier 0 问题、URL 字面量多重集守恒、门 105 预飞 matched (0d0e601d3cc)
- 🐞 修正:策略器补空枚举反证与四态自检,两处"NukeOnDelete 不约束"旧断言按实测更正 (c2a82df9db0)
- 🐞 修正:侧栏底部用户行容器改纯色底、上下内边距对称 (b8464f6946f)
- 📚 ドキュメント:G-939 收口 —— 吞并枚复现(单亲非 FF relay 重写,非合并)+ 丢失集守卫已接 casUpdateRef(枚 feb0cd072d),镜像 8/8 回归全绿,翻勾 (cf68170f569)
- 🐞 修正:G-939 丢失集守卫接进 casUpdateRef 共享咽喉 (feb0cd072d1)
- 🐞 修正:ui-routes 产物自述钉刷新 —— 门 105 唯一红 G5 清零(派生产物,web 源码零改动) (51c09d5d1c7)
- 🐞 修正:ui-routes 产物自述钉刷新 —— 门 105 唯一红 G5 清零(派生产物,web 源码零改动) (dc4ab093c12)
- 📚 ドキュメント:票60 普查批收口 —— 普查段 5 座 store 全部定档落地(4 座窗格化+business-forms 先前收窄)、发送链 paneIdForChatStore 反查、六座实例随叶回收、残余② advance.retryable 补 toast,残余归零本行翻勾,枚 ce88ed459c (b638680a880)
- 🐞 修正:给"删除不落回收站"这道闸门找到主人,并把树内再生缓存从 KEEP 里分出来 (69b2d7ba724)
- 🚀 機能/改善:票60 普查批 —— 剩余 4 座全局 store 逐座定档按窗格寻址 + 发送链按 chatStore 反查伴生态 + 六座实例随叶统一回收 + 非根 advance.retryable 补 toast (ce88ed459c0)
- 🚀 機能/改善:侧边栏与 web 端全量对齐(第六批,web 端零改动) (86b96f6d180)
- 🐞 修正:11 枚脚本改走 face-reader 取材 —— 清偿"裸 git 派生生产文件"棘轮的 11 处新增 (8d8bae27a22)
- 🚀 機能/改善:侧边栏与 web 端全量对齐(第六批,web 端零改动) (eca62eeb4b2)
- 🐞 修正:切流受阻告警的"宽限窗超期转正式告警"永远到不了期 —— 45 分钟登录 500 一封信都没寄的第二根因 (38d2f44a10d)
- 🐞 修正:模型选择器"调不通的还在显示、能调通的没显示"三处根治 (624e5a7a904)
- 📚 ドキュメント:agent.md 补同源与适用范围声明 —— 消 §0.6 第二份真相、限定 §0.8 那条承诺 (4b0aeb7a033)
- 🐞 修正:api-migration 门与镜像测试跟上现役端点(/api/agents/my),[8/8] 的 Windows 崩溃码显式未判定 (6a0f666c6b7)
- 📚 ドキュメント:本侧 G-926 未勾旧行对齐为对侧已勾版 —— 该票已由 chore(gates) 归档出口件枚落地,union-converge 的折叠层拒裁的两态并存属本侧滞后,按远端事实对齐 (a87bb0dad85)
- 📚 ドキュメント:修正 README 与代码相反的默认值 —— 写着 default https://api.aizhs.top,实际 src/config/defaults.ts:27 是 http://localhost:8802 且无内置公网域(§0.8:文档不得写跑不通的出路;取证席全仓扫"写死慢臂基址"时顺带挖出,无用例钉该句,watermark verify 1/1 无损) (13577fcf824)
- 📚 ドキュメント:G-866 就地翻勾结清 —— 同一 URL 连打三次实测 EO 默认遵守源站 s-maxage 缓存 /api(第2/3次 HIT,Age 4/8);此前"两次都 MISS"是我自己的测试缺陷(第一次带随机 cache-buster ⇒ 两个不同缓存键),免控制台即判,不消耗免费版唯一规则额度 (ffc80eb00cb)
- 🔧 その他:课程域死端点清账:附件屏换源 /api/resources、删除 members/:id 与 categories/tree 死函数、修 CourseScreen tags 悬空崩溃 (64747d0733c)
- 📚 ドキュメント:票60 补 e2e 收口注记(双流式 3 例枚 8e45f91a6f; G-935 已由 23b7ae8164 翻勾并被 509c7cc1d8 完成即删摘除, 行内指向结清; 本行不翻勾, 残余仍为 advance.retryable 静默 + 普查 5 座全局 store) (3f743381590)
- 🔧 その他:G-926 翻勾(B 档 62 枚全收尾,守门 13/13,按 heal 纪律不删行) (1e96e49cac1)
- 🚀 機能/改善:npm-bootstrap 增加 org_create 动作(真 Chrome+xvfb 网页代行建 npm org) (05c80ad3f76)
- 🐞 修正:form-request 捕获改用 JS fetch 覆盖绕开跨域预检拦截 (adab5bf9597)
- 📚 ドキュメント:补 R4 点名义务 —— 本批四件器物(出口 IP 巡检尺子 / 部署收尾预热 / 公开接口缓存头唯一出口 / 源站直连守卫)在根 README 逐条点名,写清判据、自检与"判机器状态一律不接提交链"的定级理由 (b11f1599de9)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (044ca7cdc63)
- 🔧 その他:RN 课程域第二程:目录/章节/评价三屏换源 /api/learn —— api-client 新增 getCourseCatalog/getCourseComments 出口(详情再投影 + rates 端点,口径与旧 /api/courses/:id/* 逐字同,绕开正被清除的注册面),课程详情报名成功即补拉学习进度,CourseCatalogItem 补 videoUrl 挂点;顺清 memory.ts 存量 eqeqeq x4 (a48f62d5def)
- 🐞 修正:release-sdk 补 @ihui/types 构建前置 + NPM token 改名取自 NPM_PUBLISH_TOKEN (790cec5b53d)
- 🔧 その他:让号收口 F9 撞号 —— G-922 让给 G-1162551(归并前置,零删行) (6ce7934a1d2)
- 🔧 その他:G-865/G-935 翻勾(完工事实在链,按 heal 死循环纪律不删行) (23b7ae81643)
- ♻️ リファクタ:G-929 恢复开放面留存(带完工注记)—— heal 死循环下唯一双绿稳定形态 (3d174f989e2)
- 🔧 その他:收编 agent.md 机主指令件与 tauri 两枚权限生成物入库 (f5b5bfa1b82)
- 🐞 修正:一枚真代码回归 + 一枚门停在旧世界 + 两枚测试在干净检出上取证不了 (ba2aa4070d7)
- 🐞 修正:修 checkin 空状态与侧边栏导航对齐两处 CI 红 (29c9ec7ad75)
- 🔧 その他:票60/G-935 双流式互不顶补上真机核验 —— 新增 chat-pane-parallel-stream.spec.ts 3 例(① 两格并发流式交错推送,增量只进自己那格且终态逐字等值 ② 反证 两条流在同一瞬间都活着、甲收束不牵动乙 ③ 停止只 abort 自己那一格,乙照样跑完);自控 fetch 泵逐帧推 Response(ReadableStream),读环/行缓冲/parseStreamLine/水位闸/abort 归因全走生产码;传输面按 frameContents 抽 content 后逐字断言(整帧原文 join 数学上不可能含连续 payload);全链 page.route mock 不依赖活后端,连跑两轮 3 passed / 3 passed (8e45f91a6fb)
- 📚 ドキュメント:停摆工作树收口 - 五份活文档三方归并 + AGENTS 体积搬出(消门 207 与门 89 R4) (bab1bf4c6ce)
- 🐞 修正:六枚镜像测试 + 一枚门 —— 有人是"测试停在旧世界",有人是"干净检出上不可能满足" (077d01f6c53)
- ♻️ リファクタ:G-929 指针注记化(破 heal 死循环:窗口滚动后删行必被判无凭据减少) (8dfbca5b45a)
- 🔧 その他:课程学习进度全链接线:详情端点补真实评分与小节时长秒字段,api-client 课程域收口到 /api/learn 小节制进度/心跳,播放器 15s 节流心跳+标记完成走自动完成契约,课程详情清单按小节渲染 (d510ab99efa)
- 🐞 修正:用户自装的 mmcode 自愈脚本不是 agent 污染 —— 显式豁免 (18c81b13af9)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3cb5fd123b4)
- 📚 ドキュメント:回补 32 枚 PROJECT_PLAN 归档锚点件入库 (aba30748621)
- 🔧 その他:G-929 完成即删摘行(二翻勾配平后) (ad31c98c3fa)
- 🐞 修正:免费旗舰 :free 变体救回为 latest 档(免翻折叠区) (4cb7f72a253)
- 🐞 修正:把 glass 两档登记进跨端 token 对账 —— 暗档手抄白值的漏登记当场补上 (688d894ae42)
- 🔧 その他:G-929 二翻勾(配平 2 笔历史无凭据减少,完工事实不变) (8bc3d0ff549)
- 📚 ドキュメント:G-870 就地改写为终稿 —— 用户可见缺陷本身已按"不依赖控制台"的路径修掉(web 补 /uploads 精确代理 + FILE_CDN_BASE 改判 www 快臂),剩这一格只做"历史死链自愈+微信 applinks",并如实写明为什么我这边推不动(zone 记录改指隧道只有 CF 登录态一条路,本机无 token 且内置浏览器面板 visibilityState=hidden、行内下拉合成事件不弹) (600f2c61b68)
- 🔧 その他:登记 line-loss「已收拢」判据缺第三形态票 + 摘 G-79 S1 行 (1a03a2cc5aa)
- 🔧 その他:G-929 完成即删摘行(翻勾后整行删除) (a0713703c2f)
- 🔧 その他:G-929 翻勾(暖色门 --root 收口,镜像 28 红全消) (833ed224c9b)
- 🐞 修正:把 /uploads 精确前缀补回 web 代理 —— 实测快臂上公开文件结构性不可达(探针文件 8802/api 臂 200 image/png,www 臂 133KB Next 404 HTML) (7f94692c39f)
- 🐞 修正:暖色描边门支持 --root 显式被审仓根 + 落地器透传 —— 镜像套件 28 红全消(66/66);镜像 M16 三态+双向变异验证 (ad02ccba7df)
- 🔧 その他:撤回本席对锁票的翻勾(单方面 [x] 会造出 F1 同主键两态并存,顶死 union-converge) (ccc117c72ea)
- 🔧 その他:G-79 结清 + 锁票改判消 F1 两态并存 (96ddaeadfcd)
- 🐞 修正:清偿三盏存量红灯 —— mobile-rn 未用导入 / i18n 过期契约声明 / OpenAPI 产物漂移 (a89a26f1dfc)
- 🔧 その他:解推送车道的一枚阻塞 —— 按**远端逐字节原值**恢复一枚被两侧判成"本侧删除"的临时件 (ea325b1eeac)
- 🐞 修正:删掉自己用例里的一处类型红(noUncheckedIndexedAccess) (e4098efc4b9)
- 📚 ドキュメント:登记 file.aizhs.top 那一半还没修的死链(决定性差分已量:同刻同服务 api 200 / file 502,隧道第5条路由本已存在⇒病灶在 zone 记录)与"为何选改记录而不选改 .env" (b9898ddc450)
- 🐞 修正:余额为 0 不再等于通道不通 —— OpenRouter :free 模型从选择器复活 (9fa52f020c2)
- 🚀 機能/改善:服务自愈第三格"连续六小时量不到"也接到人 —— 报的不是服务坏了,是看守层瞎了 (ef064b20659)
- 🔧 その他:deploy-lock flaky 归因取证做实 + 摘 1 条 S1 滞留已勾行 (afbfec0699f)
- ♻️ リファクタ:本地 api<T>() 壳首批迁到 apiOrThrow 单一出口(L7162 第一批 14 枚) (44c476593a4)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a8d78bbbd57)
- 🔧 その他:给门 231 涉事判据喂测试桩 —— 夹具仓的树真门读不到,26 条端到端因此全红 (f7cb10c3396)
- 📚 ドキュメント:再补三条会打死全站的事实到运维档 —— 公网两臂都得活着(WS 只能留慢臂)/ EdgeOne 现无源站组(源站守卫能上线的前提)/ 别设 assetPrefix(CSP 会把跨域进来的脚本全拦) + React19 自动 preload 的真实成因 (c234639641d)
- 🚀 機能/改善:源站直连守卫上 EdgeOne —— 8801 直填家宽 IP 之后 Host 为裸公网 IP 的直连请求一律 403,失败方向全部 fail-open (e6a318d38fa)
- 🔧 その他:让号收口 F9 撞号 —— G-927 让给 G-1142551(归并前置,零删行) (67f45124bfa)
- 🐞 修正:名单外那台的信必须带门 153 已判出的问题行 —— "它停了"不可整改,"它的 exe 不存在"才可以 (eca627cb50c)
- ⚡ パフォーマンス:营销/文档页初始 JS 减 2,529KB raw / 523KB gz(三页各测) —— 把 BrandIcon 全集与 three 栈移出阻塞路径 (3c5a06a71ad)
- 🚀 機能/改善:手机端 REST 切快臂(实测 ttfb 差 1.3~7.0s),实时通道显式钉回 api 臂并写死"两臂都得活着" (542ec2105ec)
- 🐞 修正:归属账按 T10 摘除 B 档两条(.ihui-agent/tmp/outputs 已零命中) —— 陈旧放行凭据:盘上副本 = git show HEAD:该文件 ⊕ 这一处编辑,diff --numstat 1 插 19 删(scopeNote 摘记 1 行 + 两块 B 档条目体),无第三方行被写回;T10 点名后依 §0.7 删条目,尺子 13/13 (12612c2115f)
- ♻️ リファクタ:把纯 IP 判据从带 node:dns 的 ssrf-guard 里分出来 —— 为 Edge 侧消费铺路,行为零变化 (01af3886c24)
- 🐞 修正:摘掉 user.ts 里重复注册的 POST /user/ip-whitelist(HEAD 起 API 启动即 FST_ERR_DUPLICATED_ROUTE,本地全栈无法起) (8c41e92a62f)
- 🔧 その他:G-926 完成即删摘行(翻勾后整行删除,已勾行进不了守门 71 保护集) (41aa033ba63)
- 📚 ドキュメント:登记 2026-10-21 下午对齐第二轮(6 枚已入库;新派单:web ja/ko 机翻坏文按块清) (6498675ca80)
- 📚 ドキュメント:同轮收口登记 —— IP 白名单生效链、RN 管理面、五项护栏按人生效、小程序关于页、两条假端点删除 (5b3fe1f3c67)
- 🔧 その他:G-926 翻勾(B 档收口:60 枚取消跟踪 + 落地器删除档 + --self-test,三态复量全绿) (61062533365)
- 📚 ドキュメント:把 agent 护栏的过期自述与契约产物一起对齐到落地后事实 (1cd867fbf80)
- 📚 ドキュメント:L7220 桌面僵尸实例 P1-P3 进展登记(欠双实例现场复现,不翻勾) (5fa9b4c4120)
- 📚 ドキュメント:G-865 就地翻勾结清 —— DEFAULT_AVATAR_URL 死键已摘(枚 9410970ece45ddc00be11886f7d607ea2399f1f3,三处同批改,用例 9/9 与 shared tsc RC=0 为凭);行仍留 HEAD 等"完成即删"兜底轮摘除 (98c4de50b7a)
- 🐞 修正:僵尸实例三块补丁 —— preflight 填账可观测 + 启动相位只等不杀 + 事件循环后置健康门(L7220) (b2d6ff56ed3)
- 🔧 その他:摘掉 DEFAULT_AVATAR_URL 死键 —— 指向恒 502 的 file.aizhs.top 且消费方已归零(门 121「声明必须有消费者」) (9410970ece4)
- 🔧 その他:G-926 完成即删(B 档 60 枚已取消跟踪 + 落地器删除档 + --self-test,三态复量全绿) (76e1128fc98)
- 🚀 機能/改善:关于页三端同脸 —— 小程序补齐 web/RN 那六段结构 (a21108a3f46)
- 🔧 その他:无损折叠同行叠同一注记超额 26 份(7 行,方法学承 92b5d876) (31323b5d355)
- 📚 ドキュメント:§0.9 点名义务 —— 把本批三件新器物写进运维工具档(出口 IP 漂移尺子 / 部署收尾预热 / 公开接口边缘缓存头),并注明"判机器状态一律不接提交链" (1b6ab6e6188)
- 🚀 機能/改善:落地器 --self-test 自含电池(7 例,票面"带 --self-test 与镜像用例"收口)+ 镜像 T10 (04473df2771)
- 🐞 修正:摘掉指向死源站 file.aizhs.top 的用户可见素材引用 —— 该域名不在我们隧道上,恒 502 (bafa2de7790)
- 🐞 修正:页脚小图不再抢首屏连接 + docs 七页 21 条内链改 Link —— 根因是 React 19 SSR 对任意非 lazy img 自动发 preload (217a8998e64)
- 📚 ドキュメント:立票 —— 裸 git 派生棘轮 76→85(本席那一枚已改走 face-reader.gitRaw 并落地,读数随 86→85);行内写清取新增者名单的命令与两个实测坑(rev: 前缀要先剥、注释里的字面量也会被数进去),并注明存量清零前只报数 (df979a1eb27)
- ♻️ リファクタ:清扫器的派生 git 改走脚本层 —— 镜像套件里"裸 git 派生的生产文件只减不增"棘轮现读 76→86,本文件是新增者之一(我昨天落它时直接起 git 进程)。改法 = 那个 git() 帮手委托给 lib/face-reader 的 gitRaw(同时白拿它的超时/stdio/quotepath 纪律);注释里也不许出现裸调用字面量,否则棘轮正则连注释一起数(第一版就是这么"改了还在名单上")。现读:自检 15/15、镜像 12/12、预演 state=clean、eslint/prettier/watermark 全清。棘轮剩下的 9 枚新增者不在本席射程(逐枚归属见 git diff 14a04f013f..HEAD 那一族),已按实测另立条目 (35be7331286)
- 🚀 機能/改善:公开只读 GET 接口加边缘缓存头 —— 审计 P1.3 那一格,取值与写头收在唯一出口 (42e21bacda0)
- 🚀 機能/改善:安全中心接 IP 白名单管理面,并修掉 web settings.ip 的 ja/ko 机翻坏文 (29cdd1c00bf)
- 🚀 機能/改善:部署收尾预热 EdgeOne 真装车 —— warm-prod-cache.mjs 自落地起全仓零调用方,属"造好没装车=没有"(§0.9) (4eaefdde4bc)
- 🔧 その他:hooks-extended 修 Windows 读-写竞态 —— 钩子文件等内容非空而非仅等存在 (706847132c9)
- 🚀 機能/改善:家宽公网出口 IP 漂移装上看守 —— EdgeOne 源站直填 IP 之后全仓零器物,一变即全公网 5xx (030483ced98)
- 🐞 修正:同题多号存量 8 组 26 行收拢清零(机主授权@2026-10-21) (0eb36182652)
- 🚀 機能/改善:五项安全开关改为按登录主体生效(硬门与 kill switch 不受用户档影响) (59ea36eb632)
- 🐞 修正:exec 族出 stdio 维度射程 —— 回退 hooks-auto 的 exec stdio(ExecOptions 无该字段),姊妹门 classify 加 exec 排除层 (b6281fcacda)
- 🔧 その他:取消跟踪 60 枚 tracked-but-ignored 临时件(B 档:56 枚 plan-pointer-purge 取证流水 + 4 枚 outputs;LAND_REMOVE_PATHS 首用) (988a243cd12)
- 🐞 修正:补回 32ce073019de6d750a65133aec3146752ff3e655 自己造成的回归 —— 我用 prettier 重排该文件时把 `const HEADING = /…/gm` 折成两行,而镜像 next-plan-id-remote 的 T5/T6 从源码里抽这颗字面量复用(§22c),抽取一失败两条就从绿变红;上一枚报的"6/6"是重排**之前**量的,当时已失效。修法 = 注解写明形状承重 + `// prettier-ignore` 紧贴该行(注释与 const 之间留空行 = ignore 不生效,第一版就这么没成),并把量词写成 `{0,}`(与祖先逐字相同会被门 84 判"复活行"假阳,这里是等价改形)。现读:prettier 通过、next-plan-id-remote 6/6、plan-id-duplicates 6/6、plan-id-lease 9/9、--check rc=0、watermark 零残迹。教训钉进注释:核对顺序必须是 改 → 全跑 → 再落地,格式化也算改 (5a9d8f26d9e)
- ♻️ リファクタ:删掉 PDF print/sign 两条假端点(全仓零消费方) (d22063dd4e6)
- 🚀 機能/改善:落地器暴露 LAND_REMOVE_PATHS 声明式删除出口(G-926 器物侧) (f20d7354f0e)
- 🚀 機能/改善:IP 白名单生效链接入 18 条新登录腿(只拦新会话、留自救出口) (9383e4645a2)
- 🔧 その他:G-1162551 第三次改判留勾(清扫⇄回捞连抖,不再摘第二次) (80d437743b8)
- 🐞 修正:服务自愈「重启预算用完」终态接到人 —— 45 分钟 boot 崩曾一封信都没有 (4f9371871d5)
- 🚀 機能/改善:打通历史课程视频的播放链 (506f115c1b1)
- 🔧 その他:G-53 与 L6762 结清翻勾 (f029adf6f52)
- 🚀 機能/改善:把 history-read-ops 真挂进 ihui chat history(L6762 的真缺口)并钉装车锁 (172aba73338)
- 🚀 機能/改善:补齐流式中换档即终止的腿(G-53 唯一真缺口,四端同判据表) (b00e5766c55)
- 📚 ドキュメント:立票 —— 旁路落地器镜像套件红 26 例的根因(门 231 --rev 按自身仓根解析树 oid,测试通道换仓时该 oid 在主仓不存在 ⇒ exit 2 ⇒ 落地器 fail-closed 拒 ⇒ 用例整批红;生产面不受影响)。成因枚 e1f18b5a32070c9ab14f71187b963fc3de95c3ca,归属该门持有席(它此刻正被并发编辑);两条出路都写明,并禁止用"摘门/加 skip"消红 (5ea8c7ae9c0)
- 🔧 その他:给关于页补行为级自证套件(§17 不许只凭代码审查声明改好) (7561a8b9092)
- 🐞 修正:摘掉 drawer-nav 三枚无人使用的 lucide 图标 (adadf82b37c)
- 📚 ドキュメント:D18 SDK 发布尝试被 npm 拒的真因登记 (3b64f1fa79e)
- 📚 ドキュメント:常驻工具清单点名 audit-pane-store-addressing.mjs(只读普查尺子,未接提交链也不接巡检轮 —— 它判的是"该不该按窗格分"这类人要读的归属,挂 blocking 即 §12e 恒红门) (7fbaea08b2a)
- 🔧 その他:补一把只读普查尺子 audit-pane-store-addressing.mjs(票60)—— 从"会进非根窗格的子树"(ChatPaneBody/MessageList/MessageInput,含 @/hooks,depth 可调)做 import BFS,列出现存 store 与三态窗格通道(自带 ForPane / 被注册表 import / 无),另给归属代理(状态形状里有没有会话或消息为键)。刻意**不接提交链也不接巡检轮**:它判的是"这枚 store 该不该按窗格分",那是人要读的归属问题,挂 blocking 就是 §12e 恒红门(同 check-temp-landing / alert-volume-report 那一档);取材失败显式 exit 2「未判定」不记绿。现跑读数:子树扫 40 个文件、引用 12 枚 store,已有通道 2(chat 经注册表、progress-jump 自带)、无通道 10。isDirectRun 走 pathToFileURL(§22d),eslint/prettier/watermark/门 221 全清 (0ff18ec7258)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (eba4bcb57ec)
- 📚 ドキュメント:G-53 持有行复量 + 旧号 68 孪生行补副本指针 + L6762/L28828 处置留痕 (2069ae3d9fc)
- 📚 ドキュメント:票60 行补非根窗格 store 普查读数 —— 子树 12 枚:已有通道 2(chat 经注册表、progress-jump 自带)、按设计属全局 3(auth/auth-store/navigation)、以会话或消息为键因而天然安全 2(ai-panel、d180)、要逐座定性的 5 枚点名(business-forms 的 clearForms 清全部 = 任一窗格切会话抹掉别窗格填一半的业务表单,是用户可见数据丢失;context-mention;conversation-detail-mode 名实待读;mode.ts;timeline-store),并写明判据与片 5 同形(能寻址的走 usePaneChatStore,只能按会话归属的把 conversationId 写进键里、清理动作按键收窄,不得整表 clear) (6789a60c66a)
- 🐞 修正:诊断清单的 `[object Object]` —— 我把 notOk 改成对象后漏改了一处映射 (e884297f30f)
- 🐞 修正:删掉 user.ts 里只会回显的 POST /user/ip-whitelist 空壳 —— 它与 security-config-routes 的同路径真实现同时注册,Fastify 抛「already declared」⇒ IHUI-API 崩溃循环 60 次、8802 未监听、登录全量 500、部署环健康门禁 8 轮不过已回滚 (7078c88d956)
- 🚀 機能/改善:跨端对账门补 CSS Module / CSS-in-JS 取用形态覆盖面(CS 维)—— 收 L28828 空白② (ba9f1bca74f)
- 🐞 修正:补回上一枚漏掉的类型标注 —— pane-tail-consumers 的 assistant() 工厂返回 ChatMessage(字面量 role 不做返回类型标注时 tsc 判 string 不可赋给联合类型,3 条 TS2322 随 cca856a67c 落进了 HEAD)。教训自己钉住:vitest 绿不等于 tsc 绿(测试文件的类型不在 esbuild 编译路径上),落地前必须单独跑一次 tsc 并按文件过滤归因。修后 tsc 现读 2 条错误均属他席在飞(panels/page.tsx headerExtra、status/models-section 工作树缺),本枚文件零命中;3 例仍绿 (fcdb043e85f)
- 📚 ドキュメント:票60 行残余① 收口 —— 长尾四座已窗格化(枚 cca856a67cededa438319b203c4f233ff1437b05,成对 3 例 + 变异对照全红,宽档 1710 例绿),3 座按边界 1 只根窗格渲染 + 侧栏族按设计属全局面 ⇒ 不窗格化的理由写进行内;同枚修掉 D184 源码字面量锁的假阳成因与反证 (c2aa045c2af)
- 🚀 機能/改善:票60 长尾四座窗格化 —— 朗读腿(voice-stream-speaker)/画布覆盖层(canvas-overlay)/采样参数面板与按钮(sampling-params-panel)/连接态入口(agent-progress-trigger)改读 usePaneChatStore:它们经 MessageInput/MessageList 进非根窗格,原先读根单例 ⇒ 在非根窗格里显示与写入的是根会话的参数/正文/消息流。成对 3 例:① 根窗格流式收尾不触发本窗格、本窗格自己过 done 边沿才播 ② Provider 外仍读根单例(单窗格形态逐字不变)③ 形状锁钉四座不再引用根单例;变异对照(把朗读腿改回读根单例)3 条当场全红,还原后逐字节相同。顺手修 D184 那条源码字面量锁:票60 片 4 起 detail 里多一个 paneId,旧逐字单行断言把合法代码读成"没派发"(HEAD 面实测红),归一化只吞排版(折行+尾逗号),事件名与 text: selectionText 仍逐字钉住并补两型反证。176 文件 1710 例绿,eslint/prettier/watermark 全清 (cca856a67ce)
- 🚀 機能/改善:侧边栏与 web 端全量对齐(第五批) - 抽屉补 57 条 web 缺口+移动端独立分组, 域 hub 补 12 条 edu/content/trade, 五语新增 5 个分组键 (e1005d41cdd)
- 🚀 機能/改善:侧边栏与 web 端全量对齐(第五批) - 抽屉补 57 条 web 缺口+移动端独立分组, 域 hub 补 12 条 edu/content/trade, 五语新增 5 个分组键 (fed40bbacb2)
- 📚 ドキュメント:同轮补的后端读写面、门户两条缺页与记忆详情 WebView 承载登记 (83b1e59b5dc)
- 📚 ドキュメント:登记 2026-10-21 RN↔web 全量对齐收口轮(本轮 3 枚已入库;IP 白名单与 agent 护栏的生效链待拍板) (bc93cac4af3)
- 🚀 機能/改善:门户补两张缺页 + 记忆详情走 WebView 承载 (ef7cc1697a0)
- 🔧 その他:夹具的 git 身份落进仓库 config —— CI 干净检出没有全局 user.*,21 枚用例在第一步就抛 (f7043438ed4)
- 📚 ドキュメント:票60 行残余① 从"13 处"收紧到现读分档 —— 真会串 4 座(sampling-params-panel / agent-progress-trigger / voice-stream-speaker 经 message-input,canvas-overlay 经 MessageList+artifact-canvas),3 座按边界 1 只在根窗格渲染(compaction-status-bar / d176-task-recap / task-monitor-sections,把它下面板化时要与片 3 数据面同批改),4 座按设计属全局面 ⇒ 下一片射程=那 4 座,判据同片 5 的两种形态 (a4e07eccbe4)
- 📚 ドキュメント:票60 行就地改写 —— 残余② ProgressJumpStore 已窗格化(枚 d01bc20577c0b7075b0f8e5d14e7058b3730c94b,成对 7 例 + 变异对照 5 红,268 例绿);残余① 13 处根单例消费面定性清单留在行内 (5a680ada9b8)
- 🚀 機能/改善:票60 残余 —— ProgressJumpStore 按窗格寻址(照 usePaneChatStore 同一形态:状态配方只有一份 buildProgressJumpState,根单例与各窗格实例都由它构造,nonce/highlightTimer 挪进实例闭包) ⇒ 任一窗格消费后 clearPendingJump 不再抢走别窗格那次跳转、高亮与 PlanStep↔Message 联动映射不再跨窗格串;Provider 外仍恒返回根单例(单窗格调用面逐字不变),空 paneId 抛错不静默回落;消费面 5 处改用 useProgressJumpStoreForPane(pane-gate 那枚既有用例的观测面随之改挂到该窗格实例,断言未放宽)。成对 7 例含变异对照:把 getProgressJumpStoreForPane 改回返回根单例 ⇒ 5 条当场红(还原后逐字节相同);34 文件 268 例绿,eslint/prettier/watermark 全清 (d01bc20577c)
- 🔧 その他:L7177 区段头折行回潮改判留勾(不摘第二次) (94a133dc824)
- 🔧 その他:五枚摘后被自愈按未勾补回的行改判留勾(回潮型,不摘第二次) (190ad482554)
- 🔧 その他:重钉 web ui-routes 自述钉(承接大屏 13 处红字改档) (994d9dd6da1)
- 🔧 その他:九枚本机也红的镜像测试 —— 八枚是"测试停在旧世界/测量缺陷",一枚是共享判据的漏判 (d3646d3b255)
- 🐞 修正:大屏 13 处红字改走 danger 角色档 —— 真浏览器逐元素量出来 text-destructive 亮档只有 3.64(两档同值 #ff3333 是漏网的一族),换档后亮 5.65~6.47 / 暗 5.73~6.29 (a7a68146729)
- 🐞 修正:lucide-react-native 强制单实例；底栏取源方式定档留痕 (036f52bce07)
- 📚 ドキュメント:G-924 就地改判 —— 那 10 条取不到的图标 URL 全是零消费方死键,不是用户可见破图(出路改按门 121 摘死键) (9496f924ab9)
- 📚 ドキュメント:G-934 结清(接线枚 c5b3f0f65d9c7a6979b476bcce16e67caad34822 + 23/23 与 211/211 复量 + §17 真浏览器核验枚 82c9a68ae0f2acf61a84b709caa5ed4d4bce8cd3 + README 同步枚 c9e4a15681437b1d2efb595944a0b3a69072cbbb);G-935 记第一枚 e2e 与产品定档(维持"拆分=承载既有会话",不改真分叉;双流式/工具面板仍无用例 ⇒ 不翻勾;窗格会话 write-once 使更强形态结构性不可达,以 annotations.gap 点名);票60 行补现读残余(13 处根单例消费面定性清单 + ProgressJumpStore 未窗格化) (a96c36ad4c2)
- 🚀 機能/改善:关于页照 web 补齐六段内容,合规 7 项改走 i18n 取词 (cd57f5d3d38)
- 📚 ドキュメント:把 HEAD 面体积收回 96,000 预算内(96618→95854) —— 按 §1 两步走逐字留痕搬出两行:207 的旧档(warn 起步/50KB,已被同段"定档更正"整段取代)与一枚重复的压缩版页脚,去处 .ihui-agent/archive/AGENTS_trim-2026-10-20.md(同族追加,原位置留 HTML 指针注记) (b16c42f5261)
- 🔧 その他:票60/G-935 多窗格与滚动位恢复补上真浏览器核验 —— 新增 chat-pane-split-scroll-restore.spec.ts 4 例(① 切走再切回落点±60px 内且非零 ② 反证 短会话不冒充恢复 ③ 拆分后两格各有独立消息列表 DOM ④ 反证 同一会话双窗格 scrollTop 各记各的 |Δ|>200 + 根格切走切回恢复自己而 pane-1 不动);全链 page.route  mocked 不依赖活后端,PLAYWRIGHT_REUSE_SERVER 连跑两次 4 passed/4 passed;④ 更强形态(pane-1 也切走再切回)按产品事实不可达(窗格会话 write-once:canDropToPane 只认空叶 + dropConversationToPane 拒非空目标)⇒ 用例内以 annotations.gap 点名,不当已完成 (82c9a68ae0f)
- 📚 ドキュメント:登记小程序 10 条远程图标线上取不到(6 条代码残路径 + 4 条旧上传件已失) (93595c2f754)
- 🐞 修正:多设备在线时 versionCode 自动定档逐个 -s 询问（此前不带 -s 被 adb 拒绝 ⇒ 静默回落 1，产出降级包装不上） (fee177a1f8e)
- 📚 ドキュメント:G-927 现读进展 —— 判据认形态后误报清零,剩块级重复归人工 (40c78817179)
- 🐞 修正:取号器重号判据认系列小后缀形态,不再把正当小节读成撞号(G-927) (82ee72dbf12)
- 🔧 その他:失败清单必须带诊断 —— 只印用例名等于"红了 102 条却没有一个字说为什么" (bbb2f362441)
- 🐞 修正:三处"只在单层检出/单台机上成立"的判据 —— c-drive 路径正则、硬编码 G:、未入库证书夹具 (359af9e4b45)
- 📚 ドキュメント:§21 同步 —— D73 多任务窗格行补「会话级滚动位按窗格::会话落账」(G-934 把恢复接回生产后的用户可见能力:切走存 scrollTop+following、切回两段恢复+grace 修正、同一会话双窗格各记各的) (c9e4a156814)
- 📚 ドキュメント:G-939 结清 —— 旁路合并两半复量均已接车入库(门 100 A1 半 + 门 168 半) (0499c91575d)
- 📚 ドキュメント:登记 870 枚历史课程视频接入播放链(云端桶已就位,现网零课程行;上架前置三件) (3b07f00330e)
- 📚 ドキュメント:G-927 现读分档 —— 7 组里真孪生 8 处 vs 系列小节(O62 附族等),并点名两处判据不自洽(--check 按编号计数而默认路径自写"追加续写不算相撞"=同一把尺两个面两种结论 §0.6;plan-tasks-merge --heal 现读 F1 0/F4 0/F10 判不出 4,标题行不在 F4 射程 ⇒ 原出路结构性打不到);出路顺序改为先修分组键为「编号+标题整行逐字」再摘孪生 (5586dadcc31)
- 🐞 修正:视频小节详情补 playUrl 出网名,修小程序视频页必然黑屏 (消费方 video-detail/index.tsx:202 读 playUrl,生产者只出 url;新增 4 例离线契约测试钉住同值与 400/404 臂) (a1f899efb9f)
- 🔧 その他:fix(gate-?) killer-parity-ends 的两枚真红:一枚是测试停在旧世界,一枚是同值不同义没登记 (0cdbbf3719d)
- 📚 ドキュメント:G-926 就地改写 —— A 档 25 枚已由就近出口件中和(枚 7bbf24ec4b8120db003ae496455bcc8b9aed6cf8)、C 档 2 枚按账内出路放 .gitignore 例外(枚 c8b17fe8ea70de22ed59dc775bf4fafdfcdb2e65)、归属账两条由 T10 清单腐烂档点名后摘除;剩 B 档 58 枚的拦路是"旁路落地器表达不了删除"这一格,出路写成可动手的活(lib 已有 deleted 护栏,要的是声明式出口 + 反向自证 + 正反用例),题面 84 枚按现读更正为 87/命中 83/中和 25/残留 58 (594bc634bb2)
- 🐞 修正:release 构建拒绝裸 apex 基址 + ABI/基址回读对账（真机实测） (45397bc186e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7145a144459)
- 🐞 修正:收口锁自检两处 flaky 成因 —— 计时窗外置身份探针 + 派生 CLI 显式 stdio(L7233 那一格) (6a06acc6709)
- 🐞 修正:旁路合并接门 168 —— 推进前复量本侧显式删除是否被合并带回结果树(G-939) (0f8a38e9cd1)
- 🚀 機能/改善:补齐 IP 白名单与 agent 护栏配置的读写面(整条要登录、只存不拦) (bb494eba53c)
- 🚀 機能/改善:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (274c78e0eaa)
- 🔧 その他:G-212 重新销账 + L7233 现读复量 (9aeb9d51a60)
- 🔧 その他:复验 L7177 区段头折行结清 + 更新 D18/L6762 现读 (ee57b4c96d2)
- 🐞 修正:门 193 掩码根治 —— markHidden 认正则字面量(L477 病灶跨行错位误判自检夹具判红 2 处阻塞 push),连带清偿 4 处被错位洗绿的真违规 (98e7b8a62c4)
- 🚀 機能/改善:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (08e1da5b63d)
- 📚 ドキュメント:G-939 结清 —— 旁路合并侧已 import 门 100 的 A1 判据在 update-ref 前复量(枚 402f347edc/bf25ee60e2),红则拒推进+保全悬空枚+点名,裸跳门旗不放行;镜像 6/6 含真夹具正控,最近 4 枚 converge 合并逐枚复量 lost=0 (47cb77e6495)
- 🐞 修正:Python 子进程一律钉 UTF-8 —— 那族门在 Windows 上会把「判据说的话」读成乱码 (d6655c70c30)
- 🚀 機能/改善:派发契约键集对账尺子入库(常设只读,禁接提交链)—— 12 格真跑 119 个声明读键全量到;自检 7/7 含'不许裸豁免'与'跑不出 JSON 不得当空集'两条反证,并明写两条边界(不发现新读键、数组元素内字段不在射程) (58bd3c15e52)
- 🔧 その他:补 ai-service 空 venv —— 判据住在 Python 里的那族守门此前在 CI 上恒「未判定」 (0c6723389f1)
- 🔧 その他:翻勾 G-274 与 G-1162551,改判 G-620/G-923 现读 (89c12fe5665)
- 🚀 機能/改善:G-934 会话级滚动位恢复接回生产 —— hook 切走落账/切回二段恢复(RESTORE_PHASE2_DELAY_MS/RESTORE_GRACE_MS 由模块常量驱动),键加窗格维 pane::conversation 防双窗格同会话互串,grace 期修正挂 handleScroll,卸载定时器;成对用例 6 例(正向=窗格隔离,反证=单窗格缺省形态逐字不变;把窗格维摘掉 4 例当场红) (c5b3f0f65d9)
- 🚀 機能/改善:把 SSE 全量帧盲合并门接进提交链(id 233,blocking)—— 收 G-274 (b559acd95cd)
- 🚀 機能/改善:G-939 补第二格 —— 吞并复量"过了也要把判过量出来"(丢失/补回计数落 dim 行),atRefUndetermined 非空时单独喊未判定,不并进"零丢失"那句(§0.3:静默通过与根本没跑到这一步在日志里同形) (bf25ee60e2a)
- 🐞 修正:安全日志页按 security_logs 实列渲染，删掉后端从不给的"状态"列 (761a7a22cab)
- 🚀 機能/改善:PDF 三链真处理落地 + security_logs 接上写入出口 (e1cc3e36ec0)
- 🐞 修正:G-939 把门 100 的 A1 判据 import 给旁路合并侧复量 —— commit-tree+CAS 不跑钩子,对"吞掉对侧独有新增"结构性失明(实测本轮自己的 wave3 提交被卷走);落 update-ref 前拒推进并 backupOrphanMerge,裸 skipEnv 无理由照拦,成对镜像 6 例含真夹具正控 (402f347edc2)
- 🔧 その他:翻勾 L7224 / G-932 / G-922 (079a269bf6f)
- 🔧 その他:检出改为全历史 —— 那批"必须拿真仓历史证"的判据在浅克隆上结构上过不了 (2fc70504830)
- 🔧 その他:钉住危险操作确认的唯一旁路出口(L7224) (251ee617671)
- 🔧 その他:翻勾 G-107 / G-929 (7ea5a84ed10)
- 🔧 その他:修 G-929 过期用例并补 G-107 接线四例 (1a12afbdbf2)
- 🔧 その他:裁决 5 张待拍板票 + 销账 3 张失效票 + 修 1 张回捞副本标记 (a525b912d17)
- 🐞 修正:扫码弹窗平台清单拉取失败必须响 —— 不再静默留白 (79451dab125)
- 🔧 その他:publish-scan 归入 @browser-hub 档 + 平台选择兼容 pill(机主选 A) (c364b64a0de)
- ♻️ リファクタ:AI_SERVICE_URL 默认值收敛为单一真相源,并由 localhost 改 127.0.0.1 (8861116d425)
- 🐞 修正:补齐 ROUTE_ROOT_BG 剩余 27 屏 chrome 档 —— 顶栏结构锁全量测试唯一红清零 (63cd174c852)
- 🐞 修正:补齐 ROUTE_ROOT_BG 剩余 27 屏 chrome 档 —— 顶栏结构锁全量测试唯一红清零 (b6568357c97)
- 🔧 その他:work-panel 切 tab 改按 store 现读 id 选「非激活那颗」—— 收 P4-6 (ddfa3590e0e)
- 🚀 機能/改善:暖色描边禁令装上旁路落地腿 —— 门 231 增 --rev 审树档,落地器 fail-closed 调用 (e1f18b5a320)
- 🐞 修正:登录历史改接真数据源 audit_logs，并清偿本会话写进的 zh-TW 简体用字 (05940a38cef)
- 🔧 その他:重钉 ui-routes 派生自述钉(承接 6ddca76ce8 的 11 处源改动) (b39af6dae53)
- 🐞 修正:原生组件着色属性位的 CSS var 全部改成 JS 派生值 —— 11 处此前静默回落宿主默认色 (6ddca76ce83)
- 🔧 その他:重钉 web/RN ui-routes 自述钉并补回 MyPapers/DistributionCompany 两枚白名单(1fc61a86437 旁路落地未跑写回钩子) (5bede5f6858)
- 🚀 機能/改善:把"没设≠没色"这条因果律推到 web 腿 —— 门 231 增 W5 与 CSS 输入类维,并钉掉 3 枚裸 Switch (be681a0bcee)
- 🔧 その他:fix(tokens)+feat(scripts): danger 暗档文字改取 #f87171(原 #ef4444 压在自己 /10 淡底上实测 4.21 不达 AA)+ 状态色文字射程对账尺子入库(自检 8/8、镜像 9/9,含同面口径修正) (721e61b929b)
- 🐞 修正:资产注册表强制单实例 —— 根治「本地 PNG 的 Image 在 release 上恒空白」这一类 (4a876685d26)
- ⚡ パフォーマンス:图片引用升 ?v=20261021 + 预热脚本 no-cache 强制回源 (720d3f582f7)
- 📚 ドキュメント:补 §21 欠账——登记移动 App 与 web 逐页对齐口径与本批 35 屏 (2834f08be35)
- 🐞 修正:登录历史卡按 security_logs 实列渲染，不再读后端从不返回的字段 (dcf3735fc2a)
- 🐞 修正:补录侧边栏新挂 7 入口的 ROUTE_ROOT_BG chrome 档(ApiKeys/Usage/Groups/Invoices/Points/VoiceStt/AgentCategories) (76452bb2069)
- 🚀 機能/改善:补齐我的试卷与分销中心，并收口 i18n 动态拼键反模式 (1fc61a86437)
- 🐞 修正:反代目标 localhost → 127.0.0.1(修正 d4bfb37b7e6:标题即此修复但内容未落地) (0d36f406d20)
- 🚀 機能/改善:侧边栏对齐 web 第二批 —— AI 组补 /models 与 /agents 父子入口,三域补 web 漏挂项,清 4 处重复登记,回归锁扩到域 hub(web 端零改动) (330056b5352)
- 🔧 その他:按 HEAD 干净面重生成 web/RN 两份 ui-routes 产物钉 —— 收门 105 的 G5 (acc4ab047d5)
- 🔧 その他:摘回门 233 注册条目 —— 点名面被他人 605 行在飞改动占住,先不给别人埋雷;门体降为常设只读尺子 (ec025c8fd6d)
- 🔧 その他:work-panel 收藏按钮按 aria-label 定位 + 切 tab 改为轮询等待 (d07b67bfdbb)
- 🔧 その他:清掉 check-ops-patrol 三枚存量红 —— 两枚是测量缺陷,一枚是半截落地的欠账 (04b56a1011f)
- 🐞 修正:反代目标 localhost → 127.0.0.1,根治 WS 通知 ECONNREFUSED(34,701 次 ::1) (d4bfb37b7e6)
- 🔧 その他:G-924 apps/cli 记忆模块两处直连后端改走 api-client(守门 73 真存量):新增 packages/api-client/src/endpoints/memory.ts 端点(listMemories/createMemory),endpoints barrel 增加导出;UnifiedMemoryClient.getEntries/addEntry 由裸 fetch 改调 api-client 端点,保留 SSRF 守卫与降级语义 (7f586945251)
- 🚀 機能/改善:门 233 门体入库 —— 状态色文字角色档的对比度射程对账(自检 8/8 含两支阳性对照与两支反证) (33bee2381e2)
- 🚀 機能/改善:新守门 check-state-text-contrast.mjs 接进提交链 (c7d7f57aaf8)
- 🚀 機能/改善:补齐 6 屏对齐 web 内容编辑域(文章/问答/名片/AI世界/广场发布) (ce9c8c08a8e)
- ⚡ パフォーマンス:/status 只 SSR 前 30 条模型,其余按需展开(1.05MB → ~30KB) (b9ec5f4dfaf)
- 🔧 その他:登录请求显式声明通道 —— 解开本机 e2e 全量的 401 阻断 (67c57e311b6)
- 🚀 機能/改善:补齐 14 屏对齐 web 用户/发布/学习域 (1982228870b)
- 📚 ドキュメント:G-939 成因查明并改写 —— 门 100 头注自写口径只覆盖提交链,而 git-sync-converge 是 commit-tree+CAS 旁路不跑钩子 ⇒ 对旁路合并结构性失明;活改成"把 A1 判据 import 给旁路侧复量" (587f74e7c7d)
- 📚 ドキュメント:登记「已推送提交被并发合并吞掉且守门 100/168 当场没响」这一格(现读枚 12898ccd9b 双否,已 tag 保全并重落) (ffc81df2014)
- 📚 ドキュメント:G-921 翻勾 —— 三枚(Connectors / DomainHub / McpStore)共享层下沉全部落地并上线(枚 588a6342d8 / 7f9eb8eb00 / cc9b3672ef) (316bc4bf2e7)
- 📚 ドキュメント:登记门 39 全量档新增的 6 枚 V1 红(枚 8f16334f48 补齐 12 屏里的 ConnectedAccounts / ImageGenGallery / ImageGenTemplates / Points / Usage / WrongQuestions 六屏未做共享层下沉) (d7deeddd30b)
- 🔧 その他:重生成 RN ui-routes 自述钉并补回 SecurityCenter 白名单条目(45088b42447 旁路落地时未跑写回钩子) (752074e67f6)
- 🐞 修正:后台守卫不再把「角色还没查到」折成 0 —— 真管理员冷加载 6 次有 3 次被弹到 /forbidden(附双臂变异自证的时序测试) (c9a75878532)
- 🐞 修正:监控面板查询失败整轮不落结果 (f6f9715fe98)
- 📚 ドキュメント:守门 229 那条就地改写 —— 补 H4 档(摘前先问门 71 会不会把这条按未勾还原)、H3 基线改判 HEAD^、新增 state=all-held 与 exit 3 的机读结论(全仓不再有无需清扫式兜底文案) (ef8e6666cc9)
- 📚 ドキュメント:票60 就地改写进度注记 —— 第三、四批已落(含被并发合并吞掉那枚的重落凭据),未收口只剩 e2e 真机核验与描边态分窗格 (4e4fc9e5b25)
- 📚 ドキュメント:登记本轮收口留下的六件真活(归档件 lint-staged 雷区其余 84 枚 / 取号入口被 O 族重号顶死 / 门 105 G5 产物钉存量红 / D197 换行开关用例存量红 / 会话滚动位恢复无生产接线 / 多窗格缺 e2e 真机核验) (d96c474a17c)
- 🚀 機能/改善:票60 第三、四批 —— 续传/工具面板/发起分析全面窗格化,跳转总线按窗格门控(重落被并发合并吞掉的 12898ccd9b) (d3541dc2670)
- 🚀 機能/改善:G-921 第三枚(收官)—— McpStoreScreen 的 UI 下沉到共享层(新建 packages/app/src/features/mcp-store/McpStoreScreen.tsx + index.ts 导出组件、类型与共享判据 mcpInstallBlockedKey),RN 侧改 wrapper(只留四项 API 调用 get / install / setStoreServerEnabled / uninstall、安装与卸载二次确认弹层 appAlert、i18n 与主题注入),照 PaymentScreen / DomainHubScreen / ConnectorsScreen 同一型 wrapper 模式。 (cc9b3672ef2)
- 🐞 修正:输入框外框的常驻暖色环也纳入判据 —— 门 231 W1 增 W1-input 维 (177e5230c40)
- 🚀 機能/改善:补齐 12 屏对齐 web 设置/内容/交易域 (8f16334f483)
- 🐞 修正:监控面板查询失败保留旧数据 + 筛选下拉不再撑满整行 (70ea7877d40)
- 🐞 修正:底栏图标改走内联 data URI —— 本地 PNG 的 Image 取源链在 release 上恒空白 (10c2d9e7643)
- 📚 ドキュメント:G-921 登记第二枚(ConnectorsScreen)下沉共享层的进展与凭据(枚 588a6342d8;门 39 全量红 2→1;剩一枚 McpStoreScreen 归下一批) (c8ee7a2c4d6)
- 🐞 修正:持续性门槛的 firstAt 必须同时进 info —— 派发侧读的就是那一份 (b398a4035ca)
- 🚀 機能/改善:G-921 第二枚 —— ConnectorsScreen 的 UI 下沉到共享层(新建 packages/app/src/features/connectors/ConnectorsScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留 API 调用 get/setEnabled/sync/delete、删除二次确认弹层 appAlert、i18n 与主题注入),照 PaymentScreen/DomainHubScreen 同一型 wrapper 模式。 (588a6342d8b)
- 🐞 修正:补录 SecurityCenter 的 ROUTE_ROOT_BG chrome 档(屏内渲染 NavBar,顶栏 chrome 结构锁判据要求) (c849c50fa11)
- 🐞 修正:守门 78 补第六维——外部依赖声明↔链接对账,根治 lucide-react 断链致 8 端构建阻断 (c1e0350c61b)
- 🐞 修正:监控域之外 5 处状态色文字同接角色档 —— 全 web 残留读数 0(同族后缀档 4/4 未动) (1227a9742cb)
- 📚 ドキュメント:G-921 登记第一枚(DomainHubScreen)下沉共享层的进展与凭据(枚 7f9eb8eb00;门 39 全量红 3→2;剩两枚 Connectors/McpStore 归下一批) (0e948350380)
- 🚀 機能/改善:G-921 第一枚 —— DomainHubScreen 的 UI 下沉到共享层(新建 packages/app/src/features/domain-hub/DomainHubScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留路由参数 domain、导航分派 target、i18n 与主题注入),照 PaymentScreen 同一型 wrapper 模式;条目图标以 ReactNode 由平台注入,共享层不绑定图标注册表。门 39 全量档红 3→2(DomainHubScreen 摘掉);共享层与 RN 两侧 typecheck 对本票文件零错误(存量 35 条红全在他人工作树删掉的 drawer-nav / SelectionAnnotationBar 面),eslint 0 finding,水印 verify 通过 (7f9eb8eb00b)
- 🔧 その他:重钉 web/miniapp ui-routes 自述钉(承接监控域角色档接入) (4a02eacc6f3)
- 🐞 修正:状态色新增「文字」角色档并接上监控域 48 处 —— 亮档真机实测 1.96~2.62 提到 AA 4.5 以上,暗档取值逐字不动 (c2b0c254a12)
- 🚀 機能/改善:安全中心对齐 web 设置页(评分/2FA/会话/安全事件) (45088b42447)
- 🐞 修正:/agents/featured 去掉从未实现的 featured=1 参数并取全量 —— 原来静默只显示 20/124 (37805cd2e1a)
- 📚 ドキュメント:现读订正「锁的初始化写全再原子可见」—— lib/lock-atomic-init 已在 HEAD 且两把锁均已接线;解阻判据①③成立,② 的 deploy-lock 套件本机并发下 flaky(三连跑 50/2、51/1、52/0),未归因不冒领,留一格 (c4f81394c79)
- ⚡ パフォーマンス:英文首页与公开内容页加边缘缓存头 (940303d21db)
- ⚡ パフォーマンス:public 图片按显示尺寸收敛，53MB → 49MB（首屏 logo 867KB→53KB） (52257166e09)
- 📚 ドキュメント:修 tab-bar-metrics 的陈旧注 —— 「颜色一律走 CSS 变量」与实测相反 (cd10e14a8dc)
- 🚀 機能/改善:抽屉侧边栏对齐 web 侧边栏(导航单源 + 二级子菜单 + 内容域) (83e0be9c16d)
- 🔧 その他:暖色描边禁令补齐 extension 射程 + 落原生插件调用形状回归档 (3ea4cbba0cf)
- 🐞 修正:两处生产者从不发射的字段错配 —— 停摆正文出处句恒缺失、TEMP 在写证据支恒 0(同 firstAt/stat 一族) (b4872d129c6)
- 📚 ドキュメント:现读订正「AGENTS.md 体积判据接进提交链」—— 门 207 已按 1 行紧凑块接线(HEAD 4855 行),C1 余量 389;同轮报警:AGENTS.md 现读 95,845 字节 / 预算 96,000,余量仅 155 字节,出路=整区归档(不代裁范围) (56844bc8e5f)
- 🐞 修正:目录一次取全(默认 20→200)+ 修 community 触底重复追加同一批 (c30b7f4f107)
- ⚡ パフォーマンス:状态页 RSC payload 1.97MB → ~150KB，模型列表改客户端渲染 (7d1d322bf58)
- 🐞 修正:市场全量页补 pageSize=200 —— 不带参只吃服务端默认 20,124 枚只见 20 (a3b180513e1)
- 🔧 その他:work-panel P3-3 补 openPanel() —— openPanel({url}) 只导航不置 open (e345966dd6f)
- 🐞 修正:重贴被并发收敛卷掉的目录取全修复(RN 增量渲染 + 扩展 30→200) (bf2f6aa466e)
- 🔧 その他:重钉 web/miniapp ui-routes 自述钉(承接漏斗与磁盘配色两枚改动) (e9343fc4c1b)
- 🐞 修正:门 232 补 onFailHint(此前是两行空串,失败时提交者拿不到任何出路,只能跳门 —— 违 §0.8/§0.10);同笔把门 39 注释里已失真的写死计数(151/153、白名单四枚旧名)改成现读口径 + G-922 后判据形态 (3fb86c5891f)
- 🐞 修正:漏斗末段绿条与磁盘指标取同源 token —— 原 emerald-600/purple-600 亮档白字实测 3.61/暗档 2.40 低于 AA (c505a415681)
- 🐞 修正:「我的 Agent」页签改走 /agents/my —— 原来显示的是市场前 20 枚 (3d8d56c58f7)
- 📚 ドキュメント:更正 sshd 自愈块的归因 —— 502 是本机隧道副本无 sshd,不是生产 sshd 挂了 (ba37f554225)
- 📚 ドキュメント:G-922 登记守门 39 判据四修的进展与凭据(枚 bd3bc2238c;剩一格=21 枚屏级共享存量归 G-921 与各屏持有人) (6856b4d1071)
- ⚡ パフォーマンス:首页边缘缓存头 + 公网缓存预热脚本 (7ee87c82172)
- 🐞 修正:冷启动准入不再把 httpOnly 老用户判成匿名 (1d541e8dbe5)
- 🐞 修正:守门 39 判据四修(G-922)—— ① ROOT 不再由 cwd 定根(改由 import.meta.url 推导) ② screen 正文按面取 blob(HEAD/索引/工作树,取不到即未判定),不再 readFileSync 读盘 ③ 白名单带 why+expires,到期失效、登记名在 screens 清单里不存在=腐烂判红(按现读摘除 DebugScreen/SquareScreen 两枚死账,存量归零后本维才设红) ④ 新增「屏级共享」维:有 import 还得 packages/app 有同名共享屏,存量 21 枚只报数、只拦新增与退化(§0.2 存量未归零不升 blocking);自检 12/12 + 镜像 6/6 + 变异自证(恒真变异 ⇒ 4 例镜像 + 2 例自检翻红) (bd3bc2238c6)
- 🐞 修正:部署时自愈 sshd —— 生产 SSH 入口 502 的真因是本机 sshd 没在应答 (1eda2b49ef1)
- 🐞 修正:公网探测派发契约补上 stat 出口 —— 修严重度档恒 0 使恶化即重报通道失明 (31b33393ae3)
- 🔧 その他:chat-search 搜索框改按真实 testid —— 旧选择器在共享 SearchInput 上结构上不存在 (dd11b1712e9)
- 🐞 修正:门 231 staged 档把「本枚提交无射程内文件」误判 exit 2 —— 对任何无关提交恒红 (97891b940c7)
- 🐞 修正:自定义 tabBar 选中色/光晕改走 JS 派生态 —— 根因是内联 var(--color-*) 在 weapp 不解析 (e0fbb8a6247)
- 🔧 その他:修门 77 镜像测试的 B6 行定位提取式(排版加粗即假红,判据强度不减) (ec6e4465d33)
- 🚀 機能/改善:门 212 加维 —— RN 聚焦档 focusedStyle 不得带几何键 (e2810ebc063)
- 🔧 その他:清扫轮摘行前先问门 71 同一把尺子,并修掉 H3 一处既有假红 (7388b68c073)
- 🔧 その他:重钉 web ui-routes 自述钉(承接 wb-cells 定义补齐) (d14a982fb90)
- 🐞 修正:拔掉原生强调色回落系统橙的那条腿 (eacdb510932)
- 🐞 修正:补上 wb-cells/wb-cells-lg 的 CSS 定义(修上一枚引入的单列竖排回归) (ce29449b653)
- 🔧 その他:checkin 页补账号列表桩 —— 收「空状态永不渲染」那一格 (a0ec15f3e0a)

**2026-10-20**
- 🐞 修正:修掉本票 e2e 锁里一枚不存在的 Playwright 断言方法 (c7de0dc2d18)
- 🐞 修正:被动失效清桌面 vault 也走 CAS —— expireSession 曾盲清 auth.json,抹掉另一窗口刚轮转写回的新 token(自动登录时好时坏的另一条腿);补 api.test 三例与 store 侧 CAS 五例、小程序 clearAuth 同批清用户资料断言 (e53a1911c91)
- 🔧 その他:收紧门 218 的 RN 端硬编码 hex 基线(P0 治理后置) (c498f676642)
- ♻️ リファクタ:摘除 packages/app 零消费者底栏副本(文件 + barrel 两行导出) (1d8f576f35a)
- 🔧 その他:给监控面板两种呈现的切换器钉一条真实浏览器 a11y 回归锁 (d4c48f875eb)
- 🔧 その他:首次 bootstrap .ihui-agent/archive/ 的 lint-staged 就近出口件 (a966301a801)
- 🐞 修正:归零 11 屏 137 处圆角死类名(此前圆角实际为 0),并修 3 屏占位符明暗颠倒 (1e965254164)
- 🔧 その他:重生成 ui-routes 产物自述钉 —— 收旁路合并点名的那步"落地后需重生成" (4d57b0c3080)
- 🔧 その他:重钉 web ui-routes 自述钉(承接内层网格改造经归并后的当前面) (4c9736fb71e)
- 🐞 修正:大屏内层 StatCell/KPI 网格改 auto-fit,消除窄轨逐字换行 (706f8d02dd7)
- 🚀 機能/改善:暖色描边禁令接进提交链(注册条目) (f288064073c)
- 🐞 修正:根治输入框橙色描边(主题级缺陷,全端所有输入框同时中招) (8c952aac27d)
- 🐞 修正:重生成 ui-routes 自述钉(设置页两处登出改动使输入集哈希失效) (3bf512e4656)
- 🐞 修正:登出标记只在用户主动退出时落 + 多窗口 vault 回收走 CAS (7465df281a6)
- 🔧 その他:重钉 ui-routes 产物自述 pin —— 收门 105 的 G5 (a68bf1d5e58)
- 🐞 修正:监控面板页改成共享 Tabs 的「根包 List + Content」写法,补回 role=tabpanel (c64ca1aba30)
- 🔧 その他:追平 web/miniapp 两枚 ui-routes 自述钉(90b14bf8526 的追平被并发落地顶旧) (54199c2139e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc027e1412e)
- 🚀 機能/改善:门 208 加第二把豁免载体(每处一行、存续由门现算),不再动他人现场 (5daba796e04)
- 🔧 その他:跟平 ui-routes 自述钉(旁路落地不跑 pre-commit 写回档) (747ca440a36)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2fe034dd979)
- 🔧 その他:重钉 web ui-routes 自述钉(承接监控目录红色档收口) (3cb0c290df7)
- 🐞 修正:监控目录红色档收口 text-danger,并修漏斗末段暗档白底白字 (b444e5afdf3)
- 🐞 修正:补正胶囊指示条缩进档,并改掉本票头注里一句假话 (98dfbb79707)
- ♻️ リファクタ:上滑/下滑浮动箭头钮收进跨端单一源 scroll-jump-spec(与 web 同款) (90b14bf8526)
- 📚 ドキュメント:D690 摘行(完成即删;上一枚已带结清裁定与全部凭据 sha) (569b2977366)
- 📚 ドキュメント:D690 结清——剩余一格裁定不救,维持 fail-closed(机主待拍板项全权授权代行;凭据三件入库,详见行内注记) (1127428b72c)
- 🔧 その他:重钉 web ui-routes 自述钉(承接监控目录同族色值与网格改动) (14769267179)
- 🐞 修正:监控切换器选中态改品牌实底对 + 大屏落点 e2e 断言收两形态 (c67496a4f7c)
- 🔧 その他:跟上注释一枚的 ui-routes 自述钉(旁路落地不跑写回档) (399b7d74ab7)
- 🐞 修正:监控目录同族色值收口 + 大屏主体网格改按容器判定 (8e6da18c552)
- 🚀 機能/改善:新守门 check-auth-cookie-domain-scope.mjs —— 会话 Cookie 域作用域对账装进提交链 (d7edb8373e4)
- 📚 ドキュメント:如实登记底部胶囊光晕在本端的取证状态 (3b8b7092e58)
- 📚 ドキュメント:登记守门七七的 dead-class 圆角真存量票 (f73a575af59)
- 📚 ドキュメント:登记守门普查净检出分桶带出的三件真工作(RN 屏提取/守门三九判据缺陷/记忆模块直连) (fe5152cbce7)
- 🚀 機能/改善:新守门 check-auth-cookie-domain-scope.mjs 接进提交链(会话 Cookie 域作用域对账,id 现取) (9466ff75282)
- 🔧 その他:跟平两处 ui-routes 派生码自述钉(输入系他人已入库改动) (ba2eb2d7999)
- 🔧 その他:跟进底部胶囊单一源改动的 ui-routes 派生码自述钉 (8c978e5dd27)
- ♻️ リファクタ:底部胶囊几何收成一份源,并钉住"两端必须转发"这条前提 (a3689de714a)
- 🔧 その他:重钉 web ui-routes 自述钉(承接大屏页头与面板页两枚改动) (1a3f8bf5f08)
- 🐞 修正:监控面板页 7 处固定色换语义 token(亮色档下 cyan-300 近乎不可读) (f2a834491b9)
- 🐞 修正:显式登出与被动失效分离,停用迟到重放吊销整族 (3aad1aa1563)
- 🐞 修正:公网探测持续档取不到 firstAt 致告警被无限压住 (efb00b021ff)
- 🐞 修正:会话 Cookie 域补公网臂——Host 改走代理感知出口 (5c1b396b1e4)
- 🐞 修正:占位符色改走 text.tertiary 档,收掉守门二一八的四处基线外新增硬编码 (7e9236d26fb)
- 📚 ドキュメント:完成即删 —— 摘除上一条刚结清的 G-921 已勾行(四件入库凭据见枚 dfbb61a0d0d29485c2ddc02265053c19e3c94e84 的行内注记) (0811d6856f3)
- 🐞 修正:监控呈现切换器选中态改提亮 —— 暗色下纯黑压在灰槽上比底还暗,读不出选中 (77455aed69d)
- 📚 ドキュメント:结清 G-921 —— Coze 导入留下的四件逐条现读复验已入库,附两枚 sha 与门读数;并更正头像签名有效期措辞(现读 3 天/30 天) (dfbb61a0d0d)
- 🔧 その他:重钉小程序 ui-routes 自述钉(承接本端 Agent 契约补迁的 7 枚输入) (d4f9217e507)
- 🐞 修正:拉取详情不再把头像/模型刷成过期值 —— Coze get_online_info 映射收口 (7aaff2fceb4)
- 📚 ドキュメント:回潮副本行内登记「勿照此行派单实现」,勾态不动 (77e41809d5b)
- 🐞 修正:e2e-browser-hub 拓扑构建补第三个选择器 —— extension 的闭包也在内 (7069b49f888)
- 🐞 修正:门 208 按双向核验分流本仓 linked worktree,并把两枚独立克隆搬出仓树 (5ef950c3b41)
- 🔧 その他:重钉 openapi 产物 favorites resourceType 枚举 —— 收 OpenAPI Check 的 ARTIFACT_DRIFT (385bd05b73b)
- 🚀 機能/改善:导入 Coze 官方工作区 116 枚智能体的头像静态件 (080c9461698)
- 🐞 修正:会话 Cookie 域按请求 host 判定,本机地址不再丢 Cookie (d230137b8a4)
- 🔧 その他:清掉两道拦所有人的存量红(门44/90)[cross-domain] (8be351e966e)
- 🐞 修正:门 193 点名 check-format-changed —— 派生 git 的 stdio 属性名写回调用点 (51da8721926)
- 📚 ドキュメント:回潮的同题副本改判留勾(不摘第二次) (2faad2d9bd2)
- 🐞 修正:e2e-browser-hub 把拓扑构建提到 migrate/seed 之前 —— 收那条自 10-16 在位的恒红 (eacf036197c)
- 📚 ドキュメント:结清 5 行(影子js/生成器关停/传输层单点化/Python悬空尺子/同题副本)并改判 4 行的等待前提 (30fb6d56a0a)
- 🔧 その他:四枚主线红追平产品结论 —— 埋点装饰/告警身份/ERC20 校验/400 中文文案 (88ccfa0a921)
- 🐞 修正:补迁 Agent 契约真实载荷 —— 收 CI typecheck 本端 34 条红 (9d9dbc8262e)
- 📚 ドキュメント:D690 改判 diff② 在 chat 腿结构性不可接,剩余一格归拍板(可达性锁已入库) (aa6dc1d67a9)
- 🐞 修正:玻璃底回调至 0.6,底部标签选中态放大一档 (84e9a56ef59)
- 🔧 その他:D195 簇 web e2e 收口第二批(几何/视觉/下载/页面/i18n/登录史)+ CI 浏览器共享内存 (788e6867ab8)
- 🐞 修正:补迁 Agent 契约真实载荷 —— 修 sidepanel Agent 页运行即崩的一格 (68fea6fa5e5)
- 🔧 その他:钉住 D1047 主对话腿重放取数侧的可达性锁 (1f9ee2e4912)
- 🐞 修正:聚焦描边只换色不改宽,收掉登录框同型的五处覆盖 (9cebf01a24d)
- 🚀 機能/改善:立守门 229 拦完成即删的跨枚滞留,并给无人值守兜底清扫轮挂 git-guardian 巡检 (c79fbf794c5)
- 🔧 その他:补删 FenLeiOverlay 的孤儿测试(组件已随 2ddd180933b 移除) (029f86fab89)
- 📚 ドキュメント:点名守门 229 与完成即删兜底清扫轮(门 89 R4),并按门 207 体积预算把 11 行逐字移入归档件 (d7d796630e4)
- 📚 ドキュメント:登记 Coze 导入留下的四件未提交件(等共享索引空闲再落) (1c9e11fda84)
- 🔧 その他:D195 簇 web e2e 收口第一批(chat/form/queue/work-panel/nav/topbar/login)+ 生产构建暴露口 (1a8690b2ffd)
- 🔧 その他:跟进底部胶囊改动的 ui-routes 派生码自述钉 (83a377f662f)
- 🐞 修正:底部胶囊与 AI 输入框同宽高 + 选中态改浅紫发光 (2f846651b8d)
- 🐞 修正:首页共享屏去空壳堆叠,发现区改宫格 (47f23ed3279)
- 🔧 その他:重钉 web ui-routes 自述钉(承接归并带入的 panels 页改动) (c9cf3c5466b)
- 📚 ドキュメント:第二轮配平翻勾 2 条(补齐门 71 的 closed 计数欠账,为摘行留凭据) (ce6ccb06dc0)
- 🐞 修正:大屏去掉灰底网格,监控呈现切换器并入顶栏不占一行 (ba708e445bc)
- 📚 ドキュメント:配平翻勾 8 条被门 71 以未勾形态回捞的已结清票(走该门头注 (c)「翻勾后整行删除」的合规通道,为下一步摘行留凭据) (ac9a172b234)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (36b096a1044)
- 🔧 その他:重钉 web ui-routes 自述钉(随大屏页头改动) (474d771c7bd)
- 🐞 修正:大屏页头改按容器判定并放行 admin 菜单路由公网可达 (805a36bad69)
- 🚀 機能/改善:票60 步序四第二段——非根窗格独立聊天主体 + 窗格事件门控 (23a2c8ac126)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (408c993d53a)
- 🔧 その他:重生成 web 端 ui-routes 派生码自述钉(跟上 panels/wallboard 入库改动) (b60e5f56b41)
- 🐞 修正:监控面板去掉多余外层容器,内容直接铺满工作区 (5713188d85a)
- 🐞 修正:监控面板页根元素补 px-4 收口 CI Lint (26f0c721d1b)
- 🐞 修正:首页共享屏暗色分层与空态排版 (252ff4d30d0)
- 🐞 修正:首页底部停靠区与页面根容器去除背景色 (4b4bddfe647)
- 🐞 修正:windowsHide 内联到 execFileSync 调用点(守门 52 不解析 GIT_OPTS 常量) (31234e4f326)
- 🐞 修正:Agent 契约对齐真实载荷 + 收藏链路根治 (df3d00b6f4d)
- 🔧 その他:根 README 四语言版纳入 prettier 忽略(活文档/生成数字表) (a25f24ce2c5)
- 🐞 修正:底部玻璃停靠区透度回调至 0.3,AI 输入框恢复实底 (49081304698)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (428fd111c96)
- 🐞 修正:聚焦描边只换色不改宽，消除框内提示文字上移 (76535df0373)
- 🐞 修正:exam-status 埋点装饰器加 as never 收口 Fastify decorate 类型 (a991458844b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (77e31790ae6)
- 🐞 修正:监控大屏门改名后补齐 guardian-runner 注册(panel→grafana) (e9d86c6b336)
- 🐞 修正:补删分类弹层 FenLeiOverlay 与配套测试(901c985 提交面漏删) (2ddd180933b)
- 📚 ドキュメント:体积门 207 三次修剪——合并复涨后回到 91,924 字节 (0c4b07a18a5)
- 🚀 機能/改善:收口 SSRF D-1 信任 API + 四处接线 + 危险档拒绝单源 (7714723963d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5509ee26ea6)
- 📚 ドキュメント:登记新表 chat_form_responses,并如实记一条总数口径分叉(不擅自统一) (6cff28ae799)
- ♻️ リファクタ:票60 步序四第一段——发送链路按 store 实例化(默认单例,行为不变) (7f7ad9f17a7)
- 🔧 その他:prettier 归一四枚本轮改动文件(差值格式门只判触碰面) (8d728fa7e76)
- 🐞 修正:收口 CI JS 测试 21 个失败(G-192 回显/埋点装饰/夹具漂移/RN 根底色) (7e06d5f8e1e)
- 🐞 修正:首页移除「分类」入口与赛道分类弹层(2026-10-20 用户定:分类没用) (901c9852944)
- 🐞 修正:format 门改为差值棘轮 + AGENTS 体积门回绿(96KB 内) (71da97a61f5)
- 🚀 機能/改善:监控面板与大屏合并为同页双呈现 (fa45a37e778)
- 📚 ドキュメント:G-16 第(ii)格写清"判据已写成但性能不达标故未落地",并留 patch 与下一步唯一路径 (bc509c86c5d)
- 🐞 修正:收口 test-python 8 个失败(告警哨兵/CORS 测试隔离/Windows 语义/响应契约/预算用例) (e38aa0d597c)
- 🐞 修正:删除 plugins-data 15 枚与 @ihui/shared 逐字节相同的重复副本 (06e0461dbc5)
- 📚 ドキュメント:12 条 RN/小程序行的票面前提逐条现读更正(含纠正本会话先前写下的两处不实读数) (975183dd263)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5e3a4cb6b12)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9cf0d32506f)
- 🐞 修正:字标缓存键升到 v4 —— 旧键下边缘缓存仍是 1.18MB 旧文件 (72d94670955)
- 🔧 その他:重钉 web ui-routes 自述钉(随 monitor 大屏/面板页改动) (cfeb19b8beb)
- 🚀 機能/改善:大屏与面板渲染配色 token 化,适配明暗主题 (772e5e5c029)
- 🐞 修正:监控面板左侧盘名去掉冗余 IHUI-AI 前缀 (ba3f88a3f63)
- 📚 ドキュメント:补正 G-197 复损结算行的勾选态(上一枚该行为无空格形态致翻勾式落空，凭据注记已在位) (5994c04ac55)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (42e6cd81aef)
- 📚 ドキュメント:复损结算 7 行——66f91ad2a1 结清的看板拆档/续写x2/G-921/O46/r81/G-197 被守门71回捞按未勾带回,逐票现读复验后重翻勾(凭据见行内注记) (318843818f4)
- 📚 ドキュメント:摘除已勾的「新维度第一次用就切出可执行清单」那行(完成即删;该行与远端两条未勾重复行同题,删我方已勾版以解除合并时的三版并存) (b404061c5da)
- 📚 ドキュメント:D77 行补残余② 落库读数,并把仍欠的两格写准(迁移未应用 / 状态回显读口未加) (4065818cabb)
- 🚀 機能/改善:D77 残余② —— 对话流业务表单应答落库(新表 + 唯一写入点),机主已授权 (1ba65dac743)
- 🐞 修正:监控面板左侧盘名去掉冗余 IHUI-AI 前缀 (2d7f1a09d68)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (477cb2f3d26)
- 🐞 修正:门 13d 维④落地当场自我误咬 —— 加"短侧须承载实质正文"下限,读数 26 对 → 0 对 (f29cbf9b69c)
- 🔧 その他:删除已复结的 G-107/G-77 行(完成即删;未勾行逐字保留) (bfbce8cd3c9)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b31520b1cf0)
- 🔧 その他:复结 G-107/G-77(远端线回带旧行;翻勾后删除) (ba8d1b21742)
- 🐞 修正:a13 投影对账补「变量名工具」配对登记 —— skill-tool 的 name 取自常量 SKILL_INVOCATION_TOOL_NAME,门侧只能记 (non-literal);登记后真名仍要过 runtimeNames==gateNames,并新增 pairedCount==清单长度这条反向锁(站点不再命中即红),107 计数与具名+匿名解释式逐字不变(反向验证:登记位指错文件即红、多一条永不命中即红) (83b05be416e)
- 🐞 修正:e2e.yml 排除 @browser-hub 档(该 workflow 的 services 只有 postgres+redis,无 ai-service 与 python Chromium ⇒ 这一档在这里必然 500;spec 头注自述分工,现读 e2e-browser-hub.yml 以 --grep @browser-hub 专跑,覆盖率不丢;--list 实测 2 条→0 条,余 721 项) (85f6205c2a4)
- 🐞 修正:收口被整块重复的登记(F6 块级判据的修复出口) (4a0d0bddefb)
- 🔧 その他:在 origin 最新基线上清除已完成行与归档占位(405 已完成 + 21,531 归档;G-79 完成即删;未勾行逐字保留) (89c6cf79835)
- 🚀 機能/改善:门 13d 加维④「严格前缀型副本对」差值棘轮 —— 这一型今天三把尺子全放过 (031aa1eed9c)
- 🔧 その他:门208 豁免清单随现场销账(四处容器目录均不存在) (5591f6bbfe6)
- 🐞 修正:课程播放链路补齐——目录页传课程 id、章节页改拉 catalog、media3 钉回 1.8.0 (efda922cdbe)
- 🐞 修正:自跑归因透传门源标记 + 主仓 dist 重建前补依赖闸 (9cff4d51bdc)
- 📚 ドキュメント:摘除门 13d 维③那格(完成即删第二步;取证与定档理由在 882535a54f2 的提交信息里) (6cf48a6ee05)
- 📚 ドキュメント:翻勾门 13d 维③那格(判据已入库 882535a54f2,镜像 12 例含形状锁) (f62b39232fb)
- 🐞 修正:按 HEAD 源面重生成 ui-routes(补回并发暂存删除漏掉的 domains 页) (c1a532e08d1)
- 🚀 機能/改善:门 13d 加维③「同一行叠同一注记」重数棘轮 —— 收口 2e23f04a309 登记的那格 (882535a54f2)
- 🔧 その他:合并后重生成三端 ui-routes 产物 (0331094bf17)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (31087baf3fa)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fc0eba4e42c)
- 🔧 その他:跨机归并让号 G-317→G-1162551、G-920→G-1142551 (225d59f3bc6)
- 🐞 修正:收口被整块重复的登记(F6 块级判据的修复出口) (c1294100442)
- 🐞 修正:跨机归并保留对侧 227/228 两道门 (5993a7efc7f)
- 🔧 その他:复结 G-77 生成器资源关停门(翻勾;54/54 自检,20/0/0,接线对账 RC=0) (7a80a50eaf6)
- 🐞 修正:G-77 生成器资源门收口 14 处未判定(54/54 自检 + 9/9 镜像;warn 保留,blocking 前置=索引全树枚举) (0c073d7ae61)
- 📚 ドキュメント:把 2e23f04a309 那行里"写成预测"的一句换成实测口径 (b1c21a91516)
- 🐞 修正:监控大屏历史盘公网取数 403 —— monitor-panels/query 显式放行公网 (341ed0e1a7c)
- 🐞 修正:净面安装闸按依赖面指纹判定,修新增依赖永远装不上 (8f39888b0f1)
- 🚀 機能/改善:课程章节页接通播放器——children 透出 videoUrl,拍平小节并带地址进 VideoPlayer (109be29e063)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (67a47299fa4)
- 🔧 その他:G-104 完成即删(证据在 9ae41995/323efb1b/56e0d5b7) (e88ae54545d)
- 📚 ドキュメント:G-104 union 回灌后重翻勾(A-D 已完成;证据 9ae41995/323efb1b/56e0d5b7) (b2acf037b60)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8d2323c32ed)
- 🔧 その他:登记「门 13d 对同一行叠同一注记零射程」这一格,让上一枚的"已另记"落到实处 (2e23f04a309)
- 🔧 その他:无损折叠"同一行内逐字相同的注记"227 份(34 行) (92b5d876aaf)
- 🐞 修正:大屏取数公网 403 —— 两条只读端点显式放行公网 (f7e87c913b6)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (db98c79e533)
- 🐞 修正:收口 strict lint 余下 4 条告警 —— LoginDialog useCallback 补 t 依赖,auth bootstrap 三条 console.debug 改 info(整包 max-warnings 0) (553a9d64ab2)
- 📚 ドキュメント:D77 行就地改写状态 —— 残余① 已闭,等的只剩运行时合格证 (f744a7b6d14)
- 🔧 その他:删除新完成的 G-104 行(完成即删);未勾行逐字保留 (0f5376bf092)
- 🐞 修正:收口被整块重复的登记(F6 块级判据的修复出口) (46774eb18f0)
- 🚀 機能/改善:D77 残余① 收口 —— 表单 mode 判定收进共享层,三端宿主接上 (4da233e6100)
- 📚 ドキュメント:复结 G-104(两端统一 cl100k + 降级可见 + BPE 门 id228 接链;整包 122/122/Python 29/29/门 89 strict) (56e0d5b7d93)
- 🚀 機能/改善:跨端 BPE 词表对账门接进提交链(id 228,blocking;G-104 D) (323efb1bd7a)
- 🚀 機能/改善:G-104 两端统一 cl100k_base + 降级可见 + BPE 门重基 (9ae4199583d)
- 🔧 その他:按机主令清除全部已完成行与归档占位注释(132 已完成 + 21,519 归档注释;225 条未勾行逐字保留) (f19bfd0e56a)
- ♻️ リファクタ:摘除已退役看板程序的编排与登记(根 compose/observability 栈/服务清单) (2c19eaf7147)
- 🔧 その他:复结 G-107 权威信封恢复闸门(翻勾;随后整批删除已完成行) (9813e3fffdd)
- 🚀 機能/改善:接线 G-107 权威信封恢复闸门到流式帧路由(解门只认 recovery / reason-code 封闭集 / 迟到片不重置水位;api-client 零依赖同形移植 + 14 例对账) (0615a31b1d1)
- 🐞 修正:删除 no-console 关闭面扩到 mjs 后失效的 4 条冗余 eslint-disable(整包 strict lint 现读 0 告警) (9b4ac5ba836)
- 🐞 修正:G-77 残余① 显式关停 provider 转发链与 agents SSE sink (ef259cb4d37)
- 📚 ドキュメント:复结 G-922 桌面更新器第一数据源烘焙器(生成器+--check+镜像测试 8/8,0.1.76 --check RC=0) (75bed9b15df)
- 🚀 機能/改善:G-922 桌面更新器第一数据源烘焙器 + --check + 镜像测试 (c71255038be)
- 📚 ドキュメント:移除已退役 check-live-doc-archive-reinflation 的陈旧门名段(存档机制 2026-10-16 退役;门体已删,文档不再点名) (0a434dbf7ba)
- 📚 ドキュメント:复结 G-29(收集失败归零)+票77(My Quests+自评估 23/23+31/31);释放 G-104/G-274/G-79/LEDGER-FIX 四条超龄租约 (79762c21820)
- 🐞 修正:收口主线 CI 存量红: Knip 新导出 / OpenAPI 漂移 / CLI strict lint / Ruff / RN 裸输入 (010e8c50297)
- 📚 ドキュメント:改掉我上一枚提交 94f607c85c 自己造的跑不通出路 (c269ae8054f)
- 🐞 修正:union-converge 反漂移锁移除对已退役归档器的动态 import (88a0b33a2dc)
- 🐞 修正:删除 mobile-rn 两枚零消费死键 identityVerify.failed 与 patrol.actionFailed(五语言同步,死键审计全端归零) (9c69efebaa9)
- 🐞 修正:web bundle 500 — web 平台补齐 react-native→react-native-web 别名 (c974ce7944a)
- 📚 ドキュメント:标明 Android 提交轨道与个人号 12 人门槛的对应关系 (94f607c85c4)
- 📚 ドキュメント:复结 G-181/G-930/G-926(巡检 P12 97/97;恢复源 backupOk:true+已追平;门84 R1w 用例 27/27);G-29 现读 1 端收集失败保持未勾 (6f2d128530f)
- 📚 ドキュメント:复结 G-47/G-76(收敛器封顶 600s+用例 18/18;副本归并器批1/批3 候选删除 0;原核销被合并乱流复活) (46254a889a8)
- 📚 ドキュメント:复结 G-38/G-916419 两张索引态票(D 档 0/门99 RC=0/索引 blob==HEAD blob/--gate --staged RC=0;原核销被合并乱流复活) (5739205c8b8)
- 📚 ドキュメント:复结 G-210/G-461/G-868/G-102 四张已入库未勾票(原翻勾被合并乱流复活;gate strict RC=0 + 用例 16/16 现读) (c671315233a)
- 📚 ドキュメント:G-427 重新结清(广告门控+allowed-tools 影子账本两格 HEAD 在位,用例 16/16 现跑绿;原翻勾被合并乱流复活,按 HEAD 实证复结) (cf953f62712)
- 📚 ドキュメント:SignPath 确认邮件已收到并更新审批状态 (84088dd2276)
- 🔧 その他:出清CI报告全量新增未用导出29个+重复导出16处+盲区豁免,五类棘轮归零修复 (8a55ee1a7f8)
- 📚 ドキュメント:SignPath 申请已实际提交成功并留证 (3cf0f2b7800)
- 🐞 修正:mirror-liveness reads main branch not default_branch(backup),removes stale 22d false lag after default switch (c5920f5cfbb)
- ⚡ パフォーマンス:页头字标换成真矢量,1.18MB -> 42KB(两版各减 96%) (c079c6d705b)
- 🔧 その他:销账G-116 Gitee配额(探针ref已删/机主GC)与env待供值重复副本两行,完成即删不留痕 (a6c8bc3227b)
- 📚 ドキュメント:结清 G-277(守门128 web腿三格全闭:①VideoPlayer 带理由豁免接管 ②裸档由 db5a7a74a9 升进档位集合、三本账重锚前提经 import 面复裁推翻且锚点零位移 ③web 腿可达性剔除机制化);本轮附加修三处仍挂已推翻前提的陈旧表述(T29 测试名+内联 rationale、门128 :3225 注释),修后 128 自检 123/123、测试套件 46/46、默认档 RC=0、门150 RC=0 (766576260b6)
- 📚 ドキュメント:更正 SignPath 申请状态为未提交并删除无凭据的问询记录 (47afcfa1803)
- 📚 ドキュメント:摘 G-343 同题跨号僵尸开放行(正文与已归档 ✅(2026-10-29→2026-09-29) G-345「四格全闭」逐字相同,HEAD 逐格可证+门体自检 16/16,留证见 archive/PROJECT_PLAN_G343-dup-removed) + G-631 按 HEAD 实证重新结清(10-11 四枚系列提交 1/4~4/4 已入库,翻勾 ✅(2026-10-11) 后于合并乱流丢失、旧形态复活;两处前置修复在 HEAD 且本轮各补测试锁:尺子抽出 countStringFormSlices 可测出口+空数组/两器同一定义两颗用例并变异自证,matrix 侧用例他席 3fbc52af5e 已入库不重复登记) (d21191b1c6b)
- 📚 ドキュメント:烘焙步骤措辞校正为"CI 产出的包" (2a078c0172c)
- 🐞 修正:OIDC-optional-unset=unknown-not-fail;prune-.DevEnv-cache-from-nested-git-scan;72h-exempt-in-flight (9f40b2aada6)
- 🔧 その他:G-631 补空清单/混形态用例,钉住 M13 不把空数组真相当真 (3fbc52af5ee)
- 📚 ドキュメント:tauri 发布说明同步本机发版守卫(默认拒绝未签名上传,公开发布走 CI) (6e5f00f88bb)
- 🐞 修正:本机发版默认拒绝上传未签名包(Gitee 已是 Windows 更新面) (e620ccfdc34)
- 📚 ドキュメント:桌面发版清单补烘焙第一数据源,并校正平台数与自动提交表述 (455398a2cab)
- 🔧 その他:登记桌面更新器烘焙缺生成器/缺对账门 (f6757e74b64)
- 📚 ドキュメント:文档层洗掉已退役看板程序名(README×3 + docs 29 份,128 处) (8c1e72e10b1)
- 🐞 修正:桌面 Release 逐文件上传不得吞失败(签名后 exe 与 .sig 必须成对) (c3033d25781)
- ♻️ リファクタ:自有 env 键 GRAFANA_* → BOARD_*(含 saas 编排/gen-secrets/示例) (b17056a4ed9)
- 📚 ドキュメント:门名索引跟着 panel 系改名(修 R4:新门名在文档里看不见) (bb5c9acbef9)
- ♻️ リファクタ:看板器物改名落库(panel 系;门 220/222 的悬空引用一并解掉) (a7ced7411ca)
- 🔧 その他:欠账清单行现读更新(B 已根治 / C 抽样已消 / D 非缺陷,仅剩 A 的 UI 迁移) (1a7ea734afa)
- 🐞 修正:清理 plugins-data 下沉后残留的 web 旧位置副本(15 个文件) (7a7751be446)
- 🔧 その他:结清 #47 三套执行内核工具集归一(三格均已入库:唯一解析出口 + port 定义出口 + parity 断言接提交链) (bfda4238b3b)
- 🔧 その他:签名被跳过时必须喊出来(CLI 与桌面各加一步:凭据不齐则打 warning 注解并写进 job 摘要,避免 green 被读成已签名) (5ab25b78ea2)
- 📚 ドキュメント:签名段覆盖到桌面安装包并写死两条硬约束(换字节必须重算 updater 签名;artifact-configuration 不是 GitHub secret,照旧文配会静默不签名),CI 集成状态改判为代码已接入待凭据 (c8b0b99d8b1)
- 📚 ドキュメント:代码签名条覆盖到桌面安装包(与 CLI 同一组 SignPath 凭据),并把两处真实落点写清:策略文档与凭据-约束说明 (3084d8c89df)
- ⚡ パフォーマンス:语言包改为按需加载,首屏不再带 5 种语言 (5dba888279d)
- 🔧 その他:再销 14 行说明/等条件/已否决项,派单面收敛到真活 (b229b735cd5)
- 🔧 その他:Windows 安装包接 SignPath Authenticode 签名,并按新字节重算 updater 签名(缺凭据时整段跳过,行为与今日逐字同形;重算失败硬失败,宁可不发也不发更新链断裂的 Release;同批装守门 215 自述) (da1f3b39a14)
- 🔧 その他:批量销账 56 行(20 张已实现/重复/前提消失 + 36 行非派单工作) (c19cf73b6ae)
- 📚 ドキュメント:摘 4 条归档票僵尸开放行(G-863/G-815991/G-362续行/G-102;均=同票号同题权威行已归档✅+开放行无租约牌,逐票实质核验见留证件;并集按旧基线复位带回的同型回潮)。G-160 同扫描但实质不可干净核验(批次提交不在今日 origin/main 祖先+钥匙仍带开放行),归收敛线持有人未动 (08eed783b99)
- 📚 ドキュメント:登记桌面端安装包签名缺口(归属 release-desktop 持有席,出路形状与两条硬前置已核实写入行内) (6c8b9cd88df)
- ♻️ リファクタ:插件目录 plugins-data 下沉 packages/shared (55803300de9)
- 🐞 修正:落地闸清单的截断改为报名并给出出路(标题报十九条而正文只列十五行,读账人只能另写探针才见全貌;新增纯函数 formatBadReport 与 show-all-bad 旗标,四例镜像测试含装车锁;父目录污染那枚已按门自己的判据清至隔离并复量转绿) (26cc36e24fe)
- 🔧 その他:结清三张已消失的索引现场观察票(G-34 / G-35 / G-39) (8076559f7e2)
- 🐞 修正:host-git 条目改 button 内嵌,修 jsx-a11y 双错(CI lint 红) (afb908eaf58)
- 🐞 修正:agent-event-parity 补 _sse_frame 位置参数扫描,消除 delta 契约误判(8条阻断) (e14b2af564f)
- 🐞 修正:静态键提取前剥离注释,消除把注释示例当引用的误报(缺 nav'字面量') (92d4f2a6842)
- 🔧 その他:结清 G-26 与四张已实现票据(G-317-② / A2 / A3 / G-279) (ea7e756cc1c)
- 🐞 修正:fork 复制 turn 并重挂 item,消除来源回滚的 FK 地雷(G-26) (47a20b7d092)
- 📚 ドキュメント:G-932 摘僵尸副本行(权威行已归档✅(2026-10-15),代码 b100d9457a+翻勾 4da96ed0e0 皆 origin/main 祖先;本行=认领已释放@2026-10-18/goal-leasegc 的滞后第二行,逐字留证 .ihui-agent/archive/PROJECT_PLAN_G932-dup-removed-2026-10-20.md 过门71) (9c34e0c370e)
- 🔧 その他:G-310 同族补 fold-keep 声明式 keeper 出口的镜像反证六例(阳性对照=两侧各改写一版而无人声明必挡落地;反证=陈旧声明/串档行/空理由/算不出指纹/fp 与现算不符/同指纹两 keeper 全部退二点名)。跳 nested-git 守门留痕:它点名的四枚全是 gitignored 未跟踪现场(desktop-feed-clone、tmp 下 desktop-latest 与 wt-parent、outputs 下 ihui-bench-release),mtime 均早于本席开工,wt-parent 更是他席此刻在用的活夹具;基线面结构上不含未跟踪目录,故 HEAD 不红我红属对每一枚提交的定责失真,非本枚引入 (2c7c2d8e986)
- 📚 ドキュメント:RN↔Web 对齐收口翻勾 + A 簇 9 功能与 /plugins 平台独占标注(基于 d75129 权威版外科插入,不丢并行条目) (b6ecb17cede)
- 🚀 機能/改善:移植 D77 form_request mode 槽与 mobile-rn 11 屏接线到 origin/main (d75129e2aad)
- 🔧 その他:裁决 G-201 收口(不引入来源猜测;服务端可推导部分已落地,其余自报只许收窄,缺信号已注记,将来按连接来源新能力另票立) (fbded734db2)
- 🔧 その他:结清 13 张已实现或已裁决票(G-921/G-197/G-464/G-462/G-739/G-428/G-70 + max_tokens 续写;撤销 G-6/G-83/O46 取向;移动端信封清单收口),逐行凭据见注记 (66f91ad2a16)
- 🐞 修正:G-921 尺子跟着入口换形 —— 包装壳 desktop-build --dev 纳入 dev 入口形态(否则正控空转,实测 1 failed),补包装壳裸跑与带配置两条反证 (cfe2b6116a1)
- 🐞 修正:根治原生适配器绕过并发闸 + GBK 丢日志 + 流式错误无溯源 (1f8deea55c6)
- 🐞 修正:补 ERC20 充值地址格式校验(G-317-②) (1d733b0fc4a)
- 🐞 修正:DomainHub 注释示例改中文描述,消除 check-i18n-keys 把注释当键的误报(缺 nav'字面量') (9d5c1188872)
- 🐞 修正:Sidebar 补回 useNavVisibilityFilter 的 import,解部署环 TS2304 冻结 (9451f3378d0)
- 🔧 その他:结清 G-310(声明式取代出口已入库并随整批 converge 生效;凭据=出口枚与合并枚 40 位、九例镜像反证、129 例自检 rc=0、--gate rc=0),摘除本席租约牌 (f7f310e5761)
- 📚 ドキュメント:守门 207 体积裁剪 —— 重复登记副本两版历史原文与两处同文重复段逐字移入 archive,原位置留指针注记(100842→93867 字节) (fccfe1f3072)
- 🐞 修正:根治原生适配器绕过并发闸 + GBK 丢日志 + 流式错误无溯源 (72dc9299846)
- 🔧 その他:重生成 ui-routes 派生产物(合并带来的 api 输入变更后重钉) (adcceda20fe)
- 🔧 その他:重生成 ui-routes 派生产物(合并后重钉 sourceCommit 与输入哈希,路由集不变) (ada51eaa42e)
- 🐞 修正:SSO 授权误报登录失效——会话失效改由后端 Bearer 裁定 (1dd7392401a)
- 🚀 機能/改善:新守门 check-board-name-legacy.mjs 接进提交链 (60d3b6a55ff)
- 🐞 修正:Sidebar 补 import useNavVisibilityFilter(修 CI typecheck TS2304 回归) (d83f5ecd211)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2e7cdcf3591)
- 🐞 修正:指纹选粗体吸收对侧跳过括注内强调的修法,与本侧行首区判据合并 (d922a79e808)
- 📚 ドキュメント:G-310 就地追加现状注记(出口已入库但本票未闭;卡点已换位到同题两版并存族,该族无回灌出口) (3675e214a74)
- 🔧 その他:清账门207 AGENTS.md体积判据(已注册blocking+判据+镜像测试5pass+现跑rc0),完成即删整行不留痕 (f724754c432)
- 🐞 修正:洗回上一轮误加到标题行与正文子项的号段注记,并按任务行唯一命中重补三行(G-84 命中两条任务行 ⇒ 不猜,点名交人工) (5e79d0e5057)
- 🔧 その他:剥离已闭环的5669①两级渐进披露子项(提交130af8c18已落地:目录段预算降级/skill按名拉/428前置门/compaction重置),保留②③④⑤未落地项 (e99084dc1f4)
- 🐞 修正:补回九行被剥掉的号段租让注记(折叠守恒一问的正当凭据;G-310 停放轮定的内容修复路线,不动判据不收牙) (f49c3a2e2b2)
- 🐞 修正:移除 contentHub/eduHub/tradeHub 孤儿嵌套键(死 key 审计 6 枚) (0b65ff2d39d)
- 📚 ドキュメント:摘除「web↔移动端同一契约两份声明」族的已勾旧副本行(完成即删第二步) (f8c8ae12202)
- 📚 ドキュメント:「web↔移动端同一契约两份声明」族的严格前缀旧副本行按 §1 翻勾(承载行是它的加长版) (41241b40edc)
- 📚 ドキュメント:摘除分类栏统一收口族的已勾旧副本行(完成即删第二步,承载行留在原位) (4c606271db4)
- 📚 ドキュメント:分类栏统一收口族的"严格前缀旧副本行"按 §1 翻勾销账(承载行仍是那一行的加长版) (93caa183404)
- 📚 ドキュメント:分类栏行剩余格补产物面实测,并更正上一枚提交信息里的一处过头话 (69ec7f03383)
- 📚 ドキュメント:分类栏行剩余格的成因改判 —— 不是设备网络,是这枚包烘进了回环 base (12d49a105c3)
- 📚 ドキュメント:分类栏统一收口行补真机复验读数(设备 c12617dd / v0.0.5 code 26101411 / 暗档 / 已登录) (6aaa20c9e1b)
- 🔧 その他:撤下 check-miniapp-taro-design-tokens 的 standalone-tool 豁免(该门已于 id 227 真接线) (5566a17bca5)
- 🚀 機能/改善:门 check-miniapp-taro-design-tokens 接进提交链(blocking,HEAD 面两面现读存量 0) (ce97c06d13a)
- 🐞 修正:守门 203 指纹不再让"行首派单前提括注"里的强调粗体吞掉标题(HEAD 面 66/332 行恒 null 的根因) (b8b95c9df27)
- 🐞 修正:守门 71 编号族补 A / H / WP 三族并允许 D 族带横杠,另挂一族表自检维 (f5822db5fac)
- 🐞 修正:G-310 落地闸补「声明式取代」出口(命令面旗标接进两半判据,放行仍须过折叠四问并逐条报名;陈旧声明判不记通过)+ 九例镜像反证测试 (6ef39d1fe8c)
- 📚 ドキュメント:G-310 就地追加实现落地注记(命令面已接出口,放行仍须四问举证;不翻勾,剩余是整批 converge 实测) (8041bff0301)
- 🐞 修正:剔除侧边栏提交误带的 contentHub/eduHub/tradeHub 孤儿键 (59e15ae4b0b)
- ⚡ パフォーマンス:页头 logo 只下载当前主题那一枚,首屏少下 1.18MB (ca29364f932)
- 📚 ドキュメント:清账G-317 USDT地址配置闭环(TRC20拍板值TMt已落地env+双调用点形态校验+example登记),修正3处过期收款地址文档(去虚构NEXT_PUBLIC键/wallet-secrets误述),剥离存量订单核查与ERC20格式校验两条遗留 (1a0d8367653)
- 📚 ドキュメント:认领 G-310(union-converge 落地闸补声明式取代出口;整批 converge 实测卡在这一格) chg 机主本轮拍板 (20882eafd93)
- 🐞 修正:LLM 上游失败补 warning 日志 + 修 orchestration 读端旧格式用例 (b7815962c3d)
- 📚 ドキュメント:A4+A10 副本摘行(翻勾已落 e6afb2e944ad2cb17707cd67cd0b8c56d529b659,本枚只删行) (1f233b87c95)
- 📚 ドキュメント:A4+A10 那一格的 stale 待办副本翻勾 —— 同题正本 L14512 已勾并带复验证据,本席今日重跑两臂各绿 (e6afb2e944a)
- 📚 ドキュメント:G-277 摘行(翻勾已落 551fdf60c31fdae711d7d82ce370cf99d5d223d5,本枚只删行) (6cd2d083196)
- 📚 ドキュメント:G-277 翻勾 —— 守门 128 web 腿三格今日全部现读闭合 (551fdf60c31)
- 📚 ドキュメント:G-29 复量注记 —— 前置①现读成立、前置②两把锁在位,定级裁决仍 warn(理由落在"能不能在提交面出结论") (d92cdb9f350)
- 🚀 機能/改善:门 114 补全端枚举与三态分色(G-29 前置①的可机检形态) (e0a72e58f44)
- 📚 ドキュメント:G-926 摘行(翻勾已落 fbc352c6523b51819ee8b996f074273fd845094f,本枚只删行) (288e00283d1)
- 📚 ドキュメント:G-926 票据翻勾 —— 门 84 R1 ↔ 门 47 的水印补回型互锁已由 9085a780baf6f726db6b8165a6d3caf8deb56739 解除 (fbc352c6523)
- 🐞 修正:门 84 R1 ↔ 门 47 的水印补回型互锁解除(G-926) (9085a780baf)
- 📚 ドキュメント:G-621 摘行(翻勾已落 8fbbd316d8153d473ede3e09a4d79f3667fdc29a,本枚只删行) (f12d5e61b71)
- 📚 ドキュメント:G-621 四格全部结账,按完成即删先翻勾(下一枚只删行) (8fbbd316d81)
- 🚀 機能/改善:弱证据队列今日那一条已裁并入账 —— wallboard 告警胶囊的 panel 类别是颜色单证推出来的,不判红也不当场改档 (cce86d0f4fb)
- 📚 ドキュメント:G-621 第二格结账(缝隙已关)+ 写明本行为何仍不翻勾(弱证据队列那条换了站点,仍等一并裁) (bbb89e40081)
- 🚀 機能/改善:锚点按"该文件 HEAD 自身计数"收紧 —— 关掉"同文件加新代码把已收敛档位写回旧形态"这条缝隙(G-621 最后一格) (26e562dd924)
- 📚 ドキュメント:form-request-frame 头注的两条理由按今天的事实改写 —— ① 已不成立,只剩 ②,并写死"别照旧文把旁路加回来" (53348f2aa83)
- 🐞 修正:form_request 收编到共享认领 —— 端内 onRawLine 二次认领删除,小程序端最后一个红转绿(70/70) (db3f98d10c6)
- 📚 ドキュメント:G-16 行内更正两处 —— 上一枚注记里「3 条真单侧」那句作废,并把第(ii)格从「没动」写成「已量清 + 等的是哪一格裁决」 (f41f83ffb47)
- 🐞 修正:SL 的投影别名改成**单向**(只许消账、不许造账)—— 上一枚把跨组件误归因当成了真单侧 (e45bb64b1b5)
- 📚 ドキュメント:G-16 第(i)格现读结账 —— SL 已认几何投影别名,(ii) 未动,本行仍开 (6dcc25847ea)
- 🐞 修正:SL 维认几何投影别名 —— 票 G-16 那格的假账消除(一侧直取 geometry 档不再算"仅另一侧引用") (47474c24e0e)
- 📚 ドキュメント:cache token 那行按完成即删摘除(翻勾已落 927f8ab7ba3273e0b713a51c920ffee582b5549f,本枚只删行) (56f359832ef)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1163a2cc255)
- 📚 ドキュメント:cache token 那行翻勾 —— 本行点名的守门 112 两重失明已补 (927f8ab7ba3)
- 🐞 修正:压缩分母门补两重失明 —— 扫描面加 packages/、分母名补 maxTokens 一族,名字表与预筛关键字同源 (5302a93ce54)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (031a432734d)
- ⚡ パフォーマンス:logo.svg 由 UTF-16LE 无损重存为 UTF-8,首页少下 1.18MB (1d375529f11)
- 🚀 機能/改善:监控大屏新增访客访问与国内加速命中率面板 (9f98914771c)
- 🐞 修正:再摘 identityVerify.failed —— 上一枚(bbd638cbb95)的摘除被并发席位基于旧基线词包的整文件提交(6387c9c769d)带回 (913364bc2ea)
- 🐞 修正:mobile-rn/en modelPlaza.officialBadge 欠译收口(智 → IH) (bd19eab469c)
- 🚀 機能/改善:访客链路测速与边缘预热并入 api 进程内定时读方 (a409aa7e677)
- 🐞 修正:RN 验证码弹窗 5 处硬编码中文改走 i18n(与小程序同文案同译法) (6387c9c769d)
- 🐞 修正:摘除 mobile-rn 词包里的孤儿键 identityVerify.failed —— CI 死 key 审计在 HEAD 面的唯一一处红 (bbd638cbb95)
- 🚀 機能/改善:侧边栏简洁模式 -- 一个开关收起 61 项开发者/运维向导航入口 (4e9a1549004)
- 📚 ドキュメント:G-29 第二条现读 —— 全端计数已量完(16 个 vitest 端收集失败 0),前置② 两条锁实测早已在位,真挡是「执行型门能否在被审面上定论」 (24d9ed1e134)
- 🐞 修正:判红必须能在被审面上定论 —— 复用 check-head-typecheck 的取材装配,脏面一律降为候选(不再给无关在飞改动顶罪) (4e33e216de3)
- 🚀 機能/改善:侧边栏简洁模式 -- 一个开关收起 61 项开发者/运维向导航入口 (1cfc578169b)
- 🐞 修正:监控大屏(panels)适配明暗主题,移除写死蓝黑配色 (790f669fbc3)
- 📚 ドキュメント:L14361 G-811 图源池 —— 三格逐格现读均为已落地态,翻勾并留终态取证(零生产代码改动) (512b4bf1561)
- 🐞 修正:orchestration_hub 事件改为单键 JSON 写入 Redis 流 (6048e094485)
- 🔧 その他:清账7条HEAD已闭环陈旧开放行(#138活动时钟/#225redact单源/#269#270锁原子初始化/#273传输层派发器/#78#263错误前提tauri日志),完成即删不留痕 (8b9bb46b94b)
- 📚 ドキュメント:协议通道②/③ 与 VideoPlayerScreen 两行按完成即删摘除(翻勾已落 5392c69cc964db7ffbae5203dd8743dc37cec45e,本枚只删行) (db01b6fffca)
- 📚 ドキュメント:G-621 现读更正 —— 票面点名的现场形状已不复现,仍开的只剩最后那一格通用缝隙 (791e2e664ae)
- 📚 ドキュメント:L29247 传输层单点化 —— 翻勾并留终态取证(代码已为落地态) (8c68744302b)
- 📚 ドキュメント:G-29 现读口径纠偏 + 两端收集存量现读追加 (4962b1ce2f7)
- 🐞 修正:miniapp 验证码弹窗标题与 RN 对齐「请输入验证码」(verify.getCode 五语值纠偏) (5c00ad26050)

**2026-10-19**
- 🐞 修正:受检形态必须等于该端真实跑法 —— 派生 vitest 时不再丢掉 test script 的旗标(实测 31 条用例假红) (66cfdd0d19a)
- 📚 ドキュメント:协议通道②/③ 与 VideoPlayerScreen 两行翻勾(仓库侧内容已全部入库;剩余是环境前提,写在本枚信息与两行注记里交后手) (5392c69cc96)
- 🐞 修正:G-28登记缴费对话框硬编码中文全部走t(),新键五语言补齐(parity) (e4be58fa101)
- 🔧 その他:三枚套件收集期即炸 ⇒ 端内 93 条用例从未执行 —— vi.mock 改 partial-mock(importOriginal 形态),不再手抄闭集出口表 (dc41de3bb57)
- 🚀 機能/改善:admin新增登记缴费对话框,POST现有/payment-record(G-28代码层,无外部资质) (21eb7f6ed97)
- 🐞 修正:disable xinference local provider probe by default (53597943dc7)
- 🔧 その他:接入 SignPath Authenticode 签名(Windows 二进制) (64cfacf4d7d)
- 🐞 修正:disable xinference local provider probe by default (afd853023e9)
- 🔧 その他:门128 基线入账 VerifyCodeModal 族(counts 3 / radiusCounts 0 / elementRadiusCounts 0) (108d1fe6434)
- 🐞 修正:门 105 四端 ui-routes 派生产物第三次对齐 —— 并发会话连续改小程序与 web 侧页面源文件,产物自述钉与 head 面现算持续不等;重生成前已验全部输入源的工作树与 HEAD 逐字一致(工作树干净),故产物钉住的是 HEAD 面的源 (cf46bb2a8ef)
- 📚 ドキュメント:协议通道②/③与 VideoPlayerScreen 两行就地补现状与出路(逐字原文保留,只追加行尾注记) (1ef9ebdb469)
- 🐞 修正:agnes视频轮询改专用同步端点,通用端点不同步上游致永久pending(线A#4) (36ca4341870)
- 🔧 その他:结案 L7603 僵尸实例修复:方向(a)(c)已落地且 cargo check 通过,翻勾 + 终态注记(2026-10-19) (75a6005f441)
- ♻️ リファクタ:VerifyCodeModal 收进共享单一源 verify-code-modal-spec(门128唯一判红族) (4c0dbc10212)
- 📚 ドキュメント:登记 RN↔web 能力对齐收口轮的守门收口(③)并订正两处过时表述 —— 标题由「本轮未入库」改为已入库 14 枚;①里「单测直接 import web 的 SLASH_COMMAND_IDS」订正为「直接 import 共享层 @ihui/shared/chat/slash-command-ids」(端→端 import 边违反架构契约 D1,门 103 判红,已下沉共享层消解);③ 记本轮 8 道恒红门的逐条处置与唯一未消项(门 184 系并发会话在飞删除 desktop 构建脚本的中间态) (f439d089fdf)
- ♻️ リファクタ:SquareScreen / PlazaScreen 两处共享类型重声明改为 import 共享层 (3ead65aee50)
- 🐞 修正:门 105 小程序端 ui-routes 派生产物再对齐 —— 并发会话在本席上一枚落库后又改了 apps/miniapp-taro/src/components/DrawerComponent.tsx,产物自述钉遂与 head 面现算不等;重生成前已验全部输入源的工作树与 HEAD 逐字一致(工作树干净),故产物钉住的是 HEAD 面的源 (00960fa854c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a6291841552)
- 📚 ドキュメント:结清 D113 流式 diff 实时预览(复验+回归绿) (79c54edbd64)
- 🚀 機能/改善:f1档跳过自述指针行防循环论证误翻勾,declared档不变(G-72裁决①) (3bfa3def949)
- 🐞 修正:--staged 归属判据改差值棘轮(锚 HEAD),解除全场提交被迫跳门的恒红 (18eb57d63de)
- 📚 ドキュメント:结清两条 P0 技能市场授权缺陷(复验+回归绿) (5b52770931d)
- 📚 ドキュメント:守门 207 体积瘦身 —— §1「重复登记副本」两行历史叙述整区搬入归档件(逐字原文,原位置留一行压缩条款,规则内核一字未减),另删一处与文首逐字重复的压缩版说明行;载荷行逐字未变、零宽字符总数未变(脚本自证) (8b05e0e2f5b)
- 🐞 修正:sso 隧道源站 8543→8850(端口铁律,注册表+docs §2.7 双向登记) (3b5fa476169)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a969d2a5aa1)
- 🐞 修正:W3 补命名空间相对取词出口,并收口图片标注裸 TextInput (ba671cd8a99)
- 📚 ドキュメント:登记 P1 2026-10-19 LLM 观测失配修复轮(用户级指标+并发闸+探测降噪+系统身份映射) (715aac66435)
- 🐞 修正:门57 error-retry-action锚点改指ChatMessageList.tsx + 门44补登.doc-autoupdate白名单(2026-10-19) (bedbb942285)
- 🐞 修正:门 105 四端 ui-routes 派生产物重生成对齐当前 HEAD 源 —— 生成器原话出路(机械动作);生成前已验三个输入源的工作树与 HEAD 逐字一致,故产物自述钉与 head 面现算相等 (c59ee4d85c0)
- 🐞 修正:LLM 观测失配修复(用户级指标)+ 自伤并发闸 + 探测降噪 + 系统身份映射 (66a47341319)
- 🐞 修正:门 83 基线补登 ChatScreen.tsx 的 R2 存量 2 处(图片预览浮钮实底 surface.light,D124 引入时漏登基线 ⇒ 全量档恒红);按全量实测只补这一处,不动其余键 (893b31371c7)
- ♻️ リファクタ:斜杠命令模板类 id 清单下沉共享层 —— web/RN 共用同一份(端与端 import 边违反架构契约 D1,门 103 判红);web 侧改 re-export 消费方零改动,RN 测试基准换为共享层 (e77e5bb8e49)
- 🐞 修正:ChatScreen exhaustive-deps 两条 + ImageAnnotator 裸 TextInput 按 G-978007 判据补齐(CI lint/test 存量红) (b98806f33dd)
- 🐞 修正:agent 迁移 325 三处 ALTER TYPE 补 DROP DEFAULT(CI 测试库 42804 炸点,default 无法自动转换:federated id/dp_noise_added + meta source_skills) (4af9df7f938)
- 🔧 その他:chat-branch i18n mock 形状对齐类型定义(CI typecheck 5×TS2322) (4dd69c99528)
- 🐞 修正:token 就位后等 HubSpot 回调自动提交,不再重点 Submit(否则 reCAPTCHA 重弹) (b88382c6836)
- 🐞 修正:sso 隧道源站 8543→8850(端口铁律,注册表+docs §2.7 双向登记) (b2503baa8ee)
- 🐞 修正:修最后一处 shotPush 作用域错误 (82722394440)
- ♻️ リファクタ:划词批注输入框改用共享层 TextField(§3 共享层优先,端内禁止裸 TextInput);tsc/eslint/门218/门128/水印 全绿 (aaf524d3ebd)
- 📚 ドキュメント:G-194 结清 —— 真机复量:当前 HEAD 首页滚动已不复现,修法未落地 (5041621176d)
- 🐞 修正:沿祖先链修正显示属性并抬高层级(挑战被页面盖住) (f40959d2d9c)
- 📚 ドキュメント:G-167 ② 已落地并翻勾 —— 流键派生收口到 i18n-key-flow.mjs (0171084ee26)
- 🚀 機能/改善:G-167 ② 流键提取收口到 i18n-key-flow.mjs,门 2 与死键扫描共用同一份派生 (704aeb8f43d)
- 🐞 修正:强制把挑战 iframe 摆到可见位置(宿主 CSS 压成 150px 条带) (bba38b54b88)
- 🐞 修正:撤掉 CDP DPR 覆盖(打乱挑战浮层定位) + 网格截图取最大 bframe (df022c4ee35)
- 🐞 修正:挑战可见性判据改用格子计数 (7f0d26c28aa)
- 🐞 修正:修 shotPush 作用域错误 + console.error 入镜像 (0fe03661205)
- 📚 ドキュメント:撤回票 68 的错误翻勾 —— 运行时合格证未取得,且该行认领在他席 (68f7664a39e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cf85ee4574f)
- 🔧 その他:提交后加诊断截图 (77bbeb81aeb)
- 🐞 修正:不可见 reCAPTCHA 需等待挑战弹出(45s) + anchor 可见性判定 (d0617767f7a)
- 📚 ドキュメント:结清票 68 —— 流式中切换模型三端齐备(web 18 / 小程序 17 / RN 14 用例通过) (24c516271e6)
- 🐞 修正:先过 reCAPTCHA 再提交 + Submit JS 兜底 + 提交后复查挑战 (c5ccf62a858)
- 🐞 修正:批注面板圆角补齐角色档(门 150 点名 panel 应为 xl) (1b23b990989)
- 🐞 修正:reCAPTCHA 通过判据改 token + 2x 超采样截图 + Submit 重放 (50c8f28b5b9)
- 🐞 修正:SelectionAnnotationBar 徽章圆角改走档位源 rnRadius.md,去掉 rpx(14) 字面量(AGENTS.md 圆角单一源头:禁止 px/rpx 字面量,计数徽章模板即 rounded-md) (5b2b21def28)
- 🐞 修正:reCAPTCHA 支持动态挑战多屏循环 + 指令改走 Contents API 免 CDN (a6c085b7f16)
- 📚 ドキュメント:登记 RN↔web 能力对齐收口轮 —— 已对齐面/四类平台豁免/四处误报更正/落库与守门收口实证 (da046c43ad1)
- 🐞 修正:reCAPTCHA 支持动态挑战多屏循环 + 指令改走 Contents API 免 CDN (cc07bcfbeb8)
- 🐞 修正:mobile-rn ja 的 slashCmd.wechatArticle 去掉简体字「众」(日文应用「公式アカウント記事」);守门 2o ja 中文残留判红 (a2f39092003)
- 🔧 その他:回退F10折叠两行注记(门13d恒红,purge被3个他人在飞族卡),恢复父版正文 (36ca42c5228)
- 🐞 修正:守门 8 修两处判据盲区 + BP 腿基线下调到 15 (c1afcfc8ce0)
- 🐞 修正:折叠"同题不同编号"的孪生待办登记(F10 折叠档) (949f0a3d3a1)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (76045c98e0d)
- 🐞 修正:reCAPTCHA 指令轮询窗口 6 分钟 -> 10 分钟 (1dc3aa64282)
- 📚 ドキュメント:摘除 6 行 F1/F4 重复登记副本(并发旧基线 union 合并带回),认领标记原样转移 —— F1 3→0 / F4 3→0 (489ad005a52)
- 🚀 機能/改善:清 BP 腿量出的裸路径死调用 —— RN/小程序 2 处 + web 6 处改指在册端点 (4ba1934c568)
- 📚 ドキュメント:仪表盘数字订正为现读 26(删 jaeger/nginx 幻觉盘下游:MONITORING 21→26、README 三处 21/3/21→26、生成器头注 20+1→24 Prometheus+2 Loki)+ sync-readme-numbers.mjs 补溯源水印(CI watermark check 唯一未覆盖文件) (61031d3ad84)
- 🐞 修正:reCAPTCHA 挑战改按 DOM 格子序号点击,消除 3x3/4x4 坐标漂移 (f67bcb5fa4e)
- 🚀 機能/改善:斜杠命令面对齐 web(模板正文逐字取自 web chat.cmd*)+ 会话批注补复合归属键与 AsyncStorage 落盘(D180 对齐 web 三处语义);附 mobile-rn 五语言 slashCmd/slashTemplate/selectionAnnotations 词条与 automations.schedule 缺键 (895eefbdbd1)
- 🔧 その他:npm-bootstrap runner 加远端日志镜像与防挂死硬超时 (28563b79d73)
- 📚 ドキュメント:全文陈旧数字现读刷新(四语言同步,遗留项整改) (d56aa604a9d)
- 🔧 その他:删除已零引用的计划指针净化临时票据 plan-pointer-purge-2026-10-14-b56c9ad7.md(工作树删除收口,全仓零引用,git 历史可取回) (d6d12cfa96c)
- 📚 ドキュメント:全文陈旧数字现读刷新(四语言同步,遗留项整改) (07752095ed0)
- 📚 ドキュメント:补桌面/MSVC 构建注入与未签名豁免文档段 + 端口登记/port 文档 8861 对齐 dev:desktop:saas 新流程【出口②留痕:AGENTS.md 5 段在祖先 fc3cc1e03(union merge)提交过但被后续重组挤出 HEAD,属恢复丢失非复活陈旧——同批代码 msvc-env/desktop-build*/desktop-unsigned-config/desktop-artifact-single 早已在 HEAD(d03e3fe8d68+c304d2bcbb9),文档与代码是同一次工作的两部分;dev-port-registry.json 键路径复活 0、port-management.md 干净,均非 stale】 (f093663094b)
- 🔧 その他:GC翻勾7条已修票(skills市场授权2/D176/锁原子2/resolveRemoteHead/G-621) (ea6b14bd894)
- 🐞 修正:健康门禁 llm 维加源站 liveness 腿(公网 unknown 折算为绿)+CLEAN-BUILD 净面还原 sw.js (2ed0508fcb5)
- 🔧 その他:删除 5 个无引用死文件——3 张轮播图(引用已被 banner-*.jpg 替换)+ jaeger/nginx 两盘幻觉看板(零生成贡献) (741338179d2)
- 🚀 機能/改善:reCAPTCHA 闭环升级——挑战截图经 GITHUB_TOKEN 实时推 rc-live 分支(李总侧 raw 读取识别→坐标 rc-clicks.json 回传→点击),成功后清理 (9a598d8e405)
- 📚 ドキュメント:特性总览重写为结构化可扫读的能力展示(基于现读) (14de5d970c3)
- 📚 ドキュメント:P3 侧边栏收敛 RN 域入口层翻勾 (403cab6c145)
- 📚 ドキュメント:特性总览重写为结构化可扫读的能力展示(基于现读,李总诉求) (3b881dedf2e)
- 🚀 機能/改善:reCAPTCHA 图像挑战闭环(截图回传→rc-clicks.json 坐标指令→人类化点击→VERIFY→多轮);automation 超时 40min (998e83c7232)
- 🚀 機能/改善:L5669① skills 两级渐进披露 + 技能前置门 428 (130af8c18c7)
- ♻️ リファクタ:侧边栏收敛 P3 —— 教育/交易/社区收为域入口二级屏 (7bc83e2b593)
- 🐞 修正:BottomPops 门150 半径 control→sm + check-artifact-budget buildHint 对齐 wrapper/unsigned + ONBOARDING 桌面 dev 命令对齐 (a81e7cd986a)
- 🐞 修正:SignPath DD 改 label 定位 hsfc-DropdownField + combobox/option 交互;dump SP_DD_HTML 诊断 (342bd7a49e3)
- 🐞 修正:收归未签名豁免单源 + 银行 build 会话桌面端增量(MSVC 根治体系后续) (c304d2bcbb9)
- 📚 ドキュメント:修复最近更新机制基线悬空缺陷 + 块内容改由主线历史重生成 (6e2e29f3605)
- 🚀 機能/改善:守门 8 补 BP 腿 —— 裸路径传输口调用进调用集(本簇真正的根因器物) (a1c2f1f116a)
- 📚 ドキュメント:G-200 结清 —— 服务端有界续写随码入库,本号行与旧号同题副本一并翻勾 (b48b9675bbf)
- 🚀 機能/改善:守门 98 补 D5 维 —— 同一 barrel 文件内同名导出重复当场拦(防第五次回灌) (e4ef3b38ac8)
- 🚀 機能/改善:G-200 服务端有界续写落地 —— finish_reason 三面透传 + 每恢复段 ≤3 次 + 补丁不落持久历史 (bac27c8f7b0)
- 📚 ドキュメント:最近更新小节接入提交钩子,开发时自动从 git log 派生 (471d53ab18d)
- 🚀 機能/改善:补 GET /api/user/security 与 /api/circles/users/recommend —— 两条死路径的真实数据源 (7cfd10d17e3)
- 🔧 その他:认领 L5669 ①skills 两级渐进披露+技能前置门 428 (b9de28d2207)
- 📚 ドキュメント:自动化文档更新机制 —— 提交即刷新数字,每日 AI 刷新最近更新 (a862205d662)
- 🔧 その他:同步四端 ui-routes 派生产物(P2 域入口页新增路由) (90c5d44c06b)
- ♻️ リファクタ:侧边栏收敛 P2 —— 教育/内容/交易三域收为域入口(72→24) (126b47d148b)
- 🚀 機能/改善:G-425 端上截断提示补齐 RN + 小程序两条腿 —— done 帧 finishReason 判 length/max_tokens 即 toast,缺席绝不折成 stop (39471e598a0)
- 🐞 修正:6 个屏的 8 条死路径改指既有后端 —— 不新建端点、不造表 (8b3e8c5d5fa)
- 🐞 修正:清掉合并带回的 FormRequestEvent 重复导出 —— HEAD 面 TS2300 打死了本包 build (f1d0b6259cc)

**2026-10-21**
- 🐞 修正:用户自装的 mmcode 自愈脚本不是 agent 污染 —— 显式豁免 (18c81b13af9)

**2026-10-21**
- 📚 ドキュメント:回补 32 枚 PROJECT_PLAN 归档锚点件入库 (aba30748621)
- 🐞 修正:把 glass 两档登记进跨端 token 对账 —— 暗档手抄白值的漏登记当场补上 (688d894ae42)

**2026-10-21**
- 🐞 修正:删掉自己用例里的一处类型红(noUncheckedIndexedAccess) (e4098efc4b9)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a8d78bbbd57)
- 🔧 その他:给门 231 涉事判据喂测试桩 —— 夹具仓的树真门读不到,26 条端到端因此全红 (f7cb10c3396)
- 📚 ドキュメント:再补三条会打死全站的事实到运维档 —— 公网两臂都得活着(WS 只能留慢臂)/ EdgeOne 现无源站组(源站守卫能上线的前提)/ 别设 assetPrefix(CSP 会把跨域进来的脚本全拦) + React19 自动 preload 的真实成因 (c234639641d)
- 🚀 機能/改善:源站直连守卫上 EdgeOne —— 8801 直填家宽 IP 之后 Host 为裸公网 IP 的直连请求一律 403,失败方向全部 fail-open (e6a318d38fa)
- 🔧 その他:让号收口 F9 撞号 —— G-927 让给 G-1142551(归并前置,零删行) (67f45124bfa)
- 🐞 修正:名单外那台的信必须带门 153 已判出的问题行 —— "它停了"不可整改,"它的 exe 不存在"才可以 (eca627cb50c)
- ⚡ パフォーマンス:营销/文档页初始 JS 减 2,529KB raw / 523KB gz(三页各测) —— 把 BrandIcon 全集与 three 栈移出阻塞路径 (3c5a06a71ad)
- 🚀 機能/改善:手机端 REST 切快臂(实测 ttfb 差 1.3~7.0s),实时通道显式钉回 api 臂并写死"两臂都得活着" (542ec2105ec)
- 🐞 修正:归属账按 T10 摘除 B 档两条(.ihui-agent/tmp/outputs 已零命中) —— 陈旧放行凭据:盘上副本 = git show HEAD:该文件 ⊕ 这一处编辑,diff --numstat 1 插 19 删(scopeNote 摘记 1 行 + 两块 B 档条目体),无第三方行被写回;T10 点名后依 §0.7 删条目,尺子 13/13 (12612c2115f)
- ♻️ リファクタ:把纯 IP 判据从带 node:dns 的 ssrf-guard 里分出来 —— 为 Edge 侧消费铺路,行为零变化 (01af3886c24)
- 🐞 修正:摘掉 user.ts 里重复注册的 POST /user/ip-whitelist(HEAD 起 API 启动即 FST_ERR_DUPLICATED_ROUTE,本地全栈无法起) (8c41e92a62f)
- 🔧 その他:G-926 完成即删摘行(翻勾后整行删除,已勾行进不了守门 71 保护集) (41aa033ba63)
- 📚 ドキュメント:登记 2026-10-21 下午对齐第二轮(6 枚已入库;新派单:web ja/ko 机翻坏文按块清) (6498675ca80)
- 📚 ドキュメント:同轮收口登记 —— IP 白名单生效链、RN 管理面、五项护栏按人生效、小程序关于页、两条假端点删除 (5b3fe1f3c67)
- 🔧 その他:G-926 翻勾(B 档收口:60 枚取消跟踪 + 落地器删除档 + --self-test,三态复量全绿) (61062533365)
- 📚 ドキュメント:把 agent 护栏的过期自述与契约产物一起对齐到落地后事实 (1cd867fbf80)
- 📚 ドキュメント:L7220 桌面僵尸实例 P1-P3 进展登记(欠双实例现场复现,不翻勾) (5fa9b4c4120)
- 📚 ドキュメント:G-865 就地翻勾结清 —— DEFAULT_AVATAR_URL 死键已摘(枚 9410970ece45ddc00be11886f7d607ea2399f1f3,三处同批改,用例 9/9 与 shared tsc RC=0 为凭);行仍留 HEAD 等"完成即删"兜底轮摘除 (98c4de50b7a)
- 🐞 修正:僵尸实例三块补丁 —— preflight 填账可观测 + 启动相位只等不杀 + 事件循环后置健康门(L7220) (b2d6ff56ed3)
- 🔧 その他:摘掉 DEFAULT_AVATAR_URL 死键 —— 指向恒 502 的 file.aizhs.top 且消费方已归零(门 121「声明必须有消费者」) (9410970ece4)
- 🔧 その他:G-926 完成即删(B 档 60 枚已取消跟踪 + 落地器删除档 + --self-test,三态复量全绿) (76e1128fc98)
- 🚀 機能/改善:关于页三端同脸 —— 小程序补齐 web/RN 那六段结构 (a21108a3f46)
- 🔧 その他:无损折叠同行叠同一注记超额 26 份(7 行,方法学承 92b5d876) (31323b5d355)
- 📚 ドキュメント:§0.9 点名义务 —— 把本批三件新器物写进运维工具档(出口 IP 漂移尺子 / 部署收尾预热 / 公开接口边缘缓存头),并注明"判机器状态一律不接提交链" (1b6ab6e6188)
- 🚀 機能/改善:落地器 --self-test 自含电池(7 例,票面"带 --self-test 与镜像用例"收口)+ 镜像 T10 (04473df2771)
- 🐞 修正:摘掉指向死源站 file.aizhs.top 的用户可见素材引用 —— 该域名不在我们隧道上,恒 502 (bafa2de7790)
- 🐞 修正:页脚小图不再抢首屏连接 + docs 七页 21 条内链改 Link —— 根因是 React 19 SSR 对任意非 lazy img 自动发 preload (217a8998e64)
- 📚 ドキュメント:立票 —— 裸 git 派生棘轮 76→85(本席那一枚已改走 face-reader.gitRaw 并落地,读数随 86→85);行内写清取新增者名单的命令与两个实测坑(rev: 前缀要先剥、注释里的字面量也会被数进去),并注明存量清零前只报数 (df979a1eb27)
- ♻️ リファクタ:清扫器的派生 git 改走脚本层 —— 镜像套件里"裸 git 派生的生产文件只减不增"棘轮现读 76→86,本文件是新增者之一(我昨天落它时直接起 git 进程)。改法 = 那个 git() 帮手委托给 lib/face-reader 的 gitRaw(同时白拿它的超时/stdio/quotepath 纪律);注释里也不许出现裸调用字面量,否则棘轮正则连注释一起数(第一版就是这么"改了还在名单上")。现读:自检 15/15、镜像 12/12、预演 state=clean、eslint/prettier/watermark 全清。棘轮剩下的 9 枚新增者不在本席射程(逐枚归属见 git diff 14a04f013f..HEAD 那一族),已按实测另立条目 (35be7331286)
- 🚀 機能/改善:公开只读 GET 接口加边缘缓存头 —— 审计 P1.3 那一格,取值与写头收在唯一出口 (42e21bacda0)
- 🚀 機能/改善:安全中心接 IP 白名单管理面,并修掉 web settings.ip 的 ja/ko 机翻坏文 (29cdd1c00bf)
- 🚀 機能/改善:部署收尾预热 EdgeOne 真装车 —— warm-prod-cache.mjs 自落地起全仓零调用方,属"造好没装车=没有"(§0.9) (4eaefdde4bc)
- 🔧 その他:hooks-extended 修 Windows 读-写竞态 —— 钩子文件等内容非空而非仅等存在 (706847132c9)
- 🚀 機能/改善:家宽公网出口 IP 漂移装上看守 —— EdgeOne 源站直填 IP 之后全仓零器物,一变即全公网 5xx (030483ced98)
- 🐞 修正:同题多号存量 8 组 26 行收拢清零(机主授权@2026-10-21) (0eb36182652)
- 🚀 機能/改善:五项安全开关改为按登录主体生效(硬门与 kill switch 不受用户档影响) (59ea36eb632)
- 🐞 修正:exec 族出 stdio 维度射程 —— 回退 hooks-auto 的 exec stdio(ExecOptions 无该字段),姊妹门 classify 加 exec 排除层 (b6281fcacda)
- 🔧 その他:取消跟踪 60 枚 tracked-but-ignored 临时件(B 档:56 枚 plan-pointer-purge 取证流水 + 4 枚 outputs;LAND_REMOVE_PATHS 首用) (988a243cd12)
- 🐞 修正:补回 32ce073019de6d750a65133aec3146752ff3e655 自己造成的回归 —— 我用 prettier 重排该文件时把 `const HEADING = /…/gm` 折成两行,而镜像 next-plan-id-remote 的 T5/T6 从源码里抽这颗字面量复用(§22c),抽取一失败两条就从绿变红;上一枚报的"6/6"是重排**之前**量的,当时已失效。修法 = 注解写明形状承重 + `// prettier-ignore` 紧贴该行(注释与 const 之间留空行 = ignore 不生效,第一版就这么没成),并把量词写成 `{0,}`(与祖先逐字相同会被门 84 判"复活行"假阳,这里是等价改形)。现读:prettier 通过、next-plan-id-remote 6/6、plan-id-duplicates 6/6、plan-id-lease 9/9、--check rc=0、watermark 零残迹。教训钉进注释:核对顺序必须是 改 → 全跑 → 再落地,格式化也算改 (5a9d8f26d9e)
- ♻️ リファクタ:删掉 PDF print/sign 两条假端点(全仓零消费方) (d22063dd4e6)
- 🚀 機能/改善:落地器暴露 LAND_REMOVE_PATHS 声明式删除出口(G-926 器物侧) (f20d7354f0e)
- 🚀 機能/改善:IP 白名单生效链接入 18 条新登录腿(只拦新会话、留自救出口) (9383e4645a2)
- 🔧 その他:G-1162551 第三次改判留勾(清扫⇄回捞连抖,不再摘第二次) (80d437743b8)
- 🐞 修正:服务自愈「重启预算用完」终态接到人 —— 45 分钟 boot 崩曾一封信都没有 (4f9371871d5)
- 🚀 機能/改善:打通历史课程视频的播放链 (506f115c1b1)
- 🔧 その他:G-53 与 L6762 结清翻勾 (f029adf6f52)
- 🚀 機能/改善:把 history-read-ops 真挂进 ihui chat history(L6762 的真缺口)并钉装车锁 (172aba73338)
- 🚀 機能/改善:补齐流式中换档即终止的腿(G-53 唯一真缺口,四端同判据表) (b00e5766c55)
- 📚 ドキュメント:立票 —— 旁路落地器镜像套件红 26 例的根因(门 231 --rev 按自身仓根解析树 oid,测试通道换仓时该 oid 在主仓不存在 ⇒ exit 2 ⇒ 落地器 fail-closed 拒 ⇒ 用例整批红;生产面不受影响)。成因枚 e1f18b5a32070c9ab14f71187b963fc3de95c3ca,归属该门持有席(它此刻正被并发编辑);两条出路都写明,并禁止用"摘门/加 skip"消红 (5ea8c7ae9c0)
- 🔧 その他:给关于页补行为级自证套件(§17 不许只凭代码审查声明改好) (7561a8b9092)
- 🐞 修正:摘掉 drawer-nav 三枚无人使用的 lucide 图标 (adadf82b37c)
- 📚 ドキュメント:D18 SDK 发布尝试被 npm 拒的真因登记 (3b64f1fa79e)
- 📚 ドキュメント:常驻工具清单点名 audit-pane-store-addressing.mjs(只读普查尺子,未接提交链也不接巡检轮 —— 它判的是"该不该按窗格分"这类人要读的归属,挂 blocking 即 §12e 恒红门) (7fbaea08b2a)
- 🔧 その他:补一把只读普查尺子 audit-pane-store-addressing.mjs(票60)—— 从"会进非根窗格的子树"(ChatPaneBody/MessageList/MessageInput,含 @/hooks,depth 可调)做 import BFS,列出现存 store 与三态窗格通道(自带 ForPane / 被注册表 import / 无),另给归属代理(状态形状里有没有会话或消息为键)。刻意**不接提交链也不接巡检轮**:它判的是"这枚 store 该不该按窗格分",那是人要读的归属问题,挂 blocking 就是 §12e 恒红门(同 check-temp-landing / alert-volume-report 那一档);取材失败显式 exit 2「未判定」不记绿。现跑读数:子树扫 40 个文件、引用 12 枚 store,已有通道 2(chat 经注册表、progress-jump 自带)、无通道 10。isDirectRun 走 pathToFileURL(§22d),eslint/prettier/watermark/门 221 全清 (0ff18ec7258)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (eba4bcb57ec)
- 📚 ドキュメント:G-53 持有行复量 + 旧号 68 孪生行补副本指针 + L6762/L28828 处置留痕 (2069ae3d9fc)
- 📚 ドキュメント:票60 行补非根窗格 store 普查读数 —— 子树 12 枚:已有通道 2(chat 经注册表、progress-jump 自带)、按设计属全局 3(auth/auth-store/navigation)、以会话或消息为键因而天然安全 2(ai-panel、d180)、要逐座定性的 5 枚点名(business-forms 的 clearForms 清全部 = 任一窗格切会话抹掉别窗格填一半的业务表单,是用户可见数据丢失;context-mention;conversation-detail-mode 名实待读;mode.ts;timeline-store),并写明判据与片 5 同形(能寻址的走 usePaneChatStore,只能按会话归属的把 conversationId 写进键里、清理动作按键收窄,不得整表 clear) (6789a60c66a)
- 🐞 修正:诊断清单的 `[object Object]` —— 我把 notOk 改成对象后漏改了一处映射 (e884297f30f)
- 🐞 修正:删掉 user.ts 里只会回显的 POST /user/ip-whitelist 空壳 —— 它与 security-config-routes 的同路径真实现同时注册,Fastify 抛「already declared」⇒ IHUI-API 崩溃循环 60 次、8802 未监听、登录全量 500、部署环健康门禁 8 轮不过已回滚 (7078c88d956)
- 🚀 機能/改善:跨端对账门补 CSS Module / CSS-in-JS 取用形态覆盖面(CS 维)—— 收 L28828 空白② (ba9f1bca74f)
- 🐞 修正:补回上一枚漏掉的类型标注 —— pane-tail-consumers 的 assistant() 工厂返回 ChatMessage(字面量 role 不做返回类型标注时 tsc 判 string 不可赋给联合类型,3 条 TS2322 随 cca856a67c 落进了 HEAD)。教训自己钉住:vitest 绿不等于 tsc 绿(测试文件的类型不在 esbuild 编译路径上),落地前必须单独跑一次 tsc 并按文件过滤归因。修后 tsc 现读 2 条错误均属他席在飞(panels/page.tsx headerExtra、status/models-section 工作树缺),本枚文件零命中;3 例仍绿 (fcdb043e85f)
- 📚 ドキュメント:票60 行残余① 收口 —— 长尾四座已窗格化(枚 cca856a67cededa438319b203c4f233ff1437b05,成对 3 例 + 变异对照全红,宽档 1710 例绿),3 座按边界 1 只根窗格渲染 + 侧栏族按设计属全局面 ⇒ 不窗格化的理由写进行内;同枚修掉 D184 源码字面量锁的假阳成因与反证 (c2aa045c2af)
- 🚀 機能/改善:票60 长尾四座窗格化 —— 朗读腿(voice-stream-speaker)/画布覆盖层(canvas-overlay)/采样参数面板与按钮(sampling-params-panel)/连接态入口(agent-progress-trigger)改读 usePaneChatStore:它们经 MessageInput/MessageList 进非根窗格,原先读根单例 ⇒ 在非根窗格里显示与写入的是根会话的参数/正文/消息流。成对 3 例:① 根窗格流式收尾不触发本窗格、本窗格自己过 done 边沿才播 ② Provider 外仍读根单例(单窗格形态逐字不变)③ 形状锁钉四座不再引用根单例;变异对照(把朗读腿改回读根单例)3 条当场全红,还原后逐字节相同。顺手修 D184 那条源码字面量锁:票60 片 4 起 detail 里多一个 paneId,旧逐字单行断言把合法代码读成"没派发"(HEAD 面实测红),归一化只吞排版(折行+尾逗号),事件名与 text: selectionText 仍逐字钉住并补两型反证。176 文件 1710 例绿,eslint/prettier/watermark 全清 (cca856a67ce)
- 🚀 機能/改善:侧边栏与 web 端全量对齐(第五批) - 抽屉补 57 条 web 缺口+移动端独立分组, 域 hub 补 12 条 edu/content/trade, 五语新增 5 个分组键 (e1005d41cdd)
- 🚀 機能/改善:侧边栏与 web 端全量对齐(第五批) - 抽屉补 57 条 web 缺口+移动端独立分组, 域 hub 补 12 条 edu/content/trade, 五语新增 5 个分组键 (fed40bbacb2)
- 📚 ドキュメント:同轮补的后端读写面、门户两条缺页与记忆详情 WebView 承载登记 (83b1e59b5dc)
- 📚 ドキュメント:登记 2026-10-21 RN↔web 全量对齐收口轮(本轮 3 枚已入库;IP 白名单与 agent 护栏的生效链待拍板) (bc93cac4af3)
- 🚀 機能/改善:门户补两张缺页 + 记忆详情走 WebView 承载 (ef7cc1697a0)
- 🔧 その他:夹具的 git 身份落进仓库 config —— CI 干净检出没有全局 user.*,21 枚用例在第一步就抛 (f7043438ed4)
- 📚 ドキュメント:票60 行残余① 从"13 处"收紧到现读分档 —— 真会串 4 座(sampling-params-panel / agent-progress-trigger / voice-stream-speaker 经 message-input,canvas-overlay 经 MessageList+artifact-canvas),3 座按边界 1 只在根窗格渲染(compaction-status-bar / d176-task-recap / task-monitor-sections,把它下面板化时要与片 3 数据面同批改),4 座按设计属全局面 ⇒ 下一片射程=那 4 座,判据同片 5 的两种形态 (a4e07eccbe4)
- 📚 ドキュメント:票60 行就地改写 —— 残余② ProgressJumpStore 已窗格化(枚 d01bc20577c0b7075b0f8e5d14e7058b3730c94b,成对 7 例 + 变异对照 5 红,268 例绿);残余① 13 处根单例消费面定性清单留在行内 (5a680ada9b8)
- 🚀 機能/改善:票60 残余 —— ProgressJumpStore 按窗格寻址(照 usePaneChatStore 同一形态:状态配方只有一份 buildProgressJumpState,根单例与各窗格实例都由它构造,nonce/highlightTimer 挪进实例闭包) ⇒ 任一窗格消费后 clearPendingJump 不再抢走别窗格那次跳转、高亮与 PlanStep↔Message 联动映射不再跨窗格串;Provider 外仍恒返回根单例(单窗格调用面逐字不变),空 paneId 抛错不静默回落;消费面 5 处改用 useProgressJumpStoreForPane(pane-gate 那枚既有用例的观测面随之改挂到该窗格实例,断言未放宽)。成对 7 例含变异对照:把 getProgressJumpStoreForPane 改回返回根单例 ⇒ 5 条当场红(还原后逐字节相同);34 文件 268 例绿,eslint/prettier/watermark 全清 (d01bc20577c)
- 🔧 その他:L7177 区段头折行回潮改判留勾(不摘第二次) (94a133dc824)
- 🔧 その他:五枚摘后被自愈按未勾补回的行改判留勾(回潮型,不摘第二次) (190ad482554)
- 🔧 その他:重钉 web ui-routes 自述钉(承接大屏 13 处红字改档) (994d9dd6da1)
- 🔧 その他:九枚本机也红的镜像测试 —— 八枚是"测试停在旧世界/测量缺陷",一枚是共享判据的漏判 (d3646d3b255)
- 🐞 修正:大屏 13 处红字改走 danger 角色档 —— 真浏览器逐元素量出来 text-destructive 亮档只有 3.64(两档同值 #ff3333 是漏网的一族),换档后亮 5.65~6.47 / 暗 5.73~6.29 (a7a68146729)
- 🐞 修正:lucide-react-native 强制单实例；底栏取源方式定档留痕 (036f52bce07)
- 📚 ドキュメント:G-924 就地改判 —— 那 10 条取不到的图标 URL 全是零消费方死键,不是用户可见破图(出路改按门 121 摘死键) (9496f924ab9)
- 📚 ドキュメント:G-934 结清(接线枚 c5b3f0f65d9c7a6979b476bcce16e67caad34822 + 23/23 与 211/211 复量 + §17 真浏览器核验枚 82c9a68ae0f2acf61a84b709caa5ed4d4bce8cd3 + README 同步枚 c9e4a15681437b1d2efb595944a0b3a69072cbbb);G-935 记第一枚 e2e 与产品定档(维持"拆分=承载既有会话",不改真分叉;双流式/工具面板仍无用例 ⇒ 不翻勾;窗格会话 write-once 使更强形态结构性不可达,以 annotations.gap 点名);票60 行补现读残余(13 处根单例消费面定性清单 + ProgressJumpStore 未窗格化) (a96c36ad4c2)
- 🚀 機能/改善:关于页照 web 补齐六段内容,合规 7 项改走 i18n 取词 (cd57f5d3d38)
- 📚 ドキュメント:把 HEAD 面体积收回 96,000 预算内(96618→95854) —— 按 §1 两步走逐字留痕搬出两行:207 的旧档(warn 起步/50KB,已被同段"定档更正"整段取代)与一枚重复的压缩版页脚,去处 .ihui-agent/archive/AGENTS_trim-2026-10-20.md(同族追加,原位置留 HTML 指针注记) (b16c42f5261)
- 🔧 その他:票60/G-935 多窗格与滚动位恢复补上真浏览器核验 —— 新增 chat-pane-split-scroll-restore.spec.ts 4 例(① 切走再切回落点±60px 内且非零 ② 反证 短会话不冒充恢复 ③ 拆分后两格各有独立消息列表 DOM ④ 反证 同一会话双窗格 scrollTop 各记各的 |Δ|>200 + 根格切走切回恢复自己而 pane-1 不动);全链 page.route  mocked 不依赖活后端,PLAYWRIGHT_REUSE_SERVER 连跑两次 4 passed/4 passed;④ 更强形态(pane-1 也切走再切回)按产品事实不可达(窗格会话 write-once:canDropToPane 只认空叶 + dropConversationToPane 拒非空目标)⇒ 用例内以 annotations.gap 点名,不当已完成 (82c9a68ae0f)
- 📚 ドキュメント:登记小程序 10 条远程图标线上取不到(6 条代码残路径 + 4 条旧上传件已失) (93595c2f754)
- 🐞 修正:多设备在线时 versionCode 自动定档逐个 -s 询问（此前不带 -s 被 adb 拒绝 ⇒ 静默回落 1，产出降级包装不上） (fee177a1f8e)
- 📚 ドキュメント:G-927 现读进展 —— 判据认形态后误报清零,剩块级重复归人工 (40c78817179)
- 🐞 修正:取号器重号判据认系列小后缀形态,不再把正当小节读成撞号(G-927) (82ee72dbf12)
- 🔧 その他:失败清单必须带诊断 —— 只印用例名等于"红了 102 条却没有一个字说为什么" (bbb2f362441)
- 🐞 修正:三处"只在单层检出/单台机上成立"的判据 —— c-drive 路径正则、硬编码 G:、未入库证书夹具 (359af9e4b45)
- 📚 ドキュメント:§21 同步 —— D73 多任务窗格行补「会话级滚动位按窗格::会话落账」(G-934 把恢复接回生产后的用户可见能力:切走存 scrollTop+following、切回两段恢复+grace 修正、同一会话双窗格各记各的) (c9e4a156814)
- 📚 ドキュメント:G-939 结清 —— 旁路合并两半复量均已接车入库(门 100 A1 半 + 门 168 半) (0499c91575d)
- 📚 ドキュメント:登记 870 枚历史课程视频接入播放链(云端桶已就位,现网零课程行;上架前置三件) (3b07f00330e)
- 📚 ドキュメント:G-927 现读分档 —— 7 组里真孪生 8 处 vs 系列小节(O62 附族等),并点名两处判据不自洽(--check 按编号计数而默认路径自写"追加续写不算相撞"=同一把尺两个面两种结论 §0.6;plan-tasks-merge --heal 现读 F1 0/F4 0/F10 判不出 4,标题行不在 F4 射程 ⇒ 原出路结构性打不到);出路顺序改为先修分组键为「编号+标题整行逐字」再摘孪生 (5586dadcc31)
- 🐞 修正:视频小节详情补 playUrl 出网名,修小程序视频页必然黑屏 (消费方 video-detail/index.tsx:202 读 playUrl,生产者只出 url;新增 4 例离线契约测试钉住同值与 400/404 臂) (a1f899efb9f)
- 🔧 その他:fix(gate-?) killer-parity-ends 的两枚真红:一枚是测试停在旧世界,一枚是同值不同义没登记 (0cdbbf3719d)
- 📚 ドキュメント:G-926 就地改写 —— A 档 25 枚已由就近出口件中和(枚 7bbf24ec4b8120db003ae496455bcc8b9aed6cf8)、C 档 2 枚按账内出路放 .gitignore 例外(枚 c8b17fe8ea70de22ed59dc775bf4fafdfcdb2e65)、归属账两条由 T10 清单腐烂档点名后摘除;剩 B 档 58 枚的拦路是"旁路落地器表达不了删除"这一格,出路写成可动手的活(lib 已有 deleted 护栏,要的是声明式出口 + 反向自证 + 正反用例),题面 84 枚按现读更正为 87/命中 83/中和 25/残留 58 (594bc634bb2)
- 🐞 修正:release 构建拒绝裸 apex 基址 + ABI/基址回读对账（真机实测） (45397bc186e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7145a144459)
- 🐞 修正:收口锁自检两处 flaky 成因 —— 计时窗外置身份探针 + 派生 CLI 显式 stdio(L7233 那一格) (6a06acc6709)
- 🐞 修正:旁路合并接门 168 —— 推进前复量本侧显式删除是否被合并带回结果树(G-939) (0f8a38e9cd1)
- 🚀 機能/改善:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (274c78e0eaa)
- 🔧 その他:G-212 重新销账 + L7233 现读复量 (9aeb9d51a60)
- 🔧 その他:复验 L7177 区段头折行结清 + 更新 D18/L6762 现读 (ee57b4c96d2)
- 🐞 修正:门 193 掩码根治 —— markHidden 认正则字面量(L477 病灶跨行错位误判自检夹具判红 2 处阻塞 push),连带清偿 4 处被错位洗绿的真违规 (98e7b8a62c4)
- 📚 ドキュメント:G-939 结清 —— 旁路合并侧已 import 门 100 的 A1 判据在 update-ref 前复量(枚 402f347edc/bf25ee60e2),红则拒推进+保全悬空枚+点名,裸跳门旗不放行;镜像 6/6 含真夹具正控,最近 4 枚 converge 合并逐枚复量 lost=0 (47cb77e6495)
- 🐞 修正:Python 子进程一律钉 UTF-8 —— 那族门在 Windows 上会把「判据说的话」读成乱码 (d6655c70c30)
- 🚀 機能/改善:派发契约键集对账尺子入库(常设只读,禁接提交链)—— 12 格真跑 119 个声明读键全量到;自检 7/7 含'不许裸豁免'与'跑不出 JSON 不得当空集'两条反证,并明写两条边界(不发现新读键、数组元素内字段不在射程) (58bd3c15e52)
- 🔧 その他:补 ai-service 空 venv —— 判据住在 Python 里的那族守门此前在 CI 上恒「未判定」 (0c6723389f1)
- 🔧 その他:翻勾 G-274 与 G-1162551,改判 G-620/G-923 现读 (89c12fe5665)
- 🚀 機能/改善:G-934 会话级滚动位恢复接回生产 —— hook 切走落账/切回二段恢复(RESTORE_PHASE2_DELAY_MS/RESTORE_GRACE_MS 由模块常量驱动),键加窗格维 pane::conversation 防双窗格同会话互串,grace 期修正挂 handleScroll,卸载定时器;成对用例 6 例(正向=窗格隔离,反证=单窗格缺省形态逐字不变;把窗格维摘掉 4 例当场红) (c5b3f0f65d9)
- 🚀 機能/改善:把 SSE 全量帧盲合并门接进提交链(id 233,blocking)—— 收 G-274 (b559acd95cd)
- 🚀 機能/改善:G-939 补第二格 —— 吞并复量"过了也要把判过量出来"(丢失/补回计数落 dim 行),atRefUndetermined 非空时单独喊未判定,不并进"零丢失"那句(§0.3:静默通过与根本没跑到这一步在日志里同形) (bf25ee60e2a)
- 🐞 修正:G-939 把门 100 的 A1 判据 import 给旁路合并侧复量 —— commit-tree+CAS 不跑钩子,对"吞掉对侧独有新增"结构性失明(实测本轮自己的 wave3 提交被卷走);落 update-ref 前拒推进并 backupOrphanMerge,裸 skipEnv 无理由照拦,成对镜像 6 例含真夹具正控 (402f347edc2)
- 🔧 その他:翻勾 L7224 / G-932 / G-922 (079a269bf6f)
- 🔧 その他:检出改为全历史 —— 那批"必须拿真仓历史证"的判据在浅克隆上结构上过不了 (2fc70504830)
- ♻️ リファクタ:AI_SERVICE_URL 默认值收敛为单一真相源,并由 localhost 改 127.0.0.1 (8861116d425)

**2026-10-21**
- 🚀 機能/改善:安全中心接 IP 白名单管理面,并修掉 web settings.ip 的 ja/ko 机翻坏文 (29cdd1c00bf)
- 🚀 機能/改善:五项安全开关改为按登录主体生效(硬门与 kill switch 不受用户档影响) (59ea36eb632)
- ♻️ リファクタ:删掉 PDF print/sign 两条假端点(全仓零消费方) (d22063dd4e6)
- 🚀 機能/改善:IP 白名单生效链接入 18 条新登录腿(只拦新会话、留自救出口) (9383e4645a2)
- 🔧 その他:给关于页补行为级自证套件(§17 不许只凭代码审查声明改好) (7561a8b9092)
- 🐞 修正:摘掉 drawer-nav 三枚无人使用的 lucide 图标 (adadf82b37c)
- 🚀 機能/改善:侧边栏与 web 端全量对齐(第五批) - 抽屉补 57 条 web 缺口+移动端独立分组, 域 hub 补 12 条 edu/content/trade, 五语新增 5 个分组键 (fed40bbacb2)
- 📚 ドキュメント:同轮补的后端读写面、门户两条缺页与记忆详情 WebView 承载登记 (83b1e59b5dc)
- 📚 ドキュメント:登记 2026-10-21 RN↔web 全量对齐收口轮(本轮 3 枚已入库;IP 白名单与 agent 护栏的生效链待拍板) (bc93cac4af3)
- 🚀 機能/改善:门户补两张缺页 + 记忆详情走 WebView 承载 (ef7cc1697a0)
- 🔧 その他:夹具的 git 身份落进仓库 config —— CI 干净检出没有全局 user.*,21 枚用例在第一步就抛 (f7043438ed4)
- 📚 ドキュメント:票60 行就地改写 —— 残余② ProgressJumpStore 已窗格化(枚 d01bc20577c0b7075b0f8e5d14e7058b3730c94b,成对 7 例 + 变异对照 5 红,268 例绿);残余① 13 处根单例消费面定性清单留在行内 (5a680ada9b8)
- 🚀 機能/改善:票60 残余 —— ProgressJumpStore 按窗格寻址(照 usePaneChatStore 同一形态:状态配方只有一份 buildProgressJumpState,根单例与各窗格实例都由它构造,nonce/highlightTimer 挪进实例闭包) ⇒ 任一窗格消费后 clearPendingJump 不再抢走别窗格那次跳转、高亮与 PlanStep↔Message 联动映射不再跨窗格串;Provider 外仍恒返回根单例(单窗格调用面逐字不变),空 paneId 抛错不静默回落;消费面 5 处改用 useProgressJumpStoreForPane(pane-gate 那枚既有用例的观测面随之改挂到该窗格实例,断言未放宽)。成对 7 例含变异对照:把 getProgressJumpStoreForPane 改回返回根单例 ⇒ 5 条当场红(还原后逐字节相同);34 文件 268 例绿,eslint/prettier/watermark 全清 (d01bc20577c)
- 🔧 その他:L7177 区段头折行回潮改判留勾(不摘第二次) (94a133dc824)
- 🔧 その他:五枚摘后被自愈按未勾补回的行改判留勾(回潮型,不摘第二次) (190ad482554)
- 🔧 その他:重钉 web ui-routes 自述钉(承接大屏 13 处红字改档) (994d9dd6da1)
- 🔧 その他:九枚本机也红的镜像测试 —— 八枚是"测试停在旧世界/测量缺陷",一枚是共享判据的漏判 (d3646d3b255)
- 🐞 修正:大屏 13 处红字改走 danger 角色档 —— 真浏览器逐元素量出来 text-destructive 亮档只有 3.64(两档同值 #ff3333 是漏网的一族),换档后亮 5.65~6.47 / 暗 5.73~6.29 (a7a68146729)
- 🐞 修正:lucide-react-native 强制单实例；底栏取源方式定档留痕 (036f52bce07)
- 📚 ドキュメント:G-924 就地改判 —— 那 10 条取不到的图标 URL 全是零消费方死键,不是用户可见破图(出路改按门 121 摘死键) (9496f924ab9)
- 📚 ドキュメント:G-934 结清(接线枚 c5b3f0f65d9c7a6979b476bcce16e67caad34822 + 23/23 与 211/211 复量 + §17 真浏览器核验枚 82c9a68ae0f2acf61a84b709caa5ed4d4bce8cd3 + README 同步枚 c9e4a15681437b1d2efb595944a0b3a69072cbbb);G-935 记第一枚 e2e 与产品定档(维持"拆分=承载既有会话",不改真分叉;双流式/工具面板仍无用例 ⇒ 不翻勾;窗格会话 write-once 使更强形态结构性不可达,以 annotations.gap 点名);票60 行补现读残余(13 处根单例消费面定性清单 + ProgressJumpStore 未窗格化) (a96c36ad4c2)
- 🚀 機能/改善:关于页照 web 补齐六段内容,合规 7 项改走 i18n 取词 (cd57f5d3d38)
- 📚 ドキュメント:把 HEAD 面体积收回 96,000 预算内(96618→95854) —— 按 §1 两步走逐字留痕搬出两行:207 的旧档(warn 起步/50KB,已被同段"定档更正"整段取代)与一枚重复的压缩版页脚,去处 .ihui-agent/archive/AGENTS_trim-2026-10-20.md(同族追加,原位置留 HTML 指针注记) (b16c42f5261)
- 🔧 その他:票60/G-935 多窗格与滚动位恢复补上真浏览器核验 —— 新增 chat-pane-split-scroll-restore.spec.ts 4 例(① 切走再切回落点±60px 内且非零 ② 反证 短会话不冒充恢复 ③ 拆分后两格各有独立消息列表 DOM ④ 反证 同一会话双窗格 scrollTop 各记各的 |Δ|>200 + 根格切走切回恢复自己而 pane-1 不动);全链 page.route  mocked 不依赖活后端,PLAYWRIGHT_REUSE_SERVER 连跑两次 4 passed/4 passed;④ 更强形态(pane-1 也切走再切回)按产品事实不可达(窗格会话 write-once:canDropToPane 只认空叶 + dropConversationToPane 拒非空目标)⇒ 用例内以 annotations.gap 点名,不当已完成 (82c9a68ae0f)
- 📚 ドキュメント:登记小程序 10 条远程图标线上取不到(6 条代码残路径 + 4 条旧上传件已失) (93595c2f754)
- 🐞 修正:多设备在线时 versionCode 自动定档逐个 -s 询问（此前不带 -s 被 adb 拒绝 ⇒ 静默回落 1，产出降级包装不上） (fee177a1f8e)
- 📚 ドキュメント:G-927 现读进展 —— 判据认形态后误报清零,剩块级重复归人工 (40c78817179)
- 🐞 修正:取号器重号判据认系列小后缀形态,不再把正当小节读成撞号(G-927) (82ee72dbf12)
- 🔧 その他:失败清单必须带诊断 —— 只印用例名等于"红了 102 条却没有一个字说为什么" (bbb2f362441)
- 🐞 修正:三处"只在单层检出/单台机上成立"的判据 —— c-drive 路径正则、硬编码 G:、未入库证书夹具 (359af9e4b45)
- 📚 ドキュメント:§21 同步 —— D73 多任务窗格行补「会话级滚动位按窗格::会话落账」(G-934 把恢复接回生产后的用户可见能力:切走存 scrollTop+following、切回两段恢复+grace 修正、同一会话双窗格各记各的) (c9e4a156814)
- 📚 ドキュメント:G-939 结清 —— 旁路合并两半复量均已接车入库(门 100 A1 半 + 门 168 半) (0499c91575d)
- 📚 ドキュメント:登记 870 枚历史课程视频接入播放链(云端桶已就位,现网零课程行;上架前置三件) (3b07f00330e)
- 📚 ドキュメント:G-927 现读分档 —— 7 组里真孪生 8 处 vs 系列小节(O62 附族等),并点名两处判据不自洽(--check 按编号计数而默认路径自写"追加续写不算相撞"=同一把尺两个面两种结论 §0.6;plan-tasks-merge --heal 现读 F1 0/F4 0/F10 判不出 4,标题行不在 F4 射程 ⇒ 原出路结构性打不到);出路顺序改为先修分组键为「编号+标题整行逐字」再摘孪生 (5586dadcc31)
- 🐞 修正:视频小节详情补 playUrl 出网名,修小程序视频页必然黑屏 (消费方 video-detail/index.tsx:202 读 playUrl,生产者只出 url;新增 4 例离线契约测试钉住同值与 400/404 臂) (a1f899efb9f)
- 🔧 その他:fix(gate-?) killer-parity-ends 的两枚真红:一枚是测试停在旧世界,一枚是同值不同义没登记 (0cdbbf3719d)
- 📚 ドキュメント:G-926 就地改写 —— A 档 25 枚已由就近出口件中和(枚 7bbf24ec4b8120db003ae496455bcc8b9aed6cf8)、C 档 2 枚按账内出路放 .gitignore 例外(枚 c8b17fe8ea70de22ed59dc775bf4fafdfcdb2e65)、归属账两条由 T10 清单腐烂档点名后摘除;剩 B 档 58 枚的拦路是"旁路落地器表达不了删除"这一格,出路写成可动手的活(lib 已有 deleted 护栏,要的是声明式出口 + 反向自证 + 正反用例),题面 84 枚按现读更正为 87/命中 83/中和 25/残留 58 (594bc634bb2)
- 🐞 修正:release 构建拒绝裸 apex 基址 + ABI/基址回读对账（真机实测） (45397bc186e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7145a144459)
- 🐞 修正:收口锁自检两处 flaky 成因 —— 计时窗外置身份探针 + 派生 CLI 显式 stdio(L7233 那一格) (6a06acc6709)
- 🐞 修正:旁路合并接门 168 —— 推进前复量本侧显式删除是否被合并带回结果树(G-939) (0f8a38e9cd1)
- 🚀 機能/改善:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (274c78e0eaa)
- 🔧 その他:G-212 重新销账 + L7233 现读复量 (9aeb9d51a60)
- 🔧 その他:复验 L7177 区段头折行结清 + 更新 D18/L6762 现读 (ee57b4c96d2)
- 🐞 修正:门 193 掩码根治 —— markHidden 认正则字面量(L477 病灶跨行错位误判自检夹具判红 2 处阻塞 push),连带清偿 4 处被错位洗绿的真违规 (98e7b8a62c4)
- 📚 ドキュメント:G-939 结清 —— 旁路合并侧已 import 门 100 的 A1 判据在 update-ref 前复量(枚 402f347edc/bf25ee60e2),红则拒推进+保全悬空枚+点名,裸跳门旗不放行;镜像 6/6 含真夹具正控,最近 4 枚 converge 合并逐枚复量 lost=0 (47cb77e6495)
- 🐞 修正:Python 子进程一律钉 UTF-8 —— 那族门在 Windows 上会把「判据说的话」读成乱码 (d6655c70c30)
- 🚀 機能/改善:派发契约键集对账尺子入库(常设只读,禁接提交链)—— 12 格真跑 119 个声明读键全量到;自检 7/7 含'不许裸豁免'与'跑不出 JSON 不得当空集'两条反证,并明写两条边界(不发现新读键、数组元素内字段不在射程) (58bd3c15e52)
- 🔧 その他:补 ai-service 空 venv —— 判据住在 Python 里的那族守门此前在 CI 上恒「未判定」 (0c6723389f1)
- 🔧 その他:翻勾 G-274 与 G-1162551,改判 G-620/G-923 现读 (89c12fe5665)
- 🚀 機能/改善:G-934 会话级滚动位恢复接回生产 —— hook 切走落账/切回二段恢复(RESTORE_PHASE2_DELAY_MS/RESTORE_GRACE_MS 由模块常量驱动),键加窗格维 pane::conversation 防双窗格同会话互串,grace 期修正挂 handleScroll,卸载定时器;成对用例 6 例(正向=窗格隔离,反证=单窗格缺省形态逐字不变;把窗格维摘掉 4 例当场红) (c5b3f0f65d9)
- 🚀 機能/改善:把 SSE 全量帧盲合并门接进提交链(id 233,blocking)—— 收 G-274 (b559acd95cd)
- 🚀 機能/改善:G-939 补第二格 —— 吞并复量"过了也要把判过量出来"(丢失/补回计数落 dim 行),atRefUndetermined 非空时单独喊未判定,不并进"零丢失"那句(§0.3:静默通过与根本没跑到这一步在日志里同形) (bf25ee60e2a)
- 🐞 修正:G-939 把门 100 的 A1 判据 import 给旁路合并侧复量 —— commit-tree+CAS 不跑钩子,对"吞掉对侧独有新增"结构性失明(实测本轮自己的 wave3 提交被卷走);落 update-ref 前拒推进并 backupOrphanMerge,裸 skipEnv 无理由照拦,成对镜像 6 例含真夹具正控 (402f347edc2)
- 🔧 その他:翻勾 L7224 / G-932 / G-922 (079a269bf6f)
- 🔧 その他:检出改为全历史 —— 那批"必须拿真仓历史证"的判据在浅克隆上结构上过不了 (2fc70504830)
- ♻️ リファクタ:AI_SERVICE_URL 默认值收敛为单一真相源,并由 localhost 改 127.0.0.1 (8861116d425)

**2026-10-21**
- 🚀 機能/改善:补齐 IP 白名单与 agent 护栏配置的读写面(整条要登录、只存不拦) (bb494eba53c)

**2026-10-21**
- 🚀 機能/改善:侧边栏第四批对齐 web 终态对账(10 入口,web 端零改动) (08e1da5b63d)

**2026-10-21**
- 🐞 修正:安全日志页按 security_logs 实列渲染，删掉后端从不给的"状态"列 (761a7a22cab)
- 🚀 機能/改善:PDF 三链真处理落地 + security_logs 接上写入出口 (e1cc3e36ec0)
- 🔧 その他:钉住危险操作确认的唯一旁路出口(L7224) (251ee617671)
- 🔧 その他:翻勾 G-107 / G-929 (7ea5a84ed10)
- 🔧 その他:修 G-929 过期用例并补 G-107 接线四例 (1a12afbdbf2)
- 🔧 その他:裁决 5 张待拍板票 + 销账 3 张失效票 + 修 1 张回捞副本标记 (a525b912d17)
- 🐞 修正:扫码弹窗平台清单拉取失败必须响 —— 不再静默留白 (79451dab125)
- 🔧 その他:publish-scan 归入 @browser-hub 档 + 平台选择兼容 pill(机主选 A) (c364b64a0de)
- 🐞 修正:补齐 ROUTE_ROOT_BG 剩余 27 屏 chrome 档 —— 顶栏结构锁全量测试唯一红清零 (63cd174c852)
- 🐞 修正:补齐 ROUTE_ROOT_BG 剩余 27 屏 chrome 档 —— 顶栏结构锁全量测试唯一红清零 (b6568357c97)
- 🔧 その他:work-panel 切 tab 改按 store 现读 id 选「非激活那颗」—— 收 P4-6 (ddfa3590e0e)
- 🚀 機能/改善:暖色描边禁令装上旁路落地腿 —— 门 231 增 --rev 审树档,落地器 fail-closed 调用 (e1f18b5a320)
- 🐞 修正:登录历史改接真数据源 audit_logs，并清偿本会话写进的 zh-TW 简体用字 (05940a38cef)
- 🔧 その他:重钉 ui-routes 派生自述钉(承接 6ddca76ce8 的 11 处源改动) (b39af6dae53)
- 🐞 修正:原生组件着色属性位的 CSS var 全部改成 JS 派生值 —— 11 处此前静默回落宿主默认色 (6ddca76ce83)
- 🔧 その他:重钉 web/RN ui-routes 自述钉并补回 MyPapers/DistributionCompany 两枚白名单(1fc61a86437 旁路落地未跑写回钩子) (5bede5f6858)
- 🚀 機能/改善:把"没设≠没色"这条因果律推到 web 腿 —— 门 231 增 W5 与 CSS 输入类维,并钉掉 3 枚裸 Switch (be681a0bcee)
- 🔧 その他:fix(tokens)+feat(scripts): danger 暗档文字改取 #f87171(原 #ef4444 压在自己 /10 淡底上实测 4.21 不达 AA)+ 状态色文字射程对账尺子入库(自检 8/8、镜像 9/9,含同面口径修正) (721e61b929b)
- 🐞 修正:资产注册表强制单实例 —— 根治「本地 PNG 的 Image 在 release 上恒空白」这一类 (4a876685d26)
- ⚡ パフォーマンス:图片引用升 ?v=20261021 + 预热脚本 no-cache 强制回源 (720d3f582f7)
- 📚 ドキュメント:补 §21 欠账——登记移动 App 与 web 逐页对齐口径与本批 35 屏 (2834f08be35)
- 🐞 修正:登录历史卡按 security_logs 实列渲染，不再读后端从不返回的字段 (dcf3735fc2a)
- 🐞 修正:补录侧边栏新挂 7 入口的 ROUTE_ROOT_BG chrome 档(ApiKeys/Usage/Groups/Invoices/Points/VoiceStt/AgentCategories) (76452bb2069)
- 🚀 機能/改善:补齐我的试卷与分销中心，并收口 i18n 动态拼键反模式 (1fc61a86437)
- 🐞 修正:反代目标 localhost → 127.0.0.1(修正 d4bfb37b7e6:标题即此修复但内容未落地) (0d36f406d20)
- 🚀 機能/改善:侧边栏对齐 web 第二批 —— AI 组补 /models 与 /agents 父子入口,三域补 web 漏挂项,清 4 处重复登记,回归锁扩到域 hub(web 端零改动) (330056b5352)
- 🔧 その他:按 HEAD 干净面重生成 web/RN 两份 ui-routes 产物钉 —— 收门 105 的 G5 (acc4ab047d5)
- 🔧 その他:摘回门 233 注册条目 —— 点名面被他人 605 行在飞改动占住,先不给别人埋雷;门体降为常设只读尺子 (ec025c8fd6d)
- 🔧 その他:work-panel 收藏按钮按 aria-label 定位 + 切 tab 改为轮询等待 (d07b67bfdbb)
- 🔧 その他:清掉 check-ops-patrol 三枚存量红 —— 两枚是测量缺陷,一枚是半截落地的欠账 (04b56a1011f)
- 🐞 修正:反代目标 localhost → 127.0.0.1,根治 WS 通知 ECONNREFUSED(34,701 次 ::1) (d4bfb37b7e6)
- 🔧 その他:G-924 apps/cli 记忆模块两处直连后端改走 api-client(守门 73 真存量):新增 packages/api-client/src/endpoints/memory.ts 端点(listMemories/createMemory),endpoints barrel 增加导出;UnifiedMemoryClient.getEntries/addEntry 由裸 fetch 改调 api-client 端点,保留 SSRF 守卫与降级语义 (7f586945251)
- 🚀 機能/改善:门 233 门体入库 —— 状态色文字角色档的对比度射程对账(自检 8/8 含两支阳性对照与两支反证) (33bee2381e2)
- 🚀 機能/改善:新守门 check-state-text-contrast.mjs 接进提交链 (c7d7f57aaf8)
- ⚡ パフォーマンス:/status 只 SSR 前 30 条模型,其余按需展开(1.05MB → ~30KB) (b9ec5f4dfaf)

**2026-10-21**
- 🚀 機能/改善:补齐 6 屏对齐 web 内容编辑域(文章/问答/名片/AI世界/广场发布) (ce9c8c08a8e)
- 🔧 その他:登录请求显式声明通道 —— 解开本机 e2e 全量的 401 阻断 (67c57e311b6)
- 🚀 機能/改善:补齐 14 屏对齐 web 用户/发布/学习域 (1982228870b)
- 📚 ドキュメント:G-939 成因查明并改写 —— 门 100 头注自写口径只覆盖提交链,而 git-sync-converge 是 commit-tree+CAS 旁路不跑钩子 ⇒ 对旁路合并结构性失明;活改成"把 A1 判据 import 给旁路侧复量" (587f74e7c7d)
- 📚 ドキュメント:登记「已推送提交被并发合并吞掉且守门 100/168 当场没响」这一格(现读枚 12898ccd9b 双否,已 tag 保全并重落) (ffc81df2014)
- 📚 ドキュメント:G-921 翻勾 —— 三枚(Connectors / DomainHub / McpStore)共享层下沉全部落地并上线(枚 588a6342d8 / 7f9eb8eb00 / cc9b3672ef) (316bc4bf2e7)
- 📚 ドキュメント:登记门 39 全量档新增的 6 枚 V1 红(枚 8f16334f48 补齐 12 屏里的 ConnectedAccounts / ImageGenGallery / ImageGenTemplates / Points / Usage / WrongQuestions 六屏未做共享层下沉) (d7deeddd30b)
- 🔧 その他:重生成 RN ui-routes 自述钉并补回 SecurityCenter 白名单条目(45088b42447 旁路落地时未跑写回钩子) (752074e67f6)
- 🐞 修正:后台守卫不再把「角色还没查到」折成 0 —— 真管理员冷加载 6 次有 3 次被弹到 /forbidden(附双臂变异自证的时序测试) (c9a75878532)
- 🐞 修正:监控面板查询失败整轮不落结果 (f6f9715fe98)
- 📚 ドキュメント:守门 229 那条就地改写 —— 补 H4 档(摘前先问门 71 会不会把这条按未勾还原)、H3 基线改判 HEAD^、新增 state=all-held 与 exit 3 的机读结论(全仓不再有无需清扫式兜底文案) (ef8e6666cc9)
- 📚 ドキュメント:票60 就地改写进度注记 —— 第三、四批已落(含被并发合并吞掉那枚的重落凭据),未收口只剩 e2e 真机核验与描边态分窗格 (4e4fc9e5b25)
- 📚 ドキュメント:登记本轮收口留下的六件真活(归档件 lint-staged 雷区其余 84 枚 / 取号入口被 O 族重号顶死 / 门 105 G5 产物钉存量红 / D197 换行开关用例存量红 / 会话滚动位恢复无生产接线 / 多窗格缺 e2e 真机核验) (d96c474a17c)
- 🚀 機能/改善:票60 第三、四批 —— 续传/工具面板/发起分析全面窗格化,跳转总线按窗格门控(重落被并发合并吞掉的 12898ccd9b) (d3541dc2670)
- 🚀 機能/改善:G-921 第三枚(收官)—— McpStoreScreen 的 UI 下沉到共享层(新建 packages/app/src/features/mcp-store/McpStoreScreen.tsx + index.ts 导出组件、类型与共享判据 mcpInstallBlockedKey),RN 侧改 wrapper(只留四项 API 调用 get / install / setStoreServerEnabled / uninstall、安装与卸载二次确认弹层 appAlert、i18n 与主题注入),照 PaymentScreen / DomainHubScreen / ConnectorsScreen 同一型 wrapper 模式。 (cc9b3672ef2)
- 🐞 修正:输入框外框的常驻暖色环也纳入判据 —— 门 231 W1 增 W1-input 维 (177e5230c40)
- 🚀 機能/改善:补齐 12 屏对齐 web 设置/内容/交易域 (8f16334f483)
- 🐞 修正:监控面板查询失败保留旧数据 + 筛选下拉不再撑满整行 (70ea7877d40)
- 🐞 修正:底栏图标改走内联 data URI —— 本地 PNG 的 Image 取源链在 release 上恒空白 (10c2d9e7643)
- 📚 ドキュメント:G-921 登记第二枚(ConnectorsScreen)下沉共享层的进展与凭据(枚 588a6342d8;门 39 全量红 2→1;剩一枚 McpStoreScreen 归下一批) (c8ee7a2c4d6)
- 🐞 修正:持续性门槛的 firstAt 必须同时进 info —— 派发侧读的就是那一份 (b398a4035ca)
- 🚀 機能/改善:G-921 第二枚 —— ConnectorsScreen 的 UI 下沉到共享层(新建 packages/app/src/features/connectors/ConnectorsScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留 API 调用 get/setEnabled/sync/delete、删除二次确认弹层 appAlert、i18n 与主题注入),照 PaymentScreen/DomainHubScreen 同一型 wrapper 模式。 (588a6342d8b)
- 🐞 修正:补录 SecurityCenter 的 ROUTE_ROOT_BG chrome 档(屏内渲染 NavBar,顶栏 chrome 结构锁判据要求) (c849c50fa11)
- 🐞 修正:守门 78 补第六维——外部依赖声明↔链接对账,根治 lucide-react 断链致 8 端构建阻断 (c1e0350c61b)
- 🐞 修正:监控域之外 5 处状态色文字同接角色档 —— 全 web 残留读数 0(同族后缀档 4/4 未动) (1227a9742cb)

**2026-10-21**
- 📚 ドキュメント:G-921 登记第一枚(DomainHubScreen)下沉共享层的进展与凭据(枚 7f9eb8eb00;门 39 全量红 3→2;剩两枚 Connectors/McpStore 归下一批) (0e948350380)
- 🚀 機能/改善:G-921 第一枚 —— DomainHubScreen 的 UI 下沉到共享层(新建 packages/app/src/features/domain-hub/DomainHubScreen.tsx + index.ts 导出组件与类型),RN 侧改 wrapper(只留路由参数 domain、导航分派 target、i18n 与主题注入),照 PaymentScreen 同一型 wrapper 模式;条目图标以 ReactNode 由平台注入,共享层不绑定图标注册表。门 39 全量档红 3→2(DomainHubScreen 摘掉);共享层与 RN 两侧 typecheck 对本票文件零错误(存量 35 条红全在他人工作树删掉的 drawer-nav / SelectionAnnotationBar 面),eslint 0 finding,水印 verify 通过 (7f9eb8eb00b)
- 🔧 その他:重钉 web/miniapp ui-routes 自述钉(承接监控域角色档接入) (4a02eacc6f3)
- 🐞 修正:状态色新增「文字」角色档并接上监控域 48 处 —— 亮档真机实测 1.96~2.62 提到 AA 4.5 以上,暗档取值逐字不动 (c2b0c254a12)
- 🚀 機能/改善:安全中心对齐 web 设置页(评分/2FA/会话/安全事件) (45088b42447)
- 🐞 修正:/agents/featured 去掉从未实现的 featured=1 参数并取全量 —— 原来静默只显示 20/124 (37805cd2e1a)
- 📚 ドキュメント:现读订正「锁的初始化写全再原子可见」—— lib/lock-atomic-init 已在 HEAD 且两把锁均已接线;解阻判据①③成立,② 的 deploy-lock 套件本机并发下 flaky(三连跑 50/2、51/1、52/0),未归因不冒领,留一格 (c4f81394c79)
- ⚡ パフォーマンス:英文首页与公开内容页加边缘缓存头 (940303d21db)
- ⚡ パフォーマンス:public 图片按显示尺寸收敛，53MB → 49MB（首屏 logo 867KB→53KB） (52257166e09)
- 📚 ドキュメント:修 tab-bar-metrics 的陈旧注 —— 「颜色一律走 CSS 变量」与实测相反 (cd10e14a8dc)
<!-- END RECENT UPDATES -->

<p align="center">
  <sub>Built by <strong>吉林省愛智匯人工知能科技有限公司</strong> · オープンソース共創、あなたと共に</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star us on GitHub</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/fork">Fork to build your own</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues">Request a feature</a>
</p>
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
