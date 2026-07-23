# 发布流程

> IHUI-AI 跨 14 平台发布:web/api/ai-service Docker 镜像 + desktop 手动 tauri build(无自动发布)+ extension Chrome Web Store + mobile-rn EAS + miniapp-taro 微信审核 + cli(npm + 6 二进制 + winget/scoop/homebrew/snap 4 manifest)+ sdk 5 语言包管理器,由 Git tag 触发 GitHub Actions 自动构建,蓝绿部署上线。

---

## 总览

IHUI-AI 采用 **Git tag 驱动**的发布模型:打 tag → 触发 GitHub Actions → 构建产物 → 推送至各平台 → 蓝绿部署上线。所有发布动作均有守门脚本与 checklist 兜底。

- 8 端定位与平台支持矩阵见 [MULTI_END.md](./MULTI_END.md),本文件只聚焦**发布流程**。
- 服务器部署、Nginx 配置、证书续期、SaaS 多租户运维细节见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md),本文件不重复。
- 变更记录见 [CHANGELOG.md](./CHANGELOG.md),本文件只描述"如何把变更发出去"。

### 14 平台发布全景

| 端 | 发布载体 | 触发方式 | 配置文件 |
| --- | --- | --- | --- |
| web | Docker 镜像(GHCR) | `v*` tag → `build.yml` | `deploy/docker/Dockerfile.web` |
| api | Docker 镜像(GHCR) | `v*` tag → `build.yml` | `deploy/docker/Dockerfile.api` |
| ai-service | Docker 镜像 | `v*` tag → `build.yml` | `apps/ai-service/Dockerfile` |
| migrate | Docker 镜像(迁移工具) | `v*` tag → `build.yml` | `deploy/docker/Dockerfile.migrate` |
| cli(npm) | npm 包 | `cli-v*` tag → `release-cli.yml` | `apps/cli/package.json` |
| cli(二进制) | GitHub Release 6 包 | `cli-v*` tag → `release-cli.yml` | `release-cli.yml` matrix |
| cli(winget) | winget manifest | 手动提交 PR | `deploy/winget/IHUI.IHUI.yaml` |
| cli(scoop) | scoop manifest | 手动提交 PR | `deploy/scoop/ihui.json` |
| cli(homebrew) | Homebrew formula | 手动提交 PR | `deploy/homebrew/ihui.rb` |
| cli(snap) | Snapcraft | 手动 `snapcraft` | `deploy/snap/snapcraft.yaml` |
| desktop | 手动 `tauri build`(无自动发布、无自动更新) | 手动构建 | `apps/desktop/src-tauri/tauri.conf.json` |
| extension | Chrome Web Store | 手动上传 zip | `apps/extension/package.json` + `wxt.config.ts` |
| mobile-rn | EAS + App Store + Play Store | `eas build` / `eas submit` | `apps/mobile-rn/eas.json` |
| miniapp-taro | 微信小程序审核 | 微信开发者工具上传 | `apps/miniapp-taro/package.json` |
| sdk(TS) | npm 包 | `v*` tag → 发布 workflow | `packages/sdk/package.json` |
| sdk(Python) | PyPI | `v*` tag → 发布 workflow | `packages/sdk/python/pyproject.toml` |
| sdk(Go) | go get(git tag) | `v*` tag | `packages/sdk/go/go.mod` |
| sdk(Java) | Maven Central | `v*` tag → 发布 workflow | `packages/sdk/java/pom.xml` |
| sdk(.NET) | NuGet Gallery | `v*` tag → 发布 workflow | `packages/sdk/dotnet/Ihui.AI.csproj` |

---

## 版本策略

### SemVer 语义化版本

