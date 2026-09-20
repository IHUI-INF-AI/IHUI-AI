<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# Agent 开放能力（能力目录 / Capability Catalog）

> 面向把 IHUI-AI 当作**能力后端**接入的第三方 AI Agent（OpenAI/Anthropic/Gemini SDK、MCP 客户端、自研 agent）。
> 单一事实源：`packages/types/src/capability-catalog.ts`；机器可读产物：`packages/types/generated/capabilities.json`（`pnpm capabilities:export` 生成，`pnpm capabilities:check` 防漂移）。

## 1. 设计原则：开放功能，不开放数据

每条能力都带一个 `dataClass`，它决定这次调用能触达什么：

| dataClass     | 含义                                                 | 数据可见范围                               |
| ------------- | ---------------------------------------------------- | ------------------------------------------ |
| `compute`     | 只消耗算力（模型推理、生成、检索临时输入）           | 禁止读取业务实体表，只写自有运行/用量记录 |
| `scoped-read` | 读能力自带的数据视图                                 | 强制按凭据归属人（owner）过滤              |
| `scoped-write`| 写自有资源（建助手、传文件、存记忆）                 | 强制 owner 过滤 + 幂等键登记               |
| `platform`    | 平台运营面（账号、计费变更、发布、本机控制）         | 机器凭据一律 403，永不开放                 |

授权判定发生在 `apps/api/src/utils/capability-guard.ts`，**默认拒绝**：scope 未登记、`dataClass=platform`、`thirdPartyEligible=false` 三种情况都会拿到 403，而不是"有 key 就行"。

## 2. 三条接入通道

### 2.1 REST（协议兼容面）

```
Authorization: Bearer ihui_xxxxxxxx        # 自助签发：POST /api/developer/api-keys
X-Api-Secret: sk_xxxxxxxx                  # 双因子（默认必带，可用 API_KEY_REQUIRE_SECRET=false 过渡）
```

- `/v1/*`：OpenAI 兼容（chat/completions、responses、embeddings、assistants/threads/runs、batch、files、images、audio、videos、moderations、realtime WS…）
- `/v1beta/*`：Gemini 兼容（generateContent / streamGenerateContent / ListModels）
- `/v1/messages*`：Anthropic 兼容
- `/v1/mcp/*`：MCP over REST（`GET /v1/mcp/tools`、`POST /v1/mcp/tools/call`、`POST /v1/mcp/resources/read`）

响应两套并存：`/api/*` 为 `{code,message,data}` 信封；`/v1`、`/v1beta` 为各上游协议原生 JSON，便于官方 SDK 直连。

### 2.2 MCP

```jsonc
// 标准 MCP 客户端配置（Claude Desktop / Cursor / Zed）
{
  "mcpServers": {
    "ihui": {
      "url": "https://<host>/ai-service/api/mcp/export/streamable",
      "headers": { "Authorization": "Bearer <IHUI_JWT>" }
    }
  }
}
```

- `POST /api/mcp`（单请求 JSON-RPC）与 export 层（SSE / streamable HTTP）均需凭据：**匿名 tools/call 已关闭**。
- 逐工具授权：工具名 → 所需 scope 由 `capabilities.json` 的 `toolScopeMap` 裁决；未登记的工具直接 `TOOL_NOT_REGISTERED` 拒绝。
- 外部 MCP 客户端走 API Key 时请连 `/v1/mcp/*`（apps/api 侧统一鉴权与计费），ai-service 不本地校验 API Key。
- export 传输层（SSE / streamable）带 Host 白名单防 DNS-rebinding：回环始终放行，非回环主机必须显式登记；
  代码默认值已含生产域 `aizhs.top / www.aizhs.top / mcp.aizhs.top`，其他部署用 `MCP_EXPORT_ALLOWED_HOSTS` 覆盖。Host 不合法返回 403。

### 2.3 CLI / ACP（本机或自托管环境）

`ihui --json agent "<task>"`（NDJSON）、`ihui acp`（Zed/VSCode 协议）、`ihui serve`（HTTP+WS :8841）。

