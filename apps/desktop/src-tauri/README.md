<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# desktop 构建说明（薄壳 + 运行时直连线上，2026-09-13 W8 立 / 2026-09-17 薄壳改版）

## 依赖关系

desktop（Tauri 2）**不独立构建前端**，也**不再内嵌 web 静态导出产物**：

- `tauri.conf.json` 的 `build.frontendDist` 现指向薄壳目录 `shell`（内容仅 `shell/index.html`，几 KB，只做 meta-refresh 首屏兜底），`build.beforeBuildCommand` 为空串。
- 窗口运行时加载 `app.windows[0].url` = `https://aizhs.top/agents`（线上部署的 web 站点）；`src/auto_refresh.rs` 的 `FRONTEND_URL` / `HEALTH_URL` 常量与之对应，健康检查连续失败时切到内嵌的 `offline://` 协议页（`offline/index.html`），恢复后自动切回线上前端。
- 因此 exe 不含前端资源，web 能力更新只需线上部署即生效、无需重发桌面包（2026-09-17 commit `f10258c8f6`「终极薄壳」）。

## 发布流程

```bash
# 本机一键发版（仅 Windows 通道）：bump 版本 → tauri build（薄壳 + 签名）→ Gitee release 直传
#   exe+sig → desktop-feed 更新 → 版本 bump 提交推送 → 本机静默自装
node scripts/release-desktop-local.mjs            # 可选参数 --no-install / --no-push / --minor / --major

# 只构建安装包，不发布
pnpm --filter @ihui/desktop build                 # = tauri build；beforeBuildCommand 为空，不再校验或构建 web/out
pnpm build:desktop:saas                           # 同上，先注入 NEXT_PUBLIC_* 线上后端地址（scripts/desktop-build-saas.mjs）

# 全平台（macOS universal + Linux）走 CI：tag 触发（on.push.tags: desktop-v*），亦支持 workflow_dispatch 手填 tag
git tag desktop-v<version> && git push origin desktop-v<version>   # → .github/workflows/release-desktop.yml
```

注：`beforeBuildCommand` 为空且 Rust 侧不读 `NEXT_PUBLIC_*`，故 `build:desktop:saas` 注入的环境变量当前不再进入任何前端构建；运行时前端以线上部署为准（该脚本仍保留其历史入口职责）。

### 签名密钥与更新 feed

- 本机：`~/.tauri/ihui-updater.key` + `~/.tauri/ihui-updater-password.txt` → `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`（`scripts/release-desktop-local.mjs`）。
- CI：同名 env 取自 secrets `DESKTOP_TAURI_PRIVATE_KEY` / `DESKTOP_TAURI_KEY_PASSWORD`（`release-desktop.yml`）。
- feed：`tauri.conf.json` → `plugins.updater.endpoints` 两条，`https://aizhs.top/desktop-feed.json`（站点快照，由 `scripts/resolve-desktop-download.mjs` 刷新）与 GitHub Release 固定附件 `.../releases/download/desktop-updater-feed/latest.json`（`scripts/generate-latest-json.mjs` 聚合各平台后发布）；`bundle.createUpdaterArtifacts: true` 产出 `.sig`。
- 开发态端口：`build.devUrl` = `http://localhost:8801`，`beforeDevCommand` = `pnpm --filter @ihui/web dev`。

## Windows 安装包（NSIS）

`bundle.windows.nsis` 指定 `template: windows/installer.nsi` + `installerHooks: windows/hooks.nsi`（`languages: SimpChinese / English`，`compression: lzma`）。

- `windows/installer.nsi`：Tauri 上游 NSIS 模板的**定制副本**（定制补丁清单见该文件头部注释），非定制段落禁止手改；由 `scripts/desktop-nsis-template.mjs` 维护——`--check` 校验「仓库模板 == 上游 + IHUI 补丁」、`--write` 从当前 Tauri CLI 重新生成、`--emit-patches` 把直接手改导出成侧车补丁。升级 Tauri CLI 后必跑 `--check`；手改过 `installer.nsi` 后必跑 `--emit-patches`。
- `windows/hooks.nsi` → include `windows/ihui-ui.nsi`：自定义向导 UI，视觉语言「墨光 · Ink Aurora」（2026-09-22 改版）——880×600 无边框深色窗口、左侧 248px 品牌导轨（`#1e2e36` = `.dark --color-brand-accent-light`）、导轨常驻四步进度指示器、安装页百分比大字 + 阶段文案 + 品牌配色进度条；色值全部映射 `packages/design-tokens/src/styles/tokens.css` 暗色块（品牌渐变 `#b8d4e3 → #a3c4d6`）。
- 位图资产：`windows/installer-assets/assets-{100,125,150,175,200}/`（按 DPI 缩放档位），含开屏多帧动画（`splash.bmp` + `splash1..15.bmp`）、五个向导页满幅背景、位图按钮；由 `scripts/desktop-installer-assets.mjs` 生成（`--previews` 只输出 PNG 预览到 `%TEMP%` 供人工审阅），并写出 `windows/ihui-assets-path.nsh`。
- 版面几何与 `ihui-ui.nsi` 的运行期控件坐标严格一一对应，改任一处必须同步另一处。
- 对账：`node scripts/check-installer-assets.mjs` 校验「nsi 引用 ⊆ File 打包清单 ⊆ 五档落盘文件」——漏登记会让运行期控件空白而编译零报错（2026-09-20 最小化按钮事故）。上述两个脚本均需手动执行，未接入 pre-commit / CI。

## 守门

- `apps/desktop/scripts/ensure-web-out.mjs`：旧的 web 产物校验脚本，`beforeBuildCommand` 置空后**已无任何配置或脚本引用**（文件仍保留，未删除）。
- `device-fingerprint.ts` 已删除（无人调用，不留死抽象）。

## 何时需要重新评估

「desktop 脱离 web 产物独立发版」已于 2026-09-17 落地（薄壳 + 运行时直连线上站点）。若未来要回到内嵌前端产物方案（如桌面专属离线包、独立版本节奏），需同步改 `build.frontendDist` / `build.beforeBuildCommand` 与本 README，并把 `ensure-web-out.mjs` 重新接回构建链。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
