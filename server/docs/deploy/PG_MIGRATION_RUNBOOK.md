# PostgreSQL 迁移 runbook (建议 109 / 建议 102 阶段 0)

> 适用版本: ZHS Platform v0.1 → v0.2 (MySQL → PG 14)
> 预计耗时: 1-2 周 (含 3 次演练)
> 决策依据: [MULTI_TENANT_DESIGN.md](docs/MULTI_TENANT_DESIGN.md) 方案 B (PG Schema 隔离)

---

## 0. 前置检查

```bash
# 0.1 确认 MySQL 数据量
mysql -h 172.21.0.15 -u Raindrop_L -p zhs_ai_project -e "
  SELECT table_name, table_rows
  FROM information_schema.tables
  WHERE table_schema='zhs_ai_project'
  ORDER BY table_rows DESC LIMIT 10;
"

# 0.2 确认 PG 已启动
docker compose --profile multi-tenant up -d postgres
docker compose exec postgres pg_isready -U zhs

# 0.3 备份 MySQL 全库
mysqldump -h 172.21.0.15 -u Raindrop_L -p --single-transaction \
  --routines --triggers --events \
  --default-character-set=utf8mb4 \
  zhs_ai_project > backup/zhs_ai_project_$(date +%Y%m%d).sql
mysqldump -h 172.21.0.15 -u Raindrop_L -p --single-transaction \
  zhs_educational_center > backup/zhs_educational_center_$(date +%Y%m%d).sql
mysqldump -h 172.21.0.15 -u Raindrop_L -p --single-transaction \
  zhs_educational_training > backup/zhs_educational_training_$(date +%Y%m%d).sql

# 0.4 备份 PG (迁移后基线)
pg_dump -h localhost -U zhs -Fc zhs_platform > backup/zhs_platform_$(date +%Y%m%d).dump
```

---

## 1. 启动 PG 容器 (一次性)

```bash
# 1.1 拉镜像
docker pull postgres:14-alpine

# 1.2 启动 (multi-tenant profile, 不影响单租户模式)
docker compose --profile multi-tenant up -d postgres

# 1.3 创建 zhs 用户与库 (docker-compose.yml 已自动建, 验证)
docker compose exec postgres psql -U zhs -d zhs_platform -c "SELECT version();"
# 期望: PostgreSQL 14.x on x86_64-pc-linux-musl ...

# 1.4 配置远端访问 (如需)
# 编辑 postgresql.conf: listen_addresses = '*'
# 编辑 pg_hba.conf: 添加 host all all 0.0.0.0/0 md5
docker compose restart postgres
```

---

## 2. MySQL → PG 数据迁移

### 2.1 安装 pgloader

```bash
# Ubuntu / Debian
apt-get install pgloader

# macOS
brew install pgloader

# Docker (推荐, 与项目环境一致)
docker pull dimitri/pgloader:latest
```

### 2.2 配置 pgloader

见 [pgloader.conf](deploy/pgloader/pgloader.conf)。

要点:
- `cast type ...` 处理 MySQL 专有类型 (`tinyint`, `datetime`, `enum`)
- `alter schema ... rename to ...` 跳过 `mysql` 虚拟 schema
- `with include drop, create tables, no truncate, create indexes` 幂等可重跑

### 2.3 执行迁移 (按业务域分 3 次)

```bash
# AI 库
pgloader deploy/pgloader/pgloader_ai.conf

# 中心库
pgloader deploy/pgloader/pgloader_center.conf

# 课程库
pgloader deploy/pgloader/pgloader_course.conf
```

### 2.4 验证数据一致性

```bash
# MySQL 行数 vs PG 行数 (应有 100% 一致)
python scripts/ci/verify_pg_migration.py
# 输出: 30 张表全 PASS, 0 FAIL
```

---

## 3. SQLAlchemy / Alembic 兼容性修补

### 3.1 已识别的 MySQL 专有写法

| 文件 | MySQL 写法 | PG 替换 | 状态 |
|------|-----------|---------|------|
| `__table_args__["mysql_engine"]` | `InnoDB` | PG 忽略 (无 InnoDB) | 已兼容 (dialect-specific kwarg) |
| `__table_args__["mysql_charset"]` | `utf8mb4` | PG 忽略 | 已兼容 |
| `Column(... primary_key=True, autoincrement=True)` | 走 MySQL AUTO_INCREMENT | PG 走 SERIAL | 已兼容 (SQLAlchemy 自动选型) |
| `__table_args__["schema"]` | "public" (建议 108) | PG 实际生效 | 已加 |
| alembic `op.create_table(... mysql_engine=...)` | MySQL 引擎参数 | PG 忽略 | 已兼容 |

