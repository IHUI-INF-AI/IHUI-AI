# 真实生产 Webhook 接入手册

> 第十轮整合产物 - 真实生产环境告警通道接入指南
> 适用版本: zhs v2.0+
> 最后更新: 2026-06-18

## 概述

本手册说明如何将本地 mock / webhook.site 演练升级为真实生产 webhook 接入,覆盖 8 个告警通道:

| 通道 | 用途 | 接入方式 |
|------|------|----------|
| 钉钉 | 国内主力 | 群机器人 webhook |
| 微信企业版 | 国内辅助 | 应用机器人 |
| 飞书 | 字节系 | 群机器人 webhook |
| 邮件 | 离线/值班 | SMTP |
| PagerDuty | 海外 oncall | Events API v2 |
| Slack | 海外协作 | Incoming webhook |
| Teams | 海外企业 | Connector webhook |
| Generic | 自定义 | HTTP POST |

## 前置条件

- 8 个通道的 webhook URL 已由运维创建
- 后端配置中心可写
- 真实生产告警可触发 (建议先在 staging 跑通)

## 接入流程

### 1. 收集 webhook URL

联系运维获取 8 个 URL,按通道填入:

```bash
# 钉钉
export DINGTALK_WEBHOOK="https://oapi.dingtalk.com/robot/send?access_token=xxxxx"
# 微信企业版
export WECHAT_WORK_WEBHOOK="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxx"
# 飞书
export FEISHU_WEBHOOK="https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx"
# 邮件 SMTP
export EMAIL_SMTP_HOST="smtp.exmail.qq.com"
export EMAIL_SMTP_PORT="465"
export EMAIL_SMTP_USER="alert@zhs.example.com"
export EMAIL_SMTP_PASSWORD="xxxxx"
export EMAIL_FROM="alert@zhs.example.com"
# PagerDuty
export PAGERDUTY_INTEGRATION_KEY="xxxxx"
# Slack
export SLACK_WEBHOOK="https://hooks.slack.com/services/T000/B000/xxxxx"
# Teams
export TEAMS_WEBHOOK="https://outlook.office.com/webhook/xxxxx"
# Generic
export GENERIC_WEBHOOK_URL="https://alert-aggregator.zhs.example.com/inbound"
```

### 2. 写入配置中心

后端用配置中心 (etcd / nacos / apollo) 加载 webhook:

```python
# app/core/alert_webhook.py
WEBHOOK_CONFIG = {
    "dingtalk": os.environ.get("DINGTALK_WEBHOOK"),
    "wechat_work": os.environ.get("WECHAT_WORK_WEBHOOK"),
    "feishu": os.environ.get("FEISHU_WEBHOOK"),
    "slack": os.environ.get("SLACK_WEBHOOK"),
    "teams": os.environ.get("TEAMS_WEBHOOK"),
    "generic": os.environ.get("GENERIC_WEBHOOK_URL"),
}
```

### 3. 跑真实 webhook 演练

```bash
# 8 通道演练 + 失败率统计
python scripts/real_webhook_drill.py --target production
```

演练输出:
- 每通道 HTTP 状态码
- 响应延迟 (p50 / p95 / p99)
- 失败率 (期望 0%)
- 实际收到的请求 ID (运维到对应渠道人工核对)

### 4. 验证清单

- [ ] 钉钉群收到 1 条测试告警
- [ ] 微信企业版收到 1 条测试告警
- [ ] 飞书群收到 1 条测试告警
- [ ] 邮件收到 1 封测试邮件
- [ ] PagerDuty 触发 1 个 incident
- [ ] Slack 频道收到 1 条消息
- [ ] Teams 频道收到 1 条消息
- [ ] Generic 端点收到 1 个 POST
- [ ] Alertmanager 失败率 < 1%
- [ ] 8 通道端到端延迟 < 5s

### 5. 灰度切换

```bash
# 1. staging 先全量切换
kubectl -n staging set env deploy/zhs-backend \
  ALERT_WEBHOOK_TARGET=production

# 2. 观察 24h
# 3. 灰度 10% 流量到生产
# 4. 全量切换
```

## 故障排查

### 通道失败定位

```bash
# 查看 alertmanager 日志
kubectl -n alertmanager logs -l app=alertmanager | grep "notify"

# 查看后端推送日志
kubectl -n zhs logs -l app=backend | grep "webhook"

# 跑单通道演练
python scripts/real_webhook_drill.py --channel dingtalk --verbose
```

### 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| 钉钉 430 限流 | 触发频次过高 | 调整告警抑制 + 升级群容量 |
| 邮件 550 拒收 | SMTP 鉴权失败 | 重新配置 password / SSL |
| Slack 403 | webhook 失效 | 重新生成 webhook |
| PagerDuty 401 | integration_key 错 | 核对 key |
| Teams 404 | connector 删除 | 重建 connector |

## 监控

Prometheus 抓取:
- `alertmanager_notifications_total{channel="..."}`
- `alertmanager_notifications_failed_total{channel="..."}`
- `alertmanager_notification_duration_seconds{channel="..."}`

告警规则 (rules.alert_failure.yml 已有):
- 失败率 > 5% 持续 5min → 通知 oncall
- 单通道 P95 > 10s → 通知运维
- 任意通道 0 通知 > 1h → 通知 oncall (可能整体挂)

## 后续

- 接入 AIOps 降噪 (alert_noise_integration.py)
- 接入告警历史 DB (alert_history_integration.py)
- 接入告警回放 (alert_replay.py)
