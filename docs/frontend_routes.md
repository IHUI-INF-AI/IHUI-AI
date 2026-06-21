# 前端路由白名单

> 来源: `client/src/router/modules/*.ts` (base/ai/community/api/user/admin)
> 用途: Playwright 测试 / E2E / 文档化实际可访问 URL
> 更新时间: 2026-06-18

## 一、核心公共页面 (base.ts)

| 路径 | name | 说明 |
|---|---|---|
| `/` | home | 首页 |
| `/home` | - | 首页别名 (redirect → /) |
| `/design-system` | designSystem | 设计系统 |
| `/storybook` | componentShowcase | 组件展示 |
| `/business-docs` | businessDocs | 业务文档 |
| `/aizhs-demo` | aizhsDemo | 演示页 |
| `/login` | login | 登录页 |
| `/register` | register | 注册页 |
| `/403` | forbidden | 禁止访问 |
| `/:pathMatch(.*)*` | notFound | 404 兜底 |

## 二、AI 模块 (ai.ts)

| 路径 | name | 说明 |
|---|---|---|
| `/agentic-dashboard` | agenticDashboard | Agent 仪表盘 |
| `/ai-world` | aiWorld | AI 世界 |
| `/ai-world/detail/:id` | aiWorldDetail | AI 世界详情 |
| `/ai-world/banner-detail/:index` | aiWorldBannerDetail | Banner 详情 |
| `/api-test` | apiTest | API 测试 |
| `/agents` | agents | **AI 应用商店** (非 /ai-store) |
| `/designer-agent` | designerAgent | 设计器 Agent |
| `/agents/category` | agentsCategory | Agent 分类 |
| `/agents/create` | agentsCreate | 创建 Agent |
| `/agents/:id` | agentDetail | Agent 详情 |
| `/ai-management` | aiManagement | AI 管理 |
| `/mcp-manager` | mcpManager | MCP 管理 |
| `/mcp-use` | mcpUse | MCP 使用 |
| `/mcp-use-project` | mcpUseProject | MCP 项目 |
| `/unified-ai` | unifiedAI | 统一 AI |

## 三、社区模块 (community.ts)

| 路径 | name | 说明 |
|---|---|---|
| `/plaza` | plaza | 广场 |
| `/xuqiu/:id` | xuqiuDetail | 需求详情 |
| `/xuqiu` | xuqiu | 需求 |
| `/tools-store` | - | 工具商店 (redirect → /agents/:id 或 /agents) |
| `/ai-community` | aiCommunity | **AI 社区** ✓ |
| `/courses` | courses | 课程 |
| `/courses/:id` | courseDetail | 课程详情 |
| `/community` | - | 社区 (redirect) |
| `/about` | about | 关于 |
| `/feedback` | feedback | 反馈 |
| `/help` | - | 帮助 |
| `/share` | share | 分享 |
| `/share/:id?` | shareDetail | 分享详情 |
| `/ai-career` | aiCareer | AI 职业 |
| `/tech-service` | techService | 技术服务 |

## 四、开放平台 (api.ts)

| 路径 | name | 说明 |
|---|---|---|
| `/open` | openPlatform | **开放平台** (非 /open-platform) |
| `/open/dashboard` | openDashboard | 开放平台仪表盘 |
| `/open/sdks` | openSDKs | SDK |
| `/open/models` | openModels | 模型 |
| `/open/agents` | openAgents | 开放 Agent |
| `/open/apis` | openAPIs | API |
| `/open/documents` | openDocuments | 文档 |
| `/open/document/center` | - | redirect → /open/docs |
| `/open/docs` | openPlatformDocs | 平台文档 |
| `/docs` | eduDocumentation | 教育文档 |
| `/edu-docs` | - | redirect → /docs |
| `/files` | fileManager | 文件管理 |
| `/permissions` | permissionManager | 权限管理 |
| `/audit` | auditLog | 审计日志 |
| `/document-center` | - | 文档中心 |

## 五、用户中心 (user.ts)

| 路径 | name | 说明 |
|---|---|---|
| `/forgot-password` | forgotPassword | 忘记密码 |
| `/phone-binding` | phoneBinding | 手机绑定 |
| `/user` | user | 用户主页 |
| `/user-center` | userCenter | 用户中心 |
| `/vip-membership` | vipMembership | VIP 会员 |
| `/distribution-center` | distributionCenter | 分销中心 |
| `/recharge` | recharge | 充值 |
| `/withdrawal` | withdrawal | 提现 |
| `/wallet` | wallet | 钱包 |
| `/customer-service` | customerService | 客服 |
| `/order-list` | orderList | 订单列表 |
| `/distribution-order-list` | distributionOrderList | 分销订单 |
| `/my-commission` | myCommission | 我的佣金 |
| `/profile` | profile | 个人资料 |
| `/settings` | settings | 设置 |

## 六、Playwright 测试推荐路径

```python
PAGES = [
    ("/", "home"),
    ("/agents", "ai_store"),           # 不是 /ai-store
    ("/open", "open_platform"),        # 不是 /open-platform
    ("/ai-world", "learn_ai"),         # 不是 /learn-ai
    ("/ai-community", "ai_community"),
    ("/plaza", "plaza"),
    ("/courses", "courses"),
    ("/user-center", "user_center"),
]
```

## 七、已知不存在路径 (会走 404)

- ❌ `/ai-store` → 应使用 `/agents`
- ❌ `/open-platform` → 应使用 `/open`
- ❌ `/learn-ai` → 应使用 `/ai-world` 或 `/courses`
