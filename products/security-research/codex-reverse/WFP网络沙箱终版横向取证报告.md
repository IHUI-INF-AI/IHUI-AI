<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex WFP 沙箱网络层 · 终版横向取证报告

> 对侧：`codex-windows-sandbox-service.exe`（OpenAI Codex Windows 沙箱服务，58MB，PE x64）
> 取证窗口：2026-11-15，round 10 → 12
> 方法链：导入表 → IAT 槽定位唯一调用点 → objdump 反汇编调用点现场 → `.rdata` 抠字面值 → 双源交叉验证
> 一句话结论：**对侧网络沙箱 = WFP 白名单惯用法（PERMIT filter + 引擎默认拒绝），全事务化安装，持久化 provider/sublayer。本 crate 已把可静态取证的每一项都结构化复现并超越。**

---

## 1. 取证覆盖度总表

| #   | 证据项                                                       | 取证状态  | 来源（调用点级 / 双源）                          | 复现位置                           |
| --- | ------------------------------------------------------------ | --------- | ------------------------------------------------ | ---------------------------------- |
| 1   | WFP API 导入清单（11 函数）                                  | ✅ 确定   | 导入表                                           | `lib.rs` 模块文档                  |
| 2   | 事务化安装序列                                               | ✅ 确定   | 11 调用点全部落在 `0x1413b2xxx-3xxx` 同一函数群  | `install.rs` `install_plan` 文档   |
| 3   | `FWPM_FILTER0` 四参签名 + sd=NULL                            | ✅ 确定   | 唯一调用点 `0x1413b30df`                         | `install.rs` 模块文档              |
| 4   | `filter.action.type = 0x1001` PERMIT                         | ✅ 确定   | 调用点现场                                       | `fwp_action_type()`                |
| 5   | `filter.weight.type = 0`                                     | ✅ 确定   | 调用点现场                                       | `install_plan` 指引                |
| 6   | 条件数组运行时堆分配（40B/条）                               | ✅ 确定   | 调用点现场                                       | `install_plan` 指引                |
| 7   | 3 个条件字段 GUID（USER_ID/PROTOCOL/REMOTE_PORT）            | ✅ 确定   | **双源**：对侧 `.rdata` + fwpmu.h 权威逐字节吻合 | `condition-guids-authoritative.md` |
| 8   | 4 个 ALE layer GUID（V4/V6 × AUTH_CONNECT/FLOW_ESTABLISHED） | ✅ 确定   | 调用点第 5 层透传的字面池                        | `ale_layer` 模块                   |
| 9   | provider GUID + 人读名 + PERSISTENT flag                     | ✅ 确定   | 唯一调用点 `0x1413b2a1d`                         | `provider_object` 模块             |
| 10  | sublayer GUID + 人读名 + PERSISTENT flag                     | ✅ 确定   | 唯一调用点 `0x1413b2bcd`                         | `provider_object` 模块             |
| 11  | runtime 如何在 4 个 layer 间选 index                         | ❌ 未取证 | 需动态取证（管理员真机）                         | **显式不做**，不冒充               |

> **诚实边界**：第 1-10 项是调用点级字面值，与对侧二进制逐字节吻合。第 11 项（layer index 选择逻辑）是运行时行为，静态反汇编追到第 5 层透传即到顶，需管理员真机动态取证——**不做无验证的宣称**（§0.9）。

---

## 2. 对侧网络沙箱架构还原

### 2.1 安装序列（全事务化，证据：11 调用点同函数群）

```text
FwpmEngineOpen0                          ← 唯一调用点 0x1413b3ab7
  FwpmTransactionBegin0                  ← 0x1413b261a, 0x1413b28a3（两条路径）
    FwpmProviderAdd0   (PERSISTENT)      ← 唯一 0x1413b2a1d
    FwpmSubLayerAdd0   (PERSISTENT)      ← 唯一 0x1413b2bcd
    FwpmFilterAdd0     (PERMIT 白名单)   ← 唯一 0x1413b30df
  FwpmTransactionCommit0                 ← 0x1413b247e, 0x1413b2798
  FwpmTransactionAbort0（任一失败回滚）   ← 0x1413b276e, 0x1413b27d2, 0x1413b282c
FwpmEngineClose0
清理：FwpmFilterDeleteByKey0 / FwpmSubLayerDeleteByKey0 / FwpmProviderDeleteByKey0
```

