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
**2026-10-28**
- 🚀 機能/改善:导出席加固 —— --out 不得落进会话库(源库只读红线) (d054425c6a)

**2026-10-28**
- 🔧 その他:发布就绪判据补 pack 输入与装车证明两格(22→24) + index 判据抽单份 (e36ed1cf4f)
- 🚀 機能/改善:ops 运维腿 —— 日志统计 / 受控轮转 / 快照清单(只报数不删) (0e0121c907)
- 🚀 機能/改善:会话导出腿 —— HTML/JSON 双份,字段对齐官方报告形状 (88e98cfa9d)
- 📚 ドキュメント:生产侧取证落账(G-329五条断言全达/G-1200041 portproxy已修+530根因在DNS绑定) (de0d996d3e)

**2026-10-27**
- 🐞 修正:健康门禁探测令牌改系统自签,修每轮 HEALTH 401 (c731416937)
- 📚 ドキュメント:回滚 D08 误翻——票面明写 ①③ 未齐不翻勾，待执行席取证后再定 (f27b9ca499)
- 📚 ドキュメント:回滚 G-02 误翻——票面明写本行不翻勾(持有行已归档)，判据绿但状态约定优先 (9c7e4eb83c)
- 📚 ドキュメント:门128 存量复核进展注记(无正值可下调,余真机归走查包) @gb18-g128 (201ce10358)
- 📚 ドキュメント:结清 L28759 门237单侧屏票(前提不成立,零代码改动) @gb18-g237 (5d9f4efbd3)
- 📚 ドキュメント:结清 G-02 三枚待实装路由（subagents/all + n8n PUT/toggle，9 用例绿） (ee63def9c9)
- 📚 ドキュメント:结清 D08 Agent Teams 协作协议（后端48+前端2全绿，三件落点现读） (d7a01a8d52)
- 📚 ドキュメント:结清 D06 结构化代码审查 /review（前端13+后端12全绿，三型验收全覆盖） (a78402dbb2)
- 📚 ドキュメント:结清 D01 对话内 Agent 选择器（判据 20/20 全绿 + 全链落点现读） (4f25b42333)
- 🔧 その他:并发锁接线锁 —— 证明 move/links 的 --apply 真的取锁 (2728f969d0)
- 🚀 機能/改善:会话腿并发锁 + 复制到桶 copy + 切换后换桶提示 (6833a96637)
- 🔧 その他:两条无编号行采用对侧已入库形态(对侧就地改写,本侧不持旧形态) (9cdf9530d1)
- 🔧 その他:G-172 采用对侧已入库那版结清措辞(避免同号两标题) (961506f555)
- 🚀 機能/改善:D03 快捷笔记归档/分组/检索闭环(web+RN 同构，全链路走 api-client) (ef5fab2dbb)
- ♻️ リファクタ:SectionHeader 更多标签字号改取 spec 常量(去端内第二份 12) (f55aa8d17b)
- 🐞 修正:活文档正文点名的归档件不得被回收 (ddbc19f469)
- 🔧 その他:生产侧终验结清(生产库迁移记账双射转绿 + 线上构建滞留结清 + 归档回收保护缺口补钉) (fe4d02083f)
- 🐞 修正:跨端几何单一源对齐 + 门237登记补齐 2 条 + D01 单源判据(13 例) (152a57736b)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (14c8a9f99c)
- 🐞 修正:漂开副本归并(file.aizhs.top G-18→G-100 / Agent SDK G-06→D16 旧面补行首归并指针,不翻勾不删行,派单以持有行为准) (230a6aa9fb)
- 🔧 その他:04:19构建与dev库唯一索引两票结清(生产现读证据) (6b43a976ad)
- 📚 ドキュメント:结清 O66 派单面同尺(已落地 2f0830e8eefbdb884c4c5e19ae86c64090a32ab7) (1d1a422039)
- 📚 ドキュメント:收口重复登记(SSH条款已在12节机器事实区单源) (3b4e3ab5ce)
- 📚 ドキュメント:认领 D01 对话内 Agent 选择器(G-228) @2026-10-27/gb18-d01 (a485b9bdd3)
- 📚 ドキュメント:立通道探针铁律(ssh单反斜杠事故根治+回归夹具) (05be448d7d)
- 📚 ドキュメント:认领 L28759 跨端单侧屏清零(门237) @2026-10-27/gb18-g237 (ee46d66055)
- 📚 ドキュメント:补记 2026-10-27 生产 API 崩溃事故(缺模块导入)与观测链修复证据 (429a1f187d)
- 🐞 修正:移除指向未入库 relay-switch-admin 的挂载,修复生产 API 启动崩溃 (6fb5624be5)
- 🐞 修正:根治 SSH 隧道配置被吃掉反斜杠（体检仪+规范模板+回归锁） (b2c338a487)
- 🐞 修正:更新后不再停在启动页/灰页 (73696004d0)
- 📚 ドキュメント:⑦换桶真机往返闭环登记(9 会话换出/换入 + auth 还原逐字节核验) (7ef0ca053a)
- 🔧 その他:本机生产侧五票现读终验结清(部署快进/健康门禁/备份链/UTF-8 编码/邮件真实送达) (70d5698e83)
- 🐞 修正:修热更首启灰屏死锁 + 重设计更新卡 (1cb2b7c7b6)
- 📚 ドキュメント:⑦切账号联动换桶 swap 装车登记 (bbf108761e)
- 🐞 修正:桌面壳破坏性命令加原生确认闸 + 清除孤儿签名钥匙 —— XSS 无法再无人应答执行重置 (fa6586a19b)

**2026-10-27**
- 🚀 機能/改善:切账号联动换桶 swap —— 换出当前账号会话/换入目标账号桶 (c1848007fe)
- 🔧 その他:移除创蓝闪验运营商一键登录接入，登录仅保留短信验证码 (1442baa1e0)
- ♻️ リファクタ:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (320ffe17b1)
- 🐞 修正:漂开副本归并(file.aizhs.top G-18→G-100 / Agent SDK G-06→D16 旧面并入承载行,不翻勾不删行) (1e790e2abf)
- 🔧 その他:门237未判定桶与USDT地址配置面结清(现读复量+锁测试) (7ae54f576c)
- 🔧 その他:修 scan-login 守卫测试文案类型(noUncheckedIndexedAccess 下 string|undefined 不能喂 getByText) (e165c37257)
- 🐞 修正:「我的」页会员权益块补屏幕边距 + 4 Tab 与三枚菜单入口消裸键 (bed7a6beba)
- 🔧 その他:修复 AppQrPanel 轮询测试缺 agreementAccepted 入参 (46ebbb2930)
- 🚀 機能/改善:第三方 OAuth 发起期落协议同意记录(RN 端 fail-closed 配套) (15eefad368)
- 🐞 修正:第三方 OAuth 发起前落协议同意,并给 sso/auth 加显式同意步骤 (7bd751e7b5)
- 🚀 機能/改善:第三方 OAuth 通用回调增加服务端协议同意闸 (ee40a32128)
- 📚 ドキュメント:⑦真机实弹闭环登记(单会话搬移/回退+客户端自启守护与定向理由放行) (5ad7865a9e)
- 🚀 機能/改善:客户端存续前置增定向理由放行 + 真机搬移/回退实弹闭环 (b20e6e8d37)
- 🐞 修正:列表元数据不再被打码 + 重登覆盖保留 refresh 到期与展示名 (a3bbfcff86)
- 🔧 その他:新件补溯源水印载荷 + 登记 SectionHeader 配对族基线(带理由豁免:箭头/标签几何在委托件 MoreLink) (189f31951f)
- 🚀 機能/改善:RN 区段头收口到 @ihui/shared/ui/section-header-spec 单一源 (1394db170f)
- 🐞 修正:扫码登录路径补协议同意闸——后端单源判据 fail-closed,前端复用共享协议弹窗采集 (afecc4a48b)
- 🔧 その他:修复 tool_invocation_ledger.py 溯源水印载荷(HEAD 面唯一欠账,门 check-watermark-coverage 自愈产物;其余内容零改动) (212fef3995)
- 🐞 修正:patch-rn-release-signing 的「已注入」误报 —— signingConfigs.release 恒缺,本地出包链第 1 步断 (785d9df55b)
- 🐞 修正:F13 判据本体补齐三格 —— 销门98 D1(收 545c2a0f0e1 同族) (1002dee33b)
- 🚀 機能/改善:底部导航恢复真毛玻璃 —— Android 补 blurMethod(0.0.8「模糊不生效」实为漏传参数) (828dbc1374)
- 📚 ドキュメント:⑦自助化收口登记(rebuild --auto / move --account / 客户端存续前置) (f5354a1e97)
- 🐞 修正:收口第五轮第七批 —— 孤儿签名钥匙清除/RN 凭据明文降级拒绝/web-nginx CSP 死配置摘除 (5c489c48af)
- 🐞 修正:桌面壳 CSP 从 null 收紧为显式串 —— 防注入脚本任意外联 (ac7ba19a38)
- 🐞 修正:收口第五轮第六批 —— Python 网页工具逐跳 SSRF 与开发者提现原子化 (ead21e7045)
- 📚 ドキュメント:守门207 体积清偿批三 —— R4② 家族回潮副本/git推送 stub 家族/水印三档第三份/§1 完成即删同物/R4⑦ 内嵌 ruff 段逐字归档;R4⑤⑥⑦ 与 §1 四段按「整区逐字迁出+原位留规则单行」压缩 (ec6703f111)
- 🐞 修正:运行档位判定全量收口到 config 出口 —— 源码面清零裸读 process.env.NODE_ENV (146c050628)
- 🐞 修正:收口第五轮第四批 —— 悬赏任务与远程设备控制面的属主闸 (6a586fc06f)
- 🔧 その他:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (dd8919020a)
- 🐞 修正:收口第五轮第三批 —— 内部密钥计时比较三处漏网/CORS 扩展前缀放行收窄/AI 代理 SSRF (f033148c2a)
- 🔧 その他:重派 web+miniapp ui-routes 派生件 —— 销门105 自述钉 stale (c6acfafe1d)
- 🔧 その他:门7 依赖碎片化清偿 —— union 收敛枚合并两侧 lockfile 后收敛回单一版本 (c425140f1a)
- ♻️ リファクタ:提取器测试归位 scripts/tests —— 销门103 D1/D2 四处 (003cfc4f6e)
- 🐞 修正:补齐 findClosedToOpenRegressions 判据本体 —— 7ea94a13db9 引用先入库而实现缺席,全仓提交链被卡 (545c2a0f0e)
- 🐞 修正:收口第五轮第二批 P0 —— 社交登录 2FA 旁路与未验证邮箱自动关联两条接管链 (402ad2c7b5)
- 🔧 その他:撤除关于页端内分段数据孤儿件 —— 销门39 V1 (9ef51b6911)
- 🚀 機能/改善:装短信发送通道健康只读哨兵 —— 欠费静默停机不再无人知 (d05a1283cd)
- 🐞 修正:OTA 提示卡读条填充换强调档 —— 销门83 R3 (c5bc8e1b30)
- 🐞 修正:OTA 提示卡读条填充换强调档 —— 销门83 R3 (1908366bf3)
- 🐞 修正:版本号三处漂移收口 + 守门补 I 维(移动端双写一致) (8fb47d2628)
- 🐞 修正:收口第五轮第一批 P0 —— 越权进他人 Key 组/文件桥任意读写/生产机 shell 面三项 (240cfcbd33)