所有端遵循 [SemVer](https://semver.org/lang/zh-CN/) `MAJOR.MINOR.PATCH`:

| 版本段 | 何时 bump | 示例 |
| --- | --- | --- |
| `MAJOR` | 不兼容的 API 变更(目前均在 0.x / 1.x,未到 2.0) | `1.0.0` → `2.0.0` |
| `MINOR` | 向后兼容的功能新增 | `1.2.0` → `1.3.0` |
| `PATCH` | 向后兼容的 bug 修复 | `1.2.3` → `1.2.4` |

### 版本号位置

| 端 | 版本号文件 |
| --- | --- |
| api / web / ai-service | `apps/<app>/package.json` → `version` |
| cli | `apps/cli/package.json` → `version` |
| extension | `apps/extension/package.json` → `version` |
| mobile-rn | `apps/mobile-rn/app.json` → `version` + `apps/mobile-rn/package.json` |
| miniapp-taro | `apps/miniapp-taro/project.config.json` → `version` |
| sdk(TS) | `packages/sdk/package.json` → `version` |
| sdk(Python) | `packages/sdk/python/pyproject.toml` → `[project].version` |
| sdk(Go) | git tag(无 go.mod version 字段) |
| sdk(Java) | `packages/sdk/java/pom.xml` → `<version>` |
| sdk(.NET) | `packages/sdk/dotnet/Ihui.AI.csproj` → `<Version>` |

### Git tag 命名

| Tag 模式 | 触发 | 用途 |
| --- | --- | --- |
| `v1.2.3` | `build.yml` | 整体版本(web + api + ai-service + sdk)Docker 镜像构建 |
| `cli-v1.0.0` | `release-cli.yml` | CLI 单独发版(npm + 6 二进制) |
| `sdk-v0.1.0` | sdk 发布 workflow | 5 语言 SDK 同步发版 |

### CHANGELOG 维护

变更记录统一写在 [docs/CHANGELOG.md](./CHANGELOG.md),按版本倒序排列,每个版本段记录:新增 / 修复 / 变更 / 移除 / 安全。发布前必须更新对应版本段。

---

## 发布前检查

### pre-deploy.mjs 10 项门禁

`scripts/pre-deploy.mjs` 在发布前执行 10 项检查,任一失败则中止发布:

| # | 检查项 | 命令 / 校验 |
| --- | --- | --- |
| 1 | Git 工作区干净 | `git status --porcelain` 无输出 |
| 2 | 当前分支是 main | `git branch --show-current` === `main` |
| 3 | 本地与 origin 同步 | `git rev-parse HEAD` === `git rev-parse origin/main` |
| 4 | typecheck 全绿 | `pnpm turbo run typecheck` |
| 5 | lint 全绿 | `pnpm turbo run lint` |
| 6 | test 全绿 | `pnpm turbo run test` |
| 7 | build 全绿 | `pnpm turbo run build` |
| 8 | i18n parity(zh-CN 与 4 语言 key 一致) | `node scripts/check-i18n-keys.mjs` |
| 9 | 数据库 migration 完整性 | `node scripts/check-api-migration-completeness.mjs` |
| 10 | DB schema 无漂移 | `node scripts/check-db-schema-drift.mjs` |

### 一键执行

```bash
node scripts/pre-deploy.mjs
# 全部通过后输出 "✓ pre-deploy checks passed" 并 exit 0
```

> 守门脚本完整清单(23 项 pre-commit)见 [GATEKEEPERS.md](./GATEKEEPERS.md) 与根 `AGENTS.md` 守门速查表。

---

## Git tag 流程

### 打 tag 并推送

```bash
# 1. 确认 pre-deploy 通过
node scripts/pre-deploy.mjs

# 2. 更新 CHANGELOG.md 对应版本段
# 3. 提交版本号 + CHANGELOG 改动
git add apps/api/package.json apps/web/package.json docs/CHANGELOG.md
git commit -m "chore(release): v1.2.3"

# 4. 打 tag
git tag v1.2.3
git push origin main
git push origin v1.2.3   # 触发 build.yml

# CLI 单独发版
git tag cli-v1.0.1
git push origin cli-v1.0.1  # 触发 release-cli.yml
```

### tag 触发的 workflow

| Tag | 触发 workflow | 产物 |
| --- | --- | --- |
| `v*` | `build.yml` | web/api/ai-service Docker 镜像 |
| `cli-v*` | `release-cli.yml` | npm 包 + 6 二进制包 |
| `sdk-v*` | sdk 发布 workflow | 5 语言 SDK 包 |

---

## GitHub Actions workflow

`.github/workflows/` 下 23 个 workflow,核心发布相关 4 个:

| Workflow | 触发条件 | 职责 |
| --- | --- | --- |
| `build.yml` | push 到 `main` / `v*` tag | 构建 web / api / ai-service Docker 镜像 |
| `ci.yml` | push / PR 到 `main` + `develop` | lint + typecheck + test + build + schema drift + Python 语法检查 |
| `e2e.yml` | push / PR 到 `main` + `develop`(`apps/web` / `apps/api` / `packages` 变更) | Playwright E2E(chromium,构建 Next.js + 启动预览 + 跑 spec) |
| `knip.yml` | push / PR(`apps` / `packages` / `package.json` / `knip.jsonc` 变更) | Knip 死代码检测(未用文件 / 导出 / 依赖) |
| `release-cli.yml` | `cli-v*` tag / 手动 dispatch | npm publish + 6 平台二进制构建(linux/macos/windows × x64/arm64) |

### 其他辅助 workflow

| Workflow | 触发 | 职责 |
| --- | --- | --- |
| `i18n-check.yml` | i18n 文件变更 | 5 语言 parity + 中文残留守门 |
| `blue-green-deploy.yml` | `v*` tag | 蓝绿部署 SSH 切换 |
| `migration-tests.yml` | `packages/database` 变更 | 迁移测试(真实 DB) |
| `openapi-check.yml` | API 变更 | OpenAPI spec 存在性检查 |
| `lighthouse-ci.yml` | `apps/web` 变更 | Lighthouse 性能预算 |
| `visual-regression.yml` | UI 变更 | 视觉回归 |
| `miniapp-preview.yml` | `apps/miniapp-taro` 变更 | 小程序预览二维码 |
| `weekly-security-audit.yml` | 每周 | npm audit 安全扫描 |
| `weekly-cleanup.yml` | 每周 | 临时分支 / 旧 artifact 清理 |
| `ws-loadtest.yml` | 手动 | WebSocket 压测 |
| `observability-drills.yml` | 定期 | 可观测性演练 |

---

## Docker 镜像发布

### Dockerfile 矩阵

`deploy/docker/` 下 4 个 Dockerfile:

| Dockerfile | 构建产物 | 基础镜像 | 用途 |
| --- | --- | --- | --- |
| `Dockerfile.api` | `ihui-api` | node:20-alpine | Fastify API 服务 |
| `Dockerfile.web` | `ihui-web` | node:20-alpine | Next.js 前端(standalone) |
| `Dockerfile.cli` | `ihui-cli` | node:20-alpine | CLI 工具容器化 |
| `Dockerfile.migrate` | `ihui-migrate` | node:20-alpine | 数据库迁移工具(一次性运行) |

`build.yml` 在 `v*` tag 推送时构建并推送至 GHCR(GitHub Container Registry):

```yaml
# build.yml 关键片段
- uses: docker/build-push-action@v5
  with:
    context: .
    file: deploy/docker/Dockerfile.api
    push: true
    tags: |
      ghcr.io/ihui-inf-ai/ihui-api:latest
      ghcr.io/ihui-inf-ai/ihui-api:${{ github.ref_name }}
      ghcr.io/ihui-inf-ai/ihui-api:sha-${{ github.sha }}
```

### tag 策略

| tag | 含义 | 何时更新 |
| --- | --- | --- |
| `latest` | 最新稳定版 | 每次 `v*` tag 发布 |
| `v1.2.3` | 版本号 tag | 对应 Git tag |
| `sha-abc1234` | commit 短 SHA | 每次构建,用于精确回滚 |
| `main` | main 分支最新 | 每次 push 到 main(开发调试用) |

### 本地构建测试

```bash
docker build -f deploy/docker/Dockerfile.api -t ihui-api:test .
docker run --rm -p 8802:8802 --env-file .env ihui-api:test
```

---

## 部署流程

部署运维细节(Nginx 配置、systemd、docker-compose、SaaS 多租户)见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)。本节聚焦"新版本怎么上线"。

