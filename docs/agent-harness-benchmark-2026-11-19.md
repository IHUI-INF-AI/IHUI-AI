<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 本机 AI 编程客户端逆向取证与 IHUI-AI 能力对齐（2026-11-19）

> 目标 `G-20261119-rea-harvest`。按 AGENTS §0.12 四步执行：定位对照 → 取证带 Evidence → 本仓自有实现复现 → 至少一轴超越。
> 红线：不直抄专有源码、不破许可证、不绕过付费、不提取凭据。本文所有数字为取证时刻现读，复核命令逐条给出。

## 1. 结论摘要

1. IHUI-AI 在 agent harness 的**绝大多数**能力上与四款对照程序已经同代（压缩、沙箱、审批、doom-loop、子代理、MCP、检查点），不存在"整体落后、需要大规模抄"的情况。可抄即抄只会制造重复实现（违反 §0.6 单一真相源）。
2. 真正找到并已落地 **80 项**缺口（代码 + 测试 + 验证全绿，见 §5），集中在工具层、上下文预算与执行面：
   - **确定性工具结果裁剪器「有测试、零生产调用方」**，且默认预算是猜的 → 改为证据值并接进唯一消息出口，同时比对照多保留尾部。
   - **`write_file` 工具可盲写覆盖未读文件** → 加读前写保护（对照 `dsh-fs-observation-policy`），不改底层写盘原语。
   - **`edit_file` 根本没有**（只有 save 语义）→ 唯一匹配替换 + `replaceAll` / 原子 `edits[]` / `dryRun`，并修掉 Windows 上 CRLF 与 BOM 两类必失败场景。
   - **子代理没有常驻文件租约** → `resident_file` 独占租约 + 定界注入。
   - **`read_file` / `list_dir` 无预算**、**模型没有检索能力**（`grep`/`glob` 只有 HTTP 端点没注册成工具）→ 同族预算 + 总量自述 + 续查指引，并顺手修掉 `**/` 零层语义塌陷。
   - **递归分解（RLM）没有** → 不新造执行器/聚合器，把"分片 → 并行 → 聚合 → 超预算再切"并入既有 `TeamOrchestrator.run_recursive`；节点预算直接消费子代理并发闸那个数（单一真相源）。
3. 原生层（deepseek-tui）在本机**无法做反编译**：Ghidra 未安装、IDA/Hopper 未安装、REA 的 `inspect-binary-layout` 仅支持 Linux x64。原生结论全部来自二进制可打印字符串（22,471 条去重），是"观察"，不是"反编译推断"。
4. Trae CN 的本地扩展面很薄（`apply_patch`/`edit_file`/`subagent` 命中 0），其 agent 能力在云端；**本地可借鉴物极少**，这一点如实记录，不用"已分析"冒充"有产出"。

## 2. 取证方法与工具（复核用）

| 项 | 实际使用 | 状态 |
| --- | --- | --- |
| REA 6.4.0 | `D:\DevEnv\tools\npm-global\node_modules\rea-agents\scripts\rea.mjs`，`--deep` | 可用 |
| craft-anything 0.6.1 | `D:\DevEnv\craft-anything\0.6.1\craft-anything-cli.exe`，`--deep` | 可用 |
| REA 二进制布局 | `inspect-binary-layout` 对 Windows PE 返回 `capability_unavailable`（仅 Linux x64） | 不可用 |
| Ghidra 12.1.4 | `D:\DevEnv\ghidra_12.1.4`（`ghidra_12.1.4_PUBLIC_20260921.zip`，sha256 `ddac49f9…d4db` 与发布说明逐字一致）+ JDK 21 Temurin `D:\DevEnv\jdk-21.0.13+9`；`rea doctor` 的 ghidra / ghidra-platform / ghidra-headless / ghidra-java 全 healthy | 可用（2026-11-20 补装） |
| IDA / Hopper | 未安装 | 不可用 |
| 自写 ASAR 只读解析器 | `D:\IHUI-AI\.ihui-agent\tmp\recon\asar-tool.mjs`（list/extract） | 可用 |
| 字符串提取 | node 遍历可打印 ASCII 段并去重 | 可用 |

> 用户给出的 `E:\桌面\rea-rea-agents-6.4.0.lnk` 在本机不可达（E 盘无挂载），故取证一律走 `D:\DevEnv\tools\npm-global` 的 REA 6.4.0。`.ihui/mcp.json` 里失效的 `E:\ct-craft-anything\...0.5.0` 已于 2026-11-20 改为本机实际件 `D:\DevEnv\craft-anything\0.6.1\craft-anything-cli.exe`（`doctor` = healthy、MCP self-test 30 tools），`JAVA_HOME` 同步指向 `D:\DevEnv\jdk-21.0.13+9`；属环境事实差异，非"没跑"。

## 3. 四款对照程序画像

### 3.1 Qoder CN 0.5.13（Electron）

- 产物：`D:\IHUI-AI\.ihui-agent\tmp\recon\qoder-graph.json`（REA 应用图谱，JSONL，末行含 `graph`）。
- 实测：`graph.nodes` **13,638**、`graph.edges` **14,797**；节点类型 `asar-entry 3592`、`javascript-asset 2564`、`unknown 6569`、`endpoint 248`、`package 181`、`native-addon 9`。
- 进程面（summary 现读）：`browser_windows 5`、`context_bridge_apis 7`、`exposed_api_members 22`、IPC `operations 6`（`main_handlers 4` / `renderer_transmissions 1` / `renderer_listeners 1` / `dynamic_channel_operations 6`）、`sender_validation_observations 16`、`utility_processes 1`、`explicit_web_preferences 30`、`native_addon_bindings 0`。
- 可借鉴点：IPC sender 校验（16 处观察）、utility process 隔离。**但 IHUI 桌面是 Tauri（Rust），不是 Electron**，Electron 专属形态不构成对本仓的缺口，不移植。

### 3.2 Trae CN 3.4.20（VS Code 系）

- AI 相关扩展：`resources/app/extensions/ai-completion/dist/extension.js`（3.79MB）、`byted-solo.builtin-mcp`、`byted-icube.trae-tob-git-ai-vscode`、`git-ai.git-ai-vscode`。
- 主包关键词命中（现读）：`agent 193`、`context 827`、`mcp 11`、`compact 19`、`todo 32`、`terminal 53`；`subagent 0`、`apply_patch 0`、`edit_file 0`。
- 结论：本地扩展是补全 + 规则 + 终端上下文，**agent 编排在云端**。本地无可抄的 agent 内核，只有"补全上下文构造"一类局部实现，价值低，不列入落地候选。

### 3.3 WorkBuddyAI 5.11.4（Electron）

