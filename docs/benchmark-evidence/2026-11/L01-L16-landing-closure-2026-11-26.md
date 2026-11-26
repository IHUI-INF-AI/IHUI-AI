# L01–L16 对标落地收口账本（2026-11-26）

本账本只记「已落地 + 可复现判据」，不把计划当完成。仓内可落点以 `PROJECT_PLAN.md` 的 RP 行为准：本批实际覆盖 13 行（L01/L02/L03/L04/L05/L06/L08/L09/L10/L13/L14/L15/L16），L07/L11/L12 未在本仓清单出现。

## 一、逐项落点与读数

| 项 | 落点 | 判据 / 读数 | 档位 | 状态 |
|---|---|---|---|---|
| L01 统一权限决策对象 | `apps/api/src/services/permission-entries.ts`、`permission-decision.ts`，terminal/mcp/crew 三入口接线 | 16/16 测试；`RuleMatch.toolExact` 新字段；无 `evidenceRef` 拒绝并留审计 | B | 完成 |
| L02 Job Object 执行器 | `apps/desktop/src-tauri/src/terminal_session.rs` + `terminal_session_job_scenarios.rs` | 真机 3 用例（正常退出 / 超时 / CTRL+C），Job 内进程数归零 | A | 完成 |
| L03 审批反向通道 | `packages/agent-sdk/src/approval-channel.ts` | 审批/备份/恢复三队列，seq 全局单调，断线不丢；7 断言 | A | 完成 |
| L04 命令暴露面文档 | 17 个 Rust 文件 127 条 `#[tauri::command]`；`scripts/check-tauri-command-doc-owner.mjs` | `state=ok 文件=17 命令=127 缺文档=0 存量债=0 新增越界=0`；`cargo check --lib` 通过 | B | 完成 |
| L05 动态通道注册表 | `packages/agent-sdk/src/channel-registry.ts`、`apps/web/src/lib/desktop-commands.ts`、`apps/api/src/websocket/chat-server.ts` | SDK 8/8；live-chat 16/16（未知 type 回 400 且留拒绝计数）；`check-desktop-invoke-registry` → `注册=19 调用点字面量=0 无对应命令=0 重名=0` | B | 完成 |
| L06 运行时策略热更新 | `apps/api/src/config/runtime-policy.ts`，接线 `server.ts` 请求超时、`plugins/queue.ts` worker 并发、`index.ts` 探针节拍 | 5/5；热加载实测 1.085s（SLA 5s）；非法字段整份拒绝，审计 jsonl 带 by/why | B | 完成 |
| L08 MCP Host 回环服务 | `apps/api/src/services/mcp-loopback-host.ts`、`mcp-loopback-bootstrap.ts`，`index.ts` 启停相位 | 5/5 + 3/3；真起 HTTP；未注册 404、token 缺失/错误 403、注销 abort 在飞请求并计数；默认关，开启后只绑 `127.0.0.1` | B | 完成 |
| L09 凭据保险箱 | `packages/auth/src/credentials/`（DPAPI、原子写、内存副本清理） | 6/6；明文零落盘；平台不支持/保护器失败一律拒绝 | B | **包级完成，消费侧未接**（见二） |
| L10 遥测本地默认 | `apps/api/src/services/telemetry-policy.ts`，接线 `plugins/otel.ts` | 11/11；默认 off/local，远端需 `IHUI_TELEMETRY_REMOTE`；13 键白名单 + 6 类凭据正则抹除 + 128 字符截断 | A | 完成 |
| L13 安全窗口工厂 | `apps/desktop/src-tauri/Cargo.toml`、`desktop-build.mjs`、`scripts/check-window-security.mjs` | `红=0 过=7 警=1`；生产默认无 devtools，显式 opt-in 才能开 | B | 完成 |
| L14 三端共用协议层 | `packages/agent-sdk/src/protocol.ts`、`contract.ts`，CLI/ACP 4 处收口，`scripts/check-acp-method-single-source.mjs` | `state=ok 命中=9 sdk=5 测试=4 存量债=0 越界=0`；CLI typecheck 0 | B | 完成 |
| L15 监听面基线 | `apps/api/src/config/listen-surface-policy.ts`，`index.ts` 启动前断言 | 6/6；回环放行；非回环必须显式开关 + TLS/域套接字，且不得开明文 Basic；production fail-closed | B | 完成 |
| L16 QA 三档口径 | `docs/benchmark-evidence/QA-standards-and-evidence-tiers.md`、`wave2-ihui-landing-v2-2026-11-26.md` | 三档口径固化；202/401/refusal 不得写成模型闭环 | C | 完成 |

## 二、唯一未闭环项：L09 消费侧

- 现状：保险箱包本身可用且有测试，但仓内没有「MCP OAuth 检查点」的真实消费点。
- 已核过的三个可能落点都不成立：CLI 自带更严格的 DPAPI/机器绑定口令信封（`main-credential-store.ts`），不能被弱化替代；桌面 Rust 侧无 MCP 客户端与 keyring 调用；API 侧 OAuth 走数据库，无本机 OAuth refresh 流。
- 结论：不把「包级完成」写成「RP-4 完成」。RP-4 仍应保持未勾，等真实 MCP OAuth 客户端落点出现再接；接入时应复用 `createCredentialStore()` 的 protect/unprotect，不另造第二套信封。

## 三、边界说明（避免把等价替代读成原条款）

- L04 原条款写「Electron preload 键数 ≤20」，本仓桌面是 Tauri、无 Electron preload；已用「桌面命令暴露面」等价落地：19 条注册命令 + 127 条 Rust 命令用途注释 + 双向校验脚本。
- L08 原条款要求 Host 的 per-route token 与生命周期；已落地并在 `/mcp/ping` 自检路由上跑通。`mcp-extended.ts` 的 10 条 Fastify 业务路由仍在 Fastify 面（依赖 request/reply 与 DB），搬进裸 HTTP 需先做适配层，不在本项验收内。
- `PROJECT_PLAN.md` 的 13 行勾选本批未动：工作树含其他席未提交的 PIP R8 三行，直接提交会把他人改动混入本席提交，故只在本账本留读数。

## 四、复跑命令

```powershell
node scripts/check-acp-method-single-source.mjs
node scripts/check-tauri-command-doc-owner.mjs
node scripts/check-desktop-invoke-registry.mjs
node scripts/check-window-security.mjs
pnpm -C apps/api exec vitest run src/config/__tests__/listen-surface-policy.test.ts src/services/__tests__/telemetry-policy.test.ts src/config/__tests__/runtime-policy.test.ts src/services/__tests__/mcp-loopback-host.test.ts src/services/__tests__/mcp-loopback-bootstrap.test.ts
pnpm -C apps/api exec vitest run tests/ws/live-chat.test.ts
pnpm -C packages/agent-sdk exec vitest run tests/channel-registry.test.ts
git fetch origin main --quiet; git rev-list --left-right --count origin/main...main
```
