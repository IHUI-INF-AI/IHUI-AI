<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# CI/CD Secrets 配置说明

本文档列出所有 GitHub Actions 工作流所需的 secrets 和环境变量。

> **说明**：下方「必配 Secrets（生产环境）」部分为应用运行时所需的配置项（通常通过 `.env` 注入到运行中的服务），并非全部以 `${{ secrets.* }}` 形式直接出现在工作流 YAML 中。CI 流水线中测试多使用本地服务容器（如 postgres:18）与硬编码测试凭据，因此这些生产密钥主要用于部署后的运行环境。「CI/CD 专用 Secrets」则为工作流中通过 `${{ secrets.* }}` 直接引用的变量。

## 必配 Secrets（生产环境）

### 数据库

- `DATABASE_URL` — 生产数据库连接字符串（PostgreSQL）
- `DATABASE_READ_REPLICA_URL` — 只读副本连接字符串（可选）

### 认证

- `JWT_SECRET` — JWT 签名密钥
- `NEXTAUTH_SECRET` — NextAuth.js 密钥

### 支付

- `ALIPAY_APP_ID` — 支付宝应用 ID
- `ALIPAY_PRIVATE_KEY` — 支付宝私钥
- `ALIPAY_PUBLIC_KEY` — 支付宝公钥
- `WECHAT_PAY_MCH_ID` — 微信支付商户号
- `WECHAT_PAY_API_KEY` — 微信支付 API 密钥
- `WECHAT_PAY_CERT_PATH` — 微信支付证书路径

### 第三方服务

- `REDIS_URL` — Redis 连接字符串
- `OSS_ACCESS_KEY_ID` — 对象存储 Access Key
- `OSS_ACCESS_KEY_SECRET` — 对象存储 Secret Key
- `OSS_BUCKET` — 对象存储 Bucket 名
- `OSS_REGION` — 对象存储区域

### AI 服务

- `OPENAI_API_KEY` — OpenAI API Key
- `ANTHROPIC_API_KEY` — Anthropic API Key
- `DEEPSEEK_API_KEY` — DeepSeek API Key
- `QWEN_API_KEY` — 通义千问 API Key
- `COZE_API_KEY` — Coze API Key

### 消息推送

- `SMTP_HOST` — SMTP 邮件服务器
- `SMTP_PORT` — SMTP 端口
- `SMTP_USER` — SMTP 用户名
- `SMTP_PASS` — SMTP 密码
- `SMS_ACCESS_KEY_ID` — 短信服务 Access Key
- `SMS_ACCESS_KEY_SECRET` — 短信服务 Secret Key

## CI/CD 专用 Secrets

### 发布与部署

- `NPM_PUBLISH_TOKEN` — npm granular token（**已配置**，2026-10-19）。用途：`release-cli.yml` 发布 `ihui-cli`、`npm-bootstrap.yml` 的 publish job。形态：All packages + read-write + 勾 Bypass 2FA，有效期 90 天（2027-01-17 到期，到期前需在 npm Tokens 页重新生成）。项目**不启用 2FA**、不登记 Trusted Publisher（AGENTS.md §0 第 11 条），故该 token 是 CLI 通道唯一鉴权方式
- `NPM_TOKEN` — **没有任何 workflow 引用 `secrets.NPM_TOKEN`**（2026-10-28 实测 `gh secret list` 21 枚里没有它）。它只是 `release-sdk.yml` npm job 内部的**环境变量名**，由该文件 `NPM_TOKEN: ${{ secrets.NPM_PUBLISH_TOKEN }}` 那一行赋值 ⇒ 照本行旧文另配一枚名为 `NPM_TOKEN` 的 secret 不会被任何 job 读到（旧文"SDK 通道专用 token 尚未配置"是跑不通的出路）。"npm 账号 `ihui-ai` 已建成"一句亦不成立：2026-10-28 现读 `registry.npmjs.org/-/v1/org/ihui` 与 `/-/v1/org/ihui-ai` **均 404**（对照包 `ihui-cli` 200、`@ihui-ai/sdk` 404），`ihui-cli@1.0.0` 是发在用户账号下的**非 scoped** 包，不能当 org 存在的证据。SDK 通道真卡点=没有 npm org，出路 = `gh workflow run npm-bootstrap.yml -f action=org_create`（邮箱 OTP 由机主提供）
- `DOCKER_REGISTRY` — Docker 镜像仓库地址
- `DOCKER_USERNAME` — Docker 仓库用户名
- `DOCKER_PASSWORD` — Docker 仓库密码
- `DEPLOY_SSH_PRIVATE_KEY` — 部署服务器 SSH 私钥 —— **仅服务已退役的 `blue-green-deploy.yml`(2026-09-07 退役,目标 Linux/Docker 蓝绿架构已不存在),可不再维护;生产部署走生产机 `IHUI-DEPLOYLOOP`,不需要任何 SSH secret**
- `DEPLOY_HOST` — 部署服务器地址 —— **仅服务已退役的 `blue-green-deploy.yml`,可不再维护**。2026-11-03 实测该值非空但公网 DNS 解析不到(`getaddrinfo ***`),工作流首个 fail-fast 闸已阻止误跑;生产部署与它无关
- `DEPLOY_USER` — 部署服务器用户名 —— **仅服务已退役的 `blue-green-deploy.yml`,可不再维护**(同上)

