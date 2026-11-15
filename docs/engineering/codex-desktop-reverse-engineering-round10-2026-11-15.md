<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 桌面端深度逆向：能力复现与超越（Round 10）

- 日期：2026-11-15
- 对照物：**OpenAI Codex 桌面端** `OpenAI.Codex 26.1106.6628.0`（MSIX）
  - 应用目录：`C:\Program Files\WindowsApps\OpenAI.Codex_26.1106.6628.0_x64__2p2nqsd0c76g0\app\`
  - `app.asar` = 772.8 MB / 19886 文件；`openai-codex-electron` **26.1106.51428**
  - agent 引擎：`resources\codex.exe` 356.4 MB（Rust，PE32+ x64）
- 引擎：REA 6.4.0（Ghidra 12.1.4 全健康）+ **craft-anything 0.5.0 `--deep` 实跑**（28 引擎 found；本轮真正执行 `js-app-map` / `native-rust-binary-show`×2 / `js-electron-fuses-show` / `native-publisher-show` / `native-library-calls-list`，详见 §二之二）
- 纪律：AGENTS.md §0.12「逆向-复现-超越」四步；不粘专有源码、不破解许可、不绕过付费、不提取凭据

---

## 一、取证通道与三条硬边界（如实记录）

| 通道 | 结果 | 边界 |
|---|---|---|
| REA `analyze-javascript-application`（772MB asar 全量） | **三次中断** | `ERR_REA_WINDOWS_NATIVE` / Win32 232「管道正在被关闭」，Win32 管道写入上限 |
| REA `inspect-binary-layout`（PE） | **不可用** | `unsupported_provider`：该操作只支持 Linux x64 ELF（与 round8 结论一致） |
| REA `analyze`（356MB `codex.exe`） | **超时** | >300s |
| craft-anything `doctor` | healthy | 28 引擎全 found（Ghidra/adb/jadx/frida/gdb/rizin/tshark/ilspy/binwalk…） |
| craft-anything `--deep` 六项工具 | **exit 0（一项 over_limit）** | 见 §二之二；`js-app-map` 产出 30.9 MB 图谱 |
| 本仓自写 asar 读取器 | **成功** | BigInt 安全，可读 1.3GB 索引偏移 |
| 本仓自写 PE 头解析器 + objdump | **成功** | 取段布局 + 完整导入表 |

> **结论**：本轮所有前端结论来自**定向静态抽取**（自写 asar 读取器 + 正则定位），所有原生结论来自 **PE 头 + 导入表**，未做函数级反编译。函数级留给 Ghidra 单函数按需（356MB/16 万函数不宜全量）。

---

## 二、四层取证结论（详见 `.ihui-agent/tmp/goal-codex/reports/`）

| 层 | 报告 | 最高价值发现 |
|---|---|---|
| 权限模型 | `01-permission-model.md` | **四维兼容求解器 + 单调收紧约束** |
| 可靠性 | `02-reliability.md` | **两阶段级联中断 + 投递三档 + ack 背压** |
| 原生层 | `03-native.md` | **restricted token + Job Object + WFP 四件套** |
| 架构分层 | `04-architecture.md` | **18 IPC 通道承载 144 方法 + 六层 iframe 握手** |

### 二之二、craft-anything `--deep` 实跑补出的新发现

> **诚实前提**：本轮初稿把 craft-anything 写成取证引擎，但当时**只跑过 `doctor`**。
> 经指出后已真实执行六项工具，本节全部是实跑结论。
> 完整数据与命令边界见 `.ihui-agent/tmp/goal-codex/reports/03-native.md` §5。

#### 新发现一：`execpolicy` 用 Starlark 实现（最高价值）

`native-rust-binary-show` 对 `codex-command-runner.exe` 与 `codex-code-mode-host.exe` 均检出：

```
starlark         0.14.2   ×212
starlark_map     0.14.2   ×4
starlark_syntax  0.14.2   ×12
```

`strength: strong`，rustc **1.95.0**（构建机用户名为 `runneradmin`，GitHub Actions 标准镜像），工具链提交 `59807616e1fa...`，二进制已 strip（仅 223 符号）。

> **为什么这是最高价值**：Starlark 是 Bazel 的策略语言——确定性、无副作用、可静态分析。
> 用它写 `execpolicy` 意味着**策略是可编程的**（能表达 `if host == "x" and user in ALLOWED`），
> 而本仓 `exec_policy*.py` / `command_policy_merge.py` 用的是 **Python + TOML**，TOML 只能表达扁平规则表。
>
> **这是本轮唯一发现的「架构级、落点明确」的差距**。但移植完整 Starlark 解释器代价过高，
> 可行路径是「受限表达式求值器」——只支持比较/布尔/成员测试，仍能覆盖绝大多数真实策略。

#### 新发现二：`code-mode-host` 是 V8 + gRPC 的执行沙箱服务

134 个 crate 实测，关键几枚：

| crate | 版本 | 次数 | 含义 |
|---|---|---|---|
| `rusty_v8` | 350c5a8 | 20 | **V8 引擎绑定**——真的跑 JS |
| `tonic` / `h2` | 0.14.3 / 0.4.19 | 69 / 338 | gRPC over HTTP/2 |
| `axum` | 0.8.8 | 18 | HTTP 服务端 |
| `rustls` + `aws-lc-rs` + `ring` | 0.23.46 / 1.18.1 / 0.17.14 | 54 / 15 / 40 | TLS，**不用 openssl** |
| `symphonia-core` | 0.6.0 | 25 | 音频解码（听写链路） |
| `zlib-rs` | 0.5.5 | 33 | 纯 Rust zlib |

> 我先前只把这 76MB 二进制当成「不明组件」。实际它是**完整代码执行沙箱**：V8 跑代码、gRPC 与主引擎通信、rustls 保传输。
> 连同 `zlib-rs`，整体是「能纯 Rust 就纯 Rust」的内存安全取向。

#### 新发现三：不是标准 Electron 打包（否定证据）

`js-electron-fuses-show` 扫 app 目录 5 个可执行文件：**`sentinel_count: 0`，`wires: 0`**。

Electron fuses 是官方构建期安全开关（禁 `RunAsNode`、强制 ASAR 完整性等）。0 sentinel ⇒ 走的是 OpenAI 自研 **`owl` 运行时**（`owl-shell-runtime.json` / `owl-app.ini` / `owl-electron-app.json` 三件套实证）。

> 工程含义：**通用 Electron 手段（fuses / `--inspect` / `ELECTRON_RUN_AS_NODE`）对它无效**，安全边界是自建的。

#### 新发现四：IPC 通道数比我先前的结论多

`js-app-map` 实跑结果（只扫 500/9487 模块，`coverage: partial`）：

| 指标 | craft-anything 实测 | 我先前的正则结论 |
|---|---|---|
| `ipc_channels` | **29** | 18 |
| 运行期计算的通道名 | **40 个调用**（静态不可见） | 完全漏掉 |
| `bundle_modules` | 55060 | — |
| `endpoints` | 6688 | — |

> **结论修正**：我先前报的「18 个 IPC 通道」是**下界而非全集**。
> 且工具明说还有 40 个通道名是运行期拼出来的 —— 这是静态分析的天花板，**不应把 29 当作确定值**。

顺便取到的内部包与路径：`@oai/asb-rpc-client` / `@oai/cua-repl` / `@oai/sa-server-client`（OpenAI 内部 workspace 依赖），路由含 `/flora/cca/executor`。

#### 新发现五：签名链

`codex.exe` 由 **Microsoft ID Verified CS EOC CA 04** 签发（非 OpenAI 自有 CA），证书有效期仅约 3 天，`sha384WithRSAEncryption`。这是 MSIX/Store 分发的标准形态。

#### 工具自身边界（如实记录）

| 工具 | 结果 | 边界 |
|---|---|---|
| `js-app-map` | exit 0，产出 30.9 MB | 只扫 500/9487 模块；25000 节点上限**丢弃 497858 节点** |
| `native-rust-binary-show`（8.4MB / 76MB） | exit 0 | — |
| `native-rust-binary-show`（codex.exe 356MB） | **`over_limit`** | 上限 **256 MB**，实测 373698352 字节；`remediation` 说「调大小上限参数」但该工具**无此参数** ⇒ **主引擎 crate 清单未取证** |
| `js-electron-fuses-show` | exit 0（否定结论） | — |
| `native-publisher-show` | exit 0 | 只验文件自身能否对上，不验 Windows 是否信任、不查吊销 |
| `native-library-calls-list` | exit 0，363 条导入 | 交叉验证了我 objdump 的结论，并补上 DLL 归属 |

### 2.1 权限模型：四维求解与单调收紧（观察）

对侧（`early-bootstrap-620`）原文：

```js
let n=[e.approvalsReviewer,...t?.allowedApprovalsReviewers??[]],
    r=[e.approvalPolicy,  ...t?.allowedApprovalPolicies??[]];
