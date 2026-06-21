# 告警 8 通道真实生产端点配置

> 本文描述如何从 mock 演练切换到真实生产 webhook 端点.
> 所有 8 个通道均支持 dry-run 演练 (mock receiver) + 真生产 (端到端).

---

## 端点清单

| 通道 | 环境变量 | 真实端点格式 | 认证方式 |
|------|----------|--------------|----------|
| 钉钉 | `DINGTALK_WEBHOOK` | `https://oapi.dingtalk.com/robot/send?access_token=XXX` | URL query `access_token` + 可选 `DINGTALK_SECRET` 加签 |
| 企业微信 | `WECHAT_WORK_WEBHOOK` | `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=XXX` | URL query `key` |
| 飞书 | `FEISHU_WEBHOOK` | `https://open.feishu.cn/open-apis/bot/v2/hook/XXX` | URL path 段 |
| 邮件 (SMTP) | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `ALERT_EMAIL_TO` | 任意 SMTP 服务器 (qq/163/阿里云邮箱/自建) | 用户名+密码 / OAuth2 |
| Slack | `SLACK_WEBHOOK` | `https://hooks.slack.com/services/TXXX/BXXX/XXX` | URL path 段 |
| Teams | `TEAMS_WEBHOOK` | `https://outlook.office.com/webhook/XXX/IncomingWebhook/XXX/XXX` | URL path 段 |
| Generic | `GENERIC_WEBHOOK_URL` | 任意 HTTP(S) 端点 | 可选 `GENERIC_WEBHOOK_AUTH_HEADER` |
| PagerDuty | `PAGERDUTY_ROUTING_KEY` / `PAGERDUTY_API_URL` | `https://events.pagerduty.com/v2/enqueue` | 请求体 `routing_key` |

---

## 获取真实端点步骤

### 1. 钉钉

1. 创建群 → 群设置 → 智能群助手 → 添加机器人 → 自定义
2. 勾选"加签"获取 secret (用于安全校验)
3. 复制 webhook URL (`access_token=XXX` 段)
4. 配置:
   ```env
   DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
   DINGTALK_SECRET=SECxxx
   ```

### 2. 企业微信

1. 群聊 → 群机器人 → 添加 → 群机器人 (无需 AppID, 群机器人即可)
2. 复制 webhook URL
3. 配置:
   ```env
   WECHAT_WORK_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
   ```

### 3. 飞书

1. 群 → 设置 → 群机器人 → 添加机器人 → 自定义机器人
2. 复制 webhook URL
3. 配置:
   ```env
   FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
   ```

### 4. 邮件 (SMTP)

#### 阿里云邮箱
```env
SMTP_HOST=smtp.aliyun.com
SMTP_PORT=465
SMTP_USER=alerts@example.com
SMTP_PASSWORD=<app 密码, 非登录密码>
ALERT_EMAIL_TO=oncall@example.com
```

#### 自建 Postfix
```env
SMTP_HOST=smtp.zhs.local
SMTP_PORT=25
SMTP_USER=alerts
ALERT_EMAIL_TO=oncall@zhs.local
```

### 5. Slack

1. https://api.slack.com/apps → Create New App → From scratch
2. Incoming Webhooks → Activate → Add New Webhook to Workspace
3. 复制 webhook URL
4. 配置:
   ```env
   SLACK_WEBHOOK=https://hooks.slack.com/services/TXXX/BXXX/xxx
   ```

### 6. Teams

1. Teams 频道 → ... → Connectors → Incoming Webhook → 配置
2. 复制 webhook URL
3. 配置:
   ```env
   TEAMS_WEBHOOK=https://outlook.office.com/webhook/xxx/IncomingWebhook/xxx/xxx
   ```

### 7. Generic (自定义端点)

支持任意 HTTP 接收端点. 例如 webhook.site / 公司内部接收服务.

```env
GENERIC_WEBHOOK_URL=https://webhook.site/xxx-xxx-xxx
GENERIC_WEBHOOK_AUTH_HEADER=Bearer xxx  # 可选, 留空则无认证
```

### 8. PagerDuty

1. https://www.pagerduty.com/ → Service Directory → Create Service
2. Integrations → Events API v2 → Create Integration
3. 配置:
   ```env
   PAGERDUTY_ROUTING_KEY=xxx
   PAGERDUTY_API_URL=https://events.pagerduty.com/v2/enqueue
   ```

---

## 演练模式 (推荐先用)

### A. webhook.site (公网接收, 不需要部署)

