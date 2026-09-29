<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 发布流程

> IHUI-AI 跨 14 平台发布:web/api/ai-service Docker 镜像 + desktop GitHub Release 自动发布 + extension Chrome Web Store + mobile-rn EAS + miniapp-taro 微信审核 + cli(npm + 6 二进制 + winget/scoop/homebrew/snap 4 manifest)+ sdk(npm / PyPI / Maven / Go 4 语言通道,.NET 无通道),由 Git tag 触发 GitHub Actions 自动构建,蓝绿部署上线。
>
> ⚠️ **"配了流程" ≠ "已发布"**。截至 2026-09-20,npm / PyPI 上的 `@ihui/*` 与 `ihui-ai` **一个都没有**(registry 回读全 404),SDK/CLI 发布所需的 secrets 也未配置。逐条证据见下节[发布状态(实测)](#发布状态实测-2026-09-20逐条带命令回读)。

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
| desktop | GitHub Release(6 包)+ 自动更新 feed + 下载页快照自动同步 | `desktop-v*` tag → `release-desktop.yml` | `apps/desktop/src-tauri/tauri.conf.json` + `release-desktop.yml` |
| extension | Chrome Web Store | 手动上传 zip | `apps/extension/package.json` + `wxt.config.ts` |
| mobile-rn | EAS + App Store + Play Store | `eas build` / `eas submit` | `apps/mobile-rn/eas.json` |
| miniapp-taro | 微信小程序审核 | 微信开发者工具上传 | `apps/miniapp-taro/package.json` |
| sdk(TS) | npm 包 | `sdk-v*` tag → `release-sdk.yml` | `packages/sdk/package.json` |
| sdk(Python) | PyPI | `sdk-v*` tag → `release-sdk.yml` | `packages/sdk/python/pyproject.toml` |
| sdk(Go) | go get(git tag) | `sdk-v*` tag → `release-sdk.yml`(推 `sdk/v*` 子 tag) | `packages/sdk/go/go.mod` |
| sdk(Java) | Maven Central | `sdk-v*` tag → `release-sdk.yml` | `packages/sdk/java/pom.xml` |
| sdk(.NET) | NuGet Gallery | **无 workflow**(仓库内不存在任何 NuGet 发布任务) | `packages/sdk/dotnet/Ihui.AI.csproj` |
| cli(homebrew) | Homebrew formula | 手动提交 PR | `deploy/homebrew/ihui.rb`(sha256 仍为占位) |

### 发布状态(实测 2026-09-20,逐条带命令回读)

> 本节是"已发布 / 未发布"的**唯一真相源**。历史版本曾把未发布的产物写成已交付,
> 现全部以下面这些可复现的只读命令为准 —— 命令输出与表格不一致时,以命令为准并回来改表格。

| 产物 | 状态 | 回读命令 | 实测输出 |
| --- | --- | --- | --- |
| `@ihui/sdk`(npm) | ❌ 未发布 | `curl -s https://registry.npmjs.org/@ihui%2Fsdk` | `{"error":"Not found"}`(HTTP 404) |
| `@ihui/cli`(npm) | ❌ 未发布 | `curl -s https://registry.npmjs.org/@ihui%2Fcli` | `{"error":"Not found"}` |
| `@ihui/api-client`(npm) | ❌ 未发布(定位为内部包,见下) | `curl -s https://registry.npmjs.org/@ihui%2Fapi-client` | `{"error":"Not found"}` |
| `ihui-ai`(PyPI) | ❌ 未发布 | `curl -s https://pypi.org/pypi/ihui-ai/json` | `{"message": "Not Found"}`(HTTP 404) |
| SDK 发布 tag | ❌ 一个都没有 | `git tag -l 'sdk-v*'`(另测 `v*` / `cli-v*`) | 0 行 |
| npm 发布凭据(本地) | ❌ 无 | `npm token list --registry=https://registry.npmjs.org/` | `npm error 401 Unauthorized` |
| npm 发布凭据(用户级 .npmrc) | ❌ 无 token | 查 `C:\Users\Administrator\.npmrc` | 仅 registry/prefix/cache 三行,无 `_authToken` |
| CI 发布 secrets | ❌ 未配置 | `gh secret list` | 仅 DEPLOY_/DESKTOP_/GITEE_/GITCODE_ 共 8 项,**无** NPM_TOKEN / PYPI_TOKEN / MAVEN_* / NUGET_* |
| OIDC trusted publishing | ❌ 不可用 | npm / PyPI 包页面 | 两个 registry 都要求**先有已发布的包/项目**才能登记 trusted publisher;当前 404 → 无从登记,首次发布必须走 token |
| desktop GitHub Release | ✅ 已发布(对照项) | `git tag -l 'desktop-v*'` | `desktop-v0.1.42` 等已产出(见 `release-desktop.yml`) |

**结论:`release-sdk.yml` / `release-cli.yml` 的发布链路是"配好了但从未跑通",不是"已交付"。**
要让 SDK/CLI 真正对外可安装,还差三件事(全部在用户侧,agent 无法代办):

1. 在 npmjs.com 注册 `@ihui` org 并生成 Granular Access Token → 配成 GitHub Secret `NPM_TOKEN`;
   首次发布后用包页面 "Trusted Publisher" 登记 `IHUI-INF-AI / IHUI-AI / release-sdk.yml`,再摘掉 token。
2. 在 PyPI 建项目 `ihui-ai` 并配 `PYPI_TOKEN`(名字必须与 workflow 里的 `secrets.PYPI_TOKEN` 一致)。
3. 决定 `@ihui/*` 内部包(全部 `private:true`)是否随发布 —— 见下方"sdk / cli 依赖闭包"。

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
| sdk(.NET) | `packages/sdk/dotnet/aizhs.top.csproj` → `<Version>` |

### Git tag 命名

| Tag 模式 | 触发 | 用途 |
| --- | --- | --- |
| `v1.2.3` | `build.yml` + `release-on-tag.yml` | 整体版本(web + api + ai-service + migrate)Docker 镜像构建 + GitHub Release |
| `cli-v1.0.0` | `release-cli.yml` | CLI 单独发版(npm + 6 二进制) |
| `sdk-v0.1.0` | `release-sdk.yml` | SDK 发版(npm / PyPI / Maven / Go **4** 语言,无 NuGet) |

> **2026-09-20 修正**:`release-sdk.yml` 原先挂在裸 `v*` 上,与 `build.yml` / `release-on-tag.yml`
> 撞同一触发器 —— 打一个 Docker 版本 tag 会连带触发 SDK 发布。已改为 `sdk-v*`,
> 与 `cli-v*` / `desktop-v*` 前缀约定对齐,同时 `extract` job 现在按 `^sdk-v` 剥前缀并强校验 semver。

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

### sdk(4 语言包管理器 + 1 语言无发布通道)

| SDK | 仓库 | 发布命令(tag 触发后的实际步骤) | 审核 | 当前可发布性 |
| --- | --- | --- | --- | --- |
| TS | npm | `pnpm --filter @ihui/sdk build` → `npm publish --access public --provenance` | 即时 | ⚠️ 产物已可安装,缺 `NPM_TOKEN` |
| Python | PyPI | 复制根 `LICENSE`/`NOTICE` → `python -m build` → `twine check` → `twine upload` | 即时 | ⚠️ 产物已可安装,缺 `PYPI_TOKEN` |
| Go | GitHub(无中心仓库) | 打 `sdk/v<VERSION>` 子 tag 并推送,proxy.golang.org 自动抓取 | 即时 | ⚠️ 依赖 workflow 有 `git push` 权限 |
| Java | Maven Central | `mvn -B clean deploy` | Sonatype 审核(首次约 2 小时) | ❌ `pom.xml` 缺 `<licenses>` / `<developers>` / `<scm>` / `<url>`,无 sources/javadoc jar、无 GPG 签名插件,`MAVEN_USERNAME` / `MAVEN_TOKEN` 也未配置 |
| .NET | NuGet Gallery | **仓库内不存在任何 NuGet workflow / 发布脚本** | — | ❌ 只有 `Ihui.AI.csproj` 元数据,无发布通道 |

> 旧版本本节写着"5 语言 SDK 同步发版",实际 `release-sdk.yml` 只有 4 个发布 job(npm / pypi / maven / go),
> `.NET` 从未有过发布通道;并且 4 个 job 的 `if:` 在 `push` tag 事件下恒为 false
> (`github.event.inputs.language` 是 `workflow_dispatch` 专属入参),即"打了 tag 也只跑 dry-run"。
> 2026-09-20 已修门控,现在 `push sdk-v*` 会真正进入 publish 分支。

### sdk / cli 依赖闭包(决定"谁能对外发布")

`packages/` 下 16 个包**全部** `private: true` 且 `version: 0.0.0`,入口统一 `main/types → ./src/index.ts`
(仓库内 8 端按源码消费,靠 `turbo` 的 `dependsOn: ["^build"]` 串起构建)。这带来两条硬结论:

| 包 | 定位 | 处理 |
| --- | --- | --- |
| `@ihui/sdk` | 对外唯一 TS 入口 | 已改为可发布形态:`main/types → dist`、`files` 白名单、`license: Apache-2.0`、`publishConfig.registry` 锁 npmjs.org、`@ihui/types` 移到 devDependencies(纯类型引用,发行包不需要) |
| `@ihui/api-client` | **内部传输层,不对外发布** | 保留 `private: true`。理由:① 它被 8 端经 workspace 直接按源码消费,翻成 `dist` 入口会让 `pnpm dev` 依赖先构建,收益为零;② 对外契约由 `@ihui/sdk` 承担,同时发布两个高度重叠的客户端包只会让使用者困惑;③ 它 `dependencies: { "@ihui/types": "workspace:*" }`,而 `@ihui/types` 是 private —— 去 private 也发不出去。**注意:`build` 脚本(`tsc`)是好的,`packages/api-client/dist` 能正常产出**,只是不用于发布。 |
| `@ihui/types` | 契约包 | 仍是 `private: true`。`@ihui/sdk` 的 `dist/*.d.ts` 有 13 处 `import type … from '@ihui/types'`,严格消费者(`skipLibCheck: false`)会报 13 个 TS2307 —— 见"SDK 类型面遗留问题" |
| `@ihui/cli` | 名义上可发布(`private: false` + `publishConfig`),**实际装不上** | 它 `dependencies` 里有 5 个 `workspace:*` 的 private 包(api-client / context-compaction / design-tokens / shared / types)。发出去后 `npm i @ihui/cli` 会 404;即使绕过安装,运行时 `import '@ihui/shared'` 也会因为没打包而崩。要么发布这 5 个包,要么把 CLI 用 bundler 打成单文件(需新增构建依赖)。 |

### SDK 类型面遗留问题(`@ihui/types` 未发布导致 d.ts 解析不到)

实测(2026-09-20,用真实 tarball 装进干净消费者工程):

| 消费者配置 | 结果 |
| --- | --- |
| `skipLibCheck: true`(仓库 `tsconfig.base.json` 与社区主流默认) | `tsc --noEmit` **exit 0**,公共 API 类型(`SdkConfig` / `createClient` / `SdkError`)正常;跨包返回类型退化为 `any` |
| `skipLibCheck: false` | **13 个 `TS2307: Cannot find module '@ihui/types'`**,全部位于发行包 `dist/*.d.ts` 内,消费者自身代码 0 报错 |

两条可选收口路径(都需要仓库级决策,不在本次可改范围内):

1. **发布 `@ihui/types`**(改动最小):去掉 private + 补 `build`/`files`/`exports` + 首版 `0.1.0`,然后 `@ihui/sdk` 把它列回 `dependencies`。需要动 `packages/types/**`。
2. **打包时内联声明**(不动 types):给 SDK 构建加一步 `.d.ts` bundler(如 `rollup-plugin-dts` / `api-extractor`),把 `@ihui/types` 的 113 个被引用类型卷进单一 `dist/index.d.ts`。需要新增 devDependency + 改 lockfile。

> 禁止把 types 的声明**手抄**进 `packages/sdk/src/types/`:那份契约是活的 —— 实测本次任务期间
> `packages/types/src/capability-catalog.ts` 正被并行会话改动(未提交),且 `packages/types`
> 当天仍有提交(`d4331fb39b`,2026-09-20)。复制即漂移,比 `skipLibCheck` 退化更糟。

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

其他 Secrets(按需配置)—— **"期望名"一列已按 workflow 实际引用核对,配错名字等于没配**:

| Secret | 被谁引用 | 配置状态(2026-09-20 实测 `gh secret list`) |
| --- | --- | --- |
| `NPM_TOKEN` | `release-sdk.yml` npm job + `release-cli.yml` npm job | ❌ 未配置 |
| `PYPI_TOKEN` | `release-sdk.yml` pypi job(`TWINE_PASSWORD`) | ❌ 未配置 |
| `MAVEN_USERNAME` / `MAVEN_TOKEN` | `release-sdk.yml` maven job(`~/.m2/settings.xml`) | ❌ 未配置 |
| `GHCR_TOKEN` | GHCR 镜像推送(多数 job 用自动注入的 `GITHUB_TOKEN`) | ❌ 未配置(通常不需要) |

> **名字纠错**:本文件旧版写着 `PYPI_API_TOKEN` 与 `MAVEN_GPG_PRIVATE_KEY` / `MAVEN_GPG_PASSPHRASE` /
> `MAVEN_CENTRAL_USERNAME` / `MAVEN_CENTRAL_PASSWORD` / `NUGET_API_KEY` —— 这些名字**没有任何 workflow 引用**。
> PyPI 真实变量名是 `PYPI_TOKEN`;Maven 真实变量名是 `MAVEN_USERNAME` / `MAVEN_TOKEN`;
> GPG 签名与 NuGet 发布目前**根本没有实现**(见"sdk(4 语言…)"节)。
> 配 secret 前先跑 `gh secret list` 与 `grep -o "secrets\.[A-Z_0-9]*" .github/workflows/*.yml` 对齐。

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

## desktop 发布与自动更新(已启用)

桌面端基于 Tauri 2 `tauri-plugin-updater` 实现应用内自动更新,发布/更新链路**已全部配置完毕**:

- 前端更新逻辑:[use-updater.ts](../apps/web/src/hooks/use-updater.ts)(web 端 Tauri WebView 内运行)+ Rust 端 `restart_app` 命令
- [tauri.conf.json](../apps/desktop/src-tauri/tauri.conf.json):`bundle.createUpdaterArtifacts: true` 已启用,updater 配的是**两个端点按序回退**:
  1. `https://aizhs.top/desktop-feed.json` —— **主端点**,由 `sync-downloads` job 生成到 `apps/web/public/`,Windows 包直链走 **Gitee 国内发行**;
  2. `https://github.com/IHUI-INF-AI/IHUI-AI/releases/download/desktop-updater-feed/latest.json` —— **回退端点**,挂在固定 feed tag 上
     (用固定 feed tag 而非 `releases/latest`,避免被 nightly-ios 等其他 release 漂移占用导致 404)。

  > ⚠️ **2026-09-24 实测纠偏**:上面"已全部配置完毕"当时并不成立。回退端点的 git ref
  > `refs/tags/desktop-updater-feed` **在 origin 上已不存在**(`git ls-remote` 与 `GET` 双双 404,而 Release 对象还在、
  > 资产还被 CI 正常更新),即第 2 条整条是死的;同时**主端点只写 `windows-x86_64` 一个平台键**
  > (GitHub 上那份 latest.json 资产是 4 平台齐全:windows/linux/darwin-x86_64/darwin-aarch64)。
  > 叠加后果:**macOS / Linux 客户端两条端点都拿不到更新**。已把 feed tag 归位到它原本的目标提交(不前移)并复验:
  > 回退端点 `GET=200`、`version 0.1.44`、平台数 4。**剩一条未修(如实登记)**:主端点缺 mac/linux 键,
  > mac/linux 目前只能靠回退端点续命。判据提示:**端点是否活着只能靠 HTTP 实测 + `git ls-remote` 双向核**,
  > 不能读文档、也不能看 CI 绿灯 —— `Publish Updater JSON` job 全程 success,而它的产物当时 404。
- 签名密钥对已通过 `generate-tauri-keys.yml` 生成,公钥已写入 conf(公钥在仓库、**私钥只在 CI secrets** 与发版机
  `~/.tauri/ihui-updater.key`;本机若无该文件,本地打包只能走 `DESKTOP_ALLOW_UNSIGNED=1` 出**不可发版**的包)

> ✅ **触发方式铁律已被实测推翻(2026-09-24)**:本节下方原先写"tag push 触发 `release-desktop.yml` 历史上
> #15-#22 几乎全失败,必须用 workflow_dispatch"。本次 **0.1.44 用 `git push origin refs/tags/desktop-v0.1.44`
> 触发,run #82 六个 job 全 success**(windows / macos-universal / linux 三平台构建 + Publish Updater JSON +
> Sync Downloads + Sync release to Gitee),Release 资产 14 个齐全(含 `AI_0.1.44_x64-setup.exe` 与 `.sig`)。
> 原文保留是为了不让后人重蹈当时的误判方向。两条操作注意:回读 feed/资产一律用 `GET`(HEAD 经代理不稳);
> **别重推旧的 `desktop-v*` tag** —— 那会再触发一次该平台发版,可能把 `latest.json` 写回旧版本(等于给用户降级)。


