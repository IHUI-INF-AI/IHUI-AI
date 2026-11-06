// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 永久保活档(keepAliveForever)判据锁(2026-10-31 立)。
 *
 * 钉的是「掉线就登不回来」这一枚号不会静默死掉的四条边界:
 *  1. 登记判据只认布尔 true(jsonb 里的 "true" 字符串/缺失/坏形态一律不算);
 *  2. 让位/接管的三态(2026-11-10 C 档改造):接管必须「探测明确没在跑 ∧ 心跳已过 TTL(或没有)」
 *     两条证据同向;在跑/未判定一律让位 —— 这一枚的失效方向 = 多让(顶掉机主客户端不可逆);
 *  3. 空闲保活候选面在给了 foreverCutoff 时确实把 jsonb 判据带进 SQL,不给时形状与历史逐字一致
 *     (普通号窗口不能被我这次改动悄悄挪走);
 *  4. 解摘档只吃「已摘除 ∧ 永久保活 ∧ 退避达标」这一交集,且解摘写回把摘除态打回 false。
 *
 * 判据全部 import 生产端(scheduler 的导出与运行时 toQuery()),测试内不复制第二份规则(§0.6);
 * 零真实 DB/Redis,也不打上游 —— 真刷 Trae 会把机主正在用的客户端顶下线(2026-10-24 实测),
 * 那一条不在这里验,由 --explain 的闸位读数 + 承载腿实测负责。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

const updates = vi.hoisted(() => [] as Record<string, unknown>[])

vi.mock('../src/db/index.js', () => {
  const withSettlers = (step: Record<string, unknown>, resolver: () => unknown[]) => {
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolver()).then(resolve, reject)
    step.catch = (reject?: (e: unknown) => void) => Promise.resolve(resolver()).catch(reject)
    step.finally = (fn?: () => void) => Promise.resolve(resolver()).finally(fn)
    return step
  }
  const chainSelect = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'limit', 'offset', 'orderBy', 'groupBy']) {
      step[m] = vi.fn(() => step)
    }
    return withSettlers(step, () => [])
  }
  const chainWrite = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'returning', 'values']) {
      step[m] = vi.fn(() => step)
    }
    step.set = vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload)
      return step
    })
    return withSettlers(step, () => [])
  }
  return {
    db: { select: chainSelect, execute: vi.fn(async () => []), update: chainWrite },
    dbRead: { select: chainSelect },
  }
})

const S = await import('../src/services/relay-account-pool-scheduler.js')
const { PgDialect } = await import('drizzle-orm/pg-core')

const NOW = new Date('2026-11-01T12:00:00.000Z')
const FUTURE = new Date('2026-11-14T08:57:25.000Z')
const iso = (d: Date) => d.toISOString()

/**
 * 把 drizzle 片段渲染成 SQL 文本 + 参数(与 relay-account-pool-scheduler.test.ts 同一把
 * render 技术):裸 SQL 片段没有 dialect 上下文,`frag.toQuery()` 会死在 inlineParams 上,
 * 而 PgDialect().sqlToQuery 是仓里已经验证可用的那条渲染路。
 */
const q = (frag: unknown) => {
  const built = new PgDialect().sqlToQuery(frag as never)
  return { sql: built.sql, params: built.params as unknown[] }
}

/** 薄壳是仓根的 .mjs,vitest 的 root/alias 会把 `../../scripts` 折成 `/scripts` ⇒ 走 file URL */
const keepaliveShell = async () =>
  (
    await import(
      /* @vite-ignore */ new URL('../../../scripts/relay-account-keepalive.mjs', import.meta.url)
        .href
    )
  ).__test__

describe('永久保活登记判据 keepAliveForeverOf', () => {
  it('① 布尔 true 才算登记', () => {
    expect(S.keepAliveForeverOf({ extraMetadata: { keepAliveForever: true } })).toBe(true)
  })
  it('② 字符串 "true"/数字 1/缺失/坏形态一律不算(不靠宽松转换把未登记的号当成已登记)', () => {
    for (const meta of [
      { keepAliveForever: 'true' },
      { keepAliveForever: 1 },
      { keepAliveForever: false },
      {},
      null,
      undefined,
      'not-an-object',
    ]) {
      expect(S.keepAliveForeverOf({ extraMetadata: meta as unknown })).toBe(false)
    }
  })
  it('③ 登记键名单源 = 导出的常量(键名一旦改名,测试与判据一起挪,不会各留一份)', () => {
    expect(S.KEEPALIVE_FOREVER_KEY).toBe('keepAliveForever')
    expect(S.CLIENT_ACTIVE_AT_KEY).toBe('clientActiveAt')
    expect(S.keepAliveForeverOf({ extraMetadata: { [S.KEEPALIVE_FOREVER_KEY]: true } })).toBe(true)
  })
})

