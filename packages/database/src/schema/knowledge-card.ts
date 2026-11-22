// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * Knowledge Card 知识卡片表 (2026-09-10 新增,2-1 项目知识引擎)
 *
 * - knowledge_cards  仓库级知识卡片(任务经验/领域事实/最佳实践/踩坑记录)
 *
 * 用于 2-1 项目知识引擎的"Knowledge Card + 任务经验沉淀":
 * Agent 执行任务(或用户手动)后,把可复用的经验提炼为结构化卡片落库,
 * 后续同仓库任务可检索注入(knowledge_lookup / 系统提示)形成经验复用闭环。
 *
 * 与既有基础设施的关系:
 * - agent_meta_lessons:技能进化元知识(lessonType/系统提示片段),跨仓库;
 * - knowledge_cards:仓库级任务经验卡(repoName 绑定),来源标注(kind/source)。
 *
 * user_id 可空:NULL 表示全局卡片(登录用户均可见),与 repo_wiki_docs 口径一致。
 */
import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * Knowledge Card 知识卡片表。
 *
 * - userId: 所属用户(NULL = 全局卡片,所有登录用户可见)
 * - repoName: 仓库名(经验绑定的仓库,如 'IHUI-AI')
 * - kind: 卡片类型('experience' 任务经验 | 'fact' 领域事实 | 'practices' 最佳实践 | 'pitfall' 踩坑记录)
 * - source: 来源('agent' Agent 任务沉淀 | 'manual' 用户手动录入)
 * - title: 卡片标题(一句话概括)
 * - content: 卡片正文(markdown,LLM 提炼或用户输入)
 * - tags: 标签数组(检索辅助,如 ['deploy','windows'])
 * - context: 结构化上下文(任务输入摘要/相关文件/验证方式,JSON 自由结构)
 * - confidence: 置信度 0-100(agent 沉淀由 LLM 自评,手动录入默认 100)
 * - useCount / lastUsedAt: 复用统计(被检索命中并注入次数,评估卡片价值)
 * - createdAt / updatedAt: 时间戳
 */
export const knowledgeCards = pgTable(
  'knowledge_cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id'),
    repoName: varchar('repo_name', { length: 200 }).notNull(),
    kind: varchar('kind', { length: 20 }).notNull().default('experience'),
    source: varchar('source', { length: 20 }).notNull().default('manual'),
    title: varchar('title', { length: 300 }).notNull(),
    content: text('content').notNull(),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    context: jsonb('context').$type<Record<string, unknown>>(),
    confidence: integer('confidence').notNull().default(100),
    useCount: integer('use_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userRepoIdx: index('ix_knowledge_cards_user_repo').on(t.userId, t.repoName),
    repoKindIdx: index('ix_knowledge_cards_repo_kind').on(t.repoName, t.kind),
  }),
)

export type KnowledgeCard = typeof knowledgeCards.$inferSelect
export type KnowledgeCardInsert = typeof knowledgeCards.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
