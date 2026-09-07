// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

/**
 * Repo Wiki 文档表 (2026-09-07 新增)
 *
 * - repo_wiki_docs  仓库知识库文档(仓库总览 + 模块文档)
 *
 * 用于 Repo Wiki MVP:前端从用户工作区(浏览器 FileSystemDirectoryHandle)收集文件清单
 * 与关键文件内容 → 后端调 LLM 生成"仓库总览 + 模块文档"并落库 → 前端浏览生成的 Wiki。
 *
 * kind 字段区分文档粒度:
 * - 'overview'  仓库级总览(架构综述/技术栈/目录结构解读/模块关系),module_path 为 NULL
 * - 'module'    模块级文档(职责/关键文件解读/对外接口/风险点),module_path 存模块名
 *
 * user_id 可空:NULL 表示全局 wiki(如系统预生成的示例仓库),登录用户均可见。
 */
import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * Repo Wiki 文档表。
 *
 * - userId: 所属用户(NULL = 全局 wiki,所有登录用户可见)
 * - repoName: 仓库名(用户输入或文件夹名)
 * - kind: 文档类型('overview' | 'module')
 * - modulePath: 模块路径(kind='module' 时必填,如 'apps/api')
 * - title: 文档标题(展示用)
 * - content: LLM 生成的 markdown 正文
 * - model: 生成时使用的 LLM 模型名
 * - fileCount: 生成该文档时实际采样的文件数
 * - generatedAt: 生成时间(与 createdAt 语义区分:重新生成会产生新行)
 */
export const repoWikiDocs = pgTable(
  'repo_wiki_docs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id'),
    repoName: varchar('repo_name', { length: 200 }).notNull(),
    kind: varchar('kind', { length: 20 }).notNull().default('overview'),
    modulePath: varchar('module_path', { length: 500 }),
    title: varchar('title', { length: 300 }).notNull(),
    content: text('content').notNull(),
    model: varchar('model', { length: 128 }),
    fileCount: integer('file_count').notNull().default(0),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userRepoIdx: index('ix_repo_wiki_docs_user_repo').on(t.userId, t.repoName),
  }),
)

export type RepoWikiDoc = typeof repoWikiDocs.$inferSelect
export type RepoWikiDocInsert = typeof repoWikiDocs.$inferInsert
