import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';

/**
 * 需求广场智能体条目表。
 * 展示在需求广场的智能体卡片,按 sort 排序,status 控制上下架。
 */
export const plazaItems = pgTable('plaza_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  agentId: uuid('agent_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  cover: varchar('cover', { length: 500 }),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  sort: integer('sort').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Coze 变量表。
 * 存储 Coze Bot 的变量配置,按 botId + variableName 唯一标识。
 */
export const cozeVariables = pgTable('coze_variables', {
  id: uuid('id').defaultRandom().primaryKey(),
  botId: varchar('bot_id', { length: 100 }).notNull(),
  variableName: varchar('variable_name', { length: 100 }).notNull(),
  variableValue: text('variable_value'),
  description: text('description'),
  dataType: varchar('data_type', { length: 20 }).default('string').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type PlazaItem = typeof plazaItems.$inferSelect;
export type NewPlazaItem = typeof plazaItems.$inferInsert;
export type CozeVariable = typeof cozeVariables.$inferSelect;
export type NewCozeVariable = typeof cozeVariables.$inferInsert;
