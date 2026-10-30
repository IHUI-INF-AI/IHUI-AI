// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/relay/switch-targets 管理面路由契约 + 行为测试。
 *
 * 不 mock 切换引擎(relay-switch/core 走真实文件操作),而是通过路由导出的 `__test_setCatalogOverride`
 * 注入合成目标 + 临时目录,端到端验证:list 零凭据 / capture 真写快照 / switch dry-run 不写 /
 * switch apply 真覆盖 + pre-switch 备份 / 不支持目标 400 / 未知 id 404。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
} from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
}))

import relaySwitchAdminRoutes, { __test_setCatalogOverride } from '../admin/relay-switch-admin.js'
import type { SwitchTarget } from '../../services/relay-switch/profiles.js'

let app: FastifyInstance
let tmpRoots: string[] = []

function makeTarget(
  id: string,
  baseDir: string,
  snapRoot: string,
  over: Partial<SwitchTarget> = {},
): SwitchTarget {
  return {
    id,
    label: id,
    kind: 'desktop',
    baseDirCandidates: [baseDir],
    files: ['state.json'],
    snapRoot,
    loginHints: ['accessToken'],
    hintMode: 'content-scan',
    requiresStoppedApp: true,
    ...over,
  }
}

function writeState(baseDir: string, content: string): void {
  mkdirSync(baseDir, { recursive: true })
  writeFileSync(join(baseDir, 'state.json'), content)
}