**2026-10-27**
- 🚀 機能/改善:⑦自助化收口——账号时间线自动推导+按账号批量搬移+客户端存续前置 (e5418db46a)
- 🔧 その他:第3波待办(覆盖面):wave3-chair 复核注记——无代码面可闭子格,本行保持未勾 (f836a82546)
- 🚀 機能/改善:抽纯函数 planTriageActions 决策层 + 单测(dry-run/单测态,不连生产库) (c906f0b92b)
- 📚 ドキュメント:金丝雀发布票 code-side 复核注记(canary-chair) (0c7d6b8b81)

**2026-10-27**
- 🚀 機能/改善:收编两批死席半成品 —— 门237「未判定桶收缩」(补检测形不松尺 + 复原被洗掉的硬化);e2e 夹具 requireEnv 惰性化 (dbc66f80f0)
- 📚 ドキュメント:六组同题两版对齐到 origin 版 —— 解收敛并集放大,本地独有事实已逐字留证待回补 (0fafd8f54d)
- 🚀 機能/改善:OTA 提示卡补下载读条 + 当前包身份可见 —— 「更新了没变化」从猜变成可对账 (dfecb638f9)
- 🐞 修正:rustup 家钉正补齐两个 saas 入口,四入口共用一份三态出口 (b00a550dad)
- 🐞 修正:扫码登录链三处真缺陷 + 三端点零测试补齐(成对变异自证) (f02f0c1ae5)
- 🐞 修正:补 expo-blur/expo-updates 的 vitest alias,4 套件收集期红清零 (e5eb705a6e)
- 🐞 修正:「我的创作」入口收进「+」面板,素材卡片行迁入底部停靠区 (81f08b3533)
- 🐞 修正:收口第四轮认证与写面漏洞 —— 2FA 旁路/人机验证死钩子/撞库续命/未鉴权 webhook 管理面 (c1a1f2b95f)
- 📚 ドキュメント:登录地区行指针改线 —— README:3492 仍指已撤除的 utils/login-order-policy 死路径,f1304bccfb take-theirs + C3(f0768ba6253) 后幸存位=packages/shared/auth/login-region-policy;只改路径指针与措辞归属,不判排序语义 (914df0b224)
- 🐞 修正:TabBar 几何恢复悬浮胶囊,材质保留磨砂实底 (0c59c2cb10)
- 🐞 修正:apps/web manifest next 对齐 lock 实态 16.4.3 —— 收敛批次债清偿(2026-10-27):二轮 union 取对席 dedupe 锁(specifier 16.4.3,b25e4783e42 批次 install 升锁未同笔交清单,disk 改了 16.4.3 一直没入库);门101 HEAD 面现读违例 1 条,已成对全席提交链的恒红干扰源(§12e),按修姿①清单向锁对齐:只改 package.json 这一行,不动 lock(门体二选一纪律)。node_modules 与 .pnpm 实测均解析 16.4.3,typecheck 17/17 与全量单测即在该实态跑绿 (af21471f20)
- 🔧 その他:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (04b64c84e1)
- 🐞 修正:Android 端放弃 dimezis 模糊,改 iOS 白底同款磨砂实底;升 0.0.8 (b25e4783e4)
- 🔧 その他:撤除本位第一版共享下沉岛 —— 二轮收敛裁决(2026-10-27):f1304bccfb 取对侧后,排序判据幸存位=packages/shared/src/auth/login-region-policy.ts(对席完整版,RN hook/扫码面板/根桶出口/实弹测试齐);本位 utils/login-order-policy.ts 与其 18 例测试、RN lib/login-region.ts 与其测试、utils/index.ts 转发行成孤儿,按 §0.6 撤除;extension/web 经 ui-react shim 取用,端 import 面零改动;README 指针行交后续 live-doc-edit 批 (f0768ba625)
- 🔧 その他:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (a59b7af60b)
- 🔧 その他:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (437f6f8833)
- 🔧 その他:撤除分叉期对席第二实现 use-extension-login-plan hook 与其 216 行测试 —— 收敛裁决(2026-10-27):L28754 扩展半格两侧各写一份,本位以 f2aa5fc69a9(与 web/RN 同一共享下沉判据)+use-extension-login-region 78 行测试为唯一实现;对席版基于下沉前旧形 region-policy.ts,合并后成孤儿(其 C 节装车断言与本位接线互斥必红),按 §0.6 单一真相源撤除;UI 登录地区判据行为零变化,判据符号 isProviderPlatformAvailable 已在 36cca68136 逐字移植入 ui-react 取用面 (bf8c40b613)
- 🚀 機能/改善:移植对席 provider 可用性谓词进 ui-react 取用面 —— 收敛分叉前置(2026-10-27):origin/ad94f971901 给 region-policy 加 isProviderPlatformAvailable 并随 ui-react index 点名 export;本侧 slim 转发层须自带该符号,合并后双端 import 面才闭合。逐字节自对侧全量 blob 截取移植(纯 LF,水印 verify 通过,括号配平自检 OK) (36cca68136)
- 📚 ドキュメント:登记短信/auth 会话线收口交接行(本机两批在飞未完税,归属席自裁) (4bedeca6d2)
- 🚀 機能/改善:底部导航真背景模糊(iOS 液态玻璃) + 版本升 0.0.7 (ddd7a8ac6d)
- 🐞 修正:UpdateNoticeCard 补载荷——门 47 HEAD 面归零的收尾一枚 (16cd09952a)
- 🐞 修正:底部导航改液态玻璃停靠栏 —— 删掉图标行下面独立的白色透明带 (a232db2b84)
- 🚀 機能/改善:阿里云通知/营销短信按用途分模板,与腾讯云映射同构 (4b2081dd79)
- 🔧 その他:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (36d5e2473f)
- 📚 ドキュメント:登录地区判据补上 RN 端接入与小程序端的平台独占说明 (0780fbe178)
- 🔧 その他:证书收紧为管理员后同步更正测试契约,并修掉两处存量红 (5714553032)
- 📚 ドキュメント:把生产停摆那张票改写成当下状态 —— 分叉已解(0/266 可 ff)、挡 ff 的 3 枚暂存已复位(逐枚证与 origin 同值)、7 枚未跟踪同名副本已改名移出并留 MANIFEST、生产被跟踪改动现读 0;只剩环自己跑通一轮,且记下一条容易踩的账:每轮失败也按 rc=1 计入成本额度(1.19-2.35 分钟/次),所以下一次尝试约 13:49,期间 PAUSE 属预期不必人工干预;运行时 cost-caps 会随 ff 自动吃到 8/h,手工改它反而重新挡住 ff (a9a7b22743)
- 🚀 機能/改善:弹窗与侧栏登录按访客来源地区分档(与 web 同一判据) (f2aa5fc69a)
- 🚀 機能/改善:登录页按访客来源地区分档(国内手机验证码优先/海外邮箱优先且隐藏手机号) (0885c1c860)
- ♻️ リファクタ:排序判据下沉共享层,web/RN/扩展共用同一张表 (a55b3b0fe5)
- 🐞 修正:收口第三轮全量漏洞面 —— 匿名写面/越权/密钥外泄 12 类 (41e55558d1)
- 🐞 修正:清掉更新提示里的死键与死 UI(写了不渲染的东西不留) (bbbbf5fa8e)
- 🐞 修正:更新链路三处真 bug + 版本策略加固 + 服务端补发 minimumVersion (b41c252f29)
- 🐞 修正:安装提示文案接入 i18n(此前硬编码中文,5 语言站上只有中文能看) (12c15fcd04)
- 🚀 機能/改善:更新提示链路补齐与同源化(web 强更渲染端 + PWA 派发端 + RN OTA 状态机) (18d8b710ac)
- 📚 ドキュメント:停摆票就地改写成当下真因——分叉那半已由 chore(merge) 双父提交解掉并推上 origin(合并零丢失由门 100、门 168 各自 rc=0 证明;账本按并集取主线版,采 prod 那版会违门 49 B1 因为它登记了一枚树内不存在的迁移);剩余障碍是生产目录 admin/sms/operations 下三枚未跟踪文件与主线同名不同字节,属写短信后台那一席的在飞现场,按 §12 不删不覆盖、不替谁把未验半成品入库,出路属该席(收编或挪走)此后快进立通。指针一律走内容锚点,不写短 sha(上一版被登记入口按 G-1079146 拒落,拒得对)。 (8379925d2f)
- 📚 ドキュメント:登记两票 —— 扫码路径的协议同意缺口、登录地区判据缺一条零网络边缘腿 (2f47a4541c)

**2026-10-27**
- 🚀 機能/改善:收编两批守门硬化 —— 门130 加 F13「已勾被捣回未勾」差值棘轮维;门44 拆"红/未判定"两档并把未判定变成可指认红因 (7ea94a13db)