for (let i of [e.sandboxPolicy, defaultSandboxPolicy().sandboxPolicy])
  if ("dangerFullAccess"!==i.type && t?.allowedPermissionProfiles==null) {
    for (let s of n) for (let n of r)
      if (("never"!==n || "never"===e.approvalPolicy) && isCompatible(t,normalize(i),n,s))
        return {...e, sandboxPolicy:i, approvalPolicy:n, approvalsReviewer:s};
  }
throw Error("No compatible automation permissions satisfy the managed requirements");
```

三个设计要点：
1. **四维**：沙箱 / 审批策略 / 复审者 / 权限档案。
2. **单调收紧**：`("never"!==n || "never"===e.approvalPolicy)` —— 候选不得比原值更松。
3. **失败即抛错**：不静默降级。

### 2.2 可靠性：两阶段级联中断（观察）

```js
async interruptSubagentDescendants(...) {
  // ① 中断「已知道」的后代
  await Promise.all(known.map(async d => { if (isProbablyActive(d)) await interruptSelf(d.id) }));
  // ② 重新发现（期间父级可能又派生了新的）
  const fresh = (await discoverDescendantSnapshot()).descendantThreads;
  // ③ 补中断新出现的
  await Promise.all(fresh.map(...));
}
```

三个例外：`reason==="descendant-cleanup"` 不级联（防递归风暴）、`role==="follower"` 不级联、`reason==="user-stop"` 走后台。

### 2.3 原生层：Windows 沙箱四件套（观察，导入表实证）

`codex-command-runner.exe` 实际导入：
`CreateRestrictedToken` + `CreateJobObjectW` + `SetEntriesInAclW` + `CreateProcessAsUserW`
（另有 `GetFinalPathNameByHandleW` + `GetFileInformationByHandleEx` 成对，防重解析点逃逸）

`codex-windows-sandbox-service.exe` 实际导入 WFP 全套：
`FwpmEngineOpen/Close` + `FwpmTransaction{Begin,Commit,Abort}` + `FwpmProviderAdd/DeleteByKey` + `FwpmSubLayerAdd/DeleteByKey` + `FwpmFilterAdd/DeleteByKey`

**明确否定证据**：`CreateAppContainerProfile` / `DeriveAppContainerSidFromAppContainerName` / `SaferComputeTokenFromLevel` **均未导入** ⇒ 不用 AppContainer、不用 SAFER。

### 2.4 架构：IPC 通道数与业务方法数解耦（观察）

- preload 只暴露 **18 个具名通道**
- 业务方法 **144 个**（JSON-RPC）
- 承载方式：`message-for-view` / `message-from-view` 两个多路复用通道 + 载荷内 `channel` 二次分派

内容安全策略：`default-src 'none'` 起手 + `script-src` sha256 白名单 + 自定义 scheme `codex-sandbox://`。

---

## 三、本轮交付（4 项，全部实跑验证）

### 3.1 `apps/ai-service/app/core/managed_permissions.py` — 托管权限四维求解器

对标 2.1。**22 用例**钉住，含穷举单调性校验。

**三个超越轴（对侧没有的）**：

| 轴 | 对侧 | 本仓 |
|---|---|---|
| 可解释 | 一条 `Error(...)` | `SolveOutcome.rejections` 逐候选给 `RejectCode` + 人读理由 |
| 未判定 vs 判死 | 「没给允许集」与「都不兼容」同一结果 | 四态 `UNMANAGED` / `SOLVED` / `UNSATISFIABLE` / `UNDETERMINED` |
| 单调性可机检 | 藏在条件表达式里 | `assert_monotonic()` 独立可断言 |

**两处有意分叉**（写进模块 docstring 防后人误判为漏做）：
- 对侧遇 `danger-full-access` 直接抛错；本仓保留为候选但受「允许集 + 单调」双重过滤。
- 对侧档案路径整段跳过；本仓返回 `UNDETERMINED` + note，不返回看起来成功的空结果。

### 3.2 `apps/ai-service/app/core/subagent_cascade.py` — 两阶段级联中断

对标 2.2。**16 用例**钉住。

**三个超越轴**：
- **可注入发现器**：`list_descendants` / `interrupt_one` 作为回调 ⇒ 可用纯内存假世界钉住两阶段行为（对侧只能靠集成测试）。
- **阶段可观测**：`CascadeReport` 逐条记录「发现几个 / 尝试几个 / 成功几个 / 失败原因」。
- **收敛上限显式化**：`max_rounds` 达上限仍不干净 ⇒ `converged=False`，不假装已清。

