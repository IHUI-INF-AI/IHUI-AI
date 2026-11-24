<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 本机五程序 deep 取证补完：Codex / Trae / WorkBuddy / Qoder / ZCode（2026-11-24）

> 本轮是对“此前只做了一个 Cursor 程序”的范围纠正：用户点名的本机 **codex、trae、workbuddy、qoder、zcode** 五个目标全部完成 deep 静态取证。
> 取证方式：本机实测安装定位 + Craft Anything 0.5.0 `--deep` 静态分析；不运行目标程序本体，不写入目标目录，不读取或记录口令、Cookie、令牌、账号凭据。
> 每条结论均带 `ev_...` 证据号；证据账本落在 `.workbuddy/craft/local-ai-clients.cany`。报告只断言已见字节、模块、函数与导入导出；动态运行行为另列未知。

## 0. 安装定位（本轮现读，不照配置猜测）

| 目标 | 实测定位依据 | 本轮取证根 / 主程序 | 现读版本 |
|---|---|---|---|
| Codex | 运行进程路径 + WindowsApps 包名 | `C:/Users/Administrator/AppData/Local/OpenAI/Codex/bin/31fb36cfc4b38f05/`；`codex.exe`、`codex-command-runner.exe`；沙箱服务在 `C:/Program Files/WindowsApps/OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0/app/resources/` | App 包 `26.1117.4957.0` |
| Trae CN | 卸载注册表 DisplayVersion / InstallLocation | `C:/Trae CN/Trae CN.exe`；JS 根 `C:/Trae CN/resources/app`；原生 helper `resources/app/modules/sandbox/trae-sandbox.exe` | `3.4.20` |
| WorkBuddy | 卸载注册表 + 运行进程 | `C:/workbuddy/WorkBuddy.exe`；`resources/app.asar` + `app.asar.unpacked`；`vendor/sandbox/5.11.4/sandbox-cli.exe` | `5.11.3` |
| Qoder CN | 卸载注册表 DisplayIcon/UninstallString + `.qoder-versions` | `C:/Qoder CN/.qoder-versions/0.5.14/Qoder CN.exe`；`resources/app.asar` + unpacked | `0.5.14` |
| ZCode | 卸载注册表 InstallLocation + PE 版本 | `C:/ZCode/ZCode.exe`；`resources/app.asar` + unpacked | `3.19.1` |

**重要纠正**：Qoder launcher 的 `state.ini` 仍写 `G:\Qoder CN`，但当前会话不存在 G 盘；实际程序在卸载注册表和磁盘上均为 `C:\Qoder CN`。不要再用陈旧 G 路径判断“未安装”。（fnd_1）

## 1. 取证方法与覆盖边界

执行过的 deep 工具族：

- `app-folder-explain`：五个安装目录的技术栈识别；证据 `ev_47763503...`（Codex）、`ev_14dc1038...`（Trae）、`ev_bdd8b7a9...`（WorkBuddy）、`ev_0406cace...`（Qoder）、`ev_aa6cc0ab...`（ZCode）。
- `js-app-map`：四个 Electron 目标的模块、IPC、窗口、native addon、endpoint、storage、路由映射；证据 `ev_ea5d5ae8...`、`ev_a438d216...`、`ev_83e8e386...`、`ev_92a6c94a...`。
- `native-rust-binary-show`、`core-feature-find`、`native-function-study`、`native-library-calls-list`：Codex Rust/crate、权限规则函数、Windows token/job object 导入。
- `native-offered-symbols-list`、`native-strings-find`：Qoder/ZCode 的 keyring、Credential、RTC/CUA 相关原生模块。
- `core-feature-find`：Trae/WorkBuddy/ZCode 原生 helper 的沙箱/运行时特征。

边界（fnd_8）：

