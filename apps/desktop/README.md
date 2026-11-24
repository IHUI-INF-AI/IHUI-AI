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
- `build.beforeBuildCommand`：`"node ../../scripts/desktop-installer-assets.mjs"` —— 打包前只生成 NSIS 安装器所需的多档 DPI 图标资产，**不构建任何 web 产物**（薄壳口径不受影响；2026-11-12 按现读值更正，此前本文误写成 `""`）。
- `scripts/ensure-web-out.mjs`（`apps/desktop/scripts/`）：旧的 web 产物校验/按需重建脚本，**文件仍在仓库，但已无任何配置或脚本引用它**。历史行为：当 `web/out` 缺失或 web 源码比产物更新时执行 `pnpm --filter @ihui/web build:static`，强制重建可设 `FORCE_FRONTEND_BUILD=1`；该入口另可被 `TAURI_SKIP_FRONTEND=1` 短路。以上均已不参与当前构建链。

## 离线行为与边界

薄壳不内嵌业务前端，**AI 对话、模型调用与会话同步都依赖线上服务，离线无法进行 AI 对话** —— 这是架构约束，不是换壳能解决的（模型与 API 在服务端）。壳侧的降级链已实现在 `src-tauri/src/auto_refresh.rs`，兜底页为 `src-tauri/offline/index.html`：

- 启动探活决定首屏：窗口以 `visible: false` 创建，在线由 `page_load_finished` 点亮，离线直接切内置 `http://offline.localhost/index.html`，不白屏。
- 稳态每 30 秒 HEAD `/api/health`，同轮重试 2 次，**连续 3 轮全失败**才切页（≈90s 滞回，2026-09-22 抖动事故后立）；恢复只需单次成功。
- 切页前 emit `desktop-before-close` 通知前端存草稿（G-379），并记下 `resume_url`；恢复后回到离线前地址，而非一律回首页。
- 探活与 WebView2 走同一代理路径（系统代理 / env 代理），回环与内网基址直连 bypass；`reqwest::ClientBuilder::build()` 失败只记日志、不判在线/离线、不 panic（BUG-0041）。
- 线上页落到 `chrome-error://` 时自动重导航回前端，避免 IPC 全拒导致的「按钮点了没反应」。

本次并行改造落地（2026-11-12，与 `auto_refresh.rs` / `lib.rs` / `offline/index.html` / 新增的 Windows-only `webview2_runtime.rs` 一致）：

- **探活结果分级**：`auto_refresh.rs` 新增 `ProbeOutcome { Healthy, Unreachable, ServerError(u16), GateDenied }`。`probe_health` 不再把非 2xx / 出口门拒绝折叠成 `false`；`probe_health_with_retry` 用单一纯函数 `merge_probe_outcomes` 合并失败档，优先级 `ServerError > GateDenied > Unreachable`。`should_go_offline` / `should_recover` 的签名与滞回语义**不变**（连续 3 轮失败才切、单次成功即恢复、每 30s）。通知文案与窗口标题按档分级，服务端 5xx 不再被报成「网络连接不可用」。
- 离线页分级信息**不是**通过改导航 URL 传的：导航点仍是 6 个、`OFFLINE_URL` 不变（守住 `lib.rs` 的 `assert_eq!(nav_sites, 6)` 与守门 G8/G9）；改由 `auto_refresh.rs` 的进程内探针状态 + `render_offline_page()` 对 HTML 四个占位符 `{{OFFLINE_HEADING}}` / `{{OFFLINE_REASON_LABEL}}` / `{{OFFLINE_DETAIL}}` / `{{OFFLINE_RETRY_NOTE}}` 做替换，`lib.rs` 的 offline 协议 handler 直接返回渲染结果。四个占位符必须全部替换，Rust 单测 `render_offline_page_has_no_unreplaced_marker` 钉住「渲染后不得残留 `{{`」。
- **立即重新检测**：离线页新增 `<a href="/retry">`，`lib.rs` 协议 handler 对 `/retry` 调用 `request_immediate_probe()` 并 302 回离线页（`?retry=1`），常驻循环把本轮 30s 等待置 0 立即探活；`RETRY_ACK` 让页面给一句一次性回执（再刷新回默认提示），避免用户点了没反馈。恢复仍由既有恢复分支导航（不新增导航点、不直接 302 到线上前端 —— 否则未恢复会卡在 `chrome-error://`）。离线页保持纯 HTML/CSS 无脚本，CSP 不变。
- **WebView2 Runtime 最低版本门槛**：新增 `webview2_runtime.rs`（仅 Windows 编译），启动期用 `GetAvailableCoreWebView2BrowserVersionString` + `CompareBrowserVersions` 读版本，与 `MIN_WEBVIEW2_RUNTIME`（`114.0.1823.32`，出处 `embedded_browser.rs:496` 的内存档位 API 最低版本注释）比较；`Ok` 记 info、`BelowMinimum` 记 warn 并提示用户、`Unknown` 明确写「未能判定」（不判绿也不冒红）。