### 代码签名（SignPath Foundation）

`release-cli.yml`(CLI 的 `ihui.exe`)与 `release-desktop.yml`(桌面端 NSIS 安装包)共用同一组 SignPath 凭据做 Authenticode 签名。四项**全部配置**才会启用签名步骤（`SIGNPATH_CONFIGURED` 由 job env 折算）；缺任意一项则签名步骤整体跳过。**两条链的后果不同**：`release-cli.yml` 维持原行为（流水线不红，但发的是未签名 exe）；`release-desktop.yml` 自 2026-11-03 起由 `signature-gate` **判红**，且 `latest.json` 不更新（详见下节与 [`docs/DESKTOP_CODE_SIGNING.md`](../docs/DESKTOP_CODE_SIGNING.md)）。

- `SIGNPATH_API_TOKEN` — SignPath API Token（submitter 权限）
- `SIGNPATH_ORGANIZATION_ID` — SignPath Organization ID
- `SIGNPATH_PROJECT_SLUG` — SignPath Project Slug
- `SIGNPATH_SIGNING_POLICY_SLUG` — SignPath Signing Policy Slug（如 `release-signing`）

> SignPath 侧还需配置 Artifact Configuration：`upload-artifact` 默认打成 ZIP，故根元素须为 `<zip-file>`，其下为 PE 签名项（CLI 是 `ihui.exe`；桌面端是 `bundle/nsis/*-setup.exe`，产品名含中文时按后缀 `-setup.exe` 匹配）；否则签名请求会因找不到可签名对象失败。
>
> **桌面端多一条硬依赖**：Tauri 自动更新用 minisign `.sig` 校验安装包**字节**，Authenticode 签名改了字节 ⇒ 签名步会用 `DESKTOP_TAURI_PRIVATE_KEY` / `DESKTOP_TAURI_KEY_PASSWORD`（该 workflow 原本就在用，无需新增）就地 `tauri signer sign` 重算 `.sig`；重算失败即硬失败——宁可不发也不发一个"更新链断裂"的 Release。首次带凭据的桌面发版必须核对：Release 资产里 `.exe` 与同名 `.sig` 都是**替换后**的那一份，且 `latest.json` 的 signature 与之匹配。

### 桌面端代码签名（Windows SignPath / macOS Developer ID）

> 桌面端 `release-desktop.yml` 除与 CLI 链共用 SignPath 四项凭据外，**另需一整套 Apple 凭据**（Developer ID 证书 + 公证通道）。判定口径见 workflow 的 job env：`SIGNPATH_CONFIGURED` = 四项 `SIGNPATH_*` 全非空；`APPLE_SIGNING_CONFIGURED` = 证书三件 **且**（公证通道 A 三件 **或** 通道 B 三件）。
> **缺凭据 ≠ 可发布的"降级"**：签名/公证步会整体跳过，但 `signature-gate` 判红、`latest.json` 不再更新（已装客户端收不到未签名包；GitHub Release 仍可能留有未签名资产）。完整申请、配置与验证步骤见 [`docs/DESKTOP_CODE_SIGNING.md`](../docs/DESKTOP_CODE_SIGNING.md)。

