<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# R11 · codex-windows-sandbox-service.exe 逆向取证报告

**目标文件**：`C:/Program Files/WindowsApps/OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0/app/resources/codex-windows-sandbox-service.exe`
**文件大小**：58,484,528 B（58 MB）
**MSIX 包**：OpenAI.Codex 26.1111.2228.0（x64）
**取证方法**：仅静态字符串取证。`strings -n 6`（ASCII，266,963 行，4.69 MB）+ `strings -el`（UTF-16，756 行）先落到 scratch 目录，再用 Python 正则做计数与片段摘录，不把全量输出塞上下文。**未执行该二进制**。

**证据等级约定**：
- **[观察]** = 字符串/符号/命中数直接读出的事实
- **[推断]** = 由字符串组合得到的合理结论，未反汇编验证控制流
- **[未知]** = 没有取得证据

---

## ① Rust crate 清单（命中次数 Top 30）

总计命中 **3076 处** cargo registry 路径，**182 个 unique crate**。Registry hash `1949cf8c6b5b557f`。

| # | crate-version | 命中数 | 用途判断 |
|---|---|---|---|
| 1 | rama-http-core-0.3.0-alpha.4 | 496 | HTTP 代理核心（rama 框架）|
| 2 | h2-0.4.19 | 314 | HTTP/2 |
| 3 | tokio-1.52.3 | 288 | 异步运行时 |
| 4 | **starlark-0.14.2** | 213 | **策略 DSL（execpolicy 用）** |
| 5 | hickory-proto-0.25.2 | 109 | DNS 协议 |
| 6 | regex-automata-0.4.13 | 83 | 域名/路径匹配 |
| 7 | hyper-util-0.1.20 | 69 | HTTP 工具集 |
| 8 | **rama-socks5-0.3.0-alpha.4** | 68 | **SOCKS5 监听器** |
| 9 | http-1.4.0 | 67 | HTTP 类型 |
| 10 | rustls-0.23.46 | 58 | TLS |
| 11 | rama-http-types-0.3.0-alpha.4 | 58 | rama HTTP 类型 |
| 12 | aws-lc-sys-0.45.0 | 51 | AWS-LC 加密 |
| 13 | **tonic-0.14.3** | 43 | **gRPC（仅用于 OTLP 导出，不是服务通信）** |
| 14 | rama-http-backend-0.3.0-alpha.4 | 42 | rama HTTP 后端 |
| 15 | ring-0.17.14 | 40 | 加密 |
| 16 | base64-0.22.1 | 38 | — |
| 17 | bytes-1.12.1 | 37 | — |
| 18 | chrono-0.4.43 | 34 | — |
| 19 | indexmap-2.14.0 | 33 | — |
| 20 | aho-corasick-1.1.4 | 31 | 多模式匹配 |
| 21 | serde_json-1.0.149 | 30 | 配置/协议序列化 |
| 22 | hyper-1.11.1 | 29 | HTTP |
| 23 | opentelemetry_sdk-0.31.0 | 28 | 可观测性 |
| 24 | tower-0.5.3 | 28 | 中间件 |
| 25 | rama-net-0.3.0-alpha.4 | 27 | rama 网络层 |
| 26 | rama-tcp-0.3.0-alpha.4 | 26 | rama TCP |
| 27 | url-2.5.8 | 24 | — |
| 28 | futures-channel-0.3.34 | 23 | — |
| 29 | reqwest-0.12.28 | 22 | HTTP 客户端 |
| 30 | hickory-resolver-0.25.2 | 22 | DNS 解析器 |

**关键判断 [推断]**：整个 HTTP/SOCKS5 代理栈基于 **rama 0.3.0-alpha.4** 框架搭建，不是自研；`rama-socks5` 命中 68 次说明内嵌 SOCKS5 监听器。`tonic` 的 gRPC 用途是 OTLP 导出器（见 ⑤），不是主进程↔服务通信协议。

---

## ② WFP 网络过滤命中表（**确认做内核级网络过滤**）⭐重点

### API 命中数