- `app.asar` 164.7MB；`main/*.js` 未打包模块 11,587 个；已抽取四件到 `.ihui-agent\tmp\recon\wb\`。
- `main__app-server-mcp-apps-host.js`（84KB）：MCP apps 宿主，含 `McpAppToolResultArtifactManager`（工具结果落工件 + `pruneOldArtifacts` 老化）、`/sandbox-preview/` 挂载与 404 `Mount Expired`。
- `main__sandbox-proxy.js`（9KB）：sandbox proxy HTML + `ui/notifications/sandbox-proxy-ready` / `sandbox-resource-ready` / `size-changed` 协议。
- `main__acp.js`（86KB）：ACP（Agent Client Protocol）传输 schema（`http` / `sse` / `acp` 三型）。
- `main__proxy-agents.js`（420KB）：代理/编排主件，含 checkpoint 相关实现（`checkpoint 5`）。
- 可借鉴点：**MCP apps 宿主 + 工件老化**、**ACP 传输协议**。属于前端/宿主层，落地成本高，本次不做（列入 §6 候选）。

### 3.4 deepseek-tui（原生 Rust TUI/CLI）

- 二进制：`C:\Users\Administrator\AppData\Local\deepseek-tui\deepseek-tui-windows-x64.exe`（36MB）；去重字符串 **22,471** 条。
- 直接读到的能力面（原文关键字）：
  - `struct Config with 37 elements`：`tools_files`、`skills_dir`、`mcp_config_path`、`memory_path`、`notes_path`、`strict_tool_mode`、`allow_shell`、`approval_policy`、`sandbox_mode`、`sandbox_backend`、`sandbox_url`、`sandbox_api_key`、`max_subagents`、`hooks`、`snapshots`、`lsp`、`context`、`subagents`、`runtime_api`、`workshop` 等。
  - `struct CapacityConfig with 15 elements`：`l1_threshold/l2_threshold/l3_threshold/cycle_threshold`（三级阈值 + 周期重启）、`auto_compact`、`verbatim_window_turns`、风险分级 `slow_risk_max/medium_risk_max/severe_min_slack` 等。
  - 源码路径泄露 `crates\tui\src\compaction.rs` ⇒ 压缩实现位。
  - 斜杠命令原文：前缀缓存命中统计、上下文检查器、会话成本明细、cycle handoff 列表、`BM25 over message text` 历史归档检索、RLM turn、子代理四方阵 `sequential | mixture | distill | deliberate`、`/trust add`、YOLO 模式、快照回滚、`/stash` 草稿。
- 可借鉴点：三级阈值 + **周期重启（cycle restart）**、`resident_file` 缓存租约、远程沙箱 `sandbox_url/api_key`。前两项与 IHUI 已有四道阈值线高度重合，**不重复造**；第三项是 IHUI 确无的形态（见 §6）。
- **函数级追加取证（2026-11-20，Ghidra 12.1.4）**：从字符串级抬到"串 → 引用它的函数"，主体 100,518 函数、380 条关键字引用行、199 个函数带上下文；副件 23,476 函数 / 175 行。要点：配置 37 字段在 `FUN_14041cae0` 一处成型；`--max-subagents`（`FUN_140623630`）与 `DEEPSEEK_MAX_SUBAGENTS`（`FUN_1403ed140`）是同一上限的两个入口；`SubAgentStatus{Interrupted,Failed,Cancelled}`（`FUN_140a392f0`）为独立状态机；`/rlm` 帮助串落在 `FUN_140486980`（`crates\tui\src\commands\skills.rs`）；`auto_compact` 两处（`FUN_14029f370` / `FUN_1405f4810`）；审批四值 `default|allow|deny|audit`（`FUN_1403f52a0`）；沙箱含 `danger-full-access`（`FUN_1403f2c20`）；`.deepseek/handoff.md`（`FUN_1401cf810`）。逐条证据与复现命令见 `docs/benchmark-evidence/2026-11/deepseek-tui-native-20261120.md`，原始 TSV 同目录。
- 原生反编译仍不做：Decompiler Parameter ID 在本机 36MB 主体上 45 分钟未收敛，本次改走"关反编译、保留反汇编+引用图"通道（这是取证手段选择，不是能力缺口）。

## 4. 能力矩阵（对照 IHUI 现状）

| 能力 | Qoder | Trae | WorkBuddy | deepseek-tui | IHUI 现状 | 判定 |
| --- | --- | --- | --- | --- | --- | --- |
| 工具结果确定性裁剪 | – | – | 工件老化 `pruneOldArtifacts` | `compaction.rs` | `tool_result_pruner.py`（**零调用方**） | **缺口①已补** |
| 读前写保护 | – | – | – | `fs-observation-policy` | 无（`write_file` 盲写） | **缺口②已补** |
| 重复调用治理 | – | – | – | `repeat-tool-reminder`（advisory） | `doom_loop.py`（WINDOW 10 / REPEAT 3，可终止） | 本仓更严，不抄 |
| 上下文压缩 | – | `compact 19` 命中 | – | L1/L2/L3 + cycle | 8 个模块 + 四道阈值线 | 已覆盖 |
| 沙箱 | Electron utility | 云端 | `sandbox-proxy` | `sandbox_backend/url/api_key` | `code_exec_sandbox`/`proc_sandbox`/enforcement gate + `remote-sandbox.ts` | **缺口已补（5.12）** |
| 审批 | – | – | – | `approval_policy` + YOLO | `command_execution_approval_decision`/`approval_replay`/`mcp_tool_approval` | 已覆盖 |
| 子代理 | – | 云端 | `proxy-agents` | `agent_type` 六型 + `resident_file` 租约 + `max_subagents` 1–20 | `subagent_jobs`/`agent_teams` + resident 租约 + 并发闸 20 | **缺口已补（4/5.19）** |
| MCP | – | `builtin-mcp` | MCP apps 宿主 | `mcp_config_path` | `mcp_client` + 工件挂载（token/TTL/分页）+ 卡片内外双入口 | **缺口已补（5.13/5.17/5.18）** |
| 检查点/回滚 | – | – | `checkpoint` | snapshots + `--fresh` | `agent_checkpoint`/`checkpoint_rewind` | 已覆盖 |
| 前缀缓存统计 | – | – | – | 有 | `cost_ledger` 缓存字段 + 会话级 `diagnostics` 读数（5.16） | **缺口已补** |
| RLM | – | – | – | 有 | `agent_teams.run_recursive`（复用 run_round/聚合/并发闸；模型面 `orchestrate_agents` 的 `mode=recursive`） | **缺口已补（5.20）** |

## 5. 本次落地（80 项能力 + 1 项加固，含验证证据）

### 5.1 工具结果裁剪器：从"造好没装车"到真接线

改动：

- `apps/ai-service/app/services/tool_result_pruner.py`
  - 默认预算由猜值 `20000/2000/2000` 改为对照件 README 生效值 **8192/4096/1024**；
  - 新增 `PruneConfig.__post_init__`：`head + marker + tail ≤ threshold` 构造期校验（对照件把这条写成硬要求，本仓此前不校验，超预算配置会晚到裁剪路径才炸）。
- `apps/ai-service/app/services/agent_loop_v2.py`
  - 新增 `_prune_preview(text, budget)`；`bound_tool_result_for_context` 的超预算预览改为**头 + marker + 尾**，`output_offset` 取头长（续读从中段开头接上）。
  - 超越轴：对照件只留头，长输出的**尾部结论**（错误栈末行、测试汇总）会随截断一起丢；本仓头尾都留，且裁剪器任何拒绝都退回截头老行为、不阻断消息出口。
  - 零模型调用、replay-safe，与前缀缓存友好。

验证（末行现读）：

- `pnpm check:pytest -- tests/test_tool_result_pruner.py tests/test_tool_result_tail_preview.py` → `run 档结论:pass ... 跑成功 19 条,0 失败 0 错误`，`RESULT verdict=GREEN`。
- `pnpm check:pytest -- tests/test_security_batch10_r4_framing.py` → `跑成功 5 条,0 失败 0 错误`，`RESULT verdict=GREEN`（既有定界单源未被绕开）。

### 5.2 `write_file` 读前写保护（工具层，不动 FS 原语）

- 新增 `apps/api/src/services/fs-observation-policy.ts`：`FsObservationStore` 按「绝对路径归一（Windows 大小写折叠）+ 内容 SHA-256」记观察；拒绝返回结构化 `FS_NOT_OBSERVED` / `FS_STALE_VERSION` + 可执行补救。
- `apps/api/src/services/workspace-ai-service.ts`：
  - `FSBridge.resolvePath` 由 `private` 改公开（工具层与文件桥共用同一把路径尺子，不各算一份）；
  - `read_file` 读后记观察；`write_file` 写前校验：文件不存在放行（新建）、未读拒绝、读后被改拒绝；写后更新观察。
  - 应急开关 `IHUI_FS_OBSERVATION_POLICY=off`（默认 enforce），只影响工具面，不影响 `apply-diff` 等内部写盘。
- 为什么不改 `FSBridge.write`：它是内部写盘原语（apply-diff 路由、配置落盘、检查点快照都在用），在那一层加护栏会把内部写盘一起拦死。

验证：

- `vitest run tests/fs-observation-policy.test.ts` → `Test Files 1 passed`，`Tests 10 passed`。
- `vitest run tests/subagent-dispatch-service.test.ts tests/workspace-ai-service-agent-loop-no-simulated-execute.test.ts` → `Tests 27 passed`。
- `pnpm --filter @ihui/api typecheck` → exit 0（`tsc --noEmit` 两个工程均过）。

### 5.3 `edit_file` 工具（唯一匹配替换 + 读前观察）

- `apps/api/src/services/workspace-ai-service.ts` 新增 `edit_file`：不重读不修改（复用 5.2 的观察态）、唯一匹配才替换、命中 0/多命中分别给 `EDIT_NO_MATCH` / `EDIT_NOT_UNIQUE`，成功走 `fsBridge.edit` 并同步观察态。
- 超越轴：对照件（dsh 的 str-replace 编辑器）只把"命中一次"作为隐式前提；本仓把命中数、命中位置与补救话术做成结构化回包，模型撞错能自我纠正而不是猜。

验证：`vitest run tests/fs-edit-tool.test.ts` → `Tests 8 passed`。

### 5.4 子代理常驻文件租约（`resident_file`）

- 新增 `apps/ai-service/app/services/subagent_resident_lease.py`：
  - 租约表以「归一化绝对路径（Windows 大小写折叠）」为键，**同一文件同时只允许一个子代理持有**（对照件原文即 `Only one agent may hold a resident lease on a given file at a time`）；释放只认 owner 令牌。
  - 读取闸：`>256KB` / 非 UTF-8 / 不存在各有独立码，读不到就不租（不假装读过）。
  - 前缀：说明行 + `tool_context_boundary.scan_and_frame_tool_result` 定界块（常驻文件是外部数据不是指令；刻意不套自定义闭合标签，避免正文里的同名闭合串把包装骗坏）。
- `mcp_server.orchestrate_agents` 接线：单 agent 与后台两条路径把全文前置进 `user_input`，两条路径都在 `finally` 释放租约；并行 `tasks` 与编排模式显式返回 `RESIDENT_UNSUPPORTED_MODE`（不静默忽略入参）。
- 超越轴：对照件为"保持前缀缓存热度"服务，但对读完即改的场景没有护栏；本仓把租约与「读前写保护」放在同一套路径尺子上，前缀注入内容本身也过注入扫描与定界。

已知收窄（如实登记）：编排模式（pipeline/debate/vote/critique/decompose/team）与并行 tasks 不支持 resident；`subagent_job` 的 `send` 续跑不会重放 resident 前缀（租约按"每次派发"持有与释放，不按作业生命周期）。

验证：`tests/test_subagent_resident_lease.py` 13 例 + 既有 dispatch 4 文件 51 例全绿；`mypy --strict` 0 错误。

### 5.5 `edit_file` 批量与原子性（replaceAll / edits[] / dryRun）

- `replaceAll: true` 才允许整批替换（未声明仍按唯一匹配拒绝），回包报命中数；`edits[]` 一次提交多条编辑，全部在内存里顺序推进，**任一失败整批不落盘**并回报 `editIndex`；`dryRun` 只预览 `changed` / 替换数 / 字节差，不写盘也不动观察态。
- 成功回包保留旧契约 `occurrences`，新增 `edits` / `replacements` / `changed` / `bytesBefore` / `bytesAfter`。
- 超越轴：对照件的字符串替换器一次只做一处；本仓的原子多编辑只落一次盘、只留一个检查点快照，失败不产生半改文件。

验证：`vitest run tests/fs-edit-tool.test.ts` → `Tests 14 passed`；`pnpm --filter @ihui/api typecheck` exit 0。

### 5.6 前端：`dryRun` / `edits[]` 不再渲染可 Apply 的 diff 卡

- `apps/web/src/components/ai/tool-call-card.tsx` 的 `deriveDiffInfo` 对 `edit_file` 的两类参数返回 `null`：`dryRun: true`（工具承诺不写盘，卡片却给 Apply 入口 ⇒ 用户一点就真落盘，语义相反）、`edits: []` 多编辑（无单一 old/new 可呈现，给 Apply 入口等于凭猜写盘）。
- 超越轴：对照件的预览能力只在会话内提示，没有"预览态与可写入口"的 UI 分治；本仓把承诺与入口在渲染层解耦，点不动就是写不动。

验证：`vitest run tests/tool-call-card.test.ts` → `Tests 6 passed`；`pnpm --filter @ihui/web typecheck` exit 0。

### 5.7 `edit_file` 行尾对齐（Windows 真实场景）

- 新增 `detectEol` / `alignEol`：CRLF 行数多于裸 LF 才判 CRLF（混合文件照多数派，不静默全量改写）；比较与写回都按文件行尾对齐，双向成立（LF 片段配 CRLF 文件、CRLF 片段配 LF 文件）；成功与 `dryRun` 回包新增 `eol` 字段。
- 修的真实故障：Windows 上被编辑的文档常是 CRLF，而模型片段几乎总是 LF ⇒ 「片段明明在文件里却报 `EDIT_NO_MATCH`」。
- 不是照抄：对照件没有行尾对齐这一层；这是本仓在 Windows 宿主上自行补的边界。

验证：`vitest run tests/fs-edit-tool.test.ts` → `Tests 16 passed`；`pnpm --filter @ihui/api typecheck` exit 0。

### 5.8 `edit_file` 保留 BOM（Windows 上 `.ps1`/`.md` 常见）

- 读入时若首字符是 `U+FEFF` 则剥掉再比对（模型片段不会带 BOM），写回时补回：首行不再"明明在文件里却匹配不到"，也不会因一次编辑把 BOM 弄丢（PS 5.1 对无 BOM 的 `.ps1` 按 ANSI 读，BOM 丢失会直接把脚本读成乱码）。
- 回包新增 `bom` 字段，调用方一眼知道这份文件有没有 BOM。
- 不是照抄：对照件一律按 UTF-8 直读写，BOM 与 CRLF 都在它们的盲区；这两层是本仓在 Windows 宿主上自补的边界。

验证：`vitest run tests/fs-edit-tool.test.ts` → `Tests 17 passed`。

### 5.9 `read_file` 护栏：分段读、超大截断、二进制拒绝

- 分段读打通：`startLine`/`endLine` 此前只在路由层 `workspace-ai.ts` 生效，工具层直接忽略入参 —— 模型想分段读大文件根本做不到。现在工具层透传，行为与路由同源（同一 `FSBridge.read`）。
- 超大截断：单次读回超过 12 万字符时只回前 12 万并附续读指引（`startLine/endLine` 或先 `grep` 定位），避免一条工具结果吃掉整个上下文预算；截断只影响回给模型那段，**观察态仍记整文件摘要**，所以随后 `edit_file` 能直接改没被返回的尾部（测试 R3 钉住）。
- 二进制拒绝：前 8KB 出现 NUL 字节即判 `FS_BINARY_FILE`（指向 `parse_document`），不再把乱码当文本灌进上下文。
- 不是照抄：对照件的读取工具没有"截断但仍可编辑"的分离设计 —— 要么不截断、要么读不全就改不了。

验证：`vitest run tests/fs-read-guard.test.ts tests/fs-edit-tool.test.ts` → `Tests 22 passed`。

### 5.10 `list_dir` 条目上限（默认 200，可提到 1000）

- 回包从裸数组改为 `{ok,total,truncated,entries}`：超过上限时 `truncated=true` 并给 `hint`（用更具体的子目录、提高 `limit`、或先 `grep` 定位），`total` 始终是真实条目数 —— 模型不会误以为目录只有 200 个文件。
- 为什么不再返回裸数组：大目录（构建产物 / 媒体库）一次回几千条会把上下文挤满，而裸数组没有任何"还有更多"的信号。
- 不是照抄：对照件的目录工具没有"总量自述"这一层，截断后模型无从知道自己漏看了什么。

验证：`vitest run tests/fs-read-guard.test.ts` → `Tests 7 passed`（R6 大目录截断 / R7 小目录不削弱）。

### 5.11 `grep` / `glob` 工具：把"模型没有检索能力"补上，并修掉 `**` 语义塌陷

- 事实：桥里早有 `grep`/`glob` 原语和 `/fs/grep`、`/fs/glob` 两个 HTTP 端点（桌面侧在用），但 **AgentLoop 从未注册成工具** —— 模型手上只有 `read_file`/`list_dir`，想定位一处代码只能靠 `run_command` 外挂 `findstr`。对照件里 Trae（VS Code 系）与 deepseek-tui 都把检索当基础设施，这是本仓最刺眼的一处能力缺口。
- 新增两个工具：
  - `grep`：`content`（命中行）/ `files_with_matches`（文件清单）/ `count`（每文件条数）三种 `outputMode`；默认不区分大小写，`caseSensitive` 可开；默认最多 100 条、**单文件最多 20 条**（防一个巨型文件吃光预算），扫描硬顶 5000 条。
  - `glob`：`**` 递归，默认最多 200 个文件。
  - 两者都跳过 `node_modules` 等忽略目录、跳过二进制（前 512 字符含 NUL，与 `read_file` 同一条判据）与 >1MB 文件；回包统一 `{ok,total,truncated,…}`，被截断时带 `hint`（收窄 path/glob、提高 limit、或先换 `files_with_matches` 定位）。
- 顺手修的真 bug：`globToRegex` 把 `**/*.ts` 译成 `.*/[^/]*\.ts`，**顶层文件永远差一个斜杠**（`**/` 应能匹配零层目录）。修法是先把 `**/` 译成 `(?:.*/)?`，S5 用例钉住 `x.ts` 与 `deep/nested/c.ts` 同时命中。
- 前端同批对齐：`tool-display.ts` 补 `grep/glob` 的展示键与 subject（`pattern`），`tool-category.ts` 归入搜索类 —— 否则界面上会退化成裸码名 `grep`/`glob`。
- 超越轴：对照件的检索工具只回裸结果，**没有总量自述**；被截断时模型无从知道还漏了多少。本仓把「条数上限 + 总量 + 续查指引 + 单文件上限 + 二进制/忽略目录同判据」做成一套语言，与 5.9/5.10 的 `read_file`/`list_dir` 完全同构。

验证：`vitest run tests/fs-search-tool.test.ts tests/fs-read-guard.test.ts tests/fs-edit-tool.test.ts tests/fs-observation-policy.test.ts` → `Tests 45 passed`（新增 S1–S11 共 11 例：截断/单文件上限/二进制/忽略目录/三种模式/大小写/ReDoS 两闸）。`@ihui/api` typecheck 0。

### 5.12 远程沙箱后端（`sandbox_backend=remote`，显式 opt-in）

- 事实：本仓执行面只有本机沙箱（Windows Job 对象 / 令牌 / 二进制白名单），没有"把执行外移"的通道；对照件 deepseek-tui 的配置 `sandbox_backend/sandbox_url/sandbox_api_key` 正是这条路。
- 新增 `apps/api/src/services/remote-sandbox.ts`：`IHUI_SANDBOX_BACKEND=remote` + `IHUI_SANDBOX_URL` + `IHUI_SANDBOX_API_KEY` 三者齐备才启用；缺一项即关闭并点名 reason（fail-closed，不"半开"）；协议只接受 http(s)，超时 30s（硬顶 120s），输出 64k（硬顶 256k）。
- 接线点：`SandboxExecutor.execute()` 里**先过**登记根与网络命令两道本机闸（不因外移而放宽），再委托远程；二进制白名单/解释器闸属本机进程面，由远端负责。
- 失败语义统一走 exitCode：非 2xx / 非 JSON / 不可达 = 127，策略拒绝 = 126；不把异常抛给调用方。
- 超越轴：对照件只有单一远端通道；本仓保留本机闸在前、近端配置即关闭、失败码可判，且配置缺失时**显式点名**而不是静默回落。

验证：`vitest run tests/remote-sandbox.test.ts` → `Tests 10 passed`（含 mock HTTP server 的成功/401/非 JSON/超时/不可达/超大输出截断/配置解析）。

### 5.13 工具输出工件挂载（MCP apps 预览面，404 `Mount Expired`）

- 事实：本仓工件早已"落盘分页 + 7 天保留 + 过期清扫"（`tool_output_artifacts.py`），也已有**图表产物**的签名 token 挂载（`routers/artifacts.py`，HS256 + 独立 aud + 归属 sidecar）。缺的是"工具结果工件"这一面：模型/前端只能拿 id 回读，不能把"可看但会过期"的链接交给界面。
- 做法不是另造一套令牌，而是**并进现有签名面**：同一把 `JWT_SECRET`、同一条 `_signing_key()`，新增 `aud=ihui-artifacts-tool`、TTL 600s；`/api/artifacts/tool/token`（JWT 保护）签发，`/api/artifacts/tool/f/{token}` 只回 `text/plain` 分页（绝不 `text/html`，工件内容里的标记不执行）。
- 过期/无效/不存在对外同形：一律 404 `detail="Mount Expired"`（与对照件的语义一致，不泄露 artifact 是否存在）。
- 权限面隔离：图表 token 不能当工件 token 用（aud 不同），S 用例钉住。
- 超越轴：对照件挂载点只服务自家前端；本仓复用既有签名/归属体系，并把"纯文本、分页续读、与不存在同形"写进判据。

验证：`pytest tests/test_artifact_tool_mount.py` → `7 passed`（往返/绑定 id/篡改/过期/跨权限面/缺密钥 fail-closed/404 形状）；`mypy --strict` 0。

### 5.14 ACP（Agent Client Protocol）HTTP 桥（`POST /api/sessions/acp`）

- 事实：WorkBuddy 的 `acp.js` 把「编辑器客户端 ↔ agent 后端」抽成 JSON-RPC 2.0 方法集（`initialize` / `session/new` / `session/load` / `session/prompt` / `session/cancel`）；本仓此前只有私有 HTTP+SSE 契约，外部编辑器接进来只能读我们的文档。
- 新增 `apps/ai-service/app/services/acp_bridge.py`（纯协议翻译，零 DB 依赖）+ `POST /api/sessions/acp` 路由。实现 `initialize`（v1 + `loadSession` + `promptCapabilities`）、`authenticate`（空结果，身份只在 Bearer 层）、`session/new`（走 `SessionStore.create_thread`，`user_id` 只从承载层入参进，请求体自报无效）、`session/load`（快照：`seq/itemType/clientItemId`）、`session/list`（`owner_user_id` 过滤在 SQL 里）。
- **不假装支持**的语义：`session/prompt` / `session/cancel` / `session/set_mode` 回 `-32001` 并在 `data.hint` 指向既有 SSE 面 —— 造一个"看起来能跑"的桩比不实现更坏。
- 属主同形：别人的会话与不存在的给同一个错误码与同一句 message 前缀（不新造可分辨信号）；批量上限 20 条，空批量整批拒。
- 超越轴：对照件把 ACP 焊死在自家进程内（stdio）；本仓是**同一份 SessionStore 之上的第二种协议外观**，不新增事件模型、不新增第二个会话真相源，HTTP/批量/编辑器生态三方面同时兼容。

验证：`pytest tests/test_acp_bridge.py` → `7 passed`（能力形状/身份只从入参/属主同形/list 过滤/prompt 显式不支持/错误码/批量上限）；`mypy --strict` 0。

### 5.15 交接文档导出（`GET /api/sessions/threads/{id}/handoff`）

- 事实：`session_handoff.py`（HandoffPacket 四要素 + apply/成本建议）早已存在，但**没有任何路由 / 调用方** —— §0.9 口径下等于"没有"。对照件（deepseek-tui 的 `/cycle handoff`、WorkBuddy 的交接摘要）要的是"会话交得出一份别人接得住的文档"。
- 装车：`GET /threads/{id}/handoff`（属主闸与其它会话端点同一份），返回 `{packet, markdown, markdownChars}`；`?download=true` 回 `text/markdown` 附件（`Content-Disposition` + `no-store`）。
- 版式单一真相源：新增 `render_handoff_markdown(packet)` 落在 `session_handoff.py`（四段：待接任务 / 本轮学习 / 上下文残留 / 下一步建议；每段 ≤20 条，超出只列前 20 并写明"另有 N 条"，单条 ≤400 字符），路由层不拼字符串 —— 前端、CLI、后续 LLM 注入共用一份。
- 超越轴：对照件交接是纯文本堆叠；本仓同一 packet 同时给**结构化 JSON** 与**确定性 Markdown**（同 packet 恒同文档），且总量与裁剪都自述，不静默丢条。

验证：`pytest tests/test_session_handoff_diagnostics.py`（与 5.16 同文件）→ `8 passed`（版式四段/裁剪与"另有 N 条"/端点 `{code,message,data}`/下载附件/属主同形 404）。

### 5.16 会话体检（`GET /api/sessions/threads/{id}/diagnostics`）

- 事实：`assess_context_pressure`（五字段只读判据）与 `cost_ledger.aggregate`（`total_cached_tokens` / `cache_hit_count`）都只是服务层能力，界面/CLI 拿不到"这一条会话现在多满、缓存命中多少"。对照件把 `/context` 与 `/cache stats` 做成一等命令。
- 装车：一次读取内给出三块 —— `context`（消息枚数、`estimate_messages_tokens`、`context_limit` 与 `pressure`；窗口拿不到时 `percent_left=None`，不拿 0 冒充"耗尽/安全"）、`compaction`（`compaction_boundary` 枚数与最后一条边界原文）、`cache`（`matched/entries/totalCachedTokens/cacheHitCount/hitRate`；无账目时 `matched=false`、`hitRate=None`，不拿 0 冒充 0%）。
- 超越轴：对照件靠终端命令逐项敲；本仓一次请求给三块同源读数，且**每个"取不到"都显式落 None 而不是零**（§0.3 的实施形态）。

验证同上文件 → `8 passed`（窗口未知 vs 已知两态、边界计数、缓存未命中三态）。

### 5.17 前端工件挂载入口（工具卡片上的“查看完整输出”）

- 事实：5.13 只把后端挂载面补齐，前端拿不到入口 ⇒ 用户眼里“大输出依旧被截断”。对照件把这一步做成卡片上的可点入口（WorkBuddy 的 `mount preview`、deepseek-tui 的 `/artifacts`）。
- 新增（`apps/web/src/components/ai/tool-call-card.tsx`）：
  - `extractToolArtifact(result)`：只认 `artifactId` 严格形状（32 位小写 hex），可选 `originalChars`；字符串 JSON 与对象两态都解析，其余一律 `null`（不猜、不拼路径）。
  - `ToolArtifactMountBlock`：**点击时才**调 `/api/artifacts/tool/token` 换 10 分钟链接，`window.open(..., 'noopener,noreferrer')` 打开；失败（未登录/过期/工件被清）显示“打开失败”，不静默当成功；显示字符数，让用户知道被裁掉了多少。
- 文案：`packages/i18n/messages/web` 五语言同批新增 5 个键（`toolOutputArtifact / toolOutputHint / toolOutputOpen / toolOutputOpenFailed / toolOutputExpired`），parity 门通过。
- 超越轴：对照件的挂载是“卡片内嵌 iframe”，会与宿主同域共享风险；本仓先给**外链式最小面**（token 10 分钟、noopener 隔离、失败可见），内嵌沙盒留给产品定型，安全面不将就。

验证：`vitest run tests/tool-call-card.test.ts` → `10 passed`（新增 4 例：严格 id 形状/JSON 文本形态/大小写与数组拒绝/`originalChars` 非正降级）；`@ihui/web` typecheck 0；`check-i18n-parity` / `check-i18n-keys` / `check-i18n-messages-exist` 全绿。

### 5.18 卡片内嵌预览（分页追加，不外跳）

- 事实：5.17 只给外链，用户仍要离开页面才能看完整输出；对照件（WorkBuddy 的 mount preview、deepseek-tui 的 `/artifacts`）都是**卡片内直接翻页**。
- 后端：`GET /api/artifacts/tool/f/{token}` 增 `format=json` 分支（`{content,next,complete,totalChars}`），与默认 `text/plain + X-Artifact-*` 分支复用同一个 `read_tool_output_page` 原语，不产生第二份正文；过期/无效依旧 404 `Mount Expired`。
- 前端：`ToolArtifactMountBlock` 增「预览」按钮 —— 首次点击才换 token，然后 `?format=json` 拉第 0 页并按 `next` 追加「加载更多」，末尾显示"已到末尾"；失败（未登录/过期）与外链共用同一条"打开失败"降级。
- 超越轴：对照件的预览是**整篇塞进 iframe**（首屏即拉全量）；本仓是**按需分页追加**，首屏只取一页、正文永不二次落盘，且同一 token 面同时支持"外链直开"与"内嵌翻页"两种消费方式。

验证：`pytest tests/test_artifact_tool_mount.py` → `9 passed`（新增 JSON 页面字典 / text 头保持两例）；`mypy --strict` 0；`vitest run tests/tool-call-card.test.ts` → `10 passed`；`@ihui/web` typecheck 0。

### 5.19 并发子代理闸（`max_subagents` 1–20 的同构实现）

- 事实：deepseek-tui 的 `max_subagents` 是 1–20 的硬边界；本仓 `subagent_jobs.start_job` 此前**只对终态作业做有界淘汰（MAX_JOBS=100），对"同时在跑多少个"没有任何闸** —— 父级循环里连续 spawn 就能把后台任务与进程额度打满。
- 新增（`apps/ai-service/app/services/subagent_jobs.py`）：
  - `MAX_RUNNING_SUBAGENTS=20`、`RUNNING_CAP_ENV=IHUI_MAX_RUNNING_SUBAGENTS`、`resolve_running_cap()`（env 只能**下调**，恒夹在 [1,20]，坏值回落 20）；
  - `running_count(user_id, session_id)`：未终态作业计数，按 (身份, 会话) 分桶；
  - `start_job` 在**提交后台任务之前**判闸，超限返回 `SUBAGENT_RUNNING_LIMIT` 并点名 `running/limit`（先起后拒等于没闸）。
- 超越轴：对照件把上限写死在配置里、越界只是报错文本；本仓给它一条**可下调不可上调**的 env 通道，并把计数按"身份+会话"而不是全局单桶 —— 多会话不会互相误伤。

验证：`pytest tests/test_subagent_jobs.py` → `11 passed`（新增 env 夹紧 5 态 / 超限拒绝且不提交 / 另一会话不受影响 / 终态后可再 spawn）；`mypy --strict` 0。

### 5.20 递归分解（RLM）：**整合进既有 TeamOrchestrator**，不另起执行器

- 事实：deepseek-tui 有 `RLM turn`（递归分解 + 每层结论回注）。本仓此前零实现，上一轮结论是"低 ROI、不做"——用户否决，并给出硬约束：**"不能借鉴整合优化吗？谁也不许再编一套出来"**。
- 处置（不新增模块/文件/执行器/真相源）：
  - `TeamOrchestrator.run_recursive()` 追加在既有的 `run_round` / `run_multi_rounds` 旁边（`apps/ai-service/app/services/agent_teams.py`）。每层只是**再调一次 `run_round`**：并行分发仍走 `_default_runner → orchestrator.invoke_parallel`，聚合仍走 `ResultAggregator`，摘要仍走 `_build_summary_context`，失败语义（`completed/failed/partial`）原样继承。
  - 层数上限 `RECURSIVE_MAX_DEPTH=3`、单节点正文预算 `RECURSIVE_NODE_MAX_CHARS=8192`（与 `tool_result_pruner` 的 `DEFAULT_THRESHOLD_CHARS` 同量级，不新造数字档）；两辅助函数 `_chunk_task` / `_split_text_for_recursion` 落在同文件常量区，`_split_text_for_recursion` 的 docstring 明确"只服务这一处，通用切分器本仓已有 `codebase_indexer`，不另立"。
  - **节点预算 = `subagent_jobs.resolve_running_cap()`**（惰性 import，env 只可下调、恒夹 [1,20]）：一层要派 20 片就撞 20 的上限，超了**整次拒绝**（`RECURSIVE_NODE_LIMIT`），不跑半截再报错——与第 19 项同一个数，不写第二份上限。
  - HTTP 面只加一条薄封装：`POST /api/orchestration/teams/recursive`（`TeamRecursiveBody`：`objective` / `chunks` / `strategy` / `max_concurrency` / `depth` / `max_chars_per_node`），拒绝态回 `code=400`，走既有 `/api/orchestration` 信封，不新开路由族。
  - **模型可达面（不新开工具）**：既有唯一编排入口 `orchestrate_agents` 增 `mode=recursive`，schema 加 `chunks` / `depth` / `max_chars_per_node` 三参，分支里仍只调 `TeamOrchestrator.run_recursive`；`chunks` 传进其它 mode 显式拒绝，`depth`/`max_chars_per_node` 的边界从 `agent_teams` 惰性 import（不在 MCP 层复制第二份上限）。超时预算在 `tool_timeout_policy` 里与 `decompose` 同档（多波次 → 硬上限）。
- 超越轴：对照件的 RLM 是独立 turn 类型，层数与并发上限各写一份；本仓把**递归节点预算和子代理并发闸绑成同一个数**，并给"层数夹紧 + 节点整次拒绝 + 空片直通"三条边界显式语义（对照件在超预算时是中途失败，本仓是先算后拒）。

验证：`pytest apps/ai-service/tests/test_agent_teams.py` → `30 passed`（新增 5 例：单层直通 / 超预算自动再切一层 / env 压到 1 时两片整次拒绝 / 空片 `skipped=no_chunks` / 端点契约 `code=400` 与 `code=0` 两条）；`pytest apps/ai-service/tests/test_dispatch_subagent_orchestration.py` → `33 passed`（新增 5 例：schema 广告三参 / 端到端走既有 `invoke_parallel` / 缺 chunks 拒绝 / recursive 拒绝 agents 与布尔 depth / chunks 在 team 被显式拒绝 / 预算同源拒绝且一次都不派发）；`mypy --strict`（mcp_server + agent_teams + tool_timeout_policy）→ `Success: no issues found in 3 source files`。

### 5.21 加固：iframe 沙箱档的单一真相源（并入既有常量，不另造第二份）

- 事实：HTML 类产物预览本仓早已具备（图表 `.html` 走签名 URL `<iframe>`（`tool-call-card.tsx` 的 `ChartArtifactBlock`）、聊天内联 HTML 走 `srcDoc` 沙箱（`artifact-canvas.tsx`）），**功能不缺**；缺的是"档"的唯一性 —— `apps/web/src/lib/plugin-view-runtime.ts` 里另有一份 `PLUGIN_VIEW_SANDBOX = 'allow-scripts'` 字面量，与 `packages/ui-react/src/components/webview-frame.tsx` 的 `MODEL_CONTENT_SANDBOX` 同值两份写。
- 处置（按"谁也不许再编一套"）：
  - `packages/ui-react/src/index.ts` 补导出 `MODEL_CONTENT_SANDBOX` / `STRICT_SANDBOX`（常量早就存在，只是入口不可达；web 侧此前"引不到档常量"是审计测试文件头自己写下的原因）。
  - `PLUGIN_VIEW_SANDBOX` 改为**绑定**该常量（`= MODEL_CONTENT_SANDBOX`），不再写字面量；文件头那句"禁止各处手写字符串"从此对所有消费方成立。
  - 四处 `sandbox="allow-scripts"` 字面量**刻意保留**：`apps/web/tests/iframe-sandbox-declaration.test.tsx` 的源码审计只认标签内的字面量，并要求每一处宽档带 `iframe-sandbox-relax: <原因>`；改成 `sandbox={表达式}` 会让这四处从审计里消失（判据失明比重复更贵），而字面量本身已被那把尺子逐字对账到同一份常量，漂移照样红。
- 超越轴：不是"再补一个预览组件"，而是把"档只能有一份"变成**可判定**的：新增用例断言 `PLUGIN_VIEW_SANDBOX === MODEL_CONTENT_SANDBOX`（谁把它改回手写字面量就先红）。

验证：`vitest run src/lib/__tests__/plugin-view-runtime.test.ts tests/iframe-sandbox-declaration.test.tsx` → `2 files / 22 passed`；`pnpm turbo typecheck --filter=@ihui/ui-react --filter=@ihui/web` → `9 successful, 9 total`（含 `@ihui/ui-react:build` 重建 dist）。

### 5.22 第 21 项：用户命令钩子的配置面（信任闸 + 并入既有 HookRuntime）

- 取证：本仓 `app/core/codex_hook_config_contract.py` 已从 codex.exe 26.1111.2228.0 机械派生 14 个事件名、`MatcherGroup{matcher,hooks}` 双字段、`HANDLER_VARIANTS=(Command,Prompt,Agent,McpTool)` → TOML `("command","prompt","agent","mcp_tool")`、`HookStateToml{enabled,trusted_hash,trusted_content_hash}`、信任闸旗标 `--dangerously-bypass-hook-trust`；`hook_definition_contract.py` 另给出 `PreToolUseHookSpecificOutputWire` 的 `additionalContext / permissionDecision / permissionDecisionReason / updatedInput` 字段面。
- 缺口（AGENTS §0.9 "造好没装车"）：`HookRuntime` 的执行/超时/失败隔离/事件审计与 `agent_loop_v2` 的 PRE_TOOL_USE deny + 上下文注入**全量在位**，但登记来源只有"服务端代码 `register_lifecycle_hook()`"一条；用户写 `.ihui/hooks.json` 无论怎么写都进不来，功能对用户形同未装车。
- 处置（并入，不另造运行时）：新增 `apps/ai-service/app/core/command_hooks.py`，只补"配置文件 → 可调用钩子"的生产者：
  - 形状按既有契约校验（事件名走 `is_event`、matcher 组字段数走 `MATCHER_GROUP_ARITY`、变体走 `HANDLER_TOML_TYPE_VALUES`），只实现 `command` 变体，其余三种显式报不支持；
  - **信任闸 fail-closed**：配置内容 sha256 未登记在 `.ihui/hooks-trust.json` 的 `trusted_content_hash` 时一律不加载（`hmac.compare_digest` 比对），内容一改旧信任自动失效；`--trust` 是唯一登记动作；
  - 执行仍走既有 `HookRuntime`：命令钩子从 stdin 收 JSON payload，退出码 2 ⇒ deny（stderr 首行作 reason），stdout JSON 的 `hookSpecificOutput.additionalContext` 直接进入既有 `HookOutcome.additional_contexts` 注入链；`permissionDecision=allow/ask` 只透出字段、**不伪造放行**（放行仍归审批门）；
  - `build_registered_hook_runtime()` 在构造前调用一次 `install_command_hooks()`（幂等去重键 `(事件, 内容哈希)`），三处生产构造入口自动继承，未配置/未信任即 0 条、与接线前逐零等价。
- 超越轴：对照程序（Codex/Qoder 系）把 `hooks.state.trusted_content_hash` 存在自己的 sqlite 里；本仓把它落成同目录可审计的 JSON 信任文件 + 内容哈希，且"配置改动即降权"是哈希本身的性质，不依赖任何清理任务。另一轴：非命令变体不静默跳过而是明确拒绝——静默会被读成"已启用但没生效"。

验证：`pytest apps/ai-service/tests/test_command_hooks.py` → `10 passed`（未配置 / 未登记事件 / matcher 组字段数 / 非命令变体 / 未信任 / 信任后 exit 2 真拦 / additionalContext 贯通 / matcher 不命中不跑 / 幂等 / allow 不被伪造）；回归 `pytest apps/ai-service/tests/test_hook_runtime_injection_wiring.py apps/ai-service/tests/test_hook_engine.py` → `159 passed`；`mypy --strict`（command_hooks + hook_runtime）→ `Success: no issues found in 2 source files`；`ruff check` → `All checks passed!`。

### 5.23 第 22 项：PostToolUse 产出改写面（updatedMCPToolOutput 接进真实执行链）

- 取证：`hook_definition_contract.PostToolUseHookSpecificOutputWire` 的 properties 是 `additionalContext / hookEventName / updatedMCPToolOutput`，但本仓 `HookKind` 只有 6 个挂载点、没有 `post_tool_use` ⇒ 这个字段**在任何执行链上都不可能被消费**（典型"契约在、执行链不在"）。
- 处置：
  - `hook_runtime.HookKind` 增 `POST_TOOL_USE`（值 `post_tool_use`，与 `HOOK_EVENTS` 逐字一致）；`HookOutcome` 增 `updated_output`，用哨兵 `NO_UPDATED_OUTPUT` 区分"没给"与"显式给 null"（后者是合法的"抹掉结果"）；
  - `command_hooks` 把 `hookSpecificOutput.updatedMCPToolOutput` 映射成 `updated_output`，并把 `post_tool_use` 登记为可执行事件；matcher 对所有带 `tool_name` 的事件生效（不再只对 PRE）；
  - `agent_loop_v2` 新增 `_run_post_tool_hooks()`：并行/串行**两条**分支都在录制 step 事件与产物挂载**之前**调用 ⇒ 后续报表看到的是最终产出；给 `updated_output` 即替换 `ToolResult.result`，给 `additionalContext` 即并入模型输入（与 PRE 同一注入形态）；`_hook_runtime` 未注入或没有 POST 钩子 ⇒ 返回同一对象，逐零等价。
- 超越轴：对照程序把钩子结果串成"链式改写"，但没有区分"未提供"与"显式清空"；本仓用哨兵把这两种情形分开，后注册钩子按"最后写赢"覆盖而非静默叠加 —— 顺序与结果都可预测。

验证：`pytest apps/ai-service/tests/test_post_tool_hooks.py apps/ai-service/tests/test_command_hooks.py` → `15 passed`（改写映射 / 显式 null / 静默哨兵 / 消费端真替换+上下文 / 无钩子零变化 / 未配置 / 未信任 / 非命令变体 / 幂等 / allow 不伪造）；回归 `test_hook_event_ordering + test_hook_exit_contract + test_parallel_tool_abort_54 + test_tool_approval + test_tool_invocation_ledger_b04 + test_hook_event_kind` → `102 passed`；`mypy --strict`（command_hooks + hook_runtime + agent_loop_v2）→ `Success: no issues found in 3 source files`；`ruff check` → `All checks passed!`。

### 5.24 第 23 项：permissionDecision 提前到审批门之前（allow/ask 真正生效）

- 缺口：上一轮把 `PreToolUse` 的 deny 与上下文接好了，但整段钩子跑在 `_request_approval` **之后** ⇒ 钩子给 `allow` 也救不回一次已经弹给用户的审批框，`ask` 更是永远无法抬升低危工具。契约里的 `PreToolUsePermissionDecisionWire = (allow, deny, ask)` 因此只有 `deny` 一路有效。
- 处置：
  - `HookOutcome` 增 `permission_decision`（None = 不表态），`_absorb` 按"首个表态生效"聚合；
  - `agent_loop_v2` 把整段钩子调用**移位**到审批策略计算（skill 授权 / auto 免审 / bypass / MCP 注解 / 双轴 / 工具级策略）之后、污点闸门与 auto-review 之前：`allow` ⇒ `needs_approval=False` 且落 `hook_allow_skip_approval` 决策提示；`ask` ⇒ 抬升为需审批并落 `hook_ask_require_approval`；`deny` ⇒ 不弹窗直接拒绝（与上一轮同形）；
  - 硬边界顺序不变：plan 白名单、turn-scoped denylist、角色矩阵、双轴 `FORBID` 都在更早的出口，钩子 `allow` **只替换"要不要问用户"这一步，不增加可执行面**。
- 超越轴：对照程序把 permissionDecision 与审批门混在一处判定，本仓显式分成"策略层（可被本地配置翻转）→ 钩子层（会话级表态）→ 污点/审查层（安全地板不可被 allow 穿透）"三段，allow 越不过安全地板，ask 也不会压掉硬边界。

验证：`pytest test_hook_runtime_injection_wiring.py` → 新增 3 例（allow 省掉审批且真执行 / ask 把低危工具抬进审批 / 无钩子阳性对照照旧弹审批）；`test_hook_runtime_injection_wiring + test_hook_event_ordering + test_tool_approval` → `43 passed`；`test_permission_modes + test_permission_axis_gate + test_permissions_instructions_56 + test_post_tool_hooks + test_parallel_tool_abort_54` → `63 passed`；`mypy --strict`（hook_runtime + agent_loop_v2 + command_hooks）→ `Success: no issues found in 3 source files`；`ruff check` → `All checks passed!`。

### 5.25 第 24 项：updatedInput 真正替换工具入参（安全语义：只改做什么，不改允许谁做）

- 缺口：`PreToolUseHookSpecificOutputWire.updatedInput` 一直只被当字段透出——本轮之前的消费端完全不读它，钩子"脱敏/改写路径"的能力等于零。
- 处置：
  - `HookOutcome.updated_input` 用与产出改写同一枚哨兵区分"没给 / 显式给空对象"；`_absorb` 只接受 **dict**（非对象改写会让下游工具拿到形状外的入参，比不改更危险），首个改写生效；
  - `command_hooks` 把 `hookSpecificOutput.updatedInput` 映射进运行时；
  - `agent_loop_v2` 在钩子段内真正执行 `tc.args = updated_input`，并落 `hook_updated_input` 决策提示（`setdefault`：同一调用上 `allow` 豁免是更强的审计事实，不被覆盖）。
- 安全语义（这是"超越轴"）：改写发生在**所有硬边界之后、guarded_pipeline / 路径校验 / 审批门之前** ⇒ 改写后的入参仍要过注入探测、危险入参扫描与审批；钩子只能改"这次做什么"，不能改"谁被允许做"，也不能借改写把高危参数洗成低危。

验证：`pytest test_hook_runtime_injection_wiring.py` → `13 passed`（新增 2 例：改写真替换 + 非对象改写被忽略且工具收到原入参）；`test_hook_runtime_injection_wiring + test_post_tool_hooks + test_command_hooks` → `28 passed`；`mypy --strict` → `Success: no issues found in 3 source files`；`ruff check` → `All checks passed!`。

### 5.26 第 25 项：PermissionRequest 审批前置裁决（allow 免弹窗 / deny 不惊动人）

- 缺口：契约 `PermissionRequestHookSpecificOutputWire.decision.behavior = allow|deny` 存在，但本仓 `HookKind` 没有 `permission_request` 挂载点 ⇒ 审批是"只能问人"的死路，钩子无法提前放行或提前拒绝。
- 处置：
  - `HookKind.PERMISSION_REQUEST` + `HookOutcome.permission_behavior`（首个表态生效；deny 同时落 `denial_reason`）；
  - `command_hooks` 解析嵌套 `hookSpecificOutput.decision.behavior`（契约形状就是嵌套对象，不是扁平键），`message` 作拒绝原因；
  - `agent_loop_v2` 在 `_request_approval` **之前**、仅在 `needs_approval` 为真时执行：`allow` ⇒ 免弹窗 + `gate_approved=True`（exec_policy PROMPT 档也不会二次弹）+ 落 `hook_permission_allow`；`deny` ⇒ `error_type=permission_request_denied`、副作用零发生、**不惊动用户**；钩子异常 ⇒ 降级为"照旧问人"，不改变审批默认档。
- 超越轴：事件语义严格限定为"即将请求权限"，不需要问人的调用根本不产生该事件 —— 对照程序按"每次工具调用"触发会让审计面被无意义事件淹没。

验证：`pytest test_hook_runtime_injection_wiring.py` → `15 passed`（新增 2 例：allow 免弹窗且真执行 / deny 零副作用）；`test_command_hooks.py` → `11 passed`（新增 1 例：嵌套 `decision.behavior` 映射逐字对上）；`+ test_post_tool_hooks` → `31 passed`；回归 `test_tool_approval + test_permission_modes + test_hook_event_ordering` → `47 passed`；`mypy --strict` → `Success: no issues found in 3 source files`；`ruff check` → `All checks passed!`。

### 5.27 第 26 项：钩子运行结果进 SSE（"哪个钩子拦了、改了、超时了"前端可见）

- 缺口：`HookRuntime` 已产出逐钩子 `HookRunEvent`（name / kind / status / durationMs / error），但消费面只有服务端日志 —— 前端时间线看不到"这次调用被哪个钩子拦下、哪个钩子改写了产出、哪个钩子超时降级"。同一个 `hook.failed` 通道只覆盖"钩子自己挂了"，不覆盖"钩子正常跑完并给出了裁决"。
- 处置：
  - `AgentEventStream.emit_hook_run()`：空表直接返回（**零钩子 = 零事件**，不往时间线塞空表噪声）；载荷 `{run_id, tool_name, tool_call_id, hooks}`，`hooks` 元素形状直接复用 `HookRunEvent.as_dict()`（不另抄一份键名，单一真相源）；
  - 三处调用点：`pre_tool_use`（放在 deny 分支 `return` **之前**，拒绝路径同样可见）、`permission_request`（放在 deny 分支之前）、`post_tool_use`（在产出改写与上下文注入判定之前，事件与最终结果同批可见）；
  - 下行通道**刻意不走 `emit()`**：`HOOK_EVENTS` 是"用户可配的触发器白名单"，把 `hook.run` 塞进去等于允许"钩子运行结果"去点火用户钩子 —— 每跑一枚钩子再发一次事件，自激成环。新增 `HookEngine.publish_observation()` 只走订阅面，与 `hook.failed` 同一条纪律；
  - `agent_events` 三处登记（`HOOK_RUN` 常量、`HOOK_EVENT_TO_SSE` → `hook-run`、`AGENT_SUBSCRIBE_EVENTS` 补一行）⇒ 三个 SSE 端点（execute/stream、tasks/stream、`{agent_id}/stream`）一处补齐三处生效；
  - fail-open：`publish_observation` 抛错只 warning，主链路不受影响；轻量测试替身未装配 `_events` 时 `getattr` 取 None ⇒ 不发（不改变既有测试行为）。
- 超越轴：对照程序把"钩子运行"当调试日志（默认不进事件流，需要开 debug 才可见）；本仓直接把逐钩子结果做成**与 plan-step 同级的命名 SSE 事件**，并保持"空表不发"与"拒绝路径也发"两条语义，前端不必为一个开关再申请一次调试模式。

验证：`pytest test_hook_run_sse.py` → `4 passed`（前置 deny 可见 / 零钩子零事件 / 后置改写可见 / 下行失败 fail-open）；`test_hook_run_sse + test_hook_runtime_injection_wiring + test_post_tool_hooks + test_command_hooks` → `35 passed`；`mypy --strict`（agent_loop_v2 + agent_events + hook_engine）→ `Success: no issues found in 3 source files`；`ruff check`（含新测试）→ `All checks passed!`。

### 5.28 第 27 项：SESSION_START / USER_PROMPT_SUBMIT 挂载点（入口上下文注入）

- 缺口：`HookKind` 8 个值里，`session_start` 与 `user_prompt_submit` 只有契约与 `command_hooks` 映射，`agent_loop_v2` 没有任何执行点 —— 用户在 `.ihui/hooks.json` 配了"会话开始时读项目规范 / 提交提示词时补充约束"也不会被执行（典型 §0.9 "契约在、执行链不在"）。
- 处置：
  - `run()` 入口在 `self._messages = messages` 之后、记忆/画像注入之前执行两枚钩子（payload 带 `session_id / user_id / conversation_id / cwd`，`user_prompt_submit` 另带末条用户消息文本，截断 4000）；
  - 复用同一 `HookRuntime` 与 `_wait_interruptible`（不新造第二套执行器，取消语义与 session.start 事件一致）；
  - 语义边界：这两个 `HookKind` 的契约里没有裁决字段，本层**只消费 `additionalContext`**（注入为 developer 消息，截断 4000），不把 `stop` / `decision` 凭空解读成 deny/allow —— 语义要发明就得先改契约；
  - `_append_hook_contexts()` 抽成模块级单一实现：`post_tool_use` 改写面与本层共用一份，不再各抄一遍（轻量测试替身缺实例方法时也能走同一函数）；
  - fail-open：钩子抛错/超时只 warning，`_LoopInterrupted` 交主循环既有分支收口，零钩子时 `run()` 行为与接线前逐零差异。
- 超越轴：对照程序把入口钩子当"只能加 prompt 文本"的旁路；本仓把它接进**同一事件流**（`hook.run` 帧逐钩子可见，第 26 项通道直接复用），入口注入也能被前端审计到。

验证：`pytest test_lifecycle_hooks.py` → `5 passed`（session_start 注入落地 / user_prompt_submit 收到 prompt 并注入 / 零钩子零变化 / 钩子抛错不阻断 / 入口钩子结果进 SSE）；`test_post_tool_hooks + test_hook_runtime_injection_wiring + test_hook_run_sse + test_lifecycle_hooks` → `29 passed`；`mypy --strict`（agent_loop_v2）→ `Success`；`ruff check`（含新测试）→ `All checks passed!`。

### 5.29 第 28 项：STOP 钩子（正常完成的"再想一轮"哨点，硬上限 1 段）

- 缺口：`HookKind.STOP` 有契约有运行时，但 `run()` 完成后没有任何哨点 —— 用户想"每次答完先自检一遍测试再收尾"只能靠提示词祈祷模型记得；且配置面 `decision: "block"` 在本仓没有翻译层，配了也不生效。
- 处置：
  - `command_hooks`：STOP 点把 `decision: "block"` 或 `continue: true` **显式翻译**成运行时认的 `stop/stop_reason`（`reason` 作续跑指令；缺省给 `hook <name> 要求继续`）——消费端只认一种方言，不让两种写法各说各话；
  - `agent_loop_v2._maybe_continue_on_stop_hook()`：只对 `stop_reason == COMPLETED` 触发；取消/暂停/异常/预算不足/达到上限一律不触发（那些结局不是"可以再想想"的结局，拿钩子复活它们等于绕过用户主动操作或安全停止）；
  - block ⇒ `reason` 作 developer 指令注入并**再跑一段循环**（`prior_iterations`/`prior_tokens` 承接，结果面连续），**硬上限 1 段**防钩子自激；
  - 不 block 时只注入 `additionalContext` 后照常结束；钩子异常/超时降级为照常结束（失败隔离在运行时层，`hook.run` 帧照发）。
- 超越轴：对照程序把 Stop hook 的 block 语义做得比"再推一次模型"更宽（还能触发自定义动作链）；本仓刻意收窄成**一次续跑 + 上下文注入**，并把触发条件钉死在"正常完成"，避免"用户点了取消却被钩子拉回来继续烧 token"这类越权副作用。

验证：`pytest test_stop_hook.py` → `5 passed`（block 真续跑 / continue 同义 / 不 block 只注入且不续跑 / 钩子抛错降级 / 配置面 block 映射到运行时）；`test_lifecycle_hooks + test_post_tool_hooks + test_hook_runtime_injection_wiring + test_hook_run_sse + test_command_hooks` → `40 passed`；`mypy --strict`（agent_loop_v2 + command_hooks）→ `Success: no issues found in 2 source files`；`ruff check`（含新测试）→ `All checks passed!`。

### 5.30 第 29 项：PRE_COMPACT / POST_COMPACT 压缩前后哨点

- 缺口：`HookKind` 最后两个值 `pre_compact` / `post_compact` 只有契约，压缩实现里没有任何挂载点 —— "压缩前把关键约束塞进摘要 / 压缩后给新窗补上下文"两类诉求无法落地。
- 处置：
  - 触发面用**压力判据闸**：`estimate_messages_tokens` + `assess_context_pressure`（复用 `core/context_compaction` 的同一实现，不另写阈值）只在 `is_above_auto_compact` 为真时跑 `PRE_COMPACT` —— 不在每次迭代制造"差点压缩"的空跑噪音（这是对照程序最容易踩的坑）；
  - `PRE_COMPACT` payload 带 `used_tokens / context_limit / percent_left / is_at_blocking`；`additionalContext` 注入**压缩前**消息（会被摘要带上）；`stop=true` ⇒ 放弃本次压缩并原样返回（Codex PreCompact 的"叫停"语义）；
  - `POST_COMPACT` 只在 `info.compressed` 为真后运行，payload 带 `original_tokens / compressed_tokens / removed_count / trigger`，`additionalContext` 注入**压缩产物**（新窗可见，不写回旧消息）；
  - `_run_compaction_hook()` 单出口：同一 `HookRuntime`、`hook.run` 帧照发、异常只 warning；压力判据本身失败也只 debug 降级，压缩主链路照常。
- 超越轴：对照程序把 pre/post compact 当"总是跑"的旁路；本仓用**同一份压力判据**决定要不要跑，并让 pre 钩子有"叫停压缩"权力、post 钩子只写新窗 —— 审计面干净、语义不串台。

验证：`pytest test_compaction_hooks.py` → `5 passed`（无压力零事件 / pre 上下文进压缩前消息 / pre stop 叫停压缩且原对象返回 / post 上下文进产物 / 钩子抛错压缩照常）；五个既有压缩套件 `test_agent_loop_compaction + micro_compaction + compaction_wiring + context_pressure_micro_compaction + compaction_metrics` → `64 passed`；`mypy --strict`（agent_loop_v2）→ `Success`；`ruff check`（含新测试）→ `All checks passed!`。

### 5.31 第 30 项：`hook.run` 前端消费面

- 缺口：第 26 项已把"逐钩子运行结果"发到 SSE，但前端没有消费点 —— 后端发帧、前端无人认，属 §0.9 的"契约在、执行链不在"。既有的"钩子失败"卡（`packages/shared/src/chat/hook-failures.ts` + `apps/web/src/components/chat/message-list/hook-failure-card.tsx`）是六态失败专用通道，只讲"失败与处置"，讲不了"这一轮跑了哪些钩子、各自多久、谁超时"。
- 处置（同一帧只解析一次，三端共用一份实现）：
  - 共享层 `packages/shared/src/sse/agent-events.ts`：新增 `AGENT_TASK_EVENTS.HOOK_RUN = 'hook-run'`、`AgentHookRunEntry`（`name / kind / status / durationMs / error?`）、`AgentHookRunEvent`（`toolName / toolCallId / runId / hooks`）、`HOOK_RUN_FIELDS` zod 表与 `parseHookRunEvent()`；`status` 只认 `ok / timeout / error` 三值，**未知 status 或空 hooks 一律拒帧** —— 读不懂的帧不冒充成功，也不会在面板上渲染成一条"看起来跑通了"的记录。
  - `apps/web/src/hooks/use-agent-runtime.ts`：`hookRuns` 环形缓存（`MAX_HOOK_RUNS = 50`），监听器挂在 `PLAN_STEP` 之后、`SESSION_END` 之前，换 agent 时随既有清理逻辑归零。
  - `apps/web/src/components/ai/agent-task-progress-pane.tsx`：`data-testid="pane-runtime-hook-runs"` 区块，位于 plan 步骤之后、权限模式之前（"先看干了什么、再看钩子怎么判、最后看权限档"的阅读序），带 `Webhook` 图标 + 每钩子状态标签。
  - 文案走 i18n，5 个 web locale（zh-CN / en / zh-TW / ja / ko）各 5 键（标题 / 元信息 `{tool}` `{count}` / ok / timeout / error），不写死中文。
- 超越轴：对照程序把钩子运行结果混在通用日志流里；本仓让它成为**结构化一等帧 + 独立面板**，且与失败卡分工（运行面 vs 故障处置面），同一份 `HookRunEvent.as_dict()` 既是后端事实也是前端类型的来源，不另造第二份字段表。

验证：`pnpm --filter @ihui/shared exec vitest run src/sse/__tests__/agent-events.test.ts` → `50 passed`（新增 4 例：三态逐条投影 / 未知 status 拒帧 / 空 hooks 拒帧 / 事件名不符拒帧；并同步把常量集合计数改 18 + `HOOK_RUN` 值侧断言）；`node scripts/check-i18n-parity.mjs` → `✅ 所有被测端键集一致`（web 5 locale 均为 554 keys）；改动文件定向 `tsc --noEmit`（`use-agent-runtime.ts` + `agent-task-progress-pane.tsx` + 共享 `agent-events.ts`）→ 0 错。全量 `pnpm turbo typecheck --filter=@ihui/web` 当前有 1 条错，位置在**他席未跟踪在飞文件** `apps/web/src/hooks/use-permission-auto-revert.ts`（`'auto-revert'` 不在 `ModeChangeSource` 联合里），与本项无关，本会话不动他人现场。

### 5.32 第 31 项：钩子配置面只读自述（`/api/agent/command-hooks`）

- 缺口：钩子配置面此前只有"跑起来才发现没生效"这一条观测路径。文件没建 / JSON 写坏 / 哈希没登记（未受信任）/ 空表，四种结局在运行时**一律表现为"钩子没跑"**，用户无法区分"我没配"和"我配了但没被信任"——这正是 §0.9 反面：能力在、可观测性不在。
- 处置（判据零新增，复用既有形状/信任/哈希三件）：
  - `core/command_hooks.describe_command_hooks()`：返回 `status` 五态（`not-configured` / `empty` / `invalid` / `untrusted` / `trusted`）、`content_hash`、`trusted_hash`、`error`、`specs`；`_parse_specs` / `_read_trusted_hash` / `hooks_content_hash` 直接复用，**任何输入都不抛错**（自述面失败不能把排障端点拖红）。
  - 端点 `GET /api/agent/command-hooks`（登录必需）：进程级全局配置，故展示面**刻意不带完整命令行**——每条 spec 只给 `event / matcher / timeout / command_preview`（可执行文件名）+ `arg_count`。完整 argv 可能带令牌或私有路径，复制到第二个读面等于多开一个凭据面；要看全文就按写它的权限去读本机配置。
  - web 侧 `useCommandHooksConfig()` 取数 + 面板 `pane-runtime-hook-config`：**只在 `untrusted` / `invalid` 时出现一行琥珀提示**（"配了 N 条但未受信任" / "配置文件损坏，已按无配置运行"），trusted 与未配置都不打扰（后者是合法默认档，不该报警）。取不到一律 `null`，不冒充"未配置"。
- 超越轴：对照程序的 `/hooks` 只告诉你"配了什么"，不说"为什么没生效"；本仓把**无效原因**显式化并且把展示面收窄成"认领信息 + 计数"，既不泄露 argv 又把三方（配置文件 / 信任哈希 / 运行时登记）的差异说清楚。

验证：`pytest test_command_hooks_describe.py` → `7 passed`（未配置 / 空表 / 坏 JSON / 形状坏 / 未受信任且 argv 不外泄 / 已信任 / 信任后改动回退未受信任）；`ruff check`（command_hooks + agents 路由 + 新测试）→ `All checks passed!`；`mypy --strict`（command_hooks）→ `Success: no issues found`；`check-i18n-keys.mjs` → `通过, 1716 文件 / 20692 键 / 5 语言 parity OK`；`check-i18n-parity.mjs` → `✅ 键集一致`；改动文件定向 `tsc --noEmit` → 0 错。

### 5.33 第 32 项：钩子信任登记闭环（可审计 + 显式确认）

- 缺口：信任动作此前等价于"`--trust` 一条命令写完就生效"——既不展示**将要被信任的命令**，也不记录**谁在何时信任了哪份内容**。命令钩子等于把本机 shell 执行权交给一份 JSON，出了事无法回答"谁批的"。这也正是"小工具长成高风险面"的典型形态。
- 处置（**坚持不开 HTTP 信任写面**）：
  - 信任记录从"一个哈希"扩成一条登记：`trusted_content_hash / trusted_at / trusted_by / host / config_path`；判定仍只认哈希（旧文件照读），新增键只服务审计；
  - `--trust` 先打印**本机待信任清单**（事件、matcher、超时、完整命令行），再要求交互确认；非交互环境未给 `--yes` 一律 exit 2 且**不写**文件（失效方向 = 多拒一次）；空表同样拒绝（没有可执行钩子时登记信任没有意义）；
  - `GET /api/agent/command-hooks` 带上 `trusted_at / trusted_by`；面板在 `untrusted` 时追加"上次登记 {by}"，让"谁改过、为什么失效"在同一行读完。
- 为什么**不**给 Web 一个"信任"按钮（这是本项最重要的设计判断）：ai-service 的钩子配置是**进程级全局文件**，而该端点只要求登录。若开放 HTTP 信任，任何登录用户都能把"别人写好的命令"一键升格为本机可执行 —— 等价于把 shell 执行权外借给整个登录面。"能在本机改文件"与"能在 Web 点按钮"不是同一权限级，所以信任动作只保留在本机 CLI；Web 只做只读自述。
- 超越轴：对照程序的信任是桌面本机动作（UI 与本机同权限，风险对等）；本仓是多租户服务端 + 本地 CLI 的组合，因此把**权限面分层**（读面开放、写面只在本机）并留下可追责的三元组，比"给个按钮"更安全也更符合本仓部署形态。

验证：`pytest test_command_hooks_describe.py` → `11 passed`（新增 4 例：审计元数据落盘 / 非交互无 `--yes` 拒绝且不写文件 / `--yes` 写入并可读回 trusted / 空表拒绝）；`ruff check` + `mypy --strict` 均通过；`check-i18n-parity` → `✅ 键集一致`；改动文件定向 `tsc --noEmit` → 0 错。

### 5.34 第 33 项：`session_end` 钩子挂载点（收尾观察面）

- 缺口：契约侧 `codex_hook_config_contract.HOOK_EVENTS` 14 个事件里一直有 `session_end`，`.ihui/hooks.json` 也能写；但 `HookKind` 只有 8 格（session_start / user_prompt_submit / pre·post_tool_use / permission_request / pre·post_compact / stop），**没有 session_end**。于是配置了也不会执行，`install_command_hooks` 只会打一行"事件无挂载点"警告 —— 又一处"契约在、执行链不在"。
- 处置：`HookKind.SESSION_END = "session_end"` + `_KIND_BY_EVENT["session_end"]` 同批接上；`AgentLoopV2._run_session_end_hooks()` 在 `events.session_end()` 之前调用，载荷与随后下发的收尾帧同源同刻（`session_id / user_id / conversation_id / cwd / success / stop_reason / iterations / duration_ms`），`hook.run` 仍走既有 `publish_observation` 通道，不新造事件名。
- 语义边界（本项最重要的一条）：收尾钩子是**观察面**。会话已经结束，这里不解读 `decision == "block"`，也不允许把会话"复活"—— 那等于让钩子绕过用户取消与安全停止；`additionalContext` 只写进消息历史（下一条会话可见），不改变本次 `result`。钩子异常 / 超时 / 中断一律降级为"照常结束"。
- 超越轴：对照程序把 `SessionEnd` 只当遥测钩子（失败静默、无结构化回执）；本仓把它接到同一套 `HookRuntime` + `hook.run` SSE 通道，运行状态 / 耗时 / 错误与工具面钩子**同形可见**，且显式钉住"观察面不得复活会话"这条边界。

验证：`pytest test_session_end_hook.py test_lifecycle_hooks.py` → `9 passed`（新增 4 例：事件名必须映射到存在的 HookKind / 载荷与 result 同源 / `decision=block` 不改写返回值 / 钩子抛错不阻断）；`ruff check` 全过；`mypy --strict` 对两个 core 模块 `Success: no issues found`。

### 5.35 第 34 项：`pre/post_model_request` 钩子挂载点（请求前后观察面）

- 缺口：契约 14 事件里的 `pre_model_request` / `post_model_request` 同样只有名字没有挂载点。对照程序在这两个点能做的事（请求前审查将要发出的提示、请求后审计实际产出的形状）在本仓此前一件也做不了 —— 配置面看得见、执行链摸不着。
- 处置：`HookKind.PRE_MODEL_REQUEST / POST_MODEL_REQUEST` + `_KIND_BY_EVENT` 同批接上；`_run_model_request_hooks()` 挂在 `_llm_call_with_retry` 的**请求发起前**与**成功返回点**（流式与非流式两条返回各一处），复用既有 `HookRuntime` 与 `hook.run` 观察通道。
- 语义边界：两个点都是**观察 + additionalContext 注入面**。请求前钩子只在本次请求的**第一枚尝试**前点一次（重试/溢出救赎不重复点火，免得一次上游抖动把同一钩子打成 N 遍）；模型产出的改写**刻意不做** —— 工具产出改写已有 `POST_TOOL_USE` 受审通道，模型产出若也能被钩子替换，"这句是模型说的还是钩子说的"将无法归因；`decision/stop` 一律不解读，拿钩子改模型调用控制流等于绕开预算与取消语义。
- 超越轴：对照程序这两个点只给遥测（无结构化回执、失败静默）；本仓把载荷钉成可判读的形状（`message_count / tool_count / tool_names / iteration / streaming` 与 `content_length / tool_call_count / finish_reason / streamed`），运行结果进同一条 `hook.run` SSE，前端面板与工具面钩子同形可见。

验证：`pytest test_model_request_hooks.py` → `4 passed`（事件名映射 / 前后各点火一次且载荷来自真实返回值 / 钩子抛错不改写 `final_response` / 请求前 `additionalContext` 真的进到模型入参）；回归 `test_hook_engine.py test_hook_run_sse.py` → `155 passed`；`ruff check` 全过；`mypy --strict` 对两个 core 模块 `Success: no issues found`。
### 5.36 第 35 项：`interrupt` 钩子挂载点 + 同步钩子超时根治

- 缺口一：契约 14 事件里的 `interrupt` 没有挂载点 —— 取消/中断是"外部系统最想知道的时刻"（落审计、清临时资源、通知下游），此前完全无处挂。
- 缺口二（本项排障时暴露的真缺陷）：`HookRuntime._run_one` 对**同步钩子直接在本事件循环里调用**，`asyncio.wait_for` 只包协程分支 ⇒ 一个 `time.sleep(30)` 的同步钩子能把整个 agent 循环冻住 30 秒，`timeout` 形同虚设。这不是 interrupt 独有的问题：所有 8 个挂载点的同步钩子都受影响。
- 处置：
  - `HookKind.INTERRUPT` + `_KIND_BY_EVENT["interrupt"]`；`AgentLoopV2.cancel()` 在置 `_cancel_requested` 之后、落快照之前触发（不能用 `_wait_interruptible` —— 本函数自己是取消入口，会在 0.25s 内被自己的取消标志打死）；`_INTERRUPT_HOOK_TIMEOUT_SECONDS = 2.0` 硬上限，超时/被取消都只记一行 warning 后**照常取消**；
  - `_run_one` 改为：协程钩子 `await wait_for(...)`，同步钩子 `await wait_for(asyncio.to_thread(func, payload))`，并保留"同步函数返回 awaitable"的兼容分支 ⇒ 超时对两种钩子都真正成立。
- 语义边界：取消是用户最高优先级操作，钩子只观察、不裁决；钩子回的 `decision/stop` 一律不解读（拿钩子阻止取消 = 绕过用户意志）。
- 超越轴：对照程序的钩子超时只保证主线程不被协程挂住；本仓把同步钩子也移出事件循环，并把"取消上限"写成常量而非散落魔法数 —— 这两条都不依赖调用方自觉。

验证：`pytest test_interrupt_hook.py test_lifecycle_hooks.py test_session_end_hook.py` → `13 passed`（含"同步 sleep(3) 钩子 timeout=0.5 不能拖住取消"那条，改动前实测 5.0s 失败、改动后通过）；回归 `test_hook_engine / test_hook_run_sse / test_stop_hook / test_compaction_hooks / test_post_tool_hooks / test_hook_init_is_interruptible` → `174 passed`；`ruff check` 全过；`mypy --strict` 两个 core 模块 `Success: no issues found`。
### 5.37 第 36 项：`subagent_start` / `subagent_stop` 钩子挂载点（派发链）

- 缺口：契约 14 事件里最后两个没有挂载点的是 `subagent_start` / `subagent_stop`。子代理派发链（`mcp_server._tool_dispatch_subagent`）走的是独立执行面，不在 `AgentLoopV2` 里，所以此前"给子代理注入策略"、"在子代理收尾处审计"两件事都无处可挂 —— 配置面看得见、派发链摸不着。
- 处置：`HookKind.SUBAGENT_START / SUBAGENT_STOP` + `_KIND_BY_EVENT` 同批接上；`_get_subagent_hook_runtime()` 惰性单例（构造失败降级为 `None`，不挡派发），`_run_subagent_hooks()` 统一出口，5s 硬上限。挂载三处：
  - 单路同步派发：`start` 在 `invoke` 之前、`stop` 在结果定型之后；
  - 并行派发：`start` 逐个子任务各点一次（只改 `task` 正文），`stop` 逐条结果收尾；
  - 后台作业：`_invoke_subagent_for_job` 内部同形挂载（后台与同步两条腿不各写一份判据）。
- 语义边界：`start` 是**上下文注入面** —— `additionalContext` 只加在子任务正文前，`resident_prefix` 逐字不动（前缀缓存按字节命中，动了整段失效）；`stop` 是**观察面** —— 结果已定型，不解读 `decision/stop`，不改写 `status/output/needs_help`；异常/超时一律降级。
- 超越轴：对照程序的子代理钩子只有"通知"语义；本仓把注入与观察分成两面、三条腿（单/并行/后台）共用同一出口，并显式钉住"注入不得污染缓存前缀"这条在本仓特有的约束。

验证：`pytest test_subagent_hooks.py` → `5 passed`（事件映射 / 单路注入进正文且 stop 收到定型结果 / 并行逐任务各点一次 / 钩子抛错不改派发结果 / 零钩子正文逐字不变）；回归 `test_dispatch_subagent / test_dispatch_subagent_orchestration / test_dispatch_subagent_tool_surface / test_d08_subagent_handoff / test_subagent_resident_lease / test_chat_dispatch_admission / test_subagent_jobs` → `98 passed`；`ruff check` 全过；`mypy --strict`（含 `mcp_server.py` 本体）`Success: no issues found`。
### 5.38 第 37 项：子代理钩子接入 `hook.run` 观察通道

- 缺口：第 36 项把 `subagent_start/stop` 挂进派发链后，钩子会跑了，但**结果看不见** —— 前 12 个挂载点都把逐钩子结果发 `hook.run` SSE（面板可判"哪个钩子拦了/超时了"），唯独子代理派发面这条腿只在服务端日志里留一行。同一个能力两种可见度，排障时会误判成"钩子没跑"。
- 处置：`_run_subagent_hooks()` 在拿到 `HookOutcome` 后，复用 `hook_engine.publish_observation("hook.run", {...})`（与 `agent_loop_v2._emit_hook_run_event` 同一通道、同一纪律：**刻意不进 `HOOK_EVENTS`**，否则每跑一枚钩子再点火用户钩子形成自激）；载荷带 `session_id / run_id / tool_name=orchestrate_agents / hooks`，空表不发，下行失败只 warning。
- 语义边界：这是**观察面**，不下发、不改写任何派发结果；`session_id` 必带（agents.py 的转发按 session_id 过滤，不带键的帧会被属主过滤 fail-closed 丢掉，且丢得无声）。
- 超越轴：对照程序的钩子观测按"钩子自身"聚；本仓把子代理钩子并进**同一运行时间线**（与工具面钩子同形字段），"钩子失败"和"子代理失败"不再各看一处。

验证：`pytest test_subagent_hooks.py` → `6 passed`（新增"子代理钩子结果必须出现在 hook.run 且带 session_id"1 例）；`ruff check` 全过；`mypy --strict`（`mcp_server.py`）`Success: no issues found`。

### 5.39 第 38 项：会话级钩子累计（失败率 / 超时数 / 均值 / 峰值）

- 缺口：`hook.run` 到了前端只有 **50 条 FIFO** 的逐帧视图（第 26 项）。一次长会话跑 200 次钩子、其中 3 次超时，早期那 3 条会被挤掉，面板显示"全部通过" —— 排障时把"偶发超时"看成"没发生过"。这是**观察面失真**，不是钩子本身的问题，所以修在读数侧而不是再加一帧。
- 处置：新增纯函数 `apps/web/src/hooks/hook-run-stats.ts`（`HookRunStats` / `EMPTY_HOOK_RUN_STATS` / `accumulateHookRunStats` / `hookRunStatsAverageMs`），`use-agent-runtime.ts` 在 `hook-run` 监听器里**先累计再入 FIFO**，并把 `hookStats` 作为 `UseAgentRuntimeReturn` 一等字段暴露；断流 / 切换 agent 时与 `hookRuns` 同批归零。**不新增 SSE 事件名、不新增后端帧** —— 同一份输入的两个视图，不是第二份真相源。
- 语义边界：按**钩子条目**计数而非帧数（一帧可含多枚）；未知 `status` 计入 `error`（不静默算成功），而解析层对非三态本来就 `fail-closed` 拒帧；`total=0` 时均值为 `0`（不是 `NaN`）；面板只在 `total>0` 出一行，零次不留空噪声。
- 超越轴：对照程序的钩子观测要么只报"最近一次"、要么全局日志；本仓把"趋势（累计）"与"这一次（最近帧）"分层落在同一面板，且累计**不受滚动窗口淘汰**影响。

验证：`pnpm --filter @ihui/web exec vitest run src/hooks/hook-run-stats.test.ts` → `4 passed`（按条目计数 / 跨帧累加保留峰值 / 未知状态不冒成功 / 零条目均值不为 NaN）；`pnpm exec tsc -p <临时 tsconfig 点名四文件>` → 无错误；`check-i18n-keys` / `check-i18n-parity` → 5 语言 `26245` 键 parity OK；`scan-i18n-zh-residue zh-TW` → 无中文残留。

### 5.40 第 39 项：钩子运行审计落盘（唯一观察者出口）

- 缺口：第 26/37/38 项都是**内存态**观察面 —— SSE 下行、前端 50 条 FIFO、会话累计。断开连接 / 进程重启 / 面板刷新之后，"昨天哪个钩子连续超时、哪条命令钩子把耗时从 3ms 涨到 900ms"没有任何可查痕迹，只能靠回忆翻日志。排障缺的是**只追加、可按会话切**的落盘事实。
- 处置：新增 `apps/ai-service/app/core/hook_audit.py`（`HOOK_AUDIT_REL` / `HOOK_AUDIT_MAX_BYTES` / `hook_audit_path()` / `record_hook_run()` / `record_observation()`），并在 `HookEngine.publish_observation` **一个出口**接线 —— 且只在 `event == "hook.run"` 时落。两条腿（agent_loop 与子代理派发）本来就汇到这一处，不需要在每个挂载点各写一份（`借鉴整合、不另造第二套`）。
- 语义边界：载荷与 `hook.run` 逐字同形（`run_id / session_id / tool_name / hooks`），台账行再补 `ts`；空 `hooks` 帧不落（与 SSE"空表不发"同纪律）；落盘失败只 warning、`record_hook_run` 返回 `False`，**绝不冒泡打断钩子下行** —— 审计是观察面的附属品，不能变成新的单点故障；超过 5MB 轮转为 `.jsonl.1`；台账落在 `.ihui-agent/state/`（已在 `.gitignore` 覆盖，不进仓）。
- 超越轴：对照程序要么完全不落盘、要么把钩子日志与 agent 日志混在一份文本里；本仓把"实时帧（SSE）/ 会话累计（前端）/ 落盘审计（服务端）"三层各就各位，且写入口收敛到唯一一处，三层的字段口径天然一致。

验证：`pytest test_hook_audit.py` → `4 passed`（同形落盘 / 空表不写 / 写不进去不冒泡 / 观察出口只认 `hook.run`）；回归 `test_hook_engine.py` 一起跑 → `155 passed`；`ruff check` → `All checks passed!`；`mypy --strict`（`hook_audit.py` + `hook_engine.py`）→ `Success: no issues found`。

### 5.41 第 40 项：`hook-run` 补进严格解析档（少一个事件 = 严格模式悄悄降级）

- 缺口：`parseAgentTaskEventStrict` 的 `strictByEvent` 表登记了 11 个事件，`hook-run` **不在表里**，命中不到 schema 就直接 `return parseAgentTaskEvent(...)` 走宽松工厂。结果同一张"严格表"里少一个事件，**故障帧不会有字段级故障码**，只有 null —— 排障时"字段丢了"和"事件不认识"看起来一模一样。
- 处置：新增载荷面判据 `HOOK_RUN_PAYLOAD_FIELDS`（`run_id / tool_name / tool_call_id / session_id` 可选，`hooks` 必填且 `.min(1)`），并登记进 `strictByEvent`。**刻意不复用带 `type` 的 `HOOK_RUN_FIELDS`** —— 后者是给整个信封造的，`type` 在信封不在载荷，拿它做严格校验会把每一帧都判成缺字段（这正是"表里少一个事件"之外的第二层坑）。
- 语义边界：严格档只负责"缺字段要说得出是哪个字段"；逐条三态/名字仍由 `parseHookRunEvent` 拒帧（未知 status 一律拒收，不冒成功）。两档对**空 hooks** 的态度一致：都判不合格。
- 超越轴：对照实现的"严格/宽容"是全局开关，一开就把不认识的帧全丢掉；本仓按事件逐张字段表登记，**严格档缺失可被单独发现并补位**，且补齐不改变宽松档的既有行为。

验证：`pnpm --filter @ihui/shared exec vitest run src/sse/__tests__/agent-events.test.ts` → `53 passed`（新增 3 例：合法帧严格通过 / 缺 `hooks` 返回 `field='hooks'` 的字段级故障 / 空 `hooks` 同判）；回归 `tests/field-loss.test.ts` → `7 passed`；`pnpm turbo typecheck --filter=@ihui/shared` → `4 successful`；`check-stale-dist` → 无陈旧。

### 5.42 第 41 项：审计台账只读摘要（前端刷新后仍能看见）

- 缺口：第 39 项只给了**写入口**。台账落盘之后，回答"这一轮跑了几次、失败几次"仍要人肉 `tail` 一个 5MB 的 JSONL；而第 38 项的会话累计在刷新页面/重进会话时归零 —— 内存态一清，"刚跑过钩子"这件事就此消失。
- 处置：`hook_audit.summarize_hook_audit(session_id, max_lines)` 只读尾部 `deque(maxlen)` 聚合（避免长会话下随文件增长线性变慢），暴露 `GET /api/agent/hook-audit/summary`（必须登录，台账含 session_id 与工具名）；前端新增 `use-hook-audit-summary.ts` 的 `normalizeHookAuditSummary`（形状收窄，不重算计数），面板在"内存累计为 0"时渲染 `pane-runtime-hook-audit` 一行。
- 语义边界：`available=false`（台账不存在）与"有台账但零条"**分开报**，前端只在真有条目时显示；数字字段逐个校验、负数归 0、三态之和超出 total 直接不呈现（宁可空着也不报错数）；只读尾部 20000 行，`truncated=true` 表示更早的行未纳入聚合；没有会话号时按"本机台账全量"查，文案里写明，不冒充本会话。
- 超越轴：对照实现的钩子观测止于"当前进程内"；本仓把"实时帧 / 会话内存累计 / 落盘摘要"三层串起来，任一层失效时下一层仍能回答同一个问题，且三层共用同一份字段集与同一份判据。

验证：`pytest test_hook_audit.py` → `8 passed`（新增 4 例：按条目聚合 / 按会话过滤 / 台账缺失报 `available=false` / 只读尾部并标 `truncated`）；`ruff check` → `All checks passed!`；`mypy --strict`（`hook_audit.py`）→ `Success: no issues found`；`vitest use-hook-audit-summary.test.ts` → `4 passed`；`check-api-routes` → 通过（新增 0 处死调用）。

### 5.43 第 42 项：审计读数不撒谎（截断判定修正 + 轮转阈值可调可测）

- 缺口：第 41 项的 `truncated` 判据写的是"读到的行数 ≥ 上限"，于是**恰好等于上限**（一行都没丢）也标 `truncated=true` —— 读数把"全量"报成"截过"，正是本轮一直在治的那类"账面与事实不符"。另一半：轮转阈值是常量、5MB 才能触发，等于**没有测试能跑到它**，"超限会不会丢数据"全靠想象。
- 处置：改为累计 `total_lines`，只有 `total_lines > max_lines` 才标 `truncated`；轮转阈值改走 `_max_bytes()`（env `IHUI_HOOK_AUDIT_MAX_BYTES` 可调，坏值 warning 后回落 5MB），于是"写满即轮转、旧行进 `.jsonl.1`"可以用 300 字节的夹具真跑一遍。
- 语义边界：轮转失败仍只 warning、不冒泡；阈值是**字节**不是行数（大 error 串会占更多空间，这是有意的：防的是文件体积，不是条数）；env 坏值不静默吞掉，warning 里带原值。
- 超越轴：对照实现的日志轮转通常只有"按大小切"、没有"切了之后读数怎么解释"；本仓把"轮转"与"摘要的截断自述"成对钉住 —— 一个 APPEND-only 台账必须同时说清"写到哪、读到哪、丢没丢"。

验证：`pytest test_hook_audit.py` → `10 passed`（新增 2 例：恰好等于上限**不标** truncated / 300 字节阈值触发轮转且台账仍可读）；`ruff check` → `All checks passed!`。

### 5.44 第 43 项：钩子读数抽成可测组件（显示优先级只有一份）

- 缺口：第 38/41 项的两条读数（会话累计 / 台账回落）写在 800+ 行面板的 JSX 表达式里，"先会话、后台账、都空则不显示"这条**优先级规则**没有任何测试够得着 —— 一个 `&&` 写反就会出现"同一轮报两遍"，而 typecheck 对此永远绿。
- 处置：抽出 `components/ai/hook-readout.tsx`（`HookReadout` + `HookReadoutTranslate`），规则收进组件内部；面板只负责"要不要渲染它"。均值/峰值仍取 `hookRunStatsAverageMs` 这一份算法，不在组件里再除一遍。
- 语义边界：会话累计 `total>0` 优先；否则台账 `total>0` 才显示；两边都空 ⇒ 返回 `null`（零次不留空噪声）；`t` 由调用方注入（面板传 next-intl 的 `t`），组件本身不依赖 i18n Provider，因而可被 RTL 直接渲染。
- 超越轴：对照实现的读数直接拼在 UI 里，"显示规则"与"数据来源"混在一起；本仓把规则做成纯展示面组件，四条分支（会话 / 回落 / 全空 / 台账零条）各有一条断言。

验证：`vitest src/components/ai/__tests__/hook-readout.test.tsx` → `4 passed`（会话优先不重复 / 台账回落且均值 100ms、峰值 500ms 由同一算法给出 / 两边全空不渲染 / 台账零条不冒充跑过）；定向 `tsc` 五文件无错误。

### 5.45 第 44 项：台账"只读到尾部"必须在读数上标出来（truncated 不许被吞）

- 缺口：第 42 项把后端 `truncated` 的判定改成「台账总行数 > 读取上限」（恰好等于上限不再误报），可第 41 项的前端收窄只收了六个计数，`truncated` / `linesRead` 被直接丢掉 —— 于是「两万行之后还有历史」和「全量」在面板上长得一模一样，用户会把截断后的尾部当成"这一轮没跑过"。这正是第 42 项在账面上治过、展示面又漏回来的同一类问题。
- 处置：`use-hook-audit-summary.ts` 新增 `HookAuditStats = HookRunStats & { truncated, linesRead }`，`normalizeHookAuditSummary` 显式收下两格（`truncated` 只认字面 `true`，字符串/缺失一律按未截断 —— 失效方向恒为"少标一次"）；`HookReadout` 只在截断时追加 `runtimeHookAuditTruncated`（`{lines}` = 实际读到行数），未截断的台账不许多带一个"仅尾部"。
- 语义边界：截断只说明**覆盖范围**，不改写已读到的计数 —— 面板仍按 `total` 显示三态与均值/峰值；`linesRead` 不许冒充 `total`。
- 测试卫生：本文件此前没显式 `cleanup()`，新增用例时实测到「Found multiple elements」（vitest 未开全局 auto-cleanup，上一例的 DOM 留在 body 里）；补 `afterEach(cleanup)` 后 6 例各自隔离。
- 超越轴：对照实现的统计面板把"截断/全量"混在同一句文案里；本仓把可信度做成类型字段 + 独立 testid（`pane-runtime-hook-audit-truncated`），截断/未截断/坏值三态各有一条断言，靠机器锁住而不是靠文案自觉。

验证：`vitest src/components/ai/__tests__/hook-readout.test.tsx src/hooks/use-hook-audit-summary.test.ts` → `12 passed`（截断显示 TAIL:20000 / 未截断无标记 / `truncated:"true"` 字符串按未截断 / 计数仍按 total 呈现）；i18n 五语言新增 `runtimeHookAuditTruncated`（JSON 复核过 `ai.pane` 段）。
### 5.46 第 45 项：轮转后的"当前台账为空"不许冒充"从没跑过"（备份字节进读数）

- 缺口：`_rotate_if_needed` 到 5MB 就把台账挪到 `<台账>.1`,下一次轮转直接覆盖上一份 —— 轮转刚发生时当前文件是空的,`summarize_hook_audit` 只读当前文件 ⇒ `total=0`,而前端把 `total=0` 归成 `null`(什么都不显示)。于是"历史被轮转走了"和"钩子从没跑过"在面板上一模一样,**静默丢历史**比报错更难发现。
- 处置：摘要新增 `backupBytes`(`<台账>.1` 的字节数,`null` = 没有备份;stat 失败也只回 `null`,不折成 0);前端 `HookAuditStats` 收下这格,`normalize` 在"当前台账不可用但备份还在"时**不归 null** 而是返回 `total=0 + backupBytes`,并把 `available!==true` 时的计数强制为 0(不给不存在的台账编数)。
- 展示：`HookReadout` 在 `total=0 ∧ backupBytes>0` 时只渲染一行"当前台账为空,仅存历史备份 {kb} KB"(独立 testid `pane-runtime-hook-audit-history-only`),不画三态计数;有计数时(常态)不出这行,避免两句话互相矛盾。
- 语义边界：备份只报"存在与体积",**不读它的内容**——把它也聚合进来会让摘要耗时随历史线性增长,而且 `.1` 只保留一代,读它反而制造"历史是全的"错觉。字节数是"还有多少没被计入"的下界,不是精确行数。
- 超越轴：对照实现的台账轮转后只剩"空表",没有任何"历史还在"的信号;本仓把备份存在性当成一等读数(后端 stat + 前端类型 + 独立断言),三态(无备份 / 有备份零计数 / 有备份有计数)各一条测试。

验证：`pytest tests/test_hook_audit.py` → `12 passed`(轮转后当前文件缺失仍报 backupBytes>0 / 无备份回 None);`vitest hook-readout + use-hook-audit-summary` → `15 passed`(备份零计数报 HIST:40 / 无备份仍归 null / 有计数不显示"仅历史");`mypy --strict app/core/hook_audit.py` 与 `ruff check` 均通过。
### 5.47 第 46 项：钩子错误文本落盘前脱敏（台账不许变成凭据仓库）

- 缺口：`hook.run` 里的 `error` 就是钩子进程的 stderr（`hook_engine` 会截到 `HOOK_FAILED_STDERR_MAX` 直接上抛），而第 39/41 项把它**原样**写进 `.ihui-agent/state/hook-audit.jsonl`。钩子最常见的失败姿势恰恰是把命令回显进错误里——`OPENAI_API_KEY=…`、`Authorization: Bearer …` 会在磁盘上长期留存，且这条文件比日志活得更久（5MB 轮转）。日志/输出层已有脱敏闸，台账这条腿此前没接。
- 处置：`_extract` 在构造落盘记录时对 `error` 调 `app.core.output_cleaning.redact_secrets`（与 `main.py` 凭据收口闸同一份判据，§0.6 单源，不另写正则）。非字符串/空串原样返回；非凭据部分保留（`failed` 等排查信息不许一起吞）。
- 语义边界：只脱敏 `error` 字段；`name`/`kind`/`status`/`durationMs` 是结构字段，不做文本处理。脱敏在**落盘前**，不是在读取时——读取时脱敏等于把明文已经落过盘。
- 测试：`test_error_text_is_redacted_before_persisting` 用 `OPENAI_API_KEY=sk-live-…` 造错误行，断言台账里没有明文、含 `[REDACTED_SECRET]`、且 `failed` 仍在。

验证：`pytest tests/test_hook_audit.py` → `13 passed`；`mypy --strict app/core/hook_audit.py` 与 `ruff check` 通过。
### 5.48 第 47 项：新增帧的端能力缺口不许静默（hook-run 六端按档登记）

- 问题：第 26/37 项把 `hook-run`（钩子运行结果）接进 SSE 后，`config/agent-event-end-capability.json` 只描述了旧帧。端能力门（`scripts/check-agent-event-parity.mjs`，判据住 `scripts/lib/agent-event-coverage.mjs`）按档案逐端核对"后端生产、该端是否消费"，档案里没有 `hook-run` 也没登记缺口 ⇒ 六端（miniapp-taro / mobile-rn / packages/app / extension / desktop / cli）各报一条"未消费且档案未登记"，共 12 行（每端正反两段各一遍）。门给的两条出路里，"补该端消费"在本轮不成立（这些端没有钩子运行 pane），正解是按同一口径**显式登记为已知缺口**。
- 处置：六个 profile 的 `knownGaps` 各登记 `"hook-run"`，`reason` 追加一句"后端新增帧、本端暂无消费面 ⇒ 按同一口径显式登记、不静默"，`until` 沿用同组 `2026-12-31`。登记不等于生效：到期要么补消费面，要么删条目（门的 until 过期判红就是干这个的）。
- 语义边界：`events`（声明已接）与 `knownGaps`（承认未接）必须二选一，不许两边都写；本次只动 `knownGaps`，已接清单一行未改 —— Web 侧经 `use-agent-runtime` 已有 `hookRuns`/`hookStats` 消费，不在缺口之列。
- 验证：`node scripts/check-agent-event-parity.mjs` 的"端能力缺口"行从 12 降为 0（`hook-run` 这一族清零）；该门剩余 8 行"字段面断裂"属别席既有提交（chunk / error / fallback / reasoning / tool-approval / tool-call-args-delta 的声明键与解析面读点口径），与本项无关，未动其判据 —— 本门未接提交链，此 8 行不阻塞任何落地。
### 5.49 第 48 项：钩子明细块搬出面板（最近一帧的三态读数有了组件级断言）

- 问题：第 26 项把 `hook.run` 的逐钩子明细直接写在 `agent-task-progress-pane.tsx` 的 JSX 里（约 800 行面板的一角），三态文案 `hookStatusLabel` 与配色也定义在面板的渲染作用域内。结果是：`pane-runtime-hook-runs` 这个 testid、`data-hook-status` 逐行读数、错误文本只在出错条出现，全都没有组件级断言 —— 任何一次 JSX 重排都可能在无人察觉时把"哪条超时、哪条报错"读错。
- 处置：新增 `apps/web/src/components/ai/hook-run-detail.tsx` 的 `HookRunDetail({ run, t })`，把明细块的布局、三态文案、三态配色、`data-hook-status` 一并收进组件；面板只剩 `{lastHookRun && <HookRunDetail run={lastHookRun} t={t} />}`，`hookStatusLabel` 与 `Webhook` 图标导入同步删除（不留第二份）。类型直接取共享层的 `AgentHookRunEvent`（§0.6 不另造一份帧形状）。
- 语义边界：明细块仍只呈现**最近一帧**（一帧即同一次工具调用的全部钩子），跨帧累计留在 `HookReadout`；两块分工不变，不重复计数。
- 测试：新增 `__tests__/hook-run-detail.test.tsx` 4 例 —— 标题带工具名与**条目数**（不是帧数）；逐行 `data-hook-status` 顺序与三态文案一一对应；错误文本只挂在出错那条、正常条目不出 `null`；`toolName` 缺失时用 `—` 占位而不是空白（空白会被读成"没跑钩子"）。

验证：`vitest run hook-run-detail.test.tsx hook-readout.test.tsx use-hook-audit-summary.test.ts` → `19 passed`（15 旧 + 4 新）；`watermark verify` 覆盖 1/1。`@ihui/web` 全量 typecheck 当前红点是别席在飞文件 `send-message.ts` 的 `reasoningEffort`（不在本项文件面），本项三文件无 TS 报错。
### 5.50 第 49 项：台账容量要报出来（轮转到 5MB 会覆盖唯一备份）

- 问题：`hook_audit` 只保留"当前台账 + 一份 `.1` 备份"，到 5MB 轮转时旧备份被直接覆盖 ⇒ 之前的钩子历史永久消失。但后端摘要只报了 `total/ok/timeout/error/truncated/linesRead/backupBytes`，**当前文件多大、上限多少**都不在读数里：面板只能看到"跑过 N 次"，看不到"再写一点就没有历史了"。
- 处置：`summarize_hook_audit` 增报 `sizeBytes`（当前台账字节，stat 失败/不存在 ⇒ `null`，不折 0）与 `maxBytes`（`_max_bytes()` 的现读值）；前端 `HookAuditStats` 收下两格，`normalizeHookAuditSummary` 只认正有限数（`0` 按 `null`，"还没写"不许画成 0%），`HookReadout` 用 `nearFullPct` 在 **≥90%** 时报一行 `runtimeHookAuditNearFull`（整数百分比，封顶 100），低于 90% 不打扰；任一格取不到 ⇒ 不判（不拿 0 当"没满"）。
- 语义边界：容量是"历史还能留多久"，不是"性能"；不触发轮转、不改 `HOOK_AUDIT_MAX_BYTES` 默认值，只把已有事实搬进读数。轮转本身仍由写入路径决定。
- 测试：后端新增 2 例（`maxBytes` 与 `sizeBytes` 实测且能对账文件大小 / 台账缺失时 `sizeBytes` 为 `None` 而 `maxBytes` 仍是整数）；前端新增 2 例（95% 报 `runtimeHookAuditNearFull:92`、低于 90% 与容量未知都不出现），并补齐既有 fixture 的两格。

验证：`pytest test_hook_audit.py` → `15 passed`；`vitest run hook-readout / use-hook-audit-summary / hook-run-detail` → `22 passed`；`mypy --strict app/core/hook_audit.py` 与 `ruff check` 通过；`check-i18n-keys` → 5 语言 parity OK（新键 `runtimeHookAuditNearFull` 已在 zh-CN / en / zh-TW / ja / ko 同批落地）。
### 5.51 第 50 项：推理档位在号池腿上被静默丢弃（契约字段有、执行链断一跳）

- 问题：`UpstreamForwardRequest.reasoningEffort` 早在渠道路径就声明了（`relay-upstream-forwarder.ts` 注释写明"reasoning_effort 透传，账号池由适配器映射到平台专有键"），HTTP 那条腿（`ai-chat-stream.ts`）也在传；web 客户端 `sendRelayChat` 的调用点同样已经把 `reasoningEffort` 递进去。唯独 WS 号池腿（`ws-relay-chat.ts` 的 `forwardToChannel` 调用）**没读帧里的这个键**——于是用户在号池模型上选的推理档位被静默忽略，而类型系统因为选项接口没声明该字段，把这件事报成了一行 `TS2353`，看起来像"web 写错了"，实际是**中间一跳缺读点**。
- 处置：把这一跳补齐，而不是删字段（删掉等于承认"号池永远按默认档"，与 `UpstreamForwardRequest` 的既有承诺相反）。`StreamRelayChatOptions` 增 `reasoningEffort?: string`（注释写明下行键名按 snake 写、`undefined` 不发键）；`sendChat` 的 chat 帧按需追加 `reasoning_effort`；`ws-relay-chat.ts` 在转发调用里按 `typeof frame.reasoning_effort === 'string'` 取值传给 `reasoningEffort`。
- 语义边界：三处都只做"有值才传"——空串/`undefined` 不上行、不落成 `''`（空串到适配器会被当成"显式低档"，比不传更糟）。字段名一律 `reasoning_effort`（下行）/ `reasoningEffort`（TS 面），不另造第二套名字（§0.6）。
- 测试：`relay-chat-stream.test.ts` 新增一例双向牙（表态 ⇒ 帧内 `reasoning_effort='high'`；不表态 ⇒ 整键缺席）；`ws-relay-chat.test.ts` 新增一例（真 WS 帧带 `reasoning_effort` ⇒ `forwardToChannel` 收到的 `reasoningEffort` 为 `'high'`，缺省时为 `undefined`）。

验证：`vitest run src/lib/__tests__/relay-chat-stream.test.ts` → `9 passed`；`@ihui/api` 的 `ws-relay-chat.test.ts` → `11 passed`；`node scripts/check-typecheck.mjs` → 全量 TS + mypy 通过（`exit=0 elapsed=214.5s scopeFiles=6302`），此前阻塞全仓推送的 `send-message.ts:1041 TS2353` 随之消除。
### 5.52 第 51 项：台账容量只进面板、不进守护（"没人在看"就是历史消失的唯一原因）

- 问题：第 49 项把容量占比搬进了面板，但面板只在**有人打开会话**时才看一眼；`hook_audit` 到 5MB 轮转时 `.1` 会被**下一次轮转**直接覆盖，那段历史永久消失。也就是说：读数存在 ≠ 会有人看见 ⇒ 缺的是守护侧的那条腿。另外两型同样没有哨兵：写盘被中断/并发撕裂产生的坏行（审计读数里静默丢事件）、以及某条钩子连续挂掉（单条失败正常，近半都在挂就值得人看一眼）。
- 处置：新增 `scripts/check-hook-audit-health.mjs`（只读尺子）。上限**不抄数字**：从 Python 唯一源头 `apps/ai-service/app/core/hook_audit.py` 现读 `HOOK_AUDIT_MAX_BYTES` 的字面表达式（只接受 `数字 * 数字 …` 形态），读不到 ⇒ exit 2 未判定，绝不回落硬编码；台账路径与 `hook_audit_path()` 同口径（env `IHUI_HOOK_AUDIT_PATH` 优先）。四判据：容量 ≥90%、坏行枚数、近 50 条里 `error+timeout ≥30%` 且至少 5 条、以及台账不存在时判 `absent`（一次钩子都没跑过是合法形态，不记绿也不冒红）。在 `guardian-runner.mjs` 登记为 **warn** 档（id `326`）、不挂 `stagedTriggers`；周期派发点由第 53 项补在 `git-guardian`（见 §5.54 —— 这句话原先只是声明，实测无人调度）。
- 语义边界：90% 与前端 `HookReadout.nearFullPct` **同一个档**——两处读数不同档会让人不再信任何一处；`warn` 不出邮件告警（§5e-1：红了人的动作是"去看哪条钩子在挂"，不是运维故障；告警通道仍只有邮件一条，不被这类存量读数占用）。
- 测试：`scripts/tests/check-hook-audit-health.test.mjs` 4 例 —— 上限从 Python 源头现读且判定层无硬编码字节字面量（形状锁切掉 `selfTest` 夹具段）；近满档与 web `nearFullPct` 数值相等；三态与阈值（单条失败算 healthy、20 条里 10 条失败算 warn、容量 ≥90% 必须给可执行下一步、上限取不到算未判定）；装车证明（`guardian-runner` 里登记为 warn、无 `stagedTriggers:` 属性、带应急跳过变量）。器物自带 `--self-test` 9 例。

验证：`node scripts/check-hook-audit-health.mjs --self-test` → `9/9`；`node --test scripts/tests/check-hook-audit-health.test.mjs` → `4 passed`；真机实跑 → `结论 absent`（本机尚未跑过钩子，属合法形态）、exit 0；`guardian-runner --help` 门数 359→360。
### 5.53 第 52 项：失败率恒为 0（读数读过一层）+ "按 slowestMs 定位钩子"是空头路径

- 问题：第 51 项自己踩了两个坑，都在"读数把人读错"这一型里：
  ① 失败率读的是 `row.status`，而真实台账行是**一帧一条**、`status` 在 `hooks[]` 里 ⇒ 顶层永远没有这个键，失败率恒为 0、那条"越线"的判据一次都不会响（上一轮真机 `absent` 掩盖了它，`--self-test` 用的是扁平夹具也掩盖了它 —— 夹具与真实行形不同，等于没测）。
  ② 门体 warn 文本写"先按 `summarize` 的 slowest/lastTs 定位是哪条钩子"，但 `slowestMs` **只有一个毫秒数、没有钩子名** ⇒ 这是一条跑不通的出路（§0.8）。`summarize_hook_audit` 也确实没报"哪条最慢/哪条在挂"。
- 处置：`failRate` 改成按 `hooks[]` 计数（窗口仍按行取，计数按钩子算）；新增 `blameHooks()` 从台账原始行汇总逐钩子的 `失败数/总数/最慢毫秒`，warn 文本直接落钩子名（`失败最多的是 lint-on-edit(失败 10/20,最慢 30ms)`）。**没有往 Python 加第二套聚合**：原始行里 `name/status/durationMs` 都在，为读一个名字再造一层聚合就违背 §0.6。
- 语义边界：只点名**失败过**的钩子（按失败数、再按最慢毫秒排序，最多 3 条）；零失败时不出这一段，不让"最慢但一直成功"的钩子冒充故障。
- 测试：`--self-test` 增 `7b`（夹具改用真实行形：`ts/toolName/hooks[]`）10/10；镜像测试 ③ 改用真实行形并三条断言 —— 失败率按钩子计 20 条里 10 条失败、`blameHooks` 必须点名 `lint-on-edit`、warn 文本里必须出现钩子名。

验证：`node scripts/check-hook-audit-health.mjs --self-test` → `10/10`；`node --test scripts/tests/check-hook-audit-health.test.mjs` → `4 passed`。
### 5.54 第 53 项：门登记进 runner ≠ 会跑（"走周期派发"是没被验证过的一句话）

- 问题：第 51 项把哨兵登记进 `guardian-runner.mjs` 的 warn 档，并在注释/文档里写"不挂 `stagedTriggers`，走周期派发"。实测这句话**不成立**：`guardian-runner.mjs` 只有两处调用点 —— `.husky` 的 pre-push（`--push-gate` 只跑 T1 集合）与人工全量档；常驻的 `git-guardian --daemon`（`\IHUI-AI git-guardian` 计划任务 + `IHUI-GIT-GUARD` 服务，2 分钟一轮）**从不执行它**。于是"没设 stagedTriggers 的门"等于零派发 —— 尺子造好了，永不自行看台账。这正是 §0.9「造好没装车 = 没有」：登记进注册表只是"被列出来"，不是"被执行"。
- 处置：在 `git-guardian.mjs` 新增 `auditHookAuditHealth()`（唯一的周期调度器）+ 节流常量 `HOOK_AUDIT_HEALTH_INTERVAL_MS = 30min` + 节流戳 `.ihui-agent/state/hook-audit-health-last.json`，并按本仓既有双挂点纪律挂在 **daemon tick 与 main 单轮两处**（共用一枚节流戳 ⇒ 并存时只有先到那个真跑，不翻倍派生）。派生一律 `windowsHide: true` + `stdio` 显式接管 + 90s 上限（§5b / §12g / 守门 80）。
- 语义边界：**不发信**（§5e-1）—— 红了人的动作是"修挂掉的那条钩子 / 把要留的历史另存"，是开发动作不是运维故障，日志即够；`healthy`/`absent` 静默、`warn` 逐行打印门体结论、`undetermined` 只记日志不记绿（§0.3）。另外同批发现并修掉一堵墙：改了 `guardian-runner.mjs` 后 `root-guard` 清单与规则文件脱钩、部署环会 fail-closed，按既有口径 `--seal` 重封并单独成枚提交。
- 测试：镜像测试增第 ⑤ 例 —— 巡检函数必须导出、`git-guardian` 里**恰好两个** `auditHookAuditHealth()` 挂点（少一处 = 计划任务档禁用后常驻守护永不判）、带节流常量、函数体里不许出现 `notifyGuardRed`（防有人把它接进告警通道）。

验证：`node --check scripts/git-guardian.mjs` 通过、`import` 后 `typeof auditHookAuditHealth === 'function'`；真跑一轮（临时节流戳）→ 日志 `ℹ️ 台账尚未建立(一次钩子都没跑过,不算故障)`、返回 `{"ran":true,"state":"absent"}`；`node --test scripts/tests/check-hook-audit-health.test.mjs` → `5 passed`；`node scripts/root-guard.mjs --check` 全 PASS、`check-root-guard-manifest-sync` 判「同面自洽」。
### 5.55 第 54 项：同一句自述的第二个受害者（325 号门也零派发）

- 问题：第 53 项修的是 326 号门。顺手按同一判据扫了全仓"自述有周期派发"的登记，命中只剩两处：325（临时派生检出寿命闸）与 326（本次新增）。325 的注释写着「走 guardian 周期派发（与 keepalive 一型）」，而 `git-guardian.mjs` 对 `check-temp-worktree-lifetime.mjs` **零引用** —— 与 326 是同一个病：注册表里"列出来"被当成"会跑"。它要防的是 scratch/Temp 里静默≥24h 或账龄≥48h 的残留检出（§12d 停用 worktree 后的清理腿），没人派发就等于这道门不存在。
- 处置：`git-guardian.mjs` 新增 `auditTempWorktreeLifetime()`（唯一调度器）+ `TEMP_WORKTREE_LIFETIME_INTERVAL_MS = 1h` + 节流戳 `.ihui-agent/state/temp-worktree-lifetime-last.json`，同样双挂点（daemon tick + main 单轮）。解析尺子的 `--json`：`hits` 超阈残留逐条点名 + 给 `git worktree remove --force && prune` 出路，`orphans` 给 `git worktree prune`；`ok` 且零命中静默；结论不可用 ⇒ 未判定（§0.3）。**绝不自动回收**（§12d：命中只让归属席自决）。
- 语义边界：节流 1 小时（老化阈值是天级，分钟级刷新没有信息增益）；不发信（属归属席动作，走日志）。
- 测试：镜像测试增第 ⑥ 例 —— `auditTempWorktreeLifetime()` 必须恰好两个挂点、带节流常量、`guardian-runner` 里 325 的旧自述"走 guardian 周期派发(与 keepalive 一型)"必须已被替换成点名真实调度器（§0.8：不写跑不通的出路）。

验证：`node --check scripts/git-guardian.mjs`；真跑一轮（临时节流戳）→ `{"ran":true,"state":"ok"}`（射程内 0 条超阈、0 条孤儿）；`node --test scripts/tests/check-hook-audit-health.test.mjs` → `6 passed`。
### 5.56 第 55 项：第三把尺子同一型 + 三份派发实现收敛为一份

- 问题：按"自述被守护派发"把全仓 `scripts/*.mjs` 扫了一遍（粗筛 + 逐条人工复核上下文），命中第三处：`check-miniapp-mirror-fidelity.mjs` 头注写着「根 package.json `check:mirror-fidelity` + git-guardian 巡检轮派发」，而 `git-guardian.mjs` 只在**一条注释**里提到文件名、没有任何派生点 —— 自述的那条巡检轮不存在，存量缺口 avg≈24% 的读数因此只在下线时被人手动敲一次。同时暴露另一个问题：第 53/54 项各抄了一份"存在性→节流→派生→解析→三态日志"，第三把尺子再抄就是第三种口径（§3 零冗余）。
- 处置：先抽 `runReadoutGate(spec)` 统一实现（JSON `state` 优先、退到 stdout `state=`、再退到退出码；`ok/healthy/absent` 静默、其余逐行打印门体结论、拿不到结论记 `undetermined`；派生带 `windowsHide` + 显式 `stdio` + 90s 上限），再把三把尺子各写成 10 行的 spec 包装器，全部双挂点（daemon tick + main 单轮）。`check-miniapp-mirror-fidelity` 只进守护侧周期读数、**不进** pre-commit/pre-push（§12e：判机器存量的门不许进提交链）。
- 语义边界：门体文本原样透传 —— 可整改动作在尺子自己那句结论里，守护侧不另写一套出路（§0.6 不造第二份判据）；三把尺子的节流窗各自独立常量（30min / 1h / 1h），不共用一个"魔法数"。
- 测试：镜像测试增第 ⑦ 例 —— 三个包装器各有**恰好两个**挂点、每个包装器体都必须是 `return runReadoutGate({`（防有人回头各抄一份）、`check-miniapp-mirror-fidelity.mjs` 的自述仍在（说明本项补的是它的落点）。

验证：`node --check scripts/git-guardian.mjs`；真跑一轮 `auditMirrorFidelity`（临时节流戳）→ `{"ran":true,"state":"ok"}`；`node --test scripts/tests/check-hook-audit-health.test.mjs` → `7 passed`。
### 5.57 第 56 项：刚接通的派发器有三个读数空洞（结论形态、整行灌日志、上限口径）

- 问题：第 55 项把三把尺子收敛到 `runReadoutGate` 后，用真台账做一次 warn 路径的实测（env 把上限调到 2048 字节制造近满 + 20 条里 10 条失败），暴露三处：
  ① 派发器只认 `state=<x>`，而钩子审计尺子的头行是 `[hook-audit-health] 结论 warn` ⇒ 每次 warn 都被记成"结论不可用/未判定"，读数方向正好反了；
  ② 尺子的 `report()` 把 `ledger.lines`（**整行数组**）插进事实行，一行台账可以有几 MB（钩子 error 截断上限很大）——实测真机输出 4.7MB，等于把守护日志撑成噪音源；
  ③ 尺子只读 Python 常量、不认 `IHUI_HOOK_AUDIT_MAX_BYTES`，而 Python `_max_bytes()` 认 env ⇒ 有人把上限调小时，面板与守护各说一套。
- 处置：① `runReadoutGate` 的文本回退同时匹配 `state=` 与 `结论 <x>`；② 尺子只报 `ledger.lines.length`（行数），派发器对每行门体日志再做 400 字符截断（超出附原长）；③ 新增 `resolveCap(env, srcCap)`：env 正数优先、坏值回落到源头常量，`main()` 走它。
- 语义边界：截断只作用于**日志**，不改门体结论；`report` 的容量/失败率关键数字一行不动。
- 测试：`--self-test` 增 `自检10`（env 覆盖/坏值回落/缺省三档）与 `自检11`（9 万字节单行台账 ⇒ 报告总长 < 3000 字符，实测 71）→ `12/12`；镜像测试增第 ⑧ 例（源头里必须同时出现 `结论 <x>` 回退、400 字截断、`ledger.lines.length`、`resolveCap`）。

验证：真机 warn 路径实测 —— 日志四行（结论 warn / 容量 100% 给"先另存或调大上限" / 失败 10/20 点名 `lint-on-edit`）、返回 `{"ran":true,"state":"warn"}`；`node --test scripts/tests/check-hook-audit-health.test.mjs` → `8 passed`。
### 5.58 第 57 项：守护派发面的第六处没人看，而它刚好断了一根真线

- 问题一（measurable）：`check-gate-wiring.mjs` 只对五处权威接线点核对（runner 的 `script:` 值、pre-commit-hook.js、其余 husky、根 package.json、CI）。「头注自称走 git-guardian 周期派发、`git-guardian.mjs` 却零引用」这一型**不在任何候选面上** —— 第 53/54/55 项三处都是这么活下来的。
- 问题二（live red）：把上面这条做成尺子后，第一轮就抓到 `check-ip-attribution-trust.mjs` 的「调度面 = git-guardian 巡检轮」。顺着查，它的 lib 审计层、镜像测试都在，而 `git-guardian.mjs` 里的 `from './lib/ip-attribution-trust-audit.mjs'` 与巡检轮调用**被一次并发合并整层摘掉** —— 镜像测试 ⑥「接线锁」当场翻红，全仓却没有一道门看得见这一面。
- 处置：
  ① 新只读尺子 `scripts/check-guardian-dispatch-claims.mjs`：扫门体**头部注释区**的肯定式声称（自称 本门/本器/本件 或直接写本体文件名），兑现面 = `git-guardian.mjs` **剥注释后的代码面**出现该 basename，另加**一跳**（git-guardian 直接 import 的 lib 也算派发面，worktree 回收就是 lib 里 spawn 的这一型）。精度优先：描述别人的脚本、描述守护自身节律、条件式（前提/若/如果）、否定式（未接/尚未/零调用点）一律不判 warn；枚举到 0 声称 ⇒ undetermined。
  ② 复原 IP 归属信任巡检：`git-guardian` 补 import + `auditIpAttributionTrust` 包装器 + main/daemon 双挂点，`alertId` 与 severity 原样透传给 `notifyGuardRed`（防薄接线吃掉去重身份）。
  ③ 新尺子本身也走同一派发器：`auditDispatchClaims` + `DISPATCH_CLAIMS_INTERVAL_MS = 6h` + 双挂点。
- 语义边界：新尺子只量第六处，不重复 `check-gate-wiring` 的任何判断（R1/R4 的候选集一字未动）；只读、warn 档、不进提交链（§12e）。
- 测试：`node scripts/check-guardian-dispatch-claims.mjs --self-test` → `8/8`；镜像测试 `scripts/tests/check-guardian-dispatch-claims.test.mjs` → `8 passed`（含精度四型、射程只到头部、段落归并、本尺子自身接线锁、IP 巡检接线复原锁）；`scripts/tests/ip-attribution-trust-audit.test.mjs` 由 `# fail 1` 转 `7 passed`。
- 真机验证：`node scripts/check-guardian-dispatch-claims.mjs` 修前 `结论 warn`（声称 14 / 已接线 10 / 诚实说明 3，真缺口 1 枚 = IP 归属信任）；`auditIpAttributionTrust()` 真跑返回 `state=ok`（config 未设本键 ⇒ 全部条目属回环/私网），`auditDispatchClaims()` 真跑返回 `state=warn` 并把那枚缺口逐行点名。
### 5.59 第 58 项：感知腿名义四源、实际一源（三源的生产器零调度）

- 现场（现读，不是推测）：`.ihui-agent/state/incident-signals.jsonl` 37 行按 `source` 分组 —— `deploy_outcome` 37 / `api_logs` 0 / `grafana_alert` 0 / `user_feedback` 0。契约 `scripts/data/incident-signal-contract.json` 的 producers 段登记了四个来源，而 `scripts/monitor-signal-intake.mjs`（三源唯一生产器）全仓零调度点：它的 CLI 默认 dry-run，`--apply` 才落账 ⇒ 没人带 `--apply` 跑过，所以台账里那三源一条都没有。`user-feedback-intake.mjs` 同样零调度、且缺导出配置（真跑 `undetermined`）。
- 处置：`git-guardian` 增 `dispatchMonitorSignalIntake()` —— 30 分钟节流（`IHUI_MONITOR_INTAKE_INTERVAL_MS`）、`IHUI_GUARDIAN_DISABLE_MONITOR_INTAKE=1` 可关、`--apply --json` 落账、10 分钟超时、main 单轮与 daemon tick 双挂点；只把最后一行结论进日志，不寄信、不改守护退出码（感知腿的沉默归 `check-autonomy-leg-health` 的 A8/A9 另量，§12e）。器物头注补点名真实调度器，防它变成下一枚「自述有人调度」。
- 语义边界：三源全部未判定时器物 exit 2 ⇒ 派发器记 `ok=false` 并**照原样点名**（不折成"跑成功"）；源未判定不影响其他源；去重仍由器物自己的 `identityOf` 完成，与 `deploy_outcome` 共用一本台账，不新建第二份。
- 真机验证：修前 `incident-signals` 三源 0 行；`dispatchMonitorSignalIntake()` 真跑返回 `{ran:true, ok:false}`，日志逐字 `未判定:三个监控源全部未判定(没有任何可判定面)` —— 这是因为 `scripts/data/auto-triage-config.json` 的 `apiLogs.jsonl` / `grafanaAlerts.url` 皆空、也没有 `userFeedback` 键，本机缺导出与 Grafana 地址；派发点补上后这条缺口从"静默"变成"每 30 分钟点名"，配好取数面即产出。
- 测试：`node --test scripts/tests/monitor-signal-intake-dispatch.test.mjs` → `7 passed`（装车/`--apply`/双挂点/节流三态/器物缺席不写戳/头注点名）。
### 5.60 第 59 项：新派发腿没进"黑腿探测器"，而它自己的镜像测试有状态泄漏

- 问题一（measurable）：`scripts/data/autonomy-leg-liveness.json` 的候选集 = 盘上所有 `*-dispatch-last.json`，盘上有而本表没有 ⇒ `unregistered` 点名（覆盖面自证）。第 58 项新挂的 `monitor-signal-intake-dispatch-last.json` 落盘后就会进这张点名单 —— 新腿不受探测量，等于把"是否在跳"交给记忆。
- 问题二（live）：第 58 项的镜像测试用固定 tick 文件名，第一次跑留下戳，第二次跑就撞 30 分钟节流窗口 ⇒ `⑦ ran` 断言翻红。这不是实现缺陷，是测试自身带状态。
- 处置：① `autonomy-leg-liveness.json` 增 `monitor-signal-intake` 那条（owner=`dispatchMonitorSignalIntake`、envVar=`IHUI_MONITOR_INTAKE_INTERVAL_MS`、nominal=1800000 与源默认值逐字一致、ruler=器物、verifiedAt=2026-11-21），并写明 knownBlocker：三源取数面皆空 ⇒ 每轮 three-source-undetermined 属预期，探测器量的是戳是否在跳而非产出。② 测试改为每次运行生成唯一 tick 后缀，连跑两遍都 7/7。
- 语义边界：不新增探测器、不改判据；`knownBlocker` 只作解释，不参与判定 —— 静默仍会被 A8 量到。
- 验证：`node --test scripts/tests/monitor-signal-intake-dispatch.test.mjs` 连跑两次均 `7 passed`；登记后 A8 的 `unregistered` 名单里不再出现 `monitor-signal-intake`（落地前按 HEAD 面仍列旧账，落地后即消）。
### 5.61 第 60-61 项：两条真派发腿不在登记表，而登记表的覆盖面自证结构上看不见"还没跑过的腿"

- 现场（第 60 项）：A8 现读 `unregistered=2 ｜ api-liveness / tmp-bloat`。两条都是 `git-guardian.mjs` 里真在跑的派发器（`sweepApiLiveness` 5 分钟、`auditTmpBloat` 5 分钟，均无 env 覆盖），盘上有戳、登记表没条目 ⇒ 它们不受静默探测量。
- 结构缺口（第 61 项）：`classifyLegs` 的覆盖面自证只拿**盘上的戳**与登记表对账 —— 一枚新挂的派发器在它跑过之前盘上没有戳，于是"登记表静默漏掉一条真腿"这一型永远看不见。这正是 60 项那两条腿漏过去的机制，不是一次性手误。
- 处置：① 补登记两条腿（owner=派发函数、nominal=源默认 300000、ruler=器物、verifiedAt=今天，并写明 knownBlocker）。② `scripts/lib/autonomy-leg-liveness.mjs` 增 `findDispatchStampsInSource(src)` + `judgeRegistryCoverage({sourceStamps, legs})`：源面（`git-guardian.mjs` 源码）里的 `*-dispatch-last.json` 字面量，源里有而表里没有 ⇒ drift 并逐枚点名；表里有而源面没有 ⇒ 只点名不判红（tickFile 可能由变量拼装，失效方向恒为"多要一次说明"）。③ `check-autonomy-leg-health.mjs` 的 A8 取料层按同一被审面读 `git-guardian.mjs`，把 coverage 并进同一条维度读数；源面读不到 ⇒ unjudged，不读成"源面没有派发器"。
- 语义边界：不新增第二份登记表、不复算节律；`missing` 与盘上 `unregistered` 同档（都是"无人认领"），`orphan` 只是提示。
- 验证：`node scripts/check-autonomy-leg-health.mjs` 落地前 `unregistered=2`，登记后 `腿 16 枚 ok=16 unregistered=0 ｜ 源面:源面 16 枚 / 登记 16 枚`；`scripts/tests/leg-registry-coverage.test.mjs` 6 passed（含"盘上无戳也能抓到新腿"的集成例）；`autonomy-leg-liveness.test.mjs` + `autonomy-leg-health-output.test.mjs` 22 passed。
### 5.62 第 62 项：只挂 main 面的派发腿，常驻持锁时等于零派发

- 现场：`node scripts/check-sweeper-liveness.mjs` 现读 `dispatch-parity state=stalled`，真名单里 `sweepGiteeAssetBackfill` 的戳 `gitee-backfill-tick.json` 冻结 127 分钟且**不在 daemon tick 面**。成因与 2026-11-03 那次 27 小时静默同型：daemon 常驻持轮级锁，`main()` 那一趟永远让路 ⇒ 只挂 main 的腿实际零派发，而"戳存在"看起来像它还活着。
- 处置：`git-guardian.mjs` daemon tick 段按字母序补一枚 `sweepGiteeAssetBackfill()`（在 `sweepExposedCredentialRotation` 与 `sweepHeadRecallRows` 之间），器物自带 30 分钟节流与单文件 ≤50MB 守卫，本层只派发、零复算。
- 语义边界：不新建腿、不改器物判据；`ref-move-watch` 那条仍判 live（仅 main 面但戳新鲜，任务档还活着）——背离判据按"戳冻结 ∧ 不在 tick 面"两条件同时成立才算，本项只补齐真正零派发的那一枚。
- 验证：改前 `LIVENESS-RESULT state=stalled stalled=1`、改后 `state=live stalled=0 families=3`；`scripts/tests/gitee-backfill-daemon-wiring.test.mjs` 3 passed（main 挂点 + daemon 形状锁 + 真跑背离巡检的接线锁）。
### 5.63 第 63 项：一件事在 lib 里"有归属"，在尺子上却"无人认领"；另一条腿只挂 main 面

- 现场一：`check-autonomy-leg-health` 现读 `A15-action-coverage [DRIFT] 1 枚台账动作没有任何维度认领:runner-budget-exhausted×37`。它在 `scripts/lib/autonomy-nonprogress.mjs` 的 `ACTION_EXEMPTIONS` 里早有归属（轮级发起腿额度停转、无票键），但门自己的 `ACTION_CLAIMS` 表没认它 ⇒ 37 轮只能从散文读。这正是 §0.9 那型：判据/词汇存在，消费它的那一格不存在。
- 处置一：`ACTION_CLAIMS` 增一条 `runner-budget-exhausted: { dim: 'A15', kind: 'informational' }`，写清"豁免 ≠ 判过：仍进本维报数、不计 A7 空转"。改后本维读数里直接出现 `runner-budget-exhausted×37`。
- 现场二：A9 现读 `main 区 109 / daemon 区 107 ⇒ 1 条只在一次性 main 里(sweepRefMoveLoss)`。daemon 常驻持轮级锁 ⇒ 只挂 main 的守夜人在常驻态等于不存在（与第 62 项同一成因家族）。
- 处置二：daemon tick 段补 `sweepRefMoveLoss()`（自带 `REF_MOVE_WATCH_INTERVAL_MS` 节流与 `ref-move-watch-last.json` 戳，双面并存只先到者真跑，零行为变更）。
- 语义边界：不改 lib 的豁免判据、不摘任何台账行、不为消音放宽前缀族；`sweepRefMoveLoss` 的"仅 main 但戳新鲜"在背离巡检里仍算 live，本项只补结构性承载面。
- 验证：A15 由 `[DRIFT] 1 枚无人认领` 转 `[OK] 近窗动作 24 型全部有归属（认领表 49 条）`，informational 档现读含 `runner-budget-exhausted×37`；A9 落地后转 OK（面=head）；`autonomy-leg-health-output.test.mjs` 11 passed（含新增的第 63 项认领/报数断言）。
### 5.64 第 64 项：契约齐、落账腿也在，但"会话从不写清单"让产物永远进不了 HEAD

- 现场：`check-autonomy-leg-health` 现读 `A13-artifact-landing [DRIFT] 自治环从未把产物送进 HEAD：会话结果档 38 枚 / 落地档 0 枚 / 拒绝档 13 枚（artifact-manifest-missing×13）`。台账 `.ihui-agent/state/auto-evolve-ledger.jsonl` 现读 1379 行，会话/落账档 262 枚（`session-failed 170 / session-no-progress 41 / session-no-write 26 / artifact-manifest-missing 13 / session-ok 12`），`artifact-committed` **历史累计 0**。
- 根因：落账腿的入参只有 `readArtifactManifest(key)` 一条来源，读不到就整轮记 `artifact-manifest-missing` 收手。而会话输出的事件流里本来就有 `{"type":"tool_call","name":"write_file|edit_file|batch_edit","arguments":{"path":…}}` —— 与 `classifySessionWrites` 数的是同一族证据。契约有、器物在、证据也有，只差把那一格接上去（§0.9"有档名没接线"）。
- 处置：`scripts/lib/ticket-artifacts.mjs` 增 `manifestTextFromPaths(ticketKey, files, {note})`（只拼清单文本、空集返 null）；`classifySessionWrites` 增 `wrotePaths`（收 `path ?? file_path`，不判成败）；真派落账腿改为「会话清单优先 → 转录派生兜底 → 都没有才 missing」，台账行多记 `manifestSource`（`session|transcript|none`）。
- 语义边界：**补的是取数面，不是判据** —— 派生清单照样过 `parseArtifactManifest` 票键/形状校验、`sanitizeArtifactPaths` 范围收口与 `selectDirtyPaths` 真脏判定，票键不符仍 `invalid`、路径不脏仍 `stale`；会话自己写的那份永远优先；dry-run 档不派生（没跑会话就没有证据）。
- 顺带修掉两条同族缺陷（现读实测，均非本次引入）：① `auto-evolve.mjs` 的自检脚本在 S11a 里引用未导入的 `planFaceDigest`，整个 `--self-test` 直接 ReferenceError 打死（`--self-test` 由 2 连红转全绿）；② `scripts/tests/auto-evolve.test.mjs` 的 Ⓔ 锁用"全文件第一条 `spawn(process.execPath,[script,…])`"取 argv，实际抓到的是 check-ops-patrol 那条（`--json --apply`）⇒ 长期对着另一个器物喊红，真正要守的 auto-evolve 发射点反而没人看住；改为先锚 `'auto-evolve.mjs'` 取件处再取其后第一条 spawn。
- 验证：`node scripts/auto-evolve.mjs --self-test` `self-test: 全绿`；`node --test scripts/tests/auto-evolve.test.mjs` 82 passed（新增 ⑬f 落点收入 / ⑬g 派生清单契约 / ⑬h 发射端顺位三例）；`node --test scripts/tests/auto-evolve-landing-e2e.test.mjs` 4 passed（真落地腿端到端未被改坏）。
### 5.65 第 65 项：尺子建好了，登记表却一格产出字段都没有 —— 16 腿全部"未判定"

- 现场：`check-autonomy-leg-health` 现读 `A12-leg-output-reconciliation` = `16 腿 = ok 0 / n/a 0 / drift 0 / unjudged 16`，每条都是同一句 `登记表产出字段缺失/非法 ⇒ 不冒充判过`。判据本体（`scripts/lib/autonomy-leg-output.mjs`）三分类齐备、镜像用例齐备，但 `scripts/data/autonomy-leg-liveness.json` 的 16 条腿**一条都没有** `outputKind / outputRel / outputTimeField / silenceCeilingMs` —— 与第 60/61 项同族：不是判据错，是判据的唯一输入面从没被填过。
- 处置：按"每条腿自己的写盘分支"逐枚现读取值，不按腿名想象。① 有专属产出账的 4 腿：`auto-evolve`(`auto-evolve-ledger.jsonl`/ts)、`auto-triage`(`auto-triage-ledger.jsonl`/ts)、`deploy-feedback`(`deploy-feedback-ledger.jsonl`/ts)、`api-liveness`(`api-liveness.jsonl`/**at**，该器物自己用 `at` 键) ⇒ `always`；② 两腿共用 `incident-signals.jsonl`（`deploy-outcome-intake` / `monitor-signal-intake`）⇒ `coveredBy: A11-closure-output`，本维不重复量（同一份账被两条腿各算一次就是第二个真相源）；③ 其余 10 腿结构性无产出账（判据门 / 基线面 / 生成器，产物是文件不是留痕）⇒ `none`，仍由 A8 量戳。
- 语义边界：`silenceCeilingMs` 一律 = 该腿 `nominalIntervalMs × 6`（连续 6 个班次零产出才报），是算出来的不是拍的数；不改判据、不改任何器物的写盘行为，只把"唯一输入面"补齐。
- 二修（首落当场被读数打回）：`outputRel` 写成 `.ihui-agent/state/…` 全路径 ⇒ 判据层按 `LIVENESS_STATE_DIR_REL` 再拼一次，读盘 ENOENT 被当成「一次都没产过」⇒ 四腿立刻从「未判定」翻成「每轮必写却零产出」。改成相对 state 目录的形态后复跑 A12：`16 腿 = ok 13 / n/a 12? …`（当次现读；关键是 unjudged 0、四腿不再读成零产出）。**这条属于「字段形状也是判据」**：同一份登记表，值对而形态错，读出来就是另一个结论。
- 三修（分类也必须取证）：首版把 auto-triage / deploy-feedback / api-liveness 都标成 `always`，于是「账静默 25373min / 5138min / 3676min 而派发戳新鲜」被判成零产出。逐条读它们的写盘分支后更正：三者的台账都是**事件驱动**（`api-liveness` 的 ok 支直接 `return` 不落账、`auto-triage`/`deploy-feedback` 只在真事件上 append），`conditional` 才是真实形态；只有 `auto-evolve` 每轮都落一行（`dispatched` 或 `no-whitelist-hit`）。改后 A12 现读 `16 腿 = ok 3 / n/a 12 / drift 0 / unjudged 1`：唯一一枚 `deploy-feedback` 是它自己连续多轮 `result=undetermined`（自报未判定）⇒ 按三分类落 `unjudged` 并点名"采集输入面断链"，**不冒充判过也不为了抹绿改标签**——**腿的分类不是凭名字想的，是从写盘分支读出来的**。
### 5.66 第 66 项：把"历史存量"当现状读的四处（A13 恒红、A6 拿未判定当哑闸、两把锁写死 12 腿）

- 现场一（A13）：读数 `自治环从未把产物送进 HEAD：会话结果档 38 枚 / 落地档 0 枚 / 拒绝档 13 枚`。第 64 项把落账腿的取数面接通之后它照旧红 —— 因为它读的是**全期存量**，而其后台账近三轮全是 `no-whitelist-hit`（一枚会话都没跑），修好没修好根本判不出。§0.2 对判历史存量的口径是只报数、红要落在可整改的那一跳上。
- 处置一：A13 分三档，分界取证据面 —— ①会话档里**没有一枚**"会交产物"的档（`PROGRESS_ACTIONS` 交集为空：近 30 枚全是 failed/no-write/no-progress）⇒ `unjudged`，点名"落地腿结构上从未被要求答话，环为什么跑不出成功会话属 A1/A2/A8/A14 的轴"；②最后那枚 `session-ok` 之后连**拒绝行**都没有 ⇒ `drift`（保留抓力）；③最后一轮已答话（拒绝）⇒ `unjudged` 并把拒绝分布当**存量**报数。现读 `A13 = unjudged`（拒绝 13 枚照实报出）。
- 现场二（A6）：`valveListText` 是坏 JSON 时它先命中"有派发尝试却零 valve-* 留痕"那条 ⇒ 判 `drift`。而规则表坏时分类器本身可能抛错被吞，零留痕分不清"没走到"与"走到了但炸了" ⇒ 这是拿"判不出"冒充"判过了"。
- 处置二：覆盖率复算提前，`status=bad` **先**落 `unjudged`（读数保留 `覆盖率复算:❌ 未判定` 这一串），"哑闸"那一档只在其后生效。
- 现场三/四：两把自检锁把腿数写死 12（登记表第 60 项起已 16 枚）⇒ 补登记即整片假红；`dep-radar` 的 `ruler` 写的是 `scripts/dep-radar.mjs`（盘上**不存在**），`selfReportToken` 缺失且真值应为"依赖通告:未判定"。
- 处置三/四：两把锁改成按登记表长度现读（结构锁同时校验 `none`/`coveredBy` 两类的合法形态、`outputRel` 必须是 state 相对路径且指向真实台账）；登记表按器物真名改回 `scripts/dep-advisory-radar.mjs` 并补 `selfReportToken`。
- 验证：`node scripts/check-autonomy-leg-health.mjs --self-test` **98 例全绿**（新增 H62b 真静默 drift / H62c 无成功会话 unjudged）；`node --test scripts/tests/autonomy-leg-output.test.mjs` **24 passed**（T21/T22 改为动态腿数）；`autonomy-leg-health-output.test.mjs` 11 passed；体检现读 `AUTONOMY-LEG state=unjudged OK=13 DRIFT=0 UNJUDGED=2`（A12 的 1 枚 `deploy-feedback` 自报未判定 + A13 的存量档，都是点名不冒红）。
### 5.67 第 67 项：自愈层漏掉的第五种形态(`AD`)与三格恒红的自检

- 现场一（门 42 连续未判定）：`registry [门 42] rc=2`，门自己说 `未判定(2 个待扫文件不存在)` ——
  `apps/api/src/lib/oauth-config-check.ts` 与 `apps/api/tests/oauth-config-check.test.ts`。查 `git status`：
  两枚都是 `AD`（**索引里有、磁盘上没了、HEAD 里还没有**）。现行自愈层两条判据都不覆盖它：
  第一层 ` D` 要求"索引 blob == HEAD blob"（AD 的索引 blob 是新内容、HEAD 无此路径）；第四层 `D `
  要求"HEAD 有该路径"（同上不成立）。结果：文件内容还在索引里、磁盘空着，**没有任何器物点名**
  "这枚文件存在过、索引里还有那份字节"，门只能永远读未判定。
- 处置一：`heal-worktree-tracked.mjs` 增第七层 `findStagedAddMissing` + `checkout-index --force`
  回盘（**只写工作树，不碰索引也不碰 HEAD**）。写盘前逐批复核"索引里那份字节还在 ∧ 盘上仍然缺"，
  有有效删除通知书（或台账坏档）的不动 —— 与第一层同一条问句。输出面新增 `stagedAdd*` 七键
  （dryRun 带可回盘清单、真跑带恢复枚数），人类档逐条点名。
- 现场二（自检三格恒红）：`--self-test` 现读 `❌ ㉜a / ㉜b / ㉜d` 三格，而 `git show HEAD:` 的同一份
  器物同样三红 —— 不是本次改动引入。根因是**旧例仍在测旧设计**：㉜ 夹具把 46 枚深（浅窗 40）的
  祖先复归当成"窗口用尽 ⇒ 判不出"，而整块/拼合两条通道自 2026-10-25 起走 `analyze` 的**深档**
  （浅窗用尽即回落全历史），46 枚深照样判得出并对齐。自检读数三红 = 下一次真缺陷混在里面也分不出。
- 处置二：㉜a/㉜b/㉜d 按现设计重写（深档取到全历史 ⇒ 已判过并回到 HEAD、不进"未判定"）；补 ㉜e
  单独钉**浅档**那一维：同一 46 枚深祖先，`blobInAncestry`（浅窗 40）仍必须点名
  `beyond-window` + 窗口与已见枚数 —— 两档窗口各有出处，谁也不许拿对方的结果替自己作答。
- 验证：`node scripts/heal-worktree-tracked.mjs --self-test` **88 例全绿**（改前三红）；
  `node --test scripts/tests/heal-worktree-tracked.test.mjs` **25 passed**（新增 T24：前两层对同一
  现场判不出 → dryRun 点名零写 → 真跑回盘且 `hash-object` 逐字等于索引 blob → 幂等 → 持通知书
  不回盘）；`node scripts/check-event-closure-leak.mjs` 现读 `5 文件 0 命中`（门 42 已能判）。
### 5.68 第 68 项：覆盖面读数把"结构性豁免"读成"漏声明"（落地通道 + 门 262 各一层）

- 现场：每次落地都打一行 `注册表臂覆盖面:登记判据门 359 道,其中 3 道(blocking 0)未声明 stagedTriggers ⇒ 本通道结构上不复跑`。
  查这三枚（280 本机 dev 库轮换窗口 / 325 临时检出寿命 / 326 钩子台账健康）:全部 `mode: warn` ∧ 判的是**机器状态**
  （时间 + 端口空窗 / 存活时长 / 台账容量与失败率）—— 提交内容怎么改都触发不了它们,不声明射程**本来就是对的**。
  但注册表里只能表达"空清单"这一个形状 ⇒ 两条通道（落地 / 提交）把同一份缺省读成反义,读数层只能按"漏声明"报。
  门 262（射程声明完备性）同型:它只看 `stagedTriggers` 一眼,于是这三枚在它账上**永远是"存量缺射程"**,
  并且任何**新的**机器状态门都会被它按"新增门缺射程"判红 —— 逼人写一条伪造的通配 `['**/*']`,把"任何提交都跑"
  变成噪声,反过来废掉射程声明本身的可信度。
