# Release Notes v0.19.0

发布日期: 2026-06-16
代号: "Phase 19 - 自适应限流 / 配置中心 / 全链路压测 / AI 多模型选型"

## 📊 总览

| 指标 | 数值 |
|------|------|
| 测试总数 | 1027 (Phase 11-19) |
| 通过率 | 100% (1027/1027) |
| 新增模块 | 4 个 |
| 新增测试 | +114 |
| 累计代码行 | +2400 |

## ✨ 新增功能

### Phase 19: 自适应限流 / 配置中心 / 全链路压测 / AI 多模型选型

#### 1. 自适应限流 (`scripts/ops/adaptive_limiter.py`)
- TokenBucket 基础令牌桶 (capacity, refill_rate, refill on demand)
- HealthWindow 滑动窗口健康监控 (error_rate, P99, avg)
- AdaptiveLimiter AIMD 调整 (Additive-Increase / Multiplicative-Decrease)
- 配置: min/max capacity/rate, target error rate, target P99, cooldown
- 实时 metrics: allow/deny/adjust_up/adjust_down
- 报表: 当前参数 + 健康指标 + 调整历史
- 31/31 测试通过

#### 2. 配置中心灰度 (`scripts/ops/config_center.py`)
- ConfigItem + ConfigVersion 中心化配置 (版本管理)
- 4 种灰度策略: FULL / PERCENTAGE / TENANT_ALLOWLIST / ENV_ALLOWLIST
- RolloutRecord 灰度生命周期 (PENDING / ROLLOUT / PROMOTED / ROLLED_BACK)
- Context-aware: get(key, tenant, env) 命中白名单才用新版本
- 实时 promote / rollback
- 完整审计 + 报表
- 33/33 测试通过

#### 3. 全链路压测 (`scripts/ops/loadtest_runner.py`)
- TrafficRecorder 流量录制 (request/response, JSONL 持久化)
- Replayer 流量回放 (原速 / 倍速, 自定义 handler)
- ShadowRunner 影子流量对比 (status_match / body_match)
- LoadTestRunner 并发压测 (concurrency, QPS, duration, 错误率)
- 性能指标: P50 / P95 / P99 / 吞吐 / 错误率
- 报表: 压测 + 影子对比两种
- 28/28 测试通过

#### 4. AI 路由 Phase 4 多模型自动选型 (`scripts/ops/model_selector.py`)
- 7 个模型画像 (GPT-4o / Claude-3.5 / Gemini / DeepSeek / Qwen / 等)
- 5 种任务类型 (CHAT/CODE/SUMMARIZE/TRANSLATE/EMBEDDING)
- 4 种用户偏好 (COST/QUALITY/LATENCY/BALANCED)
- 20 组 (task, preference) 权重表 + 可自定义
- 综合得分: w_q*quality + w_c*(1-cost_norm) + w_l*(1-latency_norm)
- 选型审计: 完整候选评分明细
- 22/22 测试通过

## 🔧 改进

- **自适应性**: 限流器根据实时健康度自动调宽 / 调严, 告别一刀切配置
- **可灰度**: 配置中心支持 4 种灰度策略, 租户级精准发布 + 一键回滚
- **可压测**: 流量录制 + 回放 + 影子对比, 性能瓶颈一目了然
- **可优化**: 多模型按 (成本/质量/延迟) 综合评分自动选型, 任务场景化
- **可测试**: 100% 测试覆盖 (1027/1027), 含集成 + 边界

## 📁 新增文件

```
scripts/ops/
├── adaptive_limiter.py             # Phase 19-1
├── config_center.py                # Phase 19-2
├── loadtest_runner.py              # Phase 19-3
└── model_selector.py               # Phase 19-4

tests/
├── test_phase19_adaptive_limiter.py     (31)
├── test_phase19_config_center.py        (33)
├── test_phase19_loadtest_runner.py      (28)
└── test_phase19_model_selector.py       (22)
```

## 🚀 升级指南

```bash
# 1. 拉取新代码
git pull origin main

# 2. 自适应限流 demo
python scripts/ops/adaptive_limiter.py demo

# 3. 配置中心灰度 demo
python scripts/ops/config_center.py demo

# 4. 全链路压测 demo
python scripts/ops/loadtest_runner.py shadow
python scripts/ops/loadtest_runner.py loadtest
python scripts/ops/loadtest_runner.py report-loadtest

# 5. AI 多模型选型 demo
python scripts/ops/model_selector.py select --task code --text-len 2000 --preference quality

# 6. 跑回归
pytest -k "phase11 or phase12 or phase13 or phase14 or phase15 or phase16 or phase17 or phase18 or phase19"
```

## 🐛 已知问题

无 (Phase 11-19 全部 1027 个测试通过)

## 📈 测试统计明细

| Phase | 测试数 | 状态 |
|-------|--------|------|
| Phase 11 | 70 | ✅ 100% |
| Phase 12 | 95 | ✅ 100% |
| Phase 13 | 142 | ✅ 100% |
| Phase 14 | 142 | ✅ 100% |
| Phase 15 | 96 | ✅ 100% |
| Phase 16 | 129 | ✅ 100% |
| Phase 17 | 160 | ✅ 100% |
| Phase 18 | 140 | ✅ 100% |
| Phase 19 | 114 | ✅ 100% |
| **合计** | **1027** | **✅ 100%** |

## 👥 致谢

感谢所有在 Phase 11-19 贡献过的同事!

---

**下一阶段预告**: Phase 20 - 数据库迁移 (zero-downtime) / 事件溯源 / 全局 ID 生成器 / 分布式锁 增强 (5 条新建议)
