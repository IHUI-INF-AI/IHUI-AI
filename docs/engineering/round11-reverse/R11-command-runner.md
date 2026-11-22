<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R11 逆向取证：Codex 桌面端沙箱命令执行核心 `codex-command-runner.exe`

> 取证日期：2026-11-15　|　目标：OpenAI Codex 桌面端（MSIX 包 26.1111.2228.0）
> 文件：`C:/Program Files/WindowsApps/OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0/app/resources/codex-command-runner.exe`
> 形态：PE32+ GUI x86-64，8 sections，**8,932,144 字节**（≈8.9MB，Rust 编译）
> 方法：`strings -n 6` 提取 ASCII 字符串 38,315 条 + 自定义扫描提取 UTF-16LE 宽字符串 137 条；全部计数基于真实命中，区分观察/推断/未知。
> 红线：仅只读取证，未执行该二进制、未提取凭据、未粘贴专有源码原文，只记录符号名/字符串/路径/计数。文件可读，无 EPERM。

---

## ① Rust crate 清单（47 个，registry 路径命中 456 处）

还原自 panic 路径 `C:\Users\runneradmin\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\<crate>-<ver>\src\...`（注意路径分隔符为反斜杠）。

| crate | version | 命中 | 说明 |
|---|---|---|---|
| **starlark** | 0.14.2 | **213** | Starlark 规则语言解释器（策略核心） |
| starlark_map | 0.14.2 | 4 | 同上族 |
| starlark_syntax | 0.14.2 | 12 | 同上族 |
| regex-automata | 0.4.13 | 67 | 正则引擎 |
| aho-corasick | 1.1.4 | 28 | 多模式串匹配 |
| num-bigint | 0.4.6 | 15 | 大整数（Starlark 数值） |
| regex-syntax | 0.8.8 | 14 | 正则语法 |
| memchr | 2.8.1 | 11 | 字节搜索 |
| url | 2.5.8 | 9 | URL 解析 |
| base64 | 0.22.1 | 7 | 编码 |
| chrono | 0.4.43 | 7 | 时间 |
| serde_json | 1.0.149 | 5 | JSON |
| serde_core | 1.0.228 | 3 | 序列化 |
| once_cell | 1.21.4 | 4 | 惰性初始化 |
| itoa | 1.0.17 | 4 | 整数转串 |
| time | 0.3.55 | 4 | 时间 |
| tracing-core | 0.1.36 | 5 | 日志/追踪 |
| unicode-normalization | 0.1.25 | 3 | Unicode |
| annotate-snippets | 0.9.2 | 3 | 错误标注（诊断输出） |
| allocative | 0.3.6 | 2 | 内存分析（Starlark 配套） |
| anyhow | 1.0.103 | 2 | 错误处理 |
| erased-serde | 0.3.31 / 0.4.10 | 各 2 | 类型擦除序列化 |
| hashbrown | 0.16.1 / 0.17.1 | 各 1 | 哈希表 |
| icu_collections / icu_normalizer | 2.2.0 | 2 / 1 | 国际化 |
| idna | 1.1.0 | 2 | 域名编码 |
| indexmap | 2.14.0 | 2 | 有序哈希 |
| itertools | 0.14.0 | 1 | 迭代工具 |
| logos | 0.15.1 | 1 | 词法分析生成器（parser 配套） |
| num-integer | 0.1.46 | 1 | 整数 |
| pagable | 0.4.1 | 1 | 分页/持久化 |
| percent-encoding | 2.3.2 | 1 | URL 编码 |
| regex | 1.12.3 | 2 | 正则 |
| serde | 1.0.228 | 1 | 序列化 |
| shared_library | 0.1.9 | 2 | 动态库加载 |
| smallvec | 1.15.1 | 1 | 小向量 |
| strsim | 0.10.0 | 1 | 字符串相似度 |
| textwrap | 0.11.0 | 1 | 换行 |
| tinyvec | 1.10.0 | 2 | 小向量 |
| tracing-appender | 0.2.4 | 1 | 日志落盘 |
| unicode-width | 0.1.14 | 1 | 宽度 |
| caseless | 0.2.2 | 1 | 大小写折叠 |
| bumpalo | 3.19.1 | 1 | arena 分配 |
| curl | 0.4.50 | 1 | HTTP（构建期绑定） |

**观察**：`starlark` 依赖命中（213+12+4=229）远超其它一切，结合 execpolicy 模块可判定沙箱命令策略由 Starlark 规则脚本定义并在本二进制内解释执行。

---

