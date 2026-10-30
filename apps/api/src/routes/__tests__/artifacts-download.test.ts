// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)
 */

/**
 * G3 交付物导出端点测试(GET /api/artifacts/:id/download)。
 * 覆盖:归属 404 / fmt 矩阵 / checksum 复验 / 渲染体断言。
 * fixture 经 process.env.ARTIFACTS_DIR 重定向到临时目录,不碰仓库根 tmp/。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async () => ({ userId: 'owner-user' }) as never),
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

import { artifactRoutes } from '../artifacts.js'

const OWNER = 'owner-user'

function sha256Hex(text: string): string {
  return createHash('sha256').update(Buffer.from(text, 'utf-8')).digest('hex')
}

/** kind → 落盘扩展名(与 shared ARTIFACT_EXT_BY_KIND 同步;测试独立不引常量,防同源盲区)。 */
const EXT_BY_KIND: Record<string, string> = {
  html_report: 'html',
  slides: 'json',
  sheet: 'json',
  doc: 'md',
  video_ref: 'json',
}

let fixtureRoot = ''

interface FixtureOpts {
  id: string
  kind: 'html_report' | 'slides' | 'sheet' | 'doc' | 'video_ref'
  payload: string
  title?: string
  version?: number
  owner?: string
  writePayload?: boolean
  checksumOverride?: string
}

/** 在临时目录内落一份 ai-service create_artifact 同形的产物目录结构。 */
function writeFixture(opts: FixtureOpts): void {
  const version = opts.version ?? 1
  const dir = join(fixtureRoot, opts.id)
  mkdirSync(dir, { recursive: true })
  const ext = EXT_BY_KIND[opts.kind]!
  if (opts.writePayload !== false) {
    writeFileSync(join(dir, `v${version}.${ext}`), opts.payload, 'utf-8')
  }
  const now = new Date().toISOString()
  const record = {
    id: opts.id,
    kind: opts.kind,
    title: opts.title ?? '测试交付物',
    version,
    session_id: 'sess-1',
    turn_anchor: { message_id: 'msg-1' },
    payload_ref: `tmp/artifacts/${opts.id}/v${version}.${ext}`,
    mime: opts.kind === 'html_report' ? 'text/html; charset=utf-8' : 'application/json',
    size_bytes: Buffer.byteLength(opts.payload, 'utf-8'),
    checksum: opts.checksumOverride ?? sha256Hex(opts.payload),
    created_at: now,
    updated_at: now,
    status: 'draft',
  }
  writeFileSync(join(dir, 'artifact.json'), JSON.stringify(record), 'utf-8')
  writeFileSync(join(dir, 'owner.json'), JSON.stringify({ user_id: opts.owner ?? OWNER }), 'utf-8')
}

const UUID_HTML = '11111111-1111-4111-8111-111111111111'
const UUID_SLIDES = '22222222-2222-4222-8222-222222222222'
const UUID_SHEET = '33333333-3333-4333-8333-333333333333'
const UUID_DOC = '44444444-4444-4444-8444-444444444444'
const UUID_VIDEO = '55555555-5555-4555-8555-555555555555'
const UUID_MISSING = '66666666-6666-4666-8666-666666666666'
const UUID_OTHER_OWNER = '77777777-7777-4777-8777-777777777777'
const UUID_TAMPERED = '88888888-8888-4888-8888-888888888888'
const UUID_NO_PAYLOAD = '99999999-9999-4999-8999-999999999999'

const HTML_PAYLOAD = '<!doctype html>\n<html><body><h1>季度报告</h1></body></html>'
const SLIDES_PAYLOAD = JSON.stringify({
  slides: [{ title: '封面', bullets: ['要点一', '要点二'], notes: '讲者备注' }],
})
const SHEET_PAYLOAD = JSON.stringify({
  columns: ['名称', '数量'],
  rows: [
    ['苹果', 3],
    ['梨,子', 10],
    [null, 0],
  ],
})
const DOC_PAYLOAD = '# 标题\n\n正文内容。'
const VIDEO_PAYLOAD = JSON.stringify({ url: 'https://example.com/v/1', provider: 'demo' })

