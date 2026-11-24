<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Codex 26.1111 · `codex-windows-sandbox-setup.exe` 取证（round 11）

<!-- © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top -->
<!-- Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。 -->

> 取证对象：`C:/Program Files/WindowsApps/OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0/app/resources/codex-windows-sandbox-setup.exe`
> 体积 19,556,144 B · Rust 编译 · `strings -n 6` 提取 82,362 行 · **未执行该二进制**（系统级安装器，执行会改系统状态）
> 姊妹报告：`R11-command-runner.md`（执行器）、`R11-sandbox-service.md`（服务）——本报告补齐沙箱**初始化/预配**这一环。

## 0. 它是什么：一次性预配器，不是运行时

命中证据：`NetUserAdd`=1、`RegSetValue`=1、`FwpmProviderAdd0`=2、`FwpmSubLayerAdd0`=2。
**没有** `OpenSCManager`/`CreateService`/`StartService`（全 0）——它**不装服务**（服务 `CodexSandboxService` 由别处装，见 service 报告）；也没有 `AdjustTokenPrivileges`/`LogonUser`/`LsaAddAccountRights`（全 0）——它**不给自己提权**，靠安装时已是管理员上下文。
角色：装机时跑一次，把沙箱需要的**系统资源**（本地用户组、注册表记录、WFP provider/sublayer、离线防火墙规则）一次性建好。

## 1. Rust crate 清单（按命中）

从 cargo 路径还原，主要依赖与 command-runner/service 同源：`starlark`（execpolicy 策略）、`rama` 系（代理栈）、`windows-sandbox-rs`（Win32 沙箱封装）、`http-client`（自有代理客户端）、`absolute-path`/`path-uri`（路径安全）。本二进制是这几个 crate 的**入口胶水**，自身逻辑薄。

## 2. 安装/初始化动作面（重点）

| 动作 | 命中 | 证据 |
|------|------|------|
| 建本地用户 | `NetUserAdd`=1 | 建离线沙箱运行用户 |
| 写注册表 | `RegSetValue`=1 | 沙箱安装记录 |
| 注册 WFP provider | `FwpmProviderAdd0`=2 | 静态防火墙 provider |
| 注册 WFP sublayer | `FwpmSubLayerAdd0`=2 | 规则子层 |
| 建本地用户组 | `CodexSandboxUsers` 命中 7 | "Codex sandbox internal group (managed)" |

**离线防火墙规则**（本报告最有价值的发现，见 §3）：`codex_sandbox_offline_block_outbound` / `_block_inbound` / `_block_loopback_tcp` / `_block_loopback_udp` / `_block_loopback_tcp_except_proxy` —— 一整套**离线模式的网络块规则**。

## 3. 离线沙箱网络隔离范式 ⭐（最值得借鉴）

字符串证据链：
- 规则名：`Codex Sandbox Offline - Block Non-Loopback Outbound` / `Block Loopback UDP` / `Block Loopback TCP (Except Proxy)`
- 地址段：`0.0.0.0-126.255.255.255,128.0.0.0-255.255.255.255`（**挖掉 127.0.0.0/8**）+ `::,::2-ffff:...`（挖掉 `::1`）—— 精确保留回环、块掉一切非回环
- 白名单：`127.0.0.0/8,::/127` → 离线时**只允许回环**，且 TCP 还要"except proxy"（只放行到本地代理端口）
- 用户作用域校验：`offline firewall rule user scope mismatch: expected SID` —— 防火墙规则**按沙箱用户 SID 限定作用域**，不污染其它用户
- 代理白名单：`ensure offline proxy allowlist failed` + `ensure offline network blocks failed`

**范式本质**：离线模式不是"断网卡"，而是 **WFP 按用户 SID 作用域 + 精确 CIDR 块规则 + 回环代理白名单**三件套——既让沙箱完全断外网，又保留一条"只能连本地代理"的窄缝，由用户态代理统一裁决。这比"一刀切断网"更可控，也比 service 报告里的"静态黑名单"更严（离线是**默认拒绝、白名单放行**）。

