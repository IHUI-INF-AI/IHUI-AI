<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R58 —— 全量 struct-variant 家族横扫（全量穷举法第三轮：从「候选轴」升级到「整棵家族树」）

> 续 R56/R57「先穷举全集 → 对照算差距 → 批量复现」打法。R56 落 5 个纯值域轴，R57 落 5 个 struct-variant 轴（只反推 8 个候选）。本轮把 R57 的**元素数反推打法全集化**：一次扫出 codex.exe 里**所有**带元素数的 struct-variant enum 家族（95 个），机械对照本仓，再归属过滤批量复现——从「挑候选轴」升级到「整棵家族树横扫」。

## 1. 取证方法（本轮核心增量）

复用 stdlib mmap 流式抽取 codex.exe（26.1111.2228.0，365MB Rust PE）：

1. **全量串抽取**：`re.findall(rb"[\x20-\x7e]{5,}", mm)` 抽出 **2,840,484 条** ASCII 串（比 R56 的 157 万更全，因 minlen 降到 5）。
2. **全家族反推**：`struct variant (\w+)::(\w+) with (\d+) element` 正则扫全量串，按 enum 聚合 → **95 个 struct-variant 家族**，每个给出完整 variant→元素数表（`D:/DevEnv/Temp/r58/families.out`）。配套 209 个 internally/externally/adjacently tagged enum 声明。
3. **机械差距清单**：`family_gap.py` 把 95 家族逐一 grep 本仓 app/core + tests + round11 报告 → **60 个零命中**（`family_gap.out`）。
4. **归属过滤（零命中≠真空白，R18 纪律）**：同构去重 + 本仓近似排除 + 语义正交筛选 → 选 6 个高质量真空白轴（见 §2）。

**方法增量价值**：R57 靠「看 R56 §7 候选名字」选轴，本轮靠「整棵家族树 + 机器反推表」选轴——不遗漏、不重复、边界可机检。

## 2. 归属过滤（60 → 6）

| 过滤类型 | 家族 | 判定依据 |
|---|---|---|
| **同构去重** | `ExecFileSystemPath` / `RawFileSystemPath` | 与 `FileSystemPath` 元素数表**逐字同构**（GlobPattern/Path/Special 各 1）→ 只落一个 |
| 同构去重 | `HookHandlerConfig` | 与 `ConfiguredHookHandler` 同构（Command:6/McpTool:5）→ 均跳过（值域薄） |
| 同构去重 | `TaggedPermissionProfile` | 与 `ExecPermissionProfile` 同构（External/Managed）→ 跳过 |
| 本仓近似 | `ToolCallKind`(mcp/other) / `WireResult`(ok/err) / `McpContent`(text/resource) | 本仓语义已广布 → 跳过 |
| 非封闭集 | `ClientRequest`(187) / `ServerRequest`(11) / `RawTraceEventPayload`(28) | 是 RPC 方法清单/事件载荷，variant 名是方法名非语义封闭值域 → 本轮跳过（留作另一轴型） |
| **落地** | `CodexErrorInfo`(5) | 零命中；本仓 `turn_error_code.py` 是 turn 终态原因，本轴是 codex 服务端错误 info payload 变体（不同层）；呼应 R51/R52 steer 轴 |
| **落地** | `ModelProviderError`(3) | 零命中；本仓 `model_reroute_reason.py` 是重路由原因（不同轴） |
| **落地** | `ScheduledTaskSchedule`(4) | 零命中；贴合项目定时调度域但属对照 codex 调度频率，不替换本仓 user_automations |
| **落地** | `ReviewTarget`(3) | `ReviewTarget`/`BaseBranch` 零命中；本仓 `review_decision/findings` 是评审结果与发现，非目标定位 |
| **落地** | `FileSystemPath`(3) | `GlobPattern`/`FileSystemPath` 零命中；三族同构选一 |
| **落地** | `McpServerValueMatcher`(3) | 零命中；本仓无「MCP 配置值怎么匹配」模式封闭集 |

## 3. 交付（6 模块 + 6 测试，207 用例）

