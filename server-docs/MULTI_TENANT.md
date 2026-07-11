# 多租户架构指南（Multi-Tenant）

> 迁移自旧架构 `server/docs/MULTI_TENANT.md`，适配新架构（TS Monorepo + Fastify + Drizzle）。

## 1. 概述

IHUI-AI 采用**共享数据库 + 行级隔离**的多租户模型。每个租户（tenant）通过 `tenant_id` 字段隔离数据，应用层在查询时自动注入租户过滤条件。

## 2. 租户模型

### 2.1 数据隔离层级

| 层级   | 隔离方式 | 说明                             |
| ------ | -------- | -------------------------------- |
| 数据库 | 共享     | 所有租户共用同一 PostgreSQL 实例 |
| Schema | 共享     | 所有租户共用同一 schema          |
| 行     | 隔离     | 通过 `tenant_id` 列实现行级隔离  |

### 2.2 租户标识传递链路

```
请求 → tenant 插件（解析 X-Tenant-ID / JWT claim）→ request.tenantId → 查询层自动注入 WHERE tenant_id = ?
```

- `apps/api/src/plugins/tenant.ts` 负责从请求头 `X-Tenant-ID` 或 JWT payload 中解析 `tenantId` 并挂载到 `request.tenantId`。
- 所有多租户表在 schema 中定义 `tenantId` 列（见 `packages/database/src/schema/tenant.ts`）。
- 查询层（`apps/api/src/db/*-queries.ts`）在读写时自动携带 `tenantId` 过滤。

## 3. 租户管理

### 3.1 租户生命周期

1. **创建**：管理员通过 `POST /api/admin/tenants` 创建租户，分配默认配额。
2. **激活/停用**：通过 `PUT /api/admin/tenants/:id/status` 切换租户状态，停用后该租户用户无法登录。
3. **配额**：每个租户有独立的 API 调用、存储、Token 配额，由 `billing-queries.ts` 跟踪。
4. **删除**：软删除，保留数据 30 天后物理清理。

### 3.2 用户与租户关系

- 一个用户可属于多个租户（多角色）。
- 登录时通过 `tenantId` 字段指定当前活跃租户。
- 切换租户通过 `POST /api/auth/switch-tenant`。

## 4. 安全约束

- **禁止跨租户访问**：所有查询必须携带 `tenantId`，缺失则拒绝执行。
- **IDOR 防护**：`apps/api/src/utils/idor-guard.ts` 校验资源归属租户。
- **数据范围**：`packages/auth/src/data-scope.ts` 实现基于租户的数据权限控制。
- **审计**：所有跨租户敏感操作记录到 `audit` 表，含 `tenantId`。

## 5. 配额与限流

| 资源     | 默认配额  | 超额处理   |
| -------- | --------- | ---------- |
| API 调用 | 10000/天  | 429 限流   |
| 文件存储 | 10 GB     | 拒绝上传   |
| AI Token | 100 万/月 | 降级或拒绝 |
| 并发会话 | 50        | 拒绝新会话 |

限流由 `apps/api/src/plugins/queue.ts` + Redis 实现，按 `tenantId` 维度计数。

## 6. 运维注意事项

- 新增多租户表时，**必须**在 schema 中添加 `tenantId` 列并建索引。
- 运维查询若需跨租户，必须显式声明并经 DBA 审批，禁止在生产直连绕过租户过滤。
- 租户数据导出/迁移走 `apps/api/src/routes/tenant.ts` 提供的管理接口，不直接操作数据库。
