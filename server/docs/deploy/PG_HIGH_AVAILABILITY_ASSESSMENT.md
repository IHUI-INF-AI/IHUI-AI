# PostgreSQL 高可用方案评估

> 评估日期: 2026-06-18
> 评估范围: zhs-platform 生产环境 PostgreSQL 14+ 高可用架构选型
> 评估结论: **推荐方案 B (Patroni + etcd)**, 兼顾成熟度、自动化故障转移与社区支持

---

## 1. 背景与目标

zhs-platform 生产环境使用 3 个 PostgreSQL 库:
- `zhs_ai_project` (AI 模块)
- `zhs_center_project` (中心模块)
- `zhs_educational_training` (教育培训模块)

当前为单实例部署, 存在单点故障风险。本评估旨在选型高可用方案, 目标:
- RTO (恢复时间目标) < 30s
- RPO (恢复点目标) < 5s (数据丢失)
- 自动故障转移, 无需人工干预
- 读写分离支持读密集型场景

---

## 2. 方案对比

### 方案 A: 流复制 + 手动切换 (最简方案)

| 维度 | 评估 |
|------|------|
| 架构 | 1 主 + 1 从, 异步流复制 |
| 故障转移 | 手动 pg_ctl promote, 需运维介入 |
| RTO | 5-15 分钟 (人工介入) |
| RPO | 接近 0 (异步复制, 少量事务可能丢失) |
| 优点 | 架构简单, 无额外组件, PostgreSQL 原生支持 |
| 缺点 | 无自动故障转移, RTO 长, 人工易出错 |
| 适用 | 开发/测试环境, 非核心业务 |

### 方案 B: Patroni + etcd (推荐)

| 维度 | 评估 |
|------|------|
| 架构 | 3 节点 Patroni + etcd 集群, 自动选主 |
| 故障转移 | 自动 (Patroni 监控 + etcd 选举), < 30s |
| RTO | < 30s |
| RPO | < 5s (同步复制模式) |
| 优点 | 成熟开源 (Zalando 生产验证), 自动故障转移, 支持 K8s, HAProxy/pgBouncer 集成 |
| 缺点 | 需额外 etcd 集群 (3 节点), 运维复杂度中等 |
| 适用 | 生产环境, 中大型业务 |

### 方案 C: Stolon (K8s 原生)

| 维度 | 评估 |
|------|------|
| 架构 | K8s 原生, sentinel + keeper + proxy |
| 故障转移 | 自动 (sentinel 选举), < 60s |
| RTO | < 60s |
| RPO | < 10s |
| 优点 | K8s 原生, CRD 管理, 与 Helm 集成好 |
| 缺点 | 社区活跃度低于 Patroni, 文档较少, 复杂度高 |
| 适用 | K8s 深度用户 |

### 方案 D: 云托管 RDS (阿里云/腾讯云)

| 维度 | 评估 |
|------|------|
| 架构 | 云厂商托管, 主备 + 只读 |
| 故障转移 | 自动 (云厂商保障), < 30s |
| RTO | < 30s |
| RPO | < 5s |
| 优点 | 免运维, 自动备份, 监控集成, SLA 保障 |
| 缺点 | 成本高 (月费 2000-5000 元), 厂商锁定 |
| 适用 | 预算充足, 无专职 DBA |

---

## 3. 推荐方案: Patroni + etcd

### 3.1 架构图

```
                    ┌──────────────────────────────────────────┐
                    │           应用层 (zhs-platform)           │
                    │     pgBouncer (连接池) / HAProxy (路由)   │
                    └──────────────────┬───────────────────────┘
                                       │
                    ┌──────────────────┴───────────────────────┐
                    │           Patroni (3 节点)               │
                    │  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
                    │  │  PG-1   │  │  PG-2   │  │  PG-3   │  │
                    │  │ (Leader)│  │(Replica)│  │(Replica)│  │
                    │  └────┬────┘  └────┬────┘  └────┬────┘  │
                    └───────┼────────────┼────────────┼───────┘
                            │            │            │
                    ┌───────┴────────────┴────────────┴───────┐
                    │           etcd (3 节点集群)              │
                    │     选举 + 配置存储 + 健康检查           │
                    └──────────────────────────────────────────┘
```

