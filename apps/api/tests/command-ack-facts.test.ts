// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-40 A/E 格用例。全内存假实现,零真库零 Redis(测试隔离铁律:不碰 8810/8811):
//   服务层:E 判据四档死因各一例 + 正向对照;幂等写 created/replayed/key-reused;
//   路由:鉴权 401、201/200/409/400 形状、E 硬错的 errorCode 映射、
//         跨存储语义(KV 抛错 ⇒ PG 事实不回滚、如实 kv_mirrored:false;KV 正常 ⇒ 键逐字节可对)。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest } from 'fastify'
import type { CommandAckFact, NewCommandAckFact } from '@ihui/database'
import { createCommandAckRoutes, commandAckKvSlotKey } from '../src/routes/command-acks.js'
import {
  COMMAND_ACK_FACT_NOT_ALIVE_CODE as SVC_NOT_ALIVE_CODE,
  COMMAND_ACK_KEY_REUSED_CODE as SVC_KEY_REUSED_CODE,
  COMMAND_ACK_FACT_NOT_ALIVE_CODE,
  COMMAND_ACK_KEY_REUSED_CODE,
  CommandAckFactNotAliveError,
  assertCommandAckFactAlive,
  recordCommandAckFact,
  type CommandAckFactStore,
} from '../src/services/command-ack-facts.js'
import { requestFingerprint, slotKeyOf } from '../src/services/run-idempotency.js'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: FastifyRequest): Promise<void> => {
    const raw = request.headers['x-test-user']
    if (typeof raw !== 'string' || raw === '') {
      const err = new Error('未登录') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    const holder = request as unknown as { userId?: number }
    holder.userId = Number(raw)
  },
}))

/** 内存事实存储:形状对齐生产 onConflictDoNothing 语义(冲突不覆盖、返回 null)。 */
class FakeStore implements CommandAckFactStore {
  private readonly map = new Map<string, CommandAckFact>()
  insertCount = 0

  private k(a: string, b: string): string {
    return `${a}\u0000${b}`
  }
  async insertFact(input: NewCommandAckFact): Promise<CommandAckFact | null> {
    this.insertCount += 1
    const key = this.k(input.parentSessionId, input.sourceCommandId)
    if (this.map.has(key)) return null
    const row: CommandAckFact = {
      parentSessionId: input.parentSessionId,
      sourceCommandId: input.sourceCommandId,
      ownerKey: input.ownerKey,
      fingerprint: input.fingerprint,
      status: input.status,
      payload: input.payload,
      entityRefs: input.entityRefs,
      createdAt: input.createdAt ?? new Date(),
      expiresAt: input.expiresAt ?? null,
    }
    this.map.set(key, row)
    return row
  }
  async getFact(a: string, b: string): Promise<CommandAckFact | null> {
    return this.map.get(this.k(a, b)) ?? null
  }
  size(): number {
    return this.map.size
  }
  seed(row: CommandAckFact): void {
    this.map.set(this.k(row.parentSessionId, row.sourceCommandId), row)
  }
}

class ThrowingKv {
  async get(): Promise<string | null> {
    return null
  }
  async setIfAbsent(): Promise<'OK' | null> {
    throw new Error('kv down')
  }
  async setWithTtl(): Promise<void> {
    throw new Error('kv down')
  }
  async delete(): Promise<void> {
    throw new Error('kv down')
  }
}

class FakeKv {
  private readonly map = new Map<string, string>()
  readonly writes: string[] = []
  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null
  }
  async setIfAbsent(key: string, value: string, ttlMs: number): Promise<'OK' | null> {
    if (this.map.has(key)) return null
    this.map.set(key, value)
    this.writes.push(key)
    void ttlMs
    return 'OK'
  }
  async setWithTtl(key: string, value: string, _ttlMs: number): Promise<void> {
    this.map.set(key, value)
    this.writes.push(key)
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key)
  }
  peek(key: string): string | null {
    return this.map.get(key) ?? null
  }
}

const NOW = new Date('2026-10-26T00:00:00.000Z')

function factOf(over: Partial<NewCommandAckFact> = {}): NewCommandAckFact {
  return {
    parentSessionId: 'ps-1',
    sourceCommandId: 'cmd-1',
    ownerKey: 'user:7',
    fingerprint: 'fp-1',
    status: 'completed',
    payload: { ok: 1 },
    entityRefs: [],
    expiresAt: null,
    ...over,
  }
}

