# IHUI-AI

全栈 AI 平台,采用 Monorepo 架构(pnpm workspace + Turborepo)。

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| Monorepo | pnpm workspace + Turborepo | pnpm 9.15 / turbo 2.3 |
| 后端 API | Fastify + Drizzle ORM + PostgreSQL | Fastify 5.1 / Drizzle 0.38 |
| 前端 Web | Next.js + React + Tailwind + shadcn/ui | Next 15.1 / React 19 / Tailwind 4 |
| AI 服务 | FastAPI + LangGraph + LiteLLM + MCP | FastAPI 0.115 / LangGraph 0.2 |
| 数据库 | PostgreSQL 15 + Redis 7 | - |
| 认证 | @fastify/jwt + 自研 RBAC | - |
| 测试 | Vitest(后端) / Playwright(E2E) / pytest(AI 服务) | - |
| Node | >=20.10.0 | - |

## 项目结构

```
G:\IHUI-AI\
├── apps/
│   ├── api/          # 后端 API (Fastify 5 + Drizzle ORM)
│   ├── web/          # 前端 (Next.js 15 + React 19)
│   └── ai-service/   # AI 服务 (FastAPI + LangGraph + LiteLLM + MCP)
├── packages/
│   ├── database/     # Drizzle schema (96 表) + 32 迁移
│   ├── auth/         # @ihui/auth 共享认证包
│   ├── types/        # @ihui/types 共享类型定义
│   ├── ui/           # @ihui/ui 共享 UI 组件
│   ├── config/       # @ihui/config 共享配置
│   ├── eslint-config/ # @ihui/eslint-config
│   └── tsconfig/     # @ihui/tsconfig
├── docs/
│   ├── architecture.md  # 架构文档
│   └── README.md        # 文档入口
├── docker-compose.yml  # 编排 (api + web + ai-service + db + redis)
├── Dockerfile.api-new  # 后端镜像
├── Dockerfile.web-new  # 前端镜像
├── package.json
├── turbo.json
└── tsconfig.base.json
```

## 快速开始

### 环境要求

- Node.js >=20.10.0
- pnpm >=9.0.0
- Python 3.12+(AI 服务)
- PostgreSQL 15+
- Redis 7+

### 安装

```bash
pnpm install
```

### 开发

```bash
# 启动所有服务(需要先启动 PostgreSQL + Redis)
pnpm dev

# 单独启动前端
pnpm --filter @ihui/web run dev

# 单独启动后端
pnpm --filter @ihui/api run dev
```

### 构建

```bash
pnpm build
```

### 测试

```bash
# 全量测试(typecheck + lint + test)
pnpm turbo typecheck lint test

# E2E 测试
pnpm test:e2e

# AI 服务测试
cd apps/ai-service && pytest
```

### Docker 部署

```bash
# 启动全栈(api + web + ai-service + db + redis + 监控)
docker compose up -d

# 仅启动应用服务(不含监控)
docker compose up -d api web ai-service db redis
```

### 监控(APM)

项目内置完整的 Prometheus + Grafana 监控栈:

- **Prometheus**(端口 9091):指标采集,抓取 api(/metrics)+ ai-service(/metrics)+ node-exporter
- **Grafana**(端口 3001):可视化仪表盘,默认账号 admin / ihui-admin
- **Node Exporter**(端口 9100):主机指标(CPU/内存/磁盘/网络)

访问 Grafana 后,IHUI-AI 总览仪表盘已自动 provision,包含:请求 QPS、响应时间、错误率、状态码分布等面板。

## 文档

- [架构文档](docs/architecture.md) — 技术栈、数据库、API 路由、启动流程
- [交接文档](IHUI-AI-交接文档.md) — 完整工作历史、当前状态、已知问题
