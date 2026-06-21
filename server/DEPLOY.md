# 生产部署文档 (DEPLOY.md)

> ZHS Unified FastAPI 框架生产部署指南
> 适用版本：v1.0+
> 最后更新：2026-06-18

---

## 1. 部署架构总览

```
                            ┌─────────────────┐
                            │   Cloudflare    │
                            │   (CDN + WAF)   │
                            └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │     Nginx       │
                            │  (TLS + 限流)    │
                            └────────┬────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
       ┌──────▼──────┐       ┌───────▼──────┐       ┌───────▼──────┐
       │  FastAPI    │       │   FastAPI    │       │   FastAPI    │
       │  (8000)     │       │   (8000)     │       │   (8000)     │
       │  worker 1   │       │   worker 2   │       │   worker N   │
       └──────┬──────┘       └───────┬──────┘       └───────┬──────┘
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     │
              ┌──────────┬───────────┼───────────┬──────────┐
              │          │           │           │          │
        ┌─────▼─────┐ ┌──▼───┐ ┌─────▼─────┐ ┌───▼───┐ ┌────▼────┐
        │ PostgreSQL│ │Redis │ │  Logstash │ │ Jaeger│ │Prometheus│
        │ (主+从)   │ │Cluster│ │  (ELK)   │ │ (链路)│ │  (指标)  │
        └───────────┘ └───────┘ └───────────┘ └───────┘ └─────────┘
```

---

## 2. 环境要求

### 2.1 硬件最低配置

| 角色 | CPU | 内存 | 磁盘 | 网络 |
|------|-----|------|------|------|
| FastAPI worker | 4 核 | 8 GB | 20 GB SSD | 1 Gbps |
| PostgreSQL 主库 | 8 核 | 16 GB | 200 GB SSD | 1 Gbps |
| PostgreSQL 从库 | 4 核 | 8 GB | 200 GB SSD | 1 Gbps |
| Redis | 4 核 | 8 GB | 50 GB SSD | 1 Gbps |
| Logstash | 4 核 | 8 GB | 500 GB HDD | 1 Gbps |
| Nginx | 2 核 | 4 GB | 20 GB SSD | 10 Gbps |

### 2.2 软件版本

| 组件 | 版本 | 说明 |
|------|------|------|
| Python | 3.11+ | FastAPI 0.110+ 要求 |
| PostgreSQL | 16+ | UTF-8 |
| Redis | 7.0+ | 启用 cluster 模式 |
| Nginx | 1.24+ | HTTP/2 + gzip |
| Docker | 24.0+ | 容器化部署 |

---

## 3. 部署步骤

### 3.1 代码部署

```bash
# 1. 克隆代码
git clone <repo> /opt/zhs && cd /opt/zhs

# 2. 创建虚拟环境
python3.11 -m venv venv
source venv/bin/activate

# 3. 安装依赖
pip install --no-cache-dir -r requirements.txt -r requirements-prod.txt

# 4. 复制配置
cp .env.example .env.prod
vim .env.prod  # 修改 DB/Redis/Secret 等
```

### 3.2 数据库初始化

```bash
# 1. 执行 alembic 迁移
cd server
alembic upgrade head

# 2. 验证表数量 (应 >= 175)
python -c "
from app.core.database import Base, engine
import app.models  # 触发模型注册
tables = list(Base.metadata.tables.keys())
print(f'已注册 {len(tables)} 张表')
"

# 3. 导入初始数据
psql -h 127.0.0.1 -U postgres -d zhs -f scripts/seed.sql
```

### 3.3 启动 FastAPI (生产模式)

```bash
# 方式 A: 手工启动
cd /opt/zhs/server
gunicorn app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --timeout 60 \
    --graceful-timeout 30 \
    --keep-alive 5 \
    --access-logfile /var/log/zhs/access.log \
    --error-logfile /var/log/zhs/error.log \
    --pid /var/run/zhs.pid

# 方式 B: systemd
sudo systemctl enable --now zhs
```

### 3.4 systemd 单元文件

```ini
# /etc/systemd/system/zhs.service
[Unit]
Description=ZHS Unified FastAPI
After=network.target postgresql.service redis.service

[Service]
Type=notify
User=zhs
Group=zhs
WorkingDirectory=/opt/zhs/server
Environment="ENV=prod"
EnvironmentFile=/opt/zhs/.env.prod
ExecStart=/opt/zhs/venv/bin/gunicorn app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --timeout 60 \
    --graceful-timeout 30 \
    --access-logfile - \
    --error-logfile -
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=30
PrivateTmp=true
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### 3.5 Nginx 反向代理

```nginx
# /etc/nginx/conf.d/zhs.conf
upstream zhs_backend {
    least_conn;
    server 10.0.1.10:8000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:8000 max_fails=3 fail_timeout=30s;
    keepalive 64;
}