| 模块 | 封闭集（逐字元素数表） | 一轴超越 |
|---|---|---|
| `codex_error_info.py` | ActiveTurnNotSteerable:1, HttpConnectionFailed:1, ResponseStreamConnectionFailed:1, ResponseStreamDisconnected:1, ResponseTooManyFailedAttempts:1 | 五分类 + 一致性守门 |
| `model_provider_error.py` | ModelProviderMismatch:2, ModelProviderNotConfigured:1, ModelProviderPolicyConflict:2 | 三分类 + 守门 |
| `scheduled_task_schedule.py` | Daily:1, Hourly:2, Weekly:2, Weekdays:1 | 四分类 + 区间档元素数判据 + 守门 |
| `review_target.py` | BaseBranch:1, Commit:2, Custom:1 | 三分类 + 守门 |
| `file_system_path.py` | GlobPattern:1, Path:1, Special:1 | 三分类 + **三族同构别名机检** + 守门 |
| `mcp_server_value_matcher.py` | Exact:1, Prefix:1, Regex:1 | 三分类 + **可执行 match_value 三模式匹配**（比 R56/R57 多走一步）+ 守门 |

统一设计：逐字 variant→元素数表（`X_ELEMENTS`）+ 语义分类纯函数（本仓归类，docstring 明示）+ `validate_x(name,count)` 一致性守门 + `*_names()` 副本返回 + 自定义错误类。`file_system_path` 额外钉死三族同构别名；`mcp_server_value_matcher` 额外提供表驱动可执行判据。

## 4. 验证（全绿）

- **207 pytest passed**
- **ruff 全绿**：生成器源头修 F821（codex_error_info 的 extra_imports 漏 `ERROR_INFO_FAMILY`）+ I001 排序（ruff --fix 后水印复核 12/12 完好）
- **py_compile / AST 语法**：12/12 OK
- **水印 12/12**：从同型文件 `post_turn_compact_threshold.py` 逐字复制头，未手敲不可见字符
- **双重反向变异实证**：
  - 删 `McpServerValueMatcher.Regex` 档 → **7 测试转红**（元素数表/分类/可执行 match_value/守门同时失配），恢复 → 35 passed；
  - 篡改 `ScheduledTaskSchedule.Hourly` 元素数 2→9 → **2 测试转红**，恢复 → 37 passed。

## 5. 诚实边界

- 六族 variant 名与元素数逐字确证（`struct variant ... with N element` 声明 + 长连体串双证）；**serde tag 字段名/大小写 rename 未从二进制确证**（按 Rust variant 名逐字登记，同 R56/R57 先例）。
- 各档运行时触发条件未确证；`Regex` 的正则方言/大小写敏感性、`Custom`/`Special` 携带字段语义、`Hourly`/`Weekly` 第 2 元素含义均未确证。
- 所有分类（family/kind/frequency/target/mode）是本仓语义归类，非对照原生判据；`match_value` 按 Python re 实现，语义推定。
- `ClientRequest`/`ServerRequest`/`RawTraceEventPayload` 是大 variant 数**方法/载荷清单**，本轮按纪律跳过（非语义封闭值域），是下一轮另一轴型候选。
- 全部未接生产发射点（error/provider/schedule/review/path/matcher 是他席在飞核心件，接入留属主）。

## 6. 落库与推送

- 饱和树走 `object-space-land.mjs` 精确 pathspec 落库（commit 见运行日志），不碰他席 staged。
- 推送状态见运行日志 R58 条（据 47p/302p 门与 origin sha 现读如实记录）。

## 7. 后续开放轴（机械清单 `families.out` / `family_gap.out` 仍备）

本轮横扫了 struct-variant 家族里的**语义封闭值域**类。剩余高价值方向：
- **大方法清单轴**：`ClientRequest`(187)/`ServerRequest`(11)/`RawTraceEventPayload`(28)/`ThreadItemPayload`(16)/`ResponseItem`(14)/`RolloutItemWire`(13)——是 RPC 方法/事件载荷名清单，可按「方法族归类 + 元素数表」另立**协议面封闭集**轴型（与语义 enum 不同）；
- **同构别名族**：`ConfiguredHookHandler`/`HookHandlerConfig`、`ExecPermissionProfile`/`TaggedPermissionProfile` 值域薄，待更强的语义锚再落；
- **209 个 tagged enum** 声明尚未逐个反推值域（本轮只处理带 struct variant 的 95 个）；
- **unit-variant enum**：本轮 `unit variant` 正则 0 命中（对照可能用 `#[serde(rename)]` 或裸声明），需换取证法；
- Ghidra 定向确证 serde tag 字段名（R53 轻量 xref 法 + native-xref-probe.py 可复用）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
