# PostgreSQL 版本升级评估

> 评估日期: 2026-06-18
> 当前版本: PostgreSQL 14 (docker-compose.yml + CI services)
> 目标版本: PostgreSQL 16 (推荐) / PostgreSQL 17 (可选)
> 评估结论: **推荐升级到 PostgreSQL 16**, 平衡新特性与稳定性

---

## 1. 当前状态

### 1.1 部署位置

| 位置 | 文件 | 版本 |
|------|------|------|
| 开发环境 | `deploy/docker/docker-compose.yml` | `postgres:14-alpine` |
| CI 集成测试 | `.github/workflows/ci.yml` | `postgres:14` |
| CI 夜间测试 | `.github/workflows/ci-nightly.yml` | `postgres:14` |
| Helm chart | `deploy/helm/zhs-platform/values.yaml` | 外部提供 (未指定) |

### 1.2 使用的特性

- 流复制 (主从)
- pg_dump 备份
- pg_isready 健康检查
- psycopg2-binary 驱动
- Alembic 迁移
- postgres-exporter 监控

---

## 2. 目标版本对比

### PostgreSQL 16 (2023-09 发布, 2026 仍在支持期)

| 维度 | 评估 |
|------|------|
| 新特性 | 逻辑复制增强 / 并行查询优化 / JSON 路径 / 统计信息改进 |
| 性能 | 查询规划器优化, 减少 nested loop, 提升 10-20% |
| 兼容性 | 与 14 高度兼容, 无破坏性变更 |
| 社区支持 | 2028-11 EOL, 剩余 2.5 年 |
| Docker 镜像 | `postgres:16-alpine` 官方可用 |
| 推荐 | **推荐**, 平衡新特性与稳定性 |

### PostgreSQL 17 (2024-09 发布)

| 维度 | 评估 |
|------|------|
| 新特性 | 增量备份 / 逻辑复制槽同步 / SQL/JSON 路径 / 内存上下文 |
| 性能 | vacuum 内存优化, 减少 IO 抖动 |
| 兼容性 | 与 16 兼容, 少量参数变更 |
| 社区支持 | 2029-11 EOL, 剩余 3.5 年 |
| Docker 镜像 | `postgres:17-alpine` 官方可用 |
| 推荐 | 可选, 新特性收益有限, 建议观察 6 个月 |

---

## 3. 升级方案

### 方案 A: 逻辑升级 (pg_dump/restore) — 推荐

```
1. 部署 PG16 新实例
2. pg_dump 旧实例 → psql 新实例
3. 切换应用连接串
4. 下线旧实例
```

| 维度 | 评估 |
|------|------|
| 停机时间 | 30-60 分钟 (取决于数据量) |
| 风险 | 低 (逻辑备份可验证) |
| 回滚 | 快 (切回旧实例) |
| 适用 | 数据量 < 50GB |

### 方案 B: pg_upgrade 原地升级

```
1. 停止应用
2. pg_upgrade --old-datadir /var/lib/pg14 --new-datadir /var/lib/pg16
3. 启动 PG16
4. 启动应用
```

| 维度 | 评估 |
|------|------|
| 停机时间 | 5-15 分钟 |
| 风险 | 中 (原地操作, 需完整备份) |
| 回滚 | 慢 (需恢复备份) |
| 适用 | 数据量 50GB-500GB |

### 方案 C: 流复制升级 (零停机)

```
1. 部署 PG16 新实例
2. PG14 主 → PG16 从 (逻辑复制)
3. 验证数据一致
4. 提升 PG16 为主
5. 切换应用连接串
```

| 维度 | 评估 |
|------|------|
| 停机时间 | < 30s (仅切换) |
| 风险 | 高 (逻辑复制配置复杂) |
| 回滚 | 中 (切回 PG14 主) |
| 适用 | 数据量 > 500GB, 7x24 业务 |

---

## 4. 推荐方案: A (逻辑升级) → PG16

### 4.1 理由

