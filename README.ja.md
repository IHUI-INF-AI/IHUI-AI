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
|                                      | **教務と出欠管理**                         | クラス出欠ルール(遅刻/早退/欠席)/ 欠席自動補記 / 休暇承認と同トランザクションで反映 / 一括点名 / CSV 出力 / 代理·本人·QR の 3 方式 / 本人ページ 3 端同期 / attendance-rule       |
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
| **AI サービス**    | `apps/ai-service/`   | FastAPI + LangGraph + Socket.IO | LLM ゲートウェイ + Agent 実行 + MCP ツール + A2A プロトコル + 38 配信 adapter、~577 エンドポイント。サンドボックスのライフサイクルは /api/sandbox/instances。Agent ツール sandbox_session は一時停止・再開・ファイルスナップショット・クローン・その場ロールバック。ネットワークと秘密は呼び出し側が渡せない                 |
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
### GitHub App webhook の非同期ディスパッチ(2026-11-06 に §21 の追記で登録、RP-69)
`POST /api/github-app/webhook` の `pull_request` / `issue_comment` 二つのディスパッチ経路は、「先に 200 を返し、処理は後で回す」方式になりました(Y-91)。
- **環境変数**:`GITHUB_WEBHOOK_RESPONSE_BUDGET_MS` —— 応答予算(ms)。「GitHub をどれだけ待たせるか」の上限であり、**タイムアウトによる中断ではありません**。予算が尽きても 200 を返し、タスクは中断も再試行もせず最後まで走り、配信記録も書き込まれます。
- **既定値**:500ms(ソース現読の `DEFAULT_RESPONSE_BUDGET_MS = 500`)。未設定・非有限値・負値のいずれも推測せずこの既定値に戻ります。`0` は純非同期モードで、常に先に 200 を返します。
- **応答に追加したフィールド `dispatch`**:`'inline'` または `'async'`。予算内に終われば 200 に `dispatch:'inline'` と既存の `outcome` を載せ(従来の応答形状は後退しません)、予算切れまたは `0` モード(`deferred`)では `dispatch:'async'` を載せ、`outcome` は付けず、重い処理はバックグラウンドのキューで走り切ります。
- **既知のギャップ(deferred はディスクに落ちない)**:ディスパッチキューはプロセス内の使い捨てメモリキューで、常駐サービスもポーリングも永続化もなく、配信記録はタスク完了後に初めて書き込まれます。そのため `dispatch:'async'` の 200 を返した後、バックグラウンドタスクが終わる前に API プロセスがクラッシュまたは再起動すると、メモリ上のタスクと未書き込みの配信記録はともに失われます。GitHub 側は配信成功と記録して再送せず、一次メモリ重複排除の LRU もプロセスと消えるため、その配信のレビュー / コメント書き戻しは黙って失われ、リプレイも照合もできません。現実装はこのウィンドウを塞いでいません(バックログ満杯時の「その場で実行」フォールバックは輻輳のみを防ぎ、プロセス終了は防ぎません)。

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
| **教務と出欠**           | しきい値ルール(遅刻/早退/欠席)/ 欠席自動補記 / 休暇承認連動 / 一括点名 / CSV 出力 / 3 方式チェックイン / attendance-rule |
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
| **メール**                    | IHUI-AI@aizhs.top                                              |
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

> 協力相談、企業接続、技術交流は上記 WeChat をスキャンまたは IHUI-AI@aizhs.top 宛てにご連絡ください。24 時間以内に返信します。

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

**投資家へ** — 私たちはまだ、オープンソースを真に理解し、AIを理解し、長期的価値を理解するパートナーを探しています。この物語が、たとえ1秒でもあなたの心を動かしたなら、ぜひご連絡ください([IHUI-AI@aizhs.top](mailto:IHUI-AI@aizhs.top) / WeChat `ok502319984`)。私たちには物語も、コードも、実行力も不足していません。不足しているのは、長い道を一緒に歩んでくれる人だけです。

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

## アカウント・キープアライブ・センター(2026-10-26 追加 — 無関係だった二本の生存確認を一つの答えに)

公開ラインの Cookie 探活(`services/publish/cookie_refresh_daemon.py`)と AI プラットフォームのチェックイン資格情報(`services/checkin_scheduler.py`)は、これまで別々のスイッチ・別々の集計・別々の失敗表現を持っていたため、「このアカウントはまだ生きているのか」に対して**システム全体で一つの答えがありませんでした**。本センター(`apps/ai-service/app/services/keepalive/`、HTTP 層は `apps/ai-service/app/routers/keepalive.py`)は、Cookie 探活・資格情報(api_key / oauth)の失効検出・チェックイン JWT の健全性(`exp` を読むだけで再署名はしない)を、一つのスケジュール、二つのテーブル、一つの健康度語彙、一つのアラート出口にまとめます。

| エンドポイント | メソッド | 何に答えるか |
| -------------- | -------- | ------------ |
| `/api/keepalive/status` | GET | 自己診断:本当に有効か(理由・スケジューラの生存・前回の要約・探針一覧)。設定を読んで推測しない |
| `/api/keepalive/overview` | GET | 健康度の総覧:四段階の件数・来源別・要対応・期限間近・直近 7 日の成功率・有効な設定 |
| `/api/keepalive/accounts` | GET | アカウント別明細。`?source=` と `?health=` で絞り込み可 |
| `/api/keepalive/events` | GET | 探活の履歴。`?ref=` と `?only_failures=true` で絞り込み可。`limit` は既定 50、上限 500 |
| `/api/keepalive/stats` | GET | `?days=`(1..90、既定 7)の来源別 ok / 失敗 / 合計 / 成功率 |
| `/api/keepalive/run` | POST | 1 ラウンドをバックグラウンドで起動して即返す。`?ref=<source>:<id>` で単一アカウント、`?force=true` でバックオフを無視 |

- **健康度の四段階**は一箇所(`policy.health_of`)だけで判定します。直近の失敗が `expired`、期限切れ、連続失敗が `ALERT_AFTER_FAILURES` 以上なら `critical`。連続失敗あり、期限警告ウィンドウ内、失敗しか観測していないなら `warning`。それ以外は `healthy`。成功も失敗も未記録なら `unknown`。**クライアント側で再計算してはいけません**。
- **失敗の語彙**:`ok` / `expired` / `network` / `error` / `unsupported` / `skipped` の六種で、正規化は一つの入口(`classify_message`)だけ。復号できない暗号文(`InvalidTag`、鍵不一致)は必ず `expired` — 何度再試行しても同じ誤りで、録り直ししか救いません。`unsupported`(そもそも生存確認が不要)は成功にも失敗にも数えず `failed` に入れません。そうしないと「本来不要なもの」が本当の赤を覆い隠します。バックオフは `base × 2^(n-1)` を `RETRY_CAP_SECONDS` で頭打ち、再試行は `RETRY_MAX` 回まで。成功したら連続失敗・警告印・アラート印をまとめて消します。
- **アラート出口**:サイト全体の `notifications` テーブル。**1 ラウンドにつき所有者ごとに 1 件へ集約**(19 件同時に期限切れでも 19 通は送らない — 送ると通知を切られて本当の異常が見えなくなる)。`probe-user` のような非 uuid の所有者は捨てて計数します(1 件の不正 owner でバッチ INSERT 全体が落ちるため)。テーブルが無い場合は warning を出して飛ばし、届いたふりはしません。`KEEPALIVE_ALERT_WEBHOOK` で追加送信も可。全体は fail-open で、通知の失敗がキープアライブを止めることはありません。
- **スイッチ**:`KEEPALIVE_ENABLED`。未設定時は `COOKIE_REFRESH_ENABLED` / `CHECKIN_CRON_ENABLED` から継承。`resolve_config()` は毎ラウンド再解決するので、`.env` の変更は再起動なしで次ラウンドから効きます。主な既定値:`INTERVAL_HOURS`=6、`RETRY_MAX`=3、`RETRY_BASE_SECONDS`=300、`RETRY_CAP_SECONDS`=21600、`ALERT_AFTER_FAILURES`=3、`ALERT_REPEAT_HOURS`=24、`EXPIRE_WARN_DAYS`=3、`ALERT_INAPP`=true、`PROBE_CONCURRENCY`=4、`EVENT_RETENTION_DAYS`=90。
- **境界**:判定するのは資格情報の生存だけ。投稿は公開スケジューラ、日次チェックインは `checkin_scheduler` の担当のままです(代行すると同一アカウントに二つの書き手が同時に触れます)。フロントは `apps/web/src/components/publish/KeepaliveCenterPanel.tsx`(`/publish/accounts`)、クライアント側のラッパーは `packages/api-client/src/endpoints/keepalive.ts`。

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
**2026-11-11**
- 🐞 修正:推送分叉自动收敛 + 落地复跑按落地面收窄 + 声明持久化(根治每次推送卡 5-20 分钟) (7265f95f404)
- 🚀 機能/改善:豆包接入签到体系——第五平台全链路接线 (b4cca8b95bb)
- 🚀 機能/改善:签到 API 定稿——detail+checkin 双接口,web 指纹实测定稿 (2ef06ac58be)
- 🐞 修正:回放文本安全阀——非文本消息占位 + 总长截断 (40cb7783939)
- 🐞 修正:回放文本安全阀——非文本消息占位 + 总长截断 (d692451deaa)
- 🔧 その他:给「喂 stdin」修复加装车锁(防回退 inherit 静默复发) (e3273d5391c)
- 🐞 修正:worker 推送显式喂 pre-push 的 ref 行,水印门不再恒「未判定」 (d9f528d9236)
- 🐞 修正:远端协议白名单放宽为 https+ssh(本机唯一通道;窗口闸与危险协议拒绝不动) (d33cd67cbbc)
- 🔧 その他:登记远端删除的 20261111000000 迁移件(删除随合并传播) (987d6e3e8ea)
- 🔧 その他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f446a0ffc30)
- 🔧 その他:钉住 renderStablePin 的五个收敛条件(防自激链静默复活) (db32cc91be6)
- 🔧 その他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a4cbcba5bdd)
- 🐞 修正:生成物自述钉改为稳定钉,掐断「重生成→收编」自激链 (4ab41d4292b)
- 🐞 修正:readDoubaoCookie 补 .bytedance.com 域的 msToken 风控票 (2541964724c)
- 🔧 その他:彻底移除系统 Administrator 凭据轮换违规迁移 (8955918c3bb)
- 🔧 その他:补 relay 号池批量推送脚本的溯源水印(远端新增文件漏注) (0f70833b764)
- 🔧 その他:文档自动更新游标推进(last-sha) (cc432ddf82b)
- 📚 ドキュメント:自动刷新最近更新块 + 游标推进 (415e137dd6a)
- 🔧 その他:nav-styles 箭头常量按 prettier 折行(仅格式) (bf36876c96b)
- 🐞 修正:侧栏交互项统一 —— 选中态反色、暗色 hover 纯黑、登录与导航同构 (8b37e3972ee)
- 📚 ドキュメント:补本地开发开关说明,并纠正租户严格模式默认值口径 (ca35093984f)
- 🔧 その他:收编守护落档产出(2 件,凭落点账本) (702e0df09c4)
- 🔧 その他:重算四端 ui-routes 与 rn-route-map + knip/README 数字同步 (68c0e32d3a2)
- 🐞 修正:同平台重复治理 —— zcode 键源补链 + 签到归属迁移收养 (2c72a450ece)
- 🔧 その他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f40d9ae05fb)
- 🐞 修正:系统管理员凭据轮换例外 —— 仅放行 password_hash 变更 (727f76a0c5d)
- 🔧 その他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (2696dd5c875)
- 🐞 修正:导出/回放腿按 2026-11-11 真机实证修正三处假绿 (d959839357b)
- 🔧 その他:壳声明件跟随新落承载页(260 条说明符) (b0edc59ca86)
- 🔧 その他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (df38ca133d7)
- 🔧 その他:自动落 2 枚小程序壳承载页(共 2 枚待产) (f8075c6c40e)
- 🔧 その他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (82fdd009e19)
- 🐞 修正:补齐 UpstreamSocketOpenOptions.heartbeatMs 契约并收口两脚本类型错(清 T1) (6756238fb01)
- 🚀 機能/改善:登录锁定支持账号豁免名单,默认关闭 (ab97a2a5fca)
- 🐞 修正:清掉测试面 typecheck 里长连接 lane 的 6 个存量错误 (9573af5378f)
- 🔧 その他:壳声明件跟随新落承载页(258 条说明符) (155a5b4d4be)
- 🔧 その他:自动落 2 枚小程序壳承载页(共 4 枚待产) (7eb6b47f007)
- 📚 ドキュメント:自动刷新最近更新块 (9f1dafe915f)
- 📚 ドキュメント:自动刷新最近更新块(收敛循环) (deda1ac0ffe)
- 🐞 修正:扫码面板取消自动弹协议窗,改为内联同意并继续 (23e6125fd96)
- 🚀 機能/改善:上游会话续写缓存 —— 同会话多轮透传 conversation_id,不再每次重建对话 (ec105c40232)
- 📚 ドキュメント:自动刷新最近更新块(收敛循环) (d5e9ecf561b)
- 🚀 機能/改善:回放迁移腿 —— 旧号对话以新会话进新号,豆包切号后可接着聊 (1af0dce1f43)
- 📚 ドキュメント:刷新生成块数字(trackedFiles 20934→20936,并入 relay 长连接收口 2 个新文件) (52848a9f7e5)
- 📚 ドキュメント:自动刷新最近更新块 + 游标跟进 cb64a7fd1c (86abb395e5b)
- 🐞 修正:启动门只等必需后端三件套,/health 免租户(修 240s 假死) (3460206c423)

**2026-11-10**
- ⚡ パフォーマンス:全池推生产合并为单次 SSH 握手，能力探针与导出并行 (e4008a1a7a7)
- 📚 ドキュメント:刷新生成块数字(trackedFiles 20930→20934,并入远端 4 个新脚本路径) (cb64a7fd1c4)
- 🔧 その他:同步小程序 entry 清单(新增 2 枚壳承载页后页面数 331→333) (13e9ad2c965)
- 🐞 修正:长连接收口——代理隧道 agent、会话级亲和键、看门狗补全 (14dcbd290d5)
- 🐞 修正:侧边栏选中态降对比 —— 统一 sidebar-active 弱底(明暗主题) (104ed9e8f95)
- 🐞 修正:豆包跨号会话云端归档腿 + 一键入口文案据实测更新 (8068aa017c8)
- 🚀 機能/改善:号池导入支持批量与生产推送，全池迁生产收敛为一条命令 (da8d7b06061)
- 📚 ドキュメント:刷新生成块数字(relay 长连接 4 文件并入致 trackedFiles+4/testFiles+2/wsEndpoints+1/apiRoutes+1) (993f458ebf0)
- 🔧 その他:壳声明件跟随新落承载页(258 条说明符) (a83db3919eb)
- 🔧 その他:自动落 2 枚小程序壳承载页(共 4 枚待产) (7ce25c7a45a)
- 🐞 修正:会话对账器补字节级兜底 —— 库被清空也不再是盲区 (df6082c173f)
- 🐞 修正:base.css 第二份源纳入小程序 token 同步触发面 并补全 T1 配套断言 (36d956d285f)
- 🔧 その他:补 relay 长连接 4 个新增文件的溯源水印 (45e114f364a)
- 🚀 機能/改善:号池 relay 全链路长连接贯通(契约+传输层+选路+WS 入口) (87e9aad2af0)
- 🚀 機能/改善:对话随行落到实处 + WorkBuddy/OpenCode 写回真打通 (250ec2e0e34)
- 🐞 修正:补 miniapp-taro 词包 eduAi 命名空间 20 键 清门 302p (9ea36e90cb7)
- 🐞 修正:豆包 chat 打通 —— POST /chat/completion + SSE,推翻「走长连接」误判 (54148716627)
- 🔧 その他:补两枚判据面收敛提交的具名追认行 (636bde65293)
- 🐞 修正:豆包 chat 打通 —— POST /chat/completion + SSE,推翻「走长连接」误判 (44404bb5e28)
- 🔧 その他:ui-routes 四端重算 + knip 受管块同步 (External-Red-Audit / Push-Channel: direct-merge) (94dcbdd310f)
- 🔧 その他:生成器重算收口 — sync-readme-numbers / gen-ui-routes / gen-i18n-compressed / gen-knip (External-Red-Audit / Push-Channel: direct-merge) (3cc4c48fdbb)
- 🐞 修正:收尾修复 — 门 128 platform 非法 + docs 同步 + RN 残留清理 (55b19ffe086)
- 🐞 修正:豆包适配器判活改走 IM batch_get,实证替换全部推断值 (57f105e3f0c)
- 🐞 修正:豆包适配器判活改走 IM batch_get,实证替换全部推断值 (00a62e9b2e6)
- 🔧 その他:收编停留≥3分钟的未提交改动 (0ba0746bb83)
- 🐞 修正:修掉「写了但客户端不认」的两型 —— MiniMax 记录形状污染 + OpenCode v2 落点失效 (0c17085f7da)
- 🐞 修正:余额端点二次实证纠正(改 points/records + 100001 非失效,避免误杀有效号) (68c93885b46)
- 🐞 修正:余额端点实证落地(域名+路径+token 头三重纠错,缺票不判死) (ffcff7a443d)
- 🐞 修正:一键切号写回腿根治 + 缺模板拒写 + 会话模板回填器物 (136b39adffc)
- 🚀 機能/改善:小程序/RN 中文回退链同源 + RN 端自托管方案根因收口 (9fb83e175b5)
- 🚀 機能/改善:web 正文 400 档分段 unicode-range 按需面 + 门 313 跨端触发面补齐 (57d84775b4d)
- 🚀 機能/改善:一键切号窗口实时显示各平台余额(未支持如实标注,不编 0) (c1aebcd0acc)
- 🔧 その他:裸 git 派生迁 gitRaw 层 收口棘轮例19 (450f4531184)
- 🐞 修正:收口 gate-test(6) 两枚 Linux 专属红(abort 漏判 + 原子写夹具漂移) (3e662520bcf)
- 🐞 修正:修复永久保活号静默饿死(server 档未判定放行 + minimax 探针接线 + 1h 节拍) (6a6c3cfcd4a)
- 🚀 機能/改善:门 313 登记维断判据根治 + 属主登记补漏 + token 档位同源 (9dd458b22bc)
- ♻️ リファクタ:门体自检的 cat-file 取材收敛到 face-reader 取材层 (a8ad54d2111)
- 🔧 その他:收编停留≥3分钟的未提交改动 (aef27ba3d9a)
- 📚 ドキュメント:数字块按 HEAD 面重算（与推门 check-doc-numbers 同面） (7c9999939f0)
- 🐞 修正:补迁 check-hook-chain-refs 的跨行裸 git 派生 (46dd3e0b864)
- 🐞 修正:五处裸 git 派生迁到统一承载层 gitRaw（清门193与测试面两条欠账） (264c676468c)
- 🐞 修正:门313 补 T4 书写面臂——品牌/子集/display 族所在栈一律配中文现代黑体兜底 (d786ae8aef7)
- ⚡ パフォーマンス:接线对账门多模式 grep 分片,真仓全量 43.8s→8.7s (a381e3a33fa)
- 🐞 修正:恢复 /llm/models 路由挂载并消除 build_model_catalog 自递归 (3e8fdd3d4d4)
- 🚀 機能/改善:三端滚动边缘淡出 ScrollEdgeFades + 抽屉/底部遮罩细化 (acdd5f169e0)
- ⚡ パフォーマンス:祖先取材改逐路径并发,18 条 M 路径 44.8s→19.4s (c6bb81e5844)
- ⚡ パフォーマンス:祖先取材按 HEAD+路径记忆,同轮不再为同一路径走两遍全历史 (d0b4aad6715)
- ⚡ パフォーマンス:3b 对账延后到后台 + 逐路径覆盖结论缓存,提交链 116.7s→28s (7ab84a93144)
- ⚡ パフォーマンス:水印提交档分母收窄到本次携带,单门 24.5s→1.0s (0cf426141b0)
- ⚡ パフォーマンス:30a 悬空集合单列缓存,提交链守门实测 309s→69s (775ca7e7837)
- 🐞 修正:合并后按 token 档归一 inline-question-card 字号与字重 (10e5b33bb52)

**2026-11-08**
- 🚀 機能/改善:补齐 AI 生成显式/隐式标识 (8d972f386c6)
- 🚀 機能/改善:补齐 AI 生成显式/隐式标识 (f4535c338e9)
- 🚀 機能/改善:Groups 屏薄壳承载落地(RN 壳同源渲染,词条取 web 原文) (e7d27e3e994)

**2026-11-07**
- 🐞 修正:补 web 端 apiKeys en/ko 译文(24 键,清门 4 pending) (5e1c14de23a)
- 🐞 修正:四屏壳改桶导入,补门173共享屏直接 import 覆盖 (e71cd19a5d6)
- 🚀 機能/改善:TeamKnowledge 屏下沉共享屏,RN/Web 同源渲染零降级 (c0ca814f166)
- 🔧 その他:重算 rn-shells.generated.d.ts（补 VipTraderScreen，修门 251 C9 不同步） (fa6c08282d1)
- 🐞 修正:RepoWiki 生成禁用提示回到宿主(详情内重复入口去重后补齐可发现性;删 web 失用键 refresh/regenerate) (a3dc7d1bc5f)
- 🚀 機能/改善:RepoWiki 共享屏下沉(RN/Web 同源渲染,零降级) (b37e84d18cd)
- 🐞 修正:Groups 三列断点卡片基宽 (97cb9752de7)
- 🚀 機能/改善:Groups 屏下沉共享屏,两端宿主注入 (39fcfc991bb)
- 🚀 機能/改善:Patrol 屏下沉共享屏,两端宿主注入 (cd9a85fea20)
- 🚀 機能/改善:ApiKeys 屏下沉共享屏,web/mobile-rn 五语言词表补齐 (10f86bc743f)
- ♻️ リファクタ:EarnCommission 壳删冗余 View 层(共享屏根已等价提供 flex+背景) (62cb2eaa1f9)
- 🚀 機能/改善:TokenValue 记录时间范围条下沉共享屏(数据型注入点,RN/小程序同源) (e7c52e45ba2)
- 🚀 機能/改善:8 条单端槽位裁决落锁,2 条真下沉 (72a500c1156)
- 🔧 その他:再 rebase 后生成器取胜, 刷新 ui-routes 钉值与 README 数字 (5c833a7bbc5)

**2026-11-06**
- 🚀 機能/改善:补齐 Team/MessageCenter/ArticleList/Coupon 行为型 prop 跨端缺口并清理死契约 (a872076ccc9)

**2026-11-10**
- 🔧 その他:合并收口补 AGENTS 点名 scan-api-routes 并按新 HEAD 重封根护栏清单 (f2261133d5)

**2026-11-09**
- 🚀 機能/改善:autopilot 公网远程 MCP 端点 —— 对外曝光,任何 AI 一行 URL 接入 (225bbcec27)

