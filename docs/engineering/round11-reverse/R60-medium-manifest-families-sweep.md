<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R60 —— 协议面封闭集中等清单族扫尾（全量穷举法第五轮：N=3~5 族批量收编 + 穷举完备性反证）

> 续 R56-R59。R56 落纯值域轴，R57 落 5 个 struct-variant 轴，R58 横扫 95 家族的语义封闭值域类，R59 吃下 6 族大方法清单（N=11~187）。本轮扫尾 R58 §7 点名、R59 未覆盖的**中等清单族**（N=3~5 零命中族），并做一次取证负结果反证：宽正则重扫证明 R58 穷举对 `struct variant` 家族是**完备的**。

## 1. 取证方法（本轮增量 = 一次严谨的负结果）

复用 R58 `families.out`（mmap 流式抽 codex.exe 26.1111.2228.0，284 万 ASCII 串）。本轮新增两条探针：

1. **替代正则探针 `probe.py`**：R58 记 `unit variant` 0 命中、`Message` 族 N=17。换 `enum X::Y` / `variant X::Y` / `newtype variant` 三种正则重扫，发现 `variant X::Y` 抓到 1632 hits / 114 enums，其中 `Message` 竟有 45 个 variant（多出 `AudioControlsApplied`/`Closed`/`InitializeRuntime`/`Ready`/`StartTransport` 等）。
2. **元素数反证 `probe2.py`（关键）**：把 R58 的 `struct variant X::Y with N element` 放宽为任意 `variant X::Y with N element`（去掉 struct/unit/newtype 前缀要求）重扫全量串，按 enum 聚合后与 `families.out` **逐族逐 variant 对比**。

**结论（负结果，诚实记录）**：宽正则重扫得 `[broad families] 95  [r58 families] 95`，**全部 95 族零差异**——`variant X::Y` 多出的 45 vs 17 是连体串把 `Message::AudioState` 与其后的 `struct` 字段名拼成 `AudioStatestruct` 造成的假阳性；按"带独立元素数声明"这一硬判据过滤后全部归零。⇒ **R58 的 `struct variant` 穷举对带元素数家族是完备的，无遗漏新轴**。这条负结果堵死了"R58 可能漏抓"的猜测，方法价值不亚于正向发现。

`unit variant`（R58 记 0）在本轮 `unit_variant`/`enum_qualified` 正则下仍近 0（仅 1 条连体串假阳性 `SearchMatchMode...Response`）——确认对照用 serde rename 或裸声明，不是可机检的 `unit variant X::Y with N element` 形态，如要挖需上 Ghidra 定向 xref（R53 法），本轮不改取证法。

## 2. 归属过滤（8 族全部干净）

从 `family_gap.out` 零命中族里挑语义正交、本仓无异层的 8 族（N=3~5）：

| 族 | N | 本仓归属判定 |
|---|---|---|
| `ElicitationRequest` | 5 | 零命中；本仓 `elicit_result_action.py` 是引导**结果**动作，本轴是引导**请求**呈现载荷，两端正交 |
| `UserInput` | 5 | 3 命中均异层（用户消息处理），载荷名清单本身零命中 |
| `ThreadTimelineEntry` | 4 | 零命中；本仓 `turn_timing.py` 是计时，非时间线条目 |
| `ToolCallSummary` | 4 | 1 命中异层；本仓 `tool_call_trace.py` 是调用轨迹，本轴是摘要归类 |
| `UserVerificationErrorDetails` | 4 | 零命中；与 R56 `codex_error_info.py`（服务端错误 info）不同层 |
| `AgentPluginMcpServer` | 3 | 零命中；本仓无 MCP 传输方式清单 |
| `ProviderSettings` | 3 | 零命中；与 R58 `model_provider_error.py`（提供商错误）正交 |
| `RealtimeEvent` | 3 | 零命中；本仓 `realtime_voice_session.py`/`realtime_context.py` 是会话/上下文，本轴是事件载荷名 |

同构去重：`ElicitationRequest` 与 `McpServerElicitationRequest` variant 表逐字同构（Form/OpenAiElicitationForm/OpenAiForm/Url/UserVerification）→ 只落前者；`RealtimeItemContent`/`ThreadRealtimeItemContent` 同构 → 本轮不落；`CommandAction`/`ParsedCommand` 同构 → 本轮不落。`PluginSource`/`WebSearchAction`/`GatewayAuth` 等 N≤3 族留 R61 继续扫尾。

## 3. 交付（8 模块 + 8 测试，209 用例）