- 处置（同一份声明,三层各读一次）：
  ① 注册条目新增 `stagedTriggersOmitted: '<≥10 字理由>'`（与通知书同一门槛,写"略"不算交代）,
    三枚机器状态门各写一句"判的是什么、为什么提交内容无从触发"；
  ② 落地通道 `countUntriggered` 三档分离:`missing`（无理由/理由不足）/ `exempt`（结构性豁免,单列并带理由）/
     `conflicting`（同时写了射程与豁免理由的两个键 ⇒ 自相矛盾,按未判定报）；note 从"3 道漏声明"改成
    "0 道漏声明 + 3 道结构性豁免（逐条带理由）"；
  ③ 门 262 认同一份凭据:`exempt-omitted` 档免判并单列计数（末行新增 `结构性豁免=N`）,但**锚点里原有射程
    被换成理由仍判 `regressed`** —— 豁免通道不许拿来洗掉一次真的摘射程。修复指引同步加一行。
- 顺带修：门 262 的镜像测试 T5 阳性对照仍按字面数两处 `windowsHide: true`,而 52c88a32cf 早把本门两处裸 git
  迁进共用层 `gitRaw`（字面量一处不剩）⇒ 该对照恒红、真正纪律（不得再出现裸派生）无人钉。改为钉现结构:
  **注入一处裸** `execFileSync('git', …)` ⇒ 判据必须点名（正控）；同一次调用补上 `windowsHide: true` ⇒
  不再点名（反控）；另加"必须从共用层 `face-reader.mjs` 取 git 出口"。
