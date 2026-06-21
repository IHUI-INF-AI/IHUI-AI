# PG 多租户冷启动 runbook (建议 142)

> 适用场景: 全新 PostgreSQL 14 集群, 从零初始化多租户 Schema 隔离模式
> 配套工具: [migrate_tenants.py](scripts/ci/migrate_tenants.py) (建议 125/137) + [backfill_tenants.py](scripts/ci/backfill_tenants.py) (建议 139)
> 前置条件: 已完成 MySQL→PG 迁移 (见 [PG_MIGRATION_RUNBOOK.md](docs/PG_MIGRATION_RUNBOOK.md)), PG 中已有 public 公共 schema 与基础表
> 预计耗时: 30min (10 个 tenant) ~ 2h (100 个 tenant)
> 决策依据: [MULTI_TENANT_DESIGN.md](docs/MULTI_TENANT_DESIGN.md) 方案 B (PG Schema 隔离)

---

## 0. 全流程概览

```
0. 前置检查 (PG 状态 / PG 数据源 / .env 配置)
       │
       ▼
1. alembic upgrade head  (公共 schema 一次性, 全部 7 个 migration 跑完)
       │
       ▼
2. migrate_tenants --diff  (静态校验, 部署前安全门, 无 DB 连接)
       │
       ▼
3. tenant_seeder 注册活跃 tenant → tenant_1..tenant_N schema 自动建
       │
       ▼
4. migrate_tenants --resume  (并行对每个 schema 跑 alembic upgrade head)
       │
       ▼
5. backfill_tenants  (把 public.users / public.user_margins 按 tenant_id 拆到各 schema)
       │
       ▼
6. 切流量 (改 .env, 重启 API, 健康检查)
       │
       ▼
7. 观察期 (1h 监控, 灰度)
```

---

## 1. 前置检查

### 1.1 PG 状态

```bash
# 1.1.1 容器在跑
docker compose --profile multi-tenant ps postgres
# 期望: postgres  Up X minutes (healthy)

# 1.1.2 pg_isready
docker compose exec postgres pg_isready -U zhs
# 期望: localhost:5432 - accepting connections

# 1.1.3 库存在
docker compose exec postgres psql -U zhs -d zhs_platform -c "\l"
# 期望: zhs_platform 在列表中

# 1.1.4 public schema 当前 revision (空库应为空)
docker compose exec postgres psql -U zhs -d zhs_platform -c "SELECT * FROM alembic_version;"
```

### 1.2 PG 数据源 (回填阶段需要)

```bash
# 1.2.1 PG 可达
psql -h 127.0.0.1 -U zhs -d zhs_platform -c "SELECT 1;"

# 1.2.2 多租户基线表 admin_tenant 已有数据
psql -h 127.0.0.1 -U zhs -d zhs_platform -c "
  SELECT id, tenant_code, status FROM admin_tenant WHERE status='active' LIMIT 5;
"
# 期望: 至少 1 行 active tenant
```

### 1.3 .env 配置 (切流量前不生效, 此处只准备)

```bash
# 1.3.1 准备多租户模式配置
cat >> .env <<EOF
MULTI_TENANT_ENABLED=true
DB1_URL=postgresql+psycopg2://zhs:zhs_pg_pass@postgres:5432/zhs_platform
DB2_URL=postgresql+psycopg2://zhs:zhs_pg_pass@postgres:5432/zhs_platform
DB3_URL=postgresql+psycopg2://zhs:zhs_pg_pass@postgres:5432/zhs_platform
MIGRATE_PARALLEL=4
MIGRATE_RETRIES=3
BACKFILL_BATCH_SIZE=500
EOF
```

---

## 2. 公共 Schema 初始化 (alembic upgrade head)

### 2.1 单次 upgrade (冷启动必跑)

```bash
# 2.1.1 跑 public schema 的全部 7 个 migration
docker compose exec api alembic upgrade head

# 2.1.2 验证
docker compose exec postgres psql -U zhs -d zhs_platform -c "SELECT * FROM alembic_version;"
# 期望: version_num 形如 "007_migrate_phase2_tables..."

# 2.1.3 公共表已建
docker compose exec postgres psql -U zhs -d zhs_platform -c "\dt public.*"
# 期望: admin_tenant, admin_user, admin_job, alembic_version 等
```

