# IHUI-AI 端口管理规则(强制,2026-07-22 立)

> 本文件是 IHUI-AI 项目**唯一端口注册表**。所有端口的分配、变更、新增必须以此文件为准。
> 守门脚本:`scripts/check-port-registry.mjs`(pre-commit 第 24 项)。

---

## 1. 设计原则

1. **统一前缀 88**:所有 dev/宿主映射端口以 `88` 开头,便于辨识和管理。
2. **千位段映射**:按服务类别分段,端口号即服务类别标识。
3. **strictPort 防漂移**:应用端 dev server 必须配置 `strictPort: true`,端口被占时**报错退出**而非自动漂移。
4. **容器内部端口不动**:Docker 容器内部端口(8080/3000/8000/5432/6379 等)保持原状,仅改宿主映射。
5. **单一注册表**:端口分配唯一权威来源是本文件,代码中不得自行定义新端口。

---

## 2. 端口注册表

### 2.1 应用服务(8801-8809)

| 端口 | 服务 | 端 | 配置文件 | strictPort |
|------|------|------|----------|------------|
| 8801 | Web(Next.js) | apps/web | `apps/web/package.json` `-p 8801` | ✅ |
| 8802 | API(Fastify) | apps/api | `apps/api/.env` `PORT=8802` | ✅ |
| 8803 | AI Service(FastAPI) | apps/ai-service | `apps/ai-service/.env` `PORT=8803` | ✅ |
| 8804 | 小程序 Taro H5 | apps/miniapp-taro | `apps/miniapp-taro/config/dev.ts` `port: 8804` | ✅ `strictPort:true` |
| 8805 | Metro Bundler(RN/App) | apps/mobile-rn | `apps/mobile-rn/package.json` `--port 8805` | ✅ |
| 8806 | Desktop(Vite+Tauri) | apps/desktop | `apps/desktop/vite.config.ts` `port: 8806` | ✅ `strictPort:true` |
| 8807 | CLI(预留) | apps/cli | — | — |
| 8808 | Extension(预留) | apps/extension | — | — |
| 8809 | (预留扩展) | — | — | — |

### 2.2 基础设施(8810-8819)

| 端口 | 服务 | 容器内端口 | 配置文件 |
|------|------|-----------|----------|
| 8810 | PostgreSQL | 5432 | `docker-compose.yml` `${DB_PORT:-8810}:5432` |
| 8811 | Redis | 6379 | `docker-compose.yml` `${REDIS_PORT:-8811}:6379` |
| 8812 | OTel Collector gRPC | 4317 | `deploy/observability/docker-compose.observability.yml` `8812:4317` |
| 8813 | OTel Collector HTTP | 4318 | `docker-compose.yml` `${OTEL_COLLECTOR_PORT:-8813}:4318` |
| 8814 | Jaeger UI | 16686 | `docker-compose.yml` `${JAEGER_UI_PORT:-8814}:16686` |
| 8815 | Prometheus | 9090 | `docker-compose.yml` `${PROMETHEUS_PORT:-8815}:9090` |
| 8816 | Grafana | 3000 | `docker-compose.yml` `${GRAFANA_PORT:-8816}:3000` |
| 8817 | Node Exporter | 9100 | `docker-compose.yml` `${NODE_EXPORTER_PORT:-8817}:9100` |
| 8818 | Loki | 3100 | `docker-compose.yml` `${LOKI_PORT:-8818}:3100` |
| 8819 | (预留扩展) | — | — |

### 2.3 辅助工具(8820-8829)

| 端口 | 服务 | 配置文件 |
|------|------|----------|
| 8820 | Storybook | `apps/web/package.json` `storybook dev -p 8820` |
| 8821 | Promtail(内部健康检查) | `monitoring/promtail/promtail-config.yml` |
| 8822-8829 | (预留扩展) | — |

### 2.4 SaaS 部署(8830-8839)

| 端口 | 服务 | 配置文件 |
|------|------|----------|
| 8830 | Admin API | `deploy/saas/admin-api/src/config.ts` `PORT: 8830` |
| 8831-8839 | (预留扩展) | — |

### 2.5 生产容器内部端口(不变)