- 验证：`check-gate-triggers.mjs --self-test` **判据十一例 + 端到端七例全绿**（新增 ⑦b/⑦c）；
  `node --test scripts/tests/check-gate-triggers.test.mjs` **6 passed**（新增 T1b,重写 T5）；
  `node --test scripts/tests/land-gate-rerun.test.mjs` **18 passed**（新增 T16/T16b 三档分离 + 真注册表锁定）；
  注册表现读 `{"missing":0,"exempt":3,"exemptIds":["280","325","326"],"conflicting":0}`。
### 5.69 第 69 项：复跑预算按扫描序截断，blocking 门可能被一串 warn 挤掉

- 现场：每次落地都打出若干行 `注册表受影响门 [NN] xxx.mjs 超出复跑预算(30 道)⇒ 本轮未跑,请人工复现`。
  常态受影响门 40+，而截断用的是 `toRun.slice(0, REGISTRY_CAP)` —— **按注册表扫描序**截前 30 道。
  于是"被延后"的这一段完全可能躺着 blocking 门:落地整体读数是绿的,而真红门根本没跑。
  这比"没跑"更坏的是它**读起来像跑过**（警告行是 `console.log` 级噪音，绿行不覆盖哪几道没人算）。
- 处置：新增纯函数 `orderForRerunBudget`（blocking 先于 warn，同档保持注册表序，缺省 mode 按 blocking 算）,
  截断与执行批次都走它:只要 blocking 总数 ≤ 预算，任何 blocking 门都不会被 warn 挤掉；
  延后行补 `mode=` 标注；**blocking 总数本身超预算**时另打一条 note,
  明说"本次全绿不覆盖这 N 道 blocking",不给"面没铺满"留"看起来跑过"的余地。
  排序只换"先跑谁":argv、cwd、timeout、env 与结果回填顺序、分级口径逐字未动。