### 2.2 出错回退

```bash
# 2.2.1 单步降级
docker compose exec api alembic downgrade -1

# 2.2.2 全降级到起点 (慎用)
docker compose exec api alembic downgrade base

# 2.2.3 强制 base 后重新 head
docker compose exec api alembic upgrade head
```

---

## 3. 部署前安全门: `--diff` 静态校验 (建议 137)

**作用**: 跑 4 步前先确认"将执行哪些 migration", 避免错配 / 漏跑。

```bash
# 3.1 全量 diff (公共 + 所有 tenant schema)
python scripts/ci/migrate_tenants.py --diff
# 退出码: 0=全对齐, 2=有 pending (正常), 1=error
# 期望: public 已对齐; tenant_X 全部 pending (空 schema)

# 3.2 详细 DDL 预览 (CI 部署前 audit 用)
python scripts/ci/migrate_tenants.py --diff --show-ddl
# 输出: 列出每个待跑 migration 的 file + description + DDL 摘要

# 3.3 只看指定 tenants (生产紧急修复时)
python scripts/ci/migrate_tenants.py --diff --tenants 1,3,5
```

**输出示例**:

```
================================================================
MIGRATION DIFF REPORT (--static mode, no DB connection)
================================================================
head_revision: 007_migrate_phase2_tables_to_tenant_schema
versions_dir: alembic/versions

SCHEMA: public
  current: 007_migrate_phase2_tables_to_tenant_schema
  head:    007_migrate_phase2_tables_to_tenant_schema
  status:  ALIGNED ✓

SCHEMA: tenant_1
  current: <empty>
  head:    007_migrate_phase2_tables_to_tenant_schema
  status:  PENDING (7 migrations)
  pending revisions:
    - 001_initial_schema           (docstring: ...)
    - 002_admin_job                 (docstring: ...)
    ...
================================================================
```

---

## 4. Tenant Schema 自动注册 (冷启动必经)

### 4.1 用 tenant_seeder 把 admin_tenant 里的 active tenant 全部建出 schema

```bash
# 4.1.1 一次性 seeder
docker compose exec api python -c "
from app.db_per_tenant import sync_all_tenant_schemas
n = sync_all_tenant_schemas()
print(f'已同步 {n} 个 tenant schema')
"
# 期望: 已同步 10 个 tenant schema (或当前 active 数)

# 4.1.2 验证
docker compose exec postgres psql -U zhs -d zhs_platform -c "\dn"
# 期望: public, tenant_1, tenant_2, ..., tenant_N
```

### 4.2 幂等性保证

`sync_all_tenant_schemas` 是幂等的: 重复跑不会重复建, 已有 schema 跳过。

---

## 5. 并行迁移全部 Tenant Schema (建议 125)

### 5.1 首次迁移

```bash
# 5.1.1 自动从 admin_tenant 读 active tenant 并行迁移 (4 线程)
python scripts/ci/migrate_tenants.py --parallel 4 --retries 3
# 输出: 10/10 PASSED, 耗时 30s

# 5.1.2 显式指定 tenant (生产紧急修复)
python scripts/ci/migrate_tenants.py --tenants 1,3,5 --parallel 4

# 5.1.3 dry-run 试跑 (不真改, 只打日志)
python scripts/ci/migrate_tenants.py --dry-run --parallel 4
```

### 5.2 断点续传 (失败重试)

```bash
# 5.2.1 部分失败后, 查状态
python scripts/ci/migrate_tenants.py --status
# 输出: tenant_1=done, tenant_2=failed, tenant_3=pending, ...

# 5.2.2 重跑 (跳过已 done 的)
python scripts/ci/migrate_tenants.py --resume
# 仅重试 failed/pending 的, 已 done 的跳过

# 5.2.3 强刷 (全部重跑, 慎用)
python scripts/ci/migrate_tenants.py --reset-state
python scripts/ci/migrate_tenants.py
```

### 5.3 验证

```bash
# 5.3.1 每个 schema 都有 alembic_version
docker compose exec postgres psql -U zhs -d zhs_platform -c "
  SELECT schemaname, tablename FROM pg_tables
  WHERE tablename = 'alembic_version'
  ORDER BY schemaname;
"
# 期望: public + tenant_1..N 都有

# 5.3.2 tenant_1 表齐全
docker compose exec postgres psql -U zhs -d zhs_platform -c "\dt tenant_1.*"
# 期望: 至少 sys_user, user_margin, course 等业务表
```

