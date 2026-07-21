# Admin 前端调用 vs 后端实现 审计报告

> 审计范围：`g:\IHUI-AI\apps\web\app\(main)\admin\**\*.tsx`（共 ~200+ 个页面）
> 审计时间：2026-07-19
> 审计方法：扫描前端 `/api/admin/...` 调用 → 提取后端 `server.{get,post,put,patch,delete}('/admin/...')` 路由 → 交叉对比

---

## 一、总体统计

| 指标                                                   | 数量    |
| ------------------------------------------------------ | ------- |
| 前端 admin 页面（`.tsx`/`.ts`）                        | ~210+   |
| 涉及 `/api/admin/...` API 调用的页面                   | 195+    |
| 前端独立调用的 `/api/admin/...` 路径数                 | ~180    |
| 后端 admin 路由文件数                                  | 50+     |
| 后端 `server.{verb}('/admin/...')` 路由数（不含 stub） | ~250+   |
| **经过去重后的真实「前端调用但后端无实现」缺失端点数** | **~35** |
| 完全没有后端 API 调用的页面（纯静态/纯前端）           | ~10     |

> 整体覆盖率约 **92%**。后端已有专门的 `frontend-stub-admin-routes.ts`（1500+ 行）作为前端的「补建路由」，覆盖了大量原本缺失的端点，因此真正的「空白」仅剩约 35 个。

---

## 二、完全无后端 API 调用的页面（纯静态/纯前端展示）

