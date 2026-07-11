# CI/CD Secrets 配置说明

本文档列出所有 GitHub Actions 工作流所需的 secrets 和环境变量。

> **说明**：下方「必配 Secrets（生产环境）」部分为应用运行时所需的配置项（通常通过 `.env` 注入到运行中的服务），并非全部以 `${{ secrets.* }}` 形式直接出现在工作流 YAML 中。CI 流水线中测试多使用本地服务容器（如 postgres:16）与硬编码测试凭据，因此这些生产密钥主要用于部署后的运行环境。「CI/CD 专用 Secrets」则为工作流中通过 `${{ secrets.* }}` 直接引用的变量。

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

- `NPM_TOKEN` — npm 发布令牌（用于 SDK 发布到 npm registry）
- `DOCKER_REGISTRY` — Docker 镜像仓库地址
- `DOCKER_USERNAME` — Docker 仓库用户名
- `DOCKER_PASSWORD` — Docker 仓库密码
- `DEPLOY_SSH_KEY` — 部署服务器 SSH 私钥
- `DEPLOY_HOST` — 部署服务器地址
- `DEPLOY_USER` — 部署服务器用户名

### AWS（S3 生命周期漂移检测）

- `AWS_ACCESS_KEY_ID` — AWS 访问密钥
- `AWS_SECRET_ACCESS_KEY` — AWS 秘密密钥
- `AWS_REGION` — AWS 区域（未设置时默认 `us-east-1`）
- `S3_BUCKET` — S3 Bucket 名（可通过 workflow_dispatch 的 `bucket` 输入覆盖）

### 可观测性

- `GRAFANA_API_KEY` — Grafana API Key（可选，用于告警推送）
- `SLACK_WEBHOOK_URL` — Slack 告警 Webhook（可选）
- `DINGTALK_WEBHOOK_URL` — 钉钉告警 Webhook（可选）

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

| 工作流                    | 所需 Secrets                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| ci.yml                    | （无）                                                                                               |
| ci-monorepo.yml           | （无）                                                                                               |
| build.yml                 | （无）                                                                                               |
| e2e.yml                   | （无）                                                                                               |
| knip.yml                  | （无）                                                                                               |
| openapi-check.yml         | （无）                                                                                               |
| visual-regression.yml     | （无）                                                                                               |
| blue-green-deploy.yml     | （无，当前通过 `environment` 选择 staging/production，部署步骤未引用 secrets）                       |
| migration-tests.yml       | （无，使用本地 postgres 服务容器 + 硬编码测试凭据 `postgresql://postgres:test@localhost:5432/test`） |
| observability-drills.yml  | （无，依赖运行中的服务）                                                                             |
| s3-lifecycle-drift.yml    | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`                              |
| ws-loadtest.yml           | （无，依赖运行中的服务）                                                                             |
| smoke-new-modules.yml     | （无）                                                                                               |
| sdk-publish.yml           | `NPM_TOKEN`                                                                                          |
| weekly-security-audit.yml | `GITHUB_TOKEN`（GitHub 自动提供，无需手动配置）                                                      |
| miniapp-preview.yml       | （无）                                                                                               |