- Codex 主程序 407 MB，`core-overview` 在函数发现 50000 处截断（partial）；函数级结论取自 `codex-command-runner.exe`，不把主程序“未发现”写成“没有”。
- Qoder `js-app-map` 静态 IPC 通道为 0，但工具明确报告 8 处运行时计算通道名；已登记未知项 `unk_c1622485b0dc169d`，不得推断“Qoder 没有 IPC”。
- Trae / WorkBuddy / ZCode 的 JS 映射均受 node cap 与 partial coverage 限制；数字是静态可见量，不是全局总量。
- 全程未运行目标程序；运行期协议、真实服务端响应、凭据语义均不在本轮结论内。

## 2. 逐目标结论

### 2.1 Codex：Rust CLI + 权限 profile + Windows 受限进程

- 主程序是 x86_64 PE，204743 字符串、486 导入、函数发现被分析上限截断（`ev_9c096652...`）。
- `codex-command-runner.exe` 有强 Rust 证据：49 个 Cargo crate、49 个本地源码路径、符号 stripped（`ev_53d31e7b...`）。crate 含 `starlark`、`execpolicy` 相关本地路径 `execpolicy/src/parser.rs`、`execpolicy/src/rule.rs`、`execpolicy/src/executable_name.rs`，以及 `protocol/src/permissions.rs`、`windows-sandbox-rs/src/process.rs`、`token.rs`、`utils/pty/src/win/psuedocon.rs`。
- `core-feature-find`：`execpolicy` 命中字符串 `POLICY_BUILTINS_STATICS` 并定位到函数 `sub_140092fc0`（`ev_1b2fb81d...`）；`permissions` 命中 `CanonicalFileSystemPermissions`、`NetworkPermissions`、`SerializedManagedFileSystemPermissions::Restricted` 并定位 7 个函数（`ev_625ff199...`）；`pty` 命中 `spawned ConPTY is missing its process job`、`runner: empty capability SID list`，定位 `sub_14006ee70`（`ev_67d82032...`）。
- 函数级研究：`sub_14006ee70` 281 blocks / 1858 instructions / 191 callees（`ev_bd9a79b7...`）；`sub_1400c5850` 命中“only restricted managed filesystem permissions can be enforced”（`ev_b2f7a4c8...`）；`sub_140092fc0` 为 parser/builtins 相关函数（`ev_42576822...`）。
- 导入表实证：`AdjustTokenPrivileges`、`CreateRestrictedToken`、`GetTokenInformation`、`OpenProcessToken`、`SetTokenInformation`（`ev_50cf2a1b...`）；`CreateProcessAsUserW`、`CreateProcessW`、`TerminateProcess`（`ev_481dacd5...`）；`CreateJobObjectW`、`SetInformationJobObject`、`TerminateJobObject`（`ev_be6a6cbd...`）；`ConvertStringSidToSidW`、`CopySid`、`CreateWellKnownSid`、`IsValidSid`（`ev_0ab16c89...`）。

结论：Codex 的命令安全不是“加个 timeout”，而是 **策略解析 → 权限 profile → 受限 token / job object → ConPTY 启动 → 失败如实报错** 的链。（observed + derived）

### 2.2 Trae：浮动聊天 IPC + 独立 sandbox helper

- Electron/VS Code 系 bundle：343 源模块、71 静态 IPC 通道、20 窗口、289 endpoint、109 route；110 处动态 IPC 通道未计入（`ev_ea5d5ae8...`）。
- 浮动聊天窗口有完整通道族：`icube-floating-chat:assistant-open/dismiss`、`native-mouse-event`、`input-caret`、`quick-create`、`result-open` 等（`ev_ea5d5ae8...`）。
- 原生 `trae-sandbox.exe` 的 `sandbox` 特征命中 117 字符串、27 函数：`is_sbox_supported`、`CreateSandboxFailed`、`SandboxConfig`、`SandboxProcessRule`、`create_sandbox_inherit_stdio`、`recycle audit unavailable`、`Failed to write sandbox trace event`、`TRAE_SANDBOX_CLI_PATH`（`ev_e9b2ba3d...`）。

