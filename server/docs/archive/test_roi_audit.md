# 测试 ROI 分级与减法治理报告 (Phase 12)

> **生成时间**: 2026-06-15
> **基础数据**: pytest --durations=0 完整时长 + AST 解析 + 源码 import 反推
> **测试基线**: 1872 passed / 25 skipped / 0 failed (1897 collected)

---

## 1. 总览

| 指标 | 数值 |
|------|------|
| 测试文件数 | 101 |
| pytest 实际收集 test items | 1897 |
| 全量回归总耗时 | 1390s ≈ 23.2min |
| 单测试平均耗时 | 730ms |
| 单测试最大耗时 | 109.9s (`test_alert_full_chain_drill.py::TestConcurPerfReal::test_eight_concurrent_p99`) |
| **单文件最大耗时** | **296.7s** (`test_alert_full_chain_drill.py`, 20 测试,占全量 21%) |

## 2. 分级标准

**ROI 公式** (文件级):

```
ROI = (avg_value / avg_cost) × (1 - 0.4 × zero_assert_ratio)
```

| 维度 | 范围 | 含义 |
|------|------|------|
| **value** (1-5) | 业务价值 | 文件名特征 (e2e/canary/alert) + 真实断言数 + 覆盖模块数 |
| **cost** (1-5) | 执行成本 | 平均耗时 + 真实上下游 (real_redis/ffmpeg/loadtest) |
| **zero_assert_ratio** | 0-1 | 文件内无 assert / 无 raises 的 test 函数占比 |

**分级阈值**:

| Grade | 条件 | 含义 |
|-------|------|------|
| **A** | ROI ≥ 1.5 & value ≥ 3.5 & zero_assert < 20% | 必留: 高价值低成本, 删了亏 |
| **B** | ROI ≥ 0.9 & value ≥ 2.5 | 标准, 保留 |
| **C** | ROI ≥ 0.5 & value ≥ 2.0 | 可裁: 高价值但成本高, 可优化 |
| **D** | 其他 | 强烈建议删/合并 |

## 3. 分级结果

| Grade | 文件数 | 测试数 | 耗时(s) | 耗时占比 |
|-------|--------|--------|---------|----------|
| **A** | 29 | 603 | 278.7 | 20.0% |
| **B** | 68 | 1299 | 1010.3 | 72.7% |
| **C** | 4 | 76 | 101.0 | 7.3% |
| **D** | 0 | 0 | 0.0 | 0.0% |
| **合计** | 101 | 1978 | 1390.0 | 100% |

> 1978 vs pytest 收集 1897 的 81 个差异:同一 test 函数被 class+module 双重收集导致 AST 重复统计,实际去重后以 pytest 为准 (1897)。

## 4. C 级候选 (可裁,4 文件)

| 文件 | tests | value | cost | zero_assert | roi | 评估 |
|------|-------|-------|------|-------------|-----|------|
| [test_loadtest_thresholds.py](tests/test_loadtest_thresholds.py) | 7 | 3.0 | 5.0 | 0% | 0.60 | **可合并**: 7 个测试全在测 `loadtest_ws.py` 的 CLI argparse, 重复覆盖 `scripts/ci/loadtest_ws.py` 自身已被 `test_ci_workflow.py` 间接覆盖 |
| [test_pg_staging_smoke.py](tests/test_pg_staging_smoke.py) | 33 | 2.5 | 3.0 | 0% | 0.83 | **可合并**: 5 个测 docker-compose yaml 的测试可 parametrize, 9 个测脚本内容的可 parametrize |
| [test_backfill_persister.py](tests/test_backfill_persister.py) | 25 | 3.5 | 4.0 | 0% | 0.88 | **保留**: 跨进程 + 并发 + 截断是高价值测试, 只是平均耗时因 SQLite 文件 I/O 偏高 |
| [test_metrics_business.py](tests/test_metrics_business.py) | 11 | 3.5 | 4.0 | 0% | 0.88 | **保留**: 业务指标端到端 (HLS/notice) 不可缺 |

## 5. B 级 ROI 接近 1.0 的可优化项 (10 文件)

按 ROI 升序,可优化的"准 C 级":

