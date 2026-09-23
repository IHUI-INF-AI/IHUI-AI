// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O21b:`POST /file-versions/create` 属主闸门的**行为级**回归测试。
 *
 * 与本票同族的 `tests/o21-file-version-owner.test.ts` 已用 35 例钉住 8 端点的越权 403、
 * `checkFileAccess` 调用点计数 = 7、以及"闸门 indexOf < `await data.toBuffer()`"的**顺序结构钉**。
 * 但 create 是唯一读 multipart 的端点,既有 harness 只覆盖普通 JSON 端点(参数在 URL/body),
 * **运行时行为一直无人看守**:把 `checkFileAccess` 短路成恒 ok、或把闸门挪到 `toBuffer()` 之后,
 * 35 例照样全绿。本文件补的就是这一格。
 *
 * 判据(逐条对应漏洞的真实代价):
 * 1. 越权者 → 403,且 `data.toBuffer()` **一次都没被调用**(越权者不得先付内存/磁盘代价);
 * 2. 越权者 → `createWriteStream` / `mkdirSync` / `unlinkSync` / `copyFileSync` 全 0 次(零写盘),
 *    `db.insert` 0 次(零版本行) —— 这是本票核心价值;
 * 3. 未登录 → 401,根本走不到属主判定(`canAccessFile`/`findFileById` 均未被调用);
 * 4. 正向不误伤:上传者本人与项目成员都能写成功,且**只写一行、只落一次盘、字节与上传内容一致**;
 * 5. 出口仍不外泄磁盘路径(响应体不含 `uploads`)。
 *
 * multipart 用**真插件** `@fastify/multipart` + 手工 boundary 请求体(参照
 * `src/routes/__tests__/conversation-import.test.ts` 模式),不是伪造 `request.file()`;
 * 唯一的手术是用 onRequest 钩子包住 `request.file()` 返回的 part,给它的 `toBuffer()` 加计数器
 * (仍委托真实实现),用来把"闸门排在读 buffer 之前"从静态 indexOf 断言升级为运行时断言。
 * 落盘一律走内存 mock(`vi.mock('node:fs')` 部分覆写),不产生任何真实文件。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { join } from 'node:path'
import multipart from '@fastify/multipart'
import {
  mockAuthenticate,
  mockCheckAuth,
  setMockUser,
  setMockUnauthorized,
} from './helpers/mock-auth.js'

const OWNER = 'user-owner-uuid'
const MEMBER = 'user-member-uuid'
const ATTACKER = 'user-attacker-uuid'
// fileId 走 handler 内联取值(不过 z.uuid()),但沿用真 v4 形态与同族测试保持一致。
const FILE_ID = '3f2a7c9e-1b4d-4e6f-8a9b-0c1d2e3f4a5b'
const CREATED_VERSION_ID = 'created-version-uuid'
/** 与 routes/file-version.ts 的 VERSIONS_DIR 同式推导,用于断言落盘位置与"响应不含路径"。 */
const VERSIONS_DIR = join(process.cwd(), 'uploads', 'private', 'versions')