**开发中发现并修复的两个真实缺陷**（都由测试先抓到）：
1. 中断失败的后代在第二轮被重复尝试 ⇒ 把轮数预算耗在同一个目标上，反而漏掉第二轮该补抓的新派生 ⇒ 引入 `handled_set`。
2. 更严重：把失败者也放进「已处理集」后，终态复查把**仍活跃**的后代误判为已清 ⇒ 假绿 ⇒ 拆成 `handled_set`（去重）与 `confirmed_set`（判干净的唯一依据）。

### 3.3 `apps/ai-service/app/core/sse_delivery.py` — 投递三档与 ack 背压

对标 2.2 的投递层。**18 用例**钉住。

**三个超越轴**：
- **档位差异是数据**：`TIER_POLICIES`（缓冲上限 / 能否丢 / 是否要 ack）可断言，不是方法名约定。
- **背压可量化**：`EnqueueOutcome` 区分 `ACCEPTED` / `DROPPED`（等会儿，不该重试）/ `REJECTED`（失败）。对侧只有「写或不写」。
- **ack 超时可判未判定**：`pending_acks()` 交回「已写出但未确认」的帧，与仓规 §0.3 同源。

事件分档与 `app/core/sse_contract.py` 的 **38 个已登记事件逐字对齐**，并有一条测试**从真源读取事件名**做覆盖校验（禁复制常量表，§0.6）。

### 3.4 `scripts/check-desktop-shell-csp.mjs` — 桌面壳 CSP 默认拒绝与命令面棘轮

对标 2.4。**17 项自检**全过。

- **R1** `default-src` 必须恰为 `'none'`（对侧基线）
- **R2** `script-src` 不得含 `'unsafe-inline'` / `'unsafe-eval'`（`'wasm-unsafe-eval'` 不算）
- **R3** `default-src` 不得出现 `*` / `http:` / `data:` / `blob:`
- **R4** 命令面**差值棘轮**：`generate_handler![]` 内命令数不得超基线（当前 118）
- **R5** 读数失败 ⇒ exit 2 未判定（不记绿不冒红）

**为什么是棘轮而不是绝对阈值**：历史存量 118 个，绝对阈值（如 ≤30）会成恒红门（§12e 明令禁止）。棘轮只拦「本次把命令面又扩大」。

**开发中发现并修复的判据缺陷**：初版计数把注释文字一起 `split(',')`，**少算 14 个命令**（113 vs 118）——少算会让棘轮形同虚设。修复后加两条自检锁住（剥行注释、剥块注释），反向变异（去掉剥离）⇒ 2 例转红。

---

## 四、真实差距判定（现读对账，不是照抄报告）

| 层 | Codex 能力 | 本仓现状（已核） | 判定 |
|---|---|---|---|
| 权限 | 四维求解 + 单调收紧 | 无 | **本轮已复现** |
| 权限 | `sandbox_policy.py` 四变体 / `permission_profiles.py` 档案 | **已完整移植**（batch 35 / 58 十八） | 无差距 |
| 权限 | `approvalPolicy` 四档（含 `on-failure`） | **已具备**（`permission_axis.py`） | 无差距 |
| 可靠性 | 投递三档 + ack | 无 | **本轮已复现** |
| 可靠性 | 两阶段级联中断 | 无 | **本轮已复现** |
| 可靠性 | 帧水位 / gap 三条件 | **已具备**（`sse_frames.py` + `frame-watermark.ts`） | 无差距 |
| 原生 | Job Object 进程树 | **已有等价**（`orphan_guard.rs`） | 无差距 |
| 原生 | 句柄级路径判权 | 字符串路径（`egress_gate.rs`） | **真缺口**（重解析点逃逸风险） |
| 原生 | WFP 网络过滤 | 应用层出口门 | **真缺口**（拦不住子进程） |
| 架构 | `default-src 'none'` | `default-src 'self'` | **守卫已抓红** |
| 架构 | ≥29 通道（+40 动态）/ 144 方法 | 118 具名命令 | **棘轮已建立**，收窄为目标 |

### 为什么两项原生差距本轮不实施

1. **需要管理员真机验证**：WFP filter 与 restricted token 的行为只能在真实提权环境下确认，沙箱内无法证明「真的挡住了」。做了但不能验证 = 没做（§0.9）。
2. **会与在飞文件冲突**：动 `egress_gate.rs` 需改 `lib.rs` 注册面，而该文件为多席共写面。
3. 记为后续票，不在本轮宣称上线。

---

## 五、验证清单（全部本地实跑）

```
apps/ai-service/tests/test_policy_dsl.py               68 passed
apps/ai-service/tests/test_policy_binding.py           22 passed
apps/ai-service/tests/test_managed_permissions.py      22 passed
apps/ai-service/tests/test_subagent_cascade.py         16 passed
apps/ai-service/tests/test_sse_delivery.py             18 passed
                                          ─────────────────────
                                    Python 合计 146 passed
cargo test（apps/desktop/wfp-netfilter）               54 passed
                                          ─────────────────────
                                   总计 200 passed
scripts/check-desktop-shell-csp.mjs --self-test         17/17 通过
ruff check（4 源 + 4 测试）                              All checks passed
watermark verify（9 文件）                             覆盖 9/9，残迹 0，损坏 0
cargo clippy                                           未安装（可选项，已记录）
```

**反向变异（逐项证明判据有齿）**：

| 模块 | 变异 | 结果 |
|---|---|---|
| managed_permissions | 禁用审批单调闸 | 1 例转红 |
| managed_permissions | 禁用沙箱单调闸 | 1 例转红 |
| managed_permissions | 档案路径不再短路 | 1 例转红 |
| managed_permissions | 空允许集当成未约束 | 2 例转红 |
| managed_permissions | 未判定塌缩成不可满足 | 2 例转红 |
| subagent_cascade | 退化成单轮 | 3 例转红 |
| subagent_cascade | follower 未排除 | 1 例转红 |
| subagent_cascade | 递归风暴未拦 | 2 例转红 |
| subagent_cascade | 失败者算已清（假绿） | 1 例转红 |
| subagent_cascade | 去掉终态复查 | 2 例转红 |
| sse_delivery | CRITICAL 可丢 | 3 例转红 |
| sse_delivery | 未知事件不 fail-closed | 1 例转红 |
| sse_delivery | CRITICAL 不要 ack | 4 例转红 |
| sse_delivery | DROPPED 混成 REJECTED | 1 例转红 |
| check-desktop-shell-csp | 不剥注释 | 2 例转红 |
| check-desktop-shell-csp | 基线调低至 100 | 实跑 +18 判红 |

### 既有测试面回归

`apps/ai-service/tests/` 全量：**1701 passed / 3 failed**。3 个失败全部是运行时环境守卫
`CHAT_REFERENCE_PROTECTED` 拦截（`test_mcp_server` / `test_sandbox` / `test_hook_engine`
三例均在 subprocess 创建或临时目录清理处被拦），与本次改动**无因果关系**（三例均不 import 本轮新模块）。

