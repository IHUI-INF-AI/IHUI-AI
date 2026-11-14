// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ZCode planJwt JWT 形态闸门单测(2026-11-15 立)。
 *
 * 落点依据:既有 zcode 适配器测试在 apps/api/tests/relay-zcode-adapter.test.ts(命名 relay-*.test.ts),
 * 且 vitest.config.ts 的 include 覆盖 tests/** 而不覆盖 src/services/upstream-adapters/__tests__/
 * (实测 `vitest run <该路径>` ⇒ No test files found, exiting with code 1),故按「既有命名/位置」落本目录。
 *
 * 取证背景:生产 down 号 zcode:cn 的 credentialMap.zcodejwttoken 是 `enc:v2:os:…`
 * (OS 级加密信封,decryptAccountCredentials 只解一层 secrets_enc,credentialMap 内值原样直通),
 * 旧 planJwt 只判「非空字符串」就把信封串当 Bearer 盲发 ⇒ billing/balance 必 401,
 * 且错面只落成含糊的 `billing/balance HTTP 401`。头部注释实弹证 oauth access_token ⇒ 401,
 * 故本闸门要求「形态非法 ⇒ 诚实失败(点名 + authFailed)」,绝不静默回落、绝不解密、绝不发请求。
 *
 * 纪律:
 * - 判据直用 __test__.planJwt / __test__.PLAN_JWT_SHAPE_RE(生产单一真相源),测试不复制正则;
 * - 所有票据均为合成假值(RFC 7515 / jwt.io 标准示例),无真实凭据、不解密任何 enc 信封;
 * - fetch 全程打桩(opts.fetchImpl),并把 globalThis.fetch 换成抛错兜底,任何真实外联直接失败。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdapterAccountContext } from '../src/services/relay-upstream-adapters.js'
import { __test__, zcodeAdapter } from '../src/services/upstream-adapters/zcode-adapter.js'

const { planJwt, PLAN_JWT_SHAPE_RE } = __test__

// —— 合成假票据(非真实凭据) ——
/** 合法明文 JWT:三段式 base64url,eyJ 开头(RFC 7515 / jwt.io 标准示例) */
const JWT_PLAIN_A =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
const JWT_PLAIN_B = 'eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOiJ6Y29kZS1jbiJ9.YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY'

