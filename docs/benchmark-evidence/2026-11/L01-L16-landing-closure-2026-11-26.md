<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# L01–L16 对标落地收口账本（2026-11-26）

本账本只记「已落地 + 可复现判据」，不把计划当完成。本批覆盖 L01–L16 **全 16 项**；`PROJECT_PLAN.md` 只有 13 行 RP 记录（L07/L11/L12 无对应 RP 行），缺的三项已在本账本补齐落点与读数。

## 一、逐项落点与读数

| 项 | 落点 | 判据 / 读数 | 档位 | 状态 |
|---|---|---|---|---|
| L01 统一权限决策对象 | `apps/api/src/services/permission-entries.ts`、`permission-decision.ts`，terminal/mcp/crew 三入口接线 | 16/16 测试；`RuleMatch.toolExact` 新字段；无 `evidenceRef` 拒绝并留审计 | B | 完成 |
| L02 Job Object 执行器 | `apps/desktop/src-tauri/src/terminal_session.rs` + `terminal_session_job_scenarios.rs` | 真机 3 用例（正常退出 / 超时 / CTRL+C），Job 内进程数归零 | A | 完成 |
| L03 审批反向通道 | `packages/agent-sdk/src/approval-channel.ts` | 审批/备份/恢复三队列，seq 全局单调，断线不丢；7 断言 | A | 完成 |
| L04 命令暴露面文档 | 17 个 Rust 文件 127 条 `#[tauri::command]`；`scripts/check-tauri-command-doc-owner.mjs` | `state=ok 文件=17 命令=127 缺文档=0 存量债=0 新增越界=0`；`cargo check --lib` 通过 | B | 完成 |
| L05 动态通道注册表 | `packages/agent-sdk/src/channel-registry.ts`、`apps/web/src/lib/desktop-commands.ts`、`apps/api/src/websocket/chat-server.ts` | SDK 13/13（含 L12 域隔离）；live-chat 16/16（未知 type 回 400 且留拒绝计数）；`check-desktop-invoke-registry` → `注册=20 调用点字面量=0 无对应命令=0 重名=0 桥清单=20 清单差异=0 预算=20/20` | B | 完成 |
| L06 运行时策略热更新 | `apps/api/src/config/runtime-policy.ts`，接线 `server.ts` 请求超时、`plugins/queue.ts` worker 并发、`index.ts` 探针节拍 | 5/5；热加载实测 1.085s（SLA 5s）；非法字段整份拒绝，审计 jsonl 带 by/why | B | 完成 |
| L07 桥版本握手 | `apps/desktop/src-tauri/src/native_bridge.rs`、`apps/web/src/lib/native-bridge-handshake.ts`、`native-bridge-state.ts`、`components/native-bridge-banner.tsx` | web 7/7；Rust 2/2；注册表与壳侧清单均为 20、差异 0；协议/清单/摘要任一不符 → 首屏红条明示 + `invokeIpc` 全局拒绝 | B | 完成 |
| L08 MCP Host 回环服务 | `apps/api/src/services/mcp-loopback-host.ts`、`mcp-loopback-bootstrap.ts`，`index.ts` 启停相位 | 5/5 + 3/3；真起 HTTP；未注册 404、token 缺失/错误 403、注销 abort 在飞请求并计数；默认关，开启后只绑 `127.0.0.1` | B | 完成 |
| L09 凭据保险箱 | `packages/auth/src/credentials/` + `apps/ai-service/app/services/mcp_oauth_dpapi.py`，消费点 `mcp_oauth.py` 的检查点读写 | 包 6/6；MCP OAuth 5/5；Windows 默认 DPAPI 落盘（`IHUI-DPAPI-V1:` 信封），明文 token 不入盘；封装失败拒绝写、不回落明文；上一份好检查点不被坏写覆盖；`clear_memory_copy()` 清内存副本 | A | 完成 |
| L10 遥测本地默认 | `apps/api/src/services/telemetry-policy.ts`，接线 `plugins/otel.ts` | 11/11；默认 off/local，远端需 `IHUI_TELEMETRY_REMOTE`；13 键白名单 + 6 类凭据正则抹除 + 128 字符截断 | A | 完成 |
| L11 更新链路 | `apps/desktop/src-tauri/src/update_v2.rs`：签名校验既有（失败即拒）、本地代理候选 + 官方源回退告警、stable/beta/canary 通道 | `cargo test --lib update_v2::tests` 15 passed（含新增 5 条：通道归一/URL 拼接/代理候选/空代理/坏签名拒绝）；`fetch_feed` 逐候选尝试，失败回退 `eprintln` 告警 | B | 完成 |
| L12 通道域隔离 | `packages/agent-sdk/src/channel-registry.ts`：`agent/ui/remote-session` 三域、跨域同名拒、每域版本 + ACL + 健康检查、审计按域分表 | SDK 13/13（新增 5 条域用例：跨域同名拒、独立版本/健康、ACL deny/allow、默认 agent 兼容）；`auditByDomain` / `rejectedCount` 可分别落表 | B | 完成 |
| L13 安全窗口工厂 | `apps/desktop/src-tauri/Cargo.toml`、`desktop-build.mjs`、`scripts/check-window-security.mjs` | `红=0 过=7 警=1`；生产默认无 devtools，显式 opt-in 才能开 | B | 完成 |
| L14 三端共用协议层 | `packages/agent-sdk/src/protocol.ts`、`contract.ts`，CLI/ACP 4 处收口，`scripts/check-acp-method-single-source.mjs` | `state=ok 命中=9 sdk=5 测试=4 存量债=0 越界=0`；CLI typecheck 0 | B | 完成 |
| L15 监听面基线 | `apps/api/src/config/listen-surface-policy.ts`，`index.ts` 启动前断言 | 6/6；回环放行；非回环必须显式开关 + TLS/域套接字，且不得开明文 Basic；production fail-closed | B | 完成 |
| L16 QA 三档口径 | `docs/benchmark-evidence/QA-standards-and-evidence-tiers.md`、`wave2-ihui-landing-v2-2026-11-26.md` | 三档口径固化；202/401/refusal 不得写成模型闭环 | C | 完成 |

