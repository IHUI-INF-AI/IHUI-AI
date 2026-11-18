<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R82 — 地址级归属：否证 #8，并量出 1/11 的误配率

## 1. 想验证的假设

serde 生成代码会同时触及两个常量：字段数组（`FIELDS`，16 B 记录表）与 `expecting` 文案（`struct X with N elements`）。两者通常在同一次 `deserialize` 里被引用 ⇒ 若某个数组的 `lea` 与某个模板的 `lea` 落在**同一函数**，该数组即属于该结构。这条路不需要池、不需要名字集，能覆盖池为空的那 1135 个结构。

## 2. 否证 #8：模板没有任何 lea

| 项 | 值 |
| --- | --- |
| 模板总数 | 3186 |
| **其中被任何 `lea` 指向的** | **0** |
| 记录数组（run）被 `lea` 指向的 | 2141 / 4005 |
| 含模板 lea 的函数 | 0 |
| 含数组 lea 的函数 | 4152 |
| **两者都含的函数** | **0** |

读数很干净：**数组有 xref，模板一个都没有**。因此"同函数配对"在原理上不可能成立——模板字符串是通过指针表/常量池引用的，不是逐条 `lea`。

这一条同时解释了一个此前的疑点：R72 里那个 `struct ThreadSta…` 模板 `lea 0x151b6a5bc` 是函数级走查里手工认出来的，全量 `lea` 表里并不存在，所以它不能推广成通用判据。

## 3. 改地址级判据

判据：**run 的每个 `ptr` 都落在某个模板前面的池区间内 ∧ run 长度 == 该模板的 arity**。

这是地址级证据（用指针值，不用名字集），理论上强于 R81 的包含式。

| 项 | 值 |
| --- | --- |
| 池（模板前 ≥4 B 的连排区） | 1900 |
| **所有 ptr 落在同一池的 run** | **22** |
| 其中长度 == arity 的结构 | **11** |

命中的 11 个：`ByteRange`(2) `DiscoveredPluginFiles`(3) `ElicitationCapability`(2) `FsChangedNotification`(2) `HostHello`(2) `ModelProviderCapabilities`(3) `TextPosition`(2) `WalkOutcome`(3) `WindowsSandboxProvisioningSettings`(2) `WireNestedToolCall`(5) `WireToolName`(2)。

## 4. 关键读数：误配率 1/11

把 11 个的字段名全部读回来后逐条做语义对照：

| 结构 | 读到的字段 | 判定 |
| --- | --- | --- |
| `FsChangedNotification` | `watchId, changedPaths` | 自洽 |
| `TextPosition` | `line, column` | 自洽 |
| `HostHello` | `selectedVersion, capabilities` | 自洽 |
| `WireToolName` | `name, namespace` | 自洽 |
| `WireNestedToolCall` | `cell_id, runtime_tool_call_id, tool_name, tool_kind, input` | 自洽 |
| `ModelProviderCapabilities` | `cyber_access_programs, external_web_access, remote_compaction` | 自洽 |
| `WalkOutcome` | `entries, errors, truncated` | 自洽 |
| `DiscoveredPluginFiles` | `manifest, mcpConfig, appsConfig` | 自洽 |
| `WindowsSandboxProvisioningSettings` | `proxy_ports, allow_local_binding` | 自洽 |
| `ElicitationCapability` | `threadId, sessionId` | 自洽 |
| **`ByteRange`** | **`credential_export, delivery`** | **错配** |

`ByteRange` 是一对字节偏移（起、止），读出来却是 `credential_export, delivery`——语义完全不搭。

**根因**：池 A 是混排池（R74 实测 50 段里含多个结构的名字）。一个无关的 2 元素数组，其两个 ptr 恰好都落在池 A 内，而 `ByteRange` 的 arity 也是 2 ⇒ 判据通过。这不是实现 bug，是判据本身的假阳性。

所以：

- `ADDRESS_LEVEL_ATTESTED = False`
- `MISFIT_COUNT = 1`、`misfit_rate() = 1/11 ≈ 0.0909`（**实测，不是估计**）
- `SEMANTIC_MISFIT = ("ByteRange",)`，且校验器禁止"错配件同时被算作增益"

这是本轮最实的产出：**一条看似更强的地址判据，被实测量出了 9% 的误配**。它同时说明 R81 那 23 条包含式认领也需要同样的语义复核——包含式判据只会更松。

## 5. 净增量

11 个里有 4 个此前不在 R75/R80/R81 的表内：

- `ElicitationCapability`(2, `0x151a69138`) — `threadId, sessionId`
- `FsChangedNotification`(2, `0x151be2ba8`) — `watchId, changedPaths`
- `TextPosition`(2, `0x151be2f30`) — `line, column`
- `WindowsSandboxProvisioningSettings`(2, `0x15246fe08`) — `proxy_ports, allow_local_binding`

四个的字段都语义自洽。覆盖 **301 → 305**。

**但必须连带说明**：305 = 278（精等判据）+ 23（包含式）+ 4（地址级），三种强度不同，对外不能合并成"305 个已认证结构"。

## 6. 交付

`apps/ai-service/app/core/struct_pool_address_attribution.py`

- `TEMPLATE_TOTAL=3186`、`TEMPLATES_WITH_LEA=0`、`FALSIFICATION_ID="template-has-no-lea-site"`
- `FIELDS_RUNS_TOTAL=4005`、`RUNS_WITH_LEA=2141`、`POOLS=1900`、`RUNS_SINGLE_POOL=22`
- `ADDRESS_HITS`: 11 项 `(arity, 数组地址, 字段序)`
- `SEMANTIC_MISFIT=("ByteRange",)`、`MISFIT_COUNT=1`、`misfit_rate()`
- `NEW_STRUCTS`（4 项）、`COVERAGE_BEFORE=301`、`COVERAGE_AFTER=305`
- `ATTRIBUTION_RULE="all-pointers-inside-one-pool-and-length-equals-arity"`、`ADDRESS_LEVEL_ATTESTED=False`
- `fields_by_address()` / `validate_address_attribution()` / `address_attribution_summary()`

校验器拦：错配件被算作新结构、`ATTESTED` 被改 True、命中数超过通过池测的 run 数、覆盖算术不符、字段数与 arity 不符。

## 7. 验证

| 项 | 结果 |
| --- | --- |
| pytest | **14 passed** |
| ruff | All checks passed |
| mypy（单文件） | no issues |

生成器两处修正都发生在源头：单元素元组漏尾逗号（导致 `SEMANTIC_MISFIT` 变成字符串）、变异测试未同步 `NEW_COUNT`。没有用 `ruff --fix` 兜。

## 8. 诚实边界

1. **判据有 9% 实测误配率**，因此不认证；每条留数组地址可复核。
2. 22/4005 这个命中率极低——因为大多数结构的字段名并不聚集在单一池里（R76 已证池是分片的）。
3. `ByteRange` 的错配是"池混排 + arity 撞号"共同造成的，换成更严的池定义（排除混排池 A）或许能消掉，但会同时削掉真命中，本轮不做。
4. 字段顺序仍是数组记录序，未验证是否等于声明序（R80 的未判定延续）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
