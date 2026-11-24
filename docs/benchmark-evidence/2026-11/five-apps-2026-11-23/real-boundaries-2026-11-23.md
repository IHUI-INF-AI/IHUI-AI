<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 真实边界闭环证据（2026-11-23）

本文件记录 2026-11-23 第十一批候选的“真实边界”验证：每条都给出真实进程、真实数据库、真实浏览器或真实 PE 的实测结果，不用 mock 代替。

## 1. Rust 工具链与桌面 crate 编译

- 安装：`rustup-init.exe -y --profile minimal --default-toolchain stable-x86_64-pc-windows-msvc --no-modify-path`
- 版本：`cargo 1.100.0` / `rustc 1.100.0`（`CARGO_HOME=C:\caches\cargo`、`RUSTUP_HOME=C:\caches\rustup`）
- MSVC：Visual Studio BuildTools 2022 `14.44.35207`；Windows SDK `10.0.26100.0`
- `cargo check --lib --bin ihui_native_host` 首次真实报错：`NativeModuleError::MissingExport(&'static str)` 生命周期不满足；改为 `MissingExport(String)` 后通过
- `cargo build --bin ihui_native_host` 真实完成：`Finished dev profile ... in 4m 21s`，产物 `C:\IHUI-Build\target\debug\ihui_native_host.exe`（549376 字节）

## 2. 真实 `BP_*` PE DLL 加载

- 夹具源码：`apps/desktop/src-tauri/tests/fixtures/bp_fixture.c`，导出 `BP_GetInterface` / `BP_Initialize` / `BP_Shutdown` / `BP_GetFixtureState`
- 编译：MSVC `cl /utf-8 /LD`，产物 `bp_fixture.dll`（103424 字节）
- Harness：`apps/desktop/src-tauri/tests/native_module_real.rs`，通过 `#[path]` 直接包含 `native_module_abi.rs`，不依赖 Tauri
- 实测：`cargo test --test native_module_real` **6 例全绿**，含真实 `LoadLibrary` → 接口头校验（magic `0x49554849`、abi 1、header_size）→ `BP_Initialize` → `BP_Shutdown`，`report.reason == "loaded-initialized-shutdown"`
- 边界：这是仓内契约加载器对真实 PE 的验证；厂商真实 `BP_*` DLL 当前机器不存在，未冒充“厂商模块已接入”

## 3. 真实受限命名管道

- Harness：`apps/desktop/src-tauri/tests/ipc_channel_real.rs`，包含 `ipc_channel_acl.rs`
- 真实用户 SID：`S-1-5-21-3924373712-2464060091-3741006702-500`
- 实测：`cargo test --test ipc_channel_real` **6 例全绿**，`creates_restricted_pipe_with_current_user_dacl` 真实创建并关闭管道，`detail == "pipe created and closed"`，SDDL 同时含当前用户 SID 与 `SY`
- 两份 harness 合跑：**12 例全绿**，`Finished test profile ... 0 failed`

## 4. 真实 PostgreSQL 追踪表

- 本机服务：`postgresql-x64-18` 运行中；psql `C:\Program Files\PostgreSQL\18\bin\psql.exe`
- 专用测试库：`ihui_test_metadata`；DSN `postgresql://postgres:postgres@127.0.0.1:5432/ihui_test_metadata`
- 测试：`apps/ai-service/tests/test_request_metadata_pg.py`
- 实测：`.venv\Scripts\python.exe -m pytest tests/test_request_metadata_pg.py -q` → **1 passed in 5.23s**
- 断言：真实建表、写入一行、用同 `request_id` 重复写入、`SELECT count(*) == 1`（`ON CONFLICT` 不重复）、`workspace_languages == ['ts']`、`user_id == 'user-pg-test'`
- 没有 sqlite 回退；`IHUI_TEST_PG_DSN` 未设时测试显式 skip

## 5. 真实 Chrome Native Messaging

