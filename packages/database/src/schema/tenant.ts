import { pgTable, uuid, varchar, timestamp, text, integer, jsonb, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 租户主表。
 * status: 1=active, 0=disabled。slug 用于子域名路由。
 * plan: free|pro|enterprise，决定默认配额档位。
 */
export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  description: text('description'),
  ownerId: uuid('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  status: integer('status').default(1).notNull(),
  plan: varchar('plan', { length: 32 }).default('free').notNull(),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 租户成员表。
 * role: 'owner' | 'admin' | 'member'。
 * (tenant_id, user_id) 联合唯一：一个用户在同一租户只占一条记录。
 */
export const tenantMembers = pgTable(
  'tenant_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: varchar('role', { length: 32 }).default('member').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantUserUnique: unique().on(t.tenantId, t.userId),
  }),
);

/**
 * 租户配额表。
 * 一个租户一条配额记录。limits 为 jsonb，灵活存储各维度上限。
 * period_start / period_end 标识当前计费周期（按月）。
 */
export const tenantQuotas = pgTable('tenant_quotas', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  apiCallsLimit: integer('api_calls_limit').default(100000).notNull(),
  apiCallsUsed: integer('api_calls_used').default(0).notNull(),
  storageLimitMb: integer('storage_limit_mb').default(10240).notNull(),
  storageUsedMb: integer('storage_used_mb').default(0).notNull(),
  userLimit: integer('user_limit').default(50).notNull(),
  userCount: integer('user_count').default(0).notNull(),
  limits: jsonb('limits').default({}).notNull(),
  periodStart: timestamp('period_start', { withTimezone: true }).defaultNow().notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantMember = typeof tenantMembers.$inferSelect;
export type NewTenantMember = typeof tenantMembers.$inferInsert;
export type TenantQuota = typeof tenantQuotas.$inferSelect;
export type NewTenantQuota = typeof tenantQuotas.$inferInsert;
