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
- `NPM_TOKEN` — npm 发布令牌（用于 `release-sdk.yml` 发布 `@ihui/sdk` 到 npm registry）。**尚未配置**：npm 账号 `ihui-ai` 已建成（`ihui-cli@1.0.0` 已发布），缺的是 SDK 通道专用 token。建议复用与 `NPM_PUBLISH_TOKEN` 相同的 granular 形态（All packages + read-write + 勾 Bypass 2FA）。未配置时 `release-sdk.yml` real 模式 npm gate 判红，不会静默跳过
- `DOCKER_REGISTRY` — Docker 镜像仓库地址
- `DOCKER_USERNAME` — Docker 仓库用户名
- `DOCKER_PASSWORD` — Docker 仓库密码
- `DEPLOY_SSH_PRIVATE_KEY` — 部署服务器 SSH 私钥(工作流 `blue-green-deploy.yml:34` 读的就是这个名字;旧文档写的 `DEPLOY_SSH_KEY` 不存在,照它配了也不会生效)
- `DEPLOY_HOST` — 部署服务器地址 —— **2026-10-22 现读 `gh api repos/<owner>/<repo>/actions/secrets` 三枚里只注册了私钥这一枚,`DEPLOY_HOST`/`DEPLOY_USER` 均缺 ⇒ `ssh-keyscan -H ""` 当场 exit 1,蓝绿部署结构性跑不起来(不是构建问题)**
- `DEPLOY_USER` — 部署服务器用户名 —— 同上,未注册

### 代码签名（SignPath Foundation）

`release-cli.yml`(CLI 的 `ihui.exe`)与 `release-desktop.yml`(桌面端 NSIS 安装包)共用同一组 SignPath 凭据做 Authenticode 签名。四项**全部配置**才会启用签名步骤（`SIGNPATH_CONFIGURED` 由 job env 折算）；缺任意一项则签名步骤整体跳过，发布仍是未签名产物，流水线不会因缺凭据而红。

- `SIGNPATH_API_TOKEN` — SignPath API Token（submitter 权限）
- `SIGNPATH_ORGANIZATION_ID` — SignPath Organization ID
- `SIGNPATH_PROJECT_SLUG` — SignPath Project Slug
- `SIGNPATH_SIGNING_POLICY_SLUG` — SignPath Signing Policy Slug（如 `release-signing`）

> SignPath 侧还需配置 Artifact Configuration：`upload-artifact` 默认打成 ZIP，故根元素须为 `<zip-file>`，其下为 PE 签名项（CLI 是 `ihui.exe`；桌面端是 `bundle/nsis/*-setup.exe`，产品名含中文时按后缀 `-setup.exe` 匹配）；否则签名请求会因找不到可签名对象失败。
>
> **桌面端多一条硬依赖**：Tauri 自动更新用 minisign `.sig` 校验安装包**字节**，Authenticode 签名改了字节 ⇒ 签名步会用 `DESKTOP_TAURI_PRIVATE_KEY` / `DESKTOP_TAURI_KEY_PASSWORD`（该 workflow 原本就在用，无需新增）就地 `tauri signer sign` 重算 `.sig`；重算失败即硬失败——宁可不发也不发一个"更新链断裂"的 Release。首次带凭据的桌面发版必须核对：Release 资产里 `.exe` 与同名 `.sig` 都是**替换后**的那一份，且 `latest.json` 的 signature 与之匹配。

### AWS（S3 生命周期漂移检测）

- `AWS_ACCESS_KEY_ID` — AWS 访问密钥
- `AWS_SECRET_ACCESS_KEY` — AWS 秘密密钥
- `AWS_REGION` — AWS 区域（未设置时默认 `us-east-1`）
- `S3_BUCKET` — S3 Bucket 名（可通过 workflow_dispatch 的 `bucket` 输入覆盖）

### 可观测性

- `SLACK_WEBHOOK_URL` — Slack 告警 Webhook（可选）
- `DINGTALK_WEBHOOK_URL` — 钉钉告警 Webhook（可选）

### Gitee 发布资产（release-desktop.yml / backfill-gitee-assets.yml）

> **只用于桌面端安装包的国内分发，不做代码镜像。** 2026-10-23 起国内代码镜像（Gitee 仓 + GitCode 仓）与
> `mirror-to-cn.yml` 作业已整体下线：机主确认该渠道早已弃用。留下这两个 secret 的唯一理由是
> 线上 `/desktop-feed.json` 的 Windows 包直链指向 Gitee release 附件（国内直连 GitHub 资产域名被重置），
> 去掉会让桌面端下载 404。

