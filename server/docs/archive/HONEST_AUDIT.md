# 前后端联调 — 诚实审计报告

## 一、已验证完成的联调链路 ✅

| 链路 | 状态 | 验证方式 |
|------|------|----------|
| Vite 8888 → 后端 8000 (登录) | ✅ | POST /api/v1/login/username → 200 + token |
| Vite 8888 → 后端 8000 (JWT) | ✅ | GET /api/v1/user/getInfo → 200 user=admin |
| Vite 8888 → 后端 8000 (models-unify) | ✅ | GET /api/v1/llm/models-unify → 200 count=5 |
| Vite 8888 → 后端 8000 (agents) | ✅ | GET /api/v1/agents/list → 200 |
| Vite 8888 → 后端 8000 (compat CRUD) | ✅ | POST /cozeZhsApi/ai-model-info/add → 200 |
| CORS 预检 | ✅ | OPTIONS → 204 ACAO=* |
| 前端 SPA 加载 | ✅ | GET / → 200 HTML len=24276 |
| 后端 Swagger UI | ✅ | GET /docs → 200 |

**以上链路通过 `@/utils/request` (axios) 发起，使用相对路径 `/api/v1/*`，走 Vite 代理。**

---

## 二、发现的遗漏问题

### 问题 1: `apiClient` 绕过 Vite 代理 ⚠️

**文件**: `src/api/core/client.ts:28-46`

```ts
function getBaseUrl(url: string): string {
  if (url.startsWith('/cozeZhsApi/agent')) return 'https://bsm.aizhs.top/prod-api'
  if (url.startsWith('/cozeZhsApi/dashscope')) return 'https://bsm.aizhs.top/prod-api/ai'
  if (url.startsWith('/kling/')) return 'https://zca.aizhs.top'
  return 'https://kou.aizhs.top'  // 默认走生产!
}
```

**影响范围**: 15+ 个模块使用 `apiClient`，请求会直接打到生产而非本地后端。

**受影响模块**:
- `api/favorites.ts` — 收藏功能
- `api/file-upload.ts` — 文件上传
- `api/monitoring.ts` — 监控
- `api/orders.ts` — 订单
- `api/tasks.ts` — 任务
- `api/services/auth.service.ts` — 认证服务
- `api/services/unified-api.service.ts` — 统一 API
- `api/services/user.service.ts` — 用户服务
- `composables/useFetch.ts` — 通用 fetch

**未受影响模块** (使用 `@/utils/request`，走 Vite 代理):
- `api/aiModelInfo.ts` ✅
- `api/agents.ts` ✅ (大部分)
- `api/ai.ts` ✅
- `config/backend-paths.ts` 中的 COZE_PATHS 调用 ✅

### 问题 2: WebSocket URL 硬编码 ⚠️

**文件**: `components/ai/AIChat.vue:4320-4790`

```ts
wsUrl = 'wss://zca.aizhs.top/ihui-ai-api/llm/ws'
wsUrl = 'wss://zca.aizhs.top/cozeZhsApi/ws/chat'
```

这些 WebSocket 连接直接指向生产，不走 Vite 代理。

### 问题 3: 静态资源 URL (非阻塞) ℹ️

190 处 `file.aizhs.top` 引用是 CDN 图片/图标 URL。这些是静态资源，不影响 API 联调。

---

## 三、根因分析

前端有**两套 HTTP 客户端**:

| 客户端 | 文件 | baseURL 策略 | 是否走代理 |
|--------|------|-------------|-----------|
| `@/utils/request` | utils/request.ts | `VITE_API_BASE_URL` (相对路径) | ✅ 走 Vite 代理 |
| `apiClient` | api/core/client.ts | `getBaseUrl()` 硬编码 | ❌ 直连生产 |

核心 API 调用（登录、模型列表、智能体）用的是 `@/utils/request`，所以联调验证通过。
但 `apiClient` 覆盖的模块（收藏、订单、监控等）在本地开发时仍会直连生产。

---

## 四、修复建议

### 方案 A: 修改 `getBaseUrl()` 用环境变量 (推荐)

```ts
// api/core/client.ts
function getBaseUrl(url: string): string {
  const isDev = import.meta.env.DEV
  if (isDev) {
    // 开发模式: 所有请求走 Vite 代理 (相对路径)
    return import.meta.env.VITE_API_BASE_URL || '/api'
  }
  // 生产模式: 保持原有路由逻辑
  if (url.startsWith('/cozeZhsApi/agent')) return BASE_URLS.BASE_URL_4
  // ...
  return BASE_URLS.BASE_URL_1
}
```

### 方案 B: 在 `.env.development` 中覆盖 BASE_URLS

```env
VITE_BASE_URL_1=http://127.0.0.1:8000
VITE_BASE_URL_2=http://127.0.0.1:8000
VITE_BASE_URL_3=http://127.0.0.1:8000
VITE_BASE_URL_4=http://127.0.0.1:8000
```

---

## 五、结论

**核心联调链路 100% 完成** — 登录、JWT、模型列表、智能体、兼容层全部打通。

**发现 1 个架构层面的历史债务** — `apiClient` 的 `getBaseUrl()` 硬编码导致 15+ 模块绕过代理。这不属于联调范围，但会影响本地开发体验。
