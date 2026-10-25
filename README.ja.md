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
|                                      | テストカバレッジ                           | ~14839+ ケース + 400+ ケース / Vitest + Playwright + pytest + Locust 負荷テスト + Lighthouse 性能                                                                                           |
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

### REST API(4443 ルート)

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
**2026-10-26**
- 🐞 修正:G-927 第四批 10 枚裸 git 派生迁入 lib/face-reader(gitRaw/catBatch)—— 棘轮 HEAD 面 70→60 与基线 60 对齐;check-cross-end-screen-coverage 正文同时改走 catBatch/readWorktreeFile 满足门 118 取材面纪律 (0ff78d7fda)
- 📚 ドキュメント:G-964 行内更正——『侧车抽取器与新守门未建』已不成立(三件载体现读全在仓 36,986/27,192/24,595 B);残余改为存量迁移 101 枚 + 72 条孤儿记录治理,凭 check-plan-fields 末行 state=warn stock=101 orphan=72 (491c8b3321)
- 🔧 その他:F9 双档两枚结清(G-455/G-681)——判据已收窄到声明位口径,现读 --gate F9 存量 0 组、宽口径 0 组、引用图 0、差值 F9=0 无 ❌ 行 (620d74f861)

**2026-10-25**
- 🐞 修正:修复预存 typecheck 错误以通过推送门（App/ModelConfigDialog/TokenValueScreen） (7d0831bc66)
- 🐞 修正:摘除被 chore 收尾提交复活的死测试 organization.test.ts(恢复 d35827d96c8 的摘除决定;该文件 import ../organization.js 解析不到任何文件,是 HEAD 上全量 typecheck 唯一报错文件 ⇒ 阻塞所有推送;全仓仅此文件引用 organizationRoutes) (ccf42c74ff)
- 🔧 その他:收尾提交本地未提交改动（registry-sync / qoder 桥接 / 移动端与 Web 插件 / 部署脚本 / 文档） (821ce8e621)

**2026-10-26**
- 🚀 機能/改善:自进化四票真代码交付(自治决策模型/可审计决策链/E2E 自动补测/经验写回腿)—— 判据单源(autonomy-policy/decision-chain-sources/e2e-autofill-map/lesson-writeback-policy 四份 json),测试 import 源脚本零复制;自测 21/9/37/12 组全绿,node --test 四套件 48/48;两枚缺水印文件已补注入;未接线格(受锁 runner 注册与 auto-evolve 排期调用)留进展注不翻勾 (56855eb75f)

