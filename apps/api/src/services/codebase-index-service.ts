// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 代码库语义索引服务。
 *
 * 提供:
 * - indexChunks:   批量写入代码切片(含 embedding)→ 增量更新(先删旧后插新)
 * - search:        语义检索(query embedding → pgvector ANN → top-K)
 * - deleteByRepo:  按仓库删除所有切片
 * - deleteByFile:  按仓库+文件删除切片(增量更新前清理)
 * - getStats:      索引统计(切片数 / 文件数 / 已向量化数)
 *
 * 与 knowledge-rag-service 的区别:
 * - 知识库存文档(按字符数切片),本服务存代码(按 AST 符号切片)
 * - 知识库按 owner_uuid 隔离,本服务按 **owner_uuid + repo_id** 双重隔离
 *   (2026-10-03 数据出域合规整改:此前只有 repo_id,而它只是路径 hash 不是用户
 *    身份,且检索时 repoId 可选 ⇒ 跨用户可检索。见本文件 _ownerScope 注释)
 * - embedding 生成委托给 ai-service 的 codebase_indexer(Python tree-sitter),
 *   本服务只负责存储 + 检索(embedding 由调用方传入)
 *
 * 环境变量(通过 embedding-provider.ts 间接使用):
 * - DASHSCOPE_API_KEY / OPENAI_API_KEY / MINIMAX_API_KEY
 */

import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { codebaseChunks, codebaseEntities, codebaseIndexStates } from '@ihui/database'
import { getEmbeddingProvider } from './embedding-provider.js'
import { logger } from '../utils/logger.js'

export interface ChunkInput {
  filePath: string
  lineStart: number
  lineEnd: number
  content: string
  language?: string
  symbolName?: string
  symbolType?: string
  embedding?: number[] | null
  /** G7:向量来源标注;'remote' | 'local-hash';缺省按向量有无回落判定 */
  embeddingProvider?: string
}

/**
 * 索引配置指纹默认值(P0-8 第二批,2026-11-23)。 *
 * 语义:嵌入维度 / 切块策略 / 词表版本三者一起变才算"配置变了"。只在真正改动其中之一时
 * 才改这个常量(或经 `CODE_INDEX_CONFIG_FINGERPRINT` 显式覆盖);
 * 拿机器路径、时间戳之类会抖动的东西做指纹,会让每次调用都判"配置变了"。
 */
export const CODE_INDEX_CONFIG_FINGERPRINT_DEFAULT = 'v1536:tree-sitter-chunk-v1'

/** 指纹取值:显式覆盖优先,空/未设回落默认(不读 vcs 版本,不读机器信息)。 */
export function resolveIndexConfigFingerprint(env: NodeJS.ProcessEnv = process.env): string {
  const override = (env.CODE_INDEX_CONFIG_FINGERPRINT ?? '').trim()
  return override || CODE_INDEX_CONFIG_FINGERPRINT_DEFAULT
}

/** 实体草稿(派生结果,未落库):P0-8 第三批,把切片自带的符号身份聚合成实体行。 */
export interface EntityDraft {
  filePath: string
  lineStart: number
  lineEnd: number
  kind: string
  name: string
}

/**
 * 纯函数:从切片派生实体(P0-8 第三批)。
 *
 * 为什么从切片派生而不另做解析:切片本身已带 `symbolName` / `symbolType`
 * (由 ai-service 的 tree-sitter 切片器给出),再跑一遍符号解析就是第二份判据(§0.6)。
 * 同一符号跨多个切片出现 ⇒ 合并成**一行**(行区间取 min..max),一个符号一条身份,
 * 不因跨切片出现两次而在图里变成两个节点。
 *
 * 纪律:
 * - 无 `symbolName` 的切片(纯行号切片的文件)不产出实体 —— 不拿文件名冒充符号;
 * - `kind` 取 `symbolType`,缺省 `'symbol'`(不猜具体种类);
 * - 输出按 `(filePath, lineStart, name)` 稳定排序,便于对账逐行比对。
 */
export function deriveEntitiesFromChunks(chunks: readonly ChunkInput[]): EntityDraft[] {
  const merged = new Map<string, EntityDraft>()
  for (const chunk of chunks) {
    const name = (chunk.symbolName ?? '').trim()
    if (!name) continue
    const kind = (chunk.symbolType ?? '').trim() || 'symbol'
    const key = `${chunk.filePath}\u0000${kind}\u0000${name}`
    const prev = merged.get(key)
    if (!prev) {
      merged.set(key, {
        filePath: chunk.filePath,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
        kind,
        name,
      })
      continue
    }
    prev.lineStart = Math.min(prev.lineStart, chunk.lineStart)
    prev.lineEnd = Math.max(prev.lineEnd, chunk.lineEnd)
  }
  return [...merged.values()].sort(
    (a, b) =>
      a.filePath.localeCompare(b.filePath) ||
      a.lineStart - b.lineStart ||
      a.name.localeCompare(b.name),
  )
}

/** 一次索引状态的快照(`lastIndexedAtMs` 已转毫秒,避免调用方各自解析时间)。 */
export interface IndexStateSnapshot {
  configFingerprint: string
  lastIndexedAtMs: number
  chunkCount: number
}

/** 是否重建的结论:四态封闭,不允许"空字符串当没事"这一档。 */
export type RebuildDecision =
  'rebuild-no-state' | 'rebuild-config-changed' | 'rebuild-stale' | 'reuse-fresh'

/**
 * 纯判据:要不要重建(P0-8 第二批)。
 *
 * 判序:没状态 > 配置变了 > 过期 > 可复用。
 * `maxAgeMs <= 0` 表示调用方没给过期窗口 ⇒ 不按时间判过期(只看配置);
 * `lastIndexedAtMs` 在未来(时钟倒挂)⇒ 按 stale 处理,不冒充"刚建过"。
 */
export function needsRebuild(
  prev: IndexStateSnapshot | null,
  currentFingerprint: string,
  nowMs: number,
  maxAgeMs: number,
): RebuildDecision {
  if (!prev) return 'rebuild-no-state'
  if (prev.configFingerprint !== currentFingerprint) return 'rebuild-config-changed'
  if (
    maxAgeMs > 0 &&
    (nowMs - prev.lastIndexedAtMs <= 0 || nowMs - prev.lastIndexedAtMs > maxAgeMs)
  ) {
    return 'rebuild-stale'
  }
  return 'reuse-fresh'
}

