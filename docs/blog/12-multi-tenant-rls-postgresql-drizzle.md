---
title: "PostgreSQL 多租户行级安全:340 张表的生产级 RLS 实践"
date: "2026-07-27"
tags: ["PostgreSQL", "RLS", "Multi-tenant", "Drizzle ORM", "SaaS", "Security"]
category: "后端架构"
description: "用 Drizzle ORM + PostgreSQL RLS 实现 340 张表的多租户行级隔离,包含策略设计、性能调优、迁移管理实战。"
---

# PostgreSQL 多租户行级安全:340 张表的生产级 RLS 实践

> SaaS 应用的生死线是「租户隔离」。一个 bug 让 A 公司看到 B 公司的数据,就是安全事故。在 IHUI-AI 这种有 340 张表、144 个迁移、1300+ API 的系统里,我们用 PostgreSQL Row Level Security (RLS) + Drizzle ORM 实现了数据库层的强制隔离——即使应用代码忘了加 `WHERE tenant_id = ?`,数据库也会拒绝跨租户访问。本文是这套方案的完整工程总结。

---

## 一、多租户架构选型

多租户(multi-tenant)架构有三种主流模式,各有取舍。

### 1.1 三种模式对比

| 模式                 | 隔离强度 | 运维成本 | 扩展性 | 适合场景             |
| -------------------- | -------- | -------- | ------ | -------------------- |
| Database-per-tenant  | 极强     | 极高     | 差     | 金融、医疗合规       |
| Schema-per-tenant    | 强       | 高       | 中     | 中大型企业客户       |
| Row-level(tenant_id) | 中       | 低       | 好     | SaaS、共享服务       |

IHUI-AI 选的是 **row-level + RLS 强制** 模式:

- 隔离强度够用:不同租户的数据在同一张表,但 RLS 策略保证不可互访
- 运维成本低:一套 schema,一次迁移,所有租户共享
- 扩展性好:加租户只是 INSERT 一行,不需要建库建表

### 1.2 为什么不纯靠应用层

最朴素的方案是每条 SQL 都带 `WHERE tenant_id = ?`。问题在于:

```typescript
// 危险:忘了加 WHERE,数据全泄露
await db.select().from(users);

// 危险:JOIN 时漏了 tenant 条件
await db.select()
  .from(orders)
  .leftJoin(items, eq(items.order_id, orders.id)); // items 没 tenant 过滤

// 危险:子查询忘了 tenant
await db.select().from(orders)
  .where(inArray(orders.user_id,
    db.select({id: users.id}).from(users))); // users 没 tenant 过滤
```

人类总会犯错。340 张表、1300+ API,只要有一个 endpoint 漏了 `tenant_id`,就是事故。RLS 的价值是**把隔离下沉到数据库,应用层犯错也不会泄露**。

---

## 二、PostgreSQL RLS 基础

### 2.1 RLS 是什么

Row Level Security 是 PostgreSQL 9.5+ 的内置功能,允许在表上定义「行级访问策略」。开启 RLS 后,所有查询都会被策略过滤,除非显式绕过。

### 2.2 最小示例

```sql
-- 1. 建表(带 tenant_id 列)
CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 开启 RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 3. 创建策略:当前会话变量 app.tenant_id 等于行的 tenant_id 才能读
CREATE POLICY tenant_isolation_select ON documents
    FOR SELECT
    USING (tenant_id = current_setting('app.tenant_id', true));

-- 4. 写策略:只能写自己租户的行
CREATE POLICY tenant_isolation_insert ON documents
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- 5. 更新/删除策略:只能改自己租户的行
CREATE POLICY tenant_isolation_update ON documents
    FOR UPDATE
    USING (tenant_id = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_delete ON documents
    FOR DELETE
    USING (tenant_id = current_setting('app.tenant_id', true));
```

### 2.3 会话变量怎么设

`current_setting('app.tenant_id', true)` 读取会话变量。在应用层,每次拿到请求时设置:

```sql
-- 设置当前租户(连接级)
SET LOCAL app.tenant_id = 'tenant_abc123';

-- 之后的查询自动被策略过滤
SELECT * FROM documents;  -- 只返回 tenant_id = 'tenant_abc123' 的行
```

`SET LOCAL` 只在当前事务内生效,事务结束自动清除,适合请求级隔离。

### 2.4 超级用户绕过陷阱

**重要**:PostgreSQL 超级用户(superuser)和表的 OWNER 默认**绕过 RLS**。生产环境务必:

```sql
-- 应用连接用普通角色,不是 superuser
-- 如果必须用 owner,显式强制 RLS
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
```

`FORCE` 让 owner 也受策略约束。superuser 仍能绕过(这是 PG 设计),所以应用账号绝不能是 superuser。

---

