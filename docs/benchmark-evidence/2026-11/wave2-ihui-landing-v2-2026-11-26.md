<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI-AI 落地清单 v2（可直接排期版）

来源：`docs/benchmark-evidence/2026-11/local-all-apps-exhaustive-2026-11-25.md` 与同目录分析账本。证据强度三档：产品级闭环（有模型输出原文且账本可复核）、产品级静态/实跑（源码、二进制、进程或受控实测）、框架运行态（进程/端口/日志/状态码可见）。

工作量口径：S ≤1.5 人日；M 2–4 人日；L ≥5 人日。前置状态分三档：已具备（仓内模块可直接扩展）、部分具备（有邻近模块，需补抽象）、未具备（需新建规范或模块）。

## 落地项明细

| 编号 | 能力点 | 证据强度 | 落点目录/模块 | 前置依赖是否已具备 | 验收方式（一句话可测） | 工作量 | 优先级 |
|---|---|---|---|---|---|---|---|
| L01 | 统一权限决策对象：`PermissionDecision {scope, kind, sessionId, expiresAt, evidenceRef}`，所有工具调用（内置/MCP/终端）过同一个 `decide()`，无 evidenceRef 直接拒绝 | 产品级静态：Codex `TaggedPermissionProfile`/`NetworkPermissions`、WorkBuddy permission+approval、Trae `SandboxConfigPermissionObjectWireRef` | `packages/agent-sdk/src/protocol.ts` 定义决策模型；`apps/api/src/services/permission-grants.ts`、`tool-approval-audit.ts` 收口；`apps/desktop` 只做 UI | 部分具备：agent-sdk 有 index/protocol/query 骨架；api 已有 permission-grants、tool-approval-audit、tool-invocation-ledger-service；缺统一 decide() 模型与 evidenceRef 强制 | 内置工具/MCP/终端三类调用全部经过同一 decide()，无 evidenceRef 的决策在测试中被拒绝并留审计记录 | M | P0 |
| L02 | Job Object 执行器：进程树回收 + 超时 + 退出清理，子进程退出后 Job 必须为空，CTRL+C/超时/崩溃三场景不留孤儿进程 | 产品级实跑：WorkBuddy `CreateJobObjectW/AssignProcessToJobObject/TerminateJobObject`；Codex ConPTY 缺 job 提示 | `apps/desktop/launcher/src`（Rust）新建 executor 抽象，或在 `apps/api/src/services/terminal-service.ts`、`remote-sandbox.ts` 旁落地 Windows Job Object 封装 | 部分具备：terminal/remote-sandbox 有进程管理雏形；Job Object 封装、进程树回收、三场景清理未建 | 子进程退出后 Job 句柄内进程数为 0；CTRL+C / 超时 / 崩溃三场景测试均无孤儿进程残留 | L | P0 |
| L03 | 审批反向通道：命名管道（ACL 限当前用户）+ 审批协议 + 三队列（审批/备份/恢复），请求可追溯到 session，断线不丢 | 产品级静态：WorkBuddy `approval.callbackAddress`/`approvedByUser`；Trae `PermissionDenied` | `packages/agent-sdk` 审批协议；`apps/desktop` 命名管道与 ACL；`apps/api/src/services/tool-approval-audit.ts` | 部分具备：审计服务已有；审批协议、管道 ACL、审批/备份/恢复三队列缺 | 审批请求可追溯到 session；通道断线后备份/恢复队列不丢请求，重连后按序补发 | M | P1 |
| L04 | preload 暴露面预算：只暴露一个命名空间对象，禁止裸 `ipcRenderer`，暴露键 ≤20，每键有 owner 与用途注释，CI 做预算检查 | 产品级对比：OpenCode 1 键 5 成员 vs WorkBuddy 83 键、MiniMax 373 成员 | `apps/desktop` preload 层；CI 静态扫描规则（`scripts/` 或 `.github/`） | 未具备：无暴露面规范与 owner/用途注释约定 | preload 只暴露一个命名空间对象、键数 ≤20、每键有 owner 与用途注释；CI 对超限构建报错 | S | P0 |
| L05 | 动态 IPC 注册表：call/listen/subscribe 命名通道 RPC 替代裸 `ipcMain`；通道名必须来自注册表，未注册通道运行期拒绝并打点 | 产品级归因数据：ZCode 227 调用点/180 通道 0 未定；Qoder 13 条动态归 6 通道；其余目标动态别名均已回填 | `packages/agent-sdk` RPC 层；`apps/api/src/websocket` 与审计日志 | 部分具备：审计 ledger 已有；注册表、命名通道与未注册拒绝打点缺 | 通道名必须来自注册表；运行期调用未注册通道被拒绝并打点，测试用例覆盖 | M | P1 |
| L06 | 本地运行时策略热更新：`runtime-policy.json`（probe/timeout/background_limit）+ 热加载 + 变更审计（who/when/why，非法字段整份拒绝） | 产品级静态：豆包 `local_runtime.runtime_policy`、Remote_State 下发配置 | `apps/api/src/config` 或 `apps/ai-service`；策略校验 schema | 部分具备：config/constants 已有；策略 schema、热加载、who/when/why 审计缺 | 策略变更 5 秒内生效；每次变更留 who/when/why；非法字段整份拒绝并拒绝热加载 | M | P1 |
| L07 | 桥版本握手：启动时交换 `nativeBridge.version` 与方法摘要，web bundle 只调注册表内存在的名字；mismatch 首屏禁用入口并 UI 明示 | 框架运行态：豆包 2 个 audio API 在 848 项注册表中不存在；Neotix 848 方法/LarkAPI 3 通道 | `packages/agent-sdk` 桥协议；`apps/desktop` 启动握手；CI registry 静态校验 | 未具备：版本摘要交换、mismatch 首屏禁用与静态校验缺 | 启动时交换 nativeBridge.version 与方法摘要；mismatch 禁用对应入口并 UI 明示；CI 对 bundle 调用做 registry 校验 | S | P2 |
| L08 | MCP Host 回环服务：随机端口、per-route token、生命周期注销；未注册路由 404，注销后在飞请求 abort 并计数，端口不落公网 | 产品级运行态：WorkBuddy `listen(0,'127.0.0.1')` + 路由注册/注销 | `apps/api/src/services/mcp-extended.ts`、`v1-mcp-gateway.ts`；token 生命周期管理 | 部分具备：MCP 网关邻近模块已有；随机端口、per-route token、注销生命周期缺 | 端口只绑 127.0.0.1；未注册路由 404；注销后在飞请求被 abort 并计数 | M | P1 |
| L09 | 凭据与 OAuth 检查点：OS keyring + DPAPI 封装，MCP OAuth 存 checkpoint 而非内存；明文凭据零落盘，refresh 失败可恢复，退出清内存副本 | 产品级反例+静态：OpenCode service.json 43 字符明文密码；ZCode `@napi-rs/keyring`；Cursor `cursorPasskey`；豆包 mcp_helper OAuth checkpoint | `packages/auth/src/providers`；`apps/api/src/services/oauth-providers.ts`、`token-refresh-service.ts`；keyring/DPAPI 适配层 | 部分具备：auth providers 与 token-refresh 已有；DPAPI/keyring 封装、OAuth checkpoint 落盘与内存清理缺 | 明文凭据零落盘；refresh 失败可从 checkpoint 恢复；退出即清内存副本，测试断言无残留 | M | P0 |
| L10 | 遥测与本地采集：默认本地 collector（OTLP），远端需显式开关；PII/凭据/命令行参数白名单过滤，敏感命令只打类型/规则命中，不写原文或参数片段；采样率可配 | 产品级静态：WorkBuddy OTLP 4318/Zipkin 9411；ZCode OTLP exporter；豆包 6 条 lark-cli 正则配置 | `monitoring/otel-collector`；`apps/api/src/services/telemetry.ts`、`log-sanitizer.ts` | 部分具备：OTLP collector 栈与 sanitizer 已有；PII/凭据/命令行参数白名单规则、本地默认开关与采样率缺 | 默认不外发；敏感命令只打类型/规则命中，不写原文或参数片段；采样率可配 | M | P1 |
| L11 | 更新链路：安装包签名校验失败即拒绝；可选本地代理，代理不可用回退官方源并告警；灰度通道 | 框架运行态：ZCode localhost:8081 本地代理；Cursor 官方下载源 | `apps/desktop` 更新器；`apps/api/src/services/update-check-service.ts` | 部分具备：版本检查服务已有；签名校验、本地代理回退官方源、灰度通道缺 | 安装包签名校验失败即拒绝；本地代理不可用时回退官方源并告警；灰度通道可配置 | S | P2 |
| L12 | 通道域隔离：agent / ui / remote-session 分域，每域独立 ACL、版本号与健康检查；跨域不复用通道名，审计日志按域分表 | 框架运行态：豆包 Agent Tool 管道、Neotix ShellAPI、PIP 三族管道用途分离 | `packages/agent-sdk` 域划分；管道/通道 ACL 策略；审计日志分表 | 未具备：agent/ui/remote-session 域划分、独立 ACL/版本/健康检查缺 | 跨域不复用通道名；每域独立 ACL、版本号与健康检查；审计日志按域分表 | M | P2 |
| L13 | 安全窗口工厂：统一 `createSecureWindow()`，生产强制 `contextIsolation:true/sandbox:true/webSecurity:true`；调试窗口独立构建开关，禁止进生产包 | 产品级反例实测：Qoder 全窗口三安全项开启；WorkBuddy 调试面板 `contextIsolation:false`/`webSecurity:false`；Trae/Cursor 窗口安全项缺口 | `apps/desktop/launcher/src`（Rust webview 封装）；构建期安全项断言 | 未具备：无统一安全窗口工厂；调试开关独立构建隔离缺 | 生产构建强制 contextIsolation/sandbox/webSecurity 开启；调试窗口选项不进生产包，构建断言可拦截 | S | P0 |
| L14 | 三端共用协议层：`agent-sdk` 作为唯一协议层，Web / RN / 小程序复用同一方法名与错误码，差异只在 UI 适配层 | 框架运行态：11 个产品均为多入口共享同一后端 | `packages/agent-sdk`；`apps/web`、`apps/mobile-rn`、`apps/miniapp-taro` 适配层 | 部分具备：agent-sdk 骨架已有；三端方法名/错误码对齐与适配接入缺 | 三端调用同一 agent-sdk 方法名与错误码；差异只在 UI 适配层，契约测试三端共用 | M | P1 |
| L15 | 监听面基线：默认绑 `127.0.0.1`；禁止“全网卡监听 + 文件内明文密码 + 明文 HTTP Basic”组合；凭据至少进 OS keychain/DPAPI，传输用本机 TLS 或域套接字 | 产品级实测：OpenCode dev-only isolated 绑 `0.0.0.0:3084` + service.json 明文密码 + Basic；第二台主机与防火墙未测 | 服务启动绑定规范；`packages/auth`；`apps/api/src/services/ip-reputation.ts`、`tenant-access.ts` 邻近网络策略评审 | 部分具备：信誉/租户模块邻近；默认回环绑定、禁明文 Basic 组合策略与评审清单缺 | 默认绑 127.0.0.1；“全网卡监听 + 文件内明文密码 + 明文 HTTP Basic”组合在策略评审中被禁止；凭据进 keychain/DPAPI | S | P0 |
| L16 | 取证与 QA 口径：结论按产品级 / 框架运行态 / 未知三档标注；phase 状态机快照与模型输出分离；202/401/refusal 不得写成模型闭环；每条结论挂可复核账本 | 方法论：本轮 47 处纠正与账本 JSON 复核流程 | `analysis/` 账本目录约定；QA 规范模板（`docs/benchmark-evidence/` 下） | 部分具备：analysis 账本与 report-qa JSON 先例已有；三档标注模板、phase 与模型输出分离规则、账本挂接约定需固化 | 每条结论按三档标注；phase 快照与模型输出分离；202/401/refusal 不写成闭环；结论挂可复核账本路径 | S | P1 |

