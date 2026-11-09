// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-244 回归锁(2026-11-08)。
 *
 * 病灶:授权码换 token 走「findSessionByCode 判 isUsed → markSessionUsed 无条件置 true」
 *       两段式,并发两路都能通过前置检查并各自换出 token(一次授权码两套令牌)。
 * 判据:markSessionUsed 必须是单条条件 UPDATE(isUsed = false + 未过期)并返回是否抢到;
 *       5 个换码入口都必须检查返回值。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const state = vi.hoisted(() => ({ consumed: false }))

vi.mock('../src/db/index.js', () => ({
  db: {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => {
            if (state.consumed) return []
            state.consumed = true
            return [{ code: 'code-1' }]
          },
        }),
      }),
    }),
  },
}))

import { markSessionUsed } from '../src/db/oauth-queries.js'

const srcDir = new URL('../src/', import.meta.url)
const oauthQueriesSource = readFileSync(
  fileURLToPath(new URL('db/oauth-queries.ts', srcDir)),
  'utf8',
)
const authExtendedSource = readFileSync(
  fileURLToPath(new URL('routes/auth-extended.ts', srcDir)),
  'utf8',
)

describe('F-244 授权码消费是原子抢占', () => {
  beforeEach(() => {
    state.consumed = false
  })

  it('第一次消费返回 true,第二次返回 false', async () => {
    expect(await markSessionUsed('code-1')).toBe(true)
    expect(await markSessionUsed('code-1')).toBe(false)
  })

  it('并发两次换码只有一路抢到', async () => {
    const results = await Promise.all([markSessionUsed('code-1'), markSessionUsed('code-1')])
    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it('源码锁:UPDATE 条件必须含 isUsed = false 且返回行数', () => {
    const start = oauthQueriesSource.indexOf('export async function markSessionUsed')
    const block = oauthQueriesSource.slice(start, start + 600)
    expect(block).toContain('eq(oauthSessions.isUsed, false)')
    expect(block).toContain('.returning(')
  })

  it('源码锁:5 个换码入口都原子消费授权码', () => {
    // 4 个入口沿用 markSessionUsed 并逐一检查返回值;
    // 第 5 个入口(/oauth/web/token)已收敛到 claimAuthorizationCode ——
    // 它本身是单条条件 UPDATE(... WHERE is_used = FALSE RETURNING),返回值即抢占结果。
    const calls = authExtendedSource.match(/markSessionUsed\(/g) ?? []
    const guarded = authExtendedSource.match(/if \(!\(await markSessionUsed\(/g) ?? []
    expect(calls).toHaveLength(4)
    expect(guarded).toHaveLength(4)
    const claims = authExtendedSource.match(/const session = await claimAuthorizationCode\(/g) ?? []
    expect(claims).toHaveLength(1)
    expect(authExtendedSource).toMatch(/if \(!session \|\| session\.expiresAt < new Date\(\)\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
