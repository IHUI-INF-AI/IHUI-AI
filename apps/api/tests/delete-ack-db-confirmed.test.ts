// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-09-27 第二十七批「删除 ack 的一跳委托」的 1:1 回归。
//
// 钉的是这一型:`db.delete()` 住在**另一个文件**的被委托函数里且原来返回 Promise<void>,
// 路由却写 `deleted: true` —— 那个 true 是代码常量,不是数据库答复。删 0 行(并发删除、
// 已在回收站、id 根本不存在)与删除成功在响应上完全同形,是静默失真。
//
// 本票把 6 处委托函数改成回报「库确认命中的 id 集合」,路由侧的布尔必须由该集合派生。
// 用例刻意从**两侧**各钉一次:命中集合非空 ⇒ deleted:true;命中集合为空 ⇒ deleted:false。
// 后半句才是这张票的产出 —— 旧实现下它恒为 true,所以旧代码永远绿。
//
// 为什么用 vi.mock 替被委托函数而不是假 db 链:本票要判的是「路由凭什么说删成了」,
// 委托函数内部已经由 `.returning({ id })` 直接回报库侧集合(与 utils/batch-outcome.ts 同口径),
// 那一跳在 apps/api/tests/*.real.test.ts 里由真库覆盖(本机 PG :8810 不可达,已如实登记)。
//
// 既有响应键名逐字不变:这 6 处 data 只有 `deleted` 一个键,既不新增也不改名(批量端点的
// missedIds 属另一族,见 tests/user-batch-write-confirmed.test.ts)。

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

const { mockAuthenticate, mockCheckAuth, edu, ws } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockCheckAuth: vi.fn(),
  // edu-public.ts 从 db/edu-extended-queries.js 具名导入的每一个出口都必须在场,
  // 否则 vitest 的工厂替身会抛 "No X export is defined on the mock"(不是没调用就没事)。
  edu: {
    findNotesList: vi.fn(),
    findNoteById: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    findOfflineRecordsList: vi.fn(),
    findOfflineRecordById: vi.fn(),
    createOfflineRecord: vi.fn(),
    updateOfflineRecord: vi.fn(),
    deleteOfflineRecord: vi.fn(),
    findUploadedCertsList: vi.fn(),
    findUploadedCertById: vi.fn(),
    createUploadedCert: vi.fn(),
    deleteUploadedCert: vi.fn(),
    findUploadedPapersList: vi.fn(),
    findUploadedPaperById: vi.fn(),
    createUploadedPaper: vi.fn(),
    deleteUploadedPaper: vi.fn(),
  },
  // workspace.ts 从 db/workspace-queries.js 具名导入的每一个出口同理。
  ws: {
    listProjectsByUserWithFileCount: vi.fn(),
    findProjectById: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    listFilesByProject: vi.fn(),
    findFileById: vi.fn(),
    findFileByIdIncludeTrashed: vi.fn(),
    createFile: vi.fn(),
    softDeleteFile: vi.fn(),
    restoreFile: vi.fn(),
    hardDeleteFile: vi.fn(),
    findTrashedFiles: vi.fn(),
    batchSoftDelete: vi.fn(),
    batchRestore: vi.fn(),
    findFileVersions: vi.fn(),
    listProjectsByUser: vi.fn(),
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  checkAuth: (...args: unknown[]) => mockCheckAuth(...args),
  requireActiveUser: vi.fn(),
}))

vi.mock('../src/db/edu-extended-queries.js', () => edu)
vi.mock('../src/db/workspace-queries.js', () => ws)

import { eduPublicRoutes } from '../src/routes/edu-public.js'
import { workspaceRoutes } from '../src/routes/workspace.js'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const ROW_ID = '11111111-1111-4111-8111-111111111111'

/** eduPublicRoutes 用 preHandler + checkAuth;workspaceRoutes 用路由体内 authenticate。 */
function authedAs(userId: string) {
  mockAuthenticate.mockImplementation(async (request: { userId?: string }) => {
    request.userId = userId
  })
  mockCheckAuth.mockImplementation(async (request: { userId?: string }) => {
    request.userId = userId
    return true
  })
}