| 文件 | tests | value | cost | zero_assert | roi | 备注 |
|------|-------|-------|------|-------------|-----|------|
| test_logging_trace.py | 9 | 3.0 | 3.0 | 11% | 0.95 | 1 个零断言可疑 |
| test_tencent_signature.py | 17 | 3.0 | 3.0 | 0% | 1.00 | 业务价值中等 |
| test_sync_observability_config.py | 16 | 3.0 | 3.0 | 0% | 1.00 | 测 yaml/diff CLI |
| test_grafana_dashboards.py | 19 | 3.0 | 3.0 | 0% | 1.00 | 与 phase6d 重复 |
| test_db_pool_metrics.py | 6 | 3.0 | 3.0 | 0% | 1.00 | 与 db_per_tenant 部分重叠 |
| test_resilience.py | 36 | 3.0 | 3.0 | 0% | 1.00 | 含熔断/限流/重试,保留 |
| test_ws_manager.py | 6 | 3.0 | 3.0 | 0% | 1.00 | 与 cluster/real_redis 三件套 |
| test_ws_manager_cluster.py | 8 | 3.0 | 3.0 | 0% | 1.00 | 8 测试, 加载测试在 |
| test_ws_pubsub_cluster.py | 2 | 3.0 | 3.0 | 0% | 1.00 | 仅 2 测试, 与 cluster 重复 |
| test_drill_alert_routing.py | 16 | 5.0 | 4.0 | 0% | 1.25 | 高价值演练 |

## 6. 零断言测试 (Top 10 嫌疑)

虽然 `pytest.raises(...)` 包装的断言被记为"零断言",但仍有相当数量"纯 assert exists"或"无 assert"的测试值得审视:

| 文件 | 零断言 / 总数 | 比例 | 备注 |
|------|---------------|------|------|
| test_biz_alerts.py | 18 / 30 | 60% | **最高**, 大概率是 yaml 字符串存在性检查 + pytest.raises |
| test_pydantic_v2_migration.py | 5 / 29 | 17% | 5 个用 pytest.raises 的负向测试 |
| test_shadow_ratio_controller.py | 3 / 34 | 9% | 错误容忍路径 |
| test_orm_tenant_base.py | 2 / 23 | 9% | 边界检查 |
| test_persister_metrics_phase5a.py | 1 / 16 | 6% | |
| test_user_tenant_migration.py | 1 / 15 | 7% | |
| test_heat_stats_task.py | 1 / 9 | 11% | |
| test_logging_trace.py | 1 / 9 | 11% | |
| test_baseline.py | 1 / 10 | 10% | |
| test_canary.py | 1 / 38 | 3% | |

## 7. 源码覆盖反推