- 扩展构建：`pnpm --filter @ihui/extension build` → `apps/extension/.output/chrome-mv3`
- 首次构建 manifest **缺 `nativeMessaging` 权限**，`chrome.runtime.connectNative` 在扩展侧直接不可用；在 `apps/extension/wxt.config.ts` 的 `permissions` 增加该权限后重建，manifest 已含
- Chrome 品牌版 153.0.8010.37 实测**忽略命令行 `--load-extension`**：新 profile + `--disable-extensions-except` 后 Secure Preferences 只有内置扩展；加 `--disable-features=DisableLoadExtensionCommandLineSwitch` 仍无效。这是上游对品牌版的安全策略，不是本仓缺陷。
- 真实 Chrome 验证改走官方 **Chrome for Testing 153.0.8010.37**（`chrome-win64.zip`，同一 Chromium 153 分支、同一 `nativeMessaging` 协议，官方明确保留 `--load-extension`）：`C:\IHUI-Build\chrome-for-testing\chrome-win64\chrome.exe`
- 打包扩展并用固定私钥算出稳定 ID：`chrome --pack-extension=apps\extension\.output\chrome-mv3` → `chrome-mv3.crx` + `chrome-mv3.pem`；由 SPKI SHA-256 前 16 字节算得扩展 ID `lhdljlhhnlgnidpeggpoibdnbihjhkjb`，把公钥写进构建产物 manifest 的 `key`
- 安装器真实 apply：`node scripts/install-extension-native-host.mjs --browser chrome --extension-id lhdljlhhnlgnidpeggpoibdnbihjhkjb --host-exe C:\IHUI-Build\target\debug\ihui_native_host.exe --apply`；manifest `allowed_origins: ["chrome-extension://lhdljlhhnlgnidpeggpoibdnbihjhkjb/"]`，`HKCU\Software\Google\Chrome\NativeMessagingHosts\ai.ihui.bridge` 已查到绝对 manifest 路径
- 真实 E2E：Chrome for Testing 以 `--load-extension=... --remote-debugging-port=9339 http://localhost:8802/` 启动，content script 在隔离 world 调 `chrome.runtime.sendMessage({type:'nativeHost.request',payload:{op:'ping'}})`；回包
  `{"ok":true,"data":{"ok":true,"op":"ping","pid":9744,"requestId":"nh-1-q09l41","version":"0.1.0"},"requestId":"e2e-content-1"}`
  该链路为真实 Chrome 扩展 → background → `connectNative('ai.ihui.bridge')` → Rust host（4 字节小端长度头 + JSON）
- 安装器修复的真实缺陷：原 `spawnSync('reg.exe')` 依赖调用方 PATH，PATH 缺 `System32` 时直接失败；改为 `resolveRegExe()` 取 `SystemRoot/System32/reg.exe` 绝对路径，并新增 `--browser chrome|edge`
- 边界：品牌版 Chrome 153 的命令行加载已被上游移除，仍只能走 UI“加载已解压扩展”或商店/企业策略；本轮完成的是官方 Chrome for Testing 真实进程的完整链路，品牌版的限制未被绕过。

## 6. 完整 WebRTC（SDP/ICE/DTLS/SRTP + STUN + TURN）

