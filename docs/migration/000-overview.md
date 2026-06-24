# 000 · edu 业务能力迁移总览

> **状态**:阶段 A 进行中(资源入位)
> **目标仓库**:`G:\IHUI-AI`(主仓,Vue3 + Python FastAPI)
> **源仓库**:`G:\code\edu`(Java 23 服务 + admin/web)+ `G:\code\ljd-交接文件`

## 核心策略

| 维度 | 决定 |
|---|---|
| 主从 | IHUI-AI 为主,edu 作为新模块并入 |
| 整合方式 | 业务能力迁移,**Java 代码不搬**(冻结于 `storage/edu-assets/`) |
| 命名 | 统一改为 IHUI-AI 命名(端口模型取消,URL 前缀 `/api/v1/edu/...`) |
| 验收 | 严格企业级 |

## 三阶段路线图

```
A 基础设施(本周)        B 后端业务能力(4-6 周)         C 前端业务能力(3-4 周)
─────────────────       ───────────────────────────      ─────────────────────────
storage/edu-assets/     app/api/v1/edu/<23 domain>.py    src/views/edu/(17 domain)
docs/migration/*.md     app/models/edu_models.py        src/views/admin/edu/(22)
alembic 015~042         app/services/edu_*.py           packages/shared-edu-*
.gitignore /storage/    alembic/versions/015~042 填充    src/stores/edu/  src/api/edu/
                        tests/test_edu_*.py             client/e2e/edu-*.spec.ts
```

## 文档索引

- [`000-overview.md`](./000-overview.md) — 本文,总览
- [`edu-service-mapping.md`](./edu-service-mapping.md) — 23 服务 → IHUI-AI 域映射表
- [`api-contract-deltas.md`](./api-contract-deltas.md) — 逐服务 API 差异表
- [`db-schema-deltas.md`](./db-schema-deltas.md) — 库表差异表(MySQL edu → PG IHUI-AI)
- [`verification-report.md`](./verification-report.md) — 每阶段验收记录

## 严禁动作(再次强调)

1. ❌ 不替换 `G:\IHUI-AI\server\` 与 `client/src/` 现有代码
2. ❌ 不编译 Java 进主仓(冻结品,只供 reference)
3. ❌ 不触碰 IHUI-AI 核心规范(`.cursorrules` / `DEPLOY.md` / `pyproject.toml` 关键段)
4. ❌ 不把 `storage/` 加进 `.git`