- 验证：`node --test scripts/tests/land-gate-rerun.test.mjs` **19 passed**（新增 T17,
  断言 blocking 前置 / 同档保序 / 缺省按 blocking / 空输入两向）。
### 5.70 第 70 项：`undetermined` 台账不记原因，读数只能复述"没判定"

- 现场（A12 唯一一枚 unjudged）：`deploy-feedback-ledger.jsonl` 近 5 条全是
  `action=build-fail identity=deploy_outcome|alert_firing|route:/deploy/build-fail result=undetermined`，
  每 ~20 分钟一条、全天重复。`--status` 只能把 `result=undetermined` 原样印回 —— **为什么没判定**这句
  在台账里根本不存在（写盘的 code 2 分支只写 ts/action/identity/result）。同身份 24h 去重又让同一簇
  反复重试，于是这条腿在自检面长期停在"未判定"，谁也说不清是取号族不可发、还是登记器报错。
- 处置：`undetermined` **必须带 why**（两处写盘点都补上，截 200 字符）:取号不可行一支记
  `out.why`，`registerToPlan` 未成一支记 `reg.why`；`--status` 的"最近 5 条"把 `why=` 印出
  （历史行没有这个键 ⇒ 印空，不伪造原因）；两处 `skip` 同时补稳定的 `reason`
  （`already-registered-24h` / `per-run-cap`），让"为什么跳过"也能事后复核。