**2026-10-27**
- 🔧 その他:第十三轮收尾落地:ZCode 凭证解密+真身套餐通道实弹闭环 & 豆包双层加密破译+签名墙语义修正。 (c28624c9fc)
- 📚 ドキュメント:B01 Predictive Edit 结清翻勾 —— 五格全闭环:③真模型取证实跑收口(live 闸 1/1、agnes 全契约结构化动作 suggested、失败态真上游两两可分辨),①前端调用方前席已落地本席复核在位;取证事实留档(4000ms 预算封顶装不下跨境往返、LiteLLM 价目表拉取卡事件循环);回归 ai-service 89/89+live 1/1、web 11/11、web tsc 0 错、mypy 0 错 (d99a9739a7)
- 🚀 機能/改善:判据层增规则③收集目录同名 —— 补测配方真落点被门认领(P/tests|test 精确同名盖 P/src|app,同包同名唯一收紧·不认 .spec.*·不做前缀),HEAD 面缺口 4042→3815(227 枚假缺口消解,新增 0);自检 33/33·镜像 6/6·autofill 37/37;runner 250 触发面罩收集目录并重封存根护栏;顺手清 lint 红(extname/LOCAL_DECL_RE 死变量) (222610b372)
- 📚 ドキュメント:门237两新票占用核查注记 —— 门体被他席在飞改写(489+/69-)占住,本席不认领不派单,落地后重走派单面 (dcd2fe250a)
- 📚 ドキュメント:G-02 三枚路由核对注记——①真会话复证 200/②③契约面 9 例绿,不翻勾留验收缺口 (9e2980dd4c)
- 📚 ドキュメント:E2E 自动补测 进展注记(2026-10-27/e2e-chair)—— 判据层规则③收集目录同名落地,缺口 4042→3815,保持未勾 (7647997313)
- 🔧 その他:G-02 三枚路由契约面复核——修 g299 mock 缺口(getDispatchStats/getDag)使 9/9 绿,含 n8n 成功路径 2 例(fetch-merge-put/activate+回读) (2e5ba54feb)
- 📚 ドキュメント:B04 两格收口合并注记落行 —— 清除器(ef8aedd)+消费面接线(87796c90)落码全绿;接线枚待远端收敛交清扫循环自愈,生产env/prod迁移属运维面维持未勾租约保留 (9549484c6b)
- 🔧 その他:重派小程序 ui-routes 派生件 —— 门105 该端自述钉 stale (743586edea)
- 📚 ドキュメント:D16 注记读数差澄清 —— check:sdk-publish 19/19→22 的构成(本席对外承诺用例 + 前席在飞的 npm 鉴权口径 2 用例随批入库) (675c72eeb6)
- 🚀 機能/改善:大屏新增「分时访问」面板 + 会话质量补「退出页 TOP」—— 页面级使用数据的时间维度与路径收尾两格 (2d7916c115)
- 📚 ドキュメント:监控大屏与全站埋点进展注记 —— 本轮分时访问面板+退出页 TOP 两增量(不翻勾,持续优化型) (a9ccc5a80c)
- 📚 ドキュメント:D16 发布就绪性代码面收口注记 —— retryAfterMs 限流透出/README 四段对外承诺/CHANGELOG 随包/门 22 用例,自证全绿;剩余为注册表账号与触发 tag 等仓库外动作,维持未勾 (cc3e87e5d7)
- 🚀 機能/改善:D16 发布就绪性收口 —— SdkError.retryAfterMs 限流透出 + README 对外承诺四段(版本与稳定性/遥测与隐私/限流与 429/鉴权获取指引) + CHANGELOG 随包附带 + check:sdk-publish 补对外承诺用例 (1087de1d67)
- 🚀 機能/改善:消费面接线 —— ai-service 工具调用经内部摄入腿落明细账(照既有服务间先例同型,失败不拖主循环) (87796c90ca)
- 📚 ドキュメント:D16 Agent SDK 对外开放 挂牌认领(进行中@2026-10-27/d16-chair)—— 发布就绪性代码面收口在飞 (a2ec2af694)
- 🚀 機能/改善:B04 明细账原文清除器装车 —— 30 天档+86D 同型纪律(dry-run/env 闸/规模闸/账行永不删) (ef8aedd7d9)
- 🐞 修正:收尾审计三跟进 —— codearts 双源实证信封被重派误冲恢复 + 两处平台清单文案补正 (326db6ec88)
- 📚 ドキュメント:B04 拍板注记落行 —— 保留策略两格定档(原文30天/清除器照抄86D),前席现场接管收口枚 9bb45909b3058485834fd4b00e87b921eaaf85b3,余两格未闭环(清除器落码/ai-service 消费面),行不翻勾租约保留 (231922081d)
- 📚 ドキュメント:登记一条真工作 —— 门 44 把"红"与"未判定"混在一条输出流,归因层无红可指便落应急档(对席跳门疑问的完整因果,只清根目录消不掉这一型) (de56370b72)
- 🔧 その他:重派 web ui-routes 派生件 —— 销门105 自述钉 stale (7654d0f54a)
- 📚 ドキュメント:O02 跨端 UI 单一源 —— InputArea 族逐档同值核对结论与本枚落地(不翻勾) (7173554aab)
- 🐞 修正:短信群发确认词改走富文本单一源头 —— 销门249 A2 分叉 (aa3b9e5655)
- 📚 ドキュメント:结清 L28755(生产签出双向分叉)—— 票面五前提逐条当场坍缩,本机侧已清账;并更正本席自写的一句陈旧读数 (28007acce4)

**2026-10-27**
- ♻️ リファクタ:O02 跨端 UI 单一源 —— InputArea 切换钮盒边长收进共享 spec 并补跨端一致性校验 (ad9b68aefe)
- 🐞 修正:codex 上游业务错误文案有界化 —— 销门181 PERSISTENT 命中 (1ef3fe83cc)
- 📚 ドキュメント:结清两票 —— L28753(后台短信运营页五语 i18n,枚 071256d1df6)与 L28754(RN+浏览器扩展登录页消费共享地区排法判据,枚 ad94f971901 + 0d046a5bdaa) (55bbdc5a7d)
- 🚀 機能/改善:L28753 结清 —— 后台短信运营页文案全量接入五语言(该摊此前零 i18n,门70 的 EXCLUDE_DIRS 含 admin ⇒ 机器不响,只能人工跟) (071256d1df)
- 🔧 その他:门7 依赖碎片化清偿 —— pnpm dedupe --lockfile-only 收敛 lock(31+/98-,webpack 5.91/5.109 双版本族并账),只动 lockfile 不触碰 node_modules 实态 (c9f805bddd)
- 🚀 機能/改善:八平台实弹取证升级四件(实弹抓包收官轮)——loomy 源码级键名+grokbot 解封定案+minimax 端点修正+opencode 健康端点实证 (1dfacf9907)
- 🔧 その他:relay-qoder-models 族三枚补齐溯源水印(销门47 该族余量) (6508672436)
- 🚀 機能/改善:B04 明细账签名导出器收口入库(接管前席现场) —— filters 补 AuditExportFilterSnapshot 形状(action/resourceType 落记录面固定词汇 tool.invoke/agent_tool_call,原生维度 toolName/sessionId/outcome 随快照进签名),导出口/签名出口/路由接线 13 例全绿 (9bb45909b3)
- 🐞 修正:根桶补出 isProviderPlatformAvailable —— ad94f971901 漏改 index.ts 造成的干净检出破线 (bcb33ed0f7)
- 🚀 機能/改善:L28754 RN 半格 —— 登录地区排法判据下沉 @ihui/shared 作跨端单源,RN 登录屏按 priorityPlatforms 重排 (0d046a5bda)
- 📚 ドキュメント:B04 挂牌认领@2026-10-27/gb19-e1 —— 接管前席未提交的明细账导出器现场 (afc0177788)
- 🐞 修正:门83/218 样式合规清偿 —— 社区屏/扫码屏品牌实底配对成文化(内联收编 StyleSheet 兄弟对+chip/bubble 兄弟命名对齐),hex 换 tokens(相机底 gray.black/阴影 gray.black,恒白留基线同 LoginScreen 先例),switch Neo-Brutalist 墨线描边 border-ink-exempt 注记(对齐 web 同色硬投影) (c6feb9b8db)
- 📚 ドキュメント:生产签出分叉票本机格清账注记 —— dev 库追平 3 条迁移,B6/B7 现读绿(库 351==journal 351);票体等生产机侧收敛,行不翻勾 (b4baa622f4)
- 📚 ドキュメント:收尾登记两枚跨端真票 —— 门 237 单侧屏清零与未判定桶收缩(数字派单前现读;只补检测形、不松判据) (f082b91f41)
- 🚀 機能/改善:巡检出口选取统一走 pickProxyForAccount 并补账号级 proxyUrl 解密读 —— scheduler 新增 EgressProxyTally/resolveEgressProxy(换票/健康检查/降级恢复/临期刷新/空闲保活与转发链路同一口径,巡检日志报 proxied/direct);forwarder 聊天重试与就地刷票改 resolveAccountProxyUrl 解密读;reconcile 签到同步同改;六个测试套件补 DB 桩 execute 与代理直通 mock(83 例全绿) (8092d47a50)
- 🐞 修正:qoder-models 三处下标取值补非空断言 —— 消 @ihui/api typecheck 的 HEAD 级红(重放) (0ac25e1b65)
- 📚 ドキュメント:两格复量注记 —— L28754 扩展端半格已落(ad94f971901,RN 那半落点与硬约束已定位)、L28755 生产分叉票面三前提当场坍缩 (ec9be70d5f)
- 🚀 機能/改善:大屏「页面使用排行」补平均停留列 —— 页面级 page_time 聚合服务 + 路由接线 + web 列 (8c2f870bef)
- 🐞 修正:跨端页面覆盖门「跑不完」根因收口 —— 取材改批量预取,进程 spawn 千次→个位数 (23362e7aae)
- 📚 ドキュメント:结清 D03 会话内快捷笔记 —— RN 腿 completed 直插 + cancel/interrupt 接线补齐,miniapp 平台独占豁免标注补测试锁 (f1264ed816)
- 🚀 機能/改善:L28754 半格 —— 浏览器扩展登录页消费共享层按地区排登录方式判据(RN 那半未做,票不翻勾) (ad94f97190)

**2026-10-27**
- 📚 ドキュメント:两格复量注记 —— L28754 扩展端半格已落(ad94f971901,RN 那半落点与硬约束已定位)、L28755 生产分叉票面三前提当场坍缩 (ec9be70d5f)
- 🚀 機能/改善:大屏「页面使用排行」补平均停留列 —— 页面级 page_time 聚合服务 + 路由接线 + web 列 (8c2f870bef)
- 🐞 修正:跨端页面覆盖门「跑不完」根因收口 —— 取材改批量预取,进程 spawn 千次→个位数 (23362e7aae)
- 📚 ドキュメント:结清 D03 会话内快捷笔记 —— RN 腿 completed 直插 + cancel/interrupt 接线补齐,miniapp 平台独占豁免标注补测试锁 (f1264ed816)
- 🚀 機能/改善:L28754 半格 —— 浏览器扩展登录页消费共享层按地区排登录方式判据(RN 那半未做,票不翻勾) (ad94f97190)

**2026-10-27**
- 🚀 機能/改善:D03 语音笔记补齐 completed 直插与 cancel/interrupt 接线 (3bc6aa4cf2)
- 📚 ドキュメント:守门 207 体积清偿批三 —— 3 行失效指针与空壳条目 + 批二指针整区逐字迁出(96,214 → 95,821 B) (7d2906610e)
- 🚀 機能/改善:两件增强做彻底——恢复腿逐条可撤(留底+undo)+qoder 可用模型全链路;上轮被 32db9220c5 误删文件全部重入库 (51866ed6fb)
- 📚 ドキュメント:结清 G-241 自动化结算状态机 —— 票面点名残余两格现读已在 HEAD,端上可见一格同批补齐 (87abd6556d)
- ♻️ リファクタ:spec 出口面收口第二批 —— 4 个在飞 spec 的悬空出口撤除(13 枚) (3954c67f45)
- 🐞 修正:摘除 aboutPageSections.ts 腐烂豁免条目 —— 该数据文件已在 c51a3d9da2 随端内实现一并删除(分段表由 packages/shared/src/constants/about-sections.ts 承载),而门体白名单仍登记它 ⇒ §0.7「豁免项消失同样算红」判清单腐烂,HEAD 面现读 318 枚屏 判 1 条 blocking 红(该红先于本枚存在,与任何提交内容无关 = §12e 型,只能摘条目结清,不能靠豁免) (a73226396b)
- 🔧 その他:D03 认领挂牌（d03-note-chair） (271eb479be)

