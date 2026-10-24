<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 发布流程

> IHUI-AI 跨 14 平台发布:web/api/ai-service Docker 镜像 + desktop GitHub Release 自动发布 + extension Chrome Web Store + mobile-rn EAS + miniapp-taro 微信审核 + cli(npm + 6 二进制 + winget/scoop/homebrew/snap 4 manifest)+ sdk(npm / PyPI / Maven / Go / NuGet 5 语言通道),由 Git tag 触发 GitHub Actions 自动构建,蓝绿部署上线。
>
> ⚠️ **"配了流程" ≠ "已发布"**。截至 2026-10-19,`ihui-cli@1.0.0` 已上 npm(registry 回读 200,`npm i ihui-cli` 实测可用);`@ihui/*`、`ihui-ai`(PyPI)仍未发布。CLI 发布走 `secrets.NPM_PUBLISH_TOKEN`(granular token + Bypass 2FA;OIDC 仅作前向兼容尝试,失败自动回退),**不启用 2FA、不登记 Trusted Publisher**;SDK 侧(以及 PyPI / Maven / NuGet)的凭据仍未配置。逐条证据见下节[发布状态(实测)](#发布状态实测-2026-10-19逐条带命令回读)。

---

## 总览

IHUI-AI 采用 **Git tag 驱动**的发布模型:打 tag → 触发 GitHub Actions → 构建产物 → 推送至各平台 → 蓝绿部署上线。所有发布动作均有守门脚本与 checklist 兜底。

- 9 端定位与平台支持矩阵见 [MULTI_END.md](./MULTI_END.md),本文件只聚焦**发布流程**。
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
| miniapp-taro | 微信小程序审核 | `node scripts/upload-miniapp.mjs`(miniprogram-ci) | `apps/miniapp-taro/package.json` |
| sdk(TS) | npm 包 | `sdk-v*` tag → `release-sdk.yml` | `packages/sdk/package.json` |
| sdk(Python) | PyPI | `sdk-v*` tag → `release-sdk.yml` | `packages/sdk/python/pyproject.toml` |
| sdk(Go) | go get(git tag) | `sdk-v*` tag → `release-sdk.yml`(推 `sdk/v*` 子 tag) | `packages/sdk/go/go.mod` |
| sdk(Java) | Maven Central | `sdk-v*` tag → `release-sdk.yml` | `packages/sdk/java/pom.xml` |
| sdk(.NET) | NuGet Gallery | `sdk-v*` tag → `release-sdk.yml`(nuget-publish job) | `packages/sdk/dotnet/Ihui.AI.csproj` |
| cli(homebrew) | Homebrew formula | 手动提交 PR | `deploy/homebrew/ihui.rb`(sha256 仍为占位) |

### 发布状态(实测 2026-10-19,逐条带命令回读)

> 本节是"已发布 / 未发布"的**唯一真相源**。历史版本曾把未发布的产物写成已交付,
> 现全部以下面这些可复现的只读命令为准 —— 命令输出与表格不一致时,以命令为准并回来改表格。

| 产物 | 状态 | 回读命令 | 实测输出 |
| --- | --- | --- | --- |
| `ihui-cli`(npm) | ✅ 已发布 1.0.0(2026-10-19T00:31:04Z,`latest=1.0.0`) | `npm view ihui-cli version dist-tags --registry=https://registry.npmjs.org/` | `1.0.0` / `{ latest: '1.0.0' }` |
| `ihui-cli` bin 映射 | ✅ 正确 | `npm view ihui-cli@1.0.0 bin --registry=https://registry.npmjs.org/` | `{ ihui: 'dist/index.js' }` |
| `ihui-cli` 安装可用性 | ✅ 实测通过 | `npm i ihui-cli@1.0.0 --prefix $env:TEMP\ihui-cli-verify` 后跑 `.bin\ihui --version` | 生成 `ihui / ihui.cmd / ihui.ps1`,输出 `1.0.0` |
| `@ihui/sdk`(npm) | ❌ 未发布 | `curl -s https://registry.npmjs.org/@ihui%2Fsdk` | `{"error":"Not found"}`(HTTP 404) |
| `@ihui/api-client`(npm) | ❌ 未发布(定位为内部包,见下) | `curl -s https://registry.npmjs.org/@ihui%2Fapi-client` | `{"error":"Not found"}` |
| `ihui-ai`(PyPI) | ❌ 未发布 | `curl -s https://pypi.org/pypi/ihui-ai/json` | `{"message": "Not Found"}`(HTTP 404) |
| SDK 发布 tag | ❌ 一个都没有 | `git tag -l 'sdk-v*'`(另测 `v*` / `cli-v*`) | 0 行 |
| npm 发布凭据(用户级 .npmrc) | ✅ 已有 granular token `ihui-cli-publish`(2026-10-19 重建,取代 `ihui-cli-bootstrap-publish`) | `npm token list --json --registry=https://registry.npmjs.org/` | `token: npm_hiQo...utvC`,`bypass_2fa: true`,`permissions: [{ name: 'package', action: 'write' }]`,`scopes: 全部包(All packages)`,`created: 2026-10-19T03:01:07Z`,`expiry: 2027-01-17T03:01:07Z` |
| token 备份 | ✅ 已落盘 | `Get-ChildItem D:\DevEnv\secrets` | `npm-token-ihui-cli-2026-10-19.txt`(仓库外,不入 git;`~/.npmrc` 备份为 `~/.npmrc.bak`) |
| token 写权限实测 | ✅ 通过(无 OTP 提示、无 403) | `npm dist-tag add ihui-cli@1.0.0 latest --registry=https://registry.npmjs.org/` | `npm warn dist-tag add latest is already set to version 1.0.0` |
| token 包级写操作实测(deprecate) | ✅ 通过(无 OTP、无 403) | `npm deprecate ihui-cli@0.0.0-stage "staging placeholder, use 1.0.0" --registry=https://registry.npmjs.org/` | `npm notice deprecating ihui-cli@0.0.0-stage with message "staging placeholder, use 1.0.0"`;回读 `npm view ihui-cli@0.0.0-stage deprecated` → `staging placeholder, use 1.0.0` |
| CI 发布 secrets | ⚠️ 部分未配置;npm 侧只需 `NPM_PUBLISH_TOKEN` | `gh secret list --repo IHUI-INF-AI/IHUI-AI`(先 `$env:GH_TOKEN=$null` 走 keyring) | 21 项:`ALERT_EMAIL_TO` / `DEPLOY_SSH_PRIVATE_KEY` / `DESKTOP_API_URL` / `DESKTOP_TAURI_KEY_PASSWORD` / `DESKTOP_TAURI_PRIVATE_KEY` / `GITCODE_OWNER` / `GITCODE_TOKEN` / `GITEE_OWNER` / `GITEE_TOKEN` / `NPM_BOOT_EMAIL` / `NPM_BOOT_PASSWORD` / `NPM_BOOT_PUBKEY` / `NPM_BOOT_USERNAME` / **`NPM_PUBLISH_TOKEN`(2026-10-19T03:04:21Z 已配)** / `NPM_WEB_PASSWORD` / `NPM_WEB_USERNAME` / `SIGNPATH_EMAIL` / `SMTP_HOST` / `SMTP_PASS` / `SMTP_PORT` / `SMTP_USER`;**无** `NPM_TOKEN` / `PYPI_TOKEN` / `MAVEN_*` / `NUGET_*`。注:`NPM_WEB_USERNAME` / `NPM_WEB_PASSWORD` 已于 2026-10-19 从 `npm-bootstrap.yml` 移除引用(`trusted_publisher` 分支删除),这两个 secret 成为无引用残留,可由 owner 可选删除。**2026-10-23 追加**:`GITCODE_OWNER` / `GITCODE_TOKEN` 也已成为无引用残留(GitCode 渠道整体弃用,`mirror-to-cn.yml` 已删除),可由 owner 删除;`GITEE_OWNER` / `GITEE_TOKEN` **仍在用**(桌面端安装包作为 Gitee release 附件分发,非代码镜像),不得删 |
| OIDC trusted publishing | ⛔ **不采用(用户定案:不要 2FA,不绑认证器)** | 历史实测:`npm trust github ihui-cli ...` | 曾返回 `403 Forbidden ... Two-factor authentication is required for this operation`。npm 已下线 TOTP 注册(`404 Adding a new TOTP 2FA is no longer supported.`),只剩 WebAuthn 安全密钥一条路。**用户明确拒绝,故永久放弃该通道,改用 token 发布** |
| Trusted Publisher 网页登记实测 | ⛔ 已终止(用户不要 2FA,不再尝试) | `https://www.npmjs.com/package/ihui-cli/access` → Add Trusted Publisher | 2026-10-19 实测:表单可填可提交,但跳 `Confirm Password to Continue` 后直接落到 `/settings/ihui-ai/tfa` 要求加安全密钥,无邮箱 OTP 分支。**该路径按用户指示永久关闭** |
| desktop GitHub Release | ✅ 已发布(对照项) | `git tag -l 'desktop-v*'` | `desktop-v0.1.42` 等已产出(见 `release-desktop.yml`) |
| 桌面端 updater 闭环 | ✅ 已验证(任务 2,2026-10-19) | 本机自装 0.1.76 全流程 | `checkForUpdate()` 拉 `aizhs.top/desktop-feed.json` → 比对版本 → 验签安装 → 重启,闭环绿 |
| Android versionCode + 可上架 AAB | ✅ 已产出(任务 4,2026-10-19) | `apps/mobile-rn/android/app/.../gradle` `assembleRelease` | AAB 已落 `android/app/build/outputs/bundle/release/`,`versionCode` 由 `app.config.js` 号段派生 |
| 小程序 weapp 产物 | ✅ 已构建(任务 3,2026-10-19) | `pnpm --filter @ihui/miniapp-taro build:weapp` | `apps/miniapp-taro/dist/` 全链 exit 0;上传密钥缺失待用户补 |
| iOS 端 | ⏳ 工程侧全就绪,待用户侧 Apple Developer + EAS 登录 + AASA Team ID 占位替换(任务 6,2026-10-19) | `npx eas build -p ios` | 见下节「iOS 端可行性评估」 |

**结论:`ihui-cli@1.0.0` 已真实发布并通过安装验证;npm 发布通道已定案为 granular token(`bypass_2fa`)。**
**⛔ 用户明确指示:永久不启用 2FA、不绑定任何 WebAuthn 认证器,因此不登记 Trusted Publisher —— 此结论已定案,后续不得再提议或询问。**
CLI 侧发布走 token:本地 `ihui-cli-publish`;CI 由 `release-cli.yml` 先试 OIDC(`--provenance`),失败后自动回退
`secrets.NPM_PUBLISH_TOKEN`(该 secret 已确认存在,2026-10-19T03:04:21Z)。代价仅是 CI 产物没有 Sigstore provenance。
剩余人工动作(用户侧,与 2FA 无关):

1. ~~绑定 2FA 认证器~~ —— ⛔ **不做(用户定案)**。
2. ~~登记 Trusted Publisher~~ —— ⛔ **不做(用户定案)**。
3. 在 PyPI 建项目 `ihui-ai` 并配 `PYPI_TOKEN`(名字必须与 workflow 里的 `secrets.PYPI_TOKEN` 一致)。
4. 决定 `@ihui/*` 内部包(全部 `private:true`)是否随发布 —— 见下方"sdk / cli 依赖闭包"。
5. token 到期运维:`ihui-cli-publish` 到期 **2027-01-17**,到期前在 npm 网页 Tokens 页重新生成(勾 `Bypass 2FA`,无需任何认证器)。

> 备注:token 能做 `publish` / `dist-tag` / `deprecate`(实测通过);包设置类操作(access / trusted publisher)必须 step-up 认证,
> 而 npm 已下线 TOTP 注册且用户不接受 WebAuthn —— 所以这类操作本项目永久不做。

> 2026-10-19 实测补充:曾按用户授权用 API 把账号 2FA 置为 `disable`(当时以为是解封包设置的办法),结果 `npm trust` 与网页登记均被 `Please enable 2fa for your account` 拒绝 —— **npm 的策略是"必须绑认证器",不是"可以关掉"**。随后账号 2FA 已恢复为 `mode: auth-and-writes`(`npm profile get --registry=https://registry.npmjs.org/` → `"tfa": { "pending": null, "mode": "auth-and-writes" }`),但仍未绑定任何认证器,所以包设置类操作依旧被 step-up 认证拦截。

> 2026-10-19 第二次实测(内置浏览器跑到真实页面):Trusted Publisher 表单可正常填写并提交,但提交瞬间被 `Confirm Password to Continue` 拦下;输密码后不是走邮箱 OTP,而是直接跳到 `/settings/ihui-ai/tfa` 要求**添加安全密钥**(`Add your security key` → `Add security key`,必须现场 WebAuthn 手势)。
> **用户当日定案:不启用 2FA、不绑定认证器 → Trusted Publisher 永久不登记。以上仅为追溯记录,不是待办,不得再询问。**

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
| `sdk-v0.1.0` | `release-sdk.yml` | SDK 发版(npm / PyPI / Maven / Go / NuGet **5** 语言) |

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

> **Android 提交轨道 = 门槛命脉（2026-10-20 实测）**：`eas submit -p android` 落到哪条轨道完全由 `eas.json` 的 `submit.production.android.track` 决定，命令本身不说明。个人号"12 名测试员连续 14 天"的正式版门槛**只认封闭测试**，而封闭测试在 androidpublisher v3 里的轨道名是 **`alpha`**（公开测试 = `beta`；**不存在 `closed`/`open` 这两个 API 名**，问 `/tracks/closed` 必返 404，那不是"闭测没轨道"）。`track: "internal"` 的提交永远进不了门槛。
>
> 现读轨道与测试员名单的可移植出路（任何有服务账号权限的机器都能跑，不依赖本仓脚本）：`POST /edits`（空 body 必须带 `Content-Length: 0`）→ `GET /edits/{editId}/tracks` → `GET /edits/{editId}/testers/alpha` → 用完 `DELETE /edits/{editId}`。**一枚应用只允许一枚活跃 edit**，再建会顶掉别人正在用的那枚，所以读完必须删。本机另有便捷器 `scripts/check-play-tracks.cjs`，但注意：**它未被 git 追踪**（`.gitignore` 的裸规则 `*.cjs`），换克隆不存在，只当本机快捷方式用，别把它当交付物。

#### iOS 端可行性评估(2026-10-19,工程侧全就绪)

**工程侧已就绪**(无需本地 Xcode,走 EAS 云端构建):

| 项 | 状态 | 证据 |
| --- | --- | --- |
| `ios.bundleIdentifier` | ✅ | `app.json` `ai.ihui.mobile` |
| `ios.infoPlist` / `usesNonExemptEncryption:false` | ✅ | `app.json` + `eas.json` env |
| `ios.associatedDomains`(applinks) | ✅ | `app.json` `applinks:aizhs.top` + `applinks:file.aizhs.top` |
| `app.config.js` `buildNumber` 号段 | ✅ | UTC `YYMMDDHH` 8 位号段 `[26010100, 2100000000]`,`IHUI_VERSION_CODE` 覆盖口越界抛错 |
| `eas.json` `build.production` | ✅ | `autoIncrement:true` + `android.buildType:apk`(iOS 不锁 apk) |
| `eas.json` `submit.production` | ✅ | 空配置(全量平台) |
| 4 个 Expo config plugin | ✅ | `withWechat.cjs`(CFBundleURLTypes + AppDelegate WXApi 钩子)+ `withCarrier.cjs` + `withExpoImportFix.cjs` + `withSplash.cjs` |
| `expo-notifications ~57.0.0` 已装 | ✅ | 推送能力就绪;`use-push.ts` 已注册到后端 `/push/devices/register` |
| `assets/icon.png` / `splash-icon.png` / `adaptive-icon.png` | ✅ | `apps/mobile-rn/assets/` 就绪 |
| Apple AASA 源文件 | ✅ | `apps/mobile-rn/public/.well-known/apple-app-site-association`(含 `TEAMID.ai.ihui.mobile` 占位) |
| 本地 `ios/` 原生目录 | ⚠️ 无 | 走 EAS 云端构建路径,**无需**本地 Xcode 工程;本地 debug 走 `eas build -p ios --profile development`(simulator) |

**用户侧前置条件(全部在 agent 之外,需用户完成)**:

| 项 | 说明 |
| --- | --- |
| ① Apple Developer 账号 | $99/年;[developer.apple.com](https://developer.apple.com/) 注册 |
| ② EAS 登录 | `cd apps/mobile-rn && npx eas login`(Expo 账号 + Apple 开发者团队绑定) |
| ③ Apple Team ID | Apple Developer 会员页 → Membership Details;用于替换 AASA 中的 `TEAMID` 占位 |
| ④ AASA 文件部署 | ① 把 `apps/mobile-rn/public/.well-known/apple-app-site-association` 中的 `TEAMID.ai.ihui.mobile` 替换为 `<TeamID>.ai.ihui.mobile`;② 部署到 `https://file.aizhs.top/.well-known/apple-app-site-association`(HTTPS、Content-Type: application/json、<128KB、不允许 3xx) |
| ⑤ App Store 元数据 | App Store Connect 创建 App record(本地化、截图 6.7"/6.5"、描述、隐私政策 URL、关键词、类目、年龄分级);图标 1024×1024 |
| ⑥ 推送证书(APNs) | 若启用 `expo-notifications`:App Store Connect → App → App Services → Push Notifications → 注册 APNs 证书;或 EAS 走 `eas build -p ios` 时上传 cert 到 EAS |
| ⑦ 微信 Universal Link 域名 | `aizhs.top` / `file.aizhs.top` 域名 ICP 备案 + HTTPS 证书有效;微信开放平台移动应用注册时填 `https://aizhs.top`(与 `WX_UNIVERSAL_LINK` 一致) |

**上架命令(用户侧动作)**:

```bash
cd apps/mobile-rn
npx eas login                              # 首次
npx eas build --platform ios --profile production
npx eas submit -p ios                     # 走 App Store Connect
```

**可行性结论**:工程侧全就绪,EAS 云端构建路径无阻塞;上架路径仅卡在用户侧 Apple Developer 账号 + EAS 登录 + AASA 占位替换 + 元数据补齐。**iOS 端无工程侧阻塞,可立即启动上架。**

### miniapp-taro(微信小程序审核)

| 项 | 说明 |
| --- | --- |
| 构建命令 | `pnpm --filter @ihui/miniapp-taro build:weapp` |
| 产物 | `apps/miniapp-taro/dist/` |
| 上传(CI/无人值守) | `node scripts/upload-miniapp.mjs --version <ver> --desc "<说明>" [--key <密钥路径>]` |
| 上传密钥来源 | `--key` > 环境变量 `WX_MINIAPP_PRIVATE_KEY` > `apps/miniapp-taro/private.<appid>.key`(密钥取自微信公众平台,禁止入库) |
| 上传依赖 | `pnpm --filter @ihui/miniapp-taro add -D miniprogram-ci`(未装时脚本 exit 2 报缺依赖) |
| 兜底通道 | 微信开发者工具 → 上传 → 提交审核(无密钥时) |
| 审核 | 微信团队审核(1-7 天) |
| 多端 | Taro 4.2 支持同时构建 weapp / alipay / swan / tt / h5 |

**当前状态(2026-10-19,任务 3 收口)**

| 项 | 状态 |
| --- | --- |
| `miniprogram-ci` 已安装 | ✅ `apps/miniapp-taro/package.json` devDependencies |
| weapp 产物构建 | ✅ `apps/miniapp-taro/dist/` 全链 exit 0(编译 51.61s;CSS 覆盖率 728/740 = 98.38%;主包 1558577B / 2097152B,余量 538575B) |
| 上传密钥 | ⚠️ 缺失 —— `apps/miniapp-taro/private.wx27028e276ffdbc5d.key` 不存在,`WX_MINIAPP_PRIVATE_KEY` 未设 |
| 上传动作 | ⏳ 待用户从微信公众平台「开发管理 → 开发设置 → 小程序代码上传密钥」下载 `.pem` 后:`node scripts/upload-miniapp.mjs --version 0.0.6 --desc "..."` |

### cli(npm + 4 包管理器)

CLI 发版由 `release-cli.yml` 自动化,分两阶段:

```yaml
# 阶段 1:npm publish —— 先试 --provenance(OIDC),失败回退 NPM_PUBLISH_TOKEN
- run: npm install -g npm@^11.15.0       # --provenance 的 Sigstore 换发要求 npm >= 11.5.1、Node >= 22.14.0
- run: pnpm --filter ihui-cli build:npm  # esbuild 单文件 bundle → apps/cli/npm-dist/(无 dependencies)
- run: npm view ihui-cli version         # 探测:包已 bootstrap(1.0.0)
- run: npm publish ./npm-dist --access public --provenance || npm publish ./npm-dist --access public
  # 2026-10-19 定案:不启用 2FA → 不登记 Trusted Publisher → OIDC 分支必然失败,
  # 实际由 release-cli.yml 的 if/elif 回退 secrets.NPM_PUBLISH_TOKEN(granular + Bypass 2FA)发布。
  # 代价:CI 产物没有 Sigstore provenance(本地/手动发布同样如此)。

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

### Windows 代码签名(SignPath Foundation)

Windows 上用户会下载到的两份二进制都走 SignPath Foundation 的免费开源代码签名:CLI 的 `ihui.exe`(在 `ihui-windows-*.zip` 内)与桌面端的 NSIS 安装包(`*-setup.exe`)。证书由 Sectigo CA 签发,私钥保存在 SignPath HSM,不落到 CI。下载页与 README 已包含 SignPath Foundation 声明。

> **桌面端一条独有约束(改这条链前必读)**:Tauri 自动更新用 minisign `.sig` 校验安装包**字节**,而 Authenticode 签名会改字节 ⇒ `release-desktop.yml` 的签名步在覆盖安装包后**必须**就地 `tauri signer sign` 重算同名 `.sig`,重算失败即硬失败。让 `.sig` 停在旧字节上的后果是全部已装客户端自动更新失败,比不签名严重。`latest.json` 由 `publish-updater-json`(needs: build)在替换之后聚合,顺序正确;`sync-gitee` / `sync-downloads` 同理取替换后的资产。

**当前状态(2026-10-20)**

| 项 | 状态 |
| --- | --- |
| 申请 | ✅ 2026-10-20 12:40(+0800) 已通过官网表单提交成功(项目 IHUI AI,仓库 https://github.com/IHUI-INF-AI/IHUI-AI,联系邮箱 `502319984@qq.com`)。本机用真实 Chrome 配置副本提交,表单返回「Form submitted — Thank you, we'll be in touch soon.」 |
| 审批 | ⏳ 待审批,官方周期约 1-2 周;对方确认邮件称将在几个工作日内回复后续步骤 |
| 确认邮件 | ✅ 2026-10-20 12:40 收到 `SignPath Foundation Team <oss-support@signpath.org>` 的主题「Open Source Project Submitted」,正文确认已收到申请并将在 next few business days 内联系 |
| 费用 / 证书 | 免费;Sectigo CA 签发 |
| 私钥 | 由 SignPath HSM 保管,CI 只持短期凭据 |
| CI 集成 | ✅ 代码面已接入(`release-cli.yml` + `release-desktop.yml`,凭据未齐时整体跳过、不影响现有发布);⏳ 等申请通过并配齐四项 secret 后跑一次真发版,核对签名链与 `latest.json` 配对 |

> **2026-10-20 状态更正与提交留痕**:此前本文写的「2026-10-18 已提交」与「2026-10-19 已邮件回复声誉问询」没有提交凭据或邮件凭据(QQ 邮箱收件箱、垃圾箱、已删除与已发送均无 SignPath/HubSpot 来信);2026-10-20 12:40 已实际提交成功并收到上述确认邮件。

**申请表中已附的公开佐证**(Reputation 字段):

| 类型 | 链接 |
| --- | --- |
| Product Hunt 收录 | https://www.producthunt.com/products/ihui-ai |
| dev.to 技术博客(维护者 18 篇) | https://dev.to/_fd4c731d8fc551b91150a |
| 前端进阶之旅 AI 资讯站转载(AI Score 8.0) | https://feinterview.poetries.top/ai-monitor/news/introducing-ihui-ai-8-platforms-176-llms-1-codebase-apache-2-0 |
| Molayo 韩文技术博客架构分析 | https://molayo1419.me/insights/ |
| AITNT AI 工具库收录(productId=23174) | https://m.app.aitntnews.com/aiProductDetail.html?productId=23174 |
| MarkdownSkill 技能库收录 | https://www.markdownskill.com/skills/ihui-inf-ai-ihui-ai |
| Bilibili 开源公告 | https://m.bilibili.com/opus/1227375741989027847 |

**审批通过后需要的凭据**(配置在 GitHub 仓库 secrets;**名字以 workflow 实读为准** —— 两条链读同一组四个,缺任一项则签名步整体跳过、发布仍为未签名产物且不报错):

| Secret | 内容 |
| --- | --- |
| `SIGNPATH_API_TOKEN` | SignPath 生成的 API token(submitter 权限) |
| `SIGNPATH_ORGANIZATION_ID` | SignPath Organization ID |
| `SIGNPATH_PROJECT_SLUG` | SignPath Project Slug |
| `SIGNPATH_SIGNING_POLICY_SLUG` | SignPath Signing Policy Slug(如 `release-signing`) |

> ⚠️ `artifact-configuration-slug` **不是** GitHub secret,它在 SignPath 后台配置(`release-cli` 那份根为 `<zip-file>` 内含 `ihui.exe`;`release-desktop` 那份对应 NSIS `*-setup.exe`)。把它当 secret 填会出现"四项不齐 ⇒ 签名步静默跳过 ⇒ 账面全绿而仍在发未签名包"——这是这条链最容易踩的一脚。

**签名步骤的位置**:必须插在 `release-cli.yml` 的 `Package (Windows)` 步骤**之前** —— 先对 `apps/cli/dist-sea/ihui.exe` 做 Authenticode 签名,再用 `Compress-Archive` 打包。反过来签的是压缩包外壳:Authenticode 校验的是 PE 文件本身,zip 内的 exe 仍是未签名状态。

**持续义务**:每次发布都需在 SignPath 门户人工批准该次签名请求,不是配置一次后全自动。

### sdk(5 语言包管理器全通道已接线,凭据待补)

| SDK | 仓库 | 发布命令(tag 触发后的实际步骤) | 审核 | 当前可发布性 |
| --- | --- | --- | --- | --- |
| TS | npm | `pnpm --filter @ihui/sdk build` → `npm publish --access public --provenance`(OIDC 失败自动回退 `NPM_TOKEN`) | 即时 | ⚠️ 产物已可安装,缺 `NPM_TOKEN` |
| Python | PyPI | 复制根 `LICENSE`/`NOTICE` → `python -m build` → `twine check` → `twine upload` | 即时 | ⚠️ 产物已可安装,缺 `PYPI_TOKEN` |
| Go | GitHub(无中心仓库) | 打 `sdk/v<VERSION>` 子 tag 并推送,proxy.golang.org 自动抓取 | 即时 | ⚠️ 依赖 workflow 有 `git push` 权限 |
| Java | Maven Central | `mvn -B clean deploy` | Sonatype 审核(首次约 2 小时) | ❌ `pom.xml` 缺 `<licenses>` / `<developers>` / `<scm>` / `<url>`,无 sources/javadoc jar、无 GPG 签名插件,`MAVEN_USERNAME` / `MAVEN_TOKEN` 也未配置 |
| .NET | NuGet Gallery | `dotnet pack` → `dotnet nuget push --api-key`(`release-sdk.yml` → `nuget-publish`) | 即时 | ⚠️ 通道已接线,缺 `NUGET_API_KEY`;`dotnet build/pack` 尚未在任何开发机真跑过,可构建性只在 CI dry-run 分支验证 |

> **2026-10-19 更正**:旧版本本节写着"仓库内不存在任何 NuGet workflow / 发布脚本",该说法与事实不符 ——
> `packages/sdk/dotnet/Ihui.AI.csproj` 自始在库,`release-sdk.yml` 已有 `nuget-publish` job(含回读校验)。
> 仍未闭环的只有 `secrets.NUGET_API_KEY`。
> 旧版本本节还写着"4 个 job 的 `if:` 在 `push` tag 事件下恒为 false" —— 该门控已于 2026-09-20 修复。

### sdk / cli 依赖闭包(决定"谁能对外发布")

`packages/` 下 16 个包**全部** `private: true` 且 `version: 0.0.0`,入口统一 `main/types → ./src/index.ts`
(仓库内 9 端按源码消费,靠 `turbo` 的 `dependsOn: ["^build"]` 串起构建)。这带来两条硬结论:

| 包 | 定位 | 处理 |
| --- | --- | --- |
| `@ihui/sdk` | 对外唯一 TS 入口 | 已改为可发布形态:`main/types → dist`、`files` 白名单、`license: Apache-2.0`、`publishConfig.registry` 锁 npmjs.org、`@ihui/types` 移到 devDependencies(纯类型引用,发行包不需要) |
| `@ihui/api-client` | **内部传输层,不对外发布** | 保留 `private: true`。理由:① 它被 9 端经 workspace 直接按源码消费,翻成 `dist` 入口会让 `pnpm dev` 依赖先构建,收益为零;② 对外契约由 `@ihui/sdk` 承担,同时发布两个高度重叠的客户端包只会让使用者困惑;③ 它 `dependencies: { "@ihui/types": "workspace:*" }`,而 `@ihui/types` 是 private —— 去 private 也发不出去。**注意:`build` 脚本(`tsc`)是好的,`packages/api-client/dist` 能正常产出**,只是不用于发布。 |
| `@ihui/types` | 契约包 | 仍是 `private: true`。`@ihui/sdk` 的 `dist/*.d.ts` 有 13 处 `import type … from '@ihui/types'`,严格消费者(`skipLibCheck: false`)会报 13 个 TS2307 —— 见"SDK 类型面遗留问题" |
| `ihui-cli` | 对外发布 npm 包 `ihui-cli`(unscoped) | 已收口为**单文件 bundle**:`build:npm`(esbuild CJS)产出 `apps/cli/npm-dist/`,`@ihui/*` 全部内联,`package.json` **无 `dependencies`**,语言包在 `dist/messages/{cli,shared}/`;发布命令为 `npm publish ./npm-dist --access public`。`packages/i18n` 的 `findMessagesRoot()` 已增加 `dist/messages` 探测。**首版 `1.0.0` 已于 2026-10-19 用 granular token 手动 bootstrap 发布并通过安装验证**;后续版本的 CI 发布走 `secrets.NPM_PUBLISH_TOKEN`(同一枚 granular token,勾 Bypass 2FA),**不再需要 Trusted Publisher**(已定案永久不登记) |

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

| Secret | 被谁引用 | 配置状态(2026-10-19 实测 `gh secret list`) |
| --- | --- | --- |
| `NPM_PUBLISH_TOKEN` | `release-cli.yml` npm job；`npm-bootstrap.yml` publish job | ✅ **已配置**(granular token + Bypass 2FA,2027-01-17 到期) |
| `NPM_TOKEN` | 仅 `release-sdk.yml` npm job(`release-cli.yml` 用 `NPM_PUBLISH_TOKEN`) | ❌ 未配置(SDK 通道专用) |
| `PYPI_TOKEN` | `release-sdk.yml` pypi job(`TWINE_PASSWORD`) | ❌ 未配置 |
| `MAVEN_USERNAME` / `MAVEN_TOKEN` | `release-sdk.yml` maven job(`~/.m2/settings.xml`) | ❌ 未配置 |
| `NUGET_API_KEY` | `release-sdk.yml` nuget job(`dotnet nuget push --api-key`) | ❌ 未配置 |
| `GHCR_TOKEN` | GHCR 镜像推送(多数 job 用自动注入的 `GITHUB_TOKEN`) | ❌ 未配置(通常不需要) |

> **名字纠错**:本文件旧版写着 `PYPI_API_TOKEN` 与 `MAVEN_GPG_PRIVATE_KEY` / `MAVEN_GPG_PASSPHRASE` /
> `MAVEN_CENTRAL_USERNAME` / `MAVEN_CENTRAL_PASSWORD` —— 这些名字**没有任何 workflow 引用**。
> PyPI 真实变量名是 `PYPI_TOKEN`;Maven 真实变量名是 `MAVEN_USERNAME` / `MAVEN_TOKEN`;
> NuGet 真实变量名是 `NUGET_API_KEY`(job 已存在,见"sdk(5 语言…)"节);GPG 签名仍未实现。
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
- [tauri.conf.json](../apps/desktop/src-tauri/tauri.conf.json):`bundle.createUpdaterArtifacts: true` 已启用,updater 配的是**单端点**(2026-10-05 机主拍板定稿,原 GitHub 兜底端点已随枚 ea7616fecf 删除):
  1. `https://aizhs.top/desktop-feed.json` —— **唯一端点**,是 Next App Route
     (`apps/web/app/desktop-feed.json/route.ts`)。**第一数据源是入库烘焙快照**
     `apps/web/src/config/desktop-latest.generated.ts`(路由本地直读即返回,零运行时外部依赖);
     只有该文件损坏或缺键时才回落到运行期解析(`api.github.com` 的 `desktop-v*` release 及其
     `latest.json`,revalidate 600s),再兜底到下载页快照 `apps/web/src/config/desktop-feed.generated.ts`。
     ⇒ **每次桌面发版必须重新烘焙 `desktop-latest.generated.ts` 并提交**(见下方「发版流程」第 5 步),
     否则 Release 已经上线、而 `desktop-feed.json` 仍吐旧版本。
     下载页快照由 `resolve-desktop-download.mjs` 在 `release-desktop.yml` 与每日 `sync-downloads.yml` 两处
     **重生成**(2026-10-17 起 CI 只上传产物、不再自动提交回 main,入库需人工提交);
     Windows 包直链走 **Gitee 国内发行**,但自 2026-10-18 起必须先按 Content-Length 与 GitHub 资产 size
     **逐字节对账**才准改用 —— 同名不等于同物(0.1.75 实锤:同名差 4,173 字节 ⇒ 客户端下载成功而验签必失败)。
     (原第 2 条 GitHub `desktop-updater-feed/latest.json` 回退端点已删除——它只由 CI 维护、
     本机发版通道无 GH_TOKEN,属"看似有兜底、实际随发布路径分叉"的假能力。)

  > ⚠️ **2026-09-24 实测纠偏**:上面"已全部配置完毕"当时并不成立。回退端点的 git ref
  > `refs/tags/desktop-updater-feed` **在 origin 上已不存在**(`git ls-remote` 与 `GET` 双双 404,而 Release 对象还在、
  > 资产还被 CI 正常更新),即第 2 条整条是死的。已把 feed tag 归位到它原本的目标提交(不前移)并复验:
  > 回退端点 `GET=200`、`version 0.1.44`、平台数 4。判据提示:**端点是否活着只能靠 HTTP 实测 + `git ls-remote` 双向核**,
  > 不能读文档、也不能看 CI 绿灯 —— `Publish Updater JSON` job 全程 success,而它的产物当时 404。
  > (2026-10-05 后记:该回退端点已随单端点定稿整体删除,本段实测口径成为历史记录。)
  >
  > 🔴 **"两个端点按序回退"这句话本身也是错的(2026-09-24 读 crate 源码实证)**:
  > `tauri-plugin-updater` 的端点循环**只要某个端点返回 200 且 JSON 能反序列化就 `break`**,
  > 之后才在 `download_url()` 里查平台键、查不到即 `Err(TargetNotFound)` **直接失败**。
  > 所以"主端点缺 mac/linux 键、mac 客户端会自己回落到 GitHub"是不成立的 —— 缺键当年是**硬故障**不是软降级。
  >
  > ✅ **主端点缺 mac/linux 键已修(2026-09-24)**:站点 feed 的 `platforms` 不再由 route 自己
  > `find(a => /Windows/i.test(a.format))` 拼单键,而是输出快照的 `updaterPlatforms` 四键映射。
  > 平台推断/择优(`exe>msi`、`AppImage>deb>rpm`、universal 一次填 `darwin-x86_64`+`darwin-aarch64`)、
  > 空签名不出键、URL host 白名单(`{github.com, gitee.com}`;2026-10-12 backfill 补齐后**四平台全部放行** Gitee,口径见 `scripts/lib/tauri-updater-platforms.mjs` 的 `GITEE_ALLOWED_PLATFORMS`。旧句"mac/linux 只认 GitHub,因其 Gitee 直链实测 404"已随补齐失效,别再按它推理)
  > 全部收在唯一真相源 `scripts/lib/tauri-updater-platforms.mjs`,CI 的 `generate-latest-json.mjs`
  > 与快照生成器 `resolve-desktop-download.mjs` 共用它 —— 两条 feed 从此同源同形。
  > **macOS 绝不能用 `.dmg` 填 darwin 键**:dmg 不是可更新产物、没有配套 `.sig`(快照里 dmg 的 signature 恒为空串),
  > 用它 = 客户端下载后验签失败,比"没有更新"更糟;可更新产物是 `AI_universal.app.tar.gz` + 其 `.sig`。
  >
  > ⚠️ **`/api/desktop-feed` 这条同义路由在公网是死的**:边缘 nginx `location /api/` 整体
  > `proxy_pass` 到 `apps/api`(Fastify),Next 侧那个 App Route 永远收不到请求
  > (实测 `GET https://aizhs.top/api/desktop-feed` = 404 且响应头是 API 服务的 `x-api-version: 1`,
  > 而 `/desktop-feed.json` = 200 带 `vary: rsc`)。它**没有**被配进任何 endpoint 列表,故不影响客户端;
  > 保留只为与 `/desktop-feed.json` 共用同一拼装器(`desktop-feed-payload.ts`)不再产出第二份真相。
  > **要新增公网 feed 端点,必须用非 `/api/` 前缀的路径**,否则会被 API 服务吃掉。
- 签名密钥:**全链路只有一把**(`B5D7E67EA2B1DB08`,即 conf 里的 pinned 公钥)。2026-09-24 机检:CI 产的
  exe/AppImage/universal-app.tar.gz 三枚 `.sig`、Gitee 上两枚 exe `.sig`、以及快照里四个平台键的 signature,
  内嵌 keyID **逐一对该公钥相等** ⇒ "mac/linux 要补签名密钥"是伪命题,**不得新建密钥对**
  (新建即让存量客户端验签全废)。`deploy/prod-bundle/keys/ihui-desktop.key`(+`.pub`)是**另一对** keyID
  (`664FF5770686C5AC`),未参与任何已发布产物,不要误当发布私钥;2026-10-18 更硬的一条:它**连自己都不成对**
  (`.key` 内嵌明文公钥 `4928d40f…`,同目录 `.pub` 却是 `f76bff45…`)。判"成对"必须比公钥字节,
  不能比由 keynum 派生出来的十六进制注释(注释就是 keynum 的小端写法,只证单文件自洽)。
  公钥在仓库、**私钥只在 CI secrets**(`DESKTOP_TAURI_PRIVATE_KEY`)。"与发版机 `~/.tauri/ihui-updater.key`"
  那半句 2026-10-18 起不再成立:本机该目录现为空,而在它被填入内容的那一晚现读证明,放进去的私钥与配置信任锚
  **不配对**(私钥内嵌 `2a4f1192…` vs 邻居 `.pub` `392ca89b…` vs conf `19dac610…`,三者互不相干)⇒ **本机没有一把可用私钥**,
  本地只能走 `DESKTOP_ALLOW_UNSIGNED=1` 出**不可发版**的包;此后若再往 `~/.tauri/` 放钥匙,配对自证会先拦住。

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
> - 或 API 触发:`POST /repos/IHUI-INF-AI/IHUI-AI/actions/workflows/release-desktop.yml/dispatches`,body `{"ref":"main","inputs":{"tag":"desktop-vX.Y.Z"}}`,需要 GitHub 凭据 token(`git credential fill` 提取 `gho_` token);HTTP 204 = 触发成功,随后到 Actions 页确认新 run 的 3 个构建 job(windows-x64 / macos-universal / linux-x64)均为 in_progress(无早期失败)

3. `release-desktop.yml` 自动执行:3 个构建 job(windows-x64 / macos-universal / linux-x64;macOS universal 一份产物同时覆盖 Apple Silicon 与 Intel)构建 → 上传安装包 + `.sig` 签名包到 Release → `publish-updater-json` 聚合全部平台生成 `latest.json`(仅上传到发版 Release;原"固定 feed tag `desktop-updater-feed`"上传已随 2026-10-05 兜底端点删除移除)→ `sync-downloads` 把产物同步到 `apps/web/public/downloads/` 并作为 artifact 留档(2026-10-17 起 CI 不再自动提交回 main)
   - **注意**:exe/msi 不入库是 `.gitignore` 的决定(`apps/web/public/downloads/desktop/`),**不是**体积限制 —— 2026-10-18 现读 Windows 安装包约 10 MB(旧句"~230MB 超过 GitHub 单文件 100MB 限制"属 `offlineInstaller` 时代,枚 ac695ce9d7a 改回 embedBootstrapper 后已不成立)。
4. `sync-downloads` job 同时运行 `scripts/resolve-desktop-download.mjs`,从 GitHub Releases API **动态解析**最新 `desktop-v*` release 的安装包(URL/大小/版本/发布日期),刷新 `apps/web/src/config/desktop-feed.generated.ts` 快照并作为 artifact 留档。Web 下载页(`/download/desktop`)构建期读取该快照渲染下载按钮——**发版后仍需有人跑 `pnpm resolve:desktop-download` 并提交,下载页才会换到新版**(2026-10-17 起 CI 不再自动提交回 main,"自动更新、无需手动"那句已不成立)。
5. **烘焙更新器第一数据源(必做,漏做则 `/desktop-feed.json` 继续吐旧版)**:等 CI 的 `sync-gitee` 把本次 exe 传到 Gitee 之后(**公开更新源只烘焙 CI 产出的包,SignPath 凭据齐备时会自动带 Authenticode**;本机 `release-desktop-local.mjs --allow-unsigned-upload` 的包只作审批前应急下载,不得烘焙进本文件),从**本次 Release** 取 `latest.json`(`gh release download desktop-vX.Y.Z -p latest.json -O .ihui-agent/tmp/latest.json`),1:1 写入 `apps/web/src/config/desktop-latest.generated.ts`;唯一允许的改动是把 `platforms.windows-x86_64.url` 换成 Gitee 镜像直链,且改前必须按 Content-Length 与 GitHub 资产 size 对账(同名不同字节 ⇒ 下载成功但验签必失败,0.1.75 已实锤)。验收三条:① `version` 等于本次 tag 去掉 `desktop-v`;② Windows 直链的 Content-Length 等于 Release 里同名 `.exe` 的 size;③ 四平台 `signature` 与 Release 的 `latest.json` 逐字相同。改完提交并等 Web 部署生效。
6. 用户端:应用启动时 `checkForUpdate()` 拉唯一端点(`https://aizhs.top/desktop-feed.json`)的 `latest.json` → 比对版本 → 下载签名包 → `downloadAndInstall()` 验签安装 → 重启

> 本机 `scripts/release-desktop-local.mjs` 是 Windows 应急通道:它只做 Tauri 更新签名,不做 Authenticode,默认拒绝上传 Gitee;确需在 SignPath 审批前发未签名包,显式加 `--allow-unsigned-upload`,且该包不得烘焙进公开更新源。

> 手动刷新快照(CI 失败兜底 / 本地调试):`node scripts/resolve-desktop-download.mjs`(有差异才写);`--check` 仅对比(有差异退出码 1);`--offline` 仅查看本地快照。

### 前置 Secrets(仓库 Settings → Secrets and variables → Actions)

| Secret | 用途 |
| --- | --- |
| `DESKTOP_TAURI_PRIVATE_KEY` | 签名私钥内容(`cat ~/.tauri/ihui.key`) |
| `DESKTOP_TAURI_KEY_PASSWORD` | 私钥密码(无密码留空) |
| `DESKTOP_API_URL` | 生产 API 基址(如 `https://api.ihui.ai`,不设则桌面端 API 为空) |

> ⛔ **私钥"丢失"时禁止生成新密钥对**(2026-10-18 更正;原文写"重跑 `generate-tauri-keys.yml` 生成新密钥对并把新公钥更新到 tauri.conf.json",那是教人做一次破坏性轮换:公钥钉在 `tauri.conf.json` 与**已分发出去的所有客户端**里,换新对 = 存量客户端从此验不出任何新签名,只能全员人工重装,比"丢失"本身更糟)。
> 唯一正确出路是**取回在用的那把原私钥**:权威存货是 CI secrets `DESKTOP_TAURI_PRIVATE_KEY`(+ `DESKTOP_TAURI_KEY_PASSWORD`),机主另有备份。`generate-tauri-keys.yml` 只用于**首次建立**发布链,不得当"恢复丢失"用。
> 同表里 `cat ~/.tauri/ihui.key` 那个文件名**没有任何脚本读它**:本机约定路径是 `~/.tauri/ihui-updater.key` + `~/.tauri/ihui-updater-password.txt`(读它的是 `scripts/release-desktop-local.mjs`),而该脚本现在动手签之前会做**配对自证** —— 私钥内嵌公钥与 conf 的 `plugins.updater.pubkey` 不逐字节相等就判孤儿退出(orphan ⇒ exit 1,量不出 ⇒ exit 2)。

---

## 最优下一步建议

- 发布前务必跑 `node scripts/pre-deploy.mjs`,它是发布事故的第一道防线。
- 蓝绿部署 + 健康检查 + 自动回滚已内置,但灰度发布需手动配置 `CANARY_PERCENTAGE`,重大版本建议先灰度 10% 观察 30 分钟。
- CLI / SDK 发版后,记得同步更新 4 包管理器 manifest 的 SHA256,否则用户 `winget upgrade` / `scoop update` 拿不到新版本。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
