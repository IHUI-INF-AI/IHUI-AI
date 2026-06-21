# PostgreSQL 跨可用区多活部署方案

> 日期: 2026-06-18
> 范围: zhs-platform 生产环境 PostgreSQL 跨可用区 (AZ) 多活架构
> 结论: **推荐方案 A (Patroni 跨 AZ + 异地灾备)**, RTO < 60s, RPO < 5s

---

## 1. 背景

zhs-platform 生产环境需要跨可用区部署,目标:
- 单 AZ 故障时,业务自动切换到另一 AZ
- RTO < 60s (自动故障转移)
- RPO < 5s (同步复制)
- 异地灾备 (城市级灾难恢复)

---

## 2. 架构

```
┌──────────────── 可用区 A (AZ-A) ────────────────┐  ┌──────── 可用区 B (AZ-B) ────────┐
│                                                 │  │                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐         │  │  ┌─────────┐  ┌─────────┐     │
│  │ Patroni1│  │ etcd1   │  │ HAProxy │         │  │  │ Patroni2│  │ etcd2   │     │
│  │ (Leader)│  │         │  │  (写)   │         │  │  │(Replica)│  │         │     │
│  └────┬────┘  └────┬────┘  └─────────┘         │  │  └────┬────┘  └────┬────┘     │
│       │            │                           │  │       │            │          │
│       └──────┬─────┘                           │  │       └─────┬──────┘          │
│              │  同步复制                        │  │             │                 │
│              └─────────────────────────────────┼──┼─────────────┘                 │
│                                                │  │                                │
└────────────────────────────────────────────────┘  └────────────────────────────────┘

                          │
                          │ 异地灾备 (异步复制)
                          ▼
              ┌─────────────────────────┐
              │  异地灾备中心 (AZ-C)    │
              │  ┌─────────┐            │
              │  │ Patroni3│            │
              │  │(Replica)│            │
              │  └─────────┘            │
              └─────────────────────────┘
```

---

## 3. 部署清单

| 组件 | AZ-A | AZ-B | AZ-C (异地) | 说明 |
|------|------|------|-------------|------|
| Patroni + PG | 1 (Leader) | 1 (Replica) | 1 (Replica) | 同步复制 (AZ-A/B) + 异步 (AZ-C) |
| etcd | 1 | 1 | 0 | 2 节点 + 1 witness (AZ-A) |
| HAProxy | 1 | 1 | 0 | 读写路由 |
| pgBouncer | 1 | 1 | 0 | 连接池 |

---

## 4. 关键配置

### 4.1 Patroni 同步复制

```yaml
# patroni.yml (AZ-A Leader)
postgresql:
  parameters:
    synchronous_commit: "on"
    synchronous_standby_names: "FIRST 1 (patroni2)"
```

### 4.2 异地异步复制

```yaml
# patroni.yml (AZ-C 异地)
postgresql:
  parameters:
    synchronous_commit: "local"  # 本地 WAL 落盘即提交
  # 异步复制 (不等待 AZ-C 确认)
```

### 4.3 HAProxy 跨 AZ 健康检查

```haproxy
backend write_backend
    option tcp-check
    tcp-check expect status 200
    default-server inter 3s rise 2 fall 3
    server patroni1 patroni1.az-a:5432 check port 8008
    server patroni2 patroni2.az-b:5432 check port 8008 backup
```

---

## 5. 灾备演练

### 5.1 AZ-A 故障演练

```bash
# 1. 模拟 AZ-A 故障 (停止 Patroni1)
docker stop patroni1

# 2. 等待自动故障转移 (< 60s)
# Patroni2 (AZ-B) 自动提升为 Leader

# 3. 验证 HAProxy 路由切换
curl http://haproxy.az-b:7000/stats

# 4. 验证业务可用
psql -h haproxy.az-b -p 5000 -U zhs -c "SELECT 1;"

# 5. 恢复 AZ-A
docker start patroni1
# Patroni1 自动加入集群为 Replica
```

### 5.2 异地灾备切换

```bash
# 1. 主集群 (AZ-A/B) 全部故障
docker stop patroni1 patroni2

# 2. 手动提升异地灾备 (AZ-C)
docker exec patroni3 patronictl edit-config --set synchronous_commit=local
docker exec patroni3 pg_ctl promote -D /home/postgres/pgdata

# 3. 更新 DNS/负载均衡指向 AZ-C
# 4. 验证业务可用
psql -h patroni3.az-c:5432 -U zhs -c "SELECT 1;"
```

---

## 6. 监控告警

### 6.1 跨 AZ 复制延迟

```yaml
# rules.yml
- alert: ZHSPgCrossAZReplicationLag
  expr: pg_replication_lag_seconds > 10
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "跨 AZ 复制延迟 > 10s"
```

### 6.2 AZ 故障

```yaml
- alert: ZHSPgAZDown
  expr: count by (az) (pg_up) == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "可用区 {{ $labels.az }} PostgreSQL 全部不可达"
```

---

## 7. RTO/RPO 评估

| 场景 | RTO | RPO | 说明 |
|------|-----|-----|------|
| 单节点故障 | < 30s | 0 | Patroni 自动故障转移 |
| 单 AZ 故障 | < 60s | < 5s | 跨 AZ 同步复制 |
| 双 AZ 故障 | < 30min | < 5min | 异地灾备手动切换 |
| 城市级灾难 | < 4h | < 15min | 异地灾备 + WAL 归档恢复 |

---

## 8. 结论

**推荐方案 A (Patroni 跨 AZ + 异地灾备)**:
1. AZ-A/B 同步复制, RPO < 5s
2. Patroni 自动故障转移, RTO < 60s
3. AZ-C 异地灾备, 应对城市级灾难
4. 现有监控告警已覆盖复制延迟/AZ 故障
5. 与 P0-2 Patroni PoC 架构一致, 可平滑扩展
