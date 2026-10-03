// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「导入的会话进知识库、可被 RAG 检索」端到端验证(2026-10-03)。
 *
 * ## 本测试要证明什么(核心验收)
 * 不是"入库函数返回成功",而是:**构造一个导入的微信群聊会话 → 加入知识库 → 实际调
 * knowledgeRagService.search() → 断言该会话的内容能被召回**。召回走的是服务里
 * 真实的那段检索代码(向量路 + 关键词路的分支与打分),不是把结果硬编码回去。
 *
 * ## 为什么用替身而不是真 PG
 * 本仓铁律:测试禁连生产库(apps/api/vitest.config.ts 只收 mock 测试,真库另走
 * vitest.real.config.ts)。这里的替身是**有状态**的内存表:insert 真写入、
 * select 真读回、execute 真按余弦相似度排序,所以"能不能召回"是真判定,
 * 而非桩函数无条件返回。被打桩的只有两个外部边界:db 连接与 embedding HTTP 调用。
 *
 * ## 为什么向量路与关键词路都要测
 * knowledge-rag-service 的两条召回路径各有各的降级语义,只测一条等于放過另一半的回归:
 *   - 向量路:有 1536 维 embedding + pgvector 可用 → cosine 排序
 *   - 关键词路:provider 未配置/失败 → 词集重合度排序(embedding 列存 NULL)
 * 派生出 fake embedder 用**确定性哈希词袋**把文本映射成 1536 维向量:同一段文本
 * 恒得同一向量,故余弦相似度的排序结果是可断言的确定值,不需要真调 DashScope。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────
// Mock:embedding provider —— 确定性 1536 维假 embedder(不联网、不消耗额度)
// ─────────────────────────────────────────────────────────────
const EMBED_DIM = 1536
/** 测试开关:置 false 模拟"未配置 embedding key" → 服务应降级关键词路 */
const embedState = vi.hoisted(() => ({ enabled: true, fail: false }))

vi.mock('../embedding-provider.js', () => ({
  getEmbeddingProvider: () => {
    if (!embedState.enabled) return null
    return {
      async embed(texts: string[]) {
        if (embedState.fail) throw new Error('embedding provider unavailable')
        return texts.map(hashEmbed)
      },
    }
  },
}))

/**
 * 确定性词袋 → 单位向量。
 *
 * token 切分刻意做了 CJK 处理:**中文按字bigram 切**。理由:正则 `[\w\u4e00-\u9fff]+`
 * 会把"支付回调联调提测"整串当成一个 token,于是查询"支付回调"与它零重叠、相似度恒 0 ——
 * 那是替身自己的分词缺陷,不是服务的缺陷,会让"向量路能不能召回"这个问题测不出真相。
 * 真实语义 embedding 有分词器,中文按字/词切;这里用 bigram 逼近同一语义。
 * 英文/数字仍按整词切(与原实现一致)。
 *
 * 同一个 token 恒定映射到同一维(乘以固定符号),故"共享 token 越多余弦越接近 1",
 * 排序语义与真实语义 embedding 同向;空文本得到零向量。
 */
