// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-387 回归锁(2026-11-13)。
 *
 * 病灶:`knowledgeRagService.ingestFile` 先用 `ingestText` 入库,再按 `title` 反查
 * `zhs_knowledge_doc` 取「最新一条」当 docId。标题不是唯一键 ⇒ 两个同名文档时切片
 * 会挂到另一篇文档上(串档);解析结果为空/全空白时则直接返回 `{ docId: 0, chunkCount: 0 }`,
 * 文档显示"已索引"却零切片,排障时无法区分失败与空内容。
 *
 * 本文件锁:
 *   ① 空文本/全空白 → 抛 EmptyDocumentTextError,不再返回成功;
 *   ② 调用方传入 docId → 事务内校验归属后直挂该 doc,全程不按标题反查;
 *   ③ 未传 docId → 直接使用插入 doc 返回的主键,同样不回查标题;
 *   ④ 确需按标题反查时,同名多篇必须抛 AmbiguousDocTitleError,不随机取一条;
 *   ⑤ 空文本且带 docId → 把目标 doc 状态回写 failed;
 *   ⑥ 路由 /upload:空文本返回 400 + EMPTY_DOCUMENT_TEXT,docId 字段真实透传。
 *
 * 只打桩 db / document-parser / embedding-provider / auth,不连真实 PG、向量库与外部服务。
 */
import { getTableName } from 'drizzle-orm'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn(),
  },
  tx: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  parseDocument: vi.fn(),
  getEmbeddingProvider: vi.fn(),
}))

vi.mock('../src/services/document-parser.js', () => ({
  parseDocument: mocks.parseDocument,
  UnsupportedFormatError: class UnsupportedFormatError extends Error {},
  FileTooLargeError: class FileTooLargeError extends Error {},
}))

vi.mock('../src/db/index.js', () => ({
  db: mocks.db,
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

vi.mock('../src/services/embedding-provider.js', () => ({
  getEmbeddingProvider: mocks.getEmbeddingProvider,
}))

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: async (request: { userId?: string }) => {
    request.userId = 'f387-user'
    return true
  },
}))

import {
  knowledgeRagService,
  EmptyDocumentTextError,
  AmbiguousDocTitleError,
} from '../src/services/knowledge-rag-service.js'
import { knowledgeRagRoutes } from '../src/routes/knowledge-rag.js'

type TableRef = Parameters<typeof getTableName>[0]

interface SelectChain {
  from: () => SelectChain
  where: () => SelectChain
  orderBy: () => SelectChain
  limit: () => Promise<unknown[]>
}

/** drizzle select 链的替身:from/where/orderBy 恒返回自身,limit 给出预设行。 */
function selectChain(rows: unknown[]): SelectChain {
  const chain: SelectChain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
  }
  return chain
}

interface TxStub {
  insertedChunks: Array<Record<string, unknown>>
  updatedDocs: Array<Record<string, unknown>>
}

/**
 * 事务替身:docId 路径依次消费 selects 队列(先归属校验,再取最大 chunkIndex);
 * 无 docId 路径由新插入的 doc 返回 newDocId。写操作全部落在 tx 上。
 */
function installTxStub(opts: { selects?: unknown[][]; newDocId?: number } = {}): TxStub {
  const pendingSelects = [...(opts.selects ?? [])]
  const stub: TxStub = { insertedChunks: [], updatedDocs: [] }

  mocks.tx.select.mockImplementation(() => selectChain(pendingSelects.shift() ?? []))
  mocks.tx.insert.mockImplementation((table: TableRef) => ({
    values: (values: unknown) => {
      if (getTableName(table) === 'zhs_knowledge_doc') {
        return { returning: async () => [{ id: opts.newDocId ?? 7 }] }
      }
      stub.insertedChunks.push(...(values as Array<Record<string, unknown>>))
      return Promise.resolve()
    },
  }))
  mocks.tx.update.mockImplementation((table: TableRef) => ({
    set: (values: Record<string, unknown>) => ({
      where: async () => {
        if (getTableName(table) === 'zhs_knowledge_doc') stub.updatedDocs.push(values)
      },
    }),
  }))
  mocks.db.transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(mocks.tx))
  return stub
}

const baseFile = (docId?: number) => ({
  ownerUuid: 'f387-user',
  title: '同名标题',
  buffer: Buffer.from('f387'),
  mimeType: 'text/plain',
  filename: 'f387.txt',
  ...(docId === undefined ? {} : { docId }),
})