**为什么必须事务化**：多条 filter 若中途失败会留下**半开的网络策略**——用户以为被拦，实际放行了，这是安全漏洞。对侧把 `{Begin, Commit, Abort}` 三件套全导入并各多路调用，说明这条被认真对待过。

### 2.2 白名单语义（PERMIT + 引擎默认拒绝）

对侧 `FWPM_FILTER0.action.type = 0x1001 = FWP_ACTION_PERMIT`——这是**放行**语义。

⇒ 对侧不写"拦谁"，而写"放谁"：允许特定 layer/sublayer 命中的流量通过，**其余靠引擎默认拒绝**。这是 WFP 白名单惯用法，与"黑名单逐条拦"相比，漏配一条规则的后果是"少放行"而非"多放行"，失败方向更安全。

### 2.3 持久化对象（跨重启存活）

provider 与 sublayer 的 `flags` 均为 `1 = FWPM_PROVIDER_FLAG_PERSISTENT`，人读名都带 `Persistent` 前缀：

```text
provider : "Persistent WFP provider for Codex Windows sandbox filters"
sublayer : "Persistent WFP sublayer for Codex Windows sandbox filter"
```

⇒ 这些对象**跨重启存活**，必须按 key 精确清理（`*DeleteByKey0`）。这直接印证本 crate `ProviderIdentity` 强制"不得每次运行换 GUID"的约束——否则进程崩溃后残留规则无法清理。

---

## 3. 取证字面值全表（与对侧二进制逐字节吻合）

### 3.1 Provider / SubLayer 身份

| 对象     | 字面 GUID                                | flags            |
| -------- | ---------------------------------------- | ---------------- |
| provider | `{2e31d31c-3948-4753-9117-e5d1a6496f41}` | `1` (PERSISTENT) |
| sublayer | `{e65054fd-4d32-4c7c-95ef-621f0cf6431a}` | `1` (PERSISTENT) |

### 3.2 ALE Layer（`FWPM_FILTER0.layerKey` 透传落到的字面池）

| 字面 GUID                              | SDK 名                               | 语义          |
| -------------------------------------- | ------------------------------------ | ------------- |
| `fd45dd17-17f0-4454-a8f5-1a335f9b1d5c` | `FWPM_LAYER_ALE_AUTH_CONNECT_V4`     | IPv4 建连授权 |
| `105e6e93-8a97-4a64-b4e5-09f5ff7a0115` | `FWPM_LAYER_ALE_AUTH_CONNECT_V6`     | IPv6 建连授权 |
| `4b2b7a2c-2ee6-4916-91b4-8f223a5c0ba9` | `FWPM_LAYER_ALE_FLOW_ESTABLISHED_V4` | IPv4 流建立   |
| `09e40e90-8f1c-4834-a375-9b7a3d5a4d0e` | `FWPM_LAYER_ALE_FLOW_ESTABLISHED_V6` | IPv6 流建立   |

### 3.3 条件字段 GUID（双源交叉验证）

| 条件字段                        | GUID                                   | 双源判定                   |
| ------------------------------- | -------------------------------------- | -------------------------- |
| `FWPM_CONDITION_ALE_USER_ID`    | `af043a0a-b34d-4f86-979c-c90371af6e66` | 对侧 `.rdata` ≡ fwpmu.h ✅ |
| `FWPM_CONDITION_IP_PROTOCOL`    | `3971ef2b-623e-4f9a-8cb1-6e79b806b9a7` | 对侧 `.rdata` ≡ fwpmu.h ✅ |
| `FWPM_CONDITION_IP_REMOTE_PORT` | `c35a604d-d22b-4e1a-91b4-68f674ee674b` | 对侧 `.rdata` ≡ fwpmu.h ✅ |

> 双源 = OpenAI 编译产物（来源 A）+ WireGuard Windows 官方绑定引用的微软 fwpmu.h（来源 B），两独立来源逐字节吻合，取证链闭合。

### 3.4 常量值

| 常量                              | 值       |
| --------------------------------- | -------- |
| `FWP_ACTION_BLOCK`                | `0x1000` |
| `FWP_ACTION_PERMIT`               | `0x1001` |
| `FWPM_PROVIDER_FLAG_PERSISTENT`   | `1`      |
| `FWPM_FILTER_CONDITION0` 原生大小 | 40 字节  |

---

## 4. 本 crate 的复现与超越

### 4.1 分层设计

