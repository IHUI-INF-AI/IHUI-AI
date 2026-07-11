import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'

// 轮播图表 - 首页/活动页轮播图管理
export const carousels = pgTable(
  'carousels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    position: varchar('position', { length: 64 }).notNull(), // home/activities/learn/live等展示位置
    title: varchar('title', { length: 255 }),
    imageUrl: varchar('image_url', { length: 512 }).notNull(),
    linkUrl: varchar('link_url', { length: 512 }), // 点击跳转链接
    description: text('description'),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(), // 1-显示 0-隐藏
    startAt: timestamp('start_at', { withTimezone: true }),
    endAt: timestamp('end_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    positionIdx: index('carousels_position_idx').on(t.position),
    statusIdx: index('carousels_status_idx').on(t.status),
  }),
)

export type Carousel = typeof carousels.$inferSelect
export type NewCarousel = typeof carousels.$inferInsert