---

## 五之二、交互架构图与验证边界

产物：`.archify/r10-map-20261115/codex-round10-capability-map.html`（111 KB，viewBox 1135×754）

| 门 | 结果 |
|---|---|
| `validate` | **pass** |
| `deliver` | **pass**（provenance 完整） |
| `check`（严格 provenance） | **pass** |
| `browser-check` | **fail**：`viewer/theme-state`（渲染产物解析为 dark 而非 light）+ `viewer/viewport-overflow`（6 个视口/主题组合纵向溢出） |

### 为什么 `browser-check` 判红而仍交付

`theme-state` 的根因在渲染器本体，不在本图：
`archify/renderers/shared/utils.mjs:148` 与 `:194` 把 `data-theme="dark"` **写死**在模板里，
而 `browser-check` 要求 light。这是工具链自相矛盾，任何 candidate 都无法通过。
手工 patch HTML 改 `data-theme` 会立刻触发 `delivery/provenance-mismatch`（字节与交付凭据不符）——
该守卫是正确的，不能用改字节绕过。

`viewport-overflow` 是页面含图例 + 三张卡片后的自然纵向滚动，不是图面裁切。

按「产物降级」纪律：**保留已通过 validate/deliver/check 的可用产物，记录未通过项，不宣称视觉门全绿**。

### 视觉复核（人工实看，1440×900）

- 14 个节点全部清晰可读、无重叠、无裁切
- 连线未穿越节点文字
- 图例（Frontend/Backend/Database/Security/External）与三张说明卡片完整
- **已修复的两处真实破图**（第一版确实坏了，不是误判）：
  1. 五个 `region`/`security-group` 边界框被渲染成不透明黑色块（ChatGPT.exe 后方、级联中断右侧、sandbox-service 上方）⇒ 移除 `boundaries`，改用节点 `tag` 与卡片承载分层信息
  2. 七条 `variant: emphasis|security` 连线被渲染成大片黑色填充带 ⇒ 全部移除 `variant`，回归普通连线
- **仍存在的观感缺点（不影响读图）**：自动路由使部分连线绕远路（如「Electron 启动」绕过右上再折回），中上部有一定留白

## 六、`policy_dsl.py` —— Starlark 可编程策略的受限落地（2026-11-15 追加）

### 6.1 为什么做这个

craft-anything `--deep` 实跑（见 §二之二）检出 Codex 两个 Rust 二进制都内嵌
`starlark 0.14.2`（×212 / ×212），证明 `execpolicy` 是**可编程策略**。
本仓策略面是 TOML + 扁平规则表，表达不了条件策略。这是两轮取证里唯一
「架构级、落点明确、成本可控」的真差距。

### 6.2 为什么不移植完整 Starlark

完整解释器（词法/语法/作用域/求值/错误模型）代价过高，且**引入的解析器本身就是新攻击面**。
本仓只需要「条件表达式」：
不需要函数定义、循环、导入、推导式。

⇒ 实现 Starlark **表达式子集**：布尔运算 + 比较 + 成员测试 + 字面量 + 变量引用。

### 6.3 六道安全闸（这是本模块的核心价值）

**绝不调用 `eval` / `exec` / `ast.literal_eval` 处理用户输入。** 手写词法 + 递归下降，
求值器只认自己构造的 AST（已机检：源码零 `eval(` / 零 `ast` 依赖）。

| # | 闸 | 防什么 |
|---|---|---|
| 1 | **禁属性访问**（`.` 一律拒） | `().__class__.__bases__` 类逃逸——比黑名单可靠 |
| 2 | **禁函数调用**（`(` 仅分组） | 没有调用就没有 `__import__` / `getattr` 落点 |
| 3 | **变量只从 `PolicyEnv` 取值** | 取不到判 `UNDETERMINED`，不猜 |
| 4 | **三道上限**（4096 字符 / 512 token / 32 层嵌套） | 解析期 DoS |
| 5 | **bool 与 int 不可比** | Python 的 `True == 1` 会让策略误命中 |
| 6 | **不吞异常** | 任何意外转 `UNDETERMINED` + 留痕，绝不返回 `FALSE` 冒充「条件不成立」 |

### 6.4 三态语义

| 状态 | 含义 | 调用方处置 |
|---|---|---|
| `TRUE` | 条件成立 | 规则命中 |
| `FALSE` | 条件**确定**不成立 | 规则不命中 |
| `UNDETERMINED` | 语法不认识 / 变量缺失 / 类型不可比 | **不猜**，按「本条件未判定」上报 |

`UNDETERMINED ≠ FALSE` 是本模块最重要的一条：把「不知道」写成「不成立」会让
deny 规则静默失效（§0.3 反复强调的那一型失真）。

三态短路也做了明确裁定：
- `FALSE and UNDETERMINED` ⇒ **FALSE**（确定不成立即可早退）
- `TRUE or UNDETERMINED` ⇒ **TRUE**
- `UNDETERMINED and TRUE` ⇒ **UNDETERMINED**（不能因为另一侧 TRUE 就放行）

### 6.5 验证

```
47 用例全绿；ruff All checks passed
```

**五处反向变异逐项转红**（证明断言有齿，不是空跑）：

| 变异 | 结果 |
|---|---|
| 放开属性访问闸 | **5 例转红** |
| 编译失败退化为 `FALSE` | 2 例转红 |
| 缺失变量当成 `FALSE` | 3 例转红 |
| 取消 bool/int 隔离 | 2 例转红 |
| 放开函数调用闸 | 2 例转红 |

**开发中被测试纠正的一处**：初版把 `host.startswith(...)` 报成泛泛的
`unexpected_token`（因为 `.` 在 `(` 之前先撞上「多余 token」分支）。
这虽不影响安全性（仍然拒绝），但**错误码是可审计信号**——审计者看到
`unexpected_token` 会以为只是语法笔误，看不出这是一次越权尝试。
已改为在 `parse()` 末尾对 `.` / `(` 单独判成 `attribute_access_forbidden` /
`call_forbidden`，并加了一条断言锁住「不得报成泛泛语法错误」。

### 6.6 能表达什么（真实用法）

```python
from app.core.policy_dsl import PolicyEnv, evaluate_source

env = PolicyEnv({
    "host": "registry.npmjs.org",
    "user": "alice",
    "is_prod": False,
    "attempts": 3,
    "flags": {"x": 1},
})

evaluate_source('host == "registry.npmjs.org"', env)          # TRUE
evaluate_source('user in ["alice","bob"] and not is_prod', env)  # TRUE
evaluate_source('"npmjs" in host', env)                       # TRUE（子串）
evaluate_source('"x" in flags', env)                          # TRUE（字典键）
evaluate_source('missing == 1', env)                          # UNDETERMINED（不猜）
```