## ② 命令执行能力面：逐项字符串证据（含重要负面证据）

对全二进制（ASCII + UTF-16）做精确子串计数：

| 关键词 | 命中 | 备注 |
|---|---|---|
| `sandbox_policy` | **0** | — |
| `danger_full_access` | **0** | — |
| `workspace_write` | **0** | — |
| `read_only` | **0** | snake_case 0；kebab `read-only` 2 |
| `approval_policy` | **0** | — |
| `on_request` | **0** | — |
| `on_failure` | **1** | 误命中 `SEC_E_CROSSREALM_DELEGATION_FAILURE`（SSPI 错误串，非策略枚举） |
| `never` | **20** | 泛用词，无法确证为 approval 枚举 |
| `network_access` | **0** | — |
| `execpolicy` | **5** | 真实命中（见下） |
| `prefix_rule` | **1** | 真实命中 |
| `network_rule` | **8** | 真实命中 |
| `apply_patch` | **0** | — |
| `unified_exec` | **0** | — |

camelCase 变体复核亦为 0：`sandboxPolicy`/`approvalPolicy`/`onRequest`/`networkAccess` 等全 0。

**execpolicy 相关字符串原文片段**：
- `execpolicy\src\parser.rs`
- `execpolicy\src\executable_name.rs`
- `execpolicy\src\rule.rs`
- `le string has invalid shell syntax` + `codex_execpolicy::parser::POLICY_BUILTINS_STATICS`

**network_rule 校验报错原文片段**（说明规则字段校验逻辑在本地）：
- `network_rule host cannot contain whitespace`
- `network_rule protocol must be one of http, https, so…`
- `network_rule host cannot be empty`
- `network_rule host must be a specific host; wildcards are not allowed`
- `network_rule host has an invalid bracketed IPv6 literal`
- `network_rule host contains an unsupported suffix:`

**prefix_rule 相关**：`prefix_rule host protocol`（字段名串）。

**推断（非观察）**：本二进制是"下游执行器"，不含策略 schema/枚举本体（snake_case 全 0 为强证据）；策略由上层协议（`protocol\permissions.rs`）下发。`network_rule`/`prefix_rule` 字符串属 execpolicy 对下发规则做本地校验的报错文案，不是策略枚举定义处。

---

## ③ Windows 沙箱 API 命中表

原始字节精确计数（导入名 ASCII；计数含导入表及引用）：

| API | 命中 | 沙箱作用 | 状态 |
|---|---|---|---|
| `CreateProcessAsUserW` | 3 | 用受限 token 拉起子进程 | **观察·已用** |
| `AdjustTokenPrivileges` | 3 | 收紧/剔除 token 特权 | **观察·已用** |
| `CreateRestrictedToken` | 2 | 构造受限 token | **观察·已用** |
| `SetEntriesInAclW` | 2 | 修改 ACL（`SetEntriesInAclA` 0） | **观察·已用** |
| `SetTokenInformation` | 2 | 设 token 信息（如完整性级别） | **观察·已用** |
| `OpenProcessToken` | 2 | 取进程 token | **观察·已用** |
| `CreateWellKnownSid` | 2 | 取内置 SID（受限/低完整性） | **观察·已用** |
| `CreateProcessW` | 1 | 普通子进程创建 | **观察·已用** |
| `CreateJobObjectW` | 1 | 作业对象（进程组/生命周期） | **观察·已用** |
| `CreatePseudoConsole` | 1 | ConPTY 创建 | **观察·已用** |
| `ResizePseudoConsole` | 2 | ConPTY 调整尺寸 | **观察·已用** |
| `ClosePseudoConsole` | 1 | ConPTY 关闭 | **观察·已用** |
| `LoadLibraryW` | 1 | 动态加载 | **观察·已用** |
| `GetProcAddress` | 1 | 取函数地址 | **观察·已用** |
| `SetJobInformation` | 0 | — | 未命中 |
| `RevertToSelf` | 0 | — | 未命中 |
| `AddAccessAllowedAce` / `Ex` | 0 | — | 未命中 |
| `WdaOpenPolicyStore` / `WdaGetPolicyStoreInfo` / `WdaCreateSandbox` | 0 | AppContainer(WDA) | **未使用** |
| `FwpmEngineOpen0` / `FwpmTransactionBegin0` / `FwpmFilterAdd0` / `FwpmSubLayerAdd0` / `FwpmFreeMemory0` | 0 | WFP 网络过滤 | **未使用** |
| `WriteProcessMemory` / `VirtualAllocEx` / `CreateRemoteThread` | 0 | 进程注入 | **无注入** |
| `LogonUserW` / `ImpersonateLoggedOnUser` | 0 | 登录模拟 | 未命中 |
| `SaferComputeTokenFromLevel` / `SaferCloseLevel` | 0 | SAFER 策略 | 未命中 |