现存边界（2026-11-12 核准，勿再按旧 `longDescription` 理解为「无本地降级」）：离线页仍是纯 HTML/CSS 无脚本（CSP `script-src 'self'`），分级文案由 Rust 侧占位符替换后一次性返回，页面自身不带脚本；壳侧离线能力仍限于「分级提示 + 手动重新检测 + 自动恢复」，不含任何本地业务前端。此前三条边界已在本次改造中修复并**不再是现状**：探活非 2xx / 出口门拒绝不再一律折叠成 `false`（服务端维护 / 部署中不再被误报成断网）、离线页已有手动立即重试入口、系统 WebView2 Runtime 已有最低版本门槛检查。

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

## 三平台构建与 cfg 隔离

**结论（2026-11-12 源码只读核实）：三平台 CI 与 cfg 隔离均成立，上一轮『跨平台名不副实』是误判。** `bundle.targets` 列 dmg/deb/rpm/appimage 不是名不副实：CI 真的在 macOS / Linux runner 上原生构建并分平台上传，Rust 侧的 Windows-only 依赖也真的被 cfg 隔离，非 Windows target 不会引用不存在的 crate / API。**不要改 `bundle.targets`。**

### cfg 隔离证据（源码只读核实，无泄漏）

- `Cargo.toml:67-92`：`webview2-com` / `windows-core` / `winapi` / `windows-sys` / `winreg` / `windows` 全部在 `[target.'cfg(windows)'.dependencies]` 下，非 Windows target 不解析这些依赖。
- `window_chrome.rs:51-105`：文件顶层每一条 `use windows::...` 都逐一带 `#[cfg(target_os = "windows")]`，并成对提供 `#[cfg(not(target_os = "windows"))]` stub（如 610 / 756 / 761 / 764 / 1456）。
- `embedded_browser.rs:500-535`、`:555-598`：`ICoreWebView2_19` / `webview2_com` / `windows_core` 的导入与 COM 调用全在 `#[cfg(windows)] { ... }` 块内（501、556 行），`set_memory_low` / `set_suspend` 各有 `#[cfg(not(windows))]` stub（531、594 行）；496 行「Runtime ≥ 114.0.1823.32」注释即 `MIN_WEBVIEW2_RUNTIME` 出处。
- `checkin_capture.rs`：DPAPI（`426` `#[cfg(windows)]` fn + `411` / `419` 成对）、ToolHelp 强杀（`1633` / `1704` 成对）、`regutil`（`1862` mod + `2015` 非 Windows 分支）、注册表指纹（`2761` / `2783` 等 + 对应非 Windows 分支）等，`windows::` 引用全在 `#[cfg(windows)]` 函数 / 模块内。`2707-2709` 注释明确记着「本函数未按平台拆分，故这行必须自带 cfg 门，否则 Linux/macOS 编译单元里找不到它(E0425)；2026-10-10 真教训：本地 Windows cargo test 全绿，CI 三平台才炸」。
- `lib.rs`：`get_system_locale`（`339` / `365` 成对）、`spawn_relay_switch`（`912` / `969` 成对）、`apply_tray_promotion`（`1109` cfg 函数内 winreg）、`active_window_impl`（`1458` / `1540` 同名 mod 双实现）、AppUserModelID（`3761` `#[cfg(target_os = "windows")]` 块内 windows_sys）—— Win32 API 全部包在 `#[cfg(windows)]` / `#[cfg(target_os = "windows")]` 模块或函数里，**未发现真实泄漏**。