- `GITEE_TOKEN` — Gitee Personal Access Token（生成：https://gitee.com/profile/personal_access_tokens，勾选 `projects`）
- `GITEE_OWNER` — Gitee 用户名或组织名（当前值：`JLSLSSZWHYXGS_0`）

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

| 工作流                    | 所需 Secrets                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ci.yml                    | （无）                                                                                                                                                                                                                                                                                                                                                                                           |
| ci-monorepo.yml           | （无）                                                                                                                                                                                                                                                                                                                                                                                           |
| build.yml                 | （无）                                                                                                                                                                                                                                                                                                                                                                                           |
| e2e.yml                   | （无）                                                                                                                                                                                                                                                                                                                                                                                           |
| knip.yml                  | （无）                                                                                                                                                                                                                                                                                                                                                                                           |
| openapi-check.yml         | （无）                                                                                                                                                                                                                                                                                                                                                                                           |
| visual-regression.yml     | （无）                                                                                                                                                                                                                                                                                                                                                                                           |
| blue-green-deploy.yml     | （无，当前通过 `environment` 选择 staging/production，部署步骤未引用 secrets）                                                                                                                                                                                                                                                                                                                   |
| migration-tests.yml       | （无，使用本地 postgres 服务容器 + 硬编码测试凭据 `postgresql://postgres:test@localhost:8810/test`）                                                                                                                                                                                                                                                                                             |
| observability-drills.yml  | （无，依赖运行中的服务）                                                                                                                                                                                                                                                                                                                                                                         |
| s3-lifecycle-drift.yml    | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`                                                                                                                                                                                                                                                                                                                          |
| ws-loadtest.yml           | （无，依赖运行中的服务）                                                                                                                                                                                                                                                                                                                                                                         |
| smoke-new-modules.yml     | （无）                                                                                                                                                                                                                                                                                                                                                                                           |
| release-cli.yml           | `NPM_PUBLISH_TOKEN`（**已配置**，granular token + Bypass 2FA）；`SIGNPATH_API_TOKEN`/`SIGNPATH_ORGANIZATION_ID`/`SIGNPATH_PROJECT_SLUG`/`SIGNPATH_SIGNING_POLICY_SLUG`（**未配置**，SignPath 批准后填入；缺任一项则 Windows 签名步骤跳过，发布仍为未签名 exe）；`GITHUB_TOKEN` 自动提供。**不读** `NPM_TOKEN`，也**不依赖** Trusted Publishing/OIDC（OIDC 仅作前向兼容尝试，失败自动回退 token） |
| release-desktop.yml       | `SIGNPATH_API_TOKEN`/`SIGNPATH_ORGANIZATION_ID`/`SIGNPATH_PROJECT_SLUG`/`SIGNPATH_SIGNING_POLICY_SLUG`（**未配置**，与 release-cli 同一组；缺任一项则 Windows 签名步跳过，发布仍为未签名安装包）；`DESKTOP_TAURI_PRIVATE_KEY`/`DESKTOP_TAURI_KEY_PASSWORD`（已配置，构建与 `.sig` 重算共用）；`GITEE_TOKEN`/`GITEE_OWNER`（桌面端安装包国内分发，非代码镜像）；`GITHUB_TOKEN` 自动提供           |
| release-sdk.yml           | `NPM_TOKEN`（**尚未配置**，见上方说明；未配置时 real 模式 npm gate 判红）、`PYPI_TOKEN`（未配置）、`MAVEN_USERNAME`/`MAVEN_TOKEN`（未配置）、`NUGET_API_KEY`（未配置）；`GITHUB_TOKEN` 自动提供                                                                                                                                                                                                  |
| npm-bootstrap.yml         | `NPM_BOOT_PUBKEY`, `NPM_BOOT_EMAIL`, `NPM_BOOT_USERNAME`, `NPM_BOOT_PASSWORD`（已配置，账号已建成）；`NPM_PUBLISH_TOKEN`（**已配置**，publish job 使用）；`SIGNPATH_EMAIL`（已配置）；`NPM_VERIFY_URL`（未配置，仅在重新走 email 验证时需要）。`trusted_publisher` 分支已于 2026-10-19 删除                                                                                                      |
| weekly-security-audit.yml | `GITHUB_TOKEN`（GitHub 自动提供，无需手动配置）                                                                                                                                                                                                                                                                                                                                                  |
| miniapp-preview.yml       | （无）                                                                                                                                                                                                                                                                                                                                                                                           |

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
