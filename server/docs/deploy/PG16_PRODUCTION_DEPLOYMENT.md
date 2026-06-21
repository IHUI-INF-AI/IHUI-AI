# PostgreSQL 16 生产升级部署指南

## 概述

本文档描述 PostgreSQL 14 → 16 生产环境升级的完整流程，使用逻辑升级方案（pg_dump/restore），预计停机时间 30-60 分钟。

## 升级方案

| 项目 | 方案 A (逻辑升级) | 方案 B (物理升级) |
|------|------------------|------------------|
| 停机时间 | 30-60 分钟 | 5-10 分钟 |
| 风险 | 低 (可验证) | 中 (依赖 pg_upgrade) |
| 复杂度 | 低 | 高 |
| 回滚 | 快 (恢复 PG14) | 慢 (需重建) |

**选定方案**: A (逻辑升级)

## 前置条件

1. PG14 运行在 `localhost:5432`
2. 已完成 staging 环境验证
3. 已通知业务方停机窗口
4. 已确认备份策略可用

## 升级流程

### 1. 预检 (dry-run)

```bash
./scripts/deploy_pg16_production.sh --dry-run
```

预检内容：
- docker / docker-compose 可用
- 升级脚本 `upgrade_pg14_to_pg16.sh` 存在
- compose 文件 `docker-compose.pg16-upgrade.yml` 存在
- 加密备份脚本 `backup_pg_encrypted.sh` 存在

### 2. 生产执行

```bash
./scripts/deploy_pg16_production.sh
```

执行步骤：
1. **预检** - 检查工具和脚本
2. **加密备份** - 调用 `backup_pg_encrypted.sh`
3. **启动 PG16** - 启动独立 PG16 实例 (端口 5433)
4. **数据迁移** - 调用 `upgrade_pg14_to_pg16.sh` (6 步流程)
5. **应用切换** - 停止应用 → 修改镜像 → 启动应用
6. **冒烟测试** - API 健康检查 + 数据库连通性
7. **清理与报告** - 下线升级实例 + 生成 JSON 报告

### 3. 验证

升级完成后检查：
- `logs/pg16_deploy_report_*.json` - 部署报告
- `logs/pg16_deploy_*.log` - 完整日志
- `curl http://localhost:8000/healthz` - API 健康
- `docker compose ps` - 容器状态

## 回滚方案

### 自动回滚

脚本在以下情况自动回滚：
- 数据迁移失败 → 停止 PG16，保留 PG14
- 冒烟测试失败 → 恢复 `docker-compose.yml.bak`，重启 PG14

### 手动回滚

```bash
# 1. 停止应用
docker compose stop api

# 2. 恢复 compose 文件
git checkout deploy/docker/docker-compose.yml

# 3. 启动 PG14
docker compose up -d postgres

# 4. 启动应用
docker compose up -d

# 5. 验证
curl http://localhost:8000/healthz
```

## 部署报告

JSON 格式报告示例：

```json
{
  "timestamp": "2026-06-18T03:00:00Z",
  "operation": "pg16_production_upgrade",
  "status": "success",
  "duration_seconds": 1800,
  "rollback_triggered": false,
  "log_file": "logs/pg16_deploy_20260618_030000.log",
  "previous_version": "14",
  "target_version": "16",
  "databases": ["zhs_ai_project", "zhs_center_project", "zhs_educational_training"]
}
```

## 风险评估

| 风险点 | 缓解措施 |
|--------|---------|
| 数据丢失 | 升级前加密备份 + 升级后一致性验证 |
| 应用兼容性 | staging 环境预验证 + 冒烟测试 |
| 停机超时 | 预估 30-60 分钟，提前通知业务方 |
| 扩展不兼容 | 步骤 5 检查扩展兼容性 |

## 验证测试

```bash
python scripts/test_pg16_production_deploy.py
```

测试覆盖：
- 脚本存在性和可执行性
- 7 步流程完整性
- dry-run 模式支持
- JSON 报告生成
- 自动回滚逻辑
- 日志记录
- 加密备份集成
- 冒烟测试集成
- 镜像切换逻辑
- 清理逻辑
