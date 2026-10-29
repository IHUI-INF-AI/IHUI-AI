// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2FA step-up 的回归锁。
 *
 * 病灶（现读代码核对）：TOTP 只在登录时问一次；会话令牌被窃后，提现这类资金动作
 * 不再需要第二个因子（`/finance/agent-withdrawal/apply` 只有 authenticate）。
 *
 * 这组用例里最要紧的是**反向那两条**：未开 2FA 的账号必须逐字不受影响（否则今天
 * 所有提现用户都被打断），以及"账号状态读不出"绝不能被读成"没开 2FA 所以放行"。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Redis } from 'ioredis'

const lookupUser = vi.hoisted(() => vi.fn())
vi.mock('../src/db/queries.js', () => ({ findUserById: lookupUser }))

import {
  STEP_UP_WINDOW_SEC,
  __test__ as S,
  recordTwoFactorStepUp,
  isTwoFactorStepUpFresh,
  revokeTwoFactorStepUp,
  requireStepUpForTwoFactorUser,
} from '../src/services/two-factor-step-up-store.js'

interface FakeClock {
  ms: number
}

function makeFakeRedis(clock: FakeClock, mode: 'ok' | 'down' = 'ok') {
  const rows = new Map<string, { value: string; expiresAtMs: number }>()
  const alive = (k: string) => {
    const r = rows.get(k)
    if (!r) return undefined
    if (r.expiresAtMs <= clock.ms) {
      rows.delete(k)
      return undefined
    }
    return r
  }
  const boom = () => {
    if (mode === 'down') throw new Error('redis down')
  }
  const client = {
    async set(k: string, v: string, _ex: string, ttl: number) {
      boom()
      rows.set(k, { value: v, expiresAtMs: clock.ms + ttl * 1000 })
      return 'OK'
    },
    async get(k: string) {
      boom()
      return alive(k)?.value ?? null
    },
    async del(k: string) {
      boom()
      return rows.delete(k) ? 1 : 0
    },
  }
  return { client: client as unknown as Redis, rows }
}

const uid = 'user-1'

beforeEach(() => {
  lookupUser.mockReset()
  S.memFreshUntil.clear()
})

describe('闸：谁被要求第二因子', () => {
  it('未开 2FA 的账号 ⇒ 放行且 enforced:false（存量提现不能被打断）', async () => {
    lookupUser.mockResolvedValue({ id: uid, twoFactorEnabled: false })
    const clock = { ms: 1_730_000_000_000 }
    const { client } = makeFakeRedis(clock)
    const r = await requireStepUpForTwoFactorUser({ userId: uid, redis: client, nowMs: clock.ms })
    expect(r).toEqual({ ok: true, enforced: false })
  })

  it('开了 2FA 但窗内没验过 ⇒ 拒，机器码 STEP_UP_REQUIRED', async () => {
    lookupUser.mockResolvedValue({ id: uid, twoFactorEnabled: true })
    const clock = { ms: 1_730_000_000_000 }
    const { client } = makeFakeRedis(clock)
    const r = await requireStepUpForTwoFactorUser({ userId: uid, redis: client, nowMs: clock.ms })
    expect(r).toEqual({ ok: false, code: 'STEP_UP_REQUIRED' })
  })

  it('开了 2FA 且刚验过 ⇒ 放行且 enforced:true', async () => {
    lookupUser.mockResolvedValue({ id: uid, twoFactorEnabled: true })
    const clock = { ms: 1_730_000_000_000 }
    const { client } = makeFakeRedis(clock)
    await recordTwoFactorStepUp(uid, client, STEP_UP_WINDOW_SEC, clock.ms)
    const r = await requireStepUpForTwoFactorUser({
      userId: uid,
      redis: client,
      nowMs: clock.ms + 60_000,
    })
    expect(r).toEqual({ ok: true, enforced: true })
  })

  it('账号查不到 ⇒ ACCOUNT_UNJUDGED（绝不当成"没开 2FA"放过）', async () => {
    lookupUser.mockResolvedValue(undefined)
    const clock = { ms: 1_730_000_000_000 }
    const { client } = makeFakeRedis(clock)
    const r = await requireStepUpForTwoFactorUser({ userId: uid, redis: client, nowMs: clock.ms })
    expect(r).toEqual({ ok: false, code: 'ACCOUNT_UNJUDGED' })
  })

  it('查询抛错 ⇒ 同样拒，并留一行 warn（失效方向是多要一次验证）', async () => {
    lookupUser.mockRejectedValue(new Error('db down'))
    const clock = { ms: 1_730_000_000_000 }
    const { client } = makeFakeRedis(clock)
    const r = await requireStepUpForTwoFactorUser({ userId: uid, redis: client, nowMs: clock.ms })
    expect(r).toEqual({ ok: false, code: 'ACCOUNT_UNJUDGED' })
  })
})