### 蓝绿部署上线步骤

```bash
# 1. 拉取新镜像(docker-compose.yml 已更新 image tag)
docker compose pull
# 或指定版本
docker compose pull ihui-api:v1.2.3

# 2. 运行数据库迁移(在 inactive 环境执行)
docker compose run --rm ihui-migrate pnpm --filter @ihui/api db:migrate

# 3. 启动新版本(inactive 环境,不切流量)
docker compose up -d --no-deps ihui-api ihui-web

# 4. 健康检查(inactive 环境直接访问端口)
curl -s http://127.0.0.1:8844/health | jq .

# 5. 切流量(蓝绿切换,nginx reload)
./deploy/scripts/deploy.sh green   # 或 blue

# 6. 验证线上
curl -s https://api.your-domain.com/health
```

### 蓝绿部署脚本

`deploy/scripts/deploy.sh` 提供 4 个子命令:

| 命令 | 行为 |
| --- | --- |
| `./deploy.sh blue` | 切换到 Blue 环境(web=8841, api=8842) |
| `./deploy.sh green` | 切换到 Green 环境(web=8843, api=8844) |
| `./deploy.sh status` | 显示当前激活环境 + 端口 |
| `./deploy.sh rollback` | 回滚到上一个环境 |

切换流程:备份 nginx 配置 → sed 替换 `blue_*` / `green_*` → `nginx -t` 校验 → `nginx -s reload` → 等 5s → 健康检查 `/nginx-health` → 失败自动回滚。

