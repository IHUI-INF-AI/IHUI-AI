<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI AI Desktop（智汇AI 桌面端）

> Tauri 2 + WebView2 桌面客户端。**薄壳（thin shell）分发策略**——桌面端不自建前端，安装包也不内嵌前端产物，运行时直连线上站点。

## 分发策略：薄壳 + 运行时直连线上

桌面端不维护独立的前端工程；自 2026-09-17（commit `f10258c8f6`「终极薄壳」）起，窗口在运行时加载**线上部署的 `apps/web` 站点**，安装包不再内嵌 web 静态导出产物。桌面端仍**自动继承 web 端全部对话能力**（Markdown 流式渲染、推理折叠、工具卡、审批、diff、Plan/Terminal 等），且 web 能力更新只需线上部署即生效，无需重发桌面包。

依赖关系链：

```
线上部署的 apps/web 站点   https://aizhs.top/agents
        ▲  运行时加载：tauri.conf.json → app.windows[0].url
        │
apps/desktop/src-tauri/shell/index.html   ← frontendDist 占位薄壳（几 KB）
        │  仅 meta-refresh 兜底首屏；断网由 Rust 侧 auto_refresh 守卫接管
        ▼
apps/desktop 的 Tauri 打包产物（不含前端资源）
```

- `build.frontendDist`：`"shell"`（见 `src-tauri/tauri.conf.json`）——打包时内嵌的前端目录，现仅含占位页 `src-tauri/shell/index.html`。
- `build.beforeBuildCommand`：`""`——打包前不再执行任何前端构建。
- `scripts/ensure-web-out.mjs`（`apps/desktop/scripts/`）：旧的 web 产物校验/按需重建脚本，**文件仍在仓库，但已无任何配置或脚本引用它**（`beforeBuildCommand` 已置空）。历史行为：当 `web/out` 缺失或 web 源码比产物更新时执行 `pnpm --filter @ihui/web build:static`，强制重建可设 `FORCE_FRONTEND_BUILD=1`；该入口另可被 `TAURI_SKIP_FRONTEND=1` 短路。以上均已不参与当前构建链。

## 本地开发

```bash
# 在仓库根目录或 apps/desktop 下执行（tauri dev 会按 tauri.conf.json 自动拉起 web dev server）
pnpm --filter @ihui/desktop dev

# 日常联调推荐：连线上生产后端的 dev 模式（自行释放 8801 并常驻拉起 dev server）
pnpm dev:desktop:saas
```

`tauri.conf.json` 的 `beforeDevCommand` 为 `pnpm --filter @ihui/web dev`，`devUrl` 为 `http://localhost:8801`。**但这两条在开发态都不起作用**：主窗口的 `app.windows[0].url` 写的是绝对地址 `https://aizhs.top/agents`，而 Tauri 2 只有 `WebviewUrl::App`（相对路径）才会被解析到 `devUrl`，`External` 一律原样加载（`tauri-utils/src/config.rs` 的 http(s) 反序列化 + `tauri/src/manager/webview.rs` 的 `get_app_url()` 分支，2.11.x 实测）。所以 `tauri dev` 与 `pnpm dev:desktop:saas`（`scripts/desktop-dev-saas.mjs` 只覆盖 `beforeDevCommand`）加载的都是线上前端，`devUrl` 是一条没被用上的历史配置。

要在开发态加载本地 web 构建（验证"只在本地存在的界面"时必须这么做），把窗口 `url` 一起换成相对路径、并把 `devUrl` 指到本地端口：

```bash
# 覆盖配置只影响本次 dev 进程，零文件改动(2026-09-28 实测:DevTools 标题变为 localhost:8861)
node -e 'const c=require("./apps/desktop/src-tauri/tauri.conf.json");const w={...c.app.windows.find(x=>x.label==="main"),url:"index.html"};require("fs").writeFileSync(".ihui-agent/tmp/desktop-dev-override.json",JSON.stringify({build:{beforeDevCommand:"",devUrl:"http://localhost:8861"},app:{windows:[w]}}))'
pnpm --filter @ihui/desktop exec tauri dev --config .ihui-agent/tmp/desktop-dev-override.json
```

两点实测注意：① 覆盖必须带上**完整的 windows[0] 对象**（只给 `{label,url}` 会丢掉 `decorations:false`/`visible:false`/`theme` 等）；② `url` 要写成相对值而不是 `http://localhost:8861/` —— 绝对地址会被当成远程来源，而 `capabilities/default.json` 的 `remote.urls` 只放行 `aizhs.top`，本地页会拿不到 IPC（表现是宿主命令全部失败）。另外 `src-tauri/src/auto_refresh.rs` 的离线守卫在连续探活失败后会把页面顶回线上首页，dev 期间需保证 `aizhs.top/api/health` 可达。

## 构建

```bash
pnpm --filter @ihui/desktop build          # = tauri build（beforeBuildCommand 为空，不构建/不内嵌前端）
pnpm --filter @ihui/desktop build:debug    # 调试版
pnpm build:desktop:saas                    # 根目录入口：注入 NEXT_PUBLIC_* 线上后端地址后走同一条 tauri build
```

注：由于 `beforeBuildCommand` 已为空、构建链中不再有前端编译（Rust 侧也不读 `NEXT_PUBLIC_*`），`build:desktop:saas` 注入的环境变量当前**不会影响**运行时的线上前端——运行时前端以 `https://aizhs.top` 部署为准。

## 重要提示

- **要修改对话 UI（消息渲染、工具卡、审批、Plan/Terminal 等），请在 `apps/web` 进行**，不要在 `apps/desktop` 内另起炉灶。桌面端只是线上 web 站点的壳，改 `apps/web` 后**部署上线**即对 web 端与桌面端同时生效（无需重发桌面包）。
- 桌面端**没有** `apps/desktop/src` 前端目录。平台特有部分全在 `src-tauri/` 下：`src/`（Rust：窗口控制、深链、`auto_refresh` 断网热刷新）、`shell/`（`frontendDist` 占位页）、`offline/`（离线提示页）、`windows/`（NSIS 安装器模板与自定义向导 UI）。纯前端 UI 一律归 `apps/web`。
- 构建与安装包（NSIS）细节、发版与更新 feed、签名密钥，见 `src-tauri/README.md`。