| Secret                                                     | 用途                                                                                                    | 必填条件                                                                                             | 申请入口                                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `SIGNPATH_API_TOKEN`                                       | SignPath API Token（submitter 权限，提交签名请求）                                                      | Windows Authenticode 必填；与 Organization ID / 两个 slug 四项**全齐**才启用签名步                   | [signpath.io](https://signpath.io/) → User Settings → API Tokens（开源免费计划在 [signpath.org](https://signpath.org/) 申请） |
| `SIGNPATH_ORGANIZATION_ID`                                 | SignPath Organization 的 UUID                                                                           | 同上                                                                                                 | [signpath.io](https://signpath.io/) → Organization settings 页                                                                |
| `SIGNPATH_PROJECT_SLUG`                                    | SignPath Project slug（如 `ihui-ai`）                                                                   | 同上                                                                                                 | [signpath.io](https://signpath.io/) → 项目设置                                                                                |
| `SIGNPATH_SIGNING_POLICY_SLUG`                             | SignPath Signing Policy slug（如 `release-signing`，需勾 Restricted 人工审批）                          | 同上                                                                                                 | [signpath.io](https://signpath.io/) → Signing Policy                                                                          |
| `DESKTOP_WIN_SIGNER_SUBJECT`                               | 期望的证书主体**子串**（SignPath Foundation 签发为 `SignPath Foundation`）                              | 可选：不填时 workflow 按 `SignPath Foundation` 断言；**将来换自有 EV 证书只改这一枚**，不动 workflow | 由签名证书主体决定（[signpath.io](https://signpath.io/) 项目页可查）                                                          |
| `APPLE_CERTIFICATE`                                        | `Developer ID Application` 证书 `.p12` 的**单行** base64（`base64 -i x.p12 \| tr -d '\n'`）             | macOS 签名/公证必填（证书三件之一）                                                                  | [developer.apple.com/account](https://developer.apple.com/account) → Certificates → Developer ID Application                  |
| `APPLE_CERTIFICATE_PASSWORD`                               | 导出 `.p12` 时设置的密码                                                                                | 同上                                                                                                 | 本机导出 p12 时自设                                                                                                           |
| `APPLE_SIGNING_IDENTITY`                                   | `Developer ID Application: <名称> (<TEAMID>)`，取 `security find-identity -v -p codesigning` 的输出整串 | 同上                                                                                                 | 同上（Apple Developer Program 会员 $99/年，报名见 [developer.apple.com/programs](https://developer.apple.com/programs/)）     |
| `APPLE_ID`                                                 | Apple ID 邮箱                                                                                           | 公证通道 **A**（推荐）：与 `APPLE_PASSWORD` / `APPLE_TEAM_ID` **成套**，三条齐才算配置               | [appleid.apple.com](https://appleid.apple.com/)                                                                               |
| `APPLE_PASSWORD`                                           | **App 专用密码**（`xxxx-xxxx-xxxx-xxxx`；不能用 Apple ID 主密码）                                       | 同上                                                                                                 | [appleid.apple.com](https://appleid.apple.com/) → 登录与安全 → App 专用密码                                                   |
| `APPLE_TEAM_ID`                                            | 10 位 Team ID                                                                                           | 同上                                                                                                 | [developer.apple.com/account](https://developer.apple.com/account) → Membership                                               |
| `APPLE_API_KEY`                                            | App Store Connect API **Key ID**（不是 `.p8` 文件名）                                                   | 公证通道 **B**（可选替代）：三条齐才算配置；A、B 二选一即可，两套都配时 workflow **优先 A**          | [App Store Connect](https://appstoreconnect.apple.com/) → 用户与访问 → 密钥                                                   |
| `APPLE_API_ISSUER`                                         | 同页的 Issuer ID（UUID 形态）                                                                           | 同上                                                                                                 | 同上                                                                                                                          |
| `APPLE_API_KEY_PATH`                                       | `.p8` 在 **runner 上的路径**                                                                            | 同上；**本仓库未内置把 `.p8` 落盘的步骤**，走 B 需自行在前置步骤写入该路径                           | 同上（下载 `.p8` 后自行落盘）                                                                                                 |
| `DESKTOP_TAURI_PRIVATE_KEY` / `DESKTOP_TAURI_KEY_PASSWORD` | Tauri 更新器 minisign 私钥与密码（签名改字节后用同一份字节重算 `.sig`）                                 | 已配置，**不属本次签名申请范围**；缺它则 `.sig` 重算失败 ⇒ 硬失败                                    | 本机既有私钥（详见 `docs/RELEASE.md` 的前置 Secrets 表）                                                                      |

> `artifact-configuration-slug` **不是** GitHub secret：它在 SignPath 后台配置（桌面端对应 PE 文件 `*-setup.exe`，Packaging 选 `Single file` 回传裸 exe 或选 `Zip` 由 workflow 自动解压，两种都兼容）。把它当 secret 填会出现"四项不齐 ⇒ 签名步整体跳过"。

### AWS（S3 生命周期漂移检测）

- `AWS_ACCESS_KEY_ID` — AWS 访问密钥
- `AWS_SECRET_ACCESS_KEY` — AWS 秘密密钥
- `AWS_REGION` — AWS 区域（未设置时默认 `us-east-1`）
- `S3_BUCKET` — S3 Bucket 名（可通过 workflow_dispatch 的 `bucket` 输入覆盖）

### 可观测性

- `SLACK_WEBHOOK_URL` — Slack 告警 Webhook（可选）
- `DINGTALK_WEBHOOK_URL` — 钉钉告警 Webhook（可选）

### Gitee 发布资产（国内主通道，2026-11-03 复活）

> **Gitee 为国内主通道：仓库浏览 + 发布包下载走 Gitee，GitHub 只作境外/兜底。**
> 2026-11-03 已初始化 `JLSLSSZWHYXGS_0/IHUI-AI` 的 main（逐字等于 origin/main 树的快照提交），
> 并完成 `desktop-v0.1.77` 的资产补传与逐件字节+SHA256 对账。
> `release-desktop.yml` 的 `sync-gitee` 与 `backfill-gitee-assets.yml` 默认启用；
> 显式关闭开关：仓库 Settings → Variables → `GITEE_SYNC_ENABLED=false`。
> 注意：2026-10-23 下线的**代码历史镜像**不恢复（不做逐提交同步），Gitee 仓库只保留快照 main。

- `GITEE_TOKEN` — Gitee Personal Access Token（初始化 / 发版 / 补传的唯一凭据）
- `GITEE_OWNER` — `JLSLSSZWHYXGS_0`

> ~~`GITCODE_TOKEN` / `GITCODE_OWNER`~~ — **已废弃（2026-10-23）**。GitCode 渠道整体弃用，两个 secret
> 可在仓库 Settings → Secrets 里删除；`mirror-to-cn.yml` 与 `scripts/setup-mirror-repos.mjs` 已同时删除。

## 可选 Secrets

### 第三方登录

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — GitHub OAuth
- `WECHAT_APP_ID` / `WECHAT_APP_SECRET` — 微信开放平台

### 其他

- `SENTRY_DSN` — Sentry 错误追踪 DSN（可选）
- `ANALYZE_BUNDLE` — 是否分析打包体积（设为 "true" 启用）

## 配置方法

1. 进入 GitHub 仓库 → Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 输入 Name 和 Value
4. 点击 "Add secret"

> **注意**：`GITHUB_TOKEN` 由 GitHub Actions 自动注入，无需手动配置。工作流中通过 `${{ secrets.GITHUB_TOKEN }}` 引用即可。

## 工作流依赖矩阵

> 下表基于 `.github/workflows/` 目录下各工作流文件中实际引用的 `${{ secrets.* }}` 变量整理。标记「（无）」表示该工作流当前未直接引用任何 secrets（可能使用本地服务容器、硬编码测试凭据或依赖运行中的外部服务）。

| 工作流                    | 所需 Secrets                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ci.yml                    | （无）                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ci-monorepo.yml           | （无）                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| build.yml                 | （无）                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| e2e.yml                   | （无）                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| knip.yml                  | （无）                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| openapi-check.yml         | （无）                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| visual-regression.yml     | （无）                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| blue-green-deploy.yml     | （无，当前通过 `environment` 选择 staging/production，部署步骤未引用 secrets）                                                                                                                                                                                                                                                                                                                                                                                    |
| migration-tests.yml       | （无，使用本地 postgres 服务容器 + 硬编码测试凭据 `postgresql://postgres:test@localhost:8810/test`）                                                                                                                                                                                                                                                                                                                                                              |
| observability-drills.yml  | （无，依赖运行中的服务）                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| s3-lifecycle-drift.yml    | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`                                                                                                                                                                                                                                                                                                                                                                                           |
| ws-loadtest.yml           | （无，依赖运行中的服务）                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| smoke-new-modules.yml     | （无）                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| release-cli.yml           | `NPM_PUBLISH_TOKEN`（**已配置**，granular token + Bypass 2FA）；`SIGNPATH_API_TOKEN`/`SIGNPATH_ORGANIZATION_ID`/`SIGNPATH_PROJECT_SLUG`/`SIGNPATH_SIGNING_POLICY_SLUG`（**未配置**，SignPath 批准后填入；缺任一项则 Windows 签名步骤跳过，发布仍为未签名 exe）；`GITHUB_TOKEN` 自动提供。**不读** `NPM_TOKEN`，也**不依赖** Trusted Publishing/OIDC（OIDC 仅作前向兼容尝试，失败自动回退 token）                                                                  |
| release-desktop.yml       | `SIGNPATH_API_TOKEN`/`SIGNPATH_ORGANIZATION_ID`/`SIGNPATH_PROJECT_SLUG`/`SIGNPATH_SIGNING_POLICY_SLUG`（**未配置**，与 release-cli 同一组；缺任一项则 Windows 签名步跳过，发布仍为未签名安装包）；`DESKTOP_TAURI_PRIVATE_KEY`/`DESKTOP_TAURI_KEY_PASSWORD`（已配置，构建与 `.sig` 重算共用）；`GITEE_TOKEN`/`GITEE_OWNER`（2026-11-03 复活为国内主通道；`sync-gitee`/`backfill` 默认启用，设 Variables `GITEE_SYNC_ENABLED=false` 可关）；`GITHUB_TOKEN` 自动提供 |
| release-sdk.yml           | **不新增 secret**：该 job 的环境变量 `NPM_TOKEN` 由 `secrets.NPM_PUBLISH_TOKEN`（已配置）映射而来，仓内不存在也不需要 `secrets.NPM_TOKEN`（见上方 `NPM_TOKEN` 条）；`PYPI_TOKEN`（未配置）、`MAVEN_USERNAME`/`MAVEN_TOKEN`（未配置）、`NUGET_API_KEY`（未配置）；`GITHUB_TOKEN` 自动提供                                                                                                                                                                          |
| npm-bootstrap.yml         | `NPM_BOOT_PUBKEY`, `NPM_BOOT_EMAIL`, `NPM_BOOT_USERNAME`, `NPM_BOOT_PASSWORD`（已配置，账号已建成）；`NPM_PUBLISH_TOKEN`（**已配置**，publish job 使用）；`SIGNPATH_EMAIL`（已配置）；`NPM_VERIFY_URL`（未配置，仅在重新走 email 验证时需要）。`trusted_publisher` 分支已于 2026-10-19 删除                                                                                                                                                                       |
| weekly-security-audit.yml | `GITHUB_TOKEN`（GitHub 自动提供，无需手动配置）                                                                                                                                                                                                                                                                                                                                                                                                                   |
| miniapp-preview.yml       | （无）                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
