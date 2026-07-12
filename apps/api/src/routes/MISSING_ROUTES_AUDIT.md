# 前端 API 调用审计清单

> 扫描范围：`g:\IHUI-AI\apps\web` 下所有 `.ts` / `.tsx` 文件
> 扫描模式：`fetchApi<...>('...')`、`fetch('/api/...')`、`eduApi<...>('...')`、`eduApi('...')`、`api<...>('...')`、`api('...')`、`const API/RESOURCE = '...'`、`buildQs` 附近常量、所有 `/api/admin/` 与 `/api/auth/` 字符串字面量
> 处理规则：仅提取静态字符串基准路径；对 `${API}/${id}` 等动态拼接，记录常量基准路径；同一基准路径仅记录一次（不区分 CRUD 方法）

## 统计

- 总计：约 380 个唯一 API 基准路径
- 按模块分组：24 个模块（含 1 个"相对路径"分组）

## 完整清单（按模块分组）

### admin 模块（/api/admin/*）

#### admin - 内容运营

- /api/admin/about-us
- /api/admin/advertise
- /api/admin/agreements
- /api/admin/ai-gc
- /api/admin/announcements（messages/announcements）
- /api/admin/carousel
- /api/admin/circles
- /api/admin/comment-logs
- /api/admin/configs
- /api/admin/contact
- /api/admin/docs
- /api/admin/events
- /api/admin/examine
- /api/admin/examine/pass
- /api/admin/examine/reject
- /api/admin/feedbacks
- /api/admin/help/articles
- /api/admin/identity-proportion
- /api/admin/integrations
- /api/admin/menu
- /api/admin/message-templates
- /api/admin/mobile-adapter
- /api/admin/mobile-adapter/mode
- /api/admin/news/articles
- /api/admin/news/categories
- /api/admin/news/information
- /api/admin/private-letters
- /api/admin/product-identity
- /api/admin/projects
- /api/admin/recommendation-config
- /api/admin/refunds/stats
- /api/admin/resources
- /api/admin/resources/tags
- /api/admin/sensitive-words
- /api/admin/task-developer
- /api/admin/video-logs
- /api/admin/zhs-activity
- /api/admin/zhs-agent
- /api/admin/zhs-identity
- /api/admin/zhs-user

#### admin - 鉴权 / 用户管理

- /api/admin/auth-accounts
- /api/admin/auth-dept
- /api/admin/auth-find-info
- /api/admin/auth-info
- /api/admin/auth-role
- /api/admin/auth-sms-temp
- /api/admin/auth-tokens
- /api/admin/auth-user-margin
- /api/admin/auth-user-vip
- /api/admin/auth-veri-codes
- /api/admin/auth-vip-level
- /api/admin/login-logs
- /api/admin/member/blacklist
- /api/admin/member/company-types
- /api/admin/member/permissions
- /api/admin/member/users
- /api/admin/members
- /api/admin/members/companies
- /api/admin/members/pwd/reset
- /api/admin/online-users
- /api/admin/realname-audit
- /api/admin/system/login-logs
- /api/admin/system/operation-logs
- /api/admin/system/posts
- /api/admin/system/tasks/logs
- /api/admin/user-agent-audio
- /api/admin/user-agent-context
- /api/admin/user-agent-image
- /api/admin/user-center
- /api/admin/user-dept
- /api/admin/user-roles
- /api/admin/user-vip
- /api/admin/users
- /api/admin/users/course-users

#### admin - 教务 / 课程