**2026-10-27**
- 🐞 修正:复原违禁桶清扫派发层 sweepBannedBuckets(被 821ce8e621 收编提交整层删除) (3e325c601d)
- 🐞 修正:收口被整块重复的登记(F6 块级判据的修复出口) (5ae7500220)
- ♻️ リファクタ:spec 出口面收口 —— 17 枚「内部专用」常量去 export + 3 组零消费出口撤除(决策并入注释) (ef383b5574)
- 🔧 その他:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (21932bbc75)
- 🚀 機能/改善:union-converge 新增 --take-theirs-doc 活文档整份取对侧声明式出口 (a5e77cdb94)
- 🐞 修正:门 150/47/105 三门收口 —— chip 圆角归位 + 三文件溯源水印 + 三生成器重派(重放) (a6b495060b)
- 🐞 修正:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (e6241b229a)
- 🐞 修正:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (a9cca819be)
- 🐞 修正:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (b460558a2f)
- 🚀 機能/改善:G-241 终态徽章端上可见 —— 成因→i18n 后缀/色调档映射单源落 @ihui/shared,web/RN 共享屏/RN 卡片三处消费 (c97dfc9e2a)
- 🐞 修正:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (23cc9136af)
- 🐞 修正:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (d6d0a20f89)
- 🐞 修正:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (a36faf3287)
- 🐞 修正:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (b966cb2167)
- 🐞 修正:348 前置解药 —— 管理员行 avatar 回填撞不可变触发器 ⇒ 任何按链新建库卡在 345 (484d21186f)
- 🐞 修正:判据硬化两处 —— ①gitGrep/faceList/faceRead/collectMiniapp 四处 catch 由折成空集记绿改为抛 Undetermined,直执行 exit 2 显式「未判定」点名原因(§0.3:取不到不冒绿);missing 文件仍返 null(合法该面没有,M3 钉住)。②collectRn 口径松已证:只筛 .tsx 混进 tests/barrel,收紧为 <Name>Screen.tsx 形态与 collectShared 同尺,headDelegatedRn 同批收紧保持 R4 两尺对称;HEAD 面实测 315 枚 .tsx 全为该形态 ⇒ 存量读数零漂移。镜像 scripts/tests/check-cross-end-screen-coverage.test.mjs 10 例全绿(正常 5+故障注入 5);门体自检 15 例 0 失败;全量现跑 RC=0 读数不漂(主席复跑) (ec7a5ef870)
- 🐞 修正:门 150/47/105 三门收口 —— 号池邻屏 chip 圆角归位 + 三文件溯源水印 + 三生成器重派 (32db9220c5)
- 🚀 機能/改善:补全站埋点覆盖缺口三件——RN/小程序末屏停留收口 + web 图标按钮 aria 兜底 (b3a373ceb4)
- 🔧 その他:pnpm dedupe 收敛 lockfile 重复版本 —— 门7 现读红(taro/webpack 族重复);-84/+20 行纯去重,门7 复跑 RC=0 (6d782ba19d)
- 📚 ドキュメント:B04 证据级可追溯执行流水结清 —— 四要素已落库(提交 49cf56d65ad50050ac28f7130d10290241c939b8),测试现跑 14/14;签名导出沿用 siem-exporter,接本表归下一格 (260fb49701)
- 🚀 機能/改善:⑦写面收口——恢复腿+搬移/隔离腿装车;qoder listModels 取证定案 (3a41d69e7e)
- 🔧 その他:结清监控大屏与全站埋点持续优化(翻勾@2026-10-27/dash-track-chair2) (57fe8255bb)
- 🚀 機能/改善:跨端视觉原子 spec 覆盖率 9→11 收官(avatar 收口 + button 纳入)+ 守门 256 装车(阶段3) (fe86578df9)
- 🐞 修正:门83 五格违规清偿 —— R3 配对前景成文化(ScanLoginScreen 行内覆写挪进 StyleSheet 兄弟对;CirclePostScreen chipTextActive→chipTextActive→chipActiveText 兄弟对;LetterChatScreen bubbleTextMine/Theirs→bubbleMineText/TheirsText+sendBtnDisabled 摘重复实底留 opacity)与 R8 描边墨档(switch.tsx border-foreground→border-border 中性描边)。判据函数直验 4 文件 R3=0 R8=0;--staged 索引面 rc=0。第 5 格(account-pool)由并行会话持索引面不代提交 (621ded3e03)
- 📚 ドキュメント:结清 G-1200042 Knip 棘轮残余债 —— 文件腿 c51a3d9da2(2删4留裁决)+导出腿 27abd715c0(15删+8@public)全部落地,knip 面四类全降,knip-chair2 如实归并注记 (bd6b482e02)
- ♻️ リファクタ:G-1200042 棘轮残余债清偿·导出腿 —— 零消费导出 15 删 + 仅测试钉住 8 枚 @public 标注 (27abd715c0)
- 📚 ドキュメント:五枚 scope-placeholder 票按票面正文补真实落点 —— ①未闭环(生产侧部署)改归属头〔归:机主部署机面｜等:—〕出桶(行内自述本机不可复现不可修);②git-sync-converge 自指死锁/③短信运营页 i18n/④RN+扩展 loginRegion/⑤B04 执行流水四枚补〔作用域:…〕反引号点名(路径三面在位性已核:region-policy.ts 工作树缺故点目录形态);派单板现读 5 枚 scope-placeholder ⇒ 补齐后重跑 (289c403c2e)
- 🔧 その他:G-965 P2 —— 侧车强制档合并 1 条(G-1200041)+孤儿键退场 6 键(G-41/G-40/O6501/O6509/O6510/O6512,留痕 6 条入 plan-row-drop.jsonl);同批含并发席 2026-10-27 03:57 已暂存的归并记录(G-79→G-70 搬+6 键退场),本席 --apply 竞态闸验零冲突后未重写 (017a0f12d8)
- 🔧 その他:四枚 tier 基座件补溯源水印 —— 门47 HEAD 面欠账(他席旁路落地只带了无载荷 blob,工作树又无副本);本枚从 HEAD 还原→inject→带载荷落回 (1159d3d9a9)
- 📚 ドキュメント:comments 接线复用改判 aligned;certificate/download 补「缺的是平台原语不是屏」 (d41527efaa)
- 🚀 機能/改善:⑧补充——trae/trae-solo/qoder 三腿 relay:ide-switch 装车 (77368e2e65)
- 🐞 修正:gate-failure-kind 第五档 undetermined 补落实现与执行器接线 —— 92d09b9fa27 落了 F9 镜像测试却没带 lib 的 detectUndetermined 与 guardian-executor 的分流(半套入库,§10 反面又犯);镜像 17/17 复跑全绿 (75e454f427)
- 🔧 その他:relay-ide-switch.ts 补溯源水印 blob —— 门47 HEAD 面欠账销账;工作树副本已带载荷(skip-done),本次只把带水印内容带进 HEAD (1b6467da56)
- 🚀 機能/改善:号池任务中心装车(缺口④,观测面+手动触发) (6ec706ee3a)
- 🔧 その他:跨端样式对齐 阶段2 续: 校正 spec 覆盖率门口径(collapsible 重分类 EXEMPT, avatar 补 web 路径) (74da58072f)
- 🚀 機能/改善:G-241 结算状态机——FSM 服务层 + migration + 单测 (a9d9ce4bbf)
- 📚 ドキュメント:结清 访客与机器人流量上监控(全链路已落库,本地typecheck+88测试全绿,执行席指令翻勾) (eddcb58012)
- 🐞 修正:check-gate-triggers 两处派生 git 补 windowsHide —— 门52 实测 HEAD 面红(本文件自体即违例样板);自检 9+7 例、镜像 5/5 复跑全绿 (76a026676c)
- 🚀 機能/改善:补 GET /api/comments/mine 自范围面 —— 修「取错数据」一型并纠两笔假账 (d9e1d9c5f0)
- 🔧 その他:跨端样式对齐 阶段2: spec 覆盖率守门升级为棘轮(只拦退化,不拦存量) + 提交基线 (be31db2e93)
- 📚 ドキュメント:改掉我自己注记里触发的违禁桶命中 —— 上一笔为说明"不挂账"而写下的措辞恰是无引号护栏族尺的命中词族,闸门如实拦下;改为等价不含词族表述,归属桶与勾选态零变化 (30d62b1f4e)
- 🐞 修正:补齐 API 地址配置并同步生成物(修真机白屏) (cfca3a32a3)
- 🐞 修正:地区判定结果进请求日志,并把 GeoIP 三枚旋钮写进声明档 (7d73d4873d)
- 🐞 修正:补齐地区优先级的最后一格 —— 扫码子面板首位改成微信,并修三条会误报的既有断言与四处缺口 (3941f43800)
- 🐞 修正:补齐地区优先级的最后一格 —— 扫码子面板首位改成微信,并修三条会误报的既有断言与四处缺口 (3cffc01b88)
- 🚀 機能/改善:Wave3-b 补 user/sign-up —— 我的报名(课程+试卷两路聚合)gap→aligned (935ffb5c43)
- 📚 ドキュメント:登记一张可派单票 —— 生产签出与 origin 双向分叉导致全站发布停摆(带两处落地闸拒因与处置次序) (aa9366ae0e)
- 🚀 機能/改善:OTA 更新提示卡片——对齐 web PWAUpdatePrompt 样式 (8d41e83bdf)
- 📚 ドキュメント:登记生产签出停摆的收口票 —— 真因不是分叉本身:那 5 枚本地提交的内容已被远端全覆盖(3 枚无 patch 等价物的 4 个文件里 3 个 blob 逐字同、_journal 生产侧独有 0 行),卡的是工作树 103 枚未提交的被跟踪文件(其中含运行态本地化,不该被收编也不该被复位)+ 收敛器缺一条「整份活文档取对侧」的声明式出口(--take-theirs 之后活文档行 union 仍把滞后基线形态并回结果,F1/F6 各 1 判红)。备份牌 backup/prod-divergence-20261027-fb936b9 已送本机 mirror 保局;reset --hard 被 git 自拒,那是正确行为 (e3634f5a30)
- 🐞 修正:EAS 构建注入 EXPO_NO_METRO_WORKSPACE_ROOT=1 根治 monorepo 双重路径 (16aadf4120)
- 🔧 その他:跨端样式对齐 阶段1: Switch/Sheet 单一源 spec + 双端消费 + 守门 (94a50140b7)
- 🚀 機能/改善:Wave3 首批补屏 5 条 gap 路由 —— 社区与检索(circles/post、invitations、letters、news/category、search/history) (55b7d5088c)
- 📚 ドキュメント:把短信摊那枚票就地改写成当下状态——六件里五件已随 03f18e13a49/cfbcb019c35/8f5fc93e8ac 当场清偿(回调旋钮声明进 .env.example、tenant 按三条完整路径登记、csrf 前缀改按路径并补兄弟路径反例夹具、手机号判据收敛到 utils/phone.ts 且把两份逐字重复的归一实现收成单源、删除注释里不存在的「90 天发送记录」兜底),只剩 /admin/sms/operations 后台页零 i18n(226 行硬编码中文,门 70 排除 admin 故机器不响)——不新增行、不换勾选态、不动归属,整行改写按 §1 只留一行当前状态 (1bfc4a30c3)
- 🐞 修正:补齐扫码登录页缺载荷的欠账(门 47 blocking,留着即下一位的恒红) (8cbdacd1b2)
- 🚀 機能/改善:扫一扫空白页根因修复+抽屉扫码入口+EAS Update OTA 基建(v0.0.6) (d067c17109)
- 🐞 修正:补齐 24 枚缺载荷文件——上一枚随批带进 HEAD 的欠账当场清偿 (8f5fc93e8a)
- 🐞 修正:群发页原生确认窗改走仓内 useConfirm(§4 禁用原生提示窗) (cfbcb019c3)
- 🔧 その他:给登录窗补一条浏览器双臂锁——只换 loginRegion 就换整套排法 (92117762af)
- 🚀 機能/改善:腾讯云短信通知/营销双通道 + 送达回执与退订合规入库 (03f18e13a4)
- 🐞 修正:补交 geoip 的 countryCode 出口——上一枚漏了这个文件,兜底腿在真实链路上恒判不出 (5042a0acf1)
- 🔧 その他:扫码面板刷新按钮居中+图标、二维码卡片加轻阴影 (fb936b9fc3)
- 🐞 修正:第三方按钮"未配置"提示不再借用 Google 专属文案,五语言同批补通用键 (86b7a8108d)
- 🐞 修正:远程 GeoIP 腿加每分钟配额,并补上我漏跑的那一层类型门 (12b414993a)
- 🔧 その他:扫码面板刷新按钮居中+图标、二维码卡片加轻阴影 (495c7cc53d)
- 📚 ドキュメント:登记一张可派单票 —— RN 与浏览器扩展登录页消费按访客 IP 的登录优先级判据 (b2fbe9ac18)
- 📚 ドキュメント:登记「登录窗按访客 IP 地区排登录方式优先级」能力(与同批两枚 feat 一并交付) (e2ec7f3683)
- 🚀 機能/改善:登录窗按地区排登录方式优先级(国内微信扫码最前,海外邮箱+Google/GitHub 最前) (0601fdb954)
- 🚀 機能/改善:登录呈现地区判据落地,并随 oauth-status 下发(判不出显式返回未判定) (15e3828794)
- 🐞 修正:登录扫码面板统一为1:1正方形根治二维码溢出裁切 (31b1a7df6b)
- 📚 ドキュメント:把昨晚那枚在飞短信摊的清偿票从四件补到六件——另两枚是同席取证时量到的实测缺口:admin-sms.ts 自立第二份手机号正则(与 utils/phone.ts 唯一入口不同形,13x 号段进得了后台进不了公开取码端点),以及 csrf.ts/sms-callback-parse.ts 注释宣称的「90 天发送记录」兜底全仓不存在(只配 IP 白名单时腾讯共享出口内任何人可伪造退订) (8b130377ab)
- 🐞 修正:登录扫码面板统一为1:1正方形根治二维码溢出裁切 (e267cc3b39)
- 📚 ドキュメント:登记一枚可派单票——短信合规在飞那摊随批落地前须清偿四件(回调旋钮无处配⇒端点上线即恒 503 / tenant 公开前缀缺登记 / csrf 前缀豁免无夹具 / 新后台页零 i18n 硬编码中文 226 行);其中的登录轮转改判已单摘入 e6f75c3418b37613329d0082c276d596e9090e17,不重复占账 (3ce793747c)
- 🐞 修正:journal 与主线逐字对齐(消解 union 合并冲突) (319358b8fd)
- 🔧 その他:journal 补登记迁移 20261027091500_default_avatar_www (74038f4502)
- 🚀 機能/改善:默认头像域名收敛到 www.aizhs.top(省一次 CF 301) (85d53f1f6a)