- 验证：`node scripts/deploy-feedback.mjs --self-test` **全绿**（新增 ⑬:取号不可行 ⇒ exit 2 ∧ 零 spawn ∧
  逐条 `undetermined` 都带真原因）；`node --test scripts/tests/deploy-feedback.test.mjs` **17 passed**。
  历史 1440 行不追改（追写会伪造原因），新行起带 why —— 失效方向是"以后能查"，不是"把过去补成绿色"。
### 5.71 第 71 项：可发性探针与发号器不同面 ⇒ 假"可发"把部署反馈腿锁在未判定

- 现场（第 70 项补上 `why` 之后立刻现读出来）：`deploy-feedback --apply` 逐轮 `undetermined`，
  `why=live-doc-edit rc=2 … SCAN_FACE_FULL`。而同一时刻 `--status` 说「B 可发性探针现读可发 首号=B42」。
  同一条链上一个探针说可发、下一个发号器说拒发 —— 逐一对照后定位：`probeIdFamily` 把登记行交给
  `resolveIdTokens` 时只递了 `machineId` 与 `worktreeText`，**丢了三张真发号器必喂的面**：
  `remote`（`readRemoteIdBasis` 的远端号段上界）、`opts.yieldedIds`（已完成条目让位集）、
  `opts.retiredLoader`（近期结清号避让集）。缺这三张时 B42 在探针面上是空闲，在真发号面（含结清避让）
  已被避让 ⇒ 探针给出的"可发"是假话，而失败方向恰好是"每天都写一条读不出原因的未判定"。