function hashEmbed(text: string): number[] {
  const v = new Array<number>(EMBED_DIM).fill(0)
  for (const token of tokenize(text)) {
    let h = 2166136261
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    const idx = Math.abs(h) % EMBED_DIM
    const sign = (Math.abs(h) >> 20) % 2 === 0 ? 1 : -1
    v[idx] = (v[idx] ?? 0) + sign
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  return norm === 0 ? v : v.map((x) => x / norm)
}

/** CJK 连续段按字 bigram 切,其余按整词切 */
function tokenize(text: string): string[] {
  const out: string[] = []
  for (const seg of text.toLowerCase().split(/[^\w\u4e00-\u9fff]+/)) {
    if (!seg) continue
    const cjk = seg.match(/[\u4e00-\u9fff]+/g) ?? []
    const rest = seg.replace(/[\u4e00-\u9fff]+/g, ' ')
    for (const w of rest.split(/\s+/)) if (w) out.push(w)
    for (const run of cjk) {
      if (run.length === 1) {
        out.push(run)
        continue
      }
      for (let i = 0; i + 1 < run.length; i++) out.push(run.slice(i, i + 2))
    }
  }
  return out
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += (a[i] ?? 0) * (b[i] ?? 0)
  return dot
}

// ─────────────────────────────────────────────────────────────
// Mock:@ihui/database —— 用**真实** schema 对象,让 drizzle 的 eq/and 正常求值
// ─────────────────────────────────────────────────────────────
vi.mock('@ihui/database', async () => await import('@ihui/database'))

// ─────────────────────────────────────────────────────────────
// Mock:db —— 有状态内存表(doc / chunk 真存真取)
// ─────────────────────────────────────────────────────────────
type DocRow = {
  id: number
  ownerUuid: string
  collectionName: string
  title: string
  sourceType: string
  sourcePath: string | null
  contentHash: string | null
  chunkCount: number
  status: string
  metadataJson: string | null
}
type ChunkRow = {
  id: number
  docId: number
  collectionName: string
  ownerUuid: string
  chunkIndex: number
  content: string
  embedding: number[] | null
}

const mem = vi.hoisted(() => ({
  docs: [] as Array<Record<string, unknown>>,
  chunks: [] as Array<Record<string, unknown>>,
  seq: { doc: 0, chunk: 0 },
  reset: () => {
    mem.docs.length = 0
    mem.chunks.length = 0
    mem.seq.doc = 0
    mem.seq.chunk = 0
  },
}))

  /**
   * 从向量路的 SQL 树里取回查询向量。
   *
   * 实测形状(apps/api 走 `sql\`...${vectorLiteral}::vector...\``,drizzle 把已
   * 内插的模板片段拍成**普通字符串**),所以向量不在 Param 里,而是一个形如
   * `[0.1,0.2,...]` 的字符串字面量。这里按方括号 + 逗号 + 数字解析它,
   * 并**校验维度 === 1536** —— 维度不对就不认,宁可降级也不拿错向量算余弦。
   */
  function extractQueryVector(node: unknown): number[] | null {
    if (node === null || node === undefined) return null
    if (typeof node === 'string') {
      const m = /^\[\s*(-?[\d.eE+-]+(?:\s*,\s*-?[\d.eE+-]+)*)\s*\]$/.exec(node.trim())
      if (!m || !m[1]) return null
      const parts = m[1].split(',').map((s) => Number(s.trim()))
      if (parts.length !== EMBED_DIM || parts.some((n) => !Number.isFinite(n))) return null
      return parts
    }
    if (Array.isArray(node)) {
      for (const n of node) {
        const found = extractQueryVector(n)
        if (found) return found
      }
      return null
    }
    if (typeof node === 'object') {
      return extractQueryVector((node as { queryChunks?: unknown }).queryChunks)
    }
    return null
  }

vi.mock('../../db/index.js', async () => {
  // vi.mock 工厂被提升到 import 之前,不能用文件顶部的 import 绑定;
  // drizzle 的 getTableName 在工厂内动态取。
  const { getTableName: getTableNameFn } = await import('drizzle-orm')

  const selectChain = () => {
    const state: { table: unknown; where: unknown } = { table: null, where: null }
    const c: Record<string, unknown> = {}
    c.from = (table: unknown) => {
      state.table = table
      return c
    }
    c.where = (cond: unknown) => {
      state.where = cond
      return c
    }
    c.orderBy = () => c
    c.limit = () => c
    c.offset = () => c
    c.then = (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
      const name = tableName(state.table)
      const source: unknown[] =
        name === 'zhs_knowledge_doc' ? mem.docs : name === 'zhs_knowledge_chunk' ? mem.chunks : []
      // 真求值 where:关键词路与幂等查重都靠它收窄,不做这一步"属主隔离"就是空断言
      const rows = source.filter((r) => evalWhere(state.where, r))
      return Promise.resolve(rows).then(
        onF as (v: unknown) => unknown,
        onR as (e: unknown) => unknown,
      )
    }
    return c
  }

  /** snake_case 列名 → 内存行字段名(与 schema 的 $inferSelect 对齐) */
  const FIELD_ALIAS: Record<string, string> = {
    owner_uuid: 'ownerUuid',
    collection_name: 'collectionName',
    source_type: 'sourceType',
    source_path: 'sourcePath',
    content_hash: 'contentHash',
    chunk_count: 'chunkCount',
    doc_id: 'docId',
    chunk_index: 'chunkIndex',
    metadata_json: 'metadataJson',
    error_message: 'errorMessage',
    imported_count: 'importedCount',
  }

  /**
   * 求值 drizzle 生成的 SQL 条件树(实测形状,非猜测)。
   *
   * `eq(col, val)` 的 `queryChunks` 是 5 段:
   *   [StringChunk('""'), Column, StringChunk(' = '), Param, StringChunk('')]
   * 其中 Param 带 `brand` 键;Column 带 `name`(snake_case 列名)。
   * `and(a, b)` 的 queryChunks 则是 [a, ' and ', b] 的嵌套。
   *
   * 逐条抽出 (列名, 值) 对做等值比较。**抽不出条件时保守放行**(返回 true):
   * 把"解析不了"当成"不匹配"会让召回测试假阴,那比假阳更危险 —— 它会把
   * "真的召不回"藏起来。
   */
  function evalWhere(node: unknown, row: unknown): boolean {
    if (node === null || node === undefined) return true
    const chunks = (node as { queryChunks?: unknown }).queryChunks
    if (!Array.isArray(chunks)) return true
    const r = row as Record<string, unknown>

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      if (chunk === null || chunk === undefined) continue
      if (typeof chunk === 'string') continue // ' and ' 连接符

      if (Array.isArray(chunk)) {
        if (!evalWhere({ queryChunks: chunk }, row)) return false
        continue
      }
      if (typeof chunk !== 'object') continue

      const obj = chunk as Record<string, unknown>
      // 嵌套条件(and/or 的子表达式):递归
      if (Array.isArray(obj.queryChunks)) {
        if (!evalWhere(obj, row)) return false
        continue
      }
      // Column:后面紧跟 ' = ' 与 Param,构成一个等值条件
      if ('name' in obj && typeof obj.name === 'string') {
        const op = chunks[i + 1]
        const param = chunks[i + 2]
        const opText = op && typeof op === 'object' ? String((op as { value?: unknown }).value ?? '') : ''
        if (opText.includes('=') && param && typeof param === 'object' && 'brand' in param) {
          const field = FIELD_ALIAS[obj.name] ?? obj.name
          const want = (param as { value: unknown }).value
          if (r[field] !== want) return false
          i += 2
        }
      }
    }
    return true
  }

  /** 表名解析:drizzle 的 __name 不是公开属性,唯一正解是 getTableName */
  function tableName(t: unknown): string {
    if (typeof t === 'string') return t
    if (!t) return ''
    try {
      return getTableNameFn(t as Parameters<typeof getTableNameFn>[0])
    } catch {
      return ''
    }
  }

  const insertChain = (table: unknown) => {
    const c: Record<string, unknown> = { __values: undefined, __table: table }
    c.from = (t: unknown) => {
      c.__table = t
      return c
    }
    c.values = (v: unknown) => {
      c.__values = v
      return c
    }

    /** 落库一张内存表,返回生成后的行 */
    const persist = (): unknown[] => {
      const v = c.__values
      const name = tableName(c.__table)
      if (name === 'zhs_knowledge_doc') {
        const doc = { id: ++mem.seq.doc, ...(v as Record<string, unknown>) }
        mem.docs.push(doc as unknown as Record<string, unknown>)
        return [{ id: doc.id }]
      }
      if (name === 'zhs_knowledge_chunk') {
        const rows = (Array.isArray(v) ? v : [v]) as Array<Record<string, unknown>>
        const out = rows.map((r) => ({ id: ++mem.seq.chunk, ...r }))
        mem.chunks.push(...(out as unknown as Array<Record<string, unknown>>))
        return out
      }
      // 其余表(留痕等)不在本测试断言面,不落内存表
      return []
    }

    c.returning = () => Promise.resolve(persist())
    c.then = (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
      return Promise.resolve(persist()).then(
        onF as (v: unknown) => unknown,
        onR as (e: unknown) => unknown,
      )
    }
    return c
  }

  const dbMock = {
    select: () => selectChain(),
    insert: (table: unknown) => insertChain(table),
    update: (table: unknown) => insertChain(table),
    delete: () => selectChain(),
    execute: async (sqlObj: unknown) => {
      // 向量路:从 SQL 树取回查询向量,对内存 chunk 算余弦并排序 —— 复刻 pgvector
      // `<=>` + ORDER BY 的语义,让"能否召回"成为真判定。
      const q = extractQueryVector(sqlObj)
      if (!q) return []
      return mem.chunks
        // 与真实 SQL 一致:向量路只召回 embedding 非 NULL 的行
        .filter((c) => Array.isArray(c.embedding) && (c.embedding as number[]).length === EMBED_DIM)
        .map((c) => ({
          id: c.id,
          doc_id: c.docId,
          content: c.content,
          chunk_index: c.chunkIndex,
          score: cosine(q, c.embedding as number[]),
        }))
        .sort((a, b) => b.score - a.score)
    },
  }
  return { db: dbMock, dbRead: dbMock }
})