/**
 * 2026-10-03 数据出域合规整改:代码索引默认保留期(天)。
 *
 * 取 90 天而非"永久":本表存的是**用户代码明文 + 向量**,且 embedding 由外部
 * 服务计算(出域面之一)。默认给上限而非下限 —— 用户可显式选长期保留,但
 * "什么都不做"必须是有限期,否则新增的每一条索引都默认永久留存。
 * 改这一个常量即可全局调整;清理任务按 expires_at 回收。
 */
export const CODE_INDEX_RETENTION_DAYS = 90

/**
 * 批量索引时单批 embedding 的最多尝试次数(含首次), F-416 立。
 *
 * 上游对超限批次/瞬时故障会返回非 2xx; 索引是离线批量动作, 失败重来成本远高于
 * 一次退避等待, 故给有限重试。仅在本服务启用(provider 的 maxAttempts 缺省 1),
 * 以保持检索等既有调用方"一次失败即失败"的语义不变。
 */
export const CODEBASE_EMBEDDING_MAX_ATTEMPTS = 3

/**
 * 计算一条索引切片的过期时刻。
 *
 * 抽成函数而不让各调用方各算一次:expires_at 写成 `NOW() + interval` 的字面量
 * SQL 与 JS 侧算出的时间会漂(两个时钟来源),而漂移的方向不可控。这里统一在
 * JS 侧取一次,写库与读库判过期用的是同一套时间基准。
 *
 * days 不传即用 CODE_INDEX_RETENTION_DAYS。传 0 也会得到"当前时刻"(即写完
 * 立刻算过期)—— 这是合法输入(用户主动要求不保留),故不做下限夹取。
 */
export function codeIndexExpiresAt(now: Date = new Date(), days?: number): Date {
  return new Date(now.getTime() + (days ?? CODE_INDEX_RETENTION_DAYS) * 24 * 60 * 60 * 1000)
}

export interface SearchResult {
  id: string
  filePath: string
  lineStart: number
  lineEnd: number
  content: string
  language: string | null
  symbolName: string | null
  symbolType: string | null
  score: number
  /** 本行向量来源(G7):'remote' | 'local-hash';NULL = 无向量或存量未标注行 */
  embeddingProvider: string | null
}

export interface IndexStats {
  totalChunks: number
  totalFiles: number
  vectorizedChunks: number
  /**
   * 缺向量切片数(2026-11-23 P0-8 补):`embedding IS NULL` 的切片**查得到但搜不到**,
   * 此前统计只报 vectorized,读者无法判断"全库是否完整"。
   *
   * 语义对齐 Trae CKG 的 `missing_vector_entity_count`:只报数,不改检索行为。
   */
  missingVectorChunks: number
  /**
   * 向量覆盖率 = vectorizedChunks / totalChunks(0..1,保留 4 位)。
   *
   * 0 个切片时恒为 0 而**不是 1**:空库不是"完整",这一点由 auditIntegrity 的
   * `empty` 态表达,这里不拿 1 冒充。
   */
  vectorCoverage: number
}

/** 索引完整性审计的结论四态(2026-11-23 P0-8):空库不得冒充完整。 */
export type IndexIntegrityStatus = 'ok' | 'degraded' | 'empty' | 'unjudged'

export type IndexIntegrityReason = 'complete' | 'missing_vectors' | 'no_chunks' | 'owner_required'

export interface IndexIntegrityAudit {
  status: IndexIntegrityStatus
  reason: IndexIntegrityReason
  repoId: string | null
  stats: IndexStats
}

/**
 * 归属 + 未过期 谓词(2026-10-03 数据出域合规整改的**唯一判据**)。
 *
 * 为什么不用 RLS:两条读写通道都没有 `app.user_id` 会话变量(ai-service 走
 * `X-User-Id` 内部服务头 + api 自身 drizzle 直连),套 RLS 会让全部读写静默
 * 0 行 —— "功能坏了但不报错"。理由与迁移文件头同源,改判据时两处一起改。
 *
 * 为什么必须带 expiresAt:不排除过期行,过期切片在被清理任务回收前那段窗口里
 * 仍会被检索到 —— 那等于"设了保留期却不遵守",比没有保留期更糟(用户会以为
 * 到期即失效)。清理任务只是最终回收手段,读面过滤才是生效点。
 *
 * ⚠ 所有读写方法都必须经这个函数取谓词,不要就地手写 `owner_uuid = ...`:
 *   漏一处就是一处跨用户读面,而这种漏检在测试里往往看不出来(单用户场景
 *   下两种写法结果相同)。
 */
function _ownerScope(ownerUuid: string | null | undefined) {
  if (!ownerUuid) {
    // 无归属 ⇒ 不返回任何行(而非"不过滤")。这是 fail-closed:
    // 忘记传 ownerUuid 的调用方拿到的是空结果,而不是别人的全部代码。
    return sql`1 = 0`
  }
  return and(
    eq(codebaseChunks.ownerUuid, ownerUuid),
    or(isNull(codebaseChunks.expiresAt), sql`"codebase_chunks"."expires_at" > NOW()`),
  )
}

/**
 * 实体表的归属谓词(P0-8 第三批)。
 *
 * 与 `_ownerScope` 同一条 fail-closed 纪律(无归属 ⇒ `1 = 0`,不返回任何行),
 * 但**不能复用**它:那个谓词绑切片表的两列(`owner_uuid` + `expires_at`),
 * 而实体表没有过期列 —— 直接套用会生成指向不存在列的 SQL。
 */
function _entityOwnerScope(ownerUuid: string | null | undefined) {
  if (!ownerUuid) return sql`1 = 0`
  return eq(codebaseEntities.ownerUuid, ownerUuid)
}

/**
 * 符号精确过滤档的取回上限(2026-11-06 Z36 立)。
 *
 * 为什么不能沿用 topK:本档的语义是「按符号名取回库内**全部**切片」,而 topK 的语义是
 * 「相关度前 N」。带符号过滤仍拿 topK 当上限,等于把刚摆正的「先滤后截」再截一刀 ——
 * 召回损失只是换了个数字复发,本票就没修到东西。
 *
 * 上限为什么仍然必须有:一列 symbol_name 在归属域内能匹配多少行没有任何语义下界
 * (同名符号可以散布在几百个文件),而本表存的是用户代码明文,单次响应不该无界。
 */
export const SYMBOL_SCOPED_ROW_CAP = 200

/**
 * 一次检索的取回预算:进 SQL 的 `LIMIT`(fetchLimit)与出参条数上限(outCap)。
 *
 * 唯一职责是把「过滤在 limit 之前」这件事落到数字上:
 * - 无 symbolName ⇒ 与在册行为逐字相同(fetchLimit = topK*2、outCap = topK);
 * - 有 symbolName ⇒ 两条都脱离 topK,取回上限由 SYMBOL_SCOPED_ROW_CAP 单独定。
 * 两个数字必须同源算出,不要让各腿各写一遍(第二份必然漂移)。
 */