## P0 依赖顺序

P0 共六项，分三条并行轨道；轨道内有先后，轨道间可并行启动。

P0-A 安全执行基线：L01 先于 L02。L01 的 `PermissionDecision` / `decide()` / `evidenceRef` 模型必须先在 agent-sdk 落地；L02 的 Job Object 执行器挂到同一 session/decision 上下文，子进程回收与超时清理引用决策上下文，不能另起一套会话标识。

P0-B 凭据与监听面：L09 与 L15 可与 P0-A 并行。L09 的 keyring/DPAPI 封装接口先出，是 L01 会话凭据存储与 L15“凭据不落盘”的前置；L15 的回环绑定基线与禁明文 Basic 策略与 L09 同批落地，避免先留下 OpenCode 式反模式再返工。

P0-C 桌面最小门：L04 先于 L13，紧随 P0-A。L04 的单命名空间暴露约定先定边界，L13 的安全窗口工厂再落地；这两项先于 P1 的 L05 IPC 注册表与 L12 通道域隔离，后续注册表往里填通道时不能突破已划定的暴露面与窗口安全项。

依赖链一句话：L09 封装接口先行（与 L01 并行启动）→ L01 decide() 模型 → L02 Job 执行器；L04 命名空间约定 → L13 窗口工厂 → P1 的 L05 / L12 填通道与分域。

## 排期备注

P0 批次合计：L01（M）+ L02（L）+ L04（S）+ L09（M）+ L13（S）+ L15（S），关键路径为 L09 → L01 → L02。P1 批次在 P0 边界规范（决策模型、暴露面、凭据封装）定稿后接入；P2 项可在主体链路稳定后排期。工作量估算不含 wave2 四条在跑线索（WorkBuddy 桥接补丁、三端工具层、Codex 替代路径、四端深挖）带来的复测与账本回写工时。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