**2026-11-09**
- 📚 ドキュメント:按对照实验钉死第 ② 组根因并补线上复验读数 (e3ab29982f)
- 🐞 修正:第 ② 组改用不可变 sha 做 compare 并补 Dependabot 排除 (fb3283c6f2)
- 📚 ドキュメント:生成块对齐合并树 HEAD 面现算 testFiles 4776 与 trackedFiles 20631 (ff820cf667)
- 🐞 修正:MCP server 定位更正 —— 仓库内标准导出形态,不注册任何 AI 宿主配置 (d2327e58d2)
- 🐞 修正:修复两份 README 生成块数字被写成空值 (fa7b946c7f)
- 🐞 修正:按当前 HEAD 重生成 7 份离线派生包并销账 3 条陈旧豁免 (8d311c1679)
- 🚀 機能/改善:autopilot MCP Server 化 —— 任何 MCP 客户端可即插即用接走 (3ef4eb8a95)
- 📚 ドキュメント:生成块对齐合并树 HEAD 面现算 第 1 轮 (77c81a1887)
- 🚀 機能/改善:autopilot HTTP 端点 —— AI 会话可编程自主调用入口 (d47c93b5c0)
- 📚 ドキュメント:生成块对齐合并树 HEAD 面 testFiles 4774 与 trackedFiles 20626 (1952f3f8af)
- 🚀 機能/改善:WorkBuddy 全量自动驾驶闭环 —— Sequential族直连链放行 + 服务层选路引擎 + 调度器无人值守接线 (735c9e20c4)
- 🔧 その他:为他席 dfec4a76 补具名追认行以解 push 区间未声明 (0c19738ebf)
- 🐞 修正:补 git 派生 stdio 显式接管并按 HEAD 面刷新两份 README 生成块 (209c6a9219)
- 🚀 機能/改善:desktop 计分链闭环 + 号池对账腿 + 产物自检 + 执行留痕 + 一键自动驾驶 (6a5966c184)
- 📚 ドキュメント:trackedFiles 生成块 20613→20615 对齐新增判定器件与镜像测试 (ed0d522fb4)
- 🚀 機能/改善:远端分支三态判定器件化并补齐收尾闭环 (cdacbb2152)
- 🐞 修正:门未判定分支引用未定义常量致旁路落地器崩溃 (e1a10dfe29)
- 🐞 修正:剥掉 v4 参考层不执行的 classic 插件,恢复 C1/C8 判定面 (dfec4a7641)
- 🔧 その他:收编守护落档产出(2 件,凭落点账本) (9a73536db8)
- 🐞 修正:补齐模型列表刷新文案键并清理 shared 重复键 (4f9fb284e9)
- 🐞 修正:V1 工具闭环 + 非流式审批投递 + 退出码/状态诚实化 + 默认执行器纠正 (#217) (e6b7227099)
- 📚 ドキュメント:trackedFiles 生成块 20612→20613 对齐新增三态判定票 (a533cb36e7)
- 🐞 修正:跨端同步不再污染 bot PR 源分支并补远端分支逐支三态判定票 (fdcad5b70d)
- 🐞 修正:清理工作流补 GH_REPO 使无 checkout 的 job 能跑 gh 命令 (55c417f202)
- 🐞 修正:补 sag2_lexical 顶层 Chunk 导出并修 CLI 测试 lint 两处 (6be381a784)
- 🔧 その他:结构锁改用 TypeScript AST，并让门 89 夹具取材面对齐 DOC_FILES (4b08fae461)
- 📚 ドキュメント:落自动腿 2026-11-09 维护区刷新与关键数字块空行,同步 last-sha 指针 (571e21be66)
- 📚 ドキュメント:合并面 0d503a4 数字按唯一写入口现算刷新(trackedFiles 20612/testFiles 4768) (1c27bda99a)
- 🐞 修正:C6 结构锁改为判函数体层级,并合流远端 tip 重算 README 生成块 (08d6cd408b)
- 🔧 その他:perf(sag2)+feat(sag2): 扫描件 OCR 四级链落地；多跳检索等价提速 4.4×（召回结果逐条不变） (abd73298e4)
- 🔧 その他:入库11-08远端分支只读清点工单+防火墙禁用滚动留痕(README数字块DN5同源刷新) (0646e1d290)
- 📚 ドキュメント:trackedFiles 20577->20578 / testFiles 4753->4754(上一枚新增 tests/test_agent_loop_tools_wire.py) (fd62c925ce)
- 🐞 修正:派工 tools 从未进入模型请求 —— 接上转发并把参数面改成分层瘦身 (fd5f2a1243)
- 🚀 機能/改善:真文件监听 + 音视频转写 + 图片OCR，并修掉建库平方级开销（229×） (7d2e787bcf)
- 🚀 機能/改善:本地文件夹登记/增量扫描 + 7 类格式抽取 + 接入 RAG 第三路与 Agent 门面 (8ed115c505)
- 🚀 機能/改善:批次3-2 钩子链引用完整性门落地(4fbf 归档移植,号 312→305/305p) (0b74581c6b)
- 🚀 機能/改善:融合增益/真实判定质量/真实pgvector A/B 实测落地 + 对外宣称口径文档 (de424b3c06)
- 🚀 機能/改善:批次3-1 看门狗阶段协议落地(1d885 归档移植,只取分段+BLOCKED_BY_CONCURRENCY) (d01f415176)
- 📚 ドキュメント:trackedFiles/testFiles 按 81288dac 合并面刷新(ai-service 腿 2 新路径入数) (16d0abcf2c)
- 🚀 機能/改善:刷新模型列表/每5h自动探测联动上游模型同步 (47bc9a182b)
- 📚 ドキュメント:批次2/4经合并枚5189b047入wave-1108去向补记 + README按合并面刷新(trackedFiles 20575) (ce0419d708)
- 📚 ドキュメント:门数漂移 332→344 定性为夹具过时(12 增 0 删含引入提交)+ 收尾账快照(F-274/275、F-191、pytest 22 例新立账、Kling1500 裁决保留) (a6221b70d8)
- 🐞 修正:多线并行期显式暂停跨端收编腿(开关文件+日志,不靠改时间戳) (b920768a68)
- 🚀 機能/改善:P0-2 先验后落+目标ref参数化(A/B/C/D+④/F) (57bac66a17)
- 🐞 修正:收编归档线 DBG-43..49 写盘守卫与 8 个用例(批次2 单提交) (a01cb2722b)
- 📚 ドキュメント:区分 06:25/06:30 两笔 update-ref，补硬编码 main 的落地器与封口第④条 (91d705cc70)
- 📚 ドキュメント:记门47 三组存量红与 2bb7c39959 通道归因 (a3dea0ff9e)
- 🐞 修正:水印门 47 拿不到范围一律 exit 2，自愈写盘严格限制在判定面内 (ce22583703)
- 📚 ドキュメント:补录 CI continue-on-error 清单与 immutable guard 读真实索引两篇，并登记主工作区瘦身波不采纳票 (f8d0cd42c9)
- 🔧 その他:忽略 worktree 归档、e2e 截图与轮转日志 (438f3e1fb4)
- 📚 ドキュメント:交接账补收尾链 51749a7075 与门47 75/190 读数 (876f81a986)
- 📚 ドキュメント:交接账补最终 tip(38c8148278) (51749a7075)
- 📚 ドキュメント:UI 缺陷合入交接账(17 笔映射/4 笔门账/45→0 复算/14 笔审计) (38c8148278)
- 📚 ドキュメント:T1 收官票补数字口径与直推 main 绕过留痕 (4ac7febf4a)
- 📚 ドキュメント:T1 存量红基线票收官为已清 (cfe4d6f731)
- 🐞 修正:夹具对齐共享类型面(分销传参/plan constraints) (d5c0dd8731)
- 🐞 修正:移除 money-unit 测试中未使用的 REPO_ROOT (e4c0a435a3)
- 🐞 修正:tt 调用补 fallback 并给路由夹具加空表守卫 (e81cf6e796)
- 🐞 修正:account-deletion 页补 useAuthGate 导入 (e643edd9e4)
- 🐞 修正:收敛重复的 measuredCompactRatio 并移除未用导入 (e7b1139c57)
- 🐞 修正:清 T1 存量红 25 处(合并重复/缺列/响应码声明/泛型约束/夹具) (1e0d1c1b19)
- 🐞 修正:deadline-ticker 环境探针改为 globalThis 能力判定 (4fb05b74bd)
- 🐞 修正:对齐小程序端 common.gotIt 与 RN 端,清 303p 跨端文案存量未裁项 (c0ee26ecf3)
- 🐞 修正:RN 收藏页接后端真分页与加载更多(票 C),补齐 bookmark 分页五语键 (5bc619bdd4)
- 🐞 修正:手机号页发码/绑定同 tick 互斥与定时器托管(票 E),补齐 9 个延迟返回页卸载清理 (99467300f8)
- 🐞 修正:接入顶层键大小写冲突门禁 (3c3831db44)
- 🐞 修正:miniapp-taro 顶层大小写重复键归位 camelCase (b603657f60)
- 🐞 修正:mobile-rn 顶层大小写重复键归位 camelCase (564d350917)
- 🐞 修正:绑定邮箱发码/提交加同 tick 互斥,延迟返回定时器托管卸载清理 (1378c54ddd)
- 🐞 修正:补 302r 的 R4 文档点名,门 89 在 main 面转绿 (fb01cbda03)
- 🐞 修正:吸收 main BUG-NEW-01——ActivityDetailScreen 错误/空态恢复页头返回入口，清 3 例既有红 (f7454026c9)
- 🔧 その他:吸收 main 红面扫描批次4 的三份夹具，清 avatar/chip 行距/pump 慢路径 4 例既有红 (6befb78f7a)
- 📚 ドキュメント:校正 XUI-084 消费点行号（回填 :71 / 提交 :39 / 单元格 :70） (c4f74df783)
- 🔧 その他:opType 七键文案与压缩载荷重生成 (6d2ee32b72)
- 🐞 修正:三腿钱包流水接入唯一表，opType 6 按非金额渲染 (2f0ac5f2c4)
- ♻️ リファクタ:opType 展示语义收成全仓唯一表 (26122d8cfa)
- 🐞 修正:API 套餐价格量纲收成唯一换算点并补首尾相等夹具 (97e1d135dc)
- 🐞 修正:收口全部如实登记遗留项——真实PG/HTTP端到端、UI真测试、判定状态形状锁、工具链与门红根治 (29489c1165)

**2026-11-08**
- 📚 ドキュメント:收口 web/RN ui-routes 补生成——终态钉、输入条数与已变来源；定论为源码改了未重生成，非生成器缺陷 (09ddb6c586)
- 🐞 修正:重生成 ui-routes 白名单（2 输入，1 条已变：RootNavigator.tsx ← XUI-004 0ba309d2f7 + XUI-068 d6306a65b3；终态钉 fd754397…；349 条路由未变，仅 skipped 7→8） (23bfb6ca86)
- 📚 ドキュメント:记录 web/RN ui-routes 补生成——web 已提交 ea1555d0cc，RN 因输入来自 XUI-004/XUI-068 停下待裁决 (c445ae3725)
- 🐞 修正:重生成 ui-routes 白名单（923 输入未变，4 条已变输入均来自本线：wallet 页/XUI-086、agents 精选+我的/XUI-075、admin 套餐/XUI-082；终态钉 d413f735…） (ea1555d0cc)
- 🐞 修正:193 第二处 stdio + T1 预算校准(405s 实测) + 并集口径票 (43b74a5a10)
- 🐞 修正:门 193 判红面补显式 stdio(check-hand-migration-snapshot 派生 git) (2bd0011ef1)
- 📚 ドキュメント:散文声明数字对齐现算(testFiles 4372→4404 / 守门 351→352) (0f8c684ffa)
- 📚 ドキュメント:B 票 + 存量红清单 + commit-tree 一次性例外留痕 (84d9ca21d6)
- 🐞 修正:F-89 流式中断按实际 token 结算；F-181 缓存命中 token 归零、请求次数照计 (e59db57adb)
- 📚 ドキュメント:更正对照组复核——web/RN ui-routes 本次 0 diff 但自身钉早已陈旧 (a9f02c26d6)
- 🐞 修正:F-203 Coze 扣费按定价折算成分,token 估算取 chars/4;Kling 1500 保持不动 (dcd98ca604)
- 📚 ドキュメント:记录 XUI-076 重生成完成（9fc8e895cb，8 文件）与终态钉/对照组 0 差异证据 (5d173a7dcb)
- 🐞 修正:XUI-076 重生成 i18n 四语载荷与 ui-routes 白名单（单一写入者一次完成，8 文件） (9fc8e895cb)
- 🐞 修正:F-203 stock-service 预扣/退还改按定价成本(分),不再拿 token 估算数当钱扣 (3cefb12800)
- 🐞 修正:F-203 Crew 路由删掉按 run 的二次扣费,避免与 adapter 逐次成本结算双扣 (5e608a3792)
- 📚 ドキュメント:记录 XUI-076 执行前闸门——API 线 F-203 未合 main 且四个同型扣费点未全部收口，暂不重生成 (7532cae8e6)
- 🐞 修正:F-203 异步回调 worker 改为按定价成本(分)结算,堵住 token 数当分的错扣 (2492296e86)
- 📚 ドキュメント:刷新 XUI-076 重生成前置清单（含 4 个 b64 载荷）并将 XUI-087 处置改为 B、由 API 线统一修 (5104a2ef05)
- 🐞 修正:F-203 口径 B,钱包扣减与 ai_cost_records 同源按真实成本(分)结算 (cea6f4565e)
- 📚 ドキュメント:XUI-086 opType 方向修正落地 + XUI-087 AI 计费腿判定（污染资金账，待费率口径） (60ab2b569e)
- 🐞 修正:opType 文案/正负号/颜色按服务端权威枚举（3=退款扣回 4=Relay 转账），未知值中性兜底 (0b3724817a)
- 📚 ドキュメント:同步文档数字（ciWorkflows 56→57、trackedFiles 20187→20188，新增 cleanup 工作流） (3aac6c7a2f)
- 🔧 その他:落地通道改为固定分支 cross-end-auto+复用单 PR+自批 CI+auto-merge；新增 3 天快照清理（默认 dry-run，删前导出 sha 清单） (669b753484)
- 🔧 その他:补两个钱腿端到端量纲断言（199 元 ⇒ 请求体 199 ⇒ 落库 19900 分；提现反向） (79eac0bbcf)
- 🐞 修正:写清 token_flows 同列两义（分/配额），钱流水端点默认排除 op_type=6 (ec179dfd99)
- 🐞 修正:API 套餐 price 分→元（表格/回填/提交三腿同源） (f219b27053)
- 🐞 修正:知识卡片读不到时抛 KnowledgeCardsUnread,不再覆盖旧卡库 (9295896f4f)
- 🔧 その他:worktree-state 注释收敛回 §3 <250 行(结构调整,非缺陷) (6b22eca35c)
- 🔧 その他:夹具对齐 wc-l 行数口径与技能扫描 fail-closed 语义 (2becdb0a36)
- 🔧 その他:对齐额度一位小数、V2 mock 与压缩锚点后的 parity 期望 (28d07ff516)
- 🐞 修正:会话发现区分读不到与没有,补齐跨产品迁移预演判定 (3ee8c4cde4)
- 🐞 修正:removeWorktree 恢复必填 withinRoot 根内断言 (1a9add9abb)
- 🔧 その他:require-permission mock 补 isSystemAdmin 同步导出，修 agents-market-public 4 例存量红（夹具缺口，无实现改动） (0648ffbd3a)
- 🐞 修正:金额单位 支付弹窗元值直用 + 订单详情映射 payAmount 并修正退款字符串 (a6413ea859)
- 🐞 修正:恢复检查点/hunk 目录的根内断言与路径穿越拒绝 (b1f3c6a6e7)
- 🐞 修正:金额单位 智能体详情/精选/分类价格按分转元 (8f7b3b3036)
- 🐞 修正:金额单位 支付宝下单分转元 + 提现分/元对齐 (2cd995ca5d)
- 🐞 修正:配置存在但读不到时抛错,不再静默当空层 (e0bd5f2aaf)
- 📚 ドキュメント:README 数字同步(F-26/F-31/F-49 新增 2 个测试文件:4449 / 20187) (8343b1f606)
- 🐞 修正:F-26 页码上界(1e308→Infinity)、F-31 agents 分页边界、F-49 MCP 转发 deadline 与超时/不可用分流 (17b4c9c4f6)
- 📚 ドキュメント:README 正文测试文件现算数同步(4446→4447) (7026d2d0bc)
- 📚 ドキュメント:README 数字同步(F-255 新增 1 个测试文件:4447 测试文件 / 20185 跟踪文件) (c79daf93d0)
- 🔧 その他:F-255 归属闸改异步后同步夹具(mock 补 findByIdOrRestore、结构断言容忍 await) (a7624e9799)
- 🐞 修正:F-255 终态派单运行时无界增长收口(200 条 LRU + 30 分钟 + Redis 回退/TTL) (2e4ab7e3ca)
- 🐞 修正:XUI-068 忘记密码复用 web 找回页断开死环 + XUI-071 分片下载有界 + XUI-054 FS 显式 not-supported (d6306a65b3)
- 🐞 修正:XUI-063 广场/充值文案 key 对齐源并补齐缺失键(含 common.gotIt) (af15ecdcb5)
- 🐞 修正:相对时间兜底补 ja/ko(Hermes 无 RelativeTimeFormat 时不再回落英文) (c38ec4c9b4)
- 🐞 修正:智能体价格分转元 + mobile-rn 订单/登录/产物 i18n key 补齐 (ffa7594775)
- 📚 ドキュメント:同步 RECENT UPDATES 生成块与 doc-autoupdate 基线 (2485323c91)
- 🔧 その他:补齐门 47 自愈注入留下的隐形载荷缺口，无业务改动 (f3ae170b31)
- 📚 ドキュメント:同步 RECENT UPDATES 生成块与 doc-autoupdate 基线 (8063d609f5)
- 🐞 修正:宿主壳对账补扫孤儿生成物(按 --screen 溯源行反查契约) (1229f26b8b)
- 📚 ドキュメント:抽走核心数字段残留派生字面量 + 补 Monorepo 分隔符 (0994e3a989)
- 🐞 修正:RN 宿主壳生成器按腿声明 hook + 把不可复现的旧壳判为陈旧 (54f841b4f7)
- 🐞 修正:倒计时统一收敛到 shared useCountdown(截止戳派生+回前台对表) (83f61d85eb)
- 🐞 修正:F-306 契约面去掉误导性 200,只声明 501 (0d8db01064)
- 🔧 その他:host-git/agent-control/考勤规则面板夹具跟上共享出口与 Tooltip(批次24) (9c374b6e6f)
- 🔧 その他:徽章/自定义侧栏/nav 计数夹具跟上 2026-11 实现(红面扫描批次23) (a870c411ce)
- 🐞 修正:修 knowledge-base i18n 泄漏并让争议夹具跟上实现语义(红面扫描批次22) (6edf5a1764)
- 📚 ドキュメント:同步 README 正文的测试文件现算数(4446) (eb11488487)
- 📚 ドキュメント:同步 F-38 夹具后的 README 现算数字(testFiles 4446 / trackedFiles 20184) (82bd61611f)
- 🐞 修正:F-38 aiServiceFetch 补默认 deadline 并抛可识别超时错误,与上游 5xx 区分 (0ef93c94b6)
- 🐞 修正:恢复学生考勤 B72 整月视图与自签退,并对齐 api-client 出口(红面扫描批次21) (495ca3e36c)
- 📚 ドキュメント:同步 README 正文的测试文件现算数(4445) (bf72910261)
- 📚 ドキュメント:同步 F-08 夹具后的 README 现算数字(testFiles 4445 / trackedFiles 20183) (f130b15a5e)
- 🐞 修正:F-08 agent-control 待处理指令绑定属主,/result 与 /execute 双端校验归属 (92339429b8)
- 🔧 その他:勾选 AIS-053（已修@2026-11-08/mcp-media-p1-1108@fdf457bd9a） (da95fbbd17)
- 🐞 修正:AIS-053 外部 MCP 落点默认 fail-closed + 注册权收归 admin + DNS 后按真实 IP 判定 (fdf457bd9a)
- ♻️ リファクタ:倒计时收敛进 useDeadlineCountdown(行为不变,非缺陷修复) (1d08865528)
- 🔧 その他:use-chat 三夹具补 onDone 回执对齐 G-816008 真变更(红面扫描批次20) (42937822c7)
- 📚 ドキュメント:同步 README 正文的测试文件现算数(4444) (0d24bd2a0b)
- 📚 ドキュメント:同步 F-07 夹具后的 README 现算数字(testFiles 4444 / trackedFiles 20182) (b292f991f5)
- 🐞 修正:F-07 后台 Agent 的 list/get/cancel 按登录归属过滤，创建归属不再接受 body userUuid (831f9fd268)
- 🐞 修正:ActivityDetailScreen 错误/空态恢复页头返回入口(BUG-NEW-01) (6814636558)
- 🔧 その他:tbox 分页腿 list 与课程小节批量取数桩(红面扫描批次19) (b37bb6ea5a)
- 🔧 その他:paginatedSuccess 返回 list 的三处断言对齐(红面扫描批次18) (ef3d9f89ff)
- 🔧 その他:家长账单批量取账/agent 首屏 50/消息可见投影对齐(红面扫描批次17) (9cacf3ed42)
- 🔧 その他:journal idx 0-based 与 MCP 纯代理腿计数对齐(红面扫描批次16) (adf18d872a)
- 🔧 その他:keepalive/sweep/微信判定对齐心跳与代理改造(红面扫描批次15) (6ec261bc82)
- 🔧 その他:池导入/告警/钱包对齐新契约(红面扫描批次14) (75e1de43c8)
- 🔧 その他:内容/内部中继/代管导入对齐 requireAdmin 与 HMAC 新契约(红面扫描批次13) (83f6dcecf0)
- 🔧 その他:补 require-permission isSystemAdmin 与 messages users 表桩(红面扫描批次12) (6620f18100)
- 🔧 その他:桥层上报转接 api-client 端点出口,消除模块级 fetchApi 盲区(红面扫描批次11) (f1bdb2ac81)
- 🔧 その他:fetchApi 改 text()+JSON.parse、插件改 api-client 端点、401 按 BUG-69 先清会话(红面扫描批次10) (bbe313a17a)
- 🔧 その他:补 Taro 运行时常量 define;崩溃上报 mock 补 reportCrash;community 壳页断言对齐(红面扫描批次9) (51592d32de)
- 🐞 修正:n8n 创建表单补回 3 个 useUiField 登记;采纳锁随壳承载退场(红面扫描批次8) (08274c0295)
- 🔧 その他:桥层上报改 mock api-client 端点出口;搜索文案走 sharedT(红面扫描批次7) (1eaf457e97)
- 🔧 その他:SSO 断言对齐生产域名回退(BUG-41/68),不再钉 localhost:8802(红面扫描批次6) (428ef237f2)
- 🔧 その他:会话历史排序结构锁下沉到 shared/chat/conversation-org(红面扫描批次5) (3d77870667)
- 🔧 その他:pump 慢路径计数/Avatar 接锁/chip 行距死腿与 token 化对齐(红面扫描批次4) (456d1777e3)
- 🔧 その他:ENGINE_METHODS 补两法 + 空响应体按 null 新契约(红面扫描批次3) (8d5f5272db)
- 🐞 修正:VipScreen 接回 host port;linuxdo 排序夹具对齐(红面扫描批次2) (cf2bffa4a1)
- 🚀 機能/改善:P1-P5 全量收口(二级聚合挂载图/PG持久化/真实判定网关/预算留痕/基准/测试增强) (6ea56fc0d2)
- 🔧 その他:对齐 journal 0-based 与已删除的孤儿安装迁移(红面扫描批次1) (ff17c13163)
- 🐞 修正:清偿全量 typecheck 存量红（14 处，含 F-270/F-252 遗留的类型回归） (e009f22742)
- 🔧 その他:勾选 AIS-008（已修@2026-11-08/mcp-media-p1-1108@bcf50b3280） (b06174d971)
- 🐞 修正:命令流/子代理进度流改为有界队列(AIS-008) (bcf50b3280)
- 📚 ドキュメント:同步 F-223 夹具后的 README 现算数字(testFiles 4443 / trackedFiles 20181) (3bbf54cc3c)
- 🐞 修正:F-223 未匹配路由的 apiCallTotal 统一落 __unmatched__，消除无界标签基数 (c6730d06bc)
- 🔧 その他:勾选 AIS-049/057（已修@2026-11-08/mcp-media-p1-1108@2b1f28b3d2） (28c8b748ea)
- 🐞 修正:self_media 历史查询不再吞 DB 故障 + 工具兜底回执补 errorCode 并脱敏(AIS-049/057) (2b1f28b3d2)
- 📚 ドキュメント:同步新增夹具后的 README 现算数字(testFiles 4442 / trackedFiles 20180) (6414ce5494)
- 🐞 修正:F-291 SSE 重放缓冲容量满时重注册不再误淘汰其他活跃流 (461bbae68a)
- 🔧 その他:勾选 AIS-035/083（已修@2026-11-08/mcp-media-p1-1108@bc025ddb42） (4621a5eeab)
- 🐞 修正:computer-use 导航 SSRF 双闸 + file_edit 读改写整体持锁(AIS-035/083) (bc025ddb42)
- 📚 ドキュメント:同步 README 文档数字与最近提交面（testFiles/apiRoutes/trackedFiles 与现算对齐） (e179987387)
- 🔧 その他:补齐本次新增 11 个文件的 47p 溯源水印 (87e35b6132)
- 🔧 その他:勾选 AIS-054/056/085（已修@2026-11-08/mcp-media-p1-1108@c2e723bf2d） (9351e9a823)
- 🐞 修正:web_search 失败透传 + Windows 进程树回收 + db_query 主机文件函数黑名单(AIS-054/056/085) (c2e723bf2d)
- 🔧 その他:补门 193 存量违规 —— check-hand-migration-snapshot 的 git diff 派生显式接管 stdio (3eba6c71fd)
- 🐞 修正:F-324 不可采样时不再输出 NaN,usage 序列直接省略 + available 状态位 (836cd95169)
- 🐞 修正:F-306 Workspace agent/run 停伪成功,LLM 端点补 /api 前缀,失败落 failed (78226aa578)
- 🔧 その他:勾选 84E/93E/94E（AIS-084/093/094 已修@781905ece0） (49c0fac00e)
- 🐞 修正:F-290 WS 限流删除 BURST 死分支，30 条/秒为硬上限 (5828640196)
- 🐞 修正:F-449 金额列 real→numeric(12,2),支付换算改十进制精确 (cfb0b7b2da)
- 🐞 修正:抓取族补网络审批门 + 媒体代理流式限流 + Chrome 导入端口属主绑定（AIS-084/093/094） (781905ece0)
- 🐞 修正:F-188 统一 skills:<uid> 为 JSON 数组，识别并救回历史 Hash，install 不再吞掉写入失败 (6a087b84c9)
- 🐞 修正:F-165 调用趋势改用 llm_call_logs.cost_cents，消除恒 500 的空面板 (4609d003c7)
- 🐞 修正:F-30 workspace git/status、git/review-diff、github/status 接入 workspace 权限闸 (6d9f31cdb2)
- 🐞 修正:F-432 Workspace ACP 会话真落库 + begin/end 归属校验 (744822836d)
- 🐞 修正:F-29 pipeline-rollback 的 backupDir 限制在工作区内，拒绝绝对/.. 越界读取 (be36fcbc95)
- 🐞 修正:F-85 Batch 单对象端点校验 _apiKeyId 归属，跨租户读写/取消按 404 (71ec16d9d9)
- 🐞 修正:F-424 用户任务列表改为分页扫描后按归属过滤 (f26fc249de)
- 🐞 修正:导出正文缓存写入前清扫过期项 (F-41) (aa6d931b0b)
- 🔧 その他:勾选 29E/30E/55E（AIS-029/030/055 已修@680ccf0fd7） (9fbc1c5b1c)
- 🐞 修正:F-334 积分兑换改为 referenceId 精确判重 + 唯一索引并发兜底 (7279e93b01)
- 🐞 修正:浏览器会话上限/降级回收 + 自媒体调度关停 + 后台任务终态保留（AIS-029/030/055） (680ccf0fd7)
- 🐞 修正:Redis publish 失败时回落本机直推,不再静默丢通知 (F-113) (6face3f2c2)
- 🐞 修正:F-180 响应缓存键改用 upstreamMessages 并纳入 top_p/penalties/seed/response_format (d458f4dd64)
- 🐞 修正:F-56 OAuth authorize/userinfo 叠加 token 黑名单检查，登出后不能再换新令牌 (4699e0f2bc)
- 🐞 修正:F-228 单条结算同步补 pending 状态闸,堵住残留的先记账路径 (ee5909ebf8)
- 🐞 修正:F-203 收紧为两段判定,禁止零余额先跑后账 (620437d2b2)
- 🐞 修正:文件搜索强制上限 50/硬顶 100 并接受 limit 参数 (F-19) (2a7a74a671)
- 🐞 修正:F-324 连接池指标不可采样时显式报不可用,不再假绿 0 (cc10014367)
- 📚 ドキュメント:p0p1 交接与复核结果 + README 数字块刷新 (591fd05b48)
- 🐞 修正:F-288 CSV 注入过滤覆盖前导控制字符/空白，导出器 TAB 也加引号 (a6efaa3015)
- 🐞 修正:F-252/F-253 自动化 SSE 增加总/空闲超时，断流与流内错误帧按失败结算 (2a68bd67a0)
- 🐞 修正:文件搜索/最近/全局搜索排除回收站记录 (F-18) (5d2cf741c9)
- 🐞 修正:F-346 webhook 投递先持久认领再回 200 (5dedc68989)
- 🔧 その他:勾选 24E/82E/95E（AIS-024/082/095 已修@389dc8a096） (a4b759f91d)
- 🔧 その他:F-203 夹具补溯源水印头(推送门 47p 覆盖) (f208ff1c94)
- 🐞 修正:F-259 超长幂等键不再静默截断（三处读键统一按没带处理）；F-270 Coze token 缓存按 clientId|userUuid|scope 分槽 (87677474fb)
- 🐞 修正:F-238 洞察成本维度改查 cost_cents 并暴露降级维度；F-246 审计链查询区分缺表与失败，失败不再静默成空 (46a214d33b)
- 🐞 修正:AIS-024/082/095 定时发布抢占 CAS、read_file 读侧上限、run_id 归属 (389dc8a096)
- 🐞 修正:P89 租约行收成一条 + 门13d 立维⑤「整行逐字重复」差值棘轮 (e727680394)
- 🐞 修正:F-203 Crew 子 LLM 按真实 usage 扣钱包并写 token_flows (c5d442294e)
- 🔧 その他:修复: ai-service 合并波次 hybrid 收口(AIS-100/050/051/081) (92f67fe33d)
- 🔧 その他:勾选 23E/40E/42E（AIS-023/040/042 已修@134b439d76） (ab8f2c53cd)
- 🐞 修正:F-472 ai-service 直连代理补齐超时；F-473 OAuth 回调补齐超时；F-474 Coze SSE 空闲超时与客户端断连取消 (abb452a946)
- 🐞 修正:F-347 自定义 registry 识别 IPv6 方括号与 302 逐跳复检；F-348 fetchWithTimeout 覆盖正文读取 (f3ffa5377a)
- 🐞 修正:AIS-023/040/042 发布并发门、定时任务管理门、运行态归属 (134b439d76)
- 🐞 修正:F-68 礼物扣款统一到 user_margins 主账本并补 token_flows (fe3feafaaf)
- 🐞 修正:F-420 生成队列去重不再把 completed/failed 旧作业当命中；F-421 TaskExecutor 支持取消/超时/wait 上限与任务表上限 (16ab6c051f)
- 🐞 修正:F-428 batch 保存失败也断开 Redis 连接；F-423 配对过期请求与超量会话回收 (8ed9eb7cfb)
- 🐞 修正:AIS-102 self-healing 端点补管理员门 (a115b9775f)
- 🐞 修正:F-418 anydoc 加载失败不再被进程级永久缓存，失败后下次请求重试（文档解析与 Markdown 转换两处） (efd68fc2d5)
- 🐞 修正:F-340 上一面登记表解析失败透传为未判定；F-411 定时任务 errors 非空记 failed (33b686a754)
- 🐞 修正:AIS-102 self-healing 端点补管理员门 (d68423ddd6)
- 🐞 修正:F-147/F-689 支付重放加状态守卫与订单号唯一约束,endTime 锚定支付时刻 (ff276504d8)
- 🐞 修正:F-228 结算补账期唯一键与主库条件插入,客户端传价显式 400 (ede422e8e5)
- 🐞 修正:F-616/617/670 relay 渠道腿上游头超时、4xx 不计熔断、客户端断开不记失败账(并顺带 cancel 非 2xx body) (80e36e330f)
- 🐞 修正:同面封装不再误报 no-content,补 19 道门方向锁 (abe25479d0)
- 🔧 その他:勾选 101E/104E/105E（AIS-101/104/105 已修@77230b153b） (88d1787c42)
- 🐞 修正:AIS-101/104/105 录制属主、全局记忆 reset 权限与重载、沉淀计数有界 (77230b153b)
- 🐞 修正:F-377/F-378 登录风控上下文补齐 ip 信誉与异地判断，注册风控数据源不可用时 fail-closed 503 (41b82ed961)
- 🐞 修正:F-605 风控体检测点不再先于 authenticate 执行，改挂路由级 preHandler 末尾 (df1037b42b)
- 🐞 修正:P0 Apple id_token 按 JWKS 验签,堵自签 JWT 冒充任意 Apple 账号 (88c599252f)
- 🐞 修正:审计密钥登记解析失败改未判定,不再默认放行 (F-340/340G) (ddeb90c49c)
- 🐞 修正:团队收件箱绑定 actor,禁冒名/跨人已读 (F-350/350G) (45478c80a7)
- 🐞 修正:移出团队成员同事务回收知识空间授权 (F-384/384G) (ec3e0ec3f1)
- 🐞 修正:spec 读写/提交按工作区权限做用户级 ACL,非属主 404 (F-390/390G) (09194288ee)
- 🐞 修正:小程序消息房间端点按 roomId 对端过滤 (F-211) (a6e89dab58)
- 🐞 修正:Agent 任务按发起人归属并诚实落 failed (F-39/F-306) (6cd8bc5e1a)
- 🔧 その他:对齐协议方法清单与空响应体期望(仅测试侧) (92149f6ee8)
- 🐞 修正:tools.result/approval.respond 回传失败不再静默吞掉(PKG-01) (b457a2e5db)
- 🐞 修正:XUI-074 审批卡片与标注输入行补 maxHeight/ScrollView/KAV (eb74643e55)
- 🐞 修正:F-269 注销 PII 擦除事务化并补齐五类残留表 (16d4484e2c)
- 🐞 修正:F-206 浏览量 onResponse 单点计数 + F-284 err 日志打码 (9352cdf254)
- 🐞 修正:分类器补认 git grep 的正文面并清 T19(no-content 是口径盲区不是脚本缺口);T6 文档面改 AGENTS∪README 同 R4 口径 (3935c3140c)
- 🐞 修正:postMessage 来源闸 + runtime 切会话残留重置(S-08/S-09) (54f6465567)
- 🔧 その他:勾销 582G/583G/688G 并落档 F-583/F-584/F-689 修复结论 (c1190f8059)
- 🐞 修正:开发者订阅按 orderId 唯一幂等，回调重放不再重复插订阅(F-689) (ec2f95556f)
- 🐞 修正:F-03 replaceMessages 增加会话属主校验,堵跨用户清空/覆写 (3d259432f4)
- 🐞 修正:结账页档位改由服务端解析,plan id 不再当 vipLevelId(P1) (2aaefa1ea5)
- 📚 ドキュメント:缺陷① 提交期登记门接线落地并关闭票 (30372adf74)
- 🐞 修正:302 提为 blocking 且只拦承载面,新接 302r 登记同步只报数 (b13a7fd3dc)
- 🐞 修正:提交面按索引取材并只让承载削减面阻断 (8d9a257219)
- 🐞 修正:催费微信按渠道开关，留痕先 pending 后按送达落 sent/failed(F-583/F-584) (0bcf77a3a7)
- 🐞 修正:F-191 系统 token AI 端点按 usage 归账到调用者 (cbb20b06f8)
- 🔧 その他:勾选 103E/108E/109E（AIS-108/109/103 已修@df01268091） (fb56f29d3f)
- 🐞 修正:F-260/F-261/F-671 表格与 diff 资源预算、上游断连取消 (7bd0bbd134)
- 🐞 修正:F-139/F-140/F-236 知识库入库事务化与终端会话回收 (1f051a19df)
- 🐞 修正:AIS-108/109/103 会话与主体归属、probe 逐跳 SSRF 收口 (df01268091)
- 🐞 修正:F-190 微调任务按调用者隔离,F-216 owner 谓词改同位绑定 (a7023b7835)
- 🐞 修正:圈子帖 visibility 落库过滤 + 评论 UGC 过滤/原子计数/回复归属 (F-332/F-335) (93d1747085)
- 📚 ドキュメント:locale 残留共用的扫描器按 lint-staged 语义自述取材面 (fd4adb0891)
- 🐞 修正:F-54/F-155/F-134 跨租户读写面收紧为管理员,普通用户 403 且下游零触达 (b0c86ac64a)
- 🐞 修正:第三批——旧扫描根/死维度(17/91/105) (226b420ce7)
- 🐞 修正:剧本改/删/批量删按 createdBy 属主或管理员收口 (F-159/159G) (32a4fdd648)
- 🐞 修正:工单评级仅属主可读 (F-160/160G) (ab33ed4bd3)
- 🐞 修正:chat/stream 与 chat/resume 身份只认认证主体,堵 metadata.userId 跨用户读知识库/错置预算 (F-02) (271f7ccbba)
- 🐞 修正:第二批——取材面与级别对齐(11b/20/27/34/38/2g-web) (4e058c545f)
- 🐞 修正:完成率 count 转 int、账本 user_id 放宽可空并补迁移（F-699/F-433） (2c34c4fd6f)
- 📚 ドキュメント:四条证据缺口标未判定(不计入已修) + CLI/AIS 标否条目复核结论回填 (252fa5ea15)
- 🔧 その他:勾选 98E/99E/110E（AIS-098/099/110 已修@d6bffcd978） (cc7ca8b008)
- 🐞 修正:AIS-098/099/110 外链图片下载与 edu 退款 id 收口 (d6bffcd978)
- 🐞 修正:agent-control/execute 投递目标只认 JWT 主体,堵 body.userId 跨用户派发 (F-07 同族) (071278fc58)
- 🐞 修正:退费校验归属与额度并锁流水，全额退满推离 paid，汇总冲减退费(F-315/F-322) (b9cac6fdf2)
- 🐞 修正:AIS-046 审计成功码统一为 0 + AIS-047 审计中间件落主体 user_id (21bd5a2df1)
- 🐞 修正:三个 by-ids 批量端点只返回 status=1 (F-331/331G) (55094ac14a)
- 🐞 修正:隐藏圈子详情/帖子/发帖可见性闸 + 成员校验 (F-330/330G) (0aced0d0e0)
- 🐞 修正:官方知识库写面收口管理员,读面按发布态过滤 (F-329/329G) (649aeaf899)
- 🐞 修正:U-7 提现金额剥离千分位并如实提示失败 (1a24120be2)
- 🐞 修正:IME 提交守卫 + token 作用域与 storage 访问级收窄 (bacfc1dd4d)
- 🐞 修正:缴费落库与账目重算收进同一事务，重算先 FOR UPDATE 锁行再读(F-316/F-582) (a4ff3e50f1)
- 🐞 修正:AIS-019 语义召回把属主下推到检索层,勿让他人条目占满全局 top_k (e12f8a9550)
- 🐞 修正:XUI-055 选图垫片尊重多选声明 (81b3fc2771)
- 🐞 修正:圈子分类关系全局配置写面收口管理员 (F-158/158G) (78beb8b7bc)
- 🐞 修正:审批应答按认证主体复核，堵住"他人代答批准高危工具" (78e0957509)
- 🐞 修正:170 fail-closed + 260 依赖触发面/暂存面真判 (32bc4c4451)
- 🐞 修正:消息来源闸 — bridge/ext-ui/content 的 sender 校验与零副作用夹具 (7eb29354c4)
- 🐞 修正:XUI-061 时间格式按调用时创建不再冻结时区 (0831c5f8a0)
- 🔧 その他:勾销 691G/692G 并落档 F-692/F-693 修复结论 (63d288d2b3)
- 🐞 修正:XUI-051 补 MediaTypeOptions 别名 (bcbd00572c)
- 🐞 修正:浏览时长收敛为单条原子 upsert + 考试状态机统一 submitted→graded(F-692/F-693) (becc864f28)
- 🐞 修正:XUI-056 导航垫片兼容对象形 navigate (c6fc25f996)
- 🐞 修正:禁用/删除同步吊销 refresh token,member-users 写响应白名单投影 (F-127/F-131) (7b36965af8)
- 🐞 修正:XUI-052/053 rn-compat 补齐相册与去设置垫片 (6db56b4765)
- 🔧 その他:勾选 100E/117E/118E（AIS-100/117/118 已修@9479704a7f） (61417e2efe)
- 🐞 修正:F-03e /chat/steer/reorder 归属校验 —— 越权重排他人 steer 队列一律 404 且零副作用 (852d803a24)
- 🐞 修正:AIS-100/117/118 身份与落盘失败语义收口 (9479704a7f)
- 🐞 修正:XUI-065 智汇值格式收敛到共享函数 (a3021e99e5)
- 🐞 修正:开发者链接写归属强制取令牌主体 (F-138/138G) (f3cfedb521)
- 🐞 修正:Coze 全局变量面收口系统管理员 (F-137/137G) (e0975b7170)
- 🐞 修正:XUI-066 组3b 通知设置不再吞掉加载失败 (67f95aa05b)
- 🔧 その他:更正 F-04/F-06 证据为 fix/api-p0-1108 并记录移交 (a0b99e8317)
- 📚 ドキュメント:174 道 pending 门只读体检清单与 222 枚 lost-commit 命名缺陷 GC 判据 (a4c176283e)
- 🐞 修正:F-03b/c/d 流控制端点归属校验 —— abort/steer/steer-withdraw 越权一律 404 且零副作用 (0ff34b851f)
- 🐞 修正:XUI-066 组3a 消息中心/推广排行/隐私设置不再吞掉加载失败 (d8e7efae39)
- 🐞 修正:原子回滚 checkpointId/快照路径越界校验（F-27） (0b36ae1723)
- 🐞 修正:n8n webhookPath 同源校验与 SSRF 危险地址族补齐（F-117/F-215） (9b5cf6dc89)
- 🐞 修正:后台 Agent 与执行回执按登录属主收敛,堵跨用户 list/get/cancel 与 result 伪结算 (F-07/F-08) (ff80abe77a)
- 🔧 その他:移交：F-04/F-06 由 fix/api-p0-1108 修复，此处回退避免双实现 (138bd5120a)
- 🐞 修正:XUI-066 组2b 资讯/VIP/直播订阅不再吞掉加载失败 (27140b31c8)
- 🔧 その他:勾选 106E/107E/116E（AIS-106/107/116 已修@b19be35552） (78c4e35052)
- 🐞 修正:智能体人设归属闸 + 规则参数写面收口 admin (F-133/F-363) (702337d515)
- 🐞 修正:XUI-066 组2 发布与讲师详情不再吞掉失败 (6c49f40763)
- 🐞 修正:单条审核仅允许 status=0 放行,uuid 形状闸+审计 (F-129/129G) (e0ddc1ef11)
- 🐞 修正:AIS-106/107/116 补 file_search/investigate/image_edit 调用前闸 (b19be35552)
- 🐞 修正:查询数组双向可还原 + 顶层数组形状收口 (a5082d93c6)
- 🚀 機能/改善:新增提交期屏/路由登记同步只读门(未接 .husky) + 临时仓库三态夹具 (1c1bce0b2b)
- 🐞 修正:问答/分销统计/创作列表按登录身份收敛,堵 query.userId 与 body.userId 越权读 (F-04/F-05/F-06) (e18899419a)
- 🐞 修正:XUI-066 组1 五个壳把加载失败如实上抛 (5fd91c5f27)
- 📚 ドキュメント:教育域「否」条目逐条复核落档——F-690/691/694 坐实已修，F-692/693 坐实待修，F-449/689 转资金线 (0744c48551)
- 🐞 修正:支付凭据只收标量 + Enter 提交防回潮守卫 (8b3e7c0b5f)
- 🐞 修正:公开试卷列表/详情/取题/开考补 status=1 判据，禁用试卷不可达(F-690) (3163dccb52)
- 🐞 修正:XUI-073 + 同型B死路由 充值失败不跳空单号、/pagesA 迁在册页 (b342856a45)
- 🐞 修正:根治门禁基础设施三缺陷 (f2314ea16d)
- 🐞 修正:三条存量红真修——钩子/安全提交只读探针迁 gitRaw,夹具增长按新证据记账 (bc814f64be)
- 🐞 修正:私密名片详情仅属主可见,浏览量原子自增 (F-156/156G) (f6d3ff19fd)
- 🐞 修正:分类创建/付费开关/缓存运维收口到管理员 (F-359/361/362) (3beb864b81)
- 🐞 修正:审计日志按 key 递归脱敏凭据字段 (F-128/128G) (b944de83f8)
- 🐞 修正:倒计时改截止戳派生(use-countdown/use-register-form) (b02dbe204e)
- 🐞 修正:XUI-069/070 请求竞态丢旧响应、下单与选图入口上锁 (981c44915b)
- 🔧 その他:补 F-069/F-047/F-062/F-087/F-003/F-097 夹具(4 条行为级 + 4 条结构锁,均实测旧码红) (7ce2de83ee)
- 🐞 修正:XUI-050/072 + 假思考进度 权限如实上报、签到 toast 互斥、去掉伪造百分比 (95e1a0892e)
- 🐞 修正:学生自助签退只接受服务端当日，历史补签由教师代签承担(F-210) (74a49610b2)
- 🐞 修正:远端位置只问服务器(收编腿改 resolveRemoteHead),棘轮 3 条存量红收口 (1e4810338e)
- 🐞 修正:成绩指标按记录终态只计一次，人工阅卷/复核走增量平移(F-694) (d40957f377)
- ♻️ リファクタ:门脚本裸 git 迁入 gitRaw/catBatch,删除自拼 batch 与 spawnSync (327598e096)
- 🐞 修正:公开专题详情过滤未发布课时，管理员预览显式 includeUnpublished 放行(F-691) (2de550fd3c)
- ♻️ リファクタ:lib 层派生 git 迁入取材层(含 push-receipt 远端/批查改走 ls-remote+catBatchOids) (1c0403149f)
- 🐞 修正:content-extended 内容管理端点逐路由 requireAdmin，AIGC 自助面恢复登录可用(d050d90d10 起管理端为 admin-only，夹具补管理员身份) (9d72a23d13)
- 🔧 その他:勾选消息/聊天域身份采信三条(F-03/F-04/F-06)并追加 sidecar 证据 (a837c5f963)
- 🐞 修正:消息/聊天域身份采信点 F-03/F-04/F-06 —— 会话归属与主体一律以服务端认证态为准 (3183046cf8)
- 🐞 修正:审计链查询失败不再吞成空结果 (F-246/246G) (a1ed380dbb)
- 🐞 修正:结算缓存/收入概览运维面收口到管理员 (F-365/365G) (0d396d392a)
- 🐞 修正:全站打赏流水仅管理员可读 (F-199/199G) (ba48392ca8)
- 🔧 その他:收口钩子格式化与溯源水印残留(纯格式,无逻辑变更) (6515de9ec6)
- 🔧 その他:F-002 旧断言 toBeUndefined 本身就是错的 —— 补齐理由并实测旧源码红 (a799cf700a)
- 🐞 修正:W-03/W-06 收口 + 同型根因自查 S-01/02/03 (682034b1fd)
- 🐞 修正:终端会话自然退出即回收,注销擦除补齐五张 PII 表 (F-236/F-269) (f34d9ad906)
- 🔧 その他:F-103 补旧码必红夹具(runtime 跨 chunk 残帧 + 行内坏字节不吃下一帧) (93130904d2)
- 🐞 修正:AIS-081 元字符机制改为按 shell 形态判 + AIS-050 声纹克隆归属/计费闸 (4af2f5490f)
- 🐞 修正:XUI-017/018/046 关于入口逐条路由、社区入口迁 pkg-ai、直播结束与人数 (b776154139)
- 🐞 修正:删角色同事务清理用户-角色/部门/菜单绑定 (F-403/403G) (1661b376a3)
- 🐞 修正:封堵打赏流水匿名读,并给 Kling 轮询加归属校验与幂等扣费 (F-199/F-119) (a16b82c1bd)
- 🐞 修正:DG-06 预算单一来源(defaultTimeoutMs),30a 按 2026-11-08 复测收敛(600s),超时不洗绿 (5583f50cfc)
- 🐞 修正:XUI-023/024/031/045 运行时代次、分页依赖环、溢出作用域、分享图片 URI (beb86a377f)
- 🔧 その他:收口 post-commit 钩子格式化残留(无逻辑变更);payment.test.ts 固化「processing 当成功」的旧断言此前已纠正 (80d9341826)
- ⚡ パフォーマンス:门 30a 缓存跨 worktree 共享 + reflog 面提速,存量悬空债清理 (5657fea9e3)
- 🐞 修正:judgedGapWeb 拆登记面与承载拆解面，诚实登记不再判红 (c3d819dd6a)
- 🐞 修正:平台 Key 图像/音频/视频编排补计费闸与资源回收 (F-103/F-104/F-105) (879a8df5a6)
- 🐞 修正:XUI-026/027/030/033 通知 type 兜底、408 归瞬时、小时除数、续读保留对侧游标 (f2df1e6ca3)
- 🔧 その他:勾选第三批 5 条 P1(F-02/F-285/F-381/F-549/F-568)并追加 sidecar 证据 (847e1740a9)
- 🐞 修正:修复考试倒计时/IME误提交/充值钓鱼三组缺陷 (W-01/02/04/05/07) (434a93e097)
- 🐞 修正:Persona 写端点整组收为管理员,内置人格不可改 (F-364/364G) (de18e75902)
- 🐞 修正:分类更新收口到管理员并加字段白名单 (F-360/360G) (3571c9757f)
- 🐞 修正:DG-11 gate-scope 头注以实现为准,改注释不改行为 (4075db4e2b)
- 🐞 修正:DG-10 format 显式基线不可解析改为未判定,全零 sha 回落显式告警 (d33fb0412d)
- 🐞 修正:DG-09 HUSKY_SKIP_TYPECHECK 只跳过 T1,其余 12 道 push 门照跑 (25d5944603)
- 🐞 修正:DG-08 拆 built/healthy 两态标记,被杀轮次下一轮必重跑门禁 (a989580bb3)
- 🐞 修正:DG-07 守护锁增记 pidStartTime,pid 复用不再永久死锁 (3a1951dba9)
- 🐞 修正:消息/上传域第三批 P1(F-02/F-285/F-381/F-549/F-568) 以服务端身份为准并收口资源与清理边界 (2fc4299c8a)
- 🐞 修正:XUI-015/037/044/048 注销路由、相册 loading、webview timer、录音卸载清理 (b5f1627643)
- 🐞 修正:已撤销证书禁止下载 PDF，与验证接口同口径 404(F-570) (6355eb628f)
- 🐞 修正:公告详情校验发布时间/过期，CLI 列表与版本查询下推到 SQL(F-488/F-489) (8d02465cc1)
- 🐞 修正:legacy-learn 统计接口按登录身份定归属，专题/课时过滤发布状态(F-515/F-517) (f0fe4740ed)
- 🐞 修正:XUI-020/034/036/042 改密失败复位、脱敏容错、手机号/金额边界、订单列表归一 (3bf0fc4dcb)
- 🚀 機能/改善:直跑面 ratchet + --only 单门入口(A+C 裁决落地) (ba514fec82)
- 🐞 修正:n8n webhookPath 锁同源防密钥外泄、SRS 服务器密钥仅管理员可读、推流列表/详情按属主收敛(F-117/F-195/F-196) (dee4e559cc)
- 🐞 修正:MCP servers 全局表收口到管理员,封死跨用户读/删/注入 (F-101/101G) (1d0f00caf4)
- 🐞 修正:注销 PII 擦除补齐 5 表并改 fail-closed 事务 (F-269/269G) (28d9e65b65)
- 🐞 修正:XUI-022/025/032 通知订阅引用稳定、loadMore 失败解锁、分页同 tick 去重 (b400751172)
- 📚 ドキュメント:记录跨根 tsbuildinfo 实测/共享 buildinfo 重写说明与 stale-dist 夹具漂移归因 (3d3b5580fc)
- 📚 ドキュメント:登记 ai-service 沙箱实现缺失与 30a 缓存分片/备份命名空间事实 (a8e5f11ca7)
- 🔧 その他:陈旧 dist 夹具补齐 js+d.ts 成对产物,新增产物缺失仍判红对照 (e5ab1c0f42)
- 🐞 修正:self-media 记录列表按作者收口,跨用户 payload 不再泄露 (F-170/170G) (23751e8e7a)
- 🐞 修正:平台 Key 媒体代理补余额闸与结算、OpenRouter 代理计费/超时/错误体收敛、多厂商编排去重限流(F-87/F-93/F-192) (19d6df7c02)
- 🐞 修正:XUI-038/039/043 会员支付走真实链路、成功页只认服务端 paid、换绑提交旧号验证码 (dd880eef4b)
- 🐞 修正:dist 内容缓存键纳入构建根/outDir/tsbuildinfo,禁止跨根复用 (62836eb12d)
- 🐞 修正:重建前隔离跨根 tsbuildinfo,产物缺失点名到具体路径 (0bfbc66476)
- 🔧 その他:登记 DB-34/38/39 两条迁移到 journal（idx 375/376） (f3d60f9569)
- 🐞 修正:大表索引部署前 CONCURRENTLY、租户池预算、副本选举、批量价格/配额与旧表白名单（DB-11/41/42/43/44/45/46） (1537567c09)
- 📚 ドキュメント:收口门 173 文档数字结构性修复,写入运维一句话 (0e52466c44)
- 🐞 修正:统一连接池护栏、池可关闭、max 可配、校验脚本去明文口令（DB-29/30/31/32/33/36） (459b820415)
- 🐞 修正:全新库守卫接线、迁移 workflow 复位、读写分离健康与读己之写（DB-08/10/26/27/28） (4b83d3e3ca)
- 🔧 その他:补勾 52E(AIS-052,与 AIS-031 同源分派闸同笔修复) (24b0b27c3a)
- 🐞 修正:批量取账本/小节、订单按时间序、统计总览缓存（DB-20/21/22/23/24/25） (1b014454f3)
- 🐞 修正:XUI-028/029/035/047 权限 fail-closed、水合失败不落盘、重试上限、提现入口锁 (c126e0892a)
- 📚 ドキュメント:登记 T1 tsbuildinfo 假红(每并行分支复发,根治归专项) (cabec4abb5)
- 🐞 修正:heat-stats 按小时水位增量同步,消除 usage_count 重复累加 (F-262/262G) (df6f7947f5)
- 🐞 修正:watch-aspect 计数钩子移到鉴权之后,杜绝匿名/越权计数 (F-206/206G) (12d8fed34e)
- 🐞 修正:SRS 服务器列表收口到管理员,apiSecret 不再外泄 (F-195/195G) (2c900395ab)
- 🔧 その他:导出 resolveLedgerPath 供 F-075 ⑦b 夹具断言(EACCES⇒null) (f134e3e82f)
- 🐞 修正:logger 对 err(含 Error) 递归凭据打码 (F-284/284G) (f96d96298d)
- 🐞 修正:后台长跑命令分派按角色收口(AIS-031) (acc6d80cbf)
- 📚 ドキュメント:校正数字块注释,如实描述 push 档全判 (9aa8248aa7)
- 🐞 修正:备份加密、管理员口令重放守卫、RLS 旁路收窄（DB-34/38/39） (ce81516076)
- 🐞 修正:refresh 重放拒绝 stale-sibling、OAuth 码原子消费、usercenter 脱敏 2FA 凭据(F-268/F-244/F-245) (045402b2ff)
- 🐞 修正:增量索引写/删失败不再推进快照(AIS-027) (61369af5cc)
- 🐞 修正:computer-use 宿主机键鼠/截屏整族收紧到管理员 (F-400/400G) (1d8f9b5ab9)
- 📚 ドキュメント:清掉中英头条残留的派生数字字面量 (51f66de013)
- 🐞 修正:team memory 越权写、隐私预热误判、DAG 跳过与配额重试、符号检索归属（SDB-31/34/37/38/39） (0323111b74)
- 🐞 修正:封堵内置管理员改密/第三方绑定接管与私信通知越权读(F-125/F-126/F-154) (9eb017a220)
- 🐞 修正:课程评价补报名闸与服务端 signId，判重插入原子化(F-503) (2503dce969)
- 🐞 修正:SRS 流列表/详情/状态按属主收口,保留属主与管理员路径 (F-196/196G) (b03181c969)
- 🐞 修正:修掉 mcp 与安全组 9 条存量红 (764221fff7)
- 📚 ドキュメント:抽走 README 正文派生数字,数字块收口为唯一写入口 (91ca025370)
- 🐞 修正:教育公告按 sort/发布时间稳定排序，并按 publishTime 控制对外可见(F-637) (239830bbdb)
- 🐞 修正:withTenant 的 SET LOCAL 必须在事务内并对租户标识 fail-closed（DB-40） (5b705b64ec)
- 📚 ドキュメント:测试文件数 4378→4379 与现算值对账 (a772cb88ff)
- 🐞 修正:派发器如实传入 env,判面冲突当场 exit 2 (edd6a71fd6)
- 🚀 機能/改善:门体同代自检 + 判面显式声明 + 重试变绿判未判定 (9a3f2a4561)
- 🐞 修正:学生自助签到只允许当日，拒绝客户端任意 date(F-210) (1e0d9d1a9d)
- 🐞 修正:relay 凭据刷新不再丢字段/丢更新，并修 alipay 时区、cli-import 后缀、告警任务状态（SDB-32/33/42/43） (f6bee8ba44)
- 🐞 修正:对齐 schema 与迁移链的漂移并修 NOT NULL/唯一约束（DB-16/17/18/19/37） (27cff4fa99)
- 📚 ドキュメント:余下正文 4383→4385 全部对齐 (74bcbef7d4)
- 🐞 修正:TTS 链路改走服务间凭证并显式告警降级(AIS-092 连带) (1d4207f4af)
- 🐞 修正:批次/考试/证书/自媒体读接口按属主收敛(F-85/F-168/F-169/F-170) (d47f12ba47)
- 🐞 修正:OAuth web token 授权码改为原子消费 (F-244/244G) (14f113ad09)
- 🐞 修正:迁移账本一致性与手工修复通道收口（DB-07/09/12/13/14/15） (8a7c642ed4)
- 📚 ドキュメント:正文测试文件数对齐现算 4385 (ae9b9c7f11)
- 🐞 修正:课程/视频 8 个管理写端点升级为管理员闸(F-166 P0) (dbd9b80acd)
- 🐞 修正:客服/ws-ai 会话与出站身份归属校验(F-109/F-112) (ce6b59caf3)
- 🐞 修正:OAuth authorize/userinfo 先校验 token 黑名单 (F-56/56G) (025974f194)
- 🐞 修正:手工迁移执行器改用共享 SQL 分割器与事务化执行（DB-04/05/06） (476da42973)
- 🐞 修正:收紧 OAuth/MCP/LLM 转发面的管理员与身份归属校验(F-55/F-56/F-101/F-102) (e7ba41ad70)
- 🐞 修正:XUI-016/019/021 退款金额归一、注销闸门复位、分销字段映射 (7708c2c548)
- 🔧 その他:去掉 test_api_v1 夹具重复导入(ruff F811) (26a8a6afc6)
- 🔧 その他:登账(数字对账): README 正文 testFiles 4367→4373(本轮新增 6 个测试文件) (2d22798621)
- 🐞 修正:学习计划完成率按整数汇总，修正 int8 字符串拼接导致的 442%(F-699) (b1d34a9341)
- 🐞 修正:资金链路 P1 第二批 B 组(F-135/136/167/228) (edf15947cd)
- 🔧 その他:登账(缺陷普查批次): mcp_server 工具族+语音/媒体/发布 9 条 P1 收口(AIS-021/050/051/073/080/081/092/096/097) (f3e69fad00)
- 🐞 修正:审计证据导出改 ASC 键集游标并生成链锚 (F-646/645G) (841c74661d)
- 🐞 修正:访问明细响应白名单投影，封死跨用户 PII 泄漏 (F-592/591G) (1937e6d8f1)
- 🐞 修正:schedule 写端点补管理员闸 (F-636/635G) (99aa6d9e21)
- 🐞 修正:P1 连接关闭/续跑并发/索引提交语义(AIS-021/022/027) (e49b792b1f)
- 🔧 その他:修(AIS-021/073/096/097): 发布域连接泄漏与账号越权 + 媒体 sidecar/在途强失败 (56dbb657ab)
- 🐞 修正:P1 流式终态/原生计量/取消收敛/压缩引用/媒体清扫(AIS-001/002/005/009/058/065/096/097/111/112) (cdc5a9547c)
- 🐞 修正:Batch 单对象端点补 API Key 归属校验 (F-85/85G) (492b3b3287)
- 🔧 その他:修(AIS-050/051/080/081/092): mcp_server 工具族路径/SSRF/命令注入收口 + 付费 TTS 鉴权 (1417646ce1)
- 🐞 修正:XUI-003 会员页对 /vip/my 空记录落空态并消除 TS2345 (03eaf32af9)
- 📚 ドキュメント:修正 code 标签内测试文件数 4367→4372 (0a8fe453f4)
- 🐞 修正:OAuth 密钥管理端点改为管理员闸 (F-55/55G) (7a320a0e06)
- 📚 ドキュメント:测试文件计数 4367 → 4372（合入 db-p1 新增的 5 个测试文件） (1513c11c13)
- 📚 ドキュメント:同步新增 5 个夹具后的测试文件数 4367→4372 (826dc1c3a9)
- 🐞 修正:scoped-guard 归属判据绑定主体参数并拒绝 or 绕过 (F-216/216G) (9a88a3c6e0)
- 🐞 修正:修正 gate-failure-kind C7/F5 判据锚点(存量红真修,不删断言) (6040fed71a)
- 🔧 その他:登账(msg-p1): 消息/推送/社交/文件上传 13 条 P1 已修并勾选 (1fe3efb480)
- 🐞 修正:用户中心显式投影剔除 2FA/密码类敏感列 (F-245/245G) (ec12ec1c62)
- 🔧 その他:USDT 到账夹具的有效期改为相对当前时刻，消除固定 T0 过期时间炸弹 (5cd4b33ebd)
- 🐞 修正:资金链路 P1 第二批 A 组(F-229/230/220/62/63) (bba5be1be0)
- 🐞 修正:消息/聊天 6 条 P1 根因修复（F-54/109/112/154/170/192） (12be6889fa)
- 📚 ドキュメント:P0 落成后对齐测试文件计数 4378 (d728c5a24f)
- 🐞 修正:考勤墙钟固定 Asia/Shanghai，修复 UTC 主机迟到误判(F-263) (688ba35066)
- 🐞 修正:阻断第三方账号绑定/改绑内置管理员接管路径 (F-126/126G) (7f0441c2dc)
- 📚 ドキュメント:正文 testFiles 4367→4368(W-01 新增 1 个测试文件) (eefd9ee63d)
- 🐞 修正:上传/推送/社交评论 7 条 P1 根因修复（F-28/69/680/155/332/479/698） (f4651bf29d)
- 🐞 修正:考试记录归属校验与判分去重，证书详情补属主闸(F-168/F-169/F-172) (f7450e25a3)
- 🐞 修正:禁止管理员重置系统内置管理员密码 (F-125/125G) (f2e2e8bd2b)
- 🐞 修正:XUI-014 提现余额按分转元展示、提交金额按元转分 (cfa074991d)
- 🐞 修正:付费课程以已支付订单为准，封死零支付解锁(F-153) (10d0de57c8)
- 🐞 修正:倒计时改按截止时间戳重算(后台节流/锁屏不再无声延长考试) (7974a14834)
- 🐞 修正:XUI-009/010/013 充值签名与 orderType、Easing.sin、Clipboard 默认导出 (eb3bff76f7)
- 📚 ドキュメント:正文两处工程守门数同步为 352(生成块已同步,正文补漏) (88053d3c24)
- 🐞 修正:子代理回放终态纳入 stub，复用 backgroundTask 状态词 (1d27adcba4)
- 🐞 修正:时间线计数补 stub 键；空状态模板开关回落到 onTemplateSelect 契约 (0a1db8503c)
- 📚 ドキュメント:同步守门门数 351→352(新增全量腿 IGf) (7972a763e4)
- 🐞 修正:重派生 rn-shell 声明，补上 VipTraderScreen 契约 (f5c6cb0783)
- 🐞 修正:evil merge 按逐父交集判 + 判据库执行器入根护栏 + 全量腿注册 IGf (8182bd1234)
- 🐞 修正:清掉误回盘的死 list-view 并收敛重复 configure；重跑 ui-routes 派生钉 (5ee8200673)
- 🐞 修正:XUI-007/008 支付订单详情拆包络且 DEV mock 不再直通成功 (c024572376)
- 🐞 修正:XUI-005/006 登录态改用 getUserInfo 并让清缓存保留登出标记 (bf3d1e2bda)
- 🐞 修正:共享第三方平台类型补齐 linuxdo（与 web 端既有能力对齐） (fdb05b274f)
- 🔧 その他:会话导入用例按 noUncheckedIndexedAccess 收窄空值 (5876707f98)
- 🔧 その他:补 F-075/103 夹具(unjudged 出口 fail-closed、NDJSON 中文跨 chunk) (37bc6d6f19)
- 🐞 修正:接上超级智能体泵启停导入 + 修正快照持久/恢复类型窄化 (039bc57a68)
- 🐞 修正:required 聚合器 needs 补齐两个 preflight 并逐项断言结果 (90fed2988c)
- 🐞 修正:P1 代码工具/命令策略/取消/付费TTS/索引主体收口(AIS-080/081/086/092/100/106/107/116) (8adaf979c3)
- 🔧 その他:补 F-002/006/007/008 双断言夹具(旧红/新绿:exitCode、键名脱敏、argv 脱敏) (6c33f037af)
- 🐞 修正:XUI-004 未登录分支补齐 Privacy/Agreement/ChangePhone/ChangePwd 四路由 (0ba309d2f7)
- 🐞 修正:P1 资金组一批 F-09/10/16/17/32/33 堵资金双出与回调丢单 (8ee5b47dcf)
- 🐞 修正:跳门证据绑定失败门集合(T1 之外一律 deny) (acc0f53f69)
- 🔧 その他:补 F-073/074/095/069 双断言夹具(旧绕过路径被拒 + 正常路径照放行) (400c6dfc7d)
- 📚 ドキュメント:登记 T1 在纯净 origin/main(00fa9e977f) 即红的基线存量 18 条 (bbcd663951)
- 🐞 修正:补齐进程树回收、POSIX 沙箱超时杀组、出口 fail-closed、LSP 回收、记忆原子写去重、钩子中央派发与子代理基线 (F-003/004/075/087/088/097/098/103; F-080 已在上一笔) (e7c9754681)
- 🐞 修正:XUI-003 会员 /vip/my 拆 {vip} 包络并归一 user_vips 行 (1576fe79aa)
- 🐞 修正:修复异常退出码、审计/argv 脱敏、状态文件权限、WS 过载、签到回跳与深链/托盘授权 (F-002/005/006/007/008/046/047/062/100; 含 F-080 原子落盘) (b107b1cd3e)
- 🐞 修正:窗口 -1(不限)不再被 Math.max 归一为 0，订阅配额正确落 -1(SDB-04) (3ce91de9d1)
- 🐞 修正:修复插件名/落点逃逸、沙箱白名单与 ACL 越界、回收站与隔离区恢复越界 (F-069/070/073/074/101/102/095/053/099) (c6e262ba6e)
- 🐞 修正:F-205 关注幂等语义修正,堵住重复刷积分 (99a7e1e7f2)
- 🐞 修正:push 门缓存指纹纳入全仓脏状态(含 scripts/ 与根配置),超限 fail-closed (1adb9a7bbc)
- 🐞 修正:P1 越权面收口(会话/检索/图谱/Hook/预算/媒体/发布/recap) (2ec168289f)
- 🐞 修正:XUI-002 订单详情拆 {order} 包络并修正 RN 字段映射 (5d668e9d2a)
- 🐞 修正:Crew 计费改为按单次 runId 幂等并结算失败/取消分支的实耗(SDB-30) (3eb4787c1d)
- 🔧 その他:登账(缺陷普查批次23/23): services/DB 56 条(含 5 条按复核修正晚级)；索引同步 (00fa9e977f)
- 📚 ドキュメント:对齐 XUI-001 新增测试文件后的文档计数 (edd666cd1b)
- 🐞 修正:鉴权 join users.status 并补注销吊销 developer_api_keys/分享 token(SDB-29) (2e172868ad)
- 🐞 修正:worktree 面跳过依赖/产物目录,非普通文件不判取不到 (e272f4246e)
- 🔧 その他:登账(缺陷普查批次22/23): API 收尾 F-721~F-728 共 8 条 (f314bb7067)
- 🔧 その他:登账(缺陷普查批次21/23): API F-661~F-720 共 60 条 (679c7fd871)
- 🐞 修正:修 miniapp 历史重试假重载并在 staged 面正取候选清单 (fa06091fec)
- 🐞 修正:F-166 课程/视频管理写端点升级为 requireAdmin (5f0adc5e76)
- 🐞 修正:USDT 到账改为唯一金额尾差+精确匹配+未占用 txHash,并翻页覆盖下单至今(SDB-27/28) (23edfeecbf)
- 📚 ドキュメント:记重放前置依赖表(291 只报数不拦提交/typecheck 判据/生成物 pin/README 写入口) 与 push 档独占门 193 的错觉教训 (0d07c3edae)
- 🐞 修正:XUI-001 订单状态视图补全 7 值并对未知状态兜底 (81c4ff1ffe)
- 🐞 修正:F-133 personality 读写加属主/管理员闸门 (84d4c21002)
- 🐞 修正:共享屏 diff 取档的 execFileSync 补显式 stdio 三槽, 过门 193 的 stdio 显式属性名判据 (a9e2ec90b7)
- 🐞 修正:补齐 Web 订单状态 refunding/completed/failed 三值文案 (67dc23846b)
- 🔧 その他:登账(缺陷普查批次19/23): API F-541~F-600 共 59 条(F-580 与 DBG-4 重复) (59f8e3168c)
- 🔧 その他:登账(缺陷普查批次18/23): API F-481~F-540 共 60 条 (1840336239)
- 🐞 修正:F-61 分销提现改走 applyWithdrawal 原子冻结 (14d4b67ffa)
- 📚 ドキュメント:registry 保持登记现值并列入保留清单(不改承载面),补正门读数与 21 行口径 (fc4bc77051)
- 🐞 修正:删除 VipScreen 未被消费的必填端口 onNavigate(门290 两处空端口确证为空) (e85a3b0753)
- 🔧 その他:登账(缺陷普查批次17/23): API F-421~F-480 共 60 条 (059017cad3)
- 🐞 修正:余额入账改为单条原子自增/行锁读，消除 USDT 充值与应用订阅并发丢账(DB-03) (8b47174190)
- 📚 ドキュメント:记安装完整性检查的判据、两条读数(exit 0 / 缺 node_modules exit 2)与不扩边界 (d46c983294)
- 🐞 修正:修复 CLI/桌面 3 条 P0(run_tests EINVAL、store 越权、钩子自证绕过) (35bc40522f)
- 📚 ドキュメント:22 条缺 RN 行逐条核验;login/mcp-store 改指壳、registry 改判 portal、19 行补渲染点证据 (2190b793a6)
- 🐞 修正:全量腿共用 gate-prep 取材面 + 按门看门狗预算(30a 不再被 300s 恒杀) (5e1997f6ae)
- 🔧 その他:登账(缺陷普查批次16/23): API F-361~F-420 共 60 条 (24379a5a0d)
- 🐞 修正:F-53 /auth/profile 禁止仅凭会话改绑邮箱 (adab73935a)
- 🐞 修正:staged typecheck 加安装完整性前置检查, 缺 node_modules 判 exit 2 (2c0ac6e502)
- 📚 ドキュメント:staged typecheck 缺依赖产物改为 exit 2 已落地, 记三组脱链复验与残存缺口 (4cef479d0c)
- 📚 ドキュメント:补记门读数前提与并发假红重试留痕(30a 一次,附现场物证) (c0db81dc03)
- 🐞 修正:staged typecheck 依赖产物缺失判 exit 2, 不再把取不到记成改动文件的假红 (7f4f5b01c9)
- 📚 ドキュメント:cherry-pick 生成物通则、staged typecheck 缺 dist 票、icp-record 第 4 条口径 (ab032a7368)
- 🔧 その他:登账(缺陷普查批次15/23): API F-301~F-360 共 60 条 (f22d7a5719)
- 📚 ドキュメント:icp-record onQuery 改为行模型 href,撤销丢外链让步 (c720fe9d37)
- 🐞 修正:自动续费回调的建单/完成并入外层事务，消除半提交与重复发权益(DB-02) (55efcffe13)
- 🐞 修正:合一 /member/favorites 复用 /favorites,门 301 按票作废落档 (cbb5759b19)
- 🐞 修正:封死 AIS-031/AIS-052 任意 argv 越权面(P0) (0d542813ed)
- 🔧 その他:登账(缺陷普查批次14/23): API F-241~F-300 共 60 条 (16df61ba1e)
- 🐞 修正:手工迁移账本改用 drizzle sha256 + journal.when 且同事务写入(DB-01) (4ff6d1ff57)
- 🔧 その他:登账(缺陷普查批次13/23): API F-181~F-240 共 60 条 (b6b1ebe470)
- 🚀 機能/改善:icp-record 行模型加可选 href,备案链接两端渲染 (a611c577d1)
- 🔧 その他:登账(缺陷普查批次12/23): API F-121~F-180 共 60 条 (c182c809fb)
- 🔧 その他:登账(缺陷普查批次11/23): API F-61~F-120 共 60 条；行题面加来源前缀消除跨源同号误判 (65e022cb30)
- 📚 ドキュメント:colorScheme 全量改后读数与逐处改前改后值 (7a146402b1)
- 🐞 修正:colorScheme 跟随 resolvedTheme,消除暗色下亮色页 (52ff17b485)
- 🐞 修正:F-01 public-socket 运维端点补 await 管理员判定 (edbdc7126d)
- 📚 ドキュメント:62→71 定性为读数口径修正;分列 9 条误判与 22 条缺 RN 行;colorScheme 扫描;icp-record 判定/修后渲染与内容待定草案;同步 README 生成块 (55de37b336)
- 🔧 その他:登账(缺陷普查批次10/23): API F-01~F-60 共 60 条 (82c138ff8d)
- 🚀 機能/改善:新增 web 唯一键 settings.icpRecordFooter,供 icp-record 接屏草案的 footer 映射(内容待定) (81306cba0a)
- 🔧 その他:登账(缺陷普查批次9/23): 跨端 UI 收尾 12 条 (f9aa837257)
- 🐞 修正:钱包提现页 colorScheme 跟随 resolvedTheme,修暗色用户看到亮色页的已上线退化;同步 ui-routes 输入指纹 (ab50d8d70b)
- 🔧 その他:登账(缺陷普查批次8/23): 跨端 UI XUI-001~XUI-060 共 60 条 (2405af4f0c)
- 🔧 その他:登账(缺陷普查批次7/23): AI 服务 AIS-061~AIS-118 共 58 条 (05559cc4d5)
- 🐞 修正:共享屏 icp-record 标签显式成对,修正 label1-label5 错位;公网安备号/备案时间保留,无 onCopy 时不渲染复制卡;同步重生成小程序离线语言包 (8947e198c8)
- 🔧 その他:登账(缺陷普查批次6/23): AI 服务 AIS-001~AIS-060 共 60 条 (1332600c7a)
- 🔧 その他:登账(缺陷普查批次5/23): DB 45 条(DB-40 与 DBG-3 重复不入册) (9453ad492c)
- 🐞 修正:宿主改读跨端登记表,读不到即未判定(exit 2) (75c8e01d93)
- 🔧 その他:登账(缺陷普查批次4/23): CLI/桌面收尾 16 条 (d64ddfec88)
- 🔧 その他:登账(缺陷普查批次3/23): CLI/桌面 F-061~F-120 共 60 条 (963ee4ebf2)
- 🐞 修正:去重映射表 3 组重复并清 5 条失效映射;基线吸收 ModelList 平台专属 onContentSizeChange (0c74ece9f1)
- 🔧 その他:登账(缺陷普查批次2/23): CLI/桌面 F-001~F-060 共 60 条 (714866c37e)
- 🔧 その他:登账(缺陷普查批次1/23): DG/W 21 条入册并归档 8 份报告 (78d0ee9b5a)
- 🐞 修正:删除 06927f16fa 并集归并引入的重复 catBatch import,恢复门可解析与真实读数 (221c85c80a)
- 🚀 機能/改善:新增 web 接屏脚手架与登记表层别漂移 advisory 门 (a047c571ab)
- 🚀 機能/改善:新增跨端生产线总账与共享屏平台限制判据 (751f33ec8b)
- 📚 ドキュメント:记 cut9 两文件测试的 3 条存量红(与 main 同红,非本笔引入) (67721b7bcc)
- 🐞 修正:refs 面快进不算重指(避免 push 后 41 假红) + 票补 cut9 重提读数 (833071424e)
- ⚡ パフォーマンス:302p 漂移回归门提速 —— 全树 ls-tree 轮内快照 + 判据面收窄 (256be1a65c)
- 📚 ドキュメント:回填 cut9 四道存量红处置结论与 41 分支清点 (3785f8e299)
- 🐞 修正:explicitFull 只认 GITHUB_ACTIONS,避免宿主 CI=true 关掉 stock 降级 (78c3a05c47)
- 🐞 修正:两处哨兵身份判断去掉 message 文本匹配,行为等价 (7616c81f18)
- 🐞 修正:门57 锚点改指共享屏重构后的真实渲染宿主 (92a6e3ee6a)
- 🚀 機能/改善:门判据面 delta/stock + 存量红只报数(路线2) (d1c270d694)
- 📚 ドキュメント:登记 cut9 四道存量门红项(41/57/204/70b) + gate-302 门票落库 sha 89a5938f0c;README 生成块经 sync-readme-numbers --face=staged 重算 (d4e1621806)
- ⚡ パフォーマンス:T1 逐包并发 + dist 内容寻址,判据不降 (07f89f627c)
- 📚 ドキュメント:新增 302p 两处结构缺陷门票(登记盲区 + judgedGapWeb 方向混维) (89a5938f0c)
- 🔧 その他:302 基线定向刷新 judgedGapWeb 0->1 —— /sag2 如实登记缺屏 (1b984a2246)
- 🐞 修正:30a 结论缓存按判据输入面四指纹复用(修复 3b 有缺口时永不落缓存导致每次全量重算) (dfc2d369ab)
- 🚀 機能/改善:SAG2 词法多跳检索通道前后端落地（rea 取证 + 本仓自有实现） (c20e4a5797)
- 📚 ドキュメント:补充后台 worker 被杀的 fail-closed 语义(残留标记最多等 240s,否则立即回落真跑) (e1086e3467)
- 📚 ドキュメント:补齐推送路径实测墙钟(改造前 105.22s 中位 / 改造后 2.74s 中位 / 回落 115.57s 真跑 13 门证据) (e33313ad3c)
- 🐞 修正:CLI 根推导退一级修正(scripts/ 入口不能复用 scripts/lib/ 的 ../..) (d365b725b3)
- 🐞 修正:钥配置按 KeyPath 语义读取文件内容(不得把路径当密钥) (bab82b2299)
- 🚀 機能/改善:提交侧求值 + 推送侧凭据校验(13 门/文档数字/i18n 后台真跑, fail-closed 回落) (a78bee7f3d)
- 📚 ドキュメント:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (616fb59a5a)
- 📚 ドキュメント:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (aec3023ba2)
- 📚 ドキュメント:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (d400a0e35b)

**2026-11-07**
- 🐞 修正:签到按钮同 tick 互斥与失败复位(票 F),并发两次只发一次请求 (125d3b1f3f)
- 🐞 修正:签到助手回屏只刷新一次(票 D),复用 screen-reappear-adapter (29085fdd48)
- 🐞 修正:web checkin 改名 checkinAssistant,与 checkIn 区分 (4623179dfc)
- 🐞 修正:重发倒计时秒数上屏,补全 5 locale 占位符并清掉全量静默丢参 (ef4478996d)
- 🐞 修正:签到助手写操作加同 tick 互斥与 finally 复位,消除连点重复签到/重复启停 (077ee973a8)
- 🚀 機能/改善:验证码复制按钮改为右侧细描边胶囊并上线落地页 (578c4caf4e)
- 🚀 機能/改善:门结果缓存 + 后台预跑(新增 gate-cache/gate-worker/夹具/注册表) (a49fd06f05)
- 🔧 その他:D15 对照的 git show 显式接管 stdio(门193) (2ae1a6f90f)
- 📚 ドキュメント:push 面现算对齐 testFiles 4359→4363 与 apiRoutes 4722→4725 (4e82155935)
- 🔧 その他:收编守护落档产出(3 件,凭落点账本) (98b102011c)
- 📚 ドキュメント:对齐 push 面 apiRoutes 散文 4722→4725(README.en) (2ff1ed9a34)
- 📚 ドキュメント:校正合并后 apiRoutes 散文数字 4722→4725(官方 scrub 重算) (d62645a507)
- 📚 ドキュメント:归档 2026-11 票与事故记录 (2616002dbb)
- 🚀 機能/改善:邮箱验证码邮件增加一键复制按钮与站点落地页 (aea6081e61)
- 📚 ドキュメント:合并后 push 面现算对齐 testFiles 4349→4353(13 处散文) (d3fed962d3)
- 📚 ドキュメント:README.en 口径行 workflows 数对齐现算 56 (c2b71ce79e)
- 🔧 その他:收编停留≥3分钟的未提交改动 (f7141dee38)
- 🐞 修正:修 main 既有 T1 红 —— 超工快照类型面收口(来源 88e2e0b578,该修复此前只在本地 main 未推) (0bcf621eda)
- 🔧 その他:收敛推送落地后清回清单腐烂正确终态 (8329cc7ee7)
- 🔧 その他:33 条追认行按独立追认钥重签 (3b8531d83d)
- 📚 ドキュメント:口径自述行 testFiles 对齐现算 4352 (46ad973c01)
- 📚 ドキュメント:收敛落地后按门173 push 面现算值对齐 trackedFiles (d59b265444)
- 📚 ドキュメント:数字对齐现算值(合入 codebase-index 后活性区+口径自述行) (fa9cbdfcb2)
- 📚 ドキュメント:注释对齐唯一写入口(不再指向 gen-doc-numbers --markdown) (cceabb5246)
- 📚 ドキュメント:按门173 push 面现算值对齐活性区数字与生成块 (4bff615e76)
- 🐞 修正:陈旧 dist 前置改逐产物判据并复核重建产物 (89ddd4c08b)
- 📚 ドキュメント:数字对齐现算值(活性区存量清偿,合并入队前基线校正) (9b719475b7)
- 🐞 修正:README 生成块收口为唯一写入口 + 写盘 CAS 并发判定 (23f2dddbc0)
- 🔧 その他:README 生成块随 RP-42 刷新(3 个指标,HEAD 面重跑) (d93460fc66)
- 🔧 その他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (13c9ab1bc8)
- 🚀 機能/改善:超工慢路径判定环落地(RP-42 结清)。shared slow-path:三值 verdict+noteSlowDecisions 注记随快照活+judgeRecorded(record 档只注记不开工/auto∧act∧非机器人走与人工同一条 acceptRecorded 语义、inferred 强度、判定 reason 不渗授权范围/人点名仍在建议之上/通道抛错=未判定积压原地可重试);ai-service POST /api/super-agent/slow-path/judge(批量≤20 恰等长 JSON 硬校验、逐条 requesters 不含承载层主体 403、形状不符 502 不记绿,身份只从 require_request_user_id);api createSlowJudgeCall 注入式适配器(动态 import 测试零 config 拉起);泵 slowJudge 阶段 env 门控 IHUI_SUPER_AGENT_SLOW_PATH 未开=零模型动作。行为对照 dsh-superagent 两级过滤第二级,自写实现。vitest 46+3 例/pytest 12 例/mypy strict 全过 (61ed8adf90)
- 📚 ドキュメント:结清 RP-42——慢路径判定环:shared slow-path 三值注记+judgeRecorded(auto∧act∧非bot 走 acceptRecorded 同一条语义、人点名仍在建议之上、通道抛错=未判定积压原地);ai-service POST /api/super-agent/slow-path/judge 批量恰等长 JSON 硬校验+主体资格 403;api 注入式适配器;泵 env 门控 IHUI_SUPER_AGENT_SLOW_PATH。46+12+12 例全绿+mypy strict (668e95e5e4)
- 🐞 修正:账本族残渣闸补 root 注入 —— 治 T5/T26 稳定红 (b7a5beae9f)
- 🐞 修正:清偿迁移链孤儿与 B5 类型畸形,重生成 miniapp-taro ui-routes 钉 (be99b07cfe)
- 🐞 修正:派生腿整族改 spawn+await,并给长腿装 30s 周期心跳 —— 治 A11 轮内停摆的根因 (b7047ecda5)
- 📚 ドキュメント:用法注释与默认面同步(人读表=索引面) (8bb6257091)
- 📚 ドキュメント:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (9241a26d3b)
- 🐞 修正:取数面收敛为唯一权威面(写手默认=索引面),并重封 root-guard 清单 (05242dae38)
- 🚀 機能/改善:超级智能体存算分离落地（RP-41 结清）。host snapshot/restore：版本/形状/归属三重 fail-closed、重放触发幂等、pendingStart 未派队列随账本活、按主体切片计数分账；api 泵每轮去抖落 user_preferences super_agent 组（同 permission 套路零迁移零新路由）、启动先恢复再开节拍；保留账号 IHUI_SUPER_AGENT_STATE_ACCOUNT 未供=unconfigured 如实降级、写失败=degraded 点名（§0.3 不冒充）。行为对照 dsh-superagent 状态持久化+重启恢复设计。shared 38 例+api 9 例全绿。README 功能面债:该文件正被别席大改(索引面 18k/37k 行),持久腿说明待其落地后同批补登 (b9b9181d60)
- 📚 ドキュメント:结清 RP-41——超工账本入库:复用 user_preferences super_agent 组(同 permission 套路,零迁移零新路由);host snapshot/restore 版本与形状 fail-closed、重放触发幂等、pendingStart 随账本活;泵每轮去抖落库,启动先恢复;保留账号 IHUI_SUPER_AGENT_STATE_ACCOUNT 未供=如实 unconfigured。shared 38 例+api 9 例全绿 (4602c57e1d)
- 🐞 修正:A1「新增行」在合并态对全部父提交求并集排除(单亲逐字节不变) (e26e18f69f)
- 🐞 修正:长腿改异步 + 心跳点双侧齐平 —— 治 A9 载体分叉与 A11 轮内停摆;A6 分代 + 装车锁认得新形态 (d0028c046f)
- 🔧 その他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c2d342eb67)
- 🔧 その他:活性区数字随仓态清账(apiRoutes 4719→4721,11 行)+ 重跑生成块 (06a974db27)
- ⚡ パフォーマンス:只 blame 未勾选行,把取票口从 >300s 拉回 16s(治 A3 恒未判定 + 派发腿零派发) (44443b7661)
- 🔧 その他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4abe3a269c)
- 🔧 その他:补齐 README 活性区 27 处旧数(DN2 head 面) (46a27cb5a5)
- 📚 ドキュメント:按 gen-doc-numbers 现算值刷新生成块 (73b0fdff97)
- 🐞 修正:收窄 file-tree-memo 的 unread 入参到 unjudged 分支 reason (2587b33380)
- 🔧 その他:README 散文 28 处旧数对齐 head 面现算值(DN2) (f5a4ce8f5b)
- 🚀 機能/改善:超级智能体装上 Watchdog 泵与租约心跳。事件源端口+巡检泵（回收即重派不隔拍、单端口故障隔离计数）、report/heartbeat 双通道续租、策略档 workerLeaseMs 默认关保持既有行为；派发经单一出口下传隔离身份与归属，泵循环 env 门控零定时器噪音。行为对照 DeepSeek dsh-superagent（MIT）设计，自写实现并超越（登录主体隔离槽位/租约记账）。shared 32 例+api 5 例全绿三遍稳定。README 功能表债:本票 README 行因 b96828411f 回归远端旧版失去锚点,未随本提交落地,待 README 功能面恢复后由后手同型补登 (61ac4819a2)
- 🔧 その他:重跑 README 生成块(3 个数随仓态漂移) (9118d99675)
- 🐞 修正:两笔失效门的治(无 TS 输入面档 + 逐腿心跳),并把 README 回归远端版本 (b96828411f)
- 📚 ドキュメント:超级智能体缺口四票入账（事件源适配器/工单入库/慢路径/工作台面板） (865ca1ea07)
- 🔧 その他:根护栏清单按收敛后 HEAD 现面重封 (f51957a86a)
- 🔧 その他:XSS 回归测试重钉到受控子集渲染器四道安全闸 (f2bf0b8c2b)
- 🔧 その他:按生成器刷新 tool_name_sets.json (f935d7646b)
- 🐞 修正:心跳从「10 个段界」加密到「逐腿 24 个点」,把 A11 的假红收敛成真信号 (30f1f8f360)
- 🐞 修正:密钥映射按服务面判定,12 枚媒体键不再读成 ai-service 缺行 (1fad91bb0e)
- 🔧 その他:清偿 README 活性区存量数字债(296 行),恢复「文档数字门」的可推性 (5a6051794e)
- 🔧 その他:重跑 README 生成块(6 个数随仓态漂移) (f9787f1d6b)
- 🐞 修正:typecheck 门在「改动不含 TS 输入」时给可自证结论,并把等锁空烧变成可读诊断 (56051474b4)
- 🔧 その他:补 22 文件溯源水印 + 6 文件版权头(HEAD 面欠账,由 47p inject 生成,非内容改动;标点改动已剔除) (f7969f149f)
- 🐞 修正:blame 档位没量到时不挑整文件也不挑行 (95797ca265)
- 🐞 修正:宿主工单账写入会话库,重启后按同一 trigger 不再派工 (5087422beb)
- 🐞 修正:按提交读 notes 时把引用不在和没记过分开 (991bac4981)
- 🔧 その他:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (b400fe5189)
- 🚀 機能/改善:作业嵌套失败不按错误码脱离父作业 (e3fc2b1ac4)
- 🐞 修正:元运维巡检改 spawn+Promise,长腿不再冻结轮级锁心跳 (968f22d4f7)
- 🐞 修正:提示词只按宿主编号另存，不写进 git notes (78046b6c54)
- 🚀 機能/改善:接线 6 个未派发钩子并补齐 5 个控制帧(CLI / API / 引擎 / SDK) (d6d494fc42)
- 🚀 機能/改善:研究检索只按量到的并发和抓取名额发外呼 (24de8f5b14)
- 🐞 修正:检查点按去重键写入 git notes，缺引用不补空 ref (a4523173f8)
- 🐞 修正:重生成 tool_name_sets.json 补 sandbox_session（307p 转绿） (2a0a228342)
- 🚀 機能/改善:启动打点只认接口真正收下的名字 (312392020c)
- 🐞 修正:量到工具面之外的改动才记 known_human (e09e49acf7)
- 🐞 修正:写盘前先记 before_edit，写失败不补 after_edit (c22aa69118)
- 🐞 修正:收窄 FileTreeVerdict 的 unjudged 原因集 —— 修复冷构建 tsc 失败(主线既有类型缺陷,纯类型不动运行语义) (eda8919a31)
- 🚀 機能/改善:流结束时暂停或暂停态没量到就不自动补发 (848ec43bca)
- 🔧 その他:tool-name 集合补齐 codebase_index —— 新增 /tools/codebase-index 路由后按生成器同步 (80e67c7f8b)
- 🚀 機能/改善:代码库索引能力增强 —— 符号目录 + 新鲜度三态 + 本地检索腿优先读目录 (6eb4b244d5)
- 🐞 修正:段界检查点顺带续心跳,把 block-enter→post-feedback-loop 的 22 条腿切成 4 段 (7978ca2773)
- 🐞 修正:编辑检查点按去重键追加，缺测字段不填默认值 (8ff125ddc5)
- 🚀 機能/改善:网页构建模式把多步任务派给既有同进程 worker (1dee4efc82)
- 📚 ドキュメント:对外宣称的 CI workflows 数同步为 55 (d3b5f3219c)
- 🚀 機能/改善:新增能力评测基线并接入 CI 回归门 (26ad3cf05a)
- ⚡ パフォーマンス:削减单文件 lint 固定开销并给 lint-staged 加缓存 (728fdcccf6)
- 📚 ドキュメント:铁律点名 e2e skip 由门 311 判 + 同题跨号更正 300→311 + root-guard 重封 (1291b6989a)
- 🚀 機能/改善:agent_loop 高危判定接入动态注册表 write tier(最小接线) (ff8eb7bd55)
- 🚀 機能/改善:受信动态注册表,收紧目录/商店安装入口 (d85803931a)
- 🐞 修正:续跑处置参数改用 Mapping，兼容 Literal 声明且不丢失只读语义 (ffc85720eb)
- 🐞 修正:T1 超时预算畸形改硬失败 + 棘轮改跨提交史比对 (3444b0ae67)
- 🔧 その他:真子进程硬中断用例证明跨进程续跑四分档 (792bf31f41)
- 🔧 その他:三处让号与合成落本地(main 未推侧) (b7ec515d92)
- 🐞 修正:T1 预算棘轮补 margin 证据链,自包含复核判据入库 (6013b5e151)
- 🚀 機能/改善:续跑需要确认时返回 409 + 处置清单（两条 resume 出口同形） (6f1836bd6f)
- 🚀 機能/改善:续跑分支按单 tool_call 判定重放/续跑/拦确认 (121af18d60)
- 🐞 修正:DBG-83 run-cdn.bat node 发现机制替代死盘符硬编码 (186f7ab616)
- 🐞 修正:DBG-33/34/35/36/37 相对时间与日期随应用语言 + 令牌轮换写入顺序对齐 (03fffbe9ce)
- 🐞 修正:T1 改并发4+LPT 派发(300s 让位于实测基线),门251 修 staged 参数序+批量取面并补夹具,worktree 自有 node_modules (a8ff738ce2)
- 🐞 修正:DBG-25 canAccess FAMILY 分支真隔离判定 + DBG-23/28 判定留档 (7305671657)
- 📚 ドキュメント:消息 parts 数据模型设计稿(1106) (de1baf69d9)
- 🐞 修正:DBG-61/62/67/68/72 会话存储访问级+侧栏通道+缓存键+弹层定时器+API基址白名单 (4a4fdb12a6)
- 🚀 機能/改善:工具轮写前 checkpoint + attempting/settle 回执（fail-closed） (07e7baaa9d)
- 🐞 修正:DBG-73 数据源指向原生端口 + DBG-74 级联抑制恒不命中 (a345c6bf08)
- 🐞 修正:DBG-64 dom action 失败补 .catch 避免 background 等满超时 (b4a4484b01)
- 🐞 修正:DBG-71 移除未使用的 scripting 权限 (c886971722)
- 🐞 修正:DBG-98 私有索引提交脚本共享临时文件路径并发碰撞 (48049e6ced)
- 🐞 修正:收口 DBG-38 P0 RCE 面 + DBG-75 P1 告警盲区 + DBG-80 P1 部署失效 (4a17d64779)
- 📚 ドキュメント:登记缺陷深挖批次 DBG-1..99（2026-11-07 两轮并行代理审查） (19ccd61bdd)
- 🔧 その他:接管 memory/soul.ts（原工作树未提交，静默 4h34m，来源：工作树；DBG-44 画像落盘改原子写；无独占测试接入，无覆盖变更） (021f349f31)
- 🔧 その他:接管 runs/manifest.ts（原工作树未提交，静默 4h31m，来源：工作树；DBG-42 manifest.json 改原子写） (e6fdea1dfb)
- 🔧 その他:补过期 running 自愈夹具(07:48 现场复盘) (5e258b5118)
- 🔧 その他:接管 doom-loop-detector.ts（原工作树未提交，静默 3h38m，来源：工作树；窗口参数透传 DoomLoopWindowOptions） (512513ffa4)
- 🔧 その他:接管 commands/repl.ts（原工作树未提交，静默 5h，来源：工作树；BUG-0015 formatContextStats 入参收敛为 role+content） (c7bdb83d57)
- 🐞 修正:running 状态校验 pid 存活与启动时刻,死 worker 判中止并留死因 (15fa0e297f)
- 🔧 その他:补 tools/index.ts 契约最小夹具：ToolResult.data 透传（src 已于 ff669e19e5 接管） (cedb5e221e)
- 🔧 その他:接管 util/spawn-isolated.ts（原工作树未提交，静默 4h31m，来源：工作树；附 plugin-git-url-shape 异步化适配） (46f2250611)
- 🔧 その他:接管 commands/session.ts + commands/hooks-auto.ts（原工作树未提交，静默 4h44m/3h09m，来源：工作树） (44ffbcbfea)
- 🐞 修正:微信支付未确认状态被当成功，直接给充值/VIP 额度（DBG-30 P0 资金安全） (42d0f4c3c8)
- 🔧 その他:接管 tools/index.ts（原工作树未提交，静默 2h55m，来源：工作树） (ff669e19e5)
- 🐞 修正:git 重建脚本写锁判据语义写反致有锁时仍继续删 .git（DBG-85） (17c39485b3)
- 🐞 修正:公告缓存与已读集合改原子写，并把 announcements 纳入写盘安全门射程（DBG-41） (de54122619)
- 📚 ドキュメント:64 条缺陷按 HEAD 实况判完 — 已修 60 / 仍开 2 / 未判定 1 / 部分修复 1 (c99f600be8)
- 🐞 修正:小程序 permission 按已有口径如实登记为缺口，消除端能力门假红（BUG-0028） (d673f0ddc3)
- 🔧 その他:接管 telemetry/index.ts（原工作树未提交，静默 2h42m，来源：工作树） (8f5b4e837c)
- 🐞 修正:git 命令加可取消异步版并根治并行测试冷启动竞态（BUG-0040/0037） (1f87eb0048)
- 🐞 修正:67 例确定性失败按四个根因归并修复（BUG-0035） (cf391b0855)
- 🐞 修正:命令白名单剥 Windows 可执行后缀，运行测试超时竞态根治（BUG-0032/0033/0034） (e9c3c785ed)
- 🔧 その他:0015 接手 provider-request-admission.test.ts（原在飞无提交，来源：工作树） (c40e470228)
- 🔧 その他:0015 接手 hooks-trust-atomic-write.test.ts（原在飞无提交，来源：工作树） (7d9a1bede9)
- 🔧 その他:0015 接手 inflight-ledger.test.ts（原在飞无提交，来源：工作树） (1add3ed5dd)
- 🔧 その他:0015 接手 plan-machine-integration.test.ts（原在飞无提交，来源：工作树） (1c88e2bf4d)
- 🔧 その他:0015 接手 mermaid-grammar.test.ts（原在飞无提交，来源：工作树） (c00b60be08)
- 🔧 その他:0015 接手 checkpoints-corrupt-manifest.test.ts（原在飞无提交，来源：工作树） (d6a70cb68c)
- 🔧 その他:0015 接手 crash-handler-boundary.test.ts（原在飞无提交，来源：工作树） (5e4261412f)
- 📚 ドキュメント:标明 tsconfig.tests.batch.json 仅用于单批读数可复现(BUG-0015) (4f185fae52)
- 🔧 その他:0015 B1 —— 7 文件 B 组 15 条真修,批次配置钉 true(BUG-0015) (06513dcfa3)
- 🔧 その他:0015 A2 —— 13 个 tests 文件的索引访问在 noUncheckedIndexedAccess 下真修到 0(BUG-0015) (1824bedc7a)
- 🔧 その他:保留 BUG-0015 单批读数配置 tsconfig.tests.batch.json(仅批次复现,非全仓配置) (ff7eaebb9d)
- 🐞 修正:BUG-NEW-02 新增 skills 同步出海口静态门,并删掉 imgchr 自相矛盾的 disable_warnings (ebf856d8f9)
- 🔧 その他:0015 A1 —— 15 个 tests 夹具索引访问在 noUncheckedIndexedAccess 下真修到 0(BUG-0015) (9276758f22)
- 🐞 修正:提现状态五语言包补齐 processing(web 管理端映射同步) (7b95c067b2)
- 🔧 その他:0042 未知键断言改经 Record 视图取值(BUG-0015 顺手) (d053fc1031)
- 🔧 その他:摘取 ff2e942864 仍有效的三条 hunk(BUG-0015) (2d0b61ad1b)
- 🐞 修正:门基线与镜像 tag 变量化、pnpm action pin SHA（BUG-0056/0058/0061） (1ddd4a6bb3)
- 🐞 修正:文件写盘安全门覆盖面补 sessions/checkpoints/subagents 状态面(BUG-0044) (879c5cf418)
- 🐞 修正:全局配置层运行时类型校验,非法值回落默认并逐键点名(BUG-0042) (a2b3b7f60b)
- 🔧 その他:修 BUG-0030 红臂的豁免剥离写法 (75890067f5)
- 🐞 修正:10 处字符图标换真图标(BUG-0030) (609787c0f2)
- 🚀 機能/改善:新增 dispatchDialog.dagRemoveNode / dagRemoveEdge(5 语言) (ea038ceb6c)
- 🐞 修正:invocationId 改确定性键 agent:{session}:{tool_call}:{attempt} (cbe74d6801)
- 🚀 機能/改善:checkpoint 管理器新增工具回执 CAS 写入（耐久后端才算落地） (2e442cb9a2)
- 🐞 修正:错误/空态补回页头返回入口,修复 GA7 既有红(BUG-NEW-01) (00367fddf9)
- 🚀 機能/改善:新增模型化 Fast Apply 编辑服务(三档锚定 + 写后校验回滚 + 一次纠错) (3e7de76e27)
- 🚀 機能/改善:跨进程续跑纯判据模块（回执优先于历史，不确定即拦确认） (ca6fe5a465)
- 🐞 修正:BUG-0029 7 处原生 title 当 Tooltip 换成真组件——5 个站点改 Tooltip/TruncatedText；配 24 项夹具（绿臂真实文件 0 处、红臂旧写法 7 处必红） (a22549c134)
- 🚀 機能/改善:B72 学生考勤补自签退入口与业务日修正 (48816d450d)
- 🐞 修正:BUG-0038 跨端锁目标跟真实文件——web voice-input 改 components/chat，Taro Avatar 走具名缺席豁免 (a2c709819c)
- 🐞 修正:BUG-0022 五端 SSE dispatch 覆盖收口（派生回调登记为非帧 + 基线现算 + 改前必红夹具） (b7264840df)
- 🚀 機能/改善:注册门 300 —— e2e skip 制度化 + 固定等待条件化 (03dce41561)
- 🚀 機能/改善:B72 学生考勤补自签退入口 (a3082dc7f8)
- 🔧 その他:SSE 事件成员数按现读抬到 37 并补 name 成员断言(BUG-0025) (6f7073dac8)
- 🔧 その他:判据镜像测试 12 例（合规/无理由/无编号/孤儿/过期/TIMING/自证等） (978c4af8d3)
- 🚀 機能/改善:新增守门 CLI（head/worktree/staged 三面 + --self-test 三态自证） (fbc5314849)
- 🚀 機能/改善:新增 e2e skip/固定等待判据纯函数库（skip 理由/编号、TIMING 注解、孤儿与过期登记） (2bf2381318)
- 📚 ドキュメント:新增 SKIP-WAIT-POLICY 制度正文（skip 登记 + 固定等待条件化） (c3cb576f25)
- 🐞 修正:清理 remote-icons 4 个零消费死键(BUG-0026) (ba9da25b6a)
- 🚀 機能/改善:B72 学生考勤签退文案五语同步 (347f5aeb31)
- 🔧 その他:ruff 23 条清零(21 条机械修复 + 1 条 F401)(BUG-0036) (8f841fdb7c)
- 🐞 修正:清理 4 个脚本的本机硬编码安装路径(BUG-0055) (0ca198e5e1)
- 🔧 その他:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (0d28aa5f2a)
- 🐞 修正:Defender 排除基址改由脚本位置推导(BUG-0054) (9025f48f74)
- 🐞 修正:recovery source 仓根改由脚本位置推导(BUG-0053) (49ea7c4133)
- 🚀 機能/改善:B72 学生考勤补齐自签退入口与签退时刻列 (32ad38645c)
- 🐞 修正:摘除 packages/app barrel 的死副本 NavBar 导出(BUG-0014) (3154d9567c)
- 🐞 修正:service-binary-paths 修复 PAUSED 分档不可达并打印失败用例名(BUG-0049) (b5ee950d59)
- 🐞 修正:disk-root-write 只读 gitdir 纳入收窄并补阳性对照(BUG-0045) (306728ef7c)
- 🚀 機能/改善:压缩保留锚点 —— 任务锚与 pinned 消息原文跨压缩保留 (12a6530e5a)
- 🐞 修正:retrieval-quality 现场用例对齐双路融合判据(BUG-0048) (65c6dec9db)
- 🐞 修正:model-capacity 自检样本对齐 6 档源码(BUG-0047) (3b6103645d)
- 🐞 修正:prod-checkout 门补 --self-test 并同步契约锁(BUG-0050) (3bfae56f87)
- 🔧 その他:登记缺陷审计残余五项合并票(BUG-0015/0042/0044/0058/0061) —— 只登记本轮实证仍开着的项 (f3f91d257f)
- 🐞 修正:承载面心跳改读锁文件 mtime,纠正 at= 当心跳的误判 (1cc3312fed)
- 🐞 修正:plan-id-pool 自检语料同步池上限 99 并补边界样本(BUG-0046) (7b9e012e64)
- 🔧 その他:每周审计 typecheck 去掉 echo 兜底转为阻断(BUG-0062) (b1b25bb813)
- 🔧 その他:构建/发布 workflow 补 timeout-minutes 与 release concurrency(BUG-0060) (588dbdefa4)
- 🐞 修正:根栈 web 服务补 healthcheck(BUG-0057) (cb5dc7669c)
- 🐞 修正:移除 SaaS Prometheus 未鉴权的 web.enable-lifecycle(BUG-0019) (1c768da043)
- 🐞 修正:修复 observability compose 端口行尾多余单引号致整栈无法启动(BUG-0011) (915a152c82)
- 🐞 修正:预测式编辑总开关接入编辑器链路(V3 #82) (b208c0f33b)
- 🐞 修正:预测式编辑总开关接入聊天输入区(V3 #82) (f3600c90e7)
- 🐞 修正:RP-74 第二批 —— 28 条未判定按「有戳位就接、无戳位就具名」收口 (b1d05ba2c7)
- 🔧 その他:为 overlay 水位重用例显式放宽超时预算(BUG-0024) (3a91faa1a6)
- 🐞 修正:语音完成回调收敛为 final 单通道避免重复上屏(BUG-0023) (d2bd277c7f)
- 🐞 修正:语音条播放收敛为单音频上下文并在切条/停播/卸载时销毁(BUG-0013) (5df7f06505)
- 🐞 修正:site-apk 增判 downloadUrl 指向自有站点腿,行在位不再当端内更新卡可用 (bddf6e5a59)
- 🐞 修正:渠道登记面改为实读 0364+schema+路由,store 维度已落地不再长期报缺 (c53ddd7dbe)
- 🔧 その他:补 GitHub App CI 三类事件忽略应答与零 IO 判据 (7fab2d4079)

**2026-11-06**
- 🐞 修正:收口 push 门 typecheck 基线 —— 补齐测得出的契约缺口 (16d9e7721a)
- 🔧 その他:根目录整洁守门 ALLOWED_HIDDEN_DIRS 补 .worktrees-archive(worktree 分支指针归档) (44365cbaf0)
- 🐞 修正:skill_list 注入登记与生产出口对齐,补齐 frontmatter 三字段契约 (01f9dc5075)
- 🔧 その他:补近同改名两条边界——新侧单独超限降级、文档无指纹只能删+增 (0c62ff76d6)
- 🐞 修正:修正 staged 面 git grep 选项顺序,让提交链能真正取到候选清单 (587d320556)
- 🐞 修正:签名路径判据只拒未成对单反斜杠,不再误杀正确的双写形态 (c29dc64295)
- 🔧 その他:补近同改名(basis=simhash)差集接线用例——删+增照旧、三字段形态、两条降级回执 (6b562e3a7c)
- 🚀 機能/改善:RP-74 派发面双链对等第三族 —— 键表现解析源码、99 面分批搬进常驻 tick、B 档就地具名豁免 (83fece8938)
- 🐞 修正:同步 Maximize2 生成图标(11h 图标替换的派生产物) (80d8b059dd)
- 🔧 その他:删除 miniapp dispatch 已实际注册帧的过期 missing 登记 (5382b67330)
- 🐞 修正:补对话流锚点、圆角档位与真重试,重跑 ui-routes 生成物 (f34b4130c3)
- 🐞 修正:补 read_tool_output 工具名映射与五语言 taskStatus 键 (8fcbd2354b)
- 🐞 修正:跨端共享屏与 RN 深色前景/圆角角色档收敛到基线内 (3828fdd41b)
- 🐞 修正:图标位 emoji 换 lucide 组件,同笔收敛品牌前景与圆角角色档 (dc4c471aa2)
- 📚 ドキュメント:同步生成块计数到当前 HEAD (d4094d7efd)
- 🐞 修正:门 260 升级 joi 17.13.9 修二次时间 DoS (26d5a88216)
- 🐞 修正:门 94 补录 4 个未登记 errorCode (571fde5fbd)
- 🐞 修正:修复 21:05 批改写引入的语法与默认值缺陷，保证空库可从零跑到 370 (523405c8c0)
- 🐞 修正:清 5 道门红点(173 文档数字 / 207 AGENTS 体积 / 265 ps1 BOM / 267 根护栏重封 / 47 溯源水印) (7c6aff5993)
- 🐞 修正:门 52 补 windowsHide 防桌面黑窗 (014e9d62fa)
- 📚 ドキュメント:登记 RP-71 覆盖面缺口专项票 —— 旁路落地器自愈补跑 2 台折算 / 9 处裸调 / 5 台零自愈 (3b01a9b24f)
- 🐞 修正:门 197 截断声明块补计数/总量兄弟键 (56da828293)
- 📚 ドキュメント:迁移 journal 重排的源码级裁决(记账只看 when 高水位,idx 不参与) (9fe3961b30)
- 📚 ドキュメント:登记脚本套件里两条常红(C5 与判据互不认账 / RP-71 收口后 H1 红) (fba4e4c148)
- 🐞 修正:门 263 清零 ruff 欠账 (365722208f)
- 📚 ドキュメント:登记病行补号的正确出口(单笔被三维守恒拒,须走让号重登两步) (e33049a38b)
- 📚 ドキュメント:RP-94 行按当次现读改写(旧值 359/175 已被并发推进甩开) (017207dc86)
- 🐞 修正:隔离必失败的 20261106150000 迁移件并补齐 369/370,解除生产部署阻塞 (93bdb57389)
- 🐞 修正:绝对 P95 维不再由单枚离群样本判死 —— 治 B37 那类"好构建被自动回滚" (4b11f02045)
- 📚 ドキュメント:登记 canary/迁移/守门四张真缺口(B37 取证链跑出来的,含本枚未做的那一半) (0da73fa5ac)
- 🐞 修正:取号令牌"族名不合法"这一型不再静默入库(实测病行已带空编号进 HEAD 12 天) (3d244eac7f)
- 📚 ドキュメント:登记 DB-DRIFT-2(孤儿列 3 + 孤儿表 9,只登记不动)\n\n只读比对 ihui_dev 与 368 份迁移件:3 个 publish_accounts 孤儿列的 pg_attribute.xmin\n是连续单语句事务(手工 ALTER / drizzle-kit push),TS schema 无定义且全仓无读取点;\n9 张孤儿表无 CREATE TABLE、无 schema 定义、无 SQL 引用。本笔只登记待办,\n明确「删列删表需单独授权」,不动任何列/表。\n\n本次提交用私有 GIT_INDEX_FILE 隔离,避免把同树其他会话的在飞改动混入本笔。 (2987fd8e01)
- 🐞 修正:修 post-merge-ledger-sync 判据取材恒 null —— 存量恒红 16/25 转 25/25 全绿 (43562bf24d)
- 🐞 修正:RP-71 收口 —— 形状锁去恒真、软退出码不回落、夹具真绿、测试面补齐 (cb70dc5af0)
- 🐞 修正:journal 改号避让 prod 的 369/15:00 + 删去重复索引迁移件 (213ce88545)
- 🐞 修正:补幂等迁移补建 3 个缺失索引 (45a29c5943)
- 🐞 修正:补幂等迁移修复 chat_conversations.share_token_expires_at 漂移 (e6ee921163)
- 📚 ドキュメント:登记 RP-73/74/75 三张收敛期实测票(RP-94 只读档跑出来的三格真缺口) (138ba9dcab)
- 📚 ドキュメント:自动同步缺口账本到现读口径(镜像 256 · 缺口 16) (322794332a)
- 🔧 その他:sync-readme-numbers 覆盖活性区散文(同门 173 判据)+ 双夹具;README 跟踪数 19496→19498 (8322e79960)
- 📚 ドキュメント:散文数字同步(apiRoutes 4699→4700,scrub --scope=active 共 11 行) (dcd9eaf10c)
- 📚 ドキュメント:用 sync-readme-numbers 刷新 README 生成块(apiRoutes 4700 / testFiles 4226 / trackedFiles 19496) (9a8e6fb3e7)
- 🔧 その他:chat 页(BUG-67 浮层)按复制页重新在册,门 299 判绿 (5130247253)
- 🐞 修正:rn-shell-types 派生件接入提交链,251 触发面补 types/ (5cc02e6c39)
- 📚 ドキュメント:结清 Y-13(webhook 对 CI 事件返 400/500)—— 按「完成即删」摘行 (194251a755)
- 🐞 修正:悬空 commit 批量备份器修好一处"import 阶段就崩"的真缺陷 —— 账面点名 109 枚待处置,而唯一出口一跑就死 (49f03ff8ce)
- 🚀 機能/改善:落地通道被"活着但不动"的持有者独占时,现在有读数也有账面 —— 停摆第三型不再只有被挡住那枚自己知道 (bf5560612a)
- 📚 ドキュメント:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (e7d89b74b1)
- 🐞 修正:门 30a 的 fsck 预算加一个"只抬预算不改判据"的出口 —— 今天它只有两条路:跳门或改文件 (72e47a67df)
- 📚 ドキュメント:登记 root-guard 同枚重封声明闸(b 方案) (b26167cce3)
- 🐞 修正:落地后置复跑改为按臂预算(登记表 + 实测出处)—— 永远取不到的"未判定"不是保守,是坏了 (1f039bb328)
- 🐞 修正:被上限掐死的一班归 cancelled —— 该档历史上 0 行,趁它还没咬人先把归类钉对 (3a7ddf3890)
- 🔧 その他:取号器镜像测试的 8 支反向锁改判代码面 —— 反向锁读自己的解释文字就是恒红,遮罩是加强不是放宽 (5680d4ea29)
- 📚 ドキュメント:结清 5 张已闭环票(RP-65/RP-67/RP-69/RP-70/L31441) —— 按完成即删整行摘除 (b66f0d861b)
- 📚 ドキュメント:RP-69 补登 GitHub App webhook 异步派发面(ko,§21 同批义务) (a2da1a6240)
- 📚 ドキュメント:RP-69 补登 GitHub App webhook 异步派发面(ja,§21 同批义务) (eae95c1e9b)
- 📚 ドキュメント:RP-69 补登 GitHub App webhook 异步派发面(en,§21 同批义务) (e428f0765b)
- 📚 ドキュメント:RP-69 补登 GitHub App webhook 异步派发面(zh,§21 同批义务) (2c3ff6ae54)
- ♻️ リファクタ:RP-70 B25/B32 重复 API 面收敛为单一出口 (85a76988b0)
- 🐞 修正:L31441 灰度实例不在位单独出声，三档终态钉镜像锁 (569ad72883)
- 📚 ドキュメント:补登 1 枚送还腿静默成功的缺陷票(实测五枚日志同句) (ee49bb8de9)
- 🐞 修正:RP-67 消费 import-graph 的 ok:false 并产出 [IHUI-SCOPE-DEGRADE] 签名行 (9f42c71f18)
- 🔧 その他:接线锁正则容忍 import 折行,避免格式化造成假红 (9a8361e992)
- 🐞 修正:db-probe 的 8810 只放行隔离库白名单,ihui_dev/ihui_prod 等仍拒 (2aa4690f99)
- 🔧 その他:ai-service 出站改签短期票并绑定真实主体(回调/写卡/号池桥接) (481f156b66)
- 🔧 その他:api 发送侧统一走内部票据出口,旧密钥仅作兼容同发 (1e61274522)
- 🐞 修正:取号面并入「近期已结清号」避让 —— 完成即删留下的洞不再被当空闲复发 (b0fcdb8adb)
- 🔧 その他:ai-service 入站验票器接入 /internal/checkin 与免扫描标记 (0a317f4559)
- 🔧 その他:5 个 X-Internal-Secret 端点改走票据统一出口 (da4daf00a4)
- 🔧 その他:X-Internal-Secret 统一票据鉴权出口与档位守卫 (5c2b547007)
- 🐞 修正:db_sync_scheduler 镜像日键断言注入固定时钟,消掉跨零点假红 (3169934af1)
- 🐞 修正:checkin_scheduler 补跑日界断言注入固定时钟,消掉北京零点假红 (0878a71169)
- 🐞 修正:保活腿心跳写入口改传主键 id —— 曾把 uid 当 id 用导致 heartbeated 恒 0 (52673665b7)
- 🐞 修正:checkin_api 的探针/快照/额度日序列注入固定时钟,消掉跨零点假红 (bf7811cb5f)
- 🐞 修正:archive_daily 的 today_mmdd 注入固定时钟,消掉跨零点假红 (d207c15303)
- 🐞 修正:测试侧共享固定时钟 seam —— 时钟注入收口到 conftest 一处 (1f88b304a8)
- 📚 ドキュメント:并行批认领 6 张可闭环票(wb-parallel) (ed5a85b2a6)
- 🐞 修正:探活 Client 构建失败改为可返回错误,根治 auto_refresh 启动期 panic 面 (BUG-0041) (d181c23b97)
- 🐞 修正:会话/检查点状态裸写改原子写 —— 中断/并发读曾留下截断 JSON (37f788cbe1)
- 🚀 機能/改善:供给断档拆两型 —— "政策面比票窄"与"票真的见底"从此不写成同一句话 (a8cdd5e190)
- 📚 ドキュメント:结清 RP-68 —— 未知旗标闸已落地(920e2de),按完成即删整行摘除 (123cf35b66)
- 🐞 修正:RP-68 未知旗标改 exit 2 并钉零副作用镜像(发射侧逐枚清点;四套测试全绿 + 变异自证) (920e2de4c3)
- 🐞 修正:消掉落地器复跑每轮点名的 4 条 TS2532(RP-65) (582ae3d8d1)
- 📚 ドキュメント:认领 RP-68 —— 收敛器未知旗标静默档收口 (a3108aee72)
- 📚 ドキュメント:补登 5 枚低风险单会话票,全部来自本会话实测缺口(票面供给) (a2f9ddccb8)
- 🔧 その他:落地器夹具的缺省正文过形状档 —— 那 10 枚从 11-04 起就红的用例回到绿 (866efb1d2b)
- 🚀 機能/改善:object-space-land 单实例闸 —— 并发落地从"照落"改成"顶住并说清等谁" (b101a98285)
- 🐞 修正:悬空导入门两格 —— tree 档取材集合对齐 commit 档;自测子档预算从"等于耗时"抬到落地器同一条 (392bbf70e8)
- 🔧 その他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7f4fa2ec65)
- 🔧 その他:收编停留≥3分钟的未提交改动 (bc5505294c)
- 🚀 機能/改善:RP-66 轮级终局档 —— 连续 N 轮撞自我面闸必须有名字、响一次、按串去重 (3398e6817e)
- 🔧 その他:候选层的占位行用例与文件同枚入库 —— 上一枚只落了判据没落锁 (b4e057da4b)
- 🐞 修正:隐私政策删两条被三面证伪的过度声明(Y-70 随手格) — 三面对账:①merged/packaged manifest 里 SYSTEM_ALERT_WINDOW 6 处命中全来自 prebuild 生成的 android/app/src/main/AndroidManifest.xml:10(本仓声明面 0);②pnpm-lock 与全部 package.json 及 app/build.gradle 对 getui/DCloud 零命中;③apps/mobile-rn/src 与 packages/app/src 零引用(推送走 expo-notifications);R.txt 9317 行符号对 getui|gexin|dcloud|uniapp|Gtc 零命中。⇒ 删个推公共库SDK(Gtc)与 DCloud开发通用工具库两条目(60→58 段)并摘正文 9 处归属。dex 面未判定(无 APK/AAB 且本机禁建)⇒ IMEI/IMSI/MAC/应用列表的收集披露保留(政策少写比多写严重)。prepare-store-bundle 改前 过度声明2 → 改后 unjudged 过度声明0;prepare-store-bundle.test 7/7 pass;scan-hardcoded-zh rc=0;水印完整。withPermissionPruning.cjs 只读复算证明它在真 manifest 上 removed=1 并追加 tools:node=remove ⇒ 未改。未闭环:需主控席择窗跑一次 clean prebuild 复验 manifest,docs/RELEASE.md:448 那句已摘除要等 prebuild 才成立。 (49fd8ab057)
- 📚 ドキュメント:结清 D54(手册五章真实截图,枚 b5505f0844 已入库) (e2e902026b)
- 🔧 その他:手册五章补真实界面截图与共享图注组件(D54) — 素材全部为无头浏览器打本机在线站点(8851 生产腿)实拍,共 11 张 PNG(1440x900),落 apps/web/public/images/docs/manual/;渲染走单一共享组件(src/alt/caption 三 props),既有三章(前席)未重做,本枚补 ai-chat 与 knowledge-base 各 2 张。不该有图的判定按"不为消数字塞图":ai-chat 2.6 分享、kb 4.4/4.5/4.6 公开态只有登录门或 Authentication required 空壳,无真实业务内容,故不凑数。caption 如实标注会话失效态(apps/web/e2e/.env.e2e.local 不存在 ⇒ 无口令供给、token 不能刷新,已用 auth.setup.ts 产物 .auth/user.json)。渲染复验:仓内真实 TS/React SSR 两章 + file:// 真解码,4 图 naturalWidth=1440 naturalHeight=900 complete=true(证据 .ihui-agent/tmp/d54b/rendered-*.png);eslint rc=0;水印 verify 2/2 完整(PNG 不在水印覆盖面)。未判定:线上 HTML 里 images/docs/manual 命中数为 0(含前席三章)⇒ 线上仍是 D54 之前的构建,本票交付要等一轮部署才可见,不是"改完就上线";tsc rc=2 的 4 条错全在他席 edu/attendance 文件,docs/manual 0 错;prettier warn 落在既有 kbd 行(HEAD 版与未动的 agent 章同 warn);离线夹具不解析 Tailwind 工具类,圆角合规凭据是同组件同 props。 (b5505f0844)
- 🚀 機能/改善:学生本人考勤整月视图与五语言同步(B72 web 腿,票未完保持未勾) — 三端读路径原只传 date=当日,学生看不到自己的历史考勤;本枚把 web 腿改为整月区间(端点 :2034 既有能力,零后端改动),历史月视图不摆自签按钮以免形成签的是今天的假 affordance;五语言同批补 prevMonth/nextMonth/thisMonth(check-i18n-keys 19887 键 5 语 parity OK)。仍缺:移动端入口断链与 POST /attendance/self-check-out ⇒ 票面不结清。 (75f8522c09)
- 🐞 修正:未取号占位行退出判期打分 —— 谓词单源复用到候选层 (daf63345c5)
- 🚀 機能/改善:学生本人签退端点 + 两端入口接通(B72 剩余两格) — 后端 POST /attendance/self-check-out 注册于 edu-ai-management.ts:2053,鉴权先于判据走既有 checkAuthOrInternalService、主体恒取 request.userId,selfCheckOutSchema 只收 date(无 studentId/classId/checkOutMethod/checkOutTime/status/remark ⇒ 客户端自报结构上进不了库),班级由 resolveSelfCheckInClassId 现取,status 重判单源复用 statusPreservedOnCheckOut + loadEnabledAttendanceRule + judgeStatus(零内联),响应统一 {code,message,data}。幂等偏离已登记:本端点无插入路径,onConflictDoNothing 无处可用 ⇒ 改 CAS(UPDATE 谓词带 id ∧ studentId ∧ isNull(checkOutTime) + .returning(),空集判 409,不覆盖首笔、不凭空造在场记录、不抹 remark/operatedBy 留痕)。入口:RN domain-hub.ts 教育域新增 EduParent 条目(屏内既有 navigate(EduMyAttendance) 由此可达),小程序 pages/user/index.tsx menus 新增 /pkg-user/edu-parent/index;零新文案(复用五语言已有 eduParent.title)、零新图标。越权用例断言副作用未发生:甲硬塞乙全套键后 ①写入 classId 为服务端现取 ②set 里无 operatedBy/remark ③乙行 JSON.stringify 前后逐字节相同、全局行数不变、insertValues 恒空 ④每个 where 绑定字面量含甲 uuid 而不含乙 uuid;匿名 401 另断言 reads=0 且 writes=[]。实跑:新件 13 passed,同族 7 件合跑 156 passed(两次独立跑行数不变);typecheck @ihui/api 8/8、@ihui/mobile-rn 与 @ihui/miniapp-taro 7/7 全 exit 0;门 128、nav-dead-links、openapi-check(committed 档)rc=0;prettier 与水印 verify 绿。派生态同批:generate-ui-routes 已重生成(页面 329 条,pin 随本枚更新),openapi:export 已把新路径写进 apps/api/openapi.json ⇒ 不产生 CI drift。未闭环:四端尚无签退 UI(web PageClient 是教师侧,RN/小程序自签页只有签到)⇒ 本端点当前无客户端调用方,补按钮需动前席在途文件;README 待同批(§21,本枚按令未动 README*)。 (2c421dba82)
- 🔧 その他:文档中心未知 slug 真 HTTP 404 的成对状态码用例(补三层深度盲区) (d720db2924)
- 🐞 修正:GitHub CI 事件不再被拒且先应答后处理(Y-13 Y-91) — 400 成因:events.ts 的 ciCheckObjectSchema 把官方允许为 null 的 check_suite.status 与 workflow_run 双写 sha 当必填拒收(github-app.ts:403);500(dur 10s)成因:resolveStore+hasDelivery 幂等表查询排在 CI 分支之前,一次本不处理的投递被拖到上游超时(:415/:419)⇒ CI 分支前移到零外部 IO。Y-91 长尾(p95 2217ms/max 19720ms)按票面正解:验签与 schema 校验仍先于应答,重活整段落进一次性内存队列(并发 1、积压 256、awaitWithin 到点即 deferred 不取消任务、积压满就地执行、close/drain 有终态),响应新增 dispatch:inline|async,预算 env GITHUB_WEBHOOK_RESPONSE_BUDGET_MS 缺省 500ms、0=纯异步。实跑 4 files 95 passed(注入队列+手动泵,零真实等待;401/503/400/unsupported_event 拒绝面正控未回退);eslint/prettier 绿;水印 5/5。未闭环:真实投递需上线后按 /app/hook/deliveries 重放核对;deferred 不落盘为已知持久性缺口;生效待部署。 (38542c0d15)
- 🐞 修正:未取号占位行不再当票用 —— 显式跳过并计数(主危害在判期层,已另立一手) (d9f089effc)
- 🔧 その他:考勤八枚越权与行为契约用例(B19 B21 B22 B25 B32 B34 B35 B71 B70) — 权限链走 require-permission 真身(既有 rule-crud-contract 把它整桩成恒过,权限面从未真判);拒绝臂一律断言零读零写且规则表与密钥逐字节未变并带正控;parent-child 两路径实测各自独立处理器(重复 API 面待并票)补五态归属;B70 同事务幂等落 leave 17 例。席位实跑 rule17 qrcode15 rotate8 parent25 export8 checkin6 status7 leave契约17;主控席同入口复跑 4 files 38 passed;全仓 tsc 仅 4 错且均在存量他席文件。 (8d270eb3de)
- 🐞 修正:落地悬空副本里的两枚判据 fail-closed 与跳门降级证据(RP-67) (b7aa56e7f6)
- 🐞 修正:派发前闸的"瞬时不在位"先复核再停派 —— 别席 install 重挂 tsx 不该烧掉一班 (0be42c4124)
- 🐞 修正:取票腿被击穿时的可证复用 —— 三条安全条件缺一即拒绝,且必须说出是哪一条 (43bdd603e5)
- 📚 ドキュメント:22 枚在飞票挂完整租约(HEAD 面⊕挂牌,不代他席落地) (1c4f42c0c6)
- 🐞 修正:RP-91 旁路器物未知旗标守卫收口 + 修三枚烂牙测试 (09eeb36dcb)
- 🐞 修正:健康尺 A15 同批认 cost-breaker-stop —— 新字面量不能变成"没人认领的动作" (c3076a1a36)
- 🐞 修正:清理 15+ 未用导出,exports 1755→1730 回到基线内 (a990d81aff)
- 🐞 修正:成本熔断不再冒充"日预算耗尽" —— 两种真因曾共用一个字面量 (f8213f5a4f)
- 🐞 修正:日上限计数拿本地日键去比 UTC 时间戳 —— 本地 00:00-08:00 这段窗口日上限根本不生效 (b3cb1ec26b)
- 🚀 機能/改善:出站体序列化那一刻的自查仪器 —— 把 400 的射程推到 CLI 之外 (3540974b85)
- 🐞 修正:出站清洗补上射程第三格 —— 零宽藏在工具调用参数里时仪器全程报绿 (1b62d16ce2)
- 🐞 修正:逃生邮件从来没发出去过 —— resolveMailTo 的正则少一个 m 档,还反指控"缺键" (fdc0253f83)

**2026-11-05**
- 🐞 修正:相对路径逃逸用例切盘根执行,消除 DevEnv 下假红 (2a333988c7)
- 🐞 修正:内部票优先收尾 —— 清掉最后一处旧密钥开关并加配置矩阵 (3b14d759f9)
- 🐞 修正:消灭内部调用无凭据退化成裸 x-user-id,并加静态判据门 (3cfb981dc8)
- 🐞 修正:内部服务鉴权默认收口到 ticket,老通道身份头强制签名 (32cf59c6f4)
- 🐞 修正:重发 tenant RLS batch1 为幂等装车迁移 + 回滚脚本(F-01) (2725de663d)
- 🐞 修正:请求出口复位 app.* 会话变量,闭合池化连接串租户(F-02) (ad4828bf26)
- 🔧 その他:落地 pre-commit 自动格式化(仅折行/合并,无逻辑变化) (a9a727aada)
- 🐞 修正:内部票补齐 CSRF 非消耗式验签与 codebase 路由入口 (fc0e93c32f)
- 🐞 修正:判据 3 收严为声明锚定 + 全集相等,补反例 (b84737901b)
- 🔧 その他:修正白名单切片定位到常量声明处 (9a302a22fb)
- 🔧 その他:对齐 generate_handler 新增行缩进 (f3c5e6ce68)
- 🐞 修正:收紧 store 权限并以白名单命令守卫 AppData 路径(P0) (ebf13da07b)
- 🔧 その他:复现 plugin-store 绝对路径与 .. 可越出 AppData (9eeef21360)
- 📚 ドキュメント:更正三枚提交的 BUG 编号错标(历史不改) (1e764cfaa7)
- 🐞 修正:注册路径改由仓库推导,找不到启动器即失败 (30c2909c1f)
- 🐞 修正:pre-commit 捕获输出设 64MB maxBuffer,大输出不再假红 (b2024d7c9b)
- 🐞 修正:check-dedupe 取材失败改为 exit 2 未判定 (2e73c1d252)
- 🐞 修正:密钥扫描失败不再被吞成假绿 (5a01a9d31d)
- 🐞 修正:cleanupWorktree fallback 删除前补 realpath 二次断言 (7e42c045b2)
- 🐞 修正:低层 worktree 显式 withinRoot + 只读侧根内断言收口 (3a4c395a72)
- 🐞 修正:A 组 11 处同族路径入口统一收口到 path-guard (8856de986d)
- 🐞 修正:插件安装侧对 manifest.name 过同名白名单与安装根目录断言，与卸载侧同解 (32f83468e8)
- 🐞 修正:计划文件路径对会话 id 收敛并断言落在 .ihui 内，堵住 plan-<id>.json 穿越 (96a3fcabca)
- 🐞 修正:检查点/hunk 目录段收敛与根内断言收敛到唯一实现 util/path-guard (8c0b9bc075)
- 🔧 その他:回归测试夹具导入补 arch-exempt 注解，清掉新增架构门判红 (26d11f8e86)
- 🐞 修正:会话/检查点 id 收敛单段并断言根目录归属，堵住 --resume/--session/delete 路径穿越 (4afe993f70)
- 🐞 修正:/share 先转义原文原始 HTML 再净化 marked 产物，堵住 BUG-0003 存储型 XSS (38168ba109)
- 🐞 修正:插件卸载前校验名称白名单与根目录/符号链接归属，堵住 BUG-0002 任意目录递归删除 (363db07fcc)
- 🐞 修正:非原子写改原子写 + 文件句柄收进单线程闭环 (560fce1e3f)
- 🐞 修正:线程安全收口——git/.gitignore 串行锁、原子写、行为用例自隔离 (b68ed3b522)
- ⚡ パフォーマンス:治理 async 链路同步阻塞调用(文件IO/子进程/DB 边界清单) (8909847004)
- 🐞 修正:修复工具循环第二轮 NameError 与语雀连接器事件循环阻塞 (cf2f0b3ff0)
- 🐞 修正:语音取消后不再上传回填，并补齐 StreamingRecognizer.configure (8101105f0c)
- 🐞 修正:恢复下载详情页组件引用，解除 TS2307 构建阻断 (16ad92b709)
- 🐞 修正:无派发收尾的措辞与真实原因同形 —— 已落地跳过不得记成白名单问题 (bd10cbee66)
- 🐞 修正:已落地的票不再重派 —— 落账成功后票行还开着,重派的产物是第二份近似测试 (e30f32ce85)
- 🔧 その他:给「新增未跟踪文件能否落地」补端到端锁 —— A13 此前只是假设 (d3dd6e13c3)
- 🐞 修正:工具失败原因进转录与事件面 —— 自主班次此前只能看见"✗ + 空正文" (8c1cf02cc9)
- 🐞 修正:glob 的 **/ 编译被自替换毁成恒不匹配 —— 自主派班会话整班零写盘的真凶 (df789c297d)
- 🐞 修正:票面指纹改量被审面 HEAD —— 工作树滞后副本让 8 枚新登记的票进不了候选面 (3aff8c62b1)
- 📚 ドキュメント:补齐 B71 拆票余下 3 条考勤端点为独立票(池量不足即如实拒发,不留散文里的丢工作) (8152fd5aa3)
- 📚 ドキュメント:把 B71 收窄后剩下的考勤端点逐条登记为独立票(先落 5 枚,B 池余量已到两位数硬上限) (87b2bf5211)
- 🐞 修正:上游间歇性拒绝不得记到票的连败上 —— 中转的"请求包含不合法字符"归 transport (f2cb429991)
- 🐞 修正:keepZwj 档不再免死孤零 ZWJ,自查加 zwj 格 —— 仪器与判据同盲一格的那次假绿 (e68cd53ba0)
- 🔧 その他:收编停留≥3分钟的未提交改动 (e29acfbd2f)
- 🐞 修正:生成器只再导出不 import ⇒ planFaceDigest is not defined(自我修复这一维时把它砸了) (f4975f2dc7)
- 🐞 修正:缺票面指纹的旧候选档也必须重刷一次 —— 让这一维自愈,不等 6h 钟表 (1c6b257f1a)
- 📚 ドキュメント:B71 收成单会话可完成的一张票(只做 /attendance/export 的成对与越权用例)—— 真票面连班 20 次调用零写盘的量法修正 (8ab3a2ef82)
- 🐞 修正:候选新鲜度按票面指纹判,不再只按钟表 —— 改写过的票 227 分钟对环不可见 (bf1a16e903)
- 🚀 機能/改善:apiRoutes 按语法证据识别 Fastify 接收者 —— 4685 → 4813(+128) (6328514264)
- ♻️ リファクタ:回调页转义收敛到 shared escapeHtml(产出字节不变) (20ee1255de)
- 🔧 その他:派发档换成实测会动笔的模型 —— 20 次调用零写盘 vs 一次成功 write_file (c73e9ccd06)
- 🔧 その他:收编停留≥3分钟的未提交改动 (dc131ab382)
- 🔧 その他:补收两处并行会话探针残留落点(miniapp probe-tmp 目录 / e2e tagsview 调试脚本) (8aa7240c52)
- 📚 ドキュメント:数字改动收窄到门明确报的行 —— 回退门盲区批量改写，未判定行登记保留原文 (4e9e144633)
- 📚 ドキュメント:四语 README 数字按现算收口 —— 618 表 / 4685 路由 / 4057 测试文件 / 53 CI workflows / 334 道守门 (2be4008892)
- 🚀 機能/改善:出站自查再加一格 extra= —— 把"带毒段在 messages 之外"变成可读数而非猜测 (ce4cf44fde)
- 🚀 機能/改善:出站载荷自查仪器(IHUI_TRANSPORT_AUDIT)+ 更正上一枚的过度归因 (92e61ba98d)
- 🐞 修正:结清凭据按主键条数差算,不按逐字消失算 —— 治"合法改写被记成正当摘除,5 分钟后活票被真删" (1db0b5037d)
- 🐞 修正:出站清洗覆盖全部角色(非 tool 档留 ZWJ)—— 第 14 轮的 400 证明载荷不只住在工具结果里 (4ef8089d5a)
- 🐞 修正:让位无处可让即扣住该票 —— 治"同一枚空转票吞光整天的派发预算" (b481a027eb)
- 📚 ドキュメント:B71 票面就地改写为现读剩余射程 —— 归属成对用例已落地,9 条路由仍无行为用例 (7ad03584a9)
- 🔧 その他:收编停留≥3分钟的未提交改动 (2b5f58a4b8)
- 🔧 その他:日预算 9→10 —— 机主那条授权要的是"验一次端到端真产出",而 9 枚全烧在未修成因上 (a85b530efd)
- 🐞 修正:派单工序补第 0 步"第 1 轮就发出工具调用" —— 同权限档对照量出来的 (a41476316b)
- 🐞 修正:派发模型改由闸门声明并写进命令行 —— 不再靠子进程继承哪个 HOME (6ab3ab37c4)
- 🐞 修正:出站消息表剥 tool 档零宽载荷 —— 治"自治会话读了水印第枚文件就自毒" (efff5023bb)
- 🐞 修正:流期间工具卡渐进渲染可见性根因修复与 E2E 转绿 (bd3ea05c78)
- 🐞 修正:推送类器物补用法档,并修 sync-tags 既存死器(一跑即 ReferenceError) (9926b5d4fe)
- 📚 ドキュメント:B71 的释放注记移到行尾 —— 让票类词回到匹配窗口,机主授权的"按票类登记"那一半 (65173065c3)
- 🔧 その他:日预算 6→9 与「测试/质量」两档 —— 机主授权面落地并写明边界与回落 (52e885f1d0)
- 🐞 修正:范围预解析认点号成员引用与裸点文件 —— 补 P84 暴露的仪器盲点 (21b60c5792)
- 📚 ドキュメント:P84 结清即删 —— 五条判据实跑绿,并收口我此前两次的错归因 (50cfd20ab2)
- 🔧 その他:二分定位渐进渲染浏览器缺口到消息投影层并显式登记 (b271803ad4)
- 📚 ドキュメント:P85 结清即删 —— 五条判据逐条实验通过,不是"看起来像做了" (301f820942)
- 🐞 修正:补用法档 —— 这枚的默认档是真推 origin,手滑不该动共享状态 (d016326e7c)
- 🐞 修正:自愈器的手滑档降到只读 —— 敲错旗标不得按"真恢复"写他人现场 (3a9ebdf90f)
- 🚀 機能/改善:停派时把"池里还剩几张打得赢的票"记进账面 (1425f4e83f)
- 🔧 その他:补交成本熔断改桶的写盘腿夹具 —— 两枚测试件此前悬在工作树未入库 (e5b1185b72)
- 📚 ドキュメント:RP-66 按现读证伪结清 + RP-94 分叉数字第三次现读更正 (e6e10f22a7)
- 🔧 その他:tool-call-args-delta 浏览器真跑改造并显式登记渐进渲染缺口 (a0d5602215)
- 🐞 修正:无头会话的 tools 广告面按同一个权限判据过滤 —— 不再摆结构上执行不了的墙 (b3229add9d)
- 📚 ドキュメント:作用域行不再写死盘符 —— G:/IHUI-AI 是另一台机的现状,代价已被量到 (f8142e97c2)
- 🐞 修正:空转阶梯改按行分档 —— 毒票不再被"零推进的结算"每轮归零 (cdb8b1780a)
- 🔧 その他:推进文档自动更新水位（生成器写入） (5101d61871)
- 🔧 その他:按 --snapshot 重生成本机服务快照并更新仓内引用面 (f0b4a9df44)
- 📚 ドキュメント:§8 逐条二次复核补 CLOSED/OPEN 标注并保留旧读数 (34ec998472)
- 🔧 その他:重生成中文压缩包（zh-cn-pack.gen.ts） (9a1bdb6905)
- 🔧 その他:重生成远端语言包压缩体（remote-locales.gen.ts） (69aba4e4f5)
- 🔧 その他:重生成远端语言包清单（remote-locale-manifest.gen.ts） (1c7f85e8b9)
- 🔧 その他:重生成小程序远端语言包压缩件（zh-TW.b64） (15341d2537)
- 🔧 その他:重生成小程序远端语言包压缩件（ko.b64） (07375a618d)
- 🔧 その他:重生成小程序远端语言包压缩件（ja.b64） (28597ceb9b)
- 🔧 その他:重生成小程序远端语言包压缩件（en.b64） (f7c9a81139)
- 🐞 修正:小程序词包补齐源码已引用的 4 枚键并摘除无引用键（zh-TW） (8421f44509)
- 🐞 修正:小程序词包补齐源码已引用的 4 枚键并摘除无引用键（zh-CN） (c3313db9e0)
- 🚀 機能/改善:工具入参逐分片渐进渲染全链路收口（埋点/断流兜底/E2E） (105315ff86)
- 🐞 修正:执行器补 --help 档与未知旗标拒绝 —— 并收下生产真传的 --once (d911f93957)
- 🐞 修正:小程序词包补齐源码已引用的 4 枚键并摘除无引用键（ko） (1f3e6254c0)
- 🐞 修正:小程序词包补齐源码已引用的 4 枚键并摘除无引用键（ja） (8b11b6351a)
- 🐞 修正:小程序词包补齐源码已引用的 4 枚键并摘除无引用键（en） (82745a6358)
- 🔧 その他:暂存删意图形状锁改锚 scoped reset 后的读缓存 (438eea21ba)
- 🔧 その他:SC9 锁 scoped reset 且不得退回全局 reset (3455f0b2f0)
- 🔧 その他:载荷等值锁改用 expectedForPayload 与文件数文案 (b7db67d784)
- 🔧 その他:no-auto-skip 的 scrub 增加 scoped reset 归一 (b4dce7598a)
- 🔧 その他:dry-run 期望改为 scoped reset 与 fail-closed 文案 (f980b01865)
- 🔧 その他:载荷归属断言改锚 launchCommitWithHooks/commitArgv 真实调用点 (1dfbfc8400)
- 🔧 その他:把 push 档点名的 6 处裸奔派生补上显式 stdio —— 清 blocking 存量 (6ada741b41)
- 📚 ドキュメント:追加 3.5.2 激活收口记录(agent 工具循环逐分片直推实际打通) (874b074ad5)
- 🚀 機能/改善:agent 工具循环开启逐分片直推,tool-call-args-delta 端到端透传 (89af54537b)
- 🚀 機能/改善:派发那一刻把查得到的事实交给会话 —— 范围预解析 + 仓根现读 (157a5fffc3)
- 🐞 修正:接上盘上真存在的 ripgrep —— 派发会话检索假阴性的病根 (ab554f1a36)
- 🔧 その他:全量档未判定四点实证入库 —— 实测不是缺口,classifyWorktree 不构成第二个失败点 (2e949dc67a)
- 📚 ドキュメント:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (1efb7656fe)
- 🔧 その他:补齐 12 处 watermark 注入,纯水印对齐无逻辑变更 (7d8e8f97fb)
- 📚 ドキュメント:登记取票口 79-170 秒为环第一瓶颈(超时已止血,优化须先出剖面) (653c3f78ea)
- 🐞 修正:取票口超时按实测抬到 300s —— 120s 在忙时段必然击穿,环整天拿不到票池 (eed6765dd4)
- 🐞 修正:深档取材失败改为逐路径「未判定」+ exit 2 —— 未判定不再整轮上抛,也不折绿/折红 (5fe681420a)
- 🚀 機能/改善:两项可选增强端到端贯通 —— 工具入参逐分片直推与 ToolCallCard 渐进渲染 (0d064fdc5f)
- 🔧 その他:补 ⑯d 锚点表接线锁 —— 读错文件即翻红,夹具不再绕过接线 (10c65b235b)
- 🐞 修正:自我面闸读错表导致环长期停派 —— 锚点表改回 autonomy-invariants(与门 299 同一份) (507043ad17)
- 🐞 修正:私有 commondir 直指最终公共目录 —— 修复 linked worktree 下 commondir 叠层致 non-repo (15c0db977e)
- 🚀 機能/改善:把环自身(执行体/熔断判据/上限闭集)列入受保护面 —— 派出的会话改坏环自己从此被拦 (ce5d42877c)
- 🐞 修正:窗口截断文案拆成 R1 深档/R1r 浅窗两侧(判据零改动) (42d4d8f79f)
- 🐞 修正:改桶写盘腿两处自伤补修 —— writeFileSync 未 import 与 Date.now() 当字符串用 (217f134f25)
- 🐞 修正:R2 文档面扩到 docs/GATEKEEPERS.md,补回速查迁移后的接线声明射程 (3e14a876c2)
- 🐞 修正:腿断班次改记 session-blocked 桶 —— 环境故障不再吃光生产额度(历史可证行按同一判据改桶) (1ade2dcfb6)
- 🚀 機能/改善:新增 --list-covered <file> 落盘 pathCovered 全量(默认关闭,供人工对账) (f95050275d)
- 📚 ドキュメント:RP-93/RP-65 结清摘行(执行体残骸已保活复原 A14 转 OK;A15 覆盖面维已装) (049ac701ea)
- 📚 ドキュメント:登记两枚 lib 在飞判据唯一副本须归属席处置 (bf93b94f7d)
- 📚 ドキュメント:RP-93/RP-94 改为本席实测值(blob 号按内容锚点书写,不占指针位) (31dc10d352)
- 📚 ドキュメント:登记 A14 轮级死亡机制工单(前置写明被 RP-93 挡住) (3263c31bd7)
- 📚 ドキュメント:RP-94 分叉读数改当次现读(359/175 非 ff,引用锁异常已自愈) (f7f4d4c14c)
- 🔧 その他:停用 lost-commit 自动增长产线，开放清单摘除开关 (ecd93149b9)
- 📚 ドキュメント:RP-94 挂分叉逐块裁决交接件(含 ref 存续前置) (17a85b34f3)
- 🐞 修正:健康尺子的四类盲区改为到人 + A7 提交证据补配对 —— 瞎掉比报红更危险那一格 (11245ffa14)
- 📚 ドキュメント:RP-64 补批次件指针与当次读数(追认与重签两档分列) (da51c0bd17)
- 🐞 修正:A7 闭环合格线补"绑票键的提交"一档 —— 已落账未推进不再算成会话没干成 (459d373dd0)
- 📚 ドキュメント:RP-65 结清摘行(巡检 breach 行已逐枚带判别码) (3799dfcece)
- 🐞 修正:判据面巡检 breach 行改逐枚带判别码(RP-65)—— 不可复现的指控事后无从定位 (a4924791a3)
- 📚 ドキュメント:登记巡检日志缺逐枚判别码(不可复现指控事后无从定位) (81afd0ea30)
- 🐞 修正:发起腿断裂改按结构分型 —— 乱码不再把无辜票烧进连败 (d13019ecb8)
- 📚 ドキュメント:登记判据面追认积压挡住推送门(出口=持钥方逐枚 --ack) (c8c898c2bc)
- 📚 ドキュメント:更正批量档立因里的预算口径 —— 300 秒是自检档,推送腿预算是 900 秒 (9006e06821)
- ⚡ パフォーマンス:判据面审计三张批表 —— 323 枚区间 400.6 秒→21.4 秒(判定逐字等值) (049c49cc43)
- 📚 ドキュメント:RP-92 结清摘行(判据面审计三张批表落地,区间 159 枚 26 秒,等值锁 ST57a-h) (ca85efbdc9)
- 🐞 修正:受保护面申报预检提到提交通道这一层 —— 不再让"只报不拦"的预警被 || true 与 tail 截尾吞掉 (08180f598f)
- 📚 ドキュメント:给上一枚三行补上取号器实号(RP-92/93/94)—— 整行唯一差异就是在声明位插入编号+一个空白,主键/租约/归属三维其余逐字不变 (ae2f92b54d)
- 📚 ドキュメント:摘掉本席上一枚未展开的取号令牌字面量(取号族我写成了 RP-,工具只认 RP ⇒ 令牌原样入库);本轮只做纯删除令牌,主键/租约/归属三维逐字不变 (8bc1dbd4a9)
- 📚 ドキュメント:登记自主环三条未闭环项为可派单工单(审计批取剩余三处 / 盘上旧基线执行体收口 / 真分叉 10 块逐块并集) (08b0a07885)
- 🔧 その他:落账腿第一次端到端装车证明 —— 真清单 + 真 isolated-git ⇒ 产物字节进 HEAD(3/3,含两格反向) (368cd1faac)
- 🐞 修正:自陈述版本只看**本进程 import 闭包**——判定面从 1054 枚收到 48 枚,不再为无关字节重启常驻守护 (36537b1ee8)
- 🚀 機能/改善:立 A14-executor-face-stall —— 自我面闸"一直停派"从此是响的,不是安静的 (e667f74331)
- ⚡ パフォーマンス:批档一次读齐父辈/标题/正文 —— --range 30 枚 86.6s→72.2s,判定逐字未变 (dbfbd6a67a)
- 🐞 修正:同秒 D/D 并列收窄为可判定,3b 未判定项不再被悬空档整体赋值抹掉 (2a546f0a49)
- 🔧 その他:分型改向后给冤封尺补成对锁 —— 同一句诊断文本,终态不同判果必须不同 (7f6a66869a)
- 🐞 修正:会话终态分型不再被一行诊断劫持 —— rc=0 的成功会话曾被记成"发起腿故障"(41 条) (9527854274)
- 🚀 機能/改善:立 A13-artifact-landing —— 自治环"跑了十天、一枚没落"从此在账面可见 (ddc189399f)
- 🔧 その他:正文形状闸带出的 8 格假红收口 —— 夹具正文改 conventional,真话提前说的那一层如实记 (b256cc2abf)
- 🐞 修正:补回 safe-commit-dry-run 测试的零宽载荷 —— HEAD 面欠账清掉一枚(新档的第一个生产用例) (ff610fb729)
- 🐞 修正:载荷复核不再恒真(scratch 探针 verify 覆盖 0/0 也报绿)+ 给"基线整条载荷缺失"补一条落地出口 (9b2f1246ac)
- 🐞 修正:3b 分档拆开「有未覆盖路径」与「merge/空提交」—— 缺口读数不再被无改动路径的合并提交灌水 (595bdd1a6d)
- 🚀 機能/改善:lost-commit tag 直接指向的提交纳入逐路径覆盖 —— 让『已备份但缺口仍在』不再失明 (eba3125860)
- 🚀 機能/改善:派发前核验"我跑的这份是不是今天的"—— 自我面闸(不拿半成品当执行体) (abc1a72b90)
- 🐞 修正:门299 的面名从 selectFace 的 .face 取 —— 读数里那个 [object Object] 其实是 --staged 失效 (95a7653212)
- 🐞 修正:密钥句柄不再可枚举 —— 一次整对象打印就会把签发钥送进记录 (85d1d00dd9)
- 🐞 修正:事后核验与索引推进挪到放锁之后,并输出锁排队读数 (5c3465f85c)

**2026-11-04**
- 🔧 その他:补齐 8 枚 HEAD 面缺载荷的溯源水印(门47 push scope 欠账) (86958e1b20)
- 🐞 修正:同秒并列的删除判定改为未判定——git log 先到者不是拓扑结论 (ad8bf319a0)
- 🐞 修正:拒绝建「静默零钩子」树 + 建后复核 + list 标红 (92b9a21635)
- 🐞 修正:v2 签名钉住签发 base 与路径内容号，HEAD 前移不再把合法提交判成 sig-invalid (f1724e53dc)
- 🐞 修正:R3 更正 —— 健康尺补 A12 头注并补发判据面声明 (3c898b3c1f)
- 🐞 修正:停用隐式 COMMIT_EDITMSG 消息通道,防止把别席在途标题读成本次理由 (9f85df84cf)
- 🐞 修正:其余落地器补本席消息上下文与 subject 回读自证 (5bc180e29a)
- 🐞 修正:isolated-git 改用本席私有 GIT_DIR 与消息文件,根治共享 COMMIT_EDITMSG 并发串号 (9ceae5b21a)
- 📚 ドキュメント:§8.4 磁盘读数改为两次测量差值 [+59,669 B / 0.004%,对象库共享] (6676566e3d)
- 📚 ドキュメント:校正挟带口径并补通道可靠性/混态/磁盘实测 (bee478bedf)
- 🐞 修正:R3 全腿产出对账尺 A12 + 修 dep-radar 采集输入面 —— 12 腿按 always/conditional/none 分类对账(防恒红门)、pnpm audit 显式净化代理 env、空 stdout fail-closed、修 liveness ruler 笔误 (ca665ca6ed)
- 📚 ドキュメント:§7 失败分型补 lock/other 的实测含义 [已核对本次 40 笔读数] (397d6cf705)
- 📚 ドキュメント:§0.1 补 22:49 复核基线,§7 换成两次运行的漂移读数 (24545835cb)
- 🚀 機能/改善:land(ff-only) 回主线 + 共享树/隔离树并发压测 (6994aadf9f)
- 🐞 修正:LAND_MSG 支持 @<文件> 并拒「路径当正文」,落地后自检判据面声明 (b9f5cbbf61)
- 🐞 修正:D 类判据收紧——只认「同 old blob 且是该路径最新状态」的删除记录 (09f2d95b10)
- 🐞 修正:追认改用独立 a2 追认钥,关闭作者自认 (478dc9e9e4)
- 🔧 その他:新夹具文件补齐投递水印(水印腿在首次提交后落的尾注) (9ef8d9ce2d)
- 📚 ドキュメント:校正回灌门头注的实测口径 —— 两段在位区间按实测写准 (1c3d44d4bc)
- 🐞 修正:门52 补「options 收进变量」那一维 —— 拆掉正在咬全仓的恒红门 (b677b5b30d)
- 🐞 修正:私有索引提交统一后置推进共享索引(治 MM 回灌) (4e38ff0dbe)
- 📚 ドキュメント:速查表迁入后修正两处指向 —— 新增门流程与相关文档改指本文 §10 (8898e9c0e6)
- 📚 ドキュメント:守门速查正文按迁移档摘除(全文已在 docs/GATEKEEPERS.md §10) (9b987c50d9)
- 📚 ドキュメント:守门速查迁出后留指针 + 三条不迁硬约束 + R4 门名点名 (25104681e2)
- 📚 ドキュメント:守门脚本速查全文自 AGENTS.md 逐字迁入 GATEKEEPERS —— 腾体积不改条文 (2f3471c297)
- 🐞 修正:回灌门改判'本次新增行' —— 整份快照对照面的结构性假阳 (fb2ed7ca5d)
- 🐞 修正:门 30a 远程 tag 档显式发起但取不到时改判未判定(exit 2),补必失败夹具 (d248166a20)
- 📚 ドキュメント:新增判据 19 归属三态与禁令 19,修正红线 C 举例 (ebb357b4e8)
- 🐞 修正:R2 治「我量不动」被读成「没推进」—— git 派生预算解耦 + 未判定失败分型 (b5e8db1ef1)
- 🐞 修正:i18n 输入一变,离线包产物提交时强制重生成 — 补齐钩子腿缺失的执行体 (4dd65789da)
- 🐞 修正:hook-markers.jsonl 按大小轮转且并发写不写坏,读侧跨代拼接不丢行 (9d94bc556c)
- 🐞 修正:门 30a 判据改造落账后的具名追认(67ed343d2c) —— 并发 COMMIT_EDITMSG 覆盖致消息缺失 (c230cb4781)
- 🐞 修正:开工期 guard 失败留痕 + 轮次记录提前填 (eb9446a768)
- 🐞 修正:pre-commit 失败回显从末 40 行改为末 200 行,避免真因被截 (bfa77e93d9)
- 🐞 修正:pre-commit 失败回显从末 40 行改为末 200 行,避免真因被截 (67ed343d2c)
- 📚 ドキュメント:补录 live-doc 旁路落地的后置核验留痕 (ee4cbe42af)
- 🐞 修正:开工期 guard 失败留痕 + 轮次记录提前填 (26bc403762)
- 📚 ドキュメント:禁令 16–18 并入 §7 单一名单位置(1–18) (b77c66959e)
- ⚡ パフォーマンス:三处 for-each-ref 改用 %(refname) 并本地剥前缀，消除短名 O(n²) 消歧 (71d37ea29c)
- 🐞 修正:健康尺与候选仪都认识 session-no-write,并把取样器的赋值形态盲区补上 (d836c65189)
- 📚 ドキュメント:同步计数为 18 判据/18 禁令并接入收口核验 (5af5c3daa0)
- 📚 ドキュメント:补录私有索引提交残差与定版边界(判据 17–18/红线 C) (5599fd8a30)
- 🔧 その他:离线包按 HEAD 面重生成落地(私有索引档)—— 清偿 miniapp-taro/ko.json 与 shared/zh-TW.json 两枚输入漂移,G5 自述钉回归 455aaebe (ed583dec29)
- 🐞 修正:git-private-index-commit.sh 失败臂补 lost-commit 备份（只备份末枚） (5d9580e74e)
- 🐞 修正:恢复档 CAS 输家臂补孤儿备份（只备份末枚） (4348769fe0)
- 🐞 修正:收回逐轮 lost-commit 打点，只在最终失败出口备份孤儿 (cc3bb7999c)
- 🐞 修正:定版索引上界改为按索引推导并走未判定 exit 2 (f78993c8d6)
- 📚 ドキュメント:补齐 AD/MM 三值清理判据与 R/T/U 越界识别 (a000fe08cf)
- 🚀 機能/改善:新增 app-probe-stall 维 —— 宿主 git 探测一次超时后反复重放同一条卡死记录且不自愈 (11049999a3)
- 🐞 修正:封住私有索引定版回灌与 sh 层误挡 (2781111c26)
- 🔧 その他:补私有索引空派生集/漂移复原的 ENOBUFS 回归用例 (c26906358b)
- 📚 ドキュメント:新增共享索引残留处置 playbook(四型识别/三条清理判据/私有索引通道) (e4acfb21de)
- ⚡ パフォーマンス:纯 oid 直达分支,恢复迁移带来的 2× 回退 (4716206cd0)
- 🐞 修正:封住私有索引上下文丢失与派生腿申报缺口 (ffda30adcf)
- 🐞 修正:门198 盲写棘轮清偿 —— qrSecret 轮换与 attention 镜像改为先取现值、真变化才写 (f5a6531081)
- 🐞 修正:删 miniapp-taro ko 独有 2 枚野键(零引用,曾被 8e030/c0f64 清偿) (4dc42b0307)
- 🔧 その他:门 30a 补 --self-test 端到端自检(13 例,正反成对) (b83bdf0652)
- 🔧 その他:补齐 isolated-git 的派生申报依赖文件 (dd18e2c2c2)
- 🐞 修正:清门83/218 — 品牌底配对前景 + 移除硬编码 hex(6 文件) (25fc0f8e04)
- 🐞 修正:门281 主树解析不得用调用目录顶替 (3e122f1dd6)
- 🐞 修正:isolated-git 撤回上一枚夹带的他人半成改动 (dc2a11c693)
- 🔧 その他:修复门7依赖碎片检查:锁文件去重并识别 pnpm 干净收尾 (37c026f9fc)
- 🐞 修正:补回 swap-fail 闭环并立 A11 产出型量尺 — 部署决策 action 收口单一真源、摄入器逐行剔除+固定桶幂等、量出腿在跑却零产出 (13ea7501bf)
- 🔧 その他:\IHUI-AI\.ihui-agent\tmp\goal-autonomy\commit-msg-no-write.txt (0bb7078119)
- 🔧 その他:补齐新增同步工具与文档的溯源水印 (b510b8f612)
- 🐞 修正:check-i18n-parity 实装 --target 并真判红 (969b8ecb67)
- 🚀 機能/改善:prod-bundle 运行副本同步工具与门 104 修复通道 (ebc8d8c832)
- 🐞 修正:checkin-batch-gate 两枚 .ps1 补齐 UTF-8 BOM(门 265 HEAD 面销账) (2f3c02d6ee)
- 🔧 その他:补 4 道 pre-commit 元门的 --self-test 自检档(95/236/292/16c) (6f80aba3b5)
- 📚 ドキュメント:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (f4ae37374e)
- 📚 ドキュメント:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (1d17fa01d0)
- 🐞 修正:取材面改走 git 索引,收紧 9 条失效基线 (b36c307eee)
- 🔧 その他:仓根补齐 .next[.-]* 变体忽略规则（与收编器 EXCLUDE 语义等价） (f39a65a34b)
- ♻️ リファクタ:git 派生收口到取材层,face-reader 棘轮去红 (47d9f43fe1)
- ⚡ パフォーマンス:门242/243 逐文件 git show 改整面批取,242 736s→5-6s、243 458s→9-11s (801e5aa4ef)
- 🐞 修正:shared/zh-TW distribution.plan.rule1 用繁体「傭」 —— 门 2j-shared 简体残留结清 (9093adf849)
- 🐞 修正:verify-deploy-facts.ps1 补齐 UTF-8 BOM(门 265 HEAD 面销账) (1db60d99fb)
- 🐞 修正:--self-test 严格识别并只跑门自检档,未知参数 exit 2 (0b5ec52e1f)
- 🐞 修正:dry-run 关闭 git 可选锁,杜绝索引 stat 刷新落盘 (a8ae241426)
- 📚 ドキュメント:门50 镜像测试 X7 标题跟随面改造 (d1138b817c)
- 🐞 修正:safe-commit --dry-run 改为全路径只读预演 (ec34967546)
- 📚 ドキュメント:AGENTS 等体积压缩并补登「工作流/部署脚本死引用」点名行 (5adf825916)
- 🐞 修正:门50 射程扩到全部 tracked 文件(HEAD 面),收编器排除 .next 全变体 (7552ed92ba)
- 🐞 修正:修正生成器溯源路径常量，使产物标签与横幅一致 (522d2dfb36)
- 🐞 修正:monitor-trust 出路改成「先 token 重建再谈关档」—— 本机实测关 fsmonitor 把 status 顶到 5.7~6.2s(超消费者预算) (f43a81aa1d)
- 🚀 機能/改善:新增「工作流/部署脚本死引用」只读门(298),补 working-directory 与回滚态判据 (8f8adbfa78)
- 🐞 修正:门 91 补齐 12 处缺失 colorScheme 并显式接线 2 处收藏壳 (3e159cc5cc)
- 🔧 その他:next-env.d.ts 停止引用已死 .next-e2e-perf 变体，回到 ./next/dev 规范引用 (c30b6e44dc)
- 🐞 修正:web/taro 派生钉按 HEAD 面重生成 —— 修 inputsSha256 滞后(门105 G5 stale→matched) (8781bbaad8)
- 📚 ドキュメント:accel-live 两路读数与「例数一律现读」—— 消掉会腐烂的自检计数 (91c6820b87)
- 🚀 機能/改善:签到批次执行中推迟重启 ai-service(上限 900s,fail-closed) (da7506747c)
- 🐞 修正:两处「体积/窗口护栏把没扫写成扫过」的漏报 —— 桌面端明文门 400 字符窗口、trae 审计 12MB 静默跳过 (9fb0b6d11a)
- 📚 ドキュメント:补回一键级联入口硬性条款并压缩AGENTS归档注释,门207回预算内 (adc3e8766a)
- 🔧 その他:棘轮判红时逐命中教改(附可复用批取入口) (72df2cf539)
- 🐞 修正:串行门补硬超时,卡死门以未判定收口 (f71043eb7c)
- 📚 ドキュメント:校正实测读数并记录主树共享索引 AD 残留 (74357b4d7e)
- 🐞 修正:日预算闸是死的(它在数一枚再没人发射的 action)+ 把"发射集 ⊆ 分档集"上锁 (3bdb7bc65a)
- 🚀 機能/改善:新增隔离工作树一键开关收工具与切换文档 (b621533999)
- 📚 ドキュメント:收口门89点名与门207体积,迁移grafana旧脚本名 (5bb3c7de28)
- 🐞 修正:--staged 面 git grep 的 --cached 归位,该面不再恒未判定 (a3a24e40f2)
- 🐞 修正:accel-live 改按索引扩展块倒剥 + git 自测第二路读数 —— 旧 64KB 尾窗把生效读成假 drift (dcea7b738b)
- ⚡ パフォーマンス:251/244 两道门由逐文件派生改为整面批取(251 >15min→4s,244 >17min→31s) (087f976e6f)
- 🚀 機能/改善:逐门进度日志追加 scope/stderr/runId 三字段（旧行兼容为未标注） (d40b90fdf4)
- 🔧 その他:grafana 旧族最后两枚退役,head→HEAD 归一迁入 check-panel 接线门 (dcf2b8168b)
- 🔧 その他:摘净回潮件 assistant-release-upload.yml (dd399bff94)
- 🐞 修正:门 288 两处新增漂移收口 —— UserInfoCard 载体形态差异/VideoPlayer 回调命名对入语义等价表 (6ca6b82706)
- 🚀 機能/改善:A6 改为按当前规则表复算覆盖率 —— 历史 25 条 unknown 里真盲区只有 2 枚,现已具名归人 (e16299f137)
- 🐞 修正:摘净 desktop 商店图标与 share-intent 死副本 11 枚并登记退役锁 (f33872b568)
- 📚 ドキュメント:§12i 补② 钩子格式化会被私有索引快照复原，提交前须自跑格式化 (d7c81497ad)
- 🔧 その他:新增 gates-full.yml 全量门交 CI(PR/main push 自动跑 331 门) (ff4496fe49)
- 🐞 修正:isolated-git 私有索引加内容级护栏,lint-staged 灌回内容即按快照复原 (95c87e0437)
- 🚀 機能/改善:git 探测余量哨兵补 accel-live 维(账面启用≠真生效)+ AGENTS 门207 体积债第七批清偿 (98d7637b4b)
- 🐞 修正:grafana-* 旧族退役 6 枚并登记退役锁,门 220/222 改指 panel 真值面 (ed0bf2fedc)
- 📚 ドキュメント:§12i 补受保护面签名纪律——标题定稿先于签发，改标题即签名作废 (9d854bd237)
- 📚 ドキュメント:staging-snapshot 注释两处 §20 漂移改指 §12i 私有索引通道 (8bc0584d83)
- 🐞 修正:sig-invalid 不再被说成"窗口到期",并加签发留痕回查 —— 把"重签一次"与"补理由"两条出路分开 (a083f0a74a)
- 🐞 修正:isolated-git 提交后 CAS 收敛共享索引并加固并发测试 (02928bf7a4)
- 🚀 機能/改善:新增私有索引提交通道 isolated-git (f887b2dde6)
- 🚀 機能/改善:自动臂按需加密(环开 4 分钟/轮,环合即回落) (0061164cdb)
- 🐞 修正:判据面护栏在 commit-msg 加只报不拦的预警档 —— 未声明要在"还改得动"那一刻报出来 (facba1ab6a)
- 🔧 その他:再摘 plugins-data 死副本 14 枚并登记退役锁(逐字节同 @ihui/shared;9fdbc207ba 带回) (180c244014)

**2026-11-09**
- 🚀 機能/改善:API 端点桥 5 枚通用工具 + HR 工具族契约化,并清偿门 204 两处 (7cc2a3c29a)
- 📚 ドキュメント:登记人事考勤自动化四期 HR-1..HR-4(机主 2026-11-09 定「放到计划任务里,现在先不做」) (e21c471fe6)
- 🚀 機能/改善:收口 CLI 路由→工具通用工厂(route-tools.ts)与 i18n 压缩产物重生成(sourceCommit 对齐 HR 提交) (6ad9467976)
- 🚀 機能/改善:补齐 CLI 工具族——HR_TOOLS 暴露 AI 对话框考勤操作 + hr_ 审批语义(agent.ts/permission/rules.ts 接入) (162d9a3d0d)
- 🚀 機能/改善:人事考勤模块隔离收口——attendance-core 共享内核/5表/幂等迁移/api路由服务/三端骨架(web·RN·小程序注册)/15文件i18n(41键) (fc2f61da6f)
- 🐞 修正:读准防线族 5 处 git 派生补显式 stdio(门 193 存量清零) (df08126dc7)
- 📚 ドキュメント:自动同步缺口账本到现读口径(镜像 256 · 缺口 19) (c098a539b8)
- 🚀 機能/改善:协议/考试结果/运行时面板等多屏共享化收编——RN/小程序/web 三腿同批 (fda837a1b4)

**2026-11-08**
- 📚 ドキュメント:记两枚悬空提交的归宿与门30a/写口判面不一致票 (2a7524687a)
<!-- END RECENT UPDATES -->

<p align="center">
  <sub>Built by <strong>吉林省愛智匯人工知能科技有限公司</strong> · オープンソース共創、あなたと共に</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star us on GitHub</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/fork">Fork to build your own</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues">Request a feature</a>
</p>
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->