| 模块 | 封闭集（逐字元素数表） | 一轴超越 |
|---|---|---|
| `elicitation_request.py` | Form:3, OpenAiElicitationForm:3, OpenAiForm:3, Url:4, UserVerification:4 | 两类呈现域（form/external）+ 反查；与引导结果动作正交 |
| `user_input.py` | LocalAudio:1, LocalImage:2, Mention:2, Skill:2, Text:2 | 三类输入域（media/reference/text）；元素数 1 vs 2 差异化 |
| `thread_timeline_entry.py` | Item:3, Realtime:2, TurnCompleted:7, TurnStarted:3 | 三类条目域；`TurnCompleted` 元素数 7 族内最多 |
| `tool_call_summary.py` | Agent:3, Generic:3, Terminal:1, WaitAgent:2 | 三类摘要域；与调用轨迹不同层 |
| `user_verification_error.py` | Cancelled:1, Failed:1, InvalidRequest:1, Unavailable:1 | 两类归责域（user_action/system）；与服务端 error info 不同层 |
| `agent_plugin_mcp_server.py` | Sse:2, Stdio:4, StreamableHttp:2 | 两类传输域；`Stdio` 元素数 4 族内最多 |
| `provider_settings.py` | Bedrock:2, CustomGateway:1, Gcp:3 | 两类来源域（cloud/custom）；与提供商错误正交 |
| `realtime_event.py` | ConversationItemDone:1, HistoryTranscriptDelta:2, SessionUpdated:2 | 两类事件域（lifecycle/streaming）；与会话上下文不同层 |

统一设计沿用 R56-R59：`StrEnum` 逐字封闭集 + `X_ELEMENTS` 元素数表 + `X_DOMAIN` 归类表 + `xxx_names()`/`expected_*_count()`/`ensure_xxx()`/`xxx_domain()`/`xxx_domain_members()`/`is_xxx()`/`validate_xxx(name,count)` 纯函数 + 自定义错误类。

## 4. 验证（全绿）

- **209 pytest**（R60 单跑）/ **1502 passed**（R60 + R56-R59 全部 pivot 测试）
- **ruff 0.16.6 全绿**（生成器源头已避 R59 全部坑：普通字符串单花括号、set 比较、import 前缀 `app.core.X`、无双逗号；ruff --fix 清 8 处 I001 后复检 All checks passed）
- **py_compile 16/16 OK**（ruff --fix 后复核）
- **水印 16/16**：从 HEAD 面 `post_turn_compact_threshold.py` 前 3 行逐字复制，未手敲不可见字符
- **三重反向变异实证**（自恢复 try/finally）：删 `UserInput.LocalAudio` → 2 红恢复绿；篡改 `ThreadTimelineEntry` 元素数 7→99 → 2 红恢复绿；篡改 `ProviderSettings` 域 `custom→cloud` → 1 红恢复绿；恢复后 3/3 锚点完好

## 5. 诚实边界

- 8 族 variant 名与元素数逐字确证（`struct variant ... with N element` + `families.out` 双证）。**serde tag/rename 未确证**（按 Rust variant 名逐字登记，同 R56-R59 先例）。
- 所有域归类（present/input/timeline/summary/attribution/transport/source/event domain）是**本仓语义归类**，非对照原生判据。
- `OpenAiElicitationForm`/`OpenAiForm`/`Form`、`Mention`/`Skill`、`Terminal`/`Generic` 等近义 variant 的实际语义差异未从 disasm 确证，按逐字名分档。
- 全部未接生产发射点（接入留属主）。

## 6. 落库与推送

- 饱和树走 `object-space-land.mjs` 精确 pathspec 落 17 文件（8 模块 + 8 测试 + 本报告），不碰他席 staged。
- 推送状态见运行日志 R60 条：按 `git ls-remote origin refs/heads/main` sha 现读如实记录，不硬推、不用开关洗门。

## 7. 后续开放轴

- **剩余 N≤3 族扫尾**：`PluginSource`/`WebSearchAction`/`GatewayAuth`/`GatewayOAuthDelivery`/`LoginAccountResponse`/`OtelExporterKind`/`FileChange`/`WireRuntimeResponse` 等（R58 §7 与本报告 §2 点名）→ R61 继续；
- **同构族二选一落地**：`CommandAction`/`ParsedCommand`、`RealtimeItemContent`/`ThreadRealtimeItemContent`（variant 表逐字同构，已证伪重复落地价值，挑一即可）；
- **tagged enum 值域**：`probe.py` 的 `tagged_enum` 正则抓到 262 处 `internally tagged enum X`，但均未带 variant 元素数声明（连体串形态），需 Ghidra 定向 xref（R53 法）才可能反推值域——本轮判定为"换取证法"级别，非批量正则可及；
- **unit-variant enum**：两轮正则均近 0，确认需换取证法。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
