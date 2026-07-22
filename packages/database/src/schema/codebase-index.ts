/**
 * 代码库语义索引表 (2026-07-22 新增)
 *
 * - codebase_chunks  代码片段(含 pgvector 1536 维向量,HNSW 索引)
 *
 * 用于 AI 自然语言代码搜索:tree-sitter AST 切片 → embedding → pgvector ANN 检索。
 * 与 knowledge-rag 的区别:知识库存文档,本表存代码符号(function/class/method/module 级切片)。
 *
 * 复用 knowledge-rag.ts 的 vector1536 customType + HNSW 索引模式。
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { vector1536 } from './knowledge-rag.js'

/**
 * 代码库切片表。
 *
 * - repoId: 仓库标识(git remote URL hash 或 workspace path hash)
 * - filePath: 文件相对路径(如 apps/api/src/server.ts)
 * - lineStart/lineEnd: 切片在文件中的行号范围(1-based)
 * - content: 代码片段原文
 * - embedding: pgvector 1536 维向量(NULL 时无法参与语义检索)
 * - language: 编程语言(ts/tsx/py/js/go/rs 等)
 * - symbolName: 符号名(函数名/类名,固定行数切片时为 null)
 * - symbolType: 符号类型(function/class/method/interface/type/module/fixed)
 */
export const codebaseChunks = pgTable(
  'codebase_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    repoId: text('repo_id').notNull(),
    filePath: text('file_path').notNull(),
    lineStart: integer('line_start').notNull(),
    lineEnd: integer('line_end').notNull(),
    content: text('content').notNull(),
    /** pgvector 1536 维向量;NULL 时降级为关键词检索 */
    embedding: vector1536('embedding'),
    language: text('language'),
    symbolName: text('symbol_name'),
    symbolType: text('symbol_type'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    repoFileIdx: index('ix_codebase_chunks_repo_file').on(t.repoId, t.filePath),
    repoIdx: index('ix_codebase_chunks_repo').on(t.repoId),
  }),
)

export type CodebaseChunk = typeof codebaseChunks.$inferSelect
export type CodebaseChunkInsert = typeof codebaseChunks.$inferInsert
