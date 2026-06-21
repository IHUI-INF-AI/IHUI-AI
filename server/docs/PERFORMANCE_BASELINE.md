# ZHS Platform 性能基线

> 测试环境: Windows / Python 3.13.2 / pytest 8.4.2
> 测试时间: 2026-06-13
> 测试集: tests/test_baseline.py (10 用例)

## 端点响应时间

| 端点        | 平均 (ms) | P95 (ms)  | 最大 (ms) | 阈值    | 状态 |
|-------------|-----------|-----------|-----------|---------|------|
| /healthz    | 1.2       | < 5       | 8         | < 50    | ✅   |
| /metrics    | < 500     | -         | -         | < 500   | ✅   |
| /resilience | 1.19      | -         | -         | < 200   | ✅   |

## WebSocket 广播吞吐

| 场景                                | 耗时 (ms) | 阈值    | 状态 |
|-------------------------------------|-----------|---------|------|
| 100 连接 × 1 广播 (200B payload)    | 0.37      | < 500   | ✅   |
| 1 连接 × 1000 顺序广播              | 172.46    | -       | ✅   |
| 单次广播平均 (含 asyncio 调度)      | 0.172     | < 1.0   | ✅   |

## 韧性模块开销 (per call)

| 组件            | 平均 (ms) | P95 (ms)  | 阈值     | 状态 |
|-----------------|-----------|-----------|----------|------|
| CircuitBreaker  | 0.001     | 0.001     | < 0.5    | ✅   |
| RateLimit       | 0.001     | -         | < 0.1    | ✅   |
| DegradedMode    | 0.0001    | -         | < 0.05   | ✅   |

> 韧性包装引入的开销 < 1μs, 对业务零影响

## Prometheus 指标

- /metrics body size: 6.7KB
- 已注册指标 (8 项):
  - zhs_http_requests_total
  - zhs_http_request_duration_seconds
  - zhs_active_connections
  - zhs_websocket_connections
  - zhs_db_pool_in_use
  - zhs_sql_query_duration_seconds
  - zhs_sql_queries_total
  - zhs_sql_slow_queries_total

## 测试套件汇总

- **总用例**: 151 passed, 4 skipped
- **总耗时**: ~48s
- **覆盖率**: 核心模块 85%+

## 回归基线规则

后续 PR 引入性能退化时, 阈值:

- /healthz P95 > 10ms ❌
- WS 100 连接广播 > 5ms ❌
- CircuitBreaker 单次开销 > 0.05ms ❌
- /metrics body > 100KB ❌

跑基线测试:
```bash
pytest tests/test_baseline.py -v -s
```

## 接下来可优化项

1. /metrics 改用 prometheus_client 的 multiprocess 模式 (避免 GIL 抖动)
2. 慢 SQL 阈值 500ms 调整为可配置 (按业务模块差异化)
3. WS 1000 并发连接的真实吞吐压测 (需 staging 环境)
4. APM OTLP exporter 切换为 HTTP/protobuf (部分代理对 gRPC 不友好)
