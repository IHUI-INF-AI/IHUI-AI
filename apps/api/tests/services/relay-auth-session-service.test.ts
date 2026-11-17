// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池自助授权会话 —— service/IO 行为测试（不连库、不出网：假 db + 注入通道）。
 *
 * 2026-11-17 立（票一）。这里钉的是「会被静默失效」的四条口径，判据层的分档另测于
 * `relay-auth-session.test.ts`：
 *   T-B 退避闸门：未到 nextPollAt 时一次上游请求都不发（poster 调用计数 = 0）。
 *   T-C 未实证 ⇒ 409 且**一行会话都不建**（insert 计数 = 0）。
 *   T-D 「上游已发票 ≠ 已入池」：入池抛异常 / 结果行 failed ⇒ 停 authorized，绝不 imported。
 *   T-E 凭据零外流：会话视图任何字段都不含 device_code / PAT 明文。
 *   T-F 终局销毁把手：imported / cancelled ⇒ handleRetained=false。
 *   T-H 已持票的会话绝不重打 token 端点（一次性票被重复消费是本仓号池记过的同族事故）。
 *
 * 假 db 的边界（诚实声明）：where 谓词不做精算（每例最多一行，等价），它钉的是状态迁移、
 * 调用计数与字段落值；SQL 正确性属 db 层测试与本迁移的门（49/185）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── 内存假 db：只实现本用例走到的链式形状，await 时按 op 求值 ─────────────────
// 整块放 vi.hoisted 内：vi.mock 的 factory 会被上提，引用外部 const 会撞
// "Cannot access 'xxx' before initialization"（既有样板 relay-store-accounts.test.ts 同因）。
const { store, DEFAULTS, dbMock, dbReadMock } = vi.hoisted(() => {
  type Row = Record<string, unknown>
  const store: { rows: Row[]; insertCount: number } = { rows: [], insertCount: 0 }
  const DEFAULTS: Row = {
    pollAttempts: 0,
    intervalSeconds: 5,
    status: 'pending',
    credentialScrubbed: false,
    createdAt: new Date('2026-11-17T00:00:00Z'),
    updatedAt: new Date('2026-11-17T00:00:00Z'),
    expiresAt: new Date(Date.now() + 15 * 60_000),
  }

  class FakeQuery {
    private patch: Row = {}
    private inserted: Row | null = null
    private wantsReturning = false
    private rowCount = Infinity
    constructor(private readonly op: 'select' | 'insert' | 'update') {}

    from() {
      return this
    }
    where() {
      return this
    }
    orderBy() {
      return this
    }
    limit(n: number) {
      this.rowCount = n
      return this
    }
    values(v: Row) {
      this.inserted = v
      this.rowCount = 1
      return this
    }
    set(patch: Row) {
      this.patch = patch
      return this
    }
    returning(_shape?: unknown) {
      this.wantsReturning = true
      return this
    }

    private evaluate(): unknown {
      if (this.op === 'select') {
        const n = Number.isFinite(this.rowCount) ? this.rowCount : store.rows.length
        return store.rows.slice(0, n).map((r) => ({ ...r }))
      }
      if (this.op === 'insert') {
        const row: Row = {
          ...DEFAULTS,
          ...(this.inserted ?? {}),
          id: `00000000-0000-4000-8000-00000000${String(store.rows.length + 1).padStart(2, '0')}`,
        }
        store.rows.push(row)
        store.insertCount += 1
        return this.wantsReturning ? [{ ...row }] : undefined
      }
      // update：把 patch 落到目前的行。语义与 drizzle 对齐 —— set 里值为 undefined
      // 表示「该列不参与本次更新」，所以必须跳过，不能被 assign 抹成 undefined。
      for (const r of store.rows) {
        for (const [k, v] of Object.entries(this.patch)) if (v !== undefined) r[k] = v
      }
      return this.wantsReturning ? store.rows.map((r) => ({ ...r })) : undefined
    }

    then<T>(res?: (v: unknown) => T, rej?: (e: unknown) => void): Promise<T | void> {
      return Promise.resolve(this.evaluate() as never).then(res as never, rej as never)
    }
  }

  const dbMock = {
    select: () => new FakeQuery('select'),
    insert: () => new FakeQuery('insert'),
    update: () => new FakeQuery('update'),
  }
  const dbReadMock = { select: () => new FakeQuery('select') }
  return { store, DEFAULTS, dbMock, dbReadMock }
})