### 5.4 失败回滚单 tenant

```bash
# 5.4.1 降级单 tenant 到 base
docker compose exec postgres psql -U zhs -d zhs_platform -c "
  SET search_path TO tenant_5;
  DROP TABLE alembic_version;
  -- 然后 alembic upgrade head 重跑
"

# 5.4.2 整 schema 删除重建 (慎用, 丢数据)
docker compose exec postgres psql -U zhs -d zhs_platform -c "
  DROP SCHEMA tenant_5 CASCADE;
"
# 然后重新跑 seeder + migrate_tenants
```

---

## 6. 数据回填: public.users / user_margins → 各 schema (建议 139)

### 6.1 全量回填 (冷启动必须)

```bash
# 6.1.1 dry-run 试跑 (只统计不写)
python scripts/ci/backfill_tenants.py --dry-run
# 输出: 即将迁移 12345 行 / 10 个 tenant, 0 错误

# 6.1.2 真跑
python scripts/ci/backfill_tenants.py --batch-size 500
# 进度: tenant_1 500/500 done, tenant_2 350/500 ...
# 退出码: 0 全部完成, 2 部分失败, 1 配置错误

# 6.1.3 断点续传 (失败重试)
python scripts/ci/backfill_tenants.py --resume
# 跳过已 done 的 (last_id 已记录), 继续未完成的
```

### 6.2 单表回填

```bash
# 6.2.1 只回填 user_margins (其他表已 OK)
python scripts/ci/backfill_tenants.py --table user_margins --batch-size 200

# 6.2.2 只回填指定 tenants
python scripts/ci/backfill_tenants.py --tenants 1,2,3 --batch-size 500
```

### 6.3 验证

```bash
# 6.3.1 公共表剩余 0 行
docker compose exec postgres psql -U zhs -d zhs_platform -c "
  SELECT 'public.users' AS tbl, COUNT(*) FROM public.users
  UNION ALL
  SELECT 'public.user_margins', COUNT(*) FROM public.user_margins;
"
# 期望: 都是 0

# 6.3.2 各 schema 行数 == 回填前 public 行数
docker compose exec postgres psql -U zhs -d zhs_platform -c "
  SELECT 'tenant_1.users' AS tbl, COUNT(*) FROM tenant_1.users
  UNION ALL SELECT 'tenant_1.user_margins', COUNT(*) FROM tenant_1.user_margins
  ...
"
# 对比回填前 public 行数, 误差应为 0
```

### 6.4 幂等性

`backfill_tenants.py` 用 `ON CONFLICT DO NOTHING` (PG), 重复跑不会重复插入, 安全。

---

## 7. 切流量 (0 → 1)

### 7.1 切换前最终检查

```bash
# 7.1.1 pytest 全套 0 失败
python -m pytest --tb=short -q 2>&1 | tail -5
# 期望: 1255 passed, 0 failed

# 7.1.2 API health
curl http://localhost:8000/health
# 期望: {"status": "ok", "databases": {"ai": "ok", ...}, "multi_tenant": false}

# 7.1.3 migration diff 全对齐
python scripts/ci/migrate_tenants.py --diff
# 期望: 全部 ALIGNED ✓
```

### 7.2 切 .env 并重启

```bash
# 7.2.1 启用多租户模式
sed -i 's/^MULTI_TENANT_ENABLED=.*/MULTI_TENANT_ENABLED=true/' .env

# 7.2.2 重启 API
docker compose restart api

# 7.2.3 健康检查
curl http://localhost:8000/health
# 期望: {"status": "ok", ..., "multi_tenant": true}

# 7.2.4 路由层 tenant 注入
curl -H "X-Tenant-Id: 1" http://localhost:8000/api/v1/users/me
# 期望: 正常返回, 走 tenant_1 schema
```

### 7.3 紧急回滚

