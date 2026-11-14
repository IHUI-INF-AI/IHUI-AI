<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Round 8 · 四程序深度逆向与能力复现交付（2026-11-14）

> 机主 2026-11-14 21:34 `/goal`：用 REA 6.4.0 + craft-anything `--deep` 深度分析本机 Qoder CN / Trae CN / WorkBuddy / DeepSeek Harness，把前后端能力与最底层原生代码的**设计**复现到 IHUI-AI 并至少一轴超越。
> 纪律：AGENTS.md §0.12「逆向—复现—超越」四步；红线 = 不粘专有源码、不破解许可证、不绕过付费、不提取凭据。用户口语「抄袭」在本仓落地为「学习行为与设计 + 用本仓栈写自己的代码 + 测试钉住 + 一轴超越」。

## 0. 结论先行

| 项 | 结果 |
| --- | --- |
| 取证 | 5 席并行，REA 6.4.0 + craft-anything 0.5.0 `--deep`，覆盖 5 个 Electron 程序（含从未被 REA 分析过的 WorkBuddy / DeepSeek Harness / ZCode）；7 份报告约 287 KB 落 `E:/rea-rea-agents-6.4.0/round4-2026-11-14/` |
| 旧成果对账 | 10 份旧 REA 报告 + 2 份差距方案（Top5 五项 + 第二轮十项）逐项现读核对：**绝大多数已落地**，13 条方案锚点与现码漂移 ⇒ 禁止照旧方案施工 |
| 真缺口 | ContextFS `context://`、RevertCheck 独立一致性闸、CKG 关系检索、commandExecution 持久执行、跨文件编辑意图、E3 实时语音、IM 通道编排、run_code vm 级宿主句柄禁令 |
| 本轮复现 | 4 个纯函数判据模块 + 4 份表驱动测试 + 1 份生产接线测试，**113 用例实跑全绿**（含既有回退回归面）；逐项反向变异验证（6 / 2 / 1 / 3 / 5 例转红）；水印 9/9；ruff 全绿 |
| 一轴超越 | 每项有可验证超越轴，见 §4 |
| 防再犯 | 修正 `packages/api-client/src/frame-watermark-producer.ts` 头注漂移；登记 `client.ts` 两处同类漂移（他席在飞件，不代改）；修复接线引入的 9 例回归 |
| 诚实边界 | `revert_check` 以**显式 opt-in** 接入 `AgentCheckpointManager.restore`（既有契约零回归）；其余 3 个模块为新增判据层、未接生产调用链。未接线的一律不宣称「已上线」（§0.9） |

## 1. 方法与当次实测环境（不照记忆写）

| 事实 | 现值 |
| --- | --- |
| REA CLI | `D:/caches/npm/prefix/node_modules/rea-agents/scripts/rea.mjs`（6.4.0 全局包；`.ihui/mcp.json` 注册 `rea` stdio MCP，入口 `scripts/rea-mcp-entry.mjs`） |
| craft-anything CLI | `E:/ct-craft-anything/ca-0.5.0/craft-anything-0.5.0-windows-x64-portable/craft-anything-cli.exe`；`--deep` 为**全局开关**，`doctor` = healthy、38 工具、Ghidra/adb/jadx/frida/gdb/rizin/tshark/ilspy 全 found |
| 原生引擎 | Ghidra 12.1.4 `D:/DevEnv/ghidra_12.1.4`（REA 直跑需显式注入 `GHIDRA_INSTALL_DIR` + `JAVA_HOME`）；IDA / Hopper 未装 |
| 对照程序 | `G:/Qoder CN`（app.asar 200 MB，实读 0.5.6）、`G:/Trae CN`（resources/app 散文件，1.107.1）、`G:/workbuddy`（app.asar 173 MB）、`G:/Apps/DeepSeekHarness`（246 MB exe）、`G:/ZCode`（app.asar 385 MB） |
| 路径纠偏 | 机主给的 `E:/桌面/rea-rea-agents-6.4.0.lnk` 实测不存在；真实资产是 `E:/rea-rea-agents-6.4.0/`（10 份旧报告 + 2 份差距方案 + 3 个证据目录） |

