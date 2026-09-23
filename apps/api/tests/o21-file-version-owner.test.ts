// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O21 ②(2026-09-23 安全 P0)回归钉:文件版本面的属主谓词 + 出口剥 path。
 *
 * 实测根因(逐行取证见 PROJECT_PLAN.md O21 ②):
 * - `routes/file-version.ts:165/179/197/214/260/293` 与 `routes/workspace.ts:502/520`
 *   共 8 个端点只有 `checkAuth`/`requireAuth`,**既不判属主也不判项目成员**;
 * - `serializeVersion` 还把服务端磁盘绝对路径 `path` 直接回显;
 * - 最重的一处是回滚端点 —— 它会 `update files set path = newPath where id = target.fileId`,
 *   等于任意登录用户可把**他人文件的当前内容**换成自己指定的版本,删除端点还会 `unlinkSync` 他人文件。
 *
 * 修法口径(照 O21 ② 原文,不自行扩档):8 处统一走现网既有谓词
 * `canAccessFile`(上传者 ∪ 项目 owner ∪ project_members),**不挂 `idorGuard('file')`**
 * (它以 `files.uploadedBy` 单列判定,该列 `onDelete:'set null'` 可空,比现网模型更弱,
 * 硬接会把正常共享成员打成 403);出口一律剥 `path`。
 *
 * 判据是"越权拿不到别人的行",不是"返回 200":
 * 每个端点都断言 ① 跨属主 → 403 且响应体不含版本数据 ② 写副作用(insert/update/delete)
 * 一次都没发生 ③ 属主本人仍能读到,且任何响应里都不出现磁盘路径。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import {
  mockAuthenticate,
  mockCheckAuth,
  setMockUser,
  setMockUnauthorized,
} from './helpers/mock-auth.js'

const OWNER = 'user-owner-uuid'
const MEMBER = 'user-member-uuid'
const ATTACKER = 'user-attacker-uuid'
// workspace 侧参数走 z.uuid()(zod 4 按 RFC 9562 校验 version/variant 位),故用真 v4 形态。
const FILE_ID = '3f2a7c9e-1b4d-4e6f-8a9b-0c1d2e3f4a5b'
const VERSION_ID = '7b6e5d4c-3a2b-4c1d-9e8f-0a1b2c3d4e5f'
/** 只在 mock 的行数据里出现:任何一次响应命中它即视为磁盘路径外泄。 */
const DISK_PATH = '/srv/ihui/uploads/private/versions/leak-canary'

const { mockCanAccessFile, mockFindFileById, mockFindFileVersions, dbState, db } = vi.hoisted(
  () => {
    const state = {
      rows: [] as unknown[],
      writes: { insert: 0, update: 0, delete: 0 },
    }
    const chain = (getValue: () => unknown) => {
      const node: Record<string, unknown> = {
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ): Promise<unknown> => Promise.resolve(getValue()).then(resolve, reject),
      }
      for (const m of [
        'from',
        'where',
        'orderBy',
        'limit',
        'offset',
        'values',
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
    return {
      dbState: state,
      db: {
        select: vi.fn(() => chain(() => state.rows)),
        insert: vi.fn(() => {
          state.writes.insert += 1
          return chain(() => [{ id: 'created-version-uuid' }])
        }),
        update: vi.fn(() => {
          state.writes.update += 1
          return chain(() => [])
        }),
        delete: vi.fn(() => {
          state.writes.delete += 1
          return chain(() => [])
        }),
      },
      mockCanAccessFile: vi.fn<(userId: string, file: unknown) => Promise<boolean>>(),
      mockFindFileById: vi.fn(),
      mockFindFileVersions: vi.fn(),
    }
  },
)

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
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

// 现网谓词本体走 real-db 测试(tests/file-queries.real.test.ts);此处只钉"路由是否调用它、
// 用什么参数调用",故 mock 掉它对 db 的读写,避免 mock 查询构造器与真实 SQL 纠缠。
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
    findFileVersions: mockFindFileVersions,
    listProjectsByUser: noop,
  }
})

import { fileVersionRoutes } from '../src/routes/file-version.js'
import { workspaceRoutes } from '../src/routes/workspace.js'
import fileVersionSrc from '../src/routes/file-version.ts?raw'
import workspaceSrc from '../src/routes/workspace.ts?raw'

