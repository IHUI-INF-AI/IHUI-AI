// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 代码库语义索引表 (2026-07-22 新增)
 *
 * - codebase_chunks  代码片段(含 pgvector 1536 维向量,HNSW 索引)
 * - codebase_entities / codebase_edges  符号实体与关系边(2026-11-23,P0-8 第二批)
 * - codebase_index_states  索引配置指纹与幂等标记(同一口径同上)
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
  varchar,
  integer,
  timestamp,
  index,
  uniqueIndex,
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
    /**
     * 本行向量来源通道(G7,2026-10-31):'remote' = 在线 provider;
     * 'local-hash' = 离线/远端不可用时的本地确定性回落(无神经语义精度,
     * 必须可识别不冒充在线质量);NULL = 存量行(迁移 20261031120000 前,不回填)。
     */
    embeddingProvider: varchar('embedding_provider', { length: 32 }),
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

/**
 * 代码实体表(2026-11-23,P0-8 第二批):符号级实体,与切片解耦。
 *
 * 为什么另立一张表而不塞进 `codebase_chunks`:切片是**检索单位**(可重叠、可固定行数切),
 * 实体是**语义单位**(一个函数只应有一个身份,不能因为跨切片出现两次就有两条记录)。
 * 取证件(TRAE CKG)的实体/关系边表正是这一层。
 *
 * - ownerUuid 可空 = 存量/未归属行(与 codebase_chunks 同纪律);新写入必须带主体(服务层强制)。
 * - kind: function / class / method / interface / type / module(与 symbolType 同词表,但不复用列名)。
 * - signature 可空:解析器给不出签名时**不编造**,留空。
 */
export const codebaseEntities = pgTable(
  'codebase_entities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUuid: uuid('owner_uuid'),
    repoId: text('repo_id').notNull(),
    filePath: text('file_path').notNull(),
    lineStart: integer('line_start').notNull(),
    lineEnd: integer('line_end').notNull(),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    signature: text('signature'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerRepoIdx: index('ix_codebase_entities_owner_repo').on(t.ownerUuid, t.repoId),
    repoNameIdx: index('ix_codebase_entities_repo_name').on(t.repoId, t.name),
    repoFileIdx: index('ix_codebase_entities_repo_file').on(t.repoId, t.filePath),
  }),
)

/**
 * 代码关系边表(2026-11-23,P0-8 第二批):引用 / 调用 / 继承等有向边。
 *
 * - `fromEntityId` **可空**:目标实体解析不到时也不丢边(留 `toName` 原文);
 *   把解析失败硬塞成自环或丢弃边,都会让"调用图"无声失真。
 * - `fromName` / `toName` 都存原文:解析前即可按名查(repo+name 索引),不依赖 join。
 * - kind: reference / call / import / extends / implements。
 */
export const codebaseEdges = pgTable(
  'codebase_edges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUuid: uuid('owner_uuid'),
    repoId: text('repo_id').notNull(),
    fromEntityId: uuid('from_entity_id'),
    fromName: text('from_name').notNull(),
    toName: text('to_name').notNull(),
    kind: text('kind').notNull(),
    filePath: text('file_path').notNull(),
    line: integer('line').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerRepoIdx: index('ix_codebase_edges_owner_repo').on(t.ownerUuid, t.repoId),
    repoToIdx: index('ix_codebase_edges_repo_to').on(t.repoId, t.toName),
    repoFromIdx: index('ix_codebase_edges_repo_from').on(t.repoId, t.fromName),
  }),
)

/**
 * 索引状态 / 幂等标记表(2026-11-23,P0-8 第二批)。
 *
 * 要回答的问题:同一 (归属, 仓库) 上次是用**什么配置**建的、建了多少切片、什么时候建的。
 * 没有这张表,"是否要重建"只能靠调用方猜,或者每次都全量重建(把 embedding 成本翻倍)。
 *
 * - `configFingerprint`:嵌入维度 / provider 通道 / 切块参数的最小指纹;变了即必须重建。
 * - 唯一键 `(owner_uuid, repo_id)`:幂等标记按它 upsert,一次仓库只留一行状态。
 *   `ownerUuid` **NOT NULL**:状态行的主体身份就是幂等键的一半,不允许无主。
 * - `lastRunId`:一次索引运行的标识(可空,不参与判定,只用于人对照日志)。
 */
export const codebaseIndexStates = pgTable(
  'codebase_index_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUuid: uuid('owner_uuid').notNull(),
    repoId: text('repo_id').notNull(),
    configFingerprint: text('config_fingerprint').notNull(),
    lastRunId: text('last_run_id'),
    chunkCount: integer('chunk_count').notNull().default(0),
    lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerRepoUniqueIdx: uniqueIndex('ux_codebase_index_states_owner_repo').on(
      t.ownerUuid,
      t.repoId,
    ),
  }),
)

export type CodebaseEntity = typeof codebaseEntities.$inferSelect
export type CodebaseEntityInsert = typeof codebaseEntities.$inferInsert
export type CodebaseEdge = typeof codebaseEdges.$inferSelect
export type CodebaseEdgeInsert = typeof codebaseEdges.$inferInsert
export type CodebaseIndexStateRow = typeof codebaseIndexStates.$inferSelect
export type CodebaseIndexStateInsert = typeof codebaseIndexStates.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
