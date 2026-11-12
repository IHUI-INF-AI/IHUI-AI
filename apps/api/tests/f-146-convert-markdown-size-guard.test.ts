// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-146 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/files/:id/convert-markdown 与 /extract-assets 把 100MB 文件同步全量读;
 * 资产提取是「先 readFileSync 读完、再比 20MB」;pptx 降级路径一次性 inflate 全部 ZIP 条目。
 *
 * 本文件锁:
 *   ① 超限文件在读入之前就被 stat 拒绝(413、明确文案),readFile 一次都不许调用;
 *   ② 资产提取同样先判大小再读,超限同样 413 且文案点名「提取内嵌资产」;
 *   ③ 正常大小仍走原成功路径(200 + markdown),且 stat 早于 readFile。
 *
 * 只 mock authenticate / db / node:fs/promises,不写真实大文件、不触达真实 PG。
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type * as FsPromises from 'node:fs/promises'

const MB = 1024 * 1024

const fsMock = vi.hoisted(() => ({
  readFile: vi.fn(async () => ''),
  stat: vi.fn(async () => ({ size: 0, isFile: () => true })),
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>()
  return { ...actual, readFile: fsMock.readFile, stat: fsMock.stat }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'f146-user'
  }),
}))

vi.mock('../src/db/workspace-queries.js', () => ({
  findFileById: vi.fn(),
}))

vi.mock('../src/db/file-queries.js', () => ({
  searchFiles: vi.fn(),
  canAccessFile: vi.fn(async () => true),
  createShare: vi.fn(),
  findShareByToken: vi.fn(),
  deleteShare: vi.fn(),
  findRecentFiles: vi.fn(),
}))

vi.mock('../src/db/social-queries.js', () => ({
  findTagsByTarget: vi.fn(async () => []),
  attachTag: vi.fn(),
  detachTag: vi.fn(),
}))

vi.mock('sharp', () => ({ default: vi.fn() }))

import { fileRoutes } from '../src/routes/files.js'
import { findFileById } from '../src/db/workspace-queries.js'

const FILE_ID = '7f1c2a10-9e3d-4b7a-8c5d-6e4f2a1b9c37'

describe('F-146 /files/:id/convert-markdown 与 extract-assets 读入前体积闸', () => {
  let app: FastifyInstance
  let dir = ''
  let diskPath = ''

  const stubFile = (name: string) => {
    vi.mocked(findFileById).mockResolvedValue({
      id: FILE_ID,
      projectId: '8f1c2a10-9e3d-4b7a-8c5d-6e4f2a1b9c37',
      name,
      path: diskPath,
      size: 1024,
      mimeType: 'application/octet-stream',
      uploadedBy: 'f146-user',
      createdAt: new Date('2026-11-13T00:00:00Z'),
    } as never)
  }

  const inject = (action: 'convert-markdown' | 'extract-assets') =>
    app.inject({ method: 'POST', url: `/api/files/${FILE_ID}/${action}` })

  beforeAll(async () => {
    // 真实小文件只用来让 existsSync/resolveDiskPath 命中;体积由 mock 的 stat 决定
    dir = mkdtempSync(join(tmpdir(), 'f146-'))
    diskPath = join(dir, 'probe')
    writeFileSync(diskPath, 'x')

    app = Fastify({ logger: false })
    await app.register(fileRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  })

  beforeEach(() => {
    fsMock.readFile.mockReset()
    fsMock.stat.mockReset()
    // 默认:正常大小 + 可读内容
    fsMock.stat.mockResolvedValue({ size: 1024, isFile: () => true })
    fsMock.readFile.mockResolvedValue('# 标题\n\n正文')
    stubFile('probe.md')
  })

  it('① 超限文件:stat 在读入前拒绝,413 且 readFile 从未被调用', async () => {
    fsMock.stat.mockResolvedValue({ size: 30 * MB, isFile: () => true })

    const res = await inject('convert-markdown')

    expect(res.statusCode).toBe(413)
    expect(res.json()).toEqual({ code: 413, message: '文件超过 20MB 上限,无法转换' })
    expect(fsMock.stat).toHaveBeenCalledTimes(1)
    expect(fsMock.readFile).not.toHaveBeenCalled()
  })

  it('② 资产提取:同样先判大小,超限 413 且 readFile 从未被调用', async () => {
    stubFile('probe.docx')
    fsMock.stat.mockResolvedValue({ size: 30 * MB, isFile: () => true })

    const res = await inject('extract-assets')

    expect(res.statusCode).toBe(413)
    expect(res.json()).toEqual({
      code: 413,
      message: '文件超过 20MB 上限,无法提取内嵌资产',
    })
    expect(fsMock.readFile).not.toHaveBeenCalled()
  })

  it('③ 正常大小仍走原成功路径,且 stat 早于 readFile', async () => {
    const res = await inject('convert-markdown')

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      code: 0,
      message: 'success',
      data: { markdown: '# 标题\n\n正文', fileName: 'probe.md' },
    })
    expect(fsMock.readFile).toHaveBeenCalledTimes(1)
    const statOrder = fsMock.stat.mock.invocationCallOrder[0]!
    const readOrder = fsMock.readFile.mock.invocationCallOrder[0]!
    expect(statOrder).toBeLessThan(readOrder)
  })
})
