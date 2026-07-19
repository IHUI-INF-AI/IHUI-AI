# API 路径迁移报告

- **生成时间**: 2026-07-19 22:57:14 (Asia/Shanghai)
- **任务**: 将 apps/web 与 packages/api-client 中调用旧 API 路径的代码切换到新路径
- **范围**: `apps/web/**/*.{ts,tsx}` + `packages/api-client/src/**/*.ts`

---

## 1. 旧路径扫描结果

扫描模式(在 `apps/web/` 与 `packages/api-client/` 下):

| 模式 | 命中数 | 命中位置 |
| --- | --- | --- |
| `/auth-code` | 0 | 无 |
| `/api/auth-code` | 0 | 无 |
| `/private-letter` (单数) | 0 | 无(仅 `/api/admin/private-letters` 复数,见 §4) |
| `/wrong-question` (单数) | 0 | 无(仅 `/api/exam/wrong-questions` 复数,见 §4) |
| `/checkin` | 10 | `packages/api-client/src/endpoints/business.ts` |
| `/exam-marking` / `/mark/paper` | 0 | 无 API 调用(仅 2 处页面 nav href,见 §4) |

补充扫描(legacy 前缀):

| 模式 | 命中数 |
| --- | --- |
| `/auth-api/` | 0 |
| `/public-api/` | 0 |

**结论**: 仅 `packages/api-client/src/endpoints/business.ts` 命中需切换的旧路径模式 `/checkin`。其他 5 个新端点(`/api/private-letters` / `/api/wrong-questions` / `/api/mail` / `/api/auth-codes` / `/api/exam-marking`)在 web 前端均无调用旧路径的代码,无需切换。

---

## 2. 切换清单

**文件**: `g:\IHUI-AI\packages\api-client\src\endpoints\business.ts`

| 行号 | 旧路径 | 新路径 | 所属函数 |
| --- | --- | --- | --- |
| 161 | `/api/checkin/list` | `/api/check-in/list` | `getCheckinList` |
| 166 | `/api/checkin/${cid}` | `/api/check-in/${cid}` | `getCheckinDetail` |
| 174 | `/api/checkin` (POST) | `/api/check-in` | `createCheckin` |
| 185 | `/api/checkin/${cid}` (PUT) | `/api/check-in/${cid}` | `updateCheckin` |
| 193 | `/api/checkin/${cid}` (DELETE) | `/api/check-in/${cid}` | `deleteCheckin` |
| 200 | `/api/checkin/record/list` | `/api/check-in/record/list` | `getCheckinRecords` |
| 205 | `/api/checkin/record/${rid}` | `/api/check-in/record/${rid}` | `getCheckinRecordDetail` |
| 212 | `/api/checkin/record` (POST) | `/api/check-in/record` | `createCheckinRecord` |
| 223 | `/api/checkin/record/${rid}` (PUT) | `/api/check-in/record/${rid}` | `updateCheckinRecord` |
| 231 | `/api/checkin/record/${rid}` (DELETE) | `/api/check-in/record/${rid}` | `deleteCheckinRecord` |

**HTTP method 全部保持不变**,**路径参数(`${cid}` / `${rid}`)全部保留**。

切换方式: `Edit` 工具 `replace_all`,将 `/api/checkin` 全局替换为 `/api/check-in`(共 10 处)。

---

## 3. typecheck 验证结果

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `pnpm --filter @ihui/web typecheck` | 0 | ✅ 通过(`tsc --noEmit` 无报错) |
| `pnpm --filter @ihui/api-client typecheck` | 0 | ✅ 通过(额外验证,因本任务修改了 api-client 文件) |

---

## 4. 未切换项(说明原因)

### 4.1 `/api/admin/private-letters`(2 处)— **不切换**

- `apps/web/app/(main)/admin/message-overview/page.tsx:61` — `api('/api/admin/private-letters?pageSize=100')`
- `apps/web/app/(main)/admin/private-letters/page.tsx:44` — `api('/api/admin/private-letters')`

**原因**: 这是 **管理后台** 路由,前缀为 `/api/admin/`,由 `admin-private-letters.ts` 路由文件注册(`server.register(adminPrivateLettersRoutes, { prefix: '/api/admin' })`)。与本次新建的 `/api/private-letters`(用户端)是**两个独立端点**,功能不同(管理后台 vs 用户私信),不能混用。

### 4.2 `/api/exam/wrong-questions`(3 处)— **不切换**