### 发版流程(每次桌面版发布)

1. 同步递增版本号:`apps/desktop/src-tauri/tauri.conf.json` 与 `apps/desktop/package.json` 的 `version` 字段(同步更新 `docs/CHANGELOG.md` 新增版本段、`README.md` 下载矩阵中的版本号)
2. 提交后打 tag 并**用 workflow_dispatch 手动触发 CI**:

```bash
git tag desktop-v0.1.15
git push origin desktop-v0.1.15
```

> ⚠️ **触发方式铁律(2026-09-01 实证)**:tag push 方式触发 `release-desktop.yml` 在历史上(#15-#22)几乎全部失败,0.1.14 与 0.1.15 均靠 **workflow_dispatch 手动触发**才成功(workflow 的 `on: push tags` 分支会走 `github.ref_name` 解析,早期步骤即失败,4 平台全挂)。正确姿势:
>
> - GitHub Actions 页面:Release Desktop → Run workflow → `ref=main` + 输入 `tag=desktop-vX.Y.Z`(workflow 内部用 `inputs.tag` 定位 Release)
> - 或 API 触发:`POST /repos/IHUI-INF-AI/IHUI-AI/actions/workflows/release-desktop.yml/dispatches`,body `{"ref":"main","inputs":{"tag":"desktop-vX.Y.Z"}}`,需要 GitHub 凭据 token(`git credential fill` 提取 `gho_` token);HTTP 204 = 触发成功,随后到 Actions 页确认新 run 的 4 平台均为 in_progress(无早期失败)

3. `release-desktop.yml` 自动执行:4 平台(windows-x64 / macos-arm64 / macos-x64 / linux-x64)构建 → 上传安装包 + `.sig` 签名包到 Release → `publish-updater-json` 聚合全部平台生成 `latest.json`(上传到发版 Release + 固定 feed tag `desktop-updater-feed`)→ `sync-downloads` 把产物同步到 `apps/web/public/downloads/` 并自动提交回 main
   - **注意**:桌面安装包 ~230MB,超过 GitHub 单文件 100MB 限制,`sync-downloads` 提交时**不包含** exe/msi(`apps/web/public/downloads/desktop/` 已 gitignore)。
4. `sync-downloads` job 同时运行 `scripts/resolve-desktop-download.mjs`,从 GitHub Releases API **动态解析**最新 `desktop-v*` release 的安装包(URL/大小/版本/发布日期),刷新 `apps/web/src/config/desktop-feed.generated.ts` 入库快照并随提交回 main。Web 下载页(`/download/desktop`)构建期读取该快照渲染下载按钮——**发版后下载页自动更新,无需手动改任何 URL / 大小 / 版本号**。
5. 用户端:应用启动时 `checkForUpdate()` 拉固定 feed 的 `latest.json` → 比对版本 → 下载签名包 → `downloadAndInstall()` 验签安装 → 重启

> 手动刷新快照(CI 失败兜底 / 本地调试):`node scripts/resolve-desktop-download.mjs`(有差异才写);`--check` 仅对比(有差异退出码 1);`--offline` 仅查看本地快照。

### 前置 Secrets(仓库 Settings → Secrets and variables → Actions)

| Secret | 用途 |
| --- | --- |
| `DESKTOP_TAURI_PRIVATE_KEY` | 签名私钥内容(`cat ~/.tauri/ihui.key`) |
| `DESKTOP_TAURI_KEY_PASSWORD` | 私钥密码(无密码留空) |
| `DESKTOP_API_URL` | 生产 API 基址(如 `https://api.ihui.ai`,不设则桌面端 API 为空) |

> 若密钥私钥丢失(本地 `~/.tauri/ihui.key` 不存在且 Secrets 未配置),重跑 `generate-tauri-keys.yml` 生成新密钥对,并把新公钥更新到 tauri.conf.json(旧已发布版本无法再验证新签名,需用户重新安装)。

---

## 最优下一步建议

- 发布前务必跑 `node scripts/pre-deploy.mjs`,它是发布事故的第一道防线。
- 蓝绿部署 + 健康检查 + 自动回滚已内置,但灰度发布需手动配置 `CANARY_PERCENTAGE`,重大版本建议先灰度 10% 观察 30 分钟。
- CLI / SDK 发版后,记得同步更新 4 包管理器 manifest 的 SHA256,否则用户 `winget upgrade` / `scoop update` 拿不到新版本。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