vi.mock('../../src/db/index.js', () => ({ db: dbMock, dbRead: dbReadMock }))
// 密钥环境不在单测范围内：可逆假加密只用于验「明文不外流」与「能解回来」
vi.mock('../../src/utils/crypto.js', () => ({
  encryptField: (p: string) => `enc(${p})`,
  decryptField: (s: string) => {
    if (typeof s === 'string' && s.startsWith('enc(') && s.endsWith(')')) return s.slice(4, -1)
    throw new Error('假解密：非 enc() 形态')
  },
}))
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
// 入池通道走生产实现自带的注入出口（setImportAccountsForTests）：
// 不用 vi.mock 该模块 —— 那样会把真模块的 config/db 初始化链拉进单测，且 `.js` 说明符
// 在 alias 下与 mock 路径未必对得上（对不上就是静默没 mock 掉，正是要防的那型假绿）。

import {
  createAuthSession,
  pollAuthSession,
  cancelAuthSession,
  listAuthSessions,
  sweepExpiredAuthSessions,
  runAuthSessionPollSweep,
  setUpstreamPosterForTests,
  setImportAccountsForTests,
  type UpstreamResponse,
} from '../../src/services/relay-auth-session-service.js'
import { credentialFingerprint } from '../../src/services/relay-auth-session.js'

/** 入池调用记录面（断言「唯一入池通道被调了几次、带了什么」） */
interface ImportCall {
  provider: string
  accounts: Record<string, unknown>[]
  owner: string | null | undefined
}
let importCalls: ImportCall[] = []

type ImportStub = { result?: unknown; error?: Error; emptyItems?: boolean; failedItem?: string }
function stubImport(stub: ImportStub = {}) {
  importCalls = []
  setImportAccountsForTests((async (
    provider: string,
    accounts: Record<string, unknown>[],
    owner: string | null,
  ) => {
    importCalls.push({ provider, accounts, owner })
    if (stub.error) throw stub.error
    if (stub.emptyItems) return { items: [] }
    if (stub.failedItem) {
      return {
        items: [{ index: 0, name: 'n', uid: 'u', status: 'failed', reason: stub.failedItem }],
      }
    }
    return {
      providerCode: provider,
      total: 1,
      imported: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
      items: [
        {
          index: 0,
          name: `${provider}-x`,
          uid: stub.result ?? 'uid-1',
          status: 'imported',
          reason: null,
        },
      ],
    }
  }) as never)
}

function seedRow(row: Record<string, unknown>): void {
  store.rows = [{ ...DEFAULTS, ...row }]
}

beforeEach(() => {
  store.rows = []
  store.insertCount = 0
  importCalls = []
  setUpstreamPosterForTests(null)
  setImportAccountsForTests(null)
})

const DEVICE_ENV = JSON.stringify([
  {
    providerCode: 'qoder',
    kind: 'device_flow',
    mapper: 'oauth_token_pair',
    authorizationEndpoint: 'https://fake.example/device/code',
    tokenEndpoint: 'https://fake.example/token',
    clientId: 'cid-1',
    note: '测试用 env 声明（视为已实证）',
  },
])

/** device_flow 的已实证档一律经 env 出口注入（与生产同一条口径，不改内置能力表） */
function useDeviceEnvCap(): void {
  vi.stubEnv('IHUI_RELAY_AUTH_DEVICE_FLOWS_JSON', DEVICE_ENV)
}

