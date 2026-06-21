# 生产部署指南

## ✅ 已完成 MySQL → PostgreSQL 迁移

本项目数据库已从 MySQL 完全迁移到 PostgreSQL 14+, 所有数据通过 schema 隔离业务域。

**迁移后的关键变化**:
- 数据库连接串: `postgresql+psycopg2://...` (无 MySQL 残留)
- 模型定义: 已清除 `mysql_engine` / `mysql_charset` 等方言特定参数
- 部署文件: docker-compose / helm / .env 全部基于 PG
- 测试: CI 流水线已集成真实 PG 服务 (server-ci.yml)
- 多租户: 已支持 schema 隔离, 详见 [MULTI_TENANT.md](MULTI_TENANT.md)

**运维简化**:
- 不再需要 MySQL → PG 数据迁移脚本
- 不再需要 MySQL 驱动 (PyMySQL 已从依赖移除)
- 不再需要 MySQL → PG 方言转换层
- 部署直连 PG, 一行 `docker compose up -d` 即可启动

## 环境要求

- Python 3.11+
- PostgreSQL 14+ (3 套引擎通过 schema 隔离业务域)
- Redis 6.0+

## 部署步骤

### 1. 配置环境变量

复制 `.env.example` 为 `.env` 并填入生产值:

```bash
cp .env.example .env
```

关键配置项:

```bash
# 生产环境标识
ENV=production

# 强随机 JWT 密钥 (256 位)
JWT_SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")

# Redis URL (生产推荐)
REDIS_URL=redis://:yourpassword@redis-host:6379/0

# PostgreSQL 3 套引擎 (通过 schema 隔离)
DB1_URL=postgresql+psycopg2://zhs:zhs_pg_pass@pg-host:5432/zhs_platform
DB2_URL=postgresql+psycopg2://zhs:zhs_pg_pass@pg-host:5432/zhs_platform
DB3_URL=postgresql+psycopg2://zhs:zhs_pg_pass@pg-host:5432/zhs_platform
```

### 2. 安装依赖

```bash
pip install -e .
```

### 3. 初始化数据库 (Alembic 迁移)

```bash
alembic upgrade head
```

### 4. 启动服务

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

或使用 gunicorn:

```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

## 生产环境行为

- **ENV=production** 时, Redis 不可用会**直接报错**而不是降级到 fakeredis
- **ENV=production** 时, PostgreSQL 不可用会**直接报错**而不是降级到 SQLite
- **ENV=dev** 时, Redis 不可用自动降级到内存 fakeredis (开发便利)
- **ENV=dev** 时, PG 不可用自动降级到本地 SQLite (开发便利)
- 数据库使用 PostgreSQL, schema 隔离业务域
- 启动时会执行严格的 schema 校验