- /api/admin/category-dictionary
- /api/admin/certificates
- /api/admin/certificates/templates
- /api/admin/course
- /api/admin/course-audit
- /api/admin/course-pay
- /api/admin/course-pay-log
- /api/admin/course-platform-log
- /api/admin/course-video
- /api/admin/course-videos
- /api/admin/courses
- /api/admin/edu-points/channels
- /api/admin/edu-points/rules
- /api/admin/edu-settings
- /api/admin/edu/answer/run-code
- /api/admin/edu/classes
- /api/admin/edu/classes/schedules
- /api/admin/edu/exam/arrangements
- /api/admin/edu/exam/templates
- /api/admin/education-platform
- /api/admin/exam/categories
- /api/admin/exam/papers
- /api/admin/exam/questions
- /api/admin/exam/records
- /api/admin/finance/statistics
- /api/admin/learn/categories
- /api/admin/learn/homework
- /api/admin/learn/invoices
- /api/admin/learn/lessons
- /api/admin/learn/materials
- /api/admin/learn/plans
- /api/admin/learn/reminds
- /api/admin/learn/topics
- /api/admin/live/categories
- /api/admin/live/channels
- /api/admin/live/lecturers
- /api/admin/member-levels
- /api/admin/organization
- /api/admin/user-platform

#### admin - 平台 / API 管理

- /api/admin/api-groups
- /api/admin/api-platform/apps
- /api/admin/api-platform/billing/summary
- /api/admin/api-platform/packages
- /api/admin/api-platform/usage
- /api/admin/api-platform/usage/summary
- /api/admin/api-usage/day
- /api/admin/api-usage/stats
- /api/admin/api-usage/top
- /api/admin/developer/coze
- /api/admin/developer/keys
- /api/admin/developer/sdks
- /api/admin/developer/webhooks
- /api/admin/developer-link
- /api/admin/dict/data
- /api/admin/dict/type
- /api/admin/dict/type/list
- /api/admin/oauth/apps
- /api/admin/oauth-audit/stats
- /api/admin/oss/drivers
- /api/admin/oss/files

#### admin - 监控 / 运维

- /api/admin/backend-health/events
- /api/admin/behavior/statistics
- /api/admin/db-opt/slow-queries
- /api/admin/db-opt/suggestions
- /api/admin/db-opt/tables
- /api/admin/error-dashboard/errors
- /api/admin/error-dashboard/stats
- /api/admin/event-bus/events
- /api/admin/event-bus/stats
- /api/admin/gray-release
- /api/admin/monitor/alert-rules
- /api/admin/monitor/alerts
- /api/admin/monitor/perf
- /api/admin/monitor/services
- /api/admin/monitoring/alerts
- /api/admin/monitoring/logs
- /api/admin/monitoring/perf
- /api/admin/monitoring/services
- /api/admin/performance-dashboard/endpoints
- /api/admin/performance-dashboard/stats
- /api/admin/stats
- /api/admin/stats/detailed
- /api/admin/system/config
- /api/admin/system/monitor/metrics
- /api/admin/system/monitor/services

#### admin - 商城

- /api/admin/shop/funds/accounts
- /api/admin/shop/products
- /api/admin/shop/withdrawal-flow
- /api/admin/shop/withdrawals

#### admin - 客服

- /api/admin/customer-service/agents
- /api/admin/customer-service/categories
- /api/admin/customer-service/tickets

#### admin - 订单

- /api/admin/orders

### auth 模块（/api/auth/*）

- /api/auth/2fa/disable
- /api/auth/2fa/setup
- /api/auth/2fa/status
- /api/auth/2fa/verify
- /api/auth/apple
- /api/auth/callback/wechat
- /api/auth/dingtalk
- /api/auth/email/code
- /api/auth/github
- /api/auth/google
- /api/auth/google/config
- /api/auth/login
- /api/auth/login/email
- /api/auth/login/enterprise/pc/wxCode
- /api/auth/login/phone-code
- /api/auth/login/username
- /api/auth/logout-all（相对路径 /auth/logout-all，见末尾分组）
- /api/auth/oauth/apps/create
- /api/auth/oauth/apps/list
- /api/auth/oauth/my-authorized
- /api/auth/oauth/scope-meta
- /api/auth/qr/generate
- /api/auth/realname/my
- /api/auth/refresh
- /api/auth/register
- /api/auth/reset-password
- /api/auth/send-code
- /api/auth/sso/code
- /api/auth/sso/exchange
- /api/auth/sso/logout
- /api/auth/sso/validate
- /api/auth/wechat/mini/login

