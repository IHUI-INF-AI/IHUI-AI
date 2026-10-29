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
  <strong>自ホスト型フルスタック AI プラットフォーム</strong>：マルチモデル対話 · OpenAI 互換 API 中継 · マルチプラットフォーム号池 · チェックインとキープアライブ · Agent/MCP · ナレッジとマルチ配信 · 8 クライアント + CLI
</p>

<p align="center">
  <strong>オンライン Demo</strong> · <a href="https://aizhs.top">https://aizhs.top</a> &nbsp;|&nbsp; <strong>GitHub</strong> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star</a>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License: Apache-2.0" /></a>
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

> **索引レイヤー。** 能力の概要・現算数字・クイックスタートは [`README.md`](./README.md) / [`README.en.md`](./README.en.md) と [`docs/engineering/`](./docs/engineering) を参照。規律は [`AGENTS.md`](./AGENTS.md)。

## この README でできること

**IHUI-AI** は自ホスト可能なフルスタック AI 基盤です。対話・**OpenAI 互換 API 中継**・**号池と自動チェックイン**・Agent/MCP・ナレッジ/配信・教育/コミュニティを同一バックエンドで支え、Web / デスクトップ / アプリ / 小程序 / CLI / 拡張に届きます。規模数字は取数キー（`llmModels` / `publishPlatforms` / `apiRoutes` 等）のみ—[`README.md` の生成ブロック](./README.md#关键数字现算)を参照。

### 対話とモデル

- マルチモデル対話（`llmModels`）、ストリーミング、パラメータ/お気に入り/履歴。BYOK・Prompt/Persona・Plan-Act・タスク進捗・キュー操作・マルチペイン。
- 音声 STT/TTS（WebRTC 含む）、画像/動画タスク、セッションインポート。

### API 中継

- 開発者 Key で `/v1/chat/completions` 等。**従量課金**・高峰価格・白名单/クォータ・failover・Key プール熔断。
- Trae / WorkBuddy / CodeArts / Qoder 等 IDE アカウントを同一 `/v1` に接続。

### 号池

- **運営池**：最大 **12** provider（`RELAY_PROVIDERS`）。**池に入る ≠ チェックイン**。
- **個人池**：Web/RN/小程序。選号ポリシー・CAS 同期・refresh 対応平台は自動換票。
- `scripts/relay-account-pool.mjs` 等でローカル导入。

### チェックインとキープアライブ

- **白名单 4 平台のみ**：Trae / WorkBuddy / Qoder / MiniMax。WB タスク族。**キープアライブは代签しない**。
- **Cursor / Claude 製品アカウントの自動チェックインはなし**。

### 反代と出口

- **製品義**：多テナント OpenAI 形ゲートウェイ（任意 HTTP 反代コンソールではない）。
- 出口プロキシプール；`/api/checkin/*` → ai-service。

### Agent / MCP / ナレッジ / 商业 / 多端

- エージェント市場・ワークベンチ・MCP・ワークフロー。RAG・`publishPlatforms` 規模のマルチ配信。VIP/ウォレット/チーム。8 端 + CLI（`cliCommandFiles`）。

---

## 明確に「ではない」もの

| 誤解 | 事実 |
| --- | --- |
| 「12 平台が全部チェックイン」 | 池 12；**チェックインは 4 平台のみ** |
| Cursor / Claude チェックイン | エンジンなし |
| 「無料無制限中継」 | 課金・クォータ・熔断あり |
| 任意 HTTP 反代パネル | OpenAI 形 GW + 号池 + 出口代理 |

詳細索引・クイックスタート・8 端一覧は以下の目次から（従来の長文ドキュメントを保持）。


---

## 目次

- [クイックスタート](#クイックスタート) · [デプロイ](#デプロイ) · [FAQ](#faq) · [お問い合わせ](#お問い合わせ)

---

## 詳細ドキュメント（長文は engineering 收纳件のみ）

ポジショニング・対标・宣言・品牌故事などの**营销長文**は本ファイルに二重掲載しません：

| テーマ | ドキュメント |
| --- | --- |
| 定位・宣言・GEO | [`readme-01-positioning`](./docs/engineering/readme-01-positioning.md) |
| 選ぶ理由・対比・シナリオ | [`readme-03-why-comparison-scenarios`](./docs/engineering/readme-03-why-comparison-scenarios.md) |
| 技術スタック・8端・モジュール | [`readme-04-architecture-and-modules`](./docs/engineering/readme-04-architecture-and-modules.md) |
| 物語・SEO・Keywords | [`readme-08-seo-keywords-story`](./docs/engineering/readme-08-seo-keywords-story.md) |

規模数字は [`README.md` の生成ブロック](./README.md#关键数字现算) と `pnpm doc:numbers` のみ（手書き 118 モデル等は使わない）。

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
## FAQ

比較表・コスト試算・40+ 製品対标の長文は [`readme-03-why-comparison-scenarios`](./docs/engineering/readme-03-why-comparison-scenarios.md) と [`readme-07-faq-roadmap-commerce`](./docs/engineering/readme-07-faq-roadmap-commerce.md) のみに置きます（本 README に第二套を載せない）。

## お問い合わせ

- サイト / ドキュメント: <https://aizhs.top>
- Issue: <https://github.com/IHUI-INF-AI/IHUI-AI/issues>
- セキュリティ: [`SECURITY.md`](./SECURITY.md)
- 連絡先全文: [`readme-03`](./docs/engineering/readme-03-why-comparison-scenarios.md) · [`readme-07`](./docs/engineering/readme-07-faq-roadmap-commerce.md)

---

## 品牌故事・共創ビジョン（归档）

物語・開発者宣言・SEO 長文の全文は [`readme-08-seo-keywords-story`](./docs/engineering/readme-08-seo-keywords-story.md) と [`readme-01-positioning`](./docs/engineering/readme-01-positioning.md) を参照。本 README では第二の营销开篇を載せません。

---

## License

[Apache License 2.0](LICENSE)

---

<div align="center">

このプロジェクトが役に立ったら ⭐ をお願いします。

</div>
