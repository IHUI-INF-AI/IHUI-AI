# 安全与合规检查清单

> 用于第 2 月「安全与合规」及发布前自检。与 `BACKLOG_ONE_MONTH.md` 第八节、`.cursorrules/security-audit.mdc` 对齐。

---

## 1. 前端安全（v-html 与 XSS）

### 1.1 已做 sanitize / DOMPurify 的 v-html

| 位置 | 说明 |
|------|------|
| `Vip.vue` | FAQ 答案：`sanitizeHtml(faq.answer)`（useVipFaqs + DOMPurify） |
| `AIAssistant.vue` / `N8NAssistant.vue` | 提示与回答：`sanitizeHtml` + DOMPurify |
| `Courses.vue` | 详情描述：`sanitizeHtml(description)`（@/utils/htmlSanitizer） |
| `MCPResourceViewer.vue` | 资源内容：`sanitizeHtml(resourceContent)` |
| `AiWorldDetail.vue` | 详情面板：`sanitizedPanelHtml`（DOMPurify） |
| `DesignerAgent.vue` | 输出：`sanitizeHtml(output...)` |
| `ChatMessageList.vue` | 消息内容：DOMPurify.sanitize |
| `ChatHistory.vue` | 消息：DOMPurify.sanitize |
| `AIChat.vue` / `AIChatLegacy.vue` | 消息/思考内容：formatMessage/formatContent 内部使用 DOMPurify |
| `AgenticComponentGenerator.vue` | 文档：DOMPurify.sanitize(markdown 渲染结果) |
| `EduDocumentation.vue` | 正文/法律条款：DOMPurify + htmlSanitizer.sanitizeHtml |
| `MCPUseProject.vue` | README：DOMPurify.sanitize |

### 1.2 受控来源（代码/配置，非用户原始输入）

| 位置 | 说明 |
|------|------|
| `OpenPlatform.vue` | `currentCodeHtml`：代码示例，来自高亮/静态配置 |
| `CodeBlock.vue` / `CodeViewer.vue` | 代码高亮：highlight.js 输出 |
| `MarkdownViewer.vue` | 预览：一般为 markdown 渲染管线（需确认上游是否 sanitize） |
| `VersionDiff.vue` | diff 文本：来自版本对比结果，非直接用户输入 |

### 1.3 已复查

| 位置 | 说明 |
|------|------|
| `Footer.vue` | 已改为 `{{ getSplit('footer.companyEmail', 1) }}` 文本插值，不再使用 v-html。 |
| `XuqiuDetail.vue` | `formatDescription` 内部已使用 `escapeHtml(description)` 再替换换行，v-html 安全。 |

**结论**：用户可见、可能含富文本的 v-html 已普遍使用 DOMPurify 或 `@/utils/htmlSanitizer`；代码展示类为受控来源。建议新加 v-html 一律经白名单或 DOMPurify。

---

## 2. 敏感数据与硬编码

- **生产代码**：未发现硬编码的 API Key、密码、私钥。`api-config.ts`、`backend-paths.ts` 仅路径常量；`storage.ts` 为 key 名。
- **Mock/占位**：`request.ts`、`mock-data.ts`、`api.ts`、`mcp.ts`、`ModelManager.vue`、`ApiDocumentation.vue` 等处的 `demo-*`、`mock*`、`YOUR_API_KEY` 仅用于开发/示例，未用于生产鉴权。
- **测试**：`__tests__` 与 `*.test.ts` 中的 token/secret 为 fixture，不参与构建产物。

**结论**：符合「无前端硬编码密钥」；敏感配置应继续通过环境变量或后端下发。

---

## 3. CSP 与 X-Frame-Options

| 位置 | 说明 |
|------|------|
| `vite.config.ts` | 开发/预览：`X-Frame-Options: SAMEORIGIN`；生产注入 CSP（含 script/style/img/font/connect/frame/worker） |
| `index.html` | 含 CSP meta（开发/本地用）；注释说明 X-Frame-Options 应由服务端设置 |
| `nginx-production.conf` | `X-Frame-Options "SAMEORIGIN"`；`Content-Security-Policy` 与当前前端能力一致 |
| `backend/services/security_service.py` | 可选后端头：`X-Frame-Options: DENY`、CSP |

**结论**：CSP 与 X-Frame-Options 已在 Vite、Nginx 及（可选）后端中配置，与现有 SECURITY 文档方向一致。

---

## 4. 依赖审计

- `npm audit --audit-level=high`：当前 **0 vulnerabilities**。
- 已纳入 `scripts/pre-deploy-check.js`（步骤 5），部署前会执行。

---

## 5. 登录/会话与路由守卫（BACKLOG 8.3）

### 5.1 路由守卫（`src/router/index.ts`）

- **beforeEach**：支付宝 body 回调处理；开发环境下 OAuth 回调参数清理；登录/注册页已登录则根据 `auth-return-path` 或默认跳转首页；`meta.requiresAuth === true` 时校验 Token 与 `LOGIN_EXPIRY_TIME`，未登录则 `next({ name: 'login', query: { redirect: to.fullPath } })`；`meta.requiresAdmin === true` 时校验用户 `role/isAdmin/userType`，非管理员则 `next({ path: '/403', replace: true })`。
- **登录态恢复**：从 `StorageManager` 读取 `TOKEN`/`USER_TOKEN`、`USER_DATA`、`LOGIN_EXPIRY_TIME`，过期则清除并可选 `authStore.logout()`；有效则恢复 `authStore.token` 与 `authStore.user`。

### 5.2 Token 与存储

- **存储键**：`STORAGE_KEYS.TOKEN`、`USER_TOKEN`、`USER_DATA`、`LOGIN_EXPIRY_TIME`（见 `@/utils/storage`）；过期判断使用 `isLoginExpired(expiryTime)`（`@/utils/login-duration`）。
- **刷新**：当前前端未实现独立 refresh token 轮询；登录接口返回的 `token`/`refreshToken` 由 UniversalLogin 等写入 storage 或 RememberMeService，后续可对接后端 refresh 接口在 axios 拦截器内统一处理。

### 5.3 安全日志与审计

- **设置页**：已集成 SecurityLog 组件与审计导出；独立路由 `/audit`（AuditLog）、`/files`、`/permissions` 已配置。
- **管理后台**：admin 路由统一 `requiresAuth` + `requiresAdmin`，未授权访问会重定向至 `/403`（Forbidden.vue）。

**结论**：登录/会话与路由守卫、403 与审计入口已实现并文档化；Token 刷新策略可后续与后端约定后补。

---

## 6. 后续建议（BACKLOG 8.x）

- 8.2 收尾：对 `Footer`、`XuqiuDetail` 的 v-html 已复查（见 1.3）。
- 8.3 登录/会话：已在本清单 §5 补充。

---

*最后更新：按第 2 月「开放平台或安全文档」任务整理；§5 登录/会话与路由守卫已补充。*