const FILE_ROW = { id: FILE_ID, projectId: 'project-uuid', name: 'spec.md', uploadedBy: OWNER }
const VERSION_ROW = {
  id: VERSION_ID,
  fileId: FILE_ID,
  version: 3,
  size: 1234,
  path: DISK_PATH,
  uploadedBy: OWNER,
  changeLog: '第三次修订',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
}

/** 现网模型:上传者 ∪ 项目 owner ∪ project_members。 */
function allowUsers(...userIds: string[]): void {
  mockCanAccessFile.mockImplementation(async (userId: string) => userIds.includes(userId))
}

function resetData(): void {
  dbState.rows = [VERSION_ROW]
  dbState.writes.insert = 0
  dbState.writes.update = 0
  dbState.writes.delete = 0
  mockFindFileById.mockImplementation(async (id: string) => (id === FILE_ID ? FILE_ROW : undefined))
  mockFindFileVersions.mockResolvedValue([VERSION_ROW])
}

describe('O21② 文件版本面属主谓词', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(fileVersionRoutes, { prefix: '/api' })
    await server.register(workspaceRoutes, { prefix: '/api/workspace' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    resetData()
  })

  // 8 个受控端点:O21 ② 实测清单原样列出,一条不漏。
  const guarded: Array<{ name: string; method: 'GET' | 'POST' | 'DELETE'; url: string }> = [
    { name: 'list', method: 'GET', url: `/api/file-versions/list/${FILE_ID}` },
    { name: 'current', method: 'GET', url: `/api/file-versions/current/${FILE_ID}` },
    { name: 'detail', method: 'GET', url: `/api/file-versions/${VERSION_ID}` },
    { name: 'rollback', method: 'POST', url: `/api/file-versions/rollback/${VERSION_ID}` },
    { name: 'delete', method: 'DELETE', url: `/api/file-versions/${VERSION_ID}` },
    { name: 'compare', method: 'GET', url: `/api/file-versions/compare/${FILE_ID}?v1=1&v2=2` },
    { name: 'workspace-versions', method: 'GET', url: `/api/workspace/files/${FILE_ID}/versions` },
    {
      name: 'workspace-version-one',
      method: 'GET',
      url: `/api/workspace/files/${FILE_ID}/versions/3`,
    },
  ]

  describe.each(guarded)('$name:跨属主不得读到别人的版本', ({ method, url }) => {
    it('非成员访问 → 403,响应体不含版本数据', async () => {
      setMockUser(ATTACKER)
      allowUsers(OWNER)

      const res = await server.inject({ method, url })

      expect(res.statusCode).toBe(403)
      expect(res.json()).toEqual({ code: 403, message: '无权访问该文件' })
      expect(res.body).not.toContain(VERSION_ID)
      expect(res.body).not.toContain(DISK_PATH)
      expect(mockCanAccessFile).toHaveBeenCalledWith(ATTACKER, FILE_ROW)
    })

    it('越权请求不得产生任何写副作用(不落版本行、不改 files 指向、不删版本)', async () => {
      setMockUser(ATTACKER)
      allowUsers(OWNER)

      await server.inject({ method, url })

      expect(dbState.writes.insert).toBe(0)
      expect(dbState.writes.update).toBe(0)
      expect(dbState.writes.delete).toBe(0)
    })

    it('未登录 → 401,且根本走不到属主判定', async () => {
      setMockUnauthorized()

      const res = await server.inject({ method, url })

      expect(res.statusCode).toBe(401)
      expect(mockCanAccessFile).not.toHaveBeenCalled()
    })
  })

  it('上传者本人仍能读到版本清单(谓词未误伤正当流程)', async () => {
    setMockUser(OWNER)
    allowUsers(OWNER)

    const res = await server.inject({ method: 'GET', url: `/api/file-versions/list/${FILE_ID}` })

    expect(res.statusCode).toBe(200)
    const versions = res.json().data.versions as Array<Record<string, unknown>>
    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({ id: VERSION_ID, fileId: FILE_ID, version: 3 })
  })

  it('项目成员(非上传者)仍可读到 —— 未退化成 idorGuard 的单列判定', async () => {
    setMockUser(MEMBER)
    allowUsers(OWNER, MEMBER)

    const res = await server.inject({
      method: 'GET',
      url: `/api/workspace/files/${FILE_ID}/versions`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.list).toHaveLength(1)
  })

  it('出口剥 path:两侧版本端点都不回显磁盘绝对路径', async () => {
    setMockUser(OWNER)
    allowUsers(OWNER)

    const legacy = await server.inject({
      method: 'GET',
      url: `/api/file-versions/current/${FILE_ID}`,
    })
    expect(legacy.statusCode).toBe(200)
    expect(legacy.json().data.version).not.toHaveProperty('path')
    expect(legacy.body).not.toContain(DISK_PATH)

    const workspace = await server.inject({
      method: 'GET',
      url: `/api/workspace/files/${FILE_ID}/versions/3`,
    })
    expect(workspace.statusCode).toBe(200)
    expect(workspace.json().data.version).not.toHaveProperty('path')
    expect(workspace.body).not.toContain(DISK_PATH)
  })

  it('文件不存在 → 404,不给枚举 oracle;文件行缺失时也不进业务查询', async () => {
    setMockUser(ATTACKER)
    mockFindFileById.mockResolvedValue(undefined)

    const res = await server.inject({ method: 'GET', url: `/api/file-versions/list/${FILE_ID}` })

    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 404, message: '文件不存在' })
    expect(res.body).not.toContain(VERSION_ID)
    expect(mockCanAccessFile).not.toHaveBeenCalled()
  })

  it('版本行不存在 → 404 版本不存在(先定位版本,再判属主)', async () => {
    setMockUser(ATTACKER)
    dbState.rows = []
    allowUsers(OWNER)

    const res = await server.inject({
      method: 'GET',
      url: '/api/file-versions/non-existent-version',
    })

    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 404, message: '版本不存在' })
    expect(mockCanAccessFile).not.toHaveBeenCalled()
  })
})