- 处置（同一套 runtime、同一份判据，不新造第二套）：
  - `probeIdFamily` 增 `remote / yieldedIds / retiredLoader` 三个**显式可选**入参，原样透传进
    `resolveIdTokens`；缺省 null ⇒ 与改动前逐字同形（测试夹具仍零副作用）。
  - `pickIdFamily` 把三张面转发给每一族探针（`pickRegistrationFamily` 只在这一层装载真面：
    `readRemoteIdBasis` / `loadYieldedIdSets` / `loadRetiredIdSets`，三者全是既有单源实现）。
  - 远端问不到/对象不在本地 ⇒ 整轮落 **未判定**（`远端号段面判不出`），绝不拿"本地可发"冒充
    "全局可发"；让位/结清面装载异常则点名"探针少这两维"（失效方向是多要一次定向说明）。
- 验证：
  - `node scripts/auto-triage.mjs --self-test` **全绿**（新增 T11i 面透传 / T11j 缺上界未判定）；
  - `node --test scripts/tests/auto-triage.test.mjs` **23 passed**（新增 ⑰ 同形双控）；
  - 现读端到端：探针逐族读数 `G/D/O/B exhausted（B:scan-filter 候选 4 枚全灭）`，首个真可发族落到
    `A`；`deploy-feedback --once --apply` 首次 `registered=1`（登记 A50），台账写
    `result=registered`；`check-autonomy-leg-health` 由 `OK=13 DRIFT=0 UNJUDGED=2` 变为
    **`OK=14 DRIFT=0 UNJUDGED=1`**（A12 转判、仅剩 A13 的政策面窄那一格）。
### 5.72 第 72 项：道数预算把 blocking 门截在"未跑"之外，而整句读数仍是"全绿"

- 现场（当次落地日志同屏，逐字对照）：一行是
  `✅ 落地后受影响判据复跑:32 臂全绿`，另一行是
  `⚠️ 复跑预算不覆盖 51 道 blocking 门(blocking 总数已超 30 道)⇒ 本次"全绿"不覆盖它们:65, 84, 80 …`。
  第 69 项只把 blocking 排到前面去，挡不住"blocking 总数本身就超过 30 道"：后 21 道 blocking 一道没跑，
  而整体判词照旧是"全绿"。这正是 §0.3 里"没判写成判过"的形态，只是换了一个进口。
- 处置（单一分配出口，调用方不再自己 slice）：
  - 新增 `planRerunBudget(entries, cap)`：`limit = max(cap, blocking.length)` —— **blocking 一道都不截**，
    预算只压 warn；同档保序（blocking 内部、warn 内部都保持注册表扫描序）。
  - 批次执行改用 `plan.run`（不再 `ordered.slice(0, REGISTRY_CAP)`），延后打印补上
    "blocking N 道不占这 30 坑"的读数。
  - 不变量兜底：`deferred` 里一旦出现 blocking（说明分配出口被改坏），落
    `res.undetermined kind=registry-budget` ⇒ 整轮结论变"未判定"，不再只打一句 warn 就报绿。
- 验证：`node --test scripts/tests/land-gate-rerun.test.mjs` **20 passed**（新增 T18 四控：blocking 35 > cap 30
  仍全跑 / 常态 10+25 只延后 5 道 warn / 缺省 mode 按 blocking / 同档保序）；`node --check` 通过。
  代价只在"blocking 够多"的那些落地里多跑几臂 —— 用**面铺设完整**换掉"读起来像跑过"，方向不可反。
### 5.73 第 73 项：`cap` 被当成"总道数上限"⇒ warn 名额被 blocking 吃光，打印却说"不占这 30 坑"

- 现场（第 72 项刚落地就自证的读数矛盾）：当次落地日志每一条延后行都是
  `⚠️ 注册表受影响门 [24b] … 超出复跑预算(30 道;blocking 84 道不占这 30 坑)⇒ 本轮未跑`。
  第 72 项写的是 `limit = max(cap, blocking.length)`：blocking 84 道 > cap 30 时 `limit=84`，
  **warn 名额被算成 0 道** —— 那批 warn 面一道都没跑，而打印句仍在说"blocking 不占这 30 坑"，
  读起来像"warn 还剩 30 个坑"。这是第 72 项自己引入的"读数把人读错"：截断顺序改对了，
  却在同一行把"没跑"说成"还有余量"。