结论：Trae 把沙箱做成可探测、可审计、可诊断的原生 helper，并把失败显式上报；不是单靠前端开关。（observed）

### 2.3 WorkBuddy：大规模 Electron IPC + session 化 sandbox 路径

- Electron app：4416 源模块、120 静态 IPC 通道（55 paired）、20 窗口、1076 endpoint、95 route，另有 219 处动态 IPC 未计入（`ev_a438d216...`）。
- 明确 IPC 面包括 `software-update:*`、`splash:*`、`menu:executeHostCommand`、`remote-window:*`、`workbuddy:browser-annotation:*`、`workbuddy:browser-tabs:*`、`mcp-app-client-message` / `mcp-app-host-message`（`ev_a438d216...`）。
- preload 暴露 `softwareUpdateAPI`、`splashAPI`、`__wbBrowserAnnotationCapture`、`__wbBrowserTabs`、`__mcpHostTestApi` 等受控桥（`ev_a438d216...`）。
- `sandbox-cli.exe`：`sandbox` 命中 124 字符串、113 函数；出现 `SandboxPaths.session(<id>).*`、`permission_file`、`snapfile_dir`、`center_facade.rs`、`center_address.rs`、`executor/interactive.rs`、`sandbox-cli 已启动, 等待client连接，IPC 地址: `（`ev_7cdf9c60...`）。

结论：WorkBuddy 的 sandbox 工程结构是 session 隔离 + 权限文件 + center/executor 分层，跟 CLI/桌面前端解耦。（observed）

### 2.4 Qoder：Electron + 原生模块，动态 IPC 保持未知

- Electron app：610 源模块、156 route、49 endpoint、10 窗口；静态 IPC 0，但 8 处运行时计算通道名未纳入（`ev_83e8e386...`，`unk_c1622485b0dc169d`）。
- 原生模块含 `keytar.node`、`aoq_node_ext.node`、`node-pty`、`skia.node`、`sharp`（`ev_0406cace...`，`ev_83e8e386...`）。
- `keytar.node` 仅导出 `_register_keytar_`（`ev_9df3841d...`），字符串含 `findCredentials`、`Error generating credential filter`（`ev_264c4e90...`）。
- `aoq_node_ext.node` 导出 `napi_register_module_v1`、`node_api_module_get_api_version_v1`（`ev_8189c824...`），RTC 字面命中为 `api-ms-win-rtcore-ntuser-window-l1-1-0` 与 `.rtc$IAA/.rtc$IZZ/.rtc$TAA/.rtc$TZZ`（`ev_3cea07a6...`）；这只证明有 RTC 相关文本，不足以断言具体通信语义。

结论：Qoder 的凭据与终端能力下沉到 Node 原生模块；动态 IPC 与真实 RTC 行为需要运行期同意后另测。（observed + unknown）

### 2.5 ZCode：大而明确的 preload 权限面 + plugin sandbox

- Electron app：2837 源模块、10 窗口、55 endpoint、7 route、3 静态 IPC 通道；打包 browserify/tsc/vite（`ev_92a6c94a...`）。
- preload 暴露 `zcode` 对象约 149 个成员，覆盖 `executePreinstalledToolsCommand`、`loadMcpFromUserDirectory`/`saveMcpToUserDirectory`、`connectRemote`/`startWebRemoteControl`、`onEmbeddedBrowserPermissionPrompt`/`resolveEmbeddedBrowserPermissionPrompt`、`setEmbeddedBrowserSitePermission`、`showTaskNotification`、`captureWindowScreenshot`、`quitAndInstallUpdate` 等（`ev_92a6c94a...`）。
- 另有 `zcodePluginSandbox`、`cuaPermissionPanel`、`__zcodeEmbeddedBrowserJavaScriptDialog__` 受控桥（`ev_92a6c94a...`）。
- 原生模块含 `@napi-rs/keyring`（导出 `napi_register_module_v1`，`ev_a70d4bcc...`）和 keyring 字符串 `findCredentials`、`deleteCredential`、`No matching credential found`（`ev_eb690f7e...`）；`zcode-runtime-host.exe` 出现 `[windows-runtime-host] %s failed (%lu)` 与 `zcode-runtime-host 1`（`ev_b12cdee1...`）。