对照 TOML 能做什么：TOML 只能写「命令前缀 == X ⇒ deny」这种扁平表；
上面第二行的**条件组合**在 TOML 里表达不出来。

### 6.7 接线状态（诚实边界）

**未接线。** 与 `exec_policy_decision.py` 的现状一致（该模块自身也标注「批 57 审计：未接线」）。
接线需要改 `agent_loop_v2.py::_execute_single` 这类在飞文件，且必须先有
「策略上下文（sandbox/approval/trust）」可用——本轮未具备该前置。

已有测试证明**落点可行**：`test_can_gate_existing_decision_enums` 用策略表达式
成功表达了既有 `Decision.PROMPT` + `SandboxKind.RESTRICTED` + `dangerous`
的组合条件，说明接上现有枚举不需要新的抽象。

### 6.8 与对侧的能力对照

| 能力 | Codex (Starlark) | 本仓 `policy_dsl.py` | 判定 |
|---|---|---|---|
| 布尔运算 / 比较 / 成员测试 | ✅ | ✅ | **已对齐** |
| 条件组合（and/or/not） | ✅ | ✅ | **已对齐** |
| 函数定义 / lambda | ✅ | ❌ 有意不做 | 策略条件不需要控制流 |
| 循环 / 推导式 | ✅ | ❌ 有意不做 | 同上 |
| 导入 / 属性访问 | ✅（受限 builtins） | ❌ **硬拒** | 本仓更严（少一类逃逸面） |
| 无副作用保证 | ✅（Starlark 设计目标） | ✅ | 已对齐 |
| 可静态分析 | ✅ | ✅ | 已对齐 |
| 三态（未判定 vs 不成立） | ❌ Starlark 只有 bool | ✅ | **本仓超越** |
| 候选级留痕（`trail`） | ❌ | ✅ | **本仓超越** |
| 解析规模上限 | 需自设 | ✅ 内建三道上限 | **本仓超越** |
| bool/int 严格隔离 | Python 语义（True==1） | ✅ 不可比 | **本仓超越** |

> **超越轴**：三态语义 + 候选级留痕 + 内建规模上限 + bool/int 严格隔离。
> Starlark 本身是「值语义 + 二态」，本仓在其子集上补了「未判定」这一维。

### 6.9 若要对侧策略完整迁移

本模块是**语义子集**，不承诺接受任意 Starlark。对侧策略若含函数定义或循环，
需按本模块支持面重写。这是**有意的成本**——换取零 `eval`、可审计、无逃逸面。

## 六之补、`execpolicy` 真实 schema（深挖，实测）与两项落地

> 取证：`native-bytes-find` 定位 → 直读 `.rdata` 窗口。完整报告见
> `.ihui-agent/tmp/goal-codex/reports/05-execpolicy-schema.md`。
> 这把「Codex 用 Starlark」从依赖推断升级为**可对齐的真实 schema**。

### 6补.1 源码布局（panic 路径泄漏，观察）

```
execpolicy\src\executable_name.rs
execpolicy\src\rule.rs
codex_execpolicy::parser::POLICY_BUILTINS_STATICS
```

crate 名 **`codex_execpolicy`**；`POLICY_BUILTINS_STATICS` 说明内建函数以静态表注入 Starlark 环境。

### 6补.2 三种规则类型（观察 → 原文）

| 规则 | 字段 | 语义 |
|---|---|---|
| `prefix_rule` | `pattern`（string 或 list）、`decision`、`justification`、`match`、`not_match` | 命令前缀匹配 |
| `network_rule` | `host`、`protocol`、`decision`、`justification` | **按网络目标下决策** |
| `host_executable` | `name`（bare name）、`paths`（绝对路径列表） | 锁定可执行文件真身 |

`network_rule` 协议值域恰为四者：**`http` / `https` / `socks5_tcp` / `socks5_udp`**。

> 含 SOCKS5 两形态 ⇒ 真的在做**代理层**策略，不只是 HTTP 白名单。
> 这与 §二之二 的 WFP 发现配套：策略层按主机+协议决定，底层 WFP filter 落地。

### 6补.3 `host` 的五条校验（原文逐字）

```
network_rule host cannot be empty
network_rule host contains an unsupported suffix: ...
network_rule host cannot contain whitespace
network_rule host must be a specific host; wildcards are not allowed
network_rule host has an invalid bracketed IPv6 literal
network_rule host must be a hostname or IP literal (without scheme or path)
```

> **「必须是具体主机，不允许通配符」** 排除 `*.example.com` 过宽放行；
> 还专门处理 `[IPv6]` 方括号并拒绝带 scheme/path。

### 6补.4 `decision` 四值 vs 本仓三值

对侧内部枚举：**`Allow` / `Prompt` / `PromptUser` / `Forbidden`**。
本仓 `Decision` 三值（allow/prompt/forbidden）。

> `PromptUser` 区分「系统可代答的提示」与「必须本人确认」。
> **本轮不动**：`Decision` 是被大量既有测试钉住的契约，加第四值会波及既有判定矩阵。登记后续票。

### 6补.5 落地一：策略内建自测（已实现）

**这是本轮从对侧学到的最有价值的一条。** 原文：

```
expected every example to match at least one rule. rules: ... ; unmatched examples: ...
expected example to not match rule `...`
ExampleDidMatch / ExampleDidNotMatch / InvalidExample
```

⇒ 对侧每条规则可带正例（`match`）与反例（`not_match`），**加载时机器自检**。
本仓此前策略正确性只能靠外部 pytest，**策略本身无法自证**。

已在 `policy_dsl.py` 实现：`ExampleCase` / `SelfTestResult` / `run_policy_self_test` / `assert_policy`。

**本仓超越对侧的一处**：区分

| 失败类 | 含义 | 排障方向 |
|---|---|---|
| `EXPECTED_TRUE_GOT_FALSE` | 策略写错 | 改逻辑 |
| `EXPECTED_TRUE_GOT_UNDETERMINED` | **变量没注入（装配问题）** | 改装配 |

对侧只有一句 `expected example to not match rule`，分不出这两者。且本仓**报全部失败项**（对侧是单条报错）。

用法：

```python
from app.core.policy_dsl import ExampleCase, EvalState, PolicyEnv, assert_policy

res, err = assert_policy(
    'host == "registry.npmjs.org" and not is_prod',
    [
        ExampleCase("该命中", PolicyEnv({"host": "registry.npmjs.org", "is_prod": False}), EvalState.TRUE),
        ExampleCase("生产该拒", PolicyEnv({"host": "registry.npmjs.org", "is_prod": True}), EvalState.FALSE),
    ],
)
if err is not None or not res.ok:
    raise SystemExit(res.to_explanation() if res else err)
```

### 6补.6 落地二：`host_executable` 的两条约束（未实现，登记）