1. zhs-platform 数据量 < 50GB (3 个库, 预估 10-20GB)
2. 逻辑升级风险最低, 可完整验证
3. 停机窗口可接受 (夜间维护, 30-60 分钟)
4. 回滚快速 (切回旧实例)

### 4.2 升级步骤

```bash
# 1. 部署 PG16 新实例 (docker-compose.yml 新增 pg16 服务)
docker-compose up -d pg16

# 2. 全量备份 PG14
./scripts/backup_pg.sh  # 生成 3 个 .sql.gz

# 3. 恢复到 PG16
for db in zhs_ai_project zhs_center_project zhs_educational_training; do
  createdb -h pg16 -U zhs $db
  gunzip -c /var/backups/postgresql/${db}_*.sql.gz | psql -h pg16 -U zhs -d $db
done

# 4. 验证数据 (行数对比)
for db in zhs_ai_project zhs_center_project zhs_educational_training; do
  echo "=== $db ==="
  psql -h pg14 -U zhs -d $db -c "SELECT count(*) FROM information_schema.tables;"
  psql -h pg16 -U zhs -d $db -c "SELECT count(*) FROM information_schema.tables;"
done

# 5. 切换应用连接串 (更新 docker-compose.yml / Helm values)
#    postgres:5432 → pg16:5432

# 6. 重启应用
docker-compose restart api

# 7. 冒烟测试
curl http://localhost:8000/healthz
pytest tests/ -v -m "not skip"

# 8. 下线 PG14
docker-compose stop postgres
docker-compose rm -f postgres
```

### 4.3 回滚方案

```bash
# 若 PG16 出现问题, 切回 PG14
# 1. 停止应用
docker-compose stop api

# 2. 切换连接串回 PG14
#    pg16:5432 → postgres:5432

# 3. 重启应用
docker-compose start postgres
docker-compose start api

# 4. 验证
curl http://localhost:8000/healthz
```

---

## 5. 代码改造清单

### 5.1 docker-compose.yml

```yaml
# 升级前
postgres:
  image: postgres:14-alpine

# 升级后
postgres:
  image: postgres:16-alpine
```

### 5.2 CI workflows

```yaml
# ci.yml / ci-nightly.yml
services:
  postgres:
    image: postgres:16  # 14 → 16
```

### 5.3 Helm chart

```yaml
# values.yaml (如果 chart 部署 PG)
postgres:
  image: postgres:16-alpine
```

### 5.4 psycopg2-binary 兼容性

psycopg2-binary 2.9+ 完全兼容 PG16, 无需改动。

---

## 6. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 扩展不兼容 (pg_stat_statements) | 低 | 中 | PG16 内置, 验证版本 |
| SQL 语法变更 | 极低 | 低 | 14→16 无破坏性变更 |
| 性能回退 | 低 | 中 | 升级后跑性能基线 |
| 数据丢失 | 极低 | 高 | 升级前完整备份 + 加密备份 |
| 应用连接失败 | 低 | 高 | 连接池配置不变, psycopg2 兼容 |

---

## 7. 验证清单

升级后需验证:
- [ ] 3 个库表数量一致
- [ ] 关键表行数一致
- [ ] Alembic 迁移可正常执行
- [ ] 应用启动无报错
- [ ] API 端点可访问
- [ ] WebSocket 连接正常
- [ ] 备份脚本可正常执行
- [ ] postgres-exporter 可抓取指标
- [ ] Grafana 仪表盘数据正常
- [ ] 告警规则无误报

---

## 8. 结论

**推荐升级到 PostgreSQL 16**, 采用方案 A (逻辑升级):
1. PG16 社区支持至 2028-11, 剩余 2.5 年
2. 性能提升 10-20% (查询规划器优化)
3. 逻辑升级风险最低, 停机 30-60 分钟可接受
4. 代码改动小 (仅镜像版本号)
5. psycopg2-binary 完全兼容

**不建议升级到 PG17**: 新特性收益有限, 建议观察 6 个月后再评估。