Windows-only 能力在非 Windows target 上的降级形态统一为：`#[cfg(windows)]` 实现 + `#[cfg(not(windows))]` stub（返回「仅支持 Windows」/「非 Windows 平台跳过」/ 空结果 / no-op），因此三平台编译单元都能通过；`mod` 声明本身无条件编译（`lib.rs` 注释亦写明「lib 是全平台编译单元」），平台差异全靠文件内 cfg 收口。

### 为什么 `bundle.targets` 不可收口到 Windows

`tauri.conf.json:59` 的 `targets: ["nsis", "app", "dmg", "deb", "rpm", "appimage"]` 不是装饰，三处外部契约强依赖它：

- `.github/workflows/desktop-build.yml:27-35`：matrix 是 ubuntu / macos / windows 三条 runner，分别原生产出并上传 `deb + AppImage` / `dmg` / `nsis exe`（78-99 行按 `matrix.os` 分平台 upload）。
- `.github/workflows/release-desktop.yml:86` / `:88`：有 `macos-universal` 与 `linux-x64` job，含 Developer ID 签名 + notarytool 公证 + staple（493-596 行），`324` 行 `Verify bundle produced (fail loudly)` 校验产物；收口后 macOS 公证拿不到 `.dmg` / `.app` 会 `exit 1`。
- `scripts/lib/tauri-updater-platforms.mjs:36-40`：`UPDATER_PLATFORM_ORDER` 是 `windows-x86_64` / `linux-x86_64` / `darwin-x86_64` / `darwin-aarch64` 四平台 feed 契约；`docs/RELEASE.md:37` 写「desktop | GitHub Release(6 包)」。

全仓**没有任何 `scripts/check-*.mjs` 断言 `bundle.targets`**，即这一约束没有脚本尺子看着，靠的是 CI 三平台强依赖：一旦收口到 Windows，`desktop-build.yml` 的 ubuntu / macos 两腿与 `release-desktop.yml` 的 macos-universal / linux-x64 会产出 0 包、macOS 公证 `exit 1`、四平台 updater feed 缺键。

## 本地验证

改动 `src-tauri/src/*.rs`、`offline/index.html` 后（离线页由 `render_offline_page()` 在编译期 `include_str!` 编进 exe，必须重新构建才生效），在 `apps/desktop/src-tauri/` 下执行：

```bash
cargo check -p ihui-desktop
cargo test -p ihui-desktop --lib
```

`cargo test` 要链接测试二进制，需 MSVC 环境（`link.exe` 须是 MSVC 链接器，不能是 Git Bash 的 `/usr/bin/link.exe`）；`cargo check` 不链接，可直接在任意 shell 跑。仓库根目录下的提交链验证：

```bash
node scripts/guardian-runner.mjs --staged --timing          # 或走提交钩子
node --test scripts/tests/desktop-thin-shell-wording.test.mjs
node --test scripts/tests/desktop-page-host.test.mjs
node --test scripts/tests/check-desktop-event-wiring.test.mjs
```

新建 `.rs` 文件必须带水印横幅：`node scripts/watermark.mjs inject <file>`，并用 `node scripts/watermark.mjs verify <file>` 复验。

## 操作员专属托盘入口：AI 客户端一键切号

托盘菜单里有一个**默认不显示**的项 `relay_switch`（文案「AI 客户端一键切号」）。它只在**操作员机**上有意义 —— 前提是本机有 IHUI-AI 仓库（含 `scripts/client-oneclick-switch.cmd`）、Node 22 + `tsx`、以及 relay 号池库与 `apps/api/.env`。普通用户机上这些一个都没有，所以它**不进默认菜单**（`desktop_prefs::default_tray_menu_items` 显式排除，默认仍是历史那 7 项）。