取证命令形态（可复跑）：`rea analyze <path>`、`rea analyze-javascript-application <path> --analysis-timeout-ms 60000 --max-heap-mb 2048`、`rea inspect-binary-layout <path>`、`craft-anything-cli --deep --allow-run triage <path>`、`core-target-open --path <abs>`、`native_pe_resources_list` 等。

## 2. 四产品能力面（观察 / 推断 / 未知三档）

- **WorkBuddy**：asar 内 9364 个 JS 源、41 `.node` / 23 `.dll`。原生层 `job-object.node`（Rust napi-rs 封装 Windows Job Object，kill-on-close 防孤儿进程）、`node-pty` / ConPTY、`koffi` FFI、`im-napi.node` 内含 SQLite 流式消息状态机（`client_op_id` 幂等）。能力覆盖会话流式、工具编排、多 agent、资料库、MCP、文件终端、更新遥测、权限沙箱、自动化十类。
- **DeepSeek Harness**：Electron 44.7.0 + `dsh/` 运行时（21682 文件、约 300 个 `@deepseek-ai/dsh-*` 模块），Cordis 插件框架以 `ctx.*` 服务缝装配，ACP / MCP / Typert / NDJSON-RPC-stdio 多协议并存。八个 harness 特有面：副作用前检查点、replay-safe 多级压缩、per-call 沙箱策略、会话格式 v0→v4 迁移链、PTC 程序化工具调用、subagent 任务 DAG。原生层 `frame-forwarding.node`（D3D11/DXGI 共享纹理、命名管道、N-API threadsafe-fn）、sherpa-onnx 离线 ASR、node-pty。
- **Qoder / Trae 补证**：Qoder asar 身份钉死为 **0.5.6**（旧 8 份报告据 0.4.11 / 0.5.1）；「内嵌 Claude Code 原样包」**证否**（`claude-code` / `@anthropic-ai` 零命中），但「内化 Claude 协议栈 + 品牌剥离」跨版本复现（`permissionMode` ×314、`parent_tool_use_id` ×32、`canUseTool` ×17）。Trae 补出 `sscronet.dll` / `browser-bridge.exe` / sandbox 双架构层。
- **最底层原生层横向**：五家唯一全共性原生件 = `node-pty`（5/5，ConPTY + winpty 双后端）；`rg.exe` 4/5、`sharp` 3/5。强证据：Qoder `fast-update` 的 .NET 信任锚点（`WinVerifyTrust` / `CatalogSha256` / `ManifestSha256` / 固定 signer）、Trae zeromq 走 IOCP/WS2_32、watcher 走 `ReadDirectoryChangesW`、DSH `sherpa-onnx` 含 speaker embedding；10 件中 9 件签名自校验通过。REA `inspect-binary-layout` 实证**仅支持 ELF**（对 Windows PE 判「未判定·工具不支持」），改用 craft-anything `--deep` 成功取 285 MB `ai_agent.dll` 的 918 导出 / 703 导入与 `ai_agent_ipc_*` 边界。

## 3. 关键判定：已落地 vs 真缺口（防止后人重复劳动）

**已落地，不复现**（现读 HEAD 面 + 盘上工作树双面核）：块级增量 Markdown、语义折叠与工具摘要、命名错误码分类、AIGC 落库打标、设备指纹 + 最低版本闸、竞品运行时全量分维导入、**帧水位四维**、admission 准入回执、队列四操作、深链轮次锚点、编译式知识双产物、组合定价、CUE 选择性应用、跨设备委派、Automations 闭环、企业治理面等。

**13 条锚点漂移**（旧方案是修复前快照）：`contract.ts` 无 admission、`apply_frame` 仅测试调用、`dispositionOf`、`time_factor`、会话 URL 空白面、`organization` 实体缺失……逐条与现码不符。**照旧锚点动工必打空。**