- 信令：`apps/cli/src/rtc/signaling.ts`；CLI `ihui rtc signal --host 127.0.0.1 --port 8890` 真实监听；`joined` 下发 `iceServers`，CLI 新增 `--stun` / `--turn` / `--turn-username` / `--turn-credential`
- CLI 参数真实回读：`rtc signal --port 8891 --stun stun:127.0.0.1:3478` 的 `joined` → `{"type":"joined","room":"cli-ice","role":"offerer","iceServers":[{"urls":"stun:127.0.0.1:3478"}]}`；`--port 8892 --turn turn:127.0.0.1:3478?transport=udp --turn-username ihui --turn-credential ihui-secret` 的 `joined` → `{"type":"joined","room":"cli-turn","role":"offerer","iceServers":[{"urls":"turn:127.0.0.1:3478?transport=udp","username":"ihui","credential":"ihui-secret"}]}`
- 浏览器夹具：`apps/cli/tests/fixtures/rtc-e2e.html`；静态服务 `http://127.0.0.1:8804`；`?ice=<JSON>&policy=relay` 可切到 TURN
- 媒体源改为 canvas `captureStream` + WebAudio oscillator（`media=camera` 才走真实摄像头），避开单机 fake device 对第二路/多进程的独占；媒体仍走真实 RTP/DTLS/SRTP
- **STUN 实测**（服务 `stun:127.0.0.1:3478`，Edge 145 双端独立进程）：
  - 两端 `connectionState=connected`、`iceConnectionState=connected`、`dataChannelEcho=true`
  - 两端 `localCandidateTypes` 同时含 `host` 与 `srflx`，`remoteCandidateTypes` 同时含 `host` 与 `srflx`
  - answerer `audioInboundBytes=12622`、`videoInboundBytes=3663`，`remoteTracks` 含 audio/video
- **TURN relay 实测**（服务 `turn:127.0.0.1:3478?transport=udp`，`iceTransportPolicy='relay'`，独立 TURN 服务进程）：
  - 两端 `connectionState=connected`、`iceConnectionState=connected`、`dataChannelEcho=true`
  - 两端 `localCandidateTypes=["relay"]`、`remoteCandidateTypes=["relay"]`（强制只走中继，未回落 host）
  - answerer `audioInboundBytes=20025`、`videoInboundBytes=8215`，`remoteTracks` 含 audio/video
- TURN/STUN 服务使用独立安装的 `turn-server@0.10.0` 测试进程（`C:\IHUI-Build\turn-test`，未写入仓库依赖），监听 UDP 3478；仅测试期为 loopback 打开 `allowLoopback`/`allowPrivatePeers`
- 修复的真实竞态：原夹具先建 WebSocket 再等媒体，服务端在双方齐备时一次性下发 `ready`，offerer 可能错过；现改为媒体/轨道准备完成后再建 WS。`turn-server` 默认拒绝 loopback peer，测试期显式开放后 TURN 才可用
- 边界：本轮验证的是真实 STUN Binding 与 TURN Allocate/Permission/ChannelData 全链路；生产公网 TURN 仍需要独立服务器与临时凭据，仓库不内置第三方 TURN 服务

## 7. 更新 apply 到优雅重启（真实 npm 包）

- 安装面：`apps/cli/src/update-installer.ts` 的 `planNpmInstall` 只接受严格三段版本，且最新版必须高于当前版；`installNpmPlan` 以参数数组真实 spawn `npm install -g ihui-cli@<version>`（Windows `shell:true`，64KB 输出截断、120s 超时、exit 0 才算 installed）
- 交接：`handoffFromInstall` 成功 → `UpdateHandoffPlan { disposition:'apply', action:'apply', reason:'install-verified' }`；失败 → `refused/stay/install-failed`
- 编排：`apps/cli/src/commands/update.ts` 的 `update apply` → `applyUpdateAndRestart` → `RestartCoordinator.requestAfterUpdate` + `begin(0)`；新进程 argv 只保留 CLI 入口
- 真实包：以 `1.0.1` 至 `1.0.6` 六个版本真实构建并 `npm pack`，tarball 约 2.52MB；本地 registry `http://127.0.0.1:4874` 提供真实 metadata 与 tarball；安装到隔离前缀 `C:\IHUI-Build\npm-prefix`，不污染用户全局包
- 真实安装：`ihui update apply --target-version 1.0.2 --yes --no-restart`（未设 `IHUI_NPM_CLI`，走官方 npm 绝对路径）→ `install=install/installed handoff=apply/install-verified restart=none`，exit 0；`ihui.cmd --version` 输出 `1.0.2`
- 真实重启：从已安装的 1.0.1 执行 `ihui update apply --target-version 1.0.2 --yes`（无 `--no-restart`）→ 旧进程 exit 0，新进程真实启动：
  `{"pid":20128,"fromPid":"3116","attempt":"1","reason":"update-applied","argv":["...\node.exe","C:\\IHUI-Build\\npm-prefix\\node_modules\\ihui-cli\\dist\\index.js"],"version":"1.0.2"}`
