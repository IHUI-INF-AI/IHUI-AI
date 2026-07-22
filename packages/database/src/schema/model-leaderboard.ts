import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  real,
  boolean,
  date,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * 大模型排行榜 (model_leaderboard)。
 * 参考 arena.ai/leaderboard,Elo 评分 + 排名 + 核心参数 + 能力雷达。
 * category: llm(大语言) / image(生图) / video(视频) / multimodal(多模态) / audio(语音) / embedding(嵌入) / agent(智能体)。
 * subcategory: LLM 内细分 general(通用) / coding(代码) / reasoning(推理) / agent(智能体),其他类为 null。
 * arenaScore: Elo 评分(参考 arena.ai,Text 类约 1000-1510)。
 * arenaRank: 当前排名(1=第一)。
 * rankDelta: 排名变化(正数=上升,负数=下降,0=不变,null=新入榜)。
 * rankSpreadLow/High: Bootstrap 排名区间(如 2-11 表示 95% 概率排名 2-11)。
 * winRate: 胜率百分比(0-100)。
 * voteCount: 投票/会话总数。
 * capabilities: JSON,5 维能力评分(0-100),coding/math/reasoning/creative/chinese。
 */
export const modelLeaderboard = pgTable(
  'model_leaderboard',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    modelId: varchar('model_id', { length: 128 }).notNull(),
    modelName: varchar('model_name', { length: 128 }).notNull(),
    vendor: varchar('vendor', { length: 64 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
    subcategory: varchar('subcategory', { length: 32 }),
    arenaScore: integer('arena_score'),
    arenaRank: integer('arena_rank'),
    rankDelta: integer('rank_delta'),
    rankSpreadLow: integer('rank_spread_low'),
    rankSpreadHigh: integer('rank_spread_high'),
    scoreCi: integer('score_ci'),
    winRate: real('win_rate'),
    voteCount: integer('vote_count'),
    contextWindow: varchar('context_window', { length: 32 }),
    maxOutput: varchar('max_output', { length: 32 }),
    inputPrice: varchar('input_price', { length: 64 }),
    outputPrice: varchar('output_price', { length: 64 }),
    releaseDate: date('release_date'),
    highlight: varchar('highlight', { length: 500 }),
    capabilities: text('capabilities'),
    license: varchar('license', { length: 32 }).default('Proprietary').notNull(),
    isOverall: boolean('is_overall').default(false).notNull(),
    sortOrder: integer('sort_order').default(100).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    modelUniq: unique('uq_model_leaderboard_model').on(t.modelId, t.category),
    categoryIdx: index('ix_model_leaderboard_category').on(t.category, t.subcategory),
    rankIdx: index('ix_model_leaderboard_rank').on(t.category, t.arenaRank),
    overallIdx: index('ix_model_leaderboard_overall').on(t.isOverall, t.arenaRank),
  }),
)