---

## 回滚流程

回滚分两级:蓝绿环境切换(秒级)与指定 commit 回滚(分钟级)。

### 蓝绿回滚(秒级)

```bash
./deploy/scripts/rollback.sh
# 读取 /var/lib/ihui/last-env,切换 blue↔green,nginx -t + reload + 健康检查,失败自动切回
```

### 指定 commit 回滚(分钟级)

```bash
./deploy/scripts/rollback.sh to <commit-or-tag>
# 1. git fetch origin --tags
# 2. git checkout --detach <commit>(分离 HEAD)
# 3. pnpm install --frozen-lockfile && pnpm build
# 4. 重启 inactive 环境服务
# 5. 健康检查通过后切流量(蓝绿)
# 失败自动 git checkout - 回到原分支
```

### 列出可回滚版本

```bash
./deploy/scripts/rollback.sh list
# 输出:Git 最近 20 条提交 + 已有 docker 镜像 tag + 当前激活环境
```

### 数据库备份恢复

回滚涉及数据库 schema 变更时,先用 `deploy/scripts/backup-db.sh` 备份,回滚后用 `restore-db.sh` 恢复:

```bash
./deploy/scripts/backup-db.sh           # pg_dump 到 /backups/ihui-<timestamp>.sql.gz
./deploy/scripts/rollback.sh to v1.2.2  # 回滚代码
./deploy/scripts/restore-db.sh /backups/ihui-<timestamp>.sql.gz  # 恢复数据库
```

> 完整备份策略、RPO / RTO、SaaS 多租户备份见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)。

---

## 多端发布矩阵

### cli(winget + scoop + homebrew + snap)

| 工具 | 配置文件 | 发布命令 | 审核流程 |
| --- | --- | --- | --- |
| winget | `deploy/winget/IHUI.IHUI.yaml` | 提交 PR 到 `microsoft/winget-pkgs` 仓库 | 微软审核(1-3 天) |
| scoop | `deploy/scoop/ihui.json` | 提交 PR 到 scoop bucket 仓库 | 社区审核(即时) |
| Homebrew | `deploy/homebrew/ihui.rb` | 提交 PR 到 `ihui/homebrew-ihui` tap | 即时 |
| Snap | `deploy/snap/snapcraft.yaml` | `snapcraft snap --use-lxd` + `snapcraft push` | Canonical 审核(1-5 天) |

发布前需更新 manifest 中的 `version` + `InstallerSha256` / `hash` + `InstallerUrl`:

```bash
# 1. 计算二进制 SHA256
sha256sum ihui-windows-x64.zip
# 2. 更新 deploy/winget/IHUI.IHUI.yaml 中的 InstallerSha256
# 3. 更新 deploy/scoop/ihui.json 中的 hash
# 4. 更新 deploy/homebrew/ihui.rb 中的 sha256 + url
# 5. 提交各仓库 PR
```