const { db, dbState, fsState, fsMocks, mockCanAccessFile, mockFindFileById, uploadCounter } =
  vi.hoisted(() => {
    const dbState = {
      /** db.select() 的返回行:本端点只有一次 `max(version)` 查询。 */
      selectRows: [] as unknown[],
      writes: { insert: 0, update: 0, delete: 0 },
      /** 每次 insert(...).values(v) 的实参,用于断言"到底写进了什么"。 */
      insertedValues: [] as Record<string, unknown>[],
    }
    const fsState = {
      mkdirs: [] as string[],
      writes: [] as Array<{ path: string; bytes: number; content: string }>,
      unlinks: [] as string[],
      copies: [] as string[],
      stats: [] as string[],
    }
    const uploadCounter = { toBufferCalls: 0 }

    /** 可 then 的 drizzle 查询链替身:任何终结方法都返回自身,await 时给假数据。 */
    const chain = (getValue: () => unknown) => {
      const node: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(getValue()).then(resolve, reject),
      }
      for (const m of [
        'from',
        'where',
        'orderBy',
        'limit',
        'offset',
        'set',
        'returning',
        'leftJoin',
        'innerJoin',
        'onConflictDoNothing',
      ]) {
        node[m] = () => node
      }
      return node
    }

    const insertChain = () => {
      dbState.writes.insert += 1
      let values: Record<string, unknown> = {}
      const node: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve([{ id: CREATED_VERSION_ID, ...values }]).then(resolve, reject),
        values: (v: Record<string, unknown>) => {
          values = v
          dbState.insertedValues.push(v)
          return node
        },
        returning: () => node,
      }
      return node
    }

    const db = {
      select: vi.fn(() => chain(() => dbState.selectRows)),
      insert: vi.fn(insertChain),
      update: vi.fn(() => {
        dbState.writes.update += 1
        return chain(() => [])
      }),
      delete: vi.fn(() => {
        dbState.writes.delete += 1
        return chain(() => [])
      }),
    }

    /** createWriteStream 替身:记录字节数与内容,异步补发 'finish' 让 handler 的 await 通过。 */
    const createWriteStream = vi.fn((target: unknown) => {
      const path = String(target)
      const handlers = new Map<string, Array<() => void>>()
      const stream = {
        on(event: string, cb: () => void) {
          const list = handlers.get(event) ?? []
          list.push(cb)
          handlers.set(event, list)
          return stream
        },
        end(chunk?: unknown) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk ?? ''))
          fsState.writes.push({ path, bytes: buf.length, content: buf.toString('utf8') })
          queueMicrotask(() => {
            for (const cb of handlers.get('finish') ?? []) cb()
          })
          return stream
        },
      }
      return stream
    })

    const fsMocks = {
      // false ⇒ ensureVersionsDir() 必然走 mkdirSync 分支,写盘计数才有意义。
      existsSync: vi.fn(() => false),
      mkdirSync: vi.fn((target: unknown) => {
        fsState.mkdirs.push(String(target))
      }),
      createWriteStream,
      unlinkSync: vi.fn((target: unknown) => {
        fsState.unlinks.push(String(target))
      }),
      copyFileSync: vi.fn((src: unknown, dest: unknown) => {
        fsState.copies.push(`${String(src)}->${String(dest)}`)
      }),
      statSync: vi.fn((target: unknown) => {
        fsState.stats.push(String(target))
        return { size: 0 }
      }),
    }

    return {
      db,
      dbState,
      fsState,
      fsMocks,
      uploadCounter,
      mockCanAccessFile: vi.fn<(userId: string, file: unknown) => Promise<boolean>>(),
      mockFindFileById: vi.fn<(id: string) => Promise<unknown>>(),
    }
  })

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    // 只是占位串:db 模块整体被 mock,postgres() 永不因它被调用(§5 测试隔离铁律,不连 8810/8811)。
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: mockCheckAuth,
  requireActiveUser: vi.fn(),
}))

vi.mock('../src/db/file-queries.js', () => ({
  canAccessFile: mockCanAccessFile,
  searchFiles: vi.fn(),
  createShare: vi.fn(),
  findShareByToken: vi.fn(),
  deleteShare: vi.fn(),
  findRecentFiles: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({ db, dbRead: db, dbWrite: db }))

vi.mock('../src/db/workspace-queries.js', () => {
  const noop = vi.fn()
  return {
    listProjectsByUserWithFileCount: noop,
    findProjectById: noop,
    createProject: noop,
    updateProject: noop,
    deleteProject: noop,
    listFilesByProject: noop,
    findFileById: mockFindFileById,
    findFileByIdIncludeTrashed: mockFindFileById,
    createFile: noop,
    softDeleteFile: noop,
    restoreFile: noop,
    hardDeleteFile: noop,
    findTrashedFiles: noop,
    batchSoftDelete: noop,
    batchRestore: noop,
    findFileVersions: noop,
    listProjectsByUser: noop,
  }
})

// node:fs 部分覆写:只替换"会真的动磁盘"的六个同步/流式入口,其余(readFileSync 等)保持真实。
vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    existsSync: fsMocks.existsSync,
    mkdirSync: fsMocks.mkdirSync,
    createWriteStream: fsMocks.createWriteStream,
    unlinkSync: fsMocks.unlinkSync,
    copyFileSync: fsMocks.copyFileSync,
    statSync: fsMocks.statSync,
  }
})

