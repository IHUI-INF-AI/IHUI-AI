import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  index,
} from 'drizzle-orm/pg-core';

/**
 * 资源分类表 - 树形结构(pid 指向父分类)。
 */
export const resourceCategories = pgTable(
  'resource_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    pid: uuid('pid'), // 父分类(0/NULL 表示根)
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(), // 1=启用 0=禁用
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pidIdx: index('resource_categories_pid_idx').on(t.pid),
  }),
);

/**
 * 资源表 - 支持发布/浏览量/下载量统计。
 */
export const resources = pgTable(
  'resources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    coverImage: varchar('cover_image', { length: 500 }),
    intro: text('intro'),
    categoryId: uuid('category_id').references(() => resourceCategories.id, { onDelete: 'set null' }),
    fileUrl: varchar('file_url', { length: 500 }),
    fileType: varchar('file_type', { length: 50 }),
    fileSize: integer('file_size').default(0).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    downloadCount: integer('download_count').default(0).notNull(),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('resources_category_idx').on(t.categoryId),
    pubIdx: index('resources_published_idx').on(t.isPublished),
  }),
);

/**
 * 资源产品表 - 资源可关联多个付费产品。
 */
export const resourceProducts = pgTable(
  'resource_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).default('0').notNull(),
    originalPrice: numeric('original_price', { precision: 10, scale: 2 }),
    description: text('description'),
    isPublished: boolean('is_published').default(false).notNull(),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    resIdx: index('resource_products_resource_idx').on(t.resourceId),
  }),
);

/**
 * 资源标签表。
 */
export const resourceTags = pgTable('resource_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  sort: integer('sort').default(0).notNull(),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ResourceCategory = typeof resourceCategories.$inferSelect;
export type NewResourceCategory = typeof resourceCategories.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
export type ResourceProduct = typeof resourceProducts.$inferSelect;
export type NewResourceProduct = typeof resourceProducts.$inferInsert;
export type ResourceTag = typeof resourceTags.$inferSelect;
export type NewResourceTag = typeof resourceTags.$inferInsert;