server {
    listen 80;
    server_name api.zhs.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.zhs.com;

    ssl_certificate /etc/nginx/ssl/zhs.crt;
    ssl_certificate_key /etc/nginx/ssl/zhs.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws: wss:;";

    # 限流 (按 IP)
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
    limit_req zone=api_limit burst=200 nodelay;

    # 请求体大小
    client_max_body_size 50m;
    client_body_timeout 60s;

    # 通用路由
    location / {
        proxy_pass http://zhs_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering on;
        proxy_buffers 16 16k;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://zhs_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # 健康检查 (不记录访问日志)
    location ~ ^/(health|metrics) {
        access_log off;
        proxy_pass http://zhs_backend;
    }
}
```

### 3.6 Docker Compose 部署 (推荐小规模)

```yaml
# docker-compose.yml
version: "3.9"

services:
  api:
    image: zhs-api:1.0.0
    build: .
    restart: always
    ports:
      - "8000:8000"
    env_file: .env.prod
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: "4"
          memory: 8G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health/live"]
      interval: 30s
      timeout: 5s
      retries: 3

  postgres:
    image: postgres:16
    restart: always
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: zhs
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./conf/postgresql.conf:/etc/postgresql/postgresql.conf
    ports:
      - "5432:5432"

  redis:
    image: redis:7.0-alpine
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  nginx:
    image: nginx:1.24-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./conf/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./conf/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
```

```bash
# 启动
docker compose up -d

# 扩缩容
docker compose up -d --scale api=6

# 查看日志
docker compose logs -f api
```

---

## 4. 配置项

### 4.1 必填环境变量

```bash
# .env.prod
ENV=prod
SECRET_KEY=<64位随机字符串>
JWT_SECRET=<64位随机字符串>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=30
JWT_REFRESH_EXPIRE_DAYS=7

# PostgreSQL
DB_HOST=postgres.internal
DB_PORT=5432
DB_USER=zhs
DB_PASSWORD=<strong-password>
DB_NAME=zhs

# Redis
REDIS_HOST=redis.internal
REDIS_PORT=6379
REDIS_PASSWORD=<strong-password>
REDIS_DB=0

# Mock (生产必须关闭)
ENABLE_MOCK=false

# 日志
LOG_LEVEL=INFO
LOGSTASH_HOST=logstash.internal
LOGSTASH_PORT=5044

# 限流
RATE_LIMIT_ENABLED=true
RATE_LIMIT_DEFAULT=100
```

### 4.2 可选配置

```bash
# 限流分级 (req/min)
RATE_LIMIT_AUTH=5
RATE_LIMIT_PAYMENT=3
RATE_LIMIT_UPLOAD=10
RATE_LIMIT_AI=20
RATE_LIMIT_SEARCH=60
RATE_LIMIT_READ=300
RATE_LIMIT_API=600

# 监控
PROMETHEUS_ENABLED=true
JAEGER_ENABLED=true
JAEGER_AGENT_HOST=jaeger.internal
JAEGER_AGENT_PORT=6831

# CORS
CORS_ALLOW_ORIGINS=https://www.zhs.com,https://admin.zhs.com
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,OPTIONS
```

---

## 5. 监控与告警

### 5.1 健康检查

| 端点 | 用途 | 频率 |
|------|------|------|
| `/health/live` | 进程存活 (K8s livenessProbe) | 10s |
| `/health/ready` | 依赖就绪 (K8s readinessProbe) | 5s |
| `/health` | 综合健康 (含 DB/Redis 探测) | 30s |
| `/metrics/rate-limit` | 限流指标 | 60s |

### 5.2 Prometheus 抓取

```yaml
# prometheus.yml
scrape_configs:
  - job_name: zhs-api
    scrape_interval: 15s
    metrics_path: /metrics
    static_configs:
      - targets: ['api.zhs.internal:8000']
        labels: { tier: backend }
```

### 5.3 关键告警

| 指标 | 阈值 | 告警级别 |
|------|------|----------|
| API 5xx 错误率 | > 1% | 严重 |
| API P99 延迟 | > 2s | 严重 |
| 限流拒绝率 | > 10% | 警告 |
| PostgreSQL 慢查询 | > 100/min | 警告 |
| Redis 内存 | > 80% | 警告 |
| 磁盘使用率 | > 85% | 严重 |
| 进程存活 | 连续 3 次失败 | 严重 |

---

## 6. 备份与恢复

### 6.1 PostgreSQL 备份

```bash
# 全量备份 (每日 02:00)
0 2 * * * pg_dump -U postgres -d zhs \
    -Fc --no-owner --no-privileges \
    | gzip > /backup/postgres/zhs-$(date +\%Y\%m\%d).dump.gz

# 保留 30 天
find /backup/postgres -mtime +30 -delete

# WAL 归档实时同步到从库
pg_receivewal -h postgres-replica -U repl \
    -D /backup/wal/ --slot=replica_slot
```

### 6.2 Redis 备份

```bash
# RDB 自动 (默认配置)
save 900 1
save 300 10
save 60 10000

# AOF (推荐)
appendonly yes
appendfsync everysec
```

### 6.3 灾难恢复

```bash
# 1. 恢复 PostgreSQL
gunzip < /backup/postgres/zhs-20260618.dump.gz | pg_restore -U postgres -d zhs -c

# 2. 重放 WAL 到目标时间 (PITR)
restore_command = 'cp /backup/wal/%f %p'
recovery_target_time = '2026-06-18 12:00:00'

# 3. 验证
psql -U postgres -d zhs -c "SELECT COUNT(*) FROM zhs.user"
```

---

## 7. 性能调优

### 7.1 FastAPI

```python
# gunicorn 配置
workers = (2 * CPU_CORES) + 1  # 经验公式
worker_class = "uvicorn.workers.UvicornWorker"
keepalive = 5
max_requests = 1000  # 防内存泄漏
max_requests_jitter = 100
timeout = 60
graceful_timeout = 30
```

### 7.2 PostgreSQL

```ini
# /etc/postgresql/16/main/postgresql.conf
shared_buffers = 12GB                # 物理内存 25%
effective_cache_size = 24GB          # 物理内存 50%
work_mem = 64MB
maintenance_work_mem = 1GB
max_connections = 500
log_min_duration_statement = 1000    # 慢查询阈值 (ms)
```

### 7.3 Redis

```conf
# /etc/redis/redis.conf
maxmemory 6gb
maxmemory-policy allkeys-lru
tcp-keepalive 60
timeout 300
```

### 7.4 Nginx

```nginx
# 性能
worker_processes auto;
worker_rlimit_nofile 65535;
events {
    worker_connections 65535;
    multi_accept on;
    use epoll;
}
http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    gzip on;
    gzip_min_length 1k;
    gzip_types text/plain application/json application/javascript text/css;
}
```

---

## 8. 灰度发布

### 8.1 蓝绿部署

```bash
# 1. 部署新版本 (蓝)
kubectl apply -f deployment-blue.yaml
kubectl set image deployment/zhs-blue api=zhs-api:1.1.0