**2026-10-27**
- 🔧 その他:G-965 P2 —— 侧车强制档合并 1 条(G-1200041)+孤儿键退场 6 键(G-41/G-40/O6501/O6509/O6510/O6512,留痕 6 条入 plan-row-drop.jsonl);同批含并发席 2026-10-27 03:57 已暂存的归并记录(G-79→G-70 搬+6 键退场),本席 --apply 竞态闸验零冲突后未重写 (017a0f12d8)
- 🔧 その他:四枚 tier 基座件补溯源水印 —— 门47 HEAD 面欠账(他席旁路落地只带了无载荷 blob,工作树又无副本);本枚从 HEAD 还原→inject→带载荷落回 (1159d3d9a9)
- 📚 ドキュメント:comments 接线复用改判 aligned;certificate/download 补「缺的是平台原语不是屏」 (d41527efaa)
- 🚀 機能/改善:⑧补充——trae/trae-solo/qoder 三腿 relay:ide-switch 装车 (77368e2e65)
- 🐞 修正:gate-failure-kind 第五档 undetermined 补落实现与执行器接线 —— 92d09b9fa27 落了 F9 镜像测试却没带 lib 的 detectUndetermined 与 guardian-executor 的分流(半套入库,§10 反面又犯);镜像 17/17 复跑全绿 (75e454f427)
- 🔧 その他:relay-ide-switch.ts 补溯源水印 blob —— 门47 HEAD 面欠账销账;工作树副本已带载荷(skip-done),本次只把带水印内容带进 HEAD (1b6467da56)
- 🚀 機能/改善:号池任务中心装车(缺口④,观测面+手动触发) (6ec706ee3a)
- 🔧 その他:跨端样式对齐 阶段2 续: 校正 spec 覆盖率门口径(collapsible 重分类 EXEMPT, avatar 补 web 路径) (74da58072f)
- 🚀 機能/改善:G-241 结算状态机——FSM 服务层 + migration + 单测 (a9d9ce4bbf)
- 📚 ドキュメント:结清 访客与机器人流量上监控(全链路已落库,本地typecheck+88测试全绿,执行席指令翻勾) (eddcb58012)
- 🐞 修正:check-gate-triggers 两处派生 git 补 windowsHide —— 门52 实测 HEAD 面红(本文件自体即违例样板);自检 9+7 例、镜像 5/5 复跑全绿 (76a026676c)
- 🚀 機能/改善:补 GET /api/comments/mine 自范围面 —— 修「取错数据」一型并纠两笔假账 (d9e1d9c5f0)
- 🔧 その他:跨端样式对齐 阶段2: spec 覆盖率守门升级为棘轮(只拦退化,不拦存量) + 提交基线 (be31db2e93)
- 📚 ドキュメント:改掉我自己注记里触发的违禁桶命中 —— 上一笔为说明"不挂账"而写下的措辞恰是无引号护栏族尺的命中词族,闸门如实拦下;改为等价不含词族表述,归属桶与勾选态零变化 (30d62b1f4e)
- 🐞 修正:补齐 API 地址配置并同步生成物(修真机白屏) (cfca3a32a3)
- 🐞 修正:地区判定结果进请求日志,并把 GeoIP 三枚旋钮写进声明档 (7d73d4873d)
- 🐞 修正:补齐地区优先级的最后一格 —— 扫码子面板首位改成微信,并修三条会误报的既有断言与四处缺口 (3941f43800)
- 🐞 修正:补齐地区优先级的最后一格 —— 扫码子面板首位改成微信,并修三条会误报的既有断言与四处缺口 (3cffc01b88)
- 🚀 機能/改善:Wave3-b 补 user/sign-up —— 我的报名(课程+试卷两路聚合)gap→aligned (935ffb5c43)
- 📚 ドキュメント:登记一张可派单票 —— 生产签出与 origin 双向分叉导致全站发布停摆(带两处落地闸拒因与处置次序) (aa9366ae0e)
- 🚀 機能/改善:OTA 更新提示卡片——对齐 web PWAUpdatePrompt 样式 (8d41e83bdf)
- 📚 ドキュメント:登记生产签出停摆的收口票 —— 真因不是分叉本身:那 5 枚本地提交的内容已被远端全覆盖(3 枚无 patch 等价物的 4 个文件里 3 个 blob 逐字同、_journal 生产侧独有 0 行),卡的是工作树 103 枚未提交的被跟踪文件(其中含运行态本地化,不该被收编也不该被复位)+ 收敛器缺一条「整份活文档取对侧」的声明式出口(--take-theirs 之后活文档行 union 仍把滞后基线形态并回结果,F1/F6 各 1 判红)。备份牌 backup/prod-divergence-20261027-fb936b9 已送本机 mirror 保局;reset --hard 被 git 自拒,那是正确行为 (e3634f5a30)
- 🐞 修正:EAS 构建注入 EXPO_NO_METRO_WORKSPACE_ROOT=1 根治 monorepo 双重路径 (16aadf4120)
- 🔧 その他:跨端样式对齐 阶段1: Switch/Sheet 单一源 spec + 双端消费 + 守门 (94a50140b7)
- 🚀 機能/改善:Wave3 首批补屏 5 条 gap 路由 —— 社区与检索(circles/post、invitations、letters、news/category、search/history) (55b7d5088c)
- 📚 ドキュメント:把短信摊那枚票就地改写成当下状态——六件里五件已随 03f18e13a49/cfbcb019c35/8f5fc93e8ac 当场清偿(回调旋钮声明进 .env.example、tenant 按三条完整路径登记、csrf 前缀改按路径并补兄弟路径反例夹具、手机号判据收敛到 utils/phone.ts 且把两份逐字重复的归一实现收成单源、删除注释里不存在的「90 天发送记录」兜底),只剩 /admin/sms/operations 后台页零 i18n(226 行硬编码中文,门 70 排除 admin 故机器不响)——不新增行、不换勾选态、不动归属,整行改写按 §1 只留一行当前状态 (1bfc4a30c3)
- 🐞 修正:补齐扫码登录页缺载荷的欠账(门 47 blocking,留着即下一位的恒红) (8cbdacd1b2)
- 🚀 機能/改善:扫一扫空白页根因修复+抽屉扫码入口+EAS Update OTA 基建(v0.0.6) (d067c17109)
- 🐞 修正:补齐 24 枚缺载荷文件——上一枚随批带进 HEAD 的欠账当场清偿 (8f5fc93e8a)
- 🐞 修正:群发页原生确认窗改走仓内 useConfirm(§4 禁用原生提示窗) (cfbcb019c3)
- 🔧 その他:给登录窗补一条浏览器双臂锁——只换 loginRegion 就换整套排法 (92117762af)
- 🚀 機能/改善:腾讯云短信通知/营销双通道 + 送达回执与退订合规入库 (03f18e13a4)
- 🐞 修正:补交 geoip 的 countryCode 出口——上一枚漏了这个文件,兜底腿在真实链路上恒判不出 (5042a0acf1)
- 🔧 その他:扫码面板刷新按钮居中+图标、二维码卡片加轻阴影 (fb936b9fc3)
- 🐞 修正:第三方按钮"未配置"提示不再借用 Google 专属文案,五语言同批补通用键 (86b7a8108d)
- 🐞 修正:远程 GeoIP 腿加每分钟配额,并补上我漏跑的那一层类型门 (12b414993a)
- 🔧 その他:扫码面板刷新按钮居中+图标、二维码卡片加轻阴影 (495c7cc53d)
- 📚 ドキュメント:登记一张可派单票 —— RN 与浏览器扩展登录页消费按访客 IP 的登录优先级判据 (b2fbe9ac18)
- 📚 ドキュメント:登记「登录窗按访客 IP 地区排登录方式优先级」能力(与同批两枚 feat 一并交付) (e2ec7f3683)
- 🚀 機能/改善:登录窗按地区排登录方式优先级(国内微信扫码最前,海外邮箱+Google/GitHub 最前) (0601fdb954)
- 🚀 機能/改善:登录呈现地区判据落地,并随 oauth-status 下发(判不出显式返回未判定) (15e3828794)
- 🐞 修正:登录扫码面板统一为1:1正方形根治二维码溢出裁切 (31b1a7df6b)
- 📚 ドキュメント:把昨晚那枚在飞短信摊的清偿票从四件补到六件——另两枚是同席取证时量到的实测缺口:admin-sms.ts 自立第二份手机号正则(与 utils/phone.ts 唯一入口不同形,13x 号段进得了后台进不了公开取码端点),以及 csrf.ts/sms-callback-parse.ts 注释宣称的「90 天发送记录」兜底全仓不存在(只配 IP 白名单时腾讯共享出口内任何人可伪造退订) (8b130377ab)
- 🐞 修正:登录扫码面板统一为1:1正方形根治二维码溢出裁切 (e267cc3b39)
- 📚 ドキュメント:登记一枚可派单票——短信合规在飞那摊随批落地前须清偿四件(回调旋钮无处配⇒端点上线即恒 503 / tenant 公开前缀缺登记 / csrf 前缀豁免无夹具 / 新后台页零 i18n 硬编码中文 226 行);其中的登录轮转改判已单摘入 e6f75c3418b37613329d0082c276d596e9090e17,不重复占账 (3ce793747c)
- 🐞 修正:journal 与主线逐字对齐(消解 union 合并冲突) (319358b8fd)
- 🔧 その他:journal 补登记迁移 20261027091500_default_avatar_www (74038f4502)
- 🚀 機能/改善:默认头像域名收敛到 www.aizhs.top(省一次 CF 301) (85d53f1f6a)

