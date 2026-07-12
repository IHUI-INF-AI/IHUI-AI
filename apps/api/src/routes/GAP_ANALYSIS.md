# 前后端 API 路由缺口分析

> 基于 `MISSING_ROUTES_AUDIT.md`（前端调用）与 `EXISTING_ROUTES_AUDIT.md`（后端实现）对比生成
> 生成时间：2026-07-12
> 范围：仅 `/api/admin/*` 路径，忽略 `/api/auth/*`（已实现）和其他前缀

---

## 统计

| 指标             | 数值      |
| ---------------- | --------- |
| 前端调用路径数   | 170       |
| 后端已实现路径数 | ~420      |
| **完全缺失**     | **75 个** |
| **命名不一致**   | **12 个** |
| **前缀不一致**   | **25 个** |
| 已正常匹配       | 58 个     |

---

## 1. 完全缺失（前端调用但后端未实现）

### 内容运营模块（17 个）

| 前端路径                         | 前端调用文件                         | 建议的后端路由文件                    |
| -------------------------------- | ------------------------------------ | ------------------------------------- |
| /api/admin/about-us              | admin/about-us/page.tsx              | routes/admin-about-us.ts              |
| /api/admin/advertise             | admin/advertise/page.tsx             | routes/admin-advertise.ts             |
| /api/admin/ai-gc                 | admin/ai-gc/page.tsx                 | routes/admin-ai-gc.ts                 |
| /api/admin/carousel              | admin/carousel/page.tsx              | routes/admin-carousel.ts              |
| /api/admin/comment-logs          | admin/comment-logs/page.tsx          | routes/admin-comment-logs.ts          |
| /api/admin/contact               | admin/contact/page.tsx               | routes/admin-contact.ts               |
| /api/admin/identity-proportion   | admin/identity-proportion/page.tsx   | routes/admin-identity-proportion.ts   |
| /api/admin/mobile-adapter        | admin/mobile-adapter/page.tsx        | routes/admin-mobile-adapter.ts        |
| /api/admin/mobile-adapter/mode   | admin/mobile-adapter/page.tsx        | routes/admin-mobile-adapter.ts        |
| /api/admin/news/information      | admin/news/information/page.tsx      | routes/admin-news.ts（扩展）          |
| /api/admin/recommendation-config | admin/recommendation-config/page.tsx | routes/admin-recommendation-config.ts |
| /api/admin/task-developer        | admin/task-developer/page.tsx        | routes/admin-task-developer.ts        |
| /api/admin/video-logs            | admin/video-logs/page.tsx            | routes/admin-video-logs.ts            |
| /api/admin/zhs-activity          | admin/zhs-activity/page.tsx          | routes/admin-zhs-activity.ts          |
| /api/admin/zhs-agent             | admin/zhs-agent/page.tsx             | routes/admin-zhs-agent.ts             |
| /api/admin/zhs-identity          | admin/zhs-identity/page.tsx          | routes/admin-zhs-identity.ts          |
| /api/admin/zhs-user              | admin/zhs-user/page.tsx              | routes/admin-zhs-user.ts              |

### 鉴权 / 用户管理模块（18 个）

