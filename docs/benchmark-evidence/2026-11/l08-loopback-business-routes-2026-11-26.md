<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# L08 MCP 回环 Host 业务路由收口（2026-11-26）

## 结论

`routes/mcp-extended.ts` 的 **15 条**业务路由已全部注册进 `McpLoopbackHost`。Host 自己拥有路径表、per-route token、参数路径匹配与注销生命周期；业务实现仍只有 `mcp-extended.ts` 一份，handler 通过 Fastify `server.inject` 回注，鉴权、属主过滤与 DB 不复制。

## 落点

- `apps/api/src/services/mcp-loopback-host.ts`：`register()` 支持 `:param` 路径，`McpRouteContext.params` 暴露捕获值；精确路径优先，参数路径次之。
- `apps/api/src/services/mcp-business-routes.ts`：15 条路由传输面清单；请求体 1 MiB 上限；`x-ihui-route-token` 不向下游泄漏；方法不允许 405，未知路径 404。
- `apps/api/src/services/mcp-loopback-bootstrap.ts`：可选注入 `McpBusinessInject`；开启 `IHUI_MCP_LOOPBACK=1` 时注册 ping + 15 条业务路由。
- `apps/api/src/index.ts`：把 `server.inject` 作为适配器传入，路径加 `/api` 前缀，query/body/authorization/cookie 原样透传。
- `scripts/check-mcp-loopback-route-parity.mjs`：正反两向比对 Fastify 源文件与适配器路由表。

## 读数

```text
mcp-loopback-route-parity {"fastifyRoutes":15,"adapterRoutes":15,"missing":[],"extra":[],"duplicate":0}
```

```text
src/services/__tests__/mcp-loopback-host.test.ts       5 passed
src/services/__tests__/mcp-loopback-bootstrap.test.ts  3 passed
src/services/__tests__/mcp-business-routes.test.ts     4 passed
```

## 复跑

```powershell
node scripts/check-mcp-loopback-route-parity.mjs
pnpm --filter @ihui/api exec vitest run src/services/__tests__/mcp-loopback-host.test.ts src/services/__tests__/mcp-loopback-bootstrap.test.ts src/services/__tests__/mcp-business-routes.test.ts
pnpm --filter @ihui/api exec tsc --noEmit
```

## 边界

- Host 是传输面，不是第二套业务实现；`server.inject` 是同一 Fastify 实例内部注入，不新起端口、不绕过鉴权。
- 回环 Host 默认关闭；打开后仅绑 `127.0.0.1`，端口由内核分配。
- 本项证明 15 条路由的注册/转发/令牌/日志/注销语义；真实网关按 token 转发属于部署接线，不在本项伪造。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