**交叉验证一例**：盘点席与矩阵席对「帧水位四维是否落地」结论矛盾。逐把尺子复核后定案——HEAD 面 `apps/ai-service/app/core/sse_frames.py::with_frame_watermark` 已生产调用 `apply_frame` 并注入 `subscriptionId` / `logEpoch` / `fromSeq` / `toSeq`（`PROCESS_LOG_EPOCH` + snapshot `0→1` / delta `n-1→n`），消费侧 `frame-watermark.ts` 三档判据齐全 ⇒ **功能已落地**；矩阵席被 `frame-watermark-producer.ts` 的陈旧头注误导。已修正该头注，`client.ts` 两处同类注释因文件为**他席在飞的 ` M` 件**按并发纪律不代改，在此登记待其持有者收口。

## 4. 本轮复现（写自己的代码，不用对方源码）

| 模块 | 对照能力 | 实现 | 一轴超越 | 测试 |
| --- | --- | --- | --- | --- |
| `apps/ai-service/app/core/revert_check.py` | Trae `RevertCheck` 快照回退一致性闸 | `evaluate_revert_check` 三档 `consistent` / `diverged` / `unjudged`，输出 changed/added/removed 差异清单 | 对照只有「选哪个回退点」；我方把「取不到输入 / 形状不认 / 策略关闭」一律钉成**阻断**而非放行，并输出可审计 verdict + 判据来源 | 19 passed；变异 6 failed |
| `apps/ai-service/app/core/context_fs.py` | Trae ContextFS `context://` 虚拟路径 | `resolve_context_uri` 白名单命名空间 + 穿越 / 编码 / 大小写 / NUL / 符号链接意图全套拒绝 | **解析与鉴权同一把尺子**，单次产出 canonical_path + namespace + verdict + reason；「解析成功但鉴权没跑」的半态强制改判 `unjudged` | 30 passed；变异 2 failed |
| `apps/ai-service/app/core/security_scan_tiers.py` | Qoder L1/L2/L3 分层安全扫描 | `decide_scan_tier` 四态 + `build_finding` 的 `(tier, rule, evidence)` 三元组 | 对照三档默认全 false；我方 L1 默认开、**配置缺键 ⇒ `unjudged` 不放行**、finding 带证据可追溯 | 13 passed；变异 1 failed |
| `apps/ai-service/app/services/computer_use_ledger.py` | Trae / Qoder 桌面操控录制（不透明二进制） | `evaluate_step` / `append_step` 不可变写入，坐标绑定当轮 `screenshot_sha256` | 每步 sha256 + 坐标来源可追溯、可回放审计、写入原子（失败不留半行）；「先用后动」是机器判据而非提示词 | 16 passed；变异 3 failed |

四项均零新增第三方依赖、只用 Python 标准库；判据形状不认一律 `unjudged`（§0.3）；每项都做了**反向变异验证**（把关键判据注释掉后测试必须转红，恢复后复绿）；9 个新建文件 `watermark.mjs verify` = 9/9 完整可解码水印，`ruff check` 全绿。主会话独立复跑（含既有回退回归面）→ **113 passed in 8.63s**。

**生产接线（§0.9）与一次真实回归的修复**：`revert_check` 接进 `apps/ai-service/app/services/agent_checkpoint.py::AgentCheckpointManager.restore`。首版做成无条件前置闸，实跑 `tests/test_checkpoint_rewind.py` **9 例回归**（`KeyError: 'messages'`）——既有路由 `routers/checkpoint_rewind.py` 的 restore / impact 预览端点不携带三面输入直调 `restore`，被 `unjudged` 一律阻断。把一条还没接完的新判据强加给旧契约是回归，不是「多要一次定向说明」，故收窄为**显式 opt-in**：只有调用方在 `checkpoint.metadata` 写入 `revert_check_inputs` 时启用闸（启用后仍严格 fail-closed）；未提供时判据**本轮没跑**、原契约一字不变，日志明确记「未启用」，绝不把「没判」写成「判过」。接线测试 7 例（含 opt-in 残缺输入阻断、未 opt-in 旧契约不变），字节级变异验证禁用闸 ⇒ 5 failed / 2 passed，恢复后字节一致。

