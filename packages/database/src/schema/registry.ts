import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * 资源上游自动同步中心 schema(2026-07-24 立)。
 *
 * 3 张表:
 * 1. registry_items              资源条目(MCP/Skill/Plugin 元数据缓存)
 * 2. registry_sync_logs          同步日志(每次拉取的版本/状态/耗时)
 * 3. registry_webhook_triggers   webhook 触发记录(持久化 webhooks-trigger.ts 内存 Map)
 *
 * 字段命名 camelCase(JS) -> snake_case(DB 列名),与 packages/types/src/registry.ts 跨端契约对应。
 */
/**
 * 资源条目表。
 * - sourceType: 'mcp' | 'skill' | 'plugin'
 * - source:     'github' | 'npm' | 'mcp_marketplace' | 'custom'
 * - sourceId:   上游源内唯一 ID(GitHub repo full_name / npm 包名 / marketplace item id)
 * - heatScore:  热度评分(install_count + stars + recent_releases)
 * - qualityScore: 质量评分(文档/维护/兼容性)
 * - payload:    原始上游 payload(GitHub release / npm manifest / marketplace api response)
 * 复合唯一 (source_type, source, source_id):避免同一上游同一资源重复入库。
 */
export const registryItems = pgTable(
  'registry_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceType: varchar('source_type', { length: 20 }).notNull(),
    source: varchar('source', { length: 20 }).notNull(),
    sourceId: varchar('source_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    version: varchar('version', { length: 100 }),
    author: varchar('author', { length: 200 }),
    homepage: varchar('homepage', { length: 500 }),
    repoUrl: varchar('repo_url', { length: 500 }),
    downloadUrl: varchar('download_url', { length: 500 }),
    categories: jsonb('categories').notNull().default([]),
    tags: jsonb('tags').notNull().default([]),
    installCount: integer('install_count').default(0).notNull(),
    heatScore: integer('heat_score').default(0).notNull(),
    qualityScore: integer('quality_score').default(0).notNull(),
    latestSyncedAt: timestamp('latest_synced_at', { withTimezone: true }),
    payload: jsonb('payload').notNull().default({}),
    payloadHash: varchar('payload_hash', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sourceTypeIdx: index('registry_items_source_type_idx').on(t.sourceType),
    sourceIdx: index('registry_items_source_idx').on(t.source),
    sourceTypeSourceIdUniq: uniqueIndex('registry_items_source_type_source_id_uniq').on(
      t.sourceType,
      t.source,
      t.sourceId,
    ),
    heatScoreIdx: index('registry_items_heat_score_idx').on(t.heatScore),
    qualityScoreIdx: index('registry_items_quality_score_idx').on(t.qualityScore),
    latestSyncedAtIdx: index('registry_items_latest_synced_at_idx').on(t.latestSyncedAt),
    payloadHashIdx: index('registry_items_payload_hash_idx').on(t.payloadHash),
  }),
)

/**
 * 同步日志表。
 * - sourceName: 具体仓库名/包名/marketplace id
 * - status:     'success' | 'fail' | 'skipped' | 'running'
 * - payloadHash: 本次拉取 payload 的 SHA-256(变更检测)
 */
export const registrySyncLogs = pgTable(
  'registry_sync_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceType: varchar('source_type', { length: 20 }).notNull(),
    sourceName: varchar('source_name', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).default('running').notNull(),
    errorMessage: text('error_message'),
    payloadHash: varchar('payload_hash', { length: 64 }),
    oldVersion: varchar('old_version', { length: 100 }),
    newVersion: varchar('new_version', { length: 100 }),
    durationMs: integer('duration_ms').default(0).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => ({
    sourceTypeIdx: index('registry_sync_logs_source_type_idx').on(t.sourceType),
    statusIdx: index('registry_sync_logs_status_idx').on(t.status),
    startedAtIdx: index('registry_sync_logs_started_at_idx').on(t.startedAt),
  }),
)

/**
 * Webhook 触发记录表(持久化 webhooks-trigger.ts 内存 Map)。
 * - source:    'github' | 'npm' | 'mcp_marketplace' | 'custom'
 * - signature: HMAC-SHA256 签名(请求头 X-Hub-Signature-256 等)
 * - status:    'pending' | 'processed' | 'failed' | 'ignored'
 */
export const registryWebhookTriggers = pgTable(
  'registry_webhook_triggers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    source: varchar('source', { length: 20 }).notNull(),
    signature: varchar('signature', { length: 255 }),
    payload: jsonb('payload').notNull().default({}),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    resultMessage: text('result_message'),
  },
  (t) => ({
    sourceIdx: index('registry_webhook_triggers_source_idx').on(t.source),
    statusIdx: index('registry_webhook_triggers_status_idx').on(t.status),
    receivedAtIdx: index('registry_webhook_triggers_received_at_idx').on(t.receivedAt),
  }),
)

export type RegistryItemRecord = typeof registryItems.$inferSelect
export type NewRegistryItemRecord = typeof registryItems.$inferInsert
export type RegistrySyncLogRecord = typeof registrySyncLogs.$inferSelect
export type NewRegistrySyncLogRecord = typeof registrySyncLogs.$inferInsert
export type RegistryWebhookTriggerRecord = typeof registryWebhookTriggers.$inferSelect
export type NewRegistryWebhookTriggerRecord = typeof registryWebhookTriggers.$inferInsert