### ai 模块（/api/ai/*）

- /api/ai/aigc/tasks
- /api/ai/bot-sites
- /api/ai/careers
- /api/ai/chat
- /api/ai/chat-types
- /api/ai/chat/conversations
- /api/ai/chat/history
- /api/ai/community
- /api/ai/dashscope/image
- /api/ai/dashscope/image-edit
- /api/ai/dashscope/multimodal
- /api/ai/dashscope/video
- /api/ai/doubao/image
- /api/ai/education
- /api/ai/feed
- /api/ai/index
- /api/ai/jimeng4/image
- /api/ai/kling/video/generate
- /api/ai/mcp/prompts
- /api/ai/mcp/servers
- /api/ai/mcp/tools/call
- /api/ai/mcp/usage
- /api/ai/model-info
- /api/ai/models
- /api/ai/sora2/generate
- /api/ai/suno/generate
- /api/ai/team
- /api/ai/tencent/hunyuan3d/submit
- /api/ai/world

### ai-ext 模块（/api/ai-ext/*）

- /api/ai-ext/ai-feed/hot
- /api/ai-ext/capabilities
- /api/ai-ext/developer/model-test
- /api/ai-ext/reports
- /api/ai-ext/reports/generate

### ai-world 模块（/api/ai-world/*）

- /api/ai-world
- /api/ai-world/categories

### agents 模块（/api/agents/*）

- /api/agents
- /api/agents/create
- /api/agents/list
- /api/agents/oauth-apps/audit-logs

### bi 模块（/api/bi/*）

- /api/bi/dashboard

### chat 模块（/api/chat/*）

- /api/chat/conversations
- /api/chat/favorites

### content 模块（文章 / 文档 / 收藏 / 反馈 / 分享 / 搜索）

- /api/announcements
- /api/article/categories
- /api/article/comments
- /api/article/detail
- /api/article/essence
- /api/article/favorite
- /api/article/hot
- /api/article/like
- /api/article/list
- /api/article/my
- /api/article/publish
- /api/categories
- /api/categories/list
- /api/content/articles
- /api/content/articles/categories
- /api/content/articles/hot
- /api/content-generation/generate
- /api/content-generation/history
- /api/content-generation/templates
- /api/docs
- /api/docs/categories
- /api/favorites
- /api/favorites/check
- /api/feedback
- /api/feedback/submit
- /api/feedbacks
- /api/share
- /api/share/content

### community 模块（圈子 / 问答 / 话题 / 资讯 / 评论）

- /api/asks
- /api/circles
- /api/comments
- /api/comments/mine
- /api/community/posts
- /api/follows
- /api/news
- /api/topics

### customer-service 模块（/api/customer-service/*）

- /api/customer-service/categories
- /api/customer-service/messages
- /api/customer-service/sessions
- /api/customer-service/tickets

### developer 模块（/api/developer、/api/sdks 等）

- /api/developer
- /api/developer/apply
- /api/developer/audit
- /api/developer/info
- /api/developer/price
- /api/oauth-apps
- /api/packages
- /api/sdks
- /api/webhooks

### distribution 模块（/api/distribution/*）

- /api/distribution/invited-users
- /api/distribution/overview

### drama 模块（/api/drama/*）

- /api/drama/scripts

### edu 模块（/api/edu/*）

- /api/edu/courses
- /api/edu/my-offline-records
- /api/edu/my-papers
- /api/edu/my-report
- /api/edu/nav
- /api/edu/notes
- /api/edu/offline-records
- /api/edu/papers

### edu-points 模块（/api/edu-points/*）

- /api/edu-points/channels
- /api/edu-points/my-points

### exam 模块（/api/exam/*）