describe('客户端心跳判据 clientActiveAtOf', () => {
  it('④ 合法 ISO 解得开;坏串/缺失/非字符串 ⇒ null(= 静默,由池接管)', () => {
    expect(S.clientActiveAtOf({ extraMetadata: { clientActiveAt: iso(NOW) } })).toEqual(NOW)
    for (const raw of [undefined, null, '', 'not-a-date', 12, {}, { x: 1 }]) {
      expect(S.clientActiveAtOf({ extraMetadata: { clientActiveAt: raw } })).toBeNull()
    }
    expect(S.clientActiveAtOf({})).toBeNull()
  })
})

describe('让位/接管 shouldDeferRefresh(C 档 2026-11-10:接管前当场再探测)', () => {
  const staleHeartbeat = new Date(NOW.getTime() - (S.CLIENT_ACTIVE_TTL_MS + 60_000))
  const freshHeartbeat = new Date(NOW.getTime() - 5 * 60 * 1000)
  const foreverRow = (clientActiveAt: Date | null) => ({
    providerCode: 'trae',
    tokenExpiresAt: FUTURE,
    extraMetadata: {
      [S.KEEPALIVE_FOREVER_KEY]: true,
      ...(clientActiveAt ? { [S.CLIENT_ACTIVE_AT_KEY]: iso(clientActiveAt) } : {}),
    },
  })
  it('⑤ 永久保活 + 心跳新鲜 ⇒ 让位(绝不顶掉正在续期的客户端)', () => {
    expect(S.shouldDeferRefresh(foreverRow(freshHeartbeat), NOW)).toBe(true)
  })
  it('⑥ 永久保活 + 心跳陈旧 + 探测「在跑」⇒ 仍让位(心跳陈旧只是第二道缓冲,C 档核心格)', () => {
    expect(S.shouldDeferRefresh(foreverRow(staleHeartbeat), NOW, process.env, true)).toBe(true)
  })
  it('⑥b 永久保活 + 心跳陈旧 + 探测未判定/缺省 ⇒ 让位(默认方向=多让;量不到绝不接管)', () => {
    for (const probe of [undefined, null]) {
      expect(S.shouldDeferRefresh(foreverRow(staleHeartbeat), NOW, process.env, probe)).toBe(true)
    }
  })
  it('⑥c 永久保活 + 心跳陈旧 + 探测明确「没在跑」⇒ 接管(两条证据同向才授权)', () => {
    expect(S.shouldDeferRefresh(foreverRow(staleHeartbeat), NOW, process.env, false)).toBe(false)
  })
  it('⑦ 永久保活 + 从来没有心跳:未判定 ⇒ 让位;明确没在跑 ⇒ 接管', () => {
    const row = foreverRow(null)
    expect(S.shouldDeferRefresh(row, NOW)).toBe(true)
    expect(S.shouldDeferRefresh(row, NOW, process.env, null)).toBe(true)
    expect(S.shouldDeferRefresh(row, NOW, process.env, false)).toBe(false)
  })
  it('⑦b 探测「没在跑」但心跳仍新鲜 ⇒ 让位(客户端刚停,票可能还在它手里)', () => {
    expect(S.shouldDeferRefresh(foreverRow(freshHeartbeat), NOW, process.env, false)).toBe(true)
  })
  it('⑧ 永久保活不看 client-first 开关:退回 server 也让位(机主的号优先不被顶)', () => {
    const row = foreverRow(freshHeartbeat)
    expect(S.shouldDeferRefresh(row, NOW, { RELAY_TRAE_CLIENT_FIRST_REFRESH: '0' })).toBe(true)
    expect(
      S.shouldDeferRefresh(foreverRow(staleHeartbeat), NOW, {
        RELAY_TRAE_CLIENT_FIRST_REFRESH: '0',
      }),
    ).toBe(true)
  })
  it('⑧b verdict 具名结论:让位不许静默,每一枚都要答出为什么(§0.10)', () => {
    expect(S.keepAliveForeverVerdictOf(foreverRow(staleHeartbeat), NOW, true)).toEqual({
      defer: true,
      reason: 'client-running-or-unjudged',
    })
    expect(S.keepAliveForeverVerdictOf(foreverRow(staleHeartbeat), NOW, undefined)).toEqual({
      defer: true,
      reason: 'client-running-or-unjudged',
    })
    expect(S.keepAliveForeverVerdictOf(foreverRow(freshHeartbeat), NOW, false)).toEqual({
      defer: true,
      reason: 'heartbeat-fresh',
    })
    expect(S.keepAliveForeverVerdictOf(foreverRow(staleHeartbeat), NOW, false)).toEqual({
      defer: false,
      reason: 'client-stopped-and-heartbeat-stale',
    })
  })
  it('⑨ 未登记的号保持原语义:client-first + 票未过期 ⇒ 让位;票已过期 ⇒ 兜底放行', () => {
    const base = { providerCode: 'trae', tokenExpiresAt: FUTURE, extraMetadata: {} }
    expect(S.shouldDeferRefresh(base, NOW)).toBe(true)
    expect(
      S.shouldDeferRefresh({ ...base, tokenExpiresAt: new Date(NOW.getTime() - 1000) }, NOW),
    ).toBe(false)
    expect(S.shouldDeferRefresh({ ...base, tokenExpiresAt: null }, NOW)).toBe(false)
    expect(S.shouldDeferRefresh({ ...base, providerCode: 'codearts' }, NOW)).toBe(false)
    // 第四参对普通 client-first 号不生效(不让「在跑」把兜底刷新也一起让掉)
    expect(
      S.shouldDeferRefresh(
        { ...base, tokenExpiresAt: new Date(NOW.getTime() - 1000) },
        NOW,
        process.env,
        true,
      ),
    ).toBe(false)
  })
})