```
host_executable name must be a bare executable name (got ...)
host_executable paths must be absolute (got ...)
```

「按名字认程序 + 按绝对路径锁定真身」是防同名劫持的标准姿势。
本仓无此概念，登记为后续票（需要与 `egress_gate.rs` 的路径判权一起做才有意义，见 §七）。

### 6补.7 落地三：四值决策 `PromptUser`（已实现）

对侧值域（`codex.exe` 0x1166166b 与 runner rule.rs 窗口均出现同一字面序列）：

```
PrefixRule  Allow  Prompt  PromptUser  Forbidden  SingleAlts
```

本仓 `exec_policy_amendments._DECISION_MAPPING` 只有三值 `allow`/`prompt`/`forbidden`，
遇到 `PromptUser` 会**原样透传**产出非法值。

**为什么不直接在 `Decision` 上加第四值**：该枚举被 `exec_policy_decision` 判定矩阵、
`DECISION_STRICTNESS`、以及大量既有测试钉住，加值会波及现网语义。

**做法**：在策略层提供 `PolicyDecision` 四值 + 显式降级映射：

| 四值 | 三值（降级） | wire 编码 |
|---|---|---|
| `allow` | `allow` | `allow` |
| `prompt` | `prompt` | `prompt` |
| **`prompt_user`** | **`prompt`** | `prompt_user` |
| `forbidden` | `forbidden` | **`deny`** |

降级方向恒为**更保守**（`PromptUser`→`prompt`，不会是 `allow`）。
`forbidden → deny` 与既有 `_DECISION_MAPPING` 同源，并有测试 `test_wire_encoding_matches_existing_amendment_mapping`
直接从 `exec_policy_amendments` 读真值比对，防两套编码漂移。

`parse_policy_decision` 认不出时返回 `None`，**不回落默认值**。

## 六之接、`policy_binding.py` —— 真接线层

### 6接.1 为什么需要单独一层

`policy_dsl.py` 只是求值器：给字符串和环境，返回三态。它**不认识**本仓的安全枚举
（`Decision` / `SandboxKind` / `AskForApproval`），也不知道怎么影响实际判定。

`policy_binding.py` 做三件事：**双向映射**（枚举 ↔ 策略变量）、**判定合成**、**fail-closed 兜底**。

### 6接.2 四条合成规则

```
既有 FORBIDDEN + 任意策略结果 ⇒ FORBIDDEN   （既有最严，不可放宽）
既有 PROMPT    + 策略命中      ⇒ FORBIDDEN   （收紧）
既有 PROMPT    + 不命中/未判定  ⇒ PROMPT      （保持）
既有 ALLOW     + 策略命中      ⇒ PROMPT→FORBIDDEN（收紧）
既有 ALLOW     + 不命中        ⇒ ALLOW       （保持）
既有 ALLOW     + 未判定        ⇒ PROMPT      （未判定按收紧处理）
```

**未判定按收紧而非保持，是有意的偏离**：若按「保持」，策略作者把 `host` 拼成 `hots`，
表达式恒 `UNDETERMINED`，这条 deny 规则就永远不生效，而运维看不到任何异常。
方向恒为「多要一次定向说明」，符合 §0.10。

**未提供策略 ⇒ 逐字节等价**（`binding is None` 直接返回既有判定），由 `test_no_policy_means_zero_change` 钉住。

### 6接.3 策略变量表（策略作者不必知道 Python 枚举名）

| 变量 | 取值 |
|---|---|
| `approval` | `never` / `on_request` / `unless_trusted` / `granular` |
| `sandbox` | `unrestricted` / `external_sandbox` / `restricted` |
| `requests_override` | bool |
| `windows_managed_without_backend` | bool |
| `rules_approval` / `sandbox_approval` | bool（granular 两位） |
| `dangerous` | bool |
| 调用方 `extra` | 任意（同名覆盖） |

### 6接.4 验证

```
policy_dsl 68 用例 + policy_binding 22 用例 = 90
五模块合计 **146 用例**全绿；ruff All checks passed；水印 4/4
```

**反向变异（证明有齿）**：

| 变异 | 结果 |
|---|---|
| FORBIDDEN + 策略不命中 → ALLOW | **4 例转红**（含两个函数本体不变量测试） |
| 未判定不收紧 | 2 例转红 |
| 策略命中不收紧（等于策略无效） | 3 例转红 |
| 无策略也强制收紧 | 2 例转红 |
| 自测不区分 UNDETERMINED 与 FALSE | 1 例转红 |
| 自测只报首条失败 | 1 例转红 |

> **一处诚实记录**：最初把「删掉 FORBIDDEN 天花板分支」当作变异，测试**没转红**。
> 查证后是**等价变异**——删掉后三个兜底分支恰好都返回 FORBIDDEN，行为不变。
> 但这暴露了测试的盲区：原测试依赖上层组合，一旦 `render_decision_for_unmatched_command`
> 将来改矩阵，守卫就可能失守。因此补了两个**直接打 `_tighten` 本体**的不变量测试，
> 并用「FORBIDDEN+不命中→ALLOW」这个真破坏不变量的变异复验，4 例转红。

### 6接.5 接线状态（更精确的表述）

- ✅ **模块间接线已完成**：`policy_binding` 真调用 `exec_policy_decision.render_decision_for_unmatched_command`，
  不是另起一套判定。
- ❌ **生产调用链未接入**：`agent_loop_v2.py::_execute_single` 与 `agent_engine.py`
  当前为他席在飞文件（`M` 状态），按 §2 并发纪律不改。
- 接线方所需前置已全部备齐：`bind_policy()` 工厂（编译一次复用）+ `decide_with_policy()` 一站式入口 + `to_explanation()` 留痕。

### 6接.6 与对侧的能力对照（更新）

| 能力 | Codex | 本仓 | 判定 |
|---|---|---|---|
| 条件策略（and/or/not） | ✅ | ✅ `policy_dsl` | 已对齐 |
| **按网络 host+protocol 下决策** | ✅ `network_rule` | ❌ | **真缺口**（需 WFP 腿） |
| **策略内建正反例自测** | ✅ `match`/`not_match` | ✅ **本轮已实现** | **已对齐，且分失败类** |
| `host_executable` 真身锁定 | ✅ | ❌ | 真缺口 |
| `decision` 四值 | ✅ 含 `PromptUser` | 三值 | 登记后续票 |
| 三态（未判定 ≠ 不成立） | ❌ | ✅ | **本仓超越** |
| 判定合成只许收紧 | 未取证 | ✅ 四规则 + 机检 | **本仓超越** |
| 候选级留痕 | ❌ | ✅ `trail` + `cause` | **本仓超越** |

## 七、`wfp-netfilter` —— `network_rule` 的落地腿（独立 crate，2026-11-15 追加）

### 9.0 决策背景（为什么不直接改 lib.rs）

