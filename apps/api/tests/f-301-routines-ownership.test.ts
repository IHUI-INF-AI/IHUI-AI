// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-301 回归锁(2026-11-13)。
 *
 * 病灶:/workspace-ai/routines 全家族只过 requireAuth,`Routine` 无属主字段,
 * list/get/update/delete/trigger 都不接收调用者身份 ⇒ 任意登录用户可读改删他人
 * 定时任务、用他人 prompt 起后台 agent;PATCH 还是 z.record 任意字段直通 service。
 *
 * 本文件锁:
 *   ① create 自动落 userUuid 并写进 routines.json;
 *   ② list 只返回调用者自己的;
 *   ③ 非属主 get/patch/delete/trigger 恒 404(不泄露存在性),且数据未被改动;
 *   ④ PATCH 只认白名单字段,userUuid/id/nextRun/lastResult 等一律 400;
 *   ⑤ 旧记录(无 userUuid)为 orphan:A/B 都 list 不到,get/patch/delete 都 404。
 *
 * 隔离:IHUI_STORE_ROOT 指向 mkdtemp 临时目录;auth 桩按 x-probe-user 头给 userId,
 * 不连 PG/Redis、不触达真实 ~/.ihui。
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (request: unknown) => request),
}))

vi.mock('../src/plugins/auth.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/plugins/auth.js')
  return { ...actual, authenticate: mockAuthenticate }
})

import { routineManager } from '../src/services/workspace-ai-service.js'
import { workspaceAiRoutes } from '../src/routes/workspace-ai.js'

const PREFIX = '/api/workspace'
const OWNER = 'f301-owner'
const OTHER = 'f301-other'
const LEGACY_ID = 'f301-legacy-orphan'

interface RoutineShape {
  id: string
  userUuid?: string
  name: string
}

interface RoutinesPayload {
  data: { routines: RoutineShape[] }
}

interface RoutinePayload {
  data: RoutineShape
}

let app: FastifyInstance
let storeRoot: string
let originalStoreRoot: string | undefined

function legacyRecord(): Record<string, unknown> {
  // 旧记录:没有任何属主信息(修复前的持久化形状)
  return {
    id: LEGACY_ID,
    name: '旧任务(无属主)',
    prompt: 'legacy prompt',
    cronExpression: '0 3 * * *',
    workspacePath: '/srv/legacy',
    modelId: 'default',
    enabled: false,
    createdAt: 1,
    lastRun: null,
    lastResult: null,
    nextRun: null,
  }
}

function inject(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  userId: string,
  payload?: unknown,
) {
  return app.inject({
    method,
    url: `${PREFIX}${url}`,
    headers: { 'x-probe-user': userId },
    ...(payload === undefined ? {} : { payload }),
  })
}

async function createRoutine(userId: string, name: string): Promise<RoutineShape> {
  const res = await inject('POST', '/routines', userId, {
    name,
    prompt: `prompt:${name}`,
    cronExpression: '0 3 * * *',
    workspacePath: '/srv/demo',
    modelId: 'default',
  })
  expect(res.statusCode).toBe(201)
  return (res.json() as RoutinePayload).data
}

function listedIds(res: { json: () => unknown }): string[] {
  return (res.json() as RoutinesPayload).data.routines.map((r) => r.id)
}

