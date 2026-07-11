# R65 生产环境部署清单

## 数据库迁移

以下迁移已在开发环境执行，生产环境部署时需执行：

### 0047_r65_upload_auth_renew.sql

```sql
-- 1. 分片上传会话表
CREATE TABLE IF NOT EXISTS "upload_sessions" (...);

-- 2. 实名认证字段（user_auth_info 表扩展）
ALTER TABLE "user_auth_info" ADD COLUMN IF NOT EXISTS "real_name" varchar(50);
ALTER TABLE "user_auth_info" ADD COLUMN IF NOT EXISTS "auth_status" varchar(32) DEFAULT 'unverified' NOT NULL;
...

-- 3. 连续订阅字段（user_vips 表扩展）
ALTER TABLE "user_vips" ADD COLUMN IF NOT EXISTS "auto_renew" integer DEFAULT 0 NOT NULL;
```

执行方式：

```bash
psql -h <host> -U <user> -d <database> -f packages/database/drizzle/0047_r65_upload_auth_renew.sql
```

## 微信支付证书配置

提现回调端点 `POST /api/payments/withdrawal/notify` 需要微信平台证书验签。

### 需要配置的环境变量

```env
# 微信支付 API 证书
WECHAT_PAY_CERT_SERIAL_NO=<平台证书序列号>
WECHAT_PAY_PRIVATE_KEY_PATH=<商户私钥文件路径>
WECHAT_PAY_CERT_PATH=<平台证书文件路径>

# 回调地址（需公网可访问）
WECHAT_PAY_NOTIFY_URL=https://yourdomain.com/api/payments/withdrawal/notify
```

### 开发环境行为

- `NODE_ENV != production` 时跳过签名验证，返回 `{ code: 'SUCCESS', message: 'OK' }`
- 生产环境无证书时返回 400 错误

## 支付宝同步返回配置

### 需要配置的环境变量

```env
# 支付宝同步返回 URL
ALIPAY_RETURN_URL=https://yourdomain.com/api/payments/sync-return

# 前端页面路由（支付成功/失败跳转）
CORS_ORIGIN=https://yourdomain.com
```

### 前端路由

确保前端有以下路由：

- `/payment/success?orderNo=xxx` — 支付成功页
- `/payment/fail` — 支付失败页

## 新增 API 端点清单

### M-39 Agent 模块扩展（20端点）

| 方法   | 路径                                       | 说明           |
| ------ | ------------------------------------------ | -------------- |
| GET    | /api/agent-ext/rules/list                  | 规则列表       |
| GET    | /api/agent-ext/rules/:id                   | 规则详情       |
| POST   | /api/agent-ext/rules                       | 新增规则       |
| PUT    | /api/agent-ext/rules/:id                   | 修改规则       |
| DELETE | /api/agent-ext/rules/:id                   | 删除规则       |
| GET    | /api/agent-ext/rule-params/list            | 规则参数列表   |
| GET    | /api/agent-ext/rule-params/:id             | 规则参数详情   |
| POST   | /api/agent-ext/rule-params                 | 新增参数       |
| PUT    | /api/agent-ext/rule-params/:id             | 修改参数       |
| DELETE | /api/agent-ext/rule-params/:id             | 删除参数       |
| GET    | /api/agent-ext/heat/list                   | 热度统计列表   |
| GET    | /api/agent-ext/heat/summary                | 热度汇总       |
| GET    | /api/agent-ext/heat/top                    | 热度排行TOP10  |
| GET    | /api/agent-ext/developer/list              | 开发者续费列表 |
| GET    | /api/agent-ext/developer/:id               | 开发者续费详情 |
| GET    | /api/agent-ext/developer/order/:orderNo    | 按订单号查询   |
| POST   | /api/agent-ext/developer                   | 创建续费记录   |
| POST   | /api/agent-ext/developer/generate-order-no | 生成订单号     |
| GET    | /api/agent-ext/personality/:agentId        | 获取人设       |
| PUT    | /api/agent-ext/personality/:agentId        | 更新人设       |

### M-52 分片上传（5端点）

| 方法   | 路径                       | 说明           |
| ------ | -------------------------- | -------------- |
| POST   | /api/chunked-upload/init   | 初始化分片上传 |
| POST   | /api/chunked-upload/upload | 上传单个分片   |
| POST   | /api/chunked-upload/merge  | 合并分片       |
| DELETE | /api/chunked-upload/cancel | 取消上传       |
| GET    | /api/chunked-upload/status | 查询状态       |

### M-54 财务扩展（10端点）

| 方法 | 路径                                         | 说明         |
| ---- | -------------------------------------------- | ------------ |
| GET  | /api/finance/distribution/team-stats         | 团队业绩统计 |
| GET  | /api/finance/distribution/subordinate-stats  | 下级统计     |
| GET  | /api/finance/distribution/invitation-summary | 邀请汇总     |
| POST | /api/finance/agent-withdrawal/apply          | 提现申请     |
| GET  | /api/finance/agent-withdrawal/list           | 提现列表     |
| POST | /api/finance/agent-withdrawal/:id/approve    | 审批通过     |
| POST | /api/finance/agent-withdrawal/:id/reject     | 驳回         |
| POST | /api/admin/finance/margin/adjust             | 保证金调整   |
| GET  | /api/admin/finance/fund/audit/list           | 资金审核列表 |
| POST | /api/admin/finance/fund/audit/:id            | 资金审核操作 |

### M-56 支付扩展（4端点）

| 方法 | 路径                              | 说明           |
| ---- | --------------------------------- | -------------- |
| POST | /api/payments/withdrawal/notify   | 微信提现回调   |
| GET  | /api/payments/sync-return         | 支付宝同步返回 |
| POST | /api/payments/subscription/renew  | 连续订阅续费   |
| GET  | /api/payments/subscription/status | 订阅状态查询   |

### M-67 实名认证（4端点）

| 方法 | 路径                               | 说明         |
| ---- | ---------------------------------- | ------------ |
| POST | /api/auth/realname/submit          | 提交实名认证 |
| GET  | /api/auth/realname/my              | 查询我的认证 |
| GET  | /api/auth/realname/list            | 管理员列表   |
| PUT  | /api/auth/realname/:userUuid/audit | 管理员审核   |

## 新增前端页面

| 路径                  | 说明           |
| --------------------- | -------------- |
| /user/realname        | 用户实名认证   |
| /user/subscription    | 订阅管理       |
| /admin/realname-audit | 管理端实名审核 |
| /admin/agent-rules    | Agent规则管理  |
| ChunkedUploader 组件  | 大文件分片上传 |

## 验证清单

- [ ] TypeScript `tsc --noEmit` 零错误
- [ ] 数据库迁移已执行（upload_sessions 表 + user_auth_info 字段 + user_vips.auto_renew）
- [ ] 微信支付证书已配置（生产环境）
- [ ] 支付宝 return URL 已配置
- [ ] 前端导航已注册（user: realname/subscription, admin: realnameAudit/agentRules）
- [ ] i18n 翻译已添加
