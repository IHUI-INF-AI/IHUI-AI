import { pgTable, varchar, integer, jsonb, timestamp, index, text } from 'drizzle-orm/pg-core'

/**
 * CLI 供应商导入历史表(cli_provider_imports)。
 *
 * 每次 commit 成功后写入一条记录,用于:
 * - 用户查询导入历史(/settings/import 页面底部列表)
 * - 审计 + 故障排查(完整 preview 快照,apiKey 已脱敏)
 * - 去重参考(避免用户重复导入相同来源)
 *
 * 与 ai_model_config.import_source / import_source_id 配合:
 *   ai_model_config 记录每条导入的 provider
 *   cli_provider_imports 记录每次导入操作的元信息
 */
export const cliProviderImports = pgTable(
  'cli_provider_imports',
  {
    /** uuid,由应用层生成 */
    id: varchar('id', { length: 64 }).primaryKey(),
    /** 用户 id(关联 users.id) */
    ownerUuid: varchar('owner_uuid', { length: 64 }).notNull(),
    /** 导入来源: cc-switch | codex++ | claude-cli | codex-cli | gemini-cli | hermes */
    source: varchar('source', { length: 32 }).notNull(),
    /** cc-switch 的 app_type(仅 cc-switch 有值) */
    sourceAppType: varchar('source_app_type', { length: 32 }),
    /** 解析的本地路径或上传文件名 */
    sourcePath: varchar('source_path', { length: 500 }).notNull(),
    /** 源工具版本(如 cc-switch v3.17.0 / codex++ v1.2.39) */
    sourceVersion: varchar('source_version', { length: 32 }),
    importedCount: integer('imported_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    /** 完整解析快照(已脱敏 apiKey,用于审计与重放) */
    importPreview: jsonb('import_preview'),
    /** success | partial | failed */
    status: varchar('status', { length: 16 }).notNull(),
    errorMessage: text('error_message'),
    importedAt: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerIdx: index('ix_cli_provider_imports_owner').on(t.ownerUuid),
    importedAtIdx: index('ix_cli_provider_imports_imported_at').on(t.importedAt),
  }),
)

export type CliProviderImport = typeof cliProviderImports.$inferSelect
export type NewCliProviderImport = typeof cliProviderImports.$inferInsert