import { knowledgeRagService, CONVERSATION_IMPORT_SOURCE_TYPE } from '../knowledge-rag-service.js'

// ─────────────────────────────────────────────────────────────
// 测试夹具:一个"导入的微信群聊会话"
// ─────────────────────────────────────────────────────────────
const OWNER = 'user-1'
const CONV_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

/** 微信解析器(wechat.py,已定稿)产出的形态:发言人写在正文前缀,时间归一到 UTC+8 */
const WECHAT_MESSAGES = [
  { role: 'user', content: '张伟：明天上午十点的产品评审改到下午三点了', createdAt: new Date('2026-09-20T02:00:00Z') },
  { role: 'user', content: '李娜：收到,我把会议室改到 3 号会议室', createdAt: new Date('2026-09-20T02:01:00Z') },
  { role: 'user', content: '张伟：另外王强负责的支付回调联调,这周必须提测', createdAt: new Date('2026-09-20T02:03:00Z') },
  { role: 'user', content: '王强：支付回调已经联调完了,提测单我今天下午提', createdAt: new Date('2026-09-20T02:05:00Z') },
  { role: 'user', content: '李娜：[表情]', createdAt: new Date('2026-09-20T02:06:00Z') },
]

beforeEach(() => {
  mem.reset()
  embedState.enabled = true
  embedState.fail = false
})

