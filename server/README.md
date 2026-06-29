# ZHS Platform

> 整合 3 套 Java 后端 (ai-project / center-project / educational-training) 到 FastAPI 单体应用

[![Tests](https://github.com/zhs-platform/zhs-platform/workflows/CI/badge.svg)](https://github.com/zhs-platform/zhs-platform/actions)
[![codecov](https://codecov.io/gh/zhs-platform/zhs-platform/branch/main/graph/badge.svg)](https://codecov.io/gh/zhs-platform/zhs-platform)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 特性

- 🚀 **FastAPI 单体应用** — 整合原 3 套 Java Spring Boot 后端 (200+ 端点)
- 🗄️ **三库分治** — ai-project / center-project / educational-training 独立数据库
- 🔐 **多端鉴权** — 账号密码 / 微信 / 短信 / Google OAuth (PC + Android 多 client ID)
- 📹 **视频处理** — ffmpeg 切片 → 对象存储 (OSS/S3) → 预签名 URL
- 🛠️ **通用管理后台** — 9 大模块 (user/role/menu/dept/post/config/dict/logininfor/notice/job)
- 🔄 **零前端改动迁移** — 原 `client/backend/` Python 后端已迁入，所有 legacy 路由直接注册在原始路径 `/api/<domain>/*`，前端无需任何改动
- 🐳 **生产就绪** — Docker + docker-compose + Nginx 反代 + Alembic 迁移 + 健康检查
- 🧪 **高测试覆盖** — 240+ 单元/集成/E2E 测试

## 快速开始

### 本地开发（零外部依赖）

**只需 Python + Node.js，无需 Redis / MinIO / PostgreSQL。**

```bash
# 1. 克隆 + 装依赖
git clone https://github.com/zhs-platform/zhs-platform.git
cd zhs-platform
pip install -e ".[dev]"

# 2. 一键启动（推荐）
start-all.bat

# 3. 或分别启动
start-backend.bat    # 后端 http://127.0.0.1:8000
start-frontend.bat   # 前端 http://127.0.0.1:8888

# 4. 打开浏览器
# 前端: http://127.0.0.1:8888
# Swagger: http://127.0.0.1:8000/docs
# 默认账号: admin / admin123
```

**手动启动（不用 .bat）：**
```bash
# 后端 (在 server/ 目录下)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 前端 (在 client/ 目录下)
node node_modules\vite\bin\vite.js --port 8888
```

### 运行测试

```bash
run-tests.bat
# 或手动:
python -m pytest tests/ -q
```

### 零外部依赖架构

本地开发时，后端会自动检测并降级外部依赖：

| 依赖 | 本地模式 | 生产模式 |
|------|----------|----------|
| **Redis** | fakeredis（内存模拟） | 必须真实 Redis |
| **MinIO** | local_uploads/（本地磁盘） | 必须真实 MinIO |
| **PostgreSQL** | SQLite（本地文件） | 必须真实 PG |

**生产环境保护：** `ENV=production` 时，Redis/MinIO/PG 不可用会直接启动失败，不会静默降级。

**监控识别：** `GET /readyz` 返回 `redis_mode: "fakeredis"` 表示降级模式。

### 生产部署 (Docker)

```bash
# 1. 复制环境变量模板
cp .env.production.template .env.production
# 填入真实值: PG_PASSWORD, GOOGLE_APP_IDS, OSS_ACCESS_KEY_ID ...

# 2. 启动 (自动跑 alembic upgrade head + uvicorn)
docker compose up -d

# 3. 初始化数据
docker compose exec api python -m scripts.seed

# 4. 配置 HTTPS 证书 (Nginx)
mkdir -p certs
cp /path/to/fullchain.pem certs/
cp /path/to/privkey.pem certs/
docker compose restart nginx
```

## 项目结构

```
zhs-platform/
├── app/
│   ├── api/v1/                # FastAPI 路由层
│   │   ├── auth/              #   - 鉴权 (login/wechat/sms/oauth/google) + legacy_local (stubs)
│   │   ├── user/              #   - 用户管理
│   │   ├── system/           #   - Admin 9 大模块 (user/role/menu/dept/...)
│   │   ├── remote.py          #   - 远程设备/三方
│   │   ├── video.py           #   - 视频预读/断点
│   │   ├── pdf/               #   - PDF 证书生成 (迁移自 client/backend/)
│   │   ├── upload/            #   - 文件上传 (迁移自 client/backend/)
│   │   ├── version/          #   - 版本管理 (迁移自 client/backend/)
│   │   ├── rbac/             #   - RBAC 权限 (迁移自 client/backend/)
│   │   ├── audit/            #   - 审计日志 (迁移自 client/backend/)
│   │   ├── agent/            #   - AI 智能体 (迁移自 client/backend/)
│   │   ├── customer_service/ #   - 客服系统 (迁移自 client/backend/)
│   │   ├── docs/             #   - 文档系统 (迁移自 client/backend-docs/)
│   │   └── _legacy_internal/ #   - 迁移兼容 shim (旧 import 路径)
│   ├── core/                  # 核心模块
│   │   └── customer_service_db.py  # 客服数据库 (迁移自 client/backend/)
│   ├── models/                # SQLAlchemy 模型 (3 套库)
│   ├── schemas/               # Pydantic 模型
│   ├── services/             # 业务服务层 (含迁移的 legacy services)
│   │   ├── _legacy_settings.py  # LegacySettings (env_prefix="LEGACY_")
│   │   ├── pdf_service.py      # PDF 服务
│   │   ├── audit_service.py    # 审计服务
│   │   ├── security_service.py # 安全服务
│   │   ├── diff_service.py     # 差异对比服务
│   │   └── markdown_converter.py # Markdown 转换 (Python rewrite)
│   ├── utils/                 # 工具 (response/pagination/storage/redis)
│   ├── config.py              # 统一配置 (Pydantic Settings)
│   ├── database.py            # SQLAlchemy 引擎 + Session
│   └── main.py                # FastAPI 入口
├── alembic/
│   ├── versions/              # 数据库迁移
│   │   ├── 001_init.sql       #   - 150 张表 DDL
│   │   └── 002_admin_job.py    #   - 定时任务表
├── scripts/dev/               # 迁移 DDL 校验脚本 (verify_*.py)
├── scripts/seed.py            # 演示数据初始化
├── app/static/ruoyi/          # 前端 RuoYi 管理界面
│   ├── index.html             #   - 9 个管理页 (Element Plus + vue-router)
│   └── login.html             #   - 登录页
├── tests/                     # 240+ 测试
│   ├── test_google_auth.py    #   - Google OAuth 23 测试
│   ├── test_ruoyi_frontend.py #   - playwright 前端 8 测试
│   ├── test_video_ffmpeg_real.py  # ffmpeg 联调 6 测试
│   ├── test_remote_video_admin.py # 远程/视频/Admin 53 测试
│   └── ...                    # 更多
├── .github/workflows/ci.yml   # GitHub Actions CI
├── Dockerfile                 # 生产镜像
├── deploy/docker/docker-compose.yml  # 编排 (PostgreSQL/Redis/API/Nginx)
├── nginx.conf                 # 反代配置
├── pyproject.toml
└── README.md
```

## API 端点

| 模块 | 路径 | 端点数 | 说明 |
|---|---|---|---|
| 鉴权 | `/api/v1/auth/` | 8 | 登录/微信/短信/Google OAuth |
| 用户 | `/api/v1/user/` | 12 | 旧版 + RuoYi 版 |
| 角色 | `/api/v1/role/` | 1 | RuoYi 版 |
| 菜单 | `/api/v1/menu/` | 4 | RuoYi 版 |
| 部门 | `/api/v1/dept/` | 2 | RuoYi 版 |
| 岗位 | `/api/v1/post/` | 1 | RuoYi 版 |
| 参数 | `/api/v1/config/` | 2 | RuoYi 版 |
| 字典 | `/api/v1/dict/` | 4 | RuoYi 版 |
| 登录日志 | `/api/v1/logininfor/` | 3 | RuoYi 版 |
| 通知公告 | `/api/v1/notice/` | 1 | RuoYi 版 |
| 定时任务 | `/api/v1/job/` + `/job/log/` | 2 | RuoYi 版 |
| 远程设备 | `/api/v1/remote/` | 11 | general-program |
| 远程三方 | `/api/v1/remote/third/` | 1 | general-program |
| 视频预读 | `/api/v1/video/preload` | 1 | general-program |
| 视频断点 | `/api/v1/video/breakpoint/` | 3 | general-program |
| 健康检查 | `/healthz` | 1 | K8s livenessProbe |
| PDF证书 | `/api/v1/pdf/` | 5 | 证书生成 (迁移自 client/backend/) |
| 文件上传 | `/api/v1/upload/` | 4 | 上传管理 (迁移自 client/backend/) |
| 版本管理 | `/api/v1/version/` | 2 | 版本控制 (迁移自 client/backend/) |
| RBAC | `/api/v1/rbac/` | 6 | 权限管理 (迁移自 client/backend/) |
| 审计日志 | `/api/v1/audit/` | 3 | 操作审计 (迁移自 client/backend/) |
| AI智能体 | `/api/v1/agent/` | 5 | Agent (迁移自 client/backend/) |
| 客服系统 | `/api/v1/customer-service/` | 8 | 客服 + 工单 (迁移自 client/backend/) |
| 文档系统 | `/api/v1/docs/` | 3 | 文档管理 (迁移自 client/backend-docs/) |

**共 240+ 端点** — 完整覆盖原 3 套 Java 后端所有 controller

## 配置

所有配置通过环境变量注入 (Pydantic Settings)，参考 [.env.production.template](.env.production.template)：

```bash
# 数据库 (PostgreSQL — 已完成 MySQL → PG 迁移)
DB1_URL=postgresql+psycopg2://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_platform
DB2_URL=postgresql+psycopg2://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_platform
DB3_URL=postgresql+psycopg2://zhs:zhs_pg_pass@127.0.0.1:5432/zhs_platform

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Google OAuth (支持多 client ID, 逗号分隔)
GOOGLE_APP_IDS=id1.apps.googleusercontent.com,id2.apps.googleusercontent.com
GOOGLE_ANDROID_IDS=android-id-1,android-id-2
GOOGLE_SECRET=GOCSPX-xxxxx

# 对象存储 (OSS / S3)
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_ACCESS_KEY_ID=LTAIxxxxxxxx
OSS_ACCESS_KEY_SECRET=xxxxxxxx
OSS_BUCKET=zhs-platform-prod
STORAGE_BACKEND=aliyun   # aliyun | s3 | local

# 视频
VIDEO_ROOT=/data/videos
```

## 测试

```bash
# 跑全量 (240+ 测试, 12 skipped)
pytest tests/ --ignore=scripts/dev/prod_drill.py

# 单模块
pytest tests/test_google_auth.py -v

# 前端 E2E (需要先启动 uvicorn)
python -m uvicorn app.main:app --port 18800 &
pytest tests/test_ruoyi_frontend.py -v

# ffmpeg 真实联调 (需要系统装 ffmpeg)
apt-get install ffmpeg   # 或 macOS: brew install ffmpeg
pytest tests/test_video_ffmpeg_real.py -v
```

测试覆盖：
- **单元测试** — 业务逻辑、工具函数、配置加载
- **集成测试** — FastAPI TestClient 调真端点 + SQLite 内存库
- **E2E** — playwright 启动 chromium 跑前端交互
- **外部联调** — respx mock Google OAuth / fakeredis mock Redis

## 数据库迁移

```bash
# 应用所有迁移
alembic upgrade head

# 创建新迁移
alembic revision --autogenerate -m "添加新表"

# 验证 DDL (CI 用)
python scripts/dev/verify_ddl_sqlite.py
python scripts/dev/verify_002_admin_job.py
```

## 演示账号

启动后用以下账号登录：

- `admin` / `admin123` — 超级管理员 (4 角色 / 完整菜单)
- `ry` / `123456` — 普通用户 (common 角色)

## 性能

- 单 worker 可处理 ~3000 RPS (简单查询)
- 4 worker 约 10K RPS
- 视频切片走 ffmpeg 异步，单片 ~100ms
- 对象存储走预签名 URL，前端直传直下，API 只签名不中转

## 路线图

- [x] 整合 3 套 Java 后端 → FastAPI
- [x] 240+ 端点 + 9 大管理模块
- [x] Google OAuth 多 client ID
- [x] 视频切片 + 对象存储
- [x] Docker + docker-compose + Nginx
- [x] 演示数据 seed
- [x] 前端登录页 + Dashboard + vue-router
- [x] `client/backend/` Python 后端迁移至 `server/app/` (零前端改动)
- [ ] 视频 HLS 自适应码率
- [ ] WebSocket 实时通知
- [ ] K8s Helm Chart
- [ ] Prometheus metrics 完善

## 贡献

PR 欢迎，但请先跑 `pytest tests/ --ignore=scripts/dev/prod_drill.py` 确保所有测试通过。

## 许可

MIT