describe('新鲜度账本', () => {
  it('窗口到期 ⇒ 判不新鲜（不是永久有效）', async () => {
    const clock = { ms: 1_730_000_000_000 }
    const { client } = makeFakeRedis(clock)
    await recordTwoFactorStepUp(uid, client, 300, clock.ms)
    S.memFreshUntil.set(uid, clock.ms + 300_000)

    clock.ms += 299_000 // 假时钟必须跟着推进：Redis 的 TTL 判读问的是它自己的那个时钟
    expect(await isTwoFactorStepUpFresh(uid, client, clock.ms)).toBe(true)
    clock.ms += 2_000 // 现在越过 300s 窗（Redis 键与内存两层同时到期）
    expect(await isTwoFactorStepUpFresh(uid, client, clock.ms)).toBe(false)
  })

  it('撤销 ⇒ 两层一起清（改密/登出这类动作要能把窗关掉）', async () => {
    const clock = { ms: 1_730_000_000_000 }
    const { client } = makeFakeRedis(clock)
    await recordTwoFactorStepUp(uid, client, 300, clock.ms)
    await revokeTwoFactorStepUp(uid, client)
    expect(await isTwoFactorStepUpFresh(uid, client, clock.ms)).toBe(false)
  })

  it('Redis 抖动 ⇒ 进程内那一层仍认（刚验过的用户不该被踢回重输）', async () => {
    const clock = { ms: 1_730_000_000_000 }
    const ok = makeFakeRedis(clock, 'ok')
    await recordTwoFactorStepUp(uid, ok.client, 300, clock.ms)
    const down = makeFakeRedis(clock, 'down')
    expect(await isTwoFactorStepUpFresh(uid, down.client, clock.ms)).toBe(true)
  })

  it('无 Redis（单机/开发）⇒ 内存层照样工作', async () => {
    const clock = { ms: 1_730_000_000_000 }
    await recordTwoFactorStepUp(uid, null, 300, clock.ms)
    expect(await isTwoFactorStepUpFresh(uid, null, clock.ms)).toBe(true)
    expect(await isTwoFactorStepUpFresh(uid, null, clock.ms + 301_000)).toBe(false)
  })

  it('键按账号隔离：A 验过不给 B 开门', async () => {
    const clock = { ms: 1_730_000_000_000 }
    const { client } = makeFakeRedis(clock)
    await recordTwoFactorStepUp('user-A', client, 300, clock.ms)
    expect(await isTwoFactorStepUpFresh('user-B', client, clock.ms)).toBe(false)
  })
})

describe('接线锁（闸必须住在写库之前，且 step-up 端点不许顺手改 2FA 开关）', () => {
  const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

  it('提现路由：闸在 insert 之前，且不新鲜就 401', () => {
    const src = read('../src/routes/finance-extended.ts')
    const gate = src.indexOf('requireStepUpForTwoFactorUser({ userId, redis')
    const insert = src.indexOf('.insert(withdrawalFlows)')
    expect(gate).toBeGreaterThan(0)
    expect(insert).toBeGreaterThan(gate)
    expect(src).toContain("gate.code === 'STEP_UP_REQUIRED'")
  })

  it('step-up 端点：只记账，不写 twoFactorEnabled（那是 /auth/2fa/verify 的职权）', () => {
    const src = read('../src/routes/auth-extended.ts')
    const start = src.indexOf("'/auth/2fa/step-up'")
    expect(start).toBeGreaterThan(0)
    const body = src.slice(start, src.indexOf('// POST /api/auth/2fa/disable', start))
    expect(body).toContain('recordTwoFactorStepUp(')
    expect(body).not.toContain('twoFactorEnabled: true')
    expect(body).toContain('verifyTotp(')
  })

  it('校验出口只有一份：账本模块不 import 任何密码学/TOTP 实现', () => {
    const storeSrc = read('../src/services/two-factor-step-up-store.ts')
    // 注释里允许出现名字（说清"校验在别处"），但 import 面必须一条都不许有
    expect(storeSrc).not.toMatch(/from '\.\.\/services\/mfa-service\.js'/)
    expect(storeSrc).not.toMatch(/from '\.\.\/services\/totp-service\.js'/)
    expect(storeSrc).not.toMatch(/from '\.\.\/utils\/crypto\.js'/)
  })
})

