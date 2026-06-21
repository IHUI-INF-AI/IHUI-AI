# 开放平台 API 与前后端对接说明

> 对应 BACKLOG 二、2.1.2（API 文档与示例）与三个月计划 2.4（文档与对接）。本文档描述**前端如何配置与调用后端**，以及与对外开发者文档的关系；实际 API 路径、错误码与限流以 ihui API / ZHS Java 后端为准，后端需在本文档或 `public/docs/developer` 中补充一致说明。

---

## 1. 文档关系

| 文档 | 说明 |
|------|------|
| 本文档 | 前端调用后端的配置、路径约定与职责划分；与后端联调时在此或 `public/docs/developer` 对齐。 |
| [OPEN_PLATFORM_README.md](./OPEN_PLATFORM_README.md) | 开放平台售卖、定价、许可与开源协议。 |
| [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | 开发环境、命令、E2E、部署流程。 |
| `public/docs/developer/` | **对外**开发者文档（API 概览、认证、SDK、集成），供接入方查阅；内容需与 ihui API 实际路径一致，可由后端/运营维护。 |

---

## 2. 前端环境变量（与后端地址）

前端通过环境变量区分开发/生产与不同后端基地址，见 `.env.example`。部署时由 CI/运维注入，**不要提交含敏感信息的 `.env.production`**。

| 变量 | 用途 | 说明 |
|------|------|------|
| `VITE_API_BASE_URL` | 通用 API 基路径 | 如 `/api`，与 Vite 代理或生产网关一致 |
| `VITE_JAVA_API_BASE_URL` | ZHS Java 后端 | 生产示例：`https://bsm.aizhs.top/prod-api` |
| `VITE_PYTHON_API_BASE_URL` | Python 后端（若使用） | 可选 |
| `VITE_LLM_CHAT_URL` | 对话/LLM 接口 | 如 `https://your-backend.com/ihui-ai-api/llm/chat` |
| `VITE_EDU_API_BASE` / `VITE_EDU_SSO_BASE` | 教育系统 API/SSO | 可选 |
| `VITE_N8N_API_URL` / `VITE_DIFY_BASE_URL` 等 | 第三方 AI 平台 | 可选，见 `src/api/agents.ts` |

开发环境下，请求常通过 Vite 的 `server.proxy` 转发到上述生产地址，避免跨域；生产环境使用实际域名。

---

## 3. 前端 API 配置与路径（代码内）

### 3.1 配置文件位置

- **`src/config/api-config.ts`**：API 基础 URL（`API_BASE_URLS`）、端点常量（`API_ENDPOINTS`）、白名单（`API_WHITE_LIST`）、错误码（`ERROR_CODES`）、超时与 `getBaseUrl(base, isDevelopment)`。
- **`src/config/backend-paths.ts`**：后端路径常量，与 Java 8080 / Python 8000 约定一致；所有路径、参数、字段名**禁止前端自创**，需与后端对齐。

### 3.2 基础 URL 与 base 编号

当前前端用 `getBaseUrl(base, isDevelopment)` 按 `base` 选择基地址：

| base | 开发环境 | 生产环境（示例） |
|------|----------|------------------|
| 1 | `API_BASE_URLS.BASE_URL_1` | 如 `https://kou.aizhs.top` |
| 2 | `/prod-api/ai`（代理） | 如 `https://bsm.aizhs.top/prod-api/ai` |
| 3 | `COZE_PREFIX`（如 `/cozeZhsApi`） | 如 `https://zca.aizhs.top`（ihui API） |
| 4 | `/prod-api`（代理） | 如 `https://bsm.aizhs.top/prod-api` |
| 5 | 同 1 | 同 1 |

开发时请求经 Vite 代理到上述生产域名；生产环境直接使用 `API_BASE_URLS` 或环境变量（若后续改为从 env 读取）。

### 3.3 登录与认证路径

- **`backend-paths.ts`**：`AUTH_PATHS`、`LOGIN_PWD_PATHS`（如 `/api/auth/login`、`/api/login/pwd/login`、`/api/login/pwd/refreshToken`）。
- Token 存储与过期：见 `docs/SECURITY_CHECKLIST.md` §5（登录/会话与路由守卫）。

### 3.4 开放平台/开发者相关路径

- **`DEVELOPER_PATHS`**（`backend-paths.ts`）：`/api/developer` 下 API 密钥、会话、工作流、MCP、模型等，与 Java 8080 约定一致。
- 管理后台：`/admin/*` 对应 ZHS Java 或 ihui 管理端，见 `src/api/admin-*.ts`。

---

## 4. 与后端职责划分（需与后端对齐）

| 职责 | 前端 | 后端 / ihui API |
|------|------|------------------|
| 页面与路由 | Vue 路由、开放平台页、文档中心 | - |
| 鉴权 | 携带 Token、刷新 Token、路由守卫 | 签发/校验 Token、提供 refresh 接口 |
| 业务接口 | 调用 `backend-paths` / `api-config` 中的路径 | 实现对应路径、返回约定格式 |
| API 文档与示例 | 维护 `public/docs/developer` 结构；示例请求/响应可与后端对齐 | 提供实际路径、错误码、限流说明 |
| BASE_URL / 环境 | 使用 env 与代理配置 | 提供生产域名与网关规则 |

**建议**：后端提供一份「开放 API 清单」（路径、方法、鉴权、错误码、限流），前端将 `backend-paths.ts` 与 `public/docs/developer/api/*.md` 与之对齐，并在本文档 §6 或 §7 中贴链接或摘要。

---

## 5. 认证、错误码与限流（占位，由后端补充）

- **认证**：当前前端在请求头携带 `Authorization: Bearer <token>`；Token 来源与刷新见 SECURITY_CHECKLIST §5。对外文档见 `public/docs/developer/getting-started/authentication.md`。
- **错误码**：前端 `api-config.ts` 中 `ERROR_CODES.TOKEN_EXPIRED`、`isTokenExpiredError` 用于跳转登录；统一业务错误码与文案**由后端定义**，建议在本文档或 `public/docs/developer/api/error-handling.md` 中列出。
- **限流**：策略与响应格式由后端定义，前端仅需展示后端返回的提示或状态码（如 429）。

---

## 6. 对外开发者文档（public/docs/developer）

- **API 概览**：`public/docs/developer/api/overview.md` 当前为示例地址（如 `https://api.example.com/v1`），**需替换为 ihui API 实际基地址与版本**，并与 `backend-paths` 中对外暴露的路径一致。
- **认证、SDK、集成**：`getting-started/authentication.md`、`sdk/*.md`、`integration/*.md` 中的示例 URL 与参数需与后端一致。
- 后端/运营可在此目录直接修改 Markdown，或提供 OpenAPI 规范由前端转换生成文档。

---

## 7. 本仓库 Python 后端（端口 8000）

与前端同仓库的 **backend/** 为 FastAPI 服务（PDF 处理、客服、工单、认证等），开发时由 Vite 代理到 `http://127.0.0.1:8000`。

| 前端代理前缀 | 后端路径 | 说明 |
|--------------|----------|------|
| `/api/pdf` | `/api/pdf` | PDF 签名/水印/合并拆分，需 API Key |
| `/api/customer-service` | `/api/customer-service` | 客服消息、常见问题、工单（与 `/api/customer-service/tickets` 一致） |
| `/api/zhs_api_ticket` | `/api/zhs_api_ticket` | 工单（与 `tickets.ts` 一致） |

- **API 清单**：见 **backend/docs/API_OVERVIEW.md**（路由表、认证/refresh、工单双路径说明）。
- **认证与 Token 刷新**：本后端提供 `POST /api/auth/login`、`POST /api/auth/refresh`（Body: `refresh_token`），返回 `{ access_token, refresh_token, expires_in }`。若主站使用 Java 8080 登录，可仅用本服务做 PDF/客服/工单；若需与本后端登录打通，可在 axios 拦截器中用 refresh 换新 token（见 SECURITY_CHECKLIST §5.2）。
- **工单双路径**：后端已同时挂载 `/api/zhs_api_ticket` 与 `/api/customer-service/tickets`，前端 `CUSTOMER_SERVICE_PATHS.tickets` 与 `tickets.ts` 均可使用。

## 8. 后续与后端联调检查项

**前端已就绪**：`backend-paths.ts`、§9 Token 刷新与 API 调用示例、本仓库 Python 8000 的 API_OVERVIEW 与工单双路径已就绪；环境变量由 CI/运维注入，错误码与开放 API 清单需后端提供后在前端对齐。

| 序号 | 检查项 | 负责方 | 状态 | 说明 |
|------|--------|--------|------|------|
| 8.1 | 确认生产环境 `VITE_*` 与后端网关、域名一致 | 运维/后端 | 待执行 | 部署时在 CI 或 `.env.production` 中配置；前端见 §2。 |
| 8.2 | 对齐 `backend-paths.ts` 与 Java 8080 / ihui API 实际路径；若有新接口，前端补充常量并更新本文档或 `public/docs/developer` | 前端+后端 | 前端已就绪 | 前端已维护路径常量；后端提供新接口后前端补充并更新文档。 |
| 8.3 | 统一错误码与前端提示文案（含 Token 过期、限流） | 后端+前端 | 待执行 | 后端提供错误码表后，前端在 §5 或 `public/docs/developer/api/error-handling.md` 补充，并在 `api-config.ts` 中复用。 |
| 8.4 | 若启用 refresh token，在 axios 拦截器或 request 封装中统一处理 | 前端 | 已就绪 | 见 §9.1 与 SECURITY_CHECKLIST §5.2；后端提供 refresh 接口后按示例接入即可。 |
| 8.5 | 将「开放 API 清单」或 OpenAPI 链接写入本文档 §4 或 §6 | 后端+前端 | 待执行 | 后端提供清单或 OpenAPI URL 后，前端在此文档或 `public/docs/developer` 中贴链接。 |
| 8.6 | 生产部署 Python 8000 时，配置基地址（或网关）并与前端代理/环境变量一致 | 运维/后端 | 待执行 | API 清单以 **backend/docs/API_OVERVIEW.md** 为准。 |

---

## 9. 对接示例（前端可独立实现部分）

以下示例供联调时参考；实际路径与响应格式以后端为准。

### 9.1 Token 刷新示例（axios 拦截器）

当后端提供 `POST /api/login/pwd/refreshToken`（或本仓库 Python 的 `POST /api/auth/refresh`）时，可在响应拦截器中统一处理 401 并尝试刷新：

```typescript
// 示例：在 axios 响应拦截器中
axios.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config
    if (err.response?.status === 401 && !config._retry) {
      config._retry = true
      const refreshToken = getStoredRefreshToken() // 从 localStorage/sessionStorage 读取
      if (!refreshToken) {
        redirectToLogin()
        return Promise.reject(err)
      }
      try {
        const base = getBaseUrl(4, import.meta.env.DEV) // 与 LOGIN_PWD 对应
        const { data } = await axios.post(base + LOGIN_PWD_PATHS.refreshToken, {
          refreshToken,
        })
        setStoredAccessToken(data.access_token)
        setStoredRefreshToken(data.refresh_token)
        config.headers.Authorization = `Bearer ${data.access_token}`
        return axios(config)
      } catch (e) {
        clearStoredTokens()
        redirectToLogin()
        return Promise.reject(e)
      }
    }
    return Promise.reject(err)
  }
)
```

请求拦截器为需鉴权接口统一加头：`config.headers.Authorization = 'Bearer ' + getStoredAccessToken()`。存储与路由守卫见 `docs/SECURITY_CHECKLIST.md` §5。

### 9.2 开放平台 API 调用示例（与 backend-paths 一致）

```typescript
import { getBaseUrl } from '@/config/api-config'
import { DEVELOPER_PATHS } from '@/config/backend-paths'

// 示例：获取 MCP 服务器列表（需鉴权）
const base = getBaseUrl(4, import.meta.env.DEV)
const res = await axios.get(base + DEVELOPER_PATHS.mcp.servers, {
  headers: { Authorization: `Bearer ${accessToken}` },
})

// 示例：创建工单（本仓库 Python 8000，走 /api/customer-service/tickets）
const ticketRes = await axios.post(
  '/api/customer-service/tickets',  // 开发时由 Vite 代理到 8000
  { title: '标题', content: '内容', category: 'technical', priority: 'medium' },
  { headers: { Authorization: `Bearer ${accessToken}` } }
)
```

所有路径应使用 `backend-paths.ts` 中的常量，禁止手写路径字符串；base 与开发/生产环境由 `getBaseUrl(base, isDevelopment)` 统一处理。