| 前端路径                         | 前端调用文件                         | 建议的后端路由文件                 |
| -------------------------------- | ------------------------------------ | ---------------------------------- |
| /api/admin/auth-accounts         | admin/auth-accounts/page.tsx         | routes/admin-auth-accounts.ts      |
| /api/admin/auth-find-info        | admin/auth-find-info/page.tsx        | routes/admin-auth-find-info.ts     |
| /api/admin/auth-info             | admin/auth-info/page.tsx             | routes/admin-auth-info.ts          |
| /api/admin/auth-role             | admin/auth-role/page.tsx             | routes/admin-auth-role.ts          |
| /api/admin/auth-sms-temp         | admin/auth-sms-temp/page.tsx         | routes/admin-auth-sms-temp.ts      |
| /api/admin/auth-tokens           | admin/auth-tokens/page.tsx           | routes/admin-auth-tokens.ts        |
| /api/admin/auth-user-margin      | admin/auth-user-margin/page.tsx      | routes/admin-auth-user-margin.ts   |
| /api/admin/auth-user-vip         | admin/auth-user-vip/page.tsx         | routes/admin-auth-user-vip.ts      |
| /api/admin/auth-veri-codes       | admin/auth-veri-codes/page.tsx       | routes/admin-auth-veri-codes.ts    |
| /api/admin/auth-vip-level        | admin/auth-vip-level/page.tsx        | routes/admin-auth-vip-level.ts     |
| /api/admin/member/blacklist      | admin/member/blacklist/page.tsx      | routes/admin-member-blacklist.ts   |
| /api/admin/member/permissions    | admin/member/permissions/page.tsx    | routes/admin-member-permissions.ts |
| /api/admin/system/login-logs     | admin/system/login-logs/page.tsx     | routes/admin-system-logs.ts        |
| /api/admin/system/operation-logs | admin/system/operation-logs/page.tsx | routes/admin-system-logs.ts        |
| /api/admin/user-agent-audio      | admin/user-agent-audio/page.tsx      | routes/admin-user-agent-audio.ts   |
| /api/admin/user-agent-image      | admin/user-agent-image/page.tsx      | routes/admin-user-agent-image.ts   |
| /api/admin/user-roles            | admin/user-roles/page.tsx            | routes/admin-user-roles.ts         |
| /api/admin/users/course-users    | admin/users/course-users/page.tsx    | routes/admin-users-course.ts       |

### 教务 / 课程模块（8 个）

| 前端路径                         | 前端调用文件                         | 建议的后端路由文件                              |
| -------------------------------- | ------------------------------------ | ----------------------------------------------- |
| /api/admin/courses               | admin/courses/page.tsx               | routes/admin-courses.ts                         |
| /api/admin/edu/classes           | admin/edu/classes/page.tsx           | routes/admin-edu-classes.ts                     |
| /api/admin/edu/classes/schedules | admin/edu/classes/schedules/page.tsx | routes/admin-edu-classes.ts（扩展）             |
| /api/admin/finance/statistics    | admin/finance/statistics/page.tsx    | routes/admin-finance-stats.ts                   |
| /api/admin/learn/homework        | admin/learn/homework/page.tsx        | routes/admin-learn.ts（扩展 homework 列表端点） |
| /api/admin/learn/materials       | admin/learn/materials/page.tsx       | routes/admin-learn-materials.ts                 |
| /api/admin/learn/plans           | admin/learn/plans/page.tsx           | routes/admin-learn-plans.ts                     |
| /api/admin/learn/reminds         | admin/learn/reminds/page.tsx         | routes/admin-learn-reminds.ts                   |

### 平台 / API 管理模块（9 个）

| 前端路径                     | 前端调用文件                  | 建议的后端路由文件                     |
| ---------------------------- | ----------------------------- | -------------------------------------- |
| /api/admin/api-groups        | admin/api-groups/page.tsx     | routes/admin-api-groups.ts             |
| /api/admin/api-usage/day     | admin/api-usage/page.tsx      | routes/admin-api-usage.ts              |
| /api/admin/api-usage/stats   | admin/api-usage/page.tsx      | routes/admin-api-usage.ts              |
| /api/admin/api-usage/top     | admin/api-usage/page.tsx      | routes/admin-api-usage.ts              |
| /api/admin/developer/coze    | admin/developer/coze/page.tsx | routes/admin-developer-coze.ts         |
| /api/admin/developer-link    | admin/developer-link/page.tsx | routes/admin-developer-link.ts         |
| /api/admin/oauth/apps        | admin/oauth/apps/page.tsx     | routes/admin-oauth-apps.ts             |
| /api/admin/oauth-audit/stats | admin/oauth-audit/page.tsx    | routes/admin-oauth-audit.ts            |
| /api/admin/oss/files         | admin/oss/files/page.tsx      | routes/admin-oss.ts（扩展 files 端点） |