**结论（观察）**：沙箱走 **受限 token + ACL + Job Object + ConPTY** 路线；**没有 WFP 网络过滤、没有 AppContainer(WDA)、没有 RevertToSelf、没有进程注入**。网络管控应在本执行器之外实现（推断）。

---

## ④ 命令注入防护 / 参数转义

- **策略预校验**：`execpolicy` 有 `parser.rs`，报错 `has invalid shell syntax` + 符号 `codex_execpolicy::parser::POLICY_BUILTINS_STATICS` —— 命令先被解析成结构并校验语法合法性，**不是直接拼 shell 串透传**。
- **规则匹配**：`execpolicy` 的 `rule.rs` / `executable_name.rs` 配合 `prefix_rule`，按可执行名/路径前缀判定放行。
- **进程创建方式**：走 `CreateProcessAsUserW`（受限 token）+ ConPTY，按需建进程，未见 `cmd /c`、`powershell -Command` 之类硬编码 shell 包装串。
- **未知（未确认）**：argv 拼接/引号转义的精确算法——`escape`/`quoting`/`argv` 无独立命中，需读 `windows-sandbox-rs\src\process.rs` 实现细节才能定论。

---

## ⑤ 源码模块结构（panic 路径还原）

| 模块 | 角色 |
|---|---|
| `windows-sandbox-rs\src\bin\command_runner\win.rs` | **本 exe 主入口** |
| `windows-sandbox-rs\src\process.rs` | 进程创建/沙箱核心 |
| `windows-sandbox-rs\src\token.rs` | 受限 token 构造 |
| `execpolicy\src\parser.rs` | 命令解析 + 语法校验 |
| `execpolicy\src\rule.rs` | 规则定义/匹配 |
| `execpolicy\src\executable_name.rs` | 可执行名判定 |
| `protocol\src\permissions.rs` | 权限/事件协议（含行号 2614/2626/2633/2660） |
| `utils\pty\src\win\psuedocon.rs` | ConPTY 封装 |
| `utils\path-uri\src\{lib,config_path,api_path_string}.rs` | 路径/URI 安全处理 |
| `utils\absolute-path\src\lib.rs` | 绝对路径处理 |

**观察**：命令执行栈分四层——`execpolicy`（策略/解析）→ `protocol`（权限协议）→ `windows-sandbox-rs`（Win32 沙箱执行）→ `utils/pty`（终端抽象），路径安全独立成 `path-uri`/`absolute-path` 库。

---

## ⑥ 最值得本仓 IHUI-AI 借鉴的设计

1. **Starlark 定义沙箱命令策略**（`execpolicy` + starlark/starlark_syntax/starlark_map）：策略可声明、可校验、可静态分析，远优于硬编码枚举。本仓可在 `apps/ai-service` 沙箱策略层引入声明式规则语言。
2. **受限 token 沙箱四件套**：`CreateRestrictedToken` + `AdjustTokenPrivileges` + ACL(`SetEntriesInAclW`) + Job Object(`CreateJobObjectW`)，配 `CreateProcessAsUserW` 拉起子进程。本仓 Windows 端命令沙箱可直接对标这套最小特权组合。
3. **执行与决策分离**：本二进制不含策略 schema（能力面 snake_case 全 0），策略由 `protocol\permissions.rs` 协议层下发。执行器可单测、可替换策略源——本仓 `ai-service` 与 `api` 分层同样适用。
4. **ConPTY 统一终端抽象**（`utils\pty`）：交互式命令走 `Create/Resize/ClosePseudoConsole`，跨命令统一 I/O。
5. **路径安全独立成库**（`path-uri` + `absolute-path`）：`file:///` URL ↔ 本地路径互转与校验集中处理，避免路径穿越逻辑散落各端——本仓 `packages/shared` 可提取同类工具。

---

## 缺口与后续建议

- argv 转义/quoting 精确算法未确认（需二次取证 `windows-sandbox-rs\src\process.rs`）。
- 网络过滤（WFP/AppContainer）实际落点未定位——本执行器确认为 0 命中，应在主程序或另一组件。
- `token.rs` 具体降权步骤（剔除哪些特权、设哪档完整性级别）未展开。
- 策略枚举本体的真实字段名（snake_case 全 0）需取证上层协议/主程序侧。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
