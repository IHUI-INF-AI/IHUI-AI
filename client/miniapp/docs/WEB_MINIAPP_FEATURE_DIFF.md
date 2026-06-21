# 官网与小程序功能差异表

本文档用于记录 `officialsite` 官网与 `miniapp` 微信小程序在迁移期的功能差异，避免两个端的能力边界失焦。

## 当前结论

- 官网继续承载完整 Web 体验、开放平台、文档/文件查看器、复杂桌面交互与管理类页面。
- 小程序保留移动端高频入口：AI 工具、助手对话、用户中心、会员、分销、订单、收益与微信登录链路。
- 共享 API、认证常量、类型与跨端服务逻辑从 `packages/*` 输出，小程序通过 `src/vendor/*.bundle.js` 消费。

## 功能对照

| 领域 | 官网现状 | 小程序现状 | 迁移策略 | 备注 |
| --- | --- | --- | --- | --- |
| 首页/导航 | `src/views/Home.vue` 与官网导航体系 | TabBar + `pages/table/*` | 保持端内体验差异 | 不强行统一 UI |
| AI 工具广场 | 官网 AI 世界/工具页面 | `pages/table/tools`、`pages/tools` | 共享工具/智能体 API 与类型 | 页面交互分别维护 |
| AI 对话 | `src/components/ai/*` | `pages/tools/ai_*`、`pages/table/aiIndex` | 逐步抽出会话、智能体服务 | 避免一次性重写 Vue2 页面 |
| 登录/认证 | Web token/cookie/localStorage 链路 | 微信授权、手机号、token storage | 使用 `@aizhs/shared-auth` 统一 key 与 token 判断 | 平台登录入口仍保留差异 |
| 用户中心 | `src/router/modules/user.ts` 相关页面 | `pages/table/user`、`pages/member` | 共享用户/会员类型后再合并服务 | UI 不共用 |
| 订单 | Web 用户订单/支付相关入口 | `pages/user_order_list`、`pages/distribution_order_list` | 后续纳入 `@aizhs/shared-services` | 需核对支付平台差异 |
| 分销/收益 | Web 分销组件与个人信息卡 | `pages/distribution`、`pages/income` | 共享分销类型与接口封装 | 数据口径优先统一 |
| 文档/文件查看 | Web Office/PDF/Code viewer | 小程序暂无完整桌面 viewer | 官网专属 | 小程序可保留轻量入口 |
| 开放平台 | `src/views/OpenPlatform.vue` | 暂无等价完整页面 | 官网专属，后续评估小程序入口 | 不纳入当前阶段 |
| 设置/隐私 | Web 多语言/主题/全局设置 | `pages/table/settings` | 共享隐私链接与基础配置 | 主题系统暂不共用 |

## 后续检查项

- 新增或修改接口时，优先判断是否应进入 `packages/shared-api`、`packages/shared-types` 或 `packages/shared-services`。
- 小程序页面迁移到共享服务时，先替换无 UI 的请求层，再处理页面状态。
- 每完成一个业务域迁移，在本表更新“迁移策略”和“备注”。