describe('接线锁·敏感端点全覆盖（2026-10-28：闸必须住在花钱/出凭据之前）', () => {
  const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')
  const GATE = 'requireStepUpForTwoFactorUser({ userId'

  // 每行：文件、应有闸数、逐个闸"之后必须先经过"的落库/出凭据动作。
  // 闸被挪到动作之后、或被整段删掉（count 变化），这里都会红。
  const CASES: Array<{ file: string; gates: number; sinks: string[] }> = [
    {
      file: '../src/routes/developer.ts',
      gates: 2,
      sinks: ['apiKeysService.createKey', 'withdrawBodySchema'],
    },
    { file: '../src/routes/finance.ts', gates: 1, sinks: ['evaluateRisk'] },
    { file: '../src/routes/distribution.ts', gates: 1, sinks: ['insert(withdrawalFlows)'] },
    { file: '../src/routes/user/withdrawal-routes.ts', gates: 1, sinks: ['availableWithdrawal'] },
    { file: '../src/routes/wallet.ts', gates: 1, sinks: ['applyWithdrawal'] },
    { file: '../src/routes/payment-gateway.ts', gates: 2, sinks: ['getBalance', 'getBalance'] },
    { file: '../src/routes/developer-relay.ts', gates: 1, sinks: ['rotateSecret'] },
    { file: '../src/routes/agents.ts', gates: 1, sinks: ['findOAuthAppByClientId'] },
    // 2026-10-29 补齐两处同族漏接：提现申请（agent 分佣提现）与创建分享（一次性回 shareToken = 出凭据）
    {
      file: '../src/routes/agent-extended.ts',
      gates: 1,
      sinks: ['insert(zhsAgentWithdrawalDetail)'],
    },
    { file: '../src/routes/api-key-shares.ts', gates: 1, sinks: ['shareService.createShare'] },
  ]

  const gatePositions = (src: string): number[] => {
    const out: number[] = []
    for (let i = src.indexOf(GATE); i >= 0; i = src.indexOf(GATE, i + 1)) out.push(i)
    return out
  }

  for (const c of CASES) {
    it(`${c.file}：${c.gates} 处闸，且每处都先于落库/出凭据`, () => {
      const src = read(c.file)
      const gates = gatePositions(src)
      expect(gates.length).toBe(c.gates)
      c.sinks.forEach((sink, idx) => {
        const from = gates[idx]!
        const at = src.indexOf(sink, from)
        expect(at).toBeGreaterThan(from)
        const next = gates[idx + 1]
        if (next !== undefined) expect(at).toBeLessThan(next)
      })
    })
  }

  it('拒绝形态是 401 + STEP_UP_REQUIRED（前端据此拉二次验证面板），文案直接给出下一步端点', () => {
    const src = read('../src/routes/finance.ts')
    const g = src.indexOf(GATE)
    expect(g).toBeGreaterThan(0)
    const head = src.slice(g, g + 400)
    expect(head).toContain("stepUp.code === 'STEP_UP_REQUIRED'")
    expect(head).toContain('status(401)')
    expect(head).toContain('/auth/2fa/step-up')
  })

  it('裁定记录：oauth-keys/rotate 是非用户会话态的系统密钥轮转，不接用户闸（接了只会是假安全）', () => {
    expect(read('../src/routes/oauth-keys.ts')).not.toContain(GATE)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