机主选择「只建独立模块，不碰在飞文件」。事实依据（实测）：

| 事实 | 值 |
|---|---|
| 当前用户 | `LICHUNCHUAN\Administrator` |
| `IsAdmin` | **True**（管理员权限是有的） |
| `Get-NetFirewallRule` | OK（防火墙 cmdlet 可用） |
| `src-tauri/src/lib.rs` | **`M`（他席在飞）** |
| `src-tauri/Cargo.toml` | **`M`（他席在飞）** |
| `src-tauri` 内 WFP 痕迹 | **0**（`Fwpm` / `fwpuclnt` / `WFP` 全无） |

⇒ 真正的阻塞不是权限，而是**并发冲突**：改这两个文件会与他席未提交改动冲突。
故本 crate **自带 workspace 根**（`Cargo.toml` 内 `[workspace]`），可独立
`cargo test`，接线由属主在合并窗口一次完成。

### 7.1 三层切分（为什么这样切）

```
┌──────────────────────────────────────────────┐
│ 1. 策略编译层（纯逻辑，无 FFI，全平台可测）      │  ← 交付重心
│    NetworkRule → FilterSpec → InstallPlan     │
│    host 五条校验 / 协议四值 / 决策四值 / 幂等摘要 │
├──────────────────────────────────────────────┤
│ 2. 安装层（FFI 骨架，需管理员）                 │  ← 仅结构构造
│    ProviderIdentity / InstallOutcome 状态机    │
├──────────────────────────────────────────────┤
│ 3. 接线层（不加：属主在合并窗口完成）            │
└──────────────────────────────────────────────┘
```

第 1 层是重心：**策略正确性与「能不能提权」解耦**，任何平台可 `cargo test`。

### 7.2 与对侧逐项对齐

| 对侧（实测） | 本 crate |
|---|---|
| `network_rule` protocol 恰四值 `http/https/socks5_tcp/socks5_udp` | `NetworkProtocol` 恰四值，有测试穷举 |
| `host` 必须具体主机、**禁通配符** | `HostWildcardNotAllowed` |
| `host` 不含 scheme 或 path | `HostHasSchemeOrPath` |
| `[IPv6]` 方括号字面量 | 剥括号后按 `IpAddr` 解析 |
| `host` 不能含空白 | `HostContainsWhitespace` |
| `justification` 不能为空 | `EmptyJustification` |
| `decision` 四值，`forbidden` wire 为 `deny` | `Decision::as_wire()` 逐字对齐 |
| WFP 事务三件套 `{Begin,Commit,Abort}` | 已在 `install.rs` 文档写明调用序列 |

### 7.3 本 crate 的三处超越

| # | 超越 | 对侧状态 |
|---|---|---|
| 1 | **编译期幂等摘要** `plan_digest`（FNV-1a，纯 std 零依赖） | 未取证到 |
| 2 | **冲突显式化**：同 host+protocol 不同 decision ⇒ 报错点名两条，不静默覆盖 | 未取证到 |
| 3 | **失败方向恒定**：任一坏规则整体失败，绝不跳过坏规则继续 | §0.10 要求 |

摘要的三条不变量（都有测试）：
- 输入顺序不影响摘要（排序后计算）
- 决策变了摘要必变（否则幂等判定会漏）
- **改 RuleId 不改摘要**（语义没变，不该触发重装）

### 7.4 最关键的一条：不假装成功

`install.rs` 的核心不是「能装 filter」，而是**明确表达「没验证」**：

```rust
pub fn is_effective(&self) -> bool { false }   // 恒为 false
```

`InstallOutcome` 四态：

| 状态 | 含义 |
|---|---|
| `NothingToInstall` | 空计划（正常，非错误） |
| `NotSupported { target_os }` | 非 Windows |
| **`Unverified { plan_digest, reason }`** | **代码跑了但没端到端验证** |
| `Aborted { plan_digest, reason }` | 事务回滚 |

**为什么故意不接 `FwpmFilterAdd0`**：
1. 对侧 `FWPM_FILTER0` 的字段值（weight / action / condition 组合）**未取证到** ——
   导入表只能见函数名，见不到调用点传入的结构体内容。硬猜结构体比不做更危险。
2. 端到端验证需管理员 + 真实网卡，失败路径（驱动拒绝、与现有规则冲突、
   provider 已存在）无法在无人值守环境复现。

按 §0.9「做了但不能验证 = 没做」，本轮**不宣称可用**。

### 7.5 验证

```
cargo build                    成功（11.6s，仅拉 windows-sys 0.52）
cargo test                     34 passed（policy 24 + install 10）
```

**五处反向变异逐项转红**：

| 变异 | 结果 |
|---|---|
| 允许通配符 | `host_wildcard_is_refused` 转红 |
| 冲突时后者静默覆盖 | `conflicting_decision_is_refused_not_silently_overridden` 转红 |
| 摘要含 RuleId | `rule_id_rename_does_not_change_digest` 转红 |
| `is_effective` 假装成功 | **2 例**转红（含核心诚实断言） |
| 空计划当成错误 | `empty_plan_yields_nothing_to_install` 转红 |

**未跑 clippy**：`cargo-clippy.exe` 未安装（`rustup component add clippy` 可补）。
按「产物降级」纪律记录，不作为阻塞项。

### 7.6 接线契约（给属主）

```rust
// 1) 把本 crate 加入 src-tauri 依赖（属主在合并窗口做）
//    [dependencies] ihui-wfp-netfilter = { path = "../wfp-netfilter" }

// 2) 构造并编译策略（纯逻辑，可先单测）
use ihui_wfp_netfilter::{compile_rules, NetworkRule, NetworkProtocol, Decision, RuleId};
let plan = compile_rules(&rules)?;

// 3) 安装（当前必然返回 Unverified 或 NotSupported）
use ihui_wfp_netfilter::install::{install_plan, ProviderIdentity};
let provider = ProviderIdentity::new("{固定-GUID}", "IHUI WFP Netfilter")?;
let outcome = install_plan(&plan, &provider)?;
// 4) outcome.is_effective() 恒 false ⇒ 调用方不得据此宣称生效
log(outcome.describe());
```

**GUID 必须固定**：每次运行换 GUID 会让进程崩溃后残留的 filter 无法按 key 精确清理。

### 7.7 仍缺什么（要真正生效还剩两步）

| 步骤 | 缺什么 | 怎么补 |
|---|---|---|
| 1 | `FWPM_FILTER0` 字段值 | 需对侧调用点级取证（Ghidra 定位 `FwpmFilterAdd0` 调用点，读栈上传入的结构体） |
| 2 | 端到端验证 | 管理员会话 + 真实网卡 + 「装后能否被目标进程绕过」的实测 |

在这两步完成前，本 crate 的状态是：**策略层可用、安装层不可宣称可用**。

