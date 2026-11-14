# AI 接口桥接能力地图

> 作用域：`apps/cli`（CLI 侧）与 `apps/ai-service`（服务侧）三族接口桥接工具。
> 本文所有数字均来自生成器实测输出与生成物常量现读，非估算；实测命令见文末「复现方式」。

## 一、为什么需要三族桥

「把整个项目所有接口让 AI 无缝调用」不是一个桥能解决的：本仓的接口分布在**两个后端进程**里，且 CLI 与服务侧的运行形态不同。

- `apps/api`（Fastify）：业务后端，端口独立。
- `apps/ai-service`（FastAPI）：承载 AI 能力本身（知识库 / RAG / 编排 / agents / memory / computer-use / sandbox 等），与 `apps/api` 是**两个进程**。

一个运行在 CLI 进程里的 agent，要调 ai-service 的接口必须**跨进程走网络**；而 ai-service 自己的 agent loop 调自家接口可以**进程内直达**。运行形态不同，决定了桥的传输层不同——这是三族并存的根本原因，不是重复建设。

## 二、三族桥一览

| 族 | 覆盖后端 | 端点量 | 注册进程 | 传输层 | 工具形态 |
|----|---------|--------|---------|--------|---------|
| `api_*` | apps/api | 5542 operations | CLI 进程 | 跨进程 HTTP（fetchApi） | 目录层 + 调用层 |
| `ai_*` | ai-service | 682 operations | CLI 进程 | 跨进程 HTTP（fetchAiServiceJson） | 目录层 + 调用层 |
| `ais_*` | ai-service 自身 | 302 tools（受 AIS_TOOLS_MAX 上限） | ai-service 进程 | 进程内 ASGI 自调用 | 稳定入口 + 长尾侧表 |

三族的**目录层工具**（`api_list_endpoints` / `ai_list_endpoints` / `ais_endpoints_search`）互相点名对方的存在。这是刻意的：模型先遇到某一族时，若在其中搜不到某能力，会误判「项目没有这个接口」。互指文案把「该换哪族」写进 schema，避免这类静默失效。

## 三、ai-service 端点分布（实测）

生成器 `scripts/scan-ai-service-routes.mjs` 从 FastAPI 运行时 OpenAPI 抽取，实测覆盖：

- **621 paths / 682 operations**（dedupe 后），无重复 (method,path) 跳过。
- 按 method：GET 297 / POST 333 / DELETE 33 / PUT 7 / PATCH 12。
- **79 个能力域**，240 个带 `{path params}` 的端点。
- 端点最多的域：publish 58、ai 52、llm 48、mcp 40、orchestration 29、agents 22、agent-runtime 20。

### 为什么必须用运行时 OpenAPI，而非静态扫源码

ai-service 有 94 处 `include_router` 前缀**分散在 88 个文件**里。静态扫源码无法可靠推断每个 router 挂载后的最终前缀，会产出「看起来在册、调用必 404」的假端点。生成器因此用 ai-service 的 venv Python 运行时导出真实 spec（`interpreter used: apps/ai-service/.venv`），保证 682 条路径前缀全部正确。

真机验证是这一格的关键证据：CLI 侧 `ai_read` 连接运行中的 ai-service（8803），批量探测 120 个无参 GET，得 8×200 / 112×401 / **0 其他**。零 404 证明路径前缀全部正确；401 是端点自身鉴权的 fail-closed 正确行为。

## 四、CLI 侧 ai_* 五枚工具

| 工具 | 危险档 | 用途 |
|------|--------|------|
| `ai_list_endpoints` | read | 列端点，支持 domain 前缀过滤 + 关键词；空查询列 domain 清单 |
| `ai_describe_endpoint` | read | 查单端点契约；带 path params 时给出「同名字段随 path 一起传」的可照抄示例 |
| `ai_read` | read | 调 GET 端点 |
| `ai_write` | write | 调 POST/PUT/PATCH 端点 |
| `ai_delete` | dangerous | 调 DELETE 端点 |

工具名形态约束：`ai_(read|write|delete|list_endpoints|describe_endpoint)`。三档危险级别与 `api_*` 同形，鉴权由目标端点自身 RBAC 裁决，桥层不预判。

## 五、ais_* 与 ai_* 的分工（易混点）

两者都覆盖 ai-service，但**运行在不同进程，模型不会同时看到**，因此刻意不做互指：

- `ais_*`：注册在 ai-service 进程，供它自己的 agent loop 使用；进程内 ASGI 自调用，零网络。
- `ai_*`：注册在 CLI 进程，供 CLI agent 跨进程调用 ai-service。

给两者互相指路只会制造噪音——这一点写进了 `ai_service_bridge.py` 注释，免得后来者以为漏了一处。

## 六、插件贡献的接口型工具（第四条路）

除三族桥外，插件可通过清单 `interfaces[]` 以**纯数据**声明端点，由装载器编译成真 Tool（`plugin__<plugin>__<name>`）。四条纪律：

1. **不执行插件代码**：装载器只读 JSON。
2. **不引入第二套权限判据**：执行走 `createRouteTool → invokeApi → fetchApi`，与 `api_*` 同通道。
3. **清单不能降低危险档**：method 推导值与清单自述取更严一侧。
4. **模型不能填路由身份**：参数名撞 `ROUTING_IDENTITY_KEYS`（userId/sessionId…）即整条拒收。

插件的**本地工具**（kind: local）结论是不做：清单写命令撞可执行字段禁令、动态 import 撞 plugin-entry-channel-lock、自造 DSL 是自证安全。正确出路是 MCP（`loadMcpTools` 已存在且自带信任模型）。此结论写入 `interface-tools.ts` 头注并有形状锁钉住。

## 复现方式

```bash
# ai-service 端点实测（621/682/79/240 + method 分布）
node scripts/scan-ai-service-routes.mjs --check
# api_* 端点计数
grep API_ENDPOINT_LINE_COUNT apps/cli/src/tools/api-endpoints.generated.ts
# ai_* 端点计数
grep AI_ENDPOINT_LINE_COUNT apps/cli/src/tools/ai-endpoints.generated.ts
```