describe('空闲保活候选面 keepaliveIdleWhere', () => {
  it('⑩ 不给 foreverCutoff ⇒ 候选面完全不碰 jsonb(普通号窗口没被这次改动挪走)', () => {
    const one = q(S.keepaliveIdleWhere(NOW))
    expect(one.sql).not.toMatch(/extra_metadata/)
    expect(one.sql).not.toMatch(/->>/)
    expect(one.sql).toContain('greatest')
    expect(one.params.some((p) => String(p) === NOW.toISOString())).toBe(true)
  })
  it('⑪ 给了 foreverCutoff ⇒ jsonb 登记判据进候选面,且两把窗口边界各自独立绑定', () => {
    const dayAgo = new Date(NOW.getTime() - 24 * 3600_000)
    const one = q(S.keepaliveIdleWhere(NOW))
    const two = q(S.keepaliveIdleWhere(NOW, dayAgo))
    // 差值恰为 2:第二把窗口边界 + jsonb 键名各一枚 ⇒ 比绝对参数数更能锁住「没顺手改别的」
    expect(two.params.length - one.params.length).toBe(2)
    expect(two.params).toContain(S.KEEPALIVE_FOREVER_KEY)
    expect(two.sql).toMatch(/->>/)
    expect(two.sql).toMatch(/ or /i)
    for (const d of [NOW, dayAgo]) {
      expect(two.params.some((p) => String(p) === d.toISOString())).toBe(true)
    }
  })
  it('⑫ 阳性对照:SQL 谓词与 JS 判据读同一枚键(键名一旦漂移,两边对不上当场红)', () => {
    expect(S.keepAliveForeverOf({ extraMetadata: { [S.KEEPALIVE_FOREVER_KEY]: true } })).toBe(true)
    const w = q(S.keepAliveForeverCondition())
    expect(w.params).toContain(S.KEEPALIVE_FOREVER_KEY)
    expect(w.sql).toMatch(/extra_metadata/)
    expect(w.sql).toContain("'true'")
  })
})