### 监控 / 运维模块（17 个）

| 前端路径                                   | 前端调用文件                         | 建议的后端路由文件                         |
| ------------------------------------------ | ------------------------------------ | ------------------------------------------ |
| /api/admin/backend-health/events           | admin/backend-health/page.tsx        | routes/admin-backend-health.ts             |
| /api/admin/db-opt/slow-queries             | admin/db-opt/page.tsx                | routes/admin-db-opt.ts                     |
| /api/admin/db-opt/suggestions              | admin/db-opt/page.tsx                | routes/admin-db-opt.ts                     |
| /api/admin/db-opt/tables                   | admin/db-opt/page.tsx                | routes/admin-db-opt.ts                     |
| /api/admin/event-bus/events                | admin/event-bus/page.tsx             | routes/admin-event-bus.ts                  |
| /api/admin/event-bus/stats                 | admin/event-bus/page.tsx             | routes/admin-event-bus.ts                  |
| /api/admin/monitor/alert-rules             | admin/monitor/page.tsx               | routes/admin-monitor.ts                    |
| /api/admin/monitor/perf                    | admin/monitor/page.tsx               | routes/admin-monitor.ts                    |
| /api/admin/monitor/services                | admin/monitor/page.tsx               | routes/admin-monitor.ts                    |
| /api/admin/monitoring/logs                 | admin/monitoring/page.tsx            | routes/admin-monitoring.ts                 |
| /api/admin/monitoring/perf                 | admin/monitoring/page.tsx            | routes/admin-monitoring.ts                 |
| /api/admin/monitoring/services             | admin/monitoring/page.tsx            | routes/admin-monitoring.ts                 |
| /api/admin/performance-dashboard/endpoints | admin/performance-dashboard/page.tsx | routes/admin-performance-dashboard.ts      |
| /api/admin/performance-dashboard/stats     | admin/performance-dashboard/page.tsx | routes/admin-performance-dashboard.ts      |
| /api/admin/stats                           | admin/stats/page.tsx                 | routes/admin-stats.ts（扩展 summary 端点） |
| /api/admin/system/monitor/metrics          | admin/system/monitor/page.tsx        | routes/admin-system-monitor.ts             |
| /api/admin/system/monitor/services         | admin/system/monitor/page.tsx        | routes/admin-system-monitor.ts             |

### 商城模块（4 个）

| 前端路径                        | 前端调用文件                        | 建议的后端路由文件              |
| ------------------------------- | ----------------------------------- | ------------------------------- |
| /api/admin/shop/funds/accounts  | admin/shop/funds/page.tsx           | routes/admin-shop-funds.ts      |
| /api/admin/shop/products        | admin/shop/products/page.tsx        | routes/admin-shop-products.ts   |
| /api/admin/shop/withdrawal-flow | admin/shop/withdrawal-flow/page.tsx | routes/admin-shop-withdrawal.ts |
| /api/admin/shop/withdrawals     | admin/shop/withdrawals/page.tsx     | routes/admin-shop-withdrawal.ts |

### 相对路径模块（2 个）

> 以下路径来自 `lib/admin-api.ts` 的相对路径，baseURL 推断为 `/api`

| 前端路径              | 前端调用文件         | 建议的后端路由文件         |
| --------------------- | -------------------- | -------------------------- |
| /api/admin/products   | src/lib/admin-api.ts | routes/admin-products.ts   |
| /api/admin/statistics | src/lib/admin-api.ts | routes/admin-statistics.ts |

---

## 2. 命名不一致（前端调用 X，后端实现 Y）

> 后端在 `/api/admin/` 下有对应实现，但路径命名风格不同

