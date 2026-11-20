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
2. 真正找到并已落地 **16 项**缺口（代码 + 测试 + 验证全绿，见 §5），集中在工具层、上下文预算与执行面：
   - **确定性工具结果裁剪器「有测试、零生产调用方」**，且默认预算是猜的 → 改为证据值并接进唯一消息出口，同时比对照多保留尾部。
   - **`write_file` 工具可盲写覆盖未读文件** → 加读前写保护（对照 `dsh-fs-observation-policy`），不改底层写盘原语。
   - **`edit_file` 根本没有**（只有 save 语义）→ 唯一匹配替换 + `replaceAll` / 原子 `edits[]` / `dryRun`，并修掉 Windows 上 CRLF 与 BOM 两类必失败场景。
   - **子代理没有常驻文件租约** → `resident_file` 独占租约 + 定界注入。
   - **`read_file` / `list_dir` 无预算**、**模型没有检索能力**（`grep`/`glob` 只有 HTTP 端点没注册成工具）→ 同族预算 + 总量自述 + 续查指引，并顺手修掉 `**/` 零层语义塌陷。
3. 原生层（deepseek-tui）在本机**无法做反编译**：Ghidra 未安装、IDA/Hopper 未安装、REA 的 `inspect-binary-layout` 仅支持 Linux x64。原生结论全部来自二进制可打印字符串（22,471 条去重），是"观察"，不是"反编译推断"。
4. Trae CN 的本地扩展面很薄（`apply_patch`/`edit_file`/`subagent` 命中 0），其 agent 能力在云端；**本地可借鉴物极少**，这一点如实记录，不用"已分析"冒充"有产出"。

## 2. 取证方法与工具（复核用）

| 项 | 实际使用 | 状态 |
| --- | --- | --- |
| REA 6.4.0 | `D:\DevEnv\tools\npm-global\node_modules\rea-agents\scripts\rea.mjs`，`--deep` | 可用 |
| craft-anything 0.6.1 | `D:\DevEnv\craft-anything\0.6.1\craft-anything-cli.exe`，`--deep` | 可用 |
| REA 二进制布局 | `inspect-binary-layout` 对 Windows PE 返回 `capability_unavailable`（仅 Linux x64） | 不可用 |
| Ghidra / IDA / Hopper | 均未安装（`D:\DevEnv\ghidra_12.1.4` 不存在） | 不可用 |
| 自写 ASAR 只读解析器 | `D:\IHUI-AI\.ihui-agent\tmp\recon\asar-tool.mjs`（list/extract） | 可用 |
| 字符串提取 | node 遍历可打印 ASCII 段并去重 | 可用 |

> 用户给出的 `E:\桌面\rea-rea-agents-6.4.0.lnk` 与 `.ihui/mcp.json` 指向的 `E:\ct-craft-anything\...0.5.0` 在本机不可达（E 盘无挂载）；上式为本机实际可用件，属环境事实差异，非"没跑"。

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
- 不可做：原生反编译（工具缺失，见 §2）。

## 4. 能力矩阵（对照 IHUI 现状）

| 能力 | Qoder | Trae | WorkBuddy | deepseek-tui | IHUI 现状 | 判定 |
| --- | --- | --- | --- | --- | --- | --- |
| 工具结果确定性裁剪 | – | – | 工件老化 `pruneOldArtifacts` | `compaction.rs` | `tool_result_pruner.py`（**零调用方**） | **缺口①已补** |
| 读前写保护 | – | – | – | `fs-observation-policy` | 无（`write_file` 盲写） | **缺口②已补** |
| 重复调用治理 | – | – | – | `repeat-tool-reminder`（advisory） | `doom_loop.py`（WINDOW 10 / REPEAT 3，可终止） | 本仓更严，不抄 |
| 上下文压缩 | – | `compact 19` 命中 | – | L1/L2/L3 + cycle | 8 个模块 + 四道阈值线 | 已覆盖 |
| 沙箱 | Electron utility | 云端 | `sandbox-proxy` | `sandbox_backend/url/api_key` | `code_exec_sandbox`/`proc_sandbox`/enforcement gate | 已有；远程沙箱列候选 |
| 审批 | – | – | – | `approval_policy` + YOLO | `command_execution_approval_decision`/`approval_replay`/`mcp_tool_approval` | 已覆盖 |
| 子代理 | – | 云端 | `proxy-agents` | `agent_type` 六型 + `resident_file` 租约 | `subagent_jobs`/`agent_teams` | 已有；缓存租约列候选 |
| MCP | – | `builtin-mcp` | MCP apps 宿主 | `mcp_config_path` | `mcp_client` | 已有；宿主 UI 列候选 |
| 检查点/回滚 | – | – | `checkpoint` | snapshots + `--fresh` | `agent_checkpoint`/`checkpoint_rewind` | 已覆盖 |
| 前缀缓存统计 | – | – | – | 有 | 多 provider，无 | 不适用 |
| RLM | – | – | – | 有 | 无 | 低 ROI，不做 |

## 5. 本次落地（16 项，含验证证据）

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

## 6. 剩余候选的处置结论（"剩余都要做"的兑现清单）

用户要求"剩余都要做"，本轮的处置是**把能做的真做出来**（5.14–5.16 三项新落地），只对"已有等价实现"与"产品形态决策"两类给出硬证据：

1. **ACP 传输** → 本轮已实现（§5.14，`POST /api/sessions/acp`）。原判"不造"被撤回：改成"在既有 SessionStore 之上加协议外观"，不新增事件模型。
2. **三级阈值 + cycle restart** → 已有等价（`app/core/context_compaction.py` 的 `assess_context_pressure` + `_build_structured_summary`、`compaction_retention.py` / `compaction_quality.py` / `compaction_canary.py`、`CompactionBoundaryItem`）；"交接"这层本轮补齐为可导出产物（§5.15）。
3. **BM25 / 混合检索** → 已有等价且更强：`mcp_server.py` 的 `search_codebase` 已是 pgvector + BM25 的 RRF 混合通道（注释 `:1707`）。纯 BM25 再写一份会在离线/在线两态给出两套排序。
4. **前缀缓存统计** → 统计早已有（`cost_ledger.py:510` 段 `total_cached_tokens / cache_creation_tokens / cache_hit_count` + `model_pricing.py` 三段计价 + `rollout_budget.py` 归一）；本轮把"读数"装成会话级一等端点（§5.16），只剩前端图形化看板属产品形态。
5. **MCP apps 宿主 UI** → 后端挂载面已补齐（§5.13：artifact 挂载、TTL、404 同形），本轮再加了会话级读数端点。宿主 UI 的卡片/沙盒/生命周期是**前端交互设计**，需产品拍板；后端已按判据就位，前端接上只是消费 `token` + `f/{token}` 两件事，不再有后端缺件。

## 7. Limitations（如实记录，不作安全结论）

- Qoder 图谱含 15 处 JS 解析失败与 9 条 native dll 重签名冲突，属打包后常见现象；不作为"有问题"的证据。
- deepseek-tui 仅字符串级取证：无类型信息、无控制流，不能据此推断其内部实现细节或安全姿态。
- Trae 本地包可能只是壳，云端实现完全不可见；"本地命中 0"不等于"产品无此能力"。
- WorkBuddy 四件为抽取件，未做全量模块扫描（11,587 个模块）。
- 本次未运行全仓 `pnpm turbo build typecheck lint test`；仅运行改动面相关测试与 `@ihui/api` typecheck。全量验证留给提交链/CI。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