describe('F-387 ingestFile 以 docId 为主键 + 空文本必须失败', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmbeddingProvider.mockReturnValue(null)
  })

  it('① 空文本/全空白:明确失败,不再返回成功且不建 doc', async () => {
    mocks.parseDocument.mockResolvedValue(' \n\t ')

    await expect(knowledgeRagService.ingestFile(baseFile())).rejects.toBeInstanceOf(
      EmptyDocumentTextError,
    )

    expect(mocks.db.transaction).not.toHaveBeenCalled()
    expect(mocks.db.insert).not.toHaveBeenCalled()
  })

  it('② 传入 docId 直接使用:切片挂该 doc,全程不按标题反查', async () => {
    mocks.parseDocument.mockResolvedValue('文件正文')
    const stub = installTxStub({ selects: [[{ id: 42 }], []] })

    const result = await knowledgeRagService.ingestFile(baseFile(42))

    expect(result).toEqual({ docId: 42, chunkCount: 1 })
    expect(mocks.db.select).not.toHaveBeenCalled()
    expect(mocks.db.insert).not.toHaveBeenCalled()
    expect(stub.insertedChunks).toHaveLength(1)
    expect(stub.insertedChunks[0]).toMatchObject({
      docId: 42,
      chunkIndex: 0,
      content: '文件正文',
    })
    expect(stub.updatedDocs[0]).toMatchObject({ chunkCount: 1, sourceType: 'text' })
  })

  it('③ 未传 docId:使用插入返回的 docId,不回查标题', async () => {
    mocks.parseDocument.mockResolvedValue('新文档正文')
    const stub = installTxStub({ newDocId: 7 })

    const result = await knowledgeRagService.ingestFile(baseFile())

    expect(result).toEqual({ docId: 7, chunkCount: 1 })
    expect(mocks.db.select).not.toHaveBeenCalled()
    expect(stub.insertedChunks[0]).toMatchObject({ docId: 7, chunkIndex: 0 })
  })

  it('④ 确需按标题反查:同名多篇报歧义,唯一时返回该 docId', async () => {
    mocks.db.select.mockImplementationOnce(() => selectChain([{ id: 1 }, { id: 2 }]))

    await expect(
      knowledgeRagService.resolveDocIdByTitle('f387-user', '重复标题'),
    ).rejects.toBeInstanceOf(AmbiguousDocTitleError)

    mocks.db.select.mockImplementationOnce(() => selectChain([{ id: 9 }]))
    await expect(knowledgeRagService.resolveDocIdByTitle('f387-user', '唯一标题')).resolves.toBe(9)
  })

  it('⑤ 空文本且带 docId:目标文档状态回写 failed', async () => {
    mocks.parseDocument.mockResolvedValue('   ')
    const updates: Array<Record<string, unknown>> = []
    mocks.db.update.mockImplementation(() => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updates.push(values)
        },
      }),
    }))

    await expect(knowledgeRagService.ingestFile(baseFile(42))).rejects.toBeInstanceOf(
      EmptyDocumentTextError,
    )

    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ status: 'failed' })
  })
})

interface MultipartPayload {
  body: string
  contentType: string
}

/** 手工拼 multipart 请求体(fields 在 file part 之前,保证 data.fields 可读)。 */
function buildMultipart(opts: {
  filename: string
  content: string
  fields?: Record<string, string>
}): MultipartPayload {
  const boundary = '----F387Boundary'
  const parts: string[] = []
  for (const [name, value] of Object.entries(opts.fields ?? {})) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
  }
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${opts.filename}"\r\n` +
      `Content-Type: text/plain\r\n\r\n${opts.content}\r\n`,
  )
  parts.push(`--${boundary}--\r\n`)
  return { body: parts.join(''), contentType: `multipart/form-data; boundary=${boundary}` }
}

describe('F-387 路由 /api/knowledge/upload', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(multipart)
    await app.register(knowledgeRagRoutes, { prefix: '/api/knowledge' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmbeddingProvider.mockReturnValue(null)
  })

  it('⑥ 空文本:400 + EMPTY_DOCUMENT_TEXT,不是 200 伪成功', async () => {
    mocks.parseDocument.mockResolvedValue('')
    const payload = buildMultipart({ filename: 'empty.txt', content: 'f387' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/upload',
      headers: { 'content-type': payload.contentType, authorization: 'Bearer f387-token' },
      payload: payload.body,
    })

    expect(res.statusCode).toBe(400)
    const json = res.json() as { code: number; message: string; errorCode?: string; data?: unknown }
    expect(json.code).toBe(400)
    expect(json.errorCode).toBe('EMPTY_DOCUMENT_TEXT')
    expect(json.data).toBeUndefined()
  })

  it('⑦ docId 字段透传:切片挂到调用方指定的文档', async () => {
    mocks.parseDocument.mockResolvedValue('文件正文')
    installTxStub({ selects: [[{ id: 42 }], []] })
    const payload = buildMultipart({
      filename: 'f387.txt',
      content: 'f387',
      fields: { docId: '42' },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/upload',
      headers: { 'content-type': payload.contentType, authorization: 'Bearer f387-token' },
      payload: payload.body,
    })

    expect(res.statusCode).toBe(200)
    const json = res.json() as {
      code: number
      data?: { docId?: number; chunkCount?: number; filename?: string }
    }
    expect(json.code).toBe(0)
    expect(json.data).toMatchObject({ docId: 42, chunkCount: 1, filename: 'f387.txt' })
    expect(mocks.db.select).not.toHaveBeenCalled()
  })
})
