import { pgTable, uuid, varchar, integer, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

/**
 * TBox 设备表（tbox_device）。
 * - status: online(在线) / offline(离线) / sleep(休眠)。
 * - deviceType: 设备类型，默认 'tbox'。
 * - userId: 绑定用户（外部约定，非 DB 外键）。
 */
export const tboxDevice = pgTable(
  'tbox_device',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deviceNo: varchar('device_no', { length: 100 }).notNull().unique(),
    deviceName: varchar('device_name', { length: 200 }),
    deviceType: varchar('device_type', { length: 50 }).notNull().default('tbox'),
    userId: uuid('user_id'),
    status: varchar('status', { length: 50 }).notNull().default('offline'),
    signal: integer('signal'),
    battery: integer('battery'),
    latitude: varchar('latitude', { length: 50 }),
    longitude: varchar('longitude', { length: 50 }),
    firmwareVersion: varchar('firmware_version', { length: 100 }),
    lastOnlineAt: timestamp('last_online_at', { withTimezone: true }),
    registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    deviceNoIdx: index('ix_tbox_device_device_no').on(t.deviceNo),
    userIdx: index('ix_tbox_device_user_id').on(t.userId),
    statusIdx: index('ix_tbox_device_status').on(t.status),
  }),
)

/**
 * TBox 指令表（tbox_command）。
 * - command: reboot(重启) / lock(锁车) / unlock(解锁) / upgrade(升级)。
 * - status: pending(待发送) / sent(已发送) / ack(已确认) / failed(失败)。
 */
export const tboxCommand = pgTable(
  'tbox_command',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deviceId: uuid('device_id').notNull(),
    command: varchar('command', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    payload: jsonb('payload'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    ackedAt: timestamp('acked_at', { withTimezone: true }),
    result: text('result'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    deviceIdx: index('ix_tbox_command_device_id').on(t.deviceId),
    statusIdx: index('ix_tbox_command_status').on(t.status),
  }),
)

/**
 * TBox 智能体上下架回调表（tbox_agent_channel）。
 * - action: deploy(上架) / undeploy(下架)。
 * - status: pending(待处理) / success(成功) / failed(失败)。
 * - deviceId 关联 tboxDevice.deviceNo（外部约定，非 DB 外键）。
 */
export const tboxAgentChannel = pgTable(
  'tbox_agent_channel',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deviceId: varchar('device_id', { length: 64 }).notNull(),
    agentId: varchar('agent_id', { length: 100 }).notNull(),
    action: varchar('action', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    payload: jsonb('payload'),
    result: text('result'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    deviceIdIdx: index('ix_tbox_agent_channel_device_id').on(t.deviceId),
    agentIdIdx: index('ix_tbox_agent_channel_agent_id').on(t.agentId),
    statusIdx: index('ix_tbox_agent_channel_status').on(t.status),
  }),
)

export type TboxDevice = typeof tboxDevice.$inferSelect
export type NewTboxDevice = typeof tboxDevice.$inferInsert
export type TboxCommand = typeof tboxCommand.$inferSelect
export type NewTboxCommand = typeof tboxCommand.$inferInsert
export type TboxAgentChannel = typeof tboxAgentChannel.$inferSelect
export type NewTboxAgentChannel = typeof tboxAgentChannel.$inferInsert