import { fileVersionRoutes } from '../src/routes/file-version.js'

const FILE_ROW = { id: FILE_ID, projectId: 'project-uuid', name: 'spec.md', uploadedBy: OWNER }

/** 真 multipart 请求体:字段部分必须排在文件部分之前,否则 part.fields 取不到。 */
function buildMultipart(parts: Array<{ name: string; filename?: string; content: string }>): {
  body: string
  boundary: string
} {
  const boundary = '----O21bFileVersionBoundary'
  const lines: string[] = []
  for (const p of parts) {
    lines.push(`--${boundary}`)
    if (p.filename) {
      lines.push(`Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"`)
      lines.push('Content-Type: application/octet-stream')
    } else {
      lines.push(`Content-Disposition: form-data; name="${p.name}"`)
    }
    lines.push('', p.content)
  }
  lines.push(`--${boundary}--`)
  return { body: lines.join('\r\n'), boundary }
}

const CREATE_URL = '/api/file-versions/create'

/** 现网模型:上传者 ∪ 项目 owner ∪ project_members。 */
function allowUsers(...userIds: string[]): void {
  mockCanAccessFile.mockImplementation(async (userId: string) => userIds.includes(userId))
}

function resetData(): void {
  dbState.selectRows = [{ maxVer: 3 }]
  dbState.writes.insert = 0
  dbState.writes.update = 0
  dbState.writes.delete = 0
  dbState.insertedValues = []
  fsState.mkdirs = []
  fsState.writes = []
  fsState.unlinks = []
  fsState.copies = []
  fsState.stats = []
  uploadCounter.toBufferCalls = 0
  mockFindFileById.mockImplementation(async (id: string) => (id === FILE_ID ? FILE_ROW : undefined))
  allowUsers(OWNER)
}

async function postCreate(app: FastifyInstance, parts: Parameters<typeof buildMultipart>[0]) {
  const { body, boundary } = buildMultipart(parts)
  return app.inject({
    method: 'POST',
    url: CREATE_URL,
    payload: body,
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(Buffer.byteLength(body)),
    },
  })
}

/** 零副作用总断言:一次都没读 buffer、没动过磁盘、没写过任何一行。 */
function expectNoSideEffects(): void {
  expect(uploadCounter.toBufferCalls).toBe(0)
  expect(fsState.writes).toHaveLength(0)
  expect(fsState.mkdirs).toHaveLength(0)
  expect(fsState.unlinks).toHaveLength(0)
  expect(fsState.copies).toHaveLength(0)
  expect(fsMocks.createWriteStream).not.toHaveBeenCalled()
  expect(fsMocks.mkdirSync).not.toHaveBeenCalled()
  expect(dbState.writes.insert).toBe(0)
  expect(dbState.writes.update).toBe(0)
  expect(dbState.writes.delete).toBe(0)
  expect(dbState.insertedValues).toHaveLength(0)
}