启用方式：在 `<app_config_dir>/desktop-behavior.json` 的 `tray_menu_items` 里追加 `"relay_switch"`（Windows 上是 `%APPDATA%\com.ihui.desktop\desktop-behavior.json`）：

```json
{
  "tray_menu_items": [
    "new_chat",
    "show",
    "hide",
    "theme",
    "settings",
    "update",
    "quit",
    "relay_switch"
  ]
}
```

改完重启桌面端即生效。数组顺序就是菜单顺序（想让它排在「退出」之前，自己调即可）。

点击后的行为：Rust 主进程直接拉起一个**独立控制台窗口**跑 `client-oneclick-switch.cmd`（交互式选号）；找不到仓库时弹原生提示说明原因（含是哪条路径没命中），不静默失败。

仓库根定位顺序（每一档都验 `scripts/client-oneclick-switch.cmd` 真的在，不靠目录名猜）：`IHUI_AI_REPO` 环境变量 → 从当前 exe 逐级上溯 6 层（覆盖 `target/debug` → `src-tauri` → `apps/desktop` → 仓库）→ `%USERPROFILE%\IHUI-AI` 与 `G:\IHUI-AI`。

**为什么不做成设置页按钮**：主窗口/admin 窗口都加载远程 `https://aizhs.top`，`capabilities/default.json` 的 BUG-17 加固（2026-11-06）已把 "spawn 子进程" 一族移出 remote 授权面，理由写明是"线上页（含任意 XSS）可直调"。在 Rust 里 spawn 一个能跑仓内脚本的进程属 RCE 级能力，挂到远程页按钮上等于把那轮 P0 加固反向推翻。托盘点击是**本机用户的直接操作**、由 Rust 主进程自己处理、不经过 webview，因此不构成新的远程攻击面。

**仓内调用与三层归一**：交互逻辑只有 `scripts/client-oneclick-switch.mjs` 一份，三个入口全部指向它，没有第二份实现：

- 仓内（推荐，须真终端；stdin 非 TTY 会 `exit 2` 拒绝静默切号）：`pnpm switch:oneclick`，即 `node scripts/client-oneclick-switch.mjs`；
- 桌面双击：`scripts/client-oneclick-switch.cmd` → 桌面「AI 客户端一键切号.lnk」；
- 桌面端托盘 `relay_switch`（操作员机在 `desktop-behavior.json` 显式开启）拉起的也是同一个 `.cmd`。

桌面 `.lnk` 非必需：约 850 字节的指针、不进版本库，删了或换机都不影响功能，重建跑 `pwsh -NoProfile -File scripts/install-relay-shortcut.ps1`。非交互的程序化切号走 `node scripts/switch-client-account.mjs --to <uid> --provider <code>`。

首屏「Trae / WorkBuddy / 商汤小浣熊(raccoon) / Loomy / Qoder 前五 + 其余按 `providerCode` 字母序沉底」只是本交互层的展示排序，不裁行、不改名、不动入参；号池只读出口 `apps/api/scripts/relay-pool-account-list.ts --counts` 的 `orderBy(providerCode)` 是 admin / CLI / 同步腿共用的机读稳定序，刻意不动。

## 重要提示

- **要修改对话 UI（消息渲染、工具卡、审批、Plan/Terminal 等），请在 `apps/web` 进行**，不要在 `apps/desktop` 内另起炉灶。桌面端只是线上 web 站点的壳，改 `apps/web` 后**部署上线**即对 web 端与桌面端同时生效（无需重发桌面包）。
- 桌面端**没有** `apps/desktop/src` 前端目录。平台特有部分全在 `src-tauri/` 下：`src/`（Rust：窗口控制、深链、`auto_refresh` 断网热刷新）、`shell/`（`frontendDist` 占位页）、`offline/`（离线提示页）、`windows/`（NSIS 安装器模板与自定义向导 UI）。纯前端 UI 一律归 `apps/web`。
- 构建与安装包（NSIS）细节、发版与更新 feed、签名密钥，见 `src-tauri/README.md`。