| 前端路径                        | 后端路径                         | 说明                             |
| ------------------------------- | -------------------------------- | -------------------------------- |
| /api/admin/message-templates    | /api/admin/messages/template     | 复合词 vs 嵌套路径               |
| /api/admin/auth-dept            | /api/admin/dept                  | 多余 auth- 前缀                  |
| /api/admin/login-logs           | /api/admin/logininfor            | 连字符 vs 无分隔符（logininfor） |
| /api/admin/member/company-types | /api/admin/members/company-types | member（单数）vs members（复数） |
| /api/admin/member/users         | /api/admin/members/users         | member（单数）vs members（复数） |
| /api/admin/system/tasks/logs    | /api/admin/job/log               | system/tasks vs job              |
| /api/admin/user-center          | /api/admin/usercenter            | 连字符 vs 驼峰（usercenter）     |
| /api/admin/user-dept            | /api/admin/dept                  | 多余 user- 前缀                  |
| /api/admin/user-vip             | /api/admin/vip/users             | user-vip vs vip/users            |
| /api/admin/member-levels        | /api/admin/members/levels        | member（单数）vs members（复数） |
| /api/admin/system/config        | /api/admin/config                | 多余 system/ 前缀                |
| /api/admin/system/posts         | /api/admin/post                  | system/posts vs post（单数）     |

---

## 3. 前缀不一致

> 后端有对应实现，但路径前缀不是 `/api/admin/`，而在其他前缀下

| 前端路径                       | 后端路径                            | 说明                                               |
| ------------------------------ | ----------------------------------- | -------------------------------------------------- |
| /api/admin/examine             | /api/examine                        | 后端在 /api 下而非 /api/admin                      |
| /api/admin/examine/pass        | /api/examine/:recordId/approve      | 前缀+动作命名差异                                  |
| /api/admin/examine/reject      | /api/examine/:recordId/reject       | 前缀差异                                           |
| /api/admin/product-identity    | /api/product-identity               | 后端在 /api 下                                     |
| /api/admin/user-agent-context  | /api/misc-ext/user-agent-context    | 后端在 /api/misc-ext 下                            |
| /api/admin/category-dictionary | /api/system-ext/category-dictionary | 后端在 /api/system-ext 下                          |
| /api/admin/course              | /api/course                         | 后端在 /api 下（zhs-course.ts）                    |
| /api/admin/course-audit        | /api/course-audit                   | 后端在 /api 下（edu-extended.ts）                  |
| /api/admin/course-pay          | /api/course/pay                     | 后端在 /api/course 下                              |
| /api/admin/course-pay-log      | /api/course/pay-logs                | 前缀+命名差异（pay-log vs pay-logs）               |
| /api/admin/course-platform-log | /api/course/platform-logs           | 前缀+命名差异                                      |
| /api/admin/course-video        | /api/course/videos                  | 前缀+命名差异（video vs videos）                   |
| /api/admin/course-videos       | /api/course/videos                  | 前缀差异                                           |
| /api/admin/education-platform  | /api/education-platform             | 后端在 /api 下                                     |
| /api/admin/organization        | /api/organizations                  | 前缀+命名差异（organization vs organizations）     |
| /api/admin/user-platform       | /api/course/user-platform           | 后端在 /api/course 下                              |
| /api/admin/developer/keys      | /api/developer/api-keys             | 前缀+命名差异（keys vs api-keys）                  |
| /api/admin/developer/sdks      | /api/sdks                           | 后端在 /api 下                                     |
| /api/admin/developer/webhooks  | /api/developer/webhooks             | 后端在 /api/developer 下                           |
| /api/admin/users               | /api/users                          | 后端在 /api 下（另有 /api/admin/usercenter/users） |
| /api/admin/refunds/stats       | /api/refunds/stats                  | 后端在 /api 下                                     |
| /api/admin/realname-audit      | /api/auth/realname                  | 后端在 /api/auth 下                                |
| /api/admin/behavior/statistics | /api/behavior/statistics            | 后端在 /api 下                                     |
| /api/admin/monitor/alerts      | /api/monitor/alerts                 | 后端在 /api 下                                     |
| /api/admin/monitoring/alerts   | /api/monitor/alerts                 | 前缀+命名差异（monitoring vs monitor）             |