## 三、Drizzle ORM 集成 RLS

Drizzle ORM 0.38 不原生支持 RLS,需要自己写 middleware 在每个请求开始时注入 `SET LOCAL`。

### 3.1 连接池 + 请求级事务

```typescript
// packages/database/src/rls.ts
import { Pool } from "postgres";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 20,
});

export type RlsContext = {
  tenantId: string;
  userId: string;
  roleId: number;
};

/**
 * 在 RLS 上下文中执行函数,自动设置会话变量并在事务结束时清除。
 */
export async function withRls<T>(
  ctx: RlsContext,
  fn: (db: PostgresJsDatabase<typeof schema>) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // 注入租户上下文(SET LOCAL 只在事务内有效)
    await client.query(`SET LOCAL app.tenant_id = '${ctx.tenantId}'`);
    await client.query(`SET LOCAL app.user_id = '${ctx.userId}'`);
    await client.query(`SET LOCAL app.role_id = '${ctx.roleId}'`);

    const db = drizzle(client, { schema });
    const result = await fn(db);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

### 3.2 Fastify 集成

在 API 层用 preHandler 钩子统一注入:

```typescript
// apps/api/src/plugins/rls.ts
import { FastifyPluginAsync } from "fastify";
import { withRls, RlsContext } from "@ihui/database";

export const rlsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", async (request, reply) => {
    const user = request.user; // 来自 auth 插件
    if (!user) return; // 公开路由不注入

    const ctx: RlsContext = {
      tenantId: user.tenantId,
      userId: user.id,
      roleId: user.roleId,
    };

    // 把 rlsContext 挂到 request 上,handler 内用 withRls 执行查询
    request.rlsContext = ctx;
  });
};

// 在路由 handler 里
app.post("/documents", async (request, reply) => {
  return withRls(request.rlsContext, async (db) => {
    // db 已自动注入 tenant 上下文,RLS 策略生效
    const [doc] = await db.insert(schema.documents)
      .values({ title: request.body.title, tenantId: request.rlsContext.tenantId })
      .returning();
    return { code: 0, message: "ok", data: doc };
  });
});
```

关键点:`tenantId` 由服务端从认证态注入,**绝不信任客户端传的 tenant_id**。

---

## 四、IHUI-AI 340 张表的 RLS 策略设计

### 4.1 表分类

不是所有表都需要 RLS。IHUI-AI 把 340 张表分成三类:

| 类型              | 数量 | 是否 RLS | 示例                            |
| ----------------- | ---- | -------- | ------------------------------- |
| 租户表(tenant-owned) | 287  | 是       | documents, tasks, messages      |
| 共享表(shared)    | 38   | 否       | models, mcp_servers_registry    |
| 全局表(global)    | 15   | 否       | users, tenants, audit_logs      |

- **租户表**:每行属于一个租户,必须 `tenant_id` 列 + RLS 策略
- **共享表**:所有租户共享只读数据(如 LLM 模型清单),不需要 RLS
- **全局表**:系统级数据,通过应用层权限控制(如 admin 后台)

### 4.2 策略模板

为避免给 287 张表手写策略,我们用脚本批量生成:

```typescript
// scripts/generate-rls-policies.ts
import { schema } from "../packages/database/src/schema";

const TENANT_TABLES = Object.values(schema)
  .filter((table: any) => table.tenantId !== undefined)
  .map((table: any) => table[Symbol.for("drizzle:Name")]);

function policySQL(tableName: string): string {
  return `
-- RLS for ${tableName}
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY;

CREATE POLICY ${tableName}_select ON ${tableName}
    FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY ${tableName}_insert ON ${tableName}
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY ${tableName}_update ON ${tableName}
    FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY ${tableName}_delete ON ${tableName}
    FOR DELETE USING (tenant_id = current_setting('app.tenant_id', true));
`;
}

console.log(TENANT_TABLES.map(policySQL).join("\n"));
```

### 4.3 admin 跨租户查询

admin 后台需要查所有租户的数据。我们用角色判断:

```sql
-- admin 角色(role_id >= 1)绕过租户过滤
CREATE POLICY documents_admin_select ON documents
    FOR SELECT
    USING (
        current_setting('app.role_id', true)::int >= 1
        OR tenant_id = current_setting('app.tenant_id', true)
    );
```

这样 admin 查询时 `role_id >= 1`,策略放行所有行;普通用户 `role_id = 0`,只能看自己租户。

---

## 五、性能优化

### 5.1 索引策略

RLS 策略 `tenant_id = current_setting(...)` 会被加入每条查询的 WHERE 子句。必须在 `tenant_id` 上建索引:

```sql
-- 每张租户表必须有这个索引
CREATE INDEX idx_documents_tenant_id ON documents(tenant_id);