```bash
# 7.3.1 切回单租户
sed -i 's/^MULTI_TENANT_ENABLED=.*/MULTI_TENANT_ENABLED=false/' .env
sed -i 's|^DB1_URL=.*|DB1_URL=postgresql+psycopg2://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_platform|' .env
# (DB2/DB3 同上)

# 7.3.2 重启
docker compose restart api
curl http://localhost:8000/health
```

---

## 8. 观察期与监控 (1h 灰度)

### 8.1 关键指标

| 指标 | 期望 | 来源 |
|------|------|------|
| `zhs_api_request_latency_p99` | < 500ms | Prometheus |
| `zhs_db_pool_active` | < 80% 利用率 | Prometheus |
| `zhs_tenant_schema_count` | = active tenant 数 | Prometheus |
| 告警量 | 0 critical | alertmanager |

### 8.2 一键回滚的判据

任意一项触发, 立即 7.3 回滚:
- P99 延迟 > 1s 持续 5min
- DB 连接池满
- 任意 critical 告警

---

## 9. 常见问题

### Q1: `migrate_tenants --diff` 报 "no such table: alembic_version" 静态模式
A: 这是 **正常** 的。`--diff` 走纯静态路径, 不会真连 DB, 输出仅基于 alembic/versions/*.py 文件 + 已知的 schema 名列表。

### Q2: 某个 tenant 一直 fail, 但其他都 OK
A: 看那个 tenant 的 schema 是不是被其他进程锁了:
```bash
docker compose exec postgres psql -U zhs -d zhs_platform -c "
  SELECT pid, query, state FROM pg_stat_activity
  WHERE query LIKE '%tenant_5%' AND state = 'active';
"
```
杀掉阻塞的 session 再 `--resume`。

### Q3: `backfill_tenants` 报 "tenant_id 字段不存在"
A: 业务表没正确加 tenant_id 列, 跑 006/007 migration 把表迁到 tenant schema:
```bash
docker compose exec api alembic upgrade head --schema tenant_5
```

### Q4: 切流量后某个租户查不到数据
A: 检查 search_path:
```bash
docker compose exec postgres psql -U zhs -d zhs_platform -c "SHOW search_path;"
```
应用启动时应该 SET search_path TO tenant_X, public。

### Q5: 想要先观察再切流量
A: 见 5.1.3 dry-run + 6.1.1 dry-run, 不写数据, 只演练流程。

---

## 10. 完工检查清单

- [ ] PG 14 容器 healthy, `pg_isready` ok
- [ ] alembic upgrade head 7/7 通过, public schema version 正确
- [ ] tenant_seeder 同步 N 个 active tenant
- [ ] `--diff` 显示所有 schema 全 ALIGNED ✓
- [ ] `--resume` 后 0 失败, 0 pending
- [ ] backfill 全部完成, public 行数 = 0
- [ ] pytest 1255+ 通过, 0 失败
- [ ] `.env` 切到多租户, `MULTI_TENANT_ENABLED=true`
- [ ] API health 显示 `multi_tenant: true`
- [ ] 单租户模式仍能启动 (回滚保证)
- [ ] 1h 观察期无 P0/P1 告警
- [ ] 文档同步更新 (MULTI_TENANT_DESIGN.md, 本 runbook)
- [ ] alertmanager 抑制规则同步 (建议 141 / 143)

---

## 11. 相关文档与工具

- [MULTI_TENANT_DESIGN.md](docs/MULTI_TENANT_DESIGN.md) - 方案 B 详细设计
- [PG_MIGRATION_RUNBOOK.md](docs/PG_MIGRATION_RUNBOOK.md) - MySQL→PG 迁移 (前置)
- [PERFORMANCE_BASELINE.md](docs/PERFORMANCE_BASELINE.md) - 性能基线
- [migrate_tenants.py](scripts/ci/migrate_tenants.py) - 多租户迁移 CLI (建议 125/137)
- [backfill_tenants.py](scripts/ci/backfill_tenants.py) - 数据回填 CLI (建议 139)
- [app/alert_inhibition.py](app/alert_inhibition.py) - 抑制规则 (建议 141)
- [docker/alertmanager/alertmanager.yml](docker/alertmanager/alertmanager.yml) - 5 条 ZHS 抑制规则
- tests/test_migrate_diff_mode.py - --diff 测试 (31 用例)
- tests/test_backfill_tenants.py - 回填测试 (16 用例)