结论：ZCode 的能力面极宽，但通过 preload 对象集中暴露，并配套 plugin sandbox / CUA 权限面板 / 站点权限；这值得借鉴“集中面 + 明确权限对象”，不值得照抄成员数量。（observed + inferred）

## 3. 跨目标模式（fnd_7，inferred）

五个目标共同呈现三条工程规律：

1. **渲染层只拿受控 bridge**：Trae 的 `vscode`/floating chat、WorkBuddy 的 `softwareUpdateAPI`/browser tabs、ZCode 的 `zcode`/plugin sandbox，都是把能力收敛到明确命名面。
2. **重型能力下沉原生 helper**：Codex command runner/sandbox service、Trae trae-sandbox、WorkBuddy sandbox-cli、Qoder keytar/aoq、ZCode keyring/runtime-host。
3. **权限不是单一布尔**：能力探测（Trae `is_sbox_supported`）、策略/规则（Codex execpolicy）、session 路径与 permission file（WorkBuddy）、站点/CUA 权限（ZCode）组合成链；失败路径必须显式上报。

## 4. 映射回 IHUI-AI：已落地与待强化

### 4.1 已落地（此前回合已有代码与测试，非本轮虚构）

| 能力 | IHUI-AI 现状 | 关键文件 |
|---|---|---|
| 有界 kill / 不谎报成功 | Python 侧 `SIGTERM` 宽限、`SIGKILL` 后有界 `wait_for`，超时事件带 `killSurvived` | `apps/ai-service/app/services/command_streamer.py`、`tests/test_command_kill_wait_bound.py` |
| CLI 进程树回收与杀前身份复核 | `killProcessTree`、`killProcessTreeVerified`、`judgeKillIdentity`，未判定不杀 | `apps/cli/src/util/kill-tree.ts`、`spawn-isolated.ts`、`apps/api/src/utils/kill-verified.ts` |
| 审批与权限租约 | `danger-gate` 默认 fail-closed、5 mode、限时租约、命令策略三态 | `apps/cli/src/tools/danger-gate.ts`、`permissions.ts`、`permission-lease.ts`、`command-policy/evaluate.ts` |
| CLI 沙箱能力探测 | `detectPlatformCapabilities()` 多后端并如实标注降级 | `apps/cli/src/tools/sandbox/platform/detect.ts` |
| Tauri 通知权限三态 | `allowed/denied/unjudged`，畸形与缺失一律 `unjudged`，发送路径真消费 | `apps/desktop/src-tauri/src/notification_permission.rs`、`apps/web/src/lib/tauri-bridge.ts`、对应单测 |
| 凭据保护 | CLI DPAPI/机器绑定信封、web/desktop vault、移动端 SecureStore；不可用不落明文 | `apps/cli/src/lib/credential-vault.ts`、`main-credential-store.ts`、`apps/web/src/lib/local-vault.ts` |
| 通知跨端状态同步 | 六档 `notification:state`、服务端权威快照、背压跳帧重连对账 | `packages/types/src/user-broadcast.ts`、`apps/web/src/hooks/use-notification-state-sync.ts`、`notification-state-reconcile.ts`、extension/RN 对应文件 |

### 4.2 本轮新增

- 本报告：把五个点名目标全部纳入可复核的 deep 证据账本，纠正“只做了一个 Cursor 程序”的覆盖偏差。
- Craft 账本与交接：`.workbuddy/craft/local-ai-clients.cany`（本地调查数据，不作为生产代码交付）。