### 3.2 部署清单

| 组件 | 副本数 | 资源配额 | 说明 |
|------|--------|----------|------|
| Patroni + PostgreSQL | 3 | 2C/4G each | 1 Leader + 2 Replica |
| etcd | 3 | 0.5C/1G each | Raft 一致性集群 |
| HAProxy | 2 | 0.5C/512M each | 读写路由 (主写从读) |
| pgBouncer | 2 | 0.5C/512M each | 连接池 (可选) |

### 3.3 故障转移流程

1. Patroni 每 10s 向 etcd 更新 Leader 锁
2. Leader 宕机 → 锁过期 (30s) → etcd 释放锁
3. Replica 节点竞争 Leader 锁 → 最新的 Replica 胜出
4. 新 Leader 执行 `pg_ctl promote` → 升级为主
5. HAProxy 健康检查 (5s 间隔) → 自动切换路由
6. 其他 Replica 重新指向新 Leader → 恢复复制

**预期 RTO: 30-60s**

### 3.4 数据一致性保障

- **同步复制**: `synchronous_commit = on`, `synchronous_standby_names = FIRST 1`
- **etcd 持久化**: Leader 锁 + 最后 LSN 位置, 确保脑裂时数据不丢
- **fencing**: Patroni 支持 fence 模式, 防止旧主继续写入

---

## 4. 实施路线图

| 阶段 | 任务 | 周期 |
|------|------|------|
| P0 | etcd 集群部署 (3 节点) | 1 天 |
| P0 | Patroni + PostgreSQL 部署 (3 节点) | 2 天 |
| P1 | HAProxy + pgBouncer 部署 | 1 天 |
| P1 | 应用层连接串切换 (pgBouncer) | 0.5 天 |
| P2 | 故障转移演练 (kill -9 主节点) | 1 天 |
| P2 | 监控集成 (postgres-exporter + Patroni metrics) | 1 天 |
| P3 | 备份策略调整 (pg_basebackup + WAL 归档) | 1 天 |

**总周期: 7.5 天**

---

## 5. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| etcd 集群不可用 | 低 | 高 (无法选举) | 3 节点跨可用区部署, 监控 etcd 健康 |
| 脑裂 (split-brain) | 低 | 高 (数据冲突) | Patroni fencing + synchronous_commit |
| 复制延迟过大 | 中 | 中 (从库读旧数据) | 监控 pg_replication_lag, 告警 > 30s |
| 故障转移失败 | 低 | 高 (服务中断) | 定期演练, 手动 promote 兜底 |

---

## 6. 与现有架构的集成

### 6.1 Helm chart 改造

当前 `values.yaml` 中 database 配置指向单实例:
```yaml
database:
  ai:
    host: pg-ai.zhs.svc.cluster.local
    port: 5432
```

高可用后改为指向 HAProxy/pgBouncer:
```yaml
database:
  ai:
    host: pg-ai-haproxy.zhs.svc.cluster.local  # HAProxy VIP
    port: 5432
```

### 6.2 监控集成

现有 `postgres-exporter` 已部署, 高可用后需:
- 每个 Patroni 节点部署一个 exporter
- 新增 Patroni metrics (patroni_master, patroni_xlog_location)
- 告警规则 `ZHSPgReplicationLag` / `ZHSPgReplicationBroken` 已就绪

### 6.3 备份策略

现有 `backup_pg.sh` (pg_dump) 适用于逻辑备份, 高可用后:
- 主备份: `pg_basebackup` (物理备份, 从 Replica 节点)
- 增量备份: WAL 归档 (pg_wal + archive_command)
- 恢复: `pg_basebackup` + WAL replay (PITR)

---

## 7. 结论

**推荐方案 B (Patroni + etcd)**, 理由:
1. 成熟开源, Zalando 生产验证, 社区活跃
2. 自动故障转移 RTO < 30s, 满足业务需求
3. 与 K8s/Helm 集成良好, 可通过 StatefulSet 部署
4. 现有监控/告警规则已覆盖复制延迟/中断场景
5. 实施周期 7.5 天, 风险可控

**备选方案**: 若预算充足且无专职 DBA, 可选方案 D (云托管 RDS), 降低运维成本。
