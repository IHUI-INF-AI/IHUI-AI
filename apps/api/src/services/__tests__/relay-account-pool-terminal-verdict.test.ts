// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 永久保活解摘档「上游不可逆判死码」闸门锁(2026-11-15 立;同日补「新票已进池」半格)。
 *
 * 背景:现场 4 枚号(codearts×3 STS5.1806 / trae×1 refresh token is invalid)每 6h 被
 * reviveKeepAliveForeverAccounts 自动解摘,拿上游已判死的 refresh token 再撞鉴权,
 * 失败累计到 3 再摘除 ⇒ 无限循环。修法 = 解摘候选叠加判死闸门(判据单源在
 * config/relay-irreversible-verdicts.json,mjs 侧与 ts 侧同读一份)。
 *
 * 2026-11-15 二次修复:闸门原「无条件排除判死行」又造出「客户端重登后新票进池、行仍永久
 * down」的反向死锁 —— 任何写票路径都令 credVersion+1,闸门完全不看它。现改为判死闸门
 * **不删、只补新证据半格**:判死行有留痕 ∧ 当前 credVersion > 留痕版本 ⇒ 放行解摘并清留痕;
 * 版本没变/倒退/无留痕/留痕坏 ⇒ 继续静默(防退回「每 6h 拿死票空撞上游」)。
 *
 * 判死清单现为 3 条(doubao-712012001 已移除:见 scheduler 与 keepalive.mjs 两侧注释的
 * doubao-adapter.ts:220-225 硬反例)。每条含「同形正例 + 反向牙 + 合法改动仍绿」:
 *  - 3 个判死码逐个命中被排除;
 *  - 可逆失败(HTTP 500 / 裸 401 / 403 鉴权失效 / 超时 / HTTP 429 / 712012001)仍保留(6h 解摘再试);
 *  - last_error_message 为空/null/无字段保留;
 *  - 同一批混合行只排除命中的那几枚;
 *  - 解摘动作真的跳过无新证据判死行、放行版本前进的判死行并原子清留痕(实证)。
 *
 * 判据全部 import 生产端(scheduler / relay-credential-revival 导出),测试内零复制(§22c);零真实 DB/Redis。
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
import { TERMINAL_VERDICT_KEY, shouldReviveTerminal } from '../relay-credential-revival.js'

/** 把 drizzle 片段渲染成 SQL 文本 + 参数(与 keepalive-forever.test.ts 同一把渲染路)。 */
const q = (frag: unknown) => {
  const built = new PgDialect().sqlToQuery(frag as never)
  return { sql: built.sql, params: built.params as unknown[] }
}

const NOW = new Date('2026-11-15T00:00:00.000Z')

/** 与 mjs 侧 scripts/tests/relay-account-keepalive-alert.test.mjs 的三类正例同形。 */
const DEAD_CASES = [
  ['codearts-sts5.1806', '刷新失败: STS5.1806 / invalid_grant'],
  ['trae-refresh-invalid', '20101 refresh token is invalid (rt 已废)'],
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
  // 2026-11-15 新增牙:doubao-712012001 已从清单移除(ttwid 错套键名 ≠ 账号死亡),
  // 不得再被判死一刀切静默 —— 硬反例见 doubao-adapter.ts:220-225。
  'status_code 712012001 登录校验不合法',
]

/** 判死留痕快照(与 relay-credential-revival 单源测试 SNAP 同形)。 */
const verdictSnapOf = (credVersion: number, id = 'codearts-sts5.1806') => ({
  id,
  credVersion,
  at: '2026-11-15T01:15:01.434Z',
})

/** 造一枚带留痕的 extraMetadata(键名单源 = TERMINAL_VERDICT_KEY);broken 造坏留痕。 */
const withVerdict = (snapCredVersion: number, broken = false) => ({
  [TERMINAL_VERDICT_KEY]: broken ? { id: 'x' } : verdictSnapOf(snapCredVersion),
  keepAliveForever: true, // 合法改动仍绿:别的键不参与判据
})

/**
 * selectRows 的 mock 行:补上 credVersion / extraMetadata 两列(解摘闸门要读),
 * 默认无留痕、版本 17 ⇒ shouldReviveTerminal 恒 false,既有「判死行被排除」语义不变。
 */
function rowOf(
  id: string,
  lastErrorMessage: string | null,
  opts: { credVersion?: number; extraMetadata?: unknown } = {},
) {
  return {
    id,
    uid: `uid-${id}`,
    providerCode: 'codearts',
    lastErrorMessage,
    tempUnschedulable: true,
    refreshFailureCount: 3,
    credVersion: opts.credVersion ?? 17,
    extraMetadata: opts.extraMetadata ?? {},
  }
}

beforeEach(() => {
  h.sets.length = 0
  h.whereArgs.length = 0
  h.selectRows = []
})