| API | 命中 | 说明 |
|---|---|---|
| `FwpmEngineOpen0` | 2 | 打开 WFP 引擎 |
| `FwpmFilterAdd0` | 2 | 添加 filter object |
| `FwpmSubLayerAdd0` | 2 | 添加 sublayer |
| `FwpmProviderAdd0` | 2 | 添加 provider |
| `FwpmEngineClose0` | 1 | 关闭引擎 |
| `FwpmTransactionBegin0` | 1 | 事务开始 |
| `FwpmTransactionCommit0` | 1 | 事务提交 |
| `FwpmTransactionAbort0` | 1 | 事务回滚 |
| `FwpmFilterDeleteByKey0` | 1 | 按 key 删 filter |
| `FwpmSubLayerDeleteByKey0` | 1 | 按 key 删 sublayer |
| `FwpmProviderDeleteByKey0` | 1 | 按 key 删 provider |
| `FwpmCalloutAdd0` | **0** | 无 callout 注入 |
| `FwpmLayerAdd0` | **0** | 未自定义 layer |
| `WdaOpenPolicyStore` | **0** | 无 WDAC/WDA 调用 |
| `WdaCreateProfile` | **0** | 无 WDAC/WDA 调用 |
| `WFPMON` | **0** | 无 WFPMON 引用 |
| `FwpsCalloutRegister` | **0** | 无内核 callout |
| `FwpsFilterApply` | **0** | 无内核 filter |

> **说明 [观察]**：`FwpmCalloutAdd0`/`WdaOpenPolicyStore`/`WFPMON` 命中 0 次；已用 ASCII 与 UTF-16 两套 strings 双查，确认缺失。

### Provider / SubLayer 字符串证据

```
Codex Windows Sandbox WFP
Persistent WFP provider for Codex Windows sandbox filters
Persistent WFP sublayer for Codex Windows sandbox filters
FwpmProviderAdd0Persistent
```
**[观察]** Provider 与 SubLayer 均以 `Persistent` 形式添加，意味着规则落盘在 BLOB 里，重启仍在。

### 静态 filter name 清单（每条 v4/v6 × Block，共 12 个）

| filter name | 协议/端口 | 次数 |
|---|---|---|
| `codex_wfp_dns_53_v4` | DNS UDP/TCP 53 (IPv4) | 4 |
| `codex_wfp_dns_53_v6` | DNS UDP/TCP 53 (IPv6) | 4 |
| `codex_wfp_dns_853_v4` | DoT 853 (IPv4) | 4 |
| `codex_wfp_dns_853_v6` | DoT 853 (IPv6) | 4 |
| `codex_wfp_icmp_connect_v4` | ICMP connect (IPv4) | 4 |
| `codex_wfp_icmp_connect_v6` | ICMP connect (IPv6) | 4 |
| `codex_wfp_icmp_assign_v4` | ICMP assign (IPv4) | 4 |
| `codex_wfp_icmp_assign_v6` | ICMP assign (IPv6) | 4 |
| `codex_wfp_smb_139_v4` | SMB 139 (IPv4) | 4 |
| `codex_wfp_smb_139_v6` | SMB 139 (IPv6) | 4 |
| `codex_wfp_smb_445_v4` | SMB 445 (IPv4) | 4 |
| `codex_wfp_smb_445_v6` | SMB 445 (IPv6) | 4 |

**结论 [观察 + 推断]**：WFP 路径只做**静态黑名单**，封 DNS(53)/DoT(853)/ICMP/SMB(139,445) 四类危险协议，共 12 个 filter。**未见任何 `FWPM_LAYER_*`、`FWPM_CONDITION_*` 字符串，未见按进程 SID/容器 ID 动态生成规则的痕迹** → 真正的"允许哪些域名"白名单不走 WFP，走用户态代理（见 ⑤⑥ 的 network-proxy 模块）。

---

## ③ AppContainer / 受限令牌命中表

| API | 命中 | 说明 |
|---|---|---|
| `CreateRestrictedToken` | **2** | ✅ 受限令牌 |
| `SetTokenInformation` | 2 | 设置令牌信息 |
| `AdjustTokenPrivileges` | 5 | 调权 |
| `CreateProcessW` | 1 | 启动沙箱进程 |
| `ImpersonateNamedPipeClient` | 1 | 管道客户端模拟 |
| `OpenProcessToken` | 命中 | 打开自身令牌 |
| `CreateWellKnownSid` | 命中 | 创建已知 SID |
| `BuildSecurityDescriptor` | 命中 | 构造 DACL |
| `CreateAppContainerProfile` | **0** | ❌ 无 AppContainer |
| `DeriveCapabilitySidsFromName` | **0** | ❌ |
| `NtCreateLowboxToken` | **0** | ❌ 无 LowBox |
| `LowBoxToken` | **0** | ❌ |
| `CreateJobObject` | **0** | ❌ 无 Job Object |
| `CreateProcessAsUserW` | **0** | ❌ |

