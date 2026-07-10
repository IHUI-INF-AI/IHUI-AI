import { pgTable, bigserial, varchar, integer, text, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * 用户 Agent 免费次数/配额表（user_agent_free_times）。
 * - free_times: 总免费次数；used_times: 已用次数；remaining = free_times - used_times。
 */
export const userAgentFreeTimes = pgTable(
  'user_agent_free_times',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userUuid: varchar('user_uuid', { length: 64 }).notNull(),
    agentId: varchar('agent_id', { length: 64 }).notNull(),
    freeTimes: integer('free_times').default(0).notNull(),
    usedTimes: integer('used_times').default(0).notNull(),
    lastResetAt: timestamp('last_reset_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userUuidIdx: index('user_agent_free_times_user_uuid_idx').on(t.userUuid),
    agentIdIdx: index('user_agent_free_times_agent_id_idx').on(t.agentId),
  }),
);

/**
 * Agent 上下文 KV 存储表（zhs_user_agent_context）。
 * - context_key/context_value: 上下文键值对（兼容字段 content/content_type）。
 * - 兼容旧架构多用途列：session_id/role/tokens/field_name。
 */
export const zhsUserAgentContext = pgTable(
  'zhs_user_agent_context',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userUuid: varchar('user_uuid', { length: 64 }).notNull(),
    userId: varchar('user_id', { length: 64 }),
    agentId: varchar('agent_id', { length: 64 }).notNull(),
    sessionId: varchar('session_id', { length: 64 }),
    role: varchar('role', { length: 20 }),
    content: text('content'),
    contentType: varchar('content_type', { length: 20 }).default('text').notNull(),
    tokens: integer('tokens').default(0).notNull(),
    contextKey: varchar('context_key', { length: 200 }),
    contextValue: text('context_value'),
    fieldName: varchar('field_name', { length: 200 }),
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow().notNull(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userUuidIdx: index('zhs_user_agent_context_user_uuid_idx').on(t.userUuid),
    userIdIdx: index('zhs_user_agent_context_user_id_idx').on(t.userId),
    agentIdIdx: index('zhs_user_agent_context_agent_id_idx').on(t.agentId),
  }),
);

/**
 * Agent 音频记录表（zhs_user_agent_audio）。
 */
export const zhsUserAgentAudio = pgTable(
  'zhs_user_agent_audio',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userUuid: varchar('user_uuid', { length: 64 }).notNull(),
    agentId: varchar('agent_id', { length: 64 }).notNull(),
    audioUrl: varchar('audio_url', { length: 500 }),
    duration: integer('duration'),
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userUuidIdx: index('zhs_user_agent_audio_user_uuid_idx').on(t.userUuid),
    agentIdIdx: index('zhs_user_agent_audio_agent_id_idx').on(t.agentId),
  }),
);

/**
 * Agent 图像记录表（zhs_user_agent_image）。
 * - image_type: input=输入图, output=生成图。
 */
export const zhsUserAgentImage = pgTable(
  'zhs_user_agent_image',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userUuid: varchar('user_uuid', { length: 64 }).notNull(),
    userId: varchar('user_id', { length: 64 }),
    userName: varchar('user_name', { length: 100 }),
    agentId: varchar('agent_id', { length: 64 }),
    agentName: varchar('agent_name', { length: 200 }),
    imageUrl: varchar('image_url', { length: 500 }).notNull(),
    imageType: varchar('image_type', { length: 20 }).default('input').notNull(),
    prompt: text('prompt'),
    model: varchar('model', { length: 50 }),
    taskId: varchar('task_id', { length: 100 }),
    status: integer('status').default(1).notNull(),
    cost: integer('cost').default(0).notNull(),
    width: integer('width'),
    height: integer('height'),
    size: integer('size'),
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userUuidIdx: index('zhs_user_agent_image_user_uuid_idx').on(t.userUuid),
    userIdIdx: index('zhs_user_agent_image_user_id_idx').on(t.userId),
    agentIdIdx: index('zhs_user_agent_image_agent_id_idx').on(t.agentId),
  }),
);

export type UserAgentFreeTime = typeof userAgentFreeTimes.$inferSelect;
export type NewUserAgentFreeTime = typeof userAgentFreeTimes.$inferInsert;
export type ZhsUserAgentContext = typeof zhsUserAgentContext.$inferSelect;
export type NewZhsUserAgentContext = typeof zhsUserAgentContext.$inferInsert;
export type ZhsUserAgentAudio = typeof zhsUserAgentAudio.$inferSelect;
export type NewZhsUserAgentAudio = typeof zhsUserAgentAudio.$inferInsert;
export type ZhsUserAgentImage = typeof zhsUserAgentImage.$inferSelect;
export type NewZhsUserAgentImage = typeof zhsUserAgentImage.$inferInsert;