describe('Artifact Download API (GET /api/artifacts/:id/download)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    fixtureRoot = mkdtempSync(join(tmpdir(), 'ihui-artifacts-test-'))
    process.env.ARTIFACTS_DIR = fixtureRoot

    writeFixture({ id: UUID_HTML, kind: 'html_report', payload: HTML_PAYLOAD, title: '季度报告' })
    writeFixture({
      id: UUID_SLIDES,
      kind: 'slides',
      payload: SLIDES_PAYLOAD,
      title: '产品发布演示',
    })
    writeFixture({ id: UUID_SHEET, kind: 'sheet', payload: SHEET_PAYLOAD, title: '销售明细' })
    writeFixture({ id: UUID_DOC, kind: 'doc', payload: DOC_PAYLOAD, title: '需求说明' })
    writeFixture({ id: UUID_VIDEO, kind: 'video_ref', payload: VIDEO_PAYLOAD, title: '宣传片' })
    writeFixture({ id: UUID_OTHER_OWNER, kind: 'doc', payload: DOC_PAYLOAD, owner: 'someone-else' })
    writeFixture({ id: UUID_TAMPERED, kind: 'html_report', payload: HTML_PAYLOAD })
    appendFileSync(join(fixtureRoot, UUID_TAMPERED, 'v1.html'), '<!-- tamper -->', 'utf-8')
    writeFixture({ id: UUID_NO_PAYLOAD, kind: 'doc', payload: DOC_PAYLOAD, writePayload: false })

    app = Fastify({ logger: false })
    app.setErrorHandler((err: Error & { statusCode?: number }, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({ code: statusCode, message: '服务器错误' })
    })
    await app.register(artifactRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env.ARTIFACTS_DIR
    rmSync(fixtureRoot, { recursive: true, force: true })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticate.mockImplementation(async () => ({ userId: OWNER }) as never)
  })

  const get = (id: string, fmt?: string) =>
    app.inject({
      method: 'GET',
      url: `/api/artifacts/${id}/download${fmt !== undefined ? `?fmt=${fmt}` : ''}`,
    })

  // ------------------------------------------------------------ 归属与存在性 ----

  it('未登录返回 401', async () => {
    mockAuthenticate.mockImplementation(async () => {
      const err = new Error('Authentication required')
      ;(err as Error & { statusCode: number }).statusCode = 401
      throw err
    })
    const res = await get(UUID_HTML, 'html')
    expect(res.statusCode).toBe(401)
    expect(res.json()).toHaveProperty('code', 401)
  })

  it('未知产物 ID 返回 404', async () => {
    const res = await get(UUID_MISSING, 'html')
    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty('code', 404)
  })

  it('非本人产物返回 404(不泄露存在性)', async () => {
    const res = await get(UUID_OTHER_OWNER, 'md')
    expect(res.statusCode).toBe(404)
    expect(res.json()).toHaveProperty('code', 404)
  })

  it('无效 UUID 参数返回 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/artifacts/not-a-uuid/download' })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('errorCode', 'VALIDATION_FAILED')
  })

  it('payload 文件缺失返回 404', async () => {
    const res = await get(UUID_NO_PAYLOAD, 'md')
    expect(res.statusCode).toBe(404)
  })

  // ---------------------------------------------------------------- fmt 矩阵 ----

  it('html_report → fmt=html 原样返回自包含 HTML 并带下载头', async () => {
    const res = await get(UUID_HTML, 'html')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toBe(HTML_PAYLOAD)
    const disposition = String(res.headers['content-disposition'])
    expect(disposition).toContain('attachment')
    expect(disposition).toContain('filename="artifact-v1.html"')
    expect(disposition).toContain("filename*=UTF-8''")
  })

  it('html_report 缺省 fmt 回落 html', async () => {
    const res = await get(UUID_HTML)
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe(HTML_PAYLOAD)
  })

  it('html_report 不支持 csv 返回 400 UNSUPPORTED_FORMAT', async () => {
    const res = await get(UUID_HTML, 'csv')
    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('errorCode', 'UNSUPPORTED_FORMAT')
  })

  it('非法 fmt 取值返回 400', async () => {
    const res = await get(UUID_HTML, 'pdf')
    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('errorCode', 'VALIDATION_FAILED')
  })

  it('slides → fmt=html 渲染内联预览串', async () => {
    const res = await get(UUID_SLIDES, 'html')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toContain('<div class="artifact artifact--slides">')
    expect(res.body).toContain('<li>要点一</li>')
    expect(res.body).toContain('讲者备注')
  })

  it('slides → fmt=md 渲染大纲', async () => {
    const res = await get(UUID_SLIDES, 'md')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/markdown')
    expect(res.body).toContain('# 产品发布演示')
    expect(res.body).toContain('## 封面')
    expect(res.body).toContain('- 要点二')
    expect(res.body).toContain('> 讲者备注')
  })

  it('slides 缺省 fmt 回落 html', async () => {
    const res = await get(UUID_SLIDES)
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('artifact--slides')
  })

  it('slides 不支持 csv 返回 400', async () => {
    const res = await get(UUID_SLIDES, 'csv')
    expect(res.statusCode).toBe(400)
    expect(res.json()).toHaveProperty('errorCode', 'UNSUPPORTED_FORMAT')
  })

  it('sheet → fmt=csv 输出 RFC4180 逗号转义', async () => {
    const res = await get(UUID_SHEET, 'csv')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.body).toBe('名称,数量\r\n苹果,3\r\n"梨,子",10\r\n,0')
  })

  it('sheet 缺省 fmt 回落 csv', async () => {
    const res = await get(UUID_SHEET)
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('苹果,3')
  })

  it('sheet 不支持 html 返回 400', async () => {
    const res = await get(UUID_SHEET, 'html')
    expect(res.statusCode).toBe(400)
  })

  it('doc → fmt=md 原样返回 Markdown 正文', async () => {
    const res = await get(UUID_DOC, 'md')
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/markdown')
    expect(res.body).toBe(DOC_PAYLOAD)
  })

  it('doc 不支持 csv 返回 400', async () => {
    const res = await get(UUID_DOC, 'csv')
    expect(res.statusCode).toBe(400)
  })

  it('video_ref 无任何导出形态:缺省与显式 fmt 均 400', async () => {
    expect((await get(UUID_VIDEO)).statusCode).toBe(400)
    expect((await get(UUID_VIDEO, 'html')).statusCode).toBe(400)
  })

  // ---------------------------------------------------------------- checksum ----

  it('payload 被篡改(checksum 不符)返回 500 CHECKSUM_MISMATCH', async () => {
    const res = await get(UUID_TAMPERED, 'html')
    expect(res.statusCode).toBe(500)
    expect(res.json()).toHaveProperty('errorCode', 'CHECKSUM_MISMATCH')
  })

  // ---------------------------------------------------------------- 枚举 ----

  describe('Artifact List API (GET /api/artifacts)', () => {
    const OWNED_IDS = [
      UUID_HTML,
      UUID_SLIDES,
      UUID_SHEET,
      UUID_DOC,
      UUID_VIDEO,
      UUID_TAMPERED,
      UUID_NO_PAYLOAD,
    ]

    const list = (qs = '') => app.inject({ method: 'GET', url: `/api/artifacts${qs}` })

    it('未登录返回 401', async () => {
      mockAuthenticate.mockImplementationOnce(async () => {
        const err = new Error('Authentication required')
        ;(err as Error & { statusCode: number }).statusCode = 401
        throw err
      })
      const res = await list()
      expect(res.statusCode).toBe(401)
      expect(res.json()).toHaveProperty('code', 401)
    })

    it('归属过滤:仅本人产物入列,投影字段点名齐全', async () => {
      const res = await list()
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      const items = body.data.list as Array<Record<string, unknown>>
      expect(body.data.total).toBe(OWNED_IDS.length)
      const ids = items.map((i) => i.id)
      expect(ids.sort()).toEqual([...OWNED_IDS].sort())
      // 非本人产物(uuid OTHER_OWNER)绝不入列(不可分辨语义)
      expect(ids).not.toContain(UUID_OTHER_OWNER)
      // 投影形状:id/kind/name/version/created_at/session_id/payload_ref,
      // 且不下发 checksum/size_bytes 等内部字段
      const htmlRow = items.find((i) => i.id === UUID_HTML)!
      expect(Object.keys(htmlRow).sort()).toEqual(
        ['created_at', 'id', 'kind', 'name', 'payload_ref', 'session_id', 'version'].sort(),
      )
      expect(htmlRow.kind).toBe('html_report')
      expect(htmlRow.name).toBe('季度报告')
      expect(htmlRow.version).toBe(1)
      expect(htmlRow.session_id).toBe('sess-1')
      expect(htmlRow.payload_ref).toBe(`tmp/artifacts/${UUID_HTML}/v1.html`)
    })

    it('created_at 倒序排列', async () => {
      const res = await list()
      const items = res.json().data.list as Array<{ created_at: string }>
      for (let i = 1; i < items.length; i++) {
        expect(Date.parse(items[i - 1]!.created_at)).toBeGreaterThanOrEqual(
          Date.parse(items[i]!.created_at),
        )
      }
    })

    it('分页:pageSize=2 逐页切片不重不漏;非法参数 400', async () => {
      const seen: string[] = []
      for (let page = 1; page <= 4; page++) {
        const res = await list(`?page=${page}&pageSize=2`)
        expect(res.statusCode).toBe(200)
        const body = res.json().data
        expect(body.page).toBe(page)
        expect(body.pageSize).toBe(2)
        expect(body.total).toBe(OWNED_IDS.length)
        expect(body.list.length).toBe(page <= 3 ? 2 : 1)
        seen.push(...body.list.map((i: { id: string }) => i.id))
      }
      expect(new Set(seen).size).toBe(OWNED_IDS.length)

      const bad = await list('?page=0')
      expect(bad.statusCode).toBe(400)
      expect(bad.json()).toHaveProperty('errorCode', 'VALIDATION_FAILED')
    })

    it('根目录不存在/为空返回空列表(容错,不 500)', async () => {
      const emptyDir = mkdtempSync(join(tmpdir(), 'ihui-artifacts-empty-'))
      try {
        process.env.ARTIFACTS_DIR = emptyDir
        const res = await list()
        expect(res.statusCode).toBe(200)
        expect(res.json().data).toMatchObject({ list: [], total: 0, page: 1 })

        process.env.ARTIFACTS_DIR = join(emptyDir, 'no-such-subdir')
        const missing = await list()
        expect(missing.statusCode).toBe(200)
        expect(missing.json().data.list).toEqual([])
      } finally {
        process.env.ARTIFACTS_DIR = fixtureRoot
        rmSync(emptyDir, { recursive: true, force: true })
      }
    })

    it('畸形目录条目静默跳过(缺记录/坏 JSON/缺 owner/id 与目录名不符)', async () => {
      const junk = [
        { name: 'junk-missing-record', record: null as string | null, owner: OWNER },
        { name: 'junk-broken-json', record: '{ not json', owner: OWNER },
        { name: 'junk-no-owner', record: 'id-ok', owner: null },
        { name: 'junk-id-mismatch', record: 'id-mismatch', owner: OWNER },
      ]
      for (const j of junk) {
        const dir = join(fixtureRoot, j.name)
        mkdirSync(dir, { recursive: true })
        if (j.record) {
          const id = j.record === 'id-ok' ? j.name : UUID_MISSING
          writeFileSync(
            join(dir, 'artifact.json'),
            JSON.stringify({
              id,
              kind: 'doc',
              title: '畸形',
              version: 1,
              session_id: 'sess-x',
              turn_anchor: { message_id: 'msg-x' },
              payload_ref: `tmp/artifacts/${j.name}/v1.md`,
              mime: 'text/markdown',
              size_bytes: 1,
              checksum: '0'.repeat(64),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: 'draft',
            }),
            'utf-8',
          )
        }
        if (j.owner) {
          writeFileSync(join(dir, 'owner.json'), JSON.stringify({ user_id: j.owner }), 'utf-8')
        }
      }
      try {
        const res = await list()
        expect(res.statusCode).toBe(200)
        const ids = (res.json().data.list as Array<{ id: string }>).map((i) => i.id)
        expect(ids).not.toContain('junk-missing-record')
        expect(ids).not.toContain('junk-broken-json')
        expect(ids).not.toContain('junk-no-owner')
        expect(ids).not.toContain('junk-id-mismatch')
        expect(ids).not.toContain(UUID_MISSING) // id 与目录名不符 ⇒ 隐匿
        expect(res.json().data.total).toBe(OWNED_IDS.length)
      } finally {
        for (const j of junk) rmSync(join(fixtureRoot, j.name), { recursive: true, force: true })
      }
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
