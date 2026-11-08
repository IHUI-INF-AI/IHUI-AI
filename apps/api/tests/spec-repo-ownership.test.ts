// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-390 夹具:spec 仓库用户级 ACL。
 *
 * 仓库以 workspacePath 标识,属主以 workspace_permissions(userId, workspacePath) 登记判定。
 * - 用户 A(属主)读写 → 成功;
 * - 用户 B(非属主)读 / 写 / commit → 404,且写不落盘。
 *
 * Fastify inject 走真实路由与真实 spec-service;只 mock 鉴权与数据库查询层。
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OWNER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const STRANGER = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getPermission: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mocks.authenticate,
  default: vi.fn(),
}))

vi.mock('../src/db/workspace-permission-queries.js', () => ({
  getPermission: mocks.getPermission,
}))

import { specRoutes } from '../src/routes/spec.js'

let app: FastifyInstance
let root: string
let savedRootsEnv: string | undefined

const scopeHash = (): string => {
  const scopeObj = { type: 'workspace', path: null }
  return createHash('md5')
    .update(JSON.stringify(scopeObj, Object.keys(scopeObj).sort()), 'utf8')
    .digest('hex')
    .slice(0, 12)
}

const specFile = (): string => join(root, '.ihui-agent', 'specs', `${scopeHash()}.md`)
const backupDir = (): string => join(root, '.ihui-agent', 'specs', 'backups')

function authAs(userId: string): void {
  mocks.authenticate.mockImplementation(async (request: FastifyRequest) => {
    request.userId = userId
  })
}

function fullPipeline(newSpec: string, autoCommit = false) {
  return app.inject({
    method: 'POST',
    url: '/api/spec/full-pipeline',
    payload: { workspacePath: root, scope: { type: 'workspace' }, newSpec, autoCommit },
  })
}

function loadSpec() {
  return app.inject({
    method: 'GET',
    url: `/api/spec/load?workspacePath=${encodeURIComponent(root)}&scopeType=workspace`,
  })
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'ihui-spec-acl-'))
  savedRootsEnv = process.env.IHUI_WORKSPACE_ROOTS
  process.env.IHUI_WORKSPACE_ROOTS = root
  authAs(OWNER)
  // 属主断言数据源:只有 OWNER 在该工作区登记过;STRANGER 无记录。
  mocks.getPermission.mockImplementation(async (userId: string, workspacePath: string) =>
    userId === OWNER ? { userId, workspacePath } : undefined,
  )
  if (!app) {
    app = Fastify({ logger: false })
    await app.register(specRoutes, { prefix: '/api' })
    await app.ready()
  }
})

afterEach(() => {
  if (savedRootsEnv === undefined) delete process.env.IHUI_WORKSPACE_ROOTS
  else process.env.IHUI_WORKSPACE_ROOTS = savedRootsEnv
  rmSync(root, { recursive: true, force: true })
})

afterAll(async () => {
  await app?.close()
})

describe('spec 仓库用户级 ACL(F-390)', () => {
  it('属主 A 自己读写成功,且内容落盘/可回读/可覆盖', async () => {
    const write1 = await fullPipeline('owner-secret-v1')
    expect(write1.statusCode).toBe(200)
    expect(existsSync(specFile())).toBe(true)
    expect(readFileSync(specFile(), 'utf8')).toBe('owner-secret-v1')

    const read1 = await loadSpec()
    expect(read1.statusCode).toBe(200)
    expect(read1.json()).toMatchObject({ data: { spec: 'owner-secret-v1' } })

    const write2 = await fullPipeline('owner-secret-v2')
    expect(write2.statusCode).toBe(200)
    expect(readFileSync(specFile(), 'utf8')).toBe('owner-secret-v2')
  })

  it('非属主 B 读 A 的仓库 → 404 且不回显内容', async () => {
    expect((await fullPipeline('owner-secret-v1')).statusCode).toBe(200)

    authAs(STRANGER)
    const res = await loadSpec()
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('owner-secret-v1')
  })

  it('非属主 B 写/改 → 404 且不落库', async () => {
    expect((await fullPipeline('owner-original')).statusCode).toBe(200)
    const backupsBefore = readdirSync(backupDir()).length

    authAs(STRANGER)
    const res = await fullPipeline('pwned-by-stranger')
    expect(res.statusCode).toBe(404)
    expect(readFileSync(specFile(), 'utf8')).toBe('owner-original')
    expect(readdirSync(backupDir()).length).toBe(backupsBefore)
  })

  it('非属主 B commit → 404 且仓库内容不变', async () => {
    expect((await fullPipeline('owner-commit-base')).statusCode).toBe(200)

    authAs(STRANGER)
    const res = await fullPipeline('pwned-commit', true)
    expect(res.statusCode).toBe(404)
    expect(readFileSync(specFile(), 'utf8')).toBe('owner-commit-base')
  })
})
