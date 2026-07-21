import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index, unique } from 'drizzle-orm/pg-core'

/**
 * AI World 分类表 - AI 工具集分类(可借鉴 ai-bot.cn 但重命名)。
 */
export const aiWorldCategories = pgTable(
  'ai_world_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    description: varchar('description', { length: 500 }),
    icon: varchar('icon', { length: 100 }),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sortIdx: index('ix_ai_world_categories_sort').on(t.sort),
  }),
)

/**
 * AI World 条目表 - 通用 entry,用 kind 区分:
 * - news: AI 资讯(官方 blog)
 * - paper: AI 论文(arXiv / HF Daily Papers)
 * - project: GitHub 趋势项目
 * - tool: AI 工具
 * - app: AI APP
 *
 * 热度字段(2026-07-22 立):trendingScore 综合热度分(0-100),trendingMetrics 多维热度数据,
 * trendingUpdatedAt 热度更新时间。trendingMetrics 结构示例:
 * { githubStars, githubForks, githubWatchers, productHuntVotes, similarwebVisits, huggingfaceDownloads }
 */
export const aiWorldItems = pgTable(
  'ai_world_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: varchar('kind', { length: 32 }).notNull(),
    categoryId: uuid('category_id').references(() => aiWorldCategories.id, {
      onDelete: 'set null',
    }),
    slug: varchar('slug', { length: 200 }),
    title: varchar('title', { length: 500 }).notNull(),
    summary: varchar('summary', { length: 1000 }),
    content: text('content'),
    url: varchar('url', { length: 1000 }),
    coverImage: varchar('cover_image', { length: 1000 }),
    authorId: uuid('author_id'),
    source: varchar('source', { length: 200 }).notNull(),
    sourceUrl: varchar('source_url', { length: 1000 }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    viewCount: integer('view_count').default(0).notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    /** 综合热度分(0-100,LLM 综合多源数据给出) */
    trendingScore: integer('trending_score'),
    /** 多维热度数据 { githubStars, githubForks, productHuntVotes, similarwebVisits, ... } */
    trendingMetrics: jsonb('trending_metrics'),
    /** 热度数据最近更新时间 */
    trendingUpdatedAt: timestamp('trending_updated_at', { withTimezone: true }),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('ix_ai_world_items_category').on(t.categoryId),
    kindIdx: index('ix_ai_world_items_kind').on(t.kind),
    sourceIdx: index('ix_ai_world_items_source').on(t.source),
    kindSourceUrlUniq: unique('uq_ai_world_items_kind_source_url').on(t.kind, t.sourceUrl),
    trendingScoreIdx: index('ix_ai_world_items_trending_score').on(t.trendingScore),
  }),
)

/**
 * AI World 模型排行榜表 - 存储各大权威榜单的真实排名数据。
 *
 * 数据源(2026-07-22 立,5 大权威榜单):
 * - lmsys: LMSYS Chatbot Arena(HuggingFace Spaces,综合/编程/数学/硬提示/多轮等)
 * - opencompass: OpenCompass 司南(中文/英文/代码/推理等)
 * - hf-open-llm: HuggingFace Open LLM Leaderboard(开源模型综合)
 * - superclue: SuperCLUE(中文综合/学科/安全等)
 * - artificial-analysis: Artificial Analysis(性能/价格/质量综合)
 *
 * category 字段对齐各榜单子分类,不同榜单语义不同(统一字符串保留)。
 * score 字段不同榜单单位不同(Elo / 百分比 / 分数),用 string 保留原文。
 * scores 字段保留多维度数据 {elo, ci_lower, ci_upper, votes} 等。
 */
export const aiWorldRankings = pgTable(
  'ai_world_rankings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 榜单 ID:lmsys / opencompass / hf-open-llm / superclue / artificial-analysis */
    leaderboard: varchar('leaderboard', { length: 50 }).notNull(),
    /** 子分类:overall / coding / math / reasoning / chinese / english / multiturn / hard-prompts */
    category: varchar('category', { length: 50 }).notNull(),
    /** 排名(从 1 开始) */
    rank: integer('rank').notNull(),
    /** 模型名称(原始榜单名称,如 "GPT-4o" / "Claude 3.5 Sonnet") */
    modelName: varchar('model_name', { length: 200 }).notNull(),
    /** 模型提供方(如 openai / anthropic / google / meta / mistral) */
    provider: varchar('provider', { length: 100 }),
    /** 分数(原始字符串保留,Elo / 百分比 / 分数 等) */
    score: varchar('score', { length: 100 }),
    /** 多维分数 {elo, ci_lower, ci_upper, votes, organization, license, ...} */
    scores: jsonb('scores'),
    /** 额外元数据(原始抓取保留) */
    metadata: jsonb('metadata').notNull().default({}),
    /** 榜单发布时间(从榜单页面解析) */
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** 抓取时间 */
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    leaderboardIdx: index('ix_ai_world_rankings_leaderboard').on(t.leaderboard),
    categoryIdx: index('ix_ai_world_rankings_category').on(t.category),
    rankIdx: index('ix_ai_world_rankings_rank').on(t.rank),
    leaderboardCategoryModelUniq: unique('uq_ai_world_rankings_lb_cat_model').on(t.leaderboard, t.category, t.modelName),
  }),
)

/**
 * AI World 同步日志表 - 记录每次 cron 同步的源/状态/条目数/错误。
 */
export const aiWorldSyncLog = pgTable(
  'ai_world_sync_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    source: varchar('source', { length: 200 }).notNull(),
    kind: varchar('kind', { length: 32 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    itemCount: integer('item_count').default(0).notNull(),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sourceIdx: index('ix_ai_world_sync_log_source').on(t.source),
    startedAtIdx: index('ix_ai_world_sync_log_started_at').on(t.startedAt),
  }),
)

export type AiWorldCategory = typeof aiWorldCategories.$inferSelect
export type NewAiWorldCategory = typeof aiWorldCategories.$inferInsert
export type AiWorldItem = typeof aiWorldItems.$inferSelect
export type NewAiWorldItem = typeof aiWorldItems.$inferInsert
export type AiWorldSyncLog = typeof aiWorldSyncLog.$inferSelect
export type NewAiWorldSyncLog = typeof aiWorldSyncLog.$inferInsert
export type AiWorldRanking = typeof aiWorldRankings.$inferSelect
export type NewAiWorldRanking = typeof aiWorldRankings.$inferInsert
