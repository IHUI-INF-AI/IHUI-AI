<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R57 —— codex 26.1111 IPC/config struct-variant 封闭集批量复现（全量穷举法第二轮）

> 续 R56「先穷举全集 → 对照算差距 → 批量复现」打法。R56 从 157 万串里落了 5 个纯值域轴；本轮专攻**带元素数的 struct variant** 家族（`struct variant X::Y with N element`），这是 R56 §7 开放清单里质量最高的一类——每个 variant 名与元素数都从二进制逐字反推，封闭集边界硬、可机检、可反向变异。

## 1. 取证方法与全量反推

复用 R56 的 `exhaust.out`（1,575,334 串，6 类正则归类）与 `gap.py` 机械零命中清单，不重扫 365MB。对 §7 开放轴做两轮 strings 精取：

1. **值域锚**：短串优先、去重，取每个 enum 的 `internally tagged enum X` 声明 + 长连体串（含各 variant 名逐字）。
2. **元素数全反推**：正则 `struct variant X::(\w+) with (\d+) element` 扫全量串，按 enum 聚合去重，得到完整 variant→元素数表。这是本轮关键——**元素数从二进制声明机器提取，非人工估**。

例：`GuardianApprovalReviewAction` 反推出 7 类，元素数 `{Execve:4, Command:3, WriteStdin:4, ApplyPatch:2, McpToolCall:5, NetworkAccess:4, RequestPermissions:2}`。

## 2. 归属过滤（零命中≠真空白，R18 纪律）

| 候选轴 | 反推结果 | 判定 |
|---|---|---|
| HandshakeRejectReason | 3 variant 逐字 | ✅ 落（全仓零命中） |
| ConfigLayerSource | 7 variant 逐字 | ✅ 落（全仓零命中） |
| CommandExecutionApprovalDecision | 2 struct variant 逐字 | ✅ 落（全仓零命中；只覆盖带 amendment 的 struct 档，诚实不全集） |
| HostResponse | 4 variant 逐字 | ✅ 落（全仓零命中） |
| HostToClient | 6 variant 逐字 | ✅ 落（全仓零命中） |
| **GuardianApprovalReviewAction** | 7 variant，元素数与 R56 `guardian_assessment_action` **逐字同构** | ❌ 跳过——同一 enum 两个名字，落地即重复 |
| **ExecServerNetworkPolicyDecision** | 2 variant（Ask/Deny） | ❌ 跳过——本仓 `network_policy_decision.py` 已覆盖 ask/deny 语义，归互补 |
| RetryMode / RetryAction | 仅解析错误串与单条 `RetryForbidden` 日志 | ❌ 跳过——非封闭集轴（解析/分类路径），值域不可钉 |
| ReviewOutputEvent / ThreadGoalUpdatedEvent | 是带字段的**事件载荷**（findings/goal 等），非 enum | ❌ 跳过——字段级载荷轴，不是封闭集 |
| NetworkPolicyDecision | 反推 0 个 struct variant | ❌ 跳过——unit variant enum，无元素数锚 |

**关键归属发现**：GuardianApprovalReviewAction 与 R56 已落地模块逐字同构——二进制里同一语义 enum 有两个类型名（`GuardianAssessmentAction` / `GuardianApprovalReviewAction`），若不做反推表比对就会重复落地。这正是「先反推元素数表再对照」比「看名字下轴」更稳的证据。

## 3. 交付（5 模块 + 5 测试，198 用例）

| 模块 | 封闭集 | 元素数表（逐字） | 一轴超越 |
|---|---|---|---|
| `handshake_reject_reason.py` | 3 | InvalidHello/NoCompatibleVersion/MissingRequiredCapability 各 1 | 三分类 hello_malformed/version/capability + 一致性守门 |
| `config_layer_source.py` | 7 | EnterpriseManaged:2, Mdm:2, User:2, 其余 1 | 三作用域 managed/user/system + 优先级表 + 守门 |
| `command_execution_approval_decision.py` | 2 | 两档各 1 | amendment 归类 execpolicy/network + 守门 |
| `host_response.py` | 4 | 全 1 | 生命周期阶段分类 + 终态判据 + 守门 |
| `host_to_client.py` | 6 | DelegateRequest:3, 其余 1/2 | 四消息族分类 + 委派判据 + 守门 |

统一设计（比纯 StrEnum 更硬）：
- **逐字 variant→元素数表**：`X_ELEMENTS: dict[str, int]`，pytest 钉死逐字值，任何元素数被篡改即转红。
- **语义分类纯函数**：每轴一个 `*_family/scope/phase/kind`（本仓语义归类，docstring 明示非对照原生判据）。
- **一致性守门**：`validate_x(name, count)` 同时校验 variant 名与元素数匹配。
- `*_names()` 返回可变副本（调用方改不动真相源）。

## 4. 验证（全绿）

- **198 pytest passed**（3.41s / 8.00s 两轮）
- **ruff 全绿**：生成器源头修 C401（`set(genexpr)`→推导式）、F811（重名测试）、I001、SIM300；`ruff --fix` 仅修 4 项可修项后水印复核 5/5 完好（R50 教训：--fix 后必查水印）
- **py_compile / AST 语法**：5/5 OK
- **水印 10/10**：从同型文件 `post_turn_compact_threshold.py` 逐字复制头，未手敲不可见字符
- **反向变异实证**：真删 `config_layer_source` 的 `Mdm` 档 → **6 测试转红**；恢复 → 58 passed。证明元素数表/分类/守门判据真实有效

## 5. 诚实边界

- variant 名与元素数逐字确证；**serde tag 字段名 / 大小写 rename 未从二进制确证**（按 Rust variant 名逐字登记，同 R56 mcp_startup_status 先例）。
- 各档**运行时触发条件**（谁产出 InvalidHello / Mdm）未确证。
- 所有分类（family/scope/phase/kind）与优先级表是**本仓语义归类**，非对照原生判据。
- CommandExecutionApprovalDecision 只覆盖**带 amendment 的 2 个 struct variant**；是否存在别的 unit 决策档（裸 Accept/Deny）未从 `struct variant` 声明确证——诚实不全集声明。
- 全部未接生产发射点（IPC/config 路径是他席在飞核心件，接入留属主）。

## 6. 落库与推送

- 饱和树走 `object-space-land.mjs` 精确 pathspec 落库（commit 见运行日志），不碰他席 staged。
- 推送状态见运行日志 R57 条（据当时 302p 门与 origin sha 现读如实记录）。

## 7. 后续开放轴（机械清单仍备）

本轮反推表已定「带元素数 struct variant」家族大部。剩余高价值方向：
- 把 `HostToClient::DelegateRequest::Notify/InvokeTool` 子变体、`HostResponse` 各档字段表继续下潜；
- 反推其它带元素数 enum（`SandboxPolicy` / `ReviewTarget` / `FileChange` / `ConfiguredHookHandler` 等 exhaust.out 已列）；
- 对 R56/R57 全部 10 个模块补 Ghidra 定向反编译，确证 serde tag 真实 wire 名（当前按 Rust variant 名逐字登记）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