- /api/exam/papers
- /api/exam/records

### examine 模块（/api/examine/*）

- /api/examine/list
- /api/examine/stats/summary

### feature-center 模块（/api/feature-center/*）

- /api/feature-center/agents
- /api/feature-center/apis
- /api/feature-center/documents
- /api/feature-center/models
- /api/feature-center/sdks
- /api/feature-center/stats

### finance 模块（/api/finance/*）

- /api/finance/commission/list
- /api/finance/commission/summary
- /api/finance/distribution/invitee-stats
- /api/finance/distribution/subordinates
- /api/finance/distribution/team/center
- /api/finance/margin/balance
- /api/finance/withdrawal/apply
- /api/finance/withdrawal/available
- /api/finance/withdrawal/list
- /api/finance/withdrawal/summary

### help 模块（/api/help/*）

- /api/help/articles
- /api/help/categories

### invitations 模块（/api/invitations/*）

- /api/invitations
- /api/invitations/invitees

### learn 模块（/api/learn/*）

- /api/learn
- /api/learn/lessons
- /api/learn/map
- /api/learn/reports/lesson
- /api/learn/reports/member

### live 模块（/api/live/*）

- /api/live
- /api/live/calendar
- /api/live/lecturers

### llm 模块（/api/llm/*）

- /api/llm/complete/stream

### mcp 模块（/api/mcp/*）

- /api/mcp
- /api/mcp/integrations
- /api/mcp/invoke
- /api/mcp/projects

### messages / notifications 模块

- /api/messages
- /api/messages/read-all
- /api/notifications
- /api/notifications/badge
- /api/notifications/read-all
- /api/notifications/unread-count

### misc 集成模块（coze / n8n / openclaw / tbox / 代理）

- /api/coze/agents
- /api/coze/chat
- /api/luyala-proxy/chat/completions
- /api/luyala-proxy/video/create
- /api/n8n/executions
- /api/n8n/workflows
- /api/openclaw
- /api/openrouter-proxy/chat/completions
- /api/openrouter-proxy/models
- /api/tbox

### payment / order 模块（/api/payment、/api/fund、/api/orders 等）

- /api/fund/ali/pay/alipay/notify
- /api/fund/ali/pay/create
- /api/fund/ali/pay/create2
- /api/fund/ali/pay/fail
- /api/orders
- /api/orders/invoice
- /api/payment/callback/verify
- /api/payment/order
- /api/payment/orders
- /api/payment/refund
- /api/top-up/create
- /api/top-up/status
- /api/zhs-withdrawal-flow
- /api/zhsWithdrawal/getWithdrawal
- /api/zhsWithdrawal/withdrawal

### points / sign-in 模块

- /api/leaderboard
- /api/points/transactions
- /api/sign-in
- /api/sign-in/history
- /api/sign-in/today

### recruitment 模块

- /api/recruitment

### reports 模块

- /api/reports/generate

### resource 模块（/api/resource、/api/resources、证书、知识、技能）

- /api/certificate
- /api/certificate/issue
- /api/certificate/templates
- /api/knowledge
- /api/resource
- /api/resources
- /api/skills

### schedule 模块

- /api/schedule

### search 模块

- /api/search
- /api/search/history
- /api/search/hot
- /api/search/hot-words
- /api/search/suggestions

### security 模块

- /api/security/audit
- /api/security/log
- /api/security/score

### service-appointment 模块

- /api/service-appointment

### settlement 模块

- /api/settlement/list
- /api/settlement/settle
- /api/settlement/summary

### statistics / visit 模块

- /api/statistics
- /api/statistics/exam
- /api/statistics/orders
- /api/statistics/users
- /api/statistics/visits
- /api/visit
- /api/visit/stats

### students 模块

- /api/students

### subscriptions 模块

- /api/subscriptions

### system 模块（/api/settings、/api/app-version、/api/category、/api/monitor、/api/behavior）

