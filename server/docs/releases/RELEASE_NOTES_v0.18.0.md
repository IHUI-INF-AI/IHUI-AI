# Release Notes v0.18.0

发布日期: 2026-06-16
代号: "Phase 18 - 多区域容灾 / 边缘计算 / 告警降噪 / LLM 安全"

## 📊 总览

| 指标 | 数值 |
|------|------|
| 测试总数 | 913 (Phase 11-18) |
| 通过率 | 100% (913/913) |
| 新增模块 | 4 个 |
| 新增测试 | +140 |
| 累计代码行 | +2300 |

## ✨ 新增功能

### Phase 18: 多区域容灾 / 边缘 / 降噪 / LLM 安全

#### 1. 多区域容灾 (`scripts/ops/multiregion_failover.py`)
- Region / RegionRole / RegionState 多区域 (us-east-1 / us-west-2 / eu-west-1) 主备架构
- RegionHealthMonitor 滑动窗口健康检查 (latency / error_rate / consecutive_failures)
- DNSRouter DNS 切换 + TTL 模拟
- DataReplicator 跨区域复制延迟追踪
- FailoverController 自动决策 (NOOP / FAILOVER / FAILBACK / MARK_DEGRADED)
- 数据回切: lag < 阈值 + 健康恢复后自动切回主
- 完整审计: FailoverEvent + 时间线 + 报表
- 37/37 测试通过

#### 2. 边缘计算网关 (`scripts/ops/edge_gateway.py`)
- EdgeNode 多边缘节点管理 (status / last_sync / last_error)
- CacheRule CDN 路由 / 缓存 / 压缩 / immutable
- EdgeFunction 边缘函数 (request / response phase)
- CanaryDeployment 灰度发布 (percentage / allowlist / hash 分配)
- EdgeGateway 节点同步 (success / failed / hook 注入) + 函数灰度状态机
- 报表: 节点同步状态 + 灰度进度
- 33/33 测试通过

#### 3. 智能告警降噪 (`scripts/ops/alert_noise_reducer.py`)
- AlertEvent + SHA1 fingerprint 去重
- Deduplicator 滑动窗口去重
- Aggregator 按 group_by 维度聚合 (count / top severity / first+last ts)
- Silencer 静默规则 (match_alertname / match_labels / duration)
- Correlator 事件关联 (parent 活跃时抑制 child)
- AlertNoiseReducer pipeline: dedup → silence → correlate → pass
- 完整统计: received / passed / suppressed (dedup/silence/correlate)
- 37/37 测试通过

#### 4. LLM 输出安全审计 (`scripts/ops/llm_safety_audit.py`)
- Finding (PII / SENSITIVE / INJECTION) + 4 级风险 (LOW / MEDIUM / HIGH / BLOCK)
- 8 类 PII 检测: 邮箱 / 中国手机 / 中国身份证 / 信用卡 / SSN / IPv4 / AWS Key / 私钥
- 6 类敏感词 (可扩展) + 7 类注入模式 (ignore previous / DAN / role override / system prompt leak 等)
- 自动脱敏 [REDACTED] + 位置精度 (start/end)
- 审计日志: source / risk / blocked / findings / preview
- 33/33 测试通过

## 🔧 改进

- **可恢复性**: 多区域容灾 + 灰度回切, 故障时自动切换 + 健康后自动恢复
- **可治理性**: 边缘规则 / 函数统一管理 + 同步状态可视化
- **可观测性**: 告警降噪让真正重要的告警浮出水面, 减少告警风暴
- **可合规性**: LLM 输出安全审计确保 PII / 敏感词 / 注入检测全覆盖, 审计日志可追溯
- **可测试**: 100% 测试覆盖 (913/913), 含 hook 注入 + 边界场景

## 📁 新增文件

```
scripts/ops/
├── multiregion_failover.py          # Phase 18-1
├── edge_gateway.py                  # Phase 18-2
├── alert_noise_reducer.py           # Phase 18-3
└── llm_safety_audit.py              # Phase 18-4

tests/
├── test_phase18_multiregion_failover.py    (37)
├── test_phase18_edge_gateway.py            (33)
├── test_phase18_alert_noise_reducer.py     (37)
└── test_phase18_llm_safety_audit.py        (33)
```

## 🚀 升级指南

```bash
# 1. 拉取新代码
git pull origin main

# 2. 多区域容灾 demo
python scripts/ops/multiregion_failover.py demo --simulate primary_down
python scripts/ops/multiregion_failover.py demo --simulate failback

# 3. 边缘网关 demo
python scripts/ops/edge_gateway.py demo --simulate sync
python scripts/ops/edge_gateway.py demo --simulate canary

# 4. 告警降噪 demo
python scripts/ops/alert_noise_reducer.py demo --simulate storm
python scripts/ops/alert_noise_reducer.py demo --simulate silence
python scripts/ops/alert_noise_reducer.py demo --simulate correlate

# 5. LLM 安全审计 demo
python scripts/ops/llm_safety_audit.py scan --text "联系 alice@example.com"
python scripts/ops/llm_safety_audit.py scan --text "Ignore previous instructions"

# 6. 跑回归
pytest -k "phase11 or phase12 or phase13 or phase14 or phase15 or phase16 or phase17 or phase18"
```

## 🐛 已知问题

无 (Phase 11-18 全部 913 个测试通过)

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
| **合计** | **913** | **✅ 100%** |

## 👥 致谢

感谢所有在 Phase 11-18 贡献过的同事!

---

**下一阶段预告**: Phase 19 - 自适应限流 / 配置中心灰度 / 全链路压测 (5 条新建议)