**结论 [观察]**：**不使用 AppContainer/LowBox/Job Object**，走 `CreateRestrictedToken` 剥权 + DACL 拒绝 ACE + 私有桌面路线。

### wrapper 启动参数证据（`windows-sandbox-rs\src\wrapper.rs`）

```
--launch-payload-env
--workspace-root
--deny-read-paths-json
--deny-write-paths-json
--permission-profile
--windows-sandbox-level
--windows-sandbox-private-desktop-name
--preserve-proxy-settings
--proxy-enforced
--network-proxy-restricting-sid
--read-roots-include-platform-defaults
--read-roots-json
--write-roots-json
--run-as-windows-sandbox
```

ACL 应用证据：
```
deny-read ACLs applied <N> deny-read ACLs
granted non-inheriting read-attributes ACE on user profile <path>
failed to grant non-inheriting read-attributes ACE on user profile <path>; continuing setup
no read roots to grant; skipping read ACL helper
read ACL helper already running; skipping spawn
read ACL mutex check failed: <e>; spawning anyway
write root <path> mismatch
```

**[推断]** 设计要点：
- 受限令牌剥权（`SeChangeNotifyPrivilege` 被显式保留，其他剥掉）
- 文件系统用 DACL 非继承 ACE 做拒绝读/只给 read-attributes（防列举但允许元数据），写入白名单用 `--write-roots-json`
- **私有桌面**（`--windows-sandbox-private-desktop-name`）隔离窗口/剪贴板
- **可选 Secondary Logon**（`--run-as-windows-sandbox`）走 runas 机制
- `--network-proxy-restricting-sid` 暗示把一个 SID 传给代理做"限制该 SID 出网"标记

---

## ④ 沙箱策略面

### 关键字命中次数

| 字符串 | 命中 | 备注 |
|---|---|---|
| `sandbox` | 388 | 总述 |
| `approval` | 100 | 审批体系 |
| `network_proxy` | 26 | 代理策略 |
| `windows_sandbox` | 9 | Windows 路径 |
| `windows_sandbox_service` | 9 | 本服务 |
| `prefix_rule` | 10 | 路径前缀规则 |
| `network_rule` | 8 | 网络规则 |
| `workspace_write` | 7 | 沙箱档 |
| `network_access` | 6 | 网络开关 |
| `execpolicy` | 5 | Starlark 策略 |
| `danger_full_access` | **0** | **下划线形式无命中** |
| `read_only` | **0** | **下划线形式无命中** |

**[观察]** `danger_full_access`/`read_only` 命中 0，但连字符形式 `read-only` / `workspace-write` / `danger-full-access` 命中多次 → 对外 CLI/配置用连字符，内部 serde 字段用下划线（`sandbox_workspace_write` 命中即证）。

### SandboxMode 四档 [观察]

```
SandboxModeRequirement
read-only
workspace-write
danger-full-access
external-sandbox
```

### 配置 schema（20+ 个 `*RequirementsToml`）[观察]

`ConfigRequirementsToml` / `WindowsRequirementsToml` / `RawFilesystemRequirementsToml` / `RawNetworkRequirementsToml`（含 `Elevated` / `Unelevated` 两态）/ `ApplicationRequirementsToml` / `ApplicationStorageRequirementsToml` / `PermissionsRequirementsToml` / `SystemRequirementsToml` / `BrowserUseRequirementsToml` / `ComputerUseWindowsRequirementsToml` / `InAppBrowserRequirementsToml` / `AppsRequirementsToml` / `AppToolsRequirementsToml` / `AutoReviewRequirementsToml` / `ManagedHooksRequirementsToml` / `MarketplaceRequirementsToml` / `ModelsRequirementsToml` / `OtelRequirementsToml` / `CloudRequirementsToml` / `DeliveredRequirementsToml` / `RequirementsExecPolicyToml` / `RequirementsExecPolicyPatternTokenToml` / `WindowsSandboxImplementationToml` 等。

### Network 段字段 [观察]

```
enabled, http_port, socks_port,
allow_upstream_proxy,
dangerously_allow_non_loopback_proxy,
dangerously_allow_all_unix_sockets,
domains, review_domains, allowed_domains, managed_allowed_domains_only, denied_domains,
unix_sockets, allow_unix_sockets, allow_local_binding,
header_injections
```

### Filesystem 段字段 [观察]

```
deny_read, description, extends, workspace_roots
```
匹配方式三档：`exact` / `prefix` / `regex`。

### ExecPolicy 规则字段 [观察]

