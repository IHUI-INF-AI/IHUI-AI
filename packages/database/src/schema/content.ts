import { pgTable, uuid, varchar, integer, text, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 公告表。
 * type: 'info' | 'warning' | 'maintenance' | 'update'。
 * is_pinned: 置顶（列表置顶在前）。
 * is_published: 是否发布（公开列表只返回已发布）。
 * published_at: 发布时间（列表按此倒序）；expires_at 过期时间（过期则不展示）。
 */
export const announcements = pgTable('announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  type: varchar('type', { length: 32 }).default('info').notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  isPublished: boolean('is_published').default(false).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 帮助文章表。
 * category: 'account' | 'payment' | 'project' | 'ai' | 'tech' | 'other'。
 * slug: 唯一标识，用于公开查询。
 * content: markdown 文本，前端渲染。
 */
export const helpArticles = pgTable('help_articles', {
  id: uuid('id').defaultRandom().primaryKey(),
  category: varchar('category', { length: 32 }).default('other').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  content: text('content').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  viewCount: integer('view_count').default(0).notNull(),
  isPublished: boolean('is_published').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 帮助分类表。
 * slug: 唯一标识。
 */
export const helpCategories = pgTable('help_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 64 }).notNull().unique(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  description: text('description'),
  icon: varchar('icon', { length: 64 }),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 文档表。
 * category: 'api' | 'guide' | 'development' | 'faq'。
 * status: 'draft' | 'published'。
 * content: markdown 文本，前端渲染。
 */
export const docs = pgTable('docs', {
  id: uuid('id').defaultRandom().primaryKey(),
  category: varchar('category', { length: 32 }).default('guide').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  content: text('content').notNull(),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 16 }).default('draft').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  viewCount: integer('view_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 公告已读记录表。
 * 记录用户已读的公告，用于未读红点持久化。
 * (userId, announcementId) 唯一约束，避免重复记录。
 */
export const announcementReads = pgTable(
  'announcement_reads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    announcementId: uuid('announcement_id')
      .notNull()
      .references(() => announcements.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniq: unique().on(t.userId, t.announcementId),
  }),
);

export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
export type AnnouncementRead = typeof announcementReads.$inferSelect;
export type NewAnnouncementRead = typeof announcementReads.$inferInsert;
export type HelpArticle = typeof helpArticles.$inferSelect;
export type NewHelpArticle = typeof helpArticles.$inferInsert;
export type HelpCategory = typeof helpCategories.$inferSelect;
export type NewHelpCategory = typeof helpCategories.$inferInsert;
export type Doc = typeof docs.$inferSelect;
export type NewDoc = typeof docs.$inferInsert;
