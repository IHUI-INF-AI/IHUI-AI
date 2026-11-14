// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 永久保活解摘档「上游不可逆判死码」闸门锁(2026-11-15 立)。
 *
 * 背景:4 枚号(codearts×3 STS5.1806 / trae×1 refresh token is invalid)每 6h 被
 * reviveKeepAliveForeverAccounts 自动解摘,拿上游已判死的 refresh token 再撞鉴权,
 * 失败累计到 3 再摘除 ⇒ 无限循环。修法 = 解摘候选叠加判死闸门(判据单源在
 * config/relay-irreversible-verdicts.json,mjs 侧与 ts 侧同读一份)。
 *
 * 每条含「同形正例 + 反向牙 + 合法改动仍绿」:
 *  - 4 个判死码逐个命中被排除;
 *  - 可逆失败(HTTP 500 / 裸 401 / 403 鉴权失效 / 超时 / HTTP 429)仍保留(6h 解摘再试);
 *  - last_error_message 为空/null/无字段保留;
 *  - 同一批混合行只排除命中的那几枚;
 *  - 解摘动作真的跳过判死行、判死行 tempUnschedulable 不被改写(实证)。
 *
 * 判据全部 import 生产端(scheduler 导出),测试内零复制(§22c);零真实 DB/Redis。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

const h = vi.hoisted(() => ({
  sets: [] as Record<string, unknown>[],
  whereArgs: [] as unknown[],
  selectRows: [] as unknown[],
}))

vi.mock('../../db/index.js', () => {
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
    return withSettlers(step, () => h.selectRows)
  }
  const chainWrite = () => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'returning', 'values']) {
      step[m] = vi.fn(() => step)
    }
    step.set = vi.fn((arg?: unknown) => {
      if (arg && typeof arg === 'object') h.sets.push(arg as Record<string, unknown>)
      return step
    })
    step.where = vi.fn((arg?: unknown) => {
      h.whereArgs.push(arg)
      return step
    })
    return withSettlers(step, () => [])
  }
  return {
    db: { select: chainSelect, update: chainWrite, insert: chainWrite, delete: chainWrite },
    dbRead: { select: chainSelect },
  }
})

vi.mock('../../utils/crypto.js', () => ({
  encryptField: (v: string) => `enc:${v}`,
  decryptField: (v: string) => (v.startsWith('enc:') ? v.slice(4) : v),
}))

vi.mock('../../config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
  isProductionGuard: false,
}))

vi.mock('../relay-account-usage.js', () => ({
  purgeAccountUsage: async () => 0,
}))

import {
  IRREVERSIBLE_VERDICTS,
  irreversibleVerdictOf,
  isTerminalFailure,
  revivableCandidatesOf,
  reviveKeepAliveForeverAccounts,
  keepAliveReviveWhere,
  recredentialableCondition,
  KEEPALIVE_FOREVER_KEY,
  KEEPALIVE_FOREVER_REVIVE_BACKOFF_HOURS,
} from '../relay-account-pool-scheduler.js'

/** 把 drizzle 片段渲染成 SQL 文本 + 参数(与 keepalive-forever.test.ts 同一把渲染路)。 */
const q = (frag: unknown) => {
  const built = new PgDialect().sqlToQuery(frag as never)
  return { sql: built.sql, params: built.params as unknown[] }
}

const NOW = new Date('2026-11-15T00:00:00.000Z')

/** 与 mjs 侧 scripts/tests/relay-account-keepalive-alert.test.mjs 的四个正例同形。 */
const DEAD_CASES = [
  ['codearts-sts5.1806', '刷新失败: STS5.1806 / invalid_grant'],
  ['trae-refresh-invalid', '20101 refresh token is invalid (rt 已废)'],
  ['doubao-712012001', 'status_code 712012001 登录校验不合法'],
  ['http401-auth-rejected', 'HTTP 401 鉴权失效'],
] as const

/** 反向牙:这些都只是「本轮抖动/可逆失败」,不得被判死静默掉。 */
const REVERSIBLE_MESSAGES = [
  'HTTP 500 网关错误',
  'HTTP 401', // 裸 401,缺「鉴权失效」明确措辞
  'HTTP 403 鉴权失效', // 清单只认 401,403 不扩权
  'ETIMEDOUT 连接上游超时',
  'HTTP 401 connection reset',
  'HTTP 429 too many requests',
  'rate limited, retry later',
  '',
]

function rowOf(id: string, lastErrorMessage: string | null) {
  return {
    id,
    uid: `uid-${id}`,
    providerCode: 'codearts',
    lastErrorMessage,
    tempUnschedulable: true,
    refreshFailureCount: 3,
  }
}

beforeEach(() => {
  h.sets.length = 0
  h.whereArgs.length = 0
  h.selectRows = []
})

