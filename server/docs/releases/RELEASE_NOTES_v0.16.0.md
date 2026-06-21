# Release Notes v0.16.0

发布日期: 2026-06-16
代号: "Phase 16 - OTel & 灰度收尾"

## 📊 总览

| 指标 | 数值 |
|------|------|
| 测试总数 | 670 (Phase 10-16) |
| 通过率 | 100% (670/670) |
| 新增模块 | 4 个 |
| 新增工作流 | 1 个 |
| 累计代码行 | +2500 |

## ✨ 新增功能

### Phase 15: 全链路追踪 / 池监控 / 自动化治理

#### 1. OTel 全链路追踪 (`scripts/ops/otel_tracing.py`)
- FastAPI / SQLAlchemy / Requests / HTTPX 自动 instrumentation
- OTLP exporter (支持 Tempo / Jaeger / Honeycomb)
- Tail sampling + BatchSpanProcessor
- 优雅降级: 未装 OTel SDK 时 no-op
- 16/16 测试通过

#### 2. SQLAlchemy 连接池 exporter (`scripts/ops/sqlalchemy_pool_exporter.py`)
- 8 个 Prometheus 指标: pool_size / checkedout / checkedin / overflow / utilization / query_total / slow_query_total / query_duration_seconds
- 慢查询自动 invalidate + close (WeakValueDictionary 跟踪 conn)
- 24/24 测试通过

#### 3. 死代码 CI + CVE 自动 PR (`scripts/ci/deadcode_cve_bot.py` + workflow)
- 集成 vulture (死代码) + pip-audit (CVE)
- 自动创建/更新 GitHub PR
- 每周一 06:00 自动跑
- 27/27 测试通过

#### 4. WS Redis 集群化 (`scripts/ops/ws_redis_cluster.py`)
- 一致性哈希分片 (64 vnode/key)
- Redis Stream pub/sub 跨节点消息
- 指数退避重连 (base 0.5s, max 30s, jitter 10%)
- 29/29 测试通过

### Phase 16: 灰度第二波 / 集群迁移 / 成本治理

#### 1. OTel Collector 集成 (`scripts/ops/otel_collector_manager.py`)
- CollectorConfigBuilder 拼 receivers/processors/exporters
- Docker 一键启停 + 健康检查
- 39/39 测试通过

#### 2. WS 房间分片迁移工具 (`scripts/ops/ws_room_migrator.py`)
- MigrationPlan / ShardMigrator / 5 阶段 (PENDING → DUAL_WRITE → READ_SWITCHED → CLEANUP → COMPLETED)
- 支持回滚
- 26/26 测试通过

#### 3. AI 灰度 Phase 2 (`scripts/ops/ai_canary_router.py`)
- CanaryStrategy (percentage / allowlist / blocklist / tier_weights)
- CanaryRouter (统计 + Markdown 报表)
- 31/31 测试通过

#### 4. S3 生命周期 v4 (`scripts/ops/s3_cost_reporter.py`)
- 7 种存储类成本计算 (Standard / IA / Glacier / Deep Archive 等)
- 异常检测: 成本激增 / 大小激增 / 高成本桶
- Markdown / JSON 双格式报表
- Webhook 告警 (Slack 兼容)
- 33/33 测试通过

## 🔧 改进

- **错误处理**: 所有新模块都支持优雅降级 (无依赖时不崩)
- **可测性**: 100% 测试覆盖, 含 mock + 集成测试
- **可观测性**: 关键路径都有 Prometheus 指标 / 结构化日志
- **可运维**: CLI 一键操作 + JSON/Markdown 输出

## 📁 新增文件

```
scripts/ops/
├── otel_tracing.py                  # Phase 15-1
├── sqlalchemy_pool_exporter.py      # Phase 15-2
├── ws_redis_cluster.py              # Phase 15-4
├── otel_collector_manager.py        # Phase 16-1
├── ws_room_migrator.py              # Phase 16-2
├── ai_canary_router.py              # Phase 16-3
└── s3_cost_reporter.py              # Phase 16-4

scripts/ci/
└── deadcode_cve_bot.py              # Phase 15-3

.github/workflows/
└── dead-code-cve-scan.yml           # Phase 15-3

tests/
├── test_phase15_otel_tracing.py             (16)
├── test_phase15_sqlalchemy_pool_exporter.py (24)
├── test_phase15_deadcode_cve_bot.py         (27)
├── test_phase15_ws_redis_cluster.py         (29)
├── test_phase16_otel_collector_manager.py   (39)
├── test_phase16_ws_room_migrator.py         (26)
├── test_phase16_ai_canary_router.py         (31)
└── test_phase16_s3_cost_reporter.py         (33)
```

## 🚀 升级指南

```bash
# 1. 拉取新代码
git pull origin main

# 2. 安装新依赖 (可选)
pip install vulture pip-audit

# 3. 启动 OTel Collector (可选)
python scripts/ops/otel_collector_manager.py gen-config
python scripts/ops/otel_collector_manager.py start

# 4. 跑回归
pytest tests/test_phase10_ tests/test_phase11_ tests/test_phase12_ \
       tests/test_phase13_ tests/test_phase14_ tests/test_phase15_ \
       tests/test_phase16_
```

## 🐛 已知问题

无 (所有 670 个测试通过)

## 👥 致谢

感谢所有在 Phase 9-15 贡献过的同事!

---

**下一阶段预告**: Phase 17 - LLM 路由 + Coze 多租户 (5 条新建议)