- /api/app-version
- /api/app-version/check
- /api/app-version/latest
- /api/behavior
- /api/category
- /api/category/tree
- /api/health
- /api/monitor/metrics
- /api/monitor/services
- /api/monitor/status
- /api/settings
- /api/settings/about
- /api/settings/clear-data
- /api/settings/delete-account
- /api/settings/delete-account/cancel
- /api/settings/delete-account/status
- /api/settings/devices
- /api/settings/export
- /api/settings/notifications
- /api/settings/preferences
- /api/settings/privacy

### teams 模块

- /api/teams

### tools 模块（/api/tools、/api/v1/tools）

- /api/tools
- /api/v1/tools/categories
- /api/v1/tools/list
- /api/v1/tools/upload

### user 模块（/api/user、/api/users）

- /api/user/devices
- /api/user/ip-whitelist
- /api/user/login-history
- /api/user/security-score
- /api/user/sessions
- /api/users
- /api/users/avatar
- /api/users/change-phone

### v1 模块（/api/v1/*）

- /api/v1/ai/capabilities/auto-match
- /api/v1/ai/capabilities/categories
- /api/v1/ai/capabilities/invoke
- /api/v1/ai/capabilities/list
- /api/v1/checkin
- /api/v1/checkin/record
- /api/v1/content/create
- /api/v1/content/list
- /api/v1/courses
- /api/v1/courses/categories
- /api/v1/courses/lesson-complete
- /api/v1/courses/my

### vip 模块（/api/vip/*）

- /api/vip/levels
- /api/vip/my
- /api/vip/purchase

### wallet 模块（/api/wallet/*）

- /api/wallet/balance
- /api/wallet/info
- /api/wallet/recharge
- /api/wallet/transactions
- /api/wallet/withdraw

### workflows 模块（/api/workflows/*）

- /api/workflows
- /api/workflows/instances

### workspace 模块（/api/workspace、/api/workspace-ai）

- /api/workspace/projects
- /api/workspace-ai/agentic
- /api/workspace-ai/generate-component

### 其他业务模块

- /api/activities
- /api/agreements
- /api/agreements/current
- /api/member/levels
- /api/member/me
- /api/miniprogram
- /api/plaza
- /api/product-identity
- /api/product-identity/verify
- /api/ranking
- /api/stock
- /api/trader
- /api/groups
- /api/fund

### 相对路径分组（无 /api 前缀，由 fetchApi baseURL 决定）

> 以下路径在代码中没有 `/api` 前缀，但通过 `fetchApi` 调用，实际请求路径由 baseURL 决定。可能对应后端不同前缀（如 /api、/cozeZhsApi 或直接根路径）。列出供核对。

#### 相对路径 - auth

- /auth/account
- /auth/devices
- /auth/export-data
- /auth/login
- /auth/login-code
- /auth/logout-all
- /auth/permissions
- /auth/profile
- /auth/register

#### 相对路径 - admin（lib/admin-api.ts）

- /admin/logs
- /admin/orders
- /admin/products
- /admin/statistics
- /admin/users

#### 相对路径 - agents（lib/agent-api.ts）

- /agents
- /agents/reviews

#### 相对路径 - community（lib/community-api.ts）

- /asks
- /circles
- /news
- /topics

#### 相对路径 - 其他

- /commission/ranking
- /edu/ask/list
- /edu/circles
- /exams
- /files
- /files/share
- /files/versions
- /live
- /live/calendar
- /login-pwd/edit-password
- /login-pwd/replace-phone
- /membership/info
- /points
- /points/sign-in
- /security
- /user/security
- /user/settings
- /user/settings/devices
- /user/settings/clear-data
- /user/settings/delete-account
- /user/settings/delete-account/cancel
- /user/settings/delete-account/status
- /user/settings/export-data
- /user/settings/notifications
- /user/settings/preferences
- /user/settings/privacy
- /user/settings/security-logs
- /user/settings/send-email-code
- /user/settings/verify-email
- /user/settings/send-phone-code
- /user/settings/verify-phone
- /user/settings/theme/sync
- /user/settings/theme/presets
- /user/settings/agreement
- /user/statistics
- /user/two-factor
- /vip/faqs
- /vip/order
- /vip/testimonials
- /auth-vip-level/list
- /xuqiu