### extension(Chrome Web Store)

| 项 | 说明 |
| --- | --- |
| 构建工具 | WXT 0.19(`apps/extension/package.json` 的 `wxt` 依赖) |
| 构建命令 | `pnpm --filter @ihui/extension zip` 生成 `.zip` |
| 配置 | `apps/extension/wxt.config.ts`(manifest 字段 / 权限 / content scripts) |
| 发布 | Chrome Web Store Developer Dashboard 手动上传 zip |
| 审核 | Google 审核(1-7 天),首次审核较严 |

### mobile-rn(EAS + App Store + Play Store)

| 平台 | 工具 | 命令 | 审核 |
| --- | --- | --- | --- |
| iOS + Android 构建 | EAS Build | `eas build --platform all` | — |
| iOS 提交 | EAS Submit | `eas submit -p ios` | Apple 审核(1-3 天) |
| Android 提交 | EAS Submit | `eas submit -p android` | Google 审核(1-4 小时) |
| 配置 | `apps/mobile-rn/eas.json` | build / submit profile | — |

### miniapp-taro(微信小程序审核)

| 项 | 说明 |
| --- | --- |
| 构建命令 | `pnpm --filter @ihui/miniapp-taro build:weapp` |
| 产物 | `apps/miniapp-taro/dist/` |
| 上传 | 微信开发者工具 → 上传 → 提交审核 |
| 审核 | 微信团队审核(1-7 天) |
| 多端 | Taro 4.2 支持同时构建 weapp / alipay / swan / tt / h5 |

### cli(npm + 4 包管理器)

CLI 发版由 `release-cli.yml` 自动化,分两阶段:

```yaml
# 阶段 1:npm publish
- run: pnpm --filter @ihui/cli publish --no-git-checks --access public
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

# 阶段 2:构建 6 平台二进制(linux/macos/windows × x64/arm64)
matrix:
  include:
    - { os: linux, arch: x64, asset: ihui-linux-x64.tar.gz }
    - { os: linux, arch: arm64, asset: ihui-linux-arm64.tar.gz }
    - { os: macos, arch: x64, asset: ihui-macos-x64.tar.gz }
    - { os: macos, arch: arm64, asset: ihui-macos-arm64.tar.gz }
    - { os: windows, arch: x64, asset: ihui-windows-x64.zip }
    - { os: windows, arch: arm64, asset: ihui-windows-arm64.zip }
```

二进制上传到 GitHub Release 后,再更新 winget / scoop / homebrew / snap 的 manifest(见 cli 矩阵)。

### sdk(5 语言包管理器)

| SDK | 仓库 | 发布命令 | 审核 |
| --- | --- | --- | --- |
| TS | npm | `pnpm --filter @ihui/sdk publish --access public` | 即时 |
| Python | PyPI | `python -m build && twine upload dist/*` | 即时 |
| Go | GitHub(无中心仓库) | git tag(用户 `go get` 拉取) | 即时 |
| Java | Maven Central | `mvn deploy -P release`(需 GPG + Sonatype 账号) | Sonatype 审核(首次约 2 小时) |
| .NET | NuGet Gallery | `dotnet pack && dotnet nuget push` | 即时 |

> 5 语言 SDK 同步发版,版本号保持一致(见 [SDK.md](./SDK.md) 版本管理)。

---

## 证书管理

证书续期与到期检查由 cron + 守门脚本配合,运维细节见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)。

| 文件 | 职责 |
| --- | --- |
| `deploy/cron/cert-renew.sh` | Let's Encrypt 证书续期(certbot renew + nginx reload) |
| `deploy/cron/cert-renew.cron` | crontab 条目(每月 1 日 03:00 执行) |
| `scripts/cert-expiry-check.mjs` | 检查证书剩余天数,低于 14 天告警 |
| `scripts/cert-renew-watchdog.mjs` | 续期看门狗(检测 cert-renew.sh 是否成功执行) |

```bash
# 手动检查证书到期
node scripts/cert-expiry-check.mjs
# 手动续期
./deploy/cron/cert-renew.sh
```

---

## GitHub Secrets

`deploy/setup-github-secrets.sh` 一键配置部署所需的 3 个 Secrets(需先 `gh auth login`):