---

## 4. 建议补建优先级

### P0（影响核心功能 — 鉴权 / 用户 / 系统管理）

> 涉及登录安全、用户管理、权限控制，缺失会导致管理后台核心功能不可用

| 路径                                           | 模块       | 说明                                             |
| ---------------------------------------------- | ---------- | ------------------------------------------------ |
| /api/admin/auth-accounts                       | 鉴权       | 第三方账号管理                                   |
| /api/admin/auth-role                           | 鉴权       | 角色管理（后端仅有 /api/admin/rbac，命名不匹配） |
| /api/admin/auth-tokens                         | 鉴权       | Token 管理                                       |
| /api/admin/auth-info                           | 鉴权       | 认证信息                                         |
| /api/admin/auth-find-info                      | 鉴权       | 找回信息                                         |
| /api/admin/auth-user-vip                       | 鉴权       | 用户 VIP                                         |
| /api/admin/auth-user-margin                    | 鉴权       | 用户保证金                                       |
| /api/admin/auth-vip-level                      | 鉴权       | VIP 等级                                         |
| /api/admin/auth-sms-temp                       | 鉴权       | 短信模板                                         |
| /api/admin/auth-veri-codes                     | 鉴权       | 验证码                                           |
| /api/admin/user-roles                          | 用户       | 用户角色关联                                     |
| /api/admin/users/course-users                  | 用户       | 课程用户                                         |
| /api/admin/member/blacklist                    | 用户       | 会员黑名单                                       |
| /api/admin/member/permissions                  | 用户       | 会员权限                                         |
| /api/admin/system/login-logs                   | 系统       | 登录日志（系统路径下）                           |
| /api/admin/system/operation-logs               | 系统       | 操作日志                                         |
| /api/admin/system/monitor/metrics              | 系统       | 系统监控指标                                     |
| /api/admin/system/monitor/services             | 系统       | 系统监控服务                                     |
| /api/admin/users ↔ /api/users                  | 前缀不一致 | 用户管理入口（需统一前缀）                       |
| /api/admin/realname-audit ↔ /api/auth/realname | 前缀不一致 | 实名审核（需迁移到 admin）                       |

### P1（影响次要功能 — 内容 / 监控 / 教育 / 商城 / 平台）

> 涉及内容运营、教学管理、监控告警、商城订单，缺失影响运营效率

**内容运营（6 个）：**

- /api/admin/about-us, /api/admin/advertise, /api/admin/carousel, /api/admin/comment-logs, /api/admin/contact, /api/admin/news/information

**教务 / 课程（8 个）：**

- /api/admin/courses, /api/admin/edu/classes, /api/admin/edu/classes/schedules, /api/admin/finance/statistics, /api/admin/learn/homework, /api/admin/learn/materials, /api/admin/learn/plans, /api/admin/learn/reminds

**监控 / 运维（11 个）：**