/** 形态非法样本:[标签, 值, 错误里必须能点名的前缀(可空)] */
const BAD_SHAPES: Array<[label: string, raw: string, marker: string]> = [
  ['enc:v2:os: OS 级加密信封(生产 down 号真身)', 'enc:v2:os:c2c3e9ae1234567890abcdef1234567890', 'enc:v2:os:'],
  ['enc:v1: 提取器旧密文信封', 'enc:v1:9f8e7d6c5b4a3210fedcba9876543210', 'enc:v1:'],
  ['只有两段的伪 JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0', ''],
  ['带非法字符 ! 的伪 JWT', 'eyJ!!.cGF5bG9hZA.c2ln', ''],
  ['第三段尾部带非法字符', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig!', ''],
  ['base64 padding = 的伪 JWT', 'eyJhbGciOiJIUzI1NiJ9.cGF5bG9hZA==.c2ln', ''],
  ['非 eyJ 开头的合成串(既有夹具同形)', 'zc-jwt-fixture', ''],
  ['完全乱串', 'not-a-jwt-at-all', ''],
]

/** 回落样本:[标签, 值](既有 planJwt 语义:缺失/空 ⇒ ctx.credentials.token) */
const FALLBACK_CASES: Array<[label: string, value: unknown]> = [
  ['空串', ''],
  ['纯空格', '   '],
  ['undefined', undefined],
  ['null', null],
  ['非 string(数字)', 12345],
]

const OAUTH_TOKEN = 'oauth-access-token-fixture'

// 兜底:任何绕过 opts.fetchImpl 的真实网络请求直接失败,绝不外联
const boomFetch = vi.fn(() => {
  throw new Error('禁止真实网络请求(本单测所有 fetch 必须打桩)')
})
globalThis.fetch = boomFetch as unknown as typeof fetch

beforeEach(() => {
  boomFetch.mockClear()
})

function makeCtx(zcodejwttoken: unknown, token = OAUTH_TOKEN): AdapterAccountContext {
  return {
    row: {
      id: 'row-plan-jwt-1',
      providerCode: 'zcode',
      uid: 'u-plan-jwt-1',
      name: 'n',
      extraMetadata: null,
    },
    credentials: {
      token,
      refreshToken: null,
      cookies: [],
      secrets: { credentialMap: { zcodejwttoken } },
    },
  } as unknown as AdapterAccountContext
}

function makeCtxNoKey(token = OAUTH_TOKEN): AdapterAccountContext {
  return {
    row: {
      id: 'row-plan-jwt-1',
      providerCode: 'zcode',
      uid: 'u-plan-jwt-1',
      name: 'n',
      extraMetadata: null,
    },
    credentials: {
      token,
      refreshToken: null,
      cookies: [],
      secrets: { credentialMap: {} },
    },
  } as unknown as AdapterAccountContext
}

const BALANCE_OK = JSON.stringify({
  code: 0,
  msg: '',
  data: {
    server_time: 1793095210,
    plans: [
      {
        plan_id: 'zcode-v3-start-plan-0817',
        name: 'ZCode Start Plan',
        status: 'active',
        ends_at: 1793289599,
        entitlements: [{ show_name: 'GLM-5.3', unit_type: 'token', grant_units: 1000 }],
      },
    ],
  },
})

const PLAN_URL = 'https://zcode.z.ai/api/v1/zcode-plan/billing/balance?app_version=3.16.3'

describe('planJwt JWT 形态闸门(enc:v2:os: 信封不得当 Bearer 盲发)', () => {
  describe('① 合法明文 JWT ⇒ 原样放行(同形正例,healthy 号不失效)', () => {
    it.each([JWT_PLAIN_A, JWT_PLAIN_B])('合法 eyJ 三段式 %# ⇒ ok:true 且 jwt 原样', (jwt) => {
      const t = planJwt(makeCtx(jwt))
      expect(t.ok).toBe(true)
      if (t.ok) {
        expect(t.jwt).toBe(jwt)
        expect(t.viaFallback).toBe(false)
      }
    })
  })

  describe('② 形态非法 ⇒ 诚实失败(点名 + 绝不静默回落 oauth)', () => {
    it.each(BAD_SHAPES)('反向牙:%s', (_label, raw, marker) => {
      const t = planJwt(makeCtx(raw))
      expect(t.ok).toBe(false)
      if (!t.ok) {
        expect(t.error).toContain('zcodejwttoken 形态非法(非 JWT 明文)')
        expect(t.error).not.toContain('billing/balance HTTP 401') // 不再落成含糊的 401
        if (marker) expect(t.error).toContain(marker)
      }
    })

    it('即便 oauth token 本身是合法 JWT,非法 zcodejwttoken 也不回落(诚实失败)', () => {
      const t = planJwt(makeCtx(BAD_SHAPES[0]![1], JWT_PLAIN_A))
      expect(t.ok).toBe(false)
      if (!t.ok) expect(t.error).toContain('enc:v2:os:')
    })
  })

  describe('③ 既有回落语义不变(空串/undefined/无键 ⇒ 回落 token)', () => {
    it.each(FALLBACK_CASES)('%s ⇒ viaFallback:true 且 jwt=token', (_label, value) => {
      const t = planJwt(makeCtx(value))
      expect(t.ok).toBe(true)
      if (t.ok) {
        expect(t.viaFallback).toBe(true)
        expect(t.jwt).toBe(OAUTH_TOKEN)
      }
    })

    it('credentialMap 无 zcodejwttoken 键 ⇒ 同样回落', () => {
      const t = planJwt(makeCtxNoKey())
      expect(t.ok).toBe(true)
      if (t.ok) {
        expect(t.viaFallback).toBe(true)
        expect(t.jwt).toBe(OAUTH_TOKEN)
      }
    })
  })

  describe('④ getQuota 闸门前置:形态非法不发请求', () => {
    it.each(BAD_SHAPES)('%s ⇒ fetch 0 次 + authFailed:true + 错误可点名', async (_label, raw, marker) => {
      const spy = vi.fn()
      const q = await zcodeAdapter.getQuota!(makeCtx(raw), {
        fetchImpl: spy as unknown as typeof fetch,
      })
      expect(spy).toHaveBeenCalledTimes(0) // 闸门在发请求之前,绝不盲发
      expect(boomFetch).not.toHaveBeenCalled() // 也没碰全局真实 fetch
      expect(q.ok).toBe(false)
      expect(q.authFailed).toBe(true)
      expect(q.error).toContain('zcodejwttoken 形态非法')
      expect(q.error).not.toContain('套餐点查失败') // 没被 catch 包装成含糊失败
      if (marker) expect(q.error).toContain(marker)
    })
  })

  describe('⑤ 合法改动仍绿:healthy 号(明文 JWT)走 getQuota 全链路不受影响', () => {
    it('fetch 1 次 + ok:true + Bearer 原样 + 端点/请求头常量未改', async () => {
      const spy = vi.fn()
      spy.mockResolvedValue({ ok: true, status: 200, text: async () => BALANCE_OK })
      const q = await zcodeAdapter.getQuota!(makeCtx(JWT_PLAIN_A), {
        fetchImpl: spy as unknown as typeof fetch,
      })
      expect(spy).toHaveBeenCalledTimes(1)
      expect(boomFetch).not.toHaveBeenCalled()
      expect(q.ok).toBe(true)
      expect(q.quota?.subscriptionName).toBe('ZCode Start Plan')
      const [url, init] = spy.mock.calls[0] as [
        string,
        { method?: string; headers?: Record<string, string> },
      ]
      expect(url).toBe(PLAN_URL)
      expect(init.method).toBe('GET')
      expect(init.headers?.['authorization']).toBe(`Bearer ${JWT_PLAIN_A}`)
      expect(init.headers?.['X-ZCode-App-Version']).toBe('3.16.3')
    })
  })

  describe('⑥ checkHealth 同一份闸门(它也走 billing/balance + plan 票)', () => {
    it('非法 ⇒ fetch 0 次 + authFailed:true + 错误可点名', async () => {
      const spy = vi.fn()
      const h = await zcodeAdapter.checkHealth(makeCtx(BAD_SHAPES[0]![1]), {
        fetchImpl: spy as unknown as typeof fetch,
      })
      expect(spy).toHaveBeenCalledTimes(0)
      expect(h.ok).toBe(false)
      expect(h.authFailed).toBe(true)
      expect(h.error).toContain('enc:v2:os:')
    })

    it('合法 JWT ⇒ fetch 1 次 + ok:true', async () => {
      const spy = vi.fn()
      spy.mockResolvedValue({ ok: true, status: 200, text: async () => BALANCE_OK })
      const h = await zcodeAdapter.checkHealth(makeCtx(JWT_PLAIN_A), {
        fetchImpl: spy as unknown as typeof fetch,
      })
      expect(spy).toHaveBeenCalledTimes(1)
      expect(h.ok).toBe(true)
    })
  })

  describe('⑦ 判据单一真相源:__test__.PLAN_JWT_SHAPE_RE 与 planJwt 行为一致', () => {
    it('正则对合法 eyJ 三段式为真、对 enc/伪 JWT 为假(测试直用,不复制判据)', () => {
      expect(PLAN_JWT_SHAPE_RE.test(JWT_PLAIN_A)).toBe(true)
      expect(PLAN_JWT_SHAPE_RE.test(JWT_PLAIN_B)).toBe(true)
      for (const [, raw] of BAD_SHAPES) {
        expect(PLAN_JWT_SHAPE_RE.test(raw)).toBe(false)
      }
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