**2026-10-27**
- 🚀 機能/改善:⑧补充——trae/trae-solo/qoder 三腿 relay:ide-switch 装车 (a120605d64)
- 📚 ドキュメント:G-76 行内剩余 3 处「不是等人拍板」叙述否认同批消歧(前笔只改了第 1 处,该 1.1 万字长行还有 3 处同款措辞 ⇒ 措辞族尺仍命中)——统一改写为「不属归属裁决」,事实与归属一字不动 (42f939c42a)
- 📚 ドキュメント:G-76 本机侧终验落账(活日志 strict-UTF-8 非法行=0,改法两承载体齐备) —— 远端 aizhs.top 格无本机访问不背书,故本行保持未勾不冒绿;并记票面文件名已漂(真正写者是父调度器) (290f1e5ef2)
- 📚 ドキュメント:G-76 行措辞消歧 —— 正文叙述否认「(等环境条件,不是等人拍板)」被归属措辞族尺命中、而 self 尺按语法辖域判引文内判不了 ⇒ 两把尺分叉,git-sync-converge 按未判定拒绝推进(实测本批收敛第 1/3 轮)。行的事实与归属一字不动(侧车标头〔归:机主生产授权面〕本就正确),只把叙述否认改写为「(等环境条件,不属归属裁决)」避措辞族,勾选态/租约/归属桶三维守恒 (7fa72b31f9)
- 🔧 その他:复验结清 5 枚 C 类票(git-guardian/G-941/自进化三连),实证提交核验 (3ddddfb08d)
- ♻️ リファクタ:摘两枚零引用残留 intentional-delete: rules-api.ts 已由 hooks/use-rules + stores/rules 等价承载(rules-manager.tsx 现读逐字), aboutPageSections.ts 由 packages/shared/src/constants/about-sections.ts 承载且 AboutScreen.tsx:24 注释自述端内实现与分段数据表一并删除属删除不彻底残留;同批另四枚(RN TaskApprovalCard/useTaskReceiver、desktop approval-card/task-receiver)经 §7 三问判不可删——它们是 2026-10-26 新建、尚未接线的 RN/desktop 端唯一实现,零引用不等于该删 (c51a3d9da2)
- 🚀 機能/改善:D08③ 跨会话 Fleet 面板 + B01 补上 edit_intent 度量生产者 —— 面板复用 BackgroundAgentsPanel 行判据与 getAllSubagentDispatches(零复制判据/零新 SSE 帧族);预测式编辑的应用与忽略两终点同批入账(缺省 completion 桶不再吞掉 edit_intent,看板接受率从此可算),两路各 2/4 例 RTL 静默失败不影响输入 (913be2e832)
- 📚 ドキュメント:四行按票面正文补真实落点与第一手事实 —— 两枚 <x>-spec 占位符换成真实文件(section-header-spec.ts,同族28枚)以解派单板 needs-scope;G-70 记 ③ 调度面本日闭环与真余两格;L6065 记三通道同断凭据。不改任何归属桶(现读已在归他人) (f66a47f126)
- 🐞 修正:门 103 C1 表级例外通道补线 + 两枚守门中枢挂账 (2fb1c59046)
- 🚀 機能/改善:⑧本机账号一键切换 relay:switch-account —— 列表/dry-run/--apply 三档 (61aa8a7037)
- 🔧 その他:号池两页状态与健康徽章加 whitespace-nowrap,修真浏览器量到的读数折行;账号代理页正文句读统一全角 (8f803dad39)
- 🔧 その他:gate-failure-kind 镜像补第五档 F9 —— 实现已交付 undetermined 独档,测试此前零覆盖 (92d09b9fa2)
- 🚀 機能/改善:⑧本机账号一键切换 relay:switch-account —— 列表/dry-run/--apply 三档 (acee268ad8)
- 🚀 機能/改善:G-241 结算状态机读侧契约 —— api-client UserAutomation 补 claimToken/claimedAt/terminalReason(源真相 schema/user-automations.ts:40/61/64,词表 :91),终态文案五语言×web与mobile-rn两消费面同批补齐,成对锁测试逐字比对源真相防漂移 (73ab8e50b7)
- 🐞 修正:全量扫描两道真红收口 —— 门 237 R4 口径 + 门 103 pg-backup 穿透 (2ecb745084)
- 🚀 機能/改善:号池缺口② codearts 余额点查装车(workbuddy 侧确认已闭环,更正 README 过期行) (ca876ec63f)
- 🔧 その他:B01 复验注记(②scene字段+⑤README清单已落地,源码实证;余①前端调用方不在本票范围/③真模型取证;牌留待兜底代摘) (136d7115e4)
- 🔧 その他:G-26 复验注记(②③⑤已落地+红测21/21绿,agent侧全闭环;余①需部署环境执行) (4122552db0)
- 🔧 その他:gb19 挂牌 gb19-e4 (b3a1632a78)
- 🔧 その他:gb19 挂牌 gb19-e2 (e85000be0a)
- 🔧 その他:账号代理页真浏览器 e2e 三条入库(归名文案/库侧 hasProxy/设置-清除闭环+残留自愈) (eef6684017)
- 🚀 機能/改善:⑦会话搬家第二刀·备份腿装车(relay:sessions:backup)+写面链设计定案 (3872b518a6)
- 🐞 修正:消掉上一枚带来的 mypy 回退 —— finish_run 直接 return Any 触 no-any-return (da1c4d9519)
- 🚀 機能/改善:⑦会话搬家第⑦行就地改写 —— 取证闭环+两条只读腿装车(备份腿实弹 5297 文件/1.74GB) (9ea296521a)
- 🔧 その他:挂牌 B01. Predictive Edit（进行中@2026-10-27/gb19-e1） (fcf5110014)
- 🔧 その他:补回本波 4 席认领牌(第二次)—— 首枚 6cb5d59561 打的牌被别席 docs(plan) 整文件改写吞回旧态(活文档行级 union 只认「对侧相对基底新增」,认不出「本侧刚改写整行、对侧带旧基线副本」那一型);本次定位改按题面探针不按行号(L28090/28091/28602/28604 四处行号已漂,行号一次 append 就挪,§1 禁行号),且逐行先断言无他席在册牌才加 (6fef3e500d)
- 📚 ドキュメント:号池对标⑨qoder/codearts 提取器装车一行 —— 缺口清单第 1 项收官(四平台 --from 齐名) (32a2db53e5)
- 🔧 その他:本波 4 席认领(加复合租约)—— L28090 d18-sdk-chair / L28091 rn-category-chair / L28602 gitdir-pointer-chair / L28604 d35-projection-chair;派单板现读他席未过期声明 0 条,四行题面均自述「认领已释放」⇒ 无在册牌可覆;产牌唯一出口 applyLeaseCarry,行内容逐字取 HEAD 面(最长 8546 字符,手抄必改 keyOfRow) (6cb5d59561)
- 📚 ドキュメント:G-395 结清 —— 配置分层出处标签与请求档/实得档留痕已实现,十一例测试由 runner 实收集 (5b2c942948)
- 🚀 機能/改善:G-941 运行收尾真正入账 —— finish_run 补上唯一生产调用点(此前只有定义/docstring/测试) (98ea07f0f6)
- 🚀 機能/改善:qoder/codearts 本机会话提取器装车 —— 四平台 --from 注册表齐名 (59f6c25f06)
- 📚 ドキュメント:D11 语音全双工定档=具备 —— 票面三格验收(自动发/流式回/可打断)在库有测试,落地提交 31690b4cb7 与 12e5594f05 均在 HEAD;余三项属增强不阻塞,照 D80 先例翻勾 (dbf4ba63f1)
- 📚 ドキュメント:G-19 结清销票 —— 机主完成 CF service token 轮换 + 副本清偿已毕,翻勾(p7 席,机主令) (2ecdb75cc5)
- 📚 ドキュメント:L6826 前置链打通落账 —— IDE 拉起/登录态 true/构建 exit 0/自动化端口监听/采集器物就位(p7 席) (eb0774a2a6)
- 📚 ドキュメント:G-06 旧面行并票注记(与 D16 承载行同题,推进以承载行为准,防重复做功) (afa9b52b27)
- 🔧 その他:gb18-e3 结清 G-40 幂等事实 A/E 两格(8227e12ada+b2d3031a5d 已入库;独立复验 13/13 绿) (236a1c4181)
- 🔧 その他:gb18-e2 结清 G-31 ①段(497c8ed247 已入库;复验 86/86 绿;③机主格开放;删除交兜底清扫轮) (bb2a7b8f7a)
- 📚 ドキュメント:F11 违禁桶唯一一条未勾行翻勾结清 —— 主席收尾席 2026-10-27 登记的「侧车孤儿键退场档」其工作已由 1ce6414900 装车(--retire-orphans 只退不抽+零丢失留痕进 plan-row-drop.jsonl+镜像钉活键不误摘),票面事实成立即销账;该桶强制令地板为空,本行是 convergence 阻塞点(无冲突合并放大判定 F11+1) (11cfa2732f)
- 🚀 機能/改善:号池对标⑦第一刀 —— 会话搬家取证闭环 + 只读盘点器 relay:sessions (53f58f53bf)
- 🚀 機能/改善:号池对标⑦第一刀 —— 会话搬家取证闭环 + 只读盘点器 relay:sessions (dd9d79486e)
- 🐞 修正:Guardian Full 的 uv 安装改用仓内既有形态 —— 上一枚我写的 python3 -m pip install --user uv 在 ubuntu-latest(24.04)会当场报 externally-managed-environment,那是我把一道恒红门换成另一种恒红门。正解照抄 ci-monorepo/golden-e2e/e2e-browser-hub 三处同一条:actions/setup-python@v5 + pip install uv,并在顶层补 env.PYTHON_VERSION='3.12'(与那三处同值,跨文件不能共享 env 故各留一份)。js-yaml 解析实证:顶层键 name,on,env,jobs;9 步;Setup Python(#5)+安装 uv(#6)排在「全量守门」(#7)之前 (12c903d452)
- 🔧 その他:gb18 挂牌 gb18-e2 (a3244d5401)
- 📚 ドキュメント:重建被并集收敛回捞的 11 项 —— 6 枚结清(G-29/门134/同一契约/G-41/两类残行/G-116)与 5 处事实纠偏(金丝雀灰度不实/USDT 已配置/三枚自进化结清不成立);首次落地后除 B04 与 P1 外全部被回捞,同一留痕同一凭据二次落地 (8b7fb26f95)
- 📚 ドキュメント:归还被误退的 f89e993 第②行 —— L28768 ruff 票翻勾行(本席 soft reset 竞态误退,原样归还,p7 席) (fb0267888a)
- 🔧 その他:对齐归并后源的重派——离线语言包四语+ web/miniapp ui-routes 自述钉;三生成器唯一出口零手改,水印内嵌;解门 105 派生件陈旧(第 2 轮,基 0bdff73528be75f840efe8545917a922d9525f99) (081af31c4b)
- 📚 ドキュメント:B04 结清(四要素早落库,签名导出归下一格) + P1 侧边栏 P3 结清(零改动,门 128 与三桶判据成立) + G-957 复核注记(代码侧三入口闭合,余格机主/真机面,保持未勾) (cf9b4f2a69)
- 📚 ドキュメント:号池对标⑧一键网页重登收官一行 —— 缺口清单第 3 项落地(Trae 先行,三平台如实未判定) (c5d16b979d)
- 🔧 その他:gb18 挂牌 gb18-e1 (28e84480cc)
- 🐞 修正:Guardian Full 补装 uv —— 上一批把 ruff 接成 blocking 门(id 254)却没给这个 job 准备执行器:它此前零 python 面(steps 只有 checkout/pnpm/node/依赖/构建/守门),干净 runner 上取不到 uvx ⇒ 门按 §0.3 落 exit 2「未判定」,整批守门被顶红 = 我自己造的恒红门(§12e)。修法是把执行器装上而不是把门降档或让它静默跳过:python3 -m pip install --user uv + 写 GITHUB_PATH + uvx --version 自证,装不上是本步当场红(原因一眼可见),不会混进守门汇总让人误读成 Python 代码出了问题。js-yaml 解析确认 8 步、uv 步在「全量守门」之前 (0bdff73528)
- 📚 ドキュメント:账号代理管理页条目登记(账号级出口代理独立入口) (72b1d7fdeb)
- 🐞 修正:G-957 SSO 回跳成功分支补 store 双写 —— consumeSsoCode 只落 storage,而 app 级 WS 只订阅 useUserStore.token,授权成功到冷启动前不建连;复用 setAuth 不新造状态 (4bbc643a13)
- 🔧 その他:人工阀 budget-cap-change 拍板放量 —— deploy.perHour 4→8(机主 2026-10-27 明示授权'第三件请去做';perDay 40 与 minutesPerDay 480 不动,保留日总成本闸;cost-breaker 现读 近1h 0/8 放行) (bf857b89a9)

**2026-10-27**
- 🚀 機能/改善:账号级代理前后端闭环入库,管理入口与文案由「私有出口」改名「账号代理」 (2d779c49ce)
- 🚀 機能/改善:号池一键网页重登(Trae 先行)+ 重登不毁自续票 (0471fd3d9a)
- 📚 ドキュメント:号池对标⑦会话搬家侦察定案一行 —— 先取证,不施工 (b27b6474ab)
- 🐞 修正:补注册门 254 check-ruff-python —— 清偿 8a48e5411f 半笔落地欠账 (911fb16f9c)
- 🔧 その他:结清 ruff 接提交链票(L28763 未取号行)—— 票面三条判据当场复跑:①前置存量归零=ruff 全量档 0 violations(1492 个 .py,HEAD/索引/磁盘三档各实跑一次);②注册条目成套=id 254 blocking+skipEnv HUSKY_SKIP_RUFF+射程 apps/ai-service/(门 89 已接线数 321→322、门 253 新增缺 0);③摘掉即翻红形状锁=check-ruff-gate-wiring T2 对缺 skipEnv/缺射程/换 id/降 warn 四维逐条咬住,镜像 11 例 + 自检 11 例全过 (3e71a669a5)
- 🐞 修正:门 39 清偿 —— ScanLoginScreen.tsx 按 B 通道登记 RN 独占白名单(expo-camera 相机/条码扫描硬件依赖,共享层无同名屏,票务判据已共用 shared parseQrLoginTicket;与 VoiceSttScreen 先例同构)。证据:门 rc 1→0(312 枚无未迁移、白名单零腐烂),镜像测试全过 (ce64684498)
- 🚀 機能/改善:152 道存量门射程声明一次清偿 —— 门 253 棘轮存量归零 (91a47401d5)
- 🚀 機能/改善:ruff 守门接进提交链(id 254,blocking)+ AGENTS R4 点名同批 —— 前半件脚本入库后接线与点名必须同批(§0.9 造好没装车=没有;门 89 R4 已接线不点名即红)。AGENTS.md 走 LAND_BLOBS 而非工作树:该文件此刻是他人门 207 体积清偿的在飞脏面,交工作树字节等于替他们落地,正解=HEAD 版⊕本票一行。落地后接线锁 check-ruff-gate-wiring 的 T1 由红转绿(它读 HEAD 面 runner,落地前红是设计内阳性对照) (8a48e5411f)
- 🚀 機能/改善:workbuddy 号池⑥余额点查 getQuota(实弹闭环) (2ab083b8d3)
- 🚀 機能/改善:ruff 守门脚本入库(未接线,接线与文档点名同批待落)——把 Python lint 从只挂 CI 接进提交链的前半件:三档判定面(HEAD/索引/磁盘,外部工具只能看磁盘故先物化到 scratch)照 check-mypy 同口径,ruff 版本 pin 从 apps/ai-service/pyproject.toml 解析(§0.6,不硬编码),uvx 缺失/pin 解析失败/面取不到一律 exit 2 未判定且优先于红。证据:--worktree/--staged/全量档三档实跑 0 violations(1492 个 .py)、--self-test 11 例全过、镜像测试 11/11、接线锁 check-ruff-gate-wiring 反向对照 4 维逐条翻假 (9ce6ffcf6c)
- 🔧 その他:gb17-e2 结清 lint-staged 盯针票(门252 已装车,翻勾+证据) (ab17635a2e)
- 🔧 その他:gb17-e1 完成即删(翻勾行移除,不留档) (c266040802)
- 📚 ドキュメント:L6065 现状升级落账 —— 生产源站 522 三连/ssh 隧道 bad handshake/三通道同断,原解阻判据不可执行,修复属机主带外(p7 席外网实测) (0362b423f7)
- 🔧 その他:gb17-e1 结清 git-guardian 指针形态票(翻勾+摘牌+证据) (fb2ba69985)
- 📚 ドキュメント:G-116 结清(代码镜像载体已删,等机主删 ref/GC 的前提随之失效) + USDT 事实纠偏(地址已非空) + 三枚自进化票复核注记(结清注记不成立,保持未勾) (74aa4f9dcf)
- 📚 ドキュメント:AGENTS.md 补 R4 漏点名补记 ⑤ —— 门 253 点名(接线对账 R4 清偿) (dfb48c1dcd)
- 🐞 修正:G-70 备份脚本 pg_dump 解析优先级 —— ProgramFiles 优先于旧机落点(换机后残留旧客户端会顶掉 18.6,报错形态与口令错同形,误导排障方向),全落空改 exit 2 显式未判定;影子副本已同步等值 (e478e9885e)
- 🚀 機能/改善:plan-fields-extract 补孤儿键退场档并接 CLI —— 侧车记录终于有"只退不抽"的合法出口 (1ce6414900)
- 🚀 機能/改善:G-395 请求档与实得档留痕 + 出处标签 —— 新增 EffortResolution(四层 source、requested/effective 两档、matched),formatConfigSnapshot 单点渲染;十一例测试移入 tests 面由 runner 实收集(原放 src 下不会被跑,不接线等于没验) (87b306dec1)
- 🔧 その他:lint-staged stdio 补丁器补自证 4 例 + 盯针门镜像对齐 —— 三针补丁此前只有生产脚本、无回归网 (6821396b31)
- 🚀 機能/改善:门 253 本体入库 + 镜像测试 + 落地通道盲绿修复 (85a41c1276)
- 🐞 修正:check-ps1-bom 补回 windowsHide 三处——本侧重写把对侧提交「给新装车的门 251 与其修复器补 3 处 windowsHide」的两处改动覆盖掉了(门 52 全量档会判),按原意在全部三个派生 git 调用点补齐:git() / selfTest.run() / selfTest.runNoPs(),末者为本侧重写新增的夹具。证据:产物 --self-test 11 例全 PASS(判据六 + 端到端五),node --check 通过,常规档扫描 77 带BOM 77 存量缺 0 (e87d13d918)
- 🔧 その他:门 30 validate-i18n-integrity 修法席收口 —— D1 三态哨兵与 D2 定根在镜像里钉死,9/9 (42aff94ccf)
- 📚 ドキュメント:gb17-chair 结清 5 枚(G-29 回潮再结/门134后续批/同一契约两份声明/G-41/两类残行)+ 金丝雀注记纠偏(灰度分流实测零命中,保持未勾) (b3c71c1f0a)
- 🐞 修正:门 31 check-ps1-bom 修法席收口 —— 三处判据缺陷已修,镜像 13/13 (76383db3e0)
- 🚀 機能/改善:新守门 check-gate-triggers.mjs 接进提交链(射程声明完备性,id 253) (c8455ef160)
- 🚀 機能/改善:lint-staged stdio 三针盯针门挂进守门批(id 252,warn) (34425c621d)
- 🐞 修正:deferred 队列终态文案与代码行为对齐——撤回队列项走 message-input.tsx 的 onUndo:先 recordQueueSendOutcome(...,'deferred') 再 removeQueued,消息实际已出队;旧文案「仍保留在队列中」把用户引向等待一次不会发生的重发,五语言同批改为「已从队列移除,请重新发送」。证据:门30 validate-i18n-integrity 通过(5 文件)、check-i18n-keys 19278 键 5 语 parity OK、scan-i18n-zh-residue zh-TW/ko/ja 均无中文残留、五语 leaf 均为 string 且无同名自套 (db904288fb)
- 🐞 修正:号池页代理显隐按钮圆角归 control 档 —— 门 150 单族判红(account-pool/page.tsx:1579 裸 rounded-md=6px,应为 sm=4px) (3179d3e2ad)
- 🐞 修正:dispatch-board 镜像走 __test__ 出口并纠正一次红测试 —— 枚 102c21f68c8 落地时 ⑰b 因我只做顶层 export 未进 __test__ 而红(实现自证绿、镜像红的半套入库,§10 反面);现 self-test 29/29、镜像 20/20 (072bec49e7)
- 🐞 修正:dispatch-board 补 scope-placeholder 维 —— 占位符路径(<x>-spec、通配、含空白)以前被当成真作用域,会把席派到一条不存在的文件上并给它发"这块地没人占"的合格证(今晚实测:一席据此领到 packages/shared/src/ui/<x>-spec/) (102c21f68c)
- 🔧 その他:小程序 ui-routes 自述钉按合并后源面重派(门 105 G5 维) (e2c90724a7)
- 🐞 修正:zh-TW 字形残留单点修正 + 离线包按新源重派(门 2j-shared blocking 红清偿) (58f4078e52)
- 🐞 修正:给新装车的门 251 与其修复器补 3 处 windowsHide(门 52 全量档红清偿) (695955befa)
- 🔧 その他:goal-b17 gb17-e5 认领(加复合租约) (d973b9d7ec)
- 🔧 その他:goal-b17 gb17-e4 认领(加复合租约) (42ef31b5eb)
- 🔧 その他:goal-b17 gb17-e3 认领(加复合租约) (21c584b4f8)
- 🔧 その他:goal-b17 gb17-e2 认领(加复合租约) (5e12de960d)
- 🔧 その他:goal-b17 gb17-e1 认领(加复合租约) (3c4ba5f0f9)
- 🔧 その他:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (53b18b238d)
- 📚 ドキュメント:重登被误摘的侧车退场档票(改用不撞桶名的等价表述,复合主键语义不变) (71ce65a9da)
- 🐞 修正:dispatch-board 补 dirty-inflight 那一维 —— 他席未提交的脏面以前只算不压,是"不打架"的另一半;自检 27/27、镜像 19/19(含反向锁:dirtyHit 为空时同票必须能排进来,防这一维变恒拒) (aa357de376)
- 🔧 その他:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (9ea4fac622)
- 🔧 その他:门 208 具名登记 2 处对外贡献 fork 克隆——消掉 CI 全量档的 blocking 红 (173381c761)
- 🔧 その他:门 30 validate-i18n-integrity 补三态自证据与 §22c 镜像 —— blocking 门此前无任何自证 (77fd720a81)
- 🐞 修正:取材一过性失败不再被读成判红(门 84/107/117/243) (a382488082)
- 📚 ドキュメント:守门 251 check-ps1-bom 补进点名索引(门 89 R4 义务) (be6a520abe)
- 🔧 その他:check-ps1-bom 补 §22c 镜像与 §22d 守卫 —— 一道 blocking 门此前"一 import 就打死宿主" (6dde87dfa3)
- 📚 ドキュメント:门 207 余量告急处置——git 网络与推送族删旧版留现行版(95937→94975 B,余量 63→1025) (9af1033f1b)
- 📚 ドキュメント:AGENTS.md git 网络与推送族旧副本的逐字迁出件(先入库立凭据) (f6e9093843)
- 📚 ドキュメント:G-19 行去尽字面量(两处) + 记入今日扫全读数 —— 该行把令牌前缀写成可重跑命令与 git grep 样本,导致每条 plan-head 快照自繁殖一份外泄面串(今晚实测 619 枚快照即此源);改为"现读 secrets 单存件头 6 字符作 pattern"的取法,并记 630 命中/6 真令牌/621 已清/3 处待机主轮换保留;本行不翻勾,未收格=轮换属机主职权 (e26491797d)
- 🔧 その他:抽取器注释措辞换掉被禁字面量——消掉一处假阳性的第二把尺子告警 (2594a64ee0)
- 🐞 修正:adoptMovesOf 的搬支补整族闸——归并不会再把违禁桶搬上活键 (adbe260628)
- 🐞 修正:销掉一枚已入库迁移的水印欠账(门 47 自愈补盘 ⇒ 提交才销账) (85380ee43a)
- 🐞 修正:合并面的活文档放大定罪改用单源尺 —— 假 F11 不再焊死全仓推送(真放大照旧拒推) (e5383dfb68)
- 📚 ドキュメント:立两枚可派单真工作票(侧车孤儿键退场档缺失 / ruff 不在提交链) (1382eae649)
- ♻️ リファクタ:4 条旧号孤儿键的 waiting/blocking 收敛到活键读数(退场前置) (d1c4029f3e)
- 🔧 その他:净面复量抓到的 4 条 ruff 真红清零(旁路收编带进 HEAD 的漏网面) (88af2ba859)
- 📚 ドキュメント:两枚票注记已入库格(防下一班重复派单) —— gitdir 票 ③修复面已落 枚 5e11de4b1f5、G-70 票 ③调度面已落 枚 b2fecee0ae(①角色面归对席 8def005420);两行均不翻勾,未收格逐条点名在行内;凭据=主席亲自复跑的镜像 31/31 与 readiness 7/7 末行 (15cc8f947f)
- 🐞 修正:摘除留痕回捞腿补两档判据——16 枚假阳性不再死锁完成即删 (e03b22c295)
- 🚀 機能/改善:dispatch-board 补派单书档(--brief) —— 今晚三条硬约束从"主席记得"变成"随行印出" (031d555cc0)
- 🐞 修正:check-ps1-bom 两处裸派生 git 补 stdio(门 193)+ 给 193/251 补 stagedTriggers (532880b398)
- 📚 ドキュメント:补回第⑤刀误删的 README 在库行（纠偏） (65d1ba9730)
- 🚀 機能/改善:「更傻瓜」第⑤刀——号池导入框支持拖拽 .json / 点「选文件」,不必再手抄粘贴 (477c441a57)
- ♻️ リファクタ:H01 改判出等条件桶(归:机主微信扫码会话面) (06d42e60b0)
- ♻️ リファクタ:H01 出等条件桶——标头按侧车投影改写(归:机主微信扫码会话面) (c73967172a)
- 📚 ドキュメント:lint-staged stdio 三针盯针结清——只读门现读绿(3/3 针)、已挂 git-guardian 巡检(引用 6 处,实现在 lib)、接线锁 8/8 通过;按 §12e 不进提交链 (2d672a55d5)
- 📚 ドキュメント:门 207 体积清偿批二(语义裁决,非字节重放) + 两枚只读器的 npm 别名与 R4 点名同批接入 (b6e4c20c81)
- 🚀 機能/改善:号池入口层「登记面/未装车面」分档——编排器平台注册表(FROM_PROVIDERS,单一登记入口,§0.6):qoder/codearts parse 通过但 --from 运行期明示未判定(exit 2)并点名当下真出路(后台导入/--file),不再用笼统「暂不支持」把「号池认该平台」与「本机提取器未开发」两件事混成一条(§0.3 不猜,§0.8 不指跑不通的路;新平台取证后补登记即接入)。容量归零哨兵复活出口补齐 qoder/codearts(qoder=池内通用巡检换票优先+重授权走导入并预告提取器未装车;codearts=适配器 refresh 优先+无签到引擎不被要求签到)。测试:⑦⑧两镜像锁注册表形状与分档,M5b 扩两平台断言;三套 13+8+12 例全绿,门自检 30 例全绿。后续派单格(交后手,取证类):qoder/codearts 本机会话落点取证→登记适配器;workbuddy/codearts getQuota 上游端点取证;池侧四平台一键重登(桌面停靠浏览器单元向 pool 侧推广);签到任务中心(攒积分)按实证端点逐平台扩展 (bc2f677e6f)
- 🐞 修正:门 22 的"存量恒红"换成只减不增的差值棘轮(§0.5) + 对齐 GATEKEEPERS 过期四行 (9415fe1937)
- 🐞 修正:备份链调度面跟上现读形态 —— psql 走探测式、日志从 DevEnv 根派生、调度器自写留痕;readiness 判据钉现行不变量(7/7) (b2fecee0ae)
- 🐞 修正:清偿 shared zh-TW 简体字残留 (5c771301ad)
- 🐞 修正:quick-notes 接线用例补 @ihui/rn-app 类型引用,门 39 V1 存量清零 (e7f626e736)
- 🔧 その他:补票面点名的形状锁「指针形态机上不得出现对 .git 的 mkdirSync」—— 现读零处 + 变异对照点名 writeGitdirPointer + 异形大文件真跑一例(归档后仍落文件不是目录);gb17-v1 隔离沙箱三形态演练(合法指针/25MB 异形文件/目录)rc 全 0,异形那例 61ms 自愈且现场已归档、工作区根零残骸 (2ad6e1b636)
- 🐞 修正:指针形态 .git 的异形现场不再被守护静默删掉 + lint-staged 三针盯针接进巡检轮 (5e11de4b1f)
- 📚 ドキュメント:L6067 部署机格进展落账——SSH 只读核实今日构建已落地,旧滞留前提过期;bad handshake 属已知 530 窗口不追动 (d8b012625e)
- 🔧 その他:web ui-routes 自述钉随 HEAD 再钉一次 (d01913072d)
- 🚀 機能/改善:「比他们更傻瓜」第④刀——号池管理页出「体检徽章列」(六态+闲置天数,机主"都要") (7a110c4deb)
- 🐞 修正:G-19 明文面收口——ssh config 脱明文走 secrets 文件+包装器(ssh 实测通),3 处副本隔离/净身,新发现 cloudflared 构建默认值是第 8 副本源;余轮换归机主面(API token 无 ZT 权限) (01d3a1be13)
- 🔧 その他:他席 i18n/新增页落地后重派三处派生件 (4f929a5a4f)
- 🐞 修正:陈旧副本重放不再把活着的会话永久锁死(stale-sibling 放行轮转) (e6f75c3418)
- 🐞 修正:构建冷却必须比对它自己记录的 head —— 记录坏/HEAD 取不到一律显式未判定,不再默认压住或默认放行 (d9f6e2e2a6)
- 🔧 その他:部署成本阀墙钟闸 240→480 分钟(三闸配额对齐) (63acf50477)
- 🐞 修正:账号池容量归零告警按 provider 点名复活出口——trae 凭据死亡时收信人的当场动作是重开 Trae 客户端登录一次,worker trae-session-sync 每 10 分钟自动回灌新会话入池(2026-10-26 跨 profile 兜底扫描落地后这条链在真机才跑得通),不再要求人工记着跑命令或找后台按钮;workbuddy 点名 --from workbuddy 重提取;无定制出口的 provider 不被硬塞别家文案(§0.8 出路必须真跑得通)。镜像 M5b 例 + 门自检查表锁三型(12+30 例全绿) (94b9133cb8)
- 🐞 修正:ps1-add-bom 的"全仓已清零"不再被打成用法错 —— 出口三态各自有话说 (d07bc892a9)
- 🚀 機能/改善:备份只读角色幂等建制器——SELECT 探测后只补差值,默认 dry-run,apply 单事务并回读自证,口令只报长度不覆盖不打印;判据复用 pg-restore-drill 的口令链单源,落 deploy 之外的 node 侧因 .sql 一次性载体做不到先探测(执行席 g70-backup 交回;主席复跑自检十一例与镜像廿五例全绿,本机无超管身份时按未判定 exit 2 不猜) (8def005420)
- 🚀 機能/改善:排他切席板 dispatch-board + lint-staged 盯针门入库 —— 把主席手三条派单纪律变成器物 (429cf91aac)
- 🔧 その他:违禁桶兜底清扫——HEAD面等条件/待拍板未勾行自动摘除(两道机主禁令的执行器物化,留痕f12-purge;复翻席请同步摘形态,事实内容按各批结清提交保留) (4146ce30ab)
- 🔧 その他:ruff 存量 36 枚清零(CI ruff check . 同口径红清偿) (3161e42705)
<!-- END RECENT UPDATES -->

<p align="center">
  <sub>Built by <strong>吉林省愛智匯人工知能科技有限公司</strong> · オープンソース共創、あなたと共に</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star us on GitHub</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/fork">Fork to build your own</a> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues">Request a feature</a>
</p>
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
