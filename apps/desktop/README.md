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

| 入口                              | 窗口加载                                        | 后端                                                                        | 适用                            |
| --------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------- |
| `pnpm dev:desktop:saas`           | `http://localhost:8801/`（本地 web dev server） | **开发后端**（同源 `/api/*` 经 next dev 反代 → api 8802 / ai-service 8803） | 日常联调（2026-10-13 起的默认） |
| `pnpm --filter @ihui/desktop dev` | `https://aizhs.top/`（线上站点）                | 线上生产                                                                    | 验证薄壳本身 / 线上行为         |

### 开发后端联调（默认）

```bash
pnpm dev:desktop:saas
```

`scripts/desktop-dev-saas.mjs` 做四件事：释放并常驻拉起 8801 dev server（**不注入任何后端 env**）→ 校验 `GET /` 返回 200（防止端口上躺着别的服务）→ 停掉本仓 target 目录的残留桌面端实例（cargo 链接阶段要删 exe）→ `tauri dev --config` 覆盖启动。覆盖内容（`--config` 合并语义：`app.windows` 是整数组替换、`build` 是对象深合并）：

- `build.beforeDevCommand` 置空 —— dev server 已由脚本启动，Tauri 不再重复拉起抢端口；
- `app.windows[0].url` 改为 `http://localhost:8801/` —— 薄壳态下 `tauri.conf.json` 的 url 是绝对线上地址（`External` 原样加载，`devUrl` 不生效），不改它窗口永远加载线上生产。url 必须带**完整 windows[0] 对象**再改（只给 `{label,url}` 会丢掉 `decorations:false`/`visible:false`/`theme` 等，2026-09-28 实测）。且必须写绝对地址 `http://localhost:8801/` 而不是 `index.html` —— Next dev 对 `/index.html` 返回 404 页，只有 `/` 是真应用（2026-10-13 实测）。

后端寻址不需要任何 env：`apps/web/src/lib/api-base-url.ts` 按窗口 origin 判定 —— 桌面端 dev 壳（窗口由本机 Next dev server 承载，端口 8801）的 REST 与 ai-service 一律**同源** `/api/*`，由 next dev rewrites 反代到 8802/8803（2026-10-15 改：跨 host 直连会把 httpOnly refresh cookie 变成第三方，桌面 dev 壳的登录态就只剩与生产壳共享的那颗 `auth.json` 键，两壳会互相覆盖、并在刷新被否时互相清空对方登录态）；SSE `localhost:8802` / WS `127.0.0.1:8802` 仍直连本机（dev 代理会缓冲 SSE；WS 保留直连是沿用改判前的既有行为并少一跳——注意 next 加上 `/ws/:path*` 规则后 dev 的 WS 反代实测是通的，不要把直连的理由记成"rewrites 不代理 WS 升级"）；`tauri.localhost` 本地壳与 `offline://` 兜底页没有 dev server 可反代，才回退本机 8802/8803。浏览器直接开 8801 一直是同源，行为不变。Rust 侧 `auto_refresh` 的探活/指纹/离线恢复也按窗口 origin 派生（`BackendBase`，2026-10-13 起）：开发后端在跑时不会误判离线，恢复时也不会被顶回线上首页。另：dev 构建（`cfg!(debug_assertions)`）不跑应用自更新，前端腿由 `isDesktopDevShell()` 挡启动静默检查（`?dev-update=1` 显式试验通道与托盘「检查更新」人工路径不受限）。

换后端（不换窗口）：

```bash
IHUI_API_PROXY_TARGET=https://aizhs.top pnpm dev:desktop:saas      # 本地 web + 线上 API（同源 /api/* 反代）
NEXT_PUBLIC_API_BASE_URL=https://aizhs.top pnpm dev:desktop:saas   # 绝对基址直连（需目标 CORS 放行 http://localhost:8801）
node scripts/desktop-dev-saas.mjs --keep-dev-server                # 复用 8801 现有 dev server
```

IPC 授权说明：dev 构建下窗口 origin 与 `devUrl` 同源 ⇒ Tauri 判定 `Origin::Local`（tauri 2.11.5 `src/webview/mod.rs` `is_local_url`），本地页可直接用 IPC，无需把 localhost 加进 `capabilities/default.json` 的 `remote.urls`（该清单只放行 aizhs.top，生产语义不变）。

## 构建

```bash
pnpm --filter @ihui/desktop build          # = node ../../scripts/desktop-build.mjs（注入 MSVC 后 tauri build + 单一产物收敛）
pnpm --filter @ihui/desktop build:debug    # 调试版，同一入口加 --debug
pnpm --filter @ihui/desktop dev            # = desktop-build.mjs --dev（tauri dev，同样注入 MSVC）
pnpm build:desktop:saas                    # 根目录入口：注入 NEXT_PUBLIC_* 线上后端地址后走同一条链
```