describe('routines 属主校验 — F-301', () => {
  beforeAll(async () => {
    originalStoreRoot = process.env.IHUI_STORE_ROOT
    storeRoot = mkdtempSync(join(tmpdir(), 'ihui-f301-'))
    process.env.IHUI_STORE_ROOT = storeRoot
    writeFileSync(join(storeRoot, 'routines.json'), JSON.stringify([legacyRecord()]), 'utf-8')

    mockAuthenticate.mockImplementation(async (request: unknown) => {
      const req = request as { headers: Record<string, unknown>; userId?: string }
      const raw = req.headers['x-probe-user']
      if (typeof raw !== 'string' || raw.length === 0) {
        const err = new Error('Authentication required') as Error & { statusCode: number }
        err.statusCode = 401
        throw err
      }
      req.userId = raw
      return req
    })

    app = Fastify({ logger: false })
    await app.register(workspaceAiRoutes, { prefix: PREFIX })
    await app.ready()
  }, 180_000)

  afterAll(async () => {
    routineManager.stopScheduler()
    await app?.close()
    if (originalStoreRoot === undefined) delete process.env.IHUI_STORE_ROOT
    else process.env.IHUI_STORE_ROOT = originalStoreRoot
    rmSync(storeRoot, { recursive: true, force: true })
  })

  it('① create 自动落 userUuid 并持久化到 routines.json', async () => {
    const created = await createRoutine(OWNER, 'A 的任务')

    expect(created.userUuid).toBe(OWNER)
    const persisted = JSON.parse(readFileSync(join(storeRoot, 'routines.json'), 'utf-8')) as Array<{
      id: string
      userUuid?: string
    }>
    expect(persisted.find((r) => r.id === created.id)?.userUuid).toBe(OWNER)
  })

  it('② list 只返回调用者自己的例行程序', async () => {
    const mine = await createRoutine('f301-list-a', 'A 的列表任务')
    const others = await createRoutine('f301-list-b', 'B 的列表任务')

    const listA = await inject('GET', '/routines', 'f301-list-a')
    const listB = await inject('GET', '/routines', 'f301-list-b')

    expect(listA.statusCode).toBe(200)
    expect(listedIds(listA)).toEqual([mine.id])
    expect(listedIds(listB)).toEqual([others.id])
  })

  it('③ 非属主 get/patch/delete/trigger 恒 404,数据未被改动', async () => {
    const victim = await createRoutine(OWNER, 'A 的受害者任务')

    expect((await inject('GET', `/routines/${victim.id}`, OTHER)).statusCode).toBe(404)
    expect(
      (await inject('PATCH', `/routines/${victim.id}`, OTHER, { name: 'hacked' })).statusCode,
    ).toBe(404)
    expect((await inject('DELETE', `/routines/${victim.id}`, OTHER)).statusCode).toBe(404)
    expect((await inject('POST', `/routines/${victim.id}/trigger`, OTHER)).statusCode).toBe(404)

    const own = await inject('GET', `/routines/${victim.id}`, OWNER)
    expect(own.statusCode).toBe(200)
    expect((own.json() as RoutinePayload).data.name).toBe('A 的受害者任务')
    expect(
      (await inject('PATCH', `/routines/${victim.id}`, OWNER, { name: 'A 自己改名' })).statusCode,
    ).toBe(200)
  })

  it('④ PATCH 非法字段一律 400,白名单字段可用', async () => {
    const routine = await createRoutine(OWNER, 'A 的白名单任务')

    for (const payload of [
      { userUuid: OTHER },
      { id: 'forged' },
      { createdAt: 0 },
      { nextRun: 0 },
      { lastResult: 'forged' },
    ]) {
      const res = await inject('PATCH', `/routines/${routine.id}`, OWNER, payload)
      expect(res.statusCode).toBe(400)
    }

    const ok = await inject('PATCH', `/routines/${routine.id}`, OWNER, {
      name: 'A 合法改名',
      enabled: false,
    })
    expect(ok.statusCode).toBe(200)
    expect((ok.json() as RoutinePayload).data.name).toBe('A 合法改名')
  })

  it('⑤ 旧记录(无 userUuid)对任何人不可见、不可读写', async () => {
    const listA = await inject('GET', '/routines', OWNER)
    const listB = await inject('GET', '/routines', OTHER)
    expect(listedIds(listA)).not.toContain(LEGACY_ID)
    expect(listedIds(listB)).not.toContain(LEGACY_ID)

    for (const userId of [OWNER, OTHER]) {
      expect((await inject('GET', `/routines/${LEGACY_ID}`, userId)).statusCode).toBe(404)
      expect(
        (await inject('PATCH', `/routines/${LEGACY_ID}`, userId, { name: 'grab' })).statusCode,
      ).toBe(404)
      expect((await inject('DELETE', `/routines/${LEGACY_ID}`, userId)).statusCode).toBe(404)
    }
  })
})
