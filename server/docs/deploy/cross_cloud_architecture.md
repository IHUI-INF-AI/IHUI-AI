# 跨云多活架构设计文档

## 概述

ZHS 平台采用三云多活架构, 跨阿里云 (杭州) / 华为云 (深圳) / AWS (东京) 三大公有云, 实现:
- **RPO ≤ 5 秒** (基于 Patroni + WAL streaming + Bucardo)
- **RTO ≤ 60 秒** (基于 HAProxy VIP + 自动故障切换)
- **跨云流量调度** (基于 DNS + GeoIP)

## 架构图

```
                              Global DNS (Cloudflare)
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
   ┌────▼─────┐                  ┌─────▼────┐                   ┌─────▼────┐
   │ 阿里云   │                  │ 华为云   │                   │ AWS 东京 │
   │ 杭州     │                  │ 深圳     │                   │ 亚太    │
   │ (主)     │                  │ (主)     │                   │ (备)    │
   └────┬─────┘                  └────┬─────┘                   └────┬─────┘
        │                              │                              │
   ┌────▼─────┐                  ┌─────▼────┐                   ┌─────▼────┐
   │Patroni A │◄────WAL Stream──►│Patroni B │◄───WAL Stream────►│Patroni C │
   │(Leader)  │                  │(Standby) │                   │(Cascade) │
   └────┬─────┘                  └────┬─────┘                   └────┬─────┘
        │                              │                              │
   ┌────▼─────┐                  ┌─────▼────┐                   ┌─────▼────┐
   │pgBouncer │                  │pgBouncer │                   │pgBouncer │
   │  Write   │                  │  Write   │                   │  Read    │
   │  :6432   │                  │  :6432   │                   │  :6433   │
   └────┬─────┘                  └────┬─────┘                   └────┬─────┘
        │                              │                              │
   ┌────▼─────┐                  ┌─────▼────┐                   ┌─────▼────┐
   │ App Pods │                  │ App Pods │                   │ App Pods │
   │ (5 副本) │                  │ (5 副本) │                   │ (3 副本) │
   └──────────┘                  └──────────┘                   └──────────┘
```

## 三个可用区角色

### 阿里云杭州 (主主)
- **角色**: 主写入 (Active Writer)
- **PostgreSQL**: Patroni Leader
- **副本数**: App 5 副本, read 2 副本
- **特点**: 用户主流量入口, 100% 写入

### 华为云深圳 (主主)
- **角色**: 备用主 (Standby Writer)
- **PostgreSQL**: Patroni Standby (同步复制 RPO=0)
- **副本数**: App 5 副本, read 2 副本
- **特点**: 阿里云故障时自动接管, RTO=30 秒

### AWS 东京 (只读 + 灾备)
- **角色**: 异地灾备 (Disaster Recovery)
- **PostgreSQL**: Patroni Cascade (异步复制 RPO<5s)
- **副本数**: App 3 副本, read 2 副本
- **特点**: 阿里云 + 华为云同时故障时使用, 1 小时内恢复

## 数据流

### 写入流 (Active)
```
用户 → DNS → 阿里云 LB → App Pod → pgBouncer :6432 → Patroni Leader
                                                       │
                                                       ▼
                                              PostgreSQL Primary
                                                       │
                                                       ▼
                                  ┌──────── Synchronous WAL ────────┐
                                  │                                  │
                                  ▼                                  ▼
                          Patroni Standby                    Patroni Cascade
                          (华为云深圳)                        (AWS 东京)
                          RPO=0                              RPO<5s
```

### 读取流 (Load Balanced)
```
用户读请求 → DNS GeoIP → 最近可用区 → pgBouncer :6433 → 任一副本
```

## 故障切换

### 阿里云 Leader 故障
1. Patroni 自动提升华为云 Standby 为 Leader (RTO=15s)
2. DNS 切换到华为云主入口 (TTL=60s)
3. App 自动重连新 Leader
4. AWS 继续从华为云同步

### 阿里云 + 华为云同时故障
1. 人工或 ArgoCD 触发 AWS 接管流程
2. AWS Cascade 提升为 Leader
3. 修改 DNS 切到 AWS (TTL=300s)
4. 1 小时内完成两云重建