### 3.2 应用层配置切换

设置 `MULTI_TENANT_ENABLED=true` 启用多租户模式：

```bash
# .env
MULTI_TENANT_ENABLED=true
DB1_URL=postgresql+psycopg2://zhs:zhs_pg_pass@localhost:5432/zhs_platform
DB2_URL=postgresql+psycopg2://zhs:zhs_pg_pass@localhost:5432/zhs_platform
DB3_URL=postgresql+psycopg2://zhs:zhs_pg_pass@localhost:5432/zhs_platform
```

> 注意: 项目已完全迁移到 PG, 单租户模式 (`MULTI_TENANT_ENABLED=false`) 也走 PG. (历史: 迁移前单租户模式曾走 MySQL, 现已废弃)
> 推荐: 先在测试环境跑通, 再切 staging, 最后生产.

---

## 4. 回滚预案

### 4.1 迁移失败立即回滚

```bash
# 1. 切换 .env 回单租户 PG 模式 (项目已迁移到 PG, 不再回退到 MySQL)
sed -i 's/^MULTI_TENANT_ENABLED=.*/MULTI_TENANT_ENABLED=false/' .env
sed -i 's|^DB1_URL=.*|DB1_URL=postgresql+psycopg2://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_platform|' .env
# (DB2/DB3 同上)

# 2. 重启应用
docker compose restart api

# 3. 验证
curl http://localhost:8000/health
# 期望: {"status": "ok", "databases": {"ai": "ok", ...}}
```

### 4.2 数据不一致回滚

PG 数据丢失 / 不一致时:
1. 停 PG 容器
2. 用 pg_dump 备份重建 (项目已迁移到 PG, 不再回退到 MySQL)
3. 保留 PG 数据 30 天, 不立刻 DROP, 留排查时间

### 4.3 历史灰度方案 (已废弃, 项目已完全迁移到 PG)

> 历史记录: 迁移灰度期间曾考虑 PG ↔ MySQL 同步方案, 但项目已完全迁移到 PG, 此方案已废弃.

- 见 [MULTI_TENANT_DESIGN.md 第 5 阶段](docs/MULTI_TENANT_DESIGN.md)

---

## 5. 监控与告警

PG 容器添加 Prometheus exporter:

```yaml
# docker-compose.yml (multi-tenant profile)
postgres-exporter:
  image: prometheuscommunity/postgres-exporter:latest
  restart: always
  environment:
    DATA_SOURCE_NAME: "postgresql://zhs:zhs_pg_pass@postgres:5432/zhs_platform?sslmode=disable"
  ports:
    - "9187:9187"
  profiles: ["multi-tenant"]
```

Prometheus scrape config:

```yaml
# docker/prometheus/prometheus.yml
- job_name: 'postgres'
  static_configs:
    - targets: ['postgres-exporter:9187']
```

Grafana 已有 PG dashboard (官方 9628) 可直接 import.

---

## 6. 演练记录 (强制)

| 演练 | 时间 | 结果 | 操作人 |
|------|------|------|--------|
| 干跑 (dry-run) | 2026-06-13 | 见 scripts/ci/test_pg_compatibility.py | (本轮已跑) |
| 测试环境实跑 | 待定 | 待 | 待 |
| staging 跑 | 待定 | 待 | 待 |
| 生产灰度 | 待定 | 待 | 待 |

---

## 7. 常见问题

### Q1: pgloader 报 `enum type` 错误
A: 在 pgloader.conf 加 `cast type enum to text` + `cast type set to text`

### Q2: SQLAlchemy 模型在 PG 上 create_all 报 "schema not found"
A: 确保 `tenant_1` schema 已存在 (见 005 migration seed 段)

### Q3: alembic upgrade 报 "AUTO_INCREMENT not supported"
A: SQLAlchemy 2.0 已自动忽略, 如有手写 SQL, 用 `BIGSERIAL` 替换

### Q4: 启动报 `Could not translate host name "postgres"`
A: docker-compose 网络内 app 应走 `postgres:5432`, 外部走 `localhost:5432`

---

## 8. 完工检查清单

- [ ] PG 14 容器启动, `pg_isready` 返回 ok
- [ ] pgloader 3 个库迁移完成, 行数对比 0 差异
- [ ] `.env` 切到 PG, `MULTI_TENANT_ENABLED=true`
- [ ] 单租户模式 (`MULTI_TENANT_ENABLED=false`) 仍能启动 (回滚保证)
- [ ] alembic upgrade head 全绿
- [ ] pytest 全套 0 失败
- [ ] 灰度观察 1 周无异常
- [ ] 文档同步更新 (MULTI_TENANT_DESIGN.md, 本 runbook)
