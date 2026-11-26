<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

ACP 方法表与错误码的真相源已从 `@ihui/agent-sdk` 移到纯常量包 `@ihui/types`。agent-sdk 只转发；`@ihui/api-client` 提供三端出口；web / RN / 小程序各自 `agent-protocol.ts` 从 api-client 取同一份常量。真实业务请求（`chat.createConversation`、`chat.sendMessage`、`agent-chat-stream`、`agent-runtime` 两条流）都携带 `x-ihui-acp-method`。

## 落点

- `packages/types/src/agent-protocol.ts`：`ACP_METHODS`、请求/通知分族、`AGENT_SDK_ERROR_CODES`、`AGENT_PROTOCOL_METHOD_HEADER`、`acpMethodHeaders`。
- `packages/agent-sdk/src/contract.ts`：删除本地字面量，改为从 `@ihui/types` 转发；`contract.test.ts` 断言 SDK 与 types 是同一对象。
- `packages/api-client/src/agent-protocol.ts`：三端统一出口；`index.ts` 导出。
- `packages/api-client/src/endpoints/chat.ts`：`createConversation` 带 `session/new`，`sendMessage` 带 `session/prompt`。
- `packages/api-client/src/endpoints/agent-chat-stream.ts`：SSE 请求带 `session/prompt`。
- `packages/api-client/src/endpoints/agent-runtime.ts`：两条执行流都带 `session/prompt`。
- `apps/web|mobile-rn|miniapp-taro/src/lib/agent-protocol.ts`：三端出口，零字面量。

## 读数

```text
acp-three-end-contract {"files":9,"missing":0,"problems":0,"ends":3}
[L14 协议单一真相源] state=ok 命中=8 sdk=4 测试=4 存量债=0 越界=0
agent-sdk contract.test.ts   6 passed
api-client agent-protocol.test.ts  3 passed
```

## 边界

三端共享的是协议身份与契约（方法名、错误码、请求头），不是把三端改成 ACP stdio NDJSON 客户端。ACP 的 NDJSON 服务端仍在 CLI；HTTP 业务线与 ACP 线通过同一方法表对齐，任何新增方法必须先改 `@ihui/types/src/agent-protocol.ts`。

## 复跑

```powershell
node scripts/check-acp-three-end-contract.mjs
node scripts/check-acp-method-single-source.mjs
pnpm --filter @ihui/agent-sdk exec vitest run tests/contract.test.ts
pnpm --filter @ihui/api-client exec vitest run src/agent-protocol.test.ts
pnpm --filter @ihui/agent-sdk typecheck
```
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
