# IHUI-AI 端口管理规则(强制,2026-08-15 更新)

> 本文件是 IHUI-AI 项目**唯一端口注册表**。所有端口的分配、变更、新增必须以此文件为准。
> 守门脚本:`scripts/check-port-registry.mjs`(pre-commit 第 24 项)。

---

## 1. 设计原则

1. **统一前缀 88**:所有 dev/宿主映射端口以 `88` 开头,便于辨识和管理。
2. **千位段映射**:按服务类别分段,端口号即服务类别标识。8840-8849 段位语义:CLI Agent(8841)+ 蓝绿部署预留(8840/8842-8849)。
3. **strictPort 防漂移**:应用端 dev server 必须配置 `strictPort: true`,端口被占时**报错退出**而非自动漂移。
4. **全项目 88xx**:所有服务(含容器内部端口)统一使用 88xx 体系,无豁免。
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
| 8806 | ~~Desktop(Vite+Tauri)~~ 已废弃(A 套壳:Desktop 通过 `tauri.conf.json` `devUrl:8801` 加载 web dev server,build 时加载 `web/out` 静态产物,不再需要独立 Vite 端口)| apps/desktop | `apps/desktop/src-tauri/tauri.conf.json` `devUrl: http://localhost:8801` | — |
| 8807 | CLI(预留) | apps/cli | — | — |
| 8808 | Extension(预留) | apps/extension | — | — |
| 8809 | (预留扩展) | — | — | — |

### 2.2 基础设施(8810-8819)

| 端口 | 服务 | 容器内端口 | 配置文件 |
|------|------|-----------|----------|
| 8810 | PostgreSQL | 8810 | `docker-compose.yml` `${DB_PORT:-8810}:8810` |
| 8811 | Redis | 8811 | `docker-compose.yml` `${REDIS_PORT:-8811}:8811` |
| 8812 | OTel Collector gRPC | 8812 | `deploy/observability/docker-compose.observability.yml` `8812:8812` |
| 8813 | OTel Collector HTTP | 8813 | `docker-compose.yml` `${OTEL_COLLECTOR_PORT:-8813}:8813` |
| 8814 | Jaeger UI | 8814 | `docker-compose.yml` `${JAEGER_UI_PORT:-8814}:8814` |
| 8815 | Prometheus | 8815 | `docker-compose.yml` `${PROMETHEUS_PORT:-8815}:8815` |
| 8816 | Grafana | 8816 | `docker-compose.yml` `${GRAFANA_PORT:-8816}:8816` |
| 8817 | Node Exporter | 8817 | `docker-compose.yml` `${NODE_EXPORTER_PORT:-8817}:8817` |
| 8818 | Loki | 8818 | `docker-compose.yml` `${LOKI_PORT:-8818}:8818` |
| 8819 | (预留扩展) | — | — |

### 2.3 辅助工具(8820-8829)

| 端口 | 服务 | 配置文件 |
|------|------|----------|
| 8820 | (预留扩展) | — |
| 8821 | Promtail(内部健康检查) | `monitoring/promtail/promtail-config.yml` |
| 8822-8829 | (预留扩展) | — |

### 2.4 SaaS 部署(8830-8839)

| 端口 | 服务 | 配置文件 |
|------|------|----------|
| 8830 | Admin API | `deploy/saas/admin-api/src/config.ts` `PORT: 8830` |
| 8831-8839 | (预留扩展) | — |

### 2.5 CLI Agent(8840-8849)

| 端口 | 服务 | 端 | 配置文件 | strictPort |
|------|------|------|----------|------------|
| 8841 | CLI Agent Server(HTTP/WS) | apps/cli | `apps/cli/src/commands/serve.ts:24` `--port 8841` | ✅ |
| 8840/8842-8849 | (蓝绿部署预留) | — | — | — |

**预留空槽说明(2026-07-25 立)**:8806-8809/8819/8822-8829/8831-8839/8840/8842-8849 共 19 个空槽为未来 3 年扩展预留,非当前债务。当前实际占用率 14/33 = 42%,符合 monorepo 中型项目预期。

---

## 3. 端口分配规则(强制)

### 3.1 新增端口流程

1. 在本文件 §2 注册表中找到对应类别的预留槽位。
2. 填写端口、服务名、端、配置文件路径。
3. 运行 `node scripts/check-port-registry.mjs` 验证无冲突。
4. 同 commit 提交代码改动 + 本文件更新。

### 3.2 禁止行为

- ❌ **禁止**使用 88xx 范围以外的端口(dev/宿主映射/容器内部)。
- ❌ **禁止**自行定义新端口不更新本文件。
- ❌ **禁止**修改已分配的端口(需团队评审 + 全项目 grep 替换)。
- ❌ **禁止**关闭 `strictPort`(应用端 dev server)。
- ❌ **禁止**在生产 docker-compose 中暴露非 88xx 端口到宿主。

### 3.3 端口分配段位规则

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
- 检测到非 88xx 端口→ **warn** 提醒确认是否注册。

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
| 2026-07-22 | 补充:蓝绿部署段位 8840-8849 | AI Agent |
| 2026-07-25 | 修复:Storybook 端口不一致(改 docs 承认 6006 豁免)+ 注册 CLI 8841 + 预留空槽说明 | AI Agent |
| 2026-08-15 | 全项目无豁免:所有服务(含容器内部)统一 88xx,删除豁免场景 | AI Agent |
