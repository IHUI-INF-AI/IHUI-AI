import { pgTable, uuid, varchar, text, integer, timestamp, index, jsonb } from 'drizzle-orm/pg-core'

/**
 * 远程设备表 (等价自旧架构 Java RemoteDeviceByTaskController)。
 * 管理远程 IoT 设备的注册、状态和任务分配。
 * deviceNo: 设备唯一编号。status: online/offline/maintenance。
 */
export const remoteDevices = pgTable(
  'remote_devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deviceNo: varchar('device_no', { length: 100 }).notNull().unique(),
    deviceName: varchar('device_name', { length: 200 }),
    deviceType: varchar('device_type', { length: 50 }),
    model: varchar('model', { length: 100 }),
    manufacturer: varchar('manufacturer', { length: 100 }),
    firmwareVersion: varchar('firmware_version', { length: 50 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    macAddress: varchar('mac_address', { length: 17 }),
    location: varchar('location', { length: 255 }),
    longitude: varchar('longitude', { length: 20 }),
    latitude: varchar('latitude', { length: 20 }),
    status: varchar('status', { length: 20 }).default('offline').notNull(),
    batteryLevel: integer('battery_level'),
    signalStrength: integer('signal_strength'),
    userId: uuid('user_id'),
    lastOnlineAt: timestamp('last_online_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    deviceNoIdx: index('remote_devices_no_idx').on(t.deviceNo),
    statusIdx: index('remote_devices_status_idx').on(t.status),
    userIdx: index('remote_devices_user_idx').on(t.userId),
  }),
)

/**
 * 远程设备任务表。
 * 管理下发给远程设备的任务（固件升级、配置更新、重启等）。
 * status: pending(待下发)/dispatched(已下发)/executing(执行中)/completed(完成)/failed(失败)。
 */
export const remoteDeviceTasks = pgTable(
  'remote_device_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deviceId: uuid('device_id')
      .references(() => remoteDevices.id, { onDelete: 'cascade' })
      .notNull(),
    taskType: varchar('task_type', { length: 50 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    payload: jsonb('payload'),
    priority: integer('priority').default(0).notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    result: jsonb('result'),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0).notNull(),
    maxRetries: integer('max_retries').default(3).notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    deviceIdx: index('remote_device_tasks_device_idx').on(t.deviceId),
    statusIdx: index('remote_device_tasks_status_idx').on(t.status),
    typeIdx: index('remote_device_tasks_type_idx').on(t.taskType),
  }),
)

export type RemoteDevice = typeof remoteDevices.$inferSelect
export type NewRemoteDevice = typeof remoteDevices.$inferInsert
export type RemoteDeviceTask = typeof remoteDeviceTasks.$inferSelect
export type NewRemoteDeviceTask = typeof remoteDeviceTasks.$inferInsert