```
prefix_rule
network_rule
host_executable (paths, name, basename, absolute)
justification (cannot be empty)
canonical_matching
```
匹配 token 类型：`RequirementsExecPolicyPatternTokenToml`（exact/prefix/regex 三种）。

### Starlark 策略引擎 [观察]

```
execpolicy\src\parser.rs
execpolicy\src\rule.rs
execpolicy\src\executable_name.rs
policy_builder requires Evaluator.extra to be populated
Evaluator.extra must contain a PolicyBuilder
RequirementsExecPolicyToml
```
**[推断]** 执行策略用 Starlark（Bazel 同源）书写，可版本化、可 review、可沙箱内再执行，是这套设计里最像"策略即代码"的部分。

---

## ⑤ 服务通信端点

| 端点 | 类型 | 用途 |
|---|---|---|
| `\\.\pipe\OpenAI.CodexSandbox` | Named Pipe | **服务主控制管道** [观察] |
| `\\.\pipe\codex-proxy-auth-<...>` | Named Pipe | 代理认证管道 [观察前缀，后缀未确认] |
| `CodexSandboxService` | Windows Service 名 | 服务本体 [观察] |
| `SOFTWARE\OpenAI\Codex\WindowsSandboxService\RegisteredCore` | 注册表 | 安装记录 [观察] |
| `SOFTWARE\OpenAI\Codex\WindowsSandboxService` | 注册表 | 服务根键 [观察] |

### Provisioning 协议 [观察]

```
ProvisioningMessage::RegisterInstallationRequest
ProvisioningMessage::RegisterInstallationResponse
ProvisioningMessage::ProvisionSandboxRequest
ProvisioningMessage::ProvisionSandboxResponse
```
**[推断]** 三段式：`RegisterInstallation`（注册安装）→ `ProvisionSandbox`（下发沙箱配置）→ 运行；协议编码推断为 serde JSON（未抓包验证）。

### 回环白名单字符串 [观察]

```
localhost,127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

### OTLP gRPC 端口 [观察]

`OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317`（traces）/ `http://localhost:4318`（metrics/logs）。**这是 telemetry 出口，不是服务对外 API。**

**结论 [观察 + 推断]**：主进程↔沙箱服务只通过 **`\\.\pipe\OpenAI.CodexSandbox` 一条命名管道**通信；没有 gRPC 入口（tonic 命中全部属于 OTLP）。

---

## ⑥ 源码模块结构（panic 路径还原）

### `windows-sandbox-rs\src\`
```
env                          # 环境变量处理
token                        # 受限令牌构造与剥权
wrapper                      # sandbox 启动器（--launch-payload-env 等 CLI 入口）
winutil                      # Win32 工具集（SID/DACL/Token API 封装）
no_reparse_dir               # 防 reparse point/symlink 攻击
setup_provisioning           # 安装/配置注册流程
environment_transport        # 环境变量下发
ssh_config_dependencies      # ssh_config 依赖追踪
```

### `network-proxy\src\`
```
runtime                      # 代理运行时主循环
connect_policy               # CONNECT 决策
network_policy               # 总策略
domain_matcher               # 域名匹配
upstream                     # 上游选择
tcp_upstream                 # TCP 上游
mitm                         # MITM 解密（header_injections / review）
attribution                  # 流量归因
aws_sigv4                    # AWS SigV4 签名（credential broker 用）
credential_broker\
  registry
  configured
  matching
  replacement
connection_lifecycle\listeners
```

### `execpolicy\src\`
```
parser                       # Starlark 解析入口
rule                         # 规则对象
executable_name              # 可执行名匹配
```

**[推断]** 整体架构：
1. **主进程**（Codex 桌面端）通过 `\\.\pipe\OpenAI.CodexSandbox` 发 `ProvisionSandboxRequest` 给本服务
2. **本服务**（`windows-sandbox-rs`）负责：受限令牌构造 → 文件系统 ACL → 私有桌面 → 启动 wrapper 进程
3. **wrapper** 拉起沙箱内目标进程，环境变量里注入代理设置
4. **network-proxy**（独立于 wrapper，或同服务内）监听 loopback HTTP/SOCKS5，做域名白名单 + 凭据脱敏 + MITM 审查
5. **WFP 静态规则**（DNS/DoT/ICMP/SMB Block）做兜底，绕过代理直连这些端口一律 block

---

## ⑦ 最值得本仓借鉴的设计