## 4. 沙箱运行凭据 + SDDL 隔离

- 注册记录字段（一条 serde 结构）：`version / offline_username / online_username / created_at / proxy_ports / allow_local_binding / read_roots / write_roots / offline / username / password`
- **两态用户**：`offline_username` + `online_username` —— 离线/在线模式用不同沙箱用户，权限面分离
- **DPAPI 加密密码**：`dpapi protect failed for offline user:` —— 沙箱用户密码用 Windows DPAPI 加密落盘，不明文
- SDDL：`D:P(A;;GA;;;SY)(A;;GA;;;BA)` —— DACL 保护对象只允许 SYSTEM + Administrators 完全访问
- 互斥体：`Global\Codex...` / `Local\CodexSandboxReadAcl` —— 防并发初始化 + 读 ACL

## 5. CLI 参数面

只发现两个：`--launch-payload` / `--launch-payload-env`（`BOX_LAUNCH_COUNT` / `BOX_LAUNCH_BYTES` 环境变量联动）—— 说明本二进制在新版被**重构为"launch payload"驱动**，不再是裸 CLI 子命令；离线/在线、读/写根目录等配置通过 payload 传入，而非命令行开关。这是相对旧版的形态变化。

## 6. 与姊妹二进制的能力分层（五枚二进制全景）

| 二进制 | 角色 | 网络管控 |
|--------|------|---------|
| `codex.exe`（382MB） | 主引擎/agent loop | 策略决策（四维权限档） |
| `codex-command-runner.exe`（8.9MB） | 命令执行器 | 受限token+ACL+JobObject+ConPTY，本地校验 execpolicy 规则 |
| `codex-windows-sandbox-service.exe`（58MB） | 沙箱服务 | WFP 静态黑名单 + 用户态代理（rama）+ CreateRestrictedToken |
| `codex-windows-sandbox-setup.exe`（19MB） | **一次性预配** | **WFP 离线块规则 + 代理白名单 + DPAPI 凭据** |
| `rg.exe` | 搜索工具 | — |

**关键架构判断**：Codex 的沙箱是**三层网络管控**——① 在线时用户态代理做域名白名单（command-runner/service），② 离线时 WFP 默认拒绝+回环白名单（setup），③ 静态兜底黑名单（service 持久化 filter）。三层互补，不是单一机制。

## 7. 最值得本仓借鉴的设计（按价值排序）

1. **离线沙箱"按用户 SID 作用域的 WFP 块规则 + 回环代理白名单"**：本仓 `apps/cli/src/sandbox/egress/` 已有 DNS 裁决/代理中继，但缺"离线模式一键默认拒绝+只留代理窄缝"。这是可直接复现的范式。
2. **离线/在线双沙箱用户 + DPAPI 加密凭据**：权限面按模式分离，凭据不明文落盘。本仓 sandbox 用户模型可借鉴"两态分离"。
3. **WFP 规则按用户 SID 限定作用域**：不污染系统其它用户，这是"沙箱防火墙"和"系统防火墙"的关键区别。
4. **预配器与运行时分离**：setup 一次性建资源、service 运行时用、command-runner 执行——职责清晰。本仓 sandbox 初始化可参考这种分层。

## 8. 主要缺口（诚实边界）

- 未反编译：WFP 块规则的 `FWPM_LAYER_*`/conditions/weight 未取证（需 Ghidra，19MB PE 在 256MB 上限内可行但本轮未做）
- `--launch-payload` 的 payload 结构未完整枚举（推测 serde 结构，未抓真实调用）
- `online_username` vs `offline_username` 的具体权限差异未取证
- 红线遵守：未执行该二进制、未粘专有源码、仅记录符号/字符串/计数
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
