import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  real,
  date,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * AI 资讯数据源配置表 (ai_feed_source)。
 * 对应 DailyHotApi 的一个平台 / RSSHub 的一条路由 / 一个官方 API。
 * 前端"动态 Tab"由 enabled=true 的 source 驱动，支持拖拽排序 (sortOrder)。
 * sourceType: hotlist / rss / api。
 * category: general(通用热榜) / ai-media(AI媒体) / ai-paper(AI论文) / tech-community(技术社区)。
 */
export const aiFeedSource = pgTable(
  'ai_feed_source',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceCode: varchar('source_code', { length: 64 }).notNull(),
    sourceName: varchar('source_name', { length: 100 }).notNull(),
    sourceType: varchar('source_type', { length: 32 }).default('hotlist').notNull(),
    endpoint: varchar('endpoint', { length: 255 }),
    category: varchar('category', { length: 64 }).default('general').notNull(),
    icon: varchar('icon', { length: 255 }),
    color: varchar('color', { length: 16 }),
    enabled: boolean('enabled').default(true).notNull(),
    sortOrder: integer('sort_order').default(100).notNull(),
    fetchIntervalMinutes: integer('fetch_interval_minutes').default(60).notNull(),
    lastFetchAt: timestamp('last_fetch_at', { withTimezone: true }),
    lastFetchStatus: varchar('last_fetch_status', { length: 32 }),
    lastFetchCount: integer('last_fetch_count'),
    description: varchar('description', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeUniq: unique('uq_ai_feed_source_code').on(t.sourceCode),
    enabledIdx: index('ix_ai_feed_source_enabled').on(t.enabled),
    sortIdx: index('ix_ai_feed_source_sort').on(t.sortOrder),
  }),
)

/**
 * AI 资讯热门条目表 (ai_feed_hot_item)。
 * 一个 (sourceCode + platformItemId) 全局唯一，多日快照复用同一行。
 * LLM 分类与摘要缓存在此表，避免重复调用。
 * llmCategory: hotspot/account/source/creation/analysis/retrieval/tool。
 * trendTag: rising/stable/cooling/new（由 trend_signal 同步，便于列表快速筛选）。
 */
export const aiFeedHotItem = pgTable(
  'ai_feed_hot_item',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceCode: varchar('source_code', { length: 64 }).notNull(),
    platformItemId: varchar('platform_item_id', { length: 128 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    summary: text('summary'),
    url: varchar('url', { length: 1000 }),
    coverUrl: varchar('cover_url', { length: 1000 }),
    author: varchar('author', { length: 200 }),
    currentRank: integer('current_rank'),
    currentHot: bigint('current_hot', { mode: 'number' }),
    publishTime: timestamp('publish_time', { withTimezone: true }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    llmCategory: varchar('llm_category', { length: 64 }),
    llmTags: varchar('llm_tags', { length: 500 }),
    llmSummary: text('llm_summary'),
    llmProcessedAt: timestamp('llm_processed_at', { withTimezone: true }),
    trendTag: varchar('trend_tag', { length: 16 }),
    trendGrowthPct: real('trend_growth_pct'),
    titleEn: varchar('title_en', { length: 500 }),
    titleJa: varchar('title_ja', { length: 500 }),
    titleKo: varchar('title_ko', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sourcePidUniq: unique('uq_ai_feed_item_source_pid').on(t.sourceCode, t.platformItemId),
    sourceIdx: index('ix_ai_feed_item_source').on(t.sourceCode),
    categoryIdx: index('ix_ai_feed_item_category').on(t.llmCategory),
    trendIdx: index('ix_ai_feed_item_trend').on(t.trendTag),
    hotIdx: index('ix_ai_feed_item_hot').on(t.currentHot),
    lastSeenIdx: index('ix_ai_feed_item_last_seen').on(t.lastSeenAt),
  }),
)

/**
 * AI 资讯每日快照表 (ai_feed_snapshot)。
 * 记录某条目在某天的排名与热度，用于 7/14 天趋势对比。
 * 每日 cron 任务为每个 enabled source 的 top N 条目写一条快照。
 * (sourceCode + platformItemId + snapshotDate) 三元组唯一。
 */
export const aiFeedSnapshot = pgTable(
  'ai_feed_snapshot',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceCode: varchar('source_code', { length: 64 }).notNull(),
    platformItemId: varchar('platform_item_id', { length: 128 }).notNull(),
    itemId: uuid('item_id').references(() => aiFeedHotItem.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 500 }).notNull(),
    rank: integer('rank'),
    hotValue: bigint('hot_value', { mode: 'number' }),
    snapshotDate: date('snapshot_date').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    srcPidDateUniq: unique('uq_ai_feed_snapshot_src_pid_date').on(
      t.sourceCode,
      t.platformItemId,
      t.snapshotDate,
    ),
    sourceDateIdx: index('ix_ai_feed_snapshot_source_date').on(t.sourceCode, t.snapshotDate),
    dateIdx: index('ix_ai_feed_snapshot_date').on(t.snapshotDate),
  }),
)

/**
 * AI 资讯预计算趋势信号表 (ai_feed_trend_signal)。
 * 每日 cron 任务用 EMA 平滑计算并刷新，对每个有快照的条目计算 7/14 天窗口的增长率与排名变化。
 * trendTag: rising(增长) / stable(稳定) / cooling(冷却) / new(新晋)。
 * 前端列表直接读 trendTag，无需实时计算。
 */
export const aiFeedTrendSignal = pgTable(
  'ai_feed_trend_signal',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    itemId: uuid('item_id')
      .references(() => aiFeedHotItem.id, { onDelete: 'cascade' })
      .notNull(),
    sourceCode: varchar('source_code', { length: 64 }).notNull(),
    platformItemId: varchar('platform_item_id', { length: 128 }).notNull(),
    windowDays: integer('window_days').notNull(),
    growthPct: real('growth_pct'),
    rankDelta: integer('rank_delta'),
    emaHot: bigint('ema_hot', { mode: 'number' }),
    hotThen: bigint('hot_then', { mode: 'number' }),
    trendTag: varchar('trend_tag', { length: 16 }).default('stable').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
    snapshotCount: integer('snapshot_count'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    itemWindowUniq: unique('uq_ai_feed_trend_item_window').on(t.itemId, t.windowDays),
    tagIdx: index('ix_ai_feed_trend_tag').on(t.trendTag),
    windowIdx: index('ix_ai_feed_trend_window').on(t.windowDays),
  }),
)

export type AiFeedSource = typeof aiFeedSource.$inferSelect
export type NewAiFeedSource = typeof aiFeedSource.$inferInsert
export type AiFeedHotItem = typeof aiFeedHotItem.$inferSelect
export type NewAiFeedHotItem = typeof aiFeedHotItem.$inferInsert
export type AiFeedSnapshot = typeof aiFeedSnapshot.$inferSelect
export type NewAiFeedSnapshot = typeof aiFeedSnapshot.$inferInsert
export type AiFeedTrendSignal = typeof aiFeedTrendSignal.$inferSelect
export type NewAiFeedTrendSignal = typeof aiFeedTrendSignal.$inferInsert