### 网络分区
1. Patroni witness 节点 (阿里云 + 华为云 各 1) 仲裁
2. 多数派存活侧保留 Leader
3. 少数派侧自动降级为 Standby

## 一致性保证

| 场景 | 一致性 | RPO | RTO |
|------|--------|-----|-----|
| 单节点故障 | 强一致 | 0 | 15s |
| 单可用区故障 | 强一致 | 0 | 30s |
| 双可用区故障 | 弱一致 | <5s | 60s |
| 三可用区故障 | 数据丢失 | >5s | N/A |

## 流量调度

### DNS 配置 (Cloudflare)
```
api.zhs.example.com  → 阿里云 LB (主)
                     → 华为云 LB (主)
                     → AWS  LB (灾备)

GeoIP 规则:
- 中国 IP → 阿里云 (70%) + 华为云 (30%)
- 亚太 IP → AWS  (50%) + 阿里云 (30%) + 华为云 (20%)
- 其他    → AWS  (100%)
```

### 应用层健康检查
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
```

## 监控与告警

### 关键指标
- **跨云延迟**: 阿里云↔华为云 < 5ms, 阿里云↔AWS < 80ms
- **复制延迟**: 主从延迟 < 1s, 异地延迟 < 5s
- **DNS 解析**: TTL=60s, 解析延迟 < 100ms
- **流量分布**: 三云流量比例监控

### 告警规则
```yaml
- alert: CrossCloudReplicatonLag
  expr: |
    (pg_replication_lag_seconds{instance=~".*huawei.*"} > 1)
    or
    (pg_replication_lag_seconds{instance=~".*aws.*"} > 5)
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "跨云复制延迟超阈值"
```

## 部署清单

### Helm Chart
- `charts/zhs-platform/values-aliyun.yaml`
- `charts/zhs-platform/values-huaweicloud.yaml`
- `charts/zhs-platform/values-aws.yaml`

### ArgoCD Application
- `argocd/argo_application_aliyun.yaml`
- `argocd/argo_application_huaweicloud.yaml`
- `argocd/argo_application_aws.yaml`

### Terraform 基础设施
- `terraform/aliyun/main.tf` (VPC / ECS / RDS / SLB)
- `terraform/huaweicloud/main.tf`
- `terraform/aws/main.tf`

## 容量规划

| 资源 | 阿里云 | 华为云 | AWS | 总计 |
|------|--------|--------|-----|------|
| App Pods | 5 | 5 | 3 | 13 |
| PG 节点 | 3 | 3 | 2 | 8 |
| pgBouncer | 2 | 2 | 1 | 5 |
| 网络带宽 | 10Gbps | 10Gbps | 5Gbps | 25Gbps |
| 存储 | 10TB | 10TB | 20TB | 40TB |

## 成本估算 (月度)

| 云厂商 | 资源费用 | 网络费用 | 总计 |
|--------|---------|---------|------|
| 阿里云杭州 | $12,000 | $2,000 | $14,000 |
| 华为云深圳 | $10,000 | $1,500 | $11,500 |
| AWS 东京 | $6,000 | $1,000 | $7,000 |
| **总计** | **$28,000** | **$4,500** | **$32,500** |

## 实施路线图

### Phase 1 (Q1) - 双活
- 阿里云 + 华为云 双活
- 同步复制 RPO=0
- 自动化故障切换

### Phase 2 (Q2) - 三活
- 加入 AWS 东京
- 异步复制 RPO<5s
- 异地灾备演练

### Phase 3 (Q3) - 优化
- 跨云流量调度
- 自动扩缩容
- 智能 DNS

### Phase 4 (Q4) - 验证
- 跨云故障演练
- 灾备切换演练
- 性能压测

## 附录: 故障切换剧本

### runbook-failover-aliyun-to-huaweicloud.md
1. 确认阿里云故障 (3 次连续健康检查失败)
2. 检查华为云 Standby 状态正常
3. 触发 Patroni 自动 promote (或手动 fence)
4. 等待 30 秒确认新 Leader 选举完成
5. 更新 DNS 记录切到华为云
6. 通知相关人员
7. 监控华为云流量和延迟
8. 阿里云恢复后, 重新加入集群 (作为 Cascade)
