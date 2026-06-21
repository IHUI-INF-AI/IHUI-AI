# Patroni 高可用集群生产部署指南

## 概述

本文档描述 PostgreSQL Patroni 高可用集群的生产部署流程，采用 3 节点 etcd + 3 节点 Patroni + HAProxy 架构，实现自动故障转移和读写分离。

## 架构

```
                    ┌─────────────┐
                    │  HAProxy    │
                    │  :5000 (W)  │
                    │  :5001 (R)  │
                    │  :7000 (S)  │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
   │Patroni1 │        │Patroni2 │        │Patroni3 │
   │  :5432  │        │  :5442  │        │  :5452  │
   │  :8008  │        │  :8018  │        │  :8028  │
   └────┬────┘        └────┬────┘        └────┬────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │  etcd 集群   │
                    │  3 节点 Raft │
                    └─────────────┘
```

## 组件

| 组件 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| etcd1/2/3 | quay.io/coreos/etcd:v3.5.12 | 2379/2380 | 分布式 KV 存储 |
| patroni1/2/3 | ghcr.io/zalando/spilo-15:2.1-p9 | 5432/8008 | PostgreSQL + Patroni |
| haproxy | haproxy:2.8-alpine | 5000/5001/7000 | 读写路由 + stats |

## 部署流程

### 1. 预检 (dry-run)

```bash
./scripts/deploy_patroni_production.sh --dry-run
```

预检内容：
- docker 可用
- `docker-compose.patroni-ha.yml` 存在
- `docker/haproxy/haproxy.cfg` 存在
- `patroni_failover_drill.sh` 存在

### 2. 生产部署

```bash
./scripts/deploy_patroni_production.sh
```

执行步骤：
1. **预检** - 检查工具和配置
2. **部署 etcd** - 启动 3 节点 etcd 集群
3. **部署 Patroni** - 启动 3 节点 Patroni，等待主节点选举
4. **部署 HAProxy** - 启动读写路由
5. **集群验证** - 验证集群状态和端口连通性
6. **故障转移演练** - 执行 `patroni_failover_drill.sh`
7. **生成报告** - JSON 格式部署报告

### 3. 验证

```bash
# 查看集群状态
docker compose -f deploy/docker/docker-compose.patroni-ha.yml exec patroni1 patronictl list

# HAProxy stats
open http://localhost:7000  # admin/admin123

# 写端口测试
psql -h localhost -p 5000 -U zhs -d postgres -c "SELECT pg_is_in_recovery();"
# 应返回 f (false, 主节点)

# 读端口测试
psql -h localhost -p 5001 -U zhs -d postgres -c "SELECT pg_is_in_recovery();"
# 可能返回 t (true, 从节点)
```

## 端口说明

| 端口 | 用途 | 路由 |
|------|------|------|
| 5000 | 写端口 | 仅主节点 (Patroni /primary 健康检查) |
| 5001 | 读端口 | 所有节点轮询 |
| 7000 | HAProxy stats | 管理界面 (admin/admin123) |
| 8008 | Patroni REST API | 健康检查 (/primary, /replica) |
| 5432/5442/5452 | PostgreSQL | 直连 (调试用) |

## 故障转移

### 自动故障转移

Patroni 检测主节点故障后：
1. etcd 选举新主 (Raft 协议)
2. 提升 replica 为新 primary
3. 更新 HAProxy 健康检查
4. 写流量自动切换到新主

预期切换时间: 10-30 秒

### 手动故障转移

```bash
docker compose -f deploy/docker/docker-compose.patroni-ha.yml exec patroni1 \
  patronictl switchover --scope=zhs
```

### 故障转移演练

```bash
./scripts/patroni_failover_drill.sh
```

演练流程：
1. 查询集群状态
2. 模拟主节点故障
3. 等待自动故障转移
4. 验证新主选举
5. 验证 HAProxy 路由
6. 恢复原主
7. 验证集群恢复

## 回滚

```bash
# 停止 Patroni 集群
docker compose -f deploy/docker/docker-compose.patroni-ha.yml down

# 恢复单节点 PostgreSQL
docker compose up -d postgres
```

## 部署报告

JSON 格式报告示例：

```json
{
  "timestamp": "2026-06-18T03:00:00Z",
  "operation": "patroni_production_deploy",
  "status": "success",
  "duration_seconds": 300,
  "cluster": {
    "scope": "zhs",
    "nodes": 3,
    "etcd_endpoints": ["http://etcd1:2379", "http://etcd2:2379", "http://etcd3:2379"],
    "leader": "patroni1",
    "haproxy_write_port": 5000,
    "haproxy_read_port": 5001,
    "haproxy_stats_port": 7000
  },
  "log_file": "logs/patroni_deploy_20260618_030000.log"
}
```

## 验证测试

```bash
python scripts/test_patroni_production_deploy.py
```