注：由于 `beforeBuildCommand` 已为空、构建链中不再有前端编译（Rust 侧也不读 `NEXT_PUBLIC_*`），`build:desktop:saas` 注入的环境变量当前**不会影响**运行时的线上前端——运行时前端以 `https://aizhs.top` 部署为准。

### Windows 工具链前置（由仓内脚本注入，无需手动 call vcvars）

本机系统 PATH 里有 Git 自带的 `link.exe`（`C:\Program Files\Git\usr\bin`，GNU coreutils 同名程序），而 `src-tauri/.cargo/config.toml` 的 `linker = "link.exe"` 是**裸名**、原样按 PATH 解析 ⇒ 未加载 MSVC 的 shell 里链接阶段直接失败，报 `link: missing operand after '\377\376'`（实测；该报错只字不提工具链，别顺着它去查 cargo）。

- MSVC 注入由 `scripts/desktop-build.mjs` 承担（判据唯一真相源 `scripts/lib/msvc-env.mjs`），等价命令：仓库根执行 `node scripts/desktop-build.mjs`，调试版加 `--debug`，开发态加 `--dev`。`build` / `build:debug` / `dev` / `dev:cdp` 四个脚本都走它，用户**不需要**自己 call vcvars。
- 取不到工具链时脚本打印显式「未判定」并 `exit 2`，**不**静默回落成"裸 env 硬跑"。
- `pnpm build:desktop:saas`（`scripts/desktop-build-saas.mjs`）、`pnpm dev:desktop:saas`（`scripts/desktop-dev-saas.mjs`）与发版脚本（`scripts/release-desktop-local.mjs`）复用同一份注入判据。
- 自查：`where link` 的第一命中应指向 `...\VC\Tools\MSVC\…\bin\HostX64\x64\link.exe`；指向 Git 那个就是没注入。
- **唯一仍需自行处理工具链的是裸跑**：`tauri build` / `tauri dev` / `cargo build` 直接调（不经上面任何一个脚本）时，须自行在开发 shell 加载 `vcvars`/`vsdevcmd`（安装位置随机器变，不写死路径）。

### 本地无签名私钥时怎么打包（`DESKTOP_ALLOW_UNSIGNED=1`）

`src-tauri/tauri.conf.json` 钉着 `bundle.createUpdaterArtifacts: true` + updater 公钥，而 minisign 私钥 `~/.tauri/ihui-updater.key` **只在发版机/CI 上**。本机没有私钥时 makensis 其实已经产出 `setup.exe`，只是随后的签名步报 `A public key has been found, but no private key.` ⇒ 整条命令 exit 1。

```bash
DESKTOP_ALLOW_UNSIGNED=1 pnpm --filter @ihui/desktop build   # 仅本地自测包
```

该开关两段同时生效（判据单源 `scripts/lib/desktop-unsigned-config.mjs`）：① 给 tauri 传一份只关 `bundle.createUpdaterArtifacts` 的临时 config（在 `.ihui-agent/tmp/` 下、用完即删，只覆盖这一个字段，pubkey/bundle 目标/版本号一律不动）；② 同一个 env 继续传给尾部收敛钩子 `scripts/desktop-artifact-single.mjs`，让它放行"缺 `.sig`"那一项。

未设该 env 时行为不变、仍然判红——它是**显式开关**，不是自动降级。
⚠️ **两套签名别混**:`DESKTOP_ALLOW_UNSIGNED=1` 只关 Tauri 更新签名(minisign),不关 Windows Authenticode。未带 Tauri 签名的产物**不得**进更新源、不得发版、不得上传任何下载/更新 CDN;而 Authenticode 由 CI 的 SignPath 负责,本机 `release-desktop-local.mjs` 默认拒绝上传未签名包(应急加 `--allow-unsigned-upload`,且该包不得烘焙进公开更新源)。公开 Windows 发布一律走 `desktop-v*` tag 的 CI。

## 重要提示

- **要修改对话 UI（消息渲染、工具卡、审批、Plan/Terminal 等），请在 `apps/web` 进行**，不要在 `apps/desktop` 内另起炉灶。桌面端只是线上 web 站点的壳，改 `apps/web` 后**部署上线**即对 web 端与桌面端同时生效（无需重发桌面包）。
- 桌面端**没有** `apps/desktop/src` 前端目录。平台特有部分全在 `src-tauri/` 下：`src/`（Rust：窗口控制、深链、`auto_refresh` 断网热刷新）、`shell/`（`frontendDist` 占位页）、`offline/`（离线提示页）、`windows/`（NSIS 安装器模板与自定义向导 UI）。纯前端 UI 一律归 `apps/web`。
- 构建与安装包（NSIS）细节、发版与更新 feed、签名密钥，见 `src-tauri/README.md`。