- 处置（改在同一个分配出口，调用方零改动）：
  - `cap` 语义收窄为**只买 warn 名额**：`warnSlots = min(cap, warn.length)`、
    `limit = blocking.length + warnSlots`。blocking 全跑且**不再消耗 warn 名额**，
    warn 恒有 `cap` 个坑（warn 不足则一道都不延后）。
  - 返回值补 `warnSlots`（读数与分配同源，打印不得自己再算一遍）；延后行改成
    `超出复跑 warn 名额(<warnSlots> 道;blocking <blockingCount> 道全跑、不吃这名额)` ——
    `warnSlots=0` 时句子直接说 0，不再有"不占坑"的暗示。
- 验证：`node --test scripts/tests/land-gate-rerun.test.mjs` **20 passed**，T18 从"四控"重写成**六控**：
  blocking 35 + cap30 + warn 45（warn 仍拿满 30、延后 15）/ blocking 84 + warn 12（warn 名额 12 不是 0）/
  blocking 10 + warn 25（零延后）/ blocking 10 + warn 40（延后 10）/ cap=0（`warnSlots` 真为 0）/ 同档保序；
  `node --check` 通过。

### 5.74 第 74 项：守夜人把"作者自己改写过的提交"当成被丢工作合并回主链，判据面因此永久记红

- 现场（本轮推送时逐字读到，非假想）：本席把 `e92e5c40` 改写成 `70664a0a`（只补了提交正文里的
  `immutable-exempt` / `immutable-exempt-sig` 两行，工作树内容一字未动），紧接着 `check-ref-move-loss`
  按"旧 HEAD 掉出祖先线"把它合并回 main，生成 `f0464fff`（双父：`70664a0a` + `5ec3033e`）。
  三枚提交的树对象现读同一枚 `93a7e1e6`，也就是**同一份内容在祖先线里并存两枚提交**；而改写前那一枚
  没有 trailer ⇒ `check-immutable-guard --range origin/main..HEAD` 对整段区间报 `sig-invalid`，
  合并后没有任何一个内容提交能修它（它改的是历史，不是内容）。
- 处置（判据住在 `check-ref-move-loss.mjs`，零新造）：
  - 新增纯判据 `judgeRestoreEquivalent(diffCode)`：`git diff --quiet <被丢 sha> <当前头部>` 退出 0 ⇒
    `equivalent`（回补不增加任何内容）；退出 1 ⇒ `differs`（照旧合并回补）；其它/取不到 ⇒ `unjudged`。
  - `tryRestore` 逐枚先过该判据：`equivalent` ⇒ 记进 `skipped` 并**跳过回补**（一条 CAS 都不做）；
    `unjudged` ⇒ 整轮不硬做（`ok:false` 并点名）；真丢失的内容仍走原合并路径。
  - 台账 `ref-move-loss.jsonl` 的 `restore` 增 `skipped`（sha + 理由），`ref-move-watch.log` 增 `skippedCount`；
    打印分三档：已回补 N 枚 / 未回补（结构上不需要，N 枚内容已覆盖）/ 未自动回补（带原因）。
- 验证：`node scripts/check-ref-move-loss.mjs --self-test` **12/12**（新增四控：diff=0 跳过 / diff=1 照旧 /
  diff=128 未判定 / diff=null 未判定）；`node --check` 通过；`--check` 现读 `未位移:8fccfc24be4`。
- 代价边界：被跳过的那枚原件仍由 `preserve/refmove-*` 分支永久保全（§22 删除安全规则不变），
  且"掉出祖先线"的事实照旧 exit 1 报红——本项只拒绝"用一枚重复祖先去冒充自愈"。

### 5.75 第 75 项：写手按"索引面"算、推送判据按"HEAD 面"判，两边谁都不假绿但从来没同过面

- 现场（本轮推送时逐字复现）：共享索引里挂着别的会话在飞的暂存删除，`sync-readme-numbers.mjs` 按索引面
  算出 `trackedFiles=23110 / testFiles=5948`，于是它按"幂等无变化"**exit 0** 并打印
  `✅ README 生成块数字无变化,跳过`；同一时刻 pre-push 的 DN2 判 HEAD 面现算 `23147 / 5952`，直接记红：
  `❌ README.md:生成块 trackedFiles = 23104,现算 23147`。两边读数都不假，但**写手的"无变化"只覆盖索引面**，
  被读成了"文档数字已就绪"。本项落地前，这一状态只能靠人工拿 HEAD 种子临时索引绕过。
- 处置（仍在同一个写入口，不新造第二个写手）：
  - 头部注释里那条被证伪的假设就地改写："索引面 == 提交后会变成的 HEAD 面"在多会话共写工作区**不成立**。
  - 新增**面齐平探针**（闸①b）：默认（索引面）档先只读算 `--face=head` 与 `--face=staged` 两块，忽略核对日期行后
    不同 ⇒ `exit 2`，把两面 `trackedFiles/testFiles` 一起印出，并指出推送判据判的是 HEAD 面；**不写盘、不说"无变化"**。
  - 新增 `--face=head --for-push`：显式声明"本次目标是推送面"才允许按 HEAD 取数；只给 `--face=head` 而缺
    `--for-push` 仍按原样 `exit 2`（口子必须写明白，不能默认开）。
  - "无变化"那句改为带面与读数：`✅ …无变化(取数面=staged;trackedFiles=… testFiles=…)`，
    这句话从此只声明它真正覆盖的那一面。
- 验证（现读三档）：默认档 `exit 2` 并印出 `索引面 trackedFiles=23110 testFiles=5948 / HEAD 面 23147 / 5952`；
  `--face=head` 缺 `--for-push` ⇒ `exit 2` 并给出补旗命令；`--face=head --for-push` ⇒
  `ℹ 取数面=head(显式 --for-push,推送面)` + `✅ …无变化(取数面=head;trackedFiles=23147 testFiles=5952)`；`node --check` 通过。
- 代价边界：门 173（判索引面）与 DN2（判 HEAD 面）在"索引≠HEAD"的窗口里仍会各报各的——本项不假装能同时满足两面，
  只把"两面不同"从沉默变成一句带两枚读数的事实；真正的单面收敛属判据面口径变更，需另立条目拍板。

### 5.76 第 76 项：两条自愈腿只挂在一次性 `main()`，常驻 daemon 每趟让路 ⇒ 结构上跑不到（A9 判 drift）

- 现场（A9-carrier-parity 现读，逐字）：`main 区 103 条 / daemon 常驻区 100 条 ⇒ 2 条只在一次性 main 里
  (sweepGiteeAssetBackfill, sweepRefMoveLoss)`。而 `IHUI-GIT-GUARD` 服务从启动起一直持有轮级锁，
  `main()`（2 分钟计划任务）每趟都静默让路 ⇒ 这两条腿"登记了、注册了、却永远轮不到"。
  第 74/75 项修的正是 `sweepRefMoveLoss` 派发的那条判据：它自己已经改对了，但**派发面没搬进常驻 tick**，
  等于修好的判据没人按 5 分钟节拍叫它（现读它还能活，是另一枚计划任务刚好在跑，属偶然）。
- 处置（零行为变更的搬入，不新造节流）：`startDaemon` 的 tick 在 `sweepStaleClosedRows()` 之后补两行：
  - `sweepRefMoveLoss()` —— 自带 5 分钟节流戳 `ref-move-watch-last.json`；
  - `sweepGiteeAssetBackfill()` —— 自带 30 分钟节流戳 `gitee-backfill-tick.json`，器物缺位只报一行不下结论。
  两条腿的节流都是**它们自己那份**（不是本层另抄一份），与 `main()` 并存时双执行体只先到者真跑；
  派发失败只 warn、下一轮重试（失效方向 = 多跑一次，不是跳门）。
- 验证：`node --check scripts/git-guardian.mjs` 通过；落地后 `check-autonomy-leg-health` 的 A9 由
  `DRIFT(main 区 103 / daemon 100)` 转为 `OK(两区齐平)`，A9 的点名清单里不再出现这两条腿；
  `check-sweeper-liveness` 仍 `state=live stalled=0 undetermined=0`。
- 边界：A9 判的是**载体面齐平**，不判腿的业务结论；本项只保证"会被叫到"，这两条腿判对判错仍归它们各自的器物。

### 5.77 第 77 项：契约头注写着"由守护器周期派发"，守护器里零实现 ⇒ 三源入库从未上岗

- 现场（逐字对照）：`scripts/monitor-signal-intake.mjs` 头注写明"调度面（第 58 项）：由
  `git-guardian.mjs` 的 `dispatchMonitorSignalIntake` 周期派发（`--apply --json`，30 分钟节流，
  `IHUI_GUARDIAN_DISABLE_MONITOR_INTAKE=1` 可关），main 单轮与 daemon tick 双挂点"。
  `grep -n "monitor-signal|MonitorSignal" scripts/git-guardian.mjs` 现读 **0 命中** —— 函数不存在、
  两个挂点不存在、节流戳只由一个已死的实现留过一枚。同一时刻 `incident-signals.jsonl` 37 行全部
  `source=deploy_outcome`：api_logs / grafana_alert / user_feedback 三源一条都没进过账
  （§0.9「造好没装车 = 没有」）。同目录还躺着契约测试 `monitor-signal-intake-dispatch.test.mjs`，
  它 import 的正是这个不存在的导出 —— 门 98（HEAD 悬空具名导入）现读 5 处里的 1 处就是它。
- 处置（照契约测试实现，不新造第二份判据）：新增 `dispatchMonitorSignalIntake(opts)`：
  - 器物缺席 ⇒ `{ran:false, why:"器物缺席"}` 且**不写戳**（不把"没跑"记成"跑过"）；
  - 节流 30 分钟（`IHUI_MONITOR_INTAKE_INTERVAL_MS` 可调），戳落 `monitor-signal-intake-dispatch-last.json`；
  - 关断开关 `IHUI_GUARDIAN_DISABLE_MONITOR_INTAKE=1`；
  - 派发必带 `--apply --json`（器物默认 dry-run，不带就永远零信号）；
  - 三态只认器物自己打的 `MONITOR-INTAKE` 结论行，无结论行 ⇒ `ok:false` 并留一行 warn（未判定不记绿）。
  - 挂点两处：`main()` 的 `if (!CHECK_ONLY) dispatchMonitorSignalIntake()` 与 daemon tick 直调 ——
    计划任务档被禁用后 daemon 是唯一执行体，单挂任一侧都会重演第 76 项那条"每趟让路"。
- 验证：`node --test scripts/tests/monitor-signal-intake-dispatch.test.mjs` **7 passed**（①导出与 `--apply`
  形状 / ②双挂点 / ③节流与关断 / ④真跑 ok 透传 / ⑤窗口内不二次、过窗放行 / ⑥器物缺席不写戳 /
  ⑦器物头注点名真实调度器）；`node --check scripts/git-guardian.mjs` 通过；门 98 对 `git-guardian.mjs`
  的那一处悬空导入消失（余 4 处属另一席在飞的 worktree-age 测试，其删除已在其暂存面，不代裁）。
- 边界：本项只补"这一跳装车"，三源各自读不到时仍由器物点名未判定；派发失败只 warn、下一轮重试。

### 5.78 第 78 项：门自己抓到第 77 项的同族第二枚 —— IP 归属尺"头注写了巡检轮、代码面零引用"

- 现场：第 77 项落地后立刻跑 `node scripts/check-guardian-dispatch-claims.mjs`，现读仍报
  `❌ scripts/check-ip-attribution-trust.mjs:22 头注声称走 git-guardian 周期派发，但
  scripts/git-guardian.mjs 代码面零引用「check-ip-attribution-trust.mjs」 ⇒ 登记了没人调度`。
  该尺子判的是"`trustProxy` 表里一旦出现公网地址，admin 网络分段 / IP 信誉封禁 / 限流键就同时
  退化成『填 127.0.0.1 即以内网身份通行』"——它守的正是"没人往信任表里加公网项"这个巧合，
  而巧合消失的那一刻若没人按节拍看，盘面上不留痕迹。
- 处置（照门给的出路做前一半、不改判据）：新增 `export async function sweepIpAttributionTrust`，
  - 30 分钟节流（`IHUI_IP_TRUST_INTERVAL_MS` 可调），戳落 `ip-attribution-dispatch-last.json`（第 80 项改名，见 5.80）；
  - 尺子缺席 ⇒ `{ran:false, why:"尺子不在位"}` 且**不写戳**；
  - 三态不并桶：ok 一行读数；breach 打印逐档点名 + 出路（§5e-2：出路是 agent 当场能做的
    「先改 cf-connecting-ip 口径再保留本表项」⇒ 不寄信，出声在日志）；unjudged / 结论取不到
    （尺子 `--json` 被写坏）一律记未判定，不记绿（§0.3）；
  - 双挂点：`main()` 与 daemon tick 各一处（daemon 是计划任务档停用后的唯一执行体）。
- 验证：新增接线锁 `scripts/tests/ip-attribution-trust-sweep.test.mjs` **3 passed**（①导出 + ≥2 挂点
  / ②ok·breach·unjudged 分档 + 坏 JSON 算未判定 / ③节流 now·+60s·+31min + 尺子缺席不写戳）；
  `node --check scripts/git-guardian.mjs` 通过；落地后重跑 `check-guardian-dispatch-claims` 该枚
  从红项转为已接线（声称 14 / 已接线 11 / 诚实说明 3）。
- 边界：本项只补调度，不替尺子改判据；breach 仍只出声不寄信（整改动作归 agent 当场做）。

### 5.79 第 79 项：user_feedback 单源入口"器物齐、诚实写着零调用点"—— 那一源事实上永远进不了账

- 现场：第 78 项落地后 `check-guardian-dispatch-claims` 现读 `ok: 声称 14 / 已接线 11 / 诚实说明 3`，
  三枚"诚实说明"是 `check-dev-db-rotation-window`、`relay-account-keepalive`、`user-feedback-intake`。
  前两枚的前提确实不成立（前者要等 DB 轮换窗口、后者的常驻腿已换承载体）；`user-feedback-intake.mjs`
  头注自述"全仓 **零调用点** —— 没有 guardian 派发、没有 npm script、没有 CI 步骤（§0.9）"，
  而它 import 的是 `incident-cluster` 的 `identityOf`、`monitor-signal-intake` 的 `planIntake/appendSignals`
  —— 判据全对、映射全对，**一条调度面也没有**：本地导出件再新也没人读，`SOURCE_PLAN.user_feedback`
  那一源永远是空的（`incident-signals.jsonl` 现读确无一条 user_feedback）。
- 处置：新增 `dispatchUserFeedbackIntake`（第 77 项那一族的第三枚，同一形状）：
  - 30 分钟节流（`IHUI_USER_FEEDBACK_INTAKE_INTERVAL_MS` 可调），戳 `user-feedback-intake-dispatch-last.json`；
  - 关断 `IHUI_GUARDIAN_DISABLE_USER_FEEDBACK_INTAKE=1`；器物缺席 ⇒ `ran:false` 且**不写戳**；
  - 派发必带 `--apply --json`（器物默认 dry-run）；
  - 三态只认结论行：`judged=0` 或 `undetermined≠0`（导出件缺失/陈旧/契约坏）⇒ `ok:false` 并逐行 warn，
    `signals=N … undetermined=0` 才记绿；无结论行同样落未判定；
  - 双挂点：`if (!CHECK_ONLY) dispatchUserFeedbackIntake()` 与 daemon tick 直调（与 monitor 入库相邻，
    保住契约测试钉的那一行 `if (!CHECK_ONLY) dispatchMonitorSignalIntake()` 原样）。
  - 器物头注的"零调用点"改为如实记载调度面（诚实说明必须能被证伪，否则它就是下一枚假绿）。
- 验证：新增 `scripts/tests/user-feedback-intake-dispatch.test.mjs` **3 passed**（①导出 + ≥2 挂点 /
  ②signals 记绿、`judged=0` 与 `undetermined≠0` 记未判定、无结论行记未判定 / ③节流 now·+60s·+31min、
  关断开关、器物缺席不写戳）；连同第 77/78 项两枚接线锁一次跑 **13 passed**；
  `node --check scripts/git-guardian.mjs` 通过；`check-guardian-dispatch-claims` 该枚从"诚实说明"转"已接线"。
- 边界：本项只补调度与如实头注，不改 `planIntake`/`identityOf` 任何判据（单一真相源仍在那两处）；
  导出件陈旧时仍记未判定，不替它伪造信号。

### 5.80 第 80 项：新腿一装车，黑腿探测器立刻点名 —— 两枚派发戳"谁在派、该多久动一次"无人认领

- 现场（第 79 项落地后立刻量的，不是推断）：`node scripts/check-autonomy-leg-health.mjs` 现读
  `[DRIFT] A8-leg-liveness :: 腿 16 枚 … ok=16 ｜ 源面 17 枚 / 登记 16 枚 ｜ 源里有而表里没有:
  user-feedback-intake-dispatch-last.json`，并给出路"把这几枚补进 `scripts/data/autonomy-leg-liveness.json`
  (owner=派发函数、nominalIntervalMs 现读源默认值、ruler=器物、verifiedAt=今天)；不补就是新腿不受静默探测量"。
  这正是该探测器存在的意义：新装车的腿**默认是黑腿**，没人登记就没人量它的静默。
- 处置两件：
  ① 第 78 项那枚戳名 `ip-attribution-trust-sweep-last.json` 不合本族命名（`*-dispatch-last.json`），
     源面字面量枚举按正则 `[a-z0-9][a-z0-9-]*-dispatch-last\.json` 收，非该形 = 探测器结构上看不见它 ⇒
     改名为 `ip-attribution-dispatch-last.json`（避免"登记表一被删就变黑腿"）；
  ② 往 `scripts/data/autonomy-leg-liveness.json` 补两条腿（16 → 18）：
     `user-feedback-intake-dispatch-last.json`（owner=`dispatchUserFeedbackIntake`、env=`IHUI_USER_FEEDBACK_INTAKE_INTERVAL_MS`、
     nominal=1800000 现读源默认、ruler=`scripts/user-feedback-intake.mjs`、coveredBy=A11，因它与 monitor 入库共用
     `incident-signals.jsonl`）、`ip-attribution-dispatch-last.json`（owner=`sweepIpAttributionTrust`、
     env=`IHUI_IP_TRUST_INTERVAL_MS`、nominal=1800000、ruler=`scripts/check-ip-attribution-trust.mjs`、outputKind=none，判据门无产出账）。
- 顺手取证（真跑一次，不是只登记）：直接 import 守护器调两枚派发器，两枚戳当场落盘 ——
  `user-feedback-intake-dispatch-last.json`（结论行 `USER-FEEDBACK-INTAKE judged=0 undetermined=1`，导出件缺失 ⇒ 如实记未判定）、
  `ip-attribution-dispatch-last.json`（`state=ok`，config 默认仅回环）。这同时证明"登记的不是空条"：
  两腿真跑得出结论，只是 user_feedback 那一源当前确实没导出件（未判定，不是绿）。
- 验证：落地后 `check-autonomy-leg-health` 现读 `A8 … ok=18 / drift=0`；`A12` 仍 `ok 4 / n/a 12 / drift 0`；
  `check-guardian-dispatch-claims` 保持 `声称 13 / 已接线 11 / 诚实说明 2` 无新增红。
- 边界：本项只补登记与命名，不去救 user_feedback 的导出件（那是产品侧取数面），也不替 A8 放宽任何阈值。

## 6. 剩余候选的处置结论（"剩余都要做"的兑现清单）

用户要求"剩余都要做"，本轮的处置是**把能做的真做出来**（5.14–5.16 三项新落地），只对"已有等价实现"与"产品形态决策"两类给出硬证据：

1. **ACP 传输** → 本轮已实现（§5.14，`POST /api/sessions/acp`）。原判"不造"被撤回：改成"在既有 SessionStore 之上加协议外观"，不新增事件模型。
2. **三级阈值 + cycle restart** → 已有等价（`app/core/context_compaction.py` 的 `assess_context_pressure` + `_build_structured_summary`、`compaction_retention.py` / `compaction_quality.py` / `compaction_canary.py`、`CompactionBoundaryItem`）；"交接"这层本轮补齐为可导出产物（§5.15）。
3. **BM25 / 混合检索** → 已有等价且更强：`mcp_server.py` 的 `search_codebase` 已是 pgvector + BM25 的 RRF 混合通道（注释 `:1707`）。纯 BM25 再写一份会在离线/在线两态给出两套排序。
4. **前缀缓存统计** → 统计早已有（`cost_ledger.py:510` 段 `total_cached_tokens / cache_creation_tokens / cache_hit_count` + `model_pricing.py` 三段计价 + `rollout_budget.py` 归一）；本轮把"读数"装成会话级一等端点（§5.16），只剩前端图形化看板属产品形态。
5. **MCP apps 宿主 UI** → 后端挂载（§5.13）+ 卡片外链（§5.17）+ 卡片内嵌分页预览（§5.18）三件齐备，"点开看到完整输出"这条链路已闭环；HTML 类产物预览既有实现（图表 iframe / 聊天 srcDoc），本轮只把沙箱档收口成一份（§5.21），不再有功能缺件。
6. **RLM（递归分解）** → 原判"低 ROI、不做"已撤回：按"借鉴整合、不另造"的口径并入 `TeamOrchestrator.run_recursive`（§5.20），复用并行分发/聚合/摘要三条既有链路，节点预算与子代理并发闸同源。至此 §4 矩阵中对照件的能力项**全部有落点**，无"已知缺口未补"。

## 7. Limitations（如实记录，不作安全结论）

- Qoder 图谱含 15 处 JS 解析失败与 9 条 native dll 重签名冲突，属打包后常见现象；不作为"有问题"的证据。
- deepseek-tui 为"字符串级 + 函数级引用图"：函数边界与串引用是静态事实，但 **Decompiler Parameter ID 未跑完**（36MB 主体单次会话未收敛），因此无控制流/语句序，不能据此推断某个分支一定在何时执行；函数名被剥离，一律 `FUN_*`，靠"它引用的文案 + 结构体名"认领（证据见 `docs/benchmark-evidence/2026-11/deepseek-tui-native-20261120.md`）。
- Trae 本地包可能只是壳，云端实现完全不可见；"本地命中 0"不等于"产品无此能力"。
- WorkBuddy 四件为抽取件，未做全量模块扫描（11,587 个模块）。
- 本次未运行全仓 `pnpm turbo build typecheck lint test`；仅运行改动面相关测试与 `@ihui/api` typecheck。全量验证留给提交链/CI。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
