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

## 5. 真实 Chrome / Edge 原生消息（Native Messaging）

- 扩展构建：`pnpm --filter @ihui/extension build` → `apps/extension/.output/chrome-mv3`
- 首次构建 manifest **缺 `nativeMessaging` 权限**，`chrome.runtime.connectNative` 在扩展侧直接不可用；在 `apps/extension/wxt.config.ts` 的 `permissions` 增加该权限后重建，manifest 已含
- Chrome 153.0.8010.37 实测**忽略命令行 `--load-extension`**：新 profile + `--disable-extensions-except` 后 Secure Preferences 只有内置扩展；加 `--disable-features=DisableLoadExtensionCommandLineSwitch` 仍无效
- 改用 Edge 145.0.3800.97（Chromium，同一 `nativeMessaging` 协议）加载未打包扩展，实际扩展 ID `jmcmcameocdcmnciinieiadionkhakfe`
- 安装器真实 apply：`node scripts/install-extension-native-host.mjs --browser edge --extension-id ... --host-exe C:\IHUI-Build\target\debug\ihui_native_host.exe --apply`；manifest 写入 `allowed_origins: ["chrome-extension://jmcmcameocdcmnciinieiadionkhakfe/"]`；`HKCU\Software\Microsoft\Edge\NativeMessagingHosts\ai.ihui.bridge` 已查到绝对 manifest 路径
- 真实 E2E：Edge 打开 `http://localhost:8802/`，content script 在隔离 world 调 `chrome.runtime.sendMessage({type:'nativeHost.request',payload:{op:'ping'}})`；回包
  `{"ok":true,"data":{"ok":true,"op":"ping","pid":26988,"requestId":"nh-1-4oj3p9","version":"0.1.0"},"requestId":"e2e-content-1"}`
  该链路为真实扩展 → background → `connectNative('ai.ihui.bridge')` → Rust host（4 字节小端长度头 + JSON）
- 安装器修复的真实缺陷：原 `spawnSync('reg.exe')` 依赖调用方 PATH，PATH 缺 `System32` 时直接失败；改为 `resolveRegExe()` 取 `SystemRoot/System32/reg.exe` 绝对路径，并新增 `--browser chrome|edge`
- 边界：Chrome 本体 153 只能走 UI“加载已解压扩展”或商店/策略安装；命令行路径已被上游移除，未用 Chrome 本体完成 E2E。Edge 145 是 Chromium 同协议替代，不是 mock

## 6. 完整 WebRTC（浏览器双端 SDP/ICE/DTLS/SRTP）

- 信令：`apps/cli/src/rtc/signaling.ts`；CLI `ihui rtc signal --host 127.0.0.1 --port 8890` 真实监听
- 浏览器夹具：`apps/cli/tests/fixtures/rtc-e2e.html`；静态服务 `http://localhost:8804`
- Edge 145 带 `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` 打开两个独立页面；信令 `ws://127.0.0.1:8890/signal`
- 实测（2026-11-23 最新一轮）：
  - 两端 `connectionState=connected`、`iceConnectionState=connected`
  - offerer `dataChannelEcho=true`；answerer `dataChannelEcho=true`
  - answerer `remoteTracks` 含 `audio` 与 `video`
  - `audioInboundBytes=7897`、`videoInboundBytes=72564`
  - 信令统计 `offers=1, answers=1, iceCandidates=6, rejected=0`
- 该轮同时抓到并修复夹具的真实竞态：单机 fake device 下 `getUserMedia` 可能比 WebSocket 握手慢，原代码先建 WS 后装 `onmessage` 会错过服务端的 `ready`，表现为 `connectionState=new`；把 WS 建连移到媒体/轨道准备之后、且在双方就绪前不丢事件后，双端稳定通过
- 边界：这是 loopback/LAN 的浏览器 SDP/ICE/DTLS/SRTP + datachannel；没有 TURN/STUN 穿透服务，媒体方向为 offerer 发、answerer 收。原 `bridge.ts` 的 WebSocket 二进制中继保留为媒体中继/降级通道

## 7. 更新 apply 到优雅重启

- 安装面：`apps/cli/src/update-installer.ts` 的 `planNpmInstall` 只接受严格三段版本，且最新版必须高于当前版；`installNpmPlan` 以参数数组真实 spawn `npm install -g ihui-cli@<version>`（Windows `shell:true`，64KB 输出截断、120s 超时、exit 0 才算 installed）
- 交接：`handoffFromInstall` 成功 → `UpdateHandoffPlan { disposition:'apply', action:'apply', reason:'install-verified' }`；失败 → `refused/stay/install-failed`
- 编排：`apps/cli/src/commands/update.ts` 的 `update apply` → `applyUpdateAndRestart` → `RestartCoordinator.requestAfterUpdate` + `begin(0)`；新进程 argv 只保留 CLI 入口
- 真实命令：
  - `ihui update check` → `current=1.0.0 latest=1.0.0 updateStatus=current`（registry 当前无更高版本）
  - `ihui update apply --target-version 1.0.1 --dry-run` → 计划 `npm.cmd install -g ihui-cli@1.0.1`
  - `IHUI_NPM_CLI=C:\IHUI-Build\fake-npm.cmd ihui update apply --target-version 1.0.1 --yes --no-restart` → 真实 spawn，fake npm 收到 `install -g ihui-cli@1.0.1`，命令输出 `install=install/installed handoff=apply/install-verified restart=none`，exit 0
- 边界：registry 没有 1.0.1 真实包，未对真实全局包执行升级；安装成功→重启的协调器与“真 spawn + 新进程 exit 0”由 `apps/cli/tests/update-apply.test.ts` 5 例覆盖

## 8. 测试与门

- `cargo test --test native_module_real --test ipc_channel_real` → 12 passed
- `.venv\Scripts\python.exe -m pytest tests/test_request_metadata_pg.py -q` → 1 passed
- `pnpm --filter ihui-cli typecheck` → 0 错
- `pnpm --filter ihui-cli exec vitest run tests/rtc-signaling.test.ts tests/update-apply.test.ts` → 10 passed
- `node --test scripts/tests/install-extension-native-host.test.mjs` → 4 passed
- 水印 verify：17/17 touched source files 完整
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
