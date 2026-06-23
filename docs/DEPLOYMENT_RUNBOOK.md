# 智汇AI 部署运维手册

## 1. 部署前准备

### 1.1 配置文件
- 填写 `server/.env.production` 中所有配置项
- 确认 `.env`（项目根目录）中 Docker Compose 变量正确
- 运行 `cd server && python scripts/pre_deploy_check.py` 验证

### 1.2 SSL 证书
- 将 CA 签发的证书放入 `ssl/fullchain.pem` 和 `ssl/privkey.pem`
- 自签名证书仅用于测试，生产环境必须使用 CA 证书

### 1.3 Git 仓库
- 确认远程仓库已配置: `git remote -v`
- 推送最新代码: `git push origin main`

## 2. Docker 部署

### 2.1 构建并启动
```bash
docker compose up -d --build
```

### 2.2 服务架构
| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| frontend | aizhs-frontend | 80, 443 | Nginx + Vue SPA |
| backend | aizhs-backend | 8000 (内部) | FastAPI |
| db | aizhs-db | 5432 (内部) | PostgreSQL 15 |
| redis | aizhs-redis | 6379 (内部) | Redis 7 |
| minio | aizhs-minio | 9000, 9001 | 对象存储 |

### 2.3 健康检查
所有服务均配置了 healthcheck，可通过 `docker compose ps` 查看状态。

## 3. 运维操作

### 3.1 日志查看
```bash
docker compose logs -f backend    # 后端日志
docker compose logs -f frontend   # 前端日志
docker compose logs -f --tail=100 # 所有服务最近100行
```

### 3.2 数据库操作
```bash
docker compose exec db psql -U aizhs -d aizhs  # 进入 PostgreSQL
docker compose exec backend alembic upgrade head # 执行数据库迁移
docker compose exec backend alembic revision --autogenerate -m "描述" # 生成迁移
```

### 3.3 Redis 操作
```bash
docker compose exec redis redis-cli -a <REDIS_PASSWORD>
```

### 3.4 MinIO 操作
- 控制台: http://<服务器IP>:9001
- API: http://<服务器IP>:9000

### 3.5 监控
- Prometheus: `client/prometheus.yml`
- ELK: `client/docker-compose.elk.yml`

## 4. 故障排查

### 4.1 服务无法启动
```bash
docker compose ps              # 查看服务状态
docker compose logs backend    # 查看后端日志
docker compose logs frontend   # 查看前端日志
```

### 4.2 数据库连接失败
- 检查 DB_PASSWORD 是否正确
- 检查 db 服务是否 healthy
- 检查网络: `docker network ls | grep aizhs`

### 4.3 SSL 证书问题
- 确认 `ssl/fullchain.pem` 和 `ssl/privkey.pem` 存在
- 确认 docker-compose.yml 中 SSL volume 挂载正确
- 检查 nginx.conf 中证书路径

### 4.4 前端白屏
- 检查后端是否正常运行: `curl http://localhost:8000/healthz`
- 检查 nginx.conf 中 proxy_pass 配置
- 查看浏览器控制台错误

## 5. 安全检查清单

- [ ] .env.production 中无真实密钥暴露在 git
- [ ] SSL 证书为 CA 签发（非自签名）
- [ ] JWT_SECRET_KEY 为强随机值
- [ ] Redis 已设置密码
- [ ] PostgreSQL 已设置密码
- [ ] MinIO 已设置密钥
- [ ] nginx server_tokens off
- [ ] 安全头已配置 (HSTS, X-Frame-Options, CSP 等)

## 6. 备份与恢复

### 6.1 数据库备份
```bash
docker compose exec db pg_dump -U aizhs aizhs > backup_$(date +%Y%m%d).sql
```

### 6.2 数据库恢复
```bash
docker compose exec -T db psql -U aizhs aizhs < backup_20260623.sql
```

### 6.3 Redis 备份
```bash
docker compose exec redis redis-cli -a <PASSWORD> SAVE
docker cp aizhs-redis:/data/dump.rdb ./redis_backup.rdb
```

## 7. 已知限制

- VITE_ENCRYPTION_KEY 在前端环境变量中（设计性限制，后续优化）
- knowledge_service.py SQL 拼接（低风险，后续优化）
- 自签名 SSL 证书需替换为 CA 证书