- 修复后自更新复验：从已安装 1.0.5 执行 `update apply --target-version 1.0.6 --yes`（未设 `IHUI_NPM_CLI`）→ 旧进程 exit 0，**退出前打印** `install=install/installed handoff=apply/install-verified restart=spawned`；新进程 `pid=18684`、`version=1.0.6`、`reason=update-applied`；安装目录版本 1.0.6
- 本轮抓到的真实缺陷（三处，均已修复并有回归）：
  1. `npmCommand()` 原样返回 `npm.cmd` 依赖 PATH，本机 PATH 先命中缺 `make-fetch-happen` 的沙箱 npm，`npm install` 直接 exit 非零；改为优先 `ProgramFiles\nodejs\npm.cmd` 绝对路径，候选全缺才回落 PATH。
  2. 绝对 npm 路径含空格，`shell:true` 下未加引号会被拆成 `C:\Program`；改为 shell 引用后再 spawn。
  3. 重启成功时 `process.exit(0)` 发生在结果打印之前，用户看不到任何安装/交接结果；给 `RestartDeps` 增加 `beforeExit`（先于 exit、失败不阻断重启），`update apply` 在退出前打印最终行，单测断言顺序为 `beforeExit → exit`。
- 边界一：使用修复前二进制（如已安装的 1.0.2）自更新时，运行的旧代码仍会命中沙箱 npm；修复只对 1.0.3 及以后构建生效，存量安装需要一次手工 bootstrap 安装。本轮已用 1.0.5→1.0.6 验证修复后的完整自更新。
- 边界二：本轮更高版本包是本地 registry 的真实 npm tarball，不是公共 npm registry；公共 registry 目前仍只有 `1.0.0`，因此未发布/未升级公共全局包。

## 8. 测试与门

- `cargo test --test native_module_real --test ipc_channel_real` → 12 passed
- `.venv\Scripts\python.exe -m pytest tests/test_request_metadata_pg.py -q`（带 `IHUI_TEST_PG_DSN` 专用库）→ 1 passed
- `pnpm --filter ihui-cli typecheck` → 0 错
- `pnpm --filter ihui-cli exec vitest run tests/rtc-signaling.test.ts tests/update-apply.test.ts` → **12 passed**（RTC 6 + update 6）
- `pnpm --filter ihui-cli test`（PATH 补 `System32` 与 Git 的 bin/usr/bin）→ 611/620 文件通过、7950/7963 用例通过；8 个失败文件为 `clipboard` / `compaction-reclaim-first` / `context-guards-wiring` / `danger-gate-wiring` / `f-012-non-tty-default-path` / `g-814408-event-stream-single-writer` / `kill-tree-verified` / `plugins-git-caps`，均在本轮改动文件之外，未冒充全绿
- `rtc signal --stun` 的 `joined` 回读 → `iceServers:[{"urls":"stun:127.0.0.1:3478"}]`；`--turn`（含用户名/凭据）→ `iceServers:[{"urls":"turn:127.0.0.1:3478?transport=udp","username":"ihui","credential":"ihui-secret"}]`
- Chrome for Testing 原生消息 E2E → 回包 `pid=9744` / `requestId=nh-1-q09l41`
- STUN 双端 → `localCandidateTypes=[host,srflx]`，audio `12622`、video `3663`
- TURN relay 双端 → `localCandidateTypes=[relay]`，audio `20025`、video `8215`
- 真实 npm 安装 → `1.0.2` 安装成功；真实重启 → 新进程 `pid=20128`、`version=1.0.2`；修复后自更新 1.0.5→1.0.6 → 退出前打印最终行、新进程 `pid=18684`、`version=1.0.6`
- `node --test scripts/tests/install-extension-native-host.test.mjs` → 4 passed
- 水印 verify：本轮改动文件全部完整
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