/** 六个站点的描述:路由 + 前置归属预查询该喂什么 + 委托函数名。 */
const SITES: Array<{
  name: string
  method: 'DELETE'
  url: string
  pre: () => void
  delegate: (rows: string[]) => void
}> = [
  {
    name: 'DELETE /api/edu/notes/:id → deleteNote',
    method: 'DELETE',
    url: `/api/edu/notes/${ROW_ID}`,
    pre: () => edu.findNoteById.mockResolvedValue({ id: ROW_ID, userId: USER_ID }),
    delegate: (rows) => edu.deleteNote.mockResolvedValue(rows),
  },
  {
    name: 'DELETE /api/edu/uploaded-certs/:id → deleteUploadedCert',
    method: 'DELETE',
    url: `/api/edu/uploaded-certs/${ROW_ID}`,
    pre: () => edu.findUploadedCertById.mockResolvedValue({ id: ROW_ID, userId: USER_ID }),
    delegate: (rows) => edu.deleteUploadedCert.mockResolvedValue(rows),
  },
  {
    name: 'DELETE /api/edu/offline-records/:id → deleteOfflineRecord',
    method: 'DELETE',
    url: `/api/edu/offline-records/${ROW_ID}`,
    pre: () => edu.findOfflineRecordById.mockResolvedValue({ id: ROW_ID, userId: USER_ID }),
    delegate: (rows) => edu.deleteOfflineRecord.mockResolvedValue(rows),
  },
  {
    name: 'DELETE /api/edu/papers/:id → deleteUploadedPaper',
    method: 'DELETE',
    url: `/api/edu/papers/${ROW_ID}`,
    pre: () => edu.findUploadedPaperById.mockResolvedValue({ id: ROW_ID, userId: USER_ID }),
    delegate: (rows) => edu.deleteUploadedPaper.mockResolvedValue(rows),
  },
  {
    name: 'DELETE /api/projects/:id → deleteProject',
    method: 'DELETE',
    url: `/api/projects/${ROW_ID}`,
    pre: () => {
      ws.findProjectById.mockResolvedValue({ id: ROW_ID, userId: USER_ID })
      // 路由在删除前会逐条清磁盘,给空集合 ⇒ 不碰文件系统。
      ws.listFilesByProject.mockResolvedValue([])
    },
    delegate: (rows) => ws.deleteProject.mockResolvedValue(rows),
  },
  {
    name: 'DELETE /api/files/:id → softDeleteFile(软删,布尔须由 UPDATE ... RETURNING 命中集派生)',
    method: 'DELETE',
    url: `/api/files/${ROW_ID}`,
    pre: () => {
      ws.findFileById.mockResolvedValue({ id: ROW_ID, projectId: 'p-1', path: '/tmp/none' })
      ws.findProjectById.mockResolvedValue({ id: 'p-1', userId: USER_ID })
    },
    delegate: (rows) => ws.softDeleteFile.mockResolvedValue(rows),
  },
]

describe('删除端点的 ack 必须由库确认的命中集合派生(一跳委托)', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    await server.register(eduPublicRoutes, { prefix: '/api' })
    await server.register(workspaceRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    for (const m of Object.values({ ...edu, ...ws })) m.mockReset()
    authedAs(USER_ID)
  })

  for (const site of SITES) {
    describe(site.name, () => {
      it('库侧回报命中集合非空 → 200 + deleted:true', async () => {
        site.pre()
        site.delegate([ROW_ID])
        const res = await server.inject({ method: site.method, url: site.url })
        expect(res.statusCode).toBe(200)
        const body = res.json()
        expect(body.data.deleted).toBe(true)
        // 既有键名逐字不变:这 6 处的 data 仍然只有 deleted。
        expect(Object.keys(body.data)).toEqual(['deleted'])
      })

      it('库侧回报空集合(删 0 行)→ 200 + deleted:false', async () => {
        site.pre()
        site.delegate([])
        const res = await server.inject({ method: site.method, url: site.url })
        expect(res.statusCode).toBe(200)
        const body = res.json()
        // 旧实现到这里仍然回 deleted:true —— 那正是本票要钉死的谎报。
        expect(body.data.deleted).toBe(false)
        expect(Object.keys(body.data)).toEqual(['deleted'])
      })
    })
  }

  it('前置 404/403 语义未被改动:归属预查询判为别人的行 → 403 且不进删除链', async () => {
    edu.findNoteById.mockResolvedValue({ id: ROW_ID, userId: 'someone-else' })
    const res = await server.inject({ method: 'DELETE', url: `/api/edu/notes/${ROW_ID}` })
    expect(res.statusCode).toBe(403)
    expect(edu.deleteNote).not.toHaveBeenCalled()
  })

  it('前置 404 语义未被改动:归属预查询查不到 → 404 且不进删除链', async () => {
    edu.findNoteById.mockResolvedValue(undefined)
    const res = await server.inject({ method: 'DELETE', url: `/api/edu/notes/${ROW_ID}` })
    expect(res.statusCode).toBe(404)
    expect(edu.deleteNote).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
