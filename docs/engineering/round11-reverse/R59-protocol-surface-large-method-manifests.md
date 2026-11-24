<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R59 —— 协议面封闭集：六族大方法清单（全量穷举法第四轮：从「语义 enum」到「RPC 方法/载荷名清单」）

> 续 R56/R57/R58「先穷举全集 → 对照算差距 → 归属过滤 → 批量复现」打法。R56 落 5 个纯值域轴，R57 落 5 个 struct-variant 轴，R58 横扫 95 个 struct-variant 家族里的**语义封闭值域**类（6 模块）。本轮吃下 R58 §7 明确留下的**大方法清单轴**：那些 variant 名是 RPC 方法名/事件载荷名、不是语义值的家族——立「协议面封闭集」新轴型，与语义 enum 正交。

## 1. 取证方法（本轮增量）

复用 R58 的穷举产物 `D:/DevEnv/Temp/r58/families.out`（mmap 流式抽 codex.exe 26.1111.2228.0，284 万 ASCII 串，`struct variant X::Y with N element` 正则机器反推 95 家族）。本轮新增：

1. **大清单族筛选**：从 95 家族里按 variant 数排序，取 N≥11 且名字符合 RPC 方法/事件载荷命名（PascalCase、域前缀）的 6 族（对应 R58 §7 点名的全部 6 族）。
2. **逐字表机器解析**：生成器 `D:/DevEnv/Temp/r59/gen.py` 从 `families.out` 直接解析 `variant→元素数` 表（187/11/28/16/14/13 项），**元素数零手敲**，漂移由单测表精确断言钉死。
3. **归属过滤（R18 纪律：零命中≠真空白）**：逐族 grep 本仓 app/core + tests + round11 报告（见 §2）。
4. **域归类全覆盖断言**：每族的「variant→协议面域」映射在生成期断言 `set(domain) == set(table)`，漏一个 variant 或塞一个多余项即生成失败。

**方法增量价值**：R58 只能处理「语义值」类家族（名即值）；本轮证明同一份穷举产物对「方法/载荷名清单」类家族同样可机检复现——元素数表从「恒 1 的语义标签」升级为「1~13 差异化的方法载荷签名」，一致性守门真正具备区分力。

## 2. 归属过滤（6 族全部确认为干净空白）

| 家族 | 本仓命中 | 判定 |
|---|---|---|
| `ClientRequest`(187) | core 零命中；仅 R58 报告自述 | **真空白**——RPC 方法面从未成集登记 |
| `ServerRequest`(11) | 命中均为 `execpolicy` approval 语义词，非方法名清单 | **真空白**——服务端→客户端请求方法未成集 |
| `RawTraceEventPayload`(28) | 命中为 `trace_context.py` 的 span 语义，非 payload variant 清单 | **真空白** |
| `ThreadItemPayload`(16) | 命中为 `stream_events.py` 的 `TurnItem` dict 判定，非 wire variant 清单 | **异层空白** |
| `ResponseItem`(14) | 12 文件命中，均为本仓 `ResponseItem = dict[str, Any]` 消息别名 | **异层空白**——刻意命名 `response_item_wire.py` 避开 |
| `RolloutItemWire`(13) | core 零命中（仅 `thread_rollout_truncation.py` 的 rollout 处理） | **真空白** |

同层排除：`TurnSteer` 命中实为 `turn_steerability.py` 的 `TurnSteerabilityError` 子串，非 `ClientRequest::TurnSteer` 方法，不构成冲突。

## 3. 交付（6 模块 + 6 测试，888 用例）

| 模块 | 封闭集（逐字元素数表） | 一轴超越 |
|---|---|---|
| `client_request_method.py` | 187 客户端 RPC 方法，元素数一律 2 | **42 首 token→方法族归类** + `classify_client_request_by_prefix` 与显式 `CLIENT_REQUEST_DOMAIN` **双路交叉校验**（两判据对 187 方法逐一必须一致） |
| `server_request_method.py` | 11 服务端请求方法，元素数一律 2 | 五类请求域（approval/auth/query/elicitation/tool）+ 可执行反查 |
| `trace_event_payload.py` | 28 trace 载荷，元素数 1~7 差异化 | 七类事件域 + 差异化元素数使 validate 守门有区分力 |
| `thread_item_payload.py` | 16 thread item 载荷，元素数 1~13 差异化 | 六类条目域 + 可执行反查 |
| `response_item_wire.py` | 14 response item 载荷，元素数 1~9 差异化 | 五类响应域 + 避开本仓 `ResponseItem=dict` 别名 |
| `rollout_item_wire.py` | 13 rollout item 载荷，元素数 1~2 | 八类回放域 + 可执行反查 |