-- 复合索引:常见查询模式(tenant + 时间)
CREATE INDEX idx_documents_tenant_created ON documents(tenant_id, created_at DESC);

-- 复合索引:tenant + 业务字段
CREATE INDEX idx_documents_tenant_status ON documents(tenant_id, status);
```

**实测**:无索引时 287 张表的 RLS 查询平均慢 8 倍;加索引后接近无 RLS 的性能。

### 5.2 查询计划验证

上线前用 `EXPLAIN` 验证策略命中索引:

```sql
SET LOCAL app.tenant_id = 'tenant_test';
EXPLAIN SELECT * FROM documents WHERE status = 'published';
```

期望看到 `Index Scan using idx_documents_tenant_status`,而不是 `Seq Scan`。

### 5.3 连接池配置

RLS 依赖 `SET LOCAL`,必须在事务内。连接池要确保:

- 每个 `withRls` 调用占一个 client(不共享)
- 事务结束 `client.release()`,会话变量自动清除
- 池大小要够大(每个并发请求占一个连接),IHUI-AI 用 `max: 20`

---

## 六、迁移管理

### 6.1 drizzle-kit + RLS 同步

drizzle-kit 生成 schema 迁移时,不会自动加 RLS 策略。我们的工作流:

1. `pnpm --filter @ihui/database db:generate` 生成 SQL 迁移
2. 手动在迁移文件末尾追加 RLS 策略(用脚本生成)
3. `pnpm --filter @ihui/database db:migrate` 执行

```typescript
// packages/database/src/migrations/0089_add_notifications.ts
import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey(),
  tenantId: varchar("tenant_id").notNull(),  // 关键:必须有
  userId: varchar("user_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 迁移 SQL(自动生成 + 手动追加 RLS)
export const migrationSQL = sql.raw(`
CREATE TABLE "notifications" (
    "id" varchar PRIMARY KEY NOT NULL,
    "tenant_id" varchar NOT NULL,
    "user_id" varchar NOT NULL,
    "message" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX idx_notifications_tenant_id ON "notifications"("tenant_id");

-- RLS 策略(脚本生成,手动粘贴)
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY notifications_select ON "notifications"
    FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY notifications_insert ON "notifications"
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY notifications_update ON "notifications"
    FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY notifications_delete ON "notifications"
    FOR DELETE USING (tenant_id = current_setting('app.tenant_id', true));
`);
```

### 6.2 守门脚本:防止漏加 RLS

我们写了 `scripts/check-rls-policies.mjs` 守门,在 pre-commit 阶段检查:

- 所有 schema 里带 `tenantId` 的表,迁移文件里必须有对应的 `ENABLE ROW LEVEL SECURITY`
- 缺失 → 阻塞 commit

```javascript
// scripts/check-rls-policies.mjs(简化版)
import { glob } from "glob";
import { readFileSync } from "fs";

const migrationFiles = await glob("packages/database/src/migrations/*.ts");
const schemaFiles = await glob("packages/database/src/schema/*.ts");

// 提取所有有 tenantId 的表名
const tenantTables = extractTenantTables(schemaFiles);
const errors = [];

for (const table of tenantTables) {
  // 检查至少有一个迁移文件包含该表的 RLS 策略
  const hasRLS = migrationFiles.some(f =>
    readFileSync(f, "utf-8").includes(`ENABLE ROW LEVEL SECURITY`) &&
    readFileSync(f, "utf-8").includes(table)
  );
  if (!hasRLS) errors.push(`Table ${table} missing RLS policy`);
}

if (errors.length) {
  console.error("RLS policy check failed:");
  errors.forEach(e => console.error("  -", e));
  process.exit(1);
}
```

---

## 七、测试策略

### 7.1 三类测试

```typescript
// apps/api/tests/rls.test.ts
import { describe, it, expect } from "vitest";
import { withRls, pool } from "@ihui/database";

describe("RLS 隔离测试", () => {
  it("租户 A 查不到租户 B 的数据", async () => {
    // 用 tenantA 写一条
    await withRls({ tenantId: "tenantA", userId: "u1", roleId: 0 }, async (db) => {
      await db.insert(schema.documents).values({ id: "d1", tenantId: "tenantA", title: "A" });
    });

    // 用 tenantB 查,应该查不到
    await withRls({ tenantId: "tenantB", userId: "u2", roleId: 0 }, async (db) => {
      const docs = await db.select().from(schema.documents);
      expect(docs.find(d => d.id === "d1")).toBeUndefined();
    });
  });

  it("普通用户不能写入其他租户的数据", async () => {
    await expect(
      withRls({ tenantId: "tenantA", userId: "u1", roleId: 0 }, async (db) => {
        // 故意写 tenantB 的数据,应该被 RLS 拒绝
        await db.insert(schema.documents).values({ id: "d2", tenantId: "tenantB", title: "X" });
      }),
    ).rejects.toThrow(); // WITH CHECK 失败
  });

  it("admin 可以跨租户查询", async () => {
    await withRls({ tenantId: "tenantA", userId: "admin", roleId: 1 }, async (db) => {
      const docs = await db.select().from(schema.documents);
      // admin 能看到所有租户
      expect(docs.length).toBeGreaterThan(0);
    });
  });
});
```

### 7.2 权限边界测试

每张租户表至少测 4 个场景:

- SELECT:租户 A 查不到租户 B
- INSERT:租户 A 不能写租户 B 的 tenant_id
- UPDATE:租户 A 不能改租户 B 的行
- DELETE:租户 A 不能删租户 B 的行

340 张表没法逐个手写,我们用参数化测试批量跑:

```typescript
// 参数化:对所有租户表跑同一组测试
for (const table of TENANT_TABLES) {
  describe(`${table} RLS`, () => {
    it("租户隔离 SELECT", async () => testTenantIsolation(table, "select"));
    it("租户隔离 INSERT", async () => testTenantIsolation(table, "insert"));
    it("租户隔离 UPDATE", async () => testTenantIsolation(table, "update"));
    it("租户隔离 DELETE", async () => testTenantIsolation(table, "delete"));
  });
}
```

---

## 八、常见陷阱

### 8.1 超级用户绕过

如前所述,superuser 和 owner(除非 FORCE)绕过 RLS。生产环境:

- 应用账号用普通 role,`CREATE ROLE ihui_app LOGIN PASSWORD '...'`
- 每张表 `FORCE ROW LEVEL SECURITY`
- 绝不把 `DATABASE_URL` 配成 superuser

### 8.2 外键级联

外键的 `ON DELETE CASCADE` 不受 RLS 约束。如果租户 A 的订单引用了租户 B 的产品(本身不该发生),删产品时会级联删订单,绕过 RLS。

解法:**外键必须包含 tenant_id 联合**:

```sql
-- 错误:外键不带 tenant,可能跨租户引用
FOREIGN KEY (product_id) REFERENCES products(id)

-- 正确:联合外键,确保同租户
FOREIGN KEY (tenant_id, product_id) REFERENCES products(tenant_id, id)
```

### 8.3 CTE 和子查询

RLS 对 CTE(WITH 子句)和子查询**都生效**,这是好事。但要注意性能:

```sql
-- RLS 会自动给 orders 和 users 都加 tenant 过滤
SELECT * FROM orders
WHERE user_id IN (SELECT id FROM users WHERE status = 'active');
-- 实际执行:orders.tenant_id = X AND users.tenant_id = X
```

如果 CTE 里用了 `MATERIALIZED`,RLS 策略可能不被优化器下推,导致全表扫。生产环境慎用 `MATERIALIZED`。

### 8.4 COPY 绕过

`COPY` 命令默认绕过 RLS(除非 `FORCE`)。备份/导入数据时要注意,别用应用账号跑 COPY。

---

## 九、监控与审计

### 9.1 RLS 命中统计

```sql
-- 查询哪些表的 RLS 策略被频繁命中
SELECT relname, n_tup_ins, n_tup_upd, n_tup_del, n_tup_sel
FROM pg_stat_user_tables
WHERE relname IN (SELECT tablename FROM pg_policies);
```

### 9.2 审计日志

关键操作(跨租户 admin 查询、批量导出)记录到 `audit_logs` 表:

```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,  -- cross_tenant_select | export | delete
    target_tenant VARCHAR(64),    -- 被查询的目标租户
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 十、参考资料

- [PostgreSQL RLS 官方文档](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [Supabase RLS 实践](https://supabase.com/docs/guides/auth/row-level-security)
- IHUI-AI 源码:`packages/database/src/rls.ts` + `scripts/check-rls-policies.mjs`

---

## 总结

在 340 张表的生产 SaaS 里,纯靠应用层 `WHERE tenant_id = ?` 是不可靠的——人总会犯错。PostgreSQL RLS 把隔离下沉到数据库,即使应用代码漏了过滤,数据库也会拒绝跨租户访问,这是**深度防御**的典范。

IHUI-AI 的实践要点:

- **row-level + RLS 强制**:287 张租户表全开 RLS + FORCE
- **Drizzle middleware 注入**:`withRls` 在事务内 `SET LOCAL` 会话变量
- **脚本批量生成策略**:避免手写 287 份 SQL
- **守门脚本**:pre-commit 检查新增表必须有 RLS
- **参数化测试**:4 场景 × 287 表自动验证隔离

下一篇讲 [LangGraph Agent 编排模式](./13-langgraph-agent-orchestration-patterns.md),看多 agent 如何协作完成复杂任务。
