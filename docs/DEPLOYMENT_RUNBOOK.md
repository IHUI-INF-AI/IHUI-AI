# IHUI-AI 部署运维手册 (Runbook)

> 版本: v1.0.0 | 更新日期: 2026-06-23 | 适用环境: 生产 / Staging

---

## 一、部署前准备

### 1.1 配置文件准备

```bash
# 1. 编辑后端生产配置
cd server
cp .env.production.template .env.production
vim .env.production
# 填写所有 <FILL_IN> 占位符:
#   - DB1_URL / DB2_URL / DB3_URL (PostgreSQL 连接串)
#   - REDIS_PASSWORD
#   - JWT_SECRET_KEY (openssl rand -hex 32)
#   - SESSION_SECRET_KEY (openssl rand -hex 32)
#   - ZHIPU_API_KEY / COZE_PRIVATE_KEY / COZE_OAUTH_APP_ID
#   - 微信支付 / 支付宝证书路径和密钥
#   - MinIO / OSS 配置
#   - 告警 webhook (钉钉/飞书/Slack 等)

# 2. 编辑前端生产配置
cd ../client
vim .env.production
# 确认:
#   - VITE_API_BASE 指向生产 API 地址
#   - VITE_ENABLE_MOCK=false
#   - VITE_ENCRYPTION_KEY 已更换为高强度随机值

# 3. 运行部署前检查
cd ../server
python scripts/pre_deploy_check.py
# 所有检查必须通过 (FAIL=0)
```

### 1.2 SSL 证书准备

```bash
# 方式 A: Let's Encrypt (免费, 推荐)
certbot certonly --standalone -d aizhs.top -d bsm.aizhs.top -d zca.aizhs.top
cp /etc/letsencrypt/live/aizhs.top/fullchain.pem ssl/
cp /etc/letsencrypt/live/aizhs.top/privkey.pem ssl/

# 方式 B: 阿里云/腾讯云证书
# 下载 Nginx 格式证书, 将 fullchain.pem 和 privkey.pem 放入 ssl/ 目录

# 方式 C: 自签名 (仅测试)
# ssl/ 目录已包含自签名测试证书, 生产环境必须替换
```

### 1.3 Git 远程仓库配置

```bash
git remote add origin <你的仓库URL>
git push -u origin main
# CI/CD 需要 Git 远程仓库才能触发
```

---

## 二、Docker 部署

### 2.1 首次部署

```bash
# 1. 创建环境变量文件 (根目录)
cp .env.production.example .env
vim .env
# 填写: DOMAIN, APP_TITLE, DB_PASSWORD, REDIS_PASSWORD,
#        JWT_SECRET, SESSION_SECRET, MINIO_ACCESS_KEY, MINIO_SECRET_KEY

# 2. 构建并启动所有服务
docker-compose up -d --build

# 3. 查看服务状态
docker-compose ps
# 所有服务应为 healthy 状态

# 4. 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 2.2 服务架构

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| frontend | aizhs-frontend | 80, 443 | Nginx + Vue SPA |
| backend | aizhs-backend | 8000 | FastAPI + uvicorn |
| db | aizhs-postgres | 5432 | PostgreSQL 15 |
| redis | aizhs-redis | 6379 | Redis 7 |
| minio | aizhs-minio | 9000, 9001 | MinIO 对象存储 |

### 2.3 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动 (零停机)
docker-compose up -d --build backend frontend

# 执行数据库迁移 (如果手动需要)
docker-compose exec backend alembic upgrade head

# 验证
docker-compose ps
curl -k https://localhost/healthz
```

---

## 三、运维操作

### 3.1 日志查看

```bash
# 实时日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 最近 100 行
docker-compose logs --tail 100 backend

# ELK 日志收集 (可选)
docker-compose -f client/docker-compose.elk.yml up -d
# Kibana: http://localhost:5601
```

### 3.2 数据库操作

```bash
# 进入 PostgreSQL
docker-compose exec db psql -U zhs_user -d zhs_main

# 备份数据库
docker-compose exec db pg_dump -U zhs_user zhs_main > backup_$(date +%Y%m%d).sql

# 恢复数据库
docker-compose exec -T db psql -U zhs_user zhs_main < backup_20260623.sql

# 查看数据库迁移状态
docker-compose exec backend alembic current
docker-compose exec backend alembic history
```

### 3.3 Redis 操作

```bash
# 进入 Redis CLI
docker-compose exec redis redis-cli -a <REDIS_PASSWORD>

# 查看内存使用
docker-compose exec redis redis-cli -a <REDIS_PASSWORD> info memory

# 清空缓存 (谨慎!)
docker-compose exec redis redis-cli -a <REDIS_PASSWORD> flushdb
```

### 3.4 MinIO 操作

```bash
# MinIO 控制台
# http://localhost:9001 (用户名/密码见 .env)

# 创建 bucket
docker-compose exec minio mc alias set local http://localhost:9000 <ACCESS_KEY> <SECRET_KEY>
docker-compose exec minio mc mb local/aizhs
docker-compose exec minio mc policy set public local/aizhs
```

