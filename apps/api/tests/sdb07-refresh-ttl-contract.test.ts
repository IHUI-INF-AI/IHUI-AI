// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SDB-07:刷新结果 `expiresAt` 的契约回归(2026-11-11)。
 *
 * 契约(`relay-upstream-adapters.ts` TokenRefreshResult.expiresAt):只许取上游当场给出的值,
 * 上游未给/解析不出 ⇒ null(= 未知,≠ 已过期),禁止编造兜底时刻。
 * 曾出现 CodeArts now+2h、Qoder now+24h 的兜底 —— 编造的未来时刻会让「临期刷新」窗口失效,
 * 票已失效却不在刷新候选集,与 2026-10-23 事故同型。
 *
 * 同时钉住消费侧口径:未知(null)不得被判成「已过期」(仍可选号,降级只走刷新失败路径)。
 * fetch 全部打桩,不发真实网络请求。
 */
import { describe, it, expect, vi } from 'vitest'
import type { AdapterAccountContext } from '../src/services/relay-upstream-adapters.js'
import { qoderAdapter } from '../src/services/upstream-adapters/qoder-adapter.js'
import { __test__ as poolTest, DEFAULT_RELAY_POOL_POLICY } from '../src/services/relay-pool-policy.js'
import { resolveRelayAccountVerdict } from '@ihui/shared'

function makeCtx(): AdapterAccountContext {
  return {
    row: { id: 'row-q', providerCode: 'qoder', uid: 'u-q', name: 'q', extraMetadata: { cosy: {} } },
    credentials: { token: 'old-token', refreshToken: 'rt-old', cookies: [], secrets: {} },
  } as unknown as AdapterAccountContext
}

function resp(body: unknown) {
  return { status: 200, ok: true, json: async () => body, text: async () => JSON.stringify(body) }
}

/** 非 JWT 的新票(实证形状:27 字符 opaque),JWT exp 兜底路径不会命中 */
const OPAQUE_TOKEN = 'opaque-device-token-27chars'

describe('SDB-07 qoder refreshToken 到期契约', () => {
  it('响应无 expires_at 且新票非 JWT ⇒ expiresAt = null(未知,不是编造时刻)', async () => {
    const doFetch = vi.fn().mockResolvedValue(
      resp({ device_token: OPAQUE_TOKEN, refresh_token: 'rt-new', token_type: 'Bearer' }),
    )
    const result = await qoderAdapter.refreshToken!(makeCtx(), {
      fetchImpl: doFetch as unknown as typeof fetch,
    })
    expect(result).not.toBeNull()
    expect(result?.expiresAt).toBeNull()
    // 旧实现兜底 now+24h;任何具体时刻都是编造
    expect(result?.expiresAt).not.toBeInstanceOf(Date)
  })

  it('响应有 expires_at ⇒ 逐字换算(不覆盖成 24h 兜底)', async () => {
    const doFetch = vi.fn().mockResolvedValue(
      resp({ device_token: OPAQUE_TOKEN, refresh_token: 'rt-new', expires_at: '2026-12-08T09:10:11Z' }),
    )
    const result = await qoderAdapter.refreshToken!(makeCtx(), {
      fetchImpl: doFetch as unknown as typeof fetch,
    })
    expect(result?.expiresAt).toEqual(new Date('2026-12-08T09:10:11Z'))
  })

  it('无 expires_at 但新票是 JWT ⇒ 取 claims.exp(上游真实值)', async () => {
    const expSeconds = 1_800_000_000
    const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url')
    const jwt = `header.${payload}.signature`
    const doFetch = vi.fn().mockResolvedValue(resp({ device_token: jwt, refresh_token: 'rt-new' }))
    const result = await qoderAdapter.refreshToken!(makeCtx(), {
      fetchImpl: doFetch as unknown as typeof fetch,
    })
    expect(result?.expiresAt).toEqual(new Date(expSeconds * 1000))
  })

  it('成功路径返回值形状不变(token / refreshToken 原样,不凭空多出字段)', async () => {
    const doFetch = vi
      .fn()
      .mockResolvedValue(resp({ device_token: 'tok-new', refresh_token: 'rt-new' }))
    const result = await qoderAdapter.refreshToken!(makeCtx(), {
      fetchImpl: doFetch as unknown as typeof fetch,
    })
    expect(result).toEqual({ token: 'tok-new', refreshToken: 'rt-new', expiresAt: null })
  })
})

describe('SDB-07 消费侧:未知到期不判为「已过期」', () => {
  // 假时钟:2026-11-11T00:00:00Z;策略默认临期窗 168h
  const nowMs = Date.parse('2026-11-11T00:00:00Z')
  const candidate = {
    id: 'row-1',
    providerCode: 'qoder',
    priority: 0,
    weight: 1,
    lastUsedAt: null,
    tokenExpiresAt: null as Date | null,
  }

  it('isExpiringSoon(选号打分):null ⇒ false,不当作临期/已过期', () => {
    expect(poolTest.isExpiringSoon({ ...candidate }, nowMs, DEFAULT_RELAY_POOL_POLICY)).toBe(false)
  })

  it('isExpiringSoon 对照:过去的时刻 ⇒ true(谓词仍然有效,不是恒 false)', () => {
    expect(
      poolTest.isExpiringSoon(
        { ...candidate, tokenExpiresAt: new Date(nowMs - 1000) },
        nowMs,
        DEFAULT_RELAY_POOL_POLICY,
      ),
    ).toBe(true)
  })

  it('管理面判定:tokenExpiryMs=null ⇒ indeterminate(不是 expired-renewable/expired-dead)', () => {
    const verdict = resolveRelayAccountVerdict(
      { tokenExpiryMs: null, hasCredential: true, hasRefreshCredential: true },
      nowMs,
    )
    expect(verdict.verdict).toBe('indeterminate')
    expect(verdict.tokenRemainingDays).toBeNull()
  })
})
