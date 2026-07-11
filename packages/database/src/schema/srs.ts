import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core'

/**
 * SRS 直播流管理表 (迁移自旧架构 services/srs_manager.py)。
 * streamKey: 推流唯一标识。pushUrl/playUrl: SRS 生成的推/拉流地址。
 * status: active(推流中)/inactive(空闲)/banned(禁用)。
 */
export const srsStreams = pgTable(
  'srs_streams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    streamKey: varchar('stream_key', { length: 128 }).notNull().unique(),
    channelId: uuid('channel_id'),
    title: varchar('title', { length: 200 }).notNull(),
    pushUrl: varchar('push_url', { length: 500 }),
    playUrl: varchar('play_url', { length: 500 }),
    webrtcUrl: varchar('webrtc_url', { length: 500 }),
    hlsUrl: varchar('hls_url', { length: 500 }),
    flvUrl: varchar('flv_url', { length: 500 }),
    status: varchar('status', { length: 20 }).default('inactive').notNull(),
    publisherIp: varchar('publisher_ip', { length: 45 }),
    clientId: varchar('client_id', { length: 128 }),
    videoCodec: varchar('video_codec', { length: 32 }),
    audioCodec: varchar('audio_codec', { length: 32 }),
    videoBitrate: integer('video_bitrate'),
    audioBitrate: integer('audio_bitrate'),
    videoWidth: integer('video_width'),
    videoHeight: integer('video_height'),
    videoFps: integer('video_fps'),
    startTime: timestamp('start_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    duration: integer('duration').default(0),
    recvBytes: integer('recv_bytes').default(0),
    sendBytes: integer('send_bytes').default(0),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    streamKeyIdx: index('srs_streams_key_idx').on(t.streamKey),
    channelIdx: index('srs_streams_channel_idx').on(t.channelId),
    statusIdx: index('srs_streams_status_idx').on(t.status),
  }),
)

/**
 * SRS 服务器配置表。
 * 管理多个 SRS 实例（主备/负载均衡）。
 */
export const srsServers = pgTable(
  'srs_servers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    host: varchar('host', { length: 255 }).notNull(),
    rtmpPort: integer('rtmp_port').default(1935).notNull(),
    httpPort: integer('http_port').default(8080).notNull(),
    webrtcPort: integer('webrtc_port').default(1985).notNull(),
    apiPort: integer('api_port').default(1985).notNull(),
    apiSecret: varchar('api_secret', { length: 256 }),
    maxStreams: integer('max_streams').default(100).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    healthCheckUrl: varchar('health_check_url', { length: 500 }),
    lastHealthCheck: timestamp('last_health_check', { withTimezone: true }),
    status: varchar('status', { length: 20 }).default('online').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    activeIdx: index('srs_servers_active_idx').on(t.isActive),
  }),
)

export type SrsStream = typeof srsStreams.$inferSelect
export type NewSrsStream = typeof srsStreams.$inferInsert
export type SrsServer = typeof srsServers.$inferSelect
export type NewSrsServer = typeof srsServers.$inferInsert