统一设计沿用 R56-R58：`StrEnum` 逐字封闭集（真相源）+ `X_ELEMENTS` 逐字元素数表 + `X_DOMAIN` 归类表 + `xxx_names()` 副本返回 + `expected_*_count()` + `ensure_xxx()` 闭合 + `xxx_domain()` 归类 + `xxx_domain_members()` 反查 + `is_xxx()` 判定 + `validate_xxx(name,count)` 一致性守门 + 自定义错误类。`client_request_method` 额外提供**双路归类交叉校验**（本轮最强的可执行判据）。

**一轴超越的量化**：187 方法全表 + 42 族归类，把对照散落在协议分发 match 里的 187 个方法名首次成集钉死；R58 的语义 enum 模块都是 3~7 项单分类，本轮是数量级跃升 + 第二维交叉判据。

## 4. 验证（全绿）

- **888 pytest passed**（单 R59 六测试）/ **1293 passed**（R59 六测试 + R56/R57/R58 全量回归）
- **ruff 0.16.6 全绿**：生成器源头修双花括号（普通字符串误当 f-string）、set/list 比较、双逗号 import、`__PREFIX__` 占位符未替换；ruff --fix 清 6+7 处 I001 排序后复检 All checks passed
- **py_compile 12/12 OK**（含 ruff --fix 后复核）
- **水印 12/12**：从 HEAD 面 `post_turn_compact_threshold.py` 前 3 行逐字复制（避开他席在飞水印改动），未手敲不可见字符
- **三重反向变异实证**（自恢复脚本 `mutate_check.py`，try/finally 保证不泄漏）：
  - 删 `ClientRequestMethod.ThreadStart` 枚举成员 → 2 测试转红（基数 + 枚举值集），恢复 → 613 passed；
  - 篡改 `TraceEventPayload` 元素数 7→99 → 2 测试转红（精确表 + 差异化 sentinel），恢复 → 79 passed；
  - 篡改 `ServerRequest` 域映射 approval→auth → 1 测试转红（域归类 parametrize 点名），恢复 → 43 passed。
  - 恢复后逐字锚点复核 3/3 完好。

## 5. 诚实边界

- 6 族 variant 名与元素数逐字确证（`struct variant ... with N element` 声明机器反推 + `families.out` 落盘）。**serde tag 字段名/大小写 rename 未从二进制确证**（按 Rust variant 名逐字登记，同 R56-R58 先例）。
- 所有域归类（method_family/request/event/item/response/rollout domain）是**本仓语义归类**，非对照原生判据；`classify_client_request_by_prefix` 与 `CLIENT_REQUEST_DOMAIN` 本就是同一规则的两处实现（交叉校验防漂移），不是两个独立真相源。
- 各方法/载荷的运行时触发条件、携带字段语义、`by_prefix` 的 PascalCase token 切分边界（如 `GcpSetup`→`Gcp`、`OneOffCommandExec`→`One`）均按命名法推定，未从 disasm 确证。
- 全部未接生产发射点（6 族是他席在飞协议件周边，接入留属主）。

## 6. 落库与推送

- 饱和树走 `object-space-land.mjs` 精确 pathspec 落 12 文件（6 模块 + 6 测试 + 本报告），不碰他席 staged（当前工作树大量 `MM` 为他席水印欠账修复，本轮零触碰）。
- 推送状态见运行日志 R59 条：按 `git ls-remote origin refs/heads/main` sha 现读如实记录，不硬推、不用开关洗门。

## 7. 后续开放轴（`families.out` 仍备）

本轮吃下 R58 §7 点名的全部 6 族大清单。剩余高价值方向：
- **中等清单族**（N=3~7，约 80 个）：`GuardianApprovalReviewAction`/`GuardianAssessmentAction`(7)、`ConfigLayerSource`(7)、`ElicitationRequest`/`McpServerElicitationRequest`(5)、`UserInput`(5)、`LoginAccountParams`(4) 等——已落部分（R56/R57/R58），剩余按同法批量扫尾；
- **209 个 tagged enum 声明**尚未逐个反推值域（95 struct-variant 家族之外的另一批）；
- **unit-variant enum** 本轮 `unit variant` 正则 0 命中（对照可能用 `#[serde(rename)]` 或裸声明），需换取证法；
- `Message`(17)、`ElicitationRequest`(5) 等交互载荷清单可作 R60 候选；
- Ghidra 定向确证 serde tag 字段名（R53 轻量 xref 法 + `native-xref-probe.py` 可复用）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
