<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R81 — under 结构用部分名字认领 FIELDS 数组：+23 结构、+162 字段

## 1. 思路

R75 有 1072 个 site 切出的名字数 **少于** arity——池不完整，拿不到全字段。R80 从 `.rdata` 里读出了 4005 个 FIELDS 记录数组。

把两边接起来：一个 under 结构的**部分名字集 M**（≥3 个）如果被**某一个**长度 == 目录 arity 的数组**包含**，那么这个数组就是它的完整字段表。

这一步的价值不在"多认出几个结构"，而在于：**池给不了完整字段，数组能。**

## 2. 读数

| 读数 | 值 |
| --- | --- |
| 有 ≥3 个部分名的 under 结构 | **167**（359 个 site） |
| **唯一认领成功** | **23** |
| 匹配到多个数组（歧义） | 16 |
| 认领到的字段总数 | **162** |

### 23 个认领的代表样本

| 结构 | arity | 数组地址 | 字段 |
| --- | --- | --- | --- |
| `CompactedItemWire` | 13 | `0x152224e10` | `message, replacement_history, replacement_history_metadata, guardian_history, retained_context, mcp_resource_origins…` |
| `CollabAgentSpawnEndEvent` | 10 | `0x152243b20` | `call_id, completed_at_ms, sender_thread_id, new_thread_id, new_agent_nickname, new_agent_role…` |
| `ModelUsage` | 13 | `0x15236f018` | `model, speed, credits, cost_usd, users, threads…` |
| `FsGetMetadataResponse` | 6 | `0x151ea7158` | `isDirectory, isFile, isSymlink, size, createdAtMs, modifiedAtMs` |
| `Error` | 6 | `0x151ac0c88` | `type, code, message, plan_type, resets_at, misalignment` |
| `CodexWorkspaceMessage` | 5 | `0x1519cb5d0` | `message_id, message_type, message_body, created_at, archived_at` |
| `ChannelPermissions` | 4 | `0x151a5fbe8` | `read, post, reply, edit_metadata` |
| `OAuthSessionConfig` | 7 | `0x151cb8f68` | `authorization_url, token_url, device_authorization_url, client_id, resource, scopes…` |

`FsGetMetadataResponse` 那组 `isDirectory / isFile / isSymlink / size / createdAtMs / modifiedAtMs` 在语义上完全自洽；`ChannelPermissions` 的 `read / post / reply / edit_metadata` 同理。这类自洽是弱判据之外的一个旁证。

## 3. 覆盖变化

| 项 | R78 | R81 |
| --- | --- | --- |
| 有字段名表的结构 | 278 | **301** |
| 字段（新增部分） | — | +162 |

## 4. 判据强度：必须标为未认证

`M ⊆ array` 是**包含**，不是相等。3 个名字的部分集落在同长度但无关的数组里，在原理上是可能的（尤其 arity 小的结构：4 字段的数组共 519 个，任取 3 个名字都可能蒙中）。

因此：

- `PARTIAL_CLAIMS_ATTESTED = False`
- `CLAIM_RULE = "partial-name-set-subset-of-array"`
- 每条都带**数组地址**，可独立复核（这是把弱判据变成"可复核线索"而不是"结论"的手段）
- 模块把"把 `ATTESTED` 改成 True"写成会抛异常的操作

16 个歧义结构**没有**强行选一个数组，只留名字。

## 5. 交付

- `apps/ai-service/app/core/struct_partial_run_claims.py`
  - `CLAIMS`: 23 项 `(arity, 数组地址, 完整字段序)`
  - `AMBIGUOUS`（16 名）、`UNDER_STRUCTS_WITH_3_NAMES = 167`、`UNDER_SITES = 359`
  - `TOTAL_CLAIMED_FIELDS = 162`、`COVERAGE_BEFORE = 278`、`COVERAGE_AFTER = 301`
  - `claim_of(name)` / `validate_partial_claims()` / `partial_claims_summary()`
  - 校验：每项 `len(fields)==arity` ∧ 无重复 ∧ 地址为 hex ∧ 覆盖算术自洽 ∧ 每条 ≥3 字段；且与 R77 目录的 arity 相符（测试里逐条断言 `arity in arities_of(name)`）
- `apps/ai-service/tests/test_struct_partial_run_claims.py`：11 例

## 6. 验证

| 项 | 结果 |
| --- | --- |
| pytest | **11 passed** |
| ruff | All checks passed（源头修两处 Yoda + 一处 import 排序） |
| mypy（单文件） | no issues |

## 7. 诚实边界

1. **包含式判据弱于 R75 的精确相等**，23 条中理论上有误配空间；本轮不做概率估计，只保证"唯一数组 + 长度==arity + 地址可复核"。
2. **只对 ≥3 个部分名的 under 结构有效**（167/1158）。1–2 个部分名的结构容易被误配，直接排除。
3. **歧义 16 个未裁决**：同一结构匹配到多个数组，可能是同名多副本（R77 的 22 个 arity 变体）导致。
4. **字段顺序**来自数组记录序，本轮仍未验证"记录序 = 声明序"（R80 的未判定延续到这里）。
5. 301 这个覆盖数**混合了两种强度**：278（精等判据）+ 23（包含判据）。对外表述必须分开，不能合并成"301 个已认证结构"。

## 8. 下一步的判据出口

要把 23 条升级为认证，需要第三种判据。可行的一条：**该数组的名字集与 R77 目录的 arity 变体逐个比对**——若某结构在目录里只有一个 arity 且数组唯一，则误配概率显著下降；若同时确认该数组被某处代码引用（`lea` 到数组首地址），则可升为认证。后者需要走函数级 xref，成本与 R72 同级。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
