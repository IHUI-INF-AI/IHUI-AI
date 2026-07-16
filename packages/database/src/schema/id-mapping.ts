import { pgTable, uuid, varchar, bigint, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core'

/**
 * ID 映射表 — Java Long 自增 ID → TS uuid 随机 ID 映射。
 * - legacyTable: Java 旧表名(如 'member'、'user'、'course')
 * - legacyId: Java Long 自增 ID
 * - newId: TS uuid
 * - migrationBatch: 迁移批次号(用于断点续传与批次追踪)
 *
 * 唯一约束:同一表同一 legacy_id 只能映射一次(防重复映射)。
 * 幂等导入:同 legacy_id 第二次导入 onConflictDoUpdate 更新 newId/migrationBatch。
 */
export const idMapping = pgTable(
  'id_mapping',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    legacyTable: varchar('legacy_table', { length: 100 }).notNull(),
    legacyId: bigint('legacy_id', { mode: 'number' }).notNull(),
    newId: uuid('new_id').notNull(),
    migrationBatch: varchar('migration_batch', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    legacyUniq: uniqueIndex('id_mapping_legacy_uniq').on(t.legacyTable, t.legacyId),
    newIdx: index('id_mapping_new_idx').on(t.newId),
  }),
)

export type IdMapping = typeof idMapping.$inferSelect
export type NewIdMapping = typeof idMapping.$inferInsert