describe('O21② 结构钉(防"改了又漂回去")', () => {
  it('file-version.ts 7 个端点各自调用 checkFileAccess,且 userId 取自已鉴权的 request.userId', () => {
    // 6 → 7:第 7 处是 O21b 补的 POST /file-versions/create。此前它只判"文件存在",
    // 任意登录用户可向他人 fileId 写版本行并落盘 —— O21 ② 的实测清单漏了这条路由。
    expect(fileVersionSrc.match(/checkFileAccess\(request\.userId!/g)).toHaveLength(7)
  })

  it('create 的属主闸门必须排在读 multipart buffer 之前(越权者不得先付磁盘代价)', () => {
    const gate = fileVersionSrc.indexOf(
      'const access = await checkFileAccess(request.userId!, fileId)',
    )
    const readBuffer = fileVersionSrc.indexOf('await data.toBuffer()')
    expect(gate).toBeGreaterThan(-1)
    expect(readBuffer).toBeGreaterThan(-1)
    // create 是唯一读 buffer 的端点,故全文件首个闸门必须先于首个 buffer 读取。
    expect(gate).toBeLessThan(readBuffer)
  })

  it('workspace.ts 2 个版本端点都判 canAccessFile', () => {
    expect(workspaceSrc.match(/canAccessFile\(request\.userId, file\)/g)).toHaveLength(2)
  })

  it('serializeVersion / serializeFileVersion 不得再输出 path', () => {
    expect(fileVersionSrc).not.toMatch(/path: v\.path/)
    expect(workspaceSrc).not.toMatch(/path: v\.path/)
  })

  it('两侧出口不得把整行原样倒给客户端', () => {
    expect(workspaceSrc).not.toMatch(/success\(\{ list: versions \}\)/)
    expect(workspaceSrc).not.toMatch(/success\(\{ version \}\)/)
  })

  it('按 O21 ② 口径禁用 idorGuard(单列模型比现网更弱)', () => {
    // 只钉"有没有装上":源码注释里会点名 idorGuard 说明为何不用它,不能作为判据。
    expect(fileVersionSrc).not.toMatch(/from ['"][^'"]*idor-guard/)
    expect(workspaceSrc).not.toMatch(/from ['"][^'"]*idor-guard/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