### 7.8 落地四：`host_executable` 真身锁定（已实现）

对侧 schema 实测（`codex-command-runner.exe` .rdata @ `0x5b9a98`）：

```
host_executable name cannot be empty
host_executable name must be a bare executable name (got ...)
host_executable paths must be strings (got ...)
host_executable paths must be absolute (got ...)
invalid absolute path `...`
host_executable path `...` must have basename `...`      ← 核心约束
```

**这条约束的语义**：按裸名识别程序，用绝对路径锁定真身。
若某路径 basename 与 name 不符，就是一条**自相矛盾的声明**——攻击者可放一个同名
程序在受信目录，让策略「以为」认得它。对侧用 `must have basename` 直接拒绝。

#### 本模块实现的三处超越

| # | 超越 | 对侧状态 |
|---|---|---|
| 1 | **路径归一**：`\`↔`/` 等价、去尾斜杠、大小写不敏感（Windows 语义），并在结果保留原始→归一映射 | 只说不符就拒，未取证到是否归一 |
| 2 | **拒绝路径穿越**：`..` 出现即拒 | 只查 absolute。`C:\a\..\..\evil\git.exe` 是 absolute 但指向别处 |
| 3 | **冲突显式化**：同 name 不同路径集 ⇒ 报错 | 未取证到 |

#### 验证

```
host_executable_test  20 passed（cargo test 全量 54 passed）
```

**四处反向变异逐项转红**：

| 变异 | 结果 |
|---|---|
| 不校验 basename | **2 例**转红（含「任一坏声明整体失败」） |
| 不查路径穿越 | 2 例转红（反斜杠与正斜杠各一） |
| 冲突静默合并 | 1 例转红 |
| **未声明名字时放行** | **2 例**转红（失败方向反了） |

#### 查表语义（失败方向恒定）

```rust
pub fn is_locked_path(&self, name: &str, path: &str) -> bool {
    match self.lookup(name) {
        None => false,          // 未声明 ⇒ false，不是「没约束所以允许」
        Some(b) => /* 归一后精确比对 */,
    }
}
```

`test_undeclared_name_is_false_not_allow` 专门钉住这条：查不到 ≠ 放行。

## 八、未落地项与诚实边界

| 项 | 状态 | 原因 |
|---|---|---|
| Starlark 可编程策略 | **本轮已落地**（受限子集） | 见 §六；`policy_dsl.py` 68 用例 |
| 策略内建正反例自测 | **本轮已落地** | 见 §六补.5；对标对侧 `match`/`not_match` |
| 策略接线层（合成既有判定） | **模块间接线已完成** | 见 §六接；生产调用点仍在他席在飞文件 |
| `network_rule`（按 host+protocol 决策） | **策略层已落地**（独立 crate） | 见 §七；`wfp-netfilter` 34 测试；安装层未宣称可用 |
| `host_executable` 真身锁定 | **本轮已落地** | 见 §7.8；`host_executable.rs` 20 用例 |
| WFP filter 实际安装 | **未实施（有意）** | `FWPM_FILTER0` 字段值未取证；硬猜结构体比不做更危险，见 §7.4 |
| `decision` 第四值 `PromptUser` | **已在策略层落地**（§六补.7） | 不动既有 `Decision` 三值契约，用 `PolicyDecision` 四值 + 显式降级映射 |
| WFP 网络过滤 | **未实施** | 需管理员真机验证；会与在飞 `lib.rs` 冲突 |
| 句柄级路径判权 | **未实施** | 同上 |
| 六层 iframe 握手协议 | **未实施** | 需要配合自定义 scheme，属独立大工程 |
| 144 方法的完整 schema | **未取证** | 只拿到方法名清单；schema 在各方法构造点，需逐点分析 |
| `WqY`（三方兼容判定）函数体 | **未取证** | 跨 chunk 混淆标识符，未取得完整实现 |
| Ghidra 函数级分析 | **未做** | 356MB / 16 万函数不宜全量；按需单函数 |

**本仓没有宣称上线任何东西**：3 个新模块均为纯函数判据 + 测试，尚无生产调用点。
接线需改 `agents.py` / `agent_engine.py` 等在飞文件，按 §2 并发纪律留给属主。

---

## 九、给后续席位的接口说明

```python
# 策略 + 既有判定合成（接线层，推荐入口）
from app.core.policy_binding import bind_policy, decide_with_policy

binding, err = bind_policy('sandbox == "restricted" and not requests_override')
verdict = decide_with_policy(dangerous, context, policy=binding, extra={"host": host})
use(verdict.final)                    # 已按「只许收紧」合成
log(verdict.to_explanation())          # 留痕：哪一侧导致的收紧

# 策略自测（加载期校验，对标对侧 match/not_match）
from app.core.policy_dsl import ExampleCase, EvalState, PolicyEnv, assert_policy

res, cerr = assert_policy(src, [
    ExampleCase("该命中", PolicyEnv({...}), EvalState.TRUE),
    ExampleCase("该拒绝", PolicyEnv({...}), EvalState.FALSE),
])
if cerr or not res.ok:
    raise SystemExit(res.to_explanation() if res else cerr)

# 可编程策略（替代扁平 TOML 规则表，表达条件策略）
from app.core.policy_dsl import PolicyEnv, EvalState, evaluate_source

res, err = evaluate_source('user in ["alice","bob"] and not is_prod', PolicyEnv({...}))
if res.state is EvalState.TRUE:        # 规则命中
    ...
elif res.state is EvalState.FALSE:     # 确定不命中
    ...
else:                                  # UNDETERMINED：不猜，上报 res.to_explanation()
    surface(res.to_explanation())

```python
# 权限求解（在 tool 执行前的权限决议链里）
from app.core.managed_permissions import (
    ManagedPermissions, PermissionRequest, SolveState, solve_managed_permissions,
)
out = solve_managed_permissions(req, managed, default_sandbox=...)
if out.state is SolveState.UNMANAGED:
    pass                      # 零行为变化，整段跳过
elif out.state is SolveState.SOLVED:
    apply(out.resolved)       # 唯一可下发的状态
else:
    surface(out.explain())    # 不可满足 / 未判定：交人，不猜

# 子代理中断（在 thread/interrupt 处理里）
from app.core.subagent_cascade import cascade_interrupt_descendants
rep = await cascade_interrupt_descendants(
    reason=mode, role=role,
    list_descendants=..., interrupt_one=...,
)
if not rep.converged:
    log(rep.explain())        # 有残留，诚实上报

# SSE 投递（在 emitter 写帧处）
from app.core.sse_delivery import DeliveryFrame, DeliveryQueue, tier_for_event
q = DeliveryQueue(flush=real_send)
outcome = q.enqueue(DeliveryFrame(fid, seq, evt, tier_for_event(evt), payload))
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