## 二、L09 消费侧补记（原缺口已闭合）

- 真实消费点是 `apps/ai-service` 的 MCP OAuth：`mcp_oauth.py` 用 `persist_path` 存检查点，原实现只有「Fernet（需手配环境变量）或明文 JSON」两档。
- 本次接入：Windows 默认走 DPAPI（`mcp_oauth_dpapi.py`，ctypes 直连 crypt32，零新增依赖）；写入失败**拒绝落盘**，绝不退回明文；读取时 DPAPI 信封在换用户/换平台解不开会报 `OAuthPersistUnread`，不把「读不到」当成「没有令牌」再覆盖；内容损坏仍按原逻辑备份 `.corrupt-<ms>` 留证。
- 兼容：旧明文 JSON 与 Fernet 文件仍可读，下一次成功写入自动升级为 DPAPI 信封；非 Windows 且无 Fernet key 时保留历史明文路径（平台无 DPAPI，属已知边界）。
- 退出清内存：新增 `clear_memory_copy()`，`clear_auth()` 复用它；`close()` 仍只释放 httpx（既有 31 条 OAuth 测试的语义不变）。
- 复跑：`tests/test_mcp_oauth.py` + `test_mcp_oauth_callback_guard_b75.py` + `test_mcp_oauth_persist_dpapi.py` 共 31 passed（含真 DPAPI 加解密与「封装失败不覆盖旧检查点」）。

## 三、边界说明（避免把等价替代读成原条款）

- L04 原条款写「Electron preload 键数 ≤20」，本仓桌面是 Tauri、无 Electron preload；已用「桌面命令暴露面」等价落地：20 条注册命令（含握手命令）+ 127 条 Rust 命令用途注释 + 双向校验脚本。
- L08 原条款要求 Host 的 per-route token 与生命周期；已落地并在 `/mcp/ping` 自检路由上跑通。`mcp-extended.ts` 的 10 条 Fastify 业务路由仍在 Fastify 面（依赖 request/reply 与 DB），搬进裸 HTTP 需先做适配层，不在本项验收内。
- `PROJECT_PLAN.md` 的 13 行 RP 已于本批勾选收口；L07/L11/L12 在该文件没有 RP 行，落点与读数以本账本为准。提交计划时工作树另有 PIP R8 三行未提交状态，随该文件一并入账（是他人已完成的记录，未改写其内容）。

## 四、复跑命令

```powershell
node scripts/check-acp-method-single-source.mjs
node scripts/check-tauri-command-doc-owner.mjs
node scripts/check-desktop-invoke-registry.mjs
node scripts/check-window-security.mjs
pnpm -C apps/api exec vitest run src/config/__tests__/listen-surface-policy.test.ts src/services/__tests__/telemetry-policy.test.ts src/config/__tests__/runtime-policy.test.ts src/services/__tests__/mcp-loopback-host.test.ts src/services/__tests__/mcp-loopback-bootstrap.test.ts
pnpm -C apps/api exec vitest run tests/ws/live-chat.test.ts
pnpm -C packages/agent-sdk exec vitest run tests/channel-registry.test.ts
pnpm -C apps/web exec vitest run src/lib/__tests__/native-bridge-handshake.test.ts
cd apps/ai-service; .\.venv\Scripts\python.exe -m pytest tests/test_mcp_oauth.py tests/test_mcp_oauth_callback_guard_b75.py tests/test_mcp_oauth_persist_dpapi.py -q
cd apps/desktop/src-tauri; cargo test --lib native_bridge; cargo test --lib update_v2::tests::
git fetch origin main --quiet; git rev-list --left-right --count origin/main...main
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
