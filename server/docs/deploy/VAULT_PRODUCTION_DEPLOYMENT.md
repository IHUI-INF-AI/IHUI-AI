# Vault 生产部署与密钥管理指南

## 概述

本文档描述 HashiCorp Vault 的生产部署流程，用于管理 PostgreSQL 备份加密密钥，支持自动轮换和历史归档。

## 架构

```
┌──────────────────────────────────────────┐
│              Vault Server                │
│              (port 8200)                 │
│  ┌────────────────────────────────────┐  │
│  │         KV v2 Engine               │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │ secret/zhs/pg-backup         │  │  │
│  │  │   - encryption_key (current) │  │  │
│  │  │   - rotation_count           │  │  │
│  │  │   - last_rotated_at          │  │  │
│  │  └──────────────────────────────┘  │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │ secret/zhs/pg-backup-history │  │  │
│  │  │   - key_<timestamp> (old)    │  │  │
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
           │
           │ vault kv get/put
           ▼
┌──────────────────────────────────────────┐
│      pg_backup_key_manager.sh            │
│      backup_pg_with_kms.sh               │
│      vault_key_rotation_cron.sh          │
└──────────────────────────────────────────┘
```

## 部署流程

### 1. 预检 (dry-run)

```bash
./scripts/deploy_vault_production.sh --dry-run
```

### 2. 生产部署

```bash
./scripts/deploy_vault_production.sh
```

执行步骤：
1. **预检** - 检查 docker、compose 文件、密钥管理脚本
2. **启动 Vault** - 启动 Vault 容器
3. **初始化 Vault** - 生成 unseal key 和 root token
4. **解封 Vault** - 使用 unseal key 解封
5. **启用 KV 引擎** - 启用 secret/ 路径的 KV v2
6. **写入初始密钥** - 生成并写入 encryption_key
7. **验证密钥访问** - 通过 pg_backup_key_manager.sh 验证
8. **生成报告** - JSON 格式部署报告

### 3. 配置密钥轮换定时任务

```bash
# 编辑 crontab
crontab -e

# 添加每日 03:00 轮换任务
0 3 * * * /path/to/server/scripts/vault_key_rotation_cron.sh

# 需要设置环境变量 (在 crontab 中)
VAULT_ADDR=http://127.0.0.1:8200
VAULT_TOKEN=<root_token>
```

## 密钥管理

### 密钥路径

| 路径 | 用途 |
|------|------|
| `secret/zhs/pg-backup` | 当前加密密钥 |
| `secret/zhs/pg-backup-history` | 历史密钥归档 |

### 密钥字段

```json
{
  "encryption_key": "<base64 编码的 48 字节密钥>",
  "rotation_count": 1,
  "last_rotated_at": "2026-06-18T03:00:00Z",
  "created_at": "2026-06-18T03:00:00Z"
}
```

### 密钥轮换流程

1. 读取当前密钥和轮换计数
2. 生成新密钥 (openssl rand -base64 48)
3. 旧密钥归档到 `secret/zhs/pg-backup-history`
4. 新密钥写入 `secret/zhs/pg-backup`
5. 验证新密钥可读

### 手动操作

```bash
# 获取当前密钥
export VAULT_ADDR=http://127.0.0.1:8200
export VAULT_TOKEN=<root_token>
vault kv get -field=encryption_key secret/zhs/pg-backup

# 手动轮换
./scripts/vault_key_rotation_cron.sh

# 验证密钥
./scripts/pg_backup_key_manager.sh verify
```

## 安全注意事项

1. **vault_keys.txt 权限** - 部署脚本生成的 `logs/vault_keys.txt` 包含 unseal key 和 root token，权限为 600
2. **生产环境** - 生产环境应使用多 key 解封 (3/5)，而非 1/1
3. **自动解封** - 生产环境建议配置 Auto-Unseal (AWS KMS / HSM)
4. **Token 轮换** - root token 应仅在初始化时使用，后续创建有限权限 token
5. **审计日志** - 启用 Vault audit log

## 回滚

```bash
# 停止 Vault
docker compose -f deploy/docker/docker-compose.vault.yml down

# 清理数据卷 (谨慎!)
docker volume rm server_vault_data
```

## 部署报告

JSON 格式报告示例：

```json
{
  "timestamp": "2026-06-18T03:00:00Z",
  "operation": "vault_production_deploy",
  "status": "success",
  "duration_seconds": 120,
  "vault": {
    "address": "http://127.0.0.1:8200",
    "sealed": false,
    "kv_path": "secret/zhs/pg-backup",
    "key_rotation_interval": "24h"
  },
  "log_file": "logs/vault_deploy_20260618_030000.log"
}
```

## 验证测试

```bash
python scripts/test_vault_production_deploy.py
```
