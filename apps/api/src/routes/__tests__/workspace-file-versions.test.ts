// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const q = vi.hoisted(() => ({
  findFileById: vi.fn(),
  findFileVersions: vi.fn(),
  getLatestVersion: vi.fn(),
  createFileVersion: vi.fn(),
  updateFileStorage: vi.fn(),
  canAccessFile: vi.fn(),
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = 'u1'
  },
}))

vi.mock('../../db/index.js', () => ({ db: {} }))

vi.mock('../../db/workspace-queries.js', () => ({
  listProjectsByUserWithFileCount: vi.fn(),
  findProjectById: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  listFilesByProject: vi.fn(),
  listFilesByProjectIncludeTrashed: vi.fn(),
  findFileById: q.findFileById,
  findFileByIdIncludeTrashed: vi.fn(),
  createFile: vi.fn(),
  softDeleteFile: vi.fn(),
  restoreFile: vi.fn(),
  hardDeleteFile: vi.fn(),
  findTrashedFiles: vi.fn(),
  batchSoftDelete: vi.fn(),
  batchRestore: vi.fn(),
  findFileOwnershipBatch: vi.fn(),
  findFileVersions: q.findFileVersions,
  getLatestVersion: q.getLatestVersion,
  createFileVersion: q.createFileVersion,
  updateFileStorage: q.updateFileStorage,
}))

vi.mock('../../db/file-queries.js', () => ({ canAccessFile: q.canAccessFile }))

vi.mock('../../plugins/resilience-extended.js', () => ({
  getBulkhead: () => ({ execute: <T>(fn: () => Promise<T>) => fn() }),
}))

vi.mock('../../utils/file-type-validator.js', () => ({
  validateUploadFile: () => ({ ok: true }),
}))

import { workspaceRoutes } from '../workspace.js'

const FILE_ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  name: '合同.txt',
  path: '/tmp/original-blob',
  size: 12,
  mimeType: 'text/plain',
  uploadedBy: 'u1',
  createdAt: new Date('2026-11-01T00:00:00Z'),
  deletedAt: null,
  deletedBy: null,
}

describe('POST /files/:id/versions(版本链写路径)', () => {
  let app: FastifyInstance
  let tmp: string

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } })
    await app.register(workspaceRoutes, { prefix: '/api/workspace' })
    await app.ready()
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-version-'))
  })

  afterAll(async () => {
    await app.close()
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    q.findFileById.mockResolvedValue(FILE_ROW)
    q.canAccessFile.mockResolvedValue(true)
    q.getLatestVersion.mockResolvedValue(0)
    q.findFileVersions.mockResolvedValue([])
    q.createFileVersion.mockImplementation(async (data: { version: number }) => ({
      id: `version-${data.version}`,
      fileId: FILE_ROW.id,
      version: data.version,
      size: 1,
      path: '/tmp/new',
      uploadedBy: 'u1',
      changeLog: null,
      createdAt: new Date(),
    }))
    q.updateFileStorage.mockImplementation(
      async (_id: string, data: { path: string; size: number; mimeType: string }) => ({
        ...FILE_ROW,
        ...data,
      }),
    )
  })

  it('首次上传新版本:补 v1 基线 + 追加 v2,文件行指针指向新 blob', async () => {
    const form = new FormData()
    form.append('changeLog', 'AI 修订稿:采纳 2/3 处')
    form.append('file', new File(['修订后的合同正文'], '合同.txt', { type: 'text/plain' }))
    const request = new Request('http://local/api/workspace/files/x/versions', {
      method: 'POST',
      body: form,
    })
    const payload = Buffer.from(await request.arrayBuffer())

    const res = await app.inject({
      method: 'POST',
      url: `/api/workspace/files/${FILE_ROW.id}/versions`,
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
      payload,
    })

    expect(res.statusCode).toBe(201)
    const body = res.json() as {
      code: number
      data: { version: { version: number }; file: { size: number } }
    }
    expect(body.code).toBe(0)
    expect(body.data.version.version).toBe(2)
    expect(q.createFileVersion).toHaveBeenCalledTimes(2)
    expect(q.createFileVersion.mock.calls[0]![0]).toMatchObject({ version: 1, path: FILE_ROW.path })
    expect(q.createFileVersion.mock.calls[1]![0]).toMatchObject({
      version: 2,
      changeLog: 'AI 修订稿:采纳 2/3 处',
    })
    expect(q.updateFileStorage).toHaveBeenCalledTimes(1)
    const updated = q.updateFileStorage.mock.calls[0]![1] as { size: number }
    expect(updated.size).toBeGreaterThan(0)
  })

  it('已有历史时直接追加 latest+1,不重复写基线', async () => {
    q.getLatestVersion.mockResolvedValue(4)
    const form = new FormData()
    form.append('file', new File(['v5'], '合同.txt', { type: 'text/plain' }))
    const request = new Request('http://local/api/workspace/files/x/versions', {
      method: 'POST',
      body: form,
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/workspace/files/${FILE_ROW.id}/versions`,
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
      payload: Buffer.from(await request.arrayBuffer()),
    })
    expect(res.statusCode).toBe(201)
    expect(q.createFileVersion).toHaveBeenCalledTimes(1)
    expect(q.createFileVersion.mock.calls[0]![0]).toMatchObject({ version: 5 })
  })

  it('GET /versions/:version/content 回读旧版本字节', async () => {
    const oldPath = path.join(tmp, 'v1.txt')
    fs.writeFileSync(oldPath, '第一版正文')
    q.findFileVersions.mockResolvedValue([
      {
        id: 'v2',
        fileId: FILE_ROW.id,
        version: 2,
        size: 5,
        path: '/tmp/v2.txt',
        uploadedBy: 'u1',
        changeLog: null,
        createdAt: new Date(),
      },
      {
        id: 'v1',
        fileId: FILE_ROW.id,
        version: 1,
        size: 5,
        path: oldPath,
        uploadedBy: 'u1',
        changeLog: null,
        createdAt: new Date(),
      },
    ])
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/files/${FILE_ROW.id}/versions/1/content`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('第一版正文')
  })

  it('非属主访问版本内容 → 403', async () => {
    q.canAccessFile.mockResolvedValue(false)
    const res = await app.inject({
      method: 'GET',
      url: `/api/workspace/files/${FILE_ROW.id}/versions/1/content`,
    })
    expect(res.statusCode).toBe(403)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
