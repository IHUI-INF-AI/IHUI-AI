// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core'
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
 * - ownerUuid: **索引归属用户**(2026-10-03 数据出域合规整改新增)。
 *   加这列的起因:本表存用户代码明文 + 向量,而原先**没有任何归属列** ——
 *   repo_id 只是路径 hash(不是用户身份),读面 search()/hybridSearch() 的
 *   repoId 又是可选参数,不传即跨全部仓库检索。等于"甲的代码可被乙检索到"。
 *   归属隔离由应用层强制(v1-codebase-search.ts 每端点用 req.userId 过滤 +
 *   codebase-index-service 每个方法把 ownerUuid 列入 WHERE 谓词);
 *   **未**套 RLS 的原因见迁移 20261003020000 文件头(写入通道无 app.user_id
 *   会话变量,套 RLS 会静默 0 行 = 功能坏而不报错)。判据留档在那里。
 *   NULL = 存量无主行,已被迁移标记过期待清理。
 * - expiresAt: 过期时间(2026-10-03 新增)。NULL = 永不过期,仅限明确选择
 *   长期保留的索引;所有新写入都带默认 TTL,不再产生 NULL 行。
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
    /** 索引归属用户;NULL = 存量无主行(见上)。ON DELETE SET NULL,见迁移。 */
    ownerUuid: uuid('owner_uuid'),
    /** 过期时间;清理任务按此列回收。NULL = 永不过期(仅显式长期保留)。 */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    repoFileIdx: index('ix_codebase_chunks_repo_file').on(t.repoId, t.filePath),
    repoIdx: index('ix_codebase_chunks_repo').on(t.repoId),
    // 归属 + 仓库复合索引:应用层过滤恒为 (owner_uuid, repo_id[, expires_at]),
    // 单列索引会让每次检索退化成"扫该用户全部切片再过滤过期"。
    ownerRepoIdx: index('ix_codebase_chunks_owner_repo').on(t.ownerUuid, t.repoId),
    // 清理任务驱动索引:只扫已到期那一小撮,不扫全表。
    expiresAtIdx: index('ix_codebase_chunks_expires_at').on(t.expiresAt),
  }),
)

export type CodebaseChunk = typeof codebaseChunks.$inferSelect
export type CodebaseChunkInsert = typeof codebaseChunks.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
