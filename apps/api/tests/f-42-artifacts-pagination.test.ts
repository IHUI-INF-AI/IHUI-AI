// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)
 */

/**
 * F-42 回归:`GET /api/artifacts` 列表不得在请求路径上做同步全目录扫描。
 *
 * 夹具全部走 mock 的 `node:fs/promises`(readdir/readFile/stat),不碰真实工作区:
 *  ① 分页稳定性:created_at 倒序 + id 倒序次键,逐页拼接不重不漏,total 精确;
 *  ② 归属过滤/畸形条目静默跳过,不入列也不计入 total;
 *  ③ 请求路径零 `stat`、零同步 fs:readdir 每请求仅 1 次(带 withFileTypes,
 *     不逐条目 stat),artifact.json/owner.json 的读取全部异步;
 *  ④ 元数据读取并发有上限(≤ 8),目录大时不把事件循环/文件句柄打满。
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type * as FsPromises from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const OWNER = 'f42-owner'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return {
    state: {
      /** 产物根目录(与 ARTIFACTS_DIR 对齐;readdir 只认这一个) */
      root: '',
      dirs: [] as Array<{ name: string; dir: boolean }>,
      files: new Map<string, string>(),
      readdirCalls: [] as string[],
      readFileCalls: [] as string[],
      statCalls: [] as string[],
      inFlight: 0,
      maxInFlight: 0,
    },
  }
})

const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async () => ({ userId: 'f42-owner' }) as never),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>()
  const state = h.state
  const enoent = (syscall: string, p: string): NodeJS.ErrnoException =>
    Object.assign(new Error(`ENOENT: ${syscall} '${p}'`), { code: 'ENOENT' })

  return {
    ...actual,
    // 列表只允许发生一次异步 readdir(withFileTypes);不按条目 stat。
    readdir: (async (p: string, options?: { withFileTypes?: boolean }) => {
      state.readdirCalls.push(String(p))
      if (String(p) !== state.root) throw enoent('scandir', String(p))
      const names = state.dirs.map((entry) => entry.name)
      if (!options?.withFileTypes) return names
      return state.dirs.map((entry) => ({
        name: entry.name,
        parentPath: state.root,
        path: state.root,
        isDirectory: () => entry.dir,
        isFile: () => !entry.dir,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        isSymbolicLink: () => false,
      }))
    }) as unknown as typeof actual.readdir,
    // 每次元数据读都记在飞数量,用于断言并发上限。
    readFile: (async (p: string | URL, encoding?: unknown) => {
      const key = String(p)
      state.readFileCalls.push(key)
      state.inFlight += 1
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight)
      await new Promise((resolveTick) => setTimeout(resolveTick, 2))
      state.inFlight -= 1
      const content = state.files.get(key)
      if (content === undefined) throw enoent('open', key)
      return encoding === 'utf-8' ? content : Buffer.from(content, 'utf-8')
    }) as unknown as typeof actual.readFile,
    // 列表实现不得对条目 stat(任何 stat 都算回归)。
    stat: (async (p: string | URL) => {
      state.statCalls.push(String(p))
      throw new Error('列表请求路径不允许调用 stat')
    }) as unknown as typeof actual.stat,
  }
})

import { artifactRoutes } from '../src/routes/artifacts.js'

const ROOT = resolve(join(tmpdir(), 'ihui-f42-mock-artifacts'))
h.state.root = ROOT
process.env.ARTIFACTS_DIR = ROOT

let app: FastifyInstance

