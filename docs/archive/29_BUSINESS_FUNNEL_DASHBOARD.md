# ZHS 业务转化漏斗大盘文档

> 版本: v1.0  
> 日期: 2026-06-18  
> 范围: chat / payment / login 三大核心转化漏斗

---

## 一、概述

ZHS 业务转化漏斗大盘（UID: `zhs-business-funnel`）是面向产品和运营的核心数据看板，覆盖以下三大业务漏斗：

| 漏斗 | 业务价值 | 关键指标 |
|---|---|---|
| Chat 漏斗 | 评估 AI 助手使用率 | send → receive 转化率、各渠道分布、P95 延迟 |
| 支付漏斗 | 评估商业化效率 | checkout → submit → success 转化率、失败率 |
| 登录漏斗 | 评估用户留存 | click → submit → success 转化率 |

---

## 二、面板结构

### 2.1 顶部概览（Row 1）
- **DAU 指标**：通过 `chat_send|user_login|payment_create` 事件去重 user_id 计数
- **支付成功订单数**：1 天内 `payment_success` 事件增量
- **Chat 调用次数**：1 天内 `chat_send` 事件增量
- **新注册用户**：1 天内 `user_register` 事件增量

### 2.2 Chat 漏斗（Row 2）
- **Chat 漏斗转化率**：1 小时窗口内 `chat_send` → `chat_receive` 转化率
- **Chat 各渠道分布**：按 `channel` label 拆分（qwen / deepseek / doubao / coze / zhipu / kling / qwen_omni）
- **Chat 平均响应延迟**：P50/P95/P99 直方图

### 2.3 支付漏斗（Row 3）
- **支付漏斗转化率**：3 段漏斗（checkout_click → pay_submit → payment_success）
- **支付成功 vs 失败**：1 小时趋势
- **支付平均处理耗时**：P95 延迟

### 2.4 登录漏斗（Row 4）
- **登录漏斗转化率**：3 段漏斗（login_click → login_submit → login_success）
- **用户行为趋势**：登录/注册/登出

### 2.5 错误监控（Row 5）
- **业务错误 Top 10**：5 分钟内 `error_*` 事件排行

---

## 三、事件与指标映射

### 3.1 Prometheus 指标

| 指标名 | 类型 | 标签 | 说明 |
|---|---|---|---|
| `zhs_business_events_total` | Counter | event / user_id / channel / funnel / step | 业务事件计数 |
| `zhs_business_latency_seconds` | Histogram | event / channel | 业务耗时直方图 |

### 3.2 业务事件常量

来自 `app/core/tracking.py`：

| 常量 | 值 | 触发位置 |
|---|---|---|
| `EVENT_USER_REGISTER` | `user_register` | `app/api/v1/auth/login.py` |
| `EVENT_USER_LOGIN` | `user_login` | `app/api/v1/auth/login.py` |
| `EVENT_USER_LOGOUT` | `user_logout` | `app/api/v1/auth/login.py` |
| `EVENT_CHAT_SEND` | `chat_send` | `app/api/v1/chat/*.py` |
| `EVENT_CHAT_RECEIVE` | `chat_receive` | `app/api/v1/chat/*.py` |
| `EVENT_PAYMENT_CREATE` | `payment_create` | `app/api/v1/payments/alipay.py` |
| `EVENT_PAYMENT_SUCCESS` | `payment_success` | `app/api/v1/payments/alipay.py` |
| `EVENT_PAYMENT_FAIL` | `payment_fail` | `app/api/v1/payments/alipay.py` |
| `EVENT_ORDER_CREATE` | `order_create` | `app/services/order_service.py` |
| `EVENT_COURSE_ENROLL` | `course_enroll` | `app/api/v1/courses/*.py` |
| `EVENT_TOOL_USED` | `tool_used` | `app/api/v1/tools/*.py` |

### 3.3 漏斗步骤

漏斗事件以 `funnel_<name>_<step>` 形式生成：

| 漏斗名 | 步骤序列 | 触发位置 |
|---|---|---|
| `login` | `page_view` → `login_click` → `login_submit` → `login_success` | `auth/login.py` |
| `payment` | `cart_view` → `checkout_click` → `pay_submit` → `pay_success` | `payments/alipay.py` |
| `chat` | `send` → `receive` | `chat/*.py` |

---

## 四、Prometheus 抓取配置

### 4.1 静态配置（本地 / staging）

参考 `deploy/grafana/prometheus_scrape.yml`：

```yaml
scrape_configs:
  - job_name: "zhs-backend"
    metrics_path: "/metrics"
    scrape_interval: 15s
    static_configs:
      - targets: ["zhs-backend.zhs.svc.cluster.local:8000"]
        labels:
          service: "zhs-backend"
          env: "production"
```

### 4.2 K8s ServiceMonitor

参考 `deploy/grafana/servicemonitor.yaml`，自动发现 `app=zhs-backend` 标签的 Pod。

### 4.3 后端 /metrics 端点