## 重要说明

1. **常量定义位置**：`const API = '/api/admin/xxx'` 和 `const RESOURCE = '/api/admin/xxx'` 主要出现在 `apps/web/app/(main)/admin/` 下的页面文件中，用于 CRUD 操作的基准路径。
2. **去重规则**：同一基准路径仅记录一次。例如 `/api/admin/certificates` 下既有列表查询又有 `${id}` 的 PUT/DELETE，但只记录 `/api/admin/certificates` 一条。
3. **子路径单独记录**：当子路径是独立的资源端点时（如 `/api/admin/certificates/templates` 与 `/api/admin/certificates` 并存），分别记录。
4. **动态拼接跳过**：纯动态拼接（如 `eduApi(\`${API}/${editing.id}\`)`）已通过提取 `API`常量值记录基准路径；对于`eduApi(\`/api/admin/certificates/${id}/status\`)`这种带动作后缀的，记录其基准路径`/api/admin/certificates`。
5. **相对路径分组**：`lib/*.ts` 中的部分 API 调用使用相对路径（如 `/auth/profile`、`/admin/users`），实际请求路径取决于 `fetchApi` 的 baseURL 配置。需与后端路由前缀核对。
6. **COZE 前缀**：`backend-paths.ts` 中存在 `${COZE}/...` 形式路径（COZE = '/cozeZhsApi'），这些是旧架构遗留，前端实际调用情况需结合运行时 baseURL 判断。本清单未将其计入主统计，但文件 `apps/web/src/config/backend-paths.ts` 中保留了完整映射。
7. **`/api/test`**：出现在 `src/lib/__tests__/api.test.ts` 中，为测试桩路径，不计入实际业务路径。

## 文件位置参考

- 常量定义集中位置：
  - `apps/web/app/(main)/admin/**/page.tsx`（`const API` / `const RESOURCE`）
  - `apps/web/src/config/backend-paths.ts`（COZE 旧架构路径常量）
  - `apps/web/src/lib/sso.ts`（SSO 路径常量）
  - `apps/web/src/lib/third-party-config.ts`（第三方登录 proxyPath）
- API 封装库集中位置：
  - `apps/web/src/lib/admin-api.ts`
  - `apps/web/src/lib/agent-api.ts`
  - `apps/web/src/lib/ai-api.ts`
  - `apps/web/src/lib/business-api.ts`
  - `apps/web/src/lib/chat-api.ts`
  - `apps/web/src/lib/community-api.ts`
  - `apps/web/src/lib/content-api.ts`
  - `apps/web/src/lib/course-api.ts`
  - `apps/web/src/lib/developer-api.ts`
  - `apps/web/src/lib/distribution-api.ts`
  - `apps/web/src/lib/exam-api.ts`
  - `apps/web/src/lib/file-utils.ts`
  - `apps/web/src/lib/learn-api.ts`
  - `apps/web/src/lib/live-api.ts`
  - `apps/web/src/lib/misc-api.ts`
  - `apps/web/src/lib/notification-api.ts`
  - `apps/web/src/lib/order-api.ts`
  - `apps/web/src/lib/payment-api.ts`
  - `apps/web/src/lib/resource-api.ts`
  - `apps/web/src/lib/share-api.ts`
  - `apps/web/src/lib/system-api.ts`
  - `apps/web/src/lib/user-api.ts`
  - `apps/web/src/lib/vip-api.ts`
  - `apps/web/src/lib/wallet-api.ts`
  - `apps/web/src/lib/workspace-api.ts`
  - `apps/web/src/lib/security-utils.ts`