/** 稳定 UUID(第 n 条:n 越大 created_at 越新)。 */
function uuidOf(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

function createdAtOf(n: number): string {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString()
}

interface FixtureOpts {
  owner?: string
  /** 覆盖 artifact.json 原文(畸形/缺字段场景) */
  rawRecord?: string
  /** 记录里的 id 与目录名不一致(伪造/串目录场景) */
  recordId?: string
}

function addArtifact(id: string, opts: FixtureOpts = {}): void {
  const seq = Number(id.slice(-6))
  h.state.dirs.push({ name: id, dir: true })
  const record = {
    id: opts.recordId ?? id,
    kind: 'doc',
    title: `产物 ${seq}`,
    version: 1,
    session_id: 'sess-f42',
    turn_anchor: { message_id: 'msg-f42' },
    payload_ref: `tmp/artifacts/${id}/v1.md`,
    mime: 'text/markdown',
    size_bytes: 1,
    checksum: '0'.repeat(64),
    created_at: createdAtOf(seq),
    updated_at: createdAtOf(seq),
    status: 'draft',
  }
  h.state.files.set(
    join(ROOT, id, 'artifact.json'),
    opts.rawRecord ?? JSON.stringify(record),
  )
  h.state.files.set(join(ROOT, id, 'owner.json'), JSON.stringify({ user_id: opts.owner ?? OWNER }))
}

const OWNED_IDS = Array.from({ length: 25 }, (_, i) => uuidOf(i + 1))
const OTHER_ID = uuidOf(901)
const BROKEN_JSON_ID = uuidOf(902)
const ID_MISMATCH_ID = uuidOf(903)

const list = (qs = '') => app.inject({ method: 'GET', url: `/api/artifacts${qs}` })

describe('F-42 GET /api/artifacts 分页不再同步全目录扫描', () => {
  beforeAll(async () => {
    for (const id of OWNED_IDS) addArtifact(id)
    addArtifact(OTHER_ID, { owner: 'someone-else' })
    addArtifact(BROKEN_JSON_ID, { rawRecord: '{ not json' })
    addArtifact(ID_MISMATCH_ID, { recordId: uuidOf(904) })
    // 非目录条目必须被忽略(不带 stat 判定,靠 dirent 类型)
    h.state.dirs.push({ name: 'README.txt', dir: false })

    app = Fastify({ logger: false })
    await app.register(artifactRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env.ARTIFACTS_DIR
  })

  beforeEach(() => {
    h.state.readdirCalls.length = 0
    h.state.readFileCalls.length = 0
    h.state.statCalls.length = 0
    h.state.inFlight = 0
    h.state.maxInFlight = 0
    mockAuthenticate.mockImplementation(async () => ({ userId: OWNER }) as never)
  })

  it('created_at 倒序稳定分页:page=2&pageSize=10 只返回第 11-20 条', async () => {
    const res = await list('?page=2&pageSize=10')
    expect(res.statusCode).toBe(200)
    const body = res.json().data
    // 25 条 created_at 递增 ⇒ 倒序后第 11-20 条
    const expected = [...OWNED_IDS].reverse().slice(10, 20)
    expect(body.total).toBe(OWNED_IDS.length)
    expect(body.page).toBe(2)
    expect(body.pageSize).toBe(10)
    expect((body.list as Array<{ id: string }>).map((row) => row.id)).toEqual(expected)
  })

  it('逐页拼接不重不漏,total 精确(不被归属过滤/畸形条目污染)', async () => {
    const seen: string[] = []
    for (let page = 1; page <= 3; page++) {
      const res = await list(`?page=${page}&pageSize=10`)
      const body = res.json().data
      expect(body.total).toBe(OWNED_IDS.length)
      expect(body.list.length).toBe(page < 3 ? 10 : 5)
      seen.push(...(body.list as Array<{ id: string }>).map((row) => row.id))
    }
    expect(new Set(seen).size).toBe(OWNED_IDS.length)
    expect(seen).not.toContain(OTHER_ID)
    expect(seen).not.toContain(BROKEN_JSON_ID)
    expect(seen).not.toContain(ID_MISMATCH_ID)
    expect(seen).not.toContain('README.txt')
  })

  it('请求路径零 stat:readdir 仅 1 次(带 withFileTypes),不逐条目 stat', async () => {
    const res = await list('?page=1&pageSize=10')
    expect(res.statusCode).toBe(200)
    expect(h.state.statCalls).toEqual([])
    expect(h.state.readdirCalls).toEqual([ROOT])
  })

  it('元数据读取全部异步且有并发上限(≤ 8)', async () => {
    const res = await list('?page=1&pageSize=10')
    expect(res.statusCode).toBe(200)
    // 并发确实展开(不是串行),但不超过 8
    expect(h.state.maxInFlight).toBeGreaterThan(1)
    expect(h.state.maxInFlight).toBeLessThanOrEqual(8)
    // 只读元数据(artifact.json/owner.json),不读 payload
    expect(h.state.readFileCalls.every((p) => /(artifact|owner)\.json$/.test(p))).toBe(true)
  })

  it('根目录不存在 ⇒ 空列表 total=0(容错,不 500)', async () => {
    process.env.ARTIFACTS_DIR = join(ROOT, 'no-such-dir')
    try {
      const res = await list()
      expect(res.statusCode).toBe(200)
      expect(res.json().data).toMatchObject({ list: [], total: 0, page: 1 })
    } finally {
      process.env.ARTIFACTS_DIR = ROOT
    }
  })

  it('未登录 401 / 非法分页参数 400', async () => {
    mockAuthenticate.mockImplementationOnce(async () => {
      const err = new Error('Authentication required')
      ;(err as Error & { statusCode: number }).statusCode = 401
      throw err
    })
    const unauthorized = await list()
    expect(unauthorized.statusCode).toBe(401)
    expect(unauthorized.json()).toHaveProperty('code', 401)

    const bad = await list('?page=0')
    expect(bad.statusCode).toBe(400)
    expect(bad.json()).toHaveProperty('errorCode', 'VALIDATION_FAILED')
  })
})