describe('O21b POST /file-versions/create 属主闸门(行为级)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } })
    // 给真 part 的 toBuffer() 套一层计数器(实现仍是 @fastify/multipart 的)。
    server.addHook('onRequest', async (request) => {
      const original = (request as { file?: () => Promise<unknown> }).file
      if (typeof original !== 'function') return
      const bound = original.bind(request)
      Object.defineProperty(request, 'file', {
        value: async () => {
          const part = (await bound()) as Record<string, unknown> | null | undefined
          if (part && typeof part.toBuffer === 'function') {
            const realToBuffer = (part.toBuffer as () => Promise<Buffer>).bind(part)
            Object.defineProperty(part, 'toBuffer', {
              value: async () => {
                uploadCounter.toBufferCalls += 1
                return realToBuffer()
              },
              configurable: true,
              writable: true,
            })
          }
          return part
        },
        configurable: true,
        writable: true,
      })
    })
    await server.register(fileVersionRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    resetData()
  })

  describe('越权者(文件存在但不属于他)', () => {
    const attackerBody = [
      { name: 'fileId', content: FILE_ID },
      { name: 'changeLog', content: '越权写入' },
      { name: 'file', filename: 'spec.md', content: '攻击者的版本内容' },
    ]

    it('403 且文案与同族端点逐字一致', async () => {
      setMockUser(ATTACKER)
      allowUsers(OWNER)

      const res = await postCreate(server, attackerBody)

      expect(res.statusCode).toBe(403)
      expect(res.json()).toEqual({ code: 403, message: '无权访问该文件' })
      expect(res.body).not.toContain(CREATED_VERSION_ID)
      expect(res.body).not.toContain(VERSIONS_DIR)
      expect(res.body).not.toContain('uploads')
    })

    it('属主判定确实发生,且判的就是这一行 files(不是二次查询)', async () => {
      setMockUser(ATTACKER)
      allowUsers(OWNER)

      await postCreate(server, attackerBody)

      expect(mockCanAccessFile).toHaveBeenCalledTimes(1)
      expect(mockCanAccessFile).toHaveBeenCalledWith(ATTACKER, FILE_ROW)
      expect(mockFindFileById).toHaveBeenCalledTimes(1)
      expect(mockFindFileById).toHaveBeenCalledWith(FILE_ID)
    })

    it('零写盘 + 零版本行 + 连 multipart buffer 都没读(越权者不得先付磁盘代价)', async () => {
      setMockUser(ATTACKER)
      allowUsers(OWNER)

      await postCreate(server, attackerBody)

      expectNoSideEffects()
    })

    it('内容即便完全合法也照拦:攻击内容未进入任何下游(以 toBuffer=0 为证)', async () => {
      setMockUser(ATTACKER)
      allowUsers(OWNER)

      // 文件名与原文件一致、扩展名不在危险位 —— 唯一拦住它的就是属主闸门。
      await postCreate(server, [
        { name: 'fileId', content: FILE_ID },
        { name: 'changeLog', content: '伪装成正常版本' },
        { name: 'file', filename: 'spec.md', content: '正常内容正常扩展名' },
      ])

      expect(mockCanAccessFile).toHaveBeenCalledWith(ATTACKER, FILE_ROW)
      expectNoSideEffects()
    })

    it('项目成员名单里没有他 → 与"上传者列单判"结果一致(未误接 idorGuard 也拒成员)', async () => {
      setMockUser(MEMBER)
      allowUsers(OWNER) // 本次故意不把 MEMBER 放进允许集

      const res = await postCreate(server, attackerBody)

      expect(res.statusCode).toBe(403)
      expect(res.json()).toEqual({ code: 403, message: '无权访问该文件' })
      expectNoSideEffects()
    })
  })

  describe('边界:文件不存在 / 未登录 / 缺 fileId', () => {
    it('fileId 指向不存在的文件 → 404 且不给枚举 oracle,零副作用', async () => {
      setMockUser(ATTACKER)

      const res = await postCreate(server, [
        { name: 'fileId', content: '3f2a7c9e-1b4d-4e6f-8a9b-0c1d2e3f4a5c' },
        { name: 'file', filename: 'spec.md', content: 'x' },
      ])

      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ code: 404, message: '文件不存在' })
      expect(mockCanAccessFile).not.toHaveBeenCalled()
      expectNoSideEffects()
    })

    it('未登录 → 401,根本走不到属主判定,也不读 buffer', async () => {
      setMockUnauthorized()

      const res = await postCreate(server, [
        { name: 'fileId', content: FILE_ID },
        { name: 'file', filename: 'spec.md', content: 'x' },
      ])

      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({ code: 401, message: 'Authentication required' })
      expect(mockAuthenticate).toHaveBeenCalledTimes(1)
      expect(mockCanAccessFile).not.toHaveBeenCalled()
      expect(mockFindFileById).not.toHaveBeenCalled()
      expectNoSideEffects()
    })

    it('缺 fileId → 400 早退,不触发属主判定也不读 buffer', async () => {
      setMockUser(OWNER)

      const res = await postCreate(server, [{ name: 'file', filename: 'spec.md', content: 'x' }])

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ code: 400, message: 'fileId 为必填' })
      expect(mockCanAccessFile).not.toHaveBeenCalled()
      expectNoSideEffects()
    })
  })

  describe('正向:闸门不得误伤正当写入', () => {
    it('上传者本人 → 201,恰好一行版本 + 恰好一次落盘,字节与上传内容一致', async () => {
      setMockUser(OWNER)
      allowUsers(OWNER)
      const content = '第三次修订的正文内容'

      const res = await postCreate(server, [
        { name: 'fileId', content: FILE_ID },
        { name: 'changeLog', content: '第三次修订' },
        { name: 'file', filename: 'spec.md', content },
      ])

      expect(res.statusCode).toBe(201)
      const version = (res.json().data as { version: Record<string, unknown> }).version
      expect(version).toMatchObject({
        id: CREATED_VERSION_ID,
        fileId: FILE_ID,
        version: 4,
        size: Buffer.byteLength(content),
        uploadedBy: OWNER,
        changeLog: '第三次修订',
      })
      // 出口剥 path:响应里既没有 path 字段,也没有任何磁盘路径痕迹。
      expect(version).not.toHaveProperty('path')
      expect(res.body).not.toContain(VERSIONS_DIR)
      expect(res.body).not.toContain('uploads')

      // buffer 读了(闸门放行后才有资格付这个代价),且只读一次。
      expect(uploadCounter.toBufferCalls).toBe(1)
      expect(fsState.writes).toHaveLength(1)
      expect(fsState.writes[0]?.content).toBe(content)
      expect(fsState.writes[0]?.bytes).toBe(Buffer.byteLength(content))
      expect(fsState.writes[0]?.path.startsWith(VERSIONS_DIR)).toBe(true)

      expect(dbState.writes.insert).toBe(1)
      expect(dbState.insertedValues).toHaveLength(1)
      expect(dbState.insertedValues[0]).toMatchObject({
        fileId: FILE_ID,
        version: 4,
        size: Buffer.byteLength(content),
        uploadedBy: OWNER,
        changeLog: '第三次修订',
      })
      expect(fsState.unlinks).toHaveLength(0)
      expect(fsState.copies).toHaveLength(0)
    })

    it('项目成员(非上传者)→ 201 不被误伤,版本行记的是他本人', async () => {
      setMockUser(MEMBER)
      allowUsers(OWNER, MEMBER)

      const res = await postCreate(server, [
        { name: 'fileId', content: FILE_ID },
        { name: 'changeLog', content: '成员补充' },
        { name: 'file', filename: 'spec.md', content: '成员写的一行' },
      ])

      expect(res.statusCode).toBe(201)
      expect(mockCanAccessFile).toHaveBeenCalledWith(MEMBER, FILE_ROW)
      expect(dbState.insertedValues[0]).toMatchObject({ uploadedBy: MEMBER, fileId: FILE_ID })
      expect(fsState.writes).toHaveLength(1)
    })

    it('放行后才做类型校验:exe 投毒 → 400 且不写盘,files 行只查一次(闸门带回的就是下游用的)', async () => {
      setMockUser(OWNER)
      allowUsers(OWNER)

      const res = await postCreate(server, [
        { name: 'fileId', content: FILE_ID },
        { name: 'file', filename: 'payload.exe', content: 'MZ\u0090' },
      ])

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({
        code: 400,
        message: '版本文件扩展名(.exe)与原文件(.md)不一致',
      })
      // 证明下游用的是 checkFileAccess 带回的那一行,而不是再查一次(无 TOCTOU 二次查询)。
      expect(mockFindFileById).toHaveBeenCalledTimes(1)
      expect(uploadCounter.toBufferCalls).toBe(1)
      expect(fsState.writes).toHaveLength(0)
      expect(fsMocks.createWriteStream).not.toHaveBeenCalled()
      expect(dbState.writes.insert).toBe(0)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