- `apps/web/app/(main)/exam/wrong-questions/page.tsx:100` — `api('/api/exam/wrong-questions/stats')`
- `apps/web/app/(main)/exam/wrong-questions/page.tsx:106` — `api('/api/exam/wrong-questions?${qs}')`
- `apps/web/app/(main)/exam/wrong-questions/page.tsx:111` — `api('/api/exam/wrong-questions/${questionId}/resolve', { method: 'PUT' })`

**原因**: 这是 **考试模块下** 的错题路由,前缀为 `/api/exam/`,由 `exam.ts` 路由文件注册(`server.register(examRoutes, { prefix: '/api' })`,内部路径 `/exam/wrong-questions`)。与本次新建的 `/api/wrong-questions`(独立错题本端点)是**两个独立端点**,功能不同(考试场景错题 vs 独立错题本),不能混用。

### 4.3 `/api/user/check-in/*`(2 处)— **不切换**

- `apps/web/src/components/home/MemberCard.tsx:43` — `fetchApi('/api/user/check-in/status')`
- `apps/web/src/components/home/MemberCard.tsx:55` — `fetchApi('/api/user/check-in', { method: 'POST' })`

**原因**: 路径前缀为 `/api/user/`,是 **用户中心** 子路由,与本次新建的 `/api/check-in`(顶层独立签到端点)是**两个独立端点**,不能混用。

### 4.4 `/admin/exam-marking`(2 处)— **不切换**

- `apps/web/e2e/admin-modules.spec.ts:8` — 注释中提到 `exam-marking`(e2e 测试描述文案)
- `apps/web/src/components/layout/AdminNav.tsx:363` — `{ href: '/admin/exam-marking', ... }`(Next.js 页面路由导航)

**原因**:
1. 第一处是 e2e 测试注释文案,非 API 调用。
2. 第二处是 **Next.js 页面导航 href**(指向 `/admin/exam-marking` 页面路由),不是 API 调用。按任务约束「不要切换路由配置中的路径(如 Next.js App Router 文件路径)」,不切换。

### 4.5 `auth_code` / `authCode`(5 处)— **不切换**

- `apps/web/src/lib/third-party-config.ts:165` — 注释中提到 `auth_code` 模式
- `apps/web/src/components/login/ThirdPartyLoginButtons.tsx:60,64,83,84` — 支付宝 OAuth 登录回调参数 `auth_code`(URL query 参数,非 API 路径)

**原因**: 这是第三方 OAuth(支付宝)的 `auth_code` **参数名**(下划线分隔),不是 API URL 路径。与本次迁移的 `/auth-code` → `/api/auth-codes` 无关。

### 4.6 备注:packages/api-client 中 checkin 系列函数当前无调用方

`getCheckinList` / `getCheckinDetail` / `createCheckin` / `updateCheckin` / `deleteCheckin` / `getCheckinRecords` / `getCheckinRecordDetail` / `createCheckinRecord` / `updateCheckinRecord` / `deleteCheckinRecord` 这 10 个函数在 `apps/web/` 中**无任何 import 或调用**(已在整个 monorepo grep 验证)。

本次仅按任务要求做路径切换(`/api/checkin` → `/api/check-in`),不删除这些未使用函数(超出本任务范围)。

⚠️ **风险提示**: 新的 `/api/check-in` 路由(由 `check-in.ts` 注册)目前仅暴露 `POST /`、`GET /`、`GET /rules`、`GET /stats` 4 个端点,**不包含** `/list`、`/:cid`、`/record/list`、`/record/:rid` 等子路径。因此切换后这些 api-client 函数若被调用,会命中 404。但由于当前 web 前端无调用方,实际无影响。如后续需要这些 CRUD 端点,应在 api 端补开发对应子路由。

---

## 5. 新端点注册确认(参考)

`apps/api/src/server.ts` 已注册 6 个新路由(本任务只读验证,未修改):

| 新前缀 | 路由文件 | server.ts 行号 |
| --- | --- | --- |
| `/api/private-letters` | `routes/private-letters.ts` | 940 |
| `/api/wrong-questions` | `routes/wrong-questions.ts` | 942 |
| `/api/check-in` | `routes/check-in.ts` | 945 |
| `/api/mail` | `routes/mail.ts` | 947 |
| `/api/auth-codes` | `routes/auth-codes.ts` | 949 |
| `/api/exam-marking` | `routes/exam-marking.ts` | 951 |

---

## 6. 一句话总结

将 `packages/api-client/src/endpoints/business.ts` 中 10 处 `/api/checkin` 路径切换为 `/api/check-in`(其余 5 个新端点在 web 前端无旧路径调用方),typecheck 全绿。