| 指标 | 数值 |
|------|------|
| app/* 模块总数 | 209 |
| 有测试覆盖的模块 | 35 (17%) |
| **未覆盖模块** | 184 |
| 被最多次重复覆盖 | `app.api` (16 文件), `app.config` (11 文件), `app.canary_stages` (12 文件) |

**重复覆盖的"过度测"嫌疑**:
- `app.config`: 11 文件 (大多是因为 import settings 副作用, 真实测试的是各自业务模块, 不算重复)
- `app.canary_stages`: 12 文件 / 243 测试 → 真实高复用模块, **不应减测**
- `app.api`: 16 文件 → 主要是各端点测试, 不算重复

**未覆盖的 184 模块** 中明显是新增 Phase 10/11 模块:
- `app.alert_pagerduty` / `app.alert_service` / `app.alert_webhook` / `app.alert_upstream_mocks` — 实际上有专门的 `test_alert_pagerduty.py` / `test_alert_e2e_all_channels.py` / `test_alert_full_chain_drill.py`, 但 AST 解析的 import 路径取第一段, 把 `app.services.alert_service` 归到 `app.services`, 所以才没看到
- `app.agents` / `app.aigc` / `app.alipay` 等业务模块 — 确实缺单元测试, 需补

## 8. 时长 Top 10 单测试 (高成本)

| 测试 | 耗时(s) | 价值判定 |
|------|---------|----------|
| test_alert_full_chain_drill::TestConcurPerfReal::test_eight_concurrent_p99 | 109.9 | 高价值 (P99 性能基准) |
| test_alert_full_chain_drill::TestEightChannelE2EReal::test_eight_channels_real | 38.4 | 高价值 (8 通道端到端) |
| test_backfill_persister::TestSQLiteBackfillPersister::test_history_truncation | 36.0 | 中价值 (灌 2000 事件可降到 500) |
| test_alert_full_chain_drill::TestEightChannelE2EReal::test_pagerduty_payload_correct | 32.1 | 高价值 |
| test_alert_e2e_all_channels::TestPushDingtalk::test_success | 28.7 | 中价值 (重复于 test_alert_channels) |
| test_alert_full_chain_drill::TestInhibitionInRealE2E::test_inhibition_applies | 27.2 | 高价值 |
| test_alert_full_chain_drill::TestInhibitionInRealE2E::test_inhibition_after_push_7_channels | 26.5 | 高价值 |
| test_alert_full_chain_drill::TestDedupStabilityReal::test_same_source_same_dedup_key | 24.7 | 高价值 |
| test_alert_full_chain_drill::TestFailureIsolationReal::test_slack_retry | 24.0 | 高价值 |
| test_loadtest_thresholds::test_loadtest_runs_with_default_threshold_small | 2.9 | 低价值 (重复 6 次类似) |

## 9. 减法候选清单 (供决策)

按"减法收益 / 风险"排序:

### 9.1 强烈建议合并 (风险低, 收益明显)

1. **`tests/test_loadtest_thresholds.py`** (7 测试, ROI 0.60)
   - 现状: 7 个测试全在测 `loadtest_ws.py --miss-ratio-max` 的 CLI 行为
   - 减法: 合并到 `test_loadtest_ws.py` (如果存在) 或归并到 `test_ci_workflow.py`
   - 收益: 节省 13.5s + 1 个文件维护成本
   - 风险: 极低 (功能已在 scripts/ci/ 集成)

2. **`tests/test_pg_staging_smoke.py`** (33 测试, ROI 0.83)
   - 现状: 33 个测试, 9 个测脚本内容, 5 个测 docker-compose, 9 个测 pgloader conf
   - 减法: 用 parametrize 把 5 个 docker-compose 测试合并成 1 个 + 9 个 pgloader 测试合并
   - 收益: 33 → ~20 测试, 节省 ~10s
   - 风险: 极低

### 9.2 强烈建议补测 (加法, 不是减法)

虽然报告主题是"减法",但**未覆盖的 184 个 app 模块** 中:
- `app.agents` / `app.aigc` / `app.alipay` / `app.canary` / `app.remote_video` 等**业务核心模块** 单元测试稀缺
- 这意味着: 减法的反面是"有些测试是浪费",而"有些模块根本没测"
- 建议: Phase 13 可针对未覆盖模块,补 50-80 个高 ROI 单元测试

### 9.3 不建议减 (高价值, 删了亏)

- `test_alert_*` (Phase 10-11) — 告警 8 通道端到端, 全链路 5 分钟投资
- `test_canary_*` — 金丝雀核心, 12 文件 / 243 测试 ROI 1.5+
- `test_pydantic_v2_migration.py` — 技术债回归, 防退化
- `test_check_*` — 5 个 check 脚本测试, CI 阻断线

## 10. ROI 分析器

工具代码: [scripts/ci/test_roi_analyzer.py](scripts/ci/test_roi_analyzer.py)
- 复用: `python scripts/ci/test_roi_analyzer.py` 即可重跑
- 维护: 改 `HIGH_VALUE_KEYS` / `HIGH_COST_KEYS` 调整权重
- 局限: AST 解析不到动态 import, 部分 import 路径聚合到顶级包误判

---

## 11. 决策点

请选择下一步:

- **A. 执行 §9.1 的减法**: 合并 `test_loadtest_thresholds.py` + 精简 `test_pg_staging_smoke.py`
- **B. 反向加法**: 补 `app.agents/aigc/alipay` 等 184 个未覆盖模块的单元测试
- **C. 双向**: 减法 + 选 3-5 个核心模块补测
- **D. 暂缓**: 标记"高 ROI 测试已足够",不再治理