describe('判死码清单:ts 侧从 config JSON 编译(单一真相源)', () => {
  it('同形正例:冻结 + 3 条 + id 唯一/有序 + 每条 pattern 是 RegExp', () => {
    expect(Object.isFrozen(IRREVERSIBLE_VERDICTS)).toBe(true)
    expect(IRREVERSIBLE_VERDICTS).toHaveLength(3)
    expect(new Set(IRREVERSIBLE_VERDICTS.map((v) => v.id)).size).toBe(3)
    expect(IRREVERSIBLE_VERDICTS.map((v) => v.id)).toEqual(DEAD_CASES.map((c) => c[0]))
    // 反向牙:清单一旦被复制成第二份/条数漂移,上面的条数与 id 有序断言当场红。
    // 2026-11-15 移除 doubao-712012001:清单不再含它,712012001 文案也不再判死(硬反例)。
    expect(IRREVERSIBLE_VERDICTS.map((v) => v.id)).not.toContain('doubao-712012001')
    expect(irreversibleVerdictOf({ lastErrorMessage: 'status_code 712012001 登录校验不合法' })).toBeNull()
    for (const v of IRREVERSIBLE_VERDICTS) {
      expect(v.pattern).toBeInstanceOf(RegExp)
      expect(Object.isFrozen(v)).toBe(true)
    }
  })

  it('3 个判死码逐个命中(同形正例)+ 反向牙:可逆失败一律不判死', () => {
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
  it('3 个判死码逐个被排除(同形正例)', () => {
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
    // 打散顺序:可逆行之间夹入 3 枚判死行(清单现为 3 条,不再有第 4 枚)。
    const all = [...alive.slice(0, 3), dead[0]!, ...alive.slice(3), dead[1]!, dead[2]!]
    const got = revivableCandidatesOf(all)
    // 正例:可逆行的集合与顺序都原样保留。
    expect(got.map((r) => r.id)).toEqual(alive.map((r) => r.id))
    expect(got).toHaveLength(alive.length)
    // 反向牙:每一枚判死行都不在结果里,且一个可逆行都没被误伤。
    for (const d of dead) expect(got.some((r) => r.id === d.id)).toBe(false)
    // 合法改动仍绿:纯函数不 mutate 入参数组。
    expect(all).toHaveLength(alive.length + dead.length)
  })

  it('判死行有留痕且 credVersion 比留痕大 ⇒ 放行(同形正例,新票已进池)', () => {
    const fresh = rowOf('fresh', DEAD_CASES[0][1], {
      credVersion: 18,
      extraMetadata: withVerdict(17),
    })
    // 单源判据本身也放行(证明闸门用的就是它,不是测试内另写一份版本号比较)。
    expect(shouldReviveTerminal(fresh)).toBe(true)
    expect(revivableCandidatesOf([fresh]).map((r) => r.id)).toEqual(['fresh'])
    // 合法改动仍绿:版本大幅前进 / 留痕 id 换成任意值 / extra 加别的键,结论不变。
    expect(
      revivableCandidatesOf([
        rowOf('far', DEAD_CASES[1][1], { credVersion: 99, extraMetadata: withVerdict(17) }),
        rowOf('other-id', DEAD_CASES[2][1], {
          credVersion: 18,
          extraMetadata: { [TERMINAL_VERDICT_KEY]: verdictSnapOf(17, 'any-other-verdict') },
        }),
      ]).map((r) => r.id),
    ).toEqual(['far', 'other-id'])
  })

  it('反向牙:判死行有留痕但版本没变 / 倒退 / 无留痕 / 留痕坏 ⇒ 仍排除(防退回每 6h 空撞)', () => {
    const msg = DEAD_CASES[0][1]
    const cases = [
      rowOf('same', msg, { credVersion: 17, extraMetadata: withVerdict(17) }), // 版本没变
      rowOf('back', msg, { credVersion: 16, extraMetadata: withVerdict(17) }), // 版本倒退
      rowOf('none', msg, { credVersion: 18, extraMetadata: {} }), // 无留痕
      rowOf('broken', msg, { credVersion: 18, extraMetadata: withVerdict(17, true) }), // 留痕坏
    ]
    for (const c of cases) {
      // vitest 的 toBe 不收 message 参数(tsc TS2554);是哪一枚靠下方全量断言定位。
      expect(shouldReviveTerminal(c)).toBe(false)
    }
    // 这是防「退回每 6h 拿死票空撞上游」的关键牙:一个都不许进解摘候选。
    expect(revivableCandidatesOf(cases)).toEqual([])
    expect(cases).toHaveLength(4) // 合法改动仍绿:纯函数不 mutate 入参
  })

  it('混合批:可逆行 + 版本未变判死行 + 版本前进判死行 ⇒ 只排除中间那类', () => {
    const alive = rowOf('alive', 'HTTP 500 网关错误')
    const staleDead = rowOf('stale-dead', DEAD_CASES[0][1], {
      credVersion: 17,
      extraMetadata: withVerdict(17),
    })
    const freshDead = rowOf('fresh-dead', DEAD_CASES[1][1], {
      credVersion: 18,
      extraMetadata: withVerdict(17),
    })
    const got = revivableCandidatesOf([alive, staleDead, freshDead])
    // 正例:可逆行 + 版本前进判死行都放行,顺序保留。
    expect(got.map((r) => r.id)).toEqual(['alive', 'fresh-dead'])
    // 反向牙:版本未变判死行仍被排除(否则死票又回去撞上游)。
    expect(got.some((r) => r.id === 'stale-dead')).toBe(false)
  })
})

describe('解摘动作真的跳过无新证据判死行、放行版本前进判死行(reviveKeepAliveForeverAccounts 实证)', () => {
  it('混合候选:无新证据判死行零写入、tempUnschedulable 保持 true,可逆行照常 6h 解摘', async () => {
    // dead 全部默认无留痕(shouldReviveTerminal 恒 false)= 「上游判死后没有新票进池」,
    // 按新闸门仍应静默排除;这是防「退回每 6h 拿死票空撞上游」的关键牙。
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

    // ② 解摘写入只落到可逆行:每一次 set 都打回 tempUnschedulable:false,
    //    且一律带原子清留痕的 extraMetadata 补丁(#3:不整对象覆盖)。
    expect(h.sets).toHaveLength(alive.length)
    for (const s of h.sets) {
      expect(s.tempUnschedulable).toBe(false)
      expect(s.extraMetadata).toBeDefined()
    }

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

  it('解摘动作对「版本前进」的判死行真的写库,且 .set() 里带清留痕的 extraMetadata 补丁', async () => {
    const fresh = rowOf('fresh-dead', DEAD_CASES[0][1], {
      credVersion: 18,
      extraMetadata: withVerdict(17),
    })
    h.selectRows = [fresh]

    const revived = await reviveKeepAliveForeverAccounts(NOW)

    // ① 判死但新票已进池 ⇒ 真的进解摘(返回值非空、真的写了库)。
    expect(revived.map((r) => r.id)).toEqual(['fresh-dead'])
    expect(h.sets).toHaveLength(1)
    expect(h.whereArgs).toHaveLength(1)

    // ② .set() 带清留痕的 extraMetadata 补丁,且是「原子删键」不是整对象覆盖。
    const set = h.sets[0]!
    expect(set.tempUnschedulable).toBe(false)
    expect(set.extraMetadata).toBeDefined()
    const rendered = q(set.extraMetadata)
    expect(rendered.sql.toLowerCase()).toContain('coalesce')
    expect(rendered.sql).toMatch(/extra_metadata/i)
    expect(rendered.sql).toContain('terminalVerdict') // jsonb - 'terminalVerdict' 字面量键名
    expect(rendered.sql).not.toMatch(/jsonb_build_object/i) // 反向牙:不是整对象覆盖成新 jsonb
    // 合法改动仍绿:where 只针对这一枚 id 落库。
    expect(h.whereArgs.flatMap((w) => q(w).params.map(String))).toContain('fresh-dead')
  })

  it('混合批解摘实证:可逆行 + 版本未变判死行 + 版本前进判死行 ⇒ 只解摘前后两类', async () => {
    const alive = rowOf('alive', 'HTTP 500 网关错误')
    const staleDead = rowOf('stale-dead', DEAD_CASES[0][1], {
      credVersion: 17,
      extraMetadata: withVerdict(17),
    })
    const freshDead = rowOf('fresh-dead', DEAD_CASES[1][1], {
      credVersion: 18,
      extraMetadata: withVerdict(17),
    })
    h.selectRows = [alive, staleDead, freshDead]

    const revived = await reviveKeepAliveForeverAccounts(NOW)

    expect(revived.map((r) => r.id)).toEqual(['alive', 'fresh-dead'])
    expect(revived.some((r) => r.id === 'stale-dead')).toBe(false)
    // 只写库两次(可逆 + 版本前进),版本未变判死行 id 一次都不落 where。
    expect(h.sets).toHaveLength(2)
    const updatedIds = h.whereArgs.flatMap((w) => q(w).params.map(String))
    expect(updatedIds).toContain('alive')
    expect(updatedIds).toContain('fresh-dead')
    expect(updatedIds).not.toContain('stale-dead')
  })

  it('反向牙:全可逆批 ⇒ 全量解摘(合法改动仍绿,可逆失败仍按 6h 再试)', async () => {
    const alive = [rowOf('a1', 'HTTP 500'), rowOf('a2', 'HTTP 401'), rowOf('a3', 'HTTP 429')]
    h.selectRows = [...alive]
    const revived = await reviveKeepAliveForeverAccounts(NOW)
    expect(revived.map((r) => r.id)).toEqual(alive.map((r) => r.id))
    expect(h.sets).toHaveLength(3)
    for (const s of h.sets) expect(s.tempUnschedulable).toBe(false)
  })

  it('反向牙:全判死批且都无新证据 ⇒ 零写入零解摘(空集不冒充解摘过,防退回空撞)', async () => {
    // 三枚判死行全部默认无留痕 ⇒ shouldReviveTerminal 恒 false ⇒ 新闸门仍应全部静默;
    // 这正是「不删判死闸门」的那半格,少了它就会退回每 6h 拿死票撞上游。
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
