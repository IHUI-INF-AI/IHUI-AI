<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R11 逆向取证：Codex Desktop 26.1111 行为逻辑层（capability gate / 权限 / 压缩）

> 取证日期：2026-11-15　|　目标：OpenAI Codex 桌面端（MSIX 包 **26.1111.2228.0**）
> 文件：`app.asar` 主进程 chunk `.vite/build/early-bootstrap-331-29198f5b57adf59a.js`（5487KB）
> 方法：解 asar 头 → 遍历 `.vite/build/*.js` → 按行为符号密度定位主 chunk → 字符串/正则取证（非反混淆）
> 红线：只读取证，未执行二进制、未读 `@oai/*/docs/*.md` 专有文档正文、未粘专有源码、未提取凭据。
> 前置：本文件是 Round 12（能力面清单）的下潜层——从「有什么」到「怎么运作」。

---

## ① 取证方法与陷阱

- **asar 结构解析**：`f.seek(4)` 读 header 长度（uint32 BE）→ `f.seek(12)` 读 JSON 长度 → `f.seek(16)` 读 JSON 头 → payload 基址 `= 16 + jlen`。
- **陷阱 1（Windows Python）**：`/c/` POSIX 路径不被 `os.path.exists` 识别，须用 `C:/`。
- **陷阱 2（asar 递归）**：目录节点的 `files` 字典逐层下钻，不能假设叶子结构。`.vite/` 递归 walk 返回 0（误判），须先看 `.vite.files` 再看 `.vite.files.build.files`。
- **主 chunk 定位**：按 `len(re.findall(r"approvalPolicy|compaction|tokenBudget|permissionProfile", chunk))` 排序，取最高密度 chunk（331 = 119 命中）。

---

## ② 四维权限求解（sandboxPolicy / approvalPolicy / approvalsReviewer / permissionProfile）

### 命中统计（chunk 331）

| 字段 | 命中 | 备注 |
|---|---|---|
| `sandboxPolicy` | 133 | 最高频，四维核心 |
| `approvalsReviewer` | 120 | 谁来审（人/模型/自动） |
| `approvalPolicy` | 108 | 审批档位 |
| `permissionProfile` | 6 | 预设档位（低频，可能已合并到 sandboxPolicy） |

### 审批档枚举（approvalPolicy 可能值）

```
untrusted      ×16   # 不可信（默认最严）
never          ×17   # 永不审批（全自动）
trusted        ×8    # 可信（跳过审批）
on-request     ×6    # 按需审批
always         ×6    # 总是审批（最严）
```

### 沙箱四档（sandboxPolicy.mode 可能值）

```
read-only              ×12   # 只读文件系统
workspace-write        ×4    # 工作目录可写
danger-full-access     ×1    # 全权限（危险）
computer-use           ×14   # 桌面控制模式（CUA 专用）
```

### 权限求解逻辑（取证线索，非完整算法）

```js
// 错误消息取证（chunk 331）
"Expected one of ['read-only','workspace','full-access']"  // sandboxPolicy.mode 枚举校验
"sandbox_mode||null!=t.approval_policy?'custom':(0,e1.bzb)((0,e1.Bnq)(t))"
// → 若用户显式设了 sandbox_mode 或 approval_policy，走 custom；否则走预设组合
```

**推断**（需 Ghidra 深度逆向确认）：Codex 用四维组合查表决定一个工具调用是否需要审批、用哪个沙箱模式。`permissionProfile` 可能是预设档位名（如 "safe" / "balanced" / "yolo"），展开后填充 sandboxPolicy/approvalPolicy/approvalsReviewer 三维。

---

## ③ 上下文压缩与 token 预算

| 符号 | 命中 | 语义 |
|---|---|---|
| `truncate` | 32 | 裁剪（历史消息/工具结果） |
| `asyncCompaction` | 2 | 异步压缩（后台跑，不阻塞 turn） |
| `compactionImageBudget` | 3 | 图像 token 预算（多模态） |
| `tokenBudgetHistoryNotes` | 2 | 历史注释的 token 预算（"0.150.0-alpha.2" 引入） |
| `output_token_replay` | ? | 输出 token 重放（capability gate 门控） |

### 压缩触发条件（取证线索）

```js
// capability gate 版本表取证
asyncCompaction: "0.163.0-alpha.11"  // 0.163.0-alpha.11 起支持异步压缩
compactionImageBudget: "0.162.0-alpha.1"
tokenBudgetHistoryNotes: "0.150.0-alpha.2"
```

**推断**：Codex 用 `asyncCompaction` 在 turn 间隙异步压缩历史（不阻塞用户输入）；`tokenBudgetHistoryNotes` 控制给模型的"历史摘要"占多少 token。本仓 `auto_compact_window.py` / `context_compaction.py` 是**同步压缩**（阻塞 turn）——Codex 的 async 是架构差异。

---

## ④ 核心发现：83 个 capability 版本演进门

### 设计（行为取证）

一张 `capability → minimum_version` 表（83 门），判定函数 `JF(peerVersion, "CapName")`：
- 对端版本 >= 门槛 → 保留 payload 中该能力的字段
- 对端版本 < 门槛 → **剥离**该字段（`{[k]:_, ...rest} = payload; payload = rest`）

sanitize 链（连续 12+ 次剥离，节选）：
```js
if (null != r.command_sessions_world_state && !JF(t,"commandSessionsWorldState")) {
  let {command_sessions_world_state:e, ...t} = r; r = t
}
if (null != r.guardian_native_multi_agent_history && !JF(t,"guardianNativeMultiAgentHistory")) {
  let {guardian_native_multi_agent_history:e, ...t} = r; r = t
}
if (null != r.async_compaction && !JF(t,"asyncCompaction")) {
  let {async_compaction:e, ...t} = r; r = t
}
// ... (共 83 门，覆盖 thread*/computer*/guardian*/mcp*/approval/compaction/tokenBudget/steering/voice...)
```