**2026-10-25**
- 🔧 その他:并发席零改动结清 21 枚(前提现读已闭,证据注记随行)—— web 五票(hit-target/59./60./真机走查/G-60)+ 脚本六票(号池到期/合流盲区/G-960)+ cli·deploy·ops 四票(WP-7/G-109/P2-13③/G-1222561/G-74/D42046)+ 自进化已交付五票 + 第1/2期无号副本回潮复结 (20d9d96a48)
- 🔧 その他:59. 消息级版本切换三段(1/3 sibling 存储 / 2/3 MessageVersionMenu / 3/3 回调坐标透传)零改动结清——三段落点与回归测试现读齐备 (9ff5da17df)
- 🔧 その他:O65 P0 四票(O6501 根护栏/O6502 成本熔断/O6503 隔离+原子回滚/O6504 人工阀)与 G-60 窗口化五票零改动结清——器物与部署环接线现读在位,自检 9/13/9+7/12 组全绿 (003a77eb76)
- 🔧 その他:r5 认领自进化四票(自治决策模型/可审计决策链/E2E 自动补测/经验自动提炼)——牌插在复选框后,正文一字未动 (ef7123a5f4)
- 🔧 その他:G-274 与 G-107 两票零改动结清——票面前提逐条现读已过期(门 233 已 blocking 接线且生产 importer 4 枚;recovery-gate 已进 sse barrel 且经 stream-authority/client 逐帧消费),证据注记随行 (188fe19586)
- 🐞 修正:G-962 批13——BP 腿前缀假设可见键 10 处逐条裁决 dead,未判定桶 17→7 (9854d851e1)
- 🐞 修正:门 234 A2 误判收口——侧车标头定位单源化(locateSidecarHeader),strip/parseHeader/门的 headerOf 同一把尺 (86085c636e)
- 🔧 その他:F11 回潮行摘"需拍板"措辞——非会话401票归属照旧(api鉴权面+api-client两侧持有者),票保住不被禁令清扫器吃掉 (50d8737b2a)
- 🔧 その他:health 分叉同题两枚结清——web 健康页现读改走 /api/admin/monitor/services 的 {list} 信封(头注 L7334 结清在案),服务端同形 success({list});/api/health 裸对象契约按原方案不变,对外契约未变更 (0d4bd0747d)
- 🚀 機能/改善:O65 第 3 期第三件 —— 依赖安全通告雷达(实跑 257 条/35 critical,80 枚可修候选)+ 第 3 期进展注记刷新 (5732b6bb28)
- 🚀 機能/改善:锁定 order-log/order-track/message-group 令牌主体与 vip-compare 公开脱敏 (b5c3d62f14)
- 🚀 機能/改善:O65 第 3 期回流两件 —— 失败票归因沉淀器 + 守门判据腐烂自检(自检 7/7 与镜像测试 12/12 全绿) (6567fd5730)
- 🐞 修正:Step 5 载荷判据改为「实到 == 预期且预期非空」,空提交不再判绿 (3bdcc09dca)
- 📚 ドキュメント:O65 第 3 期进展注记 + 第 2 期重复登记收拢(仅留一条 [x] 完成行) (74fd1f1630)
- 🔧 その他:G-1222557 复验结清——出口围栏的存量维真跑 15/15 绿;另补记 D04/G-934 两枚的真浏览器凭据 (534682513b)
- 📚 ドキュメント:O65 P0 四件翻勾(正式编号 O6501-O6504)+ 第 1 期感知层自动分诊器翻勾 —— 交付件已入 main 并随 8486d01ddab 上生产 (4e74314d70)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b801d2d8f9)
- 🔧 その他:G-927 进展注记——求差实证新增12枚中10枚已由别席迁好待入库,agent-worktree/green-state 两枚本席迁讫(gitRaw层,行为面等值,自检9/7);棘轮70随入库递减,基线60不动 (8a8ffefbd6)
- 🐞 修正:G-927 迁移批——agent-worktree/green-state 两枚裸 spawnSync('git') 改走 face-reader 取材层 gitRaw(绝对路径git+quotepath+safe.directory+timeout+EBUSY兜底),包装函数折回原三态行为面逐字段等值;自检9/7全绿+--list行为面真实返回;求差实证:12枚新增中10枚已由别席迁好待入库(盘面0命中),本批迁余下2枚,棘轮70→随入库递减,基线60不动(下调前置=10枚入库) (a9505b2596)
- 📚 ドキュメント:结清 3 枚(第 12 批:G-272 重臂复位分域 + 门 149 端内 barrel 两条同题) —— ①G-272 席位提交 34828b1db3a5d531b26b06fbf8d20d79fee28f1d:前提现读更正(stopInitiator 在 HEAD 有 15 处命中而非票面 0,该字段已由 G-816026 落地;rearm/重臂/复位仍只命中注释 ⇒ 注释声称有实现没有成立)。实现 apps/cli/src/tools/background-registry.ts 新增 BACKGROUND_TASK_REARM_FACE(preserve/reset/renew 三档,satisfies Record<keyof BackgroundTask,…> 编译期穷尽)+ rearmBackgroundTask(previous, incoming):身份面逐字保留、结算面回构造初值、新生面换代,四档拒绝(not-terminal/id-mismatch/generation-not-renewed/not-live)原样交回旧条目,fail-closed。主席复跑 apps/cli/tests/background-rearm.test.ts ⇒ Tests 6 passed,含变异自证(注释掉 command: previous.command ⇒ 仅用例①红)。剩余面:rearm 暂无生产调用点(registerTask 每次 genId),未来接入时事件处理器必须绑到 rearm 返回的新条目。②门 149 端内 barrel 两条同题行一并收口:席位提交 443561b82c 新增 scanAppBarrelLeaks 与桶/实现分离单源 isBarrelModule,端内桶 universe 由该层目录扩到端内全树;主席复跑 --report 末行 APP-BARREL-REPORT barrels=36 apps=5 consumers=34 hits=0 type=0 elsewhere=0 undetermined=0(存量 0 + 阳性对照 ⇒ 并入既有 --staged 差值棘轮而非升绝对 blocking,符合 §12e 升档前置=存量归零) (00d8db8283)
- 🔧 その他:A 类 7 枚结清(G-62/G-01/G-03/G-07/O88/G-272/双重执行)——凭据全部本席现读复跑:gate 全零、twins 0 组、CI 唯一 failure=lint-typecheck-test、stopInitiator 20 命中、take_loop_v2_handoff 9 处消费面在位 (1e57d5d821)
- 🚀 機能/改善:门149 补齐端内 barrel 漏出口(桶/实现分离 + 端内全树 universe + --report 只读量算) (443561b82c)
- 📚 ドキュメント:结清「非会话 401 被当成会话死亡」 —— 按 §24 机主令本应由 agent 代裁,现读发现源头已由 2026-10-25 的 L7648 修复落地:apps/api/src/routes/agent-extended.ts 的 preHandler 兜底由 `err.statusCode ?? 401` 收窄为 `?? 502`,行内注释明写「没标 statusCode 的异常是内部/上游故障,盖 401 会被 api-client 读成重新登录(上游 provider 凭据错误 ≠ 会话死亡;口径同 auth.ts 票 G-396/G-765/G-357)」⇒ 用户不再被误导去重新登录。客户端侧 packages/api-client/src/client.ts 仍是 `status===401 && !isAuthEndpoint(url)` 才判会话死亡(两处),由于非会话错误现在以 502 出栈,该启发式不再被误触发;如实登记残余:若将来有上游把第三方 401 原样透传成 401,仍会被读成会话死亡,属纵深防御缺口而非本票未完成 (ba06930d36)
- 📚 ドキュメント:结清票60 真并行多窗格(服务端 fork 腿收口) —— 席位提交 5e72a6df8b 共 5 文件 +942/−50;主席自审复跑 apps/api 三份用例(chat-fork-branch-endpoint + chat-fork-branch-queries + chat-actions)⇒ Test Files 3 passed / Tests 24 passed(席位另报 conversation-archive 11 例,合计 35)。关键事实更正:服务端分叉并非不存在,而是早已以 POST /api/chat/conversations/:id/branch 命名存在(chat.ts,2026-08-30 立;V3 按 fork 关键字 grep 未命中属命名差异)⇒ 按 §0.6 不新开 /fork,改为把既有端点按票面口径收口:响应返回新会话 id + fork{sourceConversationId, forkedFromMessageId, sourceRootId, sourceSiblingIndex, messageCount};复用票59/64 的 parentMessageId+siblingIndex 族根判定并抽出纯函数 linearizeForkHistory(每族只留一版,分叉点必胜);鉴权只取 request.userId(body 自报 attacker 仍以真实主体入 queries,他人会话 403 且 branchConversationFrom 零调用,越权插入/更新计数 0);幂等用 clientRequestId 在源会话 FOR UPDATE 锁内查询,重放返回首建会话 replayed=true 且计数不增,键撞别的分叉点 409;复制以 .returning({id}) 回库确认,不符整批回滚。未判定:真库端到端(.env.test 不存在、PG 仅 5432)⇒ 四格为离线 mock 链。剩余面:客户端(api-client/web/RN)需透传 clientRequestId 才吃幂等 (b55f46c8b5)
- 🐞 修正:后台任务重臂按结算面/身份面分域复位(G-272) (34828b1db3)
- ♻️ リファクタ:rules 族本地 api 壳迁至共享出口 apiOrThrow 并摘零消费方壳文件 (ea570fc43f)
- 📚 ドキュメント:结清 2 枚(第 11 批:G-115 真分叉 / 第二个死端点簇) —— ①G-115 按 §24 机主令代裁并执行:不再等"谁在哪个窗口收敛",直接用仓内既定出口 node scripts/git-sync-converge.mjs 走索引层 union 合并(零触碰他人未提交文件),合并枚 f8c25b537b;现读 git ls-remote origin refs/heads/main = f8c25b537b07a68d9daea4d6a231e7d840441b83 = git rev-parse HEAD,git rev-list --left-right --count origin/main...HEAD = 0 0 ⇒ 部署环的"远端 tip 分叉且自动收敛无效"根因已消除。合并后回潮审计:本会话 23 枚结清行零回潮。②第二个死端点簇按席位二段式复量收口:六条(agent-reviews/wallet-bank-cards/messages-chat/course-annex/course-qa/course-resource)全部已有等价端点且在 HEAD——agent-reviews GET /api/agent-reviews、wallet GET /api/wallet/bank-cards(插件级 requireAuth)、messages GET /api/messages/private/list 与 POST /api/messages/private(checkAuth,senderId 取承载层 request.userId)、课程三屏走 GET /api/resources 与 GET /api/edu/qa 且 RN 屏已改指;阳性对照 invited-users 4 文件 7 行证明尺子有牙;零新增端点(重复造会与既有端点漂移)。受影响用例 Test Files 2 passed / Tests 14 passed。剩余面如实点名:order-log/order-track/vip-compare/message-group 四词另计;BankCardScreen 库无 bank_cards 表(无表可取)、三条课程屏缺 courseId 维度 ⇒ 产品语义缺口,非端点缺口 (fb77aa60b8)
- 🚀 機能/改善:帧名单源收敛到 CHAT_SYNC_EVENT_NAMES,sse 契约只引用不重写值 (54748ccdfb)
- 🚀 機能/改善:会话分叉端点收口(票60 服务端余格)——复用 sibling 版本族 + 幂等键 + 计数诚实 (5e72a6df8b)
- 📚 ドキュメント:O65 补回正式编号 O6501-O6513 + P0 四件翻勾(O6501-O6504) (4f2f9c8176)
- 🔧 その他:G-593 上行应答接受性守卫改语义锁 —— 票面前提已腐烂(四条在 2026-10-07 已随实现恢复转绿),本轮只把两条字面锁换成行为锁并留变异自证 (caee7106db)
- 🚀 機能/改善:O65 P0 安全护栏四件 —— 根护栏/成本熔断/影响面隔离与原子回滚/人工阀清单 (9caeac97d5)
- 🔧 その他:结清 G-941(成本账本按链别归一,249 passed+ruff+mypy strict) (a34df2bf63)
- 🔧 その他:G-593 上行应答接受性守卫改语义锁 —— 票面前提已腐烂(四条在 2026-10-07 已随实现恢复转绿),本轮只把两条字面锁换成行为锁并留变异自证 (c8f2750a5c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ca97133f4f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (90c0862194)
- 📚 ドキュメント:G-957 行内失真路径就地更正(票面挂点 login.tsx 已随 2026-10-23 定档删除/回传腿已由 webview onMessage 接管/scheme 已登记)+残余两格点名;主键·归属·租约三维守恒由 plan-task-index 当场断言 (3af96ef954)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3ef3c8e667)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4c98968e83)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a8b9c604c8)
- 🔧 その他:L28030 门39票达成完成即删——六屏已由别席下沉(6→0),末条aboutPageSections数据文件豁免与别席同批在库,门现读全绿镜像10/10 (864c743fac)
- 📚 ドキュメント:结清 79/B03 权限双轴化(运行时真接线) —— 席位提交 7f850459839024c3333ee5acb38fa75dc2aef774 共 12 文件 +1247/−53。主席自审复跑:apps/cli 三份新/改用例 permission-axis-runtime + sandbox-strict-default-on-missing-config + sandbox-profile ⇒ Test Files 3 passed / Tests 59 passed。落点:packages/types/src/permission-axis.ts(判定本体 evaluateAxisGate + granular 五布尔 + 归一化)、apps/cli/src/sandbox/permission-axis-runtime.ts(装配优先级:显式 > config profile > 五档映射 > 契约默认)、apps/cli/src/tools/index.ts(ToolContext.permissionAxis + executeToolCall 轴闸,覆盖 hub 分支)。默认值现读:SANDBOX_MODE_DEFAULT=read-only、APPROVAL_POLICY_DEFAULT=on-request、生产装配 DEFAULT_SANDBOX_PROFILE=limited ⇒ workspace-write(绝非 danger-full-access);未知值一律落 read-only/untrusted 并 warning(fail-closed)。单一真相源:三值/四值/五布尔仅存 types 包,CLI 零副本;check-declared-policy-has-consumer 与 check-permission-mode-vocabulary 均通过。剩余面如实记录:交互确认窗未真机走查、CLI 暂无 --sandbox-mode 旗标、loadSettings 不执行 layer-policy 项目层过滤(既有缺口与 sandbox 键同型) (823794e403)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (286ee41245)
- 🔧 その他:结清 G-863(附件容量改提交式CAS,18/18 绿) (8f39ff5ab8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (02758036ef)
- 🔧 その他:L28030 门39票达成完成即删——六屏已由别席下沉(6→0),末条aboutPageSections数据文件豁免与别席同批在库,门现读全绿镜像10/10 (7589a3fa87)
- 🚀 機能/改善:权限双轴运行时接线(79)+ 沙箱默认严档运行时强制补齐(G-212 第十一批 cli 半) (7f85045983)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8486d01dda)
- 🔧 その他:tmpdir 族 90 副本同据终清(折并器上限外交人工:票已结清,check-fixture-tmpdir rc=0 同据,全部副本翻勾即终态) (8115eb8c5c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4f0075f311)
- 🔧 その他:结清 D22046(通道②③+比对驱动未变化承诺,cli 49/49+tsc0) (477ab648bd)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c248511bdd)
- 🔧 その他:G-212 结清——两侧齐(cli 半 goal-r57 严档+ai-service 半已自落本轮现跑 15 passed),翻勾条件成立 (c797e033c4)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (af71cd1e10)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (29c73b7469)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6d6da34226)
- 🔧 その他:G-620 结清——两道 blocking 红(门150/门90)本轮现读全部转绿(桌面事件三层闭环通过阻断 0),跳门前提不复存在 (9b816186f3)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3ea059635d)
- 🐞 修正:next-plan-id --check 重号判红改差值棘轮(存量只报数/新增才判红)—— 承 G-955 收口 (f6b9df39ba)
- 🐞 修正:G-957 网页授权回传腿失败态如实提示(换票失败/异常不再静默) (d47a2842a3)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4d922ea918)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b546442d02)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9e49a4b02a)
- 🐞 修正:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (e48584bd7e)
- 🔧 その他:清偿叠注记存量 46→2(9 行折并,行数与勾选/租约/归属三维不变) —— 折并判据不另写:直接 import 守门 13d 自己的 noteTokensInLine / redundantNoteCountInLine(§0.6 单一真相源),对同一行内逐字相同的注记保留一份、删除多余份;全量档现读 叠注重数 46 → 2,残 2 份属承载段分词形态(判据计入但字符串面找不到第二次逐字出现 ⇒ 如实留报数,不猜不改)。本枚只动这 9 行注记文本,复合主键与正文语义逐字不变;门 13d 复跑 RC=0(差值档,存量只报数) (beaba75247)
- 🐞 修正:补齐漂开族折叠通道(--fold-drifted-families)的两处形状锁 + 补镜像测试 (36d800cb53)
- 🐞 修正:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (4c155346b0)
- 📚 ドキュメント:结清 G-926(lint-staged 已跟踪却被 ignore 的雷区)—— 席位提交 2c9d023f4b;主席自审复跑 node --test scripts/tests/lint-staged-ignored-tracked-ledger.test.mjs ⇒ tests 14 pass 14 fail 0。现值现读:[tracked-ignored] 面=head 存量只报数 12 条,git ls-files -ci 同为 12 且全在 .ihui-agent/archive(11 md + 1 json,唯一命中 .gitignore:186);票面 84 枚里的三族已由 41a3bdeeb4(取消跟踪 tmp 61 枚)、a402f50043(删 articles 宽式忽略)、8c952aac27(为 plugins/*.cjs 加负向例外)收口,故判 closed-by-others 未重做。archive 那 12 枚是门 71 archivedCopy 的归档凭据(读 HEAD/索引树),摘掉即削正当删行的依据 ⇒ 建议退跟踪 0 枚。另修一处恒红口径:旧 T7 把命中根 glob 记成失去 lint 覆盖,而 .prettierignore 早已整目录忽略 .ihui-agent/,64 枚系双计;新口径只问工具本体 prettier.getFileInfo(不另写 glob),限额 50 与给源码目录塞黑洞出口件必红的语义都不动,并加了正探针。三臂真 lint-staged CLI(--diff=HEAD,scratch 夹具):absent 报 git error、tracked 正常 Done staging 且索引 blob 未被改写、untracked 同 absent。剩余面:门 236 豁免按目录前缀放行,将来 git add -f 塞进 archive 的新件会被放行(动豁免语义需另票) (c683c71b8d)
- 🐞 修正:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (56227f8b33)
- 🐞 修正:为 gate #193 补 8 处 git 派生调用的显式 stdio (15372e4aba)
- 🔧 その他:api<T>234 迁移回潮副本同据复翻——goal-b15 S10 已结清(349e116a66+b3b3f64276),本轮同据复验一致 (59a3a90a56)
- 🔧 その他:结清 G-876/D195/G-937 三枚(注册验码/通知归档流/归档器B档,均带真跑证据入行) (3b1a29df96)
- 🚀 機能/改善:违禁桶兜底清扫器 strip-banned-buckets——两道机主禁令(等条件F12/待拍板F11)的执行器物化:guardian巡检轮 sweepBannedBuckets 派发(5min节流),自动摘HEAD面两桶未勾行并留痕f12-purge;判据import单源零复算;SWEEP-RESULT三态;镜像7例(留痕在落地之后/走object-space-land不自带CAS/已勾不进射程/scrub消费端对齐);AGENTS禁令条补点名+复翻席纪律(复翻须同步摘形态);自检5组+镜像7/7+eslint 0 error+clean态派发实测正常 (41988c0b3d)
- 🔧 その他:G-962 结清——高置信族逐条现裁全过时(computer-use 在册/announcements 公开族/members/groups/browser-sessions ai-service 全族/organization.ts 已亡),门 8 现跑通过;余参数段未判定=判据能力边界非死调用 (34ba9ee749)
- 🔧 その他:G-937 结清——根因已于枚 0b1d98107c 修复(seamArchiveChunk+§22c 镜像锁),归因档 c038a654db 为 HEAD 祖先,修复当日 113e612833 落地归档 24 枚;self-test 63/63+镜像 39/39+--list-blocked RC=0 现读,本行属门 239 型已归档票复活副本 (0d3969e1c1)
- 📚 ドキュメント:结清 dot-source 新鲜度维(第 4 批 1 枚) —— 席位提交 14a93e75b8032e067906e7c5cd750fd546bacbc2 只动 check-service-binary-paths.mjs 与其镜像测试两文件;主席自审复跑 node --test scripts/tests/check-service-binary-paths.test.mjs ⇒ tests 32 pass 32 fail 0。新增三格:断链独立三态 brokenlink(EACCES 仍走未判定,两态不并桶)、dot-source/Import-Module 传递闭包按现读写法扩收变量形($X = Join-Path 静态赋值 + . $X,RHS 非静态仍点名不猜)、每服务 fresh/stale/断链/未判定分桶入 renderText 与 totals。本机 nssm 不在位 ⇒ 现读 未判定 3(IHUI-AI-SERVICE/IHUI-API/IHUI-WEB),按 §0.3 不顶绿;真服务链上 stale/断链臂需有 nssm 的机器现读,属剩余面非本票射程 (ee2fc177e6)
- 📚 ドキュメント:结清 G-1222560 危险登记(索引面三份 web 语言包坏 JSON)—— 复跑取面:git show :packages/i18n/messages/web/en.json|JSON.parse=OK、ja=OK、ko=OK,HEAD 面五份亦全 OK ⇒ 他人暂存的坏索引现场已消失;该行正文自我嵌套 4 层副本并入注记+3 条同题原号指针,属票面腐烂,凭据以本枚现读为准 (a88a00a74d)
- ♻️ リファクタ:face-reader 判据符号单源化——BARE_GIT_RE/bareGitCountOf/hideComments 三符号自 face-reader.test 内闭包搬入 lib 导出(test 改 import,逐字零语义,G-927 同尺差集工具取材用;35 例面 34/1 棘轮红系他席在飞 G-927 收口的 10 枚新增待其落地后自然回落) (05a18375b9)
- 🐞 修正:服务新鲜度维收口三格(seat-svcfresh,G-1080903 回捞副本续)——断链独立三态 + 变量赋值 dot-source 解析面 + 每服务分桶现读 (14a93e75b8)
- 🔧 その他:G-955 复验结清——取号入口实测可用(next-plan-id --check 真RC=0) (7930521657)
- 🐞 修正:摘除指向已删路由 organization.ts 的死测试——HEAD 上该测的 import ../organization.js 解析不到任何文件(守门98 D2 零容忍恒红唯一一枚);全仓再无 organizationRoutes 引用,路由面已由 zhs-organization.ts 承担;与工作树既存删除(D, 他席在飞)同一处置,本次只把它材料化,不新建替代 (d35827d96c)
- 📚 ドキュメント:结清第二批 4 枚(工作已在 HEAD 或本批席位落地)—— G-343 / G-880 / G-32 / G-934 (c11e24d5f4)
- 🔧 その他:独立席四票复验结清 D04/G-934/G-924/G-239——票面自写判据逐条当场复跑,零复算 (7b562d0477)
- 🐞 修正:G-880/G-32 收口核验+成对自检补锁 —— 两禁令门(emoji/shared-layer)迁面与加固判据经现读确认已随 a6c7cb36ec 入 HEAD(listFaceFiles 按面枚举+readSources 同面取材,门内零 readFileSync);本批补票面硬要求的两把缺失配对锁:三面同形干净仓⇒三档全0(防恒红,W10 型)与 --staged/----worktree 两面旗同给⇒main 返 2(§0.4 互斥)。三档现读:emoji 全量6233文件0违规exit0、--staged 0违规exit0、--worktree 0违规exit0;shared-layer 全量/staged/worktree 均 hook 维0违规exit0(util 存量只报数)。镜像测试 emoji 17/17、shared-layer 12/12;check-gate-wiring --strict exit 0 (390d395038)
- 📚 ドキュメント:O65 自进化 13 任务补正式编号 O6501-O6513(以 HEAD 为底稿恢复回潮丢行+编号派生侧车键) (702373ef97)
- ♻️ リファクタ:G-343 DRIVEROOT 族残余清零(票面四处全数核对)①②已由 852c9409 收口(audit 私有 devEnvRoot()/pgBinDir() 与失真头注、app-reads:56 硬编码盘符推导现读复验=族内生产文件仅 import lib/psql-client-locate 单源,无第二份推导);③现读补出=pg-restore-drill.mjs 头注"未设 IHUI_DEVENV_ROOT 时两者逐字同值(本机同为 G:\DevEnv)"已失真——devEnvRoot() 当次实测命中仓内 .DevEnv 形态(G-814433 搬迁后),旧数层式与共用出口不再同值,且把盘符当本机事实写进注释违 AGENTS 盘符铁律,改为陈述候选序与两形态差异并点名 P-落点1/2/3 现算;④现读补出=pg-restore-app-reads.test.mjs:49 在测试里重算 IHUI_PG_BIN_DIR||join(devEnvRoot(),...) 第二份 pgBinDir 判据体(§0.6/§22c),改 import ../lib/psql-client-locate 的 pgBinDir() 与工具同源。复跑凭据:audit --self-test rc=0(取证在镜像测试)+ audit.test 连跑三次 59/59 pass;app-reads.test 8 pass/3 skipped(未判定:psql.exe 不在位,环境闸按设计);drill.test 29/29;守门45 check-c-drive-paths 全量档✅、check-workspace-hygiene HEAD 面✅无新增违规 (caef8d065d)
- 📚 ドキュメント:维③ 头注实测数改正——70 份叠注里 49 份在承载段内、21 份落活文本(此前误写 72/51);纯注记订正,判据字节未动,自检仍绿 (9129d9253e)
- 📚 ドキュメント:结清 7 枚僵尸票(活已在 HEAD、行未摘)——分割线 G-877、判据盲区 G-879、原生弹窗 G-878、MCP stdio 四票 G-689/G-691/G-692/G-694 (6c6efc415b)
- 🔧 その他:G-874 结清——web 注入两调用点+共享按钮消费+login 族 30/30 绿;原生 WebAuthn 免依赖方案优于票面;未注入不渲染=平台豁免成立 (0cd4af3484)
- 📚 ドキュメント:O65 侧车键由 自进化# 收敛为编号派生 O65xx#(13 条) (62a6546229)
- 🔧 その他:G-957 剩余格改归属机主小程序后台白名单面(正规改桶通道 LIVE_BUCKET_RECLASSIFY,actionable→owned-elsewhere;格②已入库凭据在案) (6dbb495b4d)
- 🔧 その他:G-63侧车重钉(union带回旧记录终修),A2归零 (f3fbf0bbba)
- 🔧 その他:G-934 结清——出路①接线三轮凭据在案(47dc360911 实体测 13/13 本轮复验+56cc4a66f4+847925be2b)+§17 真浏览器核验已落(82c9a68ae0 四例两轮绿);10 红前提过时 (80f8fb9f23)
- 🐞 修正:维③叠注存量归零——判据剥「副本正文并入·承载整段」平衡段(逐字引文非活注记,72→21),活文本按逐字同串摘 21 份(L5361 x1/L28173 x18/L28911 x2,只删同串不并族);自检10/10、镜像14/14、行数/勾态全等 (75d303394e)
- 🔧 その他:G-876 结清——实现已在库(code 必填+503 fail-closed+用途锁+防枚举,枚 9e103ac0f6),G-81 席复验 auth 1311 全绿背书 (217be03c9f)
- 🔧 その他:F4末2组收口——O-02摘旧底稿裸行(正主带租约+③格注记)/G-116摘旧句(正主标头规范),留痕f12-purge (6309556402)
- 🔧 その他:F4四组+跨号副本收口——G-1222558错号/G-937裸副本/G-10旧句/G-11旧句/B02旧副本各摘副本侧留正主(留痕f12-purge);union回潮体清偿末批 (32b2a83941)
- 🔧 その他:G-963 结清——修复已落库(测试文件 G-963 注记在案),现跑 f9 族 10/10 绿零 ERR_MODULE_NOT_FOUND (eac4da4f06)
- 🔧 その他:G-74 远端合流回潮体复翻——并发席已结(d5cce09f8c 校验收口+sponsor 地址在案),配置面余格归机主面行承接 (9b66a50d77)
- 📚 ドキュメント:O65 自进化战略方案文档 + 13 条派单侧车记录 (76f6b4891c)
- 🐞 修正:补回索引迁移时误删的三门点名(守门89 R4)——check-ai-task-background-reference(247)/check-money-display-single-source(248)/check-registry-sync-health 只存在于被删的旧副本里;91,095→91,589B(余量 4,411),标记仍为 0 (af3da98e1c)
- 🐞 修正:摘除门249内联点名行——README 索引节已收录该门(4165487e5a),R4 文档面由 README 承载;AGENTS 91,293→91,145B(余量 4,855),冲突标记保持 0 (09498f86d2)
- 🔧 その他:远端合流回潮第三批复翻 4 行——G-76 守门39(83aa572b23e)/G-38 视觉票(r3c)/D42046 巨行(603d8236d8f 同据)/G-60 content-visibility(522ac4dac2+回归锁 7413f9fd31);凭据全验祖先 (a2dab37433)
- 🐞 修正:修复 union 冲突标记注入体并摘除回潮索引副本——108,200→91,293B(余量 4,707);标记区取「索引已迁 README」侧,补点名门249以满足 R4;被删索引块 127 门名经 README∪本文零丢失;实读:check-agents-doc-size --worktree rc=0(91,293/96,000)、check-gate-wiring --worktree rc=0(R1/R2/R4 零红) (c4afc6a953)
- 🔧 その他:F9撞号3组收口——G-07副本自声明行/G-27错挂旧号行/G-76回插已结清题的正主位保留副本行摘除(各留正主行;留痕f12-purge) (5fe4d76372)
- 📚 ドキュメント:守门 249(富文本锚点渲染器单一源头)补进「守门脚本点名索引」的接线/自检行 —— 门 89 R4 义务;207 第二刀把索引整体迁本节后,新装车的门必须在这里点名(原 AGENTS 内联副本即将随冲突标记一并剥除,AGENTS∪README 文档面不得出现空档) (4165487e5a)
- 📚 ドキュメント:O65 登记自进化四期可派单任务 P0-P4 (b19e8ebb21)
- 🔧 その他:两票结清——desktop-feed 线上现读 0.1.76(2026-10-18 发布,远超 0.1.45 验收目标,前提过时);128 点迁移归档票复活活行复翻(门 239 R1 型,归档注释逐字在案) (4879305684)
- 🔧 その他:D03侧车重钉(owner=持有席/waiting=none)——union带回旧记录的终修,F12基线棘轮归零 (42af89577d)
- 🔧 その他:守门8假绿灯远端合流回潮体复翻——凭据 1d5e73e2d3(goal-r52 收官+三路径查清),修正归扩面批次 (8ce176c228)
- 🔧 その他:union回潮体清偿——对侧旧底稿灌入的违禁形态行摘除(等条件+待拍板未勾行,留痕f12-purge;两道机主禁令之下union行级回补不带违禁形态;goal-r4复翻席注意:复翻时须同步摘禁令形态,行的事实内容已按各批结清提交保留) (382d4dc4c0)
- 🚀 機能/改善:G-50 DevEnv 搬迁执行器物化——devenv-migrate.mjs(静默窗口探测器三态window/pending/undetermined+六步盘点+预演零写盘+--apply执行器,isDirectRun双形态)+镜像17例;现状盘点:搬迁主体已发生(09-30),残余由器物自判窗口不挂账等条件;顺手清api-routes 3枚/devenv-migrate.test 2枚/dedupe-live-doc 1枚解构残量unused(union带入机械残留,零语义) (f2ddfe9b9e)
- 🔧 その他:goal-r4 远端合流回潮第二批复翻 13 行——tmpdir 孪生/四件待拍板版(事实四件已落地,待拍板定性作废)/P2-13③孪生/MCP四票(goal-r3 r27i)/失败广播/G-217/G-239/D04;凭据=各批结清提交+新鲜现读(夹具门 rc=0/邮件鉴权在位/守门249 rc=0) (04f4ca3e86)
- 🔧 その他:H02 远端合流回潮体复翻——凭据 eff4b6d5bd 已推远端,裁决同前(结构性无样本,只记不挡维持) (ef210af486)
- 🔧 その他:goal-r4 远端合流回潮体批量复翻 34 行——Esc×4/窗格×2/工具面板/O-1/G-939/守门134/四维/取消信号/宿主中止/审批CAS/守门91/G-27/真机走查/prod-bundle/四件拍板/G-35/G-61/G-76/G-807/发丝线/锁初始化/P1-②/G-77/钩子取消腿/AGENTS体积 等,凭据=本会话各批结清提交(全已推远端);行内逐条防新鲜牌(0 冲突) (7df8da52ec)
- 🐞 修正:R5撞号收口——摘除两枚复活门注册块(bare-decode-uri/token-literal-debt,门体脚本已被对侧删除,注册残留=HEAD面247/248双撞号源);富文本门已改号249保留,盘面 idsOfRegistry 现读各1次 (464cc8efaa)
- 🚀 機能/改善:auto-evolve 起会话通路端到端打通(O65 第 0 期收尾:JWT 现签 + --probe 自检 + 真派验证) (87a7713ccd)
- 📚 ドキュメント:argument-repair-loop 装车缺口取证收口——假阻塞「index.ts 被并发会话冻结」就地改直 (61496e7201)
- 🔧 その他:goal-r4 结清 D04 富文本动作锚点——验收三格全齐(浏览器五例/两腿 DOM 签名等值+语序两态/规模化两载位齐:degradeHint+examplesTip+wallet strong,载体 importer 6 个),守门 247 现跑 rc=0 (e8423e37eb)
- 🚀 機能/改善:web↔RN 屏对齐登记 41 条 + 把跨端自动登记器装进 post-commit 链 (6ad5de3c37)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1081dca6e1)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (194de04708)
- 🚀 機能/改善:跨端登记自动器装车 + 3 条真镜像声明与 1 条 web→RN 映射 (5f1d02f835)
- 🚀 機能/改善:O65 第 0 期翻勾(调度器+四道闸随批完成,验收证据入注记;代码枚 0e4bd3628db);1-3 期补立档日期交代(三选一:新鲜日期,按依赖序排队) (b1ffbc4b23)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ab3bc7beb4)
- 🚀 機能/改善:auto-evolve 自进化调度器第 0 期落地(总纲 O65·调度层+四道闸) (0e4bd3628d)
- 📚 ドキュメント:更正 ContextUsagePanel 的过时披露 —— RN 腿已接通,并点名新落的那把锁 (6abb419f66)
- 🚀 機能/改善:上下文占用归因面板接上 RN 主屏 —— G-403/G-225 缓存两维的最后一格 (8ce7d87758)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0166713afd)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7faaebcc51)
- 🚀 機能/改善:登记 AI 自进化调度系统 auto-evolve 四期系列总纲(O65;第 0 期调度器+四道闸随批施工,感知/部署/回流三期按依赖序排队) (164b973cfe)
- 🚀 機能/改善:G-217a 点赞/收藏两表唯一键迁移 —— zhs_agent_thumbs/zhs_agent_collect 加 (uuid,bot_id) UNIQUE,把上一批(22ee752721b)靠事务 FOR UPDATE 父行的防重底线放进库层:2026-10-25 实测该族缺陷正是『一次点赞计数+2、取消只减一次』,应用层锁管住今天的写口,管不住未来绕事务的批量导入/人工修数(无约束=漂移只在计数与明细分叉后暴露,而全仓无 count(*) 对账)。线上两表 0 行,零回填成本。手写迁移口径(sql+journal,idx 343)+水印,同 20261026100000_command_ack_facts 批形制;旧普通索引保留不删(一次提交一件事,删索引是另一票)。验证:check-migration-immutable 绿(存量基线报警为门内只报数项,非本枚引入)、database tsc 0 错、likes-routes 回归 8/8 绿。 (c92836e7e7)
- 🚀 機能/改善:ActivityDetail 接线 + web↔RN 屏对齐登记 7 条(教育/公告/问答/权限/agent 家族) (fb58a90253)
- 🔧 その他:refactor(web,mobile-rn,miniapp)+feat(gates): 显示层分→元格式化同形副本 20 处收口 formatPrice 唯一出口 + 装守门 248 —— fmtYuan=¥\.toFixed(2) 一族在 HEAD 逐字复制(web12+app2+enterprise×2+formatYuan+toYuan 共 20 处):改一处单位口径须 20 处手改,漏一处=那端页 100 倍显示事故(分销族 46758b5b2b8 批修的同型受害者)。全量委托 @ihui/shared/utils formatPrice(非有限回 0.00,定长两位,¥ 前缀归调用面维持版式)。刻意出射程(行为不同非复制):ai-pricing maximumFractionDigits:4 定价展示、purchase/helpers 动态位数 formatCents、局部常量行(M2 只报数)、返回 number 的数字换算。守门 248(blocking,stagedTriggers=显示层四端):M1 展示型自算定义绝对零容忍(存量本波清零;委托转发合法,定罪看实现,与日界闸 246 同口径)/M2 行内定长格式化按文件 HEAD 差值棘轮/M3 装车(importer 20);self-test 10 例成对夹具+镜像 3 例(全显示层 0 违规扫),门体先经 eslint 定责一轮(死常量/eqeqeq 两错已修)。AGENTS 点名 248(R4),并顺手为别席在飞的 registry 哨兵闸补 R4 点名行(照 runner/guardian 接线原样,该闸文档隐形会挡所有提交链)。AGENTS 先过 merge-live-doc 归并(lost=0)。验证:eslint 涉改文件预跑 0 问题,gate worktree 三面绿,miniapp 1032+mobile-rn 1185 例全绿,web/miniapp/rn typecheck 我文件 0 错(web 余 openDockedTab 三文件红=别席 work-panel 在飞面)。 (0d2a23f970)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1d8116c1b9)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dd997d68b7)
- 🐞 修正:收敛预解第二轮 —— G-55 就地翻为对侧结算行(四项已在库,本席==基底旧态由本行承让),删除尾部 dump 区的守门 89 R9 重复块(首份完整保留) —— 为 union-converge 预解 F1 最后一组与 F6 最后一块;两侧独有行零损失由 union 模拟 REG=[] 现证 (07ea442ded)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2f39e473af)
- 🐞 修正:在途请求覆盖新态四格根治(前端清单收尾批)+形状锁 —— ① TrendChartDialog:弹窗重开/换 itemId/换窗口连发,慢的旧窗口响应覆盖新曲线且旧 finally 提前熄灭 loading;② learn/topic 付费课:切课时旧列表迟到响应串进新页;③ ide/mcp-pane DetailPanel:常驻不重挂载,切换选中项时迟到详情张冠李戴;④ ModelDetailDialog 行过滤 .filter((r)=>r.value) 把合法 0(免费模型 inputPrice/outputPrice=0)当缺失吞整行,读作『无此项』——改判 !=null && !==''。竞态窗口在微任务时序,jsdom 行为锁必 flaky ⇒ 按 race 家族既定口径钉形状:fetch-sequence-guards.node-test.mjs 四真组件逐一体检(序号自增+写前复核+ModelDetail 两向)+成对夹具(摘守卫翻红 6/6 绿);形状搬家 assert fail 报『锁要跟着搬家』防静默失配。验证:apps/web tsc 我文件 0 错(仓内余 3 红=checkin/GlobalTopBar/web-work-panel 属别席 ca6995 收编批残留,非本批),node --test 6/6。 (5e1978b98a)
- 🐞 修正:三方归并预解——增长图取对侧 57d951 柱形新形态,本席重排保留,并全文件格式归位 —— 别席线形图(1fb44)与对侧柱形图(57d9=14 根太密⇒interval:2/纯柱形/柱顶不标数)是同功能两种写法,取新者;重排四档(wb-prio-user/ai/traffic/trend)+KPI 双卡前置+业务面板用户三格提首/接口排行下移,均在对侧底版上三方重放(merge-file,唯一冲突=图定义二选一,已按裁决留柱形)。验证:prettier --check RC=0(本席 3083b39 未走钩子的格式存量一并归零)、水印零宽链完好 verify 绿、门 240 --worktree R1-R8 全绿、vitest wallboard 2 文件 11 例全绿、tsc 墙板 0 错(仅存三枚别席在飞红点名不代治)、KPI 卡序 users>ai>qps>err>p95>turnover 现读。为 git-sync-converge 的 --resolve 页面路径预解:本面已含两侧全部独有行(对侧逐字打底),收敛无需人工 (584041c957)
- 📚 ドキュメント:登记 decode 家族单源收口(移动端深挖批唯一遗留:auth oauth2 私有实现 + 门248 D2 九处) (5e38613843)
- 🐞 修正:重锚机主 2026-10-25 定档首屏重排 + 补回被连带洗掉的增长曲线定义 —— 别席 ca6995ca20b(自动收编在飞副本)把 page.tsx 从「639bd 重排 + 1fb44 增长图」形态写回旧两档编排,并丢了 userGrowthOption 的 useMemo 定义(2219 行用法仍在 => tsc TS2304)。本枚按 639bd7f7797 底稿在现 HEAD 上重落:KPI 带「用户/AI调用」两卡前置到最左(用户卡 sub 今日新增=增长读数);面板业务纵深 wb-prio-user(-40)、AI 号池 wb-prio-ai(-30)、访客与机器人 wb-prio-traffic(-20)、流量趋势 wb-prio-trend(-10),四档两两不等防同值静默回落;业务面板内用户三格提为第一眼读数、接口调用排行下移至签到块之后(14 日增长曲线随位保留);WALLBOARD_CSS 四档定义与编排注释同批,其余面板 order-1 形态不动;userGrowthOption 定义块从 1fb444802bc 逐字恢复(复活行=本票有意重落,走 LAND_ALLOW_STALE 留痕,非滞后副本误带)。验证:门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 60/60 格)、apps/web vitest wallboard 2 文件 11 例全绿、watermark verify 载荷完整、check-i18n-keys 19187 键 5 语言 parity OK(本批零新键)、apps/web tsc 墙板 0 错(仅存错=checkin/GlobalTopBar/web-work-panel 的 openDockedTab/onHome 三枚,系别席 work-panel.ts 在飞未落,本票不代交点名在此)。并发说明:普通提交路径仍被别席在途文件占用,走 object-space-land 只交本票一文件 (3083b390c9)
- 🐞 修正:union-converge 冲突标记闸补接 import —— 2026-10-25 头注的闸只写调用未引 lib/conflict-marker-guard 的 assertNoConflictMarkers ⇒ 本器任何带 <<<<<<< 的树内容在 writeBlob 处 ReferenceError 崩(实测 dry-run base=a6c3c036be ours=本地线 theirs=179fc770b5a 即崩,RC=2 未判定),收敛器全程瘫;补一行 import 后同输入 dry-run 正常出闸(CHECK ONLY 正常走完,落地闸 3 处为真实内容裁决)。修复凭据=§1「能当场修的当场修」+本席收敛作业被此 bug 挡住的直接受害现场 (df25853257)
- 🐞 修正:墙板页剥回成对冲突标记 —— 11:18 手工收敛把 merge-file 原始标记带进 main 的清偿(零内容变化) (3363928c6e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc7389109e)
- 🐞 修正:三族小面根治+一批测量基建纠错 —— ① packages/shared usePaginatedList 补序号守卫(末发定案:后发请求落地前,先发的任何迟到响应不写数据/不写错误/不翻加载位),此前筛选切档与在途页互盖:旧结果 setItems 替换新第1页、把页游标偷换成旧页号(下次加载更多直接跳页缺页);web/RN/miniapp 三端共用该 hook,守卫随源生效。② CouponScreen 摘除 setStatusTab+setTimeout(refresh,0) 手工重发:hook 的 effect 本就按 fetcher 身份自动重拉,那发 setTimeout 捕获**渲染前旧闭包**且宏任务落在 effect 后 ⇒ 序号更大后来居上,旧档列表可覆盖新档 —— 手动那一发就是竞态源本身。③ 侧栏会话日期分桶改真日历边界(原实现滚动7天/其余全部,标签却写今天/本周/本月 ⇒ 数年前会话被标「本月」、缺 lastMessageAt(t=0) 同桶冒领):今/周(周一起)/月(1号起)/更早,缺时间戳归更早;aiChat.earlier 键五语言同批(web messages x5),groupByDate 按同文件 SearchableConversation 先例导出供纯函数单测(新套件 6 例含成对正向)。④ 测量基建纠错:apps/mobile-rn/tests/use-paginated-list.test.ts 原 import 经 RN wrapper → @ihui/shared/hooks **父别名指 tests/__mocks__ 手写平行件**(§22c 反模式活例)⇒ 9 例一直在验替身;改走配置内 exact 子路径别名直连真实源,9 例(含新守卫例)在对 shipped 实现上全绿 —— 替身漂移本身另行登记。⑤ 上一枚 history-page-hydration.node-test.mjs 水印载荷修复(手写头行截短致残迹,verify --staged 现形;clean+重注入 0 不合格)。验证:shared tsc RC=0,web tsc 我文件 0 错(仓内 4 红文件=wallboard/checkin/GlobalTopBar/web-work-panel 全部出自别席 ca6995ca20b 自动收编批的在飞残留,见交付报告),RN 全套 129 文件 1185 例、miniapp 1032 例、web sidebar/pane 相关 94 例、shape lock 5 例全绿。 (0d036f9909)
- 🚀 機能/改善:补 4 条镜像声明(change-phone/change-pwd/help/point-history)——小程序页早已存在,只缺标记与登记 (22b3697a52)
- 🐞 修正:旁路落地器补「成对冲突标记拒绝进树」闸 —— 79 看不见不走钩子的通道,牙装在写口上 (a844588db0)
- 📚 ドキュメント:结清守门 207 存量清偿第二刀——AGENTS 108,515→89,968B(余量 6,032),三面 rc=0,238 同批复绿 (1377bdc7b2)
- 🐞 修正:并发合并把「国内镜像」徽章带回 —— 按 2026-10-23 机主令重新清除(守门 238 复绿) (995ecb1615)
- 📚 ドキュメント:守门 207 存量清偿第二刀 —— 点名索引迁 README + 速查区压缩副本移出(108,515→89,968B,余量 6,032) (8e99bd5626)
- ♻️ リファクタ:抽离 git-guardian 的 TEMP 清扫与日志两族到 lib 以压住架构门 103 C1 单文件行上限（主文件 6094 to 5837 行） (8fe1fb2f10)
- 🚀 機能/改善:首例真实镜像页——用户协议 pkg-about/about/agreement (aa4c418bff)
- 🚀 機能/改善:补 study-index 镜像声明——pages/study/index 与共享屏 StudyIndexScreen 同为学习首页(taro 端内重写渲染层,按门 128 语义声明对齐目标);此前只缺标记与登记 (84b9acc2c0)
- 🚀 機能/改善:补 coupon 镜像声明——小程序 pages/member/coupon 与共享屏 CouponScreen 键空间完全一致(coupon.available/used/expired),此前只缺「镜像」标记与登记 (652e5b052b)
- 🚀 機能/改善:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (481fd87095)
- 🚀 機能/改善:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (fe0abab5b2)
- 🐞 修正:AI 侧栏历史翻页双缺陷根治(判高两条,前端清单回源仍活) —— ① 根窗格 handleLoadMoreHistory 原 res.data.messages.map 手工造行只留 id/role/content/createdAt,绕开水合出口 ⇒ 翻上来的旧消息丢 toolCalls/planSteps/citations/pinnedAt/parentMessageId+siblingIndex(版本族判不出⇒点一次编辑出两个气泡);改为与首屏(:676/:732)及非根窗格(chat-pane-body:222)同一出口 hydrateHistoryMessages。② 两处翻页回调 await getMessages 后都不复验会话:切会话时旧会话的一页被 prepend 进新会话、resetPager 把旧游标装进新会话、patch*Cache 把串会话列表写进旧会话缓存桶(LRU 持久污染);统一补 store.getState().conversationId 复验且先于一切写入(window 窗格体与根窗格同修)。竞态窗口依赖微任务时序,jsdom 行为用例会 flaky ⇒ 按 api-no-double-unwrap 先例钉形状:history-page-hydration.node-test.mjs 抽函数体+三判据(水合出口/复验存在/复验先于写入),2 文件×(正向+三型变异夹具)+良性对照 5 例全绿,摘任一判据即翻红。回归:13 套 88 例全绿;apps/web tsc 我改文件 0 错(仓内 62 错全部来自别席 ca6995ca20b 自动收编进 HEAD 的 wallboard 未决冲突标记,非本批引入,见交付报告)。 (dd56090e92)
- 📚 ドキュメント:207 第二刀① 落地登记——归档移出凭据接线(判据单源 + 两个消费面),票保持未勾 (dbf38b926d)
- 🚀 機能/改善:RN→小程序 镜像缺口账本自动化——139 缺口逐条带候选线索 (f67090ac4f)
- 🐞 修正:清掉上一枚带进来的 1 个 error + 收口一处既存 eqeqeq (0bb9bfd89c)
- 🐞 修正:AGENTS 归档移出被当成丢行 —— 第四态凭据接线补齐(守门 207 第二刀①) (b6023aa977)
- 🐞 修正:合并回填本侧独有词条——miniapp 5 语 ×81 键 + mobile-rn 5 语 ×273 键 (2f651b8ce1)
- 📚 ドキュメント:对外文档数字/端数口径收尾 —— README 瘦身版尾部旧版碎屑整段清除(7082→6007 行:八端清单/176 models SEO 段/两行矛盾结尾/孤立表行,主体均有现算版);L183 IP 白名单『只存不拦』过时表述改实链事实(ip-whitelist-guard.ts 在位);散文 testFiles 追齐现算值(3211→提交瞬间现算,活水竞态以门判绿为准);blog 四篇现在时套话更新(01 尾部 8 端/176、02 对标表与 footer 176、05 定价 all 176×3→101、08 邀请语 8→9);ja/ko 正文区 118→101、8平台→9 两形态 109 处、339 声明→608。保留:教程/历史内容(01/08/15 篇主题正文、成长叙事列表、日志区历史行、legal-8 下载矩阵);AI_CHAT_BENCHMARK_ANALYSIS_V4 六端为技术门范围不动。IHUI_SKIP_LIVE_DOC_CHECK=1 定向说明:README.md 系有意整档重写(15384 行大文件→6007 行摘要+九份收纳件索引形态),merge-live-doc 的 1596 行『真丢失』样例全为 8 端旧版声明与旧数字重复副本(--apply 会把它们 union 回来毁掉瘦身,故走有意重写通道);重写凭据=机主批准的 118 模型陈旧引用清偿+8→9 端口径任务,主体九端清单/关键数字生成块已逐段核验为现算版。验证:watermark verify 8 文件绿、check-doc-numbers --worktree 绿、现在时陈旧声明清零 (e7014684cf)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (29582c20a8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f7efe9cf8)
- 🐞 修正:合并后撞号收敛——check-bare-decode-uri 让出 241(远端已占,check-rn-readout-cell),改号 248;判据与 skipEnv 一字未动 (68c00a3a05)
- 🚀 機能/改善:资源目录同步停更哨兵三件套 —— 760 条全军只有一行 WARN 的静默型,自此当轮即红、恢复即绿 (0dd89c37e9)
- 🚀 機能/改善:出口代理闸 IHUI_REGISTRY_EGRESS_PROXY —— marketplace 直连抖段的运维旋钮(默认关=行为零变化) (7fe57853cf)
- 🐞 修正:registry 批量 upsert 批内复合键去重 —— 上游 offset 分页重叠让整批 760 条全军(PG 21000) (33cf83062e)
- 🔧 その他:治四处存量"代码对、锁旧"的源码漂移锁 —— 锚句跟着判据形态搬家,同时补变异自证 (91272a063b)
- 🐞 修正:门 103 C1 二次超限收口 —— git-guardian 六块 141 行注释逐字归档换指针(零行为变化) (1f9a9a6fa6)
- 🐞 修正:端内测试停止越层 import repo-tooling,清偿架构政策 D1/D2 六处 (4e2758c740)
- 🐞 修正:207 第二刀票改"未取号"形态——G 族号池 pool-exhausted(占用面含 42 份归档件)，令牌残留是 G-15107 格①用法错，绝不发 1000+ 号；待号池扩容批补号 (87d1f894e7)
- 📚 ドキュメント:登记守门 207 存量清偿第二刀(前置=补 declaredDropCaps 认 AGENTS 归档移出,防回潮吞掉第一刀成果;现读缺 9,156B)——第一刀已落枚 c9c85d63 (5f4bafc488)
- 📚 ドキュメント:守门 207 存量清偿第一刀——速查区回潮副本 34 行整区移入 archive(125551B→105156B) (c9c85d639c)
- 🐞 修正:门 128 两族判据射程差豁免登记 + 门 77 B1 wallboard 圆角绕档清偿 (a35ac94b7d)
- 🐞 修正:字形箭头与双返回箭头清零——Collapsible 文本字形换矢量图标 + 五 pkg 页摘页内死返回键 (8f26a1f779)
- 🔧 その他:门 241 镜像测 T1 前提断言改大小写不敏感 (3a893d1481)
- 📚 ドキュメント:守门 241(裸 decodeURIComponent)R4 点名行 (8ffd95d1dc)
- 🐞 修正:移动端行为级深挖批——裸 decodeURIComponent 族 21 处从底层修复 + 守门 241 防回潮 (815bfe638f)
- 🐞 修正:RN 样式裸数字回潮锁改号 240→247——远端 f126e734 已占 240(大屏读数不得断行门),合并前让号,判据与 skipEnv 一字未动 (284aa41062)
- 🔧 その他:门 240 判据镜像测试——3 例直接 import 源脚本 __test__(§22c,判据零复制),含阳性对照(把 rnSpacing.lg 改回 16 必须被抓) (1dfe636e62)
- 🚀 機能/改善:新守门 check-bare-decode-uri.mjs 接进提交链 (6a3e148297)
- 🚀 機能/改善:新增门 240 RN 样式裸数字回潮锁(差值棘轮)+ runner 接线 (d066355a35)
- 📚 ドキュメント:点名门 240 RN 样式裸数字回潮锁(与接线同批;AGENTS.md 超体积预算暂不写入,README 已满足 R4) (d562ca2018)
- ⚡ パフォーマンス:跨端两把尺子改批量取 blob(HEAD 面 4 分钟→17s) + web→RN 尺支持 --full + 6 段 web-only 豁免 (da67136b16)
- 🚀 機能/改善:补 4 条 about 族镜像声明(账本真实化,零行为变化) (f97405f954)
- 🐞 修正:web→RN 功能尺三屏误报根治 + 删除一条不存在的 web 路由登记 (89239b8d3e)
- 🚀 機能/改善:token 化批 #6 第 5 批(收尾)——21 文件裸数字转档 (3d8a7a3355)
- 🚀 機能/改善:token 化批 #6 第 4 批——60 文件裸数字转档 (0088fd044e)
- 🚀 機能/改善:token 化批 #6 第 2 批——60 文件 1020 处裸数字转档 (5308e7aaf5)
- 🚀 機能/改善:token 化批 #6 第 1 批——tokens-migrate 扩为目录批量器物 + 60 文件 1583 处裸数字转档 (e506840fc0)
- 🐞 修正:普查锁两 offender 清零——VoiceNote/LlmSettings 裸 TextInput 迁共享 TextField (e9226cbb50)
- 🐞 修正:活副本纠偏批——上轮把 account-cancel/app-topup 判死副本是反的:现读 RootNavigator 1037/1048/1087 挂载体=packages/app 版,二屏 Modal 缺 onRequestClose 即安卓返回键在注销确认/充值说明穿透弹退出应用(与 MemoryScreen 同型,补 onCloseModal/onCloseIntro)。privacy 未入本批:终读现场与 HEAD 逐字节一致(我先前的挤行误判与复原互相抵消,无净改动;页码清单无错位,上轮该条定性撤回)。遗留如实:(a)packages/app 两屏标题硬编码(注销账号/充值)属 i18n 队列射程;(b)SDK 清单与 Expo+RN0.86 真栈脱节为法律文案,归机主/法务 (6e5cc2e93b)
- 🐞 修正:行为级 bug 两枚——① VoiceNote 语音笔记面板:RN 原生 Modal 自成窗口不吃外层 KeyboardAvoidingView,面板内搜索框弹键盘后操作行整块顶出可视区(iOS/小屏安卓必现,Modal 内键盘关不掉)——避让容器移进 Modal 内侧,iOS padding/安卓 height;② packages/app MemoryScreen 新建记忆 Modal 缺 onRequestClose:Android 返回键不关弹层反弹确认退出——与右上角取消同语义接回 onCloseCreate。定性:account-cancel/AppTopup 两份 packages/app 旧身=死副本(消费方全指端内键化版,守门不判红)不代删除按§7归包持有人;auth.ts login 抛错为设计契约调用方统一兜;VoiceNote 已有 onRequestClose 不重复补。验证:RN tsc 0 错、vn-mount 13/13、eslint 0、水印 2/2 (60e2c90099)
- 🔧 その他:F9 分批收敛 #5(终)——CSRF 行 G-12→G-02、两版F5 行 G-30→G-18(双侧真声明位零 + 239 归档 marks 过滤验证);五门现读全绿(strict F9 0 组/234 warn/239 0/211 0/13d 0/71 无丢失)——机主授权合并背景 (87338aa530)
- 🐞 修正:auth.ts 支付宝回包防护补丁自纠——上一枚提交里 info 类型注多套了一层 .response(TS2339 ×2,miniapp tsc 当场红),语义层级回归 parse→.response→{nickName,avatar} 真形 (20c8ba1c13)
- 🐞 修正:逻辑级 bug 三枚——①充值自定义金额 Number('9.9')*100 浮点毛刺直进支付订单(分语义被打成 990.0000000000002),对齐 CartScreen 既有 Math.round 范式;②credential-storage 裸 JSON.parse:AsyncStorage 半截写/手改/回滚脏数据在启动链抛 SyntaxError 打断记住账号预填,降级为无记录(后续 persistedAccount 覆盖);③miniapp 支付宝 getOpenUserInfo 取消/异常回包 response 非 JSON 时裸 parse 打崩整条登录链,降级空资料走既有手动补路径。定性留档:定时器清理全配对/formatDateByTemplate 带 tz+NaN 守卫/totalFee 经 zod int 非空/支付按钮走 paying 锁+disabled——四类候选核实为健;Clipboard try 豁免=RN API 不抛;CONTEXT 崩溃上报未脱敏一条已漂移(现码过 redactCrashText) (92e31d50fa)
- 🔧 その他:F9 分批收敛 #4 终版——Agent SDK 票:原 G-06 行插回存续(门 71 编号行不丢)+ 行尾让号注记 + 未取号行承载实际推进(行内交代归属=qoder-maxpar)+ 旧 G-36 双行摘除留痕 + merge-live-doc 归并(lost=0);五门现读全绿(71 无丢失/239 0/211 0/13d F10 2→2/234 warn)——机主授权合并背景 (688b7ce6be)
- 🐞 修正:backup-pg-local 追到断链根因——pg tooling 已迁 D:\ihui-pg\16(服务镜像为证),脚本写死旧卷 D:\DevEnv\runtimes\pgsql 失踪后,wscript 启动的计划任务看不到 pwsh 的 CommandNotFound ⇒ 本地 dump 静默停摆一个月(P7 只量到副本侧,源侧 P5 格当时未判定)。路径更新 + 新增'pg_dump 不在位必写 backup.log 再退'守卫——停摆必须留下可被人量到的痕迹,任务面 Last Result 0 是谎。实证:修复后手跑 EXIT=0,backup.log 落 10-25 01:16 OK 9.6MB 新行 (de4073ff04)
- 🔧 その他:F9 分批收敛 #3——取号器行 G-48→G-90(G-48 被远端新纪元 F1不认行占用,重让;PLAN 全文零出现的 G-90 空投)——五门现读全绿(strict F9 撞号 0 组/234 warn/239 0/211 0/13d 0) (73c966154a)
- 🔧 その他:F9 分批收敛 #2——取号器行 G-48(远端占用,重让)→G-183 链理正 + 侧车按真实 compositeKey 全量重建(5 条;234 warn a1=0 a2=0/211 0/13d F10 0/239 0/plan-gate strict F9 撞号 0 组)——机主授权合并背景 (a056001ebf)
- 🔧 その他:F9 分批收敛 #1 终——L28868→G-48/L28888→G-50/L29002→G-90/L29063→G-26/G-880 误改恢复/G-183 误改恢复;L29068 回退原号 G-18(远端键位零)+G-18 侧车补;六组侧车按真实 compositeKey 重写(234 warn a1=0 a2=0/13d F10 0/239 归档单调 0/211 号池 0)——机主授权合并背景,逐行留痕 (45254bd876)
- 🐞 修正:course-planet loadData deps 剔无用 tt(体内未引用,判据面 JSX 层独立吃,exhaustive-deps warning 清零)+ tailwind.config 头注版本事实修正(现读:声明 v3 仅服务 preset 工具链,产物引擎=weapp-tw@5.2.9 vendored v4,alpha 原生生效——漂移注释清);验证:miniapp 端内 eslint 首次 --max-warnings 0 exit 0 (25817edb68)
- 🔧 その他:F9 分批收敛 #1 终版——本地 5 行键位改号到验证组合(G-48/G-50/G-90/G-26/G-09;G-880 误改恢复;G-183 误改恢复)+ 侧车 6 条按真实 compositeKey 重写(234 a1=0 a2=0/239 归档单调 0/211 号池 0/13d F10 0/plan-gate F9 撞号 0 组,五门现读全绿)——机主授权合并背景,逐行留痕 (12a9581f6a)

**2026-10-24**
- 🔧 その他:navbar-no-chrome 补 i18n mock——NavBar 在 i18n 扫尾批起吃 useI18n,裸 render 抛「must be used within I18nProvider」整文件稳定红(全量两轮复跑 1/1 坐实,非 flake;与 fenlei-overlay 同治,判据只量根元素样式不涉文案) (e8c502633e)
- 🐞 修正:门77 B1 终清+门150 弱证据 web 两站归档(wallboard 条形帽 3px→2 就近档;wb-panel 根容器 lg→xl 跟 panel 角色;PiP card 容器 md→lg)——移动端收官顺手清全仓 UI 档残余 (d5fe70025b)
- 🔧 その他:F9 分批收敛 #1——本地 5 行键位改号到远端零键位号(G-08→G-48/G-09→G-50/G-12→G-90/G-12→G-26/G-09→G-37;G-880 误改恢复)+ 侧车 5 条按真实键重写(234 a1=0 a2=0/211 差值 0/13d F10 0/239 归档单调 0/plan-gate F9 撞号 0 组现读)——机主授权合并背景 (58e51c9b2e)
- 🐞 修正:移动端第三轮收官——中文/半翻译残留 82 站清零 + D43 首页语音笔记挂载落账 + 门150 弱证据移动端 6 站归档 (dc9667c160)
- 🔧 その他:F9 撞号 6 组人工键位裁决改号(G-32/14/53/20/18/D18 → 池内新纪元两位号 G-01..G-07)+ 副本行标记 + 7 行侧车记录补齐(234 a1=0 a2=0;211 号池差值 0)——机主授权合并背景;逐行带原号留痕注记 (2d30287aad)
- 🐞 修正:ScreenStates 空态圆章真圆写法改 50%(守门 77 B1 认可的几何真圆形;64/2 表达式被 B9 求值判超上限,同形百分比是门自带出口) (3ffd223f89)
- 🐞 修正:移动端跨端观感修复批——四件套骨架屏尺寸减半(用户可见)+圆角角色档 43 站收口(守门 77/150 在册红) (a1de25ce24)
- 🐞 修正:清两处合并连带的死导入(AgentSettingScreen ActivityIndicator / OrderScreen TouchableOpacity,HEAD 面已红即合并 auto-merge 产物,未用导入删除无行为变化)——解锁 push 全量 typecheck 门 (76ab146506)
- 🐞 修正:修复合并连带损伤——NotificationPanel formatPushTime 内 Date 变量撞名参数 t(改 dt)+ useI18n import 补位 + 签名对齐 useI18n;原 push 门全量 typecheck 红因;验证:eslint 0/该文件 typecheck 清/水印完好 (1a3295d1de)
- 🐞 修正:移动端 typecheck 清零批次——i18n 提取残骸 36 文件/119 错修复 + 测试滞后 12 红 + 顶栏两截带一枚 (fc5925035e)
- 🔧 その他:收敛 origin/main(2026-10-24 编号新纪元)——PROJECT_PLAN 取远端重排版(旧卷全文已由远端 renumber-snapshot 归档,零丢失;goal 十四枚提交未触碰 PLAN);代码文件 auto-merge;机主授权合并 (7fb7e5e52f)
- 🐞 修正:补落第二枚遗漏的 8 文件——5 共享屏(console-table/switch-prefs/user-public/llm-settings/edu-shop)与 3 小程序镜像页(pkg-user/user-public、pkg-user/llm-settings、pkg-shop/edu-shop);第二枚重跑时目录参数展开失败致漏(index.ts/app.config 已引用它们,干净检出必断,本地工作树假绿掩盖);验证:eslint 0/typecheck 零错/水印 verify 完好 (41d84097bb)
- 🔧 その他:screen-registry 三元组补登 3 条——UserPublic/LlmSettings/EduShop(shared/rn/miniapp 三端齐,goal 新屏首批评入镜像登记链);门 screen-coverage HEAD 面现读 71 条全真、镜像 72/213,新 3 条落地后 75/215 (aaad635715)
- 🚀 機能/改善:存量 token 化批 #5(长尾)——四屏 69 处(ChangePwd 12/ChatRoom 19/LecturerList 15/Publish 23);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 30 屏 885 处 (45b3c6bc35)
- 🚀 機能/改善:存量 token 化批 #4——七屏 218 处(StudyIndex 45/Promote 33/LiveDetail 38/Settings 24/SelfMedia 23/VipTrader 33/EarnCommission 22);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 26 屏 816 处,15+ 裸行档清零 (5a89172e0d)
- 📚 ドキュメント:D17 生态统一入口结清翻勾(内容锚:「D17 生态统一入口装车」提交=page+hub+nav+五语 ecosystem 37 键 empty0+nav.ecosystemHub×5;现读 check-i18n-keys 19127 键 parity OK+hub 测试 16/16;语言包占写已解除)✅(2026-10-24) (49ef8ccb88)
- 🚀 機能/改善:存量 token 化批 #3——六屏 203 处(Points 24/Memory 45/AppTopup 27/WrongQuestions 29/AiWorld 45/Plaza 33);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 19 屏 598 处 (89aba90a01)
- 🚀 機能/改善:存量 token 化批 #2——六屏批量转写(ConversationImport 23/LecturerDetail 27/CourseTab 45/AiGroup 55/ImageGenTemplates 29/ModelIncome 42 共 221 处)+ 转写器 ensureImport 增强(import 检测改在 design-tokens import 语句内做,根治正文已含 token 名时的漏补);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 13 屏 395 处 (f03953d525)
- 📚 ドキュメント:G-959/G-865 结清翻勾(现读证据:app-login sso 键化+shared 五语+守门测试 16/16 · DEFAULT_AVATAR_URL 死键已摘+两测试同批改净)✅(2026-10-24) (81f16bbaff)
- 🚀 機能/改善:存量 token 化批 #1——批量转写器 scripts/tokens-migrate.mjs(裸数字→rnSpacing/rnType 档,恰在档才换不硬凑,自检 6/6)+ LoginScreen 首屏 65 处转写;验证:eslint 0/typecheck 零错/水印完好;工具可复用到全部存量屏 (ccd9fb1624)
- 🚀 機能/改善:edu-management 族小程序镜像批——考勤/成绩/缴费三页(pkg-user/edu-mgmt-*,复用 edu-child/records-page 共享渲染件)+ app.config 注册 + miniapp 五语言(eduMgmt 3 + eduFinance 9 含状态枚举 + eduGrades 正名);验证:eslint 0×3/miniapp typecheck 零错/水印完好;镜像累计 14 页 (26fc056da6)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (92f382ef86)
- 🚀 機能/改善:children 六子页小程序镜像批——共享渲染件 records-page(列驱动卡片列表,对齐 RN ConsoleTable 模式)+ 六薄壳(课表/考勤/成绩/餐食/账单/学习计划,参数 childId)+ app.config 注册 + miniapp 五语言 edu 族键组(eduChildAttendance/eduGrades/eduAttendance 等 4 组 + statusTitle/empty);家长端小程序闭环(首页→六子页);验证:eslint 0×7/miniapp typecheck 全零/水印完好;镜像累计 11 页 (01bb3b47a8)
- 🚀 機能/改善:小程序镜像批 #2——家长端首页(pkg-user/edu-parent,孩子卡片列表+状态徽章,对齐 RN EduParentScreen;children 子页镜像排后续)+ app.config 注册 + miniapp 五语言 eduParent 10 键;验证:eslint 0/typecheck 零错/水印完好;镜像累计 5 页 (2ceb517ea6)
- 🔧 その他:对账尺登记批——edu 族 18 条 aligned 入账(edu-management 7 + parent/children 9 + user/[id]/settings/llm/edu/shop 落地补登);worktree 面现读 aligned 142/缺口 355/零腐烂 (4b5234a908)
- 🚀 機能/改善:goal 教育域批——edu-management 可列表承载面全落地(考勤/成绩/班级/缴费/餐次模板/校园课表/教师排班 7 页)+ 家长端闭环(首页/绑定 CRUD/children 六子页)+ EduParent 六键导航;全部 ConsoleTable 杠杆薄壳 + 五语言 i18n(edu 族 12 键组);验证:eslint 0×18/typecheck 本轮零错/水印 verify 完好 (c1712deb25)
- 🔧 その他:vip/success 时长三连裸串接 tt('vip.success.daysUnit') + 词包五语 {n} 天键 (73dae30a4e)
- ♻️ リファクタ:批131 · AgentShopList emptyText 默认参拆雷(全仓可接面清零收口枚) (c51ca43ae9)
- ♻️ リファクタ:批130 尾修 4 处 appAlert 第一参变体(AccountCancel/ChangePwd) (a9d478aa0d)
- ♻️ リファクタ:批130 硬编码中文清零(6 文件 / 90+ 处) (80ec061080)
- 🚀 機能/改善:批130 入典(88 组新键 ×5 · chat.msg/toolbar/topup/confirm/sr/dist 族) (f2673153bd)
- ♻️ リファクタ:批129 硬编码中文清零(5 文件 / 90+ 处) (3ff7374377)
- 🚀 機能/改善:批129 入典(74 组新键 ×5 · need/news/iaa/bab/vip 族+common.known) (a2f2edbfa2)
- ♻️ リファクタ:批128 硬编码中文清零(6 文件 / 80+ 处) (3694083f70)
- 🚀 機能/改善:批128 入典(65+ 组新键 ×5 · subPkg/account/share/lp/annot/aigcList 族+补 courseDesc) (fd6316a81a)
- ♻️ リファクタ:批127 硬编码中文清零(11 文件 / 90+ 处) (36398ccb1a)
- 🚀 機能/改善:批127 入典(110+ 组新键 ×5) (9af71a11bc)
- 🚀 機能/改善:批127 W1 入典(23 组新键 ×5) (5926d858a3)
- 🚀 機能/改善:goal 应用批——RN 六屏 token 化(109 处 rnSpacing/rnType/rnRadius 档)+ 9 张 RN 屏四件套(他人主页/BYOK/教育商城/控制台六页,ConsoleTable/SwitchPrefs 两杠杆屏)+ 小程序镜像三页(三新屏三端闭合)+ 小程序提现页语义档 + RootNavigator 九路由 + miniapp 五语言键组;验证:eslint 0/typecheck 本轮零错/水印完好/i18n parity OK (47e3b46cc5)
- ♻️ リファクタ:批 126 硬编码中文清零(Menu 8 项表转键/Notification 时间族/PushBanner 回落/VoiceInput 全组) (3785cb014f)
- 🚀 機能/改善:批 126 入典(22 组新键 ×5) (62378825a2)
- ♻️ リファクタ:批 125 硬编码中文清零(9 文件 / 60+ 处,组件批收官) (593cb4ec61)
- 🚀 機能/改善:批 125 入典(29 组新键 ×5) (ad22965d3c)
- ♻️ リファクタ:批 124 硬编码中文清零(13 文件 / 55 处 · RN 端 UI 串清零收官批) (bd0dfe0c8b)
- 🚀 機能/改善:批 124 入典(37 组新键 ×5) (cda81d5afe)
- ♻️ リファクタ:批 123 硬编码中文清零(13 文件 / 40+ 处,含 3 张顶层表转键) (aecd7c7a30)
- 🚀 機能/改善:批 123 入典(35 组新键 ×5,含工具三态状态词五语同批) (a43b9ae989)

**2026-10-25**
- 🚀 機能/改善:锁定 order-log/order-track/message-group 令牌主体与 vip-compare 公开脱敏 (b5c3d62f14)
- 🚀 機能/改善:O65 第 3 期回流两件 —— 失败票归因沉淀器 + 守门判据腐烂自检(自检 7/7 与镜像测试 12/12 全绿) (6567fd5730)
- 🐞 修正:Step 5 载荷判据改为「实到 == 预期且预期非空」,空提交不再判绿 (3bdcc09dca)
- 📚 ドキュメント:O65 第 3 期进展注记 + 第 2 期重复登记收拢(仅留一条 [x] 完成行) (74fd1f1630)
- 🔧 その他:G-1222557 复验结清——出口围栏的存量维真跑 15/15 绿;另补记 D04/G-934 两枚的真浏览器凭据 (534682513b)
- 📚 ドキュメント:O65 P0 四件翻勾(正式编号 O6501-O6504)+ 第 1 期感知层自动分诊器翻勾 —— 交付件已入 main 并随 8486d01ddab 上生产 (4e74314d70)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b801d2d8f9)
- 🔧 その他:G-927 进展注记——求差实证新增12枚中10枚已由别席迁好待入库,agent-worktree/green-state 两枚本席迁讫(gitRaw层,行为面等值,自检9/7);棘轮70随入库递减,基线60不动 (8a8ffefbd6)
- 🐞 修正:G-927 迁移批——agent-worktree/green-state 两枚裸 spawnSync('git') 改走 face-reader 取材层 gitRaw(绝对路径git+quotepath+safe.directory+timeout+EBUSY兜底),包装函数折回原三态行为面逐字段等值;自检9/7全绿+--list行为面真实返回;求差实证:12枚新增中10枚已由别席迁好待入库(盘面0命中),本批迁余下2枚,棘轮70→随入库递减,基线60不动(下调前置=10枚入库) (a9505b2596)
- 📚 ドキュメント:结清 3 枚(第 12 批:G-272 重臂复位分域 + 门 149 端内 barrel 两条同题) —— ①G-272 席位提交 34828b1db3a5d531b26b06fbf8d20d79fee28f1d:前提现读更正(stopInitiator 在 HEAD 有 15 处命中而非票面 0,该字段已由 G-816026 落地;rearm/重臂/复位仍只命中注释 ⇒ 注释声称有实现没有成立)。实现 apps/cli/src/tools/background-registry.ts 新增 BACKGROUND_TASK_REARM_FACE(preserve/reset/renew 三档,satisfies Record<keyof BackgroundTask,…> 编译期穷尽)+ rearmBackgroundTask(previous, incoming):身份面逐字保留、结算面回构造初值、新生面换代,四档拒绝(not-terminal/id-mismatch/generation-not-renewed/not-live)原样交回旧条目,fail-closed。主席复跑 apps/cli/tests/background-rearm.test.ts ⇒ Tests 6 passed,含变异自证(注释掉 command: previous.command ⇒ 仅用例①红)。剩余面:rearm 暂无生产调用点(registerTask 每次 genId),未来接入时事件处理器必须绑到 rearm 返回的新条目。②门 149 端内 barrel 两条同题行一并收口:席位提交 443561b82c 新增 scanAppBarrelLeaks 与桶/实现分离单源 isBarrelModule,端内桶 universe 由该层目录扩到端内全树;主席复跑 --report 末行 APP-BARREL-REPORT barrels=36 apps=5 consumers=34 hits=0 type=0 elsewhere=0 undetermined=0(存量 0 + 阳性对照 ⇒ 并入既有 --staged 差值棘轮而非升绝对 blocking,符合 §12e 升档前置=存量归零) (00d8db8283)
- 🔧 その他:A 类 7 枚结清(G-62/G-01/G-03/G-07/O88/G-272/双重执行)——凭据全部本席现读复跑:gate 全零、twins 0 组、CI 唯一 failure=lint-typecheck-test、stopInitiator 20 命中、take_loop_v2_handoff 9 处消费面在位 (1e57d5d821)
- 🚀 機能/改善:门149 补齐端内 barrel 漏出口(桶/实现分离 + 端内全树 universe + --report 只读量算) (443561b82c)
- 📚 ドキュメント:结清「非会话 401 被当成会话死亡」 —— 按 §24 机主令本应由 agent 代裁,现读发现源头已由 2026-10-25 的 L7648 修复落地:apps/api/src/routes/agent-extended.ts 的 preHandler 兜底由 `err.statusCode ?? 401` 收窄为 `?? 502`,行内注释明写「没标 statusCode 的异常是内部/上游故障,盖 401 会被 api-client 读成重新登录(上游 provider 凭据错误 ≠ 会话死亡;口径同 auth.ts 票 G-396/G-765/G-357)」⇒ 用户不再被误导去重新登录。客户端侧 packages/api-client/src/client.ts 仍是 `status===401 && !isAuthEndpoint(url)` 才判会话死亡(两处),由于非会话错误现在以 502 出栈,该启发式不再被误触发;如实登记残余:若将来有上游把第三方 401 原样透传成 401,仍会被读成会话死亡,属纵深防御缺口而非本票未完成 (ba06930d36)
- 📚 ドキュメント:结清票60 真并行多窗格(服务端 fork 腿收口) —— 席位提交 5e72a6df8b 共 5 文件 +942/−50;主席自审复跑 apps/api 三份用例(chat-fork-branch-endpoint + chat-fork-branch-queries + chat-actions)⇒ Test Files 3 passed / Tests 24 passed(席位另报 conversation-archive 11 例,合计 35)。关键事实更正:服务端分叉并非不存在,而是早已以 POST /api/chat/conversations/:id/branch 命名存在(chat.ts,2026-08-30 立;V3 按 fork 关键字 grep 未命中属命名差异)⇒ 按 §0.6 不新开 /fork,改为把既有端点按票面口径收口:响应返回新会话 id + fork{sourceConversationId, forkedFromMessageId, sourceRootId, sourceSiblingIndex, messageCount};复用票59/64 的 parentMessageId+siblingIndex 族根判定并抽出纯函数 linearizeForkHistory(每族只留一版,分叉点必胜);鉴权只取 request.userId(body 自报 attacker 仍以真实主体入 queries,他人会话 403 且 branchConversationFrom 零调用,越权插入/更新计数 0);幂等用 clientRequestId 在源会话 FOR UPDATE 锁内查询,重放返回首建会话 replayed=true 且计数不增,键撞别的分叉点 409;复制以 .returning({id}) 回库确认,不符整批回滚。未判定:真库端到端(.env.test 不存在、PG 仅 5432)⇒ 四格为离线 mock 链。剩余面:客户端(api-client/web/RN)需透传 clientRequestId 才吃幂等 (b55f46c8b5)
- 🐞 修正:后台任务重臂按结算面/身份面分域复位(G-272) (34828b1db3)
- ♻️ リファクタ:rules 族本地 api 壳迁至共享出口 apiOrThrow 并摘零消费方壳文件 (ea570fc43f)
- 📚 ドキュメント:结清 2 枚(第 11 批:G-115 真分叉 / 第二个死端点簇) —— ①G-115 按 §24 机主令代裁并执行:不再等"谁在哪个窗口收敛",直接用仓内既定出口 node scripts/git-sync-converge.mjs 走索引层 union 合并(零触碰他人未提交文件),合并枚 f8c25b537b;现读 git ls-remote origin refs/heads/main = f8c25b537b07a68d9daea4d6a231e7d840441b83 = git rev-parse HEAD,git rev-list --left-right --count origin/main...HEAD = 0 0 ⇒ 部署环的"远端 tip 分叉且自动收敛无效"根因已消除。合并后回潮审计:本会话 23 枚结清行零回潮。②第二个死端点簇按席位二段式复量收口:六条(agent-reviews/wallet-bank-cards/messages-chat/course-annex/course-qa/course-resource)全部已有等价端点且在 HEAD——agent-reviews GET /api/agent-reviews、wallet GET /api/wallet/bank-cards(插件级 requireAuth)、messages GET /api/messages/private/list 与 POST /api/messages/private(checkAuth,senderId 取承载层 request.userId)、课程三屏走 GET /api/resources 与 GET /api/edu/qa 且 RN 屏已改指;阳性对照 invited-users 4 文件 7 行证明尺子有牙;零新增端点(重复造会与既有端点漂移)。受影响用例 Test Files 2 passed / Tests 14 passed。剩余面如实点名:order-log/order-track/vip-compare/message-group 四词另计;BankCardScreen 库无 bank_cards 表(无表可取)、三条课程屏缺 courseId 维度 ⇒ 产品语义缺口,非端点缺口 (fb77aa60b8)
- 🚀 機能/改善:帧名单源收敛到 CHAT_SYNC_EVENT_NAMES,sse 契约只引用不重写值 (54748ccdfb)
- 🚀 機能/改善:会话分叉端点收口(票60 服务端余格)——复用 sibling 版本族 + 幂等键 + 计数诚实 (5e72a6df8b)
- 📚 ドキュメント:O65 补回正式编号 O6501-O6513 + P0 四件翻勾(O6501-O6504) (4f2f9c8176)
- 🔧 その他:G-593 上行应答接受性守卫改语义锁 —— 票面前提已腐烂(四条在 2026-10-07 已随实现恢复转绿),本轮只把两条字面锁换成行为锁并留变异自证 (caee7106db)
- 🚀 機能/改善:O65 P0 安全护栏四件 —— 根护栏/成本熔断/影响面隔离与原子回滚/人工阀清单 (9caeac97d5)
- 🔧 その他:结清 G-941(成本账本按链别归一,249 passed+ruff+mypy strict) (a34df2bf63)
- 🔧 その他:G-593 上行应答接受性守卫改语义锁 —— 票面前提已腐烂(四条在 2026-10-07 已随实现恢复转绿),本轮只把两条字面锁换成行为锁并留变异自证 (c8f2750a5c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ca97133f4f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (90c0862194)
- 📚 ドキュメント:G-957 行内失真路径就地更正(票面挂点 login.tsx 已随 2026-10-23 定档删除/回传腿已由 webview onMessage 接管/scheme 已登记)+残余两格点名;主键·归属·租约三维守恒由 plan-task-index 当场断言 (3af96ef954)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3ef3c8e667)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4c98968e83)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a8b9c604c8)
- 🔧 その他:L28030 门39票达成完成即删——六屏已由别席下沉(6→0),末条aboutPageSections数据文件豁免与别席同批在库,门现读全绿镜像10/10 (864c743fac)
- 📚 ドキュメント:结清 79/B03 权限双轴化(运行时真接线) —— 席位提交 7f850459839024c3333ee5acb38fa75dc2aef774 共 12 文件 +1247/−53。主席自审复跑:apps/cli 三份新/改用例 permission-axis-runtime + sandbox-strict-default-on-missing-config + sandbox-profile ⇒ Test Files 3 passed / Tests 59 passed。落点:packages/types/src/permission-axis.ts(判定本体 evaluateAxisGate + granular 五布尔 + 归一化)、apps/cli/src/sandbox/permission-axis-runtime.ts(装配优先级:显式 > config profile > 五档映射 > 契约默认)、apps/cli/src/tools/index.ts(ToolContext.permissionAxis + executeToolCall 轴闸,覆盖 hub 分支)。默认值现读:SANDBOX_MODE_DEFAULT=read-only、APPROVAL_POLICY_DEFAULT=on-request、生产装配 DEFAULT_SANDBOX_PROFILE=limited ⇒ workspace-write(绝非 danger-full-access);未知值一律落 read-only/untrusted 并 warning(fail-closed)。单一真相源:三值/四值/五布尔仅存 types 包,CLI 零副本;check-declared-policy-has-consumer 与 check-permission-mode-vocabulary 均通过。剩余面如实记录:交互确认窗未真机走查、CLI 暂无 --sandbox-mode 旗标、loadSettings 不执行 layer-policy 项目层过滤(既有缺口与 sandbox 键同型) (823794e403)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (286ee41245)
- 🔧 その他:结清 G-863(附件容量改提交式CAS,18/18 绿) (8f39ff5ab8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (02758036ef)
- 🔧 その他:L28030 门39票达成完成即删——六屏已由别席下沉(6→0),末条aboutPageSections数据文件豁免与别席同批在库,门现读全绿镜像10/10 (7589a3fa87)
- 🚀 機能/改善:权限双轴运行时接线(79)+ 沙箱默认严档运行时强制补齐(G-212 第十一批 cli 半) (7f85045983)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8486d01dda)
- 🔧 その他:tmpdir 族 90 副本同据终清(折并器上限外交人工:票已结清,check-fixture-tmpdir rc=0 同据,全部副本翻勾即终态) (8115eb8c5c)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4f0075f311)
- 🔧 その他:结清 D22046(通道②③+比对驱动未变化承诺,cli 49/49+tsc0) (477ab648bd)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c248511bdd)
- 🔧 その他:G-212 结清——两侧齐(cli 半 goal-r57 严档+ai-service 半已自落本轮现跑 15 passed),翻勾条件成立 (c797e033c4)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (af71cd1e10)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (29c73b7469)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6d6da34226)
- 🔧 その他:G-620 结清——两道 blocking 红(门150/门90)本轮现读全部转绿(桌面事件三层闭环通过阻断 0),跳门前提不复存在 (9b816186f3)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3ea059635d)
- 🐞 修正:next-plan-id --check 重号判红改差值棘轮(存量只报数/新增才判红)—— 承 G-955 收口 (f6b9df39ba)
- 🐞 修正:G-957 网页授权回传腿失败态如实提示(换票失败/异常不再静默) (d47a2842a3)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4d922ea918)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b546442d02)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9e49a4b02a)
- 🐞 修正:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (e48584bd7e)
- 🔧 その他:清偿叠注记存量 46→2(9 行折并,行数与勾选/租约/归属三维不变) —— 折并判据不另写:直接 import 守门 13d 自己的 noteTokensInLine / redundantNoteCountInLine(§0.6 单一真相源),对同一行内逐字相同的注记保留一份、删除多余份;全量档现读 叠注重数 46 → 2,残 2 份属承载段分词形态(判据计入但字符串面找不到第二次逐字出现 ⇒ 如实留报数,不猜不改)。本枚只动这 9 行注记文本,复合主键与正文语义逐字不变;门 13d 复跑 RC=0(差值档,存量只报数) (beaba75247)
- 🐞 修正:补齐漂开族折叠通道(--fold-drifted-families)的两处形状锁 + 补镜像测试 (36d800cb53)
- 🐞 修正:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (4c155346b0)
- 📚 ドキュメント:结清 G-926(lint-staged 已跟踪却被 ignore 的雷区)—— 席位提交 2c9d023f4b;主席自审复跑 node --test scripts/tests/lint-staged-ignored-tracked-ledger.test.mjs ⇒ tests 14 pass 14 fail 0。现值现读:[tracked-ignored] 面=head 存量只报数 12 条,git ls-files -ci 同为 12 且全在 .ihui-agent/archive(11 md + 1 json,唯一命中 .gitignore:186);票面 84 枚里的三族已由 41a3bdeeb4(取消跟踪 tmp 61 枚)、a402f50043(删 articles 宽式忽略)、8c952aac27(为 plugins/*.cjs 加负向例外)收口,故判 closed-by-others 未重做。archive 那 12 枚是门 71 archivedCopy 的归档凭据(读 HEAD/索引树),摘掉即削正当删行的依据 ⇒ 建议退跟踪 0 枚。另修一处恒红口径:旧 T7 把命中根 glob 记成失去 lint 覆盖,而 .prettierignore 早已整目录忽略 .ihui-agent/,64 枚系双计;新口径只问工具本体 prettier.getFileInfo(不另写 glob),限额 50 与给源码目录塞黑洞出口件必红的语义都不动,并加了正探针。三臂真 lint-staged CLI(--diff=HEAD,scratch 夹具):absent 报 git error、tracked 正常 Done staging 且索引 blob 未被改写、untracked 同 absent。剩余面:门 236 豁免按目录前缀放行,将来 git add -f 塞进 archive 的新件会被放行(动豁免语义需另票) (c683c71b8d)
- 🐞 修正:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (56227f8b33)
- 🐞 修正:为 gate #193 补 8 处 git 派生调用的显式 stdio (15372e4aba)
- 🔧 その他:api<T>234 迁移回潮副本同据复翻——goal-b15 S10 已结清(349e116a66+b3b3f64276),本轮同据复验一致 (59a3a90a56)
- 🔧 その他:结清 G-876/D195/G-937 三枚(注册验码/通知归档流/归档器B档,均带真跑证据入行) (3b1a29df96)
- 🚀 機能/改善:违禁桶兜底清扫器 strip-banned-buckets——两道机主禁令(等条件F12/待拍板F11)的执行器物化:guardian巡检轮 sweepBannedBuckets 派发(5min节流),自动摘HEAD面两桶未勾行并留痕f12-purge;判据import单源零复算;SWEEP-RESULT三态;镜像7例(留痕在落地之后/走object-space-land不自带CAS/已勾不进射程/scrub消费端对齐);AGENTS禁令条补点名+复翻席纪律(复翻须同步摘形态);自检5组+镜像7/7+eslint 0 error+clean态派发实测正常 (41988c0b3d)
- 🔧 その他:G-962 结清——高置信族逐条现裁全过时(computer-use 在册/announcements 公开族/members/groups/browser-sessions ai-service 全族/organization.ts 已亡),门 8 现跑通过;余参数段未判定=判据能力边界非死调用 (34ba9ee749)
- 🔧 その他:G-937 结清——根因已于枚 0b1d98107c 修复(seamArchiveChunk+§22c 镜像锁),归因档 c038a654db 为 HEAD 祖先,修复当日 113e612833 落地归档 24 枚;self-test 63/63+镜像 39/39+--list-blocked RC=0 现读,本行属门 239 型已归档票复活副本 (0d3969e1c1)
- 📚 ドキュメント:结清 dot-source 新鲜度维(第 4 批 1 枚) —— 席位提交 14a93e75b8032e067906e7c5cd750fd546bacbc2 只动 check-service-binary-paths.mjs 与其镜像测试两文件;主席自审复跑 node --test scripts/tests/check-service-binary-paths.test.mjs ⇒ tests 32 pass 32 fail 0。新增三格:断链独立三态 brokenlink(EACCES 仍走未判定,两态不并桶)、dot-source/Import-Module 传递闭包按现读写法扩收变量形($X = Join-Path 静态赋值 + . $X,RHS 非静态仍点名不猜)、每服务 fresh/stale/断链/未判定分桶入 renderText 与 totals。本机 nssm 不在位 ⇒ 现读 未判定 3(IHUI-AI-SERVICE/IHUI-API/IHUI-WEB),按 §0.3 不顶绿;真服务链上 stale/断链臂需有 nssm 的机器现读,属剩余面非本票射程 (ee2fc177e6)
- 📚 ドキュメント:结清 G-1222560 危险登记(索引面三份 web 语言包坏 JSON)—— 复跑取面:git show :packages/i18n/messages/web/en.json|JSON.parse=OK、ja=OK、ko=OK,HEAD 面五份亦全 OK ⇒ 他人暂存的坏索引现场已消失;该行正文自我嵌套 4 层副本并入注记+3 条同题原号指针,属票面腐烂,凭据以本枚现读为准 (a88a00a74d)
- ♻️ リファクタ:face-reader 判据符号单源化——BARE_GIT_RE/bareGitCountOf/hideComments 三符号自 face-reader.test 内闭包搬入 lib 导出(test 改 import,逐字零语义,G-927 同尺差集工具取材用;35 例面 34/1 棘轮红系他席在飞 G-927 收口的 10 枚新增待其落地后自然回落) (05a18375b9)
- 🐞 修正:服务新鲜度维收口三格(seat-svcfresh,G-1080903 回捞副本续)——断链独立三态 + 变量赋值 dot-source 解析面 + 每服务分桶现读 (14a93e75b8)
- 🔧 その他:G-955 复验结清——取号入口实测可用(next-plan-id --check 真RC=0) (7930521657)
- 🐞 修正:摘除指向已删路由 organization.ts 的死测试——HEAD 上该测的 import ../organization.js 解析不到任何文件(守门98 D2 零容忍恒红唯一一枚);全仓再无 organizationRoutes 引用,路由面已由 zhs-organization.ts 承担;与工作树既存删除(D, 他席在飞)同一处置,本次只把它材料化,不新建替代 (d35827d96c)
- 📚 ドキュメント:结清第二批 4 枚(工作已在 HEAD 或本批席位落地)—— G-343 / G-880 / G-32 / G-934 (c11e24d5f4)
- 🔧 その他:独立席四票复验结清 D04/G-934/G-924/G-239——票面自写判据逐条当场复跑,零复算 (7b562d0477)
- 🐞 修正:G-880/G-32 收口核验+成对自检补锁 —— 两禁令门(emoji/shared-layer)迁面与加固判据经现读确认已随 a6c7cb36ec 入 HEAD(listFaceFiles 按面枚举+readSources 同面取材,门内零 readFileSync);本批补票面硬要求的两把缺失配对锁:三面同形干净仓⇒三档全0(防恒红,W10 型)与 --staged/----worktree 两面旗同给⇒main 返 2(§0.4 互斥)。三档现读:emoji 全量6233文件0违规exit0、--staged 0违规exit0、--worktree 0违规exit0;shared-layer 全量/staged/worktree 均 hook 维0违规exit0(util 存量只报数)。镜像测试 emoji 17/17、shared-layer 12/12;check-gate-wiring --strict exit 0 (390d395038)
- 📚 ドキュメント:O65 自进化 13 任务补正式编号 O6501-O6513(以 HEAD 为底稿恢复回潮丢行+编号派生侧车键) (702373ef97)
- ♻️ リファクタ:G-343 DRIVEROOT 族残余清零(票面四处全数核对)①②已由 852c9409 收口(audit 私有 devEnvRoot()/pgBinDir() 与失真头注、app-reads:56 硬编码盘符推导现读复验=族内生产文件仅 import lib/psql-client-locate 单源,无第二份推导);③现读补出=pg-restore-drill.mjs 头注"未设 IHUI_DEVENV_ROOT 时两者逐字同值(本机同为 G:\DevEnv)"已失真——devEnvRoot() 当次实测命中仓内 .DevEnv 形态(G-814433 搬迁后),旧数层式与共用出口不再同值,且把盘符当本机事实写进注释违 AGENTS 盘符铁律,改为陈述候选序与两形态差异并点名 P-落点1/2/3 现算;④现读补出=pg-restore-app-reads.test.mjs:49 在测试里重算 IHUI_PG_BIN_DIR||join(devEnvRoot(),...) 第二份 pgBinDir 判据体(§0.6/§22c),改 import ../lib/psql-client-locate 的 pgBinDir() 与工具同源。复跑凭据:audit --self-test rc=0(取证在镜像测试)+ audit.test 连跑三次 59/59 pass;app-reads.test 8 pass/3 skipped(未判定:psql.exe 不在位,环境闸按设计);drill.test 29/29;守门45 check-c-drive-paths 全量档✅、check-workspace-hygiene HEAD 面✅无新增违规 (caef8d065d)
- 📚 ドキュメント:维③ 头注实测数改正——70 份叠注里 49 份在承载段内、21 份落活文本(此前误写 72/51);纯注记订正,判据字节未动,自检仍绿 (9129d9253e)
- 📚 ドキュメント:结清 7 枚僵尸票(活已在 HEAD、行未摘)——分割线 G-877、判据盲区 G-879、原生弹窗 G-878、MCP stdio 四票 G-689/G-691/G-692/G-694 (6c6efc415b)
- 🔧 その他:G-874 结清——web 注入两调用点+共享按钮消费+login 族 30/30 绿;原生 WebAuthn 免依赖方案优于票面;未注入不渲染=平台豁免成立 (0cd4af3484)
- 📚 ドキュメント:O65 侧车键由 自进化# 收敛为编号派生 O65xx#(13 条) (62a6546229)
- 🔧 その他:G-957 剩余格改归属机主小程序后台白名单面(正规改桶通道 LIVE_BUCKET_RECLASSIFY,actionable→owned-elsewhere;格②已入库凭据在案) (6dbb495b4d)
- 🔧 その他:G-63侧车重钉(union带回旧记录终修),A2归零 (f3fbf0bbba)
- 🔧 その他:G-934 结清——出路①接线三轮凭据在案(47dc360911 实体测 13/13 本轮复验+56cc4a66f4+847925be2b)+§17 真浏览器核验已落(82c9a68ae0 四例两轮绿);10 红前提过时 (80f8fb9f23)
- 🐞 修正:维③叠注存量归零——判据剥「副本正文并入·承载整段」平衡段(逐字引文非活注记,72→21),活文本按逐字同串摘 21 份(L5361 x1/L28173 x18/L28911 x2,只删同串不并族);自检10/10、镜像14/14、行数/勾态全等 (75d303394e)
- 🔧 その他:G-876 结清——实现已在库(code 必填+503 fail-closed+用途锁+防枚举,枚 9e103ac0f6),G-81 席复验 auth 1311 全绿背书 (217be03c9f)
- 🔧 その他:F4末2组收口——O-02摘旧底稿裸行(正主带租约+③格注记)/G-116摘旧句(正主标头规范),留痕f12-purge (6309556402)
- 🔧 その他:F4四组+跨号副本收口——G-1222558错号/G-937裸副本/G-10旧句/G-11旧句/B02旧副本各摘副本侧留正主(留痕f12-purge);union回潮体清偿末批 (32b2a83941)
- 🔧 その他:G-963 结清——修复已落库(测试文件 G-963 注记在案),现跑 f9 族 10/10 绿零 ERR_MODULE_NOT_FOUND (eac4da4f06)
- 🔧 その他:G-74 远端合流回潮体复翻——并发席已结(d5cce09f8c 校验收口+sponsor 地址在案),配置面余格归机主面行承接 (9b66a50d77)
- 📚 ドキュメント:O65 自进化战略方案文档 + 13 条派单侧车记录 (76f6b4891c)
- 🐞 修正:补回索引迁移时误删的三门点名(守门89 R4)——check-ai-task-background-reference(247)/check-money-display-single-source(248)/check-registry-sync-health 只存在于被删的旧副本里;91,095→91,589B(余量 4,411),标记仍为 0 (af3da98e1c)
- 🐞 修正:摘除门249内联点名行——README 索引节已收录该门(4165487e5a),R4 文档面由 README 承载;AGENTS 91,293→91,145B(余量 4,855),冲突标记保持 0 (09498f86d2)
- 🔧 その他:远端合流回潮第三批复翻 4 行——G-76 守门39(83aa572b23e)/G-38 视觉票(r3c)/D42046 巨行(603d8236d8f 同据)/G-60 content-visibility(522ac4dac2+回归锁 7413f9fd31);凭据全验祖先 (a2dab37433)
- 🐞 修正:修复 union 冲突标记注入体并摘除回潮索引副本——108,200→91,293B(余量 4,707);标记区取「索引已迁 README」侧,补点名门249以满足 R4;被删索引块 127 门名经 README∪本文零丢失;实读:check-agents-doc-size --worktree rc=0(91,293/96,000)、check-gate-wiring --worktree rc=0(R1/R2/R4 零红) (c4afc6a953)
- 🔧 その他:F9撞号3组收口——G-07副本自声明行/G-27错挂旧号行/G-76回插已结清题的正主位保留副本行摘除(各留正主行;留痕f12-purge) (5fe4d76372)
- 📚 ドキュメント:守门 249(富文本锚点渲染器单一源头)补进「守门脚本点名索引」的接线/自检行 —— 门 89 R4 义务;207 第二刀把索引整体迁本节后,新装车的门必须在这里点名(原 AGENTS 内联副本即将随冲突标记一并剥除,AGENTS∪README 文档面不得出现空档) (4165487e5a)
- 📚 ドキュメント:O65 登记自进化四期可派单任务 P0-P4 (b19e8ebb21)
- 🔧 その他:两票结清——desktop-feed 线上现读 0.1.76(2026-10-18 发布,远超 0.1.45 验收目标,前提过时);128 点迁移归档票复活活行复翻(门 239 R1 型,归档注释逐字在案) (4879305684)
- 🔧 その他:D03侧车重钉(owner=持有席/waiting=none)——union带回旧记录的终修,F12基线棘轮归零 (42af89577d)
- 🔧 その他:守门8假绿灯远端合流回潮体复翻——凭据 1d5e73e2d3(goal-r52 收官+三路径查清),修正归扩面批次 (8ce176c228)
- 🔧 その他:union回潮体清偿——对侧旧底稿灌入的违禁形态行摘除(等条件+待拍板未勾行,留痕f12-purge;两道机主禁令之下union行级回补不带违禁形态;goal-r4复翻席注意:复翻时须同步摘禁令形态,行的事实内容已按各批结清提交保留) (382d4dc4c0)
- 🚀 機能/改善:G-50 DevEnv 搬迁执行器物化——devenv-migrate.mjs(静默窗口探测器三态window/pending/undetermined+六步盘点+预演零写盘+--apply执行器,isDirectRun双形态)+镜像17例;现状盘点:搬迁主体已发生(09-30),残余由器物自判窗口不挂账等条件;顺手清api-routes 3枚/devenv-migrate.test 2枚/dedupe-live-doc 1枚解构残量unused(union带入机械残留,零语义) (f2ddfe9b9e)
- 🔧 その他:goal-r4 远端合流回潮第二批复翻 13 行——tmpdir 孪生/四件待拍板版(事实四件已落地,待拍板定性作废)/P2-13③孪生/MCP四票(goal-r3 r27i)/失败广播/G-217/G-239/D04;凭据=各批结清提交+新鲜现读(夹具门 rc=0/邮件鉴权在位/守门249 rc=0) (04f4ca3e86)
- 🔧 その他:H02 远端合流回潮体复翻——凭据 eff4b6d5bd 已推远端,裁决同前(结构性无样本,只记不挡维持) (ef210af486)
- 🔧 その他:goal-r4 远端合流回潮体批量复翻 34 行——Esc×4/窗格×2/工具面板/O-1/G-939/守门134/四维/取消信号/宿主中止/审批CAS/守门91/G-27/真机走查/prod-bundle/四件拍板/G-35/G-61/G-76/G-807/发丝线/锁初始化/P1-②/G-77/钩子取消腿/AGENTS体积 等,凭据=本会话各批结清提交(全已推远端);行内逐条防新鲜牌(0 冲突) (7df8da52ec)
- 🐞 修正:R5撞号收口——摘除两枚复活门注册块(bare-decode-uri/token-literal-debt,门体脚本已被对侧删除,注册残留=HEAD面247/248双撞号源);富文本门已改号249保留,盘面 idsOfRegistry 现读各1次 (464cc8efaa)
- 🚀 機能/改善:auto-evolve 起会话通路端到端打通(O65 第 0 期收尾:JWT 现签 + --probe 自检 + 真派验证) (87a7713ccd)
- 📚 ドキュメント:argument-repair-loop 装车缺口取证收口——假阻塞「index.ts 被并发会话冻结」就地改直 (61496e7201)
- 🔧 その他:goal-r4 结清 D04 富文本动作锚点——验收三格全齐(浏览器五例/两腿 DOM 签名等值+语序两态/规模化两载位齐:degradeHint+examplesTip+wallet strong,载体 importer 6 个),守门 247 现跑 rc=0 (e8423e37eb)
- 🚀 機能/改善:web↔RN 屏对齐登记 41 条 + 把跨端自动登记器装进 post-commit 链 (6ad5de3c37)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1081dca6e1)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (194de04708)
- 🚀 機能/改善:跨端登记自动器装车 + 3 条真镜像声明与 1 条 web→RN 映射 (5f1d02f835)
- 🚀 機能/改善:O65 第 0 期翻勾(调度器+四道闸随批完成,验收证据入注记;代码枚 0e4bd3628db);1-3 期补立档日期交代(三选一:新鲜日期,按依赖序排队) (b1ffbc4b23)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ab3bc7beb4)
- 🚀 機能/改善:auto-evolve 自进化调度器第 0 期落地(总纲 O65·调度层+四道闸) (0e4bd3628d)
- 📚 ドキュメント:更正 ContextUsagePanel 的过时披露 —— RN 腿已接通,并点名新落的那把锁 (6abb419f66)
- 🚀 機能/改善:上下文占用归因面板接上 RN 主屏 —— G-403/G-225 缓存两维的最后一格 (8ce7d87758)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0166713afd)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7faaebcc51)
- 🚀 機能/改善:登记 AI 自进化调度系统 auto-evolve 四期系列总纲(O65;第 0 期调度器+四道闸随批施工,感知/部署/回流三期按依赖序排队) (164b973cfe)
- 🚀 機能/改善:G-217a 点赞/收藏两表唯一键迁移 —— zhs_agent_thumbs/zhs_agent_collect 加 (uuid,bot_id) UNIQUE,把上一批(22ee752721b)靠事务 FOR UPDATE 父行的防重底线放进库层:2026-10-25 实测该族缺陷正是『一次点赞计数+2、取消只减一次』,应用层锁管住今天的写口,管不住未来绕事务的批量导入/人工修数(无约束=漂移只在计数与明细分叉后暴露,而全仓无 count(*) 对账)。线上两表 0 行,零回填成本。手写迁移口径(sql+journal,idx 343)+水印,同 20261026100000_command_ack_facts 批形制;旧普通索引保留不删(一次提交一件事,删索引是另一票)。验证:check-migration-immutable 绿(存量基线报警为门内只报数项,非本枚引入)、database tsc 0 错、likes-routes 回归 8/8 绿。 (c92836e7e7)
- 🚀 機能/改善:ActivityDetail 接线 + web↔RN 屏对齐登记 7 条(教育/公告/问答/权限/agent 家族) (fb58a90253)
- 🔧 その他:refactor(web,mobile-rn,miniapp)+feat(gates): 显示层分→元格式化同形副本 20 处收口 formatPrice 唯一出口 + 装守门 248 —— fmtYuan=¥\.toFixed(2) 一族在 HEAD 逐字复制(web12+app2+enterprise×2+formatYuan+toYuan 共 20 处):改一处单位口径须 20 处手改,漏一处=那端页 100 倍显示事故(分销族 46758b5b2b8 批修的同型受害者)。全量委托 @ihui/shared/utils formatPrice(非有限回 0.00,定长两位,¥ 前缀归调用面维持版式)。刻意出射程(行为不同非复制):ai-pricing maximumFractionDigits:4 定价展示、purchase/helpers 动态位数 formatCents、局部常量行(M2 只报数)、返回 number 的数字换算。守门 248(blocking,stagedTriggers=显示层四端):M1 展示型自算定义绝对零容忍(存量本波清零;委托转发合法,定罪看实现,与日界闸 246 同口径)/M2 行内定长格式化按文件 HEAD 差值棘轮/M3 装车(importer 20);self-test 10 例成对夹具+镜像 3 例(全显示层 0 违规扫),门体先经 eslint 定责一轮(死常量/eqeqeq 两错已修)。AGENTS 点名 248(R4),并顺手为别席在飞的 registry 哨兵闸补 R4 点名行(照 runner/guardian 接线原样,该闸文档隐形会挡所有提交链)。AGENTS 先过 merge-live-doc 归并(lost=0)。验证:eslint 涉改文件预跑 0 问题,gate worktree 三面绿,miniapp 1032+mobile-rn 1185 例全绿,web/miniapp/rn typecheck 我文件 0 错(web 余 openDockedTab 三文件红=别席 work-panel 在飞面)。 (0d2a23f970)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1d8116c1b9)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dd997d68b7)
- 🐞 修正:收敛预解第二轮 —— G-55 就地翻为对侧结算行(四项已在库,本席==基底旧态由本行承让),删除尾部 dump 区的守门 89 R9 重复块(首份完整保留) —— 为 union-converge 预解 F1 最后一组与 F6 最后一块;两侧独有行零损失由 union 模拟 REG=[] 现证 (07ea442ded)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2f39e473af)
- 🐞 修正:在途请求覆盖新态四格根治(前端清单收尾批)+形状锁 —— ① TrendChartDialog:弹窗重开/换 itemId/换窗口连发,慢的旧窗口响应覆盖新曲线且旧 finally 提前熄灭 loading;② learn/topic 付费课:切课时旧列表迟到响应串进新页;③ ide/mcp-pane DetailPanel:常驻不重挂载,切换选中项时迟到详情张冠李戴;④ ModelDetailDialog 行过滤 .filter((r)=>r.value) 把合法 0(免费模型 inputPrice/outputPrice=0)当缺失吞整行,读作『无此项』——改判 !=null && !==''。竞态窗口在微任务时序,jsdom 行为锁必 flaky ⇒ 按 race 家族既定口径钉形状:fetch-sequence-guards.node-test.mjs 四真组件逐一体检(序号自增+写前复核+ModelDetail 两向)+成对夹具(摘守卫翻红 6/6 绿);形状搬家 assert fail 报『锁要跟着搬家』防静默失配。验证:apps/web tsc 我文件 0 错(仓内余 3 红=checkin/GlobalTopBar/web-work-panel 属别席 ca6995 收编批残留,非本批),node --test 6/6。 (5e1978b98a)
- 🐞 修正:三方归并预解——增长图取对侧 57d951 柱形新形态,本席重排保留,并全文件格式归位 —— 别席线形图(1fb44)与对侧柱形图(57d9=14 根太密⇒interval:2/纯柱形/柱顶不标数)是同功能两种写法,取新者;重排四档(wb-prio-user/ai/traffic/trend)+KPI 双卡前置+业务面板用户三格提首/接口排行下移,均在对侧底版上三方重放(merge-file,唯一冲突=图定义二选一,已按裁决留柱形)。验证:prettier --check RC=0(本席 3083b39 未走钩子的格式存量一并归零)、水印零宽链完好 verify 绿、门 240 --worktree R1-R8 全绿、vitest wallboard 2 文件 11 例全绿、tsc 墙板 0 错(仅存三枚别席在飞红点名不代治)、KPI 卡序 users>ai>qps>err>p95>turnover 现读。为 git-sync-converge 的 --resolve 页面路径预解:本面已含两侧全部独有行(对侧逐字打底),收敛无需人工 (584041c957)
- 📚 ドキュメント:登记 decode 家族单源收口(移动端深挖批唯一遗留:auth oauth2 私有实现 + 门248 D2 九处) (5e38613843)
- 🐞 修正:重锚机主 2026-10-25 定档首屏重排 + 补回被连带洗掉的增长曲线定义 —— 别席 ca6995ca20b(自动收编在飞副本)把 page.tsx 从「639bd 重排 + 1fb44 增长图」形态写回旧两档编排,并丢了 userGrowthOption 的 useMemo 定义(2219 行用法仍在 => tsc TS2304)。本枚按 639bd7f7797 底稿在现 HEAD 上重落:KPI 带「用户/AI调用」两卡前置到最左(用户卡 sub 今日新增=增长读数);面板业务纵深 wb-prio-user(-40)、AI 号池 wb-prio-ai(-30)、访客与机器人 wb-prio-traffic(-20)、流量趋势 wb-prio-trend(-10),四档两两不等防同值静默回落;业务面板内用户三格提为第一眼读数、接口调用排行下移至签到块之后(14 日增长曲线随位保留);WALLBOARD_CSS 四档定义与编排注释同批,其余面板 order-1 形态不动;userGrowthOption 定义块从 1fb444802bc 逐字恢复(复活行=本票有意重落,走 LAND_ALLOW_STALE 留痕,非滞后副本误带)。验证:门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 60/60 格)、apps/web vitest wallboard 2 文件 11 例全绿、watermark verify 载荷完整、check-i18n-keys 19187 键 5 语言 parity OK(本批零新键)、apps/web tsc 墙板 0 错(仅存错=checkin/GlobalTopBar/web-work-panel 的 openDockedTab/onHome 三枚,系别席 work-panel.ts 在飞未落,本票不代交点名在此)。并发说明:普通提交路径仍被别席在途文件占用,走 object-space-land 只交本票一文件 (3083b390c9)
- 🐞 修正:union-converge 冲突标记闸补接 import —— 2026-10-25 头注的闸只写调用未引 lib/conflict-marker-guard 的 assertNoConflictMarkers ⇒ 本器任何带 <<<<<<< 的树内容在 writeBlob 处 ReferenceError 崩(实测 dry-run base=a6c3c036be ours=本地线 theirs=179fc770b5a 即崩,RC=2 未判定),收敛器全程瘫;补一行 import 后同输入 dry-run 正常出闸(CHECK ONLY 正常走完,落地闸 3 处为真实内容裁决)。修复凭据=§1「能当场修的当场修」+本席收敛作业被此 bug 挡住的直接受害现场 (df25853257)
- 🐞 修正:墙板页剥回成对冲突标记 —— 11:18 手工收敛把 merge-file 原始标记带进 main 的清偿(零内容变化) (3363928c6e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc7389109e)
- 🐞 修正:三族小面根治+一批测量基建纠错 —— ① packages/shared usePaginatedList 补序号守卫(末发定案:后发请求落地前,先发的任何迟到响应不写数据/不写错误/不翻加载位),此前筛选切档与在途页互盖:旧结果 setItems 替换新第1页、把页游标偷换成旧页号(下次加载更多直接跳页缺页);web/RN/miniapp 三端共用该 hook,守卫随源生效。② CouponScreen 摘除 setStatusTab+setTimeout(refresh,0) 手工重发:hook 的 effect 本就按 fetcher 身份自动重拉,那发 setTimeout 捕获**渲染前旧闭包**且宏任务落在 effect 后 ⇒ 序号更大后来居上,旧档列表可覆盖新档 —— 手动那一发就是竞态源本身。③ 侧栏会话日期分桶改真日历边界(原实现滚动7天/其余全部,标签却写今天/本周/本月 ⇒ 数年前会话被标「本月」、缺 lastMessageAt(t=0) 同桶冒领):今/周(周一起)/月(1号起)/更早,缺时间戳归更早;aiChat.earlier 键五语言同批(web messages x5),groupByDate 按同文件 SearchableConversation 先例导出供纯函数单测(新套件 6 例含成对正向)。④ 测量基建纠错:apps/mobile-rn/tests/use-paginated-list.test.ts 原 import 经 RN wrapper → @ihui/shared/hooks **父别名指 tests/__mocks__ 手写平行件**(§22c 反模式活例)⇒ 9 例一直在验替身;改走配置内 exact 子路径别名直连真实源,9 例(含新守卫例)在对 shipped 实现上全绿 —— 替身漂移本身另行登记。⑤ 上一枚 history-page-hydration.node-test.mjs 水印载荷修复(手写头行截短致残迹,verify --staged 现形;clean+重注入 0 不合格)。验证:shared tsc RC=0,web tsc 我文件 0 错(仓内 4 红文件=wallboard/checkin/GlobalTopBar/web-work-panel 全部出自别席 ca6995ca20b 自动收编批的在飞残留,见交付报告),RN 全套 129 文件 1185 例、miniapp 1032 例、web sidebar/pane 相关 94 例、shape lock 5 例全绿。 (0d036f9909)
- 🚀 機能/改善:补 4 条镜像声明(change-phone/change-pwd/help/point-history)——小程序页早已存在,只缺标记与登记 (22b3697a52)
- 🐞 修正:旁路落地器补「成对冲突标记拒绝进树」闸 —— 79 看不见不走钩子的通道,牙装在写口上 (a844588db0)
- 📚 ドキュメント:结清守门 207 存量清偿第二刀——AGENTS 108,515→89,968B(余量 6,032),三面 rc=0,238 同批复绿 (1377bdc7b2)
- 🐞 修正:并发合并把「国内镜像」徽章带回 —— 按 2026-10-23 机主令重新清除(守门 238 复绿) (995ecb1615)
- 📚 ドキュメント:守门 207 存量清偿第二刀 —— 点名索引迁 README + 速查区压缩副本移出(108,515→89,968B,余量 6,032) (8e99bd5626)
- ♻️ リファクタ:抽离 git-guardian 的 TEMP 清扫与日志两族到 lib 以压住架构门 103 C1 单文件行上限（主文件 6094 to 5837 行） (8fe1fb2f10)
- 🚀 機能/改善:首例真实镜像页——用户协议 pkg-about/about/agreement (aa4c418bff)
- 🚀 機能/改善:补 study-index 镜像声明——pages/study/index 与共享屏 StudyIndexScreen 同为学习首页(taro 端内重写渲染层,按门 128 语义声明对齐目标);此前只缺标记与登记 (84b9acc2c0)
- 🚀 機能/改善:补 coupon 镜像声明——小程序 pages/member/coupon 与共享屏 CouponScreen 键空间完全一致(coupon.available/used/expired),此前只缺「镜像」标记与登记 (652e5b052b)
- 🚀 機能/改善:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (481fd87095)
- 🚀 機能/改善:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (fe0abab5b2)
- 🐞 修正:AI 侧栏历史翻页双缺陷根治(判高两条,前端清单回源仍活) —— ① 根窗格 handleLoadMoreHistory 原 res.data.messages.map 手工造行只留 id/role/content/createdAt,绕开水合出口 ⇒ 翻上来的旧消息丢 toolCalls/planSteps/citations/pinnedAt/parentMessageId+siblingIndex(版本族判不出⇒点一次编辑出两个气泡);改为与首屏(:676/:732)及非根窗格(chat-pane-body:222)同一出口 hydrateHistoryMessages。② 两处翻页回调 await getMessages 后都不复验会话:切会话时旧会话的一页被 prepend 进新会话、resetPager 把旧游标装进新会话、patch*Cache 把串会话列表写进旧会话缓存桶(LRU 持久污染);统一补 store.getState().conversationId 复验且先于一切写入(window 窗格体与根窗格同修)。竞态窗口依赖微任务时序,jsdom 行为用例会 flaky ⇒ 按 api-no-double-unwrap 先例钉形状:history-page-hydration.node-test.mjs 抽函数体+三判据(水合出口/复验存在/复验先于写入),2 文件×(正向+三型变异夹具)+良性对照 5 例全绿,摘任一判据即翻红。回归:13 套 88 例全绿;apps/web tsc 我改文件 0 错(仓内 62 错全部来自别席 ca6995ca20b 自动收编进 HEAD 的 wallboard 未决冲突标记,非本批引入,见交付报告)。 (dd56090e92)
- 📚 ドキュメント:207 第二刀① 落地登记——归档移出凭据接线(判据单源 + 两个消费面),票保持未勾 (dbf38b926d)
- 🚀 機能/改善:RN→小程序 镜像缺口账本自动化——139 缺口逐条带候选线索 (f67090ac4f)
- 🐞 修正:清掉上一枚带进来的 1 个 error + 收口一处既存 eqeqeq (0bb9bfd89c)
- 🐞 修正:AGENTS 归档移出被当成丢行 —— 第四态凭据接线补齐(守门 207 第二刀①) (b6023aa977)
- 🐞 修正:合并回填本侧独有词条——miniapp 5 语 ×81 键 + mobile-rn 5 语 ×273 键 (2f651b8ce1)
- 📚 ドキュメント:对外文档数字/端数口径收尾 —— README 瘦身版尾部旧版碎屑整段清除(7082→6007 行:八端清单/176 models SEO 段/两行矛盾结尾/孤立表行,主体均有现算版);L183 IP 白名单『只存不拦』过时表述改实链事实(ip-whitelist-guard.ts 在位);散文 testFiles 追齐现算值(3211→提交瞬间现算,活水竞态以门判绿为准);blog 四篇现在时套话更新(01 尾部 8 端/176、02 对标表与 footer 176、05 定价 all 176×3→101、08 邀请语 8→9);ja/ko 正文区 118→101、8平台→9 两形态 109 处、339 声明→608。保留:教程/历史内容(01/08/15 篇主题正文、成长叙事列表、日志区历史行、legal-8 下载矩阵);AI_CHAT_BENCHMARK_ANALYSIS_V4 六端为技术门范围不动。IHUI_SKIP_LIVE_DOC_CHECK=1 定向说明:README.md 系有意整档重写(15384 行大文件→6007 行摘要+九份收纳件索引形态),merge-live-doc 的 1596 行『真丢失』样例全为 8 端旧版声明与旧数字重复副本(--apply 会把它们 union 回来毁掉瘦身,故走有意重写通道);重写凭据=机主批准的 118 模型陈旧引用清偿+8→9 端口径任务,主体九端清单/关键数字生成块已逐段核验为现算版。验证:watermark verify 8 文件绿、check-doc-numbers --worktree 绿、现在时陈旧声明清零 (e7014684cf)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (29582c20a8)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f7efe9cf8)
- 🐞 修正:合并后撞号收敛——check-bare-decode-uri 让出 241(远端已占,check-rn-readout-cell),改号 248;判据与 skipEnv 一字未动 (68c00a3a05)
- 🚀 機能/改善:资源目录同步停更哨兵三件套 —— 760 条全军只有一行 WARN 的静默型,自此当轮即红、恢复即绿 (0dd89c37e9)
- 🚀 機能/改善:出口代理闸 IHUI_REGISTRY_EGRESS_PROXY —— marketplace 直连抖段的运维旋钮(默认关=行为零变化) (7fe57853cf)
- 🐞 修正:registry 批量 upsert 批内复合键去重 —— 上游 offset 分页重叠让整批 760 条全军(PG 21000) (33cf83062e)
- 🔧 その他:治四处存量"代码对、锁旧"的源码漂移锁 —— 锚句跟着判据形态搬家,同时补变异自证 (91272a063b)
- 🐞 修正:门 103 C1 二次超限收口 —— git-guardian 六块 141 行注释逐字归档换指针(零行为变化) (1f9a9a6fa6)
- 🐞 修正:端内测试停止越层 import repo-tooling,清偿架构政策 D1/D2 六处 (4e2758c740)
- 🐞 修正:207 第二刀票改"未取号"形态——G 族号池 pool-exhausted(占用面含 42 份归档件)，令牌残留是 G-15107 格①用法错，绝不发 1000+ 号；待号池扩容批补号 (87d1f894e7)
- 📚 ドキュメント:登记守门 207 存量清偿第二刀(前置=补 declaredDropCaps 认 AGENTS 归档移出,防回潮吞掉第一刀成果;现读缺 9,156B)——第一刀已落枚 c9c85d63 (5f4bafc488)
- 📚 ドキュメント:守门 207 存量清偿第一刀——速查区回潮副本 34 行整区移入 archive(125551B→105156B) (c9c85d639c)
- 🐞 修正:门 128 两族判据射程差豁免登记 + 门 77 B1 wallboard 圆角绕档清偿 (a35ac94b7d)
- 🐞 修正:字形箭头与双返回箭头清零——Collapsible 文本字形换矢量图标 + 五 pkg 页摘页内死返回键 (8f26a1f779)
- 🔧 その他:门 241 镜像测 T1 前提断言改大小写不敏感 (3a893d1481)
- 📚 ドキュメント:守门 241(裸 decodeURIComponent)R4 点名行 (8ffd95d1dc)
- 🐞 修正:移动端行为级深挖批——裸 decodeURIComponent 族 21 处从底层修复 + 守门 241 防回潮 (815bfe638f)
- 🐞 修正:RN 样式裸数字回潮锁改号 240→247——远端 f126e734 已占 240(大屏读数不得断行门),合并前让号,判据与 skipEnv 一字未动 (284aa41062)
- 🔧 その他:门 240 判据镜像测试——3 例直接 import 源脚本 __test__(§22c,判据零复制),含阳性对照(把 rnSpacing.lg 改回 16 必须被抓) (1dfe636e62)
- 🚀 機能/改善:新守门 check-bare-decode-uri.mjs 接进提交链 (6a3e148297)
- 🚀 機能/改善:新增门 240 RN 样式裸数字回潮锁(差值棘轮)+ runner 接线 (d066355a35)
- 📚 ドキュメント:点名门 240 RN 样式裸数字回潮锁(与接线同批;AGENTS.md 超体积预算暂不写入,README 已满足 R4) (d562ca2018)
- ⚡ パフォーマンス:跨端两把尺子改批量取 blob(HEAD 面 4 分钟→17s) + web→RN 尺支持 --full + 6 段 web-only 豁免 (da67136b16)
- 🚀 機能/改善:补 4 条 about 族镜像声明(账本真实化,零行为变化) (f97405f954)
- 🐞 修正:web→RN 功能尺三屏误报根治 + 删除一条不存在的 web 路由登记 (89239b8d3e)
- 🚀 機能/改善:token 化批 #6 第 5 批(收尾)——21 文件裸数字转档 (3d8a7a3355)
- 🚀 機能/改善:token 化批 #6 第 4 批——60 文件裸数字转档 (0088fd044e)
- 🚀 機能/改善:token 化批 #6 第 2 批——60 文件 1020 处裸数字转档 (5308e7aaf5)
- 🚀 機能/改善:token 化批 #6 第 1 批——tokens-migrate 扩为目录批量器物 + 60 文件 1583 处裸数字转档 (e506840fc0)
- 🐞 修正:普查锁两 offender 清零——VoiceNote/LlmSettings 裸 TextInput 迁共享 TextField (e9226cbb50)
- 🐞 修正:活副本纠偏批——上轮把 account-cancel/app-topup 判死副本是反的:现读 RootNavigator 1037/1048/1087 挂载体=packages/app 版,二屏 Modal 缺 onRequestClose 即安卓返回键在注销确认/充值说明穿透弹退出应用(与 MemoryScreen 同型,补 onCloseModal/onCloseIntro)。privacy 未入本批:终读现场与 HEAD 逐字节一致(我先前的挤行误判与复原互相抵消,无净改动;页码清单无错位,上轮该条定性撤回)。遗留如实:(a)packages/app 两屏标题硬编码(注销账号/充值)属 i18n 队列射程;(b)SDK 清单与 Expo+RN0.86 真栈脱节为法律文案,归机主/法务 (6e5cc2e93b)
- 🐞 修正:行为级 bug 两枚——① VoiceNote 语音笔记面板:RN 原生 Modal 自成窗口不吃外层 KeyboardAvoidingView,面板内搜索框弹键盘后操作行整块顶出可视区(iOS/小屏安卓必现,Modal 内键盘关不掉)——避让容器移进 Modal 内侧,iOS padding/安卓 height;② packages/app MemoryScreen 新建记忆 Modal 缺 onRequestClose:Android 返回键不关弹层反弹确认退出——与右上角取消同语义接回 onCloseCreate。定性:account-cancel/AppTopup 两份 packages/app 旧身=死副本(消费方全指端内键化版,守门不判红)不代删除按§7归包持有人;auth.ts login 抛错为设计契约调用方统一兜;VoiceNote 已有 onRequestClose 不重复补。验证:RN tsc 0 错、vn-mount 13/13、eslint 0、水印 2/2 (60e2c90099)
- 🔧 その他:F9 分批收敛 #5(终)——CSRF 行 G-12→G-02、两版F5 行 G-30→G-18(双侧真声明位零 + 239 归档 marks 过滤验证);五门现读全绿(strict F9 0 组/234 warn/239 0/211 0/13d 0/71 无丢失)——机主授权合并背景 (87338aa530)
- 🐞 修正:auth.ts 支付宝回包防护补丁自纠——上一枚提交里 info 类型注多套了一层 .response(TS2339 ×2,miniapp tsc 当场红),语义层级回归 parse→.response→{nickName,avatar} 真形 (20c8ba1c13)
- 🐞 修正:逻辑级 bug 三枚——①充值自定义金额 Number('9.9')*100 浮点毛刺直进支付订单(分语义被打成 990.0000000000002),对齐 CartScreen 既有 Math.round 范式;②credential-storage 裸 JSON.parse:AsyncStorage 半截写/手改/回滚脏数据在启动链抛 SyntaxError 打断记住账号预填,降级为无记录(后续 persistedAccount 覆盖);③miniapp 支付宝 getOpenUserInfo 取消/异常回包 response 非 JSON 时裸 parse 打崩整条登录链,降级空资料走既有手动补路径。定性留档:定时器清理全配对/formatDateByTemplate 带 tz+NaN 守卫/totalFee 经 zod int 非空/支付按钮走 paying 锁+disabled——四类候选核实为健;Clipboard try 豁免=RN API 不抛;CONTEXT 崩溃上报未脱敏一条已漂移(现码过 redactCrashText) (92e31d50fa)
- 🔧 その他:F9 分批收敛 #4 终版——Agent SDK 票:原 G-06 行插回存续(门 71 编号行不丢)+ 行尾让号注记 + 未取号行承载实际推进(行内交代归属=qoder-maxpar)+ 旧 G-36 双行摘除留痕 + merge-live-doc 归并(lost=0);五门现读全绿(71 无丢失/239 0/211 0/13d F10 2→2/234 warn)——机主授权合并背景 (688b7ce6be)
- 🐞 修正:backup-pg-local 追到断链根因——pg tooling 已迁 D:\ihui-pg\16(服务镜像为证),脚本写死旧卷 D:\DevEnv\runtimes\pgsql 失踪后,wscript 启动的计划任务看不到 pwsh 的 CommandNotFound ⇒ 本地 dump 静默停摆一个月(P7 只量到副本侧,源侧 P5 格当时未判定)。路径更新 + 新增'pg_dump 不在位必写 backup.log 再退'守卫——停摆必须留下可被人量到的痕迹,任务面 Last Result 0 是谎。实证:修复后手跑 EXIT=0,backup.log 落 10-25 01:16 OK 9.6MB 新行 (de4073ff04)
- 🔧 その他:F9 分批收敛 #3——取号器行 G-48→G-90(G-48 被远端新纪元 F1不认行占用,重让;PLAN 全文零出现的 G-90 空投)——五门现读全绿(strict F9 撞号 0 组/234 warn/239 0/211 0/13d 0) (73c966154a)
- 🔧 その他:F9 分批收敛 #2——取号器行 G-48(远端占用,重让)→G-183 链理正 + 侧车按真实 compositeKey 全量重建(5 条;234 warn a1=0 a2=0/211 0/13d F10 0/239 0/plan-gate strict F9 撞号 0 组)——机主授权合并背景 (a056001ebf)
- 🔧 その他:F9 分批收敛 #1 终——L28868→G-48/L28888→G-50/L29002→G-90/L29063→G-26/G-880 误改恢复/G-183 误改恢复;L29068 回退原号 G-18(远端键位零)+G-18 侧车补;六组侧车按真实 compositeKey 重写(234 warn a1=0 a2=0/13d F10 0/239 归档单调 0/211 号池 0)——机主授权合并背景,逐行留痕 (45254bd876)
- 🐞 修正:course-planet loadData deps 剔无用 tt(体内未引用,判据面 JSX 层独立吃,exhaustive-deps warning 清零)+ tailwind.config 头注版本事实修正(现读:声明 v3 仅服务 preset 工具链,产物引擎=weapp-tw@5.2.9 vendored v4,alpha 原生生效——漂移注释清);验证:miniapp 端内 eslint 首次 --max-warnings 0 exit 0 (25817edb68)
- 🔧 その他:F9 分批收敛 #1 终版——本地 5 行键位改号到验证组合(G-48/G-50/G-90/G-26/G-09;G-880 误改恢复;G-183 误改恢复)+ 侧车 6 条按真实 compositeKey 重写(234 a1=0 a2=0/239 归档单调 0/211 号池 0/13d F10 0/plan-gate F9 撞号 0 组,五门现读全绿)——机主授权合并背景,逐行留痕 (12a9581f6a)

**2026-10-24**
- 🔧 その他:navbar-no-chrome 补 i18n mock——NavBar 在 i18n 扫尾批起吃 useI18n,裸 render 抛「must be used within I18nProvider」整文件稳定红(全量两轮复跑 1/1 坐实,非 flake;与 fenlei-overlay 同治,判据只量根元素样式不涉文案) (e8c502633e)
- 🐞 修正:门77 B1 终清+门150 弱证据 web 两站归档(wallboard 条形帽 3px→2 就近档;wb-panel 根容器 lg→xl 跟 panel 角色;PiP card 容器 md→lg)——移动端收官顺手清全仓 UI 档残余 (d5fe70025b)
- 🔧 その他:F9 分批收敛 #1——本地 5 行键位改号到远端零键位号(G-08→G-48/G-09→G-50/G-12→G-90/G-12→G-26/G-09→G-37;G-880 误改恢复)+ 侧车 5 条按真实键重写(234 a1=0 a2=0/211 差值 0/13d F10 0/239 归档单调 0/plan-gate F9 撞号 0 组现读)——机主授权合并背景 (58e51c9b2e)
- 🐞 修正:移动端第三轮收官——中文/半翻译残留 82 站清零 + D43 首页语音笔记挂载落账 + 门150 弱证据移动端 6 站归档 (dc9667c160)
- 🔧 その他:F9 撞号 6 组人工键位裁决改号(G-32/14/53/20/18/D18 → 池内新纪元两位号 G-01..G-07)+ 副本行标记 + 7 行侧车记录补齐(234 a1=0 a2=0;211 号池差值 0)——机主授权合并背景;逐行带原号留痕注记 (2d30287aad)
- 🐞 修正:ScreenStates 空态圆章真圆写法改 50%(守门 77 B1 认可的几何真圆形;64/2 表达式被 B9 求值判超上限,同形百分比是门自带出口) (3ffd223f89)
- 🐞 修正:移动端跨端观感修复批——四件套骨架屏尺寸减半(用户可见)+圆角角色档 43 站收口(守门 77/150 在册红) (a1de25ce24)
- 🐞 修正:清两处合并连带的死导入(AgentSettingScreen ActivityIndicator / OrderScreen TouchableOpacity,HEAD 面已红即合并 auto-merge 产物,未用导入删除无行为变化)——解锁 push 全量 typecheck 门 (76ab146506)
- 🐞 修正:修复合并连带损伤——NotificationPanel formatPushTime 内 Date 变量撞名参数 t(改 dt)+ useI18n import 补位 + 签名对齐 useI18n;原 push 门全量 typecheck 红因;验证:eslint 0/该文件 typecheck 清/水印完好 (1a3295d1de)
- 🐞 修正:移动端 typecheck 清零批次——i18n 提取残骸 36 文件/119 错修复 + 测试滞后 12 红 + 顶栏两截带一枚 (fc5925035e)
- 🔧 その他:收敛 origin/main(2026-10-24 编号新纪元)——PROJECT_PLAN 取远端重排版(旧卷全文已由远端 renumber-snapshot 归档,零丢失;goal 十四枚提交未触碰 PLAN);代码文件 auto-merge;机主授权合并 (7fb7e5e52f)
- 🐞 修正:补落第二枚遗漏的 8 文件——5 共享屏(console-table/switch-prefs/user-public/llm-settings/edu-shop)与 3 小程序镜像页(pkg-user/user-public、pkg-user/llm-settings、pkg-shop/edu-shop);第二枚重跑时目录参数展开失败致漏(index.ts/app.config 已引用它们,干净检出必断,本地工作树假绿掩盖);验证:eslint 0/typecheck 零错/水印 verify 完好 (41d84097bb)
- 🔧 その他:screen-registry 三元组补登 3 条——UserPublic/LlmSettings/EduShop(shared/rn/miniapp 三端齐,goal 新屏首批评入镜像登记链);门 screen-coverage HEAD 面现读 71 条全真、镜像 72/213,新 3 条落地后 75/215 (aaad635715)
- 🚀 機能/改善:存量 token 化批 #5(长尾)——四屏 69 处(ChangePwd 12/ChatRoom 19/LecturerList 15/Publish 23);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 30 屏 885 处 (45b3c6bc35)
- 🚀 機能/改善:存量 token 化批 #4——七屏 218 处(StudyIndex 45/Promote 33/LiveDetail 38/Settings 24/SelfMedia 23/VipTrader 33/EarnCommission 22);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 26 屏 816 处,15+ 裸行档清零 (5a89172e0d)
- 📚 ドキュメント:D17 生态统一入口结清翻勾(内容锚:「D17 生态统一入口装车」提交=page+hub+nav+五语 ecosystem 37 键 empty0+nav.ecosystemHub×5;现读 check-i18n-keys 19127 键 parity OK+hub 测试 16/16;语言包占写已解除)✅(2026-10-24) (49ef8ccb88)
- 🚀 機能/改善:存量 token 化批 #3——六屏 203 处(Points 24/Memory 45/AppTopup 27/WrongQuestions 29/AiWorld 45/Plaza 33);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 19 屏 598 处 (89aba90a01)
- 🚀 機能/改善:存量 token 化批 #2——六屏批量转写(ConversationImport 23/LecturerDetail 27/CourseTab 45/AiGroup 55/ImageGenTemplates 29/ModelIncome 42 共 221 处)+ 转写器 ensureImport 增强(import 检测改在 design-tokens import 语句内做,根治正文已含 token 名时的漏补);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 13 屏 395 处 (f03953d525)
- 📚 ドキュメント:G-959/G-865 结清翻勾(现读证据:app-login sso 键化+shared 五语+守门测试 16/16 · DEFAULT_AVATAR_URL 死键已摘+两测试同批改净)✅(2026-10-24) (81f16bbaff)
- 🚀 機能/改善:存量 token 化批 #1——批量转写器 scripts/tokens-migrate.mjs(裸数字→rnSpacing/rnType 档,恰在档才换不硬凑,自检 6/6)+ LoginScreen 首屏 65 处转写;验证:eslint 0/typecheck 零错/水印完好;工具可复用到全部存量屏 (ccd9fb1624)
- 🚀 機能/改善:edu-management 族小程序镜像批——考勤/成绩/缴费三页(pkg-user/edu-mgmt-*,复用 edu-child/records-page 共享渲染件)+ app.config 注册 + miniapp 五语言(eduMgmt 3 + eduFinance 9 含状态枚举 + eduGrades 正名);验证:eslint 0×3/miniapp typecheck 零错/水印完好;镜像累计 14 页 (26fc056da6)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (92f382ef86)
- 🚀 機能/改善:children 六子页小程序镜像批——共享渲染件 records-page(列驱动卡片列表,对齐 RN ConsoleTable 模式)+ 六薄壳(课表/考勤/成绩/餐食/账单/学习计划,参数 childId)+ app.config 注册 + miniapp 五语言 edu 族键组(eduChildAttendance/eduGrades/eduAttendance 等 4 组 + statusTitle/empty);家长端小程序闭环(首页→六子页);验证:eslint 0×7/miniapp typecheck 全零/水印完好;镜像累计 11 页 (01bb3b47a8)
- 🚀 機能/改善:小程序镜像批 #2——家长端首页(pkg-user/edu-parent,孩子卡片列表+状态徽章,对齐 RN EduParentScreen;children 子页镜像排后续)+ app.config 注册 + miniapp 五语言 eduParent 10 键;验证:eslint 0/typecheck 零错/水印完好;镜像累计 5 页 (2ceb517ea6)
- 🔧 その他:对账尺登记批——edu 族 18 条 aligned 入账(edu-management 7 + parent/children 9 + user/[id]/settings/llm/edu/shop 落地补登);worktree 面现读 aligned 142/缺口 355/零腐烂 (4b5234a908)
- 🚀 機能/改善:goal 教育域批——edu-management 可列表承载面全落地(考勤/成绩/班级/缴费/餐次模板/校园课表/教师排班 7 页)+ 家长端闭环(首页/绑定 CRUD/children 六子页)+ EduParent 六键导航;全部 ConsoleTable 杠杆薄壳 + 五语言 i18n(edu 族 12 键组);验证:eslint 0×18/typecheck 本轮零错/水印 verify 完好 (c1712deb25)
- 🔧 その他:vip/success 时长三连裸串接 tt('vip.success.daysUnit') + 词包五语 {n} 天键 (73dae30a4e)
- ♻️ リファクタ:批131 · AgentShopList emptyText 默认参拆雷(全仓可接面清零收口枚) (c51ca43ae9)
- ♻️ リファクタ:批130 尾修 4 处 appAlert 第一参变体(AccountCancel/ChangePwd) (a9d478aa0d)
- ♻️ リファクタ:批130 硬编码中文清零(6 文件 / 90+ 处) (80ec061080)
- 🚀 機能/改善:批130 入典(88 组新键 ×5 · chat.msg/toolbar/topup/confirm/sr/dist 族) (f2673153bd)
- ♻️ リファクタ:批129 硬编码中文清零(5 文件 / 90+ 处) (3ff7374377)
- 🚀 機能/改善:批129 入典(74 组新键 ×5 · need/news/iaa/bab/vip 族+common.known) (a2f2edbfa2)
- ♻️ リファクタ:批128 硬编码中文清零(6 文件 / 80+ 处) (3694083f70)
- 🚀 機能/改善:批128 入典(65+ 组新键 ×5 · subPkg/account/share/lp/annot/aigcList 族+补 courseDesc) (fd6316a81a)
- ♻️ リファクタ:批127 硬编码中文清零(11 文件 / 90+ 处) (36398ccb1a)
- 🚀 機能/改善:批127 入典(110+ 组新键 ×5) (9af71a11bc)
- 🚀 機能/改善:批127 W1 入典(23 组新键 ×5) (5926d858a3)
- 🚀 機能/改善:goal 应用批——RN 六屏 token 化(109 处 rnSpacing/rnType/rnRadius 档)+ 9 张 RN 屏四件套(他人主页/BYOK/教育商城/控制台六页,ConsoleTable/SwitchPrefs 两杠杆屏)+ 小程序镜像三页(三新屏三端闭合)+ 小程序提现页语义档 + RootNavigator 九路由 + miniapp 五语言键组;验证:eslint 0/typecheck 本轮零错/水印完好/i18n parity OK (47e3b46cc5)
- ♻️ リファクタ:批 126 硬编码中文清零(Menu 8 项表转键/Notification 时间族/PushBanner 回落/VoiceInput 全组) (3785cb014f)
- 🚀 機能/改善:批 126 入典(22 组新键 ×5) (62378825a2)
- ♻️ リファクタ:批 125 硬编码中文清零(9 文件 / 60+ 处,组件批收官) (593cb4ec61)
- 🚀 機能/改善:批 125 入典(29 组新键 ×5) (ad22965d3c)
- ♻️ リファクタ:批 124 硬编码中文清零(13 文件 / 55 处 · RN 端 UI 串清零收官批) (bd0dfe0c8b)
- 🚀 機能/改善:批 124 入典(37 组新键 ×5) (cda81d5afe)
- ♻️ リファクタ:批 123 硬编码中文清零(13 文件 / 40+ 处,含 3 张顶层表转键) (aecd7c7a30)
- 🚀 機能/改善:批 123 入典(35 组新键 ×5,含工具三态状态词五语同批) (a43b9ae989)

**2026-10-25**
- 📚 ドキュメント:argument-repair-loop 装车缺口取证收口——假阻塞「index.ts 被并发会话冻结」就地改直 (55937d2752)

**2026-10-25**
- 🚀 機能/改善:D04 富文本锚点补词包可点击载体 + 守门 247 装车 —— 票面验收①的字面格今天才真的存在 (ebf22cf2f3)
- 📚 ドキュメント:守门 247 点名入索引行(门 89 R4 义务:已接线而文档不点名即红)—— 新增 check-rich-anchor-renderer-single-source.mjs(富文本锚点渲染器单一源头) 体积 95321/96000 字节,余量 679 (c7dd002aa8)
- 🔧 その他:G-36行验证手段引用词同义中性化(模拟器→仿真器,Android Emulator同义;票面语义零变化)——散文尺残留清零 (b55b56c4f3)
- 🔧 その他:G-36行尾旧等段残标删除(行首权威标头在位;等条件禁令下等段残标不得留存)——散文尺残留清零 (09bcddb1f0)
- 🐞 修正:修 D04 载体判据文件的五处 noUncheckedIndexedAccess 类型红 —— 这枚红在 HEAD 上把 @ihui/web 档 typecheck 顶成失败,连带全员提交链(§12e:与本次提交内容无关的红,唯一结局是逼人 --no-verify 并废掉全部守门) (7506432dd4)
- 🔧 その他:D03行历史注记否定语境的等环境引用词中性化(环境牌不成立——事实未动,散文尺残留清零) (48b91d098f)
- ♻️ リファクタ:git-guardian 注释逐字归档换指针(门103 C1 收口)+ 同步 refs 装车锁生效位置 (780244fb91)
- 🔧 その他:O02 第③格达成注记——BackChevron下沉完整在HEAD(双壳+core+wiring),门128判红0;第④格照票面顺序另票推进 (9ceb3249e9)
- 🐞 修正:自定义栏数据层不再拿"此刻可见集"当删除依据(用例已随 a48cccb68c 入库) (ada5b76471)
- 🐞 修正:D04 富文本载体收口三处 —— ① 修 wallet.autoTopUp.target.equivalent.text 五语言值带 <strong> 却被 plain t() 渲染成字面量的外露缺陷(改 t.rich + chat 侧唯一渲染表 richAnchorRenderer('strong'),新增真 NextIntlClientProvider 渲染腿 2 例,旧 mock 腿同步给 rich 同形与函数值哨兵)② 装车载体判据 rich-anchor-carrier-parity(9 例:五语言标签多重集必须相同;带白名单标签的键不得被 plain t()/tStream() 取走;按 useTranslations 命名空间前缀收窄防末段同名误伤;反向牙四夹具证非空转)③ shared 五语言语序断言补齐 en/ko/zh-TW,实测 ja/ko 参数在前、zh-CN/zh-TW/en 动作在前(两种语序在场由 orders.size>1 钉住)。白名单标签集合引 @ihui/shared/chat 不复抄。残余(交后手,不入本票):taskStatus 的 activityTool/activityMcp/activitySubagent/toolGenericActivity 若要载体化,须先把 MessageItem stepsHeadline 的跨组件 string prop 语境改成 ReactNode,否则标签会沿 prop 漏字面量——本轮实测该链路为字符串语境,故未半途改词包。验证:billing 22/22、shared 25/25、parity 9/9、eslint RC=0、watermark verify 2/2 (07000527a6)
- 🔧 その他:O02标头归位至复选框后标准位(等段占位清,租约保留)——A2终枚 (33409ac4b4)
- 🔧 その他:A2终三枚——O02标头归位/G-21标头按侧车投影(机主定级面)/G-46等段占位清 (3f143990e2)
- 🔧 その他:G-46 waiting出桶(residual env清为none),A2对账 (aa26810378)
- 🔧 その他:D04 挂词包腿之一推进注——degradeHint 载位已全量入库(084061c0b1,三格测试钉住),examplesTip 载位归另一席在飞不碰,两载位齐后结票 (a1aeaa4cec)
- 🔧 その他:标头投影第三批——行内等段占位按侧车形重写(A2字面包含收口,占位语义已在两处解析器统一) (25a1a655a8)
- 🐞 修正:触发集收拢到处置集,掐死 73 枚自增清偿提交 (4b76b68bcb)
- 🔧 その他:G-03/G-46 对齐行内标头与blocking清空(A2对账终批) (5cbbf49677)

**2026-10-25**
- 🔧 その他:侧车补正——G-21畸形记录补key(行文互证)+G-03/G-46 blocking残句清空+parseHeader等段占位修复同批(镜像11/11) (6c7689cefb)
- 🔧 その他:G-50行双标头折叠为单标头(租约保留;A2终枚收口) (8fa1ec5d0b)

**2026-10-25**
- 🔧 その他:标头投影第二批——3行行内旧等段按已清侧车重写(等:国内短信/等:本机无/等:—占位叠加) (151e7d4982)
- 🔧 その他:G-63 owner统一为行内标头简称(反引号原文正文已可查),A2对账终枚 (4b52b3d395)
- 🔧 その他:侧车改判落地——A2对账批5键blocking残句清空+waiting出桶(G-20/G-100/G-50/O02/G-63) (cab00564bb)
- 🔧 その他:侧车标头投影批——10行行内标头与侧车投影形统一(A2对账收口;守恒断言在位) (462f1e8798)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (23eadba0af)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4ecb0c164b)
- 🔧 その他:结清 USDT TRC20 收款地址票(两行同题)——根 .env 与 apps/api/.env 现读均已按票面决策填入 sponsor 页同值,TRON 正则与 assertUsdtAddressFormat 两调用点在位;ERC20 并存不收敛为已裁结论。凭据:脱敏比对逐字相等(长度三十四/前缀 TMtT/后缀 MnbG)。 (2dffc2434d)

**2026-10-25**
- 🐞 修正:teardown 默认翻为跳过 cleanup——共享库测试用户被并发裸跑删除当日两次复发;E2E_AUTO_CLEANUP=1 显式启用才清理(CI 本就显式 '0' 于 e2e.yml:225,零消费方依赖默认清理);交错型并发(对方跑完清理的瞬间本席浏览器未起)是 hasConcurrentPlaywright 拦不住的形态,故默认不删;手动清理出口 node apps/api/scripts/cleanup-test-users.mjs 不变 (886eae6992)

**2026-10-25**
- 🐞 修正:OpenAPI 契约产物同步今日补建的两条绑定路由 (462044fe47)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2110948b96)
- 📚 ドキュメント:D04 登记验收面进展(浏览器级五例已入库,枚 4c80bf75db418f70d1b3fcf374efc2d845594cdd)—— 取证与剩余格按 §1 只进那枚提交信息,本行不翻勾(票面③规模化未动) (47b9db9f93)
- 🔧 その他:侧车reclassify终批——7键出等条件桶(G-03/G-20/G-100/G-46归他席与机主面,O02/G-50/G-74出桶),v2尺等条件归零 (8e681cfb07)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (59f1476f95)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1614f18a56)
- 🔧 その他:等条件禁令清偿收尾——末批摘行5枚(④/需真机副本/D19/H01/冷启动盘点,f12-purge留痕;union带回尾巴清零)⇒散文尺等条件全清 (9b53fd05d0)
- 🔧 その他:goal-r4 结清长会话滚动四维活账——r3e 判据三件齐:四维权名(映射 spec 断言)+可跑自验命令(supply 入口)+实测 rc=0(真浏览器 9 passed 2.3m);副本 L7663 已由他席结为指针 (12391049ef)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b5d3110deb)
- 🔧 その他:去重 机器可见的欠账清单(三路并行审计产出)2026-10-24 逐条核账 副本行改为指向主行短指针(禁手写归并注记) (5fdb7afd77)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6fc06bf1bb)
- 🔧 その他:goal-r4 结清 TEMP 等环境票——分叉已消(HKCU 现读标准值 D:/DevEnv/Temp)+夹具门现跑 rc=0 红线 0;LocalSystem 面按 §26 显式指定目录既有口径 (ef98e4083e)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (24f139c94f)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (95f0527553)

**2026-10-25**
- 🔧 その他:D04 消息串内富文本锚点补浏览器级验收面(五例真跑全绿) (4c80bf75db)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d3aeebebc7)
- 🔧 その他:goal-r4 结清 AGENTS 体积判据接链票——前提过时:门 207 已 blocking 装车(runner:4891 现读,stagedTriggers=AGENTS.md),注册表按域拆分条件随装车消散 (b4b7f05298)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (74ddef1c3d)

**2026-10-25**
- 🔧 その他:G-1102638 批1 同主键副本行物理归并 — 删 7 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-25.md) (6426b6134e)
<!-- END RECENT UPDATES -->

<p align="center">
  <sub>Built by <strong>吉林省愛智匯人工知能科技有限公司</strong> · オープンソース共創、あなたと共に</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star us on GitHub</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/fork">Fork to build your own</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues">Request a feature</a>
</p>
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