| Secret | 用途 |
| --- | --- |
| `DEPLOY_HOST` | 部署服务器 IP / 域名 |
| `DEPLOY_USER` | SSH 用户名(默认 `deploy`) |
| `DEPLOY_SSH_PRIVATE_KEY` | SSH 私钥(用于 `blue-green-deploy.yml` SSH 登录部署) |

其他 Secrets(按需配置):

| Secret | 用途 |
| --- | --- |
| `NPM_TOKEN` | npm publish(`release-cli.yml` + sdk 发布) |
| `PYPI_API_TOKEN` | PyPI 上传(Python SDK) |
| `MAVEN_GPG_PRIVATE_KEY` / `MAVEN_GPG_PASSPHRASE` / `MAVEN_CENTRAL_USERNAME` / `MAVEN_CENTRAL_PASSWORD` | Maven Central 上传(Java SDK) |
| `NUGET_API_KEY` | NuGet 上传(.NET SDK) |
| `GHCR_TOKEN` | GHCR 镜像推送 |

完整 Secrets 文档见 `.github/SECRETS.md`。

```bash
./deploy/setup-github-secrets.sh IHUI-INF-AI/IHUI-AI
# 验证
gh secret list --repo IHUI-INF-AI/IHUI-AI
```

---

## 发布 checklist

### 发布前

- [ ] `node scripts/pre-deploy.mjs` 10 项全绿
- [ ] 更新 `docs/CHANGELOG.md` 对应版本段
- [ ] 更新各端 `version` 字段(package.json / pom.xml / csproj 等)
- [ ] 更新 README(若触发了 [AGENTS.md §22](../AGENTS.md) 功能变更场景)
- [ ] 通知相关人(发布窗口)
- [ ] 数据库备份:`./deploy/scripts/backup-db.sh`

### 发布中

- [ ] 提交版本号 + CHANGELOG:`git commit -m "chore(release): vX.Y.Z"`
- [ ] 打 tag:`git tag vX.Y.Z && git push origin vX.Y.Z`
- [ ] 监控 GitHub Actions:`build.yml` / `release-cli.yml` 全绿
- [ ] 验证 GHCR 镜像存在:`docker pull ghcr.io/ihui-inf-ai/ihui-api:vX.Y.Z`
- [ ] 拉取新镜像:`docker compose pull`
- [ ] 运行迁移:`docker compose run --rm ihui-migrate pnpm --filter @ihui/api db:migrate`
- [ ] 启动 inactive 环境 + 健康检查
- [ ] 蓝绿切换:`./deploy/scripts/deploy.sh green`(或 blue)
- [ ] 验证线上:`curl https://api.your-domain.com/health`

### 发布后

- [ ] 冒烟测试核心链路(登录 / 对话 / 文件上传 / 支付)
- [ ] 监控告警 30 分钟无异常
- [ ] 更新 winget / scoop / homebrew / snap manifest(若 cli/desktop 发版)
- [ ] 更新 Chrome Web Store / App Store / Play Store / 微信小程序(若对应端发版)
- [ ] 发布 Release Notes(GitHub Release 页面,引用 CHANGELOG)
- [ ] 通知用户(若有不兼容变更)
- [ ] 归档发布日志到 `/var/log/ihui-deploy.log`

---

## 蓝绿部署 / 灰度发布

### 蓝绿部署

蓝绿部署由 `deploy/scripts/deploy.sh` + `deploy/nginx/nginx-blue-green.conf` 实现,详见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)。两套环境同时存在,nginx 通过 `proxy_pass` 切换:

| 环境 | web 端口 | api 端口 |
| --- | --- | --- |
| Blue | 8841 | 8842 |
| Green | 8843 | 8844 |

### 灰度发布(canary)

`apps/api/src/routes/canary.ts` 提供金丝雀路由,可按比例 / 按用户标签灰度分流到新版本:

```typescript
// canary.ts 示例:按用户 ID 哈希分流 10% 到 canary
app.get('/v1/chat/completions', async (req, reply) => {
  const userId = req.user.id
  const hash = murmurhash(userId)
  if (hash % 100 < canaryPercentage) {
    return forwardToCanary(req)
  }
  return forwardToStable(req)
})
```

