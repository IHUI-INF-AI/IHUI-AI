# 钉钉群机器人接入指南 (Phase 8)

> 适用: ZHSPlatform 监控告警 (5 条 ZHSMonitor* 告警 + 抑制链) 推送到钉钉群 #zhs-monitor-ops

## 1. 申请钉钉群机器人

### 1.1 创建群
- 进入钉钉 → 群聊 (可以是已有群或新建 `#zhs-monitor-ops` 运维群)
- 群设置 → 智能群助手 → 添加机器人 → **自定义** (用 webhook 接入)

### 1.2 安全设置 (三选一, 推荐加签)
| 方式 | 配置 | 适用 |
|------|------|------|
| 自定义关键词 | 告警消息必须含至少 1 个关键词 (例 `ZHS`, `告警`) | 最简 |
| 加签 (推荐) | 群机器人详情页的"加签"密钥 (SEC 开头) | 中等安全 |
| IP 白名单 | 仅 allow 公司出口 IP | 最严 |

### 1.3 复制 webhook URL
形如:
```
https://oapi.dingtalk.com/robot/send?access_token=abc123def456
```

## 2. 写入 .env.production

在 [`.env.production`](.env.production) 末尾 Phase 8 段填入:

```bash
# 钉钉群 webhook (监听器告警专用群 #zhs-monitor-ops)
ZHS_MONITOR_DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN
ZHS_MONITOR_DINGTALK_SECRET=SEC...   # 启用加签才需要
ZHS_MONITOR_AT_ALL=true               # @所有人
ZHS_MONITOR_INHIBIT_ENABLED=0         # 0=启用抑制 (critical 触发时抑制 4 个 warning)
```

如果走 K8s Secret 注入 (见 [values.prod.yaml](deploy/helm/zhs-platform/values.prod.yaml)):
```yaml
alerting:
  dingtalk:
    enabled: true
    webhookSecret: zhs-monitor-dingtalk   # k8s Secret 名
    webhookKey: webhook                   # Secret data key
    atAll: true
    inhibitEnabled: true
```

## 3. 端到端验证

### 3.1 启动钉钉模拟器 (本机没接真实群时)
```bash
python scripts/ops/dingtalk_webhook_simulator.py --host 127.0.0.1 --port 9999
# 把 .env.production 改为:
# ZHS_MONITOR_DINGTALK_WEBHOOK=http://127.0.0.1:9999/robot/send
```

### 3.2 跑验证脚本 (4 步: healthz / 文本 / markdown / 抑制链)
```bash
python scripts/ops/verify_dingtalk_webhook.py
```

预期输出:
```
[1/4] healthz ... OK
[2/4] 文本消息推送 ... 200, errcode=0
[3/4] Markdown 告警推送 ... 200, errcode=0
[4/4] 抑制链场景 (1 critical + 4 warning, 应只推 1 条) ... 200
```

### 3.3 接真实钉钉群验证
1. 改 .env.production 的 `ZHS_MONITOR_DINGTALK_WEBHOOK` 为真实 webhook
2. 重启 uvicorn (lifespan 会重读 ENV)
3. 跑 `verify_dingtalk_webhook.py --real`
4. 打开钉钉 → #zhs-monitor-ops 群 → 应收到 4 条消息 (1 healthz + 1 文本 + 1 markdown + 1 抑制链)

## 4. 告警触发链路

```
Prometheus rules.yml
  └─ ZHSMonitorDown (critical, 2min)
       └─ Alertmanager
            └─ routes[closure=phase8]
                 └─ receiver=zhs-monitor-ops
                      ├─ dingtalk_configs → 钉钉群 webhook
                      └─ wechat_configs → 企业微信 @all
```

[docker/alertmanager/alertmanager.yml](docker/alertmanager/alertmanager.yml) 的 `zhs-monitor-ops` receiver 已配好 (第 67-89 行).

## 5. 抑制链行为

`ZHSMonitorDown` (critical) 触发后, 自动抑制 4 个 warning 避免刷屏:
- `ZHSMonitorRefreshSlow`
- `ZHSMonitorChecksStalled`
- `ZHSMonitorRecordsCacheBurst`
- `ZHSMonitorExpiredBurst`

如需关闭抑制 (例演练时想看全量告警):
```bash
ZHS_MONITOR_INHIBIT_ENABLED=1 uvicorn app.main:app ...
```

## 6. 常见问题

| 现象 | 原因 | 解决 |
|------|------|------|
| 群收不到消息 | webhook URL 错 | 重新复制 access_token |
| 推送 310000 错误 "keywords not in content" | 启用了关键词 | 关键词加 `ZHS` 或 `告警` |
| 推送 310000 错误 "sign not match" | 启用了加签但 SECRET 错 | 复制机器人加签密钥, base64 decode 后 HMAC-SHA256 |
| @不到人 | AT_ALL=false | 设 `ZHS_MONITOR_AT_ALL=true` |
| 同 1 个 critical 收到 2 次 | receiver 配了 webhook + dingtalk 两路 | routes 改 `continue: false` 或只配 dingtalk |

## 7. CI 失败钉钉通知 (建议 1 落地)

[.github/workflows/weekly-phase8-drill.yml](.github/workflows/weekly-phase8-drill.yml) 在 `notify` job 中:
- 5 个 drill job 任一失败 → 触发失败汇总 → 调 [dingtalk_drill_notify.py](scripts/ci/dingtalk_drill_notify.py) 推钉钉
- 默认 `@所有人`
- 消息含 run_id 链接到 GitHub Actions

### 7.1 在 GitHub repo 添加 secrets

`Settings → Secrets and variables → Actions → New repository secret`:

| Secret 名 | 值 |
|-----------|-----|
| `PHASE8_DRILL_DINGTALK_WEBHOOK` | 钉钉机器人 webhook URL |
| `PHASE8_DRILL_DINGTALK_SECRET` | 钉钉加签密钥 (SEC开头, 可选) |

### 7.2 本地测试
```bash
# 准备一个 report
cat > /tmp/drill_report.md <<EOF
## Phase 8 Weekly Drill 汇总 (20260616)
- check-alert-rules: failure
- clock-drift-tests: success
EOF

# 推到本地模拟器
python scripts/ci/dingtalk_drill_notify.py \
  --webhook http://127.0.0.1:9999/robot/send \
  --date 20260616 \
  --run-id 99999 \
  --report /tmp/drill_report.md \
  --repo org/zhs-platform
```

### 7.3 关闭推送
- 不配置 secret → 自动跳过, 仅 GitHub Actions 内汇总
- 想关掉: `Settings → Secrets → PHASE8_DRILL_DINGTALK_WEBHOOK` 删除

## 8. 相关文件

- [dingtalk_webhook_simulator.py](scripts/ops/dingtalk_webhook_simulator.py) - 本地模拟器
- [verify_dingtalk_webhook.py](scripts/ops/verify_dingtalk_webhook.py) - 端到端验证脚本
- [dingtalk_drill_notify.py](scripts/ci/dingtalk_drill_notify.py) - CI 失败通知
- [alertmanager.yml](docker/alertmanager/alertmanager.yml) - 路由 + 抑制规则
- [prometheus/rules.yml](docker/prometheus/rules.yml) - 5 条 ZHSMonitor* 告警
- [values.prod.yaml](deploy/helm/zhs-platform/values.prod.yaml) - helm override