export function rowBudget(
  symbolName: string | undefined,
  topK: number,
): { fetchLimit: number; outCap: number } {
  return symbolName
    ? { fetchLimit: SYMBOL_SCOPED_ROW_CAP, outCap: SYMBOL_SCOPED_ROW_CAP }
    : { fetchLimit: topK * 2, outCap: topK }
}

class CodebaseIndexService {
  /**
   * 批量写入代码切片(增量更新模式)。
   *
   * 流程:
   * 1. 为缺少 embedding 的切片生成向量(批量,复用 embedding-provider;失败即抛错,
   *    此时旧切片一行为未动)
   * 2. 同一事务内:按 ownerUuid + repoId + filePath 删除该文件的所有旧切片,再分批
   *    插入新切片(带 ownerUuid + expiresAt 默认保留期);任一插入失败整体回滚
   *
   * 注意:调用方(ai-service codebase_indexer)也可自行生成 embedding 后传入,
   * 此时本服务跳过 embedding 生成步骤(以调用方传入为准)。
   *
   * ownerUuid(2026-10-03 新增,**必填**):不传时拒绝写入 —— 本表存的是用户
   * 代码明文,写无主行等于制造一处"归属不明但长期留存"的外泄面(正是本次整改
   * 要消除的东西)。存量无主行由迁移标记过期待清理,不在这里再造新的。
   * retentionDays:显式指定保留期;不传用 CODE_INDEX_RETENTION_DAYS 默认上限。
   * 传 null 表示"永不失效"(仅供用户显式选择长期保留)。
   */
  async indexChunks(
    repoId: string,
    chunks: ChunkInput[],
    ownerUuid?: string | null,
    retentionDays?: number | null,
  ): Promise<{
    indexed: number
    vectorized: number
    /** G7:本批用本地回落档('local-hash')标注的行数 —— 离线/远端不可用的可识别痕迹 */
    localEmbedded: number
    /** P0-8 第三批:本批写入的实体行数(同符号跨切片合并后)。 */
    entities: number
  }> {
    if (chunks.length === 0) return { indexed: 0, vectorized: 0, localEmbedded: 0, entities: 0 }
    // 归属强制在**任何 DB 操作之前**:本表存用户代码明文,写无主行等于制造一处
    // "归属不明但长期留存"的外泄面 —— 正是本次整改要消除的东西。存量无主行由
    // 迁移标记过期待清理,不在这里再造新的。缺 ownerUuid 即抛错(而非静默跳过),
    // 让接线漏了当场暴露。
    if (!ownerUuid) {
      throw new Error('indexChunks 缺少 ownerUuid:拒绝写入无归属的代码索引')
    }

    // 1. 收集所有涉及文件(删除动作挪进步骤 3 的事务,见 F-650)
    const filePaths = [...new Set(chunks.map((c) => c.filePath))]

    // 2. 为缺少 embedding 的切片批量生成向量 —— 必须在事务**外**、且**先于任何删除**
    //    完成:embedding 是外部网络调用(可达秒级),放进事务等于把持锁时间交给上游;
    //    异常也不再吞掉(F-650):直接抛给路由 5xx,旧切片一行未动,重试仍是完整语义。
    const provider = getEmbeddingProvider()
    const needEmbedding = chunks.filter((c) => !c.embedding || c.embedding.length !== 1536)
    let vectorized = 0
    if (provider && needEmbedding.length > 0) {
      // 批量 embedding。F-416:provider 内部按上游条数上限(25)与 token 预算分片、
      // 逐批请求, 本节显式开启单批有限重试, 因此这里一次提交任意条数都是安全的;
      // 但返回结果必须与待向量化切片一一对应 —— 条数不符或缺向量一律显式抛错,
      // 绝不把整批切片以 embedding=null 静默入库(那会让语义检索无声退化为关键词匹配)。
      const texts = needEmbedding.map((c) => c.content.slice(0, 8000))
      const embeddings = await provider.embed(texts, {
        maxAttempts: CODEBASE_EMBEDDING_MAX_ATTEMPTS,
      })
      if (embeddings.length !== needEmbedding.length) {
        throw new Error(
          `embedding 应答 ${embeddings.length} 条 ≠ 待向量化切片 ${needEmbedding.length} 条:` +
            '拒绝以缺失向量入库(F-416)',
        )
      }
      for (let i = 0; i < needEmbedding.length; i++) {
        const chunk = needEmbedding[i]
        if (!chunk) continue
        const emb = embeddings[i]
        if (!emb || emb.length !== 1536) {
          throw new Error(
            `第 ${i + 1}/${needEmbedding.length} 条切片未得到 1536 维向量:` +
              '整批显式失败, 不落库无向量切片(F-416)',
          )
        }
        chunk.embedding = emb
        vectorized++
      }
    }

    // 3. 删旧 + 插新在**同一事务**内(F-650):此前先删后插分属两个事务,任一插入
    //    批次失败即"旧切片已删、新切片未写",该文件从检索面整体消失。现在删除只作为
    //    事务内第一步,插入失败整体回滚,旧索引原样保留。
    //    每行强制带 ownerUuid + expiresAt(2026-10-03)。expiresAt 在**写入时一次算定**
    //    并落库,而不是查询时才判断 —— 保留期是一个可被审计的客观事实(这行数据什么
    //    时候失效),不是随查询时刻漂移的窗口。
    // retentionDays === null ⇒ 永不过期(用户显式选择长期保留);
    // 传数字 ⇒ 相对该批写入时刻的保留期;不传 ⇒ CODE_INDEX_RETENTION_DAYS。
    const expiresAt =
      retentionDays === null ? null : codeIndexExpiresAt(undefined, retentionDays ?? undefined)
    const rows = chunks.map((c) => ({
      repoId,
      filePath: c.filePath,
      lineStart: c.lineStart,
      lineEnd: c.lineEnd,
      content: c.content,
      embedding: c.embedding && c.embedding.length === 1536 ? c.embedding : null,
      language: c.language ?? null,
      symbolName: c.symbolName ?? null,
      symbolType: c.symbolType ?? null,
      embeddingProvider:
        c.embeddingProvider ?? (c.embedding && c.embedding.length === 1536 ? 'remote' : null),
      ownerUuid,
      expiresAt,
    }))

    // P0-8 第三批:实体行与切片**同一事务**写入。切片的幂等语义是「按 (归属, 仓库, 文件)
    // 先删后插」,实体必须跟着同一粒度走 —— 否则 DELETE /repo/:repoId/files 只删切片时,
    // 实体会留成"指向已不存在文件"的幽灵节点(且按名检索会持续命中)。
    const entityRows = deriveEntitiesFromChunks(chunks).map((d) => ({
      ownerUuid,
      repoId,
      filePath: d.filePath,
      lineStart: d.lineStart,
      lineEnd: d.lineEnd,
      kind: d.kind,
      name: d.name,
    }))

    let indexed = 0
    let entities = 0
    await db.transaction(async (tx) => {
      for (const filePath of filePaths) {
        await tx
          .delete(codebaseChunks)
          .where(
            and(
              _ownerScope(ownerUuid),
              eq(codebaseChunks.repoId, repoId),
              eq(codebaseChunks.filePath, filePath),
            ),
          )
        await tx
          .delete(codebaseEntities)
          .where(
            and(
              _entityOwnerScope(ownerUuid),
              eq(codebaseEntities.repoId, repoId),
              eq(codebaseEntities.filePath, filePath),
            ),
          )
      }

      // 分批插入(每批 100 条,≤500 且远低于 PostgreSQL 单语句参数上限 65535)
      const BATCH_SIZE = 100
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        await tx.insert(codebaseChunks).values(batch)
        indexed += batch.length
      }

      // 实体行同样分批:同一文件先删后插,与切片同粒度;空批次直接跳过(不产生空 INSERT)。
      for (let i = 0; i < entityRows.length; i += BATCH_SIZE) {
        const batch = entityRows.slice(i, i + BATCH_SIZE)
        if (batch.length === 0) continue
        await tx.insert(codebaseEntities).values(batch)
        entities += batch.length
      }
    })

