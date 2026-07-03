# 业务埋点接入清单（建议 99）

本文件记录 `BizTimer(with_user=True)` 在哪些路由被启用，以及 endpoint 命名规范。
新增埋点请同步更新本文件。

## 命名规范

- 格式：`biz:<domain>:<action>`
- `<domain>`：业务域（`alipay` / `wechat` / `agent_buy`）
- `<action>`：动作（`create` / `app_create` / `agent_create`）
- 不要带空格，不要带数字 ID（避免 cardinality 爆炸）

## 已接入路由

| 路由 | endpoint 标签 | 文件 | 触发场景 |
|---|---|---|---|
| `POST /api/v1/pay/alipay/create` | `biz:alipay:create` | [alipay.py](app/api/v1/payments/alipay.py) | 支付宝 PC / H5 下单 |
| `POST /api/v1/pay/alipay/app/create` | `biz:alipay:app_create` | [alipay.py](app/api/v1/payments/alipay.py) | 支付宝 APP 下单 |
| `POST /api/v1/pay/wechat/create` | `biz:wechat:create` | [wechat.py](app/api/v1/payments/wechat.py) | 微信 JSAPI 下单 |
| `POST /api/v1/pay/wechat/agent/create` | `biz:wechat:agent_create` | [wechat.py](app/api/v1/payments/wechat.py) | 微信智能体下单 |
| `POST /api/v1/agent/buy/create` | `biz:agent_buy:create` | [buy.py](app/api/v1/agents/buy.py) | 智能体购买 |

## 埋点行为

每次启用 `BizTimer(..., with_user=True)` 上下文管理器时，**同时**打两条指标：

1. **默认指标**（不破坏现有 dashboard）：
   - `zhs_biz_requests_total{endpoint, status}` Counter +1
   - `zhs_biz_request_duration_seconds{endpoint}` Histogram observe
   - 异常时额外 `zhs_biz_errors_total{endpoint, error_type}` +1

2. **用户维度指标**（建议 95）：
   - `zhs_biz_requests_by_user_total{endpoint, status, user_id, tenant_id}` Counter +1
   - `zhs_biz_latency_by_user_seconds{endpoint, status, user_id, tenant_id}` Histogram observe

user_id / tenant_id 自动从 `app.telemetry.get_request_context()` contextvar 读取；
telemetry 未启用或 context 为空时退化为 `anonymous` / `anonymous`，不抛异常。

## Cardinality 保护

详见 [metrics_business.py](app/metrics_business.py) 的 `_trim_user_label()`：
- `None` / 空字符串 → `anonymous`
- 长度 > 64 字符 → 截断为 `前32...后24`（保留前缀和后缀便于排查）
- 单进程 label 组合数 > 1000 时应主动排查是否被刷

## 新增埋点的步骤

1. 在路由函数体内增加 `with BizTimer("biz:<domain>:<action>", with_user=True):`
2. 缩进函数体
3. 在本文件表格加一行
4. 加一个单元测试：模拟该 endpoint 触发，验证两条指标都被 inc

## 验收查询

启动服务并打一次 `/api/v1/pay/alipay/create`，然后：

```bash
curl -s http://localhost:8000/metrics | grep -E 'biz:alipay:create|alipay.*user_id'
```

应能看到：
```
zhs_biz_requests_total{endpoint="biz:alipay:create",status="200"} 1.0
zhs_biz_requests_by_user_total{endpoint="biz:alipay:create",status="200",tenant_id="anonymous",user_id="u-test-001"} 1.0
zhs_biz_request_duration_seconds_bucket{endpoint="biz:alipay:create",le="..."} ...
zhs_biz_latency_by_user_seconds_bucket{endpoint="biz:alipay:create",status="200",tenant_id="anonymous",user_id="u-test-001",le="..."} ...
```

## 注意事项

- 不要再把 user_id / tenant_id 加到默认 `zhs_biz_requests_total` 上（cardinality 爆炸）
- 不要在异步 hook / 中间件里调用 `BizTimer`（应放在路由函数体最外层 with 块）
- 异常路径也会被 `BizTimer.__exit__` 捕获，状态自动切到 `500`