### 4.3 下一步强化清单（尚未实现，按优先级）

| 优先级 | 强化项 | 证据来源 | 验收判据 |
|---|---|---|---|
| P0 | 统一 CLI 与 ai-service 的审批决策出口：把 `danger-gate` 三态与 `managed_permissions` 求解结果落到同一 request/decision 记录 | Codex execpolicy + permission profile；fnd_2/fnd_7 | 同一请求在两端得到同一 fail-closed 结论；反向用例证明无应答/未判定绝不默认为允许 |
| P0 | 系统通知权限三态进入设置页：显示 Windows 系统级 `denied/unjudged/allowed`，非 Windows 恒 `unjudged`，`denied` 时明确提示且不伪装保存成功 | ZCode 权限面板、Qoder notification permission 原生件、WorkBuddy 系统设置面；fnd_5/fnd_6 | 设置页真调用 `querySystemNotificationPermission()`；变异锁证明删掉消费方后测试失败 |
| P1 | session 级沙箱路径 + permission file + 审计 trace：把 WorkBuddy/Trae 的分层做法落到 ai-service 执行链 | Trae sandbox helper、WorkBuddy sandbox-cli；fnd_3/fnd_4 | 每次执行有 session 目录、权限文件、启动/失败/退出 trace；文件不存在默认拒绝 |
| P1 | 统一 keyring 适配层：保留现有 vault，不重写；新增 Windows Credential Manager / macOS Keychain / Linux SecretService 的能力探测与默认拒绝降级 | Qoder keytar、ZCode keyring；fnd_5/fnd_6 | 探测失败不落明文；现有 vault 回归全绿；至少一条平台反向用例 |
| P2 | 桌面/移动端 `notification:state` 与 web/extension 同形实时消费，缩小 pull-only 差异 | WorkBuddy/ZCode 集中状态面；4.1 现有链路 | 六档事件 + 重连权威快照在桌面/移动同样生效；背压跳帧后可对账 |

以上清单是**待落地**，本轮不把“写了建议”冒充“已经实现”。

## 5. 可复核命令（摘录）

```bash
craft-anything-cli --project .workbuddy/craft/local-ai-clients.cany --deep app-folder-explain --path "C:/Qoder CN/.qoder-versions/0.5.14" --max-depth 3 --max-entries 800
craft-anything-cli --project .workbuddy/craft/local-ai-clients.cany --deep js-app-map --input-path "C:/ZCode/resources/app.asar" --max-files 12000 --max-total-bytes 268435456 --max-nodes 8000
craft-anything-cli --project .workbuddy/craft/local-ai-clients.cany --deep core-feature-find "C:/Users/Administrator/AppData/Local/OpenAI/Codex/bin/31fb36cfc4b38f05/codex-command-runner.exe" --query permissions
craft-anything-cli --project .workbuddy/craft/local-ai-clients.cany --deep native-library-calls-list --path "C:/Users/Administrator/AppData/Local/OpenAI/Codex/bin/31fb36cfc4b38f05/codex-command-runner.exe" --contains Token
craft-anything-cli --project .workbuddy/craft/local-ai-clients.cany --deep core-feature-find "C:/Trae CN/resources/app/modules/sandbox/trae-sandbox.exe" --query sandbox
craft-anything-cli --project .workbuddy/craft/local-ai-clients.cany --deep core-feature-find "C:/workbuddy/resources/app.asar.unpacked/cli/vendor/sandbox/5.11.4/sandbox-cli.exe" --query sandbox
```

## 6. 收口判定

- 五个点名目标均已取证，且都有独立 evidence id 与 finding；不再是“只做了一个 Cursor 程序”。
- 动态目标运行、凭据语义、平台码细节仍保持诚实未知，不用推断填空。
- 本轮交付到代码库的是证据报告；第 4.3 节的产品强化项仍待按用户优先级继续落地。
