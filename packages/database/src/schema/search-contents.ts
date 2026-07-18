import { pgTable, uuid, varchar, text, integer, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * D 盘 ihui-ai-edu-search-service 跨服务内容索引表 (search_contents)
 * 迁移自 D:\历史项目存档\ljd-交接文件\service_2\ihui-ai-edu-content-service\biz\aspect\search\bean\Content.java
 * 用途: cloud-learning-search-service 跨 article / news / question / resource 4 服务统一搜索
 * 字段: topicId + topicType (article/news/question/resource/lesson) + topicTitle + 全文 + 索引
 */

/** 5 类主题枚举 (D 盘 Content.java + TopicType.java) */
export const searchContentTopicTypeEnum = pgEnum('search_content_topic_type', [
  'article',
  'news',
  'question',
  'resource',
  'lesson',
]);

export const searchContents = pgTable(
  'search_contents',
  {
    id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
    /** 来源服务原始 ID (article.id / news.id / question.id / resource.id / lesson.id) */
    topicId: uuid('topic_id').notNull(),
    topicType: searchContentTopicTypeEnum('topic_type').notNull(),
    /** 冗余标题(用于搜索结果展示,避免跨服务 JOIN) */
    topicTitle: varchar('topic_title', { length: 300 }).notNull(),
    /** 摘要/简介(可选,搜索结果可展示) */
    topicSummary: text('topic_summary'),
    /** 全文搜索关键词(tags + keywords + introduction 拼接) */
    searchText: text('search_text').notNull(),
    /** 来源服务作者 ID(冗余) */
    authorId: uuid('author_id'),
    /** 浏览量(冗余,跨服务聚合) */
    viewCount: integer('view_count').default(0).notNull(),
    /** 点赞量(冗余) */
    likeCount: integer('like_count').default(0).notNull(),
    /** 评论量(冗余) */
    commentCount: integer('comment_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    topicIdx: index('search_contents_topic_idx').on(t.topicType, t.topicId),
    typeIdx: index('search_contents_type_idx').on(t.topicType),
    authorIdx: index('search_contents_author_idx').on(t.authorId),
    createdIdx: index('search_contents_created_idx').on(t.createdAt),
    /** PG 全文搜索 GIN 索引(后续可加 to_tsvector('simple', search_text) 触发器) */
    // ginIdx: index('search_contents_search_text_gin').using('gin', sql`to_tsvector('simple', ${t.searchText})`),
  }),
);

export type SearchContent = typeof searchContents.$inferSelect;
export type NewSearchContent = typeof searchContents.$inferInsert;
