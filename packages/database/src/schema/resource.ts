import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  serial,
  jsonb,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

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
)

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
    categoryId: uuid('category_id').references(() => resourceCategories.id, {
      onDelete: 'set null',
    }),
    fileUrl: varchar('file_url', { length: 500 }),
    fileType: varchar('file_type', { length: 50 }),
    fileSize: integer('file_size').default(0).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    downloadCount: integer('download_count').default(0).notNull(),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    type: varchar('type', { length: 50 }),
    productId: uuid('product_id'),
    tagIdList: jsonb('tag_id_list').$type<string[]>(),
    image: varchar('image', { length: 500 }),
    introduction: text('introduction'),
    cidList: jsonb('cid_list').$type<string[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    catIdx: index('resources_category_idx').on(t.categoryId),
    pubIdx: index('resources_published_idx').on(t.isPublished),
    prodIdx: index('resources_product_idx').on(t.productId),
  }),
)

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
)

/**
 * 资源标签表 - 支持树形结构(pid 指向父标签)。
 */
export const resourceTags = pgTable(
  'resource_tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    pid: uuid('pid').references((): AnyPgColumn => resourceTags.id, { onDelete: 'set null' }), // 父标签
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pidIdx: index('resource_tags_pid_idx').on(t.pid),
  }),
)

export type ResourceCategory = typeof resourceCategories.$inferSelect
export type NewResourceCategory = typeof resourceCategories.$inferInsert
export type Resource = typeof resources.$inferSelect
export type NewResource = typeof resources.$inferInsert
export type ResourceProduct = typeof resourceProducts.$inferSelect
export type NewResourceProduct = typeof resourceProducts.$inferInsert
export type ResourceTag = typeof resourceTags.$inferSelect
export type NewResourceTag = typeof resourceTags.$inferInsert

/**
 * 资源-标签关联表 - 资源与标签的多对多关联。
 */
export const resourceTagRelations = pgTable('resource_tag_relations', {
  id: serial('id').primaryKey(),
  resourceId: uuid('resource_id')
    .references(() => resources.id, { onDelete: 'cascade' })
    .notNull(),
  tagId: uuid('tag_id')
    .references(() => resourceTags.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ResourceTagRelation = typeof resourceTagRelations.$inferSelect
export type NewResourceTagRelation = typeof resourceTagRelations.$inferInsert

/**
 * 资源下载记录表 - 记录用户下载资源的行为。
 * - resourceId: 关联 resources.id（UUID，逻辑关联未做物理外键）。
 * - userId: 关联 users.id（UUID，逻辑关联）。
 */
export const resourceDownloads = pgTable('resource_downloads', {
  id: serial('id').primaryKey(),
  resourceId: uuid('resource_id').notNull(),
  userId: uuid('user_id').notNull(),
  ip: varchar('ip', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

/**
 * 资源搜索记录表 - 记录用户的搜索行为用于分析。
 */
export const resourceSearchLogs = pgTable('resource_search_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  keyword: varchar('keyword', { length: 255 }),
  resultCount: integer('result_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ResourceDownload = typeof resourceDownloads.$inferSelect
export type NewResourceDownload = typeof resourceDownloads.$inferInsert
export type ResourceSearchLog = typeof resourceSearchLogs.$inferSelect
export type NewResourceSearchLog = typeof resourceSearchLogs.$inferInsert

/**
 * GitHub 开源项目库表（历史 resource_github_projects）。
 * - url: GitHub 仓库链接
 * - stars: Star 数
 * - category: 分类
 * - language: 主语言
 */
export const resourceGithubProjects = pgTable(
  'resource_github_projects',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    url: varchar('url', { length: 500 }).notNull(),
    stars: integer('stars'),
    category: varchar('category', { length: 100 }),
    description: text('description'),
    language: varchar('language', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index('resource_github_projects_category_idx').on(t.category),
  }),
)

export type ResourceGithubProject = typeof resourceGithubProjects.$inferSelect
export type NewResourceGithubProject = typeof resourceGithubProjects.$inferInsert