describe('E 格:assertCommandAckFactAlive(运行时实体存活判据)', () => {
  const coords = { parentSessionId: 'ps-1', sourceCommandId: 'cmd-1' }

  it('正向对照:查得到 ∧ completed ∧ 载荷非空 ∧ 未过期 ⇒ 通过并原样返回', () => {
    const fact = assertCommandAckFactAlive(
      {
        ...factOf(),
        createdAt: NOW,
        payload: { ok: 1 },
      } as CommandAckFact,
      coords,
      NOW,
    )
    expect(fact.sourceCommandId).toBe('cmd-1')
  })

  it('查无此行 ⇒ missing 硬错(绝不静默当作存在)', () => {
    try {
      assertCommandAckFactAlive(null, coords, NOW)
      expect.unreachable('必须抛出')
    } catch (err) {
      expect(err).toBeInstanceOf(CommandAckFactNotAliveError)
      expect((err as CommandAckFactNotAliveError).reason).toBe('missing')
      expect((err as CommandAckFactNotAliveError).code).toBe(SVC_NOT_ALIVE_CODE)
    }
  })

  it('processing(未终态化)⇒ not-terminal 硬错', () => {
    const fact = { ...factOf(), status: 'processing', payload: null } as CommandAckFact
    try {
      assertCommandAckFactAlive(fact, coords, NOW)
      expect.unreachable('必须抛出')
    } catch (err) {
      expect((err as CommandAckFactNotAliveError).reason).toBe('not-terminal')
    }
  })

  it('completed 而载荷缺席(损坏)⇒ payload-missing 硬错,绝不重建', () => {
    const fact = { ...factOf(), payload: null } as CommandAckFact
    try {
      assertCommandAckFactAlive(fact, coords, NOW)
      expect.unreachable('必须抛出')
    } catch (err) {
      expect((err as CommandAckFactNotAliveError).reason).toBe('payload-missing')
    }
  })

  it('expires_at 已过 ⇒ expired 硬错(按已回收判死)', () => {
    const fact = {
      ...factOf(),
      expiresAt: new Date(NOW.getTime() - 1),
    } as CommandAckFact
    try {
      assertCommandAckFactAlive(fact, coords, NOW)
      expect.unreachable('必须抛出')
    } catch (err) {
      expect((err as CommandAckFactNotAliveError).reason).toBe('expired')
    }
  })
})

describe('A 格:recordCommandAckFact(onConflictDoNothing 幂等写)', () => {
  it('首写 created;同指纹重发 replayed 且行数不变(重发拿首次结果)', async () => {
    const store = new FakeStore()
    const first = await recordCommandAckFact(store, factOf(), NOW)
    expect(first.outcome).toBe('created')
    const second = await recordCommandAckFact(store, factOf(), NOW)
    expect(second.outcome).toBe('replayed')
    expect(store.size()).toBe(1)
    if (first.outcome !== 'created' || second.outcome !== 'replayed') return
    expect(second.fact.fingerprint).toBe(first.fact.fingerprint)
  })

  it('同坐标换指纹 ⇒ key-reused,既有事实一个字节都不动', async () => {
    const store = new FakeStore()
    await recordCommandAckFact(store, factOf(), NOW)
    const outcome = await recordCommandAckFact(
      store,
      factOf({ fingerprint: 'fp-other', payload: { ok: 2 } }),
      NOW,
    )
    expect(outcome.outcome).toBe('key-reused')
    if (outcome.outcome === 'key-reused') expect(outcome.existingFingerprint).toBe('fp-1')
    const row = await store.getFact('ps-1', 'cmd-1')
    expect(row?.fingerprint).toBe('fp-1')
    expect(row?.payload).toEqual({ ok: 1 })
  })

  it('重放命中已过期事实 ⇒ 硬错抛出,不回放也不重建(store 行原样)', async () => {
    const store = new FakeStore()
    // 用 seed()(不走 insertFact)铺底,insertCount 只量 record 路径的写入尝试。
    store.seed({
      ...factOf(),
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() - 1000),
    } as CommandAckFact)
    try {
      await recordCommandAckFact(store, factOf(), NOW)
      expect.unreachable('必须抛出')
    } catch (err) {
      expect(err).toBeInstanceOf(CommandAckFactNotAliveError)
      expect((err as CommandAckFactNotAliveError).reason).toBe('expired')
    }
    const row = await store.getFact('ps-1', 'cmd-1')
    expect(row?.fingerprint).toBe('fp-1')
    expect(store.insertCount).toBe(1)
  })
})