describe('解摘档 keepAliveReviveWhere / reviveKeepAliveForeverAccounts', () => {
  it('⑬ 候选面 = 永久保活 ∧ 已摘除 ∧ 退避达标 三者交集(不看没摘的行)', () => {
    const w = q(S.keepAliveReviveWhere(NOW))
    expect(w.sql).toMatch(/temp_unschedulable/i)
    expect(w.sql).toMatch(/updated_at/i)
    expect(w.sql).toMatch(/->>/)
    expect(w.params).toContain(S.KEEPALIVE_FOREVER_KEY)
    expect(w.params.some((p) => String(p) === NOW.toISOString())).toBe(true)
    // 摘除态走等值 true(drizzle 把它参数化成 $n,不是 SQL 字面量);
    // 反向锁:不得退化成 is not null —— 那会把「没被摘除」的行也捞进解摘射程。
    expect(w.params.some((p) => p === true)).toBe(true)
    expect(w.sql).not.toMatch(/temp_unschedulable\s+is\s+(not\s+)?null/i)
  })
  it('⑭ 无候选 ⇒ 零写入(空集不冒充「解摘过了」,也不产生副作用)', async () => {
    updates.length = 0
    const revived = await S.reviveKeepAliveForeverAccounts(NOW)
    expect(revived).toHaveLength(0)
    expect(updates).toHaveLength(0)
  })
  it('⑮ 窗口默认值现读:永久保活远窄于普通号窗口,退避不是零(零 = 每轮死撞上游)', () => {
    expect(S.keepaliveIdleDays()).toBe(S.KEEPALIVE_DEFAULT_DAYS)
    expect(S.keepaliveForeverIdleHours()).toBe(S.KEEPALIVE_FOREVER_DEFAULT_HOURS)
    expect(S.keepaliveForeverIdleHours({})).toBe(S.KEEPALIVE_FOREVER_DEFAULT_HOURS)
    expect(S.keepaliveForeverIdleHours({ RELAY_ACCOUNT_KEEPALIVE_FOREVER_HOURS: 'off' })).toBeNull()
    expect(S.keepaliveForeverIdleHours({ RELAY_ACCOUNT_KEEPALIVE_FOREVER_HOURS: '6' })).toBe(6)
    expect(S.keepaliveForeverIdleHours({ RELAY_ACCOUNT_KEEPALIVE_FOREVER_HOURS: 'abc' })).toBe(
      S.KEEPALIVE_FOREVER_DEFAULT_HOURS,
    )
    expect(S.KEEPALIVE_FOREVER_REVIVE_BACKOFF_HOURS).toBeGreaterThan(0)
    expect(S.CLIENT_ACTIVE_TTL_MS).toBeGreaterThanOrEqual(10 * 60 * 1000)
  })
})

describe('发信面判据(薄壳侧)', () => {
  it('⑯ 报警身份不含计数/时刻/异常原文(守门 224:抖动进身份 = 每轮一封信)', async () => {
    const { alertIdOf } = await keepaliveShell()
    const base = { providerCode: 'trae', uid: '2574430691145387' }
    // 用「同 uid、不同计数与时刻 ⇒ 身份必须逐字相同」来锁,而不是「id 里不含数字 3」:
    // uid 本身就是一串数字,子串断言会被巧合命中成假红(2026-11-01 实测踩过)。
    const ids = [0, 3, 27].map((n) =>
      alertIdOf({
        ...base,
        refreshFailureCount: n,
        lastErrorMessage: `第 ${n} 次失败 @${new Date(1730000000000 + n).toISOString()}`,
      } as never),
    )
    expect(new Set(ids).size).toBe(1)
    expect(ids[0]).toBe('relay-keepalive-trae-25744306')
  })
  it('⑰ 只喊「已摘除」或「判死」的号;healthy 与 unknown 不进射程', async () => {
    const { alertTargetsOf } = await keepaliveShell()
    const rows = [
      { providerCode: 'trae', uid: 'a', tempUnschedulable: true, healthStatus: 'down' },
      { providerCode: 'trae', uid: 'b', tempUnschedulable: false, healthStatus: 'down' },
      { providerCode: 'trae', uid: 'c', tempUnschedulable: false, healthStatus: 'healthy' },
      { providerCode: 'trae', uid: 'd', tempUnschedulable: false, healthStatus: 'unknown' },
    ]
    const hit = alertTargetsOf(rows as never)
    expect(hit.map((r: { uid: string }) => r.uid).sort()).toEqual(['a', 'b'])
    expect(alertTargetsOf([])).toEqual([])
    expect(alertTargetsOf(undefined)).toEqual([])
  })
})

beforeEach(() => {
  updates.length = 0
})