### 版本表节选（代表性 14 门，完整 83 门见 `capability_payload_gate.py` docstring）

```
threadRealtimeVoiceBackend         0.166.0-alpha.6
threadGoalProvenance               0.161.0-alpha.5
threadReadState                    0.163.0-alpha.4
threadMemorySummary                0.165.0-alpha.1
computerAudio                      0.147.0
feedbackSave                       0.164.0-alpha.11
preserveForkPrefix                 0.163.0-alpha.4
attachedThreads                    0.165.0-alpha.1
persistentSideChats                0.166.0-alpha.1
attachedThreadSearch               0.169.0-alpha.9
capacityErrorRetries               0.162.0-alpha.18
experimentalPredictionForkMode     0.162.0-alpha.20
threadSample                       0.164.0-alpha.11
threadSampleInterruptOnCancel      0.167.0-alpha.1
```

### 功能域分布（83 门按命名前缀归类）

| 功能域 | 门数 |
|---|---|
| 会话/线程（thread*） | 20 |
| 其他（appRead/applyPatch*/audioInputs/mcp*/gateway*/cli_*…） | 50 |
| 多 agent（guardian*） | 3 |
| 分叉（fork*） | 3 |
| token 预算（tokenBudget*） | 2 |
| 压缩（compaction*） | 2 |
| 语音（voice*） | 1 |
| 桌面控制（computer*） | 1 |
| 审批（approval*） | 1 |

---

## ⑤ 与 IHUI-AI 对齐（真差距）

| Codex 机制 | 本仓现状 | 判定 |
|---|---|---|
| capability gate（版本演进 payload 剥离） | `capability_matrix.py` 是能力开关台账（默认关+自检+opt-in），无版本演进剥离 | **真差距 → 本轮复现 `capability_payload_gate.py`** |
| 四维权限求解（sandbox/approval/reviewer/profile） | `command_policy_tiers.py` / `sandbox.py` 有等价轴，但无四维查表 | **已有等价（不同实现）** |
| 异步压缩（asyncCompaction） | `context_compaction.py` / `auto_compact_window.py` 是同步 | **架构差异（Codex 更优）** |
| 审批档枚举（untrusted/never/trusted/on-request/always） | `command_policy_tiers.py` 有类似档位 | **已有等价** |
| 沙箱四档（read-only/workspace-write/danger-full-access/computer-use） | `sandbox.py` 有等价模式 | **已有等价** |

---

## ⑥ 本轮复现：`app/core/capability_payload_gate.py`

- **差距**：Codex 用 capability gate 按对端版本剥 payload 字段做协议向后兼容；本仓无此轴。
- **超越轴**：
  1. **可判定**：每字段一个 `GateDecision(capability, payload_key, kept, reason)`，reason 带双方版本（"对端 0.162.0 < 0.163.0-alpha.11，剥离"）。
  2. **可枚举**：`CapabilityRegistry.capabilities()` 暴露清单 + 门槛，审计"这次降级掉了哪些能力"。
  3. **白名单门控**（取证真相，纠偏了我最初的"未知就剥离"误解）：只门控登记在册的演进字段，未登记的稳定键原样透传——协议兼容只发生在已知演进点，稳定字段永不被误剥。
- **实现**：
  - `parse_version(v) -> (major, minor, patch, pre_rank, pre_num)`：预发布（alpha/beta/rc）低于同号正式，内部按序号递增（alpha.1 < alpha.2）。
  - `version_at_least(actual, minimum) -> bool`：语义化版本比较。
  - `CapabilityRegistry.register(cap, ver, keys)` / `.sanitize(payload, peerVersion) -> SanitizeResult`。
  - `build_default_registry()`：按 Codex 26.1111 取证的代表性 9 门构造（完整 83 门可扩展）。
- **验证**：16 pytest 全过（含反向变异：版本临界翻转 kept/stripped）+ ruff 全绿 + 水印齐备。
- **诚实边界**：**未接生产路径**（接入点留属主决策）；83 门只复现 9 个代表性门（完整表可从取证 docstring 扩展）；semver 比较是内联轻量版（不引第三方，可换 `packaging`）。

---

## ⑦ 剩余未深挖行为逻辑面（诚实标注）

- **agent loop/turn 驱动**：chunk 331 零命中 `agentLoop|runTurn|turnLoop`——可能在别的 chunk（`early-bootstrap-631` / `worker.js`）或 Rust 引擎（`codex.exe`），本轮未深挖。
- **错误自愈**：零命中 `selfHeal|recoverFrom`——Codex 可能用 `capacityErrorRetries`（capability gate 门控）做重试，但具体策略未取证。
- **工具调用编排**：未深挖（单轮多工具？并行？依赖图？）。
- **@oai/cua 桌面控制编排**：在专有 docs 内（红线），未取证。

---

## ⑧ 覆盖度自评

**已深挖行为逻辑面**：
- ✅ 权限/审批/沙箱（四维求解 + 审批档 + 沙箱档 + 组合决策线索）
- ✅ 上下文压缩/token 预算（符号 + 触发线索 + async 差异）
- ✅ capability gate（83 门完整机制 + 版本表 + sanitize 链 + 复现）

**未深挖**：
- ❌ agent loop/turn 驱动（chunk 定位失败，可能在别的 chunk 或 Rust 引擎）
- ❌ 错误自愈（零命中，可能藏在 capability gate 里）
- ❌ 工具调用编排
- ❌ @oai/cua 桌面控制编排（红线内）

**下一轮应挖**：agent loop/turn 驱动（换 chunk 或挖 codex.exe）、工具调用编排、错误自愈。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