## 3. 凭据收紧维度（按 key 逐条配置）

| 维度      | 字段                                             | 效果                                        |
| --------- | ------------------------------------------------ | ------------------------------------------- |
| 能力      | `permissions`（scope 数组）                      | 新建 key 默认仅 `models:read`，能力需显式授予 |
| 时段配额  | `rateLimit` / `rateLimit5h` / `rateLimit1d` / `rateLimit7d` | 超限 429 + `Retry-After`                |
| 模型白名单 | `allowedModels`（支持 `gpt-4*`）                 | 不在名单内 403                              |
| 网络      | `allowedIps` / `blockedIps`（IPv4 + IPv6 CIDR）  | 黑名单优先                                  |
| 成本      | `maxTokensPerReq` / `tokenBalance` / `costBalanceCents` | 预扣费，余额耗尽即拒                      |
| 生命周期  | `expiresAt` / `status`                           | 过期 401、吊销即时生效                      |

限流后端（Redis）不可用时：`billable` 或 `risk>=high` 的能力返回 503 `RATE_BACKEND_UNAVAILABLE`（fail-closed），纯只读低危仍放行。可用 `API_KEY_RATE_LIMIT_FAIL_MODE=open` 恢复历史宽松行为。

## 4. 明确不开放的能力（红线）

| scope               | 原因                                       |
| ------------------- | ------------------------------------------ |
| `computer:operate`  | 本机 GUI/键鼠/剪贴板控制（`dataClass=platform`） |
| `publish:operate`   | 向第三方社媒发布内容（对外可见、不可撤回） |
| `sandbox:run`       | 沙箱命令执行；开放前提为强制 docker `--network=none` 且由管理员显式签发 |
| `diff:apply`        | 把生成内容全量写盘                          |
| `im:send`           | 以调用者身份触达真人                        |
| `connectors:write` / `skills:write` | 注册外部 MCP server / 安装技能 = 注入可执行行为 |
| `oauth:manage`      | 应用注册与密钥轮转（改走自助 DCR 流程）     |

`'*'` 通配只在"已登记且 `isM2MAllowed=true`"的范围内生效，**不能**穿透上表。

## 5. 错误语义

| HTTP | errorCode                  | 含义                                        |
| ---- | -------------------------- | ------------------------------------------- |
| 401  | -                          | 缺凭据 / key 无效 / 过期 / 缺 `X-Api-Secret`（`SECRET_REQUIRED`） |
| 403  | `SCOPE_REQUIRED`           | key 未授予该 scope，`requiredScope` 指明需要哪个 |
| 403  | `M2M_FORBIDDEN`            | 该能力不对机器凭据开放（见第 4 节）         |
| 403  | `CAPABILITY_UNREGISTERED`  | 端点尚未登记能力（默认拒绝）                |
| 429  | -                          | RPM / TPM / 5h / 1d / 7d 任一窗口超限       |
| 503  | `RATE_BACKEND_UNAVAILABLE` | 限流后端不可用且策略为 fail-closed          |

## 6. 自检：我的 key 现在能调什么

```bash
# 1) 取能力清单（机器可读产物；发布后也可从 /docs/json 的 tag 切片交叉核对）
pnpm capabilities:export && cat packages/types/generated/capabilities.json | head -c 400

# 2) 用一个只有 models:read 的 key 试探需要 chat:write 的端点 → 期望 403 + requiredScope
curl -s -X POST https://<host>/v1/chat/completions \
  -H "Authorization: Bearer $IHUI_KEY" -H "X-Api-Secret: $IHUI_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'
```

服务端审计可按 `apiKeyId` 归因（调用日志 `llm_call_logs` + 操作审计），key 持有者可在开发者控制台「调用日志」自查。

## 7. 变更方式

1. 在 `capability-catalog.ts` 增/改条目（scope 必须先加进 `packages/types/src/api-key.ts` 的枚举）。
2. `pnpm capabilities:export` 重新生成产物并提交。
3. `pnpm capabilities:check` 与 `node scripts/check-capability-catalog.mjs` 必须在 CI 绿：端点未登记能力会被硬拦。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