    const localEmbedded = chunks.filter((c) => c.embeddingProvider === 'local-hash').length
    // P0-8 第二批:幂等标记(**best-effort**)—— 标记失败不影响索引结果
    // (索引已在事务内成功;这里抛错会让调用方误以为"索引也失败了")。
    await this.markIndexed({
      ownerUuid,
      repoId,
      configFingerprint: resolveIndexConfigFingerprint(),
      chunkCount: indexed,
    }).catch((err: unknown) => {
      logger.warn('[codebase-index-service.indexChunks] 索引状态标记失败(不影响本次索引结果)', {
        repoId,
        ownerUuid,
        err: err instanceof Error ? err.message : String(err),
      })
    })
    return { indexed, vectorized, localEmbedded, entities }
  }

  /**
   * 读某 (归属, 仓库) 的索引状态;没有状态行返回 null(由 `needsRebuild` 判 `rebuild-no-state`)。
   * 归属缺失直接返回 null —— 状态行以归属为键的一半,跨用户读状态没有语义。
   */
  async getIndexState(
    ownerUuid: string | null | undefined,
    repoId: string,
  ): Promise<IndexStateSnapshot | null> {
    if (!ownerUuid) return null
    const rows = await db
      .select({
        configFingerprint: codebaseIndexStates.configFingerprint,
        lastIndexedAt: codebaseIndexStates.lastIndexedAt,
        chunkCount: codebaseIndexStates.chunkCount,
      })
      .from(codebaseIndexStates)
      .where(
        and(eq(codebaseIndexStates.ownerUuid, ownerUuid), eq(codebaseIndexStates.repoId, repoId)),
      )
      .limit(1)
    const row = rows[0]
    if (!row) return null
    return {
      configFingerprint: row.configFingerprint,
      lastIndexedAtMs: row.lastIndexedAt.getTime(),
      chunkCount: row.chunkCount,
    }
  }

  /**
   * 重建判据的组合出口(P0-8 第六批,2026-11-23)。
   *
   * 把「读状态 → 取当前指纹 → 逐档判定」三步收成一个入口:调用方(路由、
   * 校验脚本、未来的调度层)各自拼这三步就会各自漏掉一步 —— 漏取指纹时
   * 会把"配置变更"读成"可复用",漏传 maxAgeMs 时会把过期索引永远当新鲜。
   *
   * 三条都不覆盖的默认是明确的:
   * - `maxAgeMs` 缺省 0 ⇒ **不按时间判过期**,只看"有没有状态 / 指纹变没变";
   *   想看过期必须由调用方显式给出窗口(这是有意的:窗口是运维口径,不是代码常量)。
   * - `currentFingerprint` 缺省取 `resolveIndexConfigFingerprint()`(与写状态时同源)。
   * - 无归属 ⇒ `getIndexState` 直接返 null(零 DB 调用)⇒ 判 `rebuild-no-state`。
   *   这条**不是**"没建过索引"的断言,而是"本调用方拿不到状态"的诚实落点:
   *   归属缺失的调用方本就不该看到状态行,也就不该据此断言别人的索引新鲜度。
   */
  async evaluateRebuild(opts: {
    repoId: string
    ownerUuid?: string | null
    maxAgeMs?: number
    nowMs?: number
    currentFingerprint?: string
  }): Promise<{
    state: IndexStateSnapshot | null
    currentFingerprint: string
    decision: RebuildDecision
  }> {
    const { repoId, ownerUuid, maxAgeMs = 0, nowMs, currentFingerprint } = opts
    const fingerprint = currentFingerprint ?? resolveIndexConfigFingerprint()
    const state = await this.getIndexState(ownerUuid, repoId)
    return {
      state,
      currentFingerprint: fingerprint,
      decision: needsRebuild(state, fingerprint, nowMs ?? Date.now(), maxAgeMs),
    }
  }

  /**
   * 写/刷新索引状态(P0-8 第二批,幂等)。
   *
   * 幂等键 = `(owner_uuid, repo_id)`(迁移 `20261123151500` 里的唯一索引)——
   * 同一仓库反复索引只留一行,不产生"每次一条状态"的账本膨胀。
   * `ownerUuid` 必填:状态行的主体身份就是键的一半,无主状态行没有意义。
   */
  async markIndexed(input: {
    ownerUuid: string
    repoId: string
    configFingerprint: string
    chunkCount: number
    runId?: string
    nowMs?: number
  }): Promise<void> {
    const { ownerUuid, repoId, configFingerprint, chunkCount, runId, nowMs } = input
    if (!ownerUuid) throw new Error('markIndexed 缺少 ownerUuid:拒绝写无主索引状态')
    if (!configFingerprint) throw new Error('markIndexed 缺少 configFingerprint:状态不可判')
    const at = new Date(nowMs ?? Date.now())
    await db
      .insert(codebaseIndexStates)
      .values({
        ownerUuid,
        repoId,
        configFingerprint,
        lastRunId: runId ?? null,
        chunkCount,
        lastIndexedAt: at,
        updatedAt: at,
      })
      .onConflictDoUpdate({
        target: [codebaseIndexStates.ownerUuid, codebaseIndexStates.repoId],
        set: {
          configFingerprint,
          lastRunId: runId ?? null,
          chunkCount,
          lastIndexedAt: at,
          updatedAt: at,
        },
      })
  }

  /**
   * 语义检索 (pgvector ANN)。
   *
   * 流程:
   * 1. 调 EmbeddingProvider 生成 query embedding
   * 2. SQL 端用 pgvector `<=>` 距离运算符检索 top-K
   *    - score = 1 - (embedding <=> query),范围 0~1,越大越相似
   * 3. 当 query embedding 不可用时返回空结果(调用方应 fallback 到 regex 搜索)
   *
   * 可选过滤:repoId(限定仓库)、language(限定语言)、symbolName(限定符号名,**逐字等值**)
   *
   * symbolName(2026-11-06 Z36 立):过滤条件进 WHERE(即发生在 `LIMIT` **之前**),
   * 且该档下取回上限脱离 topK(见 rowBudget)。「先取回再在内存里挑同符号」不是过滤,
   * 是拿截断集冒充全量 —— 那正是本票要消除的语义。
   *
   * ownerUuid(2026-10-03 新增,**必填**):不传即返回空(fail-closed)。整改前
   * repoId 是可选的,不传就跨全部仓库检索 —— 本表存的是用户代码明文,那等于
   * 任何登录用户都能检索到别人的代码。归属过滤是**无条件**的,不因调用方
   * "只想搜自己"而省略。symbolName 是被过滤的**数据列**,不是身份:它只能与
   * 归属谓词 AND,永远不得替代归属谓词。
   */
  async search(opts: {
    query: string
    repoId?: string
    language?: string
    symbolName?: string
    topK?: number
    scoreThreshold?: number
    ownerUuid?: string | null
  }): Promise<SearchResult[]> {
    const { query, repoId, language, symbolName, topK = 10, scoreThreshold = 0, ownerUuid } = opts
    const { fetchLimit, outCap } = rowBudget(symbolName, topK)

    // 归属缺失必须在消耗 embedding **之前** 拒绝(SDB-39):
    // 谓词已经 fail-closed(1=0),但先算 embedding 等于每次空跑一次外部调用,
    // 会话成本不会因为"结果恒空"而消失。
    if (!ownerUuid) return []

    const queryEmbedding = await this._getEmbedding(query)
    if (!queryEmbedding || queryEmbedding.length !== 1536) {
      // 无法生成 embedding → 返回空(调用方应 fallback 到 regex)
      return []
    }

    try {
      const vectorLiteral = `[${queryEmbedding.join(',')}]`
      const whereParts = [sql`"embedding" IS NOT NULL`, _ownerScope(ownerUuid)]
      if (repoId) whereParts.push(sql`"repo_id" = ${repoId}`)
      if (language) whereParts.push(sql`"language" = ${language}`)
      if (symbolName) whereParts.push(sql`"symbol_name" = ${symbolName}`)

      const rows = (await db.execute(sql`
        SELECT
          "id",
          "file_path",
          "line_start",
          "line_end",
          "content",
          "language",
          "symbol_name",
          "symbol_type",
          "embedding_provider",
          1 - ("embedding" <=> ${vectorLiteral}::vector) AS "score"
        FROM "codebase_chunks"
        WHERE ${sql.join(whereParts, sql` AND `)}
        ORDER BY "embedding" <=> ${vectorLiteral}::vector
        LIMIT ${fetchLimit}
      `)) as Array<{
        id: string
        file_path: string
        line_start: number
        line_end: number
        content: string
        language: string | null
        symbol_name: string | null
        symbol_type: string | null
        embedding_provider: string | null
        score: number
      }>

      const results: SearchResult[] = []
      for (const row of rows) {
        const score = Number(row.score) || 0
        if (score >= scoreThreshold) {
          results.push({
            id: row.id,
            filePath: row.file_path,
            lineStart: row.line_start,
            lineEnd: row.line_end,
            content: row.content,
            language: row.language,
            symbolName: row.symbol_name,
            symbolType: row.symbol_type,
            embeddingProvider: row.embedding_provider ?? null,
            score,
          })
        }
      }
      return results.slice(0, outCap)
    } catch (e) {
      logger.warn('[codebase-index-service.search] pgvector query failed:', { err: e as Error })
      return []
    }
  }

  /**
   * 关键词检索(Postgres 全文检索,2026-09-07 立)。
   *
   * BM25 风格词法通道:tsquery 匹配 content + symbol_name + file_path,
   * ts_rank 排序。与向量通道互补——精确符号名/文件名/标识符查询
   * (如"getUserById")在词法通道命中率远高于语义通道。
   * 无需迁移:tsvector 查询时计算(切片表规模 <10万行时成本可接受)。
   *
   * ownerUuid(2026-10-03 新增,**必填**):与 search() 同一纪律。词法通道同样
   * 返回 content 明文,不隔离它就是一条完整的跨用户读取面。
   *
   * symbolName(2026-11-06 Z36 立):同 search() —— 逐字等值条件进 WHERE,发生在
   * `LIMIT` 之前;本腿过去没有 JS 侧截断,靠 SQL `LIMIT topK*2` 收口,故该档的上限
   * 必须一并脱离 topK,否则「按符号取回全部」在词法腿上仍然是拿截断集充数。
   */
  async keywordSearch(opts: {
    query: string
    repoId?: string
    language?: string
    symbolName?: string
    topK?: number
    ownerUuid?: string | null
  }): Promise<SearchResult[]> {
    const { query, repoId, language, symbolName, topK = 10, ownerUuid } = opts
    const { fetchLimit } = rowBudget(symbolName, topK)
    try {
      const whereParts = [
        sql`to_tsvector('simple', "content" || ' ' || coalesce("symbol_name", '') || ' ' || "file_path") @@ websearch_to_tsquery('simple', ${query})`,
        _ownerScope(ownerUuid),
      ]
      if (repoId) whereParts.push(sql`"repo_id" = ${repoId}`)
      if (language) whereParts.push(sql`"language" = ${language}`)
      if (symbolName) whereParts.push(sql`"symbol_name" = ${symbolName}`)

      const rows = (await db.execute(sql`
        SELECT
          "id",
          "file_path",
          "line_start",
          "line_end",
          "content",
          "language",
          "symbol_name",
          "symbol_type",
          ts_rank(
            to_tsvector('simple', "content" || ' ' || coalesce("symbol_name", '') || ' ' || "file_path"),
            websearch_to_tsquery('simple', ${query})
          ) AS "score"
        FROM "codebase_chunks"
        WHERE ${sql.join(whereParts, sql` AND `)}
        ORDER BY "score" DESC
        LIMIT ${fetchLimit}
      `)) as Array<{
        id: string
        file_path: string
        line_start: number
        line_end: number
        content: string
        language: string | null
        symbol_name: string | null
        symbol_type: string | null
        embedding_provider: string | null
        score: number
      }>

      return rows.map((row) => ({
        id: row.id,
        filePath: row.file_path,
        lineStart: row.line_start,
        lineEnd: row.line_end,
        content: row.content,
        language: row.language,
        symbolName: row.symbol_name,
        symbolType: row.symbol_type,
        embeddingProvider: row.embedding_provider ?? null,
        score: Number(row.score) || 0,
      }))
    } catch (e) {
      logger.warn('[codebase-index-service.keywordSearch] FTS query failed:', { err: e as Error })
      return []
    }
  }

  /**
   * 混合检索(向量 + 关键词 RRF 融合,2026-09-07 立)。
   *
   * 双通道并行 → Reciprocal Rank Fusion(k=60)→ 符号/路径精确匹配加权。
   * 向量通道失败(embedding 不可用)时自动降级为纯关键词通道;
   * 关键词通道失败(FTS 异常)时退化为纯向量。两通道都空才返回空。
   *
   * ownerUuid(2026-10-03 新增,**必填**):向下透传给两个子通道,任一子通道漏传
   * 都会让 hybrid 变成跨用户读面(RRF 只融合排名,不隔离内容)。
   *
   * symbolName(2026-11-06 Z36 立):向下透传给两个子通道(与 ownerUuid 同一纪律:
   * 漏一条腿就等于该腿的结果集没过滤,融合出来的仍是截断集)。融合后的 `limit` 与
   * 收尾 `slice` 必须走同一个 rowBudget,否则"先滤后截"在融合这一步又被 topK 补一刀。
   */
  async hybridSearch(opts: {
    query: string
    repoId?: string
    language?: string
    symbolName?: string
    topK?: number
    scoreThreshold?: number
    ownerUuid?: string | null
  }): Promise<SearchResult[]> {
    const { query, repoId, language, symbolName, topK = 10, scoreThreshold = 0, ownerUuid } = opts
    const { fetchLimit, outCap } = rowBudget(symbolName, topK)

    const [vectorResults, keywordResults] = await Promise.all([
      this.search({ query, repoId, language, symbolName, topK, scoreThreshold, ownerUuid }).catch(
        () => [] as SearchResult[],
      ),
      this.keywordSearch({ query, repoId, language, symbolName, topK, ownerUuid }).catch(
        () => [] as SearchResult[],
      ),
    ])

    if (vectorResults.length === 0 && keywordResults.length === 0) return []

    const fused = reciprocalRankFusion(vectorResults, keywordResults, 60, fetchLimit)
    return applyLexicalBoost(fused, query).slice(0, outCap)
  }

  /**
   * 按仓库删除所有切片。
   *
   * ownerUuid(2026-10-03 新增,**必填**):删除面与读取面同样要隔离 —— 否则
   * 用户 A 传别人的 repoId 就能把 B 的索引删掉(破坏性跨用户操作)。
   */
  async deleteByRepo(repoId: string, ownerUuid?: string | null): Promise<number> {
    const result = await db
      .delete(codebaseChunks)
      .where(and(_ownerScope(ownerUuid), eq(codebaseChunks.repoId, repoId)))
      .returning({ id: codebaseChunks.id })
    // P0-8 第三批:实体行必须跟着切片一起没 —— 只删切片会留下按名可检索的幽灵节点。
    await db
      .delete(codebaseEntities)
      .where(and(_entityOwnerScope(ownerUuid), eq(codebaseEntities.repoId, repoId)))
    return result.length
  }

  /** 按仓库+文件删除切片(增量更新前清理);ownerUuid 语义同 deleteByRepo。 */
  async deleteByFileScoped(
    repoId: string,
    filePath: string,
    ownerUuid?: string | null,
  ): Promise<number> {
    const result = await db
      .delete(codebaseChunks)
      .where(
        and(
          _ownerScope(ownerUuid),
          eq(codebaseChunks.repoId, repoId),
          eq(codebaseChunks.filePath, filePath),
        ),
      )
      .returning({ id: codebaseChunks.id })
    await db
      .delete(codebaseEntities)
      .where(
        and(
          _entityOwnerScope(ownerUuid),
          eq(codebaseEntities.repoId, repoId),
          eq(codebaseEntities.filePath, filePath),
        ),
      )
    return result.length
  }

  /** @deprecated 保留旧签名(deleteByFile);内部按无归属处理 ⇒ 命中 0 行(fail-closed)。 */
  async deleteByFile(repoId: string, filePath: string): Promise<number> {
    return this.deleteByFileScoped(repoId, filePath, null)
  }

  /**
   * 批量按文件删除切片(Merkle 增量同步专用,2026-09-07 立)。
   * 处理"源文件已删除"场景:文件消失后其旧切片必须同步清除,
   * 否则语义搜索会持续召回幽灵文件的过期内容。
   */
  async deleteByFiles(
    repoId: string,
    filePaths: string[],
    ownerUuid?: string | null,
  ): Promise<number> {
    if (filePaths.length === 0) return 0
    let deleted = 0
    // 分批 in 查询(每批 200,防 SQL 参数过多)
    const BATCH = 200
    for (let i = 0; i < filePaths.length; i += BATCH) {
      const batch = filePaths.slice(i, i + BATCH)
      const result = await db
        .delete(codebaseChunks)
        .where(
          and(
            _ownerScope(ownerUuid),
            eq(codebaseChunks.repoId, repoId),
            inArray(codebaseChunks.filePath, batch),
          ),
        )
        .returning({ id: codebaseChunks.id })
      deleted += result.length
      // 实体行随同批文件一起清(同一 in 批次,同一归属谓词)。
      await db
        .delete(codebaseEntities)
        .where(
          and(
            _entityOwnerScope(ownerUuid),
            eq(codebaseEntities.repoId, repoId),
            inArray(codebaseEntities.filePath, batch),
          ),
        )
    }
    return deleted
  }

  /**
   * 索引统计。
   *
   * ownerUuid(2026-10-03 新增,**必填**):统计数字本身也是信息泄露面 ——
   * 不隔离时用户能通过"总切片数"推断出别人仓库的规模与活跃度,故一并隔离。
   */
  async getStats(repoId?: string, ownerUuid?: string | null): Promise<IndexStats> {
    const whereParts = [_ownerScope(ownerUuid)]
    if (repoId) whereParts.push(sql`"repo_id" = ${repoId}`)
    const whereCondition = sql`WHERE ${sql.join(whereParts, sql` AND `)}`
    const rows = (await db.execute(sql`
      SELECT
        COUNT(*) AS "total",
        COUNT(DISTINCT "file_path") AS "files",
        COUNT("embedding") AS "vectorized",
        COUNT(*) FILTER (WHERE "embedding" IS NULL) AS "missing"
      FROM "codebase_chunks"
      ${whereCondition}
    `)) as Array<{
      total: string | number
      files: string | number
      vectorized: string | number
      missing: string | number
    }>
    const row = rows[0] ?? { total: 0, files: 0, vectorized: 0, missing: 0 }
    const totalChunks = Number(row.total) || 0
    const vectorizedChunks = Number(row.vectorized) || 0
    const missingVectorChunks = Number(row.missing) || 0
    return {
      totalChunks,
      totalFiles: Number(row.files) || 0,
      vectorizedChunks,
      missingVectorChunks,
      // 0 切片 ⇒ 0(不是 1):空库的"完整"由 auditIntegrity 的 empty 态回答
      vectorCoverage: totalChunks > 0 ? Number((vectorizedChunks / totalChunks).toFixed(4)) : 0,
    }
  }

  /**
   * 索引完整性审计(2026-11-23 P0-8,TRAE CKG 语义的 pgvector 移植)。
   *
   * 与 getStats 的分工:getStats 只报数(读数面),本方法**给结论**(判定面)。
   * 四态互斥,任一态都不得用另一个态的数字冒充:
   * - `unjudged` + `owner_required`:无归属 ⇒ 不查库。查了也会被 fail-closed 谓词
   *   折成 0 行,那种 0 是"没查成"而不是"库里空",冒充 empty 就是假绿(§0.3)。
   * - `empty` + `no_chunks`:归属域内 0 切片 —— 没有可审计对象,不记 ok。
   * - `degraded` + `missing_vectors`:存在 `embedding IS NULL` 的切片,它们能被
   *   关键词腿召回但在语义腿永远缺失。
   * - `ok` + `complete`:全部切片带向量。
   *
   * 只读、零副作用;幂等标记的磁盘态/运行时态双层语义本方法不落地(P0-8 最小范围)。
   */
  async auditIntegrity(repoId?: string, ownerUuid?: string | null): Promise<IndexIntegrityAudit> {
    const emptyStats: IndexStats = {
      totalChunks: 0,
      totalFiles: 0,
      vectorizedChunks: 0,
      missingVectorChunks: 0,
      vectorCoverage: 0,
    }
    if (!ownerUuid) {
      return {
        status: 'unjudged',
        reason: 'owner_required',
        repoId: repoId ?? null,
        stats: emptyStats,
      }
    }
    const stats = await this.getStats(repoId, ownerUuid)
    const base = { repoId: repoId ?? null, stats }
    if (stats.totalChunks === 0) return { ...base, status: 'empty', reason: 'no_chunks' }
    if (stats.missingVectorChunks > 0) {
      return { ...base, status: 'degraded', reason: 'missing_vectors' }
    }
    return { ...base, status: 'ok', reason: 'complete' }
  }

  /**
   * 按仓库查符号实体(P0-8 第四批,2026-11-23,实体表的**读面**)。
   *
   * 为什么需要读面:第三批把 `codebase_entities` 的写入通电了,但表若无读方就是
   * 死表。这里的消费方是 knowledge_fs 的符号视图(agent 问"这个符号在仓库哪儿定义"
   * 时不必先发一次远端检索),以及运维对账(实体行是否与切片同源)。
   *
   * 纪律(三条,都有对应的负面后果):
   * - **归属 fail-closed 且零 DB 调用**:无归属直接空数组。先查一次再判空等于每次空跑
   *   一条带 `1 = 0` 的 SQL,与 search() 的 SDB-39 同一取舍。
   * - **name / kind / filePath 一律等值**:它们是数据列不是查询词(与 symbolName 同一
   *   纪律),不在这里做模糊匹配 —— 模糊匹配会命中近似符号名,把"定义位置"变成猜测。
   * - **limit 夹取在 [1, 200]**:默认 50。上限存在的理由是响应体是明文路径清单,
   *   不设上限时一个 import 重排可能一次拉回上千行。
   */
  async findEntities(opts: {
    repoId: string
    ownerUuid?: string | null
    name?: string
    kind?: string
    filePath?: string
    limit?: number
  }): Promise<
    Array<{
      id: string
      filePath: string
      lineStart: number
      lineEnd: number
      kind: string
      name: string
    }>
  > {
    const { repoId, ownerUuid, name, kind, filePath, limit } = opts
    if (!ownerUuid) return []
    const cap = Math.min(Math.max(1, limit ?? 50), 200)
    const whereParts = [_entityOwnerScope(ownerUuid), eq(codebaseEntities.repoId, repoId)]
    if (name) whereParts.push(eq(codebaseEntities.name, name))
    if (kind) whereParts.push(eq(codebaseEntities.kind, kind))
    if (filePath) whereParts.push(eq(codebaseEntities.filePath, filePath))
    return (await db
      .select({
        id: codebaseEntities.id,
        filePath: codebaseEntities.filePath,
        lineStart: codebaseEntities.lineStart,
        lineEnd: codebaseEntities.lineEnd,
        kind: codebaseEntities.kind,
        name: codebaseEntities.name,
      })
      .from(codebaseEntities)
      .where(and(...whereParts))
      .orderBy(codebaseEntities.filePath, codebaseEntities.lineStart, codebaseEntities.name)
      .limit(cap)) as Array<{
      id: string
      filePath: string
      lineStart: number
      lineEnd: number
      kind: string
      name: string
    }>
  }

  /**
   * 路径投影元数据清单(2026-10-31 G2 立,knowledge_fs 虚拟文件系统的数据源)。
   *
   * 对齐 Trae ckg 的 CfsListDir/CfsStat 最小数据面:返回切片的路径/符号元数据,
   * 不返回 content(内容面走 readFileChunks 逐文件聚合)。归属面同 getStats:
   * _ownerScope fail-closed,无归属返回空集而非别人的代码。
   */
  async listPathIndex(
    repoId: string,
    ownerUuid?: string | null,
  ): Promise<
    Array<{
      filePath: string
      lineStart: number
      lineEnd: number
      symbolName: string | null
      symbolType: string | null
      language: string | null
    }>
  > {
    return (await db
      .select({
        filePath: codebaseChunks.filePath,
        lineStart: codebaseChunks.lineStart,
        lineEnd: codebaseChunks.lineEnd,
        symbolName: codebaseChunks.symbolName,
        symbolType: codebaseChunks.symbolType,
        language: codebaseChunks.language,
      })
      .from(codebaseChunks)
      .where(and(_ownerScope(ownerUuid), eq(codebaseChunks.repoId, repoId)))
      .orderBy(codebaseChunks.filePath, codebaseChunks.lineStart)) as Array<{
      filePath: string
      lineStart: number
      lineEnd: number
      symbolName: string | null
      symbolType: string | null
      language: string | null
    }>
  }

  /**
   * 单文件切片聚合(按行号升序;2026-10-31 G2 立,供 knowledge_fs read 使用)。
   * 与 listPathIndex 同一归属纪律。文件不存在返回空数组 —— 「空」由投影层
   * 如实回给上层(path_missing),不在此冒充任何内容。
   */
  async readFileChunks(
    repoId: string,
    filePath: string,
    ownerUuid?: string | null,
  ): Promise<
    Array<{
      lineStart: number
      lineEnd: number
      content: string
      symbolName: string | null
      symbolType: string | null
      language: string | null
    }>
  > {
    return (await db
      .select({
        lineStart: codebaseChunks.lineStart,
        lineEnd: codebaseChunks.lineEnd,
        content: codebaseChunks.content,
        symbolName: codebaseChunks.symbolName,
        symbolType: codebaseChunks.symbolType,
        language: codebaseChunks.language,
      })
      .from(codebaseChunks)
      .where(
        and(
          _ownerScope(ownerUuid),
          eq(codebaseChunks.repoId, repoId),
          eq(codebaseChunks.filePath, filePath),
        ),
      )
      .orderBy(codebaseChunks.lineStart)) as Array<{
      lineStart: number
      lineEnd: number
      content: string
      symbolName: string | null
      symbolType: string | null
      language: string | null
    }>
  }

  /**
   * 回收已过期的代码索引切片(2026-10-03 数据出域合规整改立,由调度器每日调用)。
   *
   * 为什么必须有这一步:读面已按 expires_at 过滤(见 _ownerScope),所以"过期即
   * 不可见"已经成立;本方法负责的是**物理删除** —— 让用户的代码明文不会因为
   * "一直没人查它"而在库里无限期躺着(留存面的终点是删除,不是不可见)。
   *
   * 分批删除(默认 1000 行/批):单次大 DELETE 会长时间持锁,在一张可能已有
   * 数十万行的表上尤其明显。循环直到没有到期行为止,与 llm_call_logs 清除器
   * 的分批形态一致。
   *
   * 不设"最大批数"上限:宁可多跑几轮,也不要让到期行长期滞留 —— 限轮次等于
   * 给"清理不及时"留了合法出口,而这个任务没有任何实时性要求(延迟一天无害)。
   *
   * 返回值:本轮删掉的行数,供调度器记日志/指标。
   */
  async purgeExpired(limitPerBatch = 1000): Promise<number> {
    let total = 0
    // 守卫:批大小为 0 或负数会让循环永远"删 0 行"却继续转 —— 直接拒绝而不是
    // 静默空转(这类死循环在调度器里表现为"任务永远在跑")。
    if (limitPerBatch <= 0) {
      throw new Error(`purgeExpired 需要正数批大小,收到 ${limitPerBatch}`)
    }
    for (;;) {
      const rows = (await db.execute(sql`
        DELETE FROM "codebase_chunks"
        WHERE "id" IN (
          SELECT "id" FROM "codebase_chunks"
          WHERE "expires_at" IS NOT NULL AND "expires_at" <= NOW()
          LIMIT ${limitPerBatch}
        )
        RETURNING "id"
      `)) as Array<{ id: string }>
      const deleted = rows.length
      total += deleted
      if (deleted < limitPerBatch) return total
    }
  }

  /**
   * 调用当前 EmbeddingProvider 生成 embedding。
   * 失败或未配置时返回 null,触发降级(返回空结果,调用方 fallback 到 regex)。
   */
  private async _getEmbedding(text: string): Promise<number[] | null> {
    const provider = getEmbeddingProvider()
    if (!provider) return null
    try {
      const results = await provider.embed([text])
      return results[0] ?? null
    } catch {
      return null
    }
  }
}