## 5. 明确不借

Electron 私有 IPC / 通道混淆与抗逆向设计、遥测上报面、平台绑定二进制与设备指纹 SDK、更新链整包替换、动态热更话术、素材与文案原文、权限提升面、声纹识别（隐私）、营销口径数字当 KPI，以及任何形式的专有源码原样粘贴。

## 6. 未判定项（§0.3，不记绿也不冒红）

1. REA 对 173 MB / 385 MB asar 的全量静态重构**超时**（190 s 仅 73/9364；DSH 300 s 仅解析约 5%）⇒ 记「部分 Evidence」，模块名→能力映射属**推断**。
2. Ghidra 函数级反编译、运行时观测 / CDP、混淆 IPC 通道真值、私有 git 历史、Crashpad 浅层以下 ⇒ 未判定。
3. CKG 关系检索 + 隐私模式、ContextFS 后半段（subagents 独立转录布局）、commandExecution 持久执行、跨文件编辑意图、E3 实时语音、IM 编排、run_code vm 级禁令 ⇒ **真缺口，本轮未复现**。
4. 生产接线状态：`revert_check` 已 opt-in 接入 `restore`，**默认未启用**——全量启用需属主在 `routers/checkpoint_rewind.py` 等调用方补齐 `target_snapshot` / `current_workspace` / `policy` 三面输入；`context_fs` / `security_scan_tiers` / `computer_use_ledger` 三个模块本轮**未接生产调用链**，不宣称「能力已上线」（§0.9）。
5. `tests/test_agent_checkpoint.py::test_agent_loop_run_saves_checkpoint` 在 8 s 超时下卡在 asyncio 等待；该用例走 `AgentLoopV2.run` 的 **save** 路径、不经本轮改动的 `restore`，属既有环境依赖 ⇒ 不判绿也不判红（§0.3）。
5. 各开关默认值与上线态、迁移是否已在库执行、真模型正文流（provider 额度）⇒ 运行态 / 外部配额，不判。

## 7. 复现命令

```bash
# 取证（仓外产物目录）
REA="D:/caches/npm/prefix/node_modules/rea-agents/scripts/rea.mjs"
CA="E:/ct-craft-anything/ca-0.5.0/craft-anything-0.5.0-windows-x64-portable/craft-anything-cli.exe"
GHIDRA_INSTALL_DIR="D:/DevEnv/ghidra_12.1.4" JAVA_HOME="C:/Program Files/Java/jdk-21-temp/jdk-21.0.2+13" \
  node "$REA" analyze-javascript-application "G:/workbuddy/resources/app.asar" --analysis-timeout-ms 60000 --format json
"$CA" --deep --allow-run triage "G:/Apps/DeepSeekHarness" --format md

# 本轮复现自验
cd G:/IHUI-AI/apps/ai-service
.venv/Scripts/python.exe -m pytest tests/test_revert_check.py tests/test_context_fs.py \
  tests/test_security_scan_tiers.py tests/test_computer_use_ledger.py \
  tests/test_revert_check_wiring.py tests/test_checkpoint_rewind.py \
  tests/test_checkpoint_rewind_file_versions.py -n 0 -q
cd G:/IHUI-AI && node scripts/watermark.mjs verify apps/ai-service/app/core/revert_check.py
```

## 8. 取证产物索引（仓外）

`E:/rea-rea-agents-6.4.0/round4-2026-11-14/`：`01-legacy-gap-audit.md`、`02-workbuddy-rea-evidence.md`、`03-dsh-rea-evidence.md`、`04-native-layer-evidence.md`、`05-qoder-trae-supplement-and-matrix.md`、`DSH-CAPABILITIES.md`、`NATIVE-DELTA.md`，以及 `ev-*`、`raw-*`、`_raw/`、`*.cany` 原始 Evidence。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
