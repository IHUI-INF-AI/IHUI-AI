// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-412 回归锁(2026-11-13)。
 *
 * 病灶:对 uploads/private 下的私有文档 POST /api/files/:id/extract-assets 时,
 * 内嵌图片一律写入 UPLOAD_DIR(=uploads/public)并返回 /uploads/<uuid>.png,
 * 而 server.ts 的静态挂载只把 uploads/public 对外且无鉴权 ⇒ 持 URL 即可读私有合同/证件扫描图。
 *
 * 本文件锁:
 *   ① 私有源文档:资产落盘 uploads/private/assets/<owner>/,返回 /api/files/assets/<owner>/<file>,
 *      不再出现在 uploads/public,也不再返回 /uploads/ 匿名静态 URL;
 *   ② 该端点必须鉴权:无凭证 401、非属主 403、属主 200 且返回原始字节;
 *   ③ 文件名形态非法(路径穿越载荷)400;
 *   ④ 公开源文档保持原行为:仍写 uploads/public、仍返回 /uploads/<uuid>.png。
 *
 * 只 mock authenticate / DB / anydoc / sharp,用临时目录,不连 PG/Redis/网络。
 */
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

interface StubAsset {
  id: number
  mediaType: string
  originPart: string
  data: Buffer
}

const anydocState = vi.hoisted(() => ({ assets: [] as StubAsset[] }))

vi.mock('@firecrawl/anydoc', () => ({
  toMarkdown: async () => '# mock',
  toMarkdownBytes: async () => '# mock',
  formatFromPath: () => 'docx',
  formatFromBytes: () => 'docx',
  toDocument: async () => ({ assets: anydocState.assets, blocks: [], notes: [] }),
}))

vi.mock('../src/services/document-parser.js', () => ({
  MAX_FILE_SIZE: 20 * 1024 * 1024,
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { headers: Record<string, unknown>; userId?: string }) => {
    const auth = request.headers.authorization
    if (!auth) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = String(auth).replace(/^Bearer\s+/, '')
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

const FILE_ID = '3f1c2a10-9e3d-4b7a-8c5d-6e4f2a1b9c37'
const OWNER_ID = '9a7b6c50-1d2e-4f3a-8b9c-0d1e2f3a4b5c'
const OTHER_ID = '5c4b3a20-9e8d-4c1b-8a7f-6e5d4c3b2a19'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

describe('F-412 私有文档内嵌资产不得落入匿名公开目录', () => {
  let app: FastifyInstance
  let root = ''
  let privateDir = ''
  let publicDir = ''
  let privateSource = ''
  let publicSource = ''
  let cwdSpy: { mockReturnValue: (v: string) => unknown; mockRestore: () => void }

  const stubFile = (diskPath: string) => {
    vi.mocked(findFileById).mockResolvedValue({
      id: FILE_ID,
      projectId: '8f1c2a10-9e3d-4b7a-8c5d-6e4f2a1b9c37',
      name: basename(diskPath),
      path: diskPath,
      size: 1024,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uploadedBy: OWNER_ID,
      createdAt: new Date('2026-11-13T00:00:00Z'),
    } as never)
  }

  const extract = (auth: string | null = OWNER_ID) =>
    app.inject({
      method: 'POST',
      url: `/api/files/${FILE_ID}/extract-assets`,
      headers: auth ? { authorization: `Bearer ${auth}` } : {},
    })

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'f412-'))
    privateDir = join(root, 'uploads', 'private')
    publicDir = join(root, 'uploads', 'public')
    mkdirSync(privateDir, { recursive: true })
    mkdirSync(publicDir, { recursive: true })
    privateSource = join(privateDir, 'contract.docx')
    publicSource = join(publicDir, 'notice.docx')
    writeFileSync(privateSource, 'private-docx-content')
    writeFileSync(publicSource, 'public-docx-content')

    // 路由层的公开/私有目录均以 cwd 为基准,故在注册前把 cwd 指向临时根
    cwdSpy = vi.spyOn(process, 'cwd')
    cwdSpy.mockReturnValue(root)
    // 保证公开 URL 为相对形态,不受运行环境 CDN 配置影响
    vi.stubEnv('FILE_CDN_BASE', '')

    app = Fastify({ logger: false })
    await app.register(fileRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    cwdSpy.mockRestore()
    vi.unstubAllEnvs()
    rmSync(root, { recursive: true, force: true })
  })

  beforeEach(() => {
    anydocState.assets = [
      { id: 1, mediaType: 'image/png', originPart: 'word/media/image1.png', data: PNG },
    ]
  })

  it('① 私有文档:资产写入 uploads/private/assets/<owner>,URL 不再是 /uploads/ 匿名路径', async () => {
    stubFile(privateSource)

    const res = await extract()
    expect(res.statusCode).toBe(200)
    const asset = res.json().data.assets[0] as { url: string }
    const filename = asset.url.split('/').pop() ?? ''

    expect(asset.url).toMatch(
      new RegExp(`^/api/files/assets/${OWNER_ID}/[0-9a-f-]{36}\\.png$`, 'i'),
    )
    expect(asset.url.startsWith('/uploads/')).toBe(false)

    // 落盘在私有目录,而不是公开静态目录
    const privateAssetDir = join(privateDir, 'assets', OWNER_ID)
    expect(existsSync(join(privateAssetDir, filename))).toBe(true)
    expect(readdirSync(privateAssetDir)).toEqual([filename])
    // 公开目录里只有测试预置的源文档,没有任何提取出的资产
    expect(readdirSync(publicDir).filter((f) => f.endsWith('.png'))).toEqual([])
  })

  it('② 鉴权读取:属主 200 拿到原始字节,无凭证 401,非属主 403', async () => {
    stubFile(privateSource)
    const res = await extract()
    const url = (res.json().data.assets[0] as { url: string }).url

    const owner = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${OWNER_ID}` },
    })
    expect(owner.statusCode).toBe(200)
    expect(owner.headers['content-type']).toContain('image/png')
    expect(owner.headers['cache-control']).toContain('private')
    expect(owner.rawPayload.equals(PNG)).toBe(true)

    const anonymous = await app.inject({ method: 'GET', url })
    expect(anonymous.statusCode).toBe(401)

    const other = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${OTHER_ID}` },
    })
    expect(other.statusCode).toBe(403)
  })

  it('③ 文件名不符合 UUID+扩展名形态(路径穿越载荷)一律 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/files/assets/${OWNER_ID}/..%2F..%2Fsecret.png`,
      headers: { authorization: `Bearer ${OWNER_ID}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('④ 公开文档保持原行为:仍写 uploads/public,仍返回 /uploads/<uuid>.png', async () => {
    stubFile(publicSource)

    const res = await extract()
    expect(res.statusCode).toBe(200)
    const asset = res.json().data.assets[0] as { url: string }
    const filename = asset.url.split('/').pop() ?? ''

    expect(asset.url).toBe(`/uploads/${filename}`)
    expect(existsSync(join(publicDir, filename))).toBe(true)
  })
})