1. 访问 https://webhook.site 获取唯一 token (URL 类似 `https://webhook.site/xxx-xxx-xxx`)
2. 用该 URL 配置 8 通道 (钉钉/微信等改用 webhook.site 演练):
   ```env
   DINGTALK_WEBHOOK=https://webhook.site/dingtalk-演练-uuid
   WECHAT_WORK_WEBHOOK=https://webhook.site/wechat-演练-uuid
   FEISHU_WEBHOOK=https://webhook.site/feishu-演练-uuid
   SLACK_WEBHOOK=https://webhook.site/slack-演练-uuid
   TEAMS_WEBHOOK=https://webhook.site/teams-演练-uuid
   GENERIC_WEBHOOK_URL=https://webhook.site/generic-演练-uuid
   ```
3. 运行演练:
   ```bash
   python scripts/alert_drill_8channels.py --output logs/real_drill.json
   ```
4. 在 webhook.site 页面查看每个通道是否收到请求
5. **优势**: 无需部署, 公网可达, 真实 HTTP 演练
6. **局限**: webhook.site 不做应用层校验 (纯文本/HTML 响应), 真实生产端点会校验签名/格式

### B. 本地 mock receiver (内网演练, 已有)

```bash
# 启动 mock receiver (监听 7001-7007 + 7025 SMTP)
python scripts/mock_webhook_receiver.py

# 配置 .env 指向本地
DINGTALK_WEBHOOK=http://127.0.0.1:7001/dingtalk
WECHAT_WORK_WEBHOOK=http://127.0.0.1:7002/wechat
FEISHU_WEBHOOK=http://127.0.0.1:7003/feishu
SMTP_HOST=127.0.0.1
SMTP_PORT=7025
SLACK_WEBHOOK=http://127.0.0.1:7004/slack
TEAMS_WEBHOOK=http://127.0.0.1:7005/teams
GENERIC_WEBHOOK_URL=http://127.0.0.1:7006/generic
PAGERDUTY_ROUTING_KEY=mock-routing-key
PAGERDUTY_API_URL=http://127.0.0.1:7007/pagerduty/v2/enqueue

# 演练
python scripts/alert_drill_8channels.py --output logs/local_drill.json
```

---

## 从 mock 切到生产的部署步骤

### 1. 准备 .env.production

```bash
cp .env.production .env.production.bak  # 备份
# 用真实端点覆盖 .env.production 中的 8 通道配置
# 注意: 生产环境必须用 HTTPS 端点, 不能用 HTTP
```

### 2. dry-run 演练

```bash
# 不重启服务, 仅验证配置合法性
python scripts/check_pg_config.py --check-webhook
```

### 3. 灰度演练 (Webhook → Slack 测试频道)

先在 Slack/Teams 创建专用 `#alerts-test` 频道, 用测试 webhook 跑 1-2 周:
- 每天演练 1 次 (可用 cron 触发)
- 关注消息格式是否合理 / 触发频次 / 噪音水平
- 验收后再切到正式频道

### 4. 正式切换

- 更新 .env.production
- 重启后端
- 演练 1 次 (8 通道全发)
- 通知 oncall 人员关注
- 保留旧配置 24h 以便回滚

### 5. 监控 webhook 推送失败率

- Prometheus 抓 `alertmanager_notifications_failed_total`
- 失败率 > 5% 触发 oncall 告警

---

## 签名校验

部分通道 (钉钉加签 / Slack HMAC) 需要服务端验证签名.

- 钉钉: timestamp + sign 在请求头, 后端已支持
- 飞书: request body HMAC 校验, 后端已支持
- Slack: 不校验 (webhook URL 即认证)

后端 `_check` 函数已兼容多种成功响应格式 (JSON / 纯文本 / HTML).

---

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| 钉钉 310000 错误 | access_token 过期 | 重新创建群机器人 |
| 企业微信 40001 错误 | key 错误 | 检查 URL 中的 key 段 |
| 飞书 错误码 1 | 签名错误 | 检查项目中的 secret 与飞书配置一致 |
| SMTP 认证失败 | 用了登录密码 | 阿里云/QQ 邮箱需用 app 密码 |
| Slack 404 | webhook URL 失效 | 重新创建 Slack App |
| Generic 401 | 缺少 Authorization 头 | 配置 `GENERIC_WEBHOOK_AUTH_HEADER` |
| PagerDuty 403 | routing_key 错误 | 重新生成 routing_key |

---

## 演练脚本对照

| 脚本 | 用途 | 适用阶段 |
|------|------|----------|
| `scripts/alert_drill_8channels.py` | 8 通道全量演练, 读 .env 配置 | dev / staging |
| `scripts/prom_alert_e2e.py` | Alertmanager → 后端 → 8 通道端到端 | staging / production dry-run |
| `scripts/mock_webhook_receiver.py` | 启动本地 mock 接收器 | dev |
| `scripts/check_pg_config.py` | 配置合法性检查 | 部署前 |