describe('A 格路由:POST /api/command-acks(鉴权/形状/幂等/跨存储)', () => {
  let app: FastifyInstance
  let store: FakeStore
  let kv: FakeKv

  async function post(
    payload: Record<string, unknown>,
    user = '7',
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'x-test-user': user },
      payload,
    })
    return { status: res.statusCode, body: res.json() as Record<string, unknown> }
  }

  function appFor(s: FakeStore, k: FakeKv | ThrowingKv): void {
    app = Fastify()
    app.setErrorHandler((error: FastifyError, _request, reply) => {
      const statusCode = error.statusCode ?? 500
      const errorCode = (error as { errorCode?: string }).errorCode
      return reply
        .code(statusCode)
        .send({ code: statusCode, message: error.message, ...(errorCode ? { errorCode } : {}) })
    })
    app.register(createCommandAckRoutes({ store: s, kv: k as never, nowMs: () => NOW.getTime() }))
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    store = new FakeStore()
    kv = new FakeKv()
  })
  afterEach(async () => {
    if (app !== undefined) await app.close()
    vi.useRealTimers()
  })

  it('无登录 ⇒ 401(本面无公开路径)', async () => {
    appFor(store, kv)
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: { parent_session_id: 'p', source_command_id: 'c' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('completed 首写 ⇒ 201 + {code:0,message:success,data};同体重发 ⇒ 200 replayed,行数不变', async () => {
    appFor(store, kv)
    await app.ready()
    const first = await post({
      parent_session_id: 'ps-1',
      source_command_id: 'cmd-1',
      payload: { answer: 'a' },
      entity_refs: ['user:7'],
    })
    expect(first.status).toBe(201)
    expect(first.body).toMatchObject({ code: 0, message: 'success' })
    const data1 = first.body.data as Record<string, unknown>
    expect(data1).toMatchObject({
      parent_session_id: 'ps-1',
      source_command_id: 'cmd-1',
      status: 'completed',
      replayed: false,
      kv_mirrored: true,
    })
    const again = await post({
      parent_session_id: 'ps-1',
      source_command_id: 'cmd-1',
      payload: { answer: 'a' },
      entity_refs: ['user:7'],
    })
    expect(again.status).toBe(200)
    expect((again.body.data as Record<string, unknown>).replayed).toBe(true)
    expect(store.size()).toBe(1)
  })

  it('processing 首写 ⇒ 201;同指纹重发 ⇒ 409 in-progress(对齐内核 in-progress 语义,非硬错)', async () => {
    appFor(store, kv)
    await app.ready()
    const first = await post({ parent_session_id: 'ps-2', source_command_id: 'cmd-2' })
    expect(first.status).toBe(201)
    expect((first.body.data as Record<string, unknown>).status).toBe('processing')
    const again = await post({ parent_session_id: 'ps-2', source_command_id: 'cmd-2' })
    expect(again.status).toBe(409)
    expect((again.body as { errorCode?: string }).errorCode).toBe('IDEMPOTENCY_IN_PROGRESS')
    expect(store.size()).toBe(1)
  })

  it('同坐标换请求体 ⇒ 409 + COMMAND_ACK_KEY_REUSED,事实未被覆盖(负向)', async () => {
    appFor(store, kv)
    await app.ready()
    await post({ parent_session_id: 'ps-3', source_command_id: 'cmd-3', payload: { v: 1 } })
    const reused = await post({
      parent_session_id: 'ps-3',
      source_command_id: 'cmd-3',
      payload: { v: 2 },
    })
    expect(reused.status).toBe(409)
    expect(reused.body.errorCode).toBe(COMMAND_ACK_KEY_REUSED_CODE)
    expect(reused.body.errorCode).toBe(SVC_KEY_REUSED_CODE)
    const row = await store.getFact('ps-3', 'cmd-3')
    expect(row?.payload).toEqual({ v: 1 })
  })

  it('校验负向:payload 显式 null 与缺主键段 ⇒ 400', async () => {
    appFor(store, kv)
    await app.ready()
    const nullPayload = await post({
      parent_session_id: 'ps-4',
      source_command_id: 'cmd-4',
      payload: null,
    })
    expect(nullPayload.status).toBe(400)
    const noId = await post({ parent_session_id: '', source_command_id: 'cmd-4' })
    expect(noId.status).toBe(400)
    expect(store.size()).toBe(0)
  })

  it('跨存储语义:KV 抛错 ⇒ 响应仍 201、kv_mirrored 如实 false、PG 事实不回滚', async () => {
    appFor(store, new ThrowingKv())
    await app.ready()
    const res = await post({
      parent_session_id: 'ps-5',
      source_command_id: 'cmd-5',
      payload: { v: 1 },
    })
    expect(res.status).toBe(201)
    expect((res.body.data as Record<string, unknown>).kv_mirrored).toBe(false)
    const row = await store.getFact('ps-5', 'cmd-5')
    expect(row).not.toBeNull()
    expect(row?.payload).toEqual({ v: 1 })
  })

  it('跨存储正向:KV 镜像键 = slotKeyOf 同源坐标逐字节,值与内核 CompletedSlot 同形', async () => {
    appFor(store, kv)
    await app.ready()
    await post({ parent_session_id: 'ps:6', source_command_id: 'cmd:6', payload: { v: 1 } })
    const expectedKey = commandAckKvSlotKey('user:7', 'ps:6', 'cmd:6')
    expect(expectedKey).toBe(
      slotKeyOf({
        namespace: 'command-ack',
        ownerKey: 'user:7',
        parentKey: 'session:ps:6',
        clientKey: 'cmd:6',
      }),
    )
    const raw = kv.peek(expectedKey)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw ?? '{}') as {
      status?: string
      value?: unknown
      fingerprint?: string
    }
    expect(parsed.status).toBe('completed')
    expect(parsed.value).toEqual({ v: 1 })
    const row = await store.getFact('ps:6', 'cmd:6')
    expect(parsed.fingerprint).toBe(row?.fingerprint)
  })

  it('E 硬错路由映射:重放命中过期事实 ⇒ 500 + COMMAND_ACK_FACT_NOT_ALIVE,行不删不重建(负向)', async () => {
    // seed 的指纹必须与路由实算逐字同式({status,payload,entity_refs}),否则读到的只是 key-reused。
    const fp = requestFingerprint({ status: 'completed', payload: { ok: 1 }, entity_refs: [] })
    store.seed({
      ...factOf({ fingerprint: fp }),
      createdAt: NOW,
      expiresAt: new Date(NOW.getTime() - 1000),
    } as CommandAckFact)
    appFor(store, kv)
    await app.ready()
    const res = await post({
      parent_session_id: 'ps-1',
      source_command_id: 'cmd-1',
      payload: { ok: 1 },
    })
    expect(res.status).toBe(500)
    const body = res.body as { errorCode?: string }
    expect(body.errorCode).toBe(COMMAND_ACK_FACT_NOT_ALIVE_CODE)
    expect(body.errorCode).toBe(SVC_NOT_ALIVE_CODE)
    const row = await store.getFact('ps-1', 'cmd-1')
    expect(row?.fingerprint).toBe(fp)
    expect(store.insertCount).toBe(1)
  })

  it('E 查询面:/alive 存活 ⇒ alive:true;别人的事实按不存在判(硬错,不当存在)', async () => {
    appFor(store, kv)
    await app.ready()
    await post({ parent_session_id: 'ps-7', source_command_id: 'cmd-7', payload: { v: 1 } })
    const ok = await app.inject({
      method: 'GET',
      url: '/alive/ps-7/cmd-7',
      headers: { 'x-test-user': '7' },
    })
    expect(ok.statusCode).toBe(200)
    expect((ok.json() as Record<string, unknown>).data).toMatchObject({ alive: true })
    const foreign = await app.inject({
      method: 'GET',
      url: '/alive/ps-7/cmd-7',
      headers: { 'x-test-user': '8' },
    })
    expect(foreign.statusCode).toBe(500)
    expect((foreign.json() as { errorCode?: string }).errorCode).toBe(
      COMMAND_ACK_FACT_NOT_ALIVE_CODE,
    )
  })
})

describe('指纹口径:路由侧 requestFingerprint 判别换体', () => {
  it('同坐标不同 payload ⇒ 指纹不同(key-reused 的机械前提)', () => {
    const a = requestFingerprint({ status: 'completed', payload: { v: 1 }, entity_refs: [] })
    const b = requestFingerprint({ status: 'completed', payload: { v: 2 }, entity_refs: [] })
    expect(a).not.toBe(b)
    expect(a).toBe(requestFingerprint({ status: 'completed', payload: { v: 1 }, entity_refs: [] }))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