灰度配置通过环境变量 `CANARY_PERCENTAGE` 控制,详见 [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) 灰度章节。

---

## 紧急修复 hotfix 流程

当线上出现严重 bug 需紧急修复时,走 hotfix 分支流程:

```bash
# 1. 从最新 tag 拉取 hotfix 分支
git checkout -b hotfix/v1.2.4 v1.2.3

# 2. 修复 bug(最小改动,不夹带新功能)
# 3. 验证(只跑受影响的测试,加快速度)
pnpm --filter @ihui/api test auth
pnpm --filter @ihui/api typecheck

# 4. 更新版本号(PATCH bump)+ CHANGELOG
# 5. 提交 + 打 tag
git commit -m "fix(auth): token 刷新过期判断 v1.2.4"
git tag v1.2.4
git push origin hotfix/v1.2.4 --tags

# 6. 触发 build.yml 构建镜像
# 7. 蓝绿部署上线(走正常部署流程,但跳过灰度直接全量)
./deploy/scripts/deploy.sh green

# 8. 合并回 main
git checkout main
git merge hotfix/v1.2.4
git push origin main
git branch -d hotfix/v1.2.4
```

### hotfix 注意事项

- 只修复目标 bug,不夹带任何新功能(避免引入新风险)
- 必须从 tag 拉分支(而非 main),确保基于已发布代码修复
- 数据库迁移必须可逆(回滚时不丢数据)
- 上线后立即合并回 main,避免 main 与 hotfix 分叉

---

## desktop 自动更新启用指南

桌面端基于 Tauri 2 `tauri-plugin-updater` 实现应用内自动更新。代码层已就位([updater.ts](../apps/desktop/src/lib/updater.ts) + [UpdateChecker.tsx](../apps/desktop/src/components/UpdateChecker.tsx) + [tauri.conf.json](../apps/desktop/src-tauri/tauri.conf.json) 的 `app.updater` 占位),启用需完成以下 3 步:

### 1. 生成签名密钥对

```bash
pnpm --filter @ihui/desktop exec tauri signer generate -w ~/.tauri/ihui.key
# 输出公钥 → 填入 tauri.conf.json 的 app.updater.pubkey
# 私钥路径 ~/.tauri/ihui.key(保密,不入库)
```

### 2. 配置 tauri.conf.json

```jsonc
{
  "app": {
    "updater": {
      "endpoints": ["https://releases.ihui.ai/desktop/latest.json"],
      "pubkey": "<上一步输出的公钥>"
    }
  },
  "bundle": {
    "createUpdaterArtifacts": true
  }
}
```

### 3. 配置 GitHub Secrets

| Secret | 用途 |
| --- | --- |
| `DESKTOP_TAURI_PRIVATE_KEY` | 签名私钥内容(`cat ~/.tauri/ihui.key`) |
| `DESKTOP_TAURI_KEY_PASSWORD` | 私钥密码(无密码留空) |

```bash
gh secret set DESKTOP_TAURI_PRIVATE_KEY < ~/.tauri/ihui.key
gh secret set DESKTOP_TAURI_KEY_PASSWORD
```

### 4. 发版触发自动构建

```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
# 触发 release-desktop.yml → tauri-action 构建 4 平台安装包 + 签名 + 上传 Release + 生成 latest.json
```

`tauri-action` 自动生成 `latest.json`(Tauri updater 协议)上传到 Release。应用启动时 `UpdateChecker` 调 `checkForUpdate()` → 拉 `latest.json` → 比对版本 → 下载签名包 → `downloadAndInstall()` 验签安装。

---

## 最优下一步建议

- 发布前务必跑 `node scripts/pre-deploy.mjs`,它是发布事故的第一道防线。
- 蓝绿部署 + 健康检查 + 自动回滚已内置,但灰度发布需手动配置 `CANARY_PERCENTAGE`,重大版本建议先灰度 10% 观察 30 分钟。
- CLI / SDK 发版后,记得同步更新 4 包管理器 manifest 的 SHA256,否则用户 `winget upgrade` / `scoop update` 拿不到新版本。