beforeEach(async () => {
  __test_setCatalogOverride(null)
  app = Fastify()
  app.register(relaySwitchAdminRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(() => {
  __test_setCatalogOverride(null)
  for (const r of tmpRoots) rmSync(r, { recursive: true, force: true })
  tmpRoots = []
})

describe('GET /admin/relay/switch-targets', () => {
  it('返回目标清单且不含任何凭据字段(零泄漏)', async () => {
    const baseDir = mkdtempSync(join(os.tmpdir(), 'swb-'))
    const snapRoot = mkdtempSync(join(os.tmpdir(), 'swb-snap-'))
    tmpRoots.push(baseDir, snapRoot)
    __test_setCatalogOverride([makeTarget('client-a', baseDir, snapRoot)])
    const res = await app.inject({ method: 'GET', url: '/api/admin/relay/switch-targets' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.targets).toHaveLength(1)
    expect(body.data.targets[0].id).toBe('client-a')
    // 零凭据:响应体不得含 token 字面量
    expect(res.body).not.toContain('super-secret-token')
    expect(res.body).not.toContain('accessToken-value')
    // state 里只投 sha12s 与命中数,不投内容
    expect(body.data.targets[0].state).toHaveProperty('sha12s')
  })

  it('含 unsupported 目标时如实标注,不抛不崩', async () => {
    const baseDir = mkdtempSync(join(os.tmpdir(), 'swb-'))
    const snapRoot = mkdtempSync(join(os.tmpdir(), 'swb-snap-'))
    tmpRoots.push(baseDir, snapRoot)
    __test_setCatalogOverride([
      makeTarget('client-a', baseDir, snapRoot),
      {
        ...makeTarget('client-x', baseDir, snapRoot),
        supported: false,
        unsupportedReason: 'sqlite SecretStorage 提取器未实现',
      },
    ])
    const res = await app.inject({ method: 'GET', url: '/api/admin/relay/switch-targets' })
    expect(res.statusCode).toBe(200)
    const t = res.json().data.targets.find((x: { id: string }) => x.id === 'client-x')
    expect(t.supported).toBe(false)
    expect(t.unsupportedReason).toContain('sqlite')
  })
})

describe('POST /admin/relay/switch-targets/:id/capture', () => {
  it('登记当前登录态为快照,快照目录被创建', async () => {
    const baseDir = mkdtempSync(join(os.tmpdir(), 'swb-'))
    const snapRoot = mkdtempSync(join(os.tmpdir(), 'swb-snap-'))
    tmpRoots.push(baseDir, snapRoot)
    writeState(baseDir, 'token=super-secret-token;accessToken-value=abc')
    __test_setCatalogOverride([makeTarget('client-a', baseDir, snapRoot)])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/switch-targets/client-a/capture',
      payload: { name: 'snap1' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.name).toBe('snap1')
    expect(existsSync(join(snapRoot, 'snap1', 'state.json'))).toBe(true)
    expect(res.body).not.toContain('super-secret-token')
  })

  it('不支持目标 → 400 并带原因', async () => {
    const baseDir = mkdtempSync(join(os.tmpdir(), 'swb-'))
    const snapRoot = mkdtempSync(join(os.tmpdir(), 'swb-snap-'))
    tmpRoots.push(baseDir, snapRoot)
    __test_setCatalogOverride([
      {
        ...makeTarget('client-x', baseDir, snapRoot),
        supported: false,
        unsupportedReason: '未实现',
      },
    ])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/switch-targets/client-x/capture',
      payload: { name: 'snap1' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('未支持')
  })

  it('未知 id → 404', async () => {
    const baseDir = mkdtempSync(join(os.tmpdir(), 'swb-'))
    const snapRoot = mkdtempSync(join(os.tmpdir(), 'swb-snap-'))
    tmpRoots.push(baseDir, snapRoot)
    __test_setCatalogOverride([makeTarget('client-a', baseDir, snapRoot)])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/switch-targets/ghost/capture',
      payload: { name: 'snap1' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /admin/relay/switch-targets/:id/switch', () => {
  it('dry-run 不写盘:当前态保持原值,仅返回计划', async () => {
    const baseDir = mkdtempSync(join(os.tmpdir(), 'swb-'))
    const snapRoot = mkdtempSync(join(os.tmpdir(), 'swb-snap-'))
    tmpRoots.push(baseDir, snapRoot)
    writeState(baseDir, 'token=ORIGINAL;accessToken-value=orig')
    __test_setCatalogOverride([makeTarget('client-a', baseDir, snapRoot)])
    // 先 capture
    await app.inject({
      method: 'POST',
      url: '/api/admin/relay/switch-targets/client-a/capture',
      payload: { name: 'snap1' },
    })
    // 改当前态为 NEWER,再 dry-run 切回 snap1
    writeState(baseDir, 'token=NEWER;accessToken-value=new')
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/switch-targets/client-a/switch',
      payload: { name: 'snap1', apply: false },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.dryRun).toBe(true)
    // 不写盘:当前仍是 NEWER
    expect(readFileSync(join(baseDir, 'state.json'), 'utf8')).toContain('NEWER')
  })

  it('apply 真覆盖:当前态被写回快照内容,且生成 pre-switch 备份', async () => {
    const baseDir = mkdtempSync(join(os.tmpdir(), 'swb-'))
    const snapRoot = mkdtempSync(join(os.tmpdir(), 'swb-snap-'))
    tmpRoots.push(baseDir, snapRoot)
    writeState(baseDir, 'token=ORIGINAL;accessToken-value=orig')
    __test_setCatalogOverride([makeTarget('client-a', baseDir, snapRoot)])
    await app.inject({
      method: 'POST',
      url: '/api/admin/relay/switch-targets/client-a/capture',
      payload: { name: 'snap1' },
    })
    writeState(baseDir, 'token=NEWER;accessToken-value=new')
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/switch-targets/client-a/switch',
      payload: { name: 'snap1', apply: true },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.dryRun).toBe(false)
    expect(body.data.applied).toBe(true)
    // 当前态被写回快照内容(ORIGINAL)
    expect(readFileSync(join(baseDir, 'state.json'), 'utf8')).toContain('ORIGINAL')
    // pre-switch 备份存在且内容是切换前的 NEWER
    const backups = readdirSync(snapRoot).filter((d) => d.startsWith('pre-switch-'))
    expect(backups.length).toBe(1)
    // 上一行已钉死恰好 1 个备份;这里的非空断言只满足 noUncheckedIndexedAccess,
    // 不构成第二份判据(数量断言仍然唯一)。
    expect(readFileSync(join(snapRoot, backups[0]!, 'state.json'), 'utf8')).toContain('NEWER')
    expect(res.body).not.toContain('NEWER')
  })

  it('切换不存在的快照 → 400', async () => {
    const baseDir = mkdtempSync(join(os.tmpdir(), 'swb-'))
    const snapRoot = mkdtempSync(join(os.tmpdir(), 'swb-snap-'))
    tmpRoots.push(baseDir, snapRoot)
    writeState(baseDir, 'token=ORIGINAL')
    __test_setCatalogOverride([makeTarget('client-a', baseDir, snapRoot)])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/switch-targets/client-a/switch',
      payload: { name: 'no-such', apply: true },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('快照不存在')
  })

  it('不支持目标 → 400', async () => {
    const baseDir = mkdtempSync(join(os.tmpdir(), 'swb-'))
    const snapRoot = mkdtempSync(join(os.tmpdir(), 'swb-snap-'))
    tmpRoots.push(baseDir, snapRoot)
    __test_setCatalogOverride([
      {
        ...makeTarget('client-x', baseDir, snapRoot),
        supported: false,
        unsupportedReason: '未实现',
      },
    ])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/switch-targets/client-x/switch',
      payload: { name: 'snap1', apply: true },
    })
    expect(res.statusCode).toBe(400)
  })

  it('未知 id → 404', async () => {
    const baseDir = mkdtempSync(join(os.tmpdir(), 'swb-'))
    const snapRoot = mkdtempSync(join(os.tmpdir(), 'swb-snap-'))
    tmpRoots.push(baseDir, snapRoot)
    __test_setCatalogOverride([makeTarget('client-a', baseDir, snapRoot)])
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/relay/switch-targets/ghost/switch',
      payload: { name: 'snap1', apply: true },
    })
    expect(res.statusCode).toBe(404)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