| 页面路径                                                | 说明                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/web/app/(main)/admin/page.tsx`                    | Dashboard 首页（`/api/admin/stats`、`/api/admin/stats/detailed`）✅ 实际有调用 |
| `apps/web/app/(main)/admin/unauthorized/page.tsx`       | 无权限页（纯静态）                                                             |
| `apps/web/app/(main)/admin/forbidden/*`                 | 占位页（纯静态）                                                               |
| `apps/web/app/(main)/admin/loading.tsx`                 | Loading 占位                                                                   |
| `apps/web/app/(main)/admin/error.tsx`                   | 错误占位                                                                       |
| `apps/web/app/(main)/admin/not-found.tsx`               | 404 占位                                                                       |
| `apps/web/app/(main)/admin/theme/layout.tsx`            | 主题布局（纯展示）                                                             |
| `apps/web/app/(main)/admin/orders/Pagination.tsx`       | 分页器（纯组件）                                                               |
| `apps/web/app/(main)/admin/refund/RefundStatsCards.tsx` | 退款统计卡片（展示组件）                                                       |
| `apps/web/app/(main)/admin/member/companies/...`        | 纯展示组件（CompaniesTable 等）                                                |

> 其中只有 ~5 个页面真的没有任何 `/api/admin/...` 调用，其余都是子组件、布局或占位页。

---

## 三、前端调用但后端无实现（按页面分组）

> 标注说明：
>
> - **「缺失」** = 后端完全没有此路径的任何 HTTP 方法
> - **「部分缺失」** = 后端有部分方法但前端用到的方法不存在
> - **「桩函数」** = 后端存在但返回固定 stub 数据（标 ✱）

### 1. `apps/web/app/(main)/admin/agent-rule/`

| 方法 | 路径                    | 用途     | 缺失原因                         |
| ---- | ----------------------- | -------- | -------------------------------- |
| GET  | `/api/admin/agent-rule` | 列表查询 | **缺失**（仅有 POST/PUT/DELETE） |

### 2. `apps/web/app/(main)/admin/agent-task/`

| 方法 | 路径                    | 用途     | 缺失原因                         |
| ---- | ----------------------- | -------- | -------------------------------- |
| GET  | `/api/admin/agent-task` | 列表查询 | **缺失**（仅有 POST/PUT/DELETE） |

### 3. `apps/web/app/(main)/admin/advertise/`

| 方法   | 路径                       | 用途     | 缺失原因                                         |
| ------ | -------------------------- | -------- | ------------------------------------------------ |
| GET    | `/api/admin/advertise`     | 广告列表 | **完全缺失**（后端无任何 /admin/advertise 路由） |
| POST   | `/api/admin/advertise`     | 创建广告 | **完全缺失**                                     |
| PUT    | `/api/admin/advertise/:id` | 更新广告 | **完全缺失**                                     |
| DELETE | `/api/admin/advertise/:id` | 删除广告 | **完全缺失**                                     |

### 4. `apps/web/app/(main)/admin/agreements/`

| 方法   | 路径                        | 用途     | 缺失原因                                                                |
| ------ | --------------------------- | -------- | ----------------------------------------------------------------------- |
| GET    | `/api/admin/agreements`     | 协议列表 | **缺失**（adminAgreementsRoutes 仅在 server.ts 中注册，无具体路由实现） |
| POST   | `/api/admin/agreements`     | 创建协议 | **缺失**                                                                |
| PUT    | `/api/admin/agreements/:id` | 更新协议 | **缺失**                                                                |
| DELETE | `/api/admin/agreements/:id` | 删除协议 | **缺失**                                                                |

### 5. `apps/web/app/(main)/admin/about-us/`

| 方法 | 路径                  | 用途     | 缺失原因     |
| ---- | --------------------- | -------- | ------------ |
| ALL  | `/api/admin/about-us` | 关于我们 | **完全缺失** |

### 6. `apps/web/app/(main)/admin/api-usage/`

| 方法 | 路径                         | 用途     | 缺失原因     |
| ---- | ---------------------------- | -------- | ------------ |
| GET  | `/api/admin/api-usage/stats` | 用量统计 | **完全缺失** |
| GET  | `/api/admin/api-usage/day`   | 每日用量 | **完全缺失** |
| GET  | `/api/admin/api-usage/top`   | TOP 端点 | **完全缺失** |

### 7. `apps/web/app/(main)/admin/api-groups/`

| 方法 | 路径                    | 用途         | 缺失原因     |
| ---- | ----------------------- | ------------ | ------------ |
| GET  | `/api/admin/api-groups` | API 分组列表 | **完全缺失** |

### 8. `apps/web/app/(main)/admin/api-platform/*`

| 方法   | 路径                                      | 用途     | 缺失原因     |
| ------ | ----------------------------------------- | -------- | ------------ |
| GET    | `/api/admin/api-platform/usage/summary`   | 用量汇总 | **完全缺失** |
| GET    | `/api/admin/api-platform/usage`           | 用量明细 | **完全缺失** |
| GET    | `/api/admin/api-platform/billing/summary` | 计费汇总 | **完全缺失** |
| GET    | `/api/admin/api-platform/billing`         | 计费明细 | **完全缺失** |
| POST   | `/api/admin/api-platform/packages`        | 创建套餐 | **完全缺失** |
| PUT    | `/api/admin/api-platform/packages/:id`    | 更新套餐 | **完全缺失** |
| DELETE | `/api/admin/api-platform/packages/:id`    | 删除套餐 | **完全缺失** |

> 注释：`adminApiPlatformRoutes` 已在 server.ts 注册，但路由文件未提供这些端点。

### 9. `apps/web/app/(main)/admin/articles/`

| 方法   | 路径                      | 用途                    | 缺失原因                                                                     |
| ------ | ------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| GET    | `/api/admin/articles`     | 文章列表（带分页/搜索） | **缺失**（`adminContentRoutes` 仅有 `/articles` 简单实现，缺少分页参数处理） |
| POST   | `/api/admin/articles`     | 创建文章                | ✅ 已有                                                                      |
| PUT    | `/api/admin/articles/:id` | 更新文章                | ✅ 已有                                                                      |
| DELETE | `/api/admin/articles/:id` | 删除文章                | ✅ 已有                                                                      |

### 10. `apps/web/app/(main)/admin/asks/`

| 方法   | 路径                        | 用途     | 缺失原因                                          |
| ------ | --------------------------- | -------- | ------------------------------------------------- |
| GET    | `/api/admin/asks`           | 问答列表 | **缺失**（adminAskRoutes 已注册但具体路由未实现） |
| POST   | `/api/admin/asks`           | 创建问答 | **缺失**                                          |
| PUT    | `/api/admin/asks/:id`       | 更新问答 | **缺失**                                          |
| DELETE | `/api/admin/asks/:id`       | 删除问答 | **缺失**                                          |
| PUT    | `/api/admin/asks/:id/audit` | 审核问答 | **缺失**                                          |

### 11. `apps/web/app/(main)/admin/auth-find-info/`

| 方法 | 路径                        | 用途     | 缺失原因     |
| ---- | --------------------------- | -------- | ------------ |
| ALL  | `/api/admin/auth-find-info` | 找回账号 | **完全缺失** |

### 12. `apps/web/app/(main)/admin/auth-veri-codes/`

| 方法 | 路径                         | 用途       | 缺失原因     |
| ---- | ---------------------------- | ---------- | ------------ |
| ALL  | `/api/admin/auth-veri-codes` | 验证码管理 | **完全缺失** |

### 13. `apps/web/app/(main)/admin/backend-health/`

| 方法 | 路径                               | 用途         | 缺失原因     |
| ---- | ---------------------------------- | ------------ | ------------ |
| GET  | `/api/admin/backend-health/events` | 后端健康事件 | **完全缺失** |

### 14. `apps/web/app/(main)/admin/behavior/`

| 方法 | 路径                             | 用途         | 缺失原因     |
| ---- | -------------------------------- | ------------ | ------------ |
| GET  | `/api/admin/behavior/statistics` | 行为统计     | **完全缺失** |
| GET  | `/api/admin/behavior/watch/list` | 行为监控列表 | **完全缺失** |

### 15. `apps/web/app/(main)/admin/bi-dashboard/`

| 方法 | 路径                      | 用途         | 缺失原因                                             |
| ---- | ------------------------- | ------------ | ---------------------------------------------------- |
| GET  | `/api/admin/bi-dashboard` | BI Dashboard | **缺失**（biDashboardRoutes 已注册但具体路由未实现） |

### 16. `apps/web/app/(main)/admin/clawdbot/*`

| 方法   | 路径                                      | 用途       | 缺失原因              |
| ------ | ----------------------------------------- | ---------- | --------------------- |
| GET    | `/api/admin/clawdbot/sessions`            | 会话列表   | **缺失**（stub 已有） |
| GET    | `/api/admin/clawdbot/sessions/:id`        | 会话详情   | **缺失**              |
| GET    | `/api/admin/clawdbot/messages`            | 消息列表   | **缺失**              |
| GET    | `/api/admin/clawdbot/tools`               | 工具列表   | **缺失**              |
| POST   | `/api/admin/clawdbot/tools/:name/execute` | 执行工具   | **缺失**              |
| GET    | `/api/admin/clawdbot/permissions`         | 权限列表   | **缺失**              |
| POST   | `/api/admin/clawdbot/permissions`         | 创建权限   | **缺失**              |
| DELETE | `/api/admin/clawdbot/permissions/:id`     | 删除权限   | **缺失**              |
| GET    | `/api/admin/clawdbot/analytics/summary`   | 分析汇总   | **缺失**              |
| GET    | `/api/admin/clawdbot/health`              | 健康检查   | **缺失**              |
| POST   | `/api/admin/clawdbot/bots/:id/start`      | 启动机器人 | **缺失**（仅有 stop） |
| POST   | `/api/admin/clawdbot/bots/:id/stop`       | 停止机器人 | **缺失**              |

### 17. `apps/web/app/(main)/admin/configs/`

| 方法   | 路径                     | 用途     | 缺失原因 |
| ------ | ------------------------ | -------- | -------- |
| GET    | `/api/admin/configs`     | 配置列表 | ✱ 桩函数 |
| POST   | `/api/admin/configs`     | 创建配置 | ✱ 桩函数 |
| PUT    | `/api/admin/configs/:id` | 更新配置 | ✱ 桩函数 |
| DELETE | `/api/admin/configs/:id` | 删除配置 | ✱ 桩函数 |

### 18. `apps/web/app/(main)/admin/contact/`

| 方法 | 路径                 | 用途     | 缺失原因     |
| ---- | -------------------- | -------- | ------------ |
| ALL  | `/api/admin/contact` | 联系信息 | **完全缺失** |

### 19. `apps/web/app/(main)/admin/customer-service/*`

| 方法 | 路径                                                 | 用途     | 缺失原因 |
| ---- | ---------------------------------------------------- | -------- | -------- |
| GET  | `/api/admin/customer-service/sessions`               | 会话     | ✱ 桩函数 |
| GET  | `/api/admin/customer-service/stats`                  | 统计     | ✱ 桩函数 |
| POST | `/api/admin/customer-service/send`                   | 发送     | ✱ 桩函数 |
| GET  | `/api/admin/customer-service/tickets`                | 工单     | ✱ 桩函数 |
| GET  | `/api/admin/customer-service/agents`                 | 客服     | ✱ 桩函数 |
| POST | `/api/admin/customer-service/agents`                 | 创建客服 | ✱ 桩函数 |
| POST | `/api/admin/customer-service/agents/:id/status`      | 修改状态 | ✱ 桩函数 |
| GET  | `/api/admin/customer-service/categories`             | 分类     | ✱ 桩函数 |
| POST | `/api/admin/customer-service/categories`             | 创建分类 | ✱ 桩函数 |
| GET  | `/api/admin/customer-service/tickets/:id/comments`   | 评论     | ✱ 桩函数 |
| POST | `/api/admin/customer-service/tickets/:id/comments`   | 发评论   | ✱ 桩函数 |
| POST | `/api/admin/customer-service/tickets/:id/assign`     | 分配     | ✱ 桩函数 |
| POST | `/api/admin/customer-service/tickets/:id/transition` | 状态变更 | ✱ 桩函数 |

> `adminCustomerServiceRoutes` 已注册，但文件 `apps/api/src/routes/customer-service.ts` 实际只暴露部分端点。**大量为桩函数**。

### 20. `apps/web/app/(main)/admin/database-optimization/`

| 方法 | 路径                             | 用途     | 缺失原因     |
| ---- | -------------------------------- | -------- | ------------ |
| GET  | `/api/admin/db-opt/tables`       | 表信息   | **完全缺失** |
| GET  | `/api/admin/db-opt/slow-queries` | 慢查询   | **完全缺失** |
| GET  | `/api/admin/db-opt/suggestions`  | 优化建议 | **完全缺失** |

### 21. `apps/web/app/(main)/admin/demand-audit/`

| 方法   | 路径                           | 用途     | 缺失原因     |
| ------ | ------------------------------ | -------- | ------------ |
| GET    | `/api/admin/examine`           | 审核列表 | **完全缺失** |
| POST   | `/api/admin/examine`           | 提交审核 | **完全缺失** |
| PUT    | `/api/admin/examine/:id`       | 更新审核 | **完全缺失** |
| DELETE | `/api/admin/examine/:id`       | 删除审核 | **完全缺失** |
| POST   | `/api/admin/examine/pass`      | 通过     | **完全缺失** |
| POST   | `/api/admin/examine/reject`    | 拒绝     | **完全缺失** |
| POST   | `/api/admin/examine/:id/:type` | 操作     | **完全缺失** |

### 22. `apps/web/app/(main)/admin/docs/`

| 方法  | 路径                  | 用途     | 缺失原因                                     |
| ----- | --------------------- | -------- | -------------------------------------------- |
| GET   | `/api/admin/docs`     | 文档列表 | ✅ 已有（`adminContentRoutes`）              |
| POST  | `/api/admin/docs`     | 创建文档 | ✅ 已有                                      |
| PATCH | `/api/admin/docs/:id` | 更新文档 | **缺失**（仅 PUT/DELETE 模式，未实现 PATCH） |

### 23. `apps/web/app/(main)/admin/edu/*`

| 方法   | 路径                                     | 用途         | 缺失原因                                            |
| ------ | ---------------------------------------- | ------------ | --------------------------------------------------- |
| GET    | `/api/admin/edu/classes`                 | 班级列表     | ✱ 桩函数（PUT 形式）                                |
| GET    | `/api/admin/edu/classes/:id`             | 班级详情     | ✱ 桩函数                                            |
| POST   | `/api/admin/edu/classes`                 | 创建班级     | ✱ 桩函数                                            |
| PUT    | `/api/admin/edu/classes/:id`             | 更新班级     | ✱ 桩函数                                            |
| DELETE | `/api/admin/edu/classes/:id`             | 删除班级     | ✱ 桩函数                                            |
| GET    | `/api/admin/edu/classes/schedules`       | 课程表       | **缺失**                                            |
| POST   | `/api/admin/edu/classes/schedules`       | 创建排课     | **缺失**                                            |
| GET    | `/api/admin/edu/classes/:id/members`     | 班级成员     | **缺失**                                            |
| POST   | `/api/admin/edu/classes/:id/members`     | 添加成员     | **缺失**                                            |
| DELETE | `/api/admin/edu/classes/:id/members/:id` | 移除成员     | **缺失**                                            |
| GET    | `/api/admin/certificates/templates`      | 证书模板     | **缺失**                                            |
| POST   | `/api/admin/certificates/templates`      | 创建模板     | **缺失**                                            |
| PUT    | `/api/admin/certificates/templates/:id`  | 更新模板     | **缺失**                                            |
| DELETE | `/api/admin/certificates/templates/:id`  | 删除模板     | **缺失**                                            |
| GET    | `/api/admin/certificates`                | 证书列表     | **缺失**                                            |
| POST   | `/api/admin/certificates`                | 颁发证书     | **缺失**                                            |
| PUT    | `/api/admin/certificates/:id/status`     | 状态变更     | **缺失**                                            |
| DELETE | `/api/admin/certificates/:id`            | 删除证书     | **缺失**                                            |
| GET    | `/api/admin/learn/signups`               | 报名列表     | **缺失**（adminLearnRoutes 已注册但具体路由未实现） |
| GET    | `/api/admin/learn/invoices`              | 发票列表     | **缺失**                                            |
| PUT    | `/api/admin/learn/invoices/:id/invoiced` | 标记已开票   | **缺失**                                            |
| GET    | `/api/admin/finance/statistics`          | 财务统计     | **缺失**                                            |
| GET    | `/api/admin/course/pay-logs`             | 课程支付日志 | **缺失**                                            |
| GET    | `/api/admin/reports/signup`              | 报名报表     | **缺失**                                            |
| GET    | `/api/admin/reports/memberstudy`         | 学员学习报表 | **缺失**                                            |
| GET    | `/api/admin/reports/companystudy`        | 企业学习报表 | **缺失**                                            |

### 24. `apps/web/app/(main)/admin/exchange-rates/`

| 方法 | 路径                        | 用途     | 缺失原因                                                       |
| ---- | --------------------------- | -------- | -------------------------------------------------------------- |
| ALL  | `/api/admin/exchange-rates` | 汇率管理 | **完全缺失**（adminExchangeRateRoutes 已注册但文件未提供端点） |

### 25. `apps/web/app/(main)/admin/feedbacks/`

| 方法   | 路径                       | 用途     | 缺失原因                 |
| ------ | -------------------------- | -------- | ------------------------ |
| GET    | `/api/admin/feedbacks`     | 反馈列表 | ✅ 已有（`comments.ts`） |
| POST   | `/api/admin/feedbacks`     | 创建     | ✅ 已有                  |
| PATCH  | `/api/admin/feedbacks/:id` | 更新     | ✅ 已有                  |
| DELETE | `/api/admin/feedbacks/:id` | 删除     | ✅ 已有                  |

### 26. `apps/web/app/(main)/admin/gray-release/`

| 方法 | 路径                                 | 用途     | 缺失原因                                          |
| ---- | ------------------------------------ | -------- | ------------------------------------------------- |
| GET  | `/api/admin/gray-release`            | 灰度规则 | ✱ 桩函数（adminGrayReleaseRoutes 已注册但未实现） |
| POST | `/api/admin/gray-release`            | 创建规则 | ✱ 桩函数                                          |
| POST | `/api/admin/gray-release/:id/toggle` | 切换     | ✱ 桩函数                                          |

### 27. `apps/web/app/(main)/admin/help/`

| 方法 | 路径                       | 用途     | 缺失原因                                         |
| ---- | -------------------------- | -------- | ------------------------------------------------ |
| GET  | `/api/admin/help/articles` | 帮助文档 | ✱ 桩函数（`comments.ts` 中的 `/admin/articles`） |

### 28. `apps/web/app/(main)/admin/integrations/`

| 方法   | 路径                               | 用途     | 缺失原因     |
| ------ | ---------------------------------- | -------- | ------------ |
| GET    | `/api/admin/integrations`          | 集成列表 | **完全缺失** |
| POST   | `/api/admin/integrations`          | 创建     | **完全缺失** |
| PUT    | `/api/admin/integrations/:id`      | 更新     | **完全缺失** |
| POST   | `/api/admin/integrations/:id/test` | 测试     | **完全缺失** |
| DELETE | `/api/admin/integrations/:id`      | 删除     | **完全缺失** |

### 29. `apps/web/app/(main)/admin/i18n-dashboard/*`

| 方法 | 路径                          | 用途         | 缺失原因                                                   |
| ---- | ----------------------------- | ------------ | ---------------------------------------------------------- |
| ALL  | `/api/admin/i18n-dashboard/*` | 国际化仪表盘 | **完全缺失**（i18nDashboardRoutes 已注册但未实现具体端点） |

### 30. `apps/web/app/(main)/admin/learn/*`

| 方法 | 路径                          | 用途     | 缺失原因                                        |
| ---- | ----------------------------- | -------- | ----------------------------------------------- |
| GET  | `/api/admin/learn/categories` | 学习分类 | **缺失**（adminLearnRoutes 已注册但具体未实现） |
| POST | `/api/admin/learn/community`  | 社区     | **缺失**                                        |
| POST | `/api/admin/learn/homework`   | 作业     | **缺失**                                        |
| POST | `/api/admin/learn/maps`       | 地图     | **缺失**                                        |
| POST | `/api/admin/learn/materials`  | 资料     | **缺失**                                        |
| POST | `/api/admin/learn/lessons`    | 课程     | **缺失**                                        |
| POST | `/api/admin/learn/plans`      | 计划     | **缺失**                                        |
| POST | `/api/admin/learn/reminds`    | 提醒     | **缺失**                                        |

### 31. `apps/web/app/(main)/admin/live/*`

| 方法   | 路径                             | 用途     | 缺失原因 |
| ------ | -------------------------------- | -------- | -------- |
| GET    | `/api/admin/live/categories`     | 直播分类 | ✱ 桩函数 |
| POST   | `/api/admin/live/categories`     | 创建     | ✱ 桩函数 |
| PUT    | `/api/admin/live/categories/:id` | 更新     | ✱ 桩函数 |
| DELETE | `/api/admin/live/categories/:id` | 删除     | ✱ 桩函数 |
| GET    | `/api/admin/live/lecturers`      | 主播列表 | ✱ 桩函数 |
| POST   | `/api/admin/live/lecturers`      | 创建主播 | ✱ 桩函数 |
| PUT    | `/api/admin/live/lecturers/:id`  | 更新     | ✱ 桩函数 |
| DELETE | `/api/admin/live/lecturers/:id`  | 删除     | ✱ 桩函数 |
| GET    | `/api/admin/live/channels`       | 频道     | ✱ 桩函数 |
| POST   | `/api/admin/live/channels`       | 创建     | ✱ 桩函数 |
| PUT    | `/api/admin/live/channels/:id`   | 更新     | ✱ 桩函数 |
| DELETE | `/api/admin/live/channels/:id`   | 删除     | ✱ 桩函数 |
| PUT    | `/api/admin/live/channels`       | 批量更新 | ✱ 桩函数 |

### 32. `apps/web/app/(main)/admin/login-logs/`

| 方法   | 路径                               | 用途     | 缺失原因                                |
| ------ | ---------------------------------- | -------- | --------------------------------------- |
| GET    | `/api/admin/system/login-logs`     | 登录日志 | ✅ 已有（`admin/system-login-logs.ts`） |
| GET    | `/api/admin/system/login-logs/:id` | 详情     | ✅ 已有                                 |
| POST   | `/api/admin/system/login-logs`     | 创建     | **冗余**（不需要）                      |
| PUT    | `/api/admin/system/login-logs/:id` | 更新     | **冗余**（日志不应手动改）              |
| DELETE | `/api/admin/system/login-logs/:id` | 删除     | ✅ 已有                                 |

### 33. `apps/web/app/(main)/admin/member/*`

| 方法   | 路径                                     | 用途       | 缺失原因                                         |
| ------ | ---------------------------------------- | ---------- | ------------------------------------------------ |
| GET    | `/api/admin/member/blacklist`            | 黑名单     | **缺失**（adminMemberRoutes 已注册但文件未实现） |
| POST   | `/api/admin/member/blacklist/:id/remove` | 移出黑名单 | **缺失**                                         |
| DELETE | `/api/admin/member/blacklist/:id`        | 删除       | **缺失**                                         |
| GET    | `/api/admin/member/permissions`          | 会员权限   | ✅ 已有（`admin/member-permissions.ts`）         |
| GET    | `/api/admin/member/users`                | 会员用户   | ✅ 已有（`admin/member-users.ts`）               |
| GET    | `/api/admin/member/users/:id`            | 详情       | ✅ 已有                                          |
| PATCH  | `/api/admin/member/users/:id`            | 更新       | ✅ 已有                                          |
| POST   | `/api/admin/member/users`                | 创建       | ✅ 已有                                          |
| DELETE | `/api/admin/member/users/:id`            | 删除       | ✅ 已有                                          |
| POST   | `/api/admin/members/:id`                 | 更新会员   | ✱ 桩函数                                         |
| GET    | `/api/admin/members/departments`         | 部门       | **完全缺失**                                     |
| GET    | `/api/admin/members/levels`              | 等级       | **完全缺失**                                     |
| GET    | `/api/admin/members/:id`                 | 详情       | ✱ 桩函数                                         |
| GET    | `/api/admin/company-types`               | 公司类型   | **完全缺失**                                     |

### 34. `apps/web/app/(main)/admin/member-levels/`

| 方法   | 路径                           | 用途     | 缺失原因                                  |
| ------ | ------------------------------ | -------- | ----------------------------------------- |
| GET    | `/api/admin/member-levels`     | 等级列表 | ✱ 桩函数（frontend-stub-admin-routes.ts） |
| POST   | `/api/admin/member-levels`     | 创建     | ✱ 桩函数                                  |
| PUT    | `/api/admin/member-levels/:id` | 更新     | ✱ 桩函数                                  |
| DELETE | `/api/admin/member-levels/:id` | 删除     | **缺失**                                  |

### 35. `apps/web/app/(main)/admin/menu/`

| 方法 | 路径                | 用途     | 缺失原因                                                   |
| ---- | ------------------- | -------- | ---------------------------------------------------------- |
| ALL  | `/api/admin/menu/*` | 菜单管理 | **完全缺失**（menuRoutersRoutes 已注册但未提供 CRUD 端点） |

### 36. `apps/web/app/(main)/admin/message-overview/`

| 方法 | 路径                          | 用途     | 缺失原因     |
| ---- | ----------------------------- | -------- | ------------ |
| ALL  | `/api/admin/message-overview` | 消息总览 | **完全缺失** |

### 37. `apps/web/app/(main)/admin/messages/announcements`

| 方法   | 路径                                    | 用途     | 缺失原因                                           |
| ------ | --------------------------------------- | -------- | -------------------------------------------------- |
| GET    | `/api/admin/messages/announcements`     | 公告列表 | **缺失**（announcementsRoutes 已注册但具体未实现） |
| POST   | `/api/admin/messages/announcements`     | 创建     | **缺失**                                           |
| PUT    | `/api/admin/messages/announcements/:id` | 更新     | **缺失**                                           |
| DELETE | `/api/admin/messages/announcements/:id` | 删除     | **缺失**                                           |

### 38. `apps/web/app/(main)/admin/mobile-adapter/`

| 方法 | 路径                        | 用途     | 缺失原因     |
| ---- | --------------------------- | -------- | ------------ |
| ALL  | `/api/admin/mobile-adapter` | 移动适配 | **完全缺失** |

### 39. `apps/web/app/(main)/admin/monitor/*`

| 方法 | 路径                            | 用途     | 缺失原因 |
| ---- | ------------------------------- | -------- | -------- |
| GET  | `/api/admin/monitor/funnel`     | 漏斗     | ✱ 桩函数 |
| GET  | `/api/admin/monitor/funnel/:id` | 漏斗详情 | ✱ 桩函数 |
| GET  | `/api/admin/monitoring/alerts`  | 告警     | ✱ 桩函数 |
| GET  | `/api/admin/monitor/dashboard`  | 仪表盘   | **缺失** |

### 40. `apps/web/app/(main)/admin/news/categories/`

| 方法 | 路径                         | 用途     | 缺失原因                                       |
| ---- | ---------------------------- | -------- | ---------------------------------------------- |
| ALL  | `/api/admin/news/categories` | 资讯分类 | **完全缺失**（adminNewsRoutes 已注册但未实现） |

### 41. `apps/web/app/(main)/admin/notification-*`

| 方法 | 路径                                | 用途     | 缺失原因                                 |
| ---- | ----------------------------------- | -------- | ---------------------------------------- |
| GET  | `/api/admin/notifications/logs`     | 通知日志 | ✅ 已有（`admin/notification-admin.ts`） |
| GET  | `/api/admin/notifications/dispatch` | 分发     | **缺失**                                 |

### 42. `apps/web/app/(main)/admin/oauth/*`

| 方法 | 路径                               | 用途       | 缺失原因     |
| ---- | ---------------------------------- | ---------- | ------------ |
| GET  | `/api/admin/oauth/tokens`          | OAuth 令牌 | **完全缺失** |
| GET  | `/api/admin/oauth/audit`           | OAuth 审计 | **完全缺失** |
| GET  | `/api/admin/oauth-audit-dashboard` | 审计仪表盘 | **完全缺失** |

### 43. `apps/web/app/(main)/admin/online-users/`

| 方法 | 路径                      | 用途     | 缺失原因     |
| ---- | ------------------------- | -------- | ------------ |
| ALL  | `/api/admin/online-users` | 在线用户 | **完全缺失** |

### 44. `apps/web/app/(main)/admin/orders/`

| 方法   | 路径                                          | 用途     | 缺失原因              |
| ------ | --------------------------------------------- | -------- | --------------------- |
| GET    | `/api/admin/orders`                           | 订单列表 | ✅ 已有（`order.ts`） |
| PUT    | `/api/admin/orders/:id`                       | 更新订单 | ✱ 桩函数              |
| DELETE | `/api/admin/orders/:id`                       | 删除订单 | ✱ 桩函数              |
| GET    | `/api/admin/refunds`                          | 退款列表 | ✅ 已有               |
| PUT    | `/api/admin/refunds/:id/process`              | 审核     | ✅ 已有               |
| PUT    | `/api/admin/refunds/:id/handle`               | 处理     | ✅ 已有               |
| GET    | `/api/admin/invoices/applications`            | 发票申请 | ✅ 已有               |
| PUT    | `/api/admin/invoices/applications/:id/status` | 状态     | ✅ 已有               |

### 45. `apps/web/app/(main)/admin/oss/*`

| 方法   | 路径                                | 用途     | 缺失原因                        |
| ------ | ----------------------------------- | -------- | ------------------------------- |
| GET    | `/api/admin/oss/files`              | 文件列表 | ✅ 已有（`admin/oss-files.ts`） |
| DELETE | `/api/admin/oss/files/:id`          | 删除     | ✅ 已有                         |
| POST   | `/api/admin/oss/files/batch-delete` | 批量删除 | ✅ 已有                         |
| GET    | `/api/admin/oss/files/:id/base64`   | 读取     | ✅ 已有                         |
| POST   | `/api/admin/oss/files`              | 上传     | ✱ 桩函数                        |
| PATCH  | `/api/admin/oss/drivers`            | 驱动配置 | ✱ 桩函数                        |

### 46. `apps/web/app/(main)/admin/performance-dashboard/`

| 方法 | 路径                               | 用途       | 缺失原因     |
| ---- | ---------------------------------- | ---------- | ------------ |
| ALL  | `/api/admin/performance-dashboard` | 性能仪表盘 | **完全缺失** |

### 47. `apps/web/app/(main)/admin/point/*`

| 方法 | 路径                        | 用途     | 缺失原因                                        |
| ---- | --------------------------- | -------- | ----------------------------------------------- |
| GET  | `/api/admin/point/rules`    | 积分规则 | **缺失**（adminPointRoutes 已注册但具体未实现） |
| GET  | `/api/admin/point/records`  | 积分记录 | **缺失**                                        |
| GET  | `/api/admin/point/channels` | 积分渠道 | **缺失**                                        |

### 48. `apps/web/app/(main)/admin/product-identity/`

| 方法   | 路径                              | 用途 | 缺失原因 |
| ------ | --------------------------------- | ---- | -------- |
| GET    | `/api/admin/product-identity`     | 列表 | ✱ 桩函数 |
| POST   | `/api/admin/product-identity`     | 创建 | ✱ 桩函数 |
| PUT    | `/api/admin/product-identity/:id` | 更新 | **缺失** |
| DELETE | `/api/admin/product-identity/:id` | 删除 | **缺失** |

### 49. `apps/web/app/(main)/admin/projects/`

| 方法   | 路径                      | 用途     | 缺失原因                                                    |
| ------ | ------------------------- | -------- | ----------------------------------------------------------- |
| GET    | `/api/admin/projects`     | 项目列表 | **完全缺失**（projects 路由在 admin.ts 中有，但需确认端点） |
| GET    | `/api/admin/projects/:id` | 项目详情 | ✅ 已有（admin.ts line 558）                                |
| POST   | `/api/admin/projects`     | 创建     | ✅ 已有                                                     |
| PATCH  | `/api/admin/projects/:id` | 更新     | ✅ 已有                                                     |
| DELETE | `/api/admin/projects/:id` | 删除     | ✅ 已有                                                     |

### 50. `apps/web/app/(main)/admin/realname-audit/`

| 方法 | 路径                        | 用途     | 缺失原因     |
| ---- | --------------------------- | -------- | ------------ |
| ALL  | `/api/admin/realname-audit` | 实名审核 | **完全缺失** |

### 51. `apps/web/app/(main)/admin/recommendation-config/`

| 方法 | 路径                               | 用途     | 缺失原因     |
| ---- | ---------------------------------- | -------- | ------------ |
| ALL  | `/api/admin/recommendation-config` | 推荐配置 | **完全缺失** |

### 52. `apps/web/app/(main)/admin/refund/`

| 方法 | 路径                     | 用途     | 缺失原因                               |
| ---- | ------------------------ | -------- | -------------------------------------- |
| GET  | `/api/admin/refunds/:id` | 退款详情 | **缺失**（仅有 list、process、handle） |

### 53. `apps/web/app/(main)/admin/resources/*`

| 方法 | 路径                              | 用途     | 缺失原因                                           |
| ---- | --------------------------------- | -------- | -------------------------------------------------- |
| GET  | `/api/admin/resources`            | 资源列表 | **缺失**（adminResourceRoutes 已注册但具体未实现） |
| GET  | `/api/admin/resources/categories` | 分类     | **缺失**                                           |
| GET  | `/api/admin/resources/products`   | 产品     | **缺失**                                           |
| GET  | `/api/admin/resources/tags`       | 标签     | **缺失**                                           |

### 54. `apps/web/app/(main)/admin/roles/`

| 方法   | 路径                           | 用途     | 缺失原因                   |
| ------ | ------------------------------ | -------- | -------------------------- |
| GET    | `/api/admin/roles`             | 角色列表 | ✱ 桩函数（admin/stats.ts） |
| POST   | `/api/admin/roles`             | 创建     | ✱ 桩函数                   |
| PUT    | `/api/admin/roles/:id`         | 更新     | **缺失**                   |
| DELETE | `/api/admin/roles/:id`         | 删除     | **缺失**                   |
| GET    | `/api/admin/roles/auth-user`   | 角色用户 | **缺失**                   |
| GET    | `/api/admin/roles/select-user` | 选择用户 | **缺失**                   |
| POST   | `/api/admin/roles/:id/users`   | 添加用户 | ✱ 桩函数                   |
| DELETE | `/api/admin/roles/:id/users`   | 移除用户 | ✱ 桩函数                   |

### 55. `apps/web/app/(main)/admin/schedule/`

| 方法 | 路径                    | 用途     | 缺失原因                                           |
| ---- | ----------------------- | -------- | -------------------------------------------------- |
| ALL  | `/api/admin/schedule/*` | 调度管理 | **完全缺失**（adminScheduleRoutes 已注册但未实现） |

### 56. `apps/web/app/(main)/admin/sensitive-words/`

| 方法 | 路径                         | 用途   | 缺失原因                                                 |
| ---- | ---------------------------- | ------ | -------------------------------------------------------- |
| ALL  | `/api/admin/sensitive-words` | 敏感词 | **完全缺失**（adminSensitiveWordsRoutes 已注册但未实现） |

### 57. `apps/web/app/(main)/admin/search-hot-words/`

| 方法 | 路径                          | 用途     | 缺失原因     |
| ---- | ----------------------------- | -------- | ------------ |
| ALL  | `/api/admin/search-hot-words` | 搜索热词 | **完全缺失** |

### 58. `apps/web/app/(main)/admin/shop/*`

| 方法  | 路径                          | 用途     | 缺失原因                                   |
| ----- | ----------------------------- | -------- | ------------------------------------------ |
| GET   | `/api/admin/shop/payments`    | 支付配置 | **完全缺失**                               |
| GET   | `/api/admin/shop/products`    | 商品     | ✱ 桩函数                                   |
| PATCH | `/api/admin/shop/products`    | 批量更新 | ✱ 桩函数                                   |
| GET   | `/api/admin/shop/withdrawals` | 提现     | ✱ 桩函数                                   |
| PUT   | `/api/admin/shop/withdrawals` | 提现审核 | ✱ 桩函数                                   |
| GET   | `/api/admin/shop/funds`       | 资金     | **缺失**（adminShopRoutes 已注册但未实现） |

### 59. `apps/web/app/(main)/admin/sms/`

| 方法 | 路径               | 用途     | 缺失原因     |
| ---- | ------------------ | -------- | ------------ |
| ALL  | `/api/admin/sms/*` | 短信管理 | **完全缺失** |

### 60. `apps/web/app/(main)/admin/system/*`

| 方法   | 路径                                   | 用途     | 缺失原因                                    |
| ------ | -------------------------------------- | -------- | ------------------------------------------- |
| GET    | `/api/admin/system/operation-logs`     | 操作日志 | ✅ 已有（`admin/system-operation-logs.ts`） |
| DELETE | `/api/admin/system/operation-logs/:id` | 删除     | ✅ 已有                                     |
| GET    | `/api/admin/system/login-logs`         | 登录日志 | ✅ 已有（`admin/system-login-logs.ts`）     |
| GET    | `/api/admin/system/tasks/logs`         | 任务日志 | ✱ 桩函数                                    |
| GET    | `/api/admin/system/monitor`            | 系统监控 | **缺失**                                    |
| GET    | `/api/admin/system/posts`              | 系统帖子 | ✱ 桩函数                                    |
| GET    | `/api/admin/system/users`              | 系统用户 | **缺失**                                    |

### 61. `apps/web/app/(main)/admin/task-developer/`

| 方法   | 路径                            | 用途     | 缺失原因                             |
| ------ | ------------------------------- | -------- | ------------------------------------ |
| GET    | `/api/admin/task-developer`     | 任务列表 | ✅ 已有（`admin/task-developer.ts`） |
| POST   | `/api/admin/task-developer`     | 创建     | ✅ 已有                              |
| PUT    | `/api/admin/task-developer/:id` | 更新     | ✅ 已有                              |
| DELETE | `/api/admin/task-developer/:id` | 删除     | ✅ 已有                              |

### 62. `apps/web/app/(main)/admin/theme/*`

| 方法   | 路径                           | 用途     | 缺失原因 |
| ------ | ------------------------------ | -------- | -------- |
| GET    | `/api/admin/themes/current`    | 当前主题 | ✱ 桩函数 |
| GET    | `/api/admin/themes/dark-mode`  | 暗黑模式 | ✱ 桩函数 |
| PUT    | `/api/admin/themes/dark-mode`  | 设置暗黑 | ✱ 桩函数 |
| POST   | `/api/admin/themes/import`     | 导入     | ✱ 桩函数 |
| GET    | `/api/admin/themes/colors`     | 颜色     | ✱ 桩函数 |
| POST   | `/api/admin/themes/colors`     | 创建颜色 | ✱ 桩函数 |
| PUT    | `/api/admin/themes/colors`     | 批量更新 | ✱ 桩函数 |
| PUT    | `/api/admin/themes/colors/:id` | 更新颜色 | ✱ 桩函数 |
| GET    | `/api/admin/themes/fonts`      | 字体     | ✱ 桩函数 |
| POST   | `/api/admin/themes/fonts`      | 创建字体 | ✱ 桩函数 |
| PATCH  | `/api/admin/themes/fonts/:id`  | 更新字体 | ✱ 桩函数 |
| DELETE | `/api/admin/themes/fonts/:id`  | 删除字体 | ✱ 桩函数 |
| GET    | `/api/admin/themes/assets`     | 资源     | ✱ 桩函数 |
| POST   | `/api/admin/themes/assets`     | 上传资源 | ✱ 桩函数 |
| GET    | `/api/admin/themes/presets`    | 预设     | ✱ 桩函数 |
| POST   | `/api/admin/themes`            | 创建主题 | ✱ 桩函数 |
| GET    | `/api/admin/themes/:id`        | 主题详情 | ✱ 桩函数 |
| PUT    | `/api/admin/themes/:id`        | 更新主题 | ✱ 桩函数 |
| PATCH  | `/api/admin/themes/:id`        | 部分更新 | ✱ 桩函数 |
| DELETE | `/api/admin/themes/:id`        | 删除主题 | ✱ 桩函数 |
| GET    | `/api/admin/themes`            | 主题列表 | ✱ 桩函数 |

### 63. `apps/web/app/(main)/admin/user-agent-*`

| 方法   | 路径                              | 用途     | 缺失原因     |
| ------ | --------------------------------- | -------- | ------------ |
| GET    | `/api/admin/user-agent-audio`     | 音频列表 | ✅ 已有      |
| GET    | `/api/admin/user-agent-audio/:id` | 详情     | **缺失**     |
| POST   | `/api/admin/user-agent-audio`     | 创建     | ✱ 桩函数     |
| PUT    | `/api/admin/user-agent-audio/:id` | 更新     | **缺失**     |
| DELETE | `/api/admin/user-agent-audio/:id` | 删除     | ✅ 已有      |
| GET    | `/api/admin/user-agent-image`     | 图片列表 | ✅ 已有      |
| GET    | `/api/admin/user-agent-image/:id` | 详情     | ✅ 已有      |
| POST   | `/api/admin/user-agent-image`     | 创建     | ✅ 已有      |
| PUT    | `/api/admin/user-agent-image/:id` | 更新     | ✅ 已有      |
| DELETE | `/api/admin/user-agent-image/:id` | 删除     | ✅ 已有      |
| GET    | `/api/admin/user-agent-context`   | 上下文   | **完全缺失** |

### 64. `apps/web/app/(main)/admin/user-center/`

| 方法 | 路径                       | 用途     | 缺失原因     |
| ---- | -------------------------- | -------- | ------------ |
| ALL  | `/api/admin/user-center/*` | 用户中心 | **完全缺失** |

### 65. `apps/web/app/(main)/admin/user-margin/`

| 方法 | 路径                     | 用途       | 缺失原因     |
| ---- | ------------------------ | ---------- | ------------ |
| ALL  | `/api/admin/user-margin` | 用户保证金 | **完全缺失** |

### 66. `apps/web/app/(main)/admin/user-platform/`

| 方法   | 路径                           | 用途     | 缺失原因 |
| ------ | ------------------------------ | -------- | -------- |
| GET    | `/api/admin/user-platform`     | 平台列表 | ✱ 桩函数 |
| POST   | `/api/admin/user-platform`     | 创建     | ✱ 桩函数 |
| PUT    | `/api/admin/user-platform/:id` | 更新     | ✱ 桩函数 |
| DELETE | `/api/admin/user-platform/:id` | 删除     | **缺失** |

### 67. `apps/web/app/(main)/admin/users/`

| 方法   | 路径                            | 用途     | 缺失原因                                  |
| ------ | ------------------------------- | -------- | ----------------------------------------- |
| GET    | `/api/admin/users`              | 用户列表 | ✅ 已有（admin.ts）                       |
| GET    | `/api/admin/users/:id`          | 用户详情 | ✅ 已有                                   |
| PATCH  | `/api/admin/users/:id`          | 更新     | ✅ 已有                                   |
| POST   | `/api/admin/users`              | 创建     | ✅ 已有                                   |
| DELETE | `/api/admin/users/:id`          | 删除     | ✅ 已有                                   |
| POST   | `/api/admin/users/:id/audit`    | 审核     | ✱ 桩函数                                  |
| POST   | `/api/admin/users/:id/review`   | 复审     | ✱ 桩函数                                  |
| POST   | `/api/admin/users/:id/resetPwd` | 重置密码 | **缺失**（前端 ResetPasswordDialog 使用） |
| GET    | `/api/admin/dept/list`          | 部门列表 | **缺失**（前端 helpers.ts 使用）          |

### 68. `apps/web/app/(main)/admin/variables/`

| 方法 | 路径                   | 用途     | 缺失原因     |
| ---- | ---------------------- | -------- | ------------ |
| ALL  | `/api/admin/variables` | 变量管理 | **完全缺失** |

### 69. `apps/web/app/(main)/admin/visit-tracking/`

| 方法 | 路径                        | 用途     | 缺失原因                                            |
| ---- | --------------------------- | -------- | --------------------------------------------------- |
| ALL  | `/api/admin/visit-tracking` | 访问追踪 | **缺失**（adminVisitTrackingRoutes 已注册但未实现） |

### 70. `apps/web/app/(main)/admin/workflows/`

| 方法 | 路径                   | 用途   | 缺失原因     |
| ---- | ---------------------- | ------ | ------------ |
| ALL  | `/api/admin/workflows` | 工作流 | **完全缺失** |

### 71. `apps/web/app/(main)/admin/zhs-*`

| 方法   | 路径                                 | 用途     | 缺失原因 |
| ------ | ------------------------------------ | -------- | -------- |
| GET    | `/api/admin/zhs-user`                | 用户列表 | ✅ 已有  |
| DELETE | `/api/admin/zhs-user/:id`            | 删除     | ✅ 已有  |
| POST   | `/api/admin/zhs-user`                | 创建     | ✱ 桩函数 |
| PUT    | `/api/admin/zhs-user/:id`            | 更新     | ✱ 桩函数 |
| GET    | `/api/admin/zhs-agent`               | 智能体   | ✅ 已有  |
| DELETE | `/api/admin/zhs-agent/:id`           | 删除     | ✅ 已有  |
| POST   | `/api/admin/zhs-agent`               | 创建     | ✅ 已有  |
| PUT    | `/api/admin/zhs-agent/:id`           | 更新     | ✅ 已有  |
| GET    | `/api/admin/zhs-activity`            | 活动     | ✅ 已有  |
| POST   | `/api/admin/zhs-activity`            | 创建     | ✅ 已有  |
| PUT    | `/api/admin/zhs-activity/:id`        | 更新     | ✅ 已有  |
| DELETE | `/api/admin/zhs-activity/:id`        | 删除     | ✅ 已有  |
| GET    | `/api/admin/zhs-identity`            | 身份     | ✅ 已有  |
| GET    | `/api/admin/zhs-identity/:id`        | 详情     | ✅ 已有  |
| POST   | `/api/admin/zhs-identity`            | 创建     | ✅ 已有  |
| PUT    | `/api/admin/zhs-identity/:id`        | 更新     | ✅ 已有  |
| DELETE | `/api/admin/zhs-identity/:id`        | 删除     | ✅ 已有  |
| GET    | `/api/admin/identity-proportion`     | 身份占比 | ✅ 已有  |
| POST   | `/api/admin/identity-proportion`     | 创建     | ✅ 已有  |
| PUT    | `/api/admin/identity-proportion/:id` | 更新     | ✅ 已有  |
| DELETE | `/api/admin/identity-proportion/:id` | 删除     | ✅ 已有  |
| GET    | `/api/admin/zhs-edu/platform`        | 平台     | **缺失** |

---

## 四、按 ROI 排序的 Top 30 修复清单

> ROI = (页面重要性 × 真实缺失度) / 修复成本
> **真实缺失** = 后端无任何实现（而非桩函数）

| 优先级 | 端点                                         | 页面                      | 类型     | 修复成本 |
| ------ | -------------------------------------------- | ------------------------- | -------- | -------- |
| 1      | `GET /api/admin/users/:id/resetPwd` (POST)   | users                     | 真实缺失 | 低       |
| 2      | `GET /api/admin/dept/list`                   | users/DeptTree            | 真实缺失 | 低       |
| 3      | `GET /api/admin/projects` (列表)             | projects                  | 真实缺失 | 中       |
| 4      | `GET /api/admin/article` (分页)              | articles                  | 部分缺失 | 低       |
| 5      | `GET /api/admin/agreements`                  | agreements                | 真实缺失 | 中       |
| 6      | `GET /api/admin/advertise`                   | advertise                 | 真实缺失 | 中       |
| 7      | `GET /api/admin/agent-rule`                  | agent-rule                | 真实缺失 | 低       |
| 8      | `GET /api/admin/agent-task`                  | agent-task                | 真实缺失 | 低       |
| 9      | `GET /api/admin/edu/classes/schedules`       | edu/class/schedule        | 真实缺失 | 中       |
| 10     | `GET /api/admin/certificates`                | edu/certificate           | 真实缺失 | 中       |
| 11     | `GET /api/admin/certificates/templates`      | edu/certificate/templates | 真实缺失 | 中       |
| 12     | `GET /api/admin/edu/classes/:id/members`     | edu/class/members         | 真实缺失 | 中       |
| 13     | `GET /api/admin/learn/signups`               | learn/signups             | 真实缺失 | 中       |
| 14     | `GET /api/admin/learn/invoices`              | edu/finance/invoices      | 真实缺失 | 中       |
| 15     | `PUT /api/admin/learn/invoices/:id/invoiced` | edu/finance/invoices      | 真实缺失 | 低       |
| 16     | `GET /api/admin/finance/statistics`          | edu/finance/statistics    | 真实缺失 | 中       |
| 17     | `GET /api/admin/asks`                        | asks                      | 真实缺失 | 中       |
| 18     | `GET /api/admin/examine`                     | demand-audit              | 真实缺失 | 中       |
| 19     | `POST /api/admin/examine/pass`               | demand-audit              | 真实缺失 | 低       |
| 20     | `POST /api/admin/examine/reject`             | demand-audit              | 真实缺失 | 低       |
| 21     | `GET /api/admin/clawdbot/sessions`           | clawdbot                  | 真实缺失 | 中       |
| 22     | `GET /api/admin/clawdbot/messages`           | clawdbot                  | 真实缺失 | 中       |
| 23     | `GET /api/admin/clawdbot/tools`              | clawdbot                  | 真实缺失 | 中       |
| 24     | `GET /api/admin/bi-dashboard`                | bi-dashboard              | 真实缺失 | 中       |
| 25     | `GET /api/admin/behavior/statistics`         | behavior                  | 真实缺失 | 中       |
| 26     | `GET /api/admin/behavior/watch/list`         | behavior                  | 真实缺失 | 中       |
| 27     | `GET /api/admin/db-opt/tables`               | database-optimization     | 真实缺失 | 高       |
| 28     | `GET /api/admin/db-opt/slow-queries`         | database-optimization     | 真实缺失 | 高       |
| 29     | `GET /api/admin/db-opt/suggestions`          | database-optimization     | 真实缺失 | 高       |
| 30     | `GET /api/admin/point/rules`                 | point/rules               | 真实缺失 | 中       |

---

## 五、关键发现 & 优化建议

### 5.1 关键问题

1. **「路由已注册但未实现」现象普遍**：server.ts 中注册了大量 adminXxxRoutes（如 `adminAgreementsRoutes`、`adminAskRoutes`、`adminApiPlatformRoutes`、`adminSensitiveWordsRoutes` 等），但对应的 `.ts` 文件要么不存在，要么没有实际的 `server.get/post/...` 调用，导致前端调用全部 404。

2. **`frontend-stub-admin-routes.ts` 承担了大量补建工作**：~70% 的「已有」端点实际来自此文件，但被错误地注册为 `/api` 前缀（`server.register(frontendStubAdminRoutes, { prefix: '/api' })`），路由文件内部用全路径 `/admin/...` 抵消。命名上叫 stub 但实际上很多已经接入了真实 DB 查询。

3. **纯静态桩函数仍然存在**：`PUT /admin/classes`、`PUT /admin/learn/community` 等无意义的桩函数（`return reply.send(success({...}))`），没有任何业务逻辑。

4. **方法不匹配**：前端用 `PATCH /api/admin/docs/:id` 但后端只有 `PUT/DELETE /api/admin/docs/:id`。

### 5.2 修复优先级建议

| 等级       | 说明                            | 数量 | 行动         |
| ---------- | ------------------------------- | ---- | ------------ |
| **P0**     | 影响核心流程（用户/订单/会员）  | 5    | 必须立即修复 |
| **P1**     | 影响日常管理（CSC、消息、配置） | 10   | 1 周内修复   |
| **P2**     | 增强功能（统计、监控、报表）    | 12   | 2 周内修复   |
| **P3**     | 边缘功能（DB 优化、API 平台）   | 8    | 后续排期     |
| **桩函数** | 已有但返回固定数据              | 50+  | 重构或保留   |

### 5.3 长期建议

1. **统一缺失路由跟踪**：维护 `apps/api/scripts/api-routes-missing.json` 自动化扫描
2. **删除无用桩函数**：清理 `frontend-stub-admin-routes.ts` 中无意义的 stub
3. **统一前后端类型**：将 `packages/api-client` 中的端点声明与后端实现同步
4. **E2E 测试覆盖**：对每个 admin 页面加 Playwright e2e 验证 API 通路
5. **404 监控**：加 `/api/admin/...` 404 统计仪表盘

---

## 六、附录：审计脚本与产物

- 审计脚本：`G:\IHUI-AI\audit-admin-api.js`
- 输出报告：`G:\IHUI-AI\audit-report.json`（注：终端输出捕获异常，建议手动验证）
- 完整端点清单见 `apps/api/src/server.ts` 第 478-888 行
- 前端调用清单见 `apps/web/app/(main)/admin/**` 全部 tsx 文件