由 `prometheus_client` 自动暴露（FastAPI 启动时挂载在 `/metrics`）：

```bash
curl http://localhost:8000/metrics | grep zhs_business
```

---

## 五、告警规则

参考 `deploy/grafana/alerting/zhs_business_alerts.yml`：

| 告警 | 阈值 | 持续时间 | 严重度 |
|---|---|---|---|
| 支付失败率告警 | 5m 失败率 > 30% | 2m | critical |
| Chat 错误率告警 | 5m 错误率 > 10% | 3m | warning |
| Chat P95 延迟告警 | > 3 秒 | 5m | warning |

---

## 六、面板导入步骤

### 6.1 通过 Grafana UI 导入
1. 登录 Grafana → **Dashboards** → **Import**
2. 上传 `deploy/grafana/dashboards/zhs_business_funnel_dashboard.json`
3. 选择 Prometheus 数据源 → **Import**

### 6.2 通过 Provisioning 自动加载

```yaml
# /etc/grafana/provisioning/dashboards/zhs.yaml
apiVersion: 1
providers:
  - name: 'ZHS'
    orgId: 1
    folder: 'ZHS'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards/zhs
```

把 `zhs_business_funnel_dashboard.json` 复制到 `/var/lib/grafana/dashboards/zhs/`。

---

## 七、PromQL 速查

### 7.1 基础查询
```promql
# 1 小时 chat_send 总数
sum(increase(zhs_business_events_total{event="chat_send"}[1h]))

# 1 小时 DAU（按 user_id 去重）
sum(count by (user_id) (increase(zhs_business_events_total{event=~"chat_send|user_login|payment_create"}[1d])))

# Chat 漏斗转化率
sum(increase(zhs_business_events_total{event="chat_receive"}[1h]))
  / clamp_min(sum(increase(zhs_business_events_total{event="chat_send"}[1h])), 1)
```

### 7.2 高级查询
```promql
# 各渠道 chat_send 趋势
sum by (channel) (rate(zhs_business_events_total{event="chat_send"}[5m]))

# Chat P95 延迟
histogram_quantile(0.95,
  sum by (le) (rate(zhs_business_latency_seconds_bucket{event="chat_send"}[5m]))
)

# 业务错误 Top 10
topk(10, sum by (error_type) (increase(zhs_business_events_total{event=~"error_.*"}[5m])))
```

---

## 八、测试验证

### 8.1 SDK 验证
```bash
cd g:\1\server
python -m pytest tests/test_ci_business_tracking_required.py -v
# 5/5 passed
```

### 8.2 触发埋点
```bash
# 启动后端后
curl -X POST http://localhost:8000/api/v1/auth/login/username?username=admin&password=admin123
curl -X POST http://localhost:8000/api/v1/chat/chat?message=hello

# 检查指标
curl http://localhost:8000/metrics | grep zhs_business
# 应输出: zhs_business_events_total{event="user_login",...} 1.0
# 应输出: zhs_business_events_total{event="chat_send",...} 1.0
```

### 8.3 跨服务验证
- S1 埋点扩展测试: `tests/test_s1_chat_tracking_extended.py` 6/6 passed
- S2 CI 必跑项: `tests/test_ci_business_tracking_required.py` 5/5 passed

---

## 九、扩展指引

### 9.1 新增事件
1. 在 `app/core/tracking.py` 添加 `EVENT_XXX = "xxx"` 常量
2. 在业务代码中调用 `track_event(EVENT_XXX, user_id=uid, ...)`
3. 必要时调用 `track_funnel("xxx", "step_name", user_id=uid, ...)`
4. 重新部署后端，Grafana 自动显示

### 9.2 新增漏斗面板
1. 复制 `panels[].id=10`（Chat 漏斗 row）的 JSON 结构
2. 修改 `targets[].expr` 引用新漏斗事件
3. 调整 `gridPos` 避免重叠

### 9.3 新增告警
1. 复制 `deploy/grafana/alerting/zhs_business_alerts.yml` 中的 rule 条目
2. 修改 `data[].model.expr` 和 `conditions.evaluator.params`
3. 重新加载 provisioning 目录

---

## 十、文件清单

| 文件 | 说明 |
|---|---|
| [deploy/grafana/dashboards/zhs_business_funnel_dashboard.json](file:///g:/1/deploy/grafana/dashboards/zhs_business_funnel_dashboard.json) | Grafana 漏斗大盘 JSON |
| [deploy/grafana/alerting/zhs_business_alerts.yml](file:///g:/1/deploy/grafana/alerting/zhs_business_alerts.yml) | 业务告警规则 |
| [deploy/grafana/prometheus_scrape.yml](file:///g:/1/deploy/grafana/prometheus_scrape.yml) | Prometheus 静态抓取配置 |
| [deploy/grafana/servicemonitor.yaml](file:///g:/1/deploy/grafana/servicemonitor.yaml) | K8s ServiceMonitor |
| [server/app/core/tracking.py](file:///g:/1/server/app/core/tracking.py) | 业务埋点 SDK |
