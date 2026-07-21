# 性能基线（Performance Baseline）

> 等价自旧架构 `server/docs/PERFORMANCE_BASELINE.md`，适配新架构（TS Monorepo + Fastify + Drizzle）。

## 1. 概述

本文档定义 IHUI-AI 各核心端点的性能基线（SLA），作为容量规划、压测验收与回归监控的依据。基线数据基于 Locust 压测（`locustfile.py`）与 Prometheus 指标得出。

## 2. 硬件基准

| 角色       | 规格  | 说明            |
| ---------- | ----- | --------------- |
| API 服务   | 4C8G  | Fastify 单实例  |
| Web 服务   | 2C4G  | Next.js 单实例  |
| PostgreSQL | 8C16G | 主从，连接池 50 |
| Redis      | 2C4G  | 缓存 + 限流     |
| AI Service | 4C8G  | Python FastAPI  |

## 3. 核心端点 SLA

| 端点                     | P50   | P95   | P99   | 错误率 | 说明               |
| ------------------------ | ----- | ----- | ----- | ------ | ------------------ |
| `GET /api/health`        | 20ms  | 50ms  | 100ms | <0.01% | 健康检查           |
| `GET /api/auth/me`       | 30ms  | 80ms  | 150ms | <0.1%  | 鉴权链路           |
| `GET /api/content/list`  | 50ms  | 150ms | 300ms | <0.1%  | 内容列表（含缓存） |
| `GET /api/chat/sessions` | 80ms  | 200ms | 400ms | <0.1%  | 会话列表           |
| `POST /api/chat` (SSE)   | 800ms | 2s    | 5s    | <1%    | AI 对话首 Token    |
| `POST /api/files/upload` | 200ms | 800ms | 2s    | <0.5%  | 小文件上传         |
| `WS /ws`                 | 100ms | 300ms | 600ms | <0.1%  | WebSocket 握手     |

## 4. 数据库性能基线

| 指标          | 基线   | 告警阈值                   |
| ------------- | ------ | -------------------------- |
| 活跃连接数    | <20    | >40 warning / >48 critical |
| 慢查询（>1s） | <5/min | >20/min                    |
| 缓存命中率    | >95%   | <90%                       |
| 复制延迟      | <1s    | >5s                        |
| 死锁          | 0      | >0                         |
| 事务平均耗时  | <50ms  | >200ms                     |

## 5. 压测验收标准

使用 `locustfile.py` 执行压测，验收需满足：

- **100 并发**：P95 达标，错误率 <0.1%
- **500 并发**：P95 ≤ 基线 ×2，错误率 <1%
- **1000 并发**：服务不崩溃，错误率 <5%，触发限流而非超时

```bash
# 验收压测命令
locust -f locustfile.py --headless \
    --host http://localhost:3000 \
    --users 100 --spawn-rate 10 --run-time 120s
```

## 6. 性能回归监控

- Prometheus 采集 API 延迟直方图（`apps/api/src/plugins/metrics.ts`）。
- Grafana dashboard `api-performance.json` 展示 P50/P95/P99 趋势。
- 告警规则见 `monitoring/prometheus/alerts.yml`，超基线阈值触发告警。
- 每周回归压测由 `.github/workflows/ws-loadtest.yml` 自动执行。

## 7. 性能优化 checklist

- [ ] 新增查询走索引，避免全表扫描
- [ ] 列表接口强制分页，单页 ≤100
- [ ] N+1 检测器（`n1-detector.ts`）无告警
- [ ] 热点数据加 Redis 缓存
- [ ] 大响应启用 gzip 压缩（`compression.ts`）
- [ ] 慢 SQL 杀手（`slow-sql-killer.ts`）生效