export const codebaseIndexService = new CodebaseIndexService()

/**
 * Reciprocal Rank Fusion(纯函数,2026-09-07 立)。
 *
 * score(d) = Σ_channels 1 / (k + rank_i(d)),k=60 为论文推荐值。
 * 输入各通道已按相关性降序的结果列表;按 id 去重合并。
 * 返回按融合分降序、截断 limit 的结果(融合分写入 score 字段)。
 */
export function reciprocalRankFusion(...channels: Array<SearchResult[] | number>): SearchResult[] {
  const nums = channels.filter((c): c is number => typeof c === 'number')
  const lists = channels.filter((c): c is SearchResult[] => Array.isArray(c))
  const k = nums[0] ?? 60
  const limit = nums[1] ?? Number.MAX_SAFE_INTEGER
  if (lists.length === 0) return []

  const byId = new Map<string, SearchResult>()
  const scores = new Map<string, number>()
  for (const list of lists) {
    list.forEach((item, idx) => {
      scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (k + idx + 1))
      if (!byId.has(item.id)) byId.set(item.id, item)
    })
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, rrfScore]) => ({ ...byId.get(id)!, score: rrfScore }))
}

/**
 * 词法精确匹配加权(纯函数,2026-09-07 立)。
 * symbol_name 完整包含查询 token → +0.05;file_path 包含 → +0.03。
 * 让"getUserById"这类精确标识符查询稳定排到语义近似结果之前。
 */
export function applyLexicalBoost(results: SearchResult[], query: string): SearchResult[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length >= 3)
  if (tokens.length === 0) return results
  return results.map((r) => {
    let boost = 0
    const sym = (r.symbolName ?? '').toLowerCase()
    const path = r.filePath.toLowerCase()
    if (sym && tokens.some((t) => sym.includes(t))) boost += 0.05
    if (tokens.some((t) => path.includes(t))) boost += 0.03
    return boost === 0 ? r : { ...r, score: r.score + boost }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
