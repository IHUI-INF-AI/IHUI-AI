// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * G6 企业治理面 - 组织策略表(org_policies,2026-10-30 立)。
 *
 * 定位:组织(organizations / organization_members 成员关系,即 apps/api/src/routes/organization.ts
 * 的存量表)维度的治理策略存储。一行 = 一个组织的一个策略键,值形态是各 key 自己的 jsonb 契约
 * (首批键枚举在服务层 apps/api/src/services/org-policy-service.ts,不在本表写死)。
 *
 * 设计纪律(对齐 pricing-rules.ts 的取舍):
 * - org_id 用 varchar 存文本形态(organization_members.org_id 在存量路由里一律 ::text 比较,
 *   本表跟随同一形态,避免 bigint/uuid 二选一的类型漂移);
 * - 不建外键:organizations 表无 drizzle schema(legacy raw SQL 表),FK 只会给幂等迁移添坑;
 * - (org_id, policy_key) 全表唯一:同一组织同一键只有一条现行策略,历史靠 version 递增;
 * - policy_value 为 jsonb,读取端(org-policy-service)按 key 校验形态,非法形态按"无策略"放行;
 * - enabled=false 或 effective_from 未到 ⇒ 解析侧视为无策略(默认开放,不破坏存量行为)。
 */
export const orgPolicies = pgTable(
  'org_policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 组织 ID(organizations.id 的文本形态,与 organization_members.org_id::text 同型) */
    orgId: varchar('org_id', { length: 64 }).notNull(),
    /** 策略键封闭集(服务层枚举):model_allowlist / feature_flags / spend_budget_daily / data_retention_days */
    policyKey: varchar('policy_key', { length: 64 }).notNull(),
    /** 策略值 jsonb,形态按 policyKey 契约(见 org-policy-service.ts 的类型定义) */
    policyValue: jsonb('policy_value').notNull().default({}),
    enabled: boolean('enabled').default(true).notNull(),
    /** 策略版本:每次 PUT +1,管理端可据此做乐观并发/审计 */
    version: integer('version').default(1).notNull(),
    /** 生效起点 [effective_from, ∞);未到点视为无策略 */
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // 同一组织同一策略键只有一条现行记录
    orgKeyUniq: unique('org_policies_org_key_unique').on(t.orgId, t.policyKey),
    // 管理面按组织列策略、解析侧按 (org, key) 点查共用此前缀
    orgIdx: index('org_policies_org_idx').on(t.orgId),
  }),
)

export type OrgPolicy = typeof orgPolicies.$inferSelect
export type NewOrgPolicy = typeof orgPolicies.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