- /api/admin/backend-health/events, /api/admin/db-opt/_（3 个）, /api/admin/event-bus/_（2 个）, /api/admin/monitor/_（3 个，不含前缀不一致的 alerts）, /api/admin/monitoring/_（3 个）, /api/admin/performance-dashboard/*（2 个）

**平台 / API 管理（6 个）：**

- /api/admin/api-groups, /api/admin/api-usage/*（3 个）, /api/admin/oauth/apps, /api/admin/oauth-audit/stats

**商城（4 个）：**

- /api/admin/shop/funds/accounts, /api/admin/shop/products, /api/admin/shop/withdrawal-flow, /api/admin/shop/withdrawals

**前缀不一致需统一（高优先）：**

- /api/admin/course* → /api/course/*（7 个，需迁移到 /api/admin 前缀下）
- /api/admin/developer/* → /api/developer/*, /api/sdks（3 个）
- /api/admin/education-platform → /api/education-platform

### P2（可延后 — ZHS 专属 / 移动适配 / 其他扩展）

> 非核心业务，可按需排期

| 路径                             | 模块   | 说明                                 |
| -------------------------------- | ------ | ------------------------------------ |
| /api/admin/zhs-activity          | ZHS    | ZHS 活动管理                         |
| /api/admin/zhs-agent             | ZHS    | ZHS 代理管理                         |
| /api/admin/zhs-identity          | ZHS    | ZHS 身份管理                         |
| /api/admin/zhs-user              | ZHS    | ZHS 用户管理                         |
| /api/admin/mobile-adapter        | 移动   | 移动适配配置                         |
| /api/admin/mobile-adapter/mode   | 移动   | 移动适配模式                         |
| /api/admin/ai-gc                 | AI     | AIGC 内容管理                        |
| /api/admin/identity-proportion   | 配置   | 身份占比配置                         |
| /api/admin/recommendation-config | 配置   | 推荐配置                             |
| /api/admin/task-developer        | 开发者 | 任务开发者                           |
| /api/admin/video-logs            | 日志   | 视频日志                             |
| /api/admin/developer/coze        | 开发者 | Coze 开发者                          |
| /api/admin/developer-link        | 开发者 | 开发者链接                           |
| /api/admin/oss/files             | OSS    | OSS 文件列表                         |
| /api/admin/stats                 | 统计   | 统计概览（后端仅有 /stats/detailed） |
| /api/admin/products              | 商城   | 产品管理（相对路径）                 |
| /api/admin/statistics            | 统计   | 统计（相对路径）                     |

---

## 5. 命名不一致修复建议

> 以下 12 项仅需统一前后端命名，无需新建路由文件

| 前端路径                     | 后端路径                     | 建议方案                                                   |
| ---------------------------- | ---------------------------- | ---------------------------------------------------------- |
| /api/admin/login-logs        | /api/admin/logininfor        | 后端新增 `/api/admin/login-logs` 别名或前端改用 logininfor |
| /api/admin/user-center       | /api/admin/usercenter        | 统一为 `/api/admin/user-center`（连字符风格）              |
| /api/admin/member/*          | /api/admin/members/*         | 统一为复数 `members`（3 处）                               |
| /api/admin/member-levels     | /api/admin/members/levels    | 同上                                                       |
| /api/admin/auth-dept         | /api/admin/dept              | 前端去掉 `auth-` 前缀                                      |
| /api/admin/user-dept         | /api/admin/dept              | 前端去掉 `user-` 前缀                                      |
| /api/admin/user-vip          | /api/admin/vip/users         | 统一路径结构                                               |
| /api/admin/system/config     | /api/admin/config            | 前端去掉 `system/` 前缀                                    |
| /api/admin/system/posts      | /api/admin/post              | 统一为 `/api/admin/posts`（复数）                          |
| /api/admin/system/tasks/logs | /api/admin/job/log           | 统一命名                                                   |
| /api/admin/message-templates | /api/admin/messages/template | 统一为 `/api/admin/message-templates`                      |

---

## 备注

1. **统计口径**：前端路径数为去重后的唯一基准路径（含相对路径推断的 3 个），后端路径数取自 `EXISTING_ROUTES_AUDIT.md` 摘要。
2. **相对路径推断**：`lib/admin-api.ts` 中的 `/admin/logs`、`/admin/orders`、`/admin/products`、`/admin/statistics`、`/admin/users` 推断 baseURL 为 `/api`，对应 `/api/admin/*`。其中 `/admin/logs` 和 `/admin/orders` 后端已实现，`/admin/products` 和 `/admin/statistics` 缺失。
3. **部分实现**：`/api/admin/learn/topics` 后端仅有 `publish/unpublish` 子路径，缺少列表和创建端点，视为已实现（不完整）。
4. **`/api/admin/stats`**：后端仅有 `/api/admin/stats/detailed`，缺少 `/api/admin/stats` 概览端点，列入缺失。
5. **examine 模块**：前端调用 `/api/admin/examine/*`（3 个路径），后端实现在 `/api/examine/*` 下，属于前缀不一致，需统一。