describe('永久保活腿的心跳取数(2026-11-05 扩容 trae+qoder;取数键必须是主键)', () => {
  const load = async () =>
    (await import('../scripts/relay-account-keepalive.js')) as unknown as {
      __test__: {
        parseArgs: (argv: string[]) => {
          clientActive?: { provider: string; at: string }[]
          error: null | string
        }
        parseClientActive: (raw: string) => { provider: string; at: string } | null
        heartbeatRowIdsOf: (rows: never[], provider: string) => string[]
      }
    }

  it('⑱ 心跳旗标带平台前缀且可重复;缺等号/缺任一侧 ⇒ 未判定,绝不默认成某个平台', async () => {
    const { __test__: K } = await load()
    expect(K.parseClientActive('qoder=2026-11-05T10:00:00.000Z')).toEqual({
      provider: 'qoder',
      at: '2026-11-05T10:00:00.000Z',
    })
    expect(K.parseClientActive('2026-11-05T10:00:00.000Z')).toBeNull()
    expect(K.parseClientActive('trae=')).toBeNull()
    expect(K.parseClientActive('=x')).toBeNull()
    const args = K.parseArgs([
      '--once',
      '--client-active',
      'trae=2026-11-05T10:00:00.000Z',
      '--client-active',
      'qoder=2026-11-05T10:00:00.000Z',
    ])
    expect(args.error).toBeNull()
    expect(args.clientActive).toEqual([
      { provider: 'trae', at: '2026-11-05T10:00:00.000Z' },
      { provider: 'qoder', at: '2026-11-05T10:00:00.000Z' },
    ])
    // 裸 ISO(旧形态)不再被接受:静默回落成某个平台 = 把另一族的号留成陈旧心跳
    expect(K.parseArgs(['--once', '--client-active', '2026-11-05T10:00:00.000Z']).error).toContain(
      '--client-active',
    )
  })

  it('⑲ 心跳落库取主键 id;B 档(2026-11-10)摘掉「已有心跳且未超窗」前置 ⇒ 断供后 --once 仍拨得回', async () => {
    const { __test__: K } = await load()
    const now = '2026-11-05T10:00:00.000Z'
    const rows = [
      {
        id: 'uuid-1',
        providerCode: 'trae',
        uid: '23457307',
        clientActiveAt: '2026-11-05T09:00:00.000Z',
      },
      {
        id: 'uuid-2',
        providerCode: 'qoder',
        uid: '01a1aafa',
        clientActiveAt: '2026-11-05T09:34:00.000Z',
      },
      { id: 'uuid-3', providerCode: 'qoder', uid: '019f4a1e', clientActiveAt: null },
      {
        id: 'uuid-4',
        providerCode: 'qoder',
        uid: '019f1c4d',
        clientActiveAt: '2026-10-01T00:00:00.000Z',
      },
      {
        id: 'uuid-5',
        providerCode: 'qoder',
        uid: '019f402d',
        clientActiveAt: '2026-11-06T00:00:00.000Z',
      },
      { id: 'uuid-6', providerCode: 'qoder', uid: '019f47e7', clientActiveAt: '不是时刻' },
    ] as never[]
    // 取主键:原形态传 uid ⇒ uuid 列比对报类型错、被 `.catch(()=>[])` 吞成 0 命中(静默失效)
    expect(K.heartbeatRowIdsOf(rows, 'qoder', now, 24)).toEqual([
      'uuid-2',
      'uuid-3',
      'uuid-4',
      'uuid-5',
      'uuid-6',
    ])
    expect(K.heartbeatRowIdsOf(rows, 'trae', now, 24)).toEqual(['uuid-1'])
    // B 档立因:原「已有心跳且 ≤24h」前置把补心跳的腿自己堵死 —— 断供超 24h 的行
    // (uuid-4)与从未有心跳的行(uuid-3)都拨不回去 = 永久死锁。C 档改造后接管第一道闸
    // 是当场探测三态(keepAliveForeverVerdictOf),心跳只是第二道缓冲,拨错一枚的最坏
    // 代价 = 一个 TTL 的让位延迟;饿死型(整族拨出)在接管判据里已结构性不可能。
    expect(K.heartbeatRowIdsOf(rows, 'qoder', now, 24)).toContain('uuid-3')
    expect(K.heartbeatRowIdsOf(rows, 'qoder', now, 24)).toContain('uuid-4')
    expect(K.heartbeatRowIdsOf(rows, 'qoder', now, 24)).toContain('uuid-5')
    expect(K.heartbeatRowIdsOf(rows, 'qoder', now, 24)).toContain('uuid-6')
    // 强保档整体关掉(foreverHours≤0)⇒ 零候选:没人读心跳时拨它 = 留假证据
    expect(K.heartbeatRowIdsOf(rows, 'qoder', now, 0)).toEqual([])
    // nowIso 解不开 ⇒ 零候选(与 touchClientHeartbeat「时刻解不开不写」边界同口径)
    expect(K.heartbeatRowIdsOf(rows, 'qoder', '不是时刻', 24)).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
