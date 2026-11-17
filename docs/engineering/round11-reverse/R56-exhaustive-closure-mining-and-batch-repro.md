<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R56 —— 全量穷举 codex.exe 封闭集 + 差距矩阵 + 五轴批量复现

> 日期：2026-11-17 · goal：pivot-rust-loop（逆向对齐 codex.exe → 本仓复现 → 超越）
> 本轮性质：方法论升级（"榨干"打法）+ 五条真空白轴批量落地

## 1. 为什么换打法

R11–R55 共 55 轮是**碰运气式一条条挖**：每轮从某个 strings 线索下潜一条轴。机主令
「抄袭 榨干 还差的远呢」后，本轮改为**先穷举全集、再对照、再批量复现**——不靠记忆、
不靠线索命中率。

## 2. 全量穷举取证（前 55 轮从未做过）

对照物：`codex.exe` 26.1111.2228.0（365MB Rust PE，
`C:/Program Files/WindowsApps/OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0/app/resources/codex.exe`）。

工具：`scripts/evidence/native-xref-probe.py`（R54 沉淀）之外，本轮临时写纯标准库
mmap 流式抽取器（scratch，不入库），一次性抽出 **1,575,334 条** ASCII 串，按 6 类正则归类：

| 类别 | distinct 候选数 |
|---|---|
| `struct X with N elements` | 1189 |
| `enum X` | 409 |
| `*Event` | 97 |
| `*Kind/*Reason/*State/*Status/...` | 168 |
| snake_case `*_kind/*_reason/...` | 186 |
| `*Config/*PolicyToml` | 76 |

再用 `gap.py` 把 97+168+186 个候选逐一 grep 本仓 5 大源码目录
（ai-service app/tests、shared、api、web），算机械零命中：event 77/97、kind 138/168、
snake_enum 139/186 **零命中**。这是全仓第一份"封闭集覆盖差距清单"。

## 3. 归属过滤 + 逐字确证（去噪音）

机械零命中含大量假阳性：Windows API（`NtCreateKeyedEvent`/`WSACreateEvent`）、
TLS 库错误串、拼接噪音。按 R18 教训做归属过滤后，挑出 5 条**真 Codex 语义、wire
值逐字确证、本仓确无封闭集**的轴，逐条 strings 精取锚：

| 轴 | 逐字确证锚 | 封闭集 |
|---|---|---|
| ReviewDecision | `ReviewDecision approved ... approved_for_session ... network_policy_amendment denied rejection timed_out abort` | 10 档 |
| McpStartupStatus | `internally tagged enum McpStartupStatus ... Starting Ready Cancelled completed declined` + `Failed with 2 elements` | 6 态 |
| PatchChangeKind | `internally tagged enum PatchChangeKind Add Delete FileUpdateChange kind diff` + `Update with 1 element` | 3 档 |
| GuardianAssessmentAction | 7 条 `struct variant ...::X with N elements` | 7 类 |
| ThreadStatus | `ThreadStatus notLoaded idle systemError active` + `Active with 1 element` + `restricted enabled` | 4 档 |

## 4. 交付物（5 模块 + 5 测试，全部新增独立模块，不碰他席在飞件）

| 文件 | 内容 |
|---|---|
| `app/core/review_decision.py` | ReviewDecision 十档封闭集 + ensure 守门 + is_terminal/is_amendment/is_retryable（本仓 guardian_risk 仅四档状态轴，互补） |
| `app/core/mcp_startup_status.py` | 六态封闭集（五 tagged 逐字 + Failed 变体）+ 终态/就绪/失败归类 + 值表可机检 |
| `app/core/patch_change_kind.py` | 三档封闭集 + is_add/delete/update/rename + 「只有 Update 可带 move_path」一致性判据 |
| `app/core/guardian_assessment_action.py` | 七类 action + 逐字元素数表 + is_privileged 风险归类 + 元素数可机检 |
| `app/core/thread_status.py` | 四档封闭集 + activeFlags 白名单 + 「只有 active 可带 flags」一致性判据 |
| `tests/test_<同名>.py` ×5 | 148 用例：封闭集/wire 逐字锚/守门/纯函数/反向变异 |

每模块 docstring 均标注：取证锚、本仓边界（互补不替换）、一轴超越、诚实边界
（哪些是逐字确证、哪些是本仓语义归类推定）。

## 5. 验证（全绿）

- **148 pytest passed**（5 文件，4.04s）
- **ruff 全绿**（10 文件；修 C401 生成器→推导式、I001 import 排序、SIM300、F401）
- **水印 10/10**（水印从同型文件逐字复制，未手敲不可见字符——R50 教训）
- **反向变异实证**：删除 `ReviewDecision.ABORT` 一档 → 4 测试转红；
  恢复 → 40 passed。证明封闭集判据真实有效。

## 6. 诚实边界

- 全量穷举是本仓第一份机械差距清单，但零命中≠真空白（同义不同名/他席在飞需人工核）；
  本报告只对 5 条做了逐字确证 + 边界核对后才落地。
- 各 enum 的**运行时触发条件**、serde tag 字段名、状态迁移序列多数未从二进制确证；
  `is_retryable`/`is_privileged`/`is_error` 是本仓语义归类，非对照原生判据。
- 全部为独立纯函数模块，**未接生产发射点**（guardian_risk/agent_loop_v2 等是他席在飞件，
  接入点留属主决策）——与前 55 轮同纪律。
- McpStartupStatus 的 `Failed` 是 struct variant（逐字），wire tag 字符串未确证，用变体名登记。

## 7. 后续可继续"榨干"的开放轴（机械清单已备）

差距矩阵里尚有 200+ 零命中候选未逐条确证，价值较高的下一批：
`HandshakeRejectReason`（7 命中）、`ReviewOutputEvent`、`ThreadGoalUpdatedEvent`、
`CommandExecutionApprovalDecision`（带 amendment 变体）、`GuardianApprovalReviewAction`
（4 类）、`RetryMode`/`RetryAction`、`ConfigLayerSource`（21 命中）、
`ExecServerNetworkPolicyDecision`。取证清单在 scratch（宿主会回收），但方法已固化为
本报告的 6 类正则 + gap.py 对照法，可随时重跑。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
