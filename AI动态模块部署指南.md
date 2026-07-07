# AI 动态聚合模块部署指南

> 对标 insprira, 聚合 40+ 平台热榜 + AI 媒体 RSS, 经 DeepSeek 做 LLM 分类/摘要
> 新增日期: 2026-07-06

本指南覆盖四个部署环节: Docker 服务、Python 依赖、数据库迁移、环境变量与验证。

---

## 1. 前置条件

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| Docker | 20.10+ | 需支持 `docker compose` v2 |
| Python | 3.10+ | 服务端运行环境 |
| PostgreSQL | 14+ | 已在 `docker-compose.yml` 中提供 |
| Alembic | 1.18+ | 数据库迁移工具 (已在 requirements.txt) |

---

## 2. 启动 DailyHotApi + RSSHub (Docker)

配置文件: `docker-compose.ai-feed.yml` (独立文件, 不影响现有 `docker-compose.yml`)

```bash
# 在项目根目录 g:\IHUI-AI 执行
docker compose -f docker-compose.ai-feed.yml up -d

# 查看启动状态
docker compose -f docker-compose.ai-feed.yml ps

# 查看实时日志 (Ctrl+C 退出)
docker compose -f docker-compose.ai-feed.yml logs -f
```

服务端口约定:

| 服务 | 宿主机端口 | 容器端口 | 用途 |
|------|-----------|---------|------|
| dailyhot-api | 6688 | 3000 | 40+ 平台热榜聚合 |
| rsshub | 1200 | 1200 | AI 媒体 RSS 订阅源 |

快速自测:

```bash
# DailyHotApi - 微博热榜
curl http://localhost:6688/weibo

# RSSHub - OpenAI 官方动态
curl http://localhost:1200/openai/blog
```

停止服务:

```bash
docker compose -f docker-compose.ai-feed.yml down
```

---

## 3. 安装 Python 依赖 (feedparser)

`feedparser` 已追加到 `server/requirements.txt`:

```bash
# 进入 server 目录
cd server

# 方式一: 全量安装 (推荐, 保证依赖一致)
pip install -r requirements.txt

# 方式二: 仅安装新增依赖
pip install feedparser==6.0.11
```

> 如使用 uv 管理虚拟环境: `uv pip install feedparser==6.0.11`

---

## 4. Alembic 数据库迁移

AI Feed 模块的表结构通过 Alembic 迁移管理。在执行迁移前, 确认 `server/.env` 中
`DB1_URL` 指向可用的 PostgreSQL 实例。

```bash
cd server

# 查看当前迁移状态
alembic current

# 应用所有待执行迁移到最新版本
alembic upgrade head

# (可选) 回滚一个版本
# alembic downgrade -1
```

迁移成功后, AI Feed 相关表 (sources / items / 等) 将自动创建。

---

## 5. 环境变量配置

将以下变量从 `server/.env.example` 复制到 `server/.env` 并按实际情况填写:

```dotenv
# ===== AI FEED 动态聚合 (对标 insprira) =====
# DailyHotApi 自部署地址 (Docker), 提供 40+ 平台热榜, 留空禁用
DAILYHOT_API_URL=http://localhost:6688
# RSSHub 自部署地址 (Docker), 提供 AI 媒体 RSS, 留空禁用
RSSHUB_URL=http://localhost:1200
# DeepSeek API Key (LLM 分类/摘要主力, 性价比最优, 约 ¥1/百万token)
DEEPSEEK_API_KEY=
```

变量说明:

| 变量 | 必填 | 默认行为 |
|------|------|---------|
| `DAILYHOT_API_URL` | 否 | 留空则禁用热榜聚合, 仅走 RSS |
| `RSSHUB_URL` | 否 | 留空则禁用 RSS 聚合, 仅走热榜 |
| `DEEPSEEK_API_KEY` | 是 | LLM 分类与摘要的主力模型, 必填才能启用智能标签 |

> 提示: `DEEPSEEK_API_KEY` 在 `.env.example` 的 "AI Providers" 段已存在,
> AI Feed 段为同一变量的分组说明, 实际只需在 `.env` 中填写一次真实 Key。
> DeepSeek API Key 获取: https://platform.deepseek.com/api_keys

---

## 6. 验证步骤

启动后端服务后 (默认 `http://localhost:8000`), 按顺序验证:

### 6.1 健康检查

```bash
curl http://localhost:8000/api/v1/ai-feed/sources
```

预期返回 JSON, 包含已配置的数据源列表 (HTTP 200)。

### 6.2 触发一次聚合

```bash
# 手动拉取并聚合最新内容 (具体路由以后端实现为准)
curl -X POST http://localhost:8000/api/v1/ai-feed/aggregate
```

### 6.3 检查 Docker 服务连通性

```bash
# 从宿主机确认两个上游服务可达
curl -sS http://localhost:6688/zhihu | head -c 200
curl -sS http://localhost:1200/anthropic/news | head -c 200
```

### 6.4 排查清单

| 现象 | 排查方向 |
|------|---------|
| `/ai-feed/sources` 502/超时 | 后端未启动, 检查 `API_PORT` 与进程 |
| 热榜为空 | `DAILYHOT_API_URL` 是否可达, 容器是否 `up` |
| RSS 为空 | `RSSHUB_URL` 是否可达, RSSHub 路由是否正确 |
| 无智能摘要 | `DEEPSEEK_API_KEY` 是否填写且余额充足 |
| 迁移报错 `Target database is not up to date` | 先 `alembic stamp head` 再 `alembic upgrade head` |

---

## 7. 常用运维命令速查

```bash
# 重启 AI Feed 上游服务
docker compose -f docker-compose.ai-feed.yml restart

# 更新镜像到最新版
docker compose -f docker-compose.ai-feed.yml pull
docker compose -f docker-compose.ai-feed.yml up -d

# 查看迁移历史
cd server && alembic history --verbose

# 重置 AI Feed 迁移 (危险! 会清表, 仅开发环境)
# cd server && alembic downgrade base && alembic upgrade head
```

---

## 附录: 参考文档

- DailyHotApi 仓库: https://github.com/imsyy/DailyHotApi
- RSSHub 部署文档: https://docs.rsshub.app/install/
- RSSHub 路由大全: https://docs.rsshub.app/routes/programming
- DeepSeek API: https://platform.deepseek.com/api_keys
- feedparser 文档: https://feedparser.readthedocs.io/en/latest/