### 3.5 监控

```bash
# Prometheus (可选)
# 配置文件: client/prometheus.yml
# 抓取目标: backend:8000/metrics

# 启动 Prometheus + Grafana
# 参考 deploy/ 目录配置
```

---

## 四、故障排查

### 4.1 服务无法启动

```bash
# 检查容器状态
docker-compose ps

# 查看失败容器日志
docker-compose logs backend
docker-compose logs frontend

# 常见原因:
# 1. .env 配置缺失或占位符未替换 → 检查 pre_deploy_check.py 输出
# 2. 数据库连接失败 → 检查 DB_URL 和 PostgreSQL 是否运行
# 3. Redis 连接失败 → 检查 REDIS_PASSWORD 是否一致
# 4. SSL 证书缺失 → 确认 ssl/ 目录有 fullchain.pem 和 privkey.pem
# 5. 端口冲突 → 检查 80/443/8000/5432/6379 是否被占用
```

### 4.2 前端白屏

```bash
# 1. 检查 Nginx 是否正常
docker-compose exec frontend nginx -t

# 2. 检查后端 API 是否可达
curl -k https://localhost/api/v1/health

# 3. 检查浏览器控制台 (F12)
#    - 如果有 API 401/403 → 检查 CORS_ORIGINS 配置
#    - 如果有 WebSocket 错误 → 检查 /ws/ 代理配置
#    - 如果有静态资源 404 → 检查 nginx try_files 配置
```

### 4.3 数据库迁移失败

```bash
# 查看当前迁移版本
docker-compose exec backend alembic current

# 查看迁移历史
docker-compose exec backend alembic history

# 回滚一个版本 (谨慎!)
docker-compose exec backend alembic downgrade -1

# 重置到指定版本
docker-compose exec backend alembic downgrade <revision_id>
```

### 4.4 支付回调失败

```bash
# 检查微信支付回调
docker-compose logs backend | grep -i "wechat.*notify"

# 检查支付宝回调
docker-compose logs backend | grep -i "alipay.*notify"

# 常见原因:
# 1. 回调 URL 未配置 → 检查 WX_PAY_NOTIFY_URL / ALIPAY_NOTIFY_URL
# 2. 证书路径错误 → 检查 WX_PAY_PRIVATE_KEY_PATH / ALIPAY_PRIVATE_KEY_PATH
# 3. 签名验证失败 → 检查 WX_PAY_V3_KEY / ALIPAY_PRIVATE_KEY
```

---

## 五、安全检查清单

- [ ] .env.production 中所有 `<FILL_IN>` 已替换为真实值
- [ ] JWT_SECRET_KEY 和 SESSION_SECRET_KEY 使用 `openssl rand -hex 32` 生成
- [ ] SSL 证书已替换为 CA 签发的正式证书 (非自签名)
- [ ] CORS_ORIGINS 已配置为真实域名 (不含通配符 *)
- [ ] REDIS_PASSWORD 已设置
- [ ] PostgreSQL 用户密码已设置
- [ ] MinIO ACCESS_KEY 和 SECRET_KEY 已设置
- [ ] ENV=production, API_DEBUG=false, API_RELOAD=false
- [ ] DB_ALLOW_SQLITE_FALLBACK=false
- [ ] 已轮换所有已暴露的 API Key (智谱/Coze)
- [ ] Git 远程仓库已配置
- [ ] `python scripts/pre_deploy_check.py` 全部通过

---

## 六、备份与恢复

### 6.1 定期备份

```bash
# 数据库备份 (建议每日)
#!/bin/bash
BACKUP_DIR=/data/backups
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T db pg_dumpall -U zhs_user > $BACKUP_DIR/db_full_$DATE.sql
# 保留最近 30 天
find $BACKUP_DIR -name "db_full_*.sql" -mtime +30 -delete

# MinIO 数据备份 (建议每周)
docker-compose exec minio mc mirror local/aizhs /data/backups/minio_$DATE
```

### 6.2 恢复

```bash
# 恢复数据库
docker-compose exec -T db psql -U zhs_user < /data/backups/db_full_20260623.sql

# 恢复 MinIO
docker-compose exec minio mc mirror /data/backups/minio_20260623 local/aizhs
```

---

## 七、紧急联系

| 角色 | 职责 | 联系方式 |
|------|------|---------|
| 运维负责人 | 服务器/网络/部署 | <填写> |
| 后端开发 | API/数据库/支付 | <填写> |
| 前端开发 | UI/交互/构建 | <填写> |
| 安全负责人 | 安全事件响应 | <填写> |

---

## 八、已知限制 (封版后优化)

1. **VITE_ENCRYPTION_KEY** 在前端打包 (VITE_ 前缀), 后续应重构为后端加密
2. **knowledge_service.py** metadata key SQL 拼接, 当前硬编码安全, 后续改白名单
3. **217→0 个 TS 类型错误** 已修复, 后续保持 vue-tsc 零错误
4. **box-shadow** 存量 367 处, 后续分批用边框替代
5. **console.error/warn** 约 30 处, 后续替换为统一日志服务
