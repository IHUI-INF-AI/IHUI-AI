<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# L16 公开尺子对照（2026-11-26）

本文件把 L01–L16 的本地证据对照到三套**公开**框架。它是 self-assessment crosswalk，不是认证结论，也不替代第三方审计。

## 对照表

| 本地控制 | 公开尺子 | 对照点 | 本仓证据 |
|---|---|---|---|
| L01 统一权限决策对象 | OWASP Top 10 for LLM（LLM06 Excessive Agency）; NIST AI RMF `MANAGE` | 工具/终端/MCP 入口共用同一决策对象，拒绝也必须留审计 | `permission-entries.ts`、16/16 测试 |
| L02 桌面命令暴露面 | OWASP ASVS（输入/配置面） | 注册命令、调用点、桥清单三方一致，预算 20 | `check-desktop-invoke-registry.mjs` |
| L03 审批反向通道 | OWASP LLM06; NIST AI RMF `GOVERN` | 审批/备份/恢复三队列断线不丢，重连按序补发 | `approval-channel.ts` 包测试 |
| L04 桌面命令等价面 | OWASP ASVS（攻击面最小化） | Tauri 无 Electron preload，按命令暴露面等价收口 | 20 命令 + 127 条用途注释 + 双向校验 |
| L05 通道域隔离 | NIST AI RMF `GOVERN` | agent/ui/remote-session 三域，跨域同名拒，按域审计 | `channel-registry.ts` 13/13 |
| L06 事件循环探针 | NIST AI RMF `MEASURE` | p95 超阈值告警，运行态可观测 | `runtime-policy` 测试 |
| L07 资源上限 | OWASP LLM10 Unbounded Consumption | 队列/并发/预算有界，拒绝有读数 | 计划 RP 行与账本 |
| L08 MCP Host 回环 | OWASP LLM06; ASVS 通信面 | 15 条业务路由全部进 Host，per-route token、注销 abort | `check-mcp-loopback-routes` 15=15 |
| L09 凭据保险箱 | OWASP LLM02 Sensitive Information Disclosure; ASVS 密码学面 | Windows DPAPI 信封，失败拒写、不回落明文 | 31 passed（含真 DPAPI） |
| L10 遥测本地默认 | NIST AI RMF `MEASURE`; OWASP LLM02 | 默认 off/local，远端显式开，13 键白名单 + 6 类凭据抹除 | `telemetry-policy` 11/11 |
| L11 更新链路 | OWASP LLM03 Supply Chain | 签名校验失败即拒，代理候选 + 官方源回退告警，三通道 | `update_v2` 15 passed |
| L12 通道域隔离 | NIST AI RMF `GOVERN` | 三域版本/ACL/健康独立，审计按域分表 | SDK 13/13 |
| L13 安全窗口工厂 | OWASP ASVS（配置/前端面） | 生产默认无 devtools，显式 opt-in 才能开 | `check-window-security` 红=0 |
| L14 三端协议契约 | NIST AI RMF `MAP`; OWASP ASVS（接口/输入契约） | 方法表/错误码单源，三端业务请求带 ACP 方法身份 | `check-acp-three-end` ends=3、problems=0 |
| L15 监听面基线 | OWASP ASVS 通信面; NIST AI RMF `MANAGE` | 回环放行；非回环必须显式开关 + TLS/域套接字；生产 fail-closed | 6/6 |
| L16 QA 三档 | NIST AI RMF `MEASURE`/`MANAGE` | 202/401/refusal 不得写成模型闭环；公开可复跑 benchmark | `benchmarks/ihui-agent-safety` 6/6 |

## 怎么复核

1. 克隆仓库，跑 `node benchmarks/ihui-agent-safety/run.mjs`。
2. 对照 `docs/benchmark-evidence/2026-11/l16-benchmark-run-2026-11-26.json` 的 `checks[]`，每项有 `exitCode/stdout`。
3. 需要真机项时，按 `docs/benchmark-evidence/2026-11/r8-real-window-selftest-2026-11-26.md` 的复现命令跑 `r8_selftest.rs`。

## 边界

- 本对照不声称“符合 ASVS 某一级”或“通过 NIST 认证”；它只说明每条本地控制对应哪类公开风险，以及证据在哪里。
- 第三方审计/渗透测试仍未做；这是 L16 从 C 档升到 B 档后剩下的边界，不用自评冒充外部结论。
- 公开框架会更新，本表按 2026-11 版本口径维护。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