describe('判死码清单:ts 侧从 config JSON 编译(单一真相源)', () => {
  it('同形正例:冻结 + 4 条 + id 唯一/有序 + 每条 pattern 是 RegExp', () => {
    expect(Object.isFrozen(IRREVERSIBLE_VERDICTS)).toBe(true)
    expect(IRREVERSIBLE_VERDICTS).toHaveLength(4)
    expect(new Set(IRREVERSIBLE_VERDICTS.map((v) => v.id)).size).toBe(4)
    expect(IRREVERSIBLE_VERDICTS.map((v) => v.id)).toEqual(DEAD_CASES.map((c) => c[0]))
    for (const v of IRREVERSIBLE_VERDICTS) {
      expect(v.pattern).toBeInstanceOf(RegExp)
      expect(Object.isFrozen(v)).toBe(true)
    }
    // 反向牙:清单一旦被复制成第二份/条数漂移,上面的条数与 id 有序断言当场红。
  })

  it('4 个判死码逐个命中(同形正例)+ 反向牙:可逆失败一律不判死', () => {
    for (const [id, msg] of DEAD_CASES) {
      expect(irreversibleVerdictOf({ lastErrorMessage: msg })).toBe(id)
      expect(isTerminalFailure({ lastErrorMessage: msg })).toBe(true)
    }
    for (const msg of REVERSIBLE_MESSAGES) {
      expect(irreversibleVerdictOf({ lastErrorMessage: msg })).toBeNull()
      expect(isTerminalFailure({ lastErrorMessage: msg })).toBe(false)
    }
    // 空 / null / 字段缺失 也不判死(反向牙:别一刀切静默所有失败)。
    expect(irreversibleVerdictOf({ lastErrorMessage: null })).toBeNull()
    expect(irreversibleVerdictOf({})).toBeNull()
    expect(isTerminalFailure({})).toBe(false)
  })

  it('合法改动仍绿:snake_case 列名同样命中;同一行清空错误信息后恢复可逆', () => {
    expect(irreversibleVerdictOf({ last_error_message: 'STS5.1806' })).toBe('codearts-sts5.1806')
    // 反向牙:上游把错误信息清空 ⇒ 不再声称判死 ⇒ 回到 6h 解摘再试的可逆语义。
    expect(irreversibleVerdictOf({ last_error_message: '' })).toBeNull()
    expect(isTerminalFailure({ last_error_message: null })).toBe(false)
  })
})

describe('解摘闸门 revivableCandidatesOf', () => {
  it('4 个判死码逐个被排除(同形正例)', () => {
    for (const [, msg] of DEAD_CASES) {
      expect(revivableCandidatesOf([rowOf('only', msg)])).toEqual([])
    }
  })

  it('反向牙:可逆失败 / 空 / null 一行都不排除', () => {
    const rows = [
      ...REVERSIBLE_MESSAGES.map((m, i) => rowOf(`v${i}`, m)),
      rowOf('v-null', null),
    ]
    expect(revivableCandidatesOf(rows).map((r) => r.id)).toEqual(rows.map((r) => r.id))
    // 「无字段」由上面 irreversibleVerdictOf({}) / isTerminalFailure({}) 覆盖;带别的属性
    // 却无共同属性的异构字面量混进同形数组会把泛型推断拖回约束(tsc weak-type 报错),故不混入。
  })

  it('混合行只排除命中的那几枚(正例 + 反向牙 + 合法改动仍绿)', () => {
    const dead = DEAD_CASES.map(([, msg], i) => rowOf(`d${i}`, msg))
    const alive = [
      ...REVERSIBLE_MESSAGES.slice(0, 5).map((m, i) => rowOf(`a${i}`, m)),
      rowOf('a-null', null),
    ]
    const all = [...alive.slice(0, 3), dead[0]!, ...alive.slice(3), dead[1]!, dead[2]!, dead[3]!]
    const got = revivableCandidatesOf(all)
    // 正例:可逆行的集合与顺序都原样保留。
    expect(got.map((r) => r.id)).toEqual(alive.map((r) => r.id))
    expect(got).toHaveLength(alive.length)
    // 反向牙:每一枚判死行都不在结果里,且一个可逆行都没被误伤。
    for (const d of dead) expect(got.some((r) => r.id === d.id)).toBe(false)
    // 合法改动仍绿:纯函数不 mutate 入参数组。
    expect(all).toHaveLength(alive.length + dead.length)
  })
})

