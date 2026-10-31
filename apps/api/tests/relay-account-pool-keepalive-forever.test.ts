// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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
})

beforeEach(() => {
  updates.length = 0
})