# 2. 验证健康
kubectl wait --for=condition=ready pod -l app=zhs,version=blue --timeout=120s

# 3. 切流量 (绿 -> 蓝)
kubectl patch service zhs -p '{"spec":{"selector":{"version":"blue"}}}'

# 4. 监控 15 分钟

# 5. 旧版保留 1 小时后清理
kubectl delete deployment zhs-green
```

### 8.2 金丝雀发布

```nginx
# 切 5% 流量到金丝雀
upstream zhs_backend {
    server 10.0.1.10:8000 weight=95;
    server 10.0.1.20:8000 weight=5;  # 金丝雀
}
```

---

## 9. 安全加固

### 9.1 必做项

- [x] HTTPS 强制 (HSTS)
- [x] CSP 头配置
- [x] 限流按 IP
- [x] JWT 签名密钥 64+ 位
- [x] 密码 bcrypt (cost=12)
- [x] SQL 注入防护 (ORM 参数化)
- [x] CORS 白名单
- [x] WebSocket JWT 鉴权 (`@ws_require_auth`)
- [x] refresh token 轮转 + 黑名单

### 9.2 推荐项

- [ ] WAF (Cloudflare/AWS WAF)
- [ ] DDoS 防护
- [ ] 密钥定期轮换 (90 天)
- [ ] 审计日志 (谁在什么时间访问了什么)
- [ ] 渗透测试 (季度)
- [ ] 依赖漏洞扫描 (`pip-audit` / `safety`)

---

## 10. 故障排查

| 现象 | 可能原因 | 排查命令 |
|------|----------|----------|
| 500 错误陡增 | DB 连接池耗尽 | `SELECT * FROM pg_stat_activity` |
| 限流告警 | 恶意刷接口 | 检查 `metrics/rate-limit` |
| 登录失败 | Redis 不可用 | `redis-cli ping` |
| WS 断连 | JWT 过期 | 检查 `WS_CLOSE_CODE=1008` |
| 内存飙升 | 慢 SQL 累积 | `SELECT * FROM pg_stat_statements` |
| 启动失败 | 配置错误 | `journalctl -u zhs -n 100` |

---

## 11. 联系与升级

- 运维联系: ops@zhs.com
- 升级窗口: 每周二/四 02:00-04:00
- 紧急回滚: 1 分钟内完成 (蓝绿部署)
- 文档版本: v1.0 (2026-06-18)