以下端口是 Docker 容器内部通信端口,**不修改**,仅通过 docker network 内部解析:

| 容器内端口 | 服务 | 说明 |
|-----------|------|------|
| 8080 | api | 生产 API 容器内部 |
| 3000 | web / grafana | Next.js standalone / Grafana 容器内部 |
| 8000 | ai-service | FastAPI 容器内部 |
| 5432 | postgres | PostgreSQL 容器内部 |
| 6379 | redis | Redis 容器内部 |
| 4317/4318 | otel-collector | OTLP 接收端口 |
| 16686 | jaeger | Jaeger UI 容器内部 |
| 9090 | prometheus | Prometheus 容器内部 |
| 9100 | node-exporter | Node Exporter 容器内部 |
| 3100 | loki | Loki 容器内部 |

---

## 3. 端口分配规则(强制)

### 3.1 新增端口流程

1. 在本文件 §2 注册表中找到对应类别的预留槽位。
2. 填写端口、服务名、端、配置文件路径。
3. 运行 `node scripts/check-port-registry.mjs` 验证无冲突。
4. 同 commit 提交代码改动 + 本文件更新。

### 3.2 禁止行为

- ❌ **禁止**使用 88xx 范围以外的端口(dev/宿主映射)。
- ❌ **禁止**自行定义新端口不更新本文件。
- ❌ **禁止**修改已分配的端口(需团队评审 + 全项目 grep 替换)。
- ❌ **禁止**关闭 `strictPort`(应用端 dev server)。
- ❌ **禁止**在生产 docker-compose 中暴露非 88xx 端口到宿主。

### 3.3 豁免场景

以下场景**允许**使用非 88xx 端口:

1. **CI 环境**(`.github/workflows/*.yml`):GitHub Actions service container 默认端口(5432/6379 等)。
2. **测试默认值**(`apps/api/tests/*.ts` 中的 `postgres://localhost:5432/test`):CI 环境 DB 端口。
3. **Docker 容器内部端口**:容器内通信端口(8080/3000/8000 等)。
4. **容器内部 healthcheck**:docker-compose 中 `localhost:9090/-/healthy` 等容器内检查。
5. **第三方服务外部端口**:SMTP(587/465)、OAuth provider 等外部服务端口。

### 3.4 端口分配段位规则

```
8800-8809  → 应用服务(8 端)
8810-8819  → 基础设施(PG/Redis/OTel/Jaeger/Prom/Grafana/NodeExporter/Loki)
8820-8829  → 辅助工具(Storybook/Promtail)
8830-8839  → SaaS 部署(Admin API)
8840-8899  → 预留扩展(未来新服务)
```

---

## 4. 跨端引用链路

```
extension/desktop/mobile-rn/miniapp-taro
        ↓ (调用 web proxy)
        web(8801)
        ↓ (rewrite /api/* )
        api(8802) ←──── ai-service(8803) 调 api /execute
        ↓                    ↓
    postgres(8810)     redis(8811)
        ↓
    otel-collector(8813) → jaeger(8814) / prometheus(8815) → grafana(8816)
```

---

## 5. 守门机制

### 5.1 守门脚本

`scripts/check-port-registry.mjs`(pre-commit 第 24 项):

- 扫描 staged 文件中的 `localhost:PORT` 引用。
- 校验 PORT 是否在注册表 §2 中。
- 检测到非 88xx 端口(且非豁免场景)→ **warn** 提醒确认是否注册。

### 5.2 strictPort 守门

- Taro H5:`config/dev.ts` `strictPort: true`
- Desktop Vite:`vite.config.ts` `strictPort: true`
- Web Next.js:`-p 8801`(端口被占报错)
- API/AI Service:`.env` `PORT=88xx`(端口被占报错)
- Metro:`--port 8805`(端口被占报错)

---

## 6. 变更记录

| 日期 | 变更 | 负责人 |
|------|------|--------|
| 2026-07-22 | 立规:全项目端口统一 88xx,8 端 + 基础设施 + 辅助 | AI Agent |
| 2026-07-22 | 补充:蓝绿部署段位 8840-8849 + 8081 容器内部端口 | AI Agent |
