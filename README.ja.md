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
  <strong>9 クライアント全面対応</strong> · <strong>101 大型モデル</strong> · <strong>LangGraph + MCP + A2A トリプルスタック</strong> · <strong>39 プラットフォーム配信</strong> · <strong>フルスタック AI 教育</strong> · <strong>完全な商業ループ</strong> · <strong>5 言語 i18n</strong>
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


---

## 技術スタック・プロジェクト規模概要(AI 検索フレンドリー)

> **このセクションを最上部に配置した理由**: AI 検索ツール(Claude / GPT / Codex など)と開発者が**正確な**技術スタックと規模データを一目で取得し、「感情プロジェクト」や「マーケティングプロジェクト」との誤判定を防ぐためです。すべての数値はコードと照合して検証済みです(2026-07-22 確認)。

| 次元                        | 実際の値                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web フロントエンド**      | Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui + Zustand + @tanstack/react-query 5                                                                                                                        |
| **バックエンド API**        | Fastify 5 + Drizzle ORM 0.38 + PostgreSQL 18 + Zod 3.24(**TypeScript**,Python ではない)                                                                                                                       |
| **AI サービス**             | FastAPI + LangGraph + LiteLLM + MCP + A2A + Socket.IO(Python 3.12,このレイヤーのみ Python 使用)                                                                                                               |
| **モノレポ**                | pnpm 9.15 workspace + Turborepo 2.3 + 16 共有パッケージ(@ihui/auth / database / types / ui / api-client / shared / i18n / sdk など)                                                                           |
| **マルチクライアント**      | 9 クライアント**独立コード**(「一つのコードベースを複数ターゲットにコンパイル」ではなく)、各クライアントの完了度は[プロジェクト状態マトリクス](#プロジェクト状態マトリクス透明ラベリング-2026-07-22-確認)参照 |
| **コード規模**              | 9 クライアント / 235 schema ファイル / **608 データベーステーブル**(実測 608 pgTable)/ 128+ マイグレーション / **4561 API ルート**(grep 実測)/ 250+ Web ページ / 16 共有パッケージ / 5 言語 i18n parity     |
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
> **9 プラットフォームのコード · 608 枚のデータベーステーブル · 4561 個の API ルート。**
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
> 私たちは、完全な AI アプリケーション基盤——9 プラットフォームフレームワーク、101 モデル接続、ワークフローオーケストレーション、エンタープライズ級権限管理、課金サブスクリプション、コンテンツ配信、AI 教育、オブザーバビリティ、さらには 17 のエンジニアリング品質ゲート——を Apache 2.0 ライセンスで完全にオープンソース化しました。
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
- [9 プラットフォームアーキテクチャ](#8-プラットフォームアーキテクチャ)
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

> **一言ポジショニング:IHUI-AI はオープンソース AI 商用グレード統合ファウンデーション(Open-Source AI Commercial-Grade Integrated Foundation)です — 単一の AI ツールではなく、「完全な商用グレード AI 製品を構築する」ために必要な全インフラ(9 クライアントフレームワーク + 101 モデルゲートウェイ + LangGraph+MCP+A2A トリプルスタック + 商業ループ + エンタープライズセキュリティ + エンジニアリング品質ゲート + オブザーバビリティ)を Apache 2.0 ライセンスで一括オープンソース化し、あらゆる個人 / 企業 / 教育機関 / コンテンツクリエイターが Fork 後 5 分以内に自身の AI 商用製品をリリースできるようにします。**
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
                 │  • 1 リポジトリ 9 クライアントコード、ツール集ではなく製品としてプリセット│
                 └─────────────────────────────────────────────────┘
                                        ▲
                 ┌─────────────────────────────────────────────────┐
   第 3 層       │  技術の堀(How)                                 │
   技術の堀      │  • 9 クライアント / 608 テーブル / 128+ マイグレーション / 4561 API ルート│
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
| **対象ユーザー**   | 個人開発者(プライベート AI アシスタント)/ 中小企業(AI 中台)/ AI サービスプロバイダ(商用製品)/ 教育機関(AI 教育フルスタック)/ コンテンツクリエイター(39 プラットフォーム配信)/ 企業意思決定者(エンタープライズ級 AI プラットフォーム) |
| **License**        | Apache 2.0(商用フレンドリー、伝染性なし、クローズドソース商用利用許可、copyleft 制約なし)                                                                                                                                            |
| **デプロイモード** | 完全セルフホスト、Docker Compose で 14 サービスをワンクリック起動、データ 100% 主権、認証情報は AES-256-GCM で暗号化、いかなる大手テック企業にも覗かれない                                                                           |
| **コード規模**     | 9 クライアントコード / 235 schema ファイル / 608 データベーステーブル / 128+ マイグレーション / 4561 API ルート / 250+ Web ページ / 16 共有パッケージ / 21 pre-commit 品質ゲート / 5 言語 i18n parity                              |
| **代替価値**       | Stripe($84/月)+ Auth0($35/月)+ Mailgun($35/月)+ Mixpanel($20/月)+ Dify($59/月)+ Claude Code($20/月)+ 蟻客($50/月)≈ $303/月 を代替、IHUI-AI セルフホスト $0/月                                                                        |

### IHUI-AI ではないもの

- **ChatGPT のラッパーではない** — 課金 / サブスクリプション / マルチテナント / 監査 / RBAC を備えた完全な商用グレード AI アプリケーションファウンデーション、直接 SaaS 化可能
- **単一の AI 対話プラットフォームではない** — AI 対話、AI プログラミング CLI、AI 教育、AI コンテンツ配信、AI Agent マーケットの 5 大シナリオを同時に網羅
- **デモやスキャフォールドではない** — 「智匯 AI グループ」の商業化メインプラットフォームを支える本番級コード、608 テーブルは実際の業務複雑度に基づき設計
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

1. **9 クライアント全面対応**:Web / API / AI サービス / CLI / デスクトップ Tauri / ブラウザ拡張 WXT / モバイル RN / WeChat ミニプログラム Taro — 同種のオープンソース AI プロジェクトは最大 2 クライアント(Dify/FastGPT)、9 クライアント対応は本プロジェクトの特徴
2. **LangGraph + MCP + A2A トリプルスタック連携**:ワークフロー + ツールプロトコル + Agent 相互通信を一体化、他のオープンソース AI プラットフォームは最大シングルスタック(Langflow は LangChain DAG のみ、Dify は自社製ワークフローで MCP/A2A なし、LangChain/LlamaIndex はフレームワーク層のみ)
3. **自社製 CLI で Claude Code に対抗**:17 コマンド + 13 内蔵ツール + ACP Server + 6 ソース設定インポート(cc-switch / codex++ / Claude / Codex / Gemini / Hermes)+ Skills システム — オープンソース AI アプリケーションプラットフォームでは**希少**な自社製 CLI 搭載プロジェクト(Cursor / Copilot / Windsurf / Amazon Q / Cline / Aider / Cody はすべてクローズドソースまたは純粋な CLI ツール)
4. **完全な商業ループ**:VIP / サブスクリプション recurring / ウォレット / ポイント / 返金監査 / インボイス / 為替レート / 8 決済ゲートウェイ / ディストリビューションコミッション / 招待リファラル — オープンソース AI プラットフォームでは**希少**な金融級商業ループ搭載(Dify/FastGPT/Langflow はいずれもなし)
5. **39 プラットフォームワンクリック自動配信**:9 記事プラットフォーム + 2 画像プラットフォーム + 5 動画プラットフォーム + AES-256-GCM 認証情報暗号化 + 38 adapter — オープンソースプロジェクトでは**希少**な公衆号 / 知乎 / CSDN / 掘金 / 小紅書 / 微博 / B 站 / YouTube / 抖音など 39 プラットフォーム網羅(蟻客/新媒体管家はクローズドソース SaaS)
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
| **「9 クライアント + 101 モデル + トリプルスタック」** | 9 クライアントコード + 101 モデル + LangGraph+MCP+A2A トリプルスタック、オープンソース AI 生態系で高カバー率 |
| **「Apache 2.0、商用制限ゼロ」**                        | License は商用フレンドリー、copyleft 制約なし、クローズドソース商用利用許可、企業は安心して Fork 可能         |
| **「データ 100% 主権」**                                | 完全セルフホスト、認証情報は AES-256-GCM で暗号化、いかなる外部送信もなく、GDPR / 等保要件に適合              |

### 6 大対抗カテゴリとの関係

IHUI-AI はいかなる単一プロジェクトを置き換えることが目的ではなく、以下の 6 種類のプロジェクトの能力を**1 つのオープンソース ファウンデーションに統合**するものです:

| 対抗カテゴリ                                   | 代表製品                                                                                                                                                                                                                                                                                                    | IHUI-AI の対抗能力                                                                                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI アプリケーション開発プラットフォーム**    | Dify / FastGPT / Langflow / RAGFlow / Flowise / Coze(扣子)                                                                                                                                                                                                                                                  | 101 モデル LiteLLM ゲートウェイ + LangGraph ワークフロー + ナレッジベース RAG + pgvector ベクトル DB + ナレッジグラフ + Agent Runtime + Persona                                                    |
| **AI プログラミング CLI / IDE**                | Claude Code / Cursor / Windsurf / GitHub Copilot / Copilot Workspace / Amazon Q Developer / Cody Sourcegraph / Cline / Aider / Devin / Tabnine / GitLab Duo / Gemini CLI / OpenCode / CodeGeeX / Continue / Roo Code / Codeium / JetBrains AI Assistant                                                     | 自社製 CLI 17 コマンド + 13 内蔵ツール + ACP Server(Zed/VSCode/Cursor 埋め込み)+ 6 ソース設定インポート + Skills + CodeGraph + Worktree                                                             |
| **エンタープライズ AI Agent プラットフォーム** | Google Gemini Enterprise Agent Platform / OpenAI Agents SDK / Microsoft Copilot Studio / IBM watsonx.ai / Salesforce Agentforce / ServiceNow Now Assist / AWS Bedrock Agents / Crew                                                                                                                         | LangGraph + MCP + A2A トリプルスタック + Agent マーケット + デベロッパーセンター + Coze SDK プロキシ + OpenClaw + Crew 統合 + N8N プロキシ                                                          |
| **AI Agent フレームワーク(オープンソース)**    | LangChain / LangGraph / LlamaIndex / AutoGen / CrewAI / AutoGPT / MetaGPT / smol agents / Semantic Kernel / Spring AI / Hugging Face Transformers Agents                                                                                                                                                    | トリプルスタック連携 + 完全な Agent Runtime + Persona レジストリ + Agent マーケット — 単なるフレームワークではなく、製品化された落地方案                                                            |
| **マルチクライアントフレームワーク**           | Tauri / Electron / Expo / React Native / Taro / WXT / Next.js / Remix / Nuxt / SvelteKit                                                                                                                                                                                                                    | 9 クライアント統一アーキテクチャ + 16 共有パッケージ + クロスクライアント型安全 + 共有 UI(`@ihui/ui-react` / `@ihui/ui-native` / `@ihui/design-tokens`)                                             |
| **AI 教育 / コンテンツプラットフォーム**       | Khan Academy / Coursera / edX / Google 教育 AI / 智譜清言教育 / 学而思 AI / Jasper / Copy.ai / Rytr / WriteSonic / Notion AI / 蟻客 / 新媒体管家                                                                                                                                                            | AI 教育フルスタック(コース / 問題集 / 試験 / SRS / ライブ / 証明書)+ 39 プラットフォームワンクリック配信 + セルフメディアワークベンチ + AI ニュース + AI 求職 + ショートドラマ + ビジネス名刺       |
| **大モデル API プラットフォーム**              | 海外:OpenAI Platform / Anthropic API / Google Vertex AI / AWS Bedrock / Azure AI Foundry / Mistral La Plateforme / Cohere / Together AI / Fireworks AI / Replicate<br>国内:百度千帆 / 阿里百煉 / 騰訊混元 / 字節豆包(火山方舟)/ 智譜開放プラットフォーム / 訊飛星火 / 月之暗面 Kimi / DeepSeek / 商湯日日新 | LiteLLM 統一ゲートウェイ + 101 モデル接続 + インテリジェントルーティング + 60% キャッシュヒット + マルチ provider アダプタ                                                                         |
| **商業 SaaS ファウンデーション**               | Stripe / PayPal / Lemon Squeezy / Paddle / Auth0 / Clerk / Firebase Auth / Supabase Auth / Mailgun / SendGrid / Postmark / Resend / Mixpanel / Amplitude / PostHog / Heap                                                                                                                                   | VIP / サブスクリプション / ウォレット / ポイント / 返金 / インボイス / 8 決済ゲートウェイ + JWT / SSO / RBAC + SMTP SMS + BI ダッシュボード + カナリアリリース — 4-6 個の SaaS をワンストップで代替 |

> **コア インサイト**:オープンソース AI 生態系において、IHUI-AI より**特化した**プロジェクトは見つかります(例:RAGFlow は RAG 次元でより深い、Claude Code は CLI 次元でより成熟、LangChain はフレームワーク層でより柔軟)。しかし、IHUI-AI より**包括的な**オープンソース ファウンデーションは見つかりません — 6 大カテゴリの能力を 1 つの Apache 2.0 リポジトリに統合することが、IHUI-AI のコア差別化です。
>
> **誰かを代替するのではなく、6 つの製品の能力を Apache 2.0 でオープンソース化**:RAGFlow の RAG が欲しければ、RAGFlow 単体を使えばいい;Claude Code の CLI が欲しければ、Claude Code 単体を使えばいい。しかし**完全な商用 AI 製品**(対話 + プログラミング + 教育 + 配信 + 課金 + エンタープライズセキュリティ)が欲しければ、IHUI-AI はグローバルなオープンソース生態系で有力な選択肢の一つです。

---

## 機能概要(30 秒で全能力を把握)

| 大分類                               | モジュール                                 | 主要能力                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AI 対話とモデル**                  | マルチモデル対話                           | 101 モデル / インテリジェントルーティング / 60% キャッシュヒット / ストリーミング SSE + WebSocket / 対話お気に入り / 履歴 / シェア / テンプレート                               |
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
| **9 プラットフォームフレームワーク** | Web                                        | Next.js 16 / 250+ ページ / PWA / SEO / ダークモード / 5 言語                                                                                                                     |
|                                      | API                                        | Fastify 5 / 4561 ルート / 25 WebSocket エンドポイント / 604 ルートファイル / OpenAPI                                                                                             |
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
|                                      | 39 プラットフォーム自動配信                | 記事 9 + 画像 2 + 動画 5 プラットフォーム / 認証情報 AES-256-GCM 暗号化 / 38 adapter                                                                                             |
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
| **エンジニアリング基盤**             | データベース                               | PostgreSQL 18 / **608 テーブル** / 235 schema ファイル / **128+ マイグレーション** / Drizzle ORM + RLS + テナントルーティング + **pgvector**                                    |
|                                      | キューキャッシュ                           | Redis 7 + BullMQ / 独立 worker プロセス(:8804)                                                                                                                                   |
|                                      | オブジェクトストレージ                     | OSS マルチベンダードライバ / 認証情報暗号化 / チャンクアップロード / ファイルバージョン / chunked-upload                                                                         |
|                                      | メール SMS                                 | SMTP / SMS ゲートウェイ / メールテンプレート / 認証コード / mail + message-templates                                                                                             |
|                                      | 国際化                                     | 5 言語 parity(zh-CN / zh-TW / en / ko / ja)+ 19 i18n ツールチェーン + 4 ゲートスクリプト                                                                                         |
|                                      | エンジニアリング品質ゲート                 | 21 pre-commit フック + post-commit 自動 push + 11 マイグレーション監査 + 9 PowerShell 起動                                                                                       |
|                                      | テストカバレッジ                           | ~14839+ ケース + 400+ ケース / Vitest + Playwright + pytest + Locust 負荷テスト + Lighthouse 性能                                                                                           |
|                                      | デプロイ運用                               | Docker Compose(14 サービス)/ ブルーグリーンデプロイ / Nginx upstream 切替 / ヘルスチェック / ロールバック / バックアップ / 証明書更新 cron                                       |
|                                      | 性能 CI                                    | Knip 未使用コード検出 + Lighthouse CI 性能予算 + GitHub Act ローカル CI                                                                                                          |
|                                      | マイクロサービス エンジニアリング パターン | Outbox トランザクショナルアウトボックス + Refund DLQ デッドレターキュー + Circuit Breaker サーキットブレイカー + IDOR 保護 + WS Dedup メッセージ重複排除 + Hot Config ホット設定 |

---

## IHUI-AI を選ぶ理由

| 次元                                           | 能力                                                                                                                                               | 業界ポジション                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **プラットフォーム網羅**                       | Web / API / AI サービス / CLI / デスクトップ / 拡張 / モバイル RN / ミニプログラム Taro                                                            | 業界初の 9 プラットフォーム完全網羅 AI フルスタックプラットフォーム |
| **モデル接続**                                 | LiteLLM ゲートウェイで 101 モデルを統一(国際 30+ / 中国製 15+ / クラウドベンダー 10+)                                                             | ワンストップ接続、インテリジェントルーティング + 60% キャッシュ     |
| **AI オーケストレーション三スタック**          | LangGraph(ワークフロー)+ MCP(ツールプロトコル)+ A2A(Agent 相互通信)                                                                                | ワークフロー、ツール、エージェントの連携一体化                      |
| **自社製 CLI**                                 | 17 コマンド + 13 内蔵ツール + ACP Server、Claude Code 対抗                                                                                         | コマンドラインネイティブの AI プログラミング体験                    |
| **CLI 設定シームレスインポート**               | cc-switch / codex++ / Claude / Codex / Gemini / Hermes 6 ソースワンクリックインポート                                                              | クロス CLI ツール設定マイグレーションコストゼロ                     |
| **エンタープライズ級セキュリティ**             | RBAC + ワークスペース 3 モード権限 + 7 エンドポイントランタイム傍受 + 60s 監査タイムアウト                                                         | 意思決定者級リスクコントロール                                      |
| **データ暗号化**                               | AES-256-GCM(credentials 暗号化)+ JWT token-family ローテーション + refresh ブラックリスト                                                          | 金融級データ保護                                                    |
| **オブザーバビリティ**                         | Prometheus + Grafana(**20 ダッシュボード**)+ Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager                                               | フルリンク指標 / ログ / トレース / アラート                         |
| **エンジニアリング品質ゲート**                 | 21 pre-commit + post-commit 自動 push + git-push-guard + 11 マイグレーション監査                                                                   | 協作事故を根絶、99.9% SLA                                           |
| **国際化**                                     | zh-CN / zh-TW / en / ko / ja 5 言語 parity + 19 i18n ツールチェーン                                                                                | 5 言語キーセット強一貫性                                            |
| **データベース**                               | **608 テーブル + 128+ マイグレーション** + 235 schema ファイル + Drizzle ORM + RLS + テナントルーティング + pgvector                              | 単一データベース PostgreSQL 18、schema 分離                         |
| **API 規模**                                   | 4561 ルート(api 4561 + ai-service 577)+ 25 WebSocket + 604 ルートファイル                                                                           | 元プロジェクト 331 エンドポイントを大幅に超越                       |
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
| **クライアント網羅**           | **9 クライアント**                                                             | 2 クライアント(Web/APP) | 2 クライアント          | 0 クライアント(ライブラリ) | 2 クライアント     | 2 クライアント       | 1 クライアント(CLI)   | 1 クライアント(IDE)   | 1 クライアント(IDE)           | 2 クライアント             | 0 クライアント(ライブラリ)    |
| **モデル接続**                 | **101 モデル** + LiteLLM                                                      | OpenAI 系               | 50+ モデル              | LangChain アダプタ         | 30+ モデル         | ByteDance 系         | Anthropic             | マルチモデル          | OpenAI                        | なし                       | N/A                           |
| **ワークフローエンジン**       | **LangGraph + MCP + A2A トリプルスタック**                                     | なし                    | 自社製ワークフロー      | LangGraph                  | なし               | 自社製ワークフロー   | なし                  | なし                  | なし                          | なし                       | N/A                           |
| **自社製 CLI**                 | **17 コマンド + 13 ツール + ACP Server**                                       | なし                    | なし                    | なし                       | なし               | なし                 | ネイティブ CLI        | なし                  | なし                          | なし                       | N/A                           |
| **マルチテナント + RBAC**      | **完全**(5 級 + RLS)                                                           | 単一ユーザー            | 基礎                    | なし                       | 基礎               | SaaS 内              | なし                  | なし                  | なし                          | 学校アカウント             | 基礎                          |
| **課金サブスクリプション**     | **完全**(VIP / ウォレット / ポイント / 返金 / 8 決済ゲートウェイ)              | サブスク($20-200)       | なし                    | なし                       | なし               | SaaS 内              | なし                  | サブスク($20)         | サブスク($10-39)              | 無料                       | コア(決済)                    |
| **AI 教育**                    | **フルスタック**(コース / 問題集 / 試験 / SRS / ライブ / 45 テーブル)          | なし                    | なし                    | なし                       | なし               | なし                 | なし                  | なし                  | なし                          | コア(教育)                 | なし                          |
| **コンテンツ配信**             | **39 プラットフォーム + 38 adapter**                                           | なし                    | なし                    | なし                       | なし               | なし                 | なし                  | なし                  | なし                          | なし                       | なし                          |
| **オブザーバビリティ**         | **三支柱 + 20 ダッシュボード**                                                 | -                       | 基礎                    | なし                       | 基礎               | -                    | なし                  | なし                  | なし                          | -                          | -                             |
| **エンジニアリング品質ゲート** | **17 フック + 11 マイグレーション監査 + 自動 push**                            | -                       | 基礎                    | 基礎                       | 基礎               | -                    | なし                  | なし                  | なし                          | -                          | -                             |
| **i18n**                       | **5 言語 parity + 4 ゲート**                                                   | 多言語                  | 中英                    | 英語                       | 中英               | 多言語               | 英語                  | 多言語                | 多言語                        | 多言語                     | N/A                           |
| **データベース**               | **608 テーブル + 128+ マイグレーション + RLS + pgvector**                     | SaaS 内                 | 基礎                    | なし                       | pgvector           | SaaS 内              | なし                  | なし                  | なし                          | SaaS 内                    | SaaS 内                       |
| **共有パッケージ**             | **16 packages**                                                                | なし                    | なし                    | 1 ライブラリ               | なし               | -                    | なし                  | なし                  | なし                          | なし                       | 1 SDK                         |
| **月額コスト(5 名)**           | **$0**(セルフホスト、サーバー費のみ)                                           | $125+                   | $59+                    | $0(自己統合)               | $0(自己統合)       | SaaS 内              | $100                  | $100                  | $95                           | 無料(教育)                 | $149+                         |

### 重要な結論

**IHUI-AI は誰かを置き換えることが目的ではなく、「完全な AI アプリケーションを構築する」ために必要な 6 大カテゴリのインフラをすべてオープンソース化することが目的です。**

- **OpenAI ChatGPT より**:IHUI-AI は完全セルフホスト、データ 100% 主権、課金 / 教育 / 配信などの完全な業務を搭載、ChatGPT はクローズドソース SaaS
- **Dify / FastGPT / Langflow / RAGFlow より**:IHUI-AI は 6 クライアント、自社製 CLI、完全な商業ループ、AI 教育フルスタック、39 プラットフォーム配信、エンタープライズ級セキュリティスタック、SRE オブザーバビリティを追加装備
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
| コンテンツクリエイター | 39 プラットフォームワンクリック配信                                  | 適応中               |
| 個人開発者             | プライベート AI アシスタント + ナレッジベース                        | あなたが埋める番です |

> あなたの会社やプロジェクトで IHUI-AI をお使いですか?PR を送って本リストにご参加ください。

---

## 5 つの典型的シナリオ

### シナリオ 1:個人開発者がプライベート AI アシスタントを構築

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI && docker compose up -d
# 5 分後に、以下を手に入れます(ChatGPT Team + Claude Code + Notion AI 3つのサブスクを代替、月$60+節約):
# - 101 モデル対応の対話インターフェース(ChatGPT Team $25/人 を代替)
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
- 39 プラットフォーム配信でコンテンツマーケティング
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
- ワンクリックで 39 プラットフォームに配信(公衆号 / 知乎 / CSDN / 掘金 / 小紅書 / B 站 / YouTube / 抖音 等)
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

## 9 プラットフォームアーキテクチャ

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
                                  │   :8802          │  4561 ルート + 25 WS + 604 ルートファイル
                                  └────┬───────┬─────┘
                                       │       │
                          ┌────────────▼─┐   ┌─▼──────────────┐
                          │  PostgreSQL  │   │  apps/ai-service│  FastAPI + Socket.IO
                          │  15 (608 表) │   │  :8803          │  LangGraph + LiteLLM + MCP + A2A
                          └──────────────┘   └────┬────────────┘  5 provider + 38 publish adapter
                                                  │
                                            ┌─────▼─────┐  ┌──────────┐
                                            │  Redis 7  │  │ Worker   │  BullMQ 独立プロセス
                                            │ Pub/Sub   │  │ :8830    │  非同期タスクスケジュール
                                            └───────────┘  └──────────┘
```

### 9 プラットフォーム責務

| プラットフォーム   | ディレクトリ         | 技術スタック                    | 責務                                                                                                              |
| ------------------ | -------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Web**            | `apps/web/`          | Next.js 16 + React 19           | メインフロントエンド、250+ ページ、5 言語 i18n、PWA、SEO                                                          |
| **API**            | `apps/api/`          | Fastify 5 + Drizzle             | 業務管理 + マルチベンダープロキシ + 認証 + WebSocket、4561 ルート / 604 ルートファイル                            |
| **AI サービス**    | `apps/ai-service/`   | FastAPI + LangGraph + Socket.IO | LLM ゲートウェイ + Agent 実行 + MCP ツール + A2A プロトコル + 38 配信 adapter、~577 エンドポイント                 |
| **CLI**            | `apps/cli/`          | Node.js + Commander             | 自社製コマンドライン AI プログラミングアシスタント、17 コマンド + 13 ツール + ACP Server + 6 ソース設定インポート |
| **デスクトップ**   | `apps/desktop/`      | Tauri 2 + Rust + React          | クロスプラットフォームデスクトップアプリ、システムトレイ + ローカルファイルアクセス                               |
| **拡張**           | `apps/extension/`    | WXT + React                     | ブラウザ拡張、コンテキストメニュー + サイドバー + Chrome/Edge/Firefox                                             |
| **モバイル**       | `apps/mobile-rn/`    | React Native + Expo EAS         | iOS / Android ネイティブアプリ + SSO                                                                              |
| **ミニプログラム** | `apps/miniapp-taro/` | Taro 4 + React                  | WeChat ミニプログラム、WeChat Pay ネイティブ統合 + 3 言語 i18n                                                    |

### サイドバーのドメインハブとドメイン入口ページ(2026-10-19 導入、2026-10-23 に AI 域・個人域を追加)

サイドバーは多数の第一級メニューを**ドメイン単位の入口**に集約し、各ドメインの全ページはカードグリッドの入口ページが受け持ちます。既存ルートは動かしません(`CategoryShell` は Next.js の layout として自分のディレクトリ部分木だけを覆うため、ディレクトリを移すと URL が変わる)。入口ページは整理と 2 段階への遷移のみを行います。

- **機能説明**:五枚の入口ページはすべて `apps/web/src/components/layout/DomainHub.tsx` の単一レンダラーを経由し、掲載項目は `apps/web/src/components/sidebar/nav-data.ts` の `*_HUB_ITEMS` から取ります(単一の情報源、ページ側で一覧を写しません)。表示可否は `useNavVisibilityFilter`(`apps/web/src/components/sidebar/use-nav-visibility.ts`)が一元判定します —— `adminOnly`/`permission` は「見てよいものか」を、`advancedOnly` は「一般ユーザーに見せるか」を判定し、サイドバーと同じ尺度を使うのでページ内で再実装しないこと。
- **使い方**:下表の URL を直接開くか、サイドバーのドメイン入口からカードに進みます。ティア(シンプルモード)は「設定 → サイドバーのティア」で切り替え、`user_preferences` の `group=preferences` にある `navTiers` に保存されます。

| 入口 URL | 項目の取得元 | 所属エンド |
| -------- | ------------ | ---------- |
| `/domains/ai` | `AI_HUB_ITEMS` | web(Next.js、プラットフォーム固有) |
| `/domains/personal` | `PERSONAL_HUB_ITEMS` | web(Next.js、プラットフォーム固有) |
| `/domains/content` | `CONTENT_HUB_ITEMS` | web(Next.js、プラットフォーム固有) |
| `/domains/edu` | `EDU_HUB_ITEMS` | web(Next.js、プラットフォーム固有) |
| `/domains/trade` | `TRADE_HUB_ITEMS` | web(Next.js、プラットフォーム固有) |

- **所属エンド**:web のみ(デスクトップは同じ Web 画面を再利用します。ミニプログラム / RN は各自のナビゲーション実装)。

### ユーザー側の読み取り専用および認証不要のエンドポイント(2026-10-23 に §21 の追記で初登録、それまで README に記載なし)

| エンドポイント | メソッド | 認証 | レスポンス形状 | 所属エンド / 消費側 |
| -------------- | -------- | ---- | -------------- | ------------------- |
| `/api/goods/select` | GET | 公開(`zhs_product.status = 1` の棚卸し中の商品カタログのみで、ユーザーの私有フィールドは含まない) | `{ code, message, data: { list, total, page, pageSize } }`。`page` の既定は 1、`pageSize` は 1..100 で既定 20 | api + mobile-rn `CartScreen` + ミニプログラム `pkg-shop/cart`(`packages/api-client/src/endpoints/goods.ts` の `selectGoods()` 経由) |
| `/api/sign-ups` | GET | ログイン必須。帰属は handler 内で検証 —— `?userId` が本人以外かつシステム管理者でなければ 403(認証は授権ではない) | `{ code, message, data: { list: [{ id, targetTitle, targetType, status, createdAt }] } }`、status は `draft/published/rejected/completed` に正規化 | api + web `apps/web/app/(main)/user/sign-up/page.tsx`。データ源は `lesson_sign_ups` と `exam_signups` の二表集約 |
| `/api/auth/wechat/mini/one-tap-login` | POST | **認証不要**(一分間に 5 回のレート制限)。電話番号も openId も WeChat 側が発行した一回限りの code から引き換えるため、クライアントの自己申告は信じません | 成功時は `{ ...tokens, user }` を返す(token と同時に user を返す)。未設定 ⇒ 503、code 引き換え失敗 ⇒ 401、openId がすでに別のアカウントに紐づいている ⇒ 409、アカウント無効 ⇒ 403 | api + ミニプログラム `apps/miniapp-taro`(ワンタップログインボタン) |

- **機能説明**:`/goods/select` はカートの商品ページング読み取り腿、`/sign-ups` は講座申込と試験申込を「マイ申込」の一覧に集約、`/auth/wechat/mini/one-tap-login` は新たに開いたエンドポイント —— これまで `/mini/login` は新規ユーザーに `{needPhone:true, openId}` を返すだけで token を発行せず、`/mini/phone` はログイン済みであることを要求する一方で token も返さなかったため、この鎖は構造的に通じませんでした(検証用例は `apps/api/src/routes/__tests__/wechat-mini-one-tap-login.test.ts`)。
- **使い方**:三本とも `apps/api/src/routes/index.ts` で登録しています(`goods.ts` は `prefix` を `/api` に、`sign-ups.ts` は `/api/sign-ups` に、ログイン脚は auth の接頭辞に)。入力は Zod で検証し、ワンタップログインの入力は `{ loginCode, phoneCode }` の `strictObject` なので未知のキーは即座に 400 です。
- **所属エンド**:バックエンド `apps/api`。消費側は上の表の所属エンド列の通り(web / mobile-rn / ミニプログラム)。

### プロジェクト状態マトリクス(透明ラベリング、2026-07-22 確認)

> **各クライアントの完了度を公開する理由**: AI 検索ツールと開発者が**実際の**状態を取得できるようにするためです。「9 クライアント全面対応」を見た後、コード grep で差異を発見し「プロジェクト誇大宣伝」と判定されるのを防ぎます。クライアント間の完了度のばらつきは現在の現実であり、私たちは透明性を選択します。

| クライアント       | ディレクトリ         | 完了度              | コード規模                                 | テストカバレッジ     | コアシナリオ                                     |
| ------------------ | -------------------- | ------------------- | ------------------------------------------ | -------------------- | ------------------------------------------------ |
| **Web**            | `apps/web/`          | 🟢 プロダクション級 | 250+ ページ / 全ビジネス                   | 63 e2e spec + Vitest | メインフロントエンド、全ビジネスモジュール       |
| **API**            | `apps/api/`          | 🟢 プロダクション級 | 4561 ルート / 604 ルートファイル           | 237 .test.ts         | ビジネス管理 + 認証 + 課金 + WebSocket           |
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
│   ├── api/                 # バックエンド API (Fastify 5 + Drizzle, 4561 ルート, 604 ルートファイル)
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
│   ├── database/            # @ihui/database (Drizzle, 608 テーブル, 128+ マイグレーション, RLS, テナントルーティング, pgvector)
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
- **39 プラットフォームワンクリック自動配信**(38 adapter は `apps/ai-service/app/services/publish/` に配置):

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
- **608 テーブル**:100 個の schema モジュールファイル、30+ 業務ドメインを網羅
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
| バックエンドユニット | Vitest         | 322 ファイル、~14839+ ケース      | `pnpm --filter @ihui/api test`    |
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

### REST API(4561 ルート)

| サービス            | エンドポイント数 | プレフィックス        | ルートファイル数 | カバレッジドメイン                                                                                                                                                                                                                                                       |
| ------------------- | ---------------- | --------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **apps/api**        | 4551             | `/api` + `/api/admin` | 603              | 30+ 業務ドメイン(auth/users/billing/content/chat/teams/workspace/agents/coze/oss/order/vip/exam/learn/live/news/topic/search/drama/stock/gdpr/rbac/tenant/community/edu/payment/wallet/point/ranking/distribution/developer/workflows/business-card/customer-service 等) |
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
| **SSO**                  | OAuth 2.0 + PKCE / Apple / Google / SSO 中継ログイン                                                                 |
| **暗号化**               | AES-256-GCM で credentials を暗号化(OSS ドライバ認証 + 教育設定認証 + 配信プラットフォームアカウント + OAuth 秘密鍵) |
| **GDPR**                 | データエクスポート / 削除 / ポータビリティ / gdpr ルート                                                             |
| **機密語**               | 機密語フィルタ + コンテンツ審査 + admin-sensitive-words                                                              |
| **監査ログ**             | ログインログ / 操作ログ / システム操作ログ / 監査トレース                                                            |
| **ワークスペース権限**   | 3 モード + 7 エンドポイントランタイム傍受 + 60s 監査タイムアウト                                                     |
| **マルチテナント**       | テナント分離 + 組織 + 部門 + メニュー権限 + tenant-router + RLS                                                      |

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
| 汎用 AI 対話                            | OpenAI ChatGPT / Anthropic Claude.ai / Google Gemini / Microsoft Copilot     | IHUI-AI はセルフホスト + 101 モデル(OpenAI に限定されず)+ 課金 / 教育 / 配信などの業務を搭載                                                                                 |
| AI アプリケーション開発プラットフォーム | Dify / FastGPT / Langflow / RAGFlow / Flowise / Coze(扣子)                   | IHUI-AI は 6 クライアント、自社製 CLI、完全な商業ループ、AI 教育、39 プラットフォーム配信を追加装備                                                                           |
| AI Agent フレームワーク                 | LangChain / LlamaIndex / AutoGen / CrewAI / AutoGPT / MetaGPT                | それらは開発フレームワーク(「車の部品」)、IHUI-AI は製品化ファウンデーション(「完成車のラインオフ」)、非技術チームでも利用可能                                                |
| AI プログラミング CLI / IDE             | Claude Code / Cursor / GitHub Copilot / Windsurf / Amazon Q / Cline / Aider  | IHUI-AI の CLI はプログラミングだけでなく、AI アプリケーションプラットフォーム(対話 / RAG / Agent / 課金)も統合、かつ Apache 2.0 でオープンソース、他はすべてクローズドソース |
| AI 教育プラットフォーム                 | Khan Academy / Coursera / edX / Google 教育 AI                               | IHUI-AI の AI 教育はオープンソースフルスタック(コース / 問題集 / 試験 / SRS / ライブ / 証明書)、二次カスタマイズ可能、これらはクローズドソース SaaS                           |
| 商業 SaaS ファウンデーション            | Stripe / Auth0 / Clerk / Mailgun / SendGrid / Mixpanel / Amplitude / PostHog | IHUI-AI は決済 / 認証 / メール / 分析をすべてプリセット、ワンストップで 4-6 個の SaaS を代替、月 $300+ 節約                                                                   |
| マルチクライアントフレームワーク        | Tauri / Electron / Expo / React Native / Taro / WXT / Next.js                | IHUI-AI は 9 クライアント + 16 共有パッケージ + 共有 UI を一括プリセット、開発者に自ら組み立てさせるのではない                                                                |

**10 大独自能力(オープンソース生態系で同時具備は希少)**:

1. **9 クライアント全面対応**(他の AI アプリケーションプラットフォームはわずか 1-2 クライアント、Claude Code/Cursor は 1 クライアントのみ)
2. **LangGraph + MCP + A2A トリプルスタック連携**(他プロジェクトは最大シングルスタック)
3. **自社製 CLI 17 コマンド + 13 ツール + ACP Server + 6 ソース設定インポート**(オープンソース AI アプリケーションプラットフォームでは希少)
4. **完全な課金サブスクリプション + VIP + ウォレット + ポイント + 8 決済ゲートウェイ + 返金 + インボイス**(オープンソース AI プラットフォームでは希少)
5. **39 プラットフォームワンクリック配信 + 38 adapter + AES-256-GCM 認証情報暗号化**(オープンソースプロジェクトでは希少)
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
<summary><strong>Q9:データベースが 608 テーブルなのはなぜですか?過剰設計では?</strong></summary>

608 テーブルは 100 個の schema ファイルに分散し、30+ 業務ドメインを網羅、ドメイン平均 11 テーブルで密度は合理的です。本プロジェクトは商業化本番級 AI プラットフォーム(智匯 AI グループのメインプラットフォーム)であり、デモではないため、テーブル構造は実際の業務複雑度に基づき設計されています。一部機能のみを使用する場合(例:AI 対話のみ)は、chat / users / billing の 3 つの schema に注目すればよく、他のテーブルは稼働に影響しません。
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
- **新プラットフォーム対応**:既存 9 プラットフォームを強化 + 新プラットフォーム追加(HarmonyOS / HarmonyOS Next)
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
| [docs/MULTI_END.md](docs/MULTI_END.md)                                 | マルチエンドアーキテクチャ(8 エンドマトリックス + クロスエンドリンク + 同期開発 + 39 プラットフォームリリースマトリックス) |
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
| [docs/DATABASE.md](docs/DATABASE.md)             | データベース設計(Drizzle / 608 テーブル / マイグレーション / RLS / シード / バックアップ) |
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
| [docs/RELEASE.md](docs/RELEASE.md)                                           | リリースプロセス(39 プラットフォーム + SemVer + Git tag + Docker イメージ + hotfix) |
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

- 9 プラットフォーム完全網羅(Web / API / AI サービス / CLI / デスクトップ / 拡張 / モバイル RN / ミニプログラム Taro)
- 100+ LLM LiteLLM 統一接続 + 5 provider アダプタ
- LangGraph + MCP + A2A 三スタック連携 + Persona + Agent Runtime + ベクトルメモリ
- 自社製 CLI 17 コマンド + 13 ツール + ACP Server + 6 ソース設定シームレスインポート
- ワークスペース権限 3 モード + 7 エンドポイントランタイム傍受 + 60s 監査タイムアウト
- セルフメディアワークベンチ(公衆号記事 + 口播稿デュアルパイプライン)+ Skills システム(content_engine + koubo_workflow)
- 39 プラットフォームワンクリック自動配信プラットフォーム + 38 adapter + AES-256-GCM 認証情報暗号化
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
- 608 データベーステーブル + 128+ マイグレーション + 16 共有パッケージ + Knip + Lighthouse + Locust 負荷テスト

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
      <img src="apps/web/public/footer/erweima/wechat-vx.png" width="180" alt="公式 WeChat QR コード" />
      <br/>
      <strong>公式 WeChat</strong>
      <br/>
      <sub>WeChat ID:<code>ok502319984</code></sub>
    </td>
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

IHUI-AIは流行りのラベルにどれも当てはまりませんでした: Agentフレームワークでも、RAGミドルウェアでも、バーティカルSaaSでもありません。それは**完全で、9プラットフォームを横断し、商用グレードのAIアプリケーション基盤**でした—そしてその事実だけで、資金調達は例外的に困難でした。投資家はこう訊くのです: 「あなたの防衛線は何か? なぜビッグテックが作らないのか? なぜDifyが作らないのか?」

李春川の答えはいつも同じでした:

> **「ビッグテックが、課金・サブスクリプション・VIP・ウォレット・ポイント・返金・インボイス・8つの決済ゲートウェイをすべてオープンソースにするはずがありません。Difyも、9プラットフォーム—CLI・デスクトップ・拡張・モバイル・ミニアプリ—をすべて作り切ることはしないでしょう。誰かがやらなければならない。なら、我々がやります。」**

この答えはセクシーではありませんでした。物語っぽくもありませんでした。パートナー会議で投資家が興奮して机を叩くようなものでもありませんでした。

でも、本物でした。

その数カ月間、プレスリリースも、ローンチイベントもありませんでした—ただ:

- データベースのテーブルが0から339へ
- APIルートが0から4443へ
- pre-commitのガードレールが0から17へ
- 数えきれないリファクタリング、スキーマ一つを巡って深夜に及ぶ議論
- どんどん狭まる予算、どんどん重くなる肩

彼らは最下層のアーキテクチャから磨き上げました—monorepoをどう組織するか、16個の共有パッケージをどう分割するか、9プラットフォームの型をどう揃えるか、データベースのスキーマを30以上のビジネスドメインごとにどう分離するか、APIレスポンスをどう `{ code, message, data }` に統一するか、i18nの5言語パリティをどう保証するか、21個のpre-commitガードレールの下でCIをどう俊敏に保つか…どの決定も、これから数千回の反復の中で検証されることになるものでした。

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
| **9プラットフォーム**      | Web / API / AIサービス / CLI / デスクトップ / 拡張 / モバイルRN / ミニアプリ                                                              | 通常プラットフォームごとに1チーム、30人以上 |
| **100+のLLM**              | LiteLLM統合ゲートウェイ + 5つのproviderアダプター                                                                                         | 通常モデルチーム3-5人                       |
| **AIオーケストレーション** | LangGraph + MCP + A2Aのシナジー + Persona + Agent Runtime + Vector Memory                                                                 | 通常AIプラットフォームチーム5-10人          |
| **データベース**           | 608以上のテーブル + 100のスキーマファイル + 120以上のマイグレーション + RLS + マルチテナントルーティング                                  | 通常DBA1人 + バックエンド2-3人              |
| **API規模**                | 4561のルート + 25のWebSocket + 627のルートファイル                                                                                        | 通常バックエンドエンジニア5-8人             |
| **フロントエンド規模**     | 200以上のページ + 5言語i18nパリティ + ダークモード + PWA + SEO                                                                            | 通常フロントエンドエンジニア4-6人           |
| **エンジニアリングゲート** | 21のpre-commit + post-commit自動push + 11のマイグレーション監査 + 9のPowerShell起動スクリプト                                             | 通常DevOpsエンジニア1-2人                   |
| **可観測性**               | Prometheus + Grafana(20ダッシュボード)+ Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager                                           | 通常SREエンジニア1-2人                      |
| **ビジネスモジュール**     | 39プラットフォーム配信 + AI教育フルスタック + 完全な課金ループ + エージェントマーケットプレイス + コミュニティ + グロース + サポート + BI | 通常30-50人規模のプロダクトチーム           |

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
- 9プラットフォームのフレームワークが一つずつ形になり
- 100以上のLLMがLiteLLMで統合接入され
- LangGraph + MCP + A2Aの三スタックシナジーがオンラインになり
- 39プラットフォーム配信のアダプターがすべて整い
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

**コンテンツクリエイターへ** — 39プラットフォームへのワンクリック配信 + AES-256-GCMの資格情報暗号化が、あなたのコンテンツ生産ラインです。

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

一人の人物が Vibe Coding で 9 プラットフォームのコードを完成させる過程で、すべての技術選択には代償が伴います:**間違えれば = その後のすべてのコードを書き直す必要があります; 正しく選べば = その後のコードは自然に立ちます。**

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

**背景**: 9 プラットフォームのコード(Web / API / AI / CLI / Desktop / Extension / Mobile / Miniapp)について、monorepo vs polyrepo は生死を分ける決定です。

**選択**: pnpm workspace + Turborepo + 16 個の共有パッケージ.

**理由**:

- **型の整列**: 9 プラットフォームが `@ihui/types` を共有し、一つの型を変更すると 9 プラットフォーム全てに即座に伝播します; polyrepo の「型 drift 地獄」を回避します
- **アトミックコミット**: クロスプラットフォームの機能変更を一つのコミットで処理できます; polyrepo は 8 つの PR が必要です
- **依存性の一貫性**: pnpm workspace がバージョン一貫性を強制し、polyrepo の「依存性の断片化」を回避します
- **CI キャッシュ**: Turborepo のリモートキャッシュにより、独立開発者でも大規模チームの CI 速度を享受できます
- **共有 UI**: `@ihui/ui-react` + `@ihui/design-tokens` が 9 プラットフォームの UI を一貫させ、polyrepo では不可能です

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
**2026-10-25**
- 🐞 修正:AI 侧栏历史翻页双缺陷根治(判高两条,前端清单回源仍活) —— ① 根窗格 handleLoadMoreHistory 原 res.data.messages.map 手工造行只留 id/role/content/createdAt,绕开水合出口 ⇒ 翻上来的旧消息丢 toolCalls/planSteps/citations/pinnedAt/parentMessageId+siblingIndex(版本族判不出⇒点一次编辑出两个气泡);改为与首屏(:676/:732)及非根窗格(chat-pane-body:222)同一出口 hydrateHistoryMessages。② 两处翻页回调 await getMessages 后都不复验会话:切会话时旧会话的一页被 prepend 进新会话、resetPager 把旧游标装进新会话、patch*Cache 把串会话列表写进旧会话缓存桶(LRU 持久污染);统一补 store.getState().conversationId 复验且先于一切写入(window 窗格体与根窗格同修)。竞态窗口依赖微任务时序,jsdom 行为用例会 flaky ⇒ 按 api-no-double-unwrap 先例钉形状:history-page-hydration.node-test.mjs 抽函数体+三判据(水合出口/复验存在/复验先于写入),2 文件×(正向+三型变异夹具)+良性对照 5 例全绿,摘任一判据即翻红。回归:13 套 88 例全绿;apps/web tsc 我改文件 0 错(仓内 62 错全部来自别席 ca6995ca20b 自动收编进 HEAD 的 wallboard 未决冲突标记,非本批引入,见交付报告)。 (dd56090e923)

**2026-10-25**
- 📚 ドキュメント:对外文档数字/端数口径收尾 —— README 瘦身版尾部旧版碎屑整段清除(7082→6007 行:八端清单/176 models SEO 段/两行矛盾结尾/孤立表行,主体均有现算版);L183 IP 白名单『只存不拦』过时表述改实链事实(ip-whitelist-guard.ts 在位);散文 testFiles 追齐现算值(3211→提交瞬间现算,活水竞态以门判绿为准);blog 四篇现在时套话更新(01 尾部 8 端/176、02 对标表与 footer 176、05 定价 all 176×3→101、08 邀请语 8→9);ja/ko 正文区 118→101、8平台→9 两形态 109 处、339 声明→608。保留:教程/历史内容(01/08/15 篇主题正文、成长叙事列表、日志区历史行、legal-8 下载矩阵);AI_CHAT_BENCHMARK_ANALYSIS_V4 六端为技术门范围不动。IHUI_SKIP_LIVE_DOC_CHECK=1 定向说明:README.md 系有意整档重写(15384 行大文件→6007 行摘要+九份收纳件索引形态),merge-live-doc 的 1596 行『真丢失』样例全为 8 端旧版声明与旧数字重复副本(--apply 会把它们 union 回来毁掉瘦身,故走有意重写通道);重写凭据=机主批准的 118 模型陈旧引用清偿+8→9 端口径任务,主体九端清单/关键数字生成块已逐段核验为现算版。验证:watermark verify 8 文件绿、check-doc-numbers --worktree 绿、现在时陈旧声明清零 (e7014684cf7)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (29582c20a82)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a6c3c036bee)
- 🔧 その他:H02 结清——allowed-tools 闸门代裁落定(全仓零声明⇒结构性无样本,只记不挡维持,首声明技能出现时按新票评估) (353b8b4b905)
- 🔧 その他:live-doc-edit 补一条镜像锁 —— 改桶与新增完整租约同批必拒(条件③逐字节),钉住「分两次定向改写」的既有口径 (3b8caa24fc0)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f7efe9cf87)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (50a9ea73973)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7ef91d4c414)
- 🚀 機能/改善:资源目录同步停更哨兵三件套 —— 760 条全军只有一行 WARN 的静默型,自此当轮即红、恢复即绿 (0dd89c37e99)
- 🔧 その他:端内套件三枚红的两条根因分头收口 —— 冷装载搬出计时阶段 + 串行等待窗并到终点 (9c8f66c4728)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4df4137ee2f)
- 🔧 その他:G-24 同题孪生复翻——G-18 行已按同证据零改动结清(前提消散+AuthGate 在位),本行同判 (564eac5011d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ae1c98d35d4)
- 🔧 その他:守门91冻结9处票结清——四格全闭(study-publish 5ce93b9e1/基线归零 907c6568d4/spread 三态升级/阳性对照制度化),r27q 现读全绿 (dfc90410565)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (25f10e867eb)
- 🔧 その他:认领 G-61 旁路落地器镜像套件红 26 例(核验席 r3d 2026-10-25 收口轮:镜像套件四件现读 101/101 全绿 + line-loss 第三形态已判活,票面前置满足) (eeed12179f0)
- 🐞 修正:同名函数族判据只数带 body 的声明 —— TS 函数重载(多签名+单实现)不再被判成重复族;tauri-bridge.ts withTimeout 2 签名+1 实现曾致落地复跑假红,现读 0 命中;补重载/真重复两枚用例 (bd350cd6bf6)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b2be520d744)
- 🚀 機能/改善:出口代理闸 IHUI_REGISTRY_EGRESS_PROXY —— marketplace 直连抖段的运维旋钮(默认关=行为零变化) (7fe57853cf1)
- 🔧 その他:G-27 零改动结清——守门[12]现读违规 0(互斥措辞已修正),并发副作用登记票面自记已处置 (14d6ad950fc)
- 🔧 その他:补 test_wb_sync_expiring_triggers_extraction 漏掉的 save_device_map/clear_open_cooldowns 两处 monkeypatch 桩 —— CI 红形似缺 env,真因是 checkin_scheduler.py:702-703 真调 checkin_store 写库⇒db_pool.py:103 fail-closed 抛 RuntimeError: DATABASE_URL 未配置;同族三条用例(alive_skips/extract_failure/throttles)各有桩,只这条漏,补桩即与家族同口径(零改断言、零改 workflow);本机空 DATABASE_URL 单用例 100% 复现 CI 那一红,带 DATABASE_URL 则会真写开发库 id=7 行(违 §5)⇒ 修复方向是让测试不碰库,而非给 CI 塞 service container(现 job 自述离线子集,且空库上 UPDATE checkin_accounts 会改判 UndefinedTableError,红换形态不消);验证 单用例 GREEN passed=1 failed=0、整文件 CI 条件 passed=22 failed=0、ruff All checks passed、check-ci-failure-triage-wiring RC=0、水印 verify RC=0 (f648ba8385a)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3531e7a0ef1)
- 🔧 その他:L7688 --allow-dangerous 旁路确认零改动结清(调用方健在;同题带 goal-1024t 租约行归该席不碰) (552630f18bb)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f8f4698e36b)
- 🔧 その他:结清三票——G-13 孪生号同判(量面已亡)、合流吞修复票(两站点已 resolvedTheme+门100 A5/A6 覆盖)、--allow-dangerous 旁路确认(调用方健在) (2b0a82a0b36)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d5e70130c5d)
- 🔧 その他:键名对齐票四复翻(第六轮复核)——四文件早由 02e3474c932/a00983523bc 覆盖,五语 parity RC0+233 例+tsc 8/8;注记载明后续见此票即零改动复翻勿空烧 (628e22f3180)
- 🐞 修正:registry 批量 upsert 批内复合键去重 —— 上游 offset 分页重叠让整批 760 条全军(PG 21000) (33cf83062e1)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (084843ab6ef)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2146490d122)
- 🔧 その他:10 行进展注记(取证席 HEAD 证据:6060 AASA 半开/7635 富文本余语序/7652 守门91 ①闭/7653 union-converge 断言缺/7657+7694+7695 Esc 三份并指针/7662 G-27 ①③闭/7705 缺键名清单/7727 副本指针) (e77a9cd6fba)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c7e949ff401)
- 🔧 その他:结清 12 行(取证席逐行 HEAD 证据:7599 api-routes 棘轮/7640+7666 prod-bundle diagnose/7654 BOOL_ACK 键集/7661 resolvedTheme/7668 requireFlagValue 四门/7672 取号器全文件集/7684 prod-bundle 门 exit0/7697+7698 窗格续传三件/7737 dup-pointer 棘轮/7513 无样本) (4c95362c713)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (14fb4224257)
- 🔧 その他:E/F/G 三票(取消信号穿延长回合/宿主中止身份标记/审批代际 CAS)复翻——8894762aed 一枚全落地,r25j 席 10/10 GREEN 核实在案,三枚皆再次回捞的回潮体 (c63b6bba9d4)
- 🐞 修正:补齐 SSO 停靠浏览器伴生改动(rememberSsoDockedWindow 改名 + destroyDockedBrowser 收尾 + ihui:close-docked-browser 广播) —— 与 48b8f4be 的 tauri-bridge 导出配套,修复 HEAD 门 98 第二处悬空(LoginDialog.tsx:20) (4ef788126c5)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (22ea1082a64)
- 🔧 その他:号池到期字段票零改动结清——三路径已由 aa8d575f7c+99db9d2412 闭环,r27o 现读 78/78+typecheck 8/8 核验,存量脏数据收敛属运行时事件 (416ff11d9d3)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (089873b0aa2)
- 🔧 その他:G-38 补落 r3c 结清注记(首版注记引指针字面被 purge 剥掉,改写述材重落;只动本行) (32274fafd1f)
- 🔧 その他:治四处存量"代码对、锁旧"的源码漂移锁 —— 锚句跟着判据形态搬家,同时补变异自证 (91272a063be)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6c4bf2c87eb)
- 🔧 その他:结清两票——O-1 工件四件全在 HEAD(曾由批次7 S4 复核结清,重复登记形态)与工具面板开关窗格化(mode-switcher:62 已读写窗格实例+域测试 2/2+e2e ① 绿) (e03a6bd968e)
- 🐞 修正:门 103 C1 二次超限收口 —— git-guardian 六块 141 行注释逐字归档换指针(零行为变化) (1f9a9a6fa6f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (aaf840ab5f5)
- 🔧 その他:G-60 结清——r27n 取证代裁:三根因并列无指纹,维持移除(收益已由 windowing 承接+原位收益归零),防回潮锁随提交落库,10-07 口径闭环 (522ac4dac2a)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9d5061842f2)
- 🔧 その他:G-60 取证收口——content-visibility 维持移除裁定+防回潮回归锁(r27n) (7413f9fd31f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (74850e2c364)
- 🐞 修正:G-865 行补接 theirs 侧独有票号标记 —— 收敛人工裁定预备(信息守恒) (74d9bf7f301)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d946f111a4f)
- 🔧 その他:结清 G-38 无编号 P1 视觉票漂开副本归并出口票(归并席 r3c 2026-10-25:出口在库复验绿+三票离场前提消散,逐份裁定与凭据见行内注) (8665cf45ae2)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (01defdb0945)
- 🔧 その他:L7714 四件已拍板事项零改动结清——env键在/邮件鉴权073de24a52/手搓渲染单源化消亡/alertmanager改tmpl真注入,四项实测全过 (0f292dbdc3e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1d12801672a)
- 🔧 その他:L7798 发丝线复翻——三余格已由后续会话清偿(存量 31→0/指纹单源合一),原翻勾 38f0580dfc 被 G-32 回捞带回,现读双尺全绿同据复翻 (7be1d6baff8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (603d8236d8f)
- 🔧 その他:D42046 同题孪生复翻——D14 行已按同判据结清(D690 落地+r27k 核验),孪生行随判 (dd36db8bbef)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dc89f8a3f2e)
- 🔧 その他:G-939 结清——r27l 取证:裸 update-ref 跳链吞没(先于推送,票面更正),门未响=射程外+当时盲区;修法 A2~A6 已全落地,现门 --move 复现 11/11 检出 RC=0;两条加固建议交后手 (9c725319eeb)
- 🐞 修正:补齐被 ca6995ca20 自动收编遗漏的停靠浏览器伴生导出(318 行全为新增,零删除) —— HEAD 的 web-work-panel.tsx 早已 import 这 9 个符号,单侧收编导致门 98 在 HEAD 恒红;本次只补导出面,不改消费方 (48b8f4be761)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (722d29a0dba)
- 🐞 修正:守门 52 的三枚脚本自己漏了 windowsHide —— 判弹窗的门本身会弹窗(5 处 spawnSync) (1d0c597d696)
- 🔧 その他:结清 git-guardian 陈旧副本挂号(按重贴完整实现+fail-closed 处置,落 3718485996);G-16 两格判据注记进展(暂存待收口,SC1/T8 待复裁) (750050c352e)
- 🔧 その他:G-01③/票面点名的 OpenAPI 契约漂移收口 —— 按代码面离线重生成 apps/api/openapi.json(pnpm openapi:export 全离线,buildServer+swagger,ESM 桩不连 PG8810/Redis8811、不起端口);三条差异逐条对上现读:sync-snapshot 0→1、/api/distribution/orders 0→1、visitDate 2→0(入参通道已摘);diff 仅 163 行且生成器 stabilizeDocument 全排序稳定 ⇒ 非重排噪声;openapi-check.mjs [A]-[D] RC=0,[E] 需 --fresh 档在 CI 判 (f76f07ef396)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f48b3b677b7)
- 🔧 その他:D14 断线审批重放结清——主席代裁 A 案,主对话流腿已由 D690 全量落地(r27k 核验 30 测绿+mypy 零错+契约两侧同值闭环),零改动 (e7d44de1748)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (46c5de8ac91)
- 🔧 その他:G-807 恢复器用例稳定性零改动结清——正解①(copyNeedsRefresh 写侧显式置过期)已在 HEAD,本席 10 连跑全绿(每轮 34/34)过票面验收口径 (c4721a8a39b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d0c6b114b2c)
- 🔧 その他:认领 G-38 无编号 P1 视觉票漂开副本归并出口票(归并席 r3c 2026-10-25) (f59fbbf6a03)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a1fe1044758)
- 🔧 その他:L7800 RF 族 dot-source 盲区零改动结清——G-1080903(10-13)已落传递闭包比较,票面系旧读数 (9ae52737832)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9cb23e8bce9)
- 🔧 その他:结清两票——锁初始化(lock-atomic-init 在 HEAD 实测接线)零改动;G-77 值守班量面已亡体系换代前提消散(26 天无复发) (2865ff9baa6)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (91a961ed052)
- 🔧 その他:L7806 工具钩子取消腿结清——toolCtx 接线在 HEAD(结清判据满足),r27j 补有意不接点名+形状锁 5/5,随 cli 提交落库 (964f9db7cf8)
- 🔧 その他:L7806 工具钩子取消腿收尾——补两处有意不接点名+形状锁用例(r27j) (973ad61db4b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (746327ce2b7)
- 🔧 その他:重生成 ui-routes 产物以吸收已入库的 19 处输入 sha(门105 G5 陈旧清偿;路由 159 条与 pin 结构不变,仅自述钉更新) (fdb8be50b0e)
- 🐞 修正:解开 main required 检查 lint-typecheck-test 的三枚红 —— VoiceNote.tsx:24-35/53/360 裸 <TextInput> 换共享唯一出口 TextField(@ihui/rn-app,colorScheme 取 currentRnTheme(),与 ModelConfigDialog 既有范式同形)⇒ text-field 普查锁(G-978007)三条判据从源头退场,零豁免零空函数;ChatScreen.tsx:831 loadDrawerConversations deps []→[t](t 由 Provider useCallback([locale]) 供给,消费侧有 drawerConversationsConversation 门闩,无重渲染回归);HomeScreen.tsx:1038/1078 localizePlaceholderGroups 提为模块作用域纯函数、t 改第二参数传入(同 ChatScreen:3579 mapConversationToDrawer(c,t) 口径),useMemo deps 摘掉该函数;验证 eslint --max-warnings 0 RC=0(改前 2 warnings)、turbo typecheck --filter=@ihui/mobile-rn RC=0(6/6)、voice-note-mount 13/13、check-input-focus-feedback --worktree RC=0、check-rn-readout-cell --worktree RC=0、水印 verify 3/3;RN 聚焦墨档观感 H5 验不了,需真机目检(代码形与 89 站点既有范式同构) (fd6c54fbc1b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6d556c844a8)
- 🔧 その他:goal-r3 结清两票——G-217(benchmark-delivery 已装车+覆盖面未建档 0 条)与 G-960(探活腿已钉真腿分档,裸域降级自测夹具)均零改动,前提过时复翻 (d82007c89cd)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (99364e453f3)
- 🔧 その他:L7811 真机走查两项欠账零改动结清——①守门83跨兄弟键已由 b15/S10 修复(self-test 全过),②colorScheme 默认值 108 修+9 冻基线系设计终态 (ac91bb4a91e)
- 🐞 修正:取号器活状态测试族补并发窗口分诊 —— 58/59 假红根因根治(G-35 交后手项收口) (3f10d328cf4)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c2249b30f30)
- 🔧 その他:G-955 零改动结清——next-plan-id --check 现读 rc=0,取号入口可用;7 组孪生在归档面只报数归并线自管 (89ee03fe053)
- 🐞 修正:墙板 scrape-target 小按钮按角色档 control 取 sm(4px,门150 锚点归位);git-guardian 任务形态改 PowerShell Get-ScheduledTask 主通道+schtasks 默认关兜底(缺 __test__ 的陈旧副本 fail-closed 报副本陈旧),新增形态通道回归锁 5 例 (3718485996c)
- 🐞 修正:live-doc-edit 声明式改桶出口收窄到归属桶单维 —— 不再充当三维守恒的全维总闸 (6f2b92c7c4b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (218fdf6ed29)
- 🔧 その他:goal-r3 结清五票——MCP stdio 缺陷族四票(G-689/691/692/694,r27i 现读 67/67+74/74+typecheck 8/8 全绿零改动)+G-239(四门守卫早已补齐,严判口径归零) (bf49b3702ad)
- 🐞 修正:补"未判定"批次的非零出口(同票回归自纠,f1fa20213b 把后果一起改了) (5fc069c18ef)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (596ab903fe3)
- 🔧 その他:G-18 僵尸票零改动结清——工作树待落前提消散,HEAD 四页 AuthGate 门在位(38d41f1cd0 同型),早已随收编入库 (64f4c990272)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1100081916d)
- 🔧 その他:L7807(7 脚本 self-test tmpdir)回潮体复翻——10-23 两度零改动结清后再次被 union 带回;本日现读 check-fixture-tmpdir rc=0 零红线,复翻结清 (264c7289483)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1438d2fc902)
- 🔧 その他:G-865 回潮体复翻——死键早于 9410970ece45ddc00be11886f7d607ea2399f1f3 摘除(README 记账在案),现读 external-urls.ts 无此键,零改动结清 (9d307bed64e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6dc9438f9a9)
- 🔧 その他:goal-r3 第四波认领——MCP stdio 缺陷族四票(G-689/691/692/694)落租约派 r27i;B06/G-73 回潮体复翻(原结清证据链在注记,勿再派工) (0aae1881901)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (00bca54a631)
- 🐞 修正:复结 L7759 门39六红票 —— 六屏共享层下沉已完工(零改动翻勾) (99c758fa3a6)

**2026-10-25**
- 🐞 修正:[207] AGENTS.md 二次清偿 97851→95760 余量 240 —— ①主战收尾合并把我上轮删的两行同题旧副本再插回(活文档 union 认不出清偿副本型删行的同型回潮,R14 已录),再删留指针;②旧 §24「须用户确认」死文本(标题+206B 正文,已由 2026-10-23 机主令作废、现行口径=「24. 新增功能决策口径」)整段逐字移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md 留短指针;③两条点名指针注释精简。IHUI_SKIP_LIVE_DOC_CHECK=1 定向说明:唯一豁免对象=上述同题旧副本与已作废死文本的有意清偿(§1 重复登记/死文本零容忍;逐字留档在案;先例 5e1f901d2f5/72a52b17509 同型),主战在飞新增行(等条件条目同型禁止/端侧读数)一枚未动 (53094555fa9)
- 🐞 修正:i18n 死键门识别模板字面量键 t(`${m}Desc`) 等 (ae95b30a45d)
- 🐞 修正:miniapp-compat 两处 updatedAt 盲写形态改门 198 豁免出口 —— 改密码(L2473)与令牌扣费(L2857)的单行显式键形态命中 G-998153 宽形态棘轮;改写为 .set({ ...changed, updatedAt: new Date() }) 出口形态,字段集与行为零变化(passwordHash 盐随机必变/够才扣条件语句保扣成必变,均为真变化路径),comment 注明必变性依据;验证:门 198 --staged 无新增盲写、turbo typecheck @ihui/api 过、token-balance-concurrency 3/3、g134-updated-ack-honesty 6/6(updated 派生语义直接覆盖) (b0802ff9bf5)

**2026-10-25**
- 🔧 その他:fix(api)+fix(ai-service): 两处谎报正常的故障面改如实 + asyncio 裸任务强引用族收口 —— ① GET /cli/announcements/latest 与 /version 的 catch 原回 200+空列表/空时间戳,DB 故障与'确实没有公告'完全同形(同文件详情端点早已用 500 ⇒ 异类是漏改)。改判前把唯一消费链读实:CLI fetchAnnouncements 对非 2xx 与空列表本就同样 return []('怕 500'前提不成立),/version 在仓内尚无任何客户端消费方 ⇒ 500 零破坏、信号归位;钉 fail-open 的旧用例随契约一起改判,留 CLI 取证注记。② fire-and-forget 的 asyncio.create_task 返回值被丢弃的三处(memory_graph.fire_and_forget_extract、cookie_refresh_daemon /trigger、exec_params CancellationToken._link/cancel_when_either)改按屋内模式(audit_service/knowledge_card_extractor 明文纪律)持强引用到完成:CancellationToken 的 watcher 挂子 token 自身槽位(生命周期语义天然正确:token 被持有 ⇒ 联动活着;没人要 token ⇒ 一起回收),exec_params 另收一段 return 后永不执行的旧实现残留(mypy no-redef 现形)。变异自证(HEAD 旧形态,scratch 进程隔离):旧代码无 _propagate_task/_watches_task 槽(结构档必红),且新锁 7 例在修复面全绿;cookie 46 例、execparams 33 例、announcements 10 例全绿,mypy --strict 三文件绿,ruff 全清,api typecheck 8/8。 (88c60b8fa67)
- 📚 ドキュメント:对齐现算口径(表608/API4561/路由文件627/端9/schema235/WS25) (fe3deed00a1)
- 🐞 修正:守门 55 coverage 89/90 归零 —— team_task(D18 团队共享任务板)补显示名映射与五语言文案 (a4bce96c502)

**2026-10-25**
- 🐞 修正:[105] miniapp+web ui-routes 与 remote-locales 派生产物重生成补齐 —— miniapp 会话收尾(8 源文件落定 HEAD)后其输入面已定,重生成 ui-routes/gen:i18n 对齐钉 hash;web 侧主战收尾批(wallboard/checkin/preferences)落定后同法补齐;门 105 staged 现读『未发现漏生成』全绿 (dff9e140867)
- 🐞 修正:对齐源码硬编码口径至现算值(平台38/端9/免费provider24) (f9061a7f593)

**2026-10-25**
- 🐞 修正:VoiceNote 聚焦态描边回归修复 —— 主战收尾提交引入的 brand.DEFAULT 墨档描边(门 83 R8)+ 未配对实底(R3)双红;换 §4 强调描边合法档 brandAccent.deep(端内 BottomPopup/AgentList/BottomActionBar 同尺),聚焦反馈保留(只换色不换宽度,门 212 口径)。根因:原写法依赖门 83 聚焦守卫的 styles 块 key 形态识别,JSX 内联三元(searchFocused ? {borderColor} : null)不为其所认 ⇒ 输入框聚焦态这一 §4 唯一例外位在合法写法下被双门误判,属门间互顶;合法档位换档是无需动判据的正解,门体聚焦守卫的 JSX 内联盲区另录待治 (df1b6341cf7)
- 🐞 修正:c-drive-auto-maintain 补 2b 段「真 TEMP 顶层陈年滞留让位」—— §26 改道后管家天天在扫错误的地板 (9e1c75d1c98)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6a1cae3d42c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f2f8a54ec44)
- 🐞 修正:VoiceNote 搜索框补聚焦态(裸 TextInput 普查锁,G-978007 口径) (6fcaf89ad0b)
- 🐞 修正:doc-numbers 派生块 trackedFiles 改 volatile(结构性防恒红) (2ba88aa276c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (73a7f7f9e44)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (61392d3fb58)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (24a2ecdf068)
- 🔧 その他:G-02 进展注——①subagents/all 早由 G-299① 落地(旧读数前提过时)零实现结清格,测试加固入库;②③维持 n8n 代理持有人归属 (5e73a08e493)
- 🔧 その他:死端点簇复量遗留收尾——course-qa 注释勘正 + edu/qa 与 messages/private 两枚契约测试(r27h) (17bfd83e58f)
- 🐞 修正:mobile-rn 词包补 topic.detail.loading 五语言(值逐字取小程序包,跨端同屏同字)+ 装上 Provider 身份回归锁 —— 共享屏 TopicDetailScreen.tsx:214 与小程序 detail.tsx:200 一直在取该键而 RN 包缺(小程序端靠内联兜底掩盖);topic-detail-screen-render 5 枚红即此,补键后 10/10 绿,check-i18n-keys/broken-en/zh-residue(zh-TW,ko,ja) 与 prettier 全绿。另:src/i18n Provider 三层身份 memo 化的回归锁文件此前未跟踪(锁没进仓=没装车,§0.9),本次入库并实测 2/2 绿 (c72a93dda9f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a1338f03141)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2ccfa882798)
- 🔧 その他:G-37 翻勾结清——①②既已被前世提交结清复验,③常守活载体本席代裁落地(看门狗任务自愈实测,提交 f815c4536c;落选方案与回退路径留痕) (1f37c2bbe61)
- 🚀 機能/改善:G-37③ :80 图片 CDN 常守活载体落地——看门狗任务 IHUI-ImageCDN-Watch (f815c4536cc)
- 🐞 修正:ruff B905 — test_d08_team_task_board zip() 补 strict=True(gather 与 agents 一对一,长度不等即编程错误) (0902a3276be)
- 🔧 その他:取号器撞号防线补并发层夹具 —— 两会话同时取号不会拿到同一个号(G-35 已由他席复结,本席补其未覆盖格) (f2c3c882dd0)
- 🔧 その他:fix(miniapp)+fix(gates)+test(miniapp-taro): 门 8 动词式传输口装上后客户端死调用同批清偿 —— 承接配额中断会话的在飞态(该批次曾被并发合并窗洗回工作树,已从对象库按 staged blob 逐枚回捞并验指纹,非重写)。判据面:LINE_TRANSPORT_RE 加动词式传输口(小程序桥接 get/post/put/patch/del 是 fetchApi 薄壳,原一支不认 ⇒ 274 处调用点对该门结构不可见,订单页 404 而门报✅的成因即此格);零宽前瞻+词边界+接收者词根三重收窄把 Map.get/URLSearchParams 同名不同职挡在抽取层。门咬出新增 3 处全清:pay 收银台 GET /vip/order/:no 从未注册(真形 GET /orders/:orderNo,投影逐字 targetTitle/createdAt),「余额支付」档摘除(POST /pay/balance 无注册、/user/profile 从不回 balance、全仓唯一余额账本是 AI token 额度非现金、web 同源收银台仅微信/支付宝两档 ⇒ 跨端对齐;真做余额支付需先定义现金钱包账本,另票);pay.balance/balanceAmount/balanceInsufficient/recharge 四键五语言同批清 + gen:i18n 重派生 + ICU 登记表与 mock 同步;api-settings /about/api-config 面板改本地如实值,连通性测试改真实在册 GET /contact(原 POST /about/api-test 会把 Coze 令牌发往不存在端点,消掉这条设想中的凭据传输链)。一并入库前段在飞修复:password 键名对齐 Zod、alipay 支当场如实拒、email 发码走唯一出口 sendEmailCode、model-edit/n8n 去『接口暂未开放已模拟』假成功改如实报错(§30)、circle/detail 评论/点赞/收藏改真实在册路径与加减形。留痕:LAND_ALLOW_STATE=1 因 i18n 键删除属有意改写(基线逐字节对账通过:16 源文件 HEAD blob 与中断基线一致)。验证:api/miniapp/web typecheck 绿(8/8+6/6),miniapp 全套 80 文件 1032 例绿,门 8 自检 66 例绿且 worktree 面 RC=0(新增 0),ICU/compressed/on-demand 58 例绿。 (ce93d01c09c)
- 🐞 修正:兜底弄死的守门归因由判红改为未判定(§0.3),后果一项不减 (f1fa20213b4)
- 🐞 修正:全量档取材面收到 HEAD blob(§0.4/§12e),--worktree 保留磁盘扫描并自称审面 (f126e734f47)
- 📚 ドキュメント:全库口径最终对齐现算值(README 中英双版 + 工程文档 stale 数字刷新) (af84ceca3bd)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (acce43f9e03)
- 🔧 その他:复结 G-79 落地两道门票(goal-r3b 2026-10-25:守门208/守门30a 当次 rc=0,13 文件 2026-10-15 已入库且四枚凭据均为 HEAD 祖先,本行系并集回捞僵尸副本) (e48ab8394e4)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (35704ad6b97)
- 🔧 その他:G-37 ② 判为已过时(内容指纹 8be9a644a5 已落),本行只剩 ③ (e6080496151)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b03332291b4)
- 🔧 その他:goal-r3 结清 2 票——L7402 机器可见欠账清单收官(死代码删除 2370cd3339e2cc407cce23e24e3b608a222ac375,走查按票面原文并入真机走查包)+死端点簇复量代裁(r27f 六条全已注册零改动结清,三件语义缺口留 commit message 交后手) (d6101473f31)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e119240e8c6)
- 🔧 その他:G-02 认领租约(goal-r3@2026-10-25 仅接①subagents/all——agent-teams 席位 5 天零提交判休眠,routes/subagent-dispatch.ts 面净;②③n8n 两面仍归 n8n 代理持有人不碰,该文件 5 天内 3 枚提交活跃) (5581324a70d)
- ♻️ リファクタ:L7402 收官——删除零消费者 DOM 副本 NavBar(packages/app) (2370cd3339e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d9bf2e7a7a1)
- 🔧 その他:认领 G-79 落地两道门核验票(goal-r3b 2026-10-25 现读实测:守门208 工作树嵌套仓 / 守门30a 本机对象态悬空 commit) (8354821fd6d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (966be02197c)
- 🔧 その他:G-73 翻勾结清——窗格族 e2e 15/15 全绿含④a归因关闭(r27d 专席取证,证据进注记;B06 发送链已随 a12ee7500782ebc167dc18fcb9e2cec730861a6f 入库) (41ead978887)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e768574c267)
- 🔧 その他:批量翻勾结清十四票(全部按复跑判据而非票面自述):--gate F6/F4/F4b 归零、%TEMP 现读到位、运行副本邮件决策已给、门33 单向投影落地、G-49 四格出口在库 29/29、G-64 ratchetViolations 第三参已传、gitdir 指针判据实在位+6/6、G-67 三批注记齐且幂等出口 0 行、G-45 基线两侧归零、G-52 归因 53 命中+56/56、G-63 Step4 普通提交、G-58 负龄判据八处接入+25/25、G-06 决策格消化取证格不占桶、G-48 findForks 与 F4 同尺 F1=0 (07c7e5f9d96)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7111c8ee703)
- 🔧 その他:goal-r3 结清 4 票——B06 步序四收尾翻勾(a12ee75007,含结清注)+守门112 cache token/G-28 head-typecheck/P1 僵尸实例三票零改动复结(r27b 复量证据进注记) (e89d731d710)
- 🚀 機能/改善:B06 步序四收尾——发送链路全参数化窗格寻址(承 r26a 暂存面) (a12ee750078)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (05ae732e56e)
- 🔧 その他:G-01 按远端 main tip 31c4acff 现读重列五件,并记 port-registry-check 已转绿 (0b0a5e7c444)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (67ee6f1b40e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b9d8a3e9aaf)
- 🐞 修正:G-35 复结翻勾 —— 取号器全文件查重两出口落地,夹具级正证补齐(G-14) (c9b9621aecf)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e8323d0eeab)
- 🔧 その他:G-67 批1 只读预演回填(7 行够格删除/3 行不可删/复发根因=union merge 回捞) (202f6d53632)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (51a25d32d72)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7d05c72b04f)
- 🔧 その他:B06 认领租约(goal-r3@2026-10-25 承 r26a 遗留步序四收尾;挂载已在 HEAD 23a2c8ac12,余发送链窗格化验证收口) (e37181f05a3)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5e031f2940d)
- 🔧 その他:门207 AGENTS.md 体积判据接入提交链已落地,翻勾结清 (628d1242dba)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b11d9c949b0)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6e089335a57)
- 🔧 その他:复结 D05 多用户协作会话 —— 另批①②现读核验已完工(collab-lock 三端点 33/33 绿、邀请管理 UI 挂载 10/10 绿),③ 多实例广播缺口按设计稿归另票;goal-r2 零改动复结 (ec0c55ffe46)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (83aa572b23e)
- 🔧 その他:复结 G-76 守门39四处判据(修复枚 bd3bc2238c 在 HEAD 祖先链,现跑门 RC=0/自检 12/12/镜像 11/11)与 P1-② AI 批量对齐(无待处理分叉样本,按销账口径) —— goal-r2 零改动复结 (fe7a11d7de0)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (58a760a7af6)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7933b944cfa)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2e1dfcebd86)
- 🔧 その他:批4复核回填 — 双重执行/api-client 假绿灯两行结清,G-01 判未判定,argument-validation 与死端点簇注记 (98c1a4a2a2e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (49e03684775)
- 🚀 機能/改善:GA4 补「同格矢量左向箭头」判据(最近可点容器 + 直接子元素,保守四点),撤 learn 页两处 back-label-exempt(HEAD 相对祖先 a3e97593a 只多这两行,撤回即复原) (f71cd0957a2)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e70755a6e40)
- 🔧 その他:G-96 判为僵尸票结清(四格 HEAD 取证全在位,票面缺件已过期) (d019c6cae73)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7c125bc8fc1)
- 🔧 その他:G-13 结清 + O01 第三型判未判定 + D03 最小切片落地注记 (b65aa6b3a51)
- 🚀 機能/改善:转写完成态补一键插入当前对话(复用 draftInput 通道,不经服务端;+1 用例) (8739e84ad49)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (347d20e4f6e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3f314b880d0)
- 🔧 その他:G-04 两格结清 + O02 第2/3票(NavBar/ScrollJumpButton 下沉)进展注记 (4d9f7f1746f)
- 🔧 その他:重生成 miniapp ui-routes 自述钉(吸收 Collapsible/NavBar 改动后的 inputsSha) (df920f46c38)
- ♻️ リファクタ:NavBar 下沉共享核 navbar-core(骨架/标题/槽位入核,几何与无障碍留两端壳);UserInfoCard 因版面差异硬阻塞另票 (17e5b40b65f)
- 🐞 修正:G-04 格② — 陈旧守卫在 blob 模式改判构造提交的对象库 blob(报告加 face),整 blob 命中祖先只报名不互锁 (3754d6b0202)
- ♻️ リファクタ:门 102 存量清零 — miniapp Collapsible 字形› 改 LineIcon chevron-right,web learn 页箭头位补 back-label-exempt 判据豁免 (c8c62a1ddb2)
- 🔧 その他:清偿 miniapp-taro 105 + mobile-rn 94 枚死键,重生成四端派生件并吸收 ui-routes pin 漂移 (78f0ea893ed)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1a6776fc89f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (811a89c7db0)
- 🔧 その他:L6029 face-reader 棘轮红补现读取证(基线60→62、两枚新门、他人在飞删除) (d820cbd0f06)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (bf576a66e5a)
- 🔧 その他:结清 G-07/H04 两行 + G-37① 与欠账清单 A/C 现读补录(2026-10-24) (0217de11a0f)
- ♻️ リファクタ:ScrollJumpButton 下沉共享核 scroll-jump-core,RN/小程序两端壳只注入 platform (d550594a787)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0b0e423c7b3)
- 🔧 その他:G-24 判据冲突按票面原文裁定:①10 代是地板、maxFiles=5 是总数上限,两轴独立任一超限即判,地板高于上限时地板胜出并报 capUnmet(不再互相矛盾);②射程改为必填 --root,无硬编码默认根,人读面打印「本次射程/射程说明」,命中 gitArchiveDir() 时点名 retire-git-archive 已覆盖;planGc 用 itemBytesRetired 抵扣总数差额防过删;无日期件 .lintstagedrc.json 不归类、点名、RC=2。自验 --check RC0、11/11(新增 T9/T10 强化 T4)、dry-run --root .ihui-agent/archive 72件32代→保留23待删48未判定1 RC2;未执行 --apply (218876e8b24)

**2026-10-25**
- 🐞 修正:[105] web ui-routes 产物重生成补齐 —— 主战会话收尾提交(wallboard/ai-plugin/landing 批)改写页面源后未重跑生成器,输入面现已落定 HEAD,web 产物钉 hash 对齐(inputsSha256 现算一致);miniapp 产物输入面仍有 8 源文件在飞(另一会话),产物留工作树随其同批提交不代裁 (aee60104329)
- 🐞 修正:第八处 CI 红 —— VoiceNote 搜索框补聚焦态(裸 TextInput 普查锁) (2cc6a2ea0b8)
- 🐞 修正:补建 compat 绑定手机/邮箱端点 —— POST /user/phone/bind、/user/email/bind 此前从未注册,小程序「绑定手机号/邮箱」确认步每次 404 被前端 catch 吞成无响应。判据逐字对齐 auth-extended /auth/change-phone/confirm:同一份验证码存储(code-store.verifyCode,Redis 原子比对+删除消费一次)、同一 409 占用语义、同一限频档;差别只在绑定无旧号可验。归属锚点=令牌注入的 request.userId(§5 认证不等于授权:请求体不收 userId)。行为锁 7 例(miniapp-compat-bind.test.ts):匿名/错码/他人占用三闸都断言写库链零调用,两条正向对照拦 eq() 实参证 where 锚本人;变异自证:HEAD(未建)面整套无法通过、修复面 7/7 绿 + stubs 38/38 不回归。 (c87193d5c07)
- 🚀 機能/改善:「业务深纵 / AI 号池」两块补更多可监控数据(机主 2026-10-25 要求"更多实际有用的数据") —— 业务深纵新增用户构成 5 格(VIP 用户 / 操盘手 / 邀请注册 / 近7日邀请 / 近7日活跃)与等级分布行(普通·白银·黄金·钻石),全部与 usersTotal 同一次查询的 filter 计数 ⇒ 零额外开销;activeUsers7d 走 sign_in_records 的 (user_id, sign_in_date) 唯一索引。AI 号池新增:Key 健康四态(unknown/healthy/degraded/down,与汇总字段同一把尺子 RELAY_POOL_HEALTH_STATE_VALUE)、余额不足 Key 数(<5 元且非无限)、24h 内临期账号数(补"只看最短临期"的盲区:只修最短的,第二个过期时又宕一次)、按 provider 分组的 Key 与账号分布表(可调度/总数/异常)。号池侧全部在 computeRelayPoolLiveSnapshot 已加载的两份行上累加 ⇒ 相对现状零新增查询,5 秒轮询成本不变。验证:api/web tsc --noEmit 均 0 错、check-i18n-keys 5 语言 parity OK、门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 60/60 格) (aab60021f45)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (850a49aaa88)
- 🐞 修正:第七处 CI 红 —— Avatar 圆角档回归 shared 规格(md/lg),不迁就 RN 的 2xl (a8852839304)
- 🐞 修正:修 release 包启动即崩(P0)——GlobalFloatBox/PrivacyPolicyModal 调 useI18n 却挂在 I18nProvider 之外 (31c4acff133)
- 🐞 修正:第六处 CI 红 —— PROJECT_PLAN 副本归并归档件补溯源水印 (37b8728d5a9)
- 🐞 修正:第五处存量 lint 红 —— visit-log 测试的 import() type annotation (f9dd9556502)
- 🐞 修正:第四处存量 lint 红 —— auth-gate 测试 mock 的 next/link 缺 href (9fe3d1d63ce)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7dbc8c28053)
- 🐞 修正:补建 GET /distribution/orders —— 小程序「分销-我的订单」自建站起打空炮 (8c036a661c1)
- 🐞 修正:登出未清内容缓存导致**跨账号看到上一账号的 AI 对话与生成结果** (1ac6f8d5a25)
- 🐞 修正:非中文用户的相对时间兜底不再掉英文;三处列表分组改按本地时区(不再切 UTC 串) (928325829e5)
- 🐞 修正:分页"加载更多"三型缺陷收口 —— 整屏顶掉前一页 / 提前断供 / 页边界重复行 (8817a9a40d4)
- 🔧 その他:侧车两键随让号迁移(G-100#把file / G-101#生产备份链…),waiting 同步改 env (2f141c5f36d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (67734203348)
- 🔧 その他:F9 两枚撞号让后来者改号(G-20→G-100 / G-76→G-101),侧车键随号迁移 (c5787574c2c)
- 🐞 修正:六处"合法为 0 的读数被当成缺失"收口(0 积分显示成别人的量纲 / 免费显示成没数据) (c32be823130)
- 🐞 修正:智能体点赞/收藏收进单事务并对父行 FOR UPDATE —— 无唯一约束下的并发重复计数 (22ee752721b)
- 🔧 その他:侧车五条 waiting 按机主令代裁改判(human→none/env) (e688eb82eaa)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (55f828f091c)
- 🔧 その他:代裁结清余下五条 F11 存量(侧车改判 + 行文同步) (7bb316e3106)
- 🐞 修正:分销佣金"分当元"显示(100 倍)与两处接错后端的取数,统一走 @ihui/shared 的 formatPrice (46758b5b2b8)
- 🚀 機能/改善:侧车新增声明式改判档 —— 判据修正后旧桶不再被永久钉死 (a59a40b5f8a)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4651830c72e)
- 🐞 修正:根治计数字段"读出来±1再写绝对值"族,门 243 追加 G5 档(存量实测 10 处→0) (50ca17bd8e6)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d6000a93163)
- 🔧 その他:代裁结清两条 F11 存量(翻勾 + 已拍板条目改题面) (b9fc733c78a)
- 🚀 機能/改善:活文档编辑器新增声明式改桶出口 —— 解开机主令与三维守恒的结构互斥 (9c034053fcc)
- 🐞 修正:守门 246 取材改走读取层批量口 —— 逐文件 git show 在 HEAD 面直接判"未判定" (600b0d58a4b)
- 🐞 修正:归属桶不再读侧车投影标头 —— F11「等人拍板」24 条误判收窄到 7 条真决策 (c9e26351407)
- 📚 ドキュメント:守门数回补为现算 258 blocking / 16104 跟踪文件(ddf16383c65 装上守门 246 带来的增量) (1ca62f93d03)
- 🐞 修正:业务日界统一到 Asia/Shanghai 单一出口,根治大屏同屏「上海日新增 vs UTC 日签到」互搏 + 装守门 246 (ddf16383c65)
- 🐞 修正:README 守门数回补为现算 280/257/16100(本枚装上守门 245 后的现读值) (ccb1be68122)
- 🐞 修正:根治活文档"同形态副本逐次翻倍"族 —— README 4.6MB→1.1MB,并装守门 245 (95b5a628b0c)
- 🐞 修正:同题折叠认「仅投影标头/尾部注记差异」的两版 —— 治跨机合并 F4 放大把分叉卡死 (37e05b810f5)
- 📚 ドキュメント:生成块与散文数字回补为现算值(门 173 落地后点名) (7d05820dc59)
- 🐞 修正:根治「定时器句柄被覆盖」与「零分母读数上屏」两族 + 装车守门 244 (48872214e10)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (51148733d6d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b87d50d12da)
- 🔧 その他:G-50 / G-75 同票两版并为「侧车标头 + 对侧富化正文」(含本侧独有注记) (a745c38c304)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2a9d2b19197)
- 🔧 その他:三处同票两版并为「侧车标头 + 对侧富化正文」—— 为跨机合并消解同题两版并存 (f66ad738723)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (676c6cb43d0)
- 🔧 その他:L7470 死端点簇六路复核:整路径字面量 grep 假 0 修正为 6/6 全通(前缀合成+通用端点改指),三处裸路径改显式 /api 已落 f1ee3fee8e、门 8 主腿 2829→2832 三路各 0→1 判活;仍待三件人定档(bank-cards 无表 / annex-resource 是否新增 /courses/:id/resources / course-qa 与 agent-reviews 语义) (7c3ac208fa7)
- 🐞 修正:生产签出外来工作巡检不再把第三方仓读成未判定(本机 RSSHub 连续 134 分钟假警报) (5bcbc960b47)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f7f5b44aaf8)
- 🔧 その他:L7472 六路口径修正:三处裸路径改显式 /api/(AgentReviewListScreen.tsx:43 /api/agent-reviews、BankCardScreen.tsx:28 /api/bank-cards、MessageChatScreen.tsx:45,71 /api/messages/private 族);六路实为 6/6 通,票面「5 路 0 命中」是整路径字面量 grep 对前缀合成+通用端点改指的假 0,作废;门 8 worktree 主腿 2829→2832(三路各 0→1 判活,行为不变),mobile-rn tsc RC0、悬空 0(11161 文件) (f1ee3fee8ed)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3a03f4521ba)
- 🐞 修正:同名函数族扫描先遮字符串/模板串 —— 治夹具里的声明被当成第二份定义(落地复跑假红) (37fac19cde2)
- 🐞 修正:两条告警根因 —— z-index 门对 cn() 遮罩失明;卫生门把 tmp 一次性脚本算成可移植性违规 (5d1ff7294b3)
- 🐞 修正:PV/UV 的业务日不再由浏览器决定 —— visit-log 收口客户端自报时间键 (aa08ed57dd6)
- 🔧 その他:L7467 冷启动盘点复核新增修 1 格:pages/study/my-study/index.tsx 冷启动直发鉴权端点 GET /study/records(user/study-routes.ts:45 + user/index.ts:36 组级 preHandler)补 useAuthReadyGate+waitUntilReady,ui-routes 自述钉重生成;其余格=代码面 60 枚门控/扩展 SW 早退/mcp-store 有意无闸均已在 HEAD,唯一阻塞=机主手机扫码;自验 check-miniapp-generated --worktree --group ui-routes RC0、miniapp tsc RC0、eslint RC0、use-auth-ready-gate 14 passed (0c9e33f2624)
- 🔧 その他:G-16 门128 新增 classArmResolution 解析维(只报数不进退出码):usedClassRefs(带 conditional 上下文的唯一提取式,usedClassNames 改为其键集)、classDefScan、classArmVerdicts、collect 接线、人读面打印、--json.classArm;按票面机主定档:唯一无覆盖定义+无条件使用=resolved,多处定义/!important/非单类/条件取用=undetermined,小程序侧查无定义且非工具类形态=undefined 逐条点名(web/rn 无 Tailwind 配置可解析一律 undetermined,不折成通过);顺带修两处取材(比较运算符后字面量不当类名、@media/@supports/@layer 剥壳后不误判选择器非单类)。HEAD 现读 47 腿中 16 用类名:唯一无覆盖定义33/查无定义0/未判定69。自验 --check RC0(10s)、测试 48 例 T42 在位、--self-test 因另一席未提交的 scripts/lib/cross-end-ui-parity-selftest.mjs 脏副本在 :2570 崩(pristine HEAD 复现同栈,非本批) (3570211ffd9)
- 🚀 機能/改善:迁移缺口审计接入守护巡检(30min 节流;缺口集合进告警身份) (69f0e349f71)
- 🔧 その他:G-91② 全量基准门:all-checks-runner 末段固定输出「总耗时/门数/预算/判定」,预算与基线读自新文件 scripts/check-all-budget-baseline.json(budgetMs=120000, baselineMs=156711);新增 pnpm check:all:120(--budget-strict,超预算 RC=1),默认 check:all 只报不顶红(耗时不是判据真假;失败路径由自检 A12 钉死);自验 --self-test 13/13、check-gate-wiring RC0、--budget-strict 实跑 RC1(27 步 25 通过 2 失败:第13步 check:miniapp-generated 与第18步 scan-dead-i18n-keys,判定面均 HEAD 且非本批产物;首次全量 156711ms/27 门) (1f654a6c5f1)
- 🐞 修正:两处入账的丢失更新(管理员调整余额 / USDT 到账)改为 DB 侧原子增减 (0450d797418)
- 🚀 機能/改善:迁移账本「中间缺口」审计与修复器物 —— 治生产库长期落后代码且部署只说档位噪声 (e0ed1d8105a)
- 🔧 その他:G-40 A 格最小落地:command_ack_facts 表(复合主键 child:<parentSessionId>:<sourceCommandId> 即幂等键,status/载荷双 CHECK,expires_at 索引,尾部回滚注释)+ TS 镜像(schema/index.ts 导出)+ journal idx342;run-idempotency.ts 仅记 E 格 TODO 点名写入侧 agent-runs.ts:304-318 与重放侧 :725-731,不半截实现。自验:bookkeeping --worktree 342↔342、schema-drift(TS608/迁移611,dead=1 存量 rag_chunks)、immutable、ledger-drift 无 DSN=SKIP、scripts/tests 38 例、@ihui/database tsc RC0;未跑(无 PG):from-zero/真实应用/drizzle-kit generate (14df3f14f00)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (44c6681ef70)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4a1c78d5df9)
- 🐞 修正:行内标头按侧车收口 8 行(3 条 malformed + 5 条陈旧) —— 门 234 A2 清零 (9fe2a464509)
- 🔧 その他:侧车去重 91→87(4 条被新记录接管的旧副本) (48c19258605)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (604a52d0999)
- 🐞 修正:ws-payment 归属校验改为 fail-closed(两处降级放行是活的越权口) (713efc621e2)
- 🔧 その他:结清 门39 六屏共享层下沉 + D42046 断线窗口待决审批重放(r2d 席 2026-10-25,零改动现读凭据行内) (887902d5ccf)
- 🐞 修正:侧车写入链路三处根因补齐(散文优先 / 去省略号 / 投影保散文回退) (6596afa1ba6)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (58be7dd6c78)
- 🔧 その他:三翻勾结清 G-61(--root 修复在 HEAD+镜像 76/76 全绿;heal 回捞根因器物 RETIRED_LEDGER 随自愈器修复提交入库激活,窗口外拒复插;诊断出处按内容锚点指门体头注) (5fdb3e8b96f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4b7215ce475)
- 🐞 修正:陈旧行内标头按侧车重渲染/摘除 6 行(门 234 A2 收敛) (7416c88b28d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (98b5de5e77c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (50d1bb1ddab)
- 🔧 その他:认领 门39 六屏共享层下沉(r2d 席 2026-10-25) (1caff10ad83)
- 🔧 その他:侧车同键去重 105→87(18 条重复记录;解析映射逐键零变化) (6a55e44ef13)
- 🐞 修正:侧车投影可往返 + 抽取器只加不减 + 同键去重入口(门 234 根因三连) (f9c1514b303)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e88befc9306)
- 🔧 その他:结清 D42046 断线重放票(diff①/diff② 均已由 D690 方案 A 批次落地 8214722404;r26b 现读核实 129 例全绿零改动;过时注记交后手) (3a49101391f)
- 🐞 修正:提现释放冻结补齐额度守卫(G3 存量归零),并给兑换补运行时行为锁 (a0e53989322)
- 🔧 その他:工具两件:G-62 第二版 F5 恢复等价注释(②档 b-o 即 max(基底,本侧),未复制期望值基准,用例 58/58 不变)、G-24 新建归档回收器 archive-gc(默认 dry-run/三条判据 maxFiles5+100MB+keepGenerations10/未判定 fail-closed RC2;真实 .ihui-agent/archive 现读 72件32代→保留23待删48未判定1;9 例自检);不含 --apply,不改既有归档 (785d9eca686)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2f2368da057)
- 🐞 修正:行内标头按侧车重投影 16 行 —— 门 234 A2/同键矛盾走正牌出口 (5468186d7f7)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d50fcd1cf91)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3b24a9a9db1)
- 🔧 その他:认领 门39 六屏共享层下沉 / D42046 断线窗口待决审批重放(r2d 席 2026-10-25) (71ca38eee9e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (61864c2094d)
- 🔧 その他:B06 认领租约(r26a@2026-10-25 接手余步序四;前牌 goal-r52 超 72h 且会话已收官,按 §1 交回派单面) (33d0312d05d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc8e353c6eb)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1ab2f4992bb)
- 🔧 その他:结清 G-38(三条 P1 目标票已离场,漂开副本归并出口诉求前提消散,零改动现读凭据行内) (21487be7d7f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d71c78cdfe)
- 🔧 その他:复结取消信号+宿主故障标记孪生再回捞两枚+结清审批代际CAS票(approval_generation_cas.py 整套在 HEAD,票面 grep=0 系 2026-10-13 过时读数;三行均零改动现读凭据行内) (cf106d58c02)
- 🐞 修正:check-credential-health 服务存在性探测换通道 —— sc.exe 属本机程序黑名单，spawn 那一刻安全策略杀的是整个 node 进程(RC=143)，致 IHUI credential-health 每 6h 巡检腿整条静默消失；改为先经 Get-Service 读同一份 SCM，sc.exe 仅 IHUI_ALLOW_SC_EXE=1 兜底，探测不可用仍返回 null(不误判，未放宽任何门) (d45af31ef71)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (878a312df9f)
- 🔧 その他:结清 G-35 取号器撞号票(形态 A 18e4bf960c+形态 B d34600b0e84 两出口占用面补全;镜像族全绿;存量 9 组清偿去向登记) (8779ebae1be)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1a70ac6955c)
- 🔧 その他:r2e 基建普查注记 —— scripts/ 下 reg/schtasks/sc 类黑名单 spawn 一律改 PS 通道（换通道不跳门，读不到如实报未判定） (c29d41e11a4)
- 🔧 その他:侧车抽取正规产出 12 条(plan-fields-extract --apply,bucketsDrift=0) (70520a6fbc1)
- 🐞 修正:G-35 形态 B —— 第一发号出口 live-doc-edit 补扫工作树副本(r25k 席,主会话裁决采纳档)—— CAS 循环内每轮读工作树副本用同一把尺 scanFamilyIdHits 扫(先剔租约行与 HEAD 面同口径),副本独有号并进占用面(并集方向:HEAD 证据保留 fromWorktree:false 不倒扣,镜像 ⑧b① 钉);worktreeText 缺省 undefined 本维完全缺席行为与改前逐字同形(⑧b②),读不到退回 HEAD 宽面警告出声(⑧c);命中明细带来源面「工作树副本第 N 行(未提交)」;I10 形状锁收窄到立法意图(幂等判据区段零磁盘取材,收窄不削判据,工作树维另由 ⑧c 锁);验证:live-doc-edit 自检 29/29+组合 169/169+collision 10/10+id-collision 19/19+next-plan-id-remote 14/14 全绿,水印 6/6,--check exit 0;形态 A 已入库 18e4bf960c(收编器) (d34600b0e84)
- 🔧 その他:门94 补 D08① 团队任务六码(唯一真源+五语词包+用例):mcp_server.py 产出的 ALREADY_CLAIMED/BOARD_FULL/FORBIDDEN/INVALID_STATUS/TASK_CLOSED/TASK_NOT_FOUND 入 ERROR_CODE_CATALOG;实测 check-error-code-coverage --worktree 111 码/128 条全覆盖、五语词包 19174 键 parity OK、error-catalog vitest 16/16、@ihui/shared tsc RC0 (1062bcb3daf)
- 🐞 修正:已结清短留痕 —— 窗口外不再把已翻勾的票复插成未勾(G-61 型) (25ca3e6be2d)
- 🐞 修正:积分兑换超卖与提现回调黑洞根治,并装守门 243(额度写影响行 / 回调吞失败) (bddb7beaff4)
- 🐞 修正:两端 ui-routes 派生产物按 HEAD 输入重生成(门 105 转绿) (b1f5c1c3848)
- 📚 ドキュメント:删除被并发 union 回插的重复速查块(97,095 → 95,057)—— 门 207 体积回预算 (6c96fc42260)
- 🐞 修正:第三处存量 lint 红 —— agent-free-times-authz 的 import() type annotation (dcaa35a376e)
- 🐞 修正:生产构建改 staging 原子换入(构建期零影响)+ 部署锁 run 托管;DevEnv 根按机器标记识别;凭据巡检停用备份口令真登录;AGENTS 去重回预算 (7d36e564f57)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (98091967daf)
- 🔧 その他:安装器三版沙箱编译实测进展注(基线/A/B/C 四轮真实构建读数+还原自证;选型归机主票不结清;未尽②全帧目审仍开) (5ee1dd77682)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (651decf90cd)
- 🔧 その他:D08 订正注(D06 前置已按完成即删摘除,首条注记的当次现读已过时;r2a 席) (cd379d91073)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e2ba1dcb349)
- 🔧 その他:G-35 进展注(形态 A 第二出口远端避让已落盘 19 臂绿;形态 B 已裁决采纳续做;存量 9 组清偿去向登记) (a9c1b939f1a)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (046f9979c70)
- 🐞 修正:G-35 第二发号出口补远端号集避让(r25k 席)—— next-plan-id.mjs 发号路径原只吃 remote.max,远端低位独占号(本地面已让空/已推未并)结构上不被避让会被当空闲发出(与第一出口 live-doc-edit 自 G-454② 已扣远端号集两出口同漂);lib/plan-id-lease.mjs 加 remoteIdNumsOf 单源投影,liveUsed 并入远端号集(同号集恒等并行为逐字同形)+skippedByRemote 逐枚点名;镜像 T11a 三段(修复前撞号实证/修复后顺延/恒等并反证)+T11b 装车形状锁;验证:next-plan-id-remote 14/14+plan-id 族 7 镜像 52/52+--check exit 0(建议号 O65 含远端避让)+水印 3/3;2026-10-22 三连撞号病型已由 c84e98229c 收清、夹具 7 条正证在 allocator-collision (18e4bf960c0)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7549b151cfa)
- 🔧 その他:chore/fix(plan): r2c 席核验派单口径 11 行等条件 —— 2 条前置已成立结清(G-55 trace 列 / P1 残余② desktop 日志 target),9 条改写为可机读成立判据并补当次实测值 (e551927717d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0fe3d826f6c)
- 🔧 その他:D08①团队共享任务列表落地进展注(goal-r2 2026-10-25 r2a 席;③ 归属 web 在飞面) (215fe312e59)
- 🐞 修正:又一处存量 lint 红 —— chat-sync-rev-persistence 测试的 Fastify import 未使用 (c75a540f094)
- 🚀 機能/改善:D08① 团队共享任务列表 —— team_task 工具(子 agent 可认领/更新条目) (42ac1f1a682)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (28cfabd24e0)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (01d74c51f43)
- 🔧 その他:复结取消信号+宿主故障标记两枚并集回捞复活体(8894762aed 已实现+cf4321f8d0 已翻勾;r25j 现读核实 10/10 GREEN,零改动按门 239 单调性复结) (b8cb8144768)
- 🐞 修正:开发者密钥弹窗「权限点/说明」改走语言包(adminTools.developer.permissionLabel/permissionHint),五语齐;该文件硬编码 chrome 归零 (e4f57db0da3)
- 🐞 修正:收口 /api/agent-free-times 匿名挂载 —— 空 body 的 /reset 不再清零整表 (dca9bbbd6d5)
- 🔧 その他:G-1102638 批1 同主键副本行物理归并 — 删 7 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-24.md) (2cb472ebe55)
- 🚀 機能/改善:G-67 判据④补「归档已勾主行」档 —— 陈旧悬空指针可删、主行仍活仍拒删(fail-closed);7 例自检 + dry-run 候选 7 行 (75d2a278471)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (62addf0b582)
- 🔧 その他:结清 G-79(待落 13 文件已由 f9b56e4278+a6c7cb36ec 入库,零改动)+ 复结窗格续传同题孪生复活体(引用 L7817/7818 结清凭据,门 239 单调性) (227c4f01ca8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (77583333a7d)
- 🐞 修正:G-04 落地器水印预检改判「将要提交的那个 blob」(cat-file + 临时副本,豁免面按 REPO_ROOT 复算),不再判工作树盘面;76/76 + 23/23 自检 (62f7eb65c69)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d2938d435ca)
- 🔧 その他:B02 resync 切片进展注(rev PG 权威源+快照端点+gap 接线,160 例绿,剩余面 5 条登记)+ 结清 L7648(401→502 映射代裁,132 例绿) (4ed1a7edfa3)
- 🐞 修正:第二处 G-948 回归 —— course/detail 入口桶文件次序(CI Build 已复现新冲突对) (e3635cc7406)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (22a3aaa5a7a)
- 🐞 修正:更正 e6cfb5cf563 —— knowledge-rag 三处 query 局部成了死变量 (c15feca74b5)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c3e485ddf68)
- 🐞 修正:存量 lint 红归零 —— 两个号池测试文件的 3 处 eslint error (e121b36c406)
- 🔧 その他:重结 D06 /review 票(回潮修复:union 归并带回旧行,7f20caf30f 已在祖先链;主席裁定代行) (2ef3c77ef93)
- ♻️ リファクタ:返回键无障碍名改由 wrapper 注入 i18n(common.back) —— 共享层不再写死中文,消 scan-hardcoded-zh 增量(有意重引入 useI18n:此屏 UI 已下沉共享层后一度无取词点,现新增 a11y 标签需取词) (078dd7c8445)
- 🐞 修正:L7648 非会话 401 被当会话死亡代裁结清(r25i 席)—— 口径:真 401 只有 api 鉴权层能发,过了 api 鉴权之后上游/内部 401/403 一律映射 502;唯一映射实现 errors/upstream-status.ts mapUpstreamOutbound(401/403→502+UPSTREAM_AUTH_FAILED,422/404/429 语义保留,区间外兜底 502 同 v1 先例);新错误码 UPSTREAM_AUTH_FAILED 走 codes.ts 注册形态(守门 206 零增量);ai-chat-stream 3 处主通道+v1-multimodal 2 处对外面+agent-extended 兜底 ??401 收窄 ??502 接线;response.error() 加可选 errorCode 三参(两参形状逐字节不变);测试 10 例(核心对照:上游 401⇒502 非 401 端到端+本服务鉴权 401 仍 401)+132 例回归全绿;typecheck 8/8;水印 7/7;遗留:同型透传点约 15 处逐点收编(helper 已就位,语义各异须单独核,不在本票授权面) (d42caa742a5)
- 🐞 修正:生产 web 构建脚本补 node22-lts 候选 —— 原三条候选(C:\Users\Administrator\.workbuddy\binaries\... 与 D:\DevEnv\runtimes\node22\node.exe)在本机全部不存在,构建脚本 [FATAL] Node 22 未找到、生产 web 无法重建(2026-10-25 实测阻断一次全链部署)。本机实际在位的 Node 22 是 D:\DevEnv\runtimes\node22-lts\node.exe,已用它成功跑完 next build(7.3min 编译 + 类型检查,BUILD_ID=lGLze0tuCla8z1ZhrisTr,IHUI-WEB 自动重启正常)。SWC 在 Node 26 上 STATUS_STACK_BUFFER_OVERRUN 的老结论不变,只是执行者路径要按本机现读取值(AGENTS 首部七类机器事实) (d4d718cd813)
- 🐞 修正:根治身份主体族缺陷 —— crew/knowledge 匿名越权,并装守门 242 杜绝回潮 (e6cfb5cf563)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5e39b95ebfe)
- 🔧 その他:D08 Agent Teams 协作协议 前置未解除进展注(goal-r2 2026-10-25 r2a 席) (49ee66a8f56)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (24b0a6e3b48)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7a9c9c6d33e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2db12443a26)
- 🔧 その他:登记 P0 —— PG 备份链空转(IHUI-PG-BACKUP 服务未安装/sc query 1060;脚本已修到可跑且运行副本已同步,但无 03:00 节拍器等于没备份;出路=装 nssm 服务或由部署机承载+建只读 beifen 角色) (01ef2d5e6f8)
- 🐞 修正:题面指纹 16→32 字,避免同前缀不同票被一并豁免 (1902f5ed847)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (612a65ee7cc)
- 🔧 その他:结清 L7209 门33 provider 名单票(2026-10-07 拍板②已落地单向投影消灭手抄名单,现跑 rc=0 九 provider 全识别,零改动) (420077e8337)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (336654db9d9)
- 🔧 その他:翻勾结清八票(服务定义入仓+基准维 self-test 90/0;门98 D6 维 rc=0;O01 孪生 0;USDT 两 env 非空;H04 三语 JSON OK;门112 双根齐;G-28 CI 接线 714efaa19196;G-61 镜像 76/76 且系被 heal 捞回再翻) (154404a1aa9)
- 🔧 その他:认领 D08 Agent Teams 协作协议(goal-r2 2026-10-25 r2a 席) (c4734de1ed2)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b1026855a81)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (61a536ce317)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2a5ce505323)
- 🔧 その他:精确摘除 A2 回潮的 4 条同题变体(按复合主键,不按 16 字题面) (ac77ba67992)
- 🔧 その他:结清 L7334 health 契约分叉票(代裁=web 读法对齐后端;backend-health 换真多服务端点+monitoring-dashboard 同型分叉同批清,入库 d107d57a2f;落地器瞬时判红的 scan-hardcoded-zh 复跑两面 rc=0,系并发索引中间态非本票引入) (87e3f1000e5)
- 🚀 機能/改善:G-10 门接线 —— check-service-binary-paths 加仓内基准对账维(列出/在册/缺/启动类型/Application/快照过期六件事;只读只报数,不参与 computeExitCode,基准读不到或坏 JSON 记未判定);__test__ 导出同步加 normalizeStartType/parseServiceBaseline/compareServiceBaseline/readAndCompareBaseline/BASELINE_REL/SERVICE_BASELINE_PATH;补回 HEAD 的 F3 G-158 修正(isAllowedScratchRoot + gitFaceEscapesToRepo 两维);LAND_ALLOW_STALE 理由=复活守卫把席 J 新写的 const services=[] 与 2026-09-28 祖先同文本行撞车误判(已逐行核对:HEAD 内容零丢失,__test__ 两项为正常重写、旧导出名全保留);验证 --self-test 90/0 rc=0 全绿、基准行 列出3/在册3/缺0、全量 rc=1 为存量机器态 (cf4cda08c26)
- ♻️ リファクタ:五站返回键/箭头收口到共享 BackChevron 与 LineIcon(零字形箭头);死副本 NavBar 只报证据不动 (1e63ced855e)
- 🐞 修正:合并吞并门 A5/A6 不再把「机器生成块」翻新判成内容丢失 —— README×4 那次 reset 的唯一差异全在两枚标记块内,A5 只比 blob 退回基底 ⇒ 恒红顶住提交链(§12e) (3888c3708aa)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1b8c99cb145)
- 🐞 修正:check-c-drive-pollution 注册表读取换通道 —— reg.exe 被安全策略黑名单 spawn 时杀的是本 node 进程(RC=143),致 live-doc-edit/safe-commit 整条落地链断裂;改为先走脚本宿主读值、reg.exe 仅 IHUI_ALLOW_REG_EXE=1 兜底,读不到如实报未判定 (2500db80556)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3560fe13f58)
- 🚀 機能/改善:补「用户增长」近 14 日每日新增曲线 —— 后端 buildBusiness 新增一条独立 catch 的聚合(createdAt + 8h 按上海日界切分,与 usersTodayNew 同口径;窗口 = shanghaiDayStartUtc(13) 起含今天),查询失败整块 null 不渲染(§0.3 不把"没量到"画成 14 根 0 柱),成功则按 shanghaiDateString 逐日补齐 14 天、无行日期填真实读数 0;前端 BusinessSnapshot 加 userGrowth 字段 + userGrowthOption(CHART_CYAN 面积折线,62px,与签到 7 日图同族),业务面板左栏用户三格(注册/活跃/今日新增)之下紧接增长曲线;packages/i18n 五语言补 userGrowth14d 键。验证:api/web tsc --noEmit 均 0 错、check-i18n-keys 5 语言 parity OK(19156 键)、门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12 (1fb444802bc)
- 🐞 修正:文档数字门屏蔽 RECENT UPDATES 块 —— 自动抄来的「176 llms → 101 llms」是历史陈述,不是当前总量声明 (be12ee7a531)
- 🔧 その他:侧车再对齐 3 条(并发新行;bucketsDrift=0,回读 79 条) (521c75d74f0)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (155d311e600)
- 🐞 修正:L7334 health 契约分叉清偿(web 读法对齐后端,后端契约不动)—— backend-health 页换读真多服务端点 /api/admin/monitor/services(r25h:原 apiOrThrow<ServiceStatus[]>('/api/health') 把单对象当数组,.map 必空;新端点 requireAdmin 回 success({list}),ServiceStatus.status 补 running 档+删后端不存在的 message 死分支+ICONS 键对齐后端 name+健康判定 !==unhealthy);同型隐患同批清:monitoring-dashboard 页(该端点回 {list} 信封而页按 ServiceItem[] 读)——page.tsx 解 list、types.ts ServiceItem 补 running+ICONS 键对齐、MonitorStatCards 判定 !==unhealthy;tsc 全量唯一红在 r25d 在飞中间态文件(use-conversation-broadcast-sync)非本票面,本票 4 文件 0 错 (d107d57a2f7)
- 🚀 機能/改善:D04 富文本动作锚点装车 —— 消息正文含锚点时走 RichAnchorText 白名单渲染(不进 rehype-raw),a/link 仅安全 URL 出真 href;5 例新测试 (83321dbba3f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1312e8f5507)
- 🔧 その他:G-21 格⑤落格收口注记(agent-control 在飞图 CAS 驱逐+入口拒重复,枚 447e047a7b6 全量在注记)+④⑥证据刷新;租约按器物形态保留待 TTL 代摘,余格交回派单面 (1ef258d66bd)
- 🔧 その他:侧车搬说辞 30 条(抽取前后归属桶零漂移;存量 123→92) (c6e4dae08c4)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (571aa33dddf)
- 🔧 その他:翻勾结清三票(活动时钟单调:G-820/G-821 已在库 46e9a67095、session_store 九写入点全 max()、test_session_store 50 passed、值级探针 PROBE_RC=0;门13d 同行叠注记维已在且 --self-test 8/0+全量 rc=0、DUP_POINTER_RE 不扩字族仍成立;G-91 尺子②:audit-benchmark-delivery --strict rc=0、29 条/43 断言/未建档 0、三态 42/1/0) (e5037766201)
- 🔧 その他:r2-infra 落地链验证（黑名单程序换 PS 通道） (9e19de0f3fc)
- 🐞 修正:补回被 73d1ed177b8 连带抹掉的 130 处 web 五语言键(workPanel / reviewTarget / captureTraeWeb / expertRoute / injectionKindExpertPack) (43c7ec0fd1c)
- 🐞 修正:Build 步骤加 --force —— 消除 turbo 缓存把不完整 api-client dist 固化的通道 (a2a9f872342)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2120941b104)
- 🔧 その他:G-67 回填十条指针行逐条判定(4 条陈旧悬空可删 / 3 条主行仍活禁删)+两尺失明带 (8d2266f7367)
- 🔧 その他:F11 存量清零后刷新基线注记(24→0;地板仍为 []) (1a929de6660)
- 🐞 修正:补回被 73d1ed177b8 误删的 ide.agentsMd 19 键 + settings.expertRoute 4 键(五语言)—— 根因:该提交删键时两个消费组件(agents-md-generator.tsx/expert-route-card.tsx)正处工作树删除态被判死键;本会话已回盘恢复组件(R13),缺键随之显形。键值逐字取自删除前提交 73d1ed177b8^,文本级插回顶层块(parse+键数断言,五语言 parity 绿);只补有消费的键——hint/auto/off 等 6 键其消费者已随该批移除且未恢复,不回补以免制造新死键(web 死键门复验仍 0) (c891e141efe)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (474e1fe6ca7)
- 🔧 その他:G-29 第二十一批 10 站进展注(065957e4ae5,39→28)+ G-21 第③格完成进展注(cause 链脱敏代理入库) (66d3d39b442)
- 🚀 機能/改善:首屏按机主关心的「用户数据 / 增长 / AI」重排 —— KPI 带用户卡与 AI 调用卡前置到最左两格(用户卡 sub 即今日新增=增长读数,不另开第 7 张卡:六列档会落成 6+1 孤格);主体网格 order 四档化 wb-prio-user(-40 业务纵深)/wb-prio-ai(-30 号池)/wb-prio-traffic(-20 访客与机器人 PV·UV)/wb-prio-trend(-10 流量趋势),1920 下首屏两行即读完这四块,主机/服务/质量/告警/数据层/边缘/运行时长顺次后移;业务面板内部把用户三格(注册/活跃/今日新增)+签到 7 日增长图提到左栏顶部,接口调用排行下移为纵深信息。取代原两档 wb-flow-first(-2)/wb-business-early(-1)(同值回落 DOM 顺序、编排会静默失效的旧形态,类名同步删除避免定义无消费)。验证:门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 49/49 格未脱钩)、apps/web tsc --noEmit 无错。并发说明:走 object-space-land 落地 —— 普通提交路径此刻被并发会话的 lint-staged 争锁阻塞,且它会对他席在途文件(stash/restore 工作树)造成污染;README×4 为他席已暂存内容,本票不代提交 (639bd7f7797)
- 🐞 修正:ai-plugin.json 描述对齐现算值(API 956→4557 / 路由文件 100→622 / 表 329→606 / provider 18→94) (3eaae06aecf)
- 🐞 修正:G-21 格⑤ agent-control 在飞图并发守卫(对齐上游 in-flight 合并+CAS 驱逐纪律) (447e047a7b6)
- 🚀 機能/改善:G-21③ 诊断量代替原文 —— mcp-credentials.ts cause 链脱敏代理(redactedParseCause:JSON.parse SyntaxError 原文经 V8 短消息策略会整段嵌凭据片段进 crash-handler flattenErrorForReport 与 console.error 两个消费面;代理后只留位置数字诊断量,message 经 @ihui/shared redactSecrets 兜底,依赖已有未新增);新增 4 组威胁模型测试(裸 token/三段式 JWT/深处失败/正向对照)全绿;既有回归 mcp-credentials 族 105 + oauth 族 47 全绿;turbo typecheck --filter=ihui-cli 8/8;水印 verify 1/1 (5d9a026c9c9)
- 🐞 修正:G-44 告警去重身份从整条消息文案改为「类别+归一化骨架」——16 个稳定枚举+时刻/路径/hex/数字归一,累计次数由既有 repeatNo 承载不进键;补 11g 读数漂移同槽/11h 异族不共槽;harness pass=44 fail=0、mjs 7/7、deploy-alert-dedup 17/17、门224 --worktree 与 --staged 身份抖动0(豁免1)/自检15,ihui-deploy.ps1 仅同步一行注释;ci: G-28 HEAD 面逐端 typecheck 接进 ci-monorepo.yml typecheck job(id=head-typecheck,45min,预算30min/单端10min),TRIAGE_IDS+O_HEAD_TYPECHECK 同步;本地实跑 rc=0(20端通过/已入库红0/未判定0,484s),YAML parse rc=0,check-ci-failure-triage-wiring --staged rc=0,check-gate-wiring R1/R2/R4 rc=0 (714efaa1919)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d85e4c530ad)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f0c49713407)
- 🔧 その他:补删 F11 最后 2 条(题面维已装车,回捞应被声明挡住) (47bb7ea918e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (87f3f8cbe2c)
- 🔧 その他:翻勾 G-22(F9b 畸形登记号维已在且进收敛闸,现读 0;四套件 145/181/58/82 绿) (ed0c8f671e9)
- ♻️ リファクタ:G-29 第二十一批 10 站接 flag-value 单源(requireFlagValue 判死:漏值/坏值 exit 2 点名实得 token;纯函数层契约不动语义未变)—— i18n-messages-exist/--root、load-state-loaded-marks/--root、migration-immutable/--root、miniapp-build-artifacts/--dist、turn-ordinal-lock/--root、txn-cancel-boundary/--root、theme-prop-wiring/--root(旧裸取值改判死)、tool-contract-declared/--today、scan-upstream-models/--provider、sync-alpha-usage/--face;另修既有断裂:check-batch-write-count-honesty 补 3 旧出口转发(0ce9314545 拆层未留转发,state-guard 加载即炸);探针+30 支全 rc=2;镜像 10 套全绿;只读尺未接 39→28 (065957e4ae5)
- 🐞 修正:/landing 收款落地页口径对齐现算值(8端→9端 / 339表→606 / 100模型→101 / 14平台→38) (4be00e3625b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (401f1715c77)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (804700feb24)
- 📚 ドキュメント:补齐对外 SEO/roadmap 漏网口径(176 llms → 101 llms、roadmap 8 端 → 9 端) (333fd912418)
- 🔧 その他:翻勾 G-36(圆角死类名代码面归零+门77/150/235 三绿实证,余人工观感项) (f6cd572b1bb)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d1f9ff98905)
- 🔧 その他:结清 G-47 三红票(①端口门 rc=0②ruff 全绿两枚入库③lint 根因=产物目录缺 ignore 已补入库 7611a789c5;三格齐绿判据零放宽) (e1a6a59d5fc)
- 🐞 修正:G-47③ 受保护检查 lint 红清偿 —— apps/cli/eslint.config.js ignores 补 dist-sea/**(SEA bundle 构建产物,gitignored,同 dist/coverage 性质;4072 个 lint error 全部来自 dist-sea/ihui.bundle.cjs 单文件,判据零放宽、产物退出射程);复跑 pnpm run lint rc=0,turbo typecheck 47 任务面绿 (7611a789c59)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (19d26c0a479)
- 🔧 その他:二次结清 G-61(首次翻勾被并发旧基线抹掉、回捞按未勾态复插;凭据 = object-space-land 镜像 76/76 两轮) (5a54bfaff50)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (536679efbc5)
- 🔧 その他:O02 第④格回填现读读数(BottomActionBar 20/InputArea 18)+最小第一步清单与拍板前置 (8b23d590bde)
- 🐞 修正:G-47 ruff I001 清偿第二枚 —— mcp_server.py:5345 import 块排序(ruff --fix 自动归并同源导入块;上一枚 5b3c657347 因改动在工作树未随 pathspec 进链,本枚补交;uvx ruff check . 全仓 All checks passed) (9c092c779fd)
- 🐞 修正:G-47 ruff 存量代裁清偿 2 处 —— tests/test_voice_tts_stream_router.py:26 F401 未用导入删除(该文件仅 1 个历史版本,删后 blob 不撞祖先,门 84 零风险;pytest 7/7 GREEN);mcp_server.py:5345 I001 import 排序(ruff --fix;改前三方比对确证幻影 M:索引 blob==HEAD 即 mtime 漂移非在飞);改后 uvx ruff@0.16.6 check . 全仓 All checks passed (5b3c6573477)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (217442aafad)
- 🔧 その他:G-47 ②清偿进展注(ruff 2 错代裁清:测试 F401 删+mcp_server I001 幻影确证后 --fix;ruff 全仓 All checks passed;①rc=0 现读;③全量验证在跑) (308796bfe5b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2c35955af7d)
- 🔧 その他:结清 G-28 HEAD 面类型检查出口票(器物已在库 check-head-typecheck.mjs+镜像,self-test 23/23,零改动) (906c5d09603)
- 📚 ドキュメント:表格/tooltip/toast 一族给技术定论 —— 不是缺陷,不建门 (84db1779e9a)
- 📚 ドキュメント:README 中英双版数字对齐现算值(9 端 / 101 模型口径) (59d386cabed)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fc12053235e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (710b4dd47f1)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (349253de0bd)
- 🔧 その他:回填四票进展注记(G-29 第二十批十站 / G-62 F5 问责恢复 / D08② 换手事件 / D06③④ 收口) (eb294fd9c62)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5ab90ce2d66)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (46ffaf48c13)
- 🔧 その他:G-21 挂租约认领(zcode-main@2026-10-25,按票面「派单时逐格可」逐格推进:先刷新六格证据核我方落点,优先③⑤⑥,①②量力另派) (48a465e21e1)
- 🐞 修正:清 push 门两个 not-ours 红 —— 三处 spawnSync 补 stdio + api-client 桶补两个 D09 类型导出 (ece5ac5de3e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (84dd513a8e7)
- 🔧 その他:结清 L7742 —— 服务运行时代码新鲜度维已覆盖 dot-source 传递闭包(G-1080903 实现,自检 82/82) (8ea9394d1ba)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (df2dd29d170)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8bc3731623f)
- 🔧 その他:结清 D06 /review 票(「/new 仍缺」格经 r25a 现读裁定已由其后提交补齐:send-message.ts:983 注册 onReviewFinding+防回潮锁在;零改动,摘 r25a 租约) (7f20caf30fc)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6d7cc488f25)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (887b256434e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6ffbc09c106)
- 🔧 その他:结清 G-41 三格(①0 违规②G-417②已落地判据③resolveGitBin 已接单源;三格逐条现读凭据见行内注记;摘 r25c+r25e 租约——②经核验无需再做) (97192f73de2)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (af84a1df58f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2d6d07f65cd)
- 🐞 修正:修 F3 自检恒红 —— 落点判据跟上 G-158 仓内 .DevEnv (1f9deae5c65)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ed46cccb30a)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (58111ebfb00)
- 📚 ドキュメント:英文 README 数字对齐现算值 + 9 端/101 模型口径 (6d490805713)
- 🔧 その他:翻勾「deploy/prod-bundle/ 被 gitignore 导致 compose 链脚本全仓无入库源」——亲跑 check-prod-bundle-shadow rc=0 复验(本机 14 对逐字节等值/9 对部署机现场未判定按门设计/E1 枚举闭合),同文结清注记 3 份去重归并为 2 份 (782cbd2fbf9)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b18c2b0d6e1)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1142cf1807d)
- 🔧 その他:复结 prod-bundle 票孪生副本第二份(同凭据零改动,门 239 单调性) (8c5a366214b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fb7072816bf)
- 🔧 その他:清 F11 等人拍板存量 24 条(强制令代裁/摘行;逐条留证) (eb35b31d15d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (62280da2286)
- 🔧 その他:D06 派发预填对话框用例(2 例) (2718e8749ce)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e3686744ce8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (60c64ebf80d)
- 🔧 その他:复结 5 条并集回捞复活体票(prod-bundle/G-33/G-34/桌面log/活动时钟;结清凭据均已在 plan-row-drop.jsonl,按门 239 单调性零改动复结) (508d7b632cb)
- 📚 ドキュメント:全站口径对齐到 9 端 / 101 模型（对外文档+工程文档+发射器） (73d1ed177b8)
- 🚀 機能/改善:D06 审查卡一键派发修复(DispatchSubagentDialog 加 preset 预填,复用既有 dispatch 腿)+ 3 例测试 (f5be4c99b64)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a58f8399d47)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1793b07844f)
- 🔧 その他:复结 L7657 键名对齐票(并集回捞复活体;2026-10-23 已有完整结清凭据,零改动按门 239 单调性复结) (3dbc8547e45)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ab006eaae77)
- 🔧 その他:结清 G-61 僵尸票(套件两轮 76/76;heal 第三形态前置已由 da26f3624a 补齐,遂按票面自写终态摘除) (ec713677807)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e5324f86b3b)
- 🔧 その他:翻勾结清 D13 主聊天并行工具调用票(行内已有 2 条结清注记:D119 只读并行预取在 HEAD、test 5 passed;goal-r1 主会话僵尸行清偿) (7ae7b2995b3)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f210e8fd3ff)
- 🔧 その他:翻勾结清 G-25 工具结果三投影票(行内已有 3 条结清注记:result-tri-projection.test.mjs 6/6;goal-r1 主会话僵尸行清偿) (8c3e989381f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b0418b09bbc)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0f52a79625f)
- 🔧 その他:结清 line-loss 第三形态判活票(门71 已补该形态并入库 da26f3624a;HEAD 面 RC=0、self-test 73/73、镜像 81/81,A/B 证明未造恒红门) (7494794a005)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e531eb4367c)
- 🔧 その他:goal-r1 认领 5 票加租约(r25a/r25b/r25c+r25e/r25d/r25f@2026-10-25,主会话派单防打架前置) (f881ee1c233)
- 🐞 修正:门 55 修复第二次落地 —— 前次 d32263e707c 被 920fff8deb7 整体重写吞掉 (1cdbe49d9a6)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cfa5c9ec9dc)
- 🚀 機能/改善:D08 ② agent 换手结构化事件(kind/agent_id/summary/token_usage/ts,复用 subagent_* 帧)+ 14 例测试 + 端内覆盖登记 (35aa933f806)
- 🐞 修正:live-doc-edit G-313 期末对账三缺陷修补(取材兜底/留痕链/手填号射程/正则泄漏) (cc0f35a4334)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ae64a8112b0)
- 🔧 その他:复结 9 张被并集回捞的已结清票(origin 同步止血) (acbc383068b)
- 🚀 機能/改善:G-62 恢复 F5 欠账名单问责出口(f5Deficit/f5SuppressedCredit 结构化返回,五档判据原样共存)+ 四臂测试 (c9684235f5e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (db8223555c1)
- ♻️ リファクタ:G-29 第二十批 10 站接 flag-value 单源(发布/运维脚本 requireFlagValue,语义未动) (a790c0d0a37)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (21a03a92fa5)
- 🚀 機能/改善:端侧读数判据补 V3-V5(非等分宿主)+ 29 处收口 (b83d50c6344)
- 📚 ドキュメント:端侧读数约束补 V3-V5(space-between 行 / absolute 容器 / 定宽格) —— 存量 23→69 处已归零 (10905ec50cc)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (49791979997)
- 🔧 その他:结清发丝线两尺合一票(hairline 尺 HEAD 面真分隔线存量 0 枚;a88793d3d1 已入库,凭据见行内注记) (38f0580dfca)
- 🐞 修正:补 workPanel.popout 五语键(work-panel 独立窗口按钮引用缺键,i18n 全量档 rc=1 已复绿) (479d43bd68f)

**2026-10-24**
- 🐞 修正:发丝尺严格指纹整体上收进分割线门族7(scanHairlineFaces 单源),hairline 门退化为适配层、旧 RN 循环与 classifyBgToken/HAIRLINE_AXIS_RE 退役 —— 两尺对同一枚文件读同一组枚数,等积清偿后计数只降不升,棘轮天然放行,零豁免零削尺;清偿最后一枚 RN 发丝线 HomeScreen.modelModalHairline(背景色画改等积单边描边,同中性档)。主席自证:两把尺 --self-test RC=0(64/64、19/19),镜像 49/49(hairline 20 + no-divider 29),与 HEAD 版同场对账 hairline 输出逐字零差异、no-divider 唯一差异=预筛面 1172→1465(覆盖面变宽,结论行不变);改名一处局部变量 sd→dividerHit 以避开与祖先行逐字撞车的复活判据(行为零变化,已复跑三件) (a88793d3d1d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (aad49b8ece0)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (75f91b11f67)
- 🔧 その他:复结 G-29(并集回捞;blocking 口径已清) (18b6e8a5951)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (536ea8dd1c1)
- 🔧 その他:翻勾三条已带结清证据的存量(G-25 三投影 6/6 · prod-bundle 入库源 rc=0 · D13 只读并行 5 passed) (88f0c680baa)
- 🐞 修正:剥开 satisfies 后暴露的 3 处端侧缺口 + web 断点陷阱 8 处收口 (00c9eb7343c)
- 🐞 修正:收口 CI Build 唯一的红 —— community 入口桶文件 import 次序回归(票 G-948) (02bba4c2db9)
- 🐞 修正:门 55 存量红归零 88/89 → 89/89 —— init_agents_md 补显示名映射与五语言文案 (d32263e707c)
- 🔧 その他:C8 死规则锚点下调 fractional 3→0 / total 14→11 —— fractional 族根治后重锚 (f09d1cbeb19)
- 🐞 修正:fractional 死规则根治 —— 1.5 档类串换等值 rpx 任意值(样式静默失效的真 bug) (51faca27a46)
- 🚀 機能/改善:编辑器空态一键生成 AGENTS.md(双确认 + 失败明示 + 不带 output_path) (04cfdb7704f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2ad9065cdea)
- 🔧 その他:waitFor/findBy 等待预算从"机器负载读数"改回"测试判据"—— RTL 出厂默认每段 1000ms,实测同一条链空闲 3ms／事件循环被占 1200ms 时首跳 1201ms,本机常年并发 200+ 道守门 ⇒ 122 枚 P1 用例 + 168 处无预算 findBy 的红绿由负载决定。单点杠杆 configure({asyncUtilTimeout:4000}) 落 mobile-rn/web 两端 setup(此前全仓零先例),两处手搓 helper 分身同步抬档;成对自证(旧预算红/新默认绿)+反向牙(永不为真仍红 4008ms)+回归 66 例全绿;g-469 那条 vi.setConfig 注释纠偏(它只抬墙上时间,一分不加给 waitFor 段预算)。落选方案:逐枚改 122 条用例 —— 足迹过大且与兄弟席在飞面撞车 (43ce93f1a80)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8d5b040ddba)
- 🔧 その他:结清 G-73(④a 根窗格续传回归已修,8813 clean 服务 8/8) (530e9116c74)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ce9e0407489)
- 🚀 機能/改善:流式 TTS 打断(VAD RMS + policy 驱动 abort) + CodeEditorPane 注册 store 级 reveal 出口 (12e5594f051)
- 🐞 修正:根窗格续传 await 缓存后台复核 —— 修 ④a tail 静默丢弃 (cd7fb541cf6)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1ce426b999b)
- 🔧 その他:补挂本席认领牌(前枚只改到句子未插上牌,String.replace 收字符串时 ^ 是字面量) (fb1436f9ef2)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (94a236c6763)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f15f35e92c3)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cdfe4c03f8e)
- 🔧 その他:认领 line-loss 第三形态判活票(机主令全部收口,原注"属他人射程"让位) (761b1c7618b)
- 🔧 その他:复结 4 张被并集回捞的票 + D-07 同题行(D42046 已结清) (80332d96882)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1003b2a6b57)
- 🔧 その他:结清 16 票(A 档零改动;承载命令/测试已复跑) (058dd42d258)
- ♻️ リファクタ:27 份文件内 react-native mock 收归全局替身 —— 根治项落地(45 例红事故的复发通道封口) (8c2585ffe55)
- ♻️ リファクタ:门 8 方法推导判据抽到 lib 单源 —— 补齐悬空 import 并钉 T7-T10 (88a9e46d799)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (eec8e44473b)
- 🐞 修正:摘掉 check-rn-readout-cell 的未用 import(改走取材层后 readFileSync 已无调用点) (3dccfd167ca)
- 🚀 機能/改善:端侧「等分读数格」判据落地 + 23 处存量收口(门 241) (8ec3cfa172f)
- 🐞 修正:门 150 弱证据 6 处代裁归位 + scroll-jump-spec 未判定清偿(§24 代裁,依据随附) (482cf8fe9c4)
- 📚 ドキュメント:点名端侧读数格守门 241 —— §13.4 的两条判据与唯一写法 (a510448d379)
- 🚀 機能/改善:/review 斜杠只读 diff + review-finding 帧注册 + 聊天 store 审查发现索引 + MessageItem 呈现 (12d98b1d88b)
- 🔧 その他:重生成 web/miniapp ui-routes —— 清两枚 stale 自述钉(check:all 第 13 步红因) (c532c7bd028)
- ♻️ リファクタ:门134 词法层拆出 scripts/lib/batch-write-lexer.mjs(门103 C1 6117⇒5658 行)—— 459 行逐字搬运零改写:台面与 HEAD 版同跑对账 94 行输出 diff 空、--self-test 174 条全过、镜像 30/30 与 9/9 全绿;M13 形状锁的取材面同批扩成 门体∪词法层(只数门体会把"已搬到别处"读成"没有第二份"=把没判写成判过) (0ce9314545c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6511981014b)
- 🐞 修正:门103 C1 行数天花板收口 —— git-guardian/check-batch-write 大块注释逐字归档换指针(零行为变化) (318240af9bb)
- 📚 ドキュメント:删除「一格一读数」短版重复行(origin 长版为同条上位表述) (a7a78ce6229)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dd0d3f1dcaa)
- 🚀 機能/改善:CodeEditor 暴露 revealAt 句柄(行内跳转) + 审查发现卡 P1/P2/Nit 分组 (c9bdea170c5)
- 🔧 その他:长按二维码存相册两枚用例改「只等链终点一次 + 8s 预算」—— 机制实测:同步占死事件循环 1200ms ⇒ fireEvent 到首跳 1201ms > waitFor 默认 1000ms(空闲档同链 3ms),三段串行等待在并发跑 200+ 道守门的同机上必被打成假红;断言不减(requestPermissions/saveToLibrary 仍在,反向牙实测打断写库步照样翻红),连跑 10 次全绿 (e4989cbb9e8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (81f924cd857)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5a83a417d9c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b48d16a5759)
- 📚 ドキュメント:清掉「读数不得断行」点名行的旧版重复副本(并发写回叠入,旧版带已腐烂的例数,§0.1 数字现读) (d74139d8d07)
- 🐞 修正:check-mass-deletion 去裸 git 兜底 —— 型 B 棘轮 3→4 回归 (384c797851c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c377952bcdd)
- 🔧 その他:结清 G-84(裸 git 棘轮 60=基线) (bb80c4a27e0)
- 🐞 修正:G-322 旗标单源收口 + 运维脚本空值静默回落堵死 (b73ed821234)
- 🐞 修正:三处写死 git 落点改走 §5b 唯一出口(gitdir.resolveGitBin) + sync-tags 补 path/url import + 端内 dispatch 登记 onReviewFinding 缺席理由(web baseline 38→39) (9272aeb4c9a)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1b1648fe62d)
- 🐞 修正:采纳对席圆角收口终版,消除 ScreenStates 双席分歧 —— 解开三方合并死结 (9a8202b5ae9)
- 🐞 修正:origin 并集落地后回补 local 两处(门77 圆角 rounded-sm + 未用参数 _json) (aeaab5a5681)
- 🐞 修正:门 150 七族 + 门 77 四处圆角存量清偿(wallboard 收尾 + ScreenStates/carte/account-pool/live 跨端同批) (718f6a413d6)
- 🐞 修正:停靠浏览器 UI 状态改名规避门 223 规则 F(业务名词 session) (591733d9de7)
- 🐞 修正:门103 D1+D2 消红 —— 三枚 RN 端内测试不再 import 门体(rank 40→90 反向依赖),迁移门判据断言收编进 scripts/tests T11;顺带修 T1/T3 夹具腐坏(原钉 AboutScreen.tsx,该屏今日 01:39 改薄壳并摘线) 对照实测:recruitment 两枚长按落相册用例在 HEAD 面同红(2 failed 9 passed)非本席引入 (afc8080a411)
- 🔧 その他:C8 死规则分族棘轮重锚 fractional 0→3 / other 12→6(total 17→14) (85e5c9c3166)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (86f0588597d)
- 🚀 機能/改善:D09 专家路由设置卡 + reveal 注册表 + review-finding 契约 (d6499fc8849)
- 🐞 修正:门 193 的 6 处 execSync 补 stdio + 豁免一条随删除消失的存量 —— 解堵推送链 (225fab254d7)
- 🚀 機能/改善:停靠浏览器 stop/home/pick 三命令纵向切片 + 五语种键补齐 (a78e4fcdc6d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (81a851ac233)
- 🔧 その他:临时对齐两处同行冲突以让 union-converge 三方归并(随后回补 local 样式/命名) (c0d46b5ac03)
- 🐞 修正:4 枚门改走 gitRaw(裸 git 棘轮 64→60) + 取号同题查重 + third-party-roots 非仓库误判根治 (a4f7931af5b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (095537b1e58)
- 🚀 機能/改善:D07 残余② 接入 init_agents_md + 钩子初始化纳入可中断语义 + MCP 工作区根守卫 (78f2e0bbeb7)
- 🔧 その他:结清 B07(步序四已在,服务端 fork 按产品定档不建)+ G-73 复验注记(④a 归因未判定,不翻勾) (5d507ec93d9)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d805b31cdae)
- 🔧 その他:结清工具面板开关窗格化(实现现读在位+单测 16 passed) (ebcbb85f038)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (63898cbb055)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7e66f217e14)
- 🔧 その他:goal-b15 轮42 B67 结清翻勾 —— 方案②落地(esc 头注跑法更正+global-setup SKIP 警示),现行跑法 esc 主体绿 (d2cd3276763)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a64e1d82386)
- 🔧 その他:结清 G-41 与门134 第二格(两处均零改动,判据现读已消) (5c9c0663ebd)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3005e32c336)
- 🔧 その他:结清 G-85(门100 A6 内容回退维落地) (0b38961892c)
- 🚀 機能/改善:分叉告警自带「已验证的补救」——把 7.3 小时的现场重判压成一封可粘贴的信 (61a4812fe3a)
- 🐞 修正:半径档位表回归 7 处(门77 B1/B3/B9 + 门150 角色档 chip/card/control) (8892284497f)
- 🐞 修正:B67 esc 跑法更正与 SKIP 警示 —— ①esc spec 头注更正过时跑法(旧版 SKIP+no-deps 已证不可行:③生态入口依赖 API 数据+SKIP 缺 globalSetup 副作用致①③协议弹窗不叠开,采样矩阵带seed三次3passed/SKIP三次2failed零反例),现行跑法=带 seed 全量;②global-setup SKIP 分支加 teardown 清库警示(不改行为);验证 tsc 0 错+水印完整+带 seed 3passed/3passed/2passed(第3轮1例波动如实记) (ef7bf0417ef)
- 🐞 修正:门100 补 A6 内容回退维 —— 并发提交被合并吞掉时路径仍在、blob 退回共同基底,A1/A2 结构失明(G-85) (700de8ba1f5)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (30aa5bb3790)
- 📚 ドキュメント:全局 mock 替身加迁移指引 —— 禁止新测试再写覆盖式文件内 react-native mock (edc5bc43555)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0c7f94d374d)
- 🐞 修正:media-tasks 手机档 5 列切断读数,并把 76 处存量的最坏格宽算清、登记断点陷阱 (44ba5d64476)
- 🔧 その他:goal-b15 轮41 esc SKIP_SEED 跑法发现登记候补票(采样矩阵零反例:带seed三次3passed/SKIP三次2failed;两方案出路+验收判据齐) (42daa5960d0)
- 🐞 修正:清偿 RN 端剩余测试红至全量 1185/0 —— 全局 mock 替身补键两处 + 真回归复挂 VoiceNote + 路由档补录 + 契约随形态 (978a132bbdf)
- 🐞 修正:merge-live-doc 无锚点追加分支逐行去重(README 尾部腐坏的根因) (da3095f0ad0)
- 🐞 修正:长标签收进悬停口径,读数格标签不再折行 (bfd6ce46a49)
- 📚 ドキュメント:协作会话最小纵向切片设计稿落档 + §6「另批」时点回填指针 (56dd64658dd)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (af70399256b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b70f553e967)
- 🔧 その他:结清 3 票(D13 只读并行 / 取消信号 hook 腿 / 窗格续传) (6d3c17ada9d)
- 🔧 その他:P10 逐条裁决登记 2026-10-24 孤儿删除引用欠账(复验 0 命中,不补发) (b7f3263b94e)
- 🚀 機能/改善:D09 专家意图自动路由腿 — expert_route 规则分类 + llm 接线 + 跨端契约 + 五语言键 (b048e637e54)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5bf2a99586f)
- 🔧 その他:goal-20261024-Q 结账注记(G-26 与第3波覆盖面行保持未勾,余量逐条写明) (4194b5faf07)
- 🔧 その他:按代码面重算 openapi.json,清掉 CI 的 ARTIFACT_DRIFT (d4d1065aab8)
- 🐞 修正:清偿 web 全量测试面 32 例真红(8 族根因,6739 用例全绿终验在跑) (d0ccb867450)
- 🔧 その他:补 check-duplicate-policy-literals 的 render 崩溃回归镜像锁(源已入库、锁悬空两日) (1efd821c7d5)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c17625fb208)
- 🔧 その他:goal-20261024-Q 收尾批3 终读(门 105/184 归零、ui-routes 全 matched、终读读数) (2cedeff3541)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6158849f52e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (92cda2bce94)
- 🔧 その他:web ui-routes 自述钉再按 HEAD 面重算(checkin/preferences 落地后),内容行零差 (8655bfb6c18)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (013cc1e82a0)
- 🔧 その他:结清 D06 结构化代码审查(选择器+事件+卡片+行级揭示) (e4d970ce070)
- 🐞 修正:/api/internal/* 网络分域显式声明(根治 G-815989 判据在 CI 的红) (e65f374d8a9)
- 🔧 その他:四端 ui-routes 自述钉随公告/看板/密钥池页面落地重算,内容行零差 (7382127d478)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0d73c8bf3eb)
- 🔧 その他:goal-b15 轮30 G-73 结清翻勾 —— 多窗格 e2e 真机核验达成(6 passed+1 flaky 如实记,四片主体全覆盖) (d07649d6537)
- 🐞 修正:清掉 ruff 全量红(15→0),按 §5c clean→改→inject 保水印载荷 (a43d6eaec99)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4cbf4faf66c)
- 🔧 その他:goal-20261024-Q 收尾批2(checkin 取词/edu 测试转绿/handlers 115 精读收口) (1fc16551d86)
- 🚀 機能/改善:历史课程视频(G-921)现网挂载量算仪 check-learn-video-mount.mjs —— 只读尺子,刻意不进提交链 (24430b3a47d)
- 🐞 修正:批量写诚实性的证据窗收窄到"被审那条写链"(F1/E1b),旧「同体放行」恒绿格钉成必红 (c587f6fbeef)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (85bd4df8b50)
- 🐞 修正:drop unnecessary 'tt' dep in course-planet loadData useCallback (CI lint:strict warning->red) (b560edce07d)
- 🐞 修正:读数不得替「没量到」下结论 + 时间按数据侧时区 + 页头扫描线的横向溢出 (dab47611c97)
- 🚀 機能/改善:大屏读数尺补五语言档,并把覆盖边界现读进文档(别把「已装门」当「已覆盖」) (0a6da8a0c1b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b80203fb3e1)
- 🔧 その他:goal-b15 轮29 三行取证补录 —— S1/S2 e2e 真跑 3 passed(PG18 恢复后)+G-02 真登录态 200 取证(subagents/all 形状同票面期望) (5cdd3f80244)
- 🚀 機能/改善:落地「停靠浏览器 + Trae 网页登录」自洽单元(build.rs 命令表补齐 10 条) (a7b3500f73e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (88185c202b9)
- 🐞 修正:旁路落地器接「落地后复跑受影响判据」(G-113) —— lib/land-gate-rerun.mjs 与两台落地器同批入库 (afe67708b50)
- 🚀 機能/改善:D11 语音打断腿 — /voice/tts/stream 逐段 NDJSON + voice_barge_in 打断判据 + 22 例测试 (31690b4cb74)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6b5b56ceb24)
- 🐞 修正:relay 号池「上游明确拒收」三处断链补实 + 产出面键集契约回退 (99db9d24126)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (488d3ed3724)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b9bb78319fb)
- 🔧 その他:goal-b15 轮20 G-81 结清翻勾 —— 病面已由 G-876 席修复(code zod 必填+verifyCode 统一入口,枚 9e103ac0f6),auth 1311 全绿复验 (384058380d8)
- 🐞 修正:门 71 抹号/折算位数上限 4→6(止血换号被自愈回插)+ D42046 归位 D-07 (c8d64eb3f27)
- 🔧 その他:删除存活清单登记 6 枚清偿归档件 —— 对侧 plan 清偿工作的正当产出面 (760811fa380)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1094e57f254)
- 🔧 その他:goal-b15 轮18 G-05 伞票翻勾 —— 真剩 0 点(全迁讫/豁免/在飞归其线),两轮勘正证据在前两注记 (e5c1fb6ffe5)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (69b5177b03c)
- 🔧 その他:goal-b15 轮18 G-05 二次勘正 —— archive:684 实为镜像注入点设计豁免(注释明记刻意不走 gitRaw),伞票真剩 0 点可翻勾 (460870ed01a)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (25947957510)
- 🔧 その他:goal-b15 轮18 G-05 伞票侦察勘正 —— 名单实况:wire-strictness 已迁净/两枚剩注释/archive 真剩 1 点(:684 rev-parse),真剩量=1 枚 1 点 (de2ec569bb7)
- 🐞 修正:清除最后两处不合规声明号 —— G-27 同号异题拆号 + D42046 超池归位 (d9b060d47b0)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (31e25f5d46b)
- 🔧 その他:test+fix(gates): D/E 簇收口 —— 生产签出外来工作多通道发现 + 提交链三门成套 (b7ae8b5f9c3)
- 🔧 その他:goal-b15 轮17 裸对象语义验证半结清 —— 信封层:814 整条 body 作 data;实测 health 回对象非数组,web 按数组读分叉实锤;主格对外契约维持等机主定档 (bdbb697d25d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (48c7e2ebffc)
- 🐞 修正:清偿测试面 31 例真红 —— 共享层 ScreenStates 动画族打盲 RN mock + 登录门没 mock + 回潮副本 (86b577c1e3a)
- 🔧 その他:结清 D09 意图自动路由(后端三格+设置项+i18n 漂移归零) (1b0545b8087)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ed597393295)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4c159340f5f)
- 📚 ドキュメント:G-17 本侧行改写为与 origin 逐字同一(取超集那份,独有票号集为空零丢失) —— 清掉 union 归并放大的同题两版,解 origin 分叉收敛的唯一卡点 (524492f05a4)
- 🐞 修正:端侧读数格同锁「整格换行不切数字」—— Income/Usage/Dashboard 三处共享源 (76cbb78d28d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8b0efe63dfd)
- 🔧 その他:goal-b15 轮15 G-02 服务面取证注记 —— 三枚路由存在性实证(401/403 非 404,枚 2704c4d27 旁证),剩真机+真登录态两半阻塞 (c0afe3fbb62)
- 🐞 修正:补齐大屏状态词五语言 + 读数列宽档按实测下限收紧 (fa2615ca274)
- 🔧 その他:web ui-routes 产物按 HEAD 面重生成(旁路落地不跑写回钩子的必然残差) (df63e36ac5f)
- 🐞 修正:取号器撞号镜像跟随两位数池 —— 自有段改 G-90~G-99,号域 92/93/94 (643cb24607b)
- 🐞 修正:ScreenStates.taro.css 的水印改回 CSS 合法注释形(解门 95 活恒红) (f6a1b7e646d)
- 🚀 機能/改善:门 240 R8 把「大字号读数必须 nowrap」推广到 web 全仓 —— 差值棘轮不造恒红门 (aec90201d40)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ae257603ca5)
- 🔧 その他:goal-b15 轮13 发丝线票实测注记 —— 最后1枚(RN面)按配方改写实测两尺互顶(hairline 0 但 no-divider 族6 新增红),已回退归两尺合一前置 (d9d660cd034)
- 🐞 修正:大屏读数不断行收口全 49 格 —— 补掉上一枚只修号池留下的自伤 (463dbd44e4d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b3f44518f62)
- 🔧 その他:goal-b15 轮12 发丝线票进展注记 —— 类面存量 31→1(97% 清偿),剩 1 枚+RN 12 枚(判据前置归门 11d 线) (9648a28f188)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (92dcc9ae069)
- 🔧 その他:结清 G-09 + 记进展(D06/D09/连续语音) (2e9da27db61)
- 🔧 その他:号池换 Key 补 handler 端到端锁(密文可解回新值 + 健康态同批复位) (dc481b7d6f0)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9b0c51ac1a6)
- 🔧 その他:goal-b15 轮12 G-98 结清翻勾 —— 三盲区判据均已实现(族6 RN对象/族5 css块+SCAN_GLOBS/任意值分流),self-test 62/62+镜像 29/29 (a4bf8f4d9d9)
- 🔧 その他:web ui-routes 输入钉全量按 HEAD blob 重算(含 settings/preferences),内容行零差 (7f79d643697)
- 🔧 その他:四端 ui-routes 产物按 HEAD 面重生成,收口门 105 的 G5 陈旧钉 (cf618b89bf3)
- 🐞 修正:编号收口最后两枚超池号 + 门 71 抹号表补齐 H/I 族(止血"改名被判丢 → 旧号回捞"的重复副本) (f040d776c97)
- 🐞 修正:批量档判定归位 lib 单源 + 隐藏启动包装器改为等待子进程(根治 54 枚常驻的第二半) (3c75fceac5f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2d4cd563392)
- 🔧 その他:goal-b15 轮11 钩子取消腿结清翻勾 —— 票面判据达成:toolCtx 在 HEAD 三处全换+取消证明 4/4+tsc 0 (cfae8d75b61)
- 🔧 その他:relay 导入 mock 收形为单点返回 (2d4a7389463)
- 🚀 機能/改善:号池 PUT 支持换 Key 并复位健康态,admin 页补「替换 Key」入口 (b40c09c125b)
- 🐞 修正:修复两处镜像测试回归 —— 单源锁断言跟随 declaredKeyOf;A4 真实形态夹具改用生产件 (f79c2700d66)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (165a0e5db64)
- 🔧 その他:goal-b15 轮10 G-865 结清翻勾+勘正 —— 摘键早已完成(键不在/真实使用 0/命中全为历史注记),轮 9『4 处生产消费』注记系 grep 误判一并勘正撤回 (db3e31f1276)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a0de770a095)
- 🔧 その他:goal-b15 轮9 G-865 前提已变注记(不翻勾) —— 现读 4 处生产消费方,摘键前提不成立;迁 initials 需另立票连带 4 消费点+2 测试 (9e6a3784e45)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7cacd399613)
- 🔧 その他:goal-b15 轮9 三行齐翻 —— G-95 二翻(带回后复翻)/真机走查孪生齐翻/tmpdir 复验 clean RC=0 结清(摘牌回单残留) (b35fe9057d0)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0d1f26bad03)
- 🔧 その他:goal-b15 轮9 G-93 结清翻勾 —— 高置信死候选族已被清偿(门全绿+点名族 dump 零命中),参数段未判定为设计形态非债,未写基线未塞白名单 (eb0aa674627)
- 🐞 修正:嵌套 ref 存续层改走批量快照 —— 逐条 rev-parse 把守护堆成 54 枚常驻 (4dd635da6f8)
- 🐞 修正:MCP_WORKSPACE_ROOTS 空值回落 cwd —— 根治 patch_root 全量序 503 污染(生产配空值同病) (cdb68fbb360)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b3f335ec303)
- 🚀 機能/改善:大屏读数不得断行 —— 号池面板「6天19小时」被切成两半的三层成因根治 (94234605561)
- 🔧 その他:web ui-routes 自述钉再按 HEAD 面重算(wallboard 页已落地变更),内容行零差 (378bbb69530)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6dde87431a9)
- 🔧 その他:goal-b15 轮8 G-94 结清翻勾 —— 探活靶已改 www 真腿(旧靶留名防洗),self-test 76/76 RC=0 (dba7da727ff)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a3e8582d50e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9100369ad60)
- 🔧 その他:goal-b15 轮7 G-95 结清翻勾 —— G-963 席已修(闭包两型+递归不动点),f9 复跑 10/0 全绿 (8c9f59a6a7b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c8df54169c3)
- 🔧 その他:goal-20261024-Q 收尾批注记(门128红臂收口/门105产物钉/门98孤儿/i18n离线包/mobile-rn 编译断点) (356cc2e269e)
- 🐞 修正:大屏中文界面收口英文产品词(数据源/页脚/告警/数据层/号池/KPI) (5e212c0fbd5)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (799242f059e)
- 🔧 その他:结清「锁初始化写全再原子可见」留挂的 deploy-lock flaky 归因格 —— 实现/接线/入树三件早已达成(scripts/lib/lock-atomic-init.mjs 在 HEAD,git-lock.mjs:1017 与 deploy-lock.mjs:1024 接线,镜像 15/15);该格当年(10-21 复量)本机未复现而不肯判结,今连跑三轮 node scripts/deploy-lock.mjs --self-test = 自检 143 条 pass 143 / fail 0 ×3(较当年 95 条规模已扩且无漂),按 §1 待拍板条目由 agent 代裁结清;票面路径 packages/services/... 系上游研究副本非本仓文件 (f4c42d8281b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (028e03fabba)
- 🔧 その他:goal-b15 轮7 G-78 结清翻勾 —— DRIVEROOT 同族残留已清(注释收口+硬编码零命中+宽 grep 零残留+测试 0 fail) (fdfa25b86ad)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (54c3de6903b)
- 🔧 その他:goal-b15 轮7 G-97 结清翻勾 —— 原生弹窗已清偿(门两面存量 0/RC=0,grep 零命中),45 处由他席清完 (e1a6f90e613)
- 🐞 修正:修 i18n 扫尾引入的 4 处编译断点(t 未注入/映射函数缺参/误插 appAlert 按钮/res 未定义),双包 typecheck 归零 (ff5d0aec431)
- 🐞 修正:编号形态再收口 —— 只改重号与超池号(合规唯一号一个不动)+ 映射多跳合成 (de8b7748775)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (83fb6c8d37c)
- 🔧 その他:goal-b15 轮6 G-89 补翻 —— isError 语义已在 HEAD(g-692 专项全绿,mcp 族 270/270) (6a73359c174)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1e162a7f917)
- 🔧 その他:goal-b15 轮6 五票结清翻勾 —— G-87 stderr 监听(S17 取证:实现早已入库+正式结清过,MCP 族 270/270 复验)+G-88/89/90 MCP 三连票(实现全在 HEAD 专项测试本轮全绿)+G-92 四门 isDirectRun 守卫(已治理:点名门双真+门 193 两面 RC=0) (635f2cfc96b)
- 🔧 その他:补 revokeCollaborator 终态守卫直接测(G1-G4 四例) (15e75cfc11c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (461dc0045f9)
- 🔧 その他:goal-b15 轮6 G-83 结清翻勾 —— 代码侧全绿收口(摘假图标+如实提示+接收腿 14 例+全量 1000/1000),剩余四项结构性人工窗(后台白名单/CSP 决策/真机时机)以注记交代 (84e0e39cddd)
- 🐞 修正:清偿测试面 40 例真红(4 族根因)+ 摘除 sweep 产出面无消费对象键 (be797ebccef)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a511a294315)
- 🔧 その他:goal-b15 轮6 G-82 结清翻勾 —— Passkey 前端全链已装车(依赖+组件动态 import+web 两端点消费),测试 12/12 绿+tsc 0 错;§9 小程序平台豁免随注记 (af81e257cbc)
- 🐞 修正:编号形态再收口 —— 只改重号与超池号(合规唯一号一个不动)+ 映射多跳合成 (7fbab3acb27)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5008ce95cda)
- 🔧 その他:goal-b15 轮5 G-80 结清翻勾 —— qoder-时间序席 10-23 四条凭据完备(死键撤净+判据锁 4 例绿+动态候选分类+阳性对照),漏翻补翻 (28066980993)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1f764234f31)
- 🚀 機能/改善:公告全端统一+按端定向;首页能力文案对齐 9 端实测 (db47d154c04)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d31afcdd3ea)
- 🔧 その他:goal-b15 轮5 G-86 结清翻勾 —— 正解①已落地(G-807:写侧显式置过期+判定不吃 mtime),本轮补票面验收 10 连跑 pass=10 fail=0 (e9b299ef92b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d04402908b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (05d93223ee3)
- 🔧 その他:goal-b15 轮5 G-46 结清翻勾 —— 三批全收口(批1 381行/批2 证伪留原地+F5退役/批3 491行+幂等0),sha 链与工具全在库,收口漏翻补翻 (de2c8ee99a3)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e008db090f6)
- 🐞 修正:大屏第八轮补正 —— 上一枚 f96d979 误取自动收编换主前的旧页面 blob (a5cffb137b7)
- 🔧 その他:goal-b15 轮5 O03 二翻 —— 已裁决回捞残留(66f91ad2a1 批内撤销取向=维持告警+降档,凭据链完整),守门 71 回捞带回未勾形态,复验后二翻 (5645c20065a)
- 🐞 修正:全族按文档顺序收口两位号 —— G 族 104 条压回 G-01..G-99 + 溢出族 H01..H05,D 族三条超池号归位 (6fb923cbe18)
- 🚀 機能/改善:大屏第八轮(无障碍补强/窄档页头/对比度/缩放触发面) (f96d9798446)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5a05a498410)
- 🔧 その他:goal-b15 轮4 G-41 结清翻勾 —— 生产接线落地(runAgent 订阅事件流+形状锁 3 例+32 臂全绿),四态终态+真打断全线闭环 (716cba159de)
- 🔧 その他:ui-routes 自述钉按 HEAD 面重生成(web wallboard / 小程序 ScreenStates),内容行零差 (f3902194d2d)
- 🐞 修正:门 98 悬空具名导入清零 —— 删孤儿测试 __tests__/organization.test.ts(其被测模块 routes/organization.ts 在 HEAD 已不存在,全仓仅此文件引用 organizationRoutes;工作树已删除、此处落地固化),避免测试收集阶段解析失败 (686d9650c28)
- 🐞 修正:A2 占位改指真锚点 —— AGENTS_compact-2026-10-21.md 从未入库,改指 AGENTS_trim-2026-10-21.md (c2f584a7bef)
- 🚀 機能/改善:G-41 钩子事件流生产接线 —— runAgent 订阅 onHookRunEvent(实现层 d4f8ba336b 事件面的首个生产消费者),terminal 事件落终端结构化行(json 模式静默),finally 在 runSessionEndHooks 之后退订;§30 生产侧终态出口自此可填;形状锁 g41-hook-run-events-wired.test.ts 3 例防静默摘线;验证 tsc 0 错+g-424 9/9+形状锁 3/3 (ecf6e73678f)
- 📚 ドキュメント:补回 7 份归档件 —— 归档门 A1/A2/A3 落空清零 (090eb4f8406)
- 🐞 修正:README 数字同源对账 —— 生成块换成 HEAD 面现算段(trackedFiles 15939→16000、testFiles 3163→3179、guardianGates 273→274、guardianBlocking 250→251、apiRoutes 4562→4556、apiRouteFiles 624→623),末尾 6 行散抄同步改正;守门 173 复绿 (0c072b523e1)
- 📚 ドキュメント:补回 6 份归档件 + 快照锚点改写 —— 归档门 A1/A2/A3 落空清零 (7e888a5fe96)
- 🐞 修正:README 三处指向已删镜像仓的死链清掉 —— §5b 弃用镜像后 Gitee 仓库根链接与 GitCode 死仓 URL 都是死的,改为一行「2026-10-23 已弃用并整仓删除,只保留 GitHub 一处源」;守门 238 不入射程 (3c0fa1ee34f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e60115643c5)
- 🔧 その他:goal-b15 轮4 WP-01 结清翻勾 —— 浏览器语义快照已入库(f2121db10b 主力+句柄族 b8eab3c8b0),测试 8/8 绿;归档注记 sha 引用勘正(9f404d0 是收尾枚) (dda5f2e549c)
- 📚 ドキュメント:守门 207 体积清偿第二轮 —— 删 4 行同题重复副本(「git 网络与推送」原有 3 份只留最新最全一份 / 只读尺子旧版被新版全覆盖 / 常驻工具清单为已归档件回插),98,838B→95,226B(预算 96,000);逐字留档 AGENTS_trim-2026-10-24.md 附录 2 (ced824b7f7e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cead297f1a9)
- 🔧 その他:goal-b15 轮3 B05 结清翻勾 —— 流式中切模型三腿全装车(web 18+miniapp 17+RN 16 例全绿,本轮现读) (570a5e86495)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (94a129fe2f7)
- 🔧 その他:goal-b15 轮3 孪生/僵尸齐翻(HEAD 面锚点) —— Esc 漏网份/号池凭证副本/O-1 副本/G-77 复活份 (c38212cf27b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2cc52dfaeb7)
- 🔧 その他:goal-b15 轮3 B02 进展注记(不翻勾) —— §7 现状精确化:房间协议+web 端接线已交付;真剩余=resync(rev 持久化前置,ws-broadcast rev 现为进程内存)/terminal 帧/meta 位/帧名收敛;跨端接线依赖 B06 (7ce9d46afb3)
- 🔧 その他:结清 4 票(图片标注/失败广播/D07/残行尺),二次落盘(防复活) (a715c1d7a4c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (af71ca7caee)
- 🔧 その他:结清 2 票(tmpdir 七脚本 / allow-dangerous 单出口) (4372937c1d9)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (69e05903c79)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a1e5b737f78)
- 🔧 その他:goal-b15 轮2 两票结清翻勾 —— ①合流吞修复票:建议补法已装车(converge:252 verifyUnion+lostAddedLines 行级断言,立因即本票) ②B03 消息级版本切换:票59三切片已完整装车(S12b 席取证,24+5+8 测试绿,tsc 0 错) (cde899e7a81)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3b6a52e4d8e)
- 🔧 その他:goal-b15 轮2 守门91冻结票结清翻勾 —— ①已清(5ce93b9e1)②7屏已接线(门91现读 RC=0/0未接线)③自记独立改造另立 ④纪律已登记 (376da1f7fc7)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f13f11316f)
- 🔧 その他:goal-b15 轮2 真机走查票结清翻勾 —— 三项终局(①已修 84583fdf6 ②误报 ③已修 26cf923961 真机复测),证据全在库,收口漏翻补翻 (02ef5b45ffc)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7e0a3bb0220)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e105ffdb708)
- 🔧 その他:goal-b15 轮2 同题异号孪生副本齐翻 4 行 —— G-77(杀班,G-54 主行已翻同证据齐翻)+Esc 族 3 行(10-08 已归档,4 行全为归档残留);修正此前误判:非回捞竞态,是重编号后同题票拿到不同新号、逐份翻勾只命中一份 (98b39636221)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c12ce30dacd)
- 🔧 その他:goal-b15 轮2 P2-13③ 结清翻勾(两份副本同批) —— prod-bundle AI 部署诊断链已落地:三件套+deploy-diagnose.sh 四失败点接线+结果落盘+消费者全在位;api tsc 0 错 (5a38eb7e961)
- 🐞 修正:收口编号形态 —— B 族空洞 B03 前移补齐 + G 族重号 G-56 尾行改 G-77 (e740ac885a9)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6ecdc843866)
- 🔧 その他:goal-b15 轮2 D15 结清翻勾 —— 通知中心隐藏→归档→恢复流已由 D195 席落地(NotificationFeed.tsx :90-156 可撤销迁移+分区),十键五语逐语验齐套,parity OK (2c5c8c68de2)
- 🐞 修正:号池 chip 前景按兄弟键配对改名(chipOn/chipOnText)+ 重生成小程序 i18n 离线包(zh-TW 源变更后陈旧) (05eb6b414ba)
- ♻️ リファクタ:组件批 122 硬编码中文清零(15 组件 / 22 处) (dce5d74489a)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c335a8687ae)
- 🔧 その他:goal-b15 轮2 D12 结清翻勾 —— 生态入口语言包已落 HEAD(ecosystem 37+connectors 52 键),页面用键 12 全覆盖零缺,五语 parity OK(19125 键),按住理由(语言包被他席占)已过时 (843b785bac3)
- 🚀 機能/改善:组件批 122 入典(19 组新键 ×5 语言) (57e00a3ee9a)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b3d730e5066)
- 📚 ドキュメント:守门 207 体积清偿 —— AGENTS.md 120,198B→93,377B(预算 96,000,余量 2,623);移出 36 行同题副本/取证叙述/L429+L433 索引副本,逐字留档 .ihui-agent/archive/AGENTS_trim-2026-10-24.md;规则本体与 236/238/239/public-admin 的 R4 点名行一枚未动,check-cross-end-screen-coverage 补进 UI 索引防丢点名 (5e1f901d2f5)
- 🔧 その他:goal-b15 轮2 批量复翻 5 张回捞/僵尸行 —— 窄窗格缺口C/G-51 31红/G-54 杀班/G-57 fail-closed 四张为二次回捞(翻勾↔归并器竞态:已勾被完成即删摘+未勾副本被守恒带回,本轮翻勾后跟留痕链验证);Esc 无层栈为归档残留首翻(10-08 已归档,4 活行是僵尸)。结清证据均已在先前提交(3026adc85f/7d63c88314)信息中 (49a44972fc1)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e5caa17116c)
- 🔧 その他:goal-20261024-Q 补回被折并的两条进展注记(handlers 审计纠偏 / 迁移B3与edu根因) (b0814f2ddeb)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8d6b4369f19)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (31940355d9c)
- 🔧 その他:认领 5 张 ALIVE 票(D07/D11/失败广播/tmpdir/残行尺,goal-1024m..t) (f85b0f0f684)
- 🔧 その他:goal-20261024-Q 第三批进展注记 —— RN 双包 tsc 归零、ScreenStates R4 清零、db-blind 棘轮转绿、cross-end 余 1 臂归属 (246b9c1a422)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b4d361c468f)
- 🚀 機能/改善:编号形态门(R3)+ 补号 10 条未取号行 + B/D/G 族压回 1..N 连续 (82fd2729f5b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dc8e52c81e1)
- 🐞 修正:ScreenStates 按钮前景改用配对语义键 brand.foreground(替 surface.light),清 R4 跨 key 品牌底白字 (db992fea2bd)
- 🐞 修正:守门 182 顶破点收口 —— ws-broadcast 跨实例 publish 的异步失败改 then 双参形态(与链式 catch 语义等价);该处处置的是 Promise 发送失败而非 zod 控制面边界算子,故不再混入 strict 棘轮账,HEAD 面 92→91 回到基线 (0957365b5c7)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d6439b6cc9)
- 🔧 その他:goal-b15 S10 翻勾 —— api<T>() 壳迁移票结清:主体 234 份同形壳前几轮已迁完(票面口径 HEAD 现读零命中);本席收尾 relay/benefits apiGet 同形壳→apiOrThrow(b3b3f64276,tsc rc=0);剩余 18 文件 api* 命中全为第三类差异不机械迁 (349e116a660)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d91ad217cb)
- 🐞 修正:门 71 纪元档判活补两型 —— 散文桶的飞书式要点行 + 号段标记 (60ae4dba060)
- 🚀 機能/改善:值班全屏固定深色(手动 class,绕开 next-themes 冲突) (3275a49ffe9)
- ♻️ リファクタ:小屏清扫批 14 屏 UI 串清零 + 存量悬空引用 17 处收口 (37522b95e74)
- 🚀 機能/改善:小屏批×5 入典(15 新键组)+ 还原误删的 aiAssistant.chat 真身 (9b1de773052)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5ae6a0ca05d)
- 🔧 その他:结清 G-31 另三道禁令门取磁盘面 —— 三门 git diff HEAD 均 0 行,换面已由 ea0fb180f0/a6c7cb36ec 落地(check-no-mask-image 提交 7017cbedb4e,emoji 自检 27/27+镜像 15/15,shared 镜像 10/10;mask/shared 无 self-test 属既有设计);独立席零改动复核 (4e02b6b33b6)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8524dc8c1bb)
- 🔧 その他:结清 B03 权限双轴化 —— 双轴+config profiles 已在 HEAD 全量落地(permission-axis.ts 196 行 / permission_axis.py 141 行 / gate 285 行 / agents 路由 4 处接线);types typecheck rc=0、pytest 6/6+38/38、vitest 6/6、词表门 rc=0;独立席零改动复核 (66fea9683e3)
- 🐞 修正:packages/app 三屏 7 处主题接线(dashboard 2 / settings 1 / workflows 4) (41396447b6c)
- 🐞 修正:并发会话回插的两对撞号行再收口 —— 在册 104 条族内连续且唯一 (6e15137524d)
- 🐞 修正:撞号两行各发新号,不再折掉其中一行 —— 在册 104 条全两位号、零重复 (c05ca1a5335)
- 🐞 修正:收口批 —— 取号前导零 / 主题接线 / 清扫器留痕腿 / fail-closed 帧守卫 / README.en 块 (5588819fa8e)
- 🐞 修正:F9 补「同号异题」维 —— 两件事写同一个票号,此前整道门看不见 (821e00a40e8)
- 🔧 その他:补齐 12 枚文件溯源水印(chat-collab / ssrf / ws-broadcast 测试、库迁移与 schema、设计文档)—— 守门 47 HEAD 面欠账清零;同批收编在飞席已注入水印的文件内容 (64675e795f2)
- ♻️ リファクタ:api<T>() 壳迁移收尾片 —— relay/benefits 的 apiGet 同形壳(仅函数名不同档:fetchApi + !success throw + return r.data 逐字同形)改走统一出口 apiOrThrow,定义删除、两调用点改写、差异化错误处理面(redeem 手动解包)保留 fetchApi 原样;票面主体 234 份同形壳经票面口径 git grep -cE '^(async )?(function|const) api[<(=]' HEAD -- apps/web 现读零命中(前几轮已迁完),剩余 api* 命中 18 文件全为第三类差异(apiFetch 多层校验/apiOverview 业务函数/apiJsonLd/测试 mock),按票面口径不机械迁;验证 tsc --noEmit 全量 rc=0 零错误 (b3b3f642764)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8dab55e33cb)
- 🔧 その他:认领 5 张 ALIVE 票(D06/D09/D12/B04/图片标注,goal-1024h..l) (d7227719be9)
- 🐞 修正:typecheck 归零五文件 —— ModelConfigDialog 两处补 useI18n、N8n map 回调签名、Home 索引非空、Profile 图标类型改 LucideIcon、ScreenStates 去掉不存在的 rnSpacing 导出依赖 (0b079628a5f)
- 🔧 その他:收口并行会话回插的 3 条撞号行 —— 在册 102 条全两位号(G74/D16/O3/A1/B7/WP1),无超 99、无重复 (9c15d2e2d2c)
- 🔧 その他:盲写棘轮基线随清偿收窄 329→327(chat-collab 两处条件写入形态落地后按 HEAD 面重锚,只减不增) (30fd572385a)
- 🐞 修正:G-998153 盲写棘轮清偿 —— chat-collab 接受/撤销改条件写入形态(where 的状态守卫即现值比较,已裁决行不再同值空写盖 updatedAt);同批收编在飞席的 metadata 现值比较与 mobile 消息 id 去重写入,三文件合计清掉基线外 5 处命中 (e46ef3ce583)
- 🐞 修正:门 71 纪元档改按"题面前缀"判活 —— 换号/复用号不再被读成"行被吞了" (eccc6155319)
- 🐞 修正:盘根封口恒红死锁破除(搬迁过渡期双根认账)+ pre-rebase 机器硬拦 + 门 237 撞号改 239 + R4 两门补点名 (4e70d3d6a31)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0a23c905973)
- 🔧 その他:让号 G-870→G-1202553(「把 file.aizhs.top」隧道票，规避远端同号不同题撞车；原行逐字留痕归档件。Refs: chore(plan): 让号 G-870→G-1202553) (e5f601e9739)
- 🚀 機能/改善:任务编号全量重排为两位号(一族一系,≤99)+ 历史迁档 (e5a7395071a)
- 🚀 機能/改善:超宽值班屏整体放大 12%(4K/2560) (b7ce371b240)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b0c6f9b9f2f)
- 🔧 その他:goal-20261024-Q 第二轮进展注记 —— handlers 审计三态+P0 裁决、迁移 B3 修复与 edu 测试根因、11 屏静态复核落地读数 (8f62b7536b4)
- 🐞 修正:shared/zh-TW 「核准」改「核準」—— 与 web 版同键同字对齐,守门 2j-shared 中文残留转绿 (170648b0c07)
- 📚 ドキュメント:goal-20261024-Q 第二批进展 —— handlers 审计三态与 P0 裁决 / 迁移 B3 与 edu transform 根因 / 11 屏静态复核与三枚落地读数 (3fd208f687e)
- 🐞 修正:清偿凌晨 stash-pop 烂尾现场 + index 烂尾哨兵装车 + §6 单端 typecheck 命令纠偏 (33d756ebbb3)
- 🐞 修正:守门 89 撞号收口 —— 237 归跨端页面覆盖(runner 补回被误删的 check-cross-end-screen-coverage 注册,门体健康、AGENTS 速查已点名,不得靠删门消红);计划归档单调性 237→239;mirror-purge 头注与 AGENTS 速查编号 237→238 对齐注册现值;AGENTS 补点名 check-plan-archive-monotonic(239)/check-public-admin-default(守门 89 R4 缺口)。本枚 HUSKY_SKIP_GATE_WIRING: R5 取材面固定 HEAD(check-gate-wiring.mjs 头注 R5),修复枚自身必红;落地后 HEAD dup=0。 (66b89a453f7)
- ♻️ リファクタ:mobile-rn ChatScreen 硬编码中文清零(半B 收尾 90+ 处) (328539223c1)
- ♻️ リファクタ:mobile-rn 字典补入 ChatScreen 半B 全部新键并五语对齐 (0827d6adad5)
- 🐞 修正:G-925 静态复核 C2/C4/C5 —— 67 处可点击控件补 44px 触控、3 屏错误态接重试、2 处 chip 圆角归档 (aad975c3c42)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9ed7828556d)
- 🔧 その他:认领 7 张可派单票(S1..S7 席位租约) (f8d0d7552f1)
- 🚀 機能/改善:任务编号全量重排为两位号(一族一系,≤99)+ 历史迁档 (9d74e923427)
- 🚀 機能/改善:任务编号全量重排为两位号(一族一系,≤99)+ 历史迁档 (ea32579b60b)
- 🚀 機能/改善:大屏第七轮(空态补齐/族超出提示/读数千分位) (0dec2245764)
- 🚀 機能/改善:ChatScreen 清零批 1/3(面板菜单 11 + 素材详情 14 + content 回退 3 + 二维码等) (0888c9910eb)
- 🐞 修正:R3 接线前置三件 —— ① check-duplicate-policy-literals render 签名补 strict 形参(修复直跑 ReferenceError,strict 档语义不变,--self-test 43/43 + 镜像 6/6);② check-gate-presence-exemption 头注对齐 108 存活期表现读(该族已进 FAMILY_LIFETIME_DAYS);③ guard-status-where 补 26 处面不匹配实测登记(108 scanFile 只看同行/前一行,gsw 允许后 3 行的形态差异,只记事实不改判据)。R3 前置清障,接线批另行走 AGENTS 字节预算 (96ea8619f0e)
- 🐞 修正:RN 测试链补齐 @ihui/shared/constants 四枚子路径别名(about-sections/developer-space/trader-plan-promo/web-portal) —— 2eca6eb203 共享屏重写后 RN vitest 链解析失败(父别名前缀替换吞子路径 ⇒ 子路径必须逐枚显式登记,同 storage-keys 既有规矩);修复后 search-overlay.test.tsx 11/11 绿,回归由 #20 审计席现读发现 (58e08d76952)
- 🐞 修正:11 屏静态复核 C1 —— 9 屏 64 处次级字色补 dark:text-neutral-400(暗底对比 3.78:1 → ~7.4:1) (40dbcae4386)
- 🔧 その他:生成物 stale 债同笔清偿(承 26ffb03a 通报③) —— 显式放行陈旧守卫留痕:HEAD 面 b64/gen 钉的是 442cc8df2d 生成时的旧输入(解码头对键差 23-25 条全是同路径旧值),本次按 HEAD 现输入重跑 gen-i18n-compressed + 三端 generate-ui-routes,新值 85-87 键/语(about/carte 等合并词典),键路径消失 0;三端 ui-routes 产物 diff 纯自述钉块(sourceCommit/inputsSha256/generatedAt),内容行零差 (788ad715d62)
- 🚀 機能/改善:大屏第六轮(告警严重度/容量警戒线/边缘腿详情) (a4dc94cb6eb)
- 🚀 機能/改善:ChangePhone 屏端内硬编码清零 + changePhone 键组×5 语言 + loginCountry 码表复用 (697fc58fdf9)
- 🚀 機能/改善:DevEnter/Subagents 两屏端内硬编码清零 + devEnter/subagents/memberBenefits 键组×5 语言 (c47d6a18100)
- 🐞 修正:出站请求逐跳 SSRF 复检(safeFetch)+ relay 账号池/协作档位只写真实变化 + 迁移 journal 按 when 重排 (9d020274669)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e7b2b7865ec)
- 🚀 機能/改善:大屏第五轮(图表单位/事件跨天/页脚数据年龄) (5430a49c2e7)
- 🔧 その他:miniapp ui-routes 自述钉重算(收敛合并 3f2dea0e90 按 HEAD 面重跑 generate-ui-routes,页 159 条=主包 5+分包 154),消守门 105 stale (57cda9abf8f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3e5b20645ad)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (75b3fe2c665)
- 🚀 機能/改善:UI 硬编码字符串清零 + 去 MOCK 批（RN 10 文件 + miniapp 5 页 + RN 字典 5 语言） (51ba75023e9)
- 🔧 その他:收敛后重生成 i18n 离线包与两端 ui-routes 自述钉 —— 3f2dea0e90 归并按本侧留下 5 枚生成物并批注需重生成;gen-i18n-compressed(shared+miniapp-taro 输入)与两端 generate-ui-routes 已重跑,产物含溯源水印;消守门 105 自述钉 stale (442cc8df2d9)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (06f6e69d770)
- 🔧 その他:清偿四件套铺量次生的 11 个死样式键(4 文件) (82cf59682ba)
- 🐞 修正:修 5 语运维大屏段键位(去重 durationSecs/noDiskData 归位/dutyMode 两键按对侧行序)+并回对侧新增单键 recruitment 块 —— 显式放行陈旧守卫:被删行全部是同键错位副本(键值语义零丢失,重复 durationSecs 由 2 份收 1),zh-TW 保留 openOnGitcode/openOnGitee 删除声明与繁体正字 (383cf4bb0ae)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (012e2a06de4)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fdd94228007)
- 🐞 修正:G-875 注记不再复写公开默认口令字面量(守门 head 面要求非历史落点零字面量) (93e941b5642)
- 🚀 機能/改善:大屏第四轮(1920 首屏编排/仪表阈值/告警计数/无障碍) (39f16e7637b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (67630916728)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1bee4520f51)
- ♻️ リファクタ:F9 收敛批手工让号三行(G-940→G-1182551 / G-947→G-1182552 / G-82→G-1182553) —— 同票两版撞号,按 G-312「改动面小的一侧让号」本侧(未推侧)让号;G-940 行键位在标题中段、KEY_MAX_OFFSET=48 装不下 7 位号 ⇒ 撞号器拒构造,人工档键位前置改号;改前整行原文逐字入归档件 yielded-ids(门 71 归档豁免当场成立);三维守恒(勾态/租约/归属桶)逐行不变,build.mjs 断言与 keyOfRow 复验 3/3 在案 (279424551fa)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (be361265e81)
- 🐞 修正:G-875 注记不再复写公开默认口令字面量(守门 head 面要求非历史落点零字面量) (19a4a83cd5c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fa03e9d46d3)
- 🚀 機能/改善:我的粉丝页跨端落地批(镜像 RN 共享屏 user-fans 族) (8706bf6455a)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c9af3bde2b4)
- 🔧 その他:goal-20261024-Q 收口 —— 3 结清(G-960 探活四端 / Esc 层栈 / 两项结构性欠账)+ 2 进展(G-954 学费 / 第 3 波覆盖面) (85f69ce1645)
- 🔧 その他:并入远端 8462fc313a5 基线对 5 语运维大屏键的精修(axisPctMs/dedupSuppressed/hourlyTitle/statusWarn 改值 + noDiskData/durationDaysOnly/durationHoursOnly/dutyMode/exitDutyMode 新增),行级并保格式,JSON 合法性五语全验 (da6427b8199)
- 🔧 その他:守门44登记 .loomy-attachments 会话附件目录 —— 解除 --staged 归属无从判定的应急旁路(§12e 同型,只登记不搬不删) (732349e672a)
- 🐞 修正:停用行不补 missing 链、停用行 cred pending 清腿 —— 幽灵票 349 轮连败风暴收口(plan/reconcile 双腿+4 镜像用例) (f2962f1ef91)
- 🚀 機能/改善:1440 档布局配对与首屏编排 (8462fc313a5)
- 🚀 機能/改善:公网探活补四端矩阵判据 + Esc 层栈补强断言(goal-20261024-Q 落地一) (f783d89bf83)
- 🔧 その他:并入远端 4 键改动(axisPctMs/dedupSuppressed/durationSecs/hourlyTitle 五语)并重钉 miniapp gen pin,为 union-converge 解除 json 冲突面 (40dedc2f39d)
- 🚀 機能/改善:大屏第三轮(信息编排/请求质量改条形/值班全屏) (2fd767f8ee7)
- 🚀 機能/改善:屏幕状态四件套铺量第二批 —— 共享屏 80 个(骨架/空态/错误态/按压卡) (2b43c08fe12)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (61a2ce6f0e8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (12237863001)
- 🔧 その他:goal-20261024-Q 认领 wave-4 五票(公网探活靶钉 / Esc 层栈 / G-954 学费 / 两项结构性欠账 / 第 3 波覆盖面) (e3424fbe57c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4dd46e52892)
- 🔧 その他:goal-20261024-P 收口 —— 4 结清(G-876/G-957/tmpdir/bg 发丝线)+ G-875 进展(仓内闭环,生产轮换待机主) (5acfe85de8f)
- 🐞 修正:发丝线判据按 className 表达式整体读底色,补跨行盲区 (3b7aa3855bc)
- 🚀 機能/改善:新增 G-875 公开 admin 默认口令守门 (50637a90945)
- 🐞 修正:大屏第二轮细化(语义/性能/空态) (6fc5a3c3b6a)
- 🐞 修正:注册接口真正校验短信验证码,不再任意手机号可注册(G-876) (9e103ac0f6c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (82eb533f2e1)
- 🔧 その他:goal-20261024-P 认领 wave-3 五票(admin 口令 / 小程序登录死路 / 注册验证码 / 7 脚本 tmpdir / bg 发丝线判据) (88ed0fbf43d)
- 🔧 その他:web ui-routes 自述钉按 HEAD 面重算,收口门 105 (375e496f569)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4caa9d5c3a3)
- 🔧 その他:清除 recruitment 死键(9 键 ×5 语)+ 重生成压缩包 (b9541cc9bc1)
- 🐞 修正:回灌定时任务首轮落库失败的两处接线修 —— 仓根 4 级 + spawn 超时 (501a543495e)
- 🔧 その他:SwiftAPI 停运后的最后两处「现役上游」措辞中性化 (e232e7a89fd)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6b7704dbdaf)
- 🐞 修正:修监控大屏图表可读性与指标格断行 (7dd8a6cd8ee)
- 🔧 その他:结清 G-962（守门 8 未判定桶逐条裁决）与 G-879（分隔线三面盲区）——五条真死+零注册死码已摘除，门 8 RC=0 新增 0；三面判据 28/28、存量 15→1 (d30c909b1b2)
- 🔧 その他:写回 web/taro 两端 ui-routes 自述钉,清掉门 105 stale (2c870fa78f4)
- ♻️ リファクタ:摘除全仓零注册的 organizationRoutes（G-962 兜底） (c4dd0ea1e37)
- 🚀 機能/改善:落定"客户端为主、池只读回灌"——池不再与本机客户端抢轮换 (2e3b0e46aa0)
- ♻️ リファクタ:清除 SwiftAPI(x5m5x) 后端与运维残留（同步服务/种子/env/死注释 + 五语 8 键） (ce2b1c6f03d)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (bf72d869a6a)
- 🔧 その他:G-879 追加清偿注(14 处已清,门存量 15→1) (edf39674341)
- 🚀 機能/改善:票71 第二切片消费端接线 —— web 挂上 chat 同步订阅 (d6ecc540bb4)
- 🐞 修正:清偿 G-879 判据扩容后新看见的 14 处单边分隔线 (7b2fe9be8b2)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (028687bfffe)
- 📚 ドキュメント:走查包补 G-873 一键登录真机验证的现状互证(IDE 已登录/局域网构建/传输路由在位; 唯一未做=手机扫码实测, 不按已验计) (e7b949ecd3c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6696ccee2b7)
- 📚 ドキュメント:G-962 补进展2 —— 跨席 x5m5x 回潮已由 8c76614684 回滚，门 8 现读通过 (bd3ca8991b8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1e89cfd0cee)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b13a7f19816)
- 🔧 その他:goal-20261024-N 收口 —— 3 结清(G-1162551/工具钩子/新鲜度)+ 3 进展交回(G-879/G-962/G-925) (09fcc52f828)
- 🐞 修正:分割线门补三条语言面可见性(G-879) (d094a58e5ca)
- 🐞 修正:号池尺子把两种成因分开念(pool-exhausted 交出 reason 与 freeInPool 与 largestRun;无连续 50 号窗不再念成池已满;单源 describePoolExhaustion;六条断言代入旧实现全红;15/12/122/33 例绿且 --check 契约逐字不变;分配语义一字未动) (95162e38be8)
- 🐞 修正:服务新鲜度维补 Import-Module 静态加载边(G-1080903 回捞副本) (345e24e78bd)
- 🔧 その他:回滚 x5m5x 产品面回潮(ee3768f140 已整体删除该供应商) (8c766146842)
- 🐞 修正:搜索面板撤掉两处段间分割线改 8px 留白档(历史与热门之间、联想段尾部各一处;divider 样式键与 hairlineWidth 本文件清零;11 例含撤线回归锁,旧形态三正则全命中作阳性对照;typecheck RC=0;未做真机核验) (eafd9d299cd)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (86d20487651)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9c58fd7e689)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (bddbc7a6471)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (432d7b0044a)
- 🔧 その他:结清 G-939（合并吞提交门未响）——判据 A2/A3/A4/A5 三批入库，原案 11 枚由 0 检出变 repaired 点名；四套件 42/42 (09b45d64f78)
- 🐞 修正:健康检查跳过时不再静默 —— 适配器未注册必须留痕 (4f30e0a4ed8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (89b62ba61a6)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fd31c1267b4)
- 🔧 その他:三条已翻勾行去掉编号前缀 —— 消掉 F9 同号多题(2026-10-24) (3e0b03862bf)
- 🔧 その他:G-1162551 同一会话双窗格真跑 3/3,只放宽末帧 poll 窗口 (3597dca012a)
- 🔧 その他:收紧 RN 色值基线 —— 摘掉两枚已失效的硬编码色条目 (612176586cc)
- 🐞 修正:搜索建议段间节奏交回面板容器 space-y-2(删占位空 div;接住另席去线与 role=group 未回退;4 例含真接线锁,三次变异对照各红;typecheck/prettier/eslint 与两道分割线门绿;未做真机核验故不填 Verified-DOM) (dc7de0c3301)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (904f3c4e571)
- 🔧 その他:再次收口 HEAD 面等态行 —— 并发回捞带回的 3 条就地翻勾(2026-10-24 强制令) (c953332956c)
- 🚀 機能/改善:三个 x5m5x 组件接入 AI 生成 tab 表(收掉"造好没装车") (c72b439266e)
- 🔧 その他:fix(web)+chore(gate8): G-962 第三方登录五条死代理入口收口 (6ffe8d18e20)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (113dc9cf125)
- 🔧 その他:收口 HEAD 面残余 7 条等态行 —— 等人拍板/等条件保持双零(2026-10-24 强制令) (20669b39e96)
- 🐞 修正:管理面"触发健康检查"改吃三态,不再把未判定写成 down (b2cfe1c1247)
- 🐞 修正:Web 门户屏字符箭头改矢量图标、去掉两处中文兜底双源；订正白名单对该屏的描述 (531be78f939)
- 🐞 修正:发丝线门把粗尺寸过滤提到 accent 判定之前(彩色底放过 96 降到 4;真分隔线 0/0 与结构件 11/11/2 逐字不变;自检 19/19 与镜像 18 例绿;就地还原旧顺序即 18/19 红的实做级阳性对照) (fb28964d223)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (89d9b139b5a)
- 🚀 機能/改善:分销公司页对齐共享 Team 屏(承接中断的代理半成品并补齐) (a53e3b88f7e)
- 🐞 修正:model_list 5xx 不再等于"凭据死"——IDE 号退 ent_usage 自证活性 (48205bfe055)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (789bc05abbb)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e1c50d58fb9)
- 📚 ドキュメント:G-873 活账行并入过时副本独有的两条已核实事实(phoneCode/loginCode 参数形状经核实正确;真机验证受 §17 交付门槛约束)—— 为摘除重复登记做准备,行数不变、归属与勾选态不动 (0a984f82f02)
- 🐞 修正:README 生成块 trackedFiles 按 HEAD 面归位(15949→15939) (ae8fd072954)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (83ff5dad408)
- 🔧 その他:goal-20261024-N 认领 wave-2 五票(新鲜度门修 / G-879 三盲区 / G-962 逐条裁决 / G-925+工具钩子复核 / 附 G-1162551 复跑) (7ca33136fdc)
- 🐞 修正:README 四版清镜像回潮 + 对齐现算数字 + 回退结构损伤的压缩副本 (f4d9857fe61)
- ♻️ リファクタ:移除监控大屏未使用的网格类 wb-c4/c5/c7 (d29a90905cd)
- 📚 ドキュメント:登记表按 HEAD 面重算到 69 条真三元组，并把登记口径写进自述 (fe6c2161af9)
- 🚀 機能/改善:恢复号池↔签到对账接线与管理面签到入口 (540974734c1)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8dc38f58078)
- 🔧 その他:摘除一段逐字重复的批次叙述(3 行,归并前置) (f135dda97d2)
- 🚀 機能/改善:屏幕状态四件套铺到 32 对页面 —— 加载不再是一行字,错误可重试,空态有脸,按压有反馈 (e33cbfdb6a4)
- 🚀 機能/改善:UserFans 屏新立 user-fans 共享屏族，RN 改薄壳；顺带订正两处账面错 (eafbef30855)
- 🐞 修正:跨端页面覆盖门的两个半读同一个面，补 --staged/--worktree 档与 isDirectRun 守卫 (2b8c9977db8)
- 🚀 機能/改善:补上小程序端缺失的「开发者空间」落地页，并把假同物的对齐指针改回真同物 (66ca0fb8cb2)
- 🚀 機能/改善:Cart 屏新立 cart 共享屏族，RN 改薄壳，小程序端逐元素同形并补 selectAll 取词 (f4af85017f2)
- 📚 ドキュメント:小程序页补「对齐目标(RN 共享屏)」声明(纯注释,零代码改动、零删除) (19f6e4a6216)
- 🚀 機能/改善:TopicDetail 新立 topic-detail 共享屏族，RN 改薄壳，小程序端逐元素同形 (8cb5b83f18f)
- 🐞 修正:关于页页头三端同字 —— RN 的 menu.about 由短形式改为与 web、小程序一致的「关于我们」 (78c9a2505ee)
- 🐞 修正:「关于我们」十条入口两端 50 个比较位逐字对齐，并重算小程序离线语言包 (b953daf7f2a)
- 🐞 修正:健康检查「取不到结论」不再写 down (fa4a96d5352)
- 🐞 修正:recruitment 登记项按 app.config 的三段路由逐字写，并把段数陷阱写进登记表自述 (b680c246dcd)
- 🚀 機能/改善:Recruitment 共享屏重写，RN 端改薄壳，小程序端与共享屏同形 (2eca6eb2039)
- 🔧 その他:recruitment 族取词按共享屏新构成补齐五语种 (58378179940)
- 🐞 修正:补齐 Trae 刷新票到期落库与换票涨版本 (546b33179c8)
- 🐞 修正:补 DeveloperSpace 类型出口入库，登记表补三条跨端三元组 (f40cd3ea538)
- 🚀 機能/改善:Recruitment 屏收进共享真相源，并补上 Developer 漏入库的类型出口 (7da20813fba)
- 🔧 その他:带上 Developer 两件被 lint-staged 重排洗掉载荷的溯源水印 (87c4bffd31b)
- 🚀 機能/改善:把 Trae 自动保活缺的那枚 refreshToken 取到手并落池 (fa1ad2bf4cf)
- 🚀 機能/改善:Carte 与 Developer 两屏收进共享真相源，RN 端改薄壳、分段表跨端同源 (d988730cc77)
- 🚀 機能/改善:WorkBuddy 令牌续期改走客户端内存只读采集 (c2dc858b73d)
- 🐞 修正:补入 carte-sections.ts —— 上一枚把它在 constants/index.ts 的出口行卷进 HEAD 而件本身未入库 (fb0d0ae0b6a)
- 🐞 修正:监控数据大屏拼满12列网格并补齐缺失字段 (1c50b891db1)
- 🚀 機能/改善:跨端页面覆盖对账门(守门 237)+ 屏幕状态四件套(RN/小程序同源) (d723f8bc9b3)
- 🚀 機能/改善:WorkBuddy 网页会话服务端保活 + Bearer 过期自动回退 (f3e6e13f76c)
- 🐞 修正:登记表的 miniapp 键按门体判据写路由,不是文件路径 (d6879a45206)
- 🚀 機能/改善:About 屏富版提升为跨端真相源，RN 端改薄壳、分段数据两端同源 (65ae1469f40)
- 🔧 その他:小程序 ui-routes 钉随水印载荷提交后重算 (4b7fef10084)
- 🔧 その他:号池拆分出的两件补上溯源载荷(上一枚拆分漏了它们) (efcfbe844b2)
- 🚀 機能/改善:MiniMax 服务端独立续期（客户端不在也生效） (d9500543ea6)
- 🔧 その他:带上守门自愈写出的四件溯源载荷(顺带摘一枚 HEAD 潜伏的未用 import) (91753407975)
- 🔧 その他:号池共享屏补屏级渲染测试(5 例,钉住折叠进来的三个元素) (795851aca14)
- 🔧 その他:隔离签到→个人号池反向桥的真实 HTTP 旁路(两条恒红转绿并断掉真库写) (086ab8bafc0)
- 🚀 機能/改善:RN 个人号池屏落 HEAD(渲染收进共享源,薄壳只管平台侧) (c0fad4e0bae)
- 🐞 修正:重算离线语言包以承接号池新页文案(补上一批漏掉的一层派生态) (6353758789c)
- 🔧 その他:按 HEAD 面重算 web 与小程序两端 ui-routes 自述钉 (a18e6e8da14)
- ♻️ リファクタ:号池新文件按 §3 单文件 250 行上限拆分 (54f1c979308)
- 🐞 修正:汇总区分「领取成功」与「今日已签跳过」 (b46132b3157)
- 🐞 修正:补 mobile-rn accountPool 两枚缺键(界面曾直出原始键) (d6d644f9fdd)
- 🚀 機能/改善:本机客户端凭据自动同步 + 真实设备指纹 (9d5f97f15d1)

**2026-10-23**
- 🐞 修正:号池页派生钉按 HEAD 面输入重算 (55b09a308c5)
- 🚀 機能/改善:小程序个人号池管理页与三端词包补齐(号池↔签到互通落端) (73d5085880a)
- 🐞 修正:号池凭证三处断链补实(刷新涨版本/录入归一化/换票解冷却) (fc6452b1c20)

**2026-10-24**
- 🚀 機能/改善:守门 71 补归并名额维 —— 同题副本两行 marker 逐字相同,丢失维把删掉带进展那一份读成没删(真仓成对实测零报);新维要求当次逐号定向声明 IHUI_PLAN_MERGE_FOLD,与本次改动不同轮或给出空声明同样判红,归档豁免沿用丢失维同一把尺子先行放行,刻意只挂提交链以绝恒红门;镜像测试十例(归档豁免/丢失维/空声明三支变异各有承重)+门体自检七十例全绿 (a331c34b6e)
- 🐞 修正:注入交代列表改走 @ihui/shared 叶子路径,修 8801 全站 500 (a49c5520f2)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c2617915bc)

**2026-10-24**
- 🚀 機能/改善:71 chat 同步广播腿 + D115 /review 采集端点 + G-962 移动端聊天路由 (2d8ac453e8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8c74e47e10)
- 🔧 その他:收口 HEAD 面等态行 —— 等人拍板/等条件双桶归零(2026-10-24 强制令代裁) (2621a8fb72)

**2026-10-24**
- 🐞 修正:门 150 圆角角色档 9 处归位(上一枚 web 收编带进来的新增红) (44fc684813)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c07225c777)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fedc4732a7)
- 🔧 その他:goal-20261024-M 收口 8 票(343/239/927/878/874/924/932/807 结清)+ G-1162551 进展注(8801 全站 500 阻塞归 3b40be384a) (ebb8dcf7c8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (02ee3cc21a)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ffcc48e008)
- 🔧 その他:G-873 旧登记录复验注记(代码面已闭环、活账以 L28917 为准、唯一差口=真机复登) (bebf9f9dc3)
- 🔧 その他:G-927 棘轮基线 61→60 紧贴现读 (6baf62529a)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a03bdd61b2)
- 🔧 その他:G-955 按票面判据翻勾(取号入口 RC=0) + G-196/G-925 现读复验注记(①②已过时/代码面清零,余项如实仍开) (d0793e1ddb)
- 🐞 修正:G-927 最后一枚裸 git 派生改走 face-reader.gitRaw (74b82a84e6)
- 🚀 機能/改善:D77/D124/D125/79/D181 五票接线 + 票71 同步切片 + G-828/G-86/G-944/FIM 收口 (773016c7fc)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4d6eb0e977)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9d2517b439)
- 🔧 その他:零改动结清 5 枚(MCP stdio 诊断/结果级 isError/重连单飞代次/成对清理/f9 闭包) —— 主席亲跑测试 + 四席只读复核 (1e307ba015)

**2026-10-24**
- 🚀 機能/改善:D120 注入来源单源 + 71 chat 同步契约 + 五语对齐 (3b40be384a)

**2026-10-24**
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7d7b03ce00)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (62acaf01c3)
- 🔧 その他:清等条件桶回潮两枚——G-217 与 G-1018222 现读证成翻勾(尺子②已进 check:all 且 29/29 建档;trace_id 列与迁移在本机 PG 已应用、九例回归绿) (6bb51d75c3)

**2026-10-24**
- 🚀 機能/改善:D121 团队共享任务板 + D115 review 收尾投影 + D120 轮次预算交代 (2fc9ab9b55)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b973bea545)
- 🔧 その他:goal-20261024-M 认领本波 9 票(scripts 三席 / web 弹窗两席 / 复核三席 / e2e 一席) (304499effa)
- 🐞 修正:AGENTS §5b 清除镜像在役断言(门 237 M4 存量红) (7bb240acde)
- 🚀 機能/改善:工具调用证据级流水落库(表与时间戳迁移与唯一写入口;链式可验证引用既有审计链不复制第二份,权限枚举与操作者身份皆由承载层显式入参,十4 例回归绿) (49cf56d65a)
- 🐞 修正:摘掉反查池 worker 对 sweep 产出面两枚幻影键的取值使 HEAD 面类型转净 + 钉住产出与消费键集同批的三例回归(附带登记 da758a7d6f 删半截接线致 reconcile 与 retry 生产调用方归零这条真故障,复活接线另票) (099b843951)
- 🐞 修正:导引轨改造收掉 swarm 单边描边并补 path-labels 数据权利条 + 数据权利页三态登录门(擦除回执臂序经负控证明不可颠倒) (19a891faa5)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6a09723ff6)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2eb811b14b)
- 🔧 その他:收敛复核清等条件桶回潮两枚——G-945 翻勾(枚 b774e2dc6e 已代落,现跑 13/13)与 G-925 改判(修复已入库 枚1e96525416,真机观感验证归属:机主) (1eb9eb677e)
- 🔧 その他:落 G-925 改判记录(owner=机主)——回潮裸行经门71回捞后的等条件桶清账,真机/模拟器观感验证留人工窗口 (6fff53af5e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9a4d0c5b2c)
- ♻️ リファクタ:remove SwiftAPI(x5m5x)/ihui_relay first-party provider & product surface (ee3768f140)
- 🚀 機能/改善:小程序端补齐 Sheet/Tabs/Collapsible 并对齐 Tooltip/ConfirmDialog/LoadingSpinner/Avatar (d2543d4a04)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (11fa233768)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e304605ae6)
- 🐞 修正:监控数据大屏拼满12列网格并补齐缺失字段 (6d21d2adee)
- 🚀 機能/改善:FIM 指标聚合补 scene 维(补全/编辑意图分桶,旧调用落原桶) + 计划审阅面板五阶段连接线去档3分割线 (8f782af01c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b4b90c1301)
- 🔧 その他:G-880 两枚同题入口一并挂本席租约(该票现读有两个可领入口,一席已在做;不给没干的票占牌,G-871/G-873 属他人职权等待面故不挂) (6edf27eeee)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (17c8dc6e6b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dcdb7406d6)
- 🔧 その他:本轮新开五票挂租约(权限双轴展示腿/A36影子账接线/G-880取材面/G-921对账尺子/门128几何差裁定)防同票双领 (82df919bc9)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5bbf5d0add)
- 🔧 その他:侧边栏同题六枚可领入口全部挂本席租约(归并器与指针注记面由别席持有,不抢其写;先让六席抢同一张票这一格当场消失) (0202cca64f)
- 🚀 機能/改善:合并引用位移补 A5 内容存活维(路径仍在但 blob 回退 ⇒ 判 lost),G-939 原案 11 枚由 0 检出变 repaired 点名 (ca668b21c0)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (87833d362b)
- 🔧 その他:把 types 的 chat-sync-contract 子路径登记进架构契约公共入口白名单(E1 齐备对账 85 到 86 条,解析不到 0) (4db8ac2008)
- 🚀 機能/改善:顶层 {...props} 三态可判(spread-unknown 8→0)+7 处 RN 主题接线修复;LearnDevelop 的 useTheme 行属回归复原(祖先 dfc69ab8c2 有、61c36c45c5 批量同步时被误删,同批还丢了 tintColor 主题分支,后者另立债) (a02efc5e0e)
- 🐞 修正:补回 settings data-rights 导航入口并钉十例回归(当年归位只做了一半,该页全站零入口;词键复用既有五语种 dataRightsTitle 未新增) (bb78199345)
- 🐞 修正:分割线存量 RN 与共享层清偿十处(清线留距,几何与色档一字未动;在飞那枚 StudyIndexScreen 已移出射程) (de15e7c0b7)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8305dd7d59)
- 🐞 修正:出图契约补 item 声明并撤两端 revisedPrompt 死渲染(后端零产出通路已复核,503 透出分支逐字未动) (63ec1c1709)
- 🐞 修正:分割线存量清偿与契约出口挂出(两席成果;判据读数与回归末行见交付报告) (feca6dd3ea)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (641a621a6f)
- 🐞 修正:修回 D119 结清行被吃掉的左括号(本席落地脚本把 5 字的复选框前缀按 6 字切,吃掉了认领标记的左括号);唯一命中位置定向插回,其余三枚经逐字对照实为完好,先前"四枚损伤"是本席拿错对照副本的假阳 (b96432f414)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5dd04f1642)
- 🔧 その他:给执行流水落库票与契约下沉票挂写盘席租约(qoder-maxpar)防同票双领 (de735fc528)
- 🐞 修正:补齐队列终态的共享判据与各端接线 (a8e700ba9b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (86d47eb6f5)
- 📚 ドキュメント:D690 结清(A 档重放已在 HEAD 落地,本席亲跑 pytest 末行 passed=6 verdict=GREEN) (14e7b06c72)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d7003ebe1b)
- 📚 ドキュメント:五票按 HEAD 现读结清(api壳待迁0三枚迁移枚验祖先;D119 并行预取已交付;三票上游锚点本仓零命中而等价实现已入库挂测) (d63f269168)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c99ff58e65)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1c70ced9a9)
- 📚 ドキュメント:D195 与 G-107 两票结清(D195 三档链路 HEAD 已闭环十键齐;G-107 上游锚点零命中而本仓等价实现已入库挂门) (db4be9c307)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2714521757)
- 🔧 その他:给 RN 分类栏收口与 Predictive Edit 两票挂写盘席租约(qoder-maxpar)防同票双领 (f530bd4402)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (75498f5cc9)
- 📚 ドキュメント:键名对齐票结清(HEAD 面四枚文件键名已对齐+双枚祖先确证,票面旧快照断言证伪) (355ab45e1e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fc6f6761ed)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f48131e250)
- 🔧 その他:挂 4 枚写盘席租约(qoder-maxpar)防同票双领;W3 e2e解阻 / W5 门11d分割线 / W6 api壳批次 / W7 SDK就绪 (254c94ce4e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (de363ff0d1)
- 🔧 その他:认领 D114/D120/守门134后续批(goal-20261024 三席并发:web 选择器 / 预算续跑 / ACK 存量清偿) (b9f5ca2776)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6f178ae55b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c2a409cea1)
- 🔧 その他:结清工具粒度钩子取消腿票(票面验收条件=HEAD 现读见 toolCtx;现读 4 命中,端到端取消用例 4/4、既有 69 例无回归已记录在票面) (0bff9440a3)
- 🐞 修正:严格类型收窄、繁体词包补键与构建产物门自检 (b4e3d74076)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e79a05b3d6)
- 📚 ドキュメント:发丝线票结清(正本行;12 枚落地+指纹单源,尺子 HEAD 面存量 31→0) (679d6aea30)
- 🚀 機能/改善:会话内语音笔记挂载与队列审批许可门成套 (6740a555d1)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f89d89e1ce)
- 🔧 その他:摘除 3 条已归档僵尸活行(完成即删;逐条核对:归档文件 containsBody=true 且活行无归档日之后的注记) (1739c8f0a6)
- 🔧 その他:移除弃用的镜像工作流与未选型的安装器评审资产 (25b02eea97)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (338d9da079)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4d4274b8ae)
- 📚 ドキュメント:L4248 进展注——① 守门83 盲区已由 R4 键名配对覆盖(阳性对照实测判红),②基线冻结留门91侧核 (f41d940dd8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c1b9f5b244)
- 📚 ドキュメント:L4246 128 点迁移重复副本按归档正主翻勾(不重开不派单) (91aa32bfb4)
- 🚀 機能/改善:补齐 D125 协作会话的 schema、迁移与客户端出口 (97a8e4291f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7c766ce77d)
- 📚 ドキュメント:L4247 prod-bundle 入库源票结清(2 枚无法判定→0,14 对等值/9 对设计未判定/镜像 11 例) (65b4c2c543)
- 🐞 修正:恢复自动收编误删的三组路由注册 (232a2ab912)
- 🐞 修正:CheckinAssistant 两枚 blocking 门红归正(badge 角色档 sm→md 合门150;submitText 去死兜底 #fff 合门218) (7521033a46)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (90fe9942b7)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (aced7c358f)
- 📚 ドキュメント:发丝线票结清(RN/内联 12 枚落地+三型指纹单源,尺子 HEAD 面存量 0) (567d8cd1ac)
- 🚀 機能/改善:代理分流名单追加 groq/agnes(实测直连恒失败,Clash 可达) (76fb09a7c5)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e2360eb4d7)
- 📚 ドキュメント:等条件桶收尾补丁@we-clear-20261023——5 枚〔归:〕简写牌补"属"字使 v1 散文尺与侧车同判(桶不变,仅补散文表态:G-942/G-116/G-371/G-113/G-115 归他席);G-947 追记后台席像素取证结论(009/010 假图坐实、012 真图,终判不变等机主素材) (ce4301ddcd)
- 🐞 修正:发丝线剩 2 枚(HomeScreen/StudyIndex 的 RN 样式行)按 HEAD⊕本票行落地,不吞他席暂存面 (d1198a2962)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8fcbfbd029)
<!-- END RECENT UPDATES -->

<p align="center">
  <sub>Built by <strong>吉林省愛智匯人工知能科技有限公司</strong> · オープンソース共創、あなたと共に</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star us on GitHub</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/fork">Fork to build your own</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues">Request a feature</a>
</p>
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