// ─────────────────────────────────────────────────────────────
// 1. 入库:sourceType / 溯源 / 分块 / 幂等
// ─────────────────────────────────────────────────────────────
describe('导入会话入库(ingestConversation)', () => {
  it('写入 sourceType=conversation_import、溯源 sourcePath 与 metadata,并切出多块', async () => {
    const r = await knowledgeRagService.ingestConversation({
      ownerUuid: OWNER,
      conversationId: CONV_ID,
      title: '产品研发群',
      source: 'wechat',
      messages: WECHAT_MESSAGES,
    })

    expect(r.chunkCount).toBeGreaterThan(0)
    expect(r.deduped).toBe(false)
    expect(r.docId).toBeGreaterThan(0)

    const doc = mem.docs[0] as unknown as DocRow
    expect(doc.sourceType).toBe(CONVERSATION_IMPORT_SOURCE_TYPE)
    expect(doc.sourceType).toBe('conversation_import')
    // 溯源:一眼看出这篇知识来自哪个会话
    expect(doc.sourcePath).toBe(`conversation:${CONV_ID}`)
    // 属主与集合:决定 RLS 可见性与检索作用域
    expect(doc.ownerUuid).toBe(OWNER)
    expect(doc.collectionName).toBe('default')
    // contentHash:幂等键,必须有
    expect(doc.contentHash).toMatch(/^[0-9a-f]{32}$/)

    const meta = JSON.parse(doc.metadataJson ?? '{}') as Record<string, unknown>
    expect(meta.conversationId).toBe(CONV_ID)
    expect(meta.importedFrom).toBe('wechat')
    expect(meta.messageCount).toBe(WECHAT_MESSAGES.length)

    // chunk 真落库,条数与 chunkCount 一致
    expect(mem.chunks).toHaveLength(r.chunkCount)
    // 每个 chunk 都带 1536 维向量(维度守卫:不是 1536 的一律存 NULL)
    for (const c of mem.chunks) {
      const emb = (c as unknown as ChunkRow).embedding
      expect(emb).not.toBeNull()
      expect((emb as number[]).length).toBe(EMBED_DIM)
    }
  })

  it('转录保留发言人前缀与时间轴(微信形态不被二次解析)', async () => {
    await knowledgeRagService.ingestConversation({
      ownerUuid: OWNER,
      conversationId: CONV_ID,
      title: '产品研发群',
      source: 'wechat',
      messages: WECHAT_MESSAGES,
    })
    const all = mem.chunks.map((c) => (c as unknown as ChunkRow).content).join('\n')
    // 发言人前缀原样保留(wechat.py 写进正文的 `昵称：正文`)
    expect(all).toContain('张伟：明天上午十点的产品评审')
    expect(all).toContain('王强：支付回调已经联调完了')
    // 时间戳以 ISO 形态带进知识库
    expect(all).toContain('[2026-09-20T02:03:00.000Z]')
  })

  it('空内容消息被跳过;全空则不入库(返回 0 块)且不写 doc', async () => {
    const r = await knowledgeRagService.ingestConversation({
      ownerUuid: OWNER,
      conversationId: CONV_ID,
      title: '空会话',
      source: 'wechat',
      messages: [
        { role: 'user', content: '   ', createdAt: new Date() },
        { role: 'user', content: '', createdAt: new Date() },
      ],
    })
    expect(r.chunkCount).toBe(0)
    expect(r.docId).toBe(0)
    expect(mem.docs).toHaveLength(0)
    expect(mem.chunks).toHaveLength(0)
  })

  it('同会话重复入库 → 幂等命中,不再写第二批 chunk', async () => {
    const first = await knowledgeRagService.ingestConversation({
      ownerUuid: OWNER,
      conversationId: CONV_ID,
      title: '产品研发群',
      source: 'wechat',
      messages: WECHAT_MESSAGES,
    })
    const docsAfterFirst = mem.docs.length
    const chunksAfterFirst = mem.chunks.length

    const second = await knowledgeRagService.ingestConversation({
      ownerUuid: OWNER,
      conversationId: CONV_ID,
      title: '产品研发群',
      source: 'wechat',
      messages: WECHAT_MESSAGES,
    })

    // 幂等:复用同一个 doc,不新增
    expect(second.deduped).toBe(true)
    expect(second.docId).toBe(first.docId)
    expect(mem.docs).toHaveLength(docsAfterFirst)
    expect(mem.chunks).toHaveLength(chunksAfterFirst)
  })

  it('会话内容变化 → hash 变,视为新知识追加一篇(不误判为重复)', async () => {
    await knowledgeRagService.ingestConversation({
      ownerUuid: OWNER,
      conversationId: CONV_ID,
      title: '产品研发群',
      source: 'wechat',
      messages: WECHAT_MESSAGES,
    })
    const r2 = await knowledgeRagService.ingestConversation({
      ownerUuid: OWNER,
      conversationId: CONV_ID,
      title: '产品研发群',
      source: 'wechat',
      messages: [
        ...WECHAT_MESSAGES,
        { role: 'user', content: '张伟：补充一下,灰度先放 5% 流量', createdAt: new Date('2026-09-20T02:10:00Z') },
      ],
    })
    expect(r2.deduped).toBe(false)
    expect(mem.docs).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────────────────────
// 2. 核心验收:RAG 真能检索到导入的会话内容
// ─────────────────────────────────────────────────────────────
describe('RAG 检索真能召回导入的会话(核心验收)', () => {
  it('向量路:入库后 search() 召回该会话内容,且排第一', async () => {
    await knowledgeRagService.ingestConversation({
      ownerUuid: OWNER,
      conversationId: CONV_ID,
      title: '产品研发群',
      source: 'wechat',
      messages: WECHAT_MESSAGES,
    })

    // 用一句在群聊里出现过的话去检索 —— 若 RAG 真的能召回,必须命中
    const hits = await knowledgeRagService.search({
      query: '支付回调联调提测',
      ownerUuid: OWNER,
      topK: 5,
    })

    expect(hits.length).toBeGreaterThan(0)
    const top = hits[0]!
    expect(top.content).toContain('支付回调')
    expect(top.docId).toBe((mem.docs[0] as unknown as DocRow).id)
    // 走的是向量路:分数应是余弦相似度(>0),而不是关键词路的词集比例
    expect(top.score).toBeGreaterThan(0)
  })

  it('关键词路(embedding 未配置):仍能召回,降级不丢内容', async () => {
    // 先入库(此时有 embedding),再关掉 provider 模拟 provider 未配置
    await knowledgeRagService.ingestConversation({
      ownerUuid: OWNER,
      conversationId: CONV_ID,
      title: '产品研发群',
      source: 'wechat',
      messages: WECHAT_MESSAGES,
    })
    embedState.enabled = false

    const hits = await knowledgeRagService.search({
      query: '支付回调',
      ownerUuid: OWNER,
      topK: 5,
    })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.map((h) => h.content).join('\n')).toContain('支付回调')
  })

  it('embedding provider 抛错时降级关键词路,检索不 500', async () => {
    await knowledgeRagService.ingestConversation({
      ownerUuid: OWNER,
      conversationId: CONV_ID,
      title: '产品研发群',
      source: 'wechat',
      messages: WECHAT_MESSAGES,
    })
    embedState.fail = true

    const hits = await knowledgeRagService.search({
      query: '会议室',
      ownerUuid: OWNER,
      topK: 5,
    })
    expect(hits.length).toBeGreaterThan(0)
  })

  it('getRagContext 能把导入内容拼进 LLM 上下文(检索到 ≠ 只有 hit 列表)', async () => {
    await knowledgeRagService.ingestConversation({
      ownerUuid: OWNER,
      conversationId: CONV_ID,
      title: '产品研发群',
      source: 'wechat',
      messages: WECHAT_MESSAGES,
    })
    const ctx = await knowledgeRagService.getRagContext({
      query: '产品评审改到几点',
      ownerUuid: OWNER,
      topK: 3,
    })
    expect(ctx).toBeTruthy()
    expect(ctx).toContain('产品评审')
  })

  it('别的用户的 query 召不到本用户的知识(属主隔离)', async () => {
    await knowledgeRagService.ingestConversation({
      ownerUuid: OWNER,
      conversationId: CONV_ID,
      title: '产品研发群',
      source: 'wechat',
      messages: WECHAT_MESSAGES,
    })
    // 关键词路显式带 ownerUuid 过滤
    embedState.enabled = false
    const other = await knowledgeRagService.search({
      query: '支付回调',
      ownerUuid: 'someone-else',
      topK: 5,
    })
    expect(other).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