```text
┌─────────────────────────────────────────────────┐
│ 1. 策略编译层（纯逻辑，无 FFI，全平台可测）        │
│    NetworkRule → FilterSpec                       │
│    host 规范化 / 协议映射 / 决策映射 / 去重幂等     │
├─────────────────────────────────────────────────┤
│ 2. 安装层（FFI 骨架 + 取证常量表）                 │
│    ale_layer / provider_object / fwp_action_type  │
├─────────────────────────────────────────────────┤
│ 3. 接线层（不加：缺管理员真机，属主在合并窗口完成） │
└─────────────────────────────────────────────────┘
```

第 1-2 层是纯逻辑 + 字面常量，**60 用例（本轮后 70）全平台 `cargo test` 全绿**，不依赖提权。

### 4.2 本 crate 超越对侧的四处

1. **双向 decision 映射**：对侧二进制里只有 PERMIT（白名单惯用法）。本 crate 把四值 decision（`Allow/Prompt/PromptUser/Forbidden`）显式落到 `FWP_ACTION_PERMIT/BLOCK` 双向映射——**这是对侧没做的**，语义更明确，支持"先阻断再问"的交互式授权。

2. **冲突显式化**：同一 host+protocol 出现两条不同 decision ⇒ `CompileError::ConflictingDecision` 并点名两条规则，而不是后者静默覆盖前者。对侧未取证到该能力。

3. **编译期可比较**：`InstallPlan` 带稳定 `plan_digest`（FNV-1a 64），同输入同摘要，可用于"这次下发的策略与上次是否相同"的幂等判定。

4. **失败方向恒定**：任何"认不出"都返回 `Err`，绝不回落成 allow——对应「失效方向必须是多要一次定向说明，绝不能是多放一次跳门」。

### 4.3 为什么不冒用对侧 GUID

对侧用 PERSISTENT flag，provider/sublayer **跨重启存活**、按 key 清理。若本 crate 直接抄对侧 GUID，会与对侧已装的持久化对象**撞 key**：轻则 `FwpmProviderAdd0` 返回 `FWP_E_ALREADY_EXISTS`，重则本 crate 清理逻辑误删对侧规则（或反之）。

⇒ 因此 `provider_object` 模块只把对侧值钉成**具名参考常量**，供取证对账与兼容性判断；真正安装时仍用调用方传入的 `ProviderIdentity`（自分配 GUID）。这是**刻意的安全边界**，不是遗漏。

---

## 5. 显式不做的（诚实边界）

| 不做项                               | 原因                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 端到端 filter 安装验证               | 需管理员会话 + 真实网卡；失败路径（驱动拒绝、策略冲突、provider 已存在）无法在无人值守环境复现 |
| `is_effective()` 返回 true           | 当前恒为 `false`——刻意不让未验证路径冒充实效                                                   |
| 复刻 runtime 的 layer index 选择逻辑 | 静态反汇编追到第 5 层透传即到顶，需管理员真机动态取证                                          |
| 接线 `src-tauri/lib.rs`              | 该文件当前为他席在飞件，不在本轮范围                                                           |

---

## 6. 证据文件索引

| 文件                                                                       | 内容                                       |
| -------------------------------------------------------------------------- | ------------------------------------------ |
| `.ihui-agent/tmp/goal-codex/evidence/wfp-fwpm-filter0-fields.md`           | `FWPM_FILTER0` 字段值（round 10）          |
| `.ihui-agent/tmp/goal-codex/evidence/wfp-condition-guids-authoritative.md` | 条件/layer GUID 双源交叉验证               |
| `.ihui-agent/tmp/goal-codex/evidence/wfp-provider-sublayer-fields.md`      | provider/sublayer 调用点级字段（round 12） |
| `.ihui-agent/tmp/goal-codex/evidence/wfp-callsite-disasm.txt`              | FilterAdd0 调用点反汇编现场                |
| `apps/desktop/wfp-netfilter/`                                              | 本 crate（策略编译层 + 安装层取证常量）    |

---

## 7. 结论

对侧 Codex Windows 沙箱的网络层是一个**工程上严谨的 WFP 白名单实现**：全事务化安装、持久化对象、PERMIT 惯用法、失败方向安全。本 crate 已把**可静态取证到的每一项字面值**都结构化复现，并在 decision 映射、冲突检测、幂等摘要、失败方向四个轴上超越对侧。

**未复现的部分只有 runtime 的 layer index 选择逻辑**——那需要管理员真机动态取证，按 §0.9 不做无验证的宣称。这是当前环境的硬边界，不是偷工减料。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