describe('解摘动作真的跳过判死行(reviveKeepAliveForeverAccounts 实证)', () => {
  it('混合候选:判死行零写入,tempUnschedulable 不被改写,可逆行照常 6h 解摘', async () => {
    const dead = DEAD_CASES.map(([, msg], i) => rowOf(`dead-${i}`, msg))
    const alive = [
      rowOf('a-500', 'HTTP 500 网关错误'),
      rowOf('a-401', 'HTTP 401'),
      rowOf('a-403', 'HTTP 403 鉴权失效'),
      rowOf('a-timeout', 'ETIMEDOUT 连接上游超时'),
      rowOf('a-429', 'HTTP 429'),
      rowOf('a-empty', ''),
      rowOf('a-null', null),
    ]
    h.selectRows = [...dead, ...alive]

    const revived = await reviveKeepAliveForeverAccounts(NOW)

    // ① 返回值只含可逆行 —— 判死 id 一枚都不在(解摘动作真的跳过,不只是改日志)。
    expect(revived.map((r) => r.id)).toEqual(alive.map((r) => r.id))
    for (const d of dead) expect(revived.some((r) => r.id === d.id)).toBe(false)

    // ② 解摘写入只落到可逆行:每一次 set 都打回 tempUnschedulable:false。
    expect(h.sets).toHaveLength(alive.length)
    for (const s of h.sets) expect(s.tempUnschedulable).toBe(false)

    // ③ 判死码文案绝不出现在任何一次解摘留痕里(证伪「判死行被解摘」)。
    const traces = h.sets.map((s) => String(s.lastErrorMessage ?? '')).join('\n')
    for (const [, msg] of DEAD_CASES) expect(traces).not.toContain(msg)

    // ④ 反向牙:可逆行原文逐一出现在留痕里 ⇒ 6h 解摘再试语义完整保留。
    for (const a of alive) {
      expect(traces).toContain((a.lastErrorMessage ?? '未知').slice(0, 200))
    }

    // ⑤ where() 只针对可逆 id 落库,判死 id 一次都不出现。
    const updatedIds = h.whereArgs.flatMap((w) => q(w).params.map(String))
    for (const d of dead) expect(updatedIds).not.toContain(d.id)

    // ⑥ 判死行 tempUnschedulable 不被改写:仍是 true(没被解摘打回 false ⇒ 不再撞上游)。
    for (const d of dead) expect(d.tempUnschedulable).toBe(true)
  })

  it('反向牙:全可逆批 ⇒ 全量解摘(合法改动仍绿,可逆失败仍按 6h 再试)', async () => {
    const alive = [rowOf('a1', 'HTTP 500'), rowOf('a2', 'HTTP 401'), rowOf('a3', 'HTTP 429')]
    h.selectRows = [...alive]
    const revived = await reviveKeepAliveForeverAccounts(NOW)
    expect(revived.map((r) => r.id)).toEqual(alive.map((r) => r.id))
    expect(h.sets).toHaveLength(3)
    for (const s of h.sets) expect(s.tempUnschedulable).toBe(false)
  })

  it('反向牙:全判死批 ⇒ 零写入零解摘(空集不冒充解摘过)', async () => {
    h.selectRows = DEAD_CASES.map(([, msg], i) => rowOf(`dead-${i}`, msg))
    const revived = await reviveKeepAliveForeverAccounts(NOW)
    expect(revived).toHaveLength(0)
    expect(h.sets).toHaveLength(0)
    expect(h.whereArgs).toHaveLength(0)
  })

  it('合法改动仍绿:空候选 ⇒ 零写入(对齐既有 ⑭)', async () => {
    h.selectRows = []
    const revived = await reviveKeepAliveForeverAccounts(NOW)
    expect(revived).toHaveLength(0)
    expect(h.sets).toHaveLength(0)
  })
})

describe('既有 where 语义一字不动(反向牙 / 合法改动仍绿)', () => {
  it('keepAliveReviveWhere 仍是「永久保活 ∧ 已摘除 ∧ 可再凭证 ∧ 退避达标」交集', () => {
    const w = q(keepAliveReviveWhere(NOW))
    expect(w.sql).toMatch(/temp_unschedulable/i)
    expect(w.sql).toMatch(/updated_at/i)
    expect(w.sql).toMatch(/->>/)
    expect(w.params).toContain(KEEPALIVE_FOREVER_KEY)
    expect(w.params.some((p) => String(p) === NOW.toISOString())).toBe(true)
    expect(w.params.some((p) => p === true)).toBe(true)
    // 反向牙:不得退化成 is not null(那会把没摘除的行也捞进解摘射程)。
    expect(w.sql).not.toMatch(/temp_unschedulable\s+is\s+(not\s+)?null/i)
  })

  it('recredentialableCondition 仍是既有 or(refresh_token_enc/cookies_enc),6h 退避不变', () => {
    const c = q(recredentialableCondition())
    expect(c.sql).toMatch(/refresh_token_enc/i)
    expect(c.sql).toMatch(/cookies_enc/i)
    expect(KEEPALIVE_FOREVER_REVIVE_BACKOFF_HOURS).toBe(6)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