describe('T-C capability 面：未实证 ⇒ 拒发起且不建会话行', () => {
  it('qoder/device_flow 内置未实证 ⇒ 409 capability_unverified，insert 计数 0', async () => {
    vi.stubEnv('IHUI_RELAY_AUTH_DEVICE_FLOWS_JSON', '')
    const r = await createAuthSession({ providerCode: 'qoder', kind: 'device_flow' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(409)
      expect(r.code).toBe('capability_unverified')
      // 出路必须是可执行的话（指向取证流程），不是空字符串或「不支持」这种废话
      expect(r.message.length).toBeGreaterThan(20)
      expect(r.message).toContain('零取证')
    }
    expect(store.insertCount).toBe(0)
  })

  it('未登记的 provider ⇒ 400 capability_unknown，并给出可执行的现有通道', async () => {
    const r = await createAuthSession({ providerCode: 'nonexistent-provider' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(400)
      expect(r.code).toBe('capability_unknown')
      expect(r.message).toContain('relay-account-pool.mjs --from nonexistent-provider')
    }
  })

  it('pat 形态不给 secret ⇒ 400 secret_required', async () => {
    const r = await createAuthSession({ providerCode: 'qoder', kind: 'pat' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('secret_required')
  })
})

describe('T-E/T-D/T-F PAT 直贴入池', () => {
  it('入池成功 ⇒ imported、把手已销毁、回显不含明文', async () => {
    stubImport()
    const r = await createAuthSession({
      providerCode: 'qoder',
      kind: 'pat',
      secret: 'PAT-SUPER-SECRET-1',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.status).toBe('imported')
    expect(r.data.handleRetained).toBe(false)
    expect(r.data.credFingerprint).toBe(credentialFingerprint('PAT-SUPER-SECRET-1'))
    const dump = JSON.stringify(r.data)
    expect(dump).not.toContain('PAT-SUPER-SECRET-1')

    // 交付一致性：账号确实经唯一入池通道进去（一次），票与停用档位都在
    expect(importCalls).toHaveLength(1)
    expect(importCalls[0].provider).toBe('qoder')
    expect(importCalls[0].accounts[0].token).toBe('PAT-SUPER-SECRET-1')
    expect(importCalls[0].accounts[0].enabled).toBe(false)
  })

  it('入池通道抛异常 ⇒ 停 authorized + import_exception，绝不写 imported', async () => {
    stubImport({ error: new Error('db down') })
    const r = await createAuthSession({ providerCode: 'qoder', kind: 'pat', secret: 'PAT-2' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(502)
      expect(r.code).toBe('import_exception')
      expect(r.message).not.toContain('PAT-2')
    }
    expect(store.rows[0].status).toBe('authorized')
    expect(store.rows[0].failureCode).toBe('import_exception')
    expect(store.rows[0].bearerSecretEnc).toBeTruthy() // 票留着，等判据修好后重试同一会话
  })

  it('入池结果行 failed ⇒ import_rejected + 停 authorized（422 给人看原因）', async () => {
    stubImport({ failedItem: '凭据形状不符' })
    const r = await createAuthSession({ providerCode: 'qoder', kind: 'pat', secret: 'PAT-3' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(422)
      expect(r.code).toBe('import_rejected')
      expect(r.message).toContain('凭据形状不符')
    }
    expect(store.rows[0].status).toBe('authorized')
  })

  it('入池不产出结果行 ⇒ import_no_item（没判就不写成判过）', async () => {
    stubImport({ emptyItems: true })
    const r = await createAuthSession({ providerCode: 'qoder', kind: 'pat', secret: 'PAT-4' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('import_no_item')
  })
})

describe('T-B/T-E/T-H/T-F device_flow', () => {
  it('发起：上游三键齐 ⇒ 建 pending，视图给 user_code 与二维码载荷，不含 device_code', async () => {
    useDeviceEnvCap()
    const posts: Record<string, string>[] = []
    setUpstreamPosterForTests(async (_url, form) => {
      posts.push(form)
      return {
        status: 200,
        jsonParsed: true,
        body: {
          device_code: 'DC-SECRET',
          user_code: 'ABCD-1234',
          verification_uri: 'https://x/act',
          interval: 5,
          expires_in: 900,
        },
      } satisfies UpstreamResponse
    })
    const r = await createAuthSession({ providerCode: 'qoder', kind: 'device_flow' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.status).toBe('pending')
    expect(r.data.userCode).toBe('ABCD-1234')
    expect(r.data.qrPayload).toBe('https://x/act?user_code=ABCD-1234')
    expect(r.data.handleRetained).toBe(true)
    expect(JSON.stringify(r.data)).not.toContain('DC-SECRET')
    // 发起阶段只该有一次上游请求，且带 client_id
    expect(posts).toHaveLength(1)
    expect(posts[0].client_id).toBe('cid-1')
  })

  it('退避闸门：未到 nextPollAt ⇒ 一次上游都不打', async () => {
    useDeviceEnvCap()
    await seedPendingDeviceFlow(Date.now() + 60_000)
    let called = 0
    setUpstreamPosterForTests(async () => {
      called += 1
      return { status: 400, jsonParsed: true, body: { error: 'authorization_pending' } }
    })
    const r = await pollAuthSession(id0())
    expect(r.ok).toBe(true)
    expect(called).toBe(0)
    if (r.ok) expect(r.data.status).toBe('pending')
  })

  it('waiting ⇒ 间隔保持、pollAttempts+1；slow_down ⇒ +5s 并回写', async () => {
    useDeviceEnvCap()
    await seedPendingDeviceFlow()
    setUpstreamPosterForTests(async () => ({
      status: 400,
      jsonParsed: true,
      body: { error: 'authorization_pending' },
    }))
    const a = await pollAuthSession(id0())
    expect(a.ok).toBe(true)
    expect(Number(store.rows[0].pollAttempts)).toBe(1)

    // 第二次轮询前先放开退避闸（第一次 waiting 已把 nextPollAt 推到未来；
    // 若不放开，命中的正是 T-B 那道闸 —— 这里要判的是 slow_down 的 +5s）
    store.rows[0].nextPollAt = new Date(Date.now() - 1000)
    setUpstreamPosterForTests(async () => ({
      status: 400,
      jsonParsed: true,
      body: { error: 'slow_down' },
    }))
    const b = await pollAuthSession(id0())
    expect(b.ok).toBe(true)
    expect(Number(store.rows[0].intervalSeconds)).toBe(5 + 5)
    expect(new Date(store.rows[0].nextPollAt as string).getTime()).toBeGreaterThan(Date.now())
  })

  it('上游已发票 ⇒ 入池 imported、票交唯一通道、把手销毁，且视图与错误面都不含票', async () => {
    useDeviceEnvCap()
    importCalls = []
    await seedPendingDeviceFlow()
    setUpstreamPosterForTests(async () => ({
      status: 200,
      jsonParsed: true,
      body: { access_token: 'AT-SECRET', refresh_token: 'RT-SECRET', user_id: 'U-7' },
    }))
    // 入池桩要在 seed 之后装（seed 自己会装发起桩，不动入池）
    stubImport({ result: 'uid-flow' })
    const r = await pollAuthSession(id0())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.status).toBe('imported')
    expect(r.data.handleRetained).toBe(false)
    expect(JSON.stringify(r.data)).not.toContain('AT-SECRET')
    expect(JSON.stringify(r.data)).not.toContain('RT-SECRET')
    expect(importCalls).toHaveLength(1)
    expect(importCalls[0].accounts[0].token).toBe('AT-SECRET')
    expect(importCalls[0].accounts[0].uid).toBe('U-7')
  })

  it('T-H 已持票的会话绝不重打 token 端点（换到票后重试只收尾）', async () => {
    useDeviceEnvCap()
    stubImport({ error: new Error('transient') })
    await seedPendingDeviceFlow()
    setUpstreamPosterForTests(async () => ({
      status: 200,
      jsonParsed: true,
      body: { access_token: 'AT-1' },
    }))
    const first = await pollAuthSession(id0())
    expect(first.ok).toBe(false)
    if (!first.ok) expect(first.code).toBe('import_exception')
    expect(store.rows[0].status).toBe('authorized')

    // 第二次轮询：入池通道修好，上游一次都不该再打（哨兵桩：打了就抛）
    setUpstreamPosterForTests(async () => {
      throw new Error('MUST-NOT-BE-CALLED')
    })
    stubImport({ result: 'uid-again' })
    const second = await pollAuthSession(id0())
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.data.status).toBe('imported')
  })

  it('access_denied ⇒ failed + 把手销毁；invalid_grant ⇒ 把手留存给人工核对', async () => {
    useDeviceEnvCap()
    await seedPendingDeviceFlow()
    setUpstreamPosterForTests(async () => ({
      status: 400,
      jsonParsed: true,
      body: { error: 'access_denied' },
    }))
    const r = await pollAuthSession(id0())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('access_denied')
    expect(store.rows[0].status).toBe('failed')
    expect(store.rows[0].credentialScrubbed).toBe(true)
    expect(store.rows[0].bearerSecretEnc).toBeNull()

    store.rows = []
    await seedPendingDeviceFlow()
    setUpstreamPosterForTests(async () => ({
      status: 400,
      jsonParsed: true,
      body: { error: 'invalid_grant' },
    }))
    await pollAuthSession(id0())
    expect(store.rows[0].credentialScrubbed).toBe(false)
    expect(store.rows[0].bearerSecretEnc).toBeTruthy()
  })

  it('过期：上游判 expired_token ⇒ 410；本地寿命到 ⇒ session_expired', async () => {
    useDeviceEnvCap()
    await seedPendingDeviceFlow()
    setUpstreamPosterForTests(async () => ({
      status: 400,
      jsonParsed: true,
      body: { error: 'expired_token' },
    }))
    const r = await pollAuthSession(id0())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(410)
    expect(store.rows[0].status).toBe('expired')

    store.rows = []
    useDeviceEnvCap()
    await seedPendingDeviceFlow()
    // 本地寿命判定必须发生在打上游之前：这里用哨兵桩把这条钉住
    let upstreamCalled = 0
    setUpstreamPosterForTests(async () => {
      upstreamCalled += 1
      return { status: 400, jsonParsed: true, body: { error: 'authorization_pending' } }
    })
    store.rows[0].expiresAt = new Date(Date.now() - 1000)
    const r2 = await pollAuthSession(id0())
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.code).toBe('session_expired')
    expect(upstreamCalled).toBe(0)
  })

  it('把手解不开 ⇒ credential_gone/handle_invalid，且不当成 waiting 无限重试', async () => {
    useDeviceEnvCap()
    await seedPendingDeviceFlow()
    store.rows[0].bearerSecretEnc = 'garbage-without-tag'
    let called = 0
    setUpstreamPosterForTests(async () => {
      called += 1
      return { status: 400, jsonParsed: true, body: { error: 'authorization_pending' } }
    })
    const r = await pollAuthSession(id0())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(['handle_invalid', 'credential_gone']).toContain(r.code)
    expect(called).toBe(0)
  })

  it('终局幂等：已 imported 的会话重复轮询不改判、不打上游', async () => {
    useDeviceEnvCap()
    seedRow({
      status: 'imported',
      providerCode: 'qoder',
      kind: 'device_flow',
      credentialScrubbed: true,
      bearerSecretEnc: null,
    })
    let called = 0
    setUpstreamPosterForTests(async () => {
      called += 1
      return { status: 200, jsonParsed: true, body: { access_token: 'NOPE' } }
    })
    const r = await pollAuthSession(id0())
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.status).toBe('imported')
    expect(called).toBe(0)
  })
})

describe('撤销与列表', () => {
  it('撤销 ⇒ cancelled + 把手销毁；对终局会话再撤 ⇒ already_terminal', async () => {
    useDeviceEnvCap()
    await seedPendingDeviceFlow()
    const r = await cancelAuthSession(id0(), 'admin-1')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.status).toBe('cancelled')
    expect(store.rows[0].credentialScrubbed).toBe(true)

    const again = await cancelAuthSession(id0(), 'admin-1')
    expect(again.ok).toBe(false)
    if (!again.ok) {
      expect(again.status).toBe(409)
      expect(again.code).toBe('already_terminal')
    }
  })

  it('列表默认只回非终局行', async () => {
    store.rows = [
      { ...DEFAULTS, id: 'a', status: 'pending', providerCode: 'qoder', kind: 'device_flow' },
      { ...DEFAULTS, id: 'b', status: 'imported', providerCode: 'qoder', kind: 'pat' },
    ]
    const items = await listAuthSessions({ limit: 10 })
    // 假 db 不精算 where ⇒ 这里只验视图装配与「不含把手」两件事
    expect(items.every((i) => !('bearerSecretEnc' in i))).toBe(true)
    expect(items[0].qrPayload === null || typeof items[0].qrPayload === 'string').toBe(true)
  })
})

// ── 调度腿：无人开页面时也要清扫/轮询（对标对照程序用进程内 Map 切流即丢的那一格）──────
describe('调度腿：sweep / poll sweep', () => {
  it('过期清扫把到寿命的非终局行判 expired 并销毁把手', async () => {
    await seedPendingDeviceFlow()
    store.rows[0].expiresAt = new Date(Date.now() - 1000)
    const r = await sweepExpiredAuthSessions(new Date())
    expect(r.expired).toBe(1)
    expect(store.rows[0].status).toBe('expired')
    expect(store.rows[0].bearerSecretEnc).toBeNull()
    expect(store.rows[0].credentialScrubbed).toBe(true)
  })

  it('到期轮询逐条跑、如实分类计数；未到点的行原样回显为 stillWaiting（不打上游由单会话 T-B 用例钉住）', async () => {
    await seedPendingDeviceFlow(Date.now() + 600_000)
    let calls = 0
    setUpstreamPosterForTests(async () => {
      calls += 1
      return { status: 400, jsonParsed: true, body: { error: 'authorization_pending' } }
    })
    const r = await runAuthSessionPollSweep(20, new Date())
    // 假库的 where 谓词不精算（文件头注已声明），这里钉的是调度腿的收集与分类逻辑，
    // 不是 SQL 过滤；"未到 nextPollAt 不打上游"由上面 T-B 单会话用例用 poster 计数钉住。
    expect(r.checked).toBe(1)
    expect(r.stillWaiting).toBe(1)
    expect(r.imported).toBe(0)
    expect(calls).toBe(0)
  })
})

// ── 夹具辅助 ───────────────────────────────────────────────────────────────
function id0(): string {
  return store.rows[0]?.id as string
}

async function seedPendingDeviceFlow(nextPollAtMs?: number): Promise<void> {
  setUpstreamPosterForTests(async () => ({
    status: 200,
    jsonParsed: true,
    body: {
      device_code: 'DC-SEED',
      user_code: 'SEED-1234',
      verification_uri: 'https://x/act',
      interval: 5,
      expires_in: 900,
    },
  }))
  const r = await createAuthSession({ providerCode: 'qoder', kind: 'device_flow' })
  expect(r.ok).toBe(true)
  store.rows[0].nextPollAt = new Date(nextPollAtMs ?? Date.now() - 1000)
  store.rows[0].expiresAt = new Date(Date.now() + 600_000)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
