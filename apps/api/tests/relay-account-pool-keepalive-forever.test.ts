// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 永久保活档(keepAliveForever)判据锁(2026-10-31 立)。
 *
 * 钉的是「掉线就登不回来」这一枚号不会静默死掉的四条边界:
 *  1. 登记判据只认布尔 true(jsonb 里的 "true" 字符串/缺失/坏形态一律不算);
 *  2. 让位/接管的三态:心跳新鲜 ⇒ 让位、心跳陈旧或没有 ⇒ 接管(失效方向=多刷一次,不是等死);
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

describe('让位/接管 shouldDeferRefresh', () => {
  it('⑤ 永久保活 + 心跳新鲜 ⇒ 让位(绝不顶掉正在续期的客户端)', () => {
    const row = {
      providerCode: 'trae',
      tokenExpiresAt: FUTURE,
      extraMetadata: {
        [S.KEEPALIVE_FOREVER_KEY]: true,
        [S.CLIENT_ACTIVE_AT_KEY]: iso(new Date(NOW.getTime() - 5 * 60 * 1000)),
      },
    }
    expect(S.shouldDeferRefresh(row, NOW)).toBe(true)
  })
  it('⑥ 永久保活 + 心跳已过 TTL ⇒ 接管(客户端停了就该由池续,否则号静默死)', () => {
    const stale = new Date(NOW.getTime() - (S.CLIENT_ACTIVE_TTL_MS + 60_000))
    const row = {
      providerCode: 'trae',
      tokenExpiresAt: FUTURE,
      extraMetadata: { [S.KEEPALIVE_FOREVER_KEY]: true, [S.CLIENT_ACTIVE_AT_KEY]: iso(stale) },
    }
    expect(S.shouldDeferRefresh(row, NOW)).toBe(false)
  })
  it('⑦ 永久保活 + 从来没有心跳 ⇒ 接管(缺失按静默,不按「未知就等着」)', () => {
    const row = {
      providerCode: 'trae',
      tokenExpiresAt: FUTURE,
      extraMetadata: { [S.KEEPALIVE_FOREVER_KEY]: true },
    }
    expect(S.shouldDeferRefresh(row, NOW)).toBe(false)
  })
  it('⑧ 永久保活不看 client-first 开关:退回 server 也让位给新鲜心跳(机主的号优先不被顶)', () => {
    const row = {
      providerCode: 'trae',
      tokenExpiresAt: FUTURE,
      extraMetadata: {
        [S.KEEPALIVE_FOREVER_KEY]: true,
        [S.CLIENT_ACTIVE_AT_KEY]: iso(NOW),
      },
    }
    expect(S.shouldDeferRefresh(row, NOW, { RELAY_TRAE_CLIENT_FIRST_REFRESH: '0' })).toBe(true)
  })
  it('⑨ 未登记的号保持原语义:client-first + 票未过期 ⇒ 让位;票已过期 ⇒ 兜底放行', () => {
    const base = { providerCode: 'trae', tokenExpiresAt: FUTURE, extraMetadata: {} }
    expect(S.shouldDeferRefresh(base, NOW)).toBe(true)
    expect(
      S.shouldDeferRefresh({ ...base, tokenExpiresAt: new Date(NOW.getTime() - 1000) }, NOW),
    ).toBe(false)
    expect(S.shouldDeferRefresh({ ...base, tokenExpiresAt: null }, NOW)).toBe(false)
    expect(S.shouldDeferRefresh({ ...base, providerCode: 'codearts' }, NOW)).toBe(false)
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
  it('㉕ rt 死线射程:进窗与已过点都算,读不到日期不算,阈值缺失整档未判定', async () => {
    const { rtDeadlineTargetsOf } = await keepaliveShell()
    const now = Date.now()
    const rows = [
      { uid: 'a', refreshExpiresAt: new Date(now + 3600_000).toISOString() }, // 1h 后 ⇒ 进窗
      { uid: 'b', refreshExpiresAt: new Date(now - 3600_000).toISOString() }, // 已过点 ⇒ 更急
      { uid: 'c', refreshExpiresAt: new Date(now + 30 * 86400_000).toISOString() }, // 远 ⇒ 不喊
      { uid: 'd', refreshExpiresAt: null }, // 证据缺口 ⇒ 由隔离性体检尺另开身份点名,不与此折叠
      { uid: 'e', refreshExpiresAt: '坏时刻' },
      null,
    ]
    expect(rtDeadlineTargetsOf(rows, now, 72).map((r: { uid: string }) => r.uid)).toEqual([
      'a',
      'b',
    ])
    // 阈值拿不到 ⇒ 空集(在薄壳里抄一个 72 就是两份判据漂移的起点)
    expect(rtDeadlineTargetsOf(rows, now, null)).toEqual([])
    expect(rtDeadlineTargetsOf(rows, now, 0)).toEqual([])
    expect(rtDeadlineTargetsOf(undefined, now, 72)).toEqual([])
  })
  it('㉖ 两类告警身份不同:同一枚号不得互相遮蔽(故障压掉死线 = 该喊的没喊)', async () => {
    const { alertIdOf, mailSlugOf, alertBodyOf } = await keepaliveShell()
    const row = {
      providerCode: 'trae',
      uid: '2574430691145387',
      name: 'x',
      healthStatus: 'healthy',
      tempUnschedulable: false,
      tokenExpiresAt: '2026-11-14',
      refreshExpiresAt: '2026-11-04',
      lastRefreshAt: null,
      lastErrorMessage: null,
      takeoverAt: '2026-11-01T00:00:00.000Z',
    }
    // 历史形态逐字不变(改了它 = 把已登记的抑制窗口当成全新事件重发)
    expect(alertIdOf(row)).toBe('relay-keepalive-trae-25744306')
    expect(alertIdOf(row, 'rt-deadline')).toBe('relay-keepalive-trae-25744306;rt-deadline')
    expect(mailSlugOf(alertIdOf(row, 'rt-deadline'))).toBe(
      'relay-keepalive-trae-25744306_rt-deadline',
    )
    const rtBody = alertBodyOf(row, 'rt-deadline')
    expect(rtBody).toContain('一键切号')
    expect(rtBody).toContain('2574430691145387')
    expect(rtBody).toContain('2026-11-01T00:00:00.000Z')
    // 正文里绝不出现凭据(只有到期时刻与 uid)
    for (const forbidden of ['refreshToken=', 'token=', 'Authorization']) {
      expect(rtBody).not.toContain(forbidden)
    }
    expect(alertBodyOf(row, 'fault')).toContain('自动解摘')
  })
})

describe('显式接管出口 takeoverGateOf(2026-11-01 立)', () => {
  const OPEN = {
    found: true,
    registered: true,
    clientRenewing: false,
    rtDeadlineNear: false,
    adapterCanRefresh: true,
    tempUnschedulable: false,
  }
  it('㉗ 五道闸逐条各拦一件事,全开才放行', async () => {
    const { takeoverGateOf } = await import('../scripts/relay-account-keepalive.js')
    expect(takeoverGateOf(OPEN)).toEqual({ allowed: true, reason: null })
    // 注意各闸的"命中值"方向不同:found/registered/adapterCanRefresh 缺了才拦,
    // tempUnschedulable 是**被摘除(true)**才拦 —— 统一取 false 会把这条读成放行。
    for (const [field, blocking, why] of [
      ['found', false, '池无此行'],
      ['adapterCanRefresh', false, '适配器哑'],
      ['registered', false, '普通号归巡检四档'],
      ['tempUnschedulable', true, '摘除态归解摘退避轮'],
    ] as const) {
      const r = takeoverGateOf({ ...OPEN, [field]: blocking })
      expect(r.allowed, `${field}=${blocking} 必须拦(${why})`).toBe(false)
      expect(String(r.reason).length > 0, `${field} 的拦要说得出 why:${why}`).toBe(true)
    }
    // 心跳新鲜 + rt 未进死线 ⇒ 让位中,拒绝;显式 force 才放行
    expect(takeoverGateOf({ ...OPEN, clientRenewing: true }).allowed).toBe(false)
    expect(takeoverGateOf({ ...OPEN, clientRenewing: true }, true).allowed).toBe(true)
    // rt 已进死线 ⇒ 不必 force(让位就是把号送到死线上)
    expect(takeoverGateOf({ ...OPEN, clientRenewing: true, rtDeadlineNear: true }).allowed).toBe(
      true,
    )
    // 摘除与心跳同时命中 ⇒ 先报摘除(修法不同:等退避 vs 等客户端静默)
    expect(
      String(takeoverGateOf({ ...OPEN, tempUnschedulable: true, clientRenewing: true }).reason),
    ).toContain('摘除')
  })
  it('㉘ 薄壳认 --takeover(不认就不会补心跳,闸门读的是陈旧心跳)', async () => {
    const { parseArgs } = await keepaliveShell()
    expect(parseArgs(['--takeover', '2574430691145387']).takeover).toBe(true)
    expect(parseArgs(['--once']).takeover).toBe(false)
  })
})

beforeEach(() => {
  updates.length = 0
})

describe('rt 死线优先于让位(2026-11-01 补)', () => {
  const foreverRow = (over: Record<string, unknown> = {}) => ({
    providerCode: 'trae',
    tokenExpiresAt: FUTURE,
    extraMetadata: {
      [S.KEEPALIVE_FOREVER_KEY]: true,
      [S.CLIENT_ACTIVE_AT_KEY]: iso(new Date(NOW.getTime() - 5 * 60 * 1000)),
    },
    ...over,
  })

  it('⑱ 心跳新鲜本应让位,但 rt 进入守护窗 ⇒ 不让位(号死不可逆,顶客户端可逆)', () => {
    const dying = new Date(NOW.getTime() + 24 * 60 * 60 * 1000)
    expect(S.shouldDeferRefresh(foreverRow({ refreshExpiresAt: dying }), NOW)).toBe(false)
    // 同一枚号把守护窗关掉 ⇒ 回到 2026-10-31 的纯心跳形态(仍让位)
    expect(
      S.shouldDeferRefresh(foreverRow({ refreshExpiresAt: dying }), NOW, {
        RELAY_ACCOUNT_KEEPALIVE_RT_GUARD_HOURS: 'off',
      }),
    ).toBe(true)
  })
  it('⑲ rt 还远 / rt 未知 ⇒ 继续让位(读不到证据不构成抢刷客户端的理由)', () => {
    const far = new Date(NOW.getTime() + (S.KEEPALIVE_RT_GUARD_DEFAULT_HOURS + 24) * 3600_000)
    expect(S.shouldDeferRefresh(foreverRow({ refreshExpiresAt: far }), NOW)).toBe(true)
    expect(S.shouldDeferRefresh(foreverRow({ refreshExpiresAt: null }), NOW)).toBe(true)
    expect(S.shouldDeferRefresh(foreverRow({}), NOW)).toBe(true)
  })
  it('⑳ 守护窗取值:默认 72h;0/off ⇒ 整维关;非法值回落默认(失效方向是多保一次)', () => {
    expect(S.rtExpiryGuardHours({})).toBe(S.KEEPALIVE_RT_GUARD_DEFAULT_HOURS)
    expect(S.rtExpiryGuardHours({ RELAY_ACCOUNT_KEEPALIVE_RT_GUARD_HOURS: '0' })).toBeNull()
    expect(S.rtExpiryGuardHours({ RELAY_ACCOUNT_KEEPALIVE_RT_GUARD_HOURS: 'off' })).toBeNull()
    expect(S.rtExpiryGuardHours({ RELAY_ACCOUNT_KEEPALIVE_RT_GUARD_HOURS: '12' })).toBe(12)
    expect(S.rtExpiryGuardHours({ RELAY_ACCOUNT_KEEPALIVE_RT_GUARD_HOURS: 'nonsense' })).toBe(
      S.KEEPALIVE_RT_GUARD_DEFAULT_HOURS,
    )
  })
  it('㉑ forcedTakeoverOf 只在「永久保活 ∧ 心跳新鲜 ∧ rt 临期」三样齐时成立', () => {
    const dying = new Date(NOW.getTime() + 3600_000)
    expect(S.forcedTakeoverOf(foreverRow({ refreshExpiresAt: dying }), NOW)).toBe(true)
    // 心跳停了 = 正常接管,不是抢刷
    expect(
      S.forcedTakeoverOf(
        foreverRow({
          refreshExpiresAt: dying,
          extraMetadata: {
            [S.KEEPALIVE_FOREVER_KEY]: true,
            [S.CLIENT_ACTIVE_AT_KEY]: iso(new Date(NOW.getTime() - S.CLIENT_ACTIVE_TTL_MS - 1000)),
          },
        }),
        NOW,
      ),
    ).toBe(false)
    // 没登记的普通号即使 rt 临期也不进这一档(不得借死线把整池节奏改了)
    expect(
      S.forcedTakeoverOf(
        {
          providerCode: 'trae',
          tokenExpiresAt: FUTURE,
          refreshExpiresAt: dying,
          extraMetadata: {},
        },
        NOW,
      ),
    ).toBe(false)
  })
  it('㉒ 候选面第三支只在给了 rt 边界时出现;不给时与历史逐字一致', () => {
    const legacy = q(S.keepaliveIdleWhere(NOW, new Date(NOW.getTime() - 24 * 3600_000)))
    expect(legacy.sql).not.toMatch(/refresh_expires_at/)
    const withRt = q(
      S.keepaliveIdleWhere(
        NOW,
        new Date(NOW.getTime() - 24 * 3600_000),
        new Date(NOW.getTime() + 72 * 3600_000),
      ),
    )
    expect(withRt.sql).toMatch(/refresh_expires_at/)
    // 第三支带进两枚参数:登记判据的键名 + rt 边界 ISO(与 ⑪ 同一把尺,多写少写都当场红)
    expect(withRt.params.length - legacy.params.length).toBe(2)
    expect(withRt.sql).toMatch(/ or /i)
  })
  it('㉓ 接管凭证:写进去的形状读得回来,缺键 ⇒ null,不拿 0 冒充「没刷过」以外的结论', () => {
    const trail = { at: iso(NOW), credVersionAfter: 7, forced: true }
    const row = { extraMetadata: { [S.KEEPALIVE_TAKEOVER_KEY]: trail } }
    expect(S.takeoverTrailOf(row)).toEqual(trail)
    expect(S.takeoverTrailOf({ extraMetadata: {} })).toBeNull()
    expect(S.takeoverTrailOf({ extraMetadata: null })).toBeNull()
    expect(
      S.takeoverTrailOf({ extraMetadata: { [S.KEEPALIVE_TAKEOVER_KEY]: { at: '坏时刻' } } }),
    ).toBeNull()
    expect(S.takeoverCountOf(row)).toBe(0)
    expect(S.takeoverCountOf({ extraMetadata: { [S.KEEPALIVE_TAKEOVER_COUNT_KEY]: 3 } })).toBe(3)
    expect(S.takeoverCountOf({ extraMetadata: { [S.KEEPALIVE_TAKEOVER_COUNT_KEY]: 'x' } })).toBe(0)
  })
  it('㉔ 合并出口是增量 jsonb 参数:不整包覆盖、不用 jsonb_build_object、值不拼进 SQL', () => {
    const one = q(S.mergeExtraMetadataSql({ cosy: 'x' }))
    expect(one.sql).toMatch(/coalesce/i)
    expect(one.sql).toMatch(/\|\|/)
    expect(one.sql).not.toMatch(/jsonb_build_object/i)
    // 值是参数而不是串:拼串既毁 jsonb 类型推断,也是注入面
    expect(one.sql).not.toContain('cosy')
    expect(JSON.parse(String(one.params[0]))).toEqual({ cosy: 'x' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
