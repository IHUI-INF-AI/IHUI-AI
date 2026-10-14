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
线上部署的 apps/web 站点   https://aizhs.top/（首页，2026-10-13 起启动页，此前为 /agents）
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

桌面端开发有两条路，按「窗口加载谁」区分：

| 入口                              | 窗口加载                                        | 后端                                            | 适用                            |
| --------------------------------- | ----------------------------------------------- | ----------------------------------------------- | ------------------------------- |
| `pnpm dev:desktop:saas`           | `http://localhost:8801/`（本地 web dev server） | **开发后端**（本机 api 8802 / ai-service 8803） | 日常联调（2026-10-13 起的默认） |
| `pnpm --filter @ihui/desktop dev` | `https://aizhs.top/`（线上站点）                | 线上生产                                        | 验证薄壳本身 / 线上行为         |

### 开发后端联调（默认）

```bash
pnpm dev:desktop:saas
```

`scripts/desktop-dev-saas.mjs` 做四件事：释放并常驻拉起 8801 dev server（**不注入任何后端 env**）→ 校验 `GET /` 返回 200（防止端口上躺着别的服务）→ 停掉本仓 target 目录的残留桌面端实例（cargo 链接阶段要删 exe）→ `tauri dev --config` 覆盖启动。覆盖内容（`--config` 合并语义：`app.windows` 是整数组替换、`build` 是对象深合并）：

- `build.beforeDevCommand` 置空 —— dev server 已由脚本启动，Tauri 不再重复拉起抢端口；
- `app.windows[0].url` 改为 `http://localhost:8801/` —— 薄壳态下 `tauri.conf.json` 的 url 是绝对线上地址（`External` 原样加载，`devUrl` 不生效），不改它窗口永远加载线上生产。url 必须带**完整 windows[0] 对象**再改（只给 `{label,url}` 会丢掉 `decorations:false`/`visible:false`/`theme` 等，2026-09-28 实测）。且必须写绝对地址 `http://localhost:8801/` 而不是 `index.html` —— Next dev 对 `/index.html` 返回 404 页，只有 `/` 是真应用（2026-10-13 实测）。

后端寻址不需要任何 env：`apps/web/src/lib/api-base-url.ts` 按窗口 origin 判定 —— 桌面端窗口是 localhost:8801 ⇒ REST `127.0.0.1:8802` / ai-service `127.0.0.1:8803` / SSE `localhost:8802` / WS `127.0.0.1:8802`；浏览器直接开 8801 则走同源 `/api/*` 反代（next rewrites），同样落 8802/8803。Rust 侧 `auto_refresh` 的探活/指纹/离线恢复也按窗口 origin 派生（`BackendBase`，2026-10-13 起）：开发后端在跑时不会误判离线，恢复时也不会被顶回线上首页。

换后端（不换窗口）：

```bash
IHUI_API_PROXY_TARGET=https://aizhs.top pnpm dev:desktop:saas      # 本地 web + 线上 API（同源 /api/* 反代）
NEXT_PUBLIC_API_BASE_URL=https://aizhs.top pnpm dev:desktop:saas   # 绝对基址直连（需目标 CORS 放行 http://localhost:8801）
node scripts/desktop-dev-saas.mjs --keep-dev-server                # 复用 8801 现有 dev server
```

IPC 授权说明：dev 构建下窗口 origin 与 `devUrl` 同源 ⇒ Tauri 判定 `Origin::Local`（tauri 2.11.5 `src/webview/mod.rs` `is_local_url`），本地页可直接用 IPC，无需把 localhost 加进 `capabilities/default.json` 的 `remote.urls`（该清单只放行 aizhs.top，生产语义不变）。

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
