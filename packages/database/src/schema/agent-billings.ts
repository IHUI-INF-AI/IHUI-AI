import { pgTable, varchar, integer, bigint, numeric, jsonb, timestamp, index, unique } from 'drizzle-orm/pg-core';

/**
 * 智能体计费表 (agent_billings)。
 * 迁移自 D 盘 coze_zhs_py/models/agent_models.py:179-239 AgentBilling。
 * 接收 Coze 平台账单回调 (event_id/record_id) 与计费 (change_balance/balance_type)，
 * 关联资源 (resource_type/model_id) 与计量 (input/output token, TTS char, ASR audio)。
 *
 * 核心字段:
 * - billing_id / event_id / record_id: 主键 + 事件幂等 (event_id 唯一)
 * - consume_time / consume_datetime / created_at_coze: Coze 端时间戳
 * - change_balance / balance_type: 余额变化与扣费类型
 * - model_input_token / model_output_token: 模型 token 计量
 * - tts_char_num / tts_count / asr_audio_length: 多模态计量
 * - rtc_begin_time / rtc_end_time / rtc_duration: 实时通话计量
 * - raw_callback_data: 原始 Coze 回调 JSON（用于审计/重放）
 */
export const agentBillings = pgTable(
  'agent_billings',
  {
    // 主键
    billingId: varchar('billing_id', { length: 64 }).primaryKey(),
    // 基本标识信息
    eventId: varchar('event_id', { length: 128 }).notNull(),
    recordId: varchar('record_id', { length: 64 }).notNull(),
    // 时间信息
    consumeTime: bigint('consume_time', { mode: 'number' }).notNull(),
    consumeDatetime: timestamp('consume_datetime', { withTimezone: true }),
    createdAtCoze: varchar('created_at_coze', { length: 20 }),
    // 关联信息
    recordRootId: varchar('record_root_id', { length: 64 }),
    connectorId: varchar('connector_id', { length: 64 }),
    connectorUid: varchar('connector_uid', { length: 64 }),
    deviceId: varchar('device_id', { length: 64 }),
    customConsumer: varchar('custom_consumer', { length: 255 }),
    spaceId: varchar('space_id', { length: 64 }),
    rootEntityId: varchar('root_entity_id', { length: 64 }),
    rootEntityType: integer('root_entity_type'),
    // 费用信息
    changeBalance: numeric('change_balance', { precision: 10, scale: 6 }).notNull(),
    balanceType: integer('balance_type'),
    costAccountId: varchar('cost_account_id', { length: 64 }),
    // 资源信息
    resourceType: integer('resource_type'),
    resourceId: varchar('resource_id', { length: 64 }),
    modelId: varchar('model_id', { length: 64 }),
    // Token 统计
    modelInputToken: integer('model_input_token').default(0).notNull(),
    modelOutputToken: integer('model_output_token').default(0).notNull(),
    // RTC 实时通话相关
    rtcBeginTime: integer('rtc_begin_time').default(0).notNull(),
    rtcEndTime: integer('rtc_end_time').default(0).notNull(),
    rtcDuration: integer('rtc_duration').default(0).notNull(),
    // TTS 语音合成相关
    ttsCharNum: integer('tts_char_num').default(0).notNull(),
    ttsCount: integer('tts_count').default(0).notNull(),
    // ASR 语音识别相关
    asrAudioLength: integer('asr_audio_length').default(0).notNull(),
    // 状态信息
    billingStatus: varchar('billing_status', { length: 20 }).default('recorded').notNull(),
    // 原始数据（审计/重放）
    rawCallbackData: jsonb('raw_callback_data'),
    // 系统时间
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // 事件幂等: 同一 event_id 不可重复入账
    eventUniq: unique('agent_billings_event_uniq').on(t.eventId),
    recordIdx: index('agent_billings_record_idx').on(t.recordId),
    consumeTimeIdx: index('agent_billings_consume_time_idx').on(t.consumeTime),
    modelIdx: index('agent_billings_model_idx').on(t.modelId),
    statusIdx: index('agent_billings_status_idx').on(t.billingStatus),
  }),
);

export type AgentBilling = typeof agentBillings.$inferSelect;
export type NewAgentBilling = typeof agentBillings.$inferInsert;