### 1. **两层网络：用户态代理白名单 + 内核 WFP 黑名单兜底** ⭐⭐⭐⭐⭐
- **WFP 只封 4 类危险协议**（DNS/DoT/ICMP/SMB，共 12 个 filter），保持规则表小且稳定
- **域名级 allow/deny 全部走用户态代理**（rama + `domain_matcher` + `connect_policy` + `network_policy`），策略可热更新、可按会话下发、可 MITM 审查
- **本仓启示**：不要试图用 WFP 做动态白名单（API 复杂、规则爆炸），把 WFP 当"最后兜底"层，业务规则走应用层代理。

### 2. **CreateRestrictedToken + DACL deny-ACE + 私有桌面 + Secondary Logon 四件套** ⭐⭐⭐⭐⭐
- 不依赖 AppContainer（避免 MSIX/包身份限制），适用范围更广
- 文件系统隔离用 **非继承 ACE**（`granted non-inheriting read-attributes ACE on user profile`），只允许元数据读取、防列举，比整目录 deny 更细腻
- 私有桌面（`--windows-sandbox-private-desktop-name`）天然隔离剪贴板/窗口消息
- CLI 全部 JSON 化（`--deny-read-paths-json` 等），方便跨进程传递

### 3. **Starlark 作为执行策略 DSL** ⭐⭐⭐⭐
- `execpolicy` crate 提供 `parser`/`rule`/`executable_name` 三层
- 规则字段：`prefix_rule` / `network_rule` / `host_executable` / `justification` / `canonical_matching`
- **本仓启示**：让策略"可代码化"，支持继承、组合、review，比纯 JSON/YAML 强很多；`justification` 强制填写是审计关键。

### 4. **`*RequirementsToml` 家族作为跨端 capability 契约** ⭐⭐⭐⭐
- 20+ 个独立 schema，每个能力域（filesystem/network/browser/computer_use/apps/hooks/marketplace/models/otel...）一个 Toml
- 支持 `extends` 继承、`deny_read`/`workspace_roots` 显式声明
- **本仓启示**：用 schema 拆能力域，主进程按需下发"这个会话允许哪些能力"，避免一次性巨型配置。

### 5. **Named Pipe 单入口 + ProvisioningMessage 三段式** ⭐⭐⭐
- 服务只暴露 `\\.\pipe\OpenAI.CodexSandbox` 一条管道
- 协议只四种消息：`RegisterInstallation{Request,Response}` / `ProvisionSandbox{Request,Response}`
- **本仓启示**：服务接口越窄越好，所有"配置下发"走 `Provision` 一条消息，所有"安装元信息"走 `RegisterInstallation` 一条消息，调试/审计都容易。

### 6. **凭据 broker 单独拆包** ⭐⭐⭐
- `credential_broker\{registry, configured, matching, replacement}` 四个子模块
- 配合 `attribution`（流量归因）和 `aws_sigv4`（签名重算）
- **推断**：凭据在代理层做"按域名替换"，沙箱内进程拿到的是脱敏/受限版本，真实凭据只在 broker 内流转。

### 7. **`no_reparse_dir` 防 symlink 攻击** ⭐⭐
- Windows 沙箱经典坑：用户在 workspace 里放 junction/symlink 指向敏感目录
- 专门一个模块 + `--deny-read-paths-json` 显式拒绝路径 + 非继承 ACE，三层防
- **本仓启示**：沙箱文件系统隔离必须显式处理 reparse point，否则 DACL 全白做。

---

## 取证缺口与未覆盖项

1. **未反编译**：WFP filter 的实际 `FWPM_LAYER_*`、conditions、action、weight 全部未知；只看到 filter name，没看到匹配条件。
2. **管道协议未抓包**：`ProvisioningMessage` 推断为 serde JSON，但没有运行时抓包证据。
3. **`codex-proxy-auth-` 管道后缀**未确认（推断按 PID 或会话 ID）。
4. **`--network-proxy-restricting-sid` 的 SID 来源**未确认（可能是本地服务 SID 或匿名 SID）。
5. **`--windows-sandbox-level` 取值范围**未枚举（推断有 low/medium/high 或 numeric 等级）。
6. **`credential_broker` 凭据来源**（配置文件？主进程下发？Keychain/DPAPI？）未取证。
7. **未做动态行为分析**（红线：不执行该二进制）。

---

## 红线遵守声明

- ✅ 仅静态读取字符串与符号，未执行该二进制
- ✅ 仅记录 API 名、字符串片段、路径、命中计数，未粘任何专有源码原文
- ✅ 未破解许可证、未提取凭据、未绕过任何付费/授权机制
- ✅ 报告内容仅用于本仓沙箱/网络隔离设计的合法借鉴
